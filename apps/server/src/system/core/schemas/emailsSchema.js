/**
 * @file Schema definition for tenant-scope emails table
 * @module core/schemas/emailsSchema
 *
 * Emails are linked to vendors, clients, employees, contacts, and vendor contacts
 * via the polymorphic sources table (source_id FK with CASCADE delete).
 * The is_login flag marks the email used as the portal_users login credential
 * for entities with is_app_user = true.
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

/** @type {import('pg-schemata').TableSchema} */
const emailsSchema = {
  dbSchema: 'tenantid',
  table: 'emails',
  version: '1.0.0',
  hasAuditFields: { enabled: true, userFields: { type: 'uuid', nullable: true, default: null } },
  softDelete: true,
  columns: [
    { name: 'id', type: 'uuid', default: 'gen_random_uuid()', notNull: true, immutable: true },
    { name: 'tenant_id', type: 'uuid', notNull: true, immutable: true },
    { name: 'source_id', type: 'uuid', notNull: true },
    { name: 'email', type: 'varchar(128)', notNull: true },
    { name: 'label', type: 'varchar(32)' },
    { name: 'is_primary', type: 'boolean', notNull: true, default: false },
    { name: 'is_login', type: 'boolean', notNull: true, default: false },
  ],
  constraints: {
    primaryKey: ['id'],
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
      { type: 'Index', columns: ['email'], unique: true, where: 'deactivated_at IS NULL' },
      { type: 'Index', columns: ['source_id'], unique: true, where: 'is_login = true AND deactivated_at IS NULL' },
      { type: 'Index', columns: ['source_id'], unique: true, where: 'is_primary = true AND deactivated_at IS NULL' },
    ],
  },
};

export default emailsSchema;
