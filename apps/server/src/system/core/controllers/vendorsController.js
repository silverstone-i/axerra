/**
 * @file Vendors controller — auto-creates a sources record on vendor creation
 * @module core/controllers/vendorsController
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import fs from 'node:fs';
import BaseController from '../../../lib/BaseController.js';
import db, { pgp } from '../../../db/db.js';
import { allocateNumber } from '../services/numberingService.js';
import logger from '../../../lib/logger.js';

class VendorsController extends BaseController {
  constructor() {
    super('vendors');
    this.rbacConfig = { module: 'core', router: 'vendors' };
  }

  /**
   * POST / — insert a vendor and auto-create a linked sources record.
   * Runs inside a transaction so both inserts succeed or both roll back.
   */
  async create(req, res) {
    try {
      const schema = this.getSchema(req);
      const s = pgp.as.name(schema);

      // Inject tenant_id from authenticated session
      if (!req.body.tenant_id && req.user?.tenant_id) {
        req.body.tenant_id = req.user.tenant_id;
      }

      const record = await db.tx(async (t) => {
        const vendorsModel = this.model(schema);
        vendorsModel.tx = t;

        // 1. Insert the vendor
        const vendor = await vendorsModel.insert(req.body);

        // 2. Auto-create a sources record linking to this vendor
        const sourcesModel = db('sources', schema);
        sourcesModel.tx = t;
        const source = await sourcesModel.insert({
          tenant_id: vendor.tenant_id,
          table_id: vendor.id,
          source_type: 'vendor',
          label: vendor.name,
        });

        // 3. Link the source back to the vendor
        await t.none(
          `UPDATE ${s}.vendors SET source_id = $1, updated_by = $2 WHERE id = $3`,
          [source.id, req.user?.id ?? null, vendor.id],
        );

        // 4. Auto-assign code via numbering service (if enabled and code not provided)
        if (!vendor.code) {
          const numbering = await allocateNumber(schema, 'vendor', null, new Date(), t);
          if (numbering) {
            await t.none(`UPDATE ${s}.vendors SET code = $1 WHERE id = $2`, [numbering.displayId, vendor.id]);
            vendor.code = numbering.displayId;
          }
        }

        return { ...vendor, source_id: source.id };
      });

      res.status(201).json(record);
    } catch (err) {
      if (err.name === 'SchemaDefinitionError') err.message = 'Invalid input data';
      this.handleError(err, res, 'creating', this.errorLabel);
    }
  }

  /**
   * DELETE /archive — soft-delete the vendor and cascade-archive every active
   * vendor_contact under it, locking the portal_user bindings (and the
   * portal_users themselves when those were the last active binding).
   *
   * Mirrors the tenant-archive cascade pattern: the cascade is scoped via
   * RETURNING so multi-tenant portal_users with other active bindings stay
   * live. Inline rather than delegating per-contact to the cascade helper so
   * everything happens in one transaction with one round-trip per step.
   */
  async archive(req, res) {
    if (!req.query.id && !req.query.code) {
      return res.status(400).json({ error: 'id or code query parameter is required' });
    }

    const schema = this.getSchema(req);
    const s = pgp.as.name(schema);
    const tenantId = req.user?.tenant_id;
    const actorId = req.user?.id || null;

    let vendorId = req.query.id;

    try {
      if (!vendorId) {
        // Archive operates on active vendors, so the default model filter is fine here.
        const vendor = await this.model(schema).findOneByFilter({ code: req.query.code });
        if (!vendor) return res.status(404).json({ error: `${this.errorLabel} not found or already inactive` });
        vendorId = vendor.id;
      }

      let archivedVendor = 0;
      await db.tx(async (t) => {
        // Vendor row first — if the row doesn't move (404 case, e.g. already
        // archived), abort before any cascade fires. Avoids the prior bug
        // where the cascade committed even when the vendor archive was a no-op.
        const result = await t.result(
          `UPDATE ${s}.vendors
              SET deactivated_at = NOW(), updated_by = $1
            WHERE id = $2 AND deactivated_at IS NULL`,
          [actorId, vendorId],
          (r) => r.rowCount,
        );
        archivedVendor = result;
        if (!archivedVendor) return;

        // Cascade — only runs when the vendor actually transitioned to archived.
        const contacts = await t.any(
          `SELECT id FROM ${s}.vendor_contacts WHERE vendor_id = $1 AND deactivated_at IS NULL`,
          [vendorId],
        );
        if (!contacts.length) return;

        const contactIds = contacts.map((r) => r.id);

        await t.none(
          `UPDATE ${s}.vendor_contacts
              SET deactivated_at = NOW(), updated_by = $1
            WHERE id = ANY($2::uuid[])`,
          [actorId, contactIds],
        );

        const affected = await t.any(
          `UPDATE admin.portal_user_tenants
              SET deactivated_at = NOW(), status = 'locked', updated_by = $1
            WHERE entity_type = 'vendor_contact'
              AND entity_id = ANY($2::uuid[])
              AND tenant_id = $3
              AND deactivated_at IS NULL
            RETURNING portal_user_id`,
          [actorId, contactIds, tenantId],
        );

        const userIds = [...new Set(affected.map((r) => r.portal_user_id))];
        if (userIds.length) {
          await t.none(
            `UPDATE admin.portal_users
                SET deactivated_at = NOW(), status = 'locked', updated_by = $1
              WHERE id = ANY($2::uuid[])
                AND deactivated_at IS NULL
                AND id NOT IN (
                  SELECT portal_user_id FROM admin.portal_user_tenants WHERE deactivated_at IS NULL
                )`,
            [actorId, userIds],
          );
        }
      });

      if (!archivedVendor) {
        return res.status(404).json({ error: `${this.errorLabel} not found or already inactive` });
      }
      res.status(200).json({ message: `${this.errorLabel} marked as inactive` });
    } catch (err) {
      this.handleError(err, res, 'archiving', this.errorLabel);
    }
  }

  /**
   * PATCH /restore — restore the vendor and the cohort of vendor_contacts that
   * were archived together with it. Cohort is identified by the MAX
   * `deactivated_at` of vendor_contacts under this vendor; each cohort
   * member's portal_user / portal_user_tenants binding pair is restored too
   * (only when the binding's `deactivated_at` matches the binding-level
   * MAX, per the same rule used for direct entity restore).
   *
   * `status` is intentionally not modified anywhere — restoring only flips
   * `deactivated_at` back to NULL.
   */
  async restore(req, res) {
    if (!req.query.id && !req.query.code) {
      return res.status(400).json({ error: 'id or code query parameter is required' });
    }

    const schema = this.getSchema(req);
    const s = pgp.as.name(schema);
    const tenantId = req.user?.tenant_id;
    const actorId = req.user?.id || null;

    let vendorId = req.query.id;

    try {
      if (!vendorId) {
        // Restore by definition operates on an archived row — must include deactivated.
        const vendor = await this.model(schema).findOneByFilter(
          { code: req.query.code },
          { includeDeactivated: true },
        );
        if (!vendor) return res.status(404).json({ error: `${this.errorLabel} not found or already active` });
        vendorId = vendor.id;
      }

      let restoredVendor = 0;
      await db.tx(async (t) => {
        const result = await t.result(
          `UPDATE ${s}.vendors
              SET deactivated_at = NULL, updated_by = $1
            WHERE id = $2 AND deactivated_at IS NOT NULL`,
          [actorId, vendorId],
          (r) => r.rowCount,
        );
        restoredVendor = result;
        if (!restoredVendor) return;

        // Cohort of vendor_contacts archived together with the vendor.
        const cohort = await t.any(
          `WITH max_ts AS (
             SELECT MAX(deactivated_at) AS ts FROM ${s}.vendor_contacts
             WHERE vendor_id = $1 AND deactivated_at IS NOT NULL
           )
           SELECT id FROM ${s}.vendor_contacts
           WHERE vendor_id = $1
             AND deactivated_at IS NOT NULL
             AND deactivated_at = (SELECT ts FROM max_ts)`,
          [vendorId],
        );

        if (!cohort.length) return;
        const contactIds = cohort.map((r) => r.id);

        await t.none(
          `UPDATE ${s}.vendor_contacts
              SET deactivated_at = NULL, updated_by = $1
            WHERE id = ANY($2::uuid[])`,
          [actorId, contactIds],
        );

        // Restore the binding cohort sharing the MAX(deactivated_at) per
        // entity_id — matches the standalone vendor_contact restore rule.
        const restoredBindings = await t.any(
          `WITH cohort AS (
             SELECT id, portal_user_id
             FROM admin.portal_user_tenants put1
             WHERE entity_type = 'vendor_contact'
               AND tenant_id = $1
               AND entity_id = ANY($2::uuid[])
               AND deactivated_at IS NOT NULL
               AND deactivated_at = (
                 SELECT MAX(deactivated_at) FROM admin.portal_user_tenants put2
                 WHERE put2.entity_type = put1.entity_type
                   AND put2.entity_id = put1.entity_id
                   AND put2.tenant_id = put1.tenant_id
                   AND put2.deactivated_at IS NOT NULL
               )
           )
           UPDATE admin.portal_user_tenants
              SET deactivated_at = NULL, updated_by = $3
            WHERE id IN (SELECT id FROM cohort)
            RETURNING portal_user_id`,
          [tenantId, contactIds, actorId],
        );

        const userIds = [...new Set(restoredBindings.map((r) => r.portal_user_id))];
        if (userIds.length) {
          await t.none(
            `UPDATE admin.portal_users
                SET deactivated_at = NULL, updated_by = $1
              WHERE id = ANY($2::uuid[])
                AND deactivated_at IS NOT NULL`,
            [actorId, userIds],
          );
        }
      });

      if (!restoredVendor) {
        return res.status(404).json({ error: `${this.errorLabel} not found or already active` });
      }
      res.status(200).json({ message: `${this.errorLabel} marked as active` });
    } catch (err) {
      this.handleError(err, res, 'restoring', this.errorLabel);
    }
  }

  /**
   * POST /export-combined-xls — export vendors + vendor contacts into a single workbook.
   */
  async exportCombinedXls(req, res) {
    const timestamp = Date.now();
    const path = `/tmp/vendors_combined_${timestamp}.xlsx`;
    const where = Array.isArray(req.body?.where) ? req.body.where : [];
    const joinType = req.body?.joinType || 'AND';
    const options = req.body?.options || {};

    try {
      const result = await this.model(this.getSchema(req)).exportCombinedSpreadsheet(path, where, joinType, options);
      res.download(result.filePath, `vendors_combined_${timestamp}.xlsx`, (err) => {
        if (err) logger.error(`Error sending file: ${err.message}`);
        fs.unlink(result.filePath, (unlinkErr) => {
          if (unlinkErr) logger.error(`Failed to delete exported file: ${unlinkErr.message}`);
        });
      });
    } catch (err) {
      this.handleError(err, res, 'exporting', this.errorLabel);
    }
  }

  /**
   * POST /import-combined-xls — import vendors + vendor contacts from the
   * flat 2-sheet workbook (Vendors sheet + Vendor Contacts sheet).
   *
   * Pass `?preview=1` to receive a counts-only classification (vendors +
   * contacts buckets) without any DB writes.
   */
  async importCombinedXls(req, res) {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const tenantCode = req.user?.tenant_code;
    const previewOnly = req.query.preview === '1' || req.query.preview === 'true';

    try {
      const result = await this.model(this.getSchema(req)).importCombinedSpreadsheet(
        file.path,
        (row) => ({
          ...row,
          tenant_code: tenantCode,
          created_by: req.user?.id || null,
        }),
        { previewOnly },
      );
      if (result?.errors?.length) return res.status(422).json(result);
      if (result?.preview) return res.status(200).json(result);
      res.json(result);
    } catch (err) {
      this.handleError(err, res, 'importing', this.errorLabel);
    } finally {
      fs.unlink(file.path, (unlinkErr) => {
        if (unlinkErr) logger.error(`Failed to delete uploaded file: ${unlinkErr.message}`);
      });
    }
  }
}

const instance = new VendorsController();
export default instance;
export { VendorsController };
