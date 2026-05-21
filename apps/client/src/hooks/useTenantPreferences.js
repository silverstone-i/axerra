/**
 * @file React Query hooks for tenant preferences
 * @module client/hooks/useTenantPreferences
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tenantPreferencesApi } from '../services/tenantPreferencesApi.js';
import { useAuth } from '../contexts/AuthContext.jsx';

export const TENANT_PREFS_KEY = ['tenant-preferences'];

/** Fetch tenant preferences (single row). Gated on an authenticated session. */
export function useTenantPreferences() {
  const { user } = useAuth();
  return useQuery({
    queryKey: TENANT_PREFS_KEY,
    queryFn: () => tenantPreferencesApi.list({ limit: 1 }),
    enabled: !!user,
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
