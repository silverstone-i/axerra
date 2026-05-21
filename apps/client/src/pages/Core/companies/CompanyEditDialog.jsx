/**
 * @file Edit Company dialog with address + tax ID editors
 * @module client/pages/Core/companies/CompanyEditDialog
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import Box from '@mui/material/Box';
import TertiaryButton from '../../../components/shared/TertiaryButton.jsx';
import Checkbox from '@mui/material/Checkbox';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

import FormDialog from '../../../components/shared/FormDialog.jsx';
import PatternTextField from '../../../components/shared/PatternTextField.jsx';
import { TAX_TYPES, COUNTRIES } from '@axerra/shared';
import { formGridSx, formGroupCardSx, formFullSpanSx, flexBetweenSx } from '../../../config/layoutTokens.js';

export default function CompanyEditDialog({
  open,
  onClose,
  editForm,
  onEditField,
  setEditForm,
  editRow,
  addresses,
  taxIds,
  hasEditChanges,
  onSubmit,
  loading,
}) {
  const hasSource = !!editRow?.source_id;

  return (
    <FormDialog open={open} title="Edit Company" submitLabel="Save Changes" loading={loading} submitDisabled={!hasEditChanges} onSubmit={onSubmit} onCancel={onClose}>
      <TextField label="Company Name" required value={editForm.name} onChange={onEditField('name')} />
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

      {/* ── Addresses ───────────────────────────────────────────── */}
      <Divider />
      <Box sx={flexBetweenSx}>
        <Typography variant="subtitle2">Addresses</Typography>
        <TertiaryButton size="small" startIcon={<AddIcon />} onClick={addresses.add} disabled={!hasSource}>Add Address</TertiaryButton>
      </Box>
      {!hasSource && (
        <Typography variant="body2" color="text.secondary">Save company first to manage addresses</Typography>
      )}
      {addresses.indexedItems.length === 0 && hasSource && (
        <Typography variant="body2" color="text.secondary">No addresses</Typography>
      )}
      {addresses.indexedItems.map(({ item: addr, index: idx }) => (
        <Box key={addr.id || idx} sx={{ ...formGroupCardSx, gridColumn: undefined }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <TextField label="Label" value={addr.label} onChange={(e) => addresses.update(idx, 'label', e.target.value)} size="small" sx={{ width: 200 }} />
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

      {/* ── Tax Identifiers ─────────────────────────────────────── */}
      <Divider />
      <Box sx={flexBetweenSx}>
        <Typography variant="subtitle2">Tax Identifiers</Typography>
        <TertiaryButton size="small" startIcon={<AddIcon />} onClick={taxIds.add} disabled={!hasSource}>Add Tax ID</TertiaryButton>
      </Box>
      {!hasSource && (
        <Typography variant="body2" color="text.secondary">Save company first to manage tax identifiers</Typography>
      )}
      {taxIds.indexedItems.length === 0 && hasSource && (
        <Typography variant="body2" color="text.secondary">No tax identifiers</Typography>
      )}
      {taxIds.indexedItems.map(({ item: taxId, index: idx }) => {
        const countryCode = taxId.country_code?.trim() || '';
        const taxTypes = TAX_TYPES[countryCode] || TAX_TYPES._OTHER;
        return (
          <Box key={taxId.id || idx} sx={{ ...formGroupCardSx, gridColumn: undefined }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              <TextField
                select label="Country" value={countryCode}
                onChange={(e) => {
                  taxIds.update(idx, 'country_code', e.target.value);
                  const newTypes = TAX_TYPES[e.target.value] || TAX_TYPES._OTHER;
                  taxIds.update(idx, 'tax_type', newTypes[0]?.code || 'TIN');
                }}
                SelectProps={{ renderValue: (val) => val }}
                size="small" sx={{ minWidth: 80 }}
              >
                {COUNTRIES.map((c) => (
                  <MenuItem key={c.code} value={c.code}>{c.code} - {c.name}</MenuItem>
                ))}
              </TextField>
              <TextField
                select label="Type" value={taxId.tax_type}
                onChange={(e) => taxIds.update(idx, 'tax_type', e.target.value)}
                SelectProps={{ renderValue: (val) => val }}
                size="small" sx={{ minWidth: 80 }}
              >
                {taxTypes.map((t) => (
                  <MenuItem key={t.code} value={t.code}>{t.label}</MenuItem>
                ))}
              </TextField>
              <PatternTextField
                label="Tax ID Value" value={taxId.tax_value}
                onChange={(raw) => taxIds.update(idx, 'tax_value', raw)}
                pattern={taxTypes.find((t) => t.code === taxId.tax_type)?.placeholder}
                size="small" sx={{ flex: 1, minWidth: 160 }}
              />
              <IconButton size="small" onClick={() => taxIds.remove(idx)} color="error">
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>
        );
      })}
    </FormDialog>
  );
}
