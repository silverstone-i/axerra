/**
 * @file TenantPreferences model — extends TableModel for tenant UI preferences
 * @module core/models/TenantPreferences
 *
 * Copyright (c) 2025 – present Vimber LLC. All rights reserved.
 */

import { TableModel } from 'pg-schemata';
import tenantPreferencesSchema from '../schemas/tenantPreferencesSchema.js';

export default class TenantPreferences extends TableModel {
  constructor(db, pgp, logger = null) {
    super(db, pgp, tenantPreferencesSchema, logger);
  }
}
