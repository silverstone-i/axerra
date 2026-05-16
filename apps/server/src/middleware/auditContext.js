/**
 * @file Express middleware — populate the ambient request-context store
 * @module server/middleware/auditContext
 *
 * Mounted immediately after `authRedis` so `req.user` is already hydrated.
 * Calls `requestContext.run(store, next)` with the user/tenant fields the
 * downstream code needs to read (via `currentUserId()`, `currentSchema()`,
 * etc.). `next` is invoked INSIDE `als.run`, so every route handler, every
 * service call, every pg-schemata write inside this request sees the same
 * store via `async_hooks` propagation.
 *
 * No-op-safe when `req.user` is missing (e.g. routes that bypass auth) —
 * the store fields land `null` and the audit resolver returns `null`.
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import { requestContext } from '../lib/requestContext.js';

export function auditContext(req, _res, next) {
  const store = {
    userId: req.user?.id ?? null,
    tenantId: req.user?.tenant_id ?? null,
    schema:
      req.user?.schema_name?.toLowerCase?.() ?? req.user?.tenant_code?.toLowerCase?.() ?? null,
    tenantCode: req.user?.tenant_code ?? null,
  };
  requestContext.run(store, () => next());
}

export default auditContext;
