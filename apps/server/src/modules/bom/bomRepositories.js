/**
 * @file Repository map for the BOM module (tenant-scope)
 * @module bom/bomRepositories
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import CatalogSkus from './models/CatalogSkus.js';
import VendorSkus from './models/VendorSkus.js';
import VendorPricing from './models/VendorPricing.js';

const repositories = {
  catalogSkus: CatalogSkus,
  vendorSkus: VendorSkus,
  vendorPricing: VendorPricing,
};

export default repositories;
