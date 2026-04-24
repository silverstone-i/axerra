/**
 * @file Manage Users page — read-only list with status & password management
 * @module client/pages/Tenant/ManageUsersPage
 *
 * portal_users is a pure identity/authentication table. User creation is handled
 * at the entity level (e.g. employee is_app_user toggle). This page lets
 * Axerra admins view all app users, change status (active/invited/locked),
 * and reset passwords.
 *
 * Migrated to standardised list-view selection system:
 *   useListSelection + DataTable + RowActionsMenu
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
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
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import DataTable from '../../components/shared/DataTable.jsx';
import ToastSnackbar from '../../components/shared/ToastSnackbar.jsx';
import FieldRow from '../../components/shared/FieldRow.jsx';
import FormDialog from '../../components/shared/FormDialog.jsx';
import PasswordField from '../../components/shared/PasswordField.jsx';
import { useModuleToolbarRegistration } from '../../contexts/ModuleActionsContext.jsx';
import { useUsers, useUpdateUser } from '../../hooks/useUsers.js';
import { pageContainerSx, dialogHeaderSx, dialogActionBoxSx, detailGridSx, flexColumnSx } from '../../config/layoutTokens.js';
import { useListSelection } from '../../hooks/useListSelection.js';
import { useToast } from '../../hooks/useToast.js';
import { capSnake, fmtDate, errMsg } from '../../utils/format.js';
import { statusColumn, capColumn } from '../../utils/columnHelpers.jsx';

/* ── Enums ────────────────────────────────────────────────────── */

const STATUS_OPTS = ['active', 'invited', 'locked'];

const ENTITY_TYPE_OPTS = [
  { value: '', label: 'All Types' },
  { value: 'employee', label: 'Employee' },
  { value: 'vendor_contact', label: 'Vendor Contact' },
  { value: 'client', label: 'Client' },
];

/* ── Empty form shapes ────────────────────────────────────────── */

const BLANK_EDIT = {
  email: '',
  status: 'active',
  password: '',
};

const PW_RULES = [
  { label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { label: 'An uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { label: 'A lowercase letter', test: (p) => /[a-z]/.test(p) },
  { label: 'A digit', test: (p) => /[0-9]/.test(p) },
  { label: 'A special character', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

/* ── Column definitions ───────────────────────────────────────── */

const columns = [
  { field: 'email', headerName: 'Email', flex: 1, minWidth: 220 },
  capColumn('entity_type', 'Entity Type', { snake: true, width: 140 }),
  statusColumn('status', 'Status', { width: 110 }),
];

/* ── Component ────────────────────────────────────────────────── */

export default function ManageUsersPage() {
  /* ── queries ─────────────────────────────────────────────── */
  const { data: usersRes, isLoading } = useUsers();
  const allRows = usersRes?.rows ?? [];

  /* ── filter state ─────────────────────────────────────────── */
  const [emailFilter, setEmailFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const rows = useMemo(() => {
    let out = allRows;
    if (emailFilter) {
      const q = emailFilter.toLowerCase();
      out = out.filter((r) => r.email?.toLowerCase().includes(q));
    }
    if (typeFilter) out = out.filter((r) => r.entity_type === typeFilter);
    return out;
  }, [allRows, emailFilter, typeFilter]);

  /* ── mutations ───────────────────────────────────────────── */
  const updateMut = useUpdateUser();

  /* ── selection ───────────────────────────────────────────── */
  const selection = useListSelection(rows, 'user');
  const { selectedRows } = selection;

  /* ── dialog state ────────────────────────────────────────── */
  const viewDialog = useDialogState();
  const editDialog = useDialogState();

  /* ── form state ──────────────────────────────────────────── */
  const { form: editForm, setForm: setEditForm, field: onEditField } = useFormState(BLANK_EDIT);

  /* ── snackbar ────────────────────────────────────────────── */
  const { toast, snackProps } = useToast();

  /* ── Row action callbacks ──────────────────────────────────── */
  const handleView = useCallback((row) => {
    viewDialog.open(row);
  }, []);

  const handleEdit = useCallback((row) => {
    setEditForm({
      email: row.email ?? '',
      status: row.status ?? 'active',
      password: '',
    });
    editDialog.open(row);
  }, []);

  /* ── CRUD handlers ───────────────────────────────────────── */
  const handleUpdate = async () => {
    try {
      const { password, ...fields } = editForm;
      const changes = {
        ...fields,
        ...(password ? { password } : {}),
      };
      await updateMut.mutateAsync({ filter: { id: editDialog.data.id }, changes });
      toast('User updated');
      editDialog.close();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };

  /* ── toolbar registration ────────────────────────────────── */
  const toolbar = useMemo(
    () => ({
      tabs: [],
      filters: [
        { name: 'email', placeholder: 'Search email\u2026', value: emailFilter, onChange: (e) => setEmailFilter(e.target.value) },
        { name: 'entity_type', placeholder: 'User Type', value: typeFilter, onChange: (e) => setTypeFilter(e.target.value), options: ENTITY_TYPE_OPTS },
      ],
      primaryActions: [],
    }),
    [selectedRows.length, emailFilter, typeFilter],
  );
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

      {/* ── View Details Dialog ──────────────────────────────── */}
      <Dialog open={viewDialog.isOpen} onClose={viewDialog.close} maxWidth="sm" fullWidth>
        <DialogTitle sx={dialogHeaderSx}>
          <Box>
            <span>User Details</span>
            {viewDialog.data && (
              <Typography variant="body2" color="text.secondary">
                {viewDialog.data.email}
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
                <FieldRow label="Email" value={viewDialog.data.email} />
                <FieldRow label="Entity Type" value={capSnake(viewDialog.data.entity_type) || '\u2014'} />
                <FieldRow label="Status">
                  <StatusBadge status={viewDialog.data.status} />
                </FieldRow>
                <FieldRow label="Created" value={fmtDate(viewDialog.data.created_at)} />
                <FieldRow label="Updated" value={fmtDate(viewDialog.data.updated_at)} />
              </Box>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ────────────────────────────────────── */}
      <FormDialog
        open={editDialog.isOpen}
        title="Edit User"
        submitLabel="Save Changes"
        loading={updateMut.isPending}
        submitDisabled={!!editForm.password && !PW_RULES.every((r) => r.test(editForm.password))}
        onSubmit={handleUpdate}
        onCancel={editDialog.close}
      >
        {editDialog.data && <TextField label="Email" value={editDialog.data.email} disabled />}
        <TextField label="Status" select value={editForm.status} onChange={onEditField('status')}>
          {STATUS_OPTS.map((s) => (
            <MenuItem key={s} value={s}>
              {capSnake(s)}
            </MenuItem>
          ))}
        </TextField>

        <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>
          Reset Password
        </Typography>
        <PasswordField
          label="New Password"
          value={editForm.password}
          onChange={onEditField('password')}
          autoComplete="new-password"
          helperText="Leave blank to keep current password"
        />
        {editForm.password && (
          <Box sx={{ mt: 0.5, mb: 1 }}>
            {PW_RULES.map((r) => {
              const pass = r.test(editForm.password);
              return (
                <Box
                  key={r.label}
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}
                >
                  <Typography variant="caption" color={pass ? 'success.main' : 'text.secondary'}>
                    {pass ? '\u2713' : '\u2717'} {r.label}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        )}
      </FormDialog>

      {/* ── Snackbar ───────────────────────────────────────── */}
      <ToastSnackbar {...snackProps} />
    </Box>
  );
}
