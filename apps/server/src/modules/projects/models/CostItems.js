/**
 * @file CostItems model
 * @module projects/models/CostItems
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { TableModel } from 'pg-schemata';
import costItemsSchema from '../schemas/costItemsSchema.js';

export default class CostItems extends TableModel {
  constructor(db, pgp, logger = null) {
    super(db, pgp, costItemsSchema, logger);
  }
}
