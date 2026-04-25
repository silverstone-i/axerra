/**
 * @file ActualCost API methods — CRUD for actual cost tracking
 * @module client/services/actualCostApi
 *
 * Base path: /activities/v1/actual-costs
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import { client } from './client.js';

const BASE = '/activities/v1/actual-costs';

const qs = (params) => {
  const s = new URLSearchParams(params).toString();
  return s ? `?${s}` : '';
};

export const actualCostApi = {
  list: (params = {}) => client.getAll(BASE, params),
  getById: (id) => client.get(`${BASE}/${id}`),
  create: (body) => client.post(BASE, body),
  update: (filterParams, changes) => client.put(`${BASE}/update${qs(filterParams)}`, changes),
  archive: (filterParams) => client.del(`${BASE}/archive${qs(filterParams)}`, {}),
  restore: (filterParams) => client.patch(`${BASE}/restore${qs(filterParams)}`, {}),
  importXls: (formData) => client.post(`${BASE}/import-xls`, formData),
  exportXls: (body = {}) => client.post(`${BASE}/export-xls`, body, { responseType: 'blob' }),
};

export default actualCostApi;
