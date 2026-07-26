# ADR-0030: Role Assignments as `text[]` on the Entity Row

**Status**: Accepted
**Date**: 2026-05-24

## Context

User-to-role assignment in AXERRA is stored as a `roles text[]` column on each entity row (`employees`, `vendor_contacts`, `clients`) rather than as rows in a `user_roles` junction table. This is a deliberate departure from the textbook RBAC pattern used by Keycloak, Django, Rolify, NetSuite, and Dynamics 365.

## Decision

Role assignments live on the entity. There is no `role_members` (or equivalent) junction table and no role-assignment API. Roles are mutated via the entity's CRUD endpoints (PRD §3.1.3.3).

## Rationale

- Assignments carry **no per-assignment data**. Scope lives on the role definition (`roles.scope`), not on each grant. There is nothing to store in a junction row beyond the link itself.
- The auth hot path (`authRedis` → permission canon) reads roles on every authenticated request. One-row reads beat JOIN-or-second-query.
- Schema-per-tenant makes every extra table a per-tenant provisioning cost. An array column is one line in the entity schema.
- Per-project role variance is already handled separately by `project_members.role` (the junction pattern is in the codebase where it's actually needed).

## Known Limits — Triggers to Revisit

Refactor to a junction table when any of these become a requirement:

- **Per-company role variance** ("admin on company A, AP clerk on company B"). Today `company_members` is membership-only; the minimum fix is a `role` column on `company_members` (mirroring `project_members`), not a full junction. A full junction becomes warranted if multiple such overrides accumulate.
- **Time-bounded assignments** (auto-expiring contractor or interim access).
- **Approval workflow on grants** (assignment exists in `pending` state before activation).
- **Append-only role-change audit history** (SOX, HIPAA, FedRAMP). Entity `updated_at` is not sufficient.

## Consequences

- Role codes are not FK-validated; typos in `roles[]` are an application-layer concern.
- "Show me everyone with role X" requires array-contains queries across three entity tables, not one junction lookup.
- No native role-change history. Audit log diffs on the entity row are the workaround.
