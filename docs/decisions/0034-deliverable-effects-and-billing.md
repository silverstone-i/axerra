# ADR-0034: Deliverable Effects and Milestone-Gated Billing

**Status**: Accepted
**Date**: 2026-06-30

## Context

Deliverables carried only a status lifecycle. The product needs deliverables to drive money events — releasing a client invoice when a milestone completes, authorizing a vendor payment, or simply gating progress (an inspection or sign-off). Milestone-gated billing was stranded in the deferred `contracts` add-on, even though every project business — services and construction alike — bills against progress. Statements of Work (SOW) lost their home once `contracts` was dissolved ([ADR-0035](./0035-add-on-taxonomy-and-construction.md)).

## Decision

1. Add an `effect` to core `deliverables`: `bill` (generate an AR invoice), `pay` (authorize an AP payment against a purchase order or subcontract), `gate` (control checkpoint, no GL effect). Direction is explicit — `bill` is money in, `pay` is money out.
2. `gate` sub-flavors (inspection, approval, customer review) are labels, not separate effects.
3. Milestone-gated billing is **core**, riding on deliverables; no add-on is required.
4. The SOW folds into **AR** as a `billing_agreements` table (the agreement header) plus `billing_agreement_milestones` (the `bill`-effect deliverables that release invoices). `ar_invoices` gains a soft `billing_agreement_id`. There is **no services vertical**.
5. The AP mirror — a subcontract or purchase order governing what the tenant pays — stays in AP / procurement; it is not a billing agreement.
6. Deliverable→deliverable sequencing (e.g. a `gate` ahead of a `bill`) is a scheduling concern and is deferred.

## Alternatives Considered

| Alternative | Pros | Cons |
| --- | --- | --- |
| Single `payment_trigger` type | Fewer values | Hides AR-vs-AP direction; conflates money in and out |
| Keep SOW / milestone billing in a `contracts` add-on | No core change | Universal capability gated behind a license; orphaned by the contracts dissolution |
| A services vertical for SOW | Mirrors construction | SOW is not industry-specific; a construction draw schedule is the same shape |
| **bill/pay/gate effect + SOW in AR** (chosen) | Explicit, core, no vertical | New AR tables |

## Consequences

- Billing agreements live in AR; the milestone link points AR → activities, consistent with `ar_invoices.deliverable_id`.
- Sequencing is intentionally absent until the scheduling add-on needs it.
- Turnkey / service bundles are expressed as billing agreements plus deliverables, not as catalog items ([ADR-0033](./0033-catalog-and-bom.md)).
