/**
 * @file Budget API methods — CRUD with version management
 * @module vimber-client/services/budgetApi
 *
 * Base path: /activities/v1/budgets
 *
 * Copyright (c) 2025 – present Vimber LLC. All rights reserved.
 */

import { client } from './client.js';

const BASE = '/activities/v1/budgets';

const qs = (params) => {
  const s = new URLSearchParams(params).toString();
  return s ? `?${s}` : '';
};

export const budgetApi = {
  list: (params = {}) => client.getAll(BASE, params),
  getById: (id) => client.get(`${BASE}/${id}`),
  create: (body) => client.post(BASE, body),
  update: (filterParams, changes) => client.put(`${BASE}/update${qs(filterParams)}`, changes),
  archive: (filterParams) => client.del(`${BASE}/archive${qs(filterParams)}`, {}),
  restore: (filterParams) => client.patch(`${BASE}/restore${qs(filterParams)}`, {}),
  createNewVersion: (body) => client.post(`${BASE}/new-version`, body),
  importXls: (formData) => client.post(`${BASE}/import-xls`, formData),
  exportXls: (body = {}) => client.post(`${BASE}/export-xls`, body, { responseType: 'blob' }),
};

export default budgetApi;
