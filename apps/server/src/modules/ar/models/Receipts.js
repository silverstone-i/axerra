/**
 * @file Receipts model — extends TableModel
 * @module ar/models/Receipts
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import { TableModel } from 'pg-schemata';
import receiptsSchema from '../schemas/receiptsSchema.js';
import { importSimpleTable } from '../../../lib/spreadsheetHelpers.js';

export default class Receipts extends TableModel {
  constructor(db, pgp, logger = null) {
    super(db, pgp, receiptsSchema, logger);
  }

  async importFromSpreadsheet(filePath, _sheetIndex = 0, callbackFn = null, _returning = null, options = {}) {
    return importSimpleTable(this, filePath, callbackFn, options);
  }
}
