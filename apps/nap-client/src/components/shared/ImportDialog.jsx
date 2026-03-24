/**
 * @file Reusable spreadsheet import dialog — file picker + FormDialog wrapper
 * @module nap-client/components/shared/ImportDialog
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
 */

import { useState, useCallback, useEffect } from 'react';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import FormDialog from './FormDialog.jsx';

export default function ImportDialog({ open, title = 'Import Spreadsheet', loading, errors, onSubmit, onCancel }) {
  const [file, setFile] = useState(null);

  useEffect(() => {
    if (!open) setFile(null);
  }, [open]);

  const handleFileChange = useCallback((e) => {
    setFile(e.target.files?.[0] || null);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    onSubmit(fd);
  }, [file, onSubmit]);

  return (
    <FormDialog
      open={open}
      title={title}
      submitLabel="Import"
      loading={loading}
      submitDisabled={!file}
      onSubmit={handleSubmit}
      onCancel={onCancel}
    >
      <Button component="label" variant="outlined" startIcon={<UploadFileIcon />}>
        {file ? file.name : 'Choose .xlsx file'}
        <input type="file" hidden accept=".xlsx,.xls" onChange={handleFileChange} />
      </Button>
      {file && (
        <Typography variant="body2" color="text.secondary">
          {(file.size / 1024).toFixed(1)} KB
        </Typography>
      )}
      {errors?.length > 0 && (
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
                    <TableCell sx={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.value}</TableCell>
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
