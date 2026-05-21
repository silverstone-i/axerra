/**
 * @file Request-scoped context via AsyncLocalStorage
 * @module server/lib/requestContext
 *
 * Provides an ambient store carrying the current actor's `userId`, the active
 * tenant `schema`, and related identifiers. Populated by the
 * `auditContext` Express middleware on every request after `authRedis`
 * hydrates `req.user`. Non-HTTP entry points (scripts, seeders, jobs) can
 * opt in via `runWithContext()`.
 *
 * The store is read by `pg-schemata`'s audit-actor resolver (registered once
 * at boot in `registerAuditResolver.js`) so insert/update calls can fill
 * `created_by` / `updated_by` automatically without controller-side
 * threading.
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Single per-process AsyncLocalStorage instance keyed by async call chain.
 * Stores `{ userId, tenantId, schema, tenantCode }` for the duration of a
 * request (or any `als.run` block).
 */
export const requestContext = new AsyncLocalStorage();

/**
 * Current actor's portal_user UUID, or `null` outside any context.
 * @returns {string|null}
 */
export function currentUserId() {
  return requestContext.getStore()?.userId ?? null;
}

/**
 * Current tenant schema name (lower-cased tenant_code), or `null`.
 * @returns {string|null}
 */
export function currentSchema() {
  return requestContext.getStore()?.schema ?? null;
}

/**
 * Current tenant UUID, or `null`.
 * @returns {string|null}
 */
export function currentTenantId() {
  return requestContext.getStore()?.tenantId ?? null;
}

/**
 * Current tenant code (original casing as stored in admin.tenants), or `null`.
 * @returns {string|null}
 */
export function currentTenantCode() {
  return requestContext.getStore()?.tenantCode ?? null;
}

/**
 * Run a callback inside an ALS context. Use from non-HTTP entry points
 * (scripts, seeders, cron jobs) to opt them into ambient audit-actor
 * resolution. Inside the callback, every `await`/`Promise.then` chain
 * preserves the store via Node's `async_hooks`.
 *
 * @template T
 * @param {{ userId: string|null, tenantId?: string|null, schema?: string|null, tenantCode?: string|null }} store
 * @param {() => T | Promise<T>} fn
 * @returns {T | Promise<T>}
 */
export function runWithContext(store, fn) {
  return requestContext.run(store, fn);
}
