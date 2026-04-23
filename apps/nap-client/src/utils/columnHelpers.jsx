/**
 * @file DataGrid column definition helpers — reduce repeated renderCell / valueGetter boilerplate
 * @module nap-client/utils/columnHelpers
 *
 * Each helper returns a partial column definition object that can be spread
 * or merged with additional overrides (width, flex, etc.).
 *
 * Copyright (c) 2025 – present Vimber LLC. All rights reserved.
 */

import StatusBadge from '../components/shared/StatusBadge.jsx';
import CurrencyCell from '../components/shared/CurrencyCell.jsx';
import { fmtDate, cap, capSnake } from './format.js';

/**
 * Status badge column — renders a StatusBadge chip.
 *
 * @param {string}  field       Column field name (default: 'status')
 * @param {string}  headerName  Column header (default: 'Status')
 * @param {object}  [overrides] Additional column props (width, etc.)
 *
 * Handles two common patterns:
 *   statusColumn()                              → renders params.row.status directly
 *   statusColumn('is_active', 'Active', { map: (v) => v ? 'active' : 'suspended' })
 *     → maps the raw value through the function before passing to StatusBadge
 */
export function statusColumn(field = 'status', headerName = 'Status', overrides = {}) {
  const { map, hideEmpty, ...rest } = overrides;
  return {
    field,
    headerName,
    width: 120,
    renderCell: ({ value }) => {
      const display = map ? map(value) : value;
      if (hideEmpty && !display) return null;
      return <StatusBadge status={display} />;
    },
    ...rest,
  };
}

/**
 * Date column — formats a date field via fmtDate.
 *
 * @param {string}  field       Column field name
 * @param {string}  headerName  Column header
 * @param {object}  [overrides] Additional column props
 */
export function dateColumn(field, headerName, overrides = {}) {
  return {
    field,
    headerName,
    width: 120,
    valueGetter: (params) => fmtDate(params.row[field]),
    ...overrides,
  };
}

/**
 * Map-lookup column — resolves an ID to a display label via a Map or object.
 *
 * @param {string}       field       Column field name
 * @param {string}       headerName  Column header
 * @param {Map|object}   lookup      Map or plain object for id→label resolution
 * @param {object}       [overrides] Additional column props
 */
export function lookupColumn(field, headerName, lookup, overrides = {}) {
  const get = lookup instanceof Map
    ? (id) => lookup.get(id)
    : (id) => lookup[id];
  return {
    field,
    headerName,
    width: 160,
    valueGetter: (params) => get(params.row[field]) || '\u2014',
    ...overrides,
  };
}

/**
 * Currency column — renders a CurrencyCell.
 *
 * @param {string}  field       Column field name
 * @param {string}  headerName  Column header
 * @param {object}  [overrides] Additional column props (e.g. { variance: true })
 */
export function currencyColumn(field, headerName, overrides = {}) {
  const { variance, ...rest } = overrides;
  return {
    field,
    headerName,
    width: 140,
    renderCell: (params) => <CurrencyCell value={params.value} variance={variance} />,
    ...rest,
  };
}

/**
 * Boolean column — displays Yes/No text.
 *
 * @param {string}  field       Column field name
 * @param {string}  headerName  Column header
 * @param {object}  [overrides] Additional column props
 */
export function boolColumn(field, headerName, overrides = {}) {
  return {
    field,
    headerName,
    width: 100,
    valueGetter: (params) => (params.row[field] ? 'Yes' : 'No'),
    ...overrides,
  };
}

/**
 * Capitalized column — formats a snake_case or lowercase value via cap or capSnake.
 *
 * @param {string}  field       Column field name
 * @param {string}  headerName  Column header
 * @param {object}  [overrides] Additional column props; set { snake: true } for capSnake
 */
export function capColumn(field, headerName, overrides = {}) {
  const { snake, ...rest } = overrides;
  const fmt = snake ? capSnake : cap;
  return {
    field,
    headerName,
    width: 120,
    valueGetter: (params) => fmt(params.row[field] || '') || '\u2014',
    ...rest,
  };
}
