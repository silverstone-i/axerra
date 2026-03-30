/**
 * @file Shared editable collection section header with add action
 * @module nap-client/components/shared/CollectionSectionHeader
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
 */

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';

import { flexBetweenSx } from '../../config/layoutTokens.js';

export default function CollectionSectionHeader({ title, addLabel, onAdd }) {
  return (
    <Box sx={flexBetweenSx}>
      <Typography variant="subtitle2">{title}</Typography>
      <Button size="small" startIcon={<AddIcon />} onClick={onAdd}>
        {addLabel}
      </Button>
    </Box>
  );
}
