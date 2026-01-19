#!/bin/bash

# Navigate to the parent directory to set the build context
cd "$(dirname "$0")/.." || exit

# Build the Docker image
# -f microservice/Dockerfile specifies the Dockerfile location relative to the context
# -t responses-microservice is the tag for the image
docker build -f microservice/Dockerfile -t responses-microservice --load .
