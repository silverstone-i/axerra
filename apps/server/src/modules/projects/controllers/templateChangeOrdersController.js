/**
 * @file Template change orders controller — standard CRUD
 * @module projects/controllers/templateChangeOrdersController
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import BaseController from '../../../lib/BaseController.js';

class TemplateChangeOrdersController extends BaseController {
  constructor() {
    super('templateChangeOrders');
    this.rbacConfig = { module: 'projects', router: 'template-change-orders' };
  }
}

const instance = new TemplateChangeOrdersController();
export default instance;
export { TemplateChangeOrdersController };
