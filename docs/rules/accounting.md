# Accounting (General Ledger) Rules

## Table Hierarchy

| Table | Parent FK | Cascade | Soft Delete | Notes |
|-------|-----------|---------|-------------|-------|
| `ledgers` | companies (RESTRICT), self-ref `parent_ledger_id` (SET NULL) | — | Yes | One per accounting representation; `basis` IN (accrual, cash, common); code unique per company |
| `company_accounting_config` | companies (RESTRICT) | — | Yes | One row per company; `book_basis` IN (accrual, cash); recognition + WIP policy |
| `chart_of_accounts` | — | — | Yes | Code unique per tenant; optional bank fields |
| `journal_entries` | companies (RESTRICT), ledgers (RESTRICT), projects (SET NULL) | — | Yes | Status-gated; `ledger_id` not null; self-ref `corrects_id` (SET NULL) for reversals |
| `journal_entry_lines` | journal_entries (CASCADE), chart_of_accounts (RESTRICT) | CASCADE from entry | Yes | Polymorphic `related_table` / `related_id` |
| `ledger_balances` | ledgers (RESTRICT), chart_of_accounts (RESTRICT) | — | **No** | Append-only; unique (ledger_id, account_id, as_of_date) |
| `posting_queues` | journal_entries (CASCADE) | CASCADE from entry | **No** | Async posting status tracker; ledger carried via entry |
| `category_account_map` | categories (RESTRICT), chart_of_accounts (RESTRICT) | — | Yes | Temporal validity (valid_from, valid_to) |
| `posting_rules` | ledgers (RESTRICT) | — | Yes | Per-ledger rule set; null account role = emit no posting |
| `fiscal_periods` | companies (RESTRICT), ledgers (RESTRICT) | — | Yes | Per-ledger period gating; unique (tenant_id, ledger_id, fiscal_year, period_number) |
| `company_accounts` | companies (RESTRICT) ×2, chart_of_accounts (RESTRICT) | — | Yes | Unique (tenant_id, source_company_id, target_company_id) |
| `company_transactions` | companies (RESTRICT) ×2, journal_entries (SET NULL) ×2 | — | Yes | Module IN (ar, ap, je) — controller-validated, no schema CHECK; elimination flag |
| `internal_transfers` | chart_of_accounts (RESTRICT) ×2 | — | Yes | from_account_id ≠ to_account_id — controller-validated (HTTP 400), no schema CHECK |

## Journal Entry Lifecycle

```
pending → posted → reversed
```

- **pending**: Initial state; lines editable
- **posted**: Entry finalized — ledger balances updated transactionally
- **reversed**: Correcting entry created with flipped debits/credits

### Balance Validation

Journal entries must balance before insert: `SUM(debits) = SUM(credits)` within a tolerance of ±0.005. The controller rejects unbalanced entries.

### Posting

Posting is transactional (`db.tx()`):

1. Validates entry status is `pending`
2. For each line, updates `ledger_balances` via `INSERT ... ON CONFLICT (ledger_id, account_id, as_of_date) DO UPDATE SET balance = balance + amount`
3. Transitions entry status to `posted`
4. Updates `posting_queues` record: status `posted`, sets `processed_at`

### Reversals

Reversing a posted entry:

1. Creates a new correcting entry with all debits and credits flipped
2. Links the correcting entry via `corrects_id` FK
3. Marks the original entry status as `reversed`
4. Creates a new `posting_queues` record for the correcting entry (status `pending`)

## Posting Queue Workflow

```
pending → posted
        ↘ failed
```

- **pending**: Entry awaiting posting
- **posted**: Successfully posted; `processed_at` set
- **failed**: Posting error; `error_message` recorded; retryable via `POST /retry`

## Ledgers & Accounting Basis

Each company keeps one ledger per accounting representation it must produce: `accrual` (the internal backbone — project costing and profitability require it), `cash`, and a shared `common` ledger. `company_accounting_config.book_basis` designates which is the authoritative book of record.

- Accrual is always maintained. Cash is a parallel, posted, period-lockable book — not derived at report time.
- Each `(company, ledger)` balances and locks independently. Cash and bank balances are identical across a company's ledgers; ledgers differ only by accrual-only accounts (A/R, A/P, WIP, inventory), which never appear in the `cash` ledger.
- Entries identical in both bases (cash sales, direct cash expenses, intercompany cash transfers) post once to the `common` ledger. The accrual report reads `common` + `accrual`; the cash report reads `common` + `cash`. Reports select a basis by ledger, never by filtering account types.
- Multi-GAAP reuses the same machinery (additional ledgers by `accounting_principle`); deferred.

## GL Posting Hooks

For each business event the posting service evaluates the `posting_rules` of every ledger belonging to the event's company and posts the resolved — possibly empty — entry to each. A null account role is how the cash ledger records nothing for an invoice-issuance event.

| Trigger | Source Type | Accrual ledger (DR → CR) | Cash ledger (DR → CR) |
|---------|------------|--------------------------|------------------------|
| AP invoice approved | `ap_invoice` | Expense/WIP → AP Liability | — (no entry) |
| AP payment created | `ap_payment` | AP Liability → Cash/Bank | Expense → Cash/Bank |
| AR invoice sent | `ar_invoice` | AR Receivable → Revenue | — (no entry) |
| AR receipt created | `ar_receipt` | Cash/Bank → AR Receivable | Cash/Bank → Revenue |
| Actual cost approved | `actual_cost` | Expense/WIP → AP/Accrual | Expense → Cash/Bank (at payment) |

Each hook sets `source_type` and `source_id` on the journal entry for audit traceability. Cash-basis recognition relies on `payment_allocations` / `receipt_allocations` to attribute partial and split settlements to the invoices they settle.

## Intercompany Transactions

Intercompany operations create paired journal entries across source and target companies:

- Source entry: debit inter-company account, credit source account
- Target entry: debit target account, credit inter-company account
- Both entries reference `source_type: 'intercompany'`
- `is_eliminated` flag supports consolidated reporting

The `module` column tracks the originating module (`ar`, `ap`, or `je`).

## Category–Account Mapping

`category_account_map` provides temporal GL account assignment for cost categories:

- Each mapping has `valid_from` and optional `valid_to` dates
- Used to auto-select the correct GL account when posting costs by category

## Soft Delete Convention

Most accounting tables use `softDelete: true` except `ledger_balances` and `posting_queues`, which are append-only audit tables.

## API Routes

All accounting module routes are mounted under `/api/accounting/v1/`:

| Endpoint | Entity | Custom |
|----------|--------|--------|
| `/api/accounting/v1/ledgers` | Ledgers | — |
| `/api/accounting/v1/company-accounting-config` | Company Accounting Config | — |
| `/api/accounting/v1/posting-rules` | Posting Rules | — |
| `/api/accounting/v1/chart-of-accounts` | Chart of Accounts | — |
| `/api/accounting/v1/journal-entries` | Journal Entries | `POST /post`, `POST /reverse` |
| `/api/accounting/v1/journal-entry-lines` | Journal Entry Lines | — |
| `/api/accounting/v1/ledger-balances` | Ledger Balances | Read-only append view |
| `/api/accounting/v1/posting-queues` | Posting Queues | `POST /retry` |
| `/api/accounting/v1/category-account-map` | Category–Account Map | — |
| `/api/accounting/v1/company-accounts` | Company Accounts | — |
| `/api/accounting/v1/company-transactions` | Company Transactions | — |
| `/api/accounting/v1/internal-transfers` | Internal Transfers | — |
