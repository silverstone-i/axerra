/**
 * @file Chart of Accounts CRUD page — DataTable + create/edit/view/archive/restore
 * @module nap-client/pages/Accounting/ChartOfAccountsPage
 *
 * Migrated to standardised list-view selection system:
 *   useListSelection + DataTable + RowActionsMenu
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

import StatusBadge from '../../components/shared/StatusBadge.jsx';
import ConfirmDialog from '../../components/shared/ConfirmDialog.jsx';
import DataTable from '../../components/shared/DataTable.jsx';
import FieldRow from '../../components/shared/FieldRow.jsx';
import FormDialog from '../../components/shared/FormDialog.jsx';
import ImportDialog from '../../components/shared/ImportDialog.jsx';
import { useModuleToolbarRegistration } from '../../contexts/ModuleActionsContext.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import {
  useChartOfAccounts, useCreateAccount, useUpdateAccount, useArchiveAccount, useRestoreAccount,
} from '../../hooks/useAccounting.js';
import { useImportXls, useExportXls } from '../../hooks/useImportExport.js';
import { resolveLevel } from '@nap/shared';
import { chartOfAccountsApi } from '../../services/accountingApi.js';
import { pageContainerSx, dialogHeaderSx, dialogActionBoxSx, detailGridSx } from '../../config/layoutTokens.js';
import { useListSelection } from '../../hooks/useListSelection.js';
import { useArchiveRestore } from '../../hooks/useArchiveRestore.js';
import { cap, fmtDate, errMsg } from '../../utils/format.js';

const ACCT_TYPES = ['asset', 'liability', 'equity', 'income', 'expense', 'cash', 'bank'];

const BLANK_CREATE = { code: '', name: '', type: 'asset', is_active: true, cash_basis: false };
const BLANK_EDIT = { name: '', type: 'asset', is_active: true, cash_basis: false };

const columns = [
  { field: 'code', headerName: 'Code', width: 120 },
  { field: 'name', headerName: 'Account Name', flex: 1, minWidth: 200 },
  { field: 'type', headerName: 'Type', width: 120, valueGetter: (params) => cap(params.row.type) },
  {
    field: 'is_active',
    headerName: 'Active',
    width: 100,
    renderCell: ({ value }) => <StatusBadge status={value ? 'active' : 'suspended'} />,
  },
  {
    field: 'cash_basis',
    headerName: 'Cash Basis',
    width: 110,
    valueGetter: (params) => (params.row.cash_basis ? 'Yes' : 'No'),
  },
];

export default function ChartOfAccountsPage() {
  const { user } = useAuth();
  const caps = user?.perms?.caps || {};
  const canImport = resolveLevel(caps, 'accounting', 'chart-of-accounts', 'import') === 'full';
  const canExport = resolveLevel(caps, 'accounting', 'chart-of-accounts', 'export') !== 'none';

  const { data: res, isLoading } = useChartOfAccounts();
  const allRows = res?.rows ?? [];

  const [viewFilter, setViewFilter] = useState('active');
  const rows = useMemo(() => {
    if (viewFilter === 'active') return allRows.filter((r) => !r.deactivated_at);
    if (viewFilter === 'archived') return allRows.filter((r) => !!r.deactivated_at);
    return allRows;
  }, [allRows, viewFilter]);

  const createMut = useCreateAccount();
  const updateMut = useUpdateAccount();
  const archiveMut = useArchiveAccount();
  const restoreMut = useRestoreAccount();

  const importMut = useImportXls(chartOfAccountsApi.importXls, ['chartOfAccounts']);
  const exportMut = useExportXls(chartOfAccountsApi.exportXls, 'chart_of_accounts');

  /* ── Selection (new system) ─────────────────────────────────── */
  const selection = useListSelection(rows);
  const { selectedRows, allActive, allArchived } = selection;

  /* ── Dialog state ───────────────────────────────────────────── */
  const [importOpen, setImportOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewAccount, setViewAccount] = useState(null);
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
    setViewAccount(row);
    setViewOpen(true);
  }, []);

  const handleEdit = useCallback((row) => {
    setEditRow(row);
    setEditForm({ name: row.name ?? '', type: row.type ?? 'asset', is_active: row.is_active ?? true, cash_basis: row.cash_basis ?? false });
    setEditOpen(true);
  }, []);

  const handleCreate = async () => {
    try {
      await createMut.mutateAsync(createForm);
      toast('Account created');
      setCreateOpen(false);
      setCreateForm(BLANK_CREATE);
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };

  const handleUpdate = async () => {
    try {
      await updateMut.mutateAsync({ filter: { id: editRow.id }, changes: editForm });
      toast('Account updated');
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
    entityName: 'account',
    setSelectionModel: () => selection.clearSelection(),
    toast,
    errMsg,
    getLabel: (r) => `${r.name} (${r.code})`,
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
      primary.push({ label: 'Import', variant: 'outlined', onClick: () => setImportOpen(true) });
    }

    primary.push({
      label: 'Create Account',
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
            <span>Account Details</span>
            {viewAccount && (
              <Typography variant="body2" color="text.secondary">
                {viewAccount.name}
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
          {viewAccount && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={detailGridSx}>
                <FieldRow label="Code" value={viewAccount.code || '\u2014'} />
                <FieldRow label="Name" value={viewAccount.name} />
                <FieldRow label="Type" value={cap(viewAccount.type)} />
                <FieldRow label="Cash Basis" value={viewAccount.cash_basis ? 'Yes' : 'No'} />
                <FieldRow label="Status">
                  <StatusBadge status={viewAccount.deactivated_at ? 'archived' : 'active'} />
                </FieldRow>
                <FieldRow label="Created" value={fmtDate(viewAccount.created_at)} />
                <FieldRow label="Updated" value={fmtDate(viewAccount.updated_at)} />
              </Box>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      <FormDialog open={createOpen} title="Create Account" submitLabel="Create" loading={createMut.isPending} onSubmit={handleCreate} onCancel={() => setCreateOpen(false)}>
        <TextField label="Account Code" required value={createForm.code} onChange={onCreateField('code')} inputProps={{ maxLength: 16 }} />
        <TextField label="Account Name" required value={createForm.name} onChange={onCreateField('name')} />
        <TextField label="Type" select value={createForm.type} onChange={onCreateField('type')}>
          {ACCT_TYPES.map((t) => <MenuItem key={t} value={t}>{cap(t)}</MenuItem>)}
        </TextField>
      </FormDialog>

      <FormDialog open={editOpen} title="Edit Account" submitLabel="Save Changes" loading={updateMut.isPending} onSubmit={handleUpdate} onCancel={() => { setEditOpen(false); setEditRow(null); }}>
        {editRow && <TextField label="Account Code" value={editRow.code} disabled />}
        <TextField label="Account Name" required value={editForm.name} onChange={onEditField('name')} />
        <TextField label="Type" select value={editForm.type} onChange={onEditField('type')}>
          {ACCT_TYPES.map((t) => <MenuItem key={t} value={t}>{cap(t)}</MenuItem>)}
        </TextField>
      </FormDialog>

      <ImportDialog
        open={importOpen}
        title="Import Chart of Accounts"
        loading={importMut.isPending}
        onSubmit={handleImport}
        onCancel={() => setImportOpen(false)}
      />

      <ConfirmDialog {...archiveConfirmProps} />
      <ConfirmDialog {...restoreConfirmProps} />

      <ToastSnackbar {...snackProps} />
    </Box>
  );
}
