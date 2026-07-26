# Accounts Receivable (AR) Rules

## Table Hierarchy

| Table | Parent FK | Cascade | Notes |
|-------|-----------|---------|-------|
| `ar_invoices` | companies (RESTRICT), clients (RESTRICT), projects (SET NULL), deliverables (SET NULL), billing_agreements (SET NULL) | — | Status-gated lifecycle with GL posting |
| `ar_invoice_lines` | ar_invoices (CASCADE) | CASCADE from invoice | Links to chart_of_accounts (RESTRICT) |
| `receipts` | clients (RESTRICT), ar_invoices (SET NULL) | — | Partial receipts supported |
| `billing_agreements` | companies (RESTRICT), clients (RESTRICT), projects (SET NULL) | — | Revenue contract; SOW / draw-schedule home |
| `billing_agreement_milestones` | billing_agreements (CASCADE), deliverables (RESTRICT) | CASCADE from agreement | Bill-effect deliverables that release invoices |

## AR Invoice Status Workflow

```
open → sent → paid → voided
  │      │      │
  └→ voided ←┘────┘
```

- **open**: Initial state; lines can be added/edited
- **sent**: Invoice dispatched to client — auto-assigns `invoice_number` via numbering system scoped to `company_id` (each company has its own running sequence); triggers GL posting (debit AR Receivable, credit Revenue)
- **paid**: Fully settled — auto-transitions when remaining balance reaches zero
- **voided**: Canceled (terminal); reachable from any prior status

## Receipt Rules

- Partial receipts are supported
- Remaining balance = `total_amount − SUM(receipts)`
- Invoice must have status `sent` or `paid` to receive receipts (cannot record receipts on `open` invoices)
- Receipt amount is validated against remaining balance (cannot overpay)
- On creation: triggers GL posting (debit Cash/Bank, credit AR Receivable)
- Auto-transitions invoice to `paid` when remaining balance reaches zero
- Valid payment methods: `check`, `ach`, `wire` (validated in controller; no schema CHECK constraint)

## Billing Agreements

A billing agreement is the revenue contract that governs client billing — the home for services Statements of Work (SOW) and construction draw schedules. There is no separate services vertical.

- Milestones are the agreement's `bill`-effect deliverables, linked via `billing_agreement_milestones`.
- Completing a `bill`-effect deliverable releases an AR invoice stamped with its `billing_agreement_id`.
- Milestone-gated billing is **core** — no add-on required.
- The AP mirror (a subcontract or purchase order governing what the tenant *pays*) stays in AP / procurement, not here.

## Soft Delete Convention

All AR tables use `softDelete: true` with a `deactivated_at` column:

- Active records: `deactivated_at IS NULL`
- Archived records: `deactivated_at IS NOT NULL`

## API Routes

All AR module routes are mounted under `/api/ar/v1/`:

| Endpoint | Entity |
|----------|--------|
| `/api/ar/v1/ar-invoices` | AR Invoices |
| `/api/ar/v1/ar-invoice-lines` | AR Invoice Lines |
| `/api/ar/v1/receipts` | Receipts |
| `/api/ar/v1/billing-agreements` | Billing Agreements |
