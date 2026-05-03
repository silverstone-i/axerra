/**
 * @file Vendor contact sub-dialog orchestration hook
 * @module client/pages/Core/vendors/useVendorContactDialogs
 *
 * Encapsulates all contact dialog state, forms, CRUD handlers,
 * password popover, archive/restore, selection, and filtering.
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import { useState, useMemo, useCallback } from 'react';
import { useFormState } from '../../../hooks/useFormState.js';
import { useListSelection } from '../../../hooks/useListSelection.js';
import { useArchiveRestore } from '../../../hooks/useArchiveRestore.js';
import { errMsg } from '../../../utils/format.js';
import { saveCollection } from '../../../utils/saveCollection.js';
import { EMAIL_LOGIN_FIELDS, PHONE_FIELDS } from '../../../utils/formConstants.js';

const BLANK_CONTACT_FORM = {
  first_name: '', last_name: '', position: '', department: '',
  is_app_user: false, roles: [], password: '',
};

/**
 * @param {object} opts
 * @param {object}   opts.editRow               Vendor being edited
 * @param {Array}    opts.editContacts           Contact array from useVendorEditCollections
 * @param {Function} opts.setEditContacts        Setter
 * @param {object}   opts.contactEmails          { contactId: Email[] }
 * @param {object}   opts.contactPhones          { contactId: Phone[] }
 * @param {Array}    opts.viewContacts           Contacts in view mode
 * @param {Function} opts.refreshContactChildren From useContactChildrenData
 * @param {Function} opts.toast                  Toast callback
 * @param {object}   opts.qc                     QueryClient
 * @param {object}   opts.createContactMut
 * @param {object}   opts.updateContactMut
 * @param {object}   opts.archiveContactMut
 * @param {object}   opts.restoreContactMut
 * @param {object}   opts.createEmailMut
 * @param {object}   opts.updateEmailMut
 * @param {object}   opts.archiveEmailMut
 * @param {object}   opts.createPhoneMut
 * @param {object}   opts.updatePhoneMut
 * @param {object}   opts.archivePhoneMut
 * @param {object}   [opts.swapLoginEmailMut] Mutation for the identity-swap
 *                   endpoint — required when editing app-user contacts so
 *                   tenant admins can swap who has access to this tenant
 *                   instead of mutating the global portal_user identity.
 */
export function useVendorContactDialogs({
  editRow,
  editContacts,
  setEditContacts,
  contactEmails,
  contactPhones,
  viewContacts,
  refreshContactChildren,
  toast,
  qc,
  createContactMut,
  updateContactMut,
  archiveContactMut,
  restoreContactMut,
  createEmailMut,
  updateEmailMut,
  archiveEmailMut,
  createPhoneMut,
  updatePhoneMut,
  archivePhoneMut,
  swapLoginEmailMut,
}) {
  /* ── Tab filter ──────────────────────────────────────────────── */
  const [contactViewFilter, setContactViewFilter] = useState('active');

  /* ── Contact sub-dialog state ────────────────────────────────── */
  const [contactViewOpen, setContactViewOpen] = useState(false);
  const [contactViewRow, setContactViewRow] = useState(null);
  const [contactCreateOpen, setContactCreateOpen] = useState(false);
  const [contactEditOpen, setContactEditOpen] = useState(false);
  const [contactEditRow, setContactEditRow] = useState(null);

  /* ── Contact create form ─────────────────────────────────────── */
  const {
    form: contactCreateForm, setForm: setContactCreateForm,
    field: onContactCreateField, reset: resetContactCreateForm,
  } = useFormState(BLANK_CONTACT_FORM);
  const [contactCreateEmails, setContactCreateEmails] = useState([]);
  const [contactCreatePhones, setContactCreatePhones] = useState([]);

  /* ── Contact edit form ───────────────────────────────────────── */
  const {
    form: contactEditForm, setForm: setContactEditForm,
    field: onContactEditField,
  } = useFormState(BLANK_CONTACT_FORM);
  const [contactEditEmails, setContactEditEmails] = useState([]);
  const [contactEditPhones, setContactEditPhones] = useState([]);

  /* ── Contact password popover ────────────────────────────────── */
  const [contactPwAnchor, setContactPwAnchor] = useState(null);
  const [contactPwTarget, setContactPwTarget] = useState(null); // 'create' | 'edit'

  /* ── Contact view filter + selection ─────────────────────────── */
  const filteredContacts = useMemo(() => {
    const live = editContacts.filter((c) => !c._deleted);
    if (contactViewFilter === 'active') return live.filter((c) => !c.deactivated_at);
    if (contactViewFilter === 'archived') return live.filter((c) => !!c.deactivated_at);
    return live;
  }, [editContacts, contactViewFilter]);

  const contactSelection = useListSelection(filteredContacts);
  const viewContactSelection = useListSelection(viewContacts || []);

  /* ── Archive / Restore ───────────────────────────────────────── */
  const {
    setArchiveOpen: setContactArchiveOpen, setRestoreOpen: setContactRestoreOpen,
    archiveConfirmProps: contactArchiveProps, restoreConfirmProps: contactRestoreProps,
  } = useArchiveRestore({
    selectedRows: contactSelection.selectedRows,
    archiveMut: archiveContactMut,
    restoreMut: restoreContactMut,
    entityName: 'contact',
    setSelectionModel: () => contactSelection.clearSelection(),
    toast,
    errMsg,
    getLabel: (r) => `${r.first_name} ${r.last_name}`,
  });

  /* ── Password popover handlers ───────────────────────────────── */
  const handleContactAppUserToggle = useCallback((target) => (e) => {
    if (e.target.checked) {
      setContactPwTarget(target);
      setContactPwAnchor(e.currentTarget);
    } else {
      const setForm = target === 'create' ? setContactCreateForm : setContactEditForm;
      setForm((p) => ({ ...p, is_app_user: false, password: '' }));
    }
  }, [setContactCreateForm, setContactEditForm]);

  const handleContactPwConfirm = useCallback((password) => {
    const setForm = contactPwTarget === 'create' ? setContactCreateForm : setContactEditForm;
    setForm((p) => ({ ...p, is_app_user: true, password }));
    setContactPwAnchor(null);
    setContactPwTarget(null);
  }, [contactPwTarget, setContactCreateForm, setContactEditForm]);

  const handleContactPwCancel = useCallback(() => {
    setContactPwAnchor(null);
    setContactPwTarget(null);
  }, []);

  /* ── Dialog openers ──────────────────────────────────────────── */
  const handleViewContact = useCallback((row) => {
    setContactViewRow(row);
    setContactViewOpen(true);
  }, []);

  const handleOpenContactCreate = useCallback(() => {
    resetContactCreateForm();
    setContactCreateEmails([]);
    setContactCreatePhones([]);
    setContactCreateOpen(true);
  }, [resetContactCreateForm]);

  // Tracks the original login email so handleContactEdit can detect
  // identity-swap intent (tenant admin changing the value of the
  // is_login=true email row on an existing app-user contact).
  const [originalLoginEmail, setOriginalLoginEmail] = useState(null);

  const openContactEdit = useCallback((row) => {
    setContactEditRow(row);
    setContactEditForm({
      first_name: row.first_name, last_name: row.last_name,
      position: row.position || '', department: row.department || '',
      is_app_user: row.is_app_user || false, roles: row.roles || [],
      password: '',
    });
    const emails = contactEmails[row.id] || [];
    setContactEditEmails([...emails]);
    setContactEditPhones([...(contactPhones[row.id] || [])]);
    const loginEm = emails.find((em) => em.is_login);
    setOriginalLoginEmail(loginEm ? loginEm.email : null);
    setContactEditOpen(true);
  }, [contactEmails, contactPhones, setContactEditForm]);

  /* ── Identity-swap pending state (Task 7) ─────────────────────── */
  const [swapPending, setSwapPending] = useState(null); // { newEmail, originalEmail } | null
  const closeSwapConfirm = useCallback(() => setSwapPending(null), []);

  /* ── Contact Create handler ──────────────────────────────────── */
  const handleContactCreate = useCallback(async () => {
    try {
      const primaryEmail = contactCreateEmails.find((e) => e.is_primary)?.email || contactCreateEmails[0]?.email || null;
      const contactRecord = await createContactMut.mutateAsync({
        vendor_id: editRow.id,
        first_name: contactCreateForm.first_name,
        last_name: contactCreateForm.last_name,
        position: contactCreateForm.position,
        department: contactCreateForm.department,
        is_app_user: contactCreateForm.is_app_user,
        roles: contactCreateForm.roles,
        email: primaryEmail,
        password: contactCreateForm.password,
      });

      // Create additional emails (beyond the one passed to createContact)
      for (const em of contactCreateEmails) {
        if (em.email && em.email !== primaryEmail) {
          await createEmailMut.mutateAsync({
            source_id: contactRecord.source_id, email: em.email, label: em.label,
            is_primary: em.is_primary, is_login: false,
          });
        }
      }
      // Create phones
      for (const ph of contactCreatePhones) {
        if (ph.phone_number) {
          await createPhoneMut.mutateAsync({
            source_id: contactRecord.source_id, country_code: ph.country_code,
            phone_type: ph.phone_type, phone_number: ph.phone_number, is_primary: ph.is_primary,
          });
        }
      }

      // Add the new contact to local state and refresh children with it included
      const updatedContacts = [...editContacts, contactRecord];
      setEditContacts(updatedContacts);
      await refreshContactChildren(updatedContacts);
      setContactCreateOpen(false);
      resetContactCreateForm();
      setContactCreateEmails([]);
      setContactCreatePhones([]);
      toast('Contact created');
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }, [contactCreateForm, contactCreateEmails, contactCreatePhones, editRow, editContacts, createContactMut, createEmailMut, createPhoneMut, toast, refreshContactChildren, resetContactCreateForm, setEditContacts]);

  /* ── Contact Edit handler ────────────────────────────────────── */
  // Pulled out so the swap-confirmation flow can re-enter it after the
  // user accepts the identity-swap warning.
  const performContactEdit = useCallback(async () => {
    const changes = {
      first_name: contactEditForm.first_name, last_name: contactEditForm.last_name,
      position: contactEditForm.position, department: contactEditForm.department,
      is_app_user: contactEditForm.is_app_user, roles: contactEditForm.roles,
      ...(contactEditForm.password && { password: contactEditForm.password }),
    };
    if (changes.is_app_user && !contactEditRow?.is_app_user) {
      const loginEm = contactEditEmails.find((em) => em.is_login && !em._deleted)
        || contactEditEmails.find((em) => em.is_primary && !em._deleted)
        || contactEditEmails.find((em) => !em._deleted);
      if (loginEm) changes.email = loginEm.email;
    }
    await updateContactMut.mutateAsync({ filter: { id: contactEditRow.id }, changes });

    const sid = contactEditRow.source_id;
    await saveCollection(contactEditEmails, {
      sourceId: sid, fields: EMAIL_LOGIN_FIELDS,
      createMut: createEmailMut.mutateAsync, updateMut: updateEmailMut.mutateAsync, archiveMut: archiveEmailMut.mutateAsync,
    });
    await saveCollection(contactEditPhones, {
      sourceId: sid, fields: PHONE_FIELDS,
      createMut: createPhoneMut.mutateAsync, updateMut: updatePhoneMut.mutateAsync, archiveMut: archivePhoneMut.mutateAsync,
    });

    await refreshContactChildren();
    if (contactEditForm.is_app_user !== contactEditRow?.is_app_user) {
      qc.invalidateQueries({ queryKey: ['portal-users'] });
    }
    setContactEditOpen(false);
    setContactEditRow(null);
    toast('Contact updated');
  }, [contactEditRow, contactEditForm, contactEditEmails, contactEditPhones, updateContactMut, createEmailMut, updateEmailMut, archiveEmailMut, createPhoneMut, updatePhoneMut, archivePhoneMut, qc, toast, refreshContactChildren]);

  const handleContactEdit = useCallback(async () => {
    try {
      // Identity-swap detection (Task 7): if an app-user contact's
      // is_login email value changed, route through the swap endpoint
      // before any other email/phone writes. Without this, updateEmail
      // on the login row returns 400 from the server-side guard.
      const wasAppUser = !!contactEditRow?.is_app_user;
      const stillAppUser = !!contactEditForm.is_app_user;
      const newLoginEm = contactEditEmails.find((em) => em.is_login && !em._deleted);
      const valueChanged =
        newLoginEm
        && originalLoginEmail
        && newLoginEm.email
        && newLoginEm.email.trim().toLowerCase() !== originalLoginEmail.trim().toLowerCase();

      if (wasAppUser && stillAppUser && valueChanged && swapLoginEmailMut) {
        // Defer the rest of the save — open the confirmation. Capture
        // the contact id and the password the user typed at this moment
        // so confirmSwap doesn't depend on contactEditRow / contactEditForm
        // staying mounted while the ConfirmDialog is open.
        setSwapPending({
          contactId: contactEditRow.id,
          newEmail: newLoginEm.email,
          originalEmail: originalLoginEmail,
          password: contactEditForm.password || undefined,
        });
        return;
      }

      await performContactEdit();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }, [contactEditRow, contactEditForm, contactEditEmails, originalLoginEmail, swapLoginEmailMut, performContactEdit, toast]);

  const confirmSwap = useCallback(async () => {
    if (!swapPending || !swapLoginEmailMut) return;
    if (!swapPending.contactId) {
      setSwapPending(null);
      return;
    }
    try {
      await swapLoginEmailMut.mutateAsync({
        id: swapPending.contactId,
        new_email: swapPending.newEmail,
        password: swapPending.password,
      });
      setSwapPending(null);
      // After the swap, the tenant emails table already reflects the
      // new email, so the saveCollection re-send on the login-email
      // row is a no-op (server's guard is keyed on email value change).
      // performContactEdit only runs if the edit dialog is still open —
      // if the user closed it mid-swap, skip the rest of the save.
      if (contactEditRow?.id === swapPending.contactId) {
        await performContactEdit();
      }
    } catch (err) {
      setSwapPending(null);
      toast(errMsg(err), 'error');
    }
  }, [swapPending, swapLoginEmailMut, contactEditRow, performContactEdit, toast]);

  return {
    // Contact view
    contactViewOpen, contactViewRow, handleViewContact,
    closeContactView: useCallback(() => { setContactViewOpen(false); setContactViewRow(null); }, []),
    // Contact create
    contactCreateOpen, contactCreateForm, setContactCreateForm, onContactCreateField,
    contactCreateEmails, setContactCreateEmails,
    contactCreatePhones, setContactCreatePhones,
    handleOpenContactCreate, handleContactCreate,
    closeContactCreate: useCallback(() => setContactCreateOpen(false), []),
    createContactLoading: createContactMut.isPending,
    // Contact edit
    contactEditOpen, contactEditForm, setContactEditForm, onContactEditField,
    contactEditEmails, setContactEditEmails,
    contactEditPhones, setContactEditPhones,
    contactEditRow, openContactEdit, handleContactEdit,
    closeContactEdit: useCallback(() => {
      setContactEditOpen(false);
      setContactEditRow(null);
      setOriginalLoginEmail(null);
      setSwapPending(null);
    }, []),
    updateContactLoading: updateContactMut.isPending,
    // Identity-swap on login-email change (Task 7)
    swapPending, confirmSwap, closeSwapConfirm,
    swapLoading: !!swapLoginEmailMut?.isPending,
    // Password popover
    contactPwAnchor, handleContactAppUserToggle, handleContactPwConfirm, handleContactPwCancel,
    // Contact list
    contactViewFilter, setContactViewFilter, filteredContacts,
    contactSelection, viewContactSelection,
    setContactArchiveOpen, setContactRestoreOpen,
    contactArchiveProps, contactRestoreProps,
  };
}
