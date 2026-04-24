/**
 * @file Shared display-formatting helpers
 * @module client/utils/format
 *
 * Pure functions used across pages for consistent text formatting.
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import { COUNTRIES } from '@axerra/shared';
import { formatByPattern } from '@axerra/shared';

/**
 * Capitalise the first letter of a string.
 * @param {string} s
 * @returns {string}
 */
export const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

/**
 * Convert a snake_case string to Title Case words.
 * @param {string} s
 * @returns {string}
 */
export const capSnake = (s) =>
  s
    ? s
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
    : '';

/**
 * Format an ISO date string for display; returns an em-dash when falsy.
 * @param {string|null|undefined} v
 * @returns {string}
 */
export const fmtDate = (v) => (v ? new Date(v).toLocaleDateString() : '\u2014');

/**
 * Format a phone-number object using its country placeholder pattern.
 * @param {{ phone_number: string, country_code: string }} p
 * @returns {string}
 */
export const fmtPhone = (p) =>
  formatByPattern(p.phone_number, COUNTRIES.find((c) => c.code === p.country_code)?.placeholder);

/**
 * Extract a user-friendly error message from an API error object.
 * @param {Error & { payload?: { error?: string, message?: string } }} err
 * @returns {string}
 */
export const errMsg = (err) => err.payload?.error || err.payload?.message || err.message;
