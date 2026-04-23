/**
 * @file Deliverables management page — list, create, edit, view, assign, status workflow
 * @module nap-client/pages/Activities/DeliverablesPage
 *
 * Status workflow: pending -> released -> finished -> canceled
 *
 * Migrated to standardised list-view selection system:
 *   useListSelection + DataTable + RowActionsMenu
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
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
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
  useDeliverables,
  useCreateDeliverable,
  useUpdateDeliverable,
  useArchiveDeliverable,
  useRestoreDeliverable,
} from '../../hooks/useDeliverables.js';
import { useImportXls, useExportXls } from '../../hooks/useImportExport.js';
import ToastSnackbar from '../../components/shared/ToastSnackbar.jsx';
import { resolveLevel } from '@nap/shared';
import { deliverableApi } from '../../services/deliverableApi.js';
import { pageContainerSx, formGridSx, dialogHeaderSx, dialogActionBoxSx, formFullSpanSx, detailGridSx, flexColumnSx } from '../../config/layoutTokens.js';
import { useListSelection } from '../../hooks/useListSelection.js';
import { useArchiveRestore } from '../../hooks/useArchiveRestore.js';
import { useToast } from '../../hooks/useToast.js';
import { fmtDate, errMsg } from '../../utils/format.js';

const BLANK_CREATE = { name: '', description: '', status: 'pending', start_date: '', end_date: '' };
const BLANK_EDIT = { name: '', description: '', status: '', start_date: '', end_date: '' };

const STATUSES = ['pending', 'released', 'finished', 'canceled'];

const columns = [
  { field: 'name', headerName: 'Name', flex: 1, minWidth: 200 },
  {
    field: 'status',
    headerName: 'Status',
    width: 120,
    renderCell: ({ value }) => <StatusBadge status={value} />,
  },
  { field: 'start_date', headerName: 'Start', width: 120 },
  { field: 'end_date', headerName: 'End', width: 120 },
  { field: 'created_at', headerName: 'Created', width: 160, valueGetter: (params) => params.row.created_at?.slice(0, 10) },
];

export default function DeliverablesPage() {
  const { user } = useAuth();
  const caps = user?.perms?.caps || {};
  const canImport = resolveLevel(caps, 'activities', 'deliverables', 'import') === 'full';
  const canExport = resolveLevel(caps, 'activities', 'deliverables', 'export') !== 'none';

  const { data: res, isLoading } = useDeliverables();
  const allRows = res?.rows ?? [];

  const [viewFilter, setViewFilter] = useState('active');
  const rows = useMemo(() => {
    if (viewFilter === 'active') return allRows.filter((r) => !r.deactivated_at);
    if (viewFilter === 'archived') return allRows.filter((r) => !!r.deactivated_at);
    return allRows;
  }, [allRows, viewFilter]);

  const createMut = useCreateDeliverable();
  const updateMut = useUpdateDeliverable();
  const archiveMut = useArchiveDeliverable();
  const restoreMut = useRestoreDeliverable();

  const importMut = useImportXls(deliverableApi.importXls, ['deliverables']);
  const exportMut = useExportXls(deliverableApi.exportXls, 'deliverables');

  /* ── Selection (new system) ─────────────────────────────────── */
  const selection = useListSelection(rows);
  const { selectedRows, allActive, allArchived } = selection;

  /* ── Dialog state ───────────────────────────────────────────── */
  const importDialog = useDialogState();
  const viewDialog = useDialogState();
  const createDialog = useDialogState();
  const editDialog = useDialogState();

  const { form: createForm, field: onCreateField, reset: resetCreateForm } = useFormState(BLANK_CREATE);
  const { form: editForm, setForm: setEditForm, field: onEditField } = useFormState(BLANK_EDIT);

  const { toast, snackProps } = useToast();

  /* ── Row action callbacks ──────────────────────────────────── */
  const handleView = useCallback((row) => {
    viewDialog.open(row);
  }, []);

  const handleEdit = useCallback((row) => {
    setEditForm({
      name: row.name || '',
      description: row.description || '',
      status: row.status || '',
      start_date: row.start_date || '',
      end_date: row.end_date || '',
    });
    editDialog.open(row);
  }, []);

  const handleCreate = async () => {
    try {
      await createMut.mutateAsync(createForm);
      toast('Deliverable created');
      createDialog.close();
      resetCreateForm();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };

  const handleUpdate = async () => {
    try {
      await updateMut.mutateAsync({ filter: { id: editDialog.data.id }, changes: editForm });
      toast('Deliverable updated');
      editDialog.close();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };

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

  const { setArchiveOpen, setRestoreOpen, archiveConfirmProps, restoreConfirmProps } = useArchiveRestore({
    selectedRows,
    archiveMut,
    restoreMut,
    entityName: 'deliverable',
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
      primary.push({ label: 'Export', variant: 'outlined', disabled: exportMut.isPending, onClick: handleExport });
    }
    if (canImport) {
      primary.push({ label: 'Import', variant: 'outlined', onClick: () => importDialog.open() });
    }

    primary.push({
      label: 'Create',
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
            <span>Deliverable Details</span>
            {viewDialog.data && (
              <Typography variant="body2" color="text.secondary">
                {viewDialog.data.name}
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
            <Box sx={flexColumnSx}>
              <Box sx={detailGridSx}>
                <FieldRow label="Name" value={viewDialog.data.name} />
                <FieldRow label="Status">
                  <StatusBadge status={viewDialog.data.status} />
                </FieldRow>
                <FieldRow label="Start Date" value={fmtDate(viewDialog.data.start_date)} />
                <FieldRow label="End Date" value={fmtDate(viewDialog.data.end_date)} />
                <FieldRow label="Description" value={viewDialog.data.description || '\u2014'} />
                <FieldRow label="Created" value={fmtDate(viewDialog.data.created_at)} />
                <FieldRow label="Updated" value={fmtDate(viewDialog.data.updated_at)} />
              </Box>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <FormDialog open={createDialog.isOpen} title="Create Deliverable" submitLabel="Create" loading={createMut.isPending} onSubmit={handleCreate} onCancel={createDialog.close}>
        <Box sx={formGridSx}>
          <TextField label="Name" required value={createForm.name} onChange={onCreateField('name')} inputProps={{ maxLength: 128 }} />
          <TextField label="Status" select value={createForm.status} onChange={onCreateField('status')}>
            {STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </TextField>
          <TextField label="Start Date" type="date" value={createForm.start_date} onChange={onCreateField('start_date')} InputLabelProps={{ shrink: true }} />
          <TextField label="End Date" type="date" value={createForm.end_date} onChange={onCreateField('end_date')} InputLabelProps={{ shrink: true }} />
          <TextField label="Description" multiline rows={3} value={createForm.description} onChange={onCreateField('description')} sx={formFullSpanSx} />
        </Box>
      </FormDialog>

      {/* Edit Dialog */}
      <FormDialog open={editDialog.isOpen} title="Edit Deliverable" submitLabel="Save" loading={updateMut.isPending} onSubmit={handleUpdate} onCancel={editDialog.close}>
        <Box sx={formGridSx}>
          <TextField label="Name" required value={editForm.name} onChange={onEditField('name')} inputProps={{ maxLength: 128 }} />
          <TextField label="Status" select value={editForm.status} onChange={onEditField('status')}>
            {STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </TextField>
          <TextField label="Start Date" type="date" value={editForm.start_date} onChange={onEditField('start_date')} InputLabelProps={{ shrink: true }} />
          <TextField label="End Date" type="date" value={editForm.end_date} onChange={onEditField('end_date')} InputLabelProps={{ shrink: true }} />
          <TextField label="Description" multiline rows={3} value={editForm.description} onChange={onEditField('description')} sx={formFullSpanSx} />
        </Box>
      </FormDialog>

      <ImportDialog
        open={importDialog.isOpen}
        title="Import Deliverables"
        loading={importMut.isPending}
        onSubmit={handleImport}
        onCancel={importDialog.close}
      />

      <ConfirmDialog {...archiveConfirmProps} />
      <ConfirmDialog {...restoreConfirmProps} />

      <ToastSnackbar {...snackProps} />
    </Box>
  );
}
