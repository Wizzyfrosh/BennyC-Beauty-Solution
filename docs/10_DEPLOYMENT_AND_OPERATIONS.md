# 10 — Deployment and operations

Version 2.0 | Runbook to complete before the paid pilot. No environment has been deployed by this pack.

## Environments

| Environment | Data/payment mode | Purpose |
| --- | --- | --- |
| Local application + development database | Synthetic products and provider test/simulation as explicitly configured | Implementation and focused verification |
| Private staging | Synthetic or permission-approved non-sensitive data; provider test mode | Staff rehearsal and release checks |
| Production | Verified real catalogue/stock and merchant live account | Authorized customer transactions |

Choose hosting that supports the Next.js Node server, PostgreSQL connections/pooling, secrets, webhook endpoints, bounded media uploads and required jobs. A static-only export cannot provide these server workflows. Verify actual provider capabilities, quotas, backup availability and cost before selecting a plan. No free-tier availability, uptime or recovery guarantee is assumed.

Use a merchant account and domain owned by the business. Restrict developer access to what is required. Each environment has its own credentials and callback/webhook configuration. Confirm database host/name and environment before migrations; never apply dev seeds to production.

## Database, authentication and media setup

Configure PostgreSQL backups, verified remote TLS, runtime connection pooling and separate migration credentials. Keep the application role non-superuser and without schema-change rights. Size connections for the hosting runtime; verify transactions and row locks work under the selected pooler. Store schema and reviewed SQL changes in Prisma migrations. Generate Better Auth models from its actual configuration before migration; do not hand-edit a live auth schema.

Set the production Better Auth origin, secrets and secure-cookie configuration. Keep public signup disabled, verify first-owner recovery, revoke demo sessions and test inactive-staff denial. Configure the selected supported MFA capability and record its recovery procedure. Use only approved origins; a preview wildcard must not silently become a production auth setting.

Use a separate Cloudinary environment/account boundary for development media, configure owner-only server uploads, and retain approved source images with an agreed recovery process. The database stores media identifiers, not the image bytes. Confirm provider quotas, request limits and actual plan costs before committing to a host.

## Release checklist

- G1–G4 evidence and the relevant G5 checks are recorded; unresolved P0 failures are listed as blockers.
- Domain/contact details, catalogue, prices and physically counted stock are verified by the owner/operator.
- Delivery areas/charges, tax treatment, pickup details, refund/returns handling and privacy notice are agreed.
- Production simulation is disabled and rejected by configuration validation. No sample staff password or fake product data remains.
- Public/staff/customer authorization is tested against the release configuration. Owner access and recovery are confirmed.
- Provider webhook signature/verification and pending-payment reconciliation are configured; test references and live references are not mixed.
- Scheduled jobs for holds, reconciliation and outbox retries have authenticated access and observable outcomes.
- Backups, asset recovery, support contacts and rollback steps are documented and rehearsed.
- The owner has authorized the public launch and ongoing service costs. A deployment preview is not that authorization.

## Deployment procedure

Build and validate the version to release; review migrations for compatibility with the currently running application; back up according to the agreed plan; apply reviewed Prisma migrations to staging with the migration credential; run smoke checks; prepare the production environment; apply the approved production rollout; inspect logs and core flows; record version/time/operator.

Prefer backwards-compatible additive database changes. Do not assume rolling back application code safely reverses a destructive migration. Keep old code compatible during the transition, or schedule a controlled maintenance window.

Only perform a live smoke payment under explicit business authorization, using a designated small transaction and a documented fulfilment/refund outcome. Reconcile it so reports and inventory remain truthful.

## Daily staff routine

At opening: inspect paid orders/exceptions, ensure previous handoffs are recorded, review low-stock/expiry alerts and check service availability.

During trade: record every receipt and sale at the time it happens; verify actual counter payment; prepare and hand over orders through the app. If connectivity fails, use the agreed numbered manual record and reserve/limit online stock operationally until reconciliation. Do not claim an offline-first mode has been built.

At closing: compare app payment records with cash/provider/terminal records; compare key stock movements with physical activity; inspect unresolved refunds/extra charges and failed notifications; record corrections with reasons. Revenue, payment settlement and bank balance are different measures.

## Monitoring and jobs

Track payment exceptions, pending attempts past a threshold, webhook processing failures, outbox retries, failed jobs, stock constraint errors and staff access failures. Use request/operation IDs without logging secrets or full customer payloads. Alert a named operator through a separately configured channel; do not imply automatic messaging exists before it is connected.

Hold cleanup must not release committed paid allocations. Reconciliation must query unresolved provider references and use the same confirmation logic as webhooks. Job retries must not duplicate receipt messages, refunds or physical movements. Define thresholds and cadence from the pilot and record the actual configuration.

## Backup, restore and rollback

Confirm database backup coverage, retention, restore granularity and asset backup separately. A database backup may not restore uploaded image bytes. Agree recovery point/time objectives with the business; do not promise figures the chosen plan cannot meet.

Rehearse restoration into a non-production database/environment. Check row counts, catalogue/media links, permissions, historic orders and movement reconciliation. Keep keys/environment configuration out of ordinary data exports and manage their recovery securely.

If a restore is required after live sales, first preserve the current state and stop unsafe new checkout. Reconcile provider transactions, refunds, handoffs and receipts since the backup before reopening. Blindly restoring an old database can lose paid orders and invent stock.

Application rollback uses a known previous release compatible with the database. Financial events are reconciled, not deleted to make reports look correct. Record incident cause, impact and prevention steps.

## Handover and commercial support

Hand over domain/merchant ownership, account recovery responsibilities, staff instructions, exports, recurring costs, support hours, escalation contacts and a change-request process. Agree who uploads products and pays provider fees. Define data export and exit arrangements so the business is not dependent on undocumented developer access.
