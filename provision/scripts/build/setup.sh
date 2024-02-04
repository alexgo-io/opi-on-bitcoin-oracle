#!/bin/bash -e

## Common

# while sudo lsof /var/lib/dpkg/lock-frontend ; do sleep 1; done;
# Install packages to allow apt to use a repository over HTTPS
sudo apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    wget \
    git \
    build-essential \
    ncdu \
    bpytop \
    pbzip2 \
    lsb-release

## Install Docker
curl -fsSL https://get.docker.com | sh

# Enable docker.service
systemctl is-active --quiet docker.service || systemctl start docker.service
systemctl is-enabled --quiet docker.service || systemctl enable docker.service

# Docker daemon takes time to come up after installing
sleep 10
docker info

## Install docker-compose

# Download the current stable release of Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep -Po '"tag_name": "\K.*?(?=")')/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

# Apply executable permissions to the binary
sudo chmod +x /usr/local/bin/docker-compose

# Optionally, install command completion for the bash shell
sudo curl -L https://raw.githubusercontent.com/docker/compose/$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep -Po '"tag_name": "\K.*?(?=")')/contrib/completion/bash/docker-compose -o /etc/bash_completion.d/docker-compose

# Check the installation
docker-compose version
