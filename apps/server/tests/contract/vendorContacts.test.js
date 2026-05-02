/**
 * @file Contract tests for vendor-contacts CRUD endpoints
 * @module tests/contract/vendorContacts
 *
 * Covers: creation with auto-linked sources record, basic CRUD,
 * and soft-delete behavior.
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

async function provisionTenant(cookies) {
  await request(app)
    .post('/api/tenants/v1/tenants')
    .set('Cookie', cookies)
    .send({
      tenant_code: 'VCTEST',
      company: 'Vendor Contact Test Corp',
      status: 'active',
      tier: 'starter',
      admin_first_name: 'Test',
      admin_last_name: 'Admin',
      admin_email: 'admin@vctest.com',
      admin_password: 'VctestPass123!',
      billing_address: { address_line_1: '1 Test St', country_code: 'US' },
    });
}

describe('Vendor Contact CRUD — /api/core/v1/vendor-contacts', () => {
  let cookies;
  let vendorId;
  let contactId;

  beforeAll(async () => {
    const rootCookies = await loginRoot();
    await provisionTenant(rootCookies);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@vctest.com', password: 'VctestPass123!' });
    cookies = loginRes.headers['set-cookie'];

    // Create a vendor to link contacts to
    const vendorRes = await request(app)
      .post('/api/core/v1/vendors')
      .set('Cookie', cookies)
      .send({ name: 'Test Vendor', code: 'TVEN' });
    vendorId = vendorRes.body.id;
  }, 30000);

  test('creates a vendor contact with auto-linked source', async () => {
    const res = await request(app)
      .post('/api/core/v1/vendor-contacts')
      .set('Cookie', cookies)
      .send({ vendor_id: vendorId, first_name: 'Jane', last_name: 'Smith', position: 'Manager', department: 'Sales' });

    expect(res.status).toBe(201);
    expect(res.body.first_name).toBe('Jane');
    expect(res.body.last_name).toBe('Smith');
    expect(res.body.source_id).toBeDefined();
    contactId = res.body.id;
  });

  test('lists vendor contacts by vendor_id', async () => {
    const res = await request(app)
      .get(`/api/core/v1/vendor-contacts?vendor_id=${vendorId}`)
      .set('Cookie', cookies);
    expect(res.status).toBe(200);
    const rows = res.body.rows ?? res.body;
    expect(rows.length).toBe(1);
    expect(rows[0].first_name).toBe('Jane');
  });

  test('updates a vendor contact', async () => {
    const res = await request(app)
      .put(`/api/core/v1/vendor-contacts/update?id=${contactId}`)
      .set('Cookie', cookies)
      .send({ position: 'Director' });
    expect(res.status).toBe(200);
  });

  test('archives and restores a vendor contact', async () => {
    const archiveRes = await request(app)
      .delete(`/api/core/v1/vendor-contacts/archive?id=${contactId}`)
      .set('Cookie', cookies)
      .send({});
    expect(archiveRes.status).toBe(200);

    const restoreRes = await request(app)
      .patch(`/api/core/v1/vendor-contacts/restore?id=${contactId}`)
      .set('Cookie', cookies)
      .send({});
    expect(restoreRes.status).toBe(200);
  });

  test('source record was correctly linked on create', async () => {
    // Fetch the contact and verify source_id points to a valid sources record
    const contactRes = await request(app)
      .get(`/api/core/v1/vendor-contacts/${contactId}`)
      .set('Cookie', cookies);

    expect(contactRes.status).toBe(200);
    const sourceId = contactRes.body.source_id;
    expect(sourceId).toBeDefined();

    // Verify the source exists with correct source_type
    const sourcesRes = await request(app)
      .get(`/api/core/v1/sources?id=${sourceId}`)
      .set('Cookie', cookies);
    expect(sourcesRes.status).toBe(200);
    const sources = sourcesRes.body.rows ?? sourcesRes.body;
    const source = sources.find((s) => s.id === sourceId);
    expect(source).toBeDefined();
    expect(source.source_type).toBe('vendor_contact');
    expect(source.table_id).toBe(contactId);
  });
});

describe('Vendor Contact app-user provisioning — cross-tenant existing-email match → bind', () => {
  let cookiesA;
  let cookiesB;
  let vendorIdA;
  let vendorIdB;
  const SHARED_EMAIL = 'vera.shared@vendor.test';

  beforeAll(async () => {
    const rootCookies = await loginRoot();

    // Tenant A: provision if not already (so this describe runs in isolation).
    let loginA = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@vctest.com', password: 'VctestPass123!' });
    if (!loginA.headers['set-cookie']?.length) {
      await provisionTenant(rootCookies);
      loginA = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@vctest.com', password: 'VctestPass123!' });
    }
    cookiesA = loginA.headers['set-cookie'];

    // Provision a second tenant B for the cross-tenant bind case.
    await request(app)
      .post('/api/tenants/v1/tenants')
      .set('Cookie', rootCookies)
      .send({
        tenant_code: 'VCTSTB',
        company: 'Vendor Contact Test Corp B',
        status: 'active',
        tier: 'starter',
        admin_first_name: 'B',
        admin_last_name: 'Admin',
        admin_email: 'admin@vctstb.com',
        admin_password: 'VctstbPass123!',
        billing_address: { address_line_1: '1 B St', country_code: 'US' },
      });
    const loginB = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@vctstb.com', password: 'VctstbPass123!' });
    cookiesB = loginB.headers['set-cookie'];

    const vendorA = await request(app)
      .post('/api/core/v1/vendors')
      .set('Cookie', cookiesA)
      .send({ name: 'Bind Vendor A', code: 'BVEN' });
    vendorIdA = vendorA.body.id;

    const vendorB = await request(app)
      .post('/api/core/v1/vendors')
      .set('Cookie', cookiesB)
      .send({ name: 'Bind Vendor B', code: 'BVENB' });
    vendorIdB = vendorB.body.id;
  }, 30000);

  test('first vendor_contact in tenant A with new email creates portal_user + binding', async () => {
    const res = await request(app)
      .post('/api/core/v1/vendor-contacts')
      .set('Cookie', cookiesA)
      .send({
        vendor_id: vendorIdA,
        first_name: 'Vera',
        last_name: 'Shared',
        email: SHARED_EMAIL,
        is_app_user: true,
        roles: ['vendor'],
        password: 'VendorPass123!',
      });
    expect(res.status).toBe(201);

    const portal = await db.oneOrNone(
      'SELECT id, status FROM admin.portal_users WHERE email = $1 AND deactivated_at IS NULL',
      [SHARED_EMAIL],
    );
    expect(portal).not.toBeNull();
    expect(portal.status).toBe('invited');

    const binding = await db.oneOrNone(
      `SELECT entity_type, entity_id, status FROM admin.portal_user_tenants
       WHERE portal_user_id = $1 AND deactivated_at IS NULL`,
      [portal.id],
    );
    expect(binding.entity_type).toBe('vendor_contact');
    expect(binding.entity_id).toBe(res.body.id);
    expect(binding.status).toBe('active');
  });

  test('second vendor_contact in tenant B with same email binds to the existing portal_user, status=invited, no new portal_user, password unchanged', async () => {
    const before = await db.one(
      'SELECT COUNT(*)::int AS count, MAX(password_hash) AS hash FROM admin.portal_users WHERE email = $1',
      [SHARED_EMAIL],
    );
    expect(before.count).toBe(1);

    const res = await request(app)
      .post('/api/core/v1/vendor-contacts')
      .set('Cookie', cookiesB)
      .send({
        vendor_id: vendorIdB,
        first_name: 'Vera',
        last_name: 'Shared',
        email: SHARED_EMAIL,
        is_app_user: true,
        roles: ['vendor'],
        password: 'AttemptedHijack123!',
      });
    expect(res.status).toBe(201);

    // No new portal_users row was created
    const after = await db.one(
      'SELECT COUNT(*)::int AS count, MAX(password_hash) AS hash FROM admin.portal_users WHERE email = $1',
      [SHARED_EMAIL],
    );
    expect(after.count).toBe(1);
    // Supplied password was ignored — credentials unchanged
    expect(after.hash).toBe(before.hash);

    // The new tenant-B binding points at the existing portal_user with status='invited'
    const portal = await db.one(
      'SELECT id FROM admin.portal_users WHERE email = $1 AND deactivated_at IS NULL',
      [SHARED_EMAIL],
    );
    const bindings = await db.any(
      `SELECT entity_id, tenant_id, status FROM admin.portal_user_tenants
       WHERE portal_user_id = $1 AND deactivated_at IS NULL
       ORDER BY created_at ASC`,
      [portal.id],
    );
    expect(bindings.length).toBe(2);
    const tenantBBinding = bindings.find((b) => b.entity_id === res.body.id);
    expect(tenantBBinding).toBeDefined();
    expect(tenantBBinding.status).toBe('invited');
  });

  test('Case 1: archive → re-provision restores binding without resetting credentials', async () => {
    // Create a fresh vendor + vendor_contact in tenant A so we can
    // archive/restore without disturbing the cross-tenant SHARED_EMAIL state.
    const vendorRes = await request(app)
      .post('/api/core/v1/vendors')
      .set('Cookie', cookiesA)
      .send({ name: 'Lifecycle Vendor', code: 'LCV01' });

    const createRes = await request(app)
      .post('/api/core/v1/vendor-contacts')
      .set('Cookie', cookiesA)
      .send({
        vendor_id: vendorRes.body.id,
        first_name: 'Lana',
        last_name: 'Lifecycle',
        email: 'lana.lifecycle@vendor.test',
        is_app_user: true,
        roles: ['vendor'],
        password: 'OriginalPass123!',
      });
    expect(createRes.status).toBe(201);
    const contactId = createRes.body.id;

    const portalBefore = await db.one(
      'SELECT id, email, password_hash, status FROM admin.portal_users WHERE email = $1 AND deactivated_at IS NULL',
      ['lana.lifecycle@vendor.test'],
    );

    // Toggle is_app_user OFF — archives the binding (and the portal_user
    // since this is the only binding for it).
    const offRes = await request(app)
      .put(`/api/core/v1/vendor-contacts/update?id=${contactId}`)
      .set('Cookie', cookiesA)
      .send({ is_app_user: false });
    expect(offRes.status).toBe(200);

    // Toggle is_app_user back ON with a different password and email
    // — Case 1 should restore the binding and leave portal_user
    // credentials alone.
    const onRes = await request(app)
      .put(`/api/core/v1/vendor-contacts/update?id=${contactId}`)
      .set('Cookie', cookiesA)
      .send({
        is_app_user: true,
        roles: ['vendor'],
        password: 'IgnoredOnRestore123!',
      });
    expect(onRes.status).toBe(200);

    const portalAfter = await db.one(
      'SELECT email, password_hash, status FROM admin.portal_users WHERE id = $1',
      [portalBefore.id],
    );
    // Binding restored, portal_user reactivated, credentials unchanged
    expect(portalAfter.email).toBe(portalBefore.email);
    expect(portalAfter.password_hash).toBe(portalBefore.password_hash);
    expect(portalAfter.status).toBe('active');

    const restoredBinding = await db.oneOrNone(
      `SELECT status, deactivated_at FROM admin.portal_user_tenants
       WHERE portal_user_id = $1 AND entity_id = $2`,
      [portalBefore.id, contactId],
    );
    expect(restoredBinding).not.toBeNull();
    expect(restoredBinding.deactivated_at).toBeNull();
    expect(restoredBinding.status).toBe('active');
  });

  test('archiving a vendor_contact does NOT lock a portal_user that has other active bindings', async () => {
    // SHARED_EMAIL portal_user has bindings in tenant A and tenant B
    // (from the earlier two tests). Archive the tenant-B vendor_contact
    // and confirm the portal_user stays active because the tenant-A
    // binding is still alive.
    const portal = await db.one(
      'SELECT id, status FROM admin.portal_users WHERE email = $1',
      [SHARED_EMAIL],
    );
    expect(portal.status).toBe('invited'); // still in initial invited state

    const tenantBContact = await db.one(
      `SELECT b.entity_id FROM admin.portal_user_tenants b
       JOIN admin.tenants t ON t.id = b.tenant_id
       WHERE b.portal_user_id = $1 AND t.tenant_code = 'VCTSTB' AND b.deactivated_at IS NULL`,
      [portal.id],
    );

    const archiveRes = await request(app)
      .delete(`/api/core/v1/vendor-contacts/archive?id=${tenantBContact.entity_id}`)
      .set('Cookie', cookiesB)
      .send({});
    expect(archiveRes.status).toBe(200);

    const portalAfter = await db.one(
      'SELECT deactivated_at, status FROM admin.portal_users WHERE id = $1',
      [portal.id],
    );
    // Portal_user remains active because the tenant-A binding is still alive
    expect(portalAfter.deactivated_at).toBeNull();
    expect(portalAfter.status).not.toBe('locked');

    // The tenant-B binding itself is locked
    const lockedBinding = await db.one(
      `SELECT status, deactivated_at FROM admin.portal_user_tenants
       WHERE portal_user_id = $1 AND entity_id = $2`,
      [portal.id, tenantBContact.entity_id],
    );
    expect(lockedBinding.status).toBe('locked');
    expect(lockedBinding.deactivated_at).not.toBeNull();
  });
});

describe('Vendor Contact reset-password authority — multi-tenant guard (Task 9)', () => {
  let cookiesA;
  let cookiesB;
  let rootCookies;
  let vendorIdA;
  let vendorIdB;

  beforeAll(async () => {
    rootCookies = await loginRoot();

    // Tenants A & B may already exist from earlier describe blocks.
    let loginA = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@vctest.com', password: 'VctestPass123!' });
    if (!loginA.headers['set-cookie']?.length) {
      await provisionTenant(rootCookies);
      loginA = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@vctest.com', password: 'VctestPass123!' });
    }
    cookiesA = loginA.headers['set-cookie'];

    let loginB = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@vctstb.com', password: 'VctstbPass123!' });
    if (!loginB.headers['set-cookie']?.length) {
      await request(app)
        .post('/api/tenants/v1/tenants')
        .set('Cookie', rootCookies)
        .send({
          tenant_code: 'VCTSTB',
          company: 'Vendor Contact Test Corp B',
          status: 'active',
          tier: 'starter',
          admin_first_name: 'B',
          admin_last_name: 'Admin',
          admin_email: 'admin@vctstb.com',
          admin_password: 'VctstbPass123!',
          billing_address: { address_line_1: '1 B St', country_code: 'US' },
        });
      loginB = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@vctstb.com', password: 'VctstbPass123!' });
    }
    cookiesB = loginB.headers['set-cookie'];

    const vendorA = await request(app)
      .post('/api/core/v1/vendors')
      .set('Cookie', cookiesA)
      .send({ name: 'Reset Vendor A', code: 'RVENA' });
    vendorIdA = vendorA.body.id;

    const vendorB = await request(app)
      .post('/api/core/v1/vendors')
      .set('Cookie', cookiesB)
      .send({ name: 'Reset Vendor B', code: 'RVENB' });
    vendorIdB = vendorB.body.id;
  }, 30000);

  test('single-tenant vendor → tenant admin can reset password (200)', async () => {
    const email = 'solo.reset@vendor.test';
    const createRes = await request(app)
      .post('/api/core/v1/vendor-contacts')
      .set('Cookie', cookiesA)
      .send({
        vendor_id: vendorIdA,
        first_name: 'Solo',
        last_name: 'Reset',
        email,
        is_app_user: true,
        roles: ['vendor'],
        password: 'OriginalPass123!',
      });
    expect(createRes.status).toBe(201);
    const contactId = createRes.body.id;

    const resetRes = await request(app)
      .post(`/api/core/v1/vendor-contacts/${contactId}/reset-password`)
      .set('Cookie', cookiesA)
      .send({ password: 'NewSoloPass123!' });
    expect(resetRes.status).toBe(200);
    expect(resetRes.body.message).toMatch(/reset/i);
  });

  test('multi-tenant vendor → tenant admin gets 403 with domain error', async () => {
    const sharedEmail = 'multi.reset@vendor.test';

    // Create vendor_contact in tenant A → creates portal_user.
    const createA = await request(app)
      .post('/api/core/v1/vendor-contacts')
      .set('Cookie', cookiesA)
      .send({
        vendor_id: vendorIdA,
        first_name: 'Multi',
        last_name: 'Reset',
        email: sharedEmail,
        is_app_user: true,
        roles: ['vendor'],
        password: 'OriginalPass123!',
      });
    expect(createA.status).toBe(201);

    // Create matching vendor_contact in tenant B → binds to existing portal_user.
    const createB = await request(app)
      .post('/api/core/v1/vendor-contacts')
      .set('Cookie', cookiesB)
      .send({
        vendor_id: vendorIdB,
        first_name: 'Multi',
        last_name: 'Reset',
        email: sharedEmail,
        is_app_user: true,
        roles: ['vendor'],
      });
    expect(createB.status).toBe(201);
    const contactBId = createB.body.id;

    const resetRes = await request(app)
      .post(`/api/core/v1/vendor-contacts/${contactBId}/reset-password`)
      .set('Cookie', cookiesB)
      .send({ password: 'NewMultiPass123!' });
    expect(resetRes.status).toBe(403);
    expect(resetRes.body.error).toBe('Tenant admins cannot change the password of a multi-tenant vendor user.');
  });

  test('multi-tenant vendor → Axerra admin can still reset password (200)', async () => {
    const sharedEmail = 'axerra.reset@vendor.test';

    const createA = await request(app)
      .post('/api/core/v1/vendor-contacts')
      .set('Cookie', cookiesA)
      .send({
        vendor_id: vendorIdA,
        first_name: 'Axerra',
        last_name: 'Reset',
        email: sharedEmail,
        is_app_user: true,
        roles: ['vendor'],
        password: 'OriginalPass123!',
      });
    expect(createA.status).toBe(201);

    const createB = await request(app)
      .post('/api/core/v1/vendor-contacts')
      .set('Cookie', cookiesB)
      .send({
        vendor_id: vendorIdB,
        first_name: 'Axerra',
        last_name: 'Reset',
        email: sharedEmail,
        is_app_user: true,
        roles: ['vendor'],
      });
    expect(createB.status).toBe(201);
    const contactBId = createB.body.id;

    // Give the root user a real binding into tenant B so RBAC has caps
    // to evaluate. The earliest active binding (AXERRA) stays the home
    // tenant — so home_tenant === 'axerra' on this request and the
    // controller-level Axerra escape hatch fires. We create an employee
    // in tenant B's schema with the seeded 'admin' role (wildcard full
    // policies) and link the binding to it.
    const tenantB = await db.one(
      'SELECT id, schema_name FROM admin.tenants WHERE tenant_code = $1',
      ['VCTSTB'],
    );
    const rootUser = await db.one(
      'SELECT id FROM admin.portal_users WHERE email = $1 AND deactivated_at IS NULL',
      [process.env.ROOT_EMAIL],
    );

    // Idempotent: only seed if no binding yet
    const existingBinding = await db.oneOrNone(
      `SELECT id FROM admin.portal_user_tenants
       WHERE portal_user_id = $1 AND tenant_id = $2 AND deactivated_at IS NULL`,
      [rootUser.id, tenantB.id],
    );
    if (!existingBinding) {
      const empId = await db.one(
        `INSERT INTO ${tenantB.schema_name}.employees
           (tenant_id, first_name, last_name, is_app_user, roles)
         VALUES ($1, 'Axerra', 'Operator', true, '{admin}')
         RETURNING id`,
        [tenantB.id],
      );
      await db.none(
        `INSERT INTO admin.portal_user_tenants
           (portal_user_id, tenant_id, entity_type, entity_id, status)
         VALUES ($1, $2, 'employee', $3, 'active')`,
        [rootUser.id, tenantB.id, empId.id],
      );
    }

    // Re-login as root so the auth/perm cache picks up the new binding.
    const freshRootCookies = await loginRoot();

    // Axerra root admin acts on tenant B via x-tenant-code header.
    const resetRes = await request(app)
      .post(`/api/core/v1/vendor-contacts/${contactBId}/reset-password`)
      .set('Cookie', freshRootCookies)
      .set('x-tenant-code', 'VCTSTB')
      .send({ password: 'AxerraNewPass123!' });
    expect(resetRes.status).toBe(200);
    expect(resetRes.body.message).toMatch(/reset/i);
  });
});
