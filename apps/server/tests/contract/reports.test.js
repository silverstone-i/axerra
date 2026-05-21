/**
 * @file Contract tests — Reports module API shape verification
 * @module tests/contract/reports
 *
 * Verifies that all report endpoints exist and respond with correct status codes/shapes.
 * Uses mocked DB/Redis (no real database required).
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import bcrypt from 'bcrypt';

// Set env
process.env.ACCESS_TOKEN_SECRET = 'test-access-secret-rpt';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-rpt';
process.env.NODE_ENV = 'test';
process.env.ROOT_TENANT_CODE = 'AXERRA';
process.env.COOKIE_SECURE = 'false';
process.env.BCRYPT_ROUNDS = '4';

const testPasswordHash = await bcrypt.hash('TestPassword123!', 4);
const mockUser = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  email: 'admin@axerra.io',
  password_hash: testPasswordHash,
  tenant_code: 'AXERRA',
  tenant_id: '660e8400-e29b-41d4-a716-446655440001',
  role: 'super_user',
  status: 'active',
  deactivated_at: null,
};

const mockTenant = {
  id: '660e8400-e29b-41d4-a716-446655440001',
  tenant_code: 'AXERRA',
  company: 'Axerra',
  schema_name: 'axerra',
  status: 'active',
  deactivated_at: null,
  allowed_modules: [],
};

// Mock Redis
vi.mock('../../src/db/redis.js', () => ({
  getRedis: vi.fn().mockResolvedValue({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
  }),
  closeRedis: vi.fn(),
}));

// Mock provisioning
vi.mock('../../src/services/tenantProvisioning.js', () => ({
  provisionTenant: vi.fn().mockResolvedValue({ applied: [] }),
}));

// Mock permission loader. `loadPermissions` must return a canon with
// non-empty `caps` so the Phase-3 login gate doesn't reject the mock
// user. `primePermCache` is a no-op in this test (no real Redis).
vi.mock('../../src/services/permissionLoader.js', () => ({
  loadPermissions: vi.fn().mockResolvedValue({
    caps: { 'reports::reports::view': 'full' },
    scope: 'all_projects',
    projectIds: null,
    companyIds: null,
    entityType: null,
    entityId: null,
    stateFilters: {},
    fieldGroups: {},
  }),
  primePermCache: vi.fn().mockResolvedValue(undefined),
  permCacheKey: (uid, tenantCode) => `perm:${uid}:${tenantCode}`,
  PERM_CACHE_TTL_SECONDS: 900,
}));

// Mock DB
vi.mock('../../src/db/db.js', () => {
  const handler = {
    findOneBy: vi.fn(async (conds) => {
      const c = conds[0];
      if (c.email === mockUser.email || c.id === mockUser.id) return mockUser;
      if (c.tenant_code === 'AXERRA') return mockTenant;
      return null;
    }),
    findById: vi.fn(async (id) => {
      if (id === mockTenant.id) return mockTenant;
      if (id === mockUser.id) return mockUser;
      return null;
    }),
    findAfterCursor: vi.fn(async () => ({ data: [], hasMore: false })),
    findWhere: vi.fn(async () => []),
    countWhere: vi.fn(async () => 0),
    insert: vi.fn(async (data) => ({ id: `new-${Date.now()}`, ...data })),
    updateWhere: vi.fn(async () => 1),
    bulkInsert: vi.fn(async (data) => data),
  };

  const model = { setSchemaName: vi.fn().mockReturnValue(handler) };

  const dbProxy = (_name, _schema) => model.setSchemaName(_schema);

  const modelNames = [
    'tenants', 'portalUsers', 'roles', 'roleMembers', 'policies', 'policyCatalog',
    'portalUserPhones', 'portalUserAddresses',
    'projects', 'units', 'tasks', 'taskGroups', 'tasksMaster',
    'costItems', 'changeOrders',
    'templateUnits', 'templateTasks', 'templateCostItems', 'templateChangeOrders',
    'categories', 'activities', 'deliverables', 'deliverableAssignments',
    'budgets', 'costLines', 'actualCosts', 'vendorParts',
    'catalogSkus', 'vendorSkus', 'vendorPricing',
    'apInvoices', 'apInvoiceLines', 'payments', 'apCreditMemos',
    'arInvoices', 'arInvoiceLines', 'receipts',
    'chartOfAccounts', 'journalEntries', 'journalEntryLines',
    'ledgerBalances', 'postingQueues', 'categoryAccountMap',
    'companyAccounts', 'companyTransactions', 'internalTransfers',
  ];
  for (const name of modelNames) {
    dbProxy[name] = model;
  }
  dbProxy.none = vi.fn();
  dbProxy.result = vi.fn(async () => ({ rowCount: 1 }));
  dbProxy.manyOrNone = vi.fn(async () => []);
  // Catch-all for raw SQL lookups across login + authRedis. Passport's
  // login query SELECTs t.* from a tenants/portal_user_tenants join;
  // authRedis queries portal_user_tenants for home + matched bindings,
  // and admin.tenants for the x-tenant-code lookup.
  dbProxy.oneOrNone = vi.fn(async (sql) => {
    if (typeof sql !== 'string') return null;
    if (sql.includes('portal_user_tenants') && sql.includes('admin.tenants')) {
      // passport's login JOIN returning a full tenant row
      return mockTenant;
    }
    if (sql.includes('portal_user_tenants')) {
      // authRedis home binding lookup
      return {
        id: 'binding-1',
        portal_user_id: mockUser.id,
        tenant_id: mockTenant.id,
        entity_type: 'employee',
        entity_id: '880e8400-e29b-41d4-a716-446655440000',
        status: 'active',
      };
    }
    if (sql.includes('admin.tenants')) {
      return mockTenant;
    }
    return null;
  });
  dbProxy.tx = vi.fn(async (fn) => {
    const t = {
      one: vi.fn(async () => ({ id: 'tx-entry' })),
      none: vi.fn(),
      manyOrNone: vi.fn(async () => []),
      oneOrNone: vi.fn(async () => null),
    };
    return fn(t);
  });
  const pgpMock = { as: { name: (val) => `"${val}"` } };
  return { default: dbProxy, db: dbProxy, pgp: pgpMock };
});

let request;

beforeAll(async () => {
  const supertest = await import('supertest');
  const { default: app } = await import('../../src/app.js');
  request = supertest.default(app);
});

async function getAuthCookies() {
  const res = await request.post('/api/auth/login').send({ email: 'admin@axerra.io', password: 'TestPassword123!' });
  return res.headers['set-cookie'];
}

describe('Reports Routes Contract', () => {
  describe('Ping route', () => {
    it('GET /api/reports/v1/ping returns pong', async () => {
      const cookies = await getAuthCookies();
      const res = await request.get('/api/reports/v1/ping').set('Cookie', cookies).set('x-tenant-code', 'AXERRA');
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('pong');
    });
  });

  describe('Profitability endpoints', () => {
    it('GET /api/reports/v1/project-profitability returns array', async () => {
      const cookies = await getAuthCookies();
      const res = await request.get('/api/reports/v1/project-profitability').set('Cookie', cookies).set('x-tenant-code', 'AXERRA');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /api/reports/v1/project-profitability/:projectId returns 404 for missing project', async () => {
      const cookies = await getAuthCookies();
      const res = await request.get('/api/reports/v1/project-profitability/missing-id').set('Cookie', cookies).set('x-tenant-code', 'AXERRA');
      expect(res.status).toBe(404);
      expect(res.body.error).toContain('Project not found');
    });
  });

  describe('Cashflow endpoints', () => {
    it('GET /api/reports/v1/project-cashflow/:projectId returns 404 for missing data', async () => {
      const cookies = await getAuthCookies();
      const res = await request.get('/api/reports/v1/project-cashflow/missing-id').set('Cookie', cookies).set('x-tenant-code', 'AXERRA');
      expect(res.status).toBe(404);
      expect(res.body.error).toContain('No cashflow data');
    });

    it('GET /api/reports/v1/project-cashflow/:projectId/forecast returns forecast shape', async () => {
      const cookies = await getAuthCookies();
      const res = await request.get('/api/reports/v1/project-cashflow/some-id/forecast').set('Cookie', cookies).set('x-tenant-code', 'AXERRA');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('expected_inflows');
      expect(res.body).toHaveProperty('expected_outflows');
      expect(res.body).toHaveProperty('monthly_burn_rate');
    });
  });

  describe('Cost breakdown endpoints', () => {
    it('GET /api/reports/v1/project-cost-breakdown/:projectId returns 404 for missing data', async () => {
      const cookies = await getAuthCookies();
      const res = await request.get('/api/reports/v1/project-cost-breakdown/missing-id').set('Cookie', cookies).set('x-tenant-code', 'AXERRA');
      expect(res.status).toBe(404);
      expect(res.body.error).toContain('No cost data');
    });
  });

  describe('AR aging endpoints', () => {
    it('GET /api/reports/v1/ar-aging returns array', async () => {
      const cookies = await getAuthCookies();
      const res = await request.get('/api/reports/v1/ar-aging').set('Cookie', cookies).set('x-tenant-code', 'AXERRA');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /api/reports/v1/ar-aging/:clientId returns 404 for missing client', async () => {
      const cookies = await getAuthCookies();
      const res = await request.get('/api/reports/v1/ar-aging/missing-id').set('Cookie', cookies).set('x-tenant-code', 'AXERRA');
      expect(res.status).toBe(404);
      expect(res.body.error).toContain('Client not found');
    });
  });

  describe('AP aging endpoints', () => {
    it('GET /api/reports/v1/ap-aging returns array', async () => {
      const cookies = await getAuthCookies();
      const res = await request.get('/api/reports/v1/ap-aging').set('Cookie', cookies).set('x-tenant-code', 'AXERRA');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /api/reports/v1/ap-aging/:vendorId returns 404 for missing vendor', async () => {
      const cookies = await getAuthCookies();
      const res = await request.get('/api/reports/v1/ap-aging/missing-id').set('Cookie', cookies).set('x-tenant-code', 'AXERRA');
      expect(res.status).toBe(404);
      expect(res.body.error).toContain('Vendor not found');
    });
  });

  describe('Company cashflow endpoint', () => {
    it('GET /api/reports/v1/company-cashflow returns array', async () => {
      const cookies = await getAuthCookies();
      const res = await request.get('/api/reports/v1/company-cashflow').set('Cookie', cookies).set('x-tenant-code', 'AXERRA');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('Margin analysis endpoint', () => {
    it('GET /api/reports/v1/margin-analysis returns array', async () => {
      const cookies = await getAuthCookies();
      const res = await request.get('/api/reports/v1/margin-analysis').set('Cookie', cookies).set('x-tenant-code', 'AXERRA');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /api/reports/v1/margin-analysis rejects invalid sort column', async () => {
      const cookies = await getAuthCookies();
      const res = await request.get('/api/reports/v1/margin-analysis?sortBy=DROP_TABLE').set('Cookie', cookies).set('x-tenant-code', 'AXERRA');
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid sort column');
    });

    it('GET /api/reports/v1/margin-analysis accepts valid sort column', async () => {
      const cookies = await getAuthCookies();
      const res = await request.get('/api/reports/v1/margin-analysis?sortBy=gross_profit&sortDir=ASC').set('Cookie', cookies).set('x-tenant-code', 'AXERRA');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('POST methods are not available', () => {
    it('POST /api/reports/v1/project-profitability returns 404', async () => {
      const cookies = await getAuthCookies();
      const res = await request.post('/api/reports/v1/project-profitability').set('Cookie', cookies).set('x-tenant-code', 'AXERRA').send({});
      expect(res.status).toBe(404);
    });
  });
});
