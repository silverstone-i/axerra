/**
 * @file Phone numbers controller — CRUD with single-primary enforcement
 * @module core/controllers/phoneNumbersController
 *
 * NOTE: there is intentionally NO `PATCH /:id/restore` route. Soft-deleted
 * phone rows are restored by re-importing the parent's workbook (the
 * importer matches archived rows by slot key then by value key and
 * resurrects them in place). See `docs/decisions/0026-child-restore-via-import.md`.
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import BaseController from '../../../lib/BaseController.js';
import { clearOtherPrimary } from '../../../lib/clearOtherPrimary.js';
import db from '../../../db/db.js';

class PhoneNumbersController extends BaseController {
  constructor() {
    super('phoneNumbers');
  }

  async create(req, res) {
    if (!req.body.tenant_id && req.user?.tenant_id) {
      req.body.tenant_id = req.user.tenant_id;
    }

    try {
      const schema = this.getSchema(req);

      // Clear sibling is_primary before insert
      if (req.body.is_primary && req.body.source_id) {
        await clearOtherPrimary(db, schema, 'phone_numbers', 'source_id', req.body.source_id, null, req.user?.id);
      }

      const record = await this.model(schema).insert(req.body);
      res.status(201).json(record);
    } catch (err) {
      if (err.name === 'SchemaDefinitionError') err.message = 'Invalid input data';
      this.handleError(err, res, 'creating', this.errorLabel);
    }
  }

  async update(req, res) {
    const schema = this.getSchema(req);
    const recordId = req.query.id;

    if (!recordId) {
      return res.status(400).json({ error: 'id query parameter is required' });
    }

    try {
      const before = await this.model(schema).findById(recordId);
      if (!before) return res.status(404).json({ error: `${this.errorLabel} not found` });

      // Clear sibling is_primary before update
      if (req.body.is_primary && !before.is_primary) {
        await clearOtherPrimary(db, schema, 'phone_numbers', 'source_id', before.source_id, before.id, req.user?.id);
      }

      const count = await this.model(schema).updateWhere([{ id: recordId }], req.body);
      if (!count) return res.status(404).json({ error: `${this.errorLabel} not found` });
      res.json({ updatedRecords: count });
    } catch (err) {
      if (err.name === 'SchemaDefinitionError') err.message = 'Invalid input data';
      this.handleError(err, res, 'updating', this.errorLabel);
    }
  }
}

const instance = new PhoneNumbersController();
export default instance;
export { PhoneNumbersController };
