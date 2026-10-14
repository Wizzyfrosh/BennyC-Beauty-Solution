# Acceptance review and private pilot preparation

Requirements: FR01–FR16, TC30/TR07 usability and failure recovery, plus outstanding G1–G5 operating evidence. The five implementation phases are complete as code; this review closes remaining acceptance gaps. It is not an additional feature phase or a launch approval.

## Confirmed code-review corrections — 14 October 2026

| Finding | Correction | Verification scope |
| --- | --- | --- |
| A blocked/quota-exceeded cart write was followed by rereading stale storage, silently replacing the new bag | Retain the latest validated bag in tab memory and label that refresh/closing loses it; still reject corrupt/duplicate/oversized/invalid data | Four focused storage-fault tests; no payment/contact/token data added to browser storage |
| Payment initialization/verification timeout had no explicit same-action retry and could route a different button to the saved request | Disable new payment actions while uncertain and offer a retry using the original key/body/action and correct result handling | Code review; inherited backend initialization/idempotency/outage regressions; actual browser interaction remains pending |
| Failed operations refresh could hide errors behind previously loaded data or reject from an async job handler | Catch refresh errors, keep and date-label the prior snapshot, show an alert, clear it after a successful refresh | Code review; browser failure-state review remains pending |
| Policy textareas lacked the shared visible focus style; cart rows reused indistinguishable action names | Include textareas in focus styling and identify the product/variant in quantity/remove controls | Source review only; rendered contrast, touch targets and screen-reader/keyboard review remain pending |

Local build/types/lint and 14 unit tests pass. Final application `7014c2f0a6649259a6a588637273f1164ba7bd20` also passed all 54 PostgreSQL/HTTP tests and disposable restore (32 table fingerprints, 13 receipt-backed batches, auth/constraints/permissions) in https://github.com/Wizzyfrosh/BennyC-Beauty-Solution/actions/runs/38564122196. Full evidence is in PROJECT_STATUS.md. No dependency, migration, runtime privilege or live-mode activation is required for these fixes. Browser/merchant/operator checks below remain independent and pending.

## Open the review branch locally

Use Node 24 LTS and the existing lockfile. For a new checkout:

```bash
git clone --branch codex/phase-1-foundation https://github.com/Wizzyfrosh/BennyC-Beauty-Solution.git
cd BennyC-Beauty-Solution
npm ci
npm run dev
```

Open `http://localhost:3000/preview` for the labelled visual fixture, including sample detail pages and option selection. It needs no database and does not accept orders. The real `/` and `/shop` need the dedicated development PostgreSQL setup in README, all five migrations/grants and a trusted owner account. Receive sample stock before a checkout walkthrough. Use private environment values; no credentials belong in chat or evidence files.

The managed Codex environment lacks the supported control-browser capability. Its Sites workflow states: “If `$control-browser` is unavailable, skip browser QA: do not start a preview server, install a browser, or improvise another browser-control path.” No rendered or pixel-perfect acceptance is claimed here. The next manual review needs the local Antigravity/browser environment or an identified private staging environment.

## Browser and operator evidence to collect

| Check | Procedure | Required observation | Current status |
| --- | --- | --- | --- |
| Reference/phone/tablet/desktop | Compare preview at 360, 768 and 1440 px against 90568.jpg; inspect hero, feature overlap, categories, cards, banner, long names and missing images | Legible layout, no clipped actions/accidental horizontal page overflow; record any differences | PENDING |
| Keyboard and focus | Tab/Shift-Tab through navigation, options, quantity, filters, forms and policy textareas; activate with keyboard | Visible focus, logical order and clear action/field names; mobile menu operable | PENDING |
| Cart storage failure | On an isolated browser profile, block storage or simulate quota failure; add/change/remove items and navigate within the app | New bag retained in current tab with truthful persistence notice; reload limitation understood | PENDING rendered review; unit fault checks available |
| Payment timeout | Use the dedicated provider test environment/fault setup; interrupt init/verify response and retry | Original action/key reused, correct redirect/status handled, no new unintended charge/attempt | PENDING browser; CI backend fault evidence available |
| Setup/error/empty/slow states | Inspect unavailable database, zero catalogue/stock, rejected inputs, failed refresh and queued receipt | No invented data/success; readable recovery path; current versus previous snapshot clear | PENDING browser |
| Private sample flow | Receive stock → select variant → quote pickup/approved demo delivery → reserve → simulate payment → prepare/pickup/dispatch → record counter sale | Shared availability and exactly one physical handoff deduction; all sample payments labelled | PENDING operator walkthrough; CI invariants verified |
| Staff/MFA/recovery | Real staff login, owner MFA enrollment/login/recovery code, inactive account, sign out and trusted terminal password recovery | Role boundaries and revoked sessions hold; operator knows private recovery/escalation | PENDING actual operator rehearsal; CI verified |
| Configured media | Owner uploads approved image to the chosen development Cloudinary account; inspect returned asset and metadata | Real upload/display/validation evidence and approved asset recovery process | PENDING configuration |
| Merchant test | Privately configure dedicated test account/key; complete hosted test charge, callback/server verify/webhook/reconciliation and dashboard refund | Actual test reference/amount/currency/domain matches saved facts; money/stock independent | PENDING actual account; loopback CI is not merchant evidence |

Evidence should record release SHA, date, reviewer/device/viewport, expected/observed result, failure and retest. Use synthetic contacts and non-sensitive screenshots. Never photograph MFA seeds/recovery codes, credentials or actual customer/payment details. A build/unit/HTTP test cannot clear a browser or merchant gate.

## Remaining operating decisions

Owner-confirmed real catalogue/media rights/prices/counts/expiry; contacts/pickup/delivery charges/policies/tax treatment; named operator/support; selected host and secret custody; approved sender if external notifications are required; actual job cadence, trusted ingress rate limits/monitoring, backup retention/RPO/RTO and image-byte recovery; service budget, pilot scope and explicit launch authorization are not supplied. Consult the existing decision register and OPERATIONS_RUNBOOK.md. Do not fill these with fabricated defaults or treat continued coding authorization as public launch authorization.

Next concrete input: identify the acceptance environment (local Antigravity/browser or an existing private staging URL). Then run the first visual/keyboard walkthrough and record observed defects before choosing hosting or activating real payments.
