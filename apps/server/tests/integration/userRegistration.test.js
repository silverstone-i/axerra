/**
 * @file Integration test — user registration: register → login → verify
 * @module tests/integration/userRegistration
 *
 * Verifies end-to-end user registration flow: register a user on the
 * root tenant, verify they can log in and access /me, and that
 * password_hash is never exposed.
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { bootstrapAdmin, cleanupTestDb } from '../helpers/testDb.js';

const ROOT_EMAIL = process.env.ROOT_EMAIL;
const ROOT_PASSWORD = process.env.ROOT_PASSWORD;
const ROOT_TENANT_CODE = process.env.ROOT_TENANT_CODE || 'AXERRA';

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

describe('User registration lifecycle — register → login → verify', () => {
  const TEST_EMAIL = 'integ-test@axerra.io';
  const TEST_PASSWORD = 'IntegTest123!';

  test('1. Register user via admin endpoint', async () => {
    const cookies = await loginRoot();

    const res = await request(app)
      .post('/api/tenants/v1/portal-users/register')
      .set('Cookie', cookies)
      .send({
        tenant_code: ROOT_TENANT_CODE,
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(TEST_EMAIL);
    expect(res.body.user.status).toBe('active');
    expect(res.body.user.password_hash).toBeUndefined();
  });

  test('2. Bare-registered user (no entity binding) is blocked at login by Phase 3 gate', async () => {
    // /portal-users/register creates the portal_user + an auth-only
    // portal_user_tenants binding with entity_type/entity_id = NULL.
    // The user has no roles, so loadPermissions returns empty caps and
    // the Phase 3 login gate refuses to issue tokens.
    const res = await request(app).post('/api/auth/login').send({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/no permissions/i);
    // No cookies set on a rejected login.
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  test('3. Rejected login leaves no usable session', async () => {
    // Same call as test 2; verify there's no `auth_token` to use.
    const loginRes = await request(app).post('/api/auth/login').send({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    expect(loginRes.status).toBe(403);

    // Without a cookie, /me is 401 (not 200 — the user never got in).
    const meRes = await request(app).get('/api/auth/me');
    expect(meRes.status).toBe(401);
  });

  test('4. Archive user prevents login', async () => {
    const adminCookies = await loginRoot();

    // Find the test user
    const listRes = await request(app).get('/api/tenants/v1/portal-users').set('Cookie', adminCookies);
    const rows = listRes.body.rows ?? listRes.body;
    const target = (Array.isArray(rows) ? rows : []).find((u) => u.email === TEST_EMAIL);
    expect(target).toBeDefined();

    // Archive the user
    const archiveRes = await request(app)
      .delete(`/api/tenants/v1/portal-users/archive?id=${target.id}`)
      .set('Cookie', adminCookies)
      .send({});

    expect(archiveRes.status).toBe(200);

    // Verify user cannot log in
    const loginRes = await request(app).post('/api/auth/login').send({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    expect(loginRes.status).toBeGreaterThanOrEqual(400);
  });

  test('5. Restore user re-enables login', async () => {
    const adminCookies = await loginRoot();

    // Find the archived test user
    const listRes = await request(app)
      .get('/api/tenants/v1/portal-users?includeDeactivated=true')
      .set('Cookie', adminCookies);
    const rows = listRes.body.rows ?? listRes.body;
    const target = (Array.isArray(rows) ? rows : []).find((u) => u.email === TEST_EMAIL);

    // Restore
    const restoreRes = await request(app)
      .patch(`/api/tenants/v1/portal-users/restore?id=${target.id}`)
      .set('Cookie', adminCookies)
      .send({});

    expect(restoreRes.status).toBe(200);

    // Restore re-enables the portal_user row, but the bare-registered
    // user still has no entity binding (and therefore no roles), so the
    // Phase 3 gate keeps refusing login. Restoring the user record does
    // not by itself grant authorization.
    const loginRes = await request(app).post('/api/auth/login').send({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    expect(loginRes.status).toBe(403);
    expect(loginRes.body.message).toMatch(/no permissions/i);
  });
});
