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
import { moduleEntitlement } from '../../../../middleware/moduleEntitlement.js';
import { requireRootTenant } from '../../../../middleware/requireRootTenant.js';
import { rbac } from '../../../../middleware/rbac.js';
import { withMeta } from '../../../../middleware/withMeta.js';

const meta = withMeta({ module: 'tenants', router: 'match-review-logs' });

// Read-only audit log surface. requireRootTenant → meta →
// moduleEntitlement → rbac('view'); no mutations.
//
// disableExportXls: createRouter would otherwise auto-attach POST
// /export-xls and run its OWN rbac() pass after this middleware chain
// — that double-evaluates rbac with two different action codes
// (router-level then 'export'). Audit-log download isn't a current
// product requirement; leaving it disabled keeps the enforcement
// story simple. Re-enable here only after refactoring createRouter
// to set the action code BEFORE the per-method middleware chain.
export default createRouter(matchReviewLogsController, null, {
  disablePost: true,
  disablePut: true,
  disableDelete: true,
  disablePatch: true,
  disableBulkInsert: true,
  disableBulkUpdate: true,
  disableImportXls: true,
  disableExportXls: true,
  getMiddlewares: [requireRootTenant, meta, moduleEntitlement, rbac('view')],
});
