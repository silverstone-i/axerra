/**
 * @file Schema definition for tenant-scope vendor_contacts table
 * @module core/schemas/vendorContactsSchema
 *
 * Vendor contacts represent individual people associated with a vendor.
 * Each vendor contact gets its own source record (source_type = 'vendor_contact')
 * for linked emails and phone numbers via the polymorphic sources pattern.
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
 */

/** @type {import('pg-schemata').TableSchema} */
const vendorContactsSchema = {
  dbSchema: 'tenantid',
  table: 'vendor_contacts',
  version: '1.0.0',
  hasAuditFields: { enabled: true, userFields: { type: 'uuid', nullable: true, default: null } },
  softDelete: true,
  columns: [
    { name: 'id', type: 'uuid', default: 'gen_random_uuid()', notNull: true, immutable: true },
    { name: 'tenant_id', type: 'uuid', notNull: true, immutable: true },
    { name: 'vendor_id', type: 'uuid', notNull: true },
    { name: 'source_id', type: 'uuid' },
    { name: 'first_name', type: 'varchar(64)', notNull: true },
    { name: 'last_name', type: 'varchar(64)', notNull: true },
    { name: 'position', type: 'varchar(64)' },
    { name: 'department', type: 'varchar(64)' },
    { name: 'is_app_user', type: 'boolean', notNull: true, default: false },
    { name: 'roles', type: 'text[]', notNull: true, default: '{}' },
  ],
  constraints: {
    primaryKey: ['id'],
    foreignKeys: [
      {
        type: 'ForeignKey',
        columns: ['vendor_id'],
        references: { table: 'vendors', columns: ['id'] },
        onDelete: 'CASCADE',
      },
      {
        type: 'ForeignKey',
        columns: ['source_id'],
        references: { table: 'sources', columns: ['id'] },
        onDelete: 'CASCADE',
      },
    ],
    indexes: [
      { type: 'Index', columns: ['tenant_id'] },
      { type: 'Index', columns: ['vendor_id'] },
    ],
  },
};

export default vendorContactsSchema;
