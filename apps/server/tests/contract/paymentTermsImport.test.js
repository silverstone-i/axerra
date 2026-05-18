/**
 * @file Contract tests for the PaymentTerms import via the simple-table shim
 * @module tests/contract/paymentTermsImport
 *
 * Behavior locked in:
 *   - `?preview=1` returns counts (`inserts`, `updates`, `noops`, `omitted=0`)
 *     without any DB writes.
 *   - Commit writes the expected inserted/updated counts.
 *   - Re-import of the same workbook is classified as noops (preview + commit).
 *   - `status='archived'` sets `deactivated_at`; `status='active'` clears it.
 *   - Case-only edits on a varchar parent field are classified as updates and
 *     persist (the shim opts into `diffParent({ caseSensitive: true })`).
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
      company: `${code} Payment Terms Corp`,
      status: 'active',
      tier: 'starter',
      admin_first_name: 'Test',
      admin_last_name: 'Admin',
      admin_email: `admin@${code.toLowerCase()}.com`,
      admin_password: 'PtImportPass123!',
      billing_address: { address_line_1: '1 PT St', country_code: 'US' },
    });
}

const HEADERS = ['id', 'label', 'term', 'units', 'is_active', 'status'];
function blank(extras = {}) {
  return Object.fromEntries(HEADERS.map((h) => [h, extras[h] ?? '']));
}

async function buildWorkbook(rows) {
  const { WorkbookBuilder, writeXlsx } = await import('@nap-sft/tablsx');
  const wb = WorkbookBuilder.create();
  wb.sheet('Payment Terms').setHeaders(HEADERS).addObjects(rows);
  return writeXlsx(wb.build());
}

async function postImport(buf, cookies, label, { preview = false } = {}) {
  const tmpPath = join(tmpdir(), `pt-${label}-${Date.now()}.xlsx`);
  writeFileSync(tmpPath, buf);
  const url = `/api/core/v1/payment-terms/import-xls${preview ? '?preview=1' : ''}`;
  try {
    return await request(app).post(url).set('Cookie', cookies).attach('file', tmpPath);
  } finally {
    unlinkSync(tmpPath);
  }
}

describe('PaymentTerms import — simple-table shim', () => {
  let cookies;

  beforeAll(async () => {
    const rootCookies = await loginRoot();
    await provisionTenant(rootCookies, 'PTIMP');
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@ptimp.com', password: 'PtImportPass123!' });
    cookies = loginRes.headers['set-cookie'];
  }, 30000);

  test('preview returns counts and writes nothing', async () => {
    const before = await db.one('SELECT count(*)::int AS n FROM ptimp.payment_terms');

    const buf = await buildWorkbook([
      blank({ label: 'Net 30', term: 30, units: 'days', is_active: true, status: 'active' }),
      blank({ label: 'Net 60', term: 60, units: 'days', is_active: true, status: 'active' }),
    ]);

    const res = await postImport(buf, cookies, 'preview1', { preview: true });
    expect(res.status).toBe(200);
    expect(res.body.preview).toBe(true);
    expect(res.body.errors).toEqual([]);
    expect(res.body.inserts).toBe(2);
    expect(res.body.updates).toBe(0);
    expect(res.body.noops).toBe(0);
    expect(res.body.omitted).toBe(0);

    const after = await db.one('SELECT count(*)::int AS n FROM ptimp.payment_terms');
    expect(after.n).toBe(before.n);
  });

  test('commit writes inserts; re-commit using the same rows shows up as noops in preview', async () => {
    const buf = await buildWorkbook([
      blank({ label: 'Net 30', term: 30, units: 'days', is_active: true, status: 'active' }),
      blank({ label: 'Net 60', term: 60, units: 'days', is_active: true, status: 'active' }),
    ]);

    const commit = await postImport(buf, cookies, 'commit1');
    if (commit.status !== 201) {
      throw new Error(`commit returned ${commit.status}: ${JSON.stringify(commit.body)}`);
    }
    expect(commit.body.inserted).toBe(2);
    expect(commit.body.updated || 0).toBe(0);

    // Round-trip with explicit ids → preview must classify both as noops.
    const persisted = await db.any(
      `SELECT id, label FROM ptimp.payment_terms WHERE label IN ('Net 30', 'Net 60') ORDER BY label`,
    );
    expect(persisted).toHaveLength(2);
    const net30 = persisted.find((r) => r.label === 'Net 30');
    const net60 = persisted.find((r) => r.label === 'Net 60');

    const round = await buildWorkbook([
      blank({ id: net30.id, label: 'Net 30', term: 30, units: 'days', is_active: true, status: 'active' }),
      blank({ id: net60.id, label: 'Net 60', term: 60, units: 'days', is_active: true, status: 'active' }),
    ]);

    const previewRes = await postImport(round, cookies, 'roundpreview', { preview: true });
    expect(previewRes.status).toBe(200);
    expect(previewRes.body).toMatchObject({ preview: true, inserts: 0, updates: 0, noops: 2, omitted: 0 });

    const commitRes = await postImport(round, cookies, 'roundcommit');
    expect(commitRes.status).toBe(201);
    expect(commitRes.body).toMatchObject({ inserted: 0, updated: 0 });
  });

  test('status=archived sets deactivated_at and updates the counter', async () => {
    const net30 = await db.one(`SELECT id, deactivated_at FROM ptimp.payment_terms WHERE label = 'Net 30'`);
    expect(net30.deactivated_at).toBeNull();

    const buf = await buildWorkbook([
      blank({ id: net30.id, label: 'Net 30', term: 30, units: 'days', is_active: true, status: 'archived' }),
    ]);

    const preview = await postImport(buf, cookies, 'archive-preview', { preview: true });
    expect(preview.body.updates).toBe(1);
    expect(preview.body.noops).toBe(0);

    const commit = await postImport(buf, cookies, 'archive-commit');
    expect(commit.status).toBe(201);
    expect(commit.body.updated).toBe(1);

    const after = await db.one(`SELECT deactivated_at FROM ptimp.payment_terms WHERE id = $1`, [net30.id]);
    expect(after.deactivated_at).not.toBeNull();
  });

  test('status=active restores a soft-deleted row', async () => {
    const net30 = await db.one(`SELECT id FROM ptimp.payment_terms WHERE label = 'Net 30'`);
    const before = await db.one(`SELECT deactivated_at FROM ptimp.payment_terms WHERE id = $1`, [net30.id]);
    expect(before.deactivated_at).not.toBeNull();

    const buf = await buildWorkbook([
      blank({ id: net30.id, label: 'Net 30', term: 30, units: 'days', is_active: true, status: 'active' }),
    ]);

    const commit = await postImport(buf, cookies, 'restore-commit');
    expect(commit.status).toBe(201);
    expect(commit.body.updated).toBe(1);

    const after = await db.one(`SELECT deactivated_at FROM ptimp.payment_terms WHERE id = $1`, [net30.id]);
    expect(after.deactivated_at).toBeNull();
  });

  test('non-UUID id falls back to natural key (label) — round-trip is idempotent', async () => {
    // Mirrors a real-world scenario: a workbook whose `id` column was
    // hand-edited (or carried over from a non-axerra source) with sequential
    // numeric ids instead of UUIDs. Without the natural-key fallback, the
    // shim would classify both as inserts, the commit would hit the unique
    // (tenant_id, label) constraint and 422 with a cryptic duplicate error.
    // With the fallback, they upsert by `label` and round-trip as noops.
    const existing = await db.any(
      `SELECT label FROM ptimp.payment_terms WHERE deactivated_at IS NULL ORDER BY label`,
    );
    expect(existing.length).toBeGreaterThanOrEqual(2);
    const [a, b] = existing;

    const buf = await buildWorkbook([
      blank({ id: 1, label: a.label, term: 30, units: 'days', is_active: true, status: 'active' }),
      blank({ id: 2, label: b.label, term: 60, units: 'days', is_active: true, status: 'active' }),
    ]);

    // First do a baseline commit to align the DB rows with the workbook's
    // (term, units, is_active) values, so the round-trip check below
    // measures only the id-vs-natural-key behavior — not unrelated field drift.
    const baseline = await postImport(buf, cookies, 'naturalKey-baseline');
    expect(baseline.status).toBe(201);

    const preview = await postImport(buf, cookies, 'naturalKey-preview', { preview: true });
    expect(preview.status).toBe(200);
    expect(preview.body).toMatchObject({ preview: true, inserts: 0, updates: 0, noops: 2 });

    const commit = await postImport(buf, cookies, 'naturalKey-commit');
    expect(commit.status).toBe(201);
    expect(commit.body).toMatchObject({ inserted: 0, updated: 0 });

    // And the row count didn't grow.
    const after = await db.one(
      `SELECT count(*)::int AS n FROM ptimp.payment_terms WHERE label IN ($1, $2)`,
      [a.label, b.label],
    );
    expect(after.n).toBe(2);
  });

  test('UUID in file but not in DB falls back to natural key (label) — no spurious inserts', async () => {
    // Mirrors the real-world scenario where a user exports payment terms,
    // resets/migrates the DB (so the old UUIDs are gone), then re-imports
    // the same workbook. Without the natural-key fallback the shim would
    // classify both rows as inserts and the commit would 422 on the unique
    // (tenant_id, label) constraint. With the fallback they upsert by label.
    const existing = await db.any(
      `SELECT label FROM ptimp.payment_terms WHERE deactivated_at IS NULL ORDER BY label`,
    );
    expect(existing.length).toBeGreaterThanOrEqual(2);
    const [a, b] = existing;

    // Use UUIDs that look real but aren't in the DB (random v4-shaped).
    const ghost1 = 'd1869bd7-6191-4e49-9670-62c180a761fa';
    const ghost2 = '8e402252-97ba-4d6a-b357-fa4f1c7b7431';
    const present = await db.oneOrNone(
      `SELECT id FROM ptimp.payment_terms WHERE id IN ($1, $2)`,
      [ghost1, ghost2],
    );
    expect(present).toBeNull();

    const buf = await buildWorkbook([
      blank({ id: ghost1, label: a.label, term: 30, units: 'days', is_active: true, status: 'active' }),
      blank({ id: ghost2, label: b.label, term: 60, units: 'days', is_active: true, status: 'active' }),
    ]);

    // Baseline commit so the rows match the workbook before measuring noop parity.
    const baseline = await postImport(buf, cookies, 'ghostUuid-baseline');
    expect(baseline.status).toBe(201);

    const preview = await postImport(buf, cookies, 'ghostUuid-preview', { preview: true });
    expect(preview.status).toBe(200);
    expect(preview.body).toMatchObject({ preview: true, inserts: 0, updates: 0, noops: 2 });

    const commit = await postImport(buf, cookies, 'ghostUuid-commit');
    expect(commit.status).toBe(201);
    expect(commit.body).toMatchObject({ inserted: 0, updated: 0 });

    // And neither ghost UUID landed in the DB — the upsert used the existing
    // rows' real UUIDs.
    const ghostsAfter = await db.any(
      `SELECT id FROM ptimp.payment_terms WHERE id IN ($1, $2)`,
      [ghost1, ghost2],
    );
    expect(ghostsAfter).toHaveLength(0);
  });

  test('case-only edit on a parent varchar field counts as a real change', async () => {
    const net30 = await db.one(`SELECT id, label FROM ptimp.payment_terms WHERE label = 'Net 30'`);
    const recased = net30.label.toUpperCase();
    expect(recased).not.toBe(net30.label);

    const buf = await buildWorkbook([
      blank({ id: net30.id, label: recased, term: 30, units: 'days', is_active: true, status: 'active' }),
    ]);

    const preview = await postImport(buf, cookies, 'caseEdit-preview', { preview: true });
    expect(preview.status).toBe(200);
    expect(preview.body.updates).toBe(1);
    expect(preview.body.noops).toBe(0);

    const commit = await postImport(buf, cookies, 'caseEdit-commit');
    expect(commit.status).toBe(201);
    expect(commit.body.updated).toBe(1);

    const after = await db.one(`SELECT label FROM ptimp.payment_terms WHERE id = $1`, [net30.id]);
    expect(after.label).toBe(recased);
  });
});
