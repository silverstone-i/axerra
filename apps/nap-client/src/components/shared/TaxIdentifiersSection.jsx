/**
 * @file Tax identifiers read-only View section for detail dialogs
 * @module nap-client/components/shared/TaxIdentifiersSection
 *
 * Renders a list of tax identifiers with formatted display values resolved
 * from the TAX_TYPES placeholder pattern.
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
 */

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';

import { TAX_TYPES } from '@nap/shared';
import FieldRow from './FieldRow.jsx';
import { formatByPattern } from '../../utils/formatByPattern.js';
import { detailGridSx } from '../../config/layoutTokens.js';

export default function TaxIdentifiersSection({ taxIds }) {
  if (!taxIds?.length) return null;
  return (
    <>
      <Divider />
      <Typography variant="subtitle2" color="text.secondary">Tax Identifiers</Typography>
      {taxIds.map((t) => {
        const types = TAX_TYPES[t.country_code] || TAX_TYPES._OTHER || [];
        const taxType = types.find((tt) => tt.code === t.tax_type);
        return (
          <Box key={t.id} sx={detailGridSx}>
            <FieldRow label="Country" value={t.country_code} />
            <FieldRow label="Type" value={t.tax_type} />
            <FieldRow label="Value" value={formatByPattern(t.tax_value, taxType?.placeholder) || '\u2014'} />
          </Box>
        );
      })}
    </>
  );
}
