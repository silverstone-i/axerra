/**
 * @file Unit tests for spreadsheetHelpers (getEnumColumns, validateChildEnums)
 * @module tests/unit/spreadsheetHelpers
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import { describe, it, expect } from 'vitest';
import { WorkbookBuilder, WorkbookReader, writeXlsx } from '@nap-sft/tablsx';
import { getEnumColumns, validateChildEnums, buildChildSheet, curateRows, parseSheet } from '../../src/lib/spreadsheetHelpers.js';

describe('getEnumColumns', () => {
  it('extracts enum values from a CHECK IN (...) constraint', () => {
    const schema = {
      constraints: {
        checks: [
          { columns: ['phone_type'], expression: "phone_type IN ('cell', 'work', 'home')" },
        ],
      },
    };
    const map = getEnumColumns(schema);
    expect(map.size).toBe(1);
    expect([...map.get('phone_type')]).toEqual(['cell', 'work', 'home']);
  });

  it('returns multiple enum columns when several CHECKs exist', () => {
    const schema = {
      constraints: {
        checks: [
          { columns: ['phone_type'], expression: "phone_type IN ('cell', 'work')" },
          { columns: ['status'], expression: "status IN ('active', 'archived')" },
        ],
      },
    };
    const map = getEnumColumns(schema);
    expect(map.size).toBe(2);
    expect(map.get('status').has('active')).toBe(true);
  });

  it('skips checks without an IN clause', () => {
    const schema = {
      constraints: {
        checks: [{ columns: ['amount'], expression: 'amount > 0' }],
      },
    };
    expect(getEnumColumns(schema).size).toBe(0);
  });

  it('returns an empty map when no checks exist', () => {
    expect(getEnumColumns({}).size).toBe(0);
    expect(getEnumColumns({ constraints: {} }).size).toBe(0);
    expect(getEnumColumns(undefined).size).toBe(0);
  });
});

describe('validateChildEnums', () => {
  const phoneEnumMap = new Map([['phone_type', new Set(['cell', 'work', 'home'])]]);
  const phoneFlatColByCol = new Map([['phone_type', 'phone_type']]);

  const baseChildEnums = [
    { key: 'phones', enumMap: phoneEnumMap, flatColByCol: phoneFlatColByCol },
  ];

  it('returns no errors when all enum values are valid', () => {
    const groups = [
      {
        parent: { _rowNum: 2 },
        children: { phones: [{ phone_type: 'cell', _rowNum: 2 }, { phone_type: 'work', _rowNum: 3 }] },
      },
    ];
    expect(validateChildEnums(groups, { sheetName: 'Vendors', childEnums: baseChildEnums })).toEqual([]);
  });

  it('normalizes case and whitespace before comparing', () => {
    const groups = [
      { parent: {}, children: { phones: [{ phone_type: '  CELL  ', _rowNum: 5 }] } },
    ];
    expect(validateChildEnums(groups, { sheetName: 'Vendors', childEnums: baseChildEnums })).toEqual([]);
  });

  it('returns an error for an invalid enum value with the flat column name', () => {
    const groups = [
      { parent: {}, children: { phones: [{ phone_type: 'mobile', _rowNum: 7 }] } },
    ];
    const errors = validateChildEnums(groups, {
      sheetName: 'Vendors',
      childEnums: [
        {
          key: 'phones',
          enumMap: phoneEnumMap,
          flatColByCol: new Map([['phone_type', 'phone_type']]),
        },
      ],
    });
    expect(errors).toEqual([
      {
        sheet: 'Vendors',
        row: 7,
        column: 'phone_type',
        value: 'mobile',
        message: 'Invalid value — must be one of: cell, work, home',
      },
    ]);
  });

  it('falls back to colName when flatColByCol is missing or omits the column', () => {
    const groups = [
      { parent: {}, children: { phones: [{ phone_type: 'mobile', _rowNum: 4 }] } },
    ];
    const errors = validateChildEnums(groups, {
      sheetName: 'Vendors',
      childEnums: [{ key: 'phones', enumMap: phoneEnumMap }],
    });
    expect(errors[0].column).toBe('phone_type');
  });

  it('skips empty, null, and undefined values without erroring', () => {
    const groups = [
      {
        parent: {},
        children: {
          phones: [
            { phone_type: '', _rowNum: 2 },
            { phone_type: null, _rowNum: 3 },
            { phone_type: undefined, _rowNum: 4 },
          ],
        },
      },
    ];
    expect(validateChildEnums(groups, { sheetName: 'Vendors', childEnums: baseChildEnums })).toEqual([]);
  });

  it('returns no errors when childEnums is empty or omitted', () => {
    const groups = [{ parent: {}, children: { phones: [{ phone_type: 'mobile' }] } }];
    expect(validateChildEnums(groups, { sheetName: 'Vendors', childEnums: [] })).toEqual([]);
    expect(validateChildEnums(groups, { sheetName: 'Vendors' })).toEqual([]);
  });

  it('skips child configs whose enumMap is empty', () => {
    const groups = [{ parent: {}, children: { phones: [{ phone_type: 'mobile', _rowNum: 9 }] } }];
    const errors = validateChildEnums(groups, {
      sheetName: 'Vendors',
      childEnums: [{ key: 'phones', enumMap: new Map(), flatColByCol: phoneFlatColByCol }],
    });
    expect(errors).toEqual([]);
  });

  it('emits one error per offending row across multiple groups', () => {
    const groups = [
      { parent: {}, children: { phones: [{ phone_type: 'mobile', _rowNum: 2 }, { phone_type: 'cell', _rowNum: 3 }] } },
      { parent: {}, children: { phones: [{ phone_type: 'pager', _rowNum: 8 }] } },
    ];
    const errors = validateChildEnums(groups, { sheetName: 'Vendors', childEnums: baseChildEnums });
    expect(errors).toHaveLength(2);
    expect(errors.map((e) => e.row)).toEqual([2, 8]);
    expect(errors.map((e) => e.value)).toEqual(['mobile', 'pager']);
  });

  it('handles groups missing the child key entirely', () => {
    const groups = [{ parent: {}, children: {} }, { parent: {} }];
    expect(validateChildEnums(groups, { sheetName: 'Vendors', childEnums: baseChildEnums })).toEqual([]);
  });
});

describe('curateRows', () => {
  it('keeps `id` by default so exports support UUID round-trip', () => {
    const rows = [
      {
        id: '11111111-1111-1111-1111-111111111111',
        tenant_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        source_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        created_at: '2025-01-01',
        created_by: 'x',
        updated_at: '2025-01-02',
        updated_by: 'y',
        deactivated_at: null,
        email: 'a@b.com',
      },
    ];
    const out = curateRows(rows);
    expect(out).toEqual([{ id: '11111111-1111-1111-1111-111111111111', email: 'a@b.com' }]);
  });
});

describe('buildChildSheet (UUID round-trip)', () => {
  const PARENT_ID = '22222222-2222-2222-2222-222222222222';
  const SOURCE_ID = '33333333-3333-3333-3333-333333333333';
  const CHILD_ID_1 = '44444444-4444-4444-4444-444444444444';
  const CHILD_ID_2 = '55555555-5555-5555-5555-555555555555';

  function makeStubModel(rows) {
    return {
      findWhere: async () => rows,
    };
  }

  it('exports the child UUID column so re-import can match on id', async () => {
    const model = makeStubModel([
      {
        id: CHILD_ID_1,
        tenant_id: 'tid',
        source_id: SOURCE_ID,
        email: 'a@b.com',
        label: 'work',
        is_primary: true,
        is_login: false,
        created_at: 'x',
        created_by: 'x',
        updated_at: 'x',
        updated_by: 'x',
        deactivated_at: null,
      },
      {
        id: CHILD_ID_2,
        tenant_id: 'tid',
        source_id: SOURCE_ID,
        email: 'c@d.com',
        label: 'home',
        is_primary: false,
        is_login: false,
      },
    ]);

    const wb = WorkbookBuilder.create();
    const idBySource = new Map([[SOURCE_ID, PARENT_ID]]);
    await buildChildSheet(wb, 'Emails', model, [SOURCE_ID], idBySource, 'employee_id', ['email', 'label', 'is_primary', 'is_login']);

    const reader = WorkbookReader.fromBuffer(writeXlsx(wb.build()));
    const sheetIdx = reader.sheetNames.indexOf('Emails');
    const parsed = parseSheet(reader, sheetIdx);

    expect(parsed.length).toBe(2);
    expect(Object.keys(parsed[0])).toContain('id');
    expect(Object.keys(parsed[0])).toContain('employee_id');
    // Round-trip preserves the child UUID
    const ids = parsed.map((r) => r.id).sort();
    expect(ids).toEqual([CHILD_ID_1, CHILD_ID_2].sort());
    // Linkage column is the parent UUID
    expect(parsed[0].employee_id).toBe(PARENT_ID);
    // Internal columns stripped
    for (const r of parsed) {
      expect(r.tenant_id).toBeUndefined();
      expect(r.source_id).toBeUndefined();
      expect(r.created_at).toBeUndefined();
      expect(r.updated_by).toBeUndefined();
      expect(r.deactivated_at).toBeUndefined();
    }
  });

  it('emits an `id` column header even when no rows exist', async () => {
    const model = makeStubModel([]);
    const wb = WorkbookBuilder.create();
    await buildChildSheet(wb, 'Emails', model, [SOURCE_ID], new Map(), 'employee_id', ['email', 'label']);

    const reader = WorkbookReader.fromBuffer(writeXlsx(wb.build()));
    const sheetIdx = reader.sheetNames.indexOf('Emails');
    const sheet = reader.sheet(sheetIdx);
    const headers = sheet.getRow(0).map((c) => c.value);
    expect(headers).toEqual(['employee_id', 'id', 'email', 'label']);
  });
});
