# Git Workflow

Branch protection on both `main` and `dev` requires PRs to land any change. This
keeps a structured review surface (CI checks, Copilot review on `dev`) for
feature work. The two `dev↔main` sync flows are scripted as one-liners so the
PR ceremony stays out of the way for routine maintenance.

## TL;DR

| Flow | Command |
|---|---|
| Feature branch → `dev` | `gh pr create --base dev --head feature/foo` → review → merge in UI |
| `dev` → `main` (release) | `bash scripts/git/release-to-main.sh v0.2.0` |
| `main` → `dev` (sync) | `bash scripts/git/sync-main-to-dev.sh` |

## Branch protection (what's enforced)

Both `main` and `dev` enforce:

- **Pull request required** — no direct pushes
- **Required status checks** — `Lint`, `Architecture Check` must pass
- **Force-push blocked** (`non_fast_forward`)
- **Branch deletion blocked**

`dev` additionally enforces **Copilot code review** on every PR.

The helper scripts use `gh pr merge --admin` to bypass the required-review gate
for `dev↔main` sync PRs, since those are mechanical and have no reviewer.

## 1. Feature branch → dev

Standard PR flow. No script — `gh pr create` is one line and you usually want to
read Copilot's review before merging.

```bash
# Branch off the latest dev
git checkout dev && git pull
git checkout -b feature/your-feature

# Develop. Husky pre-commit rejects mixed commits touching both
# apps/client/ and apps/server/ — split into separate commits.
git add ...
git commit -m "..."

# Push and open a PR
git push -u origin feature/your-feature
gh pr create --base dev --head feature/your-feature \
  --title "feat: ..." \
  --body "..."

# Wait for CI (Lint + Architecture Check) and Copilot review.
# Address any feedback, push more commits to the branch.

# Merge in the GitHub UI (or `gh pr merge --squash`), then clean up:
git checkout dev && git pull
git branch -d feature/your-feature
git push origin --delete feature/your-feature
```

## 2. dev → main (release) — `--ff-only` equivalent

For releases, use `scripts/git/release-to-main.sh`. The script squash-merges all
of `dev`'s changes into a single commit on `main`, keeping `main`'s log clean as
a release ledger, and creates+pushes the version tag.

```bash
bash scripts/git/release-to-main.sh v0.2.0
```

The script:

1. Aborts if `dev` and `main` are already in sync (nothing to release).
2. Asks for confirmation.
3. Opens a PR `dev → main` titled `Release v0.2.0`.
4. Squash-merges with `--admin` (bypasses required reviews).
5. Tags `origin/main`'s new tip as `v0.2.0` and pushes the tag.

> **Why squash, not `--ff-only` literal?** GitHub PR merges can't do strict
> fast-forward via the API. Squash is the closest equivalent for a release: one
> commit on `main` representing the release, no merge-commit noise. After the
> squash, run the sync script (next section) to align `dev` with the new `main`.

## 3. main → dev (sync) — post-release alignment

After a squash release, `main` has a new commit (the squash) that's not on
`dev`'s history. Run the sync script to bring `dev` up to date so the histories
align in tools like Git Graph.

```bash
bash scripts/git/sync-main-to-dev.sh
```

The script:

1. Aborts if `main` is already an ancestor of `dev` (history check, not tree
   check — after a squash release, trees match but histories don't, and that
   gap is exactly what this script exists to bridge).
2. Opens a PR `main → dev` titled `chore: sync main into dev`.
3. Merge-commits (not squash) with `--admin`. The merge commit ties the histories
   together — `main`'s commit becomes reachable from `dev`'s tip.

> **Why a merge commit, not `--ff-only`?** `dev` has commits `main` doesn't have
> any more (the original feature commits, before the release squash). A
> merge commit is the only way to bridge them without rewriting either side's
> SHAs.

## 4. Helper scripts — reference

Both scripts live in `scripts/git/`. Run from the repo root.

### `release-to-main.sh <version>`

Squash-merges `dev` into `main` and tags the result.

- **Input:** `<version>` — the tag name (e.g. `v0.2.0`).
- **Side effects:** opens a PR, merges it, pushes a tag. All on `origin`.
- **Skips early when there's nothing to do** — exits as a no-op if the version
  tag already exists on `origin`. If the tag exists locally but not on `origin`
  (recovery from a previous run that merged but failed to push the tag), the
  script pushes the tag and exits.
- **Failure modes / rerun caveats:**
  - `gh` not authenticated.
  - An open PR with the same `dev → main` head/base from a prior run will block
    `gh pr create` — close or merge that PR before rerunning.
  - CI failing on the PR — `--admin` bypasses required reviews, but whether it
    bypasses required status checks depends on the branch ruleset configuration.
  - If `main` and `dev` are in sync but the tag doesn't exist anywhere, the
    script exits non-zero and prints recovery instructions rather than guessing.

### `sync-main-to-dev.sh`

Merge-commits `main` into `dev` after a release.

- **Input:** none.
- **Side effects:** opens a PR, merges it. All on `origin`.
- **Skips early when there's nothing to do** — uses
  `git merge-base --is-ancestor origin/main origin/dev` to detect that `main`'s
  history is already reachable from `dev`. Tree equality alone isn't a reliable
  signal post-squash.
- **Failure modes / rerun caveats:** an open PR with the same `main → dev`
  head/base from a prior run will block `gh pr create` — close or merge that PR
  before rerunning.

## Releasing — full sequence

```bash
# 1. Make sure dev is green
git checkout dev && git pull

# 2. Cut the release
bash scripts/git/release-to-main.sh v0.2.0

# 3. Sync dev with main
bash scripts/git/sync-main-to-dev.sh

# 4. Pull the merged state locally
git checkout main && git pull
git checkout dev && git pull
```
