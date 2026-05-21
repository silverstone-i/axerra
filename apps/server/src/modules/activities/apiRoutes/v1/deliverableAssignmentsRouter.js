/**
 * @file DeliverableAssignments router — /api/activities/v1/deliverable-assignments
 * @module activities/apiRoutes/v1/deliverableAssignmentsRouter
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import createRouter from '../../../../lib/createRouter.js';
import { withMeta } from '../../../../middleware/withMeta.js';
import deliverableAssignmentsController from '../../controllers/deliverableAssignmentsController.js';

const meta = withMeta({ module: 'activities', router: 'deliverables' });

export default createRouter(deliverableAssignmentsController, null, {
  getMiddlewares: [meta],
  postMiddlewares: [meta],
  putMiddlewares: [meta],
  deleteMiddlewares: [meta],
  patchMiddlewares: [meta],
  disableImportXls: true,
  disableExportXls: true,
});
