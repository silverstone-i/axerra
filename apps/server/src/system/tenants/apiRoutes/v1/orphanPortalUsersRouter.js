/**
 * @file Orphan portal_users router — Axerra-only maintenance API
 * @module tenants/apiRoutes/v1/orphanPortalUsersRouter
 *
 * Mounted at /api/tenants/v1/orphan-portal-users:
 *   GET  /orphans/preview   → list orphan portal_users
 *   POST /orphans/cleanup   → hard-delete one orphan by id
 *
 * Mirrors the established `tenants/*` router convention: Axerra-only routes
 * are gated by `requireRootTenant` — but additionally these destructive
 * maintenance routes block impersonated sessions. `requireRootTenant` keys
 * off `req.user.home_tenant`, which stays as the impersonator's home tenant
 * during impersonation; without `rejectImpersonation`, an Axerra admin could
 * preview/delete orphan portal_users while impersonating a tenant user, and
 * the audit trail (req.user.id is the impersonator in either case) wouldn't
 * distinguish the two contexts. Policy-catalog entries for
 * `tenants::orphan_portal_users::*` are still seeded so the role-configuration
 * UI can list these capabilities, but enforcement is tenant-membership based.
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import { Router } from 'express';
import { findOrphans, cleanupOrphan } from '../../controllers/orphanPortalUsersController.js';
import { requireRootTenant } from '../../../../middleware/requireRootTenant.js';
import { withMeta } from '../../../../middleware/withMeta.js';

const meta = withMeta({ module: 'tenants', router: 'orphan_portal_users' });

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
  meta,
  findOrphans,
);

router.post(
  '/orphans/cleanup',
  requireRootTenant,
  rejectImpersonation,
  meta,
  cleanupOrphan,
);

export default router;
