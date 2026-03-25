/**
 * @file Vendors model — extends TableModel with flat + multi-sheet export/import
 * @module core/models/Vendors
 *
 * Supports standalone vendor export/import (5-sheet workbook) and combined
 * vendor + vendor_contacts export/import. The combined format uses a flat
 * 2-sheet layout with repeated rows (one row per child record).
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
 */

import { writeFileSync, readFileSync } from 'node:fs';
import { TableModel } from 'pg-schemata';
import vendorsSchema from '../schemas/vendorsSchema.js';
import {
  exportSourceEntity,
  importSourceEntity,
  importChildSheet,
  parseSheet,
  isUuid,
  coerceRow,
  coerceChildRow,
  buildFlatRows,
  groupFlatRows,
  provisionAppUser,
  PHONE_HEADERS,
  ADDRESS_HEADERS,
  TAX_ID_HEADERS,
  EMAIL_HEADERS,
} from '../../../lib/spreadsheetHelpers.js';
import { allocateNumber } from '../services/numberingService.js';

/** @type {import('../../../lib/spreadsheetHelpers.js').SourceEntityConfig} */
const CONFIG = {
  entityName: 'vendors',
  sheetName: 'Vendors',
  sourceType: 'vendor',
  linkColName: 'vendor_id',
  idType: 'vendor',
  buildLabel: (row) => row.name,
  returningCols: ['id', 'name'],
  boolCols: [],
  hasRoles: false,
  codeRequired: false,
  extraExportCols: [
    { name: 'status', derive: (origRow) => (origRow.deactivated_at ? 'archived' : 'active') },
  ],
  extraImportStrip: [],
  childSheets: [
    { sheetName: 'Vendor Emails', modelName: 'emails', headers: EMAIL_HEADERS },
    { sheetName: 'Vendor Phones', modelName: 'phoneNumbers', headers: PHONE_HEADERS },
    { sheetName: 'Vendor Addresses', modelName: 'addresses', headers: ADDRESS_HEADERS },
    { sheetName: 'Vendor Tax IDs', modelName: 'taxIdentifiers', headers: TAX_ID_HEADERS },
  ],
  appUserProvisioning: null,
};

/** Config for vendor_contacts child entity within the combined workbook */
const CONTACT_CONFIG = {
  entityName: 'vendorContacts',
  sheetName: 'Vendor Contacts',
  sourceType: 'vendor_contact',
  linkColName: 'vendor_contact_id',
  idType: 'vendor_contact',
  buildLabel: (row) => `${row.first_name} ${row.last_name}`,
  returningCols: ['id', 'first_name', 'last_name'],
  boolCols: ['is_app_user'],
  hasRoles: true,
  codeRequired: false,
  extraExportCols: [
    { name: 'status', derive: (origRow) => (origRow.deactivated_at ? 'archived' : 'active') },
    { name: 'password', derive: () => '' },
  ],
  extraImportStrip: [],
  childSheets: [
    { sheetName: 'Contact Emails', modelName: 'emails', headers: EMAIL_HEADERS },
    { sheetName: 'Contact Phones', modelName: 'phoneNumbers', headers: PHONE_HEADERS },
    { sheetName: 'Contact Addresses', modelName: 'addresses', headers: ADDRESS_HEADERS },
    { sheetName: 'Contact Tax IDs', modelName: 'taxIdentifiers', headers: TAX_ID_HEADERS },
  ],
  appUserProvisioning: { entityType: 'vendor_contact' },
};

// ── Flat-format column layouts ───────────────────────────────────────────────

const VENDOR_FLAT_HEADERS = [
  'id', 'code', 'name', 'payment_term_id', 'notes', 'status',
  'email', 'email_label', 'email_is_primary', 'email_is_login',
  'phone_country_code', 'phone_type', 'phone_number', 'phone_is_primary',
  'address_label', 'address_line_1', 'address_line_2', 'address_line_3',
  'address_city', 'address_state_province', 'address_postal_code', 'address_country_code',
  'tax_country_code', 'tax_type', 'tax_value',
];

const CONTACT_FLAT_HEADERS = [
  'vendor_id', 'id', 'first_name', 'last_name', 'position', 'department',
  'is_app_user', 'roles', 'status', 'password',
  'email', 'email_label', 'email_is_primary', 'email_is_login',
  'phone_country_code', 'phone_type', 'phone_number', 'phone_is_primary',
];

/** Parent column names for flat import grouping */
const VENDOR_PARENT_COLS = ['id', 'code', 'name', 'payment_term_id', 'notes', 'status'];
const CONTACT_PARENT_COLS = [
  'vendor_id', 'id', 'first_name', 'last_name', 'position', 'department',
  'is_app_user', 'roles', 'status', 'password',
];

/** Child extractors for flat import grouping */
const VENDOR_CHILD_EXTRACTORS = [
  {
    name: 'emails',
    test: (r) => !!r.email,
    extract: (r) => ({ email: r.email, label: r.email_label, is_primary: r.email_is_primary, is_login: r.email_is_login }),
  },
  {
    name: 'phones',
    test: (r) => !!r.phone_number,
    extract: (r) => ({ country_code: r.phone_country_code, phone_type: r.phone_type, phone_number: r.phone_number, is_primary: r.phone_is_primary }),
  },
  {
    name: 'addresses',
    test: (r) => !!r.address_line_1,
    extract: (r) => ({
      label: r.address_label, address_line_1: r.address_line_1, address_line_2: r.address_line_2,
      address_line_3: r.address_line_3, city: r.address_city, state_province: r.address_state_province,
      postal_code: r.address_postal_code, country_code: r.address_country_code,
    }),
  },
  {
    name: 'taxIds',
    test: (r) => !!r.tax_value,
    extract: (r) => ({ country_code: r.tax_country_code, tax_type: r.tax_type, tax_value: r.tax_value }),
  },
];

const CONTACT_CHILD_EXTRACTORS = [
  {
    name: 'emails',
    test: (r) => !!r.email,
    extract: (r) => ({ email: r.email, label: r.email_label, is_primary: r.email_is_primary, is_login: r.email_is_login }),
  },
  {
    name: 'phones',
    test: (r) => !!r.phone_number,
    extract: (r) => ({ country_code: r.phone_country_code, phone_type: r.phone_type, phone_number: r.phone_number, is_primary: r.phone_is_primary }),
  },
];

/** Child column mappings for flat export (source cols → flat cols) */
const VENDOR_CHILD_ARRAYS_CONFIG = [
  { model: 'emails', cols: ['email', 'label', 'is_primary', 'is_login'], flatCols: ['email', 'email_label', 'email_is_primary', 'email_is_login'] },
  { model: 'phoneNumbers', cols: ['country_code', 'phone_type', 'phone_number', 'is_primary'], flatCols: ['phone_country_code', 'phone_type', 'phone_number', 'phone_is_primary'] },
  { model: 'addresses', cols: ['label', 'address_line_1', 'address_line_2', 'address_line_3', 'city', 'state_province', 'postal_code', 'country_code'], flatCols: ['address_label', 'address_line_1', 'address_line_2', 'address_line_3', 'address_city', 'address_state_province', 'address_postal_code', 'address_country_code'] },
  { model: 'taxIdentifiers', cols: ['country_code', 'tax_type', 'tax_value'], flatCols: ['tax_country_code', 'tax_type', 'tax_value'] },
];

const CONTACT_CHILD_ARRAYS_CONFIG = [
  { model: 'emails', cols: ['email', 'label', 'is_primary', 'is_login'], flatCols: ['email', 'email_label', 'email_is_primary', 'email_is_login'] },
  { model: 'phoneNumbers', cols: ['country_code', 'phone_type', 'phone_number', 'is_primary'], flatCols: ['phone_country_code', 'phone_type', 'phone_number', 'phone_is_primary'] },
];

// Simple email regex matching pg-schemata / Zod email validation
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Lazy-load db */
let _db, _pgp;
async function getDb() {
  if (!_db) {
    const mod = await import('../../../db/db.js');
    _db = mod.default;
    _pgp = mod.pgp;
  }
  return { db: _db, pgp: _pgp };
}

export default class Vendors extends TableModel {
  constructor(db, pgp, logger = null) {
    super(db, pgp, vendorsSchema, logger);
  }

  async exportToSpreadsheet(filePath, where = [], joinType = 'AND', options = {}) {
    return exportSourceEntity(this, filePath, where, joinType, options, CONFIG);
  }

  async importFromSpreadsheet(filePath, _sheetIndex = 0, callbackFn = null, _returning = null) {
    return importSourceEntity(this, filePath, _sheetIndex, callbackFn, CONFIG);
  }

  /**
   * Export vendors AND their vendor_contacts into a flat 2-sheet workbook.
   *
   * Sheet 0 "Vendors": one row per child record, vendor columns repeated.
   * Sheet 1 "Vendor Contacts": same repeated-row pattern for contacts.
   */
  async exportCombinedSpreadsheet(filePath, where = [], joinType = 'AND', options = {}) {
    const { includeDeactivated, ...rest } = options;
    const vendorRows = await this.findWhere(where, joinType, { ...rest, includeDeactivated });

    const { WorkbookBuilder, writeXlsx } = await import('@nap-sft/tablsx');
    const wb = WorkbookBuilder.create();
    const vendorSheet = wb.sheet('Vendors');
    vendorSheet.setHeaders(VENDOR_FLAT_HEADERS);
    const contactSheet = wb.sheet('Vendor Contacts');
    contactSheet.setHeaders(CONTACT_FLAT_HEADERS);

    if (!vendorRows.length) {
      writeFileSync(filePath, writeXlsx(wb.build()));
      return { exported: 0, filePath };
    }

    const { db } = await getDb();
    const schema = this._schema.dbSchema;

    // Batch-query all vendor children by source_id
    const vendorSourceIds = vendorRows.map((v) => v.source_id).filter(Boolean);
    const childrenBySource = new Map(); // source_id → { emails[], phones[], addresses[], taxIds[] }

    if (vendorSourceIds.length) {
      for (const cfg of VENDOR_CHILD_ARRAYS_CONFIG) {
        const rows = await db(cfg.model, schema).findWhere([{ source_id: { $in: vendorSourceIds } }]);
        for (const row of rows) {
          let entry = childrenBySource.get(row.source_id);
          if (!entry) {
            entry = { emails: [], phones: [], addresses: [], taxIds: [] };
            childrenBySource.set(row.source_id, entry);
          }
          const key = cfg.model === 'phoneNumbers' ? 'phones' : cfg.model === 'taxIdentifiers' ? 'taxIds' : cfg.model;
          entry[key].push(row);
        }
      }
    }

    // Build payment-term label lookup
    const ptIds = [...new Set(vendorRows.map((v) => v.payment_term_id).filter(Boolean))];
    const ptLabelById = new Map();
    if (ptIds.length) {
      const ptRows = await db('paymentTerms', schema).findWhere([{ id: { $in: ptIds } }]);
      for (const pt of ptRows) ptLabelById.set(pt.id, pt.label);
    }

    // Build flat vendor rows
    for (const v of vendorRows) {
      const children = childrenBySource.get(v.source_id) || { emails: [], phones: [], addresses: [], taxIds: [] };
      const parent = {
        id: v.id,
        code: v.code || '',
        name: v.name,
        payment_term_id: ptLabelById.get(v.payment_term_id) || '',
        notes: v.notes || '',
        status: v.deactivated_at ? 'archived' : 'active',
      };
      const childArrays = VENDOR_CHILD_ARRAYS_CONFIG.map((cfg) => {
        const key = cfg.model === 'phoneNumbers' ? 'phones' : cfg.model === 'taxIdentifiers' ? 'taxIds' : cfg.model;
        return { cols: cfg.cols, flatCols: cfg.flatCols, rows: children[key] };
      });
      const flatRows = buildFlatRows(parent, childArrays);
      vendorSheet.addObjects(flatRows);
    }

    // Batch-query vendor contacts
    const vendorIds = vendorRows.map((v) => v.id);
    const contactModel = db('vendorContacts', schema);
    const contactRows = await contactModel.findWhere([{ vendor_id: { $in: vendorIds } }], 'AND', { includeDeactivated: true });

    if (contactRows.length) {
      // Batch-query contact children (emails, phones only)
      const contactSourceIds = contactRows.map((c) => c.source_id).filter(Boolean);
      const contactChildrenBySource = new Map();

      if (contactSourceIds.length) {
        for (const cfg of CONTACT_CHILD_ARRAYS_CONFIG) {
          const rows = await db(cfg.model, schema).findWhere([{ source_id: { $in: contactSourceIds } }]);
          for (const row of rows) {
            let entry = contactChildrenBySource.get(row.source_id);
            if (!entry) {
              entry = { emails: [], phones: [] };
              contactChildrenBySource.set(row.source_id, entry);
            }
            const key = cfg.model === 'phoneNumbers' ? 'phones' : cfg.model;
            entry[key].push(row);
          }
        }
      }

      // Build flat contact rows
      for (const c of contactRows) {
        const children = contactChildrenBySource.get(c.source_id) || { emails: [], phones: [] };
        const parent = {
          vendor_id: c.vendor_id,
          id: c.id,
          first_name: c.first_name,
          last_name: c.last_name,
          position: c.position || '',
          department: c.department || '',
          is_app_user: c.is_app_user,
          roles: Array.isArray(c.roles) ? `{${c.roles.join(',')}}` : c.roles || '',
          status: c.deactivated_at ? 'archived' : 'active',
          password: '',
        };
        const childArrays = CONTACT_CHILD_ARRAYS_CONFIG.map((cfg) => {
          const key = cfg.model === 'phoneNumbers' ? 'phones' : cfg.model;
          return { cols: cfg.cols, flatCols: cfg.flatCols, rows: children[key] };
        });
        const flatRows = buildFlatRows(parent, childArrays);
        contactSheet.addObjects(flatRows);
      }
    }

    writeFileSync(filePath, writeXlsx(wb.build()));
    return { exported: vendorRows.length, contacts: contactRows.length, filePath };
  }

  /**
   * Import from a combined workbook (vendors + vendor_contacts).
   * Auto-detects format:
   *   - <= 2 sheets: new flat repeated-row format
   *   - 3-5 sheets: legacy vendor-only (5-sheet)
   *   - >= 6 sheets: legacy combined multi-sheet format
   */
  async importCombinedSpreadsheet(filePath, _sheetIndex = 0, callbackFn = null) {
    const { WorkbookReader } = await import('@nap-sft/tablsx');
    const buffer = readFileSync(filePath);
    const reader = WorkbookReader.fromBuffer(buffer);

    if (reader.sheetCount <= 2) {
      return this._importFlatCombined(reader, callbackFn);
    }
    if (reader.sheetCount < 6) {
      return importSourceEntity(this, filePath, _sheetIndex, callbackFn, CONFIG);
    }
    return this._importLegacyCombined(reader, filePath, _sheetIndex, callbackFn);
  }

  // ── Flat import (2-sheet repeated-row format) ─────────────────────────────

  async _importFlatCombined(reader, callbackFn) {
    const { db, pgp } = await getDb();
    const schema = this._schema.dbSchema;
    const s = pgp.as.name(schema);

    // Resolve tenant_id
    let tenantId;
    const sampleRow = callbackFn ? await callbackFn({}) : {};
    if (sampleRow.tenant_code) {
      const tenantRec = await db.oneOrNone(
        'SELECT id FROM admin.tenants WHERE tenant_code = $1 AND deactivated_at IS NULL',
        [sampleRow.tenant_code.toUpperCase()],
      );
      tenantId = tenantRec?.id;
    }

    // Parse and group vendor rows
    const flatRows = parseSheet(reader, 0);
    if (!flatRows.length) {
      const { SchemaDefinitionError } = await import('pg-schemata');
      throw new SchemaDefinitionError('Spreadsheet is empty or invalid format');
    }

    const { groups: vendorGroups, conflicts: vendorConflicts } = groupFlatRows(
      flatRows,
      (r) => {
        const rawId = r.id != null ? String(r.id).trim() : '';
        if (rawId) return isUuid(rawId) ? rawId : `ref::${rawId}`;
        return `${r.code || ''}::${r.name || ''}`;
      },
      VENDOR_PARENT_COLS,
      VENDOR_CHILD_EXTRACTORS,
    );

    // Resolve payment_term_id: accept UUID or label, nullify blanks
    const ptLabels = new Set();
    for (const g of vendorGroups) {
      const val = g.parent.payment_term_id;
      if (val && !isUuid(val)) ptLabels.add(String(val).trim());
    }
    const ptIdByLabel = new Map();
    if (ptLabels.size) {
      const ptRows = await db.any(
        `SELECT id, label FROM ${s}.payment_terms WHERE label IN ($1:csv) AND deactivated_at IS NULL`,
        [[...ptLabels]],
      );
      for (const pt of ptRows) ptIdByLabel.set(pt.label, pt.id);
    }
    for (const g of vendorGroups) {
      const val = g.parent.payment_term_id;
      if (!val || (typeof val === 'string' && !val.trim())) {
        g.parent.payment_term_id = null;
      } else if (!isUuid(val)) {
        g.parent.payment_term_id = ptIdByLabel.get(String(val).trim()) || null;
      }
    }

    // Parse contacts before the transaction so we can validate everything upfront
    const contactFlatRows = parseSheet(reader, 1);
    let contactGroups = [];
    let contactConflicts = [];
    if (contactFlatRows.length) {
      ({ groups: contactGroups, conflicts: contactConflicts } = groupFlatRows(
        contactFlatRows,
        (r) => {
          const rawId = r.id != null ? String(r.id).trim() : '';
          if (rawId) return isUuid(rawId) ? rawId : `ref::${rawId}`;
          return `${r.vendor_id || ''}::${r.first_name || ''}::${r.last_name || ''}`;
        },
        CONTACT_PARENT_COLS,
        CONTACT_CHILD_EXTRACTORS,
      ));
    }

    // ── Pre-validation: collect all data errors before touching the DB ──
    const sheetNames = reader.sheetNames;
    const errors = [];
    for (const c of vendorConflicts) {
      errors.push({ sheet: sheetNames[0] || 'Vendors', row: c.row, column: c.column, value: c.value, message: `Conflicting value — row ${c.existingRow} has "${c.existingValue}"` });
    }
    for (const c of contactConflicts) {
      errors.push({ sheet: sheetNames[1] || 'Vendor Contacts', row: c.row, column: c.column, value: c.value, message: `Conflicting value — row ${c.existingRow} has "${c.existingValue}"` });
    }
    const validateEmails = (groups, sheetName) => {
      for (const group of groups) {
        const emailChildren = group.children.emails || [];
        for (const child of emailChildren) {
          if (child.email && !EMAIL_RE.test(child.email)) {
            errors.push({ sheet: sheetName, row: child._rowNum || null, column: 'email', value: child.email, message: 'Invalid email format' });
          }
        }
      }
    };
    validateEmails(vendorGroups, sheetNames[0] || 'Vendors');
    validateEmails(contactGroups, sheetNames[1] || 'Vendor Contacts');
    if (errors.length) return { errors };

    let insertedCount = 0;
    let updatedCount = 0;
    let contactsInserted = 0;
    let contactsUpdated = 0;

    // Maps for cross-sheet vendor_id resolution
    const vendorRefToId = new Map(); // spreadsheet id/ref → DB vendor id
    const vendorIdToSourceId = new Map(); // DB vendor id → source_id

    await db.tx(async (t) => {
      this.tx = t;

      // ── Phase 1: Upsert vendors ──────────────────────────────────────

      const uuidIds = vendorGroups.filter((g) => isUuid(g.parent.id)).map((g) => g.parent.id);
      const existingVendors = new Map();
      if (uuidIds.length) {
        const existing = await t.any(
          `SELECT id, source_id FROM ${s}.vendors WHERE id IN ($1:csv)`,
          [uuidIds],
        );
        for (const row of existing) {
          existingVendors.set(row.id, row.source_id);
        }
      }

      const toUpdate = [];
      const toInsert = [];

      for (const group of vendorGroups) {
        const { parent } = group;
        const isArchived = String(parent.status).toLowerCase() === 'archived';
        const { _rowNum: _rn, ...vendorData } = { ...parent };
        delete vendorData.status;

        const transformed = callbackFn ? await callbackFn({ ...vendorData }) : { ...vendorData };
        delete transformed.tenant_code;
        if (tenantId) transformed.tenant_id = tenantId;

        if (existingVendors.has(parent.id)) {
          toUpdate.push({ transformed, isArchived, group });
        } else {
          toInsert.push({ transformed, isArchived, group, ref: parent.id || null });
        }
      }

      // Run updates
      for (const { transformed, isArchived, group } of toUpdate) {
        const { id, ...changes } = transformed;
        await this.updateWhere([{ id }], changes, { includeDeactivated: true });
        if (isArchived) {
          await t.none(`UPDATE ${s}.vendors SET deactivated_at = NOW() WHERE id = $1 AND deactivated_at IS NULL`, [id]);
        } else {
          await t.none(`UPDATE ${s}.vendors SET deactivated_at = NULL WHERE id = $1 AND deactivated_at IS NOT NULL`, [id]);
        }
        vendorRefToId.set(id, id);
        vendorIdToSourceId.set(id, existingVendors.get(id));
        updatedCount++;

        // Upsert children for updated vendor
        const sourceId = existingVendors.get(id);
        if (sourceId) {
          await this._upsertFlatChildren(t, s, schema, db, pgp, sourceId, group.children, VENDOR_CHILD_ARRAYS_CONFIG, callbackFn, tenantId);
        }
      }

      // Run inserts
      if (toInsert.length) {
        const cleanInserts = toInsert.map(({ transformed }) => {
          const { id: _id, ...clean } = transformed;
          return clean;
        });

        // Clear codes that already exist
        const insertCodes = cleanInserts.map((r) => r.code).filter(Boolean);
        if (insertCodes.length) {
          const existingCodes = await t.any(
            `SELECT code FROM ${s}.vendors WHERE code IN ($1:csv)`,
            [insertCodes],
          );
          const takenCodes = new Set(existingCodes.map((r) => r.code));
          for (const row of cleanInserts) {
            if (row.code && takenCodes.has(row.code)) row.code = null;
          }
        }

        const insertResults = await this.bulkInsert(cleanInserts, CONFIG.returningCols);
        insertedCount = insertResults.length;

        // Create sources records
        const sourcesModel = db('sources', schema);
        sourcesModel.tx = t;
        const tid = cleanInserts[0]?.tenant_id;
        const createdBy = cleanInserts[0]?.created_by || null;

        const sourceRecords = insertResults.map((rec) => ({
          tenant_id: tid,
          table_id: rec.id,
          source_type: CONFIG.sourceType,
          label: CONFIG.buildLabel(rec),
          created_by: createdBy,
        }));
        const sourceResults = await sourcesModel.bulkInsert(sourceRecords, ['id', 'table_id']);
        const sourceByParentId = new Map(sourceResults.map((sr) => [sr.table_id, sr.id]));

        for (let i = 0; i < insertResults.length; i++) {
          const rec = insertResults[i];
          const sourceId = sourceByParentId.get(rec.id);
          if (sourceId) {
            await t.none(`UPDATE ${s}.vendors SET source_id = $1 WHERE id = $2`, [sourceId, rec.id]);
          }
          if (!cleanInserts[i].code && CONFIG.idType) {
            const numbering = await allocateNumber(schema, CONFIG.idType, null, new Date(), t);
            if (numbering) {
              await t.none(`UPDATE ${s}.vendors SET code = $1 WHERE id = $2`, [numbering.displayId, rec.id]);
            }
          }
          const ref = toInsert[i].ref;
          if (ref) vendorRefToId.set(ref, rec.id);
          vendorRefToId.set(rec.id, rec.id);
          vendorIdToSourceId.set(rec.id, sourceId);

          if (toInsert[i].isArchived) {
            await t.none(`UPDATE ${s}.vendors SET deactivated_at = NOW() WHERE id = $1`, [rec.id]);
          }

          // Insert children for new vendor
          if (sourceId) {
            await this._upsertFlatChildren(t, s, schema, db, pgp, sourceId, toInsert[i].group.children, VENDOR_CHILD_ARRAYS_CONFIG, callbackFn, tenantId);
          }
        }
      }

      // ── Phase 2: Import vendor contacts from sheet 1 ─────────────────

      if (!contactGroups.length) return;

      const contactModel = db('vendorContacts', schema);
      contactModel.tx = t;

      const contactUuidIds = contactGroups.filter((g) => isUuid(g.parent.id)).map((g) => g.parent.id);
      const existingContacts = new Map();
      if (contactUuidIds.length) {
        const existing = await t.any(
          `SELECT id, source_id FROM ${s}.vendor_contacts WHERE id IN ($1:csv)`,
          [contactUuidIds],
        );
        for (const row of existing) existingContacts.set(row.id, row.source_id);
      }

      const contactToUpdate = [];
      const contactToInsert = [];
      const stripCols = ['status', 'deactivated_at', 'password'];

      for (const group of contactGroups) {
        const { parent } = group;
        const isArchived = String(parent.status).toLowerCase() === 'archived';
        const password = parent.password || null;
        const { _rowNum: _crn, ...contactData } = { ...parent };
        for (const col of stripCols) delete contactData[col];

        // Resolve vendor_id from ref map if needed
        if (contactData.vendor_id && !isUuid(contactData.vendor_id)) {
          const resolved = vendorRefToId.get(contactData.vendor_id);
          if (resolved) contactData.vendor_id = resolved;
        }

        const transformed = callbackFn ? await callbackFn({ ...contactData }) : { ...contactData };
        for (const col of stripCols) delete transformed[col];
        delete transformed.tenant_code;
        if (tenantId) transformed.tenant_id = tenantId;
        coerceRow(transformed, CONTACT_CONFIG.boolCols, CONTACT_CONFIG.hasRoles);

        if (existingContacts.has(parent.id)) {
          contactToUpdate.push({ transformed, isArchived, group });
        } else {
          contactToInsert.push({ transformed, isArchived, group, ref: parent.id || null, password });
        }
      }

      // Run contact updates
      for (const { transformed, isArchived, group } of contactToUpdate) {
        const { id, vendor_id: _vid, ...changes } = transformed;
        await contactModel.updateWhere([{ id }], changes, { includeDeactivated: true });
        if (isArchived) {
          await t.none(`UPDATE ${s}.vendor_contacts SET deactivated_at = NOW() WHERE id = $1 AND deactivated_at IS NULL`, [id]);
        } else {
          await t.none(`UPDATE ${s}.vendor_contacts SET deactivated_at = NULL WHERE id = $1 AND deactivated_at IS NOT NULL`, [id]);
        }
        contactsUpdated++;

        const sourceId = existingContacts.get(id);
        if (sourceId) {
          await this._upsertFlatChildren(t, s, schema, db, pgp, sourceId, group.children, CONTACT_CHILD_ARRAYS_CONFIG, callbackFn, tenantId);
        }
      }

      // Run contact inserts
      if (contactToInsert.length) {
        const cleanInserts = contactToInsert.map(({ transformed }) => {
          const { id: _id, ...clean } = transformed;
          return clean;
        });

        const insertResults = await contactModel.bulkInsert(cleanInserts, CONTACT_CONFIG.returningCols);
        contactsInserted = insertResults.length;

        const sourcesModel = db('sources', schema);
        sourcesModel.tx = t;
        const tid = cleanInserts[0]?.tenant_id;
        const createdBy = cleanInserts[0]?.created_by || null;

        const sourceRecords = insertResults.map((rec) => ({
          tenant_id: tid,
          table_id: rec.id,
          source_type: CONTACT_CONFIG.sourceType,
          label: CONTACT_CONFIG.buildLabel(rec),
          created_by: createdBy,
        }));
        const sourceResults = await sourcesModel.bulkInsert(sourceRecords, ['id', 'table_id']);
        const sourceByParentId = new Map(sourceResults.map((sr) => [sr.table_id, sr.id]));

        for (let i = 0; i < insertResults.length; i++) {
          const rec = insertResults[i];
          const sourceId = sourceByParentId.get(rec.id);
          if (sourceId) {
            await t.none(`UPDATE ${s}.vendor_contacts SET source_id = $1 WHERE id = $2`, [sourceId, rec.id]);
          }
          if (contactToInsert[i].isArchived) {
            await t.none(`UPDATE ${s}.vendor_contacts SET deactivated_at = NOW() WHERE id = $1`, [rec.id]);
          }

          // Insert children for new contact
          if (sourceId) {
            await this._upsertFlatChildren(t, s, schema, db, pgp, sourceId, contactToInsert[i].group.children, CONTACT_CHILD_ARRAYS_CONFIG, callbackFn, tenantId);
          }
        }

        // Provision nap_users for app-user contacts after emails are inserted
        if (CONTACT_CONFIG.appUserProvisioning) {
          const crypto = await import('node:crypto');

          for (let i = 0; i < insertResults.length; i++) {
            if (!cleanInserts[i].is_app_user) continue;

            const rec = insertResults[i];
            const sourceId = sourceByParentId.get(rec.id);
            if (!sourceId) continue;

            const loginEmail = await t.oneOrNone(
              `SELECT email FROM ${s}.emails
               WHERE source_id = $1 AND deactivated_at IS NULL
               ORDER BY is_login DESC, is_primary DESC, created_at LIMIT 1`,
              [sourceId],
            );
            if (!loginEmail) {
              await t.none(`UPDATE ${s}.vendor_contacts SET is_app_user = false WHERE id = $1`, [rec.id]);
              continue;
            }

            const clearPassword = contactToInsert[i].password || crypto.randomBytes(12).toString('base64url');
            const created = await provisionAppUser(rec.id, loginEmail.email, clearPassword, tid, createdBy, CONTACT_CONFIG.appUserProvisioning.entityType, t);
            if (!created) {
              await t.none(`UPDATE ${s}.vendor_contacts SET is_app_user = false WHERE id = $1`, [rec.id]);
            }
          }
        }
      }
    });

    this.tx = null;

    return {
      inserted: insertedCount,
      updated: updatedCount,
      contactsInserted,
      contactsUpdated,
    };
  }

  /**
   * Upsert flat children: soft-delete existing, insert new from grouped child arrays.
   */
  async _upsertFlatChildren(t, s, schema, db, pgp, sourceId, children, childConfig, callbackFn, tenantId) {
    for (const cfg of childConfig) {
      const key = cfg.model === 'phoneNumbers' ? 'phones' : cfg.model === 'taxIdentifiers' ? 'taxIds' : cfg.model;
      const childRows = children[key];
      if (!childRows || !childRows.length) continue;

      const childModel = db(cfg.model, schema);
      childModel.tx = t;
      const tableName = childModel._schema?.table || cfg.model;

      // Soft-delete existing children
      await t.none(
        `UPDATE ${s}.${pgp.as.name(tableName)} SET deactivated_at = NOW() WHERE source_id = $1 AND deactivated_at IS NULL`,
        [sourceId],
      );

      // Insert new children
      const toInsert = [];
      for (const row of childRows) {
        const { _rowNum: _, ...rest } = row;
        const base = { ...rest, source_id: sourceId };
        const transformed = callbackFn ? await callbackFn(base) : base;
        delete transformed.tenant_code;
        if (tenantId) transformed.tenant_id = tenantId;
        coerceChildRow(transformed, childModel);
        toInsert.push(transformed);
      }

      if (toInsert.length) {
        await childModel.bulkInsert(toInsert);
      }
    }
  }

  // ── Legacy multi-sheet import (backward compatibility) ────────────────────

  async _importLegacyCombined(reader, filePath, _sheetIndex, callbackFn) {
    const { db, pgp } = await getDb();
    const schema = this._schema.dbSchema;
    const s = pgp.as.name(schema);

    // Phase 1: Import vendors + vendor children using standard import
    const vendorResult = await importSourceEntity(this, filePath, _sheetIndex, callbackFn, CONFIG);

    // Phase 2: Import vendor contacts from sheet 5
    const contactRows = parseSheet(reader, 5);
    if (!contactRows.length) return { ...vendorResult, contactsInserted: 0, contactsUpdated: 0 };

    let contactsInserted = 0;
    let contactsUpdated = 0;
    const contactRefToSourceId = new Map();

    let tenantId;
    const sampleRow = callbackFn ? await callbackFn({}) : {};
    if (sampleRow.tenant_code) {
      const tenantRec = await db.oneOrNone(
        'SELECT id FROM admin.tenants WHERE tenant_code = $1 AND deactivated_at IS NULL',
        [sampleRow.tenant_code.toUpperCase()],
      );
      tenantId = tenantRec?.id;
    }

    const stripCols = ['status', 'deactivated_at', 'password'];

    await db.tx(async (t) => {
      const contactModel = db('vendorContacts', schema);
      contactModel.tx = t;

      const uuidIds = contactRows.filter((r) => isUuid(r.id)).map((r) => r.id);
      const existingSet = new Set();
      if (uuidIds.length) {
        const existing = await t.any(
          `SELECT id, source_id FROM ${s}.vendor_contacts WHERE id IN ($1:csv)`,
          [uuidIds],
        );
        for (const row of existing) {
          existingSet.add(row.id);
          contactRefToSourceId.set(row.id, row.source_id);
        }
      }

      const toUpdate = [];
      const toInsert = [];
      for (const row of contactRows) {
        const isArchived = String(row.status).toLowerCase() === 'archived';
        const password = row.password || null;
        for (const col of stripCols) delete row[col];

        const transformed = callbackFn ? await callbackFn({ ...row }) : { ...row };
        for (const col of stripCols) delete transformed[col];
        delete transformed.tenant_code;
        if (tenantId) transformed.tenant_id = tenantId;
        coerceRow(transformed, CONTACT_CONFIG.boolCols, CONTACT_CONFIG.hasRoles);

        if (existingSet.has(row.id)) {
          transformed._archive = isArchived;
          toUpdate.push(transformed);
        } else {
          transformed._ref = row.id || null;
          transformed._archive = isArchived;
          transformed._password = password;
          delete transformed.id;
          toInsert.push(transformed);
        }
      }

      for (const row of toUpdate) {
        const { id, vendor_id: _vid, tenant_code: _tc, _archive, ...changes } = row;
        await contactModel.updateWhere([{ id }], changes, { includeDeactivated: true });
        if (_archive) {
          await t.none(`UPDATE ${s}.vendor_contacts SET deactivated_at = NOW() WHERE id = $1 AND deactivated_at IS NULL`, [id]);
        } else {
          await t.none(`UPDATE ${s}.vendor_contacts SET deactivated_at = NULL WHERE id = $1 AND deactivated_at IS NOT NULL`, [id]);
        }
        contactsUpdated++;
      }

      let insertResults = [];
      let sourceByParentId = new Map();
      let tid;
      let createdBy;

      if (toInsert.length) {
        const cleanInserts = toInsert.map(({ _ref, _archive, _password, tenant_code: _tc, ...rest }) => rest);

        insertResults = await contactModel.bulkInsert(cleanInserts, CONTACT_CONFIG.returningCols);
        contactsInserted = insertResults.length;

        const sourcesModel = db('sources', schema);
        sourcesModel.tx = t;

        tid = cleanInserts[0]?.tenant_id;
        createdBy = cleanInserts[0]?.created_by || null;

        const sourceRecords = insertResults.map((rec) => ({
          tenant_id: tid,
          table_id: rec.id,
          source_type: CONTACT_CONFIG.sourceType,
          label: CONTACT_CONFIG.buildLabel(rec),
          created_by: createdBy,
        }));

        const sourceResults = await sourcesModel.bulkInsert(sourceRecords, ['id', 'table_id']);
        sourceByParentId = new Map(sourceResults.map((sr) => [sr.table_id, sr.id]));

        for (let i = 0; i < insertResults.length; i++) {
          const rec = insertResults[i];
          const sourceId = sourceByParentId.get(rec.id);
          if (sourceId) {
            await t.none(`UPDATE ${s}.vendor_contacts SET source_id = $1 WHERE id = $2`, [sourceId, rec.id]);
          }
          const ref = toInsert[i]._ref;
          if (ref && sourceId) {
            contactRefToSourceId.set(ref, sourceId);
          }
          if (toInsert[i]._archive) {
            await t.none(`UPDATE ${s}.vendor_contacts SET deactivated_at = NOW() WHERE id = $1`, [rec.id]);
          }
        }
      }

      for (let ci = 0; ci < CONTACT_CONFIG.childSheets.length; ci++) {
        const sheetIdx = 6 + ci;
        if (reader.sheetCount > sheetIdx) {
          await importChildSheet(reader, sheetIdx, contactRefToSourceId, CONTACT_CONFIG.childSheets[ci].modelName, schema, CONTACT_CONFIG.linkColName, callbackFn, tenantId, t);
        }
      }

      if (CONTACT_CONFIG.appUserProvisioning && insertResults.length) {
        const crypto = await import('node:crypto');
        const bcrypt = await import('bcrypt');
        const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

        for (let i = 0; i < insertResults.length; i++) {
          const row = toInsert[i];
          if (!row.is_app_user) continue;

          const rec = insertResults[i];
          const sourceId = sourceByParentId.get(rec.id);
          if (!sourceId) continue;

          const loginEmail = await t.oneOrNone(
            `SELECT email FROM ${s}.emails
             WHERE source_id = $1 AND deactivated_at IS NULL
             ORDER BY is_login DESC, is_primary DESC, created_at LIMIT 1`,
            [sourceId],
          );
          if (!loginEmail) {
            await t.none(`UPDATE ${s}.vendor_contacts SET is_app_user = false WHERE id = $1`, [rec.id]);
            continue;
          }

          const clearPassword = row._password || crypto.randomBytes(12).toString('base64url');
          const passwordHash = await bcrypt.default.hash(clearPassword, rounds);
          const napUsersModel = db('napUsers', 'admin');
          napUsersModel.tx = t;
          await napUsersModel.insert({
            tenant_id: tid,
            entity_type: CONTACT_CONFIG.appUserProvisioning.entityType,
            entity_id: rec.id,
            email: loginEmail.email,
            password_hash: passwordHash,
            status: 'invited',
            created_by: createdBy,
          });
        }
      }
    });

    return {
      ...vendorResult,
      contactsInserted,
      contactsUpdated,
    };
  }
}
