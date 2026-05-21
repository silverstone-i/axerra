/**
 * @file FieldGroupGrants model — extends TableModel for RBAC Layer 4
 * @module core/models/FieldGroupGrants
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { TableModel } from 'pg-schemata';
import fieldGroupGrantsSchema from '../schemas/fieldGroupGrantsSchema.js';

export default class FieldGroupGrants extends TableModel {
  constructor(db, pgp, logger = null) {
    super(db, pgp, fieldGroupGrantsSchema, logger);
  }
}
