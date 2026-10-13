# Phase 1 implementation plan and walkthrough

## Scope

FR01–FR03; TR01, TR02, TR04, TR06, TR07, TR09 and TR10. Preserve the complete planning pack and repository LICENSE. Implement a single Next.js Node application with PostgreSQL/Prisma/Better Auth; use the attached design reference. Cloudinary uploads, inventory, checkout and payments remain in later phases.

## Changes

1. Pin the framework/auth/ORM/toolchain and add one lockfile and environment contract.
2. Generate auth schema, add settings/staff/catalogue models, constrained migration, least-privilege runtime grants, idempotent development seed and trusted first-owner bootstrap.
3. Add public field projections and bounded catalogue API/search/filter/detail routes, with no draft or private field exposure.
4. Add server-verified login, current membership checks, protected staff API and dashboard; no public role writes or fake sessions.
5. Recreate reference composition using original illustrative photography, responsive CSS, accessible form controls and reusable catalogue components. Add explicitly separate `/preview` fixtures for design review without a configured backend.
6. Run static/build checks and focused unit tests; provide real PostgreSQL/auth CI tests and record their actual outcome. Keep browser/manual verification pending until performed.

## Walkthrough

- `/preview`: hero → circular category filter → featured sample → sample detail → change volume/shade and see exact NGN price.
- `/shop`: configure PostgreSQL, migrate, apply runtime grants and seed. Search by product/brand, choose category, inspect variants. `/products/demo-unpublished-serum` must not reveal a draft.
- `/staff/sign-in`: use the privately provisioned first owner; open `/admin`. Catalogue counts come from the database. Logout invalidates the session.
- Direct `/api/admin/overview` without authentication must return 401 once configured. Ordinary/inactive identities must return 403. Unconfigured backend returns 503.

## Failure behaviour

No database → explicit collection/workspace unavailable states and 503 API results. Invalid filters → 400. Draft/unpublished item → 404. Invalid/expired session → sign-in/401. Missing membership → access denied/403. No fallback session, checkout success, stock number or sample catalogue substitution exists at those boundaries.

## Gate

See PROJECT_STATUS.md for actual evidence. A production build is not proof of real database permissions, staff access or visual fidelity. Those checks remain independently tracked.
