/**
 * @file Cost items router — /api/projects/v1/cost-items
 * @module projects/apiRoutes/v1/costItemsRouter
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import createRouter from '../../../../lib/createRouter.js';
import costItemsController from '../../controllers/costItemsController.js';
import { withMeta } from '../../../../middleware/withMeta.js';

const meta = withMeta({ module: 'projects', router: 'tasks' });

export default createRouter(costItemsController, null, {
  getMiddlewares: [meta],
  postMiddlewares: [meta],
  putMiddlewares: [meta],
  deleteMiddlewares: [meta],
  patchMiddlewares: [meta],
  disableImportXls: true,
  disableExportXls: true,
});
