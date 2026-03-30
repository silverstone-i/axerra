/**
 * @file Read-only Employee detail dialog
 * @module nap-client/pages/Core/employees/EmployeeViewDialog
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
import { dialogHeaderSx, dialogActionBoxSx, detailGridSx, flexColumnSx } from '../../../config/layoutTokens.js';

export default function EmployeeViewDialog({
  open,
  onClose,
  employee,
  viewPhones,
  viewEmails,
  viewAddresses,
  viewTaxIds,
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={dialogHeaderSx}>
        <Box>
          <span>Employee Details</span>
          {employee && (
            <Typography variant="body2" color="text.secondary">
              {employee.first_name} {employee.last_name}
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
        {employee && (
          <Box sx={flexColumnSx}>
            <Box sx={detailGridSx}>
              <FieldRow label="Code" value={employee.code || '\u2014'} />
              <FieldRow label="First Name" value={employee.first_name} />
              <FieldRow label="Last Name" value={employee.last_name} />
              <FieldRow label="Position" value={employee.position || '\u2014'} />
              <FieldRow label="Department" value={employee.department || '\u2014'} />
              <FieldRow label="App User" value={employee.is_app_user ? 'Yes' : 'No'} />
              <FieldRow label="Roles" value={(employee.roles ?? []).join(', ') || '\u2014'} />
              <FieldRow label="Status">
                <StatusBadge status={employee.deactivated_at ? 'archived' : 'active'} />
              </FieldRow>
              <FieldRow label="Primary Contact" value={employee.is_primary_contact ? 'Yes' : 'No'} />
              <FieldRow label="Billing Contact" value={employee.is_billing_contact ? 'Yes' : 'No'} />
              <FieldRow label="Created" value={fmtDate(employee.created_at)} />
              <FieldRow label="Updated" value={fmtDate(employee.updated_at)} />
            </Box>

            <PhoneNumbersSection phones={viewPhones} />
            <EmailsSection emails={viewEmails} showLogin />
            <AddressesSection addresses={viewAddresses} />
            <TaxIdentifiersSection taxIds={viewTaxIds} />
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
