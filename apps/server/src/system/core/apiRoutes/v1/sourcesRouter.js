/**
 * @file Sources router — /api/core/v1/sources
 * @module core/apiRoutes/v1/sourcesRouter
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import createRouter from '../../../../lib/createRouter.js';
import sourcesController from '../../controllers/sourcesController.js';
import { withMeta } from '../../../../middleware/withMeta.js';

const meta = withMeta({ module: 'core', router: 'sources' });

export default createRouter(sourcesController, undefined, {
  getMiddlewares: [meta],
  postMiddlewares: [meta],
  putMiddlewares: [meta],
  deleteMiddlewares: [meta],
  patchMiddlewares: [meta],
  disableImportXls: true,
  disableExportXls: true,
});
