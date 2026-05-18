/**
 * @file Contract tests for the combined Vendors + VendorContacts import
 * @module tests/contract/vendorsCombinedImport
 *
 * Behavior locked in:
 *   - `?preview=1` returns a two-bucket payload (vendors + contacts) without writing.
 *   - The commit path writes the expected inserted/updated counts.
 *   - A re-commit reflects in vendor preview as all-noops.
 *   - A workbook with more than 2 sheets is rejected with a format error.
 *   - Update path: changing a vendor field shows up as one update; row persists.
 *   - Archive transition via `status='archived'` sets `deactivated_at`.
 *   - Restore transition via `status='active'` clears `deactivated_at`.
 *   - Child reconciliation: re-importing a vendor with new child rows soft-deletes
 *     all prior children for that source and inserts the new set (wholesale replace).
 *   - App-user provisioning: a new contact with `is_app_user=true` + an email
 *     yields a `portal_users` row plus an active `portal_user_tenants` binding.
 *   - Preview/commit parity: a round-trip workbook (UUIDs preserved, content
 *     unchanged, child sets identical) reports zero writes from commit and
 *     leaves vendor / contact / email `updated_at` untouched.
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
      company: `${code} Vendor Combo Corp`,
      status: 'active',
      tier: 'starter',
      admin_first_name: 'Test',
      admin_last_name: 'Admin',
      admin_email: `admin@${code.toLowerCase()}.com`,
      admin_password: 'ComboPass123!',
      billing_address: { address_line_1: '1 Combo St', country_code: 'US' },
    });
}

const VENDOR_HEADERS = [
  'id', 'code', 'name', 'payment_term_id', 'notes', 'status',
  'email', 'email_label', 'email_is_primary',
  'phone_country_code', 'phone_type', 'phone_number', 'phone_is_primary',
  'address_label', 'address_line_1', 'address_line_2', 'address_line_3',
  'address_city', 'address_state_province', 'address_postal_code', 'address_country_code',
  'tax_country_code', 'tax_type', 'tax_value',
];

const CONTACT_HEADERS = [
  'vendor_id', 'id', 'first_name', 'last_name', 'position', 'department',
  'is_app_user', 'roles', 'status', 'password',
  'email', 'email_label', 'email_is_primary', 'email_is_login',
  'phone_country_code', 'phone_type', 'phone_number', 'phone_is_primary',
];

function blankVendor(extras = {}) {
  return Object.fromEntries(VENDOR_HEADERS.map((h) => [h, extras[h] ?? '']));
}
function blankContact(extras = {}) {
  return Object.fromEntries(CONTACT_HEADERS.map((h) => [h, extras[h] ?? '']));
}

async function buildWorkbook(vendorRows, contactRows, { extraSheets = 0 } = {}) {
  const { WorkbookBuilder, writeXlsx } = await import('@nap-sft/tablsx');
  const wb = WorkbookBuilder.create();
  wb.sheet('Vendors').setHeaders(VENDOR_HEADERS).addObjects(vendorRows);
  wb.sheet('Vendor Contacts').setHeaders(CONTACT_HEADERS).addObjects(contactRows);
  for (let i = 0; i < extraSheets; i++) {
    wb.sheet(`Extra ${i}`).setHeaders(['col']).addObjects([{ col: 'x' }]);
  }
  return writeXlsx(wb.build());
}

async function postImport(buf, cookies, label, { preview = false } = {}) {
  const tmpPath = join(tmpdir(), `vcombo-${label}-${Date.now()}.xlsx`);
  writeFileSync(tmpPath, buf);
  const url = `/api/core/v1/vendors/import-combined-xls${preview ? '?preview=1' : ''}`;
  try {
    return await request(app).post(url).set('Cookie', cookies).attach('file', tmpPath);
  } finally {
    unlinkSync(tmpPath);
  }
}

describe('Vendors combined import — preview + commit', () => {
  let cookies;

  beforeAll(async () => {
    const rootCookies = await loginRoot();
    await provisionTenant(rootCookies, 'VCOMBO');
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@vcombo.com', password: 'ComboPass123!' });
    cookies = loginRes.headers['set-cookie'];
  }, 30000);

  // Non-UUID ids in the source workbook act as in-file refs that the
  // importer maps to the inserted vendor UUIDs. Contacts cite their vendor
  // via the same ref string.
  const ACME_REF = 'acme-ref';
  const BETA_REF = 'beta-ref';

  test('preview returns two-bucket payload and writes nothing', async () => {
    const vendorsBefore = await db.any('SELECT count(*)::int AS n FROM vcombo.vendors');
    const contactsBefore = await db.any('SELECT count(*)::int AS n FROM vcombo.vendor_contacts');

    const buf = await buildWorkbook(
      [
        blankVendor({ id: ACME_REF, name: 'Acme Supplies', status: 'active', email: 'sales@acme.test', email_label: 'work', email_is_primary: true }),
        blankVendor({ id: BETA_REF, name: 'Beta Tools', status: 'active' }),
      ],
      [
        blankContact({ vendor_id: ACME_REF, first_name: 'Alice', last_name: 'Adams', status: 'active' }),
      ],
    );

    const res = await postImport(buf, cookies, 'preview1', { preview: true });
    expect(res.status).toBe(200);
    expect(res.body.preview).toBe(true);
    expect(res.body.errors).toEqual([]);
    expect(res.body.vendors).toEqual({ inserts: 2, updates: 0, noops: 0, omitted: 0 });
    expect(res.body.contacts).toEqual({ inserts: 1, updates: 0, noops: 0, omitted: 0 });

    const vendorsAfter = await db.any('SELECT count(*)::int AS n FROM vcombo.vendors');
    const contactsAfter = await db.any('SELECT count(*)::int AS n FROM vcombo.vendor_contacts');
    expect(vendorsAfter[0].n).toBe(vendorsBefore[0].n);
    expect(contactsAfter[0].n).toBe(contactsBefore[0].n);
  });

  test('commit writes vendors + contacts; re-commit is a noop', async () => {
    const buf = await buildWorkbook(
      [
        blankVendor({ id: ACME_REF, name: 'Acme Supplies', status: 'active', email: 'sales@acme.test', email_label: 'work', email_is_primary: true }),
        blankVendor({ id: BETA_REF, name: 'Beta Tools', status: 'active' }),
      ],
      [
        blankContact({ vendor_id: ACME_REF, first_name: 'Alice', last_name: 'Adams', status: 'active' }),
      ],
    );

    const commitRes = await postImport(buf, cookies, 'commit1');
    if (commitRes.status !== 200) {
      // Surface the response body so debugging doesn't require a re-run.
      throw new Error(`commit returned ${commitRes.status}: ${JSON.stringify(commitRes.body)}`);
    }
    expect(commitRes.body.inserted).toBe(2);
    expect(commitRes.body.contactsInserted).toBe(1);
    expect(commitRes.body.updated || 0).toBe(0);
    expect(commitRes.body.contactsUpdated || 0).toBe(0);

    // Roundtrip via export → re-import as preview should classify everything
    // as noops. Build an "exported-style" workbook by reading what we just
    // wrote and reposting it.
    const vendors = await db.any('SELECT id, code, name FROM vcombo.vendors ORDER BY name');
    const contacts = await db.any('SELECT id, vendor_id, first_name, last_name FROM vcombo.vendor_contacts ORDER BY last_name');
    expect(vendors.map((v) => v.name)).toEqual(['Acme Supplies', 'Beta Tools']);
    expect(contacts).toHaveLength(1);

    const acme = vendors.find((v) => v.name === 'Acme Supplies');
    const beta = vendors.find((v) => v.name === 'Beta Tools');

    const round = await buildWorkbook(
      [
        blankVendor({ id: acme.id, code: acme.code || '', name: 'Acme Supplies', status: 'active', email: 'sales@acme.test', email_label: 'work', email_is_primary: true }),
        blankVendor({ id: beta.id, code: beta.code || '', name: 'Beta Tools', status: 'active' }),
      ],
      [
        blankContact({ vendor_id: acme.id, id: contacts[0].id, first_name: 'Alice', last_name: 'Adams', status: 'active' }),
      ],
    );

    const previewRes = await postImport(round, cookies, 'roundpreview', { preview: true });
    expect(previewRes.status).toBe(200);
    expect(previewRes.body.vendors).toEqual({ inserts: 0, updates: 0, noops: 2, omitted: 0 });
    expect(previewRes.body.contacts).toEqual({ inserts: 0, updates: 0, noops: 1, omitted: 0 });
  });

  test('update path — changing a vendor field reports updated:1 and persists', async () => {
    const acme = await db.one(`SELECT id FROM vcombo.vendors WHERE name = $1`, ['Acme Supplies']);

    const buf = await buildWorkbook(
      [
        blankVendor({ id: acme.id, name: 'Acme Supplies LLC', status: 'active' }),
      ],
      [],
    );

    const res = await postImport(buf, cookies, 'update1');
    if (res.status !== 200) {
      throw new Error(`update returned ${res.status}: ${JSON.stringify(res.body)}`);
    }
    expect(res.body.inserted).toBe(0);
    expect(res.body.updated).toBe(1);

    const after = await db.one(`SELECT name FROM vcombo.vendors WHERE id = $1`, [acme.id]);
    expect(after.name).toBe('Acme Supplies LLC');
  });

  test('archive transition — status=archived sets deactivated_at', async () => {
    const beta = await db.one(`SELECT id FROM vcombo.vendors WHERE name = $1`, ['Beta Tools']);

    const buf = await buildWorkbook(
      [
        blankVendor({ id: beta.id, name: 'Beta Tools', status: 'archived' }),
      ],
      [],
    );

    const res = await postImport(buf, cookies, 'archive1');
    if (res.status !== 200) {
      throw new Error(`archive returned ${res.status}: ${JSON.stringify(res.body)}`);
    }
    expect(res.body.updated).toBe(1);

    const after = await db.one(
      `SELECT deactivated_at FROM vcombo.vendors WHERE id = $1`,
      [beta.id],
    );
    expect(after.deactivated_at).not.toBeNull();
  });

  test('restore transition — status=active clears deactivated_at on the previously archived row', async () => {
    const beta = await db.one(`SELECT id FROM vcombo.vendors WHERE name = $1`, ['Beta Tools']);

    const buf = await buildWorkbook(
      [
        blankVendor({ id: beta.id, name: 'Beta Tools', status: 'active' }),
      ],
      [],
    );

    const res = await postImport(buf, cookies, 'restore1');
    if (res.status !== 200) {
      throw new Error(`restore returned ${res.status}: ${JSON.stringify(res.body)}`);
    }
    expect(res.body.updated).toBe(1);

    const after = await db.one(
      `SELECT deactivated_at FROM vcombo.vendors WHERE id = $1`,
      [beta.id],
    );
    expect(after.deactivated_at).toBeNull();
  });

  test('child reconciliation — re-importing a vendor with new emails wholesale-replaces the child set', async () => {
    // Acme arrived with one email ('sales@acme.test') in the initial commit.
    // The combined importer treats children as wholesale-replaced per parent:
    // when the file includes children for a vendor, every active child for
    // that vendor's source is soft-deleted and the file's set is re-inserted.
    const acme = await db.one(
      `SELECT id, source_id FROM vcombo.vendors WHERE name = $1`,
      ['Acme Supplies LLC'],
    );

    const beforeActive = await db.any(
      `SELECT id, email FROM vcombo.emails WHERE source_id = $1 AND deactivated_at IS NULL`,
      [acme.source_id],
    );
    expect(beforeActive.map((r) => r.email).sort()).toEqual(['sales@acme.test']);
    const originalEmailId = beforeActive[0].id;

    const buf = await buildWorkbook(
      [
        blankVendor({
          id: acme.id, name: 'Acme Supplies LLC', status: 'active',
          email: 'sales@acme.test', email_label: 'work', email_is_primary: true,
        }),
        // Continuation row — all parent cols blank, just supplies a second
        // child email. groupFlatRows() attaches it to the prior group. Distinct
        // label is required: `emails` has a unique partial index on
        // (source_id, label) so two 'work' emails per source would collide.
        blankVendor({
          email: 'purchasing@acme.test', email_label: 'purchasing', email_is_primary: false,
        }),
      ],
      [],
    );

    const res = await postImport(buf, cookies, 'childReplace');
    if (res.status !== 200) {
      throw new Error(`child replace returned ${res.status}: ${JSON.stringify(res.body)}`);
    }

    const afterActive = await db.any(
      `SELECT id, email FROM vcombo.emails WHERE source_id = $1 AND deactivated_at IS NULL ORDER BY email`,
      [acme.source_id],
    );
    expect(afterActive.map((r) => r.email)).toEqual(['purchasing@acme.test', 'sales@acme.test']);

    // The original sales@acme.test row was soft-deleted as part of wholesale
    // replace; the re-inserted sales@acme.test carries a new id.
    const archived = await db.any(
      `SELECT id, email FROM vcombo.emails WHERE source_id = $1 AND deactivated_at IS NOT NULL`,
      [acme.source_id],
    );
    expect(archived.map((r) => r.id)).toContain(originalEmailId);
    const newSalesRow = afterActive.find((r) => r.email === 'sales@acme.test');
    expect(newSalesRow.id).not.toBe(originalEmailId);
  });

  test('app-user provisioning — new contact with is_app_user=true gets portal_users + binding', async () => {
    const acme = await db.one(
      `SELECT id FROM vcombo.vendors WHERE name = $1`,
      ['Acme Supplies LLC'],
    );
    const tenant = await db.one(
      `SELECT id FROM admin.tenants WHERE tenant_code = 'VCOMBO'`,
    );

    const buf = await buildWorkbook(
      // Need a vendor row so the parent sheet isn't empty; reference Acme by
      // UUID so it's classified as a noop on the vendor side.
      [
        blankVendor({ id: acme.id, name: 'Acme Supplies LLC', status: 'active' }),
      ],
      [
        blankContact({
          vendor_id: acme.id,
          first_name: 'Bob', last_name: 'Boss',
          is_app_user: true, roles: '{admin}', status: 'active',
          password: 'AppUserPass123!',
          email: 'bob.boss@vcombo.test', email_label: 'work', email_is_primary: true, email_is_login: true,
        }),
      ],
    );

    const res = await postImport(buf, cookies, 'appUser');
    if (res.status !== 200) {
      throw new Error(`app-user provisioning returned ${res.status}: ${JSON.stringify(res.body)}`);
    }
    expect(res.body.contactsInserted).toBe(1);

    const bob = await db.one(
      `SELECT id, source_id, is_app_user FROM vcombo.vendor_contacts WHERE first_name = 'Bob' AND last_name = 'Boss'`,
    );
    expect(bob.is_app_user).toBe(true);

    const portalUser = await db.oneOrNone(
      `SELECT id, email, status FROM admin.portal_users WHERE email = 'bob.boss@vcombo.test'`,
    );
    expect(portalUser).not.toBeNull();
    expect(portalUser.status).toBe('invited');

    const binding = await db.oneOrNone(
      `SELECT entity_type, entity_id, status, deactivated_at
       FROM admin.portal_user_tenants
       WHERE portal_user_id = $1 AND tenant_id = $2`,
      [portalUser.id, tenant.id],
    );
    expect(binding).not.toBeNull();
    expect(binding.entity_type).toBe('vendor_contact');
    expect(binding.entity_id).toBe(bob.id);
    expect(binding.deactivated_at).toBeNull();
  });

  test('round-trip commit is a noop — zero writes, untouched updated_at on parent + children', async () => {
    // After all the prior tests the DB holds:
    //   Acme Supplies LLC (with one 'sales@acme.test' [work] + 'purchasing@acme.test' [purchasing] email)
    //   Beta Tools (no children)
    //   Alice Adams (contact on Acme, no children)
    //   Bob Boss (contact on Acme, is_app_user, one 'bob.boss@vcombo.test' email)
    // Build a workbook that reproduces that exact state and commit it.
    // Preview must show zero writes AND the commit's counts must match.
    const acme = await db.one(
      `SELECT id, name FROM vcombo.vendors WHERE name = $1`,
      ['Acme Supplies LLC'],
    );
    const beta = await db.one(`SELECT id, name FROM vcombo.vendors WHERE name = $1`, ['Beta Tools']);
    const alice = await db.one(
      `SELECT id FROM vcombo.vendor_contacts WHERE first_name = 'Alice' AND last_name = 'Adams'`,
    );
    const bob = await db.one(
      `SELECT id FROM vcombo.vendor_contacts WHERE first_name = 'Bob' AND last_name = 'Boss'`,
    );

    const buf = await buildWorkbook(
      [
        // Acme row 1 carries the first email child.
        blankVendor({
          id: acme.id, name: 'Acme Supplies LLC', status: 'active',
          email: 'purchasing@acme.test', email_label: 'purchasing', email_is_primary: false,
        }),
        // Continuation row supplies the second email for Acme.
        blankVendor({
          email: 'sales@acme.test', email_label: 'work', email_is_primary: true,
        }),
        // Beta has no children.
        blankVendor({ id: beta.id, name: 'Beta Tools', status: 'active' }),
      ],
      [
        blankContact({
          vendor_id: acme.id, id: alice.id,
          first_name: 'Alice', last_name: 'Adams', status: 'active',
        }),
        blankContact({
          vendor_id: acme.id, id: bob.id,
          first_name: 'Bob', last_name: 'Boss',
          is_app_user: true, roles: '{admin}', status: 'active',
          email: 'bob.boss@vcombo.test', email_label: 'work', email_is_primary: true, email_is_login: true,
        }),
      ],
    );

    // Preview: must report zero writes coming.
    const previewRes = await postImport(buf, cookies, 'rt-preview', { preview: true });
    expect(previewRes.status).toBe(200);
    expect(previewRes.body.vendors).toEqual({ inserts: 0, updates: 0, noops: 2, omitted: 0 });
    expect(previewRes.body.contacts).toEqual({ inserts: 0, updates: 0, noops: 2, omitted: 0 });

    // Snapshot DB timestamps before commit so we can prove nothing got touched.
    const beforeVendors = await db.any(
      `SELECT id, updated_at FROM vcombo.vendors WHERE id IN ($1, $2) ORDER BY id`,
      [acme.id, beta.id],
    );
    const beforeContacts = await db.any(
      `SELECT id, updated_at FROM vcombo.vendor_contacts WHERE id IN ($1, $2) ORDER BY id`,
      [alice.id, bob.id],
    );
    const beforeEmails = await db.any(
      `SELECT id, updated_at FROM vcombo.emails
       WHERE source_id IN (SELECT source_id FROM vcombo.vendors WHERE id = $1)
          OR source_id IN (SELECT source_id FROM vcombo.vendor_contacts WHERE id IN ($2, $3))
       ORDER BY id`,
      [acme.id, alice.id, bob.id],
    );

    // Commit: must match the preview's promise.
    const commitRes = await postImport(buf, cookies, 'rt-commit');
    if (commitRes.status !== 200) {
      throw new Error(`round-trip commit returned ${commitRes.status}: ${JSON.stringify(commitRes.body)}`);
    }
    expect(commitRes.body.inserted).toBe(0);
    expect(commitRes.body.updated).toBe(0);
    expect(commitRes.body.contactsInserted).toBe(0);
    expect(commitRes.body.contactsUpdated).toBe(0);

    // And the DB rows weren't churned — same ids, same updated_at.
    const afterVendors = await db.any(
      `SELECT id, updated_at FROM vcombo.vendors WHERE id IN ($1, $2) ORDER BY id`,
      [acme.id, beta.id],
    );
    const afterContacts = await db.any(
      `SELECT id, updated_at FROM vcombo.vendor_contacts WHERE id IN ($1, $2) ORDER BY id`,
      [alice.id, bob.id],
    );
    const afterEmails = await db.any(
      `SELECT id, updated_at FROM vcombo.emails
       WHERE source_id IN (SELECT source_id FROM vcombo.vendors WHERE id = $1)
          OR source_id IN (SELECT source_id FROM vcombo.vendor_contacts WHERE id IN ($2, $3))
       ORDER BY id`,
      [acme.id, alice.id, bob.id],
    );
    expect(afterVendors).toEqual(beforeVendors);
    expect(afterContacts).toEqual(beforeContacts);
    expect(afterEmails).toEqual(beforeEmails);
  });

  test('child-only change — parent unchanged but child set differs — preview AND commit both count it as an update', async () => {
    // Acme's parent fields don't change; one of its emails gets a different
    // value. Preview must classify Acme as an update (not noop) and commit's
    // `updated` counter must reflect the child wholesale-replace.
    const acme = await db.one(
      `SELECT id, source_id FROM vcombo.vendors WHERE name = $1`,
      ['Acme Supplies LLC'],
    );

    const buf = await buildWorkbook(
      [
        // Parent identical to current DB state.
        blankVendor({
          id: acme.id, name: 'Acme Supplies LLC', status: 'active',
          email: 'sales@acme.test', email_label: 'work', email_is_primary: true,
        }),
        // Continuation row: same 'purchasing' label, NEW email value.
        blankVendor({
          email: 'procurement@acme.test', email_label: 'purchasing', email_is_primary: false,
        }),
      ],
      [],
    );

    const preview = await postImport(buf, cookies, 'childOnly-preview', { preview: true });
    expect(preview.status).toBe(200);
    expect(preview.body.vendors).toEqual({ inserts: 0, updates: 1, noops: 0, omitted: 0 });

    const commit = await postImport(buf, cookies, 'childOnly-commit');
    if (commit.status !== 200) {
      throw new Error(`child-only commit returned ${commit.status}: ${JSON.stringify(commit.body)}`);
    }
    expect(commit.body.updated).toBe(1);
    expect(commit.body.inserted).toBe(0);

    const activeEmails = await db.any(
      `SELECT email FROM vcombo.emails WHERE source_id = $1 AND deactivated_at IS NULL ORDER BY email`,
      [acme.source_id],
    );
    expect(activeEmails.map((r) => r.email)).toEqual(['procurement@acme.test', 'sales@acme.test']);
  });

  test('case-only edit on a child field counts as a real change (not a noop)', async () => {
    // Seed Acme with an address, then re-import with the same address but
    // a case-only edit on `address_line_1`. The DB column is case-sensitive
    // and the user's intent is to update casing, so the diff must surface
    // it as an update — `_normChildVal` must not lowercase its way past it.
    const acme = await db.one(
      `SELECT id, source_id FROM vcombo.vendors WHERE name = $1`,
      ['Acme Supplies LLC'],
    );

    // Seed: a single address row with mixed-case street name.
    const seedBuf = await buildWorkbook(
      [
        blankVendor({
          id: acme.id, name: 'Acme Supplies LLC', status: 'active',
          address_label: 'office', address_line_1: '123 Main St',
          address_city: 'Springfield', address_country_code: 'US',
        }),
      ],
      [],
    );
    const seedRes = await postImport(seedBuf, cookies, 'caseSeed');
    expect(seedRes.status).toBe(200);

    // Verify the seed landed with the original casing.
    const seeded = await db.one(
      `SELECT id, address_line_1 FROM vcombo.addresses WHERE source_id = $1 AND deactivated_at IS NULL`,
      [acme.source_id],
    );
    expect(seeded.address_line_1).toBe('123 Main St');

    // Re-import with case-only change on address_line_1.
    const editBuf = await buildWorkbook(
      [
        blankVendor({
          id: acme.id, name: 'Acme Supplies LLC', status: 'active',
          address_label: 'office', address_line_1: '123 MAIN ST',
          address_city: 'Springfield', address_country_code: 'US',
        }),
      ],
      [],
    );

    const preview = await postImport(editBuf, cookies, 'caseEdit-preview', { preview: true });
    expect(preview.status).toBe(200);
    expect(preview.body.vendors).toEqual({ inserts: 0, updates: 1, noops: 0, omitted: 0 });

    const commit = await postImport(editBuf, cookies, 'caseEdit-commit');
    expect(commit.status).toBe(200);
    expect(commit.body.updated).toBe(1);

    const after = await db.one(
      `SELECT address_line_1 FROM vcombo.addresses WHERE source_id = $1 AND deactivated_at IS NULL`,
      [acme.source_id],
    );
    expect(after.address_line_1).toBe('123 MAIN ST');
  });

  test('case-only edit on a parent field counts as a real change (not a noop)', async () => {
    // Same case-sensitivity contract as the child-side fix, but at the
    // parent level: `diffParent` defaults to case-insensitive comparison
    // (preserves the flat single-entity behavior), so the combined importer
    // opts in to caseSensitive: true. A rename 'Acme Supplies LLC' ->
    // 'acme supplies llc' must persist instead of silently noop-skipping.
    const acme = await db.one(
      `SELECT id, name FROM vcombo.vendors WHERE id IN (SELECT id FROM vcombo.vendors WHERE name ILIKE 'acme%' LIMIT 1)`,
    );
    const originalName = acme.name;
    const recased = originalName.toLowerCase();
    expect(recased).not.toBe(originalName);

    const buf = await buildWorkbook(
      [
        blankVendor({ id: acme.id, name: recased, status: 'active' }),
      ],
      [],
    );

    const preview = await postImport(buf, cookies, 'parentCase-preview', { preview: true });
    expect(preview.status).toBe(200);
    expect(preview.body.vendors).toEqual({ inserts: 0, updates: 1, noops: 0, omitted: 0 });

    const commit = await postImport(buf, cookies, 'parentCase-commit');
    expect(commit.status).toBe(200);
    expect(commit.body.updated).toBe(1);

    const after = await db.one(`SELECT name FROM vcombo.vendors WHERE id = $1`, [acme.id]);
    expect(after.name).toBe(recased);

    // Restore the original casing so subsequent tests in the file see the
    // state they expect.
    const restoreBuf = await buildWorkbook(
      [blankVendor({ id: acme.id, name: originalName, status: 'active' })],
      [],
    );
    await postImport(restoreBuf, cookies, 'parentCase-restore');
  });

  test('workbook with more than 2 sheets is rejected with a format error', async () => {
    const buf = await buildWorkbook(
      [blankVendor({ name: 'Should Not Import', status: 'active' })],
      [],
      { extraSheets: 5 },
    );

    const res = await postImport(buf, cookies, 'tooManySheets');
    expect(res.status).toBe(422);
    expect(res.body.errors).toBeDefined();
    expect(res.body.errors[0].message).toMatch(/flat 2-sheet/);
  });
});
