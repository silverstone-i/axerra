/**
 * @file Shared helpers for multi-sheet spreadsheet export/import
 * @module nap-serv/lib/spreadsheetHelpers
 *
 * Provides config-driven export/import for source entities (employees, vendors,
 * clients, contacts, companies) with child sheets (phones, addresses,
 * tax identifiers) linked via the polymorphic sources table.
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
 */

import { writeFileSync, readFileSync } from 'node:fs';
import { allocateNumber, allocateNumbers } from '../system/core/services/numberingService.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Columns stripped from every exported sheet (id is kept for upsert) */
const INTERNAL_COLS = new Set([
  'tenant_id', 'source_id',
  'created_at', 'created_by', 'updated_at', 'updated_by', 'deactivated_at',
]);

/** Default headers for empty child sheets */
export const PHONE_HEADERS = ['country_code', 'phone_type', 'phone_number', 'is_primary'];
export const ADDRESS_HEADERS = ['label', 'address_line_1', 'address_line_2', 'address_line_3', 'city', 'state_province', 'postal_code', 'country_code'];
export const TAX_ID_HEADERS = ['country_code', 'tax_type', 'tax_value'];
export const EMAIL_HEADERS = ['email', 'label', 'is_primary', 'is_login'];
export const CONTACT_EMAIL_HEADERS = ['email', 'label', 'is_primary'];

/** Lazy-load db to avoid triggering DB.init() at module load (breaks unit tests) */
let _db, _pgp;
async function getDb() {
  if (!_db) {
    const mod = await import('../db/db.js');
    _db = mod.default;
    _pgp = mod.pgp;
  }
  return { db: _db, pgp: _pgp };
}

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
    obj._rowNum = i + 1; // 1-based spreadsheet row number (row 1 = header)
    rows.push(obj);
  }

  return rows;
}

// ── Shared coercion helpers ──────────────────────────────────────────────────

/**
 * Coerce spreadsheet string values back to native JS types.
 * Booleans arrive as strings ('true'/'false'), text[] as PG array literals.
 *
 * @param {Object}   row       Row object (mutated in place)
 * @param {string[]} boolCols  Boolean columns to coerce
 * @param {boolean}  hasRoles  Whether to coerce the roles text[] column
 * @returns {Object} The mutated row
 */
export function coerceRow(row, boolCols, hasRoles) {
  for (const col of boolCols) {
    if (col in row && typeof row[col] === 'string') {
      row[col] = row[col].toLowerCase() === 'true';
    }
  }
  if (hasRoles) {
    if (typeof row.roles === 'string') {
      // Handle PG array literal "{a,b}" or comma-separated "a,b"
      const raw = row.roles.replace(/^\{|\}$/g, '').trim();
      row.roles = raw ? raw.split(',').map((s) => s.trim()) : [];
    } else if (row.roles == null) {
      row.roles = [];
    }
  }
  return row;
}

/**
 * Coerce child row values to match their schema column types.
 * Spreadsheets may return numbers for varchar columns (e.g. phone_number).
 *
 * @param {Object} row    Row object (mutated in place)
 * @param {Object} model  pg-schemata model (reads _schema.columns)
 * @returns {Object} The mutated row
 */
export function coerceChildRow(row, model) {
  const columns = model._schema?.columns;
  if (!columns) return row;
  const enumMap = _getEnumColumns(model._schema);
  for (const col of columns) {
    if (!(col.name in row)) continue;
    const val = row[col.name];
    if (val == null) {
      // Default null/undefined booleans to the schema default (or false)
      if (col.type === 'boolean') row[col.name] = col.default ?? false;
      continue;
    }
    // varchar/char/text columns: coerce numbers to strings
    if (/^(varchar|char|text)/i.test(col.type) && typeof val === 'number') {
      row[col.name] = String(val);
    }
    // enum columns: lowercase to match CHECK constraint values
    if (enumMap.has(col.name) && typeof val === 'string') {
      row[col.name] = val.toLowerCase().trim();
    }
    // boolean columns: coerce strings
    if (col.type === 'boolean' && typeof val === 'string') {
      row[col.name] = val.toLowerCase() === 'true';
    }
  }
  return row;
}

/**
 * Extract a Map of column name → Set of valid enum values from a schema's CHECK constraints.
 * Parses expressions like: "phone_type IN ('cell', 'work', 'home')"
 * @param {Object} schema pg-schemata schema definition
 * @returns {Map<string, Set<string>>}
 */
function _getEnumColumns(schema) {
  const map = new Map();
  const checks = schema?.constraints?.checks;
  if (!checks) return map;
  for (const check of checks) {
    if (!check.columns?.length || !check.expression) continue;
    const match = check.expression.match(/IN\s*\(([^)]+)\)/i);
    if (!match) continue;
    const values = new Set(match[1].match(/'([^']+)'/g)?.map((v) => v.slice(1, -1)) || []);
    if (values.size) map.set(check.columns[0], values);
  }
  return map;
}

/**
 * Validate grouped import rows before any DB operations.
 * Checks required parent fields, valid statuses, duplicate codes, and email formats.
 * Returns an array of error objects ({ sheet, row, column, value, message }).
 *
 * @param {Object[]}  groups       Output of groupFlatRows
 * @param {Object}    opts
 * @param {string}    opts.sheetName     Sheet label for error messages
 * @param {string[]}  opts.requiredFields Parent fields that must be non-empty
 * @param {boolean}   [opts.codeRequired] Whether code is required
 * @param {boolean}   [opts.validateEmails] Whether to check child emails
 * @param {Object[]}  [opts.conflicts]   Conflict objects from groupFlatRows
 * @returns {Object[]} Array of validation errors (empty = valid)
 */
export function validateImportGroups(groups, opts) {
  const { sheetName, requiredFields = [], codeRequired = false, validateEmails = true, conflicts = [] } = opts;
  const errors = [];

  for (const c of conflicts) {
    errors.push({
      sheet: sheetName, row: c.row, column: c.column, value: c.value,
      message: `Conflicting value — row ${c.existingRow} has "${c.existingValue}"`,
    });
  }

  const VALID_STATUSES = new Set(['active', 'archived', '']);
  const codeCounts = new Map();

  for (const group of groups) {
    const p = group.parent;

    // Required fields
    for (const field of requiredFields) {
      if (!p[field] || (typeof p[field] === 'string' && !p[field].trim())) {
        errors.push({ sheet: sheetName, row: p._rowNum || null, column: field, value: p[field] ?? '', message: `${field.replace(/_/g, ' ')} is required` });
      }
    }

    // Status
    const status = String(p.status ?? '').toLowerCase().trim();
    if (!VALID_STATUSES.has(status)) {
      errors.push({ sheet: sheetName, row: p._rowNum || null, column: 'status', value: p.status, message: 'Status must be "active" or "archived"' });
    }

    // Code uniqueness
    if (codeRequired) {
      const code = typeof p.code === 'string' ? p.code.trim() : '';
      if (!code) {
        errors.push({ sheet: sheetName, row: p._rowNum || null, column: 'code', value: p.code ?? '', message: 'Code is required' });
      }
    }
    if (p.code) {
      const code = String(p.code).trim();
      if (code) {
        const prev = codeCounts.get(code);
        if (prev) {
          errors.push({ sheet: sheetName, row: p._rowNum || null, column: 'code', value: code, message: `Duplicate code — also appears on row ${prev}` });
        } else {
          codeCounts.set(code, p._rowNum || '?');
        }
      }
    }

    // Emails
    if (validateEmails) {
      for (const child of group.children?.emails || []) {
        if (child.email && !EMAIL_RE.test(child.email)) {
          errors.push({ sheet: sheetName, row: child._rowNum || null, column: 'email', value: child.email, message: 'Invalid email format' });
        }
      }
    }
  }

  return errors;
}

/**
 * Parse a PG database error into a user-friendly import error.
 * Returns an error array if the error is a data issue, or null if it's an
 * unexpected system error that should propagate normally.
 *
 * @param {Error} err  The caught error
 * @returns {Object[]|null} Array of error objects or null
 */
export function parseDbImportError(err) {
  const pgCode = err.cause?.code || err.code;
  const detail = err.cause?.detail || err.detail || '';
  const message = err.cause?.message || err.message || '';

  // Not-null violation (23502)
  if (pgCode === '23502') {
    const colMatch = message.match(/column "(\w+)"/);
    const column = colMatch ? colMatch[1] : null;
    return [{ sheet: null, row: null, column, value: null, message: `${column ? column.replace(/_/g, ' ') : 'A required field'} cannot be empty` }];
  }

  // Unique violation (23505)
  if (pgCode === '23505') {
    const colMatch = detail.match(/\(([^)]+)\)=/);
    const column = colMatch ? colMatch[1] : null;
    const valMatch = detail.match(/=\(([^)]+)\)/);
    const value = valMatch ? valMatch[1] : null;
    return [{ sheet: null, row: null, column, value, message: `Duplicate value — already exists in the database` }];
  }

  // Foreign key violation (23503)
  if (pgCode === '23503') {
    const colMatch = detail.match(/\(([^)]+)\)=/);
    const column = colMatch ? colMatch[1] : null;
    const valMatch = detail.match(/=\(([^)]+)\)/);
    const value = valMatch ? valMatch[1] : null;
    return [{ sheet: null, row: null, column, value, message: `Referenced record does not exist` }];
  }

  // Check constraint violation (23514)
  if (pgCode === '23514') {
    return [{ sheet: null, row: null, column: null, value: null, message: `Value violates a data constraint: ${message}` }];
  }

  // String too long / data too long (22001)
  if (pgCode === '22001') {
    return [{ sheet: null, row: null, column: null, value: null, message: `A value exceeds the maximum allowed length` }];
  }

  // Invalid text representation / wrong data type (22P02)
  if (pgCode === '22P02') {
    return [{ sheet: null, row: null, column: null, value: null, message: `Invalid data format: ${message}` }];
  }

  return null;
}

// ── Config-driven export/import for source entities ──────────────────────────

/**
 * @typedef {Object} SourceEntityConfig
 * @property {string}   entityName      DB table name (e.g. 'employees')
 * @property {string}   sheetName       Main sheet tab label (e.g. 'Employees')
 * @property {string}   sourceType      sources.source_type value (e.g. 'employee')
 * @property {string}   linkColName     Child sheet linkage column (e.g. 'employee_id')
 * @property {string|null} idType       Numbering service id_type, or null to skip
 * @property {Function} buildLabel      (insertedRow) => string for sources.label
 * @property {string[]} returningCols   Columns to request from bulkInsert
 * @property {string[]} boolCols        Boolean columns that need coercion
 * @property {boolean}  hasRoles        Whether entity has a roles text[] column
 * @property {boolean}  codeRequired    If true, skip duplicate-code clearing (code is NOT NULL)
 * @property {Array<{name: string, derive: Function}>} extraExportCols  Extra columns appended on export
 * @property {string[]} extraImportStrip  Extra column names to strip before insert/update
 * @property {Array<{sheetName: string, modelName: string, headers: string[]}>} childSheets
 * @property {{entityType: string}|null} appUserProvisioning  If non-null, provision nap_users
 */

/**
 * Build an export workbook for a source entity with curated columns and child sheets,
 * but do NOT write to disk. Returns the workbook builder and metadata so callers can
 * append additional sheets (e.g. combined vendor + vendor_contacts export).
 *
 * @param {Object} model    pg-schemata model instance
 * @param {Array}  where    findWhere conditions
 * @param {string} joinType 'AND' or 'OR'
 * @param {Object} options  findWhere options (includeDeactivated, etc.)
 * @param {SourceEntityConfig} config
 * @param {import('@nap-sft/tablsx').WorkbookBuilder} [existingWb]  Optional workbook to append to
 * @returns {Promise<{wb: Object, rows: Object[], sourceIds: string[], idBySourceId: Map, writeXlsx: Function}>}
 */
export async function buildExportWorkbook(model, where, joinType, options, config, existingWb = null) {
  const { includeDeactivated, ...rest } = options;
  const rows = await model.findWhere(where, joinType, { ...rest, includeDeactivated });

  const { WorkbookBuilder, writeXlsx } = await import('@nap-sft/tablsx');
  const wb = existingWb || WorkbookBuilder.create();

  const mainSheet = wb.sheet(config.sheetName);
  if (!rows.length) {
    const schemaHeaders = (model._schema?.columns || [])
      .map((c) => c.name)
      .filter((n) => !INTERNAL_COLS.has(n));
    const extraHeaders = config.extraExportCols.map((c) => c.name);
    mainSheet.setHeaders([...schemaHeaders, ...extraHeaders]);
    for (const child of config.childSheets) {
      const childSheet = wb.sheet(child.sheetName);
      childSheet.setHeaders([config.linkColName, ...child.headers]);
    }
    return { wb, rows, sourceIds: [], idBySourceId: new Map(), writeXlsx };
  }

  const curated = curateRows(rows);
  const withExtras = curated.map((row, i) => {
    const extra = {};
    for (const col of config.extraExportCols) {
      extra[col.name] = col.derive(rows[i]);
    }
    return { ...row, ...extra };
  });
  mainSheet.setHeaders(Object.keys(withExtras[0]));
  mainSheet.addObjects(withExtras);

  const idBySourceId = new Map();
  const sourceIds = [];
  for (const row of rows) {
    if (row.source_id) {
      idBySourceId.set(row.source_id, row.id);
      sourceIds.push(row.source_id);
    }
  }

  const { db } = await getDb();
  const schema = model._schema.dbSchema;
  for (const child of config.childSheets) {
    await buildChildSheet(wb, child.sheetName, db(child.modelName, schema), sourceIds, idBySourceId, config.linkColName, child.headers);
  }

  return { wb, rows, sourceIds, idBySourceId, writeXlsx };
}

/**
 * Export a source entity with curated columns and child data on separate sheets.
 *
 * @param {Object} model    pg-schemata model instance (this)
 * @param {string} filePath Output file path
 * @param {Array}  where    findWhere conditions
 * @param {string} joinType 'AND' or 'OR'
 * @param {Object} options  findWhere options (includeDeactivated, etc.)
 * @param {SourceEntityConfig} config
 * @returns {Promise<{exported: number, filePath: string}>}
 */
export async function exportSourceEntity(model, filePath, where, joinType, options, config) {
  const { wb, rows, writeXlsx } = await buildExportWorkbook(model, where, joinType, options, config);

  writeFileSync(filePath, writeXlsx(wb.build()));
  return { exported: rows.length, filePath };
}

/**
 * Import a source entity from a multi-sheet workbook with upsert semantics.
 *
 * Sheet 0: Parent entity (required) — `id` determines insert vs update
 * Sheets 1..N: Child sheets (optional, linked by config.linkColName)
 *
 * @param {Object}   model        pg-schemata model instance (this)
 * @param {string}   filePath     Input file path
 * @param {number}   _sheetIndex  Ignored — always reads all sheets
 * @param {Function} callbackFn   Row transformer (adds tenant_code, created_by)
 * @param {SourceEntityConfig} config
 * @returns {Promise<{inserted: number, updated: number, phones: number, addresses: number, taxIds: number, appUserSkipped: number}>}
 */
export async function importSourceEntity(model, filePath, _sheetIndex, callbackFn, config) {
  const { WorkbookReader } = await import('@nap-sft/tablsx');

  const buffer = readFileSync(filePath);
  const reader = WorkbookReader.fromBuffer(buffer);

  const parentRows = parseSheet(reader, 0);
  if (!parentRows.length) {
    const { SchemaDefinitionError } = await import('pg-schemata');
    throw new SchemaDefinitionError('Spreadsheet is empty or invalid format');
  }

  const { db, pgp } = await getDb();
  const schema = model._schema.dbSchema;
  const s = pgp.as.name(schema);

  let insertedCount = 0;
  let updatedCount = 0;
  let phonesCount = 0;
  let addressesCount = 0;
  let taxIdsCount = 0;
  let appUserSkipped = 0;

  // refToSourceId maps the spreadsheet's id/ref value → source_id for child linkage
  const refToSourceId = new Map();

  // Resolve tenant_id from tenant_code (callbackFn provides tenant_code, not tenant_id)
  let tenantId;
  const sampleRow = callbackFn ? await callbackFn({}) : {};
  if (sampleRow.tenant_code) {
    const tenantRec = await db.oneOrNone(
      `SELECT id FROM admin.tenants WHERE tenant_code = $1 AND deactivated_at IS NULL`,
      [sampleRow.tenant_code.toUpperCase()],
    );
    tenantId = tenantRec?.id;
  }

  // Columns to strip from every row before DB operations
  const stripCols = ['status', 'deactivated_at', 'password', ...(config.extraImportStrip || [])];

  try {
  await db.tx(async (t) => {
    model.tx = t;

    // ── 1. Partition rows into updates vs inserts ──────────────────────
    const uuidIds = parentRows.filter((r) => isUuid(r.id)).map((r) => r.id);
    const existingSet = new Set();
    if (uuidIds.length) {
      const existing = await t.any(
        `SELECT id, source_id FROM ${s}.${pgp.as.name(config.entityName)} WHERE id IN ($1:csv)`,
        [uuidIds],
      );
      for (const row of existing) {
        existingSet.add(row.id);
        refToSourceId.set(row.id, row.source_id);
      }
    }

    const toUpdate = [];
    const toInsert = [];
    for (const row of parentRows) {
      const isArchived = String(row.status).toLowerCase() === 'archived';
      const password = row.password || null;
      // Strip ephemeral columns
      for (const col of stripCols) delete row[col];
      const transformed = callbackFn ? await callbackFn({ ...row }) : { ...row };
      for (const col of stripCols) delete transformed[col];
      delete transformed.tenant_code;
      if (tenantId) transformed.tenant_id = tenantId;
      coerceRow(transformed, config.boolCols, config.hasRoles);

      if (existingSet.has(row.id)) {
        transformed._archive = isArchived;
        toUpdate.push(transformed);
      } else {
        transformed._ref = row.id || null;
        transformed._archive = isArchived;
        transformed._password = password;
        delete transformed.id;
        toInsert.push(transformed);
      }
    }

    // ── 2. Run updates ────────────────────────────────────────────────
    for (const row of toUpdate) {
      const { id, tenant_code: _tc, _archive, ...changes } = row;
      await model.updateWhere([{ id }], changes, { includeDeactivated: true });
      if (_archive) {
        await t.none(`UPDATE ${s}.${pgp.as.name(config.entityName)} SET deactivated_at = NOW() WHERE id = $1 AND deactivated_at IS NULL`, [id]);
      } else {
        await t.none(`UPDATE ${s}.${pgp.as.name(config.entityName)} SET deactivated_at = NULL WHERE id = $1 AND deactivated_at IS NOT NULL`, [id]);
      }
      updatedCount++;
    }

    // ── 3. Run inserts + create sources ───────────────────────────────
    if (toInsert.length) {
      // Strip internal flags; disable is_app_user if provisioning enabled but missing password/email
      const cleanInserts = toInsert.map(({ _ref, _archive, _password, tenant_code: _tc, ...rest }) => {
        if (config.appUserProvisioning && rest.is_app_user && (!_password || !rest.email)) {
          appUserSkipped++;
          return { ...rest, is_app_user: false };
        }
        return rest;
      });

      // Clear codes that already exist to avoid unique constraint violations
      if (!config.codeRequired) {
        const insertCodes = cleanInserts.map((r) => r.code).filter(Boolean);
        if (insertCodes.length) {
          const existingCodes = await t.any(
            `SELECT code FROM ${s}.${pgp.as.name(config.entityName)} WHERE code IN ($1:csv)`,
            [insertCodes],
          );
          const takenCodes = new Set(existingCodes.map((r) => r.code));
          for (const row of cleanInserts) {
            if (row.code && takenCodes.has(row.code)) row.code = null;
          }
        }
      }

      const insertResults = await model.bulkInsert(cleanInserts, config.returningCols);
      insertedCount = insertResults.length;

      // Create sources records
      const sourcesModel = db('sources', schema);
      sourcesModel.tx = t;

      const tid = cleanInserts[0]?.tenant_id;
      const createdBy = cleanInserts[0]?.created_by || null;

      const sourceRecords = insertResults.map((rec) => ({
        tenant_id: tid,
        table_id: rec.id,
        source_type: config.sourceType,
        label: config.buildLabel(rec),
        created_by: createdBy,
      }));

      const sourceResults = await sourcesModel.bulkInsert(sourceRecords, ['id', 'table_id']);

      // Link source_id back to parent and build ref map
      const sourceByParentId = new Map(sourceResults.map((sr) => [sr.table_id, sr.id]));
      const tbl = pgp.as.name(config.entityName);

      // ── Batch: link source_id ────────────────────────────────────
      const sourceLinks = insertResults
        .map((rec) => ({ id: rec.id, source_id: sourceByParentId.get(rec.id) }))
        .filter((r) => r.source_id);
      if (sourceLinks.length) {
        const vals = sourceLinks.map((r) => pgp.as.format('($1::uuid, $2::uuid)', [r.id, r.source_id])).join(', ');
        await t.none(`UPDATE ${s}.${tbl} AS v SET source_id = vals.source_id FROM (VALUES ${vals}) AS vals(id, source_id) WHERE v.id = vals.id`);
      }

      // ── Batch: allocate codes ────────────────────────────────────
      if (config.idType) {
        const needCodeIndices = [];
        for (let i = 0; i < cleanInserts.length; i++) {
          if (!cleanInserts[i].code) needCodeIndices.push(i);
        }
        if (needCodeIndices.length) {
          const codes = await allocateNumbers(schema, config.idType, needCodeIndices.length, null, new Date(), t);
          if (codes) {
            const codeUpdates = needCodeIndices.map((idx, ci) => ({
              id: insertResults[idx].id,
              code: codes[ci].displayId,
            }));
            const codeVals = codeUpdates.map((r) => pgp.as.format('($1::uuid, $2)', [r.id, r.code])).join(', ');
            await t.none(`UPDATE ${s}.${tbl} AS v SET code = vals.code FROM (VALUES ${codeVals}) AS vals(id, code) WHERE v.id = vals.id`);
          }
        }
      }

      // Build ref map (JS only, no DB)
      for (let i = 0; i < insertResults.length; i++) {
        const ref = toInsert[i]._ref;
        const sourceId = sourceByParentId.get(insertResults[i].id);
        if (ref && sourceId) refToSourceId.set(ref, sourceId);
      }

      // ── Batch: archive inserted rows whose status was 'archived' ─
      const archiveIds = insertResults.filter((_, i) => toInsert[i]._archive).map((r) => r.id);
      if (archiveIds.length) {
        await t.none(`UPDATE ${s}.${tbl} SET deactivated_at = NOW() WHERE id IN ($1:csv)`, [archiveIds]);
      }

      // ── Provision app users (bcrypt hashed in parallel, DB inserts sequential) ─
      if (config.appUserProvisioning) {
        const appUserEntries = [];
        for (let i = 0; i < insertResults.length; i++) {
          if (cleanInserts[i].is_app_user && cleanInserts[i].email && toInsert[i]._password) {
            appUserEntries.push({ index: i, password: toInsert[i]._password });
          }
        }
        if (appUserEntries.length) {
          const hashMap = await batchHashPasswords(appUserEntries);
          for (const { index } of appUserEntries) {
            const created = await provisionAppUser(
              insertResults[index].id, cleanInserts[index].email, toInsert[index]._password,
              tid, createdBy, config.appUserProvisioning.entityType, t, hashMap.get(index),
            );
            if (!created) {
              await t.none(`UPDATE ${s}.${tbl} SET is_app_user = false WHERE id = $1`, [insertResults[index].id]);
              appUserSkipped++;
            }
          }
        }
      }
    }

    // ── 4. Import child sheets ────────────────────────────────────────
    for (let ci = 0; ci < config.childSheets.length; ci++) {
      const sheetIdx = ci + 1;
      if (reader.sheetCount > sheetIdx) {
        const count = await importChildSheet(reader, sheetIdx, refToSourceId, config.childSheets[ci].modelName, schema, config.linkColName, callbackFn, tenantId, t);
        // Map child model names to result keys
        if (config.childSheets[ci].modelName === 'phoneNumbers') phonesCount = count;
        else if (config.childSheets[ci].modelName === 'addresses') addressesCount = count;
        else if (config.childSheets[ci].modelName === 'taxIdentifiers') taxIdsCount = count;
      }
    }
  });
  } catch (err) {
    const dataErrors = parseDbImportError(err);
    if (dataErrors) return { errors: dataErrors };
    throw err;
  } finally {
    model.tx = null;
  }

  return {
    inserted: insertedCount,
    updated: updatedCount,
    phones: phonesCount,
    addresses: addressesCount,
    taxIds: taxIdsCount,
    appUserSkipped,
  };
}

/**
 * Parse and import a child sheet using delete-and-reinsert per parent.
 * Resolves parent linkage column → source_id.
 *
 * @param {Object}   reader         WorkbookReader instance
 * @param {number}   sheetIndex     0-based sheet index
 * @param {Map}      refToSourceId  Maps parent id/ref → source_id
 * @param {string}   modelName      Child model name (e.g. 'phoneNumbers')
 * @param {string}   schema         Tenant schema name
 * @param {string}   linkColName    Parent linkage column in the sheet (e.g. 'employee_id')
 * @param {Function} callbackFn     Row transformer
 * @param {string}   tenantId       Resolved tenant UUID
 * @param {Object}   t              Transaction object
 * @returns {Promise<number>} Number of rows inserted
 */
export async function importChildSheet(reader, sheetIndex, refToSourceId, modelName, schema, linkColName, callbackFn, tenantId, t) {
  const childRows = parseSheet(reader, sheetIndex);
  if (!childRows.length) return 0;

  const { db, pgp } = await getDb();
  const s = pgp.as.name(schema);
  const childModel = db(modelName, schema);
  childModel.tx = t;

  const toInsert = [];
  const affectedSourceIds = new Set();

  for (const row of childRows) {
    const parentRef = row[linkColName];
    delete row[linkColName];
    delete row.deactivated_at;
    delete row.id;

    const sourceId = refToSourceId.get(parentRef);
    if (!sourceId) continue; // can't link — skip

    affectedSourceIds.add(sourceId);
    const base = { ...row, source_id: sourceId };
    const transformed = callbackFn ? await callbackFn(base) : base;
    delete transformed.tenant_code;
    if (tenantId) transformed.tenant_id = tenantId;
    coerceChildRow(transformed, childModel);
    toInsert.push(transformed);
  }

  if (!toInsert.length) return 0;

  // Soft-delete existing child rows for affected parents
  const tableName = childModel._schema?.table || modelName;
  const sourceIdArray = [...affectedSourceIds];
  await t.none(
    `UPDATE ${s}.${pgp.as.name(tableName)} SET deactivated_at = NOW() WHERE source_id IN ($1:csv) AND deactivated_at IS NULL`,
    [sourceIdArray],
  );

  // Insert all rows from the sheet
  const result = await childModel.bulkInsert(toInsert);
  return typeof result === 'number' ? result : toInsert.length;
}

/**
 * Hash multiple passwords in parallel using libuv worker threads.
 * Uses 4 bcrypt rounds for bulk import — these are temporary hashes for
 * 'invited' users who must change their password on first login.
 *
 * @param {Array<{index: number, password: string}>} entries
 * @returns {Promise<Map<number, string>>} Map of index → bcrypt hash
 */
export async function batchHashPasswords(entries) {
  if (!entries.length) return new Map();
  const bcrypt = await import('bcrypt');
  const rounds = 4;
  const results = await Promise.all(
    entries.map(async ({ index, password }) => ({
      index,
      hash: await bcrypt.default.hash(password, rounds),
    })),
  );
  return new Map(results.map((r) => [r.index, r.hash]));
}

/**
 * Create a nap_users login record for an imported app user.
 * Sets status = 'invited' so the user must change their password on first login.
 *
 * @param {string} entityId    ID of the parent entity record
 * @param {string} email       User email
 * @param {string} password    Plain text password (will be hashed unless preHash provided)
 * @param {string} tenantId    Tenant UUID
 * @param {string} createdBy   Creator UUID
 * @param {string} entityType  Entity type for nap_users (e.g. 'employee', 'client')
 * @param {Object} t           Transaction object
 * @param {string} [preHash]   Pre-computed bcrypt hash (skips hashing when provided)
 */
export async function provisionAppUser(entityId, email, password, tenantId, createdBy, entityType, t, preHash = null) {
  // Skip if an active nap_user with this email already exists
  const existing = await t.oneOrNone(
    'SELECT id FROM admin.nap_users WHERE email = $1 AND deactivated_at IS NULL',
    [email],
  );
  if (existing) return false;

  let passwordHash;
  if (preHash) {
    passwordHash = preHash;
  } else {
    const bcrypt = await import('bcrypt');
    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
    passwordHash = await bcrypt.default.hash(password, rounds);
  }

  const { db } = await getDb();
  const napUsersModel = db('napUsers', 'admin');
  napUsersModel.tx = t;

  await napUsersModel.insert({
    tenant_id: tenantId,
    entity_type: entityType,
    entity_id: entityId,
    email,
    password_hash: passwordHash,
    status: 'invited',
    created_by: createdBy,
  });
  return true;
}

// ── Flat child descriptors ───────────────────────────────────────────────────

/**
 * @typedef {Object} FlatChildDescriptor
 * @property {string}   key       Key in the children object (e.g. 'emails')
 * @property {string}   modelName pg-schemata model name (e.g. 'emails')
 * @property {Function} test      (row) => boolean — does this row have data for this child?
 * @property {Function} extract   (row) => Object — extract child columns from a flat row
 * @property {string[]} cols      Source column names from the child record
 * @property {string[]} flatCols  Column names in the flat sheet
 */

/** @type {FlatChildDescriptor} */
export const FLAT_CHILD_EMAILS = {
  key: 'emails',
  modelName: 'emails',
  test: (r) => !!r.email,
  extract: (r) => ({ email: r.email, label: r.email_label, is_primary: r.email_is_primary, is_login: r.email_is_login }),
  cols: ['email', 'label', 'is_primary', 'is_login'],
  flatCols: ['email', 'email_label', 'email_is_primary', 'email_is_login'],
};

/** @type {FlatChildDescriptor} — same as FLAT_CHILD_EMAILS but without is_login (for contacts) */
export const FLAT_CHILD_EMAILS_NO_LOGIN = {
  key: 'emails',
  modelName: 'emails',
  test: (r) => !!r.email,
  extract: (r) => ({ email: r.email, label: r.email_label, is_primary: r.email_is_primary }),
  cols: ['email', 'label', 'is_primary'],
  flatCols: ['email', 'email_label', 'email_is_primary'],
};

/** @type {FlatChildDescriptor} */
export const FLAT_CHILD_PHONES = {
  key: 'phones',
  modelName: 'phoneNumbers',
  test: (r) => !!r.phone_number,
  extract: (r) => ({ country_code: r.phone_country_code, phone_type: r.phone_type, phone_number: r.phone_number, is_primary: r.phone_is_primary }),
  cols: ['country_code', 'phone_type', 'phone_number', 'is_primary'],
  flatCols: ['phone_country_code', 'phone_type', 'phone_number', 'phone_is_primary'],
};

/** @type {FlatChildDescriptor} */
export const FLAT_CHILD_ADDRESSES = {
  key: 'addresses',
  modelName: 'addresses',
  test: (r) => !!r.address_line_1,
  extract: (r) => ({
    label: r.address_label, address_line_1: r.address_line_1, address_line_2: r.address_line_2,
    address_line_3: r.address_line_3, city: r.address_city, state_province: r.address_state_province,
    postal_code: r.address_postal_code, country_code: r.address_country_code,
  }),
  cols: ['label', 'address_line_1', 'address_line_2', 'address_line_3', 'city', 'state_province', 'postal_code', 'country_code'],
  flatCols: ['address_label', 'address_line_1', 'address_line_2', 'address_line_3', 'address_city', 'address_state_province', 'address_postal_code', 'address_country_code'],
};

/** @type {FlatChildDescriptor} */
export const FLAT_CHILD_TAX_IDS = {
  key: 'taxIds',
  modelName: 'taxIdentifiers',
  test: (r) => !!r.tax_value,
  extract: (r) => ({ country_code: r.tax_country_code, tax_type: r.tax_type, tax_value: r.tax_value }),
  cols: ['country_code', 'tax_type', 'tax_value'],
  flatCols: ['tax_country_code', 'tax_type', 'tax_value'],
};

// EMAIL_RE moved to top of file (before validateImportGroups)

// ── Config-driven flat export/import for source entities ─────────────────────

/**
 * Export a source entity as a single flat worksheet with repeated rows for children.
 *
 * @param {Object} model    pg-schemata model instance
 * @param {string} filePath Output .xlsx path
 * @param {Array}  where    findWhere conditions
 * @param {string} joinType 'AND' | 'OR'
 * @param {Object} options  { includeDeactivated, ... }
 * @param {SourceEntityConfig} config  Must include `flat` sub-object
 * @returns {Promise<{exported: number, filePath: string}>}
 */
export async function exportFlatSourceEntity(model, filePath, where, joinType, options, config) {
  const { includeDeactivated, ...rest } = options;
  const parentRows = await model.findWhere(where, joinType, { ...rest, includeDeactivated });

  const { WorkbookBuilder, writeXlsx } = await import('@nap-sft/tablsx');
  const wb = WorkbookBuilder.create();
  const flatHeaders = [...config.flat.parentCols, ...config.flat.children.flatMap((c) => c.flatCols)];
  const sheet = wb.sheet(config.sheetName);
  sheet.setHeaders(flatHeaders);

  if (!parentRows.length) {
    writeFileSync(filePath, writeXlsx(wb.build()));
    return { exported: 0, filePath };
  }

  const { db } = await getDb();
  const schema = model._schema.dbSchema;

  // Batch-query all children by source_id
  const sourceIds = parentRows.map((c) => c.source_id).filter(Boolean);
  const childrenBySource = new Map();

  if (sourceIds.length) {
    for (const cfg of config.flat.children) {
      const rows = await db(cfg.modelName, schema).findWhere([{ source_id: { $in: sourceIds } }]);
      for (const row of rows) {
        let entry = childrenBySource.get(row.source_id);
        if (!entry) {
          entry = {};
          for (const c of config.flat.children) entry[c.key] = [];
          childrenBySource.set(row.source_id, entry);
        }
        entry[cfg.key].push(row);
      }
    }
  }

  // Build flat rows
  const emptyChildren = {};
  for (const c of config.flat.children) emptyChildren[c.key] = [];

  for (const rec of parentRows) {
    const children = childrenBySource.get(rec.source_id) || emptyChildren;
    // Build parent object from config parentCols, applying extraExportCols
    const parent = {};
    for (const col of config.flat.parentCols) {
      if (config.extraExportCols?.some((e) => e.name === col)) {
        parent[col] = config.extraExportCols.find((e) => e.name === col).derive(rec);
      } else if (col === 'roles' && Array.isArray(rec.roles)) {
        parent[col] = `{${rec.roles.join(',')}}`;
      } else {
        parent[col] = rec[col] ?? '';
      }
    }

    const childArrays = config.flat.children.map((cfg) => ({
      cols: cfg.cols,
      flatCols: cfg.flatCols,
      rows: children[cfg.key],
    }));
    const flatRows = buildFlatRows(parent, childArrays);
    sheet.addObjects(flatRows);
  }

  writeFileSync(filePath, writeXlsx(wb.build()));
  return { exported: parentRows.length, filePath };
}

/**
 * Import a source entity from a single flat sheet with repeated rows for children.
 *
 * @param {Object}   model       pg-schemata model instance
 * @param {Object}   reader      WorkbookReader (already loaded)
 * @param {Function} callbackFn  Row transformer (tenant_code, created_by)
 * @param {SourceEntityConfig} config  Must include `flat` sub-object
 * @returns {Promise<{inserted: number, updated: number, appUserSkipped: number} | {errors: Array}>}
 */
export async function importFlatSourceEntity(model, reader, callbackFn, config) {
  const { db, pgp } = await getDb();
  const schema = model._schema.dbSchema;
  const s = pgp.as.name(schema);

  // Resolve tenant_id
  let tenantId;
  const sampleRow = callbackFn ? await callbackFn({}) : {};
  if (sampleRow.tenant_code) {
    const tenantRec = await db.oneOrNone(
      'SELECT id FROM admin.tenants WHERE tenant_code = $1 AND deactivated_at IS NULL',
      [sampleRow.tenant_code.toUpperCase()],
    );
    tenantId = tenantRec?.id;
  }

  // Parse and group rows
  const flatRows = parseSheet(reader, 0);
  if (!flatRows.length) {
    const { SchemaDefinitionError } = await import('pg-schemata');
    throw new SchemaDefinitionError('Spreadsheet is empty or invalid format');
  }

  const childExtractors = config.flat.children.map((c) => ({ name: c.key, test: c.test, extract: c.extract }));
  const { groups, conflicts } = groupFlatRows(flatRows, config.flat.groupKeyFn, config.flat.parentCols, childExtractors);

  // ── Pre-validation ─────────────────────────────────────────────────────────
  const sheetName = reader.sheetNames?.[0] || config.sheetName;
  const errors = [];

  // Surface conflicting parent fields across rows in the same group
  for (const c of conflicts) {
    errors.push({
      sheet: sheetName, row: c.row, column: c.column, value: c.value,
      message: `Conflicts with row ${c.existingRow} which has "${c.existingValue}"`,
    });
  }

  const hasEmails = config.flat.children.some((c) => c.key === 'emails');

  // Validate emails
  if (hasEmails) {
    for (const group of groups) {
      for (const child of group.children.emails || []) {
        if (child.email && !EMAIL_RE.test(child.email)) {
          errors.push({ sheet: sheetName, row: child._rowNum || null, column: 'email', value: child.email, message: 'Invalid email format' });
        }
      }
    }
  }

  // Validate child enum fields (e.g. phone_type)
  for (const cfg of config.flat.children) {
    const childModel = db(cfg.modelName, schema);
    const enumMap = _getEnumColumns(childModel._schema);
    if (!enumMap.size) continue;
    for (const group of groups) {
      const childRows = group.children[cfg.key];
      if (!childRows?.length) continue;
      for (const row of childRows) {
        for (const [colName, validValues] of enumMap) {
          const val = row[colName];
          if (val == null || val === '') continue;
          const normalized = String(val).toLowerCase().trim();
          if (!validValues.has(normalized)) {
            const flatCol = cfg.flatCols?.[cfg.cols.indexOf(colName)] || colName;
            const options = [...validValues].join(', ');
            errors.push({ sheet: sheetName, row: row._rowNum || null, column: flatCol, value: val, message: `Invalid value — must be one of: ${options}` });
          }
        }
      }
    }
  }

  // Validate no duplicate codes
  const codeCounts = new Map();
  for (const group of groups) {
    const code = typeof group.parent.code === 'string' ? group.parent.code.trim() : '';
    if (code) {
      const prev = codeCounts.get(code);
      if (prev) {
        errors.push({ sheet: sheetName, row: group.parent._rowNum || null, column: 'code', value: code, message: `Duplicate code — also appears on row ${prev}` });
      } else {
        codeCounts.set(code, group.parent._rowNum || '?');
      }
    }
  }

  // Validate required name fields and status
  const VALID_STATUSES = new Set(['active', 'archived', '']);
  for (const group of groups) {
    for (const field of config.flat.nameFields) {
      if (!group.parent[field] || (typeof group.parent[field] === 'string' && !group.parent[field].trim())) {
        errors.push({ sheet: sheetName, row: group.parent._rowNum || null, column: field, value: group.parent[field] ?? '', message: `${field.replace(/_/g, ' ')} is required` });
      }
    }
    const status = String(group.parent.status ?? '').toLowerCase().trim();
    if (!VALID_STATUSES.has(status)) {
      errors.push({ sheet: sheetName, row: group.parent._rowNum || null, column: 'status', value: group.parent.status, message: 'Status must be "active" or "archived"' });
    }
    if (config.codeRequired) {
      const code = typeof group.parent.code === 'string' ? group.parent.code.trim() : '';
      if (!code) {
        errors.push({ sheet: sheetName, row: group.parent._rowNum || null, column: 'code', value: group.parent.code ?? '', message: 'Code is required' });
      }
    }
  }

  if (errors.length) return { errors };

  let insertedCount = 0;
  let updatedCount = 0;
  let appUserSkipped = 0;

  try {
  await db.tx(async (t) => {
    model.tx = t;

    // ── Phase 1: Partition into updates vs inserts ──────────────────────
    const uuidIds = groups.filter((g) => isUuid(g.parent.id)).map((g) => g.parent.id);
    const existingEntities = new Map();
    if (uuidIds.length) {
      const existing = await t.any(
        `SELECT id, source_id FROM ${s}.${pgp.as.name(config.entityName)} WHERE id IN ($1:csv)`,
        [uuidIds],
      );
      for (const row of existing) existingEntities.set(row.id, row.source_id);
    }

    const toUpdate = [];
    const toInsert = [];
    const stripCols = ['status', 'deactivated_at', 'password'];

    for (const group of groups) {
      const { parent } = group;
      const isArchived = String(parent.status).toLowerCase() === 'archived';
      const password = parent.password || null;
      const { _rowNum: _rn, ...entityData } = { ...parent };
      for (const col of stripCols) delete entityData[col];

      const transformed = callbackFn ? await callbackFn({ ...entityData }) : { ...entityData };
      for (const col of stripCols) delete transformed[col];
      delete transformed.tenant_code;
      if (tenantId) transformed.tenant_id = tenantId;
      coerceRow(transformed, config.boolCols, config.hasRoles);
      // Normalize empty-string codes to null
      if (typeof transformed.code === 'string' && !transformed.code.trim()) transformed.code = null;

      if (existingEntities.has(parent.id)) {
        toUpdate.push({ transformed, isArchived, group });
      } else {
        toInsert.push({ transformed, isArchived, group, ref: parent.id || null, password });
      }
    }

    // ── Phase 2: Run updates ───────────────────────────────────────────
    for (const { transformed, isArchived, group } of toUpdate) {
      const { id, ...changes } = transformed;
      await model.updateWhere([{ id }], changes, { includeDeactivated: true });
      if (isArchived) {
        await t.none(`UPDATE ${s}.${pgp.as.name(config.entityName)} SET deactivated_at = NOW() WHERE id = $1 AND deactivated_at IS NULL`, [id]);
      } else {
        await t.none(`UPDATE ${s}.${pgp.as.name(config.entityName)} SET deactivated_at = NULL WHERE id = $1 AND deactivated_at IS NOT NULL`, [id]);
      }
      updatedCount++;

      // Upsert children for updated entity
      const sourceId = existingEntities.get(id);
      if (sourceId) {
        await _upsertFlatChildren(t, s, schema, db, pgp, sourceId, group.children, config.flat.children, callbackFn, tenantId);
      }
    }

    // ── Phase 3: Run inserts ───────────────────────────────────────────
    if (toInsert.length) {
      const cleanInserts = toInsert.map(({ transformed }) => {
        const { id: _id, ...clean } = transformed;
        if (typeof clean.code === 'string' && !clean.code.trim()) clean.code = null;
        return clean;
      });

      // Clear codes that already exist in the DB
      if (!config.codeRequired) {
        const insertCodes = cleanInserts.map((r) => r.code).filter(Boolean);
        if (insertCodes.length) {
          const existingCodes = await t.any(
            `SELECT code FROM ${s}.${pgp.as.name(config.entityName)} WHERE code IN ($1:csv)`,
            [insertCodes],
          );
          const takenCodes = new Set(existingCodes.map((r) => r.code));
          for (const row of cleanInserts) {
            if (row.code && takenCodes.has(row.code)) row.code = null;
          }
        }
      }

      const insertResults = await model.bulkInsert(cleanInserts, config.returningCols);
      insertedCount = insertResults.length;

      // Create sources records
      const sourcesModel = db('sources', schema);
      sourcesModel.tx = t;
      const tid = cleanInserts[0]?.tenant_id;
      const createdBy = cleanInserts[0]?.created_by || null;

      const sourceRecords = insertResults.map((rec) => ({
        tenant_id: tid,
        table_id: rec.id,
        source_type: config.sourceType,
        label: config.buildLabel(rec),
        created_by: createdBy,
      }));
      const sourceResults = await sourcesModel.bulkInsert(sourceRecords, ['id', 'table_id']);
      const sourceByParentId = new Map(sourceResults.map((sr) => [sr.table_id, sr.id]));

      for (let i = 0; i < insertResults.length; i++) {
        const rec = insertResults[i];
        const sourceId = sourceByParentId.get(rec.id);
        if (sourceId) {
          await t.none(`UPDATE ${s}.${pgp.as.name(config.entityName)} SET source_id = $1 WHERE id = $2`, [sourceId, rec.id]);
        }
        if (!cleanInserts[i].code && config.idType) {
          const numbering = await allocateNumber(schema, config.idType, null, new Date(), t);
          if (numbering) {
            await t.none(`UPDATE ${s}.${pgp.as.name(config.entityName)} SET code = $1 WHERE id = $2`, [numbering.displayId, rec.id]);
          }
        }

        if (toInsert[i].isArchived) {
          await t.none(`UPDATE ${s}.${pgp.as.name(config.entityName)} SET deactivated_at = NOW() WHERE id = $1`, [rec.id]);
        }

        // Insert children for new entity
        if (sourceId) {
          await _upsertFlatChildren(t, s, schema, db, pgp, sourceId, toInsert[i].group.children, config.flat.children, callbackFn, tenantId);
        }
      }

      // Provision nap_users for app-user entities after emails are inserted
      if (config.appUserProvisioning) {
        const crypto = await import('node:crypto');

        for (let i = 0; i < insertResults.length; i++) {
          if (!cleanInserts[i].is_app_user) continue;

          const rec = insertResults[i];
          const sourceId = sourceByParentId.get(rec.id);
          if (!sourceId) continue;

          const loginEmail = await t.oneOrNone(
            `SELECT email FROM ${s}.emails
             WHERE source_id = $1 AND deactivated_at IS NULL
             ORDER BY is_login DESC, is_primary DESC, created_at LIMIT 1`,
            [sourceId],
          );
          if (!loginEmail) {
            await t.none(`UPDATE ${s}.${pgp.as.name(config.entityName)} SET is_app_user = false WHERE id = $1`, [rec.id]);
            appUserSkipped++;
            continue;
          }

          const clearPassword = toInsert[i].password || crypto.randomBytes(12).toString('base64url');
          const created = await provisionAppUser(rec.id, loginEmail.email, clearPassword, tid, createdBy, config.appUserProvisioning.entityType, t);
          if (!created) {
            await t.none(`UPDATE ${s}.${pgp.as.name(config.entityName)} SET is_app_user = false WHERE id = $1`, [rec.id]);
            appUserSkipped++;
          }
        }
      }
    }
  });
  } catch (err) {
    const dataErrors = parseDbImportError(err);
    if (dataErrors) return { errors: dataErrors };
    throw err;
  } finally {
    model.tx = null;
  }

  return {
    inserted: insertedCount,
    updated: updatedCount,
    appUserSkipped,
  };
}

/**
 * Upsert flat children: soft-delete existing, insert new from grouped child arrays.
 * @private
 */
async function _upsertFlatChildren(t, s, schema, db, pgp, sourceId, children, childConfigs, callbackFn, tenantId) {
  for (const cfg of childConfigs) {
    const childRows = children[cfg.key];
    if (!childRows || !childRows.length) continue;

    const childModel = db(cfg.modelName, schema);
    childModel.tx = t;
    const tableName = childModel._schema?.table || cfg.modelName;

    // Soft-delete existing children
    await t.none(
      `UPDATE ${s}.${pgp.as.name(tableName)} SET deactivated_at = NOW() WHERE source_id = $1 AND deactivated_at IS NULL`,
      [sourceId],
    );

    // Insert new children
    const toInsert = [];
    for (const row of childRows) {
      const { _rowNum: _, ...rest } = row;
      const base = { ...rest, source_id: sourceId };
      const transformed = callbackFn ? await callbackFn(base) : base;
      delete transformed.tenant_code;
      if (tenantId) transformed.tenant_id = tenantId;
      coerceChildRow(transformed, childModel);
      // Default null values on notNull boolean columns to false (continuation rows leave them blank)
      for (const col of childModel._schema?.columns || []) {
        if (col.type === 'boolean' && col.notNull && transformed[col.name] == null) {
          transformed[col.name] = col.default ?? false;
        }
      }
      toInsert.push(transformed);
    }

    if (toInsert.length) {
      await childModel.bulkInsert(toInsert);
    }
  }
}

// ── Flat-format helpers (repeated-row export/import) ─────────────────────────

/**
 * Build flat repeated rows from a parent record and its child arrays.
 * Produces N rows where N = max(childArrays[*].rows.length, 1).
 * Each row repeats all parent columns; child columns are filled from the i-th
 * record of each type, or left as empty strings if that type has fewer records.
 *
 * @param {Object} parent        Parent row object (all columns to repeat)
 * @param {Array<{prefix: string, cols: string[], rows: Object[]}>} childArrays
 *   Each entry has:
 *   - prefix: column prefix in the flat sheet (e.g. 'email', 'phone')
 *   - cols: source column names from the child record (e.g. ['email', 'label'])
 *   - flatCols: column names in the flat sheet (e.g. ['email', 'email_label'])
 *   - rows: array of child record objects
 * @returns {Object[]} Array of flat row objects
 */
export function buildFlatRows(parent, childArrays) {
  const maxRows = Math.max(...childArrays.map((c) => c.rows.length), 1);
  const result = [];

  for (let i = 0; i < maxRows; i++) {
    const row = { ...parent };
    for (const child of childArrays) {
      const childRow = child.rows[i];
      for (let j = 0; j < child.cols.length; j++) {
        row[child.flatCols[j]] = childRow ? (childRow[child.cols[j]] ?? '') : '';
      }
    }
    result.push(row);
  }

  return result;
}

/**
 * Group parsed flat rows by a key function and extract child records.
 * Rows with the same key are collected into one group. The parent columns
 * are taken from the first row; child records are extracted from every row
 * where the child's test function returns true.
 *
 * @param {Object[]} rows             Parsed sheet rows
 * @param {Function} keyFn            (row) => string grouping key
 * @param {string[]} parentCols       Column names that belong to the parent
 * @param {Array<{name: string, test: Function, extract: Function}>} childExtractors
 *   Each entry has:
 *   - name: child type identifier (e.g. 'emails')
 *   - test(row): returns true if this row has data for this child type
 *   - extract(row): returns a plain object with the child columns
 * @returns {Array<{parent: Object, children: Object}>}
 */
export function groupFlatRows(rows, keyFn, parentCols, childExtractors) {
  const groups = [];
  const conflicts = [];
  const keyMap = new Map();
  let lastGroup = null;

  for (const row of rows) {
    // Detect continuation rows: all parent columns are null/empty → attach to previous group
    const isContinuation = lastGroup && parentCols.every((col) => {
      const v = row[col];
      return v == null || v === '' || (typeof v === 'string' && !v.trim());
    });

    let group;
    if (isContinuation) {
      group = lastGroup;
    } else {
      const key = keyFn(row);
      group = keyMap.get(key);
      if (group) {
        // Existing group — check for conflicting parent values
        for (const col of parentCols) {
          const incoming = row[col];
          if (incoming == null || incoming === '' || (typeof incoming === 'string' && !incoming.trim())) continue;
          const existing = group.parent[col];
          if (existing == null || existing === '' || (typeof existing === 'string' && !existing.trim())) continue;
          if (String(incoming).trim() !== String(existing).trim()) {
            conflicts.push({
              row: row._rowNum || null,
              column: col,
              value: incoming,
              existingRow: group.parent._rowNum || null,
              existingValue: existing,
            });
          }
        }
      } else {
        const parent = {};
        for (const col of parentCols) parent[col] = row[col];
        if (row._rowNum != null) parent._rowNum = row._rowNum;
        group = { parent, children: {} };
        for (const ext of childExtractors) group.children[ext.name] = [];
        groups.push(group);
        keyMap.set(key, group);
      }
      lastGroup = group;
    }

    for (const ext of childExtractors) {
      if (ext.test(row)) {
        const child = ext.extract(row);
        // Deduplicate: skip if identical child data already exists in this group
        const { _rowNum: _, ...vals } = child;
        const key = JSON.stringify(vals);
        const existing = group.children[ext.name];
        if (existing.some((c) => { const { _rowNum: __, ...v } = c; return JSON.stringify(v) === key; })) continue;
        if (row._rowNum != null) child._rowNum = row._rowNum;
        existing.push(child);
      }
    }
  }

  return { groups, conflicts };
}
