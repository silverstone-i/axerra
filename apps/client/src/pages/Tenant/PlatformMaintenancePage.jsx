/**
 * @file Platform maintenance page — Axerra-only data hygiene operations
 * @module client/pages/Tenant/PlatformMaintenancePage
 *
 * Sibling of Core/DataMaintenancePage, scoped to the platform-level
 * (admin schema) operations that only Axerra operators can run. Currently
 * exposes orphan portal_users cleanup; future cross-tenant maintenance
 * lands as additional cards on this page.
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import { useMemo, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { DataGrid } from '@mui/x-data-grid';

import SecondaryButton from '../../components/shared/SecondaryButton.jsx';
import ConfirmDialog from '../../components/shared/ConfirmDialog.jsx';
import ToastSnackbar from '../../components/shared/ToastSnackbar.jsx';
import { useToast } from '../../hooks/useToast.js';
import { useModuleToolbarRegistration } from '../../contexts/ModuleActionsContext.jsx';
import { orphanPortalUsersApi } from '../../services/orphanPortalUsersApi.js';
import { pageContainerSx, flexColumnSx } from '../../config/layoutTokens.js';

/* ── Helpers ───────────────────────────────────────────────────── */

const formatDateTime = (value) => {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
};

const errMsg = (err) => err?.payload?.error || err?.message || 'Request failed';

/* ── Component ─────────────────────────────────────────────────── */

export default function PlatformMaintenancePage() {
  const { toast, snackProps } = useToast();
  const [confirmTarget, setConfirmTarget] = useState(null);

  // Preview is opt-in (manual click) so the page renders fast and we don't
  // surprise users with a query the first time they navigate here.
  const previewQuery = useQuery({
    queryKey: ['orphan-portal-users', 'preview'],
    queryFn: () => orphanPortalUsersApi.previewOrphans(),
    enabled: false,
    refetchOnWindowFocus: false,
  });

  const cleanupMut = useMutation({
    mutationFn: (id) => orphanPortalUsersApi.cleanupOrphan(id),
    onSuccess: async () => {
      toast('Orphan portal user removed');
      await previewQuery.refetch();
    },
    onError: (err) => toast(errMsg(err), 'error'),
    onSettled: () => setConfirmTarget(null),
  });

  /* ── Derived data ─────────────────────────────────────────────── */

  const data = previewQuery.data;
  const orphans = data?.orphans ?? [];
  const orphanCount = data?.count ?? 0;
  const hasPreviewed = !!data;

  const columns = useMemo(
    () => [
      { field: 'email', headerName: 'Email', flex: 1, minWidth: 240 },
      { field: 'status', headerName: 'Status', width: 120 },
      {
        field: 'created_at',
        headerName: 'Created',
        width: 200,
        valueGetter: (params) => formatDateTime(params.row.created_at),
      },
      {
        field: 'actions',
        headerName: 'Actions',
        width: 140,
        sortable: false,
        filterable: false,
        renderCell: (params) => (
          <SecondaryButton
            size="small"
            onClick={() => setConfirmTarget(params.row)}
            disabled={cleanupMut.isPending}
          >
            Delete
          </SecondaryButton>
        ),
      },
    ],
    [cleanupMut.isPending],
  );

  /* ── Handlers ─────────────────────────────────────────────────── */

  const handlePreview = () => {
    previewQuery.refetch().catch((err) => toast(errMsg(err), 'error'));
  };

  const handleCleanupConfirm = () => {
    if (!confirmTarget?.id) return;
    cleanupMut.mutate(confirmTarget.id);
  };

  /* ── Toolbar (empty — no module-level actions) ────────────────── */

  const toolbar = useMemo(() => ({ tabs: [], filters: [], primaryActions: [] }), []);
  useModuleToolbarRegistration(toolbar);

  /* ── Render ───────────────────────────────────────────────────── */

  return (
    <Box sx={{ ...pageContainerSx, overflow: 'auto', p: 2 }}>
      <Typography variant="h6" sx={{ mb: 1 }}>
        Platform Maintenance
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Axerra-only data hygiene operations across the platform admin schema.
      </Typography>

      <Card variant="outlined">
        <CardContent sx={flexColumnSx}>
          <Box>
            <Typography variant="subtitle1" fontWeight={600}>
              Orphan portal users
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              portal_users rows with no portal_user_tenants reference at all
              (active or archived) and no impersonation_logs reference. Archived
              bindings still represent restorable history; users referenced by
              the impersonation audit trail are also preserved. Deleting a row
              is permanent.
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} alignItems="center">
            <SecondaryButton size="small" onClick={handlePreview} disabled={previewQuery.isFetching}>
              {previewQuery.isFetching ? 'Loading…' : hasPreviewed ? 'Refresh' : 'Preview'}
            </SecondaryButton>
            {hasPreviewed && (
              <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                {orphanCount === 0
                  ? 'No orphans found.'
                  : `${orphanCount} orphan${orphanCount === 1 ? '' : 's'} found.`}
              </Typography>
            )}
          </Stack>

          {hasPreviewed && orphanCount > 0 && (
            <Box sx={{ height: 360, width: '100%' }}>
              <DataGrid
                rows={orphans}
                columns={columns}
                getRowId={(row) => row.id}
                density="compact"
                disableRowSelectionOnClick
                hideFooterSelectedRowCount
                pageSizeOptions={[25, 50, 100]}
                initialState={{ pagination: { paginationModel: { pageSize: 25, page: 0 } } }}
              />
            </Box>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!confirmTarget}
        title="Delete orphan portal user"
        message={
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              This will permanently delete the portal_users row for
              {' '}<strong>{confirmTarget?.email}</strong>.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              The user has no tenant bindings (active or archived) and no
              impersonation-log references. This cannot be undone.
            </Typography>
          </Box>
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        loading={cleanupMut.isPending}
        onConfirm={handleCleanupConfirm}
        onCancel={() => setConfirmTarget(null)}
      />

      <ToastSnackbar {...snackProps} />
    </Box>
  );
}
