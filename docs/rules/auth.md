/**
 * @file Authentication business rules
 * @module docs/rules
 *
 * Copyright (c) 2025 Axerra LLC. All rights reserved.
 */

# Authentication Rules

## Token Architecture

### Access Token (JWT)

- **Storage:** httpOnly, Secure, SameSite=Lax cookie named `auth_token`
- **TTL:** 15 minutes
- **Claims:**
  - `sub` — portal_user UUID (primary key of `admin.portal_users`)
  - `ph` — SHA-256 hex hash of the user's permission canon, computed at
    login from the loaded canon (Phase 3, live as of commit `1ac6a21`)
  - `iss` — `axerra-serv`
  - `aud` — `axerra-serv-api`
- **Secret:** `ACCESS_TOKEN_SECRET` env var (minimum 32 characters)

### Refresh Token (JWT)

- **Storage:** httpOnly, Secure, SameSite=Lax cookie named
  `refresh_token`
- **TTL:** 7 days
- **Claims:** `sub` only (no permission hash)
- **Secret:** `REFRESH_TOKEN_SECRET` env var (separate from access secret)
- **Path:** `/api/auth` (only sent to auth endpoints)

### Cookie Configuration

| Property | Value |
|---|---|
| `httpOnly` | `true` |
| `secure` | `true` in production, `false` in development |
| `sameSite` | `Lax` (configurable via `COOKIE_SAMESITE` env var) |
| `path` | `/` for access token, `/api/auth` for refresh token |
| `maxAge` | 15 min (access), 7 days (refresh) |

## Password Requirements

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one digit
- At least one special character (`!@#$%^&*()_+-=[]{}|;:'",.<>?/`)
- Validated server-side on login creation and password change

## Authentication Flow

### Login (`POST /api/auth/login`)  *(Phase 3 — current as of commit `1ac6a21`)*

1. Validate email exists in `admin.portal_users`
2. Check user status is `active` or `invited` (not `locked`)
3. Resolve home tenant via the oldest active `admin.portal_user_tenants`
   binding for the user; refuse with *"Tenant is inactive."* if the home
   tenant is not active
4. Verify password against bcrypt hash
5. Load RBAC permission canon for the home tenant; refuse with 403 if the
   user has no usable permissions (empty caps — no entity, no roles, or
   roles that resolve to no policies)
6. Compute `ph` from the loaded canon; sign access + refresh tokens with
   `ph` embedded in the access token
7. Prime the canon into the Redis permission cache so the first
   authenticated request does not re-load
8. Set httpOnly cookies
9. Return `{ message, forcePasswordChange }` — `forcePasswordChange` is
   `true` when `user.status === 'invited'` (derived, not a DB column).
   Invited users are prompted to change their password on first login

### Token Refresh (`POST /api/auth/refresh`)

1. Extract refresh token from `refresh_token` cookie
2. Verify JWT signature and expiration
3. Look up user by `sub` claim — verify still active
4. Sign new access token (with current permission hash)
5. Sign new refresh token (rotation)
6. Set new cookies

### Logout (`POST /api/auth/logout`)

1. Clear `auth_token` and `refresh_token` cookies
2. Return 200

### Auth Check (`GET /api/auth/check`)

- Lightweight endpoint — middleware verifies JWT, endpoint returns 200
- Used by client for silent session validation on app load

### Me (`GET /api/auth/me`)

- Returns full user context: user fields (excluding `password_hash`) +
  tenant fields
- Used by `AuthContext` to hydrate client state

### Change Password (`POST /api/auth/change-password`)

1. Verify current password against stored hash
2. Validate new password meets strength requirements
3. Hash new password with bcrypt
4. Update `password_hash` directly (raw SQL to avoid ColumnSet reset)
5. If user status is `invited`, transition to `active`

## Middleware (`authRedis`)

### Request Processing

1. Check if path is in bypass list (`/auth/login`, `/auth/refresh`,
   `/auth/logout`, `/health`)
2. Extract `auth_token` from cookies
3. Verify JWT signature and expiration
4. Look up user from `admin.portal_users` by `sub` claim
5. Verify user status is `active`
6. Look up tenant from `admin.tenants` by `user.tenant_id`
7. Populate `req.user` with user fields + `tenant_code`
8. If `x-tenant-code` header present (cross-tenant access), resolve
   target tenant for Axerra users

### Phase 3 Status (current as of commit `1ac6a21`)

- ✅ Redis permission cache: read at request time; primed at login
- ✅ RBAC permission loading: runs at login (gating) and on cache miss
- ⏳ Stale token detection (`X-Token-Stale` header): intended; not yet wired
- ⏳ Impersonation session resolution: intended; not yet wired
- ✅ Permission hash (`ph`): computed at login from the loaded canon and
  embedded in the access token

## portal_users Table Design (PRD §3.2.2)

The `admin.portal_users` table is a pure identity/login table:

| Column | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `tenant_id` | uuid | FK to `admin.tenants` |
| `entity_type` | varchar(16) | Polymorphic link type (employee, vendor_contact, client) |
| `entity_id` | uuid | Polymorphic link to entity record in tenant schema |
| `email` | varchar(128) | Login identifier (unique) |
| `password_hash` | text | bcrypt hash |
| `status` | varchar(20) | `active`, `invited`, `locked` (CHECK constraint) |

**Deliberately excluded** (per PRD): `tenant_code`, `user_name`,
`full_name`, `tax_id`, `notes`, `role`, `tenant_role`, `employee_id`.

- User profile data lives on the linked entity record
- Roles are stored as `text[]` on entity records, not on portal_users
- `entity_type` and `entity_id` are null for the bootstrap super user
  (entity tables don't exist until Phase 5)
- `portal_users.tenant_id` is a convenience pointer to the **home**
  tenant. It is NOT the authoritative cross-tenant access list — see
  `portal_user_tenants` below.

## portal_user_tenants Table Design (PRD §3.2.2)

`admin.portal_user_tenants` is the authoritative cross-tenant binding
table. One row per `(portal_user, tenant)` pair the user can access.

| Column | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `portal_user_id` | uuid | FK to `admin.portal_users` (CASCADE) |
| `tenant_id` | uuid | FK to `admin.tenants` (CASCADE) |
| `entity_type` | varchar(16) | `employee`, `vendor_contact`, `client`, or NULL |
| `entity_id` | uuid | Cross-schema link to tenant-scoped entity, or NULL |
| `status` | varchar(20) | `active`, `invited`, `locked` |

Indexes:

- Partial unique `(portal_user_id, tenant_id) WHERE deactivated_at IS NULL`
- Partial unique `(tenant_id, entity_type, entity_id) WHERE deactivated_at IS NULL AND entity_type IS NOT NULL`
- Supporting indexes on `portal_user_id`, `tenant_id`, `(entity_type, entity_id)`

**Home tenant:** the oldest active binding. Resolved at login.
**Cross-tenant requests:** select an active binding via `x-tenant-code`
header at request time, subject to RBAC.

## Environment Variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `ACCESS_TOKEN_SECRET` | Yes | — | JWT signing secret for access tokens |
| `REFRESH_TOKEN_SECRET` | Yes | — | JWT signing secret for refresh tokens |
| `ROOT_EMAIL` | Yes | — | Bootstrap super user email |
| `ROOT_PASSWORD` | Yes | — | Bootstrap super user password |
| `ROOT_TENANT_CODE` | No | `AXERRA` | Bootstrap tenant code |
| `ROOT_COMPANY` | No | `Axerra LLC` | Bootstrap tenant company name |
| `BCRYPT_ROUNDS` | No | `12` | bcrypt cost factor (4 in test) |
