/**
 * @file Shared report page shell with standard title and DataGrid
 * @module nap-client/components/shared/ReportTablePage
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
 */

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { DataGrid } from '@mui/x-data-grid';

import { pageContainerSx } from '../../config/layoutTokens.js';

const reportHeaderSx = { p: 2 };

export default function ReportTablePage({
  title,
  rows,
  columns,
  getRowId,
  loading,
  headerContent = null,
  dataGridProps = {},
}) {
  return (
    <Box sx={pageContainerSx}>
      <Box sx={reportHeaderSx}>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        {headerContent}
      </Box>
      <DataGrid
        rows={rows}
        columns={columns}
        getRowId={getRowId}
        loading={loading}
        pageSizeOptions={[25, 50, 100]}
        initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
        disableRowSelectionOnClick
        {...dataGridProps}
      />
    </Box>
  );
}
