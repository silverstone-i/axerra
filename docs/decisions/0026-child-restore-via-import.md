# ADR-0026: Child rows restore via import, not via UI route

**Status**: Accepted
**Date**: 2026-05-19
**Related**: PR #80 (cascade unification), cascade-restore importer follow-on PR

## Context

The four polymorphic child tables — `emails`, `phone_numbers`, `addresses`,
`tax_identifiers` — each expose a `DELETE /:id/archive` route via the
standard `createRouter` REST factory, and they inherit `PATCH /restore`
from the same factory (so the API endpoint technically exists). What's
deliberate is that **no UI affordance calls `PATCH /restore` on a child
row** — the client never offers a "restore deleted email" button. Users
recover an archived child by re-importing the parent's workbook.

When the parent of a soft-deleted child row is restored, the parent restore
does **not** cascade-restore the child. The user explicitly chose to delete
that child row; an unrelated parent-restore action shouldn't silently
reverse it. (Parent-level cascade restore is scoped to the cohort that was
locked together at the parent's archive moment — see ADR for the cascade
rule.)

The user-facing mechanism for bringing an archived child row back is the
importer. When a workbook contains a row that natural-key-matches a
soft-deleted child, the importer restores the row in place — same `id`,
`deactivated_at` cleared. This is identical across the flat single-entity
importer (employees, clients, etc.) and the combined two-sheet importer
(vendors + vendor_contacts).

## Decision

1. Child controllers (`emailsController`, `phoneNumbersController`,
   `addressesController`, `taxIdentifiersController`) provide the
   standard CRUD surface, which includes `PATCH /restore` via
   `createRouter`. The client UI does **not** call that endpoint for
   child rows — there is no "restore deleted email/phone/address/tax id"
   button in any client page. Restore of an archived child is a side
   effect of re-importing the parent's workbook (see Decision #2).
2. The shared classifier `_classifyChildren` and per-source reconciler
   `_reconcileChildrenForSource` in `apps/server/src/lib/spreadsheetHelpers.js`
   examine both active and archived rows when matching incoming workbook
   rows. Match priority per incoming row:
   1. active slot key
   2. active value key (catches a slot rename, e.g. label changed from
      "work" → "primary" on the same email address)
   3. archived slot key  → restore (and update if values differ)
   4. archived value key → restore (+ update if values differ)
   5. no match           → insert
3. Restore writes only flip `deactivated_at` to NULL (plus changed columns
   in the restore+update case). `status` is not modified.
4. Importer-driven child archive is **out of scope**. Deletion stays a
   one-way action initiated explicitly through the UI.

## Rationale

- **Asymmetric intent**. UI-side deletion is a deliberate, per-row action;
  a single-click "restore" button at the UI would let an admin accidentally
  resurrect a row archived long ago for reasons no longer captured. The
  workbook re-import path requires the user to put the value in front of
  themselves and click commit — meaningful friction.
- **Round-trip semantics for exports**. Today an export of a parent
  records its currently-active child rows. Re-importing the export should
  noop. A user who edits the export to re-add a previously deleted value
  (or re-uploads an older export from before the delete) gets the row back
  with its original id; no constraint conflict, no duplicate.
- **Match-by-natural-key** (slot key first, then value key — see
  Decision #2 for the exact priority order) lets the user recover an
  archived child without having to look up its database id. The
  matched row is restored in place, so its original id and downstream
  FK references are preserved.

## Consequences

- Child rows have no UI restore affordance, even though the API endpoint
  exists. A user who needs a deleted row back must edit the parent's
  exported workbook to include it (or upload one of their own that
  contains the value), then re-import. Direct API consumers can still
  hit `PATCH /restore` if they have a reason to — that's the existing
  `BaseController.restore` surface — but the product position is that
  the import path is the supported recovery flow.
- Round-trip re-imports (no edits) are guaranteed noops on the child side.
- Workbook re-imports of older exports will restore values that were
  deleted between the export and the re-import. This is the intended
  behavior, but operators should be aware before bulk-re-importing stale
  exports.

## Out of scope

- Disabling `PATCH /restore` at the router level for these child
  resources. The endpoint exists today (and one contract test exercises
  the tax_identifiers variant); the ADR codifies the UI-side product
  decision, not a route-level enforcement.
- Importer-driven child archiving (Decision #4).
- `status` column manipulation on restore (Decision #3).
- Case-sensitivity of the diff comparator. The shared classifier uses
  `_normEq`, which compares strings case-insensitively. A separate change
  could introduce a per-cfg case-sensitivity flag if round-tripping
  case-only edits becomes a requirement.
