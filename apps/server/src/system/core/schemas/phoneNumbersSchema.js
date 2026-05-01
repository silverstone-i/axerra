/**
 * @file Schema definition for tenant-scope phone_numbers table
 * @module core/schemas/phoneNumbersSchema
 *
 * Phone numbers are linked to vendors, clients, employees, and contacts
 * via the polymorphic sources table (source_id FK with CASCADE delete).
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

/** @type {import('pg-schemata').TableSchema} */
const phoneNumbersSchema = {
  dbSchema: 'tenantid',
  table: 'phone_numbers',
  version: '1.0.0',
  hasAuditFields: { enabled: true, userFields: { type: 'uuid', nullable: true, default: null } },
  softDelete: true,
  columns: [
    { name: 'id', type: 'uuid', default: 'gen_random_uuid()', notNull: true, immutable: true },
    { name: 'tenant_id', type: 'uuid', notNull: true, immutable: true },
    { name: 'source_id', type: 'uuid', notNull: true },
    { name: 'country_code', type: 'char(2)', notNull: true, default: 'US' },
    { name: 'phone_type', type: 'varchar(16)', notNull: true, default: 'cell' },
    { name: 'phone_number', type: 'varchar(32)', notNull: true },
    { name: 'is_primary', type: 'boolean', notNull: true, default: false },
  ],
  constraints: {
    primaryKey: ['id'],
    checks: [
      { type: 'Check', columns: ['phone_type'], expression: "phone_type IN ('cell', 'work', 'home', 'fax', 'other')" },
    ],
    foreignKeys: [
      {
        type: 'ForeignKey',
        columns: ['source_id'],
        references: { table: 'sources', columns: ['id'] },
        onDelete: 'CASCADE',
      },
    ],
    indexes: [
      { type: 'Index', columns: ['tenant_id'] },
      { type: 'Index', columns: ['source_id'] },
      { type: 'Index', columns: ['source_id'], unique: true, where: 'is_primary = true AND deactivated_at IS NULL' },
      {
        type: 'Index',
        columns: ['country_code', 'phone_number'],
        unique: true,
        where: "deactivated_at IS NULL AND phone_type = 'cell'",
      },
    ],
  },
};

export default phoneNumbersSchema;
