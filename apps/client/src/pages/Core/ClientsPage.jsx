/**
 * @file Clients CRUD page — coordinator component
 * @module client/pages/Core/ClientsPage
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import { useState, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useDialogState } from '../../hooks/useDialogState.js';
import { useFormState } from '../../hooks/useFormState.js';
import Box from '@mui/material/Box';
import Autocomplete from '@mui/material/Autocomplete';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import TextField from '@mui/material/TextField';

import ConfirmDialog from '../../components/shared/ConfirmDialog.jsx';
import ResetPasswordDialog from '../../components/shared/ResetPasswordDialog.jsx';
import SetPasswordPopover from '../../components/shared/SetPasswordPopover.jsx';
import DataTable from '../../components/shared/DataTable.jsx';
import FormDialog from '../../components/shared/FormDialog.jsx';
import ImportDialog from '../../components/shared/ImportDialog.jsx';
import ToastSnackbar from '../../components/shared/ToastSnackbar.jsx';
import { useModuleToolbarRegistration } from '../../contexts/ModuleActionsContext.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import {
  useClients, useCreateClient, useUpdateClient, useArchiveClient, useRestoreClient, useResetClientPassword,
} from '../../hooks/useClients.js';
import {
  useCreateEmail, useUpdateEmail, useArchiveEmail,
} from '../../hooks/useEmails.js';
import {
  useCreatePhoneNumber, useUpdatePhoneNumber, useArchivePhoneNumber,
} from '../../hooks/usePhoneNumbers.js';
import {
  useCreateAddress, useUpdateAddress, useArchiveAddress,
} from '../../hooks/useAddresses.js';
import {
  useCreateTaxIdentifier, useUpdateTaxIdentifier, useArchiveTaxIdentifier,
} from '../../hooks/useTaxIdentifiers.js';
import { useEmails } from '../../hooks/useEmails.js';
import { usePhoneNumbers } from '../../hooks/usePhoneNumbers.js';
import { useAddresses } from '../../hooks/useAddresses.js';
import { useTaxIdentifiers } from '../../hooks/useTaxIdentifiers.js';
import { useImportXls, useExportXls } from '../../hooks/useImportExport.js';
import { useRoles } from '../../hooks/useRoles.js';
import { resolveLevel } from '@axerra/shared';
import { useToast } from '../../hooks/useToast.js';
import { errMsg } from '../../utils/format.js';
import { statusColumn } from '../../utils/columnHelpers.jsx';
import { clientApi } from '../../services/clientApi.js';
import { pageContainerSx } from '../../config/layoutTokens.js';
import { useListSelection } from '../../hooks/useListSelection.js';
import { useArchiveRestore } from '../../hooks/useArchiveRestore.js';

import ClientViewDialog from './clients/ClientViewDialog.jsx';
import ClientEditDialog from './clients/ClientEditDialog.jsx';
import { useClientEditCollections } from './clients/useClientEditCollections.jsx';

const BLANK_CREATE = { name: '', code: '', is_active: true, is_app_user: false, roles: [] };
const BLANK_EDIT = { name: '', code: '', is_active: true, is_app_user: false, roles: [] };

const columns = [
  { field: 'code', headerName: 'Code', width: 120 },
  { field: 'name', headerName: 'Client Name', flex: 1, minWidth: 200 },
  statusColumn('is_active', 'Active', { width: 100, map: (v) => v ? 'active' : 'suspended' }),
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

  const importMut = useImportXls(clientApi.importXls, ['clients'], [['portal-users']]);
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

  /* ── Selection ─────────────────────────────────────────────── */
  const selection = useListSelection(rows);
  const { selectedRows, allActive, allArchived } = selection;

  /* ── Dialog state ───────────────────────────────────────────── */
  const importDialog = useDialogState();
  const [importErrors, setImportErrors] = useState(null);
  const viewDialog = useDialogState();
  const createDialog = useDialogState();
  const editDialog = useDialogState();
  const resetPwDialog = useDialogState();

  const { form: createForm, setForm: setCreateForm, field: onCreateField, reset: resetCreateForm } = useFormState(BLANK_CREATE);
  const { form: editForm, setForm: setEditForm, field: onEditField } = useFormState(BLANK_EDIT);
  const { toast, snackProps } = useToast();

  // View dialog child data
  const viewSourceId = viewDialog.data?.source_id;
  const { data: viewEmailsRes } = useEmails({ source_id: viewSourceId, includeDeactivated: 'false' }, { enabled: !!viewSourceId });
  const { data: viewPhonesRes } = usePhoneNumbers({ source_id: viewSourceId, includeDeactivated: 'false' }, { enabled: !!viewSourceId });
  const { data: viewAddressesRes } = useAddresses({ source_id: viewSourceId, includeDeactivated: 'false' }, { enabled: !!viewSourceId });
  const { data: viewTaxIdsRes } = useTaxIdentifiers({ source_id: viewSourceId, includeDeactivated: 'false' }, { enabled: !!viewSourceId });

  const {
    emails, phones, addresses, taxIds,
    hasEditChanges, handleUpdate,
    openEditSession, closeEditSession,
  } = useClientEditCollections({
    editOpen: editDialog.isOpen,
    editRow: editDialog.data,
    editForm,
    updateMut,
    toast,
    qc,
    emailMuts: { create: createEmailMut, update: updateEmailMut, archive: archiveEmailMut },
    phoneMuts: { create: createPhoneMut, update: updatePhoneMut, archive: archivePhoneMut },
    addressMuts: { create: createAddrMut, update: updateAddrMut, archive: archiveAddrMut },
    taxIdMuts: { create: createTaxIdMut, update: updateTaxIdMut, archive: archiveTaxIdMut },
  });

  /* ── App-user password popover ─────────────────────────────── */
  const [pwAnchor, setPwAnchor] = useState(null);
  const [pwTarget, setPwTarget] = useState(null);

  const handleAppUserToggle = useCallback((target, setForm) => (e) => {
    if (e.target.checked) {
      setPwTarget(target);
      setPwAnchor(e.currentTarget);
    } else {
      setForm((p) => ({ ...p, is_app_user: false, password: '' }));
    }
  }, []);

  const handlePwConfirm = useCallback((password) => {
    const setForm = pwTarget === 'create' ? setCreateForm : setEditForm;
    setForm((p) => ({ ...p, is_app_user: true, password }));
    setPwAnchor(null);
    setPwTarget(null);
  }, [pwTarget, setCreateForm, setEditForm]);

  const handlePwCancel = useCallback(() => {
    setPwAnchor(null);
    setPwTarget(null);
  }, []);

  /* ── Row action callbacks ──────────────────────────────────── */
  const handleView = useCallback((row) => viewDialog.open(row), [viewDialog.open]);

  const handleEdit = useCallback((row) => {
    openEditSession(row, setEditForm);
    editDialog.open(row);
  }, [openEditSession, editDialog.open]);

  const handleEditClose = useCallback(() => {
    editDialog.close();
    closeEditSession();
  }, [editDialog.close, closeEditSession]);

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

  const handleImport = useCallback(async (formData) => {
    setImportErrors(null);
    try {
      const result = await importMut.mutateAsync(formData);
      const inserted = result.inserted || 0;
      const updated = result.updated || 0;
      const restored = result.restored || 0;
      // Child-only edits leave parent counts at zero — see comment in
      // EmployeesPage.handleImport for rationale.
      const childInserted = result.childInserted || 0;
      const childUpdated = result.childUpdated || 0;
      const anyWrite = inserted || updated || restored || childInserted || childUpdated;
      if (!anyWrite) {
        toast('Import complete — no changes');
      } else {
        const parts = [`${inserted} new`, `${updated} updated`];
        if (restored > 0) parts.push(`${restored} restored`);
        toast(`Clients: ${parts.join(', ')}`);
      }
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

  /* ── ModuleBar ─────────────────────────────────────────────── */
  const toolbar = useMemo(() => {
    const primary = [];

    if (viewFilter === 'active' || viewFilter === 'all') {
      primary.push({
        label: selectedRows.length > 1 ? `Archive (${selectedRows.length})` : 'Archive',
        variant: 'outlined',
        disabled: selectedRows.length === 0 || !allActive,
        onClick: () => setArchiveOpen(true),
      });
    }
    if (viewFilter === 'archived' || viewFilter === 'all') {
      primary.push({
        label: selectedRows.length > 1 ? `Restore (${selectedRows.length})` : 'Restore',
        variant: 'outlined',
        disabled: selectedRows.length === 0 || !allArchived,
        onClick: () => setRestoreOpen(true),
      });
    }

    if (canExport) primary.push({ label: 'Export', variant: 'outlined', disabled: exportMut.isPending, onClick: handleExport });
    if (canImport) primary.push({ label: 'Import', variant: 'outlined', onClick: () => importDialog.open() });

    primary.push({
      label: 'Create Client', variant: 'contained',
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
      <DataTable rows={rows} columns={columns} loading={isLoading} selection={selection} onView={handleView} onEdit={handleEdit} />

      <ClientViewDialog
        open={viewDialog.isOpen}
        onClose={viewDialog.close}
        client={viewDialog.data}
        viewEmails={viewEmailsRes?.rows ?? []}
        viewPhones={viewPhonesRes?.rows ?? []}
        viewAddresses={viewAddressesRes?.rows ?? []}
        viewTaxIds={viewTaxIdsRes?.rows ?? []}
      />

      <FormDialog open={createDialog.isOpen} title="Create Client" submitLabel="Create" loading={createMut.isPending} onSubmit={handleCreate} onCancel={createDialog.close}>
        <TextField label="Client Name" required value={createForm.name} onChange={onCreateField('name')} />
        <TextField label="Code" value={createForm.code} onChange={onCreateField('code')} inputProps={{ maxLength: 16 }} />
        <FormControlLabel
          control={<Checkbox checked={createForm.is_active} onChange={(e) => setCreateForm((p) => ({ ...p, is_active: e.target.checked }))} size="small" />}
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
          multiple options={roleOptions} getOptionLabel={(opt) => opt.name}
          isOptionEqualToValue={(opt, val) => opt.code === val.code}
          value={roleOptions.filter((r) => createForm.roles.includes(r.code))}
          onChange={(_, v) => setCreateForm((p) => ({ ...p, roles: v.map((r) => r.code) }))}
          renderInput={(params) => <TextField {...params} label="Roles" />}
        />
      </FormDialog>

      <ClientEditDialog
        open={editDialog.isOpen}
        onClose={handleEditClose}
        editForm={editForm}
        onEditField={onEditField}
        setEditForm={setEditForm}
        editRow={editDialog.data}
        emails={emails}
        phones={phones}
        addresses={addresses}
        taxIds={taxIds}
        roleOptions={roleOptions}
        hasEditChanges={hasEditChanges}
        onSubmit={async () => { if (await handleUpdate()) handleEditClose(); }}
        loading={updateMut.isPending}
        onResetPassword={() => resetPwDialog.open(editDialog.data)}
        onAppUserToggle={handleAppUserToggle('edit', setEditForm)}
      />

      <ImportDialog
        open={importDialog.isOpen} title="Import Clients" loading={importMut.isPending}
        errors={importErrors}
        onPreview={(fd) => clientApi.importXls(fd, { preview: true })}
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
