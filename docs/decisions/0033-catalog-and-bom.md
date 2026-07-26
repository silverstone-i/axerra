# ADR-0033: Catalog Module and Bill of Materials

**Status**: Accepted
**Date**: 2026-06-30

## Context

The `bom` add-on never built a Bill of Materials. It cataloged vendor SKUs and matched them to a tenant master catalog (`catalog_skus`) via pgvector ([ADR-0012](./0012-pgvector-sku-matching.md)) — a catalog, matching, and pricing feature, not composition. The product needs a true BOM: composing catalog items into multi-level assemblies that explode into parts and roll up cost. Naming the module "BOM" was doubly wrong — it implied a feature that did not exist, while the module's real job (item master + matching + pricing) is broader than a BOM.

## Decision

Rename the add-on `bom` → `catalog`, and add a true Bill of Materials as a feature inside it.

1. Module = **Catalog**. Tables: `catalog_items` (renamed from `catalog_skus`), `vendor_skus`, `vendor_pricing`, and the new `bom_components`.
2. The **BOM** is an adjacency-list self-reference on `catalog_items`: `bom_components(parent_item_id → catalog_items, child_item_id → catalog_items, quantity)`. An item is an assembly when it owns component rows and a leaf otherwise — there is no type column. The role (assembly vs component) is a property of the edge, not the item, so one master item is reused across many parents.
3. The BOM is materials-only. Assembly labor is a cost line in the activities module, never a component.
4. Cycle prevention is enforced in application code (reject an edge whose parent is reachable beneath the child). Explosion and cost roll-up use recursive traversal; quantity multiplies down each path; summing cost lines counts only top-level rows.
5. Names align across code, UI, and docs: module **Catalog**, feature **BOM**, routes under `/api/catalog/v1/`. The code refactor follows PRD approval.

### Soft link to core

A core `cost_lines` row references a catalog item by a **soft reference** (no database foreign key). Under schema-per-tenant isolation ([ADR-0001](./0001-schema-per-tenant-isolation.md)), catalog tables do not exist in the schema of a tenant that has not licensed the add-on, so a core foreign key to them is impossible. BOM explosion runs read-only in the add-on; resulting lines are written through the existing core cost-lines endpoint.

### vendor_parts vs vendor_skus

The core `vendor_parts` table (activities) and the catalog `vendor_skus` / `vendor_pricing` tables are an intentional split, not duplication: `vendor_parts` is the activities module's local per-vendor pricing cache available without the add-on; `vendor_skus` / `vendor_pricing` is the richer matched registry with time-phased pricing layered on by the Catalog add-on.

## Alternatives Considered

| Alternative | Pros | Cons |
| --- | --- | --- |
| Keep module name `bom` | No rename churn | Module is broader than a BOM (matching, pricing); recreates the original mislabel |
| Self-referential parent column on `catalog_items` | One fewer table | Breaks reuse (one parent per item) and has nowhere to store per-edge quantity |
| Embed components as JSON on the item row | No join table | Loses FK integrity, where-used queries, and clean roll-up |
| **Catalog module + `bom_components` edge table** (chosen) | Reuse, quantity-per-edge, standard adjacency-list BOM | One extra table |

## Consequences

- Updates naming in [ADR-0012](./0012-pgvector-sku-matching.md) (BOM module → Catalog module; `catalog_skus` → `catalog_items`).
- The catalog is materials-only; turnkey / service bundles are a core concern (deliverables + billing agreements, [ADR-0034](./0034-deliverable-effects-and-billing.md)), not catalog rows.
- Cost roll-up is query-time recursive; there is no stored assembly price.
