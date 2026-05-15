/**
 * @file Companies model — extends TableModel with flat single-sheet export/import
 * @module core/models/Companies
 *
 * Exports/imports companies as a single flat worksheet with repeated rows
 * for child data (addresses, tax identifiers — no emails or phones).
 * Legacy multi-sheet workbooks (>1 sheet) are auto-detected on import.
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import { readFileSync } from 'node:fs';
import { TableModel } from 'pg-schemata';
import companiesSchema from '../schemas/companiesSchema.js';
import {
  exportFlatSourceEntity,
  importFlatSourceEntity,
  isUuid,
  FLAT_CHILD_ADDRESSES,
  FLAT_CHILD_TAX_IDS,
  ADDRESS_HEADERS,
  TAX_ID_HEADERS,
} from '../../../lib/spreadsheetHelpers.js';

/** @type {import('../../../lib/spreadsheetHelpers.js').SourceEntityConfig} */
const CONFIG = {
  sheetName: 'Companies',
  sourceType: 'company',
  linkColName: 'company_id',
  idType: null,
  buildLabel: (row) => row.name,
  returningCols: ['id', 'name'],
  boolCols: [],
  hasRoles: false,
  codeRequired: true,
  extraExportCols: [
    { name: 'status', derive: (origRow) => (origRow.deactivated_at ? 'archived' : 'active') },
  ],
  extraImportStrip: [],
  childSheets: [
    { sheetName: 'Addresses', modelName: 'addresses', headers: ADDRESS_HEADERS },
    { sheetName: 'Tax Identifiers', modelName: 'taxIdentifiers', headers: TAX_ID_HEADERS },
  ],
  appUserProvisioning: null,
  flat: {
    parentCols: ['id', 'code', 'name', 'status'],
    children: [FLAT_CHILD_ADDRESSES, FLAT_CHILD_TAX_IDS],
    nameFields: ['name'],
    groupKeyFn: (r) => {
      if (isUuid(r.id)) return r.id;
      if (r.id != null && String(r.id).trim()) return `ref::${r.id}`;
      return `${r.code || ''}::${r.name || ''}`;
    },
  },
};

export default class Companies extends TableModel {
  constructor(db, pgp, logger = null) {
    super(db, pgp, companiesSchema, logger);
  }

  /**
   * Export companies as a single flat worksheet with repeated rows for child data.
   */
  async exportToSpreadsheet(filePath, where = [], joinType = 'AND', options = {}) {
    return exportFlatSourceEntity(this, filePath, where, joinType, options, CONFIG);
  }

  /**
   * Import companies from a single flat-format spreadsheet.
   */
  async importFromSpreadsheet(filePath, _sheetIndex = 0, callbackFn = null, _returning = null, options = {}) {
    const { WorkbookReader } = await import('@nap-sft/tablsx');
    const buffer = readFileSync(filePath);
    const reader = WorkbookReader.fromBuffer(buffer);
    return importFlatSourceEntity(this, reader, callbackFn, CONFIG, options);
  }
}
