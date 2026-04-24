/**
 * @file BOM API methods — CRUD for catalog SKUs, vendor SKUs, vendor pricing + matching
 * @module client/services/bomApi
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import { client } from './client.js';

const qs = (params) => {
  const s = new URLSearchParams(params).toString();
  return s ? `?${s}` : '';
};

/* ---- Catalog SKUs ---- */
const CATALOG = '/bom/v1/catalog-skus';

export const catalogSkuApi = {
  list: (params = {}) => client.getAll(CATALOG, params),
  getById: (id) => client.get(`${CATALOG}/${id}`),
  create: (body) => client.post(CATALOG, body),
  update: (filterParams, changes) => client.put(`${CATALOG}/update${qs(filterParams)}`, changes),
  archive: (filterParams) => client.del(`${CATALOG}/archive${qs(filterParams)}`, {}),
  restore: (filterParams) => client.patch(`${CATALOG}/restore${qs(filterParams)}`, {}),
  refreshEmbeddings: () => client.post(`${CATALOG}/refresh-embeddings`, {}),
  importXls: (formData) => client.post(`${CATALOG}/import-xls`, formData),
  exportXls: (body = {}) => client.post(`${CATALOG}/export-xls`, body, { responseType: 'blob' }),
};

/* ---- Vendor SKUs ---- */
const VENDOR = '/bom/v1/vendor-skus';

export const vendorSkuApi = {
  list: (params = {}) => client.getAll(VENDOR, params),
  getById: (id) => client.get(`${VENDOR}/${id}`),
  create: (body) => client.post(VENDOR, body),
  update: (filterParams, changes) => client.put(`${VENDOR}/update${qs(filterParams)}`, changes),
  archive: (filterParams) => client.del(`${VENDOR}/archive${qs(filterParams)}`, {}),
  restore: (filterParams) => client.patch(`${VENDOR}/restore${qs(filterParams)}`, {}),
  getUnmatched: () => client.get(`${VENDOR}/unmatched`),
  match: (body) => client.post(`${VENDOR}/match`, body),
  autoMatch: (body) => client.post(`${VENDOR}/auto-match`, body),
  batchMatch: (body) => client.post(`${VENDOR}/batch-match`, body),
  refreshEmbeddings: () => client.post(`${VENDOR}/refresh-embeddings`, {}),
};

/* ---- Vendor Pricing ---- */
const PRICING = '/bom/v1/vendor-pricing';

export const vendorPricingApi = {
  list: (params = {}) => client.getAll(PRICING, params),
  getById: (id) => client.get(`${PRICING}/${id}`),
  create: (body) => client.post(PRICING, body),
  update: (filterParams, changes) => client.put(`${PRICING}/update${qs(filterParams)}`, changes),
  archive: (filterParams) => client.del(`${PRICING}/archive${qs(filterParams)}`, {}),
  restore: (filterParams) => client.patch(`${PRICING}/restore${qs(filterParams)}`, {}),
};
