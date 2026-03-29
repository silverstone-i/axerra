/**
 * @file Vendor edit sub-collection management hook
 * @module nap-client/pages/Core/vendors/useVendorEditCollections
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

import PatternTextField from '../../../components/shared/PatternTextField.jsx';
import { useEmails } from '../../../hooks/useEmails.js';
import { usePhoneNumbers } from '../../../hooks/usePhoneNumbers.js';
import { useAddresses } from '../../../hooks/useAddresses.js';
import { useTaxIdentifiers } from '../../../hooks/useTaxIdentifiers.js';
import { useVendorContacts } from '../../../hooks/useVendorContacts.js';
import { useCollectionState } from '../../../hooks/useCollectionState.js';
import { saveCollection } from '../../../utils/saveCollection.js';
import { cap, errMsg } from '../../../utils/format.js';
import { BLANK_EMAIL, BLANK_PHONE, BLANK_ADDRESS, BLANK_TAX_ID, PHONE_TYPES, EMAIL_LABELS } from '../../../utils/formConstants.js';
import { COUNTRIES } from '@nap/shared';

/* ── Module-level render helpers (no hook state needed) ────────── */

const renderEmailRow = (em, emailIdx, onUpdate, onRemove) => (
  <Box key={em.id || emailIdx} sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
    <TextField
      label="Email"
      type="email"
      value={em.email}
      onChange={(e) => onUpdate(emailIdx, 'email', e.target.value)}
      size="small"
      sx={{ flex: 1, minWidth: 200 }}
    />
    <TextField
      select
      label="Label"
      value={em.label}
      onChange={(e) => onUpdate(emailIdx, 'label', e.target.value)}
      size="small"
      sx={{ minWidth: 120 }}
    >
      {EMAIL_LABELS.map((l) => (
        <MenuItem key={l} value={l}>{cap(l)}</MenuItem>
      ))}
    </TextField>
    <FormControlLabel
      control={<Checkbox checked={em.is_primary} onChange={(e) => onUpdate(emailIdx, 'is_primary', e.target.checked)} size="small" />}
      label="Primary"
      sx={{ mr: 0 }}
    />
    <IconButton size="small" onClick={() => onRemove(emailIdx)} color="error">
      <DeleteOutlineIcon fontSize="small" />
    </IconButton>
  </Box>
);

const renderPhoneRow = (phone, phoneIdx, onUpdate, onRemove) => {
  const countryCode = phone.country_code?.trim() || 'US';
  const country = COUNTRIES.find((c) => c.code === countryCode);
  return (
    <Box key={phone.id || phoneIdx} sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
      <TextField
        select
        label="Type"
        value={phone.phone_type}
        onChange={(e) => onUpdate(phoneIdx, 'phone_type', e.target.value)}
        sx={{ minWidth: 120 }}
        size="small"
      >
        {PHONE_TYPES.map((t) => (
          <MenuItem key={t} value={t}>{cap(t)}</MenuItem>
        ))}
      </TextField>
      <TextField
        select
        label="Country"
        value={countryCode}
        onChange={(e) => onUpdate(phoneIdx, 'country_code', e.target.value)}
        SelectProps={{ renderValue: (val) => COUNTRIES.find((c) => c.code === val)?.dial_code || val }}
        sx={{ minWidth: 80 }}
        size="small"
      >
        {COUNTRIES.map((c) => (
          <MenuItem key={c.code} value={c.code}>{c.dial_code} {c.code} - {c.name}</MenuItem>
        ))}
      </TextField>
      <PatternTextField
        label="Number"
        value={phone.phone_number}
        onChange={(raw) => onUpdate(phoneIdx, 'phone_number', raw)}
        pattern={country?.placeholder}
        size="small"
        sx={{ flex: 1, minWidth: 160 }}
      />
      <FormControlLabel
        control={<Checkbox checked={phone.is_primary} onChange={(e) => onUpdate(phoneIdx, 'is_primary', e.target.checked)} size="small" />}
        label="Primary"
        sx={{ mr: 0 }}
      />
      <IconButton size="small" onClick={() => onRemove(phoneIdx)} color="error">
        <DeleteOutlineIcon fontSize="small" />
      </IconButton>
    </Box>
  );
};

/* ── Hook ──────────────────────────────────────────────────────── */

export function useVendorEditCollections({
  editOpen,
  editRow,
  editForm,
  updateMut,
  toast,
  onEditClose,
  emailMuts,
  phoneMuts,
  addressMuts,
  taxIdMuts,
}) {
  /* ── Query-trigger state ─────────────────────────────────────── */
  const [editSourceId, setEditSourceId] = useState(null);
  const [editVendorId, setEditVendorId] = useState(null);

  /* ── React Query: edit-mode sub-collection queries ───────────── */
  const { data: emailsRes } = useEmails({ source_id: editSourceId, includeDeactivated: 'false' }, { enabled: !!editSourceId });
  const { data: phonesRes } = usePhoneNumbers({ source_id: editSourceId, includeDeactivated: 'false' }, { enabled: !!editSourceId });
  const { data: addressesRes } = useAddresses({ source_id: editSourceId, includeDeactivated: 'false' }, { enabled: !!editSourceId });
  const { data: taxIdsRes } = useTaxIdentifiers({ source_id: editSourceId, includeDeactivated: 'false' }, { enabled: !!editSourceId });

  const { data: contactsRes } = useVendorContacts(
    { vendor_id: editVendorId, includeDeactivated: 'true' },
    { enabled: !!editVendorId },
  );

  /* ── Collection state ────────────────────────────────────────── */
  const emails = useCollectionState([], { blank: BLANK_EMAIL, autoPrimary: 'is_primary', exclusive: ['is_primary'] });
  const phones = useCollectionState([], { blank: BLANK_PHONE, autoPrimary: 'is_primary', exclusive: ['is_primary'] });
  const addresses = useCollectionState([], { blank: BLANK_ADDRESS });
  const taxIds = useCollectionState([], { blank: BLANK_TAX_ID });
  const [editContacts, setEditContacts] = useState([]);
  const editInitial = useRef({ form: null, emails: null, phones: null, addresses: null, taxIds: null });

  /* ── Sync query data into collection state ───────────────────── */
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

  /* ── Dirty check ─────────────────────────────────────────────── */
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
    if (collectionChanged(emails.items, init.emails, ['email', 'label', 'is_primary'])) return true;
    if (collectionChanged(phones.items, init.phones, ['country_code', 'phone_type', 'phone_number', 'is_primary'])) return true;
    if (collectionChanged(addresses.items, init.addresses, ['label', 'address_line_1', 'address_line_2', 'address_line_3', 'city', 'state_province', 'postal_code', 'country_code'])) return true;
    if (collectionChanged(taxIds.items, init.taxIds, ['country_code', 'tax_type', 'tax_value'])) return true;
    return false;
  }, [editForm, emails.items, phones.items, addresses.items, taxIds.items]);

  /* ── Save handler ────────────────────────────────────────────── */
  const handleUpdate = async () => {
    try {
      const changes = { ...editForm, payment_term_id: editForm.payment_term_id || null };
      await updateMut.mutateAsync({ filter: { id: editRow.id }, changes });

      if (editRow.source_id) {
        const sid = editRow.source_id;
        await saveCollection(emails.items, {
          sourceId: sid, fields: ['email', 'label', 'is_primary'],
          createMut: emailMuts.create.mutateAsync, updateMut: emailMuts.update.mutateAsync, archiveMut: emailMuts.archive.mutateAsync,
        });
        await saveCollection(phones.items, {
          sourceId: sid, fields: ['country_code', 'phone_type', 'phone_number', 'is_primary'],
          createMut: phoneMuts.create.mutateAsync, updateMut: phoneMuts.update.mutateAsync, archiveMut: phoneMuts.archive.mutateAsync,
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

      toast('Vendor updated');
      onEditClose();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };

  return {
    emails,
    phones,
    addresses,
    taxIds,
    editContacts,
    setEditContacts,
    editSourceId,
    setEditSourceId,
    editVendorId,
    setEditVendorId,
    editInitial,
    hasEditChanges,
    handleUpdate,
    contactsRes,
    renderEmailRow,
    renderPhoneRow,
  };
}
