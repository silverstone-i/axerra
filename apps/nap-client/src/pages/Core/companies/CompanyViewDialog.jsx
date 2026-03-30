/**
 * @file Read-only Company detail dialog
 * @module nap-client/pages/Core/companies/CompanyViewDialog
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
 */

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';

import FieldRow from '../../../components/shared/FieldRow.jsx';
import StatusBadge from '../../../components/shared/StatusBadge.jsx';
import AddressesSection from '../../../components/shared/AddressesSection.jsx';
import TaxIdentifiersSection from '../../../components/shared/TaxIdentifiersSection.jsx';
import { fmtDate } from '../../../utils/format.js';
import { dialogHeaderSx, dialogActionBoxSx, detailGridSx, flexColumnSx } from '../../../config/layoutTokens.js';

export default function CompanyViewDialog({
  open,
  onClose,
  company,
  viewAddresses,
  viewTaxIds,
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={dialogHeaderSx}>
        <Box>
          <span>Company Details</span>
          {company && (
            <Typography variant="body2" color="text.secondary">
              {company.name}
            </Typography>
          )}
        </Box>
        <Box sx={dialogActionBoxSx}>
          <Button size="small" color="inherit" onClick={onClose}>
            Close
          </Button>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        {company && (
          <Box sx={flexColumnSx}>
            <Box sx={detailGridSx}>
              <FieldRow label="Code" value={company.code || '\u2014'} />
              <FieldRow label="Name" value={company.name} />
              <FieldRow label="Active" value={company.is_active ? 'Yes' : 'No'} />
              <FieldRow label="Status">
                <StatusBadge status={company.deactivated_at ? 'archived' : 'active'} />
              </FieldRow>
              <FieldRow label="Created" value={fmtDate(company.created_at)} />
              <FieldRow label="Updated" value={fmtDate(company.updated_at)} />
            </Box>
            <AddressesSection addresses={viewAddresses} />
            <TaxIdentifiersSection taxIds={viewTaxIds} />
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
