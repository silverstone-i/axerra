/**
 * @file Change Orders CRUD page — DataTable + create/edit/view/archive/restore
 * @module nap-client/pages/Projects/ChangeOrdersPage
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
 */

import { useState, useMemo, useCallback } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import StatusBadge from '../../components/shared/StatusBadge.jsx';
import ConfirmDialog from '../../components/shared/ConfirmDialog.jsx';
import DataTable from '../../components/shared/DataTable.jsx';
import FieldRow from '../../components/shared/FieldRow.jsx';
import FormDialog from '../../components/shared/FormDialog.jsx';
import ImportDialog from '../../components/shared/ImportDialog.jsx';
import { useModuleToolbarRegistration } from '../../contexts/ModuleActionsContext.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import {
  useChangeOrders, useCreateChangeOrder, useUpdateChangeOrder, useArchiveChangeOrder, useRestoreChangeOrder,
} from '../../hooks/useChangeOrders.js';
import { useImportXls, useExportXls } from '../../hooks/useImportExport.js';
import ToastSnackbar from '../../components/shared/ToastSnackbar.jsx';
import { resolveLevel } from '@nap/shared';
import { changeOrderApi } from '../../services/changeOrderApi.js';
import { pageContainerSx, dialogHeaderSx, dialogActionBoxSx, detailGridSx } from '../../config/layoutTokens.js';
import { useListSelection } from '../../hooks/useListSelection.js';
import { useArchiveRestore } from '../../hooks/useArchiveRestore.js';
import { useToast } from '../../hooks/useToast.js';
import { fmtDate, errMsg } from '../../utils/format.js';

const BLANK_CREATE = { unit_id: '', co_number: '', title: '', reason: '', total_amount: '' };
const BLANK_EDIT = { co_number: '', title: '', reason: '', total_amount: '' };

const STATUS_MAP = { draft: 'active', submitted: 'active', approved: 'active', rejected: 'suspended' };

const columns = [
  { field: 'co_number', headerName: 'CO #', width: 120 },
  { field: 'title', headerName: 'Title', flex: 1, minWidth: 200 },
  {
    field: 'status',
    headerName: 'Status',
    width: 120,
    renderCell: ({ value }) => <StatusBadge status={STATUS_MAP[value] || 'active'} label={value} />,
  },
  { field: 'total_amount', headerName: 'Amount', width: 140, type: 'number' },
];

export default function ChangeOrdersPage() {
  const { user } = useAuth();
  const caps = user?.perms?.caps || {};
  const canImport = resolveLevel(caps, 'projects', 'change-orders', 'import') === 'full';
  const canExport = resolveLevel(caps, 'projects', 'change-orders', 'export') !== 'none';

  const { data: res, isLoading } = useChangeOrders();
  const allRows = res?.rows ?? [];

  const [viewFilter, setViewFilter] = useState('active');
  const rows = useMemo(() => {
    if (viewFilter === 'active') return allRows.filter((r) => !r.deactivated_at);
    if (viewFilter === 'archived') return allRows.filter((r) => !!r.deactivated_at);
    return allRows;
  }, [allRows, viewFilter]);

  const createMut = useCreateChangeOrder();
  const updateMut = useUpdateChangeOrder();
  const archiveMut = useArchiveChangeOrder();
  const restoreMut = useRestoreChangeOrder();

  const importMut = useImportXls(changeOrderApi.importXls, ['changeOrders']);
  const exportMut = useExportXls(changeOrderApi.exportXls, 'change_orders');

  /* ── Selection (new system) ─────────────────────────────────── */
  const selection = useListSelection(rows);
  const { selectedRows, allActive, allArchived } = selection;

  /* ── Dialog state ───────────────────────────────────────────── */
  const [importOpen, setImportOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewCO, setViewCO] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);

  const [createForm, setCreateForm] = useState(BLANK_CREATE);
  const [editForm, setEditForm] = useState(BLANK_EDIT);

  const { toast, snackProps } = useToast();

  const onCreateField = (f) => (e) => setCreateForm((p) => ({ ...p, [f]: e.target.value }));
  const onEditField = (f) => (e) => setEditForm((p) => ({ ...p, [f]: e.target.value }));

  /* ── Row action callbacks ──────────────────────────────────── */
  const handleView = useCallback((row) => {
    setViewCO(row);
    setViewOpen(true);
  }, []);

  const handleEdit = useCallback((row) => {
    setEditRow(row);
    setEditForm({
      co_number: row.co_number ?? '',
      title: row.title ?? '',
      reason: row.reason ?? '',
      total_amount: row.total_amount ?? '',
    });
    setEditOpen(true);
  }, []);

  const handleCreate = async () => {
    try {
      await createMut.mutateAsync(createForm);
      toast('Change order created');
      setCreateOpen(false);
      setCreateForm(BLANK_CREATE);
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };

  const handleUpdate = async () => {
    try {
      await updateMut.mutateAsync({ filter: { id: editRow.id }, changes: editForm });
      toast('Change order updated');
      setEditOpen(false);
      setEditRow(null);
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };

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

  const { setArchiveOpen, setRestoreOpen, archiveConfirmProps, restoreConfirmProps } = useArchiveRestore({
    selectedRows,
    archiveMut,
    restoreMut,
    entityName: 'change order',
    entityNamePlural: 'change orders',
    setSelectionModel: () => selection.clearSelection(),
    toast,
    errMsg,
    getLabel: (r) => r.title,
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
      label: 'Create CO',
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
            <span>Change Order Details</span>
            {viewCO && (
              <Typography variant="body2" color="text.secondary">
                {viewCO.title}
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
          {viewCO && (
            <Box sx={detailGridSx}>
              <FieldRow label="CO Number" value={viewCO.co_number || '\u2014'} />
              <FieldRow label="Title" value={viewCO.title} />
              <FieldRow label="Status">
                <StatusBadge status={STATUS_MAP[viewCO.status] || 'active'} label={viewCO.status} />
              </FieldRow>
              <FieldRow label="Total Amount" value={viewCO.total_amount ?? '\u2014'} />
              <FieldRow label="Created" value={fmtDate(viewCO.created_at)} />
              <FieldRow label="Updated" value={fmtDate(viewCO.updated_at)} />
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Create Change Order Dialog ────────────────────────────── */}
      <FormDialog open={createOpen} title="Create Change Order" submitLabel="Create" loading={createMut.isPending} onSubmit={handleCreate} onCancel={() => setCreateOpen(false)}>
        <TextField label="Unit ID" required value={createForm.unit_id} onChange={onCreateField('unit_id')} helperText="UUID of the unit" />
        <TextField label="CO Number" required value={createForm.co_number} onChange={onCreateField('co_number')} inputProps={{ maxLength: 16 }} />
        <TextField label="Title" required value={createForm.title} onChange={onCreateField('title')} />
        <TextField label="Reason" multiline minRows={2} value={createForm.reason} onChange={onCreateField('reason')} />
        <TextField label="Total Amount" type="number" value={createForm.total_amount} onChange={onCreateField('total_amount')} />
      </FormDialog>

      {/* ── Edit Change Order Dialog ──────────────────────────────── */}
      <FormDialog open={editOpen} title="Edit Change Order" submitLabel="Save Changes" loading={updateMut.isPending} onSubmit={handleUpdate} onCancel={() => { setEditOpen(false); setEditRow(null); }}>
        <TextField label="CO Number" required value={editForm.co_number} onChange={onEditField('co_number')} inputProps={{ maxLength: 16 }} />
        <TextField label="Title" required value={editForm.title} onChange={onEditField('title')} />
        <TextField label="Reason" multiline minRows={2} value={editForm.reason} onChange={onEditField('reason')} />
        <TextField label="Total Amount" type="number" value={editForm.total_amount} onChange={onEditField('total_amount')} />
      </FormDialog>

      <ImportDialog open={importOpen} title="Import Change Orders" loading={importMut.isPending} onSubmit={handleImport} onCancel={() => setImportOpen(false)} />

      <ConfirmDialog {...archiveConfirmProps} />
      <ConfirmDialog {...restoreConfirmProps} />

      <ToastSnackbar {...snackProps} />
    </Box>
  );
}
