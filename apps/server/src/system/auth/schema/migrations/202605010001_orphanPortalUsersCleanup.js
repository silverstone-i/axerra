/**
 * @file Migration: install admin-scope find_orphan_portal_users / cleanup_orphan_portal_users functions
 * @module auth/schema/migrations/202605010001_orphanPortalUsersCleanup
 *
 * portal_users rows are considered orphaned only when no portal_user_tenants
 * row references them — active OR archived. Archived bindings still represent
 * recoverable history, so the helpers must not classify those portal_users as
 * orphans. Hard-delete is correct here — true orphans have no bindings at all
 * and therefore no downstream entity references.
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import { defineMigration } from '../../../../db/migrations/defineMigration.js';

export default defineMigration({
  id: '202605010001-orphan-portal-users-cleanup',
  description: 'Install admin.find_orphan_portal_users / cleanup_orphan_portal_users functions',

  async up({ schema, db }) {
    if (schema !== 'admin') return;
    await db.none(`
      CREATE OR REPLACE FUNCTION admin.find_orphan_portal_users()
      RETURNS TABLE (id uuid, email varchar, status varchar, created_at timestamptz)
      LANGUAGE sql STABLE AS $fn$
        SELECT pu.id, pu.email, pu.status, pu.created_at
        FROM admin.portal_users pu
        WHERE NOT EXISTS (
          SELECT 1
          FROM admin.portal_user_tenants put
          WHERE put.portal_user_id = pu.id
        )
        ORDER BY pu.created_at;
      $fn$;

      CREATE OR REPLACE FUNCTION admin.cleanup_orphan_portal_user(p_id uuid)
      RETURNS TABLE (id uuid, email varchar, status varchar)
      LANGUAGE sql AS $fn$
        DELETE FROM admin.portal_users pu
        WHERE pu.id = p_id
          AND NOT EXISTS (
            SELECT 1
            FROM admin.portal_user_tenants put
            WHERE put.portal_user_id = pu.id
          )
        RETURNING pu.id, pu.email, pu.status;
      $fn$;
    `);
  },

  async down({ schema, db }) {
    if (schema !== 'admin') return;
    await db.none(`
      DROP FUNCTION IF EXISTS admin.cleanup_orphan_portal_user(uuid);
      DROP FUNCTION IF EXISTS admin.find_orphan_portal_users();
    `);
  },
});
