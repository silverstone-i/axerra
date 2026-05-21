/**
 * @file Internal Transfers router — /api/accounting/v1/internal-transfers
 * @module accounting/apiRoutes/v1/internalTransfersRouter
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import createRouter from '../../../../lib/createRouter.js';
import internalTransfersController from '../../controllers/internalTransfersController.js';
import { withMeta } from '../../../../middleware/withMeta.js';

const meta = withMeta({ module: 'accounting', router: 'internal-transfers' });

export default createRouter(internalTransfersController, null, {
  getMiddlewares: [meta],
  postMiddlewares: [meta],
  putMiddlewares: [meta],
  deleteMiddlewares: [meta],
  patchMiddlewares: [meta],
});
