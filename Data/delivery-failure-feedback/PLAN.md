# Telling the human when a message did not arrive — PLAN

> **Status: APPROVED — solution, §0.7 schema and mockup all signed off by the owner 2026-09-19. IMPLEMENTATION IN PROGRESS from P0.**
> Authority document. Sibling: `Data\integration-health-alerts\PLAN.md` (admin-facing, shipped 2026-09-19).
> This is the **person-facing** half: the provider and the customer, not the administrator.

---

## 0. ‼️‼️ RULE ZERO — NEVER ASSUME. ASK.

**Owner-mandated, and it outranks every other instruction in this document.**

> **If anything is unclear, unstated, or would require a guess — STOP and ASK the owner. Do not decide it
> yourself. Do not pick "the reasonable default". Do not defer it to a later phase.**

This applies **inside** the plan as well as outside it:

- If implementing a phase reveals that a decision in this document is **wrong, incomplete, or does not fit
  the code as it actually is** — stop and ask. Do not quietly deviate, and do not quietly comply with
  something you can see is wrong.
- If a phase turns out to need something not written here — a field, a setting, a queue, a screen, an
  extra call — **that is a new decision. Ask.**
- ‼️ A line in this plan is **not** §0.7 approval for anything beyond what §7 lists. A plan saying "add X"
  is not approval to add X (CLAUDE.md §0.7).
- If a guess has already been made, **say so immediately**, list it, and offer to revert.

The cost of one question is always lower than the cost of an unintended change.

---

## 1. The problem in one sentence

When a message is lost **after** we hand it to a carrier, the only person who finds out is an
administrator. The provider who sent the quote, and the customer who never received it, are told nothing.

---

## 2. Facts established by reading the code (not assumed)

| # | Fact | Consequence |
|---|---|---|
| F1 | `HandleEmailFailureAsync` and `HandlePdfGenerationFailureAsync` **already** notify the affected human in-app/SignalR/push via `DispatchOperationalNoticeAsync`, with `SkipEmail`/`SkipSms` true | The mechanism exists and is proven. Only the **async verdicts** are unwired |
| F2 | Async verdicts carry no identity: ACS bounce gives `messageId` + an address; Telnyx DLR gives `MessageId` + a number | We cannot say who to tell |
| F3 | WhatsApp already solves this — `WhatsAppConversationLookupStore` in `SystemData`, id `{prefix}{wamid}`, TTL configurable (default 7 days), maps wamid → conversation/user/business | The pattern exists for one channel. Generalise it; do not add a fourth store |
| F4 | ACS delivery reports are documented as delayed **up to 6 hours, some 12–18 hours** | A 30-day TTL is ~40× the worst observed case. 72 hours is right |
| F5 | Preferences are stored **per category × channel**; channels are `email`, `push`, `sms`. **There is no `inApp` key** | The bell always receives. What preferences can silence is the **push** that makes someone look |
| F6 | `MandatoryEmailCategories = { BookingNotifications, QuotesInvoices, BillingPayments }`, and `IsEmailMandatory` forces **email only** | A mandatory concept exists but covers one channel |
| F7 | ‼️ **`MarketingPromotions` is EMPTY** — zero notification types map to it, provider or customer | It is a settings toggle that governs nothing. See D-1 |
| F8 | `ClinqetCosmosSerializer` runs `NullValueHandling.Include` in production | Nulls are **written**. Optional fields must be marked `Ignore` individually or they cost storage |
| F9 | Identity sends some mail directly (`SendVerificationCodeAsync`), outside the category system | A caller-by-caller approach would miss it |

### Defects found while reading

- **D-1 ‼️** `DispatchOperationalNoticeAsync` defaults `preferenceCategory` to `MarketingPromotions`, and
  **both** call sites take the default. Combined with **F7**, this is worse than a mislabel: the failure
  notice is filed in the one category that is otherwise **empty**. A provider who switches off "Marketing"
  — expecting to stop promotional mail they have never received — silences **only** the delivery-failure
  push. It is a trap.
- **D-2** Those notices deep-link to `/dashboard`, not to the thing that failed.

---

## 3. The three design decisions, and why

### 3.1 Write the record at the TRANSPORT, not at the callers

This is the decision that dissolves every "which sends / what did we miss" question.

`AzureCommunicationServicesEmailService` is the single place every email leaves the platform.
`TelnyxSmsService` / `TwoFactorSmsService` are the same for SMS. `MetaWhatsAppService` already does it.

Put the write **there**, and:

- Booking, quote, invoice, team invitation, service approval, broadcast lead, voice, billing — covered.
- **Identity's verification and password-reset mail — covered for free** (answers "needed or overkill?": it
  is neither, it costs nothing extra and locking a user out of their account is the worst bounce we have).
- There is **no category list to maintain**, so nothing can be silently forgotten when a feature is added.

‼️ This is the same seam principle as the integration-health observers shipped on 2026-09-19: observe at the
one place the traffic passes, never at N call sites.

**No exclusion list.** F7 killed the original "exclude Marketing" idea — it would exclude nothing. The only
remaining candidate was `CartReminders` (one notification type), and excluding one type is not worth a
branch. Cost is negligible: one ~0.6 KB point write (~5 RU) per **successful** send, and this platform has
no bulk-marketing traffic through ACS.

### 3.2 TWO records, because a failure produces two different facts

| | `CarrierMessageLookup` | `AddressHealth` |
|---|---|---|
| **Answers** | "who was this message for, and what was it about?" | "is this address known bad?" |
| **Key** | `{channel}:{carrierMessageId}` | `{channel}:{normalisedAddress}` |
| **Written** | at send time, by the transport | only when a **terminal** failure verdict arrives |
| **TTL** | **72 hours** (F4, 4× the documented worst case) — WhatsApp keeps 7 days on the same record because its lookup also threads inbound replies | ~180 days, refreshed on each new evidence |
| **Volume** | one per successful send | one per **bad address** — not per contact, not per send |
| **Cost when nothing fails** | one small write | **zero** |

`AddressHealth` needs **no send-time write at all** — the bounce event already carries the address. So we
learn from every failure, including the cheapest bulk traffic, for free.

### 3.3 The record is self-sufficient — zero extra reads on the failure path

The failure handler must do **one point read and nothing else**. So the record carries everything the
notice needs: `userNumber`, `userId`, `businessId`, recipient type, **preferred language** (so we do not
read a profile to translate), notification type + category (so we route correctly), context type + id +
a short display label (so the notice can say "Quote #1043" without reading the quote), actor, channel,
address.

‼️ **F8 applies**: production writes nulls. Every optional property is marked
`[JsonProperty(NullValueHandling = NullValueHandling.Ignore)]` so an absent field costs nothing. A system
email with no business and no context writes ~5 fields, not 14.

This is not a new convention — **33 entity files in `clinqetcore/Entities/COSMOS` already do exactly this**
(`Cart`, `AiSession`, `CallSummary`, `BusinessActivity`, …). The two new entities follow the house pattern;
no sweep of existing entities is needed, and none is proposed.

Net: ~0.6 KB versus ~0.4 KB — the same ~5 RU write — and it turns a four-read failure path into a one-read
one. Strictly cheaper where it counts.

### ‼️ DECISION: do NOT flip `NullValueHandling` globally

`ClinqetCosmosSerializer` takes `ignoreNullValues = false` in production. That is **deliberate and
documented** — it mirrors the Cosmos SDK's own `CosmosSerializationOptions` default, three integration
fixtures pass `true`, and `ClinqetCosmosSerializerTests` proves equivalence with the SDK.

Flipping it would change the wire format of **every document in every container in every host**. Existing
code that distinguishes "property absent" from "property null" — Cosmos PATCH `replace` operations,
partial-merge paths, any `Contains("field")` check — could change behaviour silently, and a silent change
across every container is exactly the kind of blast radius that is not worth a marginal storage win.

**Per-property `NullValueHandling.Ignore` on the two new entities delivers 100% of the benefit for this
feature with zero blast radius.** That is the correct fix. The global setting is left alone and logged in
§9 as its own question, to be looked at deliberately if ever — never as a side effect of this work.

### 3.4 Verification and password-reset mail — INCLUDED, and here is how it is actually delivered

Writing at the transport (§3.1) sweeps Identity's mail in at no extra cost. But "included" needs an
end-to-end answer, because **this is the one case where a person-facing notification is impossible**:

> A user requests a password reset. The verification email bounces. They cannot be told in-app — they
> cannot log in. They cannot be emailed — that is what failed. They have no device registered for push.

So the value here is **not** a notification. It is three other things, and they are worth more:

| What | Why it matters |
|---|---|
| **`AddressHealth` records the address** | The next attempt is answered *immediately at the point of entry*: "we could not deliver to this address on 12 September — check the spelling or use another one." They stop waiting for mail that will never come |
| **Admin alert** | A bounced verification is a person **locked out of their account**. Support may need to reach them another way — this is the highest-consequence bounce on the platform |
| **In-app, when a session exists** | The email-*change* flow (`UserProfileController`) happens while signed in on another device. There, in-app + push apply normally |

‼️ This is why `AddressHealth` is keyed by address and not by contact — it is the only artefact that can
help somebody we have no other way to reach.

---

## 4. Why `AddressHealth` is the right answer to the "stale CRM marker" problem

**The problem, simply.** If we put a "bad email" flag *on the contact*, we must remember to clear it
everywhere the address can change — CRM edit, customer profile edit, CSV import, a later successful send.
Every path we forget leaves a permanent false accusation on a real customer.

**The solution: attach the fact to the address, not to the contact.**

- Contact fixes their email → **the key changes → there is no record → no marker.** Nothing to clear.
  Stale is impossible *by construction*, not by discipline.
- A later successful send to the same address overwrites it → the marker clears itself.
- Two contacts sharing an address both see it — correctly, it is the same broken mailbox.
- It mirrors what Azure itself does: ACS maintains a global suppression list keyed by address.
- ‼️ **And it enables prevention**: because it is keyed by address, we can warn the provider **as they type
  or paste it**, before they send. That is the real experience win — not an apology afterwards.

**No field on `BusinessCustomer`.** The CRM §0.7 ask disappears; it folds into this store.

**Is it overkill?** No — it is the minimum version of a standard pattern. SendGrid, Mailgun and Postmark all
ship exactly these two things: *Message Events* (per-message correlation) and *Suppressions* (per-address
health). We are building the smallest correct form of both.

**Guards**
- Normalise **case and whitespace only** for email; E.164 for phone. ‼️ No Gmail dot-stripping — over-
  normalising risks condemning a different mailbox.
- Only **terminal** verdicts set it (Bounced, Suppressed, hard DLR). Transient/soft failures never do.
- ‼️ `Quarantined` / `FilteredSpam` **never** set it — that is our sending reputation, not their address.

### 4.1 Which channels — email and SMS only, deliberately NOT WhatsApp

| Channel | In `AddressHealth`? | Why |
|---|---|---|
| **Email** | yes — `Bounced`, `Suppressed` | The address is genuinely dead |
| **SMS** | yes — hard DLR (invalid number, unreachable) | The number is genuinely dead |
| **WhatsApp** | ‼️ **no** | "Not on WhatsApp" is **not a bad number** — SMS to that same number works fine. The existing consent / blocked-contact store already owns this state, and a second source of truth would eventually contradict it |

Because the channel is part of the key, an SMS failure on `+15551234567` says nothing about WhatsApp on the
same number, and vice versa. Correct by construction.

### 4.2 ‼️ CORRECTION — "a later successful send clears it" was wrong

An earlier draft said a later success overwrites the record. **That is not cheaply implementable**: we
deliberately do not subscribe to `Delivered` events, and subscribing would mean one Event Grid event, one
Service Bus message and one function invocation for **every successful email on the platform** — an
enormous volume increase for a marginal benefit. Rejected.

The honest model is better anyway: **a hard bounce is a durable fact.** ACS adds a hard-bounced address to
its own global suppression list, so a later send to it genuinely *will* fail. The record persisting is
**correct, not stale**.

### ‼️ CORRECTION 2 — `dismissedAt` was also wrong, and is removed

An earlier draft gave the provider a "dismiss" action. **That does not work on a global record**: provider A
dismissing it would hide a real fact from provider B, or else we would need a second per-business
suppression document — machinery to manage a problem we do not have.

**The marker is advisory evidence, never a block.** It states a fact with a date — *"this address did not
accept mail on 12 September"* — and the provider can always send anyway. Nothing is gated on it. With that,
dismissal has nothing to do and the field disappears.

### Clearing — direct delete vs TTL, decided per channel

| Channel | Cleared by | Why |
|---|---|---|
| **SMS** | ‼️ **Direct delete on a success DLR** | Telnyx **already sends us success receipts** — `SmsWebhookFunction.HandleDeliveryStatusFinalizedAsync` receives them today and discards them (`SuccessDeliveryStatuses`). So clearing is **free**: one unconditional `DeleteItemAsync`, swallowing `NotFound`, no read. The number healed, the marker goes |
| **Email** | **TTL only** | We do **not** subscribe to `Delivered`, and doing so would mean an Event Grid event + Service Bus message + function invocation for *every successful email on the platform*. Rejected on cost. A hard bounce is durable anyway — ACS suppresses the address globally, so there is usually no later success to observe |
| **Both** | **The address is corrected** | Needs no action at all: the key changes, so the lookup finds nothing. ‼️ We must **not** delete the old record on an address edit — the record is global and another contact may share that same bad address |

The asymmetry is deliberate and driven by what each carrier gives us for free, not by preference.

### TTL — 180 days, configurable, refreshed on every new failure

| Option | Verdict |
|---|---|
| **No TTL** | Rejected. "Bounced two years ago" is noise, and a recovered mailbox would never self-heal |
| **~90 days** | Too short — a provider who re-contacts a customer seasonally loses the warning and pays for the failure again |
| ‼️ **180 days (recommended)** | Long enough that a re-send months later is still warned; short enough that a recovered mailbox self-heals. Refreshed on each new failure, so a repeatedly-bad address stays flagged indefinitely. Configurable, defaults mirrored in `appsettings` ×4 (§0.12) |

Cost of keeping is trivial (tiny documents, only for addresses that actually failed). Cost of expiring too
early is a wasted send plus a notification — so the asymmetry favours the longer value.

### 4.3 The closed loop — who sees it, and where

| Audience | Where they see it | What it does for them |
|---|---|---|
| **Provider — before sending** | Inline warning as they add or edit a customer's email/phone in CRM, and on the recipient field of a quote/invoice | ‼️ **Prevention.** "This address did not accept mail on 12 September — check it before sending" |
| **Provider — on the contact** | A marker on the CRM contact detail, and on the contact row in the list | They can find and fix it without waiting for another failure |
| **Provider — when a send fails** | In-app + push notice, deep-linked **to that contact** (fixes D-2) | Tells them a specific message was lost, and takes them to the fix |
| **Customer — account holder** | In-app notice, plus a marker beside the address in profile settings | Only they can change their own email; fixing it clears the marker |
| **Locked-out person** (reset / verification bounced) | Inline message on the reset screen when they re-enter the same address | They stop waiting for mail that will never arrive — this is the **primary** remedy, not the admin alert |
| **Support** | The admin alert carries the address and the reason | Context for when that person reaches the public help centre |

**Support route.** `clinqetwebuserapp/app/(customer)/help-center` is reachable without signing in, so a
locked-out person does have a way to reach us. ‼️ **One thing to verify in P8**: if the help-centre contact
path replies *only by email*, the loop closes back onto the broken channel. The reply route must allow
something else (a phone number, or a reply to a different address the person supplies).

### 4.4 Keys and partition key — decided

`SystemData` is partitioned on **`/pk`**, a generic per-family key; the existing WhatsApp lookup sets
`Pk = wamid` — the lookup key *is* the partition key. Both new types follow that exact precedent:

| Type | `id` | `pk` |
|---|---|---|
| `CarrierMessageLookup` | `carriermsg_{channel}_{carrierMessageId}` | `{channel}:{carrierMessageId}` |
| `AddressHealth` | `addrhealth_{channel}_{normalisedAddress}` | `{channel}:{normalisedAddress}` |

Consequences, all good:
- **One document per partition** ⇒ perfectly distributed, no hot partition, and a cross-partition query is
  impossible by construction (§0.6 satisfied by design, not by discipline).
- **Point read only** ⇒ `SystemData` excludes `/*` from indexing and includes only named paths, so
  **no new `IncludedPath` is required**. To be re-confirmed against `cosmosindexsetup\Program.cs` in P0.
- **Rendering a contact list** uses `ReadManyItemsAsync` with the `(id, pk)` pairs — one round trip for the
  whole page, and single-document partitions are the ideal shape for it. Not N separate reads.

### 4.5 Global, not per-business — and why that is right

`AddressHealth` is keyed by address alone, so it is platform-wide. Considered and rejected: keying it per
business for tenant isolation (§6). Rejected because ACS suppresses a hard-bounced address **globally** —
a second provider's mail to that address will fail or be suppressed regardless. A per-business record would
make provider B send, fail, and pay for the failure before learning what we already knew. The record holds
only the address and the outcome — no name, no business, nothing about who sent the earlier message — so it
reveals a property of the mailbox, not another tenant's data.

---

## 5. D-1 — the rule that fixes the whole class

**One step back:** "we could not deliver this" is not a *topic*. Topics say what a message is about; this
says the system failed at something you asked for. Filing it under any topic is a category error — and F7
shows the current tag is the worst possible one.

Stripe, Twilio and SendGrid all split notifications on a second axis: transactional/operational
(not opt-outable) vs informational (opt-outable). This codebase already has that axis —
`NotificationRoutingClass` — but uses it only to decide *who* gets a notice, never *whether preferences may
silence it*.

### ‼️ CORRECTION — the previous draft of this section was over-engineered

An earlier version proposed a *channel-guarantee rule*: the notice declares which channel is unusable and
the resolver guarantees the best remaining one. On review that is **more machinery than the problem needs**.
The call site already decides not to reply on the broken channel (`SkipEmail`/`SkipSms` are set there, F1) —
the resolver never needed to know. Rejected as over-engineering. What follows is the smaller, correct fix.

### The fix — three corrections, each a real defect

| # | Correction | Why it is the right fix, not a patch |
|---|---|---|
| **1** | **Remove the default.** `preferenceCategory` becomes a **required** parameter of `DispatchOperationalNoticeAsync` | The root cause is an optional parameter whose unstated value is the most-suppressed category. Any future call site hits the same trap. A parameter whose wrong value silently loses notifications must not have a default — the compiler should force the decision |
| **2** | **Tag by the topic of the thing that failed** — a failed quote email is `QuotesInvoices`, a failed booking email is `BookingNotifications` | Truthful for the user's mental model in the notification centre, and it is what drives the correct deep link (fixes **D-2**) |
| **3** | **Mark the dispatch operational: preferences do not govern it** | A delivery failure is not a topic the user subscribes to — it is the consequence of an action they took. Stripe, Twilio and SendGrid all treat this class as transactional and non-opt-outable. You cannot mute "your payment failed"; you cannot mute "your quote never arrived" |

In-app is the floor and always lands (F5 — there is no `inApp` preference key). Correction 3 additionally
guarantees the **push** that makes someone look. Email and SMS are not used, because either may be the
broken channel — decided at the call site, as it already is.

### Why this is not overkill, and why it is not a workaround

- It is **one flag**, not per-message channel bookkeeping.
- It **names the truth**: this class of message is transactional, and the codebase had no way to say so.
- It is **explicit per dispatch** — a future notice that *should* be mutable simply does not set it.
- It only ever fires **on a failure**, so there is no volume or noise risk to weigh against it.

### Edge cases, checked

| Scenario | Outcome |
|---|---|
| Provider switched every push off | Still delivered. Correct — this is the consequence of their own action, not a subscription |
| Recipient has no account (anonymous booking, cold lead) | No in-app, no push. Nothing is sent to them; the **provider** is told instead (§6) |
| Customer's own account email bounced | Same path, tagged to their topic, delivered in-app + push |
| Fifty bounces from one CSV import | Volume is handled by dedupe + suppression (**P4**), not by the preference model |
| A future notice that should be mutable | Does not set the operational flag. No special-casing needed |

### Separately: F7 is its own decision

`MarketingPromotions` renders in settings and governs nothing. Either something should map to it, or it
should not be shown. **Out of scope for this plan — raised so it is not lost (§9).**

---

## 6. The decision matrix — who is told, and how

### 6.1 Email

| Verdict | Provider (sender) | Customer | Admin |
|---|---|---|---|
| Send failed after every retry | in-app + push, deep-linked to the quote/invoice/booking | in-app if they hold an account | yes |
| **Bounced** | in-app + push — "this address is wrong" + CRM deep-link; address marked | in-app if account holder — only they can fix their own email | yes |
| **Suppressed** | as Bounced, plus "we are not retrying this address" | same | yes |
| **Quarantined / FilteredSpam** | — | — | **admin only** — sender reputation, platform-wide, nothing a provider can act on |
| **Failed** (no reason) | in-app, low urgency | — | yes |

### 6.2 SMS

| Verdict | Provider | Customer | Admin |
|---|---|---|---|
| DLR failed — number invalid / unreachable | in-app + push + CRM deep-link; number marked | in-app if account holder | yes |
| Carrier wall — our credit, account, sender id | — | — | **admin only** |

### 6.3 WhatsApp

| Meta code | Meaning | Decision |
|---|---|---|
| **131026** recipient not on WhatsApp | they have no WhatsApp account | ‼️ **Notify nobody.** We already fall back to SMS and block the contact. Telling the customer is absurd; telling the provider is noise — the message arrived. At most a quiet thread line: *"sent by text message instead."* |
| **131047** 24-hour window closed | template-only period | no notice — the thread already shows it |
| **131050** opted out | the person chose this | **provider, once**, then suppressed. Never the customer |
| **131042 / 131048 / 368 / 190** | **our** wall | **admin only** |
| transient failure with **no successful fallback** | the message is lost | provider, in-app |

### 6.4 Elsewhere

| Surface | Decision |
|---|---|
| Push token invalid | no notice — they would never see it; `DeviceTokenCleanupFunction` already prunes |
| In-app / SignalR | never notified about itself; the bell is the durable record |
| Voice call could not be placed | provider, in-app — **phase 2**, listed so it is not lost |

---

## 7. ‼️ §0.7 SCHEMA — APPROVED by the owner, 2026-09-19

No new container. No partition-key change. Two document types in the **existing Cosmos `SystemData`
container**, where `Cart`, the idempotency store and the WhatsApp lookup already live.

| Column | `CarrierMessageLookup` | `AddressHealth` |
|---|---|---|
| **What** | id `carriermsg_{channel}_{carrierMessageId}`. Fields: channel, carrierMessageId, address, userNumber, userId, businessId, recipientType, preferredLanguage, notificationType, preferenceCategory, contextType, contextId, contextLabel, actorUserNumber, sentAt, ttl. **All optional fields `NullValueHandling.Ignore` (F8)** | id `addrhealth_{channel}_{normalisedAddress}`, pk = `{channel}:{normalisedAddress}`. Fields: channel, address, outcome (enum), reason (enum), firstSeenAt, lastSeenAt, failureCount, ttl. ‼️ NO `dismissedAt` — see §4.2 correction 2 |
| **Who reads it** | `EmailDeliveryReportProcessor`, `SmsWebhookFunction`, `WhatsAppStatusProcessorFunction` — **in this change** | the CRM contact view, the customer profile view, and address entry validation — **in this change** |
| **Who writes it** | `AzureCommunicationServicesEmailService`, `TelnyxSmsService`, `TwoFactorSmsService`, `MetaWhatsAppService` on a successful send | the email bounce processor and the SMS DLR webhook, on a terminal failure. SMS additionally DELETES it on a success DLR (free — that webhook already arrives); email clears by TTL or by the address changing |
| **Why not a column** | One row per outbound message — not a one-to-one fact about any entity | The fact belongs to the **address**, not the contact. A column on `BusinessCustomer` creates the stale-flag class of bugs described in §4 |
| **Why not an enum/constant** | Per-message runtime data | Per-address runtime data |
| **Why not already stored** | `user-activities` loses identity when `auditUserId` is null, carries no context, and is not point-readable by carrier id (querying it would be cross-partition, §0.6). The idempotency lease is keyed by **our** key and is completed before the verdict arrives | Nothing stores it. ACS's own suppression list is not queryable by us per-address at render time |
| **Cost** | ~0.6 KB, ~5 RU, one per **successful** send. TTL 72h keeps storage flat | **Zero** when nothing fails. One doc per bad address, ~0.2 KB. No index in phase 1 |
| **What breaks if omitted** | The entire feature — a bounce can only be answered with "somebody's mail failed" | Every clearing path becomes a stale-data bug, and we lose warn-before-send |

‼️ **`CarrierMessageLookup` REPLACES `WhatsAppConversationLookup`** — it is not additive. ‼️ RENAMED 2026-09-19 during P0: the plan first called this `OutboundDelivery`, but reading every call site showed the record it replaces also indexes INBOUND WhatsApp messages for reply threading (`MessageService.IngestInboundExternalMessageAsync` writes, `WhatsAppInboundResolver` reads). A record that serves both directions must not be named for one. Owner approved the rename. Pre-prod, no backfill
(§22.10 and the "design the schema for an empty database" rule). One concept, not two. Both answer the
identical question — *given a carrier message id, what do we know about that outbound message?* — and
WhatsApp's extra `conversationId` becomes one more optional field that costs nothing on email or SMS
(§3.3). The differing lifetimes are not an objection: **Cosmos TTL is per item**, so a WhatsApp record
writes 7 days and an email record writes 72 hours from the same document type.

‼️ **`WhatsAppSmsFallbackTicketStore` is NOT merged and must be left alone.** It looks similar but is a
different thing: a **work claim** with exactly-once semantics (ETag-conditional delete, so exactly one
redelivery wins the right to send the fallback SMS). Folding a claim into a lookup would put
exactly-once machinery on a read-mostly record and risk the double-send it exists to prevent.

**Index review:** `cosmosindexsetup\Program.cs` must be read before any query; both types are **point-read
by id only**, so no new `IncludedPath` is expected — to be confirmed and stated in the phase.

---

## 8. Phases

> **P0 — DONE 2026-09-19.** Entities, both stores, settings bound and mirrored in all four hosts, the
> WhatsApp-only store retired and its coverage replaced. Notes that matter later:
> - `CarrierMessageLookup` replaced `WhatsAppConversationLookup` after the rename decision (§7). Four call
>   sites migrated: `MessageService` (inbound ingest), `WhatsAppInboundResolver`, `WhatsAppOutboundProcessorFunction`,
>   `WhatsAppStatusProcessorFunction`. `WhatsAppSmsFallbackTicketStore` untouched, as decided.
> - `WhatsAppSettings.ConversationLookupTtlSeconds` **deleted** along with its Functions appsettings key —
>   replaced by `DeliveryTracking` (§4 config hygiene: no orphans).
> - ‼️ **`cosmosindexsetup` needs NO change.** Verified: `SystemData` is partitioned on `/pk`, excludes
>   `/*` from indexing, and already sets `DefaultTimeToLive = -1` — so per-item TTL works and both types,
>   being point-read by id+pk only, need no `IncludedPath`.
> - `AddressHealth` carries **no `outcome` field**: the document only exists on failure, so it would encode
>   nothing. Fewer fields than the approved shape, never more.
> - Coverage replaced, not lost (§0.15): `WhatsAppConversationLookupStoreTests` → `CarrierMessageLookupStoreTests`
>   (12), new `AddressHealthStoreTests` (15), and the real-Cosmos
>   `WhatsAppConversationLookupStoreIntegrationTests` → `CarrierMessageLookupStoreIntegrationTests` (6).


| Phase | Content |
|---|---|
| **P0** | `CarrierMessageLookup` + `AddressHealth` entities, store interface + repository, TTL settings (appsettings ×4 + class defaults mirrored), `cosmosindexsetup` review. Retire `WhatsAppConversationLookupStore` and migrate WhatsApp onto the general store. ‼️ No backfill and no migration concern — this is pre-prod and the sandbox is rebuilt (§22.10). The only care needed is that `WhatsAppSmsFallbackTicketStore` keeps working untouched: it is a separate exactly-once work claim and is NOT being merged (§7) |
| **P1** | Write at the transport: ACS email, Telnyx SMS, 2Factor SMS, Meta WhatsApp. Non-throwing and best-effort — a failed bookkeeping write must never fail a send that succeeded |
| **P2** | Read on the verdict: bounce processor, SMS DLR webhook, WhatsApp status processor. Resolve identity from the record; degrade to an admin-only alert when the record is absent (expired, or a send that predates this change) |
| **P3** | `AddressHealth`: write on terminal verdicts, clear on success, normalisation, the Quarantined/FilteredSpam exclusion |
| **P4** | The notice. ‼️ A new `NotificationType` is **four** registrations, not one: the enum value, `SignalRSettings:EnabledNotificationTypes` (Main API appsettings), **and** the `ProviderCategories` / `CustomerCategories` maps in `CommunicationPreferenceConfig` — F7 proved an unmapped type resolves to a null category. Plus localization keys in **every** language file, deep links, dedupe + suppression. **No new `AdminAlertType` is needed** — `EmailSendFailure`, `EmailDeliveryFailure` and `SmsDeliveryFailure` already exist; do not add one |
| **P5** | The D-1 correction (§5): make `preferenceCategory` REQUIRED (remove the default), tag by the topic of the failed thing, and add the **operational** marker that preferences do not govern |
| **P6** | Apply P5 to the two existing `DispatchOperationalNoticeAsync` call sites and fix **D-2** (deep-link to the thing that failed, not `/dashboard`) |
| **P7** | WhatsApp: apply the §6.3 matrix — mostly *removing* noise, plus the opt-out notice |
| **P7.5** | ‼️ **MOCKUP GATE — BLOCKING (§0.7.1, §0.20).** No integrated UI code until the owner approves a sheet at `C:\Nik\Data\mockups\delivery-problem-surfaces\index.html`, registered in §10 of this plan the day it is approved. See §8.2 |
| **P8** | Surfaces (only after P7.5 is approved): CRM contact marker + list row, customer profile marker, **warn-on-entry** on address fields, the reset/verification screen message. ‼️ Verify the help-centre reply route is not email-only (§4.3) |
| **P9** | ‼️ **Mobile parity (§0.7.1)** — same session, not a follow-up. `clinqetmobilepartnerapp`: CRM contact + notification centre. `clinqetmobileuserapp`: profile settings + notification centre. Parity means matching the **rendering rules**, not shipping a same-named component |
| **P10** | Tests — unit **and** integration, placed with the runtime consumer (§0.18). Integration tests are **mandatory** here: this touches Cosmos schema and Service Bus processors (§0.8) |
| **P11** | Skills ×4 + memory (§0.9) |
| **P12** | ‼️ **Full multidimensional audit** (§8.1 below) |

### 8.1 The multidimensional audit — non-negotiable, and what it must cover

Not a test run. A separate pass over the finished work, along these dimensions, with every finding fixed
before the work is called done:

| Dimension | What it must prove |
|---|---|
| **Correctness** | Every verdict reaches the right human; no verdict reaches the wrong one |
| **Completeness** | Every send path writes the record; every verdict path reads it; nothing is silently excluded |
| **No false positives** | A transient failure, a successful fallback, and a reputation event never reach a provider or customer |
| **Stale data** | Prove by construction that a corrected address clears the marker, on every entry path |
| **Cost** | Measured RU per send and per verdict; storage at TTL steady state |
| **Performance** | The failure path does exactly **one** point read; the send path adds exactly **one** write |
| **Concurrency** | Redelivery, two verdicts for one message, two contacts sharing an address |
| **Privacy** | No full address or number in an identity-free admin alert; masked where §A-3 of the sibling programme requires |
| **Localization** | Every new string is a key present in **every** language file |
| **Config hygiene** | Settings in all four hosts, class defaults mirrored, no orphans |
| **Dead code** | `WhatsAppConversationLookupStore` and its settings fully removed, not left beside the new one |
| **Mobile parity** | Both mobile apps match the web rendering rules |
| **Clean tree** | §0.16 — `git status --porcelain` free of scratch |

---
### 8.2 The mockup gate (P7.5) — what the sheet must contain

Per §0.7.1 and §0.20 this is **blocking**, and the sheet lives at exactly one path:
`C:\Nik\Data\mockups\delivery-problem-surfaces\index.html`.

It must draw **web AND mobile frames** for every surface, and **every state**:

| Surface | States to draw |
|---|---|
| CRM contact detail + list row | no problem · email problem · phone problem · both · problem older than 90 days |
| Address entry (CRM contact, quote recipient) | clean · known-bad warning · warning dismissed-by-sending-anyway (it never blocks) |
| Customer profile settings | clean · own email flagged · own phone flagged |
| Notification centre entry | provider view · customer view · with and without a deep-link target |
| Password-reset / verification screen | first attempt · re-entry of a known-bad address |

### ‼️ Design tokens — MEASURED from the apps, never invented

Every value below was read out of the codebase. The approved sheet uses exactly these, which is why it is
brand-aligned by construction rather than by eye.

**Colour** — `clinqetmobilepartnerapp/src/assets/Colors.tsx` is the source of truth; the web mirrors it.

| Token | Value | Use |
|---|---|---|
| Navy ink | `#032858` | Headings, primary text on cards, the brand line |
| **Brand green** | `#97EF29` | ‼️ Fills every pressed/selected/primary control — including **"Send anyway"** |
| Green ink (on green) | `#3A6410` | Text sitting on brand green |
| Body black | `#101010` | Body copy |
| Muted | `#5F5F5F` (mobile) / `#5F6672` (web) | Secondary copy, hints |
| Page grey | `#F5F5F5` | App background |
| Border grey | `#E7E7E7` | Every card and field border |
| Surface grey | `#FAFAFB` | Phone screen background |
| Red | `#FF3B30` | ‼️ **NOT used anywhere in this feature** — nothing here blocks |
| Amber bg / line / ink | `#FFF7E8` / `#F1D9A7` / `#9A5B00` | The delivery advisory, in every surface |

**Type**

| Where | Value |
|---|---|
| Web family | **Lufga**, fallback `Arial, Helvetica, sans-serif` — declared in `clinqetwebpartnerapp/src/app/global.css` |
| Web scale | The app's own `responsive-*` clamps: `xs clamp(.625rem,1.5vw,.75rem)` · `sm clamp(.75rem,1.8vw,.875rem)` · `base clamp(.875rem,2vw,1rem)` · `lg clamp(1rem,2.5vw,1.125rem)` · `xl clamp(1.125rem,3vw,1.25rem)` · `2xl clamp(1.25rem,3.5vw,1.5rem)`. ‼️ Never a fixed px size for body copy |
| Mobile scale | `clinqetmobilepartnerapp/src/theme/index.ts` — `xs 12 · sm 13.5 · md 15 · lg 17 · xl 22 · xxl 28`. Use these names, never a literal |
| Weights | 400 regular, 600 semibold. No other weight is shipped |

**Applying them here**

| Element | Token |
|---|---|
| Advisory banner | amber bg + amber line, amber-ink text, **never red** |
| "Not reaching" pill | amber bg/line/ink; greys to border-grey + muted after 90 days |
| "Send anyway" | brand green `#97EF29` fill, green-ink `#3A6410` text |
| Flagged input | border amber-line, background `#FFF7ED` |
| Notice title | navy ink, web `responsive-base` / mobile `md 15` |
| Notice body | muted, web `responsive-sm` / mobile `sm 13.5` |
| Touch target | **44px minimum** on every control, both apps |

### ‼️ Responsiveness is part of the approval, not a detail

Every surface must be excellent at **every** width, on the app's own breakpoints
(`xs 320 · sm 480 · md 768 · lg 1024 · xl 1280 · 2xl 1536 · 3xl 1920 · 4k 2560`):

| Width | Required behaviour |
|---|---|
| **Phone, web** | Contact row drops the address and keeps the pill. Advisory full-bleed. Buttons stack, full width, **44px minimum touch target**. No horizontal scroll at 320px |
| **Tablet (iPad), portrait and landscape** | Contact detail becomes two columns; the list keeps its right-hand meta column in landscape |
| **Laptop / desktop** | List and detail side by side — choosing a contact never leaves the list |
| **Large monitor (1920+)** | ‼️ Content caps at 1180px and centres. It must **not** stretch — a readable line length wins over filling the glass |
| **Touch anywhere** | `hoverOnlyWhenSupported` is on in the apps: every hover state wrapped in `@media (hover:hover)`, so a tapped pill never latches into a stuck highlight |
| **Native mobile apps** | Not a smaller web page — native list row, native sheet for the send-anyway confirmation, OS push, bottom tab bar. Same wording, same amber, same never-blocks rule. Parity is in the **rendering rules** |

‼️ **NO TECHNICAL WORD anywhere a provider or customer can read** (§0.20). Forbidden: *bounce*, *bounced*,
*delivery report*, *DLR*, *suppression*, *suppressed*, *hard fail*, *terminal status*, *webhook*, *carrier*.
Say: *"we couldn't deliver to this address"*, *"this address didn't accept mail on 12 September"*,
*"check the spelling or use a different address"*.

House tokens only — navy ink, brand green for the chosen action, amber for the warning, never red for an
advisory that does not block.

**A sheet the owner approves that appears in no register has been lost, not approved (§0.20).** The moment
it is approved, a row goes into §10 below.

---


---
## 8.3 Build log — what is DONE, and what each phase actually found

> **P1 — DONE.** Every transport writes the record. ‼️ The contract change broke **280 unit tests in one
> shape**: a Moq `.Callback<T1…Tn>` carries its OWN generic arity, and a mismatch throws in the test
> CLASS CONSTRUCTOR, so one bad callback fails every test in that class. 37 sites, all in the four
> `Send(Templated)(Email|Sms)Async` setups. Widening the `Setup(...)` argument list is only half the job.

> **P2/P3/P4 — DONE**, and built as ONE pass rather than three, because all three touch the same three
> verdict paths and doing them separately would have rewritten each call site three times.
>
> - **`DeliveryFailureFeedbackService`** (Functions host, beside `FailureNotificationHelper` — §0.18: all
>   three consumers are Functions) is the single place a verdict becomes a human notice. One point read,
>   one conditional write, then the audience decision. It accepts an `alreadyRead` record so the WhatsApp
>   path, which already point-reads the pointer for its alert metadata, still costs exactly one read.
> - **`DeliveryVerdictClassifier`** turns each carrier's own vocabulary into a `DeliveryFailureDisposition`.
> - **Identity had to travel further than P1 assumed.** `EmailNotificationMessage` / `SmsNotificationMessage`
>   carried no `BusinessId` and no `RecipientType`, so a verdict could not tell a provider-bound send from a
>   customer-bound one. Both queue DTOs gained one `MessageDeliveryContext? DeliveryContext`, built once in
>   `CommunicationDispatcher`; `CommunicationRequest` gained `BusinessId`, set by
>   `BusinessCommunicationDispatcher.ApplyRoutingContext` from the resolved recipient.

### ‼️ Carrier facts — VERIFIED against the published references, never inferred from a code's name

| Carrier | What was verified | Source |
|---|---|---|
| **Telnyx** | `40001` not routable (landline/non-routable wireless) · `40012` destination rejected by the carrier · `40310` the 'to' address is not valid ⇒ **the number is dead**. `40300` blocked because the recipient sent STOP ⇒ **the person declined, the number is fine**. `40004` recipient's server declined · `40006` recipient's server non-responsive ⇒ **lost, says nothing about the number**. The rest (`40002/3/10/11/13/15`, `403xx`, `40333`) ⇒ **our wall** | developers.telnyx.com messaging error-codes reference, cross-checked against the Telnyx Help Center article |
| **Meta** | `131026` "the recipient phone number is not a WhatsApp phone number" · `131047` 24-hour window · `131050` "has chosen to stop receiving marketing messages" · `131042` payment · `131048` quality throttling · `130429` throughput | developers.facebook.com Cloud API error codes |
| **ACS** | Bounced · Suppressed ⇒ address dead. Quarantined · FilteredSpam ⇒ **our reputation**, admin only. Failed ⇒ lost, no conclusion about the address | Already verified in the sibling integration-health programme |

‼️ **An unrecognised SMS code falls to `MessageLost`, never `OurWall`.** A lost customer message the provider
is never told about is worse than an admin alert nobody needed.

### ‼️ D-3 — a THIRD defect, bigger than D-1, found while fixing D-1

`DispatchOperationalNoticeAsync` defaulted `routingClass` to **`Awareness`**. `NotificationRoutingCatalog`
states it outright: *"Awareness resolves ZERO recipients by design."* So `HandleEmailFailureAsync` and
`HandlePdfGenerationFailureAsync` — the two sites that took the defaults — **delivered nothing at all to a
provider**, for every email-send failure on the platform. D-1's mis-categorisation was the visible half of
the bug; this was the half that made it total.

**Fixed as one change:** `preferenceCategory`, `routingClass` and `permissionKey` all lost their defaults
and are now required, so the compiler forces the decision at every future call site. Both sites now pass
`WorkIntake` + the topic's own permission, matching `KnowledgeDocumentFailed`'s precedent (*a failed thing
is a job somebody has to redo*).

### D-2 — the deep link, and the trap inside it

`TopicOf(...)` derives category + permission + link from the operation that failed. ‼️ **The booking route's
id IS the booking NUMBER (`bookingInfo={{ bookingNumber: bookingInfoId }}`), but the quote route's is the
quote GUID** — so `HandleEmailFailureAsync` gained an optional `contextDeepLinkId`, and `QuoteEmailProcessor`
passes `message.QuoteId`. Feeding the number into the quote route would have produced a link that silently
resolves to nothing.

### The operational flag — where preferences ACTUALLY bite

`IsOperational` on `CommunicationRequest`, honoured in **three** places, not one:

| Place | Why it was needed |
|---|---|
| `CommunicationDispatcher` — `pushEnabled` | The preference gate the D-1 correction names |
| `BusinessCommunicationDispatcher.DigestChannels` | ‼️ A member on Digest would have had "your message never arrived" **batched into tomorrow's digest** |
| `BusinessCommunicationDispatcher.ApplyRoutingContext` | ‼️ **The one that actually mattered.** It sets `SkipInApp`/`SkipPush` from the member's channel policy BEFORE the dispatcher ever sees the flag, so without this the gate below it was dead code and in-app — the floor — could be switched off |

`selfEcho.SuppressPush` is deliberately still honoured: that is the self-echo guard, not a preference.

### Registrations — ‼️ it was SIX places, not the four the phase table claimed

| # | Where | Note |
|---|---|---|
| 1 | `NotificationType.MessageDeliveryFailed` | |
| 2 | `SignalRSettings:EnabledNotificationTypes` | guarded by `SignalRWhitelistCompletenessTests` |
| 3 | `NotificationRoutingCatalog` | `WorkIntake` + `customer.read` + `customer: true` |
| 4 | **`NotificationEchoCatalog`** | not in the phase table. **Deliver**: the sender IS the actor here, and the sender is the only person who can fix the address — a self-echo rule would silence exactly the right person |
| 5 | `NotificationRoutingCatalogTests.Expected` + its polymorphic contract | an exhaustive table, not a mock |
| 6 | `NotificationEchoCatalogTests` | same shape |

‼️ **And it is deliberately NOT in `ProviderCategories` / `CustomerCategories`** — which the phase table got
wrong. Those maps drive the **settings screen**, and an operational notice that nobody may switch off must
not render as a toggle. It has no fixed topic either: it borrows the failed thing's, per dispatch. Making
`preferenceCategory` required (above) is what guarantees the override F7 warned about is always present.

### What the convention guards caught — all three were real

1. `BusinessDispatchGuardShapeTests` — the new dispatch had **no enclosing try**, so a notice failure would
   have destroyed the admin alert behind it. Now in L94's locked shape, and it returns `false` instead of
   letting the caller report a notice it never sent.
2. `NotificationRoutingCatalogTests` ×2 and `NotificationEchoCatalogTests` — the exhaustive contract tables.

**Suites after P1–P4: 13,111 + 5,002 + 1,044 + 990 = 20,147 passing, 0 failing.**

### ‼️ Two things found that are NOT this programme's to fix — raised, not silently swallowed

1. **`HandlePdfGenerationFailureAsync` has ZERO production call sites.** Only a unit test calls it, though
   it has full settings (`EnablePdfGenerationFailureAlerts`, true in three hosts), localization in every
   language, and a section in the Function App SKILL. Its D-1/D-3 defects are fixed so it is correct if
   ever called, but **deleting a documented alert path, or wiring it up, is the owner's call** — see §9.
2. **2Factor (India) sends no delivery receipts.** `TwoFactorWebhookHandler` implements `ValidateRequest`
   and `ParseIncoming` only; `HandleDeliveryStatusFinalizedAsync` is Telnyx-only. So an India-bound text
   writes its record and **no verdict ever arrives** — no bounce notice, no address marking, for that
   traffic. The record is still written (uniform, ~5 RU, and ready the day 2Factor DLRs are added); the
   alternative was a silent exclusion, which §3.1 exists to prevent. See §9.



### ‼️ A PRE-EXISTING defect the integration tests caught — and the merge fixes it

`ClinqetCosmosSerializer` uses `CamelCasePropertyNamesContractResolver`, which sets
**`ProcessDictionaryKeys = true`**. So a `Dictionary<string, string>` on a Cosmos document round-trips with
its **keys lower-cased**: `"Number"` is written as `"number"` and read back as `"number"`.

**Measured, not reasoned**: the first run of `TheHeldBackText_SurvivesTheRoundTrip` against the real Cosmos
emulator failed with `KeyNotFoundException: The given key 'Number' was not present`.

**The retired `WhatsAppSmsFallbackTicketStore` stored `SmsTemplateData` as exactly that shape**, so
`VoiceDocumentDeliverySignals.PublishNoticeAsync(… ticket.SmsTemplateData?.GetValueOrDefault("Number") …)`
was reading **null** after every round trip — the in-call "sent as text instead" notice has been going out
without the document number it is supposed to name.

**Fixed here** by storing the held-back text's data as a `JObject`, whose keys Newtonsoft writes verbatim,
with the round trip pinned by an integration test that also asserts the lower-cased key is **absent**.

‼️ **Not verified, and worth a look:** whether the SMS template placeholder resolution is case-insensitive.
If it is not, the fallback text bodies were also rendering with empty placeholders. The merge fixes the live
path either way, but the question deserves its own answer.

**Deliberately NOT swept:** four other Cosmos entities hold a `Dictionary<string, string>` — `CallSummary.Payload`,
`BusinessProfile.SocialLinks`, `Notification.Data`, `ExternalChannelIds`. They have behaved this way since
they shipped and their consumers read the camel-cased keys, so "correcting" them would break the readers.
The case fixed here is different in kind: the key round-trips **inside the server** and is then handed to a
template resolver that expects the original spelling.

**A second, smaller one:** `AnAbsentOptionalField_IsNotWrittenAtAll` (written in P0) had never actually run
green — it read the raw document as a `System.Text.Json.JsonElement` from a container that serialises with
Newtonsoft, and threw `InvalidOperationException` on a disposed backing document. It now reads a `JObject`
and genuinely proves the `NullValueHandling.Ignore` contract it was written for.

### ‼️ SECURITY CORRECTION — the reset-screen advisory in the approved sheet cannot be built as drawn

§3.4 and the mockup's section 5 call for the locked-out person to see *"this address did not accept our
mail on {date}"* when they re-enter it on the forgot-password screen, and call it the **primary** remedy.

**It cannot be built that way, and the reason is in the code.** `AuthService.RequestPasswordResetAsync`
returns `(true, [])` for an account that does not exist, with the comment *"For security reasons, don't
reveal that the user does not exist or is not confirmed."* The screen is anonymous. A per-address answer —
from a new anonymous endpoint, or folded into that response — would make the reply differ by address and
turn a deliberately non-enumerable endpoint into an **account-enumeration oracle**: anyone could learn that
a given mailbox both has an account and is dead.

**Built instead, and it costs the locked-out person nothing:**

| | |
|---|---|
| **Reset screen** | An always-shown, address-independent line after submit: *"Not receiving the email? Check the address for a typo, or contact us through the help centre."* (`DeliveryProblem.ResetHelp`, 5 languages). Leaks nothing, helps in exactly the same situation |
| **Admin alert** | Already built and unchanged — a bounced verification reaches an admin, which §3.4 lists as the second remedy |
| **‼️ The help-centre route is NOT email-only** | Verified (item 18): `help-center` renders a **`tel:` call-support** option alongside email. So the loop does **not** close back onto the broken channel. No change needed |
| **The signed-in case is fully built** | An email *change* happens while signed in on another device, and `/my-profile` now shows the marker there — which §3.4 already named as where in-app applies |

‼️ The mockup register row for `delivery-problem-surfaces` stands, with this one section superseded on
security grounds. The owner should know the sheet and the code now differ on that panel.

### UI build log

| Surface | What shipped |
|---|---|
| **Provider web — contact list** | `DeliveryProblemPill` under the email and the phone cell. One lookup per page (`buildContactAddressQueries` → `LookupDeliveryHealth` → `indexDeliveryProblems`), amber while recent, greyed to past tense after `AddressHealthRecentDays`, and absent entirely when there is no problem |
| **Provider web — add/edit contact** | `DeliveryProblemFieldHint` under both the email and phone fields, driven by `useDeliveryProblem` (500ms debounce, aborts in flight). ‼️ **This IS the contact-detail advisory** of the sheet's §1 — put at the point of fix rather than duplicated in a banner above it |
| **Customer web — profile** | `DeliveryProblemNotice` under their own email and phone in `/my-profile`, one call for both |
| **Customer web — reset** | The address-independent helper line above |
| **Never** | Red. A disabled button. A blocked send. A "dismiss" action |

Localization: **10 keys × 5 languages** in `clinqetwebpartnerapp/public/lang`, **3 keys × 5 languages** in
`clinqetwebuserapp/public/lang`, **4 validation keys × 5 languages** in the server resources. ESLint: **0
errors, 0 warnings** across every changed file in both apps.

## 9. Open questions carried forward

1. **F7** — `MarketingPromotions` renders in settings and governs nothing. Map something to it, or stop
   showing it. Not part of this plan.
2. **Voice** — "the call could not be placed" belongs in this model; deferred to phase 2.
3. **Global `NullValueHandling`** — production writes nulls (§3.3). Left alone deliberately; worth its own
   deliberate look one day, never as a side effect of feature work.
4. **Anonymous and guest recipients** — the public Open Page EmailOTP booking flow creates recipients with
   no account. They cannot be notified; the **provider** is told instead (§6). No extra work, recorded so
   nobody later mistakes the silence for a gap.

5. **`HandlePdfGenerationFailureAsync` is dead code** — zero production call sites, full settings and
   localization behind it (§8.3). Wire it up or delete it: an alert path nobody can trigger is a false
   sense of coverage. ‼️ NOT deleted here, because removing a documented reporting path is the owner's call.
6. ‼️ **2Factor DOES send delivery receipts — the earlier claim was WRONG.** See §13 for the verified
   callback contract, the security control it needs first, and the one portal action only the owner can take.

7. ‼️ **WhatsApp for in-app chat messages — DESIGNED, deliberately NOT built here** (owner asked 2026-09-19,
   and asked that it be written down so it is never lost).

   **Today.** A provider's chat message reaches the customer as in-app + push + an **email** carrying a
   truncated preview and a link to the thread. SMS is explicitly off (`MessageService` sets `SkipSms = true`
   and supplies no WhatsApp recipient or template). If that email bounces, this programme now tells the
   provider and marks the address — that hole is closed.

   **The constraint, verified against Meta's published docs (2026-09-19), never inferred:**

   | Fact | Consequence |
   |---|---|
   | **Utility** = templates that *"follow up on user actions or requests… typically triggered by user actions"*; **Marketing** = awareness, promotions, announcements | A bare *"you have a new message"* is thin and likely re-categorised. One naming the transaction the customer started — *"Sarah's Salon replied about your booking #1043"* — fits Utility squarely |
   | ‼️ Since **2025-04-09**, a template submitted as UTILITY that Meta judges MARKETING is **approved as MARKETING** | The risk is NOT rejection. It is a higher price, and the template becomes mutable by marketing opt-out |
   | Since **2025-07-01**, utility templates delivered **inside an open customer-service window are free** | Cost objections apply mainly outside the window |
   | ‼️ **We already track the window** — `WhatsAppActiveContext.WindowExpiresAt` / `LastInboundAt`, and `WhatsAppConsentService` already computes `windowOpen` | No new tracking is needed to decide which shape to send |
   | `MessagesChats` is deliberately absent from `WhatsAppEligibleCategories` | Enabling it is a **policy decision** about what may go on WhatsApp — the owner's, not an implementation detail |

   **The recommended design, if taken:**

   | Situation | Send |
   |---|---|
   | 24-hour window **open** (the customer messaged us) | Free-form session message carrying the **real text** — no template, no category risk |
   | Window **closed** | A **utility** template that names the transaction and links to the thread. Never a bare "you have a message" |
   | Either | ‼️ **Email is NOT demoted to a fallback.** It carries the preview and costs nothing |

   ‼️ **The better shape this programme unlocks.** Rather than sending both and pinging the customer twice,
   **hold the email back** and release it only if WhatsApp fails — exactly the held-back-**text** mechanism
   built here, generalised to a held-back **email** on the same `CarrierMessageLookup` record, with the same
   once-only claim and the same staleness cutoff. That is the elegant answer and the reason to design this
   deliberately rather than bolt it on.

   ### ‼️ The owner's refinement, 2026-09-19 — BOTH directions, inside the window, full message

   **Messaging is two-way on all four surfaces** (verified, not assumed): customer web
   `clinqetwebuserapp/app/(customer)/messages`, customer mobile `src/screen/messaging/ChatScreen.tsx`,
   provider web `/dashboard/inbox`, provider mobile `src/Screen/InboxTab`. So this applies to a provider
   messaging a customer **and** a customer messaging a provider.

   **The agreed shape:**

   | | Behaviour |
   |---|---|
   | **In-app + push** | ‼️ **Unchanged in every case.** Free, instant, and the floor — nobody is ever left with nothing while the other channels resolve |
   | **24-hour window OPEN** (either direction) | Send the **full message** on WhatsApp, naming the sender (provider name, or customer name the other way) with a link to open the thread. Free-form session message — no template, no category risk, no cost |
   | **Window CLOSED** | Unchanged: email carries the preview and the link |

   ‼️ **Owner-confirmed 2026-09-20: the held-back-email shape applies ONLY inside the free window.** Outside
   it, nothing changes at all — email plus in-app plus push, exactly as today. The email is held back only
   when WhatsApp is genuinely the better, free, live channel; the moment it is not, today's behaviour stands
   untouched. There is no case where a customer ends up with nothing because a paid template was preferred.

   **‼️ Email: held back, not sent alongside — RECOMMENDED and owner-endorsed.**
   Inside the window the person *just messaged us on WhatsApp*, so WhatsApp is demonstrably their live
   channel and the highest-confidence delivery available. Emailing as well is two pings for one message,
   which is how people learn to mute a sender. So the email is **prepared and held**, and released only if
   WhatsApp fails — the same held-back mechanism this programme built for text, on the same
   `CarrierMessageLookup` record, with the same once-only claim.

   **One refinement that must not be forgotten:** a held-back **email** needs its OWN staleness cutoff,
   longer than the text one. An email arriving two hours late is still useful; a booking reminder two hours
   late is noise. `LateFallbackMaxAgeMinutes` governs text — email needs a sibling setting.

   **Still open when this is taken up** (do not start without deciding):
   - Whether a **template** is created and submitted for the window-closed case, and which category it
     lands in (see the verified Meta facts above).
   - `MessagesChats` joining `WhatsAppEligibleCategories` — a policy decision, the owner's.
   - Whether a customer→provider WhatsApp send is appropriate at all, or only provider→customer.

   **Why it is not in this programme:** it is a new outbound behaviour and a consent-policy decision, not a
   delivery-failure fix. Folding it in would widen an already large change and put a policy call inside an
   engineering one.

---
## 10. Mockup register

| Sheet | Path | Approved | Governs | Supersedes |
|---|---|---|---|---|
| **When a message does not arrive** | `C:/Nik/Data/mockups/delivery-problem-surfaces/index.html` | **APPROVED 2026-09-19** | Every provider- and customer-facing surface for a failed email or text: contact list + detail, address entry, the notice, my-own-address, the locked-out reset screen. Web AND mobile, all states, responsive behaviour, and the full copy table | — (first sheet for this programme) |

---
## 11. ‼️ MASTER CHECKLIST — nothing here may be dropped, and nothing is "done" until this table says so

> Owner, 2026-09-19: *"none of those should be missed including the multi-dimensional audit as well …
> make sure you include that in the plan document so that it never ever get missed."*
>
> ‼️ **This table is the authority on completion, not the phase list in §8.** A phase marked DONE in §8 but
> not ticked here is NOT done. Update this table in the same change that does the work — never afterwards.

### Built and green

| # | Item | State |
|---|---|---|
| 1 | `CarrierMessageLookup` + `AddressHealth` entities, stores, TTL settings ×4 hosts | ✅ DONE (P0) |
| 2 | Every transport writes the send record (ACS email, Telnyx, 2Factor, Meta) | ✅ DONE (P1) |
| 3 | Identity threaded to the transport (`MessageDeliveryContext` on both queue DTOs, `BusinessId` on the request) | ✅ DONE |
| 4 | `DeliveryVerdictClassifier` — carrier codes → disposition, every code verified against its published reference | ✅ DONE |
| 5 | `DeliveryFailureFeedbackService` — one read, conditional mark, audience decision | ✅ DONE |
| 6 | Three verdict paths wired: ACS bounce, Telnyx DLR (failure **and** success-clears-the-marker), Meta status | ✅ DONE |
| 7 | `AddressHealth` written on terminal verdicts only; Quarantined/FilteredSpam excluded; WhatsApp excluded by construction | ✅ DONE |
| 8 | `NotificationType.MessageDeliveryFailed` — all **six** registrations | ✅ DONE |
| 9 | 14 localization keys × 5 languages | ✅ DONE |
| 10 | D-1 (`preferenceCategory` required), D-2 (deep link to the thing), **D-3** (`Awareness` delivered to nobody) | ✅ DONE |
| 11 | `IsOperational` honoured in all three places preferences actually bite | ✅ DONE |
| 12 | ‼️ **The merge**: one record carries identity + the held-back text; `WhatsAppSmsFallbackTicketStore` deleted with its settings key; late WhatsApp failure re-sends the text | ✅ DONE |
| 13 | `WhatsAppLateFallbackEnabled` + `LateFallbackMaxAgeMinutes` (30), mirrored ×4 hosts | ✅ DONE |
| 14 | Unit suites green after every step | ✅ **20,273** at the final full run (13,125 API · 5,114 Functions · 1,044 Identity · 990 MCP) |

### ‼️ Remaining — none of it is optional

| # | Item | Status / why it cannot be dropped |
|---|---|---|
| 15 | **Address-health read API** — `POST /api/v1/delivery-health/lookup`, batched per channel via `ReadManyItemsAsync`, capped by `AddressHealthLookupMaxAddresses` (50, ×4 hosts), 5 validation keys ×5 languages. ‼️ **Paced for real since 2026-09-20**: `ISearchRateLimitService.TryAcquire(bucket, AddressHealthLookupsPerMinute, addressCount)` charged in ADDRESSES, bucketed on the signed-in `UserNumber`, answering **429** + `Retry-After: 60` + `Validation_DeliveryHealth_TooManyLookups`. Before that the XML comment promised a 429 the code could not produce and the setting was read by nothing (audit A-8) | ✅ DONE |
| 16 | **Provider web (P8)** — contact-list pills (5 states), field warn-on-entry on both address fields, amber never red, nothing blocked | ✅ DONE |
| 17 | **Customer web (P8)** — profile markers on their own email and phone; reset screen carries an address-INDEPENDENT helper line (see the security correction in §8.4) | ✅ DONE |
| 18 | **Help-centre reply route** — verified: it offers phone support, not email only. No change needed | ✅ DONE |
| 19 | ‼️ **Mobile parity (P9)** — provider CRM badge on both address rows (5 states, one lookup per page); customer profile markers. Endpoint registered in both apps, 6 keys ×5 languages (provider) + 2 ×5 (customer), tsc clean, 0 ESLint errors | ✅ DONE |
| 20 | **Tests (P10)** — 68 new unit tests in the Functions suite (classifier ×30, feedback service ×21, address key ×17), 9 controller tests in the API suite, 5 real-Cosmos integration tests for the merged claim. Placed with the runtime consumer (§0.18) | ✅ DONE |
| 21 | **Skills ×4 + memory (P11)** — NEW `clinqet-delivery-feedback` in all four directories, registered in all four instruction files (38→39); `clinqet-whatsapp` ×4 carries a SUPERSEDED section for the retired ticket store; memory entry + index line | ✅ DONE |
| 22 | ‼️ **FULL MULTIDIMENSIONAL AUDIT (P12)** — all 13 dimensions in §12, **3 findings, all 3 fixed**, every dimension answered by a check that was run | ✅ DONE |
| 23 | **Clean tree** — every untracked file is an intended deliverable; no scratch, probe or backup file in any repo; no mockup outside `Data/mockups` | ✅ DONE |
| 24 | **deploy.ps1 / ARM** — no new Azure resource, queue, container or `local.settings.json` key. ‼️ **TWO ARM files were required after all** (audit A-5, A-10): the 2Factor route is in `commonWebhookAllowRule` (`networking.json`, apex function WAF) **and** in a new `webhookAllowRule` on the per-stamp healthcheck WAF (`networking-perstamp-health.json`), which had **no provider-webhook allow rule at all** — a gap that already exposed the live realtime webhook `deploy.ps1` registers on `function-<stamp>` | ✅ DONE |
| 31 | ‼️ **2Factor delivery receipts** — `TwoFactorDeliveryReportFunction`, `AuthorizationLevel.Function`, DELIVERED / `ErrorPermanent` / else-lost / **intermediate ⇒ nothing**, address from our record, dedupe `2fdlr:{SessionId}:{StatusId}`, stale-clear guarded by `SentAt`, `TwoFactorDeliveryReportsEnabled` default true ×4 hosts. See §13 | ✅ DONE |
| 32 | **2Factor tests** — 18 unit (report + classifier), 18 function unit, 3 settings-convention, 6 real-Cosmos integration for the dedupe | ✅ DONE |
| 33 | ‼️ **Three send-path defects found while tracing 2Factor** — `RoutingSmsService` dropped `deliveryContext` on all four delegations; both providers' templated path dropped it again; 2Factor keyed every India send as a **+1** number | ✅ FIXED |
| 34 | ‼️ **SECOND FULL MULTIDIMENSIONAL AUDIT (§14)** — the lookup restore + the whole 2Factor build, 13 dimensions, **11 findings, ALL 11 FIXED** | ✅ DONE |

### Raised, deliberately NOT built — must be answered, never silently dropped

| # | Item | Where |
|---|---|---|
| 25 | ~~`HandlePdfGenerationFailureAsync`~~ — **CLOSED 2026-09-20: DELETED.** Every PDF site (Invoice, Quote, Booking, BillingReceipt) already raises an admin alert via `HandleSystemFailureAsync(forceAdminAlert: true)` and rethrows, so the method was a superseded duplicate nobody called. Removed with its `EnablePdfGenerationFailureAlerts` gate (×4 hosts), its 4 localization keys (×5 languages), its orphaned `TopicOf(documentType…)` overload and its only test | ✅ |
| 26 | ~~2Factor delivery receipts~~ — **CLOSED 2026-09-20: BUILT.** Owner approved the push design; see §13 for what shipped and §14 for its audit. The one remaining act is the owner's: register the URL under **Manage Services** | ✅ |
| 27 | ‼️ **WhatsApp for chat messages, both directions, inside the 24h window** — designed in full, owner wants it taken up **after** this programme closes | §9.7 |
| 28 | F7 — `MarketingPromotions` renders in settings and governs nothing | §9.1 |
| 29 | Voice — "the call could not be placed" belongs in this model | §9.2 |
| 30 | Global `NullValueHandling` — left alone deliberately | §9.3 |

---
## 12. ‼️ MULTIDIMENSIONAL AUDIT — 2026-09-20, all 13 dimensions, every finding fixed

> Not a test run. A separate pass, each dimension answered by a **check that was actually run**, never by an
> assertion that it looked right.

| # | Dimension | How it was checked | Result |
|---|---|---|---|
| 1 | **Correctness** | The audience matrix is pinned test-by-test in `DeliveryFailureFeedbackServiceTests`: dead address ⇒ provider + account holder; lost ⇒ provider only; declined ⇒ provider only, never the person who declined; our wall ⇒ nobody | ✅ |
| 2 | **Completeness** | Counted the write call in all four transports (ACS, Telnyx, 2Factor, Meta) and the feedback call in all three verdict paths. 4/4 and 3/3 | ✅ |
| 3 | **No false positives** | A successful fallback is the ONLY silence a failure earns (`if (fellBackToSms) return`); reputation events are `OurWall`; an unrecognised code falls to `MessageLost`, never silence | ✅ |
| 4 | **Stale data** | The key IS the address, so a correction changes the key and the marker is gone with nothing to clear. `ClearAsync` is a single unconditional delete | ✅ |
| 5 | **Cost** | One ~0.6 KB write per successful send; **zero** when nothing fails. Address health only on a terminal verdict. ‼️ **One finding — see A-1** | ✅ after fix |
| 6 | **Performance** | Exactly one `RecordAsync` per transport; the one-read contract is pinned by a test, and by a second test proving a caller-supplied record is not re-read. ‼️ **One finding — see A-3** | ✅ after fix |
| 7 | **Concurrency** | Redelivery: deterministic id, `Conflict` treated as success. Two verdicts for one message: ETag-conditional replace, proven by a **10-way concurrent race against the real emulator**. Two contacts sharing an address: both see it, correctly — it is the same broken mailbox | ✅ |
| 8 | **Privacy** | The address rides the event id as a `DeterministicGuid`, never in clear; both deep links are static paths with no address in the URL; the resource-health alert's sample stays masked | ✅ |
| 9 | **Localization** | Counted per file: server 14 notice + 4 validation × 5 languages; partner web 10 × 5; user web 3 × 5; both mobile apps × 5. **Uniform, no gaps** | ✅ |
| 10 | **Config hygiene** | All 7 settings present in all 4 hosts with values **identical to the class defaults**, and `DeliveryTrackingSettings` is bound plus both stores registered in every one | ✅ |
| 11 | **Dead code** | `IWhatsAppSmsFallbackTicketStore`, `WhatsAppSmsFallbackTicketStore` and `SmsFallbackTicketTtlSeconds` return **zero** hits across all seven .NET repos | ✅ |
| 12 | **Mobile parity** | Both apps: endpoint registered, service, component, screen wired, locales in 5 languages, `tsc --noEmit` clean, 0 ESLint errors | ✅ |
| 13 | **Clean tree** | Every untracked file is an intended deliverable. No `.pl`, `.bak`, `.orig`, probe or scratch file in any repo; no mockup outside `Data/mockups` | ✅ |

### The findings, and what each one actually was

| # | Finding | Fix |
|---|---|---|
| **A-1** | ‼️ **The cost claim was wrong.** "Clearing is free — the carrier sends the receipt anyway" confused the *receipt* with the *delete*. An unconditional `DeleteItemAsync` on **every delivered text** is a Cosmos **write**, and almost all of them are for numbers that never failed | Read first, delete only when a marker exists. The common path is now a point read that finds nothing. Two tests replace the one that pinned the old behaviour |
| **A-2** | ‼️ **`delivery_unconfirmed` was clearing the marker.** Telnyx documents it as *"no delivery confirmation from carrier"* — it is not a failure, but it is not a delivery either. Clearing on it claimed a recovery we cannot see | Only `delivered` clears |
| **A-3** | **An our-wall verdict still paid for the point read** before returning, on a platform-wide event whose alert is identity-free by design | The disposition is checked before the read. A test pins that the record is never read |

‼️ **All three were found by the audit, not by the tests** — the suites were fully green before it started.
That is the whole reason the audit is a separate pass.

### What the audit could NOT prove, stated rather than glossed

- **2Factor has no delivery receipts**, so no verdict ever arrives for India-bound texts. The record is still
  written (uniform, ready if 2Factor DLRs are ever added); the alternative was a silent exclusion.
- **Whether the SMS template placeholder resolution is case-insensitive.** It decides whether the retired
  ticket store's lower-cased keys also emptied the fallback text bodies, or only the document number. The
  merged record fixes the live path either way.
- **RU figures are reasoned from the access shape, not measured on the stamp.** Point reads and single-item
  writes on single-document partitions; no query, no index, no cross-partition anything.

**Green at the close:** 13,121 API + 5,072 Functions + 1,044 Identity + 990 MCP = **20,227 unit tests**,
plus **11 integration tests against a real Cosmos emulator**. Both web apps 0 ESLint errors; both mobile
apps `tsc` clean with 0 ESLint errors.

---
## 13. ‼️ 2Factor delivery receipts — BUILT 2026-09-20 (approved design)

**What I first said:** *"2Factor sends no delivery receipts, so India-bound texts get no verdict."*
**That was false.** It was inferred from our own code (`TwoFactorWebhookHandler` implements only
`ValidateRequest` and `ParseIncoming`) rather than from the vendor. We had never wired it; they do offer it.

### 13.1 The verified contract — quoted, never inferred

From 2Factor's own knowledge base (articles 3, 13 and 14), re-read 2026-09-20:

| Fact | Detail |
|---|---|
| Mechanism | **Callback URL, POST**, fired *"as soon as it receives acknowledgement from the Operator"*. Set under **Manage Services** in the control panel |
| Identity | **`SessionId`** — exactly what `TwoFactorSmsService` already records as the carrier message id |
| Recipient | `SmsTo` — ‼️ **article 14 shows `8431345566`, article 3 shows `918431345555`.** Two spellings for one field, in one vendor's own docs |
| Status | `SmsStatus`, `StatusGroupId`, `StatusGroupName`, `StatusId`, `StatusName`, `StatusDescription`. The one sample: `DELIVERED` / group **3** / status **5** / `DELIVERED_TO_HANDSET` |
| Error | `ErrorGroupId`, `ErrorGroupName`, `ErrorId`, `ErrorName`, `ErrorDescription`, **`ErrorPermanent`** |
| Signature | ‼️ **NONE.** Their inbound webhook has an HMAC header; the delivery callback has nothing |

‼️ **The full status-group table is published only as an IMAGE** (`ErrorCodes_SMS_Api.png`, KB article 4).
It cannot be read as text, and **nothing in this build guesses at it.**

### 13.2 The classification — and the branch that exists because the table is an image

```
ErrorPermanent == true          ⇒ AddressUnusable / Unreachable   (strongest actionable claim wins)
StatusGroupName == "DELIVERED"
      or StatusGroupId == "3"   ⇒ clear the marker
an error block is present       ⇒ MessageLost
otherwise                       ⇒ ‼️ NOTHING AT ALL
```

"An error block is present" means any of `ErrorPermanent`, `ErrorId ≠ 0`, `ErrorName ≠ NO_ERROR`,
`ErrorGroupId ≠ 0`, `ErrorGroupName ≠ OK` — all five quoted from their sample's "nothing wrong" values.

‼️ **The fourth branch is the whole point.** Their intermediate statuses are unpublished. Treating
"not DELIVERED" as a failure would tell a provider *your message was lost* while it was still travelling.
So a receipt that is neither delivered nor faulted costs **no lease, no write and no notice** — and logs at
Information, which is how we would learn their vocabulary changed.

### 13.3 The security design — three controls, none optional

`SmsWebhookFunction` validates every 2Factor request with an HMAC before routing. The delivery callback
carries no signature, so putting it there would mean a 403 on every receipt or a hole in the signature
check — and a hole there is **worse than having no receipts at all**: anyone able to POST to a public URL
could mark a real customer's number permanently unreachable.

| Control | What it is |
|---|---|
| **The function key** | `AuthorizationLevel.Function` — ‼️ the only non-Anonymous trigger in this host, and deliberately so. Azure-issued, rotatable in the portal, never in our source. Every other trigger is Anonymous because every other caller signs |
| **The `SessionId` must be ours** | An id with no `CarrierMessageLookup` record is ignored silently — no lease, no write, HTTP 200 |
| **The address comes from OUR record** | Never from `SmsTo`, which is unsigned *and* inconsistent (see 13.1) |

**Stated residual:** the function key travels in the URL query string, so it can appear in Front Door access
logs and request telemetry. That is true of every URL secret, including the secret-path-segment alternative
this replaced. It is rotatable, and possession of it alone still achieves nothing without a live `SessionId`.

### 13.4 What shipped

| Piece | Where |
|---|---|
| `TwoFactorDeliveryReport` — parse + `IsDelivered` / `HasError` / `DescribeStatus` / `DescribeError` | `clinqetshared/Models/` |
| `DeliveryVerdictClassifier.ForTwoFactor` → `TwoFactorDeliveryOutcome(Kind, Verdict?)` | `clinqetinfrastructure/Services/Communication/` |
| `TwoFactorDeliveryReportFunction` — `POST api/sms/2factor/delivery` | `clinqetfuncations/Clinqet.Communications/Functions/` |
| `DeliveryTracking:TwoFactorDeliveryReportsEnabled` (default **true**) ×4 hosts | `appsettings.json` ×4 |
| `RecordDeliverySuccessAsync(..., sentAt)` — the stale-clear guard | `DeliveryFailureFeedbackService` |
| `/sms/2factor/delivery` added to `commonWebhookAllowRule` | `azureautomation/networking.json` |

**Idempotency.** `2fdlr:{SessionId}:{StatusId}` under channel `SmsDlr2Factor`. Completed ⇒ 200 and ignore.
Busy ⇒ **503** (2Factor documents no retry policy, so a 503 is the only thing that *could* recover it and
can never be worse than a 200). ‼️ **Applied-but-unmarked releases the lease instead of completing it** —
the feedback service swallows a store failure by design, so completing would consume the only receipt this
message will ever get and leave the number unmarked for good.

**The stale-clear guard.** A DELIVERED receipt clears the marker only when the send it belongs to is newer
than the failure on record. Their receipts can lag; without this, one late success un-warns a number that
is genuinely dead.

**Encodings.** Form-urlencoded (their samples), JSON, and query-string are all read; a body we cannot parse
yields an empty form and is answered as a missing `SessionId` — acknowledged and dropped.

### 13.5 Cost — checked, not assumed

- **Theirs:** the callback is a **Manage Services setting**, not a product. Their KB mentions no fee for it
  anywhere, and their billing is per delivered SMS. ‼️ Their pricing page sits behind a bot challenge I did
  not bypass, so *"no documented cost"* is the honest claim — the account manager can confirm it outright.
- **Ours:** no new Azure resource. Per receipt: one function execution, one ~1 RU point read, and a write
  only on a terminal verdict. An intermediate hop costs the read and nothing else.

### 13.6 ‼️ The two things only the owner can do

1. **Register the URL** under **Manage Services** in the 2Factor control panel:

   | Environment | URL |
   |---|---|
   | **Production** | `https://function-in.clinket.com/api/sms/2factor/delivery?code=<function key>` |
   | UAT | `https://function-in.uat.clinket.com/api/sms/2factor/delivery?code=<function key>` |
   | Dev | `https://function-in.dev.clinket.com/api/sms/2factor/delivery?code=<function key>` |

   ‼️ **`function-in`, the INDIA per-stamp hostname.** 2Factor only serves India, and the send record lives
   in the India stamp's Cosmos — a receipt delivered to the CA stamp finds no record and is ignored. The
   apex `function.<apex>` route is bound to a stamp-named origin group, so it is NOT geo-routed and must
   not be used here.
   ‼️ **Front Door, never `*.azurewebsites.net`** — in production the Functions app denies every request
   that did not arrive through Front Door with the matching `x-azure-fdid` header.
   The `<function key>` is the **default host key** from the Function App → *App keys* blade in the portal.
2. **Deploy BOTH `networking.json` and `networking-perstamp-health.json`**, or the route falls through to
   the 200/min per-IP block instead of the provider-webhook allow rule.

### 13.7 Deliberately not built

**OTP sends record no carrier message**, so an OTP's receipt has no record and takes the ignore path. That
is correct: an India OTP failure is already alerted at send time with no free-text fallback (DR-1), there is
no contact to warn, and writing a Cosmos document on the auth hot path would buy nothing.

---

## 14. ‼️ SECOND MULTIDIMENSIONAL AUDIT — 2026-09-20, the lookup restore + the 2Factor build

> Scope: everything built after the §12 audit — the restored `/delivery-health/lookup` and its four client
> surfaces, and the whole 2Factor delivery-receipt path including its infrastructure reachability.
> **11 findings. ALL 11 FIXED** — the last one (A-11) closed on the owner's instruction that nothing but the WhatsApp-chat scope may stay pending.

| # | Dimension | What was checked | Outcome |
|---|---|---|---|
| 1 | Carrier truth | Every 2Factor field re-read from their KB; the status table proven unreadable (an image) and therefore never guessed | **A-1** |
| 2 | Security — auth | The unsigned callback; why `AuthorizationLevel.Function` and not the signed webhook; the key-in-URL residual | ✔ §13.3 |
| 3 | Security — poisoning | Can a caller condemn an arbitrary number? No: unknown `SessionId` ⇒ nothing, and the address is ours | ✔ pinned by test |
| 4 | Security — the lookup oracle | Cap, pacing, bucket, 429 | **A-8** |
| 5 | Correctness — classification | Delivered / permanent / temporary / intermediate, and the contradictory-payload case | ✔ 18 tests |
| 6 | Correctness — identity | The address key a 2Factor send is recorded under | **A-2** |
| 7 | Correctness — plumbing | Does the recipient actually reach the record on the SMS path? | **A-3** |
| 8 | Idempotency & races | Redelivery, two verdicts for one session, channel isolation, 10-way concurrency, release-and-retake | ✔ 6 real-Cosmos tests |
| 9 | Resilience | What happens when each collaborator fails | **A-6, A-9** |
| 10 | Reachability | ‼️ Front Door deny-all, BOTH WAF rule sets (apex + per-stamp), which hostname actually reaches the India stamp, the geo list, caching of `?code=` | **A-5, A-10** |
| 11 | Cost | Reads/writes per receipt; the intermediate path costs one read | ✔ §13.5 |
| 12 | Config & orphans | 10 settings ×4 hosts, class↔appsettings parity, every key read by something | **A-4, A-7** |
| 13 | Conventions | §0.12 defaults, §0.14 comments, §0.15/§0.17 test placement, §0.16 clean tree, CA1068 | **A-6** |

### The findings

| id | What it was | Why it mattered | Fix |
|---|---|---|---|
| **A-1** | 2Factor's status-group table is published only as an image | Any classification built on guessed status words would invent failures | The fourth branch: neither delivered nor faulted ⇒ nothing at all |
| **A-2** | ‼️ `TwoFactorSmsService` recorded the **10-digit national** number with a **null** country, and the key normaliser falls back to **US** — so every India send was keyed `+1…` | The `+91` contact could never match it. Every India verdict would have marked a number that does not exist | Normalise with `IN` |
| **A-3** | ‼️ `RoutingSmsService` accepted `deliveryContext` and **forwarded it on none of its four delegations**; both providers' templated path dropped it again | `ISmsService` **is** the router in production ⇒ every SMS send record had no recipient at all ⇒ every SMS failure degraded to an admin-only alert. The feature was wired to nothing on the SMS side | Forward it, all six call sites |
| **A-4** | No parity guard over `DeliveryTrackingSettings`, now 10 settings across 4 hosts | A class default drifting from appsettings means the same switch is on in one process and off in another | `DeliveryTrackingSettingsConventionTests` (reflection-derived, orphan-detecting) |
| **A-5** | ‼️ In production the Functions app is **Front-Door-only**, and the WAF's provider-webhook allow rule short-circuits geo + a **200/min per-IP block**. The new route was not in it | India is allowed by the geo list, so this would not have failed outright — it would have silently dropped receipts under load, unrecoverably | `/sms/2factor/delivery` added to `commonWebhookAllowRule` |
| **A-6** | An unused `using`, and `sentAt` placed after `CancellationToken` (CA1068) | §22.2 / analyzer convention | Both corrected |
| **A-7** | `Validation_DeliveryHealth_TooManyLookups` existed in 5 languages and was read by nothing | §22.11 orphan | The 429 now carries it |
| **A-8** | ‼️ The restored endpoint's own comment promised *"Over the limit answers 429"* and a *"per-caller sliding window WEIGHTED BY BATCH SIZE"* — **there was no limiter**, and `AddressHealthLookupsPerMinute` was read by nothing. The clients' 60s back-off could never fire | The one surface that answers about an address the caller may not own was bounded per-call and unbounded per-caller | `ISearchRateLimitService.TryAcquire(bucket, limit, addressCount)`, bucketed on `UserNumber`, 429 + `Retry-After: 60`; 4 new tests |
| **A-9** | The function completed its lease even when the marker had not landed — both collaborators swallow, so nothing threw | The only receipt this message will ever get, spent on a write that failed | Release + 503 when the durable half did not land |
| **A-10** | ‼️ The **per-stamp** healthcheck WAF has **no provider-webhook allow rule at all**, and the callback has to use the per-stamp hostname because the apex function route is bound to one stamp's origin group rather than geo-routed | Fixing A-5 on the apex WAF would have fixed nothing for this callback. Worse, it is pre-existing: `deploy.ps1` registers the Azure **realtime** webhook on `function-<stamp>`, so that live callback is charged against the 200/min per-IP block today | `webhookAllowRule` added to `networking-perstamp-health.json`, byte-identical to the apex list and deliberately kept OUT of `baseRules` so the admin WAF keeps its IP allowlist over every path |
| **A-11** | ‼️ A failed Cosmos read returned null, exactly like an unknown id — and a **test asserted that as correct** | Every verdict arriving during a store outage was acknowledged and thrown away, invisibly | `TryGetAsync` throws; the five call sites were each checked first (see item 4 below); the test now pins the opposite |

### ‼️ Deployment settings — what deploy.ps1 does and deliberately does not write

| Setting | Where | Why |
|---|---|---|
| `DeliveryTracking__TwoFactorDeliveryReportsEnabled` | ‼️ **Per-stamp env var** in `deploy.ps1`: `true` on **in**, `false` elsewhere | 2Factor serves India only. A non-IN stamp holds no India send record, so its endpoint can do nothing — it should say so rather than look live. Mirrors `Voice__Carrier` / `WhatsApp__WabaLanguages` |
| The 2Factor callback URL | ‼️ **PRINTED, never stored.** `deploy.ps1` resolves the function host key and prints the whole URL in the final ACTION REQUIRED block | 2Factor has no API for it — Manage Services is a portal form. No code reads the URL, and an unread key is an orphan (§4) |
| The other nine `DeliveryTracking` keys | `appsettings.json` ×4 hosts only | Identical in every environment and every stamp. An env var that restates a committed default is two places to change and one place to drift (§4) |
| Anything else | — | No new Azure resource, queue, storage container or `local.settings.json` key, so nothing else is owed to ARM (§25) |

### What this audit could NOT prove, stated rather than glossed

1. **That 2Factor retries a non-2xx.** Undocumented. Every non-success answer here is a 503 because that is
   the only status that *could* be retried; none of the logic depends on it being retried.
2. **That their intermediate statuses behave as assumed.** The table is an image. The design is built so
   that being wrong about them costs nothing and logs.
3. **That the callback is free.** No documented fee, and no pricing page reachable without defeating a bot
   challenge. The account manager can settle it in one question.
4. ~~Stated residual~~ — **A-11, CLOSED on the owner's instruction ("nothing should be pending").**
   `CarrierMessageLookupStore.TryGetAsync` swallowed a non-`NotFound` Cosmos error and returned null, so a
   read outage was indistinguishable from "unknown session" and every verdict arriving during one was
   acknowledged and thrown away. It now **throws**; null means NOT FOUND and nothing else.
   All five call sites were checked before the contract changed, not after:

   | Call site | Behaviour on a throw | Safe? |
   |---|---|---|
   | `TwoFactorDeliveryReportFunction` | now catches ⇒ **503**, no lease taken | ✔ the receipt can come back |
   | `DeliveryFailureFeedbackService.TryReadRecordAsync` | already caught ⇒ degrades to an admin-only alert | ✔ its catch was previously **unreachable** |
   | `WhatsAppStatusProcessorFunction` failure-alert enrichment | already caught ⇒ best-effort | ✔ |
   | `WhatsAppStatusProcessorFunction.HandleReadReceiptAsync` | propagates ⇒ Service Bus retry | ✔ `NotifyConversationReadAsync` is idempotent |
   | `WhatsAppInboundResolver` (L2 reply-context) | propagates ⇒ Service Bus retry | ✔ `MarkProcessedAsync` runs only AFTER success, so redelivery re-resolves rather than being deduped away |

   ‼️ **A test was pinning the defect.** `TryGet_WhenCosmosIsDown_ReturnsNullRatherThanThrowing` asserted the
   old behaviour in so many words; it now asserts the opposite. A real-Cosmos integration test proves the
   throw as well, because it turns on Cosmos's own 404-vs-other split.
