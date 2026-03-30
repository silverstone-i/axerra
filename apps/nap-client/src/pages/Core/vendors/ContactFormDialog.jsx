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
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';

import FormDialog from '../../../components/shared/FormDialog.jsx';
import { formGridSx, flexBetweenSx } from '../../../config/layoutTokens.js';
import { BLANK_EMAIL, BLANK_PHONE } from '../../../utils/formConstants.js';
import EmailRow from '../../../components/shared/EmailRow.jsx';
import PhoneRow from '../../../components/shared/PhoneRow.jsx';

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

  const updateEmail = (idx, fld, value) =>
    setContactEmails((p) => p.map((x, i) => {
      if (i !== idx) {
        if (fld === 'is_primary' && value) return { ...x, is_primary: false };
        return x;
      }
      return { ...x, [fld]: value };
    }));

  const removeEmail = (idx) =>
    setContactEmails((p) => p.map((x, i) => (i === idx ? { ...x, _deleted: true } : x)));

  /* ── Phone helpers ─────────────────────────────────────────── */

  const addPhone = () =>
    setContactPhones((p) => [...p, { ...BLANK_PHONE, is_primary: !p.filter((ph) => !ph._deleted).length }]);

  const updatePhone = (idx, fld, value) =>
    setContactPhones((p) => p.map((x, i) => {
      if (i !== idx) {
        if (fld === 'is_primary' && value) return { ...x, is_primary: false };
        return x;
      }
      return { ...x, [fld]: value };
    }));

  const removePhone = (idx) =>
    setContactPhones((p) => p.map((x, i) => (i === idx ? { ...x, _deleted: true } : x)));

  /* ── Derived ──────────────────────────────────────────────── */

  const visibleEmails = contactEmails.filter((e) => !e._deleted);
  const visiblePhones = contactPhones.filter((p) => !p._deleted);

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
      <Box sx={flexBetweenSx}>
        <Typography variant="subtitle2">Emails</Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={addEmail}>Add Email</Button>
      </Box>
      {visibleEmails.length === 0 && (
        <Typography variant="body2" color="text.secondary">No emails</Typography>
      )}
      {contactEmails.map((em, idx) =>
        !em._deleted && <EmailRow key={em.id || idx} item={em} index={idx} onUpdate={updateEmail} onRemove={removeEmail} />,
      )}

      {/* ── Phones ─────────────────────────────────────────── */}
      <Divider />
      <Box sx={flexBetweenSx}>
        <Typography variant="subtitle2">Phone Numbers</Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={addPhone}>Add Phone</Button>
      </Box>
      {visiblePhones.length === 0 && (
        <Typography variant="body2" color="text.secondary">No phone numbers</Typography>
      )}
      {contactPhones.map((ph, idx) =>
        !ph._deleted && <PhoneRow key={ph.id || idx} item={ph} index={idx} onUpdate={updatePhone} onRemove={removePhone} />,
      )}
    </FormDialog>
  );
}
