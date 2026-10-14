# BennyC Beauty Solution

**Cosmetics & Makeup Venture** — a Next.js storefront and staff workspace.

Phases 1–5 code is implemented for review; production and the real provider test gate remain pending. The storefront follows the supplied teal beauty-store reference: botanical hero, pale-mint feature strip, circular categories, product cards and a product banner. All generated packaging, demo prices and sample products are explicitly illustrative. Real online ordering/provider payments remain closed; development-only guest checkout simulation is implemented. Staff inventory and completed shop/WhatsApp sales are implemented.

## Run the design preview

Use Node.js 24 LTS and the committed npm lockfile.

```bash
npm ci
npm run dev
```

Open **http://localhost:3000/preview** to review the design without database credentials. Product cards open sample detail pages with working variant selection. Category links filter the preview collection. This route is an explicit visual fixture; it is never used as a fallback for a failed database, staff login or payment.

The real `/` and `/shop` routes read PostgreSQL. Before configuration they show an honest collection-unavailable state. The staff area denies access until real authentication and membership checks can complete.

## Configure the development backend

1. Create a **dedicated development PostgreSQL database**, for example `bennyc_development`. Do not use a production database.
2. Create a migration role with DDL rights and a separate non-superuser runtime LOGIN role with no schema ownership, `CREATEDB`, `CREATEROLE` or inherited privileged membership. Set each password privately with your database administrator or `psql`'s `\password` command.
3. Copy `.env.example` to `.env` in your local terminal. Set `DIRECT_URL` to the migration connection and `DATABASE_URL` to the restricted runtime connection. Use verified TLS for a remote database; do not disable certificate checks.
4. Set `BETTER_AUTH_URL=http://localhost:3000` for local development. Generate `BETTER_AUTH_SECRET` privately as described in `.env.example`. Never put secrets in chat, Git or `NEXT_PUBLIC_*` variables.
5. Verify the host/database is your intended development target, then run:

```bash
npm run db:migrate
```

6. Apply the Phase 1 runtime permissions as the database administrator (replace the role name if needed):

```bash
psql "$DIRECT_URL" -v runtime_role=bennyc_runtime -f scripts/grant-runtime.sql
```

`psql` must receive the actual private migration connection from your terminal environment; it does not automatically load `.env`. On Windows, use your SQL client's query editor or the equivalent environment-variable syntax. The foundation SQL file grants authentication lifecycle writes and catalogue/membership reads. Also apply the Phase 2 and Phase 3 permissions:

```bash
psql "$DIRECT_URL" -v runtime_role=bennyc_runtime -f scripts/grant-phase2.sql
psql "$DIRECT_URL" -v runtime_role=bennyc_runtime -f scripts/grant-phase3.sql
psql "$DIRECT_URL" -v runtime_role=bennyc_runtime -f scripts/grant-phase4.sql
psql "$DIRECT_URL" -v runtime_role=bennyc_runtime -f scripts/grant-phase5.sql
```

Phase 2 grants catalogue/balance/order writes used by server-authorized services, plus insert-only audit/movement history. The grant scripts do not grant application DDL, direct staff membership writes or history rewrites. Phase 5 membership management uses the narrowly validated owner function, not direct runtime table updates.

7. For sample data, set `BENNYC_DEMO_DATA=true` and `SEED_DATABASE_NAME=bennyc_development`, matching the actual database. Then run:

```bash
npm run db:seed
npm run owner:create
npm run dev
```

The seed is idempotent, refuses production/non-demo datasets and checks the actual database name. It creates 12 clearly marked sample products, size/shade variants and one unpublished draft. It creates no stock, orders or sales.

`owner:create` runs only in a private interactive terminal. It confirms the target database, hides password input, uses Better Auth's password hashing and creates the first owner transactionally. It refuses existing owners and never silently promotes an existing identity. Sign in at **/staff/sign-in**. Do not expose this script as an HTTP endpoint. Use the private `staff:provision` and `staff:recover` commands for later maintenance; see [OPERATIONS_RUNBOOK.md](docs/OPERATIONS_RUNBOOK.md). Password recovery preserves MFA. Production owners must complete authenticator enrollment at `/staff/security`.

Production requires HTTPS and separate secret management. Nothing in this branch deploys a store, connects a live merchant account or accepts real orders.

## Implemented boundaries

- **Public catalogue:** explicit published/active projections, bounded search and category/brand filters, pagination and independent variant prices in integer kobo.
- **Staff:** Better Auth email/password sessions; public signup disabled; current active membership checked on the server and protected API; user-editable fields cannot grant a role. Database-backed login rate limiting and origin protection are enabled.
- **Persistence:** PostgreSQL, Prisma 7.10, generated Better Auth models and a reproducible migration. Price, SKU, image and publication constraints are enforced in SQL. A separate read-only runtime business role prevents membership/catalogue writes in Phase 1.
- **Interface:** responsive storefront, accessible labels/focus, loading/error/empty states, real staff sign-in/sign-out and a protected dashboard using catalogue counts only.
- **Assets:** original generated reference-inspired photography, with prompts/provenance in [ASSETS.md](docs/ASSETS.md). Generic fixtures do not make any real product/clinical/authenticity claims.

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

The GitHub workflow creates a disposable PostgreSQL 17 service, migrates and seeds it twice, then runs integration tests against real Next.js HTTP endpoints. It checks draft exclusion, variants, real staff sessions, inactive/ordinary-user denial, revoked sessions, signup/CSRF rejection, database constraints and runtime role privileges.

`npm run test:integration` deliberately refuses to run without an isolated `bennyc_ci` database, configured runtime role and running local app. Do not point the test fixture at a real shop database. UI screenshot/browser checks are a separate required gate, not inferred from a build.

See [PROJECT_STATUS.md](docs/PROJECT_STATUS.md) for actual results and pending checks. See [IMPLEMENTATION_PHASE_02.md](docs/IMPLEMENTATION_PHASE_02.md) for the stock/counter-sale workflow and remaining media/browser checks.

## Project documents

| Document | File |
| --- | --- |
| Product requirements | [01_PRODUCT_REQUIREMENTS.md](docs/01_PRODUCT_REQUIREMENTS.md) |
| Technical requirements | [02_TECHNICAL_REQUIREMENTS.md](docs/02_TECHNICAL_REQUIREMENTS.md) |
| App flow | [03_APP_FLOW.md](docs/03_APP_FLOW.md) |
| Design brief | [04_DESIGN_BRIEF.md](docs/04_DESIGN_BRIEF.md) |
| Backend/database schema | [05_BACKEND_SCHEMA.md](docs/05_BACKEND_SCHEMA.md) |
| Implementation phases | [06_IMPLEMENTATION_PLAN.md](docs/06_IMPLEMENTATION_PLAN.md) |
| Agent instructions | [AGENTS.md](AGENTS.md) |
| Master implementation prompt | [MASTER_AI_PROMPT.md](MASTER_AI_PROMPT.md) |
| API contracts | [07_API_CONTRACTS.md](docs/07_API_CONTRACTS.md) |
| Security and permissions | [08_SECURITY_AND_PERMISSIONS.md](docs/08_SECURITY_AND_PERMISSIONS.md) |
| Testing and acceptance | [09_TESTING_AND_ACCEPTANCE.md](docs/09_TESTING_AND_ACCEPTANCE.md) |
| Deployment and operations | [10_DEPLOYMENT_AND_OPERATIONS.md](docs/10_DEPLOYMENT_AND_OPERATIONS.md) |
| Business inputs and decisions | [11_DECISIONS_AND_BUSINESS_INPUTS.md](docs/11_DECISIONS_AND_BUSINESS_INPUTS.md) |
| Pitch demo guide | [12_PITCH_DEMO_GUIDE.md](docs/12_PITCH_DEMO_GUIDE.md) |
| Phase 1 task | [PHASE_01_FOUNDATION.md](prompts/PHASE_01_FOUNDATION.md) |
| Toolchain | [TOOLCHAIN.md](docs/TOOLCHAIN.md) |

Antigravity can continue directly in this repository. Read `AGENTS.md` and `docs/PROJECT_STATUS.md` first; do not re-scaffold the application or substitute another backend. The agreed stack is Next.js/TypeScript/Tailwind + PostgreSQL/Prisma/Better Auth, with Cloudinary planned for Phase 2 and Paystack for Phase 4. **No Supabase dependency.**

## Phase 2 workspaces

- Owner: `/admin/products` to add/edit/publish/archive products and upload photographs.
- Staff/owner: `/admin/inventory` to receive batches, inspect expiry/quarantine and view movements. Stock adjustments and costs are owner-only.
- Staff/owner: `/admin/sales/new` to record an already paid and handed-over shop/WhatsApp sale. A transfer screenshot is insufficient evidence. Sample catalogues produce labelled demo sale records only.

Signed product uploads require private Cloudinary environment configuration; see `.env.example`. No live provider upload has yet been verified. Month-only/unknown expiry units remain blocked. The first incomplete visual/media gate stays visible in PROJECT_STATUS.md.

## Phase 3 private demo

Set `BENNYC_DEMO_CHECKOUT=true` only in a dedicated development demo store, then run `npm run dev`. Production rejects simulation regardless of the flag. Receive sample stock before testing; no stock is invented by the seed. Live product pages offer a shopping bag, `/checkout` validates a fresh server quote and reserves stock, and `/orders/[id]` requires a private scoped cookie. Contact/address drafts stay on the server; tab storage contains only a draft reference for refresh recovery. `/preview` remains read-only.

Staff use `/admin/orders` to prepare and hand over orders. Owners configure approved delivery areas/fees at `/admin/delivery`; unmatched addresses cannot checkout for delivery. Simulated success commits allocation, pickup/dispatch deducts physical stock once, and delivered completion does not deduct again. See [IMPLEMENTATION_PHASE_03.md](docs/IMPLEMENTATION_PHASE_03.md) for the walkthrough, limitations and gate evidence. No real online payment, receipt delivery, paid refund or public deployment is enabled.

## Phase 4 development test payments

Configure a private Paystack **test** key in the server environment and set `BENNYC_PAYSTACK_TEST=true` for a dedicated development demo store. Live keys and production payment processing are rejected. The private order page offers hosted test checkout/verification. Owners use `/admin/payments` for bounded reconciliation, queued in-app receipts, paid cancellation, verified dashboard refund evidence and quarantined physical returns. No email/SMS is sent and no real refund is initiated by the app. See [IMPLEMENTATION_PHASE_04.md](docs/IMPLEMENTATION_PHASE_04.md) for setup, exact boundaries and pending merchant/provider evidence. CI provider fixtures are fault tests, not real settlement evidence.

## Phase 5 reports and operating controls

Owners use `/admin/reports` for Lagos-date sales/order reports and current stock snapshots. Real records are the default; sample records require a separate demo filter. Integer-kobo sales, refunds and extra captures are defined separately. CSV exports include one bounded page plus range totals, with spreadsheet formula escaping. Net flow is not profit.

`/admin/settings` persists owner-provided contact/policy text. `/admin/staff` manages existing memberships, revokes sessions on access changes and protects the last active owner. `/admin/operations` shows observed exceptions, receipt queues, ledger discrepancies and bounded job runs. Better Auth authenticator challenges and encrypted one-time recovery codes are implemented. No account credentials or real business details are invented.

A separate server-only `BENNYC_JOB_SECRET` authenticates `/api/internal/jobs/{payments,expiry,outbox}`. Idempotency keys, durable leases and run records support safe retries. No host schedule is provisioned. The CI-only `npm run test:restore` rehearses a PostgreSQL 17 custom-format backup into a fresh disposable database and verifies record fingerprints, receipt-backed stock balances, constraints, runtime permissions and restored staff authentication. It does not prove production or image-byte recovery. See [IMPLEMENTATION_PHASE_05.md](docs/IMPLEMENTATION_PHASE_05.md) and the [operating runbook](docs/OPERATIONS_RUNBOOK.md).
