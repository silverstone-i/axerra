/**
 * @file FieldGroupDefinitions model — extends TableModel for RBAC Layer 4
 * @module core/models/FieldGroupDefinitions
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { TableModel } from 'pg-schemata';
import fieldGroupDefinitionsSchema from '../schemas/fieldGroupDefinitionsSchema.js';

export default class FieldGroupDefinitions extends TableModel {
  constructor(db, pgp, logger = null) {
    super(db, pgp, fieldGroupDefinitionsSchema, logger);
  }
}
