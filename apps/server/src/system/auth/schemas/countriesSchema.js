/**
 * @file Schema definition for admin.countries reference table
 * @module auth/schemas/countriesSchema
 *
 * ISO 3166-1 alpha-2 country list seeded from packages/shared. Tenant-scope
 * tables (phone_numbers, addresses, tax_identifiers) FK their country_code
 * column here so typos like 'Us' or non-ISO 'UK' are rejected at the DB.
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

/** @type {import('pg-schemata').TableSchema} */
const countriesSchema = {
  dbSchema: 'admin',
  table: 'countries',
  version: '1.0.0',
  hasAuditFields: { enabled: false },
  softDelete: false,
  columns: [
    { name: 'code', type: 'char(2)', notNull: true, immutable: true },
    { name: 'name', type: 'varchar(128)', notNull: true },
    { name: 'dial_code', type: 'varchar(8)' },
    { name: 'placeholder', type: 'varchar(64)' },
  ],
  constraints: {
    primaryKey: ['code'],
    indexes: [
      { type: 'Index', columns: ['name'] },
    ],
  },
};

export default countriesSchema;
