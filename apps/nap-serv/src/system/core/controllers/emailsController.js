/**
 * @file Emails controller — CRUD with is_login sync to nap_users
 * @module core/controllers/emailsController
 *
 * When an email with is_login=true is created or updated, the change
 * is synced to the corresponding admin.nap_users record. Archive of a
 * login email is blocked while the entity is an active app user.
 *
 * Copyright (c) 2025 – present Vimber LLC. All rights reserved.
 */

import BaseController from '../../../lib/BaseController.js';
import { clearOtherPrimary } from '../../../lib/clearOtherPrimary.js';
import db, { pgp } from '../../../db/db.js';
import logger from '../../../lib/logger.js';

class EmailsController extends BaseController {
  constructor() {
    super('emails');
    this.rbacConfig = { module: 'core', router: 'emails' };
  }

  async create(req, res) {
    if (!req.body.tenant_id && req.user?.tenant_id) {
      req.body.tenant_id = req.user.tenant_id;
    }

    try {
      const schema = this.getSchema(req);

      // If is_login, validate no other is_login email exists for this source
      if (req.body.is_login && req.body.source_id) {
        const existing = await this.model(schema).findOneBy([{
          source_id: req.body.source_id,
          is_login: true,
        }]);
        if (existing) {
          return res.status(400).json({ error: 'Only one login email is allowed per entity. Remove the existing login email first.' });
        }
      }

      // Clear sibling is_primary before insert (partial unique index is the safety net)
      if (req.body.is_primary && req.body.source_id) {
        await clearOtherPrimary(db, schema, 'emails', 'source_id', req.body.source_id, null, req.user?.id);
      }

      const record = await this.model(schema).insert(req.body);

      // Sync login email to nap_users
      if (record.is_login) {
        await this.#syncLoginEmail(schema, record.source_id, record.email, req);
      }

      res.status(201).json(record);
    } catch (err) {
      this.handleError(err, res, 'creating', this.errorLabel);
    }
  }

  async update(req, res) {
    const schema = this.getSchema(req);
    const emailId = req.query.id;

    if (!emailId) {
      return res.status(400).json({ error: 'id query parameter is required' });
    }

    try {
      const before = await this.model(schema).findById(emailId);
      if (!before) return res.status(404).json({ error: `${this.errorLabel} not found` });

      // If setting is_login to true, check no other login email exists
      if (req.body.is_login && !before.is_login) {
        const existing = await this.model(schema).findOneBy([{
          source_id: before.source_id,
          is_login: true,
        }]);
        if (existing) {
          return res.status(400).json({ error: 'Only one login email is allowed per entity. Remove the existing login email first.' });
        }
      }

      // If unsetting is_login, verify the entity is not an app user
      if (req.body.is_login === false && before.is_login) {
        const canUnset = await this.#canUnsetLogin(schema, before.source_id);
        if (!canUnset) {
          return res.status(400).json({ error: 'Cannot remove login flag while entity is an active app user' });
        }
      }

      // Clear sibling is_primary before update (partial unique index is the safety net)
      if (req.body.is_primary && !before.is_primary) {
        await clearOtherPrimary(db, schema, 'emails', 'source_id', before.source_id, before.id, req.user?.id);
      }

      const count = await this.model(schema).updateWhere([{ id: emailId }], req.body);
      if (!count) return res.status(404).json({ error: `${this.errorLabel} not found` });

      // Sync to nap_users if login email changed
      const updatedEmail = req.body.email || before.email;
      const isNowLogin = req.body.is_login !== undefined ? req.body.is_login : before.is_login;

      if (isNowLogin && (req.body.email || req.body.is_login)) {
        await this.#syncLoginEmail(schema, before.source_id, updatedEmail, req);
      }

      res.json({ updatedRecords: count });
    } catch (err) {
      this.handleError(err, res, 'updating', this.errorLabel);
    }
  }

  async archive(req, res) {
    const schema = this.getSchema(req);

    try {
      // Fetch all matching rows and block if any is a login email for an active app user
      const filters = Array.isArray(req.query) ? req.query : [{ ...req.query }];
      const matching = await this.model(schema).findWhere(filters);
      for (const email of matching) {
        if (email.is_login) {
          const canUnset = await this.#canUnsetLogin(schema, email.source_id);
          if (!canUnset) {
            return res.status(400).json({ error: 'Cannot archive the login email while entity is an active app user' });
          }
        }
      }

      req.body.deactivated_at = new Date();
      const count = await this.model(schema).updateWhere(filters, req.body);
      if (!count) return res.status(404).json({ error: `${this.errorLabel} not found or already inactive` });
      res.status(200).json({ message: `${this.errorLabel} marked as inactive` });
    } catch (err) {
      this.handleError(err, res, 'archiving', this.errorLabel);
    }
  }

  /**
   * Sync the login email to admin.nap_users for the entity linked to this source.
   */
  async #syncLoginEmail(schema, sourceId, email, req) {
    const s = pgp.as.name(schema);
    try {
      // Find the source to get the entity type and id
      const source = await db.oneOrNone(
        `SELECT table_id, source_type FROM ${s}.sources WHERE id = $1 AND deactivated_at IS NULL`,
        [sourceId],
      );
      if (!source) return;

      // Only employees sync to nap_users currently
      if (source.source_type !== 'employee') return;

      await db.none(
        `UPDATE admin.nap_users SET email = $1, updated_by = $2
         WHERE entity_type = 'employee' AND entity_id = $3 AND deactivated_at IS NULL`,
        [email, req.user?.id || null, source.table_id],
      );
    } catch (err) {
      logger.error('Failed to sync login email to nap_users', { sourceId, email, error: err.message });
      throw err;
    }
  }

  /**
   * Check whether the login flag can be removed — deny if the entity is an active app user.
   */
  async #canUnsetLogin(schema, sourceId) {
    const s = pgp.as.name(schema);
    const source = await db.oneOrNone(
      `SELECT table_id, source_type FROM ${s}.sources WHERE id = $1 AND deactivated_at IS NULL`,
      [sourceId],
    );
    if (!source || source.source_type !== 'employee') return true;

    const employee = await db.oneOrNone(
      `SELECT is_app_user FROM ${s}.employees WHERE id = $1 AND deactivated_at IS NULL`,
      [source.table_id],
    );
    return !employee?.is_app_user;
  }
}

const instance = new EmailsController();
export default instance;
export { EmailsController };
