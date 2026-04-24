/**
 * @file React Query hooks for tenant preferences
 * @module client/hooks/useTenantPreferences
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tenantPreferencesApi } from '../services/tenantPreferencesApi.js';

export const TENANT_PREFS_KEY = ['tenant-preferences'];

/** Fetch tenant preferences (single row). */
export function useTenantPreferences() {
  return useQuery({
    queryKey: TENANT_PREFS_KEY,
    queryFn: () => tenantPreferencesApi.list({ limit: 1 }),
  });
}

/** Update tenant preferences. Expects { filter: {id}, changes: {...} }. */
export function useUpdateTenantPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ filter, changes }) => tenantPreferencesApi.update(filter, changes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TENANT_PREFS_KEY });
    },
  });
}
