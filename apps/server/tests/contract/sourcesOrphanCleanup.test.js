/**
 * @file Contract tests for orphan-source cleanup endpoints
 * @module tests/contract/sourcesOrphanCleanup
 *
 * Exercises GET /orphans/preview and POST /orphans/cleanup of /api/core/v1/sources
 * end-to-end against a provisioned tenant schema.
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
  const res = await request(app)
    .post('/api/tenants/v1/tenants')
    .set('Cookie', cookies)
    .send({
      tenant_code: 'OCLEAN',
      company: 'Orphan Cleanup Test Corp',
      status: 'active',
      tier: 'starter',
      admin_first_name: 'Test',
      admin_last_name: 'Admin',
      admin_email: 'admin@oclean.com',
      admin_password: 'OcleanPass123!',
      billing_address: { address_line_1: '1 Cleanup Way', country_code: 'US' },
    });
  return res.body;
}

describe('Orphan source cleanup — /api/core/v1/sources/orphans/{preview,cleanup}', () => {
  let cookies;
  let tenantId;
  const schema = 'oclean';

  beforeAll(async () => {
    const rootCookies = await loginRoot();
    const tenantRec = await provisionTenant(rootCookies);
    tenantId = tenantRec.id;

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@oclean.com', password: 'OcleanPass123!' });
    cookies = loginRes.headers['set-cookie'];
  }, 30000);

  test('GET returns 401 without auth', async () => {
    const res = await request(app).get('/api/core/v1/sources/orphans/preview');
    expect(res.status).toBe(401);
  });

  test('POST returns 401 without auth', async () => {
    const res = await request(app).post('/api/core/v1/sources/orphans/cleanup');
    expect(res.status).toBe(401);
  });

  test('GET returns zero orphans on a freshly provisioned tenant', async () => {
    const res = await request(app).get('/api/core/v1/sources/orphans/preview').set('Cookie', cookies);
    expect(res.status).toBe(200);
    expect(res.body.schema).toBe(schema);
    expect(res.body.count).toBe(0);
    expect(res.body.orphans).toEqual([]);
  });

  test('GET surfaces a synthetic orphan, POST removes it, GET returns zero again', async () => {
    const orphanRow = await db.one(
      `INSERT INTO ${DB.pgp.as.name(schema)}.sources (tenant_id, table_id, source_type, label)
       VALUES ($1, gen_random_uuid(), 'vendor', 'Synthetic Orphan')
       RETURNING id`,
      [tenantId],
    );

    const previewRes = await request(app).get('/api/core/v1/sources/orphans/preview').set('Cookie', cookies);
    expect(previewRes.status).toBe(200);
    expect(previewRes.body.count).toBe(1);
    expect(previewRes.body.orphans[0].source_id).toBe(orphanRow.id);
    expect(previewRes.body.orphans[0].source_type).toBe('vendor');
    expect(previewRes.body.orphans[0].label).toBe('Synthetic Orphan');

    const cleanupRes = await request(app).post('/api/core/v1/sources/orphans/cleanup').set('Cookie', cookies);
    expect(cleanupRes.status).toBe(200);
    expect(cleanupRes.body.count).toBe(1);
    expect(cleanupRes.body.removed[0].source_id).toBe(orphanRow.id);

    const verifyRes = await request(app).get('/api/core/v1/sources/orphans/preview').set('Cookie', cookies);
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.count).toBe(0);

    const stillThere = await db.oneOrNone(
      `SELECT id FROM ${DB.pgp.as.name(schema)}.sources WHERE id = $1`,
      [orphanRow.id],
    );
    expect(stillThere).toBeNull();
  });

  test('POST cascades to child rows of the orphan source', async () => {
    const orphanRow = await db.one(
      `INSERT INTO ${DB.pgp.as.name(schema)}.sources (tenant_id, table_id, source_type, label)
       VALUES ($1, gen_random_uuid(), 'vendor', 'Orphan With Children')
       RETURNING id`,
      [tenantId],
    );
    await db.none(
      `INSERT INTO ${DB.pgp.as.name(schema)}.emails (tenant_id, source_id, email, label, is_primary)
       VALUES ($1, $2, 'cascade@example.com', 'work', true)`,
      [tenantId, orphanRow.id],
    );

    const cleanupRes = await request(app).post('/api/core/v1/sources/orphans/cleanup').set('Cookie', cookies);
    expect(cleanupRes.status).toBe(200);
    expect(cleanupRes.body.count).toBe(1);

    const orphanedEmail = await db.oneOrNone(
      `SELECT id FROM ${DB.pgp.as.name(schema)}.emails WHERE source_id = $1`,
      [orphanRow.id],
    );
    expect(orphanedEmail).toBeNull();
  });

  test('POST returns zero removed when no orphans exist', async () => {
    const res = await request(app).post('/api/core/v1/sources/orphans/cleanup').set('Cookie', cookies);
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
    expect(res.body.removed).toEqual([]);
  });
});
