/**
 * @file Repository map for the auth module (admin-scope tables)
 * @module auth/authRepositories
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import Tenants from './models/Tenants.js';
import PortalUsers from './models/PortalUsers.js';
import PortalUserTenants from './models/PortalUserTenants.js';
import ImpersonationLogs from './models/ImpersonationLogs.js';
import MatchReviewLogs from './models/MatchReviewLogs.js';
import Countries from './models/Countries.js';
const repositories = {
  tenants: Tenants,
  portalUsers: PortalUsers,
  portalUserTenants: PortalUserTenants,
  impersonationLogs: ImpersonationLogs,
  matchReviewLogs: MatchReviewLogs,
  countries: Countries,
};

export default repositories;
