/**
 * @file Tenants router — Axerra-only CRUD for tenant management per PRD §3.2.1
 * @module tenants/apiRoutes/v1/tenantsRouter
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import tenantsController from '../../controllers/tenantsController.js';
import createRouter from '../../../../lib/createRouter.js';
import { moduleEntitlement } from '../../../../middleware/moduleEntitlement.js';
import { requireRootTenant } from '../../../../middleware/requireRootTenant.js';
import { rbac } from '../../../../middleware/rbac.js';
import { withMeta } from '../../../../middleware/withMeta.js';

const meta = withMeta({ module: 'tenants', router: 'tenants' });

// Per-method middleware order, reading routes:
//   requireRootTenant → withMeta → moduleEntitlement → rbac → handler
// On mutation routes (POST/PUT/DELETE/PATCH) createRouter prepends
// addAuditFields, so the effective chain becomes:
//   addAuditFields → requireRootTenant → withMeta → moduleEntitlement → rbac → handler
// Including moduleEntitlement explicitly in the per-method arrays keeps
// it BEFORE rbac (createRouter would otherwise append it after).
//
// Spreadsheet I/O: tenants are importable/exportable per PRD §3.2.1, so
// /import-xls and /export-xls stay enabled. createRouter wires its own
// rbac on those routes after setImportAction/setExportAction, which
// AND-combines with our router-level rbac('full'): the first evaluation
// resolves against the generic POST action, the second against the
// 'import'/'export' action codes. Both must pass — finer-grained Axerra
// roles can grant CRUD without import, or import without CRUD.
// Bulk-insert/bulk-update remain disabled — admin tenant batch ops are
// always admin-only and the API doesn't expose them.
export default createRouter(
  tenantsController,
  (router) => {
    router.get(
      '/:id/modules',
      requireRootTenant,
      meta,
      moduleEntitlement,
      rbac('view'),
      (req, res) => tenantsController.getAllowedModules(req, res),
    );
    router.get(
      '/:id/contacts',
      requireRootTenant,
      meta,
      moduleEntitlement,
      rbac('view'),
      (req, res) => tenantsController.getContacts(req, res),
    );
    router.get(
      '/:id/company',
      requireRootTenant,
      meta,
      moduleEntitlement,
      rbac('view'),
      (req, res) => tenantsController.getCompany(req, res),
    );
  },
  {
    disableBulkInsert: true,
    disableBulkUpdate: true,
    disablePing: true,
    postMiddlewares: [requireRootTenant, meta, moduleEntitlement, rbac('full')],
    getMiddlewares: [requireRootTenant, meta, moduleEntitlement, rbac('view')],
    putMiddlewares: [requireRootTenant, meta, moduleEntitlement, rbac('full')],
    deleteMiddlewares: [requireRootTenant, meta, moduleEntitlement, rbac('full')],
    patchMiddlewares: [requireRootTenant, meta, moduleEntitlement, rbac('full')],
  },
);
