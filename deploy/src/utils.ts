import * as digitalocean from "@pulumi/digitalocean";
import assert from "assert";
import path from 'path';
import os from 'os';
import fs from 'fs';

export function root(filePath: string) {
    const p = path.resolve(__dirname, `../../${filePath}`);
    if (fs.existsSync(p)) {
        return p;
    }
    throw new Error(`File not found: ${p}`);
}

root("deploy/src/scripts/restore.sh") //?

// convert the absolute path from root(filePath: string) to relative path
// example: unroot(root(a)) === a
export function unroot(filePath: string) {
    return filePath.replace(root("") + "/", "");
}

const id = process.env['DIGITAL_OCEAN_SSH_KEY_ID'];
const name = process.env['DIGITAL_OCEAN_SSH_KEY_NAME'];

assert(id, "DIGITAL_OCEAN_SSH_KEY_ID is required");
assert(name, "DIGITAL_OCEAN_SSH_KEY_NAME is required");

export const sshKey = digitalocean.SshKey.get(name, id);

export const getPrivateKey = () => {
    // Assuming your environment variable is named 'PRIVATE_KEY_PATH'
    const privateKeyPath = process.env['PRIVATE_KEY_PATH'];

    if (!privateKeyPath) {
        console.error('The environment variable PRIVATE_KEY_PATH is not set.');
        process.exit(1); // Exit with an error code
    }

    // Handles the tilde by replacing it with the user's home directory
    const resolvedPrivateKeyPath = privateKeyPath.startsWith('~')
        ? path.join(os.homedir(), privateKeyPath.slice(1))
        : path.resolve(privateKeyPath);

    const key = fs.readFileSync(resolvedPrivateKeyPath, 'utf-8');

    return key;
}

export function getScript(scriptName: string) {
    return fs.readFileSync(`./src/scripts/${scriptName}`, "utf-8");
}