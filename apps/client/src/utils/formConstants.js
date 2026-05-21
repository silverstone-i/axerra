/**
 * @file Shared blank-form shapes and option lists for entity sub-collections
 * @module client/utils/formConstants
 *
 * Centralises the default objects used by email, phone, address, and
 * tax-identifier sub-forms across Core entity pages.
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

export const BLANK_EMAIL = { email: '', label: 'work', is_primary: false };
export const BLANK_PHONE = { country_code: 'US', phone_type: 'cell', phone_number: '', is_primary: false };
export const BLANK_ADDRESS = {
  label: '', address_line_1: '', address_line_2: '', address_line_3: '', city: '',
  state_province: '', postal_code: '', country_code: 'US',
};
export const BLANK_TAX_ID = { country_code: 'US', tax_type: 'TIN', tax_value: '' };

export const PHONE_TYPES = ['cell', 'work', 'home', 'fax', 'other'];
export const EMAIL_LABELS = ['work', 'personal', 'billing', 'other'];

/* ── Collection field lists for dirty-checking & saveCollection ── */
export const EMAIL_FIELDS = ['email', 'label', 'is_primary'];
export const EMAIL_LOGIN_FIELDS = ['email', 'label', 'is_primary', 'is_login'];
export const PHONE_FIELDS = ['country_code', 'phone_type', 'phone_number', 'is_primary'];
export const ADDRESS_FIELDS = [
  'label', 'address_line_1', 'address_line_2', 'address_line_3',
  'city', 'state_province', 'postal_code', 'country_code',
];
export const TAX_ID_FIELDS = ['country_code', 'tax_type', 'tax_value'];

/**
 * Returns true when a mutable sub-collection has diverged from its initial snapshot.
 * Used by edit-dialog dirty-check logic across all Core entity pages.
 */
export function collectionChanged(current, initial, fields) {
  if (!initial) return false;
  if (current.some((c) => c._deleted)) return true;
  if (current.some((c) => !c.id && !c._deleted)) return true;
  const initMap = new Map(initial.map((r) => [r.id, r]));
  return current.filter((c) => c.id && !c._deleted).some((c) => {
    const orig = initMap.get(c.id);
    return !orig || fields.some((f) => c[f] !== orig[f]);
  });
}
