# 02 — Technical requirements document

Version 2.0 | All runtime integrations pending | See [backend schema](05_BACKEND_SCHEMA.md) for record definitions.

## Architecture decision

Use one Next.js App Router application with TypeScript and Tailwind. Its Node.js server is the backend. PostgreSQL stores business data; Prisma supplies database access and migrations; Better Auth handles staff authentication; Cloudinary stores and delivers public product images. Paystack provides hosted checkout in Phase 4. Antigravity is the development environment; the product needs no runtime AI service.

The database is portable between compatible PostgreSQL hosts. Hosting remains an explicit deployment decision. This design requires the developer to operate authentication, migrations, background jobs and backups; an ORM does not supply those operational guarantees automatically.

| Component | Responsibility | Boundary |
| --- | --- | --- |
| Public pages | Search, product detail, cart and checkout UI | Browser cannot set authoritative money or stock |
| Staff pages | Operational tasks and feedback | Every operation requires server authorization |
| Next.js Node server | Input validation, identity, permissions, projections and provider calls | Server-only modules hold credentials |
| Prisma + PostgreSQL | Persistence, constraints and atomic domain transactions | No browser database connection or generic public database API |
| Better Auth | Staff login and server-verified sessions | Current staff membership supplies business roles |
| Cloudinary | Owner-authorized product image upload and public delivery | No customer documents or private receipts |
| Scheduled work | Hold cleanup, payment reconciliation and notification retries | Correctness cannot rely solely on a job running on time |

Suggested modules: `src/features/catalog`, `inventory`, `orders`, `payments`, `staff`; server-only auth, database and media adapters; shared validation and money utilities; `prisma/schema.prisma` and migration history. Reuse one database client per documented runtime lifecycle. Do not add Express, a second ORM, Redis or microservices without a concrete requirement.

Verify compatible stable package versions as a set, including the Better Auth Prisma adapter and required PostgreSQL driver. The consulted adapter guide uses Prisma 7; do not combine its setup blindly with a different major version's transaction API. Record the selected versions and verified integration in TOOLCHAIN.md. No specific package version has been installed by this pack.

## Technical requirements

| ID | Requirement | Evidence |
| --- | --- | --- |
| TR01 | Strict TypeScript, supported stable dependencies, one lockfile | Clean typecheck/build and recorded toolchain |
| TR02 | Explicit input schemas and bounded values | Invalid SKU/quantity/amount rejected server-side |
| TR03 | Atomic domain mutations and durable idempotency | Race and retry tests against real PostgreSQL |
| TR04 | Verified staff sessions, current role checks and restricted database credentials | Direct endpoint denial tests and database privilege checks |
| TR05 | Authentic payment confirmation and reconciliation | Provider test events and delayed/duplicate cases |
| TR06 | Correct money/time representation | Integer-kobo calculations; Lagos boundary tests |
| TR07 | Responsive accessible interface | Keyboard, focus, contrast and phone checks |
| TR08 | Operational recovery and observable failures | Restore/reconciliation/rollback evidence |
| TR09 | Private data and secrets excluded from public responses | Response/bundle/log inspection |
| TR10 | Reproducible database and environment setup | Clean migration replay and documented first-owner bootstrap |

## Server and data access

Use Better Auth's supported Next.js integration and Prisma adapter. Generate its required schema from the selected configuration, review it, then apply it through Prisma migrations. Authentication tables remain separate from business membership. Disable public registration and unneeded auth features. Establish the first owner through a trusted one-time provisioning script using library-supported account creation/password hashing; no public bootstrap endpoint or shared default password.

On every protected server request, validate the session and load current active `staff_members` membership. Recheck authority inside sensitive transactions. Browser roles and editable profile fields never grant privileges. Route guards improve navigation but cannot replace checks in routes, server actions and domain services. Staff deactivation revokes sessions and blocks subsequent operations through membership checks.

All business database access runs on the server through explicit repository/service functions. Public catalogue queries select approved fields and published records. There is no client-selectable table/query endpoint. Use a non-superuser runtime database credential with only necessary data permissions and a separate migration credential for DDL. The database does not inherently know the browser user's role: the server must authorize each operation. Keep connection strings out of all public environment variables.

Product image uploads are owner-only server operations. For P0, use a validated server upload to Cloudinary with bounded image type, size and dimensions; allow only intended raster formats and avoid arbitrary remote-URL imports. Record the returned asset identifier and delivery metadata. Do not trust a client-provided upload result. Secrets and asset deletion remain server-side. Use local placeholders in Phase 1; connect uploads in Phase 2.

## Consistency and concurrency

The database is authoritative. Reserve, cancel, receive, dispatch and record counter sales through a single Prisma transaction per operation with deterministic lock ordering. A loop of separate ORM calls outside a transaction is not atomic. Use parameterized SQL within the same transaction where explicit PostgreSQL row locking is required; verify the API for the pinned Prisma version.

Acquire locks on affected batches in stable ID order; recheck eligibility and available quantity inside the transaction. Commit the whole basket or none. Use stable idempotency keys scoped to operation and authenticated actor or guest checkout session, with a request hash. Reusing a key with a different payload is a conflict. Retain completed financial and stock operation keys with the associated records, so housekeeping cannot permit a second sale. Retry serialization/deadlock failures with bounded retries of the whole idempotent transaction.

Do not hold a database transaction open during a Paystack HTTP call. Persist a recoverable order/payment attempt, make the call, then update its result. Transactional outbox records support notifications after confirmation; failure to send a receipt does not undo a successful sale. No message broker is required initially.

## Money, time and identifiers

Amounts use integer kobo, bounded to safe supported arithmetic; reject overflow and fractions. Parse owner-entered decimal NGN precisely. Calculate totals on the server and snapshot line name/SKU/options/price plus delivery/tax treatment. No invented tax rate: resolve it before live billing.

Use UUID business primary keys and unique readable order numbers. Better Auth identifiers follow its generated string schema; membership and actor foreign keys must match that type. Neither UUIDs nor order numbers are authorization. Store instants in UTC and calculate report ranges from Africa/Lagos business dates. Expiry is a date with explicit precision/policy. Use database time for reservations.

## Reliability and performance targets

Provisional goals: useful mobile content within 2.5 seconds under a documented realistic test profile; internal catalogue/read requests p95 below 500 ms under the agreed pilot load; checkout application processing p95 below 2 seconds excluding provider interaction. Record device/network/data-volume conditions. These targets are not measured achievements or contractual availability promises.

Paginate lists, initially 24 catalogue items/page, and bound query lengths. Index common filters and foreign-key lookups; inspect query plans before adding infrastructure. Optimize image dimensions and formats and lazy-load offscreen images. Cache public catalogue content with invalidation on edits; checkout always revalidates live price/availability. Do not cache authenticated customer/staff responses publicly.

Use timeouts and bounded retry policies. Retry mutations only with idempotency. Rate-limit login, checkout, order-access and payment-initialization abuse. A production multi-instance host needs a shared limiter or platform control, not only in-memory counters.

## Environment and migrations

Use separate development, staging and production databases and credentials. Development may use local PostgreSQL or a dedicated managed PostgreSQL database. Confirm database name/host before applying changes; do not reuse another business's database. Choose a Node.js runtime and host with compatible database connections, pooling, upload limits and scheduled jobs. A static export cannot run this backend.

Keep schema changes in Prisma migrations, including reviewed SQL constraints/indexes unsupported by the schema DSL. Do not use schema push/reset as a production migration strategy. Check clean migration replay against a disposable database. Inspect any existing schema before generating auth models; never overwrite user migrations. Production applies reviewed migrations through the installed Prisma version's documented deployment command, not a development reset.

Document these server-only placeholders in `.env.example`: `DATABASE_URL`, a separate `MIGRATION_DATABASE_URL` if the selected configuration needs it, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `APP_BASE_URL`, `APP_ENV`, and `PAYMENTS_MODE`. The migration URL is a project convention to wire explicitly, not an automatically recognized Prisma setting. Phase 2 adds `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`; Phase 4 adds `PAYSTACK_SECRET_KEY`, a job authentication secret and the chosen notification provider settings. Require only variables used by the current phase. Real values never enter source control.

## Sources and change control

See [TOOLCHAIN.md](TOOLCHAIN.md) for official references and version evidence. Recheck relevant current docs before implementing SDK/CLI-specific code. Changes to stock semantics, access control, checkout state or payment handling require corresponding schema/API/test updates and an entry in the decisions register.
