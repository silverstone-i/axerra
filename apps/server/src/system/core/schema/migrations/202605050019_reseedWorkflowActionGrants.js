/**
 * @file Migration: re-seed policy_catalog and system-role policies for new workflow actions
 * @module core/schema/migrations/202605050019_reseedWorkflowActionGrants
 *
 * PR #69 added six action-level catalog rows (policy_required: true) for
 * journal-entries::post / reverse, posting-queues::retry, ar-invoices::approve,
 * vendor-contacts::swap-login-email, and budgets::new-version. Because the
 * RBAC middleware now treats those addresses as exact-match, existing tenant
 * schemas need both the new catalog rows AND explicit admin / super_user /
 * support policies — otherwise admins will start hitting 403 on those
 * endpoints after deploy. seedPolicyCatalog and seedSystemRoles only run
 * during provisioning, so this throwaway pass backfills both. Both seeders
 * are idempotent. Safe to delete after running once.
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import { defineMigration } from '../../../../db/migrations/defineMigration.js';
import { seedPolicyCatalog } from '../../services/policyCatalogSeeder.js';
import { seedSystemRoles } from '../../services/systemRoleSeeder.js';

export default defineMigration({
  id: '202605050019-reseed-workflow-action-grants',
  description: 'Re-seed policy_catalog and system-role policies for new workflow router-actions',

  async up({ schema, db, pgp }) {
    if (schema === 'admin') return;

    const tenant = await db.oneOrNone('SELECT tenant_code FROM admin.tenants WHERE schema_name = $1', [schema]);
    if (!tenant) return;

    const isRootTenant = tenant.tenant_code === process.env.ROOT_TENANT_CODE;

    await seedPolicyCatalog(db, pgp, schema, isRootTenant);
    await seedSystemRoles(db, pgp, schema, tenant.tenant_code, isRootTenant);
  },
});
