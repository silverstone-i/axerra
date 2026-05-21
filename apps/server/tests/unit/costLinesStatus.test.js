/**
 * @file Unit test guarding the cost_lines status workflow
 * @module tests/unit/costLinesStatus
 *
 * Pins the schema CHECK list and the controller's VALID_TRANSITIONS map to a
 * single source-of-truth set: { draft, locked, change_order }. Prevents the
 * regression where the CHECK allowed states the controller never wrote (and
 * forbade the state the controller actually wrote — gap 1.12 / 3.5).
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = resolve(__dirname, '../../src/modules/activities/schemas/costLinesSchema.js');
const CONTROLLER_PATH = resolve(__dirname, '../../src/modules/activities/controllers/costLinesController.js');

const EXPECTED_STATES = new Set(['draft', 'locked', 'change_order']);

function extractCheckStates(schemaSource) {
  const m = schemaSource.match(/columns:\s*\['status'\][^}]*expression:\s*"status IN \(([^)]+)\)"/);
  if (!m) throw new Error('Could not locate status CHECK in costLinesSchema.js');
  return new Set(m[1].split(',').map((s) => s.trim().replace(/^'|'$/g, '')));
}

function extractTransitionStates(controllerSource) {
  const m = controllerSource.match(/VALID_TRANSITIONS\s*=\s*\{([\s\S]*?)\};/);
  if (!m) throw new Error('Could not locate VALID_TRANSITIONS in costLinesController.js');
  const keys = [...m[1].matchAll(/(\w+):\s*\[/g)].map((x) => x[1]);
  const values = [...m[1].matchAll(/\[([^\]]*)\]/g)]
    .flatMap((x) => x[1].split(','))
    .map((s) => s.trim().replace(/^'|'$/g, ''))
    .filter(Boolean);
  return new Set([...keys, ...values]);
}

describe('cost_lines status workflow', () => {
  const schemaSrc = readFileSync(SCHEMA_PATH, 'utf8');
  const controllerSrc = readFileSync(CONTROLLER_PATH, 'utf8');

  it('schema CHECK enumerates exactly draft / locked / change_order', () => {
    const states = extractCheckStates(schemaSrc);
    expect(states).toEqual(EXPECTED_STATES);
  });

  it('controller VALID_TRANSITIONS uses only states allowed by the schema', () => {
    const states = extractTransitionStates(controllerSrc);
    for (const s of states) {
      expect(EXPECTED_STATES.has(s)).toBe(true);
    }
  });
});
