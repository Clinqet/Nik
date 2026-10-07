# Multidimensional audit — AI Assistant number lifecycle

**Two parts.** Part one (this part, 1 October 2026) audited the backend, WhatsApp, the email templates and
deployment. **Part two (2 October 2026), below, audits everything built after it — the four screens, the
dedicated test suites — and walks the backend of part one a second time.** Read part two's §0 first: it found
more than part one did.

**Part one — scope: every line of code written or changed up to 1 October.** Audited 2026-10-01.

‼️ **This code goes straight to production — there is no lower-environment soak.** The audit was run on that
basis: every carrier call was checked against the carrier's own published documentation rather than against
memory, and every failure path was traced to an admin alert or an explicit decision not to raise one.

**Status of part one: 20 findings raised. 18 fixed in that session. 1 verified correct as built (A-14, withdrawn — see below). 1 standing risk needing its own change (R-1) — closed in part two, as is R-2.**

> **This audit covers the BACKEND, WhatsApp, email templates and deployment only.** The provider web app,
> provider mobile app and the admin requests/inventory screens are **not built**, so the UI/parity dimension
> cannot be audited and is marked NOT APPLICABLE YET. The next session must re-run this audit over its own
> work — see `NEXT-SESSION-PROMPT.md`. **Done: part two, §8.**

---

## 1. Carrier correctness — verified against official documentation

The single most dangerous class of defect here: a wrong release call means we keep paying for numbers forever
and nobody notices. Both adapters were checked line by line against the carriers' live docs.

| | Documentation says | Our code | Verdict |
|---|---|---|---|
| **Telnyx delete** | `DELETE /v2/phone_numbers/{id}` — `{id}` is the **resource id, not the E.164 string** | Looks the id up by `filter[phone_number]` first, then deletes by id | ✅ correct |
| **Telnyx success** | `200 OK` with a body whose `status` becomes `deleted` | Treats a 200 as *accepted*, confirms with a later owned-number read before saying Returned | ✅ correct, deliberately conservative |
| **Telnyx lock** | `deletion_lock_enabled` prevents deletion via API and portal | Checked during the lookup; returns `Locked` without attempting | ✅ correct |
| **Plivo unrent** | `DELETE /v1/Account/{auth_id}/Number/{number}/` | `{_accountPath}/Number/{StripPlus(e164)}/` | ✅ correct, trailing slash present |
| **Plivo number format** | **No leading `+`** (`17609915566`) | `StripPlus(e164)` | ✅ correct |
| **Plivo success** | **`204 No Content`, NO response body** | Checks the status code only; never requires a document | ✅ correct — ‼️ code that expected a JSON body would fail on **every** Plivo release |

Sources: [Telnyx — delete a phone number](https://developers.telnyx.com/api-reference/phone-number-configurations/delete-a-phone-number.md) ·
[Plivo — unrent a number](https://www.plivo.com/docs/numbers/api/account-phone-number/#unrent-a-number)

**Renewal-boundary handling, re-verified:** Telnyx publishes no per-number renewal date, so the boundary is the
start of the next calendar month via `AddMonths(1)` on day 1 — a date that exists in every month, so 28/29/30/31
and leap years cannot produce a clamping bug. Plivo publishes a per-number date which we parse and never
recompute. **No anniversary is ever guessed.** Return target = boundary − 14h safety − 24h lead = 38 hours.

---

## 2. Findings

### Correctness

| # | Finding | Severity | Fix |
|---|---|---|---|
| A-01 | **Telnyx charge lines were parsed with the price parser, which rejects negatives. Telnyx reports every debit as negative, so the daily charge-mismatch check read ZERO lines every day and always reported "all fine".** | **Critical** | Added `NumberCostParsing.TryParseAmount` (signed) for ledger figures; `TryParseRate` stays strict for prices |
| A-02 | Same bug on the balance read: an **overdrawn** account reported "unknown", silencing the low-balance alert exactly when the account was empty | **High** | Signed parse on both carriers' balance |
| A-03 | `clinket_ai_number_at_risk` could never fire — the template mapping read `AtRiskNumber` and nothing populated it | **High** | Wired `PreviewAtRiskAsync` into the trial reminder |
| A-04 | The number-held **email carried no deadline token** — the single fact that message exists to deliver | **High** | `ReleaseDeadline` added, rendered per recipient |
| A-05 | `GetNumberQuoteAsync` could not name the business holding a number; the admin screen said "another business" without saying which | Medium | `NameTheHolderAsync`, one point read, only when a foreign holder exists |
| A-06 | Two alert review reasons fell through to a generic fallback, giving the admin no instruction | Medium | Dedicated descriptions for `RenewalDateUnknown` and `PurchaseUnresolved` |

### Error handling and admin alerts

| # | Finding | Severity | Fix |
|---|---|---|---|
| A-07 | **A number with no renewal boundary was skipped with a silent `continue`**, under a comment claiming an admin handled it. Nothing told any admin, and the number would renew forever at our cost | **Critical** | Dedicated `AdminAlertType.VoiceNumberRenewalDateUnknown` + `RenewalDateUnknownAsync`, stating the number, carrier, **what it keeps costing per cycle**, the last business, and the two concrete ways to resolve it. Deterministic event id ⇒ one alert per number, not one an hour. Fires for **both** carriers |
| A-08 | `ServiceBusService` had **no sender registered** for `VoiceNumberOperationsQueueName` — every queued number operation would have failed to send | **Critical** | Sender registered |
| A-09 | Suppressing the AI switch-off WhatsApp risked suppressing the admin alert with it | High | Verified separate; pinned by a dedicated test |

### Security

| # | Check | Verdict |
|---|---|---|
| A-10 | `GetNumberQuoteAsync` exposes another business's **name** — cross-tenant leak? | ✅ Clear. `AdminVoiceAssistantController` is `[Authorize(Roles = "Admin")]` and routed under `/admin/`. Not reachable by a provider |
| A-11 | The new email shell interpolates heading, paragraphs and CTA **raw** into HTML — XSS via a business name? | ✅ Clear. `TemplateService.ForHtml` HTML-encodes every token **by type**, passing through only a declared `HtmlFragment`. Template literals are ours; tokens are encoded |
| A-12 | `GetChoices` carried `voice.number.manage` without the live-SQL re-check that permission mandates | **Fixed** — `RequiresLiveAuthorization = true` |
| A-13 | Secrets or PII in new logs | ✅ Clear. Every new log line masks the number via `MaskPhoneNumber()`; the Meta token was never written to any file |

### Duplication / notification restraint

| # | Finding | Severity | Disposition |
|---|---|---|---|
| A-14 | ~~At service recovery the provider receives two emails~~ **WITHDRAWN — I WAS WRONG** | — | ‼️ **NOT A DEFECT. I reported this without checking, and it is false.** `BillingNotificationService.ResolveVariant` returns `EmailTemplate: null` for `AiAddOnActivated`, and a null template means `RecipientEmail = null` + `EmailDeliveredElsewhere = true`. **Billing sends NO email and NO WhatsApp for an AI activation** — it is in-app and push only. At recovery the provider therefore gets exactly **one email and one WhatsApp**, both from the number layer, and they already carry both facts. No change needed, and the `VoiceNumberKept` email is the only thing that tells a provider their number was saved |
| A-15 | One event sending both a billing WhatsApp and a number WhatsApp at switch-off | High | **Fixed** — billing returns no WhatsApp for AI `SubscriptionDowngraded` / `TrialEnded` / `Canceled`. One owner per message |

### Concurrency and thread safety

| # | Check | Verdict |
|---|---|---|
| A-16 | `EmailShell` is called concurrently during template load — shared mutable state? | ✅ Clear. Only `private const` fields; every `StringBuilder` is a per-call local. Thread-safe by construction |
| A-17 | `VoiceNumberNotifier` builds notification data **once per recipient** — does it mutate the shared dictionary? | ✅ Clear, and this was the real risk: `ResolveEmailData` and `BuildWhatsAppData` each allocate a **new** dictionary. Mutating the captured one would have corrupted every later recipient in the fan-out |
| A-18 | Two hourly job instances both flagging the same asset | ✅ Clear. `FlagRenewalDateUnknownAsync` writes under ETag and returns quietly on 412; the asset then leaves the idle set, so the alert is self-limiting |
| A-19 | `ReleaseMomentFor` duplicated between the warning and the hold would drift, telling the provider a deadline we then did not keep | **Fixed** — one private method, used by both |

### Performance, memory and CPU

| # | Finding | Severity | Fix |
|---|---|---|---|
| A-20 | `EmailShell.Strip` used the **static** `Regex.Replace` overload, which takes a lock on a shared pattern cache on every call — and it runs once per paragraph across 535 template files at startup | Low | Converted to `[GeneratedRegex]`, lock-free and allocation-free |
| — | `IMemoryCache` writes introduced? | ✅ **None.** The `Size = 1` rule cannot be violated by this change |
| — | `IDisposable` on carrier `JsonDocument`s | ✅ Clear — `using var` throughout; Plivo disposes the (absent) 204 document safely via `?.Dispose()` |
| — | Email shell composition cost | ✅ Composed **once at template load** and cached, not per send |
| — | New reads per operation | ✅ Bounded: one point read to name a holder (admin screen only), one point read for the at-risk preview (only when an AI trial ends with no card). Both partition-scoped point reads, never a query |
| — | Cross-partition Cosmos queries introduced | ✅ **None.** §0.6 holds |

### Cost control

| | Verdict |
|---|---|
| Buffer semantics | ✅ One rule, both carriers. Telnyx 10 / India 0, set per stamp in `deploy.ps1`. Keeping pays on Telnyx (saves the setup fee) and never on Plivo (no setup fee), which is exactly what the buffer expresses |
| Sunk cost excluded | ✅ What was already paid never influences the keep-or-return decision — only whether the number will be needed |
| Over-cap / unknown-price numbers | ✅ Never kept, regardless of the buffer |

### Deployment

| | Verdict |
|---|---|
| `analytics-alerts.json` deployed | ✅ Wired in `deploy.ps1` |
| Heartbeat rule correctness | ✅ Compares hosts that logged **anything** against hosts that logged the completion marker, so **no role name is hardcoded** — a naive count would hide one stamp going silent behind the other's heartbeats, and hardcoded names would break outside prod |
| Marker drift | ✅ Guarded — renaming the constant breaks no build and would silently disable the alert, so a test pins the literal |
| WhatsApp config parity | ✅ 6/6 new keys present in **both** hosts; all five languages; no `ButtonUrlParamKey` (static buttons) |
| Retired template references | ✅ Zero in code or config — only comments documenting what they replaced |
| Line endings / BOM | ✅ Both `appsettings.json` verified CRLF with zero bare LF; the Functions host's UTF-8 BOM preserved |

### Tests

| | Verdict |
|---|---|
| Suites | 15,211 API · 8,205 Functions · 1,386 MCP · 1,322 Identity — **0 failures** |
| Guards strengthened | The Cosmos single-column ORDER BY guard (rewritten to the real rule and sabotage-proved); the email logo guard (now checks **shipped** markup, so it would catch a shell that lost the logo for all 107 templates at once); a new content-form guard; WhatsApp eligibility asserted as a **shape**, not a name list |
| Submission validator | Sabotage-proved **five ways**, including stripping every Devanagari and Gujarati character |
| ‼️ Gap | **The new services have no dedicated unit or integration suites.** Existing suites are green and carry the new guards, but `VoiceNumberCoordinator`, `VoiceNumberAllocationService`, `VoiceNumberLifecycleService` and `VoiceNumberPurchaseService` are not directly covered. **This is the single largest remaining risk for a production-direct deploy** |

### UI / parity — **NOT APPLICABLE YET**

Provider web, provider mobile, and the admin requests/inventory screens are not built. The 13 admin alert types
**are** registered in both admin apps with identical labels (ESLint and `tsc --noEmit` clean).

---

## 3. Standing risks the owner should know

| # | Risk | Why it is not fixed here |
|---|---|---|
| R-1 ✅ closed in part two | **Both admin alert lists are hand-maintained copies of `AdminAlertType.cs` and nothing verifies they stay in step.** A new backend alert type silently becomes unfilterable in both admin apps | A cross-repo test is forbidden by §0.17. The right home is a deploy-time check in `deploy.ps1`, which already sees both sides. Needs its own change |
| R-2 ✅ closed in part two | **No dedicated suites for the new services** | Listed as remaining work; the largest risk for production-direct |
| R-3 | 3 WhatsApp templates were still `PENDING/UTILITY` at the time of writing (45 of 48 approved, **zero MARKETING**). Owner instructed to treat all as approved | Between creation and approval a send attempt fails and raises a delivery-failure alert. Pre-prod, no real providers |


## 4. What was verified and found correct (no change needed)

Generation fencing on every profile and line write · claim-before-act with ETag · record-before-carrier on
purchase · the purchase POST deliberately outside the retry policy · atomic daily counter · partition-scoped
reads only · quarantine never blocking a return · a number missing from a **failed** listing never treated as
gone · deterministic event ids on every alert · `SkipSms` on every number notice (the service already sends its
own transactional SMS) · no AI template or email claiming a "free plan" that does not exist for the AI add-on.

---
---

# PART TWO — audit of the second session (2 October 2026)

**Scope: everything built or changed after part one** — the four screens (provider web, provider app, admin web,
admin app), the alert-type endpoint (R-1), the dedicated test suites (R-2), and **a second, full pass over the
backend of part one**, because the owner asked for every edge case to be walked, not only the new code.

**How to read this.** Each finding says what was wrong in plain words, what it would have cost, and what was
done. "Fixed" means the code changed and the suites were run; where a rule was involved a test was added for
it. §4.3 says which of those tests were seen to fail against the broken code, and which were not.

## 0. The short version

| | |
|---|---|
| Findings raised in part two | **162** — backend 73 (§3) · the tests themselves 5 (§4.2) · the four screens 84 (§8) |
| Fixed in this session | **all of them**, each with a test where a rule was involved |
| Would have lost money or put two businesses on one number | marked 💰 — **18** of them |
| Would have stopped a host or an endpoint working | marked ⛔ — **5** of them |
| Left for the owner to decide | **4**, none of them a defect (§10) |
| Deliberately left as they are, with the reason | §7 and §8.5 |
| Part one's standing risks | R-1 **closed** (endpoint, both admin apps read it) · R-2 **closed** (suites below) · R-3 unchanged |

‼️ **The three findings that matter most were all invisible to the unit suites**, and were found only by running
the real thing:

1. ⛔ **The API host could not start.** One registration was missing. Every unit test passed.
2. 💰 **A pending Telnyx order was written off as failed** — and "pending" is Telnyx's normal answer. We would
   have told the provider it failed while Telnyx rented us the number.
3. ⛔ **Every second write of the same record would have failed in production.** Both test doubles were more
   forgiving than the real database, so the tests passed.

A fourth class came from having each screen read by someone who had not built it (§8): the admin app showed
**every purchase price as $0.00**, and both admin apps told the server on every purchase that it may buy above
the price limit.

The lessons are recorded in the skills: a double must behave like the real store, the real host must be
booted, a new test must be seen to fail against the broken code, and a screen gets a second reader.

---

## 1. The owner's example, walked end to end

> *"A provider signs up on the free trial and we auto-assign a number. We unassign it from the admin portal. The
> number becomes available to another provider right away — that is fine, it is a free trial. But what does the
> first provider see? Is it accurate? Is it enough?"*

| Step | What happened before this session | What happens now |
|---|---|---|
| Admin removes the number | The number left the business | Same |
| The first provider opens the page | ❌ Saw only "choose a number" or "our team is arranging your number". Nothing said a number had been taken away | ✅ A card at the top: **which** number, **when** (date, time, zone), **why** (the admin's reason, in the provider's language), and **that a person on our team did it** |
| The first provider tries to pick again | ❌ Could pick a new number at once — or the same one — undoing the admin's decision in seconds | ✅ The picker is closed. "Your next number will come from our team." It stays closed through a rejection, a cancellation and a service end |
| The admin | ❌ Had no way to see this business as waiting, and no way to reopen the picker except by assigning | ✅ The business is in the Requests queue ("An admin removed this business's number"). The admin assigns a number, or **closes the request**, which reopens the picker |
| The number | Went back to the pool | ✅ Trial-only business: free for the next provider at once. Paid business: waits 15 days so its old callers do not reach a stranger |
| The second provider | Could take it | ✅ Takes it; the handoff is on the record |

Proven over real HTTP against the real stores:
`SelfService_PickANumber_AdminRemovesIt_ProviderSeesWhatHappened_AndPicksAgainOnlyAfterTheTeamSaysSo`,
`TeamLed_AdminRemovesTheNumber_…`, `RemoveNumber_Returned_FromATrialOnlyBusiness_IsFreeForAnotherBusinessStraightAway`.

## 2. Every edge case walked

"OK" = behaves correctly and a test proves it. Every row marked **was wrong** is a finding in §3.

| # | Situation | Result |
|---|---|---|
| 1 | Two providers confirm the same number in the same instant | OK — one conditional write; 12 businesses raced on the real emulator, exactly one won |
| 2 | The same provider confirms twice (two devices, a retry) | OK — same request id and number is the same request; a different one is refused |
| 3 | The provider's request times out after "confirm" | **was wrong** on the screens (U-6, U-7): now the screen keeps the id, locks the number and re-reads; no second purchase |
| 4 | The queue delivers "buy this number" twice | OK — the record decides; the second delivery asks the carrier, never orders again (real stores) |
| 5 | The carrier answers "pending" | **was wrong** 💰 (F-K) |
| 6 | The carrier never answers at all | **was wrong** (F-O, G1) |
| 7 | The order is confirmed after we gave up on it | **was wrong** 💰 (G2) |
| 8 | The host stops between recording the choice and acting on it | **was wrong** (A1) |
| 9 | The host stops half-way through writing an assignment | OK — the request says `Applying`; the hourly job finishes it; bounded attempts, then the team |
| 10 | The hourly job and the worker act on the same request at once | **was wrong** 💰 (G8, G9) |
| 11 | The business is rejected, held or cancelled while its number is being bought | **was wrong** (E2, E3, G7) |
| 12 | The trial ends between choosing and buying | **was wrong** (E3) |
| 13 | Billing cannot be read | **was wrong** (F-Q) |
| 14 | More sign-ups in a day than the daily limit | OK — atomic counter; 9 racing purchases, limit 3, exactly 3 orders (real emulator) |
| 15 | A failed order, then the provider picks the same number again | **was wrong** (F-A) |
| 16 | We recorded "returned" but the carrier still rents it to us | **was wrong** 💰 (F-B) |
| 17 | A number bought a minute before the hourly run | **was wrong** (F-C) |
| 18 | One carrier listing misses a working number | **was wrong** (F-U) |
| 19 | A number really is gone at the carrier | **was wrong** (F-U) |
| 20 | The carrier listing fails or is cut short | OK — proves nothing; nothing is called missing or returned |
| 21 | Many unused numbers and a busy hour | **was wrong** (F-S) |
| 22 | Admin parks a number for a trial business | **was wrong** 💰 (H3) |
| 23 | A kept number is given to a business, and that business later leaves | **was wrong** 💰 (H3) |
| 24 | A business with a parked number closes | **was wrong** 💰 (H3) |
| 25 | The owner's confirmed phone is abroad, premium or one of our own lines | **was wrong** 💰 (H2) |
| 26 | The owner has not confirmed a phone | OK — "Confirm your business phone" |
| 27 | An employee, not the owner, runs setup | OK — the number we ring is still the owner's |
| 28 | The service ends | OK — one hold, one notice, the deadline told is the deadline kept |
| 29 | The provider pays inside the hold | OK — hold cancelled, number kept, told once |
| 30 | The hold runs out while a payment is settling | OK — waits an hour, removes nothing |
| 31 | The hold runs out and the business has moved to another number | OK — the hold ends, the new number is untouched |
| 32 | The business closes with a number | OK — number detached silently, open requests cancelled, an order in flight keeps its record |
| 33 | A call is in progress when the number is removed | OK — not handed to anyone else for a day |
| 34 | Own-number mode ends without proof the forwarding is off | OK — never offered to anyone else; returned before its renewal |
| 35 | Two admins decide the same request | OK — one wins; the other gets a clean "reload" (412 mapped) |
| 36 | Admin approves a change after the saved number moved | OK — refused as stale, nothing overwritten |
| 37 | Admin assigns a number while that business's order is at the carrier | **was wrong** (F-P) |
| 38 | Admin closes a request that has an order at the carrier | OK — refused; closing it would orphan the order |
| 39 | A provider sends request after request | OK — cooldown and daily limit on the record |
| 40 | One provider tries to read or withdraw another's request | OK — the business is the token's; nothing addresses another (endpoint test) |
| 41 | A customer or anonymous caller hits a number endpoint | OK — 403 / 401 on every route (endpoint theory tests) |
| 42 | The engine returns a short page of numbers | **was wrong** 💰 (P1) |
| 43 | A new alert type ships | OK — both admin apps read the list from the server (R-1), and a new number alert still gets a link (U-27) |
| 44 | The price of a number rises between the admin's check and the order | **was wrong** 💰 (S-1, U-2) |
| 45 | A number that already answers for a business, from before this inventory existed | **was wrong** (M5) |
| 46 | The admin lowers the daily limit during an incident | **was wrong** 💰 (M1) |
| 47 | The provider's app is older than the server and gets an answer it does not know | **was wrong** (U-11) |

## 3. Findings and fixes — backend

### 3.0 Found in the first pass over part one's backend

| # | What was wrong | Fix |
|---|---|---|
| B-1 💰 | The daily "missed event" check never did anything: its filter and its date test excluded every number | Rewritten (`CheckAssignedAsync`); a number recorded against a business that no longer holds it is freed and the team told |
| B-2 💰 | A number stayed assigned to a business whose profile was gone, and closing a business never took its number off | `ReleaseOrphanAsync`, `OnBusinessClosedAsync`, called from the closure teardown |
| B-3 💰 | A price problem or unproven forwarding parked a rented number under "needs review", where nothing ever returned it | Those numbers stay unused under a reason: never offered, and returned before their renewal |
| B-4 | A number being bought was reported "missing at the carrier" | An order in flight is not expected in the listing |
| B-5 | A request whose checks were spent was asked about every hour, for ever | Bounded; then the team |
| B-6 | A failed order took its count off **today**, not off the day it was placed | Off the day of the order |
| B-7 | An admin could not confirm a purchase above the price cap: the confirmation existed on screen and was ignored | Honoured — and since replaced by an approval that names its price (S-1) |
| B-8 | A number given by an admin left the business's setup request open for ever | Completed by the assignment |
| B-9 💰 | "Another month was charged" was never raised once the return attempts ran out — exactly when it matters | Raised whether or not attempts remain |
| B-10 | A removal the inventory kept refusing was retried every hour for ever | Bounded; then an alert |
| B-11 | Two devices could each open a request of the same kind | The store refuses the second |
| B-12 | Approving a change twice was blocked by its own evidence row | The row's id comes from the request; the retry carries on |
| B-13 | An Indian number beginning 91… could not be entered | Only a typed "+" or the full length means the country code is there |
| B-14 | A draft in dedicated mode accepted a typed number to ring | Refused: that number is the server's |
| B-15 | "Confirm" accepted any number in the world | Must be in the business's own country |
| B-16 | A carrier fault during the search was read as "nothing available" and sent the provider to the team | "We couldn't look up numbers just now — try again" |
| B-17 💰 | A redelivered "buy" quoted and ordered again instead of asking about the first order | The record decides what is left to do |
| B-18 | "We already rent it" was treated as "this business holds it" | Claimed like any other number, or refused |
| B-19 | A removal cut off half-way left the profile pointing at a number another business now held, and nothing could clear it | Only the stale pointer is cleared; the other business's line is never touched |
| B-20 | Phone numbers were written to the logs in full | Masked |
| B-21 | Three computed values were being stored in Cosmos | Not stored |
| B-22 | Saving the platform settings without the limits wiped them | Kept unless sent |
| B-23 | The daily checks were lost if the host was down at 03:00 | Run by the first run after the hour |
| B-24 | Two fields outside the approved schema were being stored (`lastRequestedAt`, `adminReason`) | Removed; `businessName` is with the owner (§10) |
| E9 | The warning level could equal the stop level; the default was not sent to the screen; a change to a spending limit left no history | Checked as it will run; the default is sent; the history carries all three |
| F-W | The "application submitted" alert stayed open after the application was answered | Closed when it is approved, rejected, cancelled or given a number |

### 3.1 Correctness — buying a number

| # | What was wrong | What it would have cost | Fix |
|---|---|---|---|
| F-K 💰 | An order was looked up by the **carrier's** order id as if it were **our** reference. Telnyx found nothing, so a pending order (Telnyx's normal answer) was written off as failed | The provider is told it failed and sent to the team; Telnyx completes the order; we pay rent for a number our records say we never got | Always look up by our own reference. "Not found" is double-checked by asking whether we own the number. A write-off touches only our own in-flight record, and takes the count off the day once |
| F-L | A pending order waited for the hourly job | A provider watching "setting up your number" for up to an hour, for an order that takes seconds | Follow-up checks at 20 s, 40 s, 80 s; the hourly job stays as the backstop |
| F-O | When every check was spent, the record stayed "being bought" for ever | A number nobody can assign, return or see, possibly charging rent | Held for a person, off the business; the next carrier listing settles it (listed ⇒ pool, not listed ⇒ closed) |
| G1 | At that same moment the request lost its due time before the hand-off to the team | If the hand-off did not land, the provider waited for ever and no admin ever saw it | The due time stays until the team has it |
| G2 💰 | A late confirmation assigned the number to the request's business **whoever held it by then** | Two businesses on one phone line: one's callers reach the other | Confirmed only while the record is still this business's; otherwise this business goes to the team and the number stays where it is. A record written off earlier also gets its long retention back, so a rented number cannot expire out of the inventory |
| F-A | A failed order left a "returned" record that blocked buying that number again for a year | "That number was just taken" for a number nobody has | A returned record is history: the number is bought again and its generation moves on |
| A1 | A choice recorded but never acted on (the host stopped) had no due time | Stuck for a year: the provider can neither finish nor start again, the admin cannot close it | Due from its first write; the hourly job finishes it (number already claimed) or hands it to the team |
| G8 💰 | The hourly job handed a "queued" purchase to the team after re-reading it — by which time the worker had started buying | A number bought, never applied, released a day later | The hand-off is conditional on the record the job actually read |
| G9 | An assignment being written was due "now" | The hourly job ran it a second time beside the first; the provider's own call was told it failed | Work in flight is due only after it has had time to finish |
| E2 | A purchase in flight was applied to a business that had been rejected, held, cancelled or given another number | The assistant switched back on behind the admin's decision | The number goes back to the pool quietly; the request ends; the team is told |
| E3, G7 | A business with no live service, or no longer waiting, was put in the team's queue and told "we're arranging your number" | A false promise to a provider who had cancelled | Ended quietly; "who still waits" is read at the moment of the hand-off, not before the carrier call |
| F-Q | Billing that could not be read was read as "no service" | A paying provider told to activate a plan they have; their purchase cancelled | "Could not ask" is neither yes nor no: try again |
| F-P | An admin could give a business a second number while its own order was at the carrier | The order left with nothing tracking it | Refused with a sentence; the same number finishes the order instead |
| F-X | The "confirm your business phone" outcome existed on every screen and was never sent | A dedicated number rented for a line that can ring nobody | Sent when there is no phone to ring; nothing is offered or bought |
| H2 💰 | At submit the server adopted the owner's confirmed phone with **none** of the rules a typed number passes | Every missed call ringing a premium line, a number abroad (international rates) or one of our own lines | One set of rules for every path (`VoiceForwardingTargetRules`); a clear sentence in five languages |
| S-1 💰 | An admin's approval to buy above the price limit was a yes/no flag, and both admin apps sent it on every purchase (§8.1) | A price that rose after the admin looked — above the limit, or above what they approved — bought unseen | The request carries the approved price; the quote taken just before the order is compared with it; a dearer one is refused and nothing is bought |
| S-2 | Three purchase refusals shown to the ADMIN were worded for the provider ("our team will arrange one for you") | An admin told to wait for themselves | Reworded in five languages |
| M3, M6, S-3 | An unused dependency on the timer function; a wrong sentence on "this number can't be returned"; a comment naming fields that no longer exist | — | Removed / corrected |

### 3.2 Correctness — holding, removing, keeping, returning

| # | What was wrong | What it would have cost | Fix |
|---|---|---|---|
| E1 | The owner's example (§1) | A provider not told their number was gone, and able to undo the admin's decision | The removal card, the closed picker, the admin's Close request |
| E4, E5 | Where the team gives numbers, a submitted application was not in the Requests queue, and waiting requests never left it | Businesses waiting for a number nobody was asked to give; a queue full of dead entries | The application is the business's setup request; it leaves when the business does |
| E6, E7 | Choices were searched for a business that had not asked; "our team is arranging it" was shown with nothing in the team's queue | A carrier search and a false promise | Refused; the queue entry is written first |
| E10 | Keep could be set on a number a business was using | Rent nobody remembers choosing, starting the day that business leaves | Keep is for unused numbers only |
| H3 💰 | **A parked number was not reserved.** For a trial business the number was "available" the same second. The pin was a second write. A kept number stayed kept after it was reused. A number parked for a closed business was kept for ever | A number promised to one business given to another; numbers returned that should be kept, and kept (and paid for) that nobody wanted | The park is a reason on the number itself, set and pinned in one write; only its business (or an admin's override) can take it; using a number un-keeps it; closing a business releases its parked numbers |
| F-B 💰 | A number our record called "returned" that the carrier still listed was ignored | Rent on a number we believe is gone, with nobody told | Held for a person and an alert raised |
| F-C | A number bought minutes before the hourly run was "missing at the carrier" | A provider just told "your number is ready" has it switched off | A 30-minute grace |
| F-U | One short listing took a number off a paying business; a number really gone stayed on the profile as "Active" | A working number removed — or a dead number advertised to callers | Two listings in a row. A lost number comes off properly, with a notice |
| L6 | A number declared gone, never removed, and then listed again kept "missing at the carrier" on it | A working number shown as missing | Cleared when the carrier lists it |
| F-S | Unused numbers carried a due time, and the due-work read is bounded | With enough unused numbers, holds and purchases were never reached | Unused numbers carry no due time |
| E8 | Two screens could hand the same business to the team twice | Two alerts, two notices | One conditional write; the loser says nothing |
| M5 | A number **already answering for one of our businesses** (given to it before this inventory existed) was imported by the hourly job as "at the carrier but never bought here" | An alert for every working number on the first run; and once its business left, the number was held for review for ever | A number whose line is answering for a business is recorded as that business's. Only a number that answers for nobody is a question for a person |

### 3.2b The spending limits an admin sets

| # | What was wrong | What it would have cost | Fix |
|---|---|---|---|
| M1 💰 | The three limits were remembered by each server for **24 hours**. The admin saves them on the API; the purchase worker that enforces the daily stop level is a different server | An admin who lowers the daily limit during an incident is not obeyed for up to a day | Remembered for 60 seconds (`VoiceNumbers:LimitsCacheSeconds`) |
| M1 💰 | When the settings could not be read, the looser deployed defaults were used **and remembered** | A limit lowered to 5 quietly becomes 25 again after one failed read | The last values read stand; the defaults answer only when nothing was ever read |
| M1 ⛔ | Saving the limits disposed something a read in progress could still be using | A server error on a purchase or on the admin page, at random | Swapped, never disposed |
| M1 | This service had **no test at all** | — | 12 tests |
| M2 | The provider's request id could contain any character. It is sent to the carrier as our order reference and becomes part of a queue message id | A malformed reference at the carrier | Letters, digits, `-` and `_` only |

### 3.3 Things that would have stopped it working ⛔

| # | What was wrong | Fix |
|---|---|---|
| H1 ⛔ | **The API host did not register one store the number coordinator needs.** The host fails its start-up check; every AI Assistant and billing endpoint is down | Registered. Found only by booting the real host |
| F-M ⛔ | The real repository did not hand back the new version tag after a write; both test doubles did | The repository now does, and an integration test proves it on the emulator. Without it every purchase failed at its second write |
| F-R ⛔ | Two list queries sorted in a way production has no index for (the emulator allows it) | Sorted on the existing index; the query text is pinned in a unit test |
| F-V ⛔ | One refusal had no sentence in any language | "No live plan" came back as a server error. Sentence added ×5, and a new guard that scans every refusal the code can throw |

### 3.4 Security

| Check | Result |
|---|---|
| Who may call what | Provider routes: `voice.read` / `voice.number.manage` with the live check. Admin routes: role `Admin`. **Verified over HTTP**: a provider gets 403 and an anonymous caller 401 on all eight admin routes; a customer gets 403 and an anonymous caller 401 on all six provider routes |
| One business reading another's data | The business always comes from the token. **Verified over HTTP**: a second business sees none of the first's requests or removal history and cannot withdraw them |
| A provider naming any number to buy | Checked against the business's own country, both price caps, the daily limit, and "one request at a time". A number abroad is refused (endpoint test) |
| The number we ring | Server-owned; adopted from the owner's confirmed phone under the destination rules; changed only by an admin with recorded evidence |
| Phone numbers in logs | Masked everywhere in this feature |
| A number in an address | Never: an alert link carries the number in router state, not in the URL. A business id typed by an admin is sent as one path segment |
| Secrets | None added. No carrier credential is read by any test |
| Input | Every DTO field has a length or a pattern; an E.164 pattern guards the id built from a number |
| ‼️ Carrier safety | **No purchase, release or change was made at Telnyx or Plivo in this session.** Every test uses a scripted carrier |

### 3.5 Concurrency

| Check | Result |
|---|---|
| Claim | One conditional write. 12 businesses racing, and the same business six times at once — real emulator |
| Daily limit | Server-side atomic increment, never read-then-write. 24 parallel increments counted; 9 racing purchases admitted exactly 3 — real emulator |
| One request at a time | Enforced by the store (a fixed id), not by a read |
| Worker vs hourly job | G8, G9 above. Both now act only on the record they read |
| Two hourly jobs | One owner per timer; a second instance loses each conditional write and stops |
| Two admins | One wins; the other is told to reload |
| Stale writers | A profile or line write carrying an older generation is refused — real stores |
| Shared state in memory | The limits cache only (M1). Every service is scoped; nothing static is mutable |
| The screens | One reader of the number status per screen; every write single-flight; a late answer for another number is dropped (U-4) |

### 3.6 Memory and CPU

| Check | Result |
|---|---|
| Disposables | Every query iterator is in a `using`; no client is created per call |
| Unbounded loops | None. Claim 3 attempts; page fill 5 rounds; carrier pages, due records, setup attempts, return attempts and follow-up checks are all bounded by a setting |
| Unbounded lists | The inventory of one stamp is read once per hourly run; the idle read stops at 2,000 |
| Caches | One: the admin-set limits, 60 seconds, `Size = 1` on every write (M1). Its tests cover the fallback and the swap on save |
| Timers and listeners in the screens | One poll timer per screen, cleared on leaving; listeners removed; the read in flight cancelled (§8.4) |

### 3.7 Performance and cost

| # | What was wrong | Fix |
|---|---|---|
| F-T | The hourly job read each carrier number one by one, then read the whole inventory twice more | One pass per run |
| L1 | The balance check read the whole inventory again | Uses the pass already made |
| F-S | A write per kept number per run | Kept numbers are simply left alone |
| A10 | The admin inventory page waited for three reads in turn | Read together |
| P1 💰 | A page of numbers was one engine round-trip. The engine may return a short page with more to come | The pool could look emptier than it is — and a provider's choice go to the carrier to be **bought** while unused numbers sat in the pool. A page is now filled; rounds are bounded |
| F-D, F-N | Two settings nobody read; three dead methods; a status nothing produced | Deleted |

Accepted, not changed: the keep-or-return step reads the unused numbers once more per run (one small read an
hour); filtering the inventory by country or by a search string is checked on the rows of one partition, not
through an index (an index path would be a schema change, and one stamp's inventory is small).

### 3.8 Deployment

| Check | Result |
|---|---|
| Queue `voice-number-operations` | In `deploy.ps1` and ARM `events.json`; name in both hosts' settings |
| Timer schedule | `VoiceNumbers__LifecycleSchedule` in every `local.settings` and in `deploy.ps1` |
| `VoiceNumbers` settings | The two hosts' sections are identical; class defaults equal the file; `LimitsCacheSeconds` is in both |
| Host composition | Functions host: the real `Program` composes under validation for all three stamps. API host: boots (2,518 endpoint tests ran on it). MCP and Identity: build, §9 |
| Schema | Nothing beyond revision 3. One new enum **value** (`ReservedForLastBusiness`) in an existing field — §10 |
| Order to deploy | Functions before API (the worker must exist before the API can queue a purchase) |

## 4. Tests

### 4.1 What now exists

| Suite | Host | Engine |
|---|---|---|
| Coordinator, purchase, hourly job (carrier read · due work · keep-or-return), projector, billing gate, alerts, limits, worker function, timer function | Functions — unit | Real services over an in-memory inventory with real version-tag behaviour and a scripted carrier |
| Allocation service (+ edge cases), admin number flows, both number controllers, the alert-types endpoint, the list queries' text and page rule, the refusal-sentence guard | API — unit | Same |
| Inventory repository, coordinator, billing gate, worker, hourly job | Functions — **integration** | **Cosmos emulator with the production index policy + SQL Server** |
| The number lifecycle over HTTP + the existing AI Assistant endpoint suite | API — **integration** | **Real pipeline, emulator, SQL Server**; a second host with self-service on |
| Rules, hooks, screens and wiring of the number screens | The four apps | jest; every rule of the contract that a screen draws |

### 4.2 Findings about the tests themselves

| # | What was wrong | Fix |
|---|---|---|
| T-1 | Both in-memory inventories were kinder than the real database (F-M) | The real repository fixed; proven on the emulator |
| T-2 | The profile double changed the stored profile even when the write "lost" | Copy on read, store only on a winning write — it had been hiding every half-finished removal |
| T-3 | The endpoint suite had not been run since the backend landed | Run; it found H1 and five expectations written for the old design, now updated to the approved one |
| T-4 | Two new tests passed against broken code | Found by the sabotage round below, and fixed |
| T-5 | A unit seed built a "parked" number in a shape the service never produced | Now the real shape |

In the apps, several tests had pinned a defect as if it were the rule ("does not poll one that is Open", "a
different number after no answer gets its own id", "an outcome this build does not know falls back to the
team arranging it", "cuts to the server limit first"). Each was rewritten with the rule it should have held.

### 4.3 Sabotage round

Eight backend fixes were broken at once (files copied to the scratchpad, restored by copy — never through git).

| Broken on purpose | Caught by |
|---|---|
| A write no longer hands back its version tag | 5 integration tests on the real emulator |
| A late confirmation takes the number whoever holds it | 5 unit tests |
| The hand-off re-reads instead of using the record it decided on | 2 unit tests (one only after T-4 was fixed) |
| A park is not a reservation | 3 unit tests |
| The owner's phone is adopted without the rules | 8 unit tests |
| One engine page is the whole answer | 2 unit tests |
| A choice recorded but never acted on is dropped | 3 unit tests |
| The missing registration (H1) | Seen for real: every endpoint test failed at start-up |

The screen reviewers did the same in their apps: provider web two rounds (13 and 17 tests failed, each on the
rule that was broken), provider app (70 failures across 5 suites with the original sources copied back),
admin app (12 fixes broken one by one), admin web (2 fixes). The price-approval rule (S-1) was broken on the
server in both places it is checked: 2 Functions tests and 4 API tests failed, each on a price dearer than the
one approved; files restored byte-identical and green again. **Not sabotaged**, and said so: the cross-check
fixes in the apps (§8, second column). Their tests assert things that did not exist before the fix (a notice,
a re-read, a field on the request), and older tests that had pinned the old rule failed when it changed, but
the new tests were not run against the old code.

## 5. What was verified, and how

| Claim | How it was verified |
|---|---|
| Conditional writes, the atomic counter, the two sorted reads, partition isolation, the stored shape | Run against the Cosmos emulator built from the production policy |
| Billing questions | Run against SQL Server |
| The whole flow | Run over HTTP through the real pipeline |
| What each screen draws for each answer | jest, with the service layer mocked. **Not** in a browser or on a device |
| What the server really answers to a screen | Read from the server code by each reviewer, and by the endpoint tests |
| Carrier behaviour | Against the fixtures and the official documentation recorded in part one. **Not** against a live carrier |
| The index a sorted query needs | By the source-scanning contract test and the pinned query text — **the emulator cannot prove it** |
| That a page from the engine is never longer than asked | **Assumed** from the SDK's documented behaviour; the code is safe either way (it never trims) |

## 6. NOT AUDITED, and why

| What | Why |
|---|---|
| A real purchase, return or listing at Telnyx or Plivo | Forbidden: it is billed. The first live purchase should be watched by a person |
| Production Cosmos (index binding, real RU cost, real page sizes) | Only the emulator is available; see §5 |
| Real devices and a real browser | Nothing was run on a phone, a tablet, an emulator or in a browser. Layout, keyboard overlap, long Hindi and Gujarati wrapping, the share sheet, screen readers and the dark theme were reasoned from code and tests. The provider web's responsive browser spec (`e2e/tests/responsive/ai-assistant-number.spec.js`) exists and lints clean but was **not run**: it needs a served app |
| A production build of either web app | Not built. Tests and lint only |
| Translations by a native speaker | es, fr, gu and hi were written by the model. A native read is recommended before launch, Gujarati and Hindi first |
| WhatsApp template approval | Unchanged from part one (R-3) |
| Load | No load test. The bounded reads and the daily limit are the protection |

## 7. Accepted as they are

- "Your number is ready" is sent **after** the request is marked complete. A host that stops between the two
  loses that one notice; the screen still shows the number. The other order would send it twice.
- A specific-number request that the team answers is shown on the screen only; no push is sent.
- The reason "Other" on a removal shows the general sentence; the admin's own words are in the notice.
- An admin's manual "Return now" shows the number as "being returned" until the next hourly run confirms it.
- An admin can buy above the price cap only through the explicit tick on the dialog (design A4), and only at
  the price that was on screen when they ticked (S-1).
- A number Telnyx already rents to us that our records never held comes into the inventory with no price
  (Telnyx's listing of owned numbers carries none). Once free it is "price unknown": never offered to a
  business, and returned before its next rent. That is the safe reading of a price nobody recorded.
- Where the team gives numbers, an admin approves a submitted application before assigning its number: two
  steps, as designed.
- The setting is still called `ReservationMinutes` (the approved design's key). It now means "how long work
  in flight has before the hourly job takes it over".

## 8. The four screens — reviewed against the contract, then against each other

**How.** Each app was read end to end by a reviewer that had not built it, against `UI-CONTRACT.md` and the
server code. Each reviewer fixed what it confirmed, in its own repository only. Then the four reports were
laid side by side: a defect one reviewer fixed in its app was looked for in the twin app, and fixed there too.
That second step found 27 of the 84.

| App | Fixed by its reviewer | Fixed in the cross-check | Tests after |
|---|---|---|---|
| Provider web | 11 | 9 | 5,996 (433 suites, the whole repository) |
| Provider app | 12 | 6 | 7,540 (453 suites, the whole repository) |
| Admin web | 13 | 6 | 1,062 (67 suites, the whole repository) |
| Admin app | 21 | 6 | 550 (33 suites, the whole repository) |

### 8.1 Money 💰

| # | Where | What was wrong | What it would have cost | Fix |
|---|---|---|---|---|
| U-1 💰 | Admin app | The quote and the "Buy this number?" confirmation read price fields the server no longer sends | **Every purchase price was shown as $0.00.** An admin approving a purchase could not see what it cost | Reads the real fields; an unknown price says "Unconfirmed" and cannot be bought |
| U-2 💰 | Admin app **and** admin web | Every purchase told the server "you may buy above the price limit" | The server quotes again just before it orders. A price that rose above the limit after the admin looked would have been bought, unseen | The flag is deleted (S-1 below). The screens send the approved price, and only when the admin ticked the above-limit approval |
| S-1 (counted in §3.1) | Server | The approval to buy above the limit was a yes/no | Even with U-2 fixed: an admin approves $4 a month, the price is $40 when the order goes out, and it is bought | The request carries the price that was approved. A dearer fresh quote is refused — "The price of this number went up after you approved it" — and nothing is bought. 9 tests |
| U-3 💰 | Admin web | **Release** on a cancelled business returned the number to the carrier on one click | A number given back by a mis-click; buying it again costs the one-time fee, if it can be had at all | A dialog, a tick, a red button, one request however often it is pressed |
| U-4 | Admin app | A slow price check for number A could land after the admin typed number B | A's price shown, B bought | A late answer for another number is dropped |
| U-5 | Both admin apps | A double tap queued two confirmations | A second write after the first had finished | One confirmation at a time |

### 8.2 A provider left stuck, or told something untrue

| # | Where | What was wrong | Fix |
|---|---|---|---|
| U-6 | Provider web + app | After "confirm" got no answer, the provider could pick another number and a **second request went out with a new id** | The number is locked until the server answers; the unanswered id is watched |
| U-7 | Provider web + app | For a number we already hold the server assigns it inside the confirm call. The screens treated that finished answer as "history" and stayed on the picker | The answer is a read of that request: the screen re-reads and shows the number |
| U-8 | Provider web + app | A request read in its first status was drawn as "setting up" and then never read again | Read again, like the others |
| U-9 | Provider app | "Activate AI Assistant first" and "Confirm your business phone" never lifted: the provider fixed the problem, came back, and saw the same card until the app was restarted | Asked again when the provider returns to the screen |
| U-10 | Provider web | A loading skeleton could stay for ever after an application was rejected and re-submitted in one sitting | State left by an earlier read is cleared |
| U-11 | Provider web + app | An answer the screen did not know drew "Our team is arranging your number" | A promise nobody made. Now the error state with Try again — the app can be older than the server |
| U-12 | Provider web + app | "The number changed while this was being saved" was shown and nothing was re-read; neither was a plain refusal | Both re-read the assistant and the number status |
| U-13 | Provider app | The daily limit was drawn over the picker with **Continue** still live | Its own state: the server's sentence, no button |
| U-14 | Provider web + app | A draft saved as "use my own number", then switched to a dedicated number, showed the old phone as "the number we ring" | The server drops it on save; the screen now says "We'll ring the business owner's confirmed phone number" |
| U-15 | Provider web + app | An open "particular number" request and its Withdraw disappeared under some views | Shown under every view |
| U-16 | Provider web + app | In own-number mode, a number status that could not be read showed nothing at all — the "your number is held until…" notice was simply missing | One notice with Try again |
| U-17 | Provider app | "Held until…" stayed on screen after the moment passed | Re-drawn at the moment |
| U-18 | Provider web + app | Three refusals showed the screen's own words instead of the server's sentence; one notice said the same thing twice | The server's sentence, once |

### 8.3 An admin shown the wrong thing

| # | Where | What was wrong | Fix |
|---|---|---|---|
| U-19 | Both admin apps | An empty page that still had more to read said "No requests need attention" | A business waiting on a later page would never have been seen. "Nothing on this page" + Load more |
| U-20 | Admin web | After assign / remove / change, the Numbers tab still offered **Keep** and **Return now** on the number just assigned | Lists are re-read |
| U-21 | Both admin apps | A refused assign left every list stale, though the server may already have placed an order or handed the request back | Re-read after a refusal too. No answer at all is "unconfirmed", never "failed" |
| U-22 | Both admin apps | A parked number read "reuse wait"; the way out it described ("remove it from them") is impossible; un-keeping did not say it ends the park | "Parked", who it is parked for, and what each button does to it |
| U-23 | Both admin apps | The release choices: "Parked" did not say rent continues and it is never returned by itself; "Returned" promised a waiting period a trial-only business does not have | Rewritten |
| U-24 | Both admin apps | A request ended because the service ended showed a raw code | A sentence |
| U-25 | Admin app | Rent under one cent read 0.00; a time with no zone marker was read as local time | Shown in full; read as UTC, zone named |
| U-26 | Admin web | A reuse wait whose date had passed read "until <a past date>" for ever | "Ended" |
| U-27 | Both admin apps | A new alert type about numbers, added on the server later, would have had no link | Any type whose name starts `VoiceNumber` or `VoiceCarrier` opens Numbers; an application alert opens the business |
| U-28 | Admin web | **Reject** was offered only before approval; the server allows it until the business has a number, and the admin app offered it | Offered in both states, as in the app |
| S-2 | Server | Three purchase refusals on the admin's assign path said "our team will arrange one for you" — to the admin | Reworded ×5 languages: what was not bought, and what to do |

The rest are smaller: wording, a missing loading placeholder, keyboard overlap on the limits form,
accessibility labels, search by label, dead code, test warnings. Each is in the code and has a test where a
rule was involved.

### 8.4 Checked and found right

One reader of the number status per screen, and one poller: 5 seconds for a minute, then 15, stop at ten
minutes, paused when the tab is hidden, the app is in the background or the device is offline, one read on
return, the read in flight cancelled on leaving · the same request id on every retry of the same thing ·
no carrier cost on any provider screen · no "refresh numbers" button · the removal card first on the page and
not dismissible · 125 new provider keys (web) and 128 (app) present in all five languages with identical
placeholders, none left in English, none using a word from the contract's list · every admin dialog
single-flight, focus-trapped, closes on Escape · Return now never offered for a number in use, being bought,
or already returned · `+` sent as `%2B` · the alert type list read from the server in both admin apps.

### 8.5 Left as they are, with the reason

- **"Carrier" in three removal reasons a provider can read** ("moved to a new carrier"). The sentences are
  older than this work; the word is not on the contract's list and the own-number flow already says "your
  carrier" to providers. Not changed. Say the word and they become "phone company" in five languages.
- **The "Request sent" announcement for screen readers** joins two sentences with ". " in every language.
  Heard, not seen. Not changed.
- **Close request** is a red button on the web and a green one in the app: each follows its own app's rule
  for a confirming action. Not changed.
- **A kept number that later needs a review** can be returned from the screen but not un-kept. Returning it is
  the action that review calls for.
- **React "not wrapped in act" warnings** remain in two older admin-web test files (the alerts fetch, the
  limits save). The tests pass; the warnings are noise from code older than this work.
- **One test helper in the admin app** clears call counts but not queued one-time answers, so one failing test
  can make the next fail too. It cannot make a failing test pass.

## 9. Final figures

Whole-suite runs. Where a suite was last run in full before the final server change (the price approval), the row says so and gives what was run again after it.

| Suite | Result |
|---|---|
| API — unit, whole suite | **15,562 passed · 0 failed** |
| API — integration, whole suite (real HTTP, Cosmos emulator, SQL Server) | **2,518 passed · 0 failed · 18 skipped** (tests that skip themselves by design; none is in this feature) — run before the price-approval change; the voice and alert tests run again after it: 121 passed · 0 failed · 0 skipped |
| Functions — unit, whole suite | **8,608 passed · 0 failed** |
| Functions — integration, whole suite | **882 passed · 0 failed** — run before the price-approval change; the number tests run again after it: 62 passed · 0 failed |
| MCP — unit | 1,385 passed and 1 failed on the full run. The one failure was a test with a hard-coded date that expired on 1 October; fixed, and its class re-run 33 of 33. Builds after the last change: yes, 0 errors |
| Identity — unit | 1,322 passed · 0 failed. Builds after the last change: yes, 0 errors |
| Provider web | **433 suites · 5,996 passed** (whole repository) · ESLint 0 errors, 0 warnings on every file of the feature |
| Provider app | 453 suites · 7,540 passed (whole repository) · `tsc` clean · ESLint 0 errors |
| Admin web | **67 suites · 1,062 passed** (whole repository); the feature's suites run again after the last edit: 29 suites · 564 passed · ESLint 0 errors, 0 warnings on every file of the feature |
| Admin app | 33 suites · 550 passed (whole repository) · `tsc` clean · ESLint 0 errors |

Two failures met on the way were not in this feature and were fixed so the suites are green: the MCP date
test above, and an API test of the WhatsApp send gate that timed out when the machine was busy (its deadline
is now 60 seconds; 27 of 27).

## 10. With the owner

| # | What | Why it is yours |
|---|---|---|
| O-1 | **`businessName` on the request record.** It is stored, and the admin queue shows it | It is not in the approved schema (revision 3). Approve it, or it comes out and the queue reads the name another way. Nothing else outside revision 3 is stored |
| O-2 | **P1 and P2** from `DECISIONS-2026-10-01.md` | Built as recommended (the 24-hour hold starts when billing really ends the service; four text amendments to the mockup). Never answered |
| O-3 | **States built beyond the approved sheet** | Listed in the mockup register (`PLAN.md`), for review. The largest is the confirmation on **Release** for a cancelled business (U-3) |
| O-4 | **Three sentences that say "carrier" to a provider** (§8.5) | A wording call |

Not schema, recorded so nothing is a surprise: one new enum **value** in an existing field
(`ReservedForLastBusiness`), one new setting (`VoiceNumbers:LimitsCacheSeconds`, in both hosts' files, no
`local.settings` or ARM entry needed), two new request fields on the admin assign / change calls
(`approvedMonthlyRental`, `approvedSetupFee` — an API shape, nothing stored), and the new refusal
sentences in all five languages.

**Deploy order:** Functions before API. **The first live purchase should be watched by a person** — nothing
in this programme has ever touched a real carrier.
