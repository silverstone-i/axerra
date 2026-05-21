/**
 * @file VendorPricing model — extends TableModel for time-based vendor pricing
 * @module bom/models/VendorPricing
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { TableModel } from 'pg-schemata';
import vendorPricingSchema from '../schemas/vendorPricingSchema.js';

export default class VendorPricing extends TableModel {
  constructor(db, pgp, logger = null) {
    super(db, pgp, vendorPricingSchema, logger);
  }
}
