/**
 * @file Accounting module route aggregator — mounts all GL sub-routers under /api/accounting
 * @module accounting/apiRoutes/v1/accountingApiRoutes
 *
 * Copyright (c) 2025 – present Vimber LLC. All rights reserved.
 */

import { Router } from 'express';
import chartOfAccountsRouter from './chartOfAccountsRouter.js';
import journalEntriesRouter from './journalEntriesRouter.js';
import journalEntryLinesRouter from './journalEntryLinesRouter.js';
import ledgerBalancesRouter from './ledgerBalancesRouter.js';
import postingQueuesRouter from './postingQueuesRouter.js';
import categoryAccountMapRouter from './categoryAccountMapRouter.js';
import companyAccountsRouter from './companyAccountsRouter.js';
import companyTransactionsRouter from './companyTransactionsRouter.js';
import internalTransfersRouter from './internalTransfersRouter.js';

const router = Router();

router.use('/v1/chart-of-accounts', chartOfAccountsRouter);
router.use('/v1/journal-entries', journalEntriesRouter);
router.use('/v1/journal-entry-lines', journalEntryLinesRouter);
router.use('/v1/ledger-balances', ledgerBalancesRouter);
router.use('/v1/posting-queues', postingQueuesRouter);
router.use('/v1/category-account-map', categoryAccountMapRouter);
router.use('/v1/company-accounts', companyAccountsRouter);
router.use('/v1/company-transactions', companyTransactionsRouter);
router.use('/v1/internal-transfers', internalTransfersRouter);

export default router;
