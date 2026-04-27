#!/usr/bin/env bash
# Run server test suites, push the current branch, then open a PR.
# Canonical pre-PR gate — there is no pre-push hook, so intermediate
# pushes don't re-run the full suite; only this script does.
set -euo pipefail

branch=$(git rev-parse --abbrev-ref HEAD)
if [[ "$branch" == "main" ]]; then
  echo "Refusing to open a PR from main." >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree has uncommitted changes — commit, stash, or .gitignore before opening a PR." >&2
  exit 1
fi

echo "Running server test suite..."
npm -w apps/server run test:unit
npm -w apps/server run test:contract
npm -w apps/server run test:rbac
npm -w apps/server run test:integration

echo "All tests passed — pushing $branch..."
git push -u origin "$branch"

echo "Opening PR..."
gh pr create "$@"
