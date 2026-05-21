/**
 * @file Brand tertiary (ghost) button — text variant, optional danger
 * @module client/components/shared/TertiaryButton
 *
 * Implements BRAND.md §"Tertiary (ghost) button":
 *   - Transparent bg, navy text, no border
 *   - Hover: subtle bg
 *   - danger=true switches text color to error and hover bg to error tintBg
 *
 * Per BRAND §"Destructive actions": red fill is reserved for STATUS, not for
 * destructive ACTIONS. Use PrimaryButton (navy) with a clear destructive label
 * for destructive primaries; reserve TertiaryButton danger for inline ghost
 * destructive affordances (e.g., "Discard").
 *
 * Forwards all standard MuiButton props.
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import Button from '@mui/material/Button';

const baseSx = (theme) => ({
  color: theme.palette.brand.navyText,
  '&:hover': { backgroundColor: theme.palette.background.surface },
});

const dangerSx = (theme) => ({
  color: theme.palette.error.main,
  '&:hover': { backgroundColor: theme.palette.semantic.error.tintBg },
});

export default function TertiaryButton({ danger = false, sx, ...rest }) {
  const variantSx = danger ? dangerSx : baseSx;
  return (
    <Button
      variant="text"
      sx={[variantSx, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}
      {...rest}
    />
  );
}
