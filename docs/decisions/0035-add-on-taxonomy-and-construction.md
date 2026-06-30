# ADR-0035: Add-on Taxonomy and Construction Accounting Boundary

**Status**: Accepted
**Date**: 2026-06-30

## Context

[ADR-0028](./0028-vertical-module-architecture.md) framed add-ons as industry verticals, but the actual roster was sliced by capability (`bom`, `contracts`, `scheduling`, …). The `contracts` add-on bundled three industries' documents (services SOW, construction subdivision sales / closing statements, production work orders) plus a universal capability (milestone-gated billing). Separately, construction accounting — Work-in-Progress (WIP), completed-contract recognition, and the closing-statement posting recipe — was embedded in core sections (§3.4–§3.9), violating the rule that add-ons are standalone and core does not depend on them.

## Decision

### Two kinds of add-on

- **Capability add-ons** (industry-agnostic): catalog, scheduling, procurement, inventory, timesheets.
- **Industry verticals**: construction (documented now), manufacturing (future). A vertical owns its industry-specific documents and GL posting recipes.

### Dissolve `contracts`

Its contents redistribute: SOW → AR billing agreements ([ADR-0034](./0034-deliverable-effects-and-billing.md)); subdivision sales, closing statements, draw schedules, lien waivers → the **construction** vertical; production work orders → a future manufacturing vertical. The universal milestone-gated billing capability moves to core.

### Surgical construction-accounting boundary

Core keeps the **generic** accrual machinery — the `wip` account role, the `wip_release` event, `posting_rules`, and the `wip_policy` / `revenue_recognition_policy` enums on `company_accounting_config`. These are generic long-term-contract primitives per [ADR-0032](./0032-multi-ledger-cash-vs-accrual.md), usable by any vertical. Only the **closing-statement document and its specific posting recipe** belong to the construction add-on. Core sections describe `wip_release` generically ("fired by an add-on settlement document via the posting contract") and never name "closing statement."

### Integration mechanism

No new mechanism. Add-ons integrate through: entitlement + registry ([ADR-0018](./0018-module-entitlement-middleware.md)), barrel-export role-based posting ([ADR-0019](./0019-cross-module-posting-contract.md)), and synchronous in-transaction hooks ([ADR-0031](./0031-add-on-hooks.md)). Core never imports an add-on. Core↔add-on data links are soft references with no foreign key, and BOM explosion is add-on-read-only with the resulting cost lines written through the core endpoint ([ADR-0033](./0033-catalog-and-bom.md)).

## Alternatives Considered

| Alternative | Pros | Cons |
| --- | --- | --- |
| Keep `contracts` as one add-on | No restructure | Bundles three verticals plus a core capability; the standalone-rule violation persists |
| Maximal extraction (move WIP entirely to construction) | Core carries no construction terms | Guts the generic ledger; no non-construction tenant can use WIP; partly reverses ADR-0032 |
| Generic "documents / workflow engine" replacing contracts | One abstraction | Speculative second-case generalization; against ADR-0028's identical-shape rule |
| **Capability / vertical split + surgical boundary** (chosen) | Standalone add-ons; generic core ledger intact | Touches many core sections to de-name |

## Consequences

- Partially supersedes [ADR-0028](./0028-vertical-module-architecture.md): the roster is now explicitly two-tier, and the `contracts` example there is replaced by the construction vertical.
- The core ledger remains able to express WIP for any vertical.
- Manufacturing is named as future; production work orders have no home until it lands.
