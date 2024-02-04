#!/bin/bash

retry_count=0
max_retries=100
retry_delay=5

while [ $retry_count -lt $max_retries ]; do
    # Search for directories containing 'volume' in their name under /mnt
    directories=$(find /mnt -type d -name "*volume*" 2>/dev/null)
    dir_count=$(echo "$directories" | grep -c 'volume')

    if [ "$dir_count" -eq 1 ]; then
        # If exactly one directory is found, print the directory name and exit with success
        echo "$directories"
        exit 0
    elif [ "$dir_count" -gt 1 ]; then
        # More than one directory found, exit with code 2 (misuse of shell builtins according to Bash documentation)
        echo "Multiple directories found."
        exit 2
    else
        # No directories found, increment the retry counter and wait
        ((retry_count++))
        sleep $retry_delay
    fi
done

# If no directory is found after the maximum number of retries, exit with code 3
exit 3
