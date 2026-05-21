/**
 * @file Contract tests for self-service login-email change endpoint
 * @module tests/contract/authChangeEmail
 *
 * Covers PATCH /api/auth/me/email — vendors update their own portal_users
 * email and the change cascades to per-tenant emails.is_login rows in
 * every active binding.
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
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

async function provisionTenant(rootCookies, code, company, adminEmail, adminPass) {
  await request(app)
    .post('/api/tenants/v1/tenants')
    .set('Cookie', rootCookies)
    .send({
      tenant_code: code,
      company,
      status: 'active',
      tier: 'starter',
      admin_first_name: 'T',
      admin_last_name: 'A',
      admin_email: adminEmail,
      admin_password: adminPass,
      billing_address: { address_line_1: '1 St', country_code: 'US' },
    });
}

async function login(email, password) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.headers['set-cookie'];
}

async function fetchLoginEmails(portalUserId) {
  // Returns [{ schema_name, entity_type, entity_id, email }] for is_login rows
  // across all active bindings of this portal_user.
  const bindings = await db.manyOrNone(
    `SELECT b.entity_type, b.entity_id, tn.schema_name
       FROM admin.portal_user_tenants b
       JOIN admin.tenants tn ON tn.id = b.tenant_id
      WHERE b.portal_user_id = $1
        AND b.deactivated_at IS NULL
        AND b.entity_type IS NOT NULL`,
    [portalUserId],
  );
  const rows = [];
  for (const b of bindings) {
    const r = await db.oneOrNone(
      `SELECT e.email
         FROM ${b.schema_name}.emails e
         JOIN ${b.schema_name}.sources s ON s.id = e.source_id
        WHERE s.source_type = $1
          AND s.table_id = $2
          AND e.is_login = true
          AND e.deactivated_at IS NULL`,
      [b.entity_type, b.entity_id],
    );
    rows.push({ schema_name: b.schema_name, entity_type: b.entity_type, entity_id: b.entity_id, email: r?.email || null });
  }
  return rows;
}

describe('PATCH /api/auth/me/email — self-service login email change', () => {
  let rootCookies;
  let cookiesA;
  let cookiesB;
  let vendorIdA;
  let vendorIdB;
  const ORIGINAL_EMAIL = 'sally.shared@vendor.test';
  const NEW_EMAIL = 'sally.renamed@vendor.test';
  const COLLIDING_EMAIL = 'collider@vendor.test';

  beforeAll(async () => {
    rootCookies = await loginRoot();

    await provisionTenant(rootCookies, 'CETEN1', 'CE Tenant 1', 'admin@ceten1.com', 'CetenPass123!');
    await provisionTenant(rootCookies, 'CETEN2', 'CE Tenant 2', 'admin@ceten2.com', 'CetenPass123!');

    cookiesA = await login('admin@ceten1.com', 'CetenPass123!');
    cookiesB = await login('admin@ceten2.com', 'CetenPass123!');

    const vA = await request(app).post('/api/core/v1/vendors').set('Cookie', cookiesA).send({ name: 'V A', code: 'VA1' });
    vendorIdA = vA.body.id;
    const vB = await request(app).post('/api/core/v1/vendors').set('Cookie', cookiesB).send({ name: 'V B', code: 'VB1' });
    vendorIdB = vB.body.id;

    // Create vendor_contact app-user in tenant A — this auto-creates a portal_user
    // and an emails row with is_login=true.
    const cA = await request(app)
      .post('/api/core/v1/vendor-contacts')
      .set('Cookie', cookiesA)
      .send({
        vendor_id: vendorIdA,
        first_name: 'Sally',
        last_name: 'Shared',
        email: ORIGINAL_EMAIL,
        is_app_user: true,
        roles: ['vendor_contact'],
        password: 'SallyPass123!',
      });
    expect(cA.status).toBe(201);

    // Bind in tenant B as the same person — Task 6 attaches to the existing portal_user.
    const cB = await request(app)
      .post('/api/core/v1/vendor-contacts')
      .set('Cookie', cookiesB)
      .send({
        vendor_id: vendorIdB,
        first_name: 'Sally',
        last_name: 'Shared',
        email: ORIGINAL_EMAIL,
        is_app_user: true,
        roles: ['vendor_contact'],
        password: 'IgnoredPass123!',
      });
    expect(cB.status).toBe(201);

    // Activate the invited portal_user so the user can log in (status='invited' →
    // 'active' triggered by changePassword; do that directly in DB to avoid the
    // first-login forced-password dance).
    await db.none(
      `UPDATE admin.portal_users SET status = 'active' WHERE email = $1`,
      [ORIGINAL_EMAIL],
    );
    // Activate every binding (Task 6 leaves the second tenant's binding as 'invited')
    await db.none(
      `UPDATE admin.portal_user_tenants
          SET status = 'active'
        WHERE portal_user_id = (SELECT id FROM admin.portal_users WHERE email = $1)
          AND deactivated_at IS NULL`,
      [ORIGINAL_EMAIL],
    );
  }, 60000);

  test('returns 401 when not authenticated', async () => {
    const res = await request(app).patch('/api/auth/me/email').send({ email: 'foo@bar.com' });
    expect(res.status).toBe(401);
  });

  test('returns 400 for invalid email format', async () => {
    const cookies = await login(ORIGINAL_EMAIL, 'SallyPass123!');
    const res = await request(app).patch('/api/auth/me/email').set('Cookie', cookies).send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Invalid email/i);
  });

  test('returns 409 when new email collides with another portal_user', async () => {
    // Seed a colliding portal_user
    await db.none(
      `INSERT INTO admin.portal_users (email, password_hash, status)
       VALUES ($1, 'x', 'active')`,
      [COLLIDING_EMAIL],
    );

    const cookies = await login(ORIGINAL_EMAIL, 'SallyPass123!');
    const res = await request(app).patch('/api/auth/me/email').set('Cookie', cookies).send({ email: COLLIDING_EMAIL });
    expect(res.status).toBe(409);

    // portal_users.email unchanged
    const stillThere = await db.one(
      `SELECT email FROM admin.portal_users WHERE id = (
         SELECT portal_user_id FROM admin.portal_user_tenants
          WHERE entity_type = 'vendor_contact' AND deactivated_at IS NULL
          ORDER BY created_at ASC LIMIT 1
       )`,
    );
    expect(stillThere.email).toBe(ORIGINAL_EMAIL);
  });

  test('updates portal_users.email and cascades to is_login rows in every bound tenant', async () => {
    const cookies = await login(ORIGINAL_EMAIL, 'SallyPass123!');

    const portalBefore = await db.one(
      `SELECT id FROM admin.portal_users WHERE email = $1 AND deactivated_at IS NULL`,
      [ORIGINAL_EMAIL],
    );

    const beforeRows = await fetchLoginEmails(portalBefore.id);
    expect(beforeRows.length).toBe(2);
    for (const r of beforeRows) expect(r.email).toBe(ORIGINAL_EMAIL);

    const res = await request(app).patch('/api/auth/me/email').set('Cookie', cookies).send({ email: NEW_EMAIL });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(NEW_EMAIL);

    // portal_users.email reflects the change
    const after = await db.oneOrNone(
      `SELECT id FROM admin.portal_users WHERE email = $1 AND deactivated_at IS NULL`,
      [NEW_EMAIL],
    );
    expect(after).not.toBeNull();
    expect(after.id).toBe(portalBefore.id);

    // Both tenants' is_login=true emails rows reflect the change
    const afterRows = await fetchLoginEmails(after.id);
    expect(afterRows.length).toBe(2);
    for (const r of afterRows) expect(r.email).toBe(NEW_EMAIL);
  });
});
