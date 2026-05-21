/**
 * @file JournalEntries model — extends TableModel
 * @module accounting/models/JournalEntries
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { TableModel } from 'pg-schemata';
import journalEntriesSchema from '../schemas/journalEntriesSchema.js';
import { importSimpleTable } from '../../../lib/spreadsheetHelpers.js';

export default class JournalEntries extends TableModel {
  constructor(db, pgp, logger = null) {
    super(db, pgp, journalEntriesSchema, logger);
  }

  async importFromSpreadsheet(filePath, _sheetIndex = 0, callbackFn = null, _returning = null, options = {}) {
    return importSimpleTable(this, filePath, callbackFn, options);
  }
}
