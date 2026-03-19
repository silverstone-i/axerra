/**
 * @file Employees model — extends TableModel with multi-sheet upsert export/import
 * @module core/models/Employees
 *
 * Overrides exportToSpreadsheet and importFromSpreadsheet using the shared
 * config-driven helpers from spreadsheetHelpers.js.
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
 */

import { TableModel } from 'pg-schemata';
import employeesSchema from '../schemas/employeesSchema.js';
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
  entityName: 'employees',
  sheetName: 'Employees',
  sourceType: 'employee',
  linkColName: 'employee_id',
  idType: 'employee',
  buildLabel: (row) => `${row.first_name} ${row.last_name}`,
  returningCols: ['id', 'first_name', 'last_name'],
  boolCols: ['is_app_user', 'is_primary_contact', 'is_billing_contact'],
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
  appUserProvisioning: { entityType: 'employee' },
};

export default class Employees extends TableModel {
  constructor(dbConn, pgpLib, logger = null) {
    super(dbConn, pgpLib, employeesSchema, logger);
  }

  /**
   * Export employees with curated columns and child data on separate sheets.
   */
  async exportToSpreadsheet(filePath, where = [], joinType = 'AND', options = {}) {
    return exportSourceEntity(this, filePath, where, joinType, options, CONFIG);
  }

  /**
   * Import employees from a multi-sheet workbook with upsert semantics.
   *
   * @param {string}   filePath
   * @param {number}   [_sheetIndex=0]  Ignored — always reads all sheets
   * @param {Function} [callbackFn]     Row transformer (adds tenant_code, created_by)
   * @param {Array}    [_returning]     Ignored
   */
  async importFromSpreadsheet(filePath, _sheetIndex = 0, callbackFn = null, _returning = null) {
    return importSourceEntity(this, filePath, _sheetIndex, callbackFn, CONFIG);
  }
}
