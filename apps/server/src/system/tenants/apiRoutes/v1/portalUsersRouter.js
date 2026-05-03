/**
 * @file PortalUsers router — user CRUD with custom /register endpoint per PRD §3.2.2
 * @module tenants/apiRoutes/v1/portalUsersRouter
 *
 * Standard POST is disabled; users must be created via /register.
 * All routes gated by requireRootTenant + RBAC (tenants::portal-users).
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import portalUsersController from '../../controllers/portalUsersController.js';
import createRouter from '../../../../lib/createRouter.js';
import { addAuditFields } from '../../../../middleware/addAuditFields.js';
import { requireRootTenant } from '../../../../middleware/requireRootTenant.js';
import { rbac } from '../../../../middleware/rbac.js';
import { withMeta } from '../../../../middleware/withMeta.js';

const meta = withMeta({ module: 'tenants', router: 'portal-users' });

// Three-layer enforcement: requireRootTenant + meta + rbac. Standard
// POST is disabled (use /register). The /register custom route is a
// 'full'-level mutation since it provisions a new portal_user.
export default createRouter(
  portalUsersController,
  (router) => {
    router.post(
      '/register',
      requireRootTenant,
      meta,
      rbac('full'),
      addAuditFields,
      (req, res) => portalUsersController.register(req, res),
    );
  },
  {
    disablePost: true,
    getMiddlewares: [requireRootTenant, meta, rbac('view')],
    putMiddlewares: [requireRootTenant, meta, rbac('full')],
    deleteMiddlewares: [requireRootTenant, meta, rbac('full')],
    patchMiddlewares: [requireRootTenant, meta, rbac('full')],
  },
);
