#!/bin/bash
#
# Sync fork with upstream audiobookshelf master
#
# Usage: ./sync-upstream.sh
#
# This script fetches the latest changes from upstream/master
# and merges them into your local branches.
#

set -e

echo "=============================================="
echo "  Sync with Upstream Audiobookshelf"
echo "=============================================="
echo ""

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "ERROR: You have uncommitted changes!"
    echo "Please commit or stash them first."
    git status --short
    exit 1
fi

CURRENT_BRANCH=$(git branch --show-current)
echo "Current branch: $CURRENT_BRANCH"
echo ""

# Fetch upstream
echo "[1/4] Fetching upstream..."
git fetch upstream

# Check how many commits behind
BEHIND=$(git rev-list --count master..upstream/master)
echo "      Master is $BEHIND commits behind upstream/master"
echo ""

if [ "$BEHIND" -eq 0 ]; then
    echo "Already up to date with upstream!"
    exit 0
fi

# Update master
echo "[2/4] Updating master branch..."
git checkout master
git merge upstream/master --no-edit
echo ""

# Update sonos branch (if exists)
if git show-ref --verify --quiet refs/heads/sonos; then
    echo "[3/4] Rebasing sonos branch..."
    git checkout sonos
    git rebase master
    echo ""
else
    echo "[3/4] Skipping sonos branch (not found)"
fi

# Update arm-synology branch (if exists)
if git show-ref --verify --quiet refs/heads/arm-synology; then
    echo "[4/4] Rebasing arm-synology branch..."
    git checkout arm-synology
    git rebase master
    echo ""
else
    echo "[4/4] Skipping arm-synology branch (not found)"
fi

# Return to original branch
git checkout "$CURRENT_BRANCH"

echo ""
echo "=============================================="
echo "  Sync Complete!"
echo "=============================================="
echo ""
echo "Merged $BEHIND commits from upstream/master"
echo ""
echo "Next steps:"
echo "  1. Rebuild client: cd client && npm run generate"
echo "  2. Build SPK: ./build-spk.sh"
echo "  3. Push changes: git push origin --all"
echo ""
