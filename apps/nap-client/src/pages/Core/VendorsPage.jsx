/**
 * @file Vendors CRUD page — DataTable + create/edit/view/archive/restore with sub-forms
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
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Autocomplete from '@mui/material/Autocomplete';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import LockResetIcon from '@mui/icons-material/LockReset';

import StatusBadge from '../../components/shared/StatusBadge.jsx';
import ToastSnackbar from '../../components/shared/ToastSnackbar.jsx';
import ConfirmDialog from '../../components/shared/ConfirmDialog.jsx';
import ResetPasswordDialog from '../../components/shared/ResetPasswordDialog.jsx';
import SetPasswordPopover from '../../components/shared/SetPasswordPopover.jsx';
import DataTable from '../../components/shared/DataTable.jsx';
import FieldRow from '../../components/shared/FieldRow.jsx';
import FormDialog from '../../components/shared/FormDialog.jsx';
import ImportDialog from '../../components/shared/ImportDialog.jsx';
import PatternTextField from '../../components/shared/PatternTextField.jsx';
import EmailsSection from '../../components/shared/EmailsSection.jsx';
import PhoneNumbersSection from '../../components/shared/PhoneNumbersSection.jsx';
import AddressesSection from '../../components/shared/AddressesSection.jsx';
import TaxIdentifiersSection from '../../components/shared/TaxIdentifiersSection.jsx';
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
import { TAX_TYPES, COUNTRIES, resolveLevel } from '@nap/shared';
import { useToast } from '../../hooks/useToast.js';
import { cap, fmtDate, fmtPhone, errMsg } from '../../utils/format.js';
import { useFormState } from '../../hooks/useFormState.js';
import { useCollectionState } from '../../hooks/useCollectionState.js';
import { saveCollection } from '../../utils/saveCollection.js';
import { BLANK_EMAIL, BLANK_PHONE, BLANK_ADDRESS, BLANK_TAX_ID, PHONE_TYPES, EMAIL_LABELS } from '../../utils/formConstants.js';
import { vendorApi } from '../../services/vendorApi.js';
import { emailApi } from '../../services/emailApi.js';
import { phoneNumberApi } from '../../services/phoneNumberApi.js';
import {
  pageContainerSx, formGridSx, formGroupCardSx, formFullSpanSx, dialogHeaderSx, dialogActionBoxSx, detailGridSx,
} from '../../config/layoutTokens.js';
import { useListSelection } from '../../hooks/useListSelection.js';
import { useArchiveRestore } from '../../hooks/useArchiveRestore.js';

const BLANK_CREATE = { name: '', code: '', payment_term_id: '', notes: '', is_active: true };
const BLANK_EDIT = { name: '', code: '', payment_term_id: '', notes: '', is_active: true };
const BLANK_CONTACT_FORM = {
  first_name: '', last_name: '', position: '', department: '',
  is_app_user: false, roles: [], password: '',
};

const dialogSx = {
  '& .MuiDialogTitle-root + .MuiDialogContent-root': { paddingTop: '16px' },
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
  const [createTab, setCreateTab] = useState(0);
  const [editTab, setEditTab] = useState(0);
  const [viewTab, setViewTab] = useState(0);
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
        const emails = {};
        const phones = {};
        const eMap = new Map();
        const pMap = new Map();
        for (const c of contacts) {
          if (c.source_id) {
            const emailRes = await emailApi.list({ source_id: c.source_id, includeDeactivated: 'false' });
            emails[c.id] = emailRes?.rows ?? [];
            const phoneRes = await phoneNumberApi.list({ source_id: c.source_id, includeDeactivated: 'false' });
            phones[c.id] = phoneRes?.rows ?? [];
            const primaryEmail = emails[c.id].find((e) => e.is_primary) || emails[c.id][0];
            if (primaryEmail) eMap.set(c.id, primaryEmail.email);
            const primaryPhone = phones[c.id].find((p) => p.is_primary) || phones[c.id][0];
            if (primaryPhone) pMap.set(c.id, fmtPhone(primaryPhone));
          }
        }
        setContactEmails(emails);
        setContactPhones(phones);
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
        const emails = {};
        const phones = {};
        const eMap = new Map();
        const pMap = new Map();
        for (const c of viewContacts) {
          if (c.source_id) {
            const emailRes = await emailApi.list({ source_id: c.source_id, includeDeactivated: 'false' });
            emails[c.id] = emailRes?.rows ?? [];
            const phoneRes = await phoneNumberApi.list({ source_id: c.source_id, includeDeactivated: 'false' });
            phones[c.id] = phoneRes?.rows ?? [];
            const primaryEmail = emails[c.id].find((e) => e.is_primary) || emails[c.id][0];
            if (primaryEmail) eMap.set(c.id, primaryEmail.email);
            const primaryPhone = phones[c.id].find((p) => p.is_primary) || phones[c.id][0];
            if (primaryPhone) pMap.set(c.id, fmtPhone(primaryPhone));
          }
        }
        setViewContactEmails(emails);
        setViewContactPhones(phones);
        setViewContactEmailMap(eMap);
        setViewContactPhoneMap(pMap);
      };
      fetchViewContactChildren();
    }
  }, [viewOpen, viewContacts]);

  /* ── refreshContactChildren helper ──────────────────────────── */
  const refreshContactChildren = useCallback(async (overrideContacts) => {
    const contacts = (overrideContacts || editContacts).filter((c) => !c._deleted);
    const emails = {};
    const phones = {};
    const eMap = new Map();
    const pMap = new Map();
    for (const c of contacts) {
      if (c.source_id) {
        const emailRes = await emailApi.list({ source_id: c.source_id, includeDeactivated: 'false' });
        emails[c.id] = emailRes?.rows ?? [];
        const phoneRes = await phoneNumberApi.list({ source_id: c.source_id, includeDeactivated: 'false' });
        phones[c.id] = phoneRes?.rows ?? [];
        const primaryEmail = emails[c.id].find((e) => e.is_primary) || emails[c.id][0];
        if (primaryEmail) eMap.set(c.id, primaryEmail.email);
        const primaryPhone = phones[c.id].find((p) => p.is_primary) || phones[c.id][0];
        if (primaryPhone) pMap.set(c.id, fmtPhone(primaryPhone));
      }
    }
    setContactEmails(emails);
    setContactPhones(phones);
    setContactEmailMap(eMap);
    setContactPhoneMap(pMap);
  }, [editContacts]);

  /* ── Row action callbacks ──────────────────────────────────── */
  const handleView = useCallback((row) => {
    setViewVendor(row);
    setViewSourceId(row.source_id || null);
    setViewTab(0);
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
    setEditTab(0);
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
      setCreateTab(0);
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
      setEditOpen(false);
      setEditRow(null);
      setEditSourceId(null);
      setEditVendorId(null);
      setContactEmails({});
      setContactPhones({});
      setContactEmailMap(new Map());
      setContactPhoneMap(new Map());
      setEditTab(0);
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
      // When toggling is_app_user on, include the selected login email in the
      // contact update payload so the backend can provision before email mutations run
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
        setCreateTab(0);
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

      {/* ── View Details Dialog ──────────────────────────────────── */}
      <Dialog
        open={viewOpen}
        onClose={() => { setViewOpen(false); setViewSourceId(null); setViewTab(0); setViewContactEmails({}); setViewContactPhones({}); setViewContactEmailMap(new Map()); setViewContactPhoneMap(new Map()); }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={dialogHeaderSx}>
          <Box>
            <span>Vendor Details</span>
            {viewVendor && (
              <Typography variant="body2" color="text.secondary">
                {viewVendor.name}
              </Typography>
            )}
          </Box>
          <Box sx={dialogActionBoxSx}>
            <Button size="small" color="inherit" onClick={() => { setViewOpen(false); setViewSourceId(null); setViewTab(0); setViewContactEmails({}); setViewContactPhones({}); setViewContactEmailMap(new Map()); setViewContactPhoneMap(new Map()); }}>
              Close
            </Button>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {viewVendor && (
            <>
              <Tabs value={viewTab} onChange={(_, v) => setViewTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tab label="Vendor" />
                <Tab label="Contacts" />
              </Tabs>

              {viewTab === 0 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
                  <Box sx={detailGridSx}>
                    <FieldRow label="Code" value={viewVendor.code || '\u2014'} />
                    <FieldRow label="Vendor Name" value={viewVendor.name} />
                    <FieldRow label="Payment Terms" value={ptMap.get(viewVendor.payment_term_id) || '\u2014'} />
                    <FieldRow label="Active" value={viewVendor.is_active ? 'Yes' : 'No'} />
                    <FieldRow label="Status">
                      <StatusBadge status={viewVendor.deactivated_at ? 'archived' : 'active'} />
                    </FieldRow>
                    <FieldRow label="Created" value={fmtDate(viewVendor.created_at)} />
                    <FieldRow label="Updated" value={fmtDate(viewVendor.updated_at)} />
                  </Box>
                  {viewVendor.notes && (
                    <>
                      <Divider />
                      <FieldRow label="Notes" value={viewVendor.notes} />
                    </>
                  )}

                  <EmailsSection emails={viewEmails} />
                  <PhoneNumbersSection phones={viewPhones} />
                  <AddressesSection addresses={viewAddresses} />
                  <TaxIdentifiersSection taxIds={viewTaxIds} />
                </Box>
              )}

              {viewTab === 1 && (
                <Box sx={{ pt: 2 }}>
                  <DataTable
                    rows={viewContacts}
                    columns={contactColumns}
                    selection={viewContactSelection}
                    onView={(row) => { setContactViewRow(row); setContactViewOpen(true); }}
                    dataGridProps={{ autoHeight: true, checkboxSelection: false, pageSizeOptions: [10, 25] }}
                  />
                </Box>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Create Vendor Dialog ─────────────────────────────────── */}
      <Dialog
        open={createOpen}
        onClose={() => { setCreateOpen(false); setCreateTab(0); }}
        maxWidth="md"
        fullWidth
        disableRestoreFocus
        sx={dialogSx}
      >
        <form onSubmit={(e) => { e.preventDefault(); handleCreate(); }}>
          <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
            <span>Create Vendor</span>
            <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
              <Button size="small" onClick={() => { setCreateOpen(false); setCreateTab(0); }} disabled={createMut.isPending}>
                Cancel
              </Button>
              <Button
                size="small"
                type="submit"
                variant="contained"
                disabled={createMut.isPending}
                startIcon={createMut.isPending ? <CircularProgress size={16} color="inherit" /> : null}
              >
                Create
              </Button>
            </Box>
          </DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Tabs value={createTab} onChange={(_, v) => setCreateTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tab label="Vendor" />
              <Tab label="Contacts" />
            </Tabs>

            {createTab === 0 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                <TextField label="Vendor Name" required value={createForm.name} onChange={onCreateField('name')} />
                <TextField label="Code" value={createForm.code} onChange={onCreateField('code')} inputProps={{ maxLength: 16 }} />
                <TextField
                  label="Payment Terms"
                  select
                  value={createForm.payment_term_id}
                  onChange={onCreateField('payment_term_id')}
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {paymentTermsList.map((pt) => (
                    <MenuItem key={pt.id} value={pt.id}>{pt.label}</MenuItem>
                  ))}
                </TextField>
                <TextField label="Notes" multiline minRows={2} value={createForm.notes} onChange={onCreateField('notes')} />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={createForm.is_active}
                      onChange={(e) => setCreateForm((p) => ({ ...p, is_active: e.target.checked }))}
                      size="small"
                    />
                  }
                  label="Active"
                />
              </Box>
            )}

            {createTab === 1 && (
              <Box sx={{ pt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Save the vendor first, then edit it to add contacts.
                </Typography>
              </Box>
            )}
          </DialogContent>
        </form>
      </Dialog>

      {/* ── Edit Vendor Dialog ──────────────────────────────────── */}
      <Dialog
        open={editOpen}
        onClose={() => { setEditOpen(false); setEditRow(null); setEditSourceId(null); setEditVendorId(null); setContactEmails({}); setContactPhones({}); setContactEmailMap(new Map()); setContactPhoneMap(new Map()); setContactViewFilter('active'); setEditTab(0); }}
        maxWidth="md"
        fullWidth
        disableRestoreFocus
        sx={dialogSx}
      >
        <form onSubmit={(e) => { e.preventDefault(); handleUpdate(); }}>
          <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
            <span>Edit Vendor</span>
            <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
              <Button
                size="small"
                onClick={() => { setEditOpen(false); setEditRow(null); setEditSourceId(null); setEditVendorId(null); setContactEmails({}); setContactPhones({}); setContactEmailMap(new Map()); setContactPhoneMap(new Map()); setContactViewFilter('active'); setEditTab(0); }}
                disabled={updateMut.isPending}
              >
                Cancel
              </Button>
              <Button
                size="small"
                type="submit"
                variant="contained"
                disabled={updateMut.isPending || !hasEditChanges}
                startIcon={updateMut.isPending ? <CircularProgress size={16} color="inherit" /> : null}
              >
                Save Changes
              </Button>
            </Box>
          </DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Tabs value={editTab} onChange={(_, v) => setEditTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tab label="Vendor" />
              <Tab label="Contacts" />
            </Tabs>

            {editTab === 0 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                <Box sx={formGridSx}>
                  <TextField label="Vendor Name" required value={editForm.name} onChange={onEditField('name')} />
                  <TextField label="Code" value={editForm.code} onChange={onEditField('code')} inputProps={{ maxLength: 16 }} />
                  <TextField
                    label="Payment Terms"
                    select
                    value={editForm.payment_term_id}
                    onChange={onEditField('payment_term_id')}
                  >
                    <MenuItem value="">
                      <em>None</em>
                    </MenuItem>
                    {paymentTermsList.map((pt) => (
                      <MenuItem key={pt.id} value={pt.id}>{pt.label}</MenuItem>
                    ))}
                  </TextField>
                  <TextField label="Notes" multiline minRows={2} value={editForm.notes} onChange={onEditField('notes')} />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={editForm.is_active}
                        onChange={(e) => setEditForm((p) => ({ ...p, is_active: e.target.checked }))}
                        size="small"
                      />
                    }
                    label="Active"
                  />
                </Box>

                {/* ── Emails ──────────────────────────────────────────── */}
                <Divider />
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="subtitle2">Emails</Typography>
                  <Button size="small" startIcon={<AddIcon />} onClick={emails.add}>Add Email</Button>
                </Box>
                {emails.visibleItems.length === 0 && (
                  <Typography variant="body2" color="text.secondary">No emails</Typography>
                )}
                {emails.visibleItems.map((em) => {
                  const idx = emails.items.indexOf(em);
                  return renderEmailRow(
                    em,
                    idx,
                    emails.update,
                    emails.remove,
                  );
                })}

                {/* ── Phone Numbers ──────────────────────────────────── */}
                <Divider />
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="subtitle2">Phone Numbers</Typography>
                  <Button size="small" startIcon={<AddIcon />} onClick={phones.add}>Add Phone</Button>
                </Box>
                {phones.visibleItems.length === 0 && (
                  <Typography variant="body2" color="text.secondary">No phone numbers</Typography>
                )}
                {phones.visibleItems.map((phone) => {
                  const idx = phones.items.indexOf(phone);
                  return renderPhoneRow(
                    phone,
                    idx,
                    phones.update,
                    phones.remove,
                  );
                })}

                {/* ── Addresses ──────────────────────────────────────── */}
                <Divider />
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="subtitle2">Addresses</Typography>
                  <Button size="small" startIcon={<AddIcon />} onClick={addresses.add}>Add Address</Button>
                </Box>
                {addresses.visibleItems.length === 0 && (
                  <Typography variant="body2" color="text.secondary">No addresses</Typography>
                )}
                {addresses.visibleItems.map((addr) => {
                  const idx = addresses.items.indexOf(addr);
                  return (
                    <Box key={addr.id || idx} sx={{ ...formGroupCardSx, gridColumn: undefined }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <TextField
                          label="Label"
                          value={addr.label}
                          onChange={(e) => addresses.update(idx, 'label', e.target.value)}
                          size="small"
                          sx={{ width: 200 }}
                        />
                        <IconButton size="small" onClick={() => addresses.remove(idx)} color="error">
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Box>
                      <Box sx={formGridSx}>
                        <TextField label="Address Line 1" value={addr.address_line_1} onChange={(e) => addresses.update(idx, 'address_line_1', e.target.value)} size="small" sx={formFullSpanSx} />
                        <TextField label="Address Line 2" value={addr.address_line_2} onChange={(e) => addresses.update(idx, 'address_line_2', e.target.value)} size="small" sx={formFullSpanSx} />
                        <TextField label="Address Line 3" value={addr.address_line_3 || ''} onChange={(e) => addresses.update(idx, 'address_line_3', e.target.value)} size="small" sx={formFullSpanSx} />
                        <TextField label="City" value={addr.city} onChange={(e) => addresses.update(idx, 'city', e.target.value)} size="small" />
                        <TextField label="State / Province" value={addr.state_province} onChange={(e) => addresses.update(idx, 'state_province', e.target.value)} size="small" />
                        <TextField label="Postal Code" value={addr.postal_code} onChange={(e) => addresses.update(idx, 'postal_code', e.target.value)} size="small" />
                        <TextField label="Country Code" value={addr.country_code} onChange={(e) => addresses.update(idx, 'country_code', e.target.value)} size="small" inputProps={{ maxLength: 2 }} />
                      </Box>
                    </Box>
                  );
                })}

                {/* ── Tax Identifiers ──────────────────────────────────── */}
                <Divider />
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="subtitle2">Tax Identifiers</Typography>
                  <Button size="small" startIcon={<AddIcon />} onClick={taxIds.add}>Add Tax ID</Button>
                </Box>
                {taxIds.visibleItems.length === 0 && (
                  <Typography variant="body2" color="text.secondary">No tax identifiers</Typography>
                )}
                {taxIds.visibleItems.map((taxId) => {
                  const idx = taxIds.items.indexOf(taxId);
                  const countryCode = taxId.country_code?.trim() || '';
                  const taxTypes = TAX_TYPES[countryCode] || TAX_TYPES._OTHER;
                  return (
                    <Box key={taxId.id || idx} sx={{ ...formGroupCardSx, gridColumn: undefined }}>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                        <TextField
                          select
                          label="Country"
                          value={countryCode}
                          onChange={(e) => {
                            taxIds.update(idx, 'country_code', e.target.value);
                            const newTypes = TAX_TYPES[e.target.value] || TAX_TYPES._OTHER;
                            taxIds.update(idx, 'tax_type', newTypes[0]?.code || 'TIN');
                          }}
                          SelectProps={{ renderValue: (val) => val }}
                          size="small"
                          sx={{ minWidth: 80 }}
                        >
                          {COUNTRIES.map((c) => (
                            <MenuItem key={c.code} value={c.code}>{c.code} - {c.name}</MenuItem>
                          ))}
                        </TextField>
                        <TextField
                          select
                          label="Type"
                          value={taxId.tax_type}
                          onChange={(e) => taxIds.update(idx, 'tax_type', e.target.value)}
                          SelectProps={{ renderValue: (val) => val }}
                          size="small"
                          sx={{ minWidth: 80 }}
                        >
                          {taxTypes.map((t) => (
                            <MenuItem key={t.code} value={t.code}>{t.label}</MenuItem>
                          ))}
                        </TextField>
                        <PatternTextField
                          label="Tax ID Value"
                          value={taxId.tax_value}
                          onChange={(raw) => taxIds.update(idx, 'tax_value', raw)}
                          pattern={taxTypes.find((t) => t.code === taxId.tax_type)?.placeholder}
                          size="small"
                          sx={{ flex: 1, minWidth: 160 }}
                        />
                        <IconButton size="small" onClick={() => taxIds.remove(idx)} color="error">
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            )}

            {editTab === 1 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                <Tabs value={contactViewFilter} onChange={(_, v) => { setContactViewFilter(v); contactSelection.clearSelection(); }} sx={{ minHeight: 32 }}>
                  <Tab value="active" label="Active" sx={{ minHeight: 32, py: 0 }} />
                  <Tab value="all" label="All" sx={{ minHeight: 32, py: 0 }} />
                  <Tab value="archived" label="Archived" sx={{ minHeight: 32, py: 0 }} />
                </Tabs>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                  {(contactViewFilter === 'active' || contactViewFilter === 'all') && (
                    <Button
                      size="small" variant="outlined" color="error"
                      disabled={contactSelection.selectedRows.length === 0 || !contactSelection.allActive}
                      onClick={() => setContactArchiveOpen(true)}
                    >
                      {contactSelection.selectedRows.length > 1 ? `Archive (${contactSelection.selectedRows.length})` : 'Archive'}
                    </Button>
                  )}
                  {(contactViewFilter === 'archived' || contactViewFilter === 'all') && (
                    <Button
                      size="small" variant="outlined" color="success"
                      disabled={contactSelection.selectedRows.length === 0 || !contactSelection.allArchived}
                      onClick={() => setContactRestoreOpen(true)}
                    >
                      {contactSelection.selectedRows.length > 1 ? `Restore (${contactSelection.selectedRows.length})` : 'Restore'}
                    </Button>
                  )}
                  {contactViewFilter !== 'archived' && (
                    <Button size="small" startIcon={<AddIcon />} onClick={() => { resetContactCreateForm(); setContactCreateEmails([]); setContactCreatePhones([]); setContactCreateOpen(true); }}>
                      Create Contact
                    </Button>
                  )}
                </Box>
                <DataTable
                  rows={filteredContacts}
                  columns={contactColumns}
                  selection={contactSelection}
                  onView={(row) => { setContactViewRow(row); setContactViewOpen(true); }}
                  onEdit={(row) => { openContactEdit(row); }}
                  dataGridProps={{ autoHeight: true, checkboxSelection: true, pageSizeOptions: [10, 25] }}
                />
                <ConfirmDialog {...contactArchiveProps} />
                {contactRestoreProps && <ConfirmDialog {...contactRestoreProps} />}
              </Box>
            )}
          </DialogContent>
        </form>
      </Dialog>

      {/* ── Contact View Sub-Dialog ───────────────────────────────── */}
      <Dialog
        open={contactViewOpen}
        onClose={() => { setContactViewOpen(false); setContactViewRow(null); }}
        maxWidth="sm"
        fullWidth
        disableRestoreFocus
      >
        <DialogTitle sx={dialogHeaderSx}>
          <span>{contactViewRow ? `${contactViewRow.first_name} ${contactViewRow.last_name}` : 'Contact Details'}</span>
          <Box sx={dialogActionBoxSx}>
            <Button size="small" onClick={() => { setContactViewOpen(false); setContactViewRow(null); }}>Close</Button>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {contactViewRow && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={detailGridSx}>
                <FieldRow label="First Name" value={contactViewRow.first_name} />
                <FieldRow label="Last Name" value={contactViewRow.last_name} />
                <FieldRow label="Position" value={contactViewRow.position || '\u2014'} />
                <FieldRow label="Department" value={contactViewRow.department || '\u2014'} />
                <FieldRow label="App User" value={contactViewRow.is_app_user ? 'Yes' : 'No'} />
                <FieldRow label="Roles" value={contactViewRow.roles?.length ? contactViewRow.roles.join(', ') : '\u2014'} />
              </Box>
              <Divider />
              <EmailsSection emails={contactEmails[contactViewRow.id] || viewContactEmails[contactViewRow.id] || []} />
              <PhoneNumbersSection phones={contactPhones[contactViewRow.id] || viewContactPhones[contactViewRow.id] || []} />
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Contact Create Sub-Dialog ─────────────────────────────── */}
      <FormDialog
        open={contactCreateOpen}
        title="Create Contact"
        maxWidth="sm"
        onCancel={() => setContactCreateOpen(false)}
        onSubmit={handleContactCreate}
        loading={createContactMut.isPending}
      >
        <Box sx={formGridSx}>
          <TextField label="First Name" required value={contactCreateForm.first_name} onChange={onContactCreateField('first_name')} />
          <TextField label="Last Name" required value={contactCreateForm.last_name} onChange={onContactCreateField('last_name')} />
          <TextField label="Position" value={contactCreateForm.position} onChange={onContactCreateField('position')} />
          <TextField label="Department" value={contactCreateForm.department} onChange={onContactCreateField('department')} />
        </Box>
        <FormControlLabel
          control={<Checkbox checked={contactCreateForm.is_app_user} onChange={handleContactAppUserToggle('create')} size="small" />}
          label="App User (creates login account)"
        />
        {contactCreateForm.is_app_user && (
          <Autocomplete
            multiple
            options={roleOptions}
            getOptionLabel={(opt) => opt.name}
            isOptionEqualToValue={(opt, val) => opt.code === val.code}
            value={roleOptions.filter((r) => contactCreateForm.roles.includes(r.code))}
            onChange={(_, v) => setContactCreateForm((p) => ({ ...p, roles: v.map((r) => r.code) }))}
            renderInput={(params) => <TextField {...params} label="Roles" />}
          />
        )}
        {/* Emails */}
        <Divider />
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle2">Emails</Typography>
          <Button size="small" startIcon={<AddIcon />} onClick={() => setContactCreateEmails((p) => [...p, { ...BLANK_EMAIL, is_primary: !p.length }])}>Add Email</Button>
        </Box>
        {contactCreateEmails.filter((e) => !e._deleted).length === 0 && (
          <Typography variant="body2" color="text.secondary">No emails</Typography>
        )}
        {contactCreateEmails.map((em, idx) => !em._deleted && (
          <Box key={idx} sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField label="Email" type="email" value={em.email} onChange={(e) => setContactCreateEmails((p) => p.map((x, i) => i === idx ? { ...x, email: e.target.value } : x))} size="small" sx={{ flex: 1, minWidth: 200 }} />
            <TextField select label="Label" value={em.label} onChange={(e) => setContactCreateEmails((p) => p.map((x, i) => i === idx ? { ...x, label: e.target.value } : x))} size="small" sx={{ minWidth: 120 }}>
              {EMAIL_LABELS.map((l) => <MenuItem key={l} value={l}>{cap(l)}</MenuItem>)}
            </TextField>
            <FormControlLabel control={<Checkbox checked={em.is_primary} onChange={(e) => setContactCreateEmails((p) => p.map((x, i) => i === idx ? { ...x, is_primary: e.target.checked } : e.target.checked ? { ...x, is_primary: false } : x))} size="small" />} label="Primary" sx={{ mr: 0 }} />
            <IconButton size="small" onClick={() => setContactCreateEmails((p) => p.filter((_, i) => i !== idx))} color="error"><DeleteOutlineIcon fontSize="small" /></IconButton>
          </Box>
        ))}

        {/* Phones */}
        <Divider />
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle2">Phone Numbers</Typography>
          <Button size="small" startIcon={<AddIcon />} onClick={() => setContactCreatePhones((p) => [...p, { ...BLANK_PHONE, is_primary: !p.length }])}>Add Phone</Button>
        </Box>
        {contactCreatePhones.filter((p) => !p._deleted).length === 0 && (
          <Typography variant="body2" color="text.secondary">No phone numbers</Typography>
        )}
        {contactCreatePhones.map((ph, idx) => !ph._deleted && (
          <Box key={idx} sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField select label="Country" value={ph.country_code} onChange={(e) => setContactCreatePhones((p) => p.map((x, i) => i === idx ? { ...x, country_code: e.target.value } : x))} size="small" sx={{ minWidth: 80 }}>
              {COUNTRIES.map((c) => <MenuItem key={c.code} value={c.code}>{c.code}</MenuItem>)}
            </TextField>
            <TextField select label="Type" value={ph.phone_type} onChange={(e) => setContactCreatePhones((p) => p.map((x, i) => i === idx ? { ...x, phone_type: e.target.value } : x))} size="small" sx={{ minWidth: 100 }}>
              {PHONE_TYPES.map((t) => <MenuItem key={t} value={t}>{cap(t)}</MenuItem>)}
            </TextField>
            <PatternTextField label="Number" value={ph.phone_number} onChange={(val) => setContactCreatePhones((p) => p.map((x, i) => i === idx ? { ...x, phone_number: val } : x))} pattern={COUNTRIES.find((c) => c.code === ph.country_code)?.placeholder} size="small" sx={{ flex: 1, minWidth: 140 }} />
            <FormControlLabel control={<Checkbox checked={ph.is_primary} onChange={(e) => setContactCreatePhones((p) => p.map((x, i) => i === idx ? { ...x, is_primary: e.target.checked } : e.target.checked ? { ...x, is_primary: false } : x))} size="small" />} label="Primary" sx={{ mr: 0 }} />
            <IconButton size="small" onClick={() => setContactCreatePhones((p) => p.filter((_, i) => i !== idx))} color="error"><DeleteOutlineIcon fontSize="small" /></IconButton>
          </Box>
        ))}
      </FormDialog>

      {/* ── Contact Edit Sub-Dialog ───────────────────────────────── */}
      <FormDialog
        open={contactEditOpen}
        title="Edit Contact"
        maxWidth="sm"
        onCancel={() => { setContactEditOpen(false); setContactEditRow(null); }}
        onSubmit={handleContactEdit}
        loading={updateContactMut.isPending}
      >
        <Box sx={formGridSx}>
          <TextField label="First Name" required value={contactEditForm.first_name} onChange={onContactEditField('first_name')} />
          <TextField label="Last Name" required value={contactEditForm.last_name} onChange={onContactEditField('last_name')} />
          <TextField label="Position" value={contactEditForm.position} onChange={onContactEditField('position')} />
          <TextField label="Department" value={contactEditForm.department} onChange={onContactEditField('department')} />
        </Box>
        <FormControlLabel
          control={<Checkbox checked={contactEditForm.is_app_user} onChange={handleContactAppUserToggle('edit')} size="small" />}
          label="App User (creates login account)"
        />
        {contactEditForm.is_app_user && contactEditRow?.id && (
          <IconButton size="small" title="Reset Password" onClick={() => { setResetPwTarget(contactEditRow); setResetPwOpen(true); }}>
            <LockResetIcon fontSize="small" />
          </IconButton>
        )}
        {contactEditForm.is_app_user && (
          <Autocomplete
            multiple
            options={roleOptions}
            getOptionLabel={(opt) => opt.name}
            isOptionEqualToValue={(opt, val) => opt.code === val.code}
            value={roleOptions.filter((r) => contactEditForm.roles.includes(r.code))}
            onChange={(_, v) => setContactEditForm((p) => ({ ...p, roles: v.map((r) => r.code) }))}
            renderInput={(params) => <TextField {...params} label="Roles" />}
          />
        )}
        {/* Emails */}
        <Divider />
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle2">Emails</Typography>
          <Button size="small" startIcon={<AddIcon />} onClick={() => setContactEditEmails((p) => [...p, { ...BLANK_EMAIL, is_primary: !p.filter((e) => !e._deleted).length }])}>Add Email</Button>
        </Box>
        {contactEditEmails.filter((e) => !e._deleted).length === 0 && (
          <Typography variant="body2" color="text.secondary">No emails</Typography>
        )}
        {contactEditEmails.map((em, idx) => !em._deleted && (
          <Box key={em.id || idx} sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField label="Email" type="email" value={em.email} onChange={(e) => setContactEditEmails((p) => p.map((x, i) => i === idx ? { ...x, email: e.target.value } : x))} size="small" sx={{ flex: 1, minWidth: 200 }} />
            <TextField select label="Label" value={em.label} onChange={(e) => setContactEditEmails((p) => p.map((x, i) => i === idx ? { ...x, label: e.target.value } : x))} size="small" sx={{ minWidth: 120 }}>
              {EMAIL_LABELS.map((l) => <MenuItem key={l} value={l}>{cap(l)}</MenuItem>)}
            </TextField>
            <FormControlLabel control={<Checkbox checked={em.is_primary} onChange={(e) => setContactEditEmails((p) => p.map((x, i) => i === idx ? { ...x, is_primary: e.target.checked } : e.target.checked ? { ...x, is_primary: false } : x))} size="small" />} label="Primary" sx={{ mr: 0 }} />
            <IconButton size="small" onClick={() => setContactEditEmails((p) => p.map((x, i) => i === idx ? { ...x, _deleted: true } : x))} color="error"><DeleteOutlineIcon fontSize="small" /></IconButton>
          </Box>
        ))}

        {/* Phones */}
        <Divider />
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle2">Phone Numbers</Typography>
          <Button size="small" startIcon={<AddIcon />} onClick={() => setContactEditPhones((p) => [...p, { ...BLANK_PHONE, is_primary: !p.filter((ph) => !ph._deleted).length }])}>Add Phone</Button>
        </Box>
        {contactEditPhones.filter((p) => !p._deleted).length === 0 && (
          <Typography variant="body2" color="text.secondary">No phone numbers</Typography>
        )}
        {contactEditPhones.map((ph, idx) => !ph._deleted && (
          <Box key={ph.id || idx} sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField select label="Country" value={ph.country_code} onChange={(e) => setContactEditPhones((p) => p.map((x, i) => i === idx ? { ...x, country_code: e.target.value } : x))} size="small" sx={{ minWidth: 80 }}>
              {COUNTRIES.map((c) => <MenuItem key={c.code} value={c.code}>{c.code}</MenuItem>)}
            </TextField>
            <TextField select label="Type" value={ph.phone_type} onChange={(e) => setContactEditPhones((p) => p.map((x, i) => i === idx ? { ...x, phone_type: e.target.value } : x))} size="small" sx={{ minWidth: 100 }}>
              {PHONE_TYPES.map((t) => <MenuItem key={t} value={t}>{cap(t)}</MenuItem>)}
            </TextField>
            <PatternTextField label="Number" value={ph.phone_number} onChange={(val) => setContactEditPhones((p) => p.map((x, i) => i === idx ? { ...x, phone_number: val } : x))} pattern={COUNTRIES.find((c) => c.code === ph.country_code)?.placeholder} size="small" sx={{ flex: 1, minWidth: 140 }} />
            <FormControlLabel control={<Checkbox checked={ph.is_primary} onChange={(e) => setContactEditPhones((p) => p.map((x, i) => i === idx ? { ...x, is_primary: e.target.checked } : e.target.checked ? { ...x, is_primary: false } : x))} size="small" />} label="Primary" sx={{ mr: 0 }} />
            <IconButton size="small" onClick={() => setContactEditPhones((p) => p.map((x, i) => i === idx ? { ...x, _deleted: true } : x))} color="error"><DeleteOutlineIcon fontSize="small" /></IconButton>
          </Box>
        ))}
      </FormDialog>

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
