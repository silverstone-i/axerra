/**
 * @file Employee edit sub-collection management hook
 * @module nap-client/pages/Core/employees/useEmployeeEditCollections
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
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
  BLANK_PHONE, BLANK_ADDRESS, BLANK_TAX_ID,
  EMAIL_LOGIN_FIELDS, PHONE_FIELDS, ADDRESS_FIELDS, TAX_ID_FIELDS, collectionChanged,
} from '../../../utils/formConstants.js';

// Extends shared BLANK_EMAIL with is_login — specific to app-user entities (employees/clients).
const BLANK_EMAIL = { email: '', label: 'work', is_primary: false, is_login: false };

export function useEmployeeEditCollections({
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

  const emails = useCollectionState([], { blank: BLANK_EMAIL, autoPrimary: 'is_primary', exclusive: ['is_primary', 'is_login'] });
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
    if (collectionChanged(emails.items, init.emails, EMAIL_LOGIN_FIELDS)) return true;
    if (collectionChanged(phones.items, init.phones, PHONE_FIELDS)) return true;
    if (collectionChanged(addresses.items, init.addresses, ADDRESS_FIELDS)) return true;
    if (collectionChanged(taxIds.items, init.taxIds, TAX_ID_FIELDS)) return true;
    return false;
  }, [editForm, emails.items, phones.items, addresses.items, taxIds.items]);

  const handleUpdate = async () => {
    try {
      const changes = { ...editForm };
      if (changes.is_app_user && !editRow.is_app_user) {
        const loginEm = emails.items.find((em) => em.is_login && !em._deleted);
        if (loginEm) changes.email = loginEm.email;
      }
      await updateMut.mutateAsync({ filter: { id: editRow.id }, changes });

      if (editRow.source_id) {
        const sid = editRow.source_id;
        await saveCollection(phones.items, {
          sourceId: sid, fields: PHONE_FIELDS,
          createMut: phoneMuts.create.mutateAsync, updateMut: phoneMuts.update.mutateAsync, archiveMut: phoneMuts.archive.mutateAsync,
        });
        await saveCollection(emails.items, {
          sourceId: sid, fields: EMAIL_LOGIN_FIELDS,
          createMut: emailMuts.create.mutateAsync, updateMut: emailMuts.update.mutateAsync, archiveMut: emailMuts.archive.mutateAsync,
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

      if (editForm.is_app_user !== editRow.is_app_user) {
        qc.invalidateQueries({ queryKey: ['nap-users'] });
      }
      toast('Employee updated');
      return true;
    } catch (err) {
      toast(errMsg(err), 'error');
      qc.invalidateQueries({ queryKey: ['employees'] });
      return false;
    }
  };

  const openEditSession = useCallback((row, setEditForm) => {
    const form = {
      first_name: row.first_name ?? '', last_name: row.last_name ?? '',
      code: row.code ?? '', position: row.position ?? '', department: row.department ?? '',
      is_app_user: !!row.is_app_user, roles: row.roles ?? [],
      is_primary_contact: !!row.is_primary_contact, is_billing_contact: !!row.is_billing_contact,
    };
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
