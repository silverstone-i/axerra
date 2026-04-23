/**
 * @file Toast notification snackbar — thin wrapper around MUI Snackbar + Alert
 * @module nap-client/components/shared/ToastSnackbar
 *
 * Consumes `snackProps` from the useToast hook.
 *
 * Copyright (c) 2025 – present Vimber LLC. All rights reserved.
 */

import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';

const anchor = { vertical: 'bottom', horizontal: 'center' };

export default function ToastSnackbar({ open, msg, sev, onClose }) {
  return (
    <Snackbar open={open} autoHideDuration={4000} onClose={onClose} anchorOrigin={anchor}>
      <Alert severity={sev} variant="filled" onClose={onClose}>{msg}</Alert>
    </Snackbar>
  );
}
