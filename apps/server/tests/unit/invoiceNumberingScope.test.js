/**
 * @file Unit test pinning AP/AR invoice numbering scope to company_id
 * @module tests/unit/invoiceNumberingScope
 *
 * Pins the source-of-truth: AP and AR controllers must pass `current.company_id`
 * (not `current.legal_entity_id`) as the third argument to `allocateNumber`.
 * Prevents regression to the prior bug (gap 3.7 / 4.8) where the controllers
 * read a non-existent `legal_entity_id` column and effectively allocated all
 * invoice numbers in the global / null scope.
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AP_CONTROLLER = resolve(__dirname, '../../src/modules/ap/controllers/apInvoicesController.js');
const AR_CONTROLLER = resolve(__dirname, '../../src/modules/ar/controllers/arInvoicesController.js');

function findAllocateNumberCall(source) {
  const m = source.match(/allocateNumber\([^)]*\)/);
  if (!m) throw new Error('allocateNumber call not found');
  return m[0];
}

describe('invoice numbering scope', () => {
  it('AP controller passes current.company_id as scopeId', () => {
    const call = findAllocateNumberCall(readFileSync(AP_CONTROLLER, 'utf8'));
    expect(call).toContain("'ap_invoice'");
    expect(call).toContain('current.company_id');
    expect(call).not.toContain('legal_entity_id');
  });

  it('AR controller passes current.company_id as scopeId', () => {
    const call = findAllocateNumberCall(readFileSync(AR_CONTROLLER, 'utf8'));
    expect(call).toContain("'ar_invoice'");
    expect(call).toContain('current.company_id');
    expect(call).not.toContain('legal_entity_id');
  });
});
