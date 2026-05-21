/**
 * @file Posting Queues router — /api/accounting/v1/posting-queues
 * @module accounting/apiRoutes/v1/postingQueuesRouter
 *
 * Includes custom POST /retry endpoint for retrying failed posting queue entries.
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { Router } from 'express';
import createRouter from '../../../../lib/createRouter.js';
import { addAuditFields } from '../../../../middleware/addAuditFields.js';
import { withMeta } from '../../../../middleware/withMeta.js';
import { moduleEntitlement } from '../../../../middleware/moduleEntitlement.js';
import { rbac } from '../../../../middleware/rbac.js';
import postingQueuesController from '../../controllers/postingQueuesController.js';

const router = Router();
const meta = withMeta({ module: 'accounting', router: 'posting-queues' });

router.post(
  '/retry',
  withMeta({ module: 'accounting', router: 'posting-queues', action: 'retry' }),
  moduleEntitlement,
  addAuditFields,
  rbac('full'),
  (req, res) => postingQueuesController.retry(req, res),
);

router.use('/', createRouter(postingQueuesController, null, {
  getMiddlewares: [meta],
  postMiddlewares: [meta],
  putMiddlewares: [meta],
  deleteMiddlewares: [meta],
  patchMiddlewares: [meta],
}));

export default router;
