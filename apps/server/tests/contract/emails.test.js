/**
 * @file Contract tests for email CRUD endpoints
 * @module tests/contract/emails
 *
 * Covers: single is_login enforcement, blocking unset/archive of login email
 * while is_app_user, and login-email sync to admin.portal_users for
 * employee, client, and vendor_contact source types. The sync suite asserts
 * directly against admin.portal_users via the test DB handle.
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { bootstrapAdmin, cleanupTestDb, DB } from '../helpers/testDb.js';

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
      tenant_code: 'EMTEST',
      company: 'Email Test Corp',
      status: 'active',
      tier: 'starter',
      admin_first_name: 'Test',
      admin_last_name: 'Admin',
      admin_email: 'admin@emtest.com',
      admin_password: 'EmtestPass123!',
      billing_address: { address_line_1: '1 Test St', country_code: 'US' },
    });
}

describe('Email CRUD — /api/core/v1/emails', () => {
  let cookies;
  let employeeSourceId;
  let emailId;

  beforeAll(async () => {
    const rootCookies = await loginRoot();
    await provisionTenant(rootCookies);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@emtest.com', password: 'EmtestPass123!' });
    cookies = loginRes.headers['set-cookie'];

    // Create an employee to get a source_id
    const empRes = await request(app)
      .post('/api/core/v1/employees')
      .set('Cookie', cookies)
      .send({ first_name: 'Email', last_name: 'Tester', email: 'tester@emtest.com' });
    employeeSourceId = empRes.body.source_id;
  }, 30000);

  test('creates an email linked to a source', async () => {
    const res = await request(app)
      .post('/api/core/v1/emails')
      .set('Cookie', cookies)
      .send({ source_id: employeeSourceId, email: 'work@emtest.com', label: 'work', is_primary: false });

    expect(res.status).toBe(201);
    expect(res.body.email).toBe('work@emtest.com');
    expect(res.body.source_id).toBe(employeeSourceId);
    emailId = res.body.id;
  });

  test('lists emails by source_id', async () => {
    const res = await request(app)
      .get(`/api/core/v1/emails?source_id=${employeeSourceId}`)
      .set('Cookie', cookies);
    expect(res.status).toBe(200);
    const rows = res.body.rows ?? res.body;
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  test('updates an email', async () => {
    const res = await request(app)
      .put(`/api/core/v1/emails/update?id=${emailId}`)
      .set('Cookie', cookies)
      .send({ email: 'updated@emtest.com' });
    expect(res.status).toBe(200);
    expect(res.body.updatedRecords).toBe(1);
  });

  test('enforces single is_login per source — rejects second login email', async () => {
    // Create first login email
    const first = await request(app)
      .post('/api/core/v1/emails')
      .set('Cookie', cookies)
      .send({ source_id: employeeSourceId, email: 'first-login@emtest.com', label: 'login', is_login: true });
    expect(first.status).toBe(201);

    // Try to create another is_login email — should be rejected
    const res = await request(app)
      .post('/api/core/v1/emails')
      .set('Cookie', cookies)
      .send({ source_id: employeeSourceId, email: 'second-login@emtest.com', label: 'work', is_login: true });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/login/i);
  });

  test('blocks unsetting is_login while employee is an active app user', async () => {
    // Enable app user on the employee
    // First find the employee
    const empList = await request(app).get('/api/core/v1/employees').set('Cookie', cookies);
    const emp = (empList.body.rows ?? empList.body).find((e) => e.first_name === 'Email');

    // Enable app user with roles
    await request(app)
      .put(`/api/core/v1/employees/update?id=${emp.id}`)
      .set('Cookie', cookies)
      .send({ is_app_user: true, roles: ['admin'], password: 'TestPass123!' });

    // Find the login email
    const emailsList = await request(app)
      .get(`/api/core/v1/emails?source_id=${employeeSourceId}`)
      .set('Cookie', cookies);
    const loginEmail = (emailsList.body.rows ?? emailsList.body).find((e) => e.is_login);

    if (loginEmail) {
      // Try to unset is_login — should be blocked
      const res = await request(app)
        .put(`/api/core/v1/emails/update?id=${loginEmail.id}`)
        .set('Cookie', cookies)
        .send({ is_login: false });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/app user/i);
    }
  });

  test('blocks archiving login email while employee is an active app user', async () => {
    const emailsList = await request(app)
      .get(`/api/core/v1/emails?source_id=${employeeSourceId}`)
      .set('Cookie', cookies);
    const loginEmail = (emailsList.body.rows ?? emailsList.body).find((e) => e.is_login);

    if (loginEmail) {
      const res = await request(app)
        .delete(`/api/core/v1/emails/archive?id=${loginEmail.id}`)
        .set('Cookie', cookies)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/app user/i);
    }
  });

  test('enforces single is_primary — creating a new primary demotes the previous one', async () => {
    // Create first primary email
    const first = await request(app)
      .post('/api/core/v1/emails')
      .set('Cookie', cookies)
      .send({ source_id: employeeSourceId, email: 'primary-a@emtest.com', label: 'work', is_primary: true });
    expect(first.status).toBe(201);
    expect(first.body.is_primary).toBe(true);

    // Create second primary email — should succeed and demote the first
    const second = await request(app)
      .post('/api/core/v1/emails')
      .set('Cookie', cookies)
      .send({ source_id: employeeSourceId, email: 'primary-b@emtest.com', label: 'personal', is_primary: true });
    expect(second.status).toBe(201);
    expect(second.body.is_primary).toBe(true);

    // Verify only one active primary remains
    const list = await request(app)
      .get(`/api/core/v1/emails?source_id=${employeeSourceId}`)
      .set('Cookie', cookies);
    const rows = list.body.rows ?? list.body;
    const primaries = rows.filter((e) => e.is_primary);
    expect(primaries.length).toBe(1);
    expect(primaries[0].email).toBe('primary-b@emtest.com');
  });

  test('enforces single is_primary — updating to primary demotes the previous one', async () => {
    // Find a non-primary email to promote
    const list = await request(app)
      .get(`/api/core/v1/emails?source_id=${employeeSourceId}`)
      .set('Cookie', cookies);
    const rows = list.body.rows ?? list.body;
    const nonPrimary = rows.find((e) => !e.is_primary && !e.is_login);

    if (nonPrimary) {
      const res = await request(app)
        .put(`/api/core/v1/emails/update?id=${nonPrimary.id}`)
        .set('Cookie', cookies)
        .send({ is_primary: true });
      expect(res.status).toBe(200);

      // Verify only one active primary remains
      const updated = await request(app)
        .get(`/api/core/v1/emails?source_id=${employeeSourceId}`)
        .set('Cookie', cookies);
      const updatedRows = updated.body.rows ?? updated.body;
      const primaries = updatedRows.filter((e) => e.is_primary);
      expect(primaries.length).toBe(1);
      expect(primaries[0].id).toBe(nonPrimary.id);
    }
  });

  test('archives a non-login email', async () => {
    const res = await request(app)
      .delete(`/api/core/v1/emails/archive?id=${emailId}`)
      .set('Cookie', cookies)
      .send({});
    expect(res.status).toBe(200);
  });
});

describe('Login email sync — client and vendor_contact source types', () => {
  let cookies;

  beforeAll(async () => {
    let loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@emtest.com', password: 'EmtestPass123!' });

    if (!loginRes.headers['set-cookie']?.length) {
      const rootCookies = await loginRoot();
      await provisionTenant(rootCookies);
      loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@emtest.com', password: 'EmtestPass123!' });
    }

    cookies = loginRes.headers['set-cookie'];
  }, 30000);

  test('client app-user creation syncs login email to admin.portal_users', async () => {
    const res = await request(app)
      .post('/api/core/v1/clients')
      .set('Cookie', cookies)
      .send({
        name: 'Sync Client Co',
        email: 'client-login@emtest.com',
        is_app_user: true,
        roles: ['client'],
        password: 'ClientPass123!',
      });
    expect(res.status).toBe(201);

    const portal = await DB.db.oneOrNone(
      `SELECT pu.email FROM admin.portal_users pu JOIN admin.portal_user_tenants b ON b.portal_user_id = pu.id WHERE b.entity_type = 'client' AND b.entity_id = $1 AND b.deactivated_at IS NULL AND pu.deactivated_at IS NULL`,
      [res.body.id],
    );
    expect(portal?.email).toBe('client-login@emtest.com');

    // Updating the login email should cascade
    const emailsList = await request(app)
      .get(`/api/core/v1/emails?source_id=${res.body.source_id}`)
      .set('Cookie', cookies);
    const loginEmail = (emailsList.body.rows ?? emailsList.body).find((e) => e.is_login);
    expect(loginEmail).toBeTruthy();

    const updateRes = await request(app)
      .put(`/api/core/v1/emails/update?id=${loginEmail.id}`)
      .set('Cookie', cookies)
      .send({ email: 'client-login-updated@emtest.com' });
    expect(updateRes.status).toBe(200);

    const portalAfter = await DB.db.oneOrNone(
      `SELECT pu.email FROM admin.portal_users pu JOIN admin.portal_user_tenants b ON b.portal_user_id = pu.id WHERE b.entity_type = 'client' AND b.entity_id = $1 AND b.deactivated_at IS NULL AND pu.deactivated_at IS NULL`,
      [res.body.id],
    );
    expect(portalAfter?.email).toBe('client-login-updated@emtest.com');

    // Unsetting is_login should be blocked while is_app_user
    const unset = await request(app)
      .put(`/api/core/v1/emails/update?id=${loginEmail.id}`)
      .set('Cookie', cookies)
      .send({ is_login: false });
    expect(unset.status).toBe(400);
    expect(unset.body.error).toMatch(/app user/i);
  });

  test('vendor_contact app-user creation syncs login email to admin.portal_users', async () => {
    const vendorRes = await request(app)
      .post('/api/core/v1/vendors')
      .set('Cookie', cookies)
      .send({ name: 'Sync Vendor Co' });
    expect(vendorRes.status).toBe(201);

    const res = await request(app)
      .post('/api/core/v1/vendor-contacts')
      .set('Cookie', cookies)
      .send({
        vendor_id: vendorRes.body.id,
        first_name: 'VC',
        last_name: 'Login',
        email: 'vc-login@emtest.com',
        is_app_user: true,
        roles: ['vendor'],
        password: 'VcPass123!',
      });
    expect(res.status).toBe(201);

    const portal = await DB.db.oneOrNone(
      `SELECT pu.email FROM admin.portal_users pu JOIN admin.portal_user_tenants b ON b.portal_user_id = pu.id WHERE b.entity_type = 'vendor_contact' AND b.entity_id = $1 AND b.deactivated_at IS NULL AND pu.deactivated_at IS NULL`,
      [res.body.id],
    );
    expect(portal?.email).toBe('vc-login@emtest.com');

    const emailsList = await request(app)
      .get(`/api/core/v1/emails?source_id=${res.body.source_id}`)
      .set('Cookie', cookies);
    const loginEmail = (emailsList.body.rows ?? emailsList.body).find((e) => e.is_login);
    expect(loginEmail).toBeTruthy();

    const unset = await request(app)
      .put(`/api/core/v1/emails/update?id=${loginEmail.id}`)
      .set('Cookie', cookies)
      .send({ is_login: false });
    expect(unset.status).toBe(400);
    expect(unset.body.error).toMatch(/app user/i);
  });
});
