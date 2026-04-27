/**
 * @file Sources controller — standard CRUD + orphan cleanup for the polymorphic sources table
 * @module core/controllers/sourcesController
 *
 * Sources are typically auto-created by vendor/client/employee controllers.
 * This controller provides read access, manual management, and per-tenant
 * orphan-source maintenance.
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import db, { pgp } from '../../../db/db.js';
import logger from '../../../lib/logger.js';
import BaseController from '../../../lib/BaseController.js';

class SourcesController extends BaseController {
  constructor() {
    super('sources');
  }

  /**
   * GET /orphan-cleanup — read-only preview of orphaned sources in the caller's
   * tenant schema. An orphan is a `sources` row whose `(source_type, table_id)`
   * doesn't resolve to a live row in the corresponding entity table.
   */
  async findOrphanSources(req, res) {
    try {
      const schema = this.getSchema(req);
      const s = pgp.as.name(schema);
      const orphans = await db.any(`SELECT * FROM ${s}.find_orphan_sources()`);
      res.json({ schema, count: orphans.length, orphans });
    } catch (err) {
      this.handleError(err, res, 'previewing orphan sources', this.errorLabel);
    }
  }

  /**
   * POST /orphan-cleanup — delete orphaned sources in the caller's tenant
   * schema. Cascades through child tables (emails, phone_numbers, addresses,
   * tax_identifiers) via existing FK ON DELETE CASCADE. Returns the rows that
   * were removed.
   */
  async cleanupOrphanSources(req, res) {
    try {
      const schema = this.getSchema(req);
      const s = pgp.as.name(schema);
      const removed = await db.tx((t) => t.any(`SELECT * FROM ${s}.cleanup_orphan_sources()`));
      logger.info('orphan-source-cleanup', {
        schema,
        actor_id: req.user?.id,
        impersonated_by: req.user?.impersonated_by ?? null,
        count: removed.length,
        removed_ids: removed.map((r) => r.source_id),
      });
      res.json({ schema, count: removed.length, removed });
    } catch (err) {
      this.handleError(err, res, 'cleaning up orphan sources', this.errorLabel);
    }
  }
}

const instance = new SourcesController();
export default instance;
export { SourcesController };
