/**
 * @file Tenants admin router — schema listing, impersonation per PRD §3.2.3
 * @module tenants/apiRoutes/v1/adminRouter
 *
 * Enforcement:
 *   - GET /schemas, POST /impersonate: requireRootTenant + rbac().
 *     Catalog rows tenants::admin::list_schemas (view) and ::impersonate
 *     (full) are independently grantable so finer-grained Axerra ops
 *     roles can hold one without the other.
 *   - POST /exit-impersonation, GET /impersonation-status: no rbac.
 *     Exit is an escape hatch — anyone in an impersonated session must
 *     always be able to exit. Status reads only the caller's own
 *     session state and leaks no data beyond that.
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import { Router } from 'express';
import { requireRootTenant } from '../../../../middleware/requireRootTenant.js';
import { moduleEntitlement } from '../../../../middleware/moduleEntitlement.js';
import { rbac } from '../../../../middleware/rbac.js';
import { withMeta } from '../../../../middleware/withMeta.js';
import {
  getAllSchemas,
  startImpersonation,
  endImpersonation,
  getImpersonationStatus,
} from '../../controllers/adminController.js';

const router = Router();

router.get(
  '/schemas',
  requireRootTenant,
  withMeta({ module: 'tenants', router: 'admin', action: 'list_schemas' }),
  moduleEntitlement,
  rbac('view'),
  getAllSchemas,
);
router.post(
  '/impersonate',
  requireRootTenant,
  withMeta({ module: 'tenants', router: 'admin', action: 'impersonate' }),
  moduleEntitlement,
  rbac('full'),
  startImpersonation,
);
router.post('/exit-impersonation', endImpersonation);
router.get('/impersonation-status', getImpersonationStatus);

export default router;
