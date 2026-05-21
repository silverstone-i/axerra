/**
 * @file Core services barrel — stable cross-boundary API
 * @module core/services
 *
 * Re-exports the public API for consumers outside the core module.
 * Intra-module consumers may import directly from individual files.
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

export { allocateNumber } from './numberingService.js';
