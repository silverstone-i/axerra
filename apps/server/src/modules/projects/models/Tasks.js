/**
 * @file Tasks model
 * @module projects/models/Tasks
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { TableModel } from 'pg-schemata';
import tasksSchema from '../schemas/tasksSchema.js';

export default class Tasks extends TableModel {
  constructor(db, pgp, logger = null) {
    super(db, pgp, tasksSchema, logger);
  }
}
