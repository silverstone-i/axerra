/**
 * @file seedRootEntity — link the Axerra root portal_user to a real employees row
 * @module server/services/seedRootEntity
 *
 * Bridges admin.portal_users (auth identity) and the tenant-scoped employees
 * table (RBAC source-of-truth via the entity → roles → policies chain). Used
 * by both the production `setupAdmin` script and the test bootstrap so that
 * `loadPermissions` resolves real caps for the root user instead of the
 * empty-canon shortcut taken on bare bindings.
 *
 * Idempotent: if a binding already has its entity link populated, returns
 * without changes. If a bare binding (entity_type IS NULL) exists, it's
 * updated in place to preserve the unique (portal_user_id, tenant_id) row.
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

/**
 * @param {Object} opts
 * @param {Object} opts.db         pg-promise database connection
 * @param {Object} opts.pgp        pg-promise helpers (for as.name)
 * @param {Object} opts.logger     winston-style logger
 * @param {string} opts.tenantSchema  Tenant schema name (e.g. 'axerra')
 * @param {string} opts.rootEmail     Email of the admin.portal_users row to bind
 * @param {boolean} [opts.includeLoginEmail=true]
 *   Insert a tenant-scoped emails row mirroring the login email. Defaults true
 *   for production parity. Tests can pass false — rbac resolution doesn't
 *   need it and the row would fight the test cleanup path.
 * @returns {Promise<{employeeId: string, bindingId: string} | null>}
 *   Returns the new IDs on first run, null if already linked.
 */
export async function seedRootEntity({ db, pgp, logger, tenantSchema, rootEmail, includeLoginEmail = true }) {
  if (!rootEmail) return null;

  const superUser = await db.oneOrNone(
    'SELECT id FROM admin.portal_users WHERE email = $1 AND deactivated_at IS NULL',
    [rootEmail],
  );
  if (!superUser) {
    logger?.warn?.('seedRootEntity: portal_user not found', { email: rootEmail });
    return null;
  }

  const tenant = await db.oneOrNone(
    'SELECT id FROM admin.tenants WHERE schema_name = $1 AND deactivated_at IS NULL',
    [tenantSchema],
  );
  if (!tenant) {
    logger?.warn?.('seedRootEntity: tenant not found', { tenantSchema });
    return null;
  }

  const existingBinding = await db.oneOrNone(
    `SELECT id, entity_type, entity_id FROM admin.portal_user_tenants
     WHERE portal_user_id = $1 AND tenant_id = $2 AND deactivated_at IS NULL`,
    [superUser.id, tenant.id],
  );

  const s = pgp.as.name(tenantSchema);

  // A binding is only "linked" if BOTH entity_type AND entity_id are set
  // AND the referenced employee row actually exists in the tenant schema.
  // The portal_user_tenants schema doesn't enforce that pairing, and
  // dropping/recreating the tenant schema can leave the binding pointing
  // at a vanished employee — both cases must trigger a repair.
  if (existingBinding && existingBinding.entity_type !== null && existingBinding.entity_id !== null) {
    const referenced = await db.oneOrNone(
      `SELECT id FROM ${s}.employees WHERE id = $1 AND deactivated_at IS NULL`,
      [existingBinding.entity_id],
    );
    if (referenced) {
      logger?.info?.('Root super user already linked to entity, skipping.');
      return null;
    }
    logger?.info?.('Existing binding references a missing employee — repairing.');
  }

  logger?.info?.('Linking root super user to employee record...');

  // Find an existing System/Administrator employee scoped to THIS tenant
  // and verified to carry the super_user role. The idempotent path used
  // by the test bootstrap is: axerra schema persists across the admin
  // truncation between test files but the binding is recreated. The
  // tenant_id and roles checks ensure we never bind to an unrelated
  // employee that happens to share the System/Administrator name.
  const existingEmployee = await db.oneOrNone(
    `SELECT id FROM ${s}.employees
     WHERE first_name = 'System' AND last_name = 'Administrator'
       AND tenant_id = $1
       AND 'super_user' = ANY(roles)
       AND deactivated_at IS NULL
     ORDER BY created_at ASC
     LIMIT 1`,
    [tenant.id],
  );

  let employee;
  if (existingEmployee) {
    employee = existingEmployee;
    // Defensive re-assert that the role is present and the row is the
    // primary contact — protects against a partial seed from an earlier
    // failed run.
    await db.none(
      `UPDATE ${s}.employees
       SET roles = ARRAY(SELECT DISTINCT unnest(roles || '{super_user}')),
           is_primary_contact = true
       WHERE id = $1`,
      [employee.id],
    );
    logger?.info?.(`Reusing existing System Administrator employee ${employee.id}`);
  } else {
    employee = await db.one(
      `INSERT INTO ${s}.employees
         (tenant_id, first_name, last_name, is_app_user, roles, is_primary_contact)
       VALUES ($1, 'System', 'Administrator', true, '{super_user}', true)
       RETURNING id`,
      [tenant.id],
    );

    const source = await db.one(
      `INSERT INTO ${s}.sources (tenant_id, table_id, source_type, label)
       VALUES ($1, $2, 'employee', 'System Administrator')
       RETURNING id`,
      [tenant.id, employee.id],
    );

    await db.none(`UPDATE ${s}.employees SET source_id = $1 WHERE id = $2`, [source.id, employee.id]);

    if (includeLoginEmail) {
      await db.one(
        `INSERT INTO ${s}.emails
           (tenant_id, source_id, email, label, is_primary, is_login)
         VALUES ($1, $2, $3, 'work', true, true)
         RETURNING id`,
        [tenant.id, source.id, rootEmail],
      );
    }
  }

  let bindingId;
  if (existingBinding) {
    const updated = await db.one(
      `UPDATE admin.portal_user_tenants
       SET entity_type = 'employee', entity_id = $1, status = 'active'
       WHERE id = $2
       RETURNING id`,
      [employee.id, existingBinding.id],
    );
    bindingId = updated.id;
  } else {
    const inserted = await db.one(
      `INSERT INTO admin.portal_user_tenants (portal_user_id, tenant_id, entity_type, entity_id, status)
       VALUES ($1, $2, 'employee', $3, 'active')
       RETURNING id`,
      [superUser.id, tenant.id, employee.id],
    );
    bindingId = inserted.id;
  }

  logger?.info?.(`Root super user bound to employee ${employee.id}`);
  return { employeeId: employee.id, bindingId };
}

export default seedRootEntity;
