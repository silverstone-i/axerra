/**
 * @file Tenant preferences controller — CRUD for tenant UI preferences
 * @module core/controllers/tenantPreferencesController
 *
 * Single row per tenant. Pre-seeded during provisioning.
 *
 * Copyright (c) 2025 – present NapSoft LLC. All rights reserved.
 */

import BaseController from '../../../lib/BaseController.js';

class TenantPreferencesController extends BaseController {
  constructor() {
    super('tenantPreferences');
    this.rbacConfig = {
      module: 'core',
      router: 'tenant-preferences',
    };
  }
}

const instance = new TenantPreferencesController();
export default instance;
export { TenantPreferencesController };
