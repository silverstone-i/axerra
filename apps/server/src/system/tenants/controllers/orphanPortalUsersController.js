/**
 * @file Orphan portal_users controller — Axerra-only maintenance for unbound users
 * @module tenants/controllers/orphanPortalUsersController
 *
 * Lists portal_users rows that have zero portal_user_tenants references
 * (active OR archived) and zero impersonation_logs references, and hard-
 * deletes them on demand. Archived bindings are intentionally excluded
 * because they preserve restorable history; impersonation_logs rows are
 * intentionally excluded because their FKs have no ON DELETE CASCADE and
 * the audit trail must be preserved. Backed by SQL helpers installed via
 * the 202605010001_orphanPortalUsersCleanup admin migration.
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import db from '../../../db/db.js';
import logger from '../../../lib/logger.js';

// Maximum rows returned in a single preview. The page is platform-wide
// (admin schema), so an unbounded result could grow without limit if a
// large backlog accrues. The cap is applied in SQL via
// `find_orphan_portal_users(p_limit)`, and the full backlog count comes
// from `count_orphan_portal_users()` so we never materialize all rows
// in application memory just to slice.
const PREVIEW_LIMIT = 500;

/**
 * GET /orphans/preview — read-only preview of orphan portal_users.
 * An orphan is a portal_users row with zero portal_user_tenants references
 * (active OR archived) AND zero impersonation_logs references.
 *
 * Returns at most PREVIEW_LIMIT rows. When more orphans exist, the response
 * includes `truncated: true` and `total: <count>` so the operator sees
 * the full backlog size and can keep iterating.
 */
export async function findOrphans(req, res) {
  try {
    const [orphans, totalRow] = await Promise.all([
      db.any('SELECT * FROM admin.find_orphan_portal_users($1)', [PREVIEW_LIMIT]),
      db.one('SELECT admin.count_orphan_portal_users() AS total'),
    ]);
    const total = Number(totalRow.total);
    res.json({
      count: orphans.length,
      total,
      truncated: total > orphans.length,
      orphans,
    });
  } catch (err) {
    logger.error('Error previewing orphan portal_users', { error: err?.message });
    res.status(500).json({ error: 'Error previewing orphan portal users' });
  }
}

/**
 * POST /orphans/cleanup — hard-delete a single orphan portal_user.
 * Body: { id }
 * Returns 200 with the removed row, 400 if id is missing/invalid,
 * 404 if the row is not an orphan (or does not exist).
 */
export async function cleanupOrphan(req, res) {
  const { id } = req.body || {};
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!id || typeof id !== 'string' || !UUID_RE.test(id)) {
    return res.status(400).json({ error: 'Valid portal_user id (uuid) required' });
  }

  try {
    const removed = await db.tx((t) => t.oneOrNone('SELECT * FROM admin.cleanup_orphan_portal_user($1)', [id]));
    if (!removed) {
      return res.status(404).json({ error: 'Portal user not found or not an orphan' });
    }
    // The router rejects impersonated sessions, so this entry is always a
    // direct root action — actor_id is unambiguously the Axerra operator.
    logger.info('orphan-portal-user-cleanup', {
      actor_id: req.user?.id,
      actor_email: req.user?.email,
      impersonated: req.user?.is_impersonating === true,
      removed_id: removed.id,
      removed_email: removed.email,
    });
    res.json({ removed });
  } catch (err) {
    logger.error('Error cleaning up orphan portal_user', { error: err?.message });
    res.status(500).json({ error: 'Error cleaning up orphan portal user' });
  }
}

export default { findOrphans, cleanupOrphan };
