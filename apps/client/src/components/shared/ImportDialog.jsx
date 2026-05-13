/**
 * @file Reusable spreadsheet import dialog with optional mandatory preview step
 * @module client/components/shared/ImportDialog
 *
 * Two flows:
 *   - Without `onPreview`: legacy file-picker + Submit. Parent's onSubmit
 *     is invoked with the FormData.
 *   - With `onPreview`: mandatory three-step flow — pick file → preview
 *     (counts or errors) → confirm. onPreview must resolve to the server's
 *     preview payload `{ preview: true, inserts, updates, noops, omitted, errors }`
 *     or throw with `err.payload.errors` if validation failed.
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import { useState, useCallback, useEffect } from 'react';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import FormDialog from './FormDialog.jsx';
import SecondaryButton from './SecondaryButton.jsx';

export default function ImportDialog({
  open,
  title = 'Import Spreadsheet',
  loading,
  errors,
  onPreview,
  onSubmit,
  onCancel,
}) {
  const [file, setFile] = useState(null);
  const [stage, setStage] = useState('pick'); // 'pick' | 'preview' | 'previewing'
  const [previewData, setPreviewData] = useState(null);
  const [previewErrors, setPreviewErrors] = useState(null);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setStage('pick');
      setPreviewData(null);
      setPreviewErrors(null);
    }
  }, [open]);

  const handleFileChange = useCallback((e) => {
    setFile(e.target.files?.[0] || null);
    setStage('pick');
    setPreviewData(null);
    setPreviewErrors(null);
  }, []);

  const buildFormData = useCallback(() => {
    const fd = new FormData();
    fd.append('file', file);
    return fd;
  }, [file]);

  const handlePreview = useCallback(async () => {
    if (!file || !onPreview) return;
    setStage('previewing');
    setPreviewErrors(null);
    try {
      const result = await onPreview(buildFormData());
      setPreviewData(result);
      setPreviewErrors(null);
      setStage('preview');
    } catch (err) {
      const validationErrors = err?.payload?.errors;
      setPreviewData(null);
      setPreviewErrors(validationErrors?.length ? validationErrors : [{ sheet: null, row: null, column: null, value: null, message: err?.message || 'Preview failed' }]);
      setStage('preview');
    }
  }, [file, onPreview, buildFormData]);

  const handleConfirm = useCallback(() => {
    if (!file) return;
    onSubmit(buildFormData());
  }, [file, onSubmit, buildFormData]);

  // Legacy single-step flow when onPreview not supplied
  const handleLegacySubmit = useCallback(() => {
    if (!file) return;
    onSubmit(buildFormData());
  }, [file, onSubmit, buildFormData]);

  const showServerErrors = errors?.length > 0;
  const showPreviewErrors = previewErrors?.length > 0;
  const showPreviewCounts = stage === 'preview' && previewData && !showPreviewErrors;
  const submitLabel = onPreview ? (stage === 'preview' && !showPreviewErrors ? 'Import' : 'Preview') : 'Import';
  const submitHandler = onPreview ? (stage === 'preview' && !showPreviewErrors ? handleConfirm : handlePreview) : handleLegacySubmit;
  const submitDisabled = !file || stage === 'previewing' || (onPreview && showPreviewErrors);

  return (
    <FormDialog
      open={open}
      title={title}
      submitLabel={submitLabel}
      loading={loading || stage === 'previewing'}
      submitDisabled={submitDisabled}
      onSubmit={submitHandler}
      onCancel={onCancel}
    >
      <SecondaryButton component="label" startIcon={<UploadFileIcon />}>
        {file ? file.name : 'Choose .xlsx file'}
        <input type="file" hidden accept=".xlsx,.xls" onChange={handleFileChange} />
      </SecondaryButton>
      {file && (
        <Typography variant="body2" color="text.secondary">
          {(file.size / 1024).toFixed(1)} KB
        </Typography>
      )}

      {showPreviewCounts && (
        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Preview — review before importing:
          </Typography>
          <Stack spacing={0.5}>
            <Typography variant="body2">New rows: <strong>{previewData.inserts}</strong></Typography>
            <Typography variant="body2">Updates in place: <strong>{previewData.updates}</strong></Typography>
            <Typography variant="body2">Unchanged: <strong>{previewData.noops}</strong></Typography>
            <Typography variant="body2">Existing rows not in file (left unchanged): <strong>{previewData.omitted}</strong></Typography>
          </Stack>
        </Alert>
      )}

      {showPreviewErrors && (
        <Alert severity="error" sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Fix {previewErrors.length} issue{previewErrors.length > 1 ? 's' : ''} in the spreadsheet, then re-upload:
          </Typography>
          <TableContainer sx={{ maxHeight: 240 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Sheet</TableCell>
                  <TableCell>Row</TableCell>
                  <TableCell>Column</TableCell>
                  <TableCell>Value</TableCell>
                  <TableCell>Error</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {previewErrors.map((e, i) => (
                  <TableRow key={i}>
                    <TableCell>{e.sheet}</TableCell>
                    <TableCell>{e.row}</TableCell>
                    <TableCell>{e.column}</TableCell>
                    <TableCell sx={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.value}</TableCell>
                    <TableCell>{e.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Alert>
      )}

      {showServerErrors && !showPreviewErrors && (
        <Alert severity="error" sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Please fix {errors.length} error{errors.length > 1 ? 's' : ''} in the spreadsheet:
          </Typography>
          <TableContainer sx={{ maxHeight: 240 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Sheet</TableCell>
                  <TableCell>Row</TableCell>
                  <TableCell>Column</TableCell>
                  <TableCell>Value</TableCell>
                  <TableCell>Error</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {errors.map((e, i) => (
                  <TableRow key={i}>
                    <TableCell>{e.sheet}</TableCell>
                    <TableCell>{e.row}</TableCell>
                    <TableCell>{e.column}</TableCell>
                    <TableCell sx={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.value}</TableCell>
                    <TableCell>{e.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Alert>
      )}
    </FormDialog>
  );
}
