/**
 * @file Brand wordmark — `vimber.` rendered as HTML+CSS, not an image
 * @module client/components/shared/Wordmark
 *
 * Implements BRAND.md §"Logo wordmark":
 *   - Single text node "vimber" with uniform letter-spacing (-0.02em), gold dot
 *   - Inter Medium (500), color from palette.brand.navyText (auto light/dark)
 *   - Dot is a gold square sized in em so it scales with font-size
 *
 * Color: light = #2F3E52 (BRAND.navy), dark = #698BB8 (lifted navy-text).
 * Both come from theme — never hardcode.
 *
 * Copyright (c) 2025 – present Vimber LLC. All rights reserved.
 */

import Box from '@mui/material/Box';

export default function Wordmark({ size = 24, sx, ...rest }) {
  return (
    <Box
      component="span"
      role="img"
      aria-label="vimber"
      sx={[
        {
          display: 'inline-flex',
          alignItems: 'baseline',
          lineHeight: 1,
          fontFamily: 'Inter, sans-serif',
          fontWeight: 500,
          fontSize: size,
          letterSpacing: '-0.02em',
          color: 'brand.navyText',
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
      {...rest}
    >
      vimber
      <Box
        component="span"
        sx={{
          display: 'inline-block',
          alignSelf: 'flex-end',
          bgcolor: 'brand.gold',
          width: '0.19em',
          height: '0.19em',
          ml: '0.06em',
          mb: '0.06em',
        }}
      />
    </Box>
  );
}
