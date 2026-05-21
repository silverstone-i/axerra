/**
 * @file Unit tests for addAuditFields middleware
 * @module tests/unit/addAuditFields
 *
 * Post-ALS, the middleware only injects tenant_code / tenant_id from req.user
 * and guards against missing user context. created_by / updated_by are filled
 * by pg-schemata's ambient audit resolver (see lib/registerAuditResolver.js).
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { describe, it, expect, vi } from 'vitest';
import { addAuditFields } from '../../src/middleware/addAuditFields.js';

describe('addAuditFields', () => {
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

  it('injects tenant_code on POST and does not set created_by', () => {
    const req = {
      method: 'POST',
      user: { id: 'uuid-123', tenant_code: 'axerra' },
      body: { name: 'test' },
      originalUrl: '/api/core/v1/roles',
    };
    const res = makeRes();
    const next = vi.fn();

    addAuditFields(req, res, next);

    expect(req.body.tenant_code).toBe('axerra');
    expect(req.body.created_by).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
  });

  it('injects tenant_id on POST when present on req.user', () => {
    const req = {
      method: 'POST',
      user: { id: 'uuid-123', tenant_code: 'axerra', tenant_id: 'tid-1' },
      body: { name: 'test' },
      originalUrl: '/api/core/v1/roles',
    };
    const res = makeRes();
    const next = vi.fn();

    addAuditFields(req, res, next);

    expect(req.body.tenant_id).toBe('tid-1');
  });

  it('does not touch req.body on PUT (audit fields handled by resolver)', () => {
    const req = {
      method: 'PUT',
      user: { id: 'uuid-456', tenant_code: 'axerra' },
      body: { name: 'updated' },
      originalUrl: '/api/core/v1/roles/update',
    };
    const res = makeRes();
    const next = vi.fn();

    addAuditFields(req, res, next);

    expect(req.body.updated_by).toBeUndefined();
    expect(req.body.created_by).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
  });

  it('does not touch req.body on DELETE', () => {
    const req = {
      method: 'DELETE',
      user: { id: 'uuid-789', tenant_code: 'axerra' },
      body: {},
      originalUrl: '/api/core/v1/roles/archive',
    };
    const res = makeRes();
    const next = vi.fn();

    addAuditFields(req, res, next);

    expect(req.body.updated_by).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
  });

  it('injects tenant_code on each element of array bodies (bulk POST)', () => {
    const req = {
      method: 'POST',
      user: { id: 'uuid-bulk', tenant_code: 'acme' },
      body: [{ name: 'a' }, { name: 'b' }],
      originalUrl: '/api/core/v1/roles/bulk-insert',
    };
    const res = makeRes();
    const next = vi.fn();

    addAuditFields(req, res, next);

    expect(req.body[0].tenant_code).toBe('acme');
    expect(req.body[1].tenant_code).toBe('acme');
    expect(req.body[0].created_by).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
  });

  it('returns 400 when no user context', () => {
    const req = { method: 'POST', user: null, body: {}, originalUrl: '/test' };
    const res = makeRes();
    const next = vi.fn();

    addAuditFields(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
  });

  it('preserves caller-supplied tenant_code on tenant creation path', () => {
    const req = {
      method: 'POST',
      user: { id: 'uuid-123', tenant_code: 'axerra' },
      body: { tenant_code: 'acme', company: 'Acme Inc' },
      originalUrl: '/api/tenants/v1/tenants',
    };
    const res = makeRes();
    const next = vi.fn();

    addAuditFields(req, res, next);

    expect(req.body.tenant_code).toBe('acme');
    expect(req.body.created_by).toBeUndefined();
  });
});
