/**
 * @file Orphan portal_users router — Axerra-only maintenance API
 * @module tenants/apiRoutes/v1/orphanPortalUsersRouter
 *
 * Mounted at /api/tenants/v1/orphan-portal-users:
 *   GET  /orphans/preview   → list orphan portal_users
 *   POST /orphans/cleanup   → hard-delete one orphan by id
 *
 * Mirrors the established `tenants/*` router convention: Axerra-only routes
 * are gated by `requireRootTenant` only — no RBAC layer. Policy-catalog
 * entries for `tenants::orphan_portal_users::*` are still seeded so the
 * role-configuration UI can list these capabilities, but enforcement is
 * tenant-membership based.
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import { Router } from 'express';
import { findOrphans, cleanupOrphan } from '../../controllers/orphanPortalUsersController.js';
import { requireRootTenant } from '../../../../middleware/requireRootTenant.js';
import { withMeta } from '../../../../middleware/withMeta.js';

const meta = withMeta({ module: 'tenants', router: 'orphan_portal_users' });

const router = Router();

router.get(
  '/orphans/preview',
  requireRootTenant,
  meta,
  findOrphans,
);

router.post(
  '/orphans/cleanup',
  requireRootTenant,
  meta,
  cleanupOrphan,
);

export default router;
