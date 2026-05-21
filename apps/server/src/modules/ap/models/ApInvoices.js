/**
 * @file ApInvoices model — extends TableModel
 * @module ap/models/ApInvoices
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { TableModel } from 'pg-schemata';
import apInvoicesSchema from '../schemas/apInvoicesSchema.js';
import { importSimpleTable } from '../../../lib/spreadsheetHelpers.js';

export default class ApInvoices extends TableModel {
  constructor(db, pgp, logger = null) {
    super(db, pgp, apInvoicesSchema, logger);
  }

  async importFromSpreadsheet(filePath, _sheetIndex = 0, callbackFn = null, _returning = null, options = {}) {
    return importSimpleTable(this, filePath, callbackFn, options);
  }
}
