/**
 * @file Companies controller — auto-creates a sources record on creation
 * @module core/controllers/companiesController
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
 */

import BaseController from '../../../lib/BaseController.js';
import db, { pgp } from '../../../db/db.js';

class CompaniesController extends BaseController {
  constructor() {
    super('companies');
    this.rbacConfig = { module: 'core', router: 'companies' };
  }

  /**
   * POST / — insert company with auto-created sources record.
   */
  async create(req, res) {
    try {
      const schema = this.getSchema(req);
      const s = pgp.as.name(schema);

      if (!req.body.tenant_id && req.user?.tenant_id) {
        req.body.tenant_id = req.user.tenant_id;
      }

      const record = await db.tx(async (t) => {
        const companyModel = this.model(schema);
        companyModel.tx = t;

        const company = await companyModel.insert(req.body);

        const sourcesModel = db('sources', schema);
        sourcesModel.tx = t;
        const source = await sourcesModel.insert({
          tenant_id: company.tenant_id,
          table_id: company.id,
          source_type: 'company',
          label: company.name,
          created_by: req.body.created_by || null,
        });

        await t.none(
          `UPDATE ${s}.companies SET source_id = $1, updated_by = $2 WHERE id = $3`,
          [source.id, req.body.created_by || null, company.id],
        );

        return { ...company, source_id: source.id };
      });

      res.status(201).json(record);
    } catch (err) {
      if (err.name === 'SchemaDefinitionError') err.message = 'Invalid input data';
      this.handleError(err, res, 'creating', this.errorLabel);
    }
  }
}

const instance = new CompaniesController();
export default instance;
export { CompaniesController };
