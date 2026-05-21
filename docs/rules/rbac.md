# RBAC Business Rules

## Permission Resolution

1. Roles are stored as `text[]` on entity records
   (employees, clients, vendor_contacts).
2. `portal_users.entity_type` + `entity_id` links to the
   entity record in the tenant schema.
3. Permission loader reads the entity's `roles` array,
   looks up matching role definitions in the `roles` table,
   then queries `policies` for those role IDs.

## Four-Layer Model

### Layer 1 — Capabilities
- Resolution hierarchy (most specific wins, four fallback steps):
  `module::router::action` > `module::router::` >
  `module::::` > `::::` (empty-module wildcard, matches
  the wildcard policy seeded for `admin` / `super_user`)
- Default if no match: `none`
- Multi-role merge: highest level wins
  (`full` > `view` > `none`)
- Exact-match carve-out: catalog rows with
  `policy_required: true` (the default for router-scoped
  actions) skip the four-step fallback above and require
  an exact `module::router::action` grant — see
  `apps/server/src/middleware/rbac.js` `EXACT_MATCH_KEYS`
  and PRD §3.1.2.

### Layer 2 — Data Scope
- Scope hierarchy: `all_projects` > `assigned_companies` >
  `assigned_projects` > `self`
- Multi-role merge: broadest scope wins
- `assigned_companies`: user sees data from projects
  belonging to their assigned companies
- `assigned_projects`: user sees data from their assigned
  projects only
- `self`: user sees only records matching their entity FK
  (e.g., vendor_id, employee_id)

### Layer 3 — State Filters
- `state_filters` table: `(role_id, module, router,
  visible_statuses[])`
- No row for a role+resource = all statuses visible
- Multi-role merge: union of visible statuses

### Layer 4 — Field Groups
- `field_group_definitions`: named column sets per resource
- `field_group_grants`: assigns groups to roles
- `is_default` groups always visible when field groups are
  active for a resource
- Multi-role merge: union of columns across all grants

## Narrowing Principle

Layers 2-4 only narrow access within Layer 1. They can
never expand access beyond what Layer 1 grants.

## System Roles

All system roles resolve through full RBAC — no bypass.

| Role | Scope | Tenants | Policies |
|------|-------|---------|----------|
| super_user | Axerra only | all_projects | full for all modules |
| admin | All tenants | all_projects | full for all modules |
| support | Axerra only | all_projects | full except accounting/ap/ar (none) |

## Redis Cache

- Key: `perm:{userId}:{tenantCode}`
- TTL: 15 minutes
- Invalidated on role/policy changes
- Falls back to DB when Redis unavailable

## Stale Token Detection

- JWT `ph` claim = SHA-256 of permission canon
- When cached permissions diverge from token's `ph`,
  response includes `X-Token-Stale: 1` header
- Client silently refreshes access token on stale signal

## Module Entitlement

- `tenants.allowed_modules` (jsonb array) controls which
  modules a tenant can access
- Empty array = all modules allowed
- Enforced by `moduleEntitlement` middleware before RBAC
- Returns 403 if module not entitled

## Import/Export RBAC

- Import routes: `setImportAction` overrides
  `req.resource.action = 'import'` → `rbac('full')`
- Export routes: `setExportAction` overrides
  `req.resource.action = 'export'` → `rbac('view')`
- Client checks: `resolveLevel(caps, module, entity, 'import')`
  for import, `resolveLevel(caps, module, entity, 'export')`
  for export
- Both auto-applied by `createRouter` on `/import-xls`
  and `/export-xls`
- `tenants::tenants::import|export` ARE seeded in
  `policyCatalogSeeder` and gate `POST /tenants/import-xls` and
  `POST /tenants/export-xls`. `tenants::portal-users::import|export`
  are intentionally NOT seeded — `portalUsersRouter` disables those
  routes (users are created via `/register`).

## Middleware Chain

```
authRedis → withMeta → moduleEntitlement → rbac → controller
```

- `withMeta({ module, router, action })` annotates
  `req.resource`
- `moduleEntitlement` checks tenant's `allowed_modules`
- `rbac(level)` enforces Layer 1 capabilities
- Controller's `_applyRbacFilters()` applies Layers 2-4

## Business Rules

The PRD links to anchored business rules below. Anchors are explicit
HTML so PRD cross-references resolve regardless of heading edits.

<a id="br-rbac-043"></a>

### BR-RBAC-043 — Cross-tenant access via `x-tenant-code`

Axerra users (members of the root tenant) can switch tenant context on
a per-request basis by sending the `x-tenant-code` header. `authRedis`
resolves the target tenant and re-loads the permission canon for that
binding before the request reaches the route handler. No dedicated
endpoint is required — every authenticated route honors the header
when the caller has cross-tenant scope. Non-root-tenant users sending
the header are ignored (the header is treated as absent). Permission
caches are keyed `perm:{userId}:{tenantCode}`, so each tenant context
maintains its own warm cache.

<a id="br-rbac-044"></a>

### BR-RBAC-044 — Impersonation session lifecycle

A super_user or support role member may start an impersonation
session targeting another portal_user in any tenant. The session is
recorded in `admin.impersonation_logs` (`impersonator_id`,
`target_user_id`, `target_tenant_code`, `reason`, `started_at`) and
mirrored to Redis at `imp:{userId}` with a TTL. Concurrent sessions
for the same impersonator are prevented by a partial unique index on
`impersonation_logs (impersonator_id) WHERE ended_at IS NULL` — a
second start attempt returns `409 Conflict`. Sessions end either by
explicit `/impersonation/end` (sets `ended_at`, clears the Redis key)
or by TTL expiry; either path produces an audit-complete log row.

<a id="br-rbac-048"></a>

### BR-RBAC-048 — Impersonated request context

While `imp:{userId}` is active, `authRedis` swaps `req.user` to the
**target** user (so authorization runs against the impersonated
context) and sets `req.user.is_impersonating = true` and
`req.user.impersonated_by = <impersonator_id>`. Audit columns
(`created_by` / `updated_by`) record the target user's id — actions
look like they came from the target, with the impersonator preserved
in the dedicated `impersonated_by` field. Routes that must refuse an
impersonated session (e.g. orphan portal-users cleanup) check
`req.user.is_impersonating` and respond `403`. `/auth/me` includes
`impersonation: { active, impersonated_by }` so the client can show
an "impersonating" banner.
