/**
 * @file Read-only standalone Contact detail dialog
 * @module client/pages/Core/contacts/StandaloneContactViewDialog
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import Box from '@mui/material/Box';

import DetailDialog from '../../../components/shared/DetailDialog.jsx';
import FieldRow from '../../../components/shared/FieldRow.jsx';
import StatusBadge from '../../../components/shared/StatusBadge.jsx';
import EmailsSection from '../../../components/shared/EmailsSection.jsx';
import PhoneNumbersSection from '../../../components/shared/PhoneNumbersSection.jsx';
import AddressesSection from '../../../components/shared/AddressesSection.jsx';
import TaxIdentifiersSection from '../../../components/shared/TaxIdentifiersSection.jsx';
import { fmtDate } from '../../../utils/format.js';
import { detailGridSx, flexColumnSx } from '../../../config/layoutTokens.js';

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
    <DetailDialog open={open} onClose={onClose} title="Contact Details" subtitle={contact?.name}>
      {contact && (
        <Box sx={flexColumnSx}>
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
    </DetailDialog>
  );
}
