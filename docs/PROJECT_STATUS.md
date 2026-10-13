# Project status and gate evidence

Updated: 13 October 2026 UTC. Implementation branch: `codex/phase-1-foundation`.

Phase 1 application code has been implemented against the complete specification. The user-selected teal reference replaces the earlier plum design proposal. No production database, live merchant account, real shop data or public deployment has been configured.

| Gate | Status | Evidence/blocker |
| --- | --- | --- |
| G1 — Foundation, catalogue, staff | **PENDING verification** | Build/typecheck/lint and focused unit checks passed locally. Real PostgreSQL/auth checks are provided in CI; outcome to be recorded. Phone/desktop browser review is pending. |
| G2 — Catalogue operations/inventory | PENDING | Not implemented; follows G1 |
| G3 — Customer orders/pitch demo | PENDING | Not implemented; follows G2 |
| G4 — Payments/order handling | PENDING | Not implemented; no payment credentials used |
| G5 — Launch/operating readiness | PENDING | No production launch authorized or performed |

## Implemented Phase 1 scope

FR01–FR03; applicable TR01/TR02/TR04/TR06/TR07/TR09/TR10. See [IMPLEMENTATION_PHASE_01.md](IMPLEMENTATION_PHASE_01.md).

- Next.js/TypeScript/Tailwind project, pinned dependencies and npm lockfile.
- Generated Better Auth models, settings/staff/catalogue schema and migration with SQL constraints, separate runtime grants, safe seed and trusted first-owner procedure.
- Database-backed catalogue/API, bounded search/filter/pagination, variants, explicit public projections and failure states.
- Real Better Auth login/logout, active membership authorization, private staff API and dashboard.
- Reference-inspired storefront with original illustrative photos. `/preview` and `/preview/[slug]` are explicit visual fixtures, not backend fallbacks or an ordering system.

## Local verification — 13 October 2026

Host: managed Linux container; Node 24.19.0, npm 11.9.0, Git 2.51.1.

| Check | Result | Evidence |
| --- | --- | --- |
| Auth schema generation | PASS | `npx auth generate --config ./auth.config.ts --output ./.local/auth-schema.prisma --yes`; generated models incorporated with business membership relation |
| Prisma schema/client | PASS | `npx prisma format`, `npx prisma generate`; initial migration generated with `migrate diff` and explicit business constraints added |
| TypeScript | PASS | `npm run typecheck` |
| Lint | PASS | `npm run lint`, no warnings after PostCSS export fix |
| Focused unit tests | PASS | `npm test`: 2 tests, integer money handling and bounded catalogue inputs |
| Production build | PASS | `npm run build`: all pages/routes compiled, static pages generated |
| Migrations/real sessions/DB privileges | PENDING | Dedicated disposable PostgreSQL CI workflow added; no local database available |
| Mobile/desktop browser, keyboard and visual comparison | PENDING | Browser control unavailable in this managed environment; no screenshot or pixel-perfect claim |
| Live credentials/production data/payment | NOT RUN | Out of Phase 1 scope |

The initial `tsx --test` command could not open its IPC socket in this container. The scripts now use the standard `node --import tsx --test` loader; both focused tests passed without needing an IPC listener. Local PostgreSQL installation was blocked by container permission constraints; no privileges or sandbox settings were changed.

## Required next steps

1. Confirm the GitHub workflow result for this branch; fix any actual database/auth failures before marking those checks complete.
2. Run the visual and keyboard walkthrough at 360 px, 768 px and desktop in a browser; compare `/preview` with the supplied reference and verify variant interaction.
3. Configure a dedicated developer PostgreSQL database privately, migrate, apply runtime grants, seed and provision the first owner following README. No secrets should be pasted into chat.
4. Only after G1 evidence is complete, begin Phase 2 catalogue editing, owner-only image uploads and physical inventory. Cart/checkout and payment are still later phases.
