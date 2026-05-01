/**
 * @file Schema definition for admin.portal_users table
 * @module auth/schemas/portalUsersSchema
 *
 * portal_users is auth-only: identity (id), credentials (email,
 * password_hash) and account-level status. Tenant linkage and the
 * polymorphic entity link (entity_type, entity_id) live on the
 * portal_user_tenants join table — see portalUserTenantsSchema.
 *
 * email is globally unique among active rows.
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

/** @type {import('pg-schemata').TableSchema} */
const portalUsersSchema = {
  dbSchema: 'admin',
  table: 'portal_users',
  version: '1.0.0',
  hasAuditFields: { enabled: true, userFields: { type: 'uuid', nullable: true, default: null } },
  softDelete: true,
  columns: [
    { name: 'id', type: 'uuid', default: 'gen_random_uuid()', notNull: true, immutable: true },
    { name: 'email', type: 'varchar(128)', notNull: true },
    { name: 'password_hash', type: 'text', notNull: true },
    { name: 'status', type: 'varchar(20)', notNull: true, default: 'active' },
  ],
  constraints: {
    primaryKey: ['id'],
    checks: [
      { type: 'Check', expression: "status IN ('active','invited','locked')" },
    ],
    indexes: [
      { type: 'Index', columns: ['email'], unique: true, where: 'deactivated_at IS NULL' },
    ],
  },
};

export default portalUsersSchema;
