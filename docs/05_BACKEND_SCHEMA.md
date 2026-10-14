# 05 — Backend and database schema

Version 2.0 | Proposed PostgreSQL design, not an applied migration. This is the requested backend/database schema. Exact SQL is implemented and tested phase by phase.

## Conventions

UUID business primary keys; generated string IDs for Better Auth identity records; `timestamptz` for instants; `date` for expiry; integer/bigint kobo for money with safe application bounds. Use foreign keys, explicit nullability, defaults, CHECK constraints and unique indexes. Never use floating-point money. All monetary records use NGN in P0.

Create a single-business database. Do not add misleading tenant controls or claim multi-business isolation. A later shared SaaS migration requires a separate access and composite-key design.

All tables are accessed through server-only Prisma modules; the browser has no database credential or direct table API. A restricted runtime database role is separate from the migration role. Server authorization controls each business operation; database constraints protect record integrity. Archive business records and deactivate staff; do not cascade-delete financial history. Tables generally include `created_at`; mutable records also include `updated_at`. Database time owns reservation timestamps.

## Identity and configuration

| Table | Essential fields | Constraints and access |
| --- | --- | --- |
| `staff_members` | `user_id text PK/FK auth user.id`, `role owner/staff`, `active bool`, `created_at`, `updated_at` | No public write endpoint. Staff can read their own membership through an authorized server operation. Owner administration is a verified server operation. Retain referenced identities; use deactivation rather than deletion. |
| `store_settings` | singleton `id`, `name`, `descriptor`, nullable public `phone/email/whatsapp/pickup_address`, `timezone`, `currency` | One row; explicit public-safe fields only. No merchant secrets. Owner writes; public reads approved fields. Missing contact values remain null. |

Generate Better Auth's core `user`, `session`, `account` and `verification` Prisma models using the pinned configuration and supported generator. Keep its required fields, identifiers, indexes and relations intact; review the generated migration. Physical table mappings may be chosen once and must match the adapter. Do not manually invent a reduced authentication schema from this overview.

| Auth model | Purpose | Business boundary |
| --- | --- | --- |
| `user` | Identity and login email | A user is not automatically a staff member |
| `session` | Library-managed session lifecycle | Private; never exposed by business APIs |
| `account` | Credential/authentication-method data | Library-managed password hashes; never plaintext |
| `verification` | Library-managed verification/recovery records | Private and time-limited |

Use the generated user ID type for `staff_members.user_id` and all staff actor foreign keys. Business UUIDs are a separate convention. Provision the first owner with a trusted one-time server script using supported library account creation/password hashing and private credential entry. Keep public signup disabled. Later staff provisioning requires owner authorization. Protect the final active owner with a concurrent-safe check; deactivate identities that are referenced by history instead of deleting them.

## Catalogue

| Table | Essential fields | Constraints |
| --- | --- | --- |
| `categories` | `id`, `slug`, `name`, `sort_order`, `active` | Unique slug; bounded name |
| `products` | `id`, `category_id FK`, `slug`, `name`, `brand`, `description`, `expiry_required`, `status draft/published/archived` | Unique slug; category must exist. Publication requires at least one valid active variant. |
| `product_variants` | `id`, `product_id FK`, `sku`, `option_values jsonb`, `option_fingerprint`, `price_kobo`, `low_stock_threshold`, `active` | Unique normalized SKU; unique product/fingerprint; bounded positive selling price and nonnegative threshold. Free checkout is outside P0. Empty option set has a defined default fingerprint. |
| `product_images` | `id`, `product_id FK`, nullable `variant_id FK`, `provider cloudinary`, `asset_id`, `public_id`, `secure_url`, `version`, `format`, `width`, `height`, `alt_text`, `sort_order` | If variant is present, it must belong to that product; use a composite FK or equivalent constraint. Unique provider/asset ID. Save trusted upload response metadata; never accept arbitrary client asset references. Do not store image bytes in PostgreSQL. |

Public reads require published product, active relevant category and active variant. Active staff may inspect drafts internally. Costs, supplier records, batch quantities and customer records must not be columns in the public catalogue projection. Explicit public server projections must omit sensitive columns; authentication alone does not make every field suitable for disclosure.

## Inventory

| Table | Essential fields | Constraints |
| --- | --- | --- |
| `stock_batches` | `id`, `variant_id FK`, `batch_code`, `receipt_reference`, `received_at`, nullable `expiry_date`, `expiry_precision day/month/not_applicable`, `on_hand_qty`, `quarantined_qty`, `active` | Unique variant/batch/receipt combination. `0 <= quarantined_qty <= on_hand_qty`. A receipt of the same manufacturer batch may be separate to preserve arrival/cost history. |
| `batch_costs` | `batch_id PK/FK`, `unit_cost_kobo`, `recorded_by`, `recorded_at` | Optional cost record; owner-only read/write; absence means unknown, never zero. |
| `inventory_movements` | `id`, `batch_id FK`, nullable `order_item_id FK`, `operation_id FK`, `movement_type`, signed `on_hand_delta`, signed `quarantine_delta`, `reason`, `actor_user_id`, `actor_type`, `created_at` | Append-only through domain services; stable operation/line uniqueness; reason required for adjustment/write-off. Preserve actor identity for system jobs and staff. |

The receiving routine validates expiry requirements and source precision. A month-only label retains that precision and uses the approved interpretation; unresolved values keep the batch quarantined/unavailable.

`on_hand_qty` is all physical units still in the shop, including quarantined units. Eligible physical quantity is `on_hand_qty - quarantined_qty` only while the batch is active and unexpired. Public availability never exposes costs or supplier details.

Movement semantics:

| Action | Physical delta | Quarantine delta |
| --- | --- | --- |
| Receive saleable units | +quantity | 0 |
| Receive units pending inspection | +quantity | +quantity |
| Dispatch/pickup/counter handoff | -quantity | 0 |
| Receive a returned item | +quantity | +quantity |
| Accept returned/quarantined item for sale | 0 | -quantity |
| Quarantine existing units | 0 | +quantity |
| Write off quarantined units | -quantity | -quantity |

An adjustment must reconcile to physical counts, respect active allocations and record a reason. Correct errors through new movements, not edits to history. Returned quantity cannot exceed handed-over quantity minus previously returned units. Expired items cannot be released to saleable stock.

## Orders and delivery

| Table | Essential fields | Constraints |
| --- | --- | --- |
| `delivery_zones` | `id`, `name`, `state`, `local_government_area`, `areas jsonb`, `fee_kobo`, `active` | Owner-approved matching areas; bounded nonnegative fee; server verifies chosen zone against supplied address fields |
| `orders` | `id`, unique `order_number`, `channel website/walk_in/whatsapp`, nullable `customer_name/email/phone`, `fulfilment_method pickup/delivery`, nullable address snapshot/zone ID, `currency`, `subtotal_kobo`, `delivery_fee_kobo`, `tax_kobo`, `total_kobo`, `payment_status`, `fulfilment_status`, nullable `confirmed_payment_attempt_id`, nullable `exception_code`, `created_at`, `paid_at`, `completed_at` | Positive subtotal/total, nonnegative fees/tax and exact sum relation; required guest details for online checkout, address for delivery. Snapshot final tax treatment; do not invent a tax rate. No client edits to computed states/totals. |
| `order_items` | `id`, `order_id FK`, `variant_id FK`, `product_name_snapshot`, `sku_snapshot`, `options_snapshot jsonb`, `unit_price_kobo`, `quantity`, `line_total_kobo` | Positive bounded integer quantity and unit price; exact line calculation. Historic snapshots remain after catalogue changes. |
| `stock_allocations` | `id`, `order_item_id FK`, `batch_id FK`, `quantity`, `state held/committed/released/consumed`, nullable `expires_at`, `release_reason`, `created_at`, `updated_at` | Positive quantity; held requires expiry. Partial unique index for one active held/committed row per item/batch. Variant must match item. |

Index order date/status/channel and order-item foreign keys. The order service verifies that subtotal equals the sum of line totals in the same transaction; a row-level CHECK cannot enforce that cross-table relationship. Counter sales create orders, payment records and physical movements in one transaction, already fulfilled after actual payment/handoff. Customer details can be omitted for a walk-in cash sale when no receipt contact is needed.

## Availability invariant

For an eligible batch:

`available_to_sell = on_hand_qty - quarantined_qty - active_hold_qty - committed_qty`

`active_hold_qty` counts held allocations whose expiry is in the future. `committed_qty` counts paid allocations regardless of their original hold expiry. Expired/inactive batches return zero availability and block handoff; their paid allocations require resolution. Public totals never report negative availability.

All stock writers lock affected batches in the same deterministic order and enforce available quantity inside the transaction. A CHECK on a single row cannot enforce the cross-table sum; transactional services and concurrency tests are required. Only authorized server services can reach balance/allocation writes; no public database API exists.

Reservation creates held allocations without changing physical stock. Payment changes held to committed. Dispatch/pickup changes committed to consumed while decrementing physical stock and writing movements. Each transition is idempotent. Quarantine/write-off cannot consume allocated units silently; resolve impacted orders before reducing eligible stock below commitments.

## Payments and refunds

| Table | Essential fields | Constraints |
| --- | --- | --- |
| `payment_attempts` | `id`, `order_id FK`, `provider paystack/manual/simulated`, `payment_mode test/live/simulated`, `method`, nullable `provider_reference`, `amount_kobo`, `currency`, `status initialized/pending/succeeded/failed/abandoned`, `verification_method`, nullable `verified_at`, `created_at` | Unique non-null provider/reference. Positive bounded amount; immutable expected amount/currency/mode. Manual confirmation requires authorized staff and actual channel confirmation. Simulation prohibited in production. |
| `payment_events` | `id`, `provider`, unique `event_key`, `event_type`, `provider_object_reference`, `payload_digest`, sanitized required event fields, `processing_status`, `received_at`, `processed_at`, `attempt_count` | Store verified event inputs only; no raw card/auth payload. Semantic event key uses provider object and event type when available; do not assume every provider supplies a universal event ID. |
| `refunds` | `id`, `payment_attempt_id FK`, nullable unique `provider_refund_reference`, `amount_kobo`, `reason`, `source app/external`, `status requested/processing/succeeded/failed`, `requested_by`, `confirmed_at` | Positive bounded amount; successful plus pending refund amounts cannot exceed captured funds; lock the attempt while reserving a refund. Actual provider outcome is authoritative. |

`orders.confirmed_payment_attempt_id` identifies the payment applied to the order. Add its FK after the attempts table exists, and enforce that the chosen attempt belongs to the same order. Derive order payment status from that confirmed attempt and its verified refunds. Extra successful charges remain recorded and generate an overpayment exception; do not reject the financial fact through a unique-one-success constraint. A refund of an extra charge must not incorrectly mark the original order unpaid/refunded.

Payment status values on orders: unpaid, pending, paid, failed, partially_refunded, refunded. A failed retry cannot downgrade paid. Fulfilment values: unfulfilled, preparing, ready_for_pickup, dispatched, completed, cancelled. Detailed transition rules are in [03_APP_FLOW.md](03_APP_FLOW.md).

## Control, access and recovery records

| Table | Essential fields | Constraints |
| --- | --- | --- |
| `idempotency_requests` | `id`, `operation`, `actor_scope`, `key_hash`, `request_hash`, `state`, nullable result IDs/nonsecret response, `created_at`, nullable `expires_at` | Unique operation/actor/key; different request hash is conflict. Completed financial/stock keys remain for the lifetime of their records; expire only eligible abandoned/nonfinancial entries. Never cache plaintext order tokens or credentials. |
| `order_access_tokens` | `id`, `order_id FK`, unique `token_hash`, `kind link/session`, `expires_at`, `revoked_at`, `created_at` | Cryptographically random raw token; hash stored; limited lifetime and order scope |
| `audit_events` | `id`, nullable staff actor, `actor_type`, `action`, `entity_type`, `entity_id`, safe before/after details, `operation_id`, `created_at` | Append-only; exclude credentials/card data and unnecessary customer data |
| `notification_outbox` | `id`, `order_id FK`, `notification_type`, unique `dedupe_key`, `state queued/processing/sent/failed`, `attempt_count`, `next_attempt_at`, `last_error_code` | Created atomically with relevant state change; retry independently; recipient details resolved from authorized order record |

Persist payment success and its order/allocation changes atomically. An outbox prevents a notification failure from losing confirmation. Replaying an idempotent checkout may issue new scoped access only to the same verified guest session; a client-provided request key is not itself authorization.

## Required transactional domain services

| Service intent | Atomic responsibility |
| --- | --- |
| Receive stock | Receipt/batch balances, movements and audit |
| Record counter sale | Validate live prices/payment declaration, check stock, create order/items/payment, consume stock |
| Create checkout | Validate latest prices/zone, create immutable order/items and all holds |
| Confirm payment | Lock attempt/order, verify expected values, allocate or create exception, persist event/outbox |
| Expire holds | Release only still-held expired records; race safely with payment confirmation |
| Cancel order | Check authority/state, release unconsumed allocation, record refund obligation |
| Handoff | Validate all eligible committed units, consume exactly once, update fulfilment |
| Return/adjust | Enforce sold/returned/held limits, update physical/quarantine balances and history |
| Apply refund result | Update verified refund state without directly restocking |

Implement these as server-only TypeScript services using one Prisma transaction for the complete database mutation. Use parameterized SQL row locks within that transaction when required; do not assume a read followed by an update prevents overselling. Recheck current membership for trusted server-derived staff actors. All writers use the same lock order and retry rules. Do not hold locks while calling payment, image or email services. PostgreSQL functions are optional implementation details, not a requirement or a public RPC interface.

## Access summary

Public: read published catalogue/public settings only. Active staff: operational reads excluding costs/refund authority; permitted mutations through validated server routes. Owner: catalogue/settings/cost/refund management through authorized routes. Guest: no direct orders access; server-only checkout and scoped status access. Outbox/event/auth tables: no general-purpose client access. Runtime database credentials remain server-only, use a non-superuser role and cannot apply schema changes. Migration credentials stay out of application runtime. Server role checks and private projections must be tested independently of UI navigation.

## Migration sequence

Phase 1: generated Better Auth models, staff/settings/catalogue, restricted database roles and server authorization. Phase 2: inventory, counter orders/items/manual attempts, idempotency and audit. Phase 3: delivery zones, allocations and scoped order access. Phase 4: provider events/refunds/outbox plus reconciliation services. Phase 5: operational indexes/report projections and recovery evidence.

Test migration replay, public/staff denial cases, constraints, two final-unit buyers, receipt/sale retries, held-to-paid races and dispatch idempotency before calling this schema implemented. Preserve existing migration history and data when resuming a started project.

## Phase 1 implementation notes — 13 October 2026

`prisma/schema.prisma` and the versioned SQL migration implement the Phase 1 subset only. Better Auth 1.7.7 generated the auth models, including `RateLimit` for persistent login throttling. Business timestamps use `timestamptz`; auth-generated timestamp mappings are retained. `Product.isDemo` and `StoreSettings.demoData` explicitly mark fixtures. `ImageProvider.LOCAL` and `demoTile` are restricted to local illustrative seed assets; CLOUDINARY remains the later upload provider. Product-image variant ownership uses a composite FK. Deferred publication triggers require an active variant at commit. Inventory, orders, costs, holds and payment tables are intentionally deferred to their planned phases.

## Phase 2 implementation notes

The second versioned migration adds batches/costs, idempotency, append-only stock/audit history, counter orders/items and manual payment records. Printed expiry precision is preserved separately from the optional date; month-only/unknown stock remains unavailable. A composite confirmed-payment/order FK enforces payment ownership. Manual demo records are explicitly marked and prohibited in production. A limited membership-lock function preserves runtime membership write denial. Provider/refund/hold/allocation tables remain in later phases; checkout must not be enabled until those are integrated into shared availability and stock services.
