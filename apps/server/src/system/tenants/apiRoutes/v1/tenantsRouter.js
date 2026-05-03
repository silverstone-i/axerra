/**
 * @file Tenants router — Axerra-only CRUD for tenant management per PRD §3.2.1
 * @module tenants/apiRoutes/v1/tenantsRouter
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import tenantsController from '../../controllers/tenantsController.js';
import createRouter from '../../../../lib/createRouter.js';
import { requireRootTenant } from '../../../../middleware/requireRootTenant.js';
import { rbac } from '../../../../middleware/rbac.js';
import { withMeta } from '../../../../middleware/withMeta.js';

const meta = withMeta({ module: 'tenants', router: 'tenants' });

// Three-layer enforcement: requireRootTenant gates Axerra membership,
// withMeta sets the resource for rbac, and rbac() consults the
// tenants::tenants policy (cascades up to tenants:: and the ::::
// wildcard). Custom routes use view-level rbac since they're reads.
export default createRouter(
  tenantsController,
  (router) => {
    router.get(
      '/:id/modules',
      requireRootTenant,
      meta,
      rbac('view'),
      (req, res) => tenantsController.getAllowedModules(req, res),
    );
    router.get(
      '/:id/contacts',
      requireRootTenant,
      meta,
      rbac('view'),
      (req, res) => tenantsController.getContacts(req, res),
    );
    router.get(
      '/:id/company',
      requireRootTenant,
      meta,
      rbac('view'),
      (req, res) => tenantsController.getCompany(req, res),
    );
  },
  {
    postMiddlewares: [requireRootTenant, meta, rbac('full')],
    getMiddlewares: [requireRootTenant, meta, rbac('view')],
    putMiddlewares: [requireRootTenant, meta, rbac('full')],
    deleteMiddlewares: [requireRootTenant, meta, rbac('full')],
    patchMiddlewares: [requireRootTenant, meta, rbac('full')],
  },
);
