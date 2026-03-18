/**
 * @file Migration: add emails + vendor_contacts tables, migrate email data
 * @module core/schema/migrations/202603180014_emailsAndVendorContacts
 *
 * 1. Widen sources.source_type CHECK to include 'vendor_contact'
 * 2. Create emails and vendor_contacts tables
 * 3. Migrate existing email column data from employees, clients, contacts into emails table
 * 4. Drop email columns from employees, clients, contacts
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
 */

import { defineMigration } from '../../../../db/migrations/defineMigration.js';
import { isTableModel, getModelKey, orderModels } from '../../../../db/migrations/modelPlanner.js';

const NEW_TABLES = new Set(['emails', 'vendor_contacts']);

export default defineMigration({
  id: '202603180014-emails-and-vendor-contacts',
  description: 'Add emails and vendor_contacts tables, migrate email data from entity columns',

  async up({ schema, models, db: t }) {
    if (schema === 'admin') return;

    const s = schema;

    // 1. Widen the sources CHECK constraint to include 'vendor_contact'
    await t.none(`
      ALTER TABLE ${s}.sources
        DROP CONSTRAINT IF EXISTS sources_source_type_check
    `);
    await t.none(`
      ALTER TABLE ${s}.sources
        ADD CONSTRAINT sources_source_type_check
        CHECK (source_type IN ('vendor', 'client', 'employee', 'contact', 'company', 'vendor_contact'))
    `);

    // 2. Create emails and vendor_contacts tables via model.createTable()
    const newModels = Object.values(models).filter(
      (m) => isTableModel(m) && NEW_TABLES.has(m.schema?.table),
    );
    if (newModels.length) {
      const ordered = orderModels(
        Object.fromEntries(newModels.map((model) => [getModelKey(model), model])),
      );
      for (const model of ordered) {
        await model.createTable();
      }
    }

    // 3. Migrate employee emails — insert into emails table from employees.email
    await t.none(`
      INSERT INTO ${s}.emails (tenant_id, source_id, email, label, is_primary, is_login, created_by, updated_by)
      SELECT
        e.tenant_id,
        e.source_id,
        e.email,
        'work',
        true,
        e.is_app_user,
        e.created_by,
        e.updated_by
      FROM ${s}.employees e
      WHERE e.email IS NOT NULL
        AND e.source_id IS NOT NULL
        AND e.deactivated_at IS NULL
    `);

    // 4. Migrate client emails
    await t.none(`
      INSERT INTO ${s}.emails (tenant_id, source_id, email, label, is_primary, is_login, created_by, updated_by)
      SELECT
        c.tenant_id,
        c.source_id,
        c.email,
        'work',
        true,
        false,
        c.created_by,
        c.updated_by
      FROM ${s}.clients c
      WHERE c.email IS NOT NULL
        AND c.source_id IS NOT NULL
        AND c.deactivated_at IS NULL
    `);

    // 5. Migrate contact emails
    await t.none(`
      INSERT INTO ${s}.emails (tenant_id, source_id, email, label, is_primary, is_login, created_by, updated_by)
      SELECT
        ct.tenant_id,
        ct.source_id,
        ct.email,
        'work',
        true,
        false,
        ct.created_by,
        ct.updated_by
      FROM ${s}.contacts ct
      WHERE ct.email IS NOT NULL
        AND ct.source_id IS NOT NULL
        AND ct.deactivated_at IS NULL
    `);

    // 6. Drop email columns from entity tables
    await t.none(`ALTER TABLE ${s}.employees DROP COLUMN IF EXISTS email`);
    await t.none(`ALTER TABLE ${s}.clients DROP COLUMN IF EXISTS email`);
    await t.none(`ALTER TABLE ${s}.contacts DROP COLUMN IF EXISTS email`);
  },

  async down({ schema, db: t }) {
    if (schema === 'admin') return;

    const s = schema;

    // Re-add email columns
    await t.none(`ALTER TABLE ${s}.employees ADD COLUMN IF NOT EXISTS email varchar(128)`);
    await t.none(`ALTER TABLE ${s}.clients ADD COLUMN IF NOT EXISTS email varchar(128)`);
    await t.none(`ALTER TABLE ${s}.contacts ADD COLUMN IF NOT EXISTS email varchar(128)`);

    // Restore employee emails from the emails table (primary email)
    await t.none(`
      UPDATE ${s}.employees e
      SET email = em.email
      FROM ${s}.emails em
      JOIN ${s}.sources src ON src.id = em.source_id
      WHERE src.table_id = e.id
        AND src.source_type = 'employee'
        AND em.is_primary = true
        AND em.deactivated_at IS NULL
    `);

    // Restore client emails
    await t.none(`
      UPDATE ${s}.clients c
      SET email = em.email
      FROM ${s}.emails em
      JOIN ${s}.sources src ON src.id = em.source_id
      WHERE src.table_id = c.id
        AND src.source_type = 'client'
        AND em.is_primary = true
        AND em.deactivated_at IS NULL
    `);

    // Restore contact emails
    await t.none(`
      UPDATE ${s}.contacts ct
      SET email = em.email
      FROM ${s}.emails em
      JOIN ${s}.sources src ON src.id = em.source_id
      WHERE src.table_id = ct.id
        AND src.source_type = 'contact'
        AND em.is_primary = true
        AND em.deactivated_at IS NULL
    `);

    // Drop new tables
    await t.none(`DROP TABLE IF EXISTS ${s}.vendor_contacts CASCADE`);
    await t.none(`DROP TABLE IF EXISTS ${s}.emails CASCADE`);

    // Restore sources CHECK constraint
    await t.none(`ALTER TABLE ${s}.sources DROP CONSTRAINT IF EXISTS sources_source_type_check`);
    await t.none(`
      ALTER TABLE ${s}.sources
        ADD CONSTRAINT sources_source_type_check
        CHECK (source_type IN ('vendor', 'client', 'employee', 'contact', 'company'))
    `);
  },
});
