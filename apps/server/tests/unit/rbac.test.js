/**
 * @file Unit tests for rbac middleware
 * @module tests/unit/rbac
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import { describe, it, expect, vi } from 'vitest';
import { rbac, resolveLevel, EXACT_MATCH_KEYS } from '../../src/middleware/rbac.js';

describe('resolveLevel', () => {
  it('returns exact match for module::router::action', () => {
    const caps = { 'ar::invoices::approve': 'full' };
    expect(resolveLevel(caps, 'ar', 'invoices', 'approve')).toBe('full');
  });

  it('falls back to module::router::', () => {
    const caps = { 'ar::invoices::': 'view' };
    expect(resolveLevel(caps, 'ar', 'invoices', 'approve')).toBe('view');
  });

  it('falls back to module::::', () => {
    const caps = { 'ar::::': 'full' };
    expect(resolveLevel(caps, 'ar', 'invoices', 'approve')).toBe('full');
  });

  it('returns none when no match found', () => {
    const caps = { 'projects::::': 'full' };
    expect(resolveLevel(caps, 'ar', 'invoices', 'approve')).toBe('none');
  });

  it('prefers most specific key', () => {
    const caps = {
      'ar::::': 'view',
      'ar::invoices::': 'view',
      'ar::invoices::approve': 'full',
    };
    expect(resolveLevel(caps, 'ar', 'invoices', 'approve')).toBe('full');
  });

  // ── Import / Export resolution ────────────────────────────────

  it('resolves import action at module::router::import level', () => {
    const caps = { 'core::vendors::import': 'full' };
    expect(resolveLevel(caps, 'core', 'vendors', 'import')).toBe('full');
  });

  it('resolves export action at module::router::export level', () => {
    const caps = { 'core::vendors::export': 'view' };
    expect(resolveLevel(caps, 'core', 'vendors', 'export')).toBe('view');
  });

  it('falls back to router level when no import action policy', () => {
    const caps = { 'core::vendors::': 'full' };
    expect(resolveLevel(caps, 'core', 'vendors', 'import')).toBe('full');
  });

  it('action-level none stops resolution (does not fall back to router level)', () => {
    const caps = { 'core::vendors::import': 'none', 'core::vendors::': 'full' };
    // 'none' is truthy so resolveLevel returns it without falling back
    expect(resolveLevel(caps, 'core', 'vendors', 'import')).toBe('none');
  });

  it('wildcard :::: covers import (policy_required: false) but NOT export (exact-match)', () => {
    const caps = { '::::': 'full' };
    expect(resolveLevel(caps, 'core', 'vendors', 'import')).toBe('full');
    expect(resolveLevel(caps, 'core', 'vendors', 'export')).toBe('none');
  });

  // ── Exact-match (policy_required) actions ─────────────────────

  it('registers reset-password addresses as exact-match', () => {
    expect(EXACT_MATCH_KEYS.has('core::employees::reset-password')).toBe(true);
    expect(EXACT_MATCH_KEYS.has('core::clients::reset-password')).toBe(true);
    expect(EXACT_MATCH_KEYS.has('core::vendor-contacts::reset-password')).toBe(true);
  });

  it('exact-match action ignores router-level grant', () => {
    const caps = { 'core::employees::': 'full' };
    expect(resolveLevel(caps, 'core', 'employees', 'reset-password')).toBe('none');
  });

  it('exact-match action ignores module-level grant', () => {
    const caps = { 'core::::': 'full' };
    expect(resolveLevel(caps, 'core', 'clients', 'reset-password')).toBe('none');
  });

  it('exact-match action ignores wildcard grant', () => {
    const caps = { '::::': 'full' };
    expect(resolveLevel(caps, 'core', 'vendor-contacts', 'reset-password')).toBe('none');
  });

  it('exact-match action requires exact key', () => {
    const caps = { 'core::employees::reset-password': 'full' };
    expect(resolveLevel(caps, 'core', 'employees', 'reset-password')).toBe('full');
  });

  it('exact-match does not affect non-listed actions', () => {
    expect(EXACT_MATCH_KEYS.has('core::employees::')).toBe(false);
    const caps = { 'core::employees::': 'full' };
    expect(resolveLevel(caps, 'core', 'employees', 'create')).toBe('full');
  });

  // ── Exact-match (export) — independent compliance gate ────────

  it('registers export addresses as exact-match (compliance gate)', () => {
    expect(EXACT_MATCH_KEYS.has('core::vendors::export')).toBe(true);
    expect(EXACT_MATCH_KEYS.has('core::employees::export')).toBe(true);
    expect(EXACT_MATCH_KEYS.has('ap::ap-invoices::export')).toBe(true);
    expect(EXACT_MATCH_KEYS.has('ar::ar-invoices::export')).toBe(true);
    expect(EXACT_MATCH_KEYS.has('accounting::journal-entries::export')).toBe(true);
  });

  it('does NOT register import addresses as exact-match (covered by CRUD)', () => {
    expect(EXACT_MATCH_KEYS.has('core::vendors::import')).toBe(false);
    expect(EXACT_MATCH_KEYS.has('ap::ap-invoices::import')).toBe(false);
    expect(EXACT_MATCH_KEYS.has('accounting::journal-entries::import')).toBe(false);
  });

  it('export with router-level full alone resolves to none', () => {
    const caps = { 'core::vendors::': 'full' };
    expect(resolveLevel(caps, 'core', 'vendors', 'export')).toBe('none');
  });

  it('export with explicit view grant resolves to view', () => {
    const caps = { 'core::vendors::export': 'view' };
    expect(resolveLevel(caps, 'core', 'vendors', 'export')).toBe('view');
  });

  it('import still falls back to router-level (policy_required: false)', () => {
    const caps = { 'core::vendors::': 'full' };
    expect(resolveLevel(caps, 'core', 'vendors', 'import')).toBe('full');
  });

  it('exact-match short-circuits module-level deny (motivates support-role financial filter)', () => {
    // Demonstrates why systemRoleSeeder must NOT seed support with
    // explicit financial export grants: an exact-match key for
    // ap::ap-invoices::export would bypass the ap=none module deny.
    const caps = {
      '::::': 'full',
      'ap::::': 'none',
      'ap::ap-invoices::export': 'full',
    };
    expect(resolveLevel(caps, 'ap', 'ap-invoices', 'export')).toBe('full');
  });

  it('without an explicit financial export grant, exact-match returns none (support-role behavior)', () => {
    // Support role gets wildcard full + ap/ar/accounting=none, but no
    // explicit ap::ap-invoices::export. exact-match resolution reads
    // only the exact key, returns none — financial export blocked.
    const caps = {
      '::::': 'full',
      'ap::::': 'none',
    };
    expect(resolveLevel(caps, 'ap', 'ap-invoices', 'export')).toBe('none');
  });
});

describe('rbac middleware', () => {
  function makeReq(method, permissions = {}, resource = {}) {
    return {
      method,
      user: { id: 'u1', permissions },
      resource,
    };
  }

  function makeRes() {
    const res = {
      statusCode: null,
      body: null,
      status(code) {
        res.statusCode = code;
        return res;
      },
      json(data) {
        res.body = data;
        return res;
      },
    };
    return res;
  }

  it('allows GET when user has view level', async () => {
    const req = makeReq('GET', { caps: { 'ar::::': 'view' } }, { module: 'ar', router: '', action: '' });
    const res = makeRes();
    const next = vi.fn();

    await rbac()(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('allows POST when user has full level', async () => {
    const req = makeReq('POST', { caps: { 'ar::::': 'full' } }, { module: 'ar', router: '', action: '' });
    const res = makeRes();
    const next = vi.fn();

    await rbac()(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('denies POST when user only has view level', async () => {
    const req = makeReq('POST', { caps: { 'ar::::': 'view' } }, { module: 'ar', router: '', action: '' });
    const res = makeRes();
    const next = vi.fn();

    await rbac()(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('denies when user has no permissions', async () => {
    const req = makeReq('GET', { caps: {} }, { module: 'ar', router: '', action: '' });
    const res = makeRes();
    const next = vi.fn();

    await rbac()(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('defaults GET to view required level', async () => {
    const req = makeReq('GET', { caps: { 'ar::::': 'view' } }, { module: 'ar', router: '', action: '' });
    const res = makeRes();
    const next = vi.fn();

    await rbac()(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('defaults POST to full required level', async () => {
    const req = makeReq('POST', { caps: { 'ar::::': 'view' } }, { module: 'ar', router: '', action: '' });
    const res = makeRes();
    const next = vi.fn();

    await rbac()(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('uses explicit required level hint', async () => {
    const req = makeReq('GET', { caps: { 'ar::::': 'view' } }, { module: 'ar', router: '', action: '' });
    const res = makeRes();
    const next = vi.fn();

    await rbac('full')(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('includes detailed deny payload', async () => {
    const req = makeReq('POST', { caps: {} }, { module: 'ar', router: 'invoices', action: 'create' });
    req.user.id = 'user-123';
    req.ctx = { tenant: { id: 'tenant-456' } };
    const res = makeRes();
    const next = vi.fn();

    await rbac()(req, res, next);
    expect(res.body).toMatchObject({
      userId: 'user-123',
      module: 'ar',
      router: 'invoices',
      action: 'create',
      method: 'POST',
      needed: 'full',
      have: 'none',
    });
  });

  // ── Import / Export action resolution ──────────────────────────

  it('allows import when action-level policy is full', async () => {
    const req = makeReq('POST', { caps: { 'core::vendors::import': 'full' } }, { module: 'core', router: 'vendors', action: 'import' });
    const res = makeRes();
    const next = vi.fn();
    await rbac('full')(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('denies import when action-level policy is view (needs full)', async () => {
    const req = makeReq('POST', { caps: { 'core::vendors::import': 'view' } }, { module: 'core', router: 'vendors', action: 'import' });
    const res = makeRes();
    const next = vi.fn();
    await rbac('full')(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('allows export when action-level policy is view', async () => {
    const req = makeReq('POST', { caps: { 'core::vendors::export': 'view' } }, { module: 'core', router: 'vendors', action: 'export' });
    const res = makeRes();
    const next = vi.fn();
    await rbac('view')(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('denies export when action-level policy is none', async () => {
    const req = makeReq('POST', { caps: { 'core::vendors::export': 'none' } }, { module: 'core', router: 'vendors', action: 'export' });
    const res = makeRes();
    const next = vi.fn();
    await rbac('view')(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('falls back to router-level when no import action policy exists', async () => {
    const req = makeReq('POST', { caps: { 'core::vendors::': 'full' } }, { module: 'core', router: 'vendors', action: 'import' });
    const res = makeRes();
    const next = vi.fn();
    await rbac('full')(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('export does NOT fall back to router-level (exact-match required)', async () => {
    const req = makeReq('POST', { caps: { 'core::vendors::': 'full' } }, { module: 'core', router: 'vendors', action: 'export' });
    const res = makeRes();
    const next = vi.fn();
    await rbac('view')(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('export with explicit grant succeeds', async () => {
    const req = makeReq('POST', { caps: { 'core::vendors::export': 'view' } }, { module: 'core', router: 'vendors', action: 'export' });
    const res = makeRes();
    const next = vi.fn();
    await rbac('view')(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('action-level none overrides router-level full for import (explicit deny)', async () => {
    const caps = { 'core::vendors::import': 'none', 'core::vendors::': 'full' };
    const req = makeReq('POST', { caps }, { module: 'core', router: 'vendors', action: 'import' });
    const res = makeRes();
    const next = vi.fn();
    await rbac('full')(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('wildcard :::: grants import (policy_required: false) but NOT export (exact-match)', async () => {
    const importReq = makeReq('POST', { caps: { '::::': 'full' } }, { module: 'core', router: 'vendors', action: 'import' });
    const exportReq = makeReq('POST', { caps: { '::::': 'full' } }, { module: 'core', router: 'vendors', action: 'export' });
    const res1 = makeRes();
    const res2 = makeRes();
    const next1 = vi.fn();
    const next2 = vi.fn();
    await rbac('full')(importReq, res1, next1);
    await rbac('view')(exportReq, res2, next2);
    expect(next1).toHaveBeenCalledOnce();
    expect(next2).not.toHaveBeenCalled();
    expect(res2.statusCode).toBe(403);
  });

  it('does NOT bypass for any special role — all go through policy resolution', async () => {
    // Even if we had a "super_user" role marker, it should not bypass
    const req = makeReq('POST', { caps: {} }, { module: 'ar', router: '', action: '' });
    req.user.role = 'super_user';
    const res = makeRes();
    const next = vi.fn();

    await rbac()(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  // ── Exact-match (reset-password) endpoint enforcement ─────────

  it('denies reset-password when role only has router-level full', async () => {
    const req = makeReq(
      'POST',
      { caps: { 'core::employees::': 'full' } },
      { module: 'core', router: 'employees', action: 'reset-password' },
    );
    const res = makeRes();
    const next = vi.fn();
    await rbac('full')(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('denies reset-password when role only has wildcard ::::', async () => {
    const req = makeReq(
      'POST',
      { caps: { '::::': 'full' } },
      { module: 'core', router: 'clients', action: 'reset-password' },
    );
    const res = makeRes();
    const next = vi.fn();
    await rbac('full')(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('allows reset-password when role has the exact action grant', async () => {
    const req = makeReq(
      'POST',
      { caps: { 'core::vendor-contacts::reset-password': 'full' } },
      { module: 'core', router: 'vendor-contacts', action: 'reset-password' },
    );
    const res = makeRes();
    const next = vi.fn();
    await rbac('full')(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });
});
