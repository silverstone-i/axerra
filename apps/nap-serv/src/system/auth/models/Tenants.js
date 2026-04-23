/**
 * @file Tenants model — extends TableModel with flat single-sheet export/import
 * @module auth/models/Tenants
 *
 * Export flattens each tenant's billing address and primary tax identifier into
 * a single row. Import supports both update (rows with id) and create (rows
 * without id trigger full provisioning via provisionNewTenant).
 *
 * Copyright (c) 2025 – present Vimber LLC. All rights reserved.
 */

import { writeFileSync, readFileSync } from 'node:fs';
import { TableModel } from 'pg-schemata';
import tenantsSchema from '../schemas/tenantsSchema.js';
import { parseSheet, isUuid } from '../../../lib/spreadsheetHelpers.js';
import { provisionNewTenant } from '../../../services/tenantSetup.js';

// ── Column layout for the flat "Tenants" sheet ──────────────────────────────

const HEADERS = [
  'id', 'tenant_code', 'company', 'status', 'tier', 'region', 'max_users', 'notes',
  'address_line_1', 'address_line_2', 'address_line_3', 'city', 'state_province', 'postal_code', 'country_code',
  'tax_country_code', 'tax_type', 'tax_value',
  'admin_first_name', 'admin_last_name', 'admin_email', 'admin_password', 'admin_phone',
];

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
    const rootTenantCode = (process.env.ROOT_TENANT_CODE || 'VIMBER').toUpperCase();
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
   * Rows with a valid UUID `id` → update tenant metadata + billing address + tax identifier.
   * Rows without `id` → full provisioning (requires admin_* columns).
   */
  async importFromSpreadsheet(filePath, _sheetIndex = 0, callbackFn = null) {
    const { WorkbookReader } = await import('@nap-sft/tablsx');
    const buffer = readFileSync(filePath);
    const reader = WorkbookReader.fromBuffer(buffer);
    const sheetName = reader.sheetNames?.[0] || 'tenants';
    const rows = parseSheet(reader, 0);
    if (!rows.length) return { inserted: 0, updated: 0 };

    const actorId = callbackFn ? (await callbackFn({})).created_by || null : null;

    let inserted = 0;
    let updated = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        if (isUuid(row.id)) {
          await this._updateTenantRow(row, actorId);
          updated++;
        } else {
          await this._createTenantRow(row, actorId);
          inserted++;
        }
      } catch (err) {
        errors.push({ sheet: sheetName, row: row._rowNum || i + 2, tenant_code: row.tenant_code || '', message: err.message });
      }
    }

    return { inserted, updated, ...(errors.length ? { errors } : {}) };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Update an existing tenant's metadata, billing address, and tax identifier.
   */
  async _updateTenantRow(row, actorId) {
    const tenant = await this.findById(row.id);
    if (!tenant) throw new Error(`Tenant id ${row.id} not found`);

    // Update tenant metadata
    const VALID_STATUSES = new Set(['active', 'trial', 'suspended', 'pending', 'archived']);
    const normalizedStatus = row.status ? String(row.status).toLowerCase().trim() : null;
    const changes = {};
    if (row.company) changes.company = row.company;
    if (normalizedStatus && VALID_STATUSES.has(normalizedStatus) && normalizedStatus !== 'archived') changes.status = normalizedStatus;
    if (row.tier) changes.tier = row.tier;
    if ('region' in row) changes.region = row.region || null;
    if (row.max_users != null) {
      const parsed = parseInt(row.max_users, 10);
      if (Number.isFinite(parsed)) changes.max_users = parsed;
    }
    if ('notes' in row) changes.notes = row.notes || null;
    if (actorId) changes.updated_by = actorId;

    if (Object.keys(changes).length) {
      await this.updateWhere([{ id: row.id }], changes, { includeDeactivated: true });
    }

    // Handle archive/restore via status column
    if (normalizedStatus === 'archived' && !tenant.deactivated_at) {
      await this.db.none('UPDATE admin.tenants SET deactivated_at = NOW() WHERE id = $1', [row.id]);
    } else if (normalizedStatus && normalizedStatus !== 'archived' && tenant.deactivated_at) {
      await this.db.none('UPDATE admin.tenants SET deactivated_at = NULL WHERE id = $1', [row.id]);
    }

    // Cross-schema upsert billing address + tax identifier
    const sch = this.pgp.as.name(tenant.schema_name);
    const company = await this.db.oneOrNone(
      `SELECT source_id FROM ${sch}.companies WHERE code = $1 AND deactivated_at IS NULL LIMIT 1`,
      [tenant.tenant_code],
    );
    if (!company?.source_id) return;
    const sourceId = company.source_id;

    // Upsert billing address
    if (row.address_line_1) {
      const existing = await this.db.oneOrNone(
        `SELECT id FROM ${sch}.addresses WHERE source_id = $1 AND label = 'billing' AND deactivated_at IS NULL LIMIT 1`,
        [sourceId],
      );
      const addrFields = {
        address_line_1: row.address_line_1,
        address_line_2: row.address_line_2 || null,
        address_line_3: row.address_line_3 || null,
        city: row.city || null,
        state_province: row.state_province || null,
        postal_code: row.postal_code || null,
        country_code: row.country_code || null,
        updated_by: actorId,
      };
      if (existing) {
        await this.db.none(
          `UPDATE ${sch}.addresses SET address_line_1=$1, address_line_2=$2, address_line_3=$3,
           city=$4, state_province=$5, postal_code=$6, country_code=$7, updated_by=$8
           WHERE id = $9`,
          [...Object.values(addrFields), existing.id],
        );
      } else {
        await this.db.none(
          `INSERT INTO ${sch}.addresses (tenant_id, source_id, label, address_line_1, address_line_2, address_line_3,
           city, state_province, postal_code, country_code, created_by)
           VALUES ((SELECT id FROM admin.tenants WHERE schema_name = $1), $2, 'billing', $3, $4, $5, $6, $7, $8, $9, $10)`,
          [tenant.schema_name, sourceId, row.address_line_1, row.address_line_2 || null, row.address_line_3 || null,
            row.city || null, row.state_province || null, row.postal_code || null, row.country_code || null, actorId],
        );
      }
    }

    // Upsert tax identifier
    if (row.tax_type && row.tax_value) {
      const existing = await this.db.oneOrNone(
        `SELECT id FROM ${sch}.tax_identifiers WHERE source_id = $1 AND deactivated_at IS NULL LIMIT 1`,
        [sourceId],
      );
      if (existing) {
        await this.db.none(
          `UPDATE ${sch}.tax_identifiers SET country_code=$1, tax_type=$2, tax_value=$3, updated_by=$4 WHERE id = $5`,
          [row.tax_country_code || row.country_code || null, row.tax_type, row.tax_value, actorId, existing.id],
        );
      } else {
        await this.db.none(
          `INSERT INTO ${sch}.tax_identifiers (tenant_id, source_id, country_code, tax_type, tax_value, created_by)
           VALUES ((SELECT id FROM admin.tenants WHERE schema_name = $1), $2, $3, $4, $5, $6)`,
          [tenant.schema_name, sourceId, row.tax_country_code || row.country_code || null, row.tax_type, row.tax_value, actorId],
        );
      }
    }

    // Upsert admin phone number
    if (row.admin_phone) {
      const adminEmp = await this.db.oneOrNone(
        `SELECT s.id AS source_id
         FROM ${sch}.employees e
         JOIN ${sch}.sources s ON s.table_id = e.id AND s.source_type = 'employee' AND s.deactivated_at IS NULL
         WHERE e.is_primary_contact = true AND e.deactivated_at IS NULL
         ORDER BY e.created_at LIMIT 1`,
      );
      if (adminEmp?.source_id) {
        const existingPhone = await this.db.oneOrNone(
          `SELECT id FROM ${sch}.phone_numbers WHERE source_id = $1 AND deactivated_at IS NULL
           ORDER BY is_primary DESC, created_at LIMIT 1`,
          [adminEmp.source_id],
        );
        if (existingPhone) {
          await this.db.none(
            `UPDATE ${sch}.phone_numbers SET phone_number = $1, updated_by = $2 WHERE id = $3`,
            [row.admin_phone, actorId, existingPhone.id],
          );
        } else {
          await this.db.none(
            `INSERT INTO ${sch}.phone_numbers (tenant_id, source_id, phone_number, phone_type, is_primary, created_by)
             VALUES ($1, $2, $3, 'work', true, $4)`,
            [tenant.id, adminEmp.source_id, row.admin_phone, actorId],
          );
        }
      }
    }
  }

  /**
   * Create a new tenant from a flat row via full provisioning.
   */
  async _createTenantRow(row, actorId) {
    if (!row.admin_first_name || !row.admin_last_name) {
      throw new Error('admin_first_name and admin_last_name are required for new tenants');
    }
    if (!row.admin_email || !row.admin_password) {
      throw new Error('admin_email and admin_password are required for new tenants');
    }

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
