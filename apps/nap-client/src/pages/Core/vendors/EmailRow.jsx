/**
 * @file Inline editable email row — shared between vendor and contact edit forms
 * @module nap-client/pages/Core/vendors/EmailRow
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
 */

import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

import { cap } from '../../../utils/format.js';
import { EMAIL_LABELS } from '../../../utils/formConstants.js';

export default function EmailRow({ item, index, onUpdate, onRemove }) {
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
      <TextField
        label="Email"
        type="email"
        value={item.email}
        onChange={(e) => onUpdate(index, 'email', e.target.value)}
        size="small"
        sx={{ flex: 1, minWidth: 200 }}
      />
      <TextField
        select
        label="Label"
        value={item.label}
        onChange={(e) => onUpdate(index, 'label', e.target.value)}
        size="small"
        sx={{ minWidth: 120 }}
      >
        {EMAIL_LABELS.map((l) => (
          <MenuItem key={l} value={l}>{cap(l)}</MenuItem>
        ))}
      </TextField>
      <FormControlLabel
        control={<Checkbox checked={item.is_primary} onChange={(e) => onUpdate(index, 'is_primary', e.target.checked)} size="small" />}
        label="Primary"
        sx={{ mr: 0 }}
      />
      <IconButton size="small" onClick={() => onRemove(index)} color="error">
        <DeleteOutlineIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}
