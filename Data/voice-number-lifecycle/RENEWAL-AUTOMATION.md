# Renewal automation, country rules and review history

> **1 October 2026 — superseded in part.** The owner's final decisions are in `DECISIONS-2026-10-01.md` and the design to build is `FINAL-DESIGN.md` (its section 14 lists what changed). Read those first; **where this file differs, they win.** This file stays for the detail they do not repeat.

**MANDATORY CARRIER RESEARCH — COST IS SUPER IMPORTANT. The implementation session MUST research official Telnyx (Canada/US) and Plivo (India) billing online AGAIN: first and subsequent charges, proration/refunds, renewal calendar, month-end/leap dates, billing cutoff/timezone and available renewal APIs. Resolve conflicting information against the exact product/account and primary documentation, using authorized read-only evidence and written carrier confirmation when needed; ask the owner rather than guess. Read CARRIER-RESEARCH.md and RENEWAL-AUTOMATION.md fully. Save verified evidence and conservative UTC deadlines in the proposed partition-scoped Cosmos design after itemized schema approval; return eligible unused numbers with a default 24-hour lead. No unverified financial automation or promised refund.**

**Owner approved solution and mockup, 30 September 2026.** Read [final approved handoff](APPROVED-HANDOFF.md) first: any trial duration, historical regular billing even at zero dollars, national 10-digit entry, and existing admin queue integration. Itemized schema approval remains separate.

Design revision · 1 October 2026. These owner-requested requirements replace earlier manual-return and fixed-five proposals. No production code, schema or deployment has changed. The owner approved the mockup; itemized schema approval remains separate.

## Short explanation

Quarantine blocks reassignment to another business; it NEVER blocks carrier return. Revised defaults: trial-only expiry has zero extra quarantine after the 24-hour recovery hold; ended paid service has 15 days after detachment. Both durations are separate appsettings. Any trial duration follows the same rule when no regular AI-assistant billing period has ever occurred.

## Billing facts and remaining limits

| Carrier | Bought January 10 | Early return | Evidence |
|---|---|---|---|
| Telnyx, Canada/US | Standard recurring billing is at the start of February, not February 10. Initial purchase/proration must be checked on the account. | No inspected source promises unused-rental refunds; budget zero refund. | [Monthly charges](https://support.telnyx.com/en/articles/4425088-reporting-monthly-charges), [number deletion](https://support.telnyx.com/en/articles/4380325-search-and-buy-numbers) |
| Plivo, India Voice/Numbers | Purchase-date monthly billing; February 10 is an example. The owned number's actual renewal_date is authoritative. | Full-month rental still applies when removed mid-month. | [Billing FAQ](https://www.plivo.com/docs/faq/billing-and-invoices/billing-concepts), [account numbers API](https://www.plivo.com/docs/numbers/account-phone-numbers) |

Plivo supplies renewal_date as YYYY-MM-DD, not an exact charge timestamp. Neither inspected source settles the charge timezone or every January-31/leap-year rule. Read the next actual carrier date after every renewal; never add 30 days or calculate all future dates from purchase. Record carrier purchase evidence separately from business assignment time. Imported numbers with unknown purchase time stay explicitly unknown; an import timestamp is not a purchase timestamp.

## Automatic return flow

**Read renewal evidence → find unused numbers approaching renewal → check Keep → claim safely → return → confirm carrier removal → record outcome.**

Use the existing regional Function App, with an hourly UTC timer, not a new Function App resource per feature. Proposed default return lead is 24 hours. Each run processes numbers reaching that lead within the next hourly interval, including overdue work: normally 24–25 hours before a confirmed renewal boundary. This leaves a working day to resolve a failure. A daily 02:00 UTC summary is optional visibility, never the only execution opportunity. Configuration controls lead, cadence, batch size and bounded retries.

For date-only evidence, calculate against the earliest plausible start of that date (UTC+14 until the account's timezone is confirmed), then subtract the lead. This deliberately returns earlier than a guessed local midnight. Show the conservative scheduled time and date-only warning. If even the date is unknown, do not invent one: urgent reconciliation and admin action are required. No claim of guaranteed savings while carrier outages or unknown cutoffs remain.

Eligible: Available or Quarantined, owned by this carrier account, detached, no assignment/reservation/recovery hold/active call, no unresolved purchase/return, and no Keep override. Quarantined is eligible for carrier return but never early reassignment. Assigned and recovery-held numbers are excluded even when rent renews tomorrow. This may incur another rental to preserve promised service.

Acquire an ETag-protected return claim in the regional account partition. Recheck eligibility, live activity, ownership generation and Keep immediately before the external call. Allocation and Keep changes use the same claim boundary. Once the external return starts, disable Keep and say “Return already started”; never promise to undo a carrier deletion. Late calls cannot re-enable routing on a claimed asset.

A timeout is “Checking with carrier”, not success or permission to reuse. Reconcile against a successful account inventory response; absence from a failed or partial page is not proof. Persist per-number outcomes; one failure does not stop other returns. Retries are bounded and idempotent; no blind repeated purchase or destructive return against a changed owner. Confirmed removal stops future rental exposure; it does not create a refund.

On first failure or unresolved response create a deduplicated urgent admin alert with number, carrier, currency/rent at risk, renewal evidence, scheduled return, reason, attempts and next action. Update the same incident through retries; escalate before cutoff and record a missed renewal with its cost. Alert-delivery failure remains durable pending work. Admin remediation includes retry/reconcile or carrier-console intervention, followed by confirmation. No routine manual approval is required for automated returns.

## Keep this number

An authorized admin can choose Keep this number with a reason before the return claim starts. Show “Kept · monthly rent continues”, amount/currency, next renewal, who changed it and when. Default is indefinite until explicitly cleared; optional dated holds must show their expiry. Clearing Keep puts the number back into normal eligibility and shows its scheduled return; if overdue, explain it may return at the next run. Keep does not override quarantine, entitlement, active calls or regulatory restrictions. Concurrent Keep/return has one winner and a clear conflict result. Audit both enabling and clearing Keep.

## Regional caps and deployment contract

These are proposed configuration concepts, not existing bound key names. Implement names only after checking options and DI.

| Setting | Default / rule |
|---|---|
| Self-service allocation | false local/lower, true production; independent of return worker |
| Maximum monthly rental, NA Telnyx | USD 1.00 (100 minor units); a maximum, not a minimum |
| Maximum monthly rental, India Plivo | INR 200.00 (20000 minor units), subject to account/product confirmation |
| Maximum setup charge | zero per confirmed currency |
| Number choice limit | 5; positive validated integer with an explicit safe upper bound |
| Approval audit retention | 365 days from approval; snapshot protection deadline |
| Return automation | separate switch; recommended false local/lower, true production only after carrier readiness checks |
| Return lead / scan | 24 hours / hourly; conservative date-only policy above |
| Trial-only quarantine | 0 days after detachment; configurable, including 1 day if desired |
| Paid-service quarantine | 15 days after detachment; independently configurable |

Plivo publishes [India domestic Voice SIP Trunking numbers at ₹200/month](https://www.plivo.com/phone-numbers/pricing/in/). This is a published rate, not a guarantee of eligible inventory or the exact account product. Its public account API describes rental values in USD. Existing adapter currency labels cannot prove INR. Confirm the India account's units and domestic calling/compliance route before auto-buy; currency mismatch, missing/malformed price or non-binding price changes route to admin, never silently convert or treat as zero. Tax, usage and optional features are separate from this monthly rental cap and must remain visible in forecasts.

Deployment resolves environment AND regional stamp. NA applies CA/US Telnyx USD policy; India applies IN Plivo INR policy. ARM parameters and deploy.ps1 must write matching environment overrides into API and every executing worker on creation AND update, plus required-setting validation. No regional fallback that turns INR 200 into USD 200. Base API appsettings and options defaults agree; production receives explicit overrides. Function local.settings.json Values uses the same resolved options via double-underscore environment names; local defaults disable external automation. Local region examples contain no credentials. Validate configuration at startup and deployment, preserve explicit overrides, and expose only safe UI capabilities/counts through existing client config. Allocation off still permits expiry, quarantine, automatic returns and forwarding review.

## Country and choice UX

Lock country to the server-confirmed authorized phone country. Show a read-only country/calling code; no selectable India/Canada/US dropdown. Resolve Canada versus US using number metadata, not +1 alone. If ambiguous (including shared toll-free ranges), unverified, unsupported or inconsistent with business service country, request verification/admin review; do not guess. Recheck before submission and application. Ordinary phone/profile changes must not silently change business routing.

Show min(configured choice limit, eligible available count). Default 5; limit 10 with 7 eligible shows 7, and with 20 shows 10. Do not reserve all displayed numbers. Five or fewer use visible radio cards; larger lists use a labelled keyboard-accessible dropdown on web and the native platform picker/sheet on mobile. Preserve recommendation and selected number, scrolling, screen-reader labels and 44px touch targets. Long press offers actions, with a visible equivalent; never make it the only route. Zero, one, refreshed/taken choice, config reduction and permission/offline states remain covered.

## Protected forwarding approval

Approval must durably record an admin audit alert before reporting approval success: business/request, actor, old/new destination, decision timestamp, verification evidence reference and correlation ID. Distinguish Approved / Applying / Applied / Failed; approval does not claim routing succeeded. Replay creates one approval record. Notify providers only on confirmed application.

Retention defaults to 365 days via appsetting. Persist a protected-until snapshot at approval; lowering the setting must not shorten existing protection. Reject deletion in every API/repository/bulk path until that deadline; Read/Resolved must not expire it early. Set TTL from the protected deadline, accounting for Cosmos _ts updates; background cleanup obeys the same rule. UI shows protection end and no Delete action. Corrections append an event. Existing admin alert immutable-type pattern is reusable but its current global/current-setting TTL logic needs this stronger contract. This is application-level protection, not a claim that a subscription administrator cannot delete the database.

## Additional schema proposals — owner approval required before implementation

Extend the existing proposed VoiceNumberAsset (same regional account partition): keepForReuse bool; keepReason string; keptBy string; keptAtUtc DateTimeOffset; keepUntilUtc nullable DateTimeOffset. Proposed inventory admin command writes; return coordinator and inventory UI read. No new table: these are one-to-one facts. Not an enum/constant: they vary by number. Existing runtime voiceline ownership does not encode this override. Cost: asset write/point read and small storage increase, no new Keep index (due work still scoped by existing proposed due index). Without it, the worker cannot honor Keep.

Approval record protectedUntilUtc DateTimeOffset is a proposed stored audit contract; first verify whether existing alert metadata can carry it without a new top-level field. Approval writes, delete/TTL guards and audit UI read. Fixed retention configuration alone cannot preserve older deadlines after a setting reduction. Cost: one durable approval record and bounded retention storage; reuse existing alert partition/type patterns, no new container. Both this metadata contract and any TTL/index change require explicit itemized schema approval. Do not generate migrations from this design.

## Acceptance cases for implementation

Prove both regional stamps and allocation on/off; Jan10 and month-end/leap-year carrier fixtures; date-only/unknown renewal; cap equality and one-minor-unit-over; wrong currency and stale quote; 3/5/7/10 choices; CA versus US +1 and India; missed timer recovery; Keep versus return race; active call versus return; quarantine return versus blocked reassignment; partial carrier inventory pages; timeout after successful deletion; duplicate timer delivery; alert send failure; and retention changes/read/resolve/bulk delete before and after protected deadline. Real Cosmos integration tests must prove claim concurrency and TTL invariants. Web/tablet/mobile review remains required before integrated UI implementation.

## Owner-requested quarantine revision

This replaces the earlier blanket 30-day recommendation. Design requirement only; deployed behavior remains unchanged.

| Event | Recovery hold | Extra reassignment wait | Carrier return |
|---|---|---|---|
| Any-duration trial ends without conversion, with no historical regular AI billing | Exactly 24 hours after actual trial end | Default 0 days after detachment | May return immediately when due, even if configured trial quarantine is 1 day |
| Paid service ends after cancellation | Existing paid-through date and applicable dunning complete, then the designed 24-hour hold | Default 15 days after detachment | Return before renewal even during these 15 days |

Example: trial ends January 14 at 10:00; detach January 15 at 10:00. With trial quarantine 0, the number can enter the eligible pool once routing cleanup and ownership checks finish. If configured to 1, it becomes reusable January 16 at 10:00. Paid example: detach January 15; reuse is blocked until January 30. If rent renews January 20, return before January 20 using the carrier-safe deadline; do not wait until January 30 or pay another rental merely to finish quarantine.

Classification uses the departing assignment's authoritative billing history, not trial length or the current UI label. A trial that converted to paid service uses the paid policy. A new trial business does not erase a prior unresolved paid-business quarantine on the asset. Unknown/imported history blocks reassignment for review but does not prevent safe carrier return. Cancellation requests do not end already-paid entitlement early. Pending payment must be reconciled before detachment.

At detachment, snapshot the applicable duration and compute quarantineUntil from the actual detachment instant (UTC). Zero skips the quarantine state. Proposed existing lifecycle-operation policy evidence records TrialOnly/Paid/Unknown and applied duration; this is an additional schema contract requiring owner approval before implementation. Workers use the saved deadline so a configuration change does not silently rewrite existing quarantines. Explicit authorized recalculation is audited. API/worker local defaults, options, ARM and deploy.ps1 must all receive the two separate values for both regional stamps.

Neither warning delivery nor a failed notification extends the promised 24-hour provider hold. Scheduled detachment revokes routing entitlement at the deadline; retries recover failed projections. In-flight calls drain safely and block reassignment/return until safe. Raise an operational alert rather than promise exact physical carrier deletion during an outage. If the return deadline has already passed when detachment occurs, attempt safe return promptly and alert on rental risk; never wait for the next month's window.

A Keep override remains the explicit exception: an admin chooses continued rent with visible cost. Otherwise, quarantine alone never justifies renewing an unused number. Reuse before the return deadline cancels the idle-return job atomically; return claimed first removes it from selection. No old persona, transcripts, caller context or delayed callback may cross into the new business. Zero trial quarantine increases wrong-business-call risk; clear expiry wording helps set expectations but cannot stop former callers.

Provider copy: “Your trial ends on [date/time]. Unless you activate a paid plan, your assistant number will be removed 24 hours later, on [date/time]. After removal, you may lose this number permanently. Update anywhere you shared it.” For connected existing numbers, also require removal of external forwarding; unresolved forwarding creates a safety block on reassignment, not an obligation to renew carrier rental.

Acceptance additions: trial 7/14 days; trial quarantine 0/1; paid quarantine 15/custom; converted trial; unknown history; renewal inside quarantine; return already overdue at detach; Keep on/off; setting changes during an existing hold; failed reminder without deadline extension; late payment and assignment races.

## Mandatory timezone-independent return schedule

**NEVER DERIVE BILLING TIME FROM THE FUNCTION APP'S DEPLOYMENT REGION, THE NUMBER'S COUNTRY, THE ADMIN'S LOCAL TIME OR OUR PURCHASE REQUEST TIME. Persist all actual instants in UTC; retain the carrier's original date/time, timezone evidence and precision separately. An India number does not prove that Plivo bills it in India Standard Time.**

**THE CARRIER-RETURN SCAN RUNS EVERY HOUR AT MINUTE 00, IN UTC: 00:00, 01:00, …, 23:00. Azure six-field NCRONTAB default: 0 0 * * * *. Put the schedule and 24-hour lead in appsettings and deploy them on create/update for both stamps. Do not change the host timezone to implement carrier billing. Set UseMonitor=true and RunOnStartup=false; each invocation recovers persisted overdue work.**

This is independent of the five-minute entitlement/detachment recovery sweep. No daily local-midnight job determines carrier return. A daily summary is optional only.

1. Purchase: persist our request-start and confirmation-observed UTC instants with carrier/account/order identity. Preserve an actual carrier purchase timestamp if provided. Our response observation is not the exact instant the carrier rented it. Plivo documents added_on and renewal_date as date-only YYYY-MM-DD; do not fabricate hours/minutes for them. Capture this evidence before declaring allocation complete; recover missing evidence after ambiguous purchase without issuing a second order.
2. Renewal: use carrier-owned-number renewal evidence refreshed after purchase and each renewal. Plivo's actual renewal_date handles month length/leap dates without invented AddDays(30) or perpetual AddMonths logic. For Telnyx, use documented calendar-month policy plus account cutoff evidence. Cache durable evidence; bounded account pagination and near-due refresh avoid an hourly full-account request per number.
3. Convert: if the carrier confirms an exact instant, use it. If only a date and confirmed billing timezone are known, use the earliest instant of that date in that timezone (not a guessed charge hour). Resolve DST ambiguity conservatively. If timezone is unknown, use midnight at UTC+14 on the reported date as a deliberately early lower bound, clearly labelled conservative, not a carrier-confirmed renewal timestamp. If the date itself is missing or stale/conflicting, urgently reconcile and alert; never invent a renewal date or quietly omit the asset.
4. Calculate: returnTargetUtc = renewalBoundaryUtc minus configured lead (default 24 hours). Scan indexed persisted due work in each explicit regional/account partition where returnTargetUtc <= currentUtc + one scan interval, including ALL overdue outstanding work, with bounded pages and continuation. This normally starts returns 24–25 hours before the boundary. Do not filter only by “tomorrow” or by equality with today's date; that loses missed runs. Capacity/backlog alerts cover work that cannot finish within the interval. Timestamp comparisons use UTC, independent of deployment location.
5. Execute: refresh required near-due evidence, atomically claim, recheck assignment/hold/calls/Keep/generation, and return eligible unused numbers. Quarantine does not block return. Persist the outcome; a request sent is not confirmed removal. Retry/reconcile durably and alert immediately on failure/unknown outcome. New detachment or Keep removal after the target makes the item immediately due; it must not wait for next month's boundary.
6. Monitor: timer monitoring is not business-operation durability. Do not assume automatic timer retries; persist attempts and retry due times. An independent platform monitor must alert on missing successful scan/heartbeat (proposed configurable threshold two scan intervals), failed runs and overdue return backlog, so an entirely stopped Function App does not have to alert about itself. Reuse existing monitoring/alert routes; any new resources/config require matching deployment changes. Bounded retries and claim fencing prevent duplicate destructive work across instances/stamps.

**ILLUSTRATIVE CONFIRMED-TIMEZONE EXAMPLE (NOT A CLAIM ABOUT PLIVO): carrier says renewal date February 10 with billing timezone Asia/Kolkata. Earliest boundary = February 9, 18:30 UTC. Target = February 8, 18:30 UTC. The February 8, 18:00 UTC scan includes it in the next-hour window and starts the return 24.5 hours before the earliest renewal. A Function App in Canada or India makes the identical decision.**

If the same February 10 date has no confirmed timezone, the UTC+14 fallback boundary is February 9, 10:00 UTC, with target February 8, 10:00 UTC. Returning earlier buys safety at the expense of some prepaid reuse time. Confirm the account timezone to reduce that margin. No design can guarantee zero rental charges during an extended outage or when an assignment/hold/Keep intentionally prevents return; record and escalate those exceptions rather than promise otherwise.

**IMPLEMENTATION MUST TEST identical selection under Canada/India host locations and DST changes; date-only versus exact timestamps; leap February and January 31; refreshed/changed renewal dates; delayed timer execution; clock skew; partial pagination; backlog; missed heartbeat; timeout after successful return; and Keep/assignment races. Show actual UTC schedule, evidence precision, conservative target and carrier confirmation in admin details and audit.**

Sources rechecked 30 September 2026: [Plivo account numbers](https://www.plivo.com/docs/numbers/account-phone-numbers), [Azure timer trigger](https://learn.microsoft.com/en-us/azure/azure-functions/functions-bindings-timer). Azure defaults timers to UTC; timezone overrides are not supported on Linux Flex Consumption. Plivo's inspected API does not state a charge timezone. Account confirmation remains required to describe an exact renewal instant.

## Carrier API evidence and persistence — 1 October 2026

**Plivo India: retrieve the owned number's actual renewal_date after acquisition, after renewal and in bounded near-due reconciliation. Preserve it as a date, not a fabricated timestamp. Telnyx Canada/US: retrieve ownership, purchased_at and order status, and reconcile incurred rental through its charge reports; the inspected APIs do not expose an exact next-renewal timestamp. Apply the verified first-of-month policy with account cutoff evidence. Exact GET/DELETE/report routes and source limits are in CARRIER-RESEARCH.md.**

**Persist renewal facts and the derived deadline on the proposed VoiceNumberAsset in the existing SystemData inventory partition for this deployment/carrier account. Store attempt/acknowledgement/reconciliation on VoiceNumberOperation. The partition is explicit, non-secret and account-specific; no cross-partition query. Preserve date-only evidence, timezone/precision/source/reconciliation time, and distinguish purchased_at, activation, our request time and business assignment. Use SCHEMA-REVIEW.md's itemized approval gate before adding or changing any field/index.**

**DO NOT WAIT FOR AN INVOICE OR RECHARGE TO DECIDE WHEN TO RETURN. An invoice is a report and a recharge funds the balance; neither is the number's renewal authority. Full normal monthly rent determines the configured cap even if the first charge is partial. Return is not a refund. COST IS A FIRST-CLASS REQUIREMENT across both stamps.**

Telnyx exposes deletion_lock_enabled in its owned-number contract. If enabled, alert before the return deadline and require authorized admin resolution; never automatically remove the carrier's protection merely to make deletion succeed. Keep and carrier deletion lock are separate controls. Invalid account/number ID, port-out/ownership change or a partial inventory response also require explicit reconciliation rather than a false Returned result. Recheck the ownership generation before retrying a destructive operation. The DELETE response must be validated against its documented carrier/account/number/status; persist it and reconcile ownership after ambiguity.

**MANDATORY IMPLEMENTATION RESEARCH: repeat primary-source online research for Telnyx and Plivo, first and later rentals, refunds, month-end/leap dates, API renewal fields, currencies and billing cutoff/timezone. Cross-check the exact Canada/US and India accounts with authorized read-only evidence. Resolve conflicting sources with the applicable carrier/account contract and written confirmation where needed, record the resolution, and ask the owner about any remaining business/spending uncertainty. Do not enable unverified financial behavior.**
