/**
 * @file Sources controller — standard CRUD for the polymorphic sources table
 * @module core/controllers/sourcesController
 *
 * Sources are typically auto-created by vendor/client/employee controllers.
 * This controller provides read access for callers that need to resolve a
 * polymorphic source record.
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import BaseController from '../../../lib/BaseController.js';

class SourcesController extends BaseController {
  constructor() {
    super('sources');
  }
}

const instance = new SourcesController();
export default instance;
export { SourcesController };
