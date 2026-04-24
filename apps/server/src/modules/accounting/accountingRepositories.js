/**
 * @file Repository map for the Accounting module (tenant-scope)
 * @module accounting/accountingRepositories
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import ChartOfAccounts from './models/ChartOfAccounts.js';
import JournalEntries from './models/JournalEntries.js';
import JournalEntryLines from './models/JournalEntryLines.js';
import LedgerBalances from './models/LedgerBalances.js';
import PostingQueues from './models/PostingQueues.js';
import CategoryAccountMap from './models/CategoryAccountMap.js';
import CompanyAccounts from './models/CompanyAccounts.js';
import CompanyTransactions from './models/CompanyTransactions.js';
import InternalTransfers from './models/InternalTransfers.js';

const repositories = {
  chartOfAccounts: ChartOfAccounts,
  journalEntries: JournalEntries,
  journalEntryLines: JournalEntryLines,
  ledgerBalances: LedgerBalances,
  postingQueues: PostingQueues,
  categoryAccountMap: CategoryAccountMap,
  companyAccounts: CompanyAccounts,
  companyTransactions: CompanyTransactions,
  internalTransfers: InternalTransfers,
};

export default repositories;
