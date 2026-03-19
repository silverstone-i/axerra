/**
 * @file VendorContacts model — individual people associated with a vendor
 * @module core/models/VendorContacts
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
 */

import { TableModel } from 'pg-schemata';
import vendorContactsSchema from '../schemas/vendorContactsSchema.js';

export default class VendorContacts extends TableModel {
  constructor(db, pgp, logger = null) {
    super(db, pgp, vendorContactsSchema, logger);
  }
}
