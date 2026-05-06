# SRH Schema Rebuild & Restore Workflow

## Goal

Automate a full database rebuild that:

1. Backs up the `srh` schema and its `admin.portal_users` entries
2. Drops all schemas and rebuilds the database from scratch
3. Re-provisions the SRH tenant with fresh seed data (RBAC, policy catalog, numbering)
4. Restores business data from the backup
5. Preserves user passwords

## Why rebuild from scratch?

A full rebuild remains the cleanest way to validate that admin schema,
migrations, and seed data all line up with the current codebase end-to-end.

For routine `policy_catalog` drift (new entries, label/description tweaks,
`valid_statuses` or `available_fields` updates), a full rebuild is no longer
required: run the reconciler instead.

```bash
cross-env NODE_ENV=development node scripts/db/reconcilePolicyCatalog.js
```

The reconciler diff/upserts `CATALOG_ENTRIES` (defined in
`policyCatalogSeeder.js`) against every tenant schema and reports
`{ inserted, updated, removed, unchanged }` per tenant. It is also the path
used during tenant provisioning, so new and existing tenants stay in lockstep.

---

## One-command execution

```bash
bash scripts/db/rebuild_and_restore_srh.sh
```

Run from the monorepo root. Requires `.pgpass` or `PGPASSWORD` for `axe_admin`.

---

## What the script does

### Step 1 — Backup

- `pg_dump -Fc --schema=srh` — archival custom dump (timestamped)
- `pg_dump --schema=srh` — plain SQL dump (used for staging restore)
- `\COPY` admin.portal_users rows for SRH tenant to CSV (preserves `password_hash`)

All files written to `tmp/srh_backups/`.

### Step 2 — Drop all schemas

Queries `information_schema.schemata` for every non-system schema and drops them
with `CASCADE`. This removes `admin`, `axerra`, `srh`, `pgschemata`, `public`, etc.

### Step 3 — Recreate public schema

`CREATE SCHEMA IF NOT EXISTS public`

### Step 4 — Run setupAdmin

Runs `setupAdmin.js` which:

- Creates the `admin` schema and runs admin-scope migrations
- Provisions the Axerra root tenant (`axerra` schema)
- Seeds the root super user

### Step 5 — Provision SRH tenant

Runs `provisionTenantCli.js` which:

- Inserts the SRH tenant record into `admin.tenants`
- Calls `provisionTenant()` — creates `srh` schema, runs all tenant-scope
  migrations, seeds system roles, **fresh `policy_catalog`** (with
  `valid_statuses` and `available_fields`), and numbering config

### Step 6 — Restore from backup

1. **Rewrite** plain SQL dump: `srh` → `srh_restore` (perl regex on schema refs)
2. **Restore** rewritten SQL into `srh_restore` staging schema
3. **Remap** `tenant_id` and `tenant_code` in all staged tables (dynamic DO block)
4. **Generate FK-safe order** from FK metadata via recursive CTE
5. **Truncate** `srh` tables in reverse FK order, **excluding `policy_catalog`**
6. **Insert** from `srh_restore` to `srh` in FK order, **excluding `policy_catalog`**

Excluding `policy_catalog` preserves the freshly-seeded data from Step 5. This
carve-out is a historical workaround — for restores that don't otherwise need
a full rebuild, restore everything and then run `reconcilePolicyCatalog.js`
to bring the catalog back in line with the current codebase.

### Step 7 — Restore portal_users

Loads the CSV backup into a temp table, remaps `tenant_id` to the new SRH
tenant UUID, and inserts into `admin.portal_users` with new UUIDs but original
`password_hash` values. Skips emails that already exist.

### Step 8 — Validate

Runs integrity checks:

| Check | Expected |
|-------|----------|
| Employees missing tenant reference | 0 |
| App-user employees missing portal_users | 0 |
| portal_users pointing to missing employee | 0 |
| policy_catalog total entries | > 0 |
| policy_catalog with valid_statuses | > 0 |
| policy_catalog with available_fields | > 0 |

### Step 9 — Clean up

Drops the `srh_restore` staging schema.

---

## Supporting scripts

### `scripts/db/provisionTenantCli.js`

CLI script to provision any tenant from the command line.

```bash
cross-env NODE_ENV=development node scripts/db/provisionTenantCli.js \
  --tenant-code SRH \
  --company "Sterling Ridge Homes, LLC" \
  --schema-name srh \
  --tier growth
```

Inserts tenant record (idempotent) and calls `provisionTenant()`.

### `scripts/db/reconcilePolicyCatalog.js`

Diff/upsert/delete reconciler for `policy_catalog`. Imports `CATALOG_ENTRIES`
from `policyCatalogSeeder.js` and applies the delta against one or all
tenant schemas. Stable row IDs, idempotent, safe to re-run.

```bash
# All non-admin tenants in admin.tenants
cross-env NODE_ENV=development node scripts/db/reconcilePolicyCatalog.js

# Single schema (root flag derived from admin.tenants)
cross-env NODE_ENV=development node scripts/db/reconcilePolicyCatalog.js --schema srh

# Override root flag for a not-yet-registered schema
cross-env NODE_ENV=development node scripts/db/reconcilePolicyCatalog.js --schema axerra --root

# Diff only, no writes
cross-env NODE_ENV=development node scripts/db/reconcilePolicyCatalog.js --dry-run
```

Removed entries (rows in DB whose tuple no longer appears in `CATALOG_ENTRIES`)
are hard-deleted. Any matching grants in `<schema>.policies` for the removed
tuple become orphaned — the reconciler logs a warning with the dependent count
so an operator can clean them up.

---

## Design decisions

1. **Exclude only `policy_catalog`** from the restore — all other tables
   (roles, policies, numbering_config) are restored from backup since they
   contain user-customized data. With the reconciler now in place, an
   alternative flow is to restore `policy_catalog` along with everything
   else and then run `reconcilePolicyCatalog.js` to sync to current code.

2. **Preserve passwords** by backing up `admin.portal_users` to CSV before
   dropping. Employee UUIDs are stable across backup/restore, so `entity_id`
   links remain valid.

3. **`portal_users.id` is regenerated** (`gen_random_uuid()`) to avoid PK
   conflicts. Users get new session tokens on next login but keep passwords.

4. **FK-safe ordering** is generated from PostgreSQL metadata (recursive CTE
   over `information_schema.table_constraints`), not hard-coded.

5. **Self-referential FKs** are excluded from the walk CTE
   (`e.child_table <> e.parent_table`) with a depth limit of 50 as a safety
   valve against cycles.

---

## Prerequisites

- `.pgpass` configured for `axe_admin` on `axerra_dev` (or `PGPASSWORD` set)
- Node >= 20, npm workspace dependencies installed
- Run from the monorepo root

---

## Files produced

| File | Purpose |
|------|---------|
| `tmp/srh_backups/srh_schema_TIMESTAMP.dump` | Archival custom dump |
| `tmp/srh_backups/srh_schema.sql` | Plain SQL dump for staging |
| `tmp/srh_backups/portal_users_srh.csv` | portal_users backup with password hashes |
| `tmp/srh_backups/srh_restore_schema_safe.sql` | Rewritten SQL for staging |
| `tmp/srh_backups/truncate_srh.sql` | Generated truncate statements |
| `tmp/srh_backups/insert_srh.sql` | Generated insert statements |
| `tmp/srh_backups/restore_transaction.sql` | Combined truncate + insert |

---

## Operational notes

- `admin.portal_users.entity_id` is the employee link field, not `employee_id`
- App-user filtering uses `is_app_user = true`
- Schema rewrite only touches executable schema references (not data values)
- Tenant remap is dynamic across all staged tables with `tenant_id`/`tenant_code`
- The custom dump file is kept unchanged as an archival safety net
