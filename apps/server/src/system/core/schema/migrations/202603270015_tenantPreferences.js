/**
 * @file Migration: create tenant_preferences table in tenant schemas
 * @module core/schema/migrations/202603270015_tenantPreferences
 *
 * Creates: tenant_preferences (one row per tenant for UI preferences)
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import { defineMigration } from '../../../../db/migrations/defineMigration.js';
import { isTableModel } from '../../../../db/migrations/modelPlanner.js';

export default defineMigration({
  id: '202603270015-tenant-preferences',
  description: 'Create tenant_preferences table',

  async up({ schema, models, db, pgp }) {
    if (schema === 'admin') return;

    const model = Object.values(models).find(
      (m) => isTableModel(m) && m.schema?.table === 'tenant_preferences',
    );
    if (!model) return;

    await model.createTable();

    // Seed a default row for existing tenants
    const s = pgp.as.name(schema);
    const tenant = await db.oneOrNone('SELECT id FROM admin.tenants WHERE schema_name = $1', [schema]);
    if (tenant) {
      const existing = await db.oneOrNone(`SELECT id FROM ${s}.tenant_preferences LIMIT 1`);
      if (!existing) {
        await db.none(`INSERT INTO ${s}.tenant_preferences (tenant_id, default_page_size) VALUES ($1, 25)`, [tenant.id]);
      }
    }
  },

  async down({ schema, db, pgp }) {
    if (schema === 'admin') return;
    const s = pgp.as.name(schema);
    await db.none(`DROP TABLE IF EXISTS ${s}.tenant_preferences`);
  },
});
