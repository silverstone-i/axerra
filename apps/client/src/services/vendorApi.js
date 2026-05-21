/**
 * @file Vendor API methods — CRUD for vendor management
 * @module client/services/vendorApi
 *
 * Base path: /core/v1/vendors
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { client } from './client.js';

const BASE = '/core/v1/vendors';

const qs = (params) => {
  const s = new URLSearchParams(params).toString();
  return s ? `?${s}` : '';
};

export const vendorApi = {
  list: (params = {}) => client.getAll(BASE, params),
  getById: (id) => client.get(`${BASE}/${id}`),
  create: (body) => client.post(BASE, body),
  update: (filterParams, changes) => client.put(`${BASE}/update${qs(filterParams)}`, changes),
  archive: (filterParams) => client.del(`${BASE}/archive${qs(filterParams)}`, {}),
  restore: (filterParams) => client.patch(`${BASE}/restore${qs(filterParams)}`, {}),
  importXls: (formData) => client.post(`${BASE}/import-xls`, formData),
  exportXls: (body = {}) => client.post(`${BASE}/export-xls`, body, { responseType: 'blob' }),
  importCombinedXls: (formData, { preview = false } = {}) =>
    client.post(`${BASE}/import-combined-xls${preview ? '?preview=1' : ''}`, formData),
  exportCombinedXls: (body = {}) => client.post(`${BASE}/export-combined-xls`, body, { responseType: 'blob' }),
};

export default vendorApi;
