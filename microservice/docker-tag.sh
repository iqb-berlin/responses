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
VERSION=$(node -p "require('../package.json').version")

# Parse version components
IFS='.' read -r MAJOR MINOR PATCH <<< "$VERSION"

echo -e "${GREEN}Tagging Docker image for version ${VERSION}${NC}"
echo ""

# Function to tag image
tag_image() {
    local registry=$1
    local image_name=$2
    
    echo -e "${YELLOW}Tagging for ${registry}...${NC}"
    
    # Full version tag
    docker tag ${LOCAL_IMAGE} ${registry}/${image_name}:${VERSION}
    echo "  ✓ ${registry}/${image_name}:${VERSION}"
    
    # Major.Minor tag
    docker tag ${LOCAL_IMAGE} ${registry}/${image_name}:${MAJOR}.${MINOR}
    echo "  ✓ ${registry}/${image_name}:${MAJOR}.${MINOR}"
    
    # Major tag
    docker tag ${LOCAL_IMAGE} ${registry}/${image_name}:${MAJOR}
    echo "  ✓ ${registry}/${image_name}:${MAJOR}"
    
    # Latest tag
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
