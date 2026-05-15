/**
 * @file Clients model — extends TableModel with flat single-sheet export/import
 * @module core/models/Clients
 *
 * Exports/imports clients as a single flat worksheet with repeated rows
 * for child data (emails, phones, addresses, tax identifiers).
 * Legacy multi-sheet workbooks (>1 sheet) are auto-detected on import.
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import { readFileSync } from 'node:fs';
import { TableModel } from 'pg-schemata';
import clientsSchema from '../schemas/clientsSchema.js';
import {
  exportFlatSourceEntity,
  importFlatSourceEntity,
  isUuid,
  FLAT_CHILD_EMAILS,
  FLAT_CHILD_PHONES,
  FLAT_CHILD_ADDRESSES,
  FLAT_CHILD_TAX_IDS,
  PHONE_HEADERS,
  ADDRESS_HEADERS,
  TAX_ID_HEADERS,
  EMAIL_HEADERS,
} from '../../../lib/spreadsheetHelpers.js';

/** @type {import('../../../lib/spreadsheetHelpers.js').SourceEntityConfig} */
const CONFIG = {
  sheetName: 'Clients',
  sourceType: 'client',
  linkColName: 'client_id',
  idType: 'client',
  buildLabel: (row) => row.name,
  returningCols: ['id', 'name'],
  boolCols: ['is_app_user'],
  hasRoles: true,
  codeRequired: false,
  extraExportCols: [
    { name: 'status', derive: (origRow) => (origRow.deactivated_at ? 'archived' : 'active') },
    { name: 'password', derive: () => '' },
  ],
  extraImportStrip: [],
  childSheets: [
    { sheetName: 'Emails', modelName: 'emails', headers: EMAIL_HEADERS },
    { sheetName: 'Phone Numbers', modelName: 'phoneNumbers', headers: PHONE_HEADERS },
    { sheetName: 'Addresses', modelName: 'addresses', headers: ADDRESS_HEADERS },
    { sheetName: 'Tax Identifiers', modelName: 'taxIdentifiers', headers: TAX_ID_HEADERS },
  ],
  appUserProvisioning: { entityType: 'client' },
  flat: {
    parentCols: ['id', 'code', 'name', 'is_app_user', 'roles', 'status', 'password'],
    children: [FLAT_CHILD_EMAILS, FLAT_CHILD_PHONES, FLAT_CHILD_ADDRESSES, FLAT_CHILD_TAX_IDS],
    nameFields: ['name'],
    groupKeyFn: (r) => {
      if (isUuid(r.id)) return r.id;
      if (r.id != null && String(r.id).trim()) return `ref::${r.id}`;
      return `${r.code || ''}::${r.name || ''}`;
    },
  },
};

export default class Clients extends TableModel {
  constructor(db, pgp, logger = null) {
    super(db, pgp, clientsSchema, logger);
  }

  /**
   * Export clients as a single flat worksheet with repeated rows for child data.
   */
  async exportToSpreadsheet(filePath, where = [], joinType = 'AND', options = {}) {
    return exportFlatSourceEntity(this, filePath, where, joinType, options, CONFIG);
  }

  /**
   * Import clients from a single flat-format spreadsheet.
   */
  async importFromSpreadsheet(filePath, _sheetIndex = 0, callbackFn = null, _returning = null, options = {}) {
    const { WorkbookReader } = await import('@nap-sft/tablsx');
    const buffer = readFileSync(filePath);
    const reader = WorkbookReader.fromBuffer(buffer);
    return importFlatSourceEntity(this, reader, callbackFn, CONFIG, options);
  }
}
