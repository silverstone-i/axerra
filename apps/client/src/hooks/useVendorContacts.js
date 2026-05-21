/**
 * @file React Query hooks for vendor contact data
 * @module client/hooks/useVendorContacts
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vendorContactApi } from '../services/vendorContactApi.js';

const VENDOR_CONTACTS_KEY = ['vendorContacts'];

export function useVendorContacts(params = { limit: 200, includeDeactivated: 'true' }, options = {}) {
  return useQuery({
    queryKey: [...VENDOR_CONTACTS_KEY, params],
    queryFn: () => vendorContactApi.list(params),
    ...options,
  });
}

export function useVendorContact(id) {
  return useQuery({
    queryKey: [...VENDOR_CONTACTS_KEY, id],
    queryFn: () => vendorContactApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateVendorContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => vendorContactApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: VENDOR_CONTACTS_KEY }),
  });
}

export function useUpdateVendorContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ filter, changes }) => vendorContactApi.update(filter, changes),
    onSuccess: () => qc.invalidateQueries({ queryKey: VENDOR_CONTACTS_KEY }),
  });
}

export function useArchiveVendorContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (filter) => vendorContactApi.archive(filter),
    onSuccess: () => qc.invalidateQueries({ queryKey: VENDOR_CONTACTS_KEY }),
  });
}

export function useRestoreVendorContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (filter) => vendorContactApi.restore(filter),
    onSuccess: () => qc.invalidateQueries({ queryKey: VENDOR_CONTACTS_KEY }),
  });
}

export function useResetVendorContactPassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, password }) => vendorContactApi.resetPassword(id, password),
    onSuccess: () => qc.invalidateQueries({ queryKey: VENDOR_CONTACTS_KEY }),
  });
}

export function useSwapVendorContactLoginEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, new_email, password }) => vendorContactApi.swapLoginEmail(id, { new_email, password }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: VENDOR_CONTACTS_KEY });
      qc.invalidateQueries({ queryKey: ['emails'] });
      qc.invalidateQueries({ queryKey: ['portal-users'] });
    },
  });
}
