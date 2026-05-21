/**
 * @file Project clients router — /api/projects/v1/project-clients
 * @module projects/apiRoutes/v1/projectClientsRouter
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import createRouter from '../../../../lib/createRouter.js';
import projectClientsController from '../../controllers/projectClientsController.js';
import { withMeta } from '../../../../middleware/withMeta.js';

const meta = withMeta({ module: 'projects', router: 'projects' });

export default createRouter(projectClientsController, null, {
  getMiddlewares: [meta],
  postMiddlewares: [meta],
  putMiddlewares: [meta],
  deleteMiddlewares: [meta],
  patchMiddlewares: [meta],
});
