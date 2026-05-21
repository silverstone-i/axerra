/**
 * @file PortalUsersController — user CRUD with registration, safe archive/restore
 * @module tenants/controllers/portalUsersController
 *
 * portal_users is auth-only (id, email, password_hash, status). Tenant
 * linkage and the polymorphic entity link live on the
 * portal_user_tenants join table; archive/restore cascades resolve the
 * binding(s) for the affected user.
 *
 * Overrides:
 *   register → validates tenant active, bcrypt hashes password, creates portal_user
 *   getById  → strips password_hash
 *   update   → supports password reset via raw SQL
 *   archive  → prevents self-archival, sets status='locked', cascades to linked entity
 *   restore  → checks parent tenant is active, sets status='active', cascades to linked entity
 * Standard POST is disabled; must use /register endpoint.
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import bcrypt from 'bcrypt';
import BaseController from '../../../lib/BaseController.js';
import db, { pgp } from '../../../db/db.js';
import logger from '../../../lib/logger.js';

class PortalUsersController extends BaseController {
  constructor() {
    super('portalUsers');
  }

  /**
   * Override getSchema — portal_users always live in the admin schema.
   */
  getSchema(_req) {
    return 'admin';
  }

  /* ── Helpers ──────────────────────────────────────────────── */

  #stripPassword(record) {
    if (!record) return record;
    const { password_hash: _ph, ...safe } = record;
    return safe;
  }

  #stripPasswords(data) {
    if (Array.isArray(data)) return data.map((r) => this.#stripPassword(r));
    if (data?.rows) return { ...data, rows: data.rows.map((r) => this.#stripPassword(r)) };
    return this.#stripPassword(data);
  }

  /**
   * Hydrate users with their primary active binding so list views can
   * keep showing entity_type / entity_id / tenant_id. For users with
   * multiple bindings (vendor_contacts) the earliest active binding
   * wins — matches the home-binding choice authRedis makes.
   */
  async #hydrateBindings(records) {
    const list = Array.isArray(records) ? records : records?.rows;
    if (!list || !list.length) return records;

    const ids = list.map((r) => r.id).filter(Boolean);
    if (!ids.length) return records;

    const bindings = await db.any(
      `SELECT DISTINCT ON (portal_user_id)
         portal_user_id, tenant_id, entity_type, entity_id, status AS binding_status
       FROM admin.portal_user_tenants
       WHERE portal_user_id = ANY($1::uuid[]) AND deactivated_at IS NULL
       ORDER BY portal_user_id, created_at ASC`,
      [ids],
    );
    const byUser = new Map(bindings.map((b) => [b.portal_user_id, b]));

    const decorate = (row) => {
      const b = byUser.get(row.id);
      if (!b) return { ...row, tenant_id: null, entity_type: null, entity_id: null };
      return { ...row, tenant_id: b.tenant_id, entity_type: b.entity_type, entity_id: b.entity_id };
    };

    if (Array.isArray(records)) return records.map(decorate);
    if (records?.rows) return { ...records, rows: records.rows.map(decorate) };
    return records;
  }

  async #hydrateOne(record) {
    if (!record?.id) return record;
    const binding = await db.oneOrNone(
      `SELECT tenant_id, entity_type, entity_id FROM admin.portal_user_tenants
       WHERE portal_user_id = $1 AND deactivated_at IS NULL
       ORDER BY created_at ASC
       LIMIT 1`,
      [record.id],
    );
    return {
      ...record,
      tenant_id: binding?.tenant_id ?? null,
      entity_type: binding?.entity_type ?? null,
      entity_id: binding?.entity_id ?? null,
    };
  }

  /**
   * POST /register — register a new user with password hashing.
   *
   * Body: { tenant_code, email, password }
   * Entity validation deferred to Phase 5 when entity tables exist.
   */
  register = async (req, res) => {
    const { tenant_code, email, password } = req.body;

    if (!tenant_code || !email || !password) {
      return res.status(400).json({ error: 'tenant_code, email, and password are required' });
    }

    try {
      // Validate tenant exists and is active
      const tenant = await db('tenants', 'admin').findOneBy([{ tenant_code: tenant_code.toUpperCase(), deactivated_at: null }]);

      if (!tenant) {
        return res.status(400).json({ error: 'Invalid or inactive tenant' });
      }

      // Hash password
      const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
      const password_hash = await bcrypt.hash(password, rounds);

      // Create the auth-only portal_users row + a tenant binding that
      // carries no entity link yet (entity_type/entity_id are NULL).
      // Entity provisioning controllers populate the link when an
      // employee/client/vendor_contact is created or marked is_app_user.
      const updatedBy = req.user?.id || null;
      const user = await db.tx(async (t) => {
        const inserted = await t.one(
          `INSERT INTO admin.portal_users (email, password_hash, status, created_by)
           VALUES ($1, $2, 'active', $3)
           RETURNING *`,
          [email, password_hash, updatedBy],
        );
        await t.none(
          `INSERT INTO admin.portal_user_tenants
             (portal_user_id, tenant_id, status, created_by)
           VALUES ($1, $2, 'active', $3)`,
          [inserted.id, tenant.id, updatedBy],
        );
        return inserted;
      });

      // Return user without password_hash
      const { password_hash: _ph, ...safeUser } = user;
      res.status(201).json({ message: 'User registered successfully', user: safeUser });
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Email already in use' });
      }
      if (err.name === 'SchemaDefinitionError') {
        return res.status(400).json({ error: 'Invalid input data', details: err.cause });
      }
      logger.error('Error registering user:', { error: err.message });
      res.status(500).json({ error: 'Error registering user' });
    }
  };

  /**
   * Run a parent ViewController method against a captured response so
   * we can post-process its data before sending. Lets hydration errors
   * stay inside the controller's normal try/catch flow rather than
   * leaking as unhandled rejections through an async res.json wrapper.
   */
  async #captureSuper(method, req, res) {
    let captured;
    let captureType = null;
    let capturedStatus = 200;
    const captureRes = {
      json(data) {
        captured = data;
        captureType = 'json';
        return captureRes;
      },
      status(code) {
        capturedStatus = code;
        return captureRes;
      },
      setHeader: () => captureRes,
      get headersSent() {
        return false;
      },
    };
    await super[method](req, captureRes);
    return { type: captureType, status: capturedStatus, body: captured };
  }

  /**
   * Override GET / to strip password_hash from results and hydrate the
   * primary active binding (entity_type / entity_id / tenant_id).
   */
  async get(req, res) {
    try {
      const captured = await this.#captureSuper('get', req, res);
      if (captured.status >= 400) {
        return res.status(captured.status).json(captured.body);
      }
      const hydrated = await this.#hydrateBindings(captured.body);
      return res.json(this.#stripPasswords(hydrated));
    } catch (err) {
      this.handleError(err, res, 'fetching', this.errorLabel);
    }
  }

  /**
   * GET /:id — fetch user record, strip password_hash, hydrate binding.
   */
  async getById(req, res) {
    try {
      const record = await this.model('admin').findById(req.params.id);
      if (!record) return res.status(404).json({ error: `${this.errorLabel} not found` });
      const hydrated = await this.#hydrateOne(record);
      res.json(this.#stripPassword(hydrated));
    } catch (err) {
      this.handleError(err, res, 'fetching', this.errorLabel);
    }
  }

  /**
   * Override GET /where to strip password_hash and hydrate binding.
   */
  async getWhere(req, res) {
    try {
      const captured = await this.#captureSuper('getWhere', req, res);
      if (captured.status >= 400) {
        return res.status(captured.status).json(captured.body);
      }
      const hydrated = await this.#hydrateBindings(captured.body);
      return res.json(this.#stripPasswords(hydrated));
    } catch (err) {
      this.handleError(err, res, 'fetching', this.errorLabel);
    }
  }

  /**
   * PUT /update — update user fields. Password reset via raw SQL to avoid
   * ColumnSet reset of all columns.
   */
  async update(req, res) {
    const { password, ...userChanges } = req.body;

    try {
      const userId = req.query.id;

      // Handle password reset if provided
      let pwUpdated = false;
      if (password) {
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
        const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
        const hash = await bcrypt.hash(password, rounds);
        const pwResult = await db.result(
          'UPDATE admin.portal_users SET password_hash = $/hash/, updated_by = $/updatedBy/, updated_at = now() WHERE id = $/id/ AND deactivated_at IS NULL',
          { hash, id: userId, updatedBy: req.user?.id || null },
        );
        pwUpdated = pwResult.rowCount > 0;
      }

      // Update scalar user columns via raw SQL.
      // Only 'status' is an allowed mutable field from the UI.
      const ALLOWED_FIELDS = new Set(['status']);
      const safeChanges = Object.entries(userChanges).filter(([k]) => ALLOWED_FIELDS.has(k));

      if (safeChanges.length) {
        const setClauses = safeChanges.map(([k], i) => `${pgp.as.name(k)} = $${i + 1}`);
        setClauses.push(`updated_by = $${safeChanges.length + 1}`);
        setClauses.push(`updated_at = now()`);
        const values = [...safeChanges.map(([, v]) => v), req.user?.id || null, userId];

        const count = await db.result(
          `UPDATE admin.portal_users SET ${setClauses.join(', ')} WHERE id = $${safeChanges.length + 2} AND deactivated_at IS NULL`,
          values,
        );
        if (!count.rowCount && !pwUpdated) return res.status(404).json({ error: `${this.errorLabel} not found or deactivated` });
      } else if (password && !pwUpdated) {
        return res.status(404).json({ error: `${this.errorLabel} not found or deactivated` });
      }

      res.json({ message: `${this.errorLabel} updated` });
    } catch (err) {
      if (err.name === 'SchemaDefinitionError') err.message = 'Invalid input data';
      this.handleError(err, res, 'updating', this.errorLabel);
    }
  }

  /**
   * DELETE /archive — prevents self-archival, sets status='locked',
   * cascades to archive linked entity (e.g. employee) in tenant schema.
   */
  async archive(req, res) {
    const targetId = req.query.id;
    const targetEmail = req.query.email;

    // Prevent self-archival
    if (targetId && targetId === req.user?.id) {
      return res.status(403).json({ error: 'Cannot archive the currently logged-in user' });
    }
    if (targetEmail && targetEmail === req.user?.email) {
      return res.status(403).json({ error: 'Cannot archive the currently logged-in user' });
    }

    try {
      // Look up the portal_user to cascade to linked entity bindings
      const filter = targetId ? { id: targetId } : targetEmail ? { email: targetEmail } : { ...req.query };
      const portalUser = await this.model('admin').findOneBy([filter]);
      if (!portalUser) return res.status(404).json({ error: `${this.errorLabel} not found or already inactive` });

      const bindings = await db.any(
        `SELECT id, tenant_id, entity_type, entity_id FROM admin.portal_user_tenants
         WHERE portal_user_id = $1 AND deactivated_at IS NULL`,
        [portalUser.id],
      );

      const updatedBy = req.user?.id || null;
      await db.tx(async (t) => {
        await t.none(
          `UPDATE admin.portal_users
           SET deactivated_at = NOW(), status = 'locked', updated_by = $1, updated_at = NOW()
           WHERE id = $2`,
          [updatedBy, portalUser.id],
        );
        if (bindings.length) {
          await t.none(
            `UPDATE admin.portal_user_tenants
             SET deactivated_at = NOW(), status = 'locked', updated_by = $1, updated_at = NOW()
             WHERE portal_user_id = $2 AND deactivated_at IS NULL`,
            [updatedBy, portalUser.id],
          );
        }
      });

      // Cascade to linked entities in their tenant schemas
      for (const binding of bindings) {
        await this.#archiveLinkedEntity(binding, req);
      }

      res.status(200).json({ message: `${this.errorLabel} marked as inactive` });
    } catch (err) {
      this.handleError(err, res, 'archiving', this.errorLabel);
    }
  }

  /**
   * PATCH /restore — checks parent tenant is active, sets status='active',
   * cascades to restore linked entity in tenant schema.
   */
  async restore(req, res) {
    const filter = req.query.email ? { email: req.query.email } : req.query.id ? { id: req.query.id } : null;
    if (!filter) {
      return res.status(400).json({ error: 'email or id query parameter required' });
    }

    try {
      const user = await this.model('admin').findOneBy([filter], { includeDeactivated: true });
      if (!user) return res.status(404).json({ error: 'User not found' });

      // Find the user's archived bindings — only restore those whose
      // tenant is still active.
      const bindings = await db.any(
        `SELECT b.id, b.tenant_id, b.entity_type, b.entity_id, t.schema_name, t.deactivated_at AS tenant_deactivated
         FROM admin.portal_user_tenants b
         JOIN admin.tenants t ON t.id = b.tenant_id
         WHERE b.portal_user_id = $1 AND b.deactivated_at IS NOT NULL`,
        [user.id],
      );

      // If the user had bindings, refuse the restore unless at least one
      // of their tenants is still active. A user with no bindings (e.g.
      // bare registered users) restores without cascade.
      const restorable = bindings.filter((b) => b.tenant_deactivated === null);
      if (bindings.length && !restorable.length) {
        return res.status(403).json({ error: 'No active tenant binding to restore. Restore the tenant first.' });
      }

      const updatedBy = req.user?.id || null;
      await db.tx(async (t) => {
        await t.none(
          `UPDATE admin.portal_users
           SET deactivated_at = NULL, status = 'active', updated_by = $1, updated_at = NOW()
           WHERE id = $2`,
          [updatedBy, user.id],
        );
        for (const b of restorable) {
          await t.none(
            `UPDATE admin.portal_user_tenants
             SET deactivated_at = NULL, status = 'active', updated_by = $1, updated_at = NOW()
             WHERE id = $2`,
            [updatedBy, b.id],
          );
        }
      });

      for (const b of restorable) {
        await this.#restoreLinkedEntity(b, req);
      }

      res.status(200).json({ message: `${this.errorLabel} marked as active` });
    } catch (err) {
      this.handleError(err, res, 'restoring', this.errorLabel);
    }
  }

  /* ── Private helpers ──────────────────────────────────── */

  /**
   * Archive the entity linked through a portal_user_tenants binding.
   */
  async #archiveLinkedEntity(binding, req) {
    const tenant = await db('tenants', 'admin').findOneBy([{ id: binding.tenant_id }]);
    if (!tenant?.schema_name) return;

    const table = this.#entityTable(binding.entity_type);
    if (!table) return;

    await db.none(
      `UPDATE ${pgp.as.name(tenant.schema_name)}.${pgp.as.name(table)}
       SET deactivated_at = NOW(), updated_by = $1, updated_at = NOW()
       WHERE id = $2 AND deactivated_at IS NULL`,
      [req.user?.id || null, binding.entity_id],
    );
    logger.info(`Cascaded archive to ${tenant.schema_name}.${table} ${binding.entity_id}`);
  }

  /**
   * Restore the entity linked through a portal_user_tenants binding.
   */
  async #restoreLinkedEntity(binding, req) {
    const schemaName = binding.schema_name
      || (await db('tenants', 'admin').findOneBy([{ id: binding.tenant_id }]))?.schema_name;
    if (!schemaName) return;

    const table = this.#entityTable(binding.entity_type);
    if (!table) return;

    await db.none(
      `UPDATE ${pgp.as.name(schemaName)}.${pgp.as.name(table)}
       SET deactivated_at = NULL, updated_by = $1, updated_at = NOW()
       WHERE id = $2 AND deactivated_at IS NOT NULL`,
      [req.user?.id || null, binding.entity_id],
    );
    logger.info(`Cascaded restore to ${schemaName}.${table} ${binding.entity_id}`);
  }

  /**
   * Map entity_type to its table name.
   */
  #entityTable(entityType) {
    const map = { employee: 'employees', vendor_contact: 'vendor_contacts', client: 'clients' };
    return map[entityType] || null;
  }
}

const instance = new PortalUsersController();

export { PortalUsersController };
export default instance;
