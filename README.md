# AXERRA

**AXERRA is a horizontal, project-native, multi-entity ERP.** The base ERP core — multi-tenant infrastructure, RBAC, master data (vendors, clients, employees, contacts, companies), projects, activities, BOM, AP/AR, double-entry accounting, cashflow, and profitability — is industry-agnostic. Industry-specific workflows are delivered as **add-on modules** layered on this core.

## Phases

- **Phase 1 — Base ERP core** (current). Tenants, legal entities, master data, projects, accounting, AP/AR, BOM, reports.
- **Phase 2 — Construction reference module.** First industry vertical. Construction-specific cost coding, unit/lot management, draw schedules.

Additional industry verticals follow the same add-on pattern.

## Stack

PERN — Postgres 15+, Express 5, React 18, Node 20+. Schema-per-tenant isolation via the owned [`pg-schemata`](https://www.npmjs.com/package/pg-schemata) library. JWT (httpOnly cookies) for auth; Redis for permission caching; MUI 5 + MUI X Data Grid v6 on the client.

## Repository layout

```
axerra/
├── apps/
│   ├── server/   # Express API (pg-schemata, Passport, Redis, Winston)
│   └── client/   # React SPA (Vite, MUI, TanStack Query)
├── packages/
│   └── shared/   # Cross-workspace constants/utilities
└── docs/
    ├── PRD.md           # Product Requirements Document (intended state)
    ├── decisions/       # Architecture Decision Records (history)
    ├── rules/           # Implementation rules per module
    ├── gap-analysis.md  # Doc-vs-code reconciliation status
    └── roadmap.md       # Execution roadmap
```

## License

Released under the **GNU Affero General Public License, version 3 or later** (AGPL-3.0-or-later). See [LICENSE](LICENSE).

If you run a modified version of AXERRA over a network, you must make the modified source available to your users. This is intentional: AXERRA is open infrastructure.

## Contributing

Contributions are welcome. Every commit must carry a `Signed-off-by:` trailer asserting the Developer Certificate of Origin (DCO 1.1). See [COLLABORATION.md](COLLABORATION.md) for details and the dependency policy.

The maintainer (Ian Silverstone) has sole enforcement authority over project policy.

## Copyright

Copyright (c) 2025–present Ian Silverstone. All contributors retain copyright in their contributions, licensed to the project under AGPL-3.0-or-later via the DCO sign-off.
