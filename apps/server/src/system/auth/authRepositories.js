/**
 * @file Repository map for the auth module (admin-scope tables)
 * @module auth/authRepositories
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import Tenants from './models/Tenants.js';
import PortalUsers from './models/PortalUsers.js';
import ImpersonationLogs from './models/ImpersonationLogs.js';
import MatchReviewLogs from './models/MatchReviewLogs.js';
const repositories = {
  tenants: Tenants,
  portalUsers: PortalUsers,
  impersonationLogs: ImpersonationLogs,
  matchReviewLogs: MatchReviewLogs,
};

export default repositories;
