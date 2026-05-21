/**
 * @file Tenants module route aggregator — mounts tenant sub-routers under /api/tenants
 * @module tenants/apiRoutes/v1/tenantsApiRoutes
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { Router } from 'express';
import tenantsRouter from './tenantsRouter.js';
import portalUsersRouter from './portalUsersRouter.js';
import orphanPortalUsersRouter from './orphanPortalUsersRouter.js';
import adminRouter from './adminRouter.js';
import matchReviewLogsRouter from './matchReviewLogsRouter.js';
const router = Router();

router.use('/v1/tenants', tenantsRouter);
router.use('/v1/portal-users', portalUsersRouter);
router.use('/v1/orphan-portal-users', orphanPortalUsersRouter);
router.use('/v1/admin', adminRouter);
router.use('/v1/match-review-logs', matchReviewLogsRouter);

export default router;
