/**
 * @file CompanyTransactions model — extends TableModel
 * @module accounting/models/CompanyTransactions
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { TableModel } from 'pg-schemata';
import companyTransactionsSchema from '../schemas/companyTransactionsSchema.js';

export default class CompanyTransactions extends TableModel {
  constructor(db, pgp, logger = null) {
    super(db, pgp, companyTransactionsSchema, logger);
  }
}
