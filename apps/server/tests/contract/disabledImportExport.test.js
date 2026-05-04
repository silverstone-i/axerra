/**
 * @file Contract test: routers that should NOT auto-mount /import-xls or /export-xls
 * @module tests/contract/disabledImportExport
 *
 * Several routers disable spreadsheet I/O because the resource doesn't
 * make sense as a standalone import/export:
 *   - sources-child tables (importing creates orphans)
 *   - UI-managed config (roles, policies, state-filters, field-group-*)
 *   - line/sub-record tables (invoice/journal-entry lines, cost items,
 *     deliverable assignments) — should ride the parent's import
 *   - blueprint tables (template-units, template-tasks, etc.)
 *   - read-only registries (policy-catalog)
 *
 * This test locks the contract: hitting /import-xls or /export-xls on
 * any of these routers returns 404 (route not registered) when the
 * caller is otherwise authenticated and authorized.
 *
 * Authenticated request is required because authRedis runs before the
 * route lookup — unauthenticated requests get 401, masking the 404.
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { bootstrapAdmin, cleanupTestDb } from '../helpers/testDb.js';

beforeAll(async () => {
  await cleanupTestDb();
  await bootstrapAdmin();
}, 30000);

const { default: app } = await import('../../src/app.js');

afterAll(async () => {
  await cleanupTestDb();
}, 15000);

const DISABLED_ROUTES = [
  // sources-child
  '/api/core/v1/sources',
  '/api/core/v1/addresses',
  '/api/core/v1/phone-numbers',
  '/api/core/v1/emails',
  '/api/core/v1/tax-identifiers',
  // UI-managed config
  '/api/core/v1/roles',
  '/api/core/v1/policies',
  '/api/core/v1/state-filters',
  '/api/core/v1/field-group-definitions',
  '/api/core/v1/field-group-grants',
  '/api/core/v1/policy-catalog',
  // line/sub-record + blueprints
  '/api/projects/v1/cost-items',
  '/api/projects/v1/template-units',
  '/api/projects/v1/template-tasks',
  '/api/projects/v1/template-cost-items',
  '/api/projects/v1/template-change-orders',
  '/api/activities/v1/deliverable-assignments',
  '/api/ap/v1/ap-invoice-lines',
  '/api/ar/v1/ar-invoice-lines',
  '/api/accounting/v1/journal-entry-lines',
];

describe('Disabled import/export endpoints', () => {
  let cookies;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: process.env.ROOT_EMAIL || 'admin@axerra.io',
        password: process.env.ROOT_PASSWORD || 'TestPass123!',
      });
    expect(res.status).toBe(200);
    cookies = res.headers['set-cookie'];
  }, 15000);

  describe.each(DISABLED_ROUTES)('%s', (base) => {
    test('POST /import-xls returns 404 (route not registered)', async () => {
      const res = await request(app)
        .post(`${base}/import-xls`)
        .set('Cookie', cookies);
      expect(res.status).toBe(404);
    });

    test('POST /export-xls returns 404 (route not registered)', async () => {
      const res = await request(app)
        .post(`${base}/export-xls`)
        .set('Cookie', cookies);
      expect(res.status).toBe(404);
    });
  });
});
