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
import { allocateNumber } from '../system/core/services/numberingService.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Columns stripped from every exported sheet (id is kept for upsert) */
const INTERNAL_COLS = new Set([
  'tenant_id', 'source_id',
  'created_at', 'created_by', 'updated_at', 'updated_by', 'deactivated_at',
]);

/** Default headers for empty child sheets */
export const PHONE_HEADERS = ['country_code', 'phone_type', 'phone_number', 'is_primary'];
export const ADDRESS_HEADERS = ['label', 'address_line_1', 'address_line_2', 'address_line_3', 'city', 'state_province', 'postal_code', 'country_code', 'is_primary'];
export const TAX_ID_HEADERS = ['country_code', 'tax_type', 'tax_value', 'is_primary'];

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
  if (hasRoles && 'roles' in row && typeof row.roles === 'string') {
    // Handle PG array literal "{a,b}" or comma-separated "a,b"
    const raw = row.roles.replace(/^\{|\}$/g, '').trim();
    row.roles = raw ? raw.split(',').map((s) => s.trim()) : [];
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
  for (const col of columns) {
    if (!(col.name in row)) continue;
    const val = row[col.name];
    if (val == null) continue;
    // varchar/char/text columns: coerce numbers to strings
    if (/^(varchar|char|text)/i.test(col.type) && typeof val === 'number') {
      row[col.name] = String(val);
    }
    // boolean columns: coerce strings
    if (col.type === 'boolean' && typeof val === 'string') {
      row[col.name] = val.toLowerCase() === 'true';
    }
  }
  return row;
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
  const { includeDeactivated, ...rest } = options;
  const rows = await model.findWhere(where, joinType, { ...rest, includeDeactivated });

  const { WorkbookBuilder, writeXlsx } = await import('@nap-sft/tablsx');
  const wb = WorkbookBuilder.create();

  const mainSheet = wb.sheet(config.sheetName);
  if (!rows.length) {
    // Empty table — write template headers so the file serves as an import template
    const schemaHeaders = (model._schema?.columns || [])
      .map((c) => c.name)
      .filter((n) => !INTERNAL_COLS.has(n));
    const extraHeaders = config.extraExportCols.map((c) => c.name);
    mainSheet.setHeaders([...schemaHeaders, ...extraHeaders]);
    // Also add empty child sheets with headers
    for (const child of config.childSheets) {
      const childSheet = wb.sheet(child.sheetName);
      childSheet.setHeaders([config.linkColName, ...child.headers]);
    }
    writeFileSync(filePath, writeXlsx(wb.build()));
    return { exported: 0, filePath };
  }

  const curated = curateRows(rows);
  // Append extra columns (status, password, etc.) using original rows for derivation
  const withExtras = curated.map((row, i) => {
    const extra = {};
    for (const col of config.extraExportCols) {
      extra[col.name] = col.derive(rows[i]);
    }
    return { ...row, ...extra };
  });
  mainSheet.setHeaders(Object.keys(withExtras[0]));
  mainSheet.addObjects(withExtras);

  // Build source_id → parent id map for child linkage
  const idBySourceId = new Map();
  const sourceIds = [];
  for (const row of rows) {
    if (row.source_id) {
      idBySourceId.set(row.source_id, row.id);
      sourceIds.push(row.source_id);
    }
  }

  // Child sheets
  const { db } = await getDb();
  const schema = model._schema.dbSchema;
  for (const child of config.childSheets) {
    await buildChildSheet(wb, child.sheetName, db(child.modelName, schema), sourceIds, idBySourceId, config.linkColName, child.headers);
  }

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
      for (let i = 0; i < insertResults.length; i++) {
        const rec = insertResults[i];
        const sourceId = sourceByParentId.get(rec.id);
        if (sourceId) {
          await t.none(`UPDATE ${s}.${pgp.as.name(config.entityName)} SET source_id = $1 WHERE id = $2`, [sourceId, rec.id]);
        }
        // Auto-assign code via numbering service if not provided
        if (!cleanInserts[i].code && config.idType) {
          const numbering = await allocateNumber(schema, config.idType, null, new Date(), t);
          if (numbering) {
            await t.none(`UPDATE ${s}.${pgp.as.name(config.entityName)} SET code = $1 WHERE id = $2`, [numbering.displayId, rec.id]);
          }
        }
        // Map the original spreadsheet ref → source_id
        const ref = toInsert[i]._ref;
        if (ref && sourceId) {
          refToSourceId.set(ref, sourceId);
        }
        // Archive newly inserted rows if status was 'archived'
        if (toInsert[i]._archive) {
          await t.none(`UPDATE ${s}.${pgp.as.name(config.entityName)} SET deactivated_at = NOW() WHERE id = $1`, [rec.id]);
        }
        // Provision nap_users for app users with password
        if (config.appUserProvisioning && cleanInserts[i].is_app_user && cleanInserts[i].email && toInsert[i]._password) {
          await provisionAppUser(rec.id, cleanInserts[i].email, toInsert[i]._password, tid, createdBy, config.appUserProvisioning.entityType, t);
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

  model.tx = null;

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
async function importChildSheet(reader, sheetIndex, refToSourceId, modelName, schema, linkColName, callbackFn, tenantId, t) {
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
 * Create a nap_users login record for an imported app user.
 * Sets status = 'invited' so the user must change their password on first login.
 *
 * @param {string} entityId   ID of the parent entity record
 * @param {string} email      User email
 * @param {string} password   Plain text password (will be hashed)
 * @param {string} tenantId   Tenant UUID
 * @param {string} createdBy  Creator UUID
 * @param {string} entityType Entity type for nap_users (e.g. 'employee', 'client')
 * @param {Object} t          Transaction object
 */
async function provisionAppUser(entityId, email, password, tenantId, createdBy, entityType, t) {
  const bcrypt = await import('bcrypt');
  const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
  const passwordHash = await bcrypt.default.hash(password, rounds);

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
}
