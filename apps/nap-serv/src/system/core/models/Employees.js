/**
 * @file Employees model — extends TableModel with multi-sheet upsert export/import
 * @module core/models/Employees
 *
 * Overrides exportToSpreadsheet to produce curated columns + child sheets
 * (phones, addresses, tax identifiers). Overrides importFromSpreadsheet to
 * handle multi-sheet workbooks with upsert semantics:
 *   - id is a valid UUID that exists in DB → UPDATE
 *   - id is blank or non-UUID → INSERT (id used as temp ref for child linkage)
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
 */

import { writeFileSync, readFileSync } from 'node:fs';
import { TableModel } from 'pg-schemata';
import employeesSchema from '../schemas/employeesSchema.js';
import { curateRows, buildChildSheet, parseSheet, isUuid } from '../../../lib/spreadsheetHelpers.js';
import { allocateNumber } from '../services/numberingService.js';

/** Lazy-load db to avoid triggering DB.init() at module load (breaks unit tests) */
let _db, _pgp;
async function getDb() {
  if (!_db) {
    const mod = await import('../../../db/db.js');
    _db = mod.default;
    _pgp = mod.pgp;
  }
  return { db: _db, pgp: _pgp };
}

/** Boolean columns that need coercion from spreadsheet strings */
const BOOL_COLS = ['is_app_user', 'is_primary_contact', 'is_billing_contact'];

/**
 * Coerce spreadsheet string values back to native JS types.
 * Booleans arrive as strings ('true'/'false'), text[] as PG array literals.
 */
function coerceRow(row) {
  for (const col of BOOL_COLS) {
    if (col in row && typeof row[col] === 'string') {
      row[col] = row[col].toLowerCase() === 'true';
    }
  }
  if ('roles' in row && typeof row.roles === 'string') {
    // Handle PG array literal "{a,b}" or comma-separated "a,b"
    const raw = row.roles.replace(/^\{|\}$/g, '').trim();
    row.roles = raw ? raw.split(',').map((s) => s.trim()) : [];
  }
  return row;
}

/**
 * Coerce child row values to match their schema column types.
 * Spreadsheets may return numbers for varchar columns (e.g. phone_number).
 */
function coerceChildRow(row, model) {
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

/** Default headers for empty child sheets */
const PHONE_HEADERS = ['country_code', 'phone_type', 'phone_number', 'is_primary'];
const ADDRESS_HEADERS = ['label', 'address_line_1', 'address_line_2', 'address_line_3', 'city', 'state_province', 'postal_code', 'country_code', 'is_primary'];
const TAX_ID_HEADERS = ['country_code', 'tax_type', 'tax_value', 'is_primary'];

export default class Employees extends TableModel {
  constructor(dbConn, pgpLib, logger = null) {
    super(dbConn, pgpLib, employeesSchema, logger);
  }

  /**
   * Export employees with curated columns and child data on separate sheets.
   * Includes `id` for upsert round-trips. Child sheets use `employee_id`
   * (the parent UUID) as the linkage column.
   */
  async exportToSpreadsheet(filePath, where = [], joinType = 'AND', options = {}) {
    const { includeDeactivated, ...rest } = options;
    const rows = await this.findWhere(where, joinType, { ...rest, includeDeactivated });

    const { WorkbookBuilder, writeXlsx } = await import('@nap-sft/tablsx');
    const wb = WorkbookBuilder.create();

    const empSheet = wb.sheet('Employees');
    if (!rows.length) {
      empSheet.addRow(['No data found']);
      writeFileSync(filePath, writeXlsx(wb.build()));
      return { exported: 0, filePath };
    }

    const curated = curateRows(rows);
    // Derive status from deactivated_at (stripped by curateRows)
    // Add empty password column for import round-trip (new app users)
    const withStatus = curated.map((row, i) => ({
      ...row,
      status: rows[i].deactivated_at ? 'archived' : 'active',
      password: '',
    }));
    empSheet.setHeaders(Object.keys(withStatus[0]));
    empSheet.addObjects(withStatus);

    // Build source_id → parent id map for child linkage
    const idBySourceId = new Map();
    const sourceIds = [];
    for (const row of rows) {
      if (row.source_id) {
        idBySourceId.set(row.source_id, row.id);
        sourceIds.push(row.source_id);
      }
    }

    // Child sheets — linked by employee_id (parent UUID)
    const { db } = await getDb();
    const schema = this._schema.dbSchema;
    await buildChildSheet(wb, 'Phone Numbers', db('phoneNumbers', schema), sourceIds, idBySourceId, 'employee_id', PHONE_HEADERS);
    await buildChildSheet(wb, 'Addresses', db('addresses', schema), sourceIds, idBySourceId, 'employee_id', ADDRESS_HEADERS);
    await buildChildSheet(wb, 'Tax Identifiers', db('taxIdentifiers', schema), sourceIds, idBySourceId, 'employee_id', TAX_ID_HEADERS);

    writeFileSync(filePath, writeXlsx(wb.build()));
    return { exported: rows.length, filePath };
  }

  /**
   * Import employees from a multi-sheet workbook with upsert semantics.
   *
   * Sheet 0: Employees (required) — `id` determines insert vs update
   * Sheet 1: Phone Numbers (optional, linked by employee_id)
   * Sheet 2: Addresses (optional, linked by employee_id)
   * Sheet 3: Tax Identifiers (optional, linked by employee_id)
   *
   * @param {string}   filePath
   * @param {number}   [_sheetIndex=0]  Ignored — always reads all sheets
   * @param {Function} [callbackFn]     Row transformer (adds tenant_code, created_by)
   * @param {Array}    [_returning]     Ignored
   * @returns {Promise<{inserted: number, updated: number, phones: number, addresses: number, taxIds: number}>}
   */
  async importFromSpreadsheet(filePath, _sheetIndex = 0, callbackFn = null, _returning = null) {
    const { WorkbookReader } = await import('@nap-sft/tablsx');

    const buffer = readFileSync(filePath);
    const reader = WorkbookReader.fromBuffer(buffer);

    const empRows = parseSheet(reader, 0);
    if (!empRows.length) {
      const { SchemaDefinitionError } = await import('pg-schemata');
      throw new SchemaDefinitionError('Spreadsheet is empty or invalid format');
    }

    const { db, pgp } = await getDb();
    const schema = this._schema.dbSchema;
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

    await db.tx(async (t) => {
      this.tx = t;

      // ── 1. Partition employee rows into updates vs inserts ──────────
      const uuidIds = empRows.filter((r) => isUuid(r.id)).map((r) => r.id);
      const existingSet = new Set();
      if (uuidIds.length) {
        const existing = await t.any(
          `SELECT id, source_id FROM ${s}.employees WHERE id IN ($1:csv)`,
          [uuidIds],
        );
        for (const row of existing) {
          existingSet.add(row.id);
          refToSourceId.set(row.id, row.source_id);
        }
      }

      const toUpdate = [];
      const toInsert = [];
      for (const row of empRows) {
        // Derive deactivated_at from status column, then strip both
        const isArchived = String(row.status).toLowerCase() === 'archived';
        const password = row.password || null;
        delete row.status;
        delete row.deactivated_at;
        delete row.password;
        const transformed = callbackFn ? await callbackFn({ ...row }) : { ...row };
        delete transformed.status;
        delete transformed.deactivated_at;
        delete transformed.tenant_code;
        delete transformed.password;
        if (tenantId) transformed.tenant_id = tenantId;
        coerceRow(transformed);

        if (existingSet.has(row.id)) {
          transformed._archive = isArchived;
          toUpdate.push(transformed);
        } else {
          // Preserve the spreadsheet ref for child linkage, then strip from insert data
          transformed._ref = row.id || null;
          transformed._archive = isArchived;
          transformed._password = password;
          delete transformed.id;
          toInsert.push(transformed);
        }
      }

      // ── 2. Run updates ─────────────────────────────────────────────
      for (const row of toUpdate) {
        const { id, tenant_code: _tc, _archive, ...changes } = row;
        await this.updateWhere([{ id }], changes, { includeDeactivated: true });
        // Sync archive status
        if (_archive) {
          await t.none(`UPDATE ${s}.employees SET deactivated_at = NOW() WHERE id = $1 AND deactivated_at IS NULL`, [id]);
        } else {
          await t.none(`UPDATE ${s}.employees SET deactivated_at = NULL WHERE id = $1 AND deactivated_at IS NOT NULL`, [id]);
        }
        updatedCount++;
      }

      // ── 3. Run inserts + create sources ────────────────────────────
      if (toInsert.length) {
        // Strip internal flags; disable is_app_user if no password provided
        const cleanInserts = toInsert.map(({ _ref, _archive, _password, tenant_code: _tc, ...rest }) => {
          if (rest.is_app_user && (!_password || !rest.email)) {
            appUserSkipped++;
            return { ...rest, is_app_user: false };
          }
          return rest;
        });

        // Clear codes that already exist to avoid unique constraint violations.
        // The unique constraint on (tenant_id, code) covers ALL rows (incl. deactivated),
        // so we must check without a deactivated_at filter.
        const insertCodes = cleanInserts.map((r) => r.code).filter(Boolean);
        if (insertCodes.length) {
          const existingCodes = await t.any(
            `SELECT code FROM ${s}.employees WHERE code IN ($1:csv)`,
            [insertCodes],
          );
          const takenCodes = new Set(existingCodes.map((r) => r.code));
          for (const row of cleanInserts) {
            if (row.code && takenCodes.has(row.code)) row.code = null;
          }
        }

        const empResults = await this.bulkInsert(cleanInserts, ['id', 'first_name', 'last_name']);
        insertedCount = empResults.length;

        // Create sources records
        const sourcesModel = db('sources', schema);
        sourcesModel.tx = t;

        const tenantId = cleanInserts[0]?.tenant_id;
        const createdBy = cleanInserts[0]?.created_by || null;

        const sourceRecords = empResults.map((emp) => ({
          tenant_id: tenantId,
          table_id: emp.id,
          source_type: 'employee',
          label: `${emp.first_name} ${emp.last_name}`,
          created_by: createdBy,
        }));

        const sourceResults = await sourcesModel.bulkInsert(sourceRecords, ['id', 'table_id']);

        // Link source_id back to employees and build ref map
        const sourceByEmpId = new Map(sourceResults.map((sr) => [sr.table_id, sr.id]));
        for (let i = 0; i < empResults.length; i++) {
          const emp = empResults[i];
          const sourceId = sourceByEmpId.get(emp.id);
          if (sourceId) {
            await t.none(`UPDATE ${s}.employees SET source_id = $1 WHERE id = $2`, [sourceId, emp.id]);
          }
          // Auto-assign code via numbering service if not provided
          if (!cleanInserts[i].code) {
            const numbering = await allocateNumber(schema, 'employee', null, new Date(), t);
            if (numbering) {
              await t.none(`UPDATE ${s}.employees SET code = $1 WHERE id = $2`, [numbering.displayId, emp.id]);
            }
          }
          // Map the original spreadsheet ref → source_id
          const ref = toInsert[i]._ref;
          if (ref && sourceId) {
            refToSourceId.set(ref, sourceId);
          }
          // Archive newly inserted rows if status was 'archived'
          if (toInsert[i]._archive) {
            await t.none(`UPDATE ${s}.employees SET deactivated_at = NOW() WHERE id = $1`, [emp.id]);
          }
          // Provision nap_users for app users with password
          if (cleanInserts[i].is_app_user && cleanInserts[i].email && toInsert[i]._password) {
            await this.#provisionAppUser(emp.id, cleanInserts[i].email, toInsert[i]._password, tenantId, createdBy, t);
          }
        }
      }

      // ── 4. Import child sheets ─────────────────────────────────────
      if (reader.sheetCount > 1) {
        phonesCount = await this.#importChildSheet(reader, 1, refToSourceId, 'phoneNumbers', schema, callbackFn, tenantId, t);
      }
      if (reader.sheetCount > 2) {
        addressesCount = await this.#importChildSheet(reader, 2, refToSourceId, 'addresses', schema, callbackFn, tenantId, t);
      }
      if (reader.sheetCount > 3) {
        taxIdsCount = await this.#importChildSheet(reader, 3, refToSourceId, 'taxIdentifiers', schema, callbackFn, tenantId, t);
      }
    });

    this.tx = null;

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
   * Resolves employee_id → source_id for linkage.
   * Existing child rows for affected parents are soft-deleted, then all
   * rows from the sheet are inserted fresh.
   * @private
   */
  async #importChildSheet(reader, sheetIndex, refToSourceId, modelName, schema, callbackFn, tenantId, t) {
    const childRows = parseSheet(reader, sheetIndex);
    if (!childRows.length) return 0;

    const { db, pgp } = await getDb();
    const s = pgp.as.name(schema);
    const childModel = db(modelName, schema);
    childModel.tx = t;

    const toInsert = [];
    const affectedSourceIds = new Set();

    for (const row of childRows) {
      const empRef = row.employee_id;
      delete row.employee_id;
      delete row.deactivated_at;
      delete row.id;

      const sourceId = refToSourceId.get(empRef);
      if (!sourceId) continue; // can't link — skip

      affectedSourceIds.add(sourceId);
      const base = { ...row, source_id: sourceId };
      const transformed = callbackFn ? await callbackFn(base) : base;
      delete transformed.tenant_code;
      if (tenantId) transformed.tenant_id = tenantId;
      // Coerce values to match schema types (spreadsheet numbers → strings for varchar cols)
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
   * @private
   */
  async #provisionAppUser(employeeId, email, password, tenantId, createdBy, t) {
    const bcrypt = await import('bcrypt');
    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
    const passwordHash = await bcrypt.default.hash(password, rounds);

    const { db } = await getDb();
    const napUsersModel = db('napUsers', 'admin');
    napUsersModel.tx = t;

    await napUsersModel.insert({
      tenant_id: tenantId,
      entity_type: 'employee',
      entity_id: employeeId,
      email,
      password_hash: passwordHash,
      status: 'invited',
      created_by: createdBy,
    });
  }
}
