# ADR-0029: Tenant Restore Leaves Users Locked; Admin Reactivation Is Explicit

**Status**: Accepted
**Date**: 2026-05-24

## Context

The tenant lifecycle is soft: archive locks rows, restore reactivates them, no data is deleted. The open question was what `PATCH /api/tenants/v1/tenants/restore` should do to the `admin.portal_user_tenants` bindings and `admin.portal_users` rows that were locked by the archive cascade.

Two postures were on the table:

1. **Restore-to-prior-state.** Remember each binding's pre-archive `status` (e.g. `active`, `invited`) at archive time, and restore it on the reverse path. The tenant comes back ready to use; original users can log in immediately.
2. **Restore-deactivated_at-only.** Clear `deactivated_at` on the cohort but leave `status = 'locked'`. The tenant comes back, but no one can log in until an operator deliberately re-enables an admin.

The archive→restore window is arbitrary — days, weeks, months. During that window the customer's organisation drifts: employees leave, contractors are deprovisioned, email accounts are recycled, credentials may have leaked, and the customer's primary contact may no longer be the same person. Trust at archive time is not trust at restore time.

The existing `restoreTenantBindings` implementation in `portalUserCascade.js` already does option 2 — clears `deactivated_at`, leaves `status` alone — but the contract was not documented and there was no first-class way to enable an admin after restore. Operators were unlocking users via ad hoc SQL or by manually flipping bindings, which is unauditable and easy to get wrong (e.g. silently re-attaching an employee binding to a `portal_users` row that belongs to a vendor on another tenant).

## Decision

**Restore reactivates rows but does not re-grant login. A new endpoint, `POST /api/tenants/v1/tenants/:tenantId/provision-admin`, is the supported path for enabling an admin on a restored tenant.**

Concretely:

1. `restoreTenantBindings` continues to clear `deactivated_at` on the cohort (tenant row, bindings, and referenced `portal_users`) and continues to leave `status` untouched. The archive cascade does not preserve prior status; restore therefore cannot pretend to recover it.
2. The PRD endpoint description for `PATCH /api/tenants/v1/tenants/restore` is updated to state the contract explicitly: "Reactivates the cohort of bindings and users archived at the same time. `status` is not modified — bindings and users remain `locked`."
3. A new endpoint `POST /api/tenants/v1/tenants/:tenantId/provision-admin` is added under `requireRootTenant`. It accepts `{ email, firstName, lastName, phone, employeeId? }` and branches on whether a `portal_users` row already matches the email and whether a binding to the target tenant already exists. The four-branch flow is documented in PRD §3.1.4.7.3 and mirrors the existing vendor-provisioning pattern in `vendorContactsController.#provisionAppUser` (ADR not previously written for that pattern; this ADR formalises the pattern for the admin case).
4. The new endpoint is the **only** supported way to enable login on a restored tenant. Direct DB edits and ad hoc unlock scripts are deprecated.

## Alternatives Considered

| Alternative | Pros | Cons |
| --- | --- | --- |
| Restore prior `status` per binding (requires storing pre-archive status in a new column or audit row) | Tenant comes back ready to use; lower operator effort | Re-grants trust state that may no longer be valid; requires schema change to remember prior status; conflicts with secure-by-default re-provisioning posture (AWS / Stripe / Google Workspace all require re-attestation after dormancy) |
| Bulk-unlock all cohort users on restore (set `status = 'invited'` for everyone) | Simpler than option above; still forces password reset on first login | Surfaces every former employee as a re-invitable user, including ones whose email accounts are dead or hostile; produces a flood of invite emails to potentially stale addresses; no operator decision point |
| Restore-then-manual-SQL (status quo before this ADR) | No new code | Unauditable; easy to create wrong-shape bindings (e.g. employee binding on a vendor's `portal_users`); no `created_by` / `updated_by` trail |
| **Lock-on-restore + explicit `provision-admin` endpoint** (chosen) | Operator decision is recorded, audited, and constrained; reuses existing vendor-provisioning pattern; handles email collisions correctly; rejects ambiguous cases (entity_type mismatch) with 409 instead of silent rewrite | Operator must take an extra action after restore; "no admin can log in" is a transient state that must be documented |

## Consequences

- **The default post-restore state is "no logins."** This is a feature, not a regression. Operators must take a deliberate action to re-enable access. The PRD documents this clearly so it is not a surprise.
- **Multi-tenant `portal_users` rows are handled correctly.** A vendor contact who has bindings to tenants A and B remains live in B when A is archived; on restore of A, `provision-admin` can add a fresh `employee` binding for them without disturbing the existing vendor binding. Email-collision creation failures are eliminated.
- **`entity_type` boundaries are enforced.** The endpoint refuses (`409`) to silently promote a `vendor_contact` or `client` binding to an `employee` binding. Cross-role transitions remain an explicit, separate operation.
- **No new schema.** This decision is implemented entirely in controller / service logic. Prior `status` is not stored; cohort identification continues to use the existing `MAX(deactivated_at)` rule.
- **`super_user` / `support` access is unaffected.** Axerra root users can still reach restored tenants via `x-tenant-code` regardless of binding state (the authRedis escape hatch from ADR-0001 / the multi-tenant model in PRD §3.1.4). The `provision-admin` flow exists to re-enable **tenant-side** admins, not to grant Axerra access.
- **Forgotten-password recovery is still out of scope** for portal users generally. If a single-tenant tenant admin forgets their password and there is no other admin, the recovery path is also `provision-admin` (the operator unlocks them with branch 3, blanking the password hash and sending a fresh invite). A future self-service recovery flow is tracked separately.

ADRs cross-referenced: [0001](./0001-schema-per-tenant-isolation.md), [0003](./0003-jwt-httponly-cookies.md), [0008](./0008-soft-deletes.md), [0013](./0013-four-layer-scoped-rbac.md).
