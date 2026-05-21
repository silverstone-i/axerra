/**
 * @file BOM module route aggregator — mounts BOM sub-routers under /api/bom
 * @module bom/apiRoutes/v1/bomApiRoutes
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { Router } from 'express';
import catalogSkusRouter from './catalogSkusRouter.js';
import vendorSkusRouter from './vendorSkusRouter.js';
import vendorPricingRouter from './vendorPricingRouter.js';

const router = Router();

router.use('/v1/catalog-skus', catalogSkusRouter);
router.use('/v1/vendor-skus', vendorSkusRouter);
router.use('/v1/vendor-pricing', vendorPricingRouter);

export default router;
