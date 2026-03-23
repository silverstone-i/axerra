/**
 * @file Vendors model — extends TableModel with multi-sheet upsert export/import
 * @module core/models/Vendors
 *
 * Supports both standalone vendor export/import (5-sheet workbook) and combined
 * vendor + vendor_contacts export/import (10-sheet workbook with contact children).
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
 */

import { writeFileSync, readFileSync } from 'node:fs';
import { TableModel } from 'pg-schemata';
import vendorsSchema from '../schemas/vendorsSchema.js';
import {
  exportSourceEntity,
  importSourceEntity,
  buildExportWorkbook,
  buildChildSheet,
  importChildSheet,
  parseSheet,
  isUuid,
  curateRows,
  coerceRow,
  PHONE_HEADERS,
  ADDRESS_HEADERS,
  TAX_ID_HEADERS,
  EMAIL_HEADERS,
} from '../../../lib/spreadsheetHelpers.js';

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
   * Export vendors AND their vendor_contacts into a single 10-sheet workbook.
   *
   * Sheets 0-4: Vendors + vendor children (emails, phones, addresses, tax IDs)
   * Sheet 5: Vendor Contacts (linked by vendor_id)
   * Sheets 6-9: Contact children (emails, phones, addresses, tax IDs)
   */
  async exportCombinedSpreadsheet(filePath, where = [], joinType = 'AND', options = {}) {
    // Phase 1: Build vendor export workbook (sheets 0-4)
    const { wb, rows: vendorRows, writeXlsx } = await buildExportWorkbook(this, where, joinType, options, CONFIG);

    if (!vendorRows.length) {
      writeFileSync(filePath, writeXlsx(wb.build()));
      return { exported: 0, filePath };
    }

    const { db } = await getDb();
    const schema = this._schema.dbSchema;
    const vendorIds = vendorRows.map((v) => v.id);

    // Phase 2: Query vendor contacts for these vendors
    const contactModel = db('vendorContacts', schema);
    const contactRows = await contactModel.findWhere([{ vendor_id: { $in: vendorIds } }], 'AND', { includeDeactivated: true });

    const contactSheet = wb.sheet(CONTACT_CONFIG.sheetName);
    if (!contactRows.length) {
      // Empty contacts — template headers
      contactSheet.setHeaders(['vendor_id', 'id', 'first_name', 'last_name', 'position', 'department', 'is_app_user', 'roles', 'status', 'password']);
      for (const child of CONTACT_CONFIG.childSheets) {
        const childSheet = wb.sheet(child.sheetName);
        childSheet.setHeaders([CONTACT_CONFIG.linkColName, ...child.headers]);
      }
      writeFileSync(filePath, writeXlsx(wb.build()));
      return { exported: vendorRows.length, filePath };
    }

    // Curate contact rows + append vendor_id linkage + extra columns
    const curated = curateRows(contactRows);
    const withExtras = curated.map((row, i) => {
      const extra = {};
      for (const col of CONTACT_CONFIG.extraExportCols) {
        extra[col.name] = col.derive(contactRows[i]);
      }
      return { vendor_id: contactRows[i].vendor_id, ...row, ...extra };
    });
    contactSheet.setHeaders(Object.keys(withExtras[0]));
    contactSheet.addObjects(withExtras);

    // Phase 3: Build contact child sheets (emails, phones, addresses, tax IDs)
    const contactIdBySourceId = new Map();
    const contactSourceIds = [];
    for (const c of contactRows) {
      if (c.source_id) {
        contactIdBySourceId.set(c.source_id, c.id);
        contactSourceIds.push(c.source_id);
      }
    }

    for (const child of CONTACT_CONFIG.childSheets) {
      await buildChildSheet(wb, child.sheetName, db(child.modelName, schema), contactSourceIds, contactIdBySourceId, CONTACT_CONFIG.linkColName, child.headers);
    }

    writeFileSync(filePath, writeXlsx(wb.build()));
    return { exported: vendorRows.length, contacts: contactRows.length, filePath };
  }

  /**
   * Import from a combined 10-sheet workbook (vendors + vendor_contacts).
   * Auto-detects format: if sheet count >= 6, treats as combined; otherwise falls
   * through to the standard 5-sheet vendor-only import.
   */
  async importCombinedSpreadsheet(filePath, _sheetIndex = 0, callbackFn = null) {
    const { WorkbookReader } = await import('@nap-sft/tablsx');
    const buffer = readFileSync(filePath);
    const reader = WorkbookReader.fromBuffer(buffer);

    // Auto-detect: fewer than 6 sheets means legacy vendor-only format
    if (reader.sheetCount < 6) {
      return importSourceEntity(this, filePath, _sheetIndex, callbackFn, CONFIG);
    }

    // ── Combined import: vendors (sheets 0-4) + contacts (sheets 5-9) ──

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

    // Resolve tenant_id from callbackFn
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

      // Partition into updates vs inserts
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

      // Run updates
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

      // Run inserts + create sources
      // Note: do NOT downgrade is_app_user here — email lives in the Contact Emails
      // child sheet (imported in Phase 3). Provisioning is deferred to Phase 4.
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

      // Phase 3: Import contact child sheets (6-9: emails, phones, addresses, tax IDs)
      for (let ci = 0; ci < CONTACT_CONFIG.childSheets.length; ci++) {
        const sheetIdx = 6 + ci;
        if (reader.sheetCount > sheetIdx) {
          await importChildSheet(reader, sheetIdx, contactRefToSourceId, CONTACT_CONFIG.childSheets[ci].modelName, schema, CONTACT_CONFIG.linkColName, callbackFn, tenantId, t);
        }
      }

      // Phase 4: Provision nap_users for app-user contacts AFTER emails are imported.
      // The login email comes from the Contact Emails child sheet, not the contacts sheet.
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

          // Resolve login email from the just-imported Contact Emails
          const loginEmail = await t.oneOrNone(
            `SELECT email FROM ${s}.emails
             WHERE source_id = $1 AND deactivated_at IS NULL
             ORDER BY is_login DESC, is_primary DESC, created_at LIMIT 1`,
            [sourceId],
          );
          if (!loginEmail) {
            // No email available — downgrade is_app_user
            await t.none(`UPDATE ${s}.vendor_contacts SET is_app_user = false WHERE id = $1`, [rec.id]);
            continue;
          }

          // Use supplied password or generate a temporary one (admin can reset later)
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
