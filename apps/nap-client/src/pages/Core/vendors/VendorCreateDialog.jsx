/**
 * @file Create Vendor dialog — extracted from VendorsPage
 * @module nap-client/pages/Core/vendors/VendorCreateDialog
 *
 * Copyright (c) 2025 – present Vimber LLC. All rights reserved.
 */

import { useState } from 'react';
import Box from '@mui/material/Box';
import PrimaryButton from '../../../components/shared/PrimaryButton.jsx';
import TertiaryButton from '../../../components/shared/TertiaryButton.jsx';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import { flexColumnSx } from '../../../config/layoutTokens.js';
import Typography from '@mui/material/Typography';

const dialogSx = { '& .MuiDialogTitle-root + .MuiDialogContent-root': { paddingTop: '16px' } };

export default function VendorCreateDialog({ open, onClose, createForm, onCreateField, setCreateForm, paymentTermsList, onSubmit, loading }) {
  const [createTab, setCreateTab] = useState(0);

  const handleClose = () => {
    onClose();
    setCreateTab(0);
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth disableRestoreFocus sx={dialogSx}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
          <span>Create Vendor</span>
          <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
            <TertiaryButton size="small" onClick={handleClose} disabled={loading}>
              Cancel
            </TertiaryButton>
            <PrimaryButton
              size="small"
              type="submit"
              disabled={loading}
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
            >
              Create
            </PrimaryButton>
          </Box>
        </DialogTitle>
        <DialogContent sx={flexColumnSx}>
          <Tabs value={createTab} onChange={(_, v) => setCreateTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tab label="Vendor" />
            <Tab label="Contacts" />
          </Tabs>

          {createTab === 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <TextField label="Vendor Name" required value={createForm.name} onChange={onCreateField('name')} />
              <TextField label="Code" value={createForm.code} onChange={onCreateField('code')} inputProps={{ maxLength: 16 }} />
              <TextField
                label="Payment Terms"
                select
                value={createForm.payment_term_id}
                onChange={onCreateField('payment_term_id')}
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {paymentTermsList.map((pt) => (
                  <MenuItem key={pt.id} value={pt.id}>{pt.label}</MenuItem>
                ))}
              </TextField>
              <TextField label="Notes" multiline minRows={2} value={createForm.notes} onChange={onCreateField('notes')} />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={createForm.is_active}
                    onChange={(e) => setCreateForm((p) => ({ ...p, is_active: e.target.checked }))}
                    size="small"
                  />
                }
                label="Active"
              />
            </Box>
          )}

          {createTab === 1 && (
            <Box sx={{ pt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Save the vendor first, then edit it to add contacts.
              </Typography>
            </Box>
          )}
        </DialogContent>
      </form>
    </Dialog>
  );
}
