/**
 * @file VendorViewDialog — read-only view dialog for a vendor with Vendor / Contacts tabs
 * @module nap-client/pages/Core/vendors/VendorViewDialog
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
 */

import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';

import StatusBadge from '../../../components/shared/StatusBadge.jsx';
import FieldRow from '../../../components/shared/FieldRow.jsx';
import DataTable from '../../../components/shared/DataTable.jsx';
import EmailsSection from '../../../components/shared/EmailsSection.jsx';
import PhoneNumbersSection from '../../../components/shared/PhoneNumbersSection.jsx';
import AddressesSection from '../../../components/shared/AddressesSection.jsx';
import TaxIdentifiersSection from '../../../components/shared/TaxIdentifiersSection.jsx';
import { dialogHeaderSx, dialogActionBoxSx, detailGridSx } from '../../../config/layoutTokens.js';
import { fmtDate } from '../../../utils/format.js';

export default function VendorViewDialog({
  open,
  onClose,
  vendor,
  ptMap,
  viewEmails,
  viewPhones,
  viewAddresses,
  viewTaxIds,
  viewContacts,
  contactColumns,
  contactSelection,
  onViewContact,
}) {
  const [viewTab, setViewTab] = useState(0);

  const handleClose = () => {
    onClose();
    setViewTab(0);
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={dialogHeaderSx}>
        <Box>
          <span>Vendor Details</span>
          {vendor && (
            <Typography variant="body2" color="text.secondary">
              {vendor.name}
            </Typography>
          )}
        </Box>
        <Box sx={dialogActionBoxSx}>
          <Button size="small" color="inherit" onClick={handleClose}>
            Close
          </Button>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        {vendor && (
          <>
            <Tabs value={viewTab} onChange={(_, v) => setViewTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tab label="Vendor" />
              <Tab label="Contacts" />
            </Tabs>

            {viewTab === 0 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
                <Box sx={detailGridSx}>
                  <FieldRow label="Code" value={vendor.code || '\u2014'} />
                  <FieldRow label="Vendor Name" value={vendor.name} />
                  <FieldRow label="Payment Terms" value={ptMap.get(vendor.payment_term_id) || '\u2014'} />
                  <FieldRow label="Active" value={vendor.is_active ? 'Yes' : 'No'} />
                  <FieldRow label="Status">
                    <StatusBadge status={vendor.deactivated_at ? 'archived' : 'active'} />
                  </FieldRow>
                  <FieldRow label="Created" value={fmtDate(vendor.created_at)} />
                  <FieldRow label="Updated" value={fmtDate(vendor.updated_at)} />
                </Box>
                {vendor.notes && (
                  <>
                    <Divider />
                    <FieldRow label="Notes" value={vendor.notes} />
                  </>
                )}

                <EmailsSection emails={viewEmails} />
                <PhoneNumbersSection phones={viewPhones} />
                <AddressesSection addresses={viewAddresses} />
                <TaxIdentifiersSection taxIds={viewTaxIds} />
              </Box>
            )}

            {viewTab === 1 && (
              <Box sx={{ pt: 2 }}>
                <DataTable
                  rows={viewContacts}
                  columns={contactColumns}
                  selection={contactSelection}
                  onView={onViewContact}
                  dataGridProps={{ autoHeight: true, checkboxSelection: false, pageSizeOptions: [10, 25] }}
                />
              </Box>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
