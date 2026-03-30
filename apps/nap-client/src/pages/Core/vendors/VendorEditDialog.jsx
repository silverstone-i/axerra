/**
 * @file Edit Vendor dialog — extracted from VendorsPage
 * @module nap-client/pages/Core/vendors/VendorEditDialog
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
 */

import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

import ConfirmDialog from '../../../components/shared/ConfirmDialog.jsx';
import DataTable from '../../../components/shared/DataTable.jsx';
import PatternTextField from '../../../components/shared/PatternTextField.jsx';
import EmailRow from '../../../components/shared/EmailRow.jsx';
import PhoneRow from '../../../components/shared/PhoneRow.jsx';
import { formGridSx, formGroupCardSx, formFullSpanSx } from '../../../config/layoutTokens.js';
import { TAX_TYPES, COUNTRIES } from '@nap/shared';

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
            <Button size="small" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              size="small"
              type="submit"
              variant="contained"
              disabled={loading || !hasEditChanges}
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
            >
              Save Changes
            </Button>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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

              {/* ── Emails ──────────────────────────────────────────── */}
              <Divider />
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="subtitle2">Emails</Typography>
                <Button size="small" startIcon={<AddIcon />} onClick={emails.add}>Add Email</Button>
              </Box>
              {emails.indexedItems.length === 0 && (
                <Typography variant="body2" color="text.secondary">No emails</Typography>
              )}
              {emails.indexedItems.map(({ item: em, index: idx }) => (
                <EmailRow key={em.id || idx} item={em} index={idx} onUpdate={emails.update} onRemove={emails.remove} />
              ))}

              {/* ── Phone Numbers ──────────────────────────────────── */}
              <Divider />
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="subtitle2">Phone Numbers</Typography>
                <Button size="small" startIcon={<AddIcon />} onClick={phones.add}>Add Phone</Button>
              </Box>
              {phones.indexedItems.length === 0 && (
                <Typography variant="body2" color="text.secondary">No phone numbers</Typography>
              )}
              {phones.indexedItems.map(({ item: phone, index: idx }) => (
                <PhoneRow key={phone.id || idx} item={phone} index={idx} onUpdate={phones.update} onRemove={phones.remove} />
              ))}

              {/* ── Addresses ──────────────────────────────────────── */}
              <Divider />
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="subtitle2">Addresses</Typography>
                <Button size="small" startIcon={<AddIcon />} onClick={addresses.add}>Add Address</Button>
              </Box>
              {addresses.indexedItems.length === 0 && (
                <Typography variant="body2" color="text.secondary">No addresses</Typography>
              )}
              {addresses.indexedItems.map(({ item: addr, index: idx }) => (
                <Box key={addr.id || idx} sx={{ ...formGroupCardSx, gridColumn: undefined }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <TextField
                      label="Label"
                      value={addr.label}
                      onChange={(e) => addresses.update(idx, 'label', e.target.value)}
                      size="small"
                      sx={{ width: 200 }}
                    />
                    <IconButton size="small" onClick={() => addresses.remove(idx)} color="error">
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Box>
                  <Box sx={formGridSx}>
                    <TextField label="Address Line 1" value={addr.address_line_1} onChange={(e) => addresses.update(idx, 'address_line_1', e.target.value)} size="small" sx={formFullSpanSx} />
                    <TextField label="Address Line 2" value={addr.address_line_2} onChange={(e) => addresses.update(idx, 'address_line_2', e.target.value)} size="small" sx={formFullSpanSx} />
                    <TextField label="Address Line 3" value={addr.address_line_3 || ''} onChange={(e) => addresses.update(idx, 'address_line_3', e.target.value)} size="small" sx={formFullSpanSx} />
                    <TextField label="City" value={addr.city} onChange={(e) => addresses.update(idx, 'city', e.target.value)} size="small" />
                    <TextField label="State / Province" value={addr.state_province} onChange={(e) => addresses.update(idx, 'state_province', e.target.value)} size="small" />
                    <TextField label="Postal Code" value={addr.postal_code} onChange={(e) => addresses.update(idx, 'postal_code', e.target.value)} size="small" />
                    <TextField label="Country Code" value={addr.country_code} onChange={(e) => addresses.update(idx, 'country_code', e.target.value)} size="small" inputProps={{ maxLength: 2 }} />
                  </Box>
                </Box>
              ))}

              {/* ── Tax Identifiers ──────────────────────────────────── */}
              <Divider />
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="subtitle2">Tax Identifiers</Typography>
                <Button size="small" startIcon={<AddIcon />} onClick={taxIds.add}>Add Tax ID</Button>
              </Box>
              {taxIds.indexedItems.length === 0 && (
                <Typography variant="body2" color="text.secondary">No tax identifiers</Typography>
              )}
              {taxIds.indexedItems.map(({ item: taxId, index: idx }) => {
                const countryCode = taxId.country_code?.trim() || '';
                const taxTypes = TAX_TYPES[countryCode] || TAX_TYPES._OTHER;
                return (
                  <Box key={taxId.id || idx} sx={{ ...formGroupCardSx, gridColumn: undefined }}>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                      <TextField
                        select
                        label="Country"
                        value={countryCode}
                        onChange={(e) => {
                          taxIds.update(idx, 'country_code', e.target.value);
                          const newTypes = TAX_TYPES[e.target.value] || TAX_TYPES._OTHER;
                          taxIds.update(idx, 'tax_type', newTypes[0]?.code || 'TIN');
                        }}
                        SelectProps={{ renderValue: (val) => val }}
                        size="small"
                        sx={{ minWidth: 80 }}
                      >
                        {COUNTRIES.map((c) => (
                          <MenuItem key={c.code} value={c.code}>{c.code} - {c.name}</MenuItem>
                        ))}
                      </TextField>
                      <TextField
                        select
                        label="Type"
                        value={taxId.tax_type}
                        onChange={(e) => taxIds.update(idx, 'tax_type', e.target.value)}
                        SelectProps={{ renderValue: (val) => val }}
                        size="small"
                        sx={{ minWidth: 80 }}
                      >
                        {taxTypes.map((t) => (
                          <MenuItem key={t.code} value={t.code}>{t.label}</MenuItem>
                        ))}
                      </TextField>
                      <PatternTextField
                        label="Tax ID Value"
                        value={taxId.tax_value}
                        onChange={(raw) => taxIds.update(idx, 'tax_value', raw)}
                        pattern={taxTypes.find((t) => t.code === taxId.tax_type)?.placeholder}
                        size="small"
                        sx={{ flex: 1, minWidth: 160 }}
                      />
                      <IconButton size="small" onClick={() => taxIds.remove(idx)} color="error">
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                );
              })}
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
                  <Button
                    size="small" variant="outlined" color="error"
                    disabled={contactSelection.selectedRows.length === 0 || !contactSelection.allActive}
                    onClick={onContactArchive}
                  >
                    {contactSelection.selectedRows.length > 1 ? `Archive (${contactSelection.selectedRows.length})` : 'Archive'}
                  </Button>
                )}
                {(contactViewFilter === 'archived' || contactViewFilter === 'all') && (
                  <Button
                    size="small" variant="outlined" color="success"
                    disabled={contactSelection.selectedRows.length === 0 || !contactSelection.allArchived}
                    onClick={onContactRestore}
                  >
                    {contactSelection.selectedRows.length > 1 ? `Restore (${contactSelection.selectedRows.length})` : 'Restore'}
                  </Button>
                )}
                {contactViewFilter !== 'archived' && (
                  <Button size="small" startIcon={<AddIcon />} onClick={onCreateContact}>
                    Create Contact
                  </Button>
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
