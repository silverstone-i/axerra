/**
 * @file Companies CRUD page — DataTable + create/edit/view/archive/restore
 * @module nap-client/pages/Core/CompaniesPage
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
 */

import { useState, useMemo, useCallback } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
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
  useCompanies, useCreateCompany, useUpdateCompany, useArchiveCompany, useRestoreCompany,
} from '../../hooks/useCompanies.js';
import { useImportXls, useExportXls } from '../../hooks/useImportExport.js';
import { resolveLevel } from '@nap/shared';
import { companyApi } from '../../services/companyApi.js';
import { pageContainerSx, dialogHeaderSx, dialogActionBoxSx, detailGridSx } from '../../config/layoutTokens.js';
import { useListSelection } from '../../hooks/useListSelection.js';
import { useArchiveRestore } from '../../hooks/useArchiveRestore.js';

const BLANK_CREATE = { name: '', code: '' };
const BLANK_EDIT = { name: '', code: '' };

const fmtDate = (v) => (v ? new Date(v).toLocaleDateString() : '\u2014');

const columns = [
  { field: 'code', headerName: 'Code', width: 120 },
  { field: 'name', headerName: 'Company Name', flex: 1, minWidth: 200 },
  {
    field: 'is_active',
    headerName: 'Active',
    width: 100,
    renderCell: ({ value }) => <StatusBadge status={value ? 'active' : 'suspended'} />,
  },
];

export default function CompaniesPage() {
  const { user } = useAuth();
  const caps = user?.perms?.caps || {};
  const canImport = resolveLevel(caps, 'core', 'companies', 'import') === 'full';
  const canExport = resolveLevel(caps, 'core', 'companies', 'export') !== 'none';

  const { data: res, isLoading } = useCompanies();
  const allRows = res?.rows ?? [];

  const [viewFilter, setViewFilter] = useState('active');
  const rows = useMemo(() => {
    if (viewFilter === 'active') return allRows.filter((r) => !r.deactivated_at);
    if (viewFilter === 'archived') return allRows.filter((r) => !!r.deactivated_at);
    return allRows;
  }, [allRows, viewFilter]);

  const createMut = useCreateCompany();
  const updateMut = useUpdateCompany();
  const archiveMut = useArchiveCompany();
  const restoreMut = useRestoreCompany();

  const importMut = useImportXls(companyApi.importXls, ['companies']);
  const exportMut = useExportXls(companyApi.exportXls, 'companies');

  /* ── Selection (new system) ─────────────────────────────────── */
  const selection = useListSelection(rows);
  const { selectedRows, allActive, allArchived } = selection;

  /* ── Dialog state ───────────────────────────────────────────── */
  const [importOpen, setImportOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewCompany, setViewCompany] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);

  const [createForm, setCreateForm] = useState(BLANK_CREATE);
  const [editForm, setEditForm] = useState(BLANK_EDIT);

  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' });
  const toast = useCallback((msg, sev = 'success') => setSnack({ open: true, msg, sev }), []);
  const errMsg = (err) => err.payload?.error || err.payload?.message || err.message;

  const onCreateField = (f) => (e) => setCreateForm((p) => ({ ...p, [f]: e.target.value }));
  const onEditField = (f) => (e) => setEditForm((p) => ({ ...p, [f]: e.target.value }));

  /* ── Row action callbacks ──────────────────────────────────── */
  const handleView = useCallback((row) => {
    setViewCompany(row);
    setViewOpen(true);
  }, []);

  const handleEdit = useCallback((row) => {
    setEditRow(row);
    setEditForm({ name: row.name ?? '', code: row.code ?? '' });
    setEditOpen(true);
  }, []);

  const handleCreate = async () => {
    try {
      await createMut.mutateAsync(createForm);
      toast('Company created');
      setCreateOpen(false);
      setCreateForm(BLANK_CREATE);
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };

  const handleUpdate = async () => {
    try {
      await updateMut.mutateAsync({ filter: { id: editRow.id }, changes: editForm });
      toast('Company updated');
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
    entityName: 'company',
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
      primary.push({
        label: 'Export',
        variant: 'outlined',
        disabled: exportMut.isPending,
        onClick: handleExport,
      });
    }
    if (canImport) {
      primary.push({
        label: 'Import',
        variant: 'outlined',
        onClick: () => setImportOpen(true),
      });
    }

    primary.push({
      label: 'Create Company',
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
            <span>Company Details</span>
            {viewCompany && (
              <Typography variant="body2" color="text.secondary">
                {viewCompany.name}
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
          {viewCompany && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={detailGridSx}>
                <FieldRow label="Code" value={viewCompany.code || '\u2014'} />
                <FieldRow label="Name" value={viewCompany.name} />
                <FieldRow label="Status">
                  <StatusBadge status={viewCompany.deactivated_at ? 'archived' : 'active'} />
                </FieldRow>
                <FieldRow label="Created" value={fmtDate(viewCompany.created_at)} />
                <FieldRow label="Updated" value={fmtDate(viewCompany.updated_at)} />
              </Box>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      <FormDialog open={createOpen} title="Create Company" submitLabel="Create" loading={createMut.isPending} onSubmit={handleCreate} onCancel={() => setCreateOpen(false)}>
        <TextField label="Company Name" required value={createForm.name} onChange={onCreateField('name')} />
        <TextField label="Code" value={createForm.code} onChange={onCreateField('code')} inputProps={{ maxLength: 16 }} />
      </FormDialog>

      <FormDialog open={editOpen} title="Edit Company" submitLabel="Save Changes" loading={updateMut.isPending} onSubmit={handleUpdate} onCancel={() => { setEditOpen(false); setEditRow(null); }}>
        <TextField label="Company Name" required value={editForm.name} onChange={onEditField('name')} />
        <TextField label="Code" value={editForm.code} onChange={onEditField('code')} inputProps={{ maxLength: 16 }} />
      </FormDialog>

      <ImportDialog
        open={importOpen}
        title="Import Companies"
        loading={importMut.isPending}
        onSubmit={handleImport}
        onCancel={() => setImportOpen(false)}
      />

      <ConfirmDialog {...archiveConfirmProps} />
      <ConfirmDialog {...restoreConfirmProps} />

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack.sev} variant="filled" onClose={() => setSnack((s) => ({ ...s, open: false }))}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
