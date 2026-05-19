/**
 * @file Contract tests for vendor archive/restore cascade to vendor_contacts
 * @module tests/contract/vendorCascade
 *
 * Locks in the cascade rules introduced alongside the cascade-restore
 * unification:
 *   - Archiving a vendor archives every active vendor_contact under it,
 *     locks each binding in admin.portal_user_tenants, and locks the
 *     portal_user when that was its last active binding.
 *   - Restoring a vendor brings back the vendor_contact cohort sharing
 *     the vendor's MAX(deactivated_at) plus their bindings/users; the
 *     portal_user `status` column is intentionally left at 'locked'
 *     (restore touches `deactivated_at` only).
 *   - Code-based restore (?code=...) succeeds for an archived vendor
 *     (verifies includeDeactivated on the controller-side lookup).
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
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

async function loginAs(email, password) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.headers['set-cookie'];
}

async function provisionTenant(rootCookies) {
  const res = await request(app)
    .post('/api/tenants/v1/tenants')
    .set('Cookie', rootCookies)
    .send({
      tenant_code: 'VCASC',
      company: 'Vendor Cascade Test Corp',
      status: 'active',
      tier: 'starter',
      admin_first_name: 'Cascade',
      admin_last_name: 'Admin',
      admin_email: 'admin@vcasc.test',
      admin_password: 'CascadePass123!',
      billing_address: { address_line_1: '1 Cascade St', country_code: 'US' },
    });
  if (res.status !== 201) throw new Error(`provisionTenant ${res.status}: ${JSON.stringify(res.body)}`);
  return res.body;
}

async function createVendor(cookies, code, name) {
  const res = await request(app)
    .post('/api/core/v1/vendors')
    .set('Cookie', cookies)
    .send({ code, name });
  if (res.status !== 201) throw new Error(`createVendor ${res.status}: ${JSON.stringify(res.body)}`);
  return res.body;
}

async function createAppUserContact(cookies, vendorId, first, last, email, password) {
  const res = await request(app)
    .post('/api/core/v1/vendor-contacts')
    .set('Cookie', cookies)
    .send({
      vendor_id: vendorId,
      first_name: first,
      last_name: last,
      email,
      is_app_user: true,
      roles: ['vendor'],
      password,
    });
  if (res.status !== 201) throw new Error(`createAppUserContact ${res.status}: ${JSON.stringify(res.body)}`);
  return res.body;
}

describe('Vendor archive/restore cascade — vendor_contacts + portal_users', () => {
  let rootCookies;
  let tenantCookies;
  let vendorId;
  let contactA;
  let contactB;

  beforeAll(async () => {
    rootCookies = await loginRoot();
    await provisionTenant(rootCookies);
    tenantCookies = await loginAs('admin@vcasc.test', 'CascadePass123!');
    const vendor = await createVendor(tenantCookies, 'VC001', 'Cascade Vendor LLC');
    vendorId = vendor.id;
    contactA = await createAppUserContact(tenantCookies, vendorId, 'Anna', 'Apple', 'anna@vcasc.test', 'AnnaPass123!');
    contactB = await createAppUserContact(tenantCookies, vendorId, 'Bob', 'Berry', 'bob@vcasc.test', 'BobPass123!');
  }, 60000);

  test('archive cascades to vendor_contacts + portal_user_tenants + portal_users', async () => {
    const res = await request(app)
      .delete(`/api/core/v1/vendors/archive?id=${vendorId}`)
      .set('Cookie', tenantCookies);
    expect(res.status).toBe(200);

    // Vendor itself is archived.
    const vendor = await db.oneOrNone(`SELECT deactivated_at FROM vcasc.vendors WHERE id = $1`, [vendorId]);
    expect(vendor.deactivated_at).not.toBeNull();

    // Both vendor_contacts archived.
    const contacts = await db.any(
      `SELECT id, deactivated_at FROM vcasc.vendor_contacts WHERE vendor_id = $1`,
      [vendorId],
    );
    expect(contacts).toHaveLength(2);
    for (const c of contacts) expect(c.deactivated_at).not.toBeNull();

    // Their portal_user_tenants bindings are locked.
    const bindings = await db.any(
      `SELECT b.entity_id, b.deactivated_at, b.status, b.portal_user_id
       FROM admin.portal_user_tenants b
       WHERE b.entity_type = 'vendor_contact' AND b.entity_id = ANY($1::uuid[])`,
      [[contactA.id, contactB.id]],
    );
    expect(bindings).toHaveLength(2);
    for (const b of bindings) {
      expect(b.deactivated_at).not.toBeNull();
      expect(b.status).toBe('locked');
    }

    // The portal_users are locked too (each contact's was their only binding).
    const userIds = bindings.map((b) => b.portal_user_id);
    const users = await db.any(
      `SELECT id, deactivated_at, status FROM admin.portal_users WHERE id = ANY($1::uuid[])`,
      [userIds],
    );
    expect(users).toHaveLength(2);
    for (const u of users) {
      expect(u.deactivated_at).not.toBeNull();
      expect(u.status).toBe('locked');
    }
  });

  test('restore by ?code= succeeds for an archived vendor and restores the cohort', async () => {
    const res = await request(app)
      .patch(`/api/core/v1/vendors/restore?code=VC001`)
      .set('Cookie', tenantCookies);
    expect(res.status).toBe(200);

    // Vendor active again.
    const vendor = await db.oneOrNone(`SELECT deactivated_at FROM vcasc.vendors WHERE id = $1`, [vendorId]);
    expect(vendor.deactivated_at).toBeNull();

    // Both vendor_contacts restored (they shared the same MAX deactivated_at
    // from the cascade-archive a moment ago).
    const contacts = await db.any(
      `SELECT id, deactivated_at FROM vcasc.vendor_contacts WHERE vendor_id = $1`,
      [vendorId],
    );
    expect(contacts).toHaveLength(2);
    for (const c of contacts) expect(c.deactivated_at).toBeNull();

    // Bindings: deactivated_at cleared; `status` intentionally left at 'locked'
    // — the restore rule of record only touches deactivated_at.
    const bindings = await db.any(
      `SELECT deactivated_at, status, portal_user_id FROM admin.portal_user_tenants
       WHERE entity_type = 'vendor_contact' AND entity_id = ANY($1::uuid[])`,
      [[contactA.id, contactB.id]],
    );
    expect(bindings).toHaveLength(2);
    for (const b of bindings) {
      expect(b.deactivated_at).toBeNull();
      expect(b.status).toBe('locked');
    }

    // portal_users: same — restored timestamp, locked status preserved.
    const userIds = bindings.map((b) => b.portal_user_id);
    const users = await db.any(
      `SELECT deactivated_at, status FROM admin.portal_users WHERE id = ANY($1::uuid[])`,
      [userIds],
    );
    expect(users).toHaveLength(2);
    for (const u of users) {
      expect(u.deactivated_at).toBeNull();
      expect(u.status).toBe('locked');
    }
  });
});
