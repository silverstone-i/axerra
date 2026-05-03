/**
 * @file Unit tests for authRedis middleware
 * @module tests/unit/authRedis
 *
 * Tests the middleware in isolation using mocked JWT and DB.
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import { describe, test, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import jwt from 'jsonwebtoken';
import { authRedis } from '../../src/middleware/authRedis.js';

// Pin ROOT_TENANT_CODE for the lifetime of this file. Other test suites
// (helpers/testDb.js, contract/reports.test.js) write the env at module
// load, and Vitest can reuse workers across files — without an explicit
// pin here, root-vs-non-root expectations would be order-dependent.
const ORIGINAL_ROOT_TENANT_CODE = process.env.ROOT_TENANT_CODE;
beforeAll(() => {
  process.env.ROOT_TENANT_CODE = 'AXERRA';
});
afterAll(() => {
  if (ORIGINAL_ROOT_TENANT_CODE === undefined) {
    delete process.env.ROOT_TENANT_CODE;
  } else {
    process.env.ROOT_TENANT_CODE = ORIGINAL_ROOT_TENANT_CODE;
  }
});

// Mock Redis module
vi.mock('../../src/db/redis.js', () => {
  const mockRedis = {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
  };
  return {
    getRedis: vi.fn().mockResolvedValue(mockRedis),
    closeRedis: vi.fn().mockResolvedValue(undefined),
    default: { getRedis: vi.fn().mockResolvedValue(mockRedis), closeRedis: vi.fn() },
  };
});

// Mock db module
vi.mock('../../src/db/db.js', () => {
  const mockFindOneBy = vi.fn();
  const mockFindById = vi.fn();
  const mockOneOrNone = vi.fn();
  const mockDb = vi.fn((modelName) => {
    if (modelName === 'portalUsers') return { findOneBy: mockFindOneBy };
    if (modelName === 'tenants') return { findById: mockFindById };
    return {};
  });
  mockDb.oneOrNone = mockOneOrNone;
  return {
    default: mockDb,
    db: mockDb,
    __mockFindOneBy: mockFindOneBy,
    __mockFindById: mockFindById,
    __mockOneOrNone: mockOneOrNone,
  };
});

const dbMock = await import('../../src/db/db.js');
const { __mockFindOneBy: mockFindOneBy, __mockFindById: mockFindById, __mockOneOrNone: mockOneOrNone } = dbMock;

const SECRET = 'test-access-secret-for-authredis!';
process.env.ACCESS_TOKEN_SECRET = SECRET;

function makeReq(overrides = {}) {
  return {
    path: '/api/something',
    originalUrl: '/api/something',
    cookies: {},
    headers: {},
    ...overrides,
  };
}

function makeRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn();
  return res;
}

describe('authRedis middleware', () => {
  const middleware = authRedis();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('bypasses auth for /auth/login path', async () => {
    const req = makeReq({ path: '/auth/login', originalUrl: '/api/auth/login' });
    const res = makeRes();
    const next = vi.fn();

    await middleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('bypasses auth for /auth/refresh path', async () => {
    const req = makeReq({ path: '/auth/refresh', originalUrl: '/api/auth/refresh' });
    const res = makeRes();
    const next = vi.fn();

    await middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('bypasses auth for /auth/logout path', async () => {
    const req = makeReq({ path: '/auth/logout', originalUrl: '/api/auth/logout' });
    const res = makeRes();
    const next = vi.fn();

    await middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('returns 401 when no auth_token cookie', async () => {
    const req = makeReq({ cookies: {} });
    const res = makeRes();
    const next = vi.fn();

    await middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 for invalid JWT', async () => {
    const req = makeReq({ cookies: { auth_token: 'invalid.jwt.token' } });
    const res = makeRes();
    const next = vi.fn();

    await middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('populates req.user for valid JWT and existing user + tenant', async () => {
    const userId = '550e8400-e29b-41d4-a716-446655440000';
    const tenantId = '660e8400-e29b-41d4-a716-446655440000';
    const entityId = '880e8400-e29b-41d4-a716-446655440000';
    const token = jwt.sign({ sub: userId, ph: null }, SECRET, { expiresIn: '15m' });

    mockFindOneBy.mockResolvedValue({
      id: userId,
      email: 'admin@axerra.io',
      status: 'active',
      deactivated_at: null,
    });

    // Home binding lookup
    mockOneOrNone.mockResolvedValueOnce({
      id: 'binding-1',
      portal_user_id: userId,
      tenant_id: tenantId,
      entity_type: 'employee',
      entity_id: entityId,
      status: 'active',
    });

    mockFindById.mockResolvedValue({
      id: tenantId,
      tenant_code: 'AXERRA',
      company: 'Axerra LLC',
      schema_name: 'axerra',
      status: 'active',
    });

    const req = makeReq({ cookies: { auth_token: token } });
    const res = makeRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user.id).toBe(userId);
    expect(req.user.email).toBe('admin@axerra.io');
    expect(req.user.entity_type).toBe('employee');
    expect(req.user.entity_id).toBe(entityId);
    expect(req.user.tenant_code).toBe('axerra');
    expect(req.user.schema_name).toBe('axerra');
  });

  test('returns 401 when user not found in DB', async () => {
    const token = jwt.sign({ sub: 'nonexistent-id' }, SECRET, { expiresIn: '15m' });

    mockFindOneBy.mockResolvedValue(null);

    const req = makeReq({ cookies: { auth_token: token } });
    const res = makeRes();
    const next = vi.fn();

    await middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('respects x-tenant-code header for tenant resolution', async () => {
    const userId = '550e8400-e29b-41d4-a716-446655440000';
    const tenantId = '660e8400-e29b-41d4-a716-446655440000';
    const token = jwt.sign({ sub: userId, ph: null }, SECRET, { expiresIn: '15m' });

    mockFindOneBy.mockResolvedValue({
      id: userId,
      email: 'admin@axerra.io',
      status: 'active',
    });

    // 1) home binding lookup, 2) x-tenant-code → tenants row, 3) matched binding for that tenant (none)
    mockOneOrNone
      .mockResolvedValueOnce({
        id: 'binding-1',
        portal_user_id: userId,
        tenant_id: tenantId,
        entity_type: 'employee',
        entity_id: 'emp-1',
        status: 'active',
      })
      .mockResolvedValueOnce({
        id: 'acme-id',
        tenant_code: 'ACME',
        schema_name: 'acme',
      })
      .mockResolvedValueOnce(null);

    mockFindById.mockResolvedValue({
      id: tenantId,
      tenant_code: 'AXERRA',
      schema_name: 'axerra',
    });

    const req = makeReq({
      cookies: { auth_token: token },
      headers: { 'x-tenant-code': 'ACME' },
    });
    const res = makeRes();
    const next = vi.fn();

    await middleware(req, res, next);
    expect(req.user.tenant_code).toBe('acme');
  });

  test('sets req.ctx.tenant to effective tenant when x-tenant-code differs from home', async () => {
    const userId = '550e8400-e29b-41d4-a716-446655440000';
    const homeTenantId = '660e8400-e29b-41d4-a716-446655440000';
    const acmeTenantId = '770e8400-e29b-41d4-a716-446655440000';
    const token = jwt.sign({ sub: userId, ph: null }, SECRET, { expiresIn: '15m' });

    mockFindOneBy.mockResolvedValue({
      id: userId,
      email: 'admin@axerra.io',
      status: 'active',
    });

    mockFindById.mockResolvedValue({
      id: homeTenantId,
      tenant_code: 'AXERRA',
      schema_name: 'axerra',
      allowed_modules: ['projects', 'accounting'],
    });

    // 1) home binding, 2) x-tenant-code → tenants row, 3) matched binding (none)
    mockOneOrNone
      .mockResolvedValueOnce({
        id: 'binding-1',
        portal_user_id: userId,
        tenant_id: homeTenantId,
        entity_type: 'employee',
        entity_id: 'emp-1',
        status: 'active',
      })
      .mockResolvedValueOnce({
        id: acmeTenantId,
        tenant_code: 'ACME',
        schema_name: 'acme',
        allowed_modules: ['projects'],
      })
      .mockResolvedValueOnce(null);

    const req = makeReq({
      cookies: { auth_token: token },
      headers: { 'x-tenant-code': 'ACME' },
    });
    const res = makeRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user.tenant_code).toBe('acme');
    expect(req.user.schema_name).toBe('acme');
    // req.ctx.tenant must reflect the effective (ACME) tenant, not the home (AXERRA) tenant
    expect(req.ctx.tenant.tenant_code).toBe('ACME');
    expect(req.ctx.tenant.id).toBe(acmeTenantId);
    expect(req.ctx.tenant.allowed_modules).toEqual(['projects']);
    // req.user.tenant_id must reflect assumed tenant, not home tenant
    expect(req.user.tenant_id).toBe(acmeTenantId);
    expect(req.user.home_tenant).toBe('axerra');
  });

  // ── Task 13: cross-tenant binding validation ──────────────────────────

  test('non-Axerra user with no binding to requested tenant → 403', async () => {
    const userId = '550e8400-e29b-41d4-a716-446655440000';
    const homeTenantId = '660e8400-e29b-41d4-a716-446655440000';
    const otherTenantId = '770e8400-e29b-41d4-a716-446655440000';
    const token = jwt.sign({ sub: userId, ph: null }, SECRET, { expiresIn: '15m' });

    mockFindOneBy.mockResolvedValue({
      id: userId,
      email: 'vendor@acme.com',
      status: 'active',
    });

    mockFindById.mockResolvedValue({
      id: homeTenantId,
      tenant_code: 'ACME',
      schema_name: 'acme',
    });

    // 1) home binding (ACME), 2) requested tenant lookup (BETA), 3) matched binding for BETA → none
    mockOneOrNone
      .mockResolvedValueOnce({
        id: 'binding-1',
        portal_user_id: userId,
        tenant_id: homeTenantId,
        entity_type: 'vendor_contact',
        entity_id: 'vc-1',
        status: 'active',
      })
      .mockResolvedValueOnce({
        id: otherTenantId,
        tenant_code: 'BETA',
        schema_name: 'beta',
      })
      .mockResolvedValueOnce(null);

    const req = makeReq({
      cookies: { auth_token: token },
      headers: { 'x-tenant-code': 'BETA' },
    });
    const res = makeRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'No active binding to the requested tenant' });
    expect(next).not.toHaveBeenCalled();
  });

  test('non-Axerra user with binding to requested tenant → switches successfully', async () => {
    const userId = '550e8400-e29b-41d4-a716-446655440000';
    const homeTenantId = '660e8400-e29b-41d4-a716-446655440000';
    const otherTenantId = '770e8400-e29b-41d4-a716-446655440000';
    const token = jwt.sign({ sub: userId, ph: null }, SECRET, { expiresIn: '15m' });

    mockFindOneBy.mockResolvedValue({
      id: userId,
      email: 'vendor@multi.com',
      status: 'active',
    });

    mockFindById.mockResolvedValue({
      id: homeTenantId,
      tenant_code: 'ACME',
      schema_name: 'acme',
    });

    // 1) home binding (ACME), 2) requested tenant (BETA), 3) matched binding (BETA)
    mockOneOrNone
      .mockResolvedValueOnce({
        id: 'binding-1',
        portal_user_id: userId,
        tenant_id: homeTenantId,
        entity_type: 'vendor_contact',
        entity_id: 'vc-1',
        status: 'active',
      })
      .mockResolvedValueOnce({
        id: otherTenantId,
        tenant_code: 'BETA',
        schema_name: 'beta',
      })
      .mockResolvedValueOnce({
        id: 'binding-2',
        portal_user_id: userId,
        tenant_id: otherTenantId,
        entity_type: 'vendor_contact',
        entity_id: 'vc-2',
        status: 'active',
      });

    const req = makeReq({
      cookies: { auth_token: token },
      headers: { 'x-tenant-code': 'BETA' },
    });
    const res = makeRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user.tenant_code).toBe('beta');
    expect(req.user.schema_name).toBe('beta');
    expect(req.user.entity_id).toBe('vc-2');
    expect(req.user.home_tenant).toBe('acme');
  });

  test('returns 404 when x-tenant-code points at a tenant that does not exist', async () => {
    const userId = '550e8400-e29b-41d4-a716-446655440000';
    const homeTenantId = '660e8400-e29b-41d4-a716-446655440000';
    const token = jwt.sign({ sub: userId, ph: null }, SECRET, { expiresIn: '15m' });

    mockFindOneBy.mockResolvedValue({
      id: userId,
      email: 'admin@axerra.io',
      status: 'active',
    });

    mockFindById.mockResolvedValue({
      id: homeTenantId,
      tenant_code: 'AXERRA',
      schema_name: 'axerra',
    });

    // 1) home binding, 2) requested tenant lookup → none
    mockOneOrNone
      .mockResolvedValueOnce({
        id: 'binding-1',
        portal_user_id: userId,
        tenant_id: homeTenantId,
        entity_type: 'employee',
        entity_id: 'emp-1',
        status: 'active',
      })
      .mockResolvedValueOnce(null);

    const req = makeReq({
      cookies: { auth_token: token },
      headers: { 'x-tenant-code': 'NOPE' },
    });
    const res = makeRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unknown tenant_code: nope' });
    expect(next).not.toHaveBeenCalled();
  });
});
