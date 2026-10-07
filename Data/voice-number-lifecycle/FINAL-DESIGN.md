# AI Assistant numbers — final design for implementation

**1 October 2026. This file is the single authority for WHAT to build.** It was written after the owner's
review of every schema row and decision, the fresh carrier research and the read-only account evidence. Where it
differs from `PLAN.md`, `RENEWAL-AUTOMATION.md`, `SCHEMA-REVIEW.md`, `DELIVERY.md`, `EDGE-CASES.md`, `NOTIFICATIONS.md`,
`UX-SPEC.md`, `SIMPLE-OVERVIEW.md` or `APPROVED-HANDOFF.md`, **this file and `DECISIONS-2026-10-01.md` win**; §14
lists every superseded statement. Those older files remain the source for detail this file does not repeat
(copy drafts, the acceptance-test lists, the UI state inventory, the native interaction rules).

No application code exists yet. Hard lines for the builder are in §0.

## 0. Hard lines

1. **Never purchase, reserve, release or modify a phone number at Telnyx or Plivo while building or testing — not
   on the sandbox accounts either. They are billed.** Carrier fixtures and fakes only. Read (GET) calls are allowed.
2. No cross-partition Cosmos query. Every inventory read and write passes the inventory partition key.
3. Nothing is stored without a TTL (§3.6).
4. A carrier purchase POST is never retried automatically. An unknown result is reconciled, never repeated.
5. A number this system did not itself buy or detach is never offered and never returned automatically.
6. An unreadable, missing or foreign-currency price is "unknown" and refused. It is never read as zero.
7. Only what is listed in §3 may be added to any schema. Anything else goes back to the owner first.

## 1. What we are building, in one page

- A provider who has an AI Assistant trial or paid plan finishes setup and **gets a number without waiting for an
  admin**: first from numbers we already rent, otherwise a newly bought one within strict price limits, otherwise
  the request goes to the admin exactly as today.
- The "number to reach you on" of a dedicated assistant number **can only be changed by a platform admin**, after
  the provider sends a request. A connected own number keeps its existing self-service "Change" and test call.
- When AI service really ends (trial not converted, cancellation reaching its end, failed payments exhausted), the
  provider keeps the number for **24 hours**, then it is removed. Paying inside that day keeps it.
- A removed number goes back to our pool. A trial-only business's number is reusable at once; a business that
  ever paid for the AI Assistant has a **15-day** wait before another business may get it.
- Unused numbers are **returned to the carrier before their next rent is charged**, except a small buffer on
  Telnyx (default 10, admin-adjustable) that is cheaper to keep than to re-buy.
- The admin gets a queue of requests, a carrier inventory, limits he can change without a deployment, and a
  dedicated alert for every event that costs or risks money.

Regions: **Telnyx = Canada/US stamp, fully automatic. Plivo = India stamp, admin-led assignment**, with removal,
reuse wait and returns automatic.

## 2. Cost facts the rules rest on (observed on the accounts, 1 Oct 2026)

| | Telnyx (CA/US) | Plivo (India) |
|---|---|---|
| One-time fee per new number | US$1.00, on top of rent | None |
| First month | Rent prorated by day, purchase day included | A full month at purchase: ₹200 + 18% GST = ₹236 |
| After that | US$1.00 for every number owned when the 1st begins (UTC) | ₹236 on the number's own `renewal_date` (purchase-day anniversary), posted inside that UTC day |
| Early return | Stops future months. No credit observed or published | No refund |
| Price per number | Varies: one Hamilton number was $2.00 beside nine at $1.00. Unfiltered US search returned toll-free at $40 + $500 | Uniform. The API quotes `2.50000` (documented as USD) while the account is charged ₹236 — the quoted field is NOT rupees |
| Order call | No price limit, no idempotency key; accepts `customer_reference`, and orders can be listed by it | No price limit, no idempotency key; needs the accepted compliance application |
| "No inventory" | HTTP 400, code 10031 | Empty list with an `error` text |
| After return | Held about 15 days for us; re-buy "will reincur charges" (one-time fee not confirmed either way) | Archived: reserved 5 days |

Consequences: reuse beats everything (it avoids the one-time fee); returning mid-month saves nothing; what was
already paid for a number never matters to a keep-or-return decision — only whether it will be needed.

## 3. Data — everything that is stored (approved; see `SCHEMA-APPROVAL-REQUEST.md` revision 3)

### 3.1 `VoiceNumberAsset` — one per number we rent
SystemData, `pk = voiceinv_telnyx` or `voiceinv_plivo` (from the existing `Voice:Carrier` setting), `id = vnasset_{e164}`.

| Group | Fields |
|---|---|
| Identity | `e164`, `carrier`, `carrierNumberId?`, `country`, `region?`, `locality?` |
| Lifecycle | `status` (Purchasing, Available, Reserved, Assigned, Quarantined, Returning, Returned, NeedsReview), `reviewReason?`, `assignedBusinessId?`, `lastBusinessId?`, `assignmentGeneration`, `assignedAt?`, `availableSince?`, `quarantineUntil?` |
| Rent | `monthlyRental?` (decimal), `currency?`, `carrierPurchased?` (the carrier's value as given) |
| Renewal | `nextRenewalDate?`, `renewalBoundaryUtc?`, `renewalBasis` (CarrierRenewalDate, CarrierCalendarMonth, Unknown), `returnTargetUtc?`, `reconciledAt?` |
| Keep | `keepForReuse`, `keepReason?`, `keptBy?`, `keptAtUtc?` |
| Return attempt | `returnAttempts`, `returnStartedAt?`, `lastFailureCode?` |
| Work | `dueAt?`, `ttl` |

### 3.2 `VoiceNumberRequest` — at most one live record per business per kind
Same partition, `id = vnreq_{kind}_{businessId}`, kinds `Setup`, `ForwardingChange`, `SpecificNumber`, `ServiceEnd`.
Because the id is fixed, a second request of the same kind for the same business collides with the first: that
collision IS the "one at a time" rule. A finished record is replaced (ETag) when the business starts a new one.

| Group | Fields |
|---|---|
| Common | `kind`, `status`, `businessId`, `requestId`, `requestFingerprint`, `actorId`, `completedAt?`, `attemptCount`, `lastFailureCode?`, `dueAt?`, `notices:[{kind, acceptedAt?}]`, `ttl` |
| Setup | `e164?`, `assignmentGeneration?`, `carrierOrderId?`, `carrierAttemptAt?`, `carrierConfirmedAt?`, `quotedMonthlyRental?`, `quotedSetupFee?`, `quoteCurrency?`, `quoteObservedAt?` |
| Forwarding / specific number | `expectedOldTarget?`, `requestedTarget?`, `requestedText?`, `requestNote?`, `numberMode?`, `verificationMethod?`, `verificationReference?`, `decidedBy?`, `decidedAt?`, `providerReason?`, `requestsDate?`, `requestsToday` |
| Service end | `entitlementEndedAt?`, `detachAt?`, `billingHistoryClass?` (TrialOnly, PaidHistory, Unknown), `quarantineDays?` |

### 3.3 `VoiceNumberDailyCounter` — one per UTC day
Same partition, `id = vncount_{yyyy-MM-dd}`: `day`, `purchases` (atomic increment, the existing counter pattern), `ttl`.

### 3.4 New fields on existing documents
| Document | Field | Purpose |
|---|---|---|
| `VoiceAssistantState` (business profile) | `numberAssignmentGeneration : long?` | Refuse a write from an older assignment |
| `Voiceline` | `numberAssignmentGeneration : long?` | Same, on the phone line |
| `VoiceAssistantNumberAudit` (365 days, undeletable, existing) | `verificationMethod : enum?`, `verificationReference : string?` | Evidence on a forwarding approval |
| `VoiceOwnNumberPlatformConfig` (`voicecfg_platform`, existing admin-edited settings) | `numberPurchaseWarningPerDay : int?`, `numberPurchaseLimitPerDay : int?`, `idleNumberBuffer : int?` | Admin-adjustable limits; `null` ⇒ the appsettings default (existing documents lack the fields and must NOT read as zero) |

### 3.5 Index
One new `IncludedPath` `/dueAt/?` on the **SystemData** container, in `CosmosContainerPolicies.SystemData`
(`clinqetcore`), applied by `cosmosindexsetup`. No new composite. The due read is
`WHERE c.pk = @pk AND c.dueAt <= @now ORDER BY c.dueAt`, bounded and paged. Lists for the admin use the existing
`(type, createdAt DESC, id DESC)` composite and the existing `/status/?` path.

### 3.6 TTL — nothing without one
| Record | TTL |
|---|---|
| Number record while owned | 400 days from its last write; the hourly reconciliation rewrites it at least once a month when the renewal facts move |
| Number record after a confirmed return | 365 days |
| Request record | 365 days from its last write |
| Daily counter | 90 days |
A rented number whose record ever expired is re-imported from the carrier's list as `NeedsReview`.

### 3.7 SQL
**No change.** Trial-only versus paid history is read from the existing `BillingTransactions`: a row for the
business with `Type` AddOnCharge or AddOnUpgrade and `Status` Succeeded (this includes a purchase a promo code
discounted to zero) ⇒ PaidHistory. None ⇒ TrialOnly. SQL unreachable ⇒ Unknown ⇒ the removal waits.
Verify at build time that every paid AI path (purchase, renewal, end-trial switch) writes one of those two types.

## 4. Settings

`appsettings.json` section `VoiceNumbers`, bound in the API and the Functions host; class defaults mirror the file.
Two values per stamp are written by `deploy.ps1` on create AND update.

| Key | Default | Notes |
|---|---|---|
| `SelfServiceAllocationEnabled` | false (local/lower), **true (production)** | Provider self-service on/off. Off = today's admin-led flow. Never affects removal or returns |
| `AutomaticReturnEnabled` | false (local/lower), **true (production)** | |
| `MaxMonthlyRental` / `MaxSetupFee` / `RateCurrency` | Telnyx 1.00 / 1.00 / USD; Plivo 2.50 / 0 / USD (the unit Plivo's API quotes in) | Replaces `VoiceAssistant:MaxNumberMonthlyCostMinor` (delete it, and its ARM/deploy entries) |
| `QuoteMaxAgeSeconds` | 60 | A quote older than this is taken again before ordering |
| `ChoiceLimit` | 5 (maximum 10) | Numbers shown to a provider |
| `HoldHours` | 24 | |
| `TrialOnlyQuarantineDays` / `PaidQuarantineDays` | 0 / 15 | Replaces `NumberReassignmentQuarantineDays` |
| `ReturnLeadHours` / `BoundarySafetyHours` | 24 / 14 | Return target = renewal boundary − safety − lead |
| `LifecycleSchedule` | `0 0 * * * *` (hourly, minute 00, UTC) | Host-resolved trigger setting ⇒ `local.settings.json` + `deploy.ps1` |
| `PurchaseWarningPerDay` / `PurchaseLimitPerDay` / `IdleNumberBuffer` | 10 / 25 / 10 (Plivo buffer 0) | Seeds; the admin's values in `voicecfg_platform` override |
| `RequestCooldownMinutes` / `RequestsPerDay` | 10 / 5 | Per business, forwarding and specific-number requests |
| `MaxReturnAttempts`, `MaxSetupAttempts`, `ReservationMinutes` | 24 / 12 / 15 | Bounded retries |
| `ForwardingApprovalRetentionDays` | reuse the existing `VoiceAssistant:NumberAuditRetentionDays` (365) | No new key |

## 5. One coordinator, three rules

All number changes — self-service, admin assign/change/remove, service end, return — go through one new service
in `clinqetinfrastructure` (registered in the API and the Functions host). The existing
`VoiceAssistantService.AssignNumberAsync / ChangeNumberAsync / RemoveNumberAsync / ReleaseAssistantNumberAsync`
call it; no path writes a number onto a profile or a voiceline by itself any more.

1. **Claim before act.** A number changes hands only by an ETag-conditional write on its `VoiceNumberAsset` that
   also raises `assignmentGeneration`. Asset + request + counter writes that belong together go in one
   transactional batch (same partition).
2. **Project with the generation.** The profile (`AssignedNumber`, status) and the voiceline (`BusinessId`,
   routing) are written with the generation; a write carrying an older generation is refused.
3. **Record before the carrier call.** The request record says "purchase started" (with our reference) or the
   asset says "returning" BEFORE the POST/DELETE. An unknown answer is resolved by asking the carrier.

## 6. Flow A — setup and number assignment

### A1. Provider finishes setup
1. `SubmitApplicationAsync` as today (readiness, country, consent). New: in BOTH number modes the server sets
   `Application.ForwardingTarget` from the **primary owner's confirmed phone** (SQL: `IBusinessMemberDirectory.
   GetPrimaryOwnerUserIdAsync` → `UserProfile.PhoneNumber` + `PhoneNumberConfirmed`) when it is empty. The client
   no longer supplies it. No confirmed phone ⇒ refusal `…ForwardingTargetUnverified` ⇒ the "confirm your business
   phone" screen.
2. The submitted alert fires once, as today.
3. Allocation OFF, or India stamp, or the add-on is not `Trialing`/`Active`: stop here — admin-led as today.
4. Allocation ON (Telnyx): status moves straight to `NumberPending` (no manual approve step) and the provider is
   shown number choices.

### A2. Choices
1. **Pool first.** Read `Available` assets for the business's country whose rent is known and within the cap.
   Excluded: `NeedsReview`, `Quarantined` (unless this business is `lastBusinessId` — the previous holder is
   never gated), reserved, returning.
2. Rank: business locality match → area code of the saved forwarding number → rest of the country; stable tie-break
   by `e164`. On Plivo, numbers whose paid time covers the trial plus the hold rank ahead (India is admin-led, so
   this ranking serves the admin's picker).
3. Pool empty ⇒ carrier search: `phone_number_type=local`, voice, `exclude_held_numbers=true`, by locality +
   state/province from the business address; on a 400/10031 fall back to the forwarding number's area code, then
   country-wide. Keep only results with a readable price within both caps and `currency == RateCurrency`.
4. Return up to `ChoiceLimit`; the first is the recommendation. Nothing is reserved while the provider looks.
5. Nothing qualifies ⇒ the request goes to the admin (A5).

### A3. Provider confirms a number (`requestId` from the client)
1. Create `vnreq_Setup_{businessId}` (create-if-absent). Exists and open ⇒ return it. Same `requestId` with a
   different number ⇒ conflict.
2. Re-check: allocation still on, add-on still `Trialing`/`Active`, business not closed.
3. **Pool number:** batch { asset `Available → Assigned` for this business, generation+1, `assignedAt`; request
   `Applying` }. Then project: profile (CAS, generation), voiceline sync (generation), minute cap from the SQL
   ledger. Then notices. Request `Completed`. A failed projection leaves the request `Applying` with `dueAt = now`;
   the hourly job resumes it. Lost the claim (someone else took it) ⇒ "that number was just selected", refreshed list.
4. **New carrier number:** enqueue to `voice-number-operations`; answer "setting up your number". The Functions
   worker:
   a. re-checks step 2 and the daily counter (increment; above the limit ⇒ decrement, A5, limit alert; at the
      warning level ⇒ warning alert);
   b. takes a fresh quote of that exact number; either cap exceeded, price unreadable or currency wrong ⇒ A5,
      counter decremented;
   c. batch { create asset `Purchasing` for this business; request `Purchasing`, `carrierAttemptAt`, quote fields };
   d. orders with `customer_reference = requestId` (Telnyx) / with the compliance application id (Plivo, admin path only);
   e. success ⇒ asset `Assigned` + step 3's projections; clear failure ⇒ asset removed, counter decremented, A5;
   f. **no answer / pending** ⇒ request `CheckingCarrier`, `dueAt` set; the worker/hourly job asks the carrier
      (Telnyx: orders by `customer_reference`, then the owned number; Plivo: the owned number). Owned ⇒ continue as
      success. Clearly not owned ⇒ as a clear failure. Still unknown after `MaxSetupAttempts` ⇒ `NeedsAdmin` + alert;
      the asset stays `Purchasing` (possibly rented) and visible.
5. Success notices only after the profile, the line and the minute cap are confirmed: the existing
   `VoiceAssistantActivated` / `VoiceAssistantReadyToConnect`, plus an admin "self-service completed" alert (low).

### A4. Admin-led assignment (allocation off, India, or fallback)
The existing admin quote / assign / change / remove endpoints stay, routed through the coordinator: the same caps
(an admin may confirm a number above the cap only through the existing explicit purchase confirmation), the same
record-before-carrier rule, the same generation. The India buy call sends `compliance_application_id`.

### A5. Fallback to the admin
Request `NeedsAdmin` with a reason (no number within the limits, daily limit reached, carrier fault, allocation
off, unknown purchase). Provider sees "our team is arranging your number" and gets one in-app + email notice.
Admin gets a dedicated alert and the request appears in the queue.

### Edge cases (A)
Two devices, same or different request ids · provider leaves mid-purchase · allocation switched off before /
after the order · trial ends during setup (no purchase without a live add-on) · the chosen pool number taken a
moment earlier · price moved above a cap between list and confirm · carrier returns pending · the order succeeded
but the profile write failed (number stays tracked and assigned, projection retried — never a second purchase,
never an automatic release) · employee, not the owner, runs setup (target is still the owner's confirmed phone) ·
owner's phone unconfirmed · business country not served by the stamp · burst of sign-ups (pool, then the daily
limit, then the admin queue).

## 7. Flow B — changing the "number to reach you on"

Applies to **dedicated mode only**. In own-number mode the existing card "Change" + wizard + test call stays
(the test call proves control of the line).

1. Provider (permission `voice.number.manage`, live re-check) opens "Request a change": fixed country shown
   plainly, 10-digit national input. Server rebuilds E.164 from the business country and validates with the
   existing own-number rules (`VoiceOwnNumberSettings.Countries`: length, blocked prefixes; not unchanged; not a
   Clinket number or verification caller; not a platform line; carrier lookup agrees with the country).
2. `vnreq_ForwardingChange_{businessId}` created (one open at a time; identical retry returns it; cooldown and daily
   limit counted on the record). Alert `VoiceForwardingChangeRequested`. Provider sees "request sent — your
   current number still works" and may withdraw before a decision.
3. Admin opens it from the queue or the alert, records how control was verified (method + reference), applies or
   declines with a provider-safe reason.
4. Apply = compare `expectedOldTarget` with the saved target (mismatch ⇒ conflict, reload) → write the audit row
   (old, new, admin, method, reference; deterministic id from the request id so a retry writes it once) → profile
   target (CAS) → voiceline `ForwardTo` (generation) → notices to the business-security audience → request `Applied`.
   Provider is told only after the line is confirmed.
5. `SaveApplicationAsync` no longer accepts a changed target in dedicated mode (server-owned field); the existing
   own-number guard is unchanged.

Edge cases: two admins decide together (ETag, one wins) · target changed meanwhile · request for the same number
as today · premium/service prefix · number in another country · requester loses permission before sending ·
ownership transferred (saved number unchanged) · owner edits their profile phone (saved number unchanged) ·
decline (current number stays) · notice failure (retried from the record; routing is not rolled back).

## 8. Flow C — "I want a particular number"
`vnreq_SpecificNumber_{businessId}`: free text (a number or an area) + note. Admin request only: no price promise,
no purchase, no reservation, never above the caps without the admin's own explicit purchase confirmation.

## 9. Flow D — AI service ends: hold, removal, recovery

**Billing is the authority and runs once a day (04:00 UTC).** A trial therefore really ends at the first billing
run after its end time, and the entitlement stays live until then (existing behaviour). The number clock starts
from that real event, never from a predicted time.

1. **Reminder** — the existing AI add-on trial reminder, exactly one per trial, with its own lead
   (`Trial:AiReminderLeadDays = 2`) so it always arrives at least a full day before the end. When the business
   has a number the text adds: the number is removed one day after the service ends.
2. **Service ends** — every AI switch-off goes through ONE method, `SubscriptionBillingService.DowngradeAddOnAsync`
   → `CompleteAddOnDowngradeAsync` (trial without conversion, cancellation at period end, failed payments
   exhausted). Its tail calls the coordinator: if the business holds a number, create
   `vnreq_ServiceEnd_{businessId}` with `entitlementEndedAt = now`, `detachAt = now + HoldHours`,
   `billingHistoryClass`, `quarantineDays` (snapshotted), `dueAt = detachAt`. Notice: "AI answering is off; your
   number is held until {exact time}". Mode-specific wording as in `NOTIFICATIONS.md`.
3. **Payment during the hold** — every activation goes through `AiAddOnService.ApplyActivationTailAsync`; it calls
   the coordinator: an open `ServiceEnd` request is cancelled, the number stays, "active again" notice.
4. **Removal at `detachAt`** (hourly job): re-read SQL — live again ⇒ cancel; SQL unreachable ⇒ wait; a payment
   still settling ⇒ wait (existing reconciliation decides). Otherwise: asset `Assigned →` `Available` (TrialOnly,
   0 days) or `Quarantined` until `now + quarantineDays`; generation+1; `lastBusinessId`, `availableSince`; profile
   → `NumberPending` with no number (existing removal semantics); voiceline → `Returned` (existing wipe); audit row;
   the existing `VoiceAssistantNumberRemoved` notice with a new reason. Live calls: the line stops taking new
   calls at once; a call in progress finishes (existing 30-minute limit); the number is not handed to another
   business while a live-call marker exists.
5. **Own-number mode at removal** — the provider's carrier may still forward to our number. Unless the existing
   disconnect check has proven forwarding off, the asset is `Quarantined` with reason `ForwardingNotProvenOff`:
   never reused, returned before its renewal.
6. **Coming back later** — the business is `NumberPending`; when it has a live add-on again it chooses a number as
   in A2, and its own previous number is offered first if we still rent it.
7. **Missed event safety net** — an `Assigned` asset carries a `dueAt` for a periodic check (daily): add-on not
   live and no `ServiceEnd` request ⇒ create one now. Business closed or profile gone ⇒ removal now + alert.
   `BusinessClosureTeardown` also calls the coordinator directly.

Edge cases: payment at the same moment as removal (both go through the one request record; a committed removal is
not undone — the business chooses again and is offered its old number first) · pause, private mode, exhausted
minutes, admin hold are NOT service end · trial extended by billing (no event ⇒ nothing happens) · admin-comped
assistant with no add-on (never auto-removed; on admin removal the class is Unknown ⇒ paid wait) · reminder or
notice fails (retried; the deadline does not move) · billing run delayed (the hold simply starts later) ·
zero-price or promo-to-zero paid period (PaidHistory, §3.7) · paid then later trial (PaidHistory).

## 10. Flow E — keep or return (the hourly job)

One Functions timer, `VoiceNumbers:LifecycleSchedule`, hourly at minute 00 UTC, `UseMonitor = true`,
`RunOnStartup = false`. Each run, in order, each step isolated so one failure cannot starve the next:

1. **Carrier read** — list owned numbers (Telnyx one page of 250; Plivo pages of 20) and the account balance.
   Update each asset's rent and renewal facts **only when they changed**. Telnyx: boundary = 00:00 UTC on the 1st
   of next month (`CarrierCalendarMonth`). Plivo: `renewal_date` at 00:00 UTC (`CarrierRenewalDate`).
   `returnTargetUtc = boundary − BoundarySafetyHours − ReturnLeadHours`. In our records but absent from a COMPLETE
   successful list ⇒ `NeedsReview` + line disabled + alert. At the carrier but unknown to us ⇒ new asset
   `NeedsReview` (never offered, never returned). Clinket's own numbers (verification callers, messaging senders —
   `VoiceClinketNumbers` and the configured sender numbers) are never imported.
2. **Due work** — read records with `dueAt <= now`:
   - `Setup` stuck in `Applying` / `CheckingCarrier` ⇒ resume / reconcile (§6).
   - `ServiceEnd` due ⇒ removal (§9).
   - `Reserved` asset whose reservation lapsed with no purchase started ⇒ release.
   - `Returning` asset ⇒ confirm at the carrier.
   - Idle asset at its return target ⇒ step 3.
3. **Keep or return** (only when `AutomaticReturnEnabled`):
   - Never touched: `Assigned`, `Purchasing`, `Reserved`, `NeedsReview`, a number with a live call.
   - Admin-pinned (`keepForReuse`) ⇒ kept; counts toward the buffer.
   - Keep the best `IdleNumberBuffer` idle numbers, in this order: `Available` before `Quarantined`; rent within
     the cap; lower rent first; then `e164`. `ForwardingNotProvenOff` and above-cap numbers are never kept.
     General form (covers Plivo's per-number dates): return a number at its target unless fewer than the buffer
     of OTHER reusable idle numbers will still be paid for beyond its renewal.
   - Kept ⇒ `dueAt` moves to the next cycle's target. Returned ⇒ asset `Returning` (ETag) + `returnStartedAt`,
     then DELETE (Telnyx by number id, skipped with an alert when the deletion lock is on; Plivo by number), then
     confirm by a successful owned-number read ⇒ `Returned`, voiceline tombstoned, ttl set. Failure or no answer ⇒
     dedicated alert on the first failure, retry each hour, and if the boundary passes: "missed return" alert with
     the rent charged.
   - A number that becomes idle after its target has passed is due immediately.
4. **Daily** (the run at 03:00 UTC): compare yesterday's Telnyx charges (`charges_breakdown`) with what was
   quoted ⇒ mismatch alert. On the 1st: the monthly summary alert (bought, reused, kept and unused with its cost,
   returned, missed) with a deterministic id so it is raised once.
5. **Balance** — alert when the Telnyx available credit or the Plivo balance is below the rent falling due in the
   next 30 days.
6. **Heartbeat** — one stable log line per successful run; an Azure Monitor scheduled-query rule (the existing
   `analytics-alerts.json` pattern) alerts when none is seen for two hours.

India: buffer 0 ⇒ every idle number is returned before its own renewal. A buffer above 0 is honoured if the admin sets one.

Edge cases: fewer idle numbers than the buffer · admin lowers / raises the buffer late in the month · carrier
down for hours (24+ hourly attempts before the boundary) · DELETE answered but the number still listed · DELETE
timed out but the number is gone · deletion lock · renewal date moved earlier · partial carrier page (never
treated as absence) · two instances of the job (ETag on every claim) · the job did not run for a day (all overdue
work is picked up by the first run) · quarantine never blocks a return · a second environment sharing the carrier
account (its numbers are `NeedsReview` here and untouched).

## 11. Alerts and notices

**Admin alert types (new, each dedicated):** `VoiceForwardingChangeRequested`, `VoiceSpecificNumberRequested`,
`VoiceNumberSetupNeedsAdmin`, `VoiceNumberSelfServiceCompleted`, `VoiceNumberPurchaseWarning`,
`VoiceNumberPurchaseLimitReached`, `VoiceNumberReturnFailed`, `VoiceNumberReturnMissed`, `VoiceNumberNeedsReview`,
`VoiceNumberChargeMismatch`, `VoiceCarrierBalanceLow`, `VoiceNumberMonthlySummary`. Each must be added to both
admin apps' alert lists. Alerts use deterministic event ids so a retry does not duplicate.

**Provider notices (new types):** `VoiceForwardingChangeDeclined`, `VoiceForwardingNumberChanged`,
`VoiceNumberBeingArranged`, `VoiceNumberHeld`. Reused: `VoiceAssistantActivated`, `VoiceAssistantReadyToConnect`,
`VoiceAssistantNumberRemoved` (new reason value), the billing trial reminder / ended / recovered notices. Every new
type: routing catalog entry (business security), preference mapping, `SignalRSettings:EnabledNotificationTypes`,
deep link on provider web and app, strings in all language files, email template per language.
WhatsApp: the three Utility drafts in `NOTIFICATIONS.md` are NOT submitted; the registry entries ship with no
approved languages until the owner creates them at Meta.

## 12. Surfaces

| Surface | Work |
|---|---|
| API (`clinqetapi`) | Provider: choices, confirm number, request status, forwarding request / withdraw, specific-number request. Admin: request queue (open requests across businesses, paged), decide forwarding / specific, inventory list with filters, keep / resume, manual return (incident use), limits on the existing voice-config endpoints. Every provider mutation: `voice.number.manage` with live re-check. AppConfig: one boolean for self-service availability |
| Functions (`clinqetfuncations`) | Queue processor for `voice-number-operations`; the hourly lifecycle timer; carrier seam + coordinator registered here |
| Billing hooks (`clinqetinfrastructure`) | `CompleteAddOnDowngradeAsync` tail and `ApplyActivationTailAsync` call the coordinator; `Trial:AiReminderLeadDays`; reminder text gains the number sentence |
| Carrier adapters | Structured search results (price, currency, locality, type); lossless decimal parsing with an explicit "unknown"; Telnyx `customer_reference`, local-only, exclude-held, 400/10031; order lookup by reference; owned-number list with renewal facts; delete with confirmation; balance; Plivo compliance id; **the purchase POST leaves the automatic retry policy** |
| Admin web + admin app | Existing AI Assistant page/screen: Requests queue (no search needed), selected-business view (Forwarding change · Number · Activity), Numbers = carrier inventory with Keep and incident return, alert → request link, Voice Settings gains the three limits. Hardcoded English, as both admin apps are |
| Provider web + provider app | Number choice step, setup progress / arranging states, request-a-change dialog + pending / declined / applied, held / removed / recovered states. All strings in all five language files on both apps |
| Deployment (`azureautomation`) | Queue in `events.json` + the shared queue-name list; timer schedule + the two per-environment switches + per-stamp caps in `deploy.ps1` (create and update); the heartbeat alert rule; removal of the two retired keys |

Mockup: `Data\mockups\voice-number-lifecycle\index.html` stays the approved sheet, amended in text on these
points (no redraw): the "own number · reconnect needed" forwarding state is not built (own-number change stays
self-service); the trial timeline shows the removal time once the service has actually ended, and "one day after
your service ends" before that; the inventory explains the buffer; the admin Voice Settings page gains three
number inputs.

## 13. Existing defects fixed by this work

Unreadable price read as zero · dedicated-mode save accepts a changed target · binding check then overwrite with
no fence · purchase with no durable record and a retried POST · carrier release before the foreign-owner check ·
unreachable repair branch in change-number (replaced by request ids) · Plivo rate labelled INR · admin queue fed
only by one alert type · form effects that follow the profile phone.

## 14. What this supersedes

| Earlier statement | Now |
|---|---|
| Four document families incl. a business slot; operations kept per request | Three families; one live request per business per kind (§3) |
| Five index items | One path, `/dueAt` |
| Approval stored as a new undeletable alert type | Stored in the existing number audit |
| "Authoritative billing history" via a new field | Existing `BillingTransactions` (§3.7) |
| Zero setup-fee cap | US$1.00 on Telnyx |
| Automatic buying gated on a carrier price guarantee | Enabled on Telnyx with the §6 controls |
| India ₹200 / 20000 minor-unit cap; India self-service | India admin-led; cap in the carrier's quote unit |
| Return every idle number before renewal | Keep a buffer (10) on Telnyx, return the rest; India returns all |
| Own-number source change is admin-only (D6) | Self-service stays; admin-only applies to dedicated mode |
| Five-minute sweep plus an hourly return scan | One hourly job; the queue handles immediate work |
| Reminder at T−24h, removal at T+24h | Reminder at least a day before; hold = 24 h from the real service end (§9) |
| Inventory scope id as a new setting | The carrier name |
| Daily budget with reserved/confirmed count and spend | One daily counter, warning + stop levels, admin-adjustable |

## 15. Still open (none blocks the build)

- Carrier answers: `CARRIER-SUPPORT-QUESTIONS.md`. The owner is asking Telnyx about the buy-back fee.
- India compliance (one application per end customer) — India stays admin-led until Plivo answers.
- Meta approval of the three Utility templates.
- Trial length is a business choice with a cost: a Telnyx trial that crosses the 1st pays one more month ($1.00);
  an India trial longer than about 27 days pays a second ₹236 on a newly bought number.

## 16. Verify in code before building each area (not yet traced end to end)

The billing hooks, the single switch-off path, the settings document, alert de-duplication and the carrier
adapters were read in full on 1 October. Still to read fully at the start of the build: the Functions host
registrations and queue-name list; `VoiceOwnNumberService` disconnect proof fields; the live-call marker used for
drain; `BusinessCommunicationDispatcher` and the email/WhatsApp registries; `deploy.ps1` / `events.json`
conventions; the four UI code bases; every skill named in `IMPLEMENTATION-PROMPT.md`.
