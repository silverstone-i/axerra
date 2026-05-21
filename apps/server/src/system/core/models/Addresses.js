/**
 * @file Addresses model — extends TableModel for tenant-scope addresses
 * @module core/models/Addresses
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { TableModel } from 'pg-schemata';
import addressesSchema from '../schemas/addressesSchema.js';

export default class Addresses extends TableModel {
  constructor(db, pgp, logger = null) {
    super(db, pgp, addressesSchema, logger);
  }
}
