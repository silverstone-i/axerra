# AXERRA Gap Analysis

**Date:** 2026-05-20
**Commit SHA:** `1ac6a21982ba670e954920facb772435efd4f7fd`
**Branch:** `main`

**Inputs reviewed:**

- `docs/PRD.md` (3120 lines) — treated as intended-state spec; current-state prose flagged as drift sites.
- All 26 ARDs in `docs/decisions/0001-…` through `0026-…`.
- All 11 rule files in `docs/rules/`.
- `CLAUDE.md` and `AGENTS.md` at repo root.
- Server tree under `apps/server/src/`, client tree under `apps/client/src/`.
- `.github/workflows/ci.yml` and `arch-review.yml`.
- Prior `docs/gap-analysis.md`.

## Schema

- **Section 1 — Documented but not implemented.** Kind: `planned` | `deferred` | `silent-missing`. Severity (`blocker` | `major` | `minor` | `cosmetic`) applies only to `silent-missing`.
- **Section 2 — Implemented but not documented.** Kind: `drift` | `internal`. No severity.
- **Section 3 — Documented and implemented but diverged.** Severity applies. Each item classifies direction: `intent-without-code` or `code-without-intent`.
- **Section 4 — Documentation inconsistencies.** Kind: `prd-internal` | `prd-vs-ard` | `prd-vs-rules` | `ard-vs-rules`. No severity.

PRD does not yet use explicit scope tags; every Section 1/3 item below records the cited PRD section's scope tag as `unmarked` unless the section text itself contains scope language. Each `unmarked` instance is captured once in Section 4 as a `prd-internal` item (4.30).

## Header table — counts

| Section | Kind / Severity | Count |
|---|---|---|
| 1 | planned | 3 |
| 1 | deferred | 0 |
| 1 | silent-missing / blocker | 1 |
| 1 | silent-missing / major | 1 |
| 1 | silent-missing / minor | 3 |
| 1 | silent-missing / cosmetic | 0 |
| 1 | withdrawn | 4 |
| 2 | drift | 12 |
| 2 | internal | 10 |
| 3 | blocker | 1 |
| 3 | major | 5 |
| 3 | minor | 6 |
| 3 | cosmetic | 2 |
| 3 | withdrawn | 4 |
| 4 | prd-internal | 9 |
| 4 | prd-vs-ard | 3 |
| 4 | prd-vs-rules | 6 |
| 4 | ard-vs-rules | 1 |
| 5 | agreed-changes | 4 |

## Deferred under verification rule

One item remains deferred:

- **3.21** — Copyright-header coverage across every `.js` / `.jsx` file. Spot checks (server middleware, lib, controllers, schemas; client `main.jsx`, `App.jsx`, contexts, pages) all show headers. Exhaustive check requires running `find apps -name '*.js' -o -name '*.jsx' | while read f; do head -3 "$f" | grep -qE 'Copyright|@file' || echo "$f"; done` across the full tree (~700+ files) — out of scope for this pass.

All other previously deferred items are resolved below.

---

## Section 1 — Documented but not implemented

| ID | Source (doc) | Kind | Severity | Discrepancy | PRD ref | Scope tag |
|---|---|---|---|---|---|---|
| 1.1 | PRD §3.9.2 *Business Rules* | planned | — | PRD explicitly acknowledges fiscal-period validation is future work; `fiscal_periods` schema/model/migration absent (`grep -rn fiscal_period apps/server/src` empty). Phase 1 confirmed per user decision 2026-05-20; roadmap item 40 stays in Upcoming. | §3.9.2 | unmarked |
| 1.2 | PRD §7 *Reports Navigation* | planned | — | Sidebar lists `/reports/pnl` and `/reports/balance-sheet`; PRD §7 itself notes they have no route/page. No `PnlPage.jsx`, `BalanceSheetPage.jsx`, no controllers. | §7 | unmarked |
| 1.3 | PRD §7 *Project Profitability / Project Detail nav* | planned | — | PRD §7 itself flags `/projects/profitability` (nav mismatch — page is at `/reports/profitability`) and `/projects/detail` (dynamic route only) as known dead/duplicate links. Confirmed at `apps/client/src/config/navigationConfig.js:41,113`. | §7 | unmarked |
| 1.7 | PRD §3.1.2 *Admin Policy Auto-Seeding* | resolved | — | **Resolved 2026-05-21.** Re-framed after user clarification: the system has two seeding mechanisms by design. Five idempotent roles (`super_user`, `admin`, `support`, `vendor_contact`, `client`) get a wildcard `module:''` `'full'` policy at seed time — current code, `systemRoleSeeder.js`. All other roles (`accountant`, `ap_clerk`, `ar_clerk`, `project_manager`, `procurement`, `cfo`, custom roles) get explicit per-module policies and need a retroactive seeder when new modules ship. The retroactive seeder is not yet built but is now documented in PRD §3.1.2 *Policy Seeding by Role Class* with an `[intended]` status tag — the PRD serves as the canonical source of unbuilt work via its scope/status tag taxonomy; no separate backlog entry. Roadmap item 10 closed as a PRD-clarification task. | §3.1.2 | in-scope |
| 1.8 | PRD §4.6.3 / rules/rbac.md *VendorSkuMatchingPage import/export* | silent-missing | minor | `apps/client/src/pages/BOM/` contains `CatalogPage.jsx` and `VendorSkuMatchingPage.jsx`. Server has full vendor-skus + vendor-pricing routers (`apps/server/src/modules/bom/apiRoutes/v1/{vendorSkusRouter,vendorPricingRouter}.js`) with import/export catalog policies. PRD §4.6.3 import/export page list omits vendor-skus and vendor-pricing. Code/server side present; client UI surface for import on those pages is the actual gap. | §4.6.3 | unmarked |
| 1.11 | rules/projects.md *`on_hold` planned enhancement* | planned | — | Rules file flags `projects.status` CHECK allows `on_hold` but `projectsController.VALID_TRANSITIONS` lacks edges. Confirmed `projectsController.js:14,79`. Rules acknowledge it as planned. | §3.4.1 | unmarked |
| 1.12 | rules/activities.md *cost_lines status mismatch* | silent-missing | blocker | `costLinesSchema.js` CHECK = `('draft','submitted','approved','change_order')`; controller `VALID_TRANSITIONS = { draft: ['locked'], locked: ['change_order'] }`. Controller writes `locked`, not in CHECK — any lock attempt fails. Also tracked in 3.5 (diverged). | §3.5.4 | unmarked |
| 1.14 | rules/auth.md *Login flow tenant active check* | silent-missing | minor | rules/auth.md states tenant `active` status is checked at login. Verified: `passportService.js:54` rejects login with "Tenant is inactive." when the resolved home tenant is not active. PRD §3.1.1 does not document this check. Doc gap in PRD only. | §3.1.1 | unmarked |

### Withdrawn

- **1.4** — *Withdrawn:* `/api/reports/v1/company-cashflow` is implemented. `reportsRouter.js:54` wires it to `cashflowController.getCompanyCashflow`. Doc accurate.
- **1.5** — *Withdrawn:* `backfillCodes` exists (`numberingService.js:272`) and `numberingConfigController.js:38-43` returns `{ updatedRecords, backfilledCodes }`. Doc accurate.
- **1.9** — *Withdrawn:* `tenantNumberingConfigSchema.js:39` CHECK includes `project`; `numberingConfigSeeder.js:18` seeds `PRJ`. Doc accurate.
- **1.13** — *Withdrawn / moved to 3.20:* portal_users entity_type CHECK question resolved at 3.20.
- **1.10** — *Moved to 4.31:* divergence is between PRD §3.10.6 prose (4 buckets) and §3.10.4 view definitions (5 buckets) — pure doc-vs-doc, not implementation gap. View migration column lists confirmed at `202502120080_sqlViews.js:248-289`.
- **1.6** — *Moved to 3.3:* Phase 3 commit `1ac6a21` populates `ph`; this is doc lag, not unimplemented work.
- **1.15** — *Moved to 3 (withdrawn there):* `marginAnalysisController.js:36-44` honors `sortBy`/`sortDir`. Confirmed.
- **1.16** — *Moved to 3.16 (new ID).*
- **1.17** — *Moved to 3.2:* it is a code-vs-doc divergence.

---

## Section 2 — Implemented but not documented

| ID | Code path | Kind | What it is | Notes |
|---|---|---|---|---|
| 2.1 | `apps/server/src/system/core/{schemas/emailsSchema.js,models/Emails.js,controllers/emailsController.js,apiRoutes/v1/emailsRouter.js}` mounted at `/api/core/v1/emails`; policy catalog `core::emails` (`policyCatalogSeeder.js:69`) | drift | First-class tenant-scoped `emails` table; entity neither described in PRD §3.3 nor `rules/entities.md`. | ADR-0025 audits the schema; PRD/rules don't catalog it. |
| 2.2 | `tenantPreferencesSchema.js`, `TenantPreferences.js`, `tenantPreferencesController.js`, `apiRoutes/v1/tenantPreferencesRouter.js` (`/api/core/v1/tenant-preferences`); migration `202603270015_tenantPreferences.js`; seeder `services/tenantPreferencesSeeder.js`. | drift | Tenant-preferences module. No PRD section, no rule file, no ARD. | — |
| 2.3 | `vendorContactsSchema.js` + router + controller; UI panel `apps/client/src/pages/Core/vendors/VendorContactsPanel.jsx`. | drift | First-class vendor_contacts entity with separate router/controller/import surface. PRD §3.3.1a mentions the table but PRD §4.6.3 page list omits a Vendor Contacts page. | rules/entities.md confirms lifecycle. |
| 2.4 | `apps/server/src/system/tenants/apiRoutes/v1/orphanPortalUsersRouter.js`, `orphanPortalUsersController.js`; migration `202605010001_orphanPortalUsersCleanup.js`. | drift | `/api/tenants/v1/orphan-portal-users/{find_orphans,cleanup_orphans}` — admin surface for portal_users with no entity binding. | ADR-0023 mentions the router in the disable-import list; PRD §3.2 has no admin section for this. |
| 2.5 | `portalUserTenantsSchema.js`, `PortalUserTenants.js`; `admin.portal_user_tenants` joined in `authRedis.js:102,159,230` and `passportService.js:46`. | drift | The actual cross-tenant access mechanism (binding table). PRD §3.2.2 describes only `portal_users.tenant_id` and is silent on the binding. | The core multi-tenant access mechanism is undocumented. |
| 2.6 | `countriesSchema.js`, `Countries.js`, `services/countriesSeeder.js`. | internal | `countries` admin/reference table and seeder. | — |
| 2.7 | `apps/server/src/middleware/rbac.js` `EXACT_MATCH_KEYS` (lines 23-30) | drift | Exact-match policy resolution bypasses the four-step fallback hierarchy for catalog entries with `policy_required: true`. PRD §3.1.2 documents only the fallback. `policyCatalogSeeder.js:27-37` explains the semantics — but neither PRD nor ADRs do. | Materially changes the access model. |
| 2.8 | `services/policyCatalogReconciler.js`; migrations `202603270016_reseedPolicyCatalog.js`, `202605040018_reseedTenantImportExportCatalog.js`; CLI `scripts/db/reconcilePolicyCatalog.js`. | internal | Policy-catalog reconciler + CLI + reseed migrations. Not in PRD or ADRs. | — |
| 2.9 | `lib/{loginEmailSync,employeeAppUserSync,clearOtherPrimary,employeeRoleValidator,registerAuditResolver,requestContext}.js` | internal | App-user provisioning sync, role enforcement, request-context propagation. | `employeeRoleValidator` enforces the documented "non-empty roles before is_app_user" rule. |
| 2.10 | `middleware/requireRootTenant.js` | internal | PRD §3.2 references it obliquely; exact behavior (`ROOT_TENANT_CODE` env comparison) documented only in `rules/tenants.md`. | — |
| 2.11 | `middleware/auditContext.js` | internal | Audit context middleware. Not mentioned anywhere. | — |
| 2.12 | `services/{permCacheInvalidator,rbacQueryContext,permissionLoader}.js` | internal | Redis permission cache invalidator + RBAC query context. ADR-0007 mentions cache; PRD §3.1.2 mentions canon shape. Invalidator triggers + query context undocumented. | — |
| 2.13 | `apps/client/src/components/shared/{EditableEmailsSection,EmailsSection,EmailRow}.jsx` (and `Tax`, `Phone`, `Addresses` analogues) | drift | Client-side editable Emails section. Mirrors 2.1 — PRD never lists emails sections in entity dialogs. | — |
| 2.14 | `apps/client/src/pages/Tenant/PlatformMaintenancePage.jsx` | drift | "Platform Maintenance" page under Tenant admin. Not in PRD §7 nav or §3.2. | — |
| 2.15 | `apps/client/src/components/shared/{ReportTablePage,ReadOnlyDataTable,DetailDialog,StepperFormDialog,CollectionSectionHeader,ToastSnackbar,Wordmark,PrimaryButton,SecondaryButton,TertiaryButton}.jsx` | internal | Shared components not enumerated in PRD §6.5. PRD §6.5 explicitly says non-exhaustive. | — |
| 2.16 | `apps/client/src/pages/Core/vendors/{VendorContactsPanel,ContactFormDialog}.jsx` | drift | Vendor-contacts UI panel inside Vendor edit dialog. PRD §3.3.1a describes the entity, not the UI affordance. | — |
| 2.17 | `apps/server/scripts/db/provisionTenantCli.js` | internal | CLI for provisioning a tenant outside the HTTP flow. | — |
| 2.18 | `apps/server/src/services/seedRootEntity.js` | internal | Seeds super_user employee under Axerra. PRD §3.2 mentions admin user creation; service path not surfaced. | — |
| 2.19 | `apps/server/src/db/migrations/{createMigrator,modelPlanner,moduleScopes,defineMigration}.js` | internal | PRD §5.4 mentions `createMigrator` and `defineMigration`; `modelPlanner` (topological planner) and `moduleScopes` (admin/tenant filter) are not covered. | — |
| 2.20 | Migration `202604270017_orphanSourceCleanup.js` | internal | Cleanup migration for orphan `sources`. Not in PRD §5.4 migration list. | PRD list ends at `202502120080_sqlViews`. |
| 2.21 | `apps/server/src/middleware/errorHandler.js` | internal | Unified Express 5 error handler. PRD §3.1.2 cites `withMeta` but not `errorHandler`. | — |
| 2.22 | `apps/client/src/pages/Tenant/CreateTenantWizard.jsx` | drift | Multi-step wizard for tenant creation. PRD §3.2.1 describes a "form", not a wizard. | — |
| 2.23 | `apps/client/src/pages/Dashboard/{DashboardPage,CompanyCashflowPage}.jsx` mounted at `/dashboard/cashflow` (`App.jsx:64`) | drift | Company cashflow rendered under `/dashboard/*`, not `/reports/*`. PRD §7 and §3.10.5 describe the endpoint but no nav location matches this route. | — |
| 2.24 | `apps/server/src/middleware/moduleEntitlement.js:23,27` | internal | Empty-or-missing `allowed_modules` ⇒ allow-all. Implemented as documented in ADR-0018; PRD §3.1.2 wording mentions "Cached in Redis alongside tenant metadata" but middleware reads from `req.ctx.tenant.allowed_modules`, not a separate cache key. | Relevant to 4.14. |

---

## Section 3 — Documented and implemented but diverged

| ID | Source | Severity | Direction | Discrepancy | PRD ref | Scope tag |
|---|---|---|---|---|---|---|
| 3.2 | PRD §3.2.1 / rules/tenants.md vs `Tenants.js:22,186,229,746` | major | code-without-intent | Both docs say `POST /tenants/import-xls` only inserts admin rows and does NOT run provisioning. Code now invokes `provisionNewTenant` inside `importFromSpreadsheet`. Docs lag the shipped feature. | §3.2.1 | unmarked |
| 3.3 | PRD §3.1.1 / rules/auth.md vs `authController.js:74,80,83` and `passportService.js:9,46-61` | major | code-without-intent | PRD/rules describe Phase 2: `ph` hardcoded null, no permissions loaded at login. Code resolves home binding + tenant, loads permissions, calls `calcPermHash`, and rejects empty caps (commit `1ac6a21`). Docs out of date. | §3.1.1 | unmarked |
| 3.4 | PRD §3.2.2 / rules/auth.md vs `passportService.js:46`, `authRedis.js:102,159,230` | major | code-without-intent | Docs describe `portal_users.tenant_id` as single FK. Code uses `admin.portal_user_tenants` as the source of truth for which tenants a user can access; `tenant_id` is the "home" tenant. Docs do not mention the binding table. | §3.2.2 | unmarked |
| 3.5 | PRD §3.5.4, `costLinesSchema.js`, `costLinesController.js` | blocker | intent-without-code | PRD §3.5.4 CHECK = `('draft','submitted','approved','change_order')`. Schema matches PRD. Controller `VALID_TRANSITIONS` writes `locked` (not in CHECK). Every lock attempt fails. rules/activities.md flags this; PRD §3.5.4 does not. | §3.5.4 | unmarked |
| 3.6 | PRD §3.4.1 vs `projectsController.js:14,79` | minor | intent-without-code | PRD lists `on_hold` in CHECK; no controller edges to/from it. Documented as planned in rules/projects.md. | §3.4.1 | unmarked |
| 3.7 | PRD §3.13.1, §3.7.1, §3.8.1 vs `ar_invoices`/`ap_invoices` schemas; rules/ap.md, rules/ar.md | major | intent-without-code | PRD §3.13.1 design principle 3 mandates per-legal-entity invoice numbering with `scope_type='legal_entity'`. Controllers pass `legal_entity_id` to `allocateNumber`, but the column is not in either invoice schema — effectively `null`. Per-legal-entity scope is non-functional. | §3.13.1 | unmarked |
| 3.8 | PRD §3.4.1 vs `projectClientsSchema.js:20-26,42-43` | minor | intent-without-code | Schema has `project_id`, `client_id`, `role`. PRD documents `is_primary` on `project_clients`. Schema has no `is_primary` column. Direction confirmed per user decision 2026-05-20: add the column (match the pattern used on vendors, addresses, phone numbers, contacts). | §3.4.1 | unmarked |
| 3.10 | PRD §3.2.2 vs `portalUsersRouter.js` | minor | code-without-intent | PRD: "`rbac()` not currently applied" on portal-users routes. Code applies `rbac('view')` on GET and `rbac('full')` on POST `/register`, PUT, DELETE, PATCH (`portalUsersRouter.js:46,55-58`). PRD wording is stale. | §3.2.2 | unmarked |
| 3.11 | PRD §3.3.3 vs `employeesSchema.js:40-42` | minor | intent-without-code | PRD §3.3.3 specifies `employees.email` partial unique `WHERE email IS NOT NULL AND deactivated_at IS NULL`. Schema has no `email` column at all (no `email` index, no `email` field in columns list). The `emails` table (2.1) carries email values via `sources`. PRD documents a column that doesn't exist. | §3.3.3 | unmarked |
| 3.12 | PRD §3.3.2 vs `clientsSchema.js` | minor | intent-without-code | PRD §3.3.2 lists `clients.email` column. Schema has no `email` column. Same root cause as 3.11 — emails live in `emails` table. | §3.3.2 | unmarked |
| 3.13 | PRD §4.6 vs `BaseController.importXls:105-132`, commits `4319089`, `4e18221` | major | code-without-intent | PRD §4.6.1 documents only `{ inserted: ... }` return shapes. Code adds `?preview=1` preview mode returning counts-only across 16 entities. PRD §4.6 does not mention preview mode. | §4.6 | unmarked |
| 3.16 | PRD §3.10.6 vs `apps/client/src/pages/Reports/{ProjectProfitabilityPage,ProjectCashflowPage}.jsx`, `apps/client/src/pages/Dashboard/CompanyCashflowPage.jsx` | major | intent-without-code | PRD §3.10.6 specifies BarChart for budget vs committed vs actual on profitability; ProjectProfitabilityPage is data-grid only (no chart). PRD specifies stacked area + forecast dashed region + toggle on cashflow; ProjectCashflowPage uses `LineChart` with no stacking, no dashed forecast, no toggle. Charts spec largely unimplemented. | §3.10.6 | unmarked |
| 3.17 | PRD §3.3.1 roles columns | cosmetic | — | PRD/code agree: vendors (org) has no `roles`; employees/clients/vendor_contacts do. Kept for traceability. | §3.3.1 | unmarked |
| 3.20 | PRD §3.2.2 vs `portalUsersSchema.js:26-31` | minor | intent-without-code | PRD §3.2.2 documents `entity_type` enum `'employee', 'vendor_contact', 'client'` and allows NULL for super user bootstrap. Schema CHECK at line 31 covers `status` only; no CHECK constraint on `entity_type` — arbitrary values would be accepted. PRD's enumeration is not enforced. | §3.2.2 | unmarked |
| 3.22 | rules/projects.md vs `projectEntities` migration | cosmetic | — | Composite FK `tasks_master(tenant_id, task_group_code) → task_groups(tenant_id, code)` is added via ALTER TABLE at `202502110020_projectEntities.js:67-72`. Doc accurate. | §3.4.1 | unmarked |
| 3.23 | PRD §7 vs `navigationConfig.js:71` | minor | — | Nav guard for Change Orders is `projects::change-orders`. Confirmed. Doc accurate. | §7 | unmarked |
| 3.24 | rules/auth.md vs `authController.js:88,295` | cosmetic | — | `forcePasswordChange` is set when `user.status === 'invited'` (line 88); first password change promotes status to `'active'` (line 295-296). Doc accurate. | rules/auth.md | unmarked |
| 3.25 | PRD §3.7.3 / §3.8.3 vs `paymentsController.js:17,53,125`, `receiptsController.js:17,43,115` | minor | — | PRD: no CHECK; controllers validate `('check','ach','wire')`. Confirmed. rules/ap.md and rules/ar.md correctly describe code state; PRD silent on the controller-level allowlist. | §3.7.3, §3.8.3 | unmarked |
| 3.26 | PRD §3.1.2 vs `policyCatalogSeeder.js:238` | minor | code-without-intent | rules/rbac.md states `tenants::portal-users::import|export` are intentionally NOT seeded. Confirmed: `policyCatalogSeeder.js:238` comment "tenants::portal-users does not [get import/export]". Doc accurate (rules); PRD does not document this carve-out. | §3.1.2 | unmarked |
| 3.27 | PRD §3.1.2 vs `systemRoleSeeder.js:83,99,118-130` | minor | — | Support role has `level:'none'` for `FINANCIAL_MODULES = ['accounting','ap','ar']` and `full` for others. Doc accurate. | §3.1.2 | unmarked |
| 3.28 | PRD §3.13.2 vs `tenantNumberingConfigSchema.js:39`, `numberingConfigSeeder.js:14-28` | minor | — | All 7 PRD id_types (`employee, vendor, client, contact, ar_invoice, ap_invoice, project`) appear in CHECK and are seeded. Doc accurate. | §3.13.2 | unmarked |

### Withdrawn

- **3.1** — *Withdrawn:* prior file already concluded the PRD note was stale. Code at `policyCatalogRouter.js:15` uses `router: 'policy-catalog'`. The remaining work (deleting the stale PRD assertion) is a doc-only fix; tracked in 4.7.
- **3.9** — *Withdrawn:* `moduleEntitlement.js:23` empty/non-array ⇒ allow-all is implemented as PRD/ADR-0018 specify.
- **3.14** — *Withdrawn:* `navigationConfig.js:41,113` confirms the duplicate Profitability links — already captured at 1.3.
- **3.15** — *Withdrawn / moved to 3.26.*
- **3.18** — *Withdrawn / moved to 3.28.*
- **3.19** — *Withdrawn:* pure PRD-internal contradiction; tracked at 4.31 (formerly 4.2).
- **3.21** — *Deferred:* see deferral list.

---

## Section 4 — Documentation inconsistencies

| ID | Sources | Kind | Discrepancy |
|---|---|---|---|
| 4.1 | `CLAUDE.md`, `AGENTS.md` | prd-internal | Byte-identical files with no sync mechanism. PRD §13 does not address why both exist. |
| 4.4 | PRD §3.1.2 vs ADR-0018 | prd-vs-ard | Both agree "empty `allowed_modules` ⇒ allow-all," but PRD §3.2.1 calls `allowed_modules` a "Module access whitelist", which implies deny-by-default. Wording trips readers even though semantics are consistent. |
| 4.7 | PRD §3.1.2 footnote on `policyCatalogRouter` | prd-internal | PRD asserts the router uses `withMeta({ router: 'roles' })`. Code uses `router: 'policy-catalog'` (`policyCatalogRouter.js:15`). PRD documents a bug that no longer exists. |
| 4.8 | rules/ap.md, rules/ar.md, PRD §3.13.1 | prd-vs-rules | Rules flag the missing `legal_entity_id` column. PRD §3.13.1 mandates per-legal-entity numbering but never documents how `legal_entity_id` is wired or that it is missing. |
| 4.9 | PRD §3.1.2, ADR-0013, rules/rbac.md | ard-vs-rules | PRD and ADR-0013 list four fallback steps including `::::` wildcard. rules/rbac.md lists only three (omits the empty-module step). |
| 4.11 | PRD §3.3.3, §3.3.4, ADR-0025 | prd-vs-ard | PRD §3.3.3 keeps `email` on `employees` with its own partial unique. ADR-0025 introduces `emails` table with tenant-wide partial unique. PRD does not reconcile; entity tables in code (3.11, 3.12) follow ADR-0025 and drop the column. |
| 4.12 | PRD §13 "Initial Decisions to Document" | prd-internal | List does not reference ADR-0024, 0025, 0026. PRD §13 predates them. |
| 4.14 | PRD §3.1.2 vs ADR-0018 | prd-vs-ard | PRD says `allowed_modules` is "cached in Redis alongside tenant metadata"; ADR-0018 does not. Middleware reads from `req.ctx.tenant.allowed_modules` (2.24), not a Redis key. |
| 4.15 | PRD §5.4 migration order list | prd-internal | List ends at `202502120080_sqlViews`. Actual repo includes `202603270015_tenantPreferences`, `202603270016_reseedPolicyCatalog`, `202603150013_importExportCatalog`, `202604270017_orphanSourceCleanup`, `202605040018_reseedTenantImportExportCatalog`, `202605010001_orphanPortalUsersCleanup`. |
| 4.22 | rules/rbac.md vs PRD §3.1.2 / ADR-0013 | prd-vs-rules | Same as 4.9 — rules/rbac.md missing `::::` wildcard step. Kept separately because the prior file numbered it twice. |
| 4.23 | PRD §3.1.2 "rbac() not currently applied" | prd-internal | Snapshot statement contradicted by `portalUsersRouter.js` (3.10) and other current code. PRD wording needs date-stamping. |
| 4.24 | PRD §3.1.2 *"Permission Hash / Stale Token Phase 3 deferred"* | prd-internal | Same drift as 3.3 — PRD documents the Phase 2 state; code is in Phase 3. |
| 4.25 | PRD §3.2.2 vs `portal_user_tenants` reality | prd-internal | PRD never names `portal_user_tenants`. Mirrors 2.5/3.4 — flagged here as a pure-doc absence as well. |
| 4.26 | PRD §3.3 and rules/entities.md — `emails` table | prd-vs-rules | Neither PRD §3.3 nor rules/entities.md mentions the `emails` table (2.1, 2.13). ADR-0025 is the only doc that references it. |
| 4.27 | PRD §3.10.5 endpoint list | prd-internal | Lists `/api/reports/v1/company-cashflow` but the implemented page lives at `/dashboard/cashflow` (2.23). PRD nav §7 does not place the endpoint anywhere consistent with the route. |
| 4.28 | PRD §3.1.2 *"exact-match policy resolution"* — absent | prd-vs-rules | `EXACT_MATCH_KEYS` in `rbac.js` is documented only in `policyCatalogSeeder.js:27-37` comments. Neither PRD §3.1.2 nor rules/rbac.md mentions the carve-out. |
| 4.29 | PRD §4.6 *import preview mode* — absent | prd-internal | Same drift as 3.13 — PRD §4.6 makes no mention of preview mode, despite preview being live across 16 entities. |
| 4.30 | All PRD sections cited in Sections 1 and 3 | prd-internal | PRD does not use explicit scope tags (in-scope / deferred / out-of-scope). Every Section 1/3 item above carries `unmarked` for that reason. Captured here once rather than 30+ times. |
| 4.31 | PRD §3.10.6 vs PRD §3.10.4 / rules/reports.md | prd-internal | §3.10.6 prose names 4 AR/AP aging buckets (Current, 31-60, 61-90, 90+). §3.10.4 view definitions and rules/reports.md name 5 (current, 1-30, 31-60, 61-90, over_90). View migration column lists at `202502120080_sqlViews.js:248-256,281-289` confirm 5 buckets. |

### Withdrawn

- **4.2** — *Withdrawn / renumbered to 4.31* with code verification added.
- **4.3** — *Withdrawn:* endpoint exists; both docs agree.
- **4.5**, **4.6**, **4.10**, **4.13**, **4.16**, **4.17**, **4.18**, **4.19**, **4.20**, **4.21** — *Withdrawn:* previously listed as "Consistent / No issue" — not discrepancies, dropped per spec rather than retained as noise.

---

## Section 5 — Agreed documentation and project changes

Decisions recorded from a strategic discussion on 2026-05-20. These are forward commitments, not defects — no severity is assigned.

### 5.1 — Reposition axerra as horizontal project-native multi-entity ERP

- **Tag:** [PRD]
- **Source:** strategic discussion 2026-05-20
- **Decision date:** 2026-05-20
- **Phase:** 1
- **Blocks:** 4.30 (PRD lacks explicit scope tags — repositioning requires the PRD to declare in-scope / deferred / out-of-scope across modules); 4.12 (PRD §13 "Initial Decisions to Document" list is stale and predates the repositioning).
- **Change required:** Reframe axerra's product positioning as a horizontal, project-native, multi-entity ERP. Industry-specific workflows (construction first) become add-on modules layered on the base ERP core. Phase 1 delivers the base ERP core; Phase 2 delivers construction as the reference vertical module. The PRD must lead with this framing so module scope, deferral, and roadmap decisions cascade from it consistently.
- **PRD reference:** New heading **§1.1 Product Positioning** (front of chapter 1; existing §1.1–§1.4 renumbered down to §1.2–§1.5 per user decision 2026-05-20). Cross-reference from §13 and from each module section's intro.

### 5.2 — Optional company-assignment layer for core master tables

- **Tag:** [PRD][CODE]
- **Source:** strategic discussion 2026-05-20
- **Decision date:** 2026-05-20
- **Phase:** 1 (late — build toward the end of Phase 1)
- **Blocks:** none (no existing Section 1–4 item describes scoped vs. shared visibility of master records across companies/legal entities).
- **Change required:** Introduce an optional per-tenant setting that toggles core master tables — employees, vendors, clients, contacts — between **shared** (default, matches current behavior: visible to all companies/legal entities under the tenant) and **scoped** (visibility limited by company assignment). Default remains shared so existing tenants are unaffected. Technical mechanism (junction-table design, query scoping, RBAC interaction) is deferred to a roadmap item and intentionally not specified here.
- **PRD reference:** New subsection under PRD §3.3 *Core Entities* — heading **§3.3.6 Company-Assignment Visibility (optional)** (per user decision 2026-05-20; existing §3.3.5 Companies unchanged). Cross-reference from §3.2 *Tenants & Legal Entities* and from each affected entity section (§3.3.1, §3.3.1a, §3.3.2, §3.3.3).

### 5.3 — Relicense from MIT to AGPLv3

- **Tag:** [PROJECT]
- **Source:** strategic discussion 2026-05-20
- **Decision date:** 2026-05-20
- **Phase:** 1
- **Blocks:** none.
- **Change required:** Replace the root `LICENSE` (currently MIT — `LICENSE:1`, `Copyright (c) 2026 Ian Silverstone`) with the AGPLv3 text. Update `license` fields in `apps/server/package.json`, `apps/client/package.json`, and add an explicit `license` field to `packages/shared/package.json` (currently absent). Update `README.md` license badge / mention. Copyright-header convention in source files is unaffected by the license choice but the header text may reference AGPLv3.
- **License-compatibility audit (third-party code in scope: direct declared dependencies in `apps/server`, `apps/client`, `packages/shared`; no vendored or in-tree third-party code found under `apps/` or `packages/`):**
  - Direct server deps: `bcrypt` MIT, `cookie-parser` MIT, `cors` MIT, `cross-env` MIT, `dotenv` BSD-2-Clause, `express` MIT, `ioredis` MIT, `jsonwebtoken` MIT, `morgan` MIT, `multer` MIT, `passport` MIT, `passport-local` MIT, `pg-schemata` MIT, `winston` MIT, `zod` MIT.
  - Direct client deps: `@emotion/react` MIT, `@emotion/styled` MIT, `@mui/icons-material` MIT, `@mui/material` MIT, `@mui/x-charts` MIT, `@mui/x-data-grid` MIT, `@tanstack/react-query` MIT, `react` MIT, `react-dom` MIT, `react-router-dom` MIT.
  - Direct dev deps (server + client + root): `@vitest/coverage-v8` MIT, `nodemon` MIT, `supertest` MIT, `vitest` MIT, `@fontsource/inter` (OFL-1.1 for the font; MIT for the package wrapper), `@vitejs/plugin-react` MIT, `fontkit` MIT, `png-to-ico` MIT, `sharp` Apache-2.0, `vite` MIT, `eslint` MIT, `@eslint/js` MIT, `eslint-import-resolver-alias` MIT, `eslint-plugin-import` MIT, `eslint-plugin-react` MIT, `husky` MIT, `lint-staged` MIT, `prettier` MIT.
  - **Findings: no AGPL-incompatible licenses identified.** MIT, BSD-2-Clause, Apache-2.0, and OFL-1.1 are all compatible with redistribution under AGPLv3 (permissive licenses can be sublicensed under copyleft; OFL applies to font files and does not constrain the surrounding code). No vendored third-party code with its own license header exists under `apps/` or `packages/`.
- **PRD reference:** Add or update PRD heading **§14 Licensing** (propose new section if absent) and update PRD §13 *Initial Decisions to Document* to reference the relicense ADR. A new ADR `0027-relicense-mit-to-agplv3.md` is the appropriate decision-record artifact.

### Phase B doc reconciliation — 2026-05-21

The following gaps were closed by documentation-only edits in Phase B (PRD / rules / roadmap; no application code changed). Roadmap items 14, 15, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 39, 44 carry the per-item details.

- **1.14** — PRD §3.1.1 step 4 now names the tenant-active check (`passportService.js:54`).
- **2.1 / 4.26** — New PRD §3.14.1 documents the `emails` table; `rules/entities.md` adds an Email row.
- **2.2** — New PRD §3.14.2 documents `tenant_preferences`.
- **2.3 / 2.16** — PRD §3.3.1a notes the `VendorContactsPanel` + import/export routing; §4.6.3 lists the panel.
- **2.4** — PRD §3.2.3 documents the orphan portal-users router + SQL helpers.
- **2.6** — New PRD §3.14.3 documents the `countries` admin reference table.
- **2.7 / 4.28** — PRD §3.1.2 documents the `EXACT_MATCH_KEYS` carve-out.
- **2.8** — PRD §3.1.2 documents `policyCatalogReconciler` + reseed migrations + CLI.
- **2.9 / 2.11** — PRD §4.3 documents `auditContext`, `requestContext`, `registerAuditResolver`; §3.3.3 lists the app-user provisioning libs.
- **2.10 / 2.21 / 2.12** — PRD §2.4 middleware reference now names `requireRootTenant`, `errorHandler`, `permCacheInvalidator`, `rbacQueryContext`, `permissionLoader`.
- **2.13** — PRD §3.3.4 names the client-side editable sections.
- **2.14** — PRD §3.2.3 references `PlatformMaintenancePage.jsx`.
- **2.15** — PRD §6.5 replaces the "non-exhaustive" note with a concrete shared-component inventory.
- **2.17 / 2.18** — PRD §3.2.1 documents `provisionTenantCli.js` and `seedRootEntity.js`.
- **2.19 / 2.20 / 4.15** — PRD §5.4 documents `modelPlanner` and extends the migration list to entry 17.
- **2.23 / 4.27** — PRD §3.10.5 names `/dashboard/cashflow` as the live UI placement.
- **2.24 / 4.14 / 4.4** — PRD §3.1.2 + §3.2.1 corrected: `allowed_modules` is read from `req.ctx.tenant.allowed_modules` (not a separate Redis key) and the "whitelist" framing is removed.
- **3.10 / 4.23** — PRD §3.2.2 access-control paragraph rewritten with the actual rbac wiring.
- **3.11 / 3.12 / 4.11** — `email` columns removed from PRD §3.3.2 and §3.3.3; pointer to §3.14.1 / `emails` table added.
- **3.25** — PRD §3.7.3 / §3.8.3 document the controller `VALID_METHODS` allowlist.
- **3.26** — PRD §3.1.2 documents the `tenants::portal-users::import|export` carve-out with rationale.
- **4.7** — Stale `policyCatalogRouter` `router: 'roles'` footnote removed from PRD §3.1.2.
- **4.9 / 4.22** — `rules/rbac.md` now lists all four fallback steps including the `::::` wildcard.
- **4.12** — PRD §13.5 extended with ADR-0024 / 0025 / 0026 / 0027.
- **4.24** — PRD §3.1.2 Phase-2 `ph` claim replaced with the live Phase-3 wording.
- **4.31** — PRD §3.10.6 aging-bucket prose now states 5 buckets matching the view DDL.
- **1.7** — PRD §3.1.2 records the wildcard reality (roadmap item 10 still tracks the per-module retroactive seeder option).

### 5.4 — DCO sign-off requirement

- **Tag:** [PROJECT]
- **Source:** strategic discussion 2026-05-20
- **Decision date:** 2026-05-20
- **Phase:** 1
- **Blocks:** none.
- **Change required:** Require Developer Certificate of Origin (DCO) sign-off on every commit. Add `CONTRIBUTING.md` (new file) stating the DCO requirement, linking the DCO text, and declaring that the maintainer (Ian Silverstone) has sole enforcement authority — including the ability to waive, retroactively accept, or reject sign-off on any contribution.
- **Enforcement mechanism (one chosen):** **Husky `commit-msg` hook.** The repo already uses husky (`package.json:prepare = "husky"`, dev dep `husky ^9.1.7`) and has an active husky-managed pre-commit policy (mixed `apps/client/` + `apps/server/` rejection per `CLAUDE.md`). Adding a `commit-msg` hook that greps for `Signed-off-by: ` matching the committer identity keeps enforcement in the same tooling already in place, runs locally before push, and avoids the latency and bypass surface of a pure CI check. A redundant CI check may be added later if external contributors arrive; GitHub branch-protection-only enforcement was rejected because it cannot validate commit-message trailers natively.
- **PRD reference:** Document under PRD **§14 Licensing** (same section as 5.3) or a sibling **§15 Contribution Policy**. `CONTRIBUTING.md` at repo root is the primary surface; PRD reference is a pointer to it.
