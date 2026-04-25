/**
 * @file Clear is_primary on sibling rows when promoting a new primary record.
 * @module lib/clearOtherPrimary
 *
 * Used by child-entity controllers (emails, phone_numbers) to enforce the
 * single-primary-per-parent invariant before INSERT or UPDATE.
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import { pgp } from '../db/db.js';

/**
 * Set `is_primary = false` on every active sibling that currently holds the flag.
 *
 * @param {import('pg-promise').IBaseProtocol} t  – pg-promise task / tx / db
 * @param {string} schema    – tenant schema name (unquoted)
 * @param {string} table     – unqualified table name
 * @param {string} scopeCol  – parent FK column ('source_id')
 * @param {string} scopeVal  – UUID of the parent record
 * @param {string|null} excludeId – row id to *keep* as primary (null on INSERT)
 * @param {string|null} actorId   – req.user?.id for the updated_by audit column
 */
export async function clearOtherPrimary(t, schema, table, scopeCol, scopeVal, excludeId, actorId) {
  const s = pgp.as.name(schema);
  const tbl = pgp.as.name(table);
  const col = pgp.as.name(scopeCol);

  const hasExclude = excludeId !== null && excludeId !== undefined;
  const exclude = hasExclude ? 'AND id != $3' : '';
  const params = hasExclude ? [actorId, scopeVal, excludeId] : [actorId, scopeVal];

  await t.none(
    `UPDATE ${s}.${tbl}
     SET is_primary = false, updated_by = $1, updated_at = now()
     WHERE ${col} = $2 AND is_primary = true AND deactivated_at IS NULL ${exclude}`,
    params,
  );
}
