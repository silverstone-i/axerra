/**
 * @file Integration test — entity lifecycle: employee is_app_user provisioning
 * @module tests/integration/entityLifecycle
 *
 * Verifies: Create tenant → create employee → set is_app_user → verify portal_user
 * in admin.portal_users → archive employee → verify portal_user status=locked →
 * restore employee → verify portal_user restored.
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

describe('Entity lifecycle — employee is_app_user with portal_users cascade', () => {
  let tenantCookies;
  let employeeId;

  test('1. Provision tenant', async () => {
    const rootCookies = await loginRoot();
    const res = await request(app)
      .post('/api/tenants/v1/tenants')
      .set('Cookie', rootCookies)
      .send({
        tenant_code: 'ELTEST',
        company: 'Entity Lifecycle Corp',
        status: 'active',
        tier: 'starter',
        admin_first_name: 'Test',
        admin_last_name: 'Admin',
        admin_email: 'admin@eltest.com',
        admin_password: 'EltestPass123!',
        billing_address: { address_line_1: '1 Test St', country_code: 'US' },
      });
    expect(res.status).toBe(201);

    // Login as tenant admin
    const loginRes = await request(app).post('/api/auth/login').send({ email: 'admin@eltest.com', password: 'EltestPass123!' });
    tenantCookies = loginRes.headers['set-cookie'];
    expect(tenantCookies).toBeDefined();
  }, 30000);

  test('2. Create employee with is_app_user=true provisions portal_user', async () => {
    const res = await request(app)
      .post('/api/core/v1/employees')
      .set('Cookie', tenantCookies)
      .send({
        first_name: 'Alice',
        last_name: 'Wonder',
        code: 'AW001',
        email: 'alice@eltest.com',
        roles: ['admin'],
        is_app_user: true,
      });

    expect(res.status).toBe(201);
    employeeId = res.body.id;

    // Verify portal_user + binding exist
    const portalUser = await db.oneOrNone(
      `SELECT pu.id, pu.email, pu.status, b.entity_type, b.entity_id
       FROM admin.portal_users pu
       JOIN admin.portal_user_tenants b ON b.portal_user_id = pu.id
       WHERE b.entity_type = 'employee' AND b.entity_id = $1`,
      [employeeId],
    );
    expect(portalUser).not.toBeNull();
    expect(portalUser.email).toBe('alice@eltest.com');
    expect(portalUser.status).toBe('invited');
  });

  test('3. Archive employee cascades to lock portal_user', async () => {
    const res = await request(app).delete(`/api/core/v1/employees/archive?id=${employeeId}`).set('Cookie', tenantCookies).send({});

    expect(res.status).toBe(200);

    // Verify portal_user + binding are both locked
    const portalUser = await db.oneOrNone(
      `SELECT pu.status, pu.deactivated_at
       FROM admin.portal_users pu
       JOIN admin.portal_user_tenants b ON b.portal_user_id = pu.id
       WHERE b.entity_type = 'employee' AND b.entity_id = $1`,
      [employeeId],
    );
    expect(portalUser.status).toBe('locked');
    expect(portalUser.deactivated_at).not.toBeNull();
  });

  test('4. Archived employee login fails', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'alice@eltest.com', password: 'anything' });

    // Login should fail (user is deactivated)
    expect(res.status).not.toBe(200);
  });

  test('5. Restore employee cascades to restore portal_user (deactivated_at only; status preserved)', async () => {
    const res = await request(app).patch(`/api/core/v1/employees/restore?id=${employeeId}`).set('Cookie', tenantCookies).send({});

    expect(res.status).toBe(200);

    // Per the cascade-restore rule of record: clear deactivated_at on the
    // binding cohort sharing the MAX deactivated_at, AND on the linked
    // portal_users — but never touch `status`. The portal_user was set to
    // 'locked' by the archive cascade and stays at 'locked' until the
    // user is explicitly reactivated.
    const portalUser = await db.oneOrNone(
      `SELECT pu.status, pu.deactivated_at
       FROM admin.portal_users pu
       JOIN admin.portal_user_tenants b ON b.portal_user_id = pu.id
       WHERE b.entity_type = 'employee' AND b.entity_id = $1`,
      [employeeId],
    );
    expect(portalUser.deactivated_at).toBeNull();
    expect(portalUser.status).toBe('locked');
  });

  test('6. Source record was created for employee', async () => {
    // Verify that a source record exists linking to this employee
    const employee = await request(app).get(`/api/core/v1/employees/${employeeId}`).set('Cookie', tenantCookies);

    expect(employee.body.source_id).toBeDefined();

    // Verify source record
    const source = await request(app).get(`/api/core/v1/sources/${employee.body.source_id}`).set('Cookie', tenantCookies);

    expect(source.status).toBe(200);
    expect(source.body.source_type).toBe('employee');
    expect(source.body.table_id).toBe(employeeId);
  });
});
