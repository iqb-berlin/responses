#!/bin/bash

# Run the Docker container
# -p 3000:3000 maps the host port 3000 to the container port 3000
# --rm removes the container when it stops
# --name responses-ms names the running container for easier management
docker run --rm -p 3000:3000 --name responses-ms responses-microservice
