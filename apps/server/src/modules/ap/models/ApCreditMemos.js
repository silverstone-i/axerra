/**
 * @file ApCreditMemos model — extends TableModel
 * @module ap/models/ApCreditMemos
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import { TableModel } from 'pg-schemata';
import apCreditMemosSchema from '../schemas/apCreditMemosSchema.js';
import { importSimpleTable } from '../../../lib/spreadsheetHelpers.js';

export default class ApCreditMemos extends TableModel {
  constructor(db, pgp, logger = null) {
    super(db, pgp, apCreditMemosSchema, logger);
  }

  async importFromSpreadsheet(filePath, _sheetIndex = 0, callbackFn = null, _returning = null, options = {}) {
    return importSimpleTable(this, filePath, callbackFn, options);
  }
}
