/**
 * @file React Query hooks for Accounting module (COA, journal entries, ledger, posting,
 *       category-account map, company accounts/transactions, internal transfers)
 * @module client/hooks/useAccounting
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  chartOfAccountsApi,
  journalEntryApi,
  journalEntryLineApi,
  ledgerBalanceApi,
  postingQueueApi,
  categoryAccountMapApi,
  companyAccountApi,
  companyTransactionApi,
  internalTransferApi,
} from '../services/accountingApi.js';

/* ---- Chart of Accounts ---- */
const COA_KEY = ['chartOfAccounts'];

export function useChartOfAccounts(params = { limit: 200, includeDeactivated: 'true' }) {
  return useQuery({ queryKey: [...COA_KEY, params], queryFn: () => chartOfAccountsApi.list(params) });
}

export function useAccount(id) {
  return useQuery({ queryKey: [...COA_KEY, id], queryFn: () => chartOfAccountsApi.getById(id), enabled: !!id });
}

export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body) => chartOfAccountsApi.create(body), onSuccess: () => qc.invalidateQueries({ queryKey: COA_KEY }) });
}

export function useUpdateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ filter, changes }) => chartOfAccountsApi.update(filter, changes),
    onSuccess: () => qc.invalidateQueries({ queryKey: COA_KEY }),
  });
}

export function useArchiveAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (filter) => chartOfAccountsApi.archive(filter),
    onSuccess: () => qc.invalidateQueries({ queryKey: COA_KEY }),
  });
}

export function useRestoreAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (filter) => chartOfAccountsApi.restore(filter),
    onSuccess: () => qc.invalidateQueries({ queryKey: COA_KEY }),
  });
}

/* ---- Journal Entries ---- */
const JE_KEY = ['journalEntries'];

export function useJournalEntries(params = { limit: 200, includeDeactivated: 'true' }) {
  return useQuery({ queryKey: [...JE_KEY, params], queryFn: () => journalEntryApi.list(params) });
}

export function useJournalEntry(id) {
  return useQuery({ queryKey: [...JE_KEY, id], queryFn: () => journalEntryApi.getById(id), enabled: !!id });
}

export function useCreateJournalEntry() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body) => journalEntryApi.create(body), onSuccess: () => qc.invalidateQueries({ queryKey: JE_KEY }) });
}

export function useUpdateJournalEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ filter, changes }) => journalEntryApi.update(filter, changes),
    onSuccess: () => qc.invalidateQueries({ queryKey: JE_KEY }),
  });
}

export function useArchiveJournalEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (filter) => journalEntryApi.archive(filter),
    onSuccess: () => qc.invalidateQueries({ queryKey: JE_KEY }),
  });
}

export function useRestoreJournalEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (filter) => journalEntryApi.restore(filter),
    onSuccess: () => qc.invalidateQueries({ queryKey: JE_KEY }),
  });
}

export function usePostJournalEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => journalEntryApi.post(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: JE_KEY });
      qc.invalidateQueries({ queryKey: LB_KEY });
      qc.invalidateQueries({ queryKey: PQ_KEY });
    },
  });
}

export function useReverseJournalEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => journalEntryApi.reverse(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: JE_KEY });
      qc.invalidateQueries({ queryKey: LB_KEY });
    },
  });
}

/* ---- Journal Entry Lines ---- */
const JEL_KEY = ['journalEntryLines'];

export function useJournalEntryLines(params = { limit: 200, includeDeactivated: 'true' }) {
  return useQuery({ queryKey: [...JEL_KEY, params], queryFn: () => journalEntryLineApi.list(params) });
}

export function useCreateJournalEntryLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => journalEntryLineApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: JEL_KEY }),
  });
}

export function useUpdateJournalEntryLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ filter, changes }) => journalEntryLineApi.update(filter, changes),
    onSuccess: () => qc.invalidateQueries({ queryKey: JEL_KEY }),
  });
}

export function useArchiveJournalEntryLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (filter) => journalEntryLineApi.archive(filter),
    onSuccess: () => qc.invalidateQueries({ queryKey: JEL_KEY }),
  });
}

export function useRestoreJournalEntryLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (filter) => journalEntryLineApi.restore(filter),
    onSuccess: () => qc.invalidateQueries({ queryKey: JEL_KEY }),
  });
}

/* ---- Ledger Balances (read-only) ---- */
const LB_KEY = ['ledgerBalances'];

export function useLedgerBalances(params = { limit: 200 }) {
  return useQuery({ queryKey: [...LB_KEY, params], queryFn: () => ledgerBalanceApi.list(params) });
}

export function useLedgerBalance(id) {
  return useQuery({ queryKey: [...LB_KEY, id], queryFn: () => ledgerBalanceApi.getById(id), enabled: !!id });
}

/* ---- Posting Queues (read + retry) ---- */
const PQ_KEY = ['postingQueues'];

export function usePostingQueues(params = { limit: 200 }) {
  return useQuery({ queryKey: [...PQ_KEY, params], queryFn: () => postingQueueApi.list(params) });
}

export function useRetryPostingQueue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => postingQueueApi.retry(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PQ_KEY });
      qc.invalidateQueries({ queryKey: JE_KEY });
      qc.invalidateQueries({ queryKey: LB_KEY });
    },
  });
}

/* ---- Category Account Map ---- */
const CAM_KEY = ['categoryAccountMap'];

export function useCategoryAccountMap(params = { limit: 200, includeDeactivated: 'true' }) {
  return useQuery({ queryKey: [...CAM_KEY, params], queryFn: () => categoryAccountMapApi.list(params) });
}

export function useCreateCategoryAccountMap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => categoryAccountMapApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: CAM_KEY }),
  });
}

export function useUpdateCategoryAccountMap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ filter, changes }) => categoryAccountMapApi.update(filter, changes),
    onSuccess: () => qc.invalidateQueries({ queryKey: CAM_KEY }),
  });
}

export function useArchiveCategoryAccountMap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (filter) => categoryAccountMapApi.archive(filter),
    onSuccess: () => qc.invalidateQueries({ queryKey: CAM_KEY }),
  });
}

export function useRestoreCategoryAccountMap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (filter) => categoryAccountMapApi.restore(filter),
    onSuccess: () => qc.invalidateQueries({ queryKey: CAM_KEY }),
  });
}

/* ---- Company Accounts ---- */
const CA_KEY = ['companyAccounts'];

export function useCompanyAccounts(params = { limit: 200, includeDeactivated: 'true' }) {
  return useQuery({ queryKey: [...CA_KEY, params], queryFn: () => companyAccountApi.list(params) });
}

export function useCreateCompanyAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => companyAccountApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: CA_KEY }),
  });
}

export function useUpdateCompanyAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ filter, changes }) => companyAccountApi.update(filter, changes),
    onSuccess: () => qc.invalidateQueries({ queryKey: CA_KEY }),
  });
}

export function useArchiveCompanyAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (filter) => companyAccountApi.archive(filter),
    onSuccess: () => qc.invalidateQueries({ queryKey: CA_KEY }),
  });
}

export function useRestoreCompanyAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (filter) => companyAccountApi.restore(filter),
    onSuccess: () => qc.invalidateQueries({ queryKey: CA_KEY }),
  });
}

/* ---- Company Transactions ---- */
const CT_KEY = ['companyTransactions'];

export function useCompanyTransactions(params = { limit: 200, includeDeactivated: 'true' }) {
  return useQuery({ queryKey: [...CT_KEY, params], queryFn: () => companyTransactionApi.list(params) });
}

export function useCreateCompanyTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => companyTransactionApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: CT_KEY }),
  });
}

export function useUpdateCompanyTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ filter, changes }) => companyTransactionApi.update(filter, changes),
    onSuccess: () => qc.invalidateQueries({ queryKey: CT_KEY }),
  });
}

export function useArchiveCompanyTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (filter) => companyTransactionApi.archive(filter),
    onSuccess: () => qc.invalidateQueries({ queryKey: CT_KEY }),
  });
}

export function useRestoreCompanyTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (filter) => companyTransactionApi.restore(filter),
    onSuccess: () => qc.invalidateQueries({ queryKey: CT_KEY }),
  });
}

/* ---- Internal Transfers ---- */
const IT_KEY = ['internalTransfers'];

export function useInternalTransfers(params = { limit: 200, includeDeactivated: 'true' }) {
  return useQuery({ queryKey: [...IT_KEY, params], queryFn: () => internalTransferApi.list(params) });
}

export function useCreateInternalTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => internalTransferApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: IT_KEY }),
  });
}

export function useUpdateInternalTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ filter, changes }) => internalTransferApi.update(filter, changes),
    onSuccess: () => qc.invalidateQueries({ queryKey: IT_KEY }),
  });
}

export function useArchiveInternalTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (filter) => internalTransferApi.archive(filter),
    onSuccess: () => qc.invalidateQueries({ queryKey: IT_KEY }),
  });
}

export function useRestoreInternalTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (filter) => internalTransferApi.restore(filter),
    onSuccess: () => qc.invalidateQueries({ queryKey: IT_KEY }),
  });
}
