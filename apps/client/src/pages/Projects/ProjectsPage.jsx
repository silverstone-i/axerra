/**
 * @file Projects CRUD page — DataTable + create/edit/view/archive/restore
 * @module client/pages/Projects/ProjectsPage
 *
 * Copyright (c) 2025 – present Vimber LLC. All rights reserved.
 */

import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFormState } from '../../hooks/useFormState.js';
import { useDialogState } from '../../hooks/useDialogState.js';
import Box from '@mui/material/Box';
import TertiaryButton from '../../components/shared/TertiaryButton.jsx';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

import StatusBadge from '../../components/shared/StatusBadge.jsx';
import ConfirmDialog from '../../components/shared/ConfirmDialog.jsx';
import DataTable from '../../components/shared/DataTable.jsx';
import FieldRow from '../../components/shared/FieldRow.jsx';
import FormDialog from '../../components/shared/FormDialog.jsx';
import ImportDialog from '../../components/shared/ImportDialog.jsx';
import { useModuleToolbarRegistration } from '../../contexts/ModuleActionsContext.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import {
  useProjects, useCreateProject, useUpdateProject, useArchiveProject, useRestoreProject,
} from '../../hooks/useProjects.js';
import { useImportXls, useExportXls } from '../../hooks/useImportExport.js';
import ToastSnackbar from '../../components/shared/ToastSnackbar.jsx';
import { resolveLevel } from '@vimber/shared';
import { projectApi } from '../../services/projectApi.js';
import { pageContainerSx, dialogHeaderSx, dialogActionBoxSx, detailGridSx } from '../../config/layoutTokens.js';
import { useListSelection } from '../../hooks/useListSelection.js';
import { useArchiveRestore } from '../../hooks/useArchiveRestore.js';
import { useToast } from '../../hooks/useToast.js';
import { fmtDate, errMsg } from '../../utils/format.js';

const BLANK_CREATE = { project_code: '', name: '', description: '', notes: '', contract_amount: '' };
const BLANK_EDIT = { project_code: '', name: '', description: '', notes: '', contract_amount: '' };

const STATUS_MAP = { planning: 'active', budgeting: 'active', released: 'active', complete: 'suspended' };

const columns = [
  { field: 'project_code', headerName: 'Code', width: 130 },
  { field: 'name', headerName: 'Project Name', flex: 1, minWidth: 200 },
  {
    field: 'status',
    headerName: 'Status',
    width: 120,
    renderCell: ({ value }) => <StatusBadge status={STATUS_MAP[value] || 'active'} label={value} />,
  },
  { field: 'contract_amount', headerName: 'Contract Amount', width: 160, type: 'number' },
];

export default function ProjectsPage() {
  const { user } = useAuth();
  const caps = user?.perms?.caps || {};
  const canImport = resolveLevel(caps, 'projects', 'projects', 'import') === 'full';
  const canExport = resolveLevel(caps, 'projects', 'projects', 'export') !== 'none';

  const navigate = useNavigate();
  const { data: res, isLoading } = useProjects();
  const allRows = res?.rows ?? [];

  const [viewFilter, setViewFilter] = useState('active');
  const rows = useMemo(() => {
    if (viewFilter === 'active') return allRows.filter((r) => !r.deactivated_at);
    if (viewFilter === 'archived') return allRows.filter((r) => !!r.deactivated_at);
    return allRows;
  }, [allRows, viewFilter]);

  const createMut = useCreateProject();
  const updateMut = useUpdateProject();
  const archiveMut = useArchiveProject();
  const restoreMut = useRestoreProject();

  const importMut = useImportXls(projectApi.importXls, ['projects']);
  const exportMut = useExportXls(projectApi.exportXls, 'projects');

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
      project_code: row.project_code ?? '',
      name: row.name ?? '',
      description: row.description ?? '',
      notes: row.notes ?? '',
      contract_amount: row.contract_amount ?? '',
    });
    editDialog.open(row);
  }, []);

  const handleCreate = async () => {
    try {
      await createMut.mutateAsync(createForm);
      toast('Project created');
      createDialog.close();
      resetCreateForm();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };

  const handleUpdate = async () => {
    try {
      await updateMut.mutateAsync({ filter: { id: editDialog.data.id }, changes: editForm });
      toast('Project updated');
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
    entityName: 'project',
    setSelectionModel: () => selection.clearSelection(),
    toast,
    errMsg,
    getLabel: (r) => r.name,
  });

  /* ── Custom row actions (Detail link) ──────────────────────── */
  const getRowActions = useCallback((_row) => [
    { label: 'Detail', icon: <OpenInNewIcon fontSize="small" />, onClick: (r) => navigate(`/projects/${r.id}`) },
  ], [navigate]);

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
      label: 'Create Project',
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
        rowActions={getRowActions}
        dataGridProps={{ onRowDoubleClick: (params) => navigate(`/projects/${params.id}`) }}
      />

      {/* ── View Details Dialog ──────────────────────────────────── */}
      <Dialog open={viewDialog.isOpen} onClose={viewDialog.close} maxWidth="sm" fullWidth>
        <DialogTitle sx={dialogHeaderSx}>
          <Box>
            <span>Project Details</span>
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
            <Box sx={detailGridSx}>
              <FieldRow label="Project Code" value={viewDialog.data.project_code || '\u2014'} />
              <FieldRow label="Name" value={viewDialog.data.name} />
              <FieldRow label="Status">
                <StatusBadge status={STATUS_MAP[viewDialog.data.status] || 'active'} label={viewDialog.data.status} />
              </FieldRow>
              <FieldRow label="Contract Amount" value={viewDialog.data.contract_amount ?? '\u2014'} />
              <FieldRow label="Created" value={fmtDate(viewDialog.data.created_at)} />
              <FieldRow label="Updated" value={fmtDate(viewDialog.data.updated_at)} />
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Create Project Dialog ─────────────────────────────────── */}
      <FormDialog open={createDialog.isOpen} title="Create Project" submitLabel="Create" loading={createMut.isPending} onSubmit={handleCreate} onCancel={createDialog.close}>
        <TextField label="Project Code" required value={createForm.project_code} onChange={onCreateField('project_code')} inputProps={{ maxLength: 32 }} />
        <TextField label="Project Name" required value={createForm.name} onChange={onCreateField('name')} />
        <TextField label="Description" multiline minRows={2} value={createForm.description} onChange={onCreateField('description')} />
        <TextField label="Contract Amount" type="number" value={createForm.contract_amount} onChange={onCreateField('contract_amount')} />
        <TextField label="Notes" multiline minRows={2} value={createForm.notes} onChange={onCreateField('notes')} />
      </FormDialog>

      {/* ── Edit Project Dialog ──────────────────────────────────── */}
      <FormDialog open={editDialog.isOpen} title="Edit Project" submitLabel="Save Changes" loading={updateMut.isPending} onSubmit={handleUpdate} onCancel={editDialog.close}>
        <TextField label="Project Code" required value={editForm.project_code} onChange={onEditField('project_code')} inputProps={{ maxLength: 32 }} />
        <TextField label="Project Name" required value={editForm.name} onChange={onEditField('name')} />
        <TextField label="Description" multiline minRows={2} value={editForm.description} onChange={onEditField('description')} />
        <TextField label="Contract Amount" type="number" value={editForm.contract_amount} onChange={onEditField('contract_amount')} />
        <TextField label="Notes" multiline minRows={2} value={editForm.notes} onChange={onEditField('notes')} />
      </FormDialog>

      <ImportDialog open={importDialog.isOpen} title="Import Projects" loading={importMut.isPending} onSubmit={handleImport} onCancel={importDialog.close} />

      <ConfirmDialog {...archiveConfirmProps} />
      <ConfirmDialog {...restoreConfirmProps} />

      <ToastSnackbar {...snackProps} />
    </Box>
  );
}
