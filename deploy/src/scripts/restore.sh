#!/bin/bash

# Start all services
docker-compose -f restore.docker-compose.yaml up -d

# Wait for the "restore" service to finish and exit with a 0
docker wait $(docker-compose -f restore.docker-compose.yaml ps -q restore)

# Capture the exit code
exit_code=$?

# If exit code is 0, shutdown all services
if [ $exit_code -eq 0 ]; then
  docker-compose -f restore.docker-compose.yaml down
else
  echo "Restore service exited with code $exit_code"
  exit $exit_code
fi