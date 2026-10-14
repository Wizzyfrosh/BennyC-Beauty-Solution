# Phase 3 — guest ordering and private demo

Requirements: FR08–FR10, FR12 and the protected-access portion of FR13; TR02–TR04, TR06–TR07. Continued with the user's explicit authorization while independent browser/media checks for earlier gates remain pending.

Implemented cart and quantity controls, server quote, Nigerian guest contact validation, pickup and owner-configured delivery matching, immutable snapshots, whole-basket FEFO holds, order-scoped access, staff queue, simulated confirmation and fulfilment. Checkout holds last 15 minutes. Cart content is convenience data only; it grants neither stock nor authority. Prices/fees are computed in integer kobo and frozen on the order.

The same stock lock service covers website checkout, counter sales and owner adjustments. Locks follow product → variant → batch → allocation → order. Unexpired held quantities and every paid commitment reduce availability. Expired holds are ignored using database time even without cleanup. Paid stock whose batch expires blocks handoff for resolution. Payment commits the allocation without changing physical stock. Pickup/dispatch consumes once with append-only movements; delivery completion never consumes again.

Guest sessions and order credentials use random 32-byte tokens; only hashes are stored. Guest identity scopes retry keys. Order IDs and a guest cookie alone cannot read an order. Scoped HttpOnly cookies expire in seven days and support revocation. Optional single-use access links expire in 24 hours and use URL fragments; exchange removes the fragment before sending a same-origin POST. No receipt email is sent. The customer projection omits contact information, staff, costs and allocation internals. Owner/staff queue includes the contact/address needed for fulfilment.

For refresh recovery, an expiring checkout intent saves the validated request on the server. Only the intent ID is stored in the tab's session storage; contact/address data are not stored there or in the cart. The same intent always uses the same retry key and can recover a committed order after draft expiry for the same active guest session. Failed/uncommitted expired intents require a new quote. Retrying cannot use another guest's intent.

Simulation needs `BENNYC_DEMO_CHECKOUT=true`, a development environment, a demo store and sample-only products. Production always rejects it, even when the flag is set. Simulation success is not provider settlement. Real online ordering remains closed until Phase 4. Failed simulation preserves the valid hold for retry. Explicit unpaid cancellation releases held stock and cannot be resurrected by simulation. Paid cancellation/refunds and genuine late financial success are Phase 4 work.

## Setup and private walkthrough

1. Follow README for a dedicated development database, all three runtime grant scripts and owner bootstrap. Set the development-only demo checkout flag.
2. Receive known-expiry sample stock at `/admin/inventory`; the seed does not fabricate stock.
3. Optionally configure sample delivery areas at `/admin/delivery`. Unknown addresses are rejected rather than assigned guessed charges.
4. Shop a live database-backed sample product, select its variant/quantity and add it to the bag. `/preview` stays read-only.
5. Review pickup/delivery and server total at `/checkout`, then reserve. Refresh recovery returns the same order. Use fictional contact details.
6. Simulate failure/success on the private order page. Confirm physical quantity has not changed on payment.
7. Open `/admin/orders`, prepare and hand over pickup, or dispatch then complete delivery. Inspect the single handoff movement and shared stock.
8. Test a private link in a second browser and deny an order-ID-only lookup. Never share a link publicly.

## Verification and limits

Local build/typecheck/lint and six unit tests have passed during development. Final PostgreSQL CI passed on `6469d4eb84ed66dfe97a70e7c69b8ea217e932cb`: all 32 integration tests and six unit tests passed with zero failures. Run: https://github.com/Wizzyfrosh/BennyC-Beauty-Solution/actions/runs/38523038561. The added real-HTTP suite covers final-unit contention, concurrent retry, mixed-basket rollback, online holds versus counter sales/adjustments, expiry without jobs, stale prices, malicious money fields, delivery fees, simulation/one-time handoff, private token isolation/expiry/revocation, guest revocation/throttling and refresh intent recovery. Earlier auth/inventory tests remain regression gates.

G3 remains **PENDING verification** until phone/desktop/keyboard demo checks are recorded; database evidence now passes. Browser control is unavailable here; no pixel-perfect claim is made. Queue displays the latest 50 orders; delivery lists are bounded to 100 areas. Add pagination/search before a larger operating catalogue. Guest session creation and access exchange use coarse shared throttles until production hosting supplies a trusted proxy identity; reservation/quote limits are guest-scoped. Phase 5 must finalize production limits, retention and jobs. Expired records are retained for audit and are not silently treated as current stock.

Next task: complete the browser/media checks and owner pitch walkthrough. PostgreSQL races, migrations, privacy and runtime privileges passed in disposable CI. Paystack test confirmation, receipts, reconciliation/refunds and live rollout remain later gates.

## Phase report

| Check | Result | Evidence |
| --- | --- | --- |
| Build | PASS | `npm run build`, local and GitHub Ubuntu/Node 24 |
| TypeScript | PASS | `npm run typecheck`, local and CI |
| Lint | PASS | `npm run lint`, no warnings |
| Unit tests | PASS | `npm test`: six tests, zero failures |
| Real PostgreSQL/HTTP | PASS | `npm run test:integration`: 32 tests, zero failures; PostgreSQL 17, real staff sessions and restricted runtime role |
| Production simulation guard | PASS | Actual production HTTP server denied both checkout and simulated confirmation with demo flag enabled |
| G3 visual/pitch | PENDING | Supported browser walkthrough and owner feedback not available in this environment |

Meaningful modules: `prisma/schema.prisma` and migration `20261014070000_guest_checkout`; `src/features/inventory/stock.ts`; `src/features/orders/{service,access,validation}.ts`; `src/server/{mutations,customer-route}.ts`; cart/checkout/order-status/admin-order components and their protected routes; `scripts/grant-phase3.sql`; `tests/integration/checkout.test.ts`. The dependency lockfile and generated image assets are unchanged. This evidence checkpoint changes documentation only, preserving the tested application.
