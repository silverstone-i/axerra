/**
 * @file React Query hooks for payment terms data
 * @module client/hooks/usePaymentTerms
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { paymentTermApi } from '../services/paymentTermApi.js';

const PAYMENT_TERMS_KEY = ['payment-terms'];

export function usePaymentTerms(params = { limit: 200, includeDeactivated: 'true' }) {
  return useQuery({
    queryKey: [...PAYMENT_TERMS_KEY, params],
    queryFn: () => paymentTermApi.list(params),
  });
}

export function useActivePaymentTerms() {
  return useQuery({
    queryKey: [...PAYMENT_TERMS_KEY, 'active'],
    queryFn: () => paymentTermApi.list({ limit: 200, includeDeactivated: 'false' }),
  });
}

export function useCreatePaymentTerm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => paymentTermApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: PAYMENT_TERMS_KEY }),
  });
}

export function useUpdatePaymentTerm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ filter, changes }) => paymentTermApi.update(filter, changes),
    onSuccess: () => qc.invalidateQueries({ queryKey: PAYMENT_TERMS_KEY }),
  });
}

export function useArchivePaymentTerm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (filter) => paymentTermApi.archive(filter),
    onSuccess: () => qc.invalidateQueries({ queryKey: PAYMENT_TERMS_KEY }),
  });
}

export function useRestorePaymentTerm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (filter) => paymentTermApi.restore(filter),
    onSuccess: () => qc.invalidateQueries({ queryKey: PAYMENT_TERMS_KEY }),
  });
}
