/**
 * @file React Query hooks for company data
 * @module vimber-client/hooks/useCompanies
 *
 * Copyright (c) 2025 – present Vimber LLC. All rights reserved.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { companyApi } from '../services/companyApi.js';

const CO_KEY = ['companies'];

export function useCompanies(params = { limit: 200, includeDeactivated: 'true' }) {
  return useQuery({
    queryKey: [...CO_KEY, params],
    queryFn: () => companyApi.list(params),
  });
}

export function useCompany(id) {
  return useQuery({
    queryKey: [...CO_KEY, id],
    queryFn: () => companyApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => companyApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: CO_KEY }),
  });
}

export function useUpdateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ filter, changes }) => companyApi.update(filter, changes),
    onSuccess: () => qc.invalidateQueries({ queryKey: CO_KEY }),
  });
}

export function useArchiveCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (filter) => companyApi.archive(filter),
    onSuccess: () => qc.invalidateQueries({ queryKey: CO_KEY }),
  });
}

export function useRestoreCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (filter) => companyApi.restore(filter),
    onSuccess: () => qc.invalidateQueries({ queryKey: CO_KEY }),
  });
}
