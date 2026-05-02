/**
 * @file Contract tests for vendor-contacts CRUD endpoints
 * @module tests/contract/vendorContacts
 *
 * Covers: creation with auto-linked sources record, basic CRUD,
 * and soft-delete behavior.
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
      .send({ vendor_id: vendorId, first_name: 'Jane', last_name: 'Smith', position: 'Manager', department: 'Sales' });

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

describe('Vendor Contact app-user provisioning — cross-tenant existing-email match → bind', () => {
  let cookiesA;
  let cookiesB;
  let vendorIdA;
  let vendorIdB;
  const SHARED_EMAIL = 'vera.shared@vendor.test';

  beforeAll(async () => {
    const rootCookies = await loginRoot();

    // Tenant A: provision if not already (so this describe runs in isolation).
    let loginA = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@vctest.com', password: 'VctestPass123!' });
    if (!loginA.headers['set-cookie']?.length) {
      await provisionTenant(rootCookies);
      loginA = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@vctest.com', password: 'VctestPass123!' });
    }
    cookiesA = loginA.headers['set-cookie'];

    // Provision a second tenant B for the cross-tenant bind case.
    await request(app)
      .post('/api/tenants/v1/tenants')
      .set('Cookie', rootCookies)
      .send({
        tenant_code: 'VCTSTB',
        company: 'Vendor Contact Test Corp B',
        status: 'active',
        tier: 'starter',
        admin_first_name: 'B',
        admin_last_name: 'Admin',
        admin_email: 'admin@vctstb.com',
        admin_password: 'VctstbPass123!',
        billing_address: { address_line_1: '1 B St', country_code: 'US' },
      });
    const loginB = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@vctstb.com', password: 'VctstbPass123!' });
    cookiesB = loginB.headers['set-cookie'];

    const vendorA = await request(app)
      .post('/api/core/v1/vendors')
      .set('Cookie', cookiesA)
      .send({ name: 'Bind Vendor A', code: 'BVEN' });
    vendorIdA = vendorA.body.id;

    const vendorB = await request(app)
      .post('/api/core/v1/vendors')
      .set('Cookie', cookiesB)
      .send({ name: 'Bind Vendor B', code: 'BVENB' });
    vendorIdB = vendorB.body.id;
  }, 30000);

  test('first vendor_contact in tenant A with new email creates portal_user + binding', async () => {
    const res = await request(app)
      .post('/api/core/v1/vendor-contacts')
      .set('Cookie', cookiesA)
      .send({
        vendor_id: vendorIdA,
        first_name: 'Vera',
        last_name: 'Shared',
        email: SHARED_EMAIL,
        is_app_user: true,
        roles: ['vendor'],
        password: 'VendorPass123!',
      });
    expect(res.status).toBe(201);

    const portal = await db.oneOrNone(
      'SELECT id, status FROM admin.portal_users WHERE email = $1 AND deactivated_at IS NULL',
      [SHARED_EMAIL],
    );
    expect(portal).not.toBeNull();
    expect(portal.status).toBe('invited');

    const binding = await db.oneOrNone(
      `SELECT entity_type, entity_id, status FROM admin.portal_user_tenants
       WHERE portal_user_id = $1 AND deactivated_at IS NULL`,
      [portal.id],
    );
    expect(binding.entity_type).toBe('vendor_contact');
    expect(binding.entity_id).toBe(res.body.id);
    expect(binding.status).toBe('active');
  });

  test('second vendor_contact in tenant B with same email binds to the existing portal_user, status=invited, no new portal_user, password unchanged', async () => {
    const before = await db.one(
      'SELECT COUNT(*)::int AS count, MAX(password_hash) AS hash FROM admin.portal_users WHERE email = $1',
      [SHARED_EMAIL],
    );
    expect(before.count).toBe(1);

    const res = await request(app)
      .post('/api/core/v1/vendor-contacts')
      .set('Cookie', cookiesB)
      .send({
        vendor_id: vendorIdB,
        first_name: 'Vera',
        last_name: 'Shared',
        email: SHARED_EMAIL,
        is_app_user: true,
        roles: ['vendor'],
        password: 'AttemptedHijack123!',
      });
    expect(res.status).toBe(201);

    // No new portal_users row was created
    const after = await db.one(
      'SELECT COUNT(*)::int AS count, MAX(password_hash) AS hash FROM admin.portal_users WHERE email = $1',
      [SHARED_EMAIL],
    );
    expect(after.count).toBe(1);
    // Supplied password was ignored — credentials unchanged
    expect(after.hash).toBe(before.hash);

    // The new tenant-B binding points at the existing portal_user with status='invited'
    const portal = await db.one(
      'SELECT id FROM admin.portal_users WHERE email = $1 AND deactivated_at IS NULL',
      [SHARED_EMAIL],
    );
    const bindings = await db.any(
      `SELECT entity_id, tenant_id, status FROM admin.portal_user_tenants
       WHERE portal_user_id = $1 AND deactivated_at IS NULL
       ORDER BY created_at ASC`,
      [portal.id],
    );
    expect(bindings.length).toBe(2);
    const tenantBBinding = bindings.find((b) => b.entity_id === res.body.id);
    expect(tenantBBinding).toBeDefined();
    expect(tenantBBinding.status).toBe('invited');
  });
});
