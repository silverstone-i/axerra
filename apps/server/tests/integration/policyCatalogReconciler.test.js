/**
 * @file Integration tests for policyCatalogReconciler
 * @module tests/integration/policyCatalogReconciler
 *
 * Provisions a dedicated non-root tenant schema and exercises the
 * diff/upsert/delete reconciler against manipulated states.
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest';
import { bootstrapAdmin, cleanupTestDb, DB } from '../helpers/testDb.js';
import { CATALOG_ENTRIES } from '../../src/system/core/services/policyCatalogSeeder.js';
import { reconcilePolicyCatalog } from '../../src/system/core/services/policyCatalogReconciler.js';
import logger from '../../src/lib/logger.js';

const TEST_SCHEMA = 'pcrtest';
const TEST_TENANT_CODE = 'PCRT';

let db;
let pgp;

beforeAll(async () => {
  await cleanupTestDb();
  db = await bootstrapAdmin();
  pgp = DB.pgp;

  // Insert tenant row (non-root) and provision the schema.
  await db.none(
    `INSERT INTO admin.tenants (tenant_code, schema_name, company, status, tier)
     VALUES ($1, $2, 'PCR Test Co', 'active', 'growth')
     ON CONFLICT (tenant_code) DO UPDATE SET schema_name = EXCLUDED.schema_name`,
    [TEST_TENANT_CODE, TEST_SCHEMA],
  );

  const { provisionTenant } = await import('../../src/services/tenantProvisioning.js');
  await provisionTenant({ schemaName: TEST_SCHEMA, tenantCode: TEST_TENANT_CODE });
}, 60000);

afterAll(async () => {
  if (db) {
    await db.none(`DROP SCHEMA IF EXISTS ${pgp.as.name(TEST_SCHEMA)} CASCADE`);
    await db.none('DELETE FROM admin.tenants WHERE tenant_code = $1', [TEST_TENANT_CODE]);
  }
  await cleanupTestDb();
}, 30000);

const nonRootEntries = CATALOG_ENTRIES.filter((e) => e.module !== 'tenants');

describe('policyCatalogReconciler', () => {
  test('provisioned schema starts with all non-root entries and zero pending changes', async () => {
    const summary = await reconcilePolicyCatalog(db, pgp, TEST_SCHEMA, { isRootTenant: false });
    expect(summary.inserted).toBe(0);
    expect(summary.updated).toBe(0);
    expect(summary.removed).toBe(0);
    expect(summary.unchanged).toBe(nonRootEntries.length);
  });

  test('non-root filter excludes module=tenants entries', async () => {
    const tenantsRows = await db.any(
      `SELECT 1 FROM ${pgp.as.name(TEST_SCHEMA)}.policy_catalog WHERE module = 'tenants'`,
    );
    expect(tenantsRows).toEqual([]);
  });

  test('insert path: emptied catalog gets fully repopulated', async () => {
    await db.none(`DELETE FROM ${pgp.as.name(TEST_SCHEMA)}.policy_catalog`);
    const summary = await reconcilePolicyCatalog(db, pgp, TEST_SCHEMA, { isRootTenant: false });
    expect(summary.inserted).toBe(nonRootEntries.length);
    expect(summary.updated).toBe(0);
    expect(summary.removed).toBe(0);
    expect(summary.unchanged).toBe(0);

    const count = await db.one(
      `SELECT COUNT(*)::int AS n FROM ${pgp.as.name(TEST_SCHEMA)}.policy_catalog`,
    );
    expect(count.n).toBe(nonRootEntries.length);
  });

  test('update path: drifted label and sort_order are restored', async () => {
    await db.none(
      `UPDATE ${pgp.as.name(TEST_SCHEMA)}.policy_catalog
          SET label = 'DRIFTED', sort_order = 99999
        WHERE module = 'core' AND router = 'vendors' AND action IS NULL`,
    );
    const summary = await reconcilePolicyCatalog(db, pgp, TEST_SCHEMA, { isRootTenant: false });
    expect(summary.updated).toBe(1);
    expect(summary.inserted).toBe(0);
    expect(summary.removed).toBe(0);

    const row = await db.one(
      `SELECT label, sort_order FROM ${pgp.as.name(TEST_SCHEMA)}.policy_catalog
        WHERE module = 'core' AND router = 'vendors' AND action IS NULL`,
    );
    const expected = CATALOG_ENTRIES.find((e) => e.module === 'core' && e.router === 'vendors' && e.action == null);
    expect(row.label).toBe(expected.label);
    expect(row.sort_order).toBe(expected.sort_order);
  });

  test('noop path: a second reconcile after the first reports all unchanged', async () => {
    const summary = await reconcilePolicyCatalog(db, pgp, TEST_SCHEMA, { isRootTenant: false });
    expect(summary.inserted).toBe(0);
    expect(summary.updated).toBe(0);
    expect(summary.removed).toBe(0);
    expect(summary.unchanged).toBe(nonRootEntries.length);
  });

  test('delete path: synthetic row not in CATALOG_ENTRIES is removed', async () => {
    await db.none(
      `INSERT INTO ${pgp.as.name(TEST_SCHEMA)}.policy_catalog (module, router, action, label, sort_order)
       VALUES ('zzz_synthetic', 'phantom', NULL, 'Phantom Module', 99999)`,
    );
    const summary = await reconcilePolicyCatalog(db, pgp, TEST_SCHEMA, { isRootTenant: false });
    expect(summary.removed).toBe(1);
    expect(summary.inserted).toBe(0);
    expect(summary.updated).toBe(0);

    const row = await db.oneOrNone(
      `SELECT 1 FROM ${pgp.as.name(TEST_SCHEMA)}.policy_catalog
        WHERE module = 'zzz_synthetic' AND router = 'phantom' AND action IS NULL`,
    );
    expect(row).toBeNull();
  });

  test('delete with dependent grants logs a warning including the grant count', async () => {
    await db.none(
      `INSERT INTO ${pgp.as.name(TEST_SCHEMA)}.policy_catalog (module, router, action, label, sort_order)
       VALUES ('zzz_synthetic', 'phantom', NULL, 'Phantom Module', 99999)`,
    );
    const role = await db.one(
      `SELECT id FROM ${pgp.as.name(TEST_SCHEMA)}.roles ORDER BY created_at LIMIT 1`,
    );
    await db.none(
      `INSERT INTO ${pgp.as.name(TEST_SCHEMA)}.policies (role_id, module, router, action, level)
       VALUES ($1, 'zzz_synthetic', 'phantom', NULL, 'view')`,
      [role.id],
    );

    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    try {
      const summary = await reconcilePolicyCatalog(db, pgp, TEST_SCHEMA, { isRootTenant: false });
      expect(summary.removed).toBe(1);

      const messages = warnSpy.mock.calls.map((call) => String(call[0]));
      const orphanWarn = messages.find((m) => m.includes('zzz_synthetic') && m.includes('orphaned'));
      expect(orphanWarn).toBeDefined();
      expect(orphanWarn).toMatch(/1 orphaned/);
    } finally {
      warnSpy.mockRestore();
    }

    // Clean up the orphan grant we created.
    await db.none(
      `DELETE FROM ${pgp.as.name(TEST_SCHEMA)}.policies
        WHERE module = 'zzz_synthetic' AND router = 'phantom' AND action IS NULL`,
    );
  });

  test('dry-run: reports planned changes without writing', async () => {
    await db.none(
      `INSERT INTO ${pgp.as.name(TEST_SCHEMA)}.policy_catalog (module, router, action, label, sort_order)
       VALUES ('zzz_synthetic', 'phantom', NULL, 'Phantom Module', 99999)`,
    );
    const summary = await reconcilePolicyCatalog(db, pgp, TEST_SCHEMA, { isRootTenant: false, dryRun: true });
    expect(summary.removed).toBe(1);

    const stillThere = await db.oneOrNone(
      `SELECT 1 FROM ${pgp.as.name(TEST_SCHEMA)}.policy_catalog
        WHERE module = 'zzz_synthetic' AND router = 'phantom' AND action IS NULL`,
    );
    expect(stillThere).not.toBeNull();

    // Apply for real to clean up.
    await reconcilePolicyCatalog(db, pgp, TEST_SCHEMA, { isRootTenant: false });
  });
});
