import * as digitalocean from "@pulumi/digitalocean";
import { getPrivateKey, getScript, root, sshKey, unroot } from './utils'
import assert from "assert";
import { local, remote, types } from "@pulumi/command";
import fs from 'fs'
import path from 'path'
import os from 'os';
import { join } from 'path';
import { createHash } from 'crypto';
import * as pulumi from "@pulumi/pulumi";
import { Output } from '@pulumi/pulumi';
import { readdirSync, readFileSync, statSync } from 'fs';

function create(params: { name: string, region: string, size: string, image: string }) {
    const { region, size, name, image } = params
    const snapshotId = (() => {
        const id = process.env['OPI_VOLUME_SNAPSHOT_ID']
        return id?.length == 0 ? undefined : id
    })()

    const volume = new digitalocean.Volume(`${name}volume`, {
        region,
        size: parseInt(process.env['OPI_VOLUME_SIZE'] ?? "1000", 10),
        initialFilesystemType: "ext4",
        snapshotId,
    })

    const droplet = new digitalocean.Droplet(`${name}-droplet`, {
        image,
        region,
        size,
        // monitoring: true,
        sshKeys: [sshKey.id],
    });
    const copyDir = (loc: string, remotePath: pulumi.Output<string>) => {
        if (!fs.existsSync(loc)) {
            throw new Error(`not found: ${loc}`)
        }
        const hash = generateDirectoryHash(loc).slice(0, 5)
        return new local.Command(`${name}:copyFiles:${hash} ${unroot(loc)}`, {
            create: pulumi.interpolate`rsync -avP ${loc} ${connection.user}@${droplet.ipv4Address}:${remotePath}`,
        })
    }

    const volumeAttachment = new digitalocean.VolumeAttachment(
        `${name}-volume-attachment`,
        {
            dropletId: droplet.id.apply(id => parseInt(id, 10)),
            volumeId: volume.id,
        }
    );

    const privateKey = getPrivateKey();

    const connection: types.input.remote.ConnectionArgs = {
        host: droplet.ipv4Address,
        user: "root",
        privateKey,
    };

    const volumePathPrint = new remote.Command(`${name}-read-volume-path`, {
        connection,
        create: getScript('print_mnt_name.sh'),
    }, { dependsOn: [droplet, volumeAttachment, volume], customTimeouts: { create: '5m' } });

    const cpRestoreDockerCompose = volumePathPrint.stdout.apply(volumeName => {
        const localPath = transformFile(name, './src/docker-composes/restore.docker-compose.yaml', [
            ['${OPI_PG_DATA_PATH}', `${volumeName}/pg_data`],
            ['${OPI_IMAGE}', process.env['OPI_IMAGE']!],
            // DB_USER
            ['${DB_USER}', process.env['DB_USER']!],
            // DB_PASSWORD
            ['${DB_PASSWD}', process.env['DB_PASSWD']!],
            // DB_DATABASE
            ['${DB_DATABASE}', process.env['DB_DATABASE']!],
            // WORKSPACE_ROOT
            ['${WORKSPACE_ROOT}', volumeName],
        ])

        const file = fs.readFileSync(localPath, 'utf-8')
        const hash = createHash('md5').update(file).digest('hex').slice(0, 5)

        return new remote.CopyFile(`${name}:restore:${hash}`, {
            connection,
            localPath,
            remotePath: `${volumeName}/restore.docker-compose.yaml`,
        });
    })

    const execScriptOnRemote = (loc: string, options: { cwd?: pulumi.Output<string>, commandOpts?: any } = {}) => {
        // cwd is the CWD
        const createContent = fs.readFileSync(root(loc), "utf-8");

        if (options.cwd) {
            return new remote.Command(`${name}:run[remote]: ${loc}`, {
                connection,
                create: pulumi.interpolate`mkdir -p ${options.cwd};
            cd ${options.cwd};
            ${createContent}`
            }, options.commandOpts);
        }
        else {
            return new remote.Command(`${name}:run[remote]: ${loc}`, {
                connection,
                create: createContent
            }, options.commandOpts);
        }
    }


    const cpConfig = copyDir(root('configs'), pulumi.interpolate`${volumePathPrint.stdout}`)

    const restore = execScriptOnRemote('deploy/src/scripts/restore.sh', {
        cwd: pulumi.interpolate`/${volumePathPrint.stdout}`,
        commandOpts: {
            dependsOn: [cpConfig, cpRestoreDockerCompose],
        }
    })

    volumePathPrint.stdout.apply(volumeName => {
        const localPath = transformFile(name, './src/docker-composes/opi.docker-compose.yaml', [
            ['${OPI_PG_DATA_PATH}', `${volumeName}/pg_data`],
            ['${OPI_BITCOIND_PATH}', `${volumeName}/bitcoind_data`],
            ['${OPI_IMAGE}', process.env['OPI_IMAGE']!],
            ['${BITCOIND_IMAGE}', process.env['BITCOIND_IMAGE']!],
            // DB_USER
            ['${DB_USER}', process.env['DB_USER']!],
            // DB_PASSWORD
            ['${DB_PASSWD}', process.env['DB_PASSWD']!],
            // DB_DATABASE
            ['${DB_DATABASE}', process.env['DB_DATABASE']!],
            // WORKSPACE_ROOT
            ['${WORKSPACE_ROOT}', volumeName],
            // BITCOIN_RPC_USER
            ['${BITCOIN_RPC_USER}', process.env['BITCOIN_RPC_USER']!],
            // BITCOIN_RPC_PASSWD
            ['${BITCOIN_RPC_PASSWD}', process.env['BITCOIN_RPC_PASSWD']!],
            // BITCOIN_RPC_PORT
            ['${BITCOIN_RPC_PORT}', process.env['BITCOIN_RPC_PORT']!],
        ]);
        const file = fs.readFileSync(localPath, 'utf-8')
        const hash = createHash('md5').update(file).digest('hex').slice(0, 5)

        const cpDockerCompose = new remote.CopyFile(`${name}:cp:opi.docker-compose:${hash} -> ${volumeName}`, {
            connection,
            localPath,
            remotePath: `${volumeName}/opi.docker-compose.yaml`,
        }, { dependsOn: [restore] });

        new remote.Command(`${name}:start-opi:${hash}`, {
            connection,
            create: pulumi.interpolate`cd ${volumePathPrint.stdout} && docker-compose -f opi.docker-compose.yaml pull && docker-compose -f opi.docker-compose.yaml up -d`,
        }, { dependsOn: [cpDockerCompose] })
    })


    exports[`ip_${name}`] = droplet.ipv4Address;
    exports[`name_${name}`] = droplet.name;
    exports[`volume_id_${name}`] = volume.id;
    exports[`volume_attachment_id_${name}`] = volumeAttachment.id;
    exports[`volume_path_${name}`] = volumePathPrint.stdout;

    return { droplet, volume, name };
}

// write takeSnapshot function which input is the output of function create.
function takeSnapshot(params: { name: string, volume: digitalocean.Volume }) {
    const { name, volume } = params;

    const createSnapshot = new digitalocean.VolumeSnapshot(`${name}-snapshot`, {
        volumeId: volume.id,
        name: `${name}-snapshot`,
    });

    exports[`volume_snapshot_${name}`] = createSnapshot.id;

    return { createSnapshot };
}


function transformFile(seed: string, filePath: string, transforms: string[][]): string {
    // Read the content of the source file
    const content = fs.readFileSync(filePath, 'utf8');

    // Apply all transformations
    let transformedContent = content;
    for (const transform of transforms) {
        const [original, replacement] = transform;
        transformedContent = transformedContent.split(original).join(replacement);
    }

    // Create a temp file in a random location
    const tempDir = createTmpDirFromSeed(filePath + seed);
    const tempFilePath = path.join(tempDir, path.basename(filePath));

    // Write the transformed content to the temp file
    fs.writeFileSync(tempFilePath, transformedContent);

    // Return the path of the temp file
    return tempFilePath;
}
const createTmpDirFromSeed = (seed: string): string => {
    const hash = createHash('sha256').update(seed).digest('hex');
    const tmpBaseDir = '/tmp';
    const dirPath = join(tmpBaseDir, hash);

    try {
        fs.mkdirSync(dirPath, { recursive: true });
        return dirPath;
    } catch (error) {
        throw new Error(`Failed to create temp directory: ${error}`);
    }
};
function hashFile(filePath: string): string {
    const fileBuffer = readFileSync(filePath);
    const hashSum = createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}

function generateDirectoryHash(dirPath: string): string {
    let hashString = '';

    const files = readdirSync(dirPath);
    for (const file of files) {
        const filePath = join(dirPath, file);
        const fileStat = statSync(filePath);

        if (fileStat.isDirectory()) {
            hashString += `${file}:${generateDirectoryHash(filePath)}`;
        } else {
            hashString += `${file}:${hashFile(filePath)}`;
        }
    }

    const hashSum = createHash('sha256');
    hashSum.update(hashString);
    return hashSum.digest('hex');
}

// ===============
// Create Droplet
// ===============

const instances = [

    create({
        name: "opi1sfo",
        region: 'sfo3',
        size: 's-8vcpu-16gb-amd',
        image: '149367446'
    }),

    create({
        name: "opi1lon",
        region: 'lon1',
        size: 's-8vcpu-16gb-amd',
        image: '149439505'
    }),

    create({
        name: "opi1sgp",
        region: 'sgp1',
        size: 's-8vcpu-16gb-amd',
        image: '149439499'
    })];

// takeSnapshot(instances[0])