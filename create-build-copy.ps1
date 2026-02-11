# Create minimal build folder for SPK packaging
# Excludes node_modules, .git, and other unnecessary files
#
# Usage: .\create-build-copy.ps1 [-Destination <path>]
# Default destination: .\build-copy
#

param(
    [string]$Destination = ".\build-copy"
)

$ErrorActionPreference = "Stop"
$SourceDir = $PSScriptRoot

Write-Host "=============================================="
Write-Host "  Create Minimal Build Copy (PowerShell)"
Write-Host "=============================================="
Write-Host ""
Write-Host "Source: $SourceDir"
Write-Host "Destination: $Destination"
Write-Host ""

# Clean destination
if (Test-Path $Destination) {
    Write-Host "Removing existing destination..."
    Remove-Item -Recurse -Force $Destination
}
New-Item -ItemType Directory -Path $Destination -Force | Out-Null

# Copy essential files
Write-Host "[1/7] Copying root files..."
Copy-Item "$SourceDir\index.js" "$Destination\"
Copy-Item "$SourceDir\package.json" "$Destination\"
Copy-Item "$SourceDir\build-spk.sh" "$Destination\"
Copy-Item "$SourceDir\build-full-vmware.sh" "$Destination\" -ErrorAction SilentlyContinue
Copy-Item "$SourceDir\create-build-copy.sh" "$Destination\" -ErrorAction SilentlyContinue
Copy-Item "$SourceDir\.env.example" "$Destination\" -ErrorAction SilentlyContinue

Write-Host "[2/7] Copying server folder..."
Copy-Item -Recurse "$SourceDir\server" "$Destination\"

Write-Host "[3/7] Copying package folder (scripts, conf, wizard)..."
Copy-Item -Recurse "$SourceDir\package" "$Destination\"

Write-Host "[4/7] Copying prebuilt binaries..."
if (Test-Path "$SourceDir\prebuilt") {
    Copy-Item -Recurse "$SourceDir\prebuilt" "$Destination\"
} else {
    Write-Host "    WARNING: No prebuilt folder found"
}

Write-Host "[5/7] Copying client/dist (built web UI)..."
if (Test-Path "$SourceDir\client\dist") {
    New-Item -ItemType Directory -Path "$Destination\client" -Force | Out-Null
    Copy-Item -Recurse "$SourceDir\client\dist" "$Destination\client\"
} else {
    Write-Host "    ERROR: client/dist not found!"
    Write-Host "    Build it first: cd client; npm install; npm run generate"
    exit 1
}

Write-Host "[6/7] Copying sonos-http-api (excluding node_modules)..."
if (Test-Path "$SourceDir\sonos-http-api") {
    New-Item -ItemType Directory -Path "$Destination\sonos-http-api" -Force | Out-Null
    Get-ChildItem "$SourceDir\sonos-http-api" -Exclude "node_modules" | Copy-Item -Destination "$Destination\sonos-http-api\" -Recurse
} else {
    Write-Host "    WARNING: sonos-http-api not found"
}

Write-Host "[7/8] Copying images (icons)..."
if (Test-Path "$SourceDir\images") {
    Copy-Item -Recurse "$SourceDir\images" "$Destination\"
}

Write-Host "[8/8] Converting shell scripts to Unix line endings (LF)..."
# Convert .sh files
Get-ChildItem -Path "$Destination" -Recurse -Include "*.sh" | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    $content = $content -replace "`r`n", "`n"
    [System.IO.File]::WriteAllText($_.FullName, $content)
}
# Convert package scripts (no extension)
if (Test-Path "$Destination\package\scripts") {
    Get-ChildItem -Path "$Destination\package\scripts" | ForEach-Object {
        $content = Get-Content $_.FullName -Raw
        $content = $content -replace "`r`n", "`n"
        [System.IO.File]::WriteAllText($_.FullName, $content)
    }
}

# Create dist folder
New-Item -ItemType Directory -Path "$Destination\dist" -Force | Out-Null

# Count files and calculate size
$FileCount = (Get-ChildItem -Recurse -File $Destination).Count
$FolderSize = "{0:N2} MB" -f ((Get-ChildItem -Recurse -File $Destination | Measure-Object -Property Length -Sum).Sum / 1MB)

Write-Host ""
Write-Host "=============================================="
Write-Host "  Build Copy Created!"
Write-Host "=============================================="
Write-Host ""
Write-Host "Location: $(Resolve-Path $Destination)"
Write-Host "Files: $FileCount"
Write-Host "Size: $FolderSize"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Copy '$Destination' to VMware Ubuntu"
Write-Host "  2. cd ~/audiobookshelf-build"
Write-Host "  3. chmod +x build-spk.sh"
Write-Host "  4. ./build-spk.sh"
Write-Host ""
