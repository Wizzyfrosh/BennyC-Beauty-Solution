# Phase 4 — test payment handling and resolution

Requirements: FR11, FR12–FR14; TR03–TR06, TR08–TR09. User authorized continuation after Phase 3. Earlier visual/media gates remain pending; this does not declare production readiness.

Implemented server-only Paystack test initialization and authenticated verification, raw-body HMAC SHA512 webhook authentication, immutable expected payment values, append-only sanitized financial events, late-success allocation, extra-charge retention, owner refund/cancellation/return controls, protected private receipts and owner-triggered reconciliation/expiry/outbox jobs. Existing simulation uses the same successful-payment/allocation routine. No live key, production checkout, real refund initiation, external message or public website deployment is enabled.

Verification compares the saved reference, integer-kobo amount, currency and test environment. Callbacks/status verification, signed webhooks and reconciliation converge on one transactional confirmation routine. Product/variant/batch/allocation/order locks precede payment locks; provider network calls occur outside transactions. Duplicate events cannot create another capture/allocation. A later failed attempt cannot downgrade a paid order. Provider objects store only required reference/ID/amount/currency/mode/status; raw card, authorization and customer payloads are not persisted.

Late genuine test success reuses valid holds or atomically reacquires the full eligible basket. If unavailable, money remains recorded as paid with a stock exception/refund obligation and no partial allocation. Explicitly cancelled orders remain cancelled. Additional successful attempts remain distinct, create an overpayment/refund obligation and do not replace the original applied capture. A customer sees a limited needs-attention message; internal exception codes remain private. Paid allocations are still consumed only at pickup/dispatch.

Owner pre-handoff cancellation releases allocations and records the refund obligation. Paystack test refunds are initiated manually in its dashboard; enter the refund ID for authenticated server verification. The app checks refund ID, matching captured transaction, amount, currency and test domain. Pending is not refunded; only verified processed results affect refund totals. Partial refunds are retained. Refunds of extra charges leave the original payment status intact. Signed refund notifications can register external provider facts; conflicts remain durable events for owner resolution. Simulated refunds require an explicitly simulated sample payment and are blocked in production. Manual counter refunds require current owner authority and explicit confirmation of the actual refund channel/reference; a screenshot is insufficient. Sample counter refunds remain simulated.

Returns record positive physical and quarantine movements against a sold line and its original batch. They cannot exceed handed-over units minus prior returns. Retries create one movement. Refunds never change physical quantity, and physical returns never change money status. Existing owner inspection/release rules continue to block expired stock.

The durable outbox is created with confirmation/fulfilment changes. The current delivery target is **private in-app receipt**, published by the owner job; no email/SMS provider was selected or invoked. Queued receipts do not undo paid orders. Receipt publication and an outbox completion record are atomic; duplicate jobs cannot create duplicate receipts. Database failure rolls back the publication so queued work can retry. External receipt/status email delivery is explicitly deferred until an authorized sender/provider is configured; it is not claimed as complete.

## Setup and routes

Apply `scripts/grant-phase4.sql` after all migrations and earlier grants. Configure a private development `sk_test_` key and `BENNYC_PAYSTACK_TEST=true` with the existing dedicated demo store/checkout configuration. No secrets should be pasted into chat. Production and live keys are rejected. Default provider origin is fixed to the official API. The loopback override is permitted only for non-production CI with the `bennyc_ci` runtime URL and exact fixture address; it is not a deployed provider mode.

- Customer: existing private order page offers hosted **test** checkout and authenticated status verification; `/orders/[id]/receipt` requires the scoped order cookie.
- Provider: `/api/webhooks/paystack`, signature checked before parsing/processing. Unknown charge references are recorded minimally and never create orders.
- Owner: `/admin/payments`, and protected `/api/admin/jobs/{payments,outbox,expiry}`. Jobs are manually triggered authenticated endpoints; no hosting scheduler or machine credential is fabricated. Bound batches must be drained/re-run until empty.
- Owner order endpoints: `cancel-paid`, `refunds`, `returns`. Staff cannot authorize these financial/correction actions.

Private test walkthrough: receive sample stock → guest checkout → open Paystack hosted test page → verify server status/webhook → inspect capture/event/allocation → publish private receipt → fulfil once → record a quarantined return independently from verified refund. Repeat with delayed success after expiry, a cancelled order, a second captured attempt and a partial refund.

## Evidence at implementation checkpoint

Eight focused unit tests pass. Local typecheck/lint/build are being finalized and new PostgreSQL fault tests are queued for GitHub CI. CI's isolated loopback provider fixture exercises real HTTP/signature/server verification, database locks, snapshots and authorization; it does **not** prove an actual Paystack merchant transaction or settlement. G4 remains **PENDING** real provider test evidence, supported browser/pitch checks and authorized external notification integration.

No new dependency/lockfile change. New modules are `src/features/payments/{provider,service,confirmation,rules,owner-service,refund-events,outbox}.ts`, the fourth migration/runtime grant, customer payment/receipt routes/components, owner resolution UI and `tests/integration/payments.test.ts`.

Limits: only development test mode is supported; customer checkout still uses isolated sample data. Manual dashboard refund initiation is intentional and explicitly documented. Jobs are bounded (20 records), owner-triggered and not scheduled. Queue/financial list remains the latest 50 orders. Production retention, notification sender, machine-job authentication/scheduling, trusted network throttling and paid launch are later operating decisions. Pending external refund conflicts require owner review rather than silent state rewrites.
