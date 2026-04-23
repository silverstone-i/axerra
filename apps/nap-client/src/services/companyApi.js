/**
 * @file Company API methods — CRUD for company entities
 * @module nap-client/services/companyApi
 *
 * Base path: /core/v1/companies
 *
 * Copyright (c) 2025 – present Vimber LLC. All rights reserved.
 */

import { client } from './client.js';

const BASE = '/core/v1/companies';

const qs = (params) => {
  const s = new URLSearchParams(params).toString();
  return s ? `?${s}` : '';
};

export const companyApi = {
  list: (params = {}) => client.getAll(BASE, params),
  getById: (id) => client.get(`${BASE}/${id}`),
  create: (body) => client.post(BASE, body),
  update: (filterParams, changes) => client.put(`${BASE}/update${qs(filterParams)}`, changes),
  archive: (filterParams) => client.del(`${BASE}/archive${qs(filterParams)}`, {}),
  restore: (filterParams) => client.patch(`${BASE}/restore${qs(filterParams)}`, {}),
  importXls: (formData) => client.post(`${BASE}/import-xls`, formData),
  exportXls: (body = {}) => client.post(`${BASE}/export-xls`, body, { responseType: 'blob' }),
};

export default companyApi;
