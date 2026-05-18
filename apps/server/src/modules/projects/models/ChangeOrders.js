/**
 * @file ChangeOrders model
 * @module projects/models/ChangeOrders
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import { TableModel } from 'pg-schemata';
import changeOrdersSchema from '../schemas/changeOrdersSchema.js';
import { importSimpleTable } from '../../../lib/spreadsheetHelpers.js';

export default class ChangeOrders extends TableModel {
  constructor(db, pgp, logger = null) {
    super(db, pgp, changeOrdersSchema, logger);
  }

  async importFromSpreadsheet(filePath, _sheetIndex = 0, callbackFn = null, _returning = null, options = {}) {
    return importSimpleTable(this, filePath, callbackFn, options);
  }
}
