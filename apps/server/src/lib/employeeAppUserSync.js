/**
 * @file App-user lifecycle service for tenant entities with portal access
 * @module server/lib/employeeAppUserSync
 *
 * Centralises portal_users + portal_user_tenants cascade rules for entities
 * that opt in to app access (employees, clients). Used by both controllers
 * (single-row CRUD) and the flat-import reconciler. Functions are pure of
 * req/res — callers pass plain arguments and a transaction handle.
 *
 * Naming note: the module is called `employeeAppUserSync` for historical
 * reasons; the helpers are polymorphic and accept any entity_type that
 * binds to portal_users (employee, client, vendor_contact).
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import logger from './logger.js';

/**
 * Provision a portal_user + binding for an entity gaining app access.
 * Skips when an active portal_user already owns this email (the caller's
 * pre-validation should catch this case as a collision; this is a defensive
 * fallback). Returns true on success, false on collision-skip.
 *
 * @param {Object} t           pg-promise transaction
 * @param {string} entityType  'employee' | 'client' | 'vendor_contact'
 * @param {string} entityId    primary key of the entity in its tenant table
 * @param {string} email       login email to assign to portal_users
 * @param {string} password    clear-text password (will be bcrypted) — supply random when caller doesn't have one
 * @param {string} tenantId    binding tenant_id
 * @param {string|null} userId caller user id for audit
 * @param {string} [preHash]   pre-computed bcrypt hash; skips hashing when supplied
 * @returns {Promise<boolean>} true on success, false on collision
 */
export async function provisionAppUser(t, entityType, entityId, email, password, tenantId, userId, preHash = null) {
  // Normalize email so case-only variants can't create two active portal_users.
  const normEmail = email == null ? null : String(email).trim().toLowerCase();
  const existing = await t.oneOrNone(
    'SELECT id FROM admin.portal_users WHERE LOWER(email) = $1 AND deactivated_at IS NULL',
    [normEmail],
  );
  if (existing) return false;

  let passwordHash;
  if (preHash) {
    passwordHash = preHash;
  } else {
    const bcrypt = await import('bcrypt');
    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
    passwordHash = await bcrypt.default.hash(password, rounds);
  }

  const inserted = await t.one(
    `INSERT INTO admin.portal_users (email, password_hash, status, created_by, updated_by)
     VALUES ($1, $2, 'invited', $3, $3)
     RETURNING id`,
    [normEmail, passwordHash, userId],
  );
  await t.none(
    `INSERT INTO admin.portal_user_tenants
       (portal_user_id, tenant_id, entity_type, entity_id, status, created_by, updated_by)
     VALUES ($1, $2, $3, $4, 'active', $5, $5)`,
    [inserted.id, tenantId, entityType, entityId, userId],
  );
  return true;
}

/**
 * Restore an archived portal_user + binding for an entity that's coming
 * back online (employee restore, is_app_user re-enabled). Restores the
 * binding if one exists in archived state; updates the password/email on
 * the way back. Returns true if a restore occurred, false if no prior
 * binding exists.
 *
 * @param {Object} t           pg-promise transaction
 * @param {string} entityType
 * @param {string} entityId
 * @param {string} tenantId
 * @param {string|null} userId
 * @param {string} [email]     when supplied, also updates the portal_user email
 * @param {string} [preHash]   when supplied, also updates the password
 */
export async function restoreAppUserBinding(t, entityType, entityId, tenantId, userId, email = null, preHash = null) {
  const binding = await t.oneOrNone(
    `SELECT id, portal_user_id FROM admin.portal_user_tenants
     WHERE entity_type = $1 AND entity_id = $2 AND tenant_id = $3
     ORDER BY deactivated_at IS NULL DESC, created_at DESC LIMIT 1`,
    [entityType, entityId, tenantId],
  );
  if (!binding) return false;

  const normEmail = email == null ? null : String(email).trim().toLowerCase();
  if (normEmail && preHash) {
    await t.none(
      `UPDATE admin.portal_users
       SET deactivated_at = NULL, status = 'invited', password_hash = $1, email = $2,
           updated_by = $3, updated_at = NOW()
       WHERE id = $4`,
      [preHash, normEmail, userId, binding.portal_user_id],
    );
  } else if (normEmail) {
    await t.none(
      `UPDATE admin.portal_users
       SET deactivated_at = NULL, status = 'active', email = $1,
           updated_by = $2, updated_at = NOW()
       WHERE id = $3`,
      [normEmail, userId, binding.portal_user_id],
    );
  } else {
    await t.none(
      `UPDATE admin.portal_users
       SET deactivated_at = NULL, status = 'active',
           updated_by = $1, updated_at = NOW()
       WHERE id = $2`,
      [userId, binding.portal_user_id],
    );
  }
  await t.none(
    `UPDATE admin.portal_user_tenants
     SET deactivated_at = NULL, status = 'active', updated_by = $1, updated_at = NOW()
     WHERE id = $2`,
    [userId, binding.id],
  );
  logger.info(`Restored portal_user ${binding.portal_user_id} + binding for ${entityType} ${entityId}`);
  return true;
}

/**
 * High-level: enable app access for an entity. Picks the right primitive
 * based on any prior binding state.
 *
 *   no binding   → provision new portal_user + binding (password required)
 *   archived     → restore portal_user + binding; existing password_hash is
 *                  preserved unless caller explicitly supplies opts.preHash
 *   active       → no-op (already enabled)
 *   email taken  → returns 'collision' without writing (caller surfaces error)
 *
 * @param {Object} t
 * @param {string} entityType
 * @param {string} entityId
 * @param {string} email
 * @param {string|null} password   clear-text; used ONLY when provisioning a
 *                                 brand-new portal_user. Ignored on restore —
 *                                 supply opts.preHash explicitly to reset.
 * @param {string} tenantId
 * @param {string|null} userId
 * @param {Object} [opts]
 * @param {string} [opts.preHash]  pre-computed bcrypt hash. When set on a
 *                                 restore, overwrites the existing password.
 * @returns {Promise<'provisioned'|'restored'|'already_active'|'collision'>}
 */
export async function enableAppUser(t, entityType, entityId, email, password, tenantId, userId, opts = {}) {
  const { preHash = null } = opts;
  const priorBinding = await t.oneOrNone(
    `SELECT id, portal_user_id, deactivated_at FROM admin.portal_user_tenants
     WHERE entity_type = $1 AND entity_id = $2 AND tenant_id = $3
     ORDER BY deactivated_at IS NULL DESC, created_at DESC LIMIT 1`,
    [entityType, entityId, tenantId],
  );

  if (priorBinding && !priorBinding.deactivated_at) return 'already_active';

  if (priorBinding && priorBinding.deactivated_at) {
    // Restore archived binding. Pass preHash through unchanged — null means
    // "preserve the existing password." Callers who want a true reset must
    // supply preHash explicitly.
    await restoreAppUserBinding(t, entityType, entityId, tenantId, userId, email, preHash);
    return 'restored';
  }

  const provisioned = await provisionAppUser(t, entityType, entityId, email, password, tenantId, userId, preHash);
  return provisioned ? 'provisioned' : 'collision';
}

/**
 * Archive (soft-delete) the portal_user + binding linked to an entity.
 * No-op when no active binding exists.
 *
 * @param {Object} t
 * @param {string} entityType
 * @param {string} entityId
 * @param {string} tenantId
 * @param {string|null} userId
 */
export async function archiveAppUser(t, entityType, entityId, tenantId, userId) {
  const binding = await t.oneOrNone(
    `SELECT id, portal_user_id FROM admin.portal_user_tenants
     WHERE entity_type = $1 AND entity_id = $2 AND tenant_id = $3 AND deactivated_at IS NULL`,
    [entityType, entityId, tenantId],
  );
  if (!binding) return false;

  await t.none(
    `UPDATE admin.portal_user_tenants
     SET deactivated_at = NOW(), status = 'locked', updated_by = $1, updated_at = NOW()
     WHERE id = $2`,
    [userId, binding.id],
  );
  await t.none(
    `UPDATE admin.portal_users
     SET deactivated_at = NOW(), status = 'locked', updated_by = $1, updated_at = NOW()
     WHERE id = $2`,
    [userId, binding.portal_user_id],
  );
  logger.info(`Archived portal_user ${binding.portal_user_id} + binding for ${entityType} ${entityId}`);
  return true;
}
