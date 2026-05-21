/**
 * @file Cost tracking page — DataTable with approval workflow
 * @module client/pages/Activities/CostTrackingPage
 *
 * Approval workflow: pending -> approved | rejected
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
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
import { useActualCosts, useCreateActualCost, useUpdateActualCost, useArchiveActualCost } from '../../hooks/useActualCosts.js';
import { useImportXls, useExportXls } from '../../hooks/useImportExport.js';
import ToastSnackbar from '../../components/shared/ToastSnackbar.jsx';
import { resolveLevel } from '@axerra/shared';
import { actualCostApi } from '../../services/actualCostApi.js';
import { useActivities } from '../../hooks/useActivities.js';
import { pageContainerSx, formGridSx, dialogHeaderSx, dialogActionBoxSx, formFullSpanSx, detailGridSx } from '../../config/layoutTokens.js';
import { useListSelection } from '../../hooks/useListSelection.js';
import { useArchiveRestore } from '../../hooks/useArchiveRestore.js';
import { useToast } from '../../hooks/useToast.js';
import { fmtDate, errMsg } from '../../utils/format.js';

const BLANK_CREATE = { activity_id: '', project_id: '', amount: '', currency: 'USD', reference: '', incurred_on: '' };
const BLANK_EDIT = { amount: '', currency: '', reference: '', approval_status: '', incurred_on: '' };

const APPROVAL_STATUSES = ['pending', 'approved', 'rejected'];

export default function CostTrackingPage() {
  const { user } = useAuth();
  const caps = user?.perms?.caps || {};
  const canImport = resolveLevel(caps, 'activities', 'actual-costs', 'import') === 'full';
  const canExport = resolveLevel(caps, 'activities', 'actual-costs', 'export') !== 'none';

  const { data: res, isLoading } = useActualCosts();
  const { data: actRes } = useActivities();
  const allRows = res?.rows ?? [];
  const activities = (actRes?.rows ?? []).filter((a) => !a.deactivated_at);

  const activityMap = useMemo(() => Object.fromEntries(activities.map((a) => [a.id, `${a.code} \u2014 ${a.name}`])), [activities]);

  const [viewFilter, setViewFilter] = useState('active');
  const rows = useMemo(() => {
    if (viewFilter === 'active') return allRows.filter((r) => !r.deactivated_at);
    if (viewFilter === 'archived') return allRows.filter((r) => !!r.deactivated_at);
    if (viewFilter === 'pending') return allRows.filter((r) => !r.deactivated_at && r.approval_status === 'pending');
    return allRows;
  }, [allRows, viewFilter]);

  const createMut = useCreateActualCost();
  const updateMut = useUpdateActualCost();
  const archiveMut = useArchiveActualCost();

  const importMut = useImportXls(actualCostApi.importXls, ['actualCosts']);
  const exportMut = useExportXls(actualCostApi.exportXls, 'actual_costs');

  /* ── Selection (new system) ─────────────────────────────────── */
  const selection = useListSelection(rows);
  const { selectedRows, allActive } = selection;

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
      amount: row.amount || '',
      currency: row.currency || 'USD',
      reference: row.reference || '',
      approval_status: row.approval_status || '',
      incurred_on: row.incurred_on || '',
    });
    editDialog.open(row);
  }, []);

  const handleCreate = async () => {
    try {
      await createMut.mutateAsync(createForm);
      toast('Actual cost created');
      createDialog.close();
      resetCreateForm();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };

  const handleUpdate = async () => {
    try {
      await updateMut.mutateAsync({ filter: { id: editDialog.data.id }, changes: editForm });
      toast('Actual cost updated');
      editDialog.close();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };

  const handleImport = useCallback(async (formData) => {
    try {
      const result = await importMut.mutateAsync(formData);
      const ins = result?.inserted ?? 0;
      const upd = result?.updated ?? 0;
      toast(ins + upd === 0 ? 'Import complete — no changes' : `Actual Costs: ${ins} new, ${upd} updated`);
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
    entityName: 'actual cost',
    entityNamePlural: 'actual costs',
    setSelectionModel: () => selection.clearSelection(),
    toast,
    errMsg,
  });

  const columns = useMemo(
    () => [
      {
        field: 'activity_id',
        headerName: 'Activity',
        flex: 1,
        minWidth: 180,
        valueGetter: (params) => activityMap[params.row.activity_id] || params.row.activity_id,
      },
      { field: 'amount', headerName: 'Amount', width: 130, type: 'number' },
      { field: 'currency', headerName: 'Currency', width: 90 },
      {
        field: 'approval_status',
        headerName: 'Status',
        width: 120,
        renderCell: ({ value }) => <StatusBadge status={value} />,
      },
      { field: 'incurred_on', headerName: 'Incurred On', width: 120 },
      { field: 'reference', headerName: 'Reference', flex: 1, minWidth: 150 },
      { field: 'created_at', headerName: 'Created', width: 140, valueGetter: (params) => params.row.created_at?.slice(0, 10) },
    ],
    [activityMap],
  );

  /* ── ModuleBar: tabs + Archive + Create ────────────────────── */
  const toolbar = useMemo(() => {
    const primary = [];

    if (viewFilter === 'active' || viewFilter === 'pending' || viewFilter === 'all') {
      primary.push({
        label: selectedRows.length > 1 ? `Archive (${selectedRows.length})` : 'Archive',
        variant: 'outlined',
        disabled: selectedRows.length === 0 || !allActive,
        onClick: () => setArchiveOpen(true),
      });
    }

    if (canExport) {
      primary.push({ label: 'Export', variant: 'outlined', disabled: exportMut.isPending, onClick: handleExport });
    }
    if (canImport) {
      primary.push({ label: 'Import', variant: 'outlined', onClick: () => importDialog.open() });
    }

    primary.push({
      label: 'Record Actual Cost',
      variant: 'contained',
      onClick: () => { resetCreateForm(); createDialog.open(); },
    });

    return {
      tabs: [
        { value: 'active', label: 'Active', selected: viewFilter === 'active', onClick: () => { setViewFilter('active'); selection.clearSelection(); } },
        { value: 'pending', label: 'Pending', selected: viewFilter === 'pending', onClick: () => { setViewFilter('pending'); selection.clearSelection(); } },
        { value: 'all', label: 'All', selected: viewFilter === 'all', onClick: () => { setViewFilter('all'); selection.clearSelection(); } },
        { value: 'archived', label: 'Archived', selected: viewFilter === 'archived', onClick: () => { setViewFilter('archived'); selection.clearSelection(); } },
      ],
      filters: [],
      primaryActions: primary,
    };
  }, [viewFilter, selectedRows.length, allActive, selection.clearSelection, setArchiveOpen, canImport, canExport, exportMut.isPending, handleExport]);
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
            <span>Actual Cost Details</span>
            {viewDialog.data && (
              <Typography variant="body2" color="text.secondary">
                {viewDialog.data.reference || viewDialog.data.amount}
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
              <FieldRow label="Activity" value={activityMap[viewDialog.data.activity_id] || viewDialog.data.activity_id || '\u2014'} />
              <FieldRow label="Amount" value={viewDialog.data.amount ?? '\u2014'} />
              <FieldRow label="Currency" value={viewDialog.data.currency || '\u2014'} />
              <FieldRow label="Approval Status">
                <StatusBadge status={viewDialog.data.approval_status} />
              </FieldRow>
              <FieldRow label="Incurred On" value={viewDialog.data.incurred_on || '\u2014'} />
              <FieldRow label="Reference" value={viewDialog.data.reference || '\u2014'} />
              <FieldRow label="Created" value={fmtDate(viewDialog.data.created_at)} />
              <FieldRow label="Updated" value={fmtDate(viewDialog.data.updated_at)} />
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Create Dialog ─────────────────────────────────────────── */}
      <FormDialog open={createDialog.isOpen} title="Record Actual Cost" submitLabel="Create" loading={createMut.isPending} onSubmit={handleCreate} onCancel={createDialog.close}>
        <Box sx={formGridSx}>
          <TextField label="Activity" required select value={createForm.activity_id} onChange={onCreateField('activity_id')}>
            {activities.map((a) => <MenuItem key={a.id} value={a.id}>{a.code} — {a.name}</MenuItem>)}
          </TextField>
          <TextField label="Amount" type="number" required value={createForm.amount} onChange={onCreateField('amount')} />
          <TextField label="Currency" value={createForm.currency} onChange={onCreateField('currency')} inputProps={{ maxLength: 3 }} />
          <TextField label="Incurred On" type="date" value={createForm.incurred_on} onChange={onCreateField('incurred_on')} InputLabelProps={{ shrink: true }} />
          <TextField label="Reference" value={createForm.reference} onChange={onCreateField('reference')} sx={formFullSpanSx} />
        </Box>
      </FormDialog>

      {/* ── Edit Dialog ───────────────────────────────────────────── */}
      <FormDialog open={editDialog.isOpen} title="Edit Actual Cost" submitLabel="Save" loading={updateMut.isPending} onSubmit={handleUpdate} onCancel={editDialog.close}>
        <Box sx={formGridSx}>
          <TextField label="Amount" type="number" value={editForm.amount} onChange={onEditField('amount')} />
          <TextField label="Currency" value={editForm.currency} onChange={onEditField('currency')} inputProps={{ maxLength: 3 }} />
          <TextField label="Approval Status" select value={editForm.approval_status} onChange={onEditField('approval_status')}>
            {APPROVAL_STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </TextField>
          <TextField label="Incurred On" type="date" value={editForm.incurred_on} onChange={onEditField('incurred_on')} InputLabelProps={{ shrink: true }} />
          <TextField label="Reference" value={editForm.reference} onChange={onEditField('reference')} sx={formFullSpanSx} />
        </Box>
      </FormDialog>

      <ImportDialog open={importDialog.isOpen} title="Import Actual Costs" loading={importMut.isPending} onPreview={(fd) => actualCostApi.importXls(fd, { preview: true })} onSubmit={handleImport} onCancel={importDialog.close} />

      <ConfirmDialog {...archiveConfirmProps} />

      <ToastSnackbar {...snackProps} />
    </Box>
  );
}
