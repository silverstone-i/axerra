/**
 * @file React Query hooks for RBAC Layer 3 state filters
 * @module client/hooks/useStateFilters
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { stateFilterApi } from '../services/stateFilterApi.js';

const STATE_FILTERS_KEY = ['state-filters'];

export function useStateFiltersForRole(roleId) {
  return useQuery({
    queryKey: [...STATE_FILTERS_KEY, roleId],
    queryFn: () => stateFilterApi.listForRole(roleId),
    enabled: !!roleId,
  });
}

export function useSyncStateFilters() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, stateFilters }) => stateFilterApi.syncForRole(roleId, stateFilters),
    onSuccess: (_data, { roleId }) => {
      qc.invalidateQueries({ queryKey: [...STATE_FILTERS_KEY, roleId] });
    },
  });
}
