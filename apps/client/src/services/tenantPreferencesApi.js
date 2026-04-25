/**
 * @file API service for tenant preferences
 * @module client/services/tenantPreferencesApi
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import { client } from './client.js';

const BASE = '/core/v1/tenant-preferences';

const qs = (params) => {
  const s = new URLSearchParams(params).toString();
  return s ? `?${s}` : '';
};

export const tenantPreferencesApi = {
  list: (params = {}) => client.getAll(BASE, params),
  update: (filterParams, changes) => client.put(`${BASE}/update${qs(filterParams)}`, changes),
};

export default tenantPreferencesApi;
