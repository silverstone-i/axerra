/**
 * @file Contract test for the cross-tenant portal_user collision check on
 * employee xlsx import (Task 10 — Part 2 of the import-dedup spec).
 *
 * Provisions a tenant and creates a portal_user with a known login email,
 * then runs an employee multi-sheet xlsx import in a second tenant where one
 * of the rows reuses the same login email. The import must come back with
 * a 422 and a row error mentioning the email collision.
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

let _db;
beforeAll(async () => {
  await cleanupTestDb();
  _db = await bootstrapAdmin();
}, 30000);

const { default: app } = await import('../../src/app.js');

afterAll(async () => {
  await cleanupTestDb();
}, 15000);

async function loginRoot() {
  const res = await request(app).post('/api/auth/login').send({ email: ROOT_EMAIL, password: ROOT_PASSWORD });
  return res.headers['set-cookie'];
}

async function provisionTenant(rootCookies, tenantCode, adminEmail, adminPassword) {
  await request(app)
    .post('/api/tenants/v1/tenants')
    .set('Cookie', rootCookies)
    .send({
      tenant_code: tenantCode,
      company: `${tenantCode} Corp`,
      status: 'active',
      tier: 'starter',
      admin_first_name: 'Test',
      admin_last_name: 'Admin',
      admin_email: adminEmail,
      admin_password: adminPassword,
      billing_address: { address_line_1: '1 Test St', country_code: 'US' },
    });
}

async function loginAs(email, password) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.headers['set-cookie'];
}

async function buildEmployeeWorkbook({ ref, code, firstName, lastName, email }) {
  const { WorkbookBuilder, writeXlsx } = await import('@nap-sft/tablsx');
  const wb = WorkbookBuilder.create();

  wb.sheet('Employees')
    .setHeaders(['id', 'code', 'first_name', 'last_name', 'is_app_user', 'roles', 'status', 'password'])
    .addRow([ref, code, firstName, lastName, true, '{admin}', 'active', 'XlsImport123!']);

  wb.sheet('Emails').setHeaders(['employee_id', 'email', 'label', 'is_primary', 'is_login']).addRow([ref, email, 'work', true, true]);

  wb.sheet('Phone Numbers').setHeaders(['employee_id', 'country_code', 'phone_type', 'phone_number', 'is_primary']);
  wb.sheet('Addresses').setHeaders([
    'employee_id', 'label', 'address_line_1', 'address_line_2', 'address_line_3',
    'city', 'state_province', 'postal_code', 'country_code',
  ]);
  wb.sheet('Tax Identifiers').setHeaders(['employee_id', 'country_code', 'tax_type', 'tax_value']);

  return writeXlsx(wb.build());
}

describe('Cross-tenant portal_user collision check on employee import', () => {
  test('aborts the row with a 422 when the login email already exists in admin.portal_users', async () => {
    const rootCookies = await loginRoot();

    // Tenant A — its admin user provisions a portal_user with the email we'll collide with
    await provisionTenant(rootCookies, 'XTNA', 'shared@xt.com', 'TenantAPass123!');

    // Tenant B — this is where we'll run the employee import
    await provisionTenant(rootCookies, 'XTNB', 'admin@xtnb.com', 'TenantBPass123!');
    const cookiesB = await loginAs('admin@xtnb.com', 'TenantBPass123!');

    const buf = await buildEmployeeWorkbook({
      ref: 'EMP-XT-1',
      code: 'XT001',
      firstName: 'Collide',
      lastName: 'User',
      email: 'shared@xt.com', // collides with Tenant A's admin portal_user
    });

    const tmpPath = join(tmpdir(), `employees-import-xt-${Date.now()}.xlsx`);
    writeFileSync(tmpPath, buf);
    let res;
    try {
      res = await request(app).post('/api/core/v1/employees/import-xls').set('Cookie', cookiesB).attach('file', tmpPath);
    } finally {
      unlinkSync(tmpPath);
    }

    expect(res.status).toBe(422);
    expect(Array.isArray(res.body.errors)).toBe(true);
    const collision = res.body.errors.find((e) => /already in use by another portal user/i.test(e.message || ''));
    expect(collision).toBeDefined();
    expect(String(collision.value).toLowerCase()).toBe('shared@xt.com');
  }, 30000);
});
