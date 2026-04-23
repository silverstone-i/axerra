/**
 * @file PortalUsers router — user CRUD with custom /register endpoint per PRD §3.2.2
 * @module tenants/apiRoutes/v1/portalUsersRouter
 *
 * Standard POST is disabled; users must be created via /register.
 * All routes gated by requireRootTenant + RBAC (tenants::portal-users).
 *
 * Copyright (c) 2025 – present Vimber LLC. All rights reserved.
 */

import portalUsersController from '../../controllers/portalUsersController.js';
import createRouter from '../../../../lib/createRouter.js';
import { addAuditFields } from '../../../../middleware/addAuditFields.js';
import { requireRootTenant } from '../../../../middleware/requireRootTenant.js';
import { withMeta } from '../../../../middleware/withMeta.js';

const meta = withMeta({ module: 'tenants', router: 'portal-users' });

// Note: RBAC enforcement deferred to Phase 5 (no role_members exist yet).
// requireRootTenant gates all routes to Vimber users only.
export default createRouter(
  portalUsersController,
  (router) => {
    router.post(
      '/register',
      requireRootTenant,
      meta,
      addAuditFields,
      (req, res) => portalUsersController.register(req, res),
    );
  },
  {
    disablePost: true,
    getMiddlewares: [requireRootTenant, meta],
    putMiddlewares: [requireRootTenant, meta],
    deleteMiddlewares: [requireRootTenant, meta],
    patchMiddlewares: [requireRootTenant, meta],
  },
);
