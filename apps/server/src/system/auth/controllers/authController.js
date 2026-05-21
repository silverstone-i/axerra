/**
 * @file Auth controller — login, refresh, logout, me, check, changePassword, changeEmail per PRD §3.1.1
 * @module auth/controllers/authController
 *
 * Auth flow with RBAC permission caching and cache invalidation on logout.
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import bcrypt from 'bcrypt';
import passport from '../services/passportService.js';
import { signAccessToken, signRefreshToken, verifyRefresh } from '../services/tokenService.js';
import { setAuthCookies, clearAuthCookies } from '../../../lib/cookies.js';
import jwt from 'jsonwebtoken';
import db, { pgp } from '../../../db/db.js';
import { invalidateByUser } from '../../../services/permCacheInvalidator.js';
import { loadPermissions, primePermCache } from '../../../services/permissionLoader.js';
import { calcPermHash } from '../../../lib/permHash.js';
import logger from '../../../lib/logger.js';

const NO_PERMISSIONS_MESSAGE = 'Your account has no permissions assigned. Contact your administrator.';

/**
 * Resolve a portal_user's RBAC canon for their home tenant, and refuse
 * to issue tokens when the canon's `caps` is empty. Shared by `login`
 * (Passport-authenticated) and `refresh` (refresh-token-authenticated)
 * so the gate fires on every token issuance, not just the first one.
 *
 * Returns `{ ph, permissions, tenantCode }` on success, `null` after
 * having written a 403 to the response on failure.
 */
async function resolveAndGatePermissions(res, user, tenant, binding) {
  const permissions = await loadPermissions({
    schemaName: tenant.schema_name,
    userId: user.id,
    entityType: binding?.entity_type ?? null,
    entityId: binding?.entity_id ?? null,
  });

  if (!permissions.caps || Object.keys(permissions.caps).length === 0) {
    logger.warn('Login blocked — empty permission set', {
      userId: user.id,
      tenantCode: tenant.tenant_code,
      entityType: binding?.entity_type ?? null,
      entityId: binding?.entity_id ?? null,
    });
    res.status(403).json({ message: NO_PERMISSIONS_MESSAGE });
    return null;
  }

  await primePermCache(user.id, tenant.tenant_code, permissions);
  return { ph: calcPermHash(permissions), permissions, tenantCode: tenant.tenant_code };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX_LEN = 128;

const SOURCE_TYPE_BY_ENTITY_TYPE = {
  employee: 'employee',
  client: 'client',
  vendor_contact: 'vendor_contact',
};

/**
 * POST /api/auth/login — Authenticate with email/password
 */
export const login = (req, res, next) => {
  passport.authenticate('local', { session: false }, async (err, user, info) => {
    if (err || !user) {
      return res.status(400).json({ message: info?.message || 'Login failed' });
    }

    try {
      // Phase 3: load RBAC permissions for the home tenant and gate the
      // token issuance on the result. A user with no caps (no entity, no
      // roles, or roles that don't resolve to any policy) is refused with
      // 403 — credentials were valid, but the account is unusable. The
      // canon is then primed into the Redis cache so the user's first
      // authenticated request doesn't repeat the load.
      const gate = await resolveAndGatePermissions(res, user, user._tenant, user._binding);
      if (!gate) return; // resolveAndGatePermissions wrote the 403

      const accessToken = signAccessToken(user, { sub: user.id, ph: gate.ph });
      const refreshToken = signRefreshToken(user, { sub: user.id });

      setAuthCookies(res, { accessToken, refreshToken });

      const forcePasswordChange = user.status === 'invited';
      return res.json({ message: 'Logged in successfully', forcePasswordChange });
    } catch (loadErr) {
      logger.error('Login permission load failed', { userId: user.id, error: loadErr.message });
      return res.status(500).json({ message: 'Login failed' });
    }
  })(req, res, next);
};

/**
 * POST /api/auth/refresh — Full token rotation
 */
export const refresh = async (req, res) => {
  const token = req.cookies?.refresh_token;
  if (!token) return res.status(401).json({ message: 'No refresh token' });

  let decoded;
  try {
    decoded = verifyRefresh(token);
  } catch {
    return res.status(403).json({ message: 'Invalid refresh token' });
  }

  try {
    const user = await db('portalUsers', 'admin').findOneBy([{ id: decoded.sub }]);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Re-fetch the user's home binding + tenant so the same Phase 3 gate
    // applies on refresh — a user whose authorization has been revoked
    // since their last login (roles unassigned, entity archived) must
    // not be allowed to rotate to a fresh access token.
    const homeRow = await db.oneOrNone(
      `SELECT t.*,
              b.entity_type AS _home_entity_type,
              b.entity_id   AS _home_entity_id
         FROM admin.portal_user_tenants b
         JOIN admin.tenants t ON t.id = b.tenant_id
        WHERE b.portal_user_id = $1 AND b.deactivated_at IS NULL
        ORDER BY b.created_at ASC
        LIMIT 1`,
      [user.id],
    );
    if (!homeRow || homeRow.deactivated_at !== null) {
      return res.status(403).json({ message: 'Tenant is inactive.' });
    }
    const { _home_entity_type, _home_entity_id, ...tenant } = homeRow;
    const binding = { entity_type: _home_entity_type ?? null, entity_id: _home_entity_id ?? null };

    const gate = await resolveAndGatePermissions(res, user, tenant, binding);
    if (!gate) return;

    const accessToken = signAccessToken(user, { sub: user.id, ph: gate.ph });
    const refreshToken = signRefreshToken(user, { sub: user.id });

    setAuthCookies(res, { accessToken, refreshToken });

    return res.json({ message: 'Access token refreshed' });
  } catch (err) {
    logger.error('Refresh failed', { userId: decoded?.sub, error: err.message });
    return res.status(500).json({ message: 'Error refreshing token' });
  }
};

/**
 * POST /api/auth/logout — Clear cookies
 */
export const logout = async (req, res) => {
  if (req.cookies && !req.cookies.auth_token && !req.cookies.refresh_token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  // Flush permission cache for the logging-out user
  try {
    const token = req.cookies?.auth_token;
    if (token) {
      const claims = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      if (claims?.sub) await invalidateByUser(claims.sub);
    }
  } catch {
    // Token expired or invalid — cache will expire via TTL
  }

  clearAuthCookies(res);
  return res.json({ message: 'Logged out successfully' });
};

/**
 * GET /api/auth/me — Return user context with tenant and impersonation info
 */
export const me = async (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ message: 'Unauthorized' });

  // Look up tenant for full context
  let tenant = null;
  try {
    tenant = await db('tenants', 'admin').findById(user.tenant_id);
  } catch {
    // proceed with null tenant
  }

  // Strip sensitive fields
  const safeUser = {
    id: user.id,
    email: user.email,
    entity_type: user.entity_type,
    entity_id: user.entity_id,
    status: user.status,
    tenant_id: user.tenant_id,
    tenant_code: user.tenant_code,
    home_tenant: user.home_tenant,
    schema_name: user.schema_name,
    perms: user.permissions,
  };

  const tenantContext = tenant
    ? {
        id: tenant.id,
        tenant_code: tenant.tenant_code,
        company: tenant.company,
        schema_name: tenant.schema_name,
        status: tenant.status,
        tier: tenant.tier,
        allowed_modules: tenant.allowed_modules,
      }
    : null;

  // Check impersonation status via Redis
  let impersonation = { active: false };
  try {
    const { getRedis } = await import('../../../db/redis.js');
    const redis = await getRedis();
    const impData = await redis.get(`imp:${user.id}`);
    if (impData) {
      const parsed = JSON.parse(impData);
      impersonation = {
        active: true,
        target_user: parsed.targetUser,
        log_id: parsed.logId,
      };
    }
  } catch {
    // Redis unavailable — impersonation status unknown
  }

  return res.json({
    user: safeUser,
    tenant: tenantContext,
    impersonation,
  });
};

/**
 * GET /api/auth/check — Lightweight session validation
 */
export const check = (req, res) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  return res.status(200).json({ message: 'Token is valid' });
};

/**
 * Password strength rules: min 8 chars, 1 uppercase, 1 lowercase, 1 digit, 1 special.
 */
const PASSWORD_RULES = [
  { test: (p) => p.length >= 8, msg: 'at least 8 characters' },
  { test: (p) => /[A-Z]/.test(p), msg: 'an uppercase letter' },
  { test: (p) => /[a-z]/.test(p), msg: 'a lowercase letter' },
  { test: (p) => /[0-9]/.test(p), msg: 'a digit' },
  { test: (p) => /[^A-Za-z0-9]/.test(p), msg: 'a special character' },
];

function validatePasswordStrength(password) {
  return PASSWORD_RULES.filter((r) => !r.test(password)).map((r) => r.msg);
}

/**
 * POST /api/auth/change-password — Change the authenticated user's password
 */
export const changePassword = async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'currentPassword and newPassword are required' });
  }

  const failures = validatePasswordStrength(newPassword);
  if (failures.length) {
    return res.status(400).json({ message: `Password must contain ${failures.join(', ')}` });
  }

  try {
    const user = await db('portalUsers', 'admin').findOneBy([{ id: userId }]);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) return res.status(403).json({ message: 'Current password is incorrect' });

    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
    const password_hash = await bcrypt.hash(newPassword, rounds);

    // Use raw SQL — pg-schemata's update resets all ColumnSet columns to defaults
    const setClauses = ['password_hash = $/password_hash/'];
    const params = { password_hash, id: userId };

    // If user is 'invited', activate them on first password change
    if (user.status === 'invited') {
      setClauses.push("status = 'active'");
    }

    await db.none(`UPDATE admin.portal_users SET ${setClauses.join(', ')} WHERE id = $/id/`, params);

    return res.json({ message: 'Password changed successfully' });
  } catch {
    return res.status(500).json({ message: 'Error changing password' });
  }
};

/**
 * PATCH /api/auth/me/email — Change the authenticated user's login email.
 *
 * Updates admin.portal_users.email for the caller and cascades the change
 * to every tenant-scoped emails row (is_login=true) for each active binding
 * the user has. Runs inside a single transaction so partial failures roll
 * back the global identity update.
 */
export const changeEmail = async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  const newEmailRaw = req.body?.email;
  if (typeof newEmailRaw !== 'string') {
    return res.status(400).json({ message: 'email is required' });
  }
  const newEmail = newEmailRaw.trim();
  if (!EMAIL_RE.test(newEmail)) {
    return res.status(400).json({ message: 'Invalid email format' });
  }
  if (newEmail.length > EMAIL_MAX_LEN) {
    return res.status(400).json({ message: `Email must be ${EMAIL_MAX_LEN} characters or fewer` });
  }

  try {
    const result = await db.tx(async (t) => {
      // Update the global portal_users identity. The partial unique index
      // on (email) WHERE deactivated_at IS NULL surfaces collisions as 23505.
      const updated = await t.oneOrNone(
        `UPDATE admin.portal_users
            SET email = $1, updated_by = $2
          WHERE id = $3 AND deactivated_at IS NULL
          RETURNING id, email, status`,
        [newEmail, userId, userId],
      );
      if (!updated) {
        const err = new Error('User not found');
        err.code = 'USER_NOT_FOUND';
        throw err;
      }

      // Cascade to per-tenant emails.is_login rows for each active binding.
      const bindings = await t.manyOrNone(
        `SELECT b.entity_type, b.entity_id, tn.schema_name
           FROM admin.portal_user_tenants b
           JOIN admin.tenants tn ON tn.id = b.tenant_id
          WHERE b.portal_user_id = $1
            AND b.deactivated_at IS NULL
            AND b.entity_type IS NOT NULL
            AND b.entity_id IS NOT NULL`,
        [userId],
      );

      for (const binding of bindings) {
        const sourceType = SOURCE_TYPE_BY_ENTITY_TYPE[binding.entity_type];
        if (!sourceType) continue;
        const schemaIdent = pgp.as.name(binding.schema_name);
        await t.none(
          `UPDATE ${schemaIdent}.emails AS e
              SET email = $1, updated_by = $2
             FROM ${schemaIdent}.sources AS src
            WHERE e.source_id = src.id
              AND src.source_type = $3
              AND src.table_id = $4
              AND src.deactivated_at IS NULL
              AND e.is_login = true
              AND e.deactivated_at IS NULL`,
          [newEmail, userId, sourceType, binding.entity_id],
        );
      }

      return updated;
    });

    return res.json({
      message: 'Email changed successfully',
      user: { id: result.id, email: result.email, status: result.status },
    });
  } catch (err) {
    if (err?.code === '23505') {
      return res.status(409).json({ message: 'Email is already in use' });
    }
    if (err?.code === 'USER_NOT_FOUND') {
      return res.status(404).json({ message: 'User not found' });
    }
    logger.error('Failed to change login email', { userId, error: err.message });
    return res.status(500).json({ message: 'Error changing email' });
  }
};

export default { login, refresh, logout, me, check, changePassword, changeEmail };
