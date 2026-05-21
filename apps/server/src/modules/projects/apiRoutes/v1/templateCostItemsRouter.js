/**
 * @file Template cost items router — /api/projects/v1/template-cost-items
 * @module projects/apiRoutes/v1/templateCostItemsRouter
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import createRouter from '../../../../lib/createRouter.js';
import templateCostItemsController from '../../controllers/templateCostItemsController.js';
import { withMeta } from '../../../../middleware/withMeta.js';

const meta = withMeta({ module: 'projects', router: 'template-units' });

export default createRouter(templateCostItemsController, null, {
  getMiddlewares: [meta],
  postMiddlewares: [meta],
  putMiddlewares: [meta],
  deleteMiddlewares: [meta],
  patchMiddlewares: [meta],
  disableImportXls: true,
  disableExportXls: true,
});
