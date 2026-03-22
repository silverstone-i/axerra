/**
 * @file Clients controller — auto-creates sources record, manages is_app_user lifecycle
 * @module core/controllers/clientsController
 *
 * When is_app_user is toggled ON, provisions a nap_users record in admin schema
 * with entity_type='client' and entity_id pointing to the client row.
 * When toggled OFF or archived, cascades to lock the linked nap_user.
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
 */

import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import BaseController from '../../../lib/BaseController.js';
import db, { pgp } from '../../../db/db.js';
import { allocateNumber } from '../services/numberingService.js';
import { invalidateByEntity } from '../../../services/permCacheInvalidator.js';
import logger from '../../../lib/logger.js';

class ClientsController extends BaseController {
  constructor() {
    super('clients');
    this.rbacConfig = { module: 'core', router: 'clients' };
  }

  /**
   * POST / — insert a client and auto-create a linked sources record.
   * If is_app_user is true, also provisions a nap_users login account.
   */
  async create(req, res) {
    try {
      const schema = this.getSchema(req);
      const s = pgp.as.name(schema);

      // Inject tenant_id from authenticated session
      if (!req.body.tenant_id && req.user?.tenant_id) {
        req.body.tenant_id = req.user.tenant_id;
      }

      // Normalize empty code to null — avoids unique constraint violation on ''
      if (req.body.code !== undefined && !req.body.code?.trim()) req.body.code = null;

      // Extract email before insert — it goes in the emails table, not the clients table
      const suppliedEmail = req.body.email;
      delete req.body.email;

      // Validate: roles must be non-empty before is_app_user can be true
      if (req.body.is_app_user) {
        const roles = req.body.roles || [];
        if (!roles.length) {
          return res.status(400).json({ error: 'Roles must be assigned before enabling app user access' });
        }
        if (!suppliedEmail) {
          return res.status(400).json({ error: 'Email is required to enable app user access' });
        }
      }

      // Extract password before insert — it's for nap_users, not the clients table
      const suppliedPassword = req.body.password;
      delete req.body.password;

      const record = await db.tx(async (t) => {
        const clientsModel = this.model(schema);
        clientsModel.tx = t;

        // 1. Insert the client
        const client = await clientsModel.insert(req.body);

        // 2. Auto-create a sources record linking to this client
        const sourcesModel = db('sources', schema);
        sourcesModel.tx = t;
        const source = await sourcesModel.insert({
          tenant_id: client.tenant_id,
          table_id: client.id,
          source_type: 'client',
          label: client.name,
          created_by: req.body.created_by || null,
        });

        // 3. Link the source back to the client
        await t.none(
          `UPDATE ${s}.clients SET source_id = $1, updated_by = $2 WHERE id = $3`,
          [source.id, req.body.created_by || null, client.id],
        );

        // 4. Auto-assign code via numbering service (if enabled and code not provided)
        if (!client.code) {
          const numbering = await allocateNumber(schema, 'client', null, new Date(), t);
          if (numbering) {
            await t.none(`UPDATE ${s}.clients SET code = $1 WHERE id = $2`, [numbering.displayId, client.id]);
            client.code = numbering.displayId;
          }
        }

        // 5. Create email record if provided
        if (suppliedEmail) {
          const emailsModel = db('emails', schema);
          emailsModel.tx = t;
          await emailsModel.insert({
            tenant_id: client.tenant_id,
            source_id: source.id,
            email: suppliedEmail,
            label: 'work',
            is_primary: true,
            is_login: !!req.body.is_app_user,
            created_by: req.body.created_by || null,
          });
        }

        return { ...client, source_id: source.id };
      });

      // 6. If is_app_user, create the nap_users login record
      if (record.is_app_user && suppliedEmail) {
        await this.#provisionAppUser(record, req, suppliedPassword, suppliedEmail);
      }

      res.status(201).json(record);
    } catch (err) {
      if (err.name === 'SchemaDefinitionError') err.message = 'Invalid input data';
      this.handleError(err, res, 'creating', this.errorLabel);
    }
  }

  /**
   * PUT /update — update client and manage is_app_user toggle.
   */
  async update(req, res) {
    const schema = this.getSchema(req);
    const clientId = req.query.id;

    if (!clientId) {
      return res.status(400).json({ error: 'id query parameter is required' });
    }

    try {
      // Fetch client BEFORE update to detect is_app_user toggle
      const before = await this.model(schema).findById(clientId);
      if (!before) return res.status(404).json({ error: `${this.errorLabel} not found` });

      // Normalize empty code to null — avoids unique constraint violation on ''
      if (req.body.code !== undefined && !req.body.code?.trim()) req.body.code = null;

      // Detect is_app_user toggle — validate BEFORE persisting the update
      const wasAppUser = !!before.is_app_user;
      const isNowAppUser = req.body.is_app_user !== undefined ? !!req.body.is_app_user : wasAppUser;

      // Extract email — it's managed in the emails table, not the clients table.
      const suppliedEmail = req.body.email;
      delete req.body.email;

      if (suppliedEmail && !(!wasAppUser && isNowAppUser)) {
        return res.status(400).json({
          error: 'Email is managed via /api/core/v1/emails. Use that endpoint to update email addresses.',
        });
      }

      // Extract password before update — it's for nap_users, not the clients table
      const suppliedPassword = req.body.password;
      delete req.body.password;

      // Resolve login email from the emails table — prefer is_login, fall back to is_primary
      const s = pgp.as.name(schema);
      const loginEmail = await db.oneOrNone(
        `SELECT id, email, is_login FROM ${s}.emails
         WHERE source_id = $1 AND deactivated_at IS NULL
         AND (is_login = true OR is_primary = true)
         ORDER BY is_login DESC, is_primary DESC LIMIT 1`,
        [before.source_id],
      );
      const hasLoginEmail = loginEmail?.is_login;
      const resolvedEmail = suppliedEmail || loginEmail?.email;

      if (!wasAppUser && isNowAppUser) {
        const roles = req.body.roles || before.roles || [];
        if (!roles.length) {
          return res.status(400).json({ error: 'Roles must be assigned before enabling app user access' });
        }
        if (!resolvedEmail) {
          return res.status(400).json({ error: 'A login email is required to enable app user access' });
        }
      }

      // Apply the standard update
      const count = await this.model(schema).updateWhere([{ id: clientId }], req.body);
      if (!count) return res.status(404).json({ error: `${this.errorLabel} not found` });

      if (!wasAppUser && isNowAppUser) {
        // Toggled ON: provision or restore nap_user
        if (suppliedEmail && !loginEmail) {
          const emailsModel = db('emails', schema);
          await emailsModel.insert({
            tenant_id: before.tenant_id,
            source_id: before.source_id,
            email: suppliedEmail,
            label: 'work',
            is_primary: true,
            is_login: true,
            created_by: req.user?.id || null,
          });
        } else if (loginEmail && !hasLoginEmail) {
          const updatedBy = req.user?.id || null;
          const emailUpdate = suppliedEmail && suppliedEmail !== loginEmail.email
            ? `UPDATE ${s}.emails SET is_login = true, email = $2, updated_by = $3 WHERE id = $1`
            : `UPDATE ${s}.emails SET is_login = true, updated_by = $2 WHERE id = $1`;
          const emailParams = suppliedEmail && suppliedEmail !== loginEmail.email
            ? [loginEmail.id, suppliedEmail, updatedBy]
            : [loginEmail.id, updatedBy];
          await db.none(emailUpdate, emailParams);
        }
        const updatedClient = { ...before, ...req.body, id: before.id };
        await this.#provisionAppUser(updatedClient, req, suppliedPassword, resolvedEmail);
      } else if (wasAppUser && !isNowAppUser) {
        // Toggled OFF: archive the linked nap_user
        await this.#archiveAppUser(before.id, req);
      }

      // Flush permission cache if roles changed
      if (req.body.roles !== undefined) {
        await invalidateByEntity('client', clientId, req.user?.tenant_code);
      }

      res.json({ updatedRecords: count });
    } catch (err) {
      if (err.name === 'SchemaDefinitionError') err.message = 'Invalid input data';
      this.handleError(err, res, 'updating', this.errorLabel);
    }
  }

  /**
   * DELETE /archive — soft-delete client, cascade to nap_users if is_app_user.
   */
  async archive(req, res) {
    const schema = this.getSchema(req);
    const clientId = req.query.id;

    req.body.deactivated_at = new Date();
    try {
      // Cascade to nap_user before archiving client
      if (clientId) {
        const client = await this.model(schema).findById(clientId);
        if (client?.is_app_user) {
          await this.#archiveAppUser(client.id, req);
        }
      }

      const filters = Array.isArray(req.query) ? req.query : [{ ...req.query }];
      const count = await this.model(schema).updateWhere(filters, req.body);
      if (!count) return res.status(404).json({ error: `${this.errorLabel} not found or already inactive` });
      res.status(200).json({ message: `${this.errorLabel} marked as inactive` });
    } catch (err) {
      this.handleError(err, res, 'archiving', this.errorLabel);
    }
  }

  /**
   * PATCH /restore — restore client, cascade to nap_users if is_app_user.
   */
  async restore(req, res) {
    const schema = this.getSchema(req);
    const clientId = req.query.id;

    req.body.deactivated_at = null;
    const filters = [{ deactivated_at: { $not: null } }, { ...req.query }];

    try {
      const count = await this.model(schema).updateWhere(filters, req.body, { includeDeactivated: true });
      if (!count) return res.status(404).json({ error: `${this.errorLabel} not found or already active` });

      // Cascade restore to nap_user if client is an app user
      if (clientId) {
        const client = await this.model(schema).findById(clientId);
        if (client?.is_app_user) {
          await this.#restoreAppUser(client.id, req);
        }
      }

      res.status(200).json({ message: `${this.errorLabel} marked as active` });
    } catch (err) {
      this.handleError(err, res, 'restoring', this.errorLabel);
    }
  }

  /**
   * POST /:id/reset-password — admin reset password for a client's app user account.
   */
  async resetPassword(req, res) {
    const clientId = req.params.id;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'password is required' });
    }

    const pwRules = [
      { test: (p) => p.length >= 8, msg: 'at least 8 characters' },
      { test: (p) => /[A-Z]/.test(p), msg: 'an uppercase letter' },
      { test: (p) => /[a-z]/.test(p), msg: 'a lowercase letter' },
      { test: (p) => /[0-9]/.test(p), msg: 'a digit' },
      { test: (p) => /[^A-Za-z0-9]/.test(p), msg: 'a special character' },
    ];
    const failures = pwRules.filter((r) => !r.test(password)).map((r) => r.msg);
    if (failures.length) {
      return res.status(400).json({ error: `Password must contain ${failures.join(', ')}` });
    }

    try {
      const tenantId = req.user?.tenant_id;
      const napUser = await db.oneOrNone(
        `SELECT id FROM admin.nap_users
         WHERE entity_type = 'client' AND entity_id = $1 AND tenant_id = $2 AND deactivated_at IS NULL`,
        [clientId, tenantId],
      );

      if (!napUser) {
        return res.status(404).json({ error: 'No active app user account found for this client' });
      }

      const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
      const hash = await bcrypt.hash(password, rounds);
      await db.none(
        'UPDATE admin.nap_users SET password_hash = $/hash/, updated_by = $/updatedBy/ WHERE id = $/id/',
        { hash, updatedBy: req.user?.id || null, id: napUser.id },
      );

      logger.info(`Admin reset password for nap_user ${napUser.id} (client ${clientId})`);
      res.json({ message: 'Password reset successfully' });
    } catch (err) {
      this.handleError(err, res, 'resetting password for', this.errorLabel);
    }
  }

  /* ── Private helpers ──────────────────────────────────── */

  /**
   * Create or restore a nap_users record for a client gaining app access.
   */
  async #provisionAppUser(client, req, suppliedPassword, loginEmail) {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) throw new Error('Tenant context required to provision app user');

    // Validate supplied password strength (if provided)
    if (suppliedPassword) {
      const pwRules = [
        { test: (p) => p.length >= 8, msg: 'at least 8 characters' },
        { test: (p) => /[A-Z]/.test(p), msg: 'an uppercase letter' },
        { test: (p) => /[a-z]/.test(p), msg: 'a lowercase letter' },
        { test: (p) => /[0-9]/.test(p), msg: 'a digit' },
        { test: (p) => /[^A-Za-z0-9]/.test(p), msg: 'a special character' },
      ];
      const failures = pwRules.filter((r) => !r.test(suppliedPassword)).map((r) => r.msg);
      if (failures.length) {
        const err = new Error(`Password must contain ${failures.join(', ')}`);
        err.status = 400;
        throw err;
      }
    }

    // Check if an archived nap_user already exists for this client
    const existing = await db.oneOrNone(
      `SELECT id, deactivated_at FROM admin.nap_users
       WHERE entity_type = 'client' AND entity_id = $1 AND tenant_id = $2`,
      [client.id, tenantId],
    );

    const clearPassword = suppliedPassword || crypto.randomBytes(12).toString('base64url');
    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
    const passwordHash = await bcrypt.hash(clearPassword, rounds);

    if (existing) {
      // Restore the archived record
      await db.none(
        `UPDATE admin.nap_users
         SET deactivated_at = NULL, status = 'invited',
             password_hash = $1, email = $2, updated_by = $3
         WHERE id = $4`,
        [passwordHash, loginEmail, req.user?.id || null, existing.id],
      );
      logger.info(`Restored nap_user ${existing.id} for client ${client.id}`);
      return existing.id;
    }

    // Create a new nap_users record
    const user = await db('napUsers', 'admin').insert({
      tenant_id: tenantId,
      entity_type: 'client',
      entity_id: client.id,
      email: loginEmail,
      password_hash: passwordHash,
      status: 'invited',
      created_by: req.user?.id || null,
    });

    logger.info(`Provisioned nap_user ${user.id} for client ${client.id}`);
    return user.id;
  }

  /**
   * Archive (soft-delete) the nap_users record linked to a client.
   */
  async #archiveAppUser(clientId, req) {
    const napUser = await db.oneOrNone(
      `SELECT id FROM admin.nap_users
       WHERE entity_type = 'client' AND entity_id = $1 AND tenant_id = $2 AND deactivated_at IS NULL`,
      [clientId, req.user?.tenant_id],
    );
    if (napUser) {
      await db.none(
        `UPDATE admin.nap_users
         SET deactivated_at = NOW(), status = 'locked', updated_by = $1
         WHERE id = $2`,
        [req.user?.id || null, napUser.id],
      );
      logger.info(`Archived nap_user ${napUser.id} for client ${clientId}`);
    }
  }

  /**
   * Restore the nap_users record linked to a client.
   */
  async #restoreAppUser(clientId, req) {
    const napUser = await db.oneOrNone(
      `SELECT id FROM admin.nap_users
       WHERE entity_type = 'client' AND entity_id = $1 AND tenant_id = $2 AND deactivated_at IS NOT NULL`,
      [clientId, req.user?.tenant_id],
    );
    if (napUser) {
      await db.none(
        `UPDATE admin.nap_users
         SET deactivated_at = NULL, status = 'active', updated_by = $1
         WHERE id = $2`,
        [req.user?.id || null, napUser.id],
      );
      logger.info(`Restored nap_user ${napUser.id} for client ${clientId}`);
    }
  }
}

const instance = new ClientsController();
export default instance;
export { ClientsController };
