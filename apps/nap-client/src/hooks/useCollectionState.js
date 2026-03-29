/**
 * @file Sub-collection state hook — add / update / remove with soft-delete
 * @module nap-client/hooks/useCollectionState
 *
 * Replaces the per-entity `updateEmail`, `addEmail`, `removeEmail`
 * (and phone / address / taxId equivalents) boilerplate.
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
 */

import { useState, useCallback, useMemo } from 'react';

/**
 * @param {object[]} initial  Initial items (usually [])
 * @param {object}   opts
 * @param {object}   opts.blank          Blank item shape for add()
 * @param {string}   [opts.autoPrimary]  Field name auto-set on first item (e.g. 'is_primary')
 * @param {string[]} [opts.exclusive]    Fields with radio-button behaviour (e.g. ['is_primary'])
 */
export function useCollectionState(initial, { blank, autoPrimary, exclusive = [] } = {}) {
  const [items, setItems] = useState(initial);

  const visibleItems = useMemo(() => items.filter((it) => !it._deleted), [items]);
  const indexedItems = useMemo(
    () => items.reduce((acc, it, i) => { if (!it._deleted) acc.push({ item: it, index: i }); return acc; }, []),
    [items],
  );

  const update = useCallback((idx, field, value) => {
    setItems((prev) => prev.map((it, i) => {
      if (i !== idx) {
        if (exclusive.includes(field) && value) return { ...it, [field]: false };
        return it;
      }
      return { ...it, [field]: value };
    }));
  }, [exclusive]);

  const add = useCallback(() => {
    setItems((prev) => {
      const item = { ...blank };
      if (autoPrimary && !prev.filter((it) => !it._deleted).length) {
        item[autoPrimary] = true;
      }
      return [...prev, item];
    });
  }, [blank, autoPrimary]);

  const remove = useCallback((idx) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, _deleted: true } : it)));
  }, []);

  const reset = useCallback((next) => setItems(next ?? initial), [initial]);

  return { items, visibleItems, indexedItems, setItems, update, add, remove, reset };
}
