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
| Build/types/lint | PASS | `npm run build`, `npm run typecheck`, `npm run lint`; local checkpoint and final Ubuntu/Node 24 CI |
| Unit rules | PASS | `npm test`: 10 tests, zero failures |
| PostgreSQL report/access/recovery regressions | PASS | All 54 real PostgreSQL/HTTP tests, zero failures, restricted runtime role and actual maintained auth |
| Disposable backup/restore | PASS, isolated CI only | All 32 table fingerprints matched; 13 receipt-backed batches reconciled; restored login, runtime privileges, restrictive function ACLs and constraints verified |
| Actual browser/operator/merchant/media gates | PENDING | No supported browser control or actual provider/real-shop configuration evidence |
| G5 operating/launch readiness | PENDING | Verified real data, operator/support, host monitoring/scheduling/rate limits/retention, production/asset recovery, budget and explicit launch authorization outstanding |

No dependency version or npm lockfile change. Production checkout/live payment remain closed. The trusted terminal is an administrative boundary; it does not replace identity verification or secret stewardship. Host-specific proxy/IP throttling cannot be safely assumed before a host is chosen. Existing database-backed auth/guest limits continue; production load and trusted ingress configuration remain pending.

## Final CI evidence

Application revision: `f5d74fe5e6199c2f2816b3426a196589c707848e`; exact source tree: `c7d7481e795bffe429f34df3ea7c8ff6885161f3`. Run: https://github.com/Wizzyfrosh/BennyC-Beauty-Solution/actions/runs/38561497710, job 115843412753, completed successfully 14 October 2026 UTC. Build/typecheck/lint, all five migrations and runtime grant files, repeated seed, 10 unit tests, all 54 integration tests and the dump/restore rehearsal passed. The final evidence checkpoint changes documentation only.

TC27 passed owner authorization, bounded calendar dates, Lagos midnight boundaries, explicit real/demo separation, historical/partial refunds, negative net flow, extra captures/refunds, allocation-aware current stock and formula-safe CSV. FR16/TR04/TR07/TR09 passed owner-only settings without demo-mode switching, restricted membership mutation, concurrent last-owner protection/session revocation, trusted staff provisioning/password recovery, authenticator enrollment/old-session revocation, encrypted recovery data, one-time code reuse rejection, production owner enrollment/challenge checks and dedicated machine credentials with stable job retries/lease recovery. Prior catalogue/stock/checkout/payment faults remain green. TC28's disposable data/permission/auth/receipt-backed-ledger restoration checks passed; actual production/provider reconciliation and image-byte recovery remain pending, not inferred from fixture fingerprints.

First run 38533387923 stopped at the fifth migration because `current_role` was used as a reserved PL/pgSQL variable; it was renamed. Run 38533639848 applied all migrations and passed 51 of 54 integration tests. Its remaining failures were the legacy expectation of an absent staff-management route, the maintained library's 401 rejection of a consumed backup code (not 400), and the legacy overview handler hiding the MFA-required error code. The tests were aligned to the implemented denial contracts and the overview handler now preserves the setup-required code/message. Restore grants also explicitly revoke PUBLIC execution because a no-ACL restore recreates default function permissions; the rehearsal verifies this boundary. No failed test was disabled or bypassed.

Next task: complete supported-browser phone/desktop/keyboard review, configured Cloudinary upload and the actual dedicated merchant test/callback/webhook/refund evidence. Collect independently verified owner inputs and operator/support/host/recovery configuration before G5. No merge, deployment or paid pilot is performed by this phase.
