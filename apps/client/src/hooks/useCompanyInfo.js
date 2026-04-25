/**
 * @file React Query hooks for the tenant's self-company, addresses, and tax identifiers
 * @module client/hooks/useCompanyInfo
 *
 * Used by Settings → Company Info page. Fetches the company whose code matches
 * the tenant_code, then loads addresses and tax identifiers via source_id.
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { companyApi } from '../services/companyApi.js';
import { addressApi } from '../services/addressApi.js';
import { taxIdentifierApi } from '../services/taxIdentifierApi.js';

const COMPANY_INFO_KEY = ['company-info'];

/** Create a new company (auto-creates sources record on backend). */
export function useCreateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => companyApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: COMPANY_INFO_KEY }),
  });
}

/** Fetch the tenant's self-company by tenant_code. */
export function useSelfCompany(tenantCode) {
  return useQuery({
    queryKey: [...COMPANY_INFO_KEY, 'company', tenantCode],
    queryFn: async () => {
      const res = await companyApi.list({ code: tenantCode });
      const rows = res?.rows ?? res ?? [];
      return Array.isArray(rows) ? rows[0] || null : null;
    },
    enabled: !!tenantCode,
  });
}

/** Fetch addresses for a given source_id (Settings → Company Info scope). */
export function useCompanyInfoAddresses(sourceId) {
  return useQuery({
    queryKey: [...COMPANY_INFO_KEY, 'addresses', sourceId],
    queryFn: () => addressApi.list({ source_id: sourceId }),
    enabled: !!sourceId,
    select: (res) => {
      const rows = res?.rows ?? res ?? [];
      return Array.isArray(rows) ? rows : [];
    },
  });
}

/** Fetch tax identifiers for a given source_id (Settings → Company Info scope). */
export function useCompanyInfoTaxIdentifiers(sourceId) {
  return useQuery({
    queryKey: [...COMPANY_INFO_KEY, 'tax-identifiers', sourceId],
    queryFn: () => taxIdentifierApi.list({ source_id: sourceId }),
    enabled: !!sourceId,
    select: (res) => {
      const rows = res?.rows ?? res ?? [];
      return Array.isArray(rows) ? rows : [];
    },
  });
}

/** Create a new address. */
export function useCreateAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => addressApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: COMPANY_INFO_KEY }),
  });
}

/** Update an address by id. */
export function useUpdateAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, changes }) => addressApi.update({ id }, changes),
    onSuccess: () => qc.invalidateQueries({ queryKey: COMPANY_INFO_KEY }),
  });
}

/** Archive (soft-delete) an address. */
export function useArchiveAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }) => addressApi.archive({ id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: COMPANY_INFO_KEY }),
  });
}

/** Create a new tax identifier. */
export function useCreateTaxIdentifier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => taxIdentifierApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: COMPANY_INFO_KEY }),
  });
}

/** Update a tax identifier by id. */
export function useUpdateTaxIdentifier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, changes }) => taxIdentifierApi.update({ id }, changes),
    onSuccess: () => qc.invalidateQueries({ queryKey: COMPANY_INFO_KEY }),
  });
}

/** Archive (soft-delete) a tax identifier. */
export function useArchiveTaxIdentifier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }) => taxIdentifierApi.archive({ id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: COMPANY_INFO_KEY }),
  });
}
