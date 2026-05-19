/**
 * @file Contract tests for child-restore-via-import on the flat single-entity importer
 * @module tests/contract/employeeChildRestoreImport
 *
 * Locks in the behavior introduced by the cascade-restore importer follow-on
 * (Phases 4–8 of the cascade-restore plan):
 *   - Soft-deleting an email via emailsController, then re-importing the
 *     employee's workbook unchanged, restores the email in place — same
 *     id, same value, `deactivated_at IS NULL`.
 *   - The preview reports `restores: 1` (preview-side field name) before
 *     commit; commit returns `restored: 1` (commit-side field name).
 *   - The restore does NOT create a duplicate row.
 *
 * Mirrors the matrix described in ADR-0026 (child rows restore via import,
 * not via a controller route).
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

async function provisionTenant(rootCookies) {
  const res = await request(app)
    .post('/api/tenants/v1/tenants')
    .set('Cookie', rootCookies)
    .send({
      tenant_code: 'CHRST',
      company: 'Child Restore Test Corp',
      status: 'active',
      tier: 'starter',
      admin_first_name: 'Test',
      admin_last_name: 'Admin',
      admin_email: 'admin@chrst.test',
      admin_password: 'ChrstPass123!',
      billing_address: { address_line_1: '1 Chrst St', country_code: 'US' },
    });
  if (res.status !== 201) throw new Error(`provisionTenant ${res.status}: ${JSON.stringify(res.body)}`);
  return res.body;
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
  const tmpPath = join(tmpdir(), `child-restore-${label}-${Date.now()}.xlsx`);
  writeFileSync(tmpPath, buf);
  const url = `/api/core/v1/employees/import-xls${preview ? '?preview=1' : ''}`;
  try {
    return await request(app).post(url).set('Cookie', cookies).attach('file', tmpPath);
  } finally {
    unlinkSync(tmpPath);
  }
}

describe('Flat importer — child restore via natural-key match', () => {
  let cookies;
  let employeeId;
  let employeeSourceId;
  let workEmailId;
  let homeEmailId;

  beforeAll(async () => {
    const rootCookies = await loginRoot();
    await provisionTenant(rootCookies);
    cookies = await loginAs('admin@chrst.test', 'ChrstPass123!');

    // Create employee with two emails (different slots).
    const create = await request(app).post('/api/core/v1/employees').set('Cookie', cookies).send({
      first_name: 'Restore', last_name: 'Subject', code: 'RES-001', roles: ['admin'],
    });
    if (create.status !== 201) throw new Error(`create employee ${create.status}: ${JSON.stringify(create.body)}`);
    employeeId = create.body.id;
    employeeSourceId = create.body.source_id;

    const workEmail = await request(app).post('/api/core/v1/emails').set('Cookie', cookies).send({
      source_id: employeeSourceId, email: 'restore.work@chrst.test', label: 'work', is_primary: true,
    });
    if (workEmail.status !== 201) throw new Error(`workEmail ${workEmail.status}: ${JSON.stringify(workEmail.body)}`);
    workEmailId = workEmail.body.id;

    const homeEmail = await request(app).post('/api/core/v1/emails').set('Cookie', cookies).send({
      source_id: employeeSourceId, email: 'restore.home@chrst.test', label: 'home', is_primary: false,
    });
    if (homeEmail.status !== 201) throw new Error(`homeEmail ${homeEmail.status}: ${JSON.stringify(homeEmail.body)}`);
    homeEmailId = homeEmail.body.id;
  }, 60000);

  test('soft-deleting an email then re-importing the workbook restores it in place', async () => {
    // Archive the home email directly via the controller.
    const archive = await request(app)
      .delete(`/api/core/v1/emails/archive?id=${homeEmailId}`)
      .set('Cookie', cookies);
    expect(archive.status).toBe(200);

    const archived = await db.one(`SELECT deactivated_at FROM chrst.emails WHERE id = $1`, [homeEmailId]);
    expect(archived.deactivated_at).not.toBeNull();

    // Re-import the workbook with BOTH emails (the archived home one + the active work one).
    const buf = await buildFlat([
      row({
        id: employeeId, code: 'RES-001', firstName: 'Restore', lastName: 'Subject',
        extras: { email: 'restore.work@chrst.test', email_label: 'work', email_is_primary: true, email_is_login: false },
      }),
      // continuation row for the second email — parent cols blank
      row({
        extras: { email: 'restore.home@chrst.test', email_label: 'home', email_is_primary: false, email_is_login: false },
      }),
    ]);

    // Preview: classifies as 1 restore on the child side.
    const preview = await postImport(buf, cookies, 'preview', { preview: true });
    expect(preview.status).toBe(200);
    expect(preview.body.restores).toBe(1);
    expect(preview.body.inserts).toBe(0);

    // Commit: same shape.
    const commit = await postImport(buf, cookies, 'commit');
    expect(commit.status).toBe(201);
    expect(commit.body.restored).toBe(1);

    // The home email is back, same id, no duplicate row created.
    const restored = await db.oneOrNone(`SELECT id, email, deactivated_at FROM chrst.emails WHERE id = $1`, [homeEmailId]);
    expect(restored).not.toBeNull();
    expect(restored.email).toBe('restore.home@chrst.test');
    expect(restored.deactivated_at).toBeNull();

    const allHome = await db.any(
      `SELECT id FROM chrst.emails WHERE source_id = $1 AND email = $2 AND deactivated_at IS NULL`,
      [employeeSourceId, 'restore.home@chrst.test'],
    );
    expect(allHome).toHaveLength(1);
    expect(allHome[0].id).toBe(homeEmailId);
  });

  test('subsequent unchanged re-import is a noop (no further restores or churn)', async () => {
    const buf = await buildFlat([
      row({
        id: employeeId, code: 'RES-001', firstName: 'Restore', lastName: 'Subject',
        extras: { email: 'restore.work@chrst.test', email_label: 'work', email_is_primary: true, email_is_login: false },
      }),
      row({
        extras: { email: 'restore.home@chrst.test', email_label: 'home', email_is_primary: false, email_is_login: false },
      }),
    ]);

    const preview = await postImport(buf, cookies, 'noop', { preview: true });
    expect(preview.status).toBe(200);
    expect(preview.body.restores).toBe(0);
    expect(preview.body.inserts).toBe(0);
    expect(preview.body.updates).toBe(0);

    const commit = await postImport(buf, cookies, 'noop-commit');
    expect(commit.status).toBe(201);
    expect(commit.body.restored).toBe(0);
    expect(commit.body.inserted).toBe(0);
    expect(commit.body.updated).toBe(0);
  });
});
