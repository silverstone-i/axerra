/**
 * @file Migration: re-seed policy_catalog to pick up tenant-preferences entry
 * @module core/schema/migrations/202603270016_reseedPolicyCatalog
 *
 * Throwaway migration — safe to delete after running once.
 *
 * Copyright (c) 2025 – present Vimber LLC. All rights reserved.
 */

import { defineMigration } from '../../../../db/migrations/defineMigration.js';
import { seedPolicyCatalog } from '../../services/policyCatalogSeeder.js';

export default defineMigration({
  id: '202603270016-reseed-policy-catalog',
  description: 'Re-seed policy_catalog with tenant-preferences entry',

  async up({ schema, db, pgp }) {
    if (schema === 'admin') return;

    const tenant = await db.oneOrNone('SELECT tenant_code FROM admin.tenants WHERE schema_name = $1', [schema]);
    const isRootTenant = tenant?.tenant_code === process.env.ROOT_TENANT_CODE;

    await seedPolicyCatalog(db, pgp, schema, isRootTenant);
  },
});
