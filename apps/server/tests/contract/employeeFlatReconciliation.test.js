/**
 * @file Contract tests for flat-format employee import per-row reconciliation
 * @module tests/contract/employeeFlatReconciliation
 *
 * Covers the rules from /Users/ian/.claude/plans/explain-why-when-updating-rustling-hellman.md:
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

  test('no-change re-import preserves child ids (R3)', async () => {
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

    const active = await db.any(
      `SELECT id, label FROM frecon.emails WHERE source_id = $1 AND deactivated_at IS NULL ORDER BY label`,
      [employeeSourceId],
    );
    expect(active.map((r) => r.id).sort()).toEqual([homeEmailIdBefore, personalEmailIdBefore].sort());

    const archived = await db.any(`SELECT id FROM frecon.emails WHERE source_id = $1 AND deactivated_at IS NOT NULL`, [employeeSourceId]);
    expect(archived).toHaveLength(0);
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

    // home email: same id, new value
    const home = await db.oneOrNone(`SELECT id, email FROM frecon.emails WHERE id = $1`, [homeEmailIdBefore]);
    expect(home).not.toBeNull();
    expect(home.email).toBe('frank.home-NEW@frecon.com');

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
      first_name: 'Gina', last_name: 'Garcia', code: 'FR-002',
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
    // Parent counts as 1 update (existing); both child emails NOOP
    expect(res.body.updates).toBe(1);
    expect(res.body.noops).toBe(2);
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
});
