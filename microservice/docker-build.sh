#!/bin/bash

# Navigate to the parent directory to set the build context
cd "$(dirname "$0")/.." || exit

# Get versions
MS_VERSION=$(node -p "require('./microservice/package.json').version")
LIB_VERSION=$(node -p "require('./package.json').version")

echo "Building responses-microservice v$MS_VERSION with @iqb/responses v$LIB_VERSION"

# Build the Docker image
# -f microservice/Dockerfile specifies the Dockerfile location relative to the context
# -t responses-microservice is the tag for the image
docker build -f microservice/Dockerfile \
  -t responses-microservice \
  --build-arg MS_VERSION="$MS_VERSION" \
  --build-arg LIB_VERSION="$LIB_VERSION" \
  --load .
