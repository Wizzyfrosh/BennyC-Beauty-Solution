# BennyC Beauty Solution

**Cosmetics & Makeup Venture** — a Next.js storefront and staff workspace.

Phase 1 is implemented for review. The storefront follows the supplied teal beauty-store reference: botanical hero, pale-mint feature strip, circular categories, product cards and a product banner. All generated packaging, demo prices and sample products are explicitly illustrative. No payments, checkout or inventory operations are enabled yet.

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

`psql` must receive the actual private migration connection from your terminal environment; it does not automatically load `.env`. On Windows, use your SQL client's query editor or the equivalent environment-variable syntax. The SQL file grants authentication lifecycle writes and read-only catalogue/membership access. It grants no application DDL or membership writes.

7. For sample data, set `BENNYC_DEMO_DATA=true` and `SEED_DATABASE_NAME=bennyc_development`, matching the actual database. Then run:

```bash
npm run db:seed
npm run owner:create
npm run dev
```

The seed is idempotent, refuses production/non-demo datasets and checks the actual database name. It creates 12 clearly marked sample products, size/shade variants and one unpublished draft. It creates no stock, orders or sales.

`owner:create` runs only in a private interactive terminal. It confirms the target database, hides password input, uses Better Auth's password hashing and creates the first owner transactionally. It refuses existing owners and never silently promotes an existing identity. Sign in at **/staff/sign-in**. Do not expose this script as an HTTP endpoint. Staff provisioning and owner recovery beyond this one-time bootstrap are later controlled operating tasks.

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

See [PROJECT_STATUS.md](docs/PROJECT_STATUS.md) for actual results and pending checks. Phase 2 starts with owner catalogue editing and physical inventory after G1 is verified.

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
