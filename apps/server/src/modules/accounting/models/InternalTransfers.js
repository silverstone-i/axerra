/**
 * @file InternalTransfers model — extends TableModel
 * @module accounting/models/InternalTransfers
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { TableModel } from 'pg-schemata';
import internalTransfersSchema from '../schemas/internalTransfersSchema.js';

export default class InternalTransfers extends TableModel {
  constructor(db, pgp, logger = null) {
    super(db, pgp, internalTransfersSchema, logger);
  }
}
