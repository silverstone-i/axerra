/**
 * @file Contract tests for tenants import preview + commit (item 7)
 * @module tests/contract/tenantsImport
 *
 * Behavior locked in:
 *   - `?preview=1` returns counts + accumulated errors without any DB writes.
 *   - Preview surfaces: missing required fields, malformed admin_email,
 *     weak admin_password, intra-file dup tenant_code / admin_email,
 *     existing tenant_code in admin.tenants, existing admin_email in
 *     admin.portal_users, ROOT_TENANT archive attempt.
 *   - Commit on a clean workbook actually provisions the tenant (schema
 *     created, admin portal_user binding exists). A round-trip re-import
 *     then classifies as all noops with no DB churn.
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { bootstrapAdmin, cleanupTestDb } from '../helpers/testDb.js';

const ROOT_EMAIL = process.env.ROOT_EMAIL;
const ROOT_PASSWORD = process.env.ROOT_PASSWORD;
const ROOT_TENANT_CODE = (process.env.ROOT_TENANT_CODE || 'AXERRA').toUpperCase();

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

const HEADERS = [
  'id', 'tenant_code', 'company', 'status', 'tier', 'region', 'max_users', 'notes',
  'address_line_1', 'address_line_2', 'address_line_3', 'city', 'state_province', 'postal_code', 'country_code',
  'tax_country_code', 'tax_type', 'tax_value',
  'admin_first_name', 'admin_last_name', 'admin_email', 'admin_password', 'admin_phone',
];

function blank(extras = {}) {
  return Object.fromEntries(HEADERS.map((h) => [h, extras[h] ?? '']));
}

function goodInsertRow(overrides = {}) {
  return blank({
    tenant_code: 'TIMP01',
    company: 'Tenant Import 01 LLC',
    status: 'active',
    tier: 'starter',
    address_line_1: '1 Import St',
    country_code: 'US',
    admin_first_name: 'Imp',
    admin_last_name: 'Admin',
    admin_email: 'admin@timp01.test',
    admin_password: 'StrongPw123!',
    ...overrides,
  });
}

async function buildWorkbook(rows) {
  const { WorkbookBuilder, writeXlsx } = await import('@nap-sft/tablsx');
  const wb = WorkbookBuilder.create();
  wb.sheet('Tenants').setHeaders(HEADERS).addObjects(rows);
  return writeXlsx(wb.build());
}

async function postImport(buf, cookies, label, { preview = false } = {}) {
  const tmpPath = join(tmpdir(), `tenants-${label}-${Date.now()}.xlsx`);
  writeFileSync(tmpPath, buf);
  const url = `/api/tenants/v1/tenants/import-xls${preview ? '?preview=1' : ''}`;
  try {
    return await request(app).post(url).set('Cookie', cookies).attach('file', tmpPath);
  } finally {
    unlinkSync(tmpPath);
  }
}

describe('Tenants import — preview + commit (item 7)', () => {
  let cookies;

  beforeAll(async () => {
    cookies = await loginRoot();
  }, 30000);

  test('preview returns counts without writing anything to admin.tenants', async () => {
    const before = await db.one(`SELECT count(*)::int AS n FROM admin.tenants`);

    const buf = await buildWorkbook([goodInsertRow()]);

    const res = await postImport(buf, cookies, 'preview-clean', { preview: true });
    expect(res.status).toBe(200);
    expect(res.body.preview).toBe(true);
    expect(res.body.errors).toEqual([]);
    expect(res.body.inserts).toBe(1);
    expect(res.body.updates).toBe(0);
    expect(res.body.noops).toBe(0);

    const after = await db.one(`SELECT count(*)::int AS n FROM admin.tenants`);
    expect(after.n).toBe(before.n);
  });

  test('preview surfaces missing required fields, bad email, weak password', async () => {
    const buf = await buildWorkbook([
      blank({ tenant_code: 'TIMP02' }), // missing company, admin_*, address_line_1, country_code
      goodInsertRow({ tenant_code: 'TIMP03', admin_email: 'not-an-email' }),
      goodInsertRow({ tenant_code: 'TIMP04', admin_email: 'admin@timp04.test', admin_password: 'weak' }),
    ]);

    const res = await postImport(buf, cookies, 'preview-bad', { preview: true });
    expect(res.status).toBe(422);
    expect(res.body.preview).toBe(true);
    const cols = res.body.errors.map((e) => e.column);
    expect(cols).toEqual(expect.arrayContaining(['company', 'admin_first_name', 'admin_email', 'admin_password', 'address_line_1', 'country_code']));
    expect(res.body.errors.some((e) => e.column === 'admin_email' && /not a valid email/.test(e.message))).toBe(true);
    expect(res.body.errors.some((e) => e.column === 'admin_password' && /at least 8 characters/.test(e.message))).toBe(true);
  });

  test('preview catches intra-file duplicate tenant_code and admin_email', async () => {
    const buf = await buildWorkbook([
      goodInsertRow({ tenant_code: 'TIMPDP', admin_email: 'dup@timpdp.test' }),
      goodInsertRow({ tenant_code: 'TIMPDP', company: 'Other Co LLC', admin_email: 'other@timpdp.test' }),
      goodInsertRow({ tenant_code: 'TIMPDQ', company: 'Third Co LLC', admin_email: 'dup@timpdp.test' }),
    ]);

    const res = await postImport(buf, cookies, 'preview-dup', { preview: true });
    expect(res.status).toBe(422);
    expect(res.body.errors.some((e) => e.column === 'tenant_code' && /Duplicate tenant_code/.test(e.message))).toBe(true);
    expect(res.body.errors.some((e) => e.column === 'admin_email' && /Duplicate admin_email/.test(e.message))).toBe(true);
  });

  test('preview catches a tenant_code that already exists in admin.tenants', async () => {
    const buf = await buildWorkbook([
      goodInsertRow({ tenant_code: ROOT_TENANT_CODE, company: 'Should Collide', admin_email: 'collide@root.test' }),
    ]);

    const res = await postImport(buf, cookies, 'preview-existing-tc', { preview: true });
    expect(res.status).toBe(422);
    expect(res.body.errors.some((e) => e.column === 'tenant_code' && /already exists/.test(e.message))).toBe(true);
  });

  test('preview blocks an attempt to archive the root tenant', async () => {
    const rootRow = await db.one(`SELECT id FROM admin.tenants WHERE tenant_code = $1`, [ROOT_TENANT_CODE]);
    const buf = await buildWorkbook([
      blank({ id: rootRow.id, tenant_code: ROOT_TENANT_CODE, company: 'Axerra, LLC', status: 'archived', tier: 'enterprise' }),
    ]);

    const res = await postImport(buf, cookies, 'preview-root-archive', { preview: true });
    expect(res.status).toBe(422);
    expect(res.body.errors.some((e) => /Cannot archive the root tenant/.test(e.message))).toBe(true);
  });

  test('commit provisions a new tenant; re-import is reported as all noops with no DB churn', async () => {
    const insertRow = goodInsertRow({
      tenant_code: 'TIMPRT',
      company: 'Tenant Import Round-Trip LLC',
      admin_email: 'admin@timprt.test',
    });
    const buf = await buildWorkbook([insertRow]);

    const commit = await postImport(buf, cookies, 'rt-commit');
    if (commit.status !== 201) {
      throw new Error(`commit returned ${commit.status}: ${JSON.stringify(commit.body)}`);
    }
    expect(commit.body.inserted).toBe(1);
    expect(commit.body.updated || 0).toBe(0);

    const persisted = await db.one(`SELECT id, schema_name FROM admin.tenants WHERE tenant_code = 'TIMPRT'`);
    expect(persisted.schema_name).toBe('timprt');

    // Tenant schema exists.
    const schemaRow = await db.oneOrNone(`SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1`, ['timprt']);
    expect(schemaRow).not.toBeNull();

    // Admin portal_user binding exists.
    const binding = await db.oneOrNone(
      `SELECT pu.email, put.status, put.entity_type
       FROM admin.portal_users pu
       JOIN admin.portal_user_tenants put ON put.portal_user_id = pu.id
       WHERE put.tenant_id = $1`,
      [persisted.id],
    );
    expect(binding).not.toBeNull();
    expect(binding.email).toBe('admin@timprt.test');
    expect(binding.entity_type).toBe('employee');

    // Snapshot updated_at so we can prove the round-trip doesn't churn it.
    const before = await db.one(`SELECT updated_at FROM admin.tenants WHERE id = $1`, [persisted.id]);

    // Round-trip preview using the persisted id + same field values.
    const roundRow = blank({
      id: persisted.id,
      tenant_code: 'TIMPRT',
      company: 'Tenant Import Round-Trip LLC',
      status: 'active',
      tier: 'starter',
      max_users: 5,
      address_line_1: '1 Import St',
      country_code: 'US',
      admin_phone: '',
    });
    const roundBuf = await buildWorkbook([roundRow]);

    const preview = await postImport(roundBuf, cookies, 'rt-preview', { preview: true });
    expect(preview.status).toBe(200);
    expect(preview.body).toMatchObject({ preview: true, inserts: 0, updates: 0, noops: 1, omitted: 0, errors: [] });

    const recommit = await postImport(roundBuf, cookies, 'rt-recommit');
    expect(recommit.status).toBe(201);
    expect(recommit.body).toMatchObject({ inserted: 0, updated: 0 });

    const after = await db.one(`SELECT updated_at FROM admin.tenants WHERE id = $1`, [persisted.id]);
    expect(after.updated_at.toISOString()).toBe(before.updated_at.toISOString());
  });
});
