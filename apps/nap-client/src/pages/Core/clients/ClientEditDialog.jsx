/**
 * @file Edit Client dialog with sub-collection editors
 * @module nap-client/pages/Core/clients/ClientEditDialog
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
 */

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import LockResetIcon from '@mui/icons-material/LockReset';

import FormDialog from '../../../components/shared/FormDialog.jsx';
import EditableAddressesSection from '../../../components/shared/EditableAddressesSection.jsx';
import EditableEmailsSection from '../../../components/shared/EditableEmailsSection.jsx';
import EditablePhoneNumbersSection from '../../../components/shared/EditablePhoneNumbersSection.jsx';
import EditableTaxIdentifiersSection from '../../../components/shared/EditableTaxIdentifiersSection.jsx';
import { formGridSx, formFullSpanSx } from '../../../config/layoutTokens.js';

export default function ClientEditDialog({
  open,
  onClose,
  editForm,
  onEditField,
  setEditForm,
  editRow,
  emails,
  phones,
  addresses,
  taxIds,
  roleOptions,
  hasEditChanges,
  onSubmit,
  loading,
  onResetPassword,
  onAppUserToggle,
}) {
  return (
    <FormDialog open={open} title="Edit Client" submitLabel="Save Changes" maxWidth="md" loading={loading} submitDisabled={!hasEditChanges} onSubmit={onSubmit} onCancel={onClose}>
      <Box sx={formGridSx}>
        <TextField label="Client Name" required value={editForm.name} onChange={onEditField('name')} />
        <TextField label="Code" value={editForm.code} onChange={onEditField('code')} inputProps={{ maxLength: 16 }} />
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
        <FormControlLabel
          control={<Checkbox checked={editForm.is_app_user} onChange={onAppUserToggle} size="small" />}
          label="App User (creates login account)"
        />
        {editForm.is_app_user && editRow?.is_app_user && (
          <Button size="small" startIcon={<LockResetIcon />} onClick={onResetPassword}>
            Reset Password
          </Button>
        )}
        <Autocomplete
          multiple
          options={roleOptions}
          getOptionLabel={(opt) => opt.name}
          isOptionEqualToValue={(opt, val) => opt.code === val.code}
          value={roleOptions.filter((r) => editForm.roles.includes(r.code))}
          onChange={(_, v) => setEditForm((p) => ({ ...p, roles: v.map((r) => r.code) }))}
          renderInput={(params) => <TextField {...params} label="Roles" />}
          sx={formFullSpanSx}
        />
      </Box>
      <EditableEmailsSection collection={emails} />
      <EditablePhoneNumbersSection collection={phones} />
      <EditableAddressesSection collection={addresses} />
      <EditableTaxIdentifiersSection collection={taxIds} />
    </FormDialog>
  );
}
