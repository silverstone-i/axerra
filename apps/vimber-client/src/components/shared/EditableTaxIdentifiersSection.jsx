/**
 * @file Shared editable tax identifier section for entity edit dialogs
 * @module vimber-client/components/shared/EditableTaxIdentifiersSection
 *
 * Copyright (c) 2025 – present Vimber LLC. All rights reserved.
 */

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

import PatternTextField from './PatternTextField.jsx';
import CollectionSectionHeader from './CollectionSectionHeader.jsx';
import { formGroupCardSx } from '../../config/layoutTokens.js';
import { TAX_TYPES, COUNTRIES } from '@vimber/shared';

const taxRowSx = {
  display: 'flex',
  gap: 1,
  alignItems: 'center',
  flexWrap: 'wrap',
};

const shortSelectSx = { minWidth: 80 };
const taxValueSx = { flex: 1, minWidth: 160 };

export default function EditableTaxIdentifiersSection({
  collection,
  emptyMessage = 'No tax identifiers',
  addLabel = 'Add Tax ID',
}) {
  return (
    <>
      <Divider />
      <CollectionSectionHeader title="Tax Identifiers" addLabel={addLabel} onAdd={collection.add} />
      {collection.indexedItems.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          {emptyMessage}
        </Typography>
      )}
      {collection.indexedItems.map(({ item, index }) => {
        const countryCode = item.country_code?.trim() || '';
        const taxTypes = TAX_TYPES[countryCode] || TAX_TYPES._OTHER;
        return (
          <Box key={item.id || index} sx={{ ...formGroupCardSx, gridColumn: undefined }}>
            <Box sx={taxRowSx}>
              <TextField
                select
                label="Country"
                value={countryCode}
                onChange={(e) => {
                  collection.update(index, 'country_code', e.target.value);
                  const newTypes = TAX_TYPES[e.target.value] || TAX_TYPES._OTHER;
                  collection.update(index, 'tax_type', newTypes[0]?.code || 'TIN');
                }}
                SelectProps={{ renderValue: (val) => val }}
                size="small"
                sx={shortSelectSx}
              >
                {COUNTRIES.map((country) => (
                  <MenuItem key={country.code} value={country.code}>
                    {country.code} - {country.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Type"
                value={item.tax_type}
                onChange={(e) => collection.update(index, 'tax_type', e.target.value)}
                SelectProps={{ renderValue: (val) => val }}
                size="small"
                sx={shortSelectSx}
              >
                {taxTypes.map((taxType) => (
                  <MenuItem key={taxType.code} value={taxType.code}>
                    {taxType.label}
                  </MenuItem>
                ))}
              </TextField>
              <PatternTextField
                label="Tax ID Value"
                value={item.tax_value}
                onChange={(raw) => collection.update(index, 'tax_value', raw)}
                pattern={taxTypes.find((taxType) => taxType.code === item.tax_type)?.placeholder}
                size="small"
                sx={taxValueSx}
              />
              <IconButton size="small" onClick={() => collection.remove(index)} color="error" aria-label={`Remove ${countryCode} ${item.tax_type} tax identifier`}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>
        );
      })}
    </>
  );
}
