# Dialog Field Audit — NAP Frontend

**Generated:** 2026-03-18
**Auditor:** Claude Code
**Source of truth:** `docs/PRD.md` §3

> System fields (`id`, `tenant_id`, `source_id`, `deactivated_at`, `password_hash`, `embedding`, `description_normalized`, `model`) are expected absent from UI and not flagged.

---

## Vendors — Create/Edit Dialog

**File:** `apps/nap-client/src/pages/Core/VendorsPage.jsx`
**Branch:** `fix/dialog-vendor-fields`

### Fields Present

- `name` (TextField, required) — Create + Edit
- `code` (TextField, maxLength 16) — Create + Edit
- `payment_term_id` (Select dropdown populated from payment_terms settings table) — Create + Edit
- `notes` (TextField, multiline) — Create + Edit
- **Emails section** (inline edit, Edit only): `email`, `label`, `is_primary`
- **Phone Numbers section** (inline edit, Edit only): `phone_type`, `country_code`, `phone_number`, `is_primary`
- **Addresses section** (card-based, Edit only): `label`, `address_line_1`, `address_line_2`, `city`, `state_province`, `postal_code`, `country_code`, `is_primary`
- **Tax Identifiers section** (inline edit, Edit only): `country_code`, `tax_type`, `tax_value`, `is_primary`
- **Vendor Contacts section** (inline edit, Edit only): `first_name`, `last_name`, `position`, `department`, `is_app_user`, `roles`, `is_primary`

### Missing Fields (PRD defines, dialog omits)

| Field              | Type         | Expected Control   | Notes                                          |
| ------------------ | ------------ | ------------------ | ---------------------------------------------- |
| `is_active`      | boolean      | Checkbox or Select | User-facing toggle (separate from soft delete) |
| `address_line_3` | varchar(255) | TextField          | Missing from address section — PRD §3.3.4    |

### Extra Fields (dialog has, PRD does not define)

| Field                 | Notes                                                                                          |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| Email `label` field | Emails table in PRD does not define a `label` column — this may be an extension beyond PRD |

### Fix Checklist

- [ ] Add `is_active` as Checkbox or Select (Yes/No)
- [ ] Add `address_line_3` as TextField in address cards

---

## Vendors — View Dialog

**File:** `apps/nap-client/src/pages/Core/VendorsPage.jsx`
**Branch:** `fix/dialog-vendor-fields`

### Fields Present

- `code` (FieldRow)
- `name` (FieldRow)
- `payment_term_id` (FieldRow)
- `status` (StatusBadge)
- `created_at` (FieldRow)
- `updated_at` (FieldRow)
- `notes` (FieldRow, conditional)
- Emails, Phones, Addresses, Tax IDs, Contacts (child collections displayed)

### Missing Fields (PRD defines, dialog omits)

| Field       | Type    | Expected Control | Notes                       |
| ----------- | ------- | ---------------- | --------------------------- |
| `is_active` | boolean | FieldRow         | Show active/inactive status |

### Extra Fields (dialog has, PRD does not define)

| Field                                                      | Notes |
| ---------------------------------------------------------- | ----- |
| (none beyond Vendor Contacts section noted in Create/Edit) |       |

### Fix Checklist

- [ ] Add `is_active` as FieldRow display (Yes/No)

---

## Clients — Create/Edit Dialog

**File:** `apps/nap-client/src/pages/Core/ClientsPage.jsx`
**Branch:** `fix/dialog-client-fields`

### Fields Present

- `name` (TextField, required) — Create + Edit
- `code` (TextField, maxLength 16) — Create + Edit
- **Emails section** (inline edit, Edit only): `email`, `label`, `is_primary`
- **Phone Numbers section** (inline edit, Edit only): `phone_type`, `country_code`, `phone_number`, `is_primary`
- **Addresses section** (card-based, Edit only): `label`, `address_line_1`, `address_line_2`, `city`, `state_province`, `postal_code`, `country_code`, `is_primary`
- **Tax Identifiers section** (inline edit, Edit only): `country_code`, `tax_type`, `tax_value`, `is_primary`

### Missing Fields (PRD defines, dialog omits)

| Field              | Type         | Expected Control                       | Notes                                          |
| ------------------ | ------------ | -------------------------------------- | ---------------------------------------------- |
| `email`          | varchar(128) | TextField (type=email)                 | PRD §3.3.2 defines email on clients table     |
| `roles`          | text[]       | Autocomplete (multiple, from useRoles) | Required for RBAC                              |
| `is_app_user`    | boolean      | Checkbox                               | Required before nap_users login can be created |
| `is_active`      | boolean      | Checkbox or Select                     | User-facing toggle                             |
| `address_line_3` | varchar(255) | TextField                              | Missing from address section                   |

### Extra Fields (dialog has, PRD does not define)

| Field  | Notes |
| ------ | ----- |
| (none) |       |

### Fix Checklist

- [ ] Add `email` as TextField (type=email) in Create + Edit
- [ ] Add `roles` as Autocomplete (multiple)
- [ ] Add `is_app_user` as Checkbox
- [ ] Add `is_active` as Checkbox or Select
- [ ] Add `address_line_3` as TextField in address cards

---

## Clients — View Dialog

**File:** `apps/nap-client/src/pages/Core/ClientsPage.jsx`
**Branch:** `fix/dialog-client-fields`

### Fields Present

- `code` (FieldRow)
- `name` (FieldRow)
- `status` (StatusBadge)
- `created_at` (FieldRow)
- `updated_at` (FieldRow)
- Emails, Phones, Addresses, Tax IDs (child collections displayed)

> ⚠️ **Address display omits `address_line_3`** — Clients View only concatenates `address_line_1` + `address_line_2`, unlike Vendors/Employees/Contacts which include all three lines.

### Missing Fields (PRD defines, dialog omits)

| Field                              | Type         | Expected Control                 | Notes                             |
| ---------------------------------- | ------------ | -------------------------------- | --------------------------------- |
| `email`                          | varchar(128) | FieldRow                         | Primary client email              |
| `roles`                          | text[]       | FieldRow (comma-joined)          | Display assigned roles            |
| `is_app_user`                    | boolean      | FieldRow                         | Show whether client has app login |
| `is_active`                      | boolean      | FieldRow                         | Show active/inactive              |
| `address_line_3` in View display | varchar(255) | Include in address concatenation | Currently only shows line 1 + 2   |

### Fix Checklist

- [ ] Add `email` as FieldRow display
- [ ] Add `roles` as FieldRow display
- [ ] Add `is_app_user` as FieldRow display
- [ ] Add `is_active` as FieldRow display
- [ ] Fix address display to include `address_line_3` (match Vendor/Employee/Contact pattern)

---

## Employees — Create Dialog

**File:** `apps/nap-client/src/pages/Core/EmployeesPage.jsx`
**Branch:** `fix/dialog-employee-fields`

### Fields Present

- `first_name` (TextField, required)
- `last_name` (TextField, required)
- `code` (TextField, maxLength 16)
- `position` (TextField)
- `department` (TextField)
- `email` (TextField, type=email)
- `is_app_user` (Checkbox)
- `roles` (Autocomplete, multiple)
- `is_primary_contact` (Checkbox)
- `is_billing_contact` (Checkbox)

### Missing Fields (PRD defines, dialog omits)

| Field  | Type | Expected Control | Notes                  |
| ------ | ---- | ---------------- | ---------------------- |
| (none) |      |                  | All PRD fields present |

> Note: Employees have NO `is_active` field per PRD — soft delete only via `deactivated_at`.

✅ No missing or extra fields detected in Create dialog.

---

## Employees — Edit Dialog

**File:** `apps/nap-client/src/pages/Core/EmployeesPage.jsx`
**Branch:** `fix/dialog-employee-fields`

### Fields Present

- `first_name` (TextField, required)
- `last_name` (TextField, required)
- `code` (TextField, maxLength 16)
- `position` (TextField)
- `department` (TextField)
- `is_app_user` (Checkbox)
- `roles` (Autocomplete, multiple)
- `is_primary_contact` (Checkbox)
- `is_billing_contact` (Checkbox)
- Reset Password button (conditional)
- **Emails section** (inline edit): `email`, `label`, `is_login`, `is_primary`
- **Phone Numbers section** (inline edit): `phone_type`, `country_code`, `phone_number`, `is_primary`
- **Addresses section** (card-based): `label`, `address_line_1`, `address_line_2`, `city`, `state_province`, `postal_code`, `country_code`, `is_primary`
- **Tax Identifiers section** (inline edit): `country_code`, `tax_type`, `tax_value`, `is_primary`

### Missing Fields (PRD defines, dialog omits)

| Field              | Type         | Expected Control | Notes                                                                                                                                                         |
| ------------------ | ------------ | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `email`          | varchar(128) | TextField        | PRD §3.3.3 defines `email` directly on employees table. Currently only available via Emails sub-section — confirm if inline emails section satisfies this |
| `address_line_3` | varchar(255) | TextField        | Missing from address cards                                                                                                                                    |

### Extra Fields (dialog has, PRD does not define)

| Field              | Notes                                                        |
| ------------------ | ------------------------------------------------------------ |
| Email `label`    | Not in PRD phone/address schema — may be an extension       |
| Email `is_login` | Not in PRD — custom UX for linking email to nap_users login |

### Fix Checklist

- [ ] Verify `email` field coverage — PRD has it on employee table, UI uses emails sub-section
- [ ] Add `address_line_3` to address cards

---

## Employees — View Dialog

**File:** `apps/nap-client/src/pages/Core/EmployeesPage.jsx`
**Branch:** `fix/dialog-employee-fields`

### Fields Present

- `code` (FieldRow)
- `first_name` (FieldRow)
- `last_name` (FieldRow)
- `position` (FieldRow)
- `department` (FieldRow)
- `is_app_user` (FieldRow)
- `roles` (FieldRow, comma-joined)
- `status` (StatusBadge)
- `is_primary_contact` (FieldRow)
- `is_billing_contact` (FieldRow)
- `created_at` (FieldRow)
- `updated_at` (FieldRow)
- Emails (with `is_login`), Phones, Addresses, Tax IDs (child collections)

### Missing Fields (PRD defines, dialog omits)

| Field     | Type         | Expected Control | Notes                                                |
| --------- | ------------ | ---------------- | ---------------------------------------------------- |
| `email` | varchar(128) | FieldRow         | Shown via emails sub-section — verify if sufficient |

✅ Substantially complete — `email` is covered by the Emails collection display.

---

## Contacts — Create/Edit Dialog

**File:** `apps/nap-client/src/pages/Core/ContactsPage.jsx`
**Branch:** `fix/dialog-contact-fields`

Contacts are standalone miscellaneous payees (dual-purpose: AP and AR). No RBAC, no login.

### Fields Present

- `name` (TextField, required) — Create + Edit
- `code` (TextField, maxLength 16) — Create + Edit
- `is_active` (Checkbox) — Create + Edit
- **Emails section** (inline edit, Edit only): `email`, `label`, `is_primary`
- **Phone Numbers section** (inline edit, Edit only): `phone_type`, `country_code`, `phone_number`, `is_primary`
- **Addresses section** (card-based, Edit only): `label`, `address_line_1`, `address_line_2`, `address_line_3`, `city`, `state_province`, `postal_code`, `country_code`, `is_primary`
- **Tax Identifiers section** (inline edit, Edit only): `country_code`, `tax_type`, `tax_value`, `is_primary`

### Missing Fields (PRD defines, dialog omits)

(none)

### Extra Fields (dialog has, PRD does not define)

(none)

### Fix Checklist

- [x] Add `code` as TextField (maxLength 16) in Create + Edit
- [x] Add `is_active` as Checkbox
- [x] Add `address_line_3` to address cards
- [x] Remove `source_id` raw UUID input (auto-created server-side)
- [x] Remove `position` and `is_primary` (not in contacts schema)
- [x] Remove `roles` and `is_app_user` (contacts have no RBAC)

---

## Contacts — View Dialog

**File:** `apps/nap-client/src/pages/Core/ContactsPage.jsx`
**Branch:** `fix/dialog-contact-fields`

### Fields Present

- `code` (FieldRow)
- `name` (FieldRow)
- `is_active` (FieldRow)
- `status` (StatusBadge)
- `created_at` (FieldRow)
- `updated_at` (FieldRow)
- Emails, Phones, Addresses, Tax IDs (child collections)

### Missing Fields (PRD defines, dialog omits)

(none)

### Fix Checklist

- [x] Add `code` as FieldRow display
- [x] Add `is_active` as FieldRow display
- [x] Remove `position` and `is_primary` FieldRows (not in contacts schema)

---

## Companies — Create/Edit Dialog

**File:** `apps/nap-client/src/pages/Core/CompaniesPage.jsx`
**Branch:** `fix/dialog-company-fields`

### Fields Present

- `name` (TextField, required) — Create + Edit
- `code` (TextField, maxLength 16) — Create + Edit

> ⚠️ **No source data sub-sections.** Companies have `source_id` (FK to `sources` with `source_type = 'company'`) and are used in tenant provisioning with billing addresses and tax identifiers (PRD §3.2.1). The Edit dialog has no address or tax identifier sections.

### Missing Fields (PRD defines, dialog omits)

| Field                             | Type     | Expected Control          | Notes                                                 |
| --------------------------------- | -------- | ------------------------- | ----------------------------------------------------- |
| `is_active`                     | boolean  | Checkbox or Select        | PRD §3.3.5 — default true                           |
| **Addresses section**       | sub-form | Card-based address editor | Companies need addresses for billing/mailing/physical |
| **Tax Identifiers section** | sub-form | Inline repeatable rows    | Companies need tax IDs (EIN, VAT, etc.)               |

### Extra Fields (dialog has, PRD does not define)

| Field  | Notes |
| ------ | ----- |
| (none) |       |

### Fix Checklist

- [ ] Add `is_active` as Checkbox or Select (Yes/No)
- [ ] Wire up `useAddresses`, `useTaxIdentifiers` hooks for the company's `source_id`
- [ ] Add **Addresses section** (card-based, Edit only) with fields: `label`, `address_line_1`, `address_line_2`, `address_line_3`, `city`, `state_province`, `postal_code`, `country_code`, `is_primary`
- [ ] Add **Tax Identifiers section** (inline repeatable rows, Edit only) with fields: `country_code`, `tax_type`, `tax_value`, `is_primary`

---

## Companies — View Dialog

**File:** `apps/nap-client/src/pages/Core/CompaniesPage.jsx`
**Branch:** `fix/dialog-company-fields`

### Fields Present

- `code` (FieldRow)
- `name` (FieldRow)
- `status` (StatusBadge)
- `created_at` (FieldRow)
- `updated_at` (FieldRow)

> ⚠️ **No source data display.** View dialog does not show addresses or tax identifiers.

### Missing Fields (PRD defines, dialog omits)

| Field                             | Type       | Expected Control        | Notes                  |
| --------------------------------- | ---------- | ----------------------- | ---------------------- |
| `is_active`                     | boolean    | FieldRow                | Show active/inactive   |
| **Addresses display**       | collection | DataGrid or card list   | Show company addresses |
| **Tax Identifiers display** | collection | DataGrid or inline list | Show company tax IDs   |

### Fix Checklist

- [ ] Add `is_active` as FieldRow display
- [ ] Add **Addresses** collection display (matching Vendor/Employee View pattern)
- [ ] Add **Tax Identifiers** collection display

---

## Tenants — Create Dialog (CreateTenantWizard)

**File:** `apps/nap-client/src/pages/Tenant/CreateTenantWizard.jsx`
**Branch:** `fix/dialog-tenant-fields`

### Fields Present

**Step 1 — Tenant Details:**

- `tenant_code` (TextField, required, maxLength 6, auto-uppercased)
- `company` (TextField, required)
- `status` (TextField, select: active/trial/suspended/pending)
- `tier` (TextField, select: starter/growth/enterprise)
- `region` (TextField)
- `max_users` (TextField, type=number)
- `notes` (TextField, multiline)

**Step 2 — Address & Tax:**

- Billing address: `address_line_1`, `address_line_2`, `address_line_3`, `city`, `state_province`, `postal_code`, `country_code`
- Tax identifiers: `country_code`, `tax_type`, `tax_value` (repeatable rows)

**Step 3 — Admin User:**

- `admin_first_name` (TextField, required)
- `admin_last_name` (TextField, required)
- `admin_email` (TextField, type=email, required)
- `admin_password` (PasswordField, required)

### Missing Fields (PRD defines, dialog omits)

| Field               | Type  | Expected Control               | Notes                                  |
| ------------------- | ----- | ------------------------------ | -------------------------------------- |
| `allowed_modules` | jsonb | Multi-select or Checkbox group | PRD §3.2.1 — module access whitelist |

### Fix Checklist

- [ ] Add `allowed_modules` as multi-select or checkbox group in Step 1

---

## Tenants — Edit Dialog

**File:** `apps/nap-client/src/pages/Tenant/ManageTenantsPage.jsx`
**Branch:** `fix/dialog-tenant-fields`

### Fields Present

- `tenant_code` (TextField, disabled/display)
- `schema_name` (TextField, disabled/display)
- `company` (TextField, required)
- `status` (TextField, select)
- `tier` (TextField, select)
- `region` (TextField)
- `max_users` (TextField, type=number)
- `notes` (TextField, multiline)

### Missing Fields (PRD defines, dialog omits)

| Field               | Type  | Expected Control               | Notes       |
| ------------------- | ----- | ------------------------------ | ----------- |
| `allowed_modules` | jsonb | Multi-select or Checkbox group | PRD §3.2.1 |

### Fix Checklist

- [ ] Add `allowed_modules` as multi-select or checkbox group

---

## Tenants — View Details Dialog

**File:** `apps/nap-client/src/pages/Tenant/ManageTenantsPage.jsx`
**Branch:** `fix/dialog-tenant-fields`

### Fields Present

- `tenant_code` (FieldRow, labeled "Code")
- `tier` (FieldRow)
- `region` (FieldRow)
- `status` (FieldRow + StatusBadge)
- `max_users` (FieldRow)
- `schema_name` (FieldRow, monospace)
- `created_at` (FieldRow)
- `updated_at` (FieldRow)
- `notes` (FieldRow)
- Company Billing Address section (address fields)
- Tax Identifiers section
- Primary Contacts DataGrid (name, email, phone)
- Billing Contacts DataGrid (name, email, phone)

### Missing Fields (PRD defines, dialog omits)

| Field               | Type  | Expected Control      | Notes                   |
| ------------------- | ----- | --------------------- | ----------------------- |
| `allowed_modules` | jsonb | FieldRow or chip list | Display enabled modules |

### Fix Checklist

- [ ] Add `allowed_modules` as FieldRow or chip list display

---

## nap_users — Edit Dialog

**File:** `apps/nap-client/src/pages/Tenant/ManageUsersPage.jsx`
**Branch:** `fix/dialog-user-fields`

### Fields Present

- `email` (TextField, disabled/display)
- `status` (TextField, select: active/invited/locked)
- `password` (PasswordField, optional — "Leave blank to keep current password")

### Missing Fields (PRD defines, dialog omits)

| Field           | Type        | Expected Control                                              | Notes                                  |
| --------------- | ----------- | ------------------------------------------------------------- | -------------------------------------- |
| `entity_type` | varchar(16) | TextField (select: employee/vendor/client/contact) or display | PRD §3.2.2 — polymorphic entity link |
| `entity_id`   | uuid        | Autocomplete FK lookup                                        | PRD §3.2.2 — cross-schema reference  |
| `tenant_id`   | uuid        | Autocomplete or display                                       | PRD §3.2.2 — FK to tenants           |

### Extra Fields (dialog has, PRD does not define)

| Field        | Notes                                                                                              |
| ------------ | -------------------------------------------------------------------------------------------------- |
| `password` | Not in PRD nap_users Edit — PRD uses separate reset-password endpoint. May be acceptable admin UX |

### Fix Checklist

- [ ] Add `entity_type` as Select (employee/vendor/client/contact) or display
- [ ] Add `entity_id` as Autocomplete FK lookup (filtered by entity_type)
- [ ] Add `tenant_id` as Autocomplete FK lookup to tenants (or display if read-only)

---

## nap_users — View Dialog

**File:** `apps/nap-client/src/pages/Tenant/ManageUsersPage.jsx`
**Branch:** `fix/dialog-user-fields`

### Fields Present

- `email` (FieldRow)
- `entity_type` (FieldRow)
- `status` (FieldRow + StatusBadge)
- `created_at` (FieldRow)
- `updated_at` (FieldRow)

### Missing Fields (PRD defines, dialog omits)

| Field         | Type | Expected Control | Notes                                |
| ------------- | ---- | ---------------- | ------------------------------------ |
| `entity_id` | uuid | FieldRow         | Show linked entity reference         |
| `tenant_id` | uuid | FieldRow         | Show tenant (or display tenant name) |

### Fix Checklist

- [ ] Add `entity_id` as FieldRow display (ideally resolved to entity name)
- [ ] Add `tenant_id` as FieldRow display (ideally resolved to tenant name)

---

## Projects — Create/Edit Dialog

**File:** `apps/nap-client/src/pages/Projects/ProjectsPage.jsx`
**Branch:** `fix/dialog-project-fields`

### Fields Present

- `project_code` (TextField, required, maxLength 32) — Create + Edit
- `name` (TextField, required) — Create + Edit
- `description` (TextField, multiline) — Create + Edit
- `contract_amount` (TextField, type=number) — Create + Edit
- `notes` (TextField, multiline) — Create + Edit

### Missing Fields (PRD defines, dialog omits)

| Field          | Type        | Expected Control                                      | Notes                                     |
| -------------- | ----------- | ----------------------------------------------------- | ----------------------------------------- |
| `company_id` | uuid        | Autocomplete FK lookup to companies                   | PRD §3.4.1 — FK to companies (RESTRICT) |
| `address_id` | uuid        | Autocomplete FK lookup to addresses                   | PRD §3.4.1 — FK to addresses (SET NULL) |
| `status`     | varchar(20) | Select (planning/budgeting/released/complete/on_hold) | PRD §3.4.1                               |

### Fix Checklist

- [ ] Add `company_id` as Autocomplete FK lookup to companies
- [ ] Add `address_id` as Autocomplete FK lookup to addresses
- [ ] Add `status` as Select with options: planning, budgeting, released, complete, on_hold

---

## Projects — View Dialog

**File:** `apps/nap-client/src/pages/Projects/ProjectsPage.jsx`
**Branch:** `fix/dialog-project-fields`

### Fields Present

- `project_code` (FieldRow)
- `name` (FieldRow)
- `status` (FieldRow + StatusBadge)
- `contract_amount` (FieldRow)
- `created_at` (FieldRow)
- `updated_at` (FieldRow)

### Missing Fields (PRD defines, dialog omits)

| Field           | Type | Expected Control                    | Notes                |
| --------------- | ---- | ----------------------------------- | -------------------- |
| `company_id`  | uuid | FieldRow (resolved to company name) | Show owning company  |
| `address_id`  | uuid | FieldRow (resolved to address)      | Show project address |
| `description` | text | FieldRow                            | Project description  |
| `notes`       | text | FieldRow                            | Internal notes       |

### Fix Checklist

- [ ] Add `company_id` as FieldRow (resolved to company name)
- [ ] Add `address_id` as FieldRow (resolved to address display)
- [ ] Add `description` as FieldRow
- [ ] Add `notes` as FieldRow

---

## Project Clients — Dialog

🔴 **Dialog not found** — Project Clients (junction table `project_clients`) has no dedicated Create/Edit/View dialog. PRD §3.4.1 defines `client_id`, `role`, `is_primary` fields. This sub-entity likely needs a dialog within ProjectDetailPage or ProjectsPage.

---

## Units — Create/Edit Dialog

**File:** `apps/nap-client/src/pages/Projects/ProjectDetailPage.jsx` (inline)
**Branch:** `fix/dialog-unit-fields`

### Fields Present

- `unit_code` (TextField, required, maxLength 32) — Create + Edit
- `name` (TextField, required) — Create + Edit

### Missing Fields (PRD defines, dialog omits)

| Field                | Type        | Expected Control                   | Notes                                |
| -------------------- | ----------- | ---------------------------------- | ------------------------------------ |
| `template_unit_id` | uuid        | Autocomplete FK lookup             | PRD §3.4.2 — FK to template_units  |
| `version_used`     | integer     | TextField (type=number) or display | PRD §3.4.2 — template version used |
| `status`           | varchar(20) | Select (draft/released/complete)   | PRD §3.4.2                          |

> Note: `project_id` should be auto-populated from parent project context.

### Fix Checklist

- [ ] Add `status` as Select (draft/released/complete)
- [ ] Add `template_unit_id` as Autocomplete FK lookup (optional)
- [ ] Add `version_used` as TextField or display (when template selected)

---

## Tasks — Create/Edit Dialog

**File:** `apps/nap-client/src/pages/Projects/ProjectDetailPage.jsx` (inline)
**Branch:** `fix/dialog-task-fields`

### Fields Present

- `task_code` (TextField, maxLength 16) — Create + Edit
- `name` (TextField, required) — Create + Edit
- `duration_days` (TextField, type=number) — Create + Edit

### Missing Fields (PRD defines, dialog omits)

| Field              | Type        | Expected Control                              | Notes                                     |
| ------------------ | ----------- | --------------------------------------------- | ----------------------------------------- |
| `status`         | varchar(20) | Select (pending/in_progress/complete/on_hold) | PRD §3.4.3                               |
| `parent_task_id` | uuid        | Autocomplete FK lookup to tasks               | PRD §3.4.3 — self-referential hierarchy |

> Note: `unit_id` should be auto-populated from parent unit context.

### Fix Checklist

- [ ] Add `status` as Select (pending/in_progress/complete/on_hold)
- [ ] Add `parent_task_id` as Autocomplete FK lookup to tasks within same unit

---

## Cost Items — Create/Edit Dialog

**File:** `apps/nap-client/src/pages/Projects/ProjectDetailPage.jsx` (inline)
**Branch:** `fix/dialog-cost-item-fields`

### Fields Present

- `item_code` (TextField, maxLength 16) — Create + Edit
- `description` (TextField) — Create + Edit
- `cost_class` (TextField, required) — Create + Edit
- `quantity` (TextField, type=number, required) — Create + Edit
- `unit_cost` (TextField, type=number, required) — Create + Edit

### Missing Fields (PRD defines, dialog omits)

| Field           | Type        | Expected Control             | Notes       |
| --------------- | ----------- | ---------------------------- | ----------- |
| `cost_source` | varchar(16) | Select (budget/change_order) | PRD §3.4.4 |

> Note: `task_id` should be auto-populated from parent task context. `amount` is GENERATED (quantity × unit_cost) — display-only.

### Fix Checklist

- [ ] Add `cost_source` as Select (budget/change_order)
- [ ] Make `cost_class` a Select with options: labor, material, subcontract, equipment, other (currently free-text with helperText)

---

## Change Orders — Create/Edit Dialog

**File:** `apps/nap-client/src/pages/Projects/ChangeOrdersPage.jsx`
**Branch:** `fix/dialog-change-order-fields`

### Fields Present

- `unit_id` (TextField, Create only, helperText "UUID of the unit")
- `co_number` (TextField, required, maxLength 16) — Create + Edit
- `title` (TextField, required) — Create + Edit
- `reason` (TextField, multiline) — Create + Edit
- `total_amount` (TextField, type=number) — Create + Edit

### Missing Fields (PRD defines, dialog omits)

| Field      | Type        | Expected Control                           | Notes       |
| ---------- | ----------- | ------------------------------------------ | ----------- |
| `status` | varchar(20) | Select (draft/submitted/approved/rejected) | PRD §3.4.5 |

### Fix Checklist

- [ ] Add `status` as Select (draft/submitted/approved/rejected) in Create + Edit
- [ ] Replace `unit_id` raw UUID TextField with Autocomplete FK lookup to units

---

## Change Orders — View Dialog

**File:** `apps/nap-client/src/pages/Projects/ChangeOrdersPage.jsx`
**Branch:** `fix/dialog-change-order-fields`

### Fields Present

- `co_number` (FieldRow)
- `title` (FieldRow)
- `status` (FieldRow + StatusBadge)
- `total_amount` (FieldRow)
- `created_at` (FieldRow)
- `updated_at` (FieldRow)

### Missing Fields (PRD defines, dialog omits)

| Field       | Type | Expected Control                 | Notes                      |
| ----------- | ---- | -------------------------------- | -------------------------- |
| `unit_id` | uuid | FieldRow (resolved to unit name) | Show parent unit           |
| `reason`  | text | FieldRow                         | Change order justification |

### Fix Checklist

- [ ] Add `unit_id` as FieldRow (resolved to unit name)
- [ ] Add `reason` as FieldRow

---

## Categories — Create/Edit/View Dialog

**File:** `apps/nap-client/src/pages/Activities/CategoriesPage.jsx`
**Branch:** `fix/dialog-category-fields`

✅ No missing or extra fields detected. All PRD §3.5.1 fields present in all dialog variants.

---

## Activities — Create/Edit/View Dialog

**File:** `apps/nap-client/src/pages/Activities/ActivitiesPage.jsx`
**Branch:** `fix/dialog-activity-fields`

✅ No missing or extra fields detected. All PRD §3.5.1 fields present in all dialog variants.

---

## Deliverables — Create/Edit/View Dialog

**File:** `apps/nap-client/src/pages/Activities/DeliverablesPage.jsx`
**Branch:** `fix/dialog-deliverable-fields`

✅ No missing or extra fields detected. All PRD §3.5.2 fields present in all dialog variants.

---

## Deliverable Assignments — Dialog

🔴 **Dialog not found** — Deliverable Assignments has API hooks (`useDeliverableAssignments`) but no UI page or dialog. PRD §3.5.2 defines: `deliverable_id`, `project_id`, `employee_id`, `notes`.

---

## Budgets — Create/Edit Dialog

**File:** `apps/nap-client/src/pages/Activities/BudgetManagementPage.jsx`
**Branch:** `fix/dialog-budget-fields`

### Fields Present

**Create:**

- `deliverable_id` (TextField, select, required)
- `activity_id` (TextField, select, required)
- `budgeted_amount` (TextField, type=number, required)

**Edit:**

- `budgeted_amount` (TextField, type=number)
- `status` (TextField, select: draft/submitted/approved/locked/rejected)

### Missing Fields (PRD defines, dialog omits)

| Field          | Type    | Expected Control                   | Notes                         |
| -------------- | ------- | ---------------------------------- | ----------------------------- |
| `version`    | integer | TextField (type=number) or display | PRD §3.5.3 — version number |
| `is_current` | boolean | Checkbox or display                | PRD §3.5.3 — default true   |

### Fix Checklist

- [ ] Add `version` as TextField (type=number) or display in Create
- [ ] Add `is_current` as Checkbox in Create or display

---

## Budgets — View Dialog

**File:** `apps/nap-client/src/pages/Activities/BudgetManagementPage.jsx`
**Branch:** `fix/dialog-budget-fields`

### Fields Present

- `deliverable_id` (FieldRow, resolved via deliverableMap)
- `activity_id` (FieldRow, resolved via activityMap)
- `budgeted_amount` (FieldRow)
- `version` (FieldRow)
- `is_current` (FieldRow)
- `status` (FieldRow + StatusBadge)
- `approved_at` (FieldRow)
- `created_at` (FieldRow)
- `updated_at` (FieldRow)

### Missing Fields (PRD defines, dialog omits)

| Field            | Type        | Expected Control                 | Notes       |
| ---------------- | ----------- | -------------------------------- | ----------- |
| `submitted_by` | uuid        | FieldRow (resolved to user name) | PRD §3.5.3 |
| `submitted_at` | timestamptz | FieldRow                         | PRD §3.5.3 |
| `approved_by`  | uuid        | FieldRow (resolved to user name) | PRD §3.5.3 |

### Fix Checklist

- [ ] Add `submitted_by` as FieldRow (resolved to user name)
- [ ] Add `submitted_at` as FieldRow
- [ ] Add `approved_by` as FieldRow (resolved to user name)

---

## Cost Lines — Dialog

🔴 **Dialog not found** — Cost Lines has API hooks (`useCostLines`) but no dedicated UI page or dialog. PRD §3.5.4 defines: `company_id`, `deliverable_id`, `vendor_id`, `activity_id`, `budget_id`, `tenant_sku`, `source_type`, `quantity`, `unit_price`, `markup_pct`, `status`. `amount` is GENERATED.

---

## Actual Costs — Create/Edit Dialog

**File:** `apps/nap-client/src/pages/Activities/CostTrackingPage.jsx`
**Branch:** `fix/dialog-actual-cost-fields`

### Fields Present

**Create:**

- `activity_id` (TextField, select, required)
- `amount` (TextField, type=number, required)
- `currency` (TextField, maxLength 3)
- `incurred_on` (TextField, type=date)
- `reference` (TextField)

**Edit:**

- `amount` (TextField, type=number)
- `currency` (TextField, maxLength 3)
- `approval_status` (TextField, select: pending/approved/rejected)
- `incurred_on` (TextField, type=date)
- `reference` (TextField)

### Missing Fields (PRD defines, dialog omits)

| Field          | Type | Expected Control                   | Notes                                                  |
| -------------- | ---- | ---------------------------------- | ------------------------------------------------------ |
| `project_id` | uuid | Autocomplete FK lookup to projects | PRD §3.5.5 — links cost to project for profitability |

### Fix Checklist

- [ ] Add `project_id` as Autocomplete FK lookup to projects in Create + Edit

---

## Actual Costs — View Dialog

**File:** `apps/nap-client/src/pages/Activities/CostTrackingPage.jsx`
**Branch:** `fix/dialog-actual-cost-fields`

### Fields Present

- `activity_id` (FieldRow, resolved via activityMap)
- `amount` (FieldRow)
- `currency` (FieldRow)
- `approval_status` (FieldRow + StatusBadge)
- `incurred_on` (FieldRow)
- `reference` (FieldRow)
- `created_at` (FieldRow)
- `updated_at` (FieldRow)

### Missing Fields (PRD defines, dialog omits)

| Field          | Type | Expected Control                    | Notes               |
| -------------- | ---- | ----------------------------------- | ------------------- |
| `project_id` | uuid | FieldRow (resolved to project name) | Show linked project |

### Fix Checklist

- [ ] Add `project_id` as FieldRow (resolved to project name)

---

## Vendor Parts — Dialog

🔴 **Dialog not found** — Vendor Parts has API hooks (`useVendorParts`) but no dedicated UI page or dialog. PRD §3.5.6 defines: `vendor_id`, `vendor_sku`, `tenant_sku`, `unit_cost`, `currency`, `markup_pct`, `is_active`.

---

## Catalog SKUs — Create/Edit/View Dialog

**File:** `apps/nap-client/src/pages/BOM/CatalogPage.jsx`
**Branch:** `fix/dialog-catalog-sku-fields`

✅ No missing or extra fields detected. System fields (`description_normalized`, `model`, `embedding`) are expected absent.

---

## Vendor SKUs — Dialog

🔴 **Dialog not found** — VendorSkuMatchingPage is a matching UI (find/auto-match/batch-match), not a CRUD dialog. PRD §3.6.2 defines: `vendor_id`, `vendor_sku`, `description`, `catalog_sku_id`, `confidence`. No Create/Edit/View dialog exists.

---

## Vendor Pricing — Dialog

🔴 **Dialog not found** — No UI page or dialog found. PRD §3.6.3 defines: `vendor_sku_id`, `unit_price`, `unit`, `effective_date`.

---

## AP Invoices — Create/Edit Dialog

**File:** `apps/nap-client/src/pages/AP/ApInvoicesPage.jsx`
**Branch:** `fix/dialog-ap-invoice-fields`

### Fields Present

**Create:**

- `vendor_id` (TextField, select, required)
- `invoice_number` (TextField, required)
- `invoice_date` (TextField, type=date, required)
- `due_date` (TextField, type=date)
- `total_amount` (TextField, type=number, required)
- `status` (TextField, select: open/approved/paid/voided)
- `notes` (TextField, multiline)

**Edit:**

- `invoice_number` (TextField, required)
- `invoice_date` (TextField, type=date)
- `due_date` (TextField, type=date)
- `total_amount` (TextField, type=number)
- `status` (TextField, select)
- `notes` (TextField, multiline)

### Missing Fields (PRD defines, dialog omits)

| Field          | Type       | Expected Control                    | Notes                                                |
| -------------- | ---------- | ----------------------------------- | ---------------------------------------------------- |
| `company_id` | uuid       | Autocomplete FK lookup to companies | PRD §3.7.1 — FK to companies (RESTRICT)            |
| `project_id` | uuid       | Autocomplete FK lookup to projects  | PRD §3.7.1 — FK to projects, required for cashflow |
| `currency`   | varchar(3) | TextField (default USD)             | PRD §3.7.1                                          |

### Fix Checklist

- [ ] Add `company_id` as Autocomplete FK lookup to companies in Create
- [ ] Add `project_id` as Autocomplete FK lookup to projects in Create + Edit
- [ ] Add `currency` as TextField (default USD) in Create + Edit

---

## AP Invoices — View Dialog

**File:** `apps/nap-client/src/pages/AP/ApInvoicesPage.jsx`
**Branch:** `fix/dialog-ap-invoice-fields`

### Fields Present

- `invoice_number` (FieldRow)
- `vendor_id` (FieldRow, UUID slice)
- `invoice_date` (FieldRow)
- `due_date` (FieldRow)
- `total_amount` (FieldRow)
- `status` (FieldRow + StatusBadge)
- `created_at` (FieldRow)
- `updated_at` (FieldRow)

### Missing Fields (PRD defines, dialog omits)

| Field          | Type       | Expected Control                    | Notes               |
| -------------- | ---------- | ----------------------------------- | ------------------- |
| `company_id` | uuid       | FieldRow (resolved to company name) | Show owning company |
| `project_id` | uuid       | FieldRow (resolved to project name) | Show linked project |
| `currency`   | varchar(3) | FieldRow                            | Currency code       |
| `notes`      | text       | FieldRow                            | Internal notes      |

### Fix Checklist

- [ ] Add `company_id` as FieldRow (resolved name)
- [ ] Add `project_id` as FieldRow (resolved name)
- [ ] Add `currency` as FieldRow
- [ ] Add `notes` as FieldRow
- [ ] Resolve `vendor_id` to vendor name instead of UUID slice

---

## AP Invoice Lines — Dialog

🔴 **Dialog not found** — No dedicated UI for AP Invoice Lines. PRD §3.7.2 defines: `invoice_id`, `cost_line_id`, `activity_id`, `account_id`, `description`, `amount`. Should be inline within AP Invoices or a sub-dialog.

---

## Payments — Create/Edit Dialog

**File:** `apps/nap-client/src/pages/AP/PaymentsPage.jsx`
**Branch:** `fix/dialog-payment-fields`

### Fields Present

**Create:**

- `vendor_id` (TextField, select, required)
- `ap_invoice_id` (TextField, helperText "UUID (optional)")
- `payment_date` (TextField, type=date, required)
- `amount` (TextField, type=number, required)
- `method` (TextField, select: check/ach/wire)
- `reference` (TextField)
- `notes` (TextField, multiline)

**Edit:**

- `payment_date` (TextField, type=date)
- `amount` (TextField, type=number)
- `method` (TextField, select)
- `reference` (TextField)
- `notes` (TextField, multiline)

✅ All PRD §3.7.3 fields present.

### Fix Checklist

- [ ] Replace `ap_invoice_id` raw UUID TextField with Autocomplete FK lookup (filtered by selected vendor)

---

## Payments — View Dialog

**File:** `apps/nap-client/src/pages/AP/PaymentsPage.jsx`
**Branch:** `fix/dialog-payment-fields`

### Fields Present

- `payment_date` (FieldRow)
- `vendor_id` (FieldRow, UUID slice)
- `amount` (FieldRow)
- `method` (FieldRow)
- `reference` (FieldRow)
- `created_at` (FieldRow)
- `updated_at` (FieldRow)

### Missing Fields (PRD defines, dialog omits)

| Field             | Type | Expected Control                      | Notes               |
| ----------------- | ---- | ------------------------------------- | ------------------- |
| `ap_invoice_id` | uuid | FieldRow (resolved to invoice number) | Show linked invoice |
| `notes`         | text | FieldRow                              | Internal notes      |

### Fix Checklist

- [ ] Add `ap_invoice_id` as FieldRow (resolved to invoice number)
- [ ] Add `notes` as FieldRow
- [ ] Resolve `vendor_id` to vendor name instead of UUID slice

---

## AP Credit Memos — Create/Edit Dialog

**File:** `apps/nap-client/src/pages/AP/CreditMemosPage.jsx`
**Branch:** `fix/dialog-credit-memo-fields`

### Fields Present

**Create:**

- `vendor_id` (TextField, select, required)
- `ap_invoice_id` (TextField, helperText "UUID (optional)")
- `credit_number` (TextField, required)
- `credit_date` (TextField, type=date, required)
- `amount` (TextField, type=number, required)
- `status` (TextField, select: open/applied/voided)
- `reason` (TextField, multiline)

**Edit:**

- `credit_number` (TextField)
- `credit_date` (TextField, type=date)
- `amount` (TextField, type=number)
- `status` (TextField, select)
- `reason` (TextField, multiline)

✅ All PRD §3.7.4 fields present.

### Fix Checklist

- [ ] Replace `ap_invoice_id` raw UUID TextField with Autocomplete FK lookup (filtered by selected vendor)

---

## AP Credit Memos — View Dialog

**File:** `apps/nap-client/src/pages/AP/CreditMemosPage.jsx`
**Branch:** `fix/dialog-credit-memo-fields`

### Fields Present

- `credit_number` (FieldRow)
- `vendor_id` (FieldRow, UUID slice)
- `credit_date` (FieldRow)
- `amount` (FieldRow)
- `status` (FieldRow + StatusBadge)
- `reason` (FieldRow)
- `created_at` (FieldRow)
- `updated_at` (FieldRow)

### Missing Fields (PRD defines, dialog omits)

| Field             | Type | Expected Control                      | Notes               |
| ----------------- | ---- | ------------------------------------- | ------------------- |
| `ap_invoice_id` | uuid | FieldRow (resolved to invoice number) | Show linked invoice |

### Fix Checklist

- [ ] Add `ap_invoice_id` as FieldRow (resolved to invoice number)
- [ ] Resolve `vendor_id` to vendor name instead of UUID slice

---

## AR Invoices — Create/Edit Dialog

**File:** `apps/nap-client/src/pages/AR/ArInvoicesPage.jsx`
**Branch:** `fix/dialog-ar-invoice-fields`

### Fields Present

**Create:**

- `client_id` (TextField, select, required)
- `invoice_number` (TextField, required)
- `invoice_date` (TextField, type=date, required)
- `due_date` (TextField, type=date)
- `total_amount` (TextField, type=number, required)
- `status` (TextField, select: open/sent/paid/voided)
- `notes` (TextField, multiline)

**Edit:**

- `invoice_number` (TextField)
- `invoice_date` (TextField, type=date)
- `due_date` (TextField, type=date)
- `total_amount` (TextField, type=number)
- `status` (TextField, select)
- `notes` (TextField, multiline)

### Missing Fields (PRD defines, dialog omits)

| Field              | Type       | Expected Control                       | Notes                                                        |
| ------------------ | ---------- | -------------------------------------- | ------------------------------------------------------------ |
| `company_id`     | uuid       | Autocomplete FK lookup to companies    | PRD §3.8.1 — FK to companies (RESTRICT)                    |
| `project_id`     | uuid       | Autocomplete FK lookup to projects     | PRD §3.8.1 — FK to projects, required for revenue tracking |
| `deliverable_id` | uuid       | Autocomplete FK lookup to deliverables | PRD §3.8.1 — FK to deliverables (SET NULL)                 |
| `currency`       | varchar(3) | TextField (default USD)                | PRD §3.8.1                                                  |

### Fix Checklist

- [ ] Add `company_id` as Autocomplete FK lookup to companies in Create
- [ ] Add `project_id` as Autocomplete FK lookup to projects in Create + Edit
- [ ] Add `deliverable_id` as Autocomplete FK lookup to deliverables in Create + Edit
- [ ] Add `currency` as TextField (default USD) in Create + Edit

---

## AR Invoices — View Dialog

**File:** `apps/nap-client/src/pages/AR/ArInvoicesPage.jsx`
**Branch:** `fix/dialog-ar-invoice-fields`

### Fields Present

- `invoice_number` (FieldRow)
- `client_id` (FieldRow, UUID slice)
- `invoice_date` (FieldRow)
- `due_date` (FieldRow)
- `total_amount` (FieldRow)
- `status` (FieldRow + StatusBadge)
- `created_at` (FieldRow)
- `updated_at` (FieldRow)

### Missing Fields (PRD defines, dialog omits)

| Field              | Type       | Expected Control                        | Notes                   |
| ------------------ | ---------- | --------------------------------------- | ----------------------- |
| `company_id`     | uuid       | FieldRow (resolved to company name)     | Show owning company     |
| `project_id`     | uuid       | FieldRow (resolved to project name)     | Show linked project     |
| `deliverable_id` | uuid       | FieldRow (resolved to deliverable name) | Show linked deliverable |
| `currency`       | varchar(3) | FieldRow                                | Currency code           |
| `notes`          | text       | FieldRow                                | Internal notes          |

### Fix Checklist

- [ ] Add `company_id` as FieldRow (resolved name)
- [ ] Add `project_id` as FieldRow (resolved name)
- [ ] Add `deliverable_id` as FieldRow (resolved name)
- [ ] Add `currency` as FieldRow
- [ ] Add `notes` as FieldRow
- [ ] Resolve `client_id` to client name instead of UUID slice

---

## AR Invoice Lines — Dialog

🔴 **Dialog not found** — No dedicated UI for AR Invoice Lines. PRD §3.8.2 defines: `invoice_id`, `account_id`, `description`, `amount`. Should be inline within AR Invoices or a sub-dialog.

---

## Receipts — Create/Edit Dialog

**File:** `apps/nap-client/src/pages/AR/ReceiptsPage.jsx`
**Branch:** `fix/dialog-receipt-fields`

### Fields Present

**Create:**

- `client_id` (TextField, select, required)
- `ar_invoice_id` (TextField, helperText "UUID of the AR invoice")
- `receipt_date` (TextField, type=date, required)
- `amount` (TextField, type=number, required)
- `method` (TextField, select: check/ach/wire)
- `reference` (TextField)
- `notes` (TextField, multiline)

**Edit:**

- `receipt_date` (TextField, type=date)
- `amount` (TextField, type=number)
- `method` (TextField, select)
- `reference` (TextField)
- `notes` (TextField, multiline)

✅ All PRD §3.8.3 fields present.

### Fix Checklist

- [ ] Replace `ar_invoice_id` raw UUID TextField with Autocomplete FK lookup (filtered by selected client)

---

## Receipts — View Dialog

**File:** `apps/nap-client/src/pages/AR/ReceiptsPage.jsx`
**Branch:** `fix/dialog-receipt-fields`

### Fields Present

- `receipt_date` (FieldRow)
- `client_id` (FieldRow, UUID slice)
- `amount` (FieldRow)
- `method` (FieldRow)
- `reference` (FieldRow)
- `created_at` (FieldRow)
- `updated_at` (FieldRow)

### Missing Fields (PRD defines, dialog omits)

| Field             | Type | Expected Control                      | Notes               |
| ----------------- | ---- | ------------------------------------- | ------------------- |
| `ar_invoice_id` | uuid | FieldRow (resolved to invoice number) | Show linked invoice |
| `notes`         | text | FieldRow                              | Internal notes      |

### Fix Checklist

- [ ] Add `ar_invoice_id` as FieldRow (resolved to invoice number)
- [ ] Add `notes` as FieldRow
- [ ] Resolve `client_id` to client name instead of UUID slice

---

## Chart of Accounts — Create/Edit Dialog

**File:** `apps/nap-client/src/pages/Accounting/ChartOfAccountsPage.jsx`
**Branch:** `fix/dialog-chart-of-accounts-fields`

### Fields Present

**Create:**

- `code` (TextField, required, maxLength 16)
- `name` (TextField, required)
- `type` (TextField, select: asset/liability/equity/income/expense/cash/bank)

**Edit:**

- `code` (TextField, disabled)
- `name` (TextField, required)
- `type` (TextField, select)

### Missing Fields (PRD defines, dialog omits)

| Field                   | Type        | Expected Control                        | Notes                        |
| ----------------------- | ----------- | --------------------------------------- | ---------------------------- |
| `is_active`           | boolean     | Checkbox or Select                      | PRD §3.9.1 — default true  |
| `cash_basis`          | boolean     | Checkbox                                | PRD §3.9.1 — default false |
| `bank_account_number` | varchar(32) | TextField (conditional: type=cash/bank) | PRD §3.9.1                  |
| `routing_number`      | varchar(16) | TextField (conditional: type=cash/bank) | PRD §3.9.1                  |
| `bank_name`           | varchar(64) | TextField (conditional: type=cash/bank) | PRD §3.9.1                  |

### Fix Checklist

- [ ] Add `is_active` as Checkbox or Select
- [ ] Add `cash_basis` as Checkbox
- [ ] Add `bank_account_number` as TextField (shown only when type is cash or bank)
- [ ] Add `routing_number` as TextField (shown only when type is cash or bank)
- [ ] Add `bank_name` as TextField (shown only when type is cash or bank)

---

## Chart of Accounts — View Dialog

**File:** `apps/nap-client/src/pages/Accounting/ChartOfAccountsPage.jsx`
**Branch:** `fix/dialog-chart-of-accounts-fields`

### Fields Present

- `code` (FieldRow)
- `name` (FieldRow)
- `type` (FieldRow)
- `cash_basis` (FieldRow)
- `status` (FieldRow + StatusBadge)
- `created_at` (FieldRow)
- `updated_at` (FieldRow)

### Missing Fields (PRD defines, dialog omits)

| Field                   | Type        | Expected Control                       | Notes                                   |
| ----------------------- | ----------- | -------------------------------------- | --------------------------------------- |
| `is_active`           | boolean     | FieldRow                               | Verify if StatusBadge already maps this |
| `bank_account_number` | varchar(32) | FieldRow (conditional: type=cash/bank) |                                         |
| `routing_number`      | varchar(16) | FieldRow (conditional: type=cash/bank) |                                         |
| `bank_name`           | varchar(64) | FieldRow (conditional: type=cash/bank) |                                         |

### Fix Checklist

- [ ] Add `bank_account_number` as FieldRow (conditional)
- [ ] Add `routing_number` as FieldRow (conditional)
- [ ] Add `bank_name` as FieldRow (conditional)

---

## Journal Entries — Create/Edit Dialog

**File:** `apps/nap-client/src/pages/Accounting/JournalEntriesPage.jsx`
**Branch:** `fix/dialog-journal-entry-fields`

### Fields Present

- `entry_date` (TextField, type=date, required) — Create + Edit
- `description` (TextField, multiline) — Create + Edit
- `status` (TextField, select: pending/posted/reversed) — Create + Edit
- `source_type` (TextField) — Create + Edit

### Missing Fields (PRD defines, dialog omits)

| Field          | Type | Expected Control                    | Notes                                                   |
| -------------- | ---- | ----------------------------------- | ------------------------------------------------------- |
| `company_id` | uuid | Autocomplete FK lookup to companies | PRD §3.9.2 — FK to companies (RESTRICT)               |
| `project_id` | uuid | Autocomplete FK lookup to projects  | PRD §3.9.2 — FK to projects, enables project-level GL |
| `source_id`  | uuid | TextField or Autocomplete           | PRD §3.9.2 — reference to source record               |

> Note: `corrects_id` is system-managed for reversals — expected absent from Create/Edit.

### Fix Checklist

- [ ] Add `company_id` as Autocomplete FK lookup to companies
- [ ] Add `project_id` as Autocomplete FK lookup to projects
- [ ] Add `source_id` as TextField or Autocomplete (optional reference)

---

## Journal Entries — View Dialog

**File:** `apps/nap-client/src/pages/Accounting/JournalEntriesPage.jsx`
**Branch:** `fix/dialog-journal-entry-fields`

### Fields Present

- `id` (FieldRow)
- `entry_date` (FieldRow)
- `description` (FieldRow)
- `status` (FieldRow + StatusBadge)
- `source_type` (FieldRow)
- `created_at` (FieldRow)
- `updated_at` (FieldRow)

### Missing Fields (PRD defines, dialog omits)

| Field           | Type | Expected Control                       | Notes                      |
| --------------- | ---- | -------------------------------------- | -------------------------- |
| `company_id`  | uuid | FieldRow (resolved to company name)    |                            |
| `project_id`  | uuid | FieldRow (resolved to project name)    |                            |
| `source_id`   | uuid | FieldRow                               | Reference to source record |
| `corrects_id` | uuid | FieldRow (resolved to entry reference) | Show reversal chain        |

### Fix Checklist

- [ ] Add `company_id` as FieldRow (resolved name)
- [ ] Add `project_id` as FieldRow (resolved name)
- [ ] Add `source_id` as FieldRow
- [ ] Add `corrects_id` as FieldRow (display-only for reversals)

---

## Journal Entry Lines — Dialog

🔴 **Dialog not found** — No dedicated UI for Journal Entry Lines. PRD §3.9.3 defines: `entry_id`, `account_id`, `debit`, `credit`, `memo`, `related_table`, `related_id`. Should be inline within Journal Entries or a sub-dialog.

---

## Task Groups — Dialog

🔴 **Dialog not found** — Task Groups has API hooks (`useTaskGroups`) but no dedicated UI page or dialog. PRD §3.4.3 defines: `code`, `name`, `description`, `sort_order`.

---

## Tasks Master — Dialog

🔴 **Dialog not found** — Tasks Master has API hooks (`useTasksMaster`) but no dedicated UI page or dialog. PRD §3.4.3 defines: `code`, `task_group_code`, `name`, `default_duration_days`.

---

## Numbering Config — Settings Page

**File:** `apps/nap-client/src/pages/Settings/NumberingConfigPage.jsx`

### Fields Present (per entity type card)

- `is_enabled` (Switch toggle)
- `prefix` (TextField)
- `suffix` (TextField)
- `separator` (TextField)
- `padding` (TextField, type=number)
- `date_mode` (TextField, select: none/year/year_month/ymd)
- `reset_mode` (TextField, select: never/yearly/monthly/daily)
- `scope_type` (TextField, select: none/legal_entity/company/project)
- `uppercase` (Switch toggle)
- Live preview display

✅ No missing or extra fields detected. All PRD §3.13.2 fields present.

---

## Summary

| Entity                 | Dialog Type     | Missing Fields               | Extra Fields | Status                                |
| ---------------------- | --------------- | ---------------------------- | ------------ | ------------------------------------- |
| Vendor                 | Create/Edit     | 4                            | 2            | ⚠️ Needs Fix                        |
| Vendor                 | View            | 3                            | 0            | ⚠️ Needs Fix                        |
| Client                 | Create/Edit     | 5                            | 0            | ⚠️ Needs Fix                        |
| Client                 | View            | 5                            | 0            | ⚠️ Needs Fix                        |
| Employee               | Create          | 0                            | 0            | ✅ OK                                 |
| Employee               | Edit            | 2                            | 2            | ⚠️ Minor                            |
| Employee               | View            | 0                            | 0            | ✅ OK                                 |
| Contact                | Create/Edit     | 6                            | 3            | ⚠️ Needs Fix                        |
| Contact                | View            | 5                            | 0            | ⚠️ Needs Fix                        |
| Company                | Create/Edit     | 3 (1 field + 2 sub-sections) | 0            | ⚠️ Needs Fix                        |
| Company                | View            | 3 (1 field + 2 collections)  | 0            | ⚠️ Needs Fix                        |
| Tenant                 | Create (Wizard) | 1                            | 0            | ⚠️ Needs Fix                        |
| Tenant                 | Edit            | 1                            | 0            | ⚠️ Needs Fix                        |
| Tenant                 | View            | 1                            | 0            | ⚠️ Needs Fix                        |
| nap_users              | Edit            | 3                            | 1            | ⚠️ Needs Fix                        |
| nap_users              | View            | 2                            | 0            | ⚠️ Needs Fix                        |
| Project                | Create/Edit     | 3                            | 0            | ⚠️ Needs Fix                        |
| Project                | View            | 4                            | 0            | ⚠️ Needs Fix                        |
| Project Clients        | —              | —                           | —           | 🔴 Not Implemented                    |
| Unit                   | Create/Edit     | 3                            | 0            | ⚠️ Needs Fix                        |
| Task                   | Create/Edit     | 2                            | 0            | ⚠️ Needs Fix                        |
| Cost Item              | Create/Edit     | 1                            | 0            | ⚠️ Needs Fix                        |
| Change Order           | Create/Edit     | 1                            | 0            | ⚠️ Needs Fix                        |
| Change Order           | View            | 2                            | 0            | ⚠️ Needs Fix                        |
| Category               | All             | 0                            | 0            | ✅ OK                                 |
| Activity               | All             | 0                            | 0            | ✅ OK                                 |
| Deliverable            | All             | 0                            | 0            | ✅ OK                                 |
| Deliverable Assignment | —              | —                           | —           | 🔴 Not Implemented                    |
| Budget                 | Create/Edit     | 2                            | 0            | ⚠️ Needs Fix                        |
| Budget                 | View            | 3                            | 0            | ⚠️ Needs Fix                        |
| Cost Line              | —              | —                           | —           | 🔴 Not Implemented                    |
| Actual Cost            | Create/Edit     | 1                            | 0            | ⚠️ Needs Fix                        |
| Actual Cost            | View            | 1                            | 0            | ⚠️ Needs Fix                        |
| Vendor Part            | —              | —                           | —           | 🔴 Not Implemented                    |
| Catalog SKU            | All             | 0                            | 0            | ✅ OK                                 |
| Vendor SKU             | —              | —                           | —           | 🔴 Not Implemented (matching UI only) |
| Vendor Pricing         | —              | —                           | —           | 🔴 Not Implemented                    |
| AP Invoice             | Create/Edit     | 3                            | 0            | ⚠️ Needs Fix                        |
| AP Invoice             | View            | 4                            | 0            | ⚠️ Needs Fix                        |
| AP Invoice Line        | —              | —                           | —           | 🔴 Not Implemented                    |
| Payment                | Create/Edit     | 0                            | 0            | ✅ OK                                 |
| Payment                | View            | 2                            | 0            | ⚠️ Needs Fix                        |
| AP Credit Memo         | Create/Edit     | 0                            | 0            | ✅ OK                                 |
| AP Credit Memo         | View            | 1                            | 0            | ⚠️ Needs Fix                        |
| AR Invoice             | Create/Edit     | 4                            | 0            | ⚠️ Needs Fix                        |
| AR Invoice             | View            | 5                            | 0            | ⚠️ Needs Fix                        |
| AR Invoice Line        | —              | —                           | —           | 🔴 Not Implemented                    |
| Receipt                | Create/Edit     | 0                            | 0            | ✅ OK                                 |
| Receipt                | View            | 2                            | 0            | ⚠️ Needs Fix                        |
| Chart of Accounts      | Create/Edit     | 5                            | 0            | ⚠️ Needs Fix                        |
| Chart of Accounts      | View            | 3                            | 0            | ⚠️ Needs Fix                        |
| Journal Entry          | Create/Edit     | 3                            | 0            | ⚠️ Needs Fix                        |
| Journal Entry          | View            | 4                            | 0            | ⚠️ Needs Fix                        |
| Journal Entry Line     | —              | —                           | —           | 🔴 Not Implemented                    |
| Task Group             | —              | —                           | —           | 🔴 Not Implemented                    |
| Tasks Master           | —              | —                           | —           | 🔴 Not Implemented                    |
| Numbering Config       | Settings        | 0                            | 0            | ✅ OK                                 |

---

## Branch Plan

| Branch                                  | Dialogs Covered                                          | Est. Changes |
| --------------------------------------- | -------------------------------------------------------- | ------------ |
| `fix/dialog-vendor-fields`            | Vendor Create/Edit/View                                  | 7            |
| `fix/dialog-client-fields`            | Client Create/Edit/View                                  | 10           |
| `fix/dialog-employee-fields`          | Employee Edit/View (minor)                               | 2            |
| `fix/dialog-contact-fields`           | Contact Create/Edit/View                                 | 14           |
| `fix/dialog-company-fields`           | Company Create/Edit/View + address & tax-id sub-sections | 7            |
| `fix/dialog-tenant-fields`            | Tenant Create (Wizard), Edit, View                       | 3            |
| `fix/dialog-user-fields`              | nap_users Edit/View                                      | 5            |
| `fix/dialog-project-fields`           | Project Create/Edit/View                                 | 7            |
| `fix/dialog-unit-fields`              | Unit Create/Edit (inline in ProjectDetailPage)           | 3            |
| `fix/dialog-task-fields`              | Task Create/Edit (inline in ProjectDetailPage)           | 2            |
| `fix/dialog-cost-item-fields`         | Cost Item Create/Edit (inline in ProjectDetailPage)      | 2            |
| `fix/dialog-change-order-fields`      | Change Order Create/Edit/View                            | 4            |
| `fix/dialog-budget-fields`            | Budget Create/View                                       | 5            |
| `fix/dialog-actual-cost-fields`       | Actual Cost Create/Edit/View                             | 2            |
| `fix/dialog-ap-invoice-fields`        | AP Invoice Create/Edit/View                              | 7            |
| `fix/dialog-payment-fields`           | Payment Create/View                                      | 3            |
| `fix/dialog-credit-memo-fields`       | AP Credit Memo Create/View                               | 2            |
| `fix/dialog-ar-invoice-fields`        | AR Invoice Create/Edit/View                              | 9            |
| `fix/dialog-receipt-fields`           | Receipt Create/View                                      | 3            |
| `fix/dialog-chart-of-accounts-fields` | Chart of Accounts Create/Edit/View                       | 8            |
| `fix/dialog-journal-entry-fields`     | Journal Entry Create/Edit/View                           | 7            |

**Total: 21 branches, ~102 field changes**

---

## Shared Component Dependencies

The following components and hooks are used by multiple dialog branches. Branches that share a component must be merged in dependency order to avoid conflicts.

### Shared Components

| Component                                          | File                                                       | Used By Branches                                                                                                                                         |
| -------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FormDialog`                                     | `src/components/shared/FormDialog.jsx`                   | All 21 branches (wrapper only — no field changes needed)                                                                                                |
| `FieldRow`                                       | `src/components/shared/FieldRow.jsx`                     | All branches with View dialogs (display only — no changes needed)                                                                                       |
| `StatusBadge`                                    | `src/components/shared/StatusBadge.jsx`                  | All branches with View dialogs (display only — no changes needed)                                                                                       |
| `PatternTextField`                               | `src/components/shared/PatternTextField.jsx`             | `fix/dialog-vendor-fields`, `fix/dialog-client-fields`, `fix/dialog-employee-fields`, `fix/dialog-contact-fields`                                |
| `StepperFormDialog`                              | `src/components/shared/StepperFormDialog.jsx`            | `fix/dialog-tenant-fields` (wrapper only — no changes needed)                                                                                         |
| `PasswordField`                                  | `src/components/shared/PasswordField.jsx`                | `fix/dialog-tenant-fields`, `fix/dialog-user-fields` (no changes needed)                                                                             |
| Inline phone/email/address/tax-id editing patterns | Duplicated code in each Core page (NOT a shared component) | `fix/dialog-vendor-fields`, `fix/dialog-client-fields`, `fix/dialog-employee-fields`, `fix/dialog-contact-fields`, `fix/dialog-company-fields` |
| `layoutTokens.js`                                | `src/config/layoutTokens.js`                             | All branches (read-only import — no changes needed)                                                                                                     |
| `useRoles` hook                                  | `src/hooks/useRoles.js`                                  | `fix/dialog-vendor-fields`, `fix/dialog-client-fields`, `fix/dialog-contact-fields` (new import — no hook changes needed)                         |

### Merge Order Recommendations

**Group A — Independent (no shared component conflicts, merge in any order):**

- `fix/dialog-tenant-fields`
- `fix/dialog-user-fields`
- `fix/dialog-project-fields`
- `fix/dialog-unit-fields`
- `fix/dialog-task-fields`
- `fix/dialog-cost-item-fields`
- `fix/dialog-change-order-fields`
- `fix/dialog-budget-fields`
- `fix/dialog-actual-cost-fields`
- `fix/dialog-ap-invoice-fields`
- `fix/dialog-payment-fields`
- `fix/dialog-credit-memo-fields`
- `fix/dialog-ar-invoice-fields`
- `fix/dialog-receipt-fields`
- `fix/dialog-chart-of-accounts-fields`
- `fix/dialog-journal-entry-fields`

**Group B — Core entity pages with duplicated inline source patterns (merge sequentially if shared extraction is done):**

1. `fix/dialog-vendor-fields` — merge first (largest Core entity, establishes pattern for `roles`/`is_app_user`/`is_active`)
2. `fix/dialog-client-fields` — rebase onto dev after step 1
3. `fix/dialog-contact-fields` — rebase onto dev after step 2
4. `fix/dialog-employee-fields` — rebase onto dev after step 3 (minor changes only)
5. `fix/dialog-company-fields` — rebase onto dev after step 4 (new: adds phone/address/tax-id sub-sections)

> Note: Group B branches are independent at the file level (each modifies a different page file), so they CAN be merged in parallel if no shared component extraction is performed. The sequential recommendation is only necessary if the fix strategy involves extracting shared inline patterns (phone/email/address/tax-id editing) into a reusable component.

### ⚠️ Shared Component Requires Change: Inline Phone/Email/Address/Tax-ID Patterns

**File:** Duplicated inline code in `VendorsPage.jsx`, `ClientsPage.jsx`, `EmployeesPage.jsx`, `ContactsPage.jsx` (+ new code needed in `CompaniesPage.jsx`)
**Required change:** Currently, each Core page (except Companies) duplicates ~200 lines of inline editing logic for phone numbers, emails, addresses, and tax identifiers. Adding `address_line_3` to the address section requires changing this duplicated code in 4 files independently. CompaniesPage has no source sub-sections at all and needs them added from scratch.
**Affects dialogs:** Vendor, Client, Employee, Contact, Company Edit dialogs
**Recommended action:**

1. *Optional but recommended*: Extract the inline phone/email/address/tax-id sections into shared components (e.g., `<PhoneNumberSection>`, `<AddressSection>`, `<TaxIdSection>`, `<EmailsSection>`) in a prerequisite branch: `fix/shared-entity-form-sections`
2. Cut all 5 Core entity dialog branches from `fix/shared-entity-form-sections`
3. Open `fix/shared-entity-form-sections` as a PR first — it simplifies all 5 dialog PRs (especially CompaniesPage which currently has NO source sub-sections)
4. If NOT extracting shared components, each branch independently adds `address_line_3` to its own inline code and CompaniesPage duplicates ~200 lines of inline editing logic from other Core pages — safe to merge in parallel but significantly increases code duplication

**⛔ Do NOT embed this shared component change inside any dialog branch.** Shared component changes buried in dialog PRs create silent regressions in sibling branches that use the same component.

✅ All other missing fields can be added at the dialog level — no other shared component changes required.

---

## Payment Terms — Create/Edit Dialog

**File:** `apps/nap-client/src/pages/Settings/PaymentTermsPage.jsx`
**Branch:** `fix/dialog-fields`

### Fields Present

- `label` (TextField, required) — Create + Edit
- `term` (TextField, type=number, required) — Create + Edit
- `units` (Select: days/months) — Create + Edit
- `is_active` (Select: Yes/No) — Edit only

✅ All schema fields present in dialog.

---

## Payment Terms — View Dialog

**File:** `apps/nap-client/src/pages/Settings/PaymentTermsPage.jsx`
**Branch:** `fix/dialog-fields`

### Fields Present

- `label` (FieldRow)
- `term` (FieldRow)
- `units` (FieldRow)
- `is_active` (FieldRow)
- `created_at` (FieldRow)
- `updated_at` (FieldRow)

✅ All fields present.
