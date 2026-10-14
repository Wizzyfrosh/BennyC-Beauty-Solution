# Operating and recovery runbook

This is a procedure for review and training, not evidence that the actual shop operator or production host has completed it. The current branch has development/test payment handling and sample isolation; real online ordering remains closed.

## Staff access and recovery

Bootstrap the first owner with the existing private `npm run owner:create` procedure. From a trusted private terminal with the intended DIRECT_URL, use `npm run staff:provision`; confirm the database name, independently verified email, operator/reason and hidden password. It creates only a new STAFF identity and refuses an existing email. Communicate credentials through the agreed private channel; this repository sends no messages. Owners use `/admin/staff` to promote/deactivate existing members with a reason. Every role/activity change revokes sessions; the last active owner cannot be removed.

At `/staff/security`, confirm the current password, enter the manual setup key into a time-based authenticator (six digits, 30 seconds), save the one-time backup codes privately and verify a current code. Enrollment revokes prior sessions. Production owners cannot access business routes until enrollment is verified. Password login then requires authenticator verification; one-time backup codes provide the supported lost-device route. Do not put setup keys/recovery codes in screenshots, chat, shared documents or Git.

For a forgotten password, first verify identity and authority outside the app. A trusted database operator runs `npm run staff:recover` against the confirmed target, entering a new hidden password and operator/reason. It requires an active staff identity with a credential account, revokes all sessions, preserves role and MFA, and audits the action. It is not a way to reactivate/promote staff or bypass a lost authenticator. If both device and codes are lost, escalate to the designated database/account custodian; there is no automatic MFA-reset command. Preserve evidence and use a separately reviewed, identity-verified maintenance procedure before any enrollment reset. Do not expose migration credentials as application credentials.

## Daily stock and sales training

1. Receive a verified SKU/batch/quantity and expiry at `/admin/inventory`. Unknown/month-only expiry stays blocked. Record quarantine for damaged/unverified units; owner costs remain private.
2. Confirm actual cash/transfer/POS payment and handoff before recording a shop/WhatsApp sale at `/admin/sales/new`. A screenshot is insufficient. Record every channel promptly; all channels share stock.
3. Prepare paid orders at `/admin/orders`. Pickup/dispatch consumes stock once; delivered completion does not consume again. Verify customer/fulfilment details against the order, not a guessed address.
4. Owners review exceptions at `/admin/payments`. Provider refunds use authenticated verified evidence; a request/pending state is not a refund. Physical returns are separately received into quarantine against handed-over lines.
5. Review `/admin/operations` queues/exceptions/ledger discrepancies and run bounded jobs until drained. Escalate money/stock mismatches; do not delete financial events or edit movement history to conceal them.
6. Export `/admin/reports` with the intended Lagos period/channel and REAL or DEMO scope. Save every detail page needed; one CSV is one page plus range totals. Reconcile actual channel/provider records separately. Net flow is not profit or bank settlement.

Record the named operator, trainer, completion date, failures and escalation/support responsibilities during actual training. They are currently unassigned/unverified.

## Jobs and monitoring

Owner buttons invoke bounded payments/expiry/outbox jobs. A selected host scheduler may POST `{}` to `/api/internal/jobs/{kind}` with a private dedicated bearer secret and a stable `Idempotency-Key` for each logical run. Retry the same key after a timeout/busy/error; a succeeded repeat returns its recorded result. A new scheduled occurrence needs a new key. The lease is 15 minutes; do not assume a job is stalled before examining its run and underlying facts. Payment and refund reconciliation must drain, and hold availability remains correct even before cleanup.

No scheduler or external monitoring is configured by this branch. When hosting is chosen, verify invocation timeouts, job concurrency, secret injection, trusted ingress/IP rate limits, HTTPS/TLS/pooling, retention and alert delivery. Agree monitored exceptions, queue age, failed/stale jobs, ledger mismatch, backup failures, provider timeouts and support recipients without leaking secrets or customer payloads. Configuration booleans show presence only and do not prove a provider works.

## Backups, restore and rollback

CI's `npm run test:restore` is restricted to its localhost disposable bennyc_ci service. It creates a new bennyc_ci_restore database, never overwrites a target, and checks all table fingerprints, receipt-backed ledger balances, runtime permissions, constraints and restored staff login. Test fixtures with artificial root-created balances are not represented as production reconciliation proof. No dump is uploaded as a CI artifact.

Before production, agree actual host backup retention, encrypted offsite storage, recovery point/time objectives, secret custody and approved media source-byte recovery. A PostgreSQL dump does not supply Cloudinary image bytes or safely restore global role/password/secret configuration. Maintain reviewed grants/migrations plus private service configuration separately. Better Auth encrypted MFA data needs the original auth key; key replacement is a separate controlled rotation requiring session/recovery testing.

Rehearse on a newly created non-production target using the selected host's current supported mechanism. Restore schema/data without carrying broad source ACLs, provision the intended non-superuser runtime role, reapply reviewed grants, verify row/content counts, media links and bytes, historic orders, ledger reconciliation and authenticated access. Test incorrect/cross-role access and actual recovery time. Record findings before claiming production recovery readiness.

After an actual live-data incident, preserve current state and stop unsafe new checkout. Reconcile charges/refunds/handoffs/returns/receipts since the backup against independent provider and operator records before reopening; an old backup alone can lose paid orders or invent stock. Roll application code back only to a known schema-compatible release. Do not delete or fabricate financial events to obtain matching numbers.

## Outstanding launch inputs

Verified real catalogue/ingredients/media rights/prices/stock; owner-approved contact/pickup/delivery/policies; actual merchant test charge/refund/webhook evidence; supported phone/desktop/keyboard walkthrough; selected host and recurring costs; notification sender if required; schedule/monitoring/retention/asset recovery; named trained operator/support custodian; paid pilot terms and explicit owner launch authorization are all pending. No live smoke transaction or public publication is authorized here.
