/**
 * @file Inline editable phone row — reusable across all entity edit forms
 * @module client/components/shared/PhoneRow
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

import PatternTextField from './PatternTextField.jsx';
import { cap } from '../../utils/format.js';
import { PHONE_TYPES } from '../../utils/formConstants.js';
import { COUNTRIES } from '@axerra/shared';

export default function PhoneRow({ item, index, onUpdate, onRemove }) {
  const countryCode = item.country_code?.trim() || 'US';
  const country = COUNTRIES.find((c) => c.code === countryCode);
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
      <TextField
        select
        label="Type"
        value={item.phone_type}
        onChange={(e) => onUpdate(index, 'phone_type', e.target.value)}
        sx={{ minWidth: 120 }}
        size="small"
      >
        {PHONE_TYPES.map((t) => (
          <MenuItem key={t} value={t}>{cap(t)}</MenuItem>
        ))}
      </TextField>
      <TextField
        select
        label="Country"
        value={countryCode}
        onChange={(e) => onUpdate(index, 'country_code', e.target.value)}
        SelectProps={{ renderValue: (val) => COUNTRIES.find((c) => c.code === val)?.dial_code || val }}
        sx={{ minWidth: 80 }}
        size="small"
      >
        {COUNTRIES.map((c) => (
          <MenuItem key={c.code} value={c.code}>{c.dial_code} {c.code} - {c.name}</MenuItem>
        ))}
      </TextField>
      <PatternTextField
        label="Number"
        value={item.phone_number}
        onChange={(raw) => onUpdate(index, 'phone_number', raw)}
        pattern={country?.placeholder}
        size="small"
        sx={{ flex: 1, minWidth: 160 }}
      />
      <FormControlLabel
        control={<Checkbox checked={item.is_primary} onChange={(e) => onUpdate(index, 'is_primary', e.target.checked)} size="small" />}
        label="Primary"
        sx={{ mr: 0 }}
      />
      <IconButton size="small" onClick={() => onRemove(index)} color="error" aria-label={`Remove ${item.phone_number || 'phone number'}`}>
        <DeleteOutlineIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}
