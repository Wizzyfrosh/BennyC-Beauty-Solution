# Vercel PostgreSQL and staff setup

The user has deployed the storefront at https://benny-c-beauty-solution.vercel.app. Database account access and configuration are not yet verified. `/preview` works independently; the real catalogue and staff authentication require PostgreSQL. This runbook prepares setup, not a completed connection or commercial launch.

## Account and database

Connect Neon and Vercel through their private account integrations. Identify the existing Vercel project, team and intended database before creating anything. Review the account's plan and costs; creating a paid resource requires separate authorization. Use an isolated development/staging database first. Keep staging and production secrets separate.

Retain this repository's Prisma and Better Auth implementation. Do not enable a second hosted authentication system. The Vercel integration may provide connection variables, but its default administrator credentials must not become this application's runtime credentials.

Neon roles created through its Console/API/CLI receive privileged membership. Create the application's restricted LOGIN role through SQL instead, with `NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS`, no privileged memberships and no schema ownership. Set the role password privately. Use the existing five grant files after migrations; do not grant broad ownership or all privileges.

## Private configuration

| Variable | Where and purpose |
| --- | --- |
| `DATABASE_URL` | Vercel server environment: TLS-verified pooled connection using the restricted runtime role |
| `DIRECT_URL` | Private migration/operator environment: unpooled administrator/migrator connection; not needed by the deployed runtime |
| `BETTER_AUTH_URL` | Exact HTTPS origin of the intended deployment; production origin is `https://benny-c-beauty-solution.vercel.app` |
| `BETTER_AUTH_SECRET` | Stable privately generated random secret, at least 32 characters, separate per environment |

Follow `.env.example` for other server configuration. Keep demo checkout and Paystack test flags disabled on the deployed production site. Do not expose any secret through `NEXT_PUBLIC_*`, Git, chat, logs or screenshots. Preserve certificate verification. Keep the existing Prisma 7 TCP adapter and pinned dependencies.

## Database initialization

From a trusted private operator environment, verify the actual host, branch and database name, then run `npm run db:migrate`. Apply `scripts/grant-runtime.sql` and `scripts/grant-phase2.sql` through `scripts/grant-phase5.sql` with `psql`, using the direct migration connection and the explicit runtime role as shown in README.md. Do not add migrations or seeding to every Vercel build. Never reset an existing shop database.

For a dedicated development sample store, use the guarded seed procedure in README.md. For an empty real catalogue, **do not run the demo seed**. As the trusted administrator, initialize only the settings row after checking that the target is the intended empty real store:

```sql
INSERT INTO store_settings (id, updated_at)
VALUES (1, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;
SELECT id, name, timezone, currency, demo_data FROM store_settings WHERE id = 1;
```

The schema supplies the agreed brand, NGN, Lagos timezone and `demo_data=false`. This does not create products, stock, staff, policies or contact details. Stop if an existing row is a demo store; do not silently convert its data. Runtime settings permissions intentionally do not include INSERT.

## First owner and verification

Run `npm run owner:create` in a trusted private interactive terminal against the confirmed database. It hides password entry, uses Better Auth and refuses existing owners. There is no public signup/bootstrap endpoint. Do not transmit an owner password in chat or a connector argument. A private terminal or another reviewed provider-supported secure input flow is still required for this step.

After saving server variables, redeploy the intended Vercel environment. Sign in at `/staff/sign-in`, enroll the authenticator at `/staff/security`, securely retain recovery codes, then verify the owner workspace. Production owner operations require completed MFA. Use `/admin/settings` for owner-approved business information and `/admin/products` for actual products; stock must come from verified receipts.

Verify catalogue reads, ordinary/unauthorized staff denial, sign-in/sign-out, MFA and variant price changes. Review entrance/scroll/touch motion on a phone and reduced-motion mode, plus desktop keyboard use. Record results in PROJECT_STATUS.md. Provider payments, media uploads, scheduling, recovery and launch gates remain separate.

## Provider references reviewed

- https://neon.com/docs/guides/vercel-overview
- https://neon.com/docs/guides/prisma
- https://neon.com/docs/manage/roles

Reviewed 14 October 2026. Account creation, migration execution, secrets, first-owner provisioning and redeployment remain pending verified private access.
