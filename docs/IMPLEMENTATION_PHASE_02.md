# Phase 2 — catalogue and physical inventory

Updated 14 October 2026. Requirements: FR04–FR07, TR02/TR03/TR04/TR06.

The user authorized continued development after Phase 1 backend verification. The Phase 1 phone/desktop visual gate remains explicitly pending; advancing development does not mark that check passed.

## Implemented

- `/admin/products`: owner-only product creation/editing, publication, archival, variant prices, low-stock thresholds and photo uploads. Existing variant identity is retained. Changing size/shade after stock or sales exist requires a new variant. Archival does not delete old orders.
- `/admin/inventory`: staff receiving, batch balances, owner adjustments, quarantine/write-off/release, low-stock state, 30-day expiry counts and latest movement history. Purchase costs are optional and owner-only.
- `/admin/sales/new`: whole-basket completed walk-in/WhatsApp sales, server-calculated integer-kobo totals, explicit actual-payment/handoff confirmation, immutable product/price snapshots and one stock deduction. Demo catalogues create labelled demo records; sample sales are rejected in production.
- Public product variants show database-derived availability, excluding expired, quarantined, inactive and unresolved-expiry stock. Online checkout remains closed.

## Transaction boundary

All stock and catalogue mutations use a verified staff session, current membership recheck, durable actor/action-scoped idempotency record and one database transaction. Equal retries return the original result; changed payloads on a used key return 409. A failed basket rolls back entirely.

Lock order is membership → idempotency advisory lock → sorted products → sorted variants → sorted batch IDs. Stock is consumed in earliest-expiry order after acquiring locks. This deliberately serializes stock writes for the same product at current shop scale and keeps catalogue changes consistent with sales. Any future higher-throughput change must preserve those invariants.

The narrowly scoped `lock_active_staff` PostgreSQL function supplies a membership row share-lock without granting membership writes to the runtime role. Its fixed search path and revoked PUBLIC execution prevent schema-name substitution. It only checks and locks; the server-verified session supplies the actor. No public SQL/RPC route is exposed.

Physical balances include quarantine. Unknown/month-only expiry stock remains quarantined. No month-only day is invented; there is no unsafe release until an owner-approved interpretation/update workflow is introduced. An expiry-controlled batch becomes unavailable from the start of its printed date in Africa/Lagos.

Movement/audit/order-item history is append-only in both database permissions and SQL triggers. Corrections add new records. Monetary refunds and returns are not introduced in this phase.

## Photos

Owner-only multipart uploads accept one decoded JPEG/PNG/WebP image, max 5 MB and 20 million input pixels. Images are normalized on the server and uploaded with signed Cloudinary credentials. Returned metadata is saved by the server. Arbitrary remote URLs and client-supplied provider asset references are not accepted. Provider calls occur outside stock/database locks; membership is rechecked when attaching the image. Failed attachment triggers orphan cleanup.

Add `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` privately to the server environment. Do not paste them into chat. A live/test provider upload is pending until configured; validation tests do not prove provider operation.

## Developer setup

On the dedicated development database, verify the target, then run `npm run db:migrate`. Apply `scripts/grant-runtime.sql` and then `scripts/grant-phase2.sql` as the trusted administrator with the selected runtime-role variable. Restart the local server. Existing owner and demo catalogue records are preserved.

The runtime role gains controlled catalogue/balance/order writes through server domain services. It still has no DDL, staff membership mutation, business deletion or history update/delete privileges. Staff users cannot edit prices, access costs or adjust stock through the API.

## Verification and remaining gates

Build/typecheck/lint and 4 unit tests passed locally. CI includes Phase 1 auth regressions plus Phase 2 real PostgreSQL tests for repeat receipts, final-unit contention, whole-basket rollback, repeated sale, FEFO, variant separation, expiry/quarantine, owner-only costs/adjustments, immutable snapshots/history and invalid photo uploads. On code revision 1d6b4dbc0de01ff5917bc30a74b819028123ee92, all 19 PostgreSQL/auth/inventory tests passed: https://github.com/Wizzyfrosh/BennyC-Beauty-Solution/actions/runs/38518970667. Final upload retry validation coverage is being verified.

Pending: configured Cloudinary provider upload, phone/desktop/keyboard review, owner-confirmed expiry interpretation and developer infrastructure setup. These remain visible prerequisites before the commercial pilot. Phase 3 will extend the shared availability boundary with active holds and paid allocations before enabling customer checkout; it must not rely on the Phase 2 physical-only totals.
