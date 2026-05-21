/**
 * @file ProjectClients model — project-client junction table
 * @module projects/models/ProjectClients
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { TableModel } from 'pg-schemata';
import projectClientsSchema from '../schemas/projectClientsSchema.js';

export default class ProjectClients extends TableModel {
  constructor(db, pgp, logger = null) {
    super(db, pgp, projectClientsSchema, logger);
  }
}
