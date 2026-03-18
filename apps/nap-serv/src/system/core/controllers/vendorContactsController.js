/**
 * @file Vendor contacts controller — auto-creates sources record on creation
 * @module core/controllers/vendorContactsController
 *
 * Each vendor contact gets its own sources record (source_type = 'vendor_contact')
 * so that emails and phone numbers can be linked via the polymorphic pattern.
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
 */

import BaseController from '../../../lib/BaseController.js';
import db, { pgp } from '../../../db/db.js';

class VendorContactsController extends BaseController {
  constructor() {
    super('vendorContacts');
    this.rbacConfig = { module: 'core', router: 'vendor-contacts' };
  }

  /**
   * POST / — insert a vendor contact and auto-create a linked sources record.
   */
  async create(req, res) {
    try {
      const schema = this.getSchema(req);
      const s = pgp.as.name(schema);

      if (!req.body.tenant_id && req.user?.tenant_id) {
        req.body.tenant_id = req.user.tenant_id;
      }

      const record = await db.tx(async (t) => {
        const model = this.model(schema);
        model.tx = t;

        // 1. Insert the vendor contact
        const contact = await model.insert(req.body);

        // 2. Auto-create a sources record
        const sourcesModel = db('sources', schema);
        sourcesModel.tx = t;
        const source = await sourcesModel.insert({
          tenant_id: contact.tenant_id,
          table_id: contact.id,
          source_type: 'vendor_contact',
          label: `${contact.first_name} ${contact.last_name}`,
          created_by: req.body.created_by || null,
        });

        // 3. Link the source back
        await t.none(
          `UPDATE ${s}.vendor_contacts SET source_id = $1, updated_by = $2 WHERE id = $3`,
          [source.id, req.body.created_by || null, contact.id],
        );

        return { ...contact, source_id: source.id };
      });

      res.status(201).json(record);
    } catch (err) {
      if (err.name === 'SchemaDefinitionError') err.message = 'Invalid input data';
      this.handleError(err, res, 'creating', this.errorLabel);
    }
  }
}

const instance = new VendorContactsController();
export default instance;
export { VendorContactsController };
