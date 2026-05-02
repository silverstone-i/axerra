/**
 * @file Contract tests for orphan portal_users cleanup endpoints
 * @module tests/contract/orphanPortalUsersCleanup
 *
 * Exercises GET /orphans/preview and POST /orphans/cleanup of
 * /api/tenants/v1/orphan-portal-users end-to-end. Verifies Axerra-only
 * gating via requireRootTenant.
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

  // Install the admin-scope orphan portal_users SQL helpers — the contract
  // test bootstrap only runs the bootstrapAdmin migration, so subsequent
  // admin-scope migrations have to be applied explicitly here.
  const { default: orphanMigration } = await import(
    '../../src/system/auth/schema/migrations/202605010001_orphanPortalUsersCleanup.js'
  );
  await orphanMigration.up({ schema: 'admin', db });
}, 30000);

const { default: app } = await import('../../src/app.js');

afterAll(async () => {
  await cleanupTestDb();
}, 15000);

async function loginRoot() {
  const res = await request(app).post('/api/auth/login').send({ email: ROOT_EMAIL, password: ROOT_PASSWORD });
  return res.headers['set-cookie'];
}

async function provisionTenant(cookies, tenantCode = 'OPU') {
  const body = {
    tenant_code: tenantCode,
    company: `${tenantCode} Corp`,
    status: 'active',
    tier: 'starter',
    admin_first_name: 'Tenant',
    admin_last_name: 'Admin',
    admin_email: `admin@${tenantCode.toLowerCase()}.com`,
    admin_password: 'OpuTest123!',
    billing_address: { address_line_1: '1 Test Way', country_code: 'US' },
  };
  const res = await request(app).post('/api/tenants/v1/tenants').set('Cookie', cookies).send(body);
  return res.body;
}

describe('Orphan portal_users cleanup — /api/tenants/v1/orphan-portal-users/orphans/{preview,cleanup}', () => {
  let rootCookies;

  beforeAll(async () => {
    rootCookies = await loginRoot();
  }, 30000);

  test('GET returns 401 without auth', async () => {
    const res = await request(app).get('/api/tenants/v1/orphan-portal-users/orphans/preview');
    expect(res.status).toBe(401);
  });

  test('POST returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/tenants/v1/orphan-portal-users/orphans/cleanup')
      .send({ id: '00000000-0000-0000-0000-000000000000' });
    expect(res.status).toBe(401);
  });

  test('GET returns zero orphans when only bound users exist', async () => {
    // Strip any pre-existing orphan rows so the count baseline is deterministic
    await db.none(`
      DELETE FROM admin.portal_users pu
      WHERE NOT EXISTS (
        SELECT 1 FROM admin.portal_user_tenants put
        WHERE put.portal_user_id = pu.id
      )
    `);

    const res = await request(app)
      .get('/api/tenants/v1/orphan-portal-users/orphans/preview')
      .set('Cookie', rootCookies);
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
    expect(res.body.orphans).toEqual([]);
  });

  test('GET surfaces a synthetic orphan; POST removes it; GET returns zero again', async () => {
    const orphan = await db.one(
      `INSERT INTO admin.portal_users (email, password_hash, status)
       VALUES ('orphan@example.com', 'x', 'active')
       RETURNING id`,
    );

    const previewRes = await request(app)
      .get('/api/tenants/v1/orphan-portal-users/orphans/preview')
      .set('Cookie', rootCookies);
    expect(previewRes.status).toBe(200);
    expect(previewRes.body.count).toBe(1);
    expect(previewRes.body.orphans[0].id).toBe(orphan.id);
    expect(previewRes.body.orphans[0].email).toBe('orphan@example.com');

    const cleanupRes = await request(app)
      .post('/api/tenants/v1/orphan-portal-users/orphans/cleanup')
      .set('Cookie', rootCookies)
      .send({ id: orphan.id });
    expect(cleanupRes.status).toBe(200);
    expect(cleanupRes.body.removed.id).toBe(orphan.id);

    const verifyRes = await request(app)
      .get('/api/tenants/v1/orphan-portal-users/orphans/preview')
      .set('Cookie', rootCookies);
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.count).toBe(0);

    const stillThere = await db.oneOrNone('SELECT id FROM admin.portal_users WHERE id = $1', [orphan.id]);
    expect(stillThere).toBeNull();
  });

  test('GET does NOT classify a portal_user with only archived bindings as an orphan', async () => {
    const tenant = await db.oneOrNone('SELECT id FROM admin.tenants LIMIT 1');
    expect(tenant?.id).toBeTruthy();

    const archivedOnly = await db.one(
      `INSERT INTO admin.portal_users (email, password_hash, status)
       VALUES ('archived-binding@example.com', 'x', 'active')
       RETURNING id`,
    );
    await db.none(
      `INSERT INTO admin.portal_user_tenants (portal_user_id, tenant_id, status, deactivated_at)
       VALUES ($1, $2, 'active', now())`,
      [archivedOnly.id, tenant.id],
    );

    const previewRes = await request(app)
      .get('/api/tenants/v1/orphan-portal-users/orphans/preview')
      .set('Cookie', rootCookies);
    expect(previewRes.status).toBe(200);
    expect(previewRes.body.orphans.find((o) => o.id === archivedOnly.id)).toBeUndefined();

    const cleanupRes = await request(app)
      .post('/api/tenants/v1/orphan-portal-users/orphans/cleanup')
      .set('Cookie', rootCookies)
      .send({ id: archivedOnly.id });
    expect(cleanupRes.status).toBe(404);

    const stillThere = await db.oneOrNone('SELECT id FROM admin.portal_users WHERE id = $1', [archivedOnly.id]);
    expect(stillThere).not.toBeNull();
  });

  test('POST returns 400 for missing/invalid id', async () => {
    const missing = await request(app)
      .post('/api/tenants/v1/orphan-portal-users/orphans/cleanup')
      .set('Cookie', rootCookies)
      .send({});
    expect(missing.status).toBe(400);

    const bad = await request(app)
      .post('/api/tenants/v1/orphan-portal-users/orphans/cleanup')
      .set('Cookie', rootCookies)
      .send({ id: 'not-a-uuid' });
    expect(bad.status).toBe(400);
  });

  test('POST returns 404 when the user has an active binding (not an orphan)', async () => {
    // The Axerra root user always has an active binding; deleting it should fail.
    const rootUser = await db.one(
      `SELECT pu.id FROM admin.portal_users pu
       JOIN admin.portal_user_tenants put ON put.portal_user_id = pu.id
       WHERE put.deactivated_at IS NULL
       LIMIT 1`,
    );

    const res = await request(app)
      .post('/api/tenants/v1/orphan-portal-users/orphans/cleanup')
      .set('Cookie', rootCookies)
      .send({ id: rootUser.id });
    expect(res.status).toBe(404);

    const stillThere = await db.oneOrNone('SELECT id FROM admin.portal_users WHERE id = $1', [rootUser.id]);
    expect(stillThere).not.toBeNull();
  });

  test('Non-Axerra user receives 403 (requireRootTenant)', async () => {
    const tenantRec = await provisionTenant(rootCookies, 'OPU');
    expect(tenantRec.id).toBeTruthy();

    const tenantLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@opu.com', password: 'OpuTest123!' });
    const tenantCookies = tenantLogin.headers['set-cookie'];

    const previewRes = await request(app)
      .get('/api/tenants/v1/orphan-portal-users/orphans/preview')
      .set('Cookie', tenantCookies);
    expect(previewRes.status).toBe(403);

    const cleanupRes = await request(app)
      .post('/api/tenants/v1/orphan-portal-users/orphans/cleanup')
      .set('Cookie', tenantCookies)
      .send({ id: '00000000-0000-0000-0000-000000000000' });
    expect(cleanupRes.status).toBe(403);
  });
});
