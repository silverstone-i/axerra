/**
 * @file Contract tests for employee CRUD endpoints + is_app_user lifecycle
 * @module tests/contract/employees
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
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
      tenant_code: 'ETEST',
      company: 'Employee Test Corp',
      status: 'active',
      tier: 'starter',
      admin_first_name: 'Test',
      admin_last_name: 'Admin',
      admin_email: 'admin@etest.com',
      admin_password: 'EtestPass123!',
      billing_address: { address_line_1: '1 Test St', country_code: 'US' },
    });
}

describe('Employee CRUD — /api/core/v1/employees', () => {
  let cookies;
  let employeeId;

  beforeAll(async () => {
    const rootCookies = await loginRoot();
    await provisionTenant(rootCookies);

    const loginRes = await request(app).post('/api/auth/login').send({ email: 'admin@etest.com', password: 'EtestPass123!' });
    cookies = loginRes.headers['set-cookie'];
  }, 30000);

  test('creates an employee with auto-source linkage', async () => {
    const res = await request(app).post('/api/core/v1/employees').set('Cookie', cookies).send({
      first_name: 'Jane',
      last_name: 'Smith',
      code: 'JS001',
      position: 'Engineer',
      department: 'Engineering',
      email: 'jane@etest.com',
    });

    expect(res.status).toBe(201);
    expect(res.body.first_name).toBe('Jane');
    expect(res.body.source_id).toBeDefined();
    expect(res.body.is_app_user).toBe(false);
    employeeId = res.body.id;
  });

  test('lists employees', async () => {
    const res = await request(app).get('/api/core/v1/employees').set('Cookie', cookies);
    expect(res.status).toBe(200);
    const rows = res.body.rows ?? res.body;
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  test('gets employee by id', async () => {
    const res = await request(app).get(`/api/core/v1/employees/${employeeId}`).set('Cookie', cookies);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe('JS001');
  });

  test('creates employee with is_app_user=true provisions portal_user', async () => {
    const res = await request(app)
      .post('/api/core/v1/employees')
      .set('Cookie', cookies)
      .send({
        first_name: 'Bob',
        last_name: 'Johnson',
        code: 'BJ001',
        email: 'bob@etest.com',
        roles: ['admin'],
        is_app_user: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.is_app_user).toBe(true);

    // Verify portal_user + binding were created in admin schema
    const portalUser = await db.oneOrNone(
      `SELECT pu.id, pu.status FROM admin.portal_users pu
       JOIN admin.portal_user_tenants b ON b.portal_user_id = pu.id
       WHERE b.entity_type = 'employee' AND b.entity_id = $1`,
      [res.body.id],
    );
    expect(portalUser).not.toBeNull();
    expect(portalUser.status).toBe('invited');
  });

  test('toggling is_app_user OFF archives portal_user', async () => {
    // Find the app-user employee
    const listRes = await request(app).get('/api/core/v1/employees').set('Cookie', cookies);
    const rows = listRes.body.rows ?? listRes.body;
    const bob = rows.find((r) => r.code === 'BJ001');

    const res = await request(app).put(`/api/core/v1/employees/update?id=${bob.id}`).set('Cookie', cookies).send({ is_app_user: false });

    expect(res.status).toBe(200);

    // Verify portal_user + binding were archived
    const portalUser = await db.oneOrNone(
      `SELECT pu.status, pu.deactivated_at FROM admin.portal_users pu
       JOIN admin.portal_user_tenants b ON b.portal_user_id = pu.id
       WHERE b.entity_type = 'employee' AND b.entity_id = $1`,
      [bob.id],
    );
    expect(portalUser.status).toBe('locked');
    expect(portalUser.deactivated_at).not.toBeNull();
  });

  test('archives and restores an employee', async () => {
    const archiveRes = await request(app).delete(`/api/core/v1/employees/archive?id=${employeeId}`).set('Cookie', cookies).send({});
    expect(archiveRes.status).toBe(200);

    const restoreRes = await request(app).patch(`/api/core/v1/employees/restore?id=${employeeId}`).set('Cookie', cookies).send({});
    expect(restoreRes.status).toBe(200);
  });

  // ── Multi-sheet xlsx import: app-user provisioning sources email from the Emails child sheet ──
  // Regression test for issue #13: after email normalization the parent Employees sheet no longer
  // carries an `email` column; the login email must come from the Emails child sheet.
  async function buildEmployeeWorkbook({ ref, code, firstName, lastName, email }) {
    const { WorkbookBuilder, writeXlsx } = await import('@nap-sft/tablsx');
    const wb = WorkbookBuilder.create();

    wb.sheet('Employees')
      .setHeaders(['id', 'code', 'first_name', 'last_name', 'is_app_user', 'roles', 'status', 'password'])
      .addRow([ref, code, firstName, lastName, true, '{admin}', 'active', 'XlsImport123!']);

    const emailsSheet = wb.sheet('Emails').setHeaders(['employee_id', 'email', 'label', 'is_primary', 'is_login']);
    if (email) emailsSheet.addRow([ref, email, 'work', true, true]);

    wb.sheet('Phone Numbers').setHeaders(['employee_id', 'country_code', 'phone_type', 'phone_number', 'is_primary']);
    wb.sheet('Addresses').setHeaders([
      'employee_id', 'label', 'address_line_1', 'address_line_2', 'address_line_3',
      'city', 'state_province', 'postal_code', 'country_code',
    ]);
    wb.sheet('Tax Identifiers').setHeaders(['employee_id', 'country_code', 'tax_type', 'tax_value']);

    return writeXlsx(wb.build());
  }

  async function postImport(buf, label) {
    const tmpPath = join(tmpdir(), `employees-import-${label}-${Date.now()}.xlsx`);
    writeFileSync(tmpPath, buf);
    try {
      return await request(app).post('/api/core/v1/employees/import-xls').set('Cookie', cookies).attach('file', tmpPath);
    } finally {
      unlinkSync(tmpPath);
    }
  }

  test('multi-sheet import sources login email from Emails child sheet (issue #13)', async () => {
    const buf = await buildEmployeeWorkbook({
      ref: 'EMP-XLS-1', code: 'AA001', firstName: 'Alice', lastName: 'Anderson', email: 'alice@etest.com',
    });
    const res = await postImport(buf, 'with-email');

    expect(res.status).toBe(201);
    expect(res.body.inserted).toBe(1);
    expect(res.body.appUserSkipped).toBe(0);

    const employee = await db.oneOrNone(`SELECT id, is_app_user FROM etest.employees WHERE code = 'AA001'`);
    expect(employee).not.toBeNull();
    expect(employee.is_app_user).toBe(true);

    const portalUser = await db.oneOrNone(
      `SELECT pu.email, pu.status, b.entity_type, b.entity_id
       FROM admin.portal_users pu
       JOIN admin.portal_user_tenants b ON b.portal_user_id = pu.id
       WHERE pu.email = $1 AND pu.deactivated_at IS NULL`,
      ['alice@etest.com'],
    );
    expect(portalUser).not.toBeNull();
    expect(portalUser.entity_type).toBe('employee');
    expect(portalUser.entity_id).toBe(employee.id);
    expect(portalUser.status).toBe('invited');
  });

  test('multi-sheet import without an Emails row skips provisioning and disables is_app_user', async () => {
    const buf = await buildEmployeeWorkbook({
      ref: 'EMP-XLS-2', code: 'CC001', firstName: 'Carol', lastName: 'Carter', email: null,
    });
    const res = await postImport(buf, 'no-email');

    expect(res.status).toBe(201);
    expect(res.body.inserted).toBe(1);
    expect(res.body.appUserSkipped).toBe(1);

    const employee = await db.oneOrNone(`SELECT id, is_app_user FROM etest.employees WHERE code = 'CC001'`);
    expect(employee).not.toBeNull();
    expect(employee.is_app_user).toBe(false);

    const binding = await db.oneOrNone(
      `SELECT id FROM admin.portal_user_tenants WHERE entity_type = 'employee' AND entity_id = $1 AND deactivated_at IS NULL`,
      [employee.id],
    );
    expect(binding).toBeNull();
  });
});
