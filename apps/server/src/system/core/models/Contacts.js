/**
 * @file Contacts model — extends TableModel with flat single-sheet export/import
 * @module core/models/Contacts
 *
 * Exports/imports contacts as a single flat worksheet with repeated rows
 * for child data (emails, phones, addresses, tax identifiers).
 * Legacy multi-sheet workbooks (>1 sheet) are auto-detected on import.
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { readFileSync } from 'node:fs';
import { TableModel } from 'pg-schemata';
import contactsSchema from '../schemas/contactsSchema.js';
import {
  exportFlatSourceEntity,
  importFlatSourceEntity,
  isUuid,
  FLAT_CHILD_EMAILS_NO_LOGIN,
  FLAT_CHILD_PHONES,
  FLAT_CHILD_ADDRESSES,
  FLAT_CHILD_TAX_IDS,
  PHONE_HEADERS,
  ADDRESS_HEADERS,
  TAX_ID_HEADERS,
  CONTACT_EMAIL_HEADERS,
} from '../../../lib/spreadsheetHelpers.js';

/** @type {import('../../../lib/spreadsheetHelpers.js').SourceEntityConfig} */
const CONFIG = {
  sheetName: 'Contacts',
  sourceType: 'contact',
  linkColName: 'contact_id',
  idType: 'contact',
  buildLabel: (row) => row.name,
  returningCols: ['id', 'name'],
  boolCols: [],
  hasRoles: false,
  codeRequired: false,
  extraExportCols: [
    { name: 'status', derive: (origRow) => (origRow.deactivated_at ? 'archived' : 'active') },
  ],
  extraImportStrip: [],
  childSheets: [
    { sheetName: 'Emails', modelName: 'emails', headers: CONTACT_EMAIL_HEADERS },
    { sheetName: 'Phone Numbers', modelName: 'phoneNumbers', headers: PHONE_HEADERS },
    { sheetName: 'Addresses', modelName: 'addresses', headers: ADDRESS_HEADERS },
    { sheetName: 'Tax Identifiers', modelName: 'taxIdentifiers', headers: TAX_ID_HEADERS },
  ],
  flat: {
    parentCols: ['id', 'code', 'name', 'status'],
    children: [FLAT_CHILD_EMAILS_NO_LOGIN, FLAT_CHILD_PHONES, FLAT_CHILD_ADDRESSES, FLAT_CHILD_TAX_IDS],
    nameFields: ['name'],
    groupKeyFn: (r) => {
      if (isUuid(r.id)) return r.id;
      if (r.id != null && String(r.id).trim()) return `ref::${r.id}`;
      return `${r.code || ''}::${r.name || ''}`;
    },
  },
};

export default class Contacts extends TableModel {
  constructor(db, pgp, logger = null) {
    super(db, pgp, contactsSchema, logger);
  }

  /**
   * Export contacts as a single flat worksheet with repeated rows for child data.
   */
  async exportToSpreadsheet(filePath, where = [], joinType = 'AND', options = {}) {
    return exportFlatSourceEntity(this, filePath, where, joinType, options, CONFIG);
  }

  /**
   * Import contacts from a single flat-format spreadsheet.
   */
  async importFromSpreadsheet(filePath, _sheetIndex = 0, callbackFn = null, _returning = null, options = {}) {
    const { WorkbookReader } = await import('@nap-sft/tablsx');
    const buffer = readFileSync(filePath);
    const reader = WorkbookReader.fromBuffer(buffer);
    return importFlatSourceEntity(this, reader, callbackFn, CONFIG, options);
  }
}
