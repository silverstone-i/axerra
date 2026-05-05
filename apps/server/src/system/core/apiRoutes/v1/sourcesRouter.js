/**
 * @file Sources router — /api/core/v1/sources
 * @module core/apiRoutes/v1/sourcesRouter
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import createRouter from '../../../../lib/createRouter.js';
import sourcesController from '../../controllers/sourcesController.js';
import { withMeta } from '../../../../middleware/withMeta.js';
import { moduleEntitlement } from '../../../../middleware/moduleEntitlement.js';
import { rbac } from '../../../../middleware/rbac.js';

const meta = withMeta({ module: 'core', router: 'sources' });

// Custom route paths use two segments because createRouter registers GET /:id
// before extendRoutes; a single-segment GET would be captured by it.
// extendRoutes bypasses createRouter's auto-injection, so middleware
// (withMeta → moduleEntitlement → rbac) is wired explicitly here.
export default createRouter(
  sourcesController,
  (router) => {
    router.get(
      '/orphans/preview',
      withMeta({ module: 'core', router: 'sources', action: 'find_orphans' }),
      moduleEntitlement,
      rbac('view'),
      (req, res) => sourcesController.findOrphanSources(req, res),
    );
    router.post(
      '/orphans/cleanup',
      withMeta({ module: 'core', router: 'sources', action: 'cleanup_orphans' }),
      moduleEntitlement,
      rbac('full'),
      (req, res) => sourcesController.cleanupOrphanSources(req, res),
    );
  },
  {
    getMiddlewares: [meta],
    postMiddlewares: [meta],
    putMiddlewares: [meta],
    deleteMiddlewares: [meta],
    patchMiddlewares: [meta],
    disableImportXls: true,
    disableExportXls: true,
  },
);
