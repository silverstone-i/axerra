/**
 * @file Budgets router — /api/activities/v1/budgets
 * @module activities/apiRoutes/v1/budgetsRouter
 *
 * Includes custom POST /new-version route for budget versioning.
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import createRouter from '../../../../lib/createRouter.js';
import { moduleEntitlement } from '../../../../middleware/moduleEntitlement.js';
import { withMeta } from '../../../../middleware/withMeta.js';
import { rbac } from '../../../../middleware/rbac.js';
import budgetsController from '../../controllers/budgetsController.js';

const meta = withMeta({ module: 'activities', router: 'budgets' });

const router = createRouter(budgetsController, null, {
  getMiddlewares: [meta],
  postMiddlewares: [meta],
  putMiddlewares: [meta],
  deleteMiddlewares: [meta],
  patchMiddlewares: [meta],
});

// Custom route for creating a new budget version
router.post(
  '/new-version',
  withMeta({ module: 'activities', router: 'budgets', action: 'new-version' }),
  moduleEntitlement,
  rbac('full'),
  (req, res) => budgetsController.createNewVersion(req, res),
);

export default router;
