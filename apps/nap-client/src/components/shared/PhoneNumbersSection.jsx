/**
 * @file Phone numbers read-only View section for detail dialogs
 * @module nap-client/components/shared/PhoneNumbersSection
 *
 * Renders a list of phone numbers with formatted display values resolved
 * from the country placeholder pattern.
 *
 * Copyright (c) 2025 – present Vimber LLC. All rights reserved.
 */

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';

import { COUNTRIES, formatByPattern } from '@nap/shared';
import FieldRow from './FieldRow.jsx';
import { detailGridSx } from '../../config/layoutTokens.js';

export default function PhoneNumbersSection({ phones }) {
  if (!phones?.length) return null;
  return (
    <>
      <Divider />
      <Typography variant="subtitle2" color="text.secondary">Phone Numbers</Typography>
      {phones.map((p) => {
        const country = COUNTRIES.find((c) => c.code === p.country_code);
        return (
          <Box key={p.id} sx={detailGridSx}>
            <FieldRow label="Type" value={p.phone_type} />
            <FieldRow label="Number" value={formatByPattern(p.phone_number, country?.placeholder) || '\u2014'} />
            <FieldRow label="Primary" value={p.is_primary ? 'Yes' : 'No'} />
          </Box>
        );
      })}
    </>
  );
}
