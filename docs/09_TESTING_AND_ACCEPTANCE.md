# 09 — Testing and acceptance plan

Version 2.0 | All application tests are initially PENDING. The document pack is not test evidence.

## Test approach

Use focused unit tests for money/state/expiry logic, database integration tests for permissions and transaction invariants, and browser tests for important journeys. Test concurrency against actual PostgreSQL. Use provider test mode for payment integration. Mocks help local failure simulation but cannot prove real database privilege boundaries, concurrency or provider behaviour.

Run build/typecheck/lint each affected phase. Avoid tests that merely repeat static labels or implementation details. Record environment, fixture IDs, commands and outcomes. Keep real customer data and production credentials out of test fixtures.

## Acceptance cases

| ID | Requirements | Scenario and expected result | Gate |
| --- | --- | --- | --- |
| TC01 | FR01 | Public catalogue and direct API omit draft/archived products | G1 |
| TC02 | FR02 | Variant size/shade/volume changes the correct label and price | G1 |
| TC03 | FR03 | Anonymous and signed-in non-staff accounts cannot enter or mutate admin resources | G1 |
| TC04 | FR03 | Inactive staff and edited profile/role fields cannot grant access; client self-promotion fails | G1 |
| TC05 | FR04 | Owner create/edit/archive persists; staff cannot change prices; historic lines survive archive | G2 |
| TC06 | FR05 | Receipt updates one batch and movement once under repeated request key | G2 |
| TC07 | FR06 | Counter sale records order/payment/handoff atomically and cannot oversell | G2 |
| TC08 | FR07 | Expired/quarantined batches remain unavailable and costs remain private | G2 |
| TC09 | FR07 | Count adjustment needs owner/reason and cannot silently remove allocated stock | G2/G3 |
| TC10 | FR08 | Browser price manipulation, invalid quantities and stale quote are rejected | G3 |
| TC11 | FR09 | Fee matches approved zone/address; unknown area cannot receive guessed/free delivery | G3 |
| TC12 | FR10 | Two concurrent requests for the final unit yield at most one successful hold | G3 |
| TC13 | FR10 | Hold expiry releases availability even when cleanup job has not run | G3 |
| TC14 | FR10 | Same idempotency key/body returns one order; modified body gives conflict | G3 |
| TC15 | FR12 | Paid allocation → dispatch/pickup consumes stock once; delivery confirmation does not repeat it | G3/G4 |
| TC16 | FR13 | Customer can read only the scoped order; guessed UUID, expired/revoked token fails | G3 |
| TC17 | FR11 | Real provider test payment confirms saved reference/amount/currency/environment | G4 |
| TC18 | FR11 | Forged signature or mismatched transaction never confirms payment | G4 |
| TC19 | FR11 | Duplicate webhook and callback race produces one business confirmation | G4 |
| TC20 | FR11 | Browser closes after payment; webhook/reconciliation still updates order | G4 |
| TC21 | FR11 | Late success after expiry reallocates only if possible; otherwise records paid exception | G4 |
| TC22 | FR11 | Explicitly cancelled order is not resurrected by a late webhook | G4 |
| TC23 | FR11 | Failed later attempt cannot downgrade paid; extra successful charge creates overpayment exception | G4 |
| TC24 | FR13 | Receipt provider fails; paid order remains correct and notification retries safely | G4 |
| TC25 | FR14 | Owner cancellation/refund records actual outcome; refund failure remains unresolved | G4 |
| TC26 | FR14 | Return enters quarantine, cannot exceed sold quantity and does not auto-restock on refund | G4 |
| TC27 | FR15 | Reports separate sales/refunds/net, use correct Lagos dates and exclude simulations | G5 |
| TC28 | FR16 | Restore exercise and post-restore payment/stock reconciliation succeed on non-production copy | G5 |
| TC29 | FR16 | Operator completes receipt, sale, handoff and exception escalation with real instructions | G5 |
| TC30 | FR01–FR16 | Critical pages usable on phone/keyboard, including loading and error states | Every relevant gate |

TC05 also covers invalid/oversized image uploads, rejected non-owner Cloudinary writes and forged asset references. TC04 includes logout, revoked sessions and last-owner protection. TC08 must include a batch expiring while already allocated: future sales are blocked and handoff requires resolution. TC19 must race payment confirmation against hold cleanup, not only send sequential duplicate requests. TC23 must distinguish refund of an extra charge from refund of the payment applied to the order.

## Stock reconciliation fixture

Start with ten physical units and zero quarantine. Hold two: available eight. Confirm payment: physical still ten, committed two, available eight. Dispatch: physical eight, committed zero, available eight. Return one: physical nine, quarantine one, available eight. Accept that return for sale: physical nine, quarantine zero, available nine. Every step must reconcile to allocations and movements.

Add a mixed-basket failure: one line is available and a second is not. The whole checkout must roll back without orphan holds. Add deadlock/retry handling under deterministic multi-batch operations. Do not declare concurrency safe based only on a single sequential sale.

## Privacy and access inspection

Check public API responses and client bundles for cost fields, other orders, internal notes, privileged keys and tokens. Call server endpoints directly with no session, a non-staff session and inactive staff credentials. Verify Prisma/database secrets are absent from the client and the runtime database role cannot change schema or rewrite audit history. Test server endpoints independently of navigation. Confirm public signup is disabled and owner-only media operations reject other callers. Do not capture real personal/payment data in screenshots used for walkthroughs.

## Performance and resilience

Use a documented seed/data volume and device/network profile. Measure the proposed targets in the technical document without claiming a production SLA. Verify image sizing, pagination, query indexes, rate-limit behaviour and slow-provider recovery. Broaden load testing only to answer a specific pilot risk.

## Evidence format and release decision

Each result records test ID, PASS/FAIL/PENDING, environment, timestamp, command or manual steps, observed outcome and evidence location. Attach only non-sensitive logs/screenshots. A passing unit test cannot substitute for an unrun database/provider test.

G1 through G5 are defined in [06_IMPLEMENTATION_PLAN.md](06_IMPLEMENTATION_PLAN.md). Any unresolved required failure blocks its gate. Missing infrastructure keeps the corresponding check PENDING. Only an explicit scope decision can remove a P0 requirement; document its consequences rather than relabelling the failure.
