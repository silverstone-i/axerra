# Git Workflow

Branch protection on both `main` and `dev` requires PRs to land any change. This
keeps a structured review surface (CI checks, Copilot review on `dev`) for
feature work. The two `dev↔main` sync flows are scripted as one-liners so the
PR ceremony stays out of the way for routine maintenance.

## TL;DR

| Flow | Command |
|---|---|
| Feature branch → `dev` | `gh pr create --base dev --head feature/foo` → review → merge in UI |
| Bump version (on `dev`, before release) | `bash scripts/git/bump-version.sh 0.2.0` |
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

## 2. Bump version (on `dev`, before the release)

The release script tags `main` but does **not** bump `package.json` versions —
those have to be updated separately on `dev` so the squash captures them. Use
`scripts/git/bump-version.sh`:

```bash
bash scripts/git/bump-version.sh 0.2.0   # no 'v' prefix — npm versions are bare SemVer
git add -A
git commit -m "chore: bump version to 0.2.0"
git push origin dev
```

The script:

1. Validates the argument looks like SemVer (e.g. `0.2.0`, `0.2.0-rc.1`).
2. Refuses to run unless you're on `dev` with a clean working tree.
3. Runs `npm version <version> --workspaces --include-workspace-root --no-git-tag-version`,
   updating `package.json` in the repo root, `apps/client`, `apps/server`, and `packages/shared`.
4. Leaves the changes unstaged for you to review and commit.

### Choosing the bump

Use SemVer (https://semver.org). For axerra at v0.x:

| Bump | Example | When |
|---|---|---|
| Patch | `0.1.1` | Bug fixes only, no behavior change |
| Minor | `0.2.0` | New features, backward-compatible |
| Pre-release | `0.2.0-rc.1`, `0.2.0-beta.1` | Not yet final |
| Major | `1.0.0` | Breaking changes — typically reserved for the first stable release |

> **Format note.** The bump script takes the bare SemVer (`0.2.0`); the release
> script takes the `v`-prefixed git-tag form (`v0.2.0`). Same number, different
> conventions: `package.json` is bare, git tags are conventionally prefixed.

## 3. dev → main (release) — `--ff-only` equivalent

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

## 4. main → dev (sync) — post-release alignment

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

## 5. Helper scripts — reference

All scripts live in `scripts/git/`. Run from the repo root.

### `bump-version.sh <version>`

Bumps all workspace `package.json` versions in lockstep before a release.

- **Input:** `<version>` — bare SemVer (e.g. `0.2.0`, `0.2.0-rc.1`). No `v` prefix.
- **Side effects:** modifies `package.json` in repo root, `apps/client`, `apps/server`,
  and `packages/shared`. Leaves changes unstaged for review.
- **Guards:** must be on `dev` with a clean working tree; rejects bare `v…`
  arguments and non-SemVer strings.
- **Does not commit, push, tag, or open a PR** — that's intentional. Review the
  diff, then commit and push manually before running `release-to-main.sh`.

### `release-to-main.sh <version>`

Squash-merges `dev` into `main` and tags the result.

- **Input:** `<version>` — the tag name with `v` prefix (e.g. `v0.2.0`).
- **Side effects:** opens a PR, merges it, pushes a tag. All on `origin`.
- **Skips early when there's nothing to do** — exits as a no-op if the version
  tag already exists on `origin`. If the tag exists locally but not on `origin`
  (recovery from a previous run that merged but failed to push the tag), the
  script verifies the local tag points at `origin/main` and pushes it; on a SHA
  mismatch it aborts rather than publishing a stray tag.
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

# 2. Bump workspace package.json versions on dev
bash scripts/git/bump-version.sh 0.2.0
git add -A && git commit -m "chore: bump version to 0.2.0"
git push origin dev

# 3. Cut the release (note the v prefix)
bash scripts/git/release-to-main.sh v0.2.0

# 4. Sync dev with main
bash scripts/git/sync-main-to-dev.sh

# 5. Pull the merged state locally
git checkout main && git pull
git checkout dev && git pull
```
