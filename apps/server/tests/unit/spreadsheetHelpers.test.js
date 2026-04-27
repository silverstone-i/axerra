/**
 * @file Unit tests for spreadsheetHelpers (getEnumColumns, validateChildEnums)
 * @module tests/unit/spreadsheetHelpers
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import { describe, it, expect } from 'vitest';
import { getEnumColumns, validateChildEnums } from '../../src/lib/spreadsheetHelpers.js';

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
