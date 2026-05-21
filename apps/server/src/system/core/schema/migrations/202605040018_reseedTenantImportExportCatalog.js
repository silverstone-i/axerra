/**
 * @file Migration: re-seed policy_catalog to pick up tenants::tenants::import/export rows
 * @module core/schema/migrations/202605040018_reseedTenantImportExportCatalog
 *
 * PR #65 added two new policy_catalog rows (tenants::tenants::import and
 * tenants::tenants::export) when re-enabling the tenants /import-xls and
 * /export-xls routes. seedPolicyCatalog only runs during provisioning,
 * so existing root-tenant schemas (Axerra) won't pick those rows up
 * without this reseed pass. Throwaway — safe to delete after running once.
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { defineMigration } from '../../../../db/migrations/defineMigration.js';
import { seedPolicyCatalog } from '../../services/policyCatalogSeeder.js';

export default defineMigration({
  id: '202605040018-reseed-tenant-import-export-catalog',
  description: 'Re-seed policy_catalog with tenants::tenants::import and ::export entries',

  async up({ schema, db, pgp }) {
    if (schema === 'admin') return;

    const tenant = await db.oneOrNone('SELECT tenant_code FROM admin.tenants WHERE schema_name = $1', [schema]);
    const isRootTenant = tenant?.tenant_code === process.env.ROOT_TENANT_CODE;

    await seedPolicyCatalog(db, pgp, schema, isRootTenant);
  },
});
