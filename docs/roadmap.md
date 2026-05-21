# AXERRA Roadmap

**Date:** 2026-05-20
**Sources:** `docs/gap-analysis.md` (Sections 1–5), `docs/PRD-outline.md`

This roadmap tracks delivery state across the AXERRA monorepo. Sequencing in
**Upcoming** follows: (1) blocking dependencies first, (2) Section 3 drift
defects ordered by severity, (3) Section 1 planned items in PRD order, (4)
logical grouping within ties.

**Tag legend:**

- `[PRD]` — PRD documentation edit only.
- `[CODE]` — code change in `apps/` or `packages/`.
- `[PROJECT]` — repo-root / project-level change (license, contributing, husky, README, etc.).
- `[RULES]` — `docs/rules/*.md` edit only (no PRD, no code).

Combined tags (e.g. `[CODE][PRD]`) indicate the item touches both surfaces. The
order is conventional: `[CODE]` before `[PRD]` before `[PROJECT]`/`[RULES]`.

---

## Completed

History of work that is both documented in the PRD/ARDs/rules AND implemented
in code. Items here do NOT appear as gaps in Sections 1, 2, or 3 of the gap
analysis (or were explicitly withdrawn as "implemented, doc accurate"). Append
only; no priority order.

### Core ERP / monorepo

- PERN stack (Express 5, React 18, Postgres 17, Redis) baseline. Source: PRD §1.4.
- Monorepo workspaces `apps/server`, `apps/client`, `packages/shared` with root `.env`. Source: PRD §1.5.
- pg-schemata integration as schema/model layer. Source: PRD §2.2.
- Server module layout (`apiRoutes/v1`, `controllers`, `models`, `schemas`, `services`) and client `pages/components/hooks/contexts` layout. Source: PRD §2.3.

### Multi-tenancy

- Schema-per-tenant isolation via pg-schemata; admin schema holds tenants and portal_users. Source: PRD §2.1, §3.2.
- `requireRootTenant` middleware gating admin actions via `ROOT_TENANT_CODE` env. Source: PRD §3.2.3 (per gap 2.10, mechanism documented in `rules/tenants.md`).

### RBAC

- 4-layer model (policies → data scope → state filters → field groups). Source: PRD §3.1.2, ADR-0013.
- Four-step fallback resolution including `::::` wildcard. Source: PRD §3.1.2, ADR-0013.
- `moduleEntitlement` middleware: empty/missing `allowed_modules` ⇒ allow-all. Source: PRD §3.1.2, ADR-0018 (gap 3.9 withdrawn, gap 2.24).
- Support role: `level:'none'` for `FINANCIAL_MODULES`, `full` elsewhere. Source: PRD §3.1.2 (gap 3.27).
- `tenants::portal-users::import|export` intentionally not seeded (code portion of gap 3.26 — see Upcoming Item 19 for doc portion). Source: `rules/rbac.md`, `policyCatalogSeeder.js`.

### Auth

- `forcePasswordChange` set when `user.status === 'invited'`; first password change promotes to `'active'`. Source: `rules/auth.md` (gap 3.24).
- Tenant `active` check at login (code portion of gap 1.14 — see Upcoming Item 18 for doc portion). Source: `rules/auth.md`.
- Phase 3 login: home-tenant resolution, permission loading, `calcPermHash`, empty-caps rejection (code portion of gap 3.3 — see Upcoming Item 4 for doc portion). Source: commit `1ac6a21`.

### Accounting / numbering

- Tenant-scoped numbering with 7 id_types (`employee, vendor, client, contact, ar_invoice, ap_invoice, project`) in CHECK + seeded. Source: PRD §3.13.2 (gaps 1.9, 3.28).
- `backfillCodes` in `numberingService.js`; controller returns `{ updatedRecords, backfilledCodes }`. Source: PRD §3.13.9 (gap 1.5 withdrawn).
- Transaction-safe `allocateNumber` with reset strategy. Source: PRD §3.13.

### Projects / activities

- Composite FK `tasks_master(tenant_id, task_group_code) → task_groups(tenant_id, code)` via ALTER TABLE. Source: PRD §3.4.1 (gap 3.22).
- Change-orders nav guard policy `projects::change-orders`. Source: PRD §7 (gap 3.23).
- Vendors (org) has no `roles` column; employees/clients/vendor_contacts do. Source: PRD §3.3.1 (gap 3.17).

### AP / AR

- Controller-level payment-method allowlist `('check','ach','wire')` on payments and receipts (code portion of gap 3.25 — see Upcoming Item 20 for doc portion). Source: `rules/ap.md`, `rules/ar.md`.

### BOM

- Server-side vendor-skus and vendor-pricing routers with import/export catalog policies (code portion of gap 1.8 — see Upcoming Item 12 for doc portion). Source: PRD §3.6.2.

### Reports / views

- AR/AP aging SQL views with 5 buckets (`current, 1-30, 31-60, 61-90, over_90`). Source: PRD §3.10.4, `rules/reports.md` (gap 4.31; PRD §3.10.6 prose edit pending).
- `/api/reports/v1/company-cashflow` endpoint wired through `cashflowController.getCompanyCashflow`. Source: PRD §3.10.5 (gap 1.4 withdrawn).

### Infra / CI

- CI split into `test-fast` (unit + rbac, mocked) and `test-integration` (contract + integration, real PG + Redis containers). Source: PRD §9.
- Husky pre-commit splits mixed `apps/client/` + `apps/server/` changes. Source: PRD §11.4.
- ESLint flat config, Prettier, EditorConfig, npm workspaces. Source: PRD §11.

---

## In Progress

_No items currently flagged in progress._

---

## Upcoming

Ordered by dependency, then severity (Section 3), then PRD order (Section 1), then logical grouping.

---

### [x] 1. Reposition AXERRA as horizontal project-native multi-entity ERP

- **Tag:** [PRD]
- **Complexity:** (S)
- **PRD reference:** §1.1 *Product Positioning* (new, per PRD-outline.md and user decision 2026-05-20 — placed at front of chapter 1; existing §1.1–§1.4 renumbered down to §1.2–§1.5).
- **Source:** gap 5.1.
- **Details:**
  - Scope (in): add §1.1 reframing AXERRA as horizontal project-native ERP; renumber existing §1.1–§1.4 to §1.2–§1.5; declare Phase 1 = ERP core, Phase 2 = construction as reference vertical; cross-reference from §13 and each module intro; update any in-PRD references to the old §1.1–§1.4 numbers.
  - Scope (out): no code changes; no ARD yet (ADR-0027 is a separate item for relicense).
  - Files affected: `docs/PRD.md` (§1 area, §13, module section intros, any internal cross-refs to §1.1–§1.4); `docs/roadmap.md` Completed entries that cite old §1.3/§1.4 by number; any ARD or rules file referencing §1.1–§1.4 by number.
  - Dependencies: none (this is the blocking precursor to many PRD edits below).
- **Definition of Done:**
  - Code changes: none.
  - PRD edits: §1.1 *Product Positioning* (new); §1.1–§1.4 renumbered to §1.2–§1.5; cross-refs from §13 and each module intro.
  - ARD entry: none.
  - Rules update: none.
  - Tests added/changed: none.

### [x] 2. Introduce explicit PRD scope-tag taxonomy

- **Tag:** [PRD]
- **Complexity:** (M)
- **PRD reference:** Legend block at top of PRD (per PRD-outline.md Legend section); applied across every H2/H3.
- **Source:** gap 4.30.
- **Details:**
  - Scope (in): add legend defining `[in-scope]`, `[deferred]`, `[out-of-scope]`, `(proposed — needs confirmation)`; tag every H2/H3 in `docs/PRD.md`.
  - Scope (out): no code; status tags (`[implemented]`/`[intended]`/`[superseded]`) handled by individual reconciliation items.
  - Files affected: `docs/PRD.md`.
  - Dependencies: blocks on item 1 (positioning frames scope decisions).
- **Definition of Done:**
  - Code changes: none.
  - PRD edits: Legend block + scope tag on every H2/H3.
  - ARD entry: none.
  - Rules update: none.
  - Tests added/changed: none.

### [x] 3. Fix `cost_lines` lock transition (schema CHECK vs controller mismatch)

- **Tag:** [CODE][PRD]
- **Complexity:** (S)
- **PRD reference:** §3.5.4 *Cost Lines*.
- **Source:** gaps 1.12, 3.5 (Section 3, blocker).
- **Details:**
  - Scope (in): reconcile schema CHECK (`'draft','submitted','approved','change_order'`) with controller `VALID_TRANSITIONS` that writes `locked`. Decision required: expand CHECK to include `locked` OR change controller's target state. Implement chosen direction.
  - Scope (out): broader cost-line workflow redesign.
  - Files affected: `apps/server/src/modules/activities/schemas/costLinesSchema.js`, `apps/server/src/modules/activities/controllers/costLinesController.js`, `docs/PRD.md` §3.5.4, `docs/rules/activities.md`.
  - Dependencies: none (independent blocker).
- **Definition of Done:**
  - Code changes: `costLinesSchema.js` and/or `costLinesController.js`.
  - PRD edits: §3.5.4 (state list, transitions).
  - ARD entry: none.
  - Rules update: `docs/rules/activities.md` cost_lines section.
  - Tests added/changed: `apps/server/src/modules/activities/__tests__/costLinesController.test.js` (lock transition path).

### [x] 4. Document Phase-3 login flow (ph computed, empty caps rejected)

- **Tag:** [PRD]
- **Complexity:** (S)
- **PRD reference:** §3.1.1 *Authentication*.
- **Source:** gap 3.3 (doc portion — code already shipped, see Completed); gap 4.24 (Section 3, major).
- **Details:**
  - Scope (in): rewrite §3.1.1 Phase-2 language (`ph` hardcoded null, no permission load) to match Phase-3 reality from commit `1ac6a21`. Document login-time tenant `active` check (gap 1.14).
  - Scope (out): code changes (already shipped).
  - Files affected: `docs/PRD.md` §3.1.1, `docs/rules/auth.md`.
  - Dependencies: item 2 (scope tags).
- **Definition of Done:**
  - Code changes: none.
  - PRD edits: §3.1.1.
  - ARD entry: none.
  - Rules update: `docs/rules/auth.md` login flow section.
  - Tests added/changed: none.

### [x] 5. Document `portal_user_tenants` binding table as cross-tenant source of truth

- **Tag:** [PRD]
- **Complexity:** (S)
- **PRD reference:** §3.2.2 *Manage Users*; §2.1 *Multi-Tenant Model*.
- **Source:** gaps 2.5, 3.4, 4.25 (Section 3, major).
- **Details:**
  - Scope (in): add `admin.portal_user_tenants` description; clarify `portal_users.tenant_id` is home tenant only; rewrite any text treating `tenant_id` as the sole FK.
  - Scope (out): schema/code changes.
  - Files affected: `docs/PRD.md` §3.2.2 and §2.1; `docs/rules/auth.md`.
  - Dependencies: item 2.
- **Definition of Done:**
  - Code changes: none.
  - PRD edits: §3.2.2, §2.1.
  - ARD entry: none.
  - Rules update: `docs/rules/auth.md`.
  - Tests added/changed: none.

### [x] 6. Document tenants import-xls provisioning behavior

- **Tag:** [PRD]
- **Complexity:** (S)
- **PRD reference:** §3.2.1 *Manage Tenants*.
- **Source:** gap 3.2 (Section 3, major).
- **Details:**
  - Scope (in): update PRD §3.2.1 and `rules/tenants.md` to state `POST /tenants/import-xls` invokes `provisionNewTenant` inside `importFromSpreadsheet`. Remove stale "admin-rows-only" claim.
  - Scope (out): code changes.
  - Files affected: `docs/PRD.md` §3.2.1, `docs/rules/tenants.md`.
  - Dependencies: item 2.
- **Definition of Done:**
  - Code changes: none.
  - PRD edits: §3.2.1.
  - ARD entry: none.
  - Rules update: `docs/rules/tenants.md`.
  - Tests added/changed: none.

### [x] 7. Make per-legal-entity invoice numbering functional

- **Tag:** [CODE][PRD]
- **Complexity:** (M)
- **PRD reference:** §3.13.1 *Design Principles*; §3.7.1 *AP Invoices*; §3.8.1 *AR Invoices*.
- **Source:** gaps 3.7, 4.8 (Section 3, major).
- **Details:**
  - Scope (in): add `legal_entity_id` column to `ap_invoices` and `ar_invoices` schemas; ensure `allocateNumber` receives a real (non-null) value; choose whether scope is mandatory or optional. Alternatively (decision required): downgrade §3.13.1 principle to defer per-legal-entity scope.
  - Scope (out): backfill of historical rows (per CLAUDE.md "no backfill migrations").
  - Files affected: `apps/server/src/modules/ap/schemas/apInvoicesSchema.js`, `apps/server/src/modules/ar/schemas/arInvoicesSchema.js`, controllers as needed, `docs/PRD.md` §3.13.1/§3.7.1/§3.8.1, `docs/rules/ap.md`, `docs/rules/ar.md`.
  - Dependencies: item 2.
- **Definition of Done:**
  - Code changes: invoice schemas + controllers (or doc-only downgrade path).
  - PRD edits: §3.13.1, §3.7.1, §3.8.1.
  - ARD entry: none (existing numbering ADR covers principle).
  - Rules update: `docs/rules/ap.md`, `docs/rules/ar.md`.
  - Tests added/changed: contract tests for AP/AR invoice creation with legal entity scope, under `apps/server/src/modules/ap/__tests__/` and `apps/server/src/modules/ar/__tests__/`.
- **Open questions:** Will `legal_entity_id` be NOT NULL or nullable for tenants with a single legal entity?

### [x] 8. Document `?preview=1` import preview mode across 16 entities

- **Tag:** [PRD]
- **Complexity:** (S)
- **PRD reference:** §4.6.1 *Backend (pg-schemata + Controller Layer)*.
- **Source:** gaps 3.13, 4.29 (Section 3, major).
- **Details:**
  - Scope (in): document preview-mode query param, counts-only return shape, and applicability across the 16 entities; note divergence from `{ inserted: ... }` baseline.
  - Scope (out): code changes (already shipped via commits `4319089`, `4e18221`).
  - Files affected: `docs/PRD.md` §4.6.1.
  - Dependencies: item 2.
- **Definition of Done:**
  - Code changes: none.
  - PRD edits: §4.6.1.
  - ARD entry: none.
  - Rules update: none.
  - Tests added/changed: none.

### [ ] 9. Implement chart specs on Project Profitability and Project Cashflow pages

- **Tag:** [CODE][PRD]
- **Complexity:** (L)
- **PRD reference:** §3.10.6 *UI Requirements*.
- **Source:** gap 3.16 (Section 3, major).
- **Details:**
  - Scope (in): BarChart for budget/committed/actual on `ProjectProfitabilityPage.jsx`; stacked area + dashed forecast region + toggle on `ProjectCashflowPage.jsx`.
  - Scope (out): backend changes (data shapes already exist via reports endpoints).
  - Files affected: `apps/client/src/pages/Reports/ProjectProfitabilityPage.jsx`, `apps/client/src/pages/Reports/ProjectCashflowPage.jsx`, possibly shared chart components.
  - Dependencies: none.
- **Definition of Done:**
  - Code changes: the two page files above plus any new chart components.
  - PRD edits: §3.10.6 (mark as implemented).
  - ARD entry: none.
  - Rules update: none.
  - Tests added/changed: none (client unit tests not standard in repo).
- **Unknowns driving (L):** exact MUI X Charts API for stacked area with dashed forecast region; forecast vs actual data partitioning at the data-grid → chart boundary; design spec for toggle UX.

### [x] 10. Document the two-mechanism role-policy seeding model in PRD §3.1.2

- **Tag:** [PRD]
- **Complexity:** (S)
- **PRD reference:** §3.1.2 *RBAC* — "Policy Seeding by Role Class".
- **Source:** gap 1.7 (Section 1, silent-missing/major). Decision recorded 2026-05-21: gap was framing-only — PRD described one mechanism for all roles when in fact two coexist by design. After the PRD rewrite, item 10 is no longer a drift item.
- **Details:**
  - Scope (in): rewrite §3.1.2 to distinguish (a) idempotent roles (`super_user`, `admin`, `support`, `vendor_contact`, `client`) which use a wildcard `module:''` `'full'` policy at seed time — current code — and (b) all other roles (`accountant`, `ap_clerk`, `ar_clerk`, `project_manager`, `procurement`, `cfo`, custom roles) which receive explicit per-module policies and require a retroactive seeder when new modules ship. Mark the retroactive seeder paragraph `[intended]` so anyone reading the PRD sees the open work.
  - Scope (out): building the per-module retroactive seeder itself (that's future implementation work, tracked by the `[intended]` tag on the PRD paragraph — no separate roadmap entry per the PRD-as-source-of-truth principle).
  - Files affected: `docs/PRD.md` §3.1.2.
  - Dependencies: item 2 (scope tags / status tags).
- **Definition of Done:**
  - Code changes: none.
  - PRD edits: §3.1.2 *Policy Seeding by Role Class*.
  - ARD entry: none.
  - Rules update: none.
  - Tests added/changed: none.

### [ ] 11. Fix duplicate / dead navigation links

- **Tag:** [CODE][PRD]
- **Complexity:** (S)
- **PRD reference:** §7 *Navigation Structure*.
- **Source:** gap 1.3 (Section 1, planned).
- **Details:**
  - Scope (in): correct `/projects/profitability` link (actual page at `/reports/profitability`); resolve `/projects/detail` (dynamic-only) duplication.
  - Scope (out): new pages.
  - Files affected: `apps/client/src/config/navigationConfig.js:41,113`, `docs/PRD.md` §7.
  - Dependencies: none.
- **Definition of Done:**
  - Code changes: `apps/client/src/config/navigationConfig.js`.
  - PRD edits: §7.
  - ARD entry: none.
  - Rules update: none.
  - Tests added/changed: none.

### [ ] 12. Implement client import UI on Vendor SKUs and Vendor Pricing pages

- **Tag:** [CODE][PRD]
- **Complexity:** (M)
- **PRD reference:** §3.6.2 *Vendor SKUs*; §4.6.3 *Pages with Import/Export*.
- **Source:** gap 1.8 (doc portion — code already shipped, see Completed).
- **Details:**
  - Scope (in): add import dialog and hooks to `VendorSkuMatchingPage.jsx` and `CatalogPage.jsx`; update §4.6.3 page list to include vendor-skus and vendor-pricing.
  - Scope (out): backend (routers already exist).
  - Files affected: `apps/client/src/pages/BOM/VendorSkuMatchingPage.jsx`, `apps/client/src/pages/BOM/CatalogPage.jsx`, possibly client import hooks.
  - Dependencies: item 2.
- **Definition of Done:**
  - Code changes: BOM page files above.
  - PRD edits: §4.6.3 page list.
  - ARD entry: none.
  - Rules update: none.
  - Tests added/changed: none.

### [ ] 13. Implement `projects.on_hold` transitions

- **Tag:** [CODE][PRD]
- **Complexity:** (S)
- **PRD reference:** §3.4.1 *Projects*.
- **Source:** gaps 1.11, 3.6 (Section 3, minor).
- **Details:**
  - Scope (in): add `VALID_TRANSITIONS` edges in/out of `on_hold` in `projectsController.js`; document permitted source/target states.
  - Scope (out): UI changes (status select reads from controller).
  - Files affected: `apps/server/src/modules/projects/controllers/projectsController.js`, `docs/PRD.md` §3.4.1, `docs/rules/projects.md`.
  - Dependencies: none.
- **Definition of Done:**
  - Code changes: `projectsController.js`.
  - PRD edits: §3.4.1.
  - ARD entry: none.
  - Rules update: `docs/rules/projects.md`.
  - Tests added/changed: `apps/server/src/modules/projects/__tests__/projectsController.test.js` transition coverage.

### [x] 14. Update PRD entity sections to remove `email` columns on clients and employees

- **Tag:** [PRD]
- **Complexity:** (S)
- **PRD reference:** §3.3.2 *Clients*; §3.3.3 *Employees*; §3.3.4 *Polymorphic Sources*.
- **Source:** gaps 3.11, 3.12, 4.11 (Section 3, minor).
- **Details:**
  - Scope (in): delete `clients.email` and `employees.email` column references and the partial-unique-index spec; document that emails live in the `emails` table via `sources` (ADR-0025).
  - Scope (out): code (already aligned).
  - Files affected: `docs/PRD.md` §3.3.2, §3.3.3, §3.3.4.
  - Dependencies: item 2.
- **Definition of Done:**
  - Code changes: none.
  - PRD edits: §3.3.2, §3.3.3, §3.3.4.
  - ARD entry: none.
  - Rules update: `docs/rules/entities.md` if cross-references exist.
  - Tests added/changed: none.

### [x] 15. Document `portal-users` rbac wiring (PRD wording stale)

- **Tag:** [PRD]
- **Complexity:** (S)
- **PRD reference:** §3.2.2 *Manage Users*; §3.1.2 *RBAC*.
- **Source:** gaps 3.10, 4.23 (Section 3, minor).
- **Details:**
  - Scope (in): remove "rbac() not currently applied" line; document `rbac('view')` on GET and `rbac('full')` on register/PUT/DELETE/PATCH.
  - Scope (out): code (already in place).
  - Files affected: `docs/PRD.md` §3.2.2, §3.1.2.
  - Dependencies: item 2.
- **Definition of Done:**
  - Code changes: none.
  - PRD edits: §3.2.2, §3.1.2.
  - ARD entry: none.
  - Rules update: none.
  - Tests added/changed: none.

### [ ] 16. Add `is_primary` column to `project_clients`

- **Tag:** [CODE][PRD]
- **Complexity:** (S)
- **PRD reference:** §3.4.1 *Projects*.
- **Source:** gap 3.8 (Section 3, minor). Direction confirmed per user decision 2026-05-20: add the column.
- **Details:**
  - Scope (in): add `is_primary boolean default false` to `projectClientsSchema.js`; add partial unique index ensuring at most one `is_primary = true` row per `project_id` (matches the pattern used on vendors, addresses, phone numbers, contacts).
  - Scope (out): redesigning the client/project relationship; UI changes beyond exposing the flag.
  - Files affected: `apps/server/src/modules/projects/schemas/projectClientsSchema.js`; `docs/PRD.md` §3.4.1 (already documents the column — no edit needed beyond the partial-index note).
  - Dependencies: item 2.
- **Definition of Done:**
  - Code changes: schema update + partial unique index.
  - PRD edits: §3.4.1 partial-index clarification only.
  - ARD entry: none.
  - Rules update: `docs/rules/projects.md` if behavior changes.
  - Tests added/changed: integration test for the partial unique index.

### [ ] 17. Add CHECK constraint on `portal_users.entity_type`

- **Tag:** [CODE][PRD]
- **Complexity:** (S)
- **PRD reference:** §3.2.2 *Manage Users*.
- **Source:** gap 3.20 (Section 3, minor).
- **Details:**
  - Scope (in): add CHECK enforcing `('employee','vendor_contact','client')` with NULL allowed for super-user bootstrap to `portalUsersSchema.js`.
  - Scope (out): rewrite of portal-users semantics.
  - Files affected: `apps/server/src/system/admin/schemas/portalUsersSchema.js`, `docs/PRD.md` §3.2.2.
  - Dependencies: none.
- **Definition of Done:**
  - Code changes: schema CHECK addition.
  - PRD edits: §3.2.2 (note enforcement now in place).
  - ARD entry: none.
  - Rules update: none.
  - Tests added/changed: schema-level rejection test if available.

### [x] 18. Document tenant `active` check at login in PRD

- **Tag:** [PRD]
- **Complexity:** (S)
- **PRD reference:** §3.1.1 *Authentication*.
- **Source:** gap 1.14 (doc portion — code already shipped, see Completed).
- **Details:**
  - Scope (in): note `passportService.js:54` rejection with "Tenant is inactive." in PRD §3.1.1.
  - Scope (out): code.
  - Files affected: `docs/PRD.md` §3.1.1.
  - Dependencies: covered by item 4 if bundled; tracked separately for clarity.
- **Definition of Done:**
  - Code changes: none.
  - PRD edits: §3.1.1.
  - ARD entry: none.
  - Rules update: none.
  - Tests added/changed: none.

### [x] 19. Document `tenants::portal-users::import|export` carve-out in PRD

- **Tag:** [PRD]
- **Complexity:** (S)
- **PRD reference:** §3.1.2 *RBAC*.
- **Source:** gap 3.26 (doc portion — code already shipped, see Completed).
- **Details:**
  - Scope (in): add carve-out note matching `policyCatalogSeeder.js:238` comment.
  - Scope (out): code.
  - Files affected: `docs/PRD.md` §3.1.2.
  - Dependencies: item 2.
- **Definition of Done:**
  - Code changes: none.
  - PRD edits: §3.1.2.
  - ARD entry: none.
  - Rules update: none.
  - Tests added/changed: none.

### [x] 20. Document AP/AR payment-method allowlist in PRD

- **Tag:** [PRD]
- **Complexity:** (S)
- **PRD reference:** §3.7.3 *Payments*; §3.8.3 *Receipts*.
- **Source:** gap 3.25 (doc portion — code already shipped, see Completed).
- **Details:**
  - Scope (in): document controller-level allowlist (`check`, `ach`, `wire`); rules already accurate.
  - Scope (out): code.
  - Files affected: `docs/PRD.md` §3.7.3, §3.8.3.
  - Dependencies: item 2.
- **Definition of Done:**
  - Code changes: none.
  - PRD edits: §3.7.3, §3.8.3.
  - ARD entry: none.
  - Rules update: none.
  - Tests added/changed: none.

### [x] 21. Document `emails` first-class entity in PRD and rules/entities.md

- **Tag:** [PRD]
- **Complexity:** (S)
- **PRD reference:** §3.3 *Core Entities* (new subsection §3.14.1 *Emails (first-class tenant-scoped table)* per PRD-outline.md) or fold into §3.3.4.
- **Source:** gaps 2.1, 4.26.
- **Details:**
  - Scope (in): add section covering `emailsSchema.js`, `Emails.js`, controller, router `/api/core/v1/emails`, policy `core::emails`. Add to `rules/entities.md`.
  - Scope (out): code.
  - Files affected: `docs/PRD.md`, `docs/rules/entities.md`.
  - Dependencies: items 2, 14 (entity-email PRD edits).
- **Definition of Done:**
  - Code changes: none.
  - PRD edits: new §3.14.1 (or extend §3.3.4).
  - ARD entry: none (ADR-0025 already covers).
  - Rules update: `docs/rules/entities.md`.
  - Tests added/changed: none.

### [x] 22. Document `tenant_preferences` module in PRD

- **Tag:** [PRD]
- **Complexity:** (S)
- **PRD reference:** New §3.14.2 *Tenant Preferences* per PRD-outline.md.
- **Source:** gap 2.2.
- **Details:**
  - Scope (in): document schema, model, controller, router `/api/core/v1/tenant-preferences`, migration `202603270015_tenantPreferences.js`, seeder.
  - Scope (out): code.
  - Files affected: `docs/PRD.md`.
  - Dependencies: item 2.
- **Definition of Done:**
  - Code changes: none.
  - PRD edits: new §3.14.2.
  - ARD entry: optional new ADR if decision context warrants; else none.
  - Rules update: none.
  - Tests added/changed: none.

### [x] 23. Document `countries` admin reference table in PRD

- **Tag:** [PRD]
- **Complexity:** (S)
- **PRD reference:** New §3.14.3 *Countries (admin reference table)* per PRD-outline.md.
- **Source:** gap 2.6.
- **Details:**
  - Scope (in): document `countriesSchema.js`, `Countries.js`, `services/countriesSeeder.js`.
  - Scope (out): code.
  - Files affected: `docs/PRD.md`.
  - Dependencies: item 2.
- **Definition of Done:**
  - Code changes: none.
  - PRD edits: new §3.14.3.
  - ARD entry: none.
  - Rules update: none.
  - Tests added/changed: none.

### [x] 24. Document `vendor_contacts` entity + UI affordance and add §4.6.3 entry

- **Tag:** [PRD]
- **Complexity:** (S)
- **PRD reference:** §3.3.1a *Vendor Contacts*; §4.6.3 *Pages with Import/Export*.
- **Source:** gaps 2.3, 2.16.
- **Details:**
  - Scope (in): describe `VendorContactsPanel.jsx` + `ContactFormDialog.jsx` inside Vendor edit dialog; add Vendor Contacts entry to §4.6.3 page list (or note its omission from a top-level page).
  - Scope (out): code.
  - Files affected: `docs/PRD.md`.
  - Dependencies: item 2.
- **Definition of Done:**
  - Code changes: none.
  - PRD edits: §3.3.1a, §4.6.3.
  - ARD entry: none.
  - Rules update: none.
  - Tests added/changed: none.

### [x] 25. Document orphan portal-users admin surface

- **Tag:** [PRD]
- **Complexity:** (S)
- **PRD reference:** §3.2.2 or new §3.2.3 *Admin Operations*.
- **Source:** gap 2.4.
- **Details:**
  - Scope (in): document `/api/tenants/v1/orphan-portal-users/{find_orphans,cleanup_orphans}` and migration `202605010001_orphanPortalUsersCleanup.js`.
  - Scope (out): code.
  - Files affected: `docs/PRD.md` §3.2.
  - Dependencies: items 2, 5.
- **Definition of Done:**
  - Code changes: none.
  - PRD edits: §3.2 area.
  - ARD entry: none.
  - Rules update: `docs/rules/tenants.md` if not already.
  - Tests added/changed: none.

### [x] 26. Document `EXACT_MATCH_KEYS` policy-resolution carve-out

- **Tag:** [PRD]
- **Complexity:** (S)
- **PRD reference:** §3.1.2 *RBAC*.
- **Source:** gaps 2.7, 4.28.
- **Details:**
  - Scope (in): document exact-match bypass for catalog entries with `policy_required: true`; cross-reference `policyCatalogSeeder.js:27-37`.
  - Scope (out): code.
  - Files affected: `docs/PRD.md` §3.1.2, `docs/rules/rbac.md`.
  - Dependencies: item 2.
- **Definition of Done:**
  - Code changes: none.
  - PRD edits: §3.1.2.
  - ARD entry: none.
  - Rules update: `docs/rules/rbac.md`.
  - Tests added/changed: none.

### [x] 27. Document policy-catalog reconciler + reseed migrations + CLI

- **Tag:** [PRD]
- **Complexity:** (S)
- **PRD reference:** §3.1.2 *RBAC* (or §5.4 *Schema Management*).
- **Source:** gap 2.8.
- **Details:**
  - Scope (in): document `policyCatalogReconciler.js`, migrations `202603270016_reseedPolicyCatalog.js`, `202605040018_reseedTenantImportExportCatalog.js`, CLI `scripts/db/reconcilePolicyCatalog.js`.
  - Scope (out): code.
  - Files affected: `docs/PRD.md` §3.1.2 / §5.4.
  - Dependencies: item 2.
- **Definition of Done:**
  - Code changes: none.
  - PRD edits: §3.1.2 or §5.4.
  - ARD entry: none.
  - Rules update: none.
  - Tests added/changed: none.

### [x] 28. Document app-user provisioning libs and audit/request-context middleware

- **Tag:** [PRD]
- **Complexity:** (S)
- **PRD reference:** §3.3.3 *Employees*; §4.3 *Audit Fields*; §2.4 *Request Flow*.
- **Source:** gaps 2.9, 2.11, 2.12.
- **Details:**
  - Scope (in): document `loginEmailSync`, `employeeAppUserSync`, `clearOtherPrimary`, `employeeRoleValidator`, `registerAuditResolver`, `requestContext`, `auditContext.js`, `permCacheInvalidator`, `rbacQueryContext`, `permissionLoader`.
  - Scope (out): code.
  - Files affected: `docs/PRD.md` §3.3.3, §4.3, §2.4.
  - Dependencies: item 2.
- **Definition of Done:**
  - Code changes: none.
  - PRD edits: §3.3.3, §4.3, §2.4.
  - ARD entry: none.
  - Rules update: none.
  - Tests added/changed: none.

### [x] 29. Document `requireRootTenant`, `errorHandler`, client-side editable sections, Platform Maintenance page

- **Tag:** [PRD]
- **Complexity:** (S)
- **PRD reference:** §3.2 (root-tenant gate); §10.6 *Error Handling*; §3.3.4 (editable sections); §7 / §3.2 (Platform Maintenance).
- **Source:** gaps 2.10, 2.21, 2.13, 2.14, 2.22.
- **Details:**
  - Scope (in): note `requireRootTenant` mechanism, `errorHandler` middleware, `EditableEmailsSection`/`EmailsSection`/`EmailRow`/Tax/Phone/Addresses analogues, `PlatformMaintenancePage.jsx`, and `CreateTenantWizard` (multi-step, not "form").
  - Scope (out): code.
  - Files affected: `docs/PRD.md` §3.2, §3.3.4, §7, §10.6.
  - Dependencies: item 2.
- **Definition of Done:**
  - Code changes: none.
  - PRD edits: §3.2, §3.3.4, §7, §10.6.
  - ARD entry: none.
  - Rules update: none.
  - Tests added/changed: none.

### [x] 30. Document tenant provisioning CLI and `seedRootEntity`

- **Tag:** [PRD]
- **Complexity:** (S)
- **PRD reference:** §3.2.1.
- **Source:** gaps 2.17, 2.18.
- **Details:**
  - Scope (in): document `scripts/db/provisionTenantCli.js` and `services/seedRootEntity.js` (Axerra super_user employee bootstrap).
  - Scope (out): code.
  - Files affected: `docs/PRD.md` §3.2.1.
  - Dependencies: item 2.
- **Definition of Done:**
  - Code changes: none.
  - PRD edits: §3.2.1.
  - ARD entry: none.
  - Rules update: none.
  - Tests added/changed: none.

### [x] 31. Document migration tooling (`modelPlanner`, `moduleScopes`) and extend §5.4 migration list

- **Tag:** [PRD]
- **Complexity:** (S)
- **PRD reference:** §5.4 *Schema Management & Migrations*.
- **Source:** gaps 2.19, 2.20, 4.15.
- **Details:**
  - Scope (in): describe `modelPlanner.js` (topological planner) and `moduleScopes.js` (admin/tenant filter); extend §5.4 migration order list to include all post-`202502120080_sqlViews` migrations: `202603150013_importExportCatalog`, `202603270015_tenantPreferences`, `202603270016_reseedPolicyCatalog`, `202604270017_orphanSourceCleanup`, `202605010001_orphanPortalUsersCleanup`, `202605040018_reseedTenantImportExportCatalog`.
  - Scope (out): code.
  - Files affected: `docs/PRD.md` §5.4.
  - Dependencies: item 2.
- **Definition of Done:**
  - Code changes: none.
  - PRD edits: §5.4.
  - ARD entry: none.
  - Rules update: none.
  - Tests added/changed: none.

### [x] 32. Reconcile company-cashflow nav placement in PRD

- **Tag:** [PRD]
- **Complexity:** (S)
- **PRD reference:** §3.10.5 *API Endpoints*; §7 *Navigation Structure*.
- **Source:** gaps 2.23, 4.27.
- **Details:**
  - Scope (in): document `/dashboard/cashflow` as live placement; reconcile §7 nav and §3.10.5 endpoint reference.
  - Scope (out): code.
  - Files affected: `docs/PRD.md` §3.10.5, §7.
  - Dependencies: item 2.
- **Definition of Done:**
  - Code changes: none.
  - PRD edits: §3.10.5, §7.
  - ARD entry: none.
  - Rules update: none.
  - Tests added/changed: none.

### [x] 33. Clarify `allowed_modules` wording and source

- **Tag:** [PRD]
- **Complexity:** (S)
- **PRD reference:** §3.1.2 *RBAC*; §3.2.1 *Manage Tenants*.
- **Source:** gaps 4.4, 4.14, 2.24.
- **Details:**
  - Scope (in): remove "whitelist" wording that implies deny-by-default (canonical: empty/missing ⇒ allow-all per ADR-0018); correct claim that `allowed_modules` is cached in Redis (actually read from `req.ctx.tenant.allowed_modules`).
  - Scope (out): code.
  - Files affected: `docs/PRD.md` §3.1.2, §3.2.1.
  - Dependencies: item 2.
- **Definition of Done:**
  - Code changes: none.
  - PRD edits: §3.1.2, §3.2.1.
  - ARD entry: none.
  - Rules update: none.
  - Tests added/changed: none.

### [x] 34. Fix `rules/rbac.md` fallback step count (3 → 4 steps incl. `::::` wildcard)

- **Tag:** [RULES]
- **Complexity:** (S)
- **PRD reference:** §3.1.2 (cross-reference only).
- **Source:** gaps 4.9, 4.22.
- **Details:**
  - Scope (in): update `docs/rules/rbac.md` to list all four fallback steps; align with PRD §3.1.2 and ADR-0013.
  - Scope (out): code or PRD wording (already canonical).
  - Files affected: `docs/rules/rbac.md`.
  - Dependencies: none.
- **Definition of Done:**
  - Code changes: none.
  - PRD edits: none.
  - ARD entry: none.
  - Rules update: `docs/rules/rbac.md` fallback section.
  - Tests added/changed: none.

### [x] 35. Delete stale `policyCatalogRouter` `router: 'roles'` footnote in PRD

- **Tag:** [PRD]
- **Complexity:** (S)
- **PRD reference:** §3.1.2 *RBAC*.
- **Source:** gap 4.7.
- **Details:**
  - Scope (in): remove stale footnote asserting `withMeta({ router: 'roles' })`; canonical is `router: 'policy-catalog'`.
  - Scope (out): code.
  - Files affected: `docs/PRD.md` §3.1.2.
  - Dependencies: item 2.
- **Definition of Done:**
  - Code changes: none.
  - PRD edits: §3.1.2.
  - ARD entry: none.
  - Rules update: none.
  - Tests added/changed: none.

### [x] 36. Update §3.10.6 aging-bucket prose to 5 buckets

- **Tag:** [PRD]
- **Complexity:** (S)
- **PRD reference:** §3.10.6 *UI Requirements*; §3.10.4 *SQL Views for Profitability*.
- **Source:** gap 4.31 (formerly 4.2 / 1.10 / 3.19).
- **Details:**
  - Scope (in): replace 4-bucket prose (Current, 31-60, 61-90, 90+) with canonical 5-bucket scheme matching view definitions and `rules/reports.md`.
  - Scope (out): code (views already correct).
  - Files affected: `docs/PRD.md` §3.10.6.
  - Dependencies: item 2.
- **Definition of Done:**
  - Code changes: none.
  - PRD edits: §3.10.6.
  - ARD entry: none.
  - Rules update: none.
  - Tests added/changed: none.

### [x] 37. Add ADR-0024, ADR-0025, ADR-0026 to §13.5 list

- **Tag:** [PRD]
- **Complexity:** (S)
- **PRD reference:** §13.5 *Initial Decisions to Document*.
- **Source:** gap 4.12.
- **Details:**
  - Scope (in): extend §13.5 list to reference ADR-0024, ADR-0025, ADR-0026.
  - Scope (out): code.
  - Files affected: `docs/PRD.md` §13.5.
  - Dependencies: item 1 (positioning), item 2.
- **Definition of Done:**
  - Code changes: none.
  - PRD edits: §13.5.
  - ARD entry: none (existing ADRs already exist).
  - Rules update: none.
  - Tests added/changed: none.

### [x] 38. Resolve `CLAUDE.md` / `AGENTS.md` duplication

- **Tag:** [PROJECT]
- **Complexity:** (S)
- **PRD reference:** none (Appendix A withdrawn per user decision 2026-05-20; handled at repo level only).
- **Source:** gap 4.1.
- **Details:**
  - Scope (in): pick one canonical file and symlink/generate the other.
  - Scope (out): rewriting either file's content; no PRD section.
  - Files affected: repo root `CLAUDE.md`, `AGENTS.md`.
  - Dependencies: none.
- **Definition of Done:**
  - Code changes: none (repo-root only).
  - PRD edits: none.
  - ARD entry: none.
  - Rules update: none.
  - Tests added/changed: none.

### [x] 39. Date-stamp PRD snapshot-state paragraphs (`rbac()`, `ph`, etc.)

- **Tag:** [PRD]
- **Complexity:** (S)
- **PRD reference:** §3.1.2; §3.1.1.
- **Source:** gap 4.23 (Section 4, prd-internal).
- **Details:**
  - Scope (in): replace floating "currently" claims with dated state notes or `[implemented]`/`[intended]` status tags from PRD-outline.md legend.
  - Scope (out): code.
  - Files affected: `docs/PRD.md`.
  - Dependencies: item 2 (status tag taxonomy).
- **Definition of Done:**
  - Code changes: none.
  - PRD edits: §3.1.1, §3.1.2.
  - ARD entry: none.
  - Rules update: none.
  - Tests added/changed: none.

### [ ] 40. Implement fiscal-period validation (`fiscal_periods` table + journal-entry guard)

- **Tag:** [CODE][PRD]
- **Complexity:** (L)
- **PRD reference:** §3.9.2 *Journal Entries*.
- **Source:** gap 1.1 (Section 1, planned — Phase 1 confirmed per user decision 2026-05-20).
- **Details:**
  - Scope (in): introduce `fiscal_periods` schema/model/seeder, wire status (`open`/`closed`/`locked`) into journal-entry creation guard.
  - Scope (out): full close-the-books workflow.
  - Files affected: new schema/model under `apps/server/src/modules/accounting/`, controller updates, PRD §3.9.2.
  - Dependencies: item 2.
- **Definition of Done:**
  - Code changes: new schema/model + controller guard.
  - PRD edits: §3.9.2.
  - ARD entry: optional new ADR `0028-fiscal-periods.md` (decide during design).
  - Rules update: none.
  - Tests added/changed: contract tests under `apps/server/src/modules/accounting/__tests__/`.
- **Unknowns driving (L):** period-close semantics (auto-close vs manual); per-legal-entity vs tenant-wide periods; interaction with journal-entry posting queues.

### [x] 41. Relicense from MIT to AGPLv3

- **Tag:** [PROJECT][PRD]
- **Complexity:** (S)
- **PRD reference:** §14 *Licensing* (new, per PRD-outline.md).
- **Source:** gap 5.3.
- **Details:**
  - Scope (in): replace root `LICENSE` with AGPLv3 text; update `apps/server/package.json`, `apps/client/package.json`, add `license` to `packages/shared/package.json`; update `README.md` badge/mention.
  - Scope (out): per-file header rewrites (separate concern).
  - Files affected: `LICENSE`, `apps/server/package.json`, `apps/client/package.json`, `packages/shared/package.json`, `README.md`, `docs/PRD.md` §14, new ADR.
  - Dependencies: none.
- **Definition of Done:**
  - Code changes: package.json `license` fields.
  - PRD edits: new §14.
  - ARD entry: `docs/decisions/0027-relicense-mit-to-agplv3.md`.
  - Rules update: none.
  - Tests added/changed: none.

### [x] 42. Add DCO sign-off enforcement (`COLLABORATION.md` + Husky `commit-msg`)

- **Tag:** [PROJECT][PRD]
- **Complexity:** (S)
- **PRD reference:** §15 *Contribution Policy* (new, per PRD-outline.md).
- **Source:** gap 5.4.
- **Details:**
  - Scope (in): add `CONTRIBUTING.md` at repo root with DCO requirement and maintainer-authority statement; add Husky `commit-msg` hook that greps for `Signed-off-by:` matching the committer identity.
  - Scope (out): CI-side DCO check (deferred per gap 5.4).
  - Files affected: `CONTRIBUTING.md` (new), `.husky/commit-msg` (new), `docs/PRD.md` §15.
  - Dependencies: item 41 (licensing land first so DCO language refers to the right license).
- **Definition of Done:**
  - Code changes: `.husky/commit-msg` script.
  - PRD edits: new §15.
  - ARD entry: none.
  - Rules update: none (CLAUDE.md may reference).
  - Tests added/changed: none.

### [ ] 43. Optional company-assignment visibility layer for core master tables (technical design + implementation)

- **Tag:** [CODE][PRD]
- **Complexity:** (L)
- **PRD reference:** §3.3.6 *Company-Assignment Visibility (optional)* (new, per PRD-outline.md). Phase 1 (late) per user decision 2026-05-20.
- **Source:** gap 5.2.
- **Details:**
  - Scope (in): design junction-table model, query scoping, RBAC interaction; per-tenant toggle (default shared); implementation across employees, vendors, clients, contacts.
  - Scope (out): scoped visibility for non-master tables.
  - Files affected: schemas under `apps/server/src/modules/core/` for the four entities; tenant preferences integration; query-context middleware; `docs/PRD.md` §3.3.6.
  - Dependencies: items 1 (positioning), 2 (scope tags), 22 (tenant preferences documented).
- **Definition of Done:**
  - Code changes: junction tables + query-scope logic + tenant-preferences integration.
  - PRD edits: §3.3.6.
  - ARD entry: `docs/decisions/0028-company-assignment-visibility.md` (or next available number).
  - Rules update: `docs/rules/entities.md`, `docs/rules/rbac.md`.
  - Tests added/changed: integration tests under `apps/server/src/modules/core/__tests__/` covering both shared and scoped modes.
- **Unknowns driving (L):** junction-table vs row-tagging tradeoff; interaction with RBAC scope filters; migration strategy for existing tenants opting in; default behavior when company assignment is partial.

### [x] 44. Document shared component inventory in PRD §6.5

- **Tag:** [PRD]
- **Complexity:** (S)
- **PRD reference:** §6.5 *Reusable Component Patterns*.
- **Source:** gap 2.15.
- **Details:**
  - Scope (in): enumerate the shared components currently in use (`ReportTablePage`, `ReadOnlyDataTable`, `DetailDialog`, `StepperFormDialog`, `CollectionSectionHeader`, `ToastSnackbar`, `Wordmark`, `PrimaryButton`, `SecondaryButton`, `TertiaryButton`, and the editable sections covered by item 29) in PRD §6.5. PRD §6.5 explicitly notes the list is non-exhaustive; this item replaces that with a concrete inventory while preserving the "additions land via PR" note.
  - Scope (out): code; reorganizing the components themselves.
  - Files affected: `docs/PRD.md` §6.5.
  - Dependencies: item 2 (scope tags).
- **Definition of Done:**
  - Code changes: none.
  - PRD edits: §6.5 inventory.
  - ARD entry: none.
  - Rules update: none.
  - Tests added/changed: none.

### [x] 45. PR template enforcing doc-impact disclosure

- **Tag:** [PROJECT]
- **Complexity:** (S)
- **PRD reference:** none (repo-level tooling).
- **Source:** Phase C of `.claude/plans/i-asked-a-question-robust-horizon.md`.
- **Details:**
  - Scope (in): add `.github/PULL_REQUEST_TEMPLATE.md` with checkboxes for PRD section(s) edited, ARD added/updated, rules file edited, or explicit `no-doc-change` reason.
  - Scope (out): branch protection rules (handled at the GitHub UI level).
  - Files affected: `.github/PULL_REQUEST_TEMPLATE.md`.
  - Dependencies: none.
- **Definition of Done:**
  - Code changes: none (repo-root only).
  - PRD edits: none.
  - ARD entry: none.
  - Rules update: none.
  - Tests added/changed: none.

### [x] 46. CI doc-coverage check (modules ↔ rules files)

- **Tag:** [PROJECT]
- **Complexity:** (S)
- **PRD reference:** none (CI tooling).
- **Source:** Phase C.
- **Details:**
  - Scope (in): new `doc-coverage` job in `.github/workflows/ci.yml` invoking `scripts/checkDocCoverage.js`. The script maps each tracked server module directory to its rules file and fails the build when a PR touches code under a module without editing the matching `docs/rules/<module>.md`. The `no-doc-change` PR label overrides via `SKIP_DOC_COVERAGE=1`.
  - Scope (out): doc-coverage for client-side modules (not currently mapped to rules files).
  - Files affected: `.github/workflows/ci.yml`, `scripts/checkDocCoverage.js`.
  - Dependencies: item 45 (PR template explains the override flow).
- **Definition of Done:**
  - Code changes: `scripts/checkDocCoverage.js`.
  - PRD edits: none.
  - ARD entry: none.
  - Rules update: none.
  - Tests added/changed: manual verification — open a test PR touching `apps/server/src/modules/ap/` without rules edits; job fails. Add the label or rules edit; job passes.

### [x] 47. Quarterly gap-analysis review automation

- **Tag:** [PROJECT]
- **Complexity:** (S)
- **PRD reference:** none.
- **Source:** Phase C.
- **Details:**
  - Scope (in): scheduled GitHub Action (`.github/workflows/quarterly-gap-analysis.yml`) firing on the 1st of January, April, July, October at 09:00 UTC. The job opens a tracking issue with a checklist guiding the maintainer through a fresh gap-analysis pass.
  - Scope (out): automating the gap-analysis run itself (still a human-in-the-loop activity).
  - Files affected: `.github/workflows/quarterly-gap-analysis.yml`.
  - Dependencies: none.
- **Definition of Done:**
  - Code changes: none.
  - PRD edits: none.
  - ARD entry: none.
  - Rules update: none.
  - Tests added/changed: manual — `workflow_dispatch` trigger opens a tracking issue.

---

## Deferred

### [ ] D1. P&L Report

- **Tag:** [CODE][PRD]
- **Complexity:** (L)
- **PRD reference:** §3.11.1 *P&L Report* (deferred — proposed needs confirmation).
- **Source:** gap 1.2.
- **Details:**
  - Scope (in): backend controller, route under `/api/reports/v1/`, client page at `/reports/pnl`.
  - Scope (out): Phase-1 commitment.
  - Files affected: new under `apps/server/src/modules/reports/` and `apps/client/src/pages/Reports/`.
  - Dependencies: §3.10 data linkage already in place.
- **Definition of Done:**
  - Code changes: controller, router, client page.
  - PRD edits: §3.11.1.
  - ARD entry: none unless design warrants.
  - Rules update: `docs/rules/reports.md`.
  - Tests added/changed: contract tests for the new endpoint.
- **Unknowns driving (L):** account-grouping conventions; period selection UI; comparison periods.

### [ ] D2. Balance Sheet

- **Tag:** [CODE][PRD]
- **Complexity:** (L)
- **PRD reference:** §3.11.2 *Balance Sheet* (deferred — proposed needs confirmation).
- **Source:** gap 1.2.
- **Details:**
  - Scope (in): backend controller, route under `/api/reports/v1/`, client page at `/reports/balance-sheet`.
  - Scope (out): Phase-1 commitment.
  - Files affected: new under `apps/server/src/modules/reports/` and `apps/client/src/pages/Reports/`.
  - Dependencies: ledger balances + chart of accounts (already in place).
- **Definition of Done:**
  - Code changes: controller, router, client page.
  - PRD edits: §3.11.2.
  - ARD entry: none unless design warrants.
  - Rules update: `docs/rules/reports.md`.
  - Tests added/changed: contract tests for the new endpoint.
- **Unknowns driving (L):** account classification (asset/liability/equity); as-of date semantics; multi-entity consolidation.

### [ ] D3. Exhaustive copyright-header coverage audit

- **Tag:** [CODE]
- **Complexity:** (S)
- **PRD reference:** §10.3 *Copyright & File Headers*.
- **Source:** gap 3.21 (deferred under verification rule).
- **Details:**
  - Scope (in): run `find apps -name '*.js' -o -name '*.jsx' | while read f; do head -3 "$f" | grep -qE 'Copyright|@file' || echo "$f"; done` across ~700+ files; add headers where missing.
  - Scope (out): rewriting existing valid headers.
  - Files affected: any source files lacking headers.
  - Dependencies: item 41 (relicense lands first so headers reference correct license).
- **Definition of Done:**
  - Code changes: per-file header additions.
  - PRD edits: none.
  - ARD entry: none.
  - Rules update: none.
  - Tests added/changed: none.

---

## Change Log

- 2026-05-20: Initial roadmap created.
- 2026-05-20: Sanity-check fixes: added gap 2.15 item; reclassified gap 1.1 planned; annotated 5 code/doc splits; corrected tags on items 9, 34, 43; added [RULES] tag; fixed Item 40 DoD label.
- 2026-05-21: Phase A (legal & project hygiene) shipped. Items 38, 41, 42 marked done. LICENSE → AGPL-3.0-or-later; copyright → Ian Silverstone with SPDX tags across 684 files; README rewritten for horizontal-ERP positioning; COLLABORATION.md created with DCO 1.1; husky `commit-msg` hook enforces sign-off; npm license-check job added to CI (`scripts/checkLicenses.js`, `.licenses-allowed.json`, `.licenses-exceptions.json`); ADR-0027 records license / copyright / DCO / dependency policy decisions; AGENTS.md is now a symlink to CLAUDE.md.
- 2026-05-21: Phase B (bulk PRD + rules reconciliation) shipped. Items 14, 15, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 39, 44 marked done. PRD edits: removed `email` columns from §3.3.2 / §3.3.3 with `emails`-table pointers; refreshed §3.2.2 portal-users RBAC wording; documented `EXACT_MATCH_KEYS`, the policy-catalog reconciler + CLI, the `tenants::portal-users::import|export` carve-out, and the wildcard admin auto-seed reality in §3.1.2; added AP/AR payment-method allowlist notes; added new §3.14 (Emails / Tenant Preferences / Countries); extended §3.3.4 with editable sections; expanded §2.4 Request Flow + §4.3 Audit Fields with `auditContext` / `requestContext` / `errorHandler` / `permCacheInvalidator`; documented orphan portal-users admin surface, Platform Maintenance page, tenant provisioning CLI, `seedRootEntity`, and `modelPlanner` / `moduleScopes`; extended §5.4 migration list to entry 17; reconciled `/dashboard/cashflow` placement; replaced 4-bucket aging prose with 5 buckets in §3.10.6; appended ADR-0024 / 0025 / 0026 / 0027 to §13.5; replaced §6.5 "non-exhaustive" shared-component note with a concrete inventory; corrected `allowed_modules` source / "whitelist" wording; cleaned up stale `policyCatalogRouter` footnote. Rules edits: `rules/rbac.md` four-step fallback + EXACT_MATCH note; `rules/entities.md` lists `emails` as a first-class entity.
- 2026-05-21: Phase B Copilot/Codex review: corrected §2.4 middleware order (authRedis before auditContext), `requireRootTenant` description (home_tenant lowercased), `errorHandler` mapping list, `X-Token-Stale` status (live), orphan portal-users endpoint paths (`/orphans/preview`, `/orphans/cleanup`), and `addAuditFields` description (no longer injects audit actor — handled by ALS resolver). Second pass split the request-flow diagram into GET vs mutation chains and added BR-RBAC-043 / 044 / 048 anchored sub-sections in `rules/rbac.md` so PRD cross-references resolve.
- 2026-05-21: Phase C (anti-drift guardrails) shipped. Items 45, 46, 47 marked done. `.github/PULL_REQUEST_TEMPLATE.md` enforces doc-impact disclosure; new `doc-coverage` CI job (`scripts/checkDocCoverage.js`) fails PRs that touch a module without editing the matching `docs/rules/<module>.md`, overridable via the `no-doc-change` label; scheduled GitHub Action (`.github/workflows/quarterly-gap-analysis.yml`) opens a quarterly tracking issue with a gap-analysis re-run checklist.
