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
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
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
import ConfirmDialog from '../../components/shared/ConfirmDialog.jsx';
import ResetPasswordDialog from '../../components/shared/ResetPasswordDialog.jsx';
import SetPasswordPopover from '../../components/shared/SetPasswordPopover.jsx';
import DataTable from '../../components/shared/DataTable.jsx';
import FieldRow from '../../components/shared/FieldRow.jsx';
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
  useVendorContacts, useCreateVendorContact, useUpdateVendorContact, useArchiveVendorContact, useResetVendorContactPassword,
} from '../../hooks/useVendorContacts.js';
import { useImportXls, useExportXls } from '../../hooks/useImportExport.js';
import { useActivePaymentTerms } from '../../hooks/usePaymentTerms.js';
import { useRoles } from '../../hooks/useRoles.js';
import { TAX_TYPES, COUNTRIES, resolveLevel } from '@nap/shared';
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
const BLANK_EMAIL = { email: '', label: 'work', is_primary: false };
const BLANK_PHONE = { country_code: 'US', phone_type: 'cell', phone_number: '', is_primary: false };
const BLANK_ADDRESS = {
  label: '', address_line_1: '', address_line_2: '', address_line_3: '', city: '',
  state_province: '', postal_code: '', country_code: 'US', is_primary: false,
};
const BLANK_TAX_ID = { country_code: 'US', tax_type: 'TIN', tax_value: '', is_primary: false };
const BLANK_CONTACT = { first_name: '', last_name: '', position: '', department: '', is_app_user: false, roles: [], is_primary: false };

const PHONE_TYPES = ['cell', 'work', 'home', 'fax', 'other'];
const EMAIL_LABELS = ['work', 'personal', 'billing', 'other'];

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
const fmtDate = (v) => (v ? new Date(v).toLocaleDateString() : '\u2014');

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

  const importMut = useImportXls(vendorApi.importCombinedXls, ['vendors', 'vendorContacts']);
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
  const resetContactPwMut = useResetVendorContactPassword();

  /* ── Selection (new system) ─────────────────────────────────── */
  const selection = useListSelection(rows);
  const { selectedRows, allActive, allArchived } = selection;

  /* ── Dialog state ───────────────────────────────────────────── */
  const [importOpen, setImportOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewVendor, setViewVendor] = useState(null);
  const [viewSourceId, setViewSourceId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [resetPwOpen, setResetPwOpen] = useState(false);
  const [resetPwTarget, setResetPwTarget] = useState(null);
  const [vcPwAnchor, setVcPwAnchor] = useState(null);
  const [vcPwIdx, setVcPwIdx] = useState(null);

  /* ── Tab state ──────────────────────────────────────────────── */
  const [createTab, setCreateTab] = useState(0);
  const [editTab, setEditTab] = useState(0);
  const [viewTab, setViewTab] = useState(0);

  /* ── Create contact state ───────────────────────────────────── */
  const [createContacts, setCreateContacts] = useState([]);
  const [createContactEmails, setCreateContactEmails] = useState({});
  const [createContactPhones, setCreateContactPhones] = useState({});

  /* ── Edit contact sub-collection state ──────────────────────── */
  const [contactEmails, setContactEmails] = useState({});
  const [contactPhones, setContactPhones] = useState({});

  /* ── View contact sub-collection state ──────────────────────── */
  const [viewContactEmails, setViewContactEmails] = useState({});
  const [viewContactPhones, setViewContactPhones] = useState({});

  const [editSourceId, setEditSourceId] = useState(null);
  const { data: emailsRes } = useEmails({ source_id: editSourceId, includeDeactivated: 'false' }, { enabled: !!editSourceId });
  const { data: phonesRes } = usePhoneNumbers({ source_id: editSourceId, includeDeactivated: 'false' }, { enabled: !!editSourceId });
  const { data: addressesRes } = useAddresses({ source_id: editSourceId, includeDeactivated: 'false' }, { enabled: !!editSourceId });
  const { data: taxIdsRes } = useTaxIdentifiers({ source_id: editSourceId, includeDeactivated: 'false' }, { enabled: !!editSourceId });

  const [editVendorId, setEditVendorId] = useState(null);
  const { data: contactsRes } = useVendorContacts(
    { vendor_id: editVendorId, includeDeactivated: 'false' },
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

  const [createForm, setCreateForm] = useState(BLANK_CREATE);
  const [editForm, setEditForm] = useState(BLANK_EDIT);
  const [editEmails, setEditEmails] = useState([]);
  const [editPhones, setEditPhones] = useState([]);
  const [editAddresses, setEditAddresses] = useState([]);
  const [editTaxIds, setEditTaxIds] = useState([]);
  const [editContacts, setEditContacts] = useState([]);
  const editInitial = useRef({ form: null, emails: null, phones: null, addresses: null, taxIds: null, contacts: null });

  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' });
  const toast = useCallback((msg, sev = 'success') => setSnack({ open: true, msg, sev }), []);
  const errMsg = (err) => err.payload?.error || err.payload?.message || err.message;

  const onCreateField = (f) => (e) => setCreateForm((p) => ({ ...p, [f]: e.target.value }));
  const onEditField = (f) => (e) => setEditForm((p) => ({ ...p, [f]: e.target.value }));

  /* ── Email edit helpers ─────────────────────────────────────── */
  const updateEmail = (idx, field, value) =>
    setEditEmails((prev) => prev.map((e, i) => (i === idx ? { ...e, [field]: value } : e)));
  const addEmail = () => setEditEmails((prev) => [...prev, { ...BLANK_EMAIL }]);
  const removeEmail = (idx) =>
    setEditEmails((prev) => prev.map((e, i) => (i === idx ? { ...e, _deleted: true } : e)));

  /* ── Phone edit helpers ─────────────────────────────────────── */
  const updatePhone = (idx, field, value) =>
    setEditPhones((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  const addPhone = () => setEditPhones((prev) => [...prev, { ...BLANK_PHONE }]);
  const removePhone = (idx) =>
    setEditPhones((prev) => prev.map((p, i) => (i === idx ? { ...p, _deleted: true } : p)));

  /* ── Address edit helpers ───────────────────────────────────── */
  const updateAddress = (idx, field, value) =>
    setEditAddresses((prev) => prev.map((a, i) => (i === idx ? { ...a, [field]: value } : a)));
  const addAddress = () => setEditAddresses((prev) => [...prev, { ...BLANK_ADDRESS }]);
  const removeAddress = (idx) =>
    setEditAddresses((prev) => prev.map((a, i) => (i === idx ? { ...a, _deleted: true } : a)));

  /* ── Tax ID edit helpers ──────────────────────────────────── */
  const updateTaxId = (idx, field, value) =>
    setEditTaxIds((prev) => prev.map((t, i) => (i === idx ? { ...t, [field]: value } : t)));
  const addTaxId = () => setEditTaxIds((prev) => [...prev, { ...BLANK_TAX_ID }]);
  const removeTaxId = (idx) =>
    setEditTaxIds((prev) => prev.map((t, i) => (i === idx ? { ...t, _deleted: true } : t)));

  /* ── Vendor Contact edit helpers ────────────────────────────── */
  const updateContact = (idx, field, value) =>
    setEditContacts((prev) => prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
  const addContact = () => setEditContacts((prev) => [...prev, { ...BLANK_CONTACT }]);
  const removeContact = (idx) =>
    setEditContacts((prev) => prev.map((c, i) => (i === idx ? { ...c, _deleted: true } : c)));

  /* ── Create contact helpers ─────────────────────────────────── */
  const updateCreateContact = (idx, field, value) =>
    setCreateContacts((prev) => prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
  const addCreateContact = () => setCreateContacts((prev) => [...prev, { ...BLANK_CONTACT }]);
  const removeCreateContact = (idx) => setCreateContacts((prev) => prev.filter((_, i) => i !== idx));

  const updateCreateContactEmail = (contactIdx, emailIdx, field, value) =>
    setCreateContactEmails((prev) => ({
      ...prev,
      [contactIdx]: (prev[contactIdx] || []).map((e, i) => (i === emailIdx ? { ...e, [field]: value } : e)),
    }));
  const addCreateContactEmail = (contactIdx) =>
    setCreateContactEmails((prev) => ({ ...prev, [contactIdx]: [...(prev[contactIdx] || []), { ...BLANK_EMAIL }] }));
  const removeCreateContactEmail = (contactIdx, emailIdx) =>
    setCreateContactEmails((prev) => ({
      ...prev,
      [contactIdx]: (prev[contactIdx] || []).filter((_, i) => i !== emailIdx),
    }));

  const updateCreateContactPhone = (contactIdx, phoneIdx, field, value) =>
    setCreateContactPhones((prev) => ({
      ...prev,
      [contactIdx]: (prev[contactIdx] || []).map((p, i) => (i === phoneIdx ? { ...p, [field]: value } : p)),
    }));
  const addCreateContactPhone = (contactIdx) =>
    setCreateContactPhones((prev) => ({ ...prev, [contactIdx]: [...(prev[contactIdx] || []), { ...BLANK_PHONE }] }));
  const removeCreateContactPhone = (contactIdx, phoneIdx) =>
    setCreateContactPhones((prev) => ({
      ...prev,
      [contactIdx]: (prev[contactIdx] || []).filter((_, i) => i !== phoneIdx),
    }));

  /* ── Edit contact email/phone helpers ───────────────────────── */
  const updateContactEmail = (contactKey, emailIdx, field, value) =>
    setContactEmails((prev) => ({
      ...prev,
      [contactKey]: (prev[contactKey] || []).map((e, i) => (i === emailIdx ? { ...e, [field]: value } : e)),
    }));
  const addContactEmail = (contactKey) =>
    setContactEmails((prev) => ({ ...prev, [contactKey]: [...(prev[contactKey] || []), { ...BLANK_EMAIL }] }));
  const removeContactEmail = (contactKey, emailIdx) =>
    setContactEmails((prev) => ({
      ...prev,
      [contactKey]: (prev[contactKey] || []).map((e, i) => (i === emailIdx ? { ...e, _deleted: true } : e)),
    }));

  const updateContactPhone = (contactKey, phoneIdx, field, value) =>
    setContactPhones((prev) => ({
      ...prev,
      [contactKey]: (prev[contactKey] || []).map((p, i) => (i === phoneIdx ? { ...p, [field]: value } : p)),
    }));
  const addContactPhone = (contactKey) =>
    setContactPhones((prev) => ({ ...prev, [contactKey]: [...(prev[contactKey] || []), { ...BLANK_PHONE }] }));
  const removeContactPhone = (contactKey, phoneIdx) =>
    setContactPhones((prev) => ({
      ...prev,
      [contactKey]: (prev[contactKey] || []).map((p, i) => (i === phoneIdx ? { ...p, _deleted: true } : p)),
    }));

  /* ── Create contact app-user password popover ──────────────── */
  const handleCreateVcAppUserToggle = (idx) => (e) => {
    if (e.target.checked) {
      setVcPwIdx(idx);
      setVcPwAnchor(e.currentTarget);
    } else {
      setCreateContacts((prev) => prev.map((c, i) => (i === idx ? { ...c, is_app_user: false, password: '' } : c)));
    }
  };

  const handleCreateVcPwConfirm = (password) => {
    setCreateContacts((prev) => prev.map((c, i) => (i === vcPwIdx ? { ...c, is_app_user: true, password } : c)));
    setVcPwAnchor(null);
    setVcPwIdx(null);
  };

  /* ── Vendor contact app-user password popover ───────────────── */
  const handleVcAppUserToggle = (idx) => (e) => {
    if (e.target.checked) {
      setVcPwIdx(idx);
      setVcPwAnchor(e.currentTarget);
    } else {
      updateContact(idx, 'is_app_user', false);
      setEditContacts((prev) => prev.map((c, i) => (i === idx ? { ...c, is_app_user: false, password: '' } : c)));
    }
  };

  const handleVcPwConfirm = (password) => {
    setEditContacts((prev) => prev.map((c, i) => (i === vcPwIdx ? { ...c, is_app_user: true, password } : c)));
    setVcPwAnchor(null);
    setVcPwIdx(null);
  };

  const handleVcPwCancel = () => {
    setVcPwAnchor(null);
    setVcPwIdx(null);
  };

  /* ── Sync query-fetched sub-collections into edit state ────── */
  useEffect(() => {
    if (editOpen && emailsRes?.rows) {
      setEditEmails(emailsRes.rows);
      editInitial.current.emails = emailsRes.rows;
    }
  }, [editOpen, emailsRes]);

  useEffect(() => {
    if (editOpen && phonesRes?.rows) {
      setEditPhones(phonesRes.rows);
      editInitial.current.phones = phonesRes.rows;
    }
  }, [editOpen, phonesRes]);

  useEffect(() => {
    if (editOpen && addressesRes?.rows) {
      setEditAddresses(addressesRes.rows);
      editInitial.current.addresses = addressesRes.rows;
    }
  }, [editOpen, addressesRes]);

  useEffect(() => {
    if (editOpen && taxIdsRes?.rows) {
      setEditTaxIds(taxIdsRes.rows);
      editInitial.current.taxIds = taxIdsRes.rows;
    }
  }, [editOpen, taxIdsRes]);

  useEffect(() => {
    if (editOpen && contactsRes?.rows) {
      const contacts = contactsRes.rows;
      setEditContacts(contacts);
      editInitial.current.contacts = contacts;

      // Fetch emails and phones for each contact
      const fetchContactChildren = async () => {
        const emails = {};
        const phones = {};
        for (const c of contacts) {
          if (c.source_id) {
            const emailRes = await emailApi.list({ source_id: c.source_id, includeDeactivated: 'false' });
            emails[c.id] = emailRes?.rows ?? [];
            const phoneRes = await phoneNumberApi.list({ source_id: c.source_id, includeDeactivated: 'false' });
            phones[c.id] = phoneRes?.rows ?? [];
          }
        }
        setContactEmails(emails);
        setContactPhones(phones);
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
        for (const c of viewContacts) {
          if (c.source_id) {
            const emailRes = await emailApi.list({ source_id: c.source_id, includeDeactivated: 'false' });
            emails[c.id] = emailRes?.rows ?? [];
            const phoneRes = await phoneNumberApi.list({ source_id: c.source_id, includeDeactivated: 'false' });
            phones[c.id] = phoneRes?.rows ?? [];
          }
        }
        setViewContactEmails(emails);
        setViewContactPhones(phones);
      };
      fetchViewContactChildren();
    }
  }, [viewOpen, viewContacts]);

  /* ── Row action callbacks ──────────────────────────────────── */
  const handleView = useCallback((row) => {
    setViewVendor(row);
    setViewSourceId(row.source_id || null);
    setViewTab(0);
    setViewContactEmails({});
    setViewContactPhones({});
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
      setEditEmails([]);
      setEditPhones([]);
      setEditAddresses([]);
      setEditTaxIds([]);
      editInitial.current.emails = [];
      editInitial.current.phones = [];
      editInitial.current.addresses = [];
      editInitial.current.taxIds = [];
    }
    if (!row.id) {
      setEditContacts([]);
      editInitial.current.contacts = [];
    }

    setContactEmails({});
    setContactPhones({});
    setEditTab(0);
    setEditOpen(true);
  }, []);

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
    if (collectionChanged(editEmails, init.emails, ['email', 'label', 'is_primary'])) return true;
    if (collectionChanged(editPhones, init.phones, ['country_code', 'phone_type', 'phone_number', 'is_primary'])) return true;
    if (collectionChanged(editAddresses, init.addresses, ['label', 'address_line_1', 'address_line_2', 'address_line_3', 'city', 'state_province', 'postal_code', 'country_code', 'is_primary'])) return true;
    if (collectionChanged(editTaxIds, init.taxIds, ['country_code', 'tax_type', 'tax_value', 'is_primary'])) return true;
    if (collectionChanged(editContacts, init.contacts, ['first_name', 'last_name', 'position', 'department', 'is_app_user', 'roles', 'is_primary'])) return true;
    return false;
  }, [editForm, editEmails, editPhones, editAddresses, editTaxIds, editContacts]);

  const handleCreate = async () => {
    try {
      const payload = { ...createForm, payment_term_id: createForm.payment_term_id || null };
      const vendor = await createMut.mutateAsync(payload);

      // Create contacts with their emails and phones
      for (let idx = 0; idx < createContacts.length; idx++) {
        const c = createContacts[idx];
        const cEmails = createContactEmails[idx] || [];
        const primaryEmail = cEmails.find((e) => e.is_primary)?.email || cEmails[0]?.email || null;

        const contactRecord = await createContactMut.mutateAsync({
          vendor_id: vendor.id,
          first_name: c.first_name,
          last_name: c.last_name,
          position: c.position,
          department: c.department,
          is_app_user: c.is_app_user,
          roles: c.roles,
          is_primary: c.is_primary,
          email: primaryEmail,
          password: c.password,
        });

        // Create remaining emails beyond the primary
        const primaryIdx = cEmails.findIndex((e) => e.email === primaryEmail);
        for (let ei = 0; ei < cEmails.length; ei++) {
          if (ei === primaryIdx) continue;
          const em = cEmails[ei];
          if (em.email) {
            await createEmailMut.mutateAsync({
              source_id: contactRecord.source_id,
              email: em.email,
              label: em.label,
              is_primary: em.is_primary,
              is_login: false,
            });
          }
        }

        // Create phones
        const cPhones = createContactPhones[idx] || [];
        for (const ph of cPhones) {
          if (ph.phone_number) {
            await createPhoneMut.mutateAsync({
              source_id: contactRecord.source_id,
              country_code: ph.country_code,
              phone_type: ph.phone_type,
              phone_number: ph.phone_number,
              is_primary: ph.is_primary,
            });
          }
        }
      }

      toast('Vendor created');
      setCreateOpen(false);
      setCreateForm(BLANK_CREATE);
      setCreateContacts([]);
      setCreateContactEmails({});
      setCreateContactPhones({});
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
        for (const em of editEmails) {
          if (em._deleted && em.id) {
            await archiveEmailMut.mutateAsync({ id: em.id });
          } else if (!em.id && !em._deleted) {
            await createEmailMut.mutateAsync({ source_id: editRow.source_id, email: em.email, label: em.label, is_primary: em.is_primary });
          } else if (em.id && !em._deleted) {
            await updateEmailMut.mutateAsync({ filter: { id: em.id }, changes: { email: em.email, label: em.label, is_primary: em.is_primary } });
          }
        }
        for (const p of editPhones) {
          if (p._deleted && p.id) {
            await archivePhoneMut.mutateAsync({ id: p.id });
          } else if (!p.id && !p._deleted) {
            await createPhoneMut.mutateAsync({ source_id: editRow.source_id, country_code: p.country_code, phone_type: p.phone_type, phone_number: p.phone_number, is_primary: p.is_primary });
          } else if (p.id && !p._deleted) {
            await updatePhoneMut.mutateAsync({ filter: { id: p.id }, changes: { country_code: p.country_code, phone_type: p.phone_type, phone_number: p.phone_number, is_primary: p.is_primary } });
          }
        }
        for (const a of editAddresses) {
          if (a._deleted && a.id) {
            await archiveAddrMut.mutateAsync({ id: a.id });
          } else if (!a.id && !a._deleted) {
            const { _deleted, ...rest } = a;
            await createAddrMut.mutateAsync({ ...rest, source_id: editRow.source_id });
          } else if (a.id && !a._deleted) {
            const { id, source_id: _sid, created_at: _ca, updated_at: _ua, created_by: _cb, updated_by: _ub, deactivated_at: _da, ...addrChanges } = a;
            await updateAddrMut.mutateAsync({ filter: { id }, changes: addrChanges });
          }
        }
        for (const t of editTaxIds) {
          if (t._deleted && t.id) {
            await archiveTaxIdMut.mutateAsync({ id: t.id });
          } else if (!t.id && !t._deleted) {
            await createTaxIdMut.mutateAsync({
              source_id: editRow.source_id, country_code: t.country_code,
              tax_type: t.tax_type, tax_value: t.tax_value, is_primary: t.is_primary,
            });
          } else if (t.id && !t._deleted) {
            await updateTaxIdMut.mutateAsync({
              filter: { id: t.id },
              changes: { country_code: t.country_code, tax_type: t.tax_type, tax_value: t.tax_value, is_primary: t.is_primary },
            });
          }
        }
      }

      for (const c of editContacts) {
        if (c._deleted && c.id) {
          await archiveContactMut.mutateAsync({ id: c.id });
        } else if (!c.id && !c._deleted) {
          const contactRecord = await createContactMut.mutateAsync({
            vendor_id: editRow.id, first_name: c.first_name, last_name: c.last_name,
            position: c.position, department: c.department, is_app_user: c.is_app_user,
            roles: c.roles, is_primary: c.is_primary,
          });

          // Create emails/phones for new contacts
          const tempKey = editContacts.indexOf(c);
          const newEmails = (contactEmails[`_new_${tempKey}`] || []).filter((e) => !e._deleted && e.email);
          for (const em of newEmails) {
            await createEmailMut.mutateAsync({
              source_id: contactRecord.source_id, email: em.email, label: em.label, is_primary: em.is_primary, is_login: em.is_login || false,
            });
          }
          const newPhones = (contactPhones[`_new_${tempKey}`] || []).filter((p) => !p._deleted && p.phone_number);
          for (const ph of newPhones) {
            await createPhoneMut.mutateAsync({
              source_id: contactRecord.source_id, country_code: ph.country_code, phone_type: ph.phone_type, phone_number: ph.phone_number, is_primary: ph.is_primary,
            });
          }
        } else if (c.id && !c._deleted) {
          await updateContactMut.mutateAsync({
            filter: { id: c.id },
            changes: {
              first_name: c.first_name, last_name: c.last_name, position: c.position,
              department: c.department, is_app_user: c.is_app_user, roles: c.roles, is_primary: c.is_primary,
            },
          });

          // Save contact emails
          const cEmails = contactEmails[c.id] || [];
          for (const em of cEmails) {
            if (em._deleted && em.id) {
              await archiveEmailMut.mutateAsync({ id: em.id });
            } else if (!em.id && !em._deleted && em.email) {
              await createEmailMut.mutateAsync({
                source_id: c.source_id, email: em.email, label: em.label, is_primary: em.is_primary, is_login: em.is_login || false,
              });
            } else if (em.id && !em._deleted) {
              await updateEmailMut.mutateAsync({
                filter: { id: em.id }, changes: { email: em.email, label: em.label, is_primary: em.is_primary, is_login: em.is_login || false },
              });
            }
          }

          // Save contact phones
          const cPhones = contactPhones[c.id] || [];
          for (const ph of cPhones) {
            if (ph._deleted && ph.id) {
              await archivePhoneMut.mutateAsync({ id: ph.id });
            } else if (!ph.id && !ph._deleted && ph.phone_number) {
              await createPhoneMut.mutateAsync({
                source_id: c.source_id, country_code: ph.country_code, phone_type: ph.phone_type, phone_number: ph.phone_number, is_primary: ph.is_primary,
              });
            } else if (ph.id && !ph._deleted) {
              await updatePhoneMut.mutateAsync({
                filter: { id: ph.id }, changes: { country_code: ph.country_code, phone_type: ph.phone_type, phone_number: ph.phone_number, is_primary: ph.is_primary },
              });
            }
          }
        }
      }

      toast('Vendor updated');
      setEditOpen(false);
      setEditRow(null);
      setEditSourceId(null);
      setEditVendorId(null);
      setContactEmails({});
      setContactPhones({});
      setEditTab(0);
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };

  const handleImport = useCallback(async (formData) => {
    try {
      const result = await importMut.mutateAsync(formData);
      toast(`Imported ${result.inserted} records`);
      setImportOpen(false);
    } catch (err) {
      toast(errMsg(err), 'error');
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
        setCreateForm(BLANK_CREATE);
        setCreateContacts([]);
        setCreateContactEmails({});
        setCreateContactPhones({});
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

  /* ── Visible (non-deleted) sub-collections for the form ──── */
  const visibleEmails = editEmails.filter((e) => !e._deleted);
  const visiblePhones = editPhones.filter((p) => !p._deleted);
  const visibleAddresses = editAddresses.filter((a) => !a._deleted);
  const visibleTaxIds = editTaxIds.filter((t) => !t._deleted);
  const visibleContacts = editContacts.filter((c) => !c._deleted);

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
        onClose={() => { setViewOpen(false); setViewSourceId(null); setViewTab(0); setViewContactEmails({}); setViewContactPhones({}); }}
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
            <Button size="small" color="inherit" onClick={() => { setViewOpen(false); setViewSourceId(null); setViewTab(0); setViewContactEmails({}); setViewContactPhones({}); }}>
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
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
                  {viewContacts.length === 0 && (
                    <Typography variant="body2" color="text.secondary">No vendor contacts</Typography>
                  )}
                  {viewContacts.map((c) => (
                    <Box key={c.id} sx={{ ...formGroupCardSx, gridColumn: undefined }}>
                      <Box sx={detailGridSx}>
                        <FieldRow label="First Name" value={c.first_name} />
                        <FieldRow label="Last Name" value={c.last_name} />
                        <FieldRow label="Position" value={c.position || '\u2014'} />
                        <FieldRow label="Department" value={c.department || '\u2014'} />
                        <FieldRow label="App User" value={c.is_app_user ? 'Yes' : 'No'} />
                        <FieldRow label="Roles" value={c.roles?.length ? c.roles.join(', ') : '\u2014'} />
                        <FieldRow label="Primary" value={c.is_primary ? 'Yes' : 'No'} />
                      </Box>
                      <EmailsSection emails={viewContactEmails[c.id]} />
                      <PhoneNumbersSection phones={viewContactPhones[c.id]} />
                    </Box>
                  ))}
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
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="subtitle2">Contacts</Typography>
                  <Button size="small" startIcon={<AddIcon />} onClick={addCreateContact}>Add Contact</Button>
                </Box>
                {createContacts.length === 0 && (
                  <Typography variant="body2" color="text.secondary">No contacts</Typography>
                )}
                {createContacts.map((contact, idx) => (
                  <Box key={idx} sx={{ ...formGroupCardSx, gridColumn: undefined }}>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                      <TextField
                        label="First Name"
                        value={contact.first_name}
                        onChange={(e) => updateCreateContact(idx, 'first_name', e.target.value)}
                        size="small"
                        sx={{ flex: 1, minWidth: 140 }}
                      />
                      <TextField
                        label="Last Name"
                        value={contact.last_name}
                        onChange={(e) => updateCreateContact(idx, 'last_name', e.target.value)}
                        size="small"
                        sx={{ flex: 1, minWidth: 140 }}
                      />
                      <TextField
                        label="Position"
                        value={contact.position}
                        onChange={(e) => updateCreateContact(idx, 'position', e.target.value)}
                        size="small"
                        sx={{ flex: 1, minWidth: 140 }}
                      />
                      <TextField
                        label="Department"
                        value={contact.department || ''}
                        onChange={(e) => updateCreateContact(idx, 'department', e.target.value)}
                        size="small"
                        sx={{ flex: 1, minWidth: 140 }}
                      />
                      <FormControlLabel
                        control={<Checkbox checked={contact.is_app_user || false} onChange={handleCreateVcAppUserToggle(idx)} size="small" />}
                        label="App User"
                        sx={{ mr: 0 }}
                      />
                      <Autocomplete
                        multiple
                        options={roleOptions}
                        getOptionLabel={(opt) => opt.name}
                        isOptionEqualToValue={(opt, val) => opt.code === val.code}
                        value={roleOptions.filter((r) => contact.roles?.includes(r.code))}
                        onChange={(_, v) => updateCreateContact(idx, 'roles', v.map((r) => r.code))}
                        renderInput={(params) => <TextField {...params} label="Roles" size="small" />}
                        size="small"
                        sx={{ flex: 1, minWidth: 200 }}
                      />
                      <FormControlLabel
                        control={<Checkbox checked={contact.is_primary} onChange={(e) => updateCreateContact(idx, 'is_primary', e.target.checked)} size="small" />}
                        label="Primary"
                        sx={{ mr: 0 }}
                      />
                      <IconButton size="small" onClick={() => removeCreateContact(idx)} color="error">
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Box>

                    {/* Contact Emails */}
                    <Divider sx={{ my: 1 }} />
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Typography variant="caption" color="text.secondary">Emails</Typography>
                      <Button size="small" startIcon={<AddIcon />} onClick={() => addCreateContactEmail(idx)}>Add Email</Button>
                    </Box>
                    {!(createContactEmails[idx]?.length) && (
                      <Typography variant="body2" color="text.secondary">No emails</Typography>
                    )}
                    {(createContactEmails[idx] || []).map((em, emailIdx) =>
                      renderEmailRow(
                        em,
                        emailIdx,
                        (ei, f, v) => updateCreateContactEmail(idx, ei, f, v),
                        (ei) => removeCreateContactEmail(idx, ei),
                      ),
                    )}

                    {/* Contact Phones */}
                    <Divider sx={{ my: 1 }} />
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Typography variant="caption" color="text.secondary">Phones</Typography>
                      <Button size="small" startIcon={<AddIcon />} onClick={() => addCreateContactPhone(idx)}>Add Phone</Button>
                    </Box>
                    {!(createContactPhones[idx]?.length) && (
                      <Typography variant="body2" color="text.secondary">No phones</Typography>
                    )}
                    {(createContactPhones[idx] || []).map((ph, phoneIdx) =>
                      renderPhoneRow(
                        ph,
                        phoneIdx,
                        (pi, f, v) => updateCreateContactPhone(idx, pi, f, v),
                        (pi) => removeCreateContactPhone(idx, pi),
                      ),
                    )}
                  </Box>
                ))}
              </Box>
            )}
          </DialogContent>
        </form>
      </Dialog>

      {/* ── Edit Vendor Dialog ──────────────────────────────────── */}
      <Dialog
        open={editOpen}
        onClose={() => { setEditOpen(false); setEditRow(null); setEditSourceId(null); setEditVendorId(null); setContactEmails({}); setContactPhones({}); setEditTab(0); }}
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
                onClick={() => { setEditOpen(false); setEditRow(null); setEditSourceId(null); setEditVendorId(null); setContactEmails({}); setContactPhones({}); setEditTab(0); }}
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
                  <Button size="small" startIcon={<AddIcon />} onClick={addEmail}>Add Email</Button>
                </Box>
                {visibleEmails.length === 0 && (
                  <Typography variant="body2" color="text.secondary">No emails</Typography>
                )}
                {visibleEmails.map((em) => {
                  const idx = editEmails.indexOf(em);
                  return renderEmailRow(
                    em,
                    idx,
                    (i, f, v) => updateEmail(i, f, v),
                    (i) => removeEmail(i),
                  );
                })}

                {/* ── Phone Numbers ──────────────────────────────────── */}
                <Divider />
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="subtitle2">Phone Numbers</Typography>
                  <Button size="small" startIcon={<AddIcon />} onClick={addPhone}>Add Phone</Button>
                </Box>
                {visiblePhones.length === 0 && (
                  <Typography variant="body2" color="text.secondary">No phone numbers</Typography>
                )}
                {visiblePhones.map((phone) => {
                  const idx = editPhones.indexOf(phone);
                  return renderPhoneRow(
                    phone,
                    idx,
                    (i, f, v) => updatePhone(i, f, v),
                    (i) => removePhone(i),
                  );
                })}

                {/* ── Addresses ──────────────────────────────────────── */}
                <Divider />
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="subtitle2">Addresses</Typography>
                  <Button size="small" startIcon={<AddIcon />} onClick={addAddress}>Add Address</Button>
                </Box>
                {visibleAddresses.length === 0 && (
                  <Typography variant="body2" color="text.secondary">No addresses</Typography>
                )}
                {visibleAddresses.map((addr) => {
                  const idx = editAddresses.indexOf(addr);
                  return (
                    <Box key={addr.id || idx} sx={{ ...formGroupCardSx, gridColumn: undefined }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <TextField
                          label="Label"
                          value={addr.label}
                          onChange={(e) => updateAddress(idx, 'label', e.target.value)}
                          size="small"
                          sx={{ width: 200 }}
                        />
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <FormControlLabel
                            control={<Checkbox checked={addr.is_primary} onChange={(e) => updateAddress(idx, 'is_primary', e.target.checked)} size="small" />}
                            label="Primary"
                            sx={{ mr: 0 }}
                          />
                          <IconButton size="small" onClick={() => removeAddress(idx)} color="error">
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </Box>
                      <Box sx={formGridSx}>
                        <TextField label="Address Line 1" value={addr.address_line_1} onChange={(e) => updateAddress(idx, 'address_line_1', e.target.value)} size="small" sx={formFullSpanSx} />
                        <TextField label="Address Line 2" value={addr.address_line_2} onChange={(e) => updateAddress(idx, 'address_line_2', e.target.value)} size="small" sx={formFullSpanSx} />
                        <TextField label="Address Line 3" value={addr.address_line_3 || ''} onChange={(e) => updateAddress(idx, 'address_line_3', e.target.value)} size="small" sx={formFullSpanSx} />
                        <TextField label="City" value={addr.city} onChange={(e) => updateAddress(idx, 'city', e.target.value)} size="small" />
                        <TextField label="State / Province" value={addr.state_province} onChange={(e) => updateAddress(idx, 'state_province', e.target.value)} size="small" />
                        <TextField label="Postal Code" value={addr.postal_code} onChange={(e) => updateAddress(idx, 'postal_code', e.target.value)} size="small" />
                        <TextField label="Country Code" value={addr.country_code} onChange={(e) => updateAddress(idx, 'country_code', e.target.value)} size="small" inputProps={{ maxLength: 2 }} />
                      </Box>
                    </Box>
                  );
                })}

                {/* ── Tax Identifiers ──────────────────────────────────── */}
                <Divider />
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="subtitle2">Tax Identifiers</Typography>
                  <Button size="small" startIcon={<AddIcon />} onClick={addTaxId}>Add Tax ID</Button>
                </Box>
                {visibleTaxIds.length === 0 && (
                  <Typography variant="body2" color="text.secondary">No tax identifiers</Typography>
                )}
                {visibleTaxIds.map((taxId) => {
                  const idx = editTaxIds.indexOf(taxId);
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
                            updateTaxId(idx, 'country_code', e.target.value);
                            const newTypes = TAX_TYPES[e.target.value] || TAX_TYPES._OTHER;
                            updateTaxId(idx, 'tax_type', newTypes[0]?.code || 'TIN');
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
                          onChange={(e) => updateTaxId(idx, 'tax_type', e.target.value)}
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
                          onChange={(raw) => updateTaxId(idx, 'tax_value', raw)}
                          pattern={taxTypes.find((t) => t.code === taxId.tax_type)?.placeholder}
                          size="small"
                          sx={{ flex: 1, minWidth: 160 }}
                        />
                        <FormControlLabel
                          control={<Checkbox checked={taxId.is_primary} onChange={(e) => updateTaxId(idx, 'is_primary', e.target.checked)} size="small" />}
                          label="Primary"
                          sx={{ mr: 0 }}
                        />
                        <IconButton size="small" onClick={() => removeTaxId(idx)} color="error">
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
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="subtitle2">Vendor Contacts</Typography>
                  <Button size="small" startIcon={<AddIcon />} onClick={addContact}>Add Contact</Button>
                </Box>
                {visibleContacts.length === 0 && (
                  <Typography variant="body2" color="text.secondary">No vendor contacts</Typography>
                )}
                {visibleContacts.map((contact) => {
                  const idx = editContacts.indexOf(contact);
                  const contactKey = contact.id || `_new_${idx}`;
                  const cEmails = (contactEmails[contactKey] || []).filter((e) => !e._deleted);
                  const cPhones = (contactPhones[contactKey] || []).filter((p) => !p._deleted);
                  return (
                    <Box key={contactKey} sx={{ ...formGroupCardSx, gridColumn: undefined }}>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                        <TextField
                          label="First Name"
                          value={contact.first_name}
                          onChange={(e) => updateContact(idx, 'first_name', e.target.value)}
                          size="small"
                          sx={{ flex: 1, minWidth: 140 }}
                        />
                        <TextField
                          label="Last Name"
                          value={contact.last_name}
                          onChange={(e) => updateContact(idx, 'last_name', e.target.value)}
                          size="small"
                          sx={{ flex: 1, minWidth: 140 }}
                        />
                        <TextField
                          label="Position"
                          value={contact.position}
                          onChange={(e) => updateContact(idx, 'position', e.target.value)}
                          size="small"
                          sx={{ flex: 1, minWidth: 140 }}
                        />
                        <TextField
                          label="Department"
                          value={contact.department || ''}
                          onChange={(e) => updateContact(idx, 'department', e.target.value)}
                          size="small"
                          sx={{ flex: 1, minWidth: 140 }}
                        />
                        <FormControlLabel
                          control={<Checkbox checked={contact.is_app_user || false} onChange={handleVcAppUserToggle(idx)} size="small" />}
                          label="App User"
                          sx={{ mr: 0 }}
                        />
                        {contact.is_app_user && contact.id && (
                          <IconButton size="small" title="Reset Password" onClick={() => { setResetPwTarget(contact); setResetPwOpen(true); }}>
                            <LockResetIcon fontSize="small" />
                          </IconButton>
                        )}
                        <Autocomplete
                          multiple
                          options={roleOptions}
                          getOptionLabel={(opt) => opt.name}
                          isOptionEqualToValue={(opt, val) => opt.code === val.code}
                          value={roleOptions.filter((r) => contact.roles?.includes(r.code))}
                          onChange={(_, v) => updateContact(idx, 'roles', v.map((r) => r.code))}
                          renderInput={(params) => <TextField {...params} label="Roles" size="small" />}
                          size="small"
                          sx={{ flex: 1, minWidth: 200 }}
                        />
                        <FormControlLabel
                          control={<Checkbox checked={contact.is_primary} onChange={(e) => updateContact(idx, 'is_primary', e.target.checked)} size="small" />}
                          label="Primary"
                          sx={{ mr: 0 }}
                        />
                        <IconButton size="small" onClick={() => removeContact(idx)} color="error">
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Box>

                      {/* Contact Emails */}
                      <Divider sx={{ my: 1 }} />
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary">Emails</Typography>
                        <Button size="small" startIcon={<AddIcon />} onClick={() => addContactEmail(contactKey)}>Add Email</Button>
                      </Box>
                      {cEmails.length === 0 && (
                        <Typography variant="body2" color="text.secondary">No emails</Typography>
                      )}
                      {cEmails.map((em) => {
                        const emailIdx = (contactEmails[contactKey] || []).indexOf(em);
                        return renderEmailRow(
                          em,
                          emailIdx,
                          (ei, f, v) => updateContactEmail(contactKey, ei, f, v),
                          (ei) => removeContactEmail(contactKey, ei),
                        );
                      })}

                      {/* Contact Phones */}
                      <Divider sx={{ my: 1 }} />
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary">Phones</Typography>
                        <Button size="small" startIcon={<AddIcon />} onClick={() => addContactPhone(contactKey)}>Add Phone</Button>
                      </Box>
                      {cPhones.length === 0 && (
                        <Typography variant="body2" color="text.secondary">No phones</Typography>
                      )}
                      {cPhones.map((ph) => {
                        const phoneIdx = (contactPhones[contactKey] || []).indexOf(ph);
                        return renderPhoneRow(
                          ph,
                          phoneIdx,
                          (pi, f, v) => updateContactPhone(contactKey, pi, f, v),
                          (pi) => removeContactPhone(contactKey, pi),
                        );
                      })}
                    </Box>
                  );
                })}
              </Box>
            )}
          </DialogContent>
        </form>
      </Dialog>

      <ImportDialog
        open={importOpen}
        title="Import Vendors"
        loading={importMut.isPending}
        onSubmit={handleImport}
        onCancel={() => setImportOpen(false)}
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

      <SetPasswordPopover anchorEl={vcPwAnchor} onConfirm={createTab === 1 ? handleCreateVcPwConfirm : handleVcPwConfirm} onCancel={handleVcPwCancel} />

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack.sev} variant="filled" onClose={() => setSnack((s) => ({ ...s, open: false }))}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
