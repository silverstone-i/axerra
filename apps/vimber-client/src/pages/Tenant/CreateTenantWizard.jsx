/**
 * @file Multi-step wizard for creating a tenant with company, address, tax IDs, and admin user
 * @module vimber-client/pages/Tenant/CreateTenantWizard
 *
 * Three-step stepper dialog:
 *   1. Tenant Details (code, company, status, tier, region, max_users, notes)
 *   2. Billing Address & Tax Identifiers
 *   3. Admin User (first/last name, email, password)
 *
 * Copyright (c) 2025 – present Vimber LLC. All rights reserved.
 */

import { useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import TertiaryButton from '../../components/shared/TertiaryButton.jsx';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import PatternTextField from '../../components/shared/PatternTextField.jsx';
import { TAX_TYPES } from '@vimber/shared';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';

import StepperFormDialog from '../../components/shared/StepperFormDialog.jsx';
import PasswordField from '../../components/shared/PasswordField.jsx';
import { useCreateTenant } from '../../hooks/useTenants.js';
import { cap } from '../../utils/format.js';
import { flexBetweenSx } from '../../config/layoutTokens.js';

/* ── Constants ──────────────────────────────────────────────────── */

const STEPS = [{ label: 'Tenant Details' }, { label: 'Address & Tax' }, { label: 'Admin User' }];

const STATUS_OPTS = ['active', 'trial', 'suspended', 'pending'];
const TIER_OPTS = ['starter', 'growth', 'enterprise'];
const TAX_TYPE_OPTS = ['EIN', 'VAT', 'GST', 'SSN', 'ITIN', 'TIN', 'ABN'];

const BLANK_ADDRESS = {
  address_line_1: '',
  address_line_2: '',
  address_line_3: '',
  city: '',
  state_province: '',
  postal_code: '',
  country_code: 'US',
};

const BLANK_TAX = { country_code: 'US', tax_type: 'EIN', tax_value: '' };

const BLANK_FORM = {
  tenant_code: '',
  company: '',
  status: 'active',
  tier: 'starter',
  region: '',
  max_users: 5,
  notes: '',
  billing_address: { ...BLANK_ADDRESS },
  tax_identifiers: [],
  admin_first_name: '',
  admin_last_name: '',
  admin_email: '',
  admin_password: '',
};

/* ── Component ──────────────────────────────────────────────────── */

export default function CreateTenantWizard({ open, onClose, onSuccess }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(BLANK_FORM);
  const createMut = useCreateTenant();

  const reset = useCallback(() => {
    setStep(0);
    setForm(BLANK_FORM);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  /* ── field helpers ──────────────────────────────────────────── */
  const onField = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }));

  const onAddressField = (f) => (e) =>
    setForm((p) => ({ ...p, billing_address: { ...p.billing_address, [f]: e.target.value } }));

  const addTaxRow = () =>
    setForm((p) => ({ ...p, tax_identifiers: [...p.tax_identifiers, { ...BLANK_TAX }] }));

  const removeTaxRow = (idx) =>
    setForm((p) => ({ ...p, tax_identifiers: p.tax_identifiers.filter((_, i) => i !== idx) }));

  const onTaxField = (idx, f) => (e) =>
    setForm((p) => ({
      ...p,
      tax_identifiers: p.tax_identifiers.map((row, i) => (i === idx ? { ...row, [f]: e.target.value } : row)),
    }));

  /* ── step validation ────────────────────────────────────────── */
  const stepValid = () => {
    if (step === 0) return !!(form.tenant_code && form.company);
    if (step === 1) return !!(form.billing_address.address_line_1 && form.billing_address.country_code);
    if (step === 2) return !!(form.admin_first_name && form.admin_last_name && form.admin_email && form.admin_password);
    return false;
  };

  /* ── submit ─────────────────────────────────────────────────── */
  const handleSubmit = async () => {
    try {
      const payload = {
        ...form,
        tenant_code: form.tenant_code.toUpperCase(),
        max_users: Number(form.max_users) || 5,
      };
      await createMut.mutateAsync(payload);
      onSuccess?.('Tenant created');
      handleClose();
    } catch (err) {
      onSuccess?.(err.payload?.error || err.payload?.message || err.message, 'error');
    }
  };

  /* ── render ─────────────────────────────────────────────────── */
  return (
    <StepperFormDialog
      open={open}
      title="Create Tenant"
      maxWidth="sm"
      steps={STEPS}
      activeStep={step}
      onNext={() => setStep((s) => s + 1)}
      onBack={() => setStep((s) => s - 1)}
      nextDisabled={!stepValid()}
      submitLabel="Create"
      loading={createMut.isPending}
      onSubmit={handleSubmit}
      onCancel={handleClose}
    >
      {/* ── Step 1: Tenant Details ────────────────────────────── */}
      {step === 0 && (
        <>
          <TextField
            label="Tenant Code"
            required
            value={form.tenant_code}
            onChange={(e) => setForm((p) => ({ ...p, tenant_code: e.target.value.toUpperCase() }))}
            inputProps={{ maxLength: 6 }}
            helperText="Max 6 characters, auto-uppercased"
          />
          <TextField label="Company Name" required value={form.company} onChange={onField('company')} />
          <TextField label="Status" select value={form.status} onChange={onField('status')}>
            {STATUS_OPTS.map((s) => (
              <MenuItem key={s} value={s}>
                {cap(s)}
              </MenuItem>
            ))}
          </TextField>
          <TextField label="Tier" select value={form.tier} onChange={onField('tier')}>
            {TIER_OPTS.map((t) => (
              <MenuItem key={t} value={t}>
                {cap(t)}
              </MenuItem>
            ))}
          </TextField>
          <TextField label="Region" value={form.region} onChange={onField('region')} />
          <TextField label="Max Users" type="number" value={form.max_users} onChange={onField('max_users')} />
          <TextField label="Notes" multiline minRows={2} value={form.notes} onChange={onField('notes')} />
        </>
      )}

      {/* ── Step 2: Address & Tax ─────────────────────────────── */}
      {step === 1 && (
        <>
          <Typography variant="overline" color="text.secondary">
            Billing Address
          </Typography>
          <TextField
            label="Address Line 1"
            required
            value={form.billing_address.address_line_1}
            onChange={onAddressField('address_line_1')}
          />
          <TextField
            label="Address Line 2"
            value={form.billing_address.address_line_2}
            onChange={onAddressField('address_line_2')}
          />
          <TextField
            label="Address Line 3"
            value={form.billing_address.address_line_3}
            onChange={onAddressField('address_line_3')}
          />
          <TextField label="City" value={form.billing_address.city} onChange={onAddressField('city')} />
          <TextField
            label="State / Province"
            value={form.billing_address.state_province}
            onChange={onAddressField('state_province')}
          />
          <TextField
            label="Postal Code"
            value={form.billing_address.postal_code}
            onChange={onAddressField('postal_code')}
          />
          <TextField
            label="Country Code"
            required
            value={form.billing_address.country_code}
            onChange={onAddressField('country_code')}
            inputProps={{ maxLength: 2 }}
            helperText="ISO 3166-1 alpha-2 (e.g. US, GB, JP)"
          />

          <Divider sx={{ mt: 1 }} />
          <Box sx={flexBetweenSx}>
            <Typography variant="overline" color="text.secondary">
              Tax Identifiers (optional)
            </Typography>
            <TertiaryButton size="small" startIcon={<AddIcon />} onClick={addTaxRow}>
              Add
            </TertiaryButton>
          </Box>
          {form.tax_identifiers.map((row, idx) => (
            <Box key={idx} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <TextField
                label="Country"
                value={row.country_code}
                onChange={onTaxField(idx, 'country_code')}
                inputProps={{ maxLength: 2 }}
                sx={{ width: 90 }}
              />
              <TextField label="Type" select value={row.tax_type} onChange={onTaxField(idx, 'tax_type')} sx={{ width: 120 }}>
                {TAX_TYPE_OPTS.map((t) => (
                  <MenuItem key={t} value={t}>
                    {t}
                  </MenuItem>
                ))}
              </TextField>
              <PatternTextField
                label="Value"
                value={row.tax_value}
                onChange={(raw) => setForm((p) => ({
                  ...p,
                  tax_identifiers: p.tax_identifiers.map((r, i) => (i === idx ? { ...r, tax_value: raw } : r)),
                }))}
                pattern={(TAX_TYPES[row.country_code] || []).find((t) => t.code === row.tax_type)?.placeholder}
                sx={{ flex: 1 }}
              />
              <IconButton size="small" onClick={() => removeTaxRow(idx)} sx={{ mt: 1 }}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
        </>
      )}

      {/* ── Step 3: Admin User ────────────────────────────────── */}
      {step === 2 && (
        <>
          <Typography variant="overline" color="text.secondary">
            Initial Admin User
          </Typography>
          <TextField label="First Name" required value={form.admin_first_name} onChange={onField('admin_first_name')} />
          <TextField label="Last Name" required value={form.admin_last_name} onChange={onField('admin_last_name')} />
          <TextField label="Admin Email" type="email" required value={form.admin_email} onChange={onField('admin_email')} />
          <PasswordField label="Admin Password" required value={form.admin_password} onChange={onField('admin_password')} />
        </>
      )}
    </StepperFormDialog>
  );
}
