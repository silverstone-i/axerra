/**
 * @file Brand color source of truth — derived from docs/Branding/BRAND.md
 * @module nap-client/config/colors
 *
 * The single, definitive set of color values for light and dark mode. Every
 * other styling layer (tokens.js for borders/surfaces/shadows, theme.js for
 * the MUI palette) reads from here. Edit this file — and only this file —
 * when brand colors change.
 *
 * Structure mirrors BRAND.md §"Color tokens":
 *   - BRAND        : mode-independent brand constants (navy, gold)
 *   - surface      : page / card / subtle (BRAND.md §"Surfaces")
 *   - text         : primary / secondary / tertiary (BRAND.md §"Text")
 *   - border       : subtle / strong (BRAND.md §"Borders")
 *   - semantic     : success / warning / error / info, each with main, text,
 *                    tintBg, tintBorder (BRAND.md §"Semantic" + §"Semantic
 *                    tinted backgrounds")
 *
 * Gold discipline (BRAND.md §"Gold discipline"): #F4B000 has exactly four
 * approved uses — logo dot, primary CTA left stripe, active nav indicator,
 * report total rule. Never use BRAND.gold as a general primary or accent.
 *
 * Two-navy rule (BRAND.md §"Text"): in light mode, the wordmark uses
 * BRAND.navy (#2F3E52) and body text uses light.text.primary (#1A2332).
 * Don't swap them.
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
 */

/* ── Mode-independent brand constants ────────────────────────── */

export const BRAND = {
  navy: '#2F3E52',
  gold: '#F4B000',
};

/* ── Light mode ──────────────────────────────────────────────── */

const light = {
  surface: {
    page: '#FAFAF7',
    card: '#FFFFFF',
    subtle: '#F4F5F2',
  },
  text: {
    primary: '#1A2332',
    secondary: '#5A6475',
    tertiary: '#8B94A3',
  },
  border: {
    subtle: '#E4E6EA',
    strong: '#C8CCD3',
  },
  semantic: {
    success: { main: '#15803D', text: '#15803D', tintBg: '#F0FDF4', tintBorder: '#BBF7D0' },
    warning: { main: '#E67E22', text: '#B45309', tintBg: '#FFF7ED', tintBorder: '#FED7AA' },
    error: { main: '#B91C1C', text: '#B91C1C', tintBg: '#FEF2F2', tintBorder: '#FECACA' },
    info: { main: '#2563EB', text: '#1D4ED8', tintBg: '#EFF6FF', tintBorder: '#BFDBFE' },
  },
};

/* ── Dark mode ───────────────────────────────────────────────── */

const dark = {
  surface: {
    page: '#0B0F14',
    card: '#131923',
    subtle: '#1A212D',
  },
  text: {
    primary: '#E8ECF2',
    secondary: '#9AA4B4',
    tertiary: '#6B7585',
  },
  border: {
    subtle: '#2A3240',
    strong: '#3A4250',
  },
  semantic: {
    success: { main: '#22C55E', text: '#22C55E', tintBg: '#F0FDF4', tintBorder: '#BBF7D0' },
    warning: { main: '#F59E0B', text: '#F59E0B', tintBg: '#FFF7ED', tintBorder: '#FED7AA' },
    error: { main: '#EF4444', text: '#EF4444', tintBg: '#FEF2F2', tintBorder: '#FECACA' },
    info: { main: '#60A5FA', text: '#60A5FA', tintBg: '#EFF6FF', tintBorder: '#BFDBFE' },
  },
};

/* ── Selectors ───────────────────────────────────────────────── */

export const getColors = (mode) => (mode === 'dark' ? dark : light);

export { light as lightColors, dark as darkColors };
