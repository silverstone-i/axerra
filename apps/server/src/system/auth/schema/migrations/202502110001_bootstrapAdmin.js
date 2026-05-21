/**
 * @file Migration: bootstrap admin schema tables and seed root tenant + super user
 * @module auth/schema/migrations/202502110001_bootstrapAdmin
 *
 * Creates admin schema tables (tenants, portal_users, portal_user_tenants,
 * impersonation_logs, match_review_logs). Seeds the Axerra root tenant
 * and a bootstrap super user. The tenant binding (portal_user_tenants
 * row) is created by setupAdmin.js after tenant provisioning creates
 * the employees table.
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import bcrypt from 'bcrypt';
import { defineMigration } from '../../../../db/migrations/defineMigration.js';
import { isTableModel, getModelKey, orderModels } from '../../../../db/migrations/modelPlanner.js';

export default defineMigration({
  id: '202502110001-bootstrap-admin',
  description: 'Create admin schema tables and seed root tenant + super user',

  async up({ schema, models, ensureExtensions, db }) {
    if (schema !== 'admin') return;

    await ensureExtensions(['pgcrypto', 'uuid-ossp', 'vector']);

    // Filter to admin-scope table models and create in dependency order
    const adminModels = Object.values(models)
      .filter(isTableModel)
      .filter((model) => model.schema?.dbSchema === 'admin');

    if (!adminModels.length) return;

    const ordered = orderModels(Object.fromEntries(adminModels.map((model) => [getModelKey(model), model])));

    for (const model of ordered) {
      if (model.schema?.dbSchema !== 'admin' && typeof model.setSchemaName === 'function') {
        model.setSchemaName('admin');
      }
      await model.createTable();
    }

    // ── Seed root tenant ──────────────────────────────────────────
    const rootTenantCode = process.env.ROOT_TENANT_CODE || 'AXERRA';
    const rootCompany = process.env.ROOT_COMPANY || 'Axerra LLC';
    const rootSchema = rootTenantCode.toLowerCase();

    // Check if root tenant already exists (idempotent)
    const existing = await db.oneOrNone(
      'SELECT id FROM admin.tenants WHERE tenant_code = $1',
      [rootTenantCode],
    );

    if (!existing) {
      await db.none(
        `INSERT INTO admin.tenants (tenant_code, company, schema_name, status, tier, allowed_modules)
         VALUES ($1, $2, $3, 'active', 'enterprise', $4)`,
        [rootTenantCode, rootCompany, rootSchema, JSON.stringify([])],
      );
    }

    // ── Seed super user ───────────────────────────────────────────
    const rootEmail = process.env.ROOT_EMAIL;
    const rootPassword = process.env.ROOT_PASSWORD;

    if (rootEmail && rootPassword) {
      const existingUser = await db.oneOrNone(
        'SELECT id FROM admin.portal_users WHERE email = $1 AND deactivated_at IS NULL',
        [rootEmail],
      );

      if (!existingUser) {
        const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
        const passwordHash = await bcrypt.hash(rootPassword, rounds);

        await db.none(
          `INSERT INTO admin.portal_users (email, password_hash, status)
           VALUES ($1, $2, 'active')`,
          [rootEmail, passwordHash],
        );
      }
    }
  },

  async down({ schema, db }) {
    if (schema !== 'admin') return;

    // Drop in reverse dependency order
    const tables = ['match_review_logs', 'impersonation_logs', 'portal_user_tenants', 'portal_users', 'tenants'];
    for (const table of tables) {
      await db.none(`DROP TABLE IF EXISTS admin.${table} CASCADE`);
    }
  },
});
