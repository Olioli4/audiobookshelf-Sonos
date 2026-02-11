#!/bin/bash
#
# Build script for Audiobookshelf DSM 7 package (.spk)
#
# Usage: ./build-spk.sh
#
# Requirements:
# - Linux/macOS with bash
# - tar, gzip
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="${SCRIPT_DIR}/build"
PACKAGE_DIR="${SCRIPT_DIR}/package"
OUTPUT_DIR="${SCRIPT_DIR}/dist"

PACKAGE_NAME="audiobookshelf"
VERSION="2.0.0"
ARCH="noarch"

echo "========================================"
echo "  Building Audiobookshelf DSM 7 Package"
echo "========================================"
echo ""

# Clean previous build
echo "[1/6] Cleaning previous build..."
rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}"
mkdir -p "${OUTPUT_DIR}"

# Create package.tgz (the actual application)
echo "[2/6] Creating package.tgz..."
PACKAGE_TGZ_DIR="${BUILD_DIR}/package_content"
mkdir -p "${PACKAGE_TGZ_DIR}"

# Copy application files
cp "${SCRIPT_DIR}/index.js" "${PACKAGE_TGZ_DIR}/"
cp "${SCRIPT_DIR}/package.json" "${PACKAGE_TGZ_DIR}/"

# Copy server folder (synced with upstream master, using SQLite)
echo "    Copying server folder..."
cp -r "${SCRIPT_DIR}/server" "${PACKAGE_TGZ_DIR}/"
# Optional: copy .env.example if it exists
[ -f "${SCRIPT_DIR}/.env.example" ] && cp "${SCRIPT_DIR}/.env.example" "${PACKAGE_TGZ_DIR}/"

# NOTE: Do NOT run npm install here - native modules (sqlite3) must be compiled on ARM
# The postinst script runs npm install on the NAS

# Copy client dist (web UI) - ONLY the built dist folder, not sources
if [ -d "${SCRIPT_DIR}/client/dist" ]; then
    echo "    Including client/dist (web UI)..."
    mkdir -p "${PACKAGE_TGZ_DIR}/client"
    cp -r "${SCRIPT_DIR}/client/dist" "${PACKAGE_TGZ_DIR}/client/"
else
    echo "    ERROR: client/dist not found!"
    echo "    Build it first: cd client && npm install && npm run generate"
    exit 1
fi

# Copy bundled sonos-http-api (without node_modules - will be installed on NAS)
if [ -d "${SCRIPT_DIR}/sonos-http-api" ]; then
    echo "    Including sonos-http-api (excluding node_modules)..."
    mkdir -p "${PACKAGE_TGZ_DIR}/sonos-http-api"
    # Copy everything except node_modules
    find "${SCRIPT_DIR}/sonos-http-api" -maxdepth 1 -mindepth 1 ! -name 'node_modules' -exec cp -r {} "${PACKAGE_TGZ_DIR}/sonos-http-api/" \;
else
    echo "    WARNING: sonos-http-api not found - Sonos integration will not be available"
fi

# Copy prebuilt sqlite3 binaries for ARM
if [ -d "${SCRIPT_DIR}/prebuilt" ] && [ "$(ls -A ${SCRIPT_DIR}/prebuilt/*.node 2>/dev/null)" ]; then
    echo "    Including prebuilt sqlite3 binaries..."
    mkdir -p "${PACKAGE_TGZ_DIR}/prebuilt"
    cp "${SCRIPT_DIR}/prebuilt/"*.node "${PACKAGE_TGZ_DIR}/prebuilt/"
else
    echo "    WARNING: No prebuilt sqlite3 binaries found in prebuilt/"
    echo "    Run ./build-sqlite3.sh first to build ARM binaries"
fi

# Create package.tgz
cd "${PACKAGE_TGZ_DIR}"
tar -czf "${BUILD_DIR}/package.tgz" .
cd "${SCRIPT_DIR}"

# Copy scripts folder (NOT as tar, as folder!)
echo "[3/6] Copying scripts folder..."
mkdir -p "${BUILD_DIR}/scripts"
cp "${PACKAGE_DIR}/scripts/"* "${BUILD_DIR}/scripts/"
chmod +x "${BUILD_DIR}/scripts/"*

# Convert CRLF to LF (critical for NAS execution)
echo "    Converting line endings to Unix format..."
for script in "${BUILD_DIR}/scripts/"*; do
    sed -i 's/\r$//' "$script"
done

# Copy conf folder (NOT as tar, as folder!)
echo "[4/6] Copying conf folder..."
mkdir -p "${BUILD_DIR}/conf"
cp "${PACKAGE_DIR}/conf/"* "${BUILD_DIR}/conf/"

# Convert CRLF to LF for conf files
for conf in "${BUILD_DIR}/conf/"*; do
    sed -i 's/\r$//' "$conf"
done

# Copy WIZARD_UIFILES (installation wizard for DB config)
echo "[5/6] Copying wizard files..."
mkdir -p "${BUILD_DIR}/WIZARD_UIFILES"
cp "${PACKAGE_DIR}/WIZARD_UIFILES/"*.json "${BUILD_DIR}/WIZARD_UIFILES/"

# Convert CRLF to LF for wizard files
for wizard in "${BUILD_DIR}/WIZARD_UIFILES/"*; do
    sed -i 's/\r$//' "$wizard"
done

# Copy INFO file
echo "[6/7] Copying package info..."
cp "${PACKAGE_DIR}/INFO" "${BUILD_DIR}/"
sed -i 's/\r$//' "${BUILD_DIR}/INFO"

# Copy icons if they exist (optional for DSM 7)
echo "[7/7] Checking for package icons..."
if [ -f "${SCRIPT_DIR}/images/PACKAGE_ICON.PNG" ]; then
    cp "${SCRIPT_DIR}/images/PACKAGE_ICON.PNG" "${BUILD_DIR}/"
fi
if [ -f "${SCRIPT_DIR}/images/PACKAGE_ICON_256.PNG" ]; then
    cp "${SCRIPT_DIR}/images/PACKAGE_ICON_256.PNG" "${BUILD_DIR}/"
fi

# Build the final .spk file
echo ""
echo "Building final .spk package..."
SPK_FILE="${OUTPUT_DIR}/${PACKAGE_NAME}-${VERSION}-${ARCH}.spk"

cd "${BUILD_DIR}"

# SPK is a tar containing: INFO, package.tgz, scripts/, conf/, WIZARD_UIFILES/
# Icons are optional
# Use plain tar with root ownership (same as official spksrc)
TAR_FILES="INFO package.tgz scripts conf WIZARD_UIFILES"
[ -f PACKAGE_ICON.PNG ] && TAR_FILES="$TAR_FILES PACKAGE_ICON.PNG"
[ -f PACKAGE_ICON_256.PNG ] && TAR_FILES="$TAR_FILES PACKAGE_ICON_256.PNG"
tar -cpf "${SPK_FILE}" --owner=root --group=root $TAR_FILES

echo ""
echo "========================================"
echo "  Build Complete!"
echo "========================================"
echo ""
echo "Package: ${SPK_FILE}"
echo ""
echo "To install:"
echo "1. Open DSM Package Center"
echo "2. Click 'Manual Install'"
echo "3. Select the .spk file"
echo ""
