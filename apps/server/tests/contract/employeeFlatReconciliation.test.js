/**
 * @file Contract tests for flat-format employee import per-row reconciliation
 * @module tests/contract/employeeFlatReconciliation
 *
 * Behavior locked in:
 *   - No-change re-import preserves child ids (R3).
 *   - Editing one row's value updates in place; omitted rows are left alone (R4, R6).
 *   - Intra-file duplicate slot is a blocking error (R7).
 *   - Cross-source value collision is a blocking error with type-only context (R8).
 *   - Issue cap at 100 + sentinel (R9).
 *   - Mandatory preview returns counts and does not write (R10).
 *   - Preview errors block real import.
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

async function provisionTenant(cookies, code) {
  await request(app)
    .post('/api/tenants/v1/tenants')
    .set('Cookie', cookies)
    .send({
      tenant_code: code,
      company: `${code} Reconcile Corp`,
      status: 'active',
      tier: 'starter',
      admin_first_name: 'Test',
      admin_last_name: 'Admin',
      admin_email: `admin@${code.toLowerCase()}.com`,
      admin_password: 'ReconcilePass123!',
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

async function buildFlat(rows) {
  const { WorkbookBuilder, writeXlsx } = await import('@nap-sft/tablsx');
  const wb = WorkbookBuilder.create();
  wb.sheet('Employees').setHeaders(FLAT_HEADERS).addObjects(rows);
  return writeXlsx(wb.build());
}

async function postImport(buf, cookies, label, { preview = false } = {}) {
  const tmpPath = join(tmpdir(), `flat-${label}-${Date.now()}.xlsx`);
  writeFileSync(tmpPath, buf);
  const url = `/api/core/v1/employees/import-xls${preview ? '?preview=1' : ''}`;
  try {
    return await request(app).post(url).set('Cookie', cookies).attach('file', tmpPath);
  } finally {
    unlinkSync(tmpPath);
  }
}

function parentRow({ id = '', code = '', firstName = '', lastName = '', extras = {} } = {}) {
  // Continuation rows must have ALL parent cols blank so groupFlatRows() detects them.
  // Only the first row of a group should carry parent values.
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

describe('Flat employee import — per-row reconciliation', () => {
  let cookies;
  let employeeId;
  let homeEmailIdBefore;
  let personalEmailIdBefore;
  let employeeSourceId;

  beforeAll(async () => {
    const rootCookies = await loginRoot();
    await provisionTenant(rootCookies, 'FRECON');
    const loginRes = await request(app).post('/api/auth/login').send({ email: 'admin@frecon.com', password: 'ReconcilePass123!' });
    cookies = loginRes.headers['set-cookie'];
  }, 30000);

  test('initial import creates employee with two emails (distinct labels)', async () => {
    const buf = await buildFlat([
      parentRow({
        code: 'FR-001', firstName: 'Frank', lastName: 'Reconciler',
        extras: { email: 'frank.home@frecon.com', email_label: 'home', email_is_primary: true, email_is_login: false },
      }),
      parentRow({
        extras: { email: 'frank.personal@frecon.com', email_label: 'personal', email_is_primary: false, email_is_login: false },
      }),
    ]);
    const res = await postImport(buf, cookies, 'initial');
    expect(res.status).toBe(201);
    expect(res.body.inserted).toBe(1);

    const employee = await db.oneOrNone(`SELECT id, source_id FROM frecon.employees WHERE code = 'FR-001'`);
    expect(employee).not.toBeNull();
    employeeId = employee.id;
    employeeSourceId = employee.source_id;

    const emails = await db.any(
      `SELECT id, email, label FROM frecon.emails WHERE source_id = $1 AND deactivated_at IS NULL ORDER BY label`,
      [employeeSourceId],
    );
    expect(emails).toHaveLength(2);
    homeEmailIdBefore = emails.find((e) => e.label === 'home').id;
    personalEmailIdBefore = emails.find((e) => e.label === 'personal').id;
    expect(homeEmailIdBefore).toBeTruthy();
    expect(personalEmailIdBefore).toBeTruthy();
  });

  test('no-change re-import preserves child ids AND parent updated_at (R3)', async () => {
    // Snapshot parent + child updated_at before re-import.
    const employeeBefore = await db.oneOrNone(`SELECT id, updated_at FROM frecon.employees WHERE id = $1`, [employeeId]);
    const emailsBefore = await db.any(
      `SELECT id, label, updated_at FROM frecon.emails WHERE source_id = $1 AND deactivated_at IS NULL ORDER BY label`,
      [employeeSourceId],
    );

    const buf = await buildFlat([
      parentRow({
        id: employeeId, code: 'FR-001', firstName: 'Frank', lastName: 'Reconciler',
        extras: { email: 'frank.home@frecon.com', email_label: 'home', email_is_primary: true, email_is_login: false },
      }),
      parentRow({
        extras: { email: 'frank.personal@frecon.com', email_label: 'personal', email_is_primary: false, email_is_login: false },
      }),
    ]);
    const res = await postImport(buf, cookies, 'nochange');
    expect(res.status).toBe(201);
    // No-change re-import must report zero writes — the parent NO-OP detection
    // and the slot-keyed child reconciler should both produce zero updates.
    expect(res.body.inserted).toBe(0);
    expect(res.body.updated).toBe(0);

    // Child ids unchanged
    const active = await db.any(
      `SELECT id, label, updated_at FROM frecon.emails WHERE source_id = $1 AND deactivated_at IS NULL ORDER BY label`,
      [employeeSourceId],
    );
    expect(active.map((r) => r.id).sort()).toEqual([homeEmailIdBefore, personalEmailIdBefore].sort());

    // No soft-deletes
    const archived = await db.any(`SELECT id FROM frecon.emails WHERE source_id = $1 AND deactivated_at IS NOT NULL`, [employeeSourceId]);
    expect(archived).toHaveLength(0);

    // updated_at preserved on parent and every child row (no implicit writes)
    const employeeAfter = await db.oneOrNone(`SELECT updated_at FROM frecon.employees WHERE id = $1`, [employeeId]);
    expect(employeeAfter.updated_at.toISOString()).toBe(employeeBefore.updated_at.toISOString());

    const beforeByLabel = new Map(emailsBefore.map((r) => [r.label, r.updated_at.toISOString()]));
    for (const row of active) {
      expect(row.updated_at.toISOString()).toBe(beforeByLabel.get(row.label));
    }
  });

  test('edit one email + omit the other: updates in place, omitted row left alone (R4, R6)', async () => {
    const buf = await buildFlat([
      parentRow({
        id: employeeId, code: 'FR-001', firstName: 'Frank', lastName: 'Reconciler',
        extras: { email: 'frank.home-NEW@frecon.com', email_label: 'home', email_is_primary: true, email_is_login: false },
      }),
      // personal email row intentionally omitted
    ]);
    const res = await postImport(buf, cookies, 'edit-omit');
    expect(res.status).toBe(201);

    // home email: same id, new value, audit fields stamped to the importing user
    const home = await db.oneOrNone(
      `SELECT id, email, updated_by, updated_at, created_at FROM frecon.emails WHERE id = $1`,
      [homeEmailIdBefore],
    );
    expect(home).not.toBeNull();
    expect(home.email).toBe('frank.home-NEW@frecon.com');
    expect(home.updated_by).not.toBeNull();
    expect(home.updated_at.getTime()).toBeGreaterThan(home.created_at.getTime());

    // Parent: should also be stamped if anything changed. For this test no
    // parent column changed, so updated_by may stay null — only the child
    // assertion is meaningful here.

    // personal email: untouched, still active under its original id
    const personal = await db.oneOrNone(
      `SELECT id, email, deactivated_at FROM frecon.emails WHERE id = $1`,
      [personalEmailIdBefore],
    );
    expect(personal).not.toBeNull();
    expect(personal.email).toBe('frank.personal@frecon.com');
    expect(personal.deactivated_at).toBeNull();
  });


  test('intra-file duplicate slot is a blocking error (R7)', async () => {
    const buf = await buildFlat([
      parentRow({
        id: employeeId, code: 'FR-001', firstName: 'Frank', lastName: 'Reconciler',
        extras: { email: 'a@frecon.com', email_label: 'work', email_is_primary: false, email_is_login: false },
      }),
      parentRow({
        extras: { email: 'b@frecon.com', email_label: 'work', email_is_primary: false, email_is_login: false },
      }),
    ]);
    const res = await postImport(buf, cookies, 'dup-slot');
    expect(res.status).toBe(422);
    const dup = res.body.errors.find((e) => /Duplicate emails label/i.test(e.message || ''));
    expect(dup).toBeDefined();
  });

  test('cross-source email collision is a blocking error with type-only context (R8)', async () => {
    // Create a second employee owning a distinct email
    const create = await request(app).post('/api/core/v1/employees').set('Cookie', cookies).send({
      first_name: 'Gina', last_name: 'Garcia', code: 'FR-002', roles: ['admin'],
    });
    expect(create.status).toBe(201);
    const ginaSourceId = create.body.source_id;
    const addEmail = await request(app).post('/api/core/v1/emails').set('Cookie', cookies).send({
      source_id: ginaSourceId, email: 'shared@frecon.com', label: 'shared', is_primary: false,
    });
    expect(addEmail.status).toBe(201);

    // Now try to import Frank with the same email value under a different slot
    const buf = await buildFlat([
      parentRow({
        id: employeeId, code: 'FR-001', firstName: 'Frank', lastName: 'Reconciler',
        extras: { email: 'shared@frecon.com', email_label: 'office', email_is_primary: false, email_is_login: false },
      }),
    ]);
    const res = await postImport(buf, cookies, 'cross-source');
    expect(res.status).toBe(422);
    const collision = res.body.errors.find((e) => /already in use by another/i.test(e.message || ''));
    expect(collision).toBeDefined();
    expect(collision.message).toMatch(/employee/i);
    expect(String(collision.value).toLowerCase()).toBe('shared@frecon.com');

    // Frank's emails unchanged (home was edited in prior test; personal still original)
    const frank = await db.any(`SELECT email FROM frecon.emails WHERE source_id = $1 AND deactivated_at IS NULL ORDER BY email`, [employeeSourceId]);
    expect(frank.map((r) => r.email)).toEqual(['frank.home-NEW@frecon.com', 'frank.personal@frecon.com']);
  });

  test('issue cap at 100 with a sentinel entry (R9)', async () => {
    const rows = [];
    for (let i = 0; i < 150; i++) {
      const isFirst = i === 0;
      rows.push(parentRow({
        code: isFirst ? 'FR-CAP' : '',
        firstName: isFirst ? 'Cap' : '',
        lastName: isFirst ? 'Test' : '',
        extras: { email: 'not-an-email', email_label: `lbl-${i}`, email_is_primary: false, email_is_login: false },
      }));
    }
    const buf = await buildFlat(rows);
    const res = await postImport(buf, cookies, 'cap');
    expect(res.status).toBe(422);
    expect(res.body.errors.length).toBe(101);
    expect(res.body.errors[100].message).toMatch(/Issue limit reached \(100\)/);
  });

  test('mandatory preview returns counts and does not write (R10)', async () => {
    // Build a clean re-import for Frank with the values currently in the DB
    const buf = await buildFlat([
      parentRow({
        id: employeeId, code: 'FR-001', firstName: 'Frank', lastName: 'Reconciler',
        extras: { email: 'frank.home-NEW@frecon.com', email_label: 'home', email_is_primary: true, email_is_login: false },
      }),
      parentRow({
        extras: { email: 'frank.personal@frecon.com', email_label: 'personal', email_is_primary: false, email_is_login: false },
      }),
    ]);
    // Snapshot state before preview
    const before = await db.any(
      `SELECT id, email FROM frecon.emails WHERE source_id = $1 AND deactivated_at IS NULL ORDER BY id`,
      [employeeSourceId],
    );

    const res = await postImport(buf, cookies, 'preview', { preview: true });
    expect(res.status).toBe(200);
    expect(res.body.preview).toBe(true);
    expect(typeof res.body.inserts).toBe('number');
    expect(typeof res.body.updates).toBe('number');
    expect(typeof res.body.noops).toBe('number');
    expect(typeof res.body.omitted).toBe('number');
    expect(res.body.errors).toEqual([]);
    // Parent unchanged → NO-OP (not a forced "update"). Both child emails also NO-OP.
    expect(res.body.updates).toBe(0);
    expect(res.body.noops).toBe(3);
    expect(res.body.inserts).toBe(0);

    // State unchanged after preview
    const after = await db.any(
      `SELECT id, email FROM frecon.emails WHERE source_id = $1 AND deactivated_at IS NULL ORDER BY id`,
      [employeeSourceId],
    );
    expect(after).toEqual(before);
  });

  test('preview errors block real import (defensive)', async () => {
    const buf = await buildFlat([
      parentRow({
        id: employeeId, code: 'FR-001', firstName: 'Frank', lastName: 'Reconciler',
        extras: { email: 'a@frecon.com', email_label: 'work', email_is_primary: false, email_is_login: false },
      }),
      parentRow({
        extras: { email: 'b@frecon.com', email_label: 'work', email_is_primary: false, email_is_login: false },
      }),
    ]);

    const previewRes = await postImport(buf, cookies, 'preview-err', { preview: true });
    expect(previewRes.status).toBe(422);
    expect(previewRes.body.errors.length).toBeGreaterThan(0);

    const realRes = await postImport(buf, cookies, 'real-err');
    expect(realRes.status).toBe(422);
    expect(realRes.body.errors.length).toBeGreaterThan(0);
  });

  test('slot rename (label change with same email value) updates in place — no DB unique violation', async () => {
    // 2c regression: changing an email row's label while keeping the value
    // must update the existing row (label rename), not insert a duplicate.
    // Before the value-match fallback, the importer tried INSERT and crashed
    // with 23505 because (email) WHERE deactivated_at IS NULL is unique.

    // Build a clean baseline: Frank's home email value as it currently is.
    const home = await db.oneOrNone(
      `SELECT id, email, label FROM frecon.emails WHERE id = $1`,
      [homeEmailIdBefore],
    );
    expect(home).not.toBeNull();
    const homeValue = home.email;

    const buf = await buildFlat([
      parentRow({
        id: employeeId, code: 'FR-001', firstName: 'Frank', lastName: 'Reconciler',
        extras: { email: homeValue, email_label: 'office', email_is_primary: true, email_is_login: false },
      }),
    ]);
    const res = await postImport(buf, cookies, 'slot-rename');
    expect(res.status).toBe(201);

    const after = await db.oneOrNone(
      `SELECT id, label, email FROM frecon.emails WHERE id = $1`,
      [homeEmailIdBefore],
    );
    expect(after).not.toBeNull();
    expect(after.label).toBe('office');
    expect(after.email).toBe(homeValue);

    // No new row was inserted for that source — original row id was reused.
    const allEmails = await db.any(
      `SELECT id, label FROM frecon.emails WHERE source_id = $1 AND deactivated_at IS NULL`,
      [employeeSourceId],
    );
    const offices = allEmails.filter((r) => r.label === 'office');
    expect(offices).toHaveLength(1);
    expect(offices[0].id).toBe(homeEmailIdBefore);
  });

  test('import auto-allocates employee code from numbering config when enabled', async () => {
    // Enable employee numbering for FRECON.
    const configRes = await request(app)
      .get('/api/core/v1/numbering-config/where?id_type=employee')
      .set('Cookie', cookies);
    expect(configRes.status).toBe(200);
    const empConfigId = configRes.body.records?.[0]?.id;
    expect(empConfigId).toBeDefined();

    const enableRes = await request(app)
      .put(`/api/core/v1/numbering-config/update?id=${empConfigId}`)
      .set('Cookie', cookies)
      .send({ is_enabled: true });
    expect(enableRes.status).toBe(200);

    // Import a new employee with NO code — numbering should fill it in
    // following the configured pattern (prefix 'EMP', padding 4).
    const buf = await buildFlat([
      parentRow({
        firstName: 'Numbered', lastName: 'New',
        extras: {},
      }),
    ]);
    const res = await postImport(buf, cookies, 'numbering-new');
    expect(res.status).toBe(201);

    const emp = await db.oneOrNone(
      `SELECT code FROM frecon.employees WHERE first_name = 'Numbered' AND last_name = 'New'`,
    );
    expect(emp).not.toBeNull();
    expect(emp.code).toBeTruthy();
    expect(emp.code).toMatch(/^EMP/);
  });

  test('import overrides spreadsheet-supplied code with numbering config when numbering is enabled', async () => {
    // User scenario: numbering enabled (increment 10), spreadsheet contains
    // hand-typed codes like EMP-9999. Expected: importer ignores the typed
    // codes and follows the sequence allocator instead.
    const configRes = await request(app)
      .get('/api/core/v1/numbering-config/where?id_type=employee')
      .set('Cookie', cookies);
    const empConfigId = configRes.body.records?.[0]?.id;
    await request(app)
      .put(`/api/core/v1/numbering-config/update?id=${empConfigId}`)
      .set('Cookie', cookies)
      .send({ is_enabled: true, increment: 10 });

    const buf = await buildFlat([
      parentRow({
        code: 'EMP-9999', firstName: 'TypedCode', lastName: 'Override',
        extras: {},
      }),
    ]);
    const res = await postImport(buf, cookies, 'override-supplied');
    expect(res.status).toBe(201);

    const emp = await db.oneOrNone(
      `SELECT code FROM frecon.employees WHERE first_name = 'TypedCode' AND last_name = 'Override'`,
    );
    expect(emp).not.toBeNull();
    expect(emp.code).toBeTruthy();
    expect(emp.code).not.toBe('EMP-9999');
    expect(emp.code).toMatch(/^EMP-\d{4}$/);
  });

  test('import allocates code for existing employee that has no code when numbering is enabled', async () => {
    // Create an employee with code intentionally null (via direct DB write to
    // bypass the controller's auto-allocation), then import a row that doesn't
    // supply a code. The numbering allocator should fill it in on the update.
    const codeless = await request(app).post('/api/core/v1/employees').set('Cookie', cookies).send({
      first_name: 'Codeless', last_name: 'OnUpdate', roles: ['admin'],
    });
    expect(codeless.status).toBe(201);
    // Force the code back to NULL so the import path's update branch is tested.
    await db.none(`UPDATE frecon.employees SET code = NULL WHERE id = $1`, [codeless.body.id]);

    const buf = await buildFlat([
      parentRow({
        id: codeless.body.id, firstName: 'Codeless', lastName: 'OnUpdate',
        extras: {},
      }),
    ]);
    const res = await postImport(buf, cookies, 'allocate-on-update');
    expect(res.status).toBe(201);

    const after = await db.oneOrNone(`SELECT code FROM frecon.employees WHERE id = $1`, [codeless.body.id]);
    expect(after.code).toBeTruthy();
    expect(after.code).toMatch(/^EMP/);
  });

  test('2e — add a new child row to an existing employee (append continuation)', async () => {
    // Frank still has personal email; add a new "office" address as a
    // continuation row. Existing children stay untouched; one new INSERT.
    const buf = await buildFlat([
      parentRow({
        id: employeeId, code: 'FR-001', firstName: 'Frank', lastName: 'Reconciler',
        extras: {
          email: 'frank.home-NEW@frecon.com', email_label: 'home',
          email_is_primary: true, email_is_login: false,
        },
      }),
      parentRow({
        extras: {
          address_label: 'office', address_line_1: '123 Office Way',
          address_city: 'Portland', address_state_province: 'OR',
          address_postal_code: '97201', address_country_code: 'US',
        },
      }),
    ]);
    const res = await postImport(buf, cookies, 'add-child');
    expect(res.status).toBe(201);

    const addresses = await db.any(
      `SELECT label FROM frecon.addresses WHERE source_id = $1 AND deactivated_at IS NULL ORDER BY label`,
      [employeeSourceId],
    );
    expect(addresses.map((a) => a.label)).toContain('office');
  });

  test('6a — blank slot key (email_label missing) is a blocking error', async () => {
    const buf = await buildFlat([
      parentRow({
        id: '', code: 'FR-6A', firstName: 'Sixa', lastName: 'Slot',
        extras: { email: 'sixa@frecon.com', email_label: '', email_is_primary: true, email_is_login: false },
      }),
    ]);
    const res = await postImport(buf, cookies, '6a');
    expect(res.status).toBe(422);
    expect(res.body.errors.some((e) => /label is required/i.test(e.message || ''))).toBe(true);

    const emp = await db.oneOrNone(`SELECT id FROM frecon.employees WHERE code = 'FR-6A'`);
    expect(emp).toBeNull();
  });

  test('6b — invalid email format is a blocking error', async () => {
    const buf = await buildFlat([
      parentRow({
        id: '', code: 'FR-6B', firstName: 'Sixb', lastName: 'BadEmail',
        extras: { email: 'not-an-email', email_label: 'work', email_is_primary: true, email_is_login: false },
      }),
    ]);
    const res = await postImport(buf, cookies, '6b');
    expect(res.status).toBe(422);
    expect(res.body.errors.some((e) => /invalid email format/i.test(e.message || ''))).toBe(true);

    const emp = await db.oneOrNone(`SELECT id FROM frecon.employees WHERE code = 'FR-6B'`);
    expect(emp).toBeNull();
  });

  test('6c — required name field missing is a blocking error with row context', async () => {
    const buf = await buildFlat([
      parentRow({
        id: '', code: 'FR-6C', firstName: '', lastName: 'NoFirst',
      }),
    ]);
    const res = await postImport(buf, cookies, '6c');
    expect(res.status).toBe(422);
    const err = res.body.errors.find((e) => /first name is required/i.test(e.message || ''));
    expect(err).toBeDefined();
    expect(err.row).toBeTruthy();    // row-keyed, not generic

    const emp = await db.oneOrNone(`SELECT id FROM frecon.employees WHERE code = 'FR-6C'`);
    expect(emp).toBeNull();
  });

  test('7a — mixed file: insert + update + unchanged in one import', async () => {
    // Frank gets a field edit; bring in a brand-new employee in the same file;
    // a second existing employee unchanged. Verify preview classifies all three
    // distinctly and the writer honors the mix.
    const newCode = `MIX-${Date.now()}`;
    const buf = await buildFlat([
      // Frank — UPDATE (different department)
      parentRow({
        id: employeeId, code: 'FR-001', firstName: 'Frank', lastName: 'Reconciler',
        extras: { position: 'Engineer', department: 'Platform' },
      }),
      // Gina — UNCHANGED (created in the cross-source test earlier)
      parentRow({ firstName: 'Gina', lastName: 'Garcia', code: 'FR-002' }),
      // Brand-new employee — INSERT
      parentRow({
        id: '', code: newCode, firstName: 'Maya', lastName: 'Mixed',
        extras: { roles: '{admin}' },
      }),
    ]);

    const preview = await postImport(buf, cookies, '7a-preview', { preview: true });
    expect(preview.status).toBe(200);
    expect(preview.body.inserts).toBeGreaterThanOrEqual(1);
    expect(preview.body.updates).toBeGreaterThanOrEqual(1);

    const res = await postImport(buf, cookies, '7a');
    expect(res.status).toBe(201);

    // Numbering may be enabled by earlier tests; query by name instead of
    // the supplied code (which the allocator can override).
    const maya = await db.oneOrNone(
      `SELECT id FROM frecon.employees WHERE first_name = 'Maya' AND last_name = 'Mixed'`,
    );
    expect(maya).not.toBeNull();
    const frank = await db.oneOrNone(`SELECT department FROM frecon.employees WHERE id = $1`, [employeeId]);
    expect(frank.department).toBe('Platform');
  });

  test('parent field edit stamps updated_by on the parent row', async () => {
    // Run last in this describe block: this test mutates Frank's parent
    // fields and must not interfere with prior NO-OP / preview assertions.
    const buf = await buildFlat([
      parentRow({
        id: employeeId, code: 'FR-001', firstName: 'Frank', lastName: 'Reconciler',
        extras: { position: 'Engineer' },
      }),
    ]);
    const res = await postImport(buf, cookies, 'parent-edit');
    expect(res.status).toBe(201);
    expect(res.body.updated).toBe(1);

    const after = await db.oneOrNone(
      `SELECT position, updated_by, updated_at, created_at FROM frecon.employees WHERE id = $1`,
      [employeeId],
    );
    expect(after.position).toBe('Engineer');
    expect(after.updated_by).not.toBeNull();
    expect(after.updated_by).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(after.updated_at.getTime()).toBeGreaterThan(after.created_at.getTime());
  });
});
