# ADR-0023: Excel Import/Export via createRouter

**Status**: Accepted
**Date**: 2026-03-16

## Context

All NAP resource entities need bulk data import and export via Excel (XLSX). Rather than implementing import/export routes per-module, we needed a standardised, RBAC-aware pattern that integrates with the existing `createRouter` factory, pg-schemata's `TableModel`, and the client-side toolbar system.

Key requirements:
- Every `createRouter`-generated resource gets import/export endpoints automatically
- Import/export must be individually permission-gated (distinct from CRUD permissions)
- Admins must be able to grant import without export, or vice versa, per role
- Client-side import/export must integrate with the existing `useModuleToolbarRegistration` pattern
- File handling must be safe (temp files cleaned up, no persistent storage)

## Decision

### Backend

Extend `createRouter` with two auto-generated routes per resource:

| Route | Middleware Chain | RBAC |
|-------|-----------------|------|
| `POST /import-xls` | `addAuditFields` → `moduleEntitlement` → `setImportAction` → `rbac('full')` → `multer` | Requires `full` on `import` action |
| `POST /export-xls` | `moduleEntitlement` → `setExportAction` → `rbac('view')` | Requires `view` on `export` action |

**Action overrides:** `setImportAction` and `setExportAction` middleware override `req.resource.action` to `'import'` and `'export'` respectively, before RBAC resolution. This makes import/export independently configurable in the policy matrix without conflicting with standard CRUD action resolution.

**Controller methods:**
- `BaseController.importXls()` — multer receives the file to `/tmp/uploads/`, calls `model.importFromSpreadsheet()` with a callback that injects `tenant_code` and `created_by`, returns `{ inserted: number }`
- `ViewController.exportXls()` — calls `model.exportToSpreadsheet()` to a temp file, sends via `res.download()`, cleans up the temp file after transfer

**Disable flags:** `disableImportXls: true` / `disableExportXls: true` in `createRouter` options for resources that should not support file operations.

### Frontend

Two custom hooks in `hooks/useImportExport.js`:

- `useImportXls(importFn, queryKey)` — TanStack `useMutation` wrapper; invalidates query cache on success
- `useExportXls(exportFn, filePrefix)` — TanStack `useMutation` wrapper; creates blob URL, triggers download as `${filePrefix}_${Date.now()}.xlsx`, cleans up

A shared `ImportDialog` component (`components/shared/ImportDialog.jsx`) wraps `FormDialog` with a file picker (`.xlsx`/`.xls`), file size display, and FormData submission.

**Page integration pattern:**
1. Permission check via `resolveLevel(caps, module, entity, 'import'|'export')`
2. Mutations via `useImportXls` / `useExportXls`
3. Toolbar buttons registered via `useModuleToolbarRegistration()`, gated by permission booleans
4. `ImportDialog` controlled by local state

### RBAC Policy Catalog

The `policyCatalogSeeder` includes `import` and `export` action entries for every module/router combination (with exceptions: `policy-catalog`, `ledger-balances`, and `match-review-logs` are export-only; `numbering-config` and reports module have neither). Migration `202603150013_importExportCatalog` seeds these entries for existing tenants.

## Consequences

**Positive:**
- Zero per-module boilerplate for import/export — adding a new resource automatically gets both endpoints
- Import and export are independently grantable per role via the standard policy matrix
- Consistent UX across all 16+ pages with toolbar buttons, permission gating, and toast feedback
- Temp file cleanup prevents disk accumulation

**Negative:**
- All resources share the same import/export controller logic — resources needing custom validation or transformation must override `importXls()`/`exportXls()` in their controller
- `mutateAsync` must be destructured from mutations (not the whole mutation object) to avoid infinite re-render loops via the toolbar registration cycle

**Risks:**
- Large file imports could cause timeout issues — no streaming/chunked import yet
- No import preview/dry-run — rows are inserted directly
