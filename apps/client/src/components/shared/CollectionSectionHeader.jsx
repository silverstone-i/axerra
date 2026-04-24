/**
 * @file Shared editable collection section header with add action
 * @module client/components/shared/CollectionSectionHeader
 *
 * Copyright (c) 2025 – present Vimber LLC. All rights reserved.
 */

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';

import TertiaryButton from './TertiaryButton.jsx';
import { flexBetweenSx } from '../../config/layoutTokens.js';

export default function CollectionSectionHeader({ title, addLabel, onAdd }) {
  return (
    <Box sx={flexBetweenSx}>
      <Typography variant="subtitle2">{title}</Typography>
      <TertiaryButton size="small" startIcon={<AddIcon />} onClick={onAdd}>
        {addLabel}
      </TertiaryButton>
    </Box>
  );
}
