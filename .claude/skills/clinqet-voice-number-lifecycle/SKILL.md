---
name: clinqet-voice-number-lifecycle
description: |
  **CORE FEATURE SKILL — MONEY PATH** — the life of an AI Assistant phone number: how a business gets one
  (it picks from the pool or a carrier search, or the team gives it), how a number is bought ONCE, held when
  the AI service ends, removed, kept or returned to the carrier before its next rent, and every request a
  provider can send the team about it. One inventory partition per stamp, one writer (the coordinator), one
  hourly job, one queue worker. USE FOR: anything touching VoiceNumberCoordinator, VoiceNumberAllocationService,
  VoiceNumberPurchaseService, VoiceNumberLifecycleService, VoiceNumberBillingGate, VoicelineProjector,
  VoiceNumberInventoryRepository, VoiceNumberOperationProcessorFunction, VoiceNumberLifecycleFunction, the
  provider `voice-assistant/number/*` endpoints, the admin `admin/voice-numbers/*` endpoints, the admin
  remove / change / assign number flows, the number screens in all four apps, and the `VoiceNumbers` settings.
  ‼️ A bug here rents numbers nobody uses or puts two businesses on one line. Read it all before changing a line.
---

# Voice number lifecycle

> Built 2026-10-01/02. Authority, in order: `C:\Nik\Data\voice-number-lifecycle\DECISIONS-2026-10-01.md` →
> `FINAL-DESIGN.md` → `UI-CONTRACT.md` → the mockup. The audit that found the rules below is
> `IMPLEMENTATION-AUDIT.md` (parts one and two) in the same folder.
> The inbound-call side (what a number DOES when it rings) is `clinqet-voice-assistant`. This skill is only
> about who holds a number, what it costs, and when it goes back.

## 0. Rules that are never broken

1. ‼️ **NEVER buy, reserve, release or change a number at Telnyx or Plivo from a test, a script or a dev
   session — sandbox included. It is billed.** Read-only GET calls are allowed. Every test uses a scripted
   carrier (`ScriptedCarrier`, `MockTelnyxNumberService`, or a `Mock<IVoiceNumberProvider>`).
2. **One writer.** Only `VoiceNumberCoordinator` writes `VoiceAssistantState.AssignedNumber`, the number's
   line and the inventory claim. Three rules, in this order, on every path:
   **claim before act** (an ETag-conditional write that raises the number's generation) →
   **project with that generation** (a profile or line write carrying an older one is refused) →
   **record before the carrier** (the durable record says what we are about to do before we do it).
3. **The order is placed once.** The asset says `Purchasing` and the request carries OUR reference before the
   POST; the POST is never retried; an unknown or pending answer is settled by ASKING the carrier
   (`FindOrderAsync` by our `RequestId`, never by the carrier's order id).
4. **Unknown is never read as "no".** Billing that cannot be read is neither "live" nor "ended"; a price that
   cannot be read is never zero; a carrier listing that failed or was cut short proves nothing about absence.
5. **No cross-partition query.** Everything lives in ONE SystemData partition per stamp.
6. **Schema is SCHEMA-APPROVAL-REQUEST.md revision 4 and nothing beyond it.** A new enum VALUE in an existing
   field is not a new field; a new field, index path or document family needs the owner's yes first (§0.7).
7. ‼️‼️ **ONE carrier account serves EVERY environment (dev, UAT, prod).** A number goes back to the carrier ONLY if
   `VoiceNumberAsset.PurchasedHere` is true — set ONLY by `VoiceNumberPurchaseService.ConfirmAsync` on PROOF that our
   own order rented it (our order call answered success, or Telnyx found the order by OUR reference). Ownership
   alone ("the account rents it", Plivo's lookup, the carrier listing) is never proof. See §3.5.

## 1. Data

SystemData, partition `voiceinv_{carrier}` (`voiceinv_telnyx`, `voiceinv_plivo`) — one partition per stamp.

| Document | Id | What it is |
|---|---|---|
| `VoiceNumberAsset` | `vnasset_{e164}` | One number this platform rents (or once rented) |
| `VoiceNumberRequest` | `vnreq_{kind}_{businessId}` | The business's ONE request of that kind. The fixed id is the "one at a time" rule, and the STORE enforces it |
| `VoiceNumberDailyCounter` | `vncount_{yyyy-MM-dd}` | Purchases admitted that UTC day (atomic increment) |

**Asset status:** `Purchasing` · `Available` · `Assigned` · `Quarantined` · `Returning` · `Returned` ·
`NeedsReview`. (`Reserved` was removed.) *Idle* = `Available` or `Quarantined`: rented and held by nobody.

**Review reason** (why an idle number is out of the open pool, or held for a person):

| Reason | Stays idle? | Who may take it | Notes |
|---|---|---|---|
| `AboveCap`, `PriceUnknown` | yes | nobody | Recomputed on every carrier read; cleared when the price is back in range |
| `ForwardingNotProvenOff` | yes | only its last business | Own-number mode ended without proof; never kept, returned before renewal |
| `ReservedForLastBusiness` | yes | only its last business, or an admin override | An admin **parked** it. Pinned (`keepForReuse`) in the same write. Un-keeping ends the park. Released when its business closes |
| `UnknownToUs`, `MissingAtCarrier`, `PurchaseUnresolved`, `RenewalDateUnknown` | no → `NeedsReview` | nobody | A person decides; nothing automatic touches it |

**Request kinds:** `Setup`, `ForwardingChange`, `SpecificNumber`, `ServiceEnd`.
**Request status:** `Open, Queued, Purchasing, CheckingCarrier, Applying, NeedsAdmin` (open) ·
`Completed, Applied, Declined, Withdrawn, Cancelled, Failed` (finished — kept a year as history).
`AdminReason` is derived: status `NeedsAdmin` + `LastFailureCode` parsed as `VoiceNumberAdminReason`.

**Index facts (CosmosContainerPolicies.SystemData):** `/type`, `/status`, `/createdAt`, `/dueAt` are indexed;
the two admin lists sort on the existing composite `(type ASC, createdAt DESC, id DESC)`; due work sorts on
`dueAt` alone. `country`, `e164`, `kind` are NOT indexed — they are residual filters inside the one partition.
`dueAt` is written ONLY on a record with pending work (`NullValueHandling.Ignore`).

**ETag rule:** every repository write hands back THE INSTANCE IT WAS GIVEN carrying the stored ETag, so
"record the attempt, then record its outcome" works on one instance. A stale copy loses with 412.

## 2. Who runs where

| Piece | Host | Does |
|---|---|---|
| `VoiceNumberAllocationService` | API | Provider choices / confirm, requests, admin queue, inventory list, keep, manual return; `ApplyAssignmentAsync`, `FallBackToAdminAsync`, `CancelSetupAsync` (also called by the worker and the job) |
| `VoiceAssistantService` (`.Numbers.cs`) | API | Admin quote / assign / remove / change / release; submit adopts the owner's phone |
| `VoiceNumberOperationProcessorFunction` | Functions, queue `voice-number-operations` | Buys and assigns; reconciles an order; resumes an assignment |
| `VoiceNumberLifecycleFunction` → `VoiceNumberLifecycleService` | Functions, hourly timer `VoiceNumbers:LifecycleSchedule` | Carrier read → due work → keep-or-return → daily checks → balance |
| `VoiceNumberCoordinator`, `VoiceNumberPurchaseService`, `VoicelineProjector`, `VoiceNumberBillingGate`, `VoiceNumberAlerts`, `VoiceNumberNotifier`, `VoiceNumberLimits` | both | Registered by `AddVoiceNumberLifecycle` |

‼️ `AddVoiceNumberLifecycle` does not register the repositories the coordinator needs from elsewhere
(`IVoicelineRepository`, `IVoiceAssistantNumberAuditRepository`, **`IVoiceBusinessLiveCallRepository`**,
`IBusinessProfileRepository`). The API host once shipped without the live-call one and could not start.
**Only booting the real host proves composition** — run an integration test of each host after any change here.

## 3. Flows

### 3.1 Getting a number
- **Submit.** In dedicated mode the form never carries the number we ring. The server adopts the PRIMARY
  OWNER's confirmed phone (SQL) at submit — and holds it to `VoiceForwardingTargetRules` (own country, right
  length, not a premium prefix, not a Clinket line, not a platform number). No confirmed phone ⇒
  `Error_VoiceAssistantForwardingTargetUnverified`; a confirmed phone we may not ring ⇒
  `Error_VoiceAssistantOwnerPhoneNotUsable`. An unfinished draft still names what it lacks first.
- **Team-led** (self-service off, or the Plivo stamp): submit creates the business's setup request as
  `NeedsAdmin` (`AllocationDisabled` / `CarrierAdminLed`) so it is in the admin queue at once. An admin
  assigning a number completes it.
- **Self-service** (`SelfServiceAllocationEnabled` and Telnyx): `GetChoices` — pool first (previous holder
  first, then locality, then area code), carrier search only when the pool has nothing. `ConfirmChoice`
  creates the request (fixed id; same `requestId` + same number = the same request, anything else is a
  conflict), then either claims a pool number and applies it, or queues a purchase.
- **Worker.** Re-checks live billing and that the business is still waiting, then `PurchaseAsync`:
  daily counter +1 (over the stop level ⇒ −1 and refuse) → fresh quote → asset created `Purchasing` → request
  upserted `Purchasing` → ONE carrier order. `success` ⇒ assign. `pending`/unknown ⇒ parked as
  `CheckingCarrier`, a follow-up check scheduled (`PendingOrderRechecks` × `PendingOrderRecheckSeconds`,
  doubling), the hourly job behind it. Checks exhausted ⇒ the asset is held for review off the business and
  the request goes to the team.
- **A confirmation that arrives late** is honoured only while the record is still this business's
  (`CanConfirmFor`); otherwise the business goes to the team and the number stays where it is.
- **Apply** writes the profile (refused if the business stopped waiting — the number then goes back to the
  pool quietly), the line, the minute grant, then completes the request and only then notifies.

### 3.2 An admin removes a number
`RemoveNumberAsync` → `DetachAsync` with `NextNumberFromTeam`: the inventory lets go (generation +1), a setup
request `NeedsAdmin`/`RemovedByAdmin` closes the provider's own picker, the profile goes `NumberPending`, the
line is freed, one audit row and one notice. The provider's status carries `lastRemoval` (which number, when,
why, whether a person did it). The picker reopens only when an admin assigns a number or closes the request.
The gate survives a rejection, a cancellation and a service end.

Release choices: **Returned** (back to the pool; reuse wait by billing history — a trial-only business frees
it at once, a paid one waits `PaidQuarantineDays`) · **Parked** (reserved for this business and kept; see
`ReservedForLastBusiness`) · **Released** (given back to the carrier now).

### 3.3 The AI service ends
Billing calls `OnServiceEndedAsync` from the one place every switch-off passes. A `ServiceEnd` request holds
the number until `DetachAt` (= now + `HoldHours`) and the provider is told that exact time. Paying inside the
hold cancels it (`OnServiceRecoveredAsync`). When it runs out the hourly job asks SQL again: live ⇒ recovered;
settling or unreadable ⇒ wait an hour; ended ⇒ the number comes off.

### 3.4 The hourly job
1. **Carrier read** — one pass over the inventory. Updates price/renewal facts (a write only on a change);
   imports a number we never recorded as `UnknownToUs`; a number we call `Returned` that is listed again is
   held for a person; a number absent from TWO complete listings in a row is gone — it comes off its
   business properly; one absence is only noted. A number bought minutes ago is not expected in the listing
   (`CarrierListingGraceMinutes`).
2. **Due work** — bounded (`MaxDueRecordsPerRun`), oldest first. Holds that ran out; setups left `Open`,
   `Queued`, `Applying`, `Purchasing`, `CheckingCarrier`; returns in flight. Anything else carrying a due time
   has it cleared so it is not read every hour.
3. **Keep or return** (only after a COMPLETE listing, and only when `AutomaticReturnEnabled`) — pinned
   numbers are kept; reusable ones fill the buffer (`IdleNumberBuffer`); the rest are returned once their
   return time has passed (`RenewalBoundary − BoundarySafetyHours − ReturnLeadHours`). Telnyx renews on the
   1st of each month (UTC); Plivo publishes a date per number; no date ⇒ held for a person, never guessed.
4. **Daily checks** — numbers assigned to a business that no longer holds them or no longer has a service;
   yesterday's carrier charges against what we recorded; on the 1st, last month's summary.
5. **Balance** — rent falling due soon against the carrier balance.

### 3.5 The shared carrier account — who may give a number back (4 October 2026)

Dev, UAT and prod rent from ONE Telnyx account and ONE Plivo account. Deleting a number another environment
uses breaks its live line, so returning is fenced at four layers:

1. **The fact.** `purchasedHere` (absent = false). Set true only on proof: `ConfirmAsync` with
   `ProofOfOrder.OurOrderAnswered`, or our own order call answered "pending" (India answers that while compliance
   runs; a pending order settled later by the listing keeps it). Telnyx proof compares each order's OWN
   `customer_reference` to ours exactly — the carrier's filter is never trusted. A weaker later answer never takes it back. Ownership-only confirmations
   (Plivo's `FindOrderAsync`, "the carrier knows no order of ours yet rents the number", a re-run that finds the
   number owned) assign the number but leave it false and raise `VoiceNumberOwnershipUnproven`. A `Returned`
   record reopened for a new order starts false again.
2. **The carrier read withdraws it** when the listing shows a different rental of the same digits
   (`VoiceCarrierRental.IsDifferentRental`: another carrier id, or another purchase moment), when a `Returned`
   number reappears, when a `MissingAtCarrier` number comes back, or when an unconfirmed order is listed.
3. **Every return path checks it before writing `Returning`:** keep-or-return skips not-ours numbers (always
   kept, and the offerable ones fill the buffer); `RetryReturnAsync` holds a not-ours `Returning` record as
   `NeedsReview`/`UnknownToUs` + `VoiceNumberReturnRefused`; admin **Return now** refuses
   (`Error_VoiceNumberNotPurchasedHere`); **Remove/Change "Released"** refuse BEFORE the business loses its
   number; **release after cancel** detaches a not-ours number to OUR pool and never calls the carrier.
   ‼️ `ReturnToCarrierAsync` also returns ONLY the number that business just let go: unassigned,
   `LastBusinessId` = that business, written `Returning` conditionally on the record it read. A stale profile
   pointer, a failed detach, or another business claiming the number in the gap ⇒ nothing is sent (audit H1).
4. **The gate and the carrier services.** `IVoiceNumberCarrierReturn` (`VoiceNumberCarrierReturn`) is the ONLY
   caller of `IVoiceNumberProvider.ReleaseNumberAsync(asset)` — a convention test in BOTH the API and Functions
   repos fails the build on any other call. It refuses (`Refused` + alert). Telnyx and Plivo throw before any
   HTTP; Telnyx deletes only the carrier id WE recorded (no recorded id ⇒ `carrier-id-unknown`, wait for the
   hourly read; listed under another id ⇒ `carrier-id-changed`, never deleted); Plivo GETs the number first and
   refuses another `added_on`, another application, or an `added_on` day on/after the day the return began
   (`added_on` is a DAY, so a same-day re-rental cannot be told apart) — `carrier-rental-changed`.

**Residuals the owner knows about.** Plivo environments share one application id by default (`deploy.ps1`
`PlivoApplicationId` empty ⇒ appsettings), so the application check adds nothing until each environment gets its
own. A number bought and returned the SAME day on Plivo is refused and released by hand. An order whose proof
arrives after its record moved to another business stays not-bought-here (rent leak, never a wrong return).

**Using a number not bought here.** `POST admin/voice-numbers/inventory/{e164}/use-here` turns a `NeedsReview` +
`UnknownToUs` number into `Available` (still not bought here). It can then be assigned, changed and removed like
any other — removal only to the pool or a park. A number we never bought holds nothing back by its price
(price review reasons apply only to numbers we bought). Calls reach whichever environment the number's carrier
connection points to; assigning never changes that.

Records written before 4 October 2026 carry no `purchasedHere`: they read as NOT bought here. A number dev really
bought before then is released by hand in the carrier console.

## 4. Things that went wrong, so they are rules

- A test double must behave like the real store. Two fakes set the ETag on the written instance while the real
  repository did not: every second write would have failed in production. The production code was fixed to
  match, and an integration test now proves it on the emulator.
- The emulator runs a sorted query no composite covers, and treats the page size as a hint. Production does
  neither. Pin the SQL text in a unit test; `ReadPageAsync` FILLS a page (a short page with a token is legal)
  and never trims an over-full one.
- A request with no due time and an open status is stranded. Every open setup request carries a due time
  from its first write (`ResumeDeadline`), and the hourly job handles EVERY open status.
- Work in flight is due only after it has had time to finish. Due "now", the hourly job ran an assignment a
  second time beside the first.
- A decision is made on the record that was read. `FallBackToAdminAsync(..., known: request)` hands over
  THAT record conditionally; re-reading let the hourly job overwrite a purchase the worker had just started.
- "Who still waits" is read at the moment of the hand-off, not from a profile read before a carrier call.
- Keeping is a decision about an UNUSED number: a claim clears the pin; a pin is set in the same write as
  the detach that needs it.
- An idle number carries NO due time (the hourly job reads idle numbers by status). Due times on idle
  numbers starved the bounded due-work read.
- A refusal is thrown as a localization KEY. A key missing from the catalogue becomes a 500 — the convention
  test `EveryThrownRefusalKeyHasASentenceInEveryLanguage` scans for it.
- ‼️ An approval to buy above the cap NAMES A PRICE. `AssignVoiceNumberDto` / `ChangeVoiceNumberDto` carry
  `ApprovedMonthlyRental` + `ApprovedSetupFee`; `VoiceNumberPriceApproval.Covers(quote)` is checked against
  the quote taken a moment before the order, and a dearer one is refused (`Error_VoiceNumberPriceChanged`).
  A yes/no flag (`ConfirmPurchase`, deleted) was sent by a screen on EVERY purchase and would have bought any
  price that drifted above the cap. An unreadable price is never lifted by anything.
- A sentence is written for the person who reads it. The three purchase refusals on the admin assign path
  said "our team will arrange one for you" to the admin; they now say what was not bought and what to do.
- A test that injects the "other writer" at the wrong moment proves nothing. Break the fix and watch the test
  fail before trusting it (the sabotage round found two tests that passed against broken code).

## 5. Settings (`VoiceNumbers`, both hosts, class defaults mirror appsettings)

`SelfServiceAllocationEnabled` (false) · `AutomaticReturnEnabled` (false) · `MaxMonthlyRental` / `MaxSetupFee`
(1.00) · `RateCurrency` (USD) · `ChoiceLimit` / `MaxChoiceLimit` · `HoldHours` (24) ·
`TrialOnlyQuarantineDays` (0) / `PaidQuarantineDays` (15) · `ReturnLeadHours` (24) / `BoundarySafetyHours`
(14) · `PurchaseWarningPerDay` (10) / `PurchaseLimitPerDay` (25) / `IdleNumberBuffer` (10) — these three are
also editable by an admin without a deploy (`IVoiceNumberLimits`, null = the deployed default) ·
`RequestCooldownMinutes` / `RequestsPerDay` · `MaxReturnAttempts` / `MaxSetupAttempts` ·
`ReservationMinutes` (how long a setup in flight has before the hourly job takes it over) ·
`PendingOrderRechecks` / `PendingOrderRecheckSeconds` · `CarrierListingGraceMinutes` · the TTL days ·
`MaxDueRecordsPerRun` · `MaxCarrierPages` · `DailyChecksHourUtc` · `BalanceLookaheadDays`.
Trigger-level: `VoiceNumbers__LifecycleSchedule` and `ServiceBusSettings__VoiceNumberOperationsQueueName`
(local.settings + deploy.ps1 + ARM `events.json`).

## 6. Alerts and notices

Admin alert types (each deduplicated by a deterministic event id): `VoiceForwardingChangeRequested`,
`VoiceSpecificNumberRequested`, `VoiceNumberSetupNeedsAdmin`, `VoiceNumberSelfServiceCompleted`,
`VoiceNumberPurchaseWarning`, `VoiceNumberPurchaseLimitReached`, `VoiceNumberReturnFailed`,
`VoiceNumberReturnMissed`, `VoiceNumberNeedsReview`, `VoiceNumberRenewalDateUnknown`,
`VoiceNumberChargeMismatch`, `VoiceCarrierBalanceLow`, `VoiceNumberMonthlySummary`. The application alert
(`VoiceAssistantApplicationSubmitted`) is RESOLVED when the application is answered (approved, rejected,
cancelled or given a number). Both admin apps read the alert TYPE LIST from `GET admin/alerts/types`
(`Enum.GetNames<AdminAlertType>()`); neither keeps a copy.

Plus (4 October 2026) `VoiceNumberReturnRefused` (a return reached the gate for a number not bought here — Critical) and
`VoiceNumberOwnershipUnproven` (a number used here that Clinket will never return; its rent continues).

Provider notices: `VoiceForwardingChangeDeclined`, `VoiceForwardingNumberChanged`,
`VoiceNumberBeingArranged`, `VoiceNumberHeld`, plus the existing assigned / removed / changed ones.
"We're arranging your number" is never sent to a business that stopped waiting.

### Trial and switch-off notices (2026-10-02)

- An AI switch-off that holds a number sends ONLY the number's hold notice on every channel: `DowngradeAddOnAsync` asks
  `NumberNoticeTellsSwitchOffAsync` (the same conditions `CompleteAddOnDowngradeAsync` holds the number under) and sends its
  billing notice with `SkipEmail` + `SkipInApp` — the admin alert still fires.
- The hold notice's email and WhatsApp buttons open `/dashboard/ai-billing` (WhatsApp `clinket_ai_number_on_hold`); the trial
  warning with a number at stake is `clinket_ai_number_trial_ending`. The old `clinket_ai_number_held` / `_at_risk` are deleted.
- A hold that ran out is a RELEASE (`VoiceNumberReleased`), not a team removal; team removals carry their reason sentence.
- The trial reminder, auto-renewal-off notice and trial-ending email name the number and the release day in every channel.
  Details: clinqet-payments "Trial reminders and trial messages".

## 7. Endpoints and screens

`UI-CONTRACT.md` is the contract for all four apps. Provider: `api/v1/voice-assistant/number/*`
(`voice.read` / `voice.number.manage` with the live check). Admin: `api/v1/admin/voice-numbers/*` plus the
existing `admin/voice-assistant/{businessId}/*` number endpoints. Machine-readable refusals:
`VoiceNumberErrorCodes.ForMessageKey`. Provider web rules: `clinqetwebpartnerapp/src/lib/voiceNumber/numberRules.js`;
provider app: `clinqetmobilepartnerapp/src/Screen/ProfileFlow/VoiceAssistant/number/`; admin web:
`clinqetwebadmin/src/pages/voice/`; admin app: `clinqetmobileadminapp/src/components/voice/`.

Screen rules that were each a defect in review (all in `UI-CONTRACT.md`; keep web and app the same):

- `Open` is polled like `Queued`. A confirm can answer `Completed` at once (a number we already hold is
  assigned inside the call): treat the answer as a read and re-read state.
- A confirm with no answer keeps its id, LOCKS the chosen number and WATCHES that id; it never sends a second
  confirm with a new id.
- An `outcome` the build does not know is the error state, never "our team is arranging your number".
- An open specific-number request and its Withdraw are drawn under EVERY view of the getting-a-number screen.
- A plain 400 on confirm, like "superseded", re-reads state and status.
- The trial end is a day (as on the billing page). The removal card reads: when, why, what it means, who.
- A draft saved in own-number mode never shows that phone as the one a dedicated number will ring.
- With a number in own-number mode there is no ring card, so the screen itself says when the number status
  could not be read.
- The recommended choice is ordered first BEFORE the limit cuts the list.

## 8. Tests (§0.18 — a library class is tested from the host that runs it)

| Suite | Where |
|---|---|
| Coordinator, purchase, lifecycle (carrier read, due work, keep-or-return), projector, billing gate, alerts, processor function, timer function | `Clinqet.Communications.UnitTests/Voice/Numbers`, `…/Functions` — real services over `FakeVoiceNumberInventory` (real ETag semantics) and `ScriptedCarrier` |
| Allocation service, admin number flows, controllers, query shape + page fill, refusal-key convention | `Clinqet.API.UnitTests/Services/Voice`, `…/Controllers`, `…/Repositories`, `…/Conventions` |
| Real emulator + SQL Server: repository (ETag, atomic counter, due work, lists, partition isolation, stored shape), coordinator (12 businesses race one claim), billing gate, worker (redelivery, pending order, daily limit under a race), hourly job | `Clinqet.Communications.IntegrationTests` — `Helpers/VoiceNumberSandbox.cs` gives each test its own SystemData container built from the PRODUCTION policy |
| Real HTTP pipeline: self-service pick → admin removal → provider sees it → picker closed → admin closes → picker open; team-led queue; isolation; permissions; inventory; alert types | `Clinqet.API.IntegrationTests/Controllers/VoiceAssistantControllerIntegrationTests.NumberLifecycle.cs` (a second host with self-service on) |

Clocks are passed in (`RunAsync(nowUtc, …)`); nothing sleeps. To sabotage a file for a test: copy it to the
session scratchpad, change it, copy it back, **touch it**, rebuild — a restored copy keeps its old timestamp
and the build will reuse the broken binary.

## 9. Before you change anything here

- [ ] Read `FINAL-DESIGN.md` §6–§9 and the flow you are touching in this file.
- [ ] Does the change add a field, an index path or a document family? Stop and ask the owner (§0.7).
- [ ] Every new path: who claims, with which generation is it projected, what is recorded before the carrier?
- [ ] What happens if the host stops after each write? Which job picks the record up, and by what due time?
- [ ] What does a redelivered queue message do? What do two instances of the hourly job do?
- [ ] Any new refusal key is in all five catalogues; any new provider sentence has no technical word.
- [ ] Unit tests in the host that runs it, an integration test on the real engine for anything that depends
      on ETags, the counter, a sorted query or SQL, and one run of a real-host integration test.
- [ ] Update `UI-CONTRACT.md` and all four apps in the same session if a shape or a state changes.
