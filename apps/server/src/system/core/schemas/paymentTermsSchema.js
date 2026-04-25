/**
 * @file Schema definition for tenant-scope payment_terms table
 * @module core/schemas/paymentTermsSchema
 *
 * Lookup table for standardised payment terms assigned to vendors.
 * Placed under the Settings menu in the UI.
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

/** @type {import('pg-schemata').TableSchema} */
const paymentTermsSchema = {
  dbSchema: 'tenantid',
  table: 'payment_terms',
  version: '1.0.0',
  hasAuditFields: { enabled: true, userFields: { type: 'uuid', nullable: true, default: null } },
  softDelete: true,
  columns: [
    { name: 'id', type: 'uuid', default: 'gen_random_uuid()', notNull: true, immutable: true, colProps: { cnd: true } },
    { name: 'tenant_id', type: 'uuid', notNull: true, immutable: true },
    { name: 'label', type: 'varchar(64)', notNull: true },
    { name: 'term', type: 'integer', notNull: true, default: 30 },
    { name: 'units', type: 'varchar(16)', notNull: true, default: 'days' },
    { name: 'is_active', type: 'boolean', notNull: true, default: true },
  ],
  constraints: {
    primaryKey: ['id'],
    unique: [['tenant_id', 'label']],
    checks: [
      { type: 'Check', columns: ['units'], expression: "units IN ('days', 'months')" },
    ],
    indexes: [
      { type: 'Index', columns: ['tenant_id'] },
      { type: 'Index', columns: ['tenant_id', 'label'], unique: true, where: 'deactivated_at IS NULL' },
    ],
  },
};

export default paymentTermsSchema;
