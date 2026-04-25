#!/usr/bin/env bash
# Open and merge-commit a sync PR from main → dev, aligning dev with main
# after a release. Use after release-to-main.sh.
#
# Usage:  bash scripts/git/sync-main-to-dev.sh
#
# Behavior:
#   1. Verifies main is ahead of dev (otherwise dev is already in sync).
#   2. Opens a PR with title "chore: sync main into dev".
#   3. Merge-commits with --admin (preserves graph alignment without rewriting
#      dev's history).
#
# Copyright (c) 2025 – present Axerra LLC. All rights reserved.

set -euo pipefail

git fetch origin --quiet

if git diff --quiet origin/dev..origin/main; then
  echo "✓ dev is already up to date with main — nothing to sync."
  exit 0
fi

URL=$(gh pr create \
  --base dev --head main \
  --title "chore: sync main into dev" \
  --body "Sync PR. Merging main back into dev to align histories after a release.")
PR_NUM="${URL##*/}"
echo "Opened PR #$PR_NUM: $URL"

gh pr merge "$PR_NUM" --merge --admin --delete-branch=false
echo "✓ dev synced with main."
