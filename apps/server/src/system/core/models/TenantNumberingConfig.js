/**
 * @file TenantNumberingConfig model — extends TableModel for numbering configuration
 * @module core/models/TenantNumberingConfig
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { TableModel } from 'pg-schemata';
import tenantNumberingConfigSchema from '../schemas/tenantNumberingConfigSchema.js';

export default class TenantNumberingConfig extends TableModel {
  constructor(db, pgp, logger = null) {
    super(db, pgp, tenantNumberingConfigSchema, logger);
  }
}
