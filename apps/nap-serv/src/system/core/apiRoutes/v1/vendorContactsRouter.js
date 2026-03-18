/**
 * @file Vendor contacts router — /api/core/v1/vendor-contacts
 * @module core/apiRoutes/v1/vendorContactsRouter
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
 */

import createRouter from '../../../../lib/createRouter.js';
import vendorContactsController from '../../controllers/vendorContactsController.js';
import { withMeta } from '../../../../middleware/withMeta.js';

const meta = withMeta({ module: 'core' });

export default createRouter(vendorContactsController, null, {
  getMiddlewares: [meta],
  postMiddlewares: [meta],
  putMiddlewares: [meta],
  deleteMiddlewares: [meta],
  patchMiddlewares: [meta],
});
