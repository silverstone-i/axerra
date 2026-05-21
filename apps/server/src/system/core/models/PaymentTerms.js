/**
 * @file PaymentTerms model — lookup table for standardised vendor payment terms
 * @module core/models/PaymentTerms
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { writeFileSync } from 'node:fs';
import { TableModel } from 'pg-schemata';
import paymentTermsSchema from '../schemas/paymentTermsSchema.js';
import { curateRows, importSimpleTable } from '../../../lib/spreadsheetHelpers.js';

const SHEET_NAME = 'Payment Terms';
const EXPORT_HEADERS = ['id', 'label', 'term', 'units', 'is_active', 'status'];

export default class PaymentTerms extends TableModel {
  constructor(db, pgp, logger = null) {
    super(db, pgp, paymentTermsSchema, logger);
  }

  /**
   * Export payment terms to a flat XLSX spreadsheet.
   */
  async exportToSpreadsheet(filePath, where = [], joinType = 'AND', options = {}) {
    const { WorkbookBuilder, writeXlsx } = await import('@nap-sft/tablsx');
    const wb = WorkbookBuilder.create();
    const sheet = wb.sheet(SHEET_NAME);
    sheet.setHeaders(EXPORT_HEADERS);

    const allRows = await this.findWhere(where, joinType, { ...options, includeDeactivated: true });
    if (!allRows.length) {
      writeFileSync(filePath, writeXlsx(wb.build()));
      return { exported: 0, filePath };
    }

    const curated = curateRows(allRows).map((row) => ({
      ...row,
      status: allRows.find((r) => r.id === row.id)?.deactivated_at ? 'archived' : 'active',
    }));

    sheet.addObjects(curated);
    writeFileSync(filePath, writeXlsx(wb.build()));
    return { exported: curated.length, filePath };
  }

  /**
   * Import payment terms from an XLSX spreadsheet via the shared
   * simple-table shim. Rows resolve to an existing row via UUID `id` first;
   * if that misses, the shim falls back to the natural unique key (`label`)
   * so round-trips remain idempotent even when the file's `id` cells aren't
   * UUIDs (hand-edited workbook, or an export whose UUIDs no longer exist
   * in the target DB). Rows that miss both lookups insert. The `status`
   * column maps to `deactivated_at` ('archived' / 'active'), and the
   * `previewOnly` option from `BaseController.importXls` is honored.
   */
  async importFromSpreadsheet(filePath, _sheetIndex = 0, callbackFn = null, _returning = null, options = {}) {
    return importSimpleTable(this, filePath, callbackFn, options);
  }
}
