/**
 * @file Shared read-only DataGrid wrapper for detail views
 * @module client/components/shared/ReadOnlyDataTable
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import { DataGrid } from '@mui/x-data-grid';

export default function ReadOnlyDataTable({ rows, columns, getRowId, dataGridProps = {} }) {
  return (
    <DataGrid
      rows={rows}
      columns={columns}
      getRowId={getRowId}
      autoHeight
      hideFooter
      disableColumnMenu
      disableRowSelectionOnClick
      {...dataGridProps}
    />
  );
}
