# ADR-0027: License, copyright holder, and contribution policy

**Status**: Accepted
**Date**: 2026-05-21
**Related**: gap-analysis §5.3, §5.4; PRD §14 (Licensing), §15 (Contribution Policy)

## Context

AXERRA was initialized under MIT with copyright nominally held by "Axerra LLC" — an entity that does not legally exist. As the project moves toward public release as a horizontal, project-native ERP with industry-specific add-on modules, three coupled decisions are needed:

1. **License.** MIT does not protect against a fork being privatized and offered as a hosted service without contributing back. Given the open-infrastructure positioning (Phase 1 base ERP core), copyleft is desirable.
2. **Copyright holder.** Until "Axerra LLC" is legally formed, copyright cannot be assigned to it. Authorship defaults to the natural person.
3. **Contribution mechanism.** Public contributions require a documented rights-grant. A full Contributor License Agreement (CLA) imposes friction before any meaningful contribution flow exists.

## Decision

### License: AGPL-3.0-or-later

The project is released under the **GNU Affero General Public License, version 3 or later**.

- AGPL closes the "SaaS loophole": running a modified version over a network constitutes distribution and requires source disclosure to network users.
- The `-or-later` clause lets the project adopt future AGPL versions without a relicensing event.
- The license is OSI-approved and FSF-recommended; compatible with most permissive licenses (MIT, BSD, ISC, Apache-2.0) for incoming code via DCO.

### Copyright holder: Ian Silverstone

All file headers carry:

```
Copyright (c) 2025–present Ian Silverstone.
SPDX-License-Identifier: AGPL-3.0-or-later
```

When Axerra LLC is legally formed, the copyrights will be **assigned to the LLC via a written assignment**, and the headers will be updated in a single coordinated pass. Pre-assignment commits retain their original authorship and DCO sign-offs; the assignment transfers economic ownership of the project's copyright without invalidating any prior contributor's rights.

### Contribution policy: DCO 1.1 via husky `commit-msg`

Every commit must carry a `Signed-off-by:` trailer asserting the Developer Certificate of Origin 1.1 (text from <https://developercertificate.org>). A husky `commit-msg` hook (`.husky/commit-msg`) rejects commits missing a valid trailer.

The DCO is the OSS baseline. A CLA may be introduced later if a specific need arises (relicensing, indemnification, etc.) — prior DCO sign-offs remain valid under AGPL-3.0-or-later regardless of any future CLA adoption.

### Dependency policy

Production dependencies must carry an AGPL-compatible license. CI enforces this via `scripts/checkLicenses.js`:

- The allowlist of acceptable licenses lives at `.licenses-allowed.json`.
- Known package.json gaps (transitive deps with missing license fields) are listed at `.licenses-exceptions.json` with a per-package justification.
- A failing license check blocks merge.
- Dev-only dependencies are not restricted by this gate — they do not ship with the application.

GPL-2.0-only is **rejected** (incompatible with AGPL-3.0). BUSL, SSPL, Commons-Clause, and unlicensed packages are rejected.

## Consequences

- **Forks running over a network must publish source.** This is intentional and protects against hosted-service fork-and-monetize patterns.
- **Some commercial integrators may refuse AGPL.** This is a deliberate trade-off; integrations that require a permissive license can negotiate a dual-licensing arrangement directly with the copyright holder.
- **DCO is the only enforced contributor agreement** until further notice. PRs without valid sign-off cannot be merged.
- **A new prod dependency with an unfamiliar license fails CI.** Contributors must update `.licenses-allowed.json` (with justification in the PR body) or `.licenses-exceptions.json` (when upstream license is missing but the actual license is known and AGPL-compatible).

## Migration / Rollout

1. Replace `LICENSE` with canonical AGPL-3.0 text.
2. Set `"license": "AGPL-3.0-or-later"` in all `package.json` files.
3. Replace all `"Copyright (c) 2025 – present Axerra LLC. All rights reserved."` headers with the new copyright + SPDX block.
4. Publish `COLLABORATION.md` (DCO + dependency policy) at repo root.
5. Install `.husky/commit-msg`.
6. Add `license-check` CI job.
7. Update `README.md` to declare AGPL-3.0-or-later and link to COLLABORATION.md.

Phase A of the reconciliation finish-out (plan: `.claude/plans/i-asked-a-question-robust-horizon.md`) covers all of the above in a single change set.

## Out of scope for this ADR

- Future CLA adoption mechanics — left to a follow-up ADR if and when the need arises.
- Copyright assignment paperwork at LLC formation — a legal task, not an engineering one.
- Trademark policy for the AXERRA name and logo — separate concern.
