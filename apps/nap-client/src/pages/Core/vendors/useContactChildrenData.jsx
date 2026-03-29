/**
 * @file Contact children data hook — fetches emails/phones per contact and builds lookup maps
 * @module nap-client/pages/Core/vendors/useContactChildrenData
 *
 * Encapsulates the contact email/phone fetching, lookup map construction,
 * and contactColumns definition that were previously inline in VendorsPage.
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import StatusBadge from '../../../components/shared/StatusBadge.jsx';
import { fmtPhone } from '../../../utils/format.js';
import { emailApi } from '../../../services/emailApi.js';
import { phoneNumberApi } from '../../../services/phoneNumberApi.js';

/**
 * Fetch emails + phones for an array of contacts and build primary-display lookup maps.
 * @returns {{ emails: object, phones: object, emailMap: Map, phoneMap: Map }}
 */
async function fetchChildrenForContacts(contacts) {
  const emails = {};
  const phones = {};
  const emailMap = new Map();
  const phoneMap = new Map();
  await Promise.all(contacts.map(async (c) => {
    if (!c.source_id) return;

    const [emailRes, phoneRes] = await Promise.all([
      emailApi.list({ source_id: c.source_id, includeDeactivated: 'false' }),
      phoneNumberApi.list({ source_id: c.source_id, includeDeactivated: 'false' }),
    ]);

    const emailRows = emailRes?.rows ?? [];
    const phoneRows = phoneRes?.rows ?? [];
    emails[c.id] = emailRows;
    phones[c.id] = phoneRows;

    const primaryEmail = emailRows.find((e) => e.is_primary) || emailRows[0];
    if (primaryEmail) emailMap.set(c.id, primaryEmail.email);

    const primaryPhone = phoneRows.find((p) => p.is_primary) || phoneRows[0];
    if (primaryPhone) phoneMap.set(c.id, fmtPhone(primaryPhone));
  }));
  return { emails, phones, emailMap, phoneMap };
}

export function useContactChildrenData({ editOpen, viewOpen, editContacts, viewContacts, contactsRes, setEditContacts }) {
  /* ── Edit-mode maps ────────────────────────────────────────── */
  const [contactEmails, setContactEmails] = useState({});
  const [contactPhones, setContactPhones] = useState({});
  const [contactEmailMap, setContactEmailMap] = useState(new Map());
  const [contactPhoneMap, setContactPhoneMap] = useState(new Map());

  /* ── View-mode maps ────────────────────────────────────────── */
  const [viewContactEmails, setViewContactEmails] = useState({});
  const [viewContactPhones, setViewContactPhones] = useState({});
  const [viewContactEmailMap, setViewContactEmailMap] = useState(new Map());
  const [viewContactPhoneMap, setViewContactPhoneMap] = useState(new Map());

  /* ── Fetch edit contact children ───────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    if (editOpen && contactsRes?.rows) {
      const contacts = contactsRes.rows;
      setEditContacts(contacts);
      fetchChildrenForContacts(contacts).then(({ emails, phones, emailMap, phoneMap }) => {
        if (cancelled) return;
        setContactEmails(emails);
        setContactPhones(phones);
        setContactEmailMap(emailMap);
        setContactPhoneMap(phoneMap);
      });
    }
    return () => { cancelled = true; };
  }, [editOpen, contactsRes]);

  /* ── Fetch view contact children ───────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    if (viewOpen && viewContacts.length) {
      fetchChildrenForContacts(viewContacts).then(({ emails, phones, emailMap, phoneMap }) => {
        if (cancelled) return;
        setViewContactEmails(emails);
        setViewContactPhones(phones);
        setViewContactEmailMap(emailMap);
        setViewContactPhoneMap(phoneMap);
      });
    }
    return () => { cancelled = true; };
  }, [viewOpen, viewContacts]);

  /* ── Refresh helper (after contact create/edit) ────────────── */
  const refreshContactChildren = useCallback(async (overrideContacts) => {
    if (!editOpen) return; // guard against late responses after dialog close
    const contacts = (overrideContacts || editContacts).filter((c) => !c._deleted);
    const { emails, phones, emailMap, phoneMap } = await fetchChildrenForContacts(contacts);
    setContactEmails(emails);
    setContactPhones(phones);
    setContactEmailMap(emailMap);
    setContactPhoneMap(phoneMap);
  }, [editOpen, editContacts]);

  /* ── Contact DataTable columns ─────────────────────────────── */
  const contactColumns = useMemo(() => [
    { field: 'first_name', headerName: 'First Name', flex: 1, minWidth: 120 },
    { field: 'last_name', headerName: 'Last Name', flex: 1, minWidth: 120 },
    {
      field: '_phone', headerName: 'Phone', flex: 1, minWidth: 130,
      valueGetter: (params) => contactPhoneMap.get(params.row.id) || viewContactPhoneMap.get(params.row.id) || '\u2014',
    },
    {
      field: '_email', headerName: 'Email', flex: 1, minWidth: 180,
      valueGetter: (params) => contactEmailMap.get(params.row.id) || viewContactEmailMap.get(params.row.id) || '\u2014',
    },
    {
      field: '_status', headerName: 'Status', width: 100,
      renderCell: ({ row }) => <StatusBadge status={row.deactivated_at ? 'archived' : 'active'} />,
    },
  ], [contactPhoneMap, contactEmailMap, viewContactPhoneMap, viewContactEmailMap]);

  /* ── Reset helpers for close handlers ──────────────────────── */
  const resetEditMaps = useCallback(() => {
    setContactEmails({});
    setContactPhones({});
    setContactEmailMap(new Map());
    setContactPhoneMap(new Map());
  }, []);

  const resetViewMaps = useCallback(() => {
    setViewContactEmails({});
    setViewContactPhones({});
    setViewContactEmailMap(new Map());
    setViewContactPhoneMap(new Map());
  }, []);

  return {
    contactEmails,
    contactPhones,
    contactEmailMap,
    contactPhoneMap,
    viewContactEmails,
    viewContactPhones,
    contactColumns,
    refreshContactChildren,
    resetEditMaps,
    resetViewMaps,
  };
}
