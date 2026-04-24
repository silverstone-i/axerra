/**
 * @file Persist sub-collection changes — create / update / archive loop
 * @module vimber-client/utils/saveCollection
 *
 * Replaces the per-entity for-loops that diff sub-collection items
 * against the API (the `_deleted` + `id` presence pattern).
 *
 * Copyright (c) 2025 – present Vimber LLC. All rights reserved.
 */

/**
 * Persist an array of sub-collection items that may have been added,
 * modified, or soft-deleted (`_deleted: true`).
 *
 * @param {object[]} items  The full items array (including _deleted)
 * @param {object}   opts
 * @param {string}   opts.sourceId    Parent source_id for new items
 * @param {string[]} opts.fields      Field names to include in create/update payloads
 * @param {Function} opts.createMut   mutateAsync for creating
 * @param {Function} opts.updateMut   mutateAsync for updating
 * @param {Function} opts.archiveMut  mutateAsync for archiving
 */
export async function saveCollection(items, { sourceId, fields, createMut, updateMut, archiveMut }) {
  for (const item of items) {
    if (item._deleted && item.id) {
      await archiveMut({ id: item.id });
    } else if (!item.id && !item._deleted) {
      const payload = { source_id: sourceId };
      for (const f of fields) payload[f] = item[f];
      await createMut(payload);
    } else if (item.id && !item._deleted) {
      const changes = {};
      for (const f of fields) changes[f] = item[f];
      await updateMut({ filter: { id: item.id }, changes });
    }
  }
}
