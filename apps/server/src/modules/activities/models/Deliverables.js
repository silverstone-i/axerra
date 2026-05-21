/**
 * @file Deliverables model — extends TableModel for deliverable entities
 * @module activities/models/Deliverables
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { TableModel } from 'pg-schemata';
import deliverablesSchema from '../schemas/deliverablesSchema.js';
import { importSimpleTable } from '../../../lib/spreadsheetHelpers.js';

export default class Deliverables extends TableModel {
  constructor(db, pgp, logger = null) {
    super(db, pgp, deliverablesSchema, logger);
  }

  async importFromSpreadsheet(filePath, _sheetIndex = 0, callbackFn = null, _returning = null, options = {}) {
    return importSimpleTable(this, filePath, callbackFn, options);
  }
}
