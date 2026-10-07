# UI contract — AI Assistant number lifecycle

**2 October 2026 (amended the same day after the audit — parked numbers, the owner-phone refusal; and again
after the four screen reviews — the price an admin approves, what a timed-out or already-finished confirm
does, an answer the screen does not know, the open request under every view).** The one
contract the four screens build against: provider web, provider app, admin web,
admin app. It states what the server sends, what each screen must draw for it, and where each sentence comes
from. Authority order is unchanged: `DECISIONS-2026-10-01.md` → `FINAL-DESIGN.md` → this file → the mockup.

Every response is the standard envelope `{ success, data, message, errors, errorCode }`. JSON is camelCase.
Enums are strings. Times are UTC ISO strings; a screen shows them in the device's own zone **with the zone named**.

---

## 1. Provider endpoints

Base: `api/v1/voice-assistant`.

| Call | Permission | Returns |
|---|---|---|
| `GET /` | `voice.read` | `VoiceAssistantStateDto` (existing) — now also `forwardingCountry` |
| `PUT /application` | `voice.settings.manage` | state |
| `POST /application/submit` | `voice.settings.manage` | state |
| `GET /number/status` | `voice.read` | `VoiceNumberStatusDto` |
| `GET /number/choices` | `voice.number.manage` (live check) | `VoiceNumberChoicesDto` |
| `POST /number/choices/confirm` | `voice.number.manage` | `VoiceNumberRequestDto` |
| `POST /number/forwarding-change` | `voice.number.manage` | `VoiceNumberRequestDto` |
| `POST /number/specific-number` | `voice.number.manage` | `VoiceNumberRequestDto` |
| `POST /number/requests/{kind}/withdraw` | `voice.number.manage` | `VoiceNumberStatusDto` (`kind` = `ForwardingChange` or `SpecificNumber`) |

### Shapes

```
VoiceAssistantStateDto (additions only)
  forwardingCountry: { iso, callingCode, nationalNumberLength } | null   // null ⇒ a country we do not serve

VoiceNumberStatusDto
  selfServiceAvailable: bool
  holdHours: int                      // how long a number is kept after the service ends
  requests: VoiceNumberRequestDto[]   // at most one per kind
  lastRemoval: VoiceNumberRemovalDto | null   // ONLY while status is NumberPending, no number, and the business had one

VoiceNumberRemovalDto
  e164                     // the number that was removed
  removedAt                // UTC
  reason?                  // ProviderRequested | NumberIssue | Reassigned | Compliance | SpamFlagged | ServiceAreaChange
                           // | CarrierMigration | BillingIssue | AssignedInError | ServiceEnded | Other
  reasonText?              // the reason as a sentence, ALREADY in the reader's language — show it as-is
  removedByTeam: bool      // true ⇒ a person on our team removed it. false ⇒ it came off by itself: the service
                           // ended (reason ServiceEnded), or the number stopped working at the phone company
                           // (reason NumberIssue)

VoiceNumberRequestDto
  kind:   Setup | ForwardingChange | SpecificNumber | ServiceEnd
  status: Open | Queued | Purchasing | CheckingCarrier | Applying | NeedsAdmin
          | Completed | Applied | Declined | Withdrawn | Cancelled | Failed
  requestId, e164?, requestedTarget?, requestedText?, requestNote?
  providerReason?          // already a provider-safe sentence written by our team
  adminReason?             // NoEligibleNumber | PriceAboveCap | PriceUnknown | CurrencyMismatch | DailyLimitReached
                           // | CarrierFailure | PurchaseUnresolved | AllocationDisabled | CarrierAdminLed | NumberTaken
                           // | RemovedByAdmin
  createdAt, completedAt?, detachAt?, entitlementEndedAt?
  canWithdraw: bool

VoiceNumberChoicesDto
  outcome: Ready | AlternateArea | NeedsAdmin | AdminLed | NotEntitled | ForwardingTargetUnverified
  choices: [{ e164, locality?, region?, country, recommended, fromPool }]
  choiceLimit: int
  trialEndsAt?: datetime

POST choices/confirm      { requestId (8–64 chars), e164 }
POST forwarding-change    { requestId, nationalNumber, expectedCurrentTarget? }
POST specific-number      { requestId, requestedText (2–60), note? (≤ 400) }
```

"Open" below means one of `Open, Queued, Purchasing, CheckingCarrier, Applying, NeedsAdmin`.

### Refusals a screen draws as its own state

A refusal is HTTP 400 with the server's already-translated sentence in `message`. Where the screen needs to
branch, the response also carries `errorCode`. **Show the server's `message`; never re-word it.**

| `errorCode` | Meaning | What the screen does |
|---|---|---|
| `voice_number_taken` | The chosen number was just taken | Amber notice with the message, re-read choices, new `requestId` |
| `voice_number_request_open` | A request of this kind is already open | Re-read `/number/status` and draw the open request |
| `voice_number_request_limit` | Cooldown or daily limit | Limit state: the message, no retry button, the current number unchanged |
| `voice_number_forwarding_stale` | The saved number changed while the request was open | Close the dialog, re-read state, amber "out of date" notice |
| `voice_number_self_service_unavailable` | Self-service is off for this region | Re-read choices; draw "our team is arranging your number" |
| `voice_number_service_not_active` | No live AI Assistant plan or trial | "Activate AI Assistant first" with the plan button |
| `voice_forwarding_target_unverified` | The business owner's phone is not confirmed (on submit) | "Confirm your business phone" with a button to contact details |
| `permission_denied` (HTTP 403, existing) | The member may not manage numbers | Permission state: "Ask your business owner for permission…" |
| `voice_number_request_decided`, `voice_number_request_not_found` | A withdraw arrived after our team decided, or after the request ended | Show the message, re-read `/number/status` |
| `voice_number_assignment_superseded` | The number changed while something was being saved | Show the message, re-read state and `/number/status` |

Any other 400: show `message` at the field or as a notice. On `POST choices/confirm` a plain 400 usually means
the screen is out of date, so also re-read state and `/number/status`. 5xx or no network: the error / offline state.
`GET /number/choices` can answer 400 when the number search itself failed ("we couldn't look up available
numbers just now"): draw the error state with that sentence and Try again — it is not "nothing available".

**A timeout is not a failure.** After `POST choices/confirm` times out, re-read `/number/status` with the
same `requestId` kept; never send a second confirm with a new id. The server treats the same id + same number
as the same request. Until the server gives a definite answer the chosen number is locked (no other can be
picked), and the unanswered id is **watched**: if a read shows that request `Completed` or `Cancelled`,
re-read state once; `Failed` ⇒ "Please choose again", fresh choices, a new id.

**A confirm can answer already finished.** For a number we already hold the server assigns it inside the
confirm call, so the answer may be `Completed` (or `Cancelled`). Treat the answer as a read of that request:
re-read state once — never leave the picker on screen.

---

## 2. Provider rendering rules (web and app draw the same thing)

`va` = state, `ns` = number status, `R(kind)` = the request of that kind in `ns.requests`, if any.

### 2.1 The setup form (status `Invited`, `Draft`, `Rejected`)

- **Dedicated number mode: the "number to reach you on" is no longer typed and no longer sent.** Send
  `forwardingTarget: null`. Remove every effect that copies the signed-in user's profile phone into the field.
  The server sets it at submit from the business owner's confirmed phone.
- Show it read-only: the saved number when `va.application.forwardingTarget` exists **and the saved
  `numberMode` is not `ForwardExisting`**; otherwise a plain line — "We'll ring the business owner's confirmed
  phone number." (A draft saved in own-number mode holds that phone; the server drops it the moment the draft
  is saved as a dedicated number, so it is never shown as the number a dedicated line will ring.)
- Submit refused with `voice_forwarding_target_unverified` ⇒ the "Confirm your business phone" state.
- Submit can also be refused with **no** `errorCode` and the sentence "We can't ring the business owner's
  phone number from this assistant…": the owner HAS confirmed a phone, but it is one the assistant may not ring
  (another country, a premium line, one of our own numbers). Show the sentence as sent, as any other 400 — it
  is not the "confirm your phone" state, because confirming again would change nothing.
- Own-number mode is untouched: its wizard, its "Change", its test call.

### 2.2 Getting a number (status `Submitted` or `NumberPending`, no `assignedNumber`)

Read `/number/status`. **First: `ns.lastRemoval`.** When it is present the business HAD a number and it was
taken off. That fact is drawn before anything else on this screen — a provider who opens the page and sees only
"choose a number" or "our team is arranging your number" has not been told the one thing that changed.

**The removal card** (amber, at the top, not dismissible while it applies):

- Heading: "Your number {e164} is no longer connected" — the number in full, copyable.
- When: `removedAt` as date + time + zone.
- Why: `reasonText`, shown exactly as sent.
- What it means, in plain words: "Calls to this number are no longer answered by your assistant." If
  `va.application.numberMode` is `ForwardExisting` add: "If your phone company still sends your calls to it,
  turn that off so your callers reach you."
- Who, in one line, chosen in this order:
  - `reason` is `ServiceEnded` ⇒ "It was released because your AI Assistant service ended." and the card's
    button is "View plan options" → billing.
  - `removedByTeam` true ⇒ "Our team removed this number."
  - otherwise (it came off by itself, e.g. `NumberIssue`) ⇒ no "who" line: `reasonText` already says why, and
    the provider is not at fault. Add: "You can choose a new number below." when the picker follows.
- The next step is whatever follows below the card.

Then, below the card, in this order:

| Condition | Draw |
|---|---|
| `R(Setup)` is `Queued`, `Purchasing`, `Applying` or `Open` | **Setting up your number** — the number, a short step list, "You can leave this page. We'll let you know when it's ready." Poll (`Open` exists only inside the confirm call itself; a screen that ever reads it draws the same card and reads again as for `Queued`). |
| `R(Setup)` is `CheckingCarrier` | **We're checking your number** — same card, plus an amber notice: the request is still in progress, please don't start another. Poll. |
| `R(Setup)` is `NeedsAdmin` with `adminReason` `RemovedByAdmin` | **No picker, and NOT "we're arranging your number"** — that would promise something nobody decided. Say: "Your next number will come from our team. If you have questions, contact support." + the contact-support button. |
| `R(Setup)` is `NeedsAdmin` (any other reason) | **Our team is arranging your number.** When `adminReason` is `PriceAboveCap`, `PriceUnknown` or `CurrencyMismatch` add: nothing was bought. |
| No open setup request and `ns.selfServiceAvailable` is false | **Our team is arranging your number** (today's journey). |
| No open setup request and self-service is on | `GET /number/choices` and draw by `outcome` ↓ |

**Only an OPEN setup request drives a progress view.** A finished one (`Completed`, `Failed`, `Cancelled`,
`Withdrawn`) is history: it stays on the record for a year, so a business whose number was later removed still
carries an old `Completed` request. Treat every finished setup request as "no open request" and fall through.
The one exception is a request that turns `Completed`, `Failed` or `Cancelled` **while this screen is polling
it**: re-read state once. `Completed` ⇒ it is now `Active`. `Failed` ⇒ show the picker again with "Please
choose again". `Cancelled` ⇒ the business's own state changed meanwhile (the service ended, or our team
rejected, paused or gave it another number): draw whatever the re-read state says, with no error.

**Call `GET /number/choices` only in status `Submitted` or `NumberPending`.** In any other status the server
refuses it (400).

| `outcome` | Draw |
|---|---|
| `Ready` | The picker. Up to `choiceLimit` numbers, the `recommended` one first and pre-selected, each with its area (`locality`, `region`). One primary button: continue with this number. |
| `AlternateArea` | The picker plus a blue notice: nothing near the business, these are other areas in the same country. |
| `NeedsAdmin`, `AdminLed` | Our team is arranging your number. |
| any value this build does not know | The error state with Try again. **Never** "our team is arranging your number": that is a promise, and nobody made it. |
| `NotEntitled` | "Activate AI Assistant first" + the plan button. |
| `ForwardingTargetUnverified` | "Confirm your business phone" + the contact-details button. (A dedicated number with no phone on file to ring: nothing is offered or bought until there is one.) |

- Show the real count. One choice may be pre-selected; the provider still confirms.
- No carrier cost, ever, on a provider screen.
- No "refresh numbers" button. The list is re-read only after a refusal or when the screen is re-opened.
  In the app the screen is a tab that is never re-opened, so a state that sends the provider away to put
  something right ("Activate AI Assistant first", "Confirm your business phone", any refusal state) asks the
  choices once more each time a newer status answer lands (return to the screen, foreground, pull,
  notification). A list that is on screen is still never re-read.
- Under the picker: "Looking for a particular number?" → the specific-number request (a note to our team,
  no promise). `R(SpecificNumber)` open ⇒ a quiet "we're checking what's possible" line with Withdraw, **under every
  view of this screen** (progress, "from our team", "activate first", limit — not only under the picker): an
  open request and its Withdraw never vanish because the view above them changed.
  `R(SpecificNumber)` `Completed` **with** `providerReason` ⇒ a blue "Our team replied" notice carrying that
  sentence as sent, dismissible (remembered on the device by `requestId`), shown wherever the number section
  is — with or without a number. `Completed` without a reason draws nothing.
- `trialEndsAt` present ⇒ show the real trial end near the heading **as a day** (day, month, year — the same
  form the billing page uses for it). Setting up a number never restarts a trial.
- **Polling:** one owner per mounted screen, only while a setup request is `Open`, `Queued`, `Purchasing`,
  `CheckingCarrier` or `Applying`. Every 5 s for the first minute, then every 15 s, stop after 10 minutes
  ("still working — we'll let you know"). Pause when the tab is hidden, the app is in the background or the
  device is offline; resume with one immediate read. Abort the in-flight read on unmount. A notification of
  type `VoiceAssistantActivated`, `VoiceAssistantReadyToConnect` or `VoiceNumberBeingArranged` triggers one read.

### 2.3 With a number (status `Active` or `OnHold`, `assignedNumber` present)

**The number we ring you on — dedicated mode only** (`numberMode` is not `ForwardExisting`):

- Read-only field with a lock, and the line "For your security, our team reviews number changes."
- "Request a change" opens the request sheet. Needs `voice.number.manage`; without it the button is not shown.
- The sheet: the country stated plainly and not editable (`forwardingCountry`), one field for the national
  number (`nationalNumberLength` digits, telephone keypad, paste strips spaces, punctuation and a leading
  country code), the current number, and "Your current number stays in use while we review. This does not
  change your sign-in phone." The sheet **is** the confirmation — no second "are you sure".
- `forwardingCountry` null ⇒ no request button.

| `R(ForwardingChange)` | Draw |
|---|---|
| open | Blue notice: request sent, the requested number, "your current number still works". A "change pending" tag replaces the button. "Withdraw request" while `canWithdraw`. |
| `Declined` | Amber notice: not approved, `providerReason` when present, "your current number is unchanged". Dismissible; gone once a new request exists. |
| `Applied` | Green notice: the number we ring you on was updated. Dismissible. |
| `Withdrawn`, none | Nothing. |

Dismissal is remembered on the device, keyed by `requestId`.

**When the service ends** — from `R(ServiceEnd)`:

| Condition | Draw |
|---|---|
| open, `detachAt` in the future | **Held.** Amber: AI answering is off; your number is held until `detachAt` (date, time, zone). A two-point timeline (service ended → number removed). "What happens to calls" in plain words, by mode. One green button: keep my number → billing. |
| open, `detachAt` passed | **Checking.** "We're checking your latest payment. Your number stays held while we check." No deadline shown. |
| `Cancelled`, `completedAt` within 72 hours, number still assigned | **Recovered.** Green: your AI Assistant is active again; your number is still `assignedNumber`. Dismissible. |

**Removed** is no longer read from `R(ServiceEnd)`. It is `ns.lastRemoval` (§2.2), which covers every way a
number comes off — the service ending, our team removing it, the number failing at the phone company — and
survives the request record. The "View plan options" button belongs to `reason` `ServiceEnded` only.

Before the service ends, the removal moment is not known: say "{holdHours} hours after your service ends",
never a date.

**The number itself.** Tapping or long-pressing the assigned number offers Copy (and, in the app, Share through
the native sheet). There is always a visible "number actions" control for the same thing.

### 2.4 States every provider surface has

Loading (skeleton, no layout jump) · error with Try again ("your saved number has not changed") · offline
("nothing was sent") · permission denied · limit reached · empty.

With a number, the "number we ring" card carries the error state. In own-number mode there is no such card,
so the screen itself shows one notice ("We couldn't load this" / "You're offline", with Try again) when
`/number/status` cannot be read — otherwise a held or recovered notice would be missing with nothing to say so.

### 2.5 Notifications

Four new types reach the provider: `VoiceForwardingChangeDeclined`, `VoiceForwardingNumberChanged`,
`VoiceNumberBeingArranged`, `VoiceNumberHeld`. Each opens the AI Assistant settings screen, has an icon and
appears wherever the app lists notification types. Title and body arrive already translated.

---

## 3. Admin endpoints

Base: `api/v1/admin/voice-numbers` (role `Admin`).

| Call | Returns |
|---|---|
| `GET /requests?kinds=Setup&kinds=ForwardingChange&kinds=SpecificNumber&openOnly=true&limit=25&continuationToken=` | `{ items: AdminVoiceNumberRequestDto[], continuationToken? }` |
| `GET /requests/{businessId}` | `AdminVoiceNumberRequestDto[]` — every request that business holds, finished ones included |
| `POST /requests/{businessId}/forwarding-change/decide` | `{ approve: bool, verificationMethod?, verificationReference? (≤120), providerReason? (≤300), expectedOldTarget? }` → request |
| `POST /requests/{businessId}/specific-number/resolve` | `{ providerReason? (≤300) }` → request |
| `POST /requests/{businessId}/setup/close` | no body → request (`Cancelled`). Only a setup request that is `NeedsAdmin`; one being bought or applied answers 400 with a sentence to show. |
| `GET /inventory?status=&country=&search=&idleOnly=&limit=&continuationToken=` | `AdminVoiceNumberInventoryDto` |
| `POST /inventory/{e164}/keep` | `{ keep: bool, reason (3–300) }` → asset |
| `POST /inventory/{e164}/return` | asset (incident use). 400 `Error_VoiceNumberNotPurchasedHere` for a number this environment did not buy |
| `POST /inventory/{e164}/use-here` | asset. Only `NeedsReview` + `UnknownToUs`, unassigned, not bought here ⇒ `Available`, still never returned. Otherwise 400 `Error_VoiceNumberNotUsableHere` |

`{e164}` is URL-encoded (`%2B1905…`).

```
AdminVoiceNumberRequestDto
  kind, status, businessId, businessName?, requestId, actorId?
  e164?, expectedOldTarget?, requestedTarget?, requestedText?, requestNote?, numberMode?
  adminReason?, quotedMonthlyRental?, quotedSetupFee?, quoteCurrency?
  createdAt, decidedAt?, decidedBy?, completedAt?
  verificationMethod?  (VerifiedCallback | AdminAssistedChallenge | CarrierRecord | DocumentEvidence)
  verificationReference?, providerReason?
  attemptCount, lastFailureCode?
  entitlementEndedAt?, detachAt?, billingHistoryClass? (TrialOnly | PaidHistory | Unknown)

AdminVoiceNumberInventoryDto
  items: AdminVoiceNumberAssetDto[], continuationToken?
  idleNumberBuffer, automaticReturnEnabled, purchasesToday, purchaseWarningPerDay, purchaseLimitPerDay

AdminVoiceNumberAssetDto
  e164, carrier (Telnyx | Plivo), country, region?, locality?
  status (Purchasing | Available | Assigned | Quarantined | Returning | Returned | NeedsReview)
  reviewReason? (UnknownToUs | MissingAtCarrier | ForwardingNotProvenOff | AboveCap | PriceUnknown
                 | PurchaseUnresolved | RenewalDateUnknown | ReservedForLastBusiness)
  assignedBusinessId?, lastBusinessId?
  monthlyRental? (null = unknown, never zero), currency?
  nextRenewalDate? (date only), renewalBasis (Unknown | CarrierRenewalDate | CarrierCalendarMonth)
  returnTargetUtc?, quarantineUntil?
  keepForReuse, keepReason?, keptBy?, keptAtUtc?
  returnAttempts, lastFailureCode?, reconciledAt?
  purchasedHere   (false or absent ⇒ never returned to the carrier, by any path)
```

Refusal codes: `voice_number_forwarding_stale` (the saved number moved — refresh, do not overwrite),
`voice_number_request_decided` and `voice_number_request_not_found` (another admin handled it — refresh).

**A page may be empty and still carry a token.** Draw "Nothing on this page" and keep **Load more**; "nothing
waiting" is said only when there is no token.

**Buying a number (assign / change).** `GET …/voice-assistant/{businessId}/number-quote` returns
`monthlyRental?`, `setupFee?`, `currency?` (the carrier's own decimals; null = unknown, never zero),
`tooExpensive`, `priceUnknown`, `maxMonthlyRental`, `maxSetupFee`, `rateCurrency`. The old
`…CostMinor` fields and the `confirmPurchase` flag no longer exist.

‼️ **A purchase above the limit carries the price the admin approved.** `POST …/assign-number` and
`…/change-number` take `approvedMonthlyRental` and `approvedSetupFee`. Send them **only** when the quote is
`tooExpensive` and the admin ticked "I approve buying this number above the automatic limit" — the values
are the ones on screen at that moment. Otherwise send null. The server quotes again just before the order:
within the limit it buys; above the limit it buys only if the fresh price is not above what was approved,
else it answers 400 "The price of this number went up after you approved it…" and buys nothing. An unreadable
price is refused whatever is sent. Re-checking the number withdraws the tick.

**After any assign / change / remove / release — done OR refused — re-read** the business, its requests, the
queue and Numbers: a refusal can come after the server acted (an order placed, a request handed back).
No answer at all (timeout, offline) is "unconfirmed", never "failed": re-read, do not report a failure.

**Release** (the lever on a cancelled business) returns the number to the carrier, so it is confirmed like
"Return now": an explicit dialog, a tick, a red button, one request however often it is pressed.

**Voice Settings.** `GET/PUT api/v1/admin/voice-config/platform` (existing) now carries
`numberLimits { numberPurchaseWarningPerDay, numberPurchaseLimitPerDay, idleNumberBuffer }` (what is stored;
null = the deployed default), `effectiveNumberLimits` (what is enforced) and `defaultNumberLimits` (what an
empty field falls back to — show it as the placeholder / helper even while a stored value overrides it). On
save always send `numberLimits`; a null value puts that limit back on its default. Ranges 1–1000, 1–1000,
0–500. **The warning level must be BELOW the stop level** (equal is refused: it would never warn before
buying stops), and the pair is checked as it will actually run — an empty field counts as its default. Check
the same thing on the screen before sending, using `defaultNumberLimits` for an empty field.

The settings history (`GET …/voice-config/audit?scope=platform`) now carries the three limits as flat keys in
`beforeJson` / `afterJson`: `numberPurchaseWarningPerDay`, `numberPurchaseLimitPerDay`, `idleNumberBuffer`
(null = the deployed default). Add their labels to the history's field map so a change to a spending limit
shows who made it.

**Activity.** `GET api/v1/admin/voice-assistant/{businessId}/number-audit` rows now carry
`verificationMethod` and `verificationReference` on an approved change of the number we ring.

**Alert types.** `GET api/v1/admin/alerts/types` returns every `AdminAlertType` name, in enum order. Both
admin apps read the filter list from it and cache it; neither keeps a copy of the list. The label maps stay
in each app: labels are presentation, the list is data. If the read fails, the filter shows the types the app
has labels for and says the list could not be refreshed — it never shows an empty filter as if there were none.

### Admin screens (hardcoded English, as both admin apps are)

On the existing AI Assistant page / screen, three tabs: **Requests · Numbers · Activity**.

- **Requests** — open requests across all businesses, newest first, paged with "Load more". A row names the
  business, the kind, the status and when it arrived. Opening one selects its business. A filter shows
  **Held numbers** (`kinds=ServiceEnd`) with their removal time.
  **Every business that needs a number from the team is in this list** — there is no second list built from
  the alert feed. Where this deployment gives numbers by hand (`adminReason` `AllocationDisabled` or
  `CarrierAdminLed`), a submitted application appears here as a setup request the moment it is submitted.
  A setup request leaves the list when the business is given a number, when its service ends, when it is
  rejected or cancels — or when an admin closes it.
- **Selected business** — Forwarding change · Number · Activity.
  - *Forwarding change*: from → to, who asked, when, the number mode, and the verification step (method +
    reference + a confirming tick) before **Apply**; **Decline** takes a provider-safe reason. Stale ⇒ amber
    "another change landed — refresh" and no overwrite. Resolved and declined requests still open, read-only.
  - *Specific number*: the provider's words and note; **Mark as handled** with an optional sentence for the provider.
  - *Setup needs the team*: the reason, the quote that stopped it, and a jump to *Number*, where the existing
    quote / assign / change / remove controls live. Reason labels: `AllocationDisabled` "Numbers are given
    by the team on this deployment" · `CarrierAdminLed` "This carrier's numbers are given by the team" ·
    `RemovedByAdmin` "An admin removed this business's number — its next number is yours to give".
    **Close request** (only while the status is `NeedsAdmin`): a confirm dialog saying exactly what it does —
    "This takes the business out of the queue without giving it a number. If its AI Assistant is active and
    providers can choose numbers on this deployment, it will be able to choose one itself again." For
    `RemovedByAdmin` add in amber: "You removed this business's number. Closing this lets it pick a new one."
  - *Removing a number* (existing dialog) now also says, under the release choice: "The business will not be
    able to choose a new number itself. Its next number comes from the team, until you assign one or close
    the request this creates."
  - *Keep* is refused for a number a business is using (400, sentence to show); offer it on idle numbers only.
  - *Parked* (the release choice "keep it for this business") is a real reservation: the number shows
    `Quarantined` with `reviewReason` `ReservedForLastBusiness` and `keepForReuse` true — "Parked for the
    business that last held it. Only that business can take it back; it is kept, not returned, until an admin
    moves it or stops keeping it." Rent continues. Switching **Keep** off on it ends the park (the number
    becomes `Available` for anyone). Giving it to ANOTHER business needs the override box and a reason
    (`bindingState` `ReservedForAnotherBusiness`, `canOverrideBinding` true). A kept or parked number that is
    given to a business is no longer kept: the pin never comes back by itself.
  - *Removed, returned to the pool*: how long another business must wait depends on what this one paid. A
    business that only ever had the free trial frees its number at once; one that paid waits the reuse days
    (`quarantineUntil` on the number). The dialog does not need to say which — the Numbers tab shows it.
  - *Number quote* (`GET …/voice-assistant/{businessId}/number-quote`): `bindingState` has a new value,
    `HeldOutOfAllocation` — the number is being bought, being returned, or waiting for a review. It is **not
    overridable** (`canOverrideBinding` false): show "This number can't be given to a business right now —
    open it in Numbers to see why", no override box. Assign / change can also answer 400 with "A number is
    being set up for this business right now…" when an order for that business is still at the carrier:
    show the sentence; the admin waits and tries again.
  - The number status `Reserved` no longer exists; drop its label and filter option.
- **Numbers** — the carrier inventory. Header: numbers bought today against the warning and stop levels, the
  buffer and what it means, whether automatic returns are on. Filters: status, idle only, search by number.
  A table on wide screens, cards on narrow. Each number: status and why, rent (or "Unconfirmed"), next renewal
  and how it is known, when it will be returned (or "Kept — rent continues"), the reuse wait, who holds or
  last held it. **Keep / Resume automatic return** with a reason, for idle numbers. **Return now** is incident
  use only: an explicit dialog, a tick, a red button; never a swipe.
- ‼️ **Numbers this environment did not buy (4 October 2026).** Every environment shares one carrier account.
  A number whose `purchasedHere` is not `true` (false OR absent) is drawn with a grey **Not bought here** pill,
  its return column reads **Never returned by Clinket**, and it is offered **no Return now, no Keep / Resume**
  (it is never returned, so there is nothing to keep it from). A `NeedsReview` + `UnknownToUs` one is offered
  **Use in this environment…**: a dialog saying it joins this environment's pool, is never given back to the
  carrier, that calls reach whichever environment the number is connected to, and an amber "Make sure no other
  environment is using it"; a tick, then the primary button. *Remove* and *Change* look the business's number up
  (`GET /inventory?search=<digits>`) and offer **Release the number** only when it is found with
  `purchasedHere: true`: while checking, when not bought here, or when the lookup fails, the choice is disabled
  and its hint says why; a choice that becomes disallowed is cleared, never sent. The cancelled-business
  **Release** dialog says in advance what will happen: back to the carrier (bought here), back to our pool (not
  bought here), or either, by the server's record (lookup failed). The server refuses either way.
- **Alerts** — a business-scoped number alert (`VoiceForwardingChangeRequested`, `VoiceSpecificNumberRequested`,
  `VoiceNumberSetupNeedsAdmin`, `VoiceNumberSelfServiceCompleted`) opens that business's request. A number
  alert (`VoiceNumberReturnFailed`, `VoiceNumberReturnMissed`, `VoiceNumberNeedsReview`,
  `VoiceNumberRenewalDateUnknown`, `VoiceNumberReturnRefused`, `VoiceNumberOwnershipUnproven`) opens Numbers filtered to `metadata.number`. `VoiceNumberPurchaseWarning`
  and `VoiceNumberPurchaseLimitReached` open Voice Settings. `VoiceAssistantApplicationSubmitted` opens the
  business that applied (the application is its number request). The rest open Numbers — **"the rest" is
  every other type whose name starts `VoiceNumber` or `VoiceCarrier`**, so a type added on the server later
  still leads somewhere without a new build.

---

## 4. Words

Provider screens say *number, calls, answering, our team, held until, saved*. They never say partition, token,
endpoint, payload, E.164, DID, forwarding target, carrier budget, quarantine, allocation, reconcile.
A return to the carrier is never called a refund. An own-number assistant is never "ready" before its test call.
Every provider sentence is a key in all five language files (en, es, fr, gu, hi). Hindi and Gujarati run
longer than English: no fixed-width button, no single-line truncation of a number, a date or an action.
