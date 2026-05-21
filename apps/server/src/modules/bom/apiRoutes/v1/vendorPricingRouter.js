/**
 * @file VendorPricing router — /api/bom/v1/vendor-pricing
 * @module bom/apiRoutes/v1/vendorPricingRouter
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import createRouter from '../../../../lib/createRouter.js';
import { withMeta } from '../../../../middleware/withMeta.js';
import vendorPricingController from '../../controllers/vendorPricingController.js';

const meta = withMeta({ module: 'bom', router: 'vendor-pricing' });

export default createRouter(vendorPricingController, null, {
  getMiddlewares: [meta],
  postMiddlewares: [meta],
  putMiddlewares: [meta],
  deleteMiddlewares: [meta],
  patchMiddlewares: [meta],
});
