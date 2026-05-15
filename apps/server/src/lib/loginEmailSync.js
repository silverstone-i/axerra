/**
 * @file Login email + portal_users sync service
 * @module server/lib/loginEmailSync
 *
 * Shared business rules for keeping `admin.portal_users.email` in sync with
 * the per-tenant `emails` row flagged `is_login = true`. Used by both the
 * emails controller (single-row CRUD) and the flat-import reconciler (bulk
 * spreadsheet imports). Functions are pure of req/res — callers pass plain
 * arguments and a transaction handle (or `db` for outside-tx use).
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

// Lazy-load db/pgp to avoid module-load-order issues with the pg-schemata
// repositories map (db.js → repositories → moduleRegistry → models → this
// module would be a cycle if imported eagerly).
let _pgp;
async function getPgp() {
  if (!_pgp) {
    const mod = await import('../db/db.js');
    _pgp = mod.pgp;
  }
  return _pgp;
}

/** Tenant schema entity table for each polymorphic source_type. */
export const ENTITY_TABLE_BY_SOURCE_TYPE = {
  employee: 'employees',
  client: 'clients',
  vendor_contact: 'vendor_contacts',
};

/**
 * Update `admin.portal_users.email` for the binding linked to (sourceId,
 * tenantId). No-op when no binding exists or the source_type isn't one of
 * the login-bearing entities. Throws on actual DB errors so callers can
 * surface them.
 *
 * @param {Object} tOrDb       pg-promise transaction OR the db instance
 * @param {string} schema      tenant schema name (used for the sources lookup)
 * @param {string} sourceId    polymorphic source id
 * @param {string} email       new login email value
 * @param {Object} opts
 * @param {string} opts.tenantId  the tenant that owns the binding to update
 * @param {string} [opts.userId]  caller user id for updated_by audit
 */
export async function syncLoginEmail(tOrDb, schema, sourceId, email, opts) {
  const { tenantId, userId = null } = opts || {};
  if (!tenantId) return;
  const pgp = await getPgp();
  const s = pgp.as.name(schema);

  const source = await tOrDb.oneOrNone(
    `SELECT table_id, source_type FROM ${s}.sources WHERE id = $1 AND deactivated_at IS NULL`,
    [sourceId],
  );
  if (!source) return;
  if (!ENTITY_TABLE_BY_SOURCE_TYPE[source.source_type]) return;

  const binding = await tOrDb.oneOrNone(
    `SELECT portal_user_id FROM admin.portal_user_tenants
     WHERE entity_type = $1 AND entity_id = $2 AND tenant_id = $3 AND deactivated_at IS NULL`,
    [source.source_type, source.table_id, tenantId],
  );
  if (!binding) return;

  // Normalize the new login email so case-only variants can't bypass the
  // case-sensitive unique index on admin.portal_users.email.
  const normEmail = email == null ? null : String(email).trim().toLowerCase();
  await tOrDb.none(
    `UPDATE admin.portal_users SET email = $1, updated_by = $2
     WHERE id = $3 AND deactivated_at IS NULL`,
    [normEmail, userId, binding.portal_user_id],
  );
}

/**
 * True when the entity linked to `sourceId` is NOT an active app user — i.e.
 * the `is_login` flag can be safely cleared without breaking a live login.
 * Returns true when there is no matching source/entity (defensive: nothing
 * to break).
 *
 * @param {Object} tOrDb   pg-promise transaction OR the db instance
 * @param {string} schema  tenant schema name
 * @param {string} sourceId
 * @returns {Promise<boolean>}
 */
export async function canUnsetLogin(tOrDb, schema, sourceId) {
  const pgp = await getPgp();
  const s = pgp.as.name(schema);
  const source = await tOrDb.oneOrNone(
    `SELECT table_id, source_type FROM ${s}.sources WHERE id = $1 AND deactivated_at IS NULL`,
    [sourceId],
  );
  if (!source) return true;
  const table = ENTITY_TABLE_BY_SOURCE_TYPE[source.source_type];
  if (!table) return true;

  const entity = await tOrDb.oneOrNone(
    `SELECT is_app_user FROM ${s}.${table} WHERE id = $1 AND deactivated_at IS NULL`,
    [source.table_id],
  );
  return !entity?.is_app_user;
}

