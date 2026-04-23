/**
 * @file Standalone contact edit sub-collection management hook
 * @module nap-client/pages/Core/contacts/useStandaloneContactEditCollections
 *
 * "Standalone" contacts are the miscellaneous payees on the Core > Contacts page,
 * distinct from vendor contacts which live under VendorsPage.
 *
 * Copyright (c) 2025 – present Vimber LLC. All rights reserved.
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';

import { useEmails } from '../../../hooks/useEmails.js';
import { usePhoneNumbers } from '../../../hooks/usePhoneNumbers.js';
import { useAddresses } from '../../../hooks/useAddresses.js';
import { useTaxIdentifiers } from '../../../hooks/useTaxIdentifiers.js';
import { useCollectionState } from '../../../hooks/useCollectionState.js';
import { saveCollection } from '../../../utils/saveCollection.js';
import { errMsg } from '../../../utils/format.js';
import {
  BLANK_EMAIL, BLANK_PHONE, BLANK_ADDRESS, BLANK_TAX_ID,
  EMAIL_FIELDS, PHONE_FIELDS, ADDRESS_FIELDS, TAX_ID_FIELDS, collectionChanged,
} from '../../../utils/formConstants.js';

export function useStandaloneContactEditCollections({
  editOpen,
  editRow,
  editForm,
  updateMut,
  toast,
  qc,
  emailMuts,
  phoneMuts,
  addressMuts,
  taxIdMuts,
}) {
  const [editSourceId, setEditSourceId] = useState(null);

  const { data: emailsRes } = useEmails({ source_id: editSourceId, includeDeactivated: 'false' }, { enabled: !!editSourceId });
  const { data: phonesRes } = usePhoneNumbers({ source_id: editSourceId, includeDeactivated: 'false' }, { enabled: !!editSourceId });
  const { data: addressesRes } = useAddresses({ source_id: editSourceId, includeDeactivated: 'false' }, { enabled: !!editSourceId });
  const { data: taxIdsRes } = useTaxIdentifiers({ source_id: editSourceId, includeDeactivated: 'false' }, { enabled: !!editSourceId });

  const emails = useCollectionState([], { blank: BLANK_EMAIL, autoPrimary: 'is_primary', exclusive: ['is_primary'] });
  const phones = useCollectionState([], { blank: BLANK_PHONE, autoPrimary: 'is_primary', exclusive: ['is_primary'] });
  const addresses = useCollectionState([], { blank: BLANK_ADDRESS });
  const taxIds = useCollectionState([], { blank: BLANK_TAX_ID });
  const editInitial = useRef({ form: null, emails: null, phones: null, addresses: null, taxIds: null });

  useEffect(() => {
    if (editOpen && emailsRes?.rows) {
      emails.reset(emailsRes.rows);
      editInitial.current.emails = emailsRes.rows;
    }
  }, [editOpen, emailsRes]);

  useEffect(() => {
    if (editOpen && phonesRes?.rows) {
      phones.reset(phonesRes.rows);
      editInitial.current.phones = phonesRes.rows;
    }
  }, [editOpen, phonesRes]);

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
    if (collectionChanged(emails.items, init.emails, EMAIL_FIELDS)) return true;
    if (collectionChanged(phones.items, init.phones, PHONE_FIELDS)) return true;
    if (collectionChanged(addresses.items, init.addresses, ADDRESS_FIELDS)) return true;
    if (collectionChanged(taxIds.items, init.taxIds, TAX_ID_FIELDS)) return true;
    return false;
  }, [editForm, emails.items, phones.items, addresses.items, taxIds.items]);

  const handleUpdate = async () => {
    try {
      await updateMut.mutateAsync({ filter: { id: editRow.id }, changes: editForm });

      if (editRow.source_id) {
        const sid = editRow.source_id;
        await saveCollection(emails.items, {
          sourceId: sid, fields: EMAIL_FIELDS,
          createMut: emailMuts.create.mutateAsync, updateMut: emailMuts.update.mutateAsync, archiveMut: emailMuts.archive.mutateAsync,
        });
        await saveCollection(phones.items, {
          sourceId: sid, fields: PHONE_FIELDS,
          createMut: phoneMuts.create.mutateAsync, updateMut: phoneMuts.update.mutateAsync, archiveMut: phoneMuts.archive.mutateAsync,
        });
        await saveCollection(addresses.items, {
          sourceId: sid, fields: ADDRESS_FIELDS,
          createMut: addressMuts.create.mutateAsync, updateMut: addressMuts.update.mutateAsync, archiveMut: addressMuts.archive.mutateAsync,
        });
        await saveCollection(taxIds.items, {
          sourceId: sid, fields: TAX_ID_FIELDS,
          createMut: taxIdMuts.create.mutateAsync, updateMut: taxIdMuts.update.mutateAsync, archiveMut: taxIdMuts.archive.mutateAsync,
        });
      }

      toast('Contact updated');
      return true;
    } catch (err) {
      toast(errMsg(err), 'error');
      qc.invalidateQueries({ queryKey: ['contacts'] });
      return false;
    }
  };

  const openEditSession = useCallback((row, setEditForm) => {
    const form = { name: row.name ?? '', code: row.code ?? '', is_active: row.is_active ?? true };
    setEditForm(form);
    editInitial.current.form = form;

    // Always clear sub-collection state when starting a new edit session
    // to avoid briefly showing the previous row's data while queries load.
    emails.reset([]); phones.reset([]); addresses.reset([]); taxIds.reset([]);
    editInitial.current.emails = [];
    editInitial.current.phones = [];
    editInitial.current.addresses = [];
    editInitial.current.taxIds = [];

    setEditSourceId(row.source_id || null);
  }, []);

  const closeEditSession = useCallback(() => {
    setEditSourceId(null);
  }, []);

  return {
    emails, phones, addresses, taxIds,
    hasEditChanges, handleUpdate,
    openEditSession, closeEditSession,
  };
}
