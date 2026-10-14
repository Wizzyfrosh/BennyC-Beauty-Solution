# Project status and gate evidence

Updated: 14 October 2026 UTC. Implementation branch: `codex/phase-1-foundation`.

Phase 1 application code has been implemented against the complete specification. The user-selected teal reference replaces the earlier plum design proposal. No production database, live merchant account, real shop data or public deployment has been configured.

| Gate | Status | Evidence/blocker |
| --- | --- | --- |
| G1 — Foundation, catalogue, staff | **PENDING verification** | Build/typecheck/lint, 2 unit tests and 10 real PostgreSQL/auth integration tests passed. Phone/desktop browser review is pending. |
| G2 — Catalogue operations/inventory | PENDING verification | Phase 2 code implemented; local build/typecheck/lint and 4 unit tests pass. PostgreSQL suite passed on f264eaf: 20 integration tests including stock races/retries, permissions and upload validation. Configured Cloudinary upload and browser review remain pending. |
| G3 — Customer orders/pitch demo | PENDING verification | Phase 3 code implemented; six unit tests pass. Final PostgreSQL and browser/pitch checks pending. |
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
| Migrations/real sessions/DB privileges | PASS (CI) | PostgreSQL 17, migration replay, seed run twice, real Better Auth sessions and restricted runtime role; 10 integration tests passed |
| Mobile/desktop browser, keyboard and visual comparison | PENDING | Browser control unavailable in this managed environment; no screenshot or pixel-perfect claim |
| Live credentials/production data/payment | NOT RUN | Out of Phase 1 scope |

The initial `tsx --test` command could not open its IPC socket in this container. The scripts now use the standard `node --import tsx --test` loader; both focused tests passed without needing an IPC listener. Local PostgreSQL installation was blocked by container permission constraints; no privileges or sandbox settings were changed.

## Required next steps

1. Database/auth verification passed in GitHub Actions. Continue with the outstanding browser/keyboard gate; do not interpret backend tests as visual approval.
2. Run the visual and keyboard walkthrough at 360 px, 768 px and desktop in a browser; compare `/preview` with the supplied reference and verify variant interaction.
3. Configure a dedicated developer PostgreSQL database privately, migrate, apply runtime grants, seed and provision the first owner following README. No secrets should be pasted into chat.
4. Phase 2 development continued with user authorization. Complete its outstanding browser and configured-media checks before declaring G2 complete. Phase 3 guest demo checkout continued with explicit user authorization; provider payments remain Phase 4.

## Verified GitHub CI evidence

Code revision: `cf1552f01082577d0e07de20379b8fc4661601cc`. Both push and pull-request workflows completed successfully:

- https://github.com/Wizzyfrosh/BennyC-Beauty-Solution/actions/runs/38484035285
- https://github.com/Wizzyfrosh/BennyC-Beauty-Solution/actions/runs/38484090180

The job log confirms 2 unit tests and 10 integration tests, zero failures. TC01 passed draft/inactive-category exclusion and bounded inputs; TC02 passed independent active variant prices; TC03 passed anonymous/ordinary/inactive denial and owner/staff access; TC04 passed editable-role rejection, immediate deactivation, public signup rejection, untrusted-origin rejection, logout and expired-session replay denial. TR04 passed runtime DDL/catalogue/membership write denial; TR10 passed invalid price/publication constraint rejection. Migrations applied to the disposable database and the development seed ran successfully twice.

The uploaded Git source tree and all three image blob hashes were verified against the tested local files. Draft PR: https://github.com/Wizzyfrosh/BennyC-Beauty-Solution/pull/1. This evidence update changes documentation only; it does not change the tested application.

## Phase 2 progress — 14 October 2026

The user explicitly authorized continuing development. Catalogue editing, signed image upload code, receiving, batch/quarantine/expiry tracking, owner adjustments, movement/audit history and atomic counter/WhatsApp sales are implemented. See IMPLEMENTATION_PHASE_02.md. Code saved on the same review branch. GitHub CI passed on 1d6b4dbc0de01ff5917bc30a74b819028123ee92: 4 unit and 19 real PostgreSQL/auth/inventory integration tests. Final code revision f264eafb3c0c97bef425f0365b592d314c5df40b passed all 20 integration tests. Phone/desktop review remains pending, and Cloudinary credentials were not requested in chat or provisioned. No live payment or public deployment occurred.

Phase 2 CI evidence: https://github.com/Wizzyfrosh/BennyC-Beauty-Solution/actions/runs/38518970667. Both migrations applied, seed repeated, final-unit race and full-basket rollback passed. FEFO/variant separation, receipt/sale retry safety, expiry/quarantine, owner-only costs/adjustments, snapshot retention and append-only history passed.

Final Phase 2 application evidence: https://github.com/Wizzyfrosh/BennyC-Beauty-Solution/actions/runs/38519500510. Build/typecheck/lint, 4 unit tests and 20 integration tests passed with zero failures. The added valid-image test confirms a missing Cloudinary configuration returns 503 without creating an image record, and malformed retry keys are rejected before provider work. Real Cloudinary operation, visual/keyboard review, and production setup remain pending.

## Phase 3 progress — 14 October 2026

FR08–FR10, FR12 and protected FR13 are implemented for a development-only sample store. Cart/server quote, approved delivery matching, expiring FEFO holds, shared allocation-aware stock, server-side refresh drafts, private scoped order access, staff queue and one-time pickup/dispatch consumption are added. See IMPLEMENTATION_PHASE_03.md. Six unit tests pass; final real PostgreSQL CI and phone/desktop/keyboard pitch checks are pending at this checkpoint. No real provider payment, production database or public deployment is enabled.
