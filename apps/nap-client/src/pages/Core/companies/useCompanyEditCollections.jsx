/**
 * @file Company edit sub-collection management hook (addresses + tax IDs only)
 * @module nap-client/pages/Core/companies/useCompanyEditCollections
 *
 * Copyright (c) 2025 – present Vimber LLC. All rights reserved.
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';

import { useAddresses } from '../../../hooks/useAddresses.js';
import { useTaxIdentifiers } from '../../../hooks/useTaxIdentifiers.js';
import { useCollectionState } from '../../../hooks/useCollectionState.js';
import { saveCollection } from '../../../utils/saveCollection.js';
import { errMsg } from '../../../utils/format.js';
import { BLANK_ADDRESS, BLANK_TAX_ID, ADDRESS_FIELDS, TAX_ID_FIELDS, collectionChanged } from '../../../utils/formConstants.js';

export function useCompanyEditCollections({
  editOpen,
  editRow,
  editForm,
  updateMut,
  toast,
  qc,
  addressMuts,
  taxIdMuts,
}) {
  const [editSourceId, setEditSourceId] = useState(null);

  const { data: addressesRes } = useAddresses({ source_id: editSourceId, includeDeactivated: 'false' }, { enabled: !!editSourceId });
  const { data: taxIdsRes } = useTaxIdentifiers({ source_id: editSourceId, includeDeactivated: 'false' }, { enabled: !!editSourceId });

  const addresses = useCollectionState([], { blank: BLANK_ADDRESS });
  const taxIds = useCollectionState([], { blank: BLANK_TAX_ID });
  const editInitial = useRef({ form: null, addresses: null, taxIds: null });

  useEffect(() => {
    if (editOpen && addressesRes?.rows) {
      addresses.reset(addressesRes.rows);
      editInitial.current.addresses = addressesRes.rows;
    }
  }, [editOpen, addressesRes]);

  useEffect(() => {
    if (editOpen && taxIdsRes?.rows) {
      taxIds.reset(taxIdsRes.rows);
      editInitial.current.taxIds = taxIdsRes.rows;
    }
  }, [editOpen, taxIdsRes]);

  const hasEditChanges = useMemo(() => {
    const init = editInitial.current;
    if (!init.form) return false;
    if (JSON.stringify(editForm) !== JSON.stringify(init.form)) return true;
    if (collectionChanged(addresses.items, init.addresses, ADDRESS_FIELDS)) return true;
    if (collectionChanged(taxIds.items, init.taxIds, TAX_ID_FIELDS)) return true;
    return false;
  }, [editForm, addresses.items, taxIds.items]);

  const handleUpdate = async () => {
    try {
      await updateMut.mutateAsync({ filter: { id: editRow.id }, changes: editForm });

      if (editRow.source_id) {
        await saveCollection(addresses.items, {
          sourceId: editRow.source_id, fields: ADDRESS_FIELDS,
          createMut: addressMuts.create.mutateAsync, updateMut: addressMuts.update.mutateAsync, archiveMut: addressMuts.archive.mutateAsync,
        });
        await saveCollection(taxIds.items, {
          sourceId: editRow.source_id, fields: TAX_ID_FIELDS,
          createMut: taxIdMuts.create.mutateAsync, updateMut: taxIdMuts.update.mutateAsync, archiveMut: taxIdMuts.archive.mutateAsync,
        });
      }

      toast('Company updated');
      return true;
    } catch (err) {
      toast(errMsg(err), 'error');
      qc.invalidateQueries({ queryKey: ['companies'] });
      return false;
    }
  };

  const openEditSession = useCallback((row, setEditForm) => {
    const form = { name: row.name ?? '', code: row.code ?? '', is_active: row.is_active ?? true };
    setEditForm(form);
    editInitial.current.form = form;

    // Always clear sub-collection state when starting a new edit session
    // to avoid briefly showing the previous row's data while queries load.
    addresses.reset([]); taxIds.reset([]);
    editInitial.current.addresses = [];
    editInitial.current.taxIds = [];

    setEditSourceId(row.source_id || null);
  }, []);

  const closeEditSession = useCallback(() => {
    setEditSourceId(null);
  }, []);

  return {
    addresses, taxIds,
    hasEditChanges, handleUpdate,
    openEditSession, closeEditSession,
  };
}
