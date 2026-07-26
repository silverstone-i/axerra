# ADR-0031: Synchronous Hooks for Add-on Modules

**Status**: Accepted
**Date**: 2026-05-25

## Context

[ADR-0028](./0028-vertical-module-architecture.md) chose "identical-shape modules + entitlement" for add-on modules and ruled out runtime plugin loaders, event buses, and inheritance. That decision stands.

What ADR-0028 did not address is how an add-on extends a *core workflow* — e.g. construction needing an additional client-sign-off step on a core change order. The cross-module posting contract ([ADR-0019](./0019-cross-module-posting-contract.md)) covers GL flows but not workflow gates.

Two design options were on the table:

- Make core workflows configurable (gates as data). Pushes complexity into core for the benefit of add-ons that may never exist.
- Give core parallel tables for each add-on that needs a richer workflow. Duplicates concepts and proliferates tables speculatively.

Both add tables. Neither makes the extension point visible in code.

## Decision

**Add-on modules extend core workflows via synchronous in-process hooks.** Core defines named hook points at specific workflow transitions (e.g. `beforeChangeOrderPost`, `afterProjectRelease`). Add-ons register handlers at module load. Core invokes registered handlers in-line, inside the parent transaction. A handler that throws blocks the transition.

Concretely:

1. Hook points are **named constants in core** — not discovered dynamically. The set of valid hook points is a closed list, defined where the workflow lives.
2. Registration is **synchronous and explicit at module load**. Add-ons call `registerHook(name, handler)` in their module-init code. Gated by `tenants.allowed_modules` via the existing entitlement check.
3. Handlers run **inside the parent request's transaction**. Throw → the parent action rolls back. No retries, no async delivery, no ordering across requests.
4. Hook points are added **as add-ons demand them**, not speculatively. The hook catalogue grows from real requirements.
5. The mechanism is not for cross-module GL posting. GL flows continue through ADR-0019.

This is distinct from plugin loaders (no runtime loading), event buses (no async delivery, no retry semantics), and inheritance (no class hierarchy). ADR-0028's rejections of those mechanisms still hold; this ADR addresses a gap, not a reversal.

## Alternatives Considered

| Alternative | Pros | Cons |
| --- | --- | --- |
| Configurable workflow gates (data-driven, gates registered in a table per tenant) | No mechanism change; gates visible in data | Core grows abstract; behaviour split between code and config; harder to test |
| Parallel tables per add-on (e.g. `construction_change_orders`) | Each module self-contained; no extension mechanism | Concept duplication; UI must branch by `allowed_modules`; cross-add-on reports awkward |
| Event bus (async pub-sub) | Decouples core from add-ons | Async delivery, retry, ordering — ruled out by ADR-0028 |
| **Synchronous named hooks** (chosen) | Explicit, greppable, in-transaction, gated by existing entitlement; no new tables required | Hook ordering when multiple add-ons subscribe; static analysis weaker than direct calls |

## Consequences

- **No code change yet.** The hook contract (registration API, handler signature, ordering rules, error semantics) is intentionally undefined here. It lands with the first add-on that requires a hook — at which point this ADR will be revised with the chosen contract, or a follow-up ADR will record the specifics.
- **Hook points are named in core.** Add-ons cannot invent extension points; if a transition lacks a hook and an add-on needs one, the hook is added to core (a small, reviewable change).
- **Ordering risk.** When multiple add-ons register handlers on the same hook, order matters. Mitigation: registration order or an explicit priority annotation. Decided when the second add-on lands.
- **Static analysis cost.** A reader of core's CO controller cannot grep for everywhere `post` is affected without knowing the hook name. Mitigation: a single `docs/architecture/hooks.md` catalogue listing every hook and its registered handlers.
- **Supersedes part of [ADR-0028](./0028-vertical-module-architecture.md).** Specifically the implicit position that add-ons cannot extend core workflows. The bulk of ADR-0028 (identical-shape modules, registry-driven entitlement, no plugin loader / event bus / inheritance) is unchanged.
