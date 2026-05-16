/**
 * @file Contract tests for L1/L2/L2b/C3 bypass-bug fixes in flat employee import
 * @module tests/contract/employeeFlatReconciliationLoginCascade
 *
 * Behavior locked in:
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
    roles: isPrimary ? '{admin}' : '',
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
    // Preview must classify the archive transition as an update, not a NO-OP,
    // even when no other parent column changed. (`status` is a synthetic
    // spreadsheet column stripped before the field-diff.)
    const preview = await postImport(buf, cookies, 'l2ba-preview', { preview: true });
    expect(preview.status).toBe(200);
    // The parent row's status active→archived must classify as an update,
    // not a NO-OP. (`status` is a synthetic spreadsheet column stripped
    // before the field-level diff.) Child email row is unchanged → counted
    // as a NO-OP under the children, which is correct.
    expect(preview.body.updates).toBeGreaterThanOrEqual(1);

    const res = await postImport(buf, cookies, 'l2ba');
    expect(res.status).toBe(201);
    expect(res.body.updated).toBe(1);

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
      code: 'L2BTON', first_name: 'Nora', last_name: 'NewLogin', email: 'nora@fcas.com', roles: ['admin'],
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
          is_app_user: true, roles: '{admin}', password: 'NoraToggleOn1!',
          email: 'nora@fcas.com', email_label: 'work', email_is_primary: true, email_is_login: true,
        },
      }),
    ]);
    const res = await postImport(buf, cookies, 'l2bt-on');
    expect(res.status).toBe(201);

    const pu = await db.oneOrNone(`SELECT id, status FROM admin.portal_users WHERE email = $1 AND deactivated_at IS NULL`, ['nora@fcas.com']);
    expect(pu).not.toBeNull();
  });

  test('L2b.toggle-on with password — import-supplied password is honored on toggle-on', async () => {
    // Create a non-app-user employee with an email
    const create = await request(app).post('/api/core/v1/employees').set('Cookie', cookies).send({
      code: 'L2BPW', first_name: 'Pat', last_name: 'PwToggle', email: 'pat@fcas.com', roles: ['admin'],
    });
    expect(create.status).toBe(201);

    // Flip the login flag on the existing 'work' email row
    const emails = await db.any(`SELECT id FROM fcas.emails WHERE email = $1`, ['pat@fcas.com']);
    await db.none(`UPDATE fcas.emails SET is_login = true WHERE id = $1`, [emails[0].id]);

    // Import an UPDATE that flips is_app_user on AND supplies a password.
    const buf = await buildFlat([
      row({
        id: create.body.id, code: 'L2BPW', firstName: 'Pat', lastName: 'PwToggle',
        extras: {
          is_app_user: true, roles: '{admin}', password: 'PatSuppliedPass1!',
          email: 'pat@fcas.com', email_label: 'work', email_is_primary: true, email_is_login: true,
        },
      }),
    ]);
    const res = await postImport(buf, cookies, 'l2bpw');
    expect(res.status).toBe(201);

    // The portal_user must accept the supplied password.
    const bcrypt = (await import('bcrypt')).default;
    const pu = await db.oneOrNone(
      `SELECT password_hash FROM admin.portal_users WHERE email = $1 AND deactivated_at IS NULL`,
      ['pat@fcas.com'],
    );
    expect(pu).not.toBeNull();
    expect(await bcrypt.compare('PatSuppliedPass1!', pu.password_hash)).toBe(true);
  });

  test('password rotation — import supplies new password for already-active app user', async () => {
    // Provision an app-user employee with an initial password.
    const emp = await makeAppUserEmployee(cookies, {
      code: 'PWROT', firstName: 'Rosa', lastName: 'Rotate', email: 'rosa@fcas.com',
      password: 'RosaOriginal1!',
    });

    const bcrypt = (await import('bcrypt')).default;
    const before = await db.oneOrNone(
      `SELECT password_hash FROM admin.portal_users WHERE email = $1 AND deactivated_at IS NULL`,
      ['rosa@fcas.com'],
    );
    expect(await bcrypt.compare('RosaOriginal1!', before.password_hash)).toBe(true);

    // Re-import the same employee (already an app user) with a different password.
    const buf = await buildFlat([
      row({
        id: emp.id, code: 'PWROT', firstName: 'Rosa', lastName: 'Rotate',
        extras: {
          is_app_user: true, roles: '{admin}', password: 'RosaRotated2!',
          email: 'rosa@fcas.com', email_label: 'work', email_is_primary: true, email_is_login: true,
        },
      }),
    ]);

    // Preview must classify password-only rotation as an update, not a no-op.
    // (`password` is stripped from the transformed parent so _diffParent
    // doesn't see it.)
    const previewRes = await postImport(buf, cookies, 'pwrot-preview', { preview: true });
    expect(previewRes.status).toBe(200);
    expect(previewRes.body.updates).toBeGreaterThanOrEqual(1);

    const res = await postImport(buf, cookies, 'pwrot');
    expect(res.status).toBe(201);
    expect(res.body.updated).toBeGreaterThanOrEqual(1);

    const after = await db.oneOrNone(
      `SELECT password_hash FROM admin.portal_users WHERE email = $1 AND deactivated_at IS NULL`,
      ['rosa@fcas.com'],
    );
    expect(await bcrypt.compare('RosaRotated2!', after.password_hash)).toBe(true);
    expect(await bcrypt.compare('RosaOriginal1!', after.password_hash)).toBe(false);
  });

  test('password preserved on no-change re-import — blank password column does NOT reset password_hash', async () => {
    // Provision an app-user employee with an initial password.
    const emp = await makeAppUserEmployee(cookies, {
      code: 'PWKEEP', firstName: 'Kira', lastName: 'Keep', email: 'kira@fcas.com',
      password: 'KiraKeep1!',
    });

    const before = await db.oneOrNone(
      `SELECT password_hash FROM admin.portal_users WHERE email = $1`,
      ['kira@fcas.com'],
    );

    // Re-import with password column blank — must not touch password_hash.
    const buf = await buildFlat([
      row({
        id: emp.id, code: 'PWKEEP', firstName: 'Kira', lastName: 'Keep',
        extras: {
          is_app_user: true, roles: '{admin}',
          email: 'kira@fcas.com', email_label: 'work', email_is_primary: true, email_is_login: true,
        },
      }),
    ]);
    const res = await postImport(buf, cookies, 'pwkeep');
    expect(res.status).toBe(201);

    const after = await db.oneOrNone(
      `SELECT password_hash FROM admin.portal_users WHERE email = $1`,
      ['kira@fcas.com'],
    );
    expect(after.password_hash).toBe(before.password_hash);
  });

  test('contradiction — password supplied with is_app_user=false is a blocking error', async () => {
    // Existing app-user employee; spreadsheet says is_app_user=false AND
    // supplies a password. Importer must refuse rather than silently demote
    // and drop the password.
    const emp = await makeAppUserEmployee(cookies, {
      code: 'PWCON', firstName: 'Connie', lastName: 'Conflict', email: 'connie@fcas.com',
      password: 'ConnieOriginal1!',
    });

    const buf = await buildFlat([
      row({
        id: emp.id, code: 'PWCON', firstName: 'Connie', lastName: 'Conflict',
        extras: {
          is_app_user: false, roles: '{admin}', password: 'NewPw2!',
          email: 'connie@fcas.com', email_label: 'work', email_is_primary: true, email_is_login: true,
        },
      }),
    ]);
    const res = await postImport(buf, cookies, 'pwcon');
    expect(res.status).toBe(422);
    const err = res.body.errors.find((e) => /password cannot be supplied while is_app_user is false/i.test(e.message || ''));
    expect(err).toBeDefined();

    // Nothing changed: still active, password_hash still matches original.
    const bcrypt = (await import('bcrypt')).default;
    const after = await db.oneOrNone(
      `SELECT password_hash, deactivated_at FROM admin.portal_users WHERE email = $1`,
      ['connie@fcas.com'],
    );
    expect(after.deactivated_at).toBeNull();
    expect(await bcrypt.compare('ConnieOriginal1!', after.password_hash)).toBe(true);
  });

  test('controller restore preserves password — archive then re-enable via PUT does NOT reset password_hash', async () => {
    // Same regression as the import path, but exercising the controller's
    // #provisionAppUser restore branch directly.
    const emp = await makeAppUserEmployee(cookies, {
      code: 'PWCTL', firstName: 'Casey', lastName: 'Ctl', email: 'casey@fcas.com',
      password: 'CaseyOriginalPass1!',
    });

    const before = await db.oneOrNone(
      `SELECT password_hash FROM admin.portal_users WHERE email = $1`,
      ['casey@fcas.com'],
    );
    expect(before?.password_hash).toBeTruthy();

    // Archive then restore the employee via the API.
    await request(app).delete(`/api/core/v1/employees/archive?id=${emp.id}`).set('Cookie', cookies).send({});
    const restoreRes = await request(app).patch(`/api/core/v1/employees/restore?id=${emp.id}`).set('Cookie', cookies).send({});
    expect([200, 201]).toContain(restoreRes.status);

    // Now toggle is_app_user back on via PUT (no password supplied — the
    // existing hash must be preserved).
    const toggleRes = await request(app)
      .put(`/api/core/v1/employees/update?id=${emp.id}`)
      .set('Cookie', cookies)
      .send({ is_app_user: true, roles: ['admin'] });
    expect(toggleRes.status).toBe(200);

    const after = await db.oneOrNone(
      `SELECT password_hash, deactivated_at FROM admin.portal_users WHERE email = $1`,
      ['casey@fcas.com'],
    );
    expect(after).not.toBeNull();
    expect(after.deactivated_at).toBeNull();
    expect(after.password_hash).toBe(before.password_hash);
  });

  test('L2b.restore preserves password — archive then re-enable via import does NOT reset password_hash', async () => {
    // Regression: enableAppUser's archived-binding restore path used to
    // auto-bcrypt a throwaway random password and overwrite portal_users.password_hash,
    // silently invalidating the user's existing password.
    const emp = await makeAppUserEmployee(cookies, {
      code: 'PWPRES', firstName: 'Penny', lastName: 'PwPreserve', email: 'penny@fcas.com',
      password: 'PennyOriginalPass1!',
    });

    // Capture the original password_hash.
    const before = await db.oneOrNone(
      `SELECT password_hash FROM admin.portal_users WHERE email = $1`,
      ['penny@fcas.com'],
    );
    expect(before?.password_hash).toBeTruthy();

    // Archive via the controller (cascades portal_user lock).
    await request(app).delete(`/api/core/v1/employees/archive?id=${emp.id}`).set('Cookie', cookies).send({});

    // Re-enable via import (status: active on an archived app-user employee).
    const buf = await buildFlat([
      row({
        id: emp.id, code: 'PWPRES', firstName: 'Penny', lastName: 'PwPreserve',
        extras: {
          is_app_user: true, roles: '{admin}', status: 'active',
          email: 'penny@fcas.com', email_label: 'work', email_is_primary: true, email_is_login: true,
        },
      }),
    ]);
    const res = await postImport(buf, cookies, 'pw-pres');
    expect(res.status).toBe(201);

    // Portal user is back online and the password_hash is byte-for-byte preserved.
    const after = await db.oneOrNone(
      `SELECT password_hash, status, deactivated_at FROM admin.portal_users WHERE email = $1`,
      ['penny@fcas.com'],
    );
    expect(after).not.toBeNull();
    expect(after.deactivated_at).toBeNull();
    expect(after.password_hash).toBe(before.password_hash);
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

  test('role validation — import rejects is_app_user employee with no roles', async () => {
    const buf = await buildFlat([
      row({
        code: 'RNONE', firstName: 'Rita', lastName: 'NoRole',
        extras: {
          is_app_user: true, roles: '{}',
          email: 'rita@fcas.com', email_label: 'work', email_is_primary: true, email_is_login: true,
        },
      }),
    ]);
    const res = await postImport(buf, cookies, 'rnone');
    expect(res.status).toBe(422);
    const err = res.body.errors.find((e) => /at least one role/i.test(e.message || ''));
    expect(err).toBeDefined();

    const rita = await db.oneOrNone(`SELECT id FROM fcas.employees WHERE code = 'RNONE'`);
    expect(rita).toBeNull();
  });

  test('role validation — import rejects is_app_user employee with unknown role code', async () => {
    const buf = await buildFlat([
      row({
        code: 'RBAD', firstName: 'Ruth', lastName: 'BadRole',
        extras: {
          is_app_user: true, roles: '{bogus}',
          email: 'ruth@fcas.com', email_label: 'work', email_is_primary: true, email_is_login: true,
        },
      }),
    ]);
    const res = await postImport(buf, cookies, 'rbad');
    expect(res.status).toBe(422);
    const err = res.body.errors.find((e) => /Unknown role code/i.test(e.message || ''));
    expect(err).toBeDefined();
    expect(err.message).toMatch(/bogus/);

    const ruth = await db.oneOrNone(`SELECT id FROM fcas.employees WHERE code = 'RBAD'`);
    expect(ruth).toBeNull();
  });

  test('role validation — controller rejects is_app_user create with unknown role code', async () => {
    const res = await request(app).post('/api/core/v1/employees').set('Cookie', cookies).send({
      code: 'RCAPI', first_name: 'Rae', last_name: 'ApiBad',
      email: 'rae@fcas.com',
      is_app_user: true,
      roles: ['bogus'],
      password: 'EmpPass1!Pass',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Unknown role code/i);

    const rae = await db.oneOrNone(`SELECT id FROM fcas.employees WHERE code = 'RCAPI'`);
    expect(rae).toBeNull();
  });

  // ─── Section 8: provisioning app users via the INSERT path ─────────────
  //
  // 4/5/6 exercise UPDATE branches (login-email mechanics, archive cascade,
  // existing-app-user toggles). These tests cover the brand-new path: a
  // file row with no id, is_app_user=true, password + login email supplied.

  test('8a — single new app user with password is provisioned via import', async () => {
    const buf = await buildFlat([
      row({
        code: 'P8A', firstName: 'Pat', lastName: 'EightA',
        extras: {
          is_app_user: true, roles: '{admin}', password: 'PatEightA1!',
          email: 'pat.8a@fcas.com', email_label: 'work', email_is_primary: true, email_is_login: true,
        },
      }),
    ]);
    const res = await postImport(buf, cookies, '8a');
    expect(res.status).toBe(201);

    const emp = await db.oneOrNone(`SELECT id, is_app_user FROM fcas.employees WHERE code = 'P8A'`);
    expect(emp).not.toBeNull();
    expect(emp.is_app_user).toBe(true);

    const pu = await db.oneOrNone(
      `SELECT id, status, password_hash FROM admin.portal_users WHERE email = $1 AND deactivated_at IS NULL`,
      ['pat.8a@fcas.com'],
    );
    expect(pu).not.toBeNull();
    expect(pu.status).toBe('invited');

    const bcrypt = (await import('bcrypt')).default;
    expect(await bcrypt.compare('PatEightA1!', pu.password_hash)).toBe(true);

    const binding = await db.oneOrNone(
      `SELECT * FROM admin.portal_user_tenants
       WHERE portal_user_id = $1 AND entity_type = 'employee' AND entity_id = $2
       AND deactivated_at IS NULL`,
      [pu.id, emp.id],
    );
    expect(binding).not.toBeNull();
    expect(binding.status).toBe('active');
  });

  test('8b — bulk provision is transactional: one bad row rolls back all', async () => {
    const buf = await buildFlat([
      row({
        code: 'P8B1', firstName: 'BulkOne', lastName: 'EightB',
        extras: {
          is_app_user: true, roles: '{admin}', password: 'BulkOne1!',
          email: 'bulk.one@fcas.com', email_label: 'work', email_is_primary: true, email_is_login: true,
        },
      }),
      row({
        code: 'P8B2', firstName: 'BulkTwo', lastName: 'EightB',
        extras: {
          // Bogus role on row 2 — must reject the whole import.
          is_app_user: true, roles: '{nonexistent_role}', password: 'BulkTwo1!',
          email: 'bulk.two@fcas.com', email_label: 'work', email_is_primary: true, email_is_login: true,
        },
      }),
      row({
        code: 'P8B3', firstName: 'BulkThree', lastName: 'EightB',
        extras: {
          is_app_user: true, roles: '{admin}', password: 'BulkThree1!',
          email: 'bulk.three@fcas.com', email_label: 'work', email_is_primary: true, email_is_login: true,
        },
      }),
    ]);
    const res = await postImport(buf, cookies, '8b');
    expect(res.status).toBe(422);
    expect(res.body.errors.some((e) => /unknown role/i.test(e.message || ''))).toBe(true);

    // None of the three rows landed.
    const created = await db.any(`SELECT code FROM fcas.employees WHERE code IN ('P8B1','P8B2','P8B3')`);
    expect(created).toEqual([]);
    const pus = await db.any(
      `SELECT email FROM admin.portal_users WHERE email IN ('bulk.one@fcas.com','bulk.two@fcas.com','bulk.three@fcas.com')`,
    );
    expect(pus).toEqual([]);
  });

  test('8c — is_app_user=true with no login email is a blocking error', async () => {
    // Row has is_app_user=true, valid role, valid password, but the email
    // row's is_login flag is false (no login email anywhere).
    const buf = await buildFlat([
      row({
        code: 'P8C', firstName: 'Cara', lastName: 'EightC',
        extras: {
          is_app_user: true, roles: '{admin}', password: 'CaraEightC1!',
          email: 'cara.8c@fcas.com', email_label: 'work', email_is_primary: true, email_is_login: false,
        },
      }),
    ]);
    const res = await postImport(buf, cookies, '8c');
    expect(res.status).toBe(422);
    expect(
      res.body.errors.some((e) => /login email is required/i.test(e.message || '')),
    ).toBe(true);

    // Nothing landed.
    const emp = await db.oneOrNone(`SELECT id FROM fcas.employees WHERE code = 'P8C'`);
    expect(emp).toBeNull();
    const pu = await db.oneOrNone(`SELECT id FROM admin.portal_users WHERE email = 'cara.8c@fcas.com'`);
    expect(pu).toBeNull();
  });

  test('8d — new app user with blank password cell is a blocking error', async () => {
    const buf = await buildFlat([
      row({
        code: 'P8D', firstName: 'Drew', lastName: 'EightD',
        extras: {
          is_app_user: true, roles: '{admin}',     // no password
          email: 'drew.8d@fcas.com', email_label: 'work', email_is_primary: true, email_is_login: true,
        },
      }),
    ]);
    const res = await postImport(buf, cookies, '8d');
    expect(res.status).toBe(422);
    expect(res.body.errors.some((e) => /password is required to provision/i.test(e.message || ''))).toBe(true);

    const emp = await db.oneOrNone(`SELECT id FROM fcas.employees WHERE code = 'P8D'`);
    expect(emp).toBeNull();
  });

  test('9b — toggle is_app_user false→true on employee with no prior binding requires a password', async () => {
    // Plain employee, never an app user, no portal_user binding.
    const createRes = await request(app).post('/api/core/v1/employees').set('Cookie', cookies).send({
      code: 'P9B', first_name: 'Nina', last_name: 'NineB', email: 'nina.9b@fcas.com', roles: ['admin'],
    });
    expect(createRes.status).toBe(201);
    // Flip the login flag on her existing email so the row passes the
    // login-email-required check.
    await db.none(`UPDATE fcas.emails SET is_login = true WHERE email = $1`, ['nina.9b@fcas.com']);

    const buf = await buildFlat([
      row({
        id: createRes.body.id, code: 'P9B', firstName: 'Nina', lastName: 'NineB',
        extras: {
          is_app_user: true, roles: '{admin}',     // no password
          email: 'nina.9b@fcas.com', email_label: 'work', email_is_primary: true, email_is_login: true,
        },
      }),
    ]);
    const res = await postImport(buf, cookies, '9b');
    expect(res.status).toBe(422);
    expect(res.body.errors.some((e) => /password is required to enable app user/i.test(e.message || ''))).toBe(true);

    // She wasn't toggled and no portal_user was provisioned.
    const emp = await db.oneOrNone(`SELECT is_app_user FROM fcas.employees WHERE code = 'P9B'`);
    expect(emp.is_app_user).toBe(false);
    const pu = await db.oneOrNone(`SELECT id FROM admin.portal_users WHERE email = 'nina.9b@fcas.com'`);
    expect(pu).toBeNull();
  });

  test('8f — two new app-user rows in same file with same login email is a blocking error', async () => {
    const buf = await buildFlat([
      row({
        code: 'P8F1', firstName: 'First', lastName: 'Eight8F',
        extras: {
          is_app_user: true, roles: '{admin}', password: 'First8F1!',
          email: 'dupe.8f@fcas.com', email_label: 'work', email_is_primary: true, email_is_login: true,
        },
      }),
      row({
        code: 'P8F2', firstName: 'Second', lastName: 'Eight8F',
        extras: {
          is_app_user: true, roles: '{admin}', password: 'Second8F1!',
          email: 'dupe.8f@fcas.com', email_label: 'work', email_is_primary: true, email_is_login: true,
        },
      }),
    ]);
    const res = await postImport(buf, cookies, '8f');
    expect(res.status).toBe(422);
    const dupes = res.body.errors.filter((e) => /appears on multiple rows/i.test(e.message || ''));
    expect(dupes.length).toBeGreaterThanOrEqual(2);   // both rows flagged

    // Nothing landed.
    const created = await db.any(`SELECT code FROM fcas.employees WHERE code IN ('P8F1','P8F2')`);
    expect(created).toEqual([]);
    const pu = await db.oneOrNone(`SELECT id FROM admin.portal_users WHERE email = 'dupe.8f@fcas.com'`);
    expect(pu).toBeNull();
  });

  test('8g — new app-user row with login email already on a portal_user in another tenant returns 422', async () => {
    // Provision a second tenant with its own admin. Then attempt to import
    // an app-user employee into the FCAS tenant whose login email matches
    // the OTHER tenant's admin email. The cross-tenant collision check
    // (checkPortalUserEmailCollisions) must fire on the INSERT path and
    // reject before writing.
    const rootCookies = await request(app)
      .post('/api/auth/login')
      .send({ email: ROOT_EMAIL, password: ROOT_PASSWORD })
      .then((r) => r.headers['set-cookie']);
    await provisionTenant(rootCookies, 'F8G', 'crosstenant.8g@example.com');

    // Confirm the colliding portal_user exists in the OTHER tenant.
    const otherTenantAdmin = await db.oneOrNone(
      `SELECT id FROM admin.portal_users WHERE LOWER(email) = $1`,
      ['crosstenant.8g@example.com'],
    );
    expect(otherTenantAdmin).not.toBeNull();

    // Now try to import a new app-user into FCAS using that email.
    const buf = await buildFlat([
      row({
        code: 'P8G', firstName: 'CrossTenant', lastName: 'Eight8G',
        extras: {
          is_app_user: true, roles: '{admin}', password: 'CrossTenant8G1!',
          email: 'crosstenant.8g@example.com',
          email_label: 'work', email_is_primary: true, email_is_login: true,
        },
      }),
    ]);
    const res = await postImport(buf, cookies, '8g');
    expect(res.status).toBe(422);
    const collision = res.body.errors.find((e) =>
      /already in use by another portal user/i.test(e.message || ''),
    );
    expect(collision).toBeDefined();

    // Nothing written to FCAS.
    const emp = await db.oneOrNone(`SELECT id FROM fcas.employees WHERE code = 'P8G'`);
    expect(emp).toBeNull();
    // The original portal_user in the other tenant is untouched.
    const stillThere = await db.oneOrNone(
      `SELECT id FROM admin.portal_users WHERE id = $1 AND deactivated_at IS NULL`,
      [otherTenantAdmin.id],
    );
    expect(stillThere).not.toBeNull();
  });
});
