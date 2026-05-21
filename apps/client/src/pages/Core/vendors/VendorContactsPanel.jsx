/**
 * @file Vendor contacts tab panel — DataTable of vendor contacts for the view dialog
 * @module client/pages/Core/vendors/VendorContactsPanel
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import Box from '@mui/material/Box';

import DataTable from '../../../components/shared/DataTable.jsx';

const panelSx = { pt: 2 };
const dataGridProps = { autoHeight: true, checkboxSelection: false, pageSizeOptions: [10, 25] };

export default function VendorContactsPanel({ rows, columns, selection, onViewContact }) {
  return (
    <Box sx={panelSx}>
      <DataTable
        rows={rows}
        columns={columns}
        selection={selection}
        onView={onViewContact}
        dataGridProps={dataGridProps}
      />
    </Box>
  );
}
