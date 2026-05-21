/**
 * @file ImpersonationLogs model — extends TableModel for admin.impersonation_logs
 * @module auth/models/ImpersonationLogs
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { TableModel } from 'pg-schemata';
import impersonationLogsSchema from '../schemas/impersonationLogsSchema.js';

export default class ImpersonationLogs extends TableModel {
  constructor(db, pgp, logger = null) {
    super(db, pgp, impersonationLogsSchema, logger);
  }
}
