/**
 * @file AR Invoices CRUD page — DataTable + create/edit/view/archive/restore/approve
 * @module client/pages/AR/ArInvoicesPage
 *
 * No ar_clients — PRD removed ar_clients table.
 * AR invoices reference the unified clients table from core entities.
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
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

import ToastSnackbar from '../../components/shared/ToastSnackbar.jsx';
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
import { resolveLevel } from '@axerra/shared';
import { arInvoiceApi } from '../../services/arApi.js';
import { useToast } from '../../hooks/useToast.js';
import { capSnake, fmtDate, errMsg } from '../../utils/format.js';
import { statusColumn, dateColumn, currencyColumn } from '../../utils/columnHelpers.jsx';

const STATUS_OPTS = ['open', 'sent', 'paid', 'voided'];

const BLANK_CREATE = { client_id: '', invoice_number: '', invoice_date: '', due_date: '', total_amount: '', status: 'open', notes: '' };
const BLANK_EDIT = { invoice_number: '', invoice_date: '', due_date: '', total_amount: '', status: 'open', notes: '' };

const columns = [
  { field: 'invoice_number', headerName: 'Invoice #', width: 140 },
  { field: 'client_id', headerName: 'Client', width: 120, valueGetter: (params) => params.row.client_id?.slice(0, 8) ?? '\u2014' },
  dateColumn('invoice_date', 'Date'),
  dateColumn('due_date', 'Due'),
  currencyColumn('total_amount', 'Total'),
  statusColumn(),
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
      const ins = result?.inserted ?? 0;
      const upd = result?.updated ?? 0;
      toast(ins + upd === 0 ? 'Import complete — no changes' : `AR Invoices: ${ins} new, ${upd} updated`);
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
      invoice_number: row.invoice_number ?? '', invoice_date: row.invoice_date?.slice(0, 10) ?? '',
      due_date: row.due_date?.slice(0, 10) ?? '', total_amount: row.total_amount ?? '',
      status: row.status ?? 'open', notes: row.notes ?? '',
    });
    editDialog.open(row);
  }, []);

  const handleCreate = async () => {
    try {
      await createMut.mutateAsync({ ...createForm, total_amount: Number(createForm.total_amount) || 0 });
      toast('Invoice created'); createDialog.close(); resetCreateForm();
    } catch (err) { toast(errMsg(err), 'error'); }
  };
  const handleUpdate = async () => {
    try {
      await updateMut.mutateAsync({ filter: { id: editDialog.data.id }, changes: { ...editForm, total_amount: Number(editForm.total_amount) || 0 } });
      toast('Invoice updated'); editDialog.close();
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

    primary.push({
      label: 'Approve / Send',
      variant: 'outlined',
      disabled: !selection.isSingle || selection.selected?.status !== 'open',
      onClick: handleApprove,
    });

    if (canExport) {
      primary.push({ label: 'Export', variant: 'outlined', disabled: exportMut.isPending, onClick: handleExport });
    }
    if (canImport) {
      primary.push({ label: 'Import', variant: 'outlined', onClick: () => importDialog.open() });
    }

    primary.push({
      label: 'Create Invoice',
      variant: 'contained',
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
      <Dialog open={viewDialog.isOpen} onClose={viewDialog.close} maxWidth="sm" fullWidth>
        <DialogTitle sx={dialogHeaderSx}>
          <Box>
            <span>Invoice Details</span>
            {viewDialog.data && (
              <Typography variant="body2" color="text.secondary">
                {viewDialog.data.invoice_number}
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
              <FieldRow label="Invoice Number" value={viewDialog.data.invoice_number || '\u2014'} />
              <FieldRow label="Client" value={viewDialog.data.client_id?.slice(0, 8) || '\u2014'} />
              <FieldRow label="Invoice Date" value={fmtDate(viewDialog.data.invoice_date)} />
              <FieldRow label="Due Date" value={fmtDate(viewDialog.data.due_date)} />
              <FieldRow label="Total Amount" value={viewDialog.data.total_amount != null ? Number(viewDialog.data.total_amount).toLocaleString(undefined, { style: 'currency', currency: 'USD' }) : '\u2014'} />
              <FieldRow label="Status">
                <StatusBadge status={viewDialog.data.status} />
              </FieldRow>
              <FieldRow label="Created" value={fmtDate(viewDialog.data.created_at)} />
              <FieldRow label="Updated" value={fmtDate(viewDialog.data.updated_at)} />
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Create AR Invoice Dialog ─────────────────────────────── */}
      <FormDialog open={createDialog.isOpen} title="Create AR Invoice" submitLabel="Create" loading={createMut.isPending} onSubmit={handleCreate} onCancel={createDialog.close}>
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
      <FormDialog open={editDialog.isOpen} title="Edit AR Invoice" submitLabel="Save Changes" loading={updateMut.isPending} onSubmit={handleUpdate} onCancel={editDialog.close}>
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

      <ImportDialog open={importDialog.isOpen} title="Import AR Invoices" loading={importMut.isPending} onPreview={(fd) => arInvoiceApi.importXls(fd, { preview: true })} onSubmit={handleImport} onCancel={importDialog.close} />

      <ToastSnackbar {...snackProps} />
    </Box>
  );
}
