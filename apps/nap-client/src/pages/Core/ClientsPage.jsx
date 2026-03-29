/**
 * @file Clients CRUD page — DataTable + create/edit/view/archive/restore
 * @module nap-client/pages/Core/ClientsPage
 *
 * Migrated to standardised list-view selection system:
 *   useListSelection + DataTable + RowActionsMenu
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useDialogState } from '../../hooks/useDialogState.js';
import { useFormState } from '../../hooks/useFormState.js';
import { useCollectionState } from '../../hooks/useCollectionState.js';
import { saveCollection } from '../../utils/saveCollection.js';
import { useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import ToastSnackbar from '../../components/shared/ToastSnackbar.jsx';
import { useToast } from '../../hooks/useToast.js';
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
  useClients, useCreateClient, useUpdateClient, useArchiveClient, useRestoreClient, useResetClientPassword,
} from '../../hooks/useClients.js';
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
import { useImportXls, useExportXls } from '../../hooks/useImportExport.js';
import { useRoles } from '../../hooks/useRoles.js';
import { TAX_TYPES, COUNTRIES, resolveLevel } from '@nap/shared';
import { cap, fmtDate, errMsg } from '../../utils/format.js';
import { BLANK_EMAIL, BLANK_PHONE, BLANK_ADDRESS, BLANK_TAX_ID, PHONE_TYPES, EMAIL_LABELS } from '../../utils/formConstants.js';
import { clientApi } from '../../services/clientApi.js';
import { pageContainerSx, formGridSx, formGroupCardSx, formFullSpanSx, dialogHeaderSx, dialogActionBoxSx, detailGridSx } from '../../config/layoutTokens.js';
import { useListSelection } from '../../hooks/useListSelection.js';
import { useArchiveRestore } from '../../hooks/useArchiveRestore.js';

const BLANK_CREATE = { name: '', code: '', is_active: true, is_app_user: false, roles: [] };
const BLANK_EDIT = { name: '', code: '', is_active: true, is_app_user: false, roles: [] };


const columns = [
  { field: 'code', headerName: 'Code', width: 120 },
  { field: 'name', headerName: 'Client Name', flex: 1, minWidth: 200 },
  {
    field: 'is_active',
    headerName: 'Active',
    width: 100,
    renderCell: ({ value }) => <StatusBadge status={value ? 'active' : 'suspended'} />,
  },
];

export default function ClientsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const caps = user?.perms?.caps || {};
  const canImport = resolveLevel(caps, 'core', 'clients', 'import') === 'full';
  const canExport = resolveLevel(caps, 'core', 'clients', 'export') !== 'none';

  const { data: rolesRes } = useRoles();
  const roleOptions = rolesRes?.rows ?? [];

  const { data: res, isLoading } = useClients();
  const allRows = res?.rows ?? [];

  const [viewFilter, setViewFilter] = useState('active');
  const rows = useMemo(() => {
    if (viewFilter === 'active') return allRows.filter((r) => !r.deactivated_at);
    if (viewFilter === 'archived') return allRows.filter((r) => !!r.deactivated_at);
    return allRows;
  }, [allRows, viewFilter]);

  const createMut = useCreateClient();
  const updateMut = useUpdateClient();
  const archiveMut = useArchiveClient();
  const restoreMut = useRestoreClient();
  const resetPwMut = useResetClientPassword();

  const importMut = useImportXls(clientApi.importXls, ['clients'], [['nap-users']]);
  const exportMut = useExportXls(clientApi.exportXls, 'clients');

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

  /* ── Selection (new system) ─────────────────────────────────── */
  const selection = useListSelection(rows);
  const { selectedRows, allActive, allArchived } = selection;

  /* ── Dialog state ───────────────────────────────────────────── */
  const importDialog = useDialogState();
  const [importErrors, setImportErrors] = useState(null);
  const viewDialog = useDialogState();
  const [viewSourceId, setViewSourceId] = useState(null);
  const createDialog = useDialogState();
  const editDialog = useDialogState();
  const resetPwDialog = useDialogState();

  const [editSourceId, setEditSourceId] = useState(null);
  const { data: emailsRes } = useEmails({ source_id: editSourceId, includeDeactivated: 'false' }, { enabled: !!editSourceId });
  const { data: phonesRes } = usePhoneNumbers({ source_id: editSourceId, includeDeactivated: 'false' }, { enabled: !!editSourceId });
  const { data: addressesRes } = useAddresses({ source_id: editSourceId, includeDeactivated: 'false' }, { enabled: !!editSourceId });
  const { data: taxIdsRes } = useTaxIdentifiers({ source_id: editSourceId, includeDeactivated: 'false' }, { enabled: !!editSourceId });

  // View dialog child data
  const { data: viewEmailsRes } = useEmails({ source_id: viewSourceId, includeDeactivated: 'false' }, { enabled: !!viewSourceId });
  const { data: viewPhonesRes } = usePhoneNumbers({ source_id: viewSourceId, includeDeactivated: 'false' }, { enabled: !!viewSourceId });
  const { data: viewAddressesRes } = useAddresses({ source_id: viewSourceId, includeDeactivated: 'false' }, { enabled: !!viewSourceId });
  const { data: viewTaxIdsRes } = useTaxIdentifiers({ source_id: viewSourceId, includeDeactivated: 'false' }, { enabled: !!viewSourceId });
  const viewEmails = viewEmailsRes?.rows ?? [];
  const viewPhones = viewPhonesRes?.rows ?? [];
  const viewAddresses = viewAddressesRes?.rows ?? [];
  const viewTaxIds = viewTaxIdsRes?.rows ?? [];

  const { form: createForm, setForm: setCreateForm, field: onCreateField, reset: resetCreateForm } = useFormState(BLANK_CREATE);
  const { form: editForm, setForm: setEditForm, field: onEditField } = useFormState(BLANK_EDIT);
  const emails = useCollectionState([], { blank: BLANK_EMAIL, autoPrimary: 'is_primary', exclusive: ['is_primary'] });
  const phones = useCollectionState([], { blank: BLANK_PHONE, autoPrimary: 'is_primary', exclusive: ['is_primary'] });
  const addresses = useCollectionState([], { blank: BLANK_ADDRESS });
  const taxIds = useCollectionState([], { blank: BLANK_TAX_ID });
  const editInitial = useRef({ form: null, emails: null, phones: null, addresses: null, taxIds: null });

  const { toast, snackProps } = useToast();


  /* ── App-user password popover state ────────────────────────── */
  const [pwAnchor, setPwAnchor] = useState(null);
  const [pwTarget, setPwTarget] = useState(null); // 'create' | 'edit'

  const handleAppUserToggle = (target, setForm) => (e) => {
    if (e.target.checked) {
      setPwTarget(target);
      setPwAnchor(e.currentTarget);
    } else {
      setForm((p) => ({ ...p, is_app_user: false, password: '' }));
    }
  };

  const handlePwConfirm = (password) => {
    const setForm = pwTarget === 'create' ? setCreateForm : setEditForm;
    setForm((p) => ({ ...p, is_app_user: true, password }));
    setPwAnchor(null);
    setPwTarget(null);
  };

  const handlePwCancel = () => {
    setPwAnchor(null);
    setPwTarget(null);
  };

  /* ── Sync query-fetched sub-collections into edit state ────── */
  useEffect(() => {
    if (editDialog.isOpen && emailsRes?.rows) {
      emails.reset(emailsRes.rows);
      editInitial.current.emails = emailsRes.rows;
    }
  }, [editDialog.isOpen, emailsRes]);

  useEffect(() => {
    if (editDialog.isOpen && phonesRes?.rows) {
      phones.reset(phonesRes.rows);
      editInitial.current.phones = phonesRes.rows;
    }
  }, [editDialog.isOpen, phonesRes]);

  useEffect(() => {
    if (editDialog.isOpen && addressesRes?.rows) {
      addresses.reset(addressesRes.rows);
      editInitial.current.addresses = addressesRes.rows;
    }
  }, [editDialog.isOpen, addressesRes]);

  useEffect(() => {
    if (editDialog.isOpen && taxIdsRes?.rows) {
      taxIds.reset(taxIdsRes.rows);
      editInitial.current.taxIds = taxIdsRes.rows;
    }
  }, [editDialog.isOpen, taxIdsRes]);

  /* ── Row action callbacks ──────────────────────────────────── */
  const handleView = useCallback((row) => {
    viewDialog.open(row);
    setViewSourceId(row.source_id || null);
  }, []);

  const handleEdit = useCallback((row) => {
    const form = { name: row.name ?? '', code: row.code ?? '', is_active: row.is_active ?? true, is_app_user: row.is_app_user ?? false, roles: row.roles ?? [] };
    setEditForm(form);
    editInitial.current.form = form;

    setEditSourceId(row.source_id || null);
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

    editDialog.open(row);
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
    if (collectionChanged(emails.items, init.emails, ['email', 'label', 'is_primary'])) return true;
    if (collectionChanged(phones.items, init.phones, ['country_code', 'phone_type', 'phone_number', 'is_primary'])) return true;
    if (collectionChanged(addresses.items, init.addresses, ['label', 'address_line_1', 'address_line_2', 'address_line_3', 'city', 'state_province', 'postal_code', 'country_code'])) return true;
    if (collectionChanged(taxIds.items, init.taxIds, ['country_code', 'tax_type', 'tax_value'])) return true;
    return false;
  }, [editForm, emails.items, phones.items, addresses.items, taxIds.items]);

  const handleCreate = async () => {
    try {
      await createMut.mutateAsync(createForm);
      toast('Client created');
      createDialog.close();
      resetCreateForm();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };

  const handleUpdate = async () => {
    try {
      // When toggling is_app_user on, include the selected login email in the
      // client update payload so the backend can provision before email mutations run
      const changes = { ...editForm };
      if (changes.is_app_user && !editDialog.data.is_app_user) {
        const loginEm = emails.items.find((em) => em.is_login && !em._deleted)
          || emails.items.find((em) => em.is_primary && !em._deleted)
          || emails.items.find((em) => !em._deleted);
        if (loginEm) changes.email = loginEm.email;
      }
      await updateMut.mutateAsync({ filter: { id: editDialog.data.id }, changes });

      const sid = editDialog.data.source_id;
      if (sid) {
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

      await qc.invalidateQueries({ queryKey: ['clients'] });
      if (editForm.is_app_user !== editDialog.data.is_app_user) {
        qc.invalidateQueries({ queryKey: ['nap-users'] });
      }
      toast('Client updated');
      editDialog.close();
      setEditSourceId(null);
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };

  const handleImport = useCallback(async (formData) => {
    setImportErrors(null);
    try {
      const result = await importMut.mutateAsync(formData);
      toast(`Imported ${result.inserted} records`);
      importDialog.close();
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
    entityName: 'client',
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
        onClick: () => importDialog.open(),
      });
    }

    primary.push({
      label: 'Create Client',
      variant: 'contained',
      color: 'primary',
      onClick: () => { resetCreateForm(); createDialog.open(); },
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
      <Dialog open={viewDialog.isOpen} onClose={() => { viewDialog.close(); setViewSourceId(null); }} maxWidth="sm" fullWidth>
        <DialogTitle sx={dialogHeaderSx}>
          <Box>
            <span>Client Details</span>
            {viewDialog.data && (
              <Typography variant="body2" color="text.secondary">
                {viewDialog.data.name}
              </Typography>
            )}
          </Box>
          <Box sx={dialogActionBoxSx}>
            <Button size="small" color="inherit" onClick={() => { viewDialog.close(); setViewSourceId(null); }}>
              Close
            </Button>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {viewDialog.data && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={detailGridSx}>
                <FieldRow label="Code" value={viewDialog.data.code || '\u2014'} />
                <FieldRow label="Name" value={viewDialog.data.name} />
                <FieldRow label="Active" value={viewDialog.data.is_active ? 'Yes' : 'No'} />
                <FieldRow label="App User" value={viewDialog.data.is_app_user ? 'Yes' : 'No'} />
                <FieldRow label="Roles" value={viewDialog.data.roles?.length ? viewDialog.data.roles.join(', ') : '\u2014'} />
                <FieldRow label="Status">
                  <StatusBadge status={viewDialog.data.deactivated_at ? 'archived' : 'active'} />
                </FieldRow>
                <FieldRow label="Created" value={fmtDate(viewDialog.data.created_at)} />
                <FieldRow label="Updated" value={fmtDate(viewDialog.data.updated_at)} />
              </Box>

              <EmailsSection emails={viewEmails} />
              <PhoneNumbersSection phones={viewPhones} />
              <AddressesSection addresses={viewAddresses} />
              <TaxIdentifiersSection taxIds={viewTaxIds} />
            </Box>
          )}
        </DialogContent>
      </Dialog>

      <FormDialog open={createDialog.isOpen} title="Create Client" submitLabel="Create" loading={createMut.isPending} onSubmit={handleCreate} onCancel={createDialog.close}>
        <TextField label="Client Name" required value={createForm.name} onChange={onCreateField('name')} />
        <TextField label="Code" value={createForm.code} onChange={onCreateField('code')} inputProps={{ maxLength: 16 }} />
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
        <FormControlLabel
          control={<Checkbox checked={createForm.is_app_user} onChange={handleAppUserToggle('create', setCreateForm)} size="small" />}
          label="App User (creates login account)"
        />
        {createForm.is_app_user && (
          <TextField label="Email" required value={createForm.email || ''} onChange={onCreateField('email')} />
        )}
        <Autocomplete
          multiple
          options={roleOptions}
          getOptionLabel={(opt) => opt.name}
          isOptionEqualToValue={(opt, val) => opt.code === val.code}
          value={roleOptions.filter((r) => createForm.roles.includes(r.code))}
          onChange={(_, v) => setCreateForm((p) => ({ ...p, roles: v.map((r) => r.code) }))}
          renderInput={(params) => <TextField {...params} label="Roles" />}
        />
      </FormDialog>

      {/* ── Edit Client Dialog ─────────────────────────────────── */}
      <FormDialog open={editDialog.isOpen} title="Edit Client" submitLabel="Save Changes" maxWidth="md" loading={updateMut.isPending} submitDisabled={!hasEditChanges} onSubmit={handleUpdate} onCancel={() => { editDialog.close(); setEditSourceId(null); }}>
        <Box sx={formGridSx}>
          <TextField label="Client Name" required value={editForm.name} onChange={onEditField('name')} />
          <TextField label="Code" value={editForm.code} onChange={onEditField('code')} inputProps={{ maxLength: 16 }} />
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
          <FormControlLabel
            control={<Checkbox checked={editForm.is_app_user} onChange={handleAppUserToggle('edit', setEditForm)} size="small" />}
            label="App User (creates login account)"
          />
          {editForm.is_app_user && editDialog.data?.is_app_user && (
            <Button size="small" startIcon={<LockResetIcon />} onClick={() => resetPwDialog.open(editDialog.data)}>
              Reset Password
            </Button>
          )}
          <Autocomplete
            multiple
            options={roleOptions}
            getOptionLabel={(opt) => opt.name}
            isOptionEqualToValue={(opt, val) => opt.code === val.code}
            value={roleOptions.filter((r) => editForm.roles.includes(r.code))}
            onChange={(_, v) => setEditForm((p) => ({ ...p, roles: v.map((r) => r.code) }))}
            renderInput={(params) => <TextField {...params} label="Roles" />}
            sx={formFullSpanSx}
          />
        </Box>

        {/* ── Emails ────────────────────────────────────────────── */}
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
          return (
            <Box key={em.id || idx} sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              <TextField
                label="Email"
                type="email"
                value={em.email}
                onChange={(e) => emails.update(idx, 'email', e.target.value)}
                size="small"
                sx={{ flex: 1, minWidth: 200 }}
              />
              <TextField
                select
                label="Label"
                value={em.label}
                onChange={(e) => emails.update(idx, 'label', e.target.value)}
                sx={{ minWidth: 120 }}
                size="small"
              >
                {EMAIL_LABELS.map((l) => (
                  <MenuItem key={l} value={l}>{cap(l)}</MenuItem>
                ))}
              </TextField>
              <FormControlLabel
                control={<Checkbox checked={em.is_primary} onChange={(e) => emails.update(idx, 'is_primary', e.target.checked)} size="small" />}
                label="Primary"
                sx={{ mr: 0 }}
              />
              <IconButton size="small" onClick={() => emails.remove(idx)} color="error">
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Box>
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
          const countryCode = phone.country_code?.trim() || 'US';
          const country = COUNTRIES.find((c) => c.code === countryCode);
          return (
            <Box key={phone.id || idx} sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              <TextField
                select
                label="Type"
                value={phone.phone_type}
                onChange={(e) => phones.update(idx, 'phone_type', e.target.value)}
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
                onChange={(e) => phones.update(idx, 'country_code', e.target.value)}
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
                onChange={(raw) => phones.update(idx, 'phone_number', raw)}
                pattern={country?.placeholder}
                size="small"
                sx={{ flex: 1, minWidth: 160 }}
              />
              <FormControlLabel
                control={<Checkbox checked={phone.is_primary} onChange={(e) => phones.update(idx, 'is_primary', e.target.checked)} size="small" />}
                label="Primary"
                sx={{ mr: 0 }}
              />
              <IconButton size="small" onClick={() => phones.remove(idx)} color="error">
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Box>
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
      </FormDialog>

      <ImportDialog
        open={importDialog.isOpen}
        title="Import Clients"
        loading={importMut.isPending}
        errors={importErrors}
        onSubmit={handleImport}
        onCancel={() => { importDialog.close(); setImportErrors(null); }}
      />

      <ConfirmDialog {...archiveConfirmProps} />
      <ConfirmDialog {...restoreConfirmProps} />

      <ResetPasswordDialog
        open={resetPwDialog.isOpen}
        onClose={resetPwDialog.close}
        onSuccess={() => { resetPwDialog.close(); toast('Password reset successfully'); }}
        onReset={(id, password) => resetPwMut.mutateAsync({ id, password })}
        entityId={resetPwDialog.data?.id}
        entityName={resetPwDialog.data?.name || ''}
      />

      <SetPasswordPopover anchorEl={pwAnchor} onConfirm={handlePwConfirm} onCancel={handlePwCancel} />

      <ToastSnackbar {...snackProps} />
    </Box>
  );
}
