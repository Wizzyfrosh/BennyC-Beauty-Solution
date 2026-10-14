# 01 — Product requirements document

Version 2.0 | Proposed first release | Business: BennyC Beauty Solution / Cosmetics & Makeup Venture

## Product outcome

Give customers a reliable way to discover and order beauty products remotely, and give staff one record of stock and sales across the website, shop and WhatsApp. The shop supplies real products, stock counts, fulfilment and customer support. Software cannot compensate for unrecorded physical sales.

The first commercial objective is a private, convincing demo followed by an agreed paid pilot. Broader reuse across beauty retailers is a future product opportunity; multi-business hosting is outside this release.

## Users and jobs

| User | Primary job | Essential constraint |
| --- | --- | --- |
| Customer | Find the right product/variant, understand the final price, buy and receive it | No compulsory registration |
| Staff | Receive stock, record shop/WhatsApp sales, prepare and hand over orders | Active staff membership and explicit permissions |
| Owner | Manage catalogue/prices, staff, exceptions, refunds and business performance | Sensitive actions recorded and restricted |

Initial scope: one business, one branch, NGN currency, whole-unit retail sales, pickup and configured local delivery. These are planning assumptions, not facts already verified with the owner.

## Functional requirements

| ID | P0 requirement | Acceptance result | Phase |
| --- | --- | --- | --- |
| FR01 | Published catalogue with categories, brand and product search | Draft/archived items never appear in public reads | 1 |
| FR02 | Product details with independent size/shade/volume SKUs and prices | Selecting a variant changes the correct price and later its availability | 1–2 |
| FR03 | Staff identity, owner/staff roles and active membership | Visitors and ordinary signed-in users cannot access staff operations | 1 |
| FR04 | Product, variant and image management | Owner edits persist; archived products preserve historic orders | 2 |
| FR05 | Batch-based stock receiving and movement history | Every receipt has quantity, actor, time and relevant expiry | 2 |
| FR06 | Walk-in and completed WhatsApp sales | Atomic order/movement record; shared stock cannot be oversold | 2 |
| FR07 | Low-stock, expiry, quarantine and adjustments | Excluded stock cannot be sold; corrections have reasons | 2 |
| FR08 | Cart and guest checkout | Server accepts valid SKU/quantity input and recalculates the total | 3 |
| FR09 | Pickup and approved delivery zones | Final fee is shown before payment; unknown zones are not guessed | 3 |
| FR10 | Expiring, concurrent-safe stock reservations | Two buyers cannot reserve the final unit simultaneously | 3 |
| FR11 | Verified online payment and reconciliation | Authentic matching provider success confirms the correct order once | 4 |
| FR12 | Order queue and fulfilment | Authorized staff can prepare, dispatch/hand over and complete orders | 3–4 |
| FR13 | Receipt and protected order status | Customer sees their own limited order data through protected access | 3–4 |
| FR14 | Cancellation, refund and return handling | Financial and physical-stock actions remain separately traceable | 4 |
| FR15 | Business reports and exports | Paid, fulfilled and refunded amounts use defined denominators and dates | 5 |
| FR16 | Operational readiness | Real data, recovery, support and staff workflow validated before launch | 5 |

## Catalogue and cosmetics requirements

Each product has a title, brand, category, description, status and images. A variant has an SKU, human-readable option values and a price. Batches identify deliveries of a variant with their own expiry and physical quantities. Do not place one expiry date on a product shared by many deliveries.

Copy ingredients, directions and warnings from supplied packaging or another verified source. Do not invent treatment results, authenticity guarantees, registration numbers, testimonials or delivery coverage. Public product photography must be owned or licensed for the intended use.

An expiry-controlled product requires a known expiry before its batch can be saleable. Accessories may explicitly have no expiry requirement. Provisional exclusion rule: a batch is unavailable from the start of its printed expiry date in Africa/Lagos. Confirm how month-only expiry labels are interpreted with the owner; preserve source precision rather than silently inventing a day.

## Operating rules

- Stock is shared across recorded sales channels. If daily staff recording is not workable, agree a separate online allocation or integration before accepting orders.
- Available-to-sell excludes checkout holds, paid allocations, quarantine and expired batches. A cart alone does not reserve stock.
- Prices and fees are frozen on the order at checkout. A later catalogue change does not rewrite an existing order.
- Checkout holds provisionally last 15 minutes; this is configurable and subject to payment-channel testing. A provider may confirm later; late success requires reconciliation, not invented stock.
- No credit sales or pay-on-delivery in P0. Staff record a counter sale as completed only after confirming its payment through the actual channel. A transfer screenshot alone is insufficient.
- Fulfilment consumes stock at dispatch or pickup. Payment changes the hold to a paid allocation; it does not deduct physical stock twice.
- P0 uses whole-order fulfilment and cancellation. Partial shipments are deferred. External partial refunds must still be recorded accurately when observed.
- Full refunds may initially be initiated by the owner in the provider dashboard, with verified status/reference reconciled in the app. A refund request is not a completed refund.
- Returns first enter quarantine; a financial refund never automatically restocks an item.

## Priorities and non-goals

P1: verified customer accounts/reordering, restock notifications, bundles, wholesale pricing, richer purchasing records and barcode scanning. Add only after reliable P0 operation.

Excluded: native mobile applications, wallets, credit/lending, automated skincare advice, multi-seller marketplace, multi-branch transfers, loyalty points and a shared multi-business SaaS platform. Keep brand/settings configurable without implementing these products prematurely.

## Customer experience and failure behaviour

Show loading, empty results, unavailable variants and clear recoverable errors. Preserve cart input after ordinary failures. Revalidate stock and price at checkout. If the price changed, present the new total for confirmation. When payment is pending, show pending rather than telling the customer to pay repeatedly. Do not expose internal exception details or other customers' data.

Store contact, pickup address, delivery window and returns information remain owner-provided. The demo labels its products and transactions as samples. It does not accept real customer payments.

## Pilot success and ownership

Measure fulfilled online orders, orders cancelled because of stock mismatch, payment exceptions, time from paid order to handoff, and recording consistency. Establish the baseline and observation period with the owner; do not invent conversion or sales targets.

Report gross sales, refunds and net sales separately. Net sales are not profit. Gross profit needs complete reliable cost allocation; net profit additionally needs operating expenses and fees. Omit unsupported profit claims.

The business owns its domain, merchant account and business data. Agree reusable code rights, initial setup fee, recurring support, running costs, export/exit arrangements and catalogue maintenance before the paid pilot. Confirm outstanding decisions in [11_DECISIONS_AND_BUSINESS_INPUTS.md](11_DECISIONS_AND_BUSINESS_INPUTS.md).
