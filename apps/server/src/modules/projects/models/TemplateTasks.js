/**
 * @file TemplateTasks model
 * @module projects/models/TemplateTasks
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { TableModel } from 'pg-schemata';
import templateTasksSchema from '../schemas/templateTasksSchema.js';

export default class TemplateTasks extends TableModel {
  constructor(db, pgp, logger = null) {
    super(db, pgp, templateTasksSchema, logger);
  }
}
