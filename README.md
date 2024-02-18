# OPI Infrastructure

This project contains infrastructure code for deploying an [OPI](https://github.com/bestinslot-xyz/OPI) node on DigitalOcean using Pulumi. It will create a new DigitalOcean droplet, and mount a volume to it, install bitcoind, OPI softwares such as ord, postgres, and various indexers, and configure it to run. It will also run the restoration script to restore the latest snapshot of the postgres database and ord database. After the restore is complete, it will run all services required.

## Contents

The project contains the following files:

- `.envrc` - Environment variable definitions
- `.tool-versions` - Tool versions
- `deploy/Pulumi.yaml` - Pulumi project configuration
- `deploy/package.json` - Node.js dependencies
- `deploy/Pulumi.dev.yaml` - Pulumi configuration for dev environment
- `configs/` - Configuration scripts

## Getting Started

### DigitalOcean account

You need an account at DigitalOcean and need to be familiar with 

- [doctl Command Line Interface (CLI)](https://docs.digitalocean.com/reference/doctl/)
- [How to Upload SSH Public Keys to a DigitalOcean Team](https://docs.digitalocean.com/products/droplets/how-to/add-ssh-keys/to-team/)
- [How to Create a Personal Access Token](https://docs.digitalocean.com/reference/api/create-personal-access-token/)

### Setup asdf

The project uses [asdf](https://asdf-vm.com/) to manage tool versions. To use it, install asdf and run `asdf install` in the project directory. This will install `pulumi`, `pnpm`, and `nodejs` with version specified in `.tool-versions`

```bash
asdf plugin add nodejs https://github.com/asdf-vm/asdf-nodejs.git
asdf plugin add pulumi
asdf plugin add pnpm  
asdf install
```

### Setup direnv

The project uses [direnv](https://direnv.net/) to manage environment variables. To use it, install direnv and run `direnv allow` in the project directory.

Create `.envrc.override` file in the project directory and add the following:

### Install DigitalOcean CLI

```bash
# run `doctl compute ssh-key list` to get name and id
export DIGITAL_OCEAN_SSH_KEY_NAME=""
export DIGITAL_OCEAN_SSH_KEY_ID=""
# the path to the SSH private key that maps to the above SSH key name/ID, such as `~/.ssh/id_rsa`
export PRIVATE_KEY_PATH=""
# visit `https://cloud.digitalocean.com/account/api/tokens` to get API key
export DIGITAL_OCEAN_API_KEY=""

# set following name for report to OPI network.
# dashboard url: https://opi.network/
export REPORT_NAME=""
```

Make sure you run `direnv allow` so the new environment variables are applied.

### Bootstrap Automatically
A bootstrap script is located at `tools/bin/bootstrap`. After setup above requirements, run `bootstrap` to initialize the project. It will run the following steps:

- `pnpm install` to install dependencies
- `node gen-config.js` to generate config.user.yaml file, which will take precedence over config.yaml
- set digital ocean api key to pulumi secrets.
- run pulumi up to deploy the infrastructure.

```bash
bootstrap
```

### Deploy Manually

1. Edit file `deploy/src/config.yaml` to config the settings.
2. Install dependencies

```bash
cd deploy
pnpm install
```

3. Set digitalocean token via pulumi config set, make sure you have `DIGITAL_OCEAN_API_KEY` in your environment variables.

```bash
pulumi config set digitalocean:token $DIGITAL_OCEAN_API_KEY --secret
```

4. Run pulumi up to deploy the infrastructure.

```bash
cd deploy
pulumi up
```

This will deploy a DigitalOcean droplet with Docker and run the necessary OPI containers.
The droplet can be accessed via SSH using the defined SSH key.

# Others

## ssh config setting
it's recommended to add following to `~/.ssh/config` to avoid interrupt ssh connection while provision the instance.

```
TCPKeepAlive yes
ServerAliveInterval 30
ServerAliveCountMax 4
```

# Resources

- [Pulumi DigitalOcean Provider](https://www.pulumi.com/docs/reference/pkg/digitalocean/)
- [OPI Documentation](https://github.com/bestinslot-xyz/OPI)
- [asdf](https://asdf-vm.com/)
- [direnv](https://direnv.net/)
- [Pulumi](https://www.pulumi.com/)
- [Node.js](https://nodejs.org/)
- [Docker](https://www.docker.com/)
- [DigitalOcean](https://www.digitalocean.com/)
