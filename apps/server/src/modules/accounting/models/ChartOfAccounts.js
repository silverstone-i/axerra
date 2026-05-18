/**
 * @file ChartOfAccounts model — extends TableModel
 * @module accounting/models/ChartOfAccounts
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import { TableModel } from 'pg-schemata';
import chartOfAccountsSchema from '../schemas/chartOfAccountsSchema.js';
import { importSimpleTable } from '../../../lib/spreadsheetHelpers.js';

export default class ChartOfAccounts extends TableModel {
  constructor(db, pgp, logger = null) {
    super(db, pgp, chartOfAccountsSchema, logger);
  }

  async importFromSpreadsheet(filePath, _sheetIndex = 0, callbackFn = null, _returning = null, options = {}) {
    return importSimpleTable(this, filePath, callbackFn, options);
  }
}
