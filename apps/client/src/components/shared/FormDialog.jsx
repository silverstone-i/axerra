/**
 * @file Reusable form dialog wrapper
 * @module client/components/shared/FormDialog
 *
 * Wraps children in a Dialog with a form element, Cancel and Submit buttons.
 * Pages inject TextField / Select controls as children.
 *
 * Copyright (c) 2025 – present Vimber LLC. All rights reserved.
 */

import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';

import { density } from '../../config/tokens.js';
import PrimaryButton from './PrimaryButton.jsx';
import TertiaryButton from './TertiaryButton.jsx';

const contentSx = { display: 'flex', flexDirection: 'column', gap: `${density.fieldGap}px` };

const dialogSx = {
  '& .MuiDialogTitle-root + .MuiDialogContent-root': { paddingTop: '16px' },
};

export default function FormDialog({
  open,
  title,
  maxWidth = 'sm',
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  loading = false,
  submitDisabled = false,
  onSubmit,
  onCancel,
  children,
}) {
  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <Dialog open={open} onClose={onCancel} maxWidth={maxWidth} fullWidth disableRestoreFocus sx={dialogSx}>
      <form onSubmit={handleSubmit}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
          <span>{title}</span>
          <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
            <TertiaryButton size="small" onClick={onCancel} disabled={loading}>
              {cancelLabel}
            </TertiaryButton>
            <PrimaryButton
              size="small"
              type="submit"
              disabled={loading || submitDisabled}
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
            >
              {submitLabel}
            </PrimaryButton>
          </Box>
        </DialogTitle>
        <DialogContent sx={contentSx}>
          {children}
        </DialogContent>
      </form>
    </Dialog>
  );
}
