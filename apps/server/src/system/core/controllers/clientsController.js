/**
 * @file Clients controller — auto-creates sources record, manages is_app_user lifecycle
 * @module core/controllers/clientsController
 *
 * When is_app_user is toggled ON, provisions a portal_users record in admin schema
 * with entity_type='client' and entity_id pointing to the client row.
 * When toggled OFF or archived, cascades to lock the linked portal_user.
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import BaseController from '../../../lib/BaseController.js';
import db, { pgp } from '../../../db/db.js';
import { allocateNumber } from '../services/numberingService.js';
import { invalidateByEntity } from '../../../services/permCacheInvalidator.js';
import { findActiveBinding, findAnyBinding } from '../../auth/services/index.js';
import logger from '../../../lib/logger.js';

class ClientsController extends BaseController {
  constructor() {
    super('clients');
    this.rbacConfig = { module: 'core', router: 'clients' };
  }

  /**
   * POST / — insert a client and auto-create a linked sources record.
   * If is_app_user is true, also provisions a portal_users login account.
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

      // Extract password before insert — it's for portal_users, not the clients table
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
        });

        // 3. Link the source back to the client
        await t.none(`UPDATE ${s}.clients SET source_id = $1, updated_by = $2 WHERE id = $3`, [
          source.id,
          req.user?.id ?? null,
          client.id,
        ]);

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
          });
        }

        return { ...client, source_id: source.id };
      });

      // 6. If is_app_user, create the portal_users login record
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

      if (suppliedEmail && !isNowAppUser) {
        return res.status(400).json({
          error: 'Email is managed via /api/core/v1/emails. Use that endpoint to update email addresses.',
        });
      }

      // Extract password before update — it's for portal_users, not the clients table
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

      // Determine if provisioning is needed (fresh toggle or retry after partial failure)
      const needsProvisioning =
        isNowAppUser && (!wasAppUser || !(await findActiveBinding('client', before.id, req.user?.tenant_id)));

      if (needsProvisioning) {
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

      if (needsProvisioning) {
        // Toggled ON: provision or restore portal_user
        if (suppliedEmail && !loginEmail) {
          // Check if the email already exists (without is_login/is_primary flags)
          const existingEmail = await db.oneOrNone(
            `SELECT id FROM ${s}.emails WHERE source_id = $1 AND email = $2 AND deactivated_at IS NULL`,
            [before.source_id, suppliedEmail],
          );
          if (existingEmail) {
            await db.none(`UPDATE ${s}.emails SET is_login = true, is_primary = true, updated_by = $1 WHERE id = $2`, [
              req.user?.id || null,
              existingEmail.id,
            ]);
          } else {
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
          }
        } else if (loginEmail && !hasLoginEmail) {
          const updatedBy = req.user?.id || null;
          const emailUpdate =
            suppliedEmail && suppliedEmail !== loginEmail.email
              ? `UPDATE ${s}.emails SET is_login = true, email = $2, updated_by = $3 WHERE id = $1`
              : `UPDATE ${s}.emails SET is_login = true, updated_by = $2 WHERE id = $1`;
          const emailParams =
            suppliedEmail && suppliedEmail !== loginEmail.email ? [loginEmail.id, suppliedEmail, updatedBy] : [loginEmail.id, updatedBy];
          await db.none(emailUpdate, emailParams);
        }
        const updatedClient = { ...before, ...req.body, id: before.id };
        await this.#provisionAppUser(updatedClient, req, suppliedPassword, resolvedEmail);
      } else if (wasAppUser && !isNowAppUser) {
        // Toggled OFF: archive the linked portal_user
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
   * DELETE /archive — soft-delete client, cascade to portal_users if is_app_user.
   */
  async archive(req, res) {
    const schema = this.getSchema(req);
    const clientId = req.query.id;

    req.body.deactivated_at = new Date();
    try {
      // Cascade to portal_user before archiving client
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
   * PATCH /restore — restore client, cascade to portal_users if is_app_user.
   */
  async restore(req, res) {
    const schema = this.getSchema(req);
    const clientId = req.query.id;

    req.body.deactivated_at = null;
    const filters = [{ deactivated_at: { $not: null } }, { ...req.query }];

    try {
      const count = await this.model(schema).updateWhere(filters, req.body, { includeDeactivated: true });
      if (!count) return res.status(404).json({ error: `${this.errorLabel} not found or already active` });

      // Cascade restore to portal_user if client is an app user
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
      const binding = await findActiveBinding('client', clientId, req.user?.tenant_id);
      if (!binding) {
        return res.status(404).json({ error: 'No active app user account found for this client' });
      }

      const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
      const hash = await bcrypt.hash(password, rounds);
      await db.none('UPDATE admin.portal_users SET password_hash = $/hash/, updated_by = $/updatedBy/ WHERE id = $/id/', {
        hash,
        updatedBy: req.user?.id || null,
        id: binding.portal_user_id,
      });

      logger.info(`Admin reset password for portal_user ${binding.portal_user_id} (client ${clientId})`);
      res.json({ message: 'Password reset successfully' });
    } catch (err) {
      this.handleError(err, res, 'resetting password for', this.errorLabel);
    }
  }

  /* ── Private helpers ──────────────────────────────────── */

  /**
   * Create or restore a portal_users + portal_user_tenants binding for a
   * client gaining app access. Both rows stay in sync.
   */
  async #provisionAppUser(client, req, suppliedPassword, loginEmail) {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) throw new Error('Tenant context required to provision app user');

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

    const clearPassword = suppliedPassword || crypto.randomBytes(12).toString('base64url');
    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
    const passwordHash = await bcrypt.hash(clearPassword, rounds);
    const updatedBy = req.user?.id || null;

    const priorBinding = await findAnyBinding('client', client.id, tenantId);

    if (priorBinding) {
      await db.tx(async (t) => {
        await t.none(
          `UPDATE admin.portal_users
           SET deactivated_at = NULL, status = 'invited',
               password_hash = $1, email = $2, updated_by = $3
           WHERE id = $4`,
          [passwordHash, loginEmail, updatedBy, priorBinding.portal_user_id],
        );
        await t.none(
          `UPDATE admin.portal_user_tenants
           SET deactivated_at = NULL, status = 'active', updated_by = $1
           WHERE id = $2`,
          [updatedBy, priorBinding.id],
        );
      });
      logger.info(`Restored portal_user ${priorBinding.portal_user_id} + binding for client ${client.id}`);
      return priorBinding.portal_user_id;
    }

    const portalUserId = await db.tx(async (t) => {
      const user = await t.one(
        `INSERT INTO admin.portal_users (email, password_hash, status, created_by)
         VALUES ($1, $2, 'invited', $3)
         RETURNING id`,
        [loginEmail, passwordHash, updatedBy],
      );
      await t.none(
        `INSERT INTO admin.portal_user_tenants
           (portal_user_id, tenant_id, entity_type, entity_id, status, created_by)
         VALUES ($1, $2, 'client', $3, 'active', $4)`,
        [user.id, tenantId, client.id, updatedBy],
      );
      return user.id;
    });

    logger.info(`Provisioned portal_user ${portalUserId} + binding for client ${client.id}`);
    return portalUserId;
  }

  /**
   * Archive (soft-delete) the portal_users + binding linked to a client.
   */
  async #archiveAppUser(clientId, req) {
    const binding = await findActiveBinding('client', clientId, req.user?.tenant_id);
    if (!binding) return;

    const updatedBy = req.user?.id || null;
    await db.tx(async (t) => {
      await t.none(
        `UPDATE admin.portal_user_tenants
         SET deactivated_at = NOW(), status = 'locked', updated_by = $1
         WHERE id = $2`,
        [updatedBy, binding.id],
      );
      await t.none(
        `UPDATE admin.portal_users
         SET deactivated_at = NOW(), status = 'locked', updated_by = $1
         WHERE id = $2`,
        [updatedBy, binding.portal_user_id],
      );
    });
    logger.info(`Archived portal_user ${binding.portal_user_id} + binding for client ${clientId}`);
  }

  /**
   * Restore the portal_users + binding linked to a client.
   */
  async #restoreAppUser(clientId, req) {
    const binding = await db.oneOrNone(
      `SELECT id, portal_user_id FROM admin.portal_user_tenants
       WHERE entity_type = 'client' AND entity_id = $1 AND tenant_id = $2 AND deactivated_at IS NOT NULL
       ORDER BY deactivated_at DESC LIMIT 1`,
      [clientId, req.user?.tenant_id],
    );
    if (!binding) return;

    const updatedBy = req.user?.id || null;
    await db.tx(async (t) => {
      await t.none(
        `UPDATE admin.portal_users
         SET deactivated_at = NULL, status = 'active', updated_by = $1
         WHERE id = $2`,
        [updatedBy, binding.portal_user_id],
      );
      await t.none(
        `UPDATE admin.portal_user_tenants
         SET deactivated_at = NULL, status = 'active', updated_by = $1
         WHERE id = $2`,
        [updatedBy, binding.id],
      );
    });
    logger.info(`Restored portal_user ${binding.portal_user_id} + binding for client ${clientId}`);
  }
}

const instance = new ClientsController();
export default instance;
export { ClientsController };
