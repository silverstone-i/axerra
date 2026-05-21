/**
 * @file Template units router — /api/projects/v1/template-units
 * @module projects/apiRoutes/v1/templateUnitsRouter
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import createRouter from '../../../../lib/createRouter.js';
import templateUnitsController from '../../controllers/templateUnitsController.js';
import { withMeta } from '../../../../middleware/withMeta.js';

const meta = withMeta({ module: 'projects', router: 'template-units' });

export default createRouter(templateUnitsController, null, {
  getMiddlewares: [meta],
  postMiddlewares: [meta],
  putMiddlewares: [meta],
  deleteMiddlewares: [meta],
  patchMiddlewares: [meta],
  disableImportXls: true,
  disableExportXls: true,
});
