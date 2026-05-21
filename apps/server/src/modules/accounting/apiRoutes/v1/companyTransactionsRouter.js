/**
 * @file Company Transactions router — /api/accounting/v1/company-transactions
 * @module accounting/apiRoutes/v1/companyTransactionsRouter
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import createRouter from '../../../../lib/createRouter.js';
import companyTransactionsController from '../../controllers/companyTransactionsController.js';
import { withMeta } from '../../../../middleware/withMeta.js';

const meta = withMeta({ module: 'accounting', router: 'company-transactions' });

export default createRouter(companyTransactionsController, null, {
  getMiddlewares: [meta],
  postMiddlewares: [meta],
  putMiddlewares: [meta],
  deleteMiddlewares: [meta],
  patchMiddlewares: [meta],
});
