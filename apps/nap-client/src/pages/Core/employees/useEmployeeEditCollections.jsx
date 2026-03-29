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
import { BLANK_PHONE, BLANK_ADDRESS, BLANK_TAX_ID } from '../../../utils/formConstants.js';

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
    const collectionChanged = (current, initial, fields) => {
      if (!initial) return false;
      if (current.some((c) => c._deleted)) return true;
      if (current.some((c) => !c.id && !c._deleted)) return true;
      const initMap = new Map(initial.map((r) => [r.id, r]));
      return current.filter((c) => c.id && !c._deleted).some((c) => {
        const orig = initMap.get(c.id);
        return !orig || fields.some((f) => c[f] !== orig[f]);
      });
    };
    if (collectionChanged(emails.items, init.emails, ['email', 'label', 'is_primary', 'is_login'])) return true;
    if (collectionChanged(phones.items, init.phones, ['country_code', 'phone_type', 'phone_number', 'is_primary'])) return true;
    if (collectionChanged(addresses.items, init.addresses, ['label', 'address_line_1', 'address_line_2', 'address_line_3', 'city', 'state_province', 'postal_code', 'country_code'])) return true;
    if (collectionChanged(taxIds.items, init.taxIds, ['country_code', 'tax_type', 'tax_value'])) return true;
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
          sourceId: sid, fields: ['country_code', 'phone_type', 'phone_number', 'is_primary'],
          createMut: phoneMuts.create.mutateAsync, updateMut: phoneMuts.update.mutateAsync, archiveMut: phoneMuts.archive.mutateAsync,
        });
        await saveCollection(emails.items, {
          sourceId: sid, fields: ['email', 'label', 'is_primary', 'is_login'],
          createMut: emailMuts.create.mutateAsync, updateMut: emailMuts.update.mutateAsync, archiveMut: emailMuts.archive.mutateAsync,
        });
        await saveCollection(addresses.items, {
          sourceId: sid, fields: ['label', 'address_line_1', 'address_line_2', 'address_line_3', 'city', 'state_province', 'postal_code', 'country_code'],
          createMut: addressMuts.create.mutateAsync, updateMut: addressMuts.update.mutateAsync, archiveMut: addressMuts.archive.mutateAsync,
        });
        await saveCollection(taxIds.items, {
          sourceId: sid, fields: ['country_code', 'tax_type', 'tax_value'],
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

    setEditSourceId(row.source_id || null);
    if (!row.source_id) {
      emails.reset([]); phones.reset([]); addresses.reset([]); taxIds.reset([]);
      editInitial.current.emails = [];
      editInitial.current.phones = [];
      editInitial.current.addresses = [];
      editInitial.current.taxIds = [];
    }
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
