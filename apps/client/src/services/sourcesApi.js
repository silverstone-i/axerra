/**
 * @file Sources API methods — orphan-source maintenance helpers
 * @module client/services/sourcesApi
 *
 * Base path: /core/v1/sources
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import { client } from './client.js';

const BASE = '/core/v1/sources';

export const sourcesApi = {
  previewOrphans: () => client.get(`${BASE}/orphans/preview`),
  cleanupOrphans: () => client.post(`${BASE}/orphans/cleanup`, {}),
};

export default sourcesApi;
