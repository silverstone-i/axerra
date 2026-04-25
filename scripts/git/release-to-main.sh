#!/usr/bin/env bash
# Open and squash-merge a release PR from dev → main, then tag the release.
#
# Usage:  bash scripts/git/release-to-main.sh <version>
# Example: bash scripts/git/release-to-main.sh v0.2.0
#
# Behavior:
#   1. Verifies dev is ahead of main (otherwise nothing to release).
#   2. Opens a PR with title "Release <version>".
#   3. Squash-merges with --admin (bypasses required reviews; CI must still pass
#      unless --admin also overrides it, which it does for branch ruleset checks).
#   4. Fetches the new main tip and creates an annotated tag <version> on it.
#   5. Pushes the tag.
#
# Copyright (c) 2025 – present Axerra LLC. All rights reserved.

set -euo pipefail

VERSION="${1:-}"
if [[ -z "$VERSION" ]]; then
  echo "Usage: $0 <version>  (e.g. v0.2.0)" >&2
  exit 1
fi

git fetch origin --quiet

if git diff --quiet origin/main..origin/dev; then
  echo "✓ main is already up to date with dev — nothing to release."
  exit 0
fi

echo "About to release $VERSION (squash-merge dev → main)."
read -r -p "Continue? [y/N] " REPLY
[[ $REPLY =~ ^[Yy]$ ]] || { echo "Aborted."; exit 1; }

URL=$(gh pr create \
  --base main --head dev \
  --title "Release $VERSION" \
  --body "Release PR. Squash-merging dev into main as $VERSION.")
PR_NUM="${URL##*/}"
echo "Opened PR #$PR_NUM: $URL"

gh pr merge "$PR_NUM" --squash --admin --delete-branch=false
echo "Squash-merged."

git fetch origin --quiet
TIP=$(git rev-parse origin/main)
git tag -a "$VERSION" "$TIP" -m "Release $VERSION"
git push origin "$VERSION"
echo "✓ Released $VERSION (tag pushed)."
echo
echo "Run scripts/git/sync-main-to-dev.sh next to align dev with main."
