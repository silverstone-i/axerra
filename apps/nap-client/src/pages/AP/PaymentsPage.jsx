/**
 * @file Payments CRUD page — DataTable + create/edit/view/archive/restore
 * @module nap-client/pages/AP/PaymentsPage
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
 */

import { useState, useMemo, useCallback } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import ToastSnackbar from '../../components/shared/ToastSnackbar.jsx';
import { useToast } from '../../hooks/useToast.js';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import CurrencyCell from '../../components/shared/CurrencyCell.jsx';
import ConfirmDialog from '../../components/shared/ConfirmDialog.jsx';
import DataTable from '../../components/shared/DataTable.jsx';
import FieldRow from '../../components/shared/FieldRow.jsx';
import FormDialog from '../../components/shared/FormDialog.jsx';
import { useModuleToolbarRegistration } from '../../contexts/ModuleActionsContext.jsx';
import { usePayments, useCreatePayment, useUpdatePayment, useArchivePayment, useRestorePayment } from '../../hooks/useAp.js';
import { useVendors } from '../../hooks/useVendors.js';
import { pageContainerSx, dialogHeaderSx, dialogActionBoxSx, detailGridSx } from '../../config/layoutTokens.js';
import { useListSelection } from '../../hooks/useListSelection.js';
import { useArchiveRestore } from '../../hooks/useArchiveRestore.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useImportXls, useExportXls } from '../../hooks/useImportExport.js';
import ImportDialog from '../../components/shared/ImportDialog.jsx';
import { resolveLevel } from '@nap/shared';
import { paymentApi } from '../../services/apApi.js';
import { capSnake, fmtDate, errMsg } from '../../utils/format.js';

const METHOD_OPTS = ['check', 'ach', 'wire'];

const BLANK_CREATE = { vendor_id: '', ap_invoice_id: '', payment_date: '', amount: '', method: 'check', reference: '', notes: '' };
const BLANK_EDIT = { payment_date: '', amount: '', method: 'check', reference: '', notes: '' };

const columns = [
  { field: 'id', headerName: 'ID', width: 100, valueGetter: (params) => params.row.id?.slice(0, 8) },
  { field: 'vendor_id', headerName: 'Vendor', width: 120, valueGetter: (params) => params.row.vendor_id?.slice(0, 8) ?? '\u2014' },
  { field: 'payment_date', headerName: 'Date', width: 120, valueGetter: (params) => fmtDate(params.row.payment_date) },
  { field: 'amount', headerName: 'Amount', width: 140, renderCell: (params) => <CurrencyCell value={params.value} /> },
  { field: 'method', headerName: 'Method', width: 120, valueGetter: (params) => capSnake(params.row.method) },
  { field: 'reference', headerName: 'Reference', flex: 1, minWidth: 160 },
];

export default function PaymentsPage() {
  const { data: res, isLoading } = usePayments();
  const allRows = res?.rows ?? [];

  const { data: vendorRes } = useVendors({ limit: 500 });
  const vendors = vendorRes?.rows ?? [];

  const [viewFilter, setViewFilter] = useState('active');
  const rows = useMemo(() => {
    if (viewFilter === 'active') return allRows.filter((r) => !r.deactivated_at);
    if (viewFilter === 'archived') return allRows.filter((r) => !!r.deactivated_at);
    return allRows;
  }, [allRows, viewFilter]);

  const { user } = useAuth();
  const caps = user?.perms?.caps || {};
  const canImport = resolveLevel(caps, 'ap', 'payments', 'import') === 'full';
  const canExport = resolveLevel(caps, 'ap', 'payments', 'export') !== 'none';

  const createMut = useCreatePayment();
  const updateMut = useUpdatePayment();
  const archiveMut = useArchivePayment();
  const restoreMut = useRestorePayment();
  const importMut = useImportXls(paymentApi.importXls, ['payments']);
  const exportMut = useExportXls(paymentApi.exportXls, 'payments');

  /* ── Selection (new system) ─────────────────────────────────── */
  const selection = useListSelection(rows);
  const { selectedRows, allActive, allArchived } = selection;

  /* ── Dialog state ───────────────────────────────────────────── */
  const [viewOpen, setViewOpen] = useState(false);
  const [viewPayment, setViewPayment] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);

  const [createForm, setCreateForm] = useState(BLANK_CREATE);
  const [editForm, setEditForm] = useState(BLANK_EDIT);

  const { toast, snackProps } = useToast();

  const [importOpen, setImportOpen] = useState(false);

  const onCreateField = (f) => (e) => setCreateForm((p) => ({ ...p, [f]: e.target.value }));
  const onEditField = (f) => (e) => setEditForm((p) => ({ ...p, [f]: e.target.value }));

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
    setViewPayment(row);
    setViewOpen(true);
  }, []);

  const handleEdit = useCallback((row) => {
    setEditRow(row);
    setEditForm({
      payment_date: row.payment_date?.slice(0, 10) ?? '', amount: row.amount ?? '',
      method: row.method ?? 'check', reference: row.reference ?? '', notes: row.notes ?? '',
    });
    setEditOpen(true);
  }, []);

  const handleCreate = async () => {
    try { await createMut.mutateAsync({ ...createForm, amount: Number(createForm.amount) || 0 }); toast('Payment created'); setCreateOpen(false); setCreateForm(BLANK_CREATE); } catch (err) { toast(errMsg(err), 'error'); }
  };
  const handleUpdate = async () => {
    try { await updateMut.mutateAsync({ filter: { id: editRow.id }, changes: { ...editForm, amount: Number(editForm.amount) || 0 } }); toast('Payment updated'); setEditOpen(false); setEditRow(null); } catch (err) { toast(errMsg(err), 'error'); }
  };

  const { setArchiveOpen, setRestoreOpen, archiveConfirmProps, restoreConfirmProps } = useArchiveRestore({
    selectedRows, archiveMut, restoreMut, entityName: 'payment', setSelectionModel: () => selection.clearSelection(), toast, errMsg,
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
      primary.push({ label: 'Import', variant: 'outlined', onClick: () => setImportOpen(true) });
    }

    primary.push({
      label: 'Record Payment',
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
      <Dialog open={viewOpen} onClose={() => setViewOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={dialogHeaderSx}>
          <Box>
            <span>Payment Details</span>
            {viewPayment && (
              <Typography variant="body2" color="text.secondary">
                {viewPayment.reference || viewPayment.id?.slice(0, 8)}
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
          {viewPayment && (
            <Box sx={detailGridSx}>
              <FieldRow label="Payment Date" value={fmtDate(viewPayment.payment_date)} />
              <FieldRow label="Vendor" value={viewPayment.vendor_id?.slice(0, 8) || '\u2014'} />
              <FieldRow label="Amount" value={viewPayment.amount != null ? Number(viewPayment.amount).toLocaleString(undefined, { style: 'currency', currency: 'USD' }) : '\u2014'} />
              <FieldRow label="Method" value={capSnake(viewPayment.method)} />
              <FieldRow label="Reference" value={viewPayment.reference || '\u2014'} />
              <FieldRow label="Created" value={fmtDate(viewPayment.created_at)} />
              <FieldRow label="Updated" value={fmtDate(viewPayment.updated_at)} />
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Record Payment Dialog ────────────────────────────────── */}
      <FormDialog open={createOpen} title="Record Payment" submitLabel="Create" loading={createMut.isPending} onSubmit={handleCreate} onCancel={() => setCreateOpen(false)}>
        <TextField label="Vendor" select required value={createForm.vendor_id} onChange={onCreateField('vendor_id')}>
          {vendors.map((v) => <MenuItem key={v.id} value={v.id}>{v.code ? `${v.code} \u2014 ${v.name}` : v.name}</MenuItem>)}
        </TextField>
        <TextField label="AP Invoice ID" value={createForm.ap_invoice_id} onChange={onCreateField('ap_invoice_id')} helperText="UUID (optional)" />
        <TextField label="Payment Date" type="date" required value={createForm.payment_date} onChange={onCreateField('payment_date')} InputLabelProps={{ shrink: true }} />
        <TextField label="Amount" type="number" required value={createForm.amount} onChange={onCreateField('amount')} />
        <TextField label="Method" select value={createForm.method} onChange={onCreateField('method')}>
          {METHOD_OPTS.map((m) => <MenuItem key={m} value={m}>{capSnake(m)}</MenuItem>)}
        </TextField>
        <TextField label="Reference" value={createForm.reference} onChange={onCreateField('reference')} />
        <TextField label="Notes" multiline minRows={2} value={createForm.notes} onChange={onCreateField('notes')} />
      </FormDialog>

      {/* ── Edit Payment Dialog ──────────────────────────────────── */}
      <FormDialog open={editOpen} title="Edit Payment" submitLabel="Save Changes" loading={updateMut.isPending} onSubmit={handleUpdate} onCancel={() => { setEditOpen(false); setEditRow(null); }}>
        <TextField label="Payment Date" type="date" value={editForm.payment_date} onChange={onEditField('payment_date')} InputLabelProps={{ shrink: true }} />
        <TextField label="Amount" type="number" value={editForm.amount} onChange={onEditField('amount')} />
        <TextField label="Method" select value={editForm.method} onChange={onEditField('method')}>
          {METHOD_OPTS.map((m) => <MenuItem key={m} value={m}>{capSnake(m)}</MenuItem>)}
        </TextField>
        <TextField label="Reference" value={editForm.reference} onChange={onEditField('reference')} />
        <TextField label="Notes" multiline minRows={2} value={editForm.notes} onChange={onEditField('notes')} />
      </FormDialog>

      <ConfirmDialog {...archiveConfirmProps} />
      <ConfirmDialog {...restoreConfirmProps} />

      <ImportDialog open={importOpen} title="Import Payments" loading={importMut.isPending} onSubmit={handleImport} onCancel={() => setImportOpen(false)} />

      <ToastSnackbar {...snackProps} />
    </Box>
  );
}
