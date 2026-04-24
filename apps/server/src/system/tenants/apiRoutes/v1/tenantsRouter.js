/**
 * @file Tenants router — Vimber-only CRUD for tenant management per PRD §3.2.1
 * @module tenants/apiRoutes/v1/tenantsRouter
 *
 * Copyright (c) 2025 – present Vimber LLC. All rights reserved.
 */

import tenantsController from '../../controllers/tenantsController.js';
import createRouter from '../../../../lib/createRouter.js';
import { requireRootTenant } from '../../../../middleware/requireRootTenant.js';
import { withMeta } from '../../../../middleware/withMeta.js';

const meta = withMeta({ module: 'tenants', router: 'tenants' });

// requireRootTenant gates all routes to Vimber users only.
// RBAC not applied — access control relies on requireRootTenant + moduleEntitlement.
export default createRouter(
  tenantsController,
  (router) => {
    router.get(
      '/:id/modules',
      requireRootTenant,
      meta,
      (req, res) => tenantsController.getAllowedModules(req, res),
    );
    router.get(
      '/:id/contacts',
      requireRootTenant,
      meta,
      (req, res) => tenantsController.getContacts(req, res),
    );
    router.get(
      '/:id/company',
      requireRootTenant,
      meta,
      (req, res) => tenantsController.getCompany(req, res),
    );
  },
  {
    postMiddlewares: [requireRootTenant, meta],
    getMiddlewares: [requireRootTenant, meta],
    putMiddlewares: [requireRootTenant, meta],
    deleteMiddlewares: [requireRootTenant, meta],
    patchMiddlewares: [requireRootTenant, meta],
  },
);
