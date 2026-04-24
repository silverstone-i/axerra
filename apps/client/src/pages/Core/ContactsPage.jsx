/**
 * @file Contacts CRUD page — coordinator component
 * @module client/pages/Core/ContactsPage
 *
 * Contacts are standalone miscellaneous payees (dual-purpose: AP and AR).
 * Child data (emails, phones, addresses, tax IDs) linked via polymorphic sources pattern.
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import { useState, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useDialogState } from '../../hooks/useDialogState.js';
import { useFormState } from '../../hooks/useFormState.js';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import TextField from '@mui/material/TextField';

import ConfirmDialog from '../../components/shared/ConfirmDialog.jsx';
import DataTable from '../../components/shared/DataTable.jsx';
import FormDialog from '../../components/shared/FormDialog.jsx';
import ImportDialog from '../../components/shared/ImportDialog.jsx';
import ToastSnackbar from '../../components/shared/ToastSnackbar.jsx';
import { useModuleToolbarRegistration } from '../../contexts/ModuleActionsContext.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import {
  useContacts, useCreateContact, useUpdateContact, useArchiveContact, useRestoreContact,
} from '../../hooks/useContacts.js';
import { useCreateEmail, useUpdateEmail, useArchiveEmail } from '../../hooks/useEmails.js';
import { useCreatePhoneNumber, useUpdatePhoneNumber, useArchivePhoneNumber } from '../../hooks/usePhoneNumbers.js';
import { useCreateAddress, useUpdateAddress, useArchiveAddress } from '../../hooks/useAddresses.js';
import { useCreateTaxIdentifier, useUpdateTaxIdentifier, useArchiveTaxIdentifier } from '../../hooks/useTaxIdentifiers.js';
import { useEmails } from '../../hooks/useEmails.js';
import { usePhoneNumbers } from '../../hooks/usePhoneNumbers.js';
import { useAddresses } from '../../hooks/useAddresses.js';
import { useTaxIdentifiers } from '../../hooks/useTaxIdentifiers.js';
import { useImportXls, useExportXls } from '../../hooks/useImportExport.js';
import { resolveLevel } from '@vimber/shared';
import { useToast } from '../../hooks/useToast.js';
import { errMsg } from '../../utils/format.js';
import { statusColumn } from '../../utils/columnHelpers.jsx';
import { contactApi } from '../../services/contactApi.js';
import { pageContainerSx } from '../../config/layoutTokens.js';
import { useListSelection } from '../../hooks/useListSelection.js';
import { useArchiveRestore } from '../../hooks/useArchiveRestore.js';

import StandaloneContactViewDialog from './contacts/StandaloneContactViewDialog.jsx';
import StandaloneContactEditDialog from './contacts/StandaloneContactEditDialog.jsx';
import { useStandaloneContactEditCollections } from './contacts/useStandaloneContactEditCollections.jsx';

const BLANK_CREATE = { name: '', code: '', is_active: true };
const BLANK_EDIT = { name: '', code: '', is_active: true };

const columns = [
  { field: 'code', headerName: 'Code', width: 120 },
  { field: 'name', headerName: 'Contact Name', flex: 1, minWidth: 200 },
  statusColumn('is_active', 'Active', { width: 100, map: (v) => v ? 'active' : 'suspended' }),
];

export default function ContactsPage() {
  const { user } = useAuth();
  const caps = user?.perms?.caps || {};
  const canImport = resolveLevel(caps, 'core', 'contacts', 'import') === 'full';
  const canExport = resolveLevel(caps, 'core', 'contacts', 'export') !== 'none';

  const { data: res, isLoading } = useContacts();
  const allRows = res?.rows ?? [];

  const [viewFilter, setViewFilter] = useState('active');
  const rows = useMemo(() => {
    if (viewFilter === 'active') return allRows.filter((r) => !r.deactivated_at);
    if (viewFilter === 'archived') return allRows.filter((r) => !!r.deactivated_at);
    return allRows;
  }, [allRows, viewFilter]);

  const createMut = useCreateContact();
  const updateMut = useUpdateContact();
  const archiveMut = useArchiveContact();
  const restoreMut = useRestoreContact();

  const importMut = useImportXls(contactApi.importXls, ['contacts']);
  const exportMut = useExportXls(contactApi.exportXls, 'contacts');

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

  const { form: createForm, setForm: setCreateForm, field: onCreateField, reset: resetCreateForm } = useFormState(BLANK_CREATE);
  const { form: editForm, setForm: setEditForm, field: onEditField } = useFormState(BLANK_EDIT);
  const { toast, snackProps } = useToast();
  const qc = useQueryClient();

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
  } = useStandaloneContactEditCollections({
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
      toast('Contact created');
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
    entityName: 'contact',
    setSelectionModel: () => selection.clearSelection(),
    toast,
    errMsg,
  });

  /* ── ModuleBar ─────────────────────────────────────────────── */
  const toolbar = useMemo(() => {
    const primary = [];

    if (viewFilter === 'active' || viewFilter === 'all') {
      primary.push({
        label: selectedRows.length > 1 ? `Archive (${selectedRows.length})` : 'Archive',
        variant: 'outlined', color: 'error',
        disabled: selectedRows.length === 0 || !allActive,
        onClick: () => setArchiveOpen(true),
      });
    }
    if (viewFilter === 'archived' || viewFilter === 'all') {
      primary.push({
        label: selectedRows.length > 1 ? `Restore (${selectedRows.length})` : 'Restore',
        variant: 'outlined', color: 'success',
        disabled: selectedRows.length === 0 || !allArchived,
        onClick: () => setRestoreOpen(true),
      });
    }

    if (canExport) primary.push({ label: 'Export', variant: 'outlined', disabled: exportMut.isPending, onClick: handleExport });
    if (canImport) primary.push({ label: 'Import', variant: 'outlined', onClick: () => importDialog.open() });

    primary.push({
      label: 'Create Contact', variant: 'contained', color: 'primary',
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

      <StandaloneContactViewDialog
        open={viewDialog.isOpen}
        onClose={viewDialog.close}
        contact={viewDialog.data}
        viewEmails={viewEmailsRes?.rows ?? []}
        viewPhones={viewPhonesRes?.rows ?? []}
        viewAddresses={viewAddressesRes?.rows ?? []}
        viewTaxIds={viewTaxIdsRes?.rows ?? []}
      />

      <FormDialog open={createDialog.isOpen} title="Create Contact" submitLabel="Create" loading={createMut.isPending} onSubmit={handleCreate} onCancel={createDialog.close}>
        <TextField label="Contact Name" required value={createForm.name} onChange={onCreateField('name')} />
        <TextField label="Code" value={createForm.code} onChange={onCreateField('code')} inputProps={{ maxLength: 16 }} />
        <FormControlLabel
          control={<Checkbox checked={createForm.is_active} onChange={(e) => setCreateForm((p) => ({ ...p, is_active: e.target.checked }))} size="small" />}
          label="Active"
        />
      </FormDialog>

      <StandaloneContactEditDialog
        open={editDialog.isOpen}
        onClose={handleEditClose}
        editForm={editForm}
        onEditField={onEditField}
        setEditForm={setEditForm}
        emails={emails}
        phones={phones}
        addresses={addresses}
        taxIds={taxIds}
        hasEditChanges={hasEditChanges}
        onSubmit={async () => { if (await handleUpdate()) handleEditClose(); }}
        loading={updateMut.isPending}
      />

      <ImportDialog
        open={importDialog.isOpen} title="Import Contacts" loading={importMut.isPending}
        errors={importErrors}
        onSubmit={handleImport}
        onCancel={() => { importDialog.close(); setImportErrors(null); }}
      />

      <ConfirmDialog {...archiveConfirmProps} />
      <ConfirmDialog {...restoreConfirmProps} />
      <ToastSnackbar {...snackProps} />
    </Box>
  );
}
