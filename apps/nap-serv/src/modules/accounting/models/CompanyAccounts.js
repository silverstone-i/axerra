/**
 * @file CompanyAccounts model — extends TableModel
 * @module accounting/models/CompanyAccounts
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
 */

import { TableModel } from 'pg-schemata';
import companyAccountsSchema from '../schemas/companyAccountsSchema.js';

export default class CompanyAccounts extends TableModel {
  constructor(db, pgp, logger = null) {
    super(db, pgp, companyAccountsSchema, logger);
  }
}
