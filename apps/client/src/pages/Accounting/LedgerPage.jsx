/**
 * @file Ledger Balances read-only page — DataGrid showing account balances
 * @module client/pages/Accounting/LedgerPage
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { DataGrid } from '@mui/x-data-grid';

import { useLedgerBalances } from '../../hooks/useAccounting.js';
import { pageContainerSx } from '../../config/layoutTokens.js';
import { dateColumn, currencyColumn } from '../../utils/columnHelpers.jsx';

const columns = [
  { field: 'account_id', headerName: 'Account', width: 140, valueGetter: (params) => params.row.account_id?.slice(0, 8) ?? '\u2014' },
  dateColumn('as_of_date', 'As Of', { width: 130 }),
  currencyColumn('balance', 'Balance', { width: 160 }),
];

export default function LedgerPage() {
  const { data: res, isLoading } = useLedgerBalances();
  const rows = res?.rows ?? (Array.isArray(res) ? res : []);

  return (
    <Box sx={pageContainerSx}>
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>Ledger Balances</Typography>
      </Box>
      <DataGrid
        rows={rows}
        columns={columns}
        getRowId={(r) => r.id}
        loading={isLoading}
        pageSizeOptions={[25, 50, 100]}
        initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
        disableRowSelectionOnClick
      />
    </Box>
  );
}
