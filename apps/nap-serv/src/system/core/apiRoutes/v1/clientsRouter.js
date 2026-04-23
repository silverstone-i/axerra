/**
 * @file Clients router — /api/core/v1/clients
 * @module core/apiRoutes/v1/clientsRouter
 *
 * Copyright (c) 2025 – present Vimber LLC. All rights reserved.
 */

import createRouter from '../../../../lib/createRouter.js';
import clientsController from '../../controllers/clientsController.js';
import { addAuditFields } from '../../../../middleware/addAuditFields.js';
import { moduleEntitlement } from '../../../../middleware/moduleEntitlement.js';
import { rbac } from '../../../../middleware/rbac.js';
import { withMeta } from '../../../../middleware/withMeta.js';

const meta = withMeta({ module: 'core', router: 'clients' });

export default createRouter(
  clientsController,
  (router) => {
    router.post(
      '/:id/reset-password',
      withMeta({ module: 'core', router: 'clients', action: 'reset-password' }),
      moduleEntitlement,
      addAuditFields,
      rbac('full'),
      (req, res) => clientsController.resetPassword(req, res),
    );
  },
  {
    getMiddlewares: [meta],
    postMiddlewares: [meta],
    putMiddlewares: [meta],
    deleteMiddlewares: [meta],
    patchMiddlewares: [meta],
  },
);
