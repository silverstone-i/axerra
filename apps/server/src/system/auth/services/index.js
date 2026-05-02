/**
 * @file Barrel exports for the auth module's cross-boundary services
 * @module auth/services/index
 *
 * Per ADR-0019, cross-module consumers (e.g. system/core controllers)
 * must import auth services through this barrel rather than reaching
 * into individual files.
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

export { findActiveBinding, findAnyBinding, findActivePortalUserId } from './portalUserBindings.js';
