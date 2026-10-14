# Phase 5 — operating reports and recovery controls

Requirements: FR15–FR16; TR07–TR10. Authorized continuation develops the operating code; it does not authorize a paid pilot, production database write, live payment or public launch. Earlier browser/media/merchant gates remain pending.

## Implemented scope

Owner reports use repeatable-read PostgreSQL snapshots, current owner authorization and explicit bounded date/filter schemas. Report days are Africa/Lagos midnight through the following midnight, with an exclusive end. Real data is the default; demo data has a separate explicit scope. Sales details are selected by paidAt, order details by createdAt. Counts and financial totals cover the full matching range, while detail pages/CSV contain at most 50 rows. Inventory quantities are current snapshots, with movement deltas for the selected dates; they are not historical stock reconstructions. Channel-filtered inventory is rejected because stock is shared.

Gross applied sales include the saved order total and delivery, attributed to the first applied successful capture by paidAt. Historical fully refunded sales remain in gross. Succeeded applied refunds use confirmedAt, including refunds of earlier sales. Net applied flow is gross less these refunds and can be negative. Extra captures and their refunds are separate. Created/cancelled-of-created orders and distinct movement-backed handoffs have explicit denominators. Pending/failed refunds do not reduce totals. No profit, provider settlement or bank balance is inferred. Kobo sums reject unsafe integers. Exports quote CSV fields and escape formula prefixes; projections exclude customer PII, costs, staff credentials and private notes.

Owner settings save contact details, business hours and plain policy text with a reason/audit. Missing details remain missing; entering text is not independent approval. Public settings/policies use explicit projections and escaped plain text. Changing settings cannot activate real ordering or remove demo isolation.

Existing staff access management rechecks current owner authority inside serialized transactions. A narrow security-definer database function validates the operation/owner, updates membership and revokes sessions. Runtime direct membership updates remain denied. Concurrent owner removal cannot remove the final active owner. Trusted private-terminal commands provision only new STAFF identities, refuse existing-account replacement, and recover active staff passwords using Better Auth's maintained hash. Recovery revokes sessions, preserves membership/MFA and records a system maintenance audit. There is no public provisioning/reset route or email sender.

Better Auth's supported two-factor plugin/client handles enrollment, password-login challenges, authenticator verification, encrypted backup codes, one-time consumption and locking. Auth schema was regenerated for pinned 1.7.7. Changing enrollment revokes old sessions at the database boundary; the library creates the verified session afterwards. Production owner business routes require enabled and verified enrollment, with setup access at `/staff/security`. Recovery codes are displayed in component memory only; no external QR service, browser storage or secret logging is used. Staff can enroll too. Password recovery does not bypass a lost authenticator.

Owner and dedicated machine-bearer job endpoints share durable leases and bounded run records. Each request has a validated idempotency key; successful repeats return the saved result, live leases return retryable busy, and expired leases can recover. Payment/refund reconciliation, hold expiry and private receipt outbox still use their idempotent domain operations. Results contain counts/stable errors, not secrets/provider payloads. No schedule is provisioned. The operations page reports observed queues, exceptions, ledger discrepancies, enrollment and configuration booleans; it is not a launch-approval checklist.

CI rehearses a PostgreSQL 17 custom-format dump into a newly created disposable database, refuses overwrite, compares every table's count/content fingerprint and checks receipt-backed physical/quarantine ledger balances. It reapplies all runtime grants, checks denied DDL/direct membership/history writes and price constraints, then performs real restored staff authentication using the same auth key and restricted runtime connection. Synthetic fixture data and dump remain in the ephemeral CI service. Media bytes, global role/secret recovery, production retention/RPO/RTO and provider reconciliation after a real outage remain separate unverified work.

## Files and setup

- `src/features/reports`, report API and `/admin/reports`: definitions, bounded queries, CSV and owner interface.
- `src/features/operations`, owner settings/staff/operations APIs/pages and machine jobs: access/configuration/observability/leases.
- `src/server/auth-config.ts`, staff authorization, MFA components/pages and fifth migration: maintained authenticator flow and production owner policy.
- `scripts/{staff-maintenance,lib/staff-maintenance,restore-check}.ts`, `grant-phase5.sql`, CI workflow and operations tests: trusted maintenance and recovery verification.

Apply all migrations and `scripts/grant-phase5.sql` after earlier grants. Keep the auth key private and recoverable; encrypted MFA data needs the correct key. Configure a separate random `BENNYC_JOB_SECRET` only for authorized scheduler use. The runbook defines operating steps and remaining deployment decisions.

## Verification checkpoint

| Check | Status | Evidence |
| --- | --- | --- |
| Local build/types/lint | PASS at implementation checkpoint | `npm run build`, `npm run typecheck`, `npm run lint` on managed Linux/Node 24 |
| Unit rules | PASS | `npm test`: 10 tests, zero failures |
| PostgreSQL report/access/recovery regressions | PENDING | New CI suite has not yet completed |
| Disposable backup/restore | PENDING | New CI rehearsal has not yet completed |
| Actual browser/operator/merchant/media gates | PENDING | No supported browser control or actual provider/real-shop configuration evidence |
| G5 operating/launch readiness | PENDING | Verified real data, operator/support, host monitoring/scheduling/rate limits/retention, production/asset recovery, budget and explicit launch authorization outstanding |

No dependency version or npm lockfile change. Production checkout/live payment remain closed. The trusted terminal is an administrative boundary; it does not replace identity verification or secret stewardship. Host-specific proxy/IP throttling cannot be safely assumed before a host is chosen. Existing database-backed auth/guest limits continue; production load and trusted ingress configuration remain pending.

Next task: verify the added PostgreSQL/HTTP and restore tests in disposable CI, record exact evidence, then complete the first outstanding supported-browser/media/merchant gate. No merge, deployment or paid pilot is performed by this phase.
