/**
 * @file Auth module migrations index
 * @module auth/schema/migrations
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import bootstrapAdmin from './202502110001_bootstrapAdmin.js';
import orphanPortalUsersCleanup from './202605010001_orphanPortalUsersCleanup.js';

export default [bootstrapAdmin, orphanPortalUsersCleanup];
