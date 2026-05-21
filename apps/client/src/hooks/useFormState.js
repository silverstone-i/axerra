/**
 * @file Form state hook — encapsulates form object + field handler factory
 * @module client/hooks/useFormState
 *
 * Replaces the per-page `const [form, setForm] = useState(BLANK)` +
 * `const onField = (f) => (e) => setForm(...)` boilerplate.
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { useState, useCallback } from 'react';

/**
 * @param {object} blank Default blank form shape
 * @returns {{
 *   form: object,
 *   setForm: Function,
 *   field: (name: string) => (e: Event) => void,
 *   reset: (values?: object) => void,
 * }}
 */
export function useFormState(blank) {
  const [form, setForm] = useState(blank);

  /** onChange handler for text inputs: `onChange={field('name')}` */
  const field = useCallback(
    (name) => (e) => setForm((prev) => ({ ...prev, [name]: e.target.value })),
    [],
  );

  /** Reset to blank or to provided values (for populating an edit form). */
  const reset = useCallback((values) => setForm(values ?? blank), [blank]);

  return { form, setForm, field, reset };
}
