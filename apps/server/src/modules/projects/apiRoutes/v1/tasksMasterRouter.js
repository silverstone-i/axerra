/**
 * @file Tasks master router — /api/projects/v1/tasks-master
 * @module projects/apiRoutes/v1/tasksMasterRouter
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import createRouter from '../../../../lib/createRouter.js';
import tasksMasterController from '../../controllers/tasksMasterController.js';
import { withMeta } from '../../../../middleware/withMeta.js';

const meta = withMeta({ module: 'projects', router: 'tasks-master' });

export default createRouter(tasksMasterController, null, {
  getMiddlewares: [meta],
  postMiddlewares: [meta],
  putMiddlewares: [meta],
  deleteMiddlewares: [meta],
  patchMiddlewares: [meta],
});
