/**
 * @file Countries model — extends TableModel for admin.countries
 * @module auth/models/Countries
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { TableModel } from 'pg-schemata';
import countriesSchema from '../schemas/countriesSchema.js';

export default class Countries extends TableModel {
  constructor(db, pgp, logger = null) {
    super(db, pgp, countriesSchema, logger);
  }
}
