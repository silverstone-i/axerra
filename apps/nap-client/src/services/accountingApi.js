/**
 * @file Accounting API methods — CRUD for chart of accounts, journal entries, ledger, posting,
 *       category-account map, company accounts/transactions, internal transfers
 * @module nap-client/services/accountingApi
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
 */

import { client } from './client.js';

const qs = (params) => {
  const s = new URLSearchParams(params).toString();
  return s ? `?${s}` : '';
};

/* ---- Chart of Accounts ---- */
const COA = '/accounting/v1/chart-of-accounts';

export const chartOfAccountsApi = {
  list: (params = {}) => client.get(`${COA}${qs(params)}`),
  getById: (id) => client.get(`${COA}/${id}`),
  create: (body) => client.post(COA, body),
  update: (filterParams, changes) => client.put(`${COA}/update${qs(filterParams)}`, changes),
  archive: (filterParams) => client.del(`${COA}/archive${qs(filterParams)}`, {}),
  restore: (filterParams) => client.patch(`${COA}/restore${qs(filterParams)}`, {}),
};

/* ---- Journal Entries ---- */
const JE = '/accounting/v1/journal-entries';

export const journalEntryApi = {
  list: (params = {}) => client.get(`${JE}${qs(params)}`),
  getById: (id) => client.get(`${JE}/${id}`),
  create: (body) => client.post(JE, body),
  update: (filterParams, changes) => client.put(`${JE}/update${qs(filterParams)}`, changes),
  archive: (filterParams) => client.del(`${JE}/archive${qs(filterParams)}`, {}),
  restore: (filterParams) => client.patch(`${JE}/restore${qs(filterParams)}`, {}),
  post: (body) => client.post(`${JE}/post`, body),
  reverse: (body) => client.post(`${JE}/reverse`, body),
};

/* ---- Journal Entry Lines ---- */
const JEL = '/accounting/v1/journal-entry-lines';

export const journalEntryLineApi = {
  list: (params = {}) => client.get(`${JEL}${qs(params)}`),
  getById: (id) => client.get(`${JEL}/${id}`),
  create: (body) => client.post(JEL, body),
  update: (filterParams, changes) => client.put(`${JEL}/update${qs(filterParams)}`, changes),
  archive: (filterParams) => client.del(`${JEL}/archive${qs(filterParams)}`, {}),
  restore: (filterParams) => client.patch(`${JEL}/restore${qs(filterParams)}`, {}),
};

/* ---- Ledger Balances (read-only) ---- */
const LB = '/accounting/v1/ledger-balances';

export const ledgerBalanceApi = {
  list: (params = {}) => client.get(`${LB}${qs(params)}`),
  getById: (id) => client.get(`${LB}/${id}`),
};

/* ---- Posting Queues ---- */
const PQ = '/accounting/v1/posting-queues';

export const postingQueueApi = {
  list: (params = {}) => client.get(`${PQ}${qs(params)}`),
  getById: (id) => client.get(`${PQ}/${id}`),
  retry: (body) => client.post(`${PQ}/retry`, body),
};

/* ---- Category Account Map ---- */
const CAM = '/accounting/v1/category-account-map';

export const categoryAccountMapApi = {
  list: (params = {}) => client.get(`${CAM}${qs(params)}`),
  getById: (id) => client.get(`${CAM}/${id}`),
  create: (body) => client.post(CAM, body),
  update: (filterParams, changes) => client.put(`${CAM}/update${qs(filterParams)}`, changes),
  archive: (filterParams) => client.del(`${CAM}/archive${qs(filterParams)}`, {}),
  restore: (filterParams) => client.patch(`${CAM}/restore${qs(filterParams)}`, {}),
};

/* ---- Company Accounts ---- */
const CA = '/accounting/v1/company-accounts';

export const companyAccountApi = {
  list: (params = {}) => client.get(`${CA}${qs(params)}`),
  getById: (id) => client.get(`${CA}/${id}`),
  create: (body) => client.post(CA, body),
  update: (filterParams, changes) => client.put(`${CA}/update${qs(filterParams)}`, changes),
  archive: (filterParams) => client.del(`${CA}/archive${qs(filterParams)}`, {}),
  restore: (filterParams) => client.patch(`${CA}/restore${qs(filterParams)}`, {}),
};

/* ---- Company Transactions ---- */
const CT = '/accounting/v1/company-transactions';

export const companyTransactionApi = {
  list: (params = {}) => client.get(`${CT}${qs(params)}`),
  getById: (id) => client.get(`${CT}/${id}`),
  create: (body) => client.post(CT, body),
  update: (filterParams, changes) => client.put(`${CT}/update${qs(filterParams)}`, changes),
  archive: (filterParams) => client.del(`${CT}/archive${qs(filterParams)}`, {}),
  restore: (filterParams) => client.patch(`${CT}/restore${qs(filterParams)}`, {}),
};

/* ---- Internal Transfers ---- */
const IT = '/accounting/v1/internal-transfers';

export const internalTransferApi = {
  list: (params = {}) => client.get(`${IT}${qs(params)}`),
  getById: (id) => client.get(`${IT}/${id}`),
  create: (body) => client.post(IT, body),
  update: (filterParams, changes) => client.put(`${IT}/update${qs(filterParams)}`, changes),
  archive: (filterParams) => client.del(`${IT}/archive${qs(filterParams)}`, {}),
  restore: (filterParams) => client.patch(`${IT}/restore${qs(filterParams)}`, {}),
};
