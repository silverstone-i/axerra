/**
 * @file Contract test: tenants /import-xls and /export-xls regression coverage
 * @module tests/contract/tenantsImportExport
 *
 * PR #63 inadvertently disabled the tenants spreadsheet routes by setting
 * disableImportXls/disableExportXls on the router. PR #65 restored them
 * and added the tenants::tenants::import and ::export policy_catalog
 * rows. This test locks both contracts so the same regression cannot
 * recur:
 *   1. /import-xls and /export-xls are registered (not 404).
 *   2. Both are RBAC-gated — a role with the action-level deny gets 403,
 *      and lifting the deny to the appropriate level (full for import,
 *      view for export) makes the route stop refusing on RBAC grounds.
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
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

const TEST_EMAIL = 'tenants-xls-test@axerra.io';
const TEST_PASSWORD = 'TenantsXls65!';
const TEST_ROLE_CODE = '_test_tenants_xls_65';
const TEST_TENANT_SCHEMA = (process.env.ROOT_TENANT_CODE || 'AXERRA').toLowerCase();
const TS = DB.pgp.as.name(TEST_TENANT_SCHEMA);

describe('tenants /import-xls and /export-xls (PR #65 regression coverage)', () => {
  let testUserCookies;
  let testUserId;
  let testRoleId;
  let employeeId;

  beforeAll(async () => {
    const tenant = await db.one(
      'SELECT id FROM admin.tenants WHERE schema_name = $1',
      [TEST_TENANT_SCHEMA],
    );

    // Custom Axerra role: wildcard full + specific denies on the new
    // import/export action codes. The denies override the wildcard via
    // the most-specific-first cascade in rbac.js.
    const role = await db.one(
      `INSERT INTO ${TS}.roles (code, name, description, scope, is_system, is_immutable)
       VALUES ($1, 'Tenants XLS Test Role', 'PR #65 contract fixture', 'all_projects', false, false)
       RETURNING id`,
      [TEST_ROLE_CODE],
    );
    testRoleId = role.id;

    await db.none(
      `INSERT INTO ${TS}.policies (role_id, module, router, action, level)
       VALUES ($1, '', null, null, 'full'),
              ($1, 'tenants', 'tenants', 'import', 'none'),
              ($1, 'tenants', 'tenants', 'export', 'none')`,
      [testRoleId],
    );

    const employee = await db.one(
      `INSERT INTO ${TS}.employees
         (tenant_id, first_name, last_name, is_app_user, roles)
       VALUES ($1, 'TenantsXls', 'Tester', true, $2)
       RETURNING id`,
      [tenant.id, `{${TEST_ROLE_CODE}}`],
    );
    employeeId = employee.id;

    const source = await db.one(
      `INSERT INTO ${TS}.sources (tenant_id, table_id, source_type, label)
       VALUES ($1, $2, 'employee', 'TenantsXls Tester')
       RETURNING id`,
      [tenant.id, employeeId],
    );
    await db.none(`UPDATE ${TS}.employees SET source_id = $1 WHERE id = $2`, [source.id, employeeId]);

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
      await db.none(`DELETE FROM ${TS}.sources WHERE table_id = $1 AND source_type = 'employee'`, [employeeId]);
      await db.none(`DELETE FROM ${TS}.employees WHERE id = $1`, [employeeId]);
    }
  }, 15000);

  test('POST /import-xls is registered (not 404) — returns 401 without auth', async () => {
    const res = await request(app).post('/api/tenants/v1/tenants/import-xls');
    expect(res.status).toBe(401);
  });

  test('POST /export-xls is registered (not 404) — returns 401 without auth', async () => {
    const res = await request(app).post('/api/tenants/v1/tenants/export-xls');
    expect(res.status).toBe(401);
  });

  test('POST /import-xls → 403 with explicit deny on tenants::tenants::import', async () => {
    const res = await request(app)
      .post('/api/tenants/v1/tenants/import-xls')
      .set('Cookie', testUserCookies);
    expect(res.status).toBe(403);
  });

  test('POST /export-xls → 403 with explicit deny on tenants::tenants::export', async () => {
    const res = await request(app)
      .post('/api/tenants/v1/tenants/export-xls')
      .set('Cookie', testUserCookies);
    expect(res.status).toBe(403);
  });

  test('POST /import-xls → no longer 403 after lifting deny to full', async () => {
    await db.none(
      `UPDATE ${TS}.policies SET level = 'full'
       WHERE role_id = $1 AND module = 'tenants' AND router = 'tenants' AND action = 'import'`,
      [testRoleId],
    );
    const { invalidateByUser } = await import('../../src/services/permCacheInvalidator.js');
    await invalidateByUser(testUserId);

    const res = await request(app)
      .post('/api/tenants/v1/tenants/import-xls')
      .set('Cookie', testUserCookies);
    // 400 (missing multipart file) or 200/201 are both fine — the assertion
    // is that RBAC no longer refuses. 404 would mean the route is gone.
    expect(res.status).not.toBe(403);
    expect(res.status).not.toBe(404);
  });

  test('POST /export-xls → no longer 403 after lifting deny to view', async () => {
    await db.none(
      `UPDATE ${TS}.policies SET level = 'view'
       WHERE role_id = $1 AND module = 'tenants' AND router = 'tenants' AND action = 'export'`,
      [testRoleId],
    );
    const { invalidateByUser } = await import('../../src/services/permCacheInvalidator.js');
    await invalidateByUser(testUserId);

    const res = await request(app)
      .post('/api/tenants/v1/tenants/export-xls')
      .set('Cookie', testUserCookies);
    expect(res.status).not.toBe(403);
    expect(res.status).not.toBe(404);
  });
});
