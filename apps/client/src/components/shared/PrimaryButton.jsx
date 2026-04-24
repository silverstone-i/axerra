/**
 * @file Brand primary button — navy fill with gold left stripe
 * @module client/components/shared/PrimaryButton
 *
 * Implements BRAND.md §"Primary button":
 *   - Navy background (palette-aware: lifted in dark mode for contrast)
 *   - White text
 *   - Gold left stripe — 2px wide, expanding to 3px on hover
 *   - Padding-left shifts +1px on hover for the "growing" feel
 *   - Stripe hidden when disabled
 *
 * BRAND rule: one primary per screen ("if two things look primary, neither is").
 *
 * Forwards all standard MuiButton props.
 *
 * Copyright (c) 2025 – present Vimber LLC. All rights reserved.
 */

import Button from '@mui/material/Button';

const stripeSx = (theme) => ({
  position: 'relative',
  overflow: 'hidden',
  paddingLeft: '17.5px',
  transition: 'background-color 160ms ease, padding-left 160ms ease',
  '&::before': {
    content: '""',
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '2px',
    backgroundColor: theme.palette.brand.gold,
    transition: 'width 160ms ease',
  },
  '&:hover': { paddingLeft: '18.5px' },
  '&:hover::before': { width: '3px' },
  '&.Mui-disabled::before': { display: 'none' },
});

export default function PrimaryButton({ sx, ...rest }) {
  return (
    <Button
      variant="contained"
      color="primary"
      sx={[stripeSx, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}
      {...rest}
    />
  );
}
