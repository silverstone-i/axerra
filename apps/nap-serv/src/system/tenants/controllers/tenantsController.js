/**
 * @file TenantsController — tenant CRUD with provisioning, cascade archive/restore
 * @module tenants/controllers/tenantsController
 *
 * Overrides:
 *   create → inserts tenant record, provisions schema, seeds RBAC, creates admin user
 *   importXls → passes created_by only (each row carries its own tenant_code)
 *   archive → cascades deactivation to all tenant users; rejects root tenant (NAP)
 *   restore → reactivates tenant (users remain archived until individually restored)
 *
 * Copyright (c) 2025 – present Vimber LLC. All rights reserved.
 */

import fs from 'node:fs';
import BaseController from '../../../lib/BaseController.js';
import db, { pgp } from '../../../db/db.js';
import logger from '../../../lib/logger.js';
import { provisionNewTenant } from '../../../services/tenantSetup.js';

class TenantsController extends BaseController {
  constructor() {
    super('tenants');
  }

  /**
   * Override getSchema — tenants always live in the admin schema.
   */
  getSchema(_req) {
    return 'admin';
  }

  /**
   * POST / — create tenant, provision schema, create company + address + tax IDs, create admin user
   *
   * Body: { tenant_code, company, schema_name?, status?, tier?, region?,
   *         allowed_modules?, max_users?, notes?,
   *         billing_address: { address_line_1, address_line_2?, address_line_3?,
   *                            city?, state_province?, postal_code?, country_code },
   *         tax_identifiers?: [{ country_code, tax_type, tax_value }],
   *         admin_first_name, admin_last_name, admin_email, admin_password }
   */
  async create(req, res) {
    try {
      const result = await provisionNewTenant(req.body, req.user?.id || null);
      res.status(201).json({ ...result.tenant, admin_user_id: result.admin_user_id, company_id: result.company_id, source_id: result.source_id });
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
      this.handleError(err, res, 'creating', this.errorLabel);
    }
  }

  /**
   * POST /import-xls — import tenants from uploaded spreadsheet.
   *
   * Overrides BaseController.importXls to pass only created_by in the callback
   * (each row carries its own tenant_code, unlike tenant-scoped entities).
   */
  async importXls(req, res) {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    try {
      const result = await this.model('admin').importFromSpreadsheet(
        file.path, 0, (row) => ({ ...row, created_by: req.user?.id }),
      );
      if (result.errors?.length) return res.status(422).json(result);
      res.status(201).json(result);
    } catch (err) {
      this.handleError(err, res, 'importing', this.errorLabel);
    } finally {
      fs.unlink(file.path, (unlinkErr) => {
        if (unlinkErr) logger.error(`Failed to delete uploaded file: ${unlinkErr.message}`);
      });
    }
  }

  /**
   * DELETE /archive — soft-delete tenant and cascade to all users.
   * Rejects archival of the root tenant (NAP).
   */
  async archive(req, res) {
    const rootTenantCode = (process.env.ROOT_TENANT_CODE || 'NAP').toUpperCase();

    // Check by tenant_code query param
    const tenantCode = req.query.tenant_code?.toUpperCase?.();
    if (tenantCode === rootTenantCode) {
      return res.status(403).json({ error: 'Cannot archive the root Vimber tenant.' });
    }

    // Check by id if provided
    if (req.query.id) {
      try {
        const t = await this.model('admin').findById(req.query.id);
        if (t && t.tenant_code?.toUpperCase() === rootTenantCode) {
          return res.status(403).json({ error: 'Cannot archive the root Vimber tenant.' });
        }
      } catch {
        /* proceed, will fail on updateWhere if not found */
      }
    }

    const now = new Date();
    req.body.deactivated_at = now;

    try {
      // Archive the tenant
      const count = await this.model('admin').updateWhere([{ ...req.query }], req.body);
      if (!count) return res.status(404).json({ error: `${this.errorLabel} not found or already inactive` });

      // Cascade: deactivate and lock all currently-active users
      if (req.query.id) {
        await db.none(
          `UPDATE admin.portal_users SET deactivated_at = $1, status = 'locked', updated_by = $2
           WHERE tenant_id = $3 AND deactivated_at IS NULL`,
          [now, req.user?.id || null, req.query.id],
        );
      } else if (req.query.tenant_code) {
        await db.none(
          `UPDATE admin.portal_users SET deactivated_at = $1, status = 'locked', updated_by = $2
           WHERE tenant_id = (SELECT id FROM admin.tenants WHERE tenant_code = $3)
             AND deactivated_at IS NULL`,
          [now, req.user?.id || null, req.query.tenant_code],
        );
      }

      res.status(200).json({ message: `${this.errorLabel} marked as inactive` });
    } catch (err) {
      this.handleError(err, res, 'archiving', this.errorLabel);
    }
  }

  /**
   * PATCH /restore — reactivate tenant only (users remain archived)
   */
  async restore(req, res) {
    req.body.deactivated_at = null;
    const filters = [{ deactivated_at: { $not: null } }, { ...req.query }];

    try {
      const count = await this.model('admin').updateWhere(filters, req.body, { includeDeactivated: true });
      if (!count) return res.status(404).json({ error: `${this.errorLabel} not found or already active` });

      res.status(200).json({ message: `${this.errorLabel} marked as active` });
    } catch (err) {
      this.handleError(err, res, 'restoring', this.errorLabel);
    }
  }

  /**
   * GET /:id/modules — get tenant's allowed modules
   */
  async getAllowedModules(req, res) {
    try {
      const tenant = await this.model('admin').findById(req.params.id);
      if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
      res.json({ allowed_modules: tenant.allowed_modules });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * GET /:id/contacts — primary and billing contacts with their phone/address
   *
   * Queries the tenant's schema for employees flagged as is_primary_contact
   * or is_billing_contact, joining their primary email/phone and first address
   * via the polymorphic sources table.
   */
  async getContacts(req, res) {
    try {
      const tenant = await this.model('admin').findById(req.params.id);
      if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

      const sch = pgp.as.name(tenant.schema_name);

      const contacts = await db.any(
        `SELECT e.id, e.first_name, e.last_name,
                em.email,
                e.is_primary_contact, e.is_billing_contact,
                pn.phone_number AS primary_phone, pn.phone_type AS primary_phone_type,
                pn.country_code AS phone_country_code,
                a.address_line_1, a.address_line_2, a.city,
                a.state_province, a.postal_code, a.country_code
         FROM ${sch}.employees e
         LEFT JOIN ${sch}.sources s
           ON s.table_id = e.id AND s.source_type = 'employee' AND s.deactivated_at IS NULL
         LEFT JOIN LATERAL (
           SELECT em.email
           FROM ${sch}.emails em
           WHERE em.source_id = s.id AND em.deactivated_at IS NULL
           ORDER BY em.is_primary DESC, em.created_at
           LIMIT 1
         ) em ON true
         LEFT JOIN LATERAL (
           SELECT pn.phone_number, pn.phone_type, pn.country_code
           FROM ${sch}.phone_numbers pn
           WHERE pn.source_id = s.id AND pn.deactivated_at IS NULL
           ORDER BY pn.is_primary DESC, pn.created_at
           LIMIT 1
         ) pn ON true
         LEFT JOIN LATERAL (
           SELECT a.address_line_1, a.address_line_2, a.city, a.state_province, a.postal_code, a.country_code
           FROM ${sch}.addresses a
           WHERE a.source_id = s.id AND a.deactivated_at IS NULL
           ORDER BY a.created_at
           LIMIT 1
         ) a ON true
         WHERE (e.is_primary_contact = true OR e.is_billing_contact = true)
           AND e.deactivated_at IS NULL`,
      );

      const primary = contacts.filter((c) => c.is_primary_contact);
      const billing = contacts.filter((c) => c.is_billing_contact);

      res.json({ primary, billing });
    } catch (err) {
      this.handleError(err, res, 'fetching contacts for', this.errorLabel);
    }
  }

  /**
   * GET /:id/company — tenant's self-company with billing address and tax identifiers
   *
   * Cross-schema query: resolves tenant's schema_name, then queries companies
   * joined through sources to addresses and tax_identifiers.
   */
  async getCompany(req, res) {
    try {
      const tenant = await this.model('admin').findById(req.params.id);
      if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

      const sch = pgp.as.name(tenant.schema_name);

      const company = await db.oneOrNone(
        `SELECT c.id, c.code, c.name, c.source_id
         FROM ${sch}.companies c
         WHERE c.code = $1 AND c.deactivated_at IS NULL
         LIMIT 1`,
        [tenant.tenant_code],
      );

      if (!company) return res.json({ company: null, addresses: [], tax_identifiers: [] });

      const addresses = await db.any(
        `SELECT a.id, a.label, a.address_line_1, a.address_line_2, a.address_line_3,
                a.city, a.state_province, a.postal_code, a.country_code
         FROM ${sch}.addresses a
         WHERE a.source_id = $1 AND a.deactivated_at IS NULL
         ORDER BY a.created_at`,
        [company.source_id],
      );

      const taxIdentifiers = await db.any(
        `SELECT ti.id, ti.country_code, ti.tax_type, ti.tax_value
         FROM ${sch}.tax_identifiers ti
         WHERE ti.source_id = $1 AND ti.deactivated_at IS NULL
         ORDER BY ti.created_at`,
        [company.source_id],
      );

      res.json({ company, addresses, tax_identifiers: taxIdentifiers });
    } catch (err) {
      this.handleError(err, res, 'fetching company for', this.errorLabel);
    }
  }
}

const instance = new TenantsController();

export { TenantsController };
export default instance;
