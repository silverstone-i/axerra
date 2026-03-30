/**
 * @file Contact View dialog — read-only display of vendor contact details
 * @module nap-client/pages/Core/vendors/ContactViewDialog
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
 */

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';

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
          <Button size="small" onClick={onClose}>Close</Button>
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
