/**
 * @file Preferences page — tenant-level UI preferences
 * @module nap-client/pages/Settings/PreferencesPage
 *
 * Allows admins to configure default display settings such as the number of
 * rows shown in data grids across the application.
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';

import { useModuleToolbarRegistration } from '../../contexts/ModuleActionsContext.jsx';
import { useTenantPreferences, useUpdateTenantPreferences } from '../../hooks/useTenantPreferences.js';
import { pageContainerSx } from '../../config/layoutTokens.js';

/* ── Constants ─────────────────────────────────────────────────── */

const PAGE_SIZE_OPTIONS = [
  { value: 25, label: '25' },
  { value: 50, label: '50' },
  { value: 100, label: '100' },
  { value: 200, label: '200' },
  { value: 500, label: '500 (slow load)' },
  { value: 1000, label: '1000 (slow load)' },
];

/* ── Component ─────────────────────────────────────────────────── */

export default function PreferencesPage() {
  const { data: res, isLoading } = useTenantPreferences();
  const row = res?.rows?.[0] ?? null;
  const updateMut = useUpdateTenantPreferences();

  const [form, setForm] = useState({ default_page_size: 25 });
  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' });
  const toast = useCallback((msg, sev = 'success') => setSnack({ open: true, msg, sev }), []);

  const rowId = row?.id;
  const rowPageSize = row?.default_page_size ?? 25;
  useEffect(() => {
    if (rowId) {
      setForm({ default_page_size: rowPageSize });
    }
  }, [rowId, rowPageSize]);

  const dirty = row ? form.default_page_size !== (row.default_page_size ?? 25) : false;

  const handleSave = async () => {
    try {
      await updateMut.mutateAsync({
        filter: { id: row.id },
        changes: { default_page_size: form.default_page_size },
      });
      toast('Preferences saved');
    } catch (err) {
      toast(err.payload?.error || err.message || 'Save failed', 'error');
    }
  };

  /* ── toolbar ────────────────────────────────────────────────── */
  const toolbar = useMemo(() => ({ tabs: [], filters: [], primaryActions: [] }), []);
  useModuleToolbarRegistration(toolbar);

  return (
    <Box sx={{ ...pageContainerSx, overflow: 'auto', p: 2 }}>
      <Typography variant="h6" sx={{ mb: 1 }}>
        Preferences
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Configure default display settings for this tenant.
      </Typography>

      {isLoading ? (
        <Skeleton variant="rounded" height={120} />
      ) : (
        <Card variant="outlined" sx={{ maxWidth: 480 }}>
          <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="subtitle1" fontWeight={600}>
              Data Grid Display
            </Typography>

            <TextField
              label="Default Rows Per Page"
              size="small"
              select
              value={form.default_page_size}
              onChange={(e) => setForm((p) => ({ ...p, default_page_size: Number(e.target.value) }))}
              helperText="Sets the default number of rows shown in all data grids"
            >
              {PAGE_SIZE_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                size="small"
                disabled={!dirty || updateMut.isPending}
                onClick={handleSave}
              >
                {updateMut.isPending ? 'Saving...' : 'Save'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.sev} variant="filled" onClose={() => setSnack((s) => ({ ...s, open: false }))}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
