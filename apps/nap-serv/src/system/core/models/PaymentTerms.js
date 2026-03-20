/**
 * @file PaymentTerms model — lookup table for standardised vendor payment terms
 * @module core/models/PaymentTerms
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
 */

import { TableModel } from 'pg-schemata';
import paymentTermsSchema from '../schemas/paymentTermsSchema.js';

export default class PaymentTerms extends TableModel {
  constructor(db, pgp, logger = null) {
    super(db, pgp, paymentTermsSchema, logger);
  }
}
