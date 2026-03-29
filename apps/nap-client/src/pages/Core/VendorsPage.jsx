/**
 * @file Vendors CRUD page — coordinator component that owns all state, queries, and handlers
 * @module nap-client/pages/Core/VendorsPage
 *
 * Reference implementation for the standardised list-view selection system:
 *   useListSelection + DataTable + RowActionsMenu
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import LockResetIcon from '@mui/icons-material/LockReset';

import StatusBadge from '../../components/shared/StatusBadge.jsx';
import ToastSnackbar from '../../components/shared/ToastSnackbar.jsx';
import ConfirmDialog from '../../components/shared/ConfirmDialog.jsx';
import ResetPasswordDialog from '../../components/shared/ResetPasswordDialog.jsx';
import SetPasswordPopover from '../../components/shared/SetPasswordPopover.jsx';
import DataTable from '../../components/shared/DataTable.jsx';
import ImportDialog from '../../components/shared/ImportDialog.jsx';
import PatternTextField from '../../components/shared/PatternTextField.jsx';
import { useModuleToolbarRegistration } from '../../contexts/ModuleActionsContext.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import {
  useVendors, useCreateVendor, useUpdateVendor, useArchiveVendor, useRestoreVendor,
} from '../../hooks/useVendors.js';
import {
  useEmails, useCreateEmail, useUpdateEmail, useArchiveEmail,
} from '../../hooks/useEmails.js';
import {
  usePhoneNumbers, useCreatePhoneNumber, useUpdatePhoneNumber, useArchivePhoneNumber,
} from '../../hooks/usePhoneNumbers.js';
import {
  useAddresses, useCreateAddress, useUpdateAddress, useArchiveAddress,
} from '../../hooks/useAddresses.js';
import {
  useTaxIdentifiers, useCreateTaxIdentifier, useUpdateTaxIdentifier, useArchiveTaxIdentifier,
} from '../../hooks/useTaxIdentifiers.js';
import {
  useVendorContacts, useCreateVendorContact, useUpdateVendorContact, useArchiveVendorContact, useRestoreVendorContact, useResetVendorContactPassword,
} from '../../hooks/useVendorContacts.js';
import { useImportXls, useExportXls } from '../../hooks/useImportExport.js';
import { useActivePaymentTerms } from '../../hooks/usePaymentTerms.js';
import { useRoles } from '../../hooks/useRoles.js';
import { COUNTRIES, resolveLevel } from '@nap/shared';
import { useToast } from '../../hooks/useToast.js';
import { cap, fmtPhone, errMsg } from '../../utils/format.js';
import { useFormState } from '../../hooks/useFormState.js';
import { useCollectionState } from '../../hooks/useCollectionState.js';
import { saveCollection } from '../../utils/saveCollection.js';
import { BLANK_EMAIL, BLANK_PHONE, BLANK_ADDRESS, BLANK_TAX_ID, PHONE_TYPES, EMAIL_LABELS } from '../../utils/formConstants.js';
import { vendorApi } from '../../services/vendorApi.js';
import { emailApi } from '../../services/emailApi.js';
import { phoneNumberApi } from '../../services/phoneNumberApi.js';
import { pageContainerSx } from '../../config/layoutTokens.js';
import { useListSelection } from '../../hooks/useListSelection.js';
import { useArchiveRestore } from '../../hooks/useArchiveRestore.js';

import VendorViewDialog from './vendors/VendorViewDialog.jsx';
import VendorCreateDialog from './vendors/VendorCreateDialog.jsx';
import VendorEditDialog from './vendors/VendorEditDialog.jsx';
import ContactViewDialog from './vendors/ContactViewDialog.jsx';
import ContactFormDialog from './vendors/ContactFormDialog.jsx';

const BLANK_CREATE = { name: '', code: '', payment_term_id: '', notes: '', is_active: true };
const BLANK_EDIT = { name: '', code: '', payment_term_id: '', notes: '', is_active: true };
const BLANK_CONTACT_FORM = {
  first_name: '', last_name: '', position: '', department: '',
  is_app_user: false, roles: [], password: '',
};

const baseColumns = [
  { field: 'code', headerName: 'Code', width: 120 },
  { field: 'name', headerName: 'Vendor Name', flex: 1, minWidth: 200 },
  { field: 'payment_term_id', headerName: 'Terms', width: 160 },
  {
    field: 'is_active',
    headerName: 'Active',
    width: 100,
    renderCell: ({ value }) => <StatusBadge status={value ? 'active' : 'suspended'} />,
  },
];

export default function VendorsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const caps = user?.perms?.caps || {};
  const canImport = resolveLevel(caps, 'core', 'vendors', 'import') === 'full';
  const canExport = resolveLevel(caps, 'core', 'vendors', 'export') !== 'none';

  const { data: res, isLoading } = useVendors();
  const allRows = res?.rows ?? [];

  const { data: rolesRes } = useRoles();
  const roleOptions = rolesRes?.rows ?? [];

  const { data: ptRes } = useActivePaymentTerms();
  const paymentTermsList = ptRes?.rows ?? [];
  const ptMap = useMemo(() => new Map(paymentTermsList.map((pt) => [pt.id, pt.label])), [paymentTermsList]);
  const columns = useMemo(() => baseColumns.map((col) =>
    col.field === 'payment_term_id'
      ? { ...col, valueGetter: (params) => ptMap.get(params.row.payment_term_id) || '\u2014' }
      : col,
  ), [ptMap]);

  const [viewFilter, setViewFilter] = useState('active');
  const rows = useMemo(() => {
    if (viewFilter === 'active') return allRows.filter((r) => !r.deactivated_at);
    if (viewFilter === 'archived') return allRows.filter((r) => !!r.deactivated_at);
    return allRows;
  }, [allRows, viewFilter]);

  const createMut = useCreateVendor();
  const updateMut = useUpdateVendor();
  const archiveMut = useArchiveVendor();
  const restoreMut = useRestoreVendor();

  const importMut = useImportXls(vendorApi.importCombinedXls, ['vendors'], [['vendorContacts']]);
  const exportMut = useExportXls(vendorApi.exportCombinedXls, 'vendors');

  const createEmailMut = useCreateEmail();
  const updateEmailMut = useUpdateEmail();
  const archiveEmailMut = useArchiveEmail();
  const createPhoneMut = useCreatePhoneNumber();
  const updatePhoneMut = useUpdatePhoneNumber();
  const archivePhoneMut = useArchivePhoneNumber();
  const createAddrMut = useCreateAddress();
  const updateAddrMut = useUpdateAddress();
  const archiveAddrMut = useArchiveAddress();
  const createTaxIdMut = useCreateTaxIdentifier();
  const updateTaxIdMut = useUpdateTaxIdentifier();
  const archiveTaxIdMut = useArchiveTaxIdentifier();
  const createContactMut = useCreateVendorContact();
  const updateContactMut = useUpdateVendorContact();
  const archiveContactMut = useArchiveVendorContact();
  const restoreContactMut = useRestoreVendorContact();
  const resetContactPwMut = useResetVendorContactPassword();

  /* ── Selection (new system) ─────────────────────────────────── */
  const selection = useListSelection(rows);
  const { selectedRows, allActive, allArchived } = selection;

  /* ── Dialog state ───────────────────────────────────────────── */
  const [importOpen, setImportOpen] = useState(false);
  const [importErrors, setImportErrors] = useState(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewVendor, setViewVendor] = useState(null);
  const [viewSourceId, setViewSourceId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [resetPwOpen, setResetPwOpen] = useState(false);
  const [resetPwTarget, setResetPwTarget] = useState(null);

  /* ── Tab state ──────────────────────────────────────────────── */
  const [contactViewFilter, setContactViewFilter] = useState('active');

  /* ── Edit contact sub-collection state ──────────────────────── */
  const [contactEmails, setContactEmails] = useState({});
  const [contactPhones, setContactPhones] = useState({});

  /* ── View contact sub-collection state ──────────────────────── */
  const [viewContactEmails, setViewContactEmails] = useState({});
  const [viewContactPhones, setViewContactPhones] = useState({});

  /* ── Contact sub-dialog state ───────────────────────────────── */
  const [contactViewOpen, setContactViewOpen] = useState(false);
  const [contactViewRow, setContactViewRow] = useState(null);
  const [contactCreateOpen, setContactCreateOpen] = useState(false);
  const [contactEditOpen, setContactEditOpen] = useState(false);
  const [contactEditRow, setContactEditRow] = useState(null);

  /* ── Contact create form ────────────────────────────────────── */
  const { form: contactCreateForm, setForm: setContactCreateForm, field: onContactCreateField, reset: resetContactCreateForm } = useFormState(BLANK_CONTACT_FORM);
  const [contactCreateEmails, setContactCreateEmails] = useState([]);
  const [contactCreatePhones, setContactCreatePhones] = useState([]);

  /* ── Contact edit form ──────────────────────────────────────── */
  const { form: contactEditForm, setForm: setContactEditForm, field: onContactEditField } = useFormState(BLANK_CONTACT_FORM);
  const [contactEditEmails, setContactEditEmails] = useState([]);
  const [contactEditPhones, setContactEditPhones] = useState([]);

  /* ── Contact password popover (for sub-dialogs) ─────────────── */
  const [contactPwAnchor, setContactPwAnchor] = useState(null);
  const [contactPwTarget, setContactPwTarget] = useState(null); // 'create' | 'edit'

  /* ── Lookup maps for DataTable virtual columns ──────────────── */
  const [contactPhoneMap, setContactPhoneMap] = useState(new Map());
  const [contactEmailMap, setContactEmailMap] = useState(new Map());
  const [viewContactPhoneMap, setViewContactPhoneMap] = useState(new Map());
  const [viewContactEmailMap, setViewContactEmailMap] = useState(new Map());

  const [editSourceId, setEditSourceId] = useState(null);
  const { data: emailsRes } = useEmails({ source_id: editSourceId, includeDeactivated: 'false' }, { enabled: !!editSourceId });
  const { data: phonesRes } = usePhoneNumbers({ source_id: editSourceId, includeDeactivated: 'false' }, { enabled: !!editSourceId });
  const { data: addressesRes } = useAddresses({ source_id: editSourceId, includeDeactivated: 'false' }, { enabled: !!editSourceId });
  const { data: taxIdsRes } = useTaxIdentifiers({ source_id: editSourceId, includeDeactivated: 'false' }, { enabled: !!editSourceId });

  const [editVendorId, setEditVendorId] = useState(null);
  const { data: contactsRes } = useVendorContacts(
    { vendor_id: editVendorId, includeDeactivated: 'true' },
    { enabled: !!editVendorId },
  );

  // View dialog child data
  const { data: viewEmailsRes } = useEmails({ source_id: viewSourceId, includeDeactivated: 'false' }, { enabled: !!viewSourceId });
  const { data: viewPhonesRes } = usePhoneNumbers({ source_id: viewSourceId, includeDeactivated: 'false' }, { enabled: !!viewSourceId });
  const { data: viewAddressesRes } = useAddresses({ source_id: viewSourceId, includeDeactivated: 'false' }, { enabled: !!viewSourceId });
  const { data: viewTaxIdsRes } = useTaxIdentifiers({ source_id: viewSourceId, includeDeactivated: 'false' }, { enabled: !!viewSourceId });
  const { data: viewContactsRes } = useVendorContacts(
    { vendor_id: viewVendor?.id, includeDeactivated: 'false' },
    { enabled: !!viewVendor?.id },
  );
  const viewEmails = viewEmailsRes?.rows ?? [];
  const viewPhones = viewPhonesRes?.rows ?? [];
  const viewAddresses = viewAddressesRes?.rows ?? [];
  const viewTaxIds = viewTaxIdsRes?.rows ?? [];
  const viewContacts = viewContactsRes?.rows ?? [];

  const { form: createForm, setForm: setCreateForm, field: onCreateField, reset: resetCreateForm } = useFormState(BLANK_CREATE);
  const { form: editForm, setForm: setEditForm, field: onEditField } = useFormState(BLANK_EDIT);
  const emails = useCollectionState([], { blank: BLANK_EMAIL, autoPrimary: 'is_primary', exclusive: ['is_primary'] });
  const phones = useCollectionState([], { blank: BLANK_PHONE, autoPrimary: 'is_primary', exclusive: ['is_primary'] });
  const addresses = useCollectionState([], { blank: BLANK_ADDRESS });
  const taxIds = useCollectionState([], { blank: BLANK_TAX_ID });
  const [editContacts, setEditContacts] = useState([]);
  const editInitial = useRef({ form: null, emails: null, phones: null, addresses: null, taxIds: null });

  const { toast, snackProps } = useToast();

  /* ── Contact DataTable columns ──────────────────────────────── */
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

  /* ── Contact view filter + selection ──────────────────────────── */
  const filteredContacts = useMemo(() => {
    const live = editContacts.filter((c) => !c._deleted);
    if (contactViewFilter === 'active') return live.filter((c) => !c.deactivated_at);
    if (contactViewFilter === 'archived') return live.filter((c) => !!c.deactivated_at);
    return live;
  }, [editContacts, contactViewFilter]);

  const contactSelection = useListSelection(filteredContacts);
  const viewContactSelection = useListSelection(viewContacts || []);

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

  /* ── Contact password popover handlers ──────────────────────── */
  const handleContactAppUserToggle = (target) => (e) => {
    if (e.target.checked) {
      setContactPwTarget(target);
      setContactPwAnchor(e.currentTarget);
    } else {
      const setForm = target === 'create' ? setContactCreateForm : setContactEditForm;
      setForm((p) => ({ ...p, is_app_user: false, password: '' }));
    }
  };

  const handleContactPwConfirm = (password) => {
    const setForm = contactPwTarget === 'create' ? setContactCreateForm : setContactEditForm;
    setForm((p) => ({ ...p, is_app_user: true, password }));
    setContactPwAnchor(null);
    setContactPwTarget(null);
  };

  const handleContactPwCancel = () => {
    setContactPwAnchor(null);
    setContactPwTarget(null);
  };

  /* ── Sync query-fetched sub-collections into edit state ────── */
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

  useEffect(() => {
    if (editOpen && contactsRes?.rows) {
      const contacts = contactsRes.rows;
      setEditContacts(contacts);

      // Fetch emails and phones for each contact + build lookup maps
      const fetchContactChildren = async () => {
        const em = {};
        const ph = {};
        const eMap = new Map();
        const pMap = new Map();
        for (const c of contacts) {
          if (c.source_id) {
            const emailRes = await emailApi.list({ source_id: c.source_id, includeDeactivated: 'false' });
            em[c.id] = emailRes?.rows ?? [];
            const phoneRes = await phoneNumberApi.list({ source_id: c.source_id, includeDeactivated: 'false' });
            ph[c.id] = phoneRes?.rows ?? [];
            const primaryEmail = em[c.id].find((e) => e.is_primary) || em[c.id][0];
            if (primaryEmail) eMap.set(c.id, primaryEmail.email);
            const primaryPhone = ph[c.id].find((p) => p.is_primary) || ph[c.id][0];
            if (primaryPhone) pMap.set(c.id, fmtPhone(primaryPhone));
          }
        }
        setContactEmails(em);
        setContactPhones(ph);
        setContactEmailMap(eMap);
        setContactPhoneMap(pMap);
      };
      fetchContactChildren();
    }
  }, [editOpen, contactsRes]);

  /* ── Fetch view contact emails/phones ───────────────────────── */
  useEffect(() => {
    if (viewOpen && viewContacts.length) {
      const fetchViewContactChildren = async () => {
        const em = {};
        const ph = {};
        const eMap = new Map();
        const pMap = new Map();
        for (const c of viewContacts) {
          if (c.source_id) {
            const emailRes = await emailApi.list({ source_id: c.source_id, includeDeactivated: 'false' });
            em[c.id] = emailRes?.rows ?? [];
            const phoneRes = await phoneNumberApi.list({ source_id: c.source_id, includeDeactivated: 'false' });
            ph[c.id] = phoneRes?.rows ?? [];
            const primaryEmail = em[c.id].find((e) => e.is_primary) || em[c.id][0];
            if (primaryEmail) eMap.set(c.id, primaryEmail.email);
            const primaryPhone = ph[c.id].find((p) => p.is_primary) || ph[c.id][0];
            if (primaryPhone) pMap.set(c.id, fmtPhone(primaryPhone));
          }
        }
        setViewContactEmails(em);
        setViewContactPhones(ph);
        setViewContactEmailMap(eMap);
        setViewContactPhoneMap(pMap);
      };
      fetchViewContactChildren();
    }
  }, [viewOpen, viewContacts]);

  /* ── refreshContactChildren helper ──────────────────────────── */
  const refreshContactChildren = useCallback(async (overrideContacts) => {
    const contacts = (overrideContacts || editContacts).filter((c) => !c._deleted);
    const em = {};
    const ph = {};
    const eMap = new Map();
    const pMap = new Map();
    for (const c of contacts) {
      if (c.source_id) {
        const emailRes = await emailApi.list({ source_id: c.source_id, includeDeactivated: 'false' });
        em[c.id] = emailRes?.rows ?? [];
        const phoneRes = await phoneNumberApi.list({ source_id: c.source_id, includeDeactivated: 'false' });
        ph[c.id] = phoneRes?.rows ?? [];
        const primaryEmail = em[c.id].find((e) => e.is_primary) || em[c.id][0];
        if (primaryEmail) eMap.set(c.id, primaryEmail.email);
        const primaryPhone = ph[c.id].find((p) => p.is_primary) || ph[c.id][0];
        if (primaryPhone) pMap.set(c.id, fmtPhone(primaryPhone));
      }
    }
    setContactEmails(em);
    setContactPhones(ph);
    setContactEmailMap(eMap);
    setContactPhoneMap(pMap);
  }, [editContacts]);

  /* ── Bundled close handlers ─────────────────────────────────── */
  const handleViewClose = useCallback(() => {
    setViewOpen(false);
    setViewSourceId(null);
    setViewContactEmails({});
    setViewContactPhones({});
    setViewContactEmailMap(new Map());
    setViewContactPhoneMap(new Map());
  }, []);

  const handleEditClose = useCallback(() => {
    setEditOpen(false);
    setEditRow(null);
    setEditSourceId(null);
    setEditVendorId(null);
    setContactEmails({});
    setContactPhones({});
    setContactEmailMap(new Map());
    setContactPhoneMap(new Map());
    setContactViewFilter('active');
  }, []);

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

  /* ── Row action callbacks ──────────────────────────────────── */
  const handleView = useCallback((row) => {
    setViewVendor(row);
    setViewSourceId(row.source_id || null);
    setViewContactEmails({});
    setViewContactPhones({});
    setViewContactEmailMap(new Map());
    setViewContactPhoneMap(new Map());
    setViewOpen(true);
  }, []);

  const handleEdit = useCallback((row) => {
    setEditRow(row);
    const form = {
      name: row.name ?? '',
      code: row.code ?? '',
      payment_term_id: row.payment_term_id ?? '',
      notes: row.notes ?? '',
      is_active: row.is_active ?? true,
    };
    setEditForm(form);
    editInitial.current.form = form;

    setEditSourceId(row.source_id || null);
    setEditVendorId(row.id || null);
    if (!row.source_id) {
      emails.reset([]);
      phones.reset([]);
      addresses.reset([]);
      taxIds.reset([]);
      editInitial.current.emails = [];
      editInitial.current.phones = [];
      editInitial.current.addresses = [];
      editInitial.current.taxIds = [];
    }
    if (!row.id) {
      setEditContacts([]);
    }

    setContactEmails({});
    setContactPhones({});
    setContactEmailMap(new Map());
    setContactPhoneMap(new Map());
    setContactViewFilter('active');
    setEditOpen(true);
  }, []);

  /* ── Contact sub-dialog openers ─────────────────────────────── */
  const openContactEdit = useCallback((row) => {
    setContactEditRow(row);
    setContactEditForm({
      first_name: row.first_name, last_name: row.last_name,
      position: row.position || '', department: row.department || '',
      is_app_user: row.is_app_user || false, roles: row.roles || [],
      password: '',
    });
    setContactEditEmails([...(contactEmails[row.id] || [])]);
    setContactEditPhones([...(contactPhones[row.id] || [])]);
    setContactEditOpen(true);
  }, [contactEmails, contactPhones]);

  /* ── Dirty-check: disable Save when nothing changed ──────── */
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

  const handleCreate = async () => {
    try {
      const payload = { ...createForm, payment_term_id: createForm.payment_term_id || null };
      await createMut.mutateAsync(payload);

      toast('Vendor created');
      setCreateOpen(false);
      resetCreateForm();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };

  const handleUpdate = async () => {
    try {
      const changes = { ...editForm, payment_term_id: editForm.payment_term_id || null };
      await updateMut.mutateAsync({ filter: { id: editRow.id }, changes });

      if (editRow.source_id) {
        const sid = editRow.source_id;
        await saveCollection(emails.items, {
          sourceId: sid, fields: ['email', 'label', 'is_primary'],
          createMut: createEmailMut.mutateAsync, updateMut: updateEmailMut.mutateAsync, archiveMut: archiveEmailMut.mutateAsync,
        });
        await saveCollection(phones.items, {
          sourceId: sid, fields: ['country_code', 'phone_type', 'phone_number', 'is_primary'],
          createMut: createPhoneMut.mutateAsync, updateMut: updatePhoneMut.mutateAsync, archiveMut: archivePhoneMut.mutateAsync,
        });
        await saveCollection(addresses.items, {
          sourceId: sid, fields: ['label', 'address_line_1', 'address_line_2', 'address_line_3', 'city', 'state_province', 'postal_code', 'country_code'],
          createMut: createAddrMut.mutateAsync, updateMut: updateAddrMut.mutateAsync, archiveMut: archiveAddrMut.mutateAsync,
        });
        await saveCollection(taxIds.items, {
          sourceId: sid, fields: ['country_code', 'tax_type', 'tax_value'],
          createMut: createTaxIdMut.mutateAsync, updateMut: updateTaxIdMut.mutateAsync, archiveMut: archiveTaxIdMut.mutateAsync,
        });
      }

      toast('Vendor updated');
      handleEditClose();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };

  /* ── Contact Create handler ─────────────────────────────────── */
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
  }, [contactCreateForm, contactCreateEmails, contactCreatePhones, editRow, editContacts, createContactMut, createEmailMut, createPhoneMut, toast, errMsg, refreshContactChildren]);

  /* ── Contact Edit handler ───────────────────────────────────── */
  const handleContactEdit = useCallback(async () => {
    try {
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

      // CRUD emails
      for (const em of contactEditEmails) {
        if (em._deleted && em.id) {
          await archiveEmailMut.mutateAsync({ id: em.id });
        } else if (!em.id && !em._deleted && em.email) {
          await createEmailMut.mutateAsync({
            source_id: contactEditRow.source_id, email: em.email, label: em.label,
            is_primary: em.is_primary, is_login: em.is_login || false,
          });
        } else if (em.id && !em._deleted) {
          await updateEmailMut.mutateAsync({
            filter: { id: em.id },
            changes: { email: em.email, label: em.label, is_primary: em.is_primary, is_login: em.is_login || false },
          });
        }
      }
      // CRUD phones
      for (const ph of contactEditPhones) {
        if (ph._deleted && ph.id) {
          await archivePhoneMut.mutateAsync({ id: ph.id });
        } else if (!ph.id && !ph._deleted && ph.phone_number) {
          await createPhoneMut.mutateAsync({
            source_id: contactEditRow.source_id, country_code: ph.country_code,
            phone_type: ph.phone_type, phone_number: ph.phone_number, is_primary: ph.is_primary,
          });
        } else if (ph.id && !ph._deleted) {
          await updatePhoneMut.mutateAsync({
            filter: { id: ph.id },
            changes: { country_code: ph.country_code, phone_type: ph.phone_type, phone_number: ph.phone_number, is_primary: ph.is_primary },
          });
        }
      }

      await refreshContactChildren();
      if (contactEditForm.is_app_user !== contactEditRow?.is_app_user) {
        qc.invalidateQueries({ queryKey: ['nap-users'] });
      }
      setContactEditOpen(false);
      setContactEditRow(null);
      toast('Contact updated');
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }, [contactEditRow, contactEditForm, contactEditEmails, contactEditPhones, updateContactMut, createEmailMut, updateEmailMut, archiveEmailMut, createPhoneMut, updatePhoneMut, archivePhoneMut, qc, toast, errMsg, refreshContactChildren]);

  const handleImport = useCallback(async (formData) => {
    setImportErrors(null);
    try {
      const result = await importMut.mutateAsync(formData);
      toast(`Imported ${result.inserted} records`);
      setImportOpen(false);
    } catch (err) {
      const validationErrors = err.payload?.errors;
      if (validationErrors?.length) {
        setImportErrors(validationErrors);
      } else {
        toast(errMsg(err), 'error');
      }
    }
  }, [importMut.mutateAsync, toast]);

  const handleExport = useCallback(async () => {
    try {
      await exportMut.mutateAsync({});
      toast('Export downloaded');
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }, [exportMut.mutateAsync, toast]);

  const { setArchiveOpen, setRestoreOpen, archiveConfirmProps, restoreConfirmProps } = useArchiveRestore({
    selectedRows,
    archiveMut,
    restoreMut,
    entityName: 'vendor',
    setSelectionModel: () => selection.clearSelection(),
    toast,
    errMsg,
    getLabel: (r) => r.name,
  });

  /* ── ModuleBar: tabs + Create + Archive/Restore ────────────── */
  const toolbar = useMemo(() => {
    const primary = [];

    if (viewFilter === 'active' || viewFilter === 'all') {
      primary.push({
        label: selectedRows.length > 1 ? `Archive (${selectedRows.length})` : 'Archive',
        variant: 'outlined',
        color: 'error',
        disabled: selectedRows.length === 0 || !allActive,
        onClick: () => setArchiveOpen(true),
      });
    }
    if (viewFilter === 'archived' || viewFilter === 'all') {
      primary.push({
        label: selectedRows.length > 1 ? `Restore (${selectedRows.length})` : 'Restore',
        variant: 'outlined',
        color: 'success',
        disabled: selectedRows.length === 0 || !allArchived,
        onClick: () => setRestoreOpen(true),
      });
    }

    if (canExport) {
      primary.push({
        label: 'Export',
        variant: 'outlined',
        disabled: exportMut.isPending,
        onClick: handleExport,
      });
    }
    if (canImport) {
      primary.push({
        label: 'Import',
        variant: 'outlined',
        onClick: () => setImportOpen(true),
      });
    }

    primary.push({
      label: 'Create Vendor',
      variant: 'contained',
      color: 'primary',
      onClick: () => {
        resetCreateForm();
        setCreateOpen(true);
      },
    });

    return {
      tabs: [
        { value: 'active', label: 'Active', selected: viewFilter === 'active', onClick: () => { setViewFilter('active'); selection.clearSelection(); } },
        { value: 'all', label: 'All', selected: viewFilter === 'all', onClick: () => { setViewFilter('all'); selection.clearSelection(); } },
        { value: 'archived', label: 'Archived', selected: viewFilter === 'archived', onClick: () => { setViewFilter('archived'); selection.clearSelection(); } },
      ],
      filters: [],
      primaryActions: primary,
    };
  }, [viewFilter, selectedRows.length, allActive, allArchived, selection.clearSelection, setArchiveOpen, setRestoreOpen, canImport, canExport, exportMut.isPending, handleExport]);
  useModuleToolbarRegistration(toolbar);

  /* ── Inline email row renderer (edit mode) ──────────────────── */
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

  /* ── Inline phone row renderer (edit mode) ──────────────────── */
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

  return (
    <Box sx={pageContainerSx}>
      <DataTable
        rows={rows}
        columns={columns}
        loading={isLoading}
        selection={selection}
        onView={handleView}
        onEdit={handleEdit}
      />

      <VendorViewDialog
        open={viewOpen}
        onClose={handleViewClose}
        vendor={viewVendor}
        ptMap={ptMap}
        viewEmails={viewEmails}
        viewPhones={viewPhones}
        viewAddresses={viewAddresses}
        viewTaxIds={viewTaxIds}
        viewContacts={viewContacts}
        contactColumns={contactColumns}
        contactSelection={viewContactSelection}
        onViewContact={handleViewContact}
      />

      <VendorCreateDialog
        open={createOpen}
        onClose={() => { setCreateOpen(false); }}
        createForm={createForm}
        onCreateField={onCreateField}
        setCreateForm={setCreateForm}
        paymentTermsList={paymentTermsList}
        onSubmit={handleCreate}
        loading={createMut.isPending}
      />

      <VendorEditDialog
        open={editOpen}
        onClose={handleEditClose}
        editForm={editForm}
        onEditField={onEditField}
        setEditForm={setEditForm}
        emails={emails}
        phones={phones}
        addresses={addresses}
        taxIds={taxIds}
        paymentTermsList={paymentTermsList}
        hasEditChanges={hasEditChanges}
        onSubmit={handleUpdate}
        loading={updateMut.isPending}
        renderEmailRow={renderEmailRow}
        renderPhoneRow={renderPhoneRow}
        filteredContacts={filteredContacts}
        contactColumns={contactColumns}
        contactSelection={contactSelection}
        contactViewFilter={contactViewFilter}
        setContactViewFilter={setContactViewFilter}
        onContactArchive={() => setContactArchiveOpen(true)}
        onContactRestore={() => setContactRestoreOpen(true)}
        contactArchiveProps={contactArchiveProps}
        contactRestoreProps={contactRestoreProps}
        onCreateContact={handleOpenContactCreate}
        onViewContact={handleViewContact}
        onEditContact={openContactEdit}
      />

      <ContactViewDialog
        open={contactViewOpen}
        onClose={() => { setContactViewOpen(false); setContactViewRow(null); }}
        contact={contactViewRow}
        emails={contactEmails[contactViewRow?.id] || viewContactEmails[contactViewRow?.id] || []}
        phones={contactPhones[contactViewRow?.id] || viewContactPhones[contactViewRow?.id] || []}
      />

      {/* Contact Create */}
      <ContactFormDialog
        open={contactCreateOpen}
        title="Create Contact"
        onCancel={() => setContactCreateOpen(false)}
        onSubmit={handleContactCreate}
        loading={createContactMut.isPending}
        form={contactCreateForm}
        setForm={setContactCreateForm}
        field={onContactCreateField}
        roleOptions={roleOptions}
        contactEmails={contactCreateEmails}
        setContactEmails={setContactCreateEmails}
        contactPhones={contactCreatePhones}
        setContactPhones={setContactCreatePhones}
        onAppUserToggle={handleContactAppUserToggle('create')}
      />

      {/* Contact Edit */}
      <ContactFormDialog
        open={contactEditOpen}
        title="Edit Contact"
        onCancel={() => { setContactEditOpen(false); setContactEditRow(null); }}
        onSubmit={handleContactEdit}
        loading={updateContactMut.isPending}
        form={contactEditForm}
        setForm={setContactEditForm}
        field={onContactEditField}
        roleOptions={roleOptions}
        contactEmails={contactEditEmails}
        setContactEmails={setContactEditEmails}
        contactPhones={contactEditPhones}
        setContactPhones={setContactEditPhones}
        onAppUserToggle={handleContactAppUserToggle('edit')}
      >
        {contactEditForm.is_app_user && contactEditRow?.id && (
          <IconButton size="small" title="Reset Password" onClick={() => { setResetPwTarget(contactEditRow); setResetPwOpen(true); }}>
            <LockResetIcon fontSize="small" />
          </IconButton>
        )}
      </ContactFormDialog>

      <ImportDialog
        open={importOpen}
        title="Import Vendors"
        loading={importMut.isPending}
        errors={importErrors}
        onSubmit={handleImport}
        onCancel={() => { setImportOpen(false); setImportErrors(null); }}
      />

      <ConfirmDialog {...archiveConfirmProps} />
      <ConfirmDialog {...restoreConfirmProps} />

      <ResetPasswordDialog
        open={resetPwOpen}
        onClose={() => { setResetPwOpen(false); setResetPwTarget(null); }}
        onSuccess={() => { setResetPwOpen(false); setResetPwTarget(null); toast('Password reset successfully'); }}
        onReset={(id, password) => resetContactPwMut.mutateAsync({ id, password })}
        entityId={resetPwTarget?.id}
        entityName={resetPwTarget ? `${resetPwTarget.first_name} ${resetPwTarget.last_name}` : ''}
      />

      <SetPasswordPopover anchorEl={contactPwAnchor} onConfirm={handleContactPwConfirm} onCancel={handleContactPwCancel} />

      <ToastSnackbar {...snackProps} />
    </Box>
  );
}
