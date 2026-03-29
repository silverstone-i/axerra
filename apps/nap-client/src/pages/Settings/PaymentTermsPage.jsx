/**
 * @file Payment Terms settings page — DataTable + create/edit/view/archive/restore
 * @module nap-client/pages/Settings/PaymentTermsPage
 *
 * Lookup table for standardised vendor payment terms.
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
 */

import { useState, useMemo, useCallback } from 'react';
import { useFormState } from '../../hooks/useFormState.js';
import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import StatusBadge from '../../components/shared/StatusBadge.jsx';
import ConfirmDialog from '../../components/shared/ConfirmDialog.jsx';
import DataTable from '../../components/shared/DataTable.jsx';
import ToastSnackbar from '../../components/shared/ToastSnackbar.jsx';
import FieldRow from '../../components/shared/FieldRow.jsx';
import FormDialog from '../../components/shared/FormDialog.jsx';
import ImportDialog from '../../components/shared/ImportDialog.jsx';
import { useModuleToolbarRegistration } from '../../contexts/ModuleActionsContext.jsx';
import {
  usePaymentTerms, useCreatePaymentTerm, useUpdatePaymentTerm, useArchivePaymentTerm, useRestorePaymentTerm,
} from '../../hooks/usePaymentTerms.js';
import { useImportXls, useExportXls } from '../../hooks/useImportExport.js';
import { paymentTermApi } from '../../services/paymentTermApi.js';
import { pageContainerSx, formGridSx, dialogHeaderSx, dialogActionBoxSx } from '../../config/layoutTokens.js';
import { useListSelection } from '../../hooks/useListSelection.js';
import { useArchiveRestore } from '../../hooks/useArchiveRestore.js';
import { useToast } from '../../hooks/useToast.js';
import { fmtDate, errMsg } from '../../utils/format.js';

const BLANK_CREATE = { label: '', term: 30, units: 'days' };
const BLANK_EDIT = { label: '', term: 30, units: 'days', is_active: true };
const UNITS_OPTIONS = [
  { value: 'days', label: 'Days' },
  { value: 'months', label: 'Months' },
];

const columns = [
  { field: 'label', headerName: 'Label', flex: 1, minWidth: 180 },
  { field: 'term', headerName: 'Term', width: 100 },
  { field: 'units', headerName: 'Units', width: 100 },
  {
    field: 'is_active',
    headerName: 'Active',
    width: 100,
    renderCell: ({ value }) => <StatusBadge status={value ? 'active' : 'suspended'} />,
  },
];

export default function PaymentTermsPage() {
  const { data: res, isLoading } = usePaymentTerms();
  const allRows = res?.rows ?? [];

  const [viewFilter, setViewFilter] = useState('active');
  const rows = useMemo(() => {
    if (viewFilter === 'active') return allRows.filter((r) => !r.deactivated_at);
    if (viewFilter === 'archived') return allRows.filter((r) => r.deactivated_at);
    return allRows;
  }, [allRows, viewFilter]);

  const selection = useListSelection(rows);
  const { selectedRows, allActive, allArchived } = selection;

  /* ── Mutations ─────────────────────────────────────────── */
  const createMut = useCreatePaymentTerm();
  const updateMut = useUpdatePaymentTerm();
  const archiveMut = useArchivePaymentTerm();
  const restoreMut = useRestorePaymentTerm();
  const importMut = useImportXls(paymentTermApi.importXls, ['payment-terms']);
  const exportMut = useExportXls(paymentTermApi.exportXls, 'payment_terms');

  /* ── Snackbar ──────────────────────────────────────────── */
  const { toast, snackProps } = useToast();

  /* ── Archive / Restore ─────────────────────────────────── */
  const { setArchiveOpen, setRestoreOpen, archiveConfirmProps, restoreConfirmProps } = useArchiveRestore({
    selectedRows,
    archiveMut,
    restoreMut,
    entityName: 'payment term',
    setSelectionModel: () => selection.clearSelection(),
    toast,
    errMsg,
    getLabel: (r) => r.label,
  });

  /* ── Import / Export ──────────────────────────────────── */
  const [importOpen, setImportOpen] = useState(false);
  const [importErrors, setImportErrors] = useState(null);

  const handleImport = useCallback(async (formData) => {
    try {
      const result = await importMut.mutateAsync(formData);
      if (result?.errors) {
        setImportErrors(result.errors);
        return;
      }
      setImportOpen(false);
      setImportErrors(null);
      toast(`Imported ${(result?.inserted ?? 0) + (result?.updated ?? 0)} payment term(s)`);
    } catch (err) {
      const payload = err?.payload;
      if (payload?.errors) {
        setImportErrors(payload.errors);
      } else {
        toast(errMsg(err) || 'Import failed', 'error');
      }
    }
  }, [importMut.mutateAsync, toast]);

  const handleExport = useCallback(async () => {
    try {
      await exportMut.mutateAsync({});
      toast('Export downloaded');
    } catch (err) {
      toast(errMsg(err) || 'Export failed', 'error');
    }
  }, [exportMut.mutateAsync, toast]);

  /* ── Create dialog ─────────────────────────────────────── */
  const [createOpen, setCreateOpen] = useState(false);
  const { form: createForm, field: onCreateField, reset: resetCreateForm } = useFormState(BLANK_CREATE);

  const handleCreate = useCallback(async () => {
    try {
      await createMut.mutateAsync({ ...createForm, term: Number(createForm.term) });
      setCreateOpen(false);
      resetCreateForm();
      toast('Payment term created');
    } catch (err) {
      toast(errMsg(err) || 'Create failed', 'error');
    }
  }, [createForm, createMut, toast]);

  /* ── View dialog ───────────────────────────────────────── */
  const [viewOpen, setViewOpen] = useState(false);
  const [viewRow, setViewRow] = useState(null);

  /* ── Edit dialog ───────────────────────────────────────── */
  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const { form: editForm, setForm: setEditForm, field: onEditField } = useFormState(BLANK_EDIT);

  const openEdit = useCallback((row) => {
    setEditRow(row);
    setEditForm({ label: row.label, term: row.term, units: row.units, is_active: row.is_active });
    setEditOpen(true);
  }, []);

  const handleUpdate = useCallback(async () => {
    try {
      await updateMut.mutateAsync({ filter: { id: editRow.id }, changes: { ...editForm, term: Number(editForm.term) } });
      setEditOpen(false);
      toast('Payment term updated');
    } catch (err) {
      toast(errMsg(err) || 'Update failed', 'error');
    }
  }, [editRow, editForm, updateMut, toast]);

  /* ── Row action callbacks ───────────────────────────────── */
  const handleView = useCallback((row) => {
    setViewRow(row);
    setViewOpen(true);
  }, []);


  /* ── Toolbar ───────────────────────────────────────────── */
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

    primary.push({
      label: 'Export',
      variant: 'outlined',
      color: 'primary',
      disabled: exportMut.isPending,
      onClick: handleExport,
    });
    primary.push({
      label: 'Import',
      variant: 'outlined',
      color: 'primary',
      disabled: importMut.isPending,
      onClick: () => { setImportErrors(null); setImportOpen(true); },
    });
    primary.push({
      label: 'Create Payment Term',
      variant: 'contained',
      color: 'primary',
      onClick: () => { resetCreateForm(); setCreateOpen(true); },
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
  }, [viewFilter, selectedRows.length, allActive, allArchived, selection.clearSelection, setArchiveOpen, setRestoreOpen, exportMut.isPending, importMut.isPending, handleExport]);
  useModuleToolbarRegistration(toolbar);

  /* ── Render ────────────────────────────────────────────── */
  return (
    <Box sx={pageContainerSx}>
      <DataTable
        rows={rows}
        columns={columns}
        loading={isLoading}
        selection={selection}
        onView={handleView}
        onEdit={openEdit}
      />

      {/* ── Create Dialog ─────────────────────────────── */}
      <FormDialog
        open={createOpen}
        title="New Payment Term"
        submitLabel="Create"
        loading={createMut.isPending}
        onSubmit={handleCreate}
        onCancel={() => { setCreateOpen(false); resetCreateForm(); }}
      >
        <Box sx={formGridSx}>
          <TextField
            label="Label"
            required
            value={createForm.label}
            onChange={onCreateField('label')}
          />
          <TextField
            label="Term"
            type="number"
            required
            value={createForm.term}
            onChange={onCreateField('term')}
            inputProps={{ min: 1 }}
          />
          <TextField
            label="Units"
            select
            value={createForm.units}
            onChange={onCreateField('units')}
          >
            {UNITS_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
          </TextField>
        </Box>
      </FormDialog>

      {/* ── Edit Dialog ───────────────────────────────── */}
      <FormDialog
        open={editOpen}
        title="Edit Payment Term"
        submitLabel="Save"
        loading={updateMut.isPending}
        onSubmit={handleUpdate}
        onCancel={() => setEditOpen(false)}
      >
        <Box sx={formGridSx}>
          <TextField
            label="Label"
            required
            value={editForm.label}
            onChange={onEditField('label')}
          />
          <TextField
            label="Term"
            type="number"
            required
            value={editForm.term}
            onChange={onEditField('term')}
            inputProps={{ min: 1 }}
          />
          <TextField
            label="Units"
            select
            value={editForm.units}
            onChange={onEditField('units')}
          >
            {UNITS_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
          </TextField>
          <TextField
            label="Active"
            select
            value={editForm.is_active ? 'true' : 'false'}
            onChange={(e) => setEditForm((p) => ({ ...p, is_active: e.target.value === 'true' }))}
          >
            <MenuItem value="true">Yes</MenuItem>
            <MenuItem value="false">No</MenuItem>
          </TextField>
        </Box>
      </FormDialog>

      {/* ── View Dialog ───────────────────────────────── */}
      <Dialog open={viewOpen} onClose={() => setViewOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={dialogHeaderSx}>
          <Typography variant="h6">Payment Term Details</Typography>
          <Box sx={dialogActionBoxSx}>
            <StatusBadge status={viewRow?.deactivated_at ? 'archived' : viewRow?.is_active ? 'active' : 'suspended'} />
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {viewRow && (
            <>
              <FieldRow label="Label" value={viewRow.label} />
              <FieldRow label="Term" value={viewRow.term} />
              <FieldRow label="Units" value={viewRow.units} />
              <FieldRow label="Active" value={viewRow.is_active ? 'Yes' : 'No'} />
              <FieldRow label="Created" value={fmtDate(viewRow.created_at)} />
              <FieldRow label="Updated" value={fmtDate(viewRow.updated_at)} />
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Import Dialog ──────────────────────────────── */}
      <ImportDialog
        open={importOpen}
        title="Import Payment Terms"
        loading={importMut.isPending}
        errors={importErrors}
        onSubmit={handleImport}
        onCancel={() => { setImportOpen(false); setImportErrors(null); }}
      />

      {/* ── Confirm Dialogs ───────────────────────────── */}
      <ConfirmDialog {...archiveConfirmProps} />
      {restoreConfirmProps && <ConfirmDialog {...restoreConfirmProps} />}

      {/* ── Snackbar ──────────────────────────────────── */}
      <ToastSnackbar {...snackProps} />
    </Box>
  );
}
