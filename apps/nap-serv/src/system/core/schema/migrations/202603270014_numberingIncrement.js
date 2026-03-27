/**
 * @file Migration: add increment column to tenant_numbering_config
 * @module core/schema/migrations/202603270014_numberingIncrement
 *
 * Adds an `increment` integer column (default 1) so numbering sequences
 * can skip values (e.g. 10, 20, 30 when increment = 10).
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
 */

import { defineMigration } from '../../../../db/migrations/defineMigration.js';

export default defineMigration({
  id: '202603270014-numbering-increment',
  description: 'Add increment column to tenant_numbering_config',

  async up({ schema, db, pgp }) {
    if (schema === 'admin') return;
    const s = pgp.as.name(schema);
    await db.none(`
      ALTER TABLE ${s}.tenant_numbering_config
      ADD COLUMN IF NOT EXISTS increment integer NOT NULL DEFAULT 1
      CHECK (increment >= 1)
    `);
  },

  async down({ schema, db, pgp }) {
    if (schema === 'admin') return;
    const s = pgp.as.name(schema);
    await db.none(`ALTER TABLE ${s}.tenant_numbering_config DROP COLUMN IF EXISTS increment`);
  },
});
