/**
 * @file Edit Vendor dialog — extracted from VendorsPage
 * @module nap-client/pages/Core/vendors/VendorEditDialog
 *
 * Copyright (c) 2025 – present Vimber LLC. All rights reserved.
 */

import { useState } from 'react';
import Box from '@mui/material/Box';
import PrimaryButton from '../../../components/shared/PrimaryButton.jsx';
import SecondaryButton from '../../../components/shared/SecondaryButton.jsx';
import TertiaryButton from '../../../components/shared/TertiaryButton.jsx';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import AddIcon from '@mui/icons-material/Add';

import ConfirmDialog from '../../../components/shared/ConfirmDialog.jsx';
import DataTable from '../../../components/shared/DataTable.jsx';
import EditableAddressesSection from '../../../components/shared/EditableAddressesSection.jsx';
import EditableEmailsSection from '../../../components/shared/EditableEmailsSection.jsx';
import EditablePhoneNumbersSection from '../../../components/shared/EditablePhoneNumbersSection.jsx';
import EditableTaxIdentifiersSection from '../../../components/shared/EditableTaxIdentifiersSection.jsx';
import { formGridSx, flexColumnSx } from '../../../config/layoutTokens.js';

const dialogSx = { '& .MuiDialogTitle-root + .MuiDialogContent-root': { paddingTop: '16px' } };

export default function VendorEditDialog({
  open,
  onClose,
  editForm,
  onEditField,
  setEditForm,
  emails,
  phones,
  addresses,
  taxIds,
  paymentTermsList,
  hasEditChanges,
  onSubmit,
  loading,
  filteredContacts,
  contactColumns,
  contactSelection,
  contactViewFilter,
  setContactViewFilter,
  onContactArchive,
  onContactRestore,
  contactArchiveProps,
  contactRestoreProps,
  onCreateContact,
  onViewContact,
  onEditContact,
}) {
  const [editTab, setEditTab] = useState(0);

  const handleClose = () => {
    onClose();
    setEditTab(0);
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth disableRestoreFocus sx={dialogSx}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
          <span>Edit Vendor</span>
          <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
            <TertiaryButton size="small" onClick={handleClose} disabled={loading}>
              Cancel
            </TertiaryButton>
            <PrimaryButton
              size="small"
              type="submit"
              disabled={loading || !hasEditChanges}
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
            >
              Save Changes
            </PrimaryButton>
          </Box>
        </DialogTitle>
        <DialogContent sx={flexColumnSx}>
          <Tabs value={editTab} onChange={(_, v) => setEditTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tab label="Vendor" />
            <Tab label="Contacts" />
          </Tabs>

          {editTab === 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <Box sx={formGridSx}>
                <TextField label="Vendor Name" required value={editForm.name} onChange={onEditField('name')} />
                <TextField label="Code" value={editForm.code} onChange={onEditField('code')} inputProps={{ maxLength: 16 }} />
                <TextField
                  label="Payment Terms"
                  select
                  value={editForm.payment_term_id}
                  onChange={onEditField('payment_term_id')}
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {paymentTermsList.map((pt) => (
                    <MenuItem key={pt.id} value={pt.id}>{pt.label}</MenuItem>
                  ))}
                </TextField>
                <TextField label="Notes" multiline minRows={2} value={editForm.notes} onChange={onEditField('notes')} />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={editForm.is_active}
                      onChange={(e) => setEditForm((p) => ({ ...p, is_active: e.target.checked }))}
                      size="small"
                    />
                  }
                  label="Active"
                />
              </Box>
              <EditableEmailsSection collection={emails} />
              <EditablePhoneNumbersSection collection={phones} />
              <EditableAddressesSection collection={addresses} />
              <EditableTaxIdentifiersSection collection={taxIds} />
            </Box>
          )}

          {editTab === 1 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <Tabs value={contactViewFilter} onChange={(_, v) => { setContactViewFilter(v); contactSelection.clearSelection(); }} sx={{ minHeight: 32 }}>
                <Tab value="active" label="Active" sx={{ minHeight: 32, py: 0 }} />
                <Tab value="all" label="All" sx={{ minHeight: 32, py: 0 }} />
                <Tab value="archived" label="Archived" sx={{ minHeight: 32, py: 0 }} />
              </Tabs>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                {(contactViewFilter === 'active' || contactViewFilter === 'all') && (
                  <SecondaryButton
                    size="small"
                    disabled={contactSelection.selectedRows.length === 0 || !contactSelection.allActive}
                    onClick={onContactArchive}
                  >
                    {contactSelection.selectedRows.length > 1 ? `Archive (${contactSelection.selectedRows.length})` : 'Archive'}
                  </SecondaryButton>
                )}
                {(contactViewFilter === 'archived' || contactViewFilter === 'all') && (
                  <SecondaryButton
                    size="small"
                    disabled={contactSelection.selectedRows.length === 0 || !contactSelection.allArchived}
                    onClick={onContactRestore}
                  >
                    {contactSelection.selectedRows.length > 1 ? `Restore (${contactSelection.selectedRows.length})` : 'Restore'}
                  </SecondaryButton>
                )}
                {contactViewFilter !== 'archived' && (
                  <TertiaryButton size="small" startIcon={<AddIcon />} onClick={onCreateContact}>
                    Create Contact
                  </TertiaryButton>
                )}
              </Box>
              <DataTable
                rows={filteredContacts}
                columns={contactColumns}
                selection={contactSelection}
                onView={onViewContact}
                onEdit={onEditContact}
                dataGridProps={{ autoHeight: true, checkboxSelection: true, pageSizeOptions: [10, 25] }}
              />
              <ConfirmDialog {...contactArchiveProps} />
              {contactRestoreProps && <ConfirmDialog {...contactRestoreProps} />}
            </Box>
          )}
        </DialogContent>
      </form>
    </Dialog>
  );
}
