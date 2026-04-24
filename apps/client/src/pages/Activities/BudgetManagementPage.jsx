/**
 * @file Budget management page — list, approval workflow, version history
 * @module client/pages/Activities/BudgetManagementPage
 *
 * Status workflow: draft → submitted → approved → locked | rejected
 * Approved budgets are read-only; new changes spawn a new version.
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
import { useBudgets, useCreateBudget, useUpdateBudget, useArchiveBudget, useCreateBudgetVersion } from '../../hooks/useBudgets.js';
import { useImportXls, useExportXls } from '../../hooks/useImportExport.js';
import ToastSnackbar from '../../components/shared/ToastSnackbar.jsx';
import { resolveLevel } from '@vimber/shared';
import { budgetApi } from '../../services/budgetApi.js';
import { useDeliverables } from '../../hooks/useDeliverables.js';
import { useActivities } from '../../hooks/useActivities.js';
import { pageContainerSx, formGridSx, dialogHeaderSx, dialogActionBoxSx, detailGridSx, flexColumnSx } from '../../config/layoutTokens.js';
import { useListSelection } from '../../hooks/useListSelection.js';
import { useArchiveRestore } from '../../hooks/useArchiveRestore.js';
import { useToast } from '../../hooks/useToast.js';
import { fmtDate, errMsg } from '../../utils/format.js';

const BLANK_CREATE = { deliverable_id: '', activity_id: '', budgeted_amount: '', status: 'draft' };
const BLANK_EDIT = { budgeted_amount: '', status: '' };

const STATUSES = ['draft', 'submitted', 'approved', 'locked', 'rejected'];

export default function BudgetManagementPage() {
  const { user } = useAuth();
  const caps = user?.perms?.caps || {};
  const canImport = resolveLevel(caps, 'activities', 'budgets', 'import') === 'full';
  const canExport = resolveLevel(caps, 'activities', 'budgets', 'export') !== 'none';

  const { data: res, isLoading } = useBudgets();
  const { data: delivRes } = useDeliverables();
  const { data: actRes } = useActivities();
  const allRows = res?.rows ?? [];
  const deliverables = (delivRes?.rows ?? []).filter((d) => !d.deactivated_at);
  const activities = (actRes?.rows ?? []).filter((a) => !a.deactivated_at);

  const deliverableMap = useMemo(() => Object.fromEntries(deliverables.map((d) => [d.id, d.name])), [deliverables]);
  const activityMap = useMemo(() => Object.fromEntries(activities.map((a) => [a.id, `${a.code} — ${a.name}`])), [activities]);

  const [viewFilter, setViewFilter] = useState('active');
  const rows = useMemo(() => {
    if (viewFilter === 'active') return allRows.filter((r) => !r.deactivated_at);
    if (viewFilter === 'archived') return allRows.filter((r) => !!r.deactivated_at);
    if (viewFilter === 'current') return allRows.filter((r) => !r.deactivated_at && r.is_current);
    return allRows;
  }, [allRows, viewFilter]);

  const createMut = useCreateBudget();
  const updateMut = useUpdateBudget();
  const archiveMut = useArchiveBudget();
  const newVersionMut = useCreateBudgetVersion();

  const importMut = useImportXls(budgetApi.importXls, ['budgets']);
  const exportMut = useExportXls(budgetApi.exportXls, 'budgets');

  /* ── Selection (new system) ─────────────────────────────────── */
  const selection = useListSelection(rows);
  const { selectedRows, allActive } = selection;

  /* ── Dialog state ───────────────────────────────────────────── */
  const importDialog = useDialogState();
  const viewDialog = useDialogState();
  const createDialog = useDialogState();
  const editDialog = useDialogState();
  const versionDialog = useDialogState();

  const { form: createForm, field: onCreateField, reset: resetCreateForm } = useFormState(BLANK_CREATE);
  const { form: editForm, setForm: setEditForm, field: onEditField } = useFormState(BLANK_EDIT);

  const { toast, snackProps } = useToast();

  /* ── Row action callbacks ──────────────────────────────────── */
  const handleView = useCallback((row) => {
    viewDialog.open(row);
  }, []);

  const handleEdit = useCallback((row) => {
    setEditForm({ budgeted_amount: row.budgeted_amount || '', status: row.status || '' });
    editDialog.open(row);
  }, []);

  const handleCreate = async () => {
    try {
      await createMut.mutateAsync(createForm);
      toast('Budget created');
      createDialog.close();
      resetCreateForm();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };

  const handleUpdate = async () => {
    try {
      await updateMut.mutateAsync({ filter: { id: editDialog.data.id }, changes: editForm });
      toast('Budget updated');
      editDialog.close();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };

  const handleNewVersion = async () => {
    try {
      await newVersionMut.mutateAsync({ budget_id: selection.selected.id });
      toast('New budget version created');
      versionDialog.close();
      selection.clearSelection();
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

  const { setArchiveOpen, archiveConfirmProps } = useArchiveRestore({
    selectedRows,
    archiveMut,
    entityName: 'budget',
    setSelectionModel: () => selection.clearSelection(),
    toast,
    errMsg,
    getLabel: (r) => `budget v${r.version}`,
  });

  const canNewVersion = selection.isSingle && (selection.selected?.status === 'approved' || selection.selected?.status === 'locked');

  const columns = useMemo(
    () => [
      {
        field: 'deliverable_id',
        headerName: 'Deliverable',
        flex: 1,
        minWidth: 180,
        valueGetter: (params) => deliverableMap[params.row.deliverable_id] || params.row.deliverable_id,
      },
      {
        field: 'activity_id',
        headerName: 'Activity',
        flex: 1,
        minWidth: 180,
        valueGetter: (params) => activityMap[params.row.activity_id] || params.row.activity_id,
      },
      { field: 'budgeted_amount', headerName: 'Amount', width: 140, type: 'number' },
      { field: 'version', headerName: 'Ver', width: 70, type: 'number' },
      {
        field: 'is_current',
        headerName: 'Current',
        width: 90,
        valueGetter: (params) => (params.row.is_current ? 'Yes' : 'No'),
      },
      {
        field: 'status',
        headerName: 'Status',
        width: 120,
        renderCell: ({ value }) => <StatusBadge status={value} />,
      },
      { field: 'approved_at', headerName: 'Approved', width: 140, valueGetter: (params) => params.row.approved_at?.slice(0, 10) || '' },
    ],
    [deliverableMap, activityMap],
  );

  /* ── ModuleBar: tabs + Create + New Version + Archive ──────── */
  const toolbar = useMemo(() => {
    const primary = [];

    if (viewFilter === 'current' || viewFilter === 'active' || viewFilter === 'all') {
      primary.push({
        label: selectedRows.length > 1 ? `Archive (${selectedRows.length})` : 'Archive',
        variant: 'outlined',
        color: 'error',
        disabled: selectedRows.length === 0 || !allActive,
        onClick: () => setArchiveOpen(true),
      });
    }

    primary.push({
      label: 'New Version',
      variant: 'outlined',
      disabled: !canNewVersion,
      onClick: () => versionDialog.open(),
    });

    if (canExport) {
      primary.push({ label: 'Export', variant: 'outlined', disabled: exportMut.isPending, onClick: handleExport });
    }
    if (canImport) {
      primary.push({ label: 'Import', variant: 'outlined', onClick: () => importDialog.open() });
    }

    primary.push({
      label: 'Create Budget',
      variant: 'contained',
      color: 'primary',
      onClick: () => { resetCreateForm(); createDialog.open(); },
    });

    return {
      tabs: [
        { value: 'current', label: 'Current', selected: viewFilter === 'current', onClick: () => { setViewFilter('current'); selection.clearSelection(); } },
        { value: 'active', label: 'Active', selected: viewFilter === 'active', onClick: () => { setViewFilter('active'); selection.clearSelection(); } },
        { value: 'all', label: 'All', selected: viewFilter === 'all', onClick: () => { setViewFilter('all'); selection.clearSelection(); } },
        { value: 'archived', label: 'Archived', selected: viewFilter === 'archived', onClick: () => { setViewFilter('archived'); selection.clearSelection(); } },
      ],
      filters: [],
      primaryActions: primary,
    };
  }, [viewFilter, selectedRows.length, allActive, canNewVersion, selection.clearSelection, setArchiveOpen, canImport, canExport, exportMut.isPending, handleExport]);
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
            <span>Budget Details</span>
            {viewDialog.data && (
              <Typography variant="body2" color="text.secondary">
                {deliverableMap[viewDialog.data.deliverable_id] || viewDialog.data.deliverable_id}
                {' / '}
                {activityMap[viewDialog.data.activity_id] || viewDialog.data.activity_id}
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
                <FieldRow label="Deliverable" value={deliverableMap[viewDialog.data.deliverable_id] || viewDialog.data.deliverable_id} />
                <FieldRow label="Activity" value={activityMap[viewDialog.data.activity_id] || viewDialog.data.activity_id} />
                <FieldRow label="Budgeted Amount" value={viewDialog.data.budgeted_amount} />
                <FieldRow label="Version" value={viewDialog.data.version} />
                <FieldRow label="Is Current" value={viewDialog.data.is_current ? 'Yes' : 'No'} />
                <FieldRow label="Status">
                  <StatusBadge status={viewDialog.data.status} />
                </FieldRow>
                <FieldRow label="Approved At" value={fmtDate(viewDialog.data.approved_at)} />
                <FieldRow label="Created" value={fmtDate(viewDialog.data.created_at)} />
                <FieldRow label="Updated" value={fmtDate(viewDialog.data.updated_at)} />
              </Box>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <FormDialog open={createDialog.isOpen} title="Create Budget" submitLabel="Create" loading={createMut.isPending} onSubmit={handleCreate} onCancel={createDialog.close}>
        <Box sx={formGridSx}>
          <TextField label="Deliverable" required select value={createForm.deliverable_id} onChange={onCreateField('deliverable_id')}>
            {deliverables.map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
          </TextField>
          <TextField label="Activity" required select value={createForm.activity_id} onChange={onCreateField('activity_id')}>
            {activities.map((a) => <MenuItem key={a.id} value={a.id}>{a.code} — {a.name}</MenuItem>)}
          </TextField>
          <TextField label="Budgeted Amount" type="number" required value={createForm.budgeted_amount} onChange={onCreateField('budgeted_amount')} />
        </Box>
      </FormDialog>

      {/* Edit Dialog */}
      <FormDialog open={editDialog.isOpen} title="Edit Budget" submitLabel="Save" loading={updateMut.isPending} onSubmit={handleUpdate} onCancel={editDialog.close}>
        <Box sx={formGridSx}>
          <TextField label="Budgeted Amount" type="number" value={editForm.budgeted_amount} onChange={onEditField('budgeted_amount')} />
          <TextField label="Status" select value={editForm.status} onChange={onEditField('status')}>
            {STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </TextField>
        </Box>
      </FormDialog>

      {/* New Version Confirm */}
      <ConfirmDialog
        open={versionDialog.isOpen}
        title="Create New Budget Version"
        message={selection.selected ? `Create a new draft version from budget v${selection.selected.version}? The current version will be marked as superseded.` : ''}
        confirmLabel="Create Version"
        loading={newVersionMut.isPending}
        onConfirm={handleNewVersion}
        onCancel={versionDialog.close}
      />

      <ImportDialog open={importDialog.isOpen} title="Import Budgets" loading={importMut.isPending} onSubmit={handleImport} onCancel={importDialog.close} />

      <ConfirmDialog {...archiveConfirmProps} />

      <ToastSnackbar {...snackProps} />
    </Box>
  );
}
