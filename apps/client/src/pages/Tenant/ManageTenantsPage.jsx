/**
 * @file Manage Tenants page — DataTable list with CRUD dialogs
 * @module client/pages/Tenant/ManageTenantsPage
 *
 * Implements PRD §3.2.1 UI: tenant grid, create / edit / view / archive / restore,
 * toolbar actions via useModuleToolbarRegistration, snackbar feedback.
 *
 * Adapted for pure identity portal_users — no tenant_role admin/billing contacts.
 *
 * Migrated to standardised list-view selection system:
 *   useListSelection + DataTable + RowActionsMenu
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import { useState, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useFormState } from '../../hooks/useFormState.js';
import { useDialogState } from '../../hooks/useDialogState.js';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Link from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import StatusBadge from '../../components/shared/StatusBadge.jsx';
import FieldRow from '../../components/shared/FieldRow.jsx';
import TaxIdentifiersSection from '../../components/shared/TaxIdentifiersSection.jsx';
import ConfirmDialog from '../../components/shared/ConfirmDialog.jsx';
import DataTable from '../../components/shared/DataTable.jsx';
import DetailDialog from '../../components/shared/DetailDialog.jsx';
import ToastSnackbar from '../../components/shared/ToastSnackbar.jsx';
import FormDialog from '../../components/shared/FormDialog.jsx';
import ImportDialog from '../../components/shared/ImportDialog.jsx';
import ReadOnlyDataTable from '../../components/shared/ReadOnlyDataTable.jsx';
import CreateTenantWizard from './CreateTenantWizard.jsx';
import { COUNTRIES, formatByPattern } from '@vimber/shared';
import { useModuleToolbarRegistration } from '../../contexts/ModuleActionsContext.jsx';
import { useImportXls, useExportXls } from '../../hooks/useImportExport.js';
import { tenantApi } from '../../services/tenantApi.js';
import {
  useTenants,
  useTenantContacts,
  useTenantCompany,
  useUpdateTenant,
  useArchiveTenant,
  useRestoreTenant,
  TENANTS_KEY,
  TENANT_SCHEMAS_KEY,
} from '../../hooks/useTenants.js';
import { pageContainerSx, formFullSpanSx, detailGridSx } from '../../config/layoutTokens.js';
import { useListSelection } from '../../hooks/useListSelection.js';
import { useToast } from '../../hooks/useToast.js';
import { cap, fmtDate, errMsg } from '../../utils/format.js';
import { statusColumn, capColumn } from '../../utils/columnHelpers.jsx';

/* ── Enums ────────────────────────────────────────────────────── */

const STATUS_OPTS = ['active', 'trial', 'suspended', 'pending'];
const TIER_OPTS = ['starter', 'growth', 'enterprise'];

/* ── Empty form shapes ────────────────────────────────────────── */

const BLANK_EDIT = {
  company: '',
  status: 'active',
  tier: 'starter',
  region: '',
  max_users: 5,
  notes: '',
};

/* ── Column definitions ───────────────────────────────────────── */

const columns = [
  { field: 'tenant_code', headerName: 'Code', width: 100 },
  { field: 'company', headerName: 'Tenant Name', flex: 1, minWidth: 180 },
  statusColumn(),
  capColumn('tier', 'Tier'),
  { field: 'region', headerName: 'Region', width: 130 },
  { field: 'deactivated_at', headerName: 'Active', width: 90, valueGetter: (params) => (params.row.deactivated_at ? 'No' : 'Yes') },
];

/* ── Detail dialog helpers ────────────────────────────────────── */

const contactColumns = [
  {
    field: 'name',
    headerName: 'Name',
    flex: 1,
    minWidth: 150,
    valueGetter: (params) => `${params.row.first_name} ${params.row.last_name}`,
  },
  {
    field: 'email',
    headerName: 'Email',
    flex: 1,
    minWidth: 180,
    renderCell: (params) =>
      params.value ? (
        <Link href={`mailto:${params.value}`} underline="hover">
          {params.value}
        </Link>
      ) : (
        '\u2014'
      ),
  },
  {
    field: 'primary_phone',
    headerName: 'Phone',
    width: 170,
    valueGetter: (params) => {
      const phone = params.row.primary_phone;
      if (!phone) return '\u2014';
      const country = COUNTRIES.find((c) => c.code === params.row.phone_country_code);
      return formatByPattern(phone, country?.placeholder) || phone;
    },
  },
];

/* ── Component ────────────────────────────────────────────────── */

export default function ManageTenantsPage() {
  /* ── queries ─────────────────────────────────────────────── */
  const qc = useQueryClient();
  const { data: tenantRes, isLoading } = useTenants();
  const allRows = tenantRes?.rows ?? [];

  const detailDialog = useDialogState();
  const detailTenant = allRows.find((r) => r.id === detailDialog.data) ?? null;
  const { data: contactsData } = useTenantContacts(detailDialog.data);
  const { data: companyData } = useTenantCompany(detailDialog.data);

  /* ── view filter (Active / All / Archived) ───────────────── */
  const [viewFilter, setViewFilter] = useState('active');
  const rows = useMemo(() => {
    if (viewFilter === 'active') return allRows.filter((r) => !r.deactivated_at);
    if (viewFilter === 'archived') return allRows.filter((r) => !!r.deactivated_at);
    return allRows;
  }, [allRows, viewFilter]);

  /* ── mutations ───────────────────────────────────────────── */
  const updateMut = useUpdateTenant();
  const archiveMut = useArchiveTenant();
  const restoreMut = useRestoreTenant();
  const importMut = useImportXls(tenantApi.importXls, TENANTS_KEY, [TENANT_SCHEMAS_KEY]);
  const exportMut = useExportXls(tenantApi.exportXls, 'tenants');

  /* ── selection (multi-select with root-tenant mutual exclusion) */
  const selection = useListSelection(rows, 'tenant');
  const { selectedRows, allActive, allArchived } = selection;

  /* ── dialog state ────────────────────────────────────────── */
  const createDialog = useDialogState();
  const editDialog = useDialogState();
  const importDialog = useDialogState();
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [importErrors, setImportErrors] = useState(null);

  /* ── form state ──────────────────────────────────────────── */
  const { form: editForm, setForm: setEditForm, field: onEditField } = useFormState(BLANK_EDIT);

  /* ── snackbar ────────────────────────────────────────────── */
  const { toast, snackProps } = useToast();

  /* ── Row action callbacks ──────────────────────────────────── */
  const handleView = useCallback((row) => {
    qc.invalidateQueries({ queryKey: [...TENANTS_KEY, row.id, 'contacts'] });
    qc.invalidateQueries({ queryKey: [...TENANTS_KEY, row.id, 'company'] });
    detailDialog.open(row.id);
  }, [qc]);

  const handleEdit = useCallback((row) => {
    setEditForm({
      company: row.company ?? '',
      status: row.status ?? 'active',
      tier: row.tier ?? 'starter',
      region: row.region ?? '',
      max_users: row.max_users ?? 5,
      notes: row.notes ?? '',
    });
    editDialog.open(row);
  }, []);

  /* ── CRUD handlers ───────────────────────────────────────── */
  const handleUpdate = async () => {
    try {
      await updateMut.mutateAsync({
        filter: { id: editDialog.data.id },
        changes: { ...editForm, max_users: Number(editForm.max_users) || 5 },
      });
      toast('Tenant updated');
      editDialog.close();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };

  const handleArchive = async () => {
    try {
      const targets = selectedRows.filter((r) => !r.deactivated_at);
      for (const row of targets) {
        await archiveMut.mutateAsync({ id: row.id });
      }
      toast(
        targets.length === 1
          ? 'Tenant archived \u2014 all users deactivated'
          : `${targets.length} tenants archived \u2014 all users deactivated`,
      );
      setArchiveOpen(false);
      selection.clearSelection();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };

  const handleRestore = async () => {
    try {
      const targets = selectedRows.filter((r) => !!r.deactivated_at);
      for (const row of targets) {
        await restoreMut.mutateAsync({ id: row.id });
      }
      toast(
        targets.length === 1
          ? 'Tenant restored \u2014 users remain archived'
          : `${targets.length} tenants restored \u2014 users remain archived`,
      );
      setRestoreOpen(false);
      selection.clearSelection();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };

  /* ── import / export handlers ─────────────────────────────── */
  const handleImport = useCallback(async (formData) => {
    setImportErrors(null);
    try {
      const result = await importMut.mutateAsync(formData);
      const parts = [];
      if (result.inserted) parts.push(`${result.inserted} created`);
      if (result.updated) parts.push(`${result.updated} updated`);
      toast(parts.join(', ') || 'Import complete');
      importDialog.close();
    } catch (err) {
      const validationErrors = err.payload?.errors;
      if (validationErrors?.length) {
        setImportErrors(validationErrors.map((e) => ({
          sheet: e.sheet || 'tenants',
          row: e.row,
          column: e.tenant_code ? 'tenant_code' : '',
          value: e.tenant_code || '',
          message: e.message,
        })));
      } else {
        toast(errMsg(err), 'error');
      }
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

  /* ── toolbar registration ────────────────────────────────── */
  const toolbar = useMemo(() => {
    const primary = [];

    primary.push({
      label: 'Export',
      variant: 'outlined',
      disabled: exportMut.isPending,
      onClick: handleExport,
    });
    primary.push({
      label: 'Import',
      variant: 'outlined',
      onClick: () => importDialog.open(),
    });

    if (viewFilter === 'active' || viewFilter === 'all') {
      primary.push({
        label: selectedRows.length > 1 ? `Archive (${selectedRows.length})` : 'Archive',
        variant: 'outlined',
        color: 'error',
        disabled: selectedRows.length === 0 || !allActive || selection.hasRootSelected,
        onClick: () => setArchiveOpen(true),
      });
    }
    if (viewFilter === 'archived' || viewFilter === 'all') {
      primary.push({
        label: selectedRows.length > 1 ? `Restore (${selectedRows.length})` : 'Restore',
        variant: 'outlined',
        color: 'success',
        disabled: selectedRows.length === 0 || !allArchived || selection.hasRootSelected,
        onClick: () => setRestoreOpen(true),
      });
    }

    primary.push({
      label: 'Create Tenant',
      variant: 'contained',
      color: 'primary',
      onClick: () => createDialog.open(),
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
  }, [viewFilter, selectedRows.length, allActive, allArchived, selection.hasRootSelected, selection.clearSelection, exportMut.isPending, handleExport]);
  useModuleToolbarRegistration(toolbar);

  /* ── render ──────────────────────────────────────────────── */
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

      {/* ── View Details ───────────────────────────────────── */}
      <DetailDialog open={detailDialog.isOpen} onClose={detailDialog.close} maxWidth="md" title="Tenant Details" subtitle={detailTenant?.company}>
        {detailTenant && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* ── Tenant fields ─────────────────────────────── */}
            <Box sx={detailGridSx}>
              <FieldRow label="Code" value={detailTenant.tenant_code} />
              <FieldRow label="Tier" value={cap(detailTenant.tier)} />
              <FieldRow label="Region" value={detailTenant.region || '\u2014'} />
              <FieldRow label="Status">
                <StatusBadge status={detailTenant.status} />
              </FieldRow>
              <FieldRow label="Max Users" value={detailTenant.max_users ?? '\u2014'} />
              <FieldRow label="Schema">
                <Typography variant="body2" fontFamily="monospace">
                  {detailTenant.schema_name || '\u2014'}
                </Typography>
              </FieldRow>
              <FieldRow label="Created" value={fmtDate(detailTenant.created_at)} />
              <FieldRow label="Updated" value={fmtDate(detailTenant.updated_at)} />
              <FieldRow label="Notes" value={detailTenant.notes || '\u2014'} sx={formFullSpanSx} />
            </Box>

            {/* ── Company Address & Tax IDs ─────────────────── */}
            {companyData?.company && (
              <>
                <Divider />
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography variant="overline" color="text.secondary">
                    Company Billing Address
                  </Typography>
                  {companyData.addresses?.length ? (
                    <Box sx={detailGridSx}>
                      {companyData.addresses.map((a) => (
                        <Box key={a.id} sx={{ gridColumn: '1 / -1' }}>
                          <Typography variant="body2">
                            {[a.address_line_1, a.address_line_2, a.address_line_3].filter(Boolean).join(', ')}
                          </Typography>
                          <Typography variant="body2">
                            {[a.city, a.state_province, a.postal_code, a.country_code].filter(Boolean).join(', ')}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No address on file
                    </Typography>
                  )}
                </Box>
                <TaxIdentifiersSection taxIds={companyData.tax_identifiers} />
              </>
            )}

            {/* ── Contacts ──────────────────────────────────── */}
            <Divider />

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Typography variant="overline" color="text.secondary">
                Primary Contacts
              </Typography>
              {contactsData?.primary?.length ? (
                <ReadOnlyDataTable
                  rows={contactsData.primary}
                  columns={contactColumns}
                  getRowId={(r) => r.id}
                />
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No primary contacts
                </Typography>
              )}
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Typography variant="overline" color="text.secondary">
                Billing Contacts
              </Typography>
              {contactsData?.billing?.length ? (
                <ReadOnlyDataTable
                  rows={contactsData.billing}
                  columns={contactColumns}
                  getRowId={(r) => r.id}
                />
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No billing contacts
                </Typography>
              )}
            </Box>
          </Box>
        )}
      </DetailDialog>

      {/* ── Create Wizard ──────────────────────────────────── */}
      <CreateTenantWizard open={createDialog.isOpen} onClose={createDialog.close} onSuccess={toast} />

      {/* ── Edit Dialog ────────────────────────────────────── */}
      <FormDialog
        open={editDialog.isOpen}
        title="Edit Tenant"
        submitLabel="Save Changes"
        loading={updateMut.isPending}
        onSubmit={handleUpdate}
        onCancel={editDialog.close}
      >
        {editDialog.data && (
          <>
            <TextField
              label="Tenant Code"
              value={editDialog.data.tenant_code}
              disabled
              helperText="Cannot be changed after creation"
            />
            <TextField label="Schema Name" value={editDialog.data.schema_name ?? ''} disabled />
          </>
        )}
        <TextField
          label="Company Name"
          required
          value={editForm.company}
          onChange={onEditField('company')}
        />
        <TextField label="Status" select value={editForm.status} onChange={onEditField('status')}>
          {STATUS_OPTS.map((s) => (
            <MenuItem key={s} value={s}>
              {cap(s)}
            </MenuItem>
          ))}
        </TextField>
        <TextField label="Tier" select value={editForm.tier} onChange={onEditField('tier')}>
          {TIER_OPTS.map((t) => (
            <MenuItem key={t} value={t}>
              {cap(t)}
            </MenuItem>
          ))}
        </TextField>
        <TextField label="Region" value={editForm.region} onChange={onEditField('region')} />
        <TextField
          label="Max Users"
          type="number"
          value={editForm.max_users}
          onChange={onEditField('max_users')}
        />
        <TextField
          label="Notes"
          multiline
          minRows={2}
          value={editForm.notes}
          onChange={onEditField('notes')}
        />
      </FormDialog>

      {/* ── Archive Confirmation ────────────────────────────── */}
      <ConfirmDialog
        open={archiveOpen}
        title="Archive Tenant"
        message={
          selection.hasSelection
            ? selectedRows.length === 1
              ? `Are you sure you want to archive "${selectedRows[0].company}" (${selectedRows[0].tenant_code})? All users belonging to this tenant will be deactivated.`
              : `Are you sure you want to archive ${selectedRows.length} tenants? All users belonging to these tenants will be deactivated.`
            : ''
        }
        confirmLabel="Archive"
        confirmColor="error"
        loading={archiveMut.isPending}
        onConfirm={handleArchive}
        onCancel={() => setArchiveOpen(false)}
      />

      {/* ── Restore Confirmation ────────────────────────────── */}
      <ConfirmDialog
        open={restoreOpen}
        title="Restore Tenant"
        message={
          selection.hasSelection
            ? selectedRows.length === 1
              ? `Restore "${selectedRows[0].company}" (${selectedRows[0].tenant_code})? Users will remain archived and must be restored individually.`
              : `Restore ${selectedRows.length} tenants? Users will remain archived and must be restored individually.`
            : ''
        }
        confirmLabel="Restore"
        confirmColor="success"
        loading={restoreMut.isPending}
        onConfirm={handleRestore}
        onCancel={() => setRestoreOpen(false)}
      />

      {/* ── Import Dialog ──────────────────────────────────── */}
      <ImportDialog
        open={importDialog.isOpen}
        title="Import Tenants"
        loading={importMut.isPending}
        errors={importErrors}
        onSubmit={handleImport}
        onCancel={() => { importDialog.close(); setImportErrors(null); }}
      />

      {/* ── Snackbar ───────────────────────────────────────── */}
      <ToastSnackbar {...snackProps} />
    </Box>
  );
}
