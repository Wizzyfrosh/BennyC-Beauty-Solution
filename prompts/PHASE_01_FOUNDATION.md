# Phase 1 — Foundation implementation task

Read AGENTS.md, MASTER_AI_PROMPT.md, docs/PROJECT_STATUS.md and the Phase 1 section of docs/06_IMPLEMENTATION_PLAN.md. Implement FR01–FR03 and the applicable technical/access requirements. This task builds the foundation only.

## Inspect and prepare

Inspect current files, Git changes, scripts and installed Node/npm/Git. Preserve working code and the document pack. If a new app is needed, scaffold Next.js App Router, TypeScript and Tailwind at the current project root. A non-empty documentation folder is not permission to delete it: use a temporary scaffold and merge safe new files if the generator requires an empty directory.

Verify compatible supported dependency versions and pin them. Create a single lockfile, development/build/lint/typecheck scripts, environment validation and setup instructions. Do not invent a successful install or use force flags to conceal conflicts. Initialize Git only if needed; do not push or publish as part of this task.

## Foundation backend

Use PostgreSQL with Prisma and Better Auth for real staff sessions. Verify the selected adapter/framework versions together and record them. Configure the Next.js Node server with server-only database modules. Confirm the database host/name identifies the designated BennyC development database before schema changes. If credentials are unavailable, complete safe unblocked work and leave integration checks pending with exact setup instructions.

Generate Better Auth's required auth models, then implement initial store_settings, staff_members, categories, products, product_variants and product_images records from docs/05_BACKEND_SCHEMA.md. Match membership/actor ID types to the generated auth schema. Use reproducible Prisma migrations, a restricted runtime database role and server authorization. Do not expose private costs/customer fields or invent inventory tables prematurely.

Create an idempotent development-only seed of approximately 12 fictional beauty products across lotion, perfume, makeup and accessories. Include several size/shade/volume variants and at least one unpublished product. Mark the dataset as a demonstration. Use neutral local placeholders until approved images exist. Do not fabricate branded product photos or claims.

Prepare a trusted one-time owner bootstrap script using library-supported account creation/password hashing and private credential entry. Keep public registration disabled. Never hardcode a password, expose a bootstrap route or assign privilege from editable profile fields. Owner and staff must be current active membership roles. Ordinary signed-in users are not staff.

## Screens

- Homepage with BennyC Beauty Solution and Cosmetics & Makeup Venture, clear categories and Shop products action.
- Read-only catalogue with category filtering, name search and bounded pagination.
- Product detail with correct variant labels/prices and approved/placeholder images.
- Real staff sign-in/sign-out and a protected dashboard shell.
- Loading, empty, error and not-found states.

Follow docs/04_DESIGN_BRIEF.md: the user-selected teal botanical reference, pale-mint surfaces, serif headings and readable responsive layouts. No invented address, contact link, delivery promise, review count, stock number or sales figure. Until later phases exist, do not render active checkout controls or imply stock availability is connected.

Protect routes, server actions and domain services; the browser has no database credentials or direct table API. Never add a fake session, authentication bypass or localStorage database to make an unconfigured demo appear complete. Secrets stay in ignored environment files and server-only modules. Create .env.example with variable names/placeholders; require PostgreSQL and auth configuration, but not Paystack or Cloudinary credentials yet.

## Required checks

Run build, lint and typecheck, fixing meaningful failures. Complete TC01–TC04 and the relevant TC30 checks from docs/09_TESTING_AND_ACCEPTANCE.md: public draft exclusion; correct variants; anonymous/non-staff/inactive denial; permitted active staff access; client self-promotion rejection; profile/role edits do not grant authority. Inspect public responses for private information and verify the database runtime role cannot change schema and auth tables are not exposed by business APIs.

Check a narrow phone viewport and desktop, including navigation, forms and error states. If the backend is unavailable, identify which checks cannot be run; do not report G1 as PASS. Static screens and a clean build do not prove authentication or server authorization.

## Finish

Update README setup instructions without deleting the document map. Record actual versions in docs/TOOLCHAIN.md and evidence in docs/PROJECT_STATUS.md. Report changed files, run commands/local URL, actual check outcomes, first-owner setup, remaining blockers and the exact next action.

Do not implement product editing, stock operations, cart/checkout, live payments, production hosting or multi-business features in this phase. The next phase begins with catalogue operations and physical inventory only after G1 is verified or the owner explicitly changes the sequence.
