<!--
Thanks for the contribution. A few checks before you submit:

- Every commit must carry a Signed-off-by: trailer (DCO 1.1). See COLLABORATION.md.
- Mixed apps/server + apps/client commits are rejected by husky pre-commit. Split into separate commits.
- Production-dependency licenses must be AGPL-compatible. CI enforces .licenses-allowed.json.

Replace the placeholders below; remove this comment block.
-->

## Summary

<!-- One paragraph: what, why. Not how (the diff shows how). -->

## Documentation impact

Tick every box that applies (multi-select — a change can touch PRD, ARDs, and rules at once). If none apply, tick **No documentation impact** instead and state why; do not combine it with the other boxes.

- [ ] **PRD edited** — cite section(s): `docs/PRD.md` §_._
- [ ] **ARD added or updated** — file: `docs/decisions/00NN-…md`
- [ ] **Rules file edited** — file: `docs/rules/<module>.md`
- [ ] **README / COLLABORATION.md / repo-level doc edited**
- [ ] **No documentation impact** — reason: <!-- e.g. internal helper, no behavior change -->

> CI's `doc-coverage` check fails when a PR touches a tracked code tree without also touching the matching `docs/rules/<name>.md`. Tracked trees: `apps/server/src/modules/<X>/` (the business modules) and `apps/server/src/system/{auth,core,tenants}/` (system surfaces). See `scripts/checkDocCoverage.js` for the authoritative mapping. Override by applying the `no-doc-change` label and explaining above.

## Linked issues

<!-- e.g. Closes #123, resolves the drift noted in the last quarterly review -->

## Test plan

<!-- Bulleted markdown checklist of TODOs for verifying the change -->

- [ ] CI: `lint`
- [ ] CI: `license-check`
- [ ] CI: `arch-check`
- [ ] CI: `doc-coverage`
- [ ] CI: `test-fast`
- [ ] CI: `test-integration`
- [ ] Manual: <!-- describe -->

## Risk / rollback

<!-- One line. If the change ships and goes wrong, how do we back it out? -->
