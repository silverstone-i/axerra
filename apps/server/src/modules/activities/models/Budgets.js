/**
 * @file Budgets model — extends TableModel for budget version management
 * @module activities/models/Budgets
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import { TableModel } from 'pg-schemata';
import budgetsSchema from '../schemas/budgetsSchema.js';
import { importSimpleTable } from '../../../lib/spreadsheetHelpers.js';

export default class Budgets extends TableModel {
  constructor(db, pgp, logger = null) {
    super(db, pgp, budgetsSchema, logger);
  }

  async importFromSpreadsheet(filePath, _sheetIndex = 0, callbackFn = null, _returning = null, options = {}) {
    return importSimpleTable(this, filePath, callbackFn, options);
  }
}
