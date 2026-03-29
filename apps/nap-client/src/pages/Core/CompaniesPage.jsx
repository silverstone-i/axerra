/**
 * @file Companies CRUD page — DataTable + create/edit/view/archive/restore
 * @module nap-client/pages/Core/CompaniesPage
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
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
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
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
  const [importOpen, setImportOpen] = useState(false);
  const [importErrors, setImportErrors] = useState(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewCompany, setViewCompany] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);

  const [createForm, setCreateForm] = useState(BLANK_CREATE);
  const [editForm, setEditForm] = useState(BLANK_EDIT);

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

  const [editAddresses, setEditAddresses] = useState([]);
  const [editTaxIds, setEditTaxIds] = useState([]);
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

  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' });
  const toast = useCallback((msg, sev = 'success') => setSnack({ open: true, msg, sev }), []);

  const onCreateField = (f) => (e) => setCreateForm((p) => ({ ...p, [f]: e.target.value }));
  const onEditField = (f) => (e) => setEditForm((p) => ({ ...p, [f]: e.target.value }));

  /* ── Address / TaxId helpers ────────────────────────────────── */
  const updateAddress = (idx, field, value) =>
    setEditAddresses((prev) => prev.map((a, i) => (i === idx ? { ...a, [field]: value } : a)));
  const addAddress = () => setEditAddresses((prev) => [...prev, { ...BLANK_ADDRESS }]);
  const removeAddress = (idx) =>
    setEditAddresses((prev) => prev.map((a, i) => (i === idx ? { ...a, _deleted: true } : a)));

  const updateTaxId = (idx, field, value) =>
    setEditTaxIds((prev) => prev.map((t, i) => (i === idx ? { ...t, [field]: value } : t)));
  const addTaxId = () => setEditTaxIds((prev) => [...prev, { ...BLANK_TAX_ID }]);
  const removeTaxId = (idx) =>
    setEditTaxIds((prev) => prev.map((t, i) => (i === idx ? { ...t, _deleted: true } : t)));

  /* ── Sync query → local state ───────────────────────────────── */
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

  /* ── Row action callbacks ──────────────────────────────────── */
  const handleView = useCallback((row) => {
    setViewCompany(row);
    setViewSourceId(row.source_id || null);
    setViewOpen(true);
  }, []);

  const handleEdit = useCallback((row) => {
    setEditRow(row);
    setEditForm({ name: row.name ?? '', code: row.code ?? '', is_active: row.is_active ?? true });
    setEditSourceId(row.source_id || null);
    if (!row.source_id) {
      setEditAddresses([]);
      setEditTaxIds([]);
      editInitial.current.addresses = [];
      editInitial.current.taxIds = [];
    }
    editInitial.current.form = { name: row.name ?? '', code: row.code ?? '', is_active: row.is_active ?? true };
    setEditOpen(true);
  }, []);

  const handleCreate = async () => {
    try {
      await createMut.mutateAsync(createForm);
      toast('Company created');
      setCreateOpen(false);
      setCreateForm(BLANK_CREATE);
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };

  const handleUpdate = async () => {
    try {
      await updateMut.mutateAsync({ filter: { id: editRow.id }, changes: editForm });

      /* ── Save addresses ──────────────────────────────────────── */
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

      /* ── Save tax identifiers ────────────────────────────────── */
      for (const t of editTaxIds) {
        if (t._deleted && t.id) {
          await archiveTaxIdMut.mutateAsync({ id: t.id });
        } else if (!t.id && !t._deleted) {
          await createTaxIdMut.mutateAsync({
            source_id: editRow.source_id,
            country_code: t.country_code,
            tax_type: t.tax_type,
            tax_value: t.tax_value,
          });
        } else if (t.id && !t._deleted) {
          await updateTaxIdMut.mutateAsync({
            filter: { id: t.id },
            changes: { country_code: t.country_code, tax_type: t.tax_type, tax_value: t.tax_value },
          });
        }
      }

      toast('Company updated');
      setEditOpen(false);
      setEditRow(null);
      setEditSourceId(null);
      setEditAddresses([]);
      setEditTaxIds([]);
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };

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
    entityName: 'company',
    setSelectionModel: () => selection.clearSelection(),
    toast,
    errMsg,
    getLabel: (r) => r.name,
  });

  /* ── Visible (non-deleted) collections for rendering ────────── */
  const visibleAddresses = editAddresses.filter((a) => !a._deleted);
  const visibleTaxIds = editTaxIds.filter((t) => !t._deleted);

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
      label: 'Create Company',
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
        onClose={() => { setViewOpen(false); setViewSourceId(null); }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={dialogHeaderSx}>
          <Box>
            <span>Company Details</span>
            {viewCompany && (
              <Typography variant="body2" color="text.secondary">
                {viewCompany.name}
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
          {viewCompany && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={detailGridSx}>
                <FieldRow label="Code" value={viewCompany.code || '\u2014'} />
                <FieldRow label="Name" value={viewCompany.name} />
                <FieldRow label="Active" value={viewCompany.is_active ? 'Yes' : 'No'} />
                <FieldRow label="Status">
                  <StatusBadge status={viewCompany.deactivated_at ? 'archived' : 'active'} />
                </FieldRow>
                <FieldRow label="Created" value={fmtDate(viewCompany.created_at)} />
                <FieldRow label="Updated" value={fmtDate(viewCompany.updated_at)} />
              </Box>
              <AddressesSection addresses={viewAddresses} />
              <TaxIdentifiersSection taxIds={viewTaxIds} />
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Create Dialog ─────────────────────────────────────────── */}
      <FormDialog open={createOpen} title="Create Company" submitLabel="Create" loading={createMut.isPending} onSubmit={handleCreate} onCancel={() => setCreateOpen(false)}>
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
        open={editOpen}
        title="Edit Company"
        submitLabel="Save Changes"
        loading={updateMut.isPending}
        onSubmit={handleUpdate}
        onCancel={() => { setEditOpen(false); setEditRow(null); setEditSourceId(null); setEditAddresses([]); setEditTaxIds([]); }}
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
          <Button size="small" startIcon={<AddIcon />} onClick={addAddress} disabled={!editRow?.source_id}>Add Address</Button>
        </Box>
        {!editRow?.source_id && (
          <Typography variant="body2" color="text.secondary">Save company first to manage addresses</Typography>
        )}
        {visibleAddresses.length === 0 && editRow?.source_id && (
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
                <IconButton size="small" onClick={() => removeAddress(idx)} color="error">
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
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

        {/* ── Tax Identifiers ─────────────────────────────────────── */}
        <Divider />
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle2">Tax Identifiers</Typography>
          <Button size="small" startIcon={<AddIcon />} onClick={addTaxId} disabled={!editRow?.source_id}>Add Tax ID</Button>
        </Box>
        {!editRow?.source_id && (
          <Typography variant="body2" color="text.secondary">Save company first to manage tax identifiers</Typography>
        )}
        {visibleTaxIds.length === 0 && editRow?.source_id && (
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
                <IconButton size="small" onClick={() => removeTaxId(idx)} color="error">
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Box>
            </Box>
          );
        })}
      </FormDialog>

      <ImportDialog
        open={importOpen}
        title="Import Companies"
        loading={importMut.isPending}
        errors={importErrors}
        onSubmit={handleImport}
        onCancel={() => { setImportOpen(false); setImportErrors(null); }}
      />

      <ConfirmDialog {...archiveConfirmProps} />
      <ConfirmDialog {...restoreConfirmProps} />

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack.sev} variant="filled" onClose={() => setSnack((s) => ({ ...s, open: false }))}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
