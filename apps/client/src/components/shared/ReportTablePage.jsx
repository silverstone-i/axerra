/**
 * @file Shared report page shell with standard title and DataGrid
 * @module client/components/shared/ReportTablePage
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { DataGrid } from '@mui/x-data-grid';

import { REPORT_PAGE_SIZE_OPTIONS } from './DataTable.jsx';
import { pageContainerSx } from '../../config/layoutTokens.js';
import { errMsg } from '../../utils/format.js';

const reportHeaderSx = { p: 2 };

export default function ReportTablePage({
  title,
  rows,
  columns,
  getRowId,
  loading,
  error = null,
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
      {error ? (
        <Alert severity="error" sx={{ m: 2 }}>
          {errMsg(error)}
        </Alert>
      ) : (
        <DataGrid
          rows={rows}
          columns={columns}
          getRowId={getRowId}
          loading={loading}
          pageSizeOptions={REPORT_PAGE_SIZE_OPTIONS}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          disableRowSelectionOnClick
          {...dataGridProps}
        />
      )}
    </Box>
  );
}
