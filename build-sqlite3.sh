#!/bin/bash
# Build sqlite3 native module for ARM Synology NAS
# Requires: Docker with buildx (for ARM emulation via QEMU)
#
# This script builds sqlite3 in a Docker container matching the NAS environment,
# then extracts the compiled .node binary for deployment.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="$SCRIPT_DIR/prebuilt"

# Configuration
ARCH="${1:-armv7}"
NODE_VERSION="18"

echo "=========================================="
echo "Building sqlite3 for ARM Synology NAS"
echo "Architecture: $ARCH"
echo "Node.js: $NODE_VERSION"
echo "=========================================="

# Ensure output directory exists
mkdir -p "$OUTPUT_DIR"

# Check Docker buildx availability
if ! docker buildx version &> /dev/null; then
    echo "ERROR: Docker buildx not available"
    echo "Install with: docker buildx install"
    exit 1
fi

# Setup QEMU for ARM emulation (if not already done)
echo "Setting up QEMU for ARM emulation..."
docker run --rm --privileged multiarch/qemu-user-static --reset -p yes 2>/dev/null || true

# Build the Docker image
echo ""
echo "Building Docker image (this may take several minutes)..."

if [ "$ARCH" = "armv7" ]; then
    PLATFORM="linux/arm/v7"
    DOCKERFILE="Dockerfile.build-sqlite3"
elif [ "$ARCH" = "aarch64" ]; then
    PLATFORM="linux/arm64"
    DOCKERFILE="Dockerfile.build-sqlite3-arm64"
else
    echo "ERROR: Unknown architecture: $ARCH"
    echo "Supported: armv7, aarch64"
    exit 1
fi

docker buildx build \
    --platform "$PLATFORM" \
    --load \
    -f "$SCRIPT_DIR/$DOCKERFILE" \
    -t "audiobookshelf-sqlite3-builder:$ARCH" \
    "$SCRIPT_DIR"

# Run container to extract binary
echo ""
echo "Extracting sqlite3 binary..."
docker run --rm \
    -v "$OUTPUT_DIR:/output" \
    "audiobookshelf-sqlite3-builder:$ARCH"

# List results
echo ""
echo "=========================================="
echo "Build complete! Binaries in: $OUTPUT_DIR"
echo "=========================================="
ls -la "$OUTPUT_DIR"

# Show glibc requirement
echo ""
echo "Binary details:"
file "$OUTPUT_DIR"/*.node 2>/dev/null || echo "(no .node files found)"

echo ""
echo "Next steps:"
echo "1. Copy the .node file to node_modules/sqlite3/lib/binding/ on NAS"
echo "2. Or use build-spk.sh to package with prebuilt binary"
