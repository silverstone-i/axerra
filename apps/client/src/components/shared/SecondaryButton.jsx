/**
 * @file Brand secondary button — outlined with strong border, navy text
 * @module client/components/shared/SecondaryButton
 *
 * Implements BRAND.md §"Secondary button":
 *   - Transparent background, navy text (palette-aware)
 *   - Strong border (palette.border.strong)
 *   - Hover: subtle bg, text-tertiary border
 *
 * Forwards all standard MuiButton props.
 *
 * Copyright (c) 2025 – present Vimber LLC. All rights reserved.
 */

import Button from '@mui/material/Button';

const secondarySx = (theme) => ({
  borderColor: theme.palette.border.strong,
  color: theme.palette.brand.navyText,
  '&:hover': {
    borderColor: theme.palette.text.tertiary,
    backgroundColor: theme.palette.background.surface,
  },
});

export default function SecondaryButton({ sx, ...rest }) {
  return (
    <Button
      variant="outlined"
      sx={[secondarySx, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}
      {...rest}
    />
  );
}
