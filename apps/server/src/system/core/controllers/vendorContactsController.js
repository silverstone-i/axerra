/**
 * @file Vendor contacts controller — auto-creates sources record, manages is_app_user lifecycle
 * @module core/controllers/vendorContactsController
 *
 * Each vendor contact gets its own sources record (source_type = 'vendor_contact')
 * so that emails and phone numbers can be linked via the polymorphic pattern.
 *
 * When is_app_user is toggled ON, provisions a portal_users record in admin schema
 * with entity_type='vendor_contact' and entity_id pointing to the vendor_contact row.
 * When toggled OFF or archived, cascades to lock the linked portal_user.
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import BaseController from '../../../lib/BaseController.js';
import db, { pgp } from '../../../db/db.js';
import { invalidateByEntity } from '../../../services/permCacheInvalidator.js';
import { findActiveBinding, findAnyBinding } from '../../auth/services/index.js';
import logger from '../../../lib/logger.js';

class VendorContactsController extends BaseController {
  constructor() {
    super('vendorContacts');
    this.rbacConfig = { module: 'core', router: 'vendor-contacts' };
  }

  /**
   * POST / — insert a vendor contact and auto-create a linked sources record.
   * If is_app_user is true, also provisions a portal_users login account.
   */
  async create(req, res) {
    try {
      const schema = this.getSchema(req);
      const s = pgp.as.name(schema);

      if (!req.body.tenant_id && req.user?.tenant_id) {
        req.body.tenant_id = req.user.tenant_id;
      }

      // Extract email before insert — it goes in the emails table, not the vendor_contacts table
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

      // Extract password before insert — it's for portal_users, not the vendor_contacts table
      const suppliedPassword = req.body.password;
      delete req.body.password;

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
        await t.none(`UPDATE ${s}.vendor_contacts SET source_id = $1, updated_by = $2 WHERE id = $3`, [
          source.id,
          req.body.created_by || null,
          contact.id,
        ]);

        // 4. Create email record if provided
        if (suppliedEmail) {
          const emailsModel = db('emails', schema);
          emailsModel.tx = t;
          await emailsModel.insert({
            tenant_id: contact.tenant_id,
            source_id: source.id,
            email: suppliedEmail,
            label: 'work',
            is_primary: true,
            is_login: !!req.body.is_app_user,
            created_by: req.body.created_by || null,
          });
        }

        return { ...contact, source_id: source.id };
      });

      // 5. If is_app_user, create the portal_users login record
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
   * PUT /update — update vendor contact and manage is_app_user toggle.
   */
  async update(req, res) {
    const schema = this.getSchema(req);
    const contactId = req.query.id;

    if (!contactId) {
      return res.status(400).json({ error: 'id query parameter is required' });
    }

    try {
      // Fetch vendor contact BEFORE update to detect is_app_user toggle
      const before = await this.model(schema).findById(contactId);
      if (!before) return res.status(404).json({ error: `${this.errorLabel} not found` });

      // Detect is_app_user toggle — validate BEFORE persisting the update
      const wasAppUser = !!before.is_app_user;
      const isNowAppUser = req.body.is_app_user !== undefined ? !!req.body.is_app_user : wasAppUser;

      // Extract email — it's managed in the emails table, not the vendor_contacts table.
      const suppliedEmail = req.body.email;
      delete req.body.email;

      if (suppliedEmail && !isNowAppUser) {
        return res.status(400).json({
          error: 'Email is managed via /api/core/v1/emails. Use that endpoint to update email addresses.',
        });
      }

      // Extract password before update — it's for portal_users, not the vendor_contacts table
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
        isNowAppUser && (!wasAppUser || !(await findActiveBinding('vendor_contact', before.id, req.user?.tenant_id)));

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
      const count = await this.model(schema).updateWhere([{ id: contactId }], req.body);
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
        const updatedContact = { ...before, ...req.body, id: before.id };
        await this.#provisionAppUser(updatedContact, req, suppliedPassword, resolvedEmail);
      } else if (wasAppUser && !isNowAppUser) {
        // Toggled OFF: archive the linked portal_user
        await this.#archiveAppUser(before.id, req);
      }

      // Flush permission cache if roles changed
      if (req.body.roles !== undefined) {
        await invalidateByEntity('vendor_contact', contactId, req.user?.tenant_code);
      }

      res.json({ updatedRecords: count });
    } catch (err) {
      if (err.name === 'SchemaDefinitionError') err.message = 'Invalid input data';
      this.handleError(err, res, 'updating', this.errorLabel);
    }
  }

  /**
   * DELETE /archive — soft-delete vendor contact, cascade to portal_users if is_app_user.
   */
  async archive(req, res) {
    const schema = this.getSchema(req);
    const contactId = req.query.id;

    req.body.deactivated_at = new Date();
    try {
      // Cascade to portal_user before archiving vendor contact
      if (contactId) {
        const contact = await this.model(schema).findById(contactId);
        if (contact?.is_app_user) {
          await this.#archiveAppUser(contact.id, req);
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
   * PATCH /restore — restore vendor contact, cascade to portal_users if is_app_user.
   */
  async restore(req, res) {
    const schema = this.getSchema(req);
    const contactId = req.query.id;

    req.body.deactivated_at = null;
    const filters = [{ deactivated_at: { $not: null } }, { ...req.query }];

    try {
      const count = await this.model(schema).updateWhere(filters, req.body, { includeDeactivated: true });
      if (!count) return res.status(404).json({ error: `${this.errorLabel} not found or already active` });

      // Cascade restore to portal_user if vendor contact is an app user
      if (contactId) {
        const contact = await this.model(schema).findById(contactId);
        if (contact?.is_app_user) {
          await this.#restoreAppUser(contact.id, req);
        }
      }

      res.status(200).json({ message: `${this.errorLabel} marked as active` });
    } catch (err) {
      this.handleError(err, res, 'restoring', this.errorLabel);
    }
  }

  /**
   * POST /:id/reset-password — admin reset password for a vendor contact's app user account.
   */
  async resetPassword(req, res) {
    const contactId = req.params.id;
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
      const binding = await findActiveBinding('vendor_contact', contactId, req.user?.tenant_id);
      if (!binding) {
        return res.status(404).json({ error: 'No active app user account found for this vendor contact' });
      }

      const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
      const hash = await bcrypt.hash(password, rounds);
      await db.none('UPDATE admin.portal_users SET password_hash = $/hash/, updated_by = $/updatedBy/ WHERE id = $/id/', {
        hash,
        updatedBy: req.user?.id || null,
        id: binding.portal_user_id,
      });

      logger.info(`Admin reset password for portal_user ${binding.portal_user_id} (vendor_contact ${contactId})`);
      res.json({ message: 'Password reset successfully' });
    } catch (err) {
      this.handleError(err, res, 'resetting password for', this.errorLabel);
    }
  }

  /* ── Private helpers ──────────────────────────────────── */

  /**
   * Provision app-user access for a vendor_contact. Three cases per the
   * Import Dedup & Multi-Tenant Vendor Access spec, Part 3:
   *
   *   1. A prior binding for this vendor_contact in this tenant exists —
   *      restore it (and re-activate the portal_user if archived). The
   *      portal_user's credentials are NOT reset; they belong to the
   *      user, especially when they have other active bindings.
   *   2. A portal_user with this login email already exists (active or
   *      archived) — bind that portal_user to this vendor_contact with
   *      the new binding in status='invited'. Supplied password is
   *      ignored. The portal_user's global status stays as-is
   *      (reactivated if archived); only the per-tenant binding row
   *      starts in invite state.
   *   3. No match anywhere — create a new portal_users row plus binding
   *      with the hashed temp password (or a generated one).
   */
  async #provisionAppUser(vendorContact, req, suppliedPassword, loginEmail) {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) throw new Error('Tenant context required to provision app user');
    const updatedBy = req.user?.id || null;

    // ── Case 1: prior binding for THIS vendor_contact in this tenant ──
    const priorBinding = await findAnyBinding('vendor_contact', vendorContact.id, tenantId);
    if (priorBinding) {
      await db.tx(async (t) => {
        await t.none(
          `UPDATE admin.portal_user_tenants
           SET deactivated_at = NULL, status = 'active', updated_by = $1
           WHERE id = $2`,
          [updatedBy, priorBinding.id],
        );
        // If the portal_user itself was archived (e.g. when its last
        // active binding got locked), reactivate it. Don't touch its
        // credentials — they belong to the user.
        await t.none(
          `UPDATE admin.portal_users
           SET deactivated_at = NULL, status = 'active', updated_by = $1
           WHERE id = $2 AND deactivated_at IS NOT NULL`,
          [updatedBy, priorBinding.portal_user_id],
        );
      });
      logger.info(`Restored binding for vendor_contact ${vendorContact.id} → portal_user ${priorBinding.portal_user_id}`);
      return priorBinding.portal_user_id;
    }

    // ── Case 2: existing portal_user with this email → bind, ignore password ──
    // Match active rows first; fall back to archived rows so we never
    // create a duplicate credentials row for the same email. If matched
    // archived, the portal_user gets reactivated as part of the bind.
    const existingUser = await db.oneOrNone(
      `SELECT id, deactivated_at FROM admin.portal_users
       WHERE email = $1
       ORDER BY deactivated_at IS NULL DESC, deactivated_at DESC NULLS FIRST
       LIMIT 1`,
      [loginEmail],
    );
    if (existingUser) {
      // Detect a pre-existing binding for (this portal_user, this tenant).
      // The (portal_user_id, tenant_id) WHERE active partial unique index
      // means we can only have one active binding here; bare bindings
      // from /portal-users/register get upgraded in place, entity bindings
      // collide loudly.
      const sameTenantBinding = await db.oneOrNone(
        `SELECT id, entity_type, entity_id, deactivated_at
         FROM admin.portal_user_tenants
         WHERE portal_user_id = $1 AND tenant_id = $2
         ORDER BY deactivated_at IS NULL DESC, created_at DESC
         LIMIT 1`,
        [existingUser.id, tenantId],
      );

      if (sameTenantBinding && sameTenantBinding.deactivated_at === null && sameTenantBinding.entity_type) {
        if (sameTenantBinding.entity_type !== 'vendor_contact' || sameTenantBinding.entity_id !== vendorContact.id) {
          const err = new Error(
            'A portal user with this email already has an active binding to this tenant. Resolve the existing binding before re-using the email.',
          );
          err.status = 409;
          throw err;
        }
        // Idempotent re-provisioning: same vendor_contact already bound
        // (the prior-binding branch should have caught this — defensive).
        logger.info(`Re-provisioning hit existing matching binding for vendor_contact ${vendorContact.id}; no-op`);
        return existingUser.id;
      }

      await db.tx(async (t) => {
        if (existingUser.deactivated_at) {
          await t.none(
            `UPDATE admin.portal_users
             SET deactivated_at = NULL, status = 'active', updated_by = $1
             WHERE id = $2`,
            [updatedBy, existingUser.id],
          );
        }

        // Decide whether to upgrade the existing binding row in place or
        // insert a new one. Upgrading is only safe when the row is bare
        // (entity_type IS NULL — typical /portal-users/register output)
        // or already points at this same vendor_contact (idempotent
        // re-provisioning of an archived binding). Otherwise inserting
        // a new binding preserves the archived row's historical entity
        // linkage; the (portal_user_id, tenant_id) WHERE active partial
        // unique index doesn't conflict because the prior row is
        // archived.
        const canUpgradeInPlace =
          sameTenantBinding
          && (sameTenantBinding.entity_type === null
            || (sameTenantBinding.entity_type === 'vendor_contact' && sameTenantBinding.entity_id === vendorContact.id));

        if (canUpgradeInPlace) {
          await t.none(
            `UPDATE admin.portal_user_tenants
             SET deactivated_at = NULL,
                 entity_type = 'vendor_contact',
                 entity_id = $1,
                 status = 'invited',
                 updated_by = $2
             WHERE id = $3`,
            [vendorContact.id, updatedBy, sameTenantBinding.id],
          );
        } else {
          await t.none(
            `INSERT INTO admin.portal_user_tenants
               (portal_user_id, tenant_id, entity_type, entity_id, status, created_by)
             VALUES ($1, $2, 'vendor_contact', $3, 'invited', $4)`,
            [existingUser.id, tenantId, vendorContact.id, updatedBy],
          );
        }
      });

      logger.info(`Bound existing portal_user ${existingUser.id} to vendor_contact ${vendorContact.id} (email match)`);
      return existingUser.id;
    }

    // ── Case 3: no match — create new portal_user + binding ────────────
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
         VALUES ($1, $2, 'vendor_contact', $3, 'active', $4)`,
        [user.id, tenantId, vendorContact.id, updatedBy],
      );
      return user.id;
    });

    logger.info(`Provisioned portal_user ${portalUserId} + binding for vendor_contact ${vendorContact.id}`);
    return portalUserId;
  }

  /**
   * Archive the per-tenant binding for a vendor_contact app user.
   *
   * Vendor_contacts can share a portal_user across tenants (Task 6's
   * email-match → bind path). Archiving only this tenant's binding
   * must NOT lock the global portal_user when other tenants still
   * have active bindings to it — that would break their logins.
   * The portal_user is only locked when this was the user's last
   * remaining active binding.
   */
  async #archiveAppUser(vendorContactId, req) {
    const binding = await findActiveBinding('vendor_contact', vendorContactId, req.user?.tenant_id);
    if (!binding) return;

    const updatedBy = req.user?.id || null;
    await db.tx(async (t) => {
      await t.none(
        `UPDATE admin.portal_user_tenants
         SET deactivated_at = NOW(), status = 'locked', updated_by = $1
         WHERE id = $2`,
        [updatedBy, binding.id],
      );
      // Only lock the portal_user globally if this was the last active
      // binding. Mirrors tenantsController's cascade pattern.
      await t.none(
        `UPDATE admin.portal_users
         SET deactivated_at = NOW(), status = 'locked', updated_by = $1
         WHERE id = $2 AND deactivated_at IS NULL
           AND NOT EXISTS (
             SELECT 1 FROM admin.portal_user_tenants
             WHERE portal_user_id = $2 AND deactivated_at IS NULL
           )`,
        [updatedBy, binding.portal_user_id],
      );
    });
    logger.info(`Archived binding for vendor_contact ${vendorContactId} → portal_user ${binding.portal_user_id}`);
  }

  /**
   * Restore the portal_users + binding linked to a vendor contact.
   */
  async #restoreAppUser(vendorContactId, req) {
    const binding = await db.oneOrNone(
      `SELECT id, portal_user_id FROM admin.portal_user_tenants
       WHERE entity_type = 'vendor_contact' AND entity_id = $1 AND tenant_id = $2 AND deactivated_at IS NOT NULL
       ORDER BY deactivated_at DESC LIMIT 1`,
      [vendorContactId, req.user?.tenant_id],
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
    logger.info(`Restored portal_user ${binding.portal_user_id} + binding for vendor_contact ${vendorContactId}`);
  }
}

const instance = new VendorContactsController();
export default instance;
export { VendorContactsController };
