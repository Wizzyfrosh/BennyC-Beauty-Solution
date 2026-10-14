# 07 — API contracts and server operations

Version 2.0 | Proposed contracts. Implement and validate them against the chosen Next.js version. SQL names are snake_case; HTTP JSON fields are camelCase.

## Shared conventions

Money is integer kobo and currency is NGN. Business IDs are UUIDs; auth user/staff identifiers follow Better Auth's generated string type; provider references are opaque strings. Timestamps are ISO 8601 instants; customer-facing dates use Lagos time. Server inputs use explicit validation schemas with length, quantity and payload limits. Reject unexpected privileged fields such as role, paymentStatus, unitPrice or stock balance.

Use HTTP 400 for invalid input, 401 for missing authentication, 403 for a known unauthorized staff operation, 404 for unavailable public products or inaccessible customer orders, 409 for stale totals/stock/state or idempotency conflicts, 429 for rate limits and 503 for a recoverable dependency failure. Do not expose raw SQL/provider errors.

Error shape:

```json
{
  "error": {
    "code": "STOCK_CHANGED",
    "message": "An item in your basket is no longer available.",
    "retryable": false,
    "requestId": "opaque-request-id"
  }
}
```

Mutation requests with retry risk use an `Idempotency-Key` header. Scope it to the action and verified staff identity or server-issued guest session; store a request hash. Same key/same body returns the same business result. Same key/different body returns 409. Do not treat a guessed idempotency key as permission to read an order.

## Staff authentication boundary

Mount Better Auth's supported Next.js handler under `/api/auth/[...all]` or its configured equivalent. Use its documented login/logout/MFA endpoints rather than building a second password/session API. Without an approved email sender, password recovery is a trusted private-terminal maintenance command using the library's maintained hashPassword function, with session revocation and audit; no public reset endpoint is exposed. Public registration is disabled. Trusted private-terminal staff provisioning creates a new identity using library-generated credential fields/password hashing and STAFF membership; an owner can subsequently manage the membership in the protected app; logging in alone never grants staff authority. Check current session and membership on every protected operation.

## Public catalogue

| Method/path | Input | Output and rule |
| --- | --- | --- |
| `GET /api/catalog/products` | bounded query, category, brand, page/cursor | Published public projections with bounded pagination |
| `GET /api/catalog/products/[slug]` | slug | Public product, active variants and approved images; 404 for unpublished |
| `GET /api/store` | none | Approved public settings and configured fulfilment options |

Do not return supplier costs, staff records, private notes or raw batch balances. Display an availability state after inventory exists; Phase 1 is read-only and must not imply a stock integration is complete. Server-rendered pages may call the same repository directly rather than making unnecessary internal HTTP requests.

## Checkout and order access

| Method/path | Input | Responsibility |
| --- | --- | --- |
| `POST /api/checkout/quote` | variant IDs/quantities, fulfilment/address/zone | Recalculate current items/fees, report a quote version, no stock reservation |
| `POST /api/checkout` | basket, accepted quote version, contact, fulfilment, idempotency key | Revalidate quote, create immutable order and all holds atomically |
| `POST /api/orders/[id]/payment-attempts` | authorized order context, request key | Create/reuse saved attempt, initialize hosted payment from server totals |
| `GET /api/orders/[id]` | staff auth or order-scoped session | Limited customer status or permission-appropriate staff view |
| `POST /api/order-access/exchange` | high-entropy link token | Verify hash/expiry/revocation; issue scoped HttpOnly session |
| `POST /api/orders/[id]/cancel` | scoped customer session or staff auth, reason | Customers can cancel an unpaid unfulfilled order; paid cancellation needs owner authority |

Illustrative checkout request — values are fictional and do not describe real inventory:

```json
{
  "items": [{"variantId": "00000000-0000-4000-8000-000000000001", "quantity": 1}],
  "acceptedQuoteVersion": "server-calculated-version",
  "contact": {"name": "Demo Customer", "email": "demo@example.com", "phone": "DEMO_ONLY"},
  "fulfilment": {"method": "pickup"}
}
```

The example phone is deliberately a placeholder, not a valid production request. The schema validates real contact formats in implementation. Client-supplied monetary fields are not accepted. Checkout response contains the order ID/reference, server totals, hold expiry and next action; protected access is issued to the creating guest session, not exposed through a public order lookup.

A quote version is a consistency check, not an authorization credential. Recalculate before saving. Reject changed totals for customer reconfirmation. A changed address/basket on an unpaid order requires explicit cancellation/new checkout in P0 rather than rewriting a provider amount already initialized.

Payment initialization failure must preserve recoverable attempt state. An uncertain provider response does not justify a new charge without checking the existing reference. Only return a provider-generated, validated hosted checkout URL; do not accept a client-controlled redirect destination.

Protected email links can carry a token in the URL fragment and exchange it via POST, keeping it out of ordinary URL request logs. The exchange creates a scoped Secure/HttpOnly cookie in production. Redact tokens from telemetry; no third-party analytics on the access-exchange page.

## Staff operations

| Method/path | Permission | Input/behaviour |
| --- | --- | --- |
| `POST/PATCH /api/admin/products[/id]` | Owner | Validated catalogue data, publication invariants and audit |
| `POST/PATCH /api/admin/variants[/id]` | Owner | SKU/options/price; preserve historic order snapshots |
| `POST /api/admin/product-images` | Owner | Bounded validated server upload to Cloudinary; save trusted asset metadata |
| `POST /api/admin/inventory/receipts` | Active staff | SKU/batch/quantity/expiry and operation key; owner-only cost input |
| `POST /api/admin/inventory/adjustments` | Owner | Count change/quarantine/write-off, required reason and request key |
| `POST /api/admin/sales` | Active staff | Basket, actual payment channel/reference; atomic completed counter sale |
| `GET /api/admin/orders` | Active staff | Bounded queue filters and pagination |
| `POST /api/admin/orders/[id]/transitions` | Active staff or owner as required | Allowed target state and idempotent handoff |
| `POST /api/admin/orders/[id]/refunds` | Owner | Refund request/evidence, never instant assumed success |
| `POST /api/admin/orders/[id]/returns` | Owner | Sold-line quantities, reason and quarantine receipt |
| `GET /api/admin/reports/[kind]` | Owner | Defined date range/channel filters, safe export |
| `GET/POST /api/admin/staff` | Owner | List/manage existing memberships, audited role/activity changes, session revocation and last-owner protection |

Path IDs never override server authorization. Staff receipt operations must reject cost fields unless the actor is owner. Recheck stock/role inside relevant Prisma transactions; do not trust a submitted actor ID.

## Provider and job entry points

`POST /api/webhooks/paystack`: read the documented payload representation, verify the provider signature, validate event structure and correlate the saved attempt. Check expected amount/currency/reference/environment using verified provider data. Use timing-safe signature comparison. Durably persist the event/state change before acknowledging successful processing. If durable processing fails, return a retryable failure; do not acknowledge an event that exists only in memory.

Callbacks and reconciliation call the same confirmation service. Relevant outcomes include confirmed, already_processed, pending and paid_exception. Unknown references/events should be safely logged with minimal metadata and investigated; never create a paid order directly from unrecognized webhook content.

Authenticated job routes/tasks: expire holds; reconcile pending attempts; process notification outbox. Jobs are inaccessible to ordinary public callers and are idempotent. Reconcile refund status as well as charge status. Verify the hosting provider's current scheduling mechanism before choosing implementation details.

## Contract verification

Use shared validation types where practical, but database constraints remain independent safeguards. Test direct invalid requests, cross-order access, repeated mutation keys, modified payloads, stale totals and provider retries. An endpoint returning HTTP 200 with a fabricated success body does not satisfy its contract.

## Implemented Phase 5 contracts

`GET /api/admin/reports/{sales,orders,inventory}` accepts strict `from`/`to` calendar dates (inclusive Lagos days, at most 366 days), `scope=REAL|DEMO`, `channel=ALL|WALK_IN|WHATSAPP|WEBSITE`, `page` and `format=json|csv`. Real/all/page 1 are defaults. Inventory requires all channels, returns current snapshot quantities plus date-range movement deltas. Sales details use paid time; order details use creation time. Range totals are independent from the 50-row detail page. Exports have no customer PII/cost/credentials and escape spreadsheet formulas.

`GET/POST /api/admin/settings` reads/updates only approved contact/hours/policy fields; requires reason and mutation key. It cannot change demo/live mode or staff authority. `/api/store` exposes only public fields; `/policies` shows saved plain text with missing-state labels. `GET /api/admin/operations` shows observed configuration booleans/exception counts/job summaries, never credentials or a launch approval.

Owner `/api/admin/jobs/{payments,expiry,outbox}` and dedicated-bearer `/api/internal/jobs/{kind}` accept `{}` plus `Idempotency-Key`. Machine authorization does not use staff cookies. Results include run ID, state and bounded summary. A live lease returns retryable 503; expired leases can recover; repeating a successful key returns its durable result. Scheduler provisioning is pending a chosen host.

Better Auth handles `/api/auth/two-factor/{enable,verify-totp,verify-backup-code}` and password-login challenges. Production owner business access requires verified enrollment. Enrollment/access/password changes revoke prior sessions. Password recovery preserves roles and MFA; missing MFA plus recovery codes requires controlled verified-identity maintenance, never public self-promotion.
