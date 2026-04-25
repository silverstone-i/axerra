/**
 * @file Vendors router — /api/core/v1/vendors
 * @module core/apiRoutes/v1/vendorsRouter
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import multer from 'multer';
import createRouter from '../../../../lib/createRouter.js';
import vendorsController from '../../controllers/vendorsController.js';
import { moduleEntitlement } from '../../../../middleware/moduleEntitlement.js';
import { rbac } from '../../../../middleware/rbac.js';
import { withMeta } from '../../../../middleware/withMeta.js';

const meta = withMeta({ module: 'core', router: 'vendors' });
const upload = multer({ dest: '/tmp/uploads/' });

export default createRouter(
  vendorsController,
  (router) => {
    router.post(
      '/export-combined-xls',
      withMeta({ module: 'core', router: 'vendors', action: 'export' }),
      moduleEntitlement,
      rbac('view'),
      (req, res) => vendorsController.exportCombinedXls(req, res),
    );
    router.post(
      '/import-combined-xls',
      withMeta({ module: 'core', router: 'vendors', action: 'import' }),
      moduleEntitlement,
      rbac('full'),
      upload.single('file'),
      (req, res) => vendorsController.importCombinedXls(req, res),
    );
  },
  {
    getMiddlewares: [meta],
    postMiddlewares: [meta],
    putMiddlewares: [meta],
    deleteMiddlewares: [meta],
    patchMiddlewares: [meta],
  },
);
