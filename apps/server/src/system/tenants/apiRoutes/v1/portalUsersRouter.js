/**
 * @file PortalUsers router — user CRUD with custom /register endpoint per PRD §3.2.2
 * @module tenants/apiRoutes/v1/portalUsersRouter
 *
 * Standard POST is disabled; users must be created via /register.
 * All routes gated by requireRootTenant + RBAC (tenants::portal-users).
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import portalUsersController from '../../controllers/portalUsersController.js';
import createRouter from '../../../../lib/createRouter.js';
import { addAuditFields } from '../../../../middleware/addAuditFields.js';
import { moduleEntitlement } from '../../../../middleware/moduleEntitlement.js';
import { requireRootTenant } from '../../../../middleware/requireRootTenant.js';
import { rbac } from '../../../../middleware/rbac.js';
import { withMeta } from '../../../../middleware/withMeta.js';

const meta = withMeta({ module: 'tenants', router: 'portal-users' });

// Per-method middleware order, reading routes:
//   requireRootTenant → withMeta → moduleEntitlement → rbac → handler
// On mutation routes (PUT/DELETE/PATCH) createRouter prepends
// addAuditFields, so the effective chain becomes:
//   addAuditFields → requireRootTenant → withMeta → moduleEntitlement → rbac → handler
//
// Standard POST is disabled (use /register, which assembles its own
// chain explicitly with addAuditFields in last position).
// disableBulkInsert/disableBulkUpdate/disableImportXls/disableExportXls:
// portal_users are auth-side records, not data-import surfaces — the
// auto-attached endpoints would bypass requireRootTenant since
// disablePost only affects POST /, leaving POST /bulk-insert and
// POST /import-xls live with no per-method middleware applied.
export default createRouter(
  portalUsersController,
  (router) => {
    router.post(
      '/register',
      requireRootTenant,
      meta,
      moduleEntitlement,
      rbac('full'),
      addAuditFields,
      (req, res) => portalUsersController.register(req, res),
    );
  },
  {
    disablePost: true,
    disableBulkInsert: true,
    disableBulkUpdate: true,
    disableImportXls: true,
    disableExportXls: true,
    disablePing: true,
    getMiddlewares: [requireRootTenant, meta, moduleEntitlement, rbac('view')],
    putMiddlewares: [requireRootTenant, meta, moduleEntitlement, rbac('full')],
    deleteMiddlewares: [requireRootTenant, meta, moduleEntitlement, rbac('full')],
    patchMiddlewares: [requireRootTenant, meta, moduleEntitlement, rbac('full')],
  },
);
