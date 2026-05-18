/**
 * @file Activities model — extends TableModel for activity entities
 * @module activities/models/Activities
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import { TableModel } from 'pg-schemata';
import activitiesSchema from '../schemas/activitiesSchema.js';
import { importSimpleTable } from '../../../lib/spreadsheetHelpers.js';

export default class Activities extends TableModel {
  constructor(db, pgp, logger = null) {
    super(db, pgp, activitiesSchema, logger);
  }

  async importFromSpreadsheet(filePath, _sheetIndex = 0, callbackFn = null, _returning = null, options = {}) {
    return importSimpleTable(this, filePath, callbackFn, options);
  }
}
