# Sync fork with upstream audiobookshelf master
#
# Usage: .\sync-upstream.ps1
#
# This script fetches the latest changes from upstream/master
# and merges them into your local branches.
#

$ErrorActionPreference = "Stop"

Write-Host "=============================================="
Write-Host "  Sync with Upstream Audiobookshelf"
Write-Host "=============================================="
Write-Host ""

# Check for uncommitted changes
$status = git status --porcelain
if ($status) {
    Write-Host "ERROR: You have uncommitted changes!" -ForegroundColor Red
    Write-Host "Please commit or stash them first."
    git status --short
    exit 1
}

$currentBranch = git branch --show-current
Write-Host "Current branch: $currentBranch"
Write-Host ""

# Fetch upstream
Write-Host "[1/4] Fetching upstream..."
git fetch upstream

# Check how many commits behind
$behind = git rev-list --count master..upstream/master
Write-Host "      Master is $behind commits behind upstream/master"
Write-Host ""

if ($behind -eq 0) {
    Write-Host "Already up to date with upstream!" -ForegroundColor Green
    exit 0
}

# Update master
Write-Host "[2/4] Updating master branch..."
git checkout master
git merge upstream/master --no-edit
Write-Host ""

# Update sonos branch (if exists)
$sonosExists = git show-ref --verify --quiet refs/heads/sonos 2>$null; $?
if ($sonosExists) {
    Write-Host "[3/4] Rebasing sonos branch..."
    git checkout sonos
    git rebase master
    Write-Host ""
} else {
    Write-Host "[3/4] Skipping sonos branch (not found)"
}

# Update arm-synology branch (if exists)
$armExists = git show-ref --verify --quiet refs/heads/arm-synology 2>$null; $?
if ($armExists) {
    Write-Host "[4/4] Rebasing arm-synology branch..."
    git checkout arm-synology
    git rebase master
    Write-Host ""
} else {
    Write-Host "[4/4] Skipping arm-synology branch (not found)"
}

# Return to original branch
git checkout $currentBranch

Write-Host ""
Write-Host "=============================================="
Write-Host "  Sync Complete!" -ForegroundColor Green
Write-Host "=============================================="
Write-Host ""
Write-Host "Merged $behind commits from upstream/master"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Rebuild client: cd client; npm run generate"
Write-Host "  2. Build SPK: ./build-spk.sh (in Linux)"
Write-Host "  3. Push changes: git push origin --all"
Write-Host ""
