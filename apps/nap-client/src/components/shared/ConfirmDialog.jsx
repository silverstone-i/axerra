/**
 * @file Reusable confirmation dialog
 * @module nap-client/components/shared/ConfirmDialog
 *
 * Generic yes / no dialog for destructive or significant actions.
 *
 * Copyright (c) 2025 – present Vimber LLC. All rights reserved.
 */

import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';

import PrimaryButton from './PrimaryButton.jsx';
import TertiaryButton from './TertiaryButton.jsx';

// confirmColor is accepted for API compatibility but intentionally not applied:
// BRAND.md §"Destructive actions" reserves red for STATUS, not for ACTIONS.
// All confirm buttons render as navy primary; the label conveys destructive intent.
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmColor: _confirmColor,
  loading = false,
  onConfirm,
  onCancel,
}) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth disableRestoreFocus>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
        <span>{title}</span>
        <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
          <TertiaryButton size="small" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </TertiaryButton>
          <PrimaryButton
            size="small"
            onClick={onConfirm}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {confirmLabel}
          </PrimaryButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        {typeof message === 'string' ? (
          <Typography variant="body2" color="text.secondary">
            {message}
          </Typography>
        ) : (
          message
        )}
      </DialogContent>
    </Dialog>
  );
}
