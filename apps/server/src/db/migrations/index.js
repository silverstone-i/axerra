/**
 * @file Central migration export — configures the migrator from module registry
 * @module server/db/migrations
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import moduleRegistry from '../moduleRegistry.js';
import logger from '../../lib/logger.js';
import { createMigrator } from './createMigrator.js';

const modules = Object.fromEntries(
  moduleRegistry.map((module) => [
    module.name,
    {
      migrations: module.migrations ?? [],
      repositories: module.repositories ?? {},
      scope: module.scope ?? 'tenant',
    },
  ]),
);

export const migrator = createMigrator({ modules, logger });

export default migrator;
