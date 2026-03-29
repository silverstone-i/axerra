/**
 * @file Shared blank-form shapes and option lists for entity sub-collections
 * @module nap-client/utils/formConstants
 *
 * Centralises the default objects used by email, phone, address, and
 * tax-identifier sub-forms across Core entity pages.
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
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
