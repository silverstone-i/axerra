/**
 * @file TemplateCostItems model
 * @module projects/models/TemplateCostItems
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { TableModel } from 'pg-schemata';
import templateCostItemsSchema from '../schemas/templateCostItemsSchema.js';

export default class TemplateCostItems extends TableModel {
  constructor(db, pgp, logger = null) {
    super(db, pgp, templateCostItemsSchema, logger);
  }
}
