# AXERRA - Product Requirements Document

## Scope-tag Legend

Every H2 (`##`) and H3 (`###`) heading in this document carries one of three scope tags:

- **[in-scope]** — part of the current build plan. Spec body describes what is intended; implementation may be partial. Status tags on individual paragraphs distinguish `[implemented]` from `[intended]` work.
- **[deferred]** — known requirement, not in the current build window. The section exists so the requirement is captured; a spec body is written when the section graduates to in-scope.
- **[out-of-scope]** — explicitly not part of AXERRA. Listed so contributors don't propose it.

Status tags applied at the paragraph or bullet level (`[intended]`, `[implemented]`, `[superseded]`) supplement the section scope tag where needed.

## Table of Contents

```
Scope-tag Legend
Glossary

1. Overview
   1.1 Product Overview
   1.2 Target Users
   1.3 Technology Stack
   1.4 Monorepo Structure

2. Architecture
   2.1 Multi-Tenant Model
   2.2 pg-schemata Integration
       2.2.1 Core Capabilities
       2.2.2 Query Operators
       2.2.3 Model Definition Pattern
       2.2.4 Database Initialization
       2.2.5 Planned Enhancements
   2.3 Application Layout
   2.4 Request Flow

3. Module Reference
   3.0 Module Taxonomy
       3.0.1 Core Modules
       3.0.2 Add-on Modules (loading rules)
   3.1 System — Auth, Tenant & RBAC  [core]
       3.1.1 Overview
       3.1.2 Data Tables
           3.1.2.1 portal_users
           3.1.2.2 roles / policies / policy_catalog
           3.1.2.3 state_filters / field_group_*
           3.1.2.4 project_members / company_members
       3.1.3 API
           3.1.3.1 Authentication Endpoints
           3.1.3.2 Tenant Management Endpoints
           3.1.3.3 RBAC / Policy Endpoints
       3.1.4 Business Rules
           3.1.4.1 Login Flow & Token Lifecycle
           3.1.4.2 Mid-Session Policy Refresh
           3.1.4.3 Four-Layer RBAC Resolution
           3.1.4.4 System Roles (incl. vendor_contacts, clients)
           3.1.4.5 Tenant Numbering System
   3.2 Core Entities  [core]
       3.2.1 Overview
       3.2.2 Data Tables
           3.2.2.1 Vendors & Vendor Contacts
           3.2.2.2 Payment Terms
           3.2.2.3 Clients
           3.2.2.4 Employees
           3.2.2.5 Sources, Contacts, Addresses & Phones
           3.2.2.6 Companies
       3.2.3 API
       3.2.4 Business Rules
   3.3 Projects  [core]
       3.3.1 Overview
       3.3.2 Data Tables
           3.3.2.1 Projects
           3.3.2.2 Units
           3.3.2.3 Tasks & Task Groups
           3.3.2.4 Cost Items
           3.3.2.5 Change Orders
           3.3.2.6 Templates
       3.3.3 API
       3.3.4 Business Rules
   3.4 Activities & Cost Management  [core]
       3.4.1 Overview
       3.4.2 Data Tables
           3.4.2.1 Categories & Activities
           3.4.2.2 Deliverables & Assignments
           3.4.2.3 Budgets
           3.4.2.4 Cost Lines
           3.4.2.5 Actual Costs
           3.4.2.6 Vendor Parts
       3.4.3 API
       3.4.4 Business Rules
   3.5 Accounts Payable  [core]
       3.5.1 Overview
       3.5.2 Data Tables
           3.5.2.1 AP Invoices
           3.5.2.2 AP Invoice Lines
           3.5.2.3 Payments
           3.5.2.4 Credit Memos
       3.5.3 API
       3.5.4 Business Rules
   3.6 Accounts Receivable  [core]
       3.6.1 Overview
       3.6.2 Data Tables
           3.6.2.1 AR Invoices
           3.6.2.2 AR Invoice Lines
           3.6.2.3 Receipts
       3.6.3 API
       3.6.4 Business Rules
   3.7 Accounting & General Ledger  [core]
       3.7.1 Overview
       3.7.2 Data Tables
           3.7.2.1 Chart of Accounts
           3.7.2.2 Journal Entries & Lines
           3.7.2.3 Ledger Balances
           3.7.2.4 Posting Queues
           3.7.2.5 Category-Account Map
           3.7.2.6 Intercompany
       3.7.3 API
       3.7.4 Business Rules
   3.8 Cashflow & Profitability  [core]
       3.8.1 Overview
       3.8.2 Data Tables & Views
       3.8.3 API
       3.8.4 Business Rules
   3.9 Reporting & Views  [core]
       3.9.1 Overview
       3.9.2 Data Tables & Views
       3.9.3 API
       3.9.4 Business Rules
   3.10 Shared Tables  [core]
       3.10.1 Emails
       3.10.2 Tenant Preferences
       3.10.3 Countries
       3.10.4 Match Review Logs
   3.11 Demo Tenants
       3.11.1 Meridian Group (MG) — Consulting Use Case
           3.11.1.1 Profile
           3.11.1.2 Active Modules
           3.11.1.3 Data Requirements
           3.11.1.4 Key Workflows
           3.11.1.5 Seed Script Reference
       3.11.2 Sterling Ridge Homes (SRH) — Construction Use Case
           3.11.2.1 Profile
           3.11.2.2 Active Modules
           3.11.2.3 Data Requirements
           3.11.2.4 Key Workflows
           3.11.2.5 Seed Script Reference

   ── Add-on Modules ──────────────────────────────────────────────────

   3.12 Bill of Materials (BOM)  [add-on]
       3.12.1 Overview
       3.12.2 Data Tables
           3.12.2.1 Catalog SKUs
           3.12.2.2 Vendor SKUs
           3.12.2.3 Vendor Pricing
       3.12.3 API
       3.12.4 Business Rules
   3.13 Contracts  [add-on]
       3.13.1 Overview
       3.13.2 Data Tables
       3.13.3 API
       3.13.4 Business Rules
   3.14 Scheduling  [add-on]
       3.14.1 Overview
       3.14.2 Data Tables
       3.14.3 API
       3.14.4 Business Rules
   3.15 Timesheets  [add-on]
       3.15.1 Overview
       3.15.2 Data Tables
       3.15.3 API
       3.15.4 Business Rules
   3.16 Procurement  [add-on]
       3.16.1 Overview
       3.16.2 Data Tables
       3.16.3 API
       3.16.4 Business Rules
   3.17 Inventory & Warehousing  [add-on]
       3.17.1 Overview
       3.17.2 Data Tables
       3.17.3 API
       3.17.4 Business Rules

4. Standard API Patterns
   4.1 CRUD Operations
   4.2 Pagination
   4.3 Audit Fields
   4.4 Soft Deletes
   4.5 Validation
   4.6 Excel Import / Export
       4.6.1 Backend
       4.6.2 Frontend
       4.6.3 Pages with Import / Export

5. Database Design
   5.1 Common Columns
   5.2 Naming Conventions
   5.3 Generated Columns
   5.4 Schema Management & Migrations

6. UI Components & Theming
   6.1 Theme System
       6.1.1 Component Override Strategy
       6.1.2 Design Tokens
       6.1.3 Theme Overrides Reference
   6.2 Navigation System
   6.3 Module Bar
   6.4 Client Dependencies
   6.5 Reusable Component Patterns

7. Navigation Structure

8. Environment Configuration

9. Testing Strategy

10. Coding Standards & Best Practices
    10.1 Naming Conventions
        10.1.1 Single Canonical Names
    10.2 File & Module Structure
    10.3 Copyright & File Headers
    10.4 Code Reuse
    10.5 Classes vs Functions
    10.6 Error Handling
    10.7 Import & Export Style
    10.8 Comments & Documentation
    10.9 Async & Concurrency
    10.10 Security Practices

11. Developer Tooling
    11.1 ESLint
    11.2 Prettier
    11.3 EditorConfig
    11.4 Husky & Git Hooks
    11.5 VSCode Workspace
    11.6 Vitest
    11.7 Vite
    11.8 npm Workspaces
    11.9 Logging
    11.10 Environment Management

12. Project Setup Guide
    12.1 Prerequisites
    12.2 GitHub Repository Setup
    12.3 Clone & Install
    12.4 VSCode Configuration
    12.5 Environment Setup
    12.6 Database Setup
    12.7 Start Development
    12.8 Run Tests
    12.9 Daily Workflow
    12.10 Husky Commit Rules
    12.11 Recommended .nvmrc
    12.12 .env.example Reference

13. Architecture Decision Records
    13.1 Purpose
    13.2 Location
    13.3 Template
    13.4 When to Write an ADR
    13.5 Initial ADRs
    13.6 Referencing ADRs

14. Scripts
    14.1 Conventions
    14.2 Migration Scripts
    14.3 Bootstrap & Seed Scripts
    14.4 Debugging & Diagnostic Scripts
    14.5 CLI / Shell Utilities
```

## Glossary

- **ADR** — Architecture Decision Record.
- **AGPL** — GNU Affero General Public License.
- **AP** — Accounts Payable.
- **AR** — Accounts Receivable.
- **API** — Application Programming Interface.
- **BOM** — Bill of Materials.
- **CI** — Continuous Integration.
- **CLI** — Command-Line Interface.
- **CRUD** — Create, Read, Update, Delete.
- **CSS** — Cascading Style Sheets.
- **DDL** — Data Definition Language.
- **DTO** — Data Transfer Object.
- **ERP** — Enterprise Resource Planning.
- **FK** — Foreign Key.
- **GL** — General Ledger.
- **HMR** — Hot Module Replacement.
- **HTTP** — Hypertext Transfer Protocol.
- **JSON** — JavaScript Object Notation.
- **JWT** — JSON Web Token.
- **LRU** — Least Recently Used (cache eviction policy).
- **MG** — Meridian Group (demo tenant).
- **MUI** — Material UI (React component library).
- **ORM** — Object-Relational Mapper.
- **PG** — PostgreSQL (also used as shorthand for `pg-schemata`).
- **PII** — Personally Identifiable Information.
- **PK** — Primary Key.
- **PR** — Pull Request.
- **PRD** — Product Requirements Document.
- **RBAC** — Role-Based Access Control.
- **REST** — Representational State Transfer.
- **SKU** — Stock Keeping Unit.
- **SOW** — Statement of Work.
- **SPA** — Single-Page Application.
- **SQL** — Structured Query Language.
- **SRH** — Sterling Ridge Homes (demo tenant).
- **SSN** — Social Security Number.
- **TTL** — Time To Live.
- **UI** — User Interface.
- **URL** — Uniform Resource Locator.
- **UUID** — Universally Unique Identifier.
- **VAT** — Value Added Tax.
- **XSS** — Cross-Site Scripting.
- **XLSX** — Office Open XML Spreadsheet file format.

## 1. Overview  [in-scope]

### 1.1 Product Overview  [in-scope]

AXERRA is a multi-tenant, project-native Enterprise Resource Planning (ERP) platform with double-entry accounting. It is built for organizations that run their business through projects — consulting firms, property developers, homebuilders, general contractors, and similar multi-entity operators — and need budgets, cost tracking, vendor and client management, Accounts Payable (AP), Accounts Receivable (AR), General Ledger (GL), intercompany operations, and project-level cashflow and profitability in one system. The base ERP is industry-agnostic; industry-specific workflows ship as opt-in add-on modules. AXERRA runs on schema-per-tenant PostgreSQL isolation via `pg-schemata` 1.3.0, an owned data layer that Axerra extends as product needs evolve.

### 1.2 Target Users  [in-scope]

AXERRA distinguishes **system roles** (built into the platform; their meaning is fixed) from **convenience roles** (created per tenant; named to match local job titles such as Controller, Project Manager, or AP Clerk). System roles carry hard-coded scope rules. Convenience roles inherit from policies the tenant chooses.

| User type | Kind | Description |
| --- | --- | --- |
| Super Admin | System | Platform operator. Full cross-tenant access, impersonation, and tenant lifecycle management. |
| Platform Support | System | Cross-tenant access and impersonation for support tasks. No access to Axerra financial data. |
| Tenant Staff | Convenience | Internal users of a tenant. Granted one or more tenant-defined roles (e.g., Administrator, Controller, Project Manager, AP/AR Clerk, BOM Manager, Financial Analyst). |
| Vendor Contact | System | Portal user mapped to a vendor record. `self` scope — sees only their own vendor's data (invoices, payments, POs). |
| Client | System | Portal user mapped to a client record. `self` scope — sees only their own invoices, statements, and receipts. |

### 1.3 Technology Stack  [in-scope]

| Layer                      | Technology                                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Frontend**         | React 18, Vite 7, Material UI 5, React Router 7, TanStack React Query 5                                             |
| **Backend**          | Node.js 20+, Express 5, ES Modules                                                                                  |
| **Database**         | PostgreSQL 15+ with schema-per-tenant isolation via `pg-schemata` 1.3.0                                           |
| **ORM / Data Layer** | `pg-schemata` 1.3.0 (owned) — TableModel, QueryModel, MigrationManager, bootstrap                                |
| **Caching**          | Redis (permission caching, token staleness detection)                                                               |
| **Auth**             | JWT (HS256) in httpOnly cookies, Passport.js Local Strategy, bcrypt                                                 |
| **AI/ML**            | pgvector + OpenAI embeddings (text-embedding-3-large) for SKU matching                                              |
| **Testing**          | Vitest (unit, integration, contract, RBAC suites)                                                                   |
| **Tooling**          | npm workspaces monorepo, ESLint 9 flat config (root-level, covers all workspaces), Prettier, Husky pre-commit hooks |

### 1.4 Monorepo Structure  [in-scope]

```
axerra/
  apps/
    client/     # React SPA frontend
    server/       # Express API backend
  docs/             # Project documentation  
  packages/
    shared/         # Shared utilities/constants
```

---

## 2. Architecture  [in-scope]

### 2.1 Multi-Tenant Model  [in-scope]

AXERRA uses **PostgreSQL schema-per-tenant** isolation powered by pg-schemata:

- **`admin` schema**: System-wide tables (`tenants`, `portal_users`, `portal_user_tenants`, `match_review_logs`, `impersonation_logs`)
- **Tenant schemas** (e.g., `acme`, `axerra`): Each customer gets a dedicated PostgreSQL schema containing all business tables (vendors, projects, accounting, etc.)
- **Cross-tenant access source of truth:** the `admin.portal_user_tenants` binding table — not `portal_users.tenant_id` alone. A portal user has one row per tenant they can access; the oldest active binding is treated as the **home tenant** (used at login). `portal_users.tenant_id` is retained as a convenience pointer to the home tenant but is **not** the authoritative cross-tenant list.
- Tenant resolution is performed per-request: at login the home tenant is resolved from `portal_user_tenants`; subsequent requests may target any active binding via the `x-tenant-code` header (subject to RBAC).
- All database access is schema-aware via pg-schemata's `setSchemaName()` — models bind queries to the correct tenant schema dynamically.

### 2.2 pg-schemata Integration (Owned Dependency)  [in-scope]

AXERRA is built entirely on **pg-schemata 1.3.0**. Since Axerra owns the pg-schemata repository, the library can be extended with new features or patched as AXERRA requirements evolve.

#### 2.2.1 Core Capabilities Used

| pg-schemata Feature           | AXERRA Usage                                                                                                                        |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **DB.init()**           | Singleton database initialization with all model repositories                                                                       |
| **TableModel**          | Base class for all writable business models — provides insert, update, delete, bulk operations, upsert, soft delete, import/export |
| **QueryModel**          | Base class for read-only views — provides findById, findWhere, findAfterCursor (keyset pagination), countWhere, exists, countAll   |
| **Schema Definitions**  | All table structures defined as JavaScript schema objects with columns, constraints, indexes, and foreign keys                      |
| **Audit Fields**        | `hasAuditFields: { enabled: true, userFields: { type: 'uuid' } }` — auto-managed created_at/by, updated_at/by                    |
| **Soft Delete**         | `softDelete: true` — deactivated_at column with automatic filtering on reads                                                     |
| **Zod Validation**      | Auto-generated insert/update validators from schema definitions via `generateZodFromTableSchema()`                                |
| **ColumnSet Caching**   | LRU cache (20K entries, 1-hour TTL) for pg-promise ColumnSets                                                                       |
| **Excel Import/Export** | `importFromSpreadsheet()` / `exportToSpreadsheet()` built into TableModel                                                       |
| **Error Classes**       | `DatabaseError` (PG error codes: 23505 unique, 23503 FK) and `SchemaDefinitionError`                                            |

#### 2.2.2 WHERE Clause Query Operators

All models inherit pg-schemata's rich query builder:

| Modifier                                                      | SQL                   | Example                                                        |
| ------------------------------------------------------------- | --------------------- | -------------------------------------------------------------- |
| `$like` | LIKE | `{ name: { $like: '%lumber%' } }`        |                       |                                                                |
| `$ilike` | ILIKE | `{ name: { $ilike: '%lumber%' } }`     |                       |                                                                |
| `$from` / `$to`                                           | >= / <=               | `{ created_at: { $from: '2025-01-01', $to: '2025-12-31' } }` |
| `$in` | IN | `{ status: { $in: ['active', 'pending'] } }` |                       |                                                                |
| `$eq` / `$ne`                                             | = / !=                | `{ status: { $ne: null } }`                                  |
| `$is` / `$not`                                            | IS NULL / IS NOT NULL | `{ deleted_at: { $is: null } }`                              |
| `$and` / `$or`                                            | Nested boolean        | `{ $or: [{ status: 'open' }, { status: 'sent' }] }`          |

#### 2.2.3 Model Definition Pattern

Every AXERRA model follows this pattern:

```javascript
import { TableModel } from 'pg-schemata';

const vendorsSchema = {
  dbSchema: 'tenantid',         // Overridden at runtime via setSchemaName()
  table: 'vendors',
  hasAuditFields: { enabled: true, userFields: { type: 'uuid', nullable: true, default: null } },
  softDelete: true,
  columns: [
    { name: 'id', type: 'uuid', default: 'gen_random_uuid()', notNull: true, immutable: true, colProps: { cnd: true } },
    { name: 'tenant_id', type: 'uuid', notNull: true, immutable: true },
    { name: 'name', type: 'varchar(128)', notNull: true },
    { name: 'code', type: 'varchar(16)' },
    // ...
  ],
  constraints: {
    primaryKey: ['id'],
    unique: [['tenant_id', 'code']],
    foreignKeys: [
      { type: 'ForeignKey', columns: ['source_id'], references: { table: 'sources', columns: ['id'] }, onDelete: 'CASCADE' }
    ],
    indexes: [
      { type: 'Index', columns: ['tenant_id'] },
      { type: 'Index', columns: ['tenant_id', 'code'], unique: true, where: 'deactivated_at IS NULL' }
    ]
  }
};

export class Vendors extends TableModel {
  constructor(db, pgp, logger = null) {
    super(db, pgp, vendorsSchema, logger);
  }

  // Custom business methods extend TableModel
  async findByCode(tenantId, code) {
    return this.findOneBy([{ tenant_id: tenantId, code }]);
  }
}
```

#### 2.2.4 Database Initialization

```javascript
import { DB } from 'pg-schemata';
import { createCallDb } from './db/db.js';
// ... all model imports

DB.init(getDatabaseUrl(), {
  vendors: Vendors,
  clients: Clients,
  projects: Projects,
  // ... all model registrations
}, logger);

// Access via custom wrapper: db('vendors', 'schemaName').insert({ ... })
// db is a createCallDb wrapper — NOT imported from pg-schemata
const rawDb = DB.getInstance();
const db = createCallDb(rawDb);
```

#### 2.2.5 Potential pg-schemata Enhancements (Owned Repo)

Features that may need to be added to pg-schemata to support AXERRA:

| Enhancement                       | Purpose                                                         |
| --------------------------------- | --------------------------------------------------------------- |
| **Aggregate query helpers** | Built-in SUM/AVG/GROUP BY support for profitability rollups     |
| **Raw SQL escape hatch**    | Safe parameterized raw query method for complex reporting views |
| **Batch schema operations** | Create/drop multiple tenant schemas in a single call            |
| **Event hooks**             | Pre/post insert/update hooks for GL posting triggers            |
| **Connection tagging**      | Tag connections with tenant context for pg_stat monitoring      |

### 2.3 Application Layout  [in-scope]

The UI follows a four-zone layout architecture:

```
+-----------------------------------------------------------+
| SIDEBAR   | TENANT BAR (sticky top, 48px)                 |
| (sticky   |-------------------------------------------------|
|  left,    | MODULE BAR (sticky, dynamic toolbar)           |
|  full     |-------------------------------------------------|
|  height,  | DATA VIEWPORT (main content area, flex: 1)     |
|  242px    | Page-specific content renders here via Outlet   |
|  or 110px)|                                                 |
+-----------+-------------------------------------------------+
```

- **Tenant Bar**: Tenant selector dropdown, user avatar with profile/settings dropdown
- **Module Bar**: Displays the current module name on the left with breadcrumb navigation (e.g., `Admin > Manage Employees`), plus dynamic toolbar actions (tabs, filters, primary action buttons) on the right
- **Sidebar**: Collapsible navigation with up to 3 levels of nesting (group → sub-module → leaf item); supports flyout menus when collapsed
- **Data Viewport**: Main content area where page components render

### 2.4 Request Flow  [in-scope]

```
Browser -> Vite Dev Proxy (/api -> :3000) -> Express
  -> CORS -> express.json() -> express.urlencoded() -> cookieParser() -> Morgan logging
  -> authRedis() [JWT verify, tenant resolve, permission load, set X-Token-Stale on ph mismatch]
  -> auditContext() [AsyncLocalStorage request context — depends on req.user from authRedis]
  -> /api/<module>/v1/<resource>
  -> (per-route middleware chain — see GET vs mutation below)
  -> errorHandler() [unified Express 5 error mapping]
  -> Response

GET / HEAD routes (createRouter does NOT prepend addAuditFields):
  -> [requireRootTenant (admin routes)] -> [withMeta (user-supplied)] -> [moduleEntitlement (auto-appended)] -> [rbac('view') (auto on /export-xls; opt-in elsewhere)] -> Controller -> pg-schemata Model

POST / PUT / DELETE / PATCH mutation routes (createRouter prepends addAuditFields):
  -> addAuditFields (auto-prepended) -> [requireRootTenant (admin routes)] -> [withMeta (user-supplied)] -> [moduleEntitlement (auto-appended)] -> [rbac('full') (auto on /import-xls; opt-in elsewhere)] -> Controller -> pg-schemata Model
```

> **Note:** `createRouter` automatically prepends `addAuditFields` on mutation routes (POST, PUT, DELETE, PATCH) and appends `moduleEntitlement` on all routes — with two exceptions: `/ping` has no middleware, and `POST /export-xls` uses read-level middleware (no `addAuditFields`). The `withMeta` middleware is passed by each router via per-method middleware arrays. `rbac()` is auto-applied on `/import-xls` (`rbac('full')`) and `/export-xls` (`rbac('view')`) routes with action overrides (`setImportAction` / `setExportAction`). For other routes, `rbac()` must be explicitly added (e.g. `portalUsersRouter` per-method arrays, `employees/:id/reset-password`, `ar-invoices/approve`).

> **Middleware reference:**
>
> - `apps/server/src/middleware/requireRootTenant.js` — gates admin / tenant-management routes. Returns 403 unless `req.user.home_tenant?.toLowerCase()` equals `process.env.ROOT_TENANT_CODE` (default `axerra`, also lowercased). Comparison is case-insensitive.
> - `apps/server/src/middleware/auditContext.js` — wraps each request in AsyncLocalStorage carrying the audit identity for model-layer hooks (paired with `lib/requestContext.js` and `lib/registerAuditResolver.js` — see §4.3).
> - `apps/server/src/middleware/errorHandler.js` — unified Express 5 error handler; maps `SchemaDefinitionError` / `type === 'validation'` → 400, pg-schemata `DatabaseError` 23505 (unique) → 409, 23503 (FK) → 422, application errors carrying `err.status` are returned with that status, all other unhandled errors → 500 with structured logging (and `err.message` in non-prod).
> - `apps/server/src/services/{permCacheInvalidator,rbacQueryContext,permissionLoader}.js` — Redis cache invalidator (busts `perm:{userId}:{tenantCode}` on role/policy mutations), RBAC query context builder, and the permission loader that reads canon from DB on cache miss. See §3.1.2 and `rules/rbac.md`.

### 2.5 Vertical Add-on Modules  [in-scope]

Vertical add-on modules (services, construction, production — see §3.0.2) are architecturally identical to core modules. They are not a different class of code, plugin system, or runtime extension.

- The module registry [`apps/server/src/db/moduleRegistry.js`](../apps/server/src/db/moduleRegistry.js) is the source of truth for which modules exist.
- `tenant.allowed_modules` (jsonb array on `admin.tenants`) controls which modules a given tenant may reach. Empty / null = all modules permitted (existing ADR-0018 semantic).
- Enforcement is the `moduleEntitlement` middleware already auto-injected by `createRouter`. The chain remains: `authRedis → withMeta → moduleEntitlement → rbac → handler`.
- Adding a vertical module is: implement the module under `apps/server/src/<module>/`, add an entry to `moduleRegistry.js`, populate `allowed_modules` for licensed tenants. The `arch:check` CI gate enforces that any module directory carrying schemas is registered.

There is **no** event bus, subscription model, plugin loader, or inheritance hierarchy between core and vertical modules. Cross-module behaviour (e.g. the construction `contracts` module posting to GL) uses the existing cross-module posting contract (ADR-0019), not a new mechanism.

Full rationale and trade-offs: [ADR-0028](./decisions/0028-vertical-module-architecture.md).

---

## 3. Feature Modules  [in-scope]

> Modules below are part of the Phase 1 base ERP core unless otherwise noted (see §1.1). Industry-vertical workflows — including construction — are layered as add-on modules in Phase 2 and beyond.

### 3.0 Module Taxonomy  [in-scope]

The May 2026 product scope review formalised the module taxonomy below. **Core modules** ship with every AXERRA instance; **vertical add-on modules** are licensed per tenant via `tenant.allowed_modules` (see ADR-0018 and ADR-0028).

#### 3.0.1 Core modules (ship with every instance)

| Module name | Notes |
| --- | --- |
| `system` | Auth, tenants, RBAC. Currently registered in [moduleRegistry.js](../apps/server/src/db/moduleRegistry.js) as `auth` (admin scope). |
| `system/core` | Vendors, clients, employees, companies. Currently registered as `core`. |
| `accounting` | General ledger, chart of accounts, journal entries, fiscal periods, bank reconciliation (via Plaid — see §3.15). Merged from the former `gl` and `accounting` skeletons. |
| `ap` | Accounts payable. |
| `ar` | Accounts receivable (milestone invoicing). Construction closing-statement workflow is documented in §3.8.4 and lives in the `contracts` vertical, not in `ar`. |
| `projects` | Projects and sub-projects. |
| `activities` | Cost tracking only. Deliverables move out to the new vertical `contracts` module (see §3.0.3). |
| `reports` | Reporting and analytics. |

All eight core modules above are either already registered in `moduleRegistry.js` (`auth`, `core`, `projects`, `activities`, `bom`, `accounting`, `ap`, `ar`, `reports`) or in scope for the same registry-based pattern. `bom` is registered today but is documented as a vertical add-on in §3.0.2 — it remains available to any tenant that licenses it.

#### 3.0.2 Vertical add-on modules

| Module name | Services | Construction | Production |
| --- | --- | --- | --- |
| `contracts` | ✓ | ✓ | ✓ |
| `timesheets` | ✓ | ✓ | — |
| `scheduling` | ✓ | ✓ | ✓ |
| `bom` | — | ✓ | ✓ |
| `procurement` | — | ✓ | ✓ |
| `inventory` | — | ✓ | ✓ |

Verticals are packaged per tenant. A consulting firm licensing the *services* vertical receives `contracts`, `timesheets`, and `scheduling`; a homebuilder licensing the *construction* vertical receives all six; a manufacturer licensing the *production* vertical receives `contracts`, `scheduling`, `bom`, `procurement`, and `inventory`.

Of the six listed, only `bom` is currently registered in `moduleRegistry.js`. The remaining five (`contracts`, `timesheets`, `scheduling`, `procurement`, `inventory`) are **planned** — they will be added to the registry when implemented.

#### 3.0.3 Module changes from the May 2026 review

- **`gl` → `accounting` merge.** The earlier `gl` module is absorbed into `accounting`. Both were skeleton-only at the time of the merge, so there is no data risk. Going forward, `accounting` is the single home for general ledger, chart of accounts, journal entries, fiscal periods, and bank reconciliation.
- **`activities` split.** Cost tracking stays in `activities`. Deliverables move to the new vertical `contracts` module, which is *not* part of the core. This keeps `activities` purely about cost while letting per-vertical contract semantics (services SOW deliverables, construction subdivision sales, production work orders) live where they belong.
- **Five new vertical modules** — `contracts`, `scheduling`, `timesheets`, `procurement`, `inventory`. Brief scope:
  - `contracts` — vertical-specific contract documents (services SOWs, construction subdivision sales / closing statements, production work orders).
  - `scheduling` — resource and crew scheduling.
  - `timesheets` — labour capture for services and construction.
  - `procurement` — purchase orders, vendor RFQs, expediting.
  - `inventory` — on-hand stock, lot/serial tracking, issues against projects.
- **Implementation pattern.** New modules follow the same wiring as core modules: implement the module, register it in [moduleRegistry.js](../apps/server/src/db/moduleRegistry.js), and populate `tenant.allowed_modules` for licensed tenants. Access is gated by [moduleEntitlement middleware](../apps/server/src/middleware/moduleEntitlement.js) per [ADR-0018](./decisions/0018-module-entitlement-middleware.md). **No event bus, no subscription wiring, no inheritance hierarchy.** Architecture detail: ADR-0028 and §2.5.

### 3.1 Authentication & Authorization (Core)  [in-scope]

#### 3.1.1 Authentication

**Login Flow:**

1. User submits email/password on `LoginPage`
2. Client calls `POST /api/auth/login` via `authApi.login()`
3. Server validates via Passport Local Strategy (bcrypt hash comparison against `admin.portal_users`)
4. Server resolves the user's **home tenant** via `admin.portal_user_tenants` binding (oldest active binding). Login is refused with *"Tenant is inactive."* if the home tenant is not active (see `passportService.js:54`; resolves gap 1.14, 2026-05-21).
5. Server loads RBAC permissions for the home tenant and **gates token issuance** on the result. A user with no usable permissions (no entity, no roles, or roles that resolve to no policies) is refused with 403 — credentials were valid but the account is unusable.
6. Server computes `ph` (permissions hash) from the resolved permission canon, signs `auth_token` (15min) and `refresh_token` (7-day) JWTs, and sets them as httpOnly cookies. The permission canon is primed into the Redis cache so the user's first authenticated request does not re-load.
7. Client calls `GET /api/auth/me` to hydrate user context.
8. `AuthContext` stores user state; `LayoutShell` guards authenticated routes.

**Endpoints:**

| Method   | Path                          | Purpose                                                                   |
| -------- | ----------------------------- | ------------------------------------------------------------------------- |
| `POST` | `/api/auth/login`           | Authenticate with email/password                                          |
| `POST` | `/api/auth/refresh`         | Rotate tokens (full rotation)                                             |
| `POST` | `/api/auth/logout`          | Clear auth cookies                                                        |
| `POST` | `/api/auth/change-password` | Change password (validates current password, enforces strength rules)     |
| `GET`  | `/api/auth/me`              | Get current user context, tenant, roles, permissions, impersonation state |
| `GET`  | `/api/auth/check`           | Lightweight session validation                                            |

**Token Claims:**

- `sub`: User UUID
- `ph`: Permissions hash for cache validation — computed at login from the user's loaded permission canon
- `iss`: Issuer (`'axerra-serv'`)
- `aud`: Audience (`'axerra-serv-api'`)

> **Note:** Authentication is against `admin.portal_users` which contains only identity/auth fields (`id`, `tenant_id`, `entity_type`, `entity_id`, `email`, `password_hash`, `status`). Tenant context (`tenant_code`, `schema_name`) and roles are resolved at request time by the `authRedis` middleware via HTTP headers, Redis cache, and database lookup — they are NOT embedded in the JWT. Roles are read from the entity record's `roles` text array (resolved via `entity_type` + `entity_id`), not from a column on `portal_users`.

**Client-Side Auth:**

- `AuthContext` provides `{ user, loading, login, logout, refreshUser, tenant, isRootTenantUser, assumedTenant, assumeTenant, exitAssumption, impersonation, startImpersonation, endImpersonation }` via React context, where `tenant` is `null` or `{ tenant_code, schema_name }` (when an assumption is active, `tenant` also includes `company` and `is_assumed: true`)
- `LayoutShell` renders loading spinner while `loading=true`, redirects to `/login` if `user=null`
- All API calls use `credentials: 'include'` for cookie transmission
- No tokens stored in localStorage — fully cookie-based

#### 3.1.2 Role-Based Access Control (RBAC)

> **ADR Reference:** [ADR-0013](./decisions/0013-four-layer-scoped-rbac.md) (supersedes [ADR-0004](./decisions/0004-three-level-rbac.md))

RBAC uses a four-layer model where each layer narrows what the previous layer grants. Layers 2-4 never expand access beyond what Layer 1 allows.

| Layer                        | Question               | Mechanism                                                          |
| ---------------------------- | ---------------------- | ------------------------------------------------------------------ |
| **1 — Role Policies** | What can this role DO? | `policies` table — `none`/`view`/`full` levels            |
| **2 — Data Scope**    | HOW MUCH data?         | `roles.scope` + `project_members` + `company_members` tables |
| **3 — State Filters** | Which record STATES?   | `state_filters` table                                            |
| **4 — Field Groups**  | Which COLUMNS?         | `field_group_definitions` + `field_group_grants` tables        |

**Layer 1 — Role Policies:**

- `roles`: Role definitions with `code`, `name`, `description` (optional), `is_system`, `is_immutable`, `scope` (`all_projects`, `assigned_companies`, `assigned_projects`, or `self`), plus `tenant_code`
- `policies`: Permission grants with `(role_id, module, router, action, level)` dimensions, plus `tenant_code`

> **Role Assignment:** Roles are stored as a `roles` text array directly on each entity table (employees, clients, vendor_contacts) — there is no `role_members` junction table. The permission loader reads the `roles` array from the entity record (resolved via `portal_users.entity_type` + `entity_id`), then queries `policies` for matching role IDs. A SQL view can reconstruct "members by role" across entity tables when needed for admin reporting.

**Layer 2 — Data Scope:**

- `project_members`: Maps `(project_id, user_id)` with a `role` label (e.g., `member`, `lead`). When `roles.scope = 'assigned_projects'`, only data from the user's assigned projects is visible.
- `company_members`: Maps `(company_id, user_id)`. When `roles.scope = 'assigned_companies'`, only data from projects belonging to the user's assigned companies is visible. The permission loader eagerly resolves both `companyIds` and corresponding `projectIds`.
- **`self` scope:** When `roles.scope = 'self'`, the permission loader reads `entity_type` and `entity_id` from `portal_users`. The canon includes `entityType` and `entityId`. `_applyRbacFilters()` maps the entity type to the appropriate FK column on the queried resource (e.g., `vendor_id` for AP invoices, `client_id` for AR invoices, `employee_id` for timecards). This enables portal access where vendors/clients see only their own records.
- `policy_catalog`: Registry of valid `(module, router, action)` combinations for role configuration UI discovery. Includes `label` (varchar(128), human-readable name), `description` (varchar(512), optional explanation), `sort_order` (integer, display ordering), `valid_statuses` (text[], valid status values for state filter UI), `available_fields` (text[], columns available for field group UI), and `policy_required` (boolean, default true — whether a policy must exist for this combination). Seed-only reference data — no audit fields, no tenant_code.

**Layer 3 — State Filters:**

- `state_filters`: `(role_id, module, router, visible_statuses[])`. Restricts which record statuses are visible per role per resource. Empty = no filtering (all statuses visible).

**Layer 4 — Field Groups:**

- `field_group_definitions`: Named column groups per resource — e.g., `(module, router, group_name, columns[], is_default)`.
- `field_group_grants`: Assigns field groups to roles. Definitions with `is_default = true` are granted to all roles automatically. Empty = all columns visible.

> **RBAC Schema Storage:** RBAC tables are defined with `dbSchema: 'public'` as a placeholder, but pg-schemata dynamically overrides the schema at bootstrap/migration time. Each tenant schema gets its own copy of all RBAC tables.

**Permission Levels (Layer 1):** `none` (0) < `view` (1) < `full` (2)

**Policy Resolution (most specific to least):**

1. `module::router::action` (e.g., `ar::ar-invoices::approve`)
2. `module::router::` (e.g., `ar::ar-invoices::`)
3. `module::::` (e.g., `ar::::`)
4. `::::` (empty-module wildcard — matches policies seeded with empty `module` for admin/super_user roles)
5. Default: `none`

**Exact-Match Carve-Out (`EXACT_MATCH_KEYS`, as of 2026-05-21):** Catalog entries with `policy_required: true` (the default for router-scoped actions) bypass the four-step fallback above and require an exact `module::router::action` grant. The set is derived at module load in `apps/server/src/middleware/rbac.js` from `CATALOG_ENTRIES` in `policyCatalogSeeder.js` (lines 27-37 explain the semantics). This keeps sensitive actions (password resets, approvals, etc.) out of router-level CRUD or wildcard grants — broader policies do NOT satisfy the check. Catalog rows with `policy_required: false` (e.g., most import actions, sub-record CRUD) continue to use the normal fallback resolver. See also `rules/rbac.md`.

**Multi-role Merge:**

- Layer 2 scope: most permissive wins — four-tier hierarchy: `all_projects` > `assigned_companies` > `assigned_projects` > `self`
- Layer 3 statuses: union of visible statuses across roles
- Layer 4 columns: union of granted columns across roles

**Built-in System Roles:**

All roles — including system roles — go through the full RBAC policy resolution. There are no bypass or short-circuit paths in the middleware.

- `super_user` (Axerra `axerra` schema only): Full access to all Axerra data + cross-tenant access + impersonation + tenant management. Seeded with `level: 'full'` policies for all modules plus cross-tenant and impersonation policies. Goes through full RBAC policy resolution — no bypass.
- `admin` (all tenant schemas): Full access within that tenant's data. Seeded with `level: 'full'` policies for all modules. Same meaning in every schema. Goes through full RBAC policy resolution — no bypass.
- `support` (Axerra `axerra` schema only): Cross-tenant access + impersonation + tenant management. No access to Axerra financial modules (accounting, AR, AP). Seeded with `level: 'none'` for financial modules + `level: 'full'` for non-financial modules + cross-tenant and impersonation policies. Goes through full RBAC policy resolution.

> **No RBAC Bypass:** The middleware does NOT short-circuit for `super_user` or `admin`. All users are authorized through the same entity `roles` array → `policies` resolution path. This ensures all access is auditable, configurable, and consistent.

**Seeded Tenant Roles:**

- `admin`: Tenant-level administrator, `scope: 'all_projects'`. Seeded with explicit `level: 'full'` policies for ALL modules. When new modules are added to the platform, the module migration seeds admin policies for all existing tenants (see Admin Policy Auto-Seeding below).

> **Note:** Only `admin`, `super_user`, and `support` are seeded by the system role seeder. Additional roles (e.g., `project_manager`, `controller`) are tenant-configurable and must be created by tenant admins via the ManageRolesPage UI.

**Axerra-Only Policies:** Cross-tenant and impersonation policies are ONLY seeded in the `axerra` schema on `super_user` and `support` roles. These policies cannot be assigned to other tenants' schemas.

**Tenant Configurability:** All roles except `super_user`, `admin`, and `support` are tenant-configurable. Tenants define their own roles, assign scopes, create state filters, and build field groups.

**Permission Canon (cached in Redis):**

- Canonical form: `{ caps, scope, projectIds, companyIds, entityType, entityId, stateFilters, fieldGroups }`
- Stored at `perm:{userId}:{tenantCode}`
- SHA-256 permission hash designed for JWT (`ph` claim) — computed at login from the user's loaded permission canon (Phase 3). `authRedis` re-computes the hash on every request from the loaded canon and sets `X-Token-Stale: 1` when the request's `ph` claim diverges (`apps/server/src/middleware/authRedis.js:198-200`). Client-side handling of the header is intended but not yet wired.
- `authRedis` middleware reads the `roles` array from the entity record (resolved via `portal_users.entity_type` + `entity_id`), then queries `policies` for matching role IDs — NOT from a `portal_users.role` column or `role_members` table
- `entityType` and `entityId` are included in the canon for `self` scope resolution

**Module Entitlements:**

- `admin.tenants.allowed_modules` (jsonb array of module names) controls which modules a tenant can access
- Enforced by middleware after auth and before RBAC: if `req.resource.module` is not in the tenant's `allowed_modules`, return 403
- Source of truth at request time: `moduleEntitlement` reads from `req.ctx.tenant.allowed_modules` (populated by `authRedis`). There is no separate Redis key for `allowed_modules`. (Reconciled per gaps 4.14 / 2.24, 2026-05-21.)
- Default: empty array (or missing field) means **all modules allowed** — this is an allow-when-unset policy, NOT a deny-by-default whitelist. Entitlement enforcement activates per-tenant as their `allowed_modules` arrays are populated. See ADR-0018.
- Managed by Axerra `super_user` / `support` via tenant management UI

**Enforcement:**

- **Module Entitlement (middleware):** `moduleEntitlement` is auto-applied by `createRouter` on all routes. Checks `tenants.allowed_modules` — if the tenant doesn't have the module enabled, returns 403 regardless of user permissions. Empty array means all modules allowed.
- **Layer 1 (opt-in middleware):** `withMeta({ module, router, action })` annotates `req.resource`. `rbac(requiredLevel)` can be explicitly added to routes that need per-action permission checks — it resolves the user's policy level from `caps` and returns 403 if insufficient. GET/HEAD default to `view`; mutations default to `full`. `createRouter` auto-applies `rbac()` on import/export routes: `rbac('full')` on `/import-xls` (with `setImportAction` overriding `req.resource.action = 'import'`) and `rbac('view')` on `/export-xls` (with `setExportAction` overriding `req.resource.action = 'export'`). For custom endpoints, `rbac()` is manually added (e.g., `employees/:id/reset-password`, `ar-invoices/approve`). Standard CRUD routes (POST, GET, PUT, DELETE, PATCH) from `createRouter` do **not** include `rbac()` — they rely on `moduleEntitlement` for access control. Permissions are resolved from entity `roles` array → `policies` for ALL users — no role-based bypass or short-circuit.
- **Layers 2-4 (service layer):** `ViewController._applyRbacFilters()` applies scope, state, and field filters. Controllers opt in via `this.rbacConfig = { module, router, scopeColumn, entityScopeColumns }`. The `entityScopeColumns` mapping tells the `self` scope which FK column to filter for each entity type (e.g., `{ vendor: 'vendor_id', client: 'client_id', employee: 'employee_id' }`).

**Policy Seeding by Role Class:**

Two mechanisms coexist by design. The choice is driven by whether the role is **idempotent** (its capability set is fixed and cannot change as new modules ship) or **module-sensitive** (its policies must grow when a new module is introduced).

*Idempotent roles — wildcard policy at seed time* `[implemented]`

Five system roles are idempotent and receive a single wildcard `level: 'full'` policy with `module: ''` (and the corresponding role-shaped scope rules) at tenant creation. Adding a new module does NOT require backfilling these roles — the wildcard already covers every module, present and future. Implementation: `apps/server/src/system/auth/services/systemRoleSeeder.js`.

| Role | Scope | Why idempotent |
| ---- | ----- | -------------- |
| `super_user`    | Cross-tenant, Axerra-only | Platform operator; always full access across every tenant. |
| `admin`         | All modules within their tenant | Always full access within the tenant; module set is irrelevant. |
| `support`       | Cross-tenant, Axerra-only, excluding `FINANCIAL_MODULES` | Capability set fixed by Axerra; module changes don't alter the contract. |
| `vendor_contact` | Vendor-shaped scope (their own vendor record + linked transactions) | Capability set fixed by the vendor-portal contract. |
| `client`        | Client-shaped scope (their own projects + linked AR records) | Capability set fixed by the client-portal contract. |

*Module-sensitive roles — per-module retroactive seeder* `[intended]`

All other roles — `accountant`, `ap_clerk`, `ar_clerk`, `project_manager`, `procurement`, `cfo`, and any tenant-defined custom role — receive explicit per-module policy rows. Each role's policies enumerate the (module, router, action, level) tuples it can perform; the wildcard mechanism above is not available because these roles must be denyable on a per-module basis.

When a new module ships, every existing tenant schema must be backfilled with the new module's policy rows for every module-sensitive role that already exists in that tenant. This retroactive seeder runs from the module's migration, walks `admin.tenants`, and inserts the per-(role, module) policy set into each tenant schema. New tenant provisioning calls the same seeder for every module currently enabled in the tenant's `allowed_modules`.

The retroactive seeder is NOT yet built. Tenants stood up before a module ships will lack policies for that module until the seeder lands; in the interim, tenant admins can add policies manually via the RBAC management endpoints. (Tracked via the `[intended]` status tag on this paragraph.)

**Policy-Catalog Carve-Outs:**

- `tenants::portal-users::import|export` are intentionally NOT seeded in the policy catalog. `portalUsersRouter` sets `disableImportXls: true` / `disableExportXls: true`, and `policyCatalogSeeder.js` omits the rows. Rationale: users are created via `/register` only — see §3.2.2.
- `tenants::tenants::import|export` ARE seeded and gate the tenant XLSX import/export routes (see §3.2.1).

**Policy-Catalog Reconciler & CLI:**

- `apps/server/src/system/core/services/policyCatalogReconciler.js` performs idempotent diff + apply between the in-code `CATALOG_ENTRIES` constant and the per-tenant `policy_catalog` table, so deployed tenants converge on the latest catalog without per-tenant manual reseeding.
- Migrations `202603270016_reseedPolicyCatalog.js` and `202605040018_reseedTenantImportExportCatalog.js` invoke the reconciler.
- CLI entry point: `apps/server/scripts/db/reconcilePolicyCatalog.js` — reseeds a single tenant or all tenants from the host shell. Useful when a hotfix changes the catalog without shipping a migration.

**RBAC Management Endpoints (tenant-scope, under `/api/core/v1/`):**

| Method        | Path                                     | Purpose                                                           |
| ------------- | ---------------------------------------- | ----------------------------------------------------------------- |
| Standard CRUD | `/api/core/v1/roles`                   | Manage tenant roles (code, name, scope, is_system, is_immutable)  |
| Standard CRUD | `/api/core/v1/policies`                | Manage per-role permission grants (module, router, action, level) |
| Standard CRUD | `/api/core/v1/policy-catalog`          | Read-only catalog of valid (module, router, action) combinations  |
| Standard CRUD | `/api/core/v1/state-filters`           | Manage Layer 3 state visibility filters per role/resource         |
| Standard CRUD | `/api/core/v1/field-group-definitions` | Manage Layer 4 named column groups per resource                   |
| Standard CRUD | `/api/core/v1/field-group-grants`      | Assign field groups to roles                                      |
| Standard CRUD | `/api/core/v1/project-members`         | Manage Layer 2 user↔project assignments                          |
| Standard CRUD | `/api/core/v1/company-members`         | Manage Layer 2 user↔company assignments                          |

> **Role Assignment:** Roles are managed via entity CRUD endpoints (update the `roles` array on the employee/vendor-contact/client/contact record). There is no separate `/role-members` endpoint.

> All RBAC management routes use `createRouter` with `withMeta({ module: 'core', router: '<resource>' })`. `policyCatalogRouter` uses `withMeta({ module: 'core', router: 'policy-catalog' })` — entitlement resolves against the `policy-catalog` resource. (Stale footnote claiming `router: 'roles'` removed per gap 4.7, 2026-05-21.)

**RBAC Management UI (`ManageRolesPage`):** The Manage Roles page at `/tenant/manage-roles` uses a master-detail layout. The left panel lists roles in a DataTable; the right panel has tabbed editors for the four RBAC layers:

| Tab               | Component                      | Purpose                                                                                                                                    |
| ----------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Policies          | `PolicyEditor`               | Accordion-based policy matrix — reads `policy_catalog` for structure, renders level selectors (none/view/full) per module/router/action |
| State Filters     | `StateFilterEditor`          | Configure Layer 3 status visibility filters per role/resource — restrict which record statuses a role can see                             |
| Field Groups      | `FieldGroupEditor`           | Toggle Layer 4 field group grants per role — displays all definitions grouped by module/router, admins toggle which groups are granted    |
| Field Definitions | `FieldGroupDefinitionEditor` | CRUD for field group definitions — create/edit/delete named column groups per resource                                                    |

Roles with `is_immutable = true` OR `is_system = true` are read-only across all detail tabs. Only `is_immutable` hides the row-level Edit action in the master list.

---

### 3.2 Tenant Management  [in-scope]

**Purpose:** Axerra operators manage customer organizations (tenants) and their users.

**Access Control:** Restricted to Axerra employees via `requireRootTenant` middleware.

**Root Tenant:** Axerra (tenant_code `AXERRA`) is the platform root tenant. It cannot be archived or deleted. The `super_user` and `support` system roles can only be assigned to users belonging to the Axerra tenant. The root tenant is created automatically during initial setup via the `202502110001_bootstrapAdmin` migration.

#### 3.2.1 Manage Tenants

**Data Model (`admin.tenants`):**

| Field               | Type         | Description                                                                        |
| ------------------- | ------------ | ---------------------------------------------------------------------------------- |
| `id`              | uuid         | Primary key                                                                        |
| `tenant_code`     | varchar(6)   | Unique short code (e.g.,`AXERRA`, `CAL`)                                       |
| `company`         | varchar(128) | Company name                                                                       |
| `schema_name`     | varchar(63)  | PostgreSQL schema name                                                             |
| `status`          | varchar(20)  | `active`, `trial`, `suspended`, `pending`                                  |
| `tier`            | varchar(20)  | `enterprise`, `growth`, `starter`                                            |
| `region`          | varchar(64)  | Geographic region                                                                  |
| `allowed_modules` | jsonb        | Module access list enforced by `moduleEntitlement` — empty array (or missing) means **all modules allowed** (allow-when-unset, NOT deny-by-default per ADR-0018). See §3.1.2. |
| `max_users`       | integer      | User limit (default 5)                                                             |
| `notes`           | text         | Internal notes                                                                     |

**Tenant Provisioning:**

- Raw `CREATE SCHEMA` DDL creates the new tenant schema
- Extensions (e.g., `pgcrypto`, `vector`) are created per-schema as needed
- `createMigrator` runs all pending migrations against the new schema (not `bootstrap()` or `MigrationManager`)
- Seed data (default roles, chart of accounts templates) is inserted via `bulkInsert()`
- **Admin User Creation:** Performed in a single transaction: (1) create an `employees` record in the tenant schema with `roles: ['admin']`, `is_app_user: true`, `is_primary_contact: true`, (2) create a `portal_users` login in `admin.portal_users` with `entity_type: 'employee'` and `entity_id` linking to the new employee. The employee must have `roles` assigned and `is_app_user = true` before the `portal_users` login is created. The admin employee is created with `code = NULL` because numbering is not yet configured; the code is backfilled when the tenant enables numbering via Settings (see §3.13.9).
- **CLI entry point:** `apps/server/scripts/db/provisionTenantCli.js` runs the same `provisionNewTenant` service from the host shell. Useful for headless bootstraps and tests that need a fresh tenant outside the HTTP flow.
- **Root-entity seeder (gap 2.18):** `apps/server/src/services/seedRootEntity.js` is invoked during initial Axerra setup to create the `super_user` employee record under the Axerra tenant schema and link it to the bootstrap portal_user. It is idempotent and safe to re-run.
- **Contact Designation:** Primary and billing contacts are designated via `employees.is_primary_contact` and `employees.is_billing_contact` flags — there is no `tenant_role` column on `portal_users`.

**UI Requirements:**

- Data grid displaying: Code, Tenant Name, Status, Tier, Region, Active columns
- Row selection with checkbox (single and multi-select)
- Module Bar actions: **Create Tenant**, **View Details**, **Edit Tenant**, **Archive**, **Restore**
- Status badge display with color coding
- Create tenant form includes admin user fields: first name, last name, email, and password (used to create the tenant's Administrator user and linked employee record)
- Pagination with configurable rows-per-page (powered by `findAfterCursor()`)
- Archive cascades to deactivate all currently-active associated `portal_users` (sets `deactivated_at`, `status = 'locked'`, and `updated_by`) — works for both `?id=` and `?tenant_code=` query params.
- The root tenant (Axerra, `AXERRA`) cannot be archived — server rejects the request with 403
- Restore reactivates the tenant only — users remain archived and must be individually restored by an admin
- **View Details dialog** (`maxWidth="md"`): displays tenant fields in a responsive 3-column grid of `FieldRow` components (label:value pairs). Fields: Code, Tier, Region, Status (rendered as `StatusBadge` chip), Max Users, Schema (monospace), Created, Updated, Notes (full-width). Below a divider, two `DataGrid` tables display **Primary Contacts** and **Billing Contacts** with Name, Email (mailto link), and Phone columns. Contact data is fetched via `useTenantContacts(tenantId)` hook.
- The Module Bar exposes **Import** and **Export** XLSX actions for the tenants list, mirroring the toolbar contract used by every other resource page (see ADR-0024).

**Endpoints:**

| Method     | Path                                     | Purpose                                                                                                                  |
| ---------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `POST`   | `/api/tenants/v1/tenants`              | Create tenant (provisions schema, creates employee with `roles: ['admin']` + portal_users login in single transaction) |
| `GET`    | `/api/tenants/v1/tenants`              | List tenants (cursor-based pagination)                                                                                   |
| `GET`    | `/api/tenants/v1/tenants/:id`          | Get tenant by ID                                                                                                         |
| `PUT`    | `/api/tenants/v1/tenants/update`       | Update tenant                                                                                                            |
| `DELETE` | `/api/tenants/v1/tenants/archive`      | Soft-delete tenant (cascades to users)                                                                                   |
| `PATCH`  | `/api/tenants/v1/tenants/restore`      | Restore archived tenant                                                                                                  |
| `GET`    | `/api/tenants/v1/tenants/:id/modules`  | Get tenant's allowed modules                                                                                             |
| `GET`    | `/api/tenants/v1/tenants/:id/contacts` | Get primary and billing contacts with phone/address (cross-schema query into tenant's employees)                         |
| `POST`   | `/api/tenants/v1/tenants/import-xls`   | Import tenants from XLSX (requires `tenants::tenants::import` = `full`). Each row carries its own `tenant_code`. Rows without an `id` trigger a **full per-row `provisionNewTenant` call** (schema create, migrations, RBAC seed, admin portal user creation). Rows with an `id` are treated as updates. Supports `previewOnly=true` for upfront validation (per-row required-field / format / password-strength checks, intra-file duplicate detection, cross-table uniqueness against `admin.tenants` + `admin.portal_users`, ROOT_TENANT archive protection) without writes. See `apps/server/src/system/auth/models/Tenants.js`. |
| `POST`   | `/api/tenants/v1/tenants/export-xls`   | Export tenants to XLSX (requires `tenants::tenants::export` = `view`)                                                    |

#### 3.2.2 Manage Users

**Data Model (`admin.portal_users`):**

`portal_users` is a pure identity/authentication table. All personal information (name, phone, address) lives on the linked entity record (employee, vendor, vendor contact, client, or contact) in the tenant schema. The link is polymorphic via `entity_type` + `entity_id`. Roles are stored as a `roles` text array on the entity record — there is no `role` column on `portal_users` and no `role_members` junction table.

| Field             | Type         | Description                                                                                                 |
| ----------------- | ------------ | ----------------------------------------------------------------------------------------------------------- |
| `id`            | uuid         | Primary key                                                                                                 |
| `tenant_id`     | uuid         | FK to tenants                                                                                               |
| `entity_type`   | varchar(16)  | Entity kind:`'employee'`, `'vendor_contact'`, `'client'`                                              |
| `entity_id`     | uuid         | Cross-schema reference to the tenant-schema entity record (not a database FK — enforced by business logic) |
| `email`         | varchar(128) | Login identifier, globally unique (partial index WHERE deactivated_at IS NULL)                              |
| `password_hash` | text         | bcrypt hash (never returned in API responses)                                                               |
| `status`        | varchar(20)  | `active`, `invited`, `locked`                                                                         |

Partial unique index: `(entity_type, entity_id) WHERE deactivated_at IS NULL` — prevents duplicate logins for the same entity.

> **`portal_users.tenant_id`** is a convenience pointer to the user's **home** tenant. It is **not** the authoritative cross-tenant access list — see `admin.portal_user_tenants` below.

**Data Model (`admin.portal_user_tenants`):**

`portal_user_tenants` is the authoritative cross-tenant binding table. One row per `(portal_user, tenant)` pair the user can access. The oldest active row is the user's **home tenant** (resolved at login).

| Field            | Type         | Description                                                                                              |
| ---------------- | ------------ | -------------------------------------------------------------------------------------------------------- |
| `id`             | uuid         | Primary key                                                                                              |
| `portal_user_id` | uuid         | FK to `admin.portal_users` (CASCADE)                                                                     |
| `tenant_id`      | uuid         | FK to `admin.tenants` (CASCADE)                                                                          |
| `entity_type`    | varchar(16)  | `'employee'`, `'vendor_contact'`, `'client'`, or NULL for bare registrations                             |
| `entity_id`      | uuid         | Cross-schema reference to the tenant-scoped entity record (NULL for bare registrations)                  |
| `status`         | varchar(20)  | `'active'`, `'invited'`, `'locked'`                                                                      |

Indexes:

- Partial unique `(portal_user_id, tenant_id) WHERE deactivated_at IS NULL` — at most one active binding per user per tenant.
- Partial unique `(tenant_id, entity_type, entity_id) WHERE deactivated_at IS NULL AND entity_type IS NOT NULL` — preserves the "exactly one active portal_user per tenant-scoped entity" invariant.
- Supporting indexes on `portal_user_id`, `tenant_id`, `(entity_type, entity_id)`.

**Roles for the cross-tenant model:**

- Employees and clients have exactly one active binding (their home tenant).
- Vendor contacts may have one binding per tenant they service.
- The login flow resolves the home tenant by oldest active binding and refuses login if the home tenant is inactive (see §3.1.1).
- Cross-tenant requests (Axerra support / impersonation) use the `x-tenant-code` header to select a different active binding at request time.

> **Removed from portal_users:** `tenant_code`, `user_name`, `full_name`, `tax_id`, `notes`, `role`, `tenant_role`, `employee_id`. The `employee_id` column has been replaced by the polymorphic `entity_type` + `entity_id` pair, supporting logins for employees, vendors, clients, and contacts. User identity data lives on the entity record. Roles are stored as a `roles` text array on the entity record (not in a `role_members` junction table). Contact designation (primary/billing) is via `employees.is_primary_contact` / `is_billing_contact`. The `axe_admin_phones` and `axe_admin_addresses` tables have been removed — phone numbers and addresses are stored on the linked entity via the polymorphic `sources` → `phone_numbers` / `addresses` pattern.

**Access Control:** All portal-users routes are gated by `requireRootTenant` middleware and `withMeta({ module: 'tenants', router: 'portal-users' })`. `rbac()` IS applied per-method via the `portalUsersRouter` middleware arrays — `rbac('view')` on GET, `rbac('full')` on POST `/register`, PUT, DELETE, and PATCH. Spreadsheet import/export are disabled at the router (`disableImportXls: true`, `disableExportXls: true`), and the policy catalog intentionally does NOT seed `tenants::portal-users::import|export` — users are created via `/register` only (see permission-catalog cross-reference in §3.1.2).

**Endpoints:**

| Method     | Path                                      | Purpose                                                                                                                               |
| ---------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `POST`   | `/api/tenants/v1/portal-users/register` | Register new user (accepts `tenant_code`, `email`, `password`; validates tenant is active)                                      |
| `GET`    | `/api/tenants/v1/portal-users`          | List users                                                                                                                            |
| `GET`    | `/api/tenants/v1/portal-users/:id`      | Get user by ID                                                                                                                        |
| `PUT`    | `/api/tenants/v1/portal-users/update`   | Update user                                                                                                                           |
| `DELETE` | `/api/tenants/v1/portal-users/archive`  | Soft-delete user — sets `status = 'locked'` and `deactivated_at`, cascades to archive linked entity (prevents self-archival)     |
| `PATCH`  | `/api/tenants/v1/portal-users/restore`  | Restore user — sets `status = 'active'` and clears `deactivated_at`, cascades to restore linked entity (checks tenant is active) |

**Business Rules:**

- Standard POST is disabled; users must be created via the `/register` endpoint
- Spreadsheet import/export is **not** supported on `portal-users`. `portalUsersRouter` sets `disableImportXls: true` and `disableExportXls: true`, and `policyCatalogSeeder` does not emit `tenants::portal-users::import|export` rows. Users are created via `/register` only.
- Registration collects: `tenant_code`, `email`, `password`. Validates the tenant exists and is active. Entity linkage (`entity_type`, `entity_id`) and entity pre-validation (roles assigned, `is_app_user = true`) are not yet enforced — these fields can be set via subsequent update
- Password automatically hashed with bcrypt on registration
- Email must be globally unique across all active users (enforced by partial unique index WHERE deactivated_at IS NULL)
- Users cannot archive themselves (checked by both `id` and `email`)
- Archiving a user sets `status = 'locked'` (in addition to `deactivated_at`) and cascades to soft-delete the linked entity record (employee/vendor/client/contact) in the tenant schema via `entity_type` + `entity_id`
- Restoring a user sets `status = 'active'`, clears `deactivated_at`, and cascades to restore the linked entity record in the tenant schema
- Restoring a user requires the parent tenant to be active — returns 403 if the tenant is deactivated
- Axerra membership is determined by `tenant_code` comparison: server uses `requireRootTenant` middleware (checks `req.user.tenant_code` against `ROOT_TENANT_CODE` env var); client uses `isRootTenantUser` computed flag in `AuthContext` (checks `tenant_code` against `VITE_ROOT_TENANT_CODE`)

#### 3.2.3 Admin Operations

**Endpoints:**

| Method   | Path                                           | Purpose                                                   |
| -------- | ---------------------------------------------- | --------------------------------------------------------- |
| `GET`  | `/api/tenants/v1/admin/schemas`              | List all active tenants (Axerra users only)               |
| `POST` | `/api/tenants/v1/admin/impersonate`          | Start impersonation session (requires `target_user_id`) |
| `POST` | `/api/tenants/v1/admin/exit-impersonation`   | End active impersonation session                          |
| `GET`  | `/api/tenants/v1/admin/impersonation-status` | Check current impersonation state                         |

**Cross-tenant access:** Axerra users send `x-tenant-code` header to switch tenant context — handled by `authRedis` middleware, no dedicated endpoint needed. See [BR-RBAC-043](./rules/rbac.md#br-rbac-043).

**Orphan portal-users:**

Bare `admin.portal_users` rows (no active `portal_user_tenants` binding and no tenant-schema entity) are surfaced and cleaned up via a dedicated admin router. Implementation under `apps/server/src/system/tenants/{controllers/orphanPortalUsersController.js, apiRoutes/v1/orphanPortalUsersRouter.js}`; SQL functions `admin.find_orphan_portal_users(p_limit)`, `admin.count_orphan_portal_users()`, and `admin.cleanup_orphan_portal_user(id)` are installed by migration `202605010001_orphanPortalUsersCleanup.js`.

| Method | Path                                                       | Purpose                                                                                         |
| ------ | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `GET`  | `/api/tenants/v1/orphan-portal-users/orphans/preview`      | Preview up to N orphan rows + the total backlog count. Action `find_orphans` (set via `withMeta`).   |
| `POST` | `/api/tenants/v1/orphan-portal-users/orphans/cleanup`      | Hard-delete a single orphan portal_user by id (transactional). Action `cleanup_orphans` (set via `withMeta`). |

**Platform Maintenance UI:** `apps/client/src/pages/Tenant/PlatformMaintenancePage.jsx` (mounted under the Tenant admin nav group, Axerra-only) renders one card per maintenance operation. Orphan-portal-users find / cleanup is the first card; additional cross-tenant hygiene tools land here as separate cards. (Documented per gap 2.14, 2026-05-21.)

**Impersonation Implementation:**

- Audit trail: `admin.impersonation_logs` table records `impersonator_id`, `target_user_id`, `target_tenant_code`, `reason`, `started_at`, `ended_at`
- Session state: active impersonation stored in Redis at `imp:{userId}` with TTL
- Session uniqueness: partial unique index on `impersonation_logs (impersonator_id) WHERE ended_at IS NULL` prevents concurrent sessions; attempting a second session returns `409 Conflict`
- `authRedis` middleware detects active impersonation via Redis key and swaps `req.user` to the target user, setting `req.user.is_impersonating = true` and `req.user.impersonated_by`
- `/auth/me` response includes `impersonation: { active, impersonated_by }` for client-side UI state
- See [BR-RBAC-044](./rules/rbac.md#br-rbac-044), [BR-RBAC-048](./rules/rbac.md#br-rbac-048)

---

### 3.3 Core Entities  [in-scope]

**Purpose:** Shared reference data used across all modules — vendors, clients, employees, contacts, addresses, phone numbers, and intercompany entities.

#### 3.3.1 Vendors

| Field               | Type         | Description                    |
| ------------------- | ------------ | ------------------------------ |
| `id`              | uuid         | PK                             |
| `tenant_id`       | uuid         | Not null                       |
| `source_id`       | uuid         | FK to sources (CASCADE)        |
| `name`            | varchar(128) | Not null                       |
| `code`            | varchar(16)  | Unique per tenant              |
| `payment_term_id` | uuid         | FK to payment_terms (SET NULL) |
| `is_active`       | boolean      | Default true                   |
| `notes`           | text         | Internal notes                 |

**Endpoint:** `/api/core/v1/vendors`

#### 3.3.1a Vendor Contacts

| Field           | Type        | Description                                                                                                     |
| --------------- | ----------- | --------------------------------------------------------------------------------------------------------------- |
| `id`          | uuid        | PK                                                                                                              |
| `tenant_id`   | uuid        | Not null                                                                                                        |
| `vendor_id`   | uuid        | FK to vendors (CASCADE)                                                                                         |
| `source_id`   | uuid        | FK to sources (CASCADE)                                                                                         |
| `first_name`  | varchar(64) | Not null                                                                                                        |
| `last_name`   | varchar(64) | Not null                                                                                                        |
| `position`    | varchar(64) | Job title                                                                                                       |
| `department`  | varchar(64) | Department                                                                                                      |
| `is_app_user` | boolean     | Default false. Must be true before a `portal_users` login can be created. Requires `roles` to be non-empty. |
| `roles`       | text[]      | RBAC role codes assigned to this vendor contact (default `'{}'`). References `roles.code`.                  |
| `is_primary`  | boolean     | Default false. Marks primary contact for the vendor.                                                            |

Each vendor contact gets its own `sources` record (with `source_type = 'vendor_contact'`) for linked emails and phone numbers via the polymorphic sources pattern.

**Endpoint:** `/api/core/v1/vendor-contacts`

**UI affordance:** `VendorContactsPanel.jsx` + `ContactFormDialog.jsx` (under `apps/client/src/pages/Core/vendors/`) render inside the Vendor edit dialog and provide create/edit/archive for the vendor's contacts. Standard XLSX import/export are wired at the router level (the router auto-applies `rbac('full')` on `/import-xls` and `rbac('view')` on `/export-xls`); a top-level Vendor Contacts page is intentionally not part of §4.6.3 today — import/export is driven from the parent Vendor panel. (Documented per gaps 2.3 / 2.16, 2026-05-21.)

#### 3.3.1b Payment Terms

| Field         | Type        | Description                                                   |
| ------------- | ----------- | ------------------------------------------------------------- |
| `id`        | uuid        | PK                                                            |
| `tenant_id` | uuid        | Not null                                                      |
| `label`     | varchar(64) | Not null. Human-readable label (e.g. "Net 30", "2/10 Net 30") |
| `term`      | integer     | Not null, default 30. The numeric value of the payment term   |
| `units`     | varchar(16) | Not null, default `'days'`. CHECK: `days` or `months`   |
| `is_active` | boolean     | Default true                                                  |

**Endpoint:** `/api/core/v1/payment-terms`

#### 3.3.2 Clients

| Field           | Type         | Description                                                                                                     |
| --------------- | ------------ | --------------------------------------------------------------------------------------------------------------- |
| `id`          | uuid         | PK                                                                                                              |
| `tenant_id`   | uuid         | Not null                                                                                                        |
| `source_id`   | uuid         | FK to sources (CASCADE)                                                                                         |
| `name`        | varchar(128) | Not null                                                                                                        |
| `code`        | varchar(16)  | Unique per tenant                                                                                               |
| `roles`       | text[]       | RBAC role codes assigned to this client (default `'{}'`). References `roles.code`.                          |
| `is_app_user` | boolean      | Default false. Must be true before a `portal_users` login can be created. Requires `roles` to be non-empty. |
| `is_active`   | boolean      | Default true                                                                                                    |

> **Email storage:** Client email addresses live in the polymorphic `emails` table (see §3.3.4 / §3.14.1) keyed by the client's `source_id`. There is no `email` column on `clients`. (Reconciled per gap 3.12 / 4.11, 2026-05-21.)

**Endpoint:** `/api/core/v1/clients`

#### 3.3.3 Employees

| Field                  | Type         | Description                                                                                                        |
| ---------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------ |
| `id`                 | uuid         | PK                                                                                                                 |
| `tenant_id`          | uuid         | Not null                                                                                                           |
| `source_id`          | uuid         | FK to sources (CASCADE)                                                                                            |
| `first_name`         | varchar(64)  | Not null                                                                                                           |
| `last_name`          | varchar(64)  | Not null                                                                                                           |
| `code`               | varchar(16)  | Unique per tenant                                                                                                  |
| `position`           | varchar(64)  | Job title                                                                                                          |
| `department`         | varchar(64)  | Department                                                                                                         |
| `roles`              | text[]       | RBAC role codes assigned to this employee (default `'{}'`). References `roles.code`.                           |
| `is_app_user`        | boolean      | Default false. Must be true before a `portal_users` login can be created. Requires `roles` to be non-empty.    |
| `is_primary_contact` | boolean      | Default false. Designates this employee as the tenant's primary contact.                                           |
| `is_billing_contact` | boolean      | Default false. Designates this employee as the tenant's billing contact.                                           |

> **Email storage:** Employee email addresses live in the polymorphic `emails` table (see §3.3.4 / §3.14.1) keyed by the employee's `source_id`. There is no `email` column on `employees`; the per-tenant uniqueness invariant is enforced on `emails` instead. (Reconciled per gap 3.11 / 4.11, 2026-05-21.)

> **Soft Delete:** Employees use the `deactivated_at` column (via pg-schemata `softDelete: true`) — there is no `is_active` boolean column. Vendors, clients, and contacts have BOTH `is_active` (boolean) AND `deactivated_at` (via `softDelete: true`) — a dual active/inactive mechanism. `is_active` is a user-facing toggle; `deactivated_at` is the pg-schemata soft-delete marker that filters records from read queries.

> **Contact Designation:** Both `is_primary_contact` and `is_billing_contact` can be true on the same employee (e.g., small company owner is both primary and billing contact). Multiple employees can share the same flag. These flags replace the former `portal_users.tenant_role` designation. When the primary contact leaves the tenant (deactivated), the tenant's account executive is responsible for designating a new primary contact.

**Edit Dialog:** The employee edit dialog (`maxWidth="md"`) includes phone number and address management sections below the employee fields. Phone numbers are rendered as repeatable inline rows (type select, number, is_primary checkbox, delete). Addresses are rendered as bordered cards with a 2-column grid of address fields. Changes are diffed and persisted via the polymorphic `sources` → `phone_numbers` / `addresses` pattern.

**App-user provisioning libs:** Shared helpers under `apps/server/src/lib/` coordinate the employee ↔ portal_user lifecycle:

- `loginEmailSync.js` — keeps `portal_users.email` in sync with the entity's `is_login` email row in the `emails` table.
- `employeeAppUserSync.js` — drives the provision / archive / restore branches when `employees.is_app_user` toggles (mirrored for clients and vendor_contacts).
- `clearOtherPrimary.js` — enforces single-primary invariants on `is_primary_contact` / `is_billing_contact`.
- `employeeRoleValidator.js` — rejects `is_app_user = true` saves where `roles` is empty.

**Endpoints:**

| Method        | Path                                          | Purpose                                                                    |
| ------------- | --------------------------------------------- | -------------------------------------------------------------------------- |
| Standard CRUD | `/api/core/v1/employees`                    | List, get, create, update, archive, restore                                |
| `GET`       | `/api/core/v1/employees/:id/source-id`      | Resolve the polymorphic source record for phone/address lookups            |
| `POST`      | `/api/core/v1/employees/:id/reset-password` | Admin-initiated password reset for an employee's linked portal_users login |

#### 3.3.4 Polymorphic Sources, Contacts, Addresses & Phone Numbers

The `sources` table implements a **discriminated union** pattern linking vendors, clients, employees, and contacts to shared addresses and phone numbers:

**Sources:**

| Field           | Type        | Description                                                                        |
| --------------- | ----------- | ---------------------------------------------------------------------------------- |
| `id`          | uuid        | PK                                                                                 |
| `tenant_id`   | uuid        | Not null                                                                           |
| `table_id`    | uuid        | References the parent entity                                                       |
| `source_type` | varchar(32) | `vendor`, `vendor_contact`, `client`, `employee`, `contact`, `company` |
| `label`       | varchar(64) | Human-friendly label                                                               |

**Contacts (First-Class Entity — Miscellaneous Payees):**

Contacts are standalone first-class entities representing miscellaneous payees and receivable counterparties that don't fall into vendor, client, or employee categories — e.g., one-off commission payments, charitable donations, or ad-hoc income sources. Contacts are dual-purpose (usable in both AP and AR modules) and cannot log in (no RBAC):

| Field         | Type         | Description             |
| ------------- | ------------ | ----------------------- |
| `id`        | uuid         | PK                      |
| `tenant_id` | uuid         | Not null                |
| `source_id` | uuid         | FK to sources (CASCADE) |
| `name`      | varchar(128) | Not null                |
| `code`      | varchar(16)  | Unique per tenant       |
| `is_active` | boolean      | Default true            |

> **Note:** Contacts use the polymorphic `sources` pattern (with `source_type = 'contact'`) for linked emails, addresses, phone numbers, and tax identifiers, just like vendors, clients, and employees. Contacts cannot be app users and have no RBAC roles.

**Addresses:**

| Field              | Type         | Description                                                   |
| ------------------ | ------------ | ------------------------------------------------------------- |
| `id`             | uuid         | PK                                                            |
| `tenant_id`      | uuid         | Not null, immutable                                           |
| `source_id`      | uuid         | FK to sources (CASCADE), not null                             |
| `label`          | varchar(32)  | `billing`, `physical`, `mailing`                        |
| `address_line_1` | varchar(255) | Street address or P.O. Box                                    |
| `address_line_2` | varchar(255) | Apt, suite, unit, building, floor, etc.                       |
| `address_line_3` | varchar(255) | Additional line (international addresses)                     |
| `city`           | varchar(128) | City / locality / town                                        |
| `state_province` | varchar(128) | State, province, region, prefecture, county                   |
| `postal_code`    | varchar(20)  | ZIP / postal code (supports all global formats)               |
| `country_code`   | char(2)      | ISO 3166-1 alpha-2 country code (e.g.,`US`, `GB`, `JP`) |
| `is_primary`     | boolean      | Primary address flag                                          |

**Phone Numbers:**

| Field            | Type        | Description                                                                           |
| ---------------- | ----------- | ------------------------------------------------------------------------------------- |
| `id`           | uuid        | PK                                                                                    |
| `tenant_id`    | uuid        | Not null, immutable                                                                   |
| `source_id`    | uuid        | FK to sources (CASCADE), not null                                                     |
| `phone_type`   | varchar(16) | `cell`, `work`, `home`, `fax`, `other` (default `cell`)                   |
| `country_code` | char(2)     | ISO 3166-1 alpha-2 country code (default `US`) — used to derive the dialing prefix |
| `phone_number` | varchar(32) | Not null                                                                              |
| `is_primary`   | boolean     | Default false                                                                         |

> **Note:** Phone numbers are available to vendors, clients, employees, and contacts via the polymorphic `sources` pattern.

> **Global Address Best Practices:** The `addresses` table follows an internationally flexible schema:
>
> - Three address lines accommodate any country's format without rigid field assumptions
> - `state_province` is a generic region field (US states, UK counties, Japanese prefectures, etc.)
> - `country_code` uses ISO 3166-1 alpha-2 for reliable lookup and localization
> - `postal_code` as varchar(20) covers all known formats (US ZIP+4, UK postcodes, etc.)
> - **Mailing label generation:** Concatenate non-empty address lines, then `city + state_province + postal_code` on one line, then country name (resolved from `country_code`). Country-specific formatting rules (e.g., Japanese address order reversal) can be applied via a locale-aware formatter.

**Tax Identifiers:**

Tax identification is handled by a dedicated `tax_identifiers` table linked via the polymorphic `sources` pattern, replacing the former `tax_id` column on entity tables:

| Field            | Type        | Description                                |
| ---------------- | ----------- | ------------------------------------------ |
| `id`           | uuid        | PK                                         |
| `tenant_id`    | uuid        | Not null, immutable                        |
| `source_id`    | uuid        | FK to sources (CASCADE), not null          |
| `country_code` | char(2)     | ISO country code, not null                 |
| `tax_type`     | varchar(16) | e.g.,`EIN`, `SSN`, `VAT` — not null |
| `tax_value`    | varchar(64) | Tax identifier value, not null             |
| `is_primary`   | boolean     | Default false                              |

Unique constraint: `(source_id, country_code, tax_type) WHERE deactivated_at IS NULL`

**Endpoints:** `/api/core/v1/sources`, `/api/core/v1/contacts`, `/api/core/v1/addresses`, `/api/core/v1/phone-numbers`, `/api/core/v1/tax-identifiers`, `/api/core/v1/emails`

**Editable sections (client, as of 2026-05-21, gap 2.13):** Each entity edit dialog composes shared read/write components from `apps/client/src/components/shared/`: `EditableEmailsSection` / `EmailsSection` / `EmailRow`, `EditablePhoneNumbersSection` / `PhoneNumbersSection` / `PhoneRow`, `EditableAddressesSection` / `AddressesSection`, and `EditableTaxIdentifiersSection` / `TaxIdentifiersSection`. The Editable variants diff against the original state and persist add / update / archive against the polymorphic `sources` → child-table pattern.

#### 3.3.5 Companies

| Field         | Type         | Description                                       |
| ------------- | ------------ | ------------------------------------------------- |
| `id`        | uuid         | PK                                                |
| `tenant_id` | uuid         | Not null                                          |
| `source_id` | uuid         | FK to sources (CASCADE)                           |
| `code`      | varchar(16)  | Unique company code, required (not auto-numbered) |
| `name`      | varchar(128) | Company name                                      |
| `is_active` | boolean      | Default true                                      |

**Endpoint:** `/api/core/v1/companies`

---

### 3.4 Project Management  [in-scope]

**Purpose:** Manage construction projects, units (deliverables), tasks, cost items, and change orders. Supports template-based project creation.

#### 3.4.1 Projects

**Data Model:**

| Field               | Type          | Description                                                                                     |
| ------------------- | ------------- | ----------------------------------------------------------------------------------------------- |
| `id`              | uuid          | PK                                                                                              |
| `tenant_id`       | uuid          | Not null                                                                                        |
| `company_id`      | uuid          | FK to companies (RESTRICT)                                                                      |
| `address_id`      | uuid          | FK to addresses (SET NULL)                                                                      |
| `project_code`    | varchar(32)   | Unique per tenant                                                                               |
| `name`            | varchar(255)  | Project name                                                                                    |
| `description`     | text          | Description                                                                                     |
| `notes`           | text          | Internal notes                                                                                  |
| `status`          | varchar(20)   | `planning` -> `budgeting` -> `released` -> `complete` (CHECK also includes `on_hold`) |
| `contract_amount` | numeric(14,2) | Total contract value from client (for profitability)                                            |

**Endpoint:** `/api/projects/v1/projects`

**Project Clients (Junction Table):**

Associates multiple clients with a project contract. Replaces the former single `client_id` FK on projects.

| Field          | Type        | Description                                 |
| -------------- | ----------- | ------------------------------------------- |
| `id`         | uuid        | PK                                          |
| `project_id` | uuid        | FK to projects (CASCADE)                    |
| `client_id`  | uuid        | FK to clients (RESTRICT)                    |
| `role`       | varchar(32) | e.g.,`buyer`, `co-buyer`, `guarantor` |
| `is_primary` | boolean     | Primary client on the contract              |

Unique constraint: `(project_id, client_id)`

**Endpoint:** `/api/projects/v1/project-clients`

#### 3.4.2 Units

| Field                | Type         | Description                               |
| -------------------- | ------------ | ----------------------------------------- |
| `id`               | uuid         | PK                                        |
| `project_id`       | uuid         | FK to projects (CASCADE)                  |
| `template_unit_id` | uuid         | FK to template_units (SET NULL)           |
| `version_used`     | integer      | Template version used                     |
| `name`             | varchar(128) | Unit name                                 |
| `unit_code`        | varchar(32)  | Unique per project                        |
| `status`           | varchar(20)  | `draft` -> `released` -> `complete` |

**Endpoint:** `/api/projects/v1/units`

#### 3.4.3 Tasks & Task Groups

**Task Groups:**

| Field           | Type        | Description               |
| --------------- | ----------- | ------------------------- |
| `id`          | uuid        | PK                        |
| `tenant_id`   | uuid        | Not null, immutable       |
| `code`        | varchar(16) | Unique per tenant         |
| `name`        | varchar(64) | Group name                |
| `description` | text        | Description               |
| `sort_order`  | integer     | Display order (default 0) |

**Tasks Master (Library):**

| Field                     | Type         | Description                                                                                                          |
| ------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------- |
| `id`                    | uuid         | PK                                                                                                                   |
| `tenant_id`             | uuid         | Not null, immutable                                                                                                  |
| `code`                  | varchar(16)  | Unique per tenant                                                                                                    |
| `task_group_code`       | varchar(16)  | Composite FK `(tenant_id, task_group_code)` → `task_groups(tenant_id, code)` added via ALTER TABLE in migration |
| `name`                  | varchar(128) | Task name                                                                                                            |
| `default_duration_days` | integer      | Default duration                                                                                                     |

**Tasks (Unit-level instances):**

| Field              | Type         | Description                                                                      |
| ------------------ | ------------ | -------------------------------------------------------------------------------- |
| `id`             | uuid         | PK                                                                               |
| `unit_id`        | uuid         | FK to units (CASCADE)                                                            |
| `task_code`      | varchar(16)  | Reference to master task                                                         |
| `name`           | varchar(128) | Task name                                                                        |
| `duration_days`  | integer      | Duration                                                                         |
| `status`         | varchar(20)  | `pending` -> `in_progress` -> `complete` (CHECK also includes `on_hold`) |
| `parent_task_id` | uuid         | Self-referential for hierarchy                                                   |

**Endpoints:** `/api/projects/v1/tasks`, `/api/projects/v1/task-groups`, `/api/projects/v1/tasks-master`

#### 3.4.4 Cost Items

| Field           | Type          | Description                                                        |
| --------------- | ------------- | ------------------------------------------------------------------ |
| `id`          | uuid          | PK                                                                 |
| `task_id`     | uuid          | FK to tasks (CASCADE)                                              |
| `item_code`   | varchar(16)   | Cost item code                                                     |
| `description` | varchar(255)  | Description                                                        |
| `cost_class`  | varchar(16)   | `labor`, `material`, `subcontract`, `equipment`, `other` |
| `cost_source` | varchar(16)   | `budget`, `change_order`                                       |
| `quantity`    | numeric(12,4) | Quantity                                                           |
| `unit_cost`   | numeric(12,4) | Unit cost                                                          |
| `amount`      | numeric(12,2) | **GENERATED** (quantity * unit_cost)                         |

**Endpoint:** `/api/projects/v1/cost-items`

#### 3.4.5 Change Orders

| Field            | Type          | Description                                               |
| ---------------- | ------------- | --------------------------------------------------------- |
| `id`           | uuid          | PK                                                        |
| `unit_id`      | uuid          | FK to units (CASCADE)                                     |
| `co_number`    | varchar(16)   | Change order number                                       |
| `title`        | varchar(128)  | Title                                                     |
| `reason`       | text          | Justification                                             |
| `status`       | varchar(20)   | `draft` -> `submitted` -> `approved` / `rejected` |
| `total_amount` | numeric(12,2) | Total change amount                                       |

**Business Rules:**

- Change order lines reference base `cost_line_id` when modifying existing scope
- Approved change orders adjust remaining budget and variance metrics
- Negative quantities/costs represent scope reductions
- Posting fires GL hooks with explicit references

**Endpoint:** `/api/projects/v1/change-orders`

#### 3.4.6 Templates

Templates serve as reusable blueprints for project creation:

- **Template Units**: Blueprint for units with `name`, `version`, `status` (draft/active)
- **Template Tasks**: Blueprint tasks with `task_code`, `name`, `duration_days`, `parent_code` hierarchy
- **Template Cost Items**: Blueprint cost items with cost class, source, quantity, unit cost, and generated amount
- **Template Change Orders**: Blueprint change orders

**Endpoints:** `/api/projects/v1/template-units`, `/api/projects/v1/template-tasks`, `/api/projects/v1/template-cost-items`, `/api/projects/v1/template-change-orders`

---

### 3.5 Activities & Cost Management  [in-scope]

**Purpose:** Categorical cost tracking with deliverables, budgets, cost lines, actual costs, and change orders.

#### 3.5.1 Categories & Activities

**Categories:**

| Field    | Type        | Description                                                        |
| -------- | ----------- | ------------------------------------------------------------------ |
| `id`   | uuid        | PK                                                                 |
| `code` | varchar(16) | Unique code                                                        |
| `name` | varchar(64) | Category name (e.g., "Framing", "Plumbing")                        |
| `type` | varchar(16) | `labor`, `material`, `subcontract`, `equipment`, `other` |

**Activities:**

| Field           | Type        | Description                |
| --------------- | ----------- | -------------------------- |
| `id`          | uuid        | PK                         |
| `category_id` | uuid        | FK to categories (CASCADE) |
| `code`        | varchar(16) | Unique activity code       |
| `name`        | varchar(64) | Activity name              |
| `is_active`   | boolean     | Default true               |

**Endpoints:** `/api/activities/v1/categories`, `/api/activities/v1/activities`

#### 3.5.2 Deliverables & Assignments

**Deliverables:**

| Field                        | Type         | Description                                                 |
| ---------------------------- | ------------ | ----------------------------------------------------------- |
| `id`                       | uuid         | PK                                                          |
| `name`                     | varchar(128) | Deliverable name                                            |
| `description`              | text         | Description                                                 |
| `status`                   | varchar(20)  | `pending` -> `released` -> `finished` -> `canceled` |
| `start_date`, `end_date` | date         | Timeline                                                    |

**Deliverable Assignments:**

| Field              | Type | Description                  |
| ------------------ | ---- | ---------------------------- |
| `deliverable_id` | uuid | FK to deliverables (CASCADE) |
| `project_id`     | uuid | FK to projects (CASCADE)     |
| `employee_id`    | uuid | FK to employees (SET NULL)   |
| `notes`          | text | Assignment notes             |

**Endpoints:** `/api/activities/v1/deliverables`, `/api/activities/v1/deliverable-assignments`

#### 3.5.3 Budgets

| Field               | Type             | Description                                                              |
| ------------------- | ---------------- | ------------------------------------------------------------------------ |
| `id`              | uuid             | PK                                                                       |
| `deliverable_id`  | uuid             | FK to deliverables (CASCADE)                                             |
| `activity_id`     | uuid             | FK to activities (CASCADE)                                               |
| `budgeted_amount` | numeric(12,2)    | Amount                                                                   |
| `version`         | integer          | Version number (default 1; no CHECK constraint enforcing > 0)            |
| `is_current`      | boolean          | Default true                                                             |
| `status`          | varchar(20)      | `draft` -> `submitted` -> `approved` -> `locked` -> `rejected` |
| `submitted_by/at` | uuid/timestamptz | Submission audit                                                         |
| `approved_by/at`  | uuid/timestamptz | Approval audit                                                           |

**Business Rules:**

- Budgets must be approved before units can be marked `released`
- Approved versions become read-only; new changes spawn another version
- `remaining_budget` and `spent_to_date` updated by triggers/services

**Endpoint:** `/api/activities/v1/budgets`

#### 3.5.4 Cost Lines

| Field              | Type          | Description                                                                                          |
| ------------------ | ------------- | ---------------------------------------------------------------------------------------------------- |
| `id`             | uuid          | PK                                                                                                   |
| `company_id`     | uuid          | FK to companies (RESTRICT)                                                                           |
| `deliverable_id` | uuid          | FK to deliverables (CASCADE)                                                                         |
| `vendor_id`      | uuid          | FK to vendors (SET NULL)                                                                             |
| `activity_id`    | uuid          | FK to activities (CASCADE)                                                                           |
| `budget_id`      | uuid          | FK to budgets (SET NULL)                                                                             |
| `tenant_sku`     | varchar(64)   | SKU reference                                                                                        |
| `source_type`    | varchar(16)   | `material` or `labor`                                                                            |
| `quantity`       | numeric(12,4) | Quantity                                                                                             |
| `unit_price`     | numeric(12,4) | Unit price                                                                                           |
| `amount`         | numeric(12,2) | **GENERATED** (quantity * unit_price)                                                          |
| `markup_pct`     | numeric(5,2)  | Markup percentage                                                                                    |
| `status`         | varchar(20)   | Workflow: `draft` -> `locked` -> `change_order`. CHECK allows `draft`, `locked`, `change_order`. |

**Endpoint:** `/api/activities/v1/cost-lines`

#### 3.5.5 Actual Costs

| Field               | Type          | Description                                                          |
| ------------------- | ------------- | -------------------------------------------------------------------- |
| `id`              | uuid          | PK                                                                   |
| `activity_id`     | uuid          | FK to activities (CASCADE)                                           |
| `project_id`      | uuid          | FK to projects (SET NULL) — links cost to project for profitability |
| `amount`          | numeric(12,2) | Cost amount                                                          |
| `currency`        | varchar(3)    | Currency code                                                        |
| `reference`       | text          | Invoice/source reference                                             |
| `approval_status` | varchar(20)   | `pending` -> `approved` -> `rejected`                          |
| `incurred_on`     | date          | Date cost was incurred                                               |

**Business Rules:**

- Default state: `pending`; approval subject to budget/tolerance checks
- Validation: unit must be `released`, cost line must exist and be approved
- Amounts cannot exceed approved budget + tolerance unless covered by change orders
- Approval triggers GL posting (debit expense/WIP, credit AP/accrual)

**Endpoint:** `/api/activities/v1/actual-costs`

#### 3.5.6 Vendor Parts

| Field          | Type          | Description             |
| -------------- | ------------- | ----------------------- |
| `id`         | uuid          | PK                      |
| `vendor_id`  | uuid          | FK to vendors (CASCADE) |
| `vendor_sku` | varchar(64)   | Vendor's SKU            |
| `tenant_sku` | varchar(64)   | Internal tenant SKU     |
| `unit_cost`  | numeric(12,4) | Unit cost               |
| `currency`   | varchar(3)    | Currency code           |
| `markup_pct` | numeric(5,2)  | Markup percentage       |
| `is_active`  | boolean       | Default true            |

**Endpoint:** `/api/activities/v1/vendor-parts`

---

### 3.6 Bill of Materials (BOM)  [in-scope]

**Purpose:** Manage material catalogs, vendor SKU matching (with AI-powered similarity search), and vendor pricing.

#### 3.6.1 Catalog SKUs

| Field                      | Type         | Description                              |
| -------------------------- | ------------ | ---------------------------------------- |
| `id`                     | uuid         | PK                                       |
| `catalog_sku`            | varchar(64)  | Unique catalog SKU                       |
| `description`            | text         | Full description                         |
| `description_normalized` | text         | Normalized for matching                  |
| `category`               | varchar(64)  | Material category                        |
| `sub_category`           | varchar(64)  | Sub-category                             |
| `model`                  | varchar(32)  | Embedding model used                     |
| `embedding`              | vector(3072) | pgvector embedding for similarity search |

**Endpoint:** `/api/bom/v1/catalog-skus`

#### 3.6.2 Vendor SKUs

| Field                      | Type         | Description                                       |
| -------------------------- | ------------ | ------------------------------------------------- |
| `id`                     | uuid         | PK                                                |
| `vendor_id`              | uuid         | FK to vendors (RESTRICT)                          |
| `vendor_sku`             | varchar(64)  | Vendor's SKU code                                 |
| `description`            | text         | Vendor's description                              |
| `description_normalized` | text         | Normalized description                            |
| `catalog_sku_id`         | uuid         | FK to catalog_skus (matched, SET NULL)            |
| `confidence`             | real         | Match confidence score (0.0-1.0)                  |
| `model`                  | varchar(32)  | Embedding model (default: text-embedding-3-large) |
| `embedding`              | vector(3072) | pgvector embedding                                |

**Custom Methods:**

- `findBySku(vendor_id, vendor_sku)`: Lookup by composite key
- `getUnmatched()`: Get vendor SKUs without catalog matches
- `refreshEmbeddings(batches)`: Batch update embeddings

**Endpoint:** `/api/bom/v1/vendor-skus`

#### 3.6.3 Vendor Pricing

| Field              | Type          | Description                 |
| ------------------ | ------------- | --------------------------- |
| `id`             | uuid          | PK                          |
| `vendor_sku_id`  | uuid          | FK to vendor_skus (CASCADE) |
| `unit_price`     | numeric(12,4) | Price per unit              |
| `unit`           | varchar(32)   | Unit of measure             |
| `effective_date` | date          | Price effective date        |

**Endpoint:** `/api/bom/v1/vendor-pricing`

---

### 3.7 Accounts Payable (AP)  [in-scope]

**Purpose:** Manage vendor invoices, invoice lines, payments, and credit memos.

#### 3.7.1 AP Invoices

| Field              | Type          | Description                                                           |
| ------------------ | ------------- | --------------------------------------------------------------------- |
| `id`             | uuid          | PK                                                                    |
| `company_id`     | uuid          | FK to companies (RESTRICT)                                            |
| `vendor_id`      | uuid          | FK to vendors (RESTRICT)                                              |
| `project_id`     | uuid          | FK to projects (SET NULL) — required for project cashflow tracking   |
| `invoice_number` | varchar(64)   | Invoice number                                                        |
| `invoice_date`   | date          | Invoice date                                                          |
| `due_date`       | date          | Payment due date                                                      |
| `total_amount`   | numeric(14,2) | Total amount                                                          |
| `currency`       | varchar(3)    | Currency code (default `USD`)                                       |
| `status`         | varchar(20)   | `open` -> `approved` -> `paid` -> `voided` (CHECK constraint) |
| `notes`          | text          | Internal notes                                                        |

**Business Rules:**

- Posting requires every line to map to a valid GL account and optionally a cost line
- Posting updates vendor balances and creates GL entries (AP Liability <-> Expense/WIP)
- When `project_id` is set, the invoice amount feeds into project cashflow outflow metrics
- Remaining balance is computed as `total_amount − SUM(payments) − SUM(applied credit memos)` — not stored as a column
- **Invoice numbering** is auto-assigned on `status` transition to `approved` (when no `invoice_number` was provided). The scope is `company_id` per §3.13 — each company under the tenant gets its own running sequence

**Endpoint:** `/api/ap/v1/ap-invoices`

#### 3.7.2 AP Invoice Lines

| Field            | Type          | Description                        |
| ---------------- | ------------- | ---------------------------------- |
| `id`           | uuid          | PK                                 |
| `invoice_id`   | uuid          | FK to ap_invoices (CASCADE)        |
| `cost_line_id` | uuid          | FK to cost_lines (SET NULL)        |
| `activity_id`  | uuid          | FK to activities (SET NULL)        |
| `account_id`   | uuid          | FK to chart_of_accounts (RESTRICT) |
| `description`  | text          | Line description                   |
| `amount`       | numeric(12,2) | Line amount                        |

**Endpoint:** `/api/ap/v1/ap-invoice-lines`

#### 3.7.3 Payments

| Field             | Type          | Description                                                                                |
| ----------------- | ------------- | ------------------------------------------------------------------------------------------ |
| `id`            | uuid          | PK                                                                                         |
| `vendor_id`     | uuid          | FK to vendors (RESTRICT)                                                                   |
| `ap_invoice_id` | uuid          | FK to ap_invoices (SET NULL)                                                               |
| `payment_date`  | date          | Payment date                                                                               |
| `amount`        | numeric(14,2) | Payment amount                                                                             |
| `method`        | varchar(24)   | One of `check`, `ach`, `wire`. Enforced by `paymentsController` (`VALID_METHODS = ['check', 'ach', 'wire']`) on create and update — values outside the allowlist return 400. Schema has no CHECK constraint; enforcement is controller-level. (Documented per gap 3.25, 2026-05-21.) |
| `reference`     | varchar(64)   | Check number/reference                                                                     |
| `notes`         | text          | Internal notes                                                                             |

**Endpoint:** `/api/ap/v1/payments`

#### 3.7.4 AP Credit Memos

| Field             | Type          | Description                                              |
| ----------------- | ------------- | -------------------------------------------------------- |
| `id`            | uuid          | PK                                                       |
| `vendor_id`     | uuid          | FK to vendors (RESTRICT)                                 |
| `ap_invoice_id` | uuid          | FK to ap_invoices (SET NULL)                             |
| `credit_number` | varchar(64)   | Credit memo number                                       |
| `credit_date`   | date          | Credit date                                              |
| `amount`        | numeric(14,2) | Credit amount                                            |
| `reason`        | text          | Reason for credit                                        |
| `status`        | varchar(20)   | `open` -> `applied` -> `voided` (CHECK constraint) |

**Endpoint:** `/api/ap/v1/ap-credit-memos`

---

### 3.8 Accounts Receivable (AR)  [in-scope]

**Purpose:** Manage client invoices, invoice lines, and payment receipts. AR is the primary revenue source for project profitability tracking.

> **Note:** The `ar_clients` table has been removed. The unified `clients` table (§3.3.2) with `email` field replaces it. Tax identifiers are managed via the `tax_identifiers` table (§3.3.4). Client addresses and phone numbers are available via the polymorphic `sources` pattern. AR invoices reference `clients.id` directly.

#### 3.8.1 AR Invoices

| Field              | Type          | Description                                                        |
| ------------------ | ------------- | ------------------------------------------------------------------ |
| `id`             | uuid          | PK                                                                 |
| `company_id`     | uuid          | FK to companies (RESTRICT)                                         |
| `client_id`      | uuid          | FK to clients (RESTRICT)                                           |
| `project_id`     | uuid          | FK to projects (SET NULL) — required for project revenue tracking |
| `deliverable_id` | uuid          | FK to deliverables (SET NULL)                                      |
| `invoice_number` | varchar(32)   | Invoice number                                                     |
| `invoice_date`   | date          | Invoice date                                                       |
| `due_date`       | date          | Due date                                                           |
| `total_amount`   | numeric(14,2) | Total amount                                                       |
| `currency`       | varchar(3)    | Currency code (default `USD`)                                    |
| `status`         | varchar(20)   | `open` -> `sent` -> `paid` -> `voided` (CHECK constraint)  |
| `notes`          | text          | Internal notes                                                     |

**Business Rules:**

- Revenue recognition can depend on activity completion percentage or cost thresholds
- Posting debits AR, credits revenue; payments reverse the entry
- When `project_id` is set, the invoice feeds into project revenue/cashflow inflow metrics
- Partial payments and retainage supported (see Cashflow module)
- Remaining balance is computed as `total_amount − SUM(receipts)` — not stored as a column
- **Invoice numbering** is auto-assigned on `status` transition to `sent` (when no `invoice_number` was provided). The scope is `company_id` per §3.13 — each company under the tenant gets its own running sequence

**Endpoints:**

| Method        | Path                               | Purpose                                                                                                         |
| ------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Standard CRUD | `/api/ar/v1/ar-invoices`         | List, get, create, update, archive, restore                                                                     |
| `PUT`       | `/api/ar/v1/ar-invoices/approve` | Approve invoice (sets status to `sent`). RBAC-gated: requires `ar::ar-invoices::approve` at `full` level. |

#### 3.8.2 AR Invoice Lines

| Field           | Type          | Description                        |
| --------------- | ------------- | ---------------------------------- |
| `invoice_id`  | uuid          | FK to ar_invoices (CASCADE)        |
| `account_id`  | uuid          | FK to chart_of_accounts (RESTRICT) |
| `description` | text          | Line description                   |
| `amount`      | numeric(14,2) | Line amount                        |

**Endpoint:** `/api/ar/v1/ar-invoice-lines`

#### 3.8.3 Receipts

| Field             | Type          | Description                                                                                |
| ----------------- | ------------- | ------------------------------------------------------------------------------------------ |
| `client_id`     | uuid          | FK to clients (RESTRICT)                                                                   |
| `ar_invoice_id` | uuid          | FK to ar_invoices (SET NULL)                                                               |
| `receipt_date`  | date          | Receipt date                                                                               |
| `amount`        | numeric(14,2) | Receipt amount                                                                             |
| `method`        | varchar(24)   | One of `check`, `ach`, `wire`. Enforced by `receiptsController` (`VALID_METHODS = ['check', 'ach', 'wire']`) on create and update — values outside the allowlist return 400. Schema has no CHECK constraint; enforcement is controller-level. (Documented per gap 3.25, 2026-05-21.) |
| `reference`     | varchar(64)   | Reference number                                                                           |
| `notes`         | text          | Internal notes                                                                             |

**Endpoint:** `/api/ar/v1/receipts`

#### 3.8.4 AR Extensibility — Construction Closing Statements  [in-scope]

Standard AR (milestone invoicing on AR invoices) lives in the core `ar` module and is unchanged by the construction vertical. Construction subdivision sales do **not** flow through `ar_invoices` — they use **closing statements**, which are owned by the `construction` vertical (the `contracts` module under the construction packaging).

A closing statement posts a single normalised GL journal entry that touches, at minimum:

- the **AR** account (revenue recognition for the unit sold),
- the **WIP** account (clears project cost-to-date associated with the unit),
- the **inventory** account (removes the sold unit from inventory),
- and, where the holding-company structure requires it, the **intercompany** accounts.

The core `ar` module is **not** modified to support this — the construction module acts on AR exclusively via the cross-module posting contract (ADR-0019), the same contract that AP and AR use to post to GL. This keeps construction-specific semantics out of `ar` and out of `accounting`.

The exact mapping between WIP, inventory, and project-level cost accounts is **deferred to the implementation phase**, when the `inventory` and `projects` modules graduate from spec to code. The relationships are recorded here as an architectural intent, not a finalised data model.

---

### 3.9 Accounting & General Ledger  [in-scope]

**Purpose:** Chart of accounts, journal entries, ledger balances, posting queues, and category-account mappings.

#### 3.9.1 Chart of Accounts

| Field                   | Type        | Description                                                                                                                                     |
| ----------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                  | uuid        | PK                                                                                                                                              |
| `code`                | varchar(16) | Account code                                                                                                                                    |
| `name`                | varchar(64) | Account name                                                                                                                                    |
| `type`                | varchar(16) | Intended values:`asset`, `liability`, `equity`, `income`, `expense`, `cash`, `bank` (no CHECK constraint — any varchar accepted) |
| `is_active`           | boolean     | Default true                                                                                                                                    |
| `cash_basis`          | boolean     | Default false                                                                                                                                   |
| `bank_account_number` | varchar(32) | For cash/bank types                                                                                                                             |
| `routing_number`      | varchar(16) | Bank routing                                                                                                                                    |
| `bank_name`           | varchar(64) | Bank name                                                                                                                                       |

**Endpoint:** `/api/accounting/v1/chart-of-accounts`

#### 3.9.2 Journal Entries

| Field           | Type        | Description                                                    |
| --------------- | ----------- | -------------------------------------------------------------- |
| `id`          | uuid        | PK                                                             |
| `company_id`  | uuid        | FK to companies (RESTRICT)                                     |
| `project_id`  | uuid        | FK to projects (SET NULL) — enables project-level GL analysis |
| `entry_date`  | date        | Entry date                                                     |
| `description` | text        | Description                                                    |
| `status`      | varchar(16) | `pending` -> `posted` -> `reversed` (CHECK constraint)   |
| `source_type` | varchar(32) | `activity_actual`, `invoice`, `payment`, etc.            |
| `source_id`   | uuid        | Reference to source record                                     |
| `corrects_id` | uuid        | Self-ref FK for reversals (SET NULL)                           |

**Business Rules:**

- Entries must balance (sum debits = sum credits)
- Fiscal period validation is planned but not yet implemented — the `fiscal_periods` table does not exist
- Self-referential `corrects_id` supports reversal chains

**Endpoints:**

| Method        | Path                                           | Purpose                                                               |
| ------------- | ---------------------------------------------- | --------------------------------------------------------------------- |
| Standard CRUD | `/api/accounting/v1/journal-entries`         | List, get, create, update, archive, restore                           |
| `POST`      | `/api/accounting/v1/journal-entries/post`    | Post pending journal entries (sets status to `posted`)              |
| `POST`      | `/api/accounting/v1/journal-entries/reverse` | Reverse posted entries (creates correcting entry via `corrects_id`) |

#### 3.9.3 Journal Entry Lines

| Field             | Type          | Description                        |
| ----------------- | ------------- | ---------------------------------- |
| `entry_id`      | uuid          | FK to journal_entries (CASCADE)    |
| `account_id`    | uuid          | FK to chart_of_accounts (RESTRICT) |
| `debit`         | numeric(12,2) | Debit amount (default 0)           |
| `credit`        | numeric(12,2) | Credit amount (default 0)          |
| `memo`          | text          | Line memo                          |
| `related_table` | varchar(32)   | Polymorphic reference table        |
| `related_id`    | uuid          | Polymorphic reference ID           |

**Endpoint:** `/api/accounting/v1/journal-entry-lines`

#### 3.9.4 Ledger Balances

| Field          | Type          | Description                        |
| -------------- | ------------- | ---------------------------------- |
| `account_id` | uuid          | FK to chart_of_accounts (RESTRICT) |
| `as_of_date` | date          | Balance date                       |
| `balance`    | numeric(14,2) | Account balance                    |

**Endpoint:** `/api/accounting/v1/ledger-balances`

#### 3.9.5 Posting Queues

| Field                | Type        | Description                                                |
| -------------------- | ----------- | ---------------------------------------------------------- |
| `journal_entry_id` | uuid        | FK to journal_entries (CASCADE)                            |
| `status`           | varchar(16) | `pending` -> `posted` -> `failed` (CHECK constraint) |
| `error_message`    | text        | Error details on failure                                   |
| `processed_at`     | timestamptz | Processing timestamp                                       |

**Endpoint:** `/api/accounting/v1/posting-queues`

#### 3.9.6 Category-Account Map

Maps cost categories to GL accounts with date-range validity:

| Field           | Type | Description                        |
| --------------- | ---- | ---------------------------------- |
| `category_id` | uuid | FK to categories (RESTRICT)        |
| `account_id`  | uuid | FK to chart_of_accounts (RESTRICT) |
| `valid_from`  | date | Effective start date               |
| `valid_to`    | date | Effective end date                 |

**Endpoint:** `/api/accounting/v1/category-account-map`

#### 3.9.7 Intercompany Accounting

**Company Accounts:**

| Field                        | Type    | Description                        |
| ---------------------------- | ------- | ---------------------------------- |
| `source_company_id`        | uuid    | FK to companies (RESTRICT)         |
| `target_company_id`        | uuid    | FK to companies (RESTRICT)         |
| `inter_company_account_id` | uuid    | FK to chart_of_accounts (RESTRICT) |
| `is_active`                | boolean | Default true                       |

Unique constraint: `(tenant_id, source_company_id, target_company_id)`

**Company Transactions:**

| Field                       | Type          | Description                                                                          |
| --------------------------- | ------------- | ------------------------------------------------------------------------------------ |
| `source_company_id`       | uuid          | FK to companies (RESTRICT)                                                           |
| `target_company_id`       | uuid          | FK to companies (RESTRICT)                                                           |
| `source_journal_entry_id` | uuid          | FK to journal_entries (SET NULL)                                                     |
| `target_journal_entry_id` | uuid          | FK to journal_entries (SET NULL)                                                     |
| `module`                  | varchar(32)   | Intended values:`ar`, `ap`, `je` (no CHECK constraint — any varchar accepted) |
| `amount`                  | numeric(14,2) | Transaction amount (default 0)                                                       |
| `status`                  | varchar(16)   | `pending` -> `posted` -> `reversed` (CHECK constraint; default `pending`)    |
| `is_eliminated`           | boolean       | Elimination flag for consolidated reporting (default false)                          |
| `description`             | text          | Transaction description                                                              |

**Internal Transfers:**

| Field               | Type          | Description                        |
| ------------------- | ------------- | ---------------------------------- |
| `from_account_id` | uuid          | FK to chart_of_accounts (RESTRICT) |
| `to_account_id`   | uuid          | FK to chart_of_accounts (RESTRICT) |
| `transfer_date`   | date          | Transfer date                      |
| `amount`          | numeric(12,2) | Transfer amount                    |
| `description`     | text          | Transfer description               |

**Business Rules:**

- Intercompany transactions create paired journal entries (due-to / due-from)
- Carry elimination flags for consolidated reporting
- Consolidation targets tenant-level P&L, balance sheet, and elimination reports

**Endpoints:** `/api/accounting/v1/company-accounts`, `/api/accounting/v1/company-transactions`, `/api/accounting/v1/internal-transfers`

---

### 3.10 Cashflow & Profitability  [in-scope]

**Purpose:** Track money flowing in (AR receipts) and money flowing out (AP payments, actual costs) at the project level. Provide real-time profitability analysis, margin tracking, and cashflow forecasting to enable project managers and CFOs to make informed financial decisions.

#### 3.10.1 Data Linkage Model

Cashflow and profitability are derived from existing transactional data — no separate cashflow tables are needed. The system relies on `project_id` foreign keys present on AR invoices, AP invoices, actual costs, and journal entries.

```
PROJECT PROFITABILITY = Revenue (AR) − Costs (AP + Actual Costs)

Revenue Sources (Inflows):
  ├── ar_invoices WHERE project_id = ? AND status IN ('sent','paid')
  ├── receipts   JOIN ar_invoices WHERE project_id = ?
  └── journal_entry_lines WHERE account.type = 'income' AND entry.project_id = ?

Cost Sources (Outflows):
  ├── ap_invoices     WHERE project_id = ? AND status IN ('approved','paid')
  ├── payments        JOIN ap_invoices WHERE project_id = ?
  ├── actual_costs    WHERE project_id = ? AND approval_status = 'approved'
  └── journal_entry_lines WHERE account.type = 'expense' AND entry.project_id = ?
```

#### 3.10.2 Project Profitability Metrics

| Metric                                 | Calculation                                                                         | Description                   |
| -------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------- |
| **Contract Value**               | `projects.contract_amount`                                                        | Total client contract value   |
| **Invoiced Revenue**             | SUM `ar_invoices.total_amount` WHERE project_id AND status IN ('sent','paid')     | Total billed to client        |
| **Collected Revenue**            | SUM `receipts.amount` JOIN ar_invoices WHERE project_id                           | Cash actually received        |
| **Outstanding AR**               | Invoiced Revenue − Collected Revenue                                               | Unpaid client invoices        |
| **Total Budgeted Cost**          | SUM `cost_items.amount` + approved change orders                                  | Approved budget for project   |
| **Committed Cost**               | SUM `ap_invoices.total_amount` WHERE project_id AND status IN ('approved','paid') | Vendor invoices committed     |
| **Actual Spend**                 | SUM `actual_costs.amount` WHERE project_id AND approved                           | Confirmed expenditures        |
| **Cash Out**                     | SUM `payments.amount` JOIN ap_invoices WHERE project_id                           | Cash actually paid to vendors |
| **Gross Profit**                 | Invoiced Revenue − Committed Cost                                                  | Revenue minus committed costs |
| **Gross Margin %**               | (Gross Profit / Invoiced Revenue) × 100                                            | Profitability percentage      |
| **Net Cashflow**                 | Collected Revenue − Cash Out                                                       | Real cash position            |
| **Budget Variance**              | Total Budgeted Cost − Actual Spend                                                 | Over/under budget             |
| **Estimated Cost at Completion** | Actual Spend + Remaining Budget (uncommitted)                                       | Projected total cost          |
| **Projected Profit**             | Contract Value − Estimated Cost at Completion                                      | Forecasted final profit       |
| **Projected Margin %**           | (Projected Profit / Contract Value) × 100                                          | Forecasted final margin       |

#### 3.10.3 Cashflow Timeline

Track periodic inflows/outflows to understand cash timing:

**Cashflow Summary (computed, not stored):**

| Dimension                  | Inflow Source                         | Outflow Source                        |
| -------------------------- | ------------------------------------- | ------------------------------------- |
| **By Month**         | `receipts.receipt_date`             | `payments.payment_date`             |
| **By Quarter**       | Aggregated monthly                    | Aggregated monthly                    |
| **By Project Phase** | AR invoices per deliverable           | AP invoices + actuals per deliverable |
| **By Vendor**        | N/A                                   | `payments` grouped by `vendor_id` |
| **By Client**        | `receipts` grouped by `client_id` | N/A                                   |

**Forecast Inputs:**

| Data Point           | Source                                                      |
| -------------------- | ----------------------------------------------------------- |
| Expected AR inflows  | `ar_invoices.due_date` WHERE status = 'sent' (unpaid)     |
| Expected AP outflows | `ap_invoices.due_date` WHERE status = 'approved' (unpaid) |
| Budget burn rate     | `actual_costs` trend over rolling 30/60/90-day windows    |

#### 3.10.4 SQL Views for Profitability

These views are created in each tenant schema at provisioning time and updated via migrations:

**`vw_project_profitability`:**

```sql
-- Rolled-up profitability metrics per project
-- Joins: projects, ar_invoices, receipts, ap_invoices, payments, actual_costs, cost_items, change_orders
-- Columns: project_id, project_code, project_name, project_status, contract_amount,
--          invoiced_revenue, collected_revenue, outstanding_ar,
--          total_budgeted_cost, change_order_value, committed_cost, actual_spend, cash_out,
--          gross_profit, gross_margin_pct, net_cashflow,
--          budget_variance, est_cost_at_completion, projected_profit, projected_margin_pct
```

**`vw_project_cashflow_monthly`:**

```sql
-- Monthly inflow/outflow time series per project
-- Columns: project_id, month, inflow (receipts), outflow (payments only),
--          actual_cost, net_cashflow (inflow − outflow, excludes actual_cost),
--          cumulative_inflow, cumulative_outflow, cumulative_net
```

**`vw_project_cost_by_category`:**

```sql
-- Cost breakdown by activity category per project
-- Joins: deliverable_assignments, budgets, activities, categories, actual_costs
-- Columns: project_id, category_id, category_code, category_name, category_type,
--          budgeted_amount, actual_amount, variance
```

**`vw_ar_aging`:**

```sql
-- AR aging buckets per client
-- Columns: client_id, client_name, client_code, invoice_count, total_balance,
--          current_bucket, bucket_1_30, bucket_31_60, bucket_61_90, bucket_over_90
```

**`vw_ap_aging`:**

```sql
-- AP aging buckets per vendor
-- Columns: vendor_id, vendor_name, vendor_code, invoice_count, total_balance,
--          current_bucket, bucket_1_30, bucket_31_60, bucket_61_90, bucket_over_90
```

#### 3.10.5 API Endpoints

| Method  | Path                                                     | Purpose                                                     |
| ------- | -------------------------------------------------------- | ----------------------------------------------------------- |
| `GET` | `/api/reports/v1/project-profitability`                | List profitability for all active projects                  |
| `GET` | `/api/reports/v1/project-profitability/:projectId`     | Detailed profitability for single project                   |
| `GET` | `/api/reports/v1/project-cashflow/:projectId`          | Monthly cashflow time series for project                    |
| `GET` | `/api/reports/v1/project-cashflow/:projectId/forecast` | Projected cashflow based on AR due dates and AP obligations |
| `GET` | `/api/reports/v1/project-cost-breakdown/:projectId`    | Cost by category with budget vs actual                      |
| `GET` | `/api/reports/v1/ar-aging`                             | AR aging report across all clients                          |
| `GET` | `/api/reports/v1/ar-aging/:clientId`                   | AR aging for specific client                                |
| `GET` | `/api/reports/v1/ap-aging`                             | AP aging report across all vendors                          |
| `GET` | `/api/reports/v1/ap-aging/:vendorId`                   | AP aging for specific vendor                                |
| `GET` | `/api/reports/v1/company-cashflow`                     | Aggregated cashflow across all projects for a company. UI lives under `/dashboard/cashflow` (Dashboard nav group), NOT `/reports/*` — see §7. (Reconciled per gaps 2.23 / 4.27, 2026-05-21.) |
| `GET` | `/api/reports/v1/margin-analysis`                      | Cross-project margin comparison and trending                |

#### 3.10.6 UI Requirements

**Project Profitability Dashboard:**

- Summary cards: Contract Value, Invoiced Revenue, Gross Profit, Gross Margin %, Net Cashflow
- Status indicators: green (on budget), yellow (approaching budget), red (over budget)
- Drill-down from project list to individual project detail
- MUI X Charts: bar chart comparing budget vs committed vs actual per category

**Cashflow Timeline Chart:**

- MUI X Charts: stacked area chart showing monthly inflows vs outflows
- Cumulative net cashflow trend line
- Forecast region (dashed lines) for upcoming AR/AP due dates
- Toggle: actual vs forecast vs combined view

**Profitability Table:**

- MUI X Data Grid with all metrics from §3.10.2
- Sortable by any metric column
- Conditional formatting: red for negative margins, green for healthy margins
- Export to Excel via `exportToSpreadsheet()`

**AR/AP Aging Grids:**

- Aging bucket columns: Current, 1-30, 31-60, 61-90, Over 90 (5 buckets — matches `vw_ar_aging` / `vw_ap_aging` view definitions in §3.10.4 and `rules/reports.md`). (Reconciled per gap 4.31, 2026-05-21.)
- Grouped by client (AR) or vendor (AP)
- Filterable by project
- Summary row with totals

---

### 3.11 Reporting & Views  [in-scope]

**Purpose:** Pre-computed SQL views for dashboards and data export.

**Core Export Views:**

| View                              | Description                                                          |
| --------------------------------- | -------------------------------------------------------------------- |
| `vw_export_contacts`            | Unified contacts across vendors, clients, employees with source_type |
| `vw_export_addresses`           | Unified addresses across all source types                            |
| `vw_export_template_cost_items` | Template cost items with unit name, version, task hierarchy          |
| `vw_template_tasks_export`      | Template tasks with unit name and version                            |

**Export View Endpoints:** Views are created by the `202502120080_sqlViews` migration. API routes are not yet implemented — views are queried directly by report controllers where needed.

**Financial Views (see §3.10.4):**

| View                            | Description                                 |
| ------------------------------- | ------------------------------------------- |
| `vw_project_profitability`    | Rolled-up profitability metrics per project |
| `vw_project_cashflow_monthly` | Monthly inflow/outflow time series          |
| `vw_project_cost_by_category` | Cost breakdown by activity category         |
| `vw_ar_aging`                 | AR aging buckets by client/project          |
| `vw_ap_aging`                 | AP aging buckets by vendor/project          |

**Budget vs Actual Metrics:**

| Metric              | Calculation                                       |
| ------------------- | ------------------------------------------------- |
| Original Budget     | Sum of approved `cost_lines.total_cost`         |
| Change Orders       | Sum of approved `change_order_lines.total_cost` |
| Actual Costs        | Sum of `actual_costs.amount` (approved)         |
| Total Exposure      | Original Budget + Change Orders                   |
| Variance (Baseline) | Original Budget − Actual Costs                   |
| Variance (Total)    | Total Exposure − Actual Costs                    |

---

### 3.12 Match Review Logs  [in-scope]

**Purpose:** Audit trail for BOM vendor SKU matching decisions.

| Field           | Type        | Description                       |
| --------------- | ----------- | --------------------------------- |
| `id`          | uuid        | PK                                |
| `entity_type` | varchar(32) | Entity being matched              |
| `entity_id`   | uuid        | Entity ID                         |
| `match_type`  | varchar(32) | Type of match                     |
| `match_id`    | uuid        | Matched entity ID                 |
| `reviewer_id` | uuid        | Reviewer user ID                  |
| `decision`    | varchar(16) | `accept`, `reject`, `defer` |
| `notes`       | text        | Reviewer notes                    |

**Endpoint:** `/api/tenants/v1/match-review-logs`

---

### 3.13 Tenant-Scoped Numbering System  [in-scope]

**Purpose:** Configurable, transaction-safe auto-numbering for all business entities. Separates internal PKs (UUIDs) from human-readable business identifiers. Supports per-tenant formatting, optional sub-scope (e.g., per company for invoices), and period-based counter reset.

> **Terminology:** in this product, **companies are the legal entities** under a tenant — there is no separate `legal_entities` table. Section 3.13 uses `scope_type = company` for invoices; earlier wording that used `legal_entity` as a distinct scope was redundant and has been collapsed.

#### 3.13.1 Design Principles

1. Database primary keys (UUID) are not business identifiers
2. Business numbers are generated per tenant (never global)
3. Invoice numbers are generated **per company** (`scope_type = 'company'`); each company under a tenant gets its own running invoice sequence
4. Reset behavior is implemented using a `period_key`, not by restarting sequences
5. Display formatting is independent of serial allocation logic
6. Issued invoice numbers are immutable

#### 3.13.2 Numbering Configuration

**Data Model (`tenant_numbering_config`):**

| Field          | Type        | Description                                                                                    |
| -------------- | ----------- | ---------------------------------------------------------------------------------------------- |
| `id`         | uuid        | PK                                                                                             |
| `tenant_id`  | uuid        | Not null, immutable                                                                            |
| `id_type`    | varchar(32) | `employee`, `vendor`, `client`, `contact`, `ar_invoice`, `ap_invoice`, `project` |
| `prefix`     | varchar(16) | Display prefix (e.g.,`EMP`, `INV`)                                                         |
| `suffix`     | varchar(16) | Display suffix                                                                                 |
| `date_mode`  | varchar(16) | `none`, `year`, `year_month`, `ymd`                                                    |
| `reset_mode` | varchar(16) | `never`, `yearly`, `monthly`, `daily`                                                  |
| `padding`    | integer     | Zero-pad width (e.g., 4 →`0001`)                                                            |
| `separator`  | varchar(4)  | Joins display parts (e.g.,`-`)                                                               |
| `uppercase`  | boolean     | Apply uppercase to final display ID                                                            |
| `scope_type` | varchar(32) | `none`, `company`, `project` (companies are the legal entities — see §3.13 terminology note) |
| `is_enabled` | boolean     | Enables auto-numbering for this entity type                                                    |

**Unique Constraint:** `(tenant_id, id_type)` — one config row per entity type per tenant.

Changing configuration affects future numbers only. Historical numbers are never rewritten.

#### 3.13.3 Sequence State (Counter Storage)

**Data Model (`tenant_number_sequence_state`):**

| Field           | Type        | Description                                                                                                                           |
| --------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `id`          | uuid        | PK                                                                                                                                    |
| `tenant_id`   | uuid        | Not null, immutable                                                                                                                   |
| `id_type`     | varchar(32) | Entity type                                                                                                                           |
| `scope_id`    | uuid        | Scope entity UUID, or NIL UUID for global scope                                                                                       |
| `period_key`  | varchar(16) | Derived from `reset_mode`: `never` → `global`, `yearly` → `YYYY`, `monthly` → `YYYY-MM`, `daily` → `YYYY-MM-DD` |
| `last_serial` | bigint      | Current counter value                                                                                                                 |

**Unique Constraint:** `(tenant_id, id_type, scope_id, period_key)`

#### 3.13.4 Display ID Construction

`display_id = prefix + separator + date_part + separator + padded(serial) + separator + suffix`

- Only non-empty components are included
- Date part derived from `issued_at` timestamp using `date_mode`
- Padding applied to serial (e.g., padding=6 → `000123`)
- Uppercase transformation applied if configured

**Examples:** `EMP-0045`, `INV-2026-00123`, `VND-2026-02-0004`

#### 3.13.5 Transaction-Safe Allocation

1. Determine `period_key` from `reset_mode` and current date
2. `BEGIN` transaction
3. `SELECT ... FROM tenant_number_sequence_state FOR UPDATE` (row lock)
4. If row not found → `INSERT` with `last_serial = 1`
5. Else → `INCREMENT last_serial`
6. Assign serial to entity record
7. Compute `display_id` from config
8. `COMMIT`

This prevents race conditions and duplicate numbers under concurrent requests.

#### 3.13.6 Reset Strategy

Reset is achieved via `period_key` partitioning — no sequence objects are restarted manually.

Example (yearly reset): 2025 → `period_key = '2025'`, serial 000001; 2026 → `period_key = '2026'`, serial resets to 000001 automatically.

#### 3.13.7 Recommended Defaults

| Entity Type | Prefix   | Padding | Date Mode | Reset Mode | Scope        |
| ----------- | -------- | ------- | --------- | ---------- | ------------ |
| Employee    | `EMP`  | 4       | none      | never      | tenant       |
| Vendor      | `VND`  | 4       | none      | never      | tenant       |
| Client      | `CLT`  | 4       | none      | never      | tenant       |
| Contact     | `CON`  | 4       | none      | never      | tenant       |
| Project     | `PRJ`  | 4       | none      | never      | tenant       |
| AR Invoice  | `INV`  | 5       | year      | yearly     | company      |
| AP Invoice  | `BILL` | 5       | year      | yearly     | company      |

All configs are seeded with `is_enabled = false` during tenant provisioning. Tenants opt in via the Settings UI. When numbering is first enabled for an entity type, existing records with `code IS NULL` are backfilled in `created_at` order.

#### 3.13.8 Entity Integration

Auto-numbering populates the entity's code/number field only when the user does not provide one. For AR invoices, numbering fires when `status` transitions to `sent`; for AP invoices, when `status` transitions to `approved` (immutable after assignment).

| Entity     | Code Field         | Numbering Trigger           |
| ---------- | ------------------ | --------------------------- |
| Vendor     | `code`           | On create (if code is null) |
| Client     | `code`           | On create (if code is null) |
| Employee   | `code`           | On create (if code is null) |
| Contact    | `code`           | On create (if code is null) |
| Project    | `project_code`   | On create (if code is null) |
| AR Invoice | `invoice_number` | On status →`sent`        |
| AP Invoice | `invoice_number` | On status →`approved`    |

#### 3.13.9 Backfill on Enable

When a tenant enables numbering for an entity type (`is_enabled` transitions `false` → `true`), the system backfills all existing records of that type that have `code IS NULL AND deactivated_at IS NULL`, ordered by `created_at`. This ensures entities created before numbering was configured — including the admin employee created during tenant provisioning — receive codes matching the tenant's chosen pattern.

The backfill runs atomically in a single transaction using the same `allocateNumber()` path as normal entity creation. The response includes `backfilledCodes` count so the UI can inform the user.

**Endpoint:** `/api/core/v1/numbering-config`

**UI:** Settings > Numbering — card-based configuration page with per-entity-type enable/disable, format fields, and live preview.

---

### 3.14 Tenant-First-Class Modules  [in-scope]

**Purpose:** Tenant-scoped reference modules that did not fit cleanly into §3.3 *Core Entities* when the PRD was first written. Documented here for completeness. (Added per gaps 2.1, 2.2, 2.6, 4.26, 2026-05-21.)

#### 3.14.1 Emails (first-class tenant-scoped table)

The `emails` table is the canonical store for email addresses across vendors, clients, employees, contacts, and vendor contacts. It replaces the per-entity `email` column on `clients` and `employees`.

| Field           | Type         | Description                                                                                                    |
| --------------- | ------------ | -------------------------------------------------------------------------------------------------------------- |
| `id`            | uuid         | PK                                                                                                             |
| `tenant_id`     | uuid         | Not null, immutable                                                                                            |
| `source_id`     | uuid         | FK to `sources` (CASCADE); polymorphic link to vendor / client / employee / contact / vendor_contact            |
| `email`         | varchar(128) | Not null                                                                                                       |
| `label`         | varchar(32)  | Optional ("work", "personal", etc.)                                                                            |
| `is_primary`    | boolean      | Default false. Partial unique per `source_id` (one primary per entity).                                        |
| `is_login`      | boolean      | Default false. Marks the email used as the linked `portal_users.email` for entities with `is_app_user = true`. Partial unique per `source_id` (one login email per entity). |

Indexes / invariants:

- Partial unique `(email) WHERE deactivated_at IS NULL` — tenant-wide email uniqueness for active rows (replaces the former `employees.email` partial unique).
- Partial unique `(source_id) WHERE is_login = true AND deactivated_at IS NULL`.
- Partial unique `(source_id) WHERE is_primary = true AND deactivated_at IS NULL`.
- Partial unique `(source_id, label) WHERE deactivated_at IS NULL AND label IS NOT NULL` — at most one of each label per entity.

**Endpoint:** `/api/core/v1/emails` (standard CRUD via `createRouter`).

**Policy catalog entry:** `core::emails` (registered in `policyCatalogSeeder.js`).

**Client UI:** `EmailsSection` / `EditableEmailsSection` / `EmailRow` components in `apps/client/src/components/shared/` render the email list inside each entity edit dialog (mirrors the Tax / Phone / Addresses sections — see §6.5 and §3.3.4).

**ADR Reference:** [ADR-0025](./decisions/0025-import-dedup-partial-unique-indexes.md) audits the schema.

#### 3.14.2 Tenant Preferences

One row per tenant — tenant-scoped UI and behaviour preferences.

| Field                | Type    | Description                                                       |
| -------------------- | ------- | ----------------------------------------------------------------- |
| `id`                 | uuid    | PK                                                                |
| `tenant_id`          | uuid    | Not null, immutable, unique                                       |
| `default_page_size`  | integer | Not null, default 25. CHECK: between 25 and 1000.                 |

**Endpoint:** `/api/core/v1/tenant-preferences` (standard CRUD via `createRouter`).

**Schema:** `apps/server/src/system/core/schemas/tenantPreferencesSchema.js`.

**Migration:** `202603270015_tenantPreferences.js` (creates the table per tenant).

**Seeder:** `apps/server/src/system/core/services/tenantPreferencesSeeder.js` inserts the default row during tenant provisioning.

#### 3.14.3 Countries (admin reference table)

ISO 3166-1 alpha-2 country reference list in the admin schema. Tenant-scope tables (`phone_numbers`, `addresses`, `tax_identifiers`) FK their `country_code` columns here so non-ISO inputs (`UK`, `Us`) are rejected at the database level.

| Field         | Type         | Description                                |
| ------------- | ------------ | ------------------------------------------ |
| `code`        | char(2)      | PK; ISO 3166-1 alpha-2 code, immutable     |
| `name`        | varchar(128) | Country name, not null                     |
| `dial_code`   | varchar(8)   | International dialing prefix (e.g., `+1`)  |
| `placeholder` | varchar(64)  | UI placeholder format hint                 |

**Schema:** `apps/server/src/system/auth/schemas/countriesSchema.js`. Model: `apps/server/src/system/auth/models/Countries.js`. Seeder: `apps/server/src/system/auth/services/countriesSeeder.js`. No API surface — read directly by the client via the shared country list in `packages/shared`.

---

### 3.15 Planned Integrations (Customer-Gated)  [deferred]

The following integrations are recorded so they are not re-litigated, but **none will be built until a paying customer requires them**. Each is an integration into an existing third party, not a feature we own end-to-end.

| Feature | Integration target | Notes |
| --- | --- | --- |
| Bank reconciliation | Plaid | Feature lives in the `accounting` module. Plaid pulls transactions; matching logic in `accounting`. Not a separate module. |
| Sales tax | Avalara or TaxJar (TBD) | Jurisdiction-specific; do not build in-house. |
| Multi-currency / FX | TBD | Adds schema complexity across every monetary table; defer until forced. |
| Expense claims | TBD | Relevant to every vertical; simple enough that we may eventually own it. |
| HR / payroll | Gusto or ADP (TBD) | Regulated and complex; integrate only, never build. |
| CRM | TBD | Out of scope; no vertical-driven need beyond the existing Clients + Contacts core data. |

Bank reconciliation in particular is **inside `accounting`** — Plaid is the data source, and the reconciliation UI, matching rules, and journal-entry creation all belong to the `accounting` module. It is not a standalone module.

---

### 3.16 Demo Tenants  [in-scope]

Two named demo tenants exercise the product surface area. They are referenced by name in screenshots, walkthroughs, and seed scripts.

#### 3.16.1 Meridian Group (consulting holding company)

- **Modules exercised:** all core (`system`, `system/core`, `accounting`, `ap`, `ar`, `projects`, `activities`, `reports`).
- **Vertical:** services — `contracts`, `timesheets`, `scheduling`.
- **Structure:** holding company with three legal entities, so it exercises **intercompany accounting** (see §3.9.7).
- **Does not require:** `bom`, `procurement`, `inventory`.
- **Purpose:** prove the core product on a realistic multi-entity services book.

#### 3.16.2 Sterling Ridge Homes (construction company)

- **Modules exercised:** all core plus the construction vertical.
- **Vertical:** construction — `contracts`, `bom`, `procurement`, `inventory` (plus `scheduling`, `timesheets` where applicable).
- **Workflows exercised:** AR closing statement flow (§3.8.4), WIP tracking, unit/lot management, draw schedules, vertical feature selection.
- **Purpose:** drive out the construction-vertical requirements and stress-test architecture flexibility (vertical-specific contracts, GL posting from a vertical module, inventory/WIP/project account relationships).

---

## 4. Standard API Patterns  [in-scope]

All API routes are built from scratch using pg-schemata's TableModel and QueryModel as the data layer.

### 4.1 CRUD Operations  [in-scope]

Every resource entity uses `createRouter` to generate a consistent REST API backed by pg-schemata:

| Method                | Path                              | Operation                                                                                    | Auto Middleware                                                                                 | pg-schemata Method |
| --------------------- | --------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------ |
| `POST /`            | Create single record              | `addAuditFields`, `moduleEntitlement`                                                    | `model.insert(dto)`                                                                           |                    |
| `GET /`             | List with cursor-based pagination | `moduleEntitlement`                                                                        | `model.findAfterCursor()`                                                                     |                    |
| `GET /where`        | Query with JSON conditions        | `moduleEntitlement`                                                                        | `model.findWhere()`                                                                           |                    |
| `GET /archived`     | Query archived records            | `moduleEntitlement`                                                                        | `controller.getWhere()` (same handler as `/where`)                                          |                    |
| `GET /ping`         | Health check                      | none                                                                                         | —                                                                                              |                    |
| `GET /:id`          | Get by ID                         | `moduleEntitlement`                                                                        | `model.findById()`                                                                            |                    |
| `POST /bulk-insert` | Batch create                      | `addAuditFields`, `moduleEntitlement`                                                    | `model.bulkInsert()`                                                                          |                    |
| `POST /import-xls`  | Import from Excel                 | `addAuditFields`, `moduleEntitlement`, `setImportAction`, `rbac('full')`, `multer` | `model.importFromSpreadsheet()`                                                               |                    |
| `POST /export-xls`  | Export to Excel                   | `moduleEntitlement` (read-level), `setExportAction`, `rbac('view')`                    | `model.exportToSpreadsheet()`                                                                 |                    |
| `PUT /bulk-update`  | Batch update                      | `addAuditFields`, `moduleEntitlement`                                                    | `model.bulkUpdate()`                                                                          |                    |
| `PUT /update`       | Update by query-param filters     | `addAuditFields`, `moduleEntitlement`                                                    | `model.updateWhere()`                                                                         |                    |
| `DELETE /archive`   | Soft-delete                       | `addAuditFields`, `moduleEntitlement`                                                    | `model.updateWhere()` (manually sets `deactivated_at = new Date()`)                         |                    |
| `PATCH /restore`    | Restore soft-deleted record       | `addAuditFields`, `moduleEntitlement`                                                    | `model.updateWhere()` (manually clears `deactivated_at`, with `includeDeactivated: true`) |                    |

> **Note:** `withMeta` is not auto-applied by `createRouter` — each router passes it via per-method middleware arrays (e.g., `getMiddlewares: [meta]`). `rbac()` is not included in the standard CRUD chain; it must be explicitly added on custom endpoints that need per-action permission level checks. All standard routes can be individually disabled via `disable*` flags (e.g., `disablePost: true`).

### 4.2 Pagination  [in-scope]

Keyset-based pagination via pg-schemata's `findAfterCursor()`:

- `cursor`: Last seen ID/sort value for next page
- `limit`: Page size
- `orderBy`: Sort column(s)
- `columnWhitelist`: Restrict returned columns
- `includeDeactivated`: Include soft-deleted records

### 4.3 Audit Fields  [in-scope]

Most models define `hasAuditFields: { enabled: true, userFields: { type: 'uuid' } }`. Exceptions: `policy_catalog` (`hasAuditFields: { enabled: false }` — seed-only reference data). pg-schemata manages `created_at`/`updated_at` timestamps automatically. **Audit actor resolution** (`created_by` / `updated_by`) is handled by the ALS resolver registered through `registerAuditResolver` (see Request-context plumbing below) — these columns are no longer threaded through `req.body`. The `addAuditFields` Express middleware retains its name for historical reasons but now only injects **tenant context** (`tenant_code` and `tenant_id` from `req.user`) on POST requests, with skip logic for tenant creation and user registration. It still acts as the guard that rejects mutation requests with no user context.

**Request-context plumbing:**

- `apps/server/src/middleware/auditContext.js` — wraps each request in an AsyncLocalStorage context carrying the audit identity. Runs after `authRedis` so `req.user` is hydrated before the store is populated.
- `apps/server/src/lib/requestContext.js` + `apps/server/src/lib/registerAuditResolver.js` — register a tenant-aware resolver with pg-schemata that pulls the current user id from the ALS context. pg-schemata invokes this resolver for every insert/update, so `created_by`/`updated_by` are filled at the model layer regardless of whether the controller touched `req.body`.
- Direct model calls inside services therefore do not need to thread the user id manually — the ALS store carries it as long as the call originated inside an Express request.

### 4.4 Soft Deletes  [in-scope]

Most models define `softDelete: true`. Exceptions: `roles` (`softDelete: false`), `ledger_balances` and `posting_queues` (`softDelete: false` — append-only), `policy_catalog` (`softDelete: false`). pg-schemata automatically excludes records where `deactivated_at IS NOT NULL` from all read queries. Archive and restore are implemented manually in `BaseController` using `model.updateWhere()` — setting or clearing `deactivated_at` directly rather than using pg-schemata's `removeWhere()`/`restoreWhere()` methods.

### 4.5 Validation  [in-scope]

pg-schemata auto-generates Zod validators from schema definitions:

- Insert validation: enforces `notNull` columns, type coercion, immutable fields
- Update validation: excludes `immutable` columns, partial validation
- Custom validators can be attached per-column via `colProps.validator`

### 4.6 Excel Import/Export  [in-scope]

> **ADR Reference:** [ADR-0023](./decisions/0023-excel-import-export.md)

Built into pg-schemata's TableModel and exposed as a full-stack feature across all `createRouter`-generated resources.

#### 4.6.1 Backend (pg-schemata + Controller Layer)

- **Import**: `importFromSpreadsheet(filePath, sheetIndex, callbackFn?, _returning?, { previewOnly })` — parses XLSX, validates against schema, bulk inserts with audit fields. `BaseController.importXls()` handles file upload via multer (`/tmp/uploads/`), injects `tenant_code` and `created_by` via the callback. Default commit return shape is `{ inserted: number }` (legacy single-sheet) or `{ inserted, updated, ... }` (flat-format importers).
- **Import preview mode (`?preview=1`)**: Importers that go through `importSimpleTable` (in `lib/spreadsheetHelpers.js`) or the flat combined / multi-sheet paths honor `previewOnly` and return a **counts-only classification payload** without writing:

  ```json
  { "preview": true, "inserts": 0, "updates": 0, "noops": 0, "omitted": 0, "errors": [] }
  ```

  Flat-combined and multi-sheet variants extend the shape with `restores`, `phones`, `addresses`, `taxIds`, `appUserSkipped` where relevant. `BaseController.importXls` toggles preview when the request carries `?preview=1` or `?preview=true`. Validation errors short-circuit to a 422 with the same `errors` array — preview and commit see identical row classification, so a clean preview commits without surprises. Preview is honored by ~16 entities currently on the `importSimpleTable` path plus the Vendors flat-combined path and the Tenants importer; multi-sheet legacy importers that have not been migrated still write on `?preview=1` (a no-op flag for them).
- **Export**: `exportToSpreadsheet(filePath, where?, joinType?, options?)` — queries with filtering, writes to XLSX. `ViewController.exportXls()` generates a temp file, sends it via `res.download()`, and cleans up the temp file after transfer. Accepts optional `where` array and `joinType` (`AND`/`OR`) in the request body for filtered exports.

**Core Entity Override — Multi-Sheet Import/Export:**

The 5 core entity models (Vendors, Clients, Employees, Contacts, Companies) override the default pg-schemata `importFromSpreadsheet()` / `exportToSpreadsheet()` methods with custom multi-sheet logic via `spreadsheetHelpers.js`. These entities use the polymorphic `sources` pattern with child tables (phone numbers, addresses, tax identifiers), which requires:

- **Export** (`exportSourceEntity`): Queries the parent table, strips internal columns (audit fields, `tenant_id`, `source_id`, `deactivated_at`), appends a derived `status` column, and writes child data (phones, addresses, tax IDs) to separate sheets in a single XLSX workbook via `@nap-sft/tablsx` WorkbookBuilder.
- **Import** (`importSourceEntity`): Parses multi-sheet workbooks, partitions rows into inserts vs updates (by `id` presence), executes updates with soft-delete/restore logic, bulk inserts new records with auto-generated source records and numbering-service codes, optionally provisions `portal_users` login records (when `appUserProvisioning` is enabled), and imports child sheets with delete-and-reinsert per parent. Returns an extended result: `{ inserted, updated, phones, addresses, taxIds, appUserSkipped }`.
- **Config-driven**: Each entity defines a `SourceEntityConfig` specifying `entityName`, `sheetName`, `sourceType`, `idType`, `buildLabel`, `boolCols`, `childSheets`, and `appUserProvisioning`.

All other entities (non-source) use the default pg-schemata single-sheet import/export path.

**RBAC Enforcement:**

- Import routes require `rbac('full')` — `setImportAction` overrides `req.resource.action = 'import'` before RBAC resolution
- Export routes require `rbac('view')` — `setExportAction` overrides `req.resource.action = 'export'` before RBAC resolution
- Both routes also enforce `moduleEntitlement`

**Disabling:** Individual resources can disable import/export via `disableImportXls: true` or `disableExportXls: true` in the `createRouter` options.

#### 4.6.2 Frontend (Hooks + Components)

**Custom Hooks** (`hooks/useImportExport.js`):

- `useImportXls(importFn, queryKey)` — TanStack `useMutation` wrapper. Calls the API import function with FormData, invalidates the query cache on success. Returns a mutation object.
- `useExportXls(exportFn, filePrefix)` — TanStack `useMutation` wrapper. Calls the API export function, creates a blob URL, triggers browser download as `${filePrefix}_${Date.now()}.xlsx`, and cleans up the URL. Returns a mutation object.

**Shared Component** (`components/shared/ImportDialog.jsx`):

- Wraps `FormDialog` with a file picker (accepts `.xlsx`, `.xls`)
- Displays file size in KB
- Passes FormData with `file` field to the `onSubmit` callback
- Submit button disabled until a file is selected; resets file state on close

**Page Integration Pattern:**
All pages with import/export follow this pattern:

1. **Permission check**: `resolveLevel(caps, module, entity, 'import') === 'full'` for import; `resolveLevel(caps, module, entity, 'export') !== 'none'` for export
2. **Mutation setup**: `useImportXls(api.importXls, [queryKey])` / `useExportXls(api.exportXls, 'prefix')`
3. **Handlers**: `useCallback` wrapping `mutateAsync` — import handler toasts `Imported ${result.inserted} records`, export handler toasts `Export downloaded`
4. **Toolbar registration**: Import/Export buttons added to `useModuleToolbarRegistration()` actions, gated by permission booleans, disabled while `isPending`
5. **Dialog**: `<ImportDialog>` controlled by `importOpen` state

> **Stability note**: Destructure `mutateAsync` directly from mutations (e.g., `const { mutateAsync: importAsync } = useImportXls(...)`) — `mutateAsync` is a stable reference. Never pass the whole mutation object as a `useCallback` dependency (causes infinite re-renders via the toolbar registration cycle).

#### 4.6.3 Pages with Import/Export

All resources using `createRouter` have import/export endpoints. The following pages have full client-side import/export wiring:

| Page                 | Module     | Entity            | API Service            | Query Key           |
| -------------------- | ---------- | ----------------- | ---------------------- | ------------------- |
| VendorsPage          | core       | vendors           | `vendorApi`          | `vendors`         |
| ClientsPage          | core       | clients           | `clientApi`          | `clients`         |
| EmployeesPage        | core       | employees         | `employeeApi`        | `employees`       |
| ContactsPage         | core       | contacts          | `contactApi`         | `contacts`        |
| CompaniesPage        | core       | companies         | `companyApi`         | `companies`       |
| PaymentTermsPage     | core       | payment-terms     | `paymentTermApi`     | `paymentTerms`    |
| ChartOfAccountsPage  | accounting | chart-of-accounts | `chartOfAccountsApi` | `chartOfAccounts` |
| JournalEntriesPage   | accounting | journal-entries   | `journalEntryApi`    | `journalEntries`  |
| ProjectsPage         | projects   | projects          | `projectApi`         | `projects`        |
| ChangeOrdersPage     | projects   | change-orders     | `changeOrderApi`     | `changeOrders`    |
| ActivitiesPage       | activities | activities        | `activityApi`        | `activities`      |
| CategoriesPage       | activities | categories        | `categoryApi`        | `categories`      |
| DeliverablesPage     | activities | deliverables      | `deliverableApi`     | `deliverables`    |
| BudgetManagementPage | activities | budgets           | `budgetApi`          | `budgets`         |
| CostTrackingPage     | activities | actual-costs      | `actualCostApi`      | `actualCosts`     |
| ApInvoicesPage       | ap         | ap-invoices       | `apInvoiceApi`       | `apInvoices`      |
| PaymentsPage         | ap         | payments          | `paymentApi`         | `payments`        |
| CreditMemosPage      | ap         | ap-credit-memos   | `apCreditMemoApi`    | `apCreditMemos`   |
| ArInvoicesPage       | ar         | ar-invoices       | `arInvoiceApi`       | `arInvoices`      |
| ReceiptsPage         | ar         | receipts          | `receiptApi`         | `receipts`        |
| CatalogPage          | bom        | catalog-skus      | `catalogSkuApi`      | `catalogSkus`     |
| VendorContactsPanel  | core       | vendor-contacts   | `vendorContactApi`   | `vendorContacts`  |

> **Vendor Contacts** are imported/exported from the parent Vendor edit dialog rather than a stand-alone page — see §3.3.1a. The router exposes `/api/core/v1/vendor-contacts/import-xls` and `/export-xls`.

---

## 5. Database Design  [in-scope]

### 5.1 Common Columns  [in-scope]

Aggregate-root tables include (managed by pg-schemata schema definitions):

- `id`: UUID primary key (default `gen_random_uuid()`, `immutable: true`)
- `tenant_id` / `tenant_code`: Tenant isolation (present on top-level entities like vendors, clients, projects, chart_of_accounts, etc.)
- `created_at`, `updated_at`: Timestamps (via `hasAuditFields`)
- `created_by`, `updated_by`: User UUID references (via `hasAuditFields`)
- `deactivated_at`: Soft delete marker (via `softDelete: true`)

> **Note:** Child and junction tables (units, tasks, cost_items, change_orders, budgets, cost_lines, actual_costs, etc.) do NOT have `tenant_id` — they rely on FK cascades to their parent tables for tenant isolation.

> **Column listing conventions in §3:** Many tables in §3 omit `id` (uuid PK) and `tenant_id` (uuid, not null, immutable) from their column listings for brevity — these columns are present in the actual schema files. The `id` column follows the standard pattern: `{ name: 'id', type: 'uuid', default: 'gen_random_uuid()', notNull: true, immutable: true, colProps: { cnd: true } }`. Check the actual schema file for the definitive column list.

### 5.2 Naming Conventions  [in-scope]

- Tables: plural `snake_case` (e.g., `vendor_skus`)
- Columns: `snake_case`
- Foreign keys: must specify `onDelete` behavior in schema definition
- All FK columns are indexed via schema `constraints.indexes`

### 5.3 Generated Columns  [in-scope]

Generated columns are deliberately excluded from pg-schemata schema definitions (to keep them out of INSERT/UPDATE ColumnSets) and added via `ALTER TABLE ... ADD COLUMN ... GENERATED ALWAYS AS ... STORED` in migration files:

- `template_cost_items.amount = quantity * unit_cost`
- `cost_lines.amount = quantity * unit_price`
- `cost_items.amount = quantity * unit_cost`

### 5.4 Schema Management & Migrations  [in-scope]

**Table Creation:**

- Each model's schema definition is the source of truth for DDL
- Table creation happens inside individual migration `up()` functions — migrations iterate models using `orderModels()` (topological FK sort) and call `model.createTable()` individually
- New tenant provisioning runs the migrator (not `bootstrap()`) with the tenant's schema name

**Migrations via custom `createMigrator`:**

- AXERRA uses a custom `createMigrator({ modules })` system (in `src/db/migrations/createMigrator.js`), NOT pg-schemata's `MigrationManager`
- Each module defines migrations via `defineMigration()` (`src/db/migrations/defineMigration.js`) with `id`, `description`, and `up()` function
- Module scope filtering (admin vs tenant) is handled programmatically by `src/db/migrations/moduleScopes.js` using the module registry's `scope` property — there are no separate migration directories
- `src/db/migrations/modelPlanner.js` performs the topological FK sort over the resolved model set so `createTable()` runs in dependency order during migrations and tenant provisioning
- Checksums are computed from `id + description` and stored in the history table, but are not validated on subsequent runs (modified migration bodies are not detected)
- PostgreSQL advisory locks prevent concurrent migration runs
- `pgschemata.migrations` table tracks applied migrations with primary key `(schema_name, module_name, migration_id)`

**Migration Order:**

1. `202502110001` — Bootstrap admin (tenants, portal_users, impersonation_logs, match_review_logs). Seeds root tenant + super user. Note: `portal_users` uses polymorphic `entity_type`/`entity_id` instead of `employee_id`; `axe_admin_phones` and `axe_admin_addresses` removed.
2. `202502110010` — Core RBAC tables (roles, policies, policy_catalog, state_filters, field_group_definitions, field_group_grants, project_members, company_members). Note: `role_members` has been removed — role assignment is stored as a `roles` text array on entity tables.
3. `202502110011` — Core entity tables (sources, vendors, clients, employees, contacts, addresses, phone_numbers, companies, tax_identifiers). Note: all four entity tables include `roles` (text[]) and `is_app_user`; `contacts` is a first-class entity (miscellaneous payees); `sources` CHECK includes `'contact'` and `'company'`; `clients` includes `email`; `employees` includes `email`, `is_primary_contact`, `is_billing_contact`; `tax_identifiers` replaces the former `tax_id` column on entity tables.
4. `202502250012` — Numbering system tables (tenant_numbering_config, tenant_number_sequence_state).
5. `202502110020` — Project tables (projects, project_clients, units, task_groups, tasks_master, tasks, cost_items, change_orders, template_units, template_tasks, template_cost_items, template_change_orders). Note: `projects.client_id` removed; replaced by `project_clients` junction table.
6. `202502110040` — Activity tables (categories, activities, deliverables, deliverable_assignments, budgets, cost_lines, actual_costs, vendor_parts)
7. `202502110030` — BOM tables (catalog_skus, vendor_skus, vendor_pricing) with pgvector
8. `202502110070` — Accounting tables (chart_of_accounts, journal_entries, journal_entry_lines, ledger_balances, posting_queues, category_account_map, company_accounts, company_transactions, internal_transfers). Note: accounting runs before AP/AR because `ap_invoice_lines` and `ar_invoice_lines` FK to `chart_of_accounts`.
9. `202502110050` — AP tables (ap_invoices, ap_invoice_lines, payments, ap_credit_memos)
10. `202502110060` — AR tables (ar_invoices, ar_invoice_lines, receipts). Note: `ar_clients` removed — AR invoices reference the unified `clients` table directly.
11. `202502120080` — SQL views (export views, profitability views, cashflow views, aging views)
12. `202603150013` — Import/export policy-catalog rows (`importExportCatalog`)
13. `202603270015` — Tenant preferences table + seeder (`tenantPreferences`)
14. `202603270016` — Reseed policy catalog (`reseedPolicyCatalog`) — invokes `policyCatalogReconciler`
15. `202604270017` — Orphan `sources` cleanup (`orphanSourceCleanup`)
16. `202605010001` — Orphan portal_users cleanup helpers (`orphanPortalUsersCleanup`) — admin-scope; installs the `admin.find_orphan_portal_users` / `admin.count_orphan_portal_users` / `admin.cleanup_orphan_portal_user` SQL functions
17. `202605040018` — Reseed tenant import/export catalog rows (`reseedTenantImportExportCatalog`)

> (List extended per gaps 2.19 / 2.20 / 4.15, 2026-05-21.)

---

## 6. UI Components & Theming  [in-scope]

### 6.1 Theme System  [in-scope]

Dual-mode theming with automatic OS preference detection:

**Light Mode:**

- Primary: `#003e6b` (dark navy)
- Secondary: `#f79c3c` (orange)
- Background: `#f5f5f5` / paper `#ffffff`

**Dark Mode (GitHub-Dark inspired):**

- Primary: `#f6b21b` (gold/amber)
- Secondary: `#0ea5e9` (sky blue)
- Background: `#080B10` / paper `#161B22`

Custom background tokens: `sidebar`, `header`, `surface` for layout zones.

#### 6.1.1 Component Override Strategy

Styling decisions follow a three-tier hierarchy:

1. **Theme overrides** (`theme.js` → `components`): Repeatable visual defaults that apply globally — border radius, elevation, font sizes, colour, border treatments. These eliminate the need for identical `sx` props across multiple component instances.
2. **Layout tokens** (`layoutTokens.js`): Structural dimensions (widths, heights, positions) and composite `sx` presets for layout chrome. Tokens hold **no visual styling** — only geometry, spacing, and `position`/`z-index` that vary by layout context.
3. **Inline `sx`**: Dynamic, conditional, or one-off values — active-state highlighting, per-instance spacing overrides, responsive breakpoints. Used only when the value cannot be determined at theme-build time.

**Decision tree — where does a style belong?**

| Question                                                    | Yes →         | No →          |
| ----------------------------------------------------------- | -------------- | -------------- |
| Is it used on 3 + instances of the same MUI component?      | Theme override | ↓             |
| Is it a structural dimension or position for layout chrome? | Layout token   | ↓             |
| Is it dynamic (depends on props, state, or route)?          | Inline `sx`  | Theme override |

#### 6.1.2 Design Tokens (`tokens.js` + `layoutTokens.js`)

**Mode-independent tokens (`tokens.js`):**

| Export                 | Contents                                                                                                                                                                    |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `density`            | Flat map of named pixel values:`sectionGap`, `stackGap`, `fieldGap`, `controlHeight`, `controlHeightSm`, `tableRowHeight`, `tableCellPadY`, `tableCellPadX` |
| `radius`             | Border radius values (`control`, `card`, `modal`, `chip`)                                                                                                           |
| `typographyTokens`   | Font presets:`body` (fontSize 14, fontWeight 500), `sectionLabel`, `tableHead`, `breadcrumb`, `pageTitle`                                                         |
| `motion`             | Animation/transition presets                                                                                                                                                |
| `createTokens(mode)` | Returns mode-dependent tokens:`border`, `surface`, `shadow`                                                                                                           |

**Structural constants (`layoutTokens.js`):**

| Token                                               | Value                                                  | Used By                                                     |
| --------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------- |
| `SIDEBAR_WIDTH_EXPANDED` / `SIDEBAR_WIDTH_OPEN` | `242`                                                | Sidebar, LayoutShell                                        |
| `SIDEBAR_WIDTH_COLLAPSED`                         | `110`                                                | Sidebar, LayoutShell                                        |
| `TENANT_BAR_HEIGHT`                               | `48`                                                 | TenantBar, ModuleBar (sticky offset), theme (Toolbar dense) |
| `MODULE_BAR_HEIGHT`                               | `48`                                                 | ModuleBar                                                   |
| `FONT.navGroup`                                   | `{ fontSize: '0.8125rem', letterSpacing: '0.02em' }` | Sidebar group labels                                        |
| `FONT.navItem`                                    | `{ fontSize: '0.8125rem' }`                          | Sidebar child labels                                        |
| `FONT.toolbar`                                    | `{ fontSize: '0.8125rem' }`                          | Defined but not currently imported by any component         |
| `FONT.toolbarAction`                              | `{ fontSize: '0.8125rem' }`                          | ModuleBar filter inputs                                     |
| `FONT.breadcrumb`                                 | (from `typographyTokens`)                            | ModuleBar breadcrumbs                                       |
| `FONT.pageTitle`                                  | (from `typographyTokens`)                            | Page title headings                                         |

**Composite sx presets** (spread into component `sx`):

| Preset                    | Contains                                                                                            | Purpose                                                      |
| ------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `tenantBarSx`           | `height`, `minHeight`, `bgcolor`, `borderBottom`, `borderColor`, `boxShadow`, `color` | TenantBar AppBar root                                        |
| `moduleBarSx`           | `height`, `minHeight`, `bgcolor`, `borderBottom`, `borderColor`                           | ModuleBar container                                          |
| `sidebarPaperSx(width)` | `width`, `transition`, `overflowX`, `boxSizing`, `borderRight`, `borderColor`           | Sidebar Drawer paper                                         |
| `pageContainerSx`       | `height: 100%`, `display: flex`, `flexDirection: column`, `gap` (density.sectionGap)        | Full-height flex column for DataGrid page wrapper            |
| `formGridSx`            | `display: grid`, `gridTemplateColumns: 'repeat(2, 1fr)'`, `gap` (density.fieldGap px)         | Two-column grid layout for form sections                     |
| `formFullSpanSx`        | `gridColumn: 1 / -1`                                                                              | Full-width span inside formGridSx                            |
| `formGroupCardSx`       | `gridColumn: 1 / -1`, `p: 2`, `border`, `borderColor`, `borderRadius`                     | Bordered card for repeatable form groups (addresses, phones) |
| `formSectionHeaderSx`   | `gridColumn: 1 / -1`, `mb: -1`                                                                  | Full-span header inside form grid                            |
| `masterDetailSx`        | `display: flex`, `flexDirection: row`, `height: 100%`, `gap` (density.sectionGap)           | Master-detail split layout container                         |
| `masterPanelSx`         | `width: 38%`, `minWidth: 340`, `display: flex`, `flexDirection: column`                     | Left panel of master-detail                                  |
| `detailPanelSx`         | `flex: 1`, `minWidth: 0`, `display: flex`, `flexDirection: column`, `overflow: auto`      | Right panel of master-detail                                 |

#### 6.1.3 Theme Overrides Reference

All MUI component overrides defined in `theme.js`:

| Component             | Override Type                 | What It Sets                                                                                                                                                                                                                                                                                         |
| --------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MuiCssBaseline`    | styleOverrides                | Font smoothing (`WebkitFontSmoothing`, `MozOsxFontSmoothing`)                                                                                                                                                                                                                                    |
| `MuiPaper`          | styleOverrides                | Token-driven `border`, `boxShadow`, `borderRadius`, no `backgroundImage`                                                                                                                                                                                                                     |
| `MuiAppBar`         | defaultProps + styleOverrides | `elevation: 0`, bottom divider border, no shadow/backgroundImage                                                                                                                                                                                                                                   |
| `MuiToolbar`        | styleOverrides (dense)        | `minHeight: 48` (TENANT_BAR_HEIGHT)                                                                                                                                                                                                                                                                |
| `MuiDrawer`         | styleOverrides (paper)        | `boxSizing`, sidebar `backgroundColor`, `borderRight`, `overflowX: hidden`, `border: 'none'`, `backgroundImage: 'none'`                                                                                                                                                                  |
| `MuiCard`           | defaultProps + styleOverrides | `elevation: 0`, `borderRadius` from card token                                                                                                                                                                                                                                                   |
| `MuiDialog`         | styleOverrides (paper)        | `borderRadius` (modal token), token border, modal shadow, no `backgroundImage`                                                                                                                                                                                                                   |
| `MuiDialogTitle`    | styleOverrides                | `position: sticky`, `top: 0`, `zIndex: 1`, `backgroundColor: background.paper`, bottom border, `fontSize: 18`, `fontWeight: 650`                                                                                                                                                         |
| `MuiDialogContent`  | styleOverrides                | `padding: 16`                                                                                                                                                                                                                                                                                      |
| `MuiDialogActions`  | styleOverrides                | `padding: 16`, top border, `gap: 10`                                                                                                                                                                                                                                                             |
| `MuiButton`         | defaultProps + styleOverrides | `disableElevation`, `borderRadius`, `minHeight`, padding, transitions, disabled `opacity: 0.35`, small `fontSize: 0.8rem`; variant-specific: containedPrimary brightness filters, outlined border/hover, text hover overlay                                                                |
| `MuiToggleButton`   | styleOverrides                | `textTransform: 'none'`, transitions; small: `fontSize: 0.8rem`, compact padding                                                                                                                                                                                                                 |
| `MuiTextField`      | defaultProps                  | `size: 'small'`, `variant: 'outlined'`                                                                                                                                                                                                                                                           |
| `MuiOutlinedInput`  | styleOverrides                | `borderRadius`, `minHeight`, transition, hover border color, subtle notched outline, autofill background fix                                                                                                                                                                                     |
| `MuiInputLabel`     | styleOverrides                | `color: text.secondary`                                                                                                                                                                                                                                                                            |
| `MuiFormHelperText` | styleOverrides                | `marginLeft: 0`, `marginRight: 0`                                                                                                                                                                                                                                                                |
| `MuiCheckbox`       | styleOverrides                | `padding: 8`, transition                                                                                                                                                                                                                                                                           |
| `MuiTableContainer` | styleOverrides                | `borderRadius` (card token), token border                                                                                                                                                                                                                                                          |
| `MuiTableHead`      | styleOverrides                | `backgroundColor` from header overlay token                                                                                                                                                                                                                                                        |
| `MuiTableCell`      | styleOverrides                | Token border-bottom, cell padding (X/Y tokens); head variant: token fontSize/fontWeight/letterSpacing,`text.secondary` colour                                                                                                                                                                      |
| `MuiTableRow`       | styleOverrides                | Token `height`, hover transition, hover/selected/selected-hover background overlays                                                                                                                                                                                                                |
| `MuiListItemButton` | styleOverrides                | `borderRadius: 8`, hover overlay, selected state with left accent bar (`::before` pseudo-element)                                                                                                                                                                                                |
| `MuiListItemIcon`   | styleOverrides                | `minWidth: 36`, `opacity: 0.62`, transition                                                                                                                                                                                                                                                      |
| `MuiListItemText`   | styleOverrides (primary)      | `fontSize: 14`, `fontWeight: 550`                                                                                                                                                                                                                                                                |
| `MuiChip`           | styleOverrides (sizeSmall)    | `fontWeight: 600`, `fontSize: 0.75rem`                                                                                                                                                                                                                                                           |
| `MuiAvatar`         | named variant `"header"`    | 32 × 32, primary colours, cursor pointer, 0.8rem bold                                                                                                                                                                                                                                               |
| `MuiDataGrid`       | defaultProps + styleOverrides | `density: compact`, token `rowHeight`, `columnHeaderHeight: 40`, `disableColumnMenu: false`; border, transparent bg, token fontSize, focus ring, `.row-archived { opacity: 0.5 }`, row-actions kebab hidden until hover, header bg/border, row hover/selected, cell padding, footer border |

### 6.2 Navigation System  [in-scope]

Navigation is configured via `navigationConfig.js` with capability-based filtering. Each top-level nav group has an icon, label, optional `capability` guard, and an array of child items with `path` and optional per-item `capability`.

```
Primary Group -> Leaf items
  Admin (AdminPanelSettingsIcon, capability: core::)
    +-- Vendors (/core/vendors, capability: core::vendors)
    +-- Clients (/core/clients, capability: core::clients)
    +-- Employees (/core/employees, capability: core::employees)
    +-- Contacts (/core/contacts, capability: core::contacts)
    +-- Roles (/tenant/manage-roles, capability: core::roles)
  Tenants (BusinessIcon, capability: tenants::, rootTenantOnly: true)
    +-- Manage Tenants (/tenant/manage-tenants, capability: tenants::)
    +-- Manage Users (/tenant/manage-users, capability: tenants::)
```

Extensible design: add new groups/modules to `NAV_ITEMS` array with optional `capability` guards and `rootTenantOnly` flag. Groups with `rootTenantOnly: true` are only visible to Axerra users. The example above shows only 2 of 14 nav groups — see §7 for the complete navigation structure.

### 6.3 Module Bar (Dynamic Toolbar)  [in-scope]

The Module Bar has two zones:

- **Left zone**: Current module name and breadcrumb trail (e.g., `Admin > Manage Employees > Edit`). The module name is derived from the active navigation group; breadcrumbs reflect the current route hierarchy. Breadcrumb segments are currently rendered as plain text (`<Typography>`) — they are not clickable links (all crumbs are constructed with `path: null` in `ModuleBar.jsx`).
- **Right zone**: Dynamic toolbar actions registered by page components via `useModuleToolbarRegistration()`:
  - **Tabs**: Toggle button groups with exclusive/non-exclusive selection
  - **Filters**: Text fields or select dropdowns
  - **Primary Actions**: Action buttons (Create, Edit, Archive, Restore, Import, Export, etc.)

### 6.4 Dependencies (Client)  [in-scope]

| Package                   | Version  | Purpose                                                  |
| ------------------------- | -------- | -------------------------------------------------------- |
| `react`                 | ^18.2.0  | UI library                                               |
| `react-dom`             | ^18.2.0  | DOM renderer                                             |
| `@mui/material`         | ^5.15.16 | UI component library                                     |
| `@mui/icons-material`   | ^5.15.16 | Material icons                                           |
| `@mui/x-data-grid`      | ^6.4.0   | Data grid for tables                                     |
| `@mui/x-charts`         | ^6.4.0   | Charting library (cashflow charts, profitability charts) |
| `@emotion/react`        | ^11.11.1 | CSS-in-JS (MUI peer dep)                                 |
| `@emotion/styled`       | ^11.11.0 | Styled components (MUI peer dep)                         |
| `@tanstack/react-query` | ^5.28.0  | Server state management                                  |
| `react-router-dom`      | ^7.9.6   | Client-side routing                                      |

### 6.5 Reusable Component Patterns  [in-scope]

Guidelines for maintaining consistency as the UI grows:

**sx Prop Guidelines:**

- Never duplicate a style in `sx` that the theme already provides. Check `theme.js` overrides first.
- Use `sx` only for: (a) conditional/dynamic values driven by props or state, (b) structural positioning (`position`, `top`, `zIndex`), (c) per-instance spacing (`px`, `py`, `mb`, `gap`).
- Spread layout token presets (e.g., `...moduleBarSx`) instead of inlining the same values.

**Typography in Navigation:**

- Sidebar group labels: spread `FONT.navGroup` into `primaryTypographyProps`.
- Sidebar child labels: spread `FONT.navItem` into `primaryTypographyProps`.
- ModuleBar breadcrumbs: use `FONT.toolbar`.
- Active-state font weight (`fontWeight: 600`) stays in `sx` because it is conditional.

**Named Variants:**

- Use MUI named variants for component "shapes" that differ from the global default but recur in multiple places (e.g., `variant="header"` on `Avatar`).
- Define new variants in `theme.js` → `components.Mui*.variants[]`.

**Shared List Selection & DataTable** (see ADR 0017):

All DataGrid CRUD pages use `useListSelection` + `DataTable` as the standard selection pattern:

| Utility                                 | Location                            | Purpose                                                                                                                                                                           |
| --------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useListSelection(rows, entityType?)` | `hooks/useListSelection.js`       | Selection state + derived booleans (`isSingle`, `hasSelection`, `allActive`, `allArchived`). Pass `entityType` for root-entity mutual exclusion (tenant/user pages).    |
| `DataTable`                           | `components/shared/DataTable.jsx` | Standardised DataGrid wrapper that integrates `useListSelection` with consistent column definitions, row styling, and toolbar registration.                                     |
| `useArchiveRestore(opts)`             | `hooks/useArchiveRestore.js`      | Archive/restore dialog state, async handlers (loops over `selectedRows`), ready-to-spread `ConfirmDialog` props. `restoreMut` optional for archive-only pages.              |
| `buildBulkActions(opts)`              | `utils/selectionUtils.js`         | Returns Archive/Restore toolbar button configs with count labels and disabled states. Defined but currently not imported by any page — pages construct toolbar actions manually. |

> **Note:** The former `useDataGridSelection` hook still exists but is no longer imported by any page. All pages have been migrated to `useListSelection` + `DataTable`.

**Critical:** Toolbar `useMemo` deps must use `selectedRows.length` (primitive), NOT `selectedRows` (array ref) — the latter causes infinite re-renders via the `ModuleActionsContext` registration cycle.

**Future Extraction Rules:**

- When three or more pages share the same layout pattern (e.g., list + detail pane), extract a shared wrapper component.
- Data-grid column definitions that repeat across modules should be centralised in a `columnDefs/` config folder.
- Form field groupings that appear in multiple create/edit dialogs should become reusable form section components.

**Shared Components (`apps/client/src/components/shared/`, as of 2026-05-21, gap 2.15):** Concrete inventory of shared components in use today. Additions land via PR — when extracting a new shared component, add it here.

| Component                          | Purpose                                                                                  |
| ---------------------------------- | ---------------------------------------------------------------------------------------- |
| `AddressesSection`                 | Read-only address list inside detail dialogs                                             |
| `ChangePasswordDialog`             | Self-service password change                                                             |
| `CollectionSectionHeader`          | Section header used above polymorphic collections (emails, phones, addresses, taxes)     |
| `ConfirmDialog`                    | Confirm / cancel dialog for destructive actions                                          |
| `CurrencyCell`                     | Data Grid currency renderer                                                              |
| `DataTable`                        | Standardised MUI X Data Grid v6 wrapper with `useListSelection` integration              |
| `DetailDialog`                     | Read-only detail dialog (matches `FormDialog` styling)                                   |
| `EditableAddressesSection`         | Diffed, persistable addresses editor                                                     |
| `EditableEmailsSection`            | Diffed, persistable emails editor (writes to the `emails` table — see §3.14.1)           |
| `EditablePhoneNumbersSection`      | Diffed, persistable phone numbers editor                                                 |
| `EditableTaxIdentifiersSection`    | Diffed, persistable tax identifiers editor                                               |
| `EmailRow`                         | Single-row email renderer used by Editable / read-only Emails sections                   |
| `EmailsSection`                    | Read-only email list                                                                     |
| `FieldRow`                         | Label/value field row for detail dialogs                                                 |
| `FormDialog`                       | Single-step form dialog                                                                  |
| `ImportDialog`                     | Shared XLSX file picker used by every import-enabled page                                |
| `PasswordField`                    | Password input with strength rules feedback                                              |
| `PatternTextField`                 | Masked / pattern-validated text input                                                    |
| `PercentCell`                      | Data Grid percentage renderer                                                            |
| `PhoneNumbersSection`              | Read-only phone numbers list                                                             |
| `PhoneRow`                         | Single-row phone renderer                                                                |
| `PrimaryButton` / `SecondaryButton` / `TertiaryButton` | Themed button variants matching the design system                    |
| `ReadOnlyDataTable`                | Non-selectable variant of `DataTable`                                                    |
| `ReportTablePage`                  | Standard layout for report pages (data grid + filters + export)                          |
| `ResetPasswordDialog`              | Admin-initiated password reset                                                           |
| `RowActionsMenu`                   | Per-row overflow menu (edit / archive / restore)                                         |
| `SetPasswordPopover`               | Inline password set popover (first login flow)                                           |
| `StatusBadge`                      | Chip renderer for entity status enums                                                    |
| `StepperFormDialog`                | Multi-step form dialog (used by `CreateTenantWizard` and similar flows)                  |
| `SummaryCard`                      | Dashboard summary card                                                                   |
| `TaxIdentifiersSection`            | Read-only tax identifiers list                                                           |
| `ToastSnackbar`                    | App-wide toast / snackbar host                                                           |
| `Wordmark`                         | Axerra wordmark logo                                                                     |

---

## 7. Navigation Structure  [in-scope]

Based on the sidebar navigation config (`navigationConfig.js`) and client-side routes (`App.jsx`):

| Primary Group                       | Sub-Modules (per-item capability)                                                                                                                                                  | Path Prefix                     | Group Capability Guard      |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | --------------------------- |
| **Dashboard**                 | Overview, Company Cashflow                                                                                                                                                         | `/dashboard`                  | —                          |
| **Projects**                  | Project List, Project Detail, Project Profitability                                                                                                                                | `/projects`                   | `projects::`              |
| **Activities**                | Categories (`activities::categories`), Activities (`activities::activities`)                                                                                                   | `/activities`                 | `activities::`            |
| **Budgets**                   | Deliverables (`activities::deliverables`), Budget Management (`activities::budgets`)                                                                                           | `/deliverables`, `/budgets` | `activities::`            |
| **Actual Costs**              | Cost Tracking (`activities::actual-costs`)                                                                                                                                       | `/actual-costs`               | `activities::`            |
| **Change Orders**             | Change Order Management (`projects::change-orders`)                                                                                                                              | `/change-orders`              | `projects::change-orders` |
| **AP**                        | Vendors (→`/core/vendors`), AP Invoices, Payments, Credit Memos, AP Aging                                                                                                       | `/ap`                         | `ap::`                    |
| **AR**                        | Clients (→`/core/clients`), AR Invoices, Receipts, AR Aging                                                                                                                     | `/ar`                         | `ar::`                    |
| **Accounting & GL**           | Chart of Accounts, Journal Entries, Ledger                                                                                                                                         | `/accounting`                 | `accounting::`            |
| **Reports**                   | Budget vs Actual, Profitability, Cashflow, Margin Analysis, P&L*(nav-only)*, Balance Sheet*(nav-only)*                                                                           | `/reports`                    | `reports::`               |
| **BOM**                       | Catalog SKUs (`bom::catalog-skus`), Vendor SKU Matching (`bom::vendor-skus`)                                                                                                   | `/bom`                        | `bom::`                   |
| **Settings**                  | Numbering (`core::numbering-config`), Payment Terms (`core::payment-terms`)                                                                                                    | `/settings`                   | `core::`                  |
| **Admin**                     | Vendors (`core::vendors`), Clients (`core::clients`), Employees (`core::employees`), Contacts (`core::contacts`), Companies (`core::companies`), Roles (`core::roles`) | `/core`, `/tenant`          | `core::`                  |
| **Tenants** *(Axerra only)* | Manage Tenants (`tenants::`), Manage Users (`tenants::`)                                                                                                                       | `/tenant`                     | `tenants::`               |

> **Nav-only items (no route or page component yet):** P&L (`/reports/pnl`) and Balance Sheet (`/reports/balance-sheet`) appear in the sidebar navigation config but have no matching routes in `App.jsx`. Clicking them falls through to the catch-all redirect (`/dashboard`).

> **Broken nav paths (route exists at a different path):** Project Profitability is listed under the Projects nav group at `/projects/profitability`, but the page component (`ProjectProfitabilityPage`) is routed at `/reports/profitability`. A working duplicate "Profitability" item also exists under the Reports nav group at `/reports/profitability`. Project Detail is listed at `/projects/detail`, but the actual route is dynamic (`/projects/:id`) — users navigate to it by clicking a row in the projects list, not via the sidebar.

> **AP/AR entity links:** The "Vendors" item under AP and "Clients" item under AR are `<Navigate>` redirects to `/core/vendors` and `/core/clients` respectively — they do not render separate pages.

> **Change Orders capability:** The nav guard now correctly uses `projects::change-orders`, matching the server router's `withMeta({ module: 'projects', router: 'change-orders' })`.

---

## 8. Environment Configuration  [in-scope]

| Variable                       | Purpose                                                                         | Default                   |
| ------------------------------ | ------------------------------------------------------------------------------- | ------------------------- |
| `DATABASE_URL_DEV/TEST/PROD` | PostgreSQL connection string                                                    | —                        |
| `REDIS_URL`                  | Redis connection for permission caching                                         | —                        |
| `ACCESS_TOKEN_SECRET`        | JWT access token signing key                                                    | —                        |
| `REFRESH_TOKEN_SECRET`       | JWT refresh token signing key                                                   | —                        |
| `ROOT_EMAIL`                 | Super user email for bootstrap                                                  | —                        |
| `ROOT_PASSWORD`              | Super user password for bootstrap                                               | —                        |
| `CORS_ORIGINS`               | Comma-separated allowed origins                                                 | `''` (empty string)     |
| `CLIENT_ORIGIN`              | Frontend URL                                                                    | `http://localhost:5173` |
| `COOKIE_SECURE`              | Secure cookie flag                                                              | `false` (dev)           |
| `COOKIE_SAMESITE`            | SameSite cookie policy                                                          | `Lax`                   |
| `BCRYPT_ROUNDS`              | Password hashing cost                                                           | 12                        |
| `ROOT_TENANT_CODE`           | Axerra tenant code for admin access                                             | `AXERRA`                |
| `VITE_ROOT_TENANT_CODE`      | Client-side Axerra tenant code                                                  | `AXERRA`                |
| `VITE_ROOT_COMPANY`          | Client-side Axerra company name (reserved, not currently used)                  | `Axerra`                |
| `VITE_ROOT_EMAIL_DOMAIN`     | Client-side Axerra email domain (reserved, not currently used)                  | `axerra.io`             |
| `PORT`                       | Express server port                                                             | `3000`                  |
| `HOST`                       | Express server host                                                             | `localhost`             |
| `NODE_ENV`                   | Runtime environment (`development`, `test`, `production`)                 | —                        |
| `OPENAI_API_KEY`             | OpenAI API key for BOM embedding service (`bom/services/embeddingService.js`) | —                        |
| `ROOT_TENANT_CODE`           | Root tenant code for bootstrap migration (falls back directly to `'AXERRA'`)  | `AXERRA`                |
| `ROOT_COMPANY`               | Root company name for bootstrap migration                                       | `Axerra LLC`            |

---

## 9. Testing Strategy  [in-scope]

| Suite                 | Location               | Purpose                                                                  |
| --------------------- | ---------------------- | ------------------------------------------------------------------------ |
| **Unit**        | `tests/unit/`        | Controller logic, middleware behavior, JWT/passport utils                |
| **Integration** | `tests/integration/` | API endpoint tests with seeded data via pg-schemata `bulkInsert()`     |
| **Contract**    | `tests/contract/`    | Router/controller API contract verification                              |
| **RBAC**        | `tests/rbac/`        | Permission resolution, deny overrides, system roles, module restrictions |

All tests use Vitest with dependency injection for controllers. `tests/setup.js` is a stub (to be expanded in later phases). Actual test DB setup and JWT helper fixtures live in `tests/helpers/testDb.js`.

---

## 10. Coding Standards & Best Practices  [in-scope]

### 10.1 Naming Conventions  [in-scope]

| Context                               | Convention                                             | Example                                                             |
| ------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------- |
| **DB tables**                   | snake_case (plural)                                    | `ap_invoices`, `cost_lines`, `vendor_skus`                    |
| **DB columns**                  | snake_case                                             | `tenant_id`, `invoice_date`, `total_amount`                   |
| **JS/TS variables & functions** | camelCase                                              | `invoiceTotal`, `findByCode()`, `parseToken()`                |
| **Classes & React components**  | PascalCase                                             | `TableModel`, `Vendors`, `ManageTenantsPage`, `AuthContext` |
| **Constants & env vars**        | SCREAMING_SNAKE_CASE                                   | `ACCESS_TOKEN_SECRET`, `BCRYPT_ROUNDS`, `MAX_PAGE_SIZE`       |
| **URL paths & route segments**  | kebab-case                                             | `/api/ar/v1/ar-invoices`, `/tenant/manage-users`                |
| **File names (modules)**        | camelCase for utils, PascalCase for classes/components | `authRedis.js`, `Vendors.js`, `ManageTenantsPage.jsx`         |
| **File names (schemas)**        | camelCase matching table                               | `apInvoicesSchema.js`, `vendorsSchema.js`                       |
| **CSS classes / tokens**        | camelCase (MUI sx) or kebab-case (CSS modules)         | `sx={{ marginTop: 2 }}`                                           |
| **Event handlers**              | `handle` + Event                                     | `handleRowClick`, `handleSubmit`, `handleArchive`             |
| **Boolean variables**           | `is`/`has`/`can`/`should` prefix               | `isActive`, `hasPermission`, `canApprove`                     |
| **Enums / status values**       | snake_case strings                                     | `'in_progress'`, `'change_order'`, `'pending'`                |

### 10.1.1 Single Canonical Names (No Aliases)  [in-scope]

Every concept, variable, parameter, and config key must have **exactly one name** throughout the codebase. Never accept multiple synonyms for the same value or create alias maps to normalize variant spellings. Ambiguity in naming is a bug factory.

**Bad — alias maps that normalize synonyms:**

```javascript
// DON'T: multiple names for the same concept
const aliasMap = {
  development: 'DEV', dev: 'DEV',
  production: 'PROD', prod: 'PROD',
  test: 'TEST', testing: 'TEST',
};
```

**Bad — fallback chains that accept multiple property names:**

```javascript
// DON'T: guessing which key the caller used
const rawGroups = rule.max_by_groups || rule.max_by_group;
const clinicId = clinicIdBody || clinicIdSnake || req.clinicId || req.user.clinicId;
```

**Good — one name, enforced everywhere:**

```javascript
// DO: pick one name and require it
const envSuffix = { development: 'DEV', production: 'PROD', test: 'TEST' }[NODE_ENV];
// Callers must use `max_by_groups` (plural) — the singular form is a bug, not a variant
const { max_by_groups } = rule;
```

**Rules:**

- Pick one canonical name per concept and use it everywhere (API, DB, UI, config)
- If an external API sends a different name, map it **once at the boundary** — never spread aliases through internal code
- Never silently accept misspellings or abbreviations; fail loudly so the caller fixes the source
- Environment variables, config keys, and request parameters each have exactly one accepted name

### 10.2 File & Module Structure  [in-scope]

**Keep modules small and focused.** Each file should have a single, clear responsibility.

**Server-side module layout has two tiers:**

`src/system/` contains the **core platform modules** that are always required and glue the application together:

- **`auth`** — authentication (login, JWT, session management) **and** admin-schema data layer (schemas, models, migrations, repositories for `tenants`, `portal_users`, `impersonation_logs`, `match_review_logs`). The auth module is registered in the module registry with `scope: 'admin'` and owns the `202502110001_bootstrapAdmin` migration that creates the admin schema.
- **`tenants`** — API layer for multi-tenant administration (controllers and routes for tenant CRUD, portal-user registration, impersonation, and match review logs). Tenants has **no schemas or models of its own** — controllers resolve models from the `auth` module's repositories via the global `db()` singleton. Routes are mounted at `/api/tenants/v1/`. This module is **not in the module registry** because it has no database artifacts; it is loaded directly in the route aggregator.
- **`core`** — tables required by all optional modules (sources, vendors, clients, employees, contacts, addresses, companies, RBAC)

`src/modules/` contains **optional feature modules** that tenants enable based on their needs:

- **`projects`** — Project management, units, tasks, cost items, change orders, templates
- **`activities`** — Activity tracking
- **`bom`** — Bill of Materials
- **`ar`** — Accounts Receivable
- **`ap`** — Accounts Payable
- **`accounting`** — General Ledger, Chart of Accounts
- **`reports`** — Reporting (includes cashflow & profitability views)

Both tiers follow the same internal layout:

```
<module>/                        # Inside src/system/ or src/modules/
  schemas/                       # pg-schemata schema definitions (one per table)
    apInvoicesSchema.js
    apInvoiceLinesSchema.js
  models/                        # TableModel subclasses (one per table)
    ApInvoices.js
    ApInvoiceLines.js
  controllers/                   # Business logic (one per resource)
    apInvoicesController.js
  apiRoutes/
    v1/                          # Versioned route definitions
      apInvoicesRouter.js
  services/                      # Cross-cutting business logic (optional)
    postingService.js
  <module>Repositories.js        # Repository map for moduleRegistry
  schema/migrations/             # Module-specific migrations
    index.js
```

Feature modules in `src/modules/` import platform code via relative paths (e.g., `../../../lib/BaseController.js`, `../../../system/core/` for platform modules). All modules — platform and feature — are registered in `src/db/moduleRegistry.js` and mounted in `src/apiRoutes.js`.

**Client-side page layout:**

```
src/
  pages/
    <Module>/                  # PascalCase module folder
      <Page>Page.jsx           # Page component (one per route)
      components/              # Page-specific sub-components
      hooks/                   # Page-specific custom hooks
  components/                  # Shared/reusable components
  hooks/                       # Shared custom hooks
  contexts/                    # React context providers
  services/                    # API client functions
  utils/                       # Pure utility functions
```

**Rules:**

- One class per file; file name matches class name
- One schema definition per file; file name matches table name (camelCase)
- Maximum ~200–300 lines per file; refactor if larger
- Group related exports via barrel `index.js` files at the module level

### 10.3 Copyright & File Headers  [in-scope]

Every source file must include a copyright header as the first content:

**JavaScript / JSX:**

```javascript
/**
 * @file <Brief description of what this file does>
 * @module <module/path>
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */
```

**SQL migration files:**

```sql
-- Migration: <migration_id>
-- Description: <what this migration does>
-- Copyright (c) 2025 – present Axerra LLC. All rights reserved.
```

### 10.4 Code Reuse & DRY Principles  [in-scope]

**Function reuse hierarchy (prefer higher over lower):**

1. **pg-schemata built-ins** — Use `TableModel`/`QueryModel` methods before writing custom SQL
2. **Shared utilities** (`packages/shared/`) — Cross-cutting helpers used by both client and server
3. **Module-level services** (`services/`) — Business logic shared across controllers within a module
4. **Controller helpers** — Private functions within a controller file

**Anti-patterns to avoid:**

- Duplicating query logic across controllers — extract to the model or a service
- Copy-pasting validation rules — define once in the schema, use pg-schemata's auto-generated Zod validators
- Reimplementing CRUD — use `createRouter`; only override specific routes when business rules differ
- Inline SQL strings in controllers — use model methods or named service functions

### 10.5 Classes vs Functions  [in-scope]

| Use Case                    | Pattern                                                               | Rationale                                                                                                                                                 |
| --------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Data models**       | Class extending `TableModel`                                        | Inheritance from pg-schemata; instance methods for custom queries                                                                                         |
| **Controllers**       | Class extending `BaseController` (which extends `ViewController`) | Inherits standardised CRUD handlers; override methods for custom logic. Auth and admin controllers are the exception — they use plain exported functions |
| **React components**  | Function components + hooks                                           | Modern React standard; hooks for state/effects                                                                                                            |
| **Middleware**        | Factory functions returning `(req, res, next)`                      | Composable; closures capture config                                                                                                                       |
| **Services**          | Exported functions (module pattern)                                   | Stateless business logic; easy to test and mock                                                                                                           |
| **Utilities**         | Pure exported functions                                               | No side effects; maximum reusability                                                                                                                      |
| **Context providers** | Function component +`createContext`                                 | React pattern for shared state                                                                                                                            |

**Never use:**

- Prototype-based inheritance (use ES6 classes or plain functions)
- `class` for React components (use function components exclusively)
- Singletons beyond `DB.init()` (use dependency injection instead)

### 10.6 Error Handling  [in-scope]

**Server-side:**

- Use pg-schemata's `DatabaseError` and `SchemaDefinitionError` for data-layer errors
- Controllers wrap operations in try/catch; pass errors to Express `next(err)`
- The central error handler middleware lives at `apps/server/src/middleware/errorHandler.js` (gap 2.21) and is mounted as the terminal Express 5 error middleware in `server.js`. It maps error types to HTTP status codes:

| Error Type                             | HTTP Status | Response                                                        |
| -------------------------------------- | ----------- | --------------------------------------------------------------- |
| `SchemaDefinitionError` (validation) | 400         | `{ error: 'Validation failed', details: [...] }`              |
| `DatabaseError` (23505 unique)       | 409         | `{ error: 'Duplicate record', constraint: '...' }`            |
| `DatabaseError` (23503 FK)           | 422         | `{ error: 'Referenced record not found' }`                    |
| RBAC deny                              | 403         | `{ error: 'Forbidden', required: '...', actual: '...' }`      |
| Auth failure                           | 401         | `{ error: 'Unauthorized' }`                                   |
| Not found                              | 404         | `{ error: 'Not found' }`                                      |
| Unhandled                              | 500         | `{ error: 'Internal server error' }` (no stack in production) |

**Client-side:**

- React Query `onError` callbacks handle API errors globally
- Toast/snackbar notifications for user-facing errors
- Never swallow errors silently — always log or display

### 10.7 Import & Export Style  [in-scope]

**ES Modules only** (no CommonJS):

```javascript
// Named exports (preferred for utilities, services, constants)
export function parseToken(token) { ... }
export const MAX_PAGE_SIZE = 100;

// Default export (only for classes and React components)
export default class Vendors extends TableModel { ... }
export default function ManageTenantsPage() { ... }

// Import order (enforce via ESLint):
// 1. Node built-ins
import { randomUUID } from 'node:crypto';
// 2. External packages
import express from 'express';
import { TableModel } from 'pg-schemata';
// 3. Internal modules (absolute paths from project root)
import { rbac } from '../../middleware/rbac.js';
// 4. Relative siblings
import { vendorsSchema } from '../schemas/vendorsSchema.js';
```

### 10.8 Comments & Documentation  [in-scope]

- **JSDoc** on all exported functions with `@param`, `@returns`, and `@throws` tags
- **Inline comments** only for *why*, never *what* — the code should be self-documenting
- **TODO comments** must include a ticket/issue reference: `// TODO(AXERRA-123): Add retainage support`
- **No commented-out code** — use version control instead

### 10.9 Async & Concurrency  [in-scope]

- All database operations are `async/await` — never use raw `.then()` chains
- Use `Promise.all()` for independent concurrent operations (e.g., parallel queries)
- Use `Promise.allSettled()` when partial failures are acceptable (e.g., batch notifications)
- pg-schemata bulk operations (`bulkInsert`, `bulkUpdate`, `bulkUpsert`) are automatically transaction-wrapped — do not wrap them in an additional transaction
- For multi-step business transactions (e.g., posting an invoice + creating GL entries), use pg-promise's `db.tx()` to ensure atomicity

### 10.10 Security Practices  [in-scope]

- Never log sensitive data (passwords, tokens, PII) — redact before logging
- Always use parameterized queries (pg-schemata handles this automatically)
- Validate all input at the API boundary — pg-schemata's Zod validators cover schema validation; add business rule validation in controllers
- Never return `password_hash` or internal fields in API responses — use `columnWhitelist` or DTO mapping
- Environment secrets must never be committed — use `.env` files (gitignored) and validate required vars at startup
- All authorization must flow through the RBAC policy engine — no role-based bypass in middleware
- Entity deactivation (employee, vendor, client, or contact) must cascade to lock the corresponding `portal_users` login (business rule in controller, not FK — cross-schema)
- User creation (`portal_users` insert) requires the entity to already have `roles` assigned and `is_app_user = true`
- Roles must be assigned to an entity (non-empty `roles` array) before it can be flagged as an app user (`is_app_user`)

---

## 11. Developer Tooling  [in-scope]

### 11.1 ESLint  [in-scope]

**Version:** ESLint 9 with flat config (`eslint.config.js` at monorepo root)

**Configuration:**

- Base: `@eslint/js` recommended rules
- Plugin: `eslint-plugin-import` (installed; alias resolver is not currently configured)
- Three environment-specific rule sets:
  - **Client** (`apps/client/`): React/Vite globals, JSX support via Espree parser
  - **Server** (`apps/server/`): Node.js globals
  - **Tests** (`**/tests/**`): Vitest globals (`describe`, `it`, `expect`, `vi`, `beforeAll`, etc.)
- `no-unused-vars`: warning level with `_` prefix exception for intentionally unused params
- Console statements allowed (production logging handled by Winston)
- Formatting rules deferred to Prettier (no stylistic ESLint rules)
- **Module boundaries:** `import/no-restricted-paths` enforces cross-module import boundaries per ADR-0019
- Server config includes `import/no-unresolved: ['error', { caseSensitive: false }]`
- Test config disables `no-unused-vars` and `import/no-unresolved`

**Ignored paths:** `node_modules`, `dist`, `build`, `coverage`, `.vite`, `.turbo`, `.rollup.cache`, `out/`, `apps/server/html/**`, `apps/server/logs/**`, `docs/`, and others

**Run:** `npm run lint` (root) or `npm run lint` (per-workspace)

### 11.2 Prettier  [in-scope]

**Version:** Prettier 3

**Configuration (`prettier.config.mjs`):**

| Option             | Value        | Rationale                                                                                |
| ------------------ | ------------ | ---------------------------------------------------------------------------------------- |
| `semi`           | `true`     | Explicit statement termination                                                           |
| `singleQuote`    | `true`     | Consistency — single quotes for JS strings                                              |
| `trailingComma`  | `'all'`    | Cleaner git diffs                                                                        |
| `printWidth`     | `144`      | Wide format — reduces unnecessary line wrapping in schema definitions and table configs |
| `tabWidth`       | `2`        | Standard JS indentation                                                                  |
| `useTabs`        | `false`    | Spaces only                                                                              |
| `bracketSpacing` | `true`     | `{ foo }` not `{foo}`                                                                |
| `arrowParens`    | `'always'` | `(x) => x` not `x => x`                                                              |
| `jsxSingleQuote` | `false`    | Double quotes in JSX attributes (HTML convention)                                        |
| `endOfLine`      | `'lf'`     | Unix line endings only                                                                   |

**Overrides:**

- Markdown files (`*.md`): `printWidth: 80` for readability

**Ignored paths (`.prettierignore`):** `node_modules`, `dist`, `build`, `coverage`, lockfiles, framework output directories, large assets

### 11.3 EditorConfig  [in-scope]

**File:** `.editorconfig` at monorepo root

Ensures consistent whitespace across all editors/IDEs:

- All files: UTF-8, spaces, indent size 2, LF line endings, final newline, trim trailing whitespace
- Markdown: trailing whitespace preserved (significant for line breaks)
- Makefiles: tab indentation (required by Make)

### 11.4 Husky & Git Hooks  [in-scope]

**Version:** Husky 9

**Pre-commit hook (`.husky/pre-commit`):**

1. Runs `lint-staged` if available (`eslint --fix` on staged `.js`/`.jsx` files)
2. Checks for staged changes (skips if nothing staged)
3. **Enforces commit separation**: rejects commits that touch files in both `apps/client/` and `apps/server/` simultaneously — forces clean, single-concern commits per workspace
4. Bypass with `--no-verify` when necessary (e.g., monorepo-wide config changes)

**Pre-push hook (`.husky/pre-push`):**

- Runs all four test suites (`test:unit`, `test:contract`, `test:rbac`, `test:integration`) before allowing a push

**Setup:** `npm run prepare` installs Husky hooks via the `prepare` lifecycle script

### 11.5 VSCode Workspace  [in-scope]

**File:** `axerra.code-workspace` (single-root workspace — one folder entry pointing to the monorepo root)

**Formatter assignments:**

- JavaScript/TypeScript/JSX/TSX: `esbenp.prettier-vscode` (Prettier extension)
- JSON/JSONC: VSCode built-in JSON formatter

> **Note:** The workspace file does not currently include an `extensions.recommendations` block. Install extensions manually per §12.4.

### 11.6 Vitest (Testing)  [in-scope]

**Version:** Vitest 3 with `@vitest/coverage-v8`

**Configuration (`apps/server/vitest.config.js`):**

| Option                  | Value                                                         | Rationale                                                                                  |
| ----------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `environment`         | `'node'`                                                    | Server-side testing                                                                        |
| `globals`             | `true`                                                      | No need to import `describe`/`test`/`expect`                                         |
| `setupFiles`          | `['tests/setup.js']`                                        | Global test setup (stub — to be expanded; actual fixtures in `tests/helpers/testDb.js`) |
| `pool`                | `'threads'` with `poolOptions.threads.singleThread: true` | Database tests require sequential execution                                                |
| `sequence.concurrent` | `false`                                                     | Prevents test ordering issues with shared DB state                                         |
| `coverage.provider`   | `'v8'`                                                      | Native V8 coverage (fast)                                                                  |
| `coverage.reporter`   | `['text', 'html']`                                          | Terminal output + HTML report                                                              |

**Test scripts (server):**

| Script               | Command                                | Purpose                            |
| -------------------- | -------------------------------------- | ---------------------------------- |
| `test`             | `cross-env NODE_ENV=test vitest run` | Full suite (single run, not watch) |
| `test:unit`        | Unit tests only                        | Controller logic, middleware       |
| `test:integration` | Integration tests only                 | API endpoints with seeded data     |
| `test:contract`    | Contract tests only                    | Router/controller API contracts    |
| `test:rbac`        | RBAC tests only                        | Permission resolution              |
| `test:coverage`    | All tests + HTML coverage              | Coverage reporting                 |

### 11.7 Vite (Client Build)  [in-scope]

**Version:** Vite 7 with `@vitejs/plugin-react`

**Configuration (`apps/client/vite.config.js`):**

- React plugin with automatic JSX transformation
- Dev server: port `5173`, auto-opens browser
- API proxy: `/api` requests forwarded to `http://localhost:3000` (Express backend)
- Build: source maps enabled for debugging

### 11.8 npm Workspaces  [in-scope]

**Monorepo structure managed by npm workspaces:**

```json
// root package.json
{
  "workspaces": ["apps/*", "packages/*"]
}
```

**Root scripts:**

| Script                                  | Command                                                          | Purpose                                                                                |
| --------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `dev`                                 | `dev:serv & dev:client`                                        | Start both server and client in parallel                                               |
| `dev:serv`                            | `npm -w apps/server run dev`                                   | Start Express dev server (nodemon, 5s delay)                                           |
| `dev:client`                          | `npm -w apps/client run dev`                                   | Start Vite dev server                                                                  |
| `build`                               | `npm -w apps/server run build && npm -w apps/client run build` | Production build (note: server has no `build` script — server-side build will fail) |
| `lint`                                | `eslint .`                                                     | Lint entire monorepo                                                                   |
| `test`                                | `npm -w apps/server test`                                      | Server tests only (no client tests configured)                                         |
| `arch` / `arch:check` / `arch:ai` | Architecture validation scripts                                  | Module boundary and structure checks                                                   |
| `prepare`                             | `husky`                                                        | Install git hooks                                                                      |

**Server-specific scripts:**

| Script              | Purpose                                 |
| ------------------- | --------------------------------------- |
| `setupAdmin:dev`  | Run migrations + admin bootstrap (dev)  |
| `setupAdmin:test` | Run migrations + admin bootstrap (test) |
| `migrate:dev`     | Apply pending migrations (dev)          |
| `migrate:test`    | Apply pending migrations (test)         |
| `seed`            | Seed database with sample data          |
| `seed:rbac`       | Seed RBAC roles and policies            |
| `start`           | Production server start                 |

### 11.9 Logging  [in-scope]

**Server-side logging via Winston + Morgan:**

- **Winston**: Structured JSON logging for application events, errors, and audit trails
- **Morgan**: HTTP request logging (method, URL, status, response time)
- Log levels: `error`, `warn`, `info`, `http`, `debug`
- Production: `info` and above; Development: `debug` and above
- pg-schemata accepts an optional `logger` parameter on initialization for query-level logging

### 11.10 Environment Management  [in-scope]

**`.env` files (gitignored):**

- `.env` — Local development defaults
- `.env.test` — Test environment overrides
- `.env.production` — Production config (never committed)

**`.env.example`** exists at the monorepo root with all required variable names and sample values. Keep it up to date when adding new env vars.

**Validation:** All required environment variables should be validated at server startup. Fail fast with a clear error message if any are missing.

---

## 12. Project Setup Guide  [in-scope]

### 12.1 Prerequisites  [in-scope]

Install these before starting:

| Tool                 | Version                    | Purpose                      | Install                                                                                       |
| -------------------- | -------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------- |
| **Node.js**    | ≥ 20                      | Runtime                      | [nodejs.org](https://nodejs.org) or `nvm install 20`                                           |
| **npm**        | ≥ 10 (ships with Node 20) | Package manager / workspaces | Included with Node                                                                            |
| **PostgreSQL** | ≥ 15                      | Database                     | `brew install postgresql@15` (macOS) or [postgresql.org](https://www.postgresql.org/download/) |
| **Redis**      | ≥ 7                       | Permission caching           | `brew install redis` (macOS) or [redis.io](https://redis.io/download/)                         |
| **Git**        | ≥ 2.40                    | Version control              | `brew install git` or [git-scm.com](https://git-scm.com)                                       |
| **VSCode**     | Latest                     | IDE                          | [code.visualstudio.com](https://code.visualstudio.com)                                           |

**Optional but recommended:**

- **nvm** (Node Version Manager) — Switch Node versions per project
- **pgAdmin** or **DBeaver** — Visual database browser
- **Redis Insight** — Visual Redis browser

### 12.2 GitHub Repository Setup  [in-scope]

#### Create the repository

```bash
# 1. Create project directory
mkdir axerra && cd axerra

# 2. Initialize git
git init
git branch -M main

# 3. Create the GitHub repo (using GitHub CLI)
gh repo create <org>/axerra --private --source=. --remote=origin

# Or manually: create repo on github.com, then:
git remote add origin git@github.com:<org>/axerra.git
```

#### Branch strategy

| Branch              | Purpose                             | Merges From             |
| ------------------- | ----------------------------------- | ----------------------- |
| `main`            | Production-ready code               | `dev` via PR          |
| `dev`             | Integration branch for next release | Feature branches via PR |
| `feat/<name>`     | New features                        | —                      |
| `fix/<name>`      | Bug fixes                           | —                      |
| `refactor/<name>` | Code restructuring                  | —                      |
| `chore/<name>`    | Tooling, config, deps               | —                      |

**Branch naming:** `<type>/<scope>-<short-description>` — e.g., `feat/serv-ar-invoices`, `fix/client-tenant-bar-dropdown`

#### Protect the main branch

```bash
# Via GitHub CLI
gh api repos/<org>/axerra/branches/main/protection -X PUT -f \
  required_status_checks='{"strict":true,"contexts":["test"]}' \
  enforce_admins=true \
  required_pull_request_reviews='{"required_approving_review_count":1}'
```

Or configure in GitHub → Settings → Branches → Branch protection rules:

- Require pull request reviews before merging (1 approval)
- Require status checks to pass (lint, test)
- Require branches to be up to date before merging
- Do not allow bypassing the above settings

### 12.3 Clone & Install  [in-scope]

```bash
# 1. Clone the repository
git clone git@github.com:<org>/axerra.git
cd axerra

# 2. Install all workspace dependencies (root + apps + packages)
npm install

# 3. Enable Husky git hooks
chmod +x .husky/pre-commit
```

`npm install` at the root automatically installs dependencies for all workspaces:

- `apps/client/`
- `apps/server/`
- `packages/shared/`

### 12.4 VSCode Configuration  [in-scope]

#### Open the workspace

```bash
code axerra.code-workspace
```

Always open the project via the `.code-workspace` file — this ensures formatter and setting overrides are applied correctly.

#### Install required extensions

When prompted by VSCode, install the recommended extensions. Or install manually:

| Extension              | ID                            | Purpose                          |
| ---------------------- | ----------------------------- | -------------------------------- |
| **Prettier**     | `esbenp.prettier-vscode`    | Code formatting (format on save) |
| **ESLint**       | `dbaeumer.vscode-eslint`    | Lint errors inline               |
| **EditorConfig** | `editorconfig.editorconfig` | Whitespace consistency           |

**Recommended additional extensions:**

| Extension                                         | ID                                    | Purpose                                       |
| ------------------------------------------------- | ------------------------------------- | --------------------------------------------- |
| **GitLens**                                 | `eamodio.gitlens`                   | Enhanced git blame, history, and diff         |
| **GitHub Pull Requests**                    | `github.vscode-pull-request-github` | Review PRs inside VSCode                      |
| **Thunder Client** or **REST Client** | `rangav.vscode-thunder-client`      | Test API endpoints                            |
| **PostgreSQL**                              | `ckolkman.vscode-postgres`          | Database browser and query runner             |
| **ES6 String HTML**                         | `tobermory.es6-string-html`         | Syntax highlighting for SQL template literals |
| **Error Lens**                              | `usernamehw.errorlens`              | Inline error/warning display                  |

#### Suggested VSCode user settings

Add to your workspace settings (in `axerra.code-workspace`) or user `settings.json`:

```jsonc
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.tabSize": 2,
  "editor.insertSpaces": true,
  "files.eol": "\n",
  "files.trimTrailingWhitespace": true,
  "files.insertFinalNewline": true,
  "eslint.useFlatConfig": true,
  "eslint.workingDirectories": [{ "mode": "auto" }],
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/coverage": true,
    "**/.vite": true
  }
}
```

### 12.5 Environment Setup  [in-scope]

```bash
# 1. Copy the example env file (create one if it doesn't exist)
cp .env.example .env

# 2. Edit with your local values
```

**Required `.env` variables:**

```bash
# Database
DATABASE_URL_DEV=postgres://axe_admin:password@localhost:5432/axerra_dev
DATABASE_URL_TEST=postgres://axe_admin:password@localhost:5432/axerra_test

# Redis
REDIS_URL=redis://localhost:6379

# Auth
ACCESS_TOKEN_SECRET=<generate-a-random-secret>
REFRESH_TOKEN_SECRET=<generate-a-different-random-secret>

# Super User bootstrap
ROOT_EMAIL=admin@axerra.io
ROOT_PASSWORD=<choose-a-strong-password>

# Client
CLIENT_ORIGIN=http://localhost:5173
CORS_ORIGINS=http://localhost:5173

# Axerra identity
ROOT_TENANT_CODE=AXERRA
VITE_ROOT_TENANT_CODE=AXERRA
VITE_ROOT_COMPANY=Axerra
VITE_ROOT_EMAIL_DOMAIN=axerra.io
```

**Generate secrets:**

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 12.6 Database Setup  [in-scope]

```bash
# 1. Create PostgreSQL user and databases
psql -U postgres -c "CREATE USER axe_admin WITH PASSWORD 'password' CREATEDB;"
psql -U postgres -c "CREATE DATABASE axerra_dev OWNER axe_admin;"
psql -U postgres -c "CREATE DATABASE axerra_test OWNER axe_admin;"

# 2. Enable required extensions (connect to each database)
psql -U axe_admin -d axerra_dev -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
psql -U axe_admin -d axerra_dev -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'
psql -U axe_admin -d axerra_dev -c "CREATE EXTENSION IF NOT EXISTS vector;"

psql -U axe_admin -d axerra_test -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
psql -U axe_admin -d axerra_test -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'
psql -U axe_admin -d axerra_test -c "CREATE EXTENSION IF NOT EXISTS vector;"

# 3. Run migrations and bootstrap the admin schema
npm -w apps/server run setupAdmin:dev

# 4. Seed sample data (optional)
npm -w apps/server run seed
npm -w apps/server run seed:rbac
```

### 12.7 Start Development  [in-scope]

```bash
# Start both server (port 3000) and client (port 5173) concurrently
npm run dev

# Or start individually:
npm run dev:serv      # Express API on http://localhost:3000
npm run dev:client    # Vite React on http://localhost:5173
```

**Verify everything works:**

1. Open `http://localhost:5173` — should see the AXERRA login page
2. Log in with the `ROOT_EMAIL` / `ROOT_PASSWORD` from your `.env`
3. Test the API directly: `curl http://localhost:3000/api/auth/check`

### 12.8 Run Tests  [in-scope]

```bash
# Full test suite
npm test

# Server tests by category
npm -w apps/server run test:unit
npm -w apps/server run test:integration
npm -w apps/server run test:contract
npm -w apps/server run test:rbac

# Coverage report (opens HTML report)
npm -w apps/server run test:coverage
```

### 12.9 Daily Development Workflow  [in-scope]

```bash
# 1. Pull latest changes
git checkout dev
git pull origin dev

# 2. Create a feature branch
git checkout -b feat/serv-cashflow-reports

# 3. Make changes, commit with conventional commits
git add apps/server/src/modules/reports/
git commit -m "feat(serv): add project profitability SQL views"

# 4. Push and create PR
git push -u origin feat/serv-cashflow-reports
gh pr create --base dev --title "feat(serv): add project profitability reports"

# 5. After PR is approved and merged, clean up
git checkout dev
git pull origin dev
git branch -d feat/serv-cashflow-reports
```

**Commit message format (Conventional Commits):**

```
<type>(<scope>): <short description>

[optional body]

[optional footer]
```

| Type         | When to Use                             |
| ------------ | --------------------------------------- |
| `feat`     | New feature or functionality            |
| `fix`      | Bug fix                                 |
| `refactor` | Code restructuring (no behavior change) |
| `test`     | Adding or updating tests                |
| `docs`     | Documentation changes                   |
| `chore`    | Tooling, config, dependency updates     |
| `style`    | Formatting only (no code change)        |
| `perf`     | Performance improvement                 |

| Scope      | When to Use                                   |
| ---------- | --------------------------------------------- |
| `serv`   | Backend changes (`apps/server/`)            |
| `client` | Frontend changes (`apps/client/`)           |
| `shared` | Shared package changes (`packages/shared/`) |
| `deps`   | Dependency updates                            |
| (omit)     | Root config or cross-cutting changes          |

**Examples:**

```
feat(serv): add AR aging SQL view and report endpoint
fix(client): correct tenant bar dropdown not updating on switch
refactor(serv): extract posting logic into PostingService
test(serv): add RBAC integration tests for AP module
chore(deps): bump pg-schemata to 1.3.1
docs: update PRD with cashflow module specification
```

### 12.10 Husky Commit Rules  [in-scope]

The pre-commit hook enforces:

1. **No mixed commits** — You cannot stage files from both `apps/client/` and `apps/server/` in the same commit. This keeps the git history clean and scoped.

   ```bash
   # This will be REJECTED:
   git add apps/server/src/modules/ar/ apps/client/src/pages/AR/
   git commit -m "feat: add AR module"  # ❌ Mixed commit

   # Do this instead:
   git add apps/server/src/modules/ar/
   git commit -m "feat(serv): add AR module API routes and controllers"

   git add apps/client/src/pages/AR/
   git commit -m "feat(client): add AR invoice list page"
   ```
2. **Bypass when needed** — For legitimate cross-workspace changes (e.g., shared types, monorepo config):

   ```bash
   git commit -m "refactor: update shared API types" --no-verify
   ```
3. **lint-staged** — If configured, runs ESLint and Prettier on staged files only (fast)

### 12.11 Recommended `.nvmrc`  [in-scope]

Create a `.nvmrc` at the monorepo root to pin the Node version:

```
20
```

Then any developer can run `nvm use` to switch to the correct version automatically.

### 12.12 `.env.example` Reference  [in-scope]

The `.env.example` file exists at the monorepo root. Keep it in version control as a developer reference:

```bash
# Database
DATABASE_URL_DEV=postgres://axe_admin:password@localhost:5432/axerra_dev
DATABASE_URL_TEST=postgres://axe_admin:password@localhost:5432/axerra_test
DATABASE_URL_PROD=

# Redis
REDIS_URL=redis://localhost:6379

# Auth (generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
ACCESS_TOKEN_SECRET=
REFRESH_TOKEN_SECRET=

# Super User bootstrap
ROOT_EMAIL=
ROOT_PASSWORD=

# Client
CLIENT_ORIGIN=http://localhost:5173
CORS_ORIGINS=http://localhost:5173

# Cookie
COOKIE_SECURE=false
COOKIE_SAMESITE=Lax

# Encryption
BCRYPT_ROUNDS=12

# Axerra identity
ROOT_TENANT_CODE=AXERRA
VITE_ROOT_TENANT_CODE=AXERRA
VITE_ROOT_COMPANY=Axerra
VITE_ROOT_EMAIL_DOMAIN=axerra.io
```

---

## 13. Architecture Decision Records  [in-scope]

> All decisions captured here serve the product positioning defined in §1.1: AXERRA is a horizontal, project-native, multi-entity ERP. Phase 1 delivers the base ERP core; Phase 2 delivers construction as the reference vertical module.

### 13.1 Purpose  [in-scope]

Design decisions capture the *why* behind architectural and technical choices. Code shows *what* was built; commit messages show *when*; design decisions explain *why one approach was chosen over alternatives*. Without this, future developers (or your future self) will waste time reverse-engineering intent, or worse, undo a deliberate choice without understanding the consequences.

### 13.2 Location  [in-scope]

Design decisions live in a `docs/decisions/` directory at the monorepo root:

```
axerra/
  docs/
    decisions/
      0001-schema-per-tenant-isolation.md
      0002-pg-schemata-over-knex-drizzle.md
      0003-jwt-httponly-cookies.md
      0004-three-level-rbac.md
      0005-keyset-pagination.md
      0006-express5.md
      0007-redis-permission-cache.md
      0008-soft-deletes.md
      0010-conventional-commits.md
      0011-monorepo-npm-workspaces.md
      0012-pgvector-sku-matching.md
      0013-four-layer-scoped-rbac.md
      0014-polymorphic-sources.md
      0015-projects-module-architecture.md
      0016-sticky-dialog-headers.md
      0017-shared-datagrid-selection-utilities.md
      0018-module-entitlement-middleware.md
      0019-cross-module-posting-contract.md
      0020-reports-module-architecture.md
      0021-architecture-ci-gates.md
      0022-eslint-module-boundaries.md
      0023-excel-import-export.md
      0024-modulebar-action-contract.md
      0025-import-dedup-partial-unique-indexes.md
      0026-child-restore-via-import.md
      0027-license-and-contribution.md
      0028-vertical-module-architecture.md
    PRD.md                      # This file
```

> **Note:** ADR 0009 is absent from the sequence (skipped). ADRs are append-only and never renumbered.

**Rules:**

- Decisions are **numbered sequentially** (`0001`, `0002`, ...) — never renumber
- Decisions are **append-only** — never edit a past decision; supersede it with a new one
- Decisions are **committed to the repo** — they travel with the code, not in a wiki or Notation

### 13.3 Template  [in-scope]

Every design decision follows a lightweight ADR (Architecture Decision Record) format:

```markdown
# <NUMBER>. <Title>

**Date:** YYYY-MM-DD
**Status:** accepted | superseded by [XXXX] | deprecated
**Author:** <name>

## Context

What is the problem or situation that requires a decision? What constraints exist?

## Decision

What was decided? Be specific.

## Alternatives Considered

| Alternative | Pros | Cons |
|---|---|---|
| Option A | ... | ... |
| Option B | ... | ... |

## Consequences

What are the implications of this decision — both positive and negative?
What trade-offs were accepted?
```

### 13.4 When to Write a Decision Record  [in-scope]

Write a decision record when:

- Choosing between two or more viable approaches (e.g., ORM choice, auth strategy)
- Adopting a pattern that will be used project-wide (e.g., soft deletes, audit fields)
- Making a choice that would be non-obvious to a new developer reading the code
- Reversing or changing a previous decision
- Adding or removing a significant dependency

Do **not** write a decision record for:

- Obvious choices with no realistic alternatives
- Implementation details that are easily changed later
- Bug fixes or routine feature work

### 13.5 Initial Decisions to Document  [in-scope]

The following decisions should be captured as the project is built from scratch:

| #    | Decision                                                        | Key Rationale                                                                        |
| ---- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 0001 | Schema-per-tenant isolation over row-level tenancy              | Complete data isolation; independent schema migrations; zero cross-tenant query risk |
| 0002 | pg-schemata as ORM over Knex/Drizzle/Prisma                     | Owned dependency; Postgres-first; schema-driven DDL; built-in migration manager      |
| 0003 | JWT in httpOnly cookies over localStorage tokens                | XSS protection; automatic transmission; no client-side token management              |
| 0004 | Three-level RBAC (none/view/full) over boolean permissions      | Granular read vs write control; hierarchical policy resolution                       |
| 0005 | Keyset pagination over offset-based                             | Stable performance at scale; no skipped/duplicate rows on concurrent inserts         |
| 0006 | Express 5 over Fastify/Koa                                      | Mature ecosystem; team familiarity; async error handling improvements in v5          |
| 0007 | Redis for permission caching over in-memory                     | Shared across server instances; survives process restarts; TTL expiration            |
| 0008 | Soft deletes over hard deletes                                  | Audit trail; undo capability; referential integrity preserved                        |
| 0009 | *(Skipped — number not used; see §13.2 note)*               | —                                                                                   |
| 0010 | Conventional Commits over freeform messages                     | Parseable history; automated changelog potential; scope-based filtering              |
| 0011 | Monorepo with npm workspaces over separate repos                | Shared code; unified tooling; atomic cross-package changes                           |
| 0012 | pgvector embeddings for SKU matching over fuzzy string matching | Semantic similarity; language-agnostic; scales with catalog size                     |
| 0024 | ModuleBar action contract                                       | Standardises toolbar registration / disable rules across CRUD pages                  |
| 0025 | Import dedup via partial unique indexes (incl. `emails`)        | Database-enforced dedup avoids per-importer business-logic drift                     |
| 0026 | Child restore via import                                        | Import path drives cascade-restore for child records under restored parents          |
| 0027 | License, copyright, DCO, and dependency policy                  | AGPLv3 relicense + DCO sign-off + AGPL-incompatibility dependency gate                |
| 0028 | Vertical add-on module architecture                             | Verticals are coded identically to core modules; `allowed_modules` + registry only — no event bus or plugin layer |

> (List extended per gap 4.12, 2026-05-21. ADR-0027 also covers gap §5.3. ADR-0028 added 2026-05-22 per May 2026 product scope review.)

### 13.6 Referencing Decisions  [in-scope]

When code implements a non-obvious pattern that traces back to a design decision, reference it:

**In code comments:**

```javascript
// See decision 0005: keyset pagination chosen over offset for stable large-set performance
const results = await model.findAfterCursor(cursor, limit, orderBy);
```

**In PR descriptions:**

```markdown
## Summary
Implements schema-per-tenant provisioning via pg-schemata bootstrap.

Relates to: [ADR-0001](docs/decisions/0001-schema-per-tenant-isolation.md)
```

**In commit messages (optional):**

```
feat(serv): add tenant schema provisioning

Implements ADR-0001 using pg-schemata bootstrap() for single-transaction
schema creation with extension setup.
```
