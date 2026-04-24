# VIMBER — Executive Summary

**VIMBER (a Next Generation Accounting Platform)** is a multi-tenant, modular ERP for any business that runs on projects. It unifies project management, cost control, and double-entry accounting in one system, so operators can see project-level cashflow and profitability in real time — not as a month-end reconciliation exercise.

## Who it's for

Any industry where projects (not products or periods) are the unit of financial truth:

- **Construction & property development** — homebuilders, general contractors, developers
- **Manufacturing** — job-shop, engineer-to-order, and make-to-order producers
- **Professional services & consulting** — firms billing against engagements, retainers, or fixed-fee projects
- **Agencies & studios** — creative, engineering, and architectural practices
- **Any operator** running multiple legal entities or cost centers that needs accounting rigor without stitching together separate PM and accounting systems

Personas range from platform operators down to AP/AR clerks, with a four-layer RBAC model (policies → data scope → state filters → field groups) controlling what each user sees and does.

## What it does

VIMBER covers the full project-to-cash lifecycle:

- **Projects & budgets** — projects, units/phases, budgets, change orders, and actual-cost tracking
- **Procurement & BOM** — catalog SKUs, vendor SKU matching (pgvector + OpenAI embeddings), vendor pricing
- **Accounts payable & receivable** — vendor invoices, payments, client invoices, receipts
- **General ledger** — double-entry accounting, chart of accounts, journal entries, intercompany transactions
- **Cashflow & profitability** — project-level dashboards and margin analysis
- **Reporting** — tenant-scoped views, keyset-paginated grids, Excel import/export on every table

## What makes it different

- **Project-first accounting** — cost, cashflow, and profitability are first-class dimensions, not after-the-fact reports
- **Schema-per-tenant isolation** — every customer gets a dedicated PostgreSQL schema; one compromised tenant cannot leak into another
- **Built on pg-schemata (owned)** — Vimber owns the underlying ORM layer, so the platform can evolve without vendor lock-in
- **Modular entitlements** — tenants activate modules (Projects, BOM, AP, AR, GL, Reports) independently

## Technology

React 18 + MUI SPA, Express 5 API, PostgreSQL 15 with pgvector, Redis permission cache, JWT in httpOnly cookies. Node ≥ 20, npm workspaces monorepo.
