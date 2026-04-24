/**
 * @file PostingQueues model — extends TableModel
 * @module accounting/models/PostingQueues
 *
 * Copyright (c) 2025 – present Vimber LLC. All rights reserved.
 */

import { TableModel } from 'pg-schemata';
import postingQueuesSchema from '../schemas/postingQueuesSchema.js';

export default class PostingQueues extends TableModel {
  constructor(db, pgp, logger = null) {
    super(db, pgp, postingQueuesSchema, logger);
  }
}
