/**
 * @file Tenants model — extends TableModel with flat single-sheet export/import
 * @module auth/models/Tenants
 *
 * Export flattens each tenant's billing address and primary tax identifier into
 * a single row. Import supports update (rows with id), create (rows without id
 * trigger full provisioning via provisionNewTenant), and `previewOnly`
 * classification with full upfront validation:
 *   - per-row required-field / format / password-strength checks for inserts
 *   - intra-file duplicate detection (tenant_code, admin_email)
 *   - cross-table uniqueness checks (admin.tenants + admin.portal_users)
 *   - ROOT_TENANT archive protection
 *   - diff-as-DTO updates so round-trip re-imports are true noops
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import { writeFileSync, readFileSync } from 'node:fs';
import { TableModel } from 'pg-schemata';
import tenantsSchema from '../schemas/tenantsSchema.js';
import { parseSheet, isUuid, pushIssue } from '../../../lib/spreadsheetHelpers.js';
import { provisionNewTenant } from '../../../services/tenantSetup.js';

// ── Column layout for the flat "Tenants" sheet ──────────────────────────────

const HEADERS = [
  'id', 'tenant_code', 'company', 'status', 'tier', 'region', 'max_users', 'notes',
  'address_line_1', 'address_line_2', 'address_line_3', 'city', 'state_province', 'postal_code', 'country_code',
  'tax_country_code', 'tax_type', 'tax_value',
  'admin_first_name', 'admin_last_name', 'admin_email', 'admin_password', 'admin_phone',
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PW_RULES = [
  { test: (p) => p.length >= 8, msg: 'at least 8 characters' },
  { test: (p) => /[A-Z]/.test(p), msg: 'an uppercase letter' },
  { test: (p) => /[a-z]/.test(p), msg: 'a lowercase letter' },
  { test: (p) => /[0-9]/.test(p), msg: 'a digit' },
  { test: (p) => /[^A-Za-z0-9]/.test(p), msg: 'a special character' },
];

const VALID_STATUSES = new Set(['active', 'trial', 'suspended', 'pending']);

/** Null / undefined / empty-string conflation for change detection. */
function _eq(a, b) {
  const na = a == null || a === '' ? null : a;
  const nb = b == null || b === '' ? null : b;
  return na === nb;
}

function _validatePasswordStrength(pw) {
  return PW_RULES.filter((r) => !r.test(pw)).map((r) => r.msg);
}

// Postgres error codes: 3F000 = invalid_schema_name, 42P01 = undefined_table.
// Used to scope the diff-helper try/catch to "tenant schema not provisioned
// yet" cases — any other DB error must surface.
function _isSchemaMissing(err) {
  return err && (err.code === '3F000' || err.code === '42P01');
}

export default class Tenants extends TableModel {
  constructor(db, pgp, logger = null) {
    super(db, pgp, tenantsSchema, logger);
  }

  async getAllowedModulesById(tenantId) {
    const tenant = await this.findById(tenantId);
    if (!tenant) return null;
    return tenant.allowed_modules;
  }

  // ── Export ──────────────────────────────────────────────────────────────────

  /**
   * Export tenants to a flat single-sheet spreadsheet.
   * Cross-schema joins fetch billing address + primary tax identifier per tenant.
   */
  async exportToSpreadsheet(filePath, where = [], joinType = 'AND', options = {}) {
    const rootTenantCode = (process.env.ROOT_TENANT_CODE || 'AXERRA').toUpperCase();
    const allTenants = await this.findWhere(where, joinType, options);
    const tenants = allTenants.filter((t) => t.tenant_code?.toUpperCase() !== rootTenantCode);
    const { WorkbookBuilder, writeXlsx } = await import('@nap-sft/tablsx');
    const wb = WorkbookBuilder.create();
    const sheet = wb.sheet('Tenants');
    sheet.setHeaders(HEADERS);

    if (!tenants.length) {
      writeFileSync(filePath, writeXlsx(wb.build()));
      return { exported: 0, filePath };
    }

    // Fetch billing address + tax identifier per tenant in parallel
    const flatRows = await Promise.all(tenants.map(async (t) => {
      let addr = {};
      let tax = {};
      let admin = {};

      try {
        const sch = this.pgp.as.name(t.schema_name);
        const company = await this.db.oneOrNone(
          `SELECT source_id FROM ${sch}.companies WHERE code = $1 AND deactivated_at IS NULL LIMIT 1`,
          [t.tenant_code],
        );
        if (company?.source_id) {
          addr = await this.db.oneOrNone(
            `SELECT address_line_1, address_line_2, address_line_3, city, state_province, postal_code, country_code
             FROM ${sch}.addresses WHERE source_id = $1 AND label = 'billing' AND deactivated_at IS NULL
             ORDER BY created_at LIMIT 1`,
            [company.source_id],
          ) || {};
          tax = await this.db.oneOrNone(
            `SELECT country_code AS tax_country_code, tax_type, tax_value
             FROM ${sch}.tax_identifiers WHERE source_id = $1 AND deactivated_at IS NULL
             ORDER BY created_at LIMIT 1`,
            [company.source_id],
          ) || {};
        }

        // Primary contact employee + their login email + primary phone
        admin = await this.db.oneOrNone(
          `SELECT e.first_name, e.last_name, em.email, pn.phone_number
           FROM ${sch}.employees e
           JOIN ${sch}.sources s ON s.table_id = e.id AND s.source_type = 'employee' AND s.deactivated_at IS NULL
           LEFT JOIN LATERAL (
             SELECT em.email FROM ${sch}.emails em
             WHERE em.source_id = s.id AND em.is_login = true AND em.deactivated_at IS NULL
             ORDER BY em.is_primary DESC, em.created_at LIMIT 1
           ) em ON true
           LEFT JOIN LATERAL (
             SELECT pn.phone_number FROM ${sch}.phone_numbers pn
             WHERE pn.source_id = s.id AND pn.deactivated_at IS NULL
             ORDER BY pn.is_primary DESC, pn.created_at LIMIT 1
           ) pn ON true
           WHERE e.is_primary_contact = true AND e.deactivated_at IS NULL
           ORDER BY e.created_at LIMIT 1`,
        ) || {};
      } catch {
        /* schema may not exist yet (failed provision) — export what we have */
      }

      return {
        id: t.id,
        tenant_code: t.tenant_code,
        company: t.company,
        status: t.deactivated_at ? 'archived' : t.status,
        tier: t.tier,
        region: t.region || '',
        max_users: t.max_users,
        notes: t.notes || '',
        address_line_1: addr.address_line_1 || '',
        address_line_2: addr.address_line_2 || '',
        address_line_3: addr.address_line_3 || '',
        city: addr.city || '',
        state_province: addr.state_province || '',
        postal_code: addr.postal_code || '',
        country_code: addr.country_code || '',
        tax_country_code: tax.tax_country_code || '',
        tax_type: tax.tax_type || '',
        tax_value: tax.tax_value || '',
        admin_first_name: admin.first_name || '',
        admin_last_name: admin.last_name || '',
        admin_email: admin.email || '',
        admin_password: '',
        admin_phone: admin.phone_number || '',
      };
    }));

    sheet.addObjects(flatRows);
    writeFileSync(filePath, writeXlsx(wb.build()));
    return { exported: flatRows.length, filePath };
  }

  // ── Import ─────────────────────────────────────────────────────────────────

  /**
   * Import tenants from a flat single-sheet spreadsheet.
   *
   * Rows with a valid UUID `id` → update tenant metadata + billing address + tax identifier + admin phone.
   * Rows without `id` → full provisioning (requires admin_* columns).
   *
   * Pass `{ previewOnly: true }` to receive a classification + validation payload
   * without any DB writes: `{ preview: true, inserts, updates, noops, omitted: 0, errors }`.
   */
  async importFromSpreadsheet(filePath, _sheetIndex = 0, callbackFn = null, _returning = null, { previewOnly = false } = {}) {
    const { WorkbookReader } = await import('@nap-sft/tablsx');
    const buffer = readFileSync(filePath);
    const reader = WorkbookReader.fromBuffer(buffer);
    const sheetName = reader.sheetNames?.[0] || 'Tenants';
    const rows = parseSheet(reader, 0);

    if (!rows.length) {
      return previewOnly
        ? { preview: true, inserts: 0, updates: 0, noops: 0, omitted: 0, errors: [] }
        : { inserted: 0, updated: 0 };
    }

    const actorId = callbackFn ? (await callbackFn({})).created_by || null : null;

    const { classified, errors } = await this._classifyAndValidateRows(rows, sheetName);

    let inserts = 0;
    let updates = 0;
    let noops = 0;
    for (const c of classified) {
      if (c.action === 'insert') inserts++;
      else if (c.action === 'update') updates++;
      else if (c.action === 'noop') noops++;
    }

    if (previewOnly) {
      return { preview: true, inserts, updates, noops, omitted: 0, errors };
    }

    // Errors are blocking — surface them before any provisioning writes.
    if (errors.length) return { errors };

    // Commit pass: per-row create or update. Errors here are surfaced per row
    // but earlier rows that succeeded remain provisioned (no cross-row tx —
    // pg schema creation is DDL that can't roll back cleanly).
    let inserted = 0;
    let updated = 0;
    const commitErrors = [];
    for (const c of classified) {
      if (c.action !== 'insert' && c.action !== 'update') continue;
      try {
        if (c.action === 'insert') {
          await this._createTenantRow(c.row, actorId);
          inserted++;
        } else {
          await this._updateTenantRow(c.row, actorId, c.existing, c.diffs);
          updated++;
        }
      } catch (err) {
        pushIssue(commitErrors, {
          sheet: sheetName,
          row: c.rowNum,
          column: null,
          value: c.row.tenant_code || '',
          message: err.message,
        });
      }
    }

    if (commitErrors.length) return { errors: commitErrors };
    return { inserted, updated };
  }

  // ── Phase 1: classify + validate ───────────────────────────────────────────

  /**
   * Per-row validation, intra-file duplicate detection, batched cross-table
   * uniqueness checks, and noop classification (with cross-schema diffs).
   * Pure read; no writes. Returns `{ classified, errors }`.
   */
  async _classifyAndValidateRows(rows, sheetName) {
    const rootTenantCode = (process.env.ROOT_TENANT_CODE || 'AXERRA').toUpperCase();
    const errors = [];

    // Intra-file dup tracking (case-insensitive).
    const seenTenantCodeAt = new Map();
    const seenEmailAt = new Map();

    // First pass: per-row validation + dup detection. Capture context so the
    // batched DB lookups + classification have everything they need.
    const candidates = [];
    for (const row of rows) {
      const rowNum = row._rowNum || null;
      const isInsert = !isUuid(row.id);
      const tcRaw = (row.tenant_code || '').toString().trim();
      const tcUpper = tcRaw.toUpperCase();
      const emailRaw = (row.admin_email || '').toString().trim().toLowerCase();

      // ROOT_TENANT archive protection (applies to insert AND update).
      const willArchive = String(row.status || '').toLowerCase().trim() === 'archived';
      if (willArchive && tcUpper === rootTenantCode) {
        pushIssue(errors, {
          sheet: sheetName, row: rowNum, column: 'tenant_code', value: tcRaw,
          message: `Cannot archive the root tenant '${rootTenantCode}'.`,
        });
      }

      // Intra-file dups (case-insensitive).
      if (tcUpper) {
        if (seenTenantCodeAt.has(tcUpper)) {
          pushIssue(errors, {
            sheet: sheetName, row: rowNum, column: 'tenant_code', value: tcRaw,
            message: `Duplicate tenant_code '${tcRaw}' in file (also at row ${seenTenantCodeAt.get(tcUpper)})`,
          });
        } else {
          seenTenantCodeAt.set(tcUpper, rowNum);
        }
      }
      if (emailRaw) {
        if (seenEmailAt.has(emailRaw)) {
          pushIssue(errors, {
            sheet: sheetName, row: rowNum, column: 'admin_email', value: row.admin_email,
            message: `Duplicate admin_email '${row.admin_email}' in file (also at row ${seenEmailAt.get(emailRaw)})`,
          });
        } else {
          seenEmailAt.set(emailRaw, rowNum);
        }
      }

      // Insert-specific validation.
      if (isInsert) {
        const required = [
          ['tenant_code', tcRaw],
          ['company', row.company],
          ['admin_first_name', row.admin_first_name],
          ['admin_last_name', row.admin_last_name],
          ['admin_email', row.admin_email],
          ['admin_password', row.admin_password],
          ['address_line_1', row.address_line_1],
          ['country_code', row.country_code],
        ];
        for (const [col, val] of required) {
          if (!val) {
            pushIssue(errors, {
              sheet: sheetName, row: rowNum, column: col, value: '',
              message: `${col} is required for new tenants`,
            });
          }
        }
        if (tcRaw && tcRaw.length > 6) {
          pushIssue(errors, {
            sheet: sheetName, row: rowNum, column: 'tenant_code', value: tcRaw,
            message: 'tenant_code must be 6 characters or fewer',
          });
        }
        if (row.admin_email && !EMAIL_RE.test(row.admin_email)) {
          pushIssue(errors, {
            sheet: sheetName, row: rowNum, column: 'admin_email', value: row.admin_email,
            message: 'admin_email is not a valid email address',
          });
        }
        if (row.admin_password) {
          const failures = _validatePasswordStrength(String(row.admin_password));
          if (failures.length) {
            pushIssue(errors, {
              sheet: sheetName, row: rowNum, column: 'admin_password', value: '',
              message: `admin_password must contain ${failures.join(', ')}`,
            });
          }
        }
      }

      candidates.push({ rowNum, row, isInsert, tcUpper, emailRaw });
    }

    // Batched cross-table uniqueness checks for inserts.
    const inserts = candidates.filter((c) => c.isInsert);
    if (inserts.length) {
      const tcs = [...new Set(inserts.map((c) => c.tcUpper).filter(Boolean))];
      const companies = [...new Set(inserts.map((c) => c.row.company).filter(Boolean))];
      const schemaNames = [...new Set(tcs.map((tc) => tc.toLowerCase()))];
      const emails = [...new Set(inserts.map((c) => c.emailRaw).filter(Boolean))];

      const existingTRows = (tcs.length || companies.length || schemaNames.length)
        ? await this.db.any(
            `SELECT tenant_code, company, schema_name FROM admin.tenants
             WHERE UPPER(tenant_code) = ANY($1::text[])
                OR company = ANY($2::text[])
                OR schema_name = ANY($3::text[])`,
            [tcs, companies, schemaNames],
          )
        : [];
      const existingTcSet = new Set(existingTRows.map((r) => r.tenant_code.toUpperCase()));
      const existingCoSet = new Set(existingTRows.map((r) => r.company));
      const existingSnSet = new Set(existingTRows.map((r) => r.schema_name));

      const existingEmailRows = emails.length
        ? await this.db.any(
            `SELECT email FROM admin.portal_users WHERE LOWER(email) = ANY($1::text[])`,
            [emails],
          )
        : [];
      const existingEmailSet = new Set(existingEmailRows.map((r) => r.email.toLowerCase()));

      for (const c of inserts) {
        if (c.tcUpper && existingTcSet.has(c.tcUpper)) {
          pushIssue(errors, {
            sheet: sheetName, row: c.rowNum, column: 'tenant_code', value: c.row.tenant_code,
            message: `tenant_code '${c.row.tenant_code}' already exists`,
          });
        }
        if (c.row.company && existingCoSet.has(c.row.company)) {
          pushIssue(errors, {
            sheet: sheetName, row: c.rowNum, column: 'company', value: c.row.company,
            message: `company '${c.row.company}' already exists`,
          });
        }
        const derivedSn = c.tcUpper ? c.tcUpper.toLowerCase() : null;
        if (derivedSn && existingSnSet.has(derivedSn)) {
          pushIssue(errors, {
            sheet: sheetName, row: c.rowNum, column: 'tenant_code', value: c.row.tenant_code,
            message: `schema_name '${derivedSn}' already exists (derived from tenant_code)`,
          });
        }
        if (c.emailRaw && existingEmailSet.has(c.emailRaw)) {
          pushIssue(errors, {
            sheet: sheetName, row: c.rowNum, column: 'admin_email', value: c.row.admin_email,
            message: `admin_email '${c.row.admin_email}' already exists in admin.portal_users`,
          });
        }
      }
    }

    // Pre-load existing tenant rows for the UPDATE candidates.
    const updateCandidates = candidates.filter((c) => !c.isInsert);
    const existingById = new Map();
    if (updateCandidates.length) {
      const ids = updateCandidates.map((c) => c.row.id);
      const tenants = await this.db.any(
        `SELECT * FROM admin.tenants WHERE id = ANY($1::uuid[])`,
        [ids],
      );
      for (const t of tenants) existingById.set(t.id, t);
    }

    // ROOT_TENANT archive protection for UPDATE rows: also resolve by the
    // persisted tenant_code, since the spreadsheet may identify the row by
    // `id` alone (with a blank/different tenant_code in the row).
    for (const c of updateCandidates) {
      const willArchive = String(c.row.status || '').toLowerCase().trim() === 'archived';
      if (!willArchive) continue;
      const existing = existingById.get(c.row.id);
      if (existing && existing.tenant_code?.toUpperCase() === rootTenantCode) {
        // Only push if we didn't already record a code-based hit for this row.
        const already = errors.some(
          (e) => e.row === c.rowNum && e.column === 'tenant_code' && /Cannot archive the root tenant/.test(e.message),
        );
        if (!already) {
          pushIssue(errors, {
            sheet: sheetName, row: c.rowNum, column: 'tenant_code', value: existing.tenant_code,
            message: `Cannot archive the root tenant '${rootTenantCode}'.`,
          });
        }
      }
    }

    // Classification pass. A row is `error` if any error in `errors` references
    // its rowNum. Otherwise: insert / update / noop.
    const errorRows = new Set(errors.map((e) => e.row).filter((r) => r != null));
    const classified = [];
    for (const c of candidates) {
      if (errorRows.has(c.rowNum)) {
        classified.push({ rowNum: c.rowNum, row: c.row, action: 'error' });
        continue;
      }
      if (c.isInsert) {
        classified.push({ rowNum: c.rowNum, row: c.row, action: 'insert' });
        continue;
      }
      const existing = existingById.get(c.row.id);
      if (!existing) {
        pushIssue(errors, {
          sheet: sheetName, row: c.rowNum, column: 'id', value: c.row.id,
          message: `Tenant id '${c.row.id}' not found`,
        });
        classified.push({ rowNum: c.rowNum, row: c.row, action: 'error' });
        continue;
      }
      // Compute diffs across the four data surfaces for noop classification.
      const tenantDiff = this._tenantMetadataDiff(c.row, existing);
      const addressDiff = await this._billingAddressDiff(c.row, existing);
      const taxDiff = await this._taxIdentifierDiff(c.row, existing);
      const phoneDiff = await this._adminPhoneDiff(c.row, existing);
      // Archive transitions only fire when status is *explicitly present and
      // recognized*. A row that omits `status` leaves archive state untouched —
      // re-importing a workbook without a status column must not silently
      // restore archived tenants.
      const normalizedStatus = c.row.status ? String(c.row.status).toLowerCase().trim() : null;
      const statusRecognized = normalizedStatus === 'archived' || VALID_STATUSES.has(normalizedStatus);
      const willArchive = normalizedStatus === 'archived';
      const wasArchived = !!existing.deactivated_at;
      const archiveChanged = statusRecognized && willArchive !== wasArchived;
      const hasAnyChange = Object.keys(tenantDiff).length > 0
        || addressDiff != null
        || taxDiff != null
        || phoneDiff != null
        || archiveChanged;
      classified.push({
        rowNum: c.rowNum,
        row: c.row,
        existing,
        diffs: { tenantDiff, addressDiff, taxDiff, phoneDiff, archiveChanged, willArchive },
        action: hasAnyChange ? 'update' : 'noop',
      });
    }

    return { classified, errors };
  }

  // ── Diff helpers (used for noop classification AND diff-as-DTO writes) ────

  /** Compare row-provided tenant metadata fields against the existing row. */
  _tenantMetadataDiff(row, existing) {
    const changes = {};
    if (row.company && !_eq(row.company, existing.company)) changes.company = row.company;
    const normalizedStatus = row.status ? String(row.status).toLowerCase().trim() : null;
    if (
      normalizedStatus
      && VALID_STATUSES.has(normalizedStatus)
      && !_eq(normalizedStatus, existing.status)
    ) {
      changes.status = normalizedStatus;
    }
    if (row.tier && !_eq(row.tier, existing.tier)) changes.tier = row.tier;
    if ('region' in row && !_eq(row.region || null, existing.region)) changes.region = row.region || null;
    if (row.max_users != null && row.max_users !== '') {
      const parsed = parseInt(row.max_users, 10);
      if (Number.isFinite(parsed) && parsed !== existing.max_users) changes.max_users = parsed;
    }
    if ('notes' in row && !_eq(row.notes || null, existing.notes)) changes.notes = row.notes || null;
    return changes;
  }

  /**
   * Diff the row's billing address against the existing one. Returns:
   *   - null if the row doesn't intend to write an address (no address_line_1) OR matches the existing.
   *   - { action: 'insert', sourceId, fields } if there's no current address.
   *   - { action: 'update', id, changes } if some fields differ.
   *   - null if the company source doesn't exist yet (can't address it).
   */
  async _billingAddressDiff(row, existing) {
    if (!row.address_line_1) return null;
    const sch = this.pgp.as.name(existing.schema_name);
    let company;
    try {
      company = await this.db.oneOrNone(
        `SELECT source_id FROM ${sch}.companies WHERE code = $1 AND deactivated_at IS NULL LIMIT 1`,
        [existing.tenant_code],
      );
    } catch (err) {
      if (_isSchemaMissing(err)) return null; // tenant schema not provisioned
      throw err;
    }
    if (!company?.source_id) return null;

    const current = await this.db.oneOrNone(
      `SELECT id, address_line_1, address_line_2, address_line_3, city, state_province, postal_code, country_code
       FROM ${sch}.addresses WHERE source_id = $1 AND label = 'billing' AND deactivated_at IS NULL LIMIT 1`,
      [company.source_id],
    );

    const desired = {
      address_line_1: row.address_line_1,
      address_line_2: row.address_line_2 || null,
      address_line_3: row.address_line_3 || null,
      city: row.city || null,
      state_province: row.state_province || null,
      postal_code: row.postal_code || null,
      country_code: row.country_code || null,
    };

    if (!current) return { action: 'insert', sourceId: company.source_id, fields: desired };

    const changes = {};
    for (const [k, v] of Object.entries(desired)) {
      if (!_eq(v, current[k])) changes[k] = v;
    }
    if (Object.keys(changes).length === 0) return null;
    return { action: 'update', id: current.id, changes };
  }

  /** Same shape as the address diff, against the primary tax identifier. */
  async _taxIdentifierDiff(row, existing) {
    if (!row.tax_type || !row.tax_value) return null;
    const sch = this.pgp.as.name(existing.schema_name);
    let company;
    try {
      company = await this.db.oneOrNone(
        `SELECT source_id FROM ${sch}.companies WHERE code = $1 AND deactivated_at IS NULL LIMIT 1`,
        [existing.tenant_code],
      );
    } catch (err) {
      if (_isSchemaMissing(err)) return null;
      throw err;
    }
    if (!company?.source_id) return null;

    const current = await this.db.oneOrNone(
      `SELECT id, country_code, tax_type, tax_value FROM ${sch}.tax_identifiers
       WHERE source_id = $1 AND deactivated_at IS NULL LIMIT 1`,
      [company.source_id],
    );

    const desired = {
      country_code: row.tax_country_code || row.country_code || null,
      tax_type: row.tax_type,
      tax_value: row.tax_value,
    };

    if (!current) return { action: 'insert', sourceId: company.source_id, fields: desired };

    const changes = {};
    for (const [k, v] of Object.entries(desired)) {
      if (!_eq(v, current[k])) changes[k] = v;
    }
    if (Object.keys(changes).length === 0) return null;
    return { action: 'update', id: current.id, changes };
  }

  /** Diff the row's `admin_phone` against the primary contact's primary phone. */
  async _adminPhoneDiff(row, existing) {
    if (!row.admin_phone) return null;
    const sch = this.pgp.as.name(existing.schema_name);
    let adminEmp;
    try {
      adminEmp = await this.db.oneOrNone(
        `SELECT s.id AS source_id
         FROM ${sch}.employees e
         JOIN ${sch}.sources s ON s.table_id = e.id AND s.source_type = 'employee' AND s.deactivated_at IS NULL
         WHERE e.is_primary_contact = true AND e.deactivated_at IS NULL
         ORDER BY e.created_at LIMIT 1`,
      );
    } catch (err) {
      if (_isSchemaMissing(err)) return null;
      throw err;
    }
    if (!adminEmp?.source_id) return null;

    const current = await this.db.oneOrNone(
      `SELECT id, phone_number FROM ${sch}.phone_numbers
       WHERE source_id = $1 AND deactivated_at IS NULL
       ORDER BY is_primary DESC, created_at LIMIT 1`,
      [adminEmp.source_id],
    );

    if (!current) return { action: 'insert', sourceId: adminEmp.source_id, phone_number: row.admin_phone };
    if (_eq(row.admin_phone, current.phone_number)) return null;
    return { action: 'update', id: current.id, phone_number: row.admin_phone };
  }

  // ── Phase 2: commit ────────────────────────────────────────────────────────

  /**
   * Apply the precomputed diffs to an existing tenant. Writes only the fields
   * that changed (diff-as-DTO) plus an explicit archive transition when
   * required. No-op if every diff is empty (won't be called in that case —
   * classification already routes those rows to `noop`).
   */
  async _updateTenantRow(row, actorId, tenant, diffs) {
    const { tenantDiff, addressDiff, taxDiff, phoneDiff, archiveChanged, willArchive } = diffs;

    // Tenant-metadata UPDATE (only when fields actually differ).
    if (Object.keys(tenantDiff).length) {
      const changes = { ...tenantDiff };
      if (actorId) changes.updated_by = actorId;
      await this.updateWhere([{ id: row.id }], changes, { includeDeactivated: true });
    } else if (actorId) {
      // Pure address/tax/phone change. Still bump updated_by so the audit
      // trail reflects who touched the tenant via this import.
      await this.updateWhere([{ id: row.id }], { updated_by: actorId }, { includeDeactivated: true });
    }

    // Archive transition via direct SQL (mirrors the original handler's pattern).
    if (archiveChanged) {
      if (willArchive) {
        await this.db.none('UPDATE admin.tenants SET deactivated_at = NOW() WHERE id = $1', [row.id]);
      } else {
        await this.db.none('UPDATE admin.tenants SET deactivated_at = NULL WHERE id = $1', [row.id]);
      }
    }

    const sch = this.pgp.as.name(tenant.schema_name);

    if (addressDiff) {
      if (addressDiff.action === 'update') {
        const cols = Object.keys(addressDiff.changes);
        const setClause = cols.map((c, i) => `${c} = $${i + 1}`).join(', ');
        const values = cols.map((c) => addressDiff.changes[c]);
        values.push(actorId, addressDiff.id);
        await this.db.none(
          `UPDATE ${sch}.addresses SET ${setClause}, updated_by = $${values.length - 1} WHERE id = $${values.length}`,
          values,
        );
      } else {
        const f = addressDiff.fields;
        await this.db.none(
          `INSERT INTO ${sch}.addresses (tenant_id, source_id, label, address_line_1, address_line_2, address_line_3,
           city, state_province, postal_code, country_code, created_by)
           VALUES ((SELECT id FROM admin.tenants WHERE schema_name = $1), $2, 'billing', $3, $4, $5, $6, $7, $8, $9, $10)`,
          [tenant.schema_name, addressDiff.sourceId, f.address_line_1, f.address_line_2, f.address_line_3,
           f.city, f.state_province, f.postal_code, f.country_code, actorId],
        );
      }
    }

    if (taxDiff) {
      if (taxDiff.action === 'update') {
        const cols = Object.keys(taxDiff.changes);
        const setClause = cols.map((c, i) => `${c} = $${i + 1}`).join(', ');
        const values = cols.map((c) => taxDiff.changes[c]);
        values.push(actorId, taxDiff.id);
        await this.db.none(
          `UPDATE ${sch}.tax_identifiers SET ${setClause}, updated_by = $${values.length - 1} WHERE id = $${values.length}`,
          values,
        );
      } else {
        const f = taxDiff.fields;
        await this.db.none(
          `INSERT INTO ${sch}.tax_identifiers (tenant_id, source_id, country_code, tax_type, tax_value, created_by)
           VALUES ((SELECT id FROM admin.tenants WHERE schema_name = $1), $2, $3, $4, $5, $6)`,
          [tenant.schema_name, taxDiff.sourceId, f.country_code, f.tax_type, f.tax_value, actorId],
        );
      }
    }

    if (phoneDiff) {
      if (phoneDiff.action === 'update') {
        await this.db.none(
          `UPDATE ${sch}.phone_numbers SET phone_number = $1, updated_by = $2 WHERE id = $3`,
          [phoneDiff.phone_number, actorId, phoneDiff.id],
        );
      } else {
        await this.db.none(
          `INSERT INTO ${sch}.phone_numbers (tenant_id, source_id, phone_number, phone_type, is_primary, created_by)
           VALUES ($1, $2, $3, 'work', true, $4)`,
          [tenant.id, phoneDiff.sourceId, phoneDiff.phone_number, actorId],
        );
      }
    }
  }

  /**
   * Create a new tenant from a flat row via full provisioning.
   */
  async _createTenantRow(row, actorId) {
    const billingAddress = {
      address_line_1: row.address_line_1,
      address_line_2: row.address_line_2 || null,
      address_line_3: row.address_line_3 || null,
      city: row.city || null,
      state_province: row.state_province || null,
      postal_code: row.postal_code || null,
      country_code: row.country_code,
    };

    const taxIdentifiers = row.tax_type && row.tax_value
      ? [{ country_code: row.tax_country_code || row.country_code, tax_type: row.tax_type, tax_value: row.tax_value }]
      : [];

    await provisionNewTenant({
      tenant_code: row.tenant_code,
      company: row.company,
      status: row.status || 'active',
      tier: row.tier || 'starter',
      region: row.region || null,
      max_users: row.max_users ? parseInt(row.max_users, 10) : 5,
      notes: row.notes || null,
      billing_address: billingAddress,
      tax_identifiers: taxIdentifiers,
      admin_first_name: row.admin_first_name,
      admin_last_name: row.admin_last_name,
      admin_email: row.admin_email,
      admin_password: row.admin_password,
      admin_phone: row.admin_phone || null,
    }, actorId);
  }
}
