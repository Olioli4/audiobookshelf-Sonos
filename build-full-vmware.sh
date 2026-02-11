#!/bin/bash
#
# Full SPK Build Script for VMware Ubuntu
# Builds client + creates SPK package for ARM Synology NAS
#
# Usage:
#   1. Copy project to VMware Ubuntu (NOT WSL on NTFS)
#   2. chmod +x build-full-vmware.sh
#   3. ./build-full-vmware.sh
#
# Requirements:
# - VMware Ubuntu (NOT WSL on NTFS - causes line ending issues)
# - Node.js 18+ with npm
# - tar, gzip
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERSION="2.0.0"

echo "=============================================="
echo "  Audiobookshelf-Sonos Full Build (VMware)"
echo "  Version: ${VERSION}"
echo "=============================================="
echo ""

# Check if running on native Linux (not WSL with NTFS mount)
check_environment() {
    echo "[0/4] Checking build environment..."

    # Check for WSL on NTFS (causes issues)
    if [ -n "$WSL_DISTRO_NAME" ]; then
        MOUNT_POINT=$(df "$SCRIPT_DIR" --output=fstype | tail -n1)
        if [ "$MOUNT_POINT" = "9p" ] || [ "$MOUNT_POINT" = "drvfs" ]; then
            echo ""
            echo "WARNING: Running on WSL with NTFS mount!"
            echo "This may cause line ending issues in the SPK package."
            echo ""
            echo "Recommended: Copy project to native Linux filesystem:"
            echo "  cp -r \"$SCRIPT_DIR\" ~/audiobookshelf-Sonos"
            echo "  cd ~/audiobookshelf-Sonos"
            echo "  ./build-full-vmware.sh"
            echo ""
            read -p "Continue anyway? (y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                exit 1
            fi
        fi
    fi

    # Check for Node.js
    if ! command -v node &> /dev/null; then
        echo "ERROR: Node.js not found!"
        echo ""
        echo "Install Node.js 18:"
        echo "  curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -"
        echo "  sudo apt-get install -y nodejs"
        exit 1
    fi

    NODE_VERSION=$(node -v)
    echo "    Node.js: ${NODE_VERSION}"

    # Check for npm
    if ! command -v npm &> /dev/null; then
        echo "ERROR: npm not found!"
        exit 1
    fi

    NPM_VERSION=$(npm -v)
    echo "    npm: v${NPM_VERSION}"
    echo ""
}

# Fix line endings for all scripts
fix_line_endings() {
    echo "[1/4] Fixing line endings (CRLF -> LF)..."

    # Fix build scripts
    for script in "$SCRIPT_DIR"/*.sh; do
        if [ -f "$script" ]; then
            sed -i 's/\r$//' "$script"
        fi
    done

    # Fix package scripts
    if [ -d "$SCRIPT_DIR/package/scripts" ]; then
        for script in "$SCRIPT_DIR/package/scripts"/*; do
            if [ -f "$script" ]; then
                sed -i 's/\r$//' "$script"
            fi
        done
    fi

    echo "    Line endings fixed"
    echo ""
}

# Build client
build_client() {
    echo "[2/4] Building client (Nuxt.js)..."

    cd "${SCRIPT_DIR}/client"

    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        echo "    Installing client dependencies..."
        npm install
    fi

    # Set base path to root (empty = no prefix)
    export ROUTER_BASE_PATH=""
    
    # Run nuxt generate
    echo "    Running nuxt generate (ROUTER_BASE_PATH='')..."
    npm run generate

    # Verify dist was created
    if [ ! -d "${SCRIPT_DIR}/client/dist" ]; then
        echo "ERROR: Client build failed - dist folder not created!"
        exit 1
    fi

    DIST_SIZE=$(du -sh "${SCRIPT_DIR}/client/dist" | cut -f1)
    echo "    Client built successfully (${DIST_SIZE})"
    echo ""

    cd "${SCRIPT_DIR}"
}

# Check prebuilt binaries
check_prebuilt() {
    echo "[3/4] Checking prebuilt ARM binaries..."

    if [ -f "${SCRIPT_DIR}/prebuilt/node_sqlite3.node" ]; then
        SQLITE_SIZE=$(ls -lh "${SCRIPT_DIR}/prebuilt/node_sqlite3.node" | awk '{print $5}')
        SQLITE_ARCH=$(file "${SCRIPT_DIR}/prebuilt/node_sqlite3.node" | grep -o "ARM\|x86-64\|x86_64" || echo "unknown")
        echo "    sqlite3 binary: ${SQLITE_SIZE} (${SQLITE_ARCH})"

        if [[ "$SQLITE_ARCH" != "ARM" ]]; then
            echo ""
            echo "WARNING: Prebuilt binary may not be ARM architecture!"
            echo "Expected: ARM, Found: ${SQLITE_ARCH}"
            echo "Run ./build-sqlite3.sh to build ARM binary"
            echo ""
        fi
    else
        echo "WARNING: No prebuilt sqlite3 binary found!"
        echo "Run ./build-sqlite3.sh first to build ARM binaries"
        echo ""
    fi
}

# Build SPK package
build_spk() {
    echo "[4/4] Building SPK package..."
    echo ""

    # Run the existing build-spk.sh
    chmod +x "${SCRIPT_DIR}/build-spk.sh"
    "${SCRIPT_DIR}/build-spk.sh"
}

# Main execution
main() {
    check_environment
    fix_line_endings
    build_client
    check_prebuilt
    build_spk

    echo ""
    echo "=============================================="
    echo "  Build Complete!"
    echo "=============================================="
    echo ""
    echo "Output: dist/audiobookshelf-${VERSION}-noarch.spk"
    echo ""
    echo "Contents:"
    echo "  - Audiobookshelf server (SQLite)"
    echo "  - Web client (Nuxt.js)"
    echo "  - Sonos integration + sonos-http-api"
    echo "  - Prebuilt ARM sqlite3 binary"
    echo ""
    echo "To install on Synology NAS:"
    echo "  1. Open DSM Package Center"
    echo "  2. Click 'Manual Install'"
    echo "  3. Browse to dist/*.spk"
    echo "  4. Follow the wizard"
    echo ""
}

main "$@"
