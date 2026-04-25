/**
 * @file CLI script to truncate + reseed policy_catalog for a given schema
 * @module server/scripts/db/reseedPolicyCatalog
 *
 * Usage:
 *   cross-env NODE_ENV=development node scripts/db/reseedPolicyCatalog.js --schema srh
 *   cross-env NODE_ENV=development node scripts/db/reseedPolicyCatalog.js --schema axerra --root
 *
 * Copyright (c) 2025 Axerra LLC. All rights reserved.
 */

import { resolve, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { config as dotenvConfig } from 'dotenv';
import { parseArgs } from 'node:util';

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

const { values } = parseArgs({
  options: {
    schema: { type: 'string' },
    root: { type: 'boolean', default: false },
  },
  strict: true,
});

const schemaName = values['schema'];
const isRootTenant = values['root'];

if (!schemaName) {
  console.error('Usage: reseedPolicyCatalog.js --schema <name> [--root]');
  process.exit(1);
}

async function main() {
  const { DB } = await import('pg-schemata');
  const { default: repositories } = await import('../../apps/server/src/db/repositories.js');
  const { default: logger } = await import('../../apps/server/src/lib/logger.js');
  const { getDatabaseUrl } = await import('../../apps/server/src/lib/envValidator.js');

  const DATABASE_URL = getDatabaseUrl();

  if (!DB.db) {
    DB.init(DATABASE_URL, repositories, logger);
  }

  const db = DB.db;
  const pgp = DB.pgp;
  const s = pgp.as.name(schemaName);

  // 1. Truncate policy_catalog
  logger.info(`Truncating ${schemaName}.policy_catalog...`);
  await db.none(`TRUNCATE TABLE ${s}.policy_catalog`);

  // 2. Reseed from code
  const { seedPolicyCatalog } = await import('../../apps/server/src/system/core/services/policyCatalogSeeder.js');
  await seedPolicyCatalog(db, pgp, schemaName, isRootTenant);

  logger.info(`Policy catalog reseeded for ${schemaName}.`);
  await db.$pool.end();
}

main().catch((err) => {
  console.error('Policy catalog reseed failed:', err);
  process.exit(1);
});
