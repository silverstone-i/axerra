/**
 * @file Contract tests for the generic simple-table import shim against an
 *       entity that previously had no override (`ChartOfAccounts`).
 * @module tests/contract/simpleTableImportShim
 *
 * PaymentTerms had its own bespoke `importFromSpreadsheet`. Every other
 * simple-table model used pg-schemata's default `bulkInsert`-only path, which
 * meant re-importing an exported workbook would PK-conflict. This file proves
 * the shared `importSimpleTable` helper works for a brand-new adopter:
 *   - `?preview=1` classifies inserts/updates/noops without writing.
 *   - Commit writes the expected counts.
 *   - Round-trip with explicit ids preserves rows (no PK conflict; reports noops).
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
      company: `${code} CoA Shim Corp`,
      status: 'active',
      tier: 'starter',
      admin_first_name: 'Test',
      admin_last_name: 'Admin',
      admin_email: `admin@${code.toLowerCase()}.com`,
      admin_password: 'CoaShimPass123!',
      billing_address: { address_line_1: '1 Shim St', country_code: 'US' },
    });
}

const HEADERS = ['id', 'code', 'name', 'type', 'is_active', 'cash_basis', 'status'];
function blank(extras = {}) {
  return Object.fromEntries(HEADERS.map((h) => [h, extras[h] ?? '']));
}

async function buildWorkbook(rows) {
  const { WorkbookBuilder, writeXlsx } = await import('@nap-sft/tablsx');
  const wb = WorkbookBuilder.create();
  wb.sheet('Chart of Accounts').setHeaders(HEADERS).addObjects(rows);
  return writeXlsx(wb.build());
}

async function postImport(buf, cookies, label, { preview = false } = {}) {
  const tmpPath = join(tmpdir(), `coa-${label}-${Date.now()}.xlsx`);
  writeFileSync(tmpPath, buf);
  const url = `/api/accounting/v1/chart-of-accounts/import-xls${preview ? '?preview=1' : ''}`;
  try {
    return await request(app).post(url).set('Cookie', cookies).attach('file', tmpPath);
  } finally {
    unlinkSync(tmpPath);
  }
}

describe('Simple-table shim — ChartOfAccounts', () => {
  let cookies;

  beforeAll(async () => {
    const rootCookies = await loginRoot();
    await provisionTenant(rootCookies, 'COASHM');
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@coashm.com', password: 'CoaShimPass123!' });
    cookies = loginRes.headers['set-cookie'];
  }, 30000);

  test('preview returns counts and writes nothing', async () => {
    const before = await db.one('SELECT count(*)::int AS n FROM coashm.chart_of_accounts');

    const buf = await buildWorkbook([
      blank({ code: '1000', name: 'Cash', type: 'asset', is_active: true, cash_basis: true, status: 'active' }),
      blank({ code: '4000', name: 'Sales Revenue', type: 'revenue', is_active: true, cash_basis: false, status: 'active' }),
    ]);

    const res = await postImport(buf, cookies, 'preview1', { preview: true });
    expect(res.status).toBe(200);
    expect(res.body.preview).toBe(true);
    expect(res.body.errors).toEqual([]);
    expect(res.body.inserts).toBe(2);
    expect(res.body.updates).toBe(0);
    expect(res.body.noops).toBe(0);

    const after = await db.one('SELECT count(*)::int AS n FROM coashm.chart_of_accounts');
    expect(after.n).toBe(before.n);
  });

  test('commit writes inserts; round-trip via UUIDs reports noops (no PK conflict)', async () => {
    const buf = await buildWorkbook([
      blank({ code: '1000', name: 'Cash', type: 'asset', is_active: true, cash_basis: true, status: 'active' }),
      blank({ code: '4000', name: 'Sales Revenue', type: 'revenue', is_active: true, cash_basis: false, status: 'active' }),
    ]);

    const commit = await postImport(buf, cookies, 'commit1');
    if (commit.status !== 201) {
      throw new Error(`commit returned ${commit.status}: ${JSON.stringify(commit.body)}`);
    }
    expect(commit.body.inserted).toBe(2);

    // Re-import with explicit ids — the pg-schemata default (bulkInsert-only)
    // would PK-conflict here. The shim's id-aware upsert path should classify
    // both as noops since nothing changed.
    const persisted = await db.any(
      `SELECT id, code FROM coashm.chart_of_accounts WHERE code IN ('1000', '4000') ORDER BY code`,
    );
    expect(persisted).toHaveLength(2);
    const cash = persisted.find((r) => r.code === '1000');
    const sales = persisted.find((r) => r.code === '4000');

    const round = await buildWorkbook([
      blank({ id: cash.id, code: '1000', name: 'Cash', type: 'asset', is_active: true, cash_basis: true, status: 'active' }),
      blank({ id: sales.id, code: '4000', name: 'Sales Revenue', type: 'revenue', is_active: true, cash_basis: false, status: 'active' }),
    ]);

    const previewRes = await postImport(round, cookies, 'roundpreview', { preview: true });
    expect(previewRes.status).toBe(200);
    expect(previewRes.body).toMatchObject({ preview: true, inserts: 0, updates: 0, noops: 2, omitted: 0 });

    const commitRes = await postImport(round, cookies, 'roundcommit');
    expect(commitRes.status).toBe(201);
    expect(commitRes.body).toMatchObject({ inserted: 0, updated: 0 });
  });

  test('rename via the same id classifies as update + persists the new name', async () => {
    const cash = await db.one(`SELECT id, name FROM coashm.chart_of_accounts WHERE code = '1000'`);
    expect(cash.name).toBe('Cash');

    const buf = await buildWorkbook([
      blank({ id: cash.id, code: '1000', name: 'Operating Cash', type: 'asset', is_active: true, cash_basis: true, status: 'active' }),
    ]);

    const preview = await postImport(buf, cookies, 'rename-preview', { preview: true });
    expect(preview.body.updates).toBe(1);

    const commit = await postImport(buf, cookies, 'rename-commit');
    expect(commit.body.updated).toBe(1);

    const after = await db.one(`SELECT name FROM coashm.chart_of_accounts WHERE id = $1`, [cash.id]);
    expect(after.name).toBe('Operating Cash');
  });
});
