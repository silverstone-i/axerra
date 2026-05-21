/**
 * @file Schema definition for admin.portal_user_tenants table
 * @module auth/schemas/portalUserTenantsSchema
 *
 * Per-tenant binding for a portal_users identity. Employees and clients
 * have exactly one active binding; vendor_contacts may have one binding
 * per tenant they service. Carries the tenant-scoped entity link
 * (entity_type, entity_id) and the binding's invite/active status.
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/** @type {import('pg-schemata').TableSchema} */
const portalUserTenantsSchema = {
  dbSchema: 'admin',
  table: 'portal_user_tenants',
  version: '1.0.0',
  hasAuditFields: { enabled: true, userFields: { type: 'uuid', nullable: true, default: null } },
  softDelete: true,
  columns: [
    { name: 'id', type: 'uuid', default: 'gen_random_uuid()', notNull: true, immutable: true },
    { name: 'portal_user_id', type: 'uuid', notNull: true, immutable: true },
    { name: 'tenant_id', type: 'uuid', notNull: true, immutable: true },
    { name: 'entity_type', type: 'varchar(16)', default: null },
    { name: 'entity_id', type: 'uuid', default: null },
    { name: 'status', type: 'varchar(20)', notNull: true, default: 'active' },
  ],
  constraints: {
    primaryKey: ['id'],
    foreignKeys: [
      { columns: ['portal_user_id'], references: { table: 'portal_users', columns: ['id'], schema: 'admin' }, onDelete: 'CASCADE' },
      { columns: ['tenant_id'], references: { table: 'tenants', columns: ['id'], schema: 'admin' }, onDelete: 'CASCADE' },
    ],
    checks: [
      { type: 'Check', expression: "entity_type IS NULL OR entity_type IN ('employee','vendor_contact','client')" },
      { type: 'Check', expression: "status IN ('active','invited','locked')" },
    ],
    indexes: [
      { type: 'Index', columns: ['portal_user_id', 'tenant_id'], unique: true, where: 'deactivated_at IS NULL' },
      // Preserves the "exactly one active portal_user per tenant-scoped
      // entity" invariant that previously lived on portal_users. NULL
      // entity rows (bare registrations) are excluded so multiple of
      // those can coexist for the same tenant.
      {
        type: 'Index',
        columns: ['tenant_id', 'entity_type', 'entity_id'],
        unique: true,
        where: 'deactivated_at IS NULL AND entity_type IS NOT NULL',
      },
      { type: 'Index', columns: ['portal_user_id'] },
      { type: 'Index', columns: ['tenant_id'] },
      { type: 'Index', columns: ['entity_type', 'entity_id'] },
    ],
  },
};

export default portalUserTenantsSchema;
