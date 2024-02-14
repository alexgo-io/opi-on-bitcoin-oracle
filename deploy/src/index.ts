// ===============
// Create Droplet
// ===============

import * as digitalocean from '@pulumi/digitalocean'
import {
  generateDirectoryHash,
  getScript,
  root,
  transformFile,
  unroot,
} from './utils'
import * as pulumi from '@pulumi/pulumi'
import fs from 'fs'
import { local, remote, types } from '@pulumi/command'
import { createHash } from 'crypto'
import { getPrivateKey, sshKey } from './keys'

export function create(params: {
  name: string
  region: string
  size: string
  image: string
}) {
  const { region, size, name, image } = params
  const snapshotId = (() => {
    const id = process.env['OPI_VOLUME_SNAPSHOT_ID']
    return id?.length == 0 ? undefined : id
  })()

  // create instance
  const volume = new digitalocean.Volume(`${name}volume`, {
    region,
    size: parseInt(process.env['OPI_VOLUME_SIZE'] ?? '1000', 10),
    initialFilesystemType: 'ext4',
    snapshotId,
  })

  const droplet = new digitalocean.Droplet(`${name}-droplet`, {
    image,
    region,
    size,
    // monitoring: true,
    sshKeys: [sshKey.id],
  })

  const copyConfigDir = (loc: string, remotePath: pulumi.Output<string>) => {
    if (!fs.existsSync(loc)) {
      throw new Error(`not found: ${loc}`)
    }
    const hash = generateDirectoryHash(loc).slice(0, 5)
    return new local.Command(`${name}:copyFiles ${unroot(loc)}`, {
      create: pulumi.interpolate`rsync -avP ${loc} ${connection.user}@${droplet.ipv4Address}:${remotePath}`,
      triggers: [hash, loc, remotePath],
    })
  }

  // mount disk
  const volumeAttachment = new digitalocean.VolumeAttachment(
    `${name}-volume-attachment`,
    {
      dropletId: droplet.id.apply((id) => parseInt(id, 10)),
      volumeId: volume.id,
    },
  )

  const privateKey = getPrivateKey()

  const connection: types.input.remote.ConnectionArgs = {
    host: droplet.ipv4Address,
    user: 'root',
    privateKey,
  }

  const volumePathPrint = new remote.Command(
    `${name}-read-volume-path`,
    {
      connection,
      create: getScript('print_mnt_name.sh'),
    },
    {
      dependsOn: [droplet, volumeAttachment, volume],
      customTimeouts: { create: '5m' },
    },
  )

  // cp restore files
  const cpRestoreDockerCompose = volumePathPrint.stdout.apply((volumeName) => {
    const localPath = transformFile(
      name,
      './src/docker-composes/restore.docker-compose.yaml',
      [
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
        // ORD_DATADIR
        ['${ORD_DATADIR}', `${volumeName}/ord_data`],
      ],
    )

    const file = fs.readFileSync(localPath, 'utf-8')
    const hash = createHash('md5').update(file).digest('hex').slice(0, 5)
    const remotePath = `${volumeName}/restore.docker-compose.yaml`

    return new remote.CopyFile(`${name}:restore`, {
      connection,
      localPath,
      remotePath,
      triggers: [hash, localPath],
    })
  })

  const execScriptOnRemote = (
    loc: string,
    options: { cwd?: pulumi.Output<string>; commandOpts?: any } = {},
  ) => {
    // cwd is the CWD
    const createContent = fs.readFileSync(root(loc), 'utf-8')
    const createContentHash = createHash('md5')
      .update(createContent)
      .digest('hex')

    if (options.cwd) {
      return new remote.Command(
        `${name}:run[remote]: ${loc}`,
        {
          connection,
          create: pulumi.interpolate`mkdir -p ${options.cwd};
            cd ${options.cwd};
            ${createContent}`,
          triggers: [createContentHash, loc],
        },
        {
          ...options.commandOpts,
        },
      )
    } else {
      return new remote.Command(
        `${name}:run[remote]: ${loc}`,
        {
          connection,
          create: createContent,
          triggers: [createContentHash, loc],
        },
        options.commandOpts,
      )
    }
  }

  const cpConfig = copyConfigDir(
    root('configs'),
    pulumi.interpolate`${volumePathPrint.stdout}`,
  )

  // create swap space
  execScriptOnRemote('deploy/src/scripts/mkswap.sh')

  // restore pg database and ord_data
  const restore = execScriptOnRemote('deploy/src/scripts/restore.sh', {
    cwd: pulumi.interpolate`/${volumePathPrint.stdout}`,
    commandOpts: {
      dependsOn: [cpConfig, cpRestoreDockerCompose],
    },
  })

  // cp service docker-compose file
  /**
   * Applies transformations to the opi docker compose file, copies it to the remote volume,
   * and starts the opi docker compose stack.
   * Depends on the restore script finishing first.
   */
  volumePathPrint.stdout.apply((volumeName) => {
    const localPath = transformFile(
      name,
      './src/docker-composes/opi.docker-compose.yaml',
      [
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
        // BITCOIN_RPC_POR
        ['${BITCOIN_RPC_PORT}', process.env['BITCOIN_RPC_PORT']!],
        // ORD_DATADIR
        ['${ORD_DATADIR}', `${volumeName}/ord_data`],
        // BITCOIN_CHAIN_FOLDER
        ['${BITCOIN_CHAIN_FOLDER}', `${volumeName}/bitcoind_data/datadir`],
      ],
    )
    const file = fs.readFileSync(localPath, 'utf-8')
    const hash = createHash('md5').update(file).digest('hex').slice(0, 5)

    const cpDockerCompose = new remote.CopyFile(
      `${name}:cp:opi.docker-compose. -> ${volumeName}`,
      {
        connection,
        localPath,
        remotePath: `${volumeName}/opi.docker-compose.yaml`,
        triggers: [hash, localPath],
      },
      { dependsOn: [restore] },
    )

    // start opi
    new remote.Command(
      `${name}:start-opi.`,
      {
        connection,
        create: pulumi.interpolate`cd ${volumePathPrint.stdout} && docker-compose -f opi.docker-compose.yaml pull && docker-compose -f opi.docker-compose.yaml up -d`,
        triggers: [hash],
      },
      { dependsOn: [cpDockerCompose] },
    )
  })

  exports[`ip_${name}`] = droplet.ipv4Address
  exports[`name_${name}`] = droplet.name
  exports[`volume_id_${name}`] = volume.id
  exports[`volume_attachment_id_${name}`] = volumeAttachment.id
  exports[`volume_path_${name}`] = volumePathPrint.stdout

  return { droplet, volume, name }
}

const instances = [
  create({
    name: 'opi1sfo',
    region: 'sfo3',
    size: 's-8vcpu-16gb-amd',
    image: '149367446',
  }),

  create({
    name: 'opi1lon',
    region: 'lon1',
    size: 's-8vcpu-16gb-amd',
    image: '149439505',
  }),

  create({
    name: 'opi1sgp',
    region: 'sgp1',
    size: 's-8vcpu-16gb-amd',
    image: '149439499',
  }),
]

console.log(`created: ${instances.length} instances`)
