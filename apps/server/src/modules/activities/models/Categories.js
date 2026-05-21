/**
 * @file Categories model — extends TableModel for cost category entities
 * @module activities/models/Categories
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { TableModel } from 'pg-schemata';
import categoriesSchema from '../schemas/categoriesSchema.js';
import { importSimpleTable } from '../../../lib/spreadsheetHelpers.js';

export default class Categories extends TableModel {
  constructor(db, pgp, logger = null) {
    super(db, pgp, categoriesSchema, logger);
  }

  async importFromSpreadsheet(filePath, _sheetIndex = 0, callbackFn = null, _returning = null, options = {}) {
    return importSimpleTable(this, filePath, callbackFn, options);
  }
}
