/**
 * @file Tenant context middleware — injects tenant_code / tenant_id from req.user
 * @module server/middleware/addAuditFields
 *
 * POST only: injects tenant_code and tenant_id from the authenticated user.
 * Audit columns (created_by / updated_by) are now filled by pg-schemata's
 * ambient resolver (see lib/registerAuditResolver.js + middleware/auditContext.js),
 * so they are no longer threaded through req.body.
 *
 * Still acts as the guard that rejects mutation routes with no user context.
 *
 * NOTE: the file and exported function are still named `addAuditFields`
 * for historical reasons — many routers wire it in by name. The audit-
 * injection responsibility has moved to the ALS resolver; this module now
 * only carries the tenant-context injection. Rename is a follow-up that
 * has to update every router import.
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

export function addAuditFields(req, res, next) {
  const userId = req.user?.id;
  if (!userId) return res.status(400).json({ message: 'Missing user context for audit fields.' });

  const path = req.originalUrl || '';
  const tenantCode = req.user?.tenant_code;

  // For tenant creation and user registration, do NOT inject tenant_code —
  // these controllers explicitly handle tenant_code from req.body.
  const isTenantCreate = /\/tenants\/?$/.test(path) && req.method === 'POST';
  const isUserRegister = path.includes('portal-users/register');
  const skipTenantCode = isTenantCreate || isUserRegister;

  if (!req.body) req.body = {};

  const tenantId = req.user?.tenant_id;

  const applyAuditFields = (record) => {
    if (req.method === 'POST') {
      if (tenantCode && !skipTenantCode) record.tenant_code = tenantCode;
      if (tenantId && !skipTenantCode && !record.tenant_id) record.tenant_id = tenantId;
    }
  };

  if (Array.isArray(req.body)) {
    req.body.forEach(applyAuditFields);
  } else {
    applyAuditFields(req.body);
  }

  next();
}

export default addAuditFields;
