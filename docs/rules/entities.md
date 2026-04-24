# Entity Lifecycle Rules

## Core Entities

| Entity | Table | Source-Linked | Notes |
|--------|-------|---------------|-------|
| Vendor | `vendors` | Yes | Auto-creates sources record on create |
| Client | `clients` | Yes | Auto-creates sources record; manages portal_users lifecycle |
| Employee | `employees` | Yes | Auto-creates sources record; manages portal_users lifecycle |
| Contact | `contacts` | Yes | Auto-creates source; codes auto-numbered; no RBAC / no login |
| Address | `addresses` | Via source_id | Linked to vendor/client/employee through sources |
| Company | `companies` | Yes | Auto-creates source; `code` is required (not auto-numbered) |
| Vendor Contact | `vendor_contacts` | Yes | Auto-creates source; manages portal_users lifecycle |
| Payment Terms | `payment_terms` | No | Settings/lookup table for payment term definitions |

> **Note:** Three entity types support app-user provisioning: employees, clients, and vendor_contacts. Each manages `is_app_user` and `roles` columns with full portal_users lifecycle (provision/archive/restore/reset-password). Vendors are organizations and do not have login capability. Contacts are standalone payees with no RBAC or login capability.

> **Note:** For vendor contacts, `roles` and `is_app_user` live on `vendor_contacts`, not on `vendors`. This separates individual-level portal access from the vendor entity itself.

## Auto-Source Creation

When a vendor, client, employee, contact, vendor_contact, or company is created, a `sources` record is automatically inserted in the same transaction:

1. Insert the entity record
2. Insert a `sources` record with `table_id = entity.id` and appropriate `source_type`
3. Update the entity to set `source_id = source.id`

This guarantees every source-linked entity has a valid source before contacts or addresses are attached.

## App-User Lifecycle (employees, clients, vendor_contacts)

Employees, clients, and vendor_contacts each have an `is_app_user` boolean that controls whether they have a login account in `admin.portal_users`. The lifecycle is identical across all three entity types — only `entity_type` differs (`'employee'`, `'client'`, `'vendor_contact'`).

### Provisioning (is_app_user toggled ON)

- Email and at least one role are required when `is_app_user = true`
- A temporary random password is generated and bcrypt-hashed
- A `portal_users` record is created with the appropriate `entity_type`, `entity_id`, `status = 'invited'`
- If an archived portal_user already exists for this entity, it is restored instead of creating a new one

### Archiving (is_app_user toggled OFF or entity archived)

- The linked `portal_users` record is soft-deleted (`deactivated_at = NOW()`)
- Status is set to `locked`
- The user can no longer log in

### Restoring (entity restored while is_app_user = true)

- The linked `portal_users` record is restored (`deactivated_at = NULL`)
- Status is set to `active`

### Password Reset

- Admin-only endpoint: `POST /:id/reset-password`
- Validates password strength (8+ chars, upper, lower, digit, special)
- Looks up the portal_user by `entity_type` + `entity_id`

### System Roles

Two system roles are seeded in all tenants for portal access:
- **`vendor_contact`**: scope `'self'`, view access narrowed to own data. No financial access.
- **`client`**: scope `'self'`, view access narrowed to own data. No financial access.

## Auto-Numbering and Code Assignment

Vendors, clients, employees, and contacts have a nullable `code` column populated by the tenant-scoped numbering system:

- On entity creation, if `code` is not provided and numbering is enabled for that entity type, `allocateNumber()` assigns the next code in the configured format
- If `code` is explicitly provided, it is used as-is (no auto-numbering)
- If numbering is disabled, the entity is created with `code = NULL`

> **Note:** Only `employeesController` normalizes empty-string codes to `null` before insert/update. Vendors, clients, and contacts do not perform this normalization.

### Backfill on Enable

When a tenant first enables numbering for an entity type, all existing records with `code IS NULL AND deactivated_at IS NULL` are backfilled in `created_at` order. This includes the admin employee created during tenant provisioning. See PRD §3.13.9.

## Soft Delete Convention

All entity tables use `softDelete: true` with a `deactivated_at` column:

- Active records: `deactivated_at IS NULL`
- Archived records: `deactivated_at IS NOT NULL`
- Use `includeDeactivated: true` query param to include archived records in list queries
- Unique constraints use `WHERE deactivated_at IS NULL` to allow re-creation of previously archived codes

## Cascade Delete via Sources

Contacts and addresses are linked via `source_id FK -> sources.id ON DELETE CASCADE`. When a source is deleted, all linked contacts and addresses are automatically removed. Entity tables (vendors, clients, employees) also have `source_id FK -> sources.id ON DELETE CASCADE`.
