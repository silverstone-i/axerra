# AXERRA - Product Requirements Document

## Scope-tag Legend

Every H2 (`##`) and H3 (`###`) heading in this document carries one of three scope tags:

- **[in-scope]** — part of the current build plan. Spec body describes what is intended; implementation may be partial. Status tags on individual paragraphs distinguish `[implemented]` from `[intended]` work.
- **[deferred]** — known requirement, not in the current build window. The section exists so the requirement is captured; a spec body is written when the section graduates to in-scope.
- **[out-of-scope]** — explicitly not part of AXERRA. Listed so contributors don't propose it.

Status tags applied at the paragraph or bullet level (`[intended]`, `[implemented]`, `[superseded]`) supplement the section scope tag where needed.

## Table of Contents

- [Scope-tag Legend](#scope-tag-legend)

- [Glossary](#glossary)

- [1. Overview](#1-overview--in-scope)
  - [1.1 Product Overview](#11-product-overview--in-scope)
  - [1.2 Target Users](#12-target-users--in-scope)
  - [1.3 Technology Stack](#13-technology-stack--in-scope)
  - [1.4 Monorepo Structure](#14-monorepo-structure--in-scope)

- [2. Architecture](#2-architecture--in-scope)
  - [2.1 Multi-Tenant Model](#21-multi-tenant-model--in-scope)
  - [2.2 pg-schemata Integration](#22-pg-schemata-integration--in-scope)
    - [2.2.1 Core Capabilities](#221-core-capabilities)
    - [2.2.2 Query Operators](#222-query-operators)
    - [2.2.3 Model Definition Pattern](#223-model-definition-pattern)
    - [2.2.4 Database Initialization](#224-database-initialization)
    - [2.2.5 Planned Enhancements](#225-planned-enhancements)
  - [2.3 Application Layout](#23-application-layout--in-scope)
  - [2.4 Request Flow](#24-request-flow--in-scope)

- [3. Module Reference](#3-module-reference--in-scope)
  - [3.0 Module Taxonomy](#30-module-taxonomy--in-scope)
    - [3.0.1 Core Modules](#301-core-modules)
    - [3.0.2 Add-on Modules (loading rules)](#302-add-on-modules-loading-rules)
  - [3.1 System — Auth, Tenant & RBAC](#31-system--auth-tenant--rbac--core)
    - [3.1.1 Overview](#311-overview)
    - [3.1.2 Data Tables](#312-data-tables)
      - [3.1.2.1 Admin Schema Identity Tables](#3121-admin-schema-identity-tables)
        - [3.1.2.1.1 `admin.portal_users`](#31211-adminportal_users)
        - [3.1.2.1.2 `admin.portal_user_tenants`](#31212-adminportal_user_tenants)
        - [3.1.2.1.3 `admin.tenants`](#31213-admintenants)
        - [3.1.2.1.4 `admin.impersonation_logs`](#31214-adminimpersonation_logs)
      - [3.1.2.2 RBAC Policy Tables](#3122-rbac-policy-tables)
        - [3.1.2.2.1 `roles`](#31221-roles)
        - [3.1.2.2.2 `policies`](#31222-policies)
        - [3.1.2.2.3 `policy_catalog`](#31223-policy_catalog)
      - [3.1.2.3 RBAC State and Field-Group Tables](#3123-rbac-state-and-field-group-tables)
        - [3.1.2.3.1 `state_filters`](#31231-state_filters)
        - [3.1.2.3.2 `field_group_definitions`](#31232-field_group_definitions)
        - [3.1.2.3.3 `field_group_grants`](#31233-field_group_grants)
      - [3.1.2.4 RBAC Membership Tables](#3124-rbac-membership-tables)
        - [3.1.2.4.1 `project_members`](#31241-project_members)
        - [3.1.2.4.2 `company_members`](#31242-company_members)
    - [3.1.3 API](#313-api)
      - [3.1.3.1 Authentication Endpoints](#3131-authentication-endpoints)
      - [3.1.3.2 Tenant Management Endpoints](#3132-tenant-management-endpoints)
      - [3.1.3.3 RBAC / Policy Endpoints](#3133-rbac--policy-endpoints)
    - [3.1.4 Business Rules](#314-business-rules)
      - [3.1.4.1 Login Flow & Token Lifecycle](#3141-login-flow--token-lifecycle)
      - [3.1.4.2 Mid-Session Policy Refresh](#3142-mid-session-policy-refresh)
      - [3.1.4.3 Four-Layer RBAC Resolution](#3143-four-layer-rbac-resolution)
      - [3.1.4.4 System Roles (incl. vendor_contacts, clients)](#3144-system-roles-incl-vendor_contacts-clients)
      - [3.1.4.5 Tenant Numbering System](#3145-tenant-numbering-system)
        - [3.1.4.5.1 Design principles](#31451-design-principles)
        - [3.1.4.5.2 Data: `tenant_numbering_config`](#31452-data-tenant_numbering_config)
        - [3.1.4.5.3 Data: `tenant_number_sequence_state`](#31453-data-tenant_number_sequence_state)
        - [3.1.4.5.4 Allocation and display](#31454-allocation-and-display)
        - [3.1.4.5.5 Recommended defaults](#31455-recommended-defaults)
        - [3.1.4.5.6 Entity integration and backfill](#31456-entity-integration-and-backfill)
      - [3.1.4.6 Impersonation](#3146-impersonation)
  - [3.2 Core Entities](#32-core-entities--core)
    - [3.2.1 Overview](#321-overview)
    - [3.2.2 Data Tables](#322-data-tables)
      - [3.2.2.1 Vendors & Vendor Contacts](#3221-vendors--vendor-contacts)
        - [3.2.2.1.1 `vendors`](#32211-vendors)
        - [3.2.2.1.2 `vendor_contacts`](#32212-vendor_contacts)
      - [3.2.2.2 Payment Terms](#3222-payment-terms)
        - [3.2.2.2.1 `payment_terms`](#32221-payment_terms)
      - [3.2.2.3 Clients](#3223-clients)
        - [3.2.2.3.1 `clients`](#32231-clients)
      - [3.2.2.4 Employees](#3224-employees)
        - [3.2.2.4.1 `employees`](#32241-employees)
      - [3.2.2.5 Sources, Contacts, Addresses & Phones](#3225-sources-contacts-addresses--phones)
        - [3.2.2.5.1 `sources`](#32251-sources)
        - [3.2.2.5.2 `contacts`](#32252-contacts)
        - [3.2.2.5.3 `addresses`](#32253-addresses)
        - [3.2.2.5.4 `phone_numbers`](#32254-phone_numbers)
        - [3.2.2.5.5 `tax_identifiers`](#32255-tax_identifiers)
      - [3.2.2.6 Companies](#3226-companies)
        - [3.2.2.6.1 `companies`](#32261-companies)
    - [3.2.3 API](#323-api)
    - [3.2.4 Business Rules](#324-business-rules)
  - [3.3 Projects](#33-projects--core)
    - [3.3.1 Overview](#331-overview)
    - [3.3.2 Data Tables](#332-data-tables)
      - [3.3.2.1 Projects](#3321-projects)
        - [3.3.2.1.1 `projects`](#33211-projects)
        - [3.3.2.1.2 `project_clients`](#33212-project_clients)
      - [3.3.2.2 Units](#3322-units)
        - [3.3.2.2.1 `units`](#33221-units)
      - [3.3.2.3 Tasks & Task Groups](#3323-tasks--task-groups)
        - [3.3.2.3.1 `task_groups`](#33231-task_groups)
        - [3.3.2.3.2 `tasks_master`](#33232-tasks_master)
        - [3.3.2.3.3 `tasks`](#33233-tasks)
      - [3.3.2.4 Cost Items](#3324-cost-items)
        - [3.3.2.4.1 `cost_items`](#33241-cost_items)
      - [3.3.2.5 Change Orders](#3325-change-orders)
        - [3.3.2.5.1 `change_orders`](#33251-change_orders)
      - [3.3.2.6 Templates](#3326-templates)
    - [3.3.3 API](#333-api)
    - [3.3.4 Business Rules](#334-business-rules)
  - [3.4 Activities & Cost Management](#34-activities--cost-management--core)
    - [3.4.1 Overview](#341-overview)
    - [3.4.2 Data Tables](#342-data-tables)
      - [3.4.2.1 Categories & Activities](#3421-categories--activities)
        - [3.4.2.1.1 `categories`](#34211-categories)
        - [3.4.2.1.2 `activities`](#34212-activities)
      - [3.4.2.2 Deliverables & Assignments](#3422-deliverables--assignments)
        - [3.4.2.2.1 `deliverables`](#34221-deliverables)
        - [3.4.2.2.2 `deliverable_assignments`](#34222-deliverable_assignments)
      - [3.4.2.3 Budgets](#3423-budgets)
        - [3.4.2.3.1 `budgets`](#34231-budgets)
      - [3.4.2.4 Cost Lines](#3424-cost-lines)
        - [3.4.2.4.1 `cost_lines`](#34241-cost_lines)
      - [3.4.2.5 Actual Costs](#3425-actual-costs)
        - [3.4.2.5.1 `actual_costs`](#34251-actual_costs)
      - [3.4.2.6 Vendor Parts](#3426-vendor-parts)
        - [3.4.2.6.1 `vendor_parts`](#34261-vendor_parts)
    - [3.4.3 API](#343-api)
    - [3.4.4 Business Rules](#344-business-rules)
  - [3.5 Accounts Payable](#35-accounts-payable--core)
    - [3.5.1 Overview](#351-overview)
    - [3.5.2 Data Tables](#352-data-tables)
      - [3.5.2.1 AP Invoices](#3521-ap-invoices)
        - [3.5.2.1.1 `ap_invoices`](#35211-ap_invoices)
      - [3.5.2.2 AP Invoice Lines](#3522-ap-invoice-lines)
        - [3.5.2.2.1 `ap_invoice_lines`](#35221-ap_invoice_lines)
      - [3.5.2.3 Payments](#3523-payments)
        - [3.5.2.3.1 `payments`](#35231-payments)
      - [3.5.2.4 Credit Memos](#3524-credit-memos)
        - [3.5.2.4.1 `ap_credit_memos`](#35241-ap_credit_memos)
    - [3.5.3 API](#353-api)
    - [3.5.4 Business Rules](#354-business-rules)
  - [3.6 Accounts Receivable](#36-accounts-receivable--core)
    - [3.6.1 Overview](#361-overview)
    - [3.6.2 Data Tables](#362-data-tables)
      - [3.6.2.1 AR Invoices](#3621-ar-invoices)
        - [3.6.2.1.1 `ar_invoices`](#36211-ar_invoices)
      - [3.6.2.2 AR Invoice Lines](#3622-ar-invoice-lines)
        - [3.6.2.2.1 `ar_invoice_lines`](#36221-ar_invoice_lines)
      - [3.6.2.3 Receipts](#3623-receipts)
        - [3.6.2.3.1 `receipts`](#36231-receipts)
    - [3.6.3 API](#363-api)
    - [3.6.4 Business Rules](#364-business-rules)
  - [3.7 Accounting & General Ledger](#37-accounting--general-ledger--core)
    - [3.7.1 Overview](#371-overview)
    - [3.7.2 Data Tables](#372-data-tables)
      - [3.7.2.1 Chart of Accounts](#3721-chart-of-accounts)
        - [3.7.2.1.1 `chart_of_accounts`](#37211-chart_of_accounts)
      - [3.7.2.2 Journal Entries & Lines](#3722-journal-entries--lines)
        - [3.7.2.2.1 `journal_entries`](#37221-journal_entries)
        - [3.7.2.2.2 `journal_entry_lines`](#37222-journal_entry_lines)
      - [3.7.2.3 Ledger Balances](#3723-ledger-balances)
        - [3.7.2.3.1 `ledger_balances`](#37231-ledger_balances)
      - [3.7.2.4 Posting Queues](#3724-posting-queues)
        - [3.7.2.4.1 `posting_queues`](#37241-posting_queues)
      - [3.7.2.5 Category-Account Map](#3725-category-account-map)
        - [3.7.2.5.1 `category_account_map`](#37251-category_account_map)
      - [3.7.2.6 Intercompany](#3726-intercompany)
        - [3.7.2.6.1 `company_accounts`](#37261-company_accounts)
        - [3.7.2.6.2 `company_transactions`](#37262-company_transactions)
        - [3.7.2.6.3 `internal_transfers`](#37263-internal_transfers)
    - [3.7.3 API](#373-api)
    - [3.7.4 Business Rules](#374-business-rules)
  - [3.8 Cashflow & Profitability](#38-cashflow--profitability--core)
    - [3.8.1 Overview](#381-overview)
    - [3.8.2 Data Tables & Views](#382-data-tables--views)
      - [3.8.2.1 Data linkage model](#3821-data-linkage-model)
      - [3.8.2.2 Metrics](#3822-metrics)
      - [3.8.2.3 SQL views](#3823-sql-views)
    - [3.8.3 API](#383-api)
    - [3.8.4 Business Rules](#384-business-rules)
  - [3.9 Reporting & Views](#39-reporting--views--core)
    - [3.9.1 Overview](#391-overview)
    - [3.9.2 Data Tables & Views](#392-data-tables--views)
      - [3.9.2.1 Core export views](#3921-core-export-views)
      - [3.9.2.2 Financial views](#3922-financial-views)
      - [3.9.2.3 Budget vs. actual metrics](#3923-budget-vs-actual-metrics)
    - [3.9.3 API](#393-api)
    - [3.9.4 Business Rules](#394-business-rules)
  - [3.10 Shared Tables](#310-shared-tables--core)
    - [3.10.1 Emails](#3101-emails)
      - [3.10.1.1 `emails`](#31011-emails)
    - [3.10.2 Tenant Preferences](#3102-tenant-preferences)
      - [3.10.2.1 `tenant_preferences`](#31021-tenant_preferences)
    - [3.10.3 Countries](#3103-countries)
      - [3.10.3.1 `admin.countries`](#31031-admincountries)
    - [3.10.4 Match Review Logs](#3104-match-review-logs)
      - [3.10.4.1 `match_review_logs`](#31041-match_review_logs)
  - [3.11 Demo Tenants](#311-demo-tenants--in-scope)
    - [3.11.1 Meridian Group (MG) — Consulting Use Case](#3111-meridian-group-mg--consulting-use-case)
      - [3.11.1.1 Profile](#31111-profile)
      - [3.11.1.2 Active Modules](#31112-active-modules)
      - [3.11.1.3 Data Requirements](#31113-data-requirements)
      - [3.11.1.4 Key Workflows](#31114-key-workflows)
      - [3.11.1.5 Seed Script Reference](#31115-seed-script-reference)
    - [3.11.2 Sterling Ridge Homes (SRH) — Construction Use Case](#3112-sterling-ridge-homes-srh--construction-use-case)
      - [3.11.2.1 Profile](#31121-profile)
      - [3.11.2.2 Active Modules](#31122-active-modules)
      - [3.11.2.3 Data Requirements](#31123-data-requirements)
      - [3.11.2.4 Key Workflows](#31124-key-workflows)
      - [3.11.2.5 Seed Script Reference](#31125-seed-script-reference)
  - [3.12 Bill of Materials (BOM)](#312-bill-of-materials-bom--add-on)
    - [3.12.1 Overview](#3121-overview)
    - [3.12.2 Data Tables](#3122-data-tables)
      - [3.12.2.1 Catalog SKUs](#31221-catalog-skus)
        - [3.12.2.1.1 `catalog_skus`](#312211-catalog_skus)
      - [3.12.2.2 Vendor SKUs](#31222-vendor-skus)
        - [3.12.2.2.1 `vendor_skus`](#312221-vendor_skus)
      - [3.12.2.3 Vendor Pricing](#31223-vendor-pricing)
        - [3.12.2.3.1 `vendor_pricing`](#312231-vendor_pricing)
    - [3.12.3 API](#3123-api)
    - [3.12.4 Business Rules](#3124-business-rules)
  - [3.13 Contracts](#313-contracts--add-on-deferred)
    - [3.13.1 Overview](#3131-overview)
    - [3.13.2 Data Tables](#3132-data-tables)
    - [3.13.3 API](#3133-api)
    - [3.13.4 Business Rules](#3134-business-rules)
  - [3.14 Scheduling](#314-scheduling--add-on-deferred)
    - [3.14.1 Overview](#3141-overview)
    - [3.14.2 Data Tables](#3142-data-tables)
    - [3.14.3 API](#3143-api)
    - [3.14.4 Business Rules](#3144-business-rules)
  - [3.15 Timesheets](#315-timesheets--add-on-deferred)
    - [3.15.1 Overview](#3151-overview)
    - [3.15.2 Data Tables](#3152-data-tables)
    - [3.15.3 API](#3153-api)
    - [3.15.4 Business Rules](#3154-business-rules)
  - [3.16 Procurement](#316-procurement--add-on-deferred)
    - [3.16.1 Overview](#3161-overview)
    - [3.16.2 Data Tables](#3162-data-tables)
    - [3.16.3 API](#3163-api)
    - [3.16.4 Business Rules](#3164-business-rules)
  - [3.17 Inventory & Warehousing](#317-inventory--warehousing--add-on-deferred)
    - [3.17.1 Overview](#3171-overview)
    - [3.17.2 Data Tables](#3172-data-tables)
    - [3.17.3 API](#3173-api)
    - [3.17.4 Business Rules](#3174-business-rules)

- [4. Standard API Patterns](#4-standard-api-patterns--in-scope)
  - [4.1 CRUD Operations](#41-crud-operations--in-scope)
  - [4.2 Pagination](#42-pagination--in-scope)
  - [4.3 Audit Fields](#43-audit-fields--in-scope)
  - [4.4 Soft Deletes](#44-soft-deletes--in-scope)
  - [4.5 Validation](#45-validation--in-scope)
  - [4.6 Excel Import / Export](#46-excel-import--export--in-scope)
    - [4.6.1 Backend](#461-backend)
    - [4.6.2 Frontend](#462-frontend)
    - [4.6.3 Pages with Import / Export](#463-pages-with-import--export)

- [5. Database Design](#5-database-design--in-scope)
  - [5.1 Common Columns](#51-common-columns--in-scope)
  - [5.2 Naming Conventions](#52-naming-conventions--in-scope)
  - [5.3 Generated Columns](#53-generated-columns--in-scope)
  - [5.4 Schema Management & Migrations](#54-schema-management--migrations--in-scope)

- [6. UI Components & Theming](#6-ui-components--theming--in-scope)
  - [6.1 Theme System](#61-theme-system--in-scope)
    - [6.1.1 Component Override Strategy](#611-component-override-strategy)
    - [6.1.2 Design Tokens](#612-design-tokens)
    - [6.1.3 Theme Overrides Reference](#613-theme-overrides-reference)
  - [6.2 Navigation System](#62-navigation-system--in-scope)
  - [6.3 Module Bar](#63-module-bar--in-scope)
  - [6.4 Client Dependencies](#64-client-dependencies--in-scope)
  - [6.5 Reusable Component Patterns](#65-reusable-component-patterns--in-scope)

- [7. Navigation Structure](#7-navigation-structure--in-scope)

- [8. Environment Configuration](#8-environment-configuration--in-scope)

- [9. Testing Strategy](#9-testing-strategy--in-scope)

- [10. Coding Standards & Best Practices](#10-coding-standards--best-practices--in-scope)
  - [10.1 Naming Conventions](#101-naming-conventions--in-scope)
  - [10.1.1 Single Canonical Names](#1011-single-canonical-names--in-scope)
  - [10.2 File & Module Structure](#102-file--module-structure--in-scope)
  - [10.3 Copyright & File Headers](#103-copyright--file-headers--in-scope)
  - [10.4 Code Reuse](#104-code-reuse--in-scope)
  - [10.5 Classes vs Functions](#105-classes-vs-functions--in-scope)
  - [10.6 Error Handling](#106-error-handling--in-scope)
  - [10.7 Import & Export Style](#107-import--export-style--in-scope)
  - [10.8 Comments & Documentation](#108-comments--documentation--in-scope)
  - [10.9 Async & Concurrency](#109-async--concurrency--in-scope)
  - [10.10 Security Practices](#1010-security-practices--in-scope)

- [11. Developer Tooling](#11-developer-tooling--in-scope)
  - [11.1 ESLint](#111-eslint--in-scope)
  - [11.2 Prettier](#112-prettier--in-scope)
  - [11.3 EditorConfig](#113-editorconfig--in-scope)
  - [11.4 Husky & Git Hooks](#114-husky--git-hooks--in-scope)
  - [11.5 VSCode Workspace](#115-vscode-workspace--in-scope)
  - [11.6 Vitest](#116-vitest--in-scope)
  - [11.7 Vite](#117-vite--in-scope)
  - [11.8 npm Workspaces](#118-npm-workspaces--in-scope)
  - [11.9 Logging](#119-logging--in-scope)
  - [11.10 Environment Management](#1110-environment-management--in-scope)

- [12. Project Setup Guide](#12-project-setup-guide--in-scope)
  - [12.1 Prerequisites](#121-prerequisites--in-scope)
  - [12.2 GitHub Repository Setup](#122-github-repository-setup--in-scope)
  - [12.3 Clone & Install](#123-clone--install--in-scope)
  - [12.4 VSCode Configuration](#124-vscode-configuration--in-scope)
  - [12.5 Environment Setup](#125-environment-setup--in-scope)
  - [12.6 Database Setup](#126-database-setup--in-scope)
  - [12.7 Start Development](#127-start-development--in-scope)
  - [12.8 Run Tests](#128-run-tests--in-scope)
  - [12.9 Daily Workflow](#129-daily-workflow--in-scope)
  - [12.10 Husky Commit Rules](#1210-husky-commit-rules--in-scope)
  - [12.11 Recommended `.nvmrc`](#1211-recommended-nvmrc--in-scope)
  - [12.12 `.env.example` Reference](#1212-envexample-reference--in-scope)

- [13. Architecture Decision Records](#13-architecture-decision-records--in-scope)
  - [13.1 Purpose](#131-purpose--in-scope)
  - [13.2 Location](#132-location--in-scope)
  - [13.3 Template](#133-template--in-scope)
  - [13.4 When to Write an ADR](#134-when-to-write-an-adr--in-scope)
  - [13.5 Initial ADRs](#135-initial-adrs--in-scope)
  - [13.6 Referencing ADRs](#136-referencing-adrs--in-scope)

- [14. Scripts](#14-scripts--in-scope)
  - [14.1 Conventions](#141-conventions--in-scope)
  - [14.2 Migration Scripts](#142-migration-scripts--in-scope)
    - [14.2.1 `setupAdmin.js`](#1421-setupadminjs)
    - [14.2.2 `runMigrate.js`](#1422-runmigratejs)
    - [14.2.3 `migrateTenants.js`](#1423-migratetenantsjs)
  - [14.3 Bootstrap & Seed Scripts](#143-bootstrap--seed-scripts--in-scope)
    - [14.3.1 `seed.js`](#1431-seedjs)
    - [14.3.2 `seedRbac.js`](#1432-seedrbacjs)
    - [14.3.3 `seedDemoMG.js` *(planned)*](#1433-seeddemomgjs-planned)
    - [14.3.4 `seedDemoSRH.js` *(planned)*](#1434-seeddemosrhjs-planned)
  - [14.4 Debugging & Diagnostic Scripts](#144-debugging--diagnostic-scripts--in-scope)
  - [14.5 CLI / Shell Utilities](#145-cli--shell-utilities--in-scope)
    - [14.5.1 `db/provisionTenantCli.js`](#1451-dbprovisiontenantclijs)
    - [14.5.2 `db/reconcilePolicyCatalog.js`](#1452-dbreconcilepolicycatalogjs)

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

AXERRA is a multi-tenant, project-native Enterprise Resource Planning (ERP) platform with double-entry accounting. It is built for organizations that run their business through projects: consulting firms, property developers, homebuilders, general contractors, and similar multi-entity operators. One system covers budgets, cost tracking, vendor and client management, Accounts Payable (AP), Accounts Receivable (AR), General Ledger (GL), intercompany operations, and project-level cashflow and profitability. The base ERP is industry-agnostic. Industry-specific workflows ship as opt-in add-on modules. AXERRA runs on schema-per-tenant PostgreSQL isolation via `pg-schemata` 1.3.0. Axerra owns `pg-schemata` and extends it as product needs evolve.

### 1.2 Target Users  [in-scope]

AXERRA distinguishes two kinds of role. **System roles** are built into the platform and their meaning is fixed. **Convenience roles** are created per tenant and named to match local job titles (e.g., Controller, Project Manager, AP Clerk). System roles carry hard-coded scope rules. Convenience roles inherit from policies the tenant chooses.

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
- **Cross-tenant access source of truth:** the `admin.portal_user_tenants` binding table. A portal user has one row per tenant they can access. The oldest active binding is the **home tenant** (used at login). `portal_users.tenant_id` is a convenience pointer to the home tenant. It is **not** the authoritative cross-tenant list.
- Tenant resolution runs per request. At login the home tenant resolves from `portal_user_tenants`. Subsequent requests may target any active binding via the `x-tenant-code` header (subject to RBAC).
- All database access is schema-aware via pg-schemata's `setSchemaName()`. Models bind queries to the correct tenant schema dynamically.

### 2.2 pg-schemata Integration  [in-scope]

AXERRA is built entirely on **pg-schemata 1.3.0**. Since Axerra owns the pg-schemata repository, the library can be extended with new features or patched as AXERRA requirements evolve.

#### 2.2.1 Core Capabilities

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

#### 2.2.2 Query Operators

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

#### 2.2.5 Planned Enhancements

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

**`createRouter` middleware rules.**

1. `addAuditFields` is auto-prepended on mutation routes (POST, PUT, DELETE, PATCH).
2. `moduleEntitlement` is auto-appended on every route. Two exceptions: `/ping` has no middleware, and `POST /export-xls` uses read-level middleware (no `addAuditFields`).
3. `withMeta` is passed by each router via per-method middleware arrays.
4. `rbac()` is auto-applied on `/import-xls` (as `rbac('full')`) and `/export-xls` (as `rbac('view')`), with action overrides via `setImportAction` / `setExportAction`.
5. For other routes, `rbac()` must be added explicitly (e.g., `portalUsersRouter` per-method arrays, `employees/:id/reset-password`, `ar-invoices/approve`).

**Middleware reference.**

- `apps/server/src/middleware/requireRootTenant.js` — gates admin and tenant-management routes. Returns 403 unless `req.user.home_tenant?.toLowerCase()` equals `process.env.ROOT_TENANT_CODE` (default `axerra`). Comparison is case-insensitive.
- `apps/server/src/middleware/auditContext.js` — wraps each request in AsyncLocalStorage carrying the audit identity for model-layer hooks. Paired with `lib/requestContext.js` and `lib/registerAuditResolver.js` (see §4.3).
- `apps/server/src/middleware/errorHandler.js` — unified Express 5 error handler. It maps `SchemaDefinitionError` and `type === 'validation'` → 400, pg-schemata `DatabaseError` 23505 (unique) → 409, 23503 (FK) → 422, application errors carrying `err.status` → that status, and all other unhandled errors → 500 with structured logging (and `err.message` in non-prod).
- `apps/server/src/services/{permCacheInvalidator,rbacQueryContext,permissionLoader}.js` — Redis cache invalidator (busts `perm:{userId}:{tenantCode}` on role/policy mutations), RBAC query context builder, and the permission loader. The loader reads the canon from the database on cache miss. See §3.1.2 and `rules/rbac.md`.

## 3. Module Reference  [in-scope]

### 3.0 Module Taxonomy  [in-scope]

AXERRA splits functionality into two kinds of module: **core** and **add-on**. Core modules ship with every instance. Add-on modules are opt-in per tenant. Every module is wired through `apps/server/src/db/moduleRegistry.js` and gated by the `moduleEntitlement` middleware (see [ADR-0018](./decisions/0018-module-entitlement-middleware.md) and [ADR-0028](./decisions/0028-vertical-module-architecture.md)).

#### 3.0.1 Core Modules

Core modules load on every tenant. No configuration is required. They are:

| Module | Description | PRD § |
| --- | --- | --- |
| `system` | Auth, tenant management, RBAC. | §3.1 |
| `core` | Vendors, vendor contacts, clients, employees, companies, contacts, addresses, payment terms. | §3.2 |
| `projects` | Projects, units, tasks, cost items, change orders, templates. | §3.3 |
| `activities` | Categories, activities, deliverables, budgets, cost lines, actual costs, vendor parts. | §3.4 |
| `ap` | Accounts Payable — invoices, payments, credit memos. | §3.5 |
| `ar` | Accounts Receivable — invoices, receipts. | §3.6 |
| `accounting` | Chart of Accounts, Journal Entries, Ledger Balances, Posting Queues, Intercompany. | §3.7 |
| `cashflow` | Cashflow forecasts and project profitability views. | §3.8 |
| `reports` | Reporting and analytics. | §3.9 |
| `shared` | Cross-module tables — emails, tenant preferences, countries, match review logs. | §3.10 |

#### 3.0.2 Add-on Modules (loading rules)

Add-on modules load only if the tenant lists them in `tenants.allowed_modules`. The full set of available add-ons is:

| Module | Description | PRD § |
| --- | --- | --- |
| `bom` | Bill of Materials — catalog SKUs, vendor SKUs, vendor pricing. | §3.12 |
| `contracts` | Contract documents and milestones (services SOWs, construction sales, production work orders). | §3.13 |
| `scheduling` | Resource, crew, and milestone scheduling. | §3.14 |
| `timesheets` | Labour capture by employee, project, and activity. | §3.15 |
| `procurement` | Purchase orders, vendor RFQs, expediting. | §3.16 |
| `inventory` | On-hand stock, lot/serial tracking, project issues. | §3.17 |

**Loading rules.** Three rules govern add-on loading:

1. An add-on loads for a tenant only if its module key appears in `tenants.allowed_modules` for that tenant.
2. An empty `tenants.allowed_modules` array means **no** add-ons load. Empty does not mean "all" — that behaviour was removed.
3. Removing a module from `tenants.allowed_modules` disables its routes and middleware on the next request. Existing data is not deleted.

Of the six add-ons, only `bom` is currently registered in `moduleRegistry.js`. The other five are planned — they will be registered when implemented.

### 3.1 System — Auth, Tenant & RBAC  [core]

#### 3.1.1 Overview

The System module owns identity, tenant lifecycle, and Role-Based Access Control (RBAC). It lives in two places. The platform-wide `admin` schema holds portal users, tenant records, and the impersonation audit. Every tenant schema holds the tenant's own roles, policies, scopes, field groups, and numbering. Every other module depends on it. RBAC follows a four-layer model: policies → data scope → state filters → field groups. See [ADR-0013](./decisions/0013-four-layer-scoped-rbac.md).

#### 3.1.2 Data Tables

##### 3.1.2.1 Admin Schema Identity Tables

Four admin-schema tables form the identity cluster. They are owned by `admin`, shared across tenants, and accessed via the `requireRootTenant` middleware (except where noted).

###### 3.1.2.1.1 `admin.portal_users`

Pure identity / authentication. All personal information (name, phone, address) lives on the linked entity record in the tenant schema via polymorphic `entity_type` + `entity_id`.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `tenant_id` | uuid | Convenience pointer to the user's **home** tenant. Authoritative cross-tenant access lives in `portal_user_tenants`. |
| `entity_type` | varchar(16) | `'employee'`, `'vendor_contact'`, or `'client'`. |
| `entity_id` | uuid | Cross-schema reference to the entity record in the tenant schema (enforced by business logic, not FK). |
| `email` | varchar(128) | Login identifier. Globally unique via partial index `WHERE deactivated_at IS NULL`. |
| `password_hash` | text | bcrypt hash. Never returned in API responses. |
| `status` | varchar(20) | `active`, `invited`, `locked`. |

Partial unique index `(entity_type, entity_id) WHERE deactivated_at IS NULL` prevents duplicate logins for the same entity.

###### 3.1.2.1.2 `admin.portal_user_tenants`

Authoritative cross-tenant binding table. One row per `(portal_user, tenant)` pair the user can access. The oldest active row is the user's home tenant.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `portal_user_id` | uuid | FK to `admin.portal_users` (CASCADE). |
| `tenant_id` | uuid | FK to `admin.tenants` (CASCADE). |
| `entity_type` | varchar(16) | `'employee'`, `'vendor_contact'`, `'client'`, or NULL for bare registrations. |
| `entity_id` | uuid | Cross-schema reference. NULL for bare registrations. |
| `status` | varchar(20) | `active`, `invited`, `locked`. |

Indexes:
- Partial unique `(portal_user_id, tenant_id) WHERE deactivated_at IS NULL` — at most one active binding per user per tenant.
- Partial unique `(tenant_id, entity_type, entity_id) WHERE deactivated_at IS NULL AND entity_type IS NOT NULL` — at most one active portal_user per tenant-scoped entity.
- Supporting indexes on `portal_user_id`, `tenant_id`, `(entity_type, entity_id)`.

###### 3.1.2.1.3 `admin.tenants`

The tenant registry. Axerra (tenant_code `AXERRA`) is the root tenant and cannot be archived or deleted.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `tenant_code` | varchar(6) | Unique short code (e.g., `AXERRA`, `CAL`). |
| `company` | varchar(128) | Company name. |
| `schema_name` | varchar(63) | PostgreSQL schema for this tenant. |
| `status` | varchar(20) | `active`, `trial`, `suspended`, `pending`. |
| `tier` | varchar(20) | `enterprise`, `growth`, `starter`. |
| `region` | varchar(64) | Geographic region. |
| `allowed_modules` | jsonb | Add-on modules this tenant has licensed. Empty array (or missing) means no add-ons are loaded — see §3.0.2. |
| `max_users` | integer | User limit (default 5). |
| `notes` | text | Internal notes. |

###### 3.1.2.1.4 `admin.impersonation_logs`

Audit trail for cross-tenant impersonation by Axerra `super_user` / `support`.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `impersonator_id` | uuid | FK to `portal_users` (the operator). |
| `target_user_id` | uuid | FK to `portal_users` (the user being impersonated). |
| `target_tenant_code` | varchar(6) | Tenant being entered. |
| `reason` | text | Operator-supplied reason. |
| `started_at` | timestamptz | Session start. |
| `ended_at` | timestamptz | Null while active. |

Partial unique index `(impersonator_id) WHERE ended_at IS NULL` prevents concurrent sessions; a second open attempt returns `409 Conflict`.

##### 3.1.2.2 RBAC Policy Tables

These three tables define **Layer 1 — what a role can do**. They live in every tenant schema.

###### 3.1.2.2.1 `roles`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `code` | varchar(32) | Role code (e.g., `admin`, `project_manager`). |
| `name` | varchar(64) | Display name. |
| `description` | text | Optional. |
| `is_system` | boolean | True for `super_user`, `admin`, `support`, `vendor_contact`, `client`. |
| `is_immutable` | boolean | True if the role cannot be edited or deleted. |
| `scope` | varchar(32) | `all_projects`, `assigned_companies`, `assigned_projects`, or `self`. |
| `tenant_code` | varchar(6) | Tenant this role belongs to. |

Roles are stored as a `roles` text array directly on each entity record (employees, clients, vendor_contacts). There is no `role_members` junction table.

###### 3.1.2.2.2 `policies`

Per-role permission grants.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `role_id` | uuid | FK to `roles`. |
| `module` | varchar(32) | Module key. Empty string `''` for wildcard policies on idempotent roles. |
| `router` | varchar(64) | Router name within the module. |
| `action` | varchar(32) | Action name. |
| `level` | varchar(8) | `none`, `view`, or `full`. |
| `tenant_code` | varchar(6) | Tenant this policy belongs to. |

###### 3.1.2.2.3 `policy_catalog`

Read-only registry of valid `(module, router, action)` combinations. Drives the role-configuration UI and the exact-match carve-out in policy resolution.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `module` | varchar(32) | Module key. |
| `router` | varchar(64) | Router name. |
| `action` | varchar(32) | Action name. |
| `label` | varchar(128) | Human-readable label. |
| `description` | varchar(512) | Optional explanation. |
| `sort_order` | integer | Display order in the UI. |
| `valid_statuses` | text[] | Valid status values for the state-filter UI. |
| `available_fields` | text[] | Columns available for the field-group UI. |
| `policy_required` | boolean | Default `true`. If `true`, an exact `module::router::action` grant is required — wildcard fallbacks do not apply. |

Seed-only reference data. No audit fields, no tenant_code.

##### 3.1.2.3 RBAC State and Field-Group Tables

These tables define **Layer 3 (record states)** and **Layer 4 (column visibility)**.

###### 3.1.2.3.1 `state_filters`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `role_id` | uuid | FK to `roles`. |
| `module` | varchar(32) | Module key. |
| `router` | varchar(64) | Router name. |
| `visible_statuses` | text[] | Statuses this role may see. Empty = no filtering. |

###### 3.1.2.3.2 `field_group_definitions`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `module` | varchar(32) | Module key. |
| `router` | varchar(64) | Router name. |
| `group_name` | varchar(64) | Group name. |
| `columns` | text[] | Columns in this group. |
| `is_default` | boolean | If `true`, granted to every role automatically. |

###### 3.1.2.3.3 `field_group_grants`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `role_id` | uuid | FK to `roles`. |
| `field_group_id` | uuid | FK to `field_group_definitions`. |

Empty grants = all columns visible.

##### 3.1.2.4 RBAC Membership Tables

These tables define **Layer 2 — data scope** for users with `assigned_projects` or `assigned_companies` scope.

###### 3.1.2.4.1 `project_members`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `project_id` | uuid | FK to `projects`. |
| `user_id` | uuid | FK to `portal_users`. |
| `role` | varchar(32) | Label (e.g., `member`, `lead`). |

###### 3.1.2.4.2 `company_members`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `company_id` | uuid | FK to `companies`. |
| `user_id` | uuid | FK to `portal_users`. |

When a user's role has `scope = 'assigned_companies'`, the permission loader resolves both `companyIds` and the corresponding `projectIds` from these tables.

##### 3.1.2.5 Approval Audit

Cross-module approval workflow audit. The table is system-level (tenant-scoped, polymorphic) because approvals are a cross-cutting concern: projects (budget release, change orders), AP (payments, invoices, credit memos), AR (invoices), GL (manual journal entries), and add-on workflows all write rows to the same table.

###### 3.1.2.5.1 `approvals`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `entity_type` | varchar(32) | The kind of thing being approved (e.g. `project`, `change_order`, `ap_payment`, `ap_invoice`, `ar_invoice`, `gl_journal`). |
| `entity_id` | uuid | FK reference to the entity row. No DB-level FK (polymorphic). |
| `action` | varchar(32) | `submit`, `approve`, `reject`, `post`. |
| `prior_status` | varchar(20) | The entity's status before the action. |
| `new_status` | varchar(20) | The entity's status after the action. |
| `reason` | text | Optional rationale. Required on `reject`. |

Standard audit fields apply: `created_by` is the actor who took the action, `created_at` is when it happened. `updated_by` / `updated_at` exist (per pg-schemata convention) but are unused — the table is append-only at the application layer; no PATCH/PUT endpoint is exposed.

Indexes: `(entity_type, entity_id, created_at DESC)` for "latest action on this entity"; `(created_by, created_at)` for per-user audit.

Each module owns its own workflow rules (valid actions, state transitions, gating permissions) and writes rows via its own action endpoints. The shared table provides the audit trail and a unified read surface (`GET /api/approvals/v1/approvals`).

#### 3.1.3 API

##### 3.1.3.1 Authentication Endpoints

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/auth/login` | Authenticate with email and password. |
| POST | `/api/auth/refresh` | Rotate auth and refresh tokens. |
| POST | `/api/auth/logout` | Clear auth cookies. |
| POST | `/api/auth/change-password` | Change the current user's password. Enforces strength rules. |
| GET | `/api/auth/me` | Current user context — tenant, roles, permissions, impersonation state. |
| GET | `/api/auth/check` | Lightweight session validation. |

##### 3.1.3.2 Tenant Management Endpoints

Restricted to Axerra staff via `requireRootTenant` middleware.

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/tenants/v1/tenants` | Create tenant. Provisions schema and creates the admin employee plus portal_users login in a single transaction. |
| GET | `/api/tenants/v1/tenants` | List tenants (cursor-based pagination). |
| GET | `/api/tenants/v1/tenants/:id` | Get tenant by id. |
| PUT | `/api/tenants/v1/tenants/update` | Update tenant. |
| DELETE | `/api/tenants/v1/tenants/archive` | Soft-delete tenant. Cascades to lock the tenant's `portal_user_tenants` bindings; locks each linked `portal_users` row only if the binding being archived is its last active one (multi-tenant vendors stay live elsewhere). See §3.1.4.7. |
| PATCH | `/api/tenants/v1/tenants/restore` | Restore archived tenant. Reactivates the cohort of bindings and users archived at the same time (`deactivated_at` cleared). `status` is **not** modified — bindings and users remain `locked`. An Axerra root user must explicitly enable an admin via `provision-admin` before login is possible. See §3.1.4.7. |
| POST | `/api/tenants/v1/tenants/:tenantId/provision-admin` | Enable an admin on a restored (or freshly active) tenant. Three branches keyed off the supplied email: no matching `portal_users` → create user + binding; existing user, no binding to this tenant → add a new `employee` binding; existing user with a locked `employee` binding to this tenant → unlock in place, re-invite. Returns `409` when the existing binding's `entity_type` is not `employee`. See §3.1.4.7. |
| GET | `/api/tenants/v1/tenants/:id/modules` | Get the tenant's allowed add-on modules. |
| GET | `/api/tenants/v1/tenants/:id/contacts` | Get primary and billing contacts (cross-schema query into the tenant's employees). |
| POST | `/api/tenants/v1/tenants/import-xls` | Import tenants from XLSX. Rows without `id` trigger full per-row provisioning. |
| POST | `/api/tenants/v1/tenants/export-xls` | Export tenants to XLSX. |
| POST | `/api/tenants/v1/portal-users/register` | Register a new user (`tenant_code`, `email`, `password`). |
| GET | `/api/tenants/v1/portal-users` | List portal users. |
| GET | `/api/tenants/v1/portal-users/:id` | Get portal user by id. |
| PUT | `/api/tenants/v1/portal-users/update` | Update portal user. |
| DELETE | `/api/tenants/v1/portal-users/archive` | Soft-delete portal user. Cascades to linked entity. Self-archival blocked. |
| PATCH | `/api/tenants/v1/portal-users/restore` | Restore portal user. Requires parent tenant active. |
| GET | `/api/tenants/v1/admin/schemas` | List active tenants (Axerra only). |
| POST | `/api/tenants/v1/admin/impersonate` | Start impersonation session (`target_user_id`). |
| POST | `/api/tenants/v1/admin/exit-impersonation` | End the active impersonation session. |
| GET | `/api/tenants/v1/admin/impersonation-status` | Check current impersonation state. |
| GET | `/api/tenants/v1/orphan-portal-users/orphans/preview` | Preview orphan `portal_users` rows and backlog count. |
| POST | `/api/tenants/v1/orphan-portal-users/orphans/cleanup` | Hard-delete a single orphan portal_user. |

##### 3.1.3.3 RBAC / Policy Endpoints

Tenant-scope, all under `/api/core/v1/`.

| Method | Path | Description |
| --- | --- | --- |
| CRUD | `/api/core/v1/roles` | Manage tenant roles. |
| CRUD | `/api/core/v1/policies` | Manage per-role policy grants. |
| GET | `/api/core/v1/policy-catalog` | Read-only catalog of valid `(module, router, action)` combinations. |
| CRUD | `/api/core/v1/state-filters` | Manage Layer 3 state visibility filters. |
| CRUD | `/api/core/v1/field-group-definitions` | Manage Layer 4 named column groups. |
| CRUD | `/api/core/v1/field-group-grants` | Assign field groups to roles. |
| CRUD | `/api/core/v1/project-members` | Manage Layer 2 user↔project assignments. |
| CRUD | `/api/core/v1/company-members` | Manage Layer 2 user↔company assignments. |
| CRUD | `/api/core/v1/numbering-config` | Manage per-entity-type numbering configuration (see §3.1.4.5). |

Role assignment itself is done via the entity CRUD endpoints (update the `roles` array on the employee, vendor contact, or client record). There is no `/role-members` endpoint.

##### 3.1.3.4 Approval Audit Endpoint

Tenant-scoped, cross-module read surface for the `approvals` table (§3.1.2.5).

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/approvals/v1/approvals` | List approval audit rows. Filterable by `entity_type`, `entity_id`, `created_by` (actor), `action`, date range. Gated by `system::approvals::view`. |

Approval *actions* (submit, approve, reject, post) live on each module's own endpoints — `/api/projects/v1/projects/:id/approve-release`, future `/api/ap/v1/payments/:id/approve`, etc. This endpoint is read-only.

#### 3.1.4 Business Rules

##### 3.1.4.1 Login Flow & Token Lifecycle

1. The user submits email and password on `LoginPage`.
2. The client calls `POST /api/auth/login` via `authApi.login()`.
3. The server validates credentials via Passport Local Strategy (bcrypt against `admin.portal_users.password_hash`).
4. The server resolves the user's home tenant from `admin.portal_user_tenants` (oldest active binding). Login is refused with `"Tenant is inactive."` if the home tenant is not active.
5. The server loads RBAC permissions for the home tenant and gates token issuance on the result. A user with no usable permissions is refused with `403` — credentials were valid but the account is unusable.
6. The server computes `ph`, a SHA-256 hash of the resolved permission canon. It signs the `auth_token` (15-minute TTL) and `refresh_token` (7-day TTL) as JWTs and sets them as httpOnly cookies. The permission canon is primed into Redis so the first authenticated request skips the reload.
7. The client calls `GET /api/auth/me` to hydrate user context, then `LayoutShell` admits the user to the app.
8. JWT claims carry only `sub` (user UUID) and `ph` (permissions hash). Tenant context, roles, and permissions are resolved at request time by `authRedis` — they are not embedded in the token.
9. `auth_token` rotates on every call to `POST /api/auth/refresh`; the refresh token rotates fully alongside it. Logout clears both cookies.
10. All API calls use `credentials: 'include'`. No tokens are stored in `localStorage`.

##### 3.1.4.2 Mid-Session Policy Refresh

1. When a role's policies, scope, state filters, or field grants change, the server invalidates the Redis permission canon for every affected user (`perm:{userId}:{tenantCode}`).
2. On the user's next authenticated request, `authRedis` reloads the canon from the database and recomputes `ph`.
3. If the recomputed `ph` differs from the claim in the request's `auth_token`, the server sets the `X-Token-Stale: 1` response header. The client treats that header as a signal to call `POST /api/auth/refresh`. The refresh re-issues tokens with the fresh `ph`.
4. The user does not need to log out and back in. The next request reflects the updated permissions automatically.

> **Implementation gap:** the server emits `X-Token-Stale: 1`, but the client does not yet read it — proactive token refresh on permission change is unimplemented, so a stale `ph` claim persists in the token until the next reactive refresh (up to 15 minutes, or until any 401).

##### 3.1.4.3 Four-Layer RBAC Resolution

1. **Layer 1 — Policies.** Resolution walks from most specific to least specific: `module::router::action` → `module::router::` → `module::::` → `::::` (empty-module wildcard for idempotent roles) → default `none`.
2. **Exact-match carve-out.** `policy_catalog` rows with `policy_required = true` bypass the fallback. They require an exact `module::router::action` grant. The carve-out set is built at module load in `apps/server/src/middleware/rbac.js` from `CATALOG_ENTRIES` in `policyCatalogSeeder.js`. This keeps sensitive actions out of router-level wildcards.
3. **Layer 2 — Data scope.** `roles.scope` selects how much data the user sees. The hierarchy is `all_projects` > `assigned_companies` > `assigned_projects` > `self`. `self` scope reads `entity_type` and `entity_id` from `portal_users`. It then maps to the resource's FK column (e.g., `vendor_id` on AP invoices).
4. **Layer 3 — State filters.** `state_filters.visible_statuses` restricts which record statuses the role may see per `(module, router)`. Empty = no filtering.
5. **Layer 4 — Field groups.** `field_group_grants` plus default definitions decide which columns are returned. Empty grants = all columns visible.
6. **Multi-role merge.** When a user holds multiple roles, Layer 2 takes the most permissive scope. Layers 3 and 4 take the union of states and columns across roles.
7. **No bypass.** The middleware does not short-circuit for `super_user` or `admin`. Every user resolves through the same `roles` array → `policies` path. Every grant is auditable.
8. **Enforcement.** Four pieces work in order. `moduleEntitlement` rejects requests whose module is not in `tenants.allowed_modules`. `withMeta({ module, router, action })` annotates `req.resource`. `rbac(requiredLevel)` enforces Layer 1 at the route. `ViewController._applyRbacFilters()` enforces Layers 2–4 at the service layer.

##### 3.1.4.4 System Roles (incl. vendor_contacts, clients)

System roles are built into the platform. Their meaning is fixed across every tenant and they cannot be edited. They are distinct from **convenience roles** (e.g., `accountant`, `controller`, `project_manager`), which each tenant defines for itself.

| Role | Scope | Notes |
| --- | --- | --- |
| `super_user` | Cross-tenant (Axerra only) | Full access to every tenant. Holds wildcard `level: 'full'` policy plus cross-tenant and impersonation grants. |
| `admin` | `all_projects` (per tenant) | Full access within one tenant. Holds wildcard `level: 'full'` policy. Seeded in every tenant schema. |
| `support` | Cross-tenant (Axerra only) | Cross-tenant access and impersonation, with `level: 'none'` on financial modules (`accounting`, `ap`, `ar`). |
| `vendor_contact` | `self` | Vendor-portal user. Sees only their own vendor's records (AP invoices, payments, POs). |
| `client` | `self` | Client-portal user. Sees only their own invoices, statements, and receipts. |

Cross-tenant and impersonation policies are seeded only in the `axerra` schema, on `super_user` and `support`. They cannot be assigned in any other schema.

The five system roles above receive a single wildcard policy at seed time. Adding a new module does not require backfilling them. Convenience roles enumerate per-module policies explicitly. When a new module ships, every tenant's convenience roles must be backfilled with the new module's rows. The retroactive seeder for this is not yet built. Tenants must add the new policies manually until it lands.

`tenants::portal-users::import` and `tenants::portal-users::export` are intentionally absent from `policy_catalog`. Users are created via `/register` only. `tenants::tenants::import|export` are seeded and gate the tenants XLSX endpoints.

##### 3.1.4.5 Tenant Numbering System

The numbering system generates human-readable business identifiers (e.g., `EMP-0045`, `INV-2026-00123`) separately from internal UUID primary keys. Configuration is per-tenant, optionally sub-scoped (e.g., per company for invoices), and supports period-based counter reset.

###### 3.1.4.5.1 Design principles

1. UUID primary keys are not business identifiers.
2. Business numbers are generated per tenant; never globally.
3. Invoice numbers are generated per company (`scope_type = 'company'`); each company has its own invoice sequence.
4. Reset is implemented via `period_key` partitioning, not by restarting sequences.
5. Display formatting is independent of serial allocation.
6. Issued numbers are immutable.

###### 3.1.4.5.2 Data: `tenant_numbering_config`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `tenant_id` | uuid | Not null, immutable. |
| `id_type` | varchar(32) | `employee`, `vendor`, `client`, `contact`, `ar_invoice`, `ap_invoice`, `project`. |
| `prefix` | varchar(16) | Display prefix. |
| `suffix` | varchar(16) | Display suffix. |
| `date_mode` | varchar(16) | `none`, `year`, `year_month`, `ymd`. |
| `reset_mode` | varchar(16) | `never`, `yearly`, `monthly`, `daily`. |
| `padding` | integer | Zero-pad width. |
| `separator` | varchar(4) | Joins display parts. |
| `uppercase` | boolean | Apply uppercase to the final display ID. |
| `scope_type` | varchar(32) | `none`, `company`, or `project`. |
| `is_enabled` | boolean | Enables auto-numbering for this entity type. |

Unique constraint `(tenant_id, id_type)` — one config row per entity type per tenant. Changing configuration affects future numbers only; historical numbers are never rewritten.

###### 3.1.4.5.3 Data: `tenant_number_sequence_state`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `tenant_id` | uuid | Not null, immutable. |
| `id_type` | varchar(32) | Entity type. |
| `scope_id` | uuid | Scope entity UUID, or NIL UUID for global scope. |
| `period_key` | varchar(16) | Derived from `reset_mode`: `never` → `global`, `yearly` → `YYYY`, `monthly` → `YYYY-MM`, `daily` → `YYYY-MM-DD`. |
| `last_serial` | bigint | Current counter value. |

Unique constraint `(tenant_id, id_type, scope_id, period_key)`.

###### 3.1.4.5.4 Allocation and display

1. Determine `period_key` from `reset_mode` and current date.
2. `BEGIN` transaction.
3. `SELECT ... FROM tenant_number_sequence_state FOR UPDATE` (row lock).
4. Insert with `last_serial = 1` if no row exists; otherwise increment `last_serial`.
5. Assign the serial to the entity record.
6. Compute `display_id = prefix + separator + date_part + separator + padded(serial) + separator + suffix`. Only non-empty components are included; uppercase applied if configured.
7. `COMMIT`.

Reset is achieved via `period_key` partitioning. For yearly reset, 2025 uses `period_key = '2025'` from serial 000001, and 2026 starts a new partition at 000001 automatically.

###### 3.1.4.5.5 Recommended defaults

| Entity | Prefix | Padding | Date mode | Reset | Scope |
| --- | --- | --- | --- | --- | --- |
| Employee | `EMP` | 4 | none | never | tenant |
| Vendor | `VND` | 4 | none | never | tenant |
| Client | `CLT` | 4 | none | never | tenant |
| Contact | `CON` | 4 | none | never | tenant |
| Project | `PRJ` | 4 | none | never | tenant |
| AR Invoice | `INV` | 5 | year | yearly | company |
| AP Invoice | `BILL` | 5 | year | yearly | company |

All configs are seeded with `is_enabled = false`. Tenants opt in via Settings → Numbering.

###### 3.1.4.5.6 Entity integration and backfill

1. Auto-numbering populates the entity's code field only when the user does not supply one.
2. AR invoices number on status transition to `sent`. AP invoices number on status transition to `approved`. Numbers are immutable after assignment.
3. When numbering is enabled for an entity type for the first time, existing records with `code IS NULL AND deactivated_at IS NULL` are backfilled. The backfill runs atomically, in `created_at` order, via the same `allocateNumber()` path normal creates use. The response returns a `backfilledCodes` count for the UI.

##### 3.1.4.6 Impersonation

1. The active impersonation session is stored in Redis at `imp:{userId}` with TTL.
2. `authRedis` detects the session, swaps `req.user` to the target user, and sets `req.user.is_impersonating = true` plus `req.user.impersonated_by`.
3. `/api/auth/me` includes `impersonation: { active, impersonated_by }` for client-side UI state.
4. Each session inserts a row into `admin.impersonation_logs`. The partial unique index on `(impersonator_id) WHERE ended_at IS NULL` prevents concurrent sessions. A second open attempt returns `409 Conflict`.

##### 3.1.4.7 Tenant Archive, Restore, and Admin Reactivation

The tenant lifecycle is **soft**: archive locks rows, restore reactivates them, no data is deleted. Restoring a tenant does **not** restore login capability on its own — by design, an Axerra root user must deliberately enable at least one admin via the `provision-admin` endpoint before the tenant becomes usable again.

###### 3.1.4.7.1 Archive cascade

`DELETE /api/tenants/v1/tenants/archive` runs in a single transaction:

1. Sets `admin.tenants.deactivated_at = NOW()` on the tenant row.
2. Bulk-updates every active `admin.portal_user_tenants` row for that tenant: `deactivated_at = NOW(), status = 'locked'`.
3. For each affected `portal_users` row, locks it **only if** the just-archived binding was the user's last active one. Multi-tenant vendor contacts with other live bindings stay live and can keep logging in via those tenants.

The root tenant (`AXERRA`) cannot be archived.

###### 3.1.4.7.2 Restore cascade

`PATCH /api/tenants/v1/tenants/restore` runs in a single transaction and uses a **cohort-by-MAX-timestamp** rule (`restoreTenantBindings` in `apps/server/src/system/auth/services/portalUserCascade.js`):

1. Clears `admin.tenants.deactivated_at` on the tenant row.
2. Finds the cohort of bindings whose `deactivated_at` equals the most recent `deactivated_at` for this tenant — i.e. the bindings archived **with** the tenant. Bindings deactivated at an earlier date for unrelated reasons are deliberately excluded.
3. Clears `deactivated_at` on each cohort binding and on the referenced `portal_users` rows.
4. **Does not modify `status`.** Bindings and users come out of restore as `locked` because the archive cascade set them to `locked` and the prior status is not preserved. This is intentional: a dormancy period invalidates the prior trust state, so re-enabling a login must be an explicit operator decision.

After restore, no one can log in to the tenant until §3.1.4.7.3 is executed for at least one user.

###### 3.1.4.7.3 Admin reactivation via `provision-admin`

`POST /api/tenants/v1/tenants/:tenantId/provision-admin` is RBAC-guarded by `requireRootTenant`. The handler runs in a single transaction and follows the same shape as `vendorContactsController.#provisionAppUser` (the existing email-collision-tolerant provisioning pattern). It takes `{ email, firstName, lastName, phone, employeeId? }` and branches on what already exists:

1. **No matching `portal_users` row.** Create the `portal_users` row, create the tenant-side `employees` row (or link to the supplied `employeeId` if it points at an existing employee), insert a `portal_user_tenants` binding with `entity_type='employee'`, `status='invited'`. Send invite email.
2. **`portal_users` exists, no binding to this tenant.** Do not modify the existing `portal_users` row (the user is active in another tenant — typically a vendor contact, or an Axerra staff member taking interim admin duty). Create the tenant-side `employees` row, insert a new `(portal_user_id, tenantId, entity_type='employee', status='invited')` binding. Send invite email. The user keeps their existing credentials and reaches this tenant via the `x-tenant-code` header (see §3.1.4.x request flow).
3. **`portal_users` exists AND a binding to this tenant exists with `entity_type='employee'`.** Unlock in place: clear any residual `deactivated_at`, set `status='invited'`, blank `password_hash`, link to the supplied employee row (or keep the existing `entity_id` if already populated). Send invite email.
4. **`portal_users` exists with a binding to this tenant whose `entity_type` is `vendor_contact`, `client`, or `NULL` (bare).** Return `409 Conflict` with a descriptive error. The endpoint never silently rewrites the entity link — promoting a vendor contact or client to admin is a separate, explicit operation outside this endpoint's scope.

All rows touched stamp `created_by` / `updated_by = req.user.id` for audit.

###### 3.1.4.7.4 What `provision-admin` deliberately does **not** do

- It does not bulk-unlock the original employee cohort. Each admin must be enabled deliberately.
- It does not re-activate a tenant's `allowed_modules` or otherwise alter the tenant row. Restore handles tenant state; this endpoint handles user state.
- It does not provide self-service. Forgotten-password recovery for portal users (any tenant, archived or active) is out of scope.

See [ADR-0029](decisions/0029-tenant-restore-admin-reactivation.md) for the security rationale behind the lock-on-restore + deliberate-reactivation design.

---

### 3.2 Core Entities  [core]

#### 3.2.1 Overview

Core Entities are the shared reference records every other module reads from. They include vendors, vendor contacts, payment terms, clients, employees, and companies. Polymorphic supporting tables (sources, contacts, addresses, phone numbers, tax identifiers, emails) attach to every entity through a single `sources` discriminated-union table. That pattern lets addresses, phones, emails, and tax IDs hang off any entity uniformly.

#### 3.2.2 Data Tables

##### 3.2.2.1 Vendors & Vendor Contacts

###### 3.2.2.1.1 `vendors`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `tenant_id` | uuid | Not null. |
| `source_id` | uuid | FK to `sources` (CASCADE). |
| `name` | varchar(128) | Not null. |
| `code` | varchar(16) | Unique per tenant. Auto-numbered when numbering is enabled. |
| `payment_term_id` | uuid | FK to `payment_terms` (SET NULL). |
| `is_active` | boolean | Default true. |
| `notes` | text | Internal notes. |

###### 3.2.2.1.2 `vendor_contacts`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `tenant_id` | uuid | Not null. |
| `vendor_id` | uuid | FK to `vendors` (CASCADE). |
| `source_id` | uuid | FK to `sources` (CASCADE). |
| `first_name` | varchar(64) | Not null. |
| `last_name` | varchar(64) | Not null. |
| `position` | varchar(64) | Job title. |
| `department` | varchar(64) | Department. |
| `is_app_user` | boolean | Default false. Must be true before a `portal_users` login can be created. Requires `roles` to be non-empty. |
| `roles` | text[] | RBAC role codes (default `'{}'`). References `roles.code`. |
| `is_primary` | boolean | Default false. Marks the vendor's primary contact. |

Each vendor contact owns its own `sources` row (with `source_type = 'vendor_contact'`) so emails, phones, and addresses attach via the polymorphic pattern (see §3.2.2.5).

##### 3.2.2.2 Payment Terms

###### 3.2.2.2.1 `payment_terms`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `tenant_id` | uuid | Not null. |
| `label` | varchar(64) | Human-readable label (e.g., "Net 30", "2/10 Net 30"). |
| `term` | integer | Not null, default 30. |
| `units` | varchar(16) | Not null, default `days`. CHECK: `days` or `months`. |
| `is_active` | boolean | Default true. |

##### 3.2.2.3 Clients

###### 3.2.2.3.1 `clients`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `tenant_id` | uuid | Not null. |
| `source_id` | uuid | FK to `sources` (CASCADE). |
| `name` | varchar(128) | Not null. |
| `code` | varchar(16) | Unique per tenant. Auto-numbered when numbering is enabled. |
| `roles` | text[] | RBAC role codes (default `'{}'`). |
| `is_app_user` | boolean | Default false. Must be true before a `portal_users` login can be created. |
| `is_active` | boolean | Default true. |

Email addresses live in the polymorphic `emails` table keyed by `clients.source_id`. There is no `email` column on `clients`.

##### 3.2.2.4 Employees

###### 3.2.2.4.1 `employees`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `tenant_id` | uuid | Not null. |
| `source_id` | uuid | FK to `sources` (CASCADE). |
| `first_name` | varchar(64) | Not null. |
| `last_name` | varchar(64) | Not null. |
| `code` | varchar(16) | Unique per tenant. Auto-numbered when numbering is enabled. |
| `position` | varchar(64) | Job title. |
| `department` | varchar(64) | Department. |
| `roles` | text[] | RBAC role codes (default `'{}'`). |
| `is_app_user` | boolean | Default false. Must be true before a `portal_users` login can be created. Requires `roles` to be non-empty. |
| `is_primary_contact` | boolean | Default false. Designates this employee as the tenant's primary contact. |
| `is_billing_contact` | boolean | Default false. Designates this employee as the tenant's billing contact. |

Email addresses live in the polymorphic `emails` table keyed by `employees.source_id`. The per-tenant uniqueness invariant is enforced on `emails` instead of on `employees`.

Employees use `deactivated_at` (via pg-schemata `softDelete: true`) and do **not** have an `is_active` boolean. Vendors, clients, and contacts have both `is_active` (user-facing toggle) and `deactivated_at` (soft-delete marker).

##### 3.2.2.5 Sources, Contacts, Addresses & Phones

The `sources` table is a discriminated union — every entity that needs addresses, phones, emails, or tax IDs gets exactly one `sources` row. Children FK to `sources.id`, never to the entity directly.

###### 3.2.2.5.1 `sources`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `tenant_id` | uuid | Not null. |
| `table_id` | uuid | The parent entity's id. |
| `source_type` | varchar(32) | `vendor`, `vendor_contact`, `client`, `employee`, `contact`, `company`. |
| `label` | varchar(64) | Human-friendly label. |

###### 3.2.2.5.2 `contacts`

Standalone payees and receivable counterparties that are not vendors, clients, or employees (one-off commissions, donations, ad-hoc income). Cannot log in. No RBAC roles.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `tenant_id` | uuid | Not null. |
| `source_id` | uuid | FK to `sources` (CASCADE). |
| `name` | varchar(128) | Not null. |
| `code` | varchar(16) | Unique per tenant. |
| `is_active` | boolean | Default true. |

###### 3.2.2.5.3 `addresses`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `tenant_id` | uuid | Not null, immutable. |
| `source_id` | uuid | FK to `sources` (CASCADE), not null. |
| `label` | varchar(32) | `billing`, `physical`, `mailing`. |
| `address_line_1` | varchar(255) | Street or P.O. Box. |
| `address_line_2` | varchar(255) | Apt, suite, unit, building, floor. |
| `address_line_3` | varchar(255) | Additional line for international addresses. |
| `city` | varchar(128) | City / locality. |
| `state_province` | varchar(128) | State, province, region, prefecture, county. |
| `postal_code` | varchar(20) | ZIP / postal code (any global format). |
| `country_code` | char(2) | ISO 3166-1 alpha-2. |
| `is_primary` | boolean | Primary address flag. |

###### 3.2.2.5.4 `phone_numbers`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `tenant_id` | uuid | Not null, immutable. |
| `source_id` | uuid | FK to `sources` (CASCADE), not null. |
| `phone_type` | varchar(16) | `cell`, `work`, `home`, `fax`, `other` (default `cell`). |
| `country_code` | char(2) | ISO 3166-1 alpha-2 (default `US`). |
| `phone_number` | varchar(32) | Not null. |
| `is_primary` | boolean | Default false. |

###### 3.2.2.5.5 `tax_identifiers`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `tenant_id` | uuid | Not null, immutable. |
| `source_id` | uuid | FK to `sources` (CASCADE), not null. |
| `country_code` | char(2) | ISO country code, not null. |
| `tax_type` | varchar(16) | `EIN`, `SSN`, `VAT`, etc. — not null. |
| `tax_value` | varchar(64) | The identifier value, not null. |
| `is_primary` | boolean | Default false. |

Unique constraint `(source_id, country_code, tax_type) WHERE deactivated_at IS NULL`.

##### 3.2.2.6 Companies

###### 3.2.2.6.1 `companies`

Companies are the legal entities under a tenant — the things that sign contracts, hold bank accounts, and file taxes.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `tenant_id` | uuid | Not null. |
| `source_id` | uuid | FK to `sources` (CASCADE). |
| `code` | varchar(16) | Required, unique per tenant. Not auto-numbered — operators choose the code. |
| `name` | varchar(128) | Company name. |
| `is_active` | boolean | Default true. |

#### 3.2.3 API

All endpoints are under `/api/core/v1/` and provide standard CRUD (see §4.1) unless noted.

| Method | Path | Description |
| --- | --- | --- |
| CRUD | `/api/core/v1/vendors` | Manage vendors. |
| CRUD | `/api/core/v1/vendor-contacts` | Manage vendor contacts. |
| CRUD | `/api/core/v1/payment-terms` | Manage payment terms. |
| CRUD | `/api/core/v1/clients` | Manage clients. |
| CRUD | `/api/core/v1/employees` | Manage employees. |
| GET | `/api/core/v1/employees/:id/source-id` | Resolve the polymorphic source record for phone/address lookups. |
| POST | `/api/core/v1/employees/:id/reset-password` | Admin-initiated password reset for the employee's `portal_users` login. |
| CRUD | `/api/core/v1/contacts` | Manage standalone contacts. |
| CRUD | `/api/core/v1/companies` | Manage companies. |
| CRUD | `/api/core/v1/sources` | Manage polymorphic source rows (rarely called directly). |
| CRUD | `/api/core/v1/addresses` | Manage addresses keyed by `source_id`. |
| CRUD | `/api/core/v1/phone-numbers` | Manage phone numbers keyed by `source_id`. |
| CRUD | `/api/core/v1/tax-identifiers` | Manage tax identifiers keyed by `source_id`. |
| CRUD | `/api/core/v1/emails` | Manage email addresses keyed by `source_id` (see §3.10). |

#### 3.2.4 Business Rules

1. Every entity that owns addresses, phones, emails, or tax IDs has exactly one `sources` row. Children FK to `sources.id`.
2. `is_app_user = true` requires a non-empty `roles` array. The `employeeRoleValidator.js` lib rejects saves that violate this rule.
3. Creating a `portal_users` login from an entity is a single transaction: write the `portal_users` row, then sync the `is_login` email on the polymorphic `emails` table via `loginEmailSync.js`.
4. `employeeAppUserSync.js` (and parallel libs for clients and vendor contacts) drives the provision / archive / restore branches when `is_app_user` toggles.
5. `clearOtherPrimary.js` enforces single-primary invariants on `is_primary_contact` and `is_billing_contact`. Both flags may be true on the same employee. They may also be true on different employees independently.
6. Vendor contacts are managed inside the parent Vendor edit dialog (`VendorContactsPanel.jsx` + `ContactFormDialog.jsx`). There is no top-level Vendor Contacts page. XLSX import/export is wired at the router level (`rbac('full')` on `/import-xls`, `rbac('view')` on `/export-xls`) and driven from the Vendor panel.
7. Companies are the legal entities under a tenant. Invoices number per company (`scope_type = 'company'`). See §3.1.4.5.
8. Mailing labels concatenate non-empty `address_line_*` lines, then `city + state_province + postal_code`, then the country resolved from `country_code`. A locale-aware formatter applies country-specific rules (e.g., Japanese order reversal).
9. Editable sections in entity dialogs diff against the original state and persist add/update/archive against the polymorphic pattern. The components are `EditableEmailsSection`, `EditablePhoneNumbersSection`, `EditableAddressesSection`, and `EditableTaxIdentifiersSection`.

---

### 3.3 Projects  [core]

#### 3.3.1 Overview

The Projects module owns the full project lifecycle. It covers projects, the units (deliverables) under each project, the tasks that drive schedule, the cost items that drive estimate, change orders that adjust scope, and templates that act as reusable project blueprints. Every cost line, AP invoice line, AR invoice line, and journal entry posted by another module ultimately rolls up to a project here.

#### 3.3.2 Data Tables

##### 3.3.2.1 Projects

###### 3.3.2.1.1 `projects`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `tenant_id` | uuid | Not null. |
| `company_id` | uuid | FK to `companies` (RESTRICT). |
| `address_id` | uuid | FK to `addresses` (SET NULL). |
| `project_code` | varchar(32) | Unique per tenant. Auto-numbered when numbering is enabled. |
| `name` | varchar(255) | Project name. |
| `description` | text | Description. |
| `notes` | text | Internal notes. |
| `status` | varchar(20) | `planning` → `budgeting` → `released` → `complete`. CHECK also allows `on_hold`. |
| `contract_amount` | numeric(14,2) | Total contract value from clients (used for profitability). |

###### 3.3.2.1.2 `project_clients`

Junction table associating multiple clients with a project (replaces a single `client_id` FK).

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `project_id` | uuid | FK to `projects` (CASCADE). |
| `client_id` | uuid | FK to `clients` (RESTRICT). |
| `role` | varchar(32) | e.g., `buyer`, `co-buyer`, `guarantor`. |
| `is_primary` | boolean | Primary client on the contract. |

Unique `(project_id, client_id)`.

##### 3.3.2.2 Units

###### 3.3.2.2.1 `units`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `project_id` | uuid | FK to `projects` (CASCADE). |
| `template_unit_id` | uuid | FK to `template_units` (SET NULL). |
| `version_used` | integer | Template version used at creation. |
| `name` | varchar(128) | Unit name. |
| `unit_code` | varchar(32) | Unique per project. |
| `status` | varchar(20) | `draft` → `released` → `complete`. |

##### 3.3.2.3 Tasks & Task Groups

###### 3.3.2.3.1 `task_groups`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `tenant_id` | uuid | Not null, immutable. |
| `code` | varchar(16) | Unique per tenant. |
| `name` | varchar(64) | Group name. |
| `description` | text | Description. |
| `sort_order` | integer | Display order (default 0). |

###### 3.3.2.3.2 `tasks_master`

Tenant-level library of task definitions.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `tenant_id` | uuid | Not null, immutable. |
| `code` | varchar(16) | Unique per tenant. |
| `task_group_code` | varchar(16) | Composite FK `(tenant_id, task_group_code)` → `task_groups(tenant_id, code)` (added via ALTER TABLE in migration). |
| `name` | varchar(128) | Task name. |
| `default_duration_days` | integer | Default duration. |

###### 3.3.2.3.3 `tasks`

Unit-level task instances.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `unit_id` | uuid | FK to `units` (CASCADE). |
| `task_code` | varchar(16) | Reference to `tasks_master`. |
| `name` | varchar(128) | Task name. |
| `duration_days` | integer | Duration. |
| `status` | varchar(20) | `pending` → `in_progress` → `complete`. CHECK also allows `on_hold`. |
| `parent_task_id` | uuid | Self-referential for hierarchy. |

##### 3.3.2.4 Cost Items

###### 3.3.2.4.1 `cost_items`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `task_id` | uuid | FK to `tasks` (CASCADE). |
| `item_code` | varchar(16) | Cost item code. |
| `description` | varchar(255) | Description. |
| `cost_class` | varchar(16) | `labor`, `material`, `subcontract`, `equipment`, `other`. |
| `cost_source` | varchar(16) | `budget`, `change_order`. |
| `quantity` | numeric(12,4) | Quantity. |
| `unit_cost` | numeric(12,4) | Unit cost. |
| `amount` | numeric(12,2) | GENERATED — `quantity * unit_cost`. |

##### 3.3.2.5 Change Orders

###### 3.3.2.5.1 `change_orders`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `unit_id` | uuid | FK to `units` (CASCADE). |
| `co_number` | varchar(16) | Change order number. |
| `title` | varchar(128) | Title. |
| `reason` | text | Justification. |
| `status` | varchar(20) | `draft` → `submitted` → `approved` \| `rejected` → `posted`. Rejection returns to `draft` for revision (transient). Approval and posting are separate actions. |
| `total_amount` | numeric(12,2) | Total change amount. |
| `submitted_by` | uuid | FK to `portal_users`. Set when status transitions to `submitted`. Null in `draft`. |
| `submitted_at` | timestamptz | Set when status transitions to `submitted`. |
| `posted_by` | uuid | FK to `portal_users`. Set when status transitions to `posted`. |
| `posted_at` | timestamptz | Set when status transitions to `posted`. |

Approval and rejection actors live in the `approvals` audit table (§3.1.2.5) — a system-level table shared across modules. The CO row tracks the submitter and the eventual poster; everything in between is reconstructed from the audit table, which captures the full history including rejections and re-submissions.

##### 3.3.2.6 Templates

Templates are reusable blueprints used to create new projects.

| Table | Purpose |
| --- | --- |
| `template_units` | Blueprint units (`name`, `version`, `status`). |
| `template_tasks` | Blueprint tasks (`task_code`, `name`, `duration_days`, `parent_code` hierarchy). |
| `template_cost_items` | Blueprint cost items (cost class, source, quantity, unit cost, generated amount). |
| `template_change_orders` | Blueprint change orders. |

#### 3.3.3 API

All endpoints under `/api/projects/v1/` use standard CRUD (§4.1) unless noted.

| Method | Path | Description |
| --- | --- | --- |
| CRUD | `/api/projects/v1/projects` | Manage projects. |
| CRUD | `/api/projects/v1/project-clients` | Manage project ↔ client assignments. |
| CRUD | `/api/projects/v1/units` | Manage units. |
| CRUD | `/api/projects/v1/task-groups` | Manage task groups. |
| CRUD | `/api/projects/v1/tasks-master` | Manage the tenant task library. |
| CRUD | `/api/projects/v1/tasks` | Manage unit-level task instances. |
| CRUD | `/api/projects/v1/cost-items` | Manage cost items. |
| CRUD | `/api/projects/v1/change-orders` | Manage change orders. |
| POST | `/api/projects/v1/projects/:id/submit` | Submit a project budget for release approval (`budgeting → budgeting`; records submitter). |
| POST | `/api/projects/v1/projects/:id/approve-release` | Approve the budget release (`budgeting → released`). Gated by `project::projects::approve-release`. Self-approval blocked. |
| POST | `/api/projects/v1/projects/:id/reject-release` | Reject the budget release. Project returns to `budgeting`. Requires `reason`. |
| POST | `/api/projects/v1/change-orders/:id/submit` | Submit CO for approval (`draft → submitted`). Records submitter. |
| POST | `/api/projects/v1/change-orders/:id/approve` | Approve CO (`submitted → approved`). Self-approval blocked. |
| POST | `/api/projects/v1/change-orders/:id/reject` | Reject CO (`submitted → draft`). Requires `reason`. |
| POST | `/api/projects/v1/change-orders/:id/post` | Post approved CO (`approved → posted`). Applies CO to budget and fires GL hooks per ADR-0019. Separate permission from approval. |
| CRUD | `/api/projects/v1/template-units` | Manage blueprint units. |
| CRUD | `/api/projects/v1/template-tasks` | Manage blueprint tasks. |
| CRUD | `/api/projects/v1/template-cost-items` | Manage blueprint cost items. |
| CRUD | `/api/projects/v1/template-change-orders` | Manage blueprint change orders. |

#### 3.3.4 Business Rules

1. A project's `status` advances through `planning` → `budgeting` → `released` → `complete`, with `on_hold` as an interrupt at any point.
2. Units are project-scoped. Each unit has its own task tree and cost items.
3. Tasks are created from `tasks_master` to inherit defaults; subsequent edits diverge from the master without affecting other units.
4. **Budget release requires approval.** The `budgeting → released` transition is a two-step workflow. A user with `project::projects::submit` submits the budget; a user with `project::projects::approve-release` approves it. The submitter cannot also approve (self-approval blocked). On approval the project moves to `released` and the action is recorded in the `approvals` audit table. Rejection returns the project to `budgeting` with the rejection reason captured in the audit table.
5. **Budgets are locked once released.** Direct edits to budget figures on a released project are not permitted. Budget changes flow only through approved-and-posted change orders.
6. **Change order lifecycle.** A CO progresses through `draft → submitted → approved | rejected → posted`. Each transition is an explicit action with a dedicated endpoint and permission (see §3.3.3). Rejection returns the CO to `draft` for revision (transient, not terminal). Approval and posting are separate actions — approval validates the CO; posting (a distinct permission) applies it to the budget and fires GL hooks per [ADR-0019](./decisions/0019-cross-module-posting-contract.md). Self-approval is blocked.
7. Change order lines reference the base `cost_line_id` when modifying existing scope. Posted change orders adjust remaining budget and variance metrics. Negative quantities or costs represent scope reductions.
8. **Approval audit.** Every approval-workflow transition (submit, approve, reject, post) writes one row to the system-level `approvals` table (§3.1.2.5) capturing actor (`created_by`), timestamp (`created_at`), prior and new status, and optional reason (required on reject). The table is append-only at the application layer; no PATCH/PUT endpoint is exposed.
9. Templates produce snapshots at create time. `units.version_used` records which template version a unit was created from; subsequent template edits do not retroactively change live units.
10. Project numbering uses `tenant_numbering_config.id_type = 'project'` (see §3.1.4.5).
11. **Add-on hooks (architecture committed, implementation deferred).** Add-on modules may extend project and change-order workflows by registering synchronous in-process hooks at named transition points (e.g. `beforeChangeOrderPost`, `afterProjectRelease`). Hooks run inside the parent transaction; a hook that throws blocks the transition. The architectural decision is recorded in [ADR-0031](./decisions/0031-add-on-hooks.md), which partially supersedes ADR-0028 on the question of workflow extension. The concrete hook contract (registration API, hook-point catalogue, ordering rules) lands with the first add-on that requires a hook.
12. **Notifications (future dependency).** The approval workflow is incomplete without (a) notifying approvers when a submission is awaiting them and (b) notifying submitters of approval/rejection outcomes. A tenant notification system does not yet exist. Until it does, approvers must check pending items manually via the `GET /api/approvals/v1/approvals` list (§3.1.3.4) or a UI dashboard.

---

### 3.4 Activities & Cost Management  [core]

#### 3.4.1 Overview

The Activities module owns categorical cost tracking. Categories and activities classify what work is being done. Deliverables and assignments scope the work to projects and people. Budgets allocate spend per `(deliverable, activity)`. Cost lines record planned spend. Actual costs record what was incurred. Vendor parts hold the per-vendor pricing reference used to populate cost lines. Approving an actual cost posts to GL via the cross-module posting contract.

#### 3.4.2 Data Tables

##### 3.4.2.1 Categories & Activities

###### 3.4.2.1.1 `categories`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `code` | varchar(16) | Unique code. |
| `name` | varchar(64) | Category name (e.g., "Framing", "Plumbing"). |
| `type` | varchar(16) | `labor`, `material`, `subcontract`, `equipment`, `other`. |

###### 3.4.2.1.2 `activities`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `category_id` | uuid | FK to `categories` (CASCADE). |
| `code` | varchar(16) | Unique activity code. |
| `name` | varchar(64) | Activity name. |
| `is_active` | boolean | Default true. |

##### 3.4.2.2 Deliverables & Assignments

###### 3.4.2.2.1 `deliverables`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `name` | varchar(128) | Deliverable name. |
| `description` | text | Description. |
| `status` | varchar(20) | `pending` → `released` → `finished` → `canceled`. |
| `start_date` | date | Timeline start. |
| `end_date` | date | Timeline end. |

###### 3.4.2.2.2 `deliverable_assignments`

| Column | Type | Notes |
| --- | --- | --- |
| `deliverable_id` | uuid | FK to `deliverables` (CASCADE). |
| `project_id` | uuid | FK to `projects` (CASCADE). |
| `employee_id` | uuid | FK to `employees` (SET NULL). |
| `notes` | text | Assignment notes. |

##### 3.4.2.3 Budgets

###### 3.4.2.3.1 `budgets`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `deliverable_id` | uuid | FK to `deliverables` (CASCADE). |
| `activity_id` | uuid | FK to `activities` (CASCADE). |
| `budgeted_amount` | numeric(12,2) | Amount. |
| `version` | integer | Default 1. |
| `is_current` | boolean | Default true. |
| `status` | varchar(20) | `draft` → `submitted` → `approved` → `locked` → `rejected`. |
| `submitted_by` / `submitted_at` | uuid / timestamptz | Submission audit. |
| `approved_by` / `approved_at` | uuid / timestamptz | Approval audit. |

##### 3.4.2.4 Cost Lines

###### 3.4.2.4.1 `cost_lines`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `company_id` | uuid | FK to `companies` (RESTRICT). |
| `deliverable_id` | uuid | FK to `deliverables` (CASCADE). |
| `vendor_id` | uuid | FK to `vendors` (SET NULL). |
| `activity_id` | uuid | FK to `activities` (CASCADE). |
| `budget_id` | uuid | FK to `budgets` (SET NULL). |
| `tenant_sku` | varchar(64) | SKU reference. |
| `source_type` | varchar(16) | `material` or `labor`. |
| `quantity` | numeric(12,4) | Quantity. |
| `unit_price` | numeric(12,4) | Unit price. |
| `amount` | numeric(12,2) | GENERATED — `quantity * unit_price`. |
| `markup_pct` | numeric(5,2) | Markup percentage. |
| `status` | varchar(20) | `draft` → `locked` → `change_order`. |

##### 3.4.2.5 Actual Costs

###### 3.4.2.5.1 `actual_costs`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `activity_id` | uuid | FK to `activities` (CASCADE). |
| `project_id` | uuid | FK to `projects` (SET NULL). Links cost to project for profitability. |
| `amount` | numeric(12,2) | Cost amount. |
| `currency` | varchar(3) | Currency code. |
| `reference` | text | Invoice or source reference. |
| `approval_status` | varchar(20) | `pending` → `approved` → `rejected`. |
| `incurred_on` | date | Date cost was incurred. |

##### 3.4.2.6 Vendor Parts

###### 3.4.2.6.1 `vendor_parts`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `vendor_id` | uuid | FK to `vendors` (CASCADE). |
| `vendor_sku` | varchar(64) | Vendor's SKU. |
| `tenant_sku` | varchar(64) | Internal tenant SKU. |
| `unit_cost` | numeric(12,4) | Unit cost. |
| `currency` | varchar(3) | Currency code. |
| `markup_pct` | numeric(5,2) | Markup percentage. |
| `is_active` | boolean | Default true. |

#### 3.4.3 API

All endpoints under `/api/activities/v1/` provide standard CRUD (§4.1).

| Method | Path | Description |
| --- | --- | --- |
| CRUD | `/api/activities/v1/categories` | Manage categories. |
| CRUD | `/api/activities/v1/activities` | Manage activities. |
| CRUD | `/api/activities/v1/deliverables` | Manage deliverables. |
| CRUD | `/api/activities/v1/deliverable-assignments` | Manage deliverable assignments. |
| CRUD | `/api/activities/v1/budgets` | Manage budgets. |
| CRUD | `/api/activities/v1/cost-lines` | Manage cost lines. |
| CRUD | `/api/activities/v1/actual-costs` | Manage actual costs. |
| CRUD | `/api/activities/v1/vendor-parts` | Manage vendor parts. |

#### 3.4.4 Business Rules

1. Budgets must be approved before their parent unit can be marked `released`.
2. Approved budget versions are read-only. New changes spawn a new version.
3. `remaining_budget` and `spent_to_date` are maintained by triggers and services as cost lines and actual costs are added.
4. Default actual-cost state is `pending`. Approval is subject to budget and tolerance checks.
5. An actual cost can be approved only when its parent unit is `released` and its cost line exists and is approved.
6. Amounts cannot exceed approved budget plus tolerance unless covered by an approved change order.
7. Approving an actual cost triggers GL posting — debit expense / WIP, credit AP / accrual — via the cross-module posting contract (see [ADR-0019](./decisions/0019-cross-module-posting.md)).
8. `cost_lines.amount` is a database-generated column; never set it directly.
9. Vendor parts seed cost-line `unit_price` and `markup_pct` defaults when a buyer selects a `(vendor, vendor_sku)` pair.

---

### 3.5 Accounts Payable  [core]

#### 3.5.1 Overview

Accounts Payable (AP) owns vendor invoices, invoice lines, payments, and credit memos. Approving an invoice posts to GL (AP Liability ↔ Expense/WIP) via the cross-module posting contract. When a project is linked, the invoice amount feeds into the project's cashflow outflow metrics.

#### 3.5.2 Data Tables

##### 3.5.2.1 AP Invoices

###### 3.5.2.1.1 `ap_invoices`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `company_id` | uuid | FK to `companies` (RESTRICT). |
| `vendor_id` | uuid | FK to `vendors` (RESTRICT). |
| `project_id` | uuid | FK to `projects` (SET NULL). Required for project cashflow tracking. |
| `invoice_number` | varchar(64) | Invoice number. Auto-numbered on transition to `approved` (see §3.1.4.5). |
| `invoice_date` | date | Invoice date. |
| `due_date` | date | Payment due date. |
| `total_amount` | numeric(14,2) | Total amount. |
| `currency` | varchar(3) | Currency code (default `USD`). |
| `status` | varchar(20) | `open` → `approved` → `paid` → `voided`. |
| `notes` | text | Internal notes. |

##### 3.5.2.2 AP Invoice Lines

###### 3.5.2.2.1 `ap_invoice_lines`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `invoice_id` | uuid | FK to `ap_invoices` (CASCADE). |
| `cost_line_id` | uuid | FK to `cost_lines` (SET NULL). |
| `activity_id` | uuid | FK to `activities` (SET NULL). |
| `account_id` | uuid | FK to `chart_of_accounts` (RESTRICT). |
| `description` | text | Line description. |
| `amount` | numeric(12,2) | Line amount. |

##### 3.5.2.3 Payments

###### 3.5.2.3.1 `payments`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `vendor_id` | uuid | FK to `vendors` (RESTRICT). |
| `ap_invoice_id` | uuid | FK to `ap_invoices` (SET NULL). |
| `payment_date` | date | Payment date. |
| `amount` | numeric(14,2) | Payment amount. |
| `method` | varchar(24) | `check`, `ach`, or `wire`. Enforced by `paymentsController` (`VALID_METHODS`) — values outside the allowlist return 400. Controller-level enforcement; no CHECK constraint. |
| `reference` | varchar(64) | Check number or external reference. |
| `notes` | text | Internal notes. |

##### 3.5.2.4 Credit Memos

###### 3.5.2.4.1 `ap_credit_memos`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `vendor_id` | uuid | FK to `vendors` (RESTRICT). |
| `ap_invoice_id` | uuid | FK to `ap_invoices` (SET NULL). |
| `credit_number` | varchar(64) | Credit memo number. |
| `credit_date` | date | Credit date. |
| `amount` | numeric(14,2) | Credit amount. |
| `reason` | text | Reason for credit. |
| `status` | varchar(20) | `open` → `applied` → `voided`. |

#### 3.5.3 API

All endpoints under `/api/ap/v1/` provide standard CRUD (§4.1).

| Method | Path | Description |
| --- | --- | --- |
| CRUD | `/api/ap/v1/ap-invoices` | Manage AP invoices. |
| CRUD | `/api/ap/v1/ap-invoice-lines` | Manage AP invoice lines. |
| CRUD | `/api/ap/v1/payments` | Manage vendor payments. |
| CRUD | `/api/ap/v1/ap-credit-memos` | Manage AP credit memos. |

#### 3.5.4 Business Rules

1. Approving an invoice requires every line to map to a valid GL account and (optionally) a cost line.
2. Approving an invoice posts to GL — debit Expense/WIP, credit AP Liability — via the cross-module posting contract (see [ADR-0019](./decisions/0019-cross-module-posting.md)) and updates the vendor balance.
3. Invoice numbering is auto-assigned on `status` transition to `approved` if `invoice_number` is empty. The scope is `company_id` per §3.1.4.5 — each company has its own running sequence.
4. Remaining balance is computed as `total_amount − SUM(payments) − SUM(applied credit memos)`. It is not stored.
5. When `project_id` is set, the invoice amount feeds into project cashflow outflow metrics (§3.8).
6. Payment `method` is restricted to `check`, `ach`, `wire` by controller-level allowlist — invalid values return 400.
7. Credit memos may be applied against the originating invoice or held open and applied later; status `voided` removes them from open-credit calculations.

---

### 3.6 Accounts Receivable  [core]

#### 3.6.1 Overview

Accounts Receivable (AR) owns client invoices, invoice lines, and receipts. AR is the primary revenue source for project profitability tracking. Approving an invoice (transition to `sent`) posts to GL via the cross-module contract: debit AR, credit Revenue. Construction subdivision-sales workflows use closing statements in the `contracts` add-on, not AR invoices. See §3.13.

#### 3.6.2 Data Tables

##### 3.6.2.1 AR Invoices

###### 3.6.2.1.1 `ar_invoices`

| Field              | Type          | Description                                                        |
| ------------------ | ------------- | ------------------------------------------------------------------ |
| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `company_id` | uuid | FK to `companies` (RESTRICT). |
| `client_id` | uuid | FK to `clients` (RESTRICT). |
| `project_id` | uuid | FK to `projects` (SET NULL). Required for project revenue tracking. |
| `deliverable_id` | uuid | FK to `deliverables` (SET NULL). |
| `invoice_number` | varchar(32) | Invoice number. Auto-numbered on transition to `sent` (see §3.1.4.5). |
| `invoice_date` | date | Invoice date. |
| `due_date` | date | Due date. |
| `total_amount` | numeric(14,2) | Total amount. |
| `currency` | varchar(3) | Currency code (default `USD`). |
| `status` | varchar(20) | `open` → `sent` → `paid` → `voided`. |
| `notes` | text | Internal notes. |

##### 3.6.2.2 AR Invoice Lines

###### 3.6.2.2.1 `ar_invoice_lines`

| Column | Type | Notes |
| --- | --- | --- |
| `invoice_id` | uuid | FK to `ar_invoices` (CASCADE). |
| `account_id` | uuid | FK to `chart_of_accounts` (RESTRICT). |
| `description` | text | Line description. |
| `amount` | numeric(14,2) | Line amount. |

##### 3.6.2.3 Receipts

###### 3.6.2.3.1 `receipts`

| Column | Type | Notes |
| --- | --- | --- |
| `client_id` | uuid | FK to `clients` (RESTRICT). |
| `ar_invoice_id` | uuid | FK to `ar_invoices` (SET NULL). |
| `receipt_date` | date | Receipt date. |
| `amount` | numeric(14,2) | Receipt amount. |
| `method` | varchar(24) | `check`, `ach`, or `wire`. Enforced by `receiptsController` (`VALID_METHODS`) — values outside the allowlist return 400. Controller-level enforcement; no CHECK constraint. |
| `reference` | varchar(64) | Reference number. |
| `notes` | text | Internal notes. |

#### 3.6.3 API

| Method | Path | Description |
| --- | --- | --- |
| CRUD | `/api/ar/v1/ar-invoices` | Manage AR invoices. |
| PUT | `/api/ar/v1/ar-invoices/approve` | Approve invoice (sets status to `sent`). RBAC-gated: `ar::ar-invoices::approve` at `full`. |
| CRUD | `/api/ar/v1/ar-invoice-lines` | Manage AR invoice lines. |
| CRUD | `/api/ar/v1/receipts` | Manage receipts. |

#### 3.6.4 Business Rules

1. Approving an invoice (`PUT /approve`) transitions status to `sent`, posts the GL entry (debit AR, credit Revenue) via the cross-module posting contract, and triggers invoice numbering if `invoice_number` is empty.
2. Invoice numbering scope is `company_id` (§3.1.4.5) — each company has its own running sequence.
3. Revenue recognition can depend on activity completion percentage or cost thresholds (configured per tenant).
4. Remaining balance is computed as `total_amount − SUM(receipts)`. It is not stored.
5. When `project_id` is set, the invoice feeds into project revenue and cashflow inflow metrics (§3.8).
6. Partial payments and retainage are supported through `receipts` plus the cashflow module's recognition rules.
7. Receipt `method` is restricted to `check`, `ach`, `wire` by controller-level allowlist — invalid values return 400.
8. Construction subdivision sales do **not** flow through `ar_invoices`. They use closing statements owned by the `contracts` add-on. A closing statement posts a single GL entry touching AR, WIP, inventory, and (where applicable) intercompany accounts via the same cross-module contract. The core `ar` module is not modified. See [ADR-0019](./decisions/0019-cross-module-posting.md).

---

### 3.7 Accounting & General Ledger  [core]

#### 3.7.1 Overview

The Accounting module owns the chart of accounts, journal entries and lines, ledger balances, the posting queue, the category-to-account mapping, and intercompany accounting. Every other module that touches money (AP, AR, Activities, Contracts) posts here via the cross-module posting contract ([ADR-0019](./decisions/0019-cross-module-posting.md)). Accounting itself does not source events from external systems.

#### 3.7.2 Data Tables

##### 3.7.2.1 Chart of Accounts

###### 3.7.2.1.1 `chart_of_accounts`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `code` | varchar(16) | Account code. |
| `name` | varchar(64) | Account name. |
| `type` | varchar(16) | Intended values: `asset`, `liability`, `equity`, `income`, `expense`, `cash`, `bank`. No CHECK constraint; values are enforced by controller validation. |
| `is_active` | boolean | Default true. |
| `cash_basis` | boolean | Default false. |
| `bank_account_number` | varchar(32) | For cash/bank account types. |
| `routing_number` | varchar(16) | Bank routing. |
| `bank_name` | varchar(64) | Bank name. |

##### 3.7.2.2 Journal Entries & Lines

###### 3.7.2.2.1 `journal_entries`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `company_id` | uuid | FK to `companies` (RESTRICT). |
| `project_id` | uuid | FK to `projects` (SET NULL). Enables project-level GL analysis. |
| `entry_date` | date | Entry date. |
| `description` | text | Description. |
| `status` | varchar(16) | `pending` → `posted` → `reversed`. |
| `source_type` | varchar(32) | `activity_actual`, `invoice`, `payment`, etc. |
| `source_id` | uuid | Reference to the source record in the originating module. |
| `corrects_id` | uuid | Self-ref FK for reversals (SET NULL). |

###### 3.7.2.2.2 `journal_entry_lines`

| Column | Type | Notes |
| --- | --- | --- |
| `entry_id` | uuid | FK to `journal_entries` (CASCADE). |
| `account_id` | uuid | FK to `chart_of_accounts` (RESTRICT). |
| `debit` | numeric(12,2) | Debit amount (default 0). |
| `credit` | numeric(12,2) | Credit amount (default 0). |
| `memo` | text | Line memo. |
| `related_table` | varchar(32) | Polymorphic reference table. |
| `related_id` | uuid | Polymorphic reference id. |

##### 3.7.2.3 Ledger Balances

###### 3.7.2.3.1 `ledger_balances`

| Column | Type | Notes |
| --- | --- | --- |
| `account_id` | uuid | FK to `chart_of_accounts` (RESTRICT). |
| `as_of_date` | date | Balance date. |
| `balance` | numeric(14,2) | Account balance. |

##### 3.7.2.4 Posting Queues

###### 3.7.2.4.1 `posting_queues`

| Column | Type | Notes |
| --- | --- | --- |
| `journal_entry_id` | uuid | FK to `journal_entries` (CASCADE). |
| `status` | varchar(16) | `pending` → `posted` → `failed`. |
| `error_message` | text | Error details on failure. |
| `processed_at` | timestamptz | Processing timestamp. |

##### 3.7.2.5 Category-Account Map

###### 3.7.2.5.1 `category_account_map`

Maps cost categories to GL accounts with date-range validity.

| Column | Type | Notes |
| --- | --- | --- |
| `category_id` | uuid | FK to `categories` (RESTRICT). |
| `account_id` | uuid | FK to `chart_of_accounts` (RESTRICT). |
| `valid_from` | date | Effective start date. |
| `valid_to` | date | Effective end date. |

##### 3.7.2.6 Intercompany

###### 3.7.2.6.1 `company_accounts`

| Column | Type | Notes |
| --- | --- | --- |
| `source_company_id` | uuid | FK to `companies` (RESTRICT). |
| `target_company_id` | uuid | FK to `companies` (RESTRICT). |
| `inter_company_account_id` | uuid | FK to `chart_of_accounts` (RESTRICT). |
| `is_active` | boolean | Default true. |

Unique `(tenant_id, source_company_id, target_company_id)`.

###### 3.7.2.6.2 `company_transactions`

| Column | Type | Notes |
| --- | --- | --- |
| `source_company_id` | uuid | FK to `companies` (RESTRICT). |
| `target_company_id` | uuid | FK to `companies` (RESTRICT). |
| `source_journal_entry_id` | uuid | FK to `journal_entries` (SET NULL). |
| `target_journal_entry_id` | uuid | FK to `journal_entries` (SET NULL). |
| `module` | varchar(32) | Intended values: `ar`, `ap`, `je`. No CHECK constraint. |
| `amount` | numeric(14,2) | Transaction amount (default 0). |
| `status` | varchar(16) | `pending` → `posted` → `reversed` (default `pending`). |
| `is_eliminated` | boolean | Elimination flag for consolidated reporting (default false). |
| `description` | text | Transaction description. |

###### 3.7.2.6.3 `internal_transfers`

| Column | Type | Notes |
| --- | --- | --- |
| `from_account_id` | uuid | FK to `chart_of_accounts` (RESTRICT). |
| `to_account_id` | uuid | FK to `chart_of_accounts` (RESTRICT). |
| `transfer_date` | date | Transfer date. |
| `amount` | numeric(12,2) | Transfer amount. |
| `description` | text | Transfer description. |

#### 3.7.3 API

All endpoints under `/api/accounting/v1/` provide standard CRUD (§4.1) unless noted.

| Method | Path | Description |
| --- | --- | --- |
| CRUD | `/api/accounting/v1/chart-of-accounts` | Manage the chart of accounts. |
| CRUD | `/api/accounting/v1/journal-entries` | Manage journal entries. |
| POST | `/api/accounting/v1/journal-entries/post` | Post pending journal entries (`status` → `posted`). |
| POST | `/api/accounting/v1/journal-entries/reverse` | Reverse posted entries (creates correcting entry via `corrects_id`). |
| CRUD | `/api/accounting/v1/journal-entry-lines` | Manage journal entry lines. |
| CRUD | `/api/accounting/v1/ledger-balances` | Manage ledger balances. |
| CRUD | `/api/accounting/v1/posting-queues` | Manage the posting queue. |
| CRUD | `/api/accounting/v1/category-account-map` | Manage category → GL account mappings. |
| CRUD | `/api/accounting/v1/company-accounts` | Manage intercompany account pairs. |
| CRUD | `/api/accounting/v1/company-transactions` | Manage intercompany transactions. |
| CRUD | `/api/accounting/v1/internal-transfers` | Manage internal transfers. |

#### 3.7.4 Business Rules

1. Every journal entry must balance: `SUM(debit) = SUM(credit)`. Insertion of an unbalanced entry fails validation.
2. Fiscal-period validation is planned but not yet implemented — the `fiscal_periods` table does not exist.
3. `corrects_id` is self-referential and supports reversal chains. A reversal posts the inverse entry and links back to the original.
4. The `category_account_map` resolves a `(category, date)` to the active `account_id`. Multiple rows per category may be active over time; lookup picks the row where `entry_date BETWEEN valid_from AND valid_to`.
5. Intercompany transactions create paired journal entries (due-to / due-from) and carry an `is_eliminated` flag. Consolidation reporting eliminates flagged transactions from tenant-level P&L and balance sheet.
6. The posting queue is the single asynchronous serialization point. Cross-module posters write to the queue; an accounting-side worker drains the queue, posts entries, and writes failures to `error_message` with a `failed` status for retry.

---

### 3.8 Cashflow & Profitability  [core]

#### 3.8.1 Overview

The Cashflow & Profitability module derives revenue, cost, and cash-position metrics from existing transactional data. There are no separate cashflow tables. It joins AR invoices, receipts, AP invoices, payments, actual costs, and journal entries on `project_id`. From those joins it produces per-project profitability, monthly cashflow time series, category cost breakdowns, and aging reports. Project managers see real-time margin and budget variance. CFOs see consolidated company cashflow and forecasted cash position.

#### 3.8.2 Data Tables & Views

##### 3.8.2.1 Data linkage model

```
PROJECT PROFITABILITY = Revenue (AR) − Costs (AP + Actual Costs)

Revenue Sources (Inflows):
  ├── ar_invoices         WHERE project_id = ? AND status IN ('sent','paid')
  ├── receipts            JOIN ar_invoices WHERE project_id = ?
  └── journal_entry_lines WHERE account.type = 'income' AND entry.project_id = ?

Cost Sources (Outflows):
  ├── ap_invoices         WHERE project_id = ? AND status IN ('approved','paid')
  ├── payments            JOIN ap_invoices WHERE project_id = ?
  ├── actual_costs        WHERE project_id = ? AND approval_status = 'approved'
  └── journal_entry_lines WHERE account.type = 'expense' AND entry.project_id = ?
```

##### 3.8.2.2 Metrics

| Metric | Calculation |
| --- | --- |
| Contract Value | `projects.contract_amount` |
| Invoiced Revenue | SUM `ar_invoices.total_amount` WHERE `project_id` AND status IN (`sent`, `paid`) |
| Collected Revenue | SUM `receipts.amount` JOIN `ar_invoices` WHERE `project_id` |
| Outstanding AR | Invoiced Revenue − Collected Revenue |
| Total Budgeted Cost | SUM `cost_items.amount` + approved change orders |
| Committed Cost | SUM `ap_invoices.total_amount` WHERE `project_id` AND status IN (`approved`, `paid`) |
| Actual Spend | SUM `actual_costs.amount` WHERE `project_id` AND approved |
| Cash Out | SUM `payments.amount` JOIN `ap_invoices` WHERE `project_id` |
| Gross Profit | Invoiced Revenue − Committed Cost |
| Gross Margin % | (Gross Profit / Invoiced Revenue) × 100 |
| Net Cashflow | Collected Revenue − Cash Out |
| Budget Variance | Total Budgeted Cost − Actual Spend |
| Estimated Cost at Completion | Actual Spend + Remaining Budget (uncommitted) |
| Projected Profit | Contract Value − Estimated Cost at Completion |
| Projected Margin % | (Projected Profit / Contract Value) × 100 |

##### 3.8.2.3 SQL views

Each tenant schema gets these views at provisioning and updates them via migration.

| View | Purpose |
| --- | --- |
| `vw_project_profitability` | Rolled-up profitability per project (every metric above). Joins projects, ar_invoices, receipts, ap_invoices, payments, actual_costs, cost_items, change_orders. |
| `vw_project_cashflow_monthly` | Monthly inflow/outflow time series per project. Columns: `project_id`, `month`, `inflow`, `outflow`, `actual_cost`, `net_cashflow`, `cumulative_*`. |
| `vw_project_cost_by_category` | Cost breakdown by activity category per project. Joins deliverable_assignments, budgets, activities, categories, actual_costs. |
| `vw_ar_aging` | AR aging buckets per client — current, 1-30, 31-60, 61-90, over 90. |
| `vw_ap_aging` | AP aging buckets per vendor — same five buckets. |

#### 3.8.3 API

All endpoints under `/api/reports/v1/`.

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/reports/v1/project-profitability` | List profitability for all active projects. |
| GET | `/api/reports/v1/project-profitability/:projectId` | Detailed profitability for one project. |
| GET | `/api/reports/v1/project-cashflow/:projectId` | Monthly cashflow time series for a project. |
| GET | `/api/reports/v1/project-cashflow/:projectId/forecast` | Projected cashflow based on AR due dates and AP obligations. |
| GET | `/api/reports/v1/project-cost-breakdown/:projectId` | Cost by category with budget vs. actual. |
| GET | `/api/reports/v1/ar-aging` | AR aging across all clients. |
| GET | `/api/reports/v1/ar-aging/:clientId` | AR aging for a specific client. |
| GET | `/api/reports/v1/ap-aging` | AP aging across all vendors. |
| GET | `/api/reports/v1/ap-aging/:vendorId` | AP aging for a specific vendor. |
| GET | `/api/reports/v1/company-cashflow` | Cashflow aggregated across all projects for a company. UI lives under `/dashboard/cashflow`, not `/reports/*` (see §7). |
| GET | `/api/reports/v1/margin-analysis` | Cross-project margin comparison and trending. |

#### 3.8.4 Business Rules

1. No cashflow data is persisted. Every metric is computed at request time from the underlying transactional tables.
2. Revenue counts only `ar_invoices` with status `sent` or `paid`. Drafts and voided invoices are excluded.
3. Cost counts only `ap_invoices` with status `approved` or `paid`. Pending and voided invoices are excluded.
4. The cashflow forecast uses `ar_invoices.due_date` (unpaid `sent`) and `ap_invoices.due_date` (unpaid `approved`) plus a 30/60/90-day rolling actual-cost burn rate.
5. The profitability dashboard renders summary cards (Contract Value, Invoiced Revenue, Gross Profit, Gross Margin %, Net Cashflow), MUI X bar charts for budget-vs-committed-vs-actual per category, and a status indicator (green / yellow / red) based on budget variance.
6. The cashflow timeline renders a stacked-area chart of monthly inflows vs. outflows plus a cumulative net trend line, with a dashed forecast region for upcoming AR/AP due dates.
7. Aging grids use five buckets (current / 1-30 / 31-60 / 61-90 / over 90) grouped by client (AR) or vendor (AP); they are filterable by project and include a totals summary row.

---
### 3.9 Reporting & Views  [core]

#### 3.9.1 Overview

The Reporting module is a thin layer of SQL views and report endpoints that read across other modules' data. Export views provide consolidated, denormalized rows for spreadsheet export. Financial views (covered in §3.8) drive dashboards. Reporting itself owns no transactional data.

#### 3.9.2 Data Tables & Views

##### 3.9.2.1 Core export views

Created by migration `202502120080_sqlViews` and queried directly by report controllers.

| View | Description |
| --- | --- |
| `vw_export_contacts` | Unified contacts across vendors, clients, and employees with `source_type`. |
| `vw_export_addresses` | Unified addresses across all source types. |
| `vw_export_template_cost_items` | Template cost items with unit name, version, and task hierarchy. |
| `vw_template_tasks_export` | Template tasks with unit name and version. |

##### 3.9.2.2 Financial views

Owned by §3.8 (Cashflow & Profitability) and referenced here for convenience.

| View | Description |
| --- | --- |
| `vw_project_profitability` | Rolled-up profitability metrics per project. |
| `vw_project_cashflow_monthly` | Monthly inflow/outflow time series. |
| `vw_project_cost_by_category` | Cost breakdown by activity category. |
| `vw_ar_aging` | AR aging buckets per client. |
| `vw_ap_aging` | AP aging buckets per vendor. |

##### 3.9.2.3 Budget vs. actual metrics

| Metric | Calculation |
| --- | --- |
| Original Budget | SUM approved `cost_lines.total_cost`. |
| Change Orders | SUM approved `change_order_lines.total_cost`. |
| Actual Costs | SUM `actual_costs.amount` (approved). |
| Total Exposure | Original Budget + Change Orders. |
| Variance (Baseline) | Original Budget − Actual Costs. |
| Variance (Total) | Total Exposure − Actual Costs. |

#### 3.9.3 API

Top-level reporting endpoints live under `/api/reports/v1/`. The cashflow- and profitability-specific endpoints are documented in §3.8.3; this section lists only the non-financial export endpoints.

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/reports/v1/export-contacts` | Export contacts CSV/XLSX from `vw_export_contacts`. |
| GET | `/api/reports/v1/export-addresses` | Export addresses CSV/XLSX from `vw_export_addresses`. |
| GET | `/api/reports/v1/export-template-cost-items` | Export template cost items. |
| GET | `/api/reports/v1/export-template-tasks` | Export template tasks. |

#### 3.9.4 Business Rules

1. Reporting endpoints are read-only and do not write to underlying tables.
2. Views are recreated by migration. Controllers do not modify view definitions at runtime.
3. Budget-vs-actual calculations are based on **approved** records only. Drafts and rejected items are excluded.
4. Cross-module financial reporting (cashflow, profitability) is owned by §3.8; this section's endpoints stop at exports and non-financial views.

---

### 3.10 Shared Tables  [core]

Tables that don't belong to any single business module — they're consumed by several. Grouped here for clarity.

#### 3.10.1 Emails

The `emails` table is the canonical store for email addresses across vendors, vendor contacts, clients, employees, and contacts. It replaces per-entity `email` columns.

##### 3.10.1.1 `emails`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `tenant_id` | uuid | Not null, immutable. |
| `source_id` | uuid | FK to `sources` (CASCADE). Polymorphic link. |
| `email` | varchar(128) | Not null. |
| `label` | varchar(32) | Optional (`work`, `personal`, etc.). |
| `is_primary` | boolean | Default false. Partial unique per `source_id`. |
| `is_login` | boolean | Default false. Marks the email used as the linked `portal_users.email` for entities with `is_app_user = true`. Partial unique per `source_id`. |

Indexes and invariants:
- Partial unique `(email) WHERE deactivated_at IS NULL` — tenant-wide email uniqueness for active rows.
- Partial unique `(source_id) WHERE is_login = true AND deactivated_at IS NULL`.
- Partial unique `(source_id) WHERE is_primary = true AND deactivated_at IS NULL`.
- Partial unique `(source_id, label) WHERE deactivated_at IS NULL AND label IS NOT NULL`.

Endpoint: `/api/core/v1/emails` (standard CRUD). Policy catalog entry `core::emails`. See [ADR-0025](./decisions/0025-import-dedup-partial-unique-indexes.md).

#### 3.10.2 Tenant Preferences

One row per tenant. Tenant-scoped UI and behaviour preferences.

##### 3.10.2.1 `tenant_preferences`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `tenant_id` | uuid | Not null, immutable, unique. |
| `default_page_size` | integer | Not null, default 25. CHECK: between 25 and 1000. |

Endpoint: `/api/core/v1/tenant-preferences` (standard CRUD). Seeded with the default row during tenant provisioning (`tenantPreferencesSeeder.js`).

#### 3.10.3 Countries

ISO 3166-1 alpha-2 country reference list in the **admin** schema. Tenant tables (`phone_numbers`, `addresses`, `tax_identifiers`) FK their `country_code` columns here so non-ISO inputs are rejected at the database level.

##### 3.10.3.1 `admin.countries`

| Column | Type | Notes |
| --- | --- | --- |
| `code` | char(2) | Primary key. ISO 3166-1 alpha-2. Immutable. |
| `name` | varchar(128) | Country name, not null. |
| `dial_code` | varchar(8) | International dialing prefix (e.g., `+1`). |
| `placeholder` | varchar(64) | UI placeholder format hint. |

No API surface. Read directly by the client via the shared country list in `packages/shared`.

#### 3.10.4 Match Review Logs

Audit trail for BOM vendor-SKU matching decisions.

##### 3.10.4.1 `match_review_logs`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `entity_type` | varchar(32) | Entity being matched. |
| `entity_id` | uuid | Entity id. |
| `match_type` | varchar(32) | Type of match. |
| `match_id` | uuid | Matched entity id. |
| `reviewer_id` | uuid | Reviewer user id. |
| `decision` | varchar(16) | `accept`, `reject`, `defer`. |
| `notes` | text | Reviewer notes. |

Endpoint: `/api/tenants/v1/match-review-logs`.

---

### 3.11 Demo Tenants  [in-scope]

Two named demo tenants exercise the full product surface. Both are referenced by name in screenshots, walkthroughs, and seed scripts.

#### 3.11.1 Meridian Group (MG) — Consulting Use Case

##### 3.11.1.1 Profile

Holding company with three legal entities. Professional services and consulting. No construction. No manufacturing. Exists to prove out the core product on a realistic multi-entity services book and to exercise intercompany accounting (§3.7.2.6).

##### 3.11.1.2 Active Modules

| Kind | Modules |
| --- | --- |
| Core | All ten core modules (§3.0.1). |
| Add-on | `contracts`, `scheduling`, `timesheets`. |

##### 3.11.1.3 Data Requirements

Realistic volume for a mid-size consulting firm:

- 3 companies (legal entities under one tenant).
- 20+ projects across the three companies.
- 50+ vendors, 30+ clients, 40+ employees.
- 200+ AP invoices, 150+ AR invoices.
- 500+ journal entries with realistic intercompany activity.

##### 3.11.1.4 Key Workflows

- Project budgeting through the budget approval gate.
- Contract milestones (`contracts` add-on) gating AR invoice generation.
- Timesheet entries flowing into cost lines via the labor cost path.
- Intercompany billing between the three legal entities, with elimination on consolidation.

##### 3.11.1.5 Seed Script Reference

`apps/server/scripts/seedDemoMG.js`. Reproducible — drops and recreates the MG tenant schema, then populates it from fixtures under `apps/server/scripts/fixtures/mg/`.

#### 3.11.2 Sterling Ridge Homes (SRH) — Construction Use Case

##### 3.11.2.1 Profile

Homebuilder and property developer with three companies. Uses construction-specific workflows: unit-level cost tracking, BOM-driven procurement, contracted draw schedules, and subcontractor AP with lien-waiver tracking. Exists to drive out the construction add-on requirements and stress-test the cross-module posting contract.

##### 3.11.2.2 Active Modules

| Kind | Modules |
| --- | --- |
| Core | All ten core modules (§3.0.1). |
| Add-on | `bom`, `contracts`, `scheduling`, `timesheets`, `procurement`, `inventory`. |

##### 3.11.2.3 Data Requirements

Realistic volume for a mid-size homebuilder:

- 3 companies.
- 15+ projects (each with multiple units).
- 80+ vendors, 20+ clients, 30+ employees.
- 300+ AP invoices, 100+ AR invoices.
- 500+ BOM catalog SKUs.
- 200+ vendor SKUs mapped to catalog SKUs.

##### 3.11.2.4 Key Workflows

- Unit-level cost tracking and budget variance reporting.
- BOM-to-PO flow: select catalog SKUs, resolve to vendor SKUs, issue purchase orders through the `procurement` add-on.
- Draw schedule tied to contract deliverables (`contracts` add-on) gating AR closing statements.
- Subcontractor AP with lien-waiver tracking attached to AP invoices.
- Closing-statement posting (revenue, WIP, inventory, intercompany) via the cross-module contract.

##### 3.11.2.5 Seed Script Reference

`apps/server/scripts/seedDemoSRH.js`. Reproducible — drops and recreates the SRH tenant schema, then populates it from fixtures under `apps/server/scripts/fixtures/srh/`.

---

### 3.12 Bill of Materials (BOM)  [add-on]

#### 3.12.1 Overview

The BOM add-on manages material catalogs, vendor SKU matching, and vendor pricing. Catalog SKUs are tenant-curated reference items. Vendor SKUs are pulled from vendor price lists. Each vendor SKU is matched back to a catalog SKU, either manually or via pgvector similarity search. Cost lines select a `(vendor, vendor_sku)` pair and inherit the pricing.

#### 3.12.2 Data Tables

##### 3.12.2.1 Catalog SKUs

###### 3.12.2.1.1 `catalog_skus`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `catalog_sku` | varchar(64) | Unique catalog SKU. |
| `description` | text | Full description. |
| `description_normalized` | text | Normalized for matching. |
| `category` | varchar(64) | Material category. |
| `sub_category` | varchar(64) | Sub-category. |
| `model` | varchar(32) | Embedding model used. |
| `embedding` | vector(3072) | pgvector embedding for similarity search. |

##### 3.12.2.2 Vendor SKUs

###### 3.12.2.2.1 `vendor_skus`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `vendor_id` | uuid | FK to `vendors` (RESTRICT). |
| `vendor_sku` | varchar(64) | Vendor's SKU code. |
| `description` | text | Vendor's description. |
| `description_normalized` | text | Normalized description. |
| `catalog_sku_id` | uuid | FK to `catalog_skus` (SET NULL). The matched catalog SKU. |
| `confidence` | real | Match confidence score (0.0–1.0). |
| `model` | varchar(32) | Embedding model (default `text-embedding-3-large`). |
| `embedding` | vector(3072) | pgvector embedding. |

Custom model methods: `findBySku(vendor_id, vendor_sku)`, `getUnmatched()`, `refreshEmbeddings(batches)`.

##### 3.12.2.3 Vendor Pricing

###### 3.12.2.3.1 `vendor_pricing`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `vendor_sku_id` | uuid | FK to `vendor_skus` (CASCADE). |
| `unit_price` | numeric(12,4) | Price per unit. |
| `unit` | varchar(32) | Unit of measure. |
| `effective_date` | date | Price effective date. |

#### 3.12.3 API

All endpoints under `/api/bom/v1/` provide standard CRUD (§4.1).

| Method | Path | Description |
| --- | --- | --- |
| CRUD | `/api/bom/v1/catalog-skus` | Manage catalog SKUs. |
| CRUD | `/api/bom/v1/vendor-skus` | Manage vendor SKUs. |
| CRUD | `/api/bom/v1/vendor-pricing` | Manage vendor pricing. |

#### 3.12.4 Business Rules

1. The BOM module loads only when `bom` appears in `tenants.allowed_modules` (see §3.0.2).
2. Catalog SKUs are tenant-curated. Vendor SKUs originate from vendor price lists.
3. Matching produces a `vendor_skus.catalog_sku_id` link with a `confidence` score. The match review log (§3.10.4) records every accept/reject/defer decision.
4. Auto-match thresholds are tenant-configurable. Below the lower threshold, matches are deferred for manual review; above the upper threshold, matches auto-accept; in between, they queue for review.
5. Cost lines select a `(vendor, vendor_sku)` pair to inherit pricing (§3.4.4).

---

### 3.13 Contracts  [add-on] [deferred]

#### 3.13.1 Overview

The Contracts add-on owns contract documents and their milestones. Document types include services Statements of Work (SOW), construction subdivision sales, closing statements, and production work orders. Milestones gate AR invoice generation. In construction, they also gate closing-statement posting via the cross-module contract.

#### 3.13.2 Data Tables

Deferred — schema lands when the module graduates from spec to code.

#### 3.13.3 API

Deferred.

#### 3.13.4 Business Rules

Deferred. Construction closing statements post a single GL entry touching AR, WIP, inventory, and intercompany accounts (see §3.6.4 rule 8).

---

### 3.14 Scheduling  [add-on] [deferred]

#### 3.14.1 Overview

The Scheduling add-on owns resource, crew, and milestone scheduling across projects and units. It consumes tasks (§3.3.2.3) and produces a time-phased plan.

#### 3.14.2 Data Tables

Deferred.

#### 3.14.3 API

Deferred.

#### 3.14.4 Business Rules

Deferred.

---

### 3.15 Timesheets  [add-on] [deferred]

#### 3.15.1 Overview

The Timesheets add-on captures labor by employee, project, activity, and date. Approved timesheets generate cost lines on the labor cost path (§3.4.2.4).

#### 3.15.2 Data Tables

Deferred.

#### 3.15.3 API

Deferred.

#### 3.15.4 Business Rules

Deferred.

---

### 3.16 Procurement  [add-on] [deferred]

#### 3.16.1 Overview

The Procurement add-on owns purchase orders, vendor Requests for Quote (RFQs), and expediting. POs draw from BOM catalog and vendor SKUs and feed AP invoice three-way matching.

#### 3.16.2 Data Tables

Deferred.

#### 3.16.3 API

Deferred.

#### 3.16.4 Business Rules

Deferred.

---

### 3.17 Inventory & Warehousing  [add-on] [deferred]

#### 3.17.1 Overview

The Inventory & Warehousing add-on tracks on-hand stock, lot and serial numbers, and project issues. Construction closing statements debit inventory on unit sale (see §3.6.4).

#### 3.17.2 Data Tables

Deferred.

#### 3.17.3 API

Deferred.

#### 3.17.4 Business Rules

Deferred.

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

`withMeta` is not auto-applied by `createRouter`. Each router passes it via per-method middleware arrays (e.g., `getMiddlewares: [meta]`). `rbac()` is not included in the standard CRUD chain. It must be added explicitly on custom endpoints that need per-action permission-level checks. Standard routes can be individually disabled via `disable*` flags (e.g., `disablePost: true`).

### 4.2 Pagination  [in-scope]

Keyset-based pagination via pg-schemata's `findAfterCursor()`:

- `cursor`: Last seen ID/sort value for next page
- `limit`: Page size
- `orderBy`: Sort column(s)
- `columnWhitelist`: Restrict returned columns
- `includeDeactivated`: Include soft-deleted records

### 4.3 Audit Fields  [in-scope]

Most models define `hasAuditFields: { enabled: true, userFields: { type: 'uuid' } }`. The exception is `policy_catalog`, which uses `hasAuditFields: { enabled: false }` because it is seed-only reference data. pg-schemata manages `created_at` and `updated_at` automatically. **Audit actor resolution** (`created_by` / `updated_by`) is handled by the ALS resolver registered through `registerAuditResolver` (see Request-context plumbing below). These columns are no longer threaded through `req.body`. The `addAuditFields` Express middleware keeps its name for historical reasons. It now only injects **tenant context** (`tenant_code` and `tenant_id` from `req.user`) on POST requests, with skip logic for tenant creation and user registration. It still acts as the guard that rejects mutation requests with no user context.

**Request-context plumbing:**

- `apps/server/src/middleware/auditContext.js` — wraps each request in an AsyncLocalStorage context carrying the audit identity. Runs after `authRedis` so `req.user` is hydrated before the store is populated.
- `apps/server/src/lib/requestContext.js` + `apps/server/src/lib/registerAuditResolver.js` — register a tenant-aware resolver with pg-schemata that pulls the current user id from the ALS context. pg-schemata invokes the resolver for every insert and update. As a result, `created_by` and `updated_by` are filled at the model layer regardless of whether the controller touched `req.body`.
- Direct model calls inside services do not need to thread the user id manually. The ALS store carries it as long as the call originated inside an Express request.

### 4.4 Soft Deletes  [in-scope]

Most models define `softDelete: true`. Exceptions: `roles` (`softDelete: false`), `ledger_balances` and `posting_queues` (`softDelete: false` — append-only), `policy_catalog` (`softDelete: false`). pg-schemata automatically excludes records where `deactivated_at IS NOT NULL` from all read queries. Archive and restore are implemented manually in `BaseController` using `model.updateWhere()` — setting or clearing `deactivated_at` directly rather than using pg-schemata's `removeWhere()`/`restoreWhere()` methods.

### 4.5 Validation  [in-scope]

pg-schemata auto-generates Zod validators from schema definitions:

- Insert validation: enforces `notNull` columns, type coercion, immutable fields
- Update validation: excludes `immutable` columns, partial validation
- Custom validators can be attached per-column via `colProps.validator`

### 4.6 Excel Import / Export  [in-scope]

> **ADR Reference:** [ADR-0023](./decisions/0023-excel-import-export.md)

Built into pg-schemata's TableModel and exposed as a full-stack feature across all `createRouter`-generated resources.

#### 4.6.1 Backend

- **Import.** `importFromSpreadsheet(filePath, sheetIndex, callbackFn?, _returning?, { previewOnly })` parses XLSX, validates against schema, and bulk-inserts with audit fields. `BaseController.importXls()` handles file upload via multer (`/tmp/uploads/`) and injects `tenant_code` and `created_by` via the callback. The default commit return shape is `{ inserted: number }` for legacy single-sheet importers, or `{ inserted, updated, ... }` for flat-format importers.
- **Import preview mode (`?preview=1`).** Importers that go through `importSimpleTable` (in `lib/spreadsheetHelpers.js`) or the flat-combined / multi-sheet paths honor `previewOnly`. They return a counts-only classification payload without writing:

  ```json
  { "preview": true, "inserts": 0, "updates": 0, "noops": 0, "omitted": 0, "errors": [] }
  ```

  Flat-combined and multi-sheet variants extend the shape with `restores`, `phones`, `addresses`, `taxIds`, `appUserSkipped` where relevant. `BaseController.importXls` toggles preview when the request carries `?preview=1` or `?preview=true`. Validation errors short-circuit to a 422 with the same `errors` array. Preview and commit see identical row classification, so a clean preview commits without surprises. Preview is honored by ~16 entities on the `importSimpleTable` path plus the Vendors flat-combined path and the Tenants importer. Multi-sheet legacy importers that have not been migrated still write on `?preview=1` (the flag is a no-op for them).
- **Export.** `exportToSpreadsheet(filePath, where?, joinType?, options?)` queries with filtering and writes to XLSX. `ViewController.exportXls()` generates a temp file, sends it via `res.download()`, and cleans up the temp file after transfer. It accepts an optional `where` array and a `joinType` (`AND`/`OR`) in the request body for filtered exports.

**Core Entity Override — Multi-Sheet Import/Export:**

The 5 core entity models (Vendors, Clients, Employees, Contacts, Companies) override the default pg-schemata `importFromSpreadsheet()` / `exportToSpreadsheet()` methods with custom multi-sheet logic via `spreadsheetHelpers.js`. These entities use the polymorphic `sources` pattern with child tables (phone numbers, addresses, tax identifiers), which requires:

- **Export** (`exportSourceEntity`): Queries the parent table, strips internal columns (audit fields, `tenant_id`, `source_id`, `deactivated_at`), appends a derived `status` column, and writes child data (phones, addresses, tax IDs) to separate sheets in a single XLSX workbook via `@nap-sft/tablsx` WorkbookBuilder.
- **Import** (`importSourceEntity`): Parses multi-sheet workbooks and partitions rows into inserts vs. updates by `id` presence. Updates run with soft-delete/restore logic. New records bulk-insert with auto-generated source records and numbering-service codes. When `appUserProvisioning` is enabled, it also provisions `portal_users` login records. Child sheets import via delete-and-reinsert per parent. Returns `{ inserted, updated, phones, addresses, taxIds, appUserSkipped }`.
- **Config-driven**: Each entity defines a `SourceEntityConfig` specifying `entityName`, `sheetName`, `sourceType`, `idType`, `buildLabel`, `boolCols`, `childSheets`, and `appUserProvisioning`.

All other entities (non-source) use the default pg-schemata single-sheet import/export path.

**RBAC Enforcement:**

- Import routes require `rbac('full')` — `setImportAction` overrides `req.resource.action = 'import'` before RBAC resolution
- Export routes require `rbac('view')` — `setExportAction` overrides `req.resource.action = 'export'` before RBAC resolution
- Both routes also enforce `moduleEntitlement`

**Disabling:** Individual resources can disable import/export via `disableImportXls: true` or `disableExportXls: true` in the `createRouter` options.

#### 4.6.2 Frontend

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

#### 4.6.3 Pages with Import / Export

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

#### 6.1.2 Design Tokens

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

### 6.3 Module Bar  [in-scope]

The Module Bar has two zones:

- **Left zone**: Current module name and breadcrumb trail (e.g., `Admin > Manage Employees > Edit`). The module name is derived from the active navigation group; breadcrumbs reflect the current route hierarchy. Breadcrumb segments are currently rendered as plain text (`<Typography>`) — they are not clickable links (all crumbs are constructed with `path: null` in `ModuleBar.jsx`).
- **Right zone**: Dynamic toolbar actions registered by page components via `useModuleToolbarRegistration()`:
  - **Tabs**: Toggle button groups with exclusive/non-exclusive selection
  - **Filters**: Text fields or select dropdowns
  - **Primary Actions**: Action buttons (Create, Edit, Archive, Restore, Import, Export, etc.)

### 6.4 Client Dependencies  [in-scope]

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

**Shared Components (`apps/client/src/components/shared/`):** Concrete inventory of shared components in use today. Additions land via PR — when extracting a new shared component, add it here.

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

### 10.1.1 Single Canonical Names  [in-scope]

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

### 10.4 Code Reuse  [in-scope]

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

### 11.6 Vitest  [in-scope]

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

### 11.7 Vite  [in-scope]

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

### 12.9 Daily Workflow  [in-scope]

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

### 13.1 Purpose  [in-scope]

Architecture Decision Records (ADRs) capture the *why* behind architectural and technical choices. Code shows *what* was built; commit messages show *when*; ADRs explain *why one approach was chosen over alternatives*. Without them, future developers waste time reverse-engineering intent, or worse, undo a deliberate choice without understanding the consequences.

### 13.2 Location  [in-scope]

ADRs live in `docs/decisions/` at the monorepo root:

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
      0029-tenant-restore-admin-reactivation.md
      0030-roles-as-array-on-entity.md
      0031-add-on-hooks.md
    PRD.md                      # This file
```

ADR 0009 is absent from the sequence (skipped). ADRs are append-only and never renumbered.

Rules:

1. ADRs are numbered sequentially (`0001`, `0002`, …) — never renumber.
2. ADRs are append-only — never edit a past ADR; supersede it with a new one.
3. ADRs are committed to the repo — they travel with the code, not in a wiki.

### 13.3 Template  [in-scope]

Every ADR follows this lightweight format:

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

### 13.4 When to Write an ADR  [in-scope]

Write an ADR when:

- Choosing between two or more viable approaches (e.g., ORM choice, auth strategy).
- Adopting a pattern that will be used project-wide (e.g., soft deletes, audit fields).
- Making a choice that would be non-obvious to a new developer reading the code.
- Reversing or changing a previous decision.
- Adding or removing a significant dependency.

Do **not** write an ADR for:

- Obvious choices with no realistic alternatives.
- Implementation details that are easily changed later.
- Bug fixes or routine feature work.

### 13.5 Initial ADRs  [in-scope]

The following ADRs are captured under `docs/decisions/`:

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
| 0028 | Add-on module architecture                                      | Add-ons are coded identically to core modules; `allowed_modules` + registry only — no event bus or plugin layer. |
| 0029 | Tenant restore leaves users locked; admin reactivation is explicit | Restore clears `deactivated_at` on the cohort but not `status`; `POST /tenants/:id/provision-admin` is the only supported re-enable path. |
| 0030 | Role assignments as `text[]` on the entity row                  | No `role_members` junction; assignments mutate via entity CRUD. Lists triggers (per-company role variance, time bounds, approval, audit history) that would justify a refactor. |
| 0031 | Synchronous hooks for add-on modules                            | Add-ons extend core workflows via named, in-transaction, throw-to-block hooks. Partially supersedes ADR-0028. Contract lands with the first add-on that needs a hook. |

### 13.6 Referencing ADRs  [in-scope]

When code implements a non-obvious pattern that traces back to an ADR, reference it:

**In code comments:**

```javascript
// See ADR-0005: keyset pagination chosen over offset for stable large-set performance
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

---

## 14. Scripts  [in-scope]

### 14.1 Conventions  [in-scope]

All operational scripts live under `apps/server/scripts/` and are invoked via the `apps/server` package.json `scripts` block. Three conventions apply:

1. Every script is a top-level Node entry point — `import` from `apps/server/src/`, never required by application code.
2. Every script walks up from `cwd` to find the monorepo `.env`. Run from the repo root or from `apps/server/`; either works.
3. Every script wraps work in `runWithContext` (`apps/server/src/lib/requestContext.js`) so pg-schemata audit fields resolve to a known actor (`null` at boot).

Execute scripts via the npm scripts in `apps/server/package.json` whenever one exists. Falling back to `node` direct invocation is supported but requires `cross-env NODE_ENV=…` set manually.

### 14.2 Migration Scripts  [in-scope]

#### 14.2.1 `setupAdmin.js`

- **Purpose.** Bootstrap the `admin` schema on a fresh database. Creates the schema, installs extensions (`pgcrypto`, `uuid-ossp`, `vector`), runs admin migrations, and seeds the root Axerra tenant plus the bootstrap `super_user`.
- **Usage.** Run once per environment. Subsequent boots are idempotent and skip already-applied steps.
- **Execute.**
  ```bash
  npm -w apps/server run setupAdmin:dev   # development DB
  npm -w apps/server run setupAdmin:test  # test DB
  ```

#### 14.2.2 `runMigrate.js`

- **Purpose.** Drive pending migrations against the admin schema and every active tenant schema. Wraps `migrateTenants.js`.
- **Usage.** Accepts an optional space-separated list of tenant schema names to limit scope. `--dry-run` reports pending migrations without applying them; `NODE_ENV=test` or `--test` implies `--dry-run`.
- **Execute.**
  ```bash
  npm -w apps/server run migrate:dev                # all schemas, dev DB
  npm -w apps/server run migrate:test               # all schemas, test DB (dry-run)
  node apps/server/scripts/runMigrate.js axerra cal # only those two schemas
  node apps/server/scripts/runMigrate.js --dry-run  # report only
  ```

#### 14.2.3 `migrateTenants.js`

- **Purpose.** Library used by `runMigrate.js`. Resolves the module set for each schema via `getModulesForSchema()` and runs only the migrations for those modules. Exported for programmatic use; not a CLI in its own right.

### 14.3 Bootstrap & Seed Scripts  [in-scope]

#### 14.3.1 `seed.js`

- **Purpose.** Seed development data into the dev database (companies, vendors, projects, sample invoices, chart of accounts).
- **Usage.** Idempotent — re-running clears non-system tables and reseeds.
- **Execute.**
  ```bash
  npm -w apps/server run seed
  ```

#### 14.3.2 `seedRbac.js`

- **Purpose.** Seed RBAC reference data (policy catalog, default roles, default policies) into a tenant schema. Re-runs the `policyCatalogReconciler` to sync the in-code `CATALOG_ENTRIES` constant.
- **Usage.** Runs against `NODE_ENV=development` by default.
- **Execute.**
  ```bash
  npm -w apps/server run seed:rbac
  ```

#### 14.3.3 `seedDemoMG.js` *(planned)*

- **Purpose.** Build the Meridian Group demo tenant (§3.11.1). Drops and recreates the MG schema, then loads fixtures from `apps/server/scripts/fixtures/mg/`.
- **Execute.**
  ```bash
  node apps/server/scripts/seedDemoMG.js
  ```

#### 14.3.4 `seedDemoSRH.js` *(planned)*

- **Purpose.** Build the Sterling Ridge Homes demo tenant (§3.11.2). Drops and recreates the SRH schema, then loads fixtures from `apps/server/scripts/fixtures/srh/`.
- **Execute.**
  ```bash
  node apps/server/scripts/seedDemoSRH.js
  ```

### 14.4 Debugging & Diagnostic Scripts  [in-scope]

Debugging scripts live alongside other one-off operational tools and are intentionally undocumented in `package.json` — they're invoked directly. Each prints its own usage with `--help`.

The current diagnostic surface is small; additional scripts land under `apps/server/scripts/diag/` as needs arise.

### 14.5 CLI / Shell Utilities  [in-scope]

#### 14.5.1 `db/provisionTenantCli.js`

- **Purpose.** Run `provisionNewTenant` from the host shell — the same service the HTTP `POST /api/tenants/v1/tenants` endpoint calls. Useful for headless bootstrap and tests that need a fresh tenant outside HTTP.
- **Usage.** Required: `--tenant-code`, `--company`, plus the admin user fields. Optional: `--schema-name`, `--tier`, `--status`.
- **Execute.**
  ```bash
  node apps/server/scripts/db/provisionTenantCli.js \
    --tenant-code CAL \
    --company "Caledonia Holdings" \
    --schema-name cal \
    --tier growth \
    --status active \
    --admin-email admin@caledonia.example \
    --admin-password '…' \
    --admin-first-name Jane \
    --admin-last-name Doe
  ```

#### 14.5.2 `db/reconcilePolicyCatalog.js`

- **Purpose.** Run the policy-catalog reconciler against one tenant schema or all tenants. Performs an idempotent diff/apply between in-code `CATALOG_ENTRIES` and the per-tenant `policy_catalog` table. Use when a hotfix changes the catalog without shipping a migration.
- **Usage.** `--schema <name>` targets a single tenant; omit to walk every active tenant. `--dry-run` reports the planned changes without writing.
- **Execute.**
  ```bash
  node apps/server/scripts/db/reconcilePolicyCatalog.js --schema axerra
  node apps/server/scripts/db/reconcilePolicyCatalog.js --dry-run
  ```
