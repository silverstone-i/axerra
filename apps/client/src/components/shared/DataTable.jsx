/**
 * @file DataTable — standardised DataGrid wrapper with selection and row actions
 * @module client/components/shared/DataTable
 *
 * Wraps MUI X DataGrid v6 with:
 *   - Integrated selection (useListSelection) — Click / Ctrl+Click / Shift+Click
 *   - Per-row kebab (⋮) actions column (RowActionsMenu)
 *   - Default archived-row className and pagination
 *
 * Bulk actions (Archive / Restore) live in the page-level ModuleBar.
 *
 * Styling via theme overrides and className; pages may pass sx through dataGridProps.
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import { useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { DataGrid } from '@mui/x-data-grid';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import RowActionsMenu from './RowActionsMenu.jsx';
import { useTenantPrefs } from '../../contexts/TenantPreferencesContext.jsx';

export const PAGE_SIZE_OPTIONS = [25, 50, 100, 200, 500, 1000];
export const REPORT_PAGE_SIZE_OPTIONS = [25, 50, 100];

/**
 * @param {Object}   props
 * @param {Array}    props.rows                - data rows (each must have `id`)
 * @param {Array}    props.columns             - DataGrid column definitions
 * @param {boolean}  [props.loading]
 * @param {Object}   props.selection           - return value from useListSelection
 * @param {Function} [props.onView]            - (row) => void; adds View to row actions
 * @param {Function} [props.onEdit]            - (row) => void; adds Edit to row actions
 * @param {Array|Function} [props.rowActions] - static [{ label, icon?, onClick(row) }] or (row) => actions[]
 * @param {string}   [props.emptyMessage]      - message shown when no rows (default: 'No records found')
 * @param {Function} [props.getRowClassName]   - custom className builder (merged with archived default)
 * @param {Object}   [props.dataGridProps]     - pass-through props for DataGrid
 */
export default function DataTable({
  rows,
  columns,
  loading,
  selection,
  onView,
  onEdit,
  rowActions = [],
  emptyMessage = 'No records found',
  getRowClassName,
  dataGridProps = {},
}) {
  const { defaultPageSize } = useTenantPrefs();
  // Base actions (static across all rows)
  const baseActions = useMemo(() => {
    const actions = [];
    if (onView) actions.push({ label: 'View', icon: <VisibilityOutlinedIcon fontSize="small" />, onClick: onView });
    if (onEdit) actions.push({ label: 'Edit', icon: <EditOutlinedIcon fontSize="small" />, onClick: onEdit });
    return actions;
  }, [onView, onEdit]);

  const isRowActionsFn = typeof rowActions === 'function';
  const hasAnyActions = baseActions.length > 0 || (isRowActionsFn || rowActions.length > 0);

  // Append actions column
  const mergedColumns = useMemo(() => {
    if (!hasAnyActions) return columns;

    const actionsCol = {
      field: '__actions',
      headerName: '',
      width: 48,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      disableReorder: true,
      cellClassName: 'row-actions-cell',
      renderCell: (params) => {
        const extra = isRowActionsFn ? rowActions(params.row) : rowActions;
        const extraArr = Array.isArray(extra) ? extra : [];
        const actions = [...baseActions, ...extraArr];
        return <RowActionsMenu row={params.row} actions={actions} />;
      },
    };

    return [...columns, actionsCol];
  }, [columns, baseActions, rowActions, isRowActionsFn, hasAnyActions]);

  // Merge archived className with custom
  const mergedGetRowClassName = useMemo(() => {
    return (params) => {
      const archived = params.row.deactivated_at ? 'row-archived' : '';
      const custom = getRowClassName ? getRowClassName(params) : '';
      return [archived, custom].filter(Boolean).join(' ');
    };
  }, [getRowClassName]);

  const NoRowsOverlay = useMemo(() => {
    const msg = emptyMessage;
    return function Overlay(props) {
      return (
        <Box {...props} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 1, py: 4, ...props?.sx }}>
          <InboxOutlinedIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
          <Typography variant="body2" color="text.secondary">{msg}</Typography>
        </Box>
      );
    };
  }, [emptyMessage]);

  return (
    <DataGrid
      key={defaultPageSize}
      rows={rows}
      columns={mergedColumns}
      getRowId={(r) => r.id}
      loading={loading}
      checkboxSelection
      disableRowSelectionOnClick
      rowSelectionModel={selection.selectionModel}
      onRowSelectionModelChange={selection.handleSelectionModelChange}
      onRowClick={selection.handleRowClick}
      pageSizeOptions={PAGE_SIZE_OPTIONS}
      initialState={{ pagination: { paginationModel: { pageSize: defaultPageSize } } }}
      getRowClassName={mergedGetRowClassName}
      {...dataGridProps}
      slots={{ noRowsOverlay: NoRowsOverlay, ...(dataGridProps.slots || {}) }}
      slotProps={{ ...dataGridProps.slotProps, noRowsOverlay: { ...(dataGridProps.slotProps?.noRowsOverlay || {}) } }}
    />
  );
}
