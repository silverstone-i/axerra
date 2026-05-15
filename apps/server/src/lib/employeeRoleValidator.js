/**
 * @file Validate role codes assigned to an employee/client
 * @module server/lib/employeeRoleValidator
 *
 * Ensures every role code on an employee (or client) exists in the tenant's
 * `roles` table. Used by both the controllers and the flat-import reconciler
 * so the rule is enforced everywhere a record is created or updated —
 * regardless of `is_app_user` state, so a roleless record never exists.
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

// Lazy-load pgp to avoid module-load-order cycles with the pg-schemata
// repositories map (db.js → repositories → modules → controllers → here).
let _pgp;
async function getPgp() {
  if (!_pgp) {
    const mod = await import('../db/db.js');
    _pgp = mod.pgp;
  }
  return _pgp;
}

/**
 * Validate a roles array against the tenant's active roles table.
 *
 * @param {Object}    tOrDb         pg-promise transaction OR db handle
 * @param {string}    schema        tenant schema name
 * @param {string[]}  roles         the roles[] value to validate
 * @returns {Promise<{ok: true} | {ok: false, code: 'empty'|'unknown', error: string, invalid?: string[]}>}
 */
export async function validateEmployeeRoles(tOrDb, schema, roles) {
  const arr = Array.isArray(roles)
    ? roles.map((r) => (r == null ? '' : String(r).trim())).filter((r) => r !== '')
    : [];

  if (!arr.length) {
    return {
      ok: false,
      code: 'empty',
      error: 'At least one role must be assigned',
    };
  }

  const pgp = await getPgp();
  const s = pgp.as.name(schema);
  // `roles` is configured with softDelete: false — no deactivated_at column.
  const validRows = await tOrDb.any(`SELECT code FROM ${s}.roles`);
  const valid = new Set(validRows.map((r) => String(r.code).toLowerCase()));
  const invalid = arr.filter((r) => !valid.has(r.toLowerCase()));

  if (invalid.length) {
    return {
      ok: false,
      code: 'unknown',
      invalid,
      error: `Unknown role code${invalid.length > 1 ? 's' : ''}: ${invalid.join(', ')}`,
    };
  }
  return { ok: true };
}
