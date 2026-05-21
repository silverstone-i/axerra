/**
 * @file Company Accounts router — /api/accounting/v1/company-accounts
 * @module accounting/apiRoutes/v1/companyAccountsRouter
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import createRouter from '../../../../lib/createRouter.js';
import companyAccountsController from '../../controllers/companyAccountsController.js';
import { withMeta } from '../../../../middleware/withMeta.js';

const meta = withMeta({ module: 'accounting', router: 'company-accounts' });

export default createRouter(companyAccountsController, null, {
  getMiddlewares: [meta],
  postMiddlewares: [meta],
  putMiddlewares: [meta],
  deleteMiddlewares: [meta],
  patchMiddlewares: [meta],
});
