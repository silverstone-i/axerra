/**
 * @file Toast notification hook — encapsulates snackbar state
 * @module vimber-client/hooks/useToast
 *
 * Replaces the per-page useState + useCallback boilerplate for
 * Snackbar/Alert feedback. Returns a stable `toast` function and
 * props ready to spread onto `<ToastSnackbar>`.
 *
 * Copyright (c) 2025 – present Vimber LLC. All rights reserved.
 */

import { useState, useCallback } from 'react';

/**
 * @returns {{ toast: (msg: string, sev?: string) => void, snackProps: object }}
 */
export function useToast() {
  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' });

  const toast = useCallback((msg, sev = 'success') => setSnack({ open: true, msg, sev }), []);
  const onClose = useCallback(() => setSnack((s) => ({ ...s, open: false })), []);

  return { toast, snackProps: { open: snack.open, msg: snack.msg, sev: snack.sev, onClose } };
}
