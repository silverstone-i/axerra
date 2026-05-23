# AXERRA PRD — Table of Contents

Links resolve against [PRD.md](PRD.md). Section numbers match the headings in that document.

## Front matter

- [Scope-tag Legend](PRD.md#scope-tag-legend)

## 1. Overview

- [1.1 Product Positioning](PRD.md#11-product-positioning--in-scope)
- [1.2 Product Vision](PRD.md#12-product-vision--in-scope)
- [1.3 Target Users](PRD.md#13-target-users--in-scope)
- [1.4 Technology Stack](PRD.md#14-technology-stack--in-scope)
- [1.5 Monorepo Structure](PRD.md#15-monorepo-structure--in-scope)

## 2. Architecture

- [2.1 Multi-Tenant Model](PRD.md#21-multi-tenant-model--in-scope)
- [2.2 pg-schemata Integration (Owned Dependency)](PRD.md#22-pg-schemata-integration-owned-dependency--in-scope)
  - [2.2.1 Core Capabilities Used](PRD.md#221-core-capabilities-used)
  - [2.2.2 WHERE Clause Query Operators](PRD.md#222-where-clause-query-operators)
  - [2.2.3 Model Definition Pattern](PRD.md#223-model-definition-pattern)
  - [2.2.4 Database Initialization](PRD.md#224-database-initialization)
  - [2.2.5 Potential pg-schemata Enhancements (Owned Repo)](PRD.md#225-potential-pg-schemata-enhancements-owned-repo)
- [2.3 Application Layout](PRD.md#23-application-layout--in-scope)
- [2.4 Request Flow](PRD.md#24-request-flow--in-scope)
- [2.5 Vertical Add-on Modules](PRD.md#25-vertical-add-on-modules--in-scope)

## 3. Feature Modules

- [3.0 Module Taxonomy](PRD.md#30-module-taxonomy--in-scope)
  - [3.0.1 Core modules (ship with every instance)](PRD.md#301-core-modules-ship-with-every-instance)
  - [3.0.2 Vertical add-on modules](PRD.md#302-vertical-add-on-modules)
  - [3.0.3 Module changes from the May 2026 review](PRD.md#303-module-changes-from-the-may-2026-review)
- [3.1 Authentication & Authorization (Core)](PRD.md#31-authentication--authorization-core--in-scope)
  - [3.1.1 Authentication](PRD.md#311-authentication)
  - [3.1.2 Role-Based Access Control (RBAC)](PRD.md#312-role-based-access-control-rbac)
- [3.2 Tenant Management](PRD.md#32-tenant-management--in-scope)
  - [3.2.1 Manage Tenants](PRD.md#321-manage-tenants)
  - [3.2.2 Manage Users](PRD.md#322-manage-users)
  - [3.2.3 Admin Operations](PRD.md#323-admin-operations)
- [3.3 Core Entities](PRD.md#33-core-entities--in-scope)
  - [3.3.1 Vendors](PRD.md#331-vendors)
  - [3.3.1a Vendor Contacts](PRD.md#331a-vendor-contacts)
  - [3.3.1b Payment Terms](PRD.md#331b-payment-terms)
  - [3.3.2 Clients](PRD.md#332-clients)
  - [3.3.3 Employees](PRD.md#333-employees)
  - [3.3.4 Polymorphic Sources, Contacts, Addresses & Phone Numbers](PRD.md#334-polymorphic-sources-contacts-addresses--phone-numbers)
  - [3.3.5 Companies](PRD.md#335-companies)
- [3.4 Project Management](PRD.md#34-project-management--in-scope)
  - [3.4.1 Projects](PRD.md#341-projects)
  - [3.4.2 Units](PRD.md#342-units)
  - [3.4.3 Tasks & Task Groups](PRD.md#343-tasks--task-groups)
  - [3.4.4 Cost Items](PRD.md#344-cost-items)
  - [3.4.5 Change Orders](PRD.md#345-change-orders)
  - [3.4.6 Templates](PRD.md#346-templates)
- [3.5 Activities & Cost Management](PRD.md#35-activities--cost-management--in-scope)
  - [3.5.1 Categories & Activities](PRD.md#351-categories--activities)
  - [3.5.2 Deliverables & Assignments](PRD.md#352-deliverables--assignments)
  - [3.5.3 Budgets](PRD.md#353-budgets)
  - [3.5.4 Cost Lines](PRD.md#354-cost-lines)
  - [3.5.5 Actual Costs](PRD.md#355-actual-costs)
  - [3.5.6 Vendor Parts](PRD.md#356-vendor-parts)
- [3.6 Bill of Materials (BOM)](PRD.md#36-bill-of-materials-bom--in-scope)
  - [3.6.1 Catalog SKUs](PRD.md#361-catalog-skus)
  - [3.6.2 Vendor SKUs](PRD.md#362-vendor-skus)
  - [3.6.3 Vendor Pricing](PRD.md#363-vendor-pricing)
- [3.7 Accounts Payable (AP)](PRD.md#37-accounts-payable-ap--in-scope)
  - [3.7.1 AP Invoices](PRD.md#371-ap-invoices)
  - [3.7.2 AP Invoice Lines](PRD.md#372-ap-invoice-lines)
  - [3.7.3 Payments](PRD.md#373-payments)
  - [3.7.4 AP Credit Memos](PRD.md#374-ap-credit-memos)
- [3.8 Accounts Receivable (AR)](PRD.md#38-accounts-receivable-ar--in-scope)
  - [3.8.1 AR Invoices](PRD.md#381-ar-invoices)
  - [3.8.2 AR Invoice Lines](PRD.md#382-ar-invoice-lines)
  - [3.8.3 Receipts](PRD.md#383-receipts)
  - [3.8.4 AR Extensibility — Construction Closing Statements](PRD.md#384-ar-extensibility--construction-closing-statements--in-scope)
- [3.9 Accounting & General Ledger](PRD.md#39-accounting--general-ledger--in-scope)
  - [3.9.1 Chart of Accounts](PRD.md#391-chart-of-accounts)
  - [3.9.2 Journal Entries](PRD.md#392-journal-entries)
  - [3.9.3 Journal Entry Lines](PRD.md#393-journal-entry-lines)
  - [3.9.4 Ledger Balances](PRD.md#394-ledger-balances)
  - [3.9.5 Posting Queues](PRD.md#395-posting-queues)
  - [3.9.6 Category-Account Map](PRD.md#396-category-account-map)
  - [3.9.7 Intercompany Accounting](PRD.md#397-intercompany-accounting)
- [3.10 Cashflow & Profitability](PRD.md#310-cashflow--profitability--in-scope)
  - [3.10.1 Data Linkage Model](PRD.md#3101-data-linkage-model)
  - [3.10.2 Project Profitability Metrics](PRD.md#3102-project-profitability-metrics)
  - [3.10.3 Cashflow Timeline](PRD.md#3103-cashflow-timeline)
  - [3.10.4 SQL Views for Profitability](PRD.md#3104-sql-views-for-profitability)
  - [3.10.5 API Endpoints](PRD.md#3105-api-endpoints)
  - [3.10.6 UI Requirements](PRD.md#3106-ui-requirements)
- [3.11 Reporting & Views](PRD.md#311-reporting--views--in-scope)
- [3.12 Match Review Logs](PRD.md#312-match-review-logs--in-scope)
- [3.13 Tenant-Scoped Numbering System](PRD.md#313-tenant-scoped-numbering-system--in-scope)
  - [3.13.1 Design Principles](PRD.md#3131-design-principles)
  - [3.13.2 Numbering Configuration](PRD.md#3132-numbering-configuration)
  - [3.13.3 Sequence State (Counter Storage)](PRD.md#3133-sequence-state-counter-storage)
  - [3.13.4 Display ID Construction](PRD.md#3134-display-id-construction)
  - [3.13.5 Transaction-Safe Allocation](PRD.md#3135-transaction-safe-allocation)
  - [3.13.6 Reset Strategy](PRD.md#3136-reset-strategy)
  - [3.13.7 Recommended Defaults](PRD.md#3137-recommended-defaults)
  - [3.13.8 Entity Integration](PRD.md#3138-entity-integration)
  - [3.13.9 Backfill on Enable](PRD.md#3139-backfill-on-enable)
- [3.14 Tenant-First-Class Modules](PRD.md#314-tenant-first-class-modules--in-scope)
  - [3.14.1 Emails (first-class tenant-scoped table)](PRD.md#3141-emails-first-class-tenant-scoped-table)
  - [3.14.2 Tenant Preferences](PRD.md#3142-tenant-preferences)
  - [3.14.3 Countries (admin reference table)](PRD.md#3143-countries-admin-reference-table)
- [3.15 Planned Integrations (Customer-Gated)](PRD.md#315-planned-integrations-customer-gated--deferred)
- [3.16 Demo Tenants](PRD.md#316-demo-tenants--in-scope)
  - [3.16.1 Meridian Group (consulting holding company)](PRD.md#3161-meridian-group-consulting-holding-company)
  - [3.16.2 Sterling Ridge Homes (construction company)](PRD.md#3162-sterling-ridge-homes-construction-company)

## 4. Standard API Patterns

- [4.1 CRUD Operations](PRD.md#41-crud-operations--in-scope)
- [4.2 Pagination](PRD.md#42-pagination--in-scope)
- [4.3 Audit Fields](PRD.md#43-audit-fields--in-scope)
- [4.4 Soft Deletes](PRD.md#44-soft-deletes--in-scope)
- [4.5 Validation](PRD.md#45-validation--in-scope)
- [4.6 Excel Import/Export](PRD.md#46-excel-importexport--in-scope)
  - [4.6.1 Backend (pg-schemata + Controller Layer)](PRD.md#461-backend-pg-schemata--controller-layer)
  - [4.6.2 Frontend (Hooks + Components)](PRD.md#462-frontend-hooks--components)
  - [4.6.3 Pages with Import/Export](PRD.md#463-pages-with-importexport)

## 5. Database Design

- [5.1 Common Columns](PRD.md#51-common-columns--in-scope)
- [5.2 Naming Conventions](PRD.md#52-naming-conventions--in-scope)
- [5.3 Generated Columns](PRD.md#53-generated-columns--in-scope)
- [5.4 Schema Management & Migrations](PRD.md#54-schema-management--migrations--in-scope)

## 6. UI Components & Theming

- [6.1 Theme System](PRD.md#61-theme-system--in-scope)
  - [6.1.1 Component Override Strategy](PRD.md#611-component-override-strategy)
  - [6.1.2 Design Tokens (`tokens.js` + `layoutTokens.js`)](PRD.md#612-design-tokens-tokensjs--layouttokensjs)
  - [6.1.3 Theme Overrides Reference](PRD.md#613-theme-overrides-reference)
- [6.2 Navigation System](PRD.md#62-navigation-system--in-scope)
- [6.3 Module Bar (Dynamic Toolbar)](PRD.md#63-module-bar-dynamic-toolbar--in-scope)
- [6.4 Dependencies (Client)](PRD.md#64-dependencies-client--in-scope)
- [6.5 Reusable Component Patterns](PRD.md#65-reusable-component-patterns--in-scope)

## 7. Navigation Structure

- [7. Navigation Structure](PRD.md#7-navigation-structure--in-scope)

## 8. Environment Configuration

- [8. Environment Configuration](PRD.md#8-environment-configuration--in-scope)

## 9. Testing Strategy

- [9. Testing Strategy](PRD.md#9-testing-strategy--in-scope)

## 10. Coding Standards & Best Practices

- [10.1 Naming Conventions](PRD.md#101-naming-conventions--in-scope)
- [10.1.1 Single Canonical Names (No Aliases)](PRD.md#1011-single-canonical-names-no-aliases--in-scope)
- [10.2 File & Module Structure](PRD.md#102-file--module-structure--in-scope)
- [10.3 Copyright & File Headers](PRD.md#103-copyright--file-headers--in-scope)
- [10.4 Code Reuse & DRY Principles](PRD.md#104-code-reuse--dry-principles--in-scope)
- [10.5 Classes vs Functions](PRD.md#105-classes-vs-functions--in-scope)
- [10.6 Error Handling](PRD.md#106-error-handling--in-scope)
- [10.7 Import & Export Style](PRD.md#107-import--export-style--in-scope)
- [10.8 Comments & Documentation](PRD.md#108-comments--documentation--in-scope)
- [10.9 Async & Concurrency](PRD.md#109-async--concurrency--in-scope)
- [10.10 Security Practices](PRD.md#1010-security-practices--in-scope)

## 11. Developer Tooling

- [11.1 ESLint](PRD.md#111-eslint--in-scope)
- [11.2 Prettier](PRD.md#112-prettier--in-scope)
- [11.3 EditorConfig](PRD.md#113-editorconfig--in-scope)
- [11.4 Husky & Git Hooks](PRD.md#114-husky--git-hooks--in-scope)
- [11.5 VSCode Workspace](PRD.md#115-vscode-workspace--in-scope)
- [11.6 Vitest (Testing)](PRD.md#116-vitest-testing--in-scope)
- [11.7 Vite (Client Build)](PRD.md#117-vite-client-build--in-scope)
- [11.8 npm Workspaces](PRD.md#118-npm-workspaces--in-scope)
- [11.9 Logging](PRD.md#119-logging--in-scope)
- [11.10 Environment Management](PRD.md#1110-environment-management--in-scope)

## 12. Project Setup Guide

- [12.1 Prerequisites](PRD.md#121-prerequisites--in-scope)
- [12.2 GitHub Repository Setup](PRD.md#122-github-repository-setup--in-scope)
- [12.3 Clone & Install](PRD.md#123-clone--install--in-scope)
- [12.4 VSCode Configuration](PRD.md#124-vscode-configuration--in-scope)
- [12.5 Environment Setup](PRD.md#125-environment-setup--in-scope)
- [12.6 Database Setup](PRD.md#126-database-setup--in-scope)
- [12.7 Start Development](PRD.md#127-start-development--in-scope)
- [12.8 Run Tests](PRD.md#128-run-tests--in-scope)
- [12.9 Daily Development Workflow](PRD.md#129-daily-development-workflow--in-scope)
- [12.10 Husky Commit Rules](PRD.md#1210-husky-commit-rules--in-scope)
- [12.11 Recommended `.nvmrc`](PRD.md#1211-recommended-nvmrc--in-scope)
- [12.12 `.env.example` Reference](PRD.md#1212-envexample-reference--in-scope)

## 13. Design Decision Records

- [13.1 Purpose](PRD.md#131-purpose--in-scope)
- [13.2 Location](PRD.md#132-location--in-scope)
- [13.3 Template](PRD.md#133-template--in-scope)
- [13.4 When to Write a Decision Record](PRD.md#134-when-to-write-a-decision-record--in-scope)
- [13.5 Initial Decisions to Document](PRD.md#135-initial-decisions-to-document--in-scope)
- [13.6 Referencing Decisions](PRD.md#136-referencing-decisions--in-scope)

## Summary

- [Summary](PRD.md#summary)
