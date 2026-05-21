# Agent Instructions (Claude Code / Codex / other AI agents)

> **Canonical source.** This file is the canonical agent-instructions file for AXERRA. `AGENTS.md` at the repo root is a symlink to this file. Edit `CLAUDE.md` only; the symlink propagates changes to `AGENTS.md` automatically. Resolves gap 4.1.

## Verify Working Directory Before Edits

- At the start of any task referencing a project name (e.g., 'napsoft', 'axerra', 'vimber'), verify you are in the correct repository via `pwd` and `git remote -v`
- If the task references identifiers absent from the current repo, STOP and ask the user before exploring further

## Verification Before Speculation

- Before proposing theories about bugs, deployment issues, or discrepancies, run actual commands to verify (git log, branch checks, SQL queries, file reads)
- Never speculate when verification is cheap and fast

## Git & Commits

- **Never add `Co-Authored-By` lines** to commit messages — suppress the default trailer entirely
- Husky pre-commit rejects mixed commits touching both `apps/client/` and `apps/server/` — split into separate commits
- Working branch: `main`.
  - Feature branches push directly to origin with no protection.
  - Merging into `main` requires a PR with passing Lint, Architecture Check,
    and Copilot review.
  - Tests run automatically in CI on every PR to `main`, split into `test-fast` (unit + rbac, mocked) and `test-integration` (contract + integration, real Postgres + Redis service containers) jobs. There is no local pre-PR gate — push with `git push` and open the PR via `gh pr create` directly.
  - Releases: bump version on a feature branch, open PR, merge, then
    `git checkout main && git pull --ff-only origin main && git tag -a v<X.Y.Z> -m "Release v<X.Y.Z>" && git push origin v<X.Y.Z>`.

## Authorization for Destructive/Remote Actions

- Do NOT run `git push`, `gh pr create`, or open PRs without explicit user authorization
- Commits are fine when requested; pushing/PR-opening requires confirmation

## Rebrand/Rename Refactors

- For brand/identifier renames, distinguish between (a) literal string replacement and (b) replacing one brand identity with another's actual design — ask if unclear
- Watch for glued tokens after renames (e.g., `constportalUser`) and scan for them before committing
- Stay strictly within the requested file scope; do not edit adjacent files unless asked

## Project Overview

PERN monorepo for multi-tenant project costing / profitability / payments with double-entry accounting.

| Workspace           | Stack                                                     | Entry            |
| ------------------- | --------------------------------------------------------- | ---------------- |
| `apps/server`     | Express 5, pg-schemata, Passport, Redis, Winston          | `server.js`    |
| `apps/client`     | React 18, Vite, MUI 5, MUI X Data Grid v6, TanStack Query | `src/main.jsx` |
| `packages/shared` | Shared constants and utilities                            | —               |

## Key Commands

```bash
# Dev servers (from repo root)
npm run dev            # both servers
npm run dev:serv       # backend only (nodemon, 5 s delay)
npm run dev:client     # Vite HMR

# Lint
npm run lint           # ESLint 9 flat config, full monorepo

# Tests (server — Vitest, Node single-thread)
npm -w apps/server test              # all suites
npm -w apps/server run test:unit
npm -w apps/server run test:contract # supertest API tests
npm -w apps/server run test:integration
npm -w apps/server run test:rbac

# Database
npm -w apps/server run setupAdmin:dev   # bootstrap admin schema
npm -w apps/server run migrate:dev      # run migrations
npm -w apps/server run seed             # seed dev data
```

## Architecture

- **Multi-tenant**: schema-per-tenant isolation via pg-schemata; admin schema holds `tenants`, `portal_users`
- **RBAC**: 4-layer model — policies → data scope → state filters → field groups (see `docs/decisions/0013-four-layer-scoped-rbac.md`)
- **Auth**: Minimal JWT (sub + ph only) in httpOnly cookies; `authRedis` middleware hydrates `req.user` from portal_users + Redis permission cache
- **Soft delete**: `deactivated_at` column convention; most tables use pg-schemata `softDelete: true`
- **Audit fields**: `created_by`, `updated_by` (uuid, nullable), `created_at`, `updated_at`

## pg-schemata Conventions

- Schema defaults: use JS values (`default: 'active'`), NOT SQL literals (`default: "'active'"`) — pg-schemata auto-quotes for DDL but uses raw values for INSERT ColumnSet `def`
- When `userFields.type: 'uuid'`, audit fields (`created_by`/`updated_by`) must be uuid or null — never strings
- Self-referential FKs: define in schema — `createTable()` handles them natively (single atomic DDL)
- Cross-table circular FKs: remove from schema definition, add via `ALTER TABLE` in migration after both tables created
- `model.update(id, partialDto)` resets all ColumnSet columns to defaults — use raw SQL for single-column updates

## Database — Schema Changes Require Migrations

- When adding/modifying any model schema (foreign keys, columns, constraints), ALWAYS create the corresponding database migration in the same change
- Verify migration exists before declaring schema work complete

## Code Style

- Prettier: single quotes, trailing commas, 144-char lines (80 for markdown), 2-space indent
- ESLint: unused vars warn with `^_` prefix ignore, console off
- MUI X Data Grid v6: `valueGetter(params)` accesses `params.row.field` — the `(value, row)` form is v7 only
- Prefer `layoutTokens.js` for repeating layout patterns and `theme.js` component overrides over inline `sx`
- **Every `.js` file must start with a copyright header** as the first line(s), before any imports

## Environment

- `.env` lives at monorepo root; `db.js` walks up from cwd to find it
- Databases: dev → `axerra_dev`, test → `axerra_test`, user → `axe_admin`
- PG extensions: `pgcrypto`, `uuid-ossp`, `vector`
- Node ≥ 20 (`.nvmrc`)
