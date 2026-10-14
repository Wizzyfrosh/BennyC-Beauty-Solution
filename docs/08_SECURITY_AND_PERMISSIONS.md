# 08 — Security and permissions

Version 2.0 | Implementation requirements, not a completed security assessment.

## Permission matrix

| Capability | Visitor/customer | Staff | Owner |
| --- | --- | --- | --- |
| Published catalogue | Read | Read | Read |
| Draft catalogue | No | Internal read | Manage |
| Prices/publication/images | No | No | Manage |
| Own order | Scoped access only | Assigned business operations | Business operations |
| All orders/customer delivery data | No | Operational need | Yes |
| Stock receiving and counter sales | No | Yes | Yes |
| Stock adjustments/write-offs | No | No | Yes |
| Cost/profit information | No | No | Yes, if reliable data exists |
| Prepare/dispatch/pickup | No | Yes, allowed states | Yes |
| Paid cancellation/refund/return authorization | Request support | Escalate | Authorize |
| Staff roles/payment settings | No | No | Manage through trusted server flow |

Reduce customer data returned to each screen. Do not give staff arbitrary database access merely because they can view an order queue. P0 has no customer account/profile system.

## Identity and authorization

Use Better Auth's supported Next.js integration to verify server sessions, then load current active `staff_members` membership. Recheck authority inside sensitive transactions. A valid login with no active membership has no business access. Submitted role fields and editable profile metadata never grant authority. Deactivation revokes sessions and the current membership check blocks later operations even if an old cookie remains.

Keep public registration disabled and provision staff through trusted owner operations. Bootstrap the first owner with a one-time server script using library-supported account creation/password hashing; no public bootstrap route or shared password. Protect the final active owner. Configure and test owner account recovery before launch. Strong owner authentication and supported MFA are launch requirements; document any added auth-plugin schema and recovery procedure.

Use library/framework session protections and explicitly configured trusted origins. Protect cookie-authenticated mutations against CSRF; GET must not mutate state. Production cookies use appropriate Secure, HttpOnly and SameSite settings. Do not cache private customer/staff responses publicly. Test logout, revoked access and replay of expired credentials.

## Database and media

All database operations originate from server-only modules. Prisma and database credentials never enter client bundles. There is no browser database SDK or general-purpose public query endpoint. Authorize every domain service: the database runtime role represents the application, not the individual customer or staff member.

Use a non-superuser runtime role with only needed data privileges and a separate migration role with schema-change permissions. Restrict network access where the selected host supports it; use verified TLS for remote connections. Revoke unnecessary PUBLIC schema creation rights. Grant append-only insert/read access for movement/audit records where practical, and no ordinary runtime UPDATE/DELETE on that history. Preserve the auth library's documented write permissions for session/account lifecycle. Do not grant DDL to the running application to make setup easier.

Read explicit public projections and filter publication/active status server-side. Sensitive costs, customer details, staff records and internal notes never enter public product objects. Use parameterized ORM/SQL calls; reject client-selected table names, raw query strings and actor IDs. Restrict database inspection consoles to developers/operators.

Cloudinary product uploads/deletes require current owner authority. For P0, upload through a server operation with validated raster image type, size and dimensions. Keep the API secret server-only, store metadata from the trusted upload response and reject arbitrary remote URLs. Do not use a broadly enabled unsigned upload preset. Ensure replacement/deletion can touch only assets associated with this business and record an audit event. Product images are public; customer receipts and private documents must never use that public media path.

## Money and inventory abuse controls

Recalculate all prices and delivery charges on the server. Check stock inside the transaction. Bound quantities/request sizes. Reserve stock only at checkout, not when adding to cart. Rate-limit excessive holds and payment creation using server-issued guest sessions plus appropriate network controls; choose thresholds from the pilot rather than claiming they are already tuned.

Verify provider signature and saved expected transaction data. An emailed screenshot, client callback, browser success flag or client-supplied amount cannot mark an online order paid. Keep test/live mode separation explicit. Process repeated or reordered events idempotently and preserve actual duplicate charges for resolution.

Server-only secrets include database connection strings, auth signing/encryption secrets, Cloudinary API secrets, payment keys and job credentials. Migration credentials are separate from application runtime. Keep actual keys out of source, chat, logs, screenshots and generated documentation. Rotate accidentally exposed secrets before continuing with them.

## Guest order access and privacy

Order numbers and UUIDs are not secrets. Use cryptographically random scoped access tokens; store hashes, expiry and revocation. Prefer token exchange to a protected cookie. Prevent order enumeration and redact access tokens from logs/referrers. A lost access link should be recovered through a controlled business process, not a public email-plus-order-number endpoint.

Collect only details necessary for payment, delivery and support. Publish an owner-reviewed privacy notice and decide retention/deletion/export procedures before live use. Do not enable marketing from transactional checkout consent automatically. Payment cards/CVV are handled by hosted checkout and never stored by this app.

## Verification and incidents

Use [09_TESTING_AND_ACCEPTANCE.md](09_TESTING_AND_ACCEPTANCE.md) for negative cases. Inspect public responses and built client bundles for private fields/secrets. Test revoked membership, direct unauthorized endpoint requests, runtime database privilege limits, forged provider events and cross-order requests.

If financial/stock integrity is uncertain, stop new checkout, preserve records, reconcile provider transactions and inventory, and restore normal operation only after the cause is understood. Do not erase audit rows or restore a stale database over new paid orders as an improvised fix. See [10_DEPLOYMENT_AND_OPERATIONS.md](10_DEPLOYMENT_AND_OPERATIONS.md).
