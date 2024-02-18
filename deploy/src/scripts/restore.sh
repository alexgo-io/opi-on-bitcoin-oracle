#!/bin/bash

# Print script start message.
echo "Starting the restore process..."

# Pull latest images
echo "Pulling latest images..."
docker-compose -f restore.docker-compose.yaml pull
echo "Images pulled successfully."

# Start all services
echo "Starting all services..."
docker-compose -f restore.docker-compose.yaml up -d
echo "Services started successfully."

# List running containers for debugging.
echo "Currently running containers:"
docker ps

# Capture the container ID of the "restore" service for debugging.
container_id=$(docker-compose -f restore.docker-compose.yaml ps -q restore)
echo "Container ID of 'restore' service: $container_id"

# If the container ID is empty, it suggests an issue in starting or identifying the container.
if [ -z "$container_id" ]; then
  echo "Failed to find 'restore' service container. Exiting with error."
  exit 1
fi

# Start a background process to print "." every 30 seconds.
while true; do echo -n "."; sleep 30; done &
background_process_pid=$!

# Wait for the "restore" service to finish.
echo "Waiting for the 'restore' service to finish..."
docker wait $container_id

# Stop the background process once the "restore" service has finished.
kill $background_process_pid

# Capture the exit code.
exit_code=$?
echo "Restore service exited with code $exit_code"

# Debug: Get the logs of the "restore" service
echo "Debug: Getting logs of the 'restore' service"
docker logs $(docker-compose -f restore.docker-compose.yaml ps -q restore)

# If exit code is 0, shutdown all services.
if [ $exit_code -eq 0 ]; then
  echo "Shutting down all services..."
  docker-compose -f restore.docker-compose.yaml down
  echo "Services shut down successfully."
  exit 0
else
  echo "Restore service encountered an error. Exiting with code $exit_code"
  exit $exit_code
fi