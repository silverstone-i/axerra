/**
 * @file Contract tests for vendor-contacts CRUD endpoints
 * @module tests/contract/vendorContacts
 *
 * Covers: creation with auto-linked sources record, basic CRUD,
 * and soft-delete behavior.
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
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
      tenant_code: 'VCTEST',
      company: 'Vendor Contact Test Corp',
      status: 'active',
      tier: 'starter',
      admin_first_name: 'Test',
      admin_last_name: 'Admin',
      admin_email: 'admin@vctest.com',
      admin_password: 'VctestPass123!',
      billing_address: { address_line_1: '1 Test St', country_code: 'US' },
    });
}

describe('Vendor Contact CRUD — /api/core/v1/vendor-contacts', () => {
  let cookies;
  let vendorId;
  let contactId;

  beforeAll(async () => {
    const rootCookies = await loginRoot();
    await provisionTenant(rootCookies);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@vctest.com', password: 'VctestPass123!' });
    cookies = loginRes.headers['set-cookie'];

    // Create a vendor to link contacts to
    const vendorRes = await request(app)
      .post('/api/core/v1/vendors')
      .set('Cookie', cookies)
      .send({ name: 'Test Vendor', code: 'TVEN' });
    vendorId = vendorRes.body.id;
  }, 30000);

  test('creates a vendor contact with auto-linked source', async () => {
    const res = await request(app)
      .post('/api/core/v1/vendor-contacts')
      .set('Cookie', cookies)
      .send({ vendor_id: vendorId, first_name: 'Jane', last_name: 'Smith', position: 'Manager', department: 'Sales', is_primary: true });

    expect(res.status).toBe(201);
    expect(res.body.first_name).toBe('Jane');
    expect(res.body.last_name).toBe('Smith');
    expect(res.body.source_id).toBeDefined();
    contactId = res.body.id;
  });

  test('lists vendor contacts by vendor_id', async () => {
    const res = await request(app)
      .get(`/api/core/v1/vendor-contacts?vendor_id=${vendorId}`)
      .set('Cookie', cookies);
    expect(res.status).toBe(200);
    const rows = res.body.rows ?? res.body;
    expect(rows.length).toBe(1);
    expect(rows[0].first_name).toBe('Jane');
  });

  test('updates a vendor contact', async () => {
    const res = await request(app)
      .put(`/api/core/v1/vendor-contacts/update?id=${contactId}`)
      .set('Cookie', cookies)
      .send({ position: 'Director' });
    expect(res.status).toBe(200);
  });

  test('archives and restores a vendor contact', async () => {
    const archiveRes = await request(app)
      .delete(`/api/core/v1/vendor-contacts/archive?id=${contactId}`)
      .set('Cookie', cookies)
      .send({});
    expect(archiveRes.status).toBe(200);

    const restoreRes = await request(app)
      .patch(`/api/core/v1/vendor-contacts/restore?id=${contactId}`)
      .set('Cookie', cookies)
      .send({});
    expect(restoreRes.status).toBe(200);
  });

  test('source record was correctly linked on create', async () => {
    // Fetch the contact and verify source_id points to a valid sources record
    const contactRes = await request(app)
      .get(`/api/core/v1/vendor-contacts/${contactId}`)
      .set('Cookie', cookies);

    expect(contactRes.status).toBe(200);
    const sourceId = contactRes.body.source_id;
    expect(sourceId).toBeDefined();

    // Verify the source exists with correct source_type
    const sourcesRes = await request(app)
      .get(`/api/core/v1/sources?id=${sourceId}`)
      .set('Cookie', cookies);
    expect(sourcesRes.status).toBe(200);
    const sources = sourcesRes.body.rows ?? sourcesRes.body;
    const source = sources.find((s) => s.id === sourceId);
    expect(source).toBeDefined();
    expect(source.source_type).toBe('vendor_contact');
    expect(source.table_id).toBe(contactId);
  });
});
