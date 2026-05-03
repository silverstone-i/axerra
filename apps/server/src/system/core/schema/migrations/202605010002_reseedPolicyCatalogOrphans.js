/**
 * @file Migration: re-seed policy_catalog with orphan-cleanup catalog entries
 * @module core/schema/migrations/202605010002_reseedPolicyCatalogOrphans
 *
 * Adds the new specific action codes for orphan-source cleanup
 * (core::sources::find_orphans / cleanup_orphans) and the Axerra-only
 * orphan portal_users router (tenants::orphan_portal_users::*).
 *
 * Throwaway migration — safe to delete after running once.
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import { defineMigration } from '../../../../db/migrations/defineMigration.js';
import { seedPolicyCatalog } from '../../services/policyCatalogSeeder.js';

export default defineMigration({
  id: '202605010002-reseed-policy-catalog-orphans',
  description: 'Re-seed policy_catalog with orphan-source and orphan-portal-user entries',

  async up({ schema, db, pgp }) {
    if (schema === 'admin') return;

    const tenant = await db.oneOrNone('SELECT tenant_code FROM admin.tenants WHERE schema_name = $1', [schema]);
    const rootTenantCode = (process.env.ROOT_TENANT_CODE || 'axerra').toLowerCase();
    const isRootTenant = tenant?.tenant_code?.toLowerCase() === rootTenantCode;

    await seedPolicyCatalog(db, pgp, schema, isRootTenant);
  },
});
