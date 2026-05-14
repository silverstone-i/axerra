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
          created_by: req.body.created_by || null,
          updated_by: req.body.created_by || null,
        });

        // 3. Link the source back to the vendor
        await t.none(
          `UPDATE ${s}.vendors SET source_id = $1, updated_by = $2 WHERE id = $3`,
          [source.id, req.body.created_by || null, vendor.id],
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
   * POST /import-combined-xls — import vendors + vendor contacts from a combined workbook.
   * Auto-detects format: 10-sheet combined or legacy 5-sheet vendor-only.
   */
  async importCombinedXls(req, res) {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const tenantCode = req.user?.tenant_code;
    const index = Number(req.body?.sheetIndex ?? 0);

    try {
      const result = await this.model(this.getSchema(req)).importCombinedSpreadsheet(file.path, index, (row) => ({
        ...row,
        tenant_code: tenantCode,
        created_by: req.user?.id || null,
      }));
      if (result.errors) return res.status(422).json(result);
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
