/**
 * @file Tasks controller — standard CRUD for unit tasks
 * @module projects/controllers/tasksController
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import BaseController from '../../../lib/BaseController.js';

class TasksController extends BaseController {
  constructor() {
    super('tasks');
    this.rbacConfig = { module: 'projects', router: 'tasks' };
  }
}

const instance = new TasksController();
export default instance;
export { TasksController };
