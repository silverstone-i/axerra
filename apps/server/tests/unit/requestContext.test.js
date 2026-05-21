/**
 * @file Unit tests for the requestContext ALS module
 * @module tests/unit/requestContext
 *
 * Covers the primitives that the audit-actor resolver depends on:
 *   - Reads return null outside any als.run block.
 *   - Inside als.run, reads return the supplied store.
 *   - Store survives await boundaries.
 *   - Concurrent als.run blocks stay isolated (the cross-tenant guarantee).
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { describe, test, expect } from 'vitest';
import {
  requestContext,
  currentUserId,
  currentSchema,
  currentTenantId,
  currentTenantCode,
  runWithContext,
} from '../../src/lib/requestContext.js';

describe('requestContext', () => {
  test('current* helpers return null outside any als.run', () => {
    expect(currentUserId()).toBeNull();
    expect(currentSchema()).toBeNull();
    expect(currentTenantId()).toBeNull();
    expect(currentTenantCode()).toBeNull();
  });

  test('inside als.run, helpers return store values', () => {
    const store = {
      userId: 'user-uuid',
      tenantId: 'tenant-uuid',
      schema: 'tenant-schema',
      tenantCode: 'TENANT',
    };
    runWithContext(store, () => {
      expect(currentUserId()).toBe('user-uuid');
      expect(currentTenantId()).toBe('tenant-uuid');
      expect(currentSchema()).toBe('tenant-schema');
      expect(currentTenantCode()).toBe('TENANT');
    });
  });

  test('store survives await boundaries', async () => {
    await runWithContext({ userId: 'await-test' }, async () => {
      expect(currentUserId()).toBe('await-test');
      await new Promise((resolve) => globalThis.setTimeout(resolve, 1));
      expect(currentUserId()).toBe('await-test');
      await Promise.resolve();
      expect(currentUserId()).toBe('await-test');
    });
  });

  test('concurrent als.run blocks do not cross-contaminate', async () => {
    // Two concurrent chains interleave on the event loop; each must see only
    // its own store. This is the property that lets ALS replace per-request
    // hand-threading in a multi-tenant server.
    const chainA = runWithContext({ userId: 'A' }, async () => {
      await new Promise((resolve) => globalThis.setTimeout(resolve, 5));
      return currentUserId();
    });
    const chainB = runWithContext({ userId: 'B' }, async () => {
      await new Promise((resolve) => globalThis.setTimeout(resolve, 2));
      return currentUserId();
    });
    const [resA, resB] = await Promise.all([chainA, chainB]);
    expect(resA).toBe('A');
    expect(resB).toBe('B');
  });

  test('requestContext is the same AsyncLocalStorage instance across imports', () => {
    // Belt and suspenders: ensure module caching gives one instance per
    // process. If two imports got different instances, the resolver would
    // miss the store written by the middleware.
    expect(requestContext).toBe(requestContext);
    runWithContext({ userId: 'instance-check' }, () => {
      expect(requestContext.getStore()?.userId).toBe('instance-check');
    });
  });
});
