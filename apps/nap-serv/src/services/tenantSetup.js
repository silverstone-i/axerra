/**
 * @file tenantSetup — end-to-end tenant provisioning helper
 * @module nap-serv/services/tenantSetup
 *
 * Extracted from TenantsController.create() so the Tenants model can call it
 * during spreadsheet import without creating a circular dependency.
 *
 * Copyright (c) 2025 – present Vimber LLC. All rights reserved.
 */

import bcrypt from 'bcrypt';

const SCHEMA_NAME_RE = /^[a-z][a-z0-9_]*$/;

/** Lazy-load heavy modules to avoid triggering migration/moduleRegistry at import time (breaks unit tests) */
let _db, _pgp, _provisionTenant, _logger;
async function deps() {
  if (!_db) {
    const dbMod = await import('../db/db.js');
    _db = dbMod.default;
    _pgp = dbMod.pgp;
    const prov = await import('./tenantProvisioning.js');
    _provisionTenant = prov.provisionTenant;
    const log = await import('../lib/logger.js');
    _logger = log.default;
  }
  return { db: _db, pgp: _pgp, provisionTenant: _provisionTenant, logger: _logger };
}

/**
 * Provision a brand-new tenant end-to-end: insert tenant record, create schema,
 * run migrations, seed RBAC, create self-company with billing address + tax IDs,
 * create admin employee + nap_users login.
 *
 * @param {Object} body  Same shape as POST / request body
 * @param {string|null} actorId  UUID of the acting user (created_by)
 * @returns {Promise<{tenant: Object, admin_user_id: string, company_id: string, source_id: string}>}
 */
export async function provisionNewTenant(body, actorId) {
  const {
    tenant_code,
    company,
    schema_name,
    status,
    tier,
    region,
    allowed_modules,
    max_users,
    notes,
    billing_address,
    tax_identifiers,
    admin_first_name,
    admin_last_name,
    admin_email,
    admin_password,
    admin_phone,
  } = body;

  if (!tenant_code || !company) {
    throw Object.assign(new Error('tenant_code and company are required'), { statusCode: 400 });
  }
  if (!billing_address || !billing_address.address_line_1 || !billing_address.country_code) {
    throw Object.assign(new Error('billing_address with address_line_1 and country_code is required'), { statusCode: 400 });
  }
  if (!admin_first_name || !admin_last_name) {
    throw Object.assign(new Error('admin_first_name and admin_last_name are required'), { statusCode: 400 });
  }
  if (!admin_email || !admin_password) {
    throw Object.assign(new Error('admin_email and admin_password are required'), { statusCode: 400 });
  }

  const schemaName = (schema_name || tenant_code).toLowerCase();
  if (!SCHEMA_NAME_RE.test(schemaName) || schemaName.length > 63) {
    throw Object.assign(
      new Error('schema_name must start with a letter, contain only lowercase letters/digits/underscores, and not exceed 63 characters'),
      { statusCode: 400 },
    );
  }

  const { db, pgp, provisionTenant, logger } = await deps();
  const upperCode = tenant_code.toUpperCase();

  // 1. Insert tenant record
  const tenant = await db('tenants', 'admin').insert({
    tenant_code: upperCode,
    company,
    schema_name: schemaName,
    status: status || 'active',
    tier: tier || 'starter',
    region: region || null,
    allowed_modules: allowed_modules || [],
    max_users: max_users || 5,
    notes: notes || null,
    created_by: actorId,
  });

  // 2. Provision tenant schema (create schema, run migrations, seed RBAC)
  try {
    await provisionTenant({ schemaName, tenantCode: upperCode, createdBy: actorId });
  } catch (provisionErr) {
    logger.error(`Schema provisioning failed for "${schemaName}":`, { error: provisionErr.message });
    try {
      await db('tenants', 'admin').updateWhere(
        [{ id: tenant.id }],
        { deactivated_at: new Date(), updated_by: actorId },
      );
    } catch {
      /* best effort */
    }
    throw new Error(`Schema provisioning failed: ${provisionErr.message}`);
  }

  // 3. Create company + address + tax IDs + admin employee + nap_users in a single transaction
  const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
  const passwordHash = await bcrypt.hash(admin_password, rounds);
  const sch = pgp.as.name(schemaName);
  const taxIds = Array.isArray(tax_identifiers) ? tax_identifiers : [];

  const result = await db.tx(async (t) => {
    // 3a. Create the tenant's self-company record
    const comp = await t.one(
      `INSERT INTO ${sch}.companies (tenant_id, code, name, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [tenant.id, upperCode, company, actorId],
    );

    // 3b. Create sources record for the company (polymorphic link)
    const source = await t.one(
      `INSERT INTO ${sch}.sources (tenant_id, table_id, source_type, label, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [tenant.id, comp.id, 'company', company, actorId],
    );

    // 3c. Back-link source_id onto the company
    await t.none(
      `UPDATE ${sch}.companies SET source_id = $1, updated_by = $2 WHERE id = $3`,
      [source.id, actorId, comp.id],
    );

    // 3d. Insert billing address
    await t.one(
      `INSERT INTO ${sch}.addresses
         (tenant_id, source_id, label, address_line_1, address_line_2, address_line_3,
          city, state_province, postal_code, country_code, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        tenant.id, source.id, 'billing',
        billing_address.address_line_1,
        billing_address.address_line_2 || null,
        billing_address.address_line_3 || null,
        billing_address.city || null,
        billing_address.state_province || null,
        billing_address.postal_code || null,
        billing_address.country_code,
        actorId,
      ],
    );

    // 3e. Insert tax identifiers (if any)
    for (let i = 0; i < taxIds.length; i++) {
      const ti = taxIds[i];
      await t.one(
        `INSERT INTO ${sch}.tax_identifiers
           (tenant_id, source_id, country_code, tax_type, tax_value, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [tenant.id, source.id, ti.country_code, ti.tax_type, ti.tax_value, actorId],
      );
    }

    // 3f. Create employee record in the tenant schema
    const emp = await t.one(
      `INSERT INTO ${sch}.employees
         (tenant_id, first_name, last_name, roles, is_app_user, is_primary_contact, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [tenant.id, admin_first_name, admin_last_name, '{admin}', true, true, actorId],
    );

    // 3f-ii. Create sources record for the employee
    const empSource = await t.one(
      `INSERT INTO ${sch}.sources (tenant_id, table_id, source_type, label, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [tenant.id, emp.id, 'employee', `${admin_first_name} ${admin_last_name}`, actorId],
    );

    // 3f-iii. Back-link source_id onto the employee
    await t.none(
      `UPDATE ${sch}.employees SET source_id = $1, updated_by = $2 WHERE id = $3`,
      [empSource.id, actorId, emp.id],
    );

    // 3f-iv. Create the admin employee's login email
    await t.one(
      `INSERT INTO ${sch}.emails
         (tenant_id, source_id, email, label, is_primary, is_login, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [tenant.id, empSource.id, admin_email, 'work', true, true, actorId],
    );

    // 3f-v. Create the admin employee's phone number (if provided)
    if (admin_phone) {
      await t.one(
        `INSERT INTO ${sch}.phone_numbers
           (tenant_id, source_id, phone_number, phone_type, is_primary, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [tenant.id, empSource.id, admin_phone, 'work', true, actorId],
      );
    }

    // 3g. Create nap_users login linked to the employee
    const user = await t.one(
      `INSERT INTO admin.nap_users
         (tenant_id, entity_type, entity_id, email, password_hash, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [tenant.id, 'employee', emp.id, admin_email, passwordHash, 'invited', actorId],
    );

    return { admin_user_id: user.id, company_id: comp.id, source_id: source.id };
  });

  return { tenant, ...result };
}
