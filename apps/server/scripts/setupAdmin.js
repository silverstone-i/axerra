/**
 * @file Bootstrap admin schema and Axerra tenant — creates tables and seeds root tenant + super user
 * @module server/scripts/setupAdmin
 *
 * Usage: npm -w apps/server run setupAdmin:dev
 *
 * Steps:
 *   1. Creates admin schema + runs admin-scope migrations (tenants, portal_users, etc.)
 *   2. Provisions the Axerra tenant schema (CREATE SCHEMA + tenant-scope migrations + RBAC)
 *   3. Seeds the root super user employee in the Axerra tenant schema and links it to admin.portal_users
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

async function main() {
  const { DB } = await import('pg-schemata');
  const { default: repositories } = await import('../src/db/repositories.js');
  const { default: logger } = await import('../src/lib/logger.js');
  const { getDatabaseUrl } = await import('../src/lib/envValidator.js');

  const DATABASE_URL = getDatabaseUrl();
  logger.info(`Setting up admin schema on ${process.env.NODE_ENV || 'development'} database...`);

  // Initialize DB if not already done
  if (!DB.db) {
    DB.init(DATABASE_URL, repositories, logger);
  }

  const db = DB.db;

  // Create admin schema if it doesn't exist
  await db.none('CREATE SCHEMA IF NOT EXISTS admin');
  logger.info('Admin schema ensured.');

  // ── Migrate old-format migration history table if present ──────────
  // Previous setupAdmin used PK (id, schema_name); createMigrator uses
  // PK (schema_name, module_name, migration_id). Detect and drop the old
  // table so the migrator can recreate it with the correct structure.
  await db.none('CREATE SCHEMA IF NOT EXISTS pgschemata');
  const hasOldFormat = await db.oneOrNone(`
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'pgschemata' AND table_name = 'migrations' AND column_name = 'id'
      AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'pgschemata' AND table_name = 'migrations' AND column_name = 'module_name'
      )
  `);
  if (hasOldFormat) {
    logger.info('Detected old-format migration history table — dropping for recreation...');
    await db.none('DROP TABLE IF EXISTS pgschemata.migrations');
  }

  // ── Run admin-scope migrations via migrator ────────────────────────
  const { default: migrator } = await import('../src/db/migrations/index.js');
  const { adminModules: adminModuleNames } = await import('../src/db/migrations/moduleScopes.js');

  const adminResult = await migrator.run({
    schema: 'admin',
    modules: adminModuleNames,
    dryRun: false,
    advisoryLock: 424242,
  });

  for (const mod of adminResult.modules) {
    if (mod.applied > 0) {
      logger.info(`Admin migration module "${mod.module}": ${mod.applied} migration(s) applied`);
    }
  }
  logger.info('Admin migrations complete.');

  // ── Seed admin reference data ─────────────────────────────────────
  const { seedCountries } = await import('../src/system/auth/services/countriesSeeder.js');
  await seedCountries(db, DB.pgp);

  // ── Provision Axerra tenant schema ────────────────────────────────
  const rootTenantCode = process.env.ROOT_TENANT_CODE || 'AXERRA';
  const tenantSchema = rootTenantCode.toLowerCase();

  logger.info(`Provisioning Axerra tenant schema "${tenantSchema}"...`);

  const { provisionTenant } = await import('../src/services/tenantProvisioning.js');
  await provisionTenant({ schemaName: tenantSchema, tenantCode: rootTenantCode });

  logger.info(`Axerra tenant schema "${tenantSchema}" provisioned.`);

  // ── Seed Axerra self-company record ─────────────────────────────
  const rootCompany = process.env.ROOT_COMPANY || 'Axerra LLC';
  const tenant = await db.oneOrNone('SELECT id FROM admin.tenants WHERE tenant_code = $1', [rootTenantCode]);

  if (tenant) {
    const s = DB.pgp.as.name(tenantSchema);
    const existingCompany = await db.oneOrNone(`SELECT id FROM ${s}.companies WHERE code = $1 AND deactivated_at IS NULL`, [rootTenantCode]);

    if (!existingCompany) {
      await db.tx(async (t) => {
        const comp = await t.one(`INSERT INTO ${s}.companies (tenant_id, code, name) VALUES ($1, $2, $3) RETURNING id`, [
          tenant.id,
          rootTenantCode,
          rootCompany,
        ]);

        const source = await t.one(`INSERT INTO ${s}.sources (tenant_id, table_id, source_type, label) VALUES ($1, $2, $3, $4) RETURNING id`, [
          tenant.id,
          comp.id,
          'company',
          rootCompany,
        ]);

        await t.none(`UPDATE ${s}.companies SET source_id = $1 WHERE id = $2`, [source.id, comp.id]);
      });
      logger.info(`Axerra self-company seeded (code=${rootTenantCode}, name=${rootCompany}).`);
    } else {
      // Backfill missing source record for existing companies
      const needsSource = await db.oneOrNone(
        `SELECT id, tenant_id FROM ${s}.companies WHERE code = $1 AND source_id IS NULL AND deactivated_at IS NULL`,
        [rootTenantCode],
      );

      if (needsSource) {
        await db.tx(async (t) => {
          const source = await t.one(
            `INSERT INTO ${s}.sources (tenant_id, table_id, source_type, label) VALUES ($1, $2, $3, $4) RETURNING id`,
            [needsSource.tenant_id, needsSource.id, 'company', rootCompany],
          );
          await t.none(`UPDATE ${s}.companies SET source_id = $1 WHERE id = $2`, [source.id, needsSource.id]);
        });
        logger.info(`Backfilled source record for self-company (code=${rootTenantCode}).`);
      } else {
        logger.info('Axerra self-company already exists with source, skipping.');
      }
    }
  }

  // ── Link root super user to an employee record ──────────────
  const { seedRootEntity } = await import('../src/services/seedRootEntity.js');
  await seedRootEntity({
    db,
    pgp: DB.pgp,
    logger,
    tenantSchema,
    rootEmail: process.env.ROOT_EMAIL,
    includeLoginEmail: true,
  });

  logger.info('Admin setup complete.');
  await db.$pool.end();
}

// Wrap the entry in the request-context ALS so any pg-schemata write inside
// `main()` resolves to a known actor (null at boot — there's no logged-in
// user). Without this wrapper the audit resolver still returns null, so this
// is purely defensive: it lets nested code call `runWithContext` again with
// a resolved actor (e.g. the root admin id) once one is known.
const { registerAuditResolver } = await import('../src/lib/registerAuditResolver.js');
const { runWithContext } = await import('../src/lib/requestContext.js');
registerAuditResolver();

runWithContext(
  {
    userId: null,
    schema: 'admin',
    tenantId: null,
    // Read from env so this stays aligned with whatever the rest of the
    // codebase resolves as the root tenant code (authRedis uses the same
    // env). Falls back to null when unset rather than guessing a literal.
    tenantCode: process.env.ROOT_TENANT_CODE || null,
  },
  () =>
    main().catch((err) => {
      console.error('Admin setup failed:', err);
      process.exit(1);
  }),
);
