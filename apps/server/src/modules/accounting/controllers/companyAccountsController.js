/**
 * @file Company Accounts controller — standard CRUD
 * @module accounting/controllers/companyAccountsController
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import BaseController from '../../../lib/BaseController.js';

class CompanyAccountsController extends BaseController {
  constructor() {
    super('companyAccounts', 'company-account');
    this.rbacConfig = { module: 'accounting', router: 'company-accounts' };
  }
}

const instance = new CompanyAccountsController();
export default instance;
export { CompanyAccountsController };
