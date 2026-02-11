#!/bin/bash
#
# Create minimal build folder for SPK packaging
# Excludes node_modules, .git, and other unnecessary files
#
# Usage: ./create-build-copy.sh [destination]
# Default destination: ~/audiobookshelf-build
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="${1:-$HOME/audiobookshelf-build}"

echo "=============================================="
echo "  Create Minimal Build Copy"
echo "=============================================="
echo ""
echo "Source: $SCRIPT_DIR"
echo "Destination: $DEST"
echo ""

# Clean destination
if [ -d "$DEST" ]; then
    echo "Removing existing destination..."
    rm -rf "$DEST"
fi
mkdir -p "$DEST"

# Copy essential files
echo "[1/7] Copying root files..."
cp "$SCRIPT_DIR/index.js" "$DEST/"
cp "$SCRIPT_DIR/package.json" "$DEST/"
cp "$SCRIPT_DIR/build-spk.sh" "$DEST/"
cp "$SCRIPT_DIR/build-full-vmware.sh" "$DEST/" 2>/dev/null || true
cp "$SCRIPT_DIR/.env.example" "$DEST/" 2>/dev/null || true

echo "[2/7] Copying server folder..."
cp -r "$SCRIPT_DIR/server" "$DEST/"

echo "[3/7] Copying package folder (scripts, conf, wizard)..."
cp -r "$SCRIPT_DIR/package" "$DEST/"

echo "[4/7] Copying prebuilt binaries..."
if [ -d "$SCRIPT_DIR/prebuilt" ]; then
    cp -r "$SCRIPT_DIR/prebuilt" "$DEST/"
else
    echo "    WARNING: No prebuilt folder found"
fi

echo "[5/7] Copying client/dist (built web UI)..."
if [ -d "$SCRIPT_DIR/client/dist" ]; then
    mkdir -p "$DEST/client"
    cp -r "$SCRIPT_DIR/client/dist" "$DEST/client/"
else
    echo "    ERROR: client/dist not found!"
    echo "    Build it first: cd client && npm install && npm run generate"
    exit 1
fi

echo "[6/7] Copying sonos-http-api (excluding node_modules)..."
if [ -d "$SCRIPT_DIR/sonos-http-api" ]; then
    mkdir -p "$DEST/sonos-http-api"
    # Copy everything except node_modules
    find "$SCRIPT_DIR/sonos-http-api" -maxdepth 1 -mindepth 1 ! -name 'node_modules' -exec cp -r {} "$DEST/sonos-http-api/" \;
else
    echo "    WARNING: sonos-http-api not found"
fi

echo "[7/7] Copying images (icons)..."
if [ -d "$SCRIPT_DIR/images" ]; then
    cp -r "$SCRIPT_DIR/images" "$DEST/"
fi

# Create dist folder
mkdir -p "$DEST/dist"

# Fix line endings
echo ""
echo "Fixing line endings..."
find "$DEST" -name "*.sh" -exec sed -i 's/\r$//' {} \;
find "$DEST/package/scripts" -type f -exec sed -i 's/\r$//' {} \; 2>/dev/null || true
find "$DEST/package/conf" -type f -exec sed -i 's/\r$//' {} \; 2>/dev/null || true

# Make scripts executable
chmod +x "$DEST"/*.sh 2>/dev/null || true
chmod +x "$DEST/package/scripts"/* 2>/dev/null || true

# Count files
FILE_COUNT=$(find "$DEST" -type f | wc -l)
FOLDER_SIZE=$(du -sh "$DEST" | cut -f1)

echo ""
echo "=============================================="
echo "  Build Copy Created!"
echo "=============================================="
echo ""
echo "Location: $DEST"
echo "Files: $FILE_COUNT"
echo "Size: $FOLDER_SIZE"
echo ""
echo "Next steps:"
echo "  cd $DEST"
echo "  ./build-spk.sh"
echo ""
