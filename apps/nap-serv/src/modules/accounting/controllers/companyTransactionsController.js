/**
 * @file Company Transactions controller — CRUD with module validation
 * @module accounting/controllers/companyTransactionsController
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
 */

import BaseController from '../../../lib/BaseController.js';

const VALID_MODULES = ['ar', 'ap', 'je'];

class CompanyTransactionsController extends BaseController {
  constructor() {
    super('companyTransactions', 'company-transaction');
    this.rbacConfig = { module: 'accounting', router: 'company-transactions' };
  }

  async create(req, res) {
    if (req.body.module && !VALID_MODULES.includes(req.body.module)) {
      return res.status(400).json({
        error: `Invalid module: ${req.body.module}. Must be one of: ${VALID_MODULES.join(', ')}`,
      });
    }
    return super.create(req, res);
  }
}

const instance = new CompanyTransactionsController();
export default instance;
export { CompanyTransactionsController, VALID_MODULES };
