---
name: clinqet-delivery-feedback
description: |
  **CORE FEATURE SKILL** — Work on delivery-failure feedback: what happens when a carrier ACCEPTS a
  message and then, hours later, reports it never arrived. Two SystemData documents keyed by carrier
  message id and by ADDRESS; four verdict paths (ACS bounce report, Telnyx delivery receipt, Meta
  status, and 2Factor's unsigned India delivery callback); WhatsApp late recovery that sends the text
  that was held back; the MessageDeliveryFailed
  notice; and the provider/customer surfaces that warn BEFORE a send rather than apologise after one.
  USE FOR: carrier error-code classification, address health, the delivery-health lookup endpoint,
  the held-back-text claim, operational notices that preferences may not silence, CRM delivery pills.
  Applies to clinqetcore/Interfaces/Communication/{ICarrierMessageLookupStore,IAddressHealthStore}.cs,
  clinqetinfrastructure/Services/Communication/{CarrierMessageLookupStore,AddressHealthStore,DeliveryVerdictClassifier}.cs,
  clinqetfuncations Services/DeliveryFailureFeedbackService.cs + Functions/{EmailDeliveryReportProcessor,SmsWebhookFunction,WhatsAppStatusProcessorFunction,TwoFactorDeliveryReportFunction}.cs,
  clinqetapi Controllers/DeliveryHealthController.cs, clinqetshared/Models/DeliveryTrackingSettings.cs,
  clinqetwebpartnerapp src/components/common/DeliveryProblem.jsx + src/hooks/useDeliveryProblem.js,
  clinqetwebuserapp components/common/DeliveryProblemNotice.jsx,
  clinqetmobilepartnerapp src/components/DeliveryProblemBadge.tsx,
  clinqetmobileuserapp src/components/DeliveryProblemNotice.tsx.
---

# CLINQET DELIVERY-FAILURE FEEDBACK — COMPREHENSIVE SKILL

> **The one-line summary.** A carrier accepts a message, then hours later says it never arrived. Before this
> existed, only an admin ever found out. Now the person who can fix it is told, the address is remembered so
> the next send warns first, and — for WhatsApp — the text that was held back is sent instead.

---

## 0. THE RULES THAT GOVERN EVERY CHANGE HERE

| # | Rule |
|---|---|
| 1 | ‼️ **Silence is earned by nothing having been lost, never by an error code.** If a message is gone and a human could act, that human is told |
| 2 | ‼️ **Our own wall is admin-only.** Credit, registration, reputation, content, throughput — a provider can do nothing about any of it |
| 3 | ‼️ **An unrecognised code falls to `MessageLost`, never `OurWall`.** A lost customer message nobody is told about is worse than an admin alert nobody needed |
| 4 | ‼️ **Never verify a carrier code from its name.** Every code in `DeliveryVerdictClassifier` is quoted from the provider's published reference. Add one only with the same evidence |
| 5 | ‼️ **The address is the key, never the contact.** Correct the address and the key changes, so the marker is gone with nothing to clear. Stale is impossible by construction |
| 6 | ‼️ **Amber, never red. Advisory, never a block.** No disabled buttons, no "dismiss", nothing gated on a marker |
| 7 | ‼️ **Exactly one point read per verdict, one write only on a terminal failure** |

---

## 1. THE TWO DOCUMENTS (SystemData, pk `/pk`)

Both are single-document partitions — the key **is** the partition key — so point reads are the only access
shape and a cross-partition query is impossible by construction (§0.6 satisfied by design).

| | `CarrierMessageLookup` | `AddressHealth` |
|---|---|---|
| **Answers** | "who was this for, what was it about, and what should go instead if it fails?" | "is this address known bad?" |
| **id / pk** | `carriermsg_{channel}:{id}` / `{channel}:{id}` | `addrhealth_{channel}:{addr}` / `{channel}:{addr}` |
| **Written** | at send time, by the transport | ONLY on a **terminal** verdict |
| **TTL** | 72h (7d for WhatsApp, whose record also threads inbound replies) | 180d, refreshed on each new failure |
| **Cost when nothing fails** | one ~5 RU write | **zero** |

‼️ **Every optional property is `[JsonProperty(NullValueHandling = NullValueHandling.Ignore)]`** — production
serialises nulls (`ClinqetCosmosSerializer` uses the SDK default), so an absent field would otherwise cost
storage. The global setting is deliberately NOT flipped.

### ‼️ THE DICTIONARY TRAP — read this before adding any map-shaped field

`ClinqetCosmosSerializer` uses `CamelCasePropertyNamesContractResolver`, which sets
**`ProcessDictionaryKeys = true`**. A `Dictionary<string, string>` on a Cosmos document round-trips with its
**keys lower-cased**: `"Number"` is stored and read back as `"number"`.

This silently broke the retired ticket store's template data. The held-back text is therefore stored as a
**`JObject`**, whose keys Newtonsoft writes verbatim, and an integration test asserts the lower-cased key is
**absent**. Use a `JObject` for any new map whose keys matter.

Four existing entities (`CallSummary.Payload`, `BusinessProfile.SocialLinks`, `Notification.Data`,
`ExternalChannelIds`) have always behaved this way and their consumers read the camel-cased keys — do NOT
"correct" them.

---

## 2. THE MERGED RECORD — one document, two jobs

`CarrierMessageLookup` carries **identity** (who it was for) and, for WhatsApp, the **text that was held
back** because WhatsApp was going to carry the message. There used to be two record types for this, keyed
identically, in the same container, with the same lifetime, read at the same instant. That was drift.

| Operation | Shape |
|---|---|
| `RecordAsync` | `CreateItemAsync`, conflict = idempotent. Returns **false** only on a genuine write failure, so a caller that attached a held-back text can alert that recovery is silently unavailable |
| `TryGetAsync` | Point read. ‼️ **null means NOT FOUND and nothing else — a failed read THROWS.** It used to swallow, which made a store outage indistinguishable from an id we never issued, so every verdict arriving during one was acked and thrown away. Callers decide: the 2Factor function catches ⇒ 503; the feedback service catches ⇒ admin-only alert; the two WhatsApp paths let it propagate ⇒ Service Bus retry, which is safe because `MarkProcessedAsync` runs only AFTER success |
| `TryClaimFallbackAsync` | ‼️ **ETag-conditional REPLACE, not delete.** Exactly one concurrent claimer wins, and the identity half SURVIVES — a claim that cannot send still has to name the person for the notice, and a read receipt still has to find its conversation |

‼️ **The claim can only be proven against a real engine.** `CarrierMessageLookupStoreIntegrationTests` races
ten concurrent claims and asserts exactly one wins. A mock cannot prove an ETag-conditional replace.

---

## 3. THE VERDICT PATHS — four, all in the Functions host

| Path | Trigger | Notes |
|---|---|---|
| `EmailDeliveryReportProcessor` | Event Grid → per-stamp queue | ACS statuses. Delivered/Expanded are filtered at the subscription |
| `SmsWebhookFunction.HandleDeliveryStatusFinalizedAsync` | Telnyx `message.finalized` | ‼️ Handles **both** arms: a failure marks, a **success clears** the marker (free — the carrier sends the receipt whether we use it or not) |
| `WhatsAppStatusProcessorFunction` | `whatsapp-status` queue | Reads the record ONCE, then decides; the feedback service accepts `alreadyRead` so the verdict still costs one read |
| `TwoFactorDeliveryReportFunction` | `POST api/sms/2factor/delivery` | ‼️ India. See §3.1 — the ONE `AuthorizationLevel.Function` trigger in this host |

### 3.1 ‼️ 2Factor (India) — the unsigned one

**An earlier version of this skill said 2Factor sends no delivery receipts. That was WRONG** — it was read
off our own code rather than from the vendor. They do, via a **Manage Services callback URL**, and it is wired.

| Fact | Why it shapes the code |
|---|---|
| **No signature of any kind** | So it cannot live in `SmsWebhookFunction`, which HMAC-validates every 2Factor request. It is the only `AuthorizationLevel.Function` trigger in this host, and the function key is the credential |
| `SessionId` is our `CarrierMessageId` | An id with no record is ignored silently — that is the second auth control |
| `SmsTo` is inconsistent | Their article 14 shows `8431345566`, article 3 shows `918431345555`. ‼️ **The address ALWAYS comes from our record** |
| ‼️ **The status table is published only as an IMAGE** | So the classifier reads only what their samples state in text: the DELIVERED group (name, or id `3`) and `ErrorPermanent` |

```
ErrorPermanent == true   ⇒ AddressUnusable / Unreachable
DELIVERED group          ⇒ clear the marker (guarded by SentAt — see below)
an error block present   ⇒ MessageLost
otherwise                ⇒ ‼️ NOTHING: no lease, no write, no notice, one Information log
```

‼️ **That last branch is not laziness, it is the design.** Their intermediate statuses are unpublished, and
treating "not DELIVERED" as a failure would tell a provider a message was lost while it was still travelling.

- **Dedupe** `2fdlr:{SessionId}:{StatusId}` under channel `SmsDlr2Factor`. Busy ⇒ **503** (they document no
  retry policy, so a 503 is the only thing that could recover it and can never be worse than a 200).
- ‼️ **Applied-but-unmarked RELEASES the lease instead of completing it.** The feedback service swallows a
  store failure by design, so nothing throws — completing would spend the only receipt this message gets.
- ‼️ **The stale-clear guard.** A DELIVERED receipt clears the marker only when `record.SentAt` is newer than
  the failure on record. Their receipts lag; without it, one late success un-warns a genuinely dead number.
- ‼️ **The callback URL is the INDIA per-stamp hostname**, `https://function-in.<apex>/api/sms/2factor/delivery?code=…`.
  The apex `function.<apex>` route is bound to a **stamp-named origin group**, so it is NOT geo-routed and
  must never be used for a region-specific callback. **Three independent layers keep this off Canada**:
  the `function-in` domain's route resolves to `…function-origin-group-in` and can reach no other origin ·
  `DeliveryTracking__TwoFactorDeliveryReportsEnabled` is deployed **false** on every non-IN stamp ·
  and a non-IN Cosmos holds no India send record, so an unknown session is ignored anyway.
- ‼️ **2Factor supports NO authentication other than the URL itself.** Their whole transactional KB category
  (7 articles, read 2026-09-20) documents no signature, no custom headers, no basic auth and no published
  callback source IPs — and they cannot send an `x-functions-key` header, so the key is forced into the
  query string. Blast radius is minimised instead: `deploy.ps1` mints a **dedicated key named
  `twofactor-dlr`**, scoped to **this one function** where the host has indexed it (a named host key of the
  same name otherwise) — ‼️ **never the master key and never the shared `default`**, so a leaked URL reaches
  exactly this endpoint and is revoked on its own. It is **read before create**: minting on every deploy
  would rotate the key and silently break the URL already registered in their portal.
  The one control still missing is an IP allowlist — if their support ever publishes callback source
  ranges, add an `IPMatch` rule beside `AllowProviderWebhooks` and the key alone stops being enough.
- ‼️ **A carrier path must be in BOTH webhook allow rules, and they must stay identical**:
  `commonWebhookAllowRule` in `networking.json` (apex function WAF) **and** `webhookAllowRule` in
  `networking-perstamp-health.json` (the per-stamp healthcheck WAF). The per-stamp one had no such rule at
  all until 2026-09-20. Missing from either, the callback does not fail loudly — it is inside the geo
  allow-list, so receipts arrive normally and then vanish against the 200/min per-IP block under load.
  ‼️ Keep it OUT of `baseRules`: the admin WAF composes those and must keep its IP allowlist over every path.
- ‼️ **`TwoFactorSmsService` records its address with `IN`.** It is handed a bare 10-digit national number,
  and the key normaliser falls back to **US** for a number with no `+` and no country — so it used to key
  every India send as `+1…`, which no `+91` contact could ever match.
- **OTP sends record no carrier message**, so an OTP receipt takes the ignore path — deliberate (DR-1: an
  India OTP failure is already alerted at send time and there is no contact to warn).

### The classifier

`DeliveryVerdictClassifier` turns a carrier's own vocabulary into a `DeliveryFailureDisposition`
(`AddressUnusable` · `RecipientDeclined` · `MessageLost` · `OurWall`).

| Carrier | Verified meaning |
|---|---|
| **ACS** | Bounced, Suppressed ⇒ the address is dead. Quarantined, FilteredSpam ⇒ **our reputation**, admin only. Failed ⇒ lost, no conclusion |
| **Telnyx** | `40001` not routable · `40012` destination rejected · `40310` invalid 'to' ⇒ **dead number**. `40300` STOP ⇒ **declined, number is fine**. `40004`/`40006` recipient server ⇒ **lost**. The rest ⇒ **our wall** |
| **Meta** | `131026` not a WhatsApp number · `131047` 24h window · `131050` opted out of marketing · `131042` payment · `131048` quality · `130429` throughput |

‼️ **`40300` and `131050` must NEVER mark the address.** The number works; the person said no, and the
consent store owns that state.

---

## 4. WHATSAPP LATE RECOVERY

WhatsApp accepts a message, then later says the number has no WhatsApp. The text that was held back (because
the dispatcher suppresses SMS when WhatsApp will send) is claimed and sent, so the customer still gets it.

| Gate | Where |
|---|---|
| A text exists at all | Only when the caller supplied an SMS template, the person's text preference is on, and it is not India. ‼️ **Chat messages set no SMS template, so they can never produce one** |
| The switch | `DocumentSmsFallbackEnabled` for a Direct (voice-document) text, `DeliveryTracking:WhatsAppLateFallbackEnabled` for everything else |
| Staleness | `DeliveryTracking:LateFallbackMaxAgeMinutes` (30). Past it the text is stale and the provider is told instead |

‼️ **Both the switch and the staleness cutoff are judged BEFORE the claim, never after.** A brief ops flip
must not destroy recovery state — declining leaves the text on the record, where it either recovers when the
switch returns or expires with the record.

‼️ **The only silence a delivery failure earns is a fallback that actually delivered.** `131026` is NOT on
the silent list: for an ordinary send nothing goes out as a text and the message is simply gone.

---

## 5. THE NOTICE

`NotificationType.MessageDeliveryFailed`. ‼️ **SIX registrations, not the four you would guess:**

1. the enum value
2. `SignalRSettings:EnabledNotificationTypes` (guarded by `SignalRWhitelistCompletenessTests`)
3. `NotificationRoutingCatalog` — `WorkIntake` + `customer.read` + `customer: true`
4. **`NotificationEchoCatalog`** — `Deliver`: the sender IS the actor and the only person who can fix the address
5. `NotificationRoutingCatalogTests.Expected` + its polymorphic contract
6. `NotificationEchoCatalogTests`

‼️ **Deliberately NOT in `ProviderCategories` / `CustomerCategories`.** Those maps drive the settings screen,
and an operational notice nobody may switch off must not render as a toggle. It has no fixed topic either —
it borrows the failed thing's, per dispatch.

### `IsOperational` — where preferences ACTUALLY bite

One flag on `CommunicationRequest`, honoured in **three** places:

| Place | Why |
|---|---|
| `CommunicationDispatcher` — `pushEnabled` | The preference gate |
| `BusinessCommunicationDispatcher.DigestChannels` | A member on Digest would have had "your message never arrived" batched into tomorrow's digest |
| `BusinessCommunicationDispatcher.ApplyRoutingContext` | ‼️ **The one that matters.** It sets `SkipInApp`/`SkipPush` from the member's channel policy BEFORE the dispatcher sees the flag |

`selfEcho.SuppressPush` is still honoured — that is the self-echo guard, not a preference.

### ‼️ `DispatchOperationalNoticeAsync` has no defaults any more

It used to default `routingClass` to **`Awareness`**, which `NotificationRoutingCatalog` states outright
*"resolves ZERO recipients by design"* — so `HandleEmailFailureAsync` delivered **nothing at all** to a
provider. `preferenceCategory`, `routingClass` and `permissionKey` are now all required, so the compiler
forces the decision. Never give them defaults again.

---

## 6. THE SURFACES

| Surface | Component |
|---|---|
| Provider web — contact list | `DeliveryProblemPill` under the email and phone cells; one lookup per page |
| Provider web — add/edit contact | `DeliveryProblemFieldHint` + `useDeliveryProblem` (500ms debounce, aborts in flight) |
| Provider mobile — CRM | `DeliveryProblemBadge` |
| Customer web — profile | `DeliveryProblemNotice` under their own email and phone |
| Customer mobile — profile | `DeliveryProblemNotice` |
| Reset screen | ‼️ An **address-INDEPENDENT** helper line only — see below |

**The read**: `POST /api/v1/delivery-health/lookup`, authenticated, batched per channel via
`ReadManyItemsAsync`, capped by `AddressHealthLookupMaxAddresses`. Only addresses WITH a problem come back —
an address absent from the answer has nothing against it.

### ‼️ WHY THE RESET SCREEN CANNOT SHOW A PER-ADDRESS MESSAGE

`AuthService.RequestPasswordResetAsync` returns success for an account that does not exist, with the comment
*"For security reasons, don't reveal that the user does not exist."* The screen is anonymous. A per-address
answer there — from a new anonymous endpoint or folded into that response — would make the reply differ by
address and turn a deliberately non-enumerable endpoint into an **account-enumeration oracle**.

The locked-out person gets an always-shown, address-independent line, the admin alert still fires, and the
help centre offers **phone** support so the loop does not close back onto the broken channel.

### Design tokens — measured, not invented

Amber bg `#FFF7E8`, line `#F1D9A7`, ink `#9A5B00`; greyed to `#E7E7E7` / `#5F6672` once older than
`AddressHealthRecentDays`. Brand green `#97EF29` fills "send anyway". ‼️ **Red `#FF3B30` is used nowhere in
this feature** — nothing here blocks.

---

## 7. SETTINGS (`DeliveryTracking`, mirrored in all four hosts)

`CarrierMessageTtlSeconds` 259200 · `WhatsAppCarrierMessageTtlSeconds` 604800 ·
`AddressHealthTtlSeconds` 15552000 · `AddressHealthRecentDays` 90 ·
`WhatsAppLateFallbackEnabled` true · `LateFallbackMaxAgeMinutes` 30 ·
`AddressHealthLookupMaxAddresses` 50 · `AddressHealthLookupsPerMinute` 300 ·
`TwoFactorDeliveryReportsEnabled` true.

Class defaults mirror `appsettings.json` exactly, pinned by `DeliveryTrackingSettingsConventionTests` (§0.12).
‼️ That test has NO "every setting has a reader" sweep on purpose: the lookup cap and window are read from
the API repo and the rest from the Functions repo, so a sweep run from either side would report the other
side's settings as orphans — a guard that INVENTS bugs (§0.15/§0.17).

No new Azure resource, queue, container or `local.settings.json` key. ‼️ **TWO ARM files all the same**:
the 2Factor route in `commonWebhookAllowRule` (`networking.json`) and in `webhookAllowRule`
(`networking-perstamp-health.json`).

---

## 8. TESTS

| Suite | What |
|---|---|
| `Clinqet.Communications.UnitTests` | `DeliveryVerdictClassifierTests` (every verified code), `DeliveryFailureFeedbackServiceTests` (the audience matrix, one-read contract, degradation), `DeliveryAddressKeyTests`, `TwoFactorDeliveryReportTests`, `TwoFactorDeliveryReportFunctionTests`, `DeliveryTrackingSettingsConventionTests` |
| `Clinqet.API.UnitTests` | `DeliveryHealthControllerTests` (batching, the cap, only-problems-returned, recency, ‼️ the pacing: 429, the per-address charge, the bucket) |
| `Clinqet.Communications.IntegrationTests` | ‼️ **Mandatory** — the ETag claim race, identity surviving the claim, the verbatim dictionary key, and `TwoFactorDeliveryReportDedupeIntegrationTests` (redelivery, two verdicts for one session, channel isolation, 10-way concurrency, release-and-retake) |

Placement follows §0.18: the feedback service and the classifier are tested from the **Functions** suite
because the Functions host is what drives them, even though the classifier lives in `clinqetinfrastructure`.

---

## 9. THINGS THAT ARE TRUE AND SURPRISING

- ‼️ **2Factor DOES send DLRs** — the opposite of what this skill used to say. See §3.1.
- ‼️ **An absent `deliveryContext` is invisible.** `RoutingSmsService` accepted one and forwarded it on none
  of its four delegations, and both providers' templated path dropped it again — so every SMS send record
  had no recipient and every SMS failure quietly degraded to an admin-only alert. Nothing failed; it just
  never told anyone.
- **A Moq `.Callback<T1…Tn>` carries its own arity**; widening a `Setup` without widening its callback throws
  in the test CLASS CONSTRUCTOR and fails every test in that class.
- **`ToE164` returns a `+`-prefixed number unchanged**, so `DeliveryAddressKey` reduces it to `+` plus digits
  — otherwise "+1 555 123 4567" and "+15551234567" would be two keys and the warning would never appear.
- **A hard bounce is durable, so the record persisting is correct, not stale.** Email has no cheap success
  signal (we do not subscribe to Delivered); SMS does, so only SMS clears on success.

## 10. ‼️ THE RECORD NOW ALSO HOLDS AN EMAIL BACK (2026-09-21, WhatsApp-for-chat)

Authority: `C:\Nik\Data\whatsapp-chat-messages\PLAN.md`. Mechanics: `clinqet-whatsapp`.

`CarrierMessageLookup` gained **three** §0.7-approved fields and **nothing else** — no message text, no address, no
link. All three are `bool?`/`DateTime?` with `NullValueHandling.Ignore`, because ABSENT is the steady state:

| Field | Written when | Cleared by |
|---|---|---|
| `emailHeld` | the FIRST part of an in-window chat relay, or a closed-window notice, when an email exists and `DeliveryTracking:ChatEmailHoldBackEnabled` is on | the one claim that wins (`TryClaimHeldBackEmailAsync`, which also stamps `emailReleasedAt`), or a Meta `delivered` (`TryClearHeldBackEmailAsync`, which deliberately stamps NOTHING — nothing was released) |
| `emailReleasedAt` | by the claim only | — |
| `chatRelay` | **every** part of a relay — the session text, the interactive first line and each attachment | never |

‼️ **`chatRelay` is the only way a delivery verdict can tell a relay from a notice.** A relay earns the sender's
delivered tick; a notice must never claim one, because a notice reached them and the words did not. A record with
neither field is an ordinary transactional template and a `delivered` for it writes nothing at all.

‼️ A **two-valued `emailHeld`** was proposed and rejected: a relay to a recipient with no email on file holds
nothing, so it would never get the tick. The kind of send is a fact about every chat WhatsApp, independent of
the hold.

`MutateEmailHoldAsync` serves both the claim and the clear through ONE ETag-conditional replace, so a redelivered
status can never release twice. `CarrierMessageLookupStoreIntegrationTests` races ten concurrent claims, reads the
raw JSON back to prove nothing but the approved fields was written, and pins delivered-then-check ⇒ nothing and
check-then-delivered ⇒ exactly one email.

‼️ **`TryGet_WhenTheReadItselfFails_Throws` forces the failure with a WRONG KEY against the real endpoint.** The
older version pointed at a non-existent DATABASE, and the emulator answers that with the same **404** as an absent
item — so the test asserted a throw and got a clean "not found", proving the opposite of its own claim.

**Three new settings**, mirrored in all four hosts with identical class defaults:
`ChatEmailHoldBackEnabled` true · `LateEmailFallbackMaxAgeMinutes` 360 · `WhatsAppUndeliveredCheckMinutes` 120.
Plus `WhatsApp:ChatAttachmentSasExpiryMinutes` 60 in the **Functions host only** — it is the only host that mints a
read SAS for a chat attachment.

**The undelivered check reuses the existing `whatsapp-status` queue** with `WhatsAppStatusMessage.Kind =
DeliveryCheck` and an EMPTY `Status`. ‼️ Its branch therefore sits **ABOVE** the missing-status dead-letter guard in
`WhatsAppStatusProcessorFunction`, or the only thing that notices a message WhatsApp accepted and never delivered
would be silently dead-lettered. No new queue, no new function, no ARM change.

**The chat verdict is NOT a `MessageDeliveryFailed` notice.** `IsChatSend` suppresses the "please try again" notice
for both a relay and a closed-window notice: the words are already in the conversation either way, and the sender
learns the outcome from the tick and the muted line under their own bubble instead. The admin alert stays.
