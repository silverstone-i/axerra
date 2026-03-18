/**
 * @file Emails model — polymorphic emails linked via sources
 * @module core/models/Emails
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
 */

import { TableModel } from 'pg-schemata';
import emailsSchema from '../schemas/emailsSchema.js';

export default class Emails extends TableModel {
  constructor(db, pgp, logger = null) {
    super(db, pgp, emailsSchema, logger);
  }
}
