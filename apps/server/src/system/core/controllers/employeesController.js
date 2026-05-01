/**
 * @file Employees controller — auto-creates sources record, manages is_app_user lifecycle
 * @module core/controllers/employeesController
 *
 * When is_app_user is toggled ON, provisions a portal_users record in admin schema
 * with entity_type='employee' and entity_id pointing to the employee row.
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
import { findActiveBinding, findAnyBinding } from '../../auth/services/portalUserBindings.js';
import logger from '../../../lib/logger.js';

class EmployeesController extends BaseController {
  constructor() {
    super('employees');
    this.rbacConfig = { module: 'core', router: 'employees' };
  }

  /**
   * POST / — insert an employee and auto-create a linked sources record.
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

      // Extract email before insert — it goes in the emails table, not the employees table
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

      // Extract password before insert — it's for portal_users, not the employees table
      const suppliedPassword = req.body.password;
      delete req.body.password;

      const record = await db.tx(async (t) => {
        const employeesModel = this.model(schema);
        employeesModel.tx = t;

        // 1. Insert the employee
        const employee = await employeesModel.insert(req.body);

        // 2. Auto-create a sources record linking to this employee
        const sourcesModel = db('sources', schema);
        sourcesModel.tx = t;
        const source = await sourcesModel.insert({
          tenant_id: employee.tenant_id,
          table_id: employee.id,
          source_type: 'employee',
          label: `${employee.first_name} ${employee.last_name}`,
          created_by: req.body.created_by || null,
        });

        // 3. Link the source back to the employee
        await t.none(`UPDATE ${s}.employees SET source_id = $1, updated_by = $2 WHERE id = $3`, [
          source.id,
          req.body.created_by || null,
          employee.id,
        ]);

        // 4. Auto-assign code via numbering service (if enabled and code not provided)
        if (!employee.code) {
          const numbering = await allocateNumber(schema, 'employee', null, new Date(), t);
          if (numbering) {
            await t.none(`UPDATE ${s}.employees SET code = $1 WHERE id = $2`, [numbering.displayId, employee.id]);
            employee.code = numbering.displayId;
          }
        }

        // 5. Create email record if provided
        if (suppliedEmail) {
          const emailsModel = db('emails', schema);
          emailsModel.tx = t;
          await emailsModel.insert({
            tenant_id: employee.tenant_id,
            source_id: source.id,
            email: suppliedEmail,
            label: 'work',
            is_primary: true,
            is_login: !!req.body.is_app_user,
            created_by: req.body.created_by || null,
          });
        }

        return { ...employee, source_id: source.id };
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
   * PUT /update — update employee and manage is_app_user toggle.
   */
  async update(req, res) {
    const schema = this.getSchema(req);
    const employeeId = req.query.id;

    if (!employeeId) {
      return res.status(400).json({ error: 'id query parameter is required' });
    }

    try {
      // Fetch employee BEFORE update to detect is_app_user toggle
      const before = await this.model(schema).findById(employeeId);
      if (!before) return res.status(404).json({ error: `${this.errorLabel} not found` });

      // Normalize empty code to null — avoids unique constraint violation on ''
      if (req.body.code !== undefined && !req.body.code?.trim()) req.body.code = null;

      // Detect is_app_user toggle — validate BEFORE persisting the update
      const wasAppUser = !!before.is_app_user;
      const isNowAppUser = req.body.is_app_user !== undefined ? !!req.body.is_app_user : wasAppUser;

      // Extract email — it's managed in the emails table, not the employees table.
      // Only accept it when toggling is_app_user ON; otherwise reject with guidance.
      const suppliedEmail = req.body.email;
      delete req.body.email;

      if (suppliedEmail && !isNowAppUser) {
        return res.status(400).json({
          error: 'Email is managed via /api/core/v1/emails. Use that endpoint to update email addresses.',
        });
      }

      // Extract password before update — it's for portal_users, not the employees table
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
        isNowAppUser && (!wasAppUser || !(await findActiveBinding('employee', before.id, req.user?.tenant_id)));

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
      const count = await this.model(schema).updateWhere([{ id: employeeId }], req.body);
      if (!count) return res.status(404).json({ error: `${this.errorLabel} not found` });

      if (needsProvisioning) {
        // Toggled ON: provision or restore portal_user
        // If no email exists at all, create one from the supplied email
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
          // Existing primary email but not flagged as login — promote it.
          // If a different email was supplied, update the value to keep portal_users in sync.
          const updatedBy = req.user?.id || null;
          const emailUpdate =
            suppliedEmail && suppliedEmail !== loginEmail.email
              ? `UPDATE ${s}.emails SET is_login = true, email = $2, updated_by = $3 WHERE id = $1`
              : `UPDATE ${s}.emails SET is_login = true, updated_by = $2 WHERE id = $1`;
          const emailParams =
            suppliedEmail && suppliedEmail !== loginEmail.email ? [loginEmail.id, suppliedEmail, updatedBy] : [loginEmail.id, updatedBy];
          await db.none(emailUpdate, emailParams);
        }
        const updatedEmployee = { ...before, ...req.body, id: before.id };
        await this.#provisionAppUser(updatedEmployee, req, suppliedPassword, resolvedEmail);
      } else if (wasAppUser && !isNowAppUser) {
        // Toggled OFF: archive the linked portal_user
        await this.#archiveAppUser(before.id, req);
      }

      // Flush permission cache if roles changed
      if (req.body.roles !== undefined) {
        await invalidateByEntity('employee', employeeId, req.user?.tenant_code);
      }

      res.json({ updatedRecords: count });
    } catch (err) {
      if (err.name === 'SchemaDefinitionError') err.message = 'Invalid input data';
      this.handleError(err, res, 'updating', this.errorLabel);
    }
  }

  /**
   * DELETE /archive — soft-delete employee, cascade to portal_users if is_app_user.
   */
  async archive(req, res) {
    const schema = this.getSchema(req);
    const employeeId = req.query.id;

    req.body.deactivated_at = new Date();
    try {
      // Cascade to portal_user before archiving employee
      if (employeeId) {
        const employee = await this.model(schema).findById(employeeId);
        if (employee?.is_app_user) {
          await this.#archiveAppUser(employee.id, req);
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
   * PATCH /restore — reactivate employee, cascade to portal_users if is_app_user.
   */
  async restore(req, res) {
    const schema = this.getSchema(req);
    const employeeId = req.query.id;

    req.body.deactivated_at = null;
    const filters = [{ deactivated_at: { $not: null } }, { ...req.query }];

    try {
      const count = await this.model(schema).updateWhere(filters, req.body, { includeDeactivated: true });
      if (!count) return res.status(404).json({ error: `${this.errorLabel} not found or already active` });

      // Cascade restore to portal_user if employee is an app user
      if (employeeId) {
        const employee = await this.model(schema).findById(employeeId);
        if (employee?.is_app_user) {
          await this.#restoreAppUser(employee.id, req);
        }
      }

      res.status(200).json({ message: `${this.errorLabel} marked as active` });
    } catch (err) {
      this.handleError(err, res, 'restoring', this.errorLabel);
    }
  }

  /**
   * POST /:id/reset-password — admin reset password for an employee's app user account.
   */
  async resetPassword(req, res) {
    const employeeId = req.params.id;
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
      const binding = await findActiveBinding('employee', employeeId, req.user?.tenant_id);
      if (!binding) {
        return res.status(404).json({ error: 'No active app user account found for this employee' });
      }

      const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
      const hash = await bcrypt.hash(password, rounds);
      await db.none('UPDATE admin.portal_users SET password_hash = $/hash/, updated_by = $/updatedBy/ WHERE id = $/id/', {
        hash,
        updatedBy: req.user?.id || null,
        id: binding.portal_user_id,
      });

      logger.info(`Admin reset password for portal_user ${binding.portal_user_id} (employee ${employeeId})`);
      res.json({ message: 'Password reset successfully' });
    } catch (err) {
      this.handleError(err, res, 'resetting password for', this.errorLabel);
    }
  }

  /**
   * GET /:id/source-id — resolve the polymorphic source record for an employee.
   */
  async getSourceId(req, res) {
    const schema = this.getSchema(req);
    const employeeId = req.params.id;

    try {
      const s = pgp.as.name(schema);
      const source = await db.oneOrNone(
        `SELECT id FROM ${s}.sources WHERE table_id = $1 AND source_type = 'employee' AND deactivated_at IS NULL`,
        [employeeId],
      );
      if (!source) return res.status(404).json({ error: 'Source not found for this employee' });
      res.json({ source_id: source.id });
    } catch (err) {
      this.handleError(err, res, 'fetching source for', this.errorLabel);
    }
  }

  /* ── Private helpers ──────────────────────────────────── */

  /**
   * Create or restore a portal_users + portal_user_tenants binding for an
   * employee gaining app access. Both rows are kept in sync — archived
   * bindings restore alongside their portal_users row.
   */
  async #provisionAppUser(employee, req, suppliedPassword, loginEmail) {
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

    const clearPassword = suppliedPassword || crypto.randomBytes(12).toString('base64url');
    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
    const passwordHash = await bcrypt.hash(clearPassword, rounds);
    const updatedBy = req.user?.id || null;

    // Look for any prior binding for this employee in this tenant (active or archived)
    const priorBinding = await findAnyBinding('employee', employee.id, tenantId);

    if (priorBinding) {
      // Restore both portal_users and the binding to keep them in sync
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
      logger.info(`Restored portal_user ${priorBinding.portal_user_id} + binding for employee ${employee.id}`);
      return priorBinding.portal_user_id;
    }

    // Create a new portal_users + binding pair
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
         VALUES ($1, $2, 'employee', $3, 'active', $4)`,
        [user.id, tenantId, employee.id, updatedBy],
      );
      return user.id;
    });

    logger.info(`Provisioned portal_user ${portalUserId} + binding for employee ${employee.id}`);
    return portalUserId;
  }

  /**
   * Archive (soft-delete) the portal_users + binding linked to an employee.
   */
  async #archiveAppUser(employeeId, req) {
    const binding = await findActiveBinding('employee', employeeId, req.user?.tenant_id);
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
    logger.info(`Archived portal_user ${binding.portal_user_id} + binding for employee ${employeeId}`);
  }

  /**
   * Restore the portal_users + binding linked to an employee.
   */
  async #restoreAppUser(employeeId, req) {
    const binding = await db.oneOrNone(
      `SELECT id, portal_user_id FROM admin.portal_user_tenants
       WHERE entity_type = 'employee' AND entity_id = $1 AND tenant_id = $2 AND deactivated_at IS NOT NULL
       ORDER BY deactivated_at DESC LIMIT 1`,
      [employeeId, req.user?.tenant_id],
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
    logger.info(`Restored portal_user ${binding.portal_user_id} + binding for employee ${employeeId}`);
  }
}

const instance = new EmployeesController();
export default instance;
export { EmployeesController };
