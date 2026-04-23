/**
 * @file Migration: rename admin.nap_users → admin.portal_users
 * @module auth/schema/migrations/202604231200_renameNapUsersToPortalUsers
 *
 * Part of the Vimber rebrand. Earlier installs created the admin-scope
 * login table as `nap_users`; the table's role is platform-wide portal
 * login for all tenants' users, so this migration renames it to
 * `portal_users`. FKs from admin.impersonation_logs follow the rename
 * automatically; no data transformation needed. Fresh installs create
 * the new name directly via the updated bootstrap migration and
 * `portalUsersSchema.js` — this migration is a no-op there.
 *
 * Copyright (c) 2025 – present Vimber LLC. All rights reserved.
 */

import { defineMigration } from '../../../../db/migrations/defineMigration.js';

export default defineMigration({
  id: '202604231200-rename-nap-users-to-portal-users',
  description: 'Rename admin.nap_users → admin.portal_users',

  async up({ schema, db }) {
    if (schema !== 'admin') return;

    const hasOld = await db.oneOrNone(
      `SELECT 1
         FROM information_schema.tables
        WHERE table_schema = 'admin' AND table_name = 'nap_users'`,
    );
    if (!hasOld) return;

    const hasNew = await db.oneOrNone(
      `SELECT 1
         FROM information_schema.tables
        WHERE table_schema = 'admin' AND table_name = 'portal_users'`,
    );
    if (hasNew) {
      throw new Error(
        'admin.portal_users already exists alongside admin.nap_users — resolve manually before running this migration',
      );
    }

    await db.none('ALTER TABLE admin.nap_users RENAME TO portal_users');
  },

  async down({ schema, db }) {
    if (schema !== 'admin') return;

    const hasNew = await db.oneOrNone(
      `SELECT 1
         FROM information_schema.tables
        WHERE table_schema = 'admin' AND table_name = 'portal_users'`,
    );
    if (!hasNew) return;

    await db.none('ALTER TABLE admin.portal_users RENAME TO nap_users');
  },
});
