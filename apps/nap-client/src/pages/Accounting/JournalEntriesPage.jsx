/**
 * @file Journal Entries CRUD page — DataTable + create/edit/view/post/reverse/archive/restore
 * @module nap-client/pages/Accounting/JournalEntriesPage
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
import ToastSnackbar from '../../components/shared/ToastSnackbar.jsx';
import { useToast } from '../../hooks/useToast.js';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import ConfirmDialog from '../../components/shared/ConfirmDialog.jsx';
import DataTable from '../../components/shared/DataTable.jsx';
import FieldRow from '../../components/shared/FieldRow.jsx';
import FormDialog from '../../components/shared/FormDialog.jsx';
import ImportDialog from '../../components/shared/ImportDialog.jsx';
import { useModuleToolbarRegistration } from '../../contexts/ModuleActionsContext.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import {
  useJournalEntries, useCreateJournalEntry, useUpdateJournalEntry,
  usePostJournalEntry, useReverseJournalEntry,
  useArchiveJournalEntry, useRestoreJournalEntry,
} from '../../hooks/useAccounting.js';
import { useImportXls, useExportXls } from '../../hooks/useImportExport.js';
import { resolveLevel } from '@nap/shared';
import { journalEntryApi } from '../../services/accountingApi.js';
import { pageContainerSx, dialogHeaderSx, dialogActionBoxSx, detailGridSx } from '../../config/layoutTokens.js';
import { useListSelection } from '../../hooks/useListSelection.js';
import { useArchiveRestore } from '../../hooks/useArchiveRestore.js';
import { capSnake, fmtDate, errMsg } from '../../utils/format.js';
import { statusColumn, dateColumn, capColumn } from '../../utils/columnHelpers.jsx';

const STATUS_OPTS = ['pending', 'posted', 'reversed'];

const BLANK_CREATE = { entry_date: '', description: '', status: 'pending', source_type: '' };
const BLANK_EDIT = { entry_date: '', description: '', status: 'pending', source_type: '' };

const columns = [
  { field: 'id', headerName: 'ID', width: 100, valueGetter: (params) => params.row.id?.slice(0, 8) },
  dateColumn('entry_date', 'Date'),
  { field: 'description', headerName: 'Description', flex: 1, minWidth: 200 },
  statusColumn(),
  capColumn('source_type', 'Source', { snake: true, width: 140 }),
];

export default function JournalEntriesPage() {
  const { user } = useAuth();
  const caps = user?.perms?.caps || {};
  const canImport = resolveLevel(caps, 'accounting', 'journal-entries', 'import') === 'full';
  const canExport = resolveLevel(caps, 'accounting', 'journal-entries', 'export') !== 'none';

  const { data: res, isLoading } = useJournalEntries();
  const allRows = res?.rows ?? [];

  const [viewFilter, setViewFilter] = useState('active');
  const rows = useMemo(() => {
    if (viewFilter === 'active') return allRows.filter((r) => !r.deactivated_at);
    if (viewFilter === 'archived') return allRows.filter((r) => !!r.deactivated_at);
    return allRows;
  }, [allRows, viewFilter]);

  const createMut = useCreateJournalEntry();
  const updateMut = useUpdateJournalEntry();
  const { mutateAsync: postEntryAsync } = usePostJournalEntry();
  const { mutateAsync: reverseEntryAsync } = useReverseJournalEntry();
  const archiveMut = useArchiveJournalEntry();
  const restoreMut = useRestoreJournalEntry();

  const importMut = useImportXls(journalEntryApi.importXls, ['journalEntries']);
  const exportMut = useExportXls(journalEntryApi.exportXls, 'journal_entries');

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
      entry_date: row.entry_date?.slice(0, 10) ?? '',
      description: row.description ?? '',
      status: row.status ?? 'pending',
      source_type: row.source_type ?? '',
    });
    editDialog.open(row);
  }, []);

  const handleCreate = async () => {
    try {
      await createMut.mutateAsync(createForm);
      toast('Journal entry created');
      createDialog.close();
      resetCreateForm();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };

  const handleUpdate = async () => {
    try {
      await updateMut.mutateAsync({ filter: { id: editDialog.data.id }, changes: editForm });
      toast('Entry updated');
      editDialog.close();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };

  const handlePost = useCallback(async () => {
    try {
      await postEntryAsync({ entry_id: selection.selected.id });
      toast('Entry posted');
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }, [selection.selected, postEntryAsync, toast]);

  const handleReverse = useCallback(async () => {
    try {
      await reverseEntryAsync({ entry_id: selection.selected.id });
      toast('Entry reversed');
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }, [selection.selected, reverseEntryAsync, toast]);

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
    entityName: 'journal entry',
    entityNamePlural: 'journal entries',
    setSelectionModel: () => selection.clearSelection(),
    toast,
    errMsg,
  });

  /* ── ModuleBar: tabs + Archive/Restore + Post/Reverse + Create ─ */
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
      label: 'Post',
      variant: 'outlined',
      color: 'success',
      disabled: !selection.isSingle || selection.selected?.status !== 'pending',
      onClick: handlePost,
    });
    primary.push({
      label: 'Reverse',
      variant: 'outlined',
      color: 'warning',
      disabled: !selection.isSingle || selection.selected?.status !== 'posted',
      onClick: handleReverse,
    });

    primary.push({
      label: 'Create Entry',
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
  }, [viewFilter, selectedRows.length, allActive, allArchived, selection.isSingle, selection.selected, selection.clearSelection, handlePost, handleReverse, setArchiveOpen, setRestoreOpen, canImport, canExport, exportMut.isPending, handleExport]);
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
            <span>Journal Entry Details</span>
            {viewDialog.data && (
              <Typography variant="body2" color="text.secondary">
                {viewDialog.data.description}
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
              <FieldRow label="ID" value={viewDialog.data.id?.slice(0, 8) || '\u2014'} />
              <FieldRow label="Entry Date" value={fmtDate(viewDialog.data.entry_date)} />
              <FieldRow label="Description" value={viewDialog.data.description || '\u2014'} />
              <FieldRow label="Status">
                <StatusBadge status={viewDialog.data.status} />
              </FieldRow>
              <FieldRow label="Source Type" value={capSnake(viewDialog.data.source_type || '') || '\u2014'} />
              <FieldRow label="Created" value={fmtDate(viewDialog.data.created_at)} />
              <FieldRow label="Updated" value={fmtDate(viewDialog.data.updated_at)} />
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Create Journal Entry Dialog ───────────────────────────── */}
      <FormDialog open={createDialog.isOpen} title="Create Journal Entry" submitLabel="Create" loading={createMut.isPending} onSubmit={handleCreate} onCancel={createDialog.close}>
        <TextField label="Entry Date" type="date" required value={createForm.entry_date} onChange={onCreateField('entry_date')} InputLabelProps={{ shrink: true }} />
        <TextField label="Description" multiline minRows={2} value={createForm.description} onChange={onCreateField('description')} />
        <TextField label="Status" select value={createForm.status} onChange={onCreateField('status')}>
          {STATUS_OPTS.map((s) => <MenuItem key={s} value={s}>{capSnake(s)}</MenuItem>)}
        </TextField>
        <TextField label="Source Type" value={createForm.source_type} onChange={onCreateField('source_type')} />
      </FormDialog>

      {/* ── Edit Journal Entry Dialog ─────────────────────────────── */}
      <FormDialog open={editDialog.isOpen} title="Edit Journal Entry" submitLabel="Save Changes" loading={updateMut.isPending} onSubmit={handleUpdate} onCancel={editDialog.close}>
        <TextField label="Entry Date" type="date" value={editForm.entry_date} onChange={onEditField('entry_date')} InputLabelProps={{ shrink: true }} />
        <TextField label="Description" multiline minRows={2} value={editForm.description} onChange={onEditField('description')} />
        <TextField label="Status" select value={editForm.status} onChange={onEditField('status')}>
          {STATUS_OPTS.map((s) => <MenuItem key={s} value={s}>{capSnake(s)}</MenuItem>)}
        </TextField>
        <TextField label="Source Type" value={editForm.source_type} onChange={onEditField('source_type')} />
      </FormDialog>

      <ImportDialog
        open={importDialog.isOpen}
        title="Import Journal Entries"
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
