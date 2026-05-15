/**
 * @file Contract tests for partial unique indexes on tenant child entities
 * @module tests/contract/partialUniqueIndexes
 *
 * Exercises the following partial unique indexes and adjacent constraints
 * via direct inserts through the test DB handle:
 *   - emails:           UNIQUE (email)                                    WHERE deactivated_at IS NULL
 *   - tax_identifiers:  UNIQUE (country_code, tax_type, tax_value)        WHERE deactivated_at IS NULL
 *   - phone_numbers:    UNIQUE (country_code, phone_number)               WHERE deactivated_at IS NULL AND phone_type = 'cell'
 *   - phone_numbers.country_code is NOT NULL
 *
 * Coverage spans positive duplicate-rejection cases (SQLSTATE 23505), the
 * NOT NULL violation on country_code (SQLSTATE 23502), and negative cases
 * that must succeed: soft-deleted email reuse, non-cell phone duplicates,
 * and multiple tax values for the same source/country/type.
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
      tenant_code: 'PUITST',
      company: 'Partial Unique Index Test Corp',
      status: 'active',
      tier: 'starter',
      admin_first_name: 'Test',
      admin_last_name: 'Admin',
      admin_email: 'admin@puitst.com',
      admin_password: 'PuitstPass123!',
      billing_address: { address_line_1: '1 Unique Way', country_code: 'US' },
    });
  return res.body;
}

async function makeSource(schema, tenantId, label) {
  return db.one(
    `INSERT INTO ${DB.pgp.as.name(schema)}.sources (tenant_id, table_id, source_type, label)
     VALUES ($1, gen_random_uuid(), 'vendor', $2)
     RETURNING id`,
    [tenantId, label],
  );
}

describe('Partial unique indexes — emails / tax_identifiers / phone_numbers', () => {
  let tenantId;
  const schema = 'puitst';

  beforeAll(async () => {
    const rootCookies = await loginRoot();
    const tenantRec = await provisionTenant(rootCookies);
    tenantId = tenantRec.id;
  }, 30000);

  test('emails: UNIQUE (email) WHERE deactivated_at IS NULL rejects duplicate email across sources', async () => {
    const a = await makeSource(schema, tenantId, 'EmailSrcA');
    const b = await makeSource(schema, tenantId, 'EmailSrcB');

    await db.none(
      `INSERT INTO ${DB.pgp.as.name(schema)}.emails (tenant_id, source_id, email, label, is_primary)
       VALUES ($1, $2, 'dup@example.com', 'work', false)`,
      [tenantId, a.id],
    );

    await expect(
      db.none(
        `INSERT INTO ${DB.pgp.as.name(schema)}.emails (tenant_id, source_id, email, label, is_primary)
         VALUES ($1, $2, 'dup@example.com', 'work', false)`,
        [tenantId, b.id],
      ),
    ).rejects.toMatchObject({ code: '23505' });
  });

  test('emails: soft-deleted row does not block reuse of the email', async () => {
    const a = await makeSource(schema, tenantId, 'EmailSrcSoftA');
    const b = await makeSource(schema, tenantId, 'EmailSrcSoftB');

    await db.none(
      `INSERT INTO ${DB.pgp.as.name(schema)}.emails (tenant_id, source_id, email, label, is_primary, deactivated_at)
       VALUES ($1, $2, 'reuse@example.com', 'work', false, now())`,
      [tenantId, a.id],
    );

    await expect(
      db.none(
        `INSERT INTO ${DB.pgp.as.name(schema)}.emails (tenant_id, source_id, email, label, is_primary)
         VALUES ($1, $2, 'reuse@example.com', 'work', false)`,
        [tenantId, b.id],
      ),
    ).resolves.toBeNull();
  });

  test('tax_identifiers: UNIQUE (country_code, tax_type, tax_value) rejects duplicate global tax identifier', async () => {
    const a = await makeSource(schema, tenantId, 'TaxSrcA');
    const b = await makeSource(schema, tenantId, 'TaxSrcB');

    await db.none(
      `INSERT INTO ${DB.pgp.as.name(schema)}.tax_identifiers (tenant_id, source_id, country_code, tax_type, tax_value)
       VALUES ($1, $2, 'US', 'EIN', '12-3456789')`,
      [tenantId, a.id],
    );

    await expect(
      db.none(
        `INSERT INTO ${DB.pgp.as.name(schema)}.tax_identifiers (tenant_id, source_id, country_code, tax_type, tax_value)
         VALUES ($1, $2, 'US', 'EIN', '12-3456789')`,
        [tenantId, b.id],
      ),
    ).rejects.toMatchObject({ code: '23505' });

    // Different tax_value is fine
    await expect(
      db.none(
        `INSERT INTO ${DB.pgp.as.name(schema)}.tax_identifiers (tenant_id, source_id, country_code, tax_type, tax_value)
         VALUES ($1, $2, 'US', 'EIN', '98-7654321')`,
        [tenantId, b.id],
      ),
    ).resolves.toBeNull();
  });

  test('phone_numbers: UNIQUE (country_code, phone_number) WHERE phone_type = cell rejects duplicate cell numbers', async () => {
    const a = await makeSource(schema, tenantId, 'PhoneSrcA');
    const b = await makeSource(schema, tenantId, 'PhoneSrcB');

    await db.none(
      `INSERT INTO ${DB.pgp.as.name(schema)}.phone_numbers (tenant_id, source_id, country_code, phone_type, phone_number, is_primary)
       VALUES ($1, $2, 'US', 'cell', '+15555550001', false)`,
      [tenantId, a.id],
    );

    await expect(
      db.none(
        `INSERT INTO ${DB.pgp.as.name(schema)}.phone_numbers (tenant_id, source_id, country_code, phone_type, phone_number, is_primary)
         VALUES ($1, $2, 'US', 'cell', '+15555550001', false)`,
        [tenantId, b.id],
      ),
    ).rejects.toMatchObject({ code: '23505' });
  });

  test('phone_numbers: non-cell phone types are NOT subject to the unique index', async () => {
    const a = await makeSource(schema, tenantId, 'PhoneSrcWorkA');
    const b = await makeSource(schema, tenantId, 'PhoneSrcWorkB');

    await db.none(
      `INSERT INTO ${DB.pgp.as.name(schema)}.phone_numbers (tenant_id, source_id, country_code, phone_type, phone_number, is_primary)
       VALUES ($1, $2, 'US', 'work', '+15555550100', false)`,
      [tenantId, a.id],
    );

    await expect(
      db.none(
        `INSERT INTO ${DB.pgp.as.name(schema)}.phone_numbers (tenant_id, source_id, country_code, phone_type, phone_number, is_primary)
         VALUES ($1, $2, 'US', 'work', '+15555550100', false)`,
        [tenantId, b.id],
      ),
    ).resolves.toBeNull();
  });

  test('phone_numbers: country_code is NOT NULL — rejects explicit NULL inserts', async () => {
    const src = await makeSource(schema, tenantId, 'PhoneSrcNullCC');

    await expect(
      db.none(
        `INSERT INTO ${DB.pgp.as.name(schema)}.phone_numbers (tenant_id, source_id, country_code, phone_type, phone_number, is_primary)
         VALUES ($1, $2, NULL, 'cell', '+15555559999', false)`,
        [tenantId, src.id],
      ),
    ).rejects.toMatchObject({ code: '23502' });
  });

  test('tax_identifiers: one row per (source, country_code, tax_type) — second active insert is rejected', async () => {
    const src = await makeSource(schema, tenantId, 'TaxSrcMultiVAT');

    await db.none(
      `INSERT INTO ${DB.pgp.as.name(schema)}.tax_identifiers (tenant_id, source_id, country_code, tax_type, tax_value)
       VALUES ($1, $2, 'GB', 'VAT', 'GB123456789')`,
      [tenantId, src.id],
    );

    // Second active row with the same (source_id, country_code, tax_type) violates the partial unique index.
    await expect(
      db.none(
        `INSERT INTO ${DB.pgp.as.name(schema)}.tax_identifiers (tenant_id, source_id, country_code, tax_type, tax_value)
         VALUES ($1, $2, 'GB', 'VAT', 'GB987654321')`,
        [tenantId, src.id],
      ),
    ).rejects.toMatchObject({ code: '23505' });
  });
});
