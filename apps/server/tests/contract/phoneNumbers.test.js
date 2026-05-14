/**
 * @file Contract tests for phone number CRUD endpoints
 * @module tests/contract/phoneNumbers
 *
 * Covers: basic CRUD and single is_primary enforcement (creating or updating
 * a primary phone demotes the previous primary for the same source).
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
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
      tenant_code: 'PHTEST',
      company: 'Phone Test Corp',
      status: 'active',
      tier: 'starter',
      admin_first_name: 'Test',
      admin_last_name: 'Admin',
      admin_email: 'admin@phtest.com',
      admin_password: 'PhtestPass123!',
      billing_address: { address_line_1: '1 Test St', country_code: 'US' },
    });
}

describe('Phone Number CRUD — /api/core/v1/phone-numbers', () => {
  let cookies;
  let employeeSourceId;
  let phoneId;

  beforeAll(async () => {
    const rootCookies = await loginRoot();
    await provisionTenant(rootCookies);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@phtest.com', password: 'PhtestPass123!' });
    cookies = loginRes.headers['set-cookie'];

    // Create an employee to get a source_id
    const empRes = await request(app)
      .post('/api/core/v1/employees')
      .set('Cookie', cookies)
      .send({ first_name: 'Phone', last_name: 'Tester', email: 'tester@phtest.com', roles: ['admin'] });
    employeeSourceId = empRes.body.source_id;
  }, 30000);

  test('creates a phone number linked to a source', async () => {
    const res = await request(app)
      .post('/api/core/v1/phone-numbers')
      .set('Cookie', cookies)
      .send({ source_id: employeeSourceId, phone_number: '5551234567', phone_type: 'cell', is_primary: true });

    expect(res.status).toBe(201);
    expect(res.body.phone_number).toBe('5551234567');
    expect(res.body.is_primary).toBe(true);
    expect(res.body.source_id).toBe(employeeSourceId);
    phoneId = res.body.id;
  });

  test('lists phone numbers by source_id', async () => {
    const res = await request(app)
      .get(`/api/core/v1/phone-numbers?source_id=${employeeSourceId}`)
      .set('Cookie', cookies);
    expect(res.status).toBe(200);
    const rows = res.body.rows ?? res.body;
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  test('updates a phone number', async () => {
    const res = await request(app)
      .put(`/api/core/v1/phone-numbers/update?id=${phoneId}`)
      .set('Cookie', cookies)
      .send({ phone_number: '5559876543' });
    expect(res.status).toBe(200);
    expect(res.body.updatedRecords).toBe(1);
  });

  test('enforces single is_primary — creating a new primary demotes the previous one', async () => {
    // Create second primary phone — should succeed and demote the first
    const second = await request(app)
      .post('/api/core/v1/phone-numbers')
      .set('Cookie', cookies)
      .send({ source_id: employeeSourceId, phone_number: '5550001111', phone_type: 'work', is_primary: true });
    expect(second.status).toBe(201);
    expect(second.body.is_primary).toBe(true);

    // Verify only one active primary remains
    const list = await request(app)
      .get(`/api/core/v1/phone-numbers?source_id=${employeeSourceId}`)
      .set('Cookie', cookies);
    const rows = list.body.rows ?? list.body;
    const primaries = rows.filter((p) => p.is_primary);
    expect(primaries.length).toBe(1);
    expect(primaries[0].phone_number).toBe('5550001111');
  });

  test('enforces single is_primary — updating to primary demotes the previous one', async () => {
    // Find the non-primary phone to promote
    const list = await request(app)
      .get(`/api/core/v1/phone-numbers?source_id=${employeeSourceId}`)
      .set('Cookie', cookies);
    const rows = list.body.rows ?? list.body;
    const nonPrimary = rows.find((p) => !p.is_primary);

    expect(nonPrimary).toBeDefined();

    const res = await request(app)
      .put(`/api/core/v1/phone-numbers/update?id=${nonPrimary.id}`)
      .set('Cookie', cookies)
      .send({ is_primary: true });
    expect(res.status).toBe(200);

    // Verify only one active primary remains
    const updated = await request(app)
      .get(`/api/core/v1/phone-numbers?source_id=${employeeSourceId}`)
      .set('Cookie', cookies);
    const updatedRows = updated.body.rows ?? updated.body;
    const primaries = updatedRows.filter((p) => p.is_primary);
    expect(primaries.length).toBe(1);
    expect(primaries[0].id).toBe(nonPrimary.id);
  });

  test('archives a phone number', async () => {
    const res = await request(app)
      .delete(`/api/core/v1/phone-numbers/archive?id=${phoneId}`)
      .set('Cookie', cookies)
      .send({});
    expect(res.status).toBe(200);
  });
});
