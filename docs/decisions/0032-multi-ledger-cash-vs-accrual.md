# ADR-0032: Multi-Ledger Architecture for Cash vs Accrual

**Status**: Accepted
**Date**: 2026-06-08

## Context

AXERRA's general ledger was hard-wired to accrual: `postingService.js` hardcoded every journal entry and recognized revenue/expense at invoice date, `journal_entries` had no ledger dimension, and the lone `chart_of_accounts.cash_basis` flag was inert (read by nothing).

Tenants must be able to choose, **per company**, whether that company's book of record is cash or accrual. This is a financial and jurisdictional decision the tenant owns — not one AXERRA should dictate. A single company can also face more than one reporting obligation at once (e.g. statutory local GAAP plus group GAAP for consolidation), so the model must generalize beyond two bases.

Two structural constraints shaped the decision:

1. **Project costing is intrinsically accrual.** WIP, commitments, and profitability only make sense when costs are matched to the project as incurred. The accrual ledger must always exist regardless of a company's tax basis.
2. **AXERRA already locks fiscal periods** (`open → closed → locked`). A book of record whose historical numbers can silently restate is incompatible with period locking.

## Decision

Introduce a **posted multi-ledger architecture** where `ledger` is a first-class data dimension, driven by a data-driven posting-rules engine.

### Ledger as a discriminator, not separate tables

A new `ledgers` registry (per company) plus a `ledger_id` column on the accounting facts (`journal_entries`, `ledger_balances`, `fiscal_periods`). One fixed set of tables per tenant schema; adding a ledger is a row insert, never DDL. Tenant isolation stays at the schema-per-tenant boundary ([ADR-0001](./0001-schema-per-tenant-isolation.md)) — the ledger dimension is a filter column, not an access-control concern, so no RLS.

### Posted ledgers, not report-time derivation

Cash basis is a **posted, period-lockable** book, written by the posting-rules engine — not derived at report time. A derived cash-basis report (the QuickBooks model) leaks residual A/R/A/P when transactions lack a clean income/expense counterpart, and cannot honor a locked period. A posted ledger is correct by construction and freezes with period close. Reports select a basis by `ledger_id`, never by filtering account types.

### Data-driven posting rules

A `posting_rules` table keyed by `(ledger, event_type)` replaces hardcoded postings. For each business event the posting service evaluates every ledger's rules and posts the resolved — possibly empty — balanced entry per ledger. A null account role is how the cash ledger records nothing for an invoice-issuance event.

### `common` base ledger

Entries identical in both bases (cash sales, direct cash expenses, intercompany cash transfers) post once to a `common` ledger. The accrual report reads `common + accrual`; the cash report reads `common + cash`. This trims duplication of the genuinely-shared entries without collapsing the parallel ledgers.

### N-way from the start, multi-GAAP deferred

`ledgers` carries `accounting_principle` and `parent_ledger_id` (delta/extension ledgers) now, so multi-GAAP is additive — more ledgers and rules, not a re-architecture. Multi-GAAP behavior itself is deferred.

### Per-company basis and recognition policy

A new `company_accounting_config` holds `book_basis` (which ledger is authoritative), plus the `revenue_recognition_policy` and `wip_policy` the posting rules consume. The misplaced `chart_of_accounts.cash_basis` flag is removed.

### Allocation prerequisite

Cash-basis recognition requires knowing what each payment settles, with partial and split support. New `receipt_allocations` and `payment_allocations` tables supersede the single nullable `ar_invoice_id` / `ap_invoice_id` FKs as the source of truth for cash-ledger recognition.

## Alternatives Considered

| Alternative | Pros | Cons |
|---|---|---|
| Report-time derivation (QuickBooks / NetSuite) | No second posting path; cheapest; one ledger | Residual-A/R leakage on un-clean transactions; cannot lock cash-basis history — fails as a book of record under period locking |
| Per-ledger physical tables, or per-ledger tables created at provisioning | Strong physical separation | DDL per ledger; schema sprawl; ledger count varies per company; fights the `createTable`-at-bootstrap model |
| Single table + RLS for the ledger split | Reuses an isolation primitive | Wrong tool — ledger is a selection/reporting axis, not access isolation, which schema-per-tenant already provides |
| Hardcode cash/accrual as a special case | Smallest immediate change | No path to multi-GAAP without re-architecting; rules stay buried in code |

## Consequences

- **Cash basis becomes a true book of record** — posted, balanced, and lockable per ledger, with no derived-report leakage.
- **Accrual remains the internal backbone**, so project costing/profitability is unaffected; cash is a parallel book layered on the same events.
- **Reporting is trivial and correct** — `WHERE ledger_id IN (…)`; the rules engine does the work at posting time.
- **Multi-GAAP is additive**, reusing the ledger dimension and posting-rules engine.
- **New required inputs**: every company needs receipt/payment→invoice allocation (partial + split) and an explicit revenue-recognition / WIP-release policy. The ledger architecture is inert without them.
- **Cross-module posting surface changes**: the `postAPInvoice` / `postARInvoice` / etc. barrel ([ADR-0019](./0019-cross-module-posting-contract.md)) gains a ledger/basis dimension, and posting moves from hardcoded entries to rule evaluation.
- **Cost accepted**: a second posting path, more storage, and per-ledger period close. The `common` ledger limits, but does not eliminate, duplication — cash-vs-accrual differences are pervasive (every invoice-linked receipt/payment differs by a leg).
