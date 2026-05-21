/**
 * @file Activities controller — standard CRUD
 * @module activities/controllers/activitiesController
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import BaseController from '../../../lib/BaseController.js';

class ActivitiesController extends BaseController {
  constructor() {
    super('activities', 'activity');
    this.rbacConfig = { module: 'activities', router: 'activities' };
  }
}

const instance = new ActivitiesController();
export default instance;
export { ActivitiesController };
