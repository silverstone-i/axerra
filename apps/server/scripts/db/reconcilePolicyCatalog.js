/**
 * @file CLI script — reconcile policy_catalog against CATALOG_ENTRIES across tenant schemas
 * @module server/scripts/db/reconcilePolicyCatalog
 *
 * Diff/upsert/delete reconciler. Replaces the older truncate-and-reseed
 * utility — safe to run repeatedly without disturbing stable row IDs.
 *
 * Usage:
 *   # Reconcile a single schema; --root flag overrides admin.tenants lookup.
 *   npx cross-env NODE_ENV=development node apps/server/scripts/db/reconcilePolicyCatalog.js --schema srh
 *   npx cross-env NODE_ENV=development node apps/server/scripts/db/reconcilePolicyCatalog.js --schema axerra --root
 *
 *   # Reconcile every non-admin tenant schema known to admin.tenants.
 *   npx cross-env NODE_ENV=development node apps/server/scripts/db/reconcilePolicyCatalog.js
 *
 *   # Show diffs without applying writes.
 *   npx cross-env NODE_ENV=development node apps/server/scripts/db/reconcilePolicyCatalog.js --dry-run
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { resolve, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { config as dotenvConfig } from 'dotenv';
import { parseArgs } from 'node:util';

let dir = process.cwd();
while (dir !== dirname(dir)) {
  const envPath = resolve(dir, '.env');
  if (existsSync(envPath)) {
    dotenvConfig({ path: envPath });
    break;
  }
  dir = dirname(dir);
}

const { values } = parseArgs({
  options: {
    schema: { type: 'string' },
    root: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
  },
  strict: true,
});

const explicitSchema = values['schema'];
const explicitRoot = values['root'];
const dryRun = values['dry-run'];

async function main() {
  const { DB } = await import('pg-schemata');
  const { default: repositories } = await import('../../src/db/repositories.js');
  const { default: logger } = await import('../../src/lib/logger.js');
  const { getDatabaseUrl } = await import('../../src/lib/envValidator.js');
  const { reconcilePolicyCatalog } = await import('../../src/system/core/services/policyCatalogReconciler.js');

  const ROOT_TENANT_CODE = (process.env.ROOT_TENANT_CODE || 'AXERRA').toUpperCase();
  const DATABASE_URL = getDatabaseUrl();
  if (!DB.db) DB.init(DATABASE_URL, repositories, logger);

  const db = DB.db;
  const pgp = DB.pgp;

  let targets;
  if (explicitSchema) {
    const tenant = await db.oneOrNone('SELECT tenant_code FROM admin.tenants WHERE schema_name = $1', [explicitSchema]);
    const isRootTenant = explicitRoot || (tenant?.tenant_code?.toUpperCase() === ROOT_TENANT_CODE);
    targets = [{ schemaName: explicitSchema, isRootTenant }];
  } else {
    const rows = await db.any(
      `SELECT schema_name, tenant_code FROM admin.tenants
        WHERE schema_name IS NOT NULL AND schema_name <> 'admin'
        ORDER BY schema_name`,
    );
    targets = rows.map((r) => ({
      schemaName: r.schema_name,
      isRootTenant: r.tenant_code?.toUpperCase() === ROOT_TENANT_CODE,
    }));
  }

  if (targets.length === 0) {
    logger.warn('No tenant schemas to reconcile.');
    await db.$pool.end();
    return;
  }

  const totals = { inserted: 0, updated: 0, removed: 0, unchanged: 0 };
  for (const { schemaName, isRootTenant } of targets) {
    const summary = await reconcilePolicyCatalog(db, pgp, schemaName, { isRootTenant, dryRun });
    for (const k of Object.keys(totals)) totals[k] += summary[k];
  }

  const tag = dryRun ? '[dry-run] ' : '';
  logger.info(
    `${tag}Reconcile complete across ${targets.length} schema(s): ` +
      `+${totals.inserted} inserted, ~${totals.updated} updated, ` +
      `-${totals.removed} removed, =${totals.unchanged} unchanged`,
  );
  await db.$pool.end();
}

main().catch((err) => {
  console.error('Policy catalog reconcile failed:', err);
  process.exit(1);
});
