#!/bin/bash

# Docker Publish Script for Responses Microservice
# This script publishes the tagged images to a Docker registry

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
MS_VERSION=$(node -p "require('./package.json').version")
LIB_VERSION=$(node -p "require('../package.json').version")

IFS='.' read -r MS_MAJOR MS_MINOR MS_PATCH <<< "$MS_VERSION"
IFS='.' read -r LIB_MAJOR LIB_MINOR LIB_PATCH <<< "$LIB_VERSION"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Docker Publish Script${NC}"
echo -e "${BLUE}Microservice: ${MS_VERSION}${NC}"
echo -e "${BLUE}Library:      ${LIB_VERSION}${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Function to push images
push_images() {
    local registry=$1
    local image_name=$2
    
    echo -e "${YELLOW}Pushing to ${registry}...${NC}"
    
    # 1. Combined Tag
    local COMBINED_TAG="m${MS_VERSION}-l${LIB_VERSION}"
    docker push ${registry}/${image_name}:${COMBINED_TAG}
    echo "  ✓ Pushed ${registry}/${image_name}:${COMBINED_TAG}"
    
    # 2. Microservice Tags
    docker push ${registry}/${image_name}:${MS_VERSION}
    echo "  ✓ Pushed ${registry}/${image_name}:${MS_VERSION}"
    
    docker push ${registry}/${image_name}:${MS_MAJOR}.${MS_MINOR}
    echo "  ✓ Pushed ${registry}/${image_name}:${MS_MAJOR}.${MS_MINOR}"
    
    docker push ${registry}/${image_name}:${MS_MAJOR}
    echo "  ✓ Pushed ${registry}/${image_name}:${MS_MAJOR}"
    
    # 3. Library Tags
    docker push ${registry}/${image_name}:lib${LIB_VERSION}
    echo "  ✓ Pushed ${registry}/${image_name}:lib${LIB_VERSION}"
    
    docker push ${registry}/${image_name}:lib${LIB_MAJOR}.${LIB_MINOR}
    echo "  ✓ Pushed ${registry}/${image_name}:lib${LIB_MAJOR}.${LIB_MINOR}"
    
    # 4. Latest
    docker push ${registry}/${image_name}:latest
    echo "  ✓ Pushed ${registry}/${image_name}:latest"
    
    echo ""
}

# Function to login to registry
login_registry() {
    local registry=$1
    
    echo -e "${YELLOW}Logging in to ${registry}...${NC}"
    
    case $registry in
        "ghcr.io")
            echo "Please ensure you have a GitHub Personal Access Token with 'write:packages' scope"
            echo "Create one at: https://github.com/settings/tokens"
            read -p "Enter GitHub username: " GITHUB_USER
            read -sp "Enter GitHub token: " GITHUB_TOKEN
            echo ""
            echo $GITHUB_TOKEN | docker login ghcr.io -u $GITHUB_USER --password-stdin
            ;;
        "docker.io"|"")
            echo "Logging in to Docker Hub..."
            docker login
            ;;
        *)
            echo "Logging in to ${registry}..."
            docker login $registry
            ;;
    esac
    
    echo -e "${GREEN}Login successful!${NC}"
    echo ""
}

# Ask which registry to publish to
echo "Select registry to publish to:"
echo "1) GitHub Container Registry (ghcr.io)"
echo "2) Docker Hub"
echo "3) Private Registry"
echo "4) All of the above"
read -p "Enter choice [1-4]: " choice

case $choice in
    1)
        login_registry "ghcr.io"
        push_images "ghcr.io/iqb-berlin" "responses-microservice"
        echo -e "${GREEN}Published to GitHub Container Registry!${NC}"
        echo "View at: https://github.com/orgs/iqb-berlin/packages"
        ;;
    2)
        login_registry "docker.io"
        push_images "iqbberlin" "responses-microservice"
        echo -e "${GREEN}Published to Docker Hub!${NC}"
        echo "View at: https://hub.docker.com/r/iqbberlin/responses-microservice"
        ;;
    3)
        read -p "Enter private registry URL (e.g., registry.iqb.de): " PRIVATE_REGISTRY
        login_registry "${PRIVATE_REGISTRY}"
        push_images "${PRIVATE_REGISTRY}" "responses-microservice"
        echo -e "${GREEN}Published to ${PRIVATE_REGISTRY}!${NC}"
        ;;
    4)
        # GitHub Container Registry
        login_registry "ghcr.io"
        push_images "ghcr.io/iqb-berlin" "responses-microservice"
        
        # Docker Hub
        login_registry "docker.io"
        push_images "iqbberlin" "responses-microservice"
        
        # Private Registry (optional)
        read -p "Enter private registry URL (optional, press Enter to skip): " PRIVATE_REGISTRY
        if [ ! -z "$PRIVATE_REGISTRY" ]; then
            login_registry "${PRIVATE_REGISTRY}"
            push_images "${PRIVATE_REGISTRY}" "responses-microservice"
        fi
        
        echo -e "${GREEN}Published to all registries!${NC}"
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Publish complete!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Other projects can now use the image with:"
echo "  docker pull ghcr.io/iqb-berlin/responses-microservice:${VERSION}"
echo "  docker pull iqbberlin/responses-microservice:${VERSION}"
echo ""
echo "See DOCKER_REGISTRY.md for integration examples"
