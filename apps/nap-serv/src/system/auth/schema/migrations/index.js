/**
 * @file Auth module migrations index
 * @module auth/schema/migrations
 *
 * Copyright (c) 2025 – present Vimber LLC. All rights reserved.
 */

import bootstrapAdmin from './202502110001_bootstrapAdmin.js';
import renameNapUsersToPortalUsers from './202604231200_renameNapUsersToPortalUsers.js';

export default [bootstrapAdmin, renameNapUsersToPortalUsers];
