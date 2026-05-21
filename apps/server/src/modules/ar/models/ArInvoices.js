/**
 * @file ArInvoices model — extends TableModel
 * @module ar/models/ArInvoices
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { TableModel } from 'pg-schemata';
import arInvoicesSchema from '../schemas/arInvoicesSchema.js';
import { importSimpleTable } from '../../../lib/spreadsheetHelpers.js';

export default class ArInvoices extends TableModel {
  constructor(db, pgp, logger = null) {
    super(db, pgp, arInvoicesSchema, logger);
  }

  async importFromSpreadsheet(filePath, _sheetIndex = 0, callbackFn = null, _returning = null, options = {}) {
    return importSimpleTable(this, filePath, callbackFn, options);
  }
}
