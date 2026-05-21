/**
 * @file Aggregated repository map built from module registry
 * @module server/db/repositories
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import moduleRegistry from './moduleRegistry.js';

export const enabledModules = moduleRegistry.map((module) => module.name);

const repositories = {};

for (const module of moduleRegistry) {
  Object.assign(repositories, module.repositories);
}

export default repositories;
