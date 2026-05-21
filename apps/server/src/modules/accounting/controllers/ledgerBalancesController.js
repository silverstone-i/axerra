/**
 * @file Ledger Balances controller — read-only queries
 * @module accounting/controllers/ledgerBalancesController
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import ViewController from '../../../lib/ViewController.js';

class LedgerBalancesController extends ViewController {
  constructor() {
    super('ledgerBalances', 'ledger-balance');
    this.rbacConfig = { module: 'accounting', router: 'ledger-balances' };
  }
}

const instance = new LedgerBalancesController();
export default instance;
export { LedgerBalancesController };
