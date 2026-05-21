/**
 * @file TasksMaster model
 * @module projects/models/TasksMaster
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { TableModel } from 'pg-schemata';
import tasksMasterSchema from '../schemas/tasksMasterSchema.js';

export default class TasksMaster extends TableModel {
  constructor(db, pgp, logger = null) {
    super(db, pgp, tasksMasterSchema, logger);
  }
}
