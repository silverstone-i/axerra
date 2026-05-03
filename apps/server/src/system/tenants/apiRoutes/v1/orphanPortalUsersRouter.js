/**
 * @file Orphan portal_users router — Axerra-only maintenance API
 * @module tenants/apiRoutes/v1/orphanPortalUsersRouter
 *
 * Mounted at /api/tenants/v1/orphan-portal-users:
 *   GET  /orphans/preview   → list orphan portal_users
 *   POST /orphans/cleanup   → hard-delete one orphan by id
 *
 * Two-layer enforcement, in order:
 *   1. requireRootTenant — only Axerra-tenant users may reach these routes.
 *   2. rejectImpersonation — even an Axerra user must be in a direct (non-
 *      impersonated) session. Without this an Axerra admin could hit these
 *      destructive routes from an impersonated tenant-user-shaped session
 *      and the audit log wouldn't distinguish the two contexts.
 *
 * The `tenants/*` router convention enforces Axerra-only via tenant
 * membership rather than role-based rbac() — every other tenants/*
 * route does the same. The `tenants::orphan_portal_users::*` catalog
 * entries are seeded (with `policy_required: false`) so the action codes
 * are discoverable in role tooling, but they aren't independently
 * grantable; enforcement on these routes is tenant-membership based.
 * Wiring rbac across the tenants/* surface is a coordinated change that
 * also needs the platform-deploy role provisioning of the Axerra root
 * user (and the test bootstrap) — out of scope for this PR.
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
