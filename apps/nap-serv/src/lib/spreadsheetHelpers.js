/**
 * @file Shared helpers for multi-sheet spreadsheet export/import
 * @module nap-serv/lib/spreadsheetHelpers
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Columns stripped from every exported sheet (id is kept for upsert) */
const INTERNAL_COLS = new Set([
  'tenant_id', 'source_id',
  'created_at', 'created_by', 'updated_at', 'updated_by', 'deactivated_at',
]);

/**
 * Test whether a value looks like a valid UUID.
 * @param {*} val
 * @returns {boolean}
 */
export function isUuid(val) {
  return typeof val === 'string' && UUID_RE.test(val);
}

/**
 * Strip internal/audit columns from row objects.
 * Keeps `id` by default (needed for upsert round-trips).
 *
 * @param {Object[]} rows   Raw DB rows
 * @param {string[]} [extraDrop=[]] Additional column names to drop
 * @returns {Object[]} Curated row objects
 */
export function curateRows(rows, extraDrop = []) {
  const drop = extraDrop.length ? new Set([...INTERNAL_COLS, ...extraDrop]) : INTERNAL_COLS;
  return rows.map((row) => {
    const out = {};
    for (const [k, v] of Object.entries(row)) {
      if (!drop.has(k)) out[k] = v;
    }
    return out;
  });
}

/**
 * Query a child model by source_ids, curate the rows, prepend a linkage column,
 * and add the result as a named sheet on the workbook builder.
 *
 * @param {import('@nap-sft/tablsx').WorkbookBuilder} wb  WorkbookBuilder instance
 * @param {string}   sheetName       Sheet tab label (e.g. "Phone Numbers")
 * @param {Object}   model           pg-schemata model for the child table
 * @param {string[]} sourceIds       Parent source_id values to filter by
 * @param {Map<string,string>} parentIdBySourceId  Maps source_id → parent id (UUID)
 * @param {string}   linkColName     Column name for the linkage (e.g. "employee_id")
 * @param {string[]} [defaultHeaders] Fallback headers when no rows exist
 */
export async function buildChildSheet(wb, sheetName, model, sourceIds, parentIdBySourceId, linkColName, defaultHeaders = []) {
  const sheet = wb.sheet(sheetName);

  if (!sourceIds.length) {
    if (defaultHeaders.length) {
      sheet.setHeaders([linkColName, ...defaultHeaders]);
    } else {
      sheet.addRow(['No data']);
    }
    return;
  }

  const rows = await model.findWhere([{ source_id: { $in: sourceIds } }]);
  // Drop id from child rows — children are replaced wholesale on import
  const curated = curateRows(rows, ['id']);

  if (!curated.length) {
    if (defaultHeaders.length) {
      sheet.setHeaders([linkColName, ...defaultHeaders]);
    } else {
      sheet.addRow(['No data']);
    }
    return;
  }

  // Prepend linkage column (parent id/ref)
  const linked = curated.map((row, i) => ({
    [linkColName]: parentIdBySourceId.get(rows[i].source_id) || '',
    ...row,
  }));

  sheet.setHeaders(Object.keys(linked[0]));
  sheet.addObjects(linked);
}

/**
 * Parse a sheet from a WorkbookReader into plain objects.
 * Row 0 = headers, rows 1..N = data.
 *
 * @param {import('@nap-sft/tablsx').WorkbookReader} reader
 * @param {number} sheetIndex  0-based sheet index
 * @returns {Object[]} Array of row objects (empty array if sheet doesn't exist)
 */
export function parseSheet(reader, sheetIndex) {
  if (sheetIndex >= reader.sheetCount) return [];

  const sheet = reader.sheet(sheetIndex);
  const rows = [];
  let headers = [];

  for (let i = 0; i < sheet.rowCount; i++) {
    const cellRow = sheet.getRow(i);

    if (i === 0) {
      headers = cellRow.map((cell) => cell.value);
      continue;
    }

    const obj = {};
    headers.forEach((header, idx) => {
      obj[header] = cellRow[idx]?.value;
    });
    rows.push(obj);
  }

  return rows;
}
