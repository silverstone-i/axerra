/**
 * @file Chart of Accounts router — /api/accounting/v1/chart-of-accounts
 * @module accounting/apiRoutes/v1/chartOfAccountsRouter
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import createRouter from '../../../../lib/createRouter.js';
import chartOfAccountsController from '../../controllers/chartOfAccountsController.js';
import { withMeta } from '../../../../middleware/withMeta.js';

const meta = withMeta({ module: 'accounting', router: 'chart-of-accounts' });

export default createRouter(chartOfAccountsController, null, {
  getMiddlewares: [meta],
  postMiddlewares: [meta],
  putMiddlewares: [meta],
  deleteMiddlewares: [meta],
  patchMiddlewares: [meta],
});
