# ADR-0028: Vertical Add-on Module Architecture

**Status**: Accepted; partially superseded by [ADR-0031](./0031-add-on-hooks.md) on the question of add-on extension of core workflows, and by [ADR-0035](./0035-add-on-taxonomy-and-construction.md) on the add-on roster taxonomy (capability add-ons vs industry verticals) and the construction vertical.
**Date**: 2026-05-22

## Context

The May 2026 product scope review formalised a split between **core modules** (ship with every AXERRA instance) and **vertical add-on modules** (licensed per tenant for a specific industry: services, construction, production). See PRD §3.0.

The open question was *how* vertical modules should be implemented:

- as a plugin / extension system loaded at runtime?
- as a subscription / event-bus mechanism where verticals listen for core events?
- as an inheritance hierarchy over core modules?
- or as plain modules, identical in shape to the existing core, gated by entitlement?

The first three options would add a new architectural concept and a new failure surface (plugin loading order, event delivery, override semantics). The existing module entitlement gate (ADR-0018) already does most of the work we actually need: it tells the server, per request, whether a given tenant may reach a given module.

## Decision

**Vertical add-on modules are coded identically to core modules.** There is no plugin loader, event bus, subscription model, or inheritance hierarchy.

Concretely:

1. The module registry [`apps/server/src/db/moduleRegistry.js`](../../apps/server/src/db/moduleRegistry.js) is the single source of truth for what modules exist. Vertical modules get an entry in the same table as core modules. `arch:check` (ADR-0021) enforces that any module directory carrying schemas is registered.
2. Access is controlled by `tenant.allowed_modules` (jsonb array on `admin.tenants`) checked by the [`moduleEntitlement` middleware](../../apps/server/src/middleware/moduleEntitlement.js). The existing "empty means allow all" semantic from ADR-0018 is preserved.
3. The middleware chain is unchanged: `authRedis → withMeta → moduleEntitlement → rbac → handler`.
4. Cross-module behaviour — e.g. the construction add-on posting settlement journal entries to GL — uses the existing cross-module posting contract (ADR-0019). No new mechanism.
5. Adding a new vertical module is a three-step process: implement the module under `apps/server/src/<module>/`, register it in `moduleRegistry.js`, populate `allowed_modules` for licensed tenants.

## Alternatives Considered

| Alternative | Pros | Cons |
| --- | --- | --- |
| Runtime plugin system | Verticals shippable independently; clean isolation | New loading semantics; ordering bugs; harder static analysis; more CI surface |
| Event bus / pub-sub between core and verticals | Decouples verticals from core data shape | Adds asynchronous delivery, retry, and ordering concerns to what is currently a synchronous HTTP request; debugging cost |
| Class-style inheritance (vertical extends core) | Familiar OO pattern | Couples vertical to core internals; brittle under refactor; doesn't match the rest of the codebase, which is functional/modular |
| **Identical-shape modules + entitlement** (chosen) | Reuses ADR-0018, ADR-0019, ADR-0021; no new concepts; verticals are just modules | Verticals must follow core conventions strictly; no "plugin marketplace" story |

## Consequences

- **Lower architectural surface area.** Verticals add modules, not mechanisms. A new developer who understands a core module already understands a vertical.
- **Per-tenant packaging is a data decision, not a code decision.** Switching a tenant from services to construction is a `tenant.allowed_modules` edit, not a redeploy.
- **No special-casing in tests, CI, or `arch:check`.** The same gates that protect core modules protect verticals.
- **Vertical-specific behaviour over a shared core resource** (e.g. construction posting to GL) **must flow through ADR-0019**, not direct cross-module imports. This is the price of not having an event bus.
- **No "third-party vertical" story.** The decision presumes verticals are written in-tree. If we later need externally-authored verticals, this ADR will need to be superseded.
- ADRs cross-referenced: [0001](./0001-schema-per-tenant-isolation.md), [0018](./0018-module-entitlement-middleware.md), [0019](./0019-cross-module-posting-contract.md), [0021](./0021-architecture-ci-gates.md).
