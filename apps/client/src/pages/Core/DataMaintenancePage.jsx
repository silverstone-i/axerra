/**
 * @file Data maintenance page — tenant-level data hygiene operations
 * @module client/pages/Core/DataMaintenancePage
 *
 * Currently exposes one operation: orphan-source preview + cleanup. Future
 * maintenance ops (audit-log review, bulk archival, etc.) land as additional
 * sections on this same page. See issue #43.
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

import PrimaryButton from '../../components/shared/PrimaryButton.jsx';
import SecondaryButton from '../../components/shared/SecondaryButton.jsx';
import ConfirmDialog from '../../components/shared/ConfirmDialog.jsx';
import ToastSnackbar from '../../components/shared/ToastSnackbar.jsx';
import { useToast } from '../../hooks/useToast.js';
import { useModuleToolbarRegistration } from '../../contexts/ModuleActionsContext.jsx';
import { sourcesApi } from '../../services/sourcesApi.js';
import { pageContainerSx, flexColumnSx } from '../../config/layoutTokens.js';

/* ── Helpers ───────────────────────────────────────────────────── */

const formatDateTime = (value) => {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
};

const errMsg = (err) => err?.payload?.error || err?.message || 'Request failed';

/* ── Component ─────────────────────────────────────────────────── */

export default function DataMaintenancePage() {
  const { toast, snackProps } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Preview is opt-in (manual click) so the page renders fast and we don't
  // surprise users with a query the first time they navigate here.
  const previewQuery = useQuery({
    queryKey: ['sources', 'orphans', 'preview'],
    queryFn: () => sourcesApi.previewOrphans(),
    enabled: false,
    refetchOnWindowFocus: false,
  });

  const cleanupMut = useMutation({
    mutationFn: () => sourcesApi.cleanupOrphans(),
    onSuccess: async (result) => {
      toast(`Cleaned up ${result.count} orphan${result.count === 1 ? '' : 's'}`);
      await previewQuery.refetch();
    },
    onError: (err) => toast(errMsg(err), 'error'),
  });

  /* ── Derived data ─────────────────────────────────────────────── */

  const data = previewQuery.data;
  const orphans = data?.orphans ?? [];
  const orphanCount = data?.count ?? 0;
  const hasPreviewed = !!data;

  const columns = useMemo(
    () => [
      { field: 'source_type', headerName: 'Type', width: 140 },
      { field: 'label', headerName: 'Label', flex: 1, minWidth: 200 },
      {
        field: 'created_at',
        headerName: 'Created',
        width: 200,
        valueGetter: (params) => formatDateTime(params.row.created_at),
      },
      { field: 'table_id', headerName: 'Original entity ID', width: 320 },
    ],
    [],
  );

  /* ── Handlers ─────────────────────────────────────────────────── */

  const handlePreview = () => {
    previewQuery.refetch().catch((err) => toast(errMsg(err), 'error'));
  };

  const handleCleanupConfirm = async () => {
    try {
      await cleanupMut.mutateAsync();
    } finally {
      setConfirmOpen(false);
    }
  };

  /* ── Toolbar (empty — no module-level actions) ────────────────── */

  const toolbar = useMemo(() => ({ tabs: [], filters: [], primaryActions: [] }), []);
  useModuleToolbarRegistration(toolbar);

  /* ── Render ───────────────────────────────────────────────────── */

  const cleanupLabel =
    orphanCount > 0 ? `Clean up ${orphanCount} orphan${orphanCount === 1 ? '' : 's'}` : 'Clean up';

  const cleanupDisabled = !hasPreviewed || orphanCount === 0 || cleanupMut.isPending;

  return (
    <Box sx={{ ...pageContainerSx, overflow: 'auto', p: 2 }}>
      <Typography variant="h6" sx={{ mb: 1 }}>
        Data Maintenance
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Tenant-level data hygiene operations. All actions affect this tenant only.
      </Typography>

      <Card variant="outlined">
        <CardContent sx={flexColumnSx}>
          <Box>
            <Typography variant="subtitle1" fontWeight={600}>
              Orphan sources
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Sources rows whose owning entity (vendor, client, employee, contact, company,
              vendor contact) was hard-deleted. Cleaning up cascades through child tables — emails,
              phone numbers, addresses, and tax identifiers attached to the orphan source.
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} alignItems="center">
            <SecondaryButton size="small" onClick={handlePreview} disabled={previewQuery.isFetching}>
              {previewQuery.isFetching ? 'Loading…' : hasPreviewed ? 'Refresh preview' : 'Preview'}
            </SecondaryButton>
            <PrimaryButton
              size="small"
              onClick={() => setConfirmOpen(true)}
              disabled={cleanupDisabled}
            >
              {cleanupMut.isPending ? 'Cleaning up…' : cleanupLabel}
            </PrimaryButton>
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
                getRowId={(row) => row.source_id}
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
        open={confirmOpen}
        title="Clean up orphan sources"
        message={
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {orphanCount === 1
                ? 'This will permanently delete 1 orphan source row.'
                : `This will permanently delete ${orphanCount} orphan source rows.`}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Linked emails, phone numbers, addresses, and tax identifiers will be cascade-deleted in
              the same transaction. This cannot be undone.
            </Typography>
          </Box>
        }
        confirmLabel="Clean up"
        cancelLabel="Cancel"
        loading={cleanupMut.isPending}
        onConfirm={handleCleanupConfirm}
        onCancel={() => setConfirmOpen(false)}
      />

      <ToastSnackbar {...snackProps} />
    </Box>
  );
}
