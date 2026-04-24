/**
 * @file requireRootTenant — restricts access to Axerra tenant users
 * @module server/middleware/requireRootTenant
 *
 * Returns 403 for any request where the authenticated user does not belong
 * to the Axerra platform tenant (per PRD §3.2).
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

/**
 * Express middleware that gates routes to Axerra employees only.
 */
export function requireRootTenant(req, res, next) {
  const rootSchema = (process.env.ROOT_TENANT_CODE || 'axerra').toLowerCase();
  const userTenant = req.user?.home_tenant?.toLowerCase?.();

  if (!req.user || !userTenant || userTenant !== rootSchema) {
    return res.status(403).json({ message: 'Access denied: not a Axerra user.' });
  }

  next();
}

export default requireRootTenant;
