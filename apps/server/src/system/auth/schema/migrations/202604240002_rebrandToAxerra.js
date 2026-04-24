/**
 * @file Migration: rebrand root tenant vimber → axerra (schema, tenant_code, company)
 * @module auth/schema/migrations/202604240002_rebrandToAxerra
 *
 * One-time rebrand migration. Renames the `vimber` tenant schema to `axerra`,
 * updates the admin.tenants row (tenant_code, schema_name, company). Idempotent:
 * no-op if schema already `axerra` or no VIMBER tenant row exists.
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import { defineMigration } from '../../../../db/migrations/defineMigration.js';

export default defineMigration({
  id: '202604240002-rebrand-to-axerra',
  description: 'Rebrand root tenant vimber → axerra (schema, tenant_code, company)',

  async up({ schema, db }) {
    if (schema !== 'admin') return;

    const oldSchemaExists = await db.oneOrNone(
      `SELECT 1 FROM information_schema.schemata WHERE schema_name = 'vimber'`,
    );
    if (oldSchemaExists) {
      await db.none('ALTER SCHEMA vimber RENAME TO axerra');
    }

    await db.none(
      `UPDATE admin.tenants
          SET tenant_code = 'AXERRA',
              schema_name = 'axerra',
              company = 'Axerra LLC'
        WHERE tenant_code = 'VIMBER'`,
    );
  },
});
