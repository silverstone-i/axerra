/**
 * @file Shared helpers for multi-sheet spreadsheet export/import
 * @module server/lib/spreadsheetHelpers
 *
 * Provides config-driven export/import for source entities (employees, vendors,
 * clients, contacts, companies) with child sheets (phones, addresses,
 * tax identifiers) linked via the polymorphic sources table.
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import { writeFileSync, readFileSync } from 'node:fs';
import { allocateNumber, allocateNumbers } from '../system/core/services/numberingService.js';
import { stripFormatting, formatByPattern, COUNTRIES, TAX_TYPES } from '@axerra/shared';
import { syncLoginEmail } from './loginEmailSync.js';
import { archiveAppUser, restoreAppUserBinding, enableAppUser } from './employeeAppUserSync.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Hard cap on collected validation/reconciliation issues per import. */
export const MAX_IMPORT_ISSUES = 100;
const ISSUE_LIMIT_MESSAGE = `Issue limit reached (${MAX_IMPORT_ISSUES}). Fix and re-import to see remaining problems.`;

/**
 * Append an issue to the array, capped at MAX_IMPORT_ISSUES. After the cap
 * is hit, subsequent calls are no-ops; a single sentinel entry is appended once.
 */
export function pushIssue(errors, issue) {
  if (!Array.isArray(errors)) return;
  if (errors.length < MAX_IMPORT_ISSUES) {
    errors.push(issue);
    return;
  }
  if (!errors._limitFlagged) {
    errors.push({ sheet: issue?.sheet ?? null, row: null, column: null, value: null, message: ISSUE_LIMIT_MESSAGE });
    Object.defineProperty(errors, '_limitFlagged', { value: true, enumerable: false });
  }
}

/** Columns stripped from every exported sheet (id is kept for upsert) */
const INTERNAL_COLS = new Set(['tenant_id', 'source_id', 'created_at', 'created_by', 'updated_at', 'updated_by', 'deactivated_at']);

/** Default headers for empty child sheets */
export const PHONE_HEADERS = ['country_code', 'phone_type', 'phone_number', 'is_primary'];
export const ADDRESS_HEADERS = [
  'label',
  'address_line_1',
  'address_line_2',
  'address_line_3',
  'city',
  'state_province',
  'postal_code',
  'country_code',
];
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
      sheet.setHeaders([linkColName, 'id', ...defaultHeaders]);
    } else {
      sheet.addRow(['No data']);
    }
    return;
  }

  const rows = await model.findWhere([{ source_id: { $in: sourceIds } }]);
  // Keep child `id` so re-import can match on UUID (round-trip dedup guarantee)
  const curated = curateRows(rows);

  if (!curated.length) {
    if (defaultHeaders.length) {
      sheet.setHeaders([linkColName, 'id', ...defaultHeaders]);
    } else {
      sheet.addRow(['No data']);
    }
    return;
  }

  // Prepend linkage column (parent id/ref) followed by the child UUID, then the rest.
  // Order: <linkColName>, id, <other columns>
  const linked = curated.map((row, i) => {
    const { id, ...restCols } = row;
    const out = { [linkColName]: parentIdBySourceId.get(rows[i].source_id) || '', id, ...restCols };
    formatExportRow(out, 'phone_number', 'country_code', 'tax_value', 'country_code', 'tax_type');
    return out;
  });

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
    if (!(col in row)) continue;
    const v = row[col];
    if (typeof v === 'string') {
      row[col] = v.toLowerCase() === 'true';
    } else if (v == null) {
      // Blank cells in boolean columns are interpreted as `false`. Schemas
      // mark these columns notNull with default false, so a null/undefined
      // value would otherwise reach the DB and trip a 23502 with no row
      // context the user can act on.
      row[col] = false;
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
  const enumMap = getEnumColumns(model._schema);
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
    // Strip formatting from phone numbers and tax identifiers so DB always stores raw values
    if ((col.name === 'phone_number' || col.name === 'tax_value') && typeof val === 'string') {
      row[col.name] = stripFormatting(val);
    }
  }
  return row;
}

/**
 * Format phone_number and tax_value fields in an export row using country/type patterns.
 * Mutates the row in place for performance (export rows are ephemeral).
 * @param {Object} row         Flat row object (may contain phone_number, tax_value, etc.)
 * @param {string} phoneCol    Column name for phone number (e.g. 'phone_number')
 * @param {string} phoneCtryCol Column name for phone country code (e.g. 'country_code' or 'phone_country_code')
 * @param {string} [taxCol]    Column name for tax value (e.g. 'tax_value')
 * @param {string} [taxCtryCol] Column name for tax country code (e.g. 'country_code' or 'tax_country_code')
 * @param {string} [taxTypeCol] Column name for tax type (e.g. 'tax_type')
 */
export function formatExportRow(row, phoneCol, phoneCtryCol, taxCol, taxCtryCol, taxTypeCol) {
  if (row[phoneCol]) {
    const cc = (row[phoneCtryCol] || '').trim().toUpperCase();
    const normalizedCc = cc.replace(/^\+/, '');
    const country =
      COUNTRIES.find((c) => c.code === cc) ||
      COUNTRIES.find((c) => c.placeholder && (c.dial_code === cc || c.dial_code === `+${normalizedCc}`));
    if (country?.placeholder) row[phoneCol] = formatByPattern(String(row[phoneCol]), country.placeholder);
  }
  if (taxCol && row[taxCol]) {
    const tc = (row[taxCtryCol] || '').trim().toUpperCase();
    const types = TAX_TYPES[tc] || TAX_TYPES._OTHER || [];
    const taxType = types.find((t) => t.code === row[taxTypeCol]);
    if (taxType?.placeholder) row[taxCol] = formatByPattern(String(row[taxCol]), taxType.placeholder);
  }
}

/**
 * Extract a Map of column name → Set of valid enum values from a schema's CHECK constraints.
 * Parses expressions like: "phone_type IN ('cell', 'work', 'home')"
 * @param {Object} schema pg-schemata schema definition
 * @returns {Map<string, Set<string>>}
 */
export function getEnumColumns(schema) {
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
 * When `entityType` is supplied, also runs a single batched cross-tenant
 * collision check against `admin.portal_users` for any child email marked
 * `is_login`:
 *   - 'employee' | 'client' → adds a row error blocking the import
 *     (single-tenant entities cannot share login identity).
 *   - 'vendor_contact'      → skipped here; the controller's bind-existing
 *     path handles binding to the existing portal_user at write time.
 *
 * @param {Object[]}  groups       Output of groupFlatRows
 * @param {Object}    opts
 * @param {string}    opts.sheetName     Sheet label for error messages
 * @param {string[]}  opts.requiredFields Parent fields that must be non-empty
 * @param {boolean}   [opts.codeRequired] Whether code is required
 * @param {boolean}   [opts.validateEmails] Whether to check child emails
 * @param {Object[]}  [opts.conflicts]   Conflict objects from groupFlatRows
 * @param {('employee'|'client'|'vendor_contact')} [opts.entityType] Source
 *   entity type — when set, enables the cross-tenant portal_user collision
 *   check (and is the policy lever for whether collisions abort the row).
 * @returns {Promise<Object[]>} Array of validation errors (empty = valid)
 */
export async function validateImportGroups(groups, opts) {
  const { sheetName, requiredFields = [], codeRequired = false, validateEmails = true, conflicts = [], entityType } = opts;
  const errors = [];

  for (const c of conflicts) {
    errors.push({
      sheet: sheetName,
      row: c.row,
      column: c.column,
      value: c.value,
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
        errors.push({
          sheet: sheetName,
          row: p._rowNum || null,
          column: field,
          value: p[field] ?? '',
          message: `${field.replace(/_/g, ' ')} is required`,
        });
      }
    }

    // Status
    const status = String(p.status ?? '')
      .toLowerCase()
      .trim();
    if (!VALID_STATUSES.has(status)) {
      errors.push({
        sheet: sheetName,
        row: p._rowNum || null,
        column: 'status',
        value: p.status,
        message: 'Status must be "active" or "archived"',
      });
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
          errors.push({
            sheet: sheetName,
            row: p._rowNum || null,
            column: 'code',
            value: code,
            message: `Duplicate code — also appears on row ${prev}`,
          });
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

  // Cross-tenant portal_user collision check
  if (entityType === 'employee' || entityType === 'client') {
    errors.push(...(await checkPortalUserEmailCollisions(groups, { sheetName, entityType })));
  }

  return errors;
}

/**
 * Single-batch cross-tenant collision check against `admin.portal_users` for
 * incoming login emails. Returns a row-level error for each insert whose
 * `is_login` email matches an active portal_user in another tenant.
 *
 * The helper is import-policy aware (not policy-agnostic):
 *   - vendor_contact rows are intentionally allowed through — the controller's
 *     bind-existing path attaches to the existing portal_user at write time.
 *     Returns immediately without touching the database.
 *   - Rows whose `group.parent.id` is a UUID are treated as updates (round-trip
 *     export/import) and skipped — the existing portal_user already belongs
 *     to that entity, so the email match is expected. Non-UUID `id` values
 *     are spreadsheet-only linkage refs for new rows and don't disqualify.
 *   - Rows whose `group.parent.is_app_user` is falsy are skipped — no
 *     portal_user will be provisioned, so no collision can occur.
 *
 * @param {Object[]} groups Output of groupFlatRows
 * @param {Object}   opts
 * @param {string}   opts.sheetName Sheet label for error messages
 * @param {('employee'|'client'|'vendor_contact')} opts.entityType
 * @returns {Promise<Object[]>} Array of validation errors (empty = no collisions)
 */
export async function checkPortalUserEmailCollisions(groups, opts) {
  const { sheetName, entityType, ownEntities, tenantId } = opts;
  if (!groups?.length) return [];

  // vendor_contact bind-existing flow runs in the controller — don't pay
  // for a DB query whose result we'd discard.
  if (entityType === 'vendor_contact') return [];

  const isAppUserFlag = (v) => v === true || v === 1 || (typeof v === 'string' && v.toLowerCase() === 'true');
  const isLoginFlag = (v) => v === true || v === 1 || (typeof v === 'string' && v.toLowerCase() === 'true');
  const hasOwnEntities = ownEntities && typeof ownEntities.get === 'function';

  // Collect login emails for any group whose entity will end up an app user.
  //
  //   INSERT case: parent.id non-UUID (or UUID without a DB row when
  //     ownEntities is provided), parent.is_app_user truthy → new portal_user
  //     will be provisioned with this login email; check for collision.
  //
  //   UPDATE case (only when ownEntities is supplied): existing entity's
  //     portal_user.email may sync to the new value. Check for collision but
  //     exclude self.
  //
  // Legacy callers that don't pass ownEntities preserve the original behavior:
  // skip UUID-id parents entirely (treated as round-trip updates).
  const loginEmailRows = [];
  const updatingEntityIds = new Set();
  for (const group of groups) {
    const parent = group.parent || {};
    let existing = null;
    if (hasOwnEntities) {
      existing = ownEntities.get(parent.id) || null;
    } else if (isUuid(parent.id)) {
      // Legacy path: existing entity → updates are not checked here.
      continue;
    }

    let willBeAppUser;
    if (existing) {
      const incoming = parent.is_app_user;
      willBeAppUser = incoming === undefined || incoming === '' ? !!existing.is_app_user : isAppUserFlag(incoming);
    } else {
      willBeAppUser = isAppUserFlag(parent.is_app_user);
    }
    if (!willBeAppUser) continue;

    if (existing) updatingEntityIds.add(existing.id);

    for (const child of group.children?.emails || []) {
      if (!child?.email) continue;
      if (!isLoginFlag(child.is_login)) continue;
      if (!EMAIL_RE.test(child.email)) continue;
      loginEmailRows.push({
        email: String(child.email).trim().toLowerCase(),
        row: child._rowNum || null,
      });
    }
  }
  if (!loginEmailRows.length) return [];

  const { db } = await getDb();

  // Resolve own portal_user_ids for entities being updated in this import,
  // so the cross-tenant collision check can skip self-matches.
  const selfPortalUserIds = new Set();
  if (updatingEntityIds.size && tenantId) {
    const rows = await db.manyOrNone(
      `SELECT portal_user_id FROM admin.portal_user_tenants
       WHERE entity_type = $1 AND tenant_id = $2 AND entity_id IN ($3:csv) AND deactivated_at IS NULL`,
      [entityType, tenantId, [...updatingEntityIds]],
    );
    if (rows?.length) for (const r of rows) selfPortalUserIds.add(r.portal_user_id);
  }

  const errors = [];

  // Intra-file collision: two or more rows in the same file claim the same
  // login email. Caught here rather than in the DB pass because both rows
  // would be "new" or not-yet-bound and the cross-tenant check can't see
  // them. Emit an error keyed to each offending row so the user can fix all
  // collisions in one pass.
  const rowsByEmail = new Map();
  for (const lr of loginEmailRows) {
    if (!rowsByEmail.has(lr.email)) rowsByEmail.set(lr.email, []);
    rowsByEmail.get(lr.email).push(lr);
  }
  for (const [email, dupes] of rowsByEmail) {
    if (dupes.length < 2) continue;
    for (const lr of dupes) {
      errors.push({
        sheet: sheetName,
        row: lr.row,
        column: 'email',
        value: email,
        message: `Login email ${email} appears on multiple rows in this file. Each app-user employee must have a unique login email.`,
      });
    }
  }

  const uniqueEmails = [...new Set(loginEmailRows.map((r) => r.email))];
  const existingPortalUsers = await db.manyOrNone(
    `SELECT id, LOWER(email) AS email FROM admin.portal_users
     WHERE LOWER(email) = ANY($1::text[]) AND deactivated_at IS NULL`,
    [uniqueEmails],
  );
  if (!existingPortalUsers?.length) return errors;

  // Build a map of email → portal_user_ids that hold it.
  const holdersByEmail = new Map();
  for (const r of existingPortalUsers) {
    if (!holdersByEmail.has(r.email)) holdersByEmail.set(r.email, new Set());
    holdersByEmail.get(r.email).add(r.id);
  }

  for (const { email, row } of loginEmailRows) {
    const holders = holdersByEmail.get(email);
    if (!holders || !holders.size) continue;
    const otherHolders = [...holders].filter((id) => !selfPortalUserIds.has(id));
    if (!otherHolders.length) continue;
    errors.push({
      sheet: sheetName,
      row,
      column: 'email',
      value: email,
      message: `Login email ${email} is already in use by another portal user. Single-tenant entities cannot share login identity.`,
    });
  }
  return errors;
}

/**
 * Validate child-row enum columns against pre-computed enum maps.
 * Caller is responsible for resolving each child model's schema and computing
 * its enum map via getEnumColumns(); this helper stays sync so it can be
 * tested without a DB.
 *
 * @param {Object[]} groups Output of groupFlatRows
 * @param {Object}   opts
 * @param {string}   opts.sheetName Sheet label for error messages
 * @param {Array}    [opts.childEnums] Per-child enum config:
 *   - key: child group key (e.g. 'phones', 'taxIds') matching group.children
 *   - enumMap: Map<colName, Set<validValue>> from getEnumColumns()
 *   - flatColByCol: Map<colName, flatHeader> for error reporting (optional;
 *     falls back to colName when missing)
 * @returns {Object[]} Array of validation errors (empty = valid)
 */
export function validateChildEnums(groups, opts) {
  const { sheetName, childEnums = [] } = opts;
  const errors = [];
  if (!childEnums.length) return errors;
  for (const cfg of childEnums) {
    if (!cfg.enumMap?.size) continue;
    for (const group of groups) {
      const childRows = group.children?.[cfg.key];
      if (!childRows?.length) continue;
      for (const row of childRows) {
        for (const [colName, validValues] of cfg.enumMap) {
          const val = row[colName];
          if (val == null || val === '') continue;
          const normalized = String(val).toLowerCase().trim();
          if (!validValues.has(normalized)) {
            const flatCol = cfg.flatColByCol?.get(colName) || colName;
            const options = [...validValues].join(', ');
            errors.push({
              sheet: sheetName,
              row: row._rowNum || null,
              column: flatCol,
              value: val,
              message: `Invalid value — must be one of: ${options}`,
            });
          }
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
    return [
      { sheet: null, row: null, column, value: null, message: `${column ? column.replace(/_/g, ' ') : 'A required field'} cannot be empty` },
    ];
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
 * @property {{entityType: string}|null} appUserProvisioning  If non-null, provision portal_users
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
    const schemaHeaders = (model._schema?.columns || []).map((c) => c.name).filter((n) => !INTERNAL_COLS.has(n));
    const extraHeaders = config.extraExportCols.map((c) => c.name);
    mainSheet.setHeaders([...schemaHeaders, ...extraHeaders]);
    for (const child of config.childSheets) {
      const childSheet = wb.sheet(child.sheetName);
      childSheet.setHeaders([config.linkColName, 'id', ...child.headers]);
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
    const tenantRec = await db.oneOrNone(`SELECT id FROM admin.tenants WHERE tenant_code = $1 AND deactivated_at IS NULL`, [
      sampleRow.tenant_code.toUpperCase(),
    ]);
    tenantId = tenantRec?.id;
  }

  // Columns to strip from every row before DB operations
  const stripCols = ['status', 'deactivated_at', 'password', ...(config.extraImportStrip || [])];

  // Hoisted so the post-child-sheet app-user provisioning step can read them.
  // Derive the SQL identifier from the schema, not config — keeps the raw-SQL
  // path in sync with whatever pg-schemata calls the table.
  const tbl = pgp.as.name(model._schema.table);
  let cleanInserts = [];
  let insertResults = [];
  let sourceByParentId = new Map();
  let tid;
  let createdBy = null;

  // ── Cross-tenant portal_user collision check (Part 2 of import dedup spec) ──
  // Build groups keyed by parent so the helper can filter to inserts only
  // (parent.id absent + parent.is_app_user truthy). Updates round-tripping
  // through export/import keep their existing portal_user binding and must
  // not be flagged as collisions.
  const provisionEntityType = config.appUserProvisioning?.entityType;
  if (provisionEntityType === 'employee' || provisionEntityType === 'client') {
    const emailSheetIdx = config.childSheets.findIndex((c) => c.modelName === 'emails') + 1;
    if (emailSheetIdx > 0 && reader.sheetCount > emailSheetIdx) {
      const emailRows = parseSheet(reader, emailSheetIdx);
      const groupsByRef = new Map();
      for (const parent of parentRows) {
        groupsByRef.set(parent.id || parent[config.linkColName] || parent._rowNum, {
          parent,
          children: { emails: [] },
        });
      }
      for (const e of emailRows) {
        const ref = e[config.linkColName];
        const group = groupsByRef.get(ref);
        if (group) group.children.emails.push(e);
      }
      const collisionErrors = await checkPortalUserEmailCollisions([...groupsByRef.values()], {
        sheetName: reader.sheetNames?.[emailSheetIdx] || 'Emails',
        entityType: provisionEntityType,
      });
      if (collisionErrors.length) return { errors: collisionErrors };
    }
  }

  try {
    await db.tx(async (t) => {
      model.tx = t;

      // ── 1. Partition rows into updates vs inserts ──────────────────────
      const uuidIds = parentRows.filter((r) => isUuid(r.id)).map((r) => r.id);
      const existingSet = new Set();
      if (uuidIds.length) {
        const existing = await t.any(`SELECT id, source_id FROM ${s}.${tbl} WHERE id IN ($1:csv)`, [uuidIds]);
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
          await t.none(`UPDATE ${s}.${tbl} SET deactivated_at = NOW() WHERE id = $1 AND deactivated_at IS NULL`, [id]);
        } else {
          await t.none(`UPDATE ${s}.${tbl} SET deactivated_at = NULL WHERE id = $1 AND deactivated_at IS NOT NULL`, [id]);
        }
        updatedCount++;
      }

      // ── 3. Run inserts + create sources ───────────────────────────────
      if (toInsert.length) {
        // Strip internal flags; disable is_app_user if provisioning enabled but no password supplied.
        // Email is sourced from the Emails child sheet after child rows are inserted (step 5).
        cleanInserts = toInsert.map(({ _ref, _archive, _password, tenant_code: _tc, ...rest }) => {
          if (config.appUserProvisioning && rest.is_app_user && !_password) {
            appUserSkipped++;
            return { ...rest, is_app_user: false };
          }
          return rest;
        });

        // When tenant numbering is enabled for this entity type, strip any
        // codes typed into the spreadsheet — the configured sequence is the
        // single source of truth for bulk imports.
        if (config.idType) {
          const cfg = await t.oneOrNone(
            `SELECT is_enabled FROM ${s}.tenant_numbering_config WHERE id_type = $1`,
            [config.idType],
          );
          if (cfg?.is_enabled) {
            for (const row of cleanInserts) row.code = null;
          }
        }

        // Clear codes that already exist to avoid unique constraint violations
        if (!config.codeRequired) {
          const insertCodes = cleanInserts.map((r) => r.code).filter(Boolean);
          if (insertCodes.length) {
            const existingCodes = await t.any(`SELECT code FROM ${s}.${tbl} WHERE code IN ($1:csv)`, [insertCodes]);
            const takenCodes = new Set(existingCodes.map((r) => r.code));
            for (const row of cleanInserts) {
              if (row.code && takenCodes.has(row.code)) row.code = null;
            }
          }
        }

        insertResults = await model.bulkInsert(cleanInserts, config.returningCols);
        insertedCount = insertResults.length;

        // Create sources records
        const sourcesModel = db('sources', schema);
        sourcesModel.tx = t;

        tid = cleanInserts[0]?.tenant_id;
        createdBy = cleanInserts[0]?.created_by || null;

        const sourceRecords = insertResults.map((rec) => ({
          tenant_id: tid,
          table_id: rec.id,
          source_type: config.sourceType,
          label: config.buildLabel(rec),
          created_by: createdBy,
          updated_by: createdBy,
        }));

        const sourceResults = await sourcesModel.bulkInsert(sourceRecords, ['id', 'table_id']);

        // Link source_id back to parent and build ref map
        sourceByParentId = new Map(sourceResults.map((sr) => [sr.table_id, sr.id]));

        // ── Batch: link source_id ────────────────────────────────────
        const sourceLinks = insertResults.map((rec) => ({ id: rec.id, source_id: sourceByParentId.get(rec.id) })).filter((r) => r.source_id);
        if (sourceLinks.length) {
          const vals = sourceLinks.map((r) => pgp.as.format('($1::uuid, $2::uuid)', [r.id, r.source_id])).join(', ');
          await t.none(
            `UPDATE ${s}.${tbl} AS v SET source_id = vals.source_id FROM (VALUES ${vals}) AS vals(id, source_id) WHERE v.id = vals.id`,
          );
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
      }

      // ── 4. Import child sheets ────────────────────────────────────────
      for (let ci = 0; ci < config.childSheets.length; ci++) {
        const sheetIdx = ci + 1;
        if (reader.sheetCount > sheetIdx) {
          const count = await importChildSheet(
            reader,
            sheetIdx,
            refToSourceId,
            config.childSheets[ci].modelName,
            schema,
            config.linkColName,
            callbackFn,
            tenantId,
            t,
          );
          // Map child model names to result keys
          if (config.childSheets[ci].modelName === 'phoneNumbers') phonesCount = count;
          else if (config.childSheets[ci].modelName === 'addresses') addressesCount = count;
          else if (config.childSheets[ci].modelName === 'taxIdentifiers') taxIdsCount = count;
        }
      }

      // ── 5. Provision app users — emails are now in the DB from step 4 ─
      if (toInsert.length && config.appUserProvisioning) {
        const appUserEntries = [];
        for (let i = 0; i < insertResults.length; i++) {
          if (cleanInserts[i].is_app_user && toInsert[i]._password) {
            appUserEntries.push({ index: i, password: toInsert[i]._password });
          }
        }
        if (appUserEntries.length) {
          const hashMap = await batchHashPasswords(appUserEntries);
          for (const { index } of appUserEntries) {
            const recId = insertResults[index].id;
            const sourceId = sourceByParentId.get(recId);
            const loginEmail = sourceId
              ? await t.oneOrNone(
                  `SELECT email FROM ${s}.emails
                   WHERE source_id = $1 AND deactivated_at IS NULL
                   ORDER BY is_login DESC, is_primary DESC, created_at LIMIT 1`,
                  [sourceId],
                )
              : null;
            if (!loginEmail) {
              await t.none(`UPDATE ${s}.${tbl} SET is_app_user = false WHERE id = $1`, [recId]);
              appUserSkipped++;
              continue;
            }
            const created = await provisionAppUser(
              recId,
              loginEmail.email,
              toInsert[index]._password,
              tid,
              createdBy,
              config.appUserProvisioning.entityType,
              t,
              hashMap.get(index),
            );
            if (!created) {
              await t.none(`UPDATE ${s}.${tbl} SET is_app_user = false WHERE id = $1`, [recId]);
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
  await t.none(`UPDATE ${s}.${pgp.as.name(tableName)} SET deactivated_at = NOW() WHERE source_id IN ($1:csv) AND deactivated_at IS NULL`, [
    sourceIdArray,
  ]);

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
 * Create a portal_users login record for an imported app user.
 * Sets status = 'invited' so the user must change their password on first login.
 *
 * @param {string} entityId    ID of the parent entity record
 * @param {string} email       User email
 * @param {string} password    Plain text password (will be hashed unless preHash provided)
 * @param {string} tenantId    Tenant UUID
 * @param {string} createdBy   Creator UUID
 * @param {string} entityType  Entity type for portal_users (e.g. 'employee', 'client')
 * @param {Object} t           Transaction object
 * @param {string} [preHash]   Pre-computed bcrypt hash (skips hashing when provided)
 */
export async function provisionAppUser(entityId, email, password, tenantId, createdBy, entityType, t, preHash = null) {
  // Skip if an active portal_user with this email already exists
  const existing = await t.oneOrNone('SELECT id FROM admin.portal_users WHERE email = $1 AND deactivated_at IS NULL', [email]);
  if (existing) return false;

  let passwordHash;
  if (preHash) {
    passwordHash = preHash;
  } else {
    const bcrypt = await import('bcrypt');
    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
    passwordHash = await bcrypt.default.hash(password, rounds);
  }

  const inserted = await t.one(
    `INSERT INTO admin.portal_users (email, password_hash, status, created_by)
     VALUES ($1, $2, 'invited', $3)
     RETURNING id`,
    [email, passwordHash, createdBy],
  );
  await t.none(
    `INSERT INTO admin.portal_user_tenants
       (portal_user_id, tenant_id, entity_type, entity_id, status, created_by)
     VALUES ($1, $2, $3, $4, 'active', $5)`,
    [inserted.id, tenantId, entityType, entityId, createdBy],
  );
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

/**
 * Reconciliation metadata extensions on each FlatChildDescriptor:
 *   slotKeyCols          - identifies the per-source slot (e.g. ['label'], ['phone_type'])
 *   slotKeyLabel         - user-facing label for that slot in error messages
 *   compareCols          - columns that count as "data changed → UPDATE"
 *   crossSourceUniqCols  - columns subject to a cross-source partial unique index (or null)
 *   crossSourceUniqWhere - (row) => boolean restricting which rows trigger the check (e.g. cell phones)
 *   crossSourceUniqLabel - human label for cross-source conflict messages
 */

/** @type {FlatChildDescriptor} */
export const FLAT_CHILD_EMAILS = {
  key: 'emails',
  modelName: 'emails',
  test: (r) => !!r.email,
  extract: (r) => ({ email: r.email, label: r.email_label, is_primary: r.email_is_primary, is_login: r.email_is_login }),
  cols: ['email', 'label', 'is_primary', 'is_login'],
  flatCols: ['email', 'email_label', 'email_is_primary', 'email_is_login'],
  slotKeyCols: ['label'],
  slotKeyLabel: 'label',
  compareCols: ['email', 'is_primary', 'is_login'],
  crossSourceUniqCols: ['email'],
  crossSourceUniqLabel: 'email',
};

/** @type {FlatChildDescriptor} — same as FLAT_CHILD_EMAILS but without is_login (for contacts) */
export const FLAT_CHILD_EMAILS_NO_LOGIN = {
  key: 'emails',
  modelName: 'emails',
  test: (r) => !!r.email,
  extract: (r) => ({ email: r.email, label: r.email_label, is_primary: r.email_is_primary }),
  cols: ['email', 'label', 'is_primary'],
  flatCols: ['email', 'email_label', 'email_is_primary'],
  slotKeyCols: ['label'],
  slotKeyLabel: 'label',
  compareCols: ['email', 'is_primary'],
  crossSourceUniqCols: ['email'],
  crossSourceUniqLabel: 'email',
};

/** @type {FlatChildDescriptor} */
export const FLAT_CHILD_PHONES = {
  key: 'phones',
  modelName: 'phoneNumbers',
  test: (r) => !!r.phone_number,
  extract: (r) => ({
    country_code: r.phone_country_code,
    phone_type: r.phone_type,
    phone_number: r.phone_number,
    is_primary: r.phone_is_primary,
  }),
  cols: ['country_code', 'phone_type', 'phone_number', 'is_primary'],
  flatCols: ['phone_country_code', 'phone_type', 'phone_number', 'phone_is_primary'],
  slotKeyCols: ['phone_type'],
  slotKeyLabel: 'phone_type',
  compareCols: ['country_code', 'phone_number', 'is_primary'],
  crossSourceUniqCols: ['country_code', 'phone_number'],
  crossSourceUniqWhere: (r) => String(r.phone_type || '').toLowerCase() === 'cell',
  crossSourceUniqLabel: 'cell phone number',
};

/** @type {FlatChildDescriptor} */
export const FLAT_CHILD_ADDRESSES = {
  key: 'addresses',
  modelName: 'addresses',
  test: (r) => !!r.address_line_1,
  extract: (r) => ({
    label: r.address_label,
    address_line_1: r.address_line_1,
    address_line_2: r.address_line_2,
    address_line_3: r.address_line_3,
    city: r.address_city,
    state_province: r.address_state_province,
    postal_code: r.address_postal_code,
    country_code: r.address_country_code,
  }),
  cols: ['label', 'address_line_1', 'address_line_2', 'address_line_3', 'city', 'state_province', 'postal_code', 'country_code'],
  flatCols: [
    'address_label',
    'address_line_1',
    'address_line_2',
    'address_line_3',
    'address_city',
    'address_state_province',
    'address_postal_code',
    'address_country_code',
  ],
  slotKeyCols: ['label'],
  slotKeyLabel: 'label',
  compareCols: ['address_line_1', 'address_line_2', 'address_line_3', 'city', 'state_province', 'postal_code', 'country_code'],
  crossSourceUniqCols: null,
};

/** @type {FlatChildDescriptor} */
export const FLAT_CHILD_TAX_IDS = {
  key: 'taxIds',
  modelName: 'taxIdentifiers',
  test: (r) => !!r.tax_value,
  extract: (r) => ({ country_code: r.tax_country_code, tax_type: r.tax_type, tax_value: r.tax_value }),
  cols: ['country_code', 'tax_type', 'tax_value'],
  flatCols: ['tax_country_code', 'tax_type', 'tax_value'],
  slotKeyCols: ['country_code', 'tax_type'],
  slotKeyLabel: 'country_code+tax_type',
  compareCols: ['tax_value'],
  crossSourceUniqCols: ['country_code', 'tax_type', 'tax_value'],
  crossSourceUniqLabel: 'tax identifier',
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
 * @param {Object}   [options]
 * @param {boolean}  [options.previewOnly=false] Skip write transaction; return a counts-only preview.
 * @returns {Promise<{inserted: number, updated: number, appUserSkipped: number} | {preview: true, inserts: number, updates: number, noops: number, omitted: number, errors: Array} | {errors: Array}>}
 */
export async function importFlatSourceEntity(model, reader, callbackFn, config, options = {}) {
  const previewOnly = options.previewOnly === true;
  const { db, pgp } = await getDb();
  const schema = model._schema.dbSchema;
  const s = pgp.as.name(schema);
  const tbl = pgp.as.name(model._schema.table);

  // Resolve tenant_id
  let tenantId;
  const sampleRow = callbackFn ? await callbackFn({}) : {};
  if (sampleRow.tenant_code) {
    const tenantRec = await db.oneOrNone('SELECT id FROM admin.tenants WHERE tenant_code = $1 AND deactivated_at IS NULL', [
      sampleRow.tenant_code.toUpperCase(),
    ]);
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
    pushIssue(errors, {
      sheet: sheetName,
      row: c.row,
      column: c.column,
      value: c.value,
      message: `Conflicts with row ${c.existingRow} which has "${c.existingValue}"`,
    });
  }

  const hasEmails = config.flat.children.some((c) => c.key === 'emails');

  // Validate emails
  if (hasEmails) {
    for (const group of groups) {
      for (const child of group.children.emails || []) {
        if (child.email && !EMAIL_RE.test(child.email)) {
          pushIssue(errors, { sheet: sheetName, row: child._rowNum || null, column: 'email', value: child.email, message: 'Invalid email format' });
        }
      }
    }
  }

  // Validate child enum fields (e.g. phone_type)
  const childEnums = [];
  for (const cfg of config.flat.children) {
    const childModel = db(cfg.modelName, schema);
    const enumMap = getEnumColumns(childModel._schema);
    if (!enumMap.size) continue;
    const flatColByCol = new Map();
    if (cfg.cols && cfg.flatCols) {
      cfg.cols.forEach((col, i) => flatColByCol.set(col, cfg.flatCols[i]));
    }
    childEnums.push({ key: cfg.key, enumMap, flatColByCol });
  }
  for (const e of validateChildEnums(groups, { sheetName, childEnums })) pushIssue(errors, e);

  // Cross-tenant portal_user collision check moved to after _resolveOwnEntities
  // (below) so it can include update-case collisions and exclude self.

  // Validate no duplicate codes
  const codeCounts = new Map();
  for (const group of groups) {
    const code = typeof group.parent.code === 'string' ? group.parent.code.trim() : '';
    if (code) {
      const prev = codeCounts.get(code);
      if (prev) {
        pushIssue(errors, {
          sheet: sheetName,
          row: group.parent._rowNum || null,
          column: 'code',
          value: code,
          message: `Duplicate code — also appears on row ${prev}`,
        });
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
        pushIssue(errors, {
          sheet: sheetName,
          row: group.parent._rowNum || null,
          column: field,
          value: group.parent[field] ?? '',
          message: `${field.replace(/_/g, ' ')} is required`,
        });
      }
    }
    const status = String(group.parent.status ?? '')
      .toLowerCase()
      .trim();
    if (!VALID_STATUSES.has(status)) {
      pushIssue(errors, {
        sheet: sheetName,
        row: group.parent._rowNum || null,
        column: 'status',
        value: group.parent.status,
        message: 'Status must be "active" or "archived"',
      });
    }
    if (config.codeRequired) {
      const code = typeof group.parent.code === 'string' ? group.parent.code.trim() : '';
      if (!code) {
        pushIssue(errors, {
          sheet: sheetName,
          row: group.parent._rowNum || null,
          column: 'code',
          value: group.parent.code ?? '',
          message: 'Code is required',
        });
      }
    }
  }

  // Per-child slot-key validation + intra-file duplicate slot check (R2, R7)
  for (const group of groups) {
    for (const cfg of config.flat.children) {
      const rows = group.children[cfg.key] || [];
      if (!rows.length || !cfg.slotKeyCols) continue;
      const seen = new Map();
      for (const row of rows) {
        const slotKey = _computeSlotKey(row, cfg);
        if (slotKey == null) {
          pushIssue(errors, {
            sheet: sheetName,
            row: row._rowNum || null,
            column: cfg.slotKeyLabel || cfg.slotKeyCols.join('+'),
            value: '',
            message: `${cfg.slotKeyLabel || 'slot key'} is required for ${cfg.key} rows`,
          });
          continue;
        }
        const prev = seen.get(slotKey);
        if (prev) {
          pushIssue(errors, {
            sheet: sheetName,
            row: row._rowNum || null,
            column: cfg.slotKeyLabel || cfg.slotKeyCols.join('+'),
            value: slotKey,
            message: `Duplicate ${cfg.key} ${cfg.slotKeyLabel || 'slot'} "${slotKey}" — also appears on row ${prev}`,
          });
        } else {
          seen.set(slotKey, row._rowNum || '?');
        }
      }
    }
  }

  // Resolve full DB rows for existing parents. Used to (a) exclude self from
  // cross-source uniqueness checks and (b) diff parent values for NO-OP detection.
  const ownEntities = await _resolveOwnEntities(db, s, tbl, groups);
  for (const group of groups) {
    const row = _lookupOwnEntity(ownEntities, group.parent);
    if (!row) continue;

    // Mismatch guard: if id AND code both supplied and resolve to different
    // DB rows, that's a user error — refuse to silently pick one.
    if (isUuid(group.parent.id) && typeof group.parent.code === 'string' && group.parent.code.trim()) {
      const byId = ownEntities.get(group.parent.id) || null;
      const byCode = ownEntities.get(`code:${group.parent.code.trim()}`) || null;
      if (byId && byCode && byId.id !== byCode.id) {
        pushIssue(errors, {
          sheet: sheetName,
          row: group.parent._rowNum || null,
          column: 'id+code',
          value: `${group.parent.id}|${group.parent.code}`,
          message: `Row has id and code that refer to different ${config.entityLabel || 'records'}`,
        });
        continue;
      }
    }

    // Round-trip an id-less import row by stamping the resolved id so the
    // writer's update branch ($1=parent.id) finds the right row.
    group.parent.id = row.id;
    group._ownEntity = row;
    group._ownSourceId = row.source_id;
  }

  // Transform each parent once (matches the write path's coerce/strip pipeline)
  // so the classifier and writer share the same canonical incoming values.
  const STRIP_COLS = ['status', 'deactivated_at', 'password'];
  for (const group of groups) {
    group._transformedParent = await _transformParent(group, callbackFn, tenantId, config, STRIP_COLS);
  }

  // Login-email pre-checks: load existing email rows for any updating source.
  // Used by L2 (can't unset is_login while app user) and L4 (final state can
  // have at most one is_login=true row per source).
  const emailsCfg = config.flat.children.find((c) => c.key === 'emails');
  if (emailsCfg) {
    const sourceIdsForCheck = groups.map((g) => g._ownSourceId).filter(Boolean);
    const existingEmailsBySource = await _loadEmailsBySource(db, s, pgp, schema, emailsCfg, sourceIdsForCheck);

    for (const group of groups) {
      const incoming = group.children.emails || [];
      if (!incoming.length && !group._ownEntity) continue;
      const existingRows = group._ownSourceId ? existingEmailsBySource.get(group._ownSourceId) || [] : [];
      const existingBySlot = new Map();
      for (const ex of existingRows) {
        const k = _computeSlotKey(ex, emailsCfg);
        if (k != null) existingBySlot.set(k, ex);
      }

      // L2: incoming is_login: false on a row whose existing was is_login: true
      // AND the entity remains an app user post-import → blocking error.
      const postImportIsAppUser =
        group._transformedParent && 'is_app_user' in group._transformedParent
          ? !!group._transformedParent.is_app_user
          : !!group._ownEntity?.is_app_user;

      for (const child of incoming) {
        const slot = _computeSlotKey(child, emailsCfg);
        if (slot == null) continue;
        const existing = existingBySlot.get(slot);
        if (!existing || existing.is_login !== true) continue;
        const incomingLogin = _truthyFlag(child.is_login);
        if (incomingLogin) continue; // not unsetting
        if (postImportIsAppUser) {
          pushIssue(errors, {
            sheet: sheetName,
            row: child._rowNum || null,
            column: 'is_login',
            value: 'false',
            message: 'Cannot remove the login flag while the entity is an active app user. Disable app access first.',
          });
        }
      }

      // L4: count final is_login: true rows per source after the file is applied.
      // Start from existing rows, then apply incoming overrides (by slot) and inserts.
      const finalLogin = new Map(); // slot → boolean
      for (const ex of existingRows) {
        const k = _computeSlotKey(ex, emailsCfg);
        if (k != null) finalLogin.set(k, ex.is_login === true);
      }
      for (const child of incoming) {
        const slot = _computeSlotKey(child, emailsCfg);
        if (slot == null) continue;
        finalLogin.set(slot, _truthyFlag(child.is_login));
      }
      const loginSlots = [...finalLogin.entries()].filter(([, v]) => v === true).map(([k]) => k);
      if (loginSlots.length > 1) {
        // Find the incoming row(s) that contributed to the over-count for row-keyed errors.
        const incomingLoginRows = incoming.filter((c) => _truthyFlag(c.is_login));
        const target = incomingLoginRows[incomingLoginRows.length - 1] || incomingLoginRows[0];
        pushIssue(errors, {
          sheet: sheetName,
          row: target?._rowNum || null,
          column: 'is_login',
          value: 'true',
          message: `Only one login email is allowed per entity. ${loginSlots.length} rows would end up with is_login = true (slots: ${loginSlots.join(', ')}).`,
        });
      }
    }
  }

  // Required-field pre-validation with row context. PG's 23502 (not-null)
  // would catch missing text fields too, but inside a bulkInsert PG can't
  // tell us which row in the batch failed — the user sees a generic
  // "required field cannot be empty" with no row number. Catch it up front
  // by walking the model's notNull columns that have no default.
  const requiredCols = (model._schema?.columns || [])
    .filter((c) => c.notNull && c.default == null && !c.immutable)
    .filter((c) => c.type !== 'boolean' && c.type !== 'uuid')
    .filter((c) => !['created_at', 'updated_at', 'deactivated_at'].includes(c.name))
    .map((c) => c.name);
  if (requiredCols.length) {
    for (const group of groups) {
      // Only check INSERTs — for UPDATEs the column is preserved from the DB row.
      if (group._ownEntity) continue;
      for (const col of requiredCols) {
        const v = group.parent[col];
        if (v == null || (typeof v === 'string' && v.trim() === '')) {
          pushIssue(errors, {
            sheet: sheetName,
            row: group.parent._rowNum || null,
            column: col,
            value: '',
            message: `${col.replace(/_/g, ' ')} is required`,
          });
        }
      }
    }
  }

  // Role validation. Empty roles[] OR unknown role codes are blocking errors
  // for every employee/client parent — not just app users — so a roleless
  // record cannot be created via import regardless of is_app_user state.
  if (config.appUserProvisioning && config.hasRoles) {
    // `roles` is softDelete: false — query all rows, no deactivated_at filter.
    const validRows = await db.any(`SELECT code FROM ${s}.roles`);
    const validCodes = new Set(validRows.map((r) => String(r.code).toLowerCase()));
    for (const group of groups) {
      const incoming = group._transformedParent || {};
      const existing = group._ownEntity || null;

      const finalRoles = incoming.roles !== undefined ? incoming.roles : existing?.roles;
      const arr = Array.isArray(finalRoles)
        ? finalRoles.map((r) => (r == null ? '' : String(r).trim())).filter((r) => r !== '')
        : [];

      if (!arr.length) {
        pushIssue(errors, {
          sheet: sheetName,
          row: group.parent._rowNum || null,
          column: 'roles',
          value: '',
          message: 'At least one role must be assigned',
        });
        continue;
      }
      const invalid = arr.filter((r) => !validCodes.has(r.toLowerCase()));
      if (invalid.length) {
        pushIssue(errors, {
          sheet: sheetName,
          row: group.parent._rowNum || null,
          column: 'roles',
          value: invalid.join(','),
          message: `Unknown role code${invalid.length > 1 ? 's' : ''}: ${invalid.join(', ')}`,
        });
      }
    }
  }

  // Password vs is_app_user consistency. A `password` cell is only meaningful
  // when the row ends up an app user — supplying one while the final state is
  // is_app_user=false (either explicitly or by demoting an existing app user)
  // is contradictory and would silently drop the password. Block it.
  if (config.appUserProvisioning) {
    for (const group of groups) {
      const supplied = group.parent.password && String(group.parent.password).trim();
      if (!supplied) continue;
      const incoming = group._transformedParent || {};
      const existing = group._ownEntity || null;
      const willBeAppUser = 'is_app_user' in incoming
        ? !!incoming.is_app_user
        : !!existing?.is_app_user;
      if (!willBeAppUser) {
        pushIssue(errors, {
          sheet: sheetName,
          row: group.parent._rowNum || null,
          column: 'password',
          value: '***',
          message:
            'A password cannot be supplied while is_app_user is false. Set is_app_user to true to enable app access, or clear the password column.',
        });
      }
    }
  }

  // is_app_user=true on an INSERT row requires an explicit login email. The
  // writer used to silently fall back to the primary (or any active) email
  // when no row was marked is_login=true; that was a footgun. Block it here
  // so the user has to declare intent in the spreadsheet.
  if (config.appUserProvisioning) {
    for (const group of groups) {
      if (group._ownEntity) continue;                  // INSERT only
      const incoming = group._transformedParent || {};
      if (!incoming.is_app_user) continue;
      const emails = group.children?.emails || [];
      const hasLogin = emails.some((e) => _truthyFlag(e.is_login) && e.email && String(e.email).trim());
      if (!hasLogin) {
        pushIssue(errors, {
          sheet: sheetName,
          row: group.parent._rowNum || null,
          column: 'email_is_login',
          value: '',
          message: 'A login email is required to enable app user access. Mark one email row with is_login = true.',
        });
      }
    }
  }

  // Provisioning a new portal_user requires a password. Without one the writer
  // would generate a random hash nobody can sign in with (silent footgun). Block
  // when:
  //   - INSERT + is_app_user=true + password blank, OR
  //   - UPDATE toggling is_app_user false→true with no archived prior binding
  //     to restore, + password blank.
  if (config.appUserProvisioning) {
    const entityType = config.appUserProvisioning.entityType;
    // Build the set of entity_ids whose prior binding exists (archived OR
    // active) — those entities can restore without a password.
    const toggleOnIds = [];
    for (const group of groups) {
      if (!group._ownEntity) continue;
      const incoming = group._transformedParent || {};
      const willBeAppUser = 'is_app_user' in incoming ? !!incoming.is_app_user : !!group._ownEntity.is_app_user;
      if (willBeAppUser && !group._ownEntity.is_app_user) toggleOnIds.push(group._ownEntity.id);
    }
    let restorableSet = new Set();
    if (toggleOnIds.length && tenantId) {
      const rows = await db.manyOrNone(
        `SELECT entity_id FROM admin.portal_user_tenants
         WHERE entity_type = $1 AND tenant_id = $2 AND entity_id IN ($3:csv)`,
        [entityType, tenantId, toggleOnIds],
      );
      restorableSet = new Set((rows || []).map((r) => r.entity_id));
    }

    for (const group of groups) {
      const incoming = group._transformedParent || {};
      const existing = group._ownEntity || null;
      const willBeAppUser = 'is_app_user' in incoming ? !!incoming.is_app_user : !!existing?.is_app_user;
      if (!willBeAppUser) continue;

      const passwordSupplied = !!(group.parent.password && String(group.parent.password).trim());
      if (passwordSupplied) continue;

      // INSERT path → always require a password.
      if (!existing) {
        pushIssue(errors, {
          sheet: sheetName,
          row: group.parent._rowNum || null,
          column: 'password',
          value: '',
          message: 'A password is required to provision a new app user.',
        });
        continue;
      }

      // UPDATE path: only require a password when toggling on with no prior
      // binding (no portal_user to restore). Already-active app users and
      // archived-binding restores are both fine with a blank cell.
      const wasAppUser = !!existing.is_app_user;
      if (!wasAppUser && !restorableSet.has(existing.id)) {
        pushIssue(errors, {
          sheet: sheetName,
          row: group.parent._rowNum || null,
          column: 'password',
          value: '',
          message: 'A password is required to enable app user access.',
        });
      }
    }
  }

  // Cross-tenant portal_user collision check (insert + update cases). Runs
  // after _resolveOwnEntities so it can exclude the entity's own portal_user.
  const provisionEntityType = config.appUserProvisioning?.entityType;
  if (provisionEntityType === 'employee' || provisionEntityType === 'client') {
    for (const e of await checkPortalUserEmailCollisions(groups, {
      sheetName,
      entityType: provisionEntityType,
      ownEntities,
      tenantId,
    })) {
      pushIssue(errors, e);
    }
  }

  // Cross-source value collision pre-check (R8). Runs against db (not in tx yet).
  await _collectCrossSourceConflicts(db, s, pgp, schema, config.sourceType, groups, config.flat.children, sheetName, errors);

  if (errors.length) {
    return previewOnly
      ? { preview: true, inserts: 0, updates: 0, noops: 0, omitted: 0, errors }
      : { errors };
  }

  // Preview short-circuit (R10). Classify what *would* happen without writing.
  if (previewOnly) {
    const counts = await _classifyForPreview(db, s, pgp, schema, groups, config, ownEntities);
    return { preview: true, ...counts, errors: [] };
  }

  let insertedCount = 0;
  let updatedCount = 0;
  let appUserSkipped = 0;

  try {
    await db.tx(async (t) => {
      model.tx = t;

      // ── Phase 1: Partition into updates vs inserts ──────────────────────
      // Parents have already been transformed and diffed in pre-validation;
      // group._transformedParent and group._ownEntity carry the canonical values.
      const toUpdate = [];
      const toInsert = [];

      for (const group of groups) {
        const isArchived = String(group.parent.status).toLowerCase() === 'archived';
        const password = group.parent.password || null;
        if (group._ownEntity) {
          toUpdate.push({ transformed: group._transformedParent, isArchived, group });
        } else {
          toInsert.push({ transformed: group._transformedParent, isArchived, group, ref: group.parent.id || null, password });
        }
      }

      // ── Phase 2: Run updates ───────────────────────────────────────────
      const userId = sampleRow.created_by || null;
      // Resolve numbering state once for the update phase too (same rule as
      // inserts: when numbering is on, the sequence is authoritative).
      let updateNumberingEnabled = false;
      if (config.idType) {
        const cfg = await t.oneOrNone(
          `SELECT is_enabled FROM ${s}.tenant_numbering_config WHERE id_type = $1`,
          [config.idType],
        );
        updateNumberingEnabled = !!cfg?.is_enabled;
      }
      for (const { transformed, isArchived, group } of toUpdate) {
        const { id } = transformed;
        const before = group._ownEntity;
        const wasArchived = !!before.deactivated_at;
        const wasAppUser = !!before.is_app_user;
        const willBeAppUser = 'is_app_user' in transformed ? !!transformed.is_app_user : wasAppUser;

        const changes = _diffParent(transformed, before);
        // Numbering on → ignore any code change attempted via the import.
        // Codes for existing rows are owned by the numbering allocator (set
        // once, never rewritten through the import path).
        if (updateNumberingEnabled && 'code' in changes) delete changes.code;
        // Archive/restore transition: `status` is stripped from the transformed
        // parent so it never appears in `changes`. Detect the flip explicitly
        // so the count + audit-field stamping fires even when no other column
        // changed (e.g. a re-import that only flips status active→archived).
        const archiveChanged = isArchived !== wasArchived;
        // Password rotation on an active app user has the same shape — the
        // password column is stripped from `changes` but the writer rotates
        // the portal_user's hash below. Count it as an update.
        const passwordSupplied =
          !!(group.parent.password && String(group.parent.password).trim());
        const passwordRotation = passwordSupplied && !isArchived && wasAppUser && willBeAppUser;
        if (Object.keys(changes).length > 0 || archiveChanged || passwordRotation) {
          // Stamp audit fields on every real write. We add them after the diff
          // so they don't themselves trigger NO-OP-failing updates. pg-schemata's
          // `updateWhere` does not auto-bump updated_at (unlike its singular
          // `update`), so we must set it explicitly here.
          if (userId) changes.updated_by = userId;
          changes.updated_at = new Date();
          await model.updateWhere([{ id }], changes, { includeDeactivated: true });
          updatedCount++;
        }
        // Archive/restore via deactivated_at is conditional in SQL — no churn
        // when the state already matches, so always safe to run.
        if (isArchived) {
          await t.none(`UPDATE ${s}.${tbl} SET deactivated_at = NOW() WHERE id = $1 AND deactivated_at IS NULL`, [
            id,
          ]);
        } else {
          await t.none(`UPDATE ${s}.${tbl} SET deactivated_at = NULL WHERE id = $1 AND deactivated_at IS NOT NULL`, [
            id,
          ]);
        }

        // If the entity has no code and the import didn't supply one, allocate
        // from the tenant's numbering config. Mirrors the INSERT-path behavior
        // so existing employees who predate the numbering rollout (or were
        // imported before numbering was enabled) get codes on re-import.
        // This is a real write — stamp audit fields and count it as an
        // update so the preview/response numbers reflect it.
        if (config.idType && !before.code && !transformed.code) {
          const numbering = await allocateNumber(schema, config.idType, null, new Date(), t);
          if (numbering) {
            await t.none(
              `UPDATE ${s}.${tbl} SET code = $1, updated_by = $2, updated_at = NOW() WHERE id = $3`,
              [numbering.displayId, userId, id],
            );
            // Don't double-count when the parent already had other changes
            // captured above; only increment when this is the only write.
            if (!(Object.keys(changes).length > 0 || archiveChanged || passwordRotation)) {
              updatedCount++;
            }
          }
        }

        // Reconcile children for this entity (slot-keyed, NO-OPs preserved)
        const sourceId = group._ownSourceId;
        if (sourceId) {
          await _reconcileFlatChildren(t, s, schema, db, pgp, sourceId, group.children, config.flat.children, callbackFn, tenantId);
        }

        // ── Login email portal_users sync (L1) ───────────────────────────
        // Find the live login email after reconcile and sync portal_users.
        if (sourceId && config.appUserProvisioning && willBeAppUser && !isArchived) {
          const loginRow = await t.oneOrNone(
            `SELECT email FROM ${s}.emails WHERE source_id = $1 AND is_login = true AND deactivated_at IS NULL LIMIT 1`,
            [sourceId],
          );
          if (loginRow?.email) {
            await syncLoginEmail(t, schema, sourceId, loginRow.email, { tenantId, userId });
          }
        }

        // ── Parent-state cascades to portal_users (L2b) ─────────────────
        if (config.appUserProvisioning) {
          const entityType = config.appUserProvisioning.entityType;

          // Active → archived: lock the portal_user
          if (!wasArchived && isArchived && wasAppUser) {
            await archiveAppUser(t, entityType, id, tenantId, userId);
          }

          // Archived → active: restore the portal_user (if it was app user)
          if (wasArchived && !isArchived && wasAppUser) {
            await restoreAppUserBinding(t, entityType, id, tenantId, userId);
          }

          // is_app_user true → false (not via archive — handled above): archive portal_user
          if (!isArchived && wasAppUser && !willBeAppUser) {
            await archiveAppUser(t, entityType, id, tenantId, userId);
          }

          // is_app_user false → true: provision or restore portal_user.
          // Honor the spreadsheet password for both branches:
          //   - provision (no prior binding): pass clear password through;
          //     enableAppUser → provisionAppUser bcrypts it.
          //   - restore (archived prior binding): enableAppUser only honors a
          //     pre-computed hash. Bcrypt up front and hand it through as
          //     `preHash` so the supplied password actually takes effect.
          if (!isArchived && !wasAppUser && willBeAppUser) {
            const loginRow = await t.oneOrNone(
              `SELECT email FROM ${s}.emails WHERE source_id = $1 AND is_login = true AND deactivated_at IS NULL LIMIT 1`,
              [sourceId],
            );
            if (loginRow?.email) {
              const suppliedPassword = group.parent.password && String(group.parent.password).trim()
                ? String(group.parent.password)
                : null;
              const password = suppliedPassword || (await import('node:crypto')).randomBytes(12).toString('base64url');
              let preHash;
              if (suppliedPassword) {
                const bcrypt = (await import('bcrypt')).default;
                const rounds = Number(process.env.BCRYPT_ROUNDS || 12);
                preHash = await bcrypt.hash(suppliedPassword, rounds);
              }
              await enableAppUser(t, entityType, id, loginRow.email, password, tenantId, userId, { preHash });
            }
          }

          // Already-app-user + password supplied in spreadsheet: reset the
          // portal_user's password_hash. Lets admins rotate a password through
          // the import path without going to the auth UI.
          if (!isArchived && wasAppUser && willBeAppUser) {
            const suppliedPassword = group.parent.password && String(group.parent.password).trim()
              ? String(group.parent.password)
              : null;
            if (suppliedPassword) {
              const bcrypt = (await import('bcrypt')).default;
              const rounds = Number(process.env.BCRYPT_ROUNDS || 12);
              const passwordHash = await bcrypt.hash(suppliedPassword, rounds);
              await t.none(
                `UPDATE admin.portal_users pu
                 SET password_hash = $1, updated_by = $2, updated_at = NOW()
                 FROM admin.portal_user_tenants b
                 WHERE pu.id = b.portal_user_id
                   AND b.entity_type = $3 AND b.entity_id = $4 AND b.tenant_id = $5
                   AND b.deactivated_at IS NULL AND pu.deactivated_at IS NULL`,
                [passwordHash, userId, entityType, id, tenantId],
              );
            }
          }
        }
      }

      // Determine whether tenant numbering is enabled for this entity type.
      // When it is, the configured sequence is authoritative for bulk imports:
      // any code typed into the spreadsheet is discarded and replaced with
      // the next number from the allocator.
      let numberingEnabled = false;
      if (config.idType) {
        const cfg = await t.oneOrNone(
          `SELECT is_enabled FROM ${s}.tenant_numbering_config WHERE id_type = $1`,
          [config.idType],
        );
        numberingEnabled = !!cfg?.is_enabled;
      }

      // ── Phase 3: Run inserts ───────────────────────────────────────────
      if (toInsert.length) {
        const cleanInserts = toInsert.map(({ transformed }) => {
          const { id: _id, ...clean } = transformed;
          if (typeof clean.code === 'string' && !clean.code.trim()) clean.code = null;
          // Numbering on → strip supplied codes so the allocator can fill them in.
          if (numberingEnabled) clean.code = null;
          return clean;
        });

        // Clear codes that already exist in the DB (only relevant when the
        // spreadsheet's codes survived the numbering-enabled strip above).
        if (!config.codeRequired) {
          const insertCodes = cleanInserts.map((r) => r.code).filter(Boolean);
          if (insertCodes.length) {
            const existingCodes = await t.any(`SELECT code FROM ${s}.${tbl} WHERE code IN ($1:csv)`, [insertCodes]);
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
          updated_by: createdBy,
        }));
        const sourceResults = await sourcesModel.bulkInsert(sourceRecords, ['id', 'table_id']);
        const sourceByParentId = new Map(sourceResults.map((sr) => [sr.table_id, sr.id]));

        for (let i = 0; i < insertResults.length; i++) {
          const rec = insertResults[i];
          const sourceId = sourceByParentId.get(rec.id);
          if (sourceId) {
            await t.none(`UPDATE ${s}.${tbl} SET source_id = $1 WHERE id = $2`, [sourceId, rec.id]);
          }
          if (!cleanInserts[i].code && config.idType) {
            const numbering = await allocateNumber(schema, config.idType, null, new Date(), t);
            if (numbering) {
              await t.none(`UPDATE ${s}.${tbl} SET code = $1 WHERE id = $2`, [numbering.displayId, rec.id]);
            }
          }

          if (toInsert[i].isArchived) {
            await t.none(`UPDATE ${s}.${tbl} SET deactivated_at = NOW() WHERE id = $1`, [rec.id]);
          }

          // Insert children for new entity
          if (sourceId) {
            await _reconcileFlatChildren(t, s, schema, db, pgp, sourceId, toInsert[i].group.children, config.flat.children, callbackFn, tenantId);
          }
        }

        // Provision portal_users for app-user entities after emails are inserted
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
              await t.none(`UPDATE ${s}.${tbl} SET is_app_user = false WHERE id = $1`, [rec.id]);
              appUserSkipped++;
              continue;
            }

            const clearPassword = toInsert[i].password || crypto.randomBytes(12).toString('base64url');
            const created = await provisionAppUser(
              rec.id,
              loginEmail.email,
              clearPassword,
              tid,
              createdBy,
              config.appUserProvisioning.entityType,
              t,
            );
            if (!created) {
              await t.none(`UPDATE ${s}.${tbl} SET is_app_user = false WHERE id = $1`, [rec.id]);
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
 * Classify what a real import would do, without writing. Returns aggregate
 * counts for the preview step (R10): inserts, updates, no-ops, and omitted
 * existing rows.
 *
 *   - inserts:  parent inserts + child rows that would be INSERTed
 *   - updates:  parent updates + child rows that would be UPDATEd in place
 *   - noops:    child rows where the slot exists and values match
 *   - omitted:  existing active child rows whose slot is not in the file
 *
 * @private
 */
async function _classifyForPreview(db, s, pgp, schema, groups, config, ownEntities) {
  let inserts = 0;
  let updates = 0;
  let noops = 0;
  let omitted = 0;

  // Parent-level classification: existing parents diff against their DB row;
  // unchanged parents count as NO-OPs, not updates.
  for (const group of groups) {
    const existing = isUuid(group.parent.id) ? ownEntities.get(group.parent.id) : null;
    if (!existing) {
      inserts += 1;
      continue;
    }
    const changes = _diffParent(group._transformedParent, existing);
    // Archive/restore transition: `status` is stripped from _transformedParent
    // (it's a synthetic spreadsheet column) so _diffParent can't see it. Detect
    // the state change explicitly so the preview counts it as an update.
    const willBeArchived = String(group.parent.status || '').toLowerCase() === 'archived';
    const wasArchived = !!existing.deactivated_at;
    const archiveChanged = willBeArchived !== wasArchived;
    // Password rotation: `password` is stripped from _transformedParent. The
    // writer rotates the portal_user's password_hash for an active app user
    // when this cell is non-blank — count that as an update too.
    const passwordSupplied =
      !!(group.parent.password && String(group.parent.password).trim());
    const willBeAppUser =
      'is_app_user' in (group._transformedParent || {})
        ? !!group._transformedParent.is_app_user
        : !!existing.is_app_user;
    const passwordRotation = passwordSupplied && !willBeArchived && existing.is_app_user && willBeAppUser;
    if (Object.keys(changes).length > 0 || archiveChanged || passwordRotation) updates += 1;
    else noops += 1;
  }

  // Per-child classification for groups that map to an existing source
  for (const cfg of config.flat.children) {
    const groupsWithChildren = groups.filter((g) => (g.children[cfg.key] || []).length > 0);
    if (!groupsWithChildren.length) continue;

    const existingSourceIds = groupsWithChildren
      .map((g) => g._ownSourceId)
      .filter((sid) => !!sid);

    // Load existing children for known sources in one query
    const existingBySource = new Map();
    if (existingSourceIds.length) {
      const childModel = db(cfg.modelName, schema);
      const tableName = childModel._schema?.table || cfg.modelName;
      const tName = pgp.as.name(tableName);
      const rows = await db.any(
        `SELECT * FROM ${s}.${tName} WHERE source_id IN ($1:csv) AND deactivated_at IS NULL`,
        [existingSourceIds],
      );
      for (const r of rows) {
        if (!existingBySource.has(r.source_id)) existingBySource.set(r.source_id, []);
        existingBySource.get(r.source_id).push(r);
      }
    }

    for (const group of groupsWithChildren) {
      const incoming = group.children[cfg.key] || [];
      const ownSource = group._ownSourceId;
      const existing = ownSource ? (existingBySource.get(ownSource) || []) : [];
      const existingBySlot = new Map();
      const existingByValue = new Map();
      for (const ex of existing) {
        const k = _computeSlotKey(ex, cfg);
        if (k != null) existingBySlot.set(k, ex);
        const vk = _computeValueKey(ex, cfg);
        if (vk != null) existingByValue.set(vk, ex);
      }
      const claimedExistingIds = new Set();
      const seenIncomingSlots = new Set();

      for (const row of incoming) {
        const slot = _computeSlotKey(row, cfg);
        if (slot != null) seenIncomingSlots.add(slot);
        let match = slot != null ? existingBySlot.get(slot) : null;
        if (!match) {
          const vk = _computeValueKey(row, cfg);
          if (vk != null) {
            const candidate = existingByValue.get(vk);
            if (candidate && !claimedExistingIds.has(candidate.id)) match = candidate;
          }
        }
        if (!match) {
          inserts += 1;
          continue;
        }
        claimedExistingIds.add(match.id);
        // Include slot key cols in the diff so a rename counts as UPDATE.
        const diffCols = new Set([...(cfg.compareCols || []), ...(cfg.slotKeyCols || [])]);
        let changed = false;
        for (const col of diffCols) {
          if (!_normEq(match[col], row[col])) {
            changed = true;
            break;
          }
        }
        if (changed) updates += 1;
        else noops += 1;
      }

      // Omitted: existing rows whose slot wasn't named AND whose row id wasn't
      // claimed by a value-key rename match.
      for (const ex of existing) {
        const slot = _computeSlotKey(ex, cfg);
        if (slot != null && seenIncomingSlots.has(slot)) continue;
        if (claimedExistingIds.has(ex.id)) continue;
        omitted += 1;
      }
    }
  }

  return { inserts, updates, noops, omitted };
}

/**
 * Coerce a spreadsheet boolean-ish cell value to a JS true/false. Accepts
 * native booleans, the strings 'true' / 'false' (any case), and 1/0.
 * @private
 */
function _truthyFlag(v) {
  return v === true || v === 1 || (typeof v === 'string' && v.toLowerCase() === 'true');
}

/**
 * Batch-load active email rows for the given source_ids and group them by
 * source_id. Used by the email-specific pre-validation block.
 * @private
 */
async function _loadEmailsBySource(db, s, pgp, schema, cfg, sourceIds) {
  const out = new Map();
  if (!sourceIds.length) return out;
  const childModel = db(cfg.modelName, schema);
  const tableName = childModel._schema?.table || cfg.modelName;
  const tName = pgp.as.name(tableName);
  const rows = await db.any(
    `SELECT * FROM ${s}.${tName} WHERE source_id IN ($1:csv) AND deactivated_at IS NULL`,
    [sourceIds],
  );
  for (const r of rows) {
    if (!out.has(r.source_id)) out.set(r.source_id, []);
    out.get(r.source_id).push(r);
  }
  return out;
}

/**
 * Compute the value key for a child row — based on the descriptor's
 * crossSourceUniqCols, gated by an optional crossSourceUniqWhere predicate.
 * Used by the reconciler to detect slot renames: when an incoming row's slot
 * key doesn't match any existing slot but its value matches an existing row,
 * treat the row as a rename of that existing row (UPDATE in place, preserving
 * id and updating the slot label).
 *
 * Returns null when the descriptor has no value-uniqueness, when the row
 * doesn't satisfy crossSourceUniqWhere, or when any value-key component is blank.
 * @private
 */
function _computeValueKey(row, cfg) {
  if (!cfg.crossSourceUniqCols || !cfg.crossSourceUniqCols.length) return null;
  if (cfg.crossSourceUniqWhere && !cfg.crossSourceUniqWhere(row)) return null;
  const parts = cfg.crossSourceUniqCols.map((c) => {
    const v = row[c];
    return v == null ? '' : String(v).trim();
  });
  if (parts.some((v) => v === '')) return null;
  return parts.map((v) => v.toLowerCase()).join('|');
}

/**
 * Compute the slot key for a child row using the descriptor's slotKeyCols.
 * Returns a `|`-joined lowercased string, or null if any component is blank.
 * @private
 */
function _computeSlotKey(row, cfg) {
  if (!cfg.slotKeyCols || !cfg.slotKeyCols.length) return null;
  const parts = cfg.slotKeyCols.map((c) => {
    const v = row[c];
    return v == null ? '' : String(v).trim();
  });
  if (parts.some((v) => v === '')) return null;
  return parts.map((v) => v.toLowerCase()).join('|');
}

/**
 * Normalized equality for comparing existing DB values to incoming row values.
 * Treats null/undefined/empty-string as equal; case-insensitive for strings.
 * @private
 */
function _normEq(a, b) {
  const na = a == null ? '' : typeof a === 'string' ? a.trim() : a;
  const nb = b == null ? '' : typeof b === 'string' ? b.trim() : b;
  if (typeof na === 'string' && typeof nb === 'string') return na.toLowerCase() === nb.toLowerCase();
  return na === nb;
}

/**
 * Resolve existing parents (parent.id is a UUID present in the DB) to their
 * full current DB row. Returns Map<parentId, row> where row includes source_id
 * and every entity column — used both for cross-source self-exclusion and for
 * parent-level NO-OP detection on re-imports.
 * @private
 */
async function _resolveOwnEntities(db, s, tbl, groups) {
  // Match by `id` first (the round-trip path). For rows whose id is blank or
  // doesn't resolve in the DB (e.g. tenant was re-bootstrapped after export
  // and the id has rotated), fall back to matching by `code`. The resulting
  // map is keyed by both `id` and `code` so callers can look up either way.
  const map = new Map();

  const uuidIds = groups.filter((g) => isUuid(g.parent.id)).map((g) => g.parent.id);
  if (uuidIds.length) {
    const rows = await db.any(`SELECT * FROM ${s}.${tbl} WHERE id IN ($1:csv)`, [uuidIds]);
    for (const r of rows) {
      map.set(r.id, r);
      if (r.code) map.set(`code:${String(r.code).trim()}`, r);
    }
  }

  // Identify groups whose id didn't resolve but carry a code we can use.
  const fallbackCodes = [];
  for (const g of groups) {
    const idResolved = isUuid(g.parent.id) && map.has(g.parent.id);
    if (idResolved) continue;
    const code = typeof g.parent.code === 'string' ? g.parent.code.trim() : '';
    if (code && !map.has(`code:${code}`)) fallbackCodes.push(code);
  }
  if (fallbackCodes.length) {
    const rows = await db.any(
      `SELECT * FROM ${s}.${tbl} WHERE code IN ($1:csv) AND deactivated_at IS NULL`,
      [fallbackCodes],
    );
    for (const r of rows) {
      map.set(`code:${String(r.code).trim()}`, r);
      // Don't overwrite an existing id key (it was set by the id path above).
      if (!map.has(r.id)) map.set(r.id, r);
    }
  }
  return map;
}

/**
 * Look up the resolved DB row for a parent group using id first, then code.
 * @private
 */
function _lookupOwnEntity(ownEntities, parent) {
  if (parent && isUuid(parent.id) && ownEntities.has(parent.id)) {
    return ownEntities.get(parent.id);
  }
  const code = typeof parent?.code === 'string' ? parent.code.trim() : '';
  if (code && ownEntities.has(`code:${code}`)) return ownEntities.get(`code:${code}`);
  return null;
}

/**
 * Order-insensitive array equality, used for text[] columns like `roles`.
 * @private
 */
function _arrayEq(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  const sa = [...a].map(String).sort();
  const sb = [...b].map(String).sort();
  return sa.every((v, i) => v === sb[i]);
}

/**
 * Diff a transformed parent row against its current DB row. Returns an object
 * of changed columns (subset of transformed) or an empty object when nothing
 * differs.
 *
 * Skipped columns:
 *   - `id`, `tenant_id`            — never updated through this path
 *   - `created_at`, `created_by`   — set once at insert, must not be overwritten
 *   - `updated_at`, `updated_by`   — managed separately by the writer; including
 *     them in the diff would defeat NO-OP detection since the importing user
 *     normally differs from the prior `updated_by`.
 * @private
 */
function _diffParent(transformed, existing) {
  const SKIP = new Set(['id', 'tenant_id', 'created_at', 'created_by', 'updated_at', 'updated_by']);
  const changes = {};
  for (const [col, val] of Object.entries(transformed)) {
    if (SKIP.has(col)) continue;
    const cur = existing[col];
    if (Array.isArray(val) || Array.isArray(cur)) {
      if (!_arrayEq(val, cur)) changes[col] = val;
      continue;
    }
    if (!_normEq(val, cur)) changes[col] = val;
  }
  return changes;
}

/**
 * Coerce + transform a parent row exactly the way the write path does. Result
 * is the row that would be sent to model.updateWhere or model.bulkInsert.
 * @private
 */
async function _transformParent(group, callbackFn, tenantId, config, stripCols) {
  const { _rowNum: _rn, ...entityData } = { ...group.parent };
  for (const col of stripCols) delete entityData[col];
  const transformed = callbackFn ? await callbackFn({ ...entityData }) : { ...entityData };
  for (const col of stripCols) delete transformed[col];
  delete transformed.tenant_code;
  if (tenantId) transformed.tenant_id = tenantId;
  coerceRow(transformed, config.boolCols, config.hasRoles);
  if (typeof transformed.code === 'string' && !transformed.code.trim()) transformed.code = null;
  return transformed;
}

/**
 * Pre-flight cross-source uniqueness check (R8). For each child type with
 * `crossSourceUniqCols`, batch-query whether any incoming row's value already
 * exists on a different source's active row. Emit blocking validation issues
 * with type-only context ("already in use by another <sourceType>").
 * @private
 */
async function _collectCrossSourceConflicts(db, s, pgp, schema, ownSourceType, groups, childConfigs, sheetName, errors) {
  for (const cfg of childConfigs) {
    if (!cfg.crossSourceUniqCols || !cfg.crossSourceUniqCols.length) continue;

    const candidates = [];
    for (const group of groups) {
      const rows = group.children[cfg.key] || [];
      for (const row of rows) {
        if (cfg.crossSourceUniqWhere && !cfg.crossSourceUniqWhere(row)) continue;
        const values = cfg.crossSourceUniqCols.map((c) => row[c]);
        if (values.some((v) => v == null || String(v).trim() === '')) continue;
        candidates.push({
          row,
          ownSourceId: group._ownSourceId || null,
          values: values.map((v) => String(v).trim()),
        });
      }
    }
    if (!candidates.length) continue;

    const childModel = db(cfg.modelName, schema);
    const tableName = childModel._schema?.table || cfg.modelName;
    const tName = pgp.as.name(tableName);
    const tupleList = candidates
      .map((c) => `(${c.values.map((v) => pgp.as.text(v)).join(', ')})`)
      .join(', ');
    // Look up which (cols-tuple) values are present on OTHER active rows. Get the
    // source_type too so the error message can describe the owning entity type.
    let sql = `
      SELECT child.source_id, src.source_type, ${cfg.crossSourceUniqCols.map((c) => `child.${pgp.as.name(c)} AS ${pgp.as.name(c)}`).join(', ')}
      FROM ${s}.${tName} child
      JOIN ${s}.sources src ON src.id = child.source_id
      WHERE (${cfg.crossSourceUniqCols.map((c) => `child.${pgp.as.name(c)}`).join(', ')}) IN (${tupleList})
      AND child.deactivated_at IS NULL
    `;
    if (cfg.key === 'phones') sql += ` AND child.phone_type = 'cell'`;
    const matches = await db.any(sql);
    if (!matches.length) continue;

    const matchBy = new Map();
    for (const m of matches) {
      const key = cfg.crossSourceUniqCols.map((c) => String(m[c]).trim().toLowerCase()).join('|');
      if (!matchBy.has(key)) matchBy.set(key, []);
      matchBy.get(key).push({ sourceId: m.source_id, sourceType: m.source_type });
    }

    for (const cand of candidates) {
      const key = cand.values.map((v) => v.toLowerCase()).join('|');
      const hits = matchBy.get(key);
      if (!hits) continue;
      const other = hits.find((h) => h.sourceId !== cand.ownSourceId);
      if (!other) continue;
      const isSameType = other.sourceType === ownSourceType;
      const typeLabel = isSameType ? `another ${other.sourceType}` : `another record`;
      pushIssue(errors, {
        sheet: sheetName,
        row: cand.row._rowNum || null,
        column: cfg.crossSourceUniqCols.join('+'),
        value: cand.values.join('|'),
        message: `${cfg.crossSourceUniqLabel || cfg.key} "${cand.values.join('|')}" is already in use by ${typeLabel}`,
      });
    }
  }
}

/**
 * Reconcile children for one parent source_id by slot key (R3–R6).
 *   - Slot in incoming + slot in DB + values equal → NO-OP.
 *   - Slot in incoming + slot in DB + values differ → UPDATE in place; id preserved.
 *   - Slot in incoming + no matching slot in DB → INSERT.
 *   - Slot in DB + not in incoming → left alone. Never deleted by omission.
 * Slot-key validity has already been enforced upstream (R2), so any blank-slot
 * row is treated defensively as INSERT (the DB unique index would catch the
 * resulting collision if it mattered).
 * @private
 */
async function _reconcileFlatChildren(t, s, schema, db, pgp, sourceId, children, childConfigs, callbackFn, tenantId) {
  for (const cfg of childConfigs) {
    const childRows = children[cfg.key];
    if (!childRows || !childRows.length) continue;

    const childModel = db(cfg.modelName, schema);
    childModel.tx = t;
    const tableName = childModel._schema?.table || cfg.modelName;
    const tName = pgp.as.name(tableName);

    const existing = await t.any(`SELECT * FROM ${s}.${tName} WHERE source_id = $1 AND deactivated_at IS NULL`, [sourceId]);
    const existingBySlot = new Map();
    const existingByValue = new Map();
    for (const ex of existing) {
      const k = _computeSlotKey(ex, cfg);
      if (k != null) existingBySlot.set(k, ex);
      const vk = _computeValueKey(ex, cfg);
      if (vk != null) existingByValue.set(vk, ex);
    }

    const toInsert = [];
    const toUpdate = []; // [{ id, changes }]
    const claimedExistingIds = new Set();

    for (const row of childRows) {
      const { _rowNum: _, ...rest } = row;
      const base = { ...rest, source_id: sourceId };
      const transformed = callbackFn ? await callbackFn(base) : base;
      delete transformed.tenant_code;
      if (tenantId) transformed.tenant_id = tenantId;
      coerceChildRow(transformed, childModel);
      for (const col of childModel._schema?.columns || []) {
        if (col.type === 'boolean' && col.notNull && transformed[col.name] == null) {
          transformed[col.name] = col.default ?? false;
        }
      }

      // Match priority: 1) slot key. 2) value key (catches slot rename when
      // the underlying value is unique-by-DB, e.g. an email's address or a
      // cell phone number — keeps the same row id and just updates the slot).
      const slot = _computeSlotKey(transformed, cfg);
      let match = slot != null ? existingBySlot.get(slot) : null;
      if (!match) {
        const vk = _computeValueKey(transformed, cfg);
        if (vk != null) {
          const candidate = existingByValue.get(vk);
          if (candidate && !claimedExistingIds.has(candidate.id)) match = candidate;
        }
      }

      if (!match) {
        toInsert.push(transformed);
        continue;
      }
      claimedExistingIds.add(match.id);

      // Diff against compareCols PLUS the slot key cols (so a slot rename
      // detected via value-match actually updates the label/phone_type).
      const diffCols = new Set([...(cfg.compareCols || []), ...(cfg.slotKeyCols || [])]);
      const changes = {};
      for (const col of diffCols) {
        if (_normEq(match[col], transformed[col])) continue;
        changes[col] = transformed[col];
      }
      if (Object.keys(changes).length === 0) continue; // NO-OP
      // Stamp audit fields on every real write. pg-schemata's `updateWhere`
      // does not auto-bump updated_at, so set both explicitly.
      if (transformed.updated_by) changes.updated_by = transformed.updated_by;
      changes.updated_at = new Date();
      toUpdate.push({ id: match.id, changes });
    }

    if (toInsert.length) {
      await childModel.bulkInsert(toInsert);
    }
    for (const u of toUpdate) {
      await childModel.updateWhere([{ id: u.id }], u.changes);
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
    const isContinuation =
      lastGroup &&
      parentCols.every((col) => {
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
        if (
          existing.some((c) => {
            const { _rowNum: __, ...v } = c;
            return JSON.stringify(v) === key;
          })
        )
          continue;
        if (row._rowNum != null) child._rowNum = row._rowNum;
        existing.push(child);
      }
    }
  }

  return { groups, conflicts };
}
