/**
 * @file Addresses controller — standard CRUD for addresses linked via sources
 * @module core/controllers/addressesController
 *
 * NOTE: the standard `PATCH /restore` endpoint inherited from
 * `BaseController` via `createRouter` exists on this resource, but the
 * client UI deliberately does not call it. Soft-deleted address rows
 * are restored by re-importing the parent's workbook (the importer
 * matches archived rows by slot key then by value key and resurrects
 * them in place). See `docs/decisions/0026-child-restore-via-import.md`.
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import BaseController from '../../../lib/BaseController.js';

class AddressesController extends BaseController {
  constructor() {
    super('addresses');
  }

  async create(req, res) {
    if (!req.body.tenant_id && req.user?.tenant_id) {
      req.body.tenant_id = req.user.tenant_id;
    }
    return super.create(req, res);
  }
}

const instance = new AddressesController();
export default instance;
export { AddressesController };
