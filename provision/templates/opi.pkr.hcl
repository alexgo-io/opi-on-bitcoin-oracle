packer {
  required_plugins {
    digitalocean = {
      version = ">= 1.0.4"
      source  = "github.com/digitalocean/digitalocean"
    }
  }
}

variable "digitalocean_api_token" {
  type    = string
  default = "${env("DIGITAL_OCEAN_API_KEY")}"
}

source "digitalocean" "opi-sfo3" {
  api_token    = "${var.digitalocean_api_token}"
  image        = "ubuntu-22-04-x64"
  region       = "sfo3"
  size         = "s-1vcpu-1gb"
  ssh_username = "root"
}
source "digitalocean" "opi-sgp1" {
  api_token    = "${var.digitalocean_api_token}"
  image        = "ubuntu-22-04-x64"
  region       = "sgp1"
  size         = "s-1vcpu-1gb"
  ssh_username = "root"
}
source "digitalocean" "opi-lon1" {
  api_token    = "${var.digitalocean_api_token}"
  image        = "ubuntu-22-04-x64"
  region       = "lon1"
  size         = "s-1vcpu-1gb"
  ssh_username = "root"
}


build {
  name = "opi-ubuntu-22-04-x64"
  sources = [
    "source.digitalocean.opi-sfo3",
    "source.digitalocean.opi-lon1",
    "source.digitalocean.opi-",
  ]

  provisioner "shell" {
    execute_command = "sudo sh -c '{{ .Vars }} {{ .Path }}'"
    script          = "${path.root}/../scripts/build/configure-apt-mock.sh"
  }

  provisioner "shell" {
    environment_vars = ["DEBIAN_FRONTEND=noninteractive"]
    execute_command  = "sudo sh -c '{{ .Vars }} {{ .Path }}'"
    scripts = [
      "${path.root}/../scripts/build/configure-apt-mock.sh",
      "${path.root}/../scripts/build/configure-apt.sh",
      "${path.root}/../scripts/build/setup.sh",
      "${path.root}/../scripts/build/pull.sh",
    ]
  }

  provisioner "shell" {
    execute_command   = "sudo sh -c '{{ .Vars }} {{ .Path }}'"
    expect_disconnect = true
    inline            = ["echo 'Reboot VM'", "sudo reboot"]
  }

  provisioner "shell" {
    execute_command     = "sudo sh -c '{{ .Vars }} {{ .Path }}'"
    pause_before        = "1m0s"
    scripts             = ["${path.root}/../scripts/build/cleanup.sh"]
    start_retry_timeout = "10m"
  }
}