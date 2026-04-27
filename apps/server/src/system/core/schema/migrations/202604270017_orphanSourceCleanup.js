/**
 * @file Migration: install per-tenant find_orphan_sources / cleanup_orphan_sources functions
 * @module core/schema/migrations/202604270017_orphanSourceCleanup
 *
 * Polymorphic `sources` rows can become orphaned when an owning entity is
 * hard-deleted (the FK direction `vendors.source_id → sources.id ON DELETE
 * CASCADE` only cascades when the source is removed, not the entity). These
 * helpers let tenants discover and remove orphans inside their own schema.
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import { defineMigration } from '../../../../db/migrations/defineMigration.js';

export default defineMigration({
  id: '202604270017-orphan-source-cleanup',
  description: 'Install per-tenant find_orphan_sources / cleanup_orphan_sources functions',

  async up({ schema, db, pgp }) {
    if (schema === 'admin') return;
    const s = pgp.as.name(schema);
    await db.none(`
      CREATE OR REPLACE FUNCTION ${s}.find_orphan_sources()
      RETURNS TABLE (source_id uuid, source_type varchar, table_id uuid, label varchar, created_at timestamptz)
      LANGUAGE sql STABLE AS $fn$
        SELECT s.id, s.source_type, s.table_id, s.label, s.created_at
        FROM ${s}.sources s
        LEFT JOIN ${s}.vendors         v  ON s.source_type='vendor'         AND v.id =s.table_id
        LEFT JOIN ${s}.clients         c  ON s.source_type='client'         AND c.id =s.table_id
        LEFT JOIN ${s}.employees       e  ON s.source_type='employee'       AND e.id =s.table_id
        LEFT JOIN ${s}.contacts        ct ON s.source_type='contact'        AND ct.id=s.table_id
        LEFT JOIN ${s}.companies       co ON s.source_type='company'        AND co.id=s.table_id
        LEFT JOIN ${s}.vendor_contacts vc ON s.source_type='vendor_contact' AND vc.id=s.table_id
        WHERE COALESCE(v.id, c.id, e.id, ct.id, co.id, vc.id) IS NULL
        ORDER BY s.created_at;
      $fn$;

      CREATE OR REPLACE FUNCTION ${s}.cleanup_orphan_sources()
      RETURNS TABLE (source_id uuid, source_type varchar, table_id uuid, label varchar)
      LANGUAGE sql AS $fn$
        WITH orphans AS (SELECT source_id FROM ${s}.find_orphan_sources())
        DELETE FROM ${s}.sources WHERE id IN (SELECT source_id FROM orphans)
        RETURNING id, source_type, table_id, label;
      $fn$;
    `);
  },

  async down({ schema, db, pgp }) {
    if (schema === 'admin') return;
    const s = pgp.as.name(schema);
    await db.none(`
      DROP FUNCTION IF EXISTS ${s}.cleanup_orphan_sources();
      DROP FUNCTION IF EXISTS ${s}.find_orphan_sources();
    `);
  },
});
