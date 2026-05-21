#!/usr/bin/env node
/**
 * @file Verify production transitive deps carry AGPL-compatible licenses.
 *
 * Walks `npm ls --all --production --json` from the monorepo root, reads each
 * dep's package.json for its license field, and fails when a package's license
 * is not in `.licenses-allowed.json` and not listed in `.licenses-exceptions.json`.
 *
 * Runs in CI (see .github/workflows/ci.yml). Also runnable locally:
 *   node scripts/checkLicenses.js
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

const allowed = new Set(
  JSON.parse(readFileSync(join(ROOT, '.licenses-allowed.json'), 'utf8')),
);
const exceptions = JSON.parse(
  readFileSync(join(ROOT, '.licenses-exceptions.json'), 'utf8'),
).exceptions || {};

const treeJson = execSync('npm ls --all --production --json', {
  cwd: ROOT,
  maxBuffer: 64 * 1024 * 1024,
  stdio: ['ignore', 'pipe', 'pipe'],
}).toString();

const tree = JSON.parse(treeJson);
const seen = new Map();

function walk(node) {
  if (!node || !node.dependencies) return;
  for (const [name, info] of Object.entries(node.dependencies)) {
    if (!info || !info.version) continue;
    const key = `${name}@${info.version}`;
    if (seen.has(key)) continue;
    seen.set(key, info);
    walk(info);
  }
}
walk(tree);

const offenders = [];
const counts = {};

for (const [key] of seen) {
  if (key.startsWith('@axerra/') || key.startsWith('axerra@')) continue;
  const name = key.replace(/@[^@]+$/, '');
  const pkgPath = join(ROOT, 'node_modules', name, 'package.json');
  if (!existsSync(pkgPath)) {
    // Hoisting can place a dep inside a workspace's node_modules; try those.
    const alt = ['apps/server', 'apps/client', 'packages/shared']
      .map((w) => join(ROOT, w, 'node_modules', name, 'package.json'))
      .find((p) => existsSync(p));
    if (!alt) {
      offenders.push({ key, license: 'NOT-FOUND', reason: 'package.json missing' });
      continue;
    }
  }
  const resolved = existsSync(pkgPath)
    ? pkgPath
    : ['apps/server', 'apps/client', 'packages/shared']
        .map((w) => join(ROOT, w, 'node_modules', name, 'package.json'))
        .find((p) => existsSync(p));
  const pkg = JSON.parse(readFileSync(resolved, 'utf8'));
  let lic = pkg.license || pkg.licenses;
  if (Array.isArray(lic)) lic = lic.map((x) => x.type || x).join(' OR ');
  if (lic && typeof lic === 'object') lic = lic.type || JSON.stringify(lic);
  lic = lic || 'UNKNOWN';
  counts[lic] = (counts[lic] || 0) + 1;

  // Accept SPDX OR / AND combinators by splitting and checking any branch.
  const simple = lic
    .replace(/^[()]|[()]$/g, '')
    .split(/ OR | AND /i)
    .map((s) => s.trim());
  const ok = simple.some((s) => allowed.has(s));

  if (!ok && !exceptions[key]) {
    offenders.push({ key, license: lic, reason: 'not in allowlist or exceptions' });
  }
}

console.log(`Inspected ${seen.size} production packages.`);
console.log('License distribution:');
for (const [lic, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${lic}: ${n}`);
}
const acceptedExceptions = Object.keys(exceptions).filter((k) => seen.has(k));
if (acceptedExceptions.length) {
  console.log(`Allowed exceptions in use: ${acceptedExceptions.length}`);
  for (const k of acceptedExceptions) {
    console.log(`  ${k} (${exceptions[k].actual_license}) — ${exceptions[k].justification.slice(0, 80)}`);
  }
}

if (offenders.length) {
  console.error('\nLicense check FAILED. Offending packages:');
  for (const o of offenders) {
    console.error(`  ${o.key} -> ${o.license} (${o.reason})`);
  }
  console.error(
    '\nFix by either adding the license to .licenses-allowed.json (with justification in the PR body) or adding the package to .licenses-exceptions.json (only when upstream license is missing but the actual license is known and AGPL-compatible).',
  );
  process.exit(1);
}

console.log('\nLicense check PASSED.');
process.exit(0);
