/**
 * @file Test database helper — provides isolated DB setup for integration tests
 * @module tests/helpers/testDb
 *
 * Initializes the test database, runs bootstrap migration, and provides
 * cleanup. Tests must use NODE_ENV=test which resolves to axerra_test database.
 *
 * Performance: admin schema + tables are created ONCE per test-suite run
 * (via `adminReady` flag). Between test files only tenant schemas are
 * dropped and admin data is reset to the root-only bootstrap state,
 * avoiding expensive repeated DDL operations.
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import { resolve, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { config as dotenvConfig } from 'dotenv';

// Walk up to find .env
let dir = process.cwd();
while (dir !== dirname(dir)) {
  const envPath = resolve(dir, '.env');
  if (existsSync(envPath)) {
    dotenvConfig({ path: envPath });
    break;
  }
  dir = dirname(dir);
}

// Set test env vars for auth
process.env.ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'test-access-secret-32chars-long!!';
process.env.REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'test-refresh-secret-32chars-long!';
process.env.ROOT_EMAIL = process.env.ROOT_EMAIL || 'admin@axerra.io';
process.env.ROOT_PASSWORD = process.env.ROOT_PASSWORD || 'TestPass123!';
process.env.ROOT_TENANT_CODE = process.env.ROOT_TENANT_CODE || 'AXERRA';
process.env.ROOT_COMPANY = process.env.ROOT_COMPANY || 'Axerra LLC';
process.env.BCRYPT_ROUNDS = '4'; // Fast for tests

import { DB } from 'pg-schemata';
import { getDatabaseUrl } from '../../src/lib/envValidator.js';
import repositories from '../../src/db/repositories.js';
import logger from '../../src/lib/logger.js';

let initialized = false;
let adminReady = false;
let _cachedPasswordHash = null;

/**
 * Initialize the test database connection.
 */
export async function initTestDb() {
  if (initialized) return DB.db;

  const DATABASE_URL = getDatabaseUrl();
  if (!DB.db) {
    DB.init(DATABASE_URL, repositories, logger);
  }
  initialized = true;
  return DB.db;
}

// ── Internal helpers ──────────────────────────────────────────────────

/**
 * Returns a cached bcrypt hash of the root password to avoid re-hashing
 * on every test-file boundary.
 */
async function getCachedPasswordHash() {
  if (!_cachedPasswordHash) {
    const { default: bcrypt } = await import('bcrypt');
    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '4', 10);
    _cachedPasswordHash = await bcrypt.hash(process.env.ROOT_PASSWORD || 'TestPass123!', rounds);
  }
  return _cachedPasswordHash;
}

/**
 * Idempotently insert the root tenant row into admin.tenants. Used both
 * before provisionTenant (so its numberingConfig/tenantPreferences seeders
 * find the tenant by schema_name) and inside reseedAdmin.
 */
async function ensureRootTenantRow(db) {
  const rootTenantCode = process.env.ROOT_TENANT_CODE || 'AXERRA';
  const rootCompany = process.env.ROOT_COMPANY || 'Axerra LLC';
  const rootSchema = rootTenantCode.toLowerCase();

  const existingTenant = await db.oneOrNone('SELECT id FROM admin.tenants WHERE tenant_code = $1', [rootTenantCode]);
  if (!existingTenant) {
    await db.none(
      `INSERT INTO admin.tenants (tenant_code, company, schema_name, status, tier, allowed_modules)
       VALUES ($1, $2, $3, 'active', 'enterprise', $4)`,
      [rootTenantCode, rootCompany, rootSchema, JSON.stringify([])],
    );
  }
}

/**
 * Re-seed the root tenant and super user into an existing (but empty)
 * admin schema. Called by bootstrapAdmin when adminReady is true.
 */
async function reseedAdmin(db) {
  const rootTenantCode = process.env.ROOT_TENANT_CODE || 'AXERRA';
  const rootEmail = process.env.ROOT_EMAIL || 'admin@axerra.io';
  const passwordHash = await getCachedPasswordHash();

  await ensureRootTenantRow(db);

  const tenant = await db.one('SELECT id FROM admin.tenants WHERE tenant_code = $1', [rootTenantCode]);

  const existingUser = await db.oneOrNone(
    'SELECT id FROM admin.portal_users WHERE email = $1 AND deactivated_at IS NULL',
    [rootEmail],
  );

  let userId = existingUser?.id;
  if (!userId) {
    const inserted = await db.one(
      `INSERT INTO admin.portal_users (email, password_hash, status)
       VALUES ($1, $2, 'active')
       RETURNING id`,
      [rootEmail, passwordHash],
    );
    userId = inserted.id;
  }

  // Insert a bare binding first so seedRootEntity can update it in place
  // (preserving the unique (portal_user_id, tenant_id) row). On re-runs
  // after admin-table truncation, the binding has been wiped — recreate
  // it bare. The axerra tenant schema is preserved across runs (see
  // cleanupTestDb), so seedRootEntity will rebind to the existing
  // System Administrator employee instead of creating a duplicate.
  const existingBinding = await db.oneOrNone(
    `SELECT id FROM admin.portal_user_tenants WHERE portal_user_id = $1 AND deactivated_at IS NULL`,
    [userId],
  );
  if (!existingBinding) {
    await db.none(
      `INSERT INTO admin.portal_user_tenants
         (portal_user_id, tenant_id, status)
       VALUES ($1, $2, 'active')`,
      [userId, tenant.id],
    );
  }

  // Link the root super user to a real employee row + super_user role
  // (which seeds wildcard '::::full' caps via systemRoleSeeder on first
  // axerra provision). Required so loadPermissions returns real caps
  // for any rbac()-protected route — see issue #57.
  const { seedRootEntity } = await import('../../src/services/seedRootEntity.js');
  await seedRootEntity({
    db,
    pgp: DB.pgp,
    logger,
    tenantSchema: rootTenantCode.toLowerCase(),
    rootEmail,
    includeLoginEmail: false,
  });
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Run the admin bootstrap migration on the test database.
 *
 * On the first call (per test-suite run) this performs the full DDL:
 * create schemas, create tables via the bootstrap migration, and seed
 * root data. On subsequent calls it only re-seeds root data (the
 * schema + tables persist from the first call).
 */
export async function bootstrapAdmin() {
  const db = await initTestDb();

  if (adminReady) {
    // Admin schema + tables already exist — just ensure root data is present
    await reseedAdmin(db);
    return db;
  }

  // Create schemas
  await db.none('CREATE SCHEMA IF NOT EXISTS admin');
  await db.none('CREATE SCHEMA IF NOT EXISTS pgschemata');

  // Create migration history table (must match createMigrator.js schema)
  await db.none(`
    CREATE TABLE IF NOT EXISTS pgschemata.migrations (
      schema_name TEXT NOT NULL,
      module_name TEXT NOT NULL,
      migration_id TEXT NOT NULL,
      checksum TEXT,
      description TEXT,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (schema_name, module_name, migration_id)
    )
  `);

  // Run bootstrap migration
  const { default: bootstrapMigration } = await import(
    '../../src/system/auth/schema/migrations/202502110001_bootstrapAdmin.js'
  );

  const models = {};
  for (const [key, ModelClass] of Object.entries(repositories)) {
    models[key] = new ModelClass(db, DB.pgp, logger);
  }

  await bootstrapMigration.up({
    schema: 'admin',
    models,
    db,
    ensureExtensions: async (exts) => {
      for (const ext of exts) {
        await db.none(`CREATE EXTENSION IF NOT EXISTS "${ext}" CASCADE`);
      }
    },
  });

  // Insert the root admin.tenants row BEFORE provisionTenant runs.
  // Otherwise tenantProvisioning's numberingConfigSeeder and
  // tenantPreferencesSeeder look up admin.tenants by schema_name, find
  // nothing, and silently skip the seed — leaving the root schema
  // missing those rows on the initial bootstrap. (reseedAdmin's call
  // is idempotent, so this prepass doesn't conflict.)
  await ensureRootTenantRow(db);

  // Provision the axerra tenant schema (runs all tenant migrations and
  // seeds system roles via tenantProvisioning → seedSystemRoles). Without
  // this, loadPermissions short-circuits to empty caps on the root user's
  // bare binding, and any rbac()-enforced route 403s every test that logs
  // in as root. The schema is preserved across cleanupTestDb calls so
  // we only pay the provisioning cost once per test-suite run.
  const rootTenantCode = process.env.ROOT_TENANT_CODE || 'AXERRA';
  const tenantSchema = rootTenantCode.toLowerCase();
  const { provisionTenant } = await import('../../src/services/tenantProvisioning.js');
  await provisionTenant({ schemaName: tenantSchema, tenantCode: rootTenantCode });

  // reseedAdmin handles admin.portal_users + binding + seedRootEntity.
  // Bootstrap migration created the auth-only portal_users row; in real
  // deploys setupAdmin.js writes the binding + entity link after the
  // employee is created. Tests run reseedAdmin which now does both.
  await reseedAdmin(db);

  adminReady = true;
  return db;
}

/**
 * Clean up test database.
 *
 * Always drops any test-provisioned tenant schemas. When admin has
 * already been bootstrapped (`adminReady`) it preserves the admin
 * schema structure and only truncates data + clears non-admin
 * migration history. On the very first call (before any bootstrap)
 * it drops admin + pgschemata entirely so bootstrapAdmin() starts
 * from a clean slate.
 */
export async function cleanupTestDb() {
  const db = await initTestDb();
  const rootSchema = (process.env.ROOT_TENANT_CODE || 'AXERRA').toLowerCase();

  // Drop any test-created tenant schemas (provisioned during tests).
  // Protect: admin (auth-side), pgschemata (migrator), and the root
  // tenant schema (axerra) which we provision once in bootstrapAdmin
  // and reuse across tests for rbac role/policy seeding.
  const protectedSchemas = ['public', 'admin', 'pgschemata', 'pg_catalog', 'information_schema', 'pg_toast', rootSchema];
  const testSchemas = await db.manyOrNone(
    `SELECT schema_name FROM information_schema.schemata
     WHERE schema_name NOT IN ($1:csv)
       AND schema_name NOT LIKE 'pg_%'`,
    [protectedSchemas],
  );
  for (const row of testSchemas) {
    await db.none(`DROP SCHEMA IF EXISTS ${db.$config.pgp.as.name(row.schema_name)} CASCADE`);
  }

  if (adminReady) {
    // Admin schema persists — truncate all admin tables EXCEPT
    // admin.tenants (FK-safe via CASCADE on the truncated tables).
    // Then DELETE the non-root tenant rows from admin.tenants.
    //
    // Why: the root tenant row's UUID must stay stable across the
    // cleanup → reseed cycle. axerra.employees.tenant_id (preserved
    // because the root tenant schema persists) points at that UUID;
    // if we truncated and re-inserted admin.tenants we'd get a fresh
    // UUID and seedRootEntity's tenant-scoped reuse query would never
    // find the existing System Administrator row, leaking duplicate
    // employees on every test file.
    const rootTenantCode = process.env.ROOT_TENANT_CODE || 'AXERRA';
    const adminTables = await db.manyOrNone(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'admin' AND table_type = 'BASE TABLE' AND table_name != 'tenants'",
    );
    if (adminTables.length) {
      const tableList = adminTables.map((r) => `admin.${DB.pgp.as.name(r.table_name)}`).join(', ');
      await db.none(`TRUNCATE ${tableList} CASCADE`);
    }
    await db.none('DELETE FROM admin.tenants WHERE tenant_code != $1', [rootTenantCode]);
    await db.none(
      "DELETE FROM pgschemata.migrations WHERE schema_name NOT IN ('admin', $1)",
      [rootSchema],
    );
  } else {
    // First run: full reset (handles stale state from a previous test run)
    await db.none('DROP SCHEMA IF EXISTS admin CASCADE');
    await db.none('DROP SCHEMA IF EXISTS pgschemata CASCADE');
    await db.none(`DROP SCHEMA IF EXISTS ${db.$config.pgp.as.name(rootSchema)} CASCADE`);
  }
}

/**
 * Close the database connection pool.
 */
export async function closeTestDb() {
  if (DB.db) {
    await DB.db.$pool.end();
  }
}

export { DB };
