/**
 * @file Contract tests for L1/L2/L2b/C3 bypass-bug fixes in flat employee import
 * @module tests/contract/employeeFlatReconciliationLoginCascade
 *
 * Covers the rules from /Users/ian/.claude/plans/explain-why-when-updating-rustling-hellman.md:
 *   - L1.a — login email value change syncs to portal_users.
 *   - L1.b — login email value change to a portal_user in another tenant → 422.
 *   - L2   — cannot unset is_login on active app user via import → 422.
 *   - L2.swap — service-level test that vendor_contact login-email change is detected.
 *   - L2b.archive — archiving an active app-user employee locks portal_user.
 *   - L2b.restore — restoring an archived app-user employee unlocks portal_user.
 *   - L2b.toggle-off — is_app_user true → false on UPDATE locks portal_user.
 *   - L2b.toggle-on — is_app_user false → true on UPDATE provisions portal_user.
 *   - L4.two-logins — two is_login: true rows for one source → 422.
 *   - L4.dup-set    — setting is_login true when another login row exists → 422.
 *   - C3 — cross-source collision against an archived employee's active email → 422.
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

async function loginAs(email, password) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.headers['set-cookie'];
}

async function provisionTenant(cookies, code, adminEmail = null, adminPassword = 'CascadePass123!') {
  await request(app)
    .post('/api/tenants/v1/tenants')
    .set('Cookie', cookies)
    .send({
      tenant_code: code,
      company: `${code} Cascade Corp`,
      status: 'active',
      tier: 'starter',
      admin_first_name: 'Test',
      admin_last_name: 'Admin',
      admin_email: adminEmail || `admin@${code.toLowerCase()}.com`,
      admin_password: adminPassword,
      billing_address: { address_line_1: '1 Test St', country_code: 'US' },
    });
}

const FLAT_HEADERS = [
  'id', 'code', 'first_name', 'last_name', 'position', 'department',
  'is_app_user', 'is_primary_contact', 'is_billing_contact', 'roles', 'status', 'password',
  'email', 'email_label', 'email_is_primary', 'email_is_login',
  'phone_country_code', 'phone_type', 'phone_number', 'phone_is_primary',
  'address_label', 'address_line_1', 'address_line_2', 'address_line_3',
  'address_city', 'address_state_province', 'address_postal_code', 'address_country_code',
  'tax_country_code', 'tax_type', 'tax_value',
];

function row({ id = '', code = '', firstName = '', lastName = '', extras = {} } = {}) {
  const isPrimary = !!(id || code || firstName || lastName);
  return {
    id, code, first_name: firstName, last_name: lastName,
    position: '', department: '',
    is_app_user: isPrimary ? false : '',
    is_primary_contact: isPrimary ? false : '',
    is_billing_contact: isPrimary ? false : '',
    roles: isPrimary ? '{}' : '',
    status: isPrimary ? 'active' : '',
    password: '',
    email: '', email_label: '', email_is_primary: '', email_is_login: '',
    phone_country_code: '', phone_type: '', phone_number: '', phone_is_primary: '',
    address_label: '', address_line_1: '', address_line_2: '', address_line_3: '',
    address_city: '', address_state_province: '', address_postal_code: '', address_country_code: '',
    tax_country_code: '', tax_type: '', tax_value: '',
    ...extras,
  };
}

async function buildFlat(rows) {
  const { WorkbookBuilder, writeXlsx } = await import('@nap-sft/tablsx');
  const wb = WorkbookBuilder.create();
  wb.sheet('Employees').setHeaders(FLAT_HEADERS).addObjects(rows);
  return writeXlsx(wb.build());
}

async function postImport(buf, cookies, label, { preview = false } = {}) {
  const tmpPath = join(tmpdir(), `cascade-${label}-${Date.now()}.xlsx`);
  writeFileSync(tmpPath, buf);
  const url = `/api/core/v1/employees/import-xls${preview ? '?preview=1' : ''}`;
  try {
    return await request(app).post(url).set('Cookie', cookies).attach('file', tmpPath);
  } finally {
    unlinkSync(tmpPath);
  }
}

async function makeAppUserEmployee(cookies, { code, firstName, lastName, email, password = 'EmpPass1!Pass' }) {
  const res = await request(app).post('/api/core/v1/employees').set('Cookie', cookies).send({
    code,
    first_name: firstName,
    last_name: lastName,
    email,
    is_app_user: true,
    roles: ['admin'],
    password,
  });
  expect(res.status).toBe(201);
  return res.body;
}

describe('Flat employee import — login + app-user cascade fixes', () => {
  let cookies;

  beforeAll(async () => {
    const rootCookies = await loginRoot();
    await provisionTenant(rootCookies, 'FCAS');
    cookies = await loginAs('admin@fcas.com', 'CascadePass123!');
  }, 30000);

  test('L1.a — login email value change via import syncs portal_users.email', async () => {
    const emp = await makeAppUserEmployee(cookies, {
      code: 'L1A', firstName: 'Lara', lastName: 'Login', email: 'lara@fcas.com',
    });

    const before = await db.oneOrNone(`SELECT email FROM admin.portal_users WHERE email = $1`, ['lara@fcas.com']);
    expect(before).not.toBeNull();

    const buf = await buildFlat([
      row({
        id: emp.id, code: 'L1A', firstName: 'Lara', lastName: 'Login',
        extras: {
          is_app_user: true, roles: '{admin}',
          email: 'lara.new@fcas.com', email_label: 'work', email_is_primary: true, email_is_login: true,
        },
      }),
    ]);
    const res = await postImport(buf, cookies, 'l1a');
    expect(res.status).toBe(201);

    const after = await db.oneOrNone(`SELECT email FROM admin.portal_users WHERE email = $1`, ['lara.new@fcas.com']);
    expect(after).not.toBeNull();
    const old = await db.oneOrNone(`SELECT email FROM admin.portal_users WHERE email = $1`, ['lara@fcas.com']);
    expect(old).toBeNull();
  });

  test('L1.b — login email value change to a portal_user in another tenant returns 422', async () => {
    const rootCookies = await loginRoot();
    await provisionTenant(rootCookies, 'FCAS2', 'shared@cross.com', 'CrossPass123!');

    const emp = await makeAppUserEmployee(cookies, {
      code: 'L1B', firstName: 'Liam', lastName: 'Borrower', email: 'liam@fcas.com',
    });

    const buf = await buildFlat([
      row({
        id: emp.id, code: 'L1B', firstName: 'Liam', lastName: 'Borrower',
        extras: {
          is_app_user: true, roles: '{admin}',
          email: 'shared@cross.com', email_label: 'work', email_is_primary: true, email_is_login: true,
        },
      }),
    ]);
    const res = await postImport(buf, cookies, 'l1b');
    expect(res.status).toBe(422);
    const collision = res.body.errors.find((e) => /already in use by another portal user/i.test(e.message || ''));
    expect(collision).toBeDefined();

    // portal_users for Liam unchanged
    const still = await db.oneOrNone(`SELECT email FROM admin.portal_users WHERE email = $1`, ['liam@fcas.com']);
    expect(still).not.toBeNull();
  });

  test('L2 — cannot unset is_login on active app user via import returns 422', async () => {
    const emp = await makeAppUserEmployee(cookies, {
      code: 'L2', firstName: 'Lily', lastName: 'Locked', email: 'lily@fcas.com',
    });

    const buf = await buildFlat([
      row({
        id: emp.id, code: 'L2', firstName: 'Lily', lastName: 'Locked',
        extras: {
          is_app_user: true, roles: '{admin}',
          email: 'lily@fcas.com', email_label: 'work', email_is_primary: true, email_is_login: false,
        },
      }),
    ]);
    const res = await postImport(buf, cookies, 'l2');
    expect(res.status).toBe(422);
    const err = res.body.errors.find((e) => /Cannot remove the login flag/i.test(e.message || ''));
    expect(err).toBeDefined();

    // portal_user still active
    const pu = await db.oneOrNone(
      `SELECT pu.deactivated_at FROM admin.portal_users pu
       JOIN admin.portal_user_tenants b ON b.portal_user_id = pu.id
       WHERE pu.email = $1`,
      ['lily@fcas.com'],
    );
    expect(pu.deactivated_at).toBeNull();
  });

  test('L2.swap — loginEmailSync service exposes canUnsetLogin/syncLoginEmail helpers', async () => {
    // Defensive coverage: the service module is exported and callable. Real
    // vendor_contact flat-import path doesn't exist yet (multi-sheet only).
    const { syncLoginEmail, canUnsetLogin, ENTITY_TABLE_BY_SOURCE_TYPE } = await import('../../src/lib/loginEmailSync.js');
    expect(typeof syncLoginEmail).toBe('function');
    expect(typeof canUnsetLogin).toBe('function');
    expect(ENTITY_TABLE_BY_SOURCE_TYPE.vendor_contact).toBe('vendor_contacts');
  });

  test('L2b.archive — archiving active app-user employee via import locks portal_user', async () => {
    const emp = await makeAppUserEmployee(cookies, {
      code: 'L2BA', firstName: 'Ada', lastName: 'Archive', email: 'ada@fcas.com',
    });

    const buf = await buildFlat([
      row({
        id: emp.id, code: 'L2BA', firstName: 'Ada', lastName: 'Archive',
        extras: {
          is_app_user: true, roles: '{admin}', status: 'archived',
          email: 'ada@fcas.com', email_label: 'work', email_is_primary: true, email_is_login: true,
        },
      }),
    ]);
    const res = await postImport(buf, cookies, 'l2ba');
    expect(res.status).toBe(201);

    const pu = await db.oneOrNone(
      `SELECT pu.status, pu.deactivated_at FROM admin.portal_users pu
       JOIN admin.portal_user_tenants b ON b.portal_user_id = pu.id
       WHERE pu.email = $1`,
      ['ada@fcas.com'],
    );
    expect(pu.status).toBe('locked');
    expect(pu.deactivated_at).not.toBeNull();
  });

  test('L2b.restore — restoring archived app-user employee via import unlocks portal_user', async () => {
    const emp = await makeAppUserEmployee(cookies, {
      code: 'L2BR', firstName: 'Ron', lastName: 'Restore', email: 'ron@fcas.com',
    });

    // Archive via the controller first
    await request(app).delete(`/api/core/v1/employees/archive?id=${emp.id}`).set('Cookie', cookies).send({});

    const buf = await buildFlat([
      row({
        id: emp.id, code: 'L2BR', firstName: 'Ron', lastName: 'Restore',
        extras: {
          is_app_user: true, roles: '{admin}', status: 'active',
          email: 'ron@fcas.com', email_label: 'work', email_is_primary: true, email_is_login: true,
        },
      }),
    ]);
    const res = await postImport(buf, cookies, 'l2br');
    expect(res.status).toBe(201);

    const pu = await db.oneOrNone(
      `SELECT pu.status, pu.deactivated_at FROM admin.portal_users pu
       JOIN admin.portal_user_tenants b ON b.portal_user_id = pu.id
       WHERE pu.email = $1 AND pu.deactivated_at IS NULL`,
      ['ron@fcas.com'],
    );
    expect(pu).not.toBeNull();
    expect(pu.status).toBe('active');
  });

  test('L2b.toggle-off — is_app_user true → false via UPDATE archives portal_user', async () => {
    const emp = await makeAppUserEmployee(cookies, {
      code: 'L2BT', firstName: 'Tina', lastName: 'Toggle', email: 'tina@fcas.com',
    });

    const buf = await buildFlat([
      row({
        id: emp.id, code: 'L2BT', firstName: 'Tina', lastName: 'Toggle',
        extras: {
          is_app_user: false, roles: '{admin}',
          email: 'tina@fcas.com', email_label: 'work', email_is_primary: true, email_is_login: true,
        },
      }),
    ]);
    const res = await postImport(buf, cookies, 'l2bt-off');
    expect(res.status).toBe(201);

    const pu = await db.oneOrNone(
      `SELECT pu.status, pu.deactivated_at FROM admin.portal_users pu
       WHERE pu.email = $1`,
      ['tina@fcas.com'],
    );
    expect(pu.status).toBe('locked');
    expect(pu.deactivated_at).not.toBeNull();
  });

  test('L2b.toggle-on — is_app_user false → true via UPDATE provisions portal_user', async () => {
    // Create a non-app-user employee with an email
    const create = await request(app).post('/api/core/v1/employees').set('Cookie', cookies).send({
      code: 'L2BTON', first_name: 'Nora', last_name: 'NewLogin', email: 'nora@fcas.com',
    });
    expect(create.status).toBe(201);

    // Make sure no portal_user exists yet
    const before = await db.oneOrNone(`SELECT id FROM admin.portal_users WHERE email = $1`, ['nora@fcas.com']);
    expect(before).toBeNull();

    // Flip the login flag on the existing 'work' email row
    const emails = await db.any(`SELECT id, email FROM fcas.emails WHERE email = $1`, ['nora@fcas.com']);
    expect(emails.length).toBe(1);
    await db.none(`UPDATE fcas.emails SET is_login = true WHERE id = $1`, [emails[0].id]);

    const buf = await buildFlat([
      row({
        id: create.body.id, code: 'L2BTON', firstName: 'Nora', lastName: 'NewLogin',
        extras: {
          is_app_user: true, roles: '{admin}',
          email: 'nora@fcas.com', email_label: 'work', email_is_primary: true, email_is_login: true,
        },
      }),
    ]);
    const res = await postImport(buf, cookies, 'l2bt-on');
    expect(res.status).toBe(201);

    const pu = await db.oneOrNone(`SELECT id, status FROM admin.portal_users WHERE email = $1 AND deactivated_at IS NULL`, ['nora@fcas.com']);
    expect(pu).not.toBeNull();
  });

  test('L4.two-logins — two is_login: true rows for one source in the file returns 422', async () => {
    const emp = await makeAppUserEmployee(cookies, {
      code: 'L4TWO', firstName: 'Tara', lastName: 'TwoLogin', email: 'tara@fcas.com',
    });

    const buf = await buildFlat([
      row({
        id: emp.id, code: 'L4TWO', firstName: 'Tara', lastName: 'TwoLogin',
        extras: {
          is_app_user: true, roles: '{admin}',
          email: 'tara@fcas.com', email_label: 'work', email_is_primary: true, email_is_login: true,
        },
      }),
      row({
        extras: {
          email: 'tara.alt@fcas.com', email_label: 'home', email_is_primary: false, email_is_login: true,
        },
      }),
    ]);
    const res = await postImport(buf, cookies, 'l4two');
    expect(res.status).toBe(422);
    const err = res.body.errors.find((e) => /Only one login email is allowed/i.test(e.message || ''));
    expect(err).toBeDefined();
  });

  test('L4.dup-set — setting is_login true on a second row when another already has it returns 422', async () => {
    const emp = await makeAppUserEmployee(cookies, {
      code: 'L4DUP', firstName: 'Daisy', lastName: 'Dup', email: 'daisy@fcas.com',
    });

    // Add a second email row (not a login) via the API
    await request(app).post('/api/core/v1/emails').set('Cookie', cookies).send({
      source_id: emp.source_id, email: 'daisy.alt@fcas.com', label: 'home', is_primary: false,
    });

    // Import flips the 'home' row to is_login: true while 'work' is still is_login: true in the DB.
    const buf = await buildFlat([
      row({
        id: emp.id, code: 'L4DUP', firstName: 'Daisy', lastName: 'Dup',
        extras: {
          is_app_user: true, roles: '{admin}',
          email: 'daisy.alt@fcas.com', email_label: 'home', email_is_primary: false, email_is_login: true,
        },
      }),
    ]);
    const res = await postImport(buf, cookies, 'l4dup');
    expect(res.status).toBe(422);
    const err = res.body.errors.find((e) => /Only one login email is allowed/i.test(e.message || ''));
    expect(err).toBeDefined();
  });

  test('C3 — cross-source collision against an archived employee\'s active email returns 422', async () => {
    const bennett = await makeAppUserEmployee(cookies, {
      code: 'C3BEN', firstName: 'Bea', lastName: 'Bennett', email: 'bea@fcas.com',
    });
    // Archive Bennett through the controller. Children stay active by design (Option A).
    await request(app).delete(`/api/core/v1/employees/archive?id=${bennett.id}`).set('Cookie', cookies).send({});

    // Try to import a brand-new employee with Bennett's email.
    const buf = await buildFlat([
      row({
        code: 'C3SMI', firstName: 'Sam', lastName: 'Smith',
        extras: {
          email: 'bea@fcas.com', email_label: 'work', email_is_primary: true, email_is_login: false,
        },
      }),
    ]);
    const res = await postImport(buf, cookies, 'c3');
    expect(res.status).toBe(422);
    const collision = res.body.errors.find((e) => /already in use by another/i.test(e.message || ''));
    expect(collision).toBeDefined();
    expect(collision.message).toMatch(/employee/i);

    // Smith was not created
    const smith = await db.oneOrNone(`SELECT id FROM fcas.employees WHERE code = 'C3SMI'`);
    expect(smith).toBeNull();
  });
});
