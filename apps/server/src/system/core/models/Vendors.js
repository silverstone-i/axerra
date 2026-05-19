/**
 * @file Vendors model — extends TableModel with flat + multi-sheet export/import
 * @module core/models/Vendors
 *
 * Supports standalone vendor export/import (5-sheet workbook) and combined
 * vendor + vendor_contacts export/import. The combined format uses a flat
 * 2-sheet layout with repeated rows (one row per child record).
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import { writeFileSync, readFileSync } from 'node:fs';
import logger from '../../../lib/logger.js';
import { TableModel } from 'pg-schemata';
import vendorsSchema from '../schemas/vendorsSchema.js';
import {
  exportSourceEntity,
  importSourceEntity,
  parseSheet,
  isUuid,
  coerceRow,
  coerceChildRow,
  buildFlatRows,
  formatExportRow,
  groupFlatRows,
  provisionAppUser,
  batchHashPasswords,
  validateImportGroups,
  validateChildEnums,
  getEnumColumns,
  parseDbImportError,
  diffParent,
  _reconcileChildrenForSource,
  _classifyChildren,
  PHONE_HEADERS,
  ADDRESS_HEADERS,
  TAX_ID_HEADERS,
  EMAIL_HEADERS,
} from '../../../lib/spreadsheetHelpers.js';
import { allocateNumbers } from '../services/numberingService.js';

/** @type {import('../../../lib/spreadsheetHelpers.js').SourceEntityConfig} */
const CONFIG = {
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
  'email', 'email_label', 'email_is_primary',
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
    extract: (r) => ({ email: r.email, label: r.email_label, is_primary: r.email_is_primary }),
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
// Each cfg also carries the slotKeyCols / compareCols / key fields so it can
// be passed straight to the shared `_reconcileChildrenForSource` from
// spreadsheetHelpers. `modelName` mirrors `model` for the same reason — the
// shared helper reads `modelName`.
const VENDOR_CHILD_ARRAYS_CONFIG = [
  {
    model: 'emails', modelName: 'emails', key: 'emails',
    cols: ['email', 'label', 'is_primary'],
    flatCols: ['email', 'email_label', 'email_is_primary'],
    slotKeyCols: ['label'], compareCols: ['email', 'is_primary'],
  },
  {
    model: 'phoneNumbers', modelName: 'phoneNumbers', key: 'phones',
    cols: ['country_code', 'phone_type', 'phone_number', 'is_primary'],
    flatCols: ['phone_country_code', 'phone_type', 'phone_number', 'phone_is_primary'],
    slotKeyCols: ['phone_type'], compareCols: ['country_code', 'phone_number', 'is_primary'],
  },
  {
    model: 'addresses', modelName: 'addresses', key: 'addresses',
    cols: ['label', 'address_line_1', 'address_line_2', 'address_line_3', 'city', 'state_province', 'postal_code', 'country_code'],
    flatCols: ['address_label', 'address_line_1', 'address_line_2', 'address_line_3', 'address_city', 'address_state_province', 'address_postal_code', 'address_country_code'],
    slotKeyCols: ['label'], compareCols: ['address_line_1', 'address_line_2', 'address_line_3', 'city', 'state_province', 'postal_code', 'country_code'],
  },
  {
    model: 'taxIdentifiers', modelName: 'taxIdentifiers', key: 'taxIds',
    cols: ['country_code', 'tax_type', 'tax_value'],
    flatCols: ['tax_country_code', 'tax_type', 'tax_value'],
    slotKeyCols: ['country_code', 'tax_type'], compareCols: ['tax_value'],
  },
];

const CONTACT_CHILD_ARRAYS_CONFIG = [
  {
    model: 'emails', modelName: 'emails', key: 'emails',
    cols: ['email', 'label', 'is_primary', 'is_login'],
    flatCols: ['email', 'email_label', 'email_is_primary', 'email_is_login'],
    slotKeyCols: ['label'], compareCols: ['email', 'is_primary', 'is_login'],
  },
  {
    model: 'phoneNumbers', modelName: 'phoneNumbers', key: 'phones',
    cols: ['country_code', 'phone_type', 'phone_number', 'is_primary'],
    flatCols: ['phone_country_code', 'phone_type', 'phone_number', 'phone_is_primary'],
    slotKeyCols: ['phone_type'], compareCols: ['country_code', 'phone_number', 'is_primary'],
  },
];

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

/** Map child model name → group key produced by groupFlatRows extractors */
const _childKeyForModel = (model) =>
  model === 'phoneNumbers' ? 'phones' : model === 'taxIdentifiers' ? 'taxIds' : model;

/**
 * Normalize a child column value for set-comparison. Conflates null /
 * undefined / empty-string, trims strings, and coerces literal `'true'` /
 * `'false'` strings to booleans so the comparison survives the round-trip
 * through tablsx (which can hand back booleans as strings) and pg-schemata
 * coercion. Case is preserved — case-sensitive fields like `address_line_1`,
 * `city`, and `label` must surface case-only edits as real changes.
 */
function _normChildVal(v) {
  if (v === true) return true;
  if (v === false) return false;
  if (v == null) return null;
  if (typeof v === 'string') {
    const t = v.trim();
    if (t === '') return null;
    if (/^true$/i.test(t)) return true;
    if (/^false$/i.test(t)) return false;
    return t;
  }
  return v;
}

/**
 * Order-insensitive set equality between two child collections, comparing
 * only the columns in `cols`. Used by `_upsertFlatChildren` to skip the
 * wholesale soft-delete + re-insert when the file's child set matches the
 * DB's current active set.
 */
function _sameChildSet(incoming, existing, cols) {
  if (incoming.length !== existing.length) return false;
  const fp = (row) => cols.map((c) => JSON.stringify(_normChildVal(row[c]))).join('|');
  const a = incoming.map(fp).sort();
  const b = existing.map(fp).sort();
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * Build childEnums config (key + enumMap + flatColByCol) for validateChildEnums
 * from a *_CHILD_ARRAYS_CONFIG entry list.
 */
function buildChildEnumsFromArrays(arrayConfigs, db, schema) {
  const childEnums = [];
  for (const cfg of arrayConfigs) {
    const childModel = db(cfg.model, schema);
    const enumMap = getEnumColumns(childModel._schema);
    if (!enumMap.size) continue;
    const flatColByCol = new Map();
    cfg.cols.forEach((col, i) => flatColByCol.set(col, cfg.flatCols[i]));
    childEnums.push({ key: _childKeyForModel(cfg.model), enumMap, flatColByCol });
  }
  return childEnums;
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
      for (const row of flatRows) formatExportRow(row, 'phone_number', 'phone_country_code', 'tax_value', 'tax_country_code', 'tax_type');
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
        for (const row of flatRows) formatExportRow(row, 'phone_number', 'phone_country_code');
        contactSheet.addObjects(flatRows);
      }
    }

    writeFileSync(filePath, writeXlsx(wb.build()));
    return { exported: vendorRows.length, contacts: contactRows.length, filePath };
  }

  /**
   * Import from a combined workbook (vendors + vendor_contacts).
   *
   * Only the flat 2-sheet shape is supported (Vendors sheet + Vendor Contacts
   * sheet — the shape `exportCombinedSpreadsheet` produces). The pre-2025
   * legacy multi-sheet formats (5-sheet vendor-only, 6+-sheet combined) were
   * removed when the preview path landed.
   *
   * Pass `{ previewOnly: true }` to receive a classification payload without
   * writes: `{ preview: true, vendors: {inserts, updates, noops, omitted},
   * contacts: {...}, errors: [] }`.
   */
  async importCombinedSpreadsheet(filePath, callbackFn = null, { previewOnly = false } = {}) {
    const { WorkbookReader } = await import('@nap-sft/tablsx');
    const buffer = readFileSync(filePath);
    const reader = WorkbookReader.fromBuffer(buffer);

    if (reader.sheetCount > 2) {
      return {
        errors: [
          {
            sheet: reader.sheetNames?.[0] || 'Vendors',
            row: 0,
            column: '',
            value: '',
            message: 'Workbook must be in the flat 2-sheet format (Vendors + Vendor Contacts).',
          },
        ],
      };
    }

    return this._importFlatCombined(reader, callbackFn, { previewOnly });
  }

  // ── Flat import (2-sheet repeated-row format) ─────────────────────────────

  async _importFlatCombined(reader, callbackFn, { previewOnly = false } = {}) {
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
      // Normalize blank code to null. The vendors table has a unique
      // (tenant_id, code) constraint; two rows with code='' collide on
      // insert. Numbering allocation runs after bulkInsert, so blanks
      // must arrive as null for it to fill them in.
      if (typeof g.parent.code === 'string' && !g.parent.code.trim()) g.parent.code = null;
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
    const vendorSheetName = sheetNames[0] || 'Vendors';
    const contactSheetName = sheetNames[1] || 'Vendor Contacts';
    const vendorChildEnums = buildChildEnumsFromArrays(VENDOR_CHILD_ARRAYS_CONFIG, db, schema);
    const contactChildEnums = buildChildEnumsFromArrays(CONTACT_CHILD_ARRAYS_CONFIG, db, schema);
    const errors = [
      ...(await validateImportGroups(vendorGroups, {
        sheetName: vendorSheetName,
        requiredFields: ['name'],
        conflicts: vendorConflicts,
      })),
      ...validateChildEnums(vendorGroups, { sheetName: vendorSheetName, childEnums: vendorChildEnums }),
      ...(await validateImportGroups(contactGroups, {
        sheetName: contactSheetName,
        requiredFields: ['first_name', 'last_name'],
        conflicts: contactConflicts,
        entityType: 'vendor_contact',
      })),
      ...validateChildEnums(contactGroups, { sheetName: contactSheetName, childEnums: contactChildEnums }),
    ];
    if (errors.length) {
      return previewOnly
        ? {
            preview: true,
            vendors: { inserts: 0, updates: 0, noops: 0, omitted: 0 },
            contacts: { inserts: 0, updates: 0, noops: 0, omitted: 0 },
            errors,
          }
        : { errors };
    }

    if (previewOnly) {
      const buckets = await this._classifyCombinedForPreview({
        db,
        s,
        schema,
        pgp,
        vendorGroups,
        contactGroups,
        callbackFn,
        tenantId,
      });
      return { preview: true, vendors: buckets.vendors, contacts: buckets.contacts, errors: [] };
    }

    let insertedCount = 0;
    let updatedCount = 0;
    let vendorsRestored = 0;
    let contactsInserted = 0;
    let contactsUpdated = 0;
    let contactsRestored = 0;

    // Maps for cross-sheet vendor_id resolution
    const vendorRefToId = new Map(); // spreadsheet id/ref → DB vendor id
    const vendorIdToSourceId = new Map(); // DB vendor id → source_id

    const _t0 = Date.now();
    let _tVendorUpdates, _tVendorInserts, _tContactInserts, _tAppUsers;
    try {
    await db.tx(async (t) => {
      this.tx = t;
      // ── Phase 1: Upsert vendors ──────────────────────────────────────

      const uuidIds = vendorGroups.filter((g) => isUuid(g.parent.id)).map((g) => g.parent.id);
      const existingVendors = new Map();
      if (uuidIds.length) {
        // Pull full rows so the per-row diff can skip noop updates and keep
        // the preview's "0 writes" promise.
        const existing = await t.any(
          `SELECT * FROM ${s}.vendors WHERE id IN ($1:csv)`,
          [uuidIds],
        );
        for (const row of existing) {
          existingVendors.set(row.id, row);
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

      // Run updates — skip rows whose transformed values match the DB. This
      // keeps the preview's "0 writes" promise honest and avoids churning
      // `updated_at` / `updated_by` on every existing vendor on a re-import.
      for (const { transformed, isArchived, group } of toUpdate) {
        const { id, ...changes } = transformed;
        const existing = existingVendors.get(id);
        const parentDiff = diffParent(transformed, existing, { caseSensitive: true });
        const wasArchived = !!existing.deactivated_at;
        const archiveChanged = wasArchived !== isArchived;
        const parentChanged = Object.keys(parentDiff).length > 0 || archiveChanged;

        if (parentChanged) {
          await this.updateWhere([{ id }], changes, { includeDeactivated: true });
          if (isArchived) {
            await t.none(`UPDATE ${s}.vendors SET deactivated_at = NOW() WHERE id = $1 AND deactivated_at IS NULL`, [id]);
          } else {
            await t.none(`UPDATE ${s}.vendors SET deactivated_at = NULL WHERE id = $1 AND deactivated_at IS NOT NULL`, [id]);
          }
        }

        // Always populate the ref maps so cross-sheet contact resolution and
        // child upsert use the correct source_id, even when the parent itself
        // wasn't written.
        vendorRefToId.set(id, id);
        vendorIdToSourceId.set(id, existing.source_id);

        // Child reconcile also counts as an update: the count must reflect
        // every DB write, not just parent-field changes.
        let childReplaced = false;
        if (existing.source_id) {
          const r = await this._upsertFlatChildren(t, s, schema, db, pgp, existing.source_id, group.children, VENDOR_CHILD_ARRAYS_CONFIG, callbackFn, tenantId);
          childReplaced = r.anyReplaced;
          vendorsRestored += r.restored;
        }
        if (parentChanged || childReplaced) updatedCount++;
      }

      _tVendorUpdates = Date.now();
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

        const sourceRecords = insertResults.map((rec) => ({
          tenant_id: tid,
          table_id: rec.id,
          source_type: CONFIG.sourceType,
          label: CONFIG.buildLabel(rec),
        }));
        const sourceResults = await sourcesModel.bulkInsert(sourceRecords, ['id', 'table_id']);
        const sourceByParentId = new Map(sourceResults.map((sr) => [sr.table_id, sr.id]));

        // ── Batch: link source_id ──────────────────────────────────
        const sourceLinks = insertResults
          .map((rec) => ({ id: rec.id, source_id: sourceByParentId.get(rec.id) }))
          .filter((r) => r.source_id);
        if (sourceLinks.length) {
          const vals = sourceLinks.map((r) => pgp.as.format('($1::uuid, $2::uuid)', [r.id, r.source_id])).join(', ');
          await t.none(`UPDATE ${s}.vendors AS v SET source_id = vals.source_id FROM (VALUES ${vals}) AS vals(id, source_id) WHERE v.id = vals.id`);
        }

        // ── Batch: allocate codes ──────────────────────────────────
        if (CONFIG.idType) {
          const needCodeIndices = [];
          for (let i = 0; i < cleanInserts.length; i++) {
            if (!cleanInserts[i].code) needCodeIndices.push(i);
          }
          if (needCodeIndices.length) {
            const codes = await allocateNumbers(schema, CONFIG.idType, needCodeIndices.length, null, new Date(), t);
            if (codes) {
              const codeUpdates = needCodeIndices.map((idx, ci) => ({
                id: insertResults[idx].id,
                code: codes[ci].displayId,
              }));
              const codeVals = codeUpdates.map((r) => pgp.as.format('($1::uuid, $2)', [r.id, r.code])).join(', ');
              await t.none(`UPDATE ${s}.vendors AS v SET code = vals.code FROM (VALUES ${codeVals}) AS vals(id, code) WHERE v.id = vals.id`);
            }
          }
        }

        // Build ref maps (JS only, no DB)
        for (let i = 0; i < insertResults.length; i++) {
          const ref = toInsert[i].ref;
          if (ref) vendorRefToId.set(ref, insertResults[i].id);
          vendorRefToId.set(insertResults[i].id, insertResults[i].id);
          vendorIdToSourceId.set(insertResults[i].id, sourceByParentId.get(insertResults[i].id));
        }

        // ── Batch: archive inserted rows whose status was 'archived' ─
        const archiveIds = insertResults.filter((_, i) => toInsert[i].isArchived).map((r) => r.id);
        if (archiveIds.length) {
          await t.none(`UPDATE ${s}.vendors SET deactivated_at = NOW() WHERE id IN ($1:csv)`, [archiveIds]);
        }

        // ── Batch: insert children across all new vendors ──────────
        const r = await this._batchUpsertFlatChildren(t, s, schema, db, pgp, insertResults, sourceByParentId, toInsert, VENDOR_CHILD_ARRAYS_CONFIG, callbackFn, tenantId);
        vendorsRestored += r.restored;
      }

      _tVendorInserts = Date.now();
      // ── Phase 2: Import vendor contacts from sheet 1 ─────────────────

      if (!contactGroups.length) return;

      const contactModel = db('vendorContacts', schema);
      contactModel.tx = t;

      const contactUuidIds = contactGroups.filter((g) => isUuid(g.parent.id)).map((g) => g.parent.id);
      const existingContacts = new Map();
      if (contactUuidIds.length) {
        const existing = await t.any(
          `SELECT * FROM ${s}.vendor_contacts WHERE id IN ($1:csv)`,
          [contactUuidIds],
        );
        for (const row of existing) existingContacts.set(row.id, row);
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

      // Run contact updates — same noop-skip semantics as vendors. The
      // writer doesn't reparent contacts via import (vendor_id is excluded
      // from the update DTO), so vendor_id is also excluded from the diff
      // to avoid false-positive updates when only the cross-sheet ref differs.
      for (const { transformed, isArchived, group } of contactToUpdate) {
        const existing = existingContacts.get(transformed.id);
        const { id, vendor_id: _vid, ...changes } = transformed;
        const { vendor_id: _diffVid, ...transformedForDiff } = transformed;
        const parentDiff = diffParent(transformedForDiff, existing, { caseSensitive: true });
        const wasArchived = !!existing.deactivated_at;
        const archiveChanged = wasArchived !== isArchived;
        const parentChanged = Object.keys(parentDiff).length > 0 || archiveChanged;

        if (parentChanged) {
          await contactModel.updateWhere([{ id }], changes, { includeDeactivated: true });
          if (isArchived) {
            await t.none(`UPDATE ${s}.vendor_contacts SET deactivated_at = NOW() WHERE id = $1 AND deactivated_at IS NULL`, [id]);
          } else {
            await t.none(`UPDATE ${s}.vendor_contacts SET deactivated_at = NULL WHERE id = $1 AND deactivated_at IS NOT NULL`, [id]);
          }
        }

        let childReplaced = false;
        if (existing.source_id) {
          const r = await this._upsertFlatChildren(t, s, schema, db, pgp, existing.source_id, group.children, CONTACT_CHILD_ARRAYS_CONFIG, callbackFn, tenantId);
          childReplaced = r.anyReplaced;
          contactsRestored += r.restored;
        }
        if (parentChanged || childReplaced) contactsUpdated++;
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
        // createdBy stays for provisionAppUser below — raw INSERT into
        // admin.portal_users bypasses pg-schemata's audit resolver.
        const createdBy = cleanInserts[0]?.created_by || null;

        const sourceRecords = insertResults.map((rec) => ({
          tenant_id: tid,
          table_id: rec.id,
          source_type: CONTACT_CONFIG.sourceType,
          label: CONTACT_CONFIG.buildLabel(rec),
        }));
        const sourceResults = await sourcesModel.bulkInsert(sourceRecords, ['id', 'table_id']);
        const sourceByParentId = new Map(sourceResults.map((sr) => [sr.table_id, sr.id]));

        // ── Batch: link source_id for contacts ─────────────────────
        const contactSourceLinks = insertResults
          .map((rec) => ({ id: rec.id, source_id: sourceByParentId.get(rec.id) }))
          .filter((r) => r.source_id);
        if (contactSourceLinks.length) {
          const vals = contactSourceLinks.map((r) => pgp.as.format('($1::uuid, $2::uuid)', [r.id, r.source_id])).join(', ');
          await t.none(`UPDATE ${s}.vendor_contacts AS v SET source_id = vals.source_id FROM (VALUES ${vals}) AS vals(id, source_id) WHERE v.id = vals.id`);
        }

        // ── Batch: archive inserted contacts whose status was 'archived' ─
        const contactArchiveIds = insertResults.filter((_, i) => contactToInsert[i].isArchived).map((r) => r.id);
        if (contactArchiveIds.length) {
          await t.none(`UPDATE ${s}.vendor_contacts SET deactivated_at = NOW() WHERE id IN ($1:csv)`, [contactArchiveIds]);
        }

        // ── Batch: insert children across all new contacts ─────────
        const r = await this._batchUpsertFlatChildren(t, s, schema, db, pgp, insertResults, sourceByParentId, contactToInsert, CONTACT_CHILD_ARRAYS_CONFIG, callbackFn, tenantId);
        contactsRestored += r.restored;

        _tContactInserts = Date.now();
        // Provision portal_users for app-user contacts after emails are inserted
        if (CONTACT_CONFIG.appUserProvisioning) {
          const crypto = await import('node:crypto');

          // Identify app-user contacts and their source_ids
          const appUserCandidates = [];
          for (let i = 0; i < insertResults.length; i++) {
            if (!cleanInserts[i].is_app_user) continue;
            const sourceId = sourceByParentId.get(insertResults[i].id);
            if (!sourceId) continue;
            appUserCandidates.push({ index: i, sourceId });
          }

          if (appUserCandidates.length) {
            // Batch email lookup — single query instead of N
            const candidateSourceIds = appUserCandidates.map((c) => c.sourceId);
            const emailRows = await t.any(
              `SELECT DISTINCT ON (source_id) source_id, email
               FROM ${s}.emails
               WHERE source_id IN ($1:csv) AND deactivated_at IS NULL
               ORDER BY source_id, is_login DESC, is_primary DESC, created_at`,
              [candidateSourceIds],
            );
            const emailBySourceId = new Map(emailRows.map((r) => [r.source_id, r.email]));

            // Build password list and pre-hash in parallel
            const toProvision = [];
            for (const { index, sourceId } of appUserCandidates) {
              const email = emailBySourceId.get(sourceId);
              if (!email) {
                await t.none(`UPDATE ${s}.vendor_contacts SET is_app_user = false WHERE id = $1`, [insertResults[index].id]);
                continue;
              }
              const clearPassword = contactToInsert[index].password || crypto.randomBytes(12).toString('base64url');
              toProvision.push({ index, email, clearPassword });
            }

            if (toProvision.length) {
              const hashMap = await batchHashPasswords(toProvision.map((p) => ({ index: p.index, password: p.clearPassword })));

              for (const { index, email, clearPassword } of toProvision) {
                const created = await provisionAppUser(
                  insertResults[index].id, email, clearPassword, tid, createdBy,
                  CONTACT_CONFIG.appUserProvisioning.entityType, t, hashMap.get(index),
                );
                if (!created) {
                  await t.none(`UPDATE ${s}.vendor_contacts SET is_app_user = false WHERE id = $1`, [insertResults[index].id]);
                }
              }
            }
          }
        }
      }
    });
    } catch (err) {
      const dataErrors = parseDbImportError(err);
      if (dataErrors) return { errors: dataErrors };
      throw err;
    } finally {
      this.tx = null;
    }
    _tAppUsers = Date.now();
    logger.info('Vendor combined import timing', {
      vendorUpdates: `${(_tVendorUpdates || _t0) - _t0}ms (${updatedCount} rows)`,
      vendorInserts: `${(_tVendorInserts || _tVendorUpdates || _t0) - (_tVendorUpdates || _t0)}ms (${insertedCount} rows)`,
      contactInserts: `${(_tContactInserts || _tVendorInserts || _t0) - (_tVendorInserts || _t0)}ms (${contactsInserted + contactsUpdated} rows)`,
      appUserProvisioning: `${_tAppUsers - (_tContactInserts || _t0)}ms`,
      total: `${_tAppUsers - _t0}ms`,
    });
    return {
      inserted: insertedCount,
      updated: updatedCount,
      restored: vendorsRestored,
      contactsInserted,
      contactsUpdated,
      contactsRestored,
    };
  }

  /**
   * Transform the file's child rows for a single cfg into the same shape
   * `bulkInsert` would persist. Shared by the commit (`_upsertFlatChildren`)
   * and the preview classifier (`_anyChildrenDiffer`) so both sides compare
   * the exact same values.
   */
  async _transformFlatChildSet(cfg, fileRows, sourceId, childModel, callbackFn, tenantId) {
    const out = [];
    for (const row of fileRows) {
      const { _rowNum: _, ...rest } = row;
      const base = { ...rest, source_id: sourceId };
      const transformed = callbackFn ? await callbackFn(base) : base;
      delete transformed.tenant_code;
      if (tenantId) transformed.tenant_id = tenantId;
      coerceChildRow(transformed, childModel);
      out.push(transformed);
    }
    // Enforce single is_primary per source (partial unique index).
    if (out.length > 1) {
      let seenPrimary = false;
      for (const r of out) {
        if (r.is_primary) {
          if (seenPrimary) r.is_primary = false;
          else seenPrimary = true;
        }
      }
    }
    return out;
  }

  /**
   * No-write check: would `_upsertFlatChildren` replace any of this parent's
   * child sets? Iterates the cfgs the same way, transforms the file rows,
   * loads the DB's current active set, and returns true on the first cfg
   * whose set differs. Used by the preview classifier to keep preview /
   * commit aligned on child-only changes, and (indirectly) by the commit
   * path's updated-count accounting via `_upsertFlatChildren`'s return.
   */
  async _anyChildrenDiffer({ t, db, s, schema, pgp, sourceId, fileChildren, childConfig, callbackFn, tenantId }) {
    const handle = t || db;
    for (const cfg of childConfig) {
      const rawRows = fileChildren?.[cfg.key];
      if (!rawRows || !rawRows.length) continue;

      const childModel = db(cfg.model, schema);
      if (t) childModel.tx = t;
      const tableName = childModel._schema?.table || cfg.model;
      const tName = pgp.as.name(tableName);

      const toInsert = await this._transformFlatChildSet(cfg, rawRows, sourceId, childModel, callbackFn, tenantId);
      // Archive-aware: load active AND archived rows so an incoming value
      // matching an archived row classifies as restore (= a DB write that
      // commit will perform). Old behavior loaded active only and missed
      // restores entirely, leaving preview reporting "no change" for a
      // commit that would actually flip a deactivated_at.
      const existing = await handle.any(
        `SELECT * FROM ${s}.${tName} WHERE source_id = $1`,
        [sourceId],
      );
      const { counts } = _classifyChildren(existing, toInsert, cfg);
      if (counts.inserts + counts.updates + counts.restores > 0) return true;
    }
    return false;
  }

  /**
   * Upsert flat children for an updated parent via the shared archive-aware
   * reconciler from spreadsheetHelpers (`_reconcileChildrenForSource`). Per
   * incoming row classifies as insert / update / restore / restore+update /
   * noop — so re-importing a value that lived only in the trash bin brings
   * the original row back instead of either tripping a unique constraint or
   * leaving the trash bin to grow.
   *
   * Returns `{ anyReplaced, restored }`. The boolean lets the caller count
   * child-only changes as parent updates; the count rolls into the importer's
   * top-level `restored` total.
   */
  async _upsertFlatChildren(t, s, schema, db, pgp, sourceId, children, childConfig, callbackFn, tenantId) {
    let anyReplaced = false;
    let restored = 0;
    for (const cfg of childConfig) {
      const childRows = children[cfg.key];
      if (!childRows || !childRows.length) continue;

      const counts = await _reconcileChildrenForSource(t, s, schema, db, pgp, sourceId, childRows, cfg, callbackFn, tenantId);
      restored += counts.restores;
      if (counts.inserts + counts.updates + counts.restores > 0) anyReplaced = true;
    }
    return { anyReplaced, restored };
  }

  /**
   * Batch upsert flat children across ALL newly inserted entities at once.
   * Instead of per-entity soft-delete + insert, collects all children per type
   * and executes 1 soft-delete + 1 bulkInsert per child type.
   *
   * @param {Object}   t               Transaction context
   * @param {string}   s               Quoted schema name
   * @param {string}   schema          Raw schema name
   * @param {Function} db              Repository accessor
   * @param {Object}   pgp             pg-promise instance
   * @param {Object[]} insertResults   Array of inserted parent records (must have .id)
   * @param {Map}      sourceByParentId  Maps parent id → source_id
   * @param {Object[]} toInsertMeta    Array of { group: { children }, ... } per parent
   * @param {Object[]} childConfig     Child config array (e.g. VENDOR_CHILD_ARRAYS_CONFIG)
   * @param {Function} callbackFn      Row transformer
   * @param {string}   tenantId        Resolved tenant UUID
   */
  async _batchUpsertFlatChildren(t, s, schema, db, pgp, insertResults, sourceByParentId, toInsertMeta, childConfig, callbackFn, tenantId) {
    // Iterate per (cfg, source) and delegate to the shared reconciler. We
    // lose the prior 1-soft-delete-+-1-bulk-insert micro-optimization but
    // gain archive-aware reconciliation (a child whose value lives in the
    // trash bin gets restored, matching the flat single-entity path). Newly
    // inserted parents normally have empty existing-child sets, so the
    // reconciler degrades to a single bulk insert per source.
    let restored = 0;
    for (const cfg of childConfig) {
      for (let i = 0; i < insertResults.length; i++) {
        const sourceId = sourceByParentId.get(insertResults[i].id);
        if (!sourceId) continue;
        const childRows = toInsertMeta[i].group?.children?.[cfg.key];
        if (!childRows?.length) continue;
        const counts = await _reconcileChildrenForSource(t, s, schema, db, pgp, sourceId, childRows, cfg, callbackFn, tenantId);
        restored += counts.restores;
      }
    }
    return { restored };
  }

  // ── Preview classifier (no writes) ────────────────────────────────────────

  /**
   * Classify what `_importFlatCombined` would do without touching the DB.
   * Returns parent-level counts for vendors and contacts. Parents with no
   * field-level diff but whose child set differs from the DB count as
   * updates (not noops) to mirror what `_upsertFlatChildren` would do on
   * commit — preview must not promise "no changes" when a child wholesale
   * replace is about to fire.
   */
  async _classifyCombinedForPreview({ db, s, schema, pgp, vendorGroups, contactGroups, callbackFn, tenantId }) {
    const stripContactCols = ['status', 'deactivated_at', 'password'];

    const vendors = { inserts: 0, updates: 0, noops: 0, omitted: 0 };
    const contacts = { inserts: 0, updates: 0, noops: 0, omitted: 0 };

    // Vendors ─────────────────────────────────────────────────────────────
    const vendorUuidIds = vendorGroups.filter((g) => isUuid(g.parent.id)).map((g) => g.parent.id);
    const existingVendors = new Map();
    if (vendorUuidIds.length) {
      const rows = await db.any(`SELECT * FROM ${s}.vendors WHERE id IN ($1:csv)`, [vendorUuidIds]);
      for (const row of rows) existingVendors.set(row.id, row);
    }

    for (const group of vendorGroups) {
      const existing = existingVendors.get(group.parent.id);
      if (!existing) {
        vendors.inserts += 1;
        continue;
      }
      const willBeArchived = String(group.parent.status || '').toLowerCase() === 'archived';
      const wasArchived = !!existing.deactivated_at;
      const { _rowNum: _rn, ...vendorData } = { ...group.parent };
      delete vendorData.status;
      const transformed = callbackFn ? await callbackFn({ ...vendorData }) : { ...vendorData };
      delete transformed.tenant_code;
      if (tenantId) transformed.tenant_id = tenantId;
      const changes = diffParent(transformed, existing, { caseSensitive: true });
      const parentChanged = Object.keys(changes).length > 0 || willBeArchived !== wasArchived;
      const childrenDiffer = existing.source_id
        ? await this._anyChildrenDiffer({
            db, s, schema, pgp,
            sourceId: existing.source_id,
            fileChildren: group.children,
            childConfig: VENDOR_CHILD_ARRAYS_CONFIG,
            callbackFn,
            tenantId,
          })
        : false;
      if (parentChanged || childrenDiffer) vendors.updates += 1;
      else vendors.noops += 1;
    }

    // Contacts ────────────────────────────────────────────────────────────
    const contactUuidIds = contactGroups.filter((g) => isUuid(g.parent.id)).map((g) => g.parent.id);
    const existingContacts = new Map();
    if (contactUuidIds.length) {
      const rows = await db.any(`SELECT * FROM ${s}.vendor_contacts WHERE id IN ($1:csv)`, [contactUuidIds]);
      for (const row of rows) existingContacts.set(row.id, row);
    }

    for (const group of contactGroups) {
      const existing = existingContacts.get(group.parent.id);
      if (!existing) {
        contacts.inserts += 1;
        continue;
      }
      const willBeArchived = String(group.parent.status || '').toLowerCase() === 'archived';
      const wasArchived = !!existing.deactivated_at;
      const { _rowNum: _crn, ...contactData } = { ...group.parent };
      for (const col of stripContactCols) delete contactData[col];
      const transformed = callbackFn ? await callbackFn({ ...contactData }) : { ...contactData };
      for (const col of stripContactCols) delete transformed[col];
      delete transformed.tenant_code;
      if (tenantId) transformed.tenant_id = tenantId;
      coerceRow(transformed, CONTACT_CONFIG.boolCols, CONTACT_CONFIG.hasRoles);
      // vendor_id refs pointing at to-be-inserted vendors aren't resolvable
      // yet — skip the column for the diff (the commit-side resolution map
      // is built during writes). If a stable UUID is provided it'll be diffed
      // normally.
      if (transformed.vendor_id && !isUuid(transformed.vendor_id)) delete transformed.vendor_id;
      const changes = diffParent(transformed, existing, { caseSensitive: true });
      const parentChanged = Object.keys(changes).length > 0 || willBeArchived !== wasArchived;
      const childrenDiffer = existing.source_id
        ? await this._anyChildrenDiffer({
            db, s, schema, pgp,
            sourceId: existing.source_id,
            fileChildren: group.children,
            childConfig: CONTACT_CHILD_ARRAYS_CONFIG,
            callbackFn,
            tenantId,
          })
        : false;
      if (parentChanged || childrenDiffer) contacts.updates += 1;
      else contacts.noops += 1;
    }

    return { vendors, contacts };
  }

}
