#!/usr/bin/env bash
# Bump all workspace package.json versions in lockstep.
#
# Usage:  bash scripts/git/bump-version.sh <version>
# Example: bash scripts/git/bump-version.sh 0.2.0
#
# Behavior:
#   1. Validates the argument looks like SemVer (e.g. 0.2.0, 0.2.0-rc.1).
#   2. Checks the current branch is `dev` and the working tree is clean.
#   3. Runs `npm version <version> --workspaces --include-workspace-root
#      --no-git-tag-version`, which updates root, apps/client, apps/server,
#      and packages/shared package.json files.
#   4. Leaves the changes unstaged for the user to review and commit.
#
# Run this on `dev` before scripts/git/release-to-main.sh. The npm version
# uses the bare number (0.2.0); the git tag in release-to-main.sh uses the
# `v` prefix (v0.2.0). Don't include `v` here — the script rejects it.
#
# Copyright (c) 2025 – present Axerra LLC. All rights reserved.

set -euo pipefail

VERSION="${1:-}"
if [[ -z "$VERSION" ]]; then
  echo "Usage: $0 <version>  (e.g. 0.2.0 — no 'v' prefix)" >&2
  exit 1
fi

if [[ "$VERSION" =~ ^v ]]; then
  echo "✗ Drop the leading 'v' — package.json versions are bare SemVer (e.g. 0.2.0)." >&2
  exit 1
fi

# SemVer-ish: <num>.<num>.<num> with optional pre-release suffix
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[A-Za-z0-9.-]+)?$ ]]; then
  echo "✗ '$VERSION' doesn't look like SemVer (e.g. 0.2.0, 0.2.0-rc.1, 1.0.0-beta.3)." >&2
  exit 1
fi

BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$BRANCH" != "dev" ]]; then
  echo "✗ Not on dev (current: $BRANCH). Version bumps land on dev before the release." >&2
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "✗ Working tree is not clean. Commit or stash changes before bumping." >&2
  exit 1
fi

echo "Bumping all workspace package.json versions to $VERSION…"
npm version "$VERSION" --workspaces --include-workspace-root --no-git-tag-version

echo
echo "✓ Bumped to $VERSION. Files changed:"
git diff --name-only
echo
echo "Review the diff, then:"
echo "  git add -A"
echo "  git commit -m 'chore: bump version to $VERSION'"
echo "  git push origin dev"
echo "  bash scripts/git/release-to-main.sh v$VERSION"
