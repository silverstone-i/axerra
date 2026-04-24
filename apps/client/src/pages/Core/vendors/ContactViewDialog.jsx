/**
 * @file Contact View dialog — read-only display of vendor contact details
 * @module client/pages/Core/vendors/ContactViewDialog
 *
 * Copyright (c) 2025 – present Vimber LLC. All rights reserved.
 */

import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';

import TertiaryButton from '../../../components/shared/TertiaryButton.jsx';
import FieldRow from '../../../components/shared/FieldRow.jsx';
import EmailsSection from '../../../components/shared/EmailsSection.jsx';
import PhoneNumbersSection from '../../../components/shared/PhoneNumbersSection.jsx';
import { dialogHeaderSx, dialogActionBoxSx, detailGridSx, flexColumnSx } from '../../../config/layoutTokens.js';

export default function ContactViewDialog({ open, onClose, contact, emails, phones }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth disableRestoreFocus>
      <DialogTitle sx={dialogHeaderSx}>
        <span>{contact ? `${contact.first_name} ${contact.last_name}` : 'Contact Details'}</span>
        <Box sx={dialogActionBoxSx}>
          <TertiaryButton size="small" onClick={onClose}>Close</TertiaryButton>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        {contact && (
          <Box sx={flexColumnSx}>
            <Box sx={detailGridSx}>
              <FieldRow label="First Name" value={contact.first_name} />
              <FieldRow label="Last Name" value={contact.last_name} />
              <FieldRow label="Position" value={contact.position || '\u2014'} />
              <FieldRow label="Department" value={contact.department || '\u2014'} />
              <FieldRow label="App User" value={contact.is_app_user ? 'Yes' : 'No'} />
              <FieldRow label="Roles" value={contact.roles?.length ? contact.roles.join(', ') : '\u2014'} />
            </Box>
            <Divider />
            <EmailsSection emails={emails} />
            <PhoneNumbersSection phones={phones} />
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
