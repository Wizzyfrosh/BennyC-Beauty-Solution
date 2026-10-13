# 06 — Phase-by-phase implementation plan

Version 2.0 | Gate-driven sequence, not a claim of completed work or a fixed delivery date.

Read [PROJECT_STATUS.md](PROJECT_STATUS.md) before each task. Reuse existing code and evidence. The first incomplete gate determines the default next phase. Keep a short implementation plan and final walkthrough in the repository, not only in Antigravity chat.

## Working method

For each phase: inspect repository and relevant requirement IDs; identify actual prerequisites; plan the smallest coherent implementation; implement routine local work; run focused checks; record PASS/FAIL/PENDING evidence; review changes and save a focused Git checkpoint when authorized. Do not weaken validation or skip a required gate to declare completion.

Use one coding agent by default. Antigravity's configured review policy and explicit user authorization control pauses. Missing configuration is a blocker for the affected integration, not a reason to fabricate success or stop all unblocked work.

## Phase 1 — Foundation, catalogue and staff access

**Requirements:** FR01–FR03; TR01, TR04, TR07, TR09, TR10.

1. Inspect files, Git state and installed tools. Preserve the document pack and any existing application. Choose compatible stable versions from official docs and record them.
2. Scaffold one Next.js/TypeScript/Tailwind app, development scripts, environment validation and a single lockfile.
3. Configure PostgreSQL/Prisma and Better Auth. Generate auth models; implement settings, staff and catalogue schema with migrations, restricted runtime privileges and server authorization. Prepare a trusted first-owner procedure and idempotent development-only sample seed.
4. Build the homepage, read-only shop/product pages, search/category filter, variant display and loading/empty/error states using the design brief.
5. Implement real staff login/logout and protected admin shell. Do not create public staff signup, a fake session or client-only authorization.
6. Run G1 checks. Document exact remaining credentials/setup if not available, while finishing safe unblocked work.

**G1 exit gate:** build/typecheck/lint pass; published versus draft access verified; anonymous/non-staff/inactive accounts denied; active staff allowed; self-promotion denied; phone/desktop checks recorded. Backend-dependent tests remain PENDING until run with the configured development database. No inventory numbers or sales totals are invented.

**Deliverables:** working foundation, migrations, seed, setup README, toolchain record and status evidence. Use [PHASE_01_FOUNDATION.md](../prompts/PHASE_01_FOUNDATION.md).

## Phase 2 — Catalogue operations and physical inventory

**Requirements:** FR04–FR07; TR02, TR03, TR04, TR06.

1. Add owner catalogue editing/publication/archival and validated owner-only Cloudinary image uploads.
2. Implement batches, physical/quarantine quantities, movement records and optional owner-only costs.
3. Add receiving and audit history, low-stock thresholds, near-expiry views and adjustments with reasons.
4. Add order/items/manual payment records and an idempotent counter/WhatsApp sale operation. Confirm real payment before declaring a completed counter sale.
5. Implement required server domain services using atomic Prisma transactions and deterministic PostgreSQL locking. Set the future allocation-aware availability boundary now; extend it in Phase 3 without duplicating business logic.
6. Test receipt/sale retries, simultaneous stock consumption, variant separation, expiry/quarantine and private cost access.

**G2 exit gate:** demonstrated receive → sell → inspect stock history; balances match movements; invalid/overselling writes rejected; owner/staff boundaries hold. Every physical change has an actor and reason/type. Test on PostgreSQL, not only mocked repository methods.

## Phase 3 — Customer orders and pitch demo

**Requirements:** FR08–FR10, FR12 and the protected access portion of FR13; TR02–TR04, TR06–TR07.

1. Implement cart, server quote, guest contact/fulfilment input and owner-configured delivery matching.
2. Create immutable order snapshots and atomic expiring holds with safe idempotent retries.
3. Implement secure guest order access and staff order queue.
4. Add a clearly labelled development payment adapter that exercises the same domain confirmation/fulfilment rules. Production must reject simulation.
5. Implement preparation, pickup/dispatch and delivered states with one physical-stock deduction at handoff.
6. Exercise checkout contention, price changes, unknown delivery zones, token access and reservation expiry. Record the pitch walkthrough.

**G3 exit gate:** a sample customer order reaches staff and fulfils correctly; a counter sale updates the same stock; final-unit concurrency and duplicate requests are safe; customer order access is scoped. Demo transactions are visibly simulated and isolated from real business data.

**Commercial checkpoint:** show the private demo, collect owner feedback, agree pilot scope/payment/support/data ownership and the staff stock workflow. The demonstration does not authorize live payment collection or public publication.

## Phase 4 — Provider payments, reconciliation and refunds

**Requirements:** FR11, full FR12–FR14; TR03–TR06, TR08–TR09.

1. Configure a development/test Paystack integration; initialize attempts on the server from saved totals.
2. Add signature validation, authenticated server verification and one shared confirmation routine for callbacks/webhooks/reconciliation.
3. Persist event results, process duplicates/out-of-order events, record additional successful charges and handle late success after holds expire.
4. Add a durable receipt/status notification outbox and retry job; preserve paid orders if notification delivery fails.
5. Implement owner-authorized pre-handoff cancellation, refund records and quarantined physical returns. Document any provider-dashboard manual step honestly.
6. Verify provider test evidence and all G4 fault paths. Do not enable live keys as a shortcut for testing.

**G4 exit gate:** provider test payment confirmed; invalid signature/amount/currency/reference/environment rejected; duplicate processing cannot duplicate stock/order changes; browser closure is safe; reconciliation resolves pending attempts; late/extra charges surface for resolution; refund outcomes never automatically restock returned goods.

## Phase 5 — Operating reports, recovery and paid pilot

**Requirements:** FR15–FR16; TR07–TR10.

1. Add scoped sales/order/inventory reports with explicit metric definitions, Lagos dates and useful exports.
2. Verify initial real catalogue, prices, stock counts, contact details, delivery charges and owner-approved policies. Keep demo data out of production.
3. Finalize production permissions, rate limits, monitoring, backup/restore, staff recovery and scheduled jobs.
4. Train the actual daily operator through receiving, sale, fulfilment, correction and escalation tasks.
5. Run the relevant acceptance suite, a restore exercise on non-production data, mobile usability checks and payment/stock reconciliation.
6. Present launch readiness and remaining blockers. Activate/publish only within the owner's explicit launch authorization and confirmed service budget.

**G5 exit gate:** no unresolved P0 failure; named operator and support responsibility; merchant readiness; recovery evidence; verified production configuration; live release authorization. Label any separately authorized live smoke transaction and reconcile it.

## Required phase report

| Field | Content |
| --- | --- |
| Phase/requirements | Exact phase and FR/TR IDs |
| Changes | Meaningful files/modules and behaviour |
| Commands | Actual commands, host/environment and outcomes |
| Gate | PASS, FAIL or PENDING with evidence |
| Manual checks | Screens, auth roles, provider mode and fixture identifiers |
| Limitations | Missing setup, unverified behaviour and material risks |
| Next task | Smallest concrete task that advances the first incomplete gate |

Never substitute a screenshot for evidence of database transactions, actual provider verification or access isolation. Do not add later features to compensate for a failing core gate.
