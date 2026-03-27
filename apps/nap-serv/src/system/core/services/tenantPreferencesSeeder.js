/**
 * @file Tenant preferences seeder — seeds default preferences row per tenant
 * @module core/services/tenantPreferencesSeeder
 *
 * Called during tenant provisioning. Idempotent — safe to re-run.
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
 */

import logger from '../../../lib/logger.js';

/**
 * Seed a single tenant_preferences row with defaults.
 *
 * @param {object} dbInstance pg-promise database connection or transaction
 * @param {object} pgp pg-promise helpers
 * @param {string} schemaName Tenant schema name
 * @param {string} tenantId Tenant UUID
 */
export async function seedTenantPreferences(dbInstance, pgp, schemaName, tenantId) {
  const s = pgp.as.name(schemaName);

  const existing = await dbInstance.oneOrNone(`SELECT id FROM ${s}.tenant_preferences LIMIT 1`);

  if (!existing) {
    await dbInstance.none(
      `INSERT INTO ${s}.tenant_preferences (tenant_id, default_page_size) VALUES ($1, 25)`,
      [tenantId],
    );
    logger.info(`Tenant preferences seeded in ${schemaName}`);
  }
}
