/**
 * @file MatchReviewLogs router — /api/tenants/v1/match-review-logs
 * @module tenants/apiRoutes/v1/matchReviewLogsRouter
 *
 * Read-only routes for match review audit logs.
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import createRouter from '../../../../lib/createRouter.js';
import matchReviewLogsController from '../../controllers/matchReviewLogsController.js';
import { requireRootTenant } from '../../../../middleware/requireRootTenant.js';
import { rbac } from '../../../../middleware/rbac.js';
import { withMeta } from '../../../../middleware/withMeta.js';

const meta = withMeta({ module: 'tenants', router: 'match-review-logs' });

// Read-only audit log surface. requireRootTenant + view-level rbac;
// no mutations.
export default createRouter(matchReviewLogsController, null, {
  disablePost: true,
  disablePut: true,
  disableDelete: true,
  disablePatch: true,
  disableBulkInsert: true,
  disableBulkUpdate: true,
  disableImportXls: true,
  getMiddlewares: [requireRootTenant, meta, rbac('view')],
});
