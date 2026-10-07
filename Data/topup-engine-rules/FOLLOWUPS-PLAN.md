# Minute packs and billing follow-ups — PLAN (2026-09-25)

**Owner approval — 2026-09-25, in conversation:** "you have my approval … go for it and it's approved so I'll go with
your recommendation", with every gap found fixed end to end ("no separate thing"). The approved recommendations are:
item 4 option **A**; move the 8 dual-host top-up-order tests; fix the four request paths; the state sheet is approved;
and the full email-template translation pass. Schema changes still need the §0.7 table and an explicit yes — see
*Decisions still open*.

## The design — minutes stay right whatever fails

Everything in this programme follows three rules.

1. **The minute ledger (SQL) is the truth, and every write to it is safe to repeat.**
   - An *included-minute* row (grant or adjustment) is saved in the SAME `SaveChanges` as the holder change that implies
     it, such as a period advance, an activation or a tier switch. Both land or neither does. No retry can double it and
     no crash can lose it. The helper is `IncludedMinuteRows`, in infrastructure, next to the ledger.
   - A *pack* row (top-up, carry-over, conversion) needs the ledger's per-business lock and commit-ordered stamps, so it
     is written through `IMinuteLedgerService`. It is keyed so a repeat is a no-op, and it is written BEFORE the holder
     change it belongs to.
2. **The line's cap (Cosmos) is a projection of the ledger.** It is re-computed after every change. A retry that finds
   the change already committed re-computes it, and a daily check repairs any line whose month is settled.
3. **Every bookkeeping step after a charge is driven by the charge record** (`BillingTransaction`: the promo it carried,
   the minutes it bought). It is never re-guessed later. The promo commit reads the frozen code; top-up grants read the
   frozen minutes and engine.

A retried message or request whose change is already saved does no new money work. It re-runs only the idempotent tail:
cap, voice tier, entitlements and tier projection, and the notification. Notifications are de-duplicated end to end,
because the dispatcher's key is SHA-256(EventId|user|business) and the processors keep a delivery-idempotency store.

## Work list (all approved)

### A · Renewal and request paths (item 1 + the four request paths)
- **A1 · Add-on renewal and trial conversion** (`FinalizeAddOnRenewalAsync`): pack carry-over (keyed, locked) first, then
  one save holding the period advance plus the staged included grant or adjustment, then the tail.
- **A2 · A superseded or already-cancelled redelivery** re-runs the tail: cap, voice tier, promo from the charge record,
  and notification. The plan renewal's tail is tier projection, entitlements, AI included-minute reconcile and promo.
  After a downgrade it is promo deactivate, tier projection and cap 0.
- **A3 · The four request paths re-ordered onto rule 1:**
  - first AI purchase (grant is atomic with the activation)
  - paid or free upgrade (adjustment is atomic with the flip)
  - trial → paid (grant/adjustment is atomic with the activation, pack carry first)
  - eligible trial switch (adjustment is atomic with the switch)
  Their "already done" retries re-run the tail.
- **A4 · `ReconcileIncludedMinutesAsync`:** the adjustment is atomic with `IncludedMinutes`. It is applied only when this
  month's allowance already exists; otherwise only `IncludedMinutes` changes, and the coming grant uses it. This fixes
  the double delta when a plan tier changes before the AI renewal runs. It also covers Trialing holders.
- **A5 · Promo commit from the charge record** (closes F6 and the add-on replay using a different call than the plan
  replay). The success path and every replay/heal call the same method.
- **A6 · Plan renewal** (`ChargeSubscriptionAsync`) tail made re-runnable (A2).

### B · Auto-recharge and top-ups
- **B1 ·** Before buying, settle what was already bought: grant any succeeded auto-recharge charge this period that has
  no ledger row, then decide.
- **B2 ·** The decision cap is max(the line's cap, the ledger's cap). A granted but unprojected pack can never cause a
  second buy, and the month-start window can never cause a false buy. If the ledger is higher, the line is re-projected.
- **B3 ·** The monthly budget is derived from the charge records (succeeded plus in-flight auto-recharge charges this
  period, pre-tax list basis). It no longer relies on a counter that a crash can skip.
- **B4 ·** The reconciliation sweep also heals succeeded top-ups that have no gateway id (a code that made the pack free),
  by transaction id.
- **B5 ·** Buy order: charge → grant (keyed) → cap → notify, with the promo redeem from the charge record.

### C · A trial that crosses months (item 4, option A — one pool for the whole trial)
- **C1 ·** The ledger carries a Trialing holder's unused included minutes forward month by month, from the trial's grant
  month to now. The carry is forced whatever `RollOverIncludedMinutes` says; unused pack minutes follow the normal rule.
  Keys are `carryover_{biz}_{period}_…`, so the trial-end conversion, the sweep and projections all de-duplicate.
- **C2 ·** The conversion (scheduler or manual) in a later month forces the same carry before granting the paid month.
- **C3 ·** The "don't project outside the grant month" branches are deleted, and `ConvertLeftoverPackMinutesAsync`
  leaves the interface if nothing else needs it.
- **C4 · Daily minute check** in the billing scheduler. For every holder whose month is settled (Trialing; Active with
  this month's period; annual in-period) it re-projects the cap. This re-attaches trials at the month start and repairs
  any lost projection. PastDue holders are left on grace policy.

### D · Top-up availability (item 2)
- **D1 ·** One rule, `TopUpPackRules.Availability(holder, now)`: Available, SettlePaymentFirst, TrialEnding or
  NoAssistant. It is used by the purchase, India order and quote gates and by `/overview`, as the string-enum field
  `topUpAvailability`.
- **D2 ·** Web states per the approved sheet, plus the winding-down note ("usable until {date}"). The provider app mirrors
  them, information only. Copy is in 5 web and 5 app languages.

### E · Tests in the right suite (item 3 + findings)
- **E1 ·** The 15 auto-recharge/after-call tests and the 8 top-up-order tests move to
  `Clinqet.Communications.UnitTests/Services`, with identical assertions and the counts proven.
- **E2 ·** Re-verify the 2026-09-22 sweep's "trap 1" list (`SubscriptionBillingService`, `PromoSunsetService`,
  `TierLimitAlertService`, `NotificationRecipientResolver`) by real call sites. Move any whose only runtime host is
  Functions.

### F · Email templates and billing copy (item 5 + the wider damage)
- **F1 ·** The 38 broken links are restored to the English paths.
- **F2 ·** Every email template (106 per language, JSON and `.html`) is reviewed and corrected in fr, es, hi and gu
  against English: meaning, grammar, one register (fr vous · es tú · hi आप · gu તમે), spacing around tokens, and the
  glossary.
- **F3 ·** All billing and plan strings are reviewed and corrected: web `billing.*` plus every key the billing
  components use, the app's `PLAN_AND_BILLING.*` and plan-screen keys, and the server's billing notification, error,
  success and receipt keys.
- **F4 · Guards:**
  - every `{{AppBaseUrl}}` link equals an English link (requested)
  - the translated HTML carries the same tags and attributes as English
  - no `{{token}}` touches a letter unless English does
  - plan and engine names pinned to the glossary

## ‼️ LIVE CHECKLIST (2026-09-26 — the single list; tick here, never only in chat)

**Done and verified**
- [x] Item 1 renewal crash-safety — real-SQL crash test (3 crash points) green; FAILS on the old save order (sabotage run in the isolated copy)
- [x] Item 2 top-up visibility — server + web + app; web 12 new tests + full web suite 4,581/4,581; app 16 new tests + full app suite 5,568/5,568; my files lint-clean
- [x] Item 3 test moves — unit 23 tests + integration 27 tests (22 + PromoSunset 5), bodies proven identical; all green in the Functions suites
- [x] Item 4 trial pool — 4 real-SQL tests green
- [x] Item 5 email links — 424 templates rewritten; convention test (links · markup · page language · glue) green, and it FAILS on the originals (finds exactly the 38 broken links)
- [x] Decision 1 — column dropped (migration, entity, test seeds, real-SQL schema test)
- [x] Every email page declares its language (52 pages × 5 languages)
- [x] Provider app: 8 suites broken by commit `cc3821d0` fixed
- [x] Suites: API unit 14,037/14,037 · Functions unit 6,674/6,674 · Functions integration all ours green · API integration all ours green

**Pending — ours, all of it**
- [x] G1 refusals while overdue — code done, compiles (AI purchase + annual switch · AI engine change · plan subscribe + annual switch · plan tier change · quotes return nothing · packs `SettlePaymentFirst` · auto-recharge runs for Active only). `Error_PastDue` reworded ×5 ("Pay it first"), es now *tú*. Tests: G7
- [x] G2 Pay now — code done, compiles: `POST provider/billing/pay-overdue` → `RetryOverduePaymentAsync` (same charge key as the scheduled retry; a card decline never duns). Automatic retry: card confirm / set default / remove-that-promotes (API) and mandate activation (webhook) queue `SubscriptionChargeMessage.RetryWithPaymentMethodId` (`IOverduePaymentRetryScheduler`, message id `overdue_{holder}_{method}`); the engine tries it only while that method is still the default, and a card refusal sends the provider a payment-failed notice keyed on the method. 6 new keys ×5. Tests: G7
- [x] G3 minutes follow payment — code done (carry at dunning, heal, daily check incl. overdue; overdue cap = packs + a paid month's rollover)
- [x] G4 settling payment counts as paid — code done (provisional cap = paid-for + the month's allowance while a renewal charge is Pending/Processing; `SettledTransactionId` fast path for success and rejection; trial async rejection duns once; reconciliation polls pending renewals after `AsyncSettlementPollAfterHours` and hands the answer back; `RenewalPendingLongLived` admin alert after `RenewalPendingAlertAfterHours`)
- [x] G5 words ×5 languages — done: the payment-failed notice is now two (`SubscriptionPaymentFailed_Ai` "your AI Assistant is paused · calls still reach you · Pay now", `SubscriptionPaymentFailed_Plan` "your plan stays on"), both naming the next try; email templates ×5 each (old shared template deleted); web: Pay now (green) + Update card on the AI card, attention strip, plan card and minute-pack slot, "Trying your payment…", bank-processing state (blue), next try + last-try warning, plans grid "pay first" while the plan is overdue, "card saved — trying your payment" + one follow-up refresh; server sentences for make-default/remove when a retry was queued; app: plan-card overdue/processing line + server sentence on card changes (info-only, no Pay now); 14 web keys + 7 app keys + 10 backend keys ×5; state sheet frames 10–18 (register row: NOT yet seen by the owner)
- [x] G6/G7 tests — **all suites green 2026-09-26**: API unit 14,096/14,096 · Functions unit 6,762/6,762 · API integration 2,347 + 6 designed skips (live search service) · Functions integration 720/720 · web 4,604/4,604 (332 suites) · app 5,586/5,586 (368 suites) · admin alerts 44/44 · web ESLint 0 errors (13 warnings, none ours) · app ESLint 0 errors on our files. The real-SQL `SubscriptionBillingRenewalIntegrationTests` still pinned the forever AutoPay deferral (2 tests) — rewritten as one theory: overdue on the first pass, no attempt burned, redeliveries change nothing, Free after the grace. fr-CA `billing.overdue.cardSavedRetrying` had a space before `;` (the Québec guard caught it) — fixed. `SubscriptionService`: the annual-switch `past_due` check and its quote twin became unreachable behind the G1 refusal — removed. New: `SubscriptionBillingOverdueTests` (21), `RecurringSettlementPublisherTests`, webhook (settlement hand-back ×4, mandate → retry ×4), `ProviderBillingPayOverdueTests` (23), `OverduePaymentRetrySchedulerTests` (5), reconciliation (6), ops alert (3), ledger cap rules (5), refusals (AI 5, plan 5), notices (3); real-SQL `OverdueSettleFirstIntegrationTests` (7: race both orders, declined Pay now then a real retry, settling→refused, settling→confirmed, carry at failure, AutoPay grace) + `PaymentWebhookMandateRaceIntegrationTests` (2); web jest 20 new; app jest 17 new. Tests that pinned the reversed rules updated, not deleted: §2.5 tier change while overdue ×2, the forever mandate deferral ×3
- [x] H-new (found 2026-09-26, fixed in code, compiles): an India renewal whose AutoPay could not be debited (pending, paused, below the charge) was deferred **forever** without dunning while the line kept the old month's cap — free minutes and a free plan tier with no end. Now `AwaitMandateAsync`: overdue from day one (G1–G3 apply), no attempt burned, notice once per step, switched off at the first try after the grace ends. Tests: G7 — verified: tests green (unit + real SQL)
- [x] H-new (found 2026-09-26, fixed in code, compiles): the create-on-activate race (in-app confirm won the insert) left the business with NO default method — the defaults had been cleared first. Now the race branch applies the activation's promotion rule, else restores the newest chargeable default. Tests: G7 — verified: tests green
- [x] H-new (found 2026-09-26): fr `Success_BillingTopUpCompleted` = "Procès-verbal ajouté." ("meeting minutes added") — goes into F3 — FIXED by the fr worker ("Minutes ajoutées.")
- [x] H-new (found + fixed 2026-09-26): an India charge the bank answered kept `FailureCode = "pending"` (the async marker) — admin views showed "pending" on Failed/Succeeded rows, and the reconciliation's `??=` never recorded the bank's reason. The marker is retired on any final answer (webhook by intent and by charge id, reconciliation); tests
- [x] H-new (found + fixed 2026-09-26): web `showInfo({ message })` passed an object to a toast that renders its argument — React crash when a trialing annual holder taps "end trial and pay" where annual billing is off. Now the string
- [x] H web key warnings — the last two traced and fixed: `EngineSwitchDetails` (`MinutesOnEngine` spans + the NeedsConsent `<strong>`); the remaining un-keyed date/tier values in `Billing.jsx` keyed too
- [x] H-new (found 2026-09-26 in the full API unit runs): **load-flaky tests** — green alone, red under the full suite. Each is fixed by removing the race, never by widening a clock: — all fixed, plus `MessageControllerTests.SendMessage_WhenModerationFlags_PersistsAndFlags` (5 s wait on a gate ⇒ 30 s named ceiling). Not changed (never failed, other features): the 3–5 s gate waits in `IntegrationHealthAlertsTests`, `CommunicationDispatcherChannelFailureAlertTests`, `WhatsAppSendGateTests`, `AzureSearchQueryCriticalPathTests`, `BusinessSearchAgentTests` — first candidates if a load flake appears
  - [x] `NotificationMonitoringControllerTests` ×2 — the self-hosted connection count was a `static` on the hub that `NotificationHubTests` pushed below zero in parallel (their reflection "reset" only covered their own class). The count now lives in the `NotificationHubConnectionCounter` singleton that the hub and the monitoring controller inject; exact counts asserted; 3 counting tests replace `GetConnectionCount_ReturnsValue`
  - [x] `AzureSearchQueryCriticalPathTests.CallerCancel_DuringEmbedding_PropagatesOce` — its 100 ms `CancelAfter` lost to the 5 s embedding-budget timer on a starved runner (probe: budget first ⇒ the search degrades and returns normally). Now the caller cancels INSIDE the embedding call, like its expansion sibling; the sabotage (caller-cancel catch removed) fails it; 3 clean full runs green
  - [x] `AnalyticsControllerTests.TrackEvents_NoticeBasedCountry_ConsentDenied_KeepsIdentifiedPayload` · `SearchControllerTests.SearchProviders_FiresAnalytics_OnEmptyQueryPath` · `SearchControllerAdditionalTests.SearchServices_RecommendationBranch_FiresAnalyticsCaptureWithRecommendationMode` — background analytics verified after a 2 s poll that then fell through silently. The three waits now follow the house rule (`WaitUntilAsync` in the alphabet and knowledge suites): return the moment the call lands, 30 s ceiling that only names a hang, named failure
  - [x] `QueryUnderstandingServiceTests.ProcessQueryAsync_PipelineCrash_DegradesToOriginal_AndDispatchesAdminAlert` — the same 2 s poll on the fire-and-forget admin alert; same house-rule wait
  - [x] `BusinessAlphabetServiceTests.AnUnchangedRegistry_KeepsTheSet_AndAsksTheIndexNothingMore` (expected 3, got 2) · `BusinessAlphabetServiceTests.Invalidate_DropsTheEntrySoTheNextAskSeesNewContent` — the fixture default budget (15 s) still lapsed on a starved runner; the next ask then JOINED the running lookup, so a registry read went missing. Default budget now out of reach (the single-flight test already was); `ASlowLookup_…` (the budget is its subject) keeps a gate and now has a 30 s detached ceiling instead of 15 s. No other session had these files open
  - Result: API unit 14,096/14,096 in 3 consecutive full runs
  - ‼️ Method trap met on the way: a sabotage "restored" with robocopy keeps the ORIGINAL's older timestamp, so MSBuild keeps the sabotaged DLL and the next runs test the sabotage. Touch the restored file (or rebuild) before trusting any run after a restore
- [x] **H-sec (found 2026-09-26 while fixing the MFA key; all verified by reading the code — Identity host)**: — all fixed and verified (see sub-items)
  - [x] (fixed; controller test pins a configured 3) MFA lock email/admin alert say "after 5 attempts" whatever is configured: `AuthController` reads `Security:MfaLockout:MaxAttempts`, the service enforces `MaxFailedAttempts` ⇒ use the `MfaLockoutStatus` the service returned
  - [x] (fixed: `MfaLockoutStatus.LockoutStarted`, set only for the wrong code that started it; controller + real-host integration test: 6 wrong codes ⇒ 400×4, 429×2, exactly ONE email, ONE alert, ONE notice) **Every wrong attempt DURING a lockout re-sent the lock email, the in-app notice and the admin alert** (`VerifyMfaAndGenerateTokenAsync` returns the locked status before verifying, and the controller notifies on any locked status) ⇒ email bombing of the account owner + an admin-alert flood + ACS cost. Notify once, when the lockout starts
  - [x] (fixed: `IMfaLockoutService.ReserveAttemptAsync` counts the attempt BEFORE the code check under one lock; immutable records; `RecordFailedAttemptAsync` deleted; expired-record removals conditional; a 50-request parallel burst gets exactly 5 tries and one lockout start) **MFA login lockout was check-then-verify** (TOCTOU): parallel requests all pass the "locked?" check before any failure is recorded, so a burst gets more than `MaxFailedAttempts` guesses; the record is also mutated in place inside `AddOrUpdate` (`existing.FailedAttempts++`, a lost update under contention). Reserve the attempt atomically BEFORE verifying; reset on success
  - [x] (fixed: `RateLimiting:AccountCodes` per IP AND per account, window 15 min, send 10/IP 5/account, verify 20/IP 5/account; account = normalised email/phone, same answer whether the account exists) **`password/reset/verification` (anonymous) had no attempt limit and no rate limit in code** — a 6-digit code guessed without limit is an account takeover; only the WAF's 100 req/min per IP stands in the way, which a distributed attacker does not meet. Per-target + per-IP limits like `login/email/verification`
  - [x] (fixed, same limits) **Unthrottled anonymous code SENDS**: `password/reset/request`, `register/verification/resend`, `login/verification/resend` — email/SMS on demand (SMS pumping cost, inbox flooding). Per-target + per-IP limits like `login/phone`
  - [x] (fixed, same limits; also `phone/change` + `email/change` sends) `register/verification` (anonymous) and `phone/change/verification` · `email/change/verification` (signed in) verified codes with no limit — same pattern
  - [x] (removed with their 12 test-mock lines) Orphan settings: `Identity:RateLimiting:Login:{MaxAttemptsPerMinute,BlockDurationMinutes}` and `Identity:RateLimiting:Registration:MaxAttemptsPerHour` were read by NO code
  - Verified: Identity unit 1,132/1,132 · Identity integration 481/481 (incl. the strengthened MFA test and two real-host reset-limit tests: six guesses/sends for one account from six different IPs ⇒ the sixth is refused) · sabotage (notify on every blocked attempt · limits never refuse · a refused reservation ignored) fails all 7 guards
  - Client audit (5 apps × 9 endpoints): every live call site shows the server's 429 sentence exactly like today's rate-limited login codes (admin calls none of them). The audit found three PRE-EXISTING client defects, all fixed:
    - [x] **Customer web: email and phone change verification posted to `auth/{email,Phone}/change/verify` — routes that do not exist since 2025-05-02** (renamed `/verification`) ⇒ every contact change on the customer web failed with "OTP verification failed". Fixed in `services/authServices.js`; test `authServices.contactChange.test.js`. (The app's `url.js` already had the right paths, unused.)
    - [x] **Provider app: a refused email-change resend** wrote its sentence to the closed address screen (nobody saw it) and still spent a resend + restarted the countdown. Now shown in the code screen and not spent
    - [x] **Provider app: phone-change resend sent `phoneNumber`** where the server binds `NewPhoneNumber` ⇒ every phone resend was refused (and spent). Now the same body as the first send; refusal not spent
    - Tests: `__tests__/contactChangeResend.test.tsx` (4) — the two refusal cases FAIL on HEAD's screens (checked with a scratch snapshot, no git restore); lint clean on our lines
    - Not changed (UX, not a defect): both web apps reset their resend countdown after ANY failed resend, so a 429 lets the button be clicked again at once — the server keeps refusing with its sentence
  - Note for the owner (NOT a defect today): Identity keys its per-IP limits on the FIRST `X-Client-IP` value — safe because Front Door OVERWRITES that header on the identity route (`ClientInfoHeaders`, networking.json); the main API reads the LAST value (`GetRateLimitClientIp`) as defence in depth. Aligning Identity is optional hardening. The per-account limits do not depend on the IP at all
  - Design notes: reuse `CheckOtpRateLimitInternal` + the `Error_TooManyRequests` 429 shape; the target key is the supplied email/phone (normalised) so a limit never reveals whether an account exists; every client (web ×3, app ×2) must show the server's sentence on 429 for these flows — check before shipping. The lockout store is per instance (in memory) — a scale-out makes it per instance; record for the owner, do not change the store without an infra decision
  - ⏸ **DEFERRED by the owner (2026-09-26: "ignore for now … we need to do it later")**: the MFA lockout (`MfaLockoutService._attemptRecords`) and Identity's code rate limits (`AuthController._otpRateLimitTracker`) live in each instance's memory. With N instances an attacker gets up to N× the tries, and a restart clears every count. Later fix: one shared store with an atomic increment, keyed exactly as today, after an infra decision. Both sites carry a one-line code note that points here
- [x] Unit tests owed for items 1/4 — **all written and green 2026-09-26**, each proven by a sabotage in the isolated copy that fails exactly its own test (restored + touched + rebuilt green after):
  - finalize atomicity → the real-SQL crash test (3 crash points); trial conversion same month → `ProcessCharge_TrialAddOnEnded_SameMonthAsTrialStart_…`, later month → real-SQL `Trial_ConvertsInALaterMonth_…`
  - `SubscriptionBillingRedeliveryTests` (Functions, 9): AI renewal already saved re-runs only its tail (promo from the charge row, cap, engine, receipt under the charge id; no charge, no second minutes) · superseded by a later period does nothing · overdue redelivery re-sends THAT step's notice (alert type from the card on file) and carries the packs · each dunning step has its own notice id and charge key (`…:payment-failed:1`, the redelivery before the retry repeats `:1`, then `:2`) · the final step's switch-off is saved and announced before its tail, and a tail cut short is finished by the redelivery with no second notice · the replay path caches the NEW engine's price and minutes after a boundary engine change · plan renewal already saved re-runs its tail · plan overdue redelivery re-sends that step's notice only
  - `SubscriptionBillingMinuteCheckTests` (Functions, 3): exactly the settled lines are projected (trial, overdue, this month's period, annual with this month's grant, renewal Pending/Processing) and none of: a carry row only, renewal due, renewal refused, Canceled/Expired/Free · paging reaches every holder once · one failing line never stops the others
  - annual tick ignores carry rows (theory ×2) · Canceled heal plan + AI (theory ×2)
  - `GrantTopUpFromTransactionAsync` (Functions, 5): a free pack with no gateway order is granted by its id, promo redeemed, one notice · already granted ⇒ nothing · blank/unknown/non-top-up id ⇒ nothing
  - B4 reconciliation heal by tx id (API `PaymentReconciliationServiceTests`, beside the other heal tests — the API host runs `ReconcileAsync` from the admin trigger)
  - click-period promo (API `AiAddOnServiceTests`): finishing an earlier month's paid switch commits the promo to THAT month, activates what was paid (engine, minutes, pre-tax price), never charges
  - IncludedMinuteRows · TrialConversionKey · auto-recharge B1–B3 · receipt localization (hi) — done earlier the same day
- [x] Owner-reported failing API unit tests (2026-09-26) — both pass on the current tree (the pricing one through the model-settings session's own `AIServiceSettings.cs` change, which we did not touch; the carry key is ours): `AiTokenPricingConventionTests.TokenPricing_InAppSettings_MirrorsTheClassDefaults_BothWays` (appsettings has `gpt-5.4-mini` where the class default is `gpt-5.6-luna` — find the real mismatch, fix the config, not the test) · `MinuteLedgerServiceTests.CarryTrialForward_CarriesWhatIsLeft_MonthByMonth_Once` (ours: the trial pool's carry key is now `_trial` by design — update it and every sibling asserting `_included` for a trial carry)
- [x] H-new MONEY (found + fixed 2026-09-26): **the India pre-debit notice (RBI) stated ~10× the debit for a yearly AI line** — it annualised the cached price, which already IS the year's price. It also ignored a price rise landing before the debit, a scheduled downgrade, a discount and tax, and went to plans grandfathered past the debit. Now it states exactly what the renewal will take (`AddOnRenewalDebitAsync` / `PlanRenewalDebitAsync`: the engine or plan it lands on, the price in force at the charge date, interval, discount, then tax — `SubscriptionBillingService` takes `ITaxCalculationService` + `ITaxJurisdictionResolver`; 13 construction sites updated); nothing to debit ⇒ no notice and the date stays open. Tests: 10 unit + real-SQL `SubscriptionBillingDebitReminderIntegrationTests`; two sabotage rounds fail exactly their targets
- [x] H "per month" for yearly holders — FIXED: the six producers (trial started ×2, price change ×2 API + scheduler, trial reminder) send `Fields["interval"]`; `BillingNotificationService` renders it per reader (`Billing_PricePeriod_Month/_Year` ×5) as `{{PricePeriod}}`; 3 templates ×5 languages. Tests: producers (plan + AI, month + year) and the rendering theory. Note: the WhatsApp template `clinket_plan_renewal_reminder` wording lives at Meta — if it says "per month", only a new Meta template fixes it
- [x] H English-template bugs with sender data — FIXED (code + 5 languages, tests):
  - booking: "48 hours" hard-coded ⇒ the confirmation request states `{{ConfirmationHours}}` (the setting) and its WhatsApp expiry counts from when the request was SENT (was booking creation — wrong after a reschedule); the timeout emails are party-neutral ("not confirmed in time") and the provider's advice line is a `{{PartyNote}}` chosen by who timed out (a customer-party timeout no longer tells the provider to confirm faster); in-app/SMS/cancellation reasons ×5 reworded (es to *tú*)
  - quote requests: providers now get `BroadcastExpiredProvider` (+ in-app `Notification_BroadcastExpired_Provider_*`), customers `BroadcastCancelledCustomer` — each audience reads its own words; a provider whose profile has no email address of its own no longer gets an email with EMPTY data (every member receives it at theirs); expiry reminder English plural-safe; in-app reminder fixed in all 5 ("dans les heures 24", "en horas 24" were wrong)
  - digest: one `{{Summary}}` sentence (singular for 1, "or more" when capped) in email + SMS ×5; `NotificationDigest_BodyOne` ×5 (WhatsApp digest template is Meta-held — count wording unchanged there)
  - message email: `{{Greeting}}` line — never "Hi ," (`DirectMessage_GreetingNamed/_Anonymous` ×5)
  - invoice: total no longer prints the currency twice ("USD $1,234.00"); a dead per-email currency lookup removed
  - bid-updated email: amount order matches the other bid emails
  - billing greeting fallback was "Bonjour là," / "Hola, allí:" ⇒ a team greeting ×4
  - NOT defects (kept, reasons): Sunset* name "Premium Max" — the code grants exactly PremiumMax; the name is the glossary's in every language
  - Remaining "48 hours" strings (`Notification_BookingAwaitingConfirmation_*`, `BookingRequest_Provider_Message`, `Push_ProviderConfirmationRequest_Body`, …) have no code reader that a search can find ⇒ dead-key candidates for the decision-5 key sweep; the window is 48 in every config today
- [x] Section H: re-translation ×4 of every English template changed after the first pass + the backend string list + F3 (backend `Billing_*`…, web `billing.*`, app `PLAN_AND_BILLING`) — DONE by 4 language workers (every changed template, the server string list, F3 on server/web/app: 58–69 server, 136–296 web, 31–63 app values per language). English fixed from their findings: two broken web sentences, auto-recharge "add … to your saved card" ⇒ "charge", the auto-recharge notice vs its email, the lockout "in about a short while", web ICU plurals for months/years (×5 languages; the parity test enforces the placeholder type); source defaultMessages realigned (integrity test) · F4 glossary pins: backend `BillingGlossaryPinTests`, web `billingNamesGlossary.test.js`, app `billingNamesGlossary.test.ts` (found "Prime"/"prima" = *bonus* for Premium and "Norme" for Standard on the web and app screens) · `HasPendingModelChanges` guard (done) · AdminAlertType ↔ admin alerts page parity guard (done)
- [x] Skill ×4 (DONE: `clinqet-payments` *Overdue payments — settle first* + four superseded statements marked; `clinqet-partner-app` + `clinqet-provider-mobile` pointers; all ×4 identical) · memory · this plan — five skills updated ×4 on 2026-09-26 (payments, booking-lifecycle, quote-lead-broadcast, notifications, messaging); memory updated
- [ ] Cleanup: scratchpad, the `R:` mapping and its copy
- [x] Commits: one per repo, only our files and hunks, `git rev-list --merges origin/master..HEAD` empty (owner pushes and deploys) — DONE 2026-09-26: core c08b848 · shared 1da8388 · identity f80d736 · cosmosindexsetup 8d5ffb9 · webuser 7a2ebe7 · admin cc40eb3 · webpartner 0581a1d8 · mobile partner f0586a4b · functions fac10fe · infrastructure 3889372 · api 505ac01 (rebased onto origin 660e759; the MinuteLedgerServiceTests conflict resolved to origin's assertion + our tests; the knowledge session's unpushed commit replays unchanged as 9fba705). Every repo: no merges since origin, graph linear, tree clean. Final suites: API unit 14,143 · API integration 2,347 + 6 designed skips · Functions unit 6,864 · Functions integration 723 · Identity unit 1,132 · Identity integration 481 · cosmosindexsetup 240 · web 4,609 · app 5,595 · customer web 1,818 · admin 406; ESLint 0 errors

**Other sessions — tell them (not ours to edit)**
- API integration `BusinessSearchKnowledgeIsolationIntegrationTests`: 3 failing on the latest tree (their uncommitted business-search work)
- Provider-app commit `cc3821d0` (author Jagrut R, 2026-09-25) broke 8 suites — fixed here; they should know the mock pattern

## ‼️ Owner decisions — 2026-09-26 (all six recommendations APPROVED — never re-litigate, never drop one)

The owner, in conversation: *"for all those #1 to #6 follow your recommendation and our solution is fully fully best
practise and not the workaround and not the shortcut and not the temp workaround … it need to be fully solid solution and
it need to handle all and every edge case scenario as well so quality over speed"* and *"mark it down … so you never miss
it or forget it … then again I will ask to check it again"*. Item 1 separately: *"do it if this is best practise … then
we should do it at all fully"*.

| # | Decision | Status |
|---|---|---|
| 1 | **Drop `ProviderAddOn.AutoRechargeSpentThisPeriodMinor`** (nothing reads or writes it since B3; its comment still claimed to be the loop guard) | **Done 2026-09-26:** migration `20260926053953_RemoveAutoRechargeSpentThisPeriodMinor` (DropColumn, reversible), entity + comment, the two test seeds, real-SQL `Migration_TheRetiredAutoRechargeSpendColumn_IsGone` |
| 2+3 | **Overdue payments — settle first** (section G): one "Pay now" that retries THE overdue payment, automatic retry on a card change, nothing new bought while overdue, minutes follow payment, packs carried and usable, a bank payment still settling counts as paid until rejected. **Reverses the 2026-07 §2.5 ruling** that let an overdue holder change tier. | **Build now, end to end** (G1–G7) |
| 4 | **Notification outbox** (transactional outbox, the industry standard) | **‼️ PARKED by the owner 2026-09-27** — *"we'll ignore it we'll not do this time and I'll park it for the future"*. NOT built, NOT to be started. The loss it would have fixed stays open and is stated in §K0 so nobody re-discovers it as new |
| 5 | **Translation pass outside billing** (web fr-CA mistranslations; Spanish tú/usted mixed on older screens — the glossary already rules fr *vous* / es *tú* / hi *आप* / gu *તમે*) | **Separate dedicated programme** after this one, per language, checker + native review; section H's out-of-scope items are its starting list |
| 6 | **Receipt PDFs** | English-only is no longer the recommendation for Canada: plan **French/English receipts for Canada as the next legally reviewed step** (Quebec's language law is understood to require invoices and receipts in French — legal to confirm). US/India stay English. Receipt EMAILS are already in the recipient's language |

## G · Overdue payments — settle first (decisions 2 + 3, APPROVED 2026-09-26)

**The rule:** an overdue bill is settled by paying THAT bill; nothing else is bought for that product until it is.
"Overdue" = a live holder whose period renewal (or trial conversion) was declined — `PastDue` with `FailedChargeCount > 0`.

- **G1 · Refuse new paid actions while overdue**, server-side (the UI hides them too), code `payment_overdue`, localized ×5:
  AI purchase/re-purchase (closes the double charge — today an overdue holder falls through to a fresh
  `addonpurchase_…` charge beside the dunning retry's `addon_{id}_{period}_a{n}`), AI engine change, plan tier change,
  immediate annual switch (plan + AI), packs (already `SettlePaymentFirst`), auto-recharge buys. Turning auto-renewal
  off stays allowed (it ends the product; nothing is bought).
- **G2 · "Pay now"** retries THE overdue renewal immediately, through the normal renewal path and the same charge-key
  family, enqueued for the Functions host that owns renewals (no second owner of the charge). Triggered by the button AND
  automatically when a new default card or an active India mandate is confirmed. A declined manual attempt shows the
  bank's reason and neither shortens the grace nor moves the scheduled retries. Pay now racing a scheduled retry ⇒ one
  charge (same key).
- **G3 · Minutes follow payment.** At the failed renewal the prior month's pack minutes are carried into the new month
  (keyed), and the line is re-projected: while overdue the cap counts **pack minutes only** — never the unpaid month's
  included minutes, never a failed conversion's leftover trial minutes. On success the month's minutes land in the same
  save as the period advance (A1) and the line is re-projected. No packs ⇒ the AI steps aside; calls still ring through.
- **G4 · A bank payment still settling** (Pending/Processing renewal, India UPI/e-mandate) counts as paid: the period
  advances and the month's minutes land, keyed on that charge. If the bank later rejects it, the grant is reversed
  (keyed reversal adjustment, never twice), the holder becomes overdue and G1–G3 apply from that moment.
  **As built (2026-09-26) — same promise, safer mechanism:** nothing is granted before the money is final. While the
  charge is with the bank the line's cap counts the month's allowance as paid (provisional cap), so the provider can
  use it; the period advances and the minutes are staged the moment the bank confirms. A rejection therefore needs no
  reversal row at all — the cap simply stops counting the unpaid month and dunning starts.
- **G2 as built (2026-09-26):** Pay now runs in the API, not through the queue, because G2 requires the bank's reason
  on screen — only an inline try can return it. It is the same engine code on the same charge key, so a Pay now racing
  the scheduled retry is still one charge (the charge service re-arms a declined key and serialises re-arms). The
  automatic retries (card change, mandate activation) DO go through the queue: nobody is waiting on them, and a
  webhook must never depend on a charge. **India lane:** the bank answers a day or two later, so a Pay now there is the
  next scheduled try brought forward — if the bank later refuses it, the usual next dunning step follows (a card
  decline, answered at once, never counts). The grace end never moves in either lane.
- **G5 · Words:** the payment-failed notice (email, push, in-app) says the AI Assistant is paused, calls still reach them,
  and Pay now; the billing page (web + provider app) shows the overdue state with Pay now / Update card and a
  "trying your payment" state. 5 languages; the state sheet gains these states.
- **G6 · Edge cases that must hold:** Pay now vs scheduled retry at the same moment (one charge) · Pay now declined
  (reason shown, grace unchanged) · card removed/expired (Pay now asks for a card first) · India AutoPay inactive (set it
  up first) · settling then rejected (G4 reversal) · failed trial conversion (trial minutes don't count while overdue) ·
  annual renewal failure (same rule) · final retry fails (AI switches off as today) · plan overdue (same settle-first;
  same-tier re-subscribe is already a no-op) · overdue across a month boundary · a redelivered failure never double-carries.
- **G7 · Tests:** unit (refusals, Pay now paths, cap rule, reversal) + real-SQL integration (the race, settling-then-
  rejected, the carry at failure, packs-only cap while overdue).

## H · Found while working (to fix in this programme unless marked for decision 5)
- **Code:** `AuthController.cs:1045` reads `Security:MfaLockout:MaxAttempts`, the service binds `MaxFailedAttempts` ⇒
  the lock email always says 5 (**FIXED** — see H-sec) · `AutoRechargeEngineNotice` EventId uses `UtcTicks` (**CLOSED — not a
  defect, verified 2026-09-26:** the notice is sent only by the pass that switches auto-recharge off, which saves the switch-off
  in the same write; a repeat pass finds it off and sends nothing, so no duplicate can happen; the ticks are the persisted
  change instant, and a fixed key would wrongly suppress a real repeat A→B→A→B switch-off) · English
  `MfaEnabled` says "sent to your phone" though the default is email (**FIXED ×5 languages:** `{{CodeDelivery}}` =
  `Email_MfaEnabled_CodeByEmail` / `_CodeBySms` from the account's `MfaType`; Identity unit theory ×3; the method's
  interpolated log lines made structured and no longer log the email address).
- **English templates:** buttons to a bare `{{AppBaseUrl}}` (BillingReceipt, MinutesLow, MinutesExhausted,
  AiAddOnActivated, MinuteTopUpPurchased, RefundProcessed, SubscriptionCharged) · hardcoded support@clinket.com and
  +1-800-1111-111 (FriendlyName*, Passkey*) · "48 hours" hardcoded vs `Booking:ProviderConfirmationTimeoutHours` ·
  singulars wrong for 1 (RemainingHours, BidsReceived, Count, Minutes, Days) · "Didn't login" · "Location:" shows the
  IP · AutoRechargePackUnavailable contradicts itself · BroadcastExpired/Cancelled speak to the wrong audience ·
  InvoiceEmail currency order · DirectMessage "Hi ," · SubscriptionCharged "Plan:" for the AI Assistant · "per month"
  for annual holders · British spellings · Sunset* hardcode "Premium Max" · SubscriptionDowngraded_Plan "premium
  features" · ProviderDebtCreated internal wording · plain text drops button labels · digest has no capped wording ·
  ~~no `<html lang>`~~ (fixed 2026-09-26: every page in all 5 languages declares its language; guarded).
- **Backend strings:** `Error_TooManyRequests` es "Inténtelo" (usted — now shown on nine more auth endpoints) · `Email_RequestLabel_Lead` es "liderar" / fr "conduire" · es usted in QuoteRequest/BroadcastMessage
  subjects · gu ક્વોટ/કોટ subjects · hi QuoteRequest postposition · `Lockout_*` in es/fr/gu/hi · hi "ऑटो-रिन्यूअल" /
  "AI Assistant" / "कार्ड के पीछे वाले बैंक" · gu digest count-of-1 · es NoShowClaimReminder in-app ·
  `Billing_ProductLabel_*` es/fr vs glossary · cross-file consistency per language (hi अधिसूचना vs सूचना).
- **Decision 5 (separate pass):** web fr-CA platform-wide mistranslations; Spanish register on non-billing screens.
- **Guard gap:** no test compares the EF model with the migrations snapshot (`HasPendingModelChanges`).
- **Existing bug found 2026-09-26 (not caused here):** the async-settlement "fast path" is a no-op. A pending India
  renewal defers `NextChargeAt` by a day, so the webhook's re-enqueued message hits the stale-due guard and the period
  finalizes only at the next day's sweep (and an async decline waits a day to reach dunning). Fixed under G4.
- ~~Provider-app suites broken by commit `cc3821d0`~~ **FIXED 2026-09-26** (owner: "we will not leave anything
  behind"): `ProductProvider` now imports `tokenManager`, which loads `src/Locales/i18n.ts`, so every component using
  `useProductName` reaches `i18next.use(initReactI18next)`. The 8 suites whose `react-i18next` mock lacked
  `initReactI18next` (fabRailSymmetry, fabSideRails, fabResponsiveLayout, workspaceStateExits, reinstatedAccessRecovers,
  memberDetailActions, assistantTabRootBackControl, callFollowUpsScreenFilters) now carry it — the repo's established
  pattern (invoiceDetailResendButton, forgotPasswordRequestFailure). Full app suite 367/367, 5,568/5,568.
- **Re-check before closing (other sessions' uncommitted, in-progress work — not ours to edit):** API integration
  `BusinessSearchKnowledgeIsolationIntegrationTests` (3 failing 2026-09-26 against the business-search changes another
  session has open); Functions integration `KnowledgeOcrPageCacheIntegrationTests` (model-name change, already
  consistent in `C:\Nik` at the next sync). Report their state in the close-out.
- **Code hygiene:** `Billing.jsx` passes `<FormattedDate/>` elements into `FormattedMessage` values without a `key` (8
  sites) ⇒ a dev-only React key warning.

## I · Follow-up programmes (approved to run after this one)
- **I1 · Notification outbox** (decision 4) — design + §0.7 table first.
- **I2 · Translation pass outside billing** (decision 5).
- **I3 · French/English receipts for Canada** (decision 6) — legal review of the PDF wording first.

## J · ‼️ LIVE CHECKLIST — owner's batch of 2026-09-26 (evening). Tick here, never only in chat

Owner, verbatim essence: MFA per-instance → note in code for later · Client IP → fix properly, industry standard, every
scenario · WhatsApp → names + wording + where the issue is (owner fixes in a separate session) · refund email →
recommend, owner approves · outbox → explain simply + recommend, owner approves · translation → fix properly ·
Canada French/English receipts → build now, no legal review · "make sure not to miss any with proper planning".

**J1 · MFA / code limits held per instance**
- [x] One-line note at both stores (`MfaLockoutService._attemptRecords`, `AuthController._otpRateLimitTracker`) + H-sec entry (deferred)

**J2 · Client IP — one trustworthy answer on every host** (facts: `{client_ip}` is taken from a client-sent
X-Forwarded-For ⇒ every per-IP limit resets by rotating one header; 7 different readers; FDID never reaches the apps)
- [x] Edge: the rule writes the TCP address (`{socket_ip}`) into an app-owned header no platform layer touches (Overwrite)
- [x] `ClientAddress` in `clinqetinfrastructure/Services/Security`: trusts that header ONLY when `X-Azure-FDID` = our Front Door id; else the connection's own address; strips ports; IPv4-mapped → IPv4; rejects junk
- [x] Rate-limit key: IPv4 as is, IPv6 grouped by /64
- [x] Front Door id reaches API + Identity + Functions as an app setting (apps.json / functions.json + deploy.ps1) with a class default
- [x] Replaced every reader: API `GetClientIpAddress` + `GetRateLimitClientIp` + `ClientCountryResolver`, Identity `GetClientIpAddress`, `AdminIpWhitelistMiddleware`, Telnyx + Plivo webhook readers
- [x] Country header read the same way (only from our Front Door)
- [x] WAF geo rules match the socket address, not the spoofable `RemoteAddr`
- [x] Per-stamp WAF: the webhook Allow rule can no longer switch off rate limits on api/identity hosts (scope to the function host + path prefix)
- [x] SSR scenario recorded, NOT changed: the customer web's server calls the API itself, so every SSR visitor shares that app's outbound address in one anonymous bucket (networking.json already notes it). Forwarding a visitor's address from SSR would mean trusting a header the app composes, which is the defect just removed — a per-session key is the fix if it ever bites
- [x] Unit + integration tests (spoofed X-Forwarded-For rotation stays in ONE bucket; wrong/missing FDID ignores the header; ports; IPv6 /64; junk) — stale "Front Door APPENDS" tests/comments/skills corrected

**J3 · WhatsApp** — [x] `WHATSAPP-TEMPLATE-ISSUES-2026-09-26.md` (both templates, all wording, where the issue is, plus
every provider button on `partner.clinket.com`) · [x] WhatsApp skill ×4 corrected (digest UTILITY; button domain)

**J4 · Refund email** — [x] recommendation in `DECISIONS-REFUND-OUTBOX-2026-09-26.md` §1 · [ ] owner's answer

**J5 · Outbox** — [x] plain explanation + recommendation + §0.7 table in the same file §2 · [ ] owner's answer (nothing built)

**J6 · Translation pass outside billing (decision 5)** — 12,613 unique English texts × fr/es/hi/gu, 5 surfaces
- [x] Term decisions per language (4 termbases, ~110 rows each, second independent pass adopted as Amendments) → glossary extended (bid, award, passkey, availability, team, branch…)
- [x] Pilot one chunk per language read fix by fix, then the brief gained the per-key fix and the ICU apostrophe rule
- [x] Full review: 40 chunks × 4 languages — 13,606 fixes ⇒ **20,593 values corrected**; 17 flagged items read one by one (deliberate English); 5 refused because the text had already been corrected; every fix structure-checked (ICU/tokens/tags) and applied only if the text is unchanged since review
- [x] Voice guards: es usted (~586 strings), fr tu, gu આપનું mix · brand never transliterated (hi 49, gu 73) · "Clinqet" typo in English
- [x] Permanent guard per repo (`translationVoiceGuard`, 16 checks each ×4 repos): voice, brand, reply keywords, line breaks — a planted sabotage fails all four
- [x] SMS: 19 English-only templates × 4 languages (command words HELP/STOP/START/CONFIRM/DECLINE stay English) + content test for every language
- [x] HELP reply now answers in the reader's language (`ResolveLanguageFromPhoneAsync`, the phone lookup the opt-out path already used); theory test ×2
- [x] Verification-code SMS and the WhatsApp reply hint carry the English keywords again in all four languages; guarded in every repo AND in `SmsTemplateContentTests` (same set per language, same tokens, same keyword counts)
- [x] Translated values that are NOT text — **checked, nothing to restore.** Scanned all five backend locale files for
      values shaped like paths, URLs, camelCase/CONST_CASE/kebab identifiers: 23 English values match those shapes and
      every one is genuinely display copy (`PDF_BookingTitle` "BOOKING", `TaxLabel.GST`, `PDF_Paid`, the
      added/updated/removed verbs, "custom"/"global" which are interpolated into a duplicate-name error). No localized
      value is read programmatically anywhere — no `GetLocalizedString(...)` result is compared, parsed or used as a key
- [x] Stale comments claiming SMS is English-only (`ServiceDetailsCopyTests.cs`, `VoiceAssistantService.cs`)
- [ ] Recommend to owner (not built): also honour ARRET/AIDE (fr) and PARAR/AYUDA (es) replies, the CTIA/CWTA practice for non-English programmes
- [x] English source defects reported by reviewers — the real ones fixed, in English only (every translation already
      said the right thing), **except the Terms placeholder, which all five languages carried**:
      ‼️ `Profile.Terms_Service.Section1.1` read *"By registering and using **[App Name]**, you agree to:"* in the
      Terms of Service of BOTH web apps — and each translator translated the PLACEHOLDER rather than the product
      (`[Nombre de la aplicación]`, `[Nom de l'application]`, `[એપ્લિકેશન નામ]`, `[ऐप का नाम]`). All ten now say
      **Clinket** · "consented **to to** share" in the Privacy Policy intro · `Auth.Used_Password` "from previous used
      password" → "from a previously used password" (the wording the provider app already had right) ·
      `button.Re_schedule` "Re schedule" → "Reschedule" · `quotes.addDeposite` "Add Deposite" → "Add Deposit" (value
      AND the `defaultMessage` in `ExtraChargesSection.jsx`; the key's own spelling left alone — renaming it touches
      five files and the JSX for no user-visible gain) · mobile provider `STATE_PROVINCE` "State / **Provience**" ·
      mobile customer `CREATE_PASSWORD_DESCRIPTION` · backend `en.json`: "**Mininum** Order Value", "Password Reset
      **succesfully**", "Password Changed **succesfully**" · **orphan removed**: `myBookingsDetail.SamplePlaceholderText`
      was Lorem ipsum referenced by no component — deleted from all five customer-web files (§22.2)
- [x] All locale suites green: provider web 53, customer web 25 (its French guard was the STALE France version audit U-35 already rejected — ported the corrected one), provider app 35, customer app 42, guards 16×4

**J7 · Canada receipts — French page + English page in one PDF (region ca); US/India English**
- [x] `ReceiptLanguages.ForRegion` (core), used by both the email processor and the download endpoint
- [x] Promo line on the emailed PDF too (the processor resolves it from the live binding, like the endpoint)
- [x] One receipt number in PDF, file name and email (`ReceiptNumbers.For`)
- [x] French receipt words corrected (PAID, Thank you, Bill to, Description, tax no.…), rate suffix culture-aware, seller tax label localized for Canada
- [x] "PAID" replaced by the refund state on refunded charges
- [x] Tests updated (the pinned "en") + new: `PdfCanadaBilingualReceiptTests` (both languages asked for, English-only for us/in, the refund state, the seller's label), `ReceiptLanguagesTests`, `ReceiptNumbersTests`
- [x] ‼️ **BOTH BUILT 2026-09-27 — owner approved after review** ("only if this is provider number not clinket
      number… decide what is the best solution"). **It is CLINKET's number**, one per country, admin-edited — not the
      provider's (that is `PaymentConfig.TaxRegistrationNumber`, already per-provider). See §N.

**J8 · Defects found in this batch**
- [x] **Every successful charge also sent a generic "BusinessNotification" email.** `BillingNotificationService`
      deliberately sets `EmailTemplate = null` for SubscriptionCharged / AiAddOnActivated / MinuteTopUpPurchased so the
      branded receipt is THE email — but BillingPayments is a mandatory-email category, and the business fan-out fills
      in a generic template (and re-attaches the recipient's address) whenever one is missing. ‼️ **A null template
      cannot say "someone else is sending it"**, so the producer now says so outright:
      `CommunicationRequest.EmailDeliveredElsewhere`. The fan-out then skips the fallback, skips the email leg, and —
      critically — **skips the "mandatory email reached no administrator" alert**, which would otherwise have fired on
      every successful charge. ‼️ The tempting fix (let a caller's `SkipEmail` beat the mandatory rule) was REJECTED:
      `BookingService` sets `SkipEmail = true` in ~8 places and BookingNotifications is also mandatory-email, so it
      would have silently stopped booking emails. Proved by `MandatoryEmailIsNotDuplicatedTests` (4 cases, running the
      REAL dispatcher) + the producer assertion in `BillingNotificationServiceTests`
- [x] **India bank-settled renewals and minute packs never got a receipt email.** The receipt is enqueued by
      `BillingChargeService` at charge time, which only sees `Succeeded` when the rail settles THERE (cards). A
      bank-settled method (India netbanking/UPI) answers later on the payment webhook, and nothing enqueued a receipt
      on that path. `PaymentWebhookProcessor` now enqueues it — ‼️ only when `settledTx` is non-null, which is true
      **only when that webhook made the transition**, so a card charge already receipted synchronously does not get a
      second. Same deterministic `receipt_{txId}` message id ⇒ a redelivery is deduplicated. Eligibility moved to ONE
      definition, `Core.Models.Payments.ReceiptEligibility`, used by both paths — a copy in the second place is exactly
      how the second path went quiet. 3 tests (settles-here, already-succeeded, non-receipt type)
- [x] ‼️ **Found while fixing the above:** `PaymentWebhookProcessorIntegrationTests.BuildProcessor` registered only 4
      services, so the refund tail's `GetRequiredService<IProviderRefundRecorder>()` threw and
      `SignedRazorpayRefundProcessed_MarksRefunded_OnRealSql` failed. The harness now registers the **real** recorder
      over the fixture's SQL, so the money rules are proved against a real engine rather than a double

**J9 · Close-out**
- [x] **Every suite green, 2026-09-27:** API unit **14,150** · API integration **2,348** · Functions unit **6,995** ·
      Functions integration **742** · Identity unit **1,136** · Identity integration **481** · provider web **4,631** ·
      customer web **1,835** · provider app **5,608** · customer app **1,687**. ESLint clean on every file of mine
- [x] ‼️ **NOT mine — the other session's uncommitted work, left alone:** provider app
      `assistantTabRootBackControl` + `callFollowUpsScreenFilters` (10 tests) fail inside their
      `src/components/ai/AiSurfaceGate.tsx:67`, and provider web `src/context/providerStateRefresh.test.jsx` is an
      untracked test of theirs. Reproduced uncontended to be sure it is not load flake
- [x] **Load flakes, not defects** (pass alone, fail only under a loaded parallel run): API
      `PdfTopUpMinutesReceiptTests.TopUpReceipt_WithFrozenMinutes_RendersTheMinutesLine` (a **pre-existing**
      PDF byte-length comparison — my only change to that file was threading `ReceiptLanguages`), provider app
      `locationsScreens` + `dashboardWorkQueueActivityImage` (6s alone vs 43–49s loaded)
- [x] ‼️ **The build isolation had to be rebuilt from HEAD**, because a path heuristic kept mis-sorting the two
      sessions' files: the baseline is now `git archive HEAD` + an **explicit allowlist** of my files, with three
      files both sessions edited (two `Program.cs`, `RecommendationsControllerTests.cs`) restored to HEAD and my
      lines re-applied. Never patch the shared tree to make a build pass
- [x] Skills ×4 (`clinqet-notifications` + `clinqet-payments`) + memory + this checklist
- [x] Scratch deleted — everything temporary stayed in the session scratchpad; `git status` shows no file of mine
      that I did not intend (§0.16)
- [x] **One commit per repo, own files only, linear.** 13 repos, each exactly 1 commit ahead of `origin/master`,
      `git rev-list --merges origin/master..HEAD` **empty in all 13**, `clinqetapi` last. ‼️ The API and Functions
      `Program.cs` are shared with the other session, so only MY hunks were staged (`git diff` → filter hunks →
      `git apply --cached --recount`) — their hunk in the API file is still uncommitted and untouched. **Owner pushes**


**J10 · Found and fixed while doing J6 (both were MINE)**
- [x] 16 Spanish server strings held a literal `\n` where the reader must see a line break: a reviewer's JSON escaped it and my apply wrote it verbatim. Repaired, and every surface's break count is now compared with English (in the per-repo guard)
- [x] ‼️ The review brief quoted the glossary's FRANCE punctuation ("a space before ? ! : ;"), but this repo ruled the QUÉBEC convention (no space before ? ! ;, kept before :) in audit U-35 / R7 and guards it in the provider web. 1,157 French values corrected across all five surfaces, the glossary line rewritten, and the customer web's stale France-era guard replaced with the corrected one


## ‼️‼️ K · REFUND — APPROVED BY THE OWNER 2026-09-27. THESE ARE HARD RULES, NOT SUGGESTIONS

> The owner, verbatim: *"I am fully fully agree with your recommendation … make sure we do it correctly and without
> missing anything means anything at all … fully production ready best practice code not a single workaround not a
> shortcut … it need to handle every and all the edge case scenario end to end … write it down super super cleanly with
> the bold letter so that no one means no one miss this instruction even you compact the session"*.
>
> **‼️ READ THIS SECTION BEFORE TOUCHING ANY REFUND CODE. EVERY RULE BELOW IS BINDING. A rule that looks expensive is
> still binding. If a rule cannot be met, STOP and ask the owner — do not route around it.**

### K0 · What is broken today (measured, not assumed)
Clinket never refunds a provider from its own screens: the ONLY way is a human pressing refund in the Stripe or
Razorpay dashboard. When that happens the platform today does exactly one thing — it flips the charge row's status to
`Refunded`. Everything else is missing:
- **no amount is recorded**, so a PARTIAL refund is indistinguishable from a full one;
- **India minute-pack refunds are not recorded at all** (those rows carry an order id, and the code matches only on a
  charge id);
- **the tax collected on that charge is never reversed**, so the books still show tax we no longer hold;
- **the receipt still says PAID** and billing history still shows the original positive amount with a Receipt button;
- **nobody is told** — no email, no in-app notice, no admin alert, and the admin refunds list filters the row out;
- **a late "payment succeeded" webhook can flip Refunded back to Succeeded**, erasing the only trace that existed.

Parked and NOT in scope (owner, 2026-09-27): the notification outbox. Its consequence stays true and is recorded here
so it is never re-discovered as news — **a notice is lost only when the message cannot be PUT on its queue**
(`notifications`, `email-notifications`, `sms-notifications`, `whatsapp-outbound`, `billing-receipt-emails`, …).
Once a message IS on a queue, delivery is safe (queue retries + dead-letter). Separately, a few timer sweeps stamp
"sent" BEFORE dispatching, so a failure there is never retried.

### K1 · THE MONEY RULES (‼️ each one is absolute)
1. **‼️ EVERY REFUND BECOMES ITS OWN MONEY ROW.** A `BillingTransaction` with `Type = Refund`, the refunded amount,
   the currency of the original charge, `GatewayRefundId`, and the charge it reverses. Never a status flip alone.
   **No schema change: the type, the columns and the unique index already exist.**
2. **‼️ THE REFUND ROW'S `IdempotencyKey` IS DERIVED FROM THE GATEWAY'S REFUND ID** (`refund_{gatewayRefundId}`).
   The same webhook arriving twice, or a replay months later, MUST produce exactly one row — proven by the unique
   index, not by a read-then-write check.
3. **‼️ THE ORIGINAL CHARGE'S STATUS IS DERIVED FROM THE SUM OF ITS REFUNDS**, never from the event alone:
   sum < charge ⇒ `PartiallyRefunded`; sum >= charge ⇒ `Refunded`. Two partial refunds that together cover the
   charge MUST end as `Refunded`.
4. **‼️ A REFUNDED CHARGE CAN NEVER BE DEMOTED BACK TO SUCCEEDED.** A late or duplicated success webhook must not
   rewrite settled history (`BillingTransactionStatusTransitions` allows it today — that is a defect to close).
5. **‼️ TAX IS REVERSED IN PROPORTION AND FROZEN ON THE REFUND ROW** (`TaxAmountMinor`, `TaxRateBps`, `TaxLabel`,
   `TaxInclusive`, `TaxJurisdiction` copied from the charge). Never recomputed later from today's rules, and never
   more tax than the charge collected.
6. **‼️ A REFUND NEVER CANCELS A PLAN, SWITCHES OFF THE AI ASSISTANT OR TAKES BACK MINUTES.** Those are separate,
   deliberate acts. Stripe does not do it either. Anything else risks cutting off a provider who is owed money.
7. **‼️ INDIA IS NOT AN AFTERTHOUGHT.** A refund event that carries only an ORDER id must find its charge
   (India minute packs store the order id, not a charge id). A refund we cannot match is an ADMIN ALERT, never a
   silent return.

### K2 · THE TELLING RULES (‼️ the person whose money moved must hear it)
8. **‼️ ONE EMAIL PER REFUND**, to the business's billing address, template `RefundProcessed` (it already exists in
   all five languages), in the READER's language, stating the amount in their format, the original receipt number and
   that the bank may take a few days.
9. **‼️ THE EMAIL CARRIES A REFUND RECEIPT PDF** — a credit note where tax was charged. Canada gets the French and
   English document (§J7's rule); US and India English. It states what it reverses.
10. **‼️ THE IN-APP NOTICE GOES OUT TOO** (`NotificationType.RefundProcessed`, already routed, already permissioned
    `billing.read`) so the team sees it beside the charge.
11. **‼️ THE ORIGINAL RECEIPT STOPS SAYING PAID** — it states REFUNDED or PARTIALLY REFUNDED (done in §J7).
12. **‼️ ADMINS ARE TOLD** when a refund arrives that Clinket did not initiate, and the admin refunds list must show
    provider refunds (today its filter excludes them).
13. **‼️ NOTHING IS SENT TWICE.** The notice's EventId and the receipt email's message id are derived from the refund
    row's id, so a redelivered webhook re-runs the tail and sends nothing new.

### K3 · THE EDGE CASES THAT MUST HOLD (‼️ each needs a test that fails without the fix)
- the same refund webhook delivered twice ⇒ one row, one email, one notice;
- two partial refunds ⇒ two rows, the charge ends `Refunded`, each email states its own amount;
- a refund larger than the charge (gateway-side correction) ⇒ never a negative balance; alert;
- a refund for a charge we cannot find ⇒ alert naming the gateway ids, never silent;
- an India pack refund matched by ORDER id;
- `refund.failed` after a `refund.processed` ⇒ the row is marked failed and the provider is told the money did NOT
  arrive (today only an admin alert fires and the row still claims Refunded);
- a late `payment_intent.succeeded` after the refund ⇒ status stays refunded;
- a $0/fully-discounted charge ⇒ no refund row, no email;
- a business with no billing email ⇒ the in-app notice still lands, and an alert says the email could not go;
- a refund on a Flow-B booking charge ⇒ the existing customer path is untouched (this work is Flow A only);
- `IsFullyRefundedAsync` must not sum other businesses' refund rows once Flow-A refund rows exist (latent defect,
  no business filter today) — fix it in the same change.

### K4 · WHAT "DONE" MEANS
Unit tests for every rule in K1–K3, **real-SQL integration tests** for the idempotency key, the partial-then-full
path and the status floor (§0.8 makes these mandatory for money and unique indexes), the skills updated ×4, and this
checklist ticked. **A change that ships without the integration tests has FAILED, however green the unit tests are.**

## ‼️‼️ L · SERVICE BUS SEND — RETRY AND THE LOST-MESSAGE ALERT (owner's batch, 2026-09-26 evening + 2026-09-27)

Owner, verbatim essence: *"is it even there or not?… if it not there can we add it… if this fail even after the retry
can we make sure we raise the admin alert with the enough details, which notification, which business… dedicated admin
alert type?… all the things should be controlled by an app setting… this could be a real-time operation so we don't
want a 20 second delay between retrying"*, and then *"check for the admin alert what important and good information we
should add"*.

### L0 · What was actually there before (measured, not assumed)
- Retry: **yes**, but the backoff was **hardcoded and linear** (`150ms × attempt` ⇒ 150/300/450), in one place only —
  `ServiceBusService.ExecuteWithRetryAsync`, which **every** send on **every** host funnels through.
- Alert: **yes**, but it named only queue · message type · failure reason · retryable · attempts, and deduplicated per
  (queue, failure kind, 15 min). ‼️ **No business, no notification type, no recipient** — during an outage that is one
  alert and no way to know which providers went untold.
- ‼️ **A send is the ONLY place a notice can be lost.** Once the broker accepts it, redelivery + DLQ take over. So this
  is the whole loss window, and it is worth getting exactly right.

### L1 · THE RETRY RULES (‼️ each one is absolute)
- **Exponential with jitter, capped** — `NextBackoffDelayMs(attempt)` = `Base << attempt`, clamped to `MaxDelay`, then
  spread by ±`JitterPercent`. Defaults 100ms / 1000ms / 25% ⇒ **3 retries cost at most ~1.4s**.
- ‼️ **A SEND BLOCKS A LIVE REQUEST.** The backoff exists to ride out a blip, never to wait out an outage. Any change
  that lets the default budget exceed ~2s is a defect — `TheDefaults_KeepEveryRetryUnderTwoSeconds` fails on it.
- **Every number is a setting**, present in **all four hosts' `appsettings.json`** (API · Functions · Identity · MCP)
  and mirrored by the class default (§4): `MaxSendRetries`, `RetryBaseDelayMs`, `RetryMaxDelayMs`, `RetryJitterPercent`.
- **A shift cannot overflow into a tiny or negative wait** — attempt ≥ 30 returns the cap.
- **Permanent failures are never retried** (entity missing, credential rejected, entity disabled) — unchanged, and the
  pre-existing `ServiceBusServiceRetryTests` still pins it.

### L2 · THE ALERT RULES (‼️ the alert is all an admin has — the message itself is gone)
- **One dedicated type**: `AdminAlertType.NotificationSendFailed`, distinct from the namespace-health
  `ServiceBusResourceLimit` ("a queue is unhealthy"). Registered in the admin app's alert list.
- ‼️ **Keyed per (queue, BUSINESS, 15-min window)** — not per queue. During an outage the whole point is knowing
  **which** providers went untold; a per-queue key collapses that to one useless row.
- ‼️ **`BusinessId` and `BusinessName` go on the ENTITY's own columns**, not only in metadata. The admin alert list
  filters and groups on the columns — an alert that names the business only inside `Metadata` is **invisible** to a
  search for that business. (This was a real defect in the first cut of this work, found 2026-09-27.)
- **The metadata must answer "what do I re-send, to whom, and how do I trace it":**
  | Field | Why it earns its place |
  |---|---|
  | `BusinessId`, `BusinessName` | whose provider went untold |
  | `Recipient` | the user number / address it was for |
  | `NotificationType` | what it would have said |
  | `Subject` | the idempotency key / booking / invoice / transaction it was about |
  | `CorrelationId` | ‼️ threads back to the request that raised it — the only way to find it in the traces |
  | `Payload` | ‼️ **the message's own words** — without it an admin can name the notice but not re-send it |
  | `SendingHost` | separates "Service Bus is down" from "one host lost its credential" |
  | `Language` | which language to hand-send in |
  | `QueueName`, `MessageType`, `MessageId` | where it was going and under what id |
  | `FailureReason`, `Retryable`, `Attempts`, `Timestamp` | what happened, and whether trying again could work |
- ‼️ **The payload is SCRUBBED and CAPPED.** Property names are split into words and matched against a secret list —
  **never substring-matched**: `ShippingAddress` contains "pin" and `Keywords` contains "key", and redacting those
  would hide the very facts the alert exists to carry. Cap is `LostMessagePayloadMaxChars` (default 4000, 0 = omit),
  because an alert is a Cosmos document.
- **Severity**: `Critical` when the call site passed `forceAdminAlert` (it already declares "this must not be lost
  quietly"), `High` otherwise. No new list to maintain.
- ‼️ **A message with nothing identifying raises NO lost-message alert** — analytics events and the like are covered by
  the queue-health alert. The gate is IDENTITY only: the ambient fields every message inherits (`CorrelationId`,
  `PreferredLanguage`) are deliberately excluded from it, or an anonymous event would look like a lost notice.
- **Reading the message costs nothing on the happy path** — the reflection runs only after every retry is spent, and
  the per-type accessors are cached.

### L3 · WHAT "DONE" MEANS
Unit tests for every rule in L1–L2 (backoff shape, cap, jitter bounds, the <2s budget, per-business keying, the
entity columns, correlation id, payload presence/redaction/cap/off, severity, the gate), the four hosts' appsettings
carrying every key, the admin app listing the new type, and this checklist ticked.

- [x] Exponential + jitter + cap, all four numbers settings-bound
- [x] `NotificationSendFailed` alert type + admin-app list entry
- [x] Per-business keying; entity `BusinessId`/`BusinessName`; the full metadata table above
- [x] Payload snapshot — word-boundary scrubbing, capped, switch-off-able
- [x] Severity from `forceAdminAlert`; identity-only gate
- [x] Keys added to **all four** hosts' `appsettings.json` (API · Functions · Identity · MCP)
- [x] Tests: 15 in `ServiceBusBackoffAndLostMessageAlertTests`; the pre-existing `ServiceBusServiceRetryTests`
      helper updated for the new parameter (API unit suite green, 14,145)
- [x] ‼️ **No other edit is needed anywhere.** Every host, every queue, every send already funnels through this one
      method — answer the owner's "do I need to edit other places" with exactly that.

## ‼️ M · HARDCODED DELAYS ELSEWHERE — INVENTORY ONLY. ‼️ THE OWNER RULED **DO NOT DO THIS NOW** (2026-09-27)

> Owner, verbatim essence: *"we can I guess ignore the new one and do it that is part of our scope which is the
> service bus… let's not overscope it or complicate it — as long as those values make sense I'm good with that and
> maybe in future we'll move it to an app setting, but for now I think it's good, so let's make sure our service bus
> flow is accurate and correct."*
>
> ‼️ **So: NOTHING in this section is to be built.** It is written down only so the findings are not lost. A future
> session that wants to act on it needs a FRESH approval — this section is not one. The Service Bus retry + alert
> work in §L is the whole of the approved scope.


Two full sweeps of production code (tests excluded) across **clinqetmcp · clinqetidentity · clinqetfuncations ·
clinqetinfrastructure** found **~170** hardcoded retry/backoff/timeout/cooldown values. ‼️ **This is an inventory, not
an approval** — it is recorded here so it cannot be lost, and the owner decides the scope.

**Where the density is** — MCP voice relays (the same 5-const block copy-pasted between `VoiceSessionMonitor` and
`PlivoVoiceRelay`) · Functions `Program.cs` (7 × `client.Timeout = 30s`, the EF/SQL retry triple, one Polly
`WaitAndRetryAsync(2, …)`) · Infrastructure `Services/Search` (17 cooldown/cleanup/lock timeouts in classes with no
options injected) · `Services/Auth` (the 10-attempt/100ms/5s identifier loop, duplicated) · `Data/COSMOS`
(`const int maxAttempts = 3` verbatim in 7 voice repositories) · `Services/Broadcast` (the same
`(attempt+1)*100 + Random(0,50)` backoff copy-pasted 6×).

**The four repeated shapes that would collapse into one key each** — `maxAttempts = 3` (15+ copies) ·
the Broadcast backoff expression (7 copies) · `TimeSpan.FromMinutes(15)` alert cooldown (8 copies) ·
`client.Timeout = 30s` (12 copies across two hosts, while `HttpClient:DefaultTimeoutSeconds` already exists and is
wired only to the `"default"` client).

**Two that are defects in their own right, whatever the scope decision:**
- `Functions/DeviceRegistrationRetryFunction.cs:46` — the **only hardcoded cron** among 18 timer functions; every other
  one uses `%Section:TimerSchedule%`.
- `Services/CircuitBreakerService.cs` — `CircuitBreakerOptions` is **never bound to a config section**, so its
  defaults (5 failures / 1 min open / 30s half-open) are effectively hardcoded.

‼️ **Why this is not simply "go and do it":** much of it sits in Search, Broadcast, RecentlyViewed and the voice
relays — areas another session is working in **right now**. Doing it blind would collide. Full lists are in this
session's transcript; re-run the two sweeps if they are needed again.

## ‼️‼️ N · CANADA TAX ON RECEIPTS + NON-ENGLISH SMS REPLIES — owner-approved 2026-09-27, BUILT

> Owner: *"both of them need to be fully fully done correctly and as a best practise… no shortcut and workaround…
> handle every and all the edge case scenario"*, then, on the schema: *"is this clinket our number or provider's
> number… decide what is the best solution and then no need to check with me… only if this is provider number"*.

### N1 · Whose number is it — the question that decided the design
**Clinket's**, not the provider's. `SellerTaxRegistration` is Clinket's OWN account as the registered seller and
receipt ISSUER; the PROVIDER's number is `BusinessProfile.PaymentConfig.TaxRegistrationNumber`, already per-provider
and free text, printed on the provider's own invoices. **Nothing was needed for the provider side.**

### N2 · THE SCHEMA (one column + one index swap — migration `20260927084204_AddSellerTaxRegistrationSubdivision`)
- ‼️ The old model said "one active row per region". **That was simply wrong**: Canada is a federal GST/HST account
  **plus a separate Quebec QST account** (plus a PST account in any province Clinket registers in), and India is one
  GSTIN per state. The fact is one-to-MANY, so the TABLE was right and its **unique index was the bug**.
- `SubdivisionCode` (nullable, 10) + unique filtered index `(Region, SubdivisionCode) WHERE IsActive = 1`.
  **NULL = the region-wide row = the issuer.** Mirrors `TaxRule` exactly (§0.13).
- ‼️ **Two `Secondary*` columns were REJECTED as a workaround**: they hard-code "at most two" and cannot say WHICH
  province a number belongs to — an **Ontario** receipt would print the **Quebec** QST number. That is wrong, not
  merely ugly.
- **Deploy order is free**: adding a nullable column is backward compatible, and old code writing NULL stays unique
  under the new index exactly as under the old one.
- ‼️ **`deploy.ps1` does NOT apply migrations** — the owner runs them, **per region** (CA and IN are separate servers):
  `dotnet ef database update --project clinqetinfrastructure --connection "<that region's connection string>"`.
  Until it is applied on a stamp, that stamp's receipts keep printing exactly what they print today.
- **No ARM / `deploy.ps1` change**: no new Azure resource, no new `local.settings.json` key (§25).

### N3 · THE RULES (‼️ each has a test that fails without it)
- `GetApplicableAsync(region, taxJurisdiction)` is the ONLY lookup — region-wide FIRST, then the province row when
  the buyer was taxed there. Jurisdiction is the value **FROZEN on the transaction** (`"CA-QC"`), never a live
  address. ‼️ `GetActiveAsync` was DELETED: after the change it had no production caller and only tests kept it alive.
- **One cached read per region** serves both halves, so they cannot expire out of step and print a stale pair.
- **Retiring is soft** (`DELETE …/seller-tax/{id}`): past receipts stay explainable and the filtered index frees the
  slot. Without it a number Clinket no longer holds would print forever — found by auditing my own change.
- ‼️ A **typo'd province is rejected at the door** (`TaxSubdivisionNormalizer`, made public and reused): a registration
  that can never match a frozen jurisdiction would simply never print, and nobody would know why. India has no
  canonical table, so its state code is taken as typed.
- ‼️ **Proved on REAL SQL** (§0.8 — EF InMemory enforces no index, so every assertion would pass without it):
  SQL Server treats NULLs as EQUAL in a unique index, which is what still makes the region-wide row unique.

### N4 · THE TAX SPLIT (no schema — derived, and it refuses itself when it cannot be faithful)
Quebec is stored as ONE rule (`GSTQST`, **1497 bps, deliberately floored** from 14.975% so the platform never
over-collects). `Core.Models.Payments.TaxComponents.Split` derives GST + QST from the frozen label/rate/amount.
- **Legislated rates live in C#, never in a row** (§0.7) an admin could desynchronise from the rule actually charged.
- ‼️ **It REFUSES to split** when the charged rate no longer matches the sum of its parts (0.01% tolerance = the
  Quebec floor) — so a receipt reprinted after a rate change prints the combined line it always did, not a split that
  never happened.
- ‼️ **The parts always sum to the money actually taken**, to the minor unit; the last component absorbs the rounding.
- A province registration **names its jurisdiction** (`PDF_SellerTaxNoInSubdivision`, 5 languages): two numbers both
  labelled "Tax reg. no." say nothing. `TaxLabel.RST` was missing and was added (5 languages; fr = TDP).
- Applies to the **refund credit note** too — the refund row already freezes `TaxLabel`/`TaxRateBps`/`TaxJurisdiction`.
- **Scope**: Clinket's own Flow-A receipts, which is where the legal duty sits. The provider's booking/invoice PDFs
  have an *inclusive*-tax variant and a free-text label — a separate question, deliberately NOT half-done here.

### N5 · NON-ENGLISH SMS REPLIES
- One normalizer for both channels: **trim → strip punctuation → strip ACCENTS → uppercase**. ‼️ Tables hold no
  accented spelling: one entry covers ARRET, arrêt, ARRÊT, ARRÈT. Adding an accented entry would match only itself.
- Accepted: fr ARRET/ARRETER/DESABONNER, es PARAR/PARE/ALTO/BAJA/CANCELAR, AIDE/AYUDA, and the opt-in words.
  Every template still **advertises the English word** in all five languages — the localized ones are a safety net for
  the reader who ignores the instruction, which is exactly the reader who types their own language.
- ‼️ **Spanish ALTA ("subscribe") is deliberately ABSENT** — one letter from ALTO ("stop"); reading a mistyped opt-out
  as an opt-in would resume messaging someone who meant to end it.
- ‼️ **WhatsApp takes only the COMMAND words** (ARRET, DESABONNER): ALTO/PARE/PARAR/BAJA/CANCELAR are ordinary Spanish
  a customer may open a message with. Same test the existing CANCEL/END/QUIT narrowing applies.
- ‼️ **Split on ANY whitespace, not a literal space** — `"STOP\\n"` reaching Unknown means we keep messaging someone
  who asked us to stop, which is the worst failure this table can have. Also fixed the WhatsApp/SMS punctuation
  asymmetry (a typed `CONFIRM.` now answers a booking on both).

### N7 · VERIFIED + COMMITTED 2026-09-27 (owner pushes; ‼️ and runs the migration per region)
API unit **14,216** · Functions unit **7,035** · Identity unit **1,136** · API integration **2,354** (+6 real-SQL
index proofs) · Functions integration **742** · Identity integration **481** · admin app **410** + ESLint clean.
Committed in 7 repos this round (own files only, one commit each); `git rev-list --merges origin/master..HEAD` is
**empty in all 13**.

### N6 · FOUND BY AUDITING MY OWN CHANGE (all fixed)
- The combined tax label was resolved **eagerly**, so a split receipt still paid for a translation it never printed.
- `GetActiveAsync` became dead code propped up by tests.
- **A second test file for a service that already had one** — merged into `SellerTaxRegistrationServiceTests`.
- ‼️ `PdfTopUpMinutesReceiptTests` compared **PDF byte lengths**. QuestPDF caches font subsets per PROCESS, so a PDF's
  absolute size depends on which tests ran before it, and for one short line the difference inverts. It was not a
  flake; it was an unsound assertion. Replaced with the localization-key assertion the rest of the file uses.
- My own concurrent-refund test required **both** racing callers to return. On real SQL one may legitimately deadlock
  and surface a retryable error — which is CORRECT for a queue handler. It now pins the money invariant (exactly one
  refund row, charge agrees) and tolerates the loser retrying.

## Mockup register

| Sheet | Path | Approved | Governs | Supersedes |
|---|---|---|---|---|
| Minute packs — who can add minutes | `Data/mockups/topup-availability/index.html` | **Approved by the owner 2026-09-25, in conversation ("it's approved")** — frames 1–9 | Web minute-pack slot (Available · winding down · settle first · trial ending · no assistant) and the provider app's top-up card | Adds the availability states to `ai-engine-switch-minutes` frame 7; nothing superseded |
| Settle first — overdue states (same sheet, frames 10–18; frames 2–3 updated) | `Data/mockups/topup-availability/index.html` | **Approved by the owner 2026-09-26, in conversation ("mockup is approved")** — frames 10–18; built before approval (web + app + notices) and matching them | Overdue AI card + Pay now · trying · last try · bank processing · overdue plan card · plans grid while overdue · Pay now answers · app plan-card lines · the payment-failed notices | Frames 2–3: "Update card" (navy) → Pay now (green) leads, Update card beside it |
