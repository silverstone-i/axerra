/**
 * @file Contract tests for payment-terms CRUD endpoints
 * @module tests/contract/paymentTerms
 *
 * Covers: create, list, getById, update, archive, restore
 * for the tenant-scope payment_terms lookup table.
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { bootstrapAdmin, cleanupTestDb } from '../helpers/testDb.js';

const ROOT_EMAIL = process.env.ROOT_EMAIL;
const ROOT_PASSWORD = process.env.ROOT_PASSWORD;

let db;
beforeAll(async () => {
  await cleanupTestDb();
  db = await bootstrapAdmin();
}, 30000);

const { default: app } = await import('../../src/app.js');

afterAll(async () => {
  await cleanupTestDb();
}, 15000);

async function loginRoot() {
  const res = await request(app).post('/api/auth/login').send({ email: ROOT_EMAIL, password: ROOT_PASSWORD });
  return res.headers['set-cookie'];
}

async function provisionTenant(cookies) {
  await request(app)
    .post('/api/tenants/v1/tenants')
    .set('Cookie', cookies)
    .send({
      tenant_code: 'PTEST',
      company: 'Payment Terms Test Corp',
      status: 'active',
      tier: 'starter',
      admin_first_name: 'Test',
      admin_last_name: 'Admin',
      admin_email: 'admin@ptest.com',
      admin_password: 'PtestPass123!',
      billing_address: { address_line_1: '1 Test St', country_code: 'US' },
    });
}

describe('Payment Terms CRUD — /api/core/v1/payment-terms', () => {
  let cookies;
  let termId;

  beforeAll(async () => {
    const rootCookies = await loginRoot();
    await provisionTenant(rootCookies);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@ptest.com', password: 'PtestPass123!' });
    cookies = loginRes.headers['set-cookie'];
  }, 30000);

  test('creates a payment term', async () => {
    const res = await request(app)
      .post('/api/core/v1/payment-terms')
      .set('Cookie', cookies)
      .send({ label: 'Net 30', term: 30, units: 'days' });

    expect(res.status).toBe(201);
    expect(res.body.label).toBe('Net 30');
    expect(res.body.term).toBe(30);
    expect(res.body.units).toBe('days');
    expect(res.body.is_active).toBe(true);
    termId = res.body.id;
  });

  test('lists payment terms', async () => {
    const res = await request(app)
      .get('/api/core/v1/payment-terms')
      .set('Cookie', cookies);
    expect(res.status).toBe(200);
    const rows = res.body.rows ?? res.body;
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.find((r) => r.id === termId)).toBeDefined();
  });

  test('gets a payment term by id', async () => {
    const res = await request(app)
      .get(`/api/core/v1/payment-terms/${termId}`)
      .set('Cookie', cookies);
    expect(res.status).toBe(200);
    expect(res.body.label).toBe('Net 30');
  });

  test('updates a payment term', async () => {
    const res = await request(app)
      .put(`/api/core/v1/payment-terms/update?id=${termId}`)
      .set('Cookie', cookies)
      .send({ label: 'Net 45', term: 45 });
    expect(res.status).toBe(200);
  });

  test('archives and restores a payment term', async () => {
    const archiveRes = await request(app)
      .delete(`/api/core/v1/payment-terms/archive?id=${termId}`)
      .set('Cookie', cookies)
      .send({});
    expect(archiveRes.status).toBe(200);

    const restoreRes = await request(app)
      .patch(`/api/core/v1/payment-terms/restore?id=${termId}`)
      .set('Cookie', cookies)
      .send({});
    expect(restoreRes.status).toBe(200);
  });

  test('verifies updated values after restore', async () => {
    const res = await request(app)
      .get(`/api/core/v1/payment-terms/${termId}`)
      .set('Cookie', cookies);
    expect(res.status).toBe(200);
    expect(res.body.label).toBe('Net 45');
    expect(res.body.term).toBe(45);
  });
});
