/**
 * @file Companies CRUD page — DataTable + create/edit/view/archive/restore
 * @module nap-client/pages/Core/CompaniesPage
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useFormState } from '../../hooks/useFormState.js';
import { useDialogState } from '../../hooks/useDialogState.js';
import { useCollectionState } from '../../hooks/useCollectionState.js';
import { saveCollection } from '../../utils/saveCollection.js';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import ToastSnackbar from '../../components/shared/ToastSnackbar.jsx';
import { useToast } from '../../hooks/useToast.js';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';

import StatusBadge from '../../components/shared/StatusBadge.jsx';
import ConfirmDialog from '../../components/shared/ConfirmDialog.jsx';
import DataTable from '../../components/shared/DataTable.jsx';
import FieldRow from '../../components/shared/FieldRow.jsx';
import FormDialog from '../../components/shared/FormDialog.jsx';
import ImportDialog from '../../components/shared/ImportDialog.jsx';
import PatternTextField from '../../components/shared/PatternTextField.jsx';
import AddressesSection from '../../components/shared/AddressesSection.jsx';
import TaxIdentifiersSection from '../../components/shared/TaxIdentifiersSection.jsx';
import { useModuleToolbarRegistration } from '../../contexts/ModuleActionsContext.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import {
  useCompanies, useCreateCompany, useUpdateCompany, useArchiveCompany, useRestoreCompany,
} from '../../hooks/useCompanies.js';
import {
  useAddresses, useCreateAddress, useUpdateAddress, useArchiveAddress,
} from '../../hooks/useAddresses.js';
import {
  useTaxIdentifiers, useCreateTaxIdentifier, useUpdateTaxIdentifier, useArchiveTaxIdentifier,
} from '../../hooks/useTaxIdentifiers.js';
import { useImportXls, useExportXls } from '../../hooks/useImportExport.js';
import { TAX_TYPES, COUNTRIES, resolveLevel } from '@nap/shared';
import { fmtDate, errMsg } from '../../utils/format.js';
import { BLANK_ADDRESS, BLANK_TAX_ID } from '../../utils/formConstants.js';
import { companyApi } from '../../services/companyApi.js';
import {
  pageContainerSx, formGridSx, formGroupCardSx, formFullSpanSx, dialogHeaderSx, dialogActionBoxSx, detailGridSx,
} from '../../config/layoutTokens.js';
import { useListSelection } from '../../hooks/useListSelection.js';
import { useArchiveRestore } from '../../hooks/useArchiveRestore.js';

const BLANK_CREATE = { name: '', code: '', is_active: true };
const BLANK_EDIT = { name: '', code: '', is_active: true };
const columns = [
  { field: 'code', headerName: 'Code', width: 120 },
  { field: 'name', headerName: 'Company Name', flex: 1, minWidth: 200 },
  {
    field: 'is_active',
    headerName: 'Active',
    width: 100,
    renderCell: ({ value }) => <StatusBadge status={value ? 'active' : 'suspended'} />,
  },
];

export default function CompaniesPage() {
  const { user } = useAuth();
  const caps = user?.perms?.caps || {};
  const canImport = resolveLevel(caps, 'core', 'companies', 'import') === 'full';
  const canExport = resolveLevel(caps, 'core', 'companies', 'export') !== 'none';

  const { data: res, isLoading } = useCompanies();
  const allRows = res?.rows ?? [];

  const [viewFilter, setViewFilter] = useState('active');
  const rows = useMemo(() => {
    if (viewFilter === 'active') return allRows.filter((r) => !r.deactivated_at);
    if (viewFilter === 'archived') return allRows.filter((r) => !!r.deactivated_at);
    return allRows;
  }, [allRows, viewFilter]);

  const createMut = useCreateCompany();
  const updateMut = useUpdateCompany();
  const archiveMut = useArchiveCompany();
  const restoreMut = useRestoreCompany();

  const createAddrMut = useCreateAddress();
  const updateAddrMut = useUpdateAddress();
  const archiveAddrMut = useArchiveAddress();
  const createTaxIdMut = useCreateTaxIdentifier();
  const updateTaxIdMut = useUpdateTaxIdentifier();
  const archiveTaxIdMut = useArchiveTaxIdentifier();

  const importMut = useImportXls(companyApi.importXls, ['companies']);
  const exportMut = useExportXls(companyApi.exportXls, 'companies');

  /* ── Selection (new system) ─────────────────────────────────── */
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

  /* ── Edit: source-linked collections ────────────────────────── */
  const [editSourceId, setEditSourceId] = useState(null);
  const { data: addressesRes } = useAddresses(
    { source_id: editSourceId, includeDeactivated: 'false' },
    { enabled: !!editSourceId },
  );
  const { data: taxIdsRes } = useTaxIdentifiers(
    { source_id: editSourceId, includeDeactivated: 'false' },
    { enabled: !!editSourceId },
  );

  const addresses = useCollectionState([], { blank: BLANK_ADDRESS });
  const taxIds = useCollectionState([], { blank: BLANK_TAX_ID });
  const editInitial = useRef({ form: null, addresses: null, taxIds: null });

  /* ── View: source-linked collections ────────────────────────── */
  const [viewSourceId, setViewSourceId] = useState(null);
  const { data: viewAddressesRes } = useAddresses(
    { source_id: viewSourceId, includeDeactivated: 'false' },
    { enabled: !!viewSourceId },
  );
  const { data: viewTaxIdsRes } = useTaxIdentifiers(
    { source_id: viewSourceId, includeDeactivated: 'false' },
    { enabled: !!viewSourceId },
  );
  const viewAddresses = viewAddressesRes?.rows ?? [];
  const viewTaxIds = viewTaxIdsRes?.rows ?? [];

  const { toast, snackProps } = useToast();


  /* ── Sync query → local state ───────────────────────────────── */
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
    setViewSourceId(row.source_id || null);
    viewDialog.open(row);
  }, []);

  const handleEdit = useCallback((row) => {
    setEditForm({ name: row.name ?? '', code: row.code ?? '', is_active: row.is_active ?? true });
    setEditSourceId(row.source_id || null);
    if (!row.source_id) {
      addresses.reset([]);
      taxIds.reset([]);
      editInitial.current.addresses = [];
      editInitial.current.taxIds = [];
    }
    editInitial.current.form = { name: row.name ?? '', code: row.code ?? '', is_active: row.is_active ?? true };
    editDialog.open(row);
  }, []);

  const handleCreate = async () => {
    try {
      await createMut.mutateAsync(createForm);
      toast('Company created');
      createDialog.close();
      resetCreateForm();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };

  const handleUpdate = async () => {
    try {
      await updateMut.mutateAsync({ filter: { id: editDialog.data.id }, changes: editForm });

      /* ── Save addresses ──────────────────────────────────────── */
      await saveCollection(addresses.items, {
        sourceId: editDialog.data.source_id,
        fields: ['label', 'address_line_1', 'address_line_2', 'address_line_3', 'city', 'state_province', 'postal_code', 'country_code'],
        createMut: createAddrMut.mutateAsync,
        updateMut: updateAddrMut.mutateAsync,
        archiveMut: archiveAddrMut.mutateAsync,
      });

      /* ── Save tax identifiers ────────────────────────────────── */
      await saveCollection(taxIds.items, {
        sourceId: editDialog.data.source_id,
        fields: ['country_code', 'tax_type', 'tax_value'],
        createMut: createTaxIdMut.mutateAsync,
        updateMut: updateTaxIdMut.mutateAsync,
        archiveMut: archiveTaxIdMut.mutateAsync,
      });

      toast('Company updated');
      editDialog.close();
      setEditSourceId(null);
      addresses.reset([]);
      taxIds.reset([]);
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
    entityName: 'company',
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
      label: 'Create Company',
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
      <Dialog
        open={viewDialog.isOpen}
        onClose={() => { viewDialog.close(); setViewSourceId(null); }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={dialogHeaderSx}>
          <Box>
            <span>Company Details</span>
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
                <FieldRow label="Status">
                  <StatusBadge status={viewDialog.data.deactivated_at ? 'archived' : 'active'} />
                </FieldRow>
                <FieldRow label="Created" value={fmtDate(viewDialog.data.created_at)} />
                <FieldRow label="Updated" value={fmtDate(viewDialog.data.updated_at)} />
              </Box>
              <AddressesSection addresses={viewAddresses} />
              <TaxIdentifiersSection taxIds={viewTaxIds} />
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Create Dialog ─────────────────────────────────────────── */}
      <FormDialog open={createDialog.isOpen} title="Create Company" submitLabel="Create" loading={createMut.isPending} onSubmit={handleCreate} onCancel={createDialog.close}>
        <TextField label="Company Name" required value={createForm.name} onChange={onCreateField('name')} />
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
      </FormDialog>

      {/* ── Edit Dialog ───────────────────────────────────────────── */}
      <FormDialog
        open={editDialog.isOpen}
        title="Edit Company"
        submitLabel="Save Changes"
        loading={updateMut.isPending}
        onSubmit={handleUpdate}
        onCancel={() => { editDialog.close(); setEditSourceId(null); addresses.reset([]); taxIds.reset([]); }}
      >
        <TextField label="Company Name" required value={editForm.name} onChange={onEditField('name')} />
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

        {/* ── Addresses ───────────────────────────────────────────── */}
        <Divider />
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle2">Addresses</Typography>
          <Button size="small" startIcon={<AddIcon />} onClick={addresses.add} disabled={!editDialog.data?.source_id}>Add Address</Button>
        </Box>
        {!editDialog.data?.source_id && (
          <Typography variant="body2" color="text.secondary">Save company first to manage addresses</Typography>
        )}
        {addresses.visibleItems.length === 0 && editDialog.data?.source_id && (
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

        {/* ── Tax Identifiers ─────────────────────────────────────── */}
        <Divider />
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle2">Tax Identifiers</Typography>
          <Button size="small" startIcon={<AddIcon />} onClick={taxIds.add} disabled={!editDialog.data?.source_id}>Add Tax ID</Button>
        </Box>
        {!editDialog.data?.source_id && (
          <Typography variant="body2" color="text.secondary">Save company first to manage tax identifiers</Typography>
        )}
        {taxIds.visibleItems.length === 0 && editDialog.data?.source_id && (
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
        title="Import Companies"
        loading={importMut.isPending}
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
