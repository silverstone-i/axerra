/**
 * @file Countries seeder — populates admin.countries from @axerra/shared
 * @module auth/services/countriesSeeder
 *
 * Called once after admin migrations during setupAdmin. Idempotent — uses
 * INSERT … ON CONFLICT (code) DO UPDATE so re-runs reconcile drift in the
 * canonical COUNTRIES list (e.g. a renamed country or a tweaked dial_code).
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import { COUNTRIES } from '@axerra/shared';
import logger from '../../../lib/logger.js';

/**
 * Seed admin.countries from the shared COUNTRIES list.
 *
 * @param {object} dbInstance pg-promise database connection or transaction
 * @param {object} pgp pg-promise helpers
 */
export async function seedCountries(dbInstance, pgp) {
  if (!COUNTRIES?.length) {
    logger.warn('seedCountries: COUNTRIES list is empty, skipping');
    return;
  }

  const cs = new pgp.helpers.ColumnSet(
    ['code', 'name', 'dial_code', 'placeholder'],
    { table: { table: 'countries', schema: 'admin' } },
  );
  const rows = COUNTRIES.map((c) => ({
    code: c.code,
    name: c.name,
    dial_code: c.dial_code || null,
    placeholder: c.placeholder || null,
  }));

  const sql = `${pgp.helpers.insert(rows, cs)}
    ON CONFLICT (code) DO UPDATE
    SET name = EXCLUDED.name,
        dial_code = EXCLUDED.dial_code,
        placeholder = EXCLUDED.placeholder`;

  await dbInstance.none(sql);
  logger.info(`Seeded admin.countries with ${rows.length} entries.`);
}
