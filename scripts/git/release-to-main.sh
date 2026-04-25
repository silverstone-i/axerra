#!/usr/bin/env bash
# Open and squash-merge a release PR from dev → main, then tag the release.
#
# Usage:  bash scripts/git/release-to-main.sh <version>
# Example: bash scripts/git/release-to-main.sh v0.2.0
#
# Behavior:
#   1. Verifies dev is ahead of main (otherwise nothing to release).
#   2. Opens a PR with title "Release <version>".
#   3. Squash-merges with --admin (bypasses required reviews; whether CI/status
#      checks must pass depends on the branch ruleset configuration).
#   4. Fetches the new main tip and creates an annotated tag <version> on it.
#   5. Pushes the tag.
#
# Recovers from a partial previous run: if the version tag exists locally
# but not on origin (merge succeeded, tag push failed), pushes the tag and
# exits. If the tag is on origin already, exits as a no-op.
#
# Copyright (c) 2025 – present Axerra LLC. All rights reserved.

set -euo pipefail

VERSION="${1:-}"
if [[ -z "$VERSION" ]]; then
  echo "Usage: $0 <version>  (e.g. v0.2.0)" >&2
  exit 1
fi

git fetch origin --quiet --tags

# Recover from a previous partial run before deciding whether to release.
LOCAL_TAG=$(git tag -l "$VERSION")
REMOTE_TAG=$(git ls-remote --tags origin "refs/tags/$VERSION" 2>/dev/null | head -n 1)

if [[ -n "$REMOTE_TAG" ]]; then
  echo "✓ Tag $VERSION already exists on origin — nothing to release."
  exit 0
fi

if [[ -n "$LOCAL_TAG" ]]; then
  # Verify the local tag points at origin/main before publishing it.
  # A stray local tag (manually created, or from a different release attempt)
  # should not be pushed without explicit human review.
  TAG_COMMIT=$(git rev-parse "$VERSION^{commit}")
  MAIN_TIP=$(git rev-parse origin/main)
  if [[ "$TAG_COMMIT" != "$MAIN_TIP" ]]; then
    echo "✗ Local tag $VERSION points at $TAG_COMMIT," >&2
    echo "  but origin/main is at $MAIN_TIP." >&2
    echo "  Refusing to push a tag that doesn't match the expected release tip." >&2
    echo "  Investigate manually (e.g. \`git log $VERSION\`, \`git log origin/main\`)" >&2
    echo "  and either delete the local tag or move it before retrying." >&2
    exit 1
  fi
  echo "Tag $VERSION exists locally and matches origin/main. Pushing tag…"
  git push origin "$VERSION"
  echo "✓ Tag $VERSION pushed."
  exit 0
fi

if git diff --quiet origin/main..origin/dev; then
  echo "✗ main and dev are already in sync, but tag $VERSION doesn't exist." >&2
  echo "  Either a previous run merged but failed to tag (recover with:" >&2
  echo "    git tag -a $VERSION origin/main -m 'Release $VERSION' && git push origin $VERSION" >&2
  echo "  ) or there's nothing to release." >&2
  exit 1
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
