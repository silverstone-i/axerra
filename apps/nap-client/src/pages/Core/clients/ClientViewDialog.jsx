/**
 * @file Read-only Client detail dialog
 * @module nap-client/pages/Core/clients/ClientViewDialog
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
import EmailsSection from '../../../components/shared/EmailsSection.jsx';
import PhoneNumbersSection from '../../../components/shared/PhoneNumbersSection.jsx';
import AddressesSection from '../../../components/shared/AddressesSection.jsx';
import TaxIdentifiersSection from '../../../components/shared/TaxIdentifiersSection.jsx';
import { fmtDate } from '../../../utils/format.js';
import { dialogHeaderSx, dialogActionBoxSx, detailGridSx } from '../../../config/layoutTokens.js';

export default function ClientViewDialog({
  open,
  onClose,
  client,
  viewEmails,
  viewPhones,
  viewAddresses,
  viewTaxIds,
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={dialogHeaderSx}>
        <Box>
          <span>Client Details</span>
          {client && (
            <Typography variant="body2" color="text.secondary">
              {client.name}
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
        {client && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={detailGridSx}>
              <FieldRow label="Code" value={client.code || '\u2014'} />
              <FieldRow label="Name" value={client.name} />
              <FieldRow label="Active" value={client.is_active ? 'Yes' : 'No'} />
              <FieldRow label="App User" value={client.is_app_user ? 'Yes' : 'No'} />
              <FieldRow label="Roles" value={client.roles?.length ? client.roles.join(', ') : '\u2014'} />
              <FieldRow label="Status">
                <StatusBadge status={client.deactivated_at ? 'archived' : 'active'} />
              </FieldRow>
              <FieldRow label="Created" value={fmtDate(client.created_at)} />
              <FieldRow label="Updated" value={fmtDate(client.updated_at)} />
            </Box>

            <EmailsSection emails={viewEmails} />
            <PhoneNumbersSection phones={viewPhones} />
            <AddressesSection addresses={viewAddresses} />
            <TaxIdentifiersSection taxIds={viewTaxIds} />
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
