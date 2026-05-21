/**
 * @file RBAC tests for system role definitions
 * @module tests/rbac/systemRoles
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger
vi.mock('../../src/lib/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { seedSystemRoles } = await import('../../src/system/core/services/systemRoleSeeder.js');

describe('System Role Seeding', () => {
  let mockDb;
  let mockPgp;
  let insertedRoles;
  let insertedPolicies;

  beforeEach(() => {
    insertedRoles = [];
    insertedPolicies = [];

    mockDb = {
      oneOrNone: vi.fn().mockResolvedValue(null), // Nothing exists yet
      one: vi.fn().mockImplementation(async (_sql, params) => {
        const role = { id: `role-${params[1]}` };
        insertedRoles.push({ ...role, code: params[1], scope: params[6] });
        return role;
      }),
      none: vi.fn().mockImplementation(async (_sql, params) => {
        insertedPolicies.push({
          role_id: params[1],
          module: params[2],
          router: params[3],
          action: params[4],
          level: params[5],
        });
      }),
    };

    mockPgp = {
      as: {
        name: vi.fn((s) => `"${s}"`),
      },
    };
  });

  it('seeds admin role for all tenants', async () => {
    await seedSystemRoles(mockDb, mockPgp, 'acme', 'ACME', false);

    const admin = insertedRoles.find((r) => r.code === 'admin');
    expect(admin).toBeDefined();
    expect(admin.scope).toBe('all_projects');
  });

  it('does NOT seed super_user or support for non-Axerra tenants', async () => {
    await seedSystemRoles(mockDb, mockPgp, 'acme', 'ACME', false);

    expect(insertedRoles.find((r) => r.code === 'super_user')).toBeUndefined();
    expect(insertedRoles.find((r) => r.code === 'support')).toBeUndefined();
  });

  it('seeds super_user, admin, and support for Axerra tenant', async () => {
    await seedSystemRoles(mockDb, mockPgp, 'axerra', 'AXERRA', true);

    expect(insertedRoles.find((r) => r.code === 'super_user')).toBeDefined();
    expect(insertedRoles.find((r) => r.code === 'admin')).toBeDefined();
    expect(insertedRoles.find((r) => r.code === 'support')).toBeDefined();
  });

  it('super_user gets full access policy for all modules', async () => {
    await seedSystemRoles(mockDb, mockPgp, 'axerra', 'AXERRA', true);

    const superPolicies = insertedPolicies.filter((p) => p.role_id === 'role-super_user');
    expect(superPolicies.some((p) => p.module === '' && p.level === 'full')).toBe(true);
  });

  it('support gets none for financial modules', async () => {
    await seedSystemRoles(mockDb, mockPgp, 'axerra', 'AXERRA', true);

    const supportPolicies = insertedPolicies.filter((p) => p.role_id === 'role-support');
    const financialDenied = supportPolicies.filter(
      (p) => ['accounting', 'ap', 'ar'].includes(p.module) && p.level === 'none',
    );
    expect(financialDenied.length).toBe(3);
  });

  it('support does NOT receive explicit financial-module exact-match grants', async () => {
    // Regression guard: exact-match keys short-circuit the broader-grant
    // fallback in rbac.resolveLevel(), so an explicit ap::*::export=full
    // would override the module-level ap=none deny. Support's policies
    // must NOT include any financial-module router-action rows.
    await seedSystemRoles(mockDb, mockPgp, 'axerra', 'AXERRA', true);

    const supportPolicies = insertedPolicies.filter((p) => p.role_id === 'role-support');
    const leaks = supportPolicies.filter(
      (p) => ['accounting', 'ap', 'ar'].includes(p.module) && p.router && p.action,
    );
    expect(leaks).toEqual([]);
  });

  it('super_user DOES receive financial-module exact-match grants (full platform access)', async () => {
    // super_user has no financial deny, so exact-match grants are correct.
    await seedSystemRoles(mockDb, mockPgp, 'axerra', 'AXERRA', true);

    const superPolicies = insertedPolicies.filter((p) => p.role_id === 'role-super_user');
    const apExport = superPolicies.find(
      (p) => p.module === 'ap' && p.router === 'ap-invoices' && p.action === 'export',
    );
    expect(apExport).toBeDefined();
    expect(apExport.level).toBe('full');
  });

  it('is idempotent — skips existing roles', async () => {
    // Simulate role already existing
    mockDb.oneOrNone.mockResolvedValue({ id: 'existing-role-id' });

    await seedSystemRoles(mockDb, mockPgp, 'acme', 'ACME', false);

    // Should not insert any roles (only check policies)
    expect(mockDb.one).not.toHaveBeenCalled();
  });

  it('system roles use correct scopes', async () => {
    await seedSystemRoles(mockDb, mockPgp, 'axerra', 'AXERRA', true);

    for (const role of insertedRoles) {
      if (role.code === 'vendor_contact' || role.code === 'client') {
        expect(role.scope).toBe('self');
      } else {
        expect(role.scope).toBe('all_projects');
      }
    }
  });
});
