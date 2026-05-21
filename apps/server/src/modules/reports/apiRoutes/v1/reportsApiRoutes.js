/**
 * @file Reports module route aggregator — mounts reports router under /api/reports
 * @module reports/apiRoutes/v1/reportsApiRoutes
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { Router } from 'express';
import reportsRouter from './reportsRouter.js';

const router = Router();
router.use('/v1', reportsRouter);

export default router;
