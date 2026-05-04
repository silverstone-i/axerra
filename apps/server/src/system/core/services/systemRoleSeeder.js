/**
 * @file System role seeder — seeds RBAC roles and policies for a tenant schema
 * @module core/services/systemRoleSeeder
 *
 * Five system roles:
 * - admin (all tenants): full access all modules
 * - vendor_contact (all tenants): self-scoped portal access for vendor contacts
 * - client (all tenants): self-scoped portal access for clients
 * - super_user (Axerra only): full access all modules, cross-tenant, impersonation
 * - support (Axerra only): full non-financial, cross-tenant, impersonation
 *
 * All system roles go through full RBAC resolution — no bypass.
 * Called during tenant provisioning (Phase 4).
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import logger from '../../../lib/logger.js';
import { CATALOG_ENTRIES } from './policyCatalogSeeder.js';

/** Modules where support role gets 'none' instead of 'full'. */
const FINANCIAL_MODULES = ['accounting', 'ap', 'ar'];

/**
 * Action addresses that require an explicit policy grant — they bypass
 * the wildcard `::::` fallback (see EXACT_MATCH_KEYS in rbac middleware).
 * Derived from the catalog: any router-action row where policy_required
 * is not explicitly false. System roles that should retain full access
 * must enumerate these explicitly.
 */
const EXACT_MATCH_POLICIES = CATALOG_ENTRIES
  .filter((e) => e.router && e.action && e.policy_required !== false)
  .map((e) => ({ module: e.module, router: e.router, action: e.action, level: 'full' }));

/** Tenants-module exact-match policies are Axerra-only. */
const EXACT_MATCH_TENANT_SCOPED = EXACT_MATCH_POLICIES.filter((p) => p.module !== 'tenants');
const EXACT_MATCH_ROOT_ONLY = EXACT_MATCH_POLICIES;

/**
 * Support role variant — same as root-only but with financial-module
 * exact-match grants stripped. Required because rbac.resolveLevel()
 * short-circuits the broader-grant fallback for exact-match keys, so
 * an explicit `ap::ap-invoices::export = full` would override the
 * module-level `ap = none` deny that defines the role's non-financial
 * scope.
 */
const EXACT_MATCH_NON_FINANCIAL = EXACT_MATCH_POLICIES.filter((p) => !FINANCIAL_MODULES.includes(p.module));

/**
 * System role definitions.
 * @param {boolean} isRootTenant Whether this is the Axerra platform tenant
 * @returns {Array<object>} Role definitions with their policies
 */
function getSystemRoleDefinitions(isRootTenant) {
  const roles = [];

  // admin — seeded in all tenants
  roles.push({
    code: 'admin',
    name: 'Administrator',
    description: 'Full access to all modules within this tenant',
    is_system: true,
    is_immutable: true,
    scope: 'all_projects',
    policies: [
      { module: '', router: null, action: null, level: 'full' },
      ...EXACT_MATCH_TENANT_SCOPED,
    ],
  });

  // vendor_contact — seeded in all tenants; portal access for vendor contact people
  roles.push({
    code: 'vendor_contact',
    name: 'Vendor Contact',
    description: 'Portal access for vendor contacts — own contact info, billing, budgets, allocated work, project schedules',
    is_system: true,
    is_immutable: true,
    scope: 'self',
    policies: [
      // Broad view access narrowed by scope='self'
      { module: '', router: null, action: null, level: 'view' },
      // No access to financials
      ...FINANCIAL_MODULES.map((mod) => ({ module: mod, router: null, action: null, level: 'none' })),
    ],
  });

  // client — seeded in all tenants; portal access for clients
  roles.push({
    code: 'client',
    name: 'Client',
    description: 'Portal access for clients — own contact info, sales contracts, invoices, unit status. No cost/profitability visibility.',
    is_system: true,
    is_immutable: true,
    scope: 'self',
    policies: [
      // Broad view access narrowed by scope='self'
      { module: '', router: null, action: null, level: 'view' },
      // No access to financials
      ...FINANCIAL_MODULES.map((mod) => ({ module: mod, router: null, action: null, level: 'none' })),
    ],
  });

  if (isRootTenant) {
    // super_user — Axerra only
    roles.push({
      code: 'super_user',
      name: 'Super User',
      description: 'Full platform access including cross-tenant management and impersonation',
      is_system: true,
      is_immutable: true,
      scope: 'all_projects',
      policies: [
        { module: '', router: null, action: null, level: 'full' },
        ...EXACT_MATCH_ROOT_ONLY,
      ],
    });

    // support — Axerra only
    roles.push({
      code: 'support',
      name: 'Support',
      description: 'Full non-financial access with cross-tenant support and impersonation',
      is_system: true,
      is_immutable: true,
      scope: 'all_projects',
      policies: [
        { module: '', router: null, action: null, level: 'full' },
        ...EXACT_MATCH_NON_FINANCIAL,
        // Override financial modules to none
        ...FINANCIAL_MODULES.map((mod) => ({ module: mod, router: null, action: null, level: 'none' })),
      ],
    });
  }

  return roles;
}

/**
 * Seed system roles and their policies into a tenant schema.
 *
 * @param {object} dbInstance pg-promise database connection or transaction
 * @param {object} pgp pg-promise helpers
 * @param {string} schemaName Tenant schema name
 * @param {string} tenantCode Tenant code (e.g., 'axerra', 'acme')
 * @param {boolean} isRootTenant Whether this is the Axerra platform tenant
 */
export async function seedSystemRoles(dbInstance, pgp, schemaName, tenantCode, isRootTenant) {
  const s = pgp.as.name(schemaName);
  const definitions = getSystemRoleDefinitions(isRootTenant);

  for (const roleDef of definitions) {
    // Check if role already exists (idempotent)
    const existing = await dbInstance.oneOrNone(
      `SELECT id FROM ${s}.roles WHERE code = $1`,
      [roleDef.code],
    );

    let roleId;
    if (existing) {
      roleId = existing.id;
      logger.info(`System role '${roleDef.code}' already exists in ${schemaName}, skipping insert`);
    } else {
      const inserted = await dbInstance.one(
        `INSERT INTO ${s}.roles (tenant_code, code, name, description, is_system, is_immutable, scope)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [tenantCode, roleDef.code, roleDef.name, roleDef.description, roleDef.is_system, roleDef.is_immutable, roleDef.scope],
      );
      roleId = inserted.id;
      logger.info(`Seeded system role '${roleDef.code}' in ${schemaName}`);
    }

    // Seed policies for this role
    for (const policy of roleDef.policies) {
      const policyExists = await dbInstance.oneOrNone(
        `SELECT id FROM ${s}.policies
         WHERE role_id = $1 AND module = $2 AND router IS NOT DISTINCT FROM $3 AND action IS NOT DISTINCT FROM $4`,
        [roleId, policy.module, policy.router, policy.action],
      );

      if (!policyExists) {
        await dbInstance.none(
          `INSERT INTO ${s}.policies (tenant_code, role_id, module, router, action, level)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [tenantCode, roleId, policy.module, policy.router, policy.action, policy.level],
        );
      }
    }
  }
}

export default { seedSystemRoles };
