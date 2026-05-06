/**
 * @file Policy catalog reconciler — diff/upsert/delete CATALOG_ENTRIES into a tenant schema
 * @module core/services/policyCatalogReconciler
 *
 * Replaces the historical insert-only `seedPolicyCatalog` and the periodic
 * throwaway "reseed" migrations. CATALOG_ENTRIES (declared in
 * policyCatalogSeeder.js) is the declarative source of truth; this module
 * applies the diff against any provisioned tenant schema and is the path
 * used by tenant provisioning and the reconcile CLI.
 *
 * Idempotent. Safe to re-run. Returns { inserted, updated, removed, unchanged }.
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import logger from '../../../lib/logger.js';
import { CATALOG_ENTRIES } from './policyCatalogSeeder.js';

const MUTABLE_FIELDS = ['label', 'description', 'sort_order', 'valid_statuses', 'available_fields', 'policy_required'];

const tupleKey = (module, router, action) => `${module}|${router ?? ''}|${action ?? ''}`;

function arraysEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return a == null && b == null;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function valuesEqual(field, expected, actual) {
  if (field === 'valid_statuses' || field === 'available_fields') return arraysEqual(expected, actual);
  return expected === actual;
}

function expectedRow(entry) {
  return {
    label: entry.label,
    description: entry.description ?? null,
    sort_order: entry.sort_order ?? 0,
    valid_statuses: entry.valid_statuses ?? null,
    available_fields: entry.available_fields ?? null,
    policy_required: entry.policy_required ?? true,
  };
}

function diffMutable(entry, existing) {
  const expected = expectedRow(entry);
  const changed = [];
  for (const field of MUTABLE_FIELDS) {
    if (!valuesEqual(field, expected[field], existing[field])) changed.push(field);
  }
  return { expected, changed };
}

/**
 * Reconcile policy_catalog rows in a tenant schema against CATALOG_ENTRIES.
 *
 * @param {object} dbInstance pg-promise database connection
 * @param {object} pgp pg-promise helpers
 * @param {string} schemaName Tenant schema name
 * @param {object} [opts]
 * @param {boolean} [opts.isRootTenant=false] Whether this is the Axerra root tenant
 * @param {boolean} [opts.dryRun=false] Compute diffs without writing
 * @returns {Promise<{inserted: number, updated: number, removed: number, unchanged: number}>}
 */
export async function reconcilePolicyCatalog(dbInstance, pgp, schemaName, { isRootTenant = false, dryRun = false } = {}) {
  const s = pgp.as.name(schemaName);
  const entries = isRootTenant ? CATALOG_ENTRIES : CATALOG_ENTRIES.filter((e) => e.module !== 'tenants');
  const expectedByKey = new Map(entries.map((e) => [tupleKey(e.module, e.router, e.action), e]));

  const apply = async (executor) => {
    const existingRows = await executor.any(
      `SELECT id, module, router, action, label, description, sort_order, valid_statuses, available_fields, policy_required
         FROM ${s}.policy_catalog`,
    );
    const existingByKey = new Map(existingRows.map((r) => [tupleKey(r.module, r.router, r.action), r]));

    let inserted = 0;
    let updated = 0;
    let removed = 0;
    let unchanged = 0;

    // Inserts + updates
    for (const entry of entries) {
      const key = tupleKey(entry.module, entry.router, entry.action);
      const existing = existingByKey.get(key);
      if (!existing) {
        if (!dryRun) {
          const row = expectedRow(entry);
          await executor.none(
            `INSERT INTO ${s}.policy_catalog (module, router, action, label, description, sort_order, valid_statuses, available_fields, policy_required)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [entry.module, entry.router, entry.action, row.label, row.description, row.sort_order, row.valid_statuses, row.available_fields, row.policy_required],
          );
        }
        inserted++;
        continue;
      }

      const { expected, changed } = diffMutable(entry, existing);
      if (changed.length === 0) {
        unchanged++;
        continue;
      }
      if (!dryRun) {
        const setClauses = changed.map((f, i) => `${f} = $${i + 2}`).join(', ');
        const params = [existing.id, ...changed.map((f) => expected[f])];
        await executor.none(`UPDATE ${s}.policy_catalog SET ${setClauses} WHERE id = $1`, params);
      }
      updated++;
    }

    // Deletes (rows in DB no longer in CATALOG_ENTRIES for this tenant scope)
    for (const [key, row] of existingByKey) {
      if (expectedByKey.has(key)) continue;
      const dependents = await executor.one(
        `SELECT COUNT(*)::int AS n FROM ${s}.policies
          WHERE module = $1 AND router IS NOT DISTINCT FROM $2 AND action IS NOT DISTINCT FROM $3`,
        [row.module, row.router, row.action],
      );
      if (dependents.n > 0) {
        logger.warn(
          `[policyCatalogReconciler] Removing ${schemaName}.policy_catalog row ` +
            `(${row.module}::${row.router ?? '∅'}::${row.action ?? '∅'}) with ${dependents.n} ` +
            `orphaned ${schemaName}.policies grant(s) — clean up grants if the action is permanently retired`,
        );
      }
      if (!dryRun) {
        await executor.none(`DELETE FROM ${s}.policy_catalog WHERE id = $1`, [row.id]);
      }
      removed++;
    }

    return { inserted, updated, removed, unchanged };
  };

  const summary = dryRun ? await apply(dbInstance) : await dbInstance.tx((t) => apply(t));

  const tag = dryRun ? '[dry-run] ' : '';
  logger.info(
    `${tag}Policy catalog reconciled in ${schemaName}: ` +
      `+${summary.inserted} inserted, ~${summary.updated} updated, ` +
      `-${summary.removed} removed, =${summary.unchanged} unchanged`,
  );
  return summary;
}

export default { reconcilePolicyCatalog };
