/**
 * @file Orphan portal_users API methods — Axerra-only maintenance helpers
 * @module client/services/orphanPortalUsersApi
 *
 * Base path: /tenants/v1/orphan-portal-users
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { client } from './client.js';

const BASE = '/tenants/v1/orphan-portal-users';

export const orphanPortalUsersApi = {
  previewOrphans: () => client.get(`${BASE}/orphans/preview`),
  cleanupOrphan: (id) => client.post(`${BASE}/orphans/cleanup`, { id }),
};

export default orphanPortalUsersApi;
