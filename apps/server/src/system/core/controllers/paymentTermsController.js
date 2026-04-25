/**
 * @file Payment terms controller — standard CRUD for payment terms settings
 * @module core/controllers/paymentTermsController
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import BaseController from '../../../lib/BaseController.js';

class PaymentTermsController extends BaseController {
  constructor() {
    super('paymentTerms');
    this.rbacConfig = { module: 'core', router: 'payment-terms' };
  }

  async create(req, res) {
    if (!req.body.tenant_id && req.user?.tenant_id) {
      req.body.tenant_id = req.user.tenant_id;
    }
    return super.create(req, res);
  }
}

const instance = new PaymentTermsController();
export default instance;
export { PaymentTermsController };
