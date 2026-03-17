/**
 * @file Reusable multi-step form dialog with MUI Stepper
 * @module nap-client/components/shared/StepperFormDialog
 *
 * Extends the FormDialog pattern with step navigation.
 * Pages inject step content as children and control navigation externally.
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
 */

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Stepper from '@mui/material/Stepper';

import { density } from '../../config/tokens.js';

const contentSx = { display: 'flex', flexDirection: 'column', gap: `${density.fieldGap}px` };

const dialogSx = {
  '& .MuiDialogTitle-root + .MuiDialogContent-root': { paddingTop: '16px' },
};

export default function StepperFormDialog({
  open,
  title,
  maxWidth = 'sm',
  steps,
  activeStep,
  onNext,
  onBack,
  nextDisabled = false,
  submitLabel = 'Create',
  cancelLabel = 'Cancel',
  loading = false,
  onSubmit,
  onCancel,
  children,
}) {
  const isLastStep = activeStep === steps.length - 1;
  const isFirstStep = activeStep === 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isLastStep) {
      onSubmit();
    } else {
      onNext();
    }
  };

  return (
    <Dialog open={open} onClose={onCancel} maxWidth={maxWidth} fullWidth disableRestoreFocus sx={dialogSx}>
      <form onSubmit={handleSubmit}>
        <DialogTitle sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <span>{title}</span>
            <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
              <Button size="small" onClick={onCancel} disabled={loading}>
                {cancelLabel}
              </Button>
              {!isFirstStep && (
                <Button size="small" onClick={onBack} disabled={loading}>
                  Back
                </Button>
              )}
              <Button
                size="small"
                type="submit"
                variant="contained"
                disabled={loading || nextDisabled}
                startIcon={loading && isLastStep ? <CircularProgress size={16} color="inherit" /> : null}
              >
                {isLastStep ? submitLabel : 'Next'}
              </Button>
            </Box>
          </Box>
          <Stepper activeStep={activeStep} alternativeLabel>
            {steps.map((step) => (
              <Step key={step.label}>
                <StepLabel>{step.label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </DialogTitle>
        <DialogContent sx={contentSx}>{children}</DialogContent>
      </form>
    </Dialog>
  );
}
