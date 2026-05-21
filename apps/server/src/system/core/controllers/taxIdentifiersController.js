/**
 * @file Tax identifiers controller — CRUD for typed tax IDs linked via sources
 * @module core/controllers/taxIdentifiersController
 *
 * NOTE: the standard `PATCH /restore` endpoint inherited from
 * `BaseController` via `createRouter` exists on this resource (and a
 * contract test exercises it), but the client UI deliberately does not
 * call it. Soft-deleted tax identifier rows are restored by re-importing
 * the parent's workbook (the importer matches archived rows by slot key
 * then by value key and resurrects them in place). See
 * `docs/decisions/0026-child-restore-via-import.md`.
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
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
