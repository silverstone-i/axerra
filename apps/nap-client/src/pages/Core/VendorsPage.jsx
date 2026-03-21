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
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Autocomplete from '@mui/material/Autocomplete';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';

import StatusBadge from '../../components/shared/StatusBadge.jsx';
import ConfirmDialog from '../../components/shared/ConfirmDialog.jsx';
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
  useVendorContacts, useCreateVendorContact, useUpdateVendorContact, useArchiveVendorContact,
} from '../../hooks/useVendorContacts.js';
import { useImportXls, useExportXls } from '../../hooks/useImportExport.js';
import { useActivePaymentTerms } from '../../hooks/usePaymentTerms.js';
import { useRoles } from '../../hooks/useRoles.js';
import { TAX_TYPES, COUNTRIES, resolveLevel } from '@nap/shared';
import { vendorApi } from '../../services/vendorApi.js';
import { pageContainerSx, formGridSx, formGroupCardSx, formFullSpanSx, dialogHeaderSx, dialogActionBoxSx, detailGridSx } from '../../config/layoutTokens.js';
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

  const importMut = useImportXls(vendorApi.importXls, ['vendors']);
  const exportMut = useExportXls(vendorApi.exportXls, 'vendors');

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
      setEditContacts(contactsRes.rows);
      editInitial.current.contacts = contactsRes.rows;
    }
  }, [editOpen, contactsRes]);

  /* ── Row action callbacks ──────────────────────────────────── */
  const handleView = useCallback((row) => {
    setViewVendor(row);
    setViewSourceId(row.source_id || null);
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
      await createMut.mutateAsync(createForm);
      toast('Vendor created');
      setCreateOpen(false);
      setCreateForm(BLANK_CREATE);
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };

  const handleUpdate = async () => {
    try {
      await updateMut.mutateAsync({ filter: { id: editRow.id }, changes: editForm });

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
            const { id, source_id: _sid, created_at: _ca, updated_at: _ua, created_by: _cb, updated_by: _ub, deactivated_at: _da, ...changes } = a;
            await updateAddrMut.mutateAsync({ filter: { id }, changes });
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
          await createContactMut.mutateAsync({
            vendor_id: editRow.id, first_name: c.first_name, last_name: c.last_name,
            position: c.position, department: c.department, is_app_user: c.is_app_user,
            roles: c.roles, is_primary: c.is_primary,
          });
        } else if (c.id && !c._deleted) {
          await updateContactMut.mutateAsync({
            filter: { id: c.id },
            changes: {
              first_name: c.first_name, last_name: c.last_name, position: c.position,
              department: c.department, is_app_user: c.is_app_user, roles: c.roles, is_primary: c.is_primary,
            },
          });
        }
      }

      toast('Vendor updated');
      setEditOpen(false);
      setEditRow(null);
      setEditSourceId(null);
      setEditVendorId(null);
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
      onClick: () => { setCreateForm(BLANK_CREATE); setCreateOpen(true); },
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
      <Dialog open={viewOpen} onClose={() => { setViewOpen(false); setViewSourceId(null); }} maxWidth="sm" fullWidth>
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
            <Button size="small" color="inherit" onClick={() => { setViewOpen(false); setViewSourceId(null); }}>
              Close
            </Button>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {viewVendor && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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

              {/* ── Vendor Contacts ───────────────────────────── */}
              {viewContacts.length > 0 && (
                <>
                  <Divider />
                  <Typography variant="subtitle2" color="text.secondary">Vendor Contacts</Typography>
                  {viewContacts.map((c) => (
                    <Box key={c.id} sx={detailGridSx}>
                      <FieldRow label="First Name" value={c.first_name} />
                      <FieldRow label="Last Name" value={c.last_name} />
                      <FieldRow label="Position" value={c.position || '\u2014'} />
                      <FieldRow label="Department" value={c.department || '\u2014'} />
                      <FieldRow label="App User" value={c.is_app_user ? 'Yes' : 'No'} />
                      <FieldRow label="Roles" value={c.roles?.length ? c.roles.join(', ') : '\u2014'} />
                      <FieldRow label="Primary" value={c.is_primary ? 'Yes' : 'No'} />
                    </Box>
                  ))}
                </>
              )}
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Create Vendor Dialog ─────────────────────────────────── */}
      <FormDialog open={createOpen} title="Create Vendor" submitLabel="Create" loading={createMut.isPending} onSubmit={handleCreate} onCancel={() => setCreateOpen(false)}>
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
      </FormDialog>

      {/* ── Edit Vendor Dialog ──────────────────────────────────── */}
      <FormDialog open={editOpen} title="Edit Vendor" submitLabel="Save Changes" maxWidth="md" loading={updateMut.isPending} submitDisabled={!hasEditChanges} onSubmit={handleUpdate} onCancel={() => { setEditOpen(false); setEditRow(null); setEditSourceId(null); setEditVendorId(null); }}>
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
          return (
            <Box key={em.id || idx} sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              <TextField
                label="Email"
                type="email"
                value={em.email}
                onChange={(e) => updateEmail(idx, 'email', e.target.value)}
                size="small"
                sx={{ flex: 1, minWidth: 200 }}
              />
              <TextField
                select
                label="Label"
                value={em.label}
                onChange={(e) => updateEmail(idx, 'label', e.target.value)}
                size="small"
                sx={{ minWidth: 120 }}
              >
                {EMAIL_LABELS.map((l) => (
                  <MenuItem key={l} value={l}>{cap(l)}</MenuItem>
                ))}
              </TextField>
              <FormControlLabel
                control={<Checkbox checked={em.is_primary} onChange={(e) => updateEmail(idx, 'is_primary', e.target.checked)} size="small" />}
                label="Primary"
                sx={{ mr: 0 }}
              />
              <IconButton size="small" onClick={() => removeEmail(idx)} color="error">
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Box>
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
          const countryCode = phone.country_code?.trim() || 'US';
          const country = COUNTRIES.find((c) => c.code === countryCode);
          return (
            <Box key={phone.id || idx} sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              <TextField
                select
                label="Type"
                value={phone.phone_type}
                onChange={(e) => updatePhone(idx, 'phone_type', e.target.value)}
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
                onChange={(e) => updatePhone(idx, 'country_code', e.target.value)}
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
                onChange={(raw) => updatePhone(idx, 'phone_number', raw)}
                pattern={country?.placeholder}
                size="small"
                sx={{ flex: 1, minWidth: 160 }}
              />
              <FormControlLabel
                control={<Checkbox checked={phone.is_primary} onChange={(e) => updatePhone(idx, 'is_primary', e.target.checked)} size="small" />}
                label="Primary"
                sx={{ mr: 0 }}
              />
              <IconButton size="small" onClick={() => removePhone(idx)} color="error">
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Box>
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

        {/* ── Vendor Contacts ──────────────────────────────────── */}
        <Divider />
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle2">Vendor Contacts</Typography>
          <Button size="small" startIcon={<AddIcon />} onClick={addContact}>Add Contact</Button>
        </Box>
        {visibleContacts.length === 0 && (
          <Typography variant="body2" color="text.secondary">No vendor contacts</Typography>
        )}
        {visibleContacts.map((contact) => {
          const idx = editContacts.indexOf(contact);
          return (
            <Box key={contact.id || idx} sx={{ ...formGroupCardSx, gridColumn: undefined }}>
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
                  control={<Checkbox checked={contact.is_app_user || false} onChange={(e) => updateContact(idx, 'is_app_user', e.target.checked)} size="small" />}
                  label="App User"
                  sx={{ mr: 0 }}
                />
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
            </Box>
          );
        })}
      </FormDialog>

      <ImportDialog
        open={importOpen}
        title="Import Vendors"
        loading={importMut.isPending}
        onSubmit={handleImport}
        onCancel={() => setImportOpen(false)}
      />

      <ConfirmDialog {...archiveConfirmProps} />
      <ConfirmDialog {...restoreConfirmProps} />

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack.sev} variant="filled" onClose={() => setSnack((s) => ({ ...s, open: false }))}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
