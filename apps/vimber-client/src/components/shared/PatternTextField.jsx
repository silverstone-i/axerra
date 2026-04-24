/**
 * @file Pattern-formatted text field — formats display value with a placeholder pattern
 * @module vimber-client/components/shared/PatternTextField
 *
 * Wraps MUI TextField to display a raw value formatted by a pattern (e.g. `XXX-XX-XXXX`)
 * while storing only the stripped raw value. Uses the same pattern string as the
 * input placeholder when one is not explicitly provided.
 *
 * Validates that the raw digit count matches the number of X positions in the pattern
 * and shows an error state when the length is incorrect.
 *
 * Copyright (c) 2025 – present Vimber LLC. All rights reserved.
 */

import { useMemo } from 'react';
import TextField from '@mui/material/TextField';
import { formatByPattern, stripFormatting } from '@vimber/shared';

/**
 * A TextField that formats its display value using a placeholder pattern.
 * @param {object} props
 * @param {string} props.value             Raw (unformatted) value
 * @param {function} props.onChange         Called with the stripped raw value: `(rawValue) => void`
 * @param {string} [props.pattern]         Format pattern where `X` = input character
 * @param {boolean} [props.disableValidation] Skip length validation
 * @param {object} [rest]                  Forwarded to MUI TextField
 */
export default function PatternTextField({ value, onChange, pattern, disableValidation, ...rest }) {
  const expectedLength = useMemo(() => (pattern ? [...pattern].filter((c) => c === 'X').length : 0), [pattern]);
  const rawLength = stripFormatting(value).length;
  const invalid = !disableValidation && pattern && rawLength > 0 && rawLength !== expectedLength;

  return (
    <TextField
      {...rest}
      value={formatByPattern(value, pattern)}
      onChange={(e) => onChange(stripFormatting(e.target.value))}
      placeholder={rest.placeholder ?? pattern}
      error={invalid || rest.error}
      helperText={invalid ? `Expected ${expectedLength} characters` : rest.helperText}
    />
  );
}
