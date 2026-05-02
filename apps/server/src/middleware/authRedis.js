/**
 * @file Auth middleware — JWT verification, tenant resolution, RBAC permission loading
 * @module server/middleware/authRedis
 *
 * Verifies JWT from httpOnly cookie, resolves tenant context, loads RBAC
 * permissions (from Redis cache or DB), detects stale tokens, and populates
 * req.user with the full permission canon.
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import jwt from 'jsonwebtoken';
import logger from '../lib/logger.js';
import { loadPermissions } from '../services/permissionLoader.js';
import { calcPermHash } from '../lib/permHash.js';
import { getRedis } from '../db/redis.js';

const AUTH_BYPASS_SEGMENTS = ['/auth/login', '/auth/refresh', '/auth/logout'];
const PERM_CACHE_TTL = 900; // 15 minutes

/**
 * Check if the request path should bypass authentication.
 */
function shouldBypassAuth(path, fullPath) {
  const normalizedPath = (path || '').toLowerCase();
  const normalizedFullPath = (fullPath || '').toLowerCase();
  if (normalizedPath === '/') return true;

  return AUTH_BYPASS_SEGMENTS.some(
    (segment) => normalizedPath.includes(segment) || normalizedFullPath.includes(segment),
  );
}

/**
 * Try to read cached permissions from Redis.
 * @returns {object|null} Cached permission canon, or null on miss/error
 */
async function getCachedPermissions(userId, tenantCode) {
  try {
    const redis = await getRedis();
    const cached = await redis.get(`perm:${userId}:${tenantCode}`);
    if (cached) return JSON.parse(cached);
  } catch {
    // Redis unavailable — fall through to DB
  }
  return null;
}

/**
 * Cache permissions in Redis.
 */
async function cachePermissions(userId, tenantCode, canon) {
  try {
    const redis = await getRedis();
    await redis.set(`perm:${userId}:${tenantCode}`, JSON.stringify(canon), 'EX', PERM_CACHE_TTL);
  } catch {
    // Redis unavailable — non-fatal
  }
}

/**
 * Express middleware factory — returns the auth middleware function.
 *
 * Flow:
 * 1. Bypass auth for login/refresh/logout paths
 * 2. Verify JWT from httpOnly cookie
 * 3. Look up user + tenant from database
 * 4. Load RBAC permissions (Redis cache → DB fallback)
 * 5. Detect stale tokens (ph claim vs computed hash)
 * 6. Populate req.user with full permission canon
 */
export function authRedis() {
  return async (req, res, next) => {
    try {
      const path = req.path || '';
      const fullPath = req.originalUrl || req.url || '';

      if (shouldBypassAuth(path, fullPath)) {
        return next();
      }

      const token = req.cookies?.auth_token;
      if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      let claims;
      try {
        claims = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      } catch {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const uid = claims?.sub;
      if (!uid) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Hydrate user from DB (JWT is minimal: sub + ph only)
      const dbMod = await import('../db/db.js');
      const db = dbMod.default || dbMod.db;
      let userRecord = null;
      let homeBinding = null;
      let homeTenantRecord = null;
      try {
        userRecord = await db('portalUsers', 'admin').findOneBy([{ id: uid }]);
        if (userRecord) {
          // Default to the user's earliest active binding as their "home"
          // tenant. Tasks 5–9 keep employees and clients single-binding;
          // vendor_contacts may have multiple but the first-by-created_at
          // is a deterministic default the x-tenant-code header overrides.
          homeBinding = await db.oneOrNone(
            `SELECT id, portal_user_id, tenant_id, entity_type, entity_id, status
             FROM admin.portal_user_tenants
             WHERE portal_user_id = $1 AND deactivated_at IS NULL
             ORDER BY created_at ASC
             LIMIT 1`,
            [uid],
          );
          if (homeBinding) {
            homeTenantRecord = await db('tenants', 'admin').findById(homeBinding.tenant_id);
          }
        }
      } catch {
        // DB unavailable — reject
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!userRecord || !homeBinding || !homeTenantRecord) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Resolve tenant code from header or user's home binding
      const headerTenant = req.headers['x-tenant-code'];
      const homeTenantCode = homeTenantRecord.tenant_code.toLowerCase();
      const tenantCode = headerTenant ? headerTenant.toLowerCase() : homeTenantCode;

      // ── Schema + binding resolution ─────────────────────────────────────
      // Schema/data resolution follows the resolved tenant_code. Entity
      // context (entity_type/entity_id) follows the matching binding when
      // one exists — otherwise it falls back to the home binding so
      // Axerra cross-tenant switching keeps working without a binding.
      const homeSchemaName = homeTenantRecord.schema_name;
      let dataSchemaName = homeSchemaName;
      let effectiveTenantRecord = homeTenantRecord;
      let activeBinding = homeBinding;
      if (headerTenant && tenantCode !== homeTenantCode) {
        try {
          const row = await db.oneOrNone(
            'SELECT * FROM admin.tenants WHERE LOWER(tenant_code) = $1 AND deactivated_at IS NULL',
            [tenantCode],
          );
          if (row) {
            dataSchemaName = row.schema_name;
            effectiveTenantRecord = row;
            const matchedBinding = await db.oneOrNone(
              `SELECT id, portal_user_id, tenant_id, entity_type, entity_id, status
               FROM admin.portal_user_tenants
               WHERE portal_user_id = $1 AND tenant_id = $2 AND deactivated_at IS NULL`,
              [uid, row.id],
            );
            if (matchedBinding) {
              activeBinding = matchedBinding;
            }
          }
        } catch {
          // Fall back to home schema if lookup fails
        }
      }

      // ── RBAC Permission Loading ─────────────────────────────────────────
      // Permissions are scoped to the active binding's schema. Cache key
      // follows the binding: when a matching per-tenant binding was found
      // we key on the active tenant_code; when we fell back to the home
      // binding (e.g. Axerra cross-tenant switch with no binding) the
      // perms are home-tenant perms, so cache under homeTenantCode. Mixing
      // these would let stale home perms shadow real per-tenant perms
      // once the user gains a binding to that tenant.
      const fellBackToHome = activeBinding === homeBinding;
      const schemaName = fellBackToHome ? homeSchemaName : effectiveTenantRecord.schema_name;
      const permCacheKey = fellBackToHome ? homeTenantCode : tenantCode;
      let permissions = await getCachedPermissions(uid, permCacheKey);

      if (!permissions) {
        permissions = await loadPermissions({
          schemaName,
          userId: uid,
          entityType: activeBinding.entity_type,
          entityId: activeBinding.entity_id,
        });
        await cachePermissions(uid, permCacheKey, permissions);
      }

      // ── Stale Token Detection ───────────────────────────────────────────
      const permHash = calcPermHash(permissions);
      if (claims.ph && claims.ph !== permHash) {
        res.setHeader('X-Token-Stale', '1');
      }

      // ── Impersonation Detection ────────────────────────────────────────
      let isImpersonating = false;
      let impersonatedBy = null;
      let effectiveUser = userRecord;
      let effectiveTenantCode = tenantCode;
      let effectiveSchemaName = dataSchemaName;
      let effectivePermissions = permissions;

      try {
        const redis = await getRedis();
        const impData = await redis.get(`imp:${uid}`);
        if (impData) {
          const parsed = JSON.parse(impData);
          isImpersonating = true;
          impersonatedBy = uid;

          // Load target user data
          const dbMod2 = await import('../db/db.js');
          const db2 = dbMod2.default || dbMod2.db;
          const targetUser = await db2('portalUsers', 'admin').findOneBy([{ id: parsed.targetUserId }]);
          if (targetUser) {
            // Resolve the impersonated target's binding: prefer one that
            // matches the requested target tenant, otherwise fall back
            // to their earliest active binding.
            const requestedTargetCode = parsed.targetTenantCode || tenantCode || null;
            const targetSchemaOverride = parsed.targetSchemaName;
            const targetBinding = await db2.oneOrNone(
              `SELECT b.entity_type, b.entity_id, b.tenant_id, t.schema_name, t.tenant_code
               FROM admin.portal_user_tenants b
               JOIN admin.tenants t ON t.id = b.tenant_id
               WHERE b.portal_user_id = $1 AND b.deactivated_at IS NULL
               ORDER BY ($2::text IS NOT NULL AND LOWER(t.tenant_code) = LOWER($2)) DESC, b.created_at ASC
               LIMIT 1`,
              [targetUser.id, requestedTargetCode],
            );

            if (targetBinding) {
              effectiveUser = { ...targetUser, entity_type: targetBinding.entity_type, entity_id: targetBinding.entity_id };
              // Set effective context from the resolved binding so downstream
              // queries don't operate against a tenant the target lacks a
              // binding for.
              effectiveTenantCode = (targetBinding.tenant_code || requestedTargetCode || tenantCode).toLowerCase();
              effectiveSchemaName = targetSchemaOverride || targetBinding.schema_name;

              if (targetBinding.tenant_id !== effectiveTenantRecord.id) {
                const targetTenant = await db2('tenants', 'admin').findById(targetBinding.tenant_id);
                if (targetTenant) effectiveTenantRecord = targetTenant;
              }

              effectivePermissions = await loadPermissions({
                schemaName: effectiveSchemaName,
                userId: targetUser.id,
                entityType: targetBinding.entity_type,
                entityId: targetBinding.entity_id,
              });
            }
          }
        }
      } catch {
        // Redis unavailable — proceed without impersonation
      }

      // ── Populate req.user ───────────────────────────────────────────────
      const effectiveEntityType = isImpersonating ? effectiveUser.entity_type : activeBinding.entity_type;
      const effectiveEntityId = isImpersonating ? effectiveUser.entity_id : activeBinding.entity_id;

      req.user = {
        id: isImpersonating ? impersonatedBy : uid,
        email: effectiveUser.email,
        entity_type: effectiveEntityType,
        entity_id: effectiveEntityId,
        status: effectiveUser.status,
        tenant_id: effectiveTenantRecord.id,
        tenant_code: effectiveTenantCode,
        home_tenant: homeTenantCode,
        schema_name: effectiveSchemaName,
        permissions: effectivePermissions,
        is_impersonating: isImpersonating,
        impersonated_by: impersonatedBy,
      };

      req.ctx = {
        user_id: isImpersonating ? impersonatedBy : uid,
        tenant_code: effectiveTenantCode,
        schema: effectiveSchemaName,
        tenant: effectiveTenantRecord,
        perms: effectivePermissions,
      };

      return next();
    } catch (error) {
      logger.warn('authRedis rejected request', { error: error?.message });
      return res.status(401).json({ error: 'Unauthorized' });
    }
  };
}

export default authRedis;
