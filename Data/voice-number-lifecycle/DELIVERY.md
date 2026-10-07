# Delivery and acceptance contract

> **1 October 2026 — superseded in part.** The owner's final decisions are in `DECISIONS-2026-10-01.md` and the design to build is `FINAL-DESIGN.md` (its section 14 lists what changed). Read those first; **where this file differs, they win.** This file stays for the detail they do not repeat.

**MANDATORY CARRIER RESEARCH — COST IS SUPER IMPORTANT. The implementation session MUST research official Telnyx (Canada/US) and Plivo (India) billing online AGAIN: first and subsequent charges, proration/refunds, renewal calendar, month-end/leap dates, billing cutoff/timezone and available renewal APIs. Resolve conflicting information against the exact product/account and primary documentation, using authorized read-only evidence and written carrier confirmation when needed; ask the owner rather than guess. Read CARRIER-RESEARCH.md and RENEWAL-AUTOMATION.md fully. Save verified evidence and conservative UTC deadlines in the proposed partition-scoped Cosmos design after itemized schema approval; return eligible unused numbers with a default 24-hour lead. No unverified financial automation or promised refund.**

**Current revision:** [Renewal automation and owner-requested controls](RENEWAL-AUTOMATION.md) governs automatic returns, Keep, regional caps, country lock, configurable choices and protected approval history. Earlier manual-return/fixed-five review notes below are superseded where they conflict.

Owner-approved design and mockup · 30 September 2026. Itemized schema approval remains separate. APPROVED-HANDOFF.md governs final refinements.

## Ordered implementation

1. **Honor approved design; repeat carrier research; obtain itemized schema approval.** Design and mockup are already approved. Research first and later rentals, refunds/proration, renewal APIs, month-end/leap handling and charge cutoff online AGAIN; reconcile conflicts against each exact carrier account/product. Verify currency/renewal boundary/quote guarantees and India KYC; present exact schema rows, including precision addenda, under the repository gate. Resolve the initial business-number authority rule with the existing identity/team contract. The forwarding phone used by the business must not depend on which employee opens the page.
2. **Harden shared mutation paths first.** Gate general application save and own-number replacement; fix ownership/foreign-release and stale projection risks identified in EVIDENCE. Add meaningful regression tests. Route all admin/self-service allocation and release through one coordinator; do not leave the older admin writer bypassing claims.
3. **Build carrier facts and inventory.** Lossless money parsing, currency/cap/capability/compliance checks, normalized renewal evidence, bounded reconciliation, regional inventory and atomic number/business claims. No automatic purchase until an ambiguous POST can be reconciled safely. Inventory existing owned numbers with explicit account evidence; flag unrecognized assignments.
4. **Forwarding requests, web and native together.** Provider request, platform-admin decision/verification, routing repair and security notifications. Admin Requests and Alerts share the durable operation. Existing business lookup is reused on admin web and native.
5. **Self-service choice and assignment.** Pool-first configurable-choice endpoint, selection lease, idempotent submit, cost and SQL entitlement re-check, asynchronous purchase/projection, fallback and admin success monitoring. Keep billing start dates honest during manual work. Custom-number request is a separate operation, not a provider cost override.
6. **Trial hold and automatic carrier returns.** Reuse current billing outcome/dunning semantics, add T−24h reminders and T+24h detachment for any trial-only duration, historical regular-billing classification, call drain/fencing and separate quarantine. Hourly UTC minute-00 scan, default 24-hour return lead, conservative evidence precision, Keep override, overdue recovery, independent missed-run monitoring and immediate failure alerts. Admin preview/retry handles incidents; routine return needs no manual approval. Do not conflate parked/returned runtime states with carrier deletion.
7. **Validate and document.** Real-engine concurrency tests, carrier contract fixtures, localized responsive UI verification, affected builds/ESLint, operational rehearsal and rollback/cutover review. Update relevant skills in all four AI-tool directories and memory when the implementation actually changes the feature. This design package does not claim those changes already exist.

Do not create backward compatibility scaffolding solely for pre-production data. Do not drop account/carrier assets as a “reset”. Parallel trial work must be inspected before implementation; the shared ProviderAddOn remains the only trial authority.

## Proposed API behavior, not existing endpoints

The current VoiceAssistantController/AdminVoiceAssistantController are the natural owning surfaces; exact route names are to be selected after reading the complete controllers and conventions. The contract needs the following operations, regardless of final route spelling:

| Operation | Contract |
|---|---|
| List choices | Authenticated business from token/context; at most the configured choice limit (default 5) opaque choice IDs, display number/locality, freshness and unavailable reason. No carrier account credentials or raw internal cost exposed to provider |
| Submit selected choice | Stable client request ID; backend derives country/account; validates live entitlement, currency/caps, routing authority and claim. Returns accepted operation ID/status, never optimistic “active” |
| Read operation | Tenant-scoped, ETag/version-aware response. One bounded polling owner per mounted view, pause in background/offline; SignalR refresh coalesces. Abort obsolete requests on unmount; no duplicate query loops |
| Forwarding request / withdraw | Live number-management permission; normalized desired target and expected current target; duplicate-safe response; withdraw only before decision/apply |
| Custom request | Bounded exact number or area preference plus brief note. No promise of availability, portability or a paid override. Existing number owned by another carrier implies separate portability review, not “buy this number” |
| Admin decision/apply | Platform Admin role, business lookup result, operation version, expected target and verification evidence. Reject stale state with explicit conflict |
| Inventory / return preview / confirm | Admin role, configured scope and filters; paginated keyed query. Preview token pins IDs+versions+expiry; confirmation rechecks assignment, billing, holds, quarantine policy and calls. Per-item result for partial success |

Return machine-readable reasons using the existing ApiResponse/localization pattern. Same request ID + different payload is a conflict, not a second purchase. API timeout means “checking status”; the app does not automatically POST a new request ID. Re-login and lost-permission states must be distinct from carrier failures.

## UI state inventory

The registered mockup includes a reviewer state selector and renders the selected scenario in web and native frames. It is isolated and uses fictional data. Preview controls are not product controls.

| Area | Required rendered states / transition |
|---|---|
| Forwarding | Saved read-only field; request dialog; invalid/unchanged target; submitting; pending request; withdrawal; declined; applying; applied; stale-target conflict; own-number reconnect/test required |
| Number choice | Pool choices; live carrier choices; configurable maximum (default 5; exercise 10); local/alternate area explanation; selected item; automatic recommended choice; custom-number request; no local choices; empty eligible pool and no affordable inventory; stale/taken choice; quote no longer eligible |
| Setup | Not entitled; profile missing/unverified authority; provisioning; carrier outcome unknown; manual review; ready dedicated; own-number needs connect/test |
| Trial | Ending in 24h; ended and holding; payment processing; recovered; detached; already on paid plan; trial extension received while removal queued |
| Admin requests | Business lookup; forwarding detail with verification/expected value; custom/over-budget/manual fallback; successful activity; empty; stale decision; no admin permission; applying/complete |
| Admin inventory | Available/assigned/held/quarantined/returning/unknown; renewal date vs known time; release deadline; missing rental facts; return preview; mixed-currency totals separated; partial failure; claimed-since-preview |
| Shared | Loading, empty, error/retry, offline, permission denied, request limit, narrow mobile and tablet, keyboard focus, modal close/cancel and non-color status labels |

Native gesture, haptic, keyboard, accessibility and app-lifecycle requirements are specified in [UX-SPEC.md](UX-SPEC.md). Long press is a shortcut to a visible action menu, never a purchase or delete gesture. The mockup demonstrates context sheets; OS haptics/share/keyboard behavior remains native implementation work.

The mockup draws representative states for each branch. A production component's complete permutations remain governed by this table and automated tests. Every provider web rendering rule ships in provider native; admin native gets the same management capabilities. Native billing remains within its existing information-only contract. Admin inventory becomes cards on narrow widths, never a squeezed table. Critical amounts/dates and action labels do not truncate.

## Acceptance tests — required implementation proof

No tests below have been run for this design-only task. Extend the existing suites, and read the testing/host skills completely before implementation. Unit tests alone cannot prove atomic claims or billing races.

### Money and carrier contracts

- Parse null, empty, invalid, negative, >2-decimal and unexpected-currency quotes as ineligible. Exact US$1 passes, US$1.0001 fails; setup cost is independently checked. Owned-number rental is not inferred as zero.
- Carrier fixtures: number unavailable between search/order; quote expired; compliance pending; 429 before send versus timeout after accepted POST; pending→success; rejected; unknown order with owned-inventory evidence; duplicate client retry; confirmed DELETE versus timeout versus not-owned evidence. Never automatically replay an unsafe POST due to a generic retry policy.
- Per-account concurrent daily-budget reservations cannot exceed approved count/spend. Unknown purchase retains its budget reservation. Repeated confirmed completion increments once. Currency buckets are distinct.
- Telnyx calendar boundary and Plivo account `renewal_date`, including leap February, month-end drift and date-only uncertainty. No invented universal “30 days”. Tax/setup/usage excluded from rental savings are labeled.
- Prorated first charge below cap while normal monthly rental exceeds cap: reject; no affordability bypass. Different first and subsequent charge evidence, no first-period refund assumption. Verify exact carrier routes, number IDs and currency against current documentation; fixture assertions must not fabricate carrier guarantees.
- A refreshed renewal date moves earlier/later, a date has no timezone, a date is missing/conflicting, or Telnyx supplies no renewal field: recompute from evidenced policy, recover overdue due-work or raise a durable incident. Leap/month-end fixtures consume actual returned dates, not an assumed anniversary formula. Telnyx deletion lock raises an actionable pre-deadline incident and is never bypassed automatically.

### Real SQL + Cosmos integration

- Two businesses claim the same number simultaneously: exactly one assignment, one business slot; loser gets alternate-choice conflict, no second carrier order.
- One business submits from web+phone with same and different request IDs: at most one active assignment/purchase; duplicate response resolves original operation.
- Allocation races return, reactivation, admin number replacement and quarantine expiry: stale workers cannot overwrite/release new ownership. Test crash after claim, after carrier acceptance, after profile write, after voiceline write, after notification publish and before acknowledgement.
- SQL trial expiry/card renewal/paid recovery/pending bank settlement/dunning cross with queued detach: only authoritative ended entitlement permits detach; recovered same number survives. SQL unavailable defers. A late reminder does not extend the 24h hold; recover overdue detach safely and alert.
- Atomic budget/claim updates and ETag generation checks against Cosmos emulator; SQL unique/rowversion/query-translation paths against SQL Server Testcontainers. EF InMemory does not substitute.
- Forwarding general-save bypass, own-number replacement bypass, cross-tenant operation ID, business admin versus platform admin, removed team member, changed expected old target and duplicate apply. Number change never mutates identity phone/MFA. ForwardExisting never creates a loop by setting ForwardTo to its source.
- Drain old live calls, reject new ingress during detach/return, clear caller identity/persona/knowledge binding; late callback for old binding cannot access new business context.
- Notification accepted/publish failure/replay, missing push token, suppressed email, language fallback, stale WhatsApp template category; no false “notified” stamp before durable acceptance and no multi-channel rollback of routing.

### Frontend and operations

- Web/provider native/admin web/admin native: all state-table branches; accessible dialog focus/return focus; 10-digit national input with country-aware paste normalization to E.164; double click; background/foreground; offline recovery; no redundant requests; no successful screen until API confirms readiness.
- Widths 360, 390, 768, 1024 and wide desktop; keyboard-only; long French/Gujarati/Hindi copy; largest supported text size; dark mode where existing app supports it. Provider and admin native equivalents must be separately inspected.
- Return preview becomes stale: assigned item is skipped and clearly explained, safe items succeed, unknown DELETE stays in reconciliation. “Potential next rental avoided” is not displayed as a refund.
- ARM, deploy.ps1 and local config stay aligned for any new worker/queue/settings. All IMemoryCache writes set Size=1. Bounded batch size, concurrency, retries and deadlines; cancellation/disposal tests for worker and carrier calls.
- Both regional hosts make identical decisions for the same UTC evidence despite Canada/India deployment and DST. A fully stopped return worker raises an independent missed-heartbeat alert; failed/unknown deletion, backlog and a return made too late remain visible rental exposure. Reconcile subsequent carrier charges so claimed savings can be checked against actual bills.
- Each host owns tests scanning its own source. Do not add peer-host references/checkouts. Any convention guard must fail on an empty/missing required root and prove its CI checkout shape.

## Rollout and monitoring

The owner-confirmed allocation appsetting defaults to **off in local/lower environments and on in production**, with explicit deployment overrides supported. Off preserves admin-led allocation; on enables provider self-service pool assignment/purchase. It never disables expiry, retention, detach, quarantine, reconciliation, forwarding requests or admin carrier returns. This supersedes the earlier disabled-by-default proposal for all lifecycle controls. One coordinator remains the only number writer after cutover.

Deployment must set the resolved environment value during resource creation and updates, using the existing ARM/`deploy.ps1` conventions for each executing host. Base appsettings and class default are false; production configuration explicitly overrides true. Lifecycle resources are provisioned in both modes. Verify the effective value on API and allocation worker; client capability follows backend configuration. Do not enable an unverified carrier purchase merely because production defaults on: failed readiness/cost checks still route to admin.

Required tests: lower-environment off and production on deployment values; explicit overrides surviving redeploy; off-mode provider submission creates an admin request without automatic claim/purchase; on-mode pool/purchase/fallback; stale client capability rejected server-side; queued operation sees off before purchase; already-started/unknown purchase reconciles; all expiry/removal/return flows run with allocation off. Switching on must not silently process old manual requests.

Track claim conflict rate, pending/unknown purchase age, projection lag, paid business missing number, terminal trial overdue detach, return deadline missed, rented-but-untracked numbers, notification intent age and currency-separated recurring exposure. Alert on meaningful transitions with cooldown; do not flood every sweep. Manual repair actions invoke the same coordinator and retain evidence.

The release gate is all relevant tests green plus carrier/account unknowns resolved. No app builds or integration tests are necessary to claim that these static design files were written; none have been misrepresented as executed.

## Revised quarantine policy

See RENEWAL-AUTOMATION.md, “Owner-requested quarantine revision”: independent trial-only (default 0 days after the 24h hold) and paid-service (default 15 days after detachment) appsettings. Quarantine never blocks safe pre-renewal carrier return. Include classification, saved policy/deadline, converted trials, unknown history, late payment, Keep and overdue-return cases. Schema proposals remain unapproved.
