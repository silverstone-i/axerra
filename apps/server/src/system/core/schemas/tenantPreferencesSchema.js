/**
 * @file Schema definition for tenant-scope preferences table
 * @module core/schemas/tenantPreferencesSchema
 *
 * One row per tenant — stores UI and behaviour preferences.
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

/** @type {import('pg-schemata').TableSchema} */
const tenantPreferencesSchema = {
  dbSchema: 'tenantid',
  table: 'tenant_preferences',
  version: '1.0.0',
  hasAuditFields: { enabled: true, userFields: { type: 'uuid', nullable: true, default: null } },
  softDelete: false,
  columns: [
    { name: 'id', type: 'uuid', default: 'gen_random_uuid()', notNull: true, immutable: true, colProps: { cnd: true } },
    { name: 'tenant_id', type: 'uuid', notNull: true, immutable: true },
    { name: 'default_page_size', type: 'integer', notNull: true, default: 25 },
  ],
  constraints: {
    primaryKey: ['id'],
    unique: [['tenant_id']],
    checks: [
      { type: 'Check', expression: 'default_page_size >= 25 AND default_page_size <= 1000' },
    ],
    indexes: [{ type: 'Index', columns: ['tenant_id'], unique: true }],
  },
};

export default tenantPreferencesSchema;
