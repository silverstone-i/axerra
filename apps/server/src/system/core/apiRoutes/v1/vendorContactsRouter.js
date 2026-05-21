/**
 * @file Vendor contacts router — /api/core/v1/vendor-contacts
 * @module core/apiRoutes/v1/vendorContactsRouter
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import createRouter from '../../../../lib/createRouter.js';
import vendorContactsController from '../../controllers/vendorContactsController.js';
import { addAuditFields } from '../../../../middleware/addAuditFields.js';
import { moduleEntitlement } from '../../../../middleware/moduleEntitlement.js';
import { rbac } from '../../../../middleware/rbac.js';
import { withMeta } from '../../../../middleware/withMeta.js';

const meta = withMeta({ module: 'core', router: 'vendor-contacts' });

export default createRouter(
  vendorContactsController,
  (router) => {
    router.post(
      '/:id/reset-password',
      withMeta({ module: 'core', router: 'vendor-contacts', action: 'reset-password' }),
      moduleEntitlement,
      addAuditFields,
      rbac('full'),
      (req, res) => vendorContactsController.resetPassword(req, res),
    );
    router.put(
      '/:id/swap-login-email',
      withMeta({ module: 'core', router: 'vendor-contacts', action: 'swap-login-email' }),
      moduleEntitlement,
      addAuditFields,
      rbac('full'),
      (req, res) => vendorContactsController.swapLoginEmail(req, res),
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
