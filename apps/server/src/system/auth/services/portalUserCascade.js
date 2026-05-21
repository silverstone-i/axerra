/**
 * @file Shared archive/restore cascade for entity-linked portal_users
 * @module auth/services/portalUserCascade
 *
 * Single home for the (entity_type, entity_id, tenant_id) → portal_user /
 * portal_user_tenants cascade. Used by every parent controller whose entity
 * may carry a portal_user binding (employees, clients, vendor_contacts; and
 * indirectly via overrides on vendors and contacts).
 *
 * Restore rule (rule of record):
 *   Find every binding whose `deactivated_at` equals the MAX `deactivated_at`
 *   for that (entity_type, entity_id, tenant_id) triple, then clear
 *   `deactivated_at` on those bindings AND on the portal_users they reference.
 *   Never touch `status` — restoring an archived parent must not silently
 *   re-grant a role state that the deactivation timestamp didn't encode.
 *
 * Archive cascade keeps the existing semantics:
 *   - Lock the single active binding for the entity.
 *   - Lock the portal_user iff that was its only active binding (so a
 *     multi-tenant user with a separately-active binding elsewhere stays up).
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import db from '../../../db/db.js';
import logger from '../../../lib/logger.js';
import { findActiveBinding } from './portalUserBindings.js';

/**
 * Archive the active portal_user binding (and the linked portal_user when the
 * binding being archived is its final live one) for the given entity.
 *
 * @param {object} params
 * @param {string} params.entityType  e.g. 'employee', 'client', 'vendor_contact'
 * @param {string} params.entityId    UUID of the parent row.
 * @param {string} params.tenantId    UUID of the owning tenant.
 * @param {string|null} params.actorId  Audit actor (`updated_by`). Null for system contexts.
 */
export async function archivePortalUserFor({ entityType, entityId, tenantId, actorId = null }) {
  const binding = await findActiveBinding(entityType, entityId, tenantId);
  if (!binding) return;

  await db.tx(async (t) => {
    await t.none(
      `UPDATE admin.portal_user_tenants
         SET deactivated_at = NOW(), status = 'locked', updated_by = $1
       WHERE id = $2`,
      [actorId, binding.id],
    );
    // Only lock the portal_user when this was its last active binding —
    // a user bound to another active tenant stays live. Use a correlated
    // NOT EXISTS scoped to this portal_user so we hit the
    // (portal_user_id, deactivated_at) index instead of scanning all
    // active bindings.
    await t.none(
      `UPDATE admin.portal_users
         SET deactivated_at = NOW(), status = 'locked', updated_by = $1
       WHERE id = $2
         AND deactivated_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM admin.portal_user_tenants
           WHERE portal_user_id = $2 AND deactivated_at IS NULL
         )`,
      [actorId, binding.portal_user_id],
    );
  });
  logger.info(`Archived portal_user ${binding.portal_user_id} + binding for ${entityType} ${entityId}`);
}

/**
 * Restore every portal_user binding for the given entity whose `deactivated_at`
 * equals the most recent archive timestamp on that entity, plus the referenced
 * portal_users. `status` is intentionally not modified.
 *
 * Accepts an optional pg-promise tx executor `t`. When omitted, the whole
 * sequence (cohort SELECT + both UPDATEs) runs inside one short tx so the
 * cohort can't shift between the SELECT and the UPDATEs.
 */
export async function restorePortalUserFor({ entityType, entityId, tenantId, actorId = null }, t = null) {
  const run = async (exec) => {
    const cohort = await exec.any(
      `WITH max_ts AS (
         SELECT MAX(deactivated_at) AS ts FROM admin.portal_user_tenants
         WHERE entity_type = $1 AND entity_id = $2 AND tenant_id = $3
           AND deactivated_at IS NOT NULL
       )
       SELECT id, portal_user_id FROM admin.portal_user_tenants
       WHERE entity_type = $1 AND entity_id = $2 AND tenant_id = $3
         AND deactivated_at IS NOT NULL
         AND deactivated_at = (SELECT ts FROM max_ts)`,
      [entityType, entityId, tenantId],
    );
    if (!cohort.length) return { bindingIds: [], userIds: [] };

    const bindingIds = cohort.map((r) => r.id);
    const userIds = [...new Set(cohort.map((r) => r.portal_user_id))];

    await exec.none(
      `UPDATE admin.portal_user_tenants
         SET deactivated_at = NULL, updated_by = $1
       WHERE id = ANY($2::uuid[])`,
      [actorId, bindingIds],
    );
    await exec.none(
      `UPDATE admin.portal_users
         SET deactivated_at = NULL, updated_by = $1
       WHERE id = ANY($2::uuid[])
         AND deactivated_at IS NOT NULL`,
      [actorId, userIds],
    );
    return { bindingIds, userIds };
  };

  const { bindingIds, userIds } = t ? await run(t) : await db.tx(run);
  if (bindingIds.length) {
    logger.info(
      `Restored ${bindingIds.length} binding(s) + ${userIds.length} portal_user(s) for ${entityType} ${entityId}`,
    );
  }
}

/**
 * Tenant-scoped restore: applies the same MAX-timestamp cohort rule across
 * ALL bindings of a tenant (any entity_type). Used by tenantsController.restore
 * to bring back the users that were locked together when the tenant was
 * archived, without disturbing users archived at an earlier date for a
 * different reason.
 *
 * Accepts an optional pg-promise transaction context `t` so the caller can
 * make the tenant update + binding cascade atomic. When omitted, runs the
 * whole sequence (cohort SELECT + both UPDATEs) inside one short tx so the
 * cohort can't shift between the SELECT and the UPDATEs.
 */
export async function restoreTenantBindings({ tenantId, actorId = null }, t = null) {
  const run = async (exec) => {
    const cohort = await exec.any(
      `WITH max_ts AS (
         SELECT MAX(deactivated_at) AS ts FROM admin.portal_user_tenants
         WHERE tenant_id = $1 AND deactivated_at IS NOT NULL
       )
       SELECT id, portal_user_id FROM admin.portal_user_tenants
       WHERE tenant_id = $1
         AND deactivated_at IS NOT NULL
         AND deactivated_at = (SELECT ts FROM max_ts)`,
      [tenantId],
    );
    if (!cohort.length) return { bindingIds: [], userIds: [] };

    const bindingIds = cohort.map((r) => r.id);
    const userIds = [...new Set(cohort.map((r) => r.portal_user_id))];

    await exec.none(
      `UPDATE admin.portal_user_tenants
         SET deactivated_at = NULL, updated_by = $1
       WHERE id = ANY($2::uuid[])`,
      [actorId, bindingIds],
    );
    await exec.none(
      `UPDATE admin.portal_users
         SET deactivated_at = NULL, updated_by = $1
       WHERE id = ANY($2::uuid[])
         AND deactivated_at IS NOT NULL`,
      [actorId, userIds],
    );
    return { bindingIds, userIds };
  };

  const { bindingIds, userIds } = t ? await run(t) : await db.tx(run);
  if (bindingIds.length) {
    logger.info(`Restored ${bindingIds.length} binding(s) + ${userIds.length} portal_user(s) for tenant ${tenantId}`);
  }
}
