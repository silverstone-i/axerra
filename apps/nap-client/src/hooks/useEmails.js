/**
 * @file React Query hooks for email data
 * @module nap-client/hooks/useEmails
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { emailApi } from '../services/emailApi.js';

const EMAILS_KEY = ['emails'];

export function useEmails(params = { limit: 200, includeDeactivated: 'true' }, options = {}) {
  return useQuery({
    queryKey: [...EMAILS_KEY, params],
    queryFn: () => emailApi.list(params),
    ...options,
  });
}

export function useEmail(id) {
  return useQuery({
    queryKey: [...EMAILS_KEY, id],
    queryFn: () => emailApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => emailApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: EMAILS_KEY }),
  });
}

export function useUpdateEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ filter, changes }) => emailApi.update(filter, changes),
    onSuccess: () => qc.invalidateQueries({ queryKey: EMAILS_KEY }),
  });
}

export function useArchiveEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (filter) => emailApi.archive(filter),
    onSuccess: () => qc.invalidateQueries({ queryKey: EMAILS_KEY }),
  });
}

export function useRestoreEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (filter) => emailApi.restore(filter),
    onSuccess: () => qc.invalidateQueries({ queryKey: EMAILS_KEY }),
  });
}
