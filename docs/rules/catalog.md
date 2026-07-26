# Catalog Module Rules

## Table Hierarchy

| Table | Parent FK | Cascade | Notes |
|-------|-----------|---------|-------|
| `catalog_items` | — | — | Tenant-scoped master catalog of internal material items |
| `bom_components` | catalog_items (parent, CASCADE), catalog_items (child, RESTRICT) | CASCADE from parent assembly | BOM edges: parent assembly → child component, with quantity |
| `vendor_skus` | vendors (RESTRICT), catalog_items (SET NULL) | — | Vendor-provided SKUs, matched to catalog items |
| `vendor_pricing` | vendor_skus (CASCADE) | CASCADE from vendor SKU | Price records per vendor SKU |

## Bill of Materials

The BOM is an adjacency-list self-reference on `catalog_items` via `bom_components` (`parent_item_id`, `child_item_id`, `quantity`). It is the storage behind the **BOM** feature in the UI.

- An item is an **assembly** when it owns `bom_components` rows and a **leaf** when it owns none — there is no type column; the role is derived from the edges.
- One master item is reused across many parents (one definition, many edges). Never duplicate an item to place it in a second assembly.
- BOM is **materials-only**. Assembly labor is a separate cost line in the activities module, never a `bom_components` row.
- **Cycle prevention** is enforced in application code: reject an edge whose parent is already reachable beneath the child (no item contains itself directly or transitively).
- **Explosion / roll-up** is recursive: a leaf's cost comes from vendor pricing; an assembly's cost is `Σ(child rolled-up cost × quantity)`. Quantity multiplies down each path. When exploding into cost lines, sum only top-level lines to avoid double-counting parents and their children.
- The `cost_lines` → catalog link is a **soft reference** (no DB foreign key) because catalog tables are absent in an unlicensed tenant's schema. Explosion runs read-only here; resulting lines are written through the core cost-lines endpoint.

## Matching Workflow

```
Create items / SKUs → Refresh Embeddings → Find Matches → Accept / Reject / Defer
```

1. **Create** catalog items and vendor SKUs via standard CRUD
2. **Normalize** descriptions automatically on create/update (`description_normalized`)
3. **Embed** via `/refresh-embeddings` endpoints — calls OpenAI `text-embedding-3-large`, stores 3072-dim vectors
4. **Match** via `/match` — returns top-K catalog items ranked by cosine similarity
5. **Auto-match** via `/auto-match` — accepts the best match if confidence >= threshold (default 0.85)
6. **Batch match** via `/batch-match` — runs auto-match for multiple vendor SKUs
7. **Audit** every decision to `admin.match_review_logs`

## Confidence Thresholds

| Range | Color | Meaning |
|-------|-------|---------|
| >= 0.85 | Green (success) | High confidence — safe to auto-accept |
| 0.60 – 0.84 | Yellow (warning) | Medium confidence — human review recommended |
| < 0.60 | Red (error) | Low confidence — likely not a match |

Auto-match only accepts matches at >= 0.85. Below that threshold, the decision is logged as `defer`.

## Match Review Decisions

| Decision | Effect |
|----------|--------|
| `accept` | Sets `vendor_skus.catalog_sku_id` and `confidence`; logs to `match_review_logs` |
| `reject` | No change to vendor SKU; logs rejection for audit |
| `defer` | No change; logged when auto-match falls below threshold |

## Embedding Model

- Default model: `text-embedding-3-large` (3072 dimensions)
- The `model` column on both `catalog_items` and `vendor_skus` tracks which model generated each embedding
- Changing models requires re-embedding all rows (embeddings from different models are not comparable)

## Soft Delete Convention

All Catalog tables use `softDelete: true`:

- Active records: `deactivated_at IS NULL`
- Archived records: `deactivated_at IS NOT NULL`
- Conditional unique index on `catalog_items.catalog_sku WHERE deactivated_at IS NULL`

## API Routes

All Catalog module routes are mounted under `/api/catalog/v1/`:

| Endpoint | Entity | Custom Routes |
|----------|--------|---------------|
| `/api/catalog/v1/catalog-items` | Catalog Items | `POST /refresh-embeddings`, `GET /:id/explode` |
| `/api/catalog/v1/bom-components` | BOM Components | Standard CRUD only |
| `/api/catalog/v1/vendor-skus` | Vendor SKUs | `GET /unmatched`, `POST /match`, `POST /auto-match`, `POST /batch-match`, `POST /refresh-embeddings` |
| `/api/catalog/v1/vendor-pricing` | Vendor Pricing | Standard CRUD only |

Match review logs are under the tenants module:

| Endpoint | Entity | Access |
|----------|--------|--------|
| `/api/tenants/v1/match-review-logs` | Match Review Logs | Read-only, Axerra super users |
