#!/usr/bin/env node
/**
 * @file CI guard: code changes under a module must touch the module's rules file.
 * @module scripts/checkDocCoverage
 *
 * Compares the current branch against `BASE_REF` (default `origin/main`) and
 * fails when any changed file under a tracked module directory has no
 * corresponding `docs/rules/<module>.md` edit in the same diff. The
 * `no-doc-change` PR label overrides the check (CI sets `SKIP_DOC_COVERAGE=1`
 * when the label is present).
 *
 * Module → rules-file map is the source of truth at the top of this file.
 * Adding a new server module: add a row here AND create `docs/rules/<name>.md`.
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const BASE_REF = process.env.BASE_REF || 'origin/main';
const SKIP = process.env.SKIP_DOC_COVERAGE === '1';

// Module directory → expected rules file. First matching prefix wins (the
// loop below breaks on first hit), so list more-specific prefixes before
// any prefix that would also match them. Current entries do not overlap.
const MAP = [
  { prefix: 'apps/server/src/modules/accounting/', rules: 'docs/rules/accounting.md' },
  { prefix: 'apps/server/src/modules/activities/', rules: 'docs/rules/activities.md' },
  { prefix: 'apps/server/src/modules/ap/', rules: 'docs/rules/ap.md' },
  { prefix: 'apps/server/src/modules/ar/', rules: 'docs/rules/ar.md' },
  { prefix: 'apps/server/src/modules/bom/', rules: 'docs/rules/bom.md' },
  { prefix: 'apps/server/src/modules/projects/', rules: 'docs/rules/projects.md' },
  { prefix: 'apps/server/src/modules/reports/', rules: 'docs/rules/reports.md' },
  { prefix: 'apps/server/src/system/auth/', rules: 'docs/rules/auth.md' },
  { prefix: 'apps/server/src/system/core/', rules: 'docs/rules/entities.md' },
  { prefix: 'apps/server/src/system/tenants/', rules: 'docs/rules/tenants.md' },
];

if (SKIP) {
  console.log('doc-coverage: skipped (SKIP_DOC_COVERAGE=1 — no-doc-change label).');
  process.exit(0);
}

let changed;
try {
  changed = execSync(`git diff --name-only ${BASE_REF}...HEAD`, {
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean);
} catch (err) {
  console.error(`doc-coverage: failed to diff against ${BASE_REF}: ${err.message}`);
  process.exit(2);
}

if (changed.length === 0) {
  console.log('doc-coverage: no changes vs base.');
  process.exit(0);
}

// Heuristic: ignore changes to test files, migrations, and seeders — they
// don't carry behavioral spec the rules file needs to reflect.
const IGNORE = [
  /(^|\/)tests\//,
  /(^|\/)__tests__\//,
  /(^|\/)scripts\//,
  /\/schema\/migrations\//,
  /Seeder\.js$/,
  /\.test\.js$/,
];
function isIgnored(p) {
  return IGNORE.some((rx) => rx.test(p));
}

const missing = new Map();

for (const file of changed) {
  if (isIgnored(file)) continue;
  for (const m of MAP) {
    if (file.startsWith(m.prefix)) {
      if (!changed.includes(m.rules)) {
        if (!existsSync(m.rules)) {
          // If the rules file genuinely doesn't exist, the map is stale.
          console.error(
            `doc-coverage: map error — ${m.rules} does not exist (referenced by ${m.prefix}).`,
          );
          process.exit(2);
        }
        if (!missing.has(m.prefix)) missing.set(m.prefix, { rules: m.rules, files: [] });
        missing.get(m.prefix).files.push(file);
      }
      break;
    }
  }
}

if (missing.size === 0) {
  console.log(`doc-coverage: PASSED. Checked ${changed.length} changed files.`);
  process.exit(0);
}

console.error('\ndoc-coverage: FAILED.\n');
for (const [prefix, info] of missing) {
  console.error(`  Module ${prefix}`);
  console.error(`    expects edit to ${info.rules}`);
  console.error(`    changed code files (${info.files.length}):`);
  for (const f of info.files.slice(0, 5)) console.error(`      - ${f}`);
  if (info.files.length > 5) console.error(`      - … (${info.files.length - 5} more)`);
  console.error('');
}
console.error(
  'Fix by either updating the matching docs/rules/*.md file in this PR, or by applying the "no-doc-change" label and explaining the no-impact reason in the PR description.',
);
process.exit(1);
