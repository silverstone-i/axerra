/**
 * @file Company Info settings page — manage tenant's self-company address and tax identifiers
 * @module client/pages/Settings/CompanyInfoPage
 *
 * Card-based layout following NumberingConfigPage pattern. Displays the tenant's
 * self-company (code === tenant_code) with editable addresses and tax identifiers.
 *
 * Copyright (c) 2025 – present Vimber LLC. All rights reserved.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import Box from '@mui/material/Box';
import PrimaryButton from '../../components/shared/PrimaryButton.jsx';
import SecondaryButton from '../../components/shared/SecondaryButton.jsx';
import TertiaryButton from '../../components/shared/TertiaryButton.jsx';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';

import { useModuleToolbarRegistration } from '../../contexts/ModuleActionsContext.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import {
  useSelfCompany,
  useCreateCompany,
  useAddresses,
  useTaxIdentifiers,
  useCreateAddress,
  useUpdateAddress,
  useArchiveAddress,
  useCreateTaxIdentifier,
  useUpdateTaxIdentifier,
  useArchiveTaxIdentifier,
} from '../../hooks/useCompanyInfo.js';
import ToastSnackbar from '../../components/shared/ToastSnackbar.jsx';
import { pageContainerSx, flexBetweenSx, flexColumnSx } from '../../config/layoutTokens.js';
import { useToast } from '../../hooks/useToast.js';
import { cap, errMsg } from '../../utils/format.js';

/* ── Constants ──────────────────────────────────────────────────── */

const LABEL_OPTS = ['billing', 'shipping', 'mailing', 'registered', 'physical'];
const TAX_TYPE_OPTS = ['EIN', 'VAT', 'GST', 'SSN', 'ITIN', 'TIN', 'ABN'];

const BLANK_ADDRESS = {
  label: 'billing',
  address_line_1: '',
  address_line_2: '',
  address_line_3: '',
  city: '',
  state_province: '',
  postal_code: '',
  country_code: 'US',
};

const BLANK_TAX = { country_code: 'US', tax_type: 'EIN', tax_value: '' };

/* ── SetupCompanyForm (legacy tenants without a self-company) ── */

function SetupCompanyForm({ tenantCode, tenantName, tenantId, onComplete, onError }) {
  const createCompany = useCreateCompany();
  const createAddress = useCreateAddress();
  const createTax = useCreateTaxIdentifier();

  const [name, setName] = useState(tenantName);
  const [addr, setAddr] = useState({ ...BLANK_ADDRESS });
  const [taxRows, setTaxRows] = useState([{ ...BLANK_TAX }]);
  const [saving, setSaving] = useState(false);

  const onAddrChange = (f) => (e) => setAddr((p) => ({ ...p, [f]: e.target.value }));
  const onTaxChange = (idx, f) => (e) =>
    setTaxRows((p) => p.map((r, i) => (i === idx ? { ...r, [f]: e.target.value } : r)));

  const canSubmit = name.trim() && addr.address_line_1.trim() && addr.country_code.trim();

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const company = await createCompany.mutateAsync({
        code: tenantCode,
        name: name.trim(),
        tenant_id: tenantId,
      });
      const sourceId = company.source_id;

      await createAddress.mutateAsync({ ...addr, source_id: sourceId });

      const validTax = taxRows.filter((r) => r.tax_value.trim());
      for (const row of validTax) {
        await createTax.mutateAsync({ ...row, source_id: sourceId });
      }

      onComplete('Company info created');
    } catch (err) {
      onError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ ...pageContainerSx, gap: 3 }}>
      <Box>
        <Typography variant="h6">Set Up Company Info</Typography>
        <Typography variant="body2" color="text.secondary">
          No company record exists yet. Fill in your company details to get started.
        </Typography>
      </Box>

      {/* ── Company Name ───────────────────────────────────────── */}
      <Card variant="outlined">
        <CardContent sx={flexColumnSx}>
          <Typography variant="subtitle2" fontWeight={600}>
            Company
          </Typography>
          <TextField
            label="Company Name"
            size="small"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            sx={{ maxWidth: 400 }}
          />
        </CardContent>
      </Card>

      {/* ── Billing Address ────────────────────────────────────── */}
      <Card variant="outlined">
        <CardContent sx={flexColumnSx}>
          <Typography variant="subtitle2" fontWeight={600}>
            Billing Address
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
            <TextField label="Label" select size="small" value={addr.label} onChange={onAddrChange('label')}>
              {LABEL_OPTS.map((l) => (
                <MenuItem key={l} value={l}>
                  {cap(l)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Country Code"
              size="small"
              value={addr.country_code}
              onChange={onAddrChange('country_code')}
              inputProps={{ maxLength: 2 }}
              helperText="ISO 3166-1 alpha-2"
            />
            <TextField
              label="Address Line 1"
              size="small"
              required
              value={addr.address_line_1}
              onChange={onAddrChange('address_line_1')}
              sx={{ gridColumn: '1 / -1' }}
            />
            <TextField label="Address Line 2" size="small" value={addr.address_line_2} onChange={onAddrChange('address_line_2')} />
            <TextField label="Address Line 3" size="small" value={addr.address_line_3} onChange={onAddrChange('address_line_3')} />
            <TextField label="City" size="small" value={addr.city} onChange={onAddrChange('city')} />
            <TextField label="State / Province" size="small" value={addr.state_province} onChange={onAddrChange('state_province')} />
            <TextField label="Postal Code" size="small" value={addr.postal_code} onChange={onAddrChange('postal_code')} />
          </Box>
        </CardContent>
      </Card>

      {/* ── Tax Identifiers ────────────────────────────────────── */}
      <Card variant="outlined">
        <CardContent sx={flexColumnSx}>
          <Box sx={flexBetweenSx}>
            <Typography variant="subtitle2" fontWeight={600}>
              Tax Identifiers
            </Typography>
            <TertiaryButton size="small" startIcon={<AddIcon />} onClick={() => setTaxRows((p) => [...p, { ...BLANK_TAX }])}>
              Add Row
            </TertiaryButton>
          </Box>

          {taxRows.map((row, idx) => (
            <Box key={idx} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <TextField
                label="Country"
                size="small"
                value={row.country_code}
                onChange={onTaxChange(idx, 'country_code')}
                inputProps={{ maxLength: 2 }}
                sx={{ width: 90 }}
              />
              <TextField label="Type" select size="small" value={row.tax_type} onChange={onTaxChange(idx, 'tax_type')} sx={{ width: 120 }}>
                {TAX_TYPE_OPTS.map((t) => (
                  <MenuItem key={t} value={t}>
                    {t}
                  </MenuItem>
                ))}
              </TextField>
              <TextField label="Value" size="small" value={row.tax_value} onChange={onTaxChange(idx, 'tax_value')} sx={{ flex: 1 }} />
              {taxRows.length > 1 && (
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => setTaxRows((p) => p.filter((_, i) => i !== idx))}
                  sx={{ mt: 0.5 }}
                  aria-label={`Remove ${row.country_code} ${row.tax_type} tax identifier`}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
          ))}

          <Typography variant="caption" color="text.secondary">
            Leave tax value blank to skip. At least one identifier is recommended.
          </Typography>
        </CardContent>
      </Card>

      {/* ── Submit ──────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <PrimaryButton startIcon={<SaveIcon />} disabled={!canSubmit || saving} onClick={handleSubmit}>
          {saving ? 'Saving…' : 'Create Company Info'}
        </PrimaryButton>
      </Box>
    </Box>
  );
}

/* ── AddressCard ──────────────────────────────────────────────── */

function AddressCard({ address, isNew, sourceId, onSaved, onDeleted, onError }) {
  const [form, setForm] = useState({ ...BLANK_ADDRESS });
  const createMut = useCreateAddress();
  const updateMut = useUpdateAddress();
  const archiveMut = useArchiveAddress();

  useEffect(() => {
    if (address) {
      setForm({
        label: address.label ?? 'billing',
        address_line_1: address.address_line_1 ?? '',
        address_line_2: address.address_line_2 ?? '',
        address_line_3: address.address_line_3 ?? '',
        city: address.city ?? '',
        state_province: address.state_province ?? '',
        postal_code: address.postal_code ?? '',
        country_code: address.country_code ?? 'US',
      });
    }
  }, [address]);

  const onChange = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }));

  const dirty = useMemo(() => {
    if (isNew) return !!(form.address_line_1 && form.country_code);
    if (!address) return false;
    return Object.keys(form).some((k) => (form[k] ?? '') !== (address[k] ?? ''));
  }, [form, address, isNew]);

  const saving = createMut.isPending || updateMut.isPending;

  const handleSave = async () => {
    try {
      if (isNew) {
        await createMut.mutateAsync({ ...form, source_id: sourceId });
      } else {
        await updateMut.mutateAsync({ id: address.id, changes: form });
      }
      onSaved();
    } catch (err) {
      onError(err);
    }
  };

  const handleDelete = async () => {
    try {
      await archiveMut.mutateAsync({ id: address.id });
      onDeleted();
    } catch (err) {
      onError(err);
    }
  };

  return (
    <Card variant="outlined">
      <CardContent sx={flexColumnSx}>
        <Box sx={flexBetweenSx}>
          <Typography variant="subtitle2" fontWeight={600}>
            {isNew ? 'New Address' : `${cap(form.label)} Address`}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {!isNew && (
              <IconButton size="small" color="error" onClick={handleDelete} disabled={archiveMut.isPending} aria-label={`Remove ${form.label ? `${form.label} address` : 'address'}`}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            )}
            <PrimaryButton
              size="small"
              startIcon={<SaveIcon />}
              disabled={!dirty || saving}
              onClick={handleSave}
            >
              Save
            </PrimaryButton>
          </Box>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
          <TextField label="Label" select size="small" value={form.label} onChange={onChange('label')}>
            {LABEL_OPTS.map((l) => (
              <MenuItem key={l} value={l}>
                {cap(l)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Country Code"
            size="small"
            value={form.country_code}
            onChange={onChange('country_code')}
            inputProps={{ maxLength: 2 }}
            helperText="ISO 3166-1 alpha-2"
          />
          <TextField
            label="Address Line 1"
            size="small"
            required
            value={form.address_line_1}
            onChange={onChange('address_line_1')}
            sx={{ gridColumn: '1 / -1' }}
          />
          <TextField label="Address Line 2" size="small" value={form.address_line_2} onChange={onChange('address_line_2')} />
          <TextField label="Address Line 3" size="small" value={form.address_line_3} onChange={onChange('address_line_3')} />
          <TextField label="City" size="small" value={form.city} onChange={onChange('city')} />
          <TextField label="State / Province" size="small" value={form.state_province} onChange={onChange('state_province')} />
          <TextField label="Postal Code" size="small" value={form.postal_code} onChange={onChange('postal_code')} />
        </Box>
      </CardContent>
    </Card>
  );
}

/* ── TaxIdentifierRow ────────────────────────────────────────── */

function TaxIdentifierRow({ taxId, isNew, sourceId, onSaved, onDeleted, onError }) {
  const [form, setForm] = useState({ ...BLANK_TAX });
  const createMut = useCreateTaxIdentifier();
  const updateMut = useUpdateTaxIdentifier();
  const archiveMut = useArchiveTaxIdentifier();

  useEffect(() => {
    if (taxId) {
      setForm({
        country_code: taxId.country_code ?? 'US',
        tax_type: taxId.tax_type ?? 'EIN',
        tax_value: taxId.tax_value ?? '',
      });
    }
  }, [taxId]);

  const onChange = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }));

  const dirty = useMemo(() => {
    if (isNew) return !!form.tax_value;
    if (!taxId) return false;
    return Object.keys(form).some((k) => (form[k] ?? '') !== (taxId[k] ?? ''));
  }, [form, taxId, isNew]);

  const saving = createMut.isPending || updateMut.isPending;

  const handleSave = async () => {
    try {
      if (isNew) {
        await createMut.mutateAsync({ ...form, source_id: sourceId });
      } else {
        await updateMut.mutateAsync({ id: taxId.id, changes: form });
      }
      onSaved();
    } catch (err) {
      onError(err);
    }
  };

  const handleDelete = async () => {
    try {
      await archiveMut.mutateAsync({ id: taxId.id });
      onDeleted();
    } catch (err) {
      onError(err);
    }
  };

  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
      <TextField label="Country" size="small" value={form.country_code} onChange={onChange('country_code')} inputProps={{ maxLength: 2 }} sx={{ width: 90 }} />
      <TextField label="Type" select size="small" value={form.tax_type} onChange={onChange('tax_type')} sx={{ width: 120 }}>
        {TAX_TYPE_OPTS.map((t) => (
          <MenuItem key={t} value={t}>
            {t}
          </MenuItem>
        ))}
      </TextField>
      <TextField label="Value" size="small" value={form.tax_value} onChange={onChange('tax_value')} sx={{ flex: 1 }} />
      <SecondaryButton size="small" startIcon={<SaveIcon />} disabled={!dirty || saving} onClick={handleSave} sx={{ mt: 0.5 }}>
        Save
      </SecondaryButton>
      {!isNew && (
        <IconButton size="small" color="error" onClick={handleDelete} disabled={archiveMut.isPending} sx={{ mt: 0.5 }} aria-label={`Remove ${form.country_code} ${form.tax_type} tax identifier`}>
          <DeleteIcon fontSize="small" />
        </IconButton>
      )}
    </Box>
  );
}

/* ── CompanyInfoPage ─────────────────────────────────────────── */

export default function CompanyInfoPage() {
  const { activeTenant } = useAuth();
  const tenantCode = activeTenant?.tenant_code;

  const { data: company, isLoading: companyLoading } = useSelfCompany(tenantCode);
  const sourceId = company?.source_id;
  const { data: addresses = [], isLoading: addrLoading } = useAddresses(sourceId);
  const { data: taxIds = [], isLoading: taxLoading } = useTaxIdentifiers(sourceId);

  const [newAddresses, setNewAddresses] = useState([]);
  const [newTaxIds, setNewTaxIds] = useState([]);

  /* ── snackbar ─────────────────────────────────────────────── */
  const { toast, snackProps } = useToast();
  const errToast = useCallback((err) => toast(errMsg(err), 'error'), [toast]);

  /* ── toolbar (empty — settings pages have no toolbar actions) */
  const toolbar = useMemo(() => ({ tabs: [], filters: [], primaryActions: [] }), []);
  useModuleToolbarRegistration(toolbar);

  const isLoading = companyLoading || addrLoading || taxLoading;

  if (isLoading) {
    return (
      <Box sx={pageContainerSx}>
        <Skeleton variant="rounded" height={40} width={300} />
        <Skeleton variant="rounded" height={200} />
        <Skeleton variant="rounded" height={120} />
      </Box>
    );
  }

  return (
    <>
      {!company ? (
        <SetupCompanyForm
          tenantCode={tenantCode}
          tenantName={activeTenant?.name ?? tenantCode}
          tenantId={activeTenant?.tenant_id}
          onComplete={(msg) => toast(msg)}
          onError={errToast}
        />
      ) : (
        <Box sx={{ ...pageContainerSx, gap: 3 }}>
          <Box>
            <Typography variant="h6">Company Info</Typography>
            <Typography variant="body2" color="text.secondary">
              Manage your company addresses and tax identifiers.
            </Typography>
          </Box>

          {/* ── Company header ───────────────────────────────────── */}
          <Card variant="outlined">
            <CardContent sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Typography variant="subtitle1" fontWeight={600}>
                {company.name}
              </Typography>
              <Typography variant="body2" color="text.secondary" fontFamily="monospace">
                {company.code}
              </Typography>
            </CardContent>
          </Card>

          {/* ── Addresses ────────────────────────────────────────── */}
          <Box sx={flexColumnSx}>
            <Box sx={flexBetweenSx}>
              <Typography variant="overline" color="text.secondary">
                Addresses
              </Typography>
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={() => setNewAddresses((p) => [...p, Date.now()])}
              >
                Add Address
              </Button>
            </Box>

            {addresses.map((addr) => (
              <AddressCard
                key={addr.id}
                address={addr}
                sourceId={sourceId}
                onSaved={() => toast('Address updated')}
                onDeleted={() => toast('Address removed')}
                onError={errToast}
              />
            ))}

            {newAddresses.map((key) => (
              <AddressCard
                key={key}
                isNew
                sourceId={sourceId}
                onSaved={() => {
                  setNewAddresses((p) => p.filter((k) => k !== key));
                  toast('Address created');
                }}
                onDeleted={() => setNewAddresses((p) => p.filter((k) => k !== key))}
                onError={errToast}
              />
            ))}
          </Box>

          <Divider />

          {/* ── Tax Identifiers ──────────────────────────────────── */}
          <Box sx={flexColumnSx}>
            <Box sx={flexBetweenSx}>
              <Typography variant="overline" color="text.secondary">
                Tax Identifiers
              </Typography>
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={() => setNewTaxIds((p) => [...p, Date.now()])}
              >
                Add Tax ID
              </Button>
            </Box>

            {taxIds.map((ti) => (
              <TaxIdentifierRow
                key={ti.id}
                taxId={ti}
                sourceId={sourceId}
                onSaved={() => toast('Tax identifier updated')}
                onDeleted={() => toast('Tax identifier removed')}
                onError={errToast}
              />
            ))}

            {newTaxIds.map((key) => (
              <TaxIdentifierRow
                key={key}
                isNew
                sourceId={sourceId}
                onSaved={() => {
                  setNewTaxIds((p) => p.filter((k) => k !== key));
                  toast('Tax identifier created');
                }}
                onDeleted={() => setNewTaxIds((p) => p.filter((k) => k !== key))}
                onError={errToast}
              />
            ))}

            {taxIds.length === 0 && newTaxIds.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No tax identifiers on file.
              </Typography>
            )}
          </Box>
        </Box>
      )}

      {/* ── Snackbar (always rendered) ───────────────────────── */}
      <ToastSnackbar {...snackProps} />
    </>
  );
}
