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

### Setup asdf

The project uses [asdf](https://asdf-vm.com/) to manage tool versions. To use it, install asdf and run `asdf install` in the project directory. This will install `packer`, `pulumi`, `pnpm`, and `nodejs` with version specified in `.tool-versions`

```bash
asdf plugin add nodejs https://github.com/asdf-vm/asdf-nodejs.git
asdf plugin add packer
asdf plugin add pulumi
asdf plugin add pnpm
asdf install
```

### Setup direnv

The project uses [direnv](https://direnv.net/) to manage environment variables. To use it, install direnv and run `direnv allow` in the project directory.

create `.envrc.override` file in the project directory and add the following:

### Install DigitalOcean CLI

See [How to Install and Configure doctl](https://docs.digitalocean.com/reference/doctl/how-to/install/)

```bash
# run `doctl compute ssh-key list` to get name and id
export DIGITAL_OCEAN_SSH_KEY_NAME=""
export DIGITAL_OCEAN_SSH_KEY_ID=""
# visit `https://cloud.digitalocean.com/account/api/tokens` to get API key
export DIGITAL_OCEAN_API_KEY=""
# the path to the private key which is able to login machine. such as `~/.ssh/id_rsa`
export PRIVATE_KEY_PATH=""

# set following name for report to OPI network.
# dashboard url: https://opi.network/
export REPORT_NAME_SNS=""
export REPORT_NAME_BITMAP=""
export REPORT_NAME_BRC20=""
```

### Build Image on DigitalOcean

edit file `provision/templates/opi.pkr.hcl` to change the region and source. Then run the following command to build the image. Remember the image id after build is succeed.

```bash
cd provision/templates;
packer build opi.pkr.hcl;
```

### Deploy with pulumi

1. edit file `deploy/src/index.ts` to invoke create function to create instance, use the image id we build from packer in the previous step.

2. set digitalocean token via pulumi config set, make sure you have `DIGITALOCEAN_TOKEN` in your environment variables.

```bash
pulumi config set digitalocean:token $DIGITALOCEAN_TOKEN --secret
```

3. run pulumi up to deploy the infrastructure.

```bash
cd deploy;
pulumi up;
```

This will deploy a DigitalOcean droplet with Docker and run the necessary OPI containers.
The droplet can be accessed via SSH using the defined SSH key.

# Resources

- [Pulumi DigitalOcean Provider](https://www.pulumi.com/docs/reference/pkg/digitalocean/)
- [OPI Documentation](https://github.com/bestinslot-xyz/OPI)
- [asdf](https://asdf-vm.com/)
- [direnv](https://direnv.net/)
- [Pulumi](https://www.pulumi.com/)
- [Packer](https://www.packer.io/)
- [Node.js](https://nodejs.org/)
- [Docker](https://www.docker.com/)
- [DigitalOcean](https://www.digitalocean.com/)
