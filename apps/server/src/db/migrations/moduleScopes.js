/**
 * @file Module scope groupings — admin vs tenant module filtering
 * @module server/db/migrations/moduleScopes
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import moduleRegistry from '../moduleRegistry.js';

export const adminModules = moduleRegistry
  .filter((module) => module.scope === 'admin' || module.scope === 'shared')
  .map((module) => module.name);

export const tenantModules = moduleRegistry.filter((module) => module.scope !== 'admin').map((module) => module.name);

export function getModulesForSchema(schemaName) {
  return schemaName === 'admin' ? adminModules : tenantModules;
}
