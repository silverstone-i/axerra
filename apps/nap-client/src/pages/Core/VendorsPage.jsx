/**
 * @file Vendors CRUD page — coordinator component that owns all state, queries, and handlers
 * @module nap-client/pages/Core/VendorsPage
 *
 * Reference implementation for the standardised list-view selection system:
 *   useListSelection + DataTable + RowActionsMenu
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
 */

import { useState, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useDialogState } from '../../hooks/useDialogState.js';
import { useVendorContactDialogs } from './vendors/useVendorContactDialogs.js';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import LockResetIcon from '@mui/icons-material/LockReset';

import ToastSnackbar from '../../components/shared/ToastSnackbar.jsx';
import ConfirmDialog from '../../components/shared/ConfirmDialog.jsx';
import ResetPasswordDialog from '../../components/shared/ResetPasswordDialog.jsx';
import SetPasswordPopover from '../../components/shared/SetPasswordPopover.jsx';
import DataTable from '../../components/shared/DataTable.jsx';
import ImportDialog from '../../components/shared/ImportDialog.jsx';
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
import { resolveLevel } from '@nap/shared';
import { useToast } from '../../hooks/useToast.js';
import { errMsg } from '../../utils/format.js';
import { statusColumn } from '../../utils/columnHelpers.jsx';
import { useFormState } from '../../hooks/useFormState.js';
import { vendorApi } from '../../services/vendorApi.js';
import { pageContainerSx } from '../../config/layoutTokens.js';
import { useListSelection } from '../../hooks/useListSelection.js';
import { useArchiveRestore } from '../../hooks/useArchiveRestore.js';

import VendorViewDialog from './vendors/VendorViewDialog.jsx';
import VendorCreateDialog from './vendors/VendorCreateDialog.jsx';
import VendorEditDialog from './vendors/VendorEditDialog.jsx';
import ContactViewDialog from './vendors/ContactViewDialog.jsx';
import ContactFormDialog from './vendors/ContactFormDialog.jsx';
import { useContactChildrenData } from './vendors/useContactChildrenData.jsx';
import { useVendorEditCollections } from './vendors/useVendorEditCollections.jsx';

const BLANK_CREATE = { name: '', code: '', payment_term_id: '', notes: '', is_active: true };
const BLANK_EDIT = { name: '', code: '', payment_term_id: '', notes: '', is_active: true };
const baseColumns = [
  { field: 'code', headerName: 'Code', width: 120 },
  { field: 'name', headerName: 'Vendor Name', flex: 1, minWidth: 200 },
  { field: 'payment_term_id', headerName: 'Terms', width: 160 },
  statusColumn('is_active', 'Active', { width: 100, map: (v) => v ? 'active' : 'suspended' }),
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
  const importDialog = useDialogState();
  const [importErrors, setImportErrors] = useState(null);
  const viewDialog = useDialogState();
  const createDialog = useDialogState();
  const editDialog = useDialogState();
  const resetPwDialog = useDialogState();

  // View dialog child data
  const viewSourceId = viewDialog.data?.source_id;
  const { data: viewEmailsRes } = useEmails({ source_id: viewSourceId, includeDeactivated: 'false' }, { enabled: !!viewSourceId });
  const { data: viewPhonesRes } = usePhoneNumbers({ source_id: viewSourceId, includeDeactivated: 'false' }, { enabled: !!viewSourceId });
  const { data: viewAddressesRes } = useAddresses({ source_id: viewSourceId, includeDeactivated: 'false' }, { enabled: !!viewSourceId });
  const { data: viewTaxIdsRes } = useTaxIdentifiers({ source_id: viewSourceId, includeDeactivated: 'false' }, { enabled: !!viewSourceId });
  const { data: viewContactsRes } = useVendorContacts(
    { vendor_id: viewDialog.data?.id, includeDeactivated: 'false' },
    { enabled: !!viewDialog.data?.id },
  );
  const viewEmails = viewEmailsRes?.rows ?? [];
  const viewPhones = viewPhonesRes?.rows ?? [];
  const viewAddresses = viewAddressesRes?.rows ?? [];
  const viewTaxIds = viewTaxIdsRes?.rows ?? [];
  const viewContacts = viewContactsRes?.rows ?? [];

  const { form: createForm, setForm: setCreateForm, field: onCreateField, reset: resetCreateForm } = useFormState(BLANK_CREATE);
  const { form: editForm, setForm: setEditForm, field: onEditField } = useFormState(BLANK_EDIT);

  const { toast, snackProps } = useToast();

  const {
    emails, phones, addresses, taxIds,
    editContacts, setEditContacts,
    hasEditChanges, handleUpdate, contactsRes,
    openEditSession, closeEditSession,
  } = useVendorEditCollections({
    editOpen: editDialog.isOpen,
    editRow: editDialog.data,
    editForm,
    updateMut,
    toast,
    emailMuts: { create: createEmailMut, update: updateEmailMut, archive: archiveEmailMut },
    phoneMuts: { create: createPhoneMut, update: updatePhoneMut, archive: archivePhoneMut },
    addressMuts: { create: createAddrMut, update: updateAddrMut, archive: archiveAddrMut },
    taxIdMuts: { create: createTaxIdMut, update: updateTaxIdMut, archive: archiveTaxIdMut },
  });

  const {
    contactEmails, contactPhones, contactColumns, refreshContactChildren,
    viewContactEmails, viewContactPhones, resetEditMaps, resetViewMaps,
  } = useContactChildrenData({ editOpen: editDialog.isOpen, viewOpen: viewDialog.isOpen, editContacts, viewContacts, contactsRes, setEditContacts });


  /* ── Contact sub-dialog orchestration ────────────────────────── */
  const {
    contactViewOpen, contactViewRow, handleViewContact, closeContactView,
    contactCreateOpen, contactCreateForm, setContactCreateForm, onContactCreateField,
    contactCreateEmails, setContactCreateEmails, contactCreatePhones, setContactCreatePhones,
    handleOpenContactCreate, handleContactCreate, closeContactCreate, createContactLoading,
    contactEditOpen, contactEditForm, setContactEditForm, onContactEditField,
    contactEditEmails, setContactEditEmails, contactEditPhones, setContactEditPhones,
    contactEditRow, openContactEdit, handleContactEdit, closeContactEdit, updateContactLoading,
    contactPwAnchor, handleContactAppUserToggle, handleContactPwConfirm, handleContactPwCancel,
    contactViewFilter, setContactViewFilter, filteredContacts,
    contactSelection, viewContactSelection,
    setContactArchiveOpen, setContactRestoreOpen,
    contactArchiveProps, contactRestoreProps,
  } = useVendorContactDialogs({
    editRow: editDialog.data,
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
  });

  /* ── Bundled close handlers ─────────────────────────────────── */
  const handleViewClose = useCallback(() => {
    viewDialog.close();
    resetViewMaps();
  }, [viewDialog.close, resetViewMaps]);

  const handleEditClose = useCallback(() => {
    editDialog.close();
    closeEditSession();
    resetEditMaps();
    setContactViewFilter('active');
  }, [editDialog.close, closeEditSession, resetEditMaps]);
  /* ── Row action callbacks ──────────────────────────────────── */
  const handleView = useCallback((row) => {
    resetViewMaps();
    viewDialog.open(row);
  }, [viewDialog.open, resetViewMaps]);

  const handleEdit = useCallback((row) => {
    openEditSession(row, setEditForm);
    resetEditMaps();
    setContactViewFilter('active');
    editDialog.open(row);
  }, [openEditSession, editDialog.open, resetEditMaps]);

  const handleCreate = async () => {
    try {
      const payload = { ...createForm, payment_term_id: createForm.payment_term_id || null };
      await createMut.mutateAsync(payload);

      toast('Vendor created');
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
        onClick: () => importDialog.open(),
      });
    }

    primary.push({
      label: 'Create Vendor',
      variant: 'contained',
      color: 'primary',
      onClick: () => {
        resetCreateForm();
        createDialog.open();
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
        open={viewDialog.isOpen}
        onClose={handleViewClose}
        vendor={viewDialog.data}
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
        open={createDialog.isOpen}
        onClose={createDialog.close}
        createForm={createForm}
        onCreateField={onCreateField}
        setCreateForm={setCreateForm}
        paymentTermsList={paymentTermsList}
        onSubmit={handleCreate}
        loading={createMut.isPending}
      />

      <VendorEditDialog
        open={editDialog.isOpen}
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
        onSubmit={async () => { if (await handleUpdate()) handleEditClose(); }}
        loading={updateMut.isPending}
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
        onClose={closeContactView}
        contact={contactViewRow}
        emails={contactEmails[contactViewRow?.id] || viewContactEmails[contactViewRow?.id] || []}
        phones={contactPhones[contactViewRow?.id] || viewContactPhones[contactViewRow?.id] || []}
      />

      {/* Contact Create */}
      <ContactFormDialog
        open={contactCreateOpen}
        title="Create Contact"
        onCancel={closeContactCreate}
        onSubmit={handleContactCreate}
        loading={createContactLoading}
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
        onCancel={closeContactEdit}
        onSubmit={handleContactEdit}
        loading={updateContactLoading}
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
          <IconButton size="small" title="Reset Password" onClick={() => resetPwDialog.open(contactEditRow)}>
            <LockResetIcon fontSize="small" />
          </IconButton>
        )}
      </ContactFormDialog>

      <ImportDialog
        open={importDialog.isOpen}
        title="Import Vendors"
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
        onReset={(id, password) => resetContactPwMut.mutateAsync({ id, password })}
        entityId={resetPwDialog.data?.id}
        entityName={resetPwDialog.data ? `${resetPwDialog.data.first_name} ${resetPwDialog.data.last_name}` : ''}
      />

      <SetPasswordPopover anchorEl={contactPwAnchor} onConfirm={handleContactPwConfirm} onCancel={handleContactPwCancel} />

      <ToastSnackbar {...snackProps} />
    </Box>
  );
}
