/**
 * @file Contract tests for the Phase 3 login-time permission gate
 * @module tests/contract/loginPermissionGate
 *
 * Locks in the behavior introduced by Phase 3 (`authController.login`):
 *   - Properly-configured user (root admin) logs in successfully, gets
 *     cookies, and the permission canon is primed into Redis at the
 *     standard cache key (`perm:${userId}:${tenantCode}`).
 *   - Bare-registered user with no entity binding (entity_type/entity_id
 *     are NULL on the home binding) is refused with 403 + the documented
 *     message and no cookies are set.
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { bootstrapAdmin, cleanupTestDb } from '../helpers/testDb.js';
import { getRedis } from '../../src/db/redis.js';
import { permCacheKey } from '../../src/services/permissionLoader.js';

const ROOT_EMAIL = process.env.ROOT_EMAIL;
const ROOT_PASSWORD = process.env.ROOT_PASSWORD;
const ROOT_TENANT_CODE = (process.env.ROOT_TENANT_CODE || 'AXERRA').toUpperCase();

beforeAll(async () => {
  await cleanupTestDb();
  await bootstrapAdmin();
}, 30000);

const { default: app } = await import('../../src/app.js');

afterAll(async () => {
  await cleanupTestDb();
}, 15000);

describe('Phase 3 login-time permission gate', () => {
  test('properly-configured root admin logs in and the permission cache is primed', async () => {
    const redis = await getRedis();

    // Find the root user id so we can check the Redis key after login.
    const adminUser = await (await import('../../src/db/db.js')).default.oneOrNone(
      `SELECT id FROM admin.portal_users WHERE email = $1`,
      [ROOT_EMAIL],
    );
    expect(adminUser).not.toBeNull();
    const cacheKey = permCacheKey(adminUser.id, ROOT_TENANT_CODE);

    // Ensure the cache key is clear before login so the test asserts a
    // login-time prime, not a leftover from another test.
    await redis.del(cacheKey);

    const res = await request(app).post('/api/auth/login').send({ email: ROOT_EMAIL, password: ROOT_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Logged in successfully');
    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.headers['set-cookie'].some((c) => c.startsWith('auth_token='))).toBe(true);

    // Cache should now be populated with a canon carrying non-empty caps.
    const cached = await redis.get(cacheKey);
    expect(cached).not.toBeNull();
    const canon = JSON.parse(cached);
    expect(canon.caps).toBeDefined();
    expect(Object.keys(canon.caps).length).toBeGreaterThan(0);
  });

  test('bare-registered user (no entity binding) is refused with 403 and no cookies', async () => {
    // Use a unique email so this is independent of any other suite.
    const TEST_EMAIL = 'phase3-gate@axerra.io';
    const TEST_PASSWORD = 'GateTest123!';

    // Register a portal user via the admin endpoint. The register flow
    // creates the portal_user and an auth-only portal_user_tenants binding
    // with entity_type/entity_id = NULL — exactly the case the gate is
    // supposed to reject.
    const adminLogin = await request(app).post('/api/auth/login').send({ email: ROOT_EMAIL, password: ROOT_PASSWORD });
    const adminCookies = adminLogin.headers['set-cookie'];

    const reg = await request(app)
      .post('/api/tenants/v1/portal-users/register')
      .set('Cookie', adminCookies)
      .send({ tenant_code: ROOT_TENANT_CODE, email: TEST_EMAIL, password: TEST_PASSWORD });
    expect(reg.status).toBe(201);

    const res = await request(app).post('/api/auth/login').send({ email: TEST_EMAIL, password: TEST_PASSWORD });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/no permissions/i);
    expect(res.headers['set-cookie']).toBeUndefined();
  });
});
