/**
 * @file Contract tests for admin endpoints — schemas, impersonation
 * @module tests/contract/admin
 *
 * Tests admin schema listing and impersonation start/stop/status.
 * Requires Redis — tests that call Redis will be skipped if unavailable.
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

describe('GET /api/tenants/v1/admin/schemas', () => {
  test('returns 401 without auth', async () => {
    const res = await request(app).get('/api/tenants/v1/admin/schemas');
    expect(res.status).toBe(401);
  });

  test('returns active tenant schemas for Axerra user', async () => {
    const cookies = await loginRoot();
    const res = await request(app).get('/api/tenants/v1/admin/schemas').set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);

    // Check whitelisted columns only
    const first = res.body[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('tenant_code');
    expect(first).toHaveProperty('schema_name');
    expect(first).toHaveProperty('company');
    expect(first).toHaveProperty('status');
  });
});

describe('POST /api/tenants/v1/admin/impersonate', () => {
  test('returns 400 without target_user_id', async () => {
    const cookies = await loginRoot();
    const res = await request(app)
      .post('/api/tenants/v1/admin/impersonate')
      .set('Cookie', cookies)
      .send({});

    expect(res.status).toBe(400);
  });

  test('returns 404 for nonexistent target user', async () => {
    const cookies = await loginRoot();
    const res = await request(app)
      .post('/api/tenants/v1/admin/impersonate')
      .set('Cookie', cookies)
      .send({ target_user_id: '00000000-0000-0000-0000-000000000000' });

    expect(res.status).toBe(404);
  });

  test('multi-binding target: target_tenant_id picks the requested binding', async () => {
    const cookies = await loginRoot();

    // Provision a portal_user with bindings to two tenants
    const tenants = await db.manyOrNone('SELECT id, tenant_code FROM admin.tenants ORDER BY created_at ASC LIMIT 2');
    if (tenants.length < 2) {
      // Need a second tenant; create one via the API
      await request(app)
        .post('/api/tenants/v1/tenants')
        .set('Cookie', cookies)
        .send({
          tenant_code: 'IMPB',
          company: 'Imp Tenant B',
          status: 'active',
          tier: 'starter',
          admin_first_name: 'B',
          admin_last_name: 'Admin',
          admin_email: 'admin@impb.test',
          admin_password: 'ImpbPass123!',
          billing_address: { address_line_1: '1 B St', country_code: 'US' },
        });
    }
    const allTenants = await db.manyOrNone('SELECT id, tenant_code FROM admin.tenants ORDER BY created_at ASC LIMIT 2');
    expect(allTenants.length).toBe(2);
    const [tenantA, tenantB] = allTenants;

    const user = await db.one(
      `INSERT INTO admin.portal_users (email, password_hash, status)
       VALUES ('multi@impb.test', 'x', 'active') RETURNING id`,
    );
    // Earliest binding to tenant A; later binding to tenant B
    await db.none(
      `INSERT INTO admin.portal_user_tenants (portal_user_id, tenant_id, entity_type, entity_id, status, created_at)
       VALUES ($1, $2, 'vendor_contact', gen_random_uuid(), 'active', now() - interval '1 day')`,
      [user.id, tenantA.id],
    );
    await db.none(
      `INSERT INTO admin.portal_user_tenants (portal_user_id, tenant_id, entity_type, entity_id, status)
       VALUES ($1, $2, 'vendor_contact', gen_random_uuid(), 'active')`,
      [user.id, tenantB.id],
    );

    // Without target_tenant_id → earliest binding wins (tenant A)
    let res = await request(app)
      .post('/api/tenants/v1/admin/impersonate')
      .set('Cookie', cookies)
      .send({ target_user_id: user.id });
    expect(res.status).toBe(200);
    expect(res.body.target_user.tenant_id).toBe(tenantA.id);

    // Clean up impersonation session before the next call
    await request(app).post('/api/tenants/v1/admin/exit-impersonation').set('Cookie', cookies);

    // With target_tenant_id pointing at B → tenant B binding is used
    res = await request(app)
      .post('/api/tenants/v1/admin/impersonate')
      .set('Cookie', cookies)
      .send({ target_user_id: user.id, target_tenant_id: tenantB.id });
    expect(res.status).toBe(200);
    expect(res.body.target_user.tenant_id).toBe(tenantB.id);

    // Cleanup
    await request(app).post('/api/tenants/v1/admin/exit-impersonation').set('Cookie', cookies);
    await db.none('DELETE FROM admin.impersonation_logs WHERE target_user_id = $1', [user.id]);
    await db.none('DELETE FROM admin.portal_user_tenants WHERE portal_user_id = $1', [user.id]);
    await db.none('DELETE FROM admin.portal_users WHERE id = $1', [user.id]);
  }, 30000);
});

describe('GET /api/tenants/v1/admin/impersonation-status', () => {
  test('returns inactive status when not impersonating', async () => {
    const cookies = await loginRoot();
    const res = await request(app)
      .get('/api/tenants/v1/admin/impersonation-status')
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.active).toBe(false);
  });
});

describe('POST /api/tenants/v1/admin/exit-impersonation', () => {
  test('returns success even when not impersonating', async () => {
    const cookies = await loginRoot();
    const res = await request(app)
      .post('/api/tenants/v1/admin/exit-impersonation')
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('No active');
  });
});
