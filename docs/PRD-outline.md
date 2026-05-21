# AXERRA PRD — Proposed Restructure Outline

**Date:** 2026-05-20
**Source:** mirrors `docs/PRD.md` (3120 lines) heading structure (H1–H3, with select H4s preserved where the gap analysis cites them).
**Companion:** see `docs/gap-analysis.md` Sections 3, 4, 5.

---

## Legend

### Scope tags (every H2 and H3)

- **[in-scope]** — Part of the committed Phase-1/Phase-2 product surface; must be specified, built, and maintained.
- **[deferred]** — Acknowledged in the product vision but not on the current build path. Spec may be sparse; do not implement now.
- **[out-of-scope]** — Explicitly excluded from the axerra core. Listed here only to set boundaries (e.g., industry-vertical workflows beyond construction).
- **(proposed — needs confirmation)** — The PRD body is ambiguous about scope. The tag shown is a reasonable proposal; the user must confirm before the outline is applied to `docs/PRD.md`.

### Status tags (every implementation-state paragraph or bullet)

- **[implemented]** — Code currently behaves as the line describes. Source: gap-analysis §3 entries marked "code matches doc" or "code-without-intent" where the code path is the new reality.
- **[intended]** — Documented behavior that is not yet in code, or is only partially in code. Default state.
- **[superseded]** — Line describes a behavior that has been replaced; should be rewritten or removed when the outline is applied.

### "To delete" markers

When the gap analysis flags a PRD-internal contradiction (Section 4), one statement is named **Canonical** and the conflicting wording is marked **To delete** with a line-range pointer back to `docs/PRD.md`. These resolutions appear inline at the section that hosts the contradiction and reference the gap-analysis ID that motivated the change.

### Reading `(proposed — needs confirmation)`

If the PRD genuinely doesn't say whether a section is in-scope, the outline picks the most plausible tag and appends this marker. Treat the tag as a question, not an assertion.

---

# 1. Overview  [in-scope]

### 1.1 Product Positioning  [in-scope]  *(NEW — gap §5.1)*

- Reframe axerra as a horizontal, project-native, multi-entity ERP. Industry-specific workflows (construction first) are add-on modules layered on the base ERP core. [intended]
- Phase 1 delivers the base ERP core; Phase 2 delivers construction as the reference vertical. [intended]
- Cross-reference from §13 and from each module section's intro. [intended]
- Resolves gap 5.1; unblocks gap 4.30 (introduces scope-tag taxonomy) and gap 4.12 (stale §13 list).
- *Numbering:* placed at §1.1 (front of chapter) per user decision 2026-05-20; existing §1.1–§1.4 renumbered down by one.

### 1.2 Product Vision  [in-scope]  *(renumbered from §1.1)*

- Multi-tenant project-costing / profitability / payments platform with double-entry accounting [intended]
- Construction is the reference vertical for Phase 2; Phase 1 delivers the horizontal ERP core [intended, see §1.1]

### 1.3 Target Users  [in-scope]  *(renumbered from §1.2)*

- Personas (operations, finance, project managers, sub-contractors) [intended]

### 1.4 Technology Stack  [in-scope]  *(renumbered from §1.3)*

- PERN: Express 5, React 18, Postgres 17, Redis [implemented]
- pg-schemata as schema/model layer [implemented]
- MUI 5 + MUI X Data Grid v6 on client [implemented]

### 1.5 Monorepo Structure  [in-scope]  *(renumbered from §1.4)*

- `apps/server`, `apps/client`, `packages/shared` workspaces [implemented]
- Root `.env`; `db.js` walks up from cwd [implemented]

---

# 2. Architecture  [in-scope]

### 2.1 Multi-Tenant Model  [in-scope]

- Schema-per-tenant isolation via pg-schemata [implemented]
- Admin schema holds `tenants`, `portal_users`, `portal_user_tenants` [implemented]
- Cross-tenant access mechanism is `admin.portal_user_tenants` binding table, NOT `portal_users.tenant_id` alone [implemented — see gap 2.5, 3.4, 4.25; PRD currently silent]

### 2.2 pg-schemata Integration (Owned Dependency)  [in-scope]

- Core capabilities, WHERE operators, model-definition pattern, DB init, potential enhancements [implemented]
- (H4s 2.2.1–2.2.5 retained as-is; no scope change)

### 2.3 Application Layout  [in-scope]

- Server module layout (`apiRoutes/v1`, `controllers`, `models`, `schemas`, `services`) [implemented]
- Client layout (`pages`, `components`, `hooks`, `contexts`) [implemented]

### 2.4 Request Flow  [in-scope]

- Express 5 middleware chain through `errorHandler`, `authRedis`, `rbac`, `moduleEntitlement`, `requireRootTenant`, `auditContext` [implemented — gap 2.21, 2.10, 2.11 surface middlewares the PRD doesn't enumerate]

---

# 3. Feature Modules  [in-scope]

### 3.1 Authentication & Authorization (Core)  [in-scope]

#### 3.1.1 Authentication  [in-scope]

- JWT in httpOnly cookie carrying `(sub, ph)` [implemented]
- `ph` (permission hash) computed at login from loaded permissions; empty caps rejected [implemented — Phase 3, commit `1ac6a21`]
- ~~`ph` hardcoded null; permissions not loaded at login~~ **superseded** — to delete (gap 3.3, 4.24)
- `X-Token-Stale` header on hash mismatch revalidation [intended]
- Tenant `active` check at login (rejects "Tenant is inactive.") [implemented — gap 1.14, currently undocumented in PRD]
- `forcePasswordChange` set when `user.status === 'invited'`; first password change promotes to `'active'` [implemented — gap 3.24]

#### 3.1.2 Role-Based Access Control (RBAC)  [in-scope]

- 4-layer model: policies → data scope → state filters → field groups [implemented]
- Four-step fallback resolution incl. `::::` wildcard step [implemented]
  - Canonical: 4 steps (PRD §3.1.2 + ADR-0013). To delete: 3-step list in `rules/rbac.md`. Resolves gaps 4.9, 4.22.
- **Exact-match policy resolution carve-out** (`EXACT_MATCH_KEYS` in `middleware/rbac.js`) bypasses fallback for catalog entries with `policy_required: true` [implemented — gap 2.7, 4.28; PRD currently silent — ADD]
- `withMeta({ router: 'policy-catalog' })` on `policyCatalogRouter` [implemented]
  - Canonical: `router: 'policy-catalog'`. To delete: PRD footnote claiming `router: 'roles'` (gap 4.7).
- `rbac()` IS applied to portal-users routes (`view` on GET, `full` on register/PUT/DELETE/PATCH) [implemented]
  - Canonical: rbac applied. To delete: PRD line "rbac() not currently applied" (gap 3.10, 4.23).
- `tenants::portal-users::import|export` intentionally NOT seeded [implemented — gap 3.26; document the carve-out]
- Support role: `level:'none'` on `FINANCIAL_MODULES = ['accounting','ap','ar']`, `full` elsewhere [implemented — gap 3.27]
- Admin role uses single `module: ''` wildcard `level:'full'` grant; per-module retroactive seeder NOT implemented [implemented — but DIFFERENT from PRD's "per-module migration seeds across existing tenants" wording; gap 1.7 — rewrite needed]
- `allowed_modules` semantics: empty/missing ⇒ allow-all (NOT deny-by-default) [implemented]
  - Canonical: "Allow-all when unset" per ADR-0018. To delete: "Module access whitelist" phrasing in §3.2.1 that implies deny-by-default (gap 4.4).
- `allowed_modules` is read from `req.ctx.tenant.allowed_modules`, NOT a separate Redis key [implemented]
  - Canonical: ctx-based. To delete: PRD claim "Cached in Redis alongside tenant metadata" (gap 4.14, 2.24).
- Redis permission cache invalidator + RBAC query context + permission loader [implemented — gap 2.12, document]

### 3.2 Tenant Management  [in-scope]

#### 3.2.1 Manage Tenants  [in-scope]

- Multi-step `CreateTenantWizard` (NOT a single "form") [implemented — gap 2.22; PRD wording stale]
- `POST /tenants/import-xls` runs `provisionNewTenant` inside `importFromSpreadsheet` [implemented]
  - Canonical: import provisions. To delete: PRD §3.2.1 and `rules/tenants.md` claims that import is admin-rows-only (gap 3.2).
- Tenant provisioning CLI `scripts/db/provisionTenantCli.js` [implemented — gap 2.17]
- `seedRootEntity.js` seeds super_user employee under Axerra [implemented — gap 2.18]

#### 3.2.2 Manage Users  [in-scope]

- `admin.portal_user_tenants` binding table is the source of truth for tenant access [implemented — ADD; gap 2.5, 3.4, 4.25]
- `portal_users.tenant_id` is the *home* tenant only [implemented]
  - Canonical: home-tenant + binding table. To delete: PRD wording treating `tenant_id` as the sole FK (gap 3.4).
- `entity_type` enum `'employee', 'vendor_contact', 'client'` (or NULL for super-user bootstrap) [intended]
  - Status: PRD enumeration is NOT enforced by a CHECK constraint in schema (gap 3.20). Either add the CHECK or weaken the PRD claim.
- Orphan portal-users admin surface `/api/tenants/v1/orphan-portal-users/{find_orphans,cleanup_orphans}` [implemented — gap 2.4; ADD]

#### 3.2.3 Admin Operations  [in-scope]

- `requireRootTenant` middleware gates admin actions via `ROOT_TENANT_CODE` env [implemented — gap 2.10]

### 3.3 Core Entities  [in-scope]

#### 3.3.1 Vendors  [in-scope]

- Vendors (org) has no `roles` column; employees/clients/vendor_contacts do [implemented — gap 3.17]

#### 3.3.1a Vendor Contacts  [in-scope]

- First-class `vendor_contacts` entity with own router/controller/import surface [implemented]
- UI affordance: `VendorContactsPanel.jsx` + `ContactFormDialog.jsx` inside Vendor edit dialog [implemented — gap 2.16, 2.3; document]
- §4.6.3 page list omission: vendor-contacts page absent from PRD's import/export list [intended — ADD page or note omission; gap 2.3]

#### 3.3.1b Payment Terms  [in-scope]

- (no divergence flagged)

#### 3.3.2 Clients  [in-scope]

- `clients.email` column referenced by PRD does NOT exist on the table [superseded]
  - Canonical: emails live in the `emails` table via `sources`. To delete: PRD §3.3.2 line listing `email` column on clients (gap 3.12).

#### 3.3.3 Employees  [in-scope]

- `employees.email` column referenced by PRD does NOT exist on the table [superseded]
  - Canonical: emails live in the `emails` table via `sources` (ADR-0025). To delete: PRD §3.3.3 column + partial-unique-index spec (gap 3.11, 4.11).
- `employees.roles` non-empty enforced by `employeeRoleValidator` before `is_app_user` can be set [implemented — gap 2.9]
- App-user provisioning sync (`loginEmailSync`, `employeeAppUserSync`, `clearOtherPrimary`) [implemented — gap 2.9; ADD]

#### 3.3.4 Polymorphic Sources, Contacts, Addresses & Phone Numbers  [in-scope]

- `sources` + `emails` + `phones` + `addresses` + `taxes` polymorphic via `(entity_type, entity_id)` [implemented]
- First-class tenant-scoped `emails` table (ADR-0025) [implemented — gap 2.1, 4.26; ADD to PRD §3.3 and rules/entities.md]
- Client-side editable sections: `EditableEmailsSection`, `EmailsSection`, `EmailRow`, plus Tax/Phone/Addresses analogues [implemented — gap 2.13; ADD]

#### 3.3.5 Companies  [in-scope]

- (existing PRD §3.3.5 — Companies entity)

#### 3.3.6 Company-Assignment Visibility (optional)  [deferred]  *(NEW — gap §5.2)*

- *Numbering:* §3.3.6 confirmed per user decision 2026-05-20 (existing §3.3.5 Companies stays put).
- Optional per-tenant toggle for core master tables (employees, vendors, clients, contacts) between **shared** (default) and **scoped** (visibility limited by company assignment) [intended]
- Technical mechanism (junction-table design, query scoping, RBAC interaction) deferred to a roadmap item — intentionally not specified here. [intended]
- Cross-reference from §3.2, §3.3.1, §3.3.1a, §3.3.2, §3.3.3. [intended]
- Resolves gap 5.2.

### 3.4 Project Management  [in-scope]

#### 3.4.1 Projects  [in-scope]

- `projects.status` CHECK allows `on_hold` [intended in PRD; CHECK exists in schema] / `VALID_TRANSITIONS` has no edges in/out of `on_hold` [implemented = no transitions]
  - Canonical: planned enhancement per `rules/projects.md`. PRD §3.4.1 currently documents `on_hold` as if working. To delete or downgrade to "planned" (gap 1.11, 3.6).
- `project_clients` schema columns: `(project_id, client_id, role)` with unique `(project_id, client_id)` [implemented]
  - Canonical: no `is_primary` column. To delete: PRD §3.4.1 reference to `project_clients.is_primary` (gap 3.8).
- Composite FK `tasks_master(tenant_id, task_group_code) → task_groups(tenant_id, code)` added via ALTER TABLE [implemented — gap 3.22]

#### 3.4.2 Units  [in-scope]

#### 3.4.3 Tasks & Task Groups  [in-scope]

#### 3.4.4 Cost Items  [in-scope]

#### 3.4.5 Change Orders  [in-scope]

- Nav guard policy is `projects::change-orders` [implemented — gap 3.23]

#### 3.4.6 Templates  [in-scope]

### 3.5 Activities & Cost Management  [in-scope]

#### 3.5.1 Categories & Activities  [in-scope]

#### 3.5.2 Deliverables & Assignments  [in-scope]

#### 3.5.3 Budgets  [in-scope]

#### 3.5.4 Cost Lines  [in-scope]

- **BLOCKER:** schema CHECK = `('draft','submitted','approved','change_order')` but controller `VALID_TRANSITIONS` writes `locked` (not in CHECK). Every lock attempt fails. [superseded]
  - Resolution required: either expand the CHECK to include `locked` or change the controller's target state. PRD §3.5.4 must reflect the chosen reconciliation (gap 1.12, 3.5).

#### 3.5.5 Actual Costs  [in-scope]

#### 3.5.6 Vendor Parts  [in-scope]

### 3.6 Bill of Materials (BOM)  [in-scope]

#### 3.6.1 Catalog SKUs  [in-scope]

#### 3.6.2 Vendor SKUs  [in-scope]

- Server has full vendor-skus + vendor-pricing routers with import/export catalog policies [implemented]
- Client import UI surface on `VendorSkuMatchingPage.jsx` / `CatalogPage.jsx` not yet wired for import [intended — gap 1.8]

#### 3.6.3 Vendor Pricing  [in-scope]

### 3.7 Accounts Payable (AP)  [in-scope]

#### 3.7.1 AP Invoices  [in-scope]

- Per-legal-entity numbering: controllers pass `legal_entity_id` to `allocateNumber` but the column is NOT in `ap_invoices` schema — effectively NULL. Per-legal-entity scope is non-functional. [superseded]
  - Resolution required: add `legal_entity_id` column or downgrade the §3.13.1 principle. (gap 3.7, 4.8)

#### 3.7.2 AP Invoice Lines  [in-scope]

#### 3.7.3 Payments  [in-scope]

- Controller-level allowlist `('check','ach','wire')` [implemented — gap 3.25; ADD]

#### 3.7.4 AP Credit Memos  [in-scope]

### 3.8 Accounts Receivable (AR)  [in-scope]

#### 3.8.1 AR Invoices  [in-scope]

- Same per-legal-entity numbering gap as 3.7.1 (gap 3.7, 4.8).

#### 3.8.2 AR Invoice Lines  [in-scope]

#### 3.8.3 Receipts  [in-scope]

- Controller-level allowlist `('check','ach','wire')` [implemented — gap 3.25; ADD]

### 3.9 Accounting & General Ledger  [in-scope]

#### 3.9.1 Chart of Accounts  [in-scope]

#### 3.9.2 Journal Entries  [in-scope]

- Fiscal-period validation: PRD acknowledges as future work; `fiscal_periods` schema/model/migration absent [intended — gap 1.1]

#### 3.9.3 Journal Entry Lines  [in-scope]

#### 3.9.4 Ledger Balances  [in-scope]

#### 3.9.5 Posting Queues  [in-scope]

#### 3.9.6 Category-Account Map  [in-scope]

#### 3.9.7 Intercompany Accounting  [in-scope]

### 3.10 Cashflow & Profitability  [in-scope]

#### 3.10.1 Data Linkage Model  [in-scope]

#### 3.10.2 Project Profitability Metrics  [in-scope]

#### 3.10.3 Cashflow Timeline  [in-scope]

#### 3.10.4 SQL Views for Profitability  [in-scope]

- AR/AP aging views use **5 buckets**: `current, 1-30, 31-60, 61-90, over_90` [implemented]
  - Canonical: 5-bucket scheme (view defs + `rules/reports.md`). To delete: 4-bucket prose ("Current, 31-60, 61-90, 90+") in §3.10.6. Resolves gap 4.31 / 1.10 / 3.19.

#### 3.10.5 API Endpoints  [in-scope]

- `/api/reports/v1/company-cashflow` is implemented [implemented — gap 1.4 withdrawn]
- UI for company cashflow lives at `/dashboard/cashflow` (NOT under `/reports/*`) [implemented]
  - Canonical: dashboard-mounted page (`DashboardPage.jsx`, `CompanyCashflowPage.jsx`). To delete or reconcile: PRD §7 nav placement (gap 2.23, 4.27).

#### 3.10.6 UI Requirements  [in-scope]

- Aging-bucket prose: see canonical resolution under §3.10.4 (gap 4.31).
- ProjectProfitabilityPage BarChart for budget/committed/actual [intended — currently data-grid only; gap 3.16]
- ProjectCashflowPage stacked area + dashed forecast region + toggle [intended — currently plain LineChart; gap 3.16]

### 3.11 Reporting & Views  [in-scope]

- Sidebar lists `/reports/pnl`, `/reports/balance-sheet` [intended — no route/page; gap 1.2]
- `/projects/profitability` (nav points to wrong path) and `/projects/detail` (dynamic-only) flagged as dead/duplicate links [intended — clean up navigationConfig; gap 1.3]
- "Platform Maintenance" page under Tenant admin not yet in PRD §7 nav or §3.2 [implemented — gap 2.14; ADD]

#### 3.11.1 P&L Report  [deferred]
#### 3.11.2 Balance Sheet  [deferred]

### 3.12 Match Review Logs  [in-scope]

### 3.13 Tenant-Scoped Numbering System  [in-scope]

#### 3.13.1 Design Principles  [in-scope]

- Per-legal-entity invoice numbering (`scope_type='legal_entity'`) [intended — non-functional pending `legal_entity_id` column on invoice tables; see §3.7.1 / §3.8.1; gap 3.7, 4.8]

#### 3.13.2 Numbering Configuration  [in-scope]

- All 7 id_types (`employee, vendor, client, contact, ar_invoice, ap_invoice, project`) present in CHECK + seeded [implemented — gap 3.28, 1.9]

#### 3.13.3 Sequence State (Counter Storage)  [in-scope]

#### 3.13.4 Display ID Construction  [in-scope]

#### 3.13.5 Transaction-Safe Allocation  [in-scope]

#### 3.13.6 Reset Strategy  [in-scope]

#### 3.13.7 Recommended Defaults  [in-scope]

#### 3.13.8 Entity Integration  [in-scope]

#### 3.13.9 Backfill on Enable  [in-scope]

- `backfillCodes` exists in `numberingService.js`; controller returns `{ updatedRecords, backfilledCodes }` [implemented — gap 1.5 withdrawn]

### 3.14 Tenant-First-Class Modules (NEW — not yet in PRD)  [in-scope]  *(proposed — derived from gap-analysis §2)*

#### 3.14.1 Emails (first-class tenant-scoped table)  [in-scope]

- Schema/model/controller/router mounted at `/api/core/v1/emails`; policy catalog `core::emails` [implemented — gap 2.1, 4.26; ADD section]

#### 3.14.2 Tenant Preferences  [in-scope]

- Schema/model/controller/router at `/api/core/v1/tenant-preferences`; migration `202603270015_tenantPreferences.js`; seeder `tenantPreferencesSeeder.js` [implemented — gap 2.2; ADD section]

#### 3.14.3 Countries (admin reference table)  [in-scope]

- `countriesSchema.js`, `Countries.js`, `services/countriesSeeder.js` [implemented — gap 2.6; ADD section]

---

# 4. Standard API Patterns  [in-scope]

### 4.1 CRUD Operations  [in-scope]

### 4.2 Pagination  [in-scope]

### 4.3 Audit Fields  [in-scope]

- `auditContext.js` middleware propagates `created_by`/`updated_by` [implemented — gap 2.11; ADD]
- `lib/requestContext.js`, `lib/registerAuditResolver.js` [implemented — gap 2.9]

### 4.4 Soft Deletes  [in-scope]

### 4.5 Validation  [in-scope]

### 4.6 Excel Import/Export  [in-scope]

#### 4.6.1 Backend (pg-schemata + Controller Layer)  [in-scope]

- `?preview=1` preview mode returning counts-only shape across 16 entities [implemented]
  - Canonical: preview mode IS supported. To delete: PRD §4.6 wording that documents only `{ inserted: ... }` (gap 3.13, 4.29).

#### 4.6.2 Frontend (Hooks + Components)  [in-scope]

#### 4.6.3 Pages with Import/Export  [in-scope]

- Page list omits `vendor-skus`, `vendor-pricing` (server routers exist) [intended — add pages or document the gap; gap 1.8]
- Page list omits `vendor-contacts` page [intended — add page or document the gap; gap 2.3]

---

# 5. Database Design  [in-scope]

### 5.1 Common Columns  [in-scope]

### 5.2 Naming Conventions  [in-scope]

### 5.3 Generated Columns  [in-scope]

### 5.4 Schema Management & Migrations  [in-scope]

- Migration order list ends at `202502120080_sqlViews` [superseded]
  - Canonical: list must include `202603150013_importExportCatalog`, `202603270015_tenantPreferences`, `202603270016_reseedPolicyCatalog`, `202604270017_orphanSourceCleanup`, `202605010001_orphanPortalUsersCleanup`, `202605040018_reseedTenantImportExportCatalog`. To delete: truncated list ending at `202502120080`. Resolves gap 4.15.
- `createMigrator`, `defineMigration` documented [implemented]
- `modelPlanner` (topological planner) and `moduleScopes` (admin/tenant filter) NOT documented [implemented — gap 2.19; ADD]

---

# 6. UI Components & Theming  [in-scope]

### 6.1 Theme System  [in-scope]

### 6.2 Navigation System  [in-scope]

### 6.3 Module Bar (Dynamic Toolbar)  [in-scope]

### 6.4 Dependencies (Client)  [in-scope]

### 6.5 Reusable Component Patterns  [in-scope]

- §6.5 explicitly non-exhaustive; shared components (`ReportTablePage`, `ReadOnlyDataTable`, `DetailDialog`, `StepperFormDialog`, `CollectionSectionHeader`, `ToastSnackbar`, `Wordmark`, `PrimaryButton`, `SecondaryButton`, `TertiaryButton`) [implemented — gap 2.15; OK as-is]

---

# 7. Navigation Structure  [in-scope]

- Dead/duplicate nav entries `/projects/profitability` and `/projects/detail` [intended — fix; gap 1.3]
- `/reports/pnl`, `/reports/balance-sheet` listed without backing pages [intended — gap 1.2]
- `/dashboard/cashflow` route is the live placement for company cashflow [implemented — gap 2.23, 4.27]
- "Platform Maintenance" under Tenant admin missing from PRD §7 [implemented — gap 2.14]

---

# 8. Environment Configuration  [in-scope]

---

# 9. Testing Strategy  [in-scope]

- CI split into `test-fast` (unit + rbac, mocked) and `test-integration` (contract + integration with real PG + Redis service containers) [implemented]

---

# 10. Coding Standards & Best Practices  [in-scope]

### 10.1 Naming Conventions  [in-scope]
### 10.1.1 Single Canonical Names (No Aliases)  [in-scope]
### 10.2 File & Module Structure  [in-scope]
### 10.3 Copyright & File Headers  [in-scope]

- Every `.js`/`.jsx` file must start with a copyright header [intended — exhaustive verification deferred per gap 3.21]

### 10.4 Code Reuse & DRY Principles  [in-scope]
### 10.5 Classes vs Functions  [in-scope]
### 10.6 Error Handling  [in-scope]

- Unified Express 5 `errorHandler` middleware [implemented — gap 2.21; ADD]

### 10.7 Import & Export Style  [in-scope]
### 10.8 Comments & Documentation  [in-scope]
### 10.9 Async & Concurrency  [in-scope]
### 10.10 Security Practices  [in-scope]

---

# 11. Developer Tooling  [in-scope]

### 11.1 ESLint  [in-scope]
### 11.2 Prettier  [in-scope]
### 11.3 EditorConfig  [in-scope]
### 11.4 Husky & Git Hooks  [in-scope]

- Husky pre-commit splits mixed `apps/client/` + `apps/server/` changes [implemented]
- Husky `commit-msg` hook enforcing DCO sign-off [intended — gap §5.4]

### 11.5 VSCode Workspace  [in-scope]
### 11.6 Vitest (Testing)  [in-scope]
### 11.7 Vite (Client Build)  [in-scope]
### 11.8 npm Workspaces  [in-scope]
### 11.9 Logging  [in-scope]
### 11.10 Environment Management  [in-scope]

---

# 12. Project Setup Guide  [in-scope]

### 12.1 Prerequisites  [in-scope]
### 12.2 GitHub Repository Setup  [in-scope]
### 12.3 Clone & Install  [in-scope]
### 12.4 VSCode Configuration  [in-scope]
### 12.5 Environment Setup  [in-scope]
### 12.6 Database Setup  [in-scope]
### 12.7 Start Development  [in-scope]
### 12.8 Run Tests  [in-scope]
### 12.9 Daily Development Workflow  [in-scope]
### 12.10 Husky Commit Rules  [in-scope]
### 12.11 Recommended `.nvmrc`  [in-scope]
### 12.12 `.env.example` Reference  [in-scope]

---

# 13. Design Decision Records  [in-scope]

### 13.1 Purpose  [in-scope]
### 13.2 Location  [in-scope]
### 13.3 Template  [in-scope]
### 13.4 When to Write a Decision Record  [in-scope]
### 13.5 Initial Decisions to Document  [in-scope]

- List does not reference ADR-0024, 0025, 0026 [superseded]
  - Canonical: add ADR-0024, ADR-0025, ADR-0026 entries; also add ADR-0027 (relicense) per gap §5.3. Resolves gap 4.12.

### 13.6 Referencing Decisions  [in-scope]

---

# 14. Licensing  [in-scope]  *(NEW — gap §5.3)*

- Project relicensed from MIT to AGPLv3 [intended]
- `LICENSE` file replaced with AGPLv3 text; `license` field updated in `apps/server/package.json`, `apps/client/package.json`, and added to `packages/shared/package.json`; `README.md` license badge/mention updated. [intended]
- Third-party dependency audit: no AGPL-incompatible licenses identified across direct deps (gap §5.3 audit). [intended]
- ADR-0027 `relicense-mit-to-agplv3.md` records the decision. [intended]
- Resolves gap 5.3.

---

# 15. Contribution Policy  [in-scope]  *(NEW — gap §5.4)*

- DCO sign-off required on every commit [intended]
- `CONTRIBUTING.md` at repo root states DCO requirement, links DCO text, declares maintainer (Ian Silverstone) as sole enforcement authority (may waive / retroactively accept / reject). [intended]
- Enforcement: Husky `commit-msg` hook greps for `Signed-off-by:` matching committer identity. [intended]
- Resolves gap 5.4.

---

## Coverage Summary

### Heading counts (this outline)

- **H2 (## sections):** 15 — §§1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14 (new), 15 (new).
- **H3 (### subsections):** approx. 99
  - §1: 5 (renumbered: new §1.1 Positioning + former §1.1–§1.4 shifted to §1.2–§1.5)
  - §2: 4
  - §3: 14 top-level H3s (3.1–3.13 plus new §3.14 group)
  - §4: 6
  - §5: 4
  - §6: 5
  - §7: 0 (flat)
  - §8: 0
  - §9: 0
  - §10: 11
  - §11: 10
  - §12: 12
  - §13: 6
  - §14: 0 (flat)
  - §15: 0 (flat)
- **Combined H2 + H3 tagged:** ~114

### Scope-tag distribution

- **in-scope:** ~108
- **deferred:** 3 (§3.11.1 P&L, §3.11.2 Balance Sheet, §3.3.6 Company-Assignment Visibility)
- **deferred (proposed — needs confirmation):** 2 (§3.11.1, §3.11.2)
- **out-of-scope:** 0 (no current PRD section is explicitly out-of-scope; industry-vertical workflows beyond construction are out-of-scope per §1.1 but no dedicated section exists yet)
- **proposed — needs confirmation:** 0 (all prior proposed tags resolved per user decisions 2026-05-20)

### Section 4 contradictions resolved (9 prd-internal items)

- **4.1** — `CLAUDE.md`/`AGENTS.md` duplication → resolved via roadmap item 38 (repo-level sync mechanism); no PRD section required.
- **4.7** — `policyCatalogRouter` meta → §3.1.2 (canonical: `policy-catalog`)
- **4.12** — Stale §13.5 ADR list → §13.5 (add 0024–0027)
- **4.15** — Stale §5.4 migration list → §5.4 (extend list)
- **4.23** — Stale "rbac() not currently applied" → §3.1.2 (delete)
- **4.24** — Stale Phase-2 ph claim → §3.1.1 (delete; canonical = Phase 3)
- **4.25** — `portal_user_tenants` never named → §3.2.2 + §2.1 (ADD)
- **4.27** — `/dashboard/cashflow` vs PRD §7 nav → §3.10.5 + §7 (canonical: dashboard-mounted)
- **4.29** — Import preview mode absent → §4.6.1 (canonical: preview supported)
- **4.30** — PRD lacks scope tags → resolved structurally by this outline (legend + per-section tags)
- **4.31** — 4-bucket vs 5-bucket aging → §3.10.4 (canonical: 5 buckets)

Total prd-internal resolutions referenced: **11** (Section 4 lists 9 + the cross-cutting 4.30 + the renumbered 4.31).

### Section 5 new sections inserted

- **5.1 — Product Positioning** → §1.1 (per user decision 2026-05-20; existing §1.1–§1.4 renumbered down to §1.2–§1.5)
- **5.2 — Company-Assignment Visibility (optional)** → §3.3.6 (per user decision 2026-05-20; existing §3.3.5 Companies unchanged)
- **5.3 — Licensing (AGPLv3)** → §14
- **5.4 — Contribution Policy (DCO)** → §15

Total new sections inserted: **4**.

### Sections where scope tag could not be confidently proposed

- §3.11.1 P&L Report and §3.11.2 Balance Sheet — confirmed `deferred` per user decision 2026-05-20; spec body to be written when implementation begins.
- §3.3.6 Company-Assignment Visibility — gap §5.2 explicitly defers technical mechanism; tagged `deferred`.
- §3.14 *Tenant-First-Class Modules* group — proposed structural addition; user must confirm whether `emails`, `tenant_preferences`, `countries` deserve their own H3 sections or fold into §3.3.4 / §3.2.
- Appendix A withdrawn per user decision 2026-05-20; gap 4.1 (`CLAUDE.md`/`AGENTS.md` duplication) handled via roadmap item 38 only.

End of outline.
