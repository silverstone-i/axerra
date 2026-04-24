/**
 * @file Addresses read-only View section for detail dialogs
 * @module client/components/shared/AddressesSection
 *
 * Renders a list of addresses with multi-line join and all standard fields.
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';

import FieldRow from './FieldRow.jsx';
import { detailGridSx } from '../../config/layoutTokens.js';

export default function AddressesSection({ addresses }) {
  if (!addresses?.length) return null;
  return (
    <>
      <Divider />
      <Typography variant="subtitle2" color="text.secondary">Addresses</Typography>
      {addresses.map((a) => (
        <Box key={a.id} sx={detailGridSx}>
          <FieldRow label="Label" value={a.label || '\u2014'} />
          <FieldRow label="Address" value={[a.address_line_1, a.address_line_2, a.address_line_3].filter(Boolean).join(', ') || '\u2014'} />
          <FieldRow label="City" value={a.city || '\u2014'} />
          <FieldRow label="State" value={a.state_province || '\u2014'} />
          <FieldRow label="Postal Code" value={a.postal_code || '\u2014'} />
          <FieldRow label="Country" value={a.country_code || '\u2014'} />
        </Box>
      ))}
    </>
  );
}
