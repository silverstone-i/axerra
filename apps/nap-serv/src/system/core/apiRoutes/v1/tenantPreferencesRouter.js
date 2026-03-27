/**
 * @file Tenant preferences router — /api/core/v1/tenant-preferences
 * @module core/apiRoutes/v1/tenantPreferencesRouter
 *
 * Preferences row is pre-seeded during tenant provisioning.
 * Only GET and PUT are needed.
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
 */

import createRouter from '../../../../lib/createRouter.js';
import tenantPreferencesController from '../../controllers/tenantPreferencesController.js';
import { withMeta } from '../../../../middleware/withMeta.js';

const meta = withMeta({ module: 'core', router: 'tenant-preferences' });

export default createRouter(tenantPreferencesController, null, {
  getMiddlewares: [meta],
  putMiddlewares: [meta],
  disablePost: true,
  disableDelete: true,
  disablePatch: true,
  disableBulkInsert: true,
  disableImportXls: true,
  disableExportXls: true,
});
