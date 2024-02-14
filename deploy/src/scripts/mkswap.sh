#!/bin/bash

# Swap file size (e.g., 1G for 1 GB)
SWAP_SIZE="32G"
# Swap file path
SWAP_FILE=/swapfile

# Check if the swap file already exists
if [ -f $SWAP_FILE ]; then
    echo "Swap file $SWAP_FILE already exists."
    exit 0
fi

# Create a swap file
sudo fallocate -l $SWAP_SIZE $SWAP_FILE || exit 1

# Secure swap file permissions
sudo chmod 600 $SWAP_FILE

# Set up a Linux swap area
sudo mkswap $SWAP_FILE

# Enable the swap file
sudo swapon $SWAP_FILE

# Make the swap file permanent
echo "$SWAP_FILE none swap sw 0 0" | sudo tee -a /etc/fstab

# Output the result
echo "Swap file $SWAP_FILE created and turned on."