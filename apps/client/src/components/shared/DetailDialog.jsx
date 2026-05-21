/**
 * @file Shared read-only detail dialog shell
 * @module client/components/shared/DetailDialog
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';

import TertiaryButton from './TertiaryButton.jsx';
import { dialogHeaderSx, dialogActionBoxSx } from '../../config/layoutTokens.js';

export default function DetailDialog({
  open,
  onClose,
  title,
  subtitle,
  maxWidth = 'sm',
  children,
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth={maxWidth} fullWidth>
      <DialogTitle sx={dialogHeaderSx}>
        <Box>
          <span>{title}</span>
          {subtitle && (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
        <Box sx={dialogActionBoxSx}>
          <TertiaryButton size="small" onClick={onClose}>
            Close
          </TertiaryButton>
        </Box>
      </DialogTitle>
      <DialogContent dividers>{children}</DialogContent>
    </Dialog>
  );
}
