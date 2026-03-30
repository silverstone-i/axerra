/**
 * @file Read-only standalone Contact detail dialog
 * @module nap-client/pages/Core/contacts/StandaloneContactViewDialog
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

export default function StandaloneContactViewDialog({
  open,
  onClose,
  contact,
  viewEmails,
  viewPhones,
  viewAddresses,
  viewTaxIds,
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={dialogHeaderSx}>
        <Box>
          <span>Contact Details</span>
          {contact && (
            <Typography variant="body2" color="text.secondary">
              {contact.name}
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
        {contact && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={detailGridSx}>
              <FieldRow label="Code" value={contact.code || '\u2014'} />
              <FieldRow label="Name" value={contact.name} />
              <FieldRow label="Active" value={contact.is_active ? 'Yes' : 'No'} />
              <FieldRow label="Status">
                <StatusBadge status={contact.deactivated_at ? 'archived' : 'active'} />
              </FieldRow>
              <FieldRow label="Created" value={fmtDate(contact.created_at)} />
              <FieldRow label="Updated" value={fmtDate(contact.updated_at)} />
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
