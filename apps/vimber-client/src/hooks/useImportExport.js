/**
 * @file Reusable TanStack Query hooks for spreadsheet import/export
 * @module vimber-client/hooks/useImportExport
 *
 * Copyright (c) 2025 – present Vimber LLC. All rights reserved.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * Mutation hook for importing a spreadsheet via multipart upload.
 * Invalidates the entity query cache on success.
 *
 * @param {Function}  importFn       API method that accepts FormData (e.g. vendorApi.importXls)
 * @param {Array}     queryKey       React Query key to invalidate on success (e.g. ['vendors'])
 * @param {Array[]}   [extraKeys=[]] Additional query keys to invalidate (e.g. [['portal-users']])
 */
export function useImportXls(importFn, queryKey, extraKeys = []) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formData) => importFn(formData),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      for (const key of extraKeys) qc.invalidateQueries({ queryKey: key });
    },
  });
}

/**
 * Mutation hook for exporting a spreadsheet. Receives a Blob from the API
 * and triggers a browser download.
 *
 * @param {Function} exportFn    API method that returns a Blob (e.g. vendorApi.exportXls)
 * @param {string}   filePrefix  Filename prefix for the download (e.g. 'vendors')
 */
export function useExportXls(exportFn, filePrefix) {
  return useMutation({
    mutationFn: async (body = {}) => {
      const blob = await exportFn(body);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filePrefix}_${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
  });
}
