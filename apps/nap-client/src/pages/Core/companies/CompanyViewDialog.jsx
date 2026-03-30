/**
 * @file Read-only Company detail dialog
 * @module nap-client/pages/Core/companies/CompanyViewDialog
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
 */

import Box from '@mui/material/Box';

import DetailDialog from '../../../components/shared/DetailDialog.jsx';
import FieldRow from '../../../components/shared/FieldRow.jsx';
import StatusBadge from '../../../components/shared/StatusBadge.jsx';
import AddressesSection from '../../../components/shared/AddressesSection.jsx';
import TaxIdentifiersSection from '../../../components/shared/TaxIdentifiersSection.jsx';
import { fmtDate } from '../../../utils/format.js';
import { detailGridSx, flexColumnSx } from '../../../config/layoutTokens.js';

export default function CompanyViewDialog({
  open,
  onClose,
  company,
  viewAddresses,
  viewTaxIds,
}) {
  return (
    <DetailDialog open={open} onClose={onClose} title="Company Details" subtitle={company?.name}>
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
    </DetailDialog>
  );
}
