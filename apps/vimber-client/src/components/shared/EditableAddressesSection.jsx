/**
 * @file Shared editable addresses section for entity edit dialogs
 * @module vimber-client/components/shared/EditableAddressesSection
 *
 * Copyright (c) 2025 – present Vimber LLC. All rights reserved.
 */

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

import CollectionSectionHeader from './CollectionSectionHeader.jsx';
import { formGridSx, formGroupCardSx, formFullSpanSx } from '../../config/layoutTokens.js';

const addressHeaderSx = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  mb: 1,
};

const addressLabelFieldSx = { width: 200 };

export default function EditableAddressesSection({
  collection,
  emptyMessage = 'No addresses',
  addLabel = 'Add Address',
}) {
  return (
    <>
      <Divider />
      <CollectionSectionHeader title="Addresses" addLabel={addLabel} onAdd={collection.add} />
      {collection.indexedItems.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          {emptyMessage}
        </Typography>
      )}
      {collection.indexedItems.map(({ item, index }) => (
        <Box key={item.id || index} sx={{ ...formGroupCardSx, gridColumn: undefined }}>
          <Box sx={addressHeaderSx}>
            <TextField
              label="Label"
              value={item.label}
              onChange={(e) => collection.update(index, 'label', e.target.value)}
              size="small"
              sx={addressLabelFieldSx}
            />
            <IconButton size="small" onClick={() => collection.remove(index)} color="error" aria-label={`Remove ${item.label ? `${item.label} address` : 'address'}`}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Box>
          <Box sx={formGridSx}>
            <TextField
              label="Address Line 1"
              value={item.address_line_1}
              onChange={(e) => collection.update(index, 'address_line_1', e.target.value)}
              size="small"
              sx={formFullSpanSx}
            />
            <TextField
              label="Address Line 2"
              value={item.address_line_2}
              onChange={(e) => collection.update(index, 'address_line_2', e.target.value)}
              size="small"
              sx={formFullSpanSx}
            />
            <TextField
              label="Address Line 3"
              value={item.address_line_3 || ''}
              onChange={(e) => collection.update(index, 'address_line_3', e.target.value)}
              size="small"
              sx={formFullSpanSx}
            />
            <TextField label="City" value={item.city} onChange={(e) => collection.update(index, 'city', e.target.value)} size="small" />
            <TextField
              label="State / Province"
              value={item.state_province}
              onChange={(e) => collection.update(index, 'state_province', e.target.value)}
              size="small"
            />
            <TextField
              label="Postal Code"
              value={item.postal_code}
              onChange={(e) => collection.update(index, 'postal_code', e.target.value)}
              size="small"
            />
            <TextField
              label="Country Code"
              value={item.country_code}
              onChange={(e) => collection.update(index, 'country_code', e.target.value)}
              size="small"
              inputProps={{ maxLength: 2 }}
            />
          </Box>
        </Box>
      ))}
    </>
  );
}
