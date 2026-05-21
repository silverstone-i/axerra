/**
 * @file VendorPricing controller — standard CRUD
 * @module bom/controllers/vendorPricingController
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import BaseController from '../../../lib/BaseController.js';

class VendorPricingController extends BaseController {
  constructor() {
    super('vendorPricing', 'vendor-pricing');
    this.rbacConfig = { module: 'bom', router: 'vendor-pricing' };
  }
}

const instance = new VendorPricingController();
export default instance;
export { VendorPricingController };
