/**
 * @file CompanyTransactions model — extends TableModel
 * @module accounting/models/CompanyTransactions
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
 */

import { TableModel } from 'pg-schemata';
import companyTransactionsSchema from '../schemas/companyTransactionsSchema.js';

export default class CompanyTransactions extends TableModel {
  constructor(db, pgp, logger = null) {
    super(db, pgp, companyTransactionsSchema, logger);
  }
}
