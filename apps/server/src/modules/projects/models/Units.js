/**
 * @file Units model
 * @module projects/models/Units
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { TableModel } from 'pg-schemata';
import unitsSchema from '../schemas/unitsSchema.js';

export default class Units extends TableModel {
  constructor(db, pgp, logger = null) {
    super(db, pgp, unitsSchema, logger);
  }
}
