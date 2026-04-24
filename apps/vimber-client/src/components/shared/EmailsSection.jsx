/**
 * @file Emails read-only View section for detail dialogs
 * @module vimber-client/components/shared/EmailsSection
 *
 * Renders a list of email addresses. Pass `showLogin` for employee pages
 * that display the is_login flag.
 *
 * Copyright (c) 2025 – present Vimber LLC. All rights reserved.
 */

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';

import FieldRow from './FieldRow.jsx';
import { detailGridSx } from '../../config/layoutTokens.js';
import { cap } from '../../utils/format.js';

export default function EmailsSection({ emails, showLogin = false }) {
  if (!emails?.length) return null;
  return (
    <>
      <Divider />
      <Typography variant="subtitle2" color="text.secondary">Emails</Typography>
      {emails.map((em) => (
        <Box key={em.id} sx={detailGridSx}>
          <FieldRow label="Email" value={em.email} />
          <FieldRow label="Label" value={cap(em.label) || '\u2014'} />
          <FieldRow label="Primary" value={em.is_primary ? 'Yes' : 'No'} />
          {showLogin && em.is_login && <FieldRow label="Login" value="Yes" />}
        </Box>
      ))}
    </>
  );
}
