/**
 * @file Roles model — extends TableModel for RBAC roles
 * @module core/models/Roles
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { TableModel } from 'pg-schemata';
import rolesSchema from '../schemas/rolesSchema.js';

export default class Roles extends TableModel {
  constructor(db, pgp, logger = null) {
    super(db, pgp, rolesSchema, logger);
  }
}
