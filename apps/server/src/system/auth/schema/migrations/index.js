/**
 * @file Auth module migrations index
 * @module auth/schema/migrations
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import bootstrapAdmin from './202502110001_bootstrapAdmin.js';
import orphanPortalUsersCleanup from './202605010001_orphanPortalUsersCleanup.js';

export default [bootstrapAdmin, orphanPortalUsersCleanup];
