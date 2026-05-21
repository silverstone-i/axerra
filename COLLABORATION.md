# Collaborating on AXERRA

AXERRA is open source under the **GNU Affero General Public License v3 or later** (AGPL-3.0-or-later). This document describes how to contribute and what you are agreeing to when you do.

The maintainer (Ian Silverstone) has sole enforcement authority over project policy. This baseline may be upgraded to a Contributor License Agreement (CLA) in the future; prior DCO sign-offs remain valid under AGPL-3.0-or-later regardless of any future upgrade.

---

## Developer Certificate of Origin (DCO)

Every commit to this repository must carry a `Signed-off-by:` trailer:

```
Signed-off-by: Jane Developer <jane@example.com>
```

By adding this trailer, you certify the following:

> **Developer Certificate of Origin 1.1**
>
> By making a contribution to this project, I certify that:
>
> (a) The contribution was created in whole or in part by me and I
>     have the right to submit it under the open source license
>     indicated in the file; or
>
> (b) The contribution is based upon previous work that, to the best
>     of my knowledge, is covered under an appropriate open source
>     license and I have the right under that license to submit that
>     work with modifications, whether created in whole or in part
>     by me, under the same open source license (unless I am
>     permitted to submit under a different license), as indicated
>     in the file; or
>
> (c) The contribution was provided directly to me by some other
>     person who certified (a), (b) or (c) and I have not modified
>     it.
>
> (d) I understand and agree that this project and the contribution
>     are public and that a record of the contribution (including all
>     personal information I submit with it, including my sign-off) is
>     maintained indefinitely and may be redistributed consistent with
>     this project or the open source license(s) involved.

The DCO text above is the verbatim version 1.1 from <https://developercertificate.org>.

### How to sign off

Use `git commit -s` (or `--signoff`) to append the trailer automatically based on your `user.name` and `user.email`. Anonymous or pseudonymous sign-offs are not accepted.

A husky `commit-msg` hook in this repo rejects commits missing a valid `Signed-off-by:` trailer.

---

## Dependency policy

AXERRA is AGPL-3.0-or-later. Production dependencies must carry an AGPL-compatible license.

The allowlist of acceptable production-dep licenses lives at `.licenses-allowed.json`. CI runs `license-checker-rseidelsohn --production` against the allowlist and fails the build when a new prod dep falls outside it.

- Dev-only dependencies (`devDependencies`) are not restricted by this check — they do not ship with the application.
- Adding a production dependency with a new license requires updating the allowlist in the same PR, with justification in the PR body.

Examples of acceptable production licenses (non-exhaustive — see `.licenses-allowed.json` for the authoritative list):

- MIT, MIT-0
- ISC
- BSD-2-Clause, BSD-3-Clause, 0BSD
- Apache-2.0
- LGPL-3.0-or-later
- AGPL-3.0-or-later
- CC0-1.0, Unlicense
- BlueOak-1.0.0, Python-2.0

Examples of **rejected** production licenses:

- GPL-2.0-only (incompatible with AGPL-3.0)
- BUSL-\*, SSPL-\*, Commons-Clause (not OSI-approved open source)
- Any proprietary / "all rights reserved" / unlicensed package

---

## Contribution workflow

1. Open or claim an issue describing the change.
2. Branch from `main`.
3. Make your change. Follow project conventions in `CLAUDE.md` and `docs/rules/`.
4. Commit with `git commit -s` to attach your DCO sign-off.
5. Push and open a PR to `main`.
6. CI runs lint, tests, architecture check, license check, and doc-coverage check.
7. The maintainer reviews. Changes touching server code must touch the corresponding `docs/rules/<module>.md` unless the PR carries a `no-doc-change` label with justification.

Husky pre-commit rejects mixed commits that touch both `apps/client/` and `apps/server/` in a single commit. Split them.

---

## Copyright

Copyright in contributions remains with the contributor. By signing off you license your contribution to the project under AGPL-3.0-or-later. The project's copyright notice currently reads:

```
Copyright (c) 2025–present Ian Silverstone.
SPDX-License-Identifier: AGPL-3.0-or-later
```

If a separate legal entity (e.g., Axerra LLC) is later formed and the existing copyrights are assigned to it, the headers will be updated in a single coordinated pass; this does not affect the rights of any prior contributor.
