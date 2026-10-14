# 11 — Decisions, assumptions and business inputs

Version 2.0 | Updated 12 October 2026.

## Decision register

| ID | Decision or question | Current status | Needed by |
| --- | --- | --- | --- |
| D01 | Name: BennyC Beauty Solution / Cosmetics & Makeup Venture | User-confirmed name; spelling normalized in documents | Now |
| D02 | Development tool: Antigravity | User-confirmed | Now |
| D03 | Next.js/TypeScript/Tailwind + PostgreSQL/Prisma + Better Auth + Cloudinary + Paystack | Revised engineering stack following user request for a different backend | Foundation |
| D04 | One business, one branch, NGN, retail whole units | Planning assumption | Inventory design confirmation |
| D05 | Guest checkout, owner and staff roles | Proposed scope | Foundation |
| D06 | Cream/charcoal/plum temporary brand | Proposed; real brand assets absent | Owner design review |
| D07 | Shared recording of website/shop/WhatsApp sales | Required operating approach unless separate online allocation is agreed | Before live orders |
| D08 | Existing shop software and import source | Unknown | Before inventory migration |
| D09 | Product count, variants, expiry-labelled products and opening counts | Unknown | Real catalogue loading |
| D10 | Pickup address, delivery areas, rates and handoff responsibility | Unknown | Live checkout |
| D11 | Price/tax treatment and receipt wording | Owner/accounting input needed; no rate assumed | Live checkout |
| D12 | Merchant account activation/settlement/refund responsibility | Unknown | Payment activation |
| D13 | Transactional notification provider and sender details | Unselected | Phase 4 notification verification |
| D14 | Hold TTL initially 15 minutes; near-expiry window initially 60 days | Proposed configurable defaults | Pilot review |
| D15 | Expiry-date boundary and month-only labels | Conservative default described; owner confirmation needed | Real batch entry |
| D16 | Refund/returns policy and resale inspection | Owner decision needed | Live policy and operations |
| D17 | Operator, support coverage and offline contingency | Unknown | Pilot readiness |
| D18 | Setup budget, recurring budget, code rights and service terms | Unknown; no pricing promised | Paid pilot agreement |
| D19 | Hosting, backups, retention and recovery targets | Provider/owner selection required | Production setup |
| D20 | Multi-business expansion | Deferred; reusable configuration only | After validated pilot |

## Business information to collect

Get logo/colours, accurate contacts, product names/descriptions/images, each size/shade/volume SKU, selling prices, initial batch quantities/expiry, existing records and staff responsibilities. Ask whether they sell cartons, wholesale, bundles or on credit; these may change scope and must not be silently squeezed into single-unit retail logic.

Obtain actual delivery rules, return inspection practices and the source of customer traffic. A website alone does not guarantee orders. Confirm product-photo rights and supplied claims; do not manufacture endorsements, reviews or official approvals.

## Suggested owner meeting

Walk through one remote purchase and one counter sale. Ask the owner to show how stock is counted today. Identify who will use the dashboard daily. Resolve delivery and payment responsibilities, then agree what a successful pilot would demonstrate. Keep a written scope and responsibilities record before substantial paid production work.

## Architecture decision template

When changing a material decision, append: date; decision ID; problem; options considered; selected option; trade-offs; affected requirements/schema/API/tests; owner approval where applicable; migration/rollback implications.

Do not mark a proposal approved merely because an AI agent implemented it. Routine implementation choices within agreed scope can be made and documented without repeated questions; unknown business policies or new costs require the relevant owner input.

## Confirmed implementation direction — 13 October 2026

- User authorized building in `Wizzyfrosh/BennyC-Beauty-Solution`. Preserve its existing LICENSE. Work on `codex/phase-1-foundation` for review.
- Uploaded reference 90568.jpg replaces the preliminary colour proposal; teal, mint, botanical photography, serif hero, circle categories and product-card arrangement are adopted. Brand stays BennyC Beauty Solution / Cosmetics & Makeup Venture.
- Reference discounts, review counts, clinical/ingredient claims, shipping and returns promises are not confirmed business facts and are not reproduced as claims.
- `/preview` is an explicitly labelled visual fixture with no stock, authentication or payment simulation. Live catalogue routes remain database-backed and fail closed when unavailable.
- No production service, live payment integration, public website deployment or paid service purchase is part of this implementation.
