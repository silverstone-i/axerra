/**
 * @file Numbering Configuration page — card-based settings for auto-numbering per entity type
 * @module client/pages/Settings/NumberingConfigPage
 *
 * Displays one card per entity type (7 total). Each card has an enable toggle,
 * format fields, and a live preview of the generated number.
 *
 * Copyright (c) 2025 – present Vimber LLC. All rights reserved.
 */

import { useState, useMemo, useEffect } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import PrimaryButton from '../../components/shared/PrimaryButton.jsx';
import Skeleton from '@mui/material/Skeleton';
import Divider from '@mui/material/Divider';

import ToastSnackbar from '../../components/shared/ToastSnackbar.jsx';
import { useModuleToolbarRegistration } from '../../contexts/ModuleActionsContext.jsx';
import { useNumberingConfig, useUpdateNumberingConfig } from '../../hooks/useNumberingConfig.js';
import { pageContainerSx, flexBetweenSx, flexColumnSx } from '../../config/layoutTokens.js';
import { useToast } from '../../hooks/useToast.js';

/* ── Constants ─────────────────────────────────────────────────── */

const ID_TYPE_LABELS = {
  employee: 'Employee',
  vendor: 'Vendor',
  client: 'Client',
  contact: 'Contact',
  project: 'Project',
  ar_invoice: 'AR Invoice',
  ap_invoice: 'AP Invoice',
};

const DATE_MODE_OPTS = [
  { value: 'none', label: 'None' },
  { value: 'year', label: 'Year (YYYY)' },
  { value: 'year_month', label: 'Year-Month (YYYY-MM)' },
  { value: 'ymd', label: 'Full Date (YYYY-MM-DD)' },
];

const RESET_MODE_OPTS = [
  { value: 'never', label: 'Never' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'daily', label: 'Daily' },
];

const SCOPE_TYPE_OPTS = [
  { value: 'none', label: 'None (Tenant)' },
  { value: 'legal_entity', label: 'Legal Entity' },
  { value: 'company', label: 'Company' },
  { value: 'project', label: 'Project' },
];

/* ── Preview helper ────────────────────────────────────────────── */

function buildPreview(cfg) {
  const serial = String(cfg.increment || 1);
  const padded = serial.padStart(cfg.padding || 4, '0');
  const sep = cfg.separator || '';

  const now = new Date();
  const y = String(now.getFullYear());
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');

  let datePart = '';
  if (cfg.date_mode === 'year') datePart = y;
  else if (cfg.date_mode === 'year_month') datePart = `${y}-${m}`;
  else if (cfg.date_mode === 'ymd') datePart = `${y}-${m}-${d}`;

  const parts = [cfg.prefix, datePart, padded, cfg.suffix].filter(Boolean);
  const result = parts.join(sep);
  return cfg.uppercase ? result.toUpperCase() : result;
}

/* ── NumberingCard ──────────────────────────────────────────────── */

function NumberingCard({ config, onSave, saving }) {
  const [form, setForm] = useState({});

  useEffect(() => {
    if (config) {
      setForm({
        prefix: config.prefix ?? '',
        suffix: config.suffix ?? '',
        date_mode: config.date_mode ?? 'none',
        reset_mode: config.reset_mode ?? 'never',
        padding: config.padding ?? 4,
        increment: config.increment ?? 1,
        separator: config.separator ?? '-',
        uppercase: config.uppercase ?? true,
        scope_type: config.scope_type ?? 'none',
        is_enabled: config.is_enabled ?? false,
      });
    }
  }, [config]);

  const onChange = (field) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((p) => ({ ...p, [field]: val }));
  };

  const preview = useMemo(() => buildPreview(form), [form]);

  const dirty = useMemo(() => {
    if (!config) return false;
    return (
      form.prefix !== (config.prefix ?? '') ||
      form.suffix !== (config.suffix ?? '') ||
      form.date_mode !== (config.date_mode ?? 'none') ||
      form.reset_mode !== (config.reset_mode ?? 'never') ||
      Number(form.padding) !== (config.padding ?? 4) ||
      Number(form.increment) !== (config.increment ?? 1) ||
      form.separator !== (config.separator ?? '-') ||
      form.uppercase !== (config.uppercase ?? true) ||
      form.scope_type !== (config.scope_type ?? 'none') ||
      form.is_enabled !== (config.is_enabled ?? false)
    );
  }, [form, config]);

  const handleSave = () => {
    onSave(config.id, { ...form, padding: Number(form.padding), increment: Number(form.increment) });
  };

  const label = ID_TYPE_LABELS[config?.id_type] || config?.id_type;

  return (
    <Card variant="outlined" sx={{ opacity: form.is_enabled ? 1 : 0.7 }}>
      <CardContent sx={flexColumnSx}>
        {/* Header row */}
        <Box sx={flexBetweenSx}>
          <Typography variant="subtitle1" fontWeight={600}>
            {label} Numbering
          </Typography>
          <FormControlLabel
            control={<Switch checked={form.is_enabled ?? false} onChange={onChange('is_enabled')} />}
            label={form.is_enabled ? 'Enabled' : 'Disabled'}
            labelPlacement="start"
          />
        </Box>

        {form.is_enabled && (
          <>
            <Divider />

            {/* Format fields */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 2 }}>
              <TextField
                label="Prefix"
                size="small"
                value={form.prefix ?? ''}
                onChange={onChange('prefix')}
                inputProps={{ maxLength: 16 }}
              />
              <TextField
                label="Suffix"
                size="small"
                value={form.suffix ?? ''}
                onChange={onChange('suffix')}
                inputProps={{ maxLength: 16 }}
              />
              <TextField
                label="Separator"
                size="small"
                value={form.separator ?? ''}
                onChange={onChange('separator')}
                inputProps={{ maxLength: 4 }}
              />
              <TextField
                label="Padding"
                size="small"
                type="number"
                value={form.padding ?? 4}
                onChange={onChange('padding')}
                inputProps={{ min: 1, max: 10 }}
              />
              <TextField
                label="Increment"
                size="small"
                type="number"
                value={form.increment ?? 1}
                onChange={onChange('increment')}
                inputProps={{ min: 1 }}
              />
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, alignItems: 'center' }}>
              <TextField label="Date Mode" size="small" select value={form.date_mode ?? 'none'} onChange={onChange('date_mode')}>
                {DATE_MODE_OPTS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Reset Mode"
                size="small"
                select
                value={form.reset_mode ?? 'never'}
                onChange={onChange('reset_mode')}
              >
                {RESET_MODE_OPTS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Scope Type"
                size="small"
                select
                value={form.scope_type ?? 'none'}
                onChange={onChange('scope_type')}
              >
                {SCOPE_TYPE_OPTS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </TextField>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <FormControlLabel
                control={<Switch checked={form.uppercase ?? true} onChange={onChange('uppercase')} />}
                label="Uppercase"
              />
            </Box>

            {/* Preview */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Preview:
              </Typography>
              <Typography
                variant="body1"
                fontWeight={600}
                sx={{ fontFamily: 'monospace', bgcolor: 'action.hover', px: 1.5, py: 0.5, borderRadius: 1 }}
              >
                {preview}
              </Typography>
            </Box>

            {/* Save */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <PrimaryButton size="small" disabled={!dirty || saving} onClick={handleSave}>
                {saving ? 'Saving...' : 'Save'}
              </PrimaryButton>
            </Box>
          </>
        )}

        {/* Collapsed preview when disabled */}
        {!form.is_enabled && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Auto-numbering disabled — enable to configure format
            </Typography>
            {dirty && (
              <PrimaryButton size="small" disabled={saving} onClick={handleSave} sx={{ ml: 'auto' }}>
                {saving ? 'Saving...' : 'Save'}
              </PrimaryButton>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Page Component ────────────────────────────────────────────── */

export default function NumberingConfigPage() {
  const { data: res, isLoading } = useNumberingConfig();
  const rows = res?.rows ?? [];
  const updateMut = useUpdateNumberingConfig();

  const { toast, snackProps } = useToast();

  const [savingId, setSavingId] = useState(null);

  const handleSave = async (id, changes) => {
    setSavingId(id);
    try {
      await updateMut.mutateAsync({ filter: { id }, changes });
      toast('Numbering config saved');
    } catch (err) {
      toast(err.payload?.error || err.message || 'Save failed', 'error');
    } finally {
      setSavingId(null);
    }
  };

  /* ── toolbar ────────────────────────────────────────────────── */
  const toolbar = useMemo(() => ({ tabs: [], filters: [], primaryActions: [] }), []);
  useModuleToolbarRegistration(toolbar);

  /* ── Sort cards in a stable order ───────────────────────────── */
  const ORDER = ['employee', 'vendor', 'client', 'contact', 'project', 'ar_invoice', 'ap_invoice'];
  const sorted = useMemo(() => {
    const map = Object.fromEntries(rows.map((r) => [r.id_type, r]));
    return ORDER.map((t) => map[t]).filter(Boolean);
  }, [rows]);

  return (
    <Box sx={{ ...pageContainerSx, overflow: 'auto', p: 2 }}>
      <Typography variant="h6" sx={{ mb: 1 }}>
        Auto-Numbering Configuration
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Configure automatic numbering formats for each entity type. Changes affect future records only.
      </Typography>

      {isLoading ? (
        <Box sx={flexColumnSx}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rounded" height={80} />
          ))}
        </Box>
      ) : (
        <Box sx={flexColumnSx}>
          {sorted.map((cfg) => (
            <NumberingCard key={cfg.id} config={cfg} onSave={handleSave} saving={savingId === cfg.id} />
          ))}
        </Box>
      )}

      <ToastSnackbar {...snackProps} />
    </Box>
  );
}
