/**
 * @file Receipts CRUD page — DataTable + create/edit/view/archive/restore
 * @module client/pages/AR/ReceiptsPage
 *
 * No ar_clients — PRD removed ar_clients table.
 * Receipts reference the unified clients table from core entities.
 *
 * Copyright (c) 2025 – present Vimber LLC. All rights reserved.
 */

import { useState, useMemo, useCallback } from 'react';
import { useFormState } from '../../hooks/useFormState.js';
import { useDialogState } from '../../hooks/useDialogState.js';
import Box from '@mui/material/Box';
import TertiaryButton from '../../components/shared/TertiaryButton.jsx';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import CurrencyCell from '../../components/shared/CurrencyCell.jsx';
import ConfirmDialog from '../../components/shared/ConfirmDialog.jsx';
import DataTable from '../../components/shared/DataTable.jsx';
import FieldRow from '../../components/shared/FieldRow.jsx';
import FormDialog from '../../components/shared/FormDialog.jsx';
import { useModuleToolbarRegistration } from '../../contexts/ModuleActionsContext.jsx';
import { useReceipts, useCreateReceipt, useUpdateReceipt, useArchiveReceipt, useRestoreReceipt } from '../../hooks/useAr.js';
import { useClients } from '../../hooks/useClients.js';
import { pageContainerSx, dialogHeaderSx, dialogActionBoxSx, detailGridSx } from '../../config/layoutTokens.js';
import { useListSelection } from '../../hooks/useListSelection.js';
import { useArchiveRestore } from '../../hooks/useArchiveRestore.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useImportXls, useExportXls } from '../../hooks/useImportExport.js';
import ImportDialog from '../../components/shared/ImportDialog.jsx';
import ToastSnackbar from '../../components/shared/ToastSnackbar.jsx';
import { resolveLevel } from '@vimber/shared';
import { receiptApi } from '../../services/arApi.js';
import { useToast } from '../../hooks/useToast.js';
import { capSnake, fmtDate, errMsg } from '../../utils/format.js';

const METHOD_OPTS = ['check', 'ach', 'wire'];

const BLANK_CREATE = { client_id: '', ar_invoice_id: '', receipt_date: '', amount: '', method: 'check', reference: '', notes: '' };
const BLANK_EDIT = { receipt_date: '', amount: '', method: 'check', reference: '', notes: '' };

const columns = [
  { field: 'id', headerName: 'ID', width: 100, valueGetter: (params) => params.row.id?.slice(0, 8) },
  { field: 'client_id', headerName: 'Client', width: 120, valueGetter: (params) => params.row.client_id?.slice(0, 8) ?? '\u2014' },
  { field: 'receipt_date', headerName: 'Date', width: 120, valueGetter: (params) => fmtDate(params.row.receipt_date) },
  { field: 'amount', headerName: 'Amount', width: 140, renderCell: (params) => <CurrencyCell value={params.value} /> },
  { field: 'method', headerName: 'Method', width: 120, valueGetter: (params) => capSnake(params.row.method) },
  { field: 'reference', headerName: 'Reference', flex: 1, minWidth: 160 },
];

export default function ReceiptsPage() {
  const { data: res, isLoading } = useReceipts();
  const allRows = res?.rows ?? [];

  const { data: clientRes } = useClients({ limit: 500 });
  const clients = clientRes?.rows ?? [];

  const [viewFilter, setViewFilter] = useState('active');
  const rows = useMemo(() => {
    if (viewFilter === 'active') return allRows.filter((r) => !r.deactivated_at);
    if (viewFilter === 'archived') return allRows.filter((r) => !!r.deactivated_at);
    return allRows;
  }, [allRows, viewFilter]);

  const { user } = useAuth();
  const caps = user?.perms?.caps || {};
  const canImport = resolveLevel(caps, 'ar', 'receipts', 'import') === 'full';
  const canExport = resolveLevel(caps, 'ar', 'receipts', 'export') !== 'none';

  const createMut = useCreateReceipt();
  const updateMut = useUpdateReceipt();
  const archiveMut = useArchiveReceipt();
  const restoreMut = useRestoreReceipt();
  const importMut = useImportXls(receiptApi.importXls, ['receipts']);
  const exportMut = useExportXls(receiptApi.exportXls, 'receipts');

  /* ── Selection (new system) ─────────────────────────────────── */
  const selection = useListSelection(rows);
  const { selectedRows, allActive, allArchived } = selection;

  /* ── Dialog state ───────────────────────────────────────────── */
  const viewDialog = useDialogState();
  const createDialog = useDialogState();
  const editDialog = useDialogState();

  const { form: createForm, field: onCreateField, reset: resetCreateForm } = useFormState(BLANK_CREATE);
  const { form: editForm, setForm: setEditForm, field: onEditField } = useFormState(BLANK_EDIT);

  const { toast, snackProps } = useToast();

  const importDialog = useDialogState();

  const handleImport = useCallback(async (formData) => {
    try {
      const result = await importMut.mutateAsync(formData);
      toast(`Imported ${result.inserted} records`);
      importDialog.close();
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

  /* ── Row action callbacks ──────────────────────────────────── */
  const handleView = useCallback((row) => {
    viewDialog.open(row);
  }, []);

  const handleEdit = useCallback((row) => {
    setEditForm({
      receipt_date: row.receipt_date?.slice(0, 10) ?? '', amount: row.amount ?? '',
      method: row.method ?? 'check', reference: row.reference ?? '', notes: row.notes ?? '',
    });
    editDialog.open(row);
  }, []);

  const handleCreate = async () => {
    try { await createMut.mutateAsync({ ...createForm, amount: Number(createForm.amount) || 0 }); toast('Receipt created'); createDialog.close(); resetCreateForm(); } catch (err) { toast(errMsg(err), 'error'); }
  };
  const handleUpdate = async () => {
    try { await updateMut.mutateAsync({ filter: { id: editDialog.data.id }, changes: { ...editForm, amount: Number(editForm.amount) || 0 } }); toast('Receipt updated'); editDialog.close(); } catch (err) { toast(errMsg(err), 'error'); }
  };

  const { setArchiveOpen, setRestoreOpen, archiveConfirmProps, restoreConfirmProps } = useArchiveRestore({
    selectedRows, archiveMut, restoreMut, entityName: 'receipt', setSelectionModel: () => selection.clearSelection(), toast, errMsg,
  });

  /* ── ModuleBar: tabs + Archive/Restore + Create ────────────── */
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
      primary.push({ label: 'Export', variant: 'outlined', disabled: exportMut.isPending, onClick: handleExport });
    }
    if (canImport) {
      primary.push({ label: 'Import', variant: 'outlined', onClick: () => importDialog.open() });
    }

    primary.push({
      label: 'Record Receipt',
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
      <Dialog open={viewDialog.isOpen} onClose={viewDialog.close} maxWidth="sm" fullWidth>
        <DialogTitle sx={dialogHeaderSx}>
          <Box>
            <span>Receipt Details</span>
            {viewDialog.data && (
              <Typography variant="body2" color="text.secondary">
                {viewDialog.data.reference || viewDialog.data.id?.slice(0, 8)}
              </Typography>
            )}
          </Box>
          <Box sx={dialogActionBoxSx}>
            <TertiaryButton size="small" onClick={viewDialog.close}>
              Close
            </TertiaryButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {viewDialog.data && (
            <Box sx={detailGridSx}>
              <FieldRow label="Receipt Date" value={fmtDate(viewDialog.data.receipt_date)} />
              <FieldRow label="Client" value={viewDialog.data.client_id?.slice(0, 8) || '\u2014'} />
              <FieldRow label="Amount" value={viewDialog.data.amount != null ? Number(viewDialog.data.amount).toLocaleString(undefined, { style: 'currency', currency: 'USD' }) : '\u2014'} />
              <FieldRow label="Method" value={capSnake(viewDialog.data.method)} />
              <FieldRow label="Reference" value={viewDialog.data.reference || '\u2014'} />
              <FieldRow label="Created" value={fmtDate(viewDialog.data.created_at)} />
              <FieldRow label="Updated" value={fmtDate(viewDialog.data.updated_at)} />
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Record Receipt Dialog ────────────────────────────────── */}
      <FormDialog open={createDialog.isOpen} title="Record Receipt" submitLabel="Create" loading={createMut.isPending} onSubmit={handleCreate} onCancel={createDialog.close}>
        <TextField label="Client" select required value={createForm.client_id} onChange={onCreateField('client_id')}>
          {clients.map((c) => <MenuItem key={c.id} value={c.id}>{c.client_code ? `${c.client_code} \u2014 ${c.name}` : c.name}</MenuItem>)}
        </TextField>
        <TextField label="AR Invoice ID" value={createForm.ar_invoice_id} onChange={onCreateField('ar_invoice_id')} helperText="UUID of the AR invoice" />
        <TextField label="Receipt Date" type="date" required value={createForm.receipt_date} onChange={onCreateField('receipt_date')} InputLabelProps={{ shrink: true }} />
        <TextField label="Amount" type="number" required value={createForm.amount} onChange={onCreateField('amount')} />
        <TextField label="Method" select value={createForm.method} onChange={onCreateField('method')}>
          {METHOD_OPTS.map((m) => <MenuItem key={m} value={m}>{capSnake(m)}</MenuItem>)}
        </TextField>
        <TextField label="Reference" value={createForm.reference} onChange={onCreateField('reference')} />
        <TextField label="Notes" multiline minRows={2} value={createForm.notes} onChange={onCreateField('notes')} />
      </FormDialog>

      {/* ── Edit Receipt Dialog ──────────────────────────────────── */}
      <FormDialog open={editDialog.isOpen} title="Edit Receipt" submitLabel="Save Changes" loading={updateMut.isPending} onSubmit={handleUpdate} onCancel={editDialog.close}>
        <TextField label="Receipt Date" type="date" value={editForm.receipt_date} onChange={onEditField('receipt_date')} InputLabelProps={{ shrink: true }} />
        <TextField label="Amount" type="number" value={editForm.amount} onChange={onEditField('amount')} />
        <TextField label="Method" select value={editForm.method} onChange={onEditField('method')}>
          {METHOD_OPTS.map((m) => <MenuItem key={m} value={m}>{capSnake(m)}</MenuItem>)}
        </TextField>
        <TextField label="Reference" value={editForm.reference} onChange={onEditField('reference')} />
        <TextField label="Notes" multiline minRows={2} value={editForm.notes} onChange={onEditField('notes')} />
      </FormDialog>

      <ConfirmDialog {...archiveConfirmProps} />
      <ConfirmDialog {...restoreConfirmProps} />

      <ImportDialog open={importDialog.isOpen} title="Import Receipts" loading={importMut.isPending} onSubmit={handleImport} onCancel={importDialog.close} />

      <ToastSnackbar {...snackProps} />
    </Box>
  );
}
