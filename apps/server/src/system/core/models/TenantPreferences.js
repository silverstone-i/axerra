/**
 * @file TenantPreferences model — extends TableModel for tenant UI preferences
 * @module core/models/TenantPreferences
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { TableModel } from 'pg-schemata';
import tenantPreferencesSchema from '../schemas/tenantPreferencesSchema.js';

export default class TenantPreferences extends TableModel {
  constructor(db, pgp, logger = null) {
    super(db, pgp, tenantPreferencesSchema, logger);
  }
}
