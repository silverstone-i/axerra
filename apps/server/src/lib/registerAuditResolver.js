/**
 * @file Boot-time hook — register the pg-schemata audit-actor resolver
 * @module server/lib/registerAuditResolver
 *
 * Wires `pg-schemata`'s global `_resolveAuditActor` to read from this
 * process's `requestContext` ALS store. Call once at app boot (before any
 * DB write happens). Idempotent — subsequent calls are no-ops.
 *
 * After registration, pg-schemata write methods that don't get an explicit
 * `created_by` / `updated_by` in the DTO will fall back to the current
 * request's `userId`, eliminating the need for controllers to thread the
 * actor through every layer.
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { setAuditActorResolver } from 'pg-schemata';
import { currentUserId } from './requestContext.js';

let registered = false;

/**
 * Register the audit-actor resolver. Safe to call multiple times.
 */
export function registerAuditResolver() {
  if (registered) return;
  setAuditActorResolver(currentUserId);
  registered = true;
}

export default registerAuditResolver;
