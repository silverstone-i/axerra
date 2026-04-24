/**
 * @file Semantic design tokens — borders, surfaces, shadows, density, motion
 * @module client/config/tokens
 *
 * Mode-independent values are exported directly. Mode-dependent values
 * (border, surface, shadow) are produced by createTokens(mode), which reads
 * brand color hexes from ./colors.js — the single source of truth.
 *
 * Layout dimensions live in config/layoutTokens.js.
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import { alpha } from '@mui/material/styles';
import { getColors } from './colors.js';

/* ── Mode-independent tokens ─────────────────────────────────── */

export const density = {
  sectionGap: 24,
  stackGap: 16,
  fieldGap: 16,
  controlHeight: 36,
  controlHeightSm: 32,
  tableRowHeight: 44,
  tableCellPadY: 10,
  tableCellPadX: 14,
};

export const radius = {
  card: 8,
  modal: 8,
  control: 6,
  chip: 999,
};

export const typographyTokens = {
  pageTitle: { fontSize: 22, fontWeight: 600, lineHeight: 1.2 },
  sectionLabel: { fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' },
  breadcrumb: { fontSize: 12, fontWeight: 500 },
  tableHead: { fontSize: 12, fontWeight: 600, letterSpacing: '0.02em' },
  body: { fontSize: 14, fontWeight: 500 },
};

export const motion = {
  fast: '120ms ease',
};

/* ── Mode-dependent tokens ───────────────────────────────────── */

export const createTokens = (mode = 'dark') => {
  const c = getColors(mode);
  const dark = mode === 'dark';

  return {
    density,
    radius,
    typography: typographyTokens,
    motion,

    border: {
      width: 1,
      subtle: c.border.subtle,
      hover: alpha(c.text.primary, 0.18),
      strong: c.border.strong,
    },

    surface: {
      hoverOverlay: alpha(c.text.primary, 0.04),
      activeOverlay: alpha(c.text.primary, 0.06),
      selectedOverlay: alpha(c.text.primary, 0.08),
      headerOverlay: alpha(c.text.primary, 0.03),
      scrim: 'rgba(0,0,0,0.60)',
    },

    shadow: {
      modal: '0 4px 12px rgba(0,0,0,0.25)',
      card: dark ? '0 2px 8px rgba(0,0,0,0.18)' : '0 2px 8px rgba(0,0,0,0.08)',
      none: 'none',
    },
  };
};
