/**
 * @file PaymentTerms model — lookup table for standardised vendor payment terms
 * @module core/models/PaymentTerms
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { TableModel } from 'pg-schemata';
import paymentTermsSchema from '../schemas/paymentTermsSchema.js';
import { curateRows, parseSheet, coerceChildRow, isUuid, parseDbImportError } from '../../../lib/spreadsheetHelpers.js';

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
   * Import payment terms from an XLSX spreadsheet.
   * Rows with a valid UUID `id` are updated; others are inserted.
   */
  async importFromSpreadsheet(filePath, _sheetIndex = 0, callbackFn = null) {
    const { WorkbookReader } = await import('@nap-sft/tablsx');
    const buffer = readFileSync(filePath);
    const reader = WorkbookReader.fromBuffer(buffer);
    const rows = parseSheet(reader, 0);
    if (!rows.length) return { inserted: 0, updated: 0 };

    // Resolve tenant_id from tenant_code provided by callbackFn
    let tenantId;
    const sampleRow = callbackFn ? await callbackFn({}) : {};
    if (sampleRow.tenant_code) {
      const tenantRec = await this.db.oneOrNone(
        'SELECT id FROM admin.tenants WHERE tenant_code = $1 AND deactivated_at IS NULL',
        [sampleRow.tenant_code.toUpperCase()],
      );
      tenantId = tenantRec?.id;
    }

    const errors = [];
    let inserted = 0;
    let updated = 0;

    for (const raw of rows) {
      // Strip non-schema columns
      const { _rowNum, status, ...row } = raw;

      // Coerce types (boolean is_active, enum units)
      coerceChildRow(row, this);

      // Derive deactivated_at from status column
      if (typeof status === 'string') {
        const s = status.toLowerCase().trim();
        if (s === 'archived') row.deactivated_at = new Date();
        else if (s === 'active') row.deactivated_at = null;
      }

      // Merge caller-provided fields (tenant_code, created_by)
      const merged = callbackFn ? await callbackFn(row) : row;

      // Replace tenant_code with resolved tenant_id
      delete merged.tenant_code;
      if (tenantId) merged.tenant_id = tenantId;

      try {
        if (isUuid(merged.id)) {
          const { id, ...updates } = merged;
          await this.updateWhere([{ id }], updates, { includeDeactivated: true });
          updated++;
        } else {
          delete merged.id;
          await this.insert(merged);
          inserted++;
        }
      } catch (err) {
        const parsed = parseDbImportError(err);
        if (parsed) {
          for (const e of parsed) {
            errors.push({ ...e, sheet: SHEET_NAME, row: _rowNum || null });
          }
        } else {
          errors.push({ sheet: SHEET_NAME, row: _rowNum || null, column: null, value: null, message: err.message });
        }
      }
    }

    if (errors.length) return { errors };
    return { inserted, updated };
  }
}
