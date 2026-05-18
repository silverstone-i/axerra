/**
 * @file Projects model
 * @module projects/models/Projects
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import { TableModel } from 'pg-schemata';
import projectsSchema from '../schemas/projectsSchema.js';
import { importSimpleTable } from '../../../lib/spreadsheetHelpers.js';

export default class Projects extends TableModel {
  constructor(db, pgp, logger = null) {
    super(db, pgp, projectsSchema, logger);
  }

  async importFromSpreadsheet(filePath, _sheetIndex = 0, callbackFn = null, _returning = null, options = {}) {
    return importSimpleTable(this, filePath, callbackFn, options);
  }
}
