/**
 * @file Multi-select helpers — root-entity mutual exclusion & derived state
 * @module client/utils/selectionUtils
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

/** Root tenant code from env (set in monorepo root .env). */
export const ROOT_TENANT = (import.meta.env.VITE_ROOT_TENANT_CODE || 'AXERRA').toUpperCase();

/**
 * Check whether a row is a root entity that must be mutually exclusive in
 * multi-select grids.
 *
 * @param {Object} row
 * @param {'tenant'|'user'} entityType
 * @returns {boolean}
 */
export function isRootEntity(row, entityType) {
  if (entityType === 'tenant') return row.tenant_code === ROOT_TENANT;
  // Pure identity table — no role column. Fall back to checking tenant_code
  // on the enriched row (joined from tenants table by server).
  return row.tenant_code === ROOT_TENANT;
}

/**
 * Pure transform that enforces root-entity mutual exclusion on a proposed
 * selection model:
 *   - Selecting a root entity deselects everything else.
 *   - Selecting a non-root entity while root is selected deselects root.
 *
 * Used by both checkbox/keyboard paths (via buildMutualExclusionHandler) and
 * row-click paths (useListSelection.handleRowClick) to keep behavior identical.
 *
 * @param {Array} prevModel  – previous selectionModel
 * @param {Array} newModel   – proposed next selectionModel
 * @param {Array} rows       – visible DataGrid rows
 * @param {'tenant'|'user'} entityType
 * @returns {Array} the resolved selectionModel
 */
export function applyMutualExclusion(prevModel, newModel, rows, entityType) {
  const prevSet = new Set(prevModel);
  const added = newModel.filter((id) => !prevSet.has(id));

  if (added.length === 0) return newModel;

  // O(1) id → row lookups; avoids the prior O(rows × selectionSize) cost
  // when this runs on every modifier-key click and large-selection updates.
  const byId = new Map(rows.map((r) => [r.id, r]));
  const isRoot = (id) => {
    const r = byId.get(id);
    return !!r && isRootEntity(r, entityType);
  };

  if (added.some(isRoot)) return added.filter(isRoot);
  return newModel.filter((id) => !isRoot(id));
}

/**
 * Build an onRowSelectionModelChange handler that enforces mutual exclusion
 * for root entities. Thin wrapper around {@link applyMutualExclusion}.
 *
 * @param {Object}   opts
 * @param {Array}    opts.rows        – visible DataGrid rows
 * @param {Array}    opts.prevModel   – current selectionModel state value
 * @param {Function} opts.setModel    – selectionModel state setter
 * @param {'tenant'|'user'} opts.entityType
 * @returns {Function}
 */
export function buildMutualExclusionHandler({ rows, prevModel, setModel, entityType }) {
  return (newModel) => {
    setModel(applyMutualExclusion(prevModel, newModel, rows, entityType));
  };
}

/**
 * Derive common selection state from the current selectionModel and rows.
 *
 * @param {Array}  selectionModel
 * @param {Array}  rows
 * @param {'tenant'|'user'} entityType
 */
export function deriveSelectionState(selectionModel, rows, entityType) {
  const selectedRows = selectionModel.map((id) => rows.find((r) => r.id === id)).filter(Boolean);

  return {
    selectedRows,
    selected: selectedRows.length === 1 ? selectedRows[0] : null,
    isSingle: selectedRows.length === 1,
    hasSelection: selectedRows.length > 0,
    hasRootSelected: entityType ? selectedRows.some((r) => isRootEntity(r, entityType)) : false,
    allActive: selectedRows.length > 0 && selectedRows.every((r) => !r.deactivated_at),
    allArchived: selectedRows.length > 0 && selectedRows.every((r) => !!r.deactivated_at),
  };
}

/**
 * Build standard Archive / Restore toolbar action objects.
 *
 * Returns an array that can be spread into `primaryActions`:
 * ```js
 * primaryActions: [
 *   { label: 'Create', ... },
 *   ...buildBulkActions({ ... }),
 * ]
 * ```
 *
 * @param {Object}   opts
 * @param {Array}    opts.selectedRows
 * @param {boolean}  opts.hasSelection
 * @param {boolean}  opts.allActive
 * @param {boolean}  [opts.allArchived]
 * @param {Function} opts.onArchive      – called when Archive clicked (typically `() => setArchiveOpen(true)`)
 * @param {Function} [opts.onRestore]    – omit to suppress Restore button
 * @param {boolean}  [opts.archiveDisabled] – extra disabled condition for Archive
 * @param {boolean}  [opts.restoreDisabled] – extra disabled condition for Restore
 * @returns {Array}
 */
export function buildBulkActions({ selectedRows, hasSelection, allActive, allArchived, onArchive, onRestore, archiveDisabled, restoreDisabled }) {
  const actions = [];
  if (onArchive) {
    actions.push({
      label: selectedRows.length > 1 ? `Archive (${selectedRows.length})` : 'Archive',
      variant: 'outlined',
      disabled: !hasSelection || !allActive || !!archiveDisabled,
      onClick: onArchive,
    });
  }
  if (onRestore) {
    actions.push({
      label: selectedRows.length > 1 ? `Restore (${selectedRows.length})` : 'Restore',
      variant: 'outlined',
      disabled: !hasSelection || !allArchived || !!restoreDisabled,
      onClick: onRestore,
    });
  }
  return actions;
}
