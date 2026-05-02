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

      // Multi-tenant authority guard (Part 3 of Import Dedup spec):
      // If the underlying portal_user has more than one active tenant
      // binding, only the user themselves or an Axerra admin may reset
      // the password. A tenant admin in any single tenant does not own
      // credentials shared across tenants.
      const { count } = await db.one(
        `SELECT COUNT(*)::int AS count FROM admin.portal_user_tenants
         WHERE portal_user_id = $1 AND deactivated_at IS NULL`,
        [binding.portal_user_id],
      );
      if (count > 1 && req.user?.home_tenant !== 'axerra') {
        return res.status(403).json({ error: 'Tenant admins cannot change the password of a multi-tenant vendor user.' });
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

  /**
   * PUT /:id/swap-login-email — identity-swap semantics for tenant admins.
   *
   * Per the Import Dedup & Multi-Tenant Vendor Access spec (Part 3), changing
   * a vendor_contact's login email by a tenant admin is treated as
   * "transfer access to this tenant from one identity to another", NOT as
   * "edit this person's email."
   *
   * Flow (in a single transaction):
   *   1. Look up the current active binding for (vendor_contact, this tenant).
   *   2. Look up new_email in admin.portal_users (active or archived).
   *   3. Deactivate the current binding (the previous portal_user loses
   *      access to this tenant; their global identity is preserved and
   *      may still be active in other tenants).
   *   4a. Match found → upgrade or insert a binding for the matched
   *       portal_user with status='invited'. Reactivate that user if
   *       archived. Supplied password is ignored.
   *   4b. No match → create a new portal_users row with new_email + temp
   *       password (or one supplied), then create a binding.
   *   5. Update the vendor_contact's tenant-scoped login email row to the
   *      new email so the tenant data view stays consistent.
   *
   * The previous portal_user may end up with no active bindings; they are
   * NOT auto-archived — Task 12's orphan-portal_users maintenance API
   * cleans those up explicitly.
   *
   * Body: { new_email, password? }
   */
  async swapLoginEmail(req, res) {
    const contactId = req.params.id;
    const tenantId = req.user?.tenant_id;
    const { new_email: rawEmail, password: suppliedPassword } = req.body || {};

    if (!rawEmail || typeof rawEmail !== 'string') {
      return res.status(400).json({ error: 'new_email is required' });
    }
    // Normalise email to lowercase up-front: portal_users.email is varchar
    // with a case-sensitive partial unique index, so without normalisation
    // 'Vera@x.com' and 'vera@x.com' could create duplicate active rows
    // and the lookup below would miss an existing user with different casing.
    const new_email = rawEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(new_email)) {
      return res.status(400).json({ error: 'new_email is not a valid email address' });
    }

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
        return res.status(400).json({ error: `Password must contain ${failures.join(', ')}` });
      }
    }

    const schema = this.getSchema(req);
    const s = pgp.as.name(schema);
    const updatedBy = req.user?.id || null;

    try {
      // 1. Resolve current active binding
      const currentBinding = await findActiveBinding('vendor_contact', contactId, tenantId);
      if (!currentBinding) {
        return res.status(400).json({ error: 'Vendor contact has no active app-user binding to swap' });
      }

      // Lookup current contact for source_id
      const contact = await db.oneOrNone(
        `SELECT id, source_id FROM ${s}.vendor_contacts WHERE id = $1 AND deactivated_at IS NULL`,
        [contactId],
      );
      if (!contact) return res.status(404).json({ error: 'Vendor contact not found' });

      // Locate the existing login-email row in the tenant schema
      const loginEmailRow = await db.oneOrNone(
        `SELECT id, email FROM ${s}.emails
         WHERE source_id = $1 AND is_login = true AND deactivated_at IS NULL`,
        [contact.source_id],
      );

      if (loginEmailRow && loginEmailRow.email.toLowerCase() === new_email) {
        return res.status(400).json({ error: 'new_email matches the current login email — nothing to swap' });
      }

      const previousPortalUserId = currentBinding.portal_user_id;
      let newPortalUserId;

      // 2. Look up new_email in admin.portal_users (active first, archived
      // fallback). Case-insensitive match defends against pre-normalisation
      // rows that may exist with mixed casing.
      const matchedUser = await db.oneOrNone(
        `SELECT id, deactivated_at FROM admin.portal_users
         WHERE LOWER(email) = $1
         ORDER BY deactivated_at IS NULL DESC, deactivated_at DESC NULLS FIRST
         LIMIT 1`,
        [new_email],
      );

      // The match could be the same portal_user already bound to this
      // contact in this tenant — a real swap requires a different identity.
      // Refuse with 400 so the caller doesn't accidentally downgrade their
      // own binding to status='invited'.
      if (matchedUser?.id === previousPortalUserId) {
        return res.status(400).json({
          error:
            'new_email belongs to the same portal user already bound to this contact. Update the tenant login-email row directly if it is out of sync.',
        });
      }

      const runSwap = () => db.tx(async (t) => {
        // 3. Deactivate the current binding — old portal_user loses tenant access.
        await t.none(
          `UPDATE admin.portal_user_tenants
           SET deactivated_at = NOW(), status = 'locked', updated_by = $1
           WHERE id = $2`,
          [updatedBy, currentBinding.id],
        );

        if (matchedUser) {
          // 4a. Reactivate the matched portal_user if archived; do not
          // touch credentials.
          if (matchedUser.deactivated_at) {
            await t.none(
              `UPDATE admin.portal_users
               SET deactivated_at = NULL, status = 'active', updated_by = $1
               WHERE id = $2 AND deactivated_at IS NOT NULL`,
              [updatedBy, matchedUser.id],
            );
          }

          // Find any pre-existing binding for (matched user, this tenant)
          // — bare bindings get upgraded; entity bindings collide loudly;
          // archived rows: insert a new active binding alongside.
          const sameTenantBinding = await t.oneOrNone(
            `SELECT id, entity_type, entity_id, deactivated_at
             FROM admin.portal_user_tenants
             WHERE portal_user_id = $1 AND tenant_id = $2
             ORDER BY deactivated_at IS NULL DESC, created_at DESC
             LIMIT 1`,
            [matchedUser.id, tenantId],
          );

          if (sameTenantBinding && sameTenantBinding.deactivated_at === null && sameTenantBinding.entity_type) {
            const err = new Error(
              'A portal user with the new email already has an active binding to this tenant. Resolve it before swapping.',
            );
            err.status = 409;
            throw err;
          }

          const canUpgradeInPlace =
            sameTenantBinding
            && (sameTenantBinding.entity_type === null
              || (sameTenantBinding.entity_type === 'vendor_contact' && sameTenantBinding.entity_id === contact.id));

          if (canUpgradeInPlace) {
            await t.none(
              `UPDATE admin.portal_user_tenants
               SET deactivated_at = NULL,
                   entity_type = 'vendor_contact',
                   entity_id = $1,
                   status = 'invited',
                   updated_by = $2
               WHERE id = $3`,
              [contact.id, updatedBy, sameTenantBinding.id],
            );
          } else {
            await t.none(
              `INSERT INTO admin.portal_user_tenants
                 (portal_user_id, tenant_id, entity_type, entity_id, status, created_by)
               VALUES ($1, $2, 'vendor_contact', $3, 'invited', $4)`,
              [matchedUser.id, tenantId, contact.id, updatedBy],
            );
          }
          newPortalUserId = matchedUser.id;
        } else {
          // 4b. No match — create new portal_user + binding
          const clearPassword = suppliedPassword || crypto.randomBytes(12).toString('base64url');
          const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
          const passwordHash = await bcrypt.hash(clearPassword, rounds);
          const newUser = await t.one(
            `INSERT INTO admin.portal_users (email, password_hash, status, created_by)
             VALUES ($1, $2, 'invited', $3)
             RETURNING id`,
            [new_email, passwordHash, updatedBy],
          );
          await t.none(
            `INSERT INTO admin.portal_user_tenants
               (portal_user_id, tenant_id, entity_type, entity_id, status, created_by)
             VALUES ($1, $2, 'vendor_contact', $3, 'invited', $4)`,
            [newUser.id, tenantId, contact.id, updatedBy],
          );
          newPortalUserId = newUser.id;
        }

        // 5. Update the tenant-scoped login email row so the tenant data view stays consistent.
        if (loginEmailRow) {
          await t.none(
            `UPDATE ${s}.emails SET email = $1, updated_by = $2 WHERE id = $3`,
            [new_email, updatedBy, loginEmailRow.id],
          );
        } else {
          // Defensive: no login email row — create one
          await t.none(
            `INSERT INTO ${s}.emails (tenant_id, source_id, email, label, is_primary, is_login, created_by)
             VALUES ($1, $2, $3, 'work', true, true, $4)`,
            [tenantId, contact.source_id, new_email, updatedBy],
          );
        }
      });

      let usedMatchPath = !!matchedUser;
      try {
        await runSwap();
      } catch (err) {
        // Concurrent insert race: between the lookup and our INSERT into
        // admin.portal_users, another request may have created a row with
        // this email. Re-lookup once and retry through the match path.
        const isUniqueViolation = err.code === '23505' && /portal_users.*email/i.test(err.constraint || err.detail || '');
        if (!isUniqueViolation) throw err;
        const racedUser = await db.oneOrNone(
          `SELECT id, deactivated_at FROM admin.portal_users WHERE LOWER(email) = $1 LIMIT 1`,
          [new_email],
        );
        if (!racedUser) throw err;
        if (racedUser.id === previousPortalUserId) {
          return res.status(400).json({
            error:
              'Concurrent update produced a portal_user that is already bound to this contact. Please try again.',
          });
        }
        // Reuse the match path — rebuild the matched-user state. Note: the
        // failed first attempt already rolled back, so the current binding
        // is still active; runSwap will deactivate it on retry.
        const retried = await db.tx(async (t) => {
          await t.none(
            `UPDATE admin.portal_user_tenants
             SET deactivated_at = NOW(), status = 'locked', updated_by = $1
             WHERE id = $2`,
            [updatedBy, currentBinding.id],
          );
          if (racedUser.deactivated_at) {
            await t.none(
              `UPDATE admin.portal_users
               SET deactivated_at = NULL, status = 'active', updated_by = $1
               WHERE id = $2 AND deactivated_at IS NOT NULL`,
              [updatedBy, racedUser.id],
            );
          }
          await t.none(
            `INSERT INTO admin.portal_user_tenants
               (portal_user_id, tenant_id, entity_type, entity_id, status, created_by)
             VALUES ($1, $2, 'vendor_contact', $3, 'invited', $4)`,
            [racedUser.id, tenantId, contact.id, updatedBy],
          );
          if (loginEmailRow) {
            await t.none(
              `UPDATE ${s}.emails SET email = $1, updated_by = $2 WHERE id = $3`,
              [new_email, updatedBy, loginEmailRow.id],
            );
          } else {
            await t.none(
              `INSERT INTO ${s}.emails (tenant_id, source_id, email, label, is_primary, is_login, created_by)
               VALUES ($1, $2, $3, 'work', true, true, $4)`,
              [tenantId, contact.source_id, new_email, updatedBy],
            );
          }
          return racedUser.id;
        });
        newPortalUserId = retried;
        usedMatchPath = true;
      }

      logger.info(
        `Identity swap on vendor_contact ${contactId} in tenant ${tenantId}: ` +
          `portal_user ${previousPortalUserId} → ${newPortalUserId} ` +
          `(by user ${updatedBy ?? 'unknown'})`,
      );

      res.json({
        message: 'Login email swapped',
        previous_portal_user_id: previousPortalUserId,
        portal_user_id: newPortalUserId,
        matched_existing: usedMatchPath,
      });
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message });
      this.handleError(err, res, 'swapping login email for', this.errorLabel);
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
   * Restore the per-tenant binding for a vendor_contact.
   *
   * Only touches admin.portal_users when it is actually archived. If
   * the portal_user is already active/invited via another tenant's
   * binding, leave its global state alone — overwriting status='active'
   * would clear a force-password-change ('invited') state that
   * belongs to the user, not to this tenant's vendor_contact.
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
         WHERE id = $2 AND deactivated_at IS NOT NULL`,
        [updatedBy, binding.portal_user_id],
      );
      await t.none(
        `UPDATE admin.portal_user_tenants
         SET deactivated_at = NULL, status = 'active', updated_by = $1
         WHERE id = $2`,
        [updatedBy, binding.id],
      );
    });
    logger.info(`Restored binding for vendor_contact ${vendorContactId} → portal_user ${binding.portal_user_id}`);
  }
}

const instance = new VendorContactsController();
export default instance;
export { VendorContactsController };
