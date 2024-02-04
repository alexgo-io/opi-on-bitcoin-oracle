#!/bin/bash

# The target file to update
BASHRC_FILE="$HOME/.bashrc"
# The command to source the .env file
SOURCE_COMMAND='source $HOME/.env'

# Escape any PATH or other environment variables in .bashrc that may interfere
ESCAPED_SOURCE_COMMAND=$(printf '%q' "$SOURCE_COMMAND")

# Check if .env sourcing command is already in .bashrc, if not, append it
if ! grep -qxF "$ESCAPED_SOURCE_COMMAND" "$BASHRC_FILE"; then
    echo "$SOURCE_COMMAND" >> "$BASHRC_FILE"
    echo ".env sourcing added to $BASHRC_FILE"
else
    echo ".env sourcing already exists in $BASHRC_FILE"
fi