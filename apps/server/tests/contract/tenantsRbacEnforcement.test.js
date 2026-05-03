/**
 * @file Contract test for rbac enforcement on tenants/* routes (issue #57)
 * @module tests/contract/tenantsRbacEnforcement
 *
 * After Step 4, the tenants/* router surface consults rbac() on the
 * resource action codes. This test locks the contract: a custom Axerra
 * role with a specific deny on `tenants::admin::list_schemas` is
 * actually denied at the route layer (403), and lifting the deny to
 * 'view' makes the same call succeed (200). Pairs with the catalog
 * flip in step 3 — the rows are now grantable in PolicyEditor and
 * honored by the API.
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { bootstrapAdmin, cleanupTestDb, DB } from '../helpers/testDb.js';

let db;
beforeAll(async () => {
  await cleanupTestDb();
  db = await bootstrapAdmin();
}, 30000);

const { default: app } = await import('../../src/app.js');

afterAll(async () => {
  await cleanupTestDb();
}, 15000);

const TEST_EMAIL = 'rbac57-test@axerra.io';
const TEST_PASSWORD = 'RbacTest57!';
const TEST_ROLE_CODE = '_test_rbac_57';
const TEST_TENANT_SCHEMA = (process.env.ROOT_TENANT_CODE || 'AXERRA').toLowerCase();
// Quote the schema identifier safely (matches the convention in other
// contract tests). Avoids accidental breakage if ROOT_TENANT_CODE ever
// resolves to a value that needs escaping.
const TS = DB.pgp.as.name(TEST_TENANT_SCHEMA);

describe('RBAC enforcement on tenants/* routes (issue #57)', () => {
  let testUserCookies;
  let testUserId;
  let testRoleId;
  let employeeId;

  beforeAll(async () => {
    const tenant = await db.one(
      'SELECT id FROM admin.tenants WHERE schema_name = $1',
      [TEST_TENANT_SCHEMA],
    );

    // Custom Axerra role: wildcard view + specific deny on list_schemas.
    // The deny overrides the wildcard via rbac.js's most-specific-first
    // resolution cascade (module::router::action → module::router::
    // → module:::: → ::::).
    const role = await db.one(
      `INSERT INTO ${TS}.roles (code, name, description, scope, is_system, is_immutable)
       VALUES ($1, 'RBAC Test Role', 'Issue #57 contract test fixture', 'all_projects', false, false)
       RETURNING id`,
      [TEST_ROLE_CODE],
    );
    testRoleId = role.id;

    await db.none(
      `INSERT INTO ${TS}.policies (role_id, module, router, action, level)
       VALUES ($1, '', null, null, 'view'),
              ($1, 'tenants', 'admin', 'list_schemas', 'none')`,
      [testRoleId],
    );

    // Test employee carrying the custom role
    const employee = await db.one(
      `INSERT INTO ${TS}.employees
         (tenant_id, first_name, last_name, is_app_user, roles)
       VALUES ($1, 'RBAC57', 'Tester', true, $2)
       RETURNING id`,
      [tenant.id, `{${TEST_ROLE_CODE}}`],
    );
    employeeId = employee.id;

    const source = await db.one(
      `INSERT INTO ${TS}.sources (tenant_id, table_id, source_type, label)
       VALUES ($1, $2, 'employee', 'RBAC57 Tester')
       RETURNING id`,
      [tenant.id, employeeId],
    );
    await db.none(
      `UPDATE ${TS}.employees SET source_id = $1 WHERE id = $2`,
      [source.id, employeeId],
    );

    const { default: bcrypt } = await import('bcrypt');
    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 4);
    const portalUser = await db.one(
      `INSERT INTO admin.portal_users (email, password_hash, status)
       VALUES ($1, $2, 'active')
       RETURNING id`,
      [TEST_EMAIL, passwordHash],
    );
    testUserId = portalUser.id;

    await db.none(
      `INSERT INTO admin.portal_user_tenants (portal_user_id, tenant_id, entity_type, entity_id, status)
       VALUES ($1, $2, 'employee', $3, 'active')`,
      [testUserId, tenant.id, employeeId],
    );

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
    expect(loginRes.status).toBe(200);
    testUserCookies = loginRes.headers['set-cookie'];
  }, 30000);

  afterAll(async () => {
    if (testUserId) {
      await db.none('DELETE FROM admin.portal_user_tenants WHERE portal_user_id = $1', [testUserId]);
      await db.none('DELETE FROM admin.portal_users WHERE id = $1', [testUserId]);
    }
    if (testRoleId) {
      await db.none(`DELETE FROM ${TS}.policies WHERE role_id = $1`, [testRoleId]);
      await db.none(`DELETE FROM ${TS}.roles WHERE id = $1`, [testRoleId]);
    }
    if (employeeId) {
      await db.none(
        `DELETE FROM ${TS}.sources WHERE table_id = $1 AND source_type = 'employee'`,
        [employeeId],
      );
      await db.none(`DELETE FROM ${TS}.employees WHERE id = $1`, [employeeId]);
    }
  }, 15000);

  test('GET /admin/schemas → 403 when role has explicit deny on tenants::admin::list_schemas', async () => {
    const res = await request(app)
      .get('/api/tenants/v1/admin/schemas')
      .set('Cookie', testUserCookies);
    expect(res.status).toBe(403);
  });

  test('GET /admin/schemas → 200 after lifting the deny to view', async () => {
    await db.none(
      `UPDATE ${TS}.policies SET level = 'view'
       WHERE role_id = $1 AND module = 'tenants' AND router = 'admin' AND action = 'list_schemas'`,
      [testRoleId],
    );

    // Cache invalidation — authRedis would otherwise serve the stale
    // 'none' grant from Redis until the 15-min TTL.
    const { invalidateByUser } = await import('../../src/services/permCacheInvalidator.js');
    await invalidateByUser(testUserId);

    const res = await request(app)
      .get('/api/tenants/v1/admin/schemas')
      .set('Cookie', testUserCookies);
    expect(res.status).toBe(200);
  });

  test('POST /admin/impersonate → 403 because view-only on a full-required action', async () => {
    // Same user, still wildcard 'view' + view on list_schemas. The
    // impersonate route requires 'full', so the wildcard view doesn't
    // satisfy it and the route 403s.
    const res = await request(app)
      .post('/api/tenants/v1/admin/impersonate')
      .set('Cookie', testUserCookies)
      .send({ target_user_id: '00000000-0000-0000-0000-000000000000' });
    expect(res.status).toBe(403);
  });
});
