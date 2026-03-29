/**
 * @file AR Invoices CRUD page — DataTable + create/edit/view/archive/restore/approve
 * @module nap-client/pages/AR/ArInvoicesPage
 *
 * No ar_clients — PRD removed ar_clients table.
 * AR invoices reference the unified clients table from core entities.
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
 */

import { useState, useMemo, useCallback } from 'react';
import { useFormState } from '../../hooks/useFormState.js';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import StatusBadge from '../../components/shared/StatusBadge.jsx';
import ToastSnackbar from '../../components/shared/ToastSnackbar.jsx';
import CurrencyCell from '../../components/shared/CurrencyCell.jsx';
import ConfirmDialog from '../../components/shared/ConfirmDialog.jsx';
import DataTable from '../../components/shared/DataTable.jsx';
import FieldRow from '../../components/shared/FieldRow.jsx';
import FormDialog from '../../components/shared/FormDialog.jsx';
import { useModuleToolbarRegistration } from '../../contexts/ModuleActionsContext.jsx';
import {
  useArInvoices, useCreateArInvoice, useUpdateArInvoice,
  useArchiveArInvoice, useRestoreArInvoice, useApproveArInvoice,
} from '../../hooks/useAr.js';
import { useClients } from '../../hooks/useClients.js';
import { pageContainerSx, dialogHeaderSx, dialogActionBoxSx, detailGridSx } from '../../config/layoutTokens.js';
import { useListSelection } from '../../hooks/useListSelection.js';
import { useArchiveRestore } from '../../hooks/useArchiveRestore.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useImportXls, useExportXls } from '../../hooks/useImportExport.js';
import ImportDialog from '../../components/shared/ImportDialog.jsx';
import { resolveLevel } from '@nap/shared';
import { arInvoiceApi } from '../../services/arApi.js';
import { useToast } from '../../hooks/useToast.js';
import { capSnake, fmtDate, errMsg } from '../../utils/format.js';

const STATUS_OPTS = ['open', 'sent', 'paid', 'voided'];

const BLANK_CREATE = { client_id: '', invoice_number: '', invoice_date: '', due_date: '', total_amount: '', status: 'open', notes: '' };
const BLANK_EDIT = { invoice_number: '', invoice_date: '', due_date: '', total_amount: '', status: 'open', notes: '' };

const columns = [
  { field: 'invoice_number', headerName: 'Invoice #', width: 140 },
  { field: 'client_id', headerName: 'Client', width: 120, valueGetter: (params) => params.row.client_id?.slice(0, 8) ?? '\u2014' },
  { field: 'invoice_date', headerName: 'Date', width: 120, valueGetter: (params) => fmtDate(params.row.invoice_date) },
  { field: 'due_date', headerName: 'Due', width: 120, valueGetter: (params) => fmtDate(params.row.due_date) },
  { field: 'total_amount', headerName: 'Total', width: 140, renderCell: (params) => <CurrencyCell value={params.value} /> },
  { field: 'status', headerName: 'Status', width: 120, renderCell: ({ value }) => <StatusBadge status={value} /> },
];

export default function ArInvoicesPage() {
  const { data: res, isLoading } = useArInvoices();
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
  const canImport = resolveLevel(caps, 'ar', 'ar-invoices', 'import') === 'full';
  const canExport = resolveLevel(caps, 'ar', 'ar-invoices', 'export') !== 'none';

  const createMut = useCreateArInvoice();
  const updateMut = useUpdateArInvoice();
  const archiveMut = useArchiveArInvoice();
  const restoreMut = useRestoreArInvoice();
  const approveMut = useApproveArInvoice();
  const importMut = useImportXls(arInvoiceApi.importXls, ['arInvoices']);
  const exportMut = useExportXls(arInvoiceApi.exportXls, 'ar_invoices');

  /* ── Selection (new system) ─────────────────────────────────── */
  const selection = useListSelection(rows);
  const { selectedRows, allActive, allArchived } = selection;

  /* ── Dialog state ───────────────────────────────────────────── */
  const [viewOpen, setViewOpen] = useState(false);
  const [viewInvoice, setViewInvoice] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);

  const { form: createForm, field: onCreateField, reset: resetCreateForm } = useFormState(BLANK_CREATE);
  const { form: editForm, setForm: setEditForm, field: onEditField } = useFormState(BLANK_EDIT);

  const { toast, snackProps } = useToast();

  const [importOpen, setImportOpen] = useState(false);

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

  /* ── Row action callbacks ──────────────────────────────────── */
  const handleView = useCallback((row) => {
    setViewInvoice(row);
    setViewOpen(true);
  }, []);

  const handleEdit = useCallback((row) => {
    setEditRow(row);
    setEditForm({
      invoice_number: row.invoice_number ?? '', invoice_date: row.invoice_date?.slice(0, 10) ?? '',
      due_date: row.due_date?.slice(0, 10) ?? '', total_amount: row.total_amount ?? '',
      status: row.status ?? 'open', notes: row.notes ?? '',
    });
    setEditOpen(true);
  }, []);

  const handleCreate = async () => {
    try {
      await createMut.mutateAsync({ ...createForm, total_amount: Number(createForm.total_amount) || 0 });
      toast('Invoice created'); setCreateOpen(false); resetCreateForm();
    } catch (err) { toast(errMsg(err), 'error'); }
  };
  const handleUpdate = async () => {
    try {
      await updateMut.mutateAsync({ filter: { id: editRow.id }, changes: { ...editForm, total_amount: Number(editForm.total_amount) || 0 } });
      toast('Invoice updated'); setEditOpen(false); setEditRow(null);
    } catch (err) { toast(errMsg(err), 'error'); }
  };
  const handleApprove = async () => {
    try { await approveMut.mutateAsync({ id: selection.selected.id }); toast('Invoice approved and sent'); } catch (err) { toast(errMsg(err), 'error'); }
  };

  const { setArchiveOpen, setRestoreOpen, archiveConfirmProps, restoreConfirmProps } = useArchiveRestore({
    selectedRows, archiveMut, restoreMut, entityName: 'invoice', setSelectionModel: () => selection.clearSelection(), toast, errMsg, getLabel: (r) => r.invoice_number,
  });

  /* ── ModuleBar: tabs + Archive/Restore + Approve + Create ──── */
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
      label: 'Approve / Send',
      variant: 'outlined',
      color: 'success',
      disabled: !selection.isSingle || selection.selected?.status !== 'open',
      onClick: handleApprove,
    });

    if (canExport) {
      primary.push({ label: 'Export', variant: 'outlined', disabled: exportMut.isPending, onClick: handleExport });
    }
    if (canImport) {
      primary.push({ label: 'Import', variant: 'outlined', onClick: () => setImportOpen(true) });
    }

    primary.push({
      label: 'Create Invoice',
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
  }, [viewFilter, selectedRows.length, allActive, allArchived, selection.clearSelection, selection.isSingle, selection.selected, handleApprove, setArchiveOpen, setRestoreOpen, canImport, canExport, exportMut.isPending, handleExport]);
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
      <Dialog open={viewOpen} onClose={() => setViewOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={dialogHeaderSx}>
          <Box>
            <span>Invoice Details</span>
            {viewInvoice && (
              <Typography variant="body2" color="text.secondary">
                {viewInvoice.invoice_number}
              </Typography>
            )}
          </Box>
          <Box sx={dialogActionBoxSx}>
            <Button size="small" color="inherit" onClick={() => setViewOpen(false)}>
              Close
            </Button>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {viewInvoice && (
            <Box sx={detailGridSx}>
              <FieldRow label="Invoice Number" value={viewInvoice.invoice_number || '\u2014'} />
              <FieldRow label="Client" value={viewInvoice.client_id?.slice(0, 8) || '\u2014'} />
              <FieldRow label="Invoice Date" value={fmtDate(viewInvoice.invoice_date)} />
              <FieldRow label="Due Date" value={fmtDate(viewInvoice.due_date)} />
              <FieldRow label="Total Amount" value={viewInvoice.total_amount != null ? Number(viewInvoice.total_amount).toLocaleString(undefined, { style: 'currency', currency: 'USD' }) : '\u2014'} />
              <FieldRow label="Status">
                <StatusBadge status={viewInvoice.status} />
              </FieldRow>
              <FieldRow label="Created" value={fmtDate(viewInvoice.created_at)} />
              <FieldRow label="Updated" value={fmtDate(viewInvoice.updated_at)} />
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Create AR Invoice Dialog ─────────────────────────────── */}
      <FormDialog open={createOpen} title="Create AR Invoice" submitLabel="Create" loading={createMut.isPending} onSubmit={handleCreate} onCancel={() => setCreateOpen(false)}>
        <TextField label="Client" select required value={createForm.client_id} onChange={onCreateField('client_id')}>
          {clients.map((c) => <MenuItem key={c.id} value={c.id}>{c.client_code ? `${c.client_code} \u2014 ${c.name}` : c.name}</MenuItem>)}
        </TextField>
        <TextField label="Invoice Number" required value={createForm.invoice_number} onChange={onCreateField('invoice_number')} />
        <TextField label="Invoice Date" type="date" required value={createForm.invoice_date} onChange={onCreateField('invoice_date')} InputLabelProps={{ shrink: true }} />
        <TextField label="Due Date" type="date" value={createForm.due_date} onChange={onCreateField('due_date')} InputLabelProps={{ shrink: true }} />
        <TextField label="Total Amount" type="number" required value={createForm.total_amount} onChange={onCreateField('total_amount')} />
        <TextField label="Status" select value={createForm.status} onChange={onCreateField('status')}>
          {STATUS_OPTS.map((s) => <MenuItem key={s} value={s}>{capSnake(s)}</MenuItem>)}
        </TextField>
        <TextField label="Notes" multiline minRows={2} value={createForm.notes} onChange={onCreateField('notes')} />
      </FormDialog>

      {/* ── Edit AR Invoice Dialog ───────────────────────────────── */}
      <FormDialog open={editOpen} title="Edit AR Invoice" submitLabel="Save Changes" loading={updateMut.isPending} onSubmit={handleUpdate} onCancel={() => { setEditOpen(false); setEditRow(null); }}>
        <TextField label="Invoice Number" value={editForm.invoice_number} onChange={onEditField('invoice_number')} />
        <TextField label="Invoice Date" type="date" value={editForm.invoice_date} onChange={onEditField('invoice_date')} InputLabelProps={{ shrink: true }} />
        <TextField label="Due Date" type="date" value={editForm.due_date} onChange={onEditField('due_date')} InputLabelProps={{ shrink: true }} />
        <TextField label="Total Amount" type="number" value={editForm.total_amount} onChange={onEditField('total_amount')} />
        <TextField label="Status" select value={editForm.status} onChange={onEditField('status')}>
          {STATUS_OPTS.map((s) => <MenuItem key={s} value={s}>{capSnake(s)}</MenuItem>)}
        </TextField>
        <TextField label="Notes" multiline minRows={2} value={editForm.notes} onChange={onEditField('notes')} />
      </FormDialog>

      <ConfirmDialog {...archiveConfirmProps} />
      <ConfirmDialog {...restoreConfirmProps} />

      <ImportDialog open={importOpen} title="Import AR Invoices" loading={importMut.isPending} onSubmit={handleImport} onCancel={() => setImportOpen(false)} />

      <ToastSnackbar {...snackProps} />
    </Box>
  );
}
