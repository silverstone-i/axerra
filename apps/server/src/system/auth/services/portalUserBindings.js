/**
 * @file Helpers for resolving portal_user_tenants bindings from controllers
 * @module auth/services/portalUserBindings
 *
 * Centralises the portal_users + portal_user_tenants joins used by entity
 * provisioning and archive/restore flows so callers don't repeat the
 * (entity_type, entity_id, tenant_id) lookup pattern.
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import db from '../../../db/db.js';

/**
 * Find an active binding for the given entity in the given tenant.
 * @returns {Promise<object|null>} { id, portal_user_id, entity_type, entity_id, tenant_id, status } or null
 */
export async function findActiveBinding(entityType, entityId, tenantId) {
  return db.oneOrNone(
    `SELECT id, portal_user_id, entity_type, entity_id, tenant_id, status
     FROM admin.portal_user_tenants
     WHERE entity_type = $1 AND entity_id = $2 AND tenant_id = $3 AND deactivated_at IS NULL`,
    [entityType, entityId, tenantId],
  );
}

/**
 * Find any binding (active or archived) for the given entity in the given tenant.
 */
export async function findAnyBinding(entityType, entityId, tenantId) {
  return db.oneOrNone(
    `SELECT id, portal_user_id, entity_type, entity_id, tenant_id, status, deactivated_at
     FROM admin.portal_user_tenants
     WHERE entity_type = $1 AND entity_id = $2 AND tenant_id = $3
     ORDER BY deactivated_at IS NULL DESC, created_at DESC
     LIMIT 1`,
    [entityType, entityId, tenantId],
  );
}

/**
 * Find the active portal_user_id for a given (entity_type, entity_id, tenant_id) binding.
 * @returns {Promise<string|null>}
 */
export async function findActivePortalUserId(entityType, entityId, tenantId) {
  const row = await findActiveBinding(entityType, entityId, tenantId);
  return row?.portal_user_id || null;
}
