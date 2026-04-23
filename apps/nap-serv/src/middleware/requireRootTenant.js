/**
 * @file requireRootTenant — restricts access to Vimber tenant users
 * @module nap-serv/middleware/requireRootTenant
 *
 * Returns 403 for any request where the authenticated user does not belong
 * to the Vimber platform tenant (per PRD §3.2).
 *
 * Copyright (c) 2025 – present Vimber LLC. All rights reserved.
 */

/**
 * Express middleware that gates routes to Vimber employees only.
 */
export function requireRootTenant(req, res, next) {
  const rootSchema = (process.env.ROOT_TENANT_CODE || 'nap').toLowerCase();
  const userTenant = req.user?.home_tenant?.toLowerCase?.();

  if (!req.user || !userTenant || userTenant !== rootSchema) {
    return res.status(403).json({ message: 'Access denied: not a Vimber user.' });
  }

  next();
}

export default requireRootTenant;
