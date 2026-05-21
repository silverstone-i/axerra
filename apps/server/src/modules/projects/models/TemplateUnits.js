/**
 * @file TemplateUnits model
 * @module projects/models/TemplateUnits
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { TableModel } from 'pg-schemata';
import templateUnitsSchema from '../schemas/templateUnitsSchema.js';

export default class TemplateUnits extends TableModel {
  constructor(db, pgp, logger = null) {
    super(db, pgp, templateUnitsSchema, logger);
  }
}
