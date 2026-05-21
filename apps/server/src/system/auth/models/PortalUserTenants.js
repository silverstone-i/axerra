/**
 * @file PortalUserTenants model — extends TableModel for admin.portal_user_tenants
 * @module auth/models/PortalUserTenants
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { TableModel } from 'pg-schemata';
import portalUserTenantsSchema from '../schemas/portalUserTenantsSchema.js';

export default class PortalUserTenants extends TableModel {
  constructor(db, pgp, logger = null) {
    super(db, pgp, portalUserTenantsSchema, logger);
  }
}
