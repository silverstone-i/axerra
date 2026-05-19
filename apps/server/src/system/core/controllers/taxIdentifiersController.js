/**
 * @file Tax identifiers controller — CRUD for typed tax IDs linked via sources
 * @module core/controllers/taxIdentifiersController
 *
 * NOTE: there is intentionally NO `PATCH /:id/restore` route. Soft-deleted
 * tax identifier rows are restored by re-importing the parent's workbook
 * (the importer matches archived rows by id then by value/slot key and
 * resurrects them in place). See `docs/decisions/0026-child-restore-via-import.md`.
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import BaseController from '../../../lib/BaseController.js';

class TaxIdentifiersController extends BaseController {
  constructor() {
    super('taxIdentifiers');
    this.rbacConfig = { module: 'core', router: 'tax-identifiers' };
  }

  async create(req, res) {
    if (!req.body.tenant_id && req.user?.tenant_id) {
      req.body.tenant_id = req.user.tenant_id;
    }
    return super.create(req, res);
  }
}

const instance = new TaxIdentifiersController();
export default instance;
export { TaxIdentifiersController };
