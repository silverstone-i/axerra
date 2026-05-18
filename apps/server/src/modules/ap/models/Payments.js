/**
 * @file Payments model — extends TableModel
 * @module ap/models/Payments
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import { TableModel } from 'pg-schemata';
import paymentsSchema from '../schemas/paymentsSchema.js';
import { importSimpleTable } from '../../../lib/spreadsheetHelpers.js';

export default class Payments extends TableModel {
  constructor(db, pgp, logger = null) {
    super(db, pgp, paymentsSchema, logger);
  }

  async importFromSpreadsheet(filePath, _sheetIndex = 0, callbackFn = null, _returning = null, options = {}) {
    return importSimpleTable(this, filePath, callbackFn, options);
  }
}
