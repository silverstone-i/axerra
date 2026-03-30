/**
 * @file Shared read-only detail dialog shell
 * @module nap-client/components/shared/DetailDialog
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
 */

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';

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
          <Button size="small" color="inherit" onClick={onClose}>
            Close
          </Button>
        </Box>
      </DialogTitle>
      <DialogContent dividers>{children}</DialogContent>
    </Dialog>
  );
}
