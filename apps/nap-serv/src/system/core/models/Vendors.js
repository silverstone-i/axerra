/**
 * @file Vendors model — extends TableModel with multi-sheet upsert export/import
 * @module core/models/Vendors
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
 */

import { TableModel } from 'pg-schemata';
import vendorsSchema from '../schemas/vendorsSchema.js';
import {
  exportSourceEntity,
  importSourceEntity,
  PHONE_HEADERS,
  ADDRESS_HEADERS,
  TAX_ID_HEADERS,
  EMAIL_HEADERS,
} from '../../../lib/spreadsheetHelpers.js';

/** @type {import('../../../lib/spreadsheetHelpers.js').SourceEntityConfig} */
const CONFIG = {
  entityName: 'vendors',
  sheetName: 'Vendors',
  sourceType: 'vendor',
  linkColName: 'vendor_id',
  idType: 'vendor',
  buildLabel: (row) => row.name,
  returningCols: ['id', 'name'],
  boolCols: ['is_app_user'],
  hasRoles: true,
  codeRequired: false,
  extraExportCols: [
    { name: 'status', derive: (origRow) => (origRow.deactivated_at ? 'archived' : 'active') },
  ],
  extraImportStrip: [],
  childSheets: [
    { sheetName: 'Emails', modelName: 'emails', headers: EMAIL_HEADERS },
    { sheetName: 'Phone Numbers', modelName: 'phoneNumbers', headers: PHONE_HEADERS },
    { sheetName: 'Addresses', modelName: 'addresses', headers: ADDRESS_HEADERS },
    { sheetName: 'Tax Identifiers', modelName: 'taxIdentifiers', headers: TAX_ID_HEADERS },
  ],
  appUserProvisioning: null,
};

export default class Vendors extends TableModel {
  constructor(db, pgp, logger = null) {
    super(db, pgp, vendorsSchema, logger);
  }

  async exportToSpreadsheet(filePath, where = [], joinType = 'AND', options = {}) {
    return exportSourceEntity(this, filePath, where, joinType, options, CONFIG);
  }

  async importFromSpreadsheet(filePath, _sheetIndex = 0, callbackFn = null, _returning = null) {
    return importSourceEntity(this, filePath, _sheetIndex, callbackFn, CONFIG);
  }
}
