# BennyC — persistent agent instructions

Business: **BennyC Beauty Solution**. Descriptor: **Cosmetics & Makeup Venture**. Development tool: Antigravity. This repository starts as a specification; do not infer that services, migrations or tests are already complete.

## Read and scope

Read README.md, docs/PROJECT_STATUS.md, docs/01_PRODUCT_REQUIREMENTS.md and the current task. Consult the technical, flow, design, schema, API and security documents relevant to the change. Follow docs/06_IMPLEMENTATION_PLAN.md and record actual gate evidence.

Inspect the repository and preserve user work. Do not re-scaffold a working app or overwrite a lockfile without a concrete reason. If only documents exist, scaffold around them safely. Resolve material conflicts in the documents and update affected references; never quietly discard a requirement.

Implement the phase requested, continuing routine authorized local work through verification. Respect configured review controls and existing authorization. Ask only for material missing decisions, real access blockers or new paid/destructive/publication actions outside scope. Do not request secrets in chat. Use one coding agent unless the user explicitly requests parallel work.

## Architecture and tools

- One Next.js/TypeScript/Tailwind app with a Node.js backend; PostgreSQL + Prisma; Better Auth for staff; Cloudinary for product images; Paystack hosted checkout in Phase 4. No runtime AI service is needed.
- One shop/branch initially, NGN, Africa/Lagos business dates, guest checkout and owner/staff roles. No native app, wallet, marketplace or speculative multi-business platform.
- Verify current official SDK/CLI/framework requirements. Pin compatible package versions and preserve one npm lockfile. No forced installs or disabling type/security checks to hide errors.
- Use clear domain modules and server input schemas. Avoid a second ORM/backend framework or empty abstraction layers.
- Local demo work does not authorize live payments, production schema changes, account purchases, messages or public publishing.

## Access and data

- Verify staff identity server-side and check current active membership/role. User-editable metadata, a client flag or an unverified session object cannot grant authority.
- Protect routes, server actions and domain services, not only navigation. All database access is server-only; use a restricted runtime role and separate migration credentials. No public staff signup or self-promotion.
- Public catalogue rows/projections exclude costs, customers, staff and private notes. Select public fields explicitly at the server boundary.
- Prisma and database credentials stay in server-only modules. Use authorized domain services, never client-selected arbitrary database operations.
- Generate Better Auth schema for the pinned adapter; migrate through Prisma. Keep auth user ID types consistent with membership/actor foreign keys. Never replace library-managed credential security with custom authentication.
- Secrets never appear in client bundles, NEXT_PUBLIC variables, Git, logs or screenshots. Validate owner-only media uploads and keep Cloudinary secrets server-side.
- Guest order access needs a hashed, expiring/revocable high-entropy token or scoped session. IDs/order numbers are not authorization.

## Stock and money invariants

- Variants are independently stocked SKUs; expiry belongs to a batch. Use the exact semantics in docs/05_BACKEND_SCHEMA.md.
- Physical on-hand includes quarantine. Available-to-sell excludes quarantine, unexpired checkout holds, paid commitments and ineligible/expired batches.
- Checkout reserves; verified payment commits the allocation; dispatch/pickup consumes physical stock once. A delivered click does not deduct it again.
- All sales channels use the same stock services and Prisma transaction rules. Lock/recheck all affected rows; commit complete baskets or none; use stable idempotency keys and append-only movements.
- Integer kobo, server-calculated totals and immutable order snapshots. Do not trust submitted amounts or rewrite old orders when prices change.
- Verify provider signature plus expected reference, amount, currency and environment. Callbacks/webhooks/reconciliation share idempotent confirmation logic.
- Payment and fulfilment states are separate. Late success, explicit cancellation and duplicate charges must follow the documented exception rules. Do not lose actual money events to an oversimplified unique constraint.
- Refunds change money records; returns change physical records. Returned items enter quarantine; a refund never automatically restocks.
- Demo simulation is clearly labelled and impossible in production. Never claim a simulated payment proves provider settlement.

## Design and evidence

Use docs/04_DESIGN_BRIEF.md. Keep real business information separate from clearly marked demo data. Do not invent testimonials, stock levels, delivery policies, addresses or revenue. Use honest empty/setup-required states.

Run meaningful build/typecheck/lint and risk-focused checks. Database concurrency, privilege limits and staff authorization need real integration tests; provider integration needs provider test evidence. Never claim an unrun test passed. Review phone/desktop, loading/error states and keyboard navigation.

Finish with requirement IDs, meaningful changed files, actual commands/results, PASS/FAIL/PENDING gate status, unverified behaviour and the exact next task. Update docs/PROJECT_STATUS.md and docs/TOOLCHAIN.md. A clean build alone is not production-readiness evidence.
