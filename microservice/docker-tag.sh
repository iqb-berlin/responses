#!/bin/bash

# Docker Tag Script for Responses Microservice
# This script tags the local image with appropriate version tags

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
LOCAL_IMAGE="responses-microservice"
MS_VERSION=$(node -p "require('./package.json').version")
LIB_VERSION=$(node -p "require('../package.json').version")

# Parse version components
IFS='.' read -r MS_MAJOR MS_MINOR MS_PATCH <<< "$MS_VERSION"
IFS='.' read -r LIB_MAJOR LIB_MINOR LIB_PATCH <<< "$LIB_VERSION"

echo -e "${GREEN}Tagging Docker image:${NC}"
echo -e "  Microservice: ${MS_VERSION}"
echo -e "  Library:      ${LIB_VERSION}"
echo ""

# Function to tag image
tag_image() {
    local registry=$1
    local image_name=$2
    
    echo -e "${YELLOW}Tagging for ${registry}...${NC}"
    
    # 1. Combined Tag (Explicit)
    local COMBINED_TAG="m${MS_VERSION}-l${LIB_VERSION}"
    docker tag ${LOCAL_IMAGE} ${registry}/${image_name}:${COMBINED_TAG}
    echo "  ✓ ${registry}/${image_name}:${COMBINED_TAG}"
    
    # 2. Microservice version tags
    docker tag ${LOCAL_IMAGE} ${registry}/${image_name}:${MS_VERSION}
    echo "  ✓ ${registry}/${image_name}:${MS_VERSION}"
    
    docker tag ${LOCAL_IMAGE} ${registry}/${image_name}:${MS_MAJOR}.${MS_MINOR}
    echo "  ✓ ${registry}/${image_name}:${MS_MAJOR}.${MS_MINOR}"
    
    docker tag ${LOCAL_IMAGE} ${registry}/${image_name}:${MS_MAJOR}
    echo "  ✓ ${registry}/${image_name}:${MS_MAJOR}"
    
    # 3. Library version tags
    docker tag ${LOCAL_IMAGE} ${registry}/${image_name}:lib${LIB_VERSION}
    echo "  ✓ ${registry}/${image_name}:lib${LIB_VERSION}"
    
    docker tag ${LOCAL_IMAGE} ${registry}/${image_name}:lib${LIB_MAJOR}.${LIB_MINOR}
    echo "  ✓ ${registry}/${image_name}:lib${LIB_MAJOR}.${LIB_MINOR}"
    
    # 4. Latest tag
    docker tag ${LOCAL_IMAGE} ${registry}/${image_name}:latest
    echo "  ✓ ${registry}/${image_name}:latest"
    
    echo ""
}

# Check if local image exists
if ! docker image inspect ${LOCAL_IMAGE} > /dev/null 2>&1; then
    echo -e "${RED}Error: Local image '${LOCAL_IMAGE}' not found!${NC}"
    echo "Please run ./docker-build.sh first"
    exit 1
fi

# Ask which registry to tag for
echo "Select registry to tag for:"
echo "1) GitHub Container Registry (ghcr.io)"
echo "2) Docker Hub"
echo "3) Private Registry"
echo "4) All of the above"
read -p "Enter choice [1-4]: " choice

case $choice in
    1)
        tag_image "ghcr.io/iqb-berlin" "responses-microservice"
        ;;
    2)
        tag_image "iqbberlin" "responses-microservice"
        ;;
    3)
        read -p "Enter private registry URL (e.g., registry.iqb.de): " PRIVATE_REGISTRY
        tag_image "${PRIVATE_REGISTRY}" "responses-microservice"
        ;;
    4)
        tag_image "ghcr.io/iqb-berlin" "responses-microservice"
        tag_image "iqbberlin" "responses-microservice"
        read -p "Enter private registry URL (optional, press Enter to skip): " PRIVATE_REGISTRY
        if [ ! -z "$PRIVATE_REGISTRY" ]; then
            tag_image "${PRIVATE_REGISTRY}" "responses-microservice"
        fi
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo -e "${GREEN}Tagging complete!${NC}"
echo ""
echo "To view all tags:"
echo "  docker images | grep responses-microservice"
echo ""
echo "To push images, run:"
echo "  ./docker-publish.sh"
