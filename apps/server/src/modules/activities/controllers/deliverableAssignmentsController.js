/**
 * @file DeliverableAssignments controller — standard CRUD
 * @module activities/controllers/deliverableAssignmentsController
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import BaseController from '../../../lib/BaseController.js';

class DeliverableAssignmentsController extends BaseController {
  constructor() {
    super('deliverableAssignments', 'deliverable-assignment');
  }
}

const instance = new DeliverableAssignmentsController();
export default instance;
export { DeliverableAssignmentsController };
