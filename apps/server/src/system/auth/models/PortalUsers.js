/**
 * @file PortalUsers model — extends TableModel for admin.portal_users
 * @module auth/models/PortalUsers
 *
 * portal_users is a pure identity/auth table per PRD §3.2.2. Personal
 * information lives on the linked entity record. password_hash is
 * never returned in API responses.
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { TableModel } from 'pg-schemata';
import portalUsersSchema from '../schemas/portalUsersSchema.js';
import bcrypt from 'bcrypt';

export default class PortalUsers extends TableModel {
  constructor(db, pgp, logger = null) {
    super(db, pgp, portalUsersSchema, logger);
  }

  async importFromSpreadsheet(rows, options = {}) {
    const processed = await Promise.all(
      rows.map(async (row) => {
        if (row.password) {
          row.password_hash = await bcrypt.hash(row.password, 10);
          delete row.password;
        }
        return row;
      }),
    );
    return super.importFromSpreadsheet(processed, options);
  }
}
