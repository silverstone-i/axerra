# ADR-0025: Partial unique indexes for child entities (import dedup)

**Status**: Accepted
**Date**: 2026-05-01
**Related**: Import Dedup & Multi-Tenant Vendor Access plan, "Import
Deduplication & Multi-Tenant Vendor Access" spec (Part 1 — Import
Deduplication).

## Context

Excel imports can currently produce duplicate child records (emails, tax
identifiers, phone numbers) within a tenant schema. The spec requires a
three-layer enforcement model — DB partial unique indexes as the hard
floor, an import-time `validateImportGroups` collision check, and a
round-tripped UUID column. This ADR covers the DB-level layer only and
audits the four child schemas to confirm the new partial unique indexes
can be applied cleanly to a fresh database via the existing pg-schemata
definitions (no migration files).

The four schemas audited:

- `apps/server/src/system/core/schemas/emailsSchema.js`
- `apps/server/src/system/core/schemas/taxIdentifiersSchema.js`
- `apps/server/src/system/core/schemas/phoneNumbersSchema.js`
- `apps/server/src/system/core/schemas/addressesSchema.js`

All four are tenant-scoped, soft-deleted (`deactivated_at`), and link to
the polymorphic `sources` table via `source_id` with `ON DELETE CASCADE`.

## Decision

Apply the following partial unique indexes (Task 3) to the existing
schema definitions on a fresh DB. The audit confirms each can be added
cleanly via the standard pg-schemata index syntax already used in these
files:

```js
{ type: 'Index', columns: [...], unique: true, where: '...' }
```

| Entity | New unique columns | Condition | Action |
|---|---|---|---|
| `emails` | `email` | `deactivated_at IS NULL` | Replace existing `(source_id, email)` partial unique |
| `tax_identifiers` | `country_code, tax_type, tax_value` | `deactivated_at IS NULL` | Replace existing `(source_id, country_code, tax_type)` partial unique |
| `phone_numbers` | `country_code, phone_number` | `deactivated_at IS NULL AND phone_type = 'cell'` | Add new |

`addresses` and non-cell `phone_numbers` retain no DB-level uniqueness.

### Per-entity audit

#### emails

Existing indexes:

- `(tenant_id)`
- `(source_id)`
- `(source_id, email)` unique where `deactivated_at IS NULL`
- `(source_id)` unique where `is_login = true AND deactivated_at IS NULL`
- `(source_id)` unique where `is_primary = true AND deactivated_at IS NULL`

Change: drop the `(source_id, email) WHERE deactivated_at IS NULL`
index and replace with `(email) WHERE deactivated_at IS NULL`. The new
index is strictly stronger (uniqueness now spans the whole tenant, not
just per source) so anything that satisfied it satisfies the old one.
The two `is_login` / `is_primary` partial uniques are unaffected and
remain correct under the new model — login/primary are still per-source
flags.

Concerns:

- The new `(email)` partial unique is tenant-wide. The same human can
  appear as both a `client` and an `employee` within one tenant, but
  cannot share a single email row across two `sources` because the row
  is anchored to a single `source_id`. Sharing an email string would be
  blocked. Spec accepts this — the canonical login model in Part 2
  treats login email as a single global identity per portal_user, and
  multi-source overlap inside one tenant is out of scope.
- `is_login = true` will, by definition, also be unique-by-email under
  the new index, so the existing per-source `is_login` partial unique
  becomes redundant in the login case but remains useful for guarding
  the single-login-per-source invariant for non-email reasons. Keep it.

#### tax_identifiers

Existing indexes:

- `(tenant_id)`
- `(source_id)`
- `(source_id, country_code, tax_type)` unique where `deactivated_at IS NULL`

Change: replace the existing `(source_id, country_code, tax_type)`
partial unique with `(country_code, tax_type, tax_value)` partial
unique where `deactivated_at IS NULL`. The existing index encodes "one
tax id per (country, type) per source" — it does not express the spec
requirement (a given tax value should be unique across the whole tenant
for that country/type). Both should not coexist: the new index is
broader on `source_id` but narrower on `tax_value`, so neither
subsumes the other and keeping the old one would forbid legitimate
multi-value cases (e.g., a vendor with two VAT numbers in different
sub-jurisdictions). Drop the old, add the new.

Concerns: none beyond the drop/add note above.

#### phone_numbers

Existing indexes:

- `(tenant_id)`
- `(source_id)`
- `(source_id)` unique where `is_primary = true AND deactivated_at IS NULL`

Change: add `(country_code, phone_number)` partial unique where
`deactivated_at IS NULL AND phone_type = 'cell'`.

Concerns:

- `country_code` is nullable in the schema (no `notNull`, default
  `'US'`). Postgres treats NULLs as distinct in unique indexes, so a
  row with NULL `country_code` would never collide. With the column's
  `'US'` default, in practice rows will not be NULL unless explicitly
  set so. Acceptable for the spec's purpose; flag for Task 3 to verify
  insert paths always populate `country_code` for cell phones.
- `phone_type` has a CHECK constraint restricting it to
  `('cell', 'work', 'home', 'fax', 'other')`, so the literal `'cell'`
  in the WHERE predicate is safe and stable.

#### addresses

Existing indexes:

- `(tenant_id)`
- `(source_id)`

Change: none. Spec explicitly excludes addresses from DB-level
uniqueness — too much legitimate variance in formatting.

Concerns: none.

## Alternatives considered

- **Keep tenant-scoped index on `(source_id, email)` and add the
  global `(email)` index alongside.** Rejected — the global index
  subsumes the per-source one. Two indexes covering the same writes
  with no semantic gain wastes storage and slows DML.
- **Express `phone_type = 'cell'` uniqueness via a CHECK + trigger
  rather than a partial index.** Rejected — partial unique indexes are
  the idiomatic Postgres mechanism, already used elsewhere in these
  schemas.
- **Enforce uniqueness only at the application layer
  (`validateImportGroups`).** Rejected — the spec mandates a hard DB
  floor so direct API writes and any future bulk path cannot bypass it.

## Consequences

- Fresh-DB-only deploy. No migration files; pg-schemata applies the
  definitions on first table creation.
- Task 3 can land the schema edits with confidence — no surprise
  conflicts with existing indexes once the noted drops occur.
- New tests in Task 3 should cover: (a) unique violation on insert of
  a duplicate active row; (b) absence of violation when the colliding
  row is soft-deleted (`deactivated_at` set); (c) for `phone_numbers`,
  absence of violation when `phone_type != 'cell'`.
- Error surfacing relies on `parseDbImportError` already in use; no
  new error mapping required because the violations remain
  `unique_violation` (SQLSTATE 23505).

## Implementation notes (for Task 3)

- Index syntax already used in these files:

  ```js
  { type: 'Index', columns: ['email'], unique: true,
    where: 'deactivated_at IS NULL' }
  ```

- `emails`: remove the existing
  `(source_id, email) WHERE deactivated_at IS NULL` entry from
  `constraints.indexes` and add the new `(email)` entry. Leave the
  `is_login` and `is_primary` partial uniques in place.
- `tax_identifiers`: remove the existing
  `(source_id, country_code, tax_type) WHERE deactivated_at IS NULL`
  entry and add the new
  `(country_code, tax_type, tax_value) WHERE deactivated_at IS NULL`
  entry.
- `phone_numbers`: add the new
  `(country_code, phone_number) WHERE deactivated_at IS NULL AND
  phone_type = 'cell'` entry. Preserve the `is_primary` partial unique.
- `addresses`: no change.
