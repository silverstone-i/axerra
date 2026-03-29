/**
 * @file Reusable contact form dialog for creating or editing a vendor contact
 * @module nap-client/pages/Core/vendors/ContactFormDialog
 *
 * Handles contact form fields + inline email/phone sub-collection editing.
 * Extracted from VendorsPage contact create/edit sub-dialogs.
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
 */

import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

import FormDialog from '../../../components/shared/FormDialog.jsx';
import PatternTextField from '../../../components/shared/PatternTextField.jsx';
import { formGridSx } from '../../../config/layoutTokens.js';
import { cap } from '../../../utils/format.js';
import { BLANK_EMAIL, BLANK_PHONE, PHONE_TYPES, EMAIL_LABELS } from '../../../utils/formConstants.js';
import { COUNTRIES } from '@nap/shared';

export default function ContactFormDialog({
  open,
  title,
  onCancel,
  onSubmit,
  loading,
  form,
  setForm,
  field,
  roleOptions,
  contactEmails,
  setContactEmails,
  contactPhones,
  setContactPhones,
  onAppUserToggle,
  children,
}) {
  /* ── Email helpers ─────────────────────────────────────────── */

  const addEmail = () =>
    setContactEmails((p) => [...p, { ...BLANK_EMAIL, is_primary: !p.filter((e) => !e._deleted).length }]);

  const removeEmail = (idx) =>
    setContactEmails((p) => p.map((x, i) => (i === idx ? { ...x, _deleted: true } : x)));

  const updateEmail = (idx, key, value) =>
    setContactEmails((p) => p.map((x, i) => (i === idx ? { ...x, [key]: value } : x)));

  const toggleEmailPrimary = (idx, checked) =>
    setContactEmails((p) =>
      p.map((x, i) => (i === idx ? { ...x, is_primary: checked } : checked ? { ...x, is_primary: false } : x)),
    );

  /* ── Phone helpers ─────────────────────────────────────────── */

  const addPhone = () =>
    setContactPhones((p) => [...p, { ...BLANK_PHONE, is_primary: !p.filter((ph) => !ph._deleted).length }]);

  const removePhone = (idx) =>
    setContactPhones((p) => p.map((x, i) => (i === idx ? { ...x, _deleted: true } : x)));

  const updatePhone = (idx, key, value) =>
    setContactPhones((p) => p.map((x, i) => (i === idx ? { ...x, [key]: value } : x)));

  const togglePhonePrimary = (idx, checked) =>
    setContactPhones((p) =>
      p.map((x, i) => (i === idx ? { ...x, is_primary: checked } : checked ? { ...x, is_primary: false } : x)),
    );

  /* ── Render ────────────────────────────────────────────────── */

  return (
    <FormDialog open={open} title={title} maxWidth="sm" onCancel={onCancel} onSubmit={onSubmit} loading={loading}>
      {/* Contact fields */}
      <Box sx={formGridSx}>
        <TextField label="First Name" required value={form.first_name} onChange={field('first_name')} />
        <TextField label="Last Name" required value={form.last_name} onChange={field('last_name')} />
        <TextField label="Position" value={form.position} onChange={field('position')} />
        <TextField label="Department" value={form.department} onChange={field('department')} />
      </Box>

      <FormControlLabel
        control={<Checkbox checked={form.is_app_user} onChange={onAppUserToggle} size="small" />}
        label="App User (creates login account)"
      />

      {children}

      {form.is_app_user && (
        <Autocomplete
          multiple
          options={roleOptions}
          getOptionLabel={(opt) => opt.name}
          isOptionEqualToValue={(opt, val) => opt.code === val.code}
          value={roleOptions.filter((r) => form.roles.includes(r.code))}
          onChange={(_, v) => setForm((p) => ({ ...p, roles: v.map((r) => r.code) }))}
          renderInput={(params) => <TextField {...params} label="Roles" />}
        />
      )}

      {/* ── Emails ──────────────────────────────────────────── */}
      <Divider />
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="subtitle2">Emails</Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={addEmail}>
          Add Email
        </Button>
      </Box>
      {contactEmails.filter((e) => !e._deleted).length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No emails
        </Typography>
      )}
      {contactEmails.map(
        (em, idx) =>
          !em._deleted && (
            <Box key={em.id || idx} sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              <TextField
                label="Email"
                type="email"
                value={em.email}
                onChange={(e) => updateEmail(idx, 'email', e.target.value)}
                size="small"
                sx={{ flex: 1, minWidth: 200 }}
              />
              <TextField
                select
                label="Label"
                value={em.label}
                onChange={(e) => updateEmail(idx, 'label', e.target.value)}
                size="small"
                sx={{ minWidth: 120 }}
              >
                {EMAIL_LABELS.map((l) => (
                  <MenuItem key={l} value={l}>
                    {cap(l)}
                  </MenuItem>
                ))}
              </TextField>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={em.is_primary}
                    onChange={(e) => toggleEmailPrimary(idx, e.target.checked)}
                    size="small"
                  />
                }
                label="Primary"
                sx={{ mr: 0 }}
              />
              <IconButton size="small" onClick={() => removeEmail(idx)} color="error">
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Box>
          ),
      )}

      {/* ── Phones ─────────────────────────────────────────── */}
      <Divider />
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="subtitle2">Phone Numbers</Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={addPhone}>
          Add Phone
        </Button>
      </Box>
      {contactPhones.filter((p) => !p._deleted).length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No phone numbers
        </Typography>
      )}
      {contactPhones.map(
        (ph, idx) =>
          !ph._deleted && (
            <Box key={ph.id || idx} sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              <TextField
                select
                label="Country"
                value={ph.country_code}
                onChange={(e) => updatePhone(idx, 'country_code', e.target.value)}
                size="small"
                sx={{ minWidth: 80 }}
              >
                {COUNTRIES.map((c) => (
                  <MenuItem key={c.code} value={c.code}>
                    {c.code}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Type"
                value={ph.phone_type}
                onChange={(e) => updatePhone(idx, 'phone_type', e.target.value)}
                size="small"
                sx={{ minWidth: 100 }}
              >
                {PHONE_TYPES.map((t) => (
                  <MenuItem key={t} value={t}>
                    {cap(t)}
                  </MenuItem>
                ))}
              </TextField>
              <PatternTextField
                label="Number"
                value={ph.phone_number}
                onChange={(val) => updatePhone(idx, 'phone_number', val)}
                pattern={COUNTRIES.find((c) => c.code === ph.country_code)?.placeholder}
                size="small"
                sx={{ flex: 1, minWidth: 140 }}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={ph.is_primary}
                    onChange={(e) => togglePhonePrimary(idx, e.target.checked)}
                    size="small"
                  />
                }
                label="Primary"
                sx={{ mr: 0 }}
              />
              <IconButton size="small" onClick={() => removePhone(idx)} color="error">
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Box>
          ),
      )}
    </FormDialog>
  );
}
