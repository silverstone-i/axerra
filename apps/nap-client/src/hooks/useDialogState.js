/**
 * @file Dialog state hook — encapsulates open/close + associated data
 * @module nap-client/hooks/useDialogState
 *
 * Replaces the per-dialog `const [open, setOpen] = useState(false)` +
 * `const [row, setRow] = useState(null)` pairs.
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
 */

import { useState, useCallback } from 'react';

/**
 * @returns {{
 *   isOpen: boolean,
 *   data: any,
 *   open: (data?: any) => void,
 *   close: () => void,
 * }}
 */
export function useDialogState() {
  const [state, setState] = useState({ isOpen: false, data: null });

  const open = useCallback((data = null) => setState({ isOpen: true, data }), []);
  const close = useCallback(() => setState({ isOpen: false, data: null }), []);

  return { isOpen: state.isOpen, data: state.data, open, close };
}
