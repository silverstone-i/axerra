/**
 * @file Catalog SKU management page — DataTable + create/edit/view/archive/restore/embedding refresh
 * @module client/pages/BOM/CatalogPage
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
import {
  useCatalogSkus,
  useCreateCatalogSku,
  useUpdateCatalogSku,
  useArchiveCatalogSku,
  useRestoreCatalogSku,
  useRefreshCatalogEmbeddings,
} from '../../hooks/useBom.js';
import { useImportXls, useExportXls } from '../../hooks/useImportExport.js';
import ToastSnackbar from '../../components/shared/ToastSnackbar.jsx';
import { resolveLevel } from '@axerra/shared';
import { catalogSkuApi } from '../../services/bomApi.js';
import { pageContainerSx, formGridSx, dialogHeaderSx, dialogActionBoxSx, formFullSpanSx, detailGridSx } from '../../config/layoutTokens.js';
import { useListSelection } from '../../hooks/useListSelection.js';
import { useArchiveRestore } from '../../hooks/useArchiveRestore.js';
import { useToast } from '../../hooks/useToast.js';
import { fmtDate, errMsg } from '../../utils/format.js';

const BLANK_CREATE = { catalog_sku: '', description: '', category: '', sub_category: '' };
const BLANK_EDIT = { catalog_sku: '', description: '', category: '', sub_category: '' };

const columns = [
  { field: 'catalog_sku', headerName: 'SKU', width: 160 },
  { field: 'description', headerName: 'Description', flex: 1, minWidth: 250 },
  { field: 'category', headerName: 'Category', width: 150 },
  { field: 'sub_category', headerName: 'Sub-Category', width: 150 },
  {
    field: 'embedding',
    headerName: 'Embedded',
    width: 100,
    valueGetter: (params) => (params.row.embedding ? 'Yes' : 'No'),
  },
  { field: 'created_at', headerName: 'Created', width: 120, valueGetter: (params) => params.row.created_at?.slice(0, 10) },
];

export default function CatalogPage() {
  const { user } = useAuth();
  const caps = user?.perms?.caps || {};
  const canImport = resolveLevel(caps, 'bom', 'catalog-skus', 'import') === 'full';
  const canExport = resolveLevel(caps, 'bom', 'catalog-skus', 'export') !== 'none';

  const { data: res, isLoading } = useCatalogSkus();
  const allRows = res?.rows ?? [];

  const [viewFilter, setViewFilter] = useState('active');
  const rows = useMemo(() => {
    if (viewFilter === 'active') return allRows.filter((r) => !r.deactivated_at);
    if (viewFilter === 'archived') return allRows.filter((r) => !!r.deactivated_at);
    return allRows;
  }, [allRows, viewFilter]);

  const createMut = useCreateCatalogSku();
  const updateMut = useUpdateCatalogSku();
  const archiveMut = useArchiveCatalogSku();
  const restoreMut = useRestoreCatalogSku();
  const refreshMut = useRefreshCatalogEmbeddings();

  const importMut = useImportXls(catalogSkuApi.importXls, ['catalogSkus']);
  const exportMut = useExportXls(catalogSkuApi.exportXls, 'catalog_skus');

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

  const categories = useMemo(() => [...new Set(allRows.map((r) => r.category).filter(Boolean))].sort(), [allRows]);

  /* ── Row action callbacks ──────────────────────────────────── */
  const handleView = useCallback((row) => {
    viewDialog.open(row);
  }, []);

  const handleEdit = useCallback((row) => {
    setEditForm({
      catalog_sku: row.catalog_sku || '',
      description: row.description || '',
      category: row.category || '',
      sub_category: row.sub_category || '',
    });
    editDialog.open(row);
  }, []);

  const handleCreate = async () => {
    try {
      await createMut.mutateAsync(createForm);
      toast('Catalog SKU created');
      createDialog.close();
      resetCreateForm();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };

  const handleUpdate = async () => {
    try {
      await updateMut.mutateAsync({ filter: { id: editDialog.data.id }, changes: editForm });
      toast('Catalog SKU updated');
      editDialog.close();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };

  const handleRefreshEmbeddings = async () => {
    try {
      const result = await refreshMut.mutateAsync();
      toast(`Refreshed ${result.refreshed ?? 0} embeddings`);
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };

  const handleImport = useCallback(async (formData) => {
    try {
      const result = await importMut.mutateAsync(formData);
      const ins = result?.inserted ?? 0;
      const upd = result?.updated ?? 0;
      toast(ins + upd === 0 ? 'Import complete — no changes' : `Catalog SKUs: ${ins} new, ${upd} updated`);
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
    entityName: 'catalog SKU',
    setSelectionModel: () => selection.clearSelection(),
    toast,
    errMsg,
    getLabel: (r) => r.catalog_sku,
  });

  /* ── ModuleBar: tabs + Archive/Restore + Refresh Embeddings + Create ─ */
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
      label: 'Refresh Embeddings',
      variant: 'outlined',
      disabled: refreshMut.isPending,
      onClick: handleRefreshEmbeddings,
    });

    if (canExport) {
      primary.push({ label: 'Export', variant: 'outlined', disabled: exportMut.isPending, onClick: handleExport });
    }
    if (canImport) {
      primary.push({ label: 'Import', variant: 'outlined', onClick: () => importDialog.open() });
    }

    primary.push({
      label: 'Create',
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
  }, [viewFilter, selectedRows.length, allActive, allArchived, selection.clearSelection, setArchiveOpen, setRestoreOpen, refreshMut.isPending, canImport, canExport, exportMut.isPending, handleExport]);
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
            <span>Catalog SKU Details</span>
            {viewDialog.data && (
              <Typography variant="body2" color="text.secondary">
                {viewDialog.data.catalog_sku}
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
              <FieldRow label="Catalog SKU" value={viewDialog.data.catalog_sku || '\u2014'} />
              <FieldRow label="Description" value={viewDialog.data.description || '\u2014'} />
              <FieldRow label="Category" value={viewDialog.data.category || '\u2014'} />
              <FieldRow label="Sub-Category" value={viewDialog.data.sub_category || '\u2014'} />
              <FieldRow label="Embedded" value={viewDialog.data.embedding ? 'Yes' : 'No'} />
              <FieldRow label="Status">
                <StatusBadge status={viewDialog.data.deactivated_at ? 'archived' : 'active'} />
              </FieldRow>
              <FieldRow label="Created" value={fmtDate(viewDialog.data.created_at)} />
              <FieldRow label="Updated" value={fmtDate(viewDialog.data.updated_at)} />
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Create Dialog ─────────────────────────────────────────── */}
      <FormDialog open={createDialog.isOpen} title="Create Catalog SKU" submitLabel="Create" loading={createMut.isPending} onSubmit={handleCreate} onCancel={createDialog.close}>
        <Box sx={formGridSx}>
          <TextField label="SKU Code" required value={createForm.catalog_sku} onChange={onCreateField('catalog_sku')} inputProps={{ maxLength: 64 }} />
          <TextField label="Category" value={createForm.category} onChange={onCreateField('category')} select={categories.length > 0} inputProps={{ maxLength: 64 }}>
            {categories.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </TextField>
          <TextField label="Sub-Category" value={createForm.sub_category} onChange={onCreateField('sub_category')} inputProps={{ maxLength: 64 }} />
          <TextField label="Description" required multiline rows={3} value={createForm.description} onChange={onCreateField('description')} sx={formFullSpanSx} />
        </Box>
      </FormDialog>

      {/* ── Edit Dialog ───────────────────────────────────────────── */}
      <FormDialog open={editDialog.isOpen} title="Edit Catalog SKU" submitLabel="Save" loading={updateMut.isPending} onSubmit={handleUpdate} onCancel={editDialog.close}>
        <Box sx={formGridSx}>
          <TextField label="SKU Code" required value={editForm.catalog_sku} onChange={onEditField('catalog_sku')} inputProps={{ maxLength: 64 }} />
          <TextField label="Category" value={editForm.category} onChange={onEditField('category')} select={categories.length > 0} inputProps={{ maxLength: 64 }}>
            {categories.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </TextField>
          <TextField label="Sub-Category" value={editForm.sub_category} onChange={onEditField('sub_category')} inputProps={{ maxLength: 64 }} />
          <TextField label="Description" required multiline rows={3} value={editForm.description} onChange={onEditField('description')} sx={formFullSpanSx} />
        </Box>
      </FormDialog>

      <ImportDialog open={importDialog.isOpen} title="Import Catalog SKUs" loading={importMut.isPending} onPreview={(fd) => catalogSkuApi.importXls(fd, { preview: true })} onSubmit={handleImport} onCancel={importDialog.close} />

      <ConfirmDialog {...archiveConfirmProps} />
      <ConfirmDialog {...restoreConfirmProps} />

      <ToastSnackbar {...snackProps} />
    </Box>
  );
}
