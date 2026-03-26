/**
 * @file Change order API methods — CRUD for change orders
 * @module nap-client/services/changeOrderApi
 *
 * Base path: /projects/v1/change-orders
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
 */

import { client } from './client.js';

const BASE = '/projects/v1/change-orders';

const qs = (params) => {
  const s = new URLSearchParams(params).toString();
  return s ? `?${s}` : '';
};

export const changeOrderApi = {
  list: (params = {}) => client.getAll(BASE, params),
  getById: (id) => client.get(`${BASE}/${id}`),
  create: (body) => client.post(BASE, body),
  update: (filterParams, changes) => client.put(`${BASE}/update${qs(filterParams)}`, changes),
  archive: (filterParams) => client.del(`${BASE}/archive${qs(filterParams)}`, {}),
  restore: (filterParams) => client.patch(`${BASE}/restore${qs(filterParams)}`, {}),
  importXls: (formData) => client.post(`${BASE}/import-xls`, formData),
  exportXls: (body = {}) => client.post(`${BASE}/export-xls`, body, { responseType: 'blob' }),
};

export default changeOrderApi;
