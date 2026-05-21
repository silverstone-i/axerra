/**
 * @file ActualCosts model — extends TableModel for actual cost tracking
 * @module activities/models/ActualCosts
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { TableModel } from 'pg-schemata';
import actualCostsSchema from '../schemas/actualCostsSchema.js';
import { importSimpleTable } from '../../../lib/spreadsheetHelpers.js';

export default class ActualCosts extends TableModel {
  constructor(db, pgp, logger = null) {
    super(db, pgp, actualCostsSchema, logger);
  }

  async importFromSpreadsheet(filePath, _sheetIndex = 0, callbackFn = null, _returning = null, options = {}) {
    return importSimpleTable(this, filePath, callbackFn, options);
  }
}
