/**
 * @file Orphan portal_users router — Axerra-only maintenance API
 * @module tenants/apiRoutes/v1/orphanPortalUsersRouter
 *
 * Mounted at /api/tenants/v1/orphan-portal-users:
 *   GET  /orphans/preview   → list orphan portal_users
 *   POST /orphans/cleanup   → hard-delete one orphan by id
 *
 * Three-layer enforcement, in order:
 *   1. requireRootTenant — only Axerra-tenant users may reach these routes.
 *   2. rejectImpersonation — even an Axerra user must be in a direct (non-
 *      impersonated) session. Without this an Axerra admin could hit these
 *      destructive routes from an impersonated tenant-user-shaped session
 *      and the audit log wouldn't distinguish the two contexts.
 *   3. rbac() — the role's policy on
 *      `tenants::orphan-portal-users::find_orphans|cleanup_orphans` is
 *      consulted, so the policy-catalog entries seeded for these actions
 *      are actually enforced. The Axerra system roles (super_user,
 *      support) seed wildcard `'::::'` policy and pass; finer-grained
 *      Axerra ops roles can deny specific actions independently.
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import { Router } from 'express';
import { findOrphans, cleanupOrphan } from '../../controllers/orphanPortalUsersController.js';
import { requireRootTenant } from '../../../../middleware/requireRootTenant.js';
import { moduleEntitlement } from '../../../../middleware/moduleEntitlement.js';
import { rbac } from '../../../../middleware/rbac.js';
import { withMeta } from '../../../../middleware/withMeta.js';

/**
 * Reject the request when the caller is in an impersonated session.
 * authRedis sets req.user.is_impersonating=true and req.user.id=<impersonator>
 * during impersonation; the effective tenant context belongs to the target
 * user. Destructive platform-wide maintenance must run from a direct root
 * session so the action and the audit log unambiguously belong to the
 * Axerra operator, not to a tenant-user-shaped session.
 */
function rejectImpersonation(req, res, next) {
  if (req.user?.is_impersonating) {
    return res.status(403).json({ error: 'Maintenance routes cannot be invoked from an impersonated session.' });
  }
  next();
}

const router = Router();

router.get(
  '/orphans/preview',
  requireRootTenant,
  rejectImpersonation,
  withMeta({ module: 'tenants', router: 'orphan-portal-users', action: 'find_orphans' }),
  moduleEntitlement,
  rbac('view'),
  findOrphans,
);

router.post(
  '/orphans/cleanup',
  requireRootTenant,
  rejectImpersonation,
  withMeta({ module: 'tenants', router: 'orphan-portal-users', action: 'cleanup_orphans' }),
  moduleEntitlement,
  rbac('full'),
  cleanupOrphan,
);

export default router;
