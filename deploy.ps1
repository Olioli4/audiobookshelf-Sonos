# Deploy script for audiobookshelf to Synology NAS
# Usage: .\deploy.ps1 [-server] [-client] [-all]

param(
    [switch]$server,
    [switch]$client,
    [switch]$all,
    [string]$nasHost = "192.168.0.115",
    [string]$nasUser = "admin",
    [string]$nasPath = "/volume2/@appstore/audiobookshelf"
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# If no flags specified, default to server only
if (-not $server -and -not $client -and -not $all) {
    $server = $true
}

if ($all) {
    $server = $true
    $client = $true
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Audiobookshelf NAS Deploy Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "NAS: $nasUser@$nasHost" -ForegroundColor Yellow
Write-Host "Path: $nasPath" -ForegroundColor Yellow
Write-Host ""

# Function to run SSH command
function Invoke-NasCommand {
    param([string]$command)
    Write-Host "  > $command" -ForegroundColor Gray
    # Prepend sudo for package commands
    if ($command -match "synopkg") {
        $command = "sudo $command"
    }
    ssh "${nasUser}@${nasHost}" $command
    if ($LASTEXITCODE -ne 0) {
        Write-Host "SSH command failed!" -ForegroundColor Red
        return $false
    }
    return $true
}

# Function to copy files using tar over SSH (workaround for SCP subsystem issues)
function Copy-ToNas {
    param(
        [string]$localPath,
        [string]$remotePath
    )
    
    # Always use forward slashes for NAS paths
    $remotePath = $remotePath -replace '\\', '/'
    Write-Host "  Copying: $localPath -> $remotePath" -ForegroundColor Gray
    
    # Create a tar stream and extract on remote
    $parentDir = Split-Path -Parent $localPath
    $folderName = Split-Path -Leaf $localPath
    $remoteParent = (Split-Path -Parent $remotePath) -replace '\\', '/'
    
    Push-Location $parentDir
    try {
        # Use tar to stream files over SSH
        tar -cf - $folderName | ssh "${nasUser}@${nasHost}" "cd '$remoteParent' && rm -rf '$folderName' && tar -xf -"
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  Failed to copy $folderName" -ForegroundColor Red
            return $false
        }
    }
    finally {
        Pop-Location
    }
    return $true
}

# Function to copy a single file
function Copy-FileToNas {
    param(
        [string]$localFile,
        [string]$remoteFile
    )
    
    Write-Host "  Copying: $localFile" -ForegroundColor Gray
    
    # Read file and pipe through SSH
    Get-Content -Raw -Path $localFile | ssh "${nasUser}@${nasHost}" "cat > `"$remoteFile`""
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  Failed to copy file" -ForegroundColor Red
        return $false
    }
    return $true
}

try {
    # Step 1: Stop the app
    Write-Host "`n[1/4] Stopping audiobookshelf..." -ForegroundColor Green
    Invoke-NasCommand "synopkg stop audiobookshelf" | Out-Null
    Start-Sleep -Seconds 2

    # Step 2: Upload server files
    if ($server) {
        Write-Host "`n[2/4] Uploading server files..." -ForegroundColor Green
        
        # Copy entire server folder using tar
        if (-not (Copy-ToNas "$scriptDir/server" "$nasPath/server")) {
            throw "Failed to copy server folder"
        }
        
        # Copy root files
        $rootFiles = @("index.js", "package.json")
        foreach ($file in $rootFiles) {
            $localFile = Join-Path $scriptDir $file
            if (Test-Path $localFile) {
                Copy-FileToNas $localFile "$nasPath/$file" | Out-Null
            }
        }
    }
    else {
        Write-Host "`n[2/4] Skipping server files" -ForegroundColor Yellow
    }

    # Step 3: Upload client files
    if ($client) {
        Write-Host "`n[3/4] Uploading client files..." -ForegroundColor Green
        
        # Copy client/dist folder
        if (-not (Copy-ToNas "$scriptDir/client/dist" "$nasPath/client/dist")) {
            throw "Failed to copy client folder"
        }
    }
    else {
        Write-Host "`n[3/4] Skipping client files" -ForegroundColor Yellow
    }

    # Step 4: Start the app
    Write-Host "`n[4/4] Starting audiobookshelf..." -ForegroundColor Green
    Invoke-NasCommand "synopkg start audiobookshelf" | Out-Null
    Start-Sleep -Seconds 3

    # Check status
    Write-Host "`n[Done] Checking status..." -ForegroundColor Green
    Invoke-NasCommand "synopkg status audiobookshelf"

    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "  Deployment Complete!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "View logs: ssh $nasUser@$nasHost 'tail -f /var/packages/audiobookshelf/var/logs/audiobookshelf.log'" -ForegroundColor Gray
}
catch {
    Write-Host "`nDeployment failed: $_" -ForegroundColor Red
    # Try to start the app anyway
    Write-Host "Attempting to restart audiobookshelf..." -ForegroundColor Yellow
    Invoke-NasCommand "synopkg start audiobookshelf" | Out-Null
    exit 1
}
