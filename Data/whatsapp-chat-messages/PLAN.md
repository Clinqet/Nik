# WhatsApp for chat messages — PLAN (design and analysis only)

> **Status: DESIGN ALIGNED WITH THE OWNER 2026-09-20 (§0.1). No code, no tests, no migrations, no repo file was touched.**
> **Nothing is owed. 2026-09-20, end of day: every decision answered (§0.1, §15.1), both §0.7 asks approved (§11,
> §11.2), the mockup approved (§14), the 16 Meta templates created and APPROVED / UTILITY (§7.7), and the owner's go
> for the build given. The next session builds §13 in order, then runs §16 and ticks §17.**
> Authority document for this programme once approved. Parent: `Data\delivery-failure-feedback\PLAN.md` §9.7
> (the shape agreed 2026-09-19/20). Siblings: `clinqet-whatsapp`, `clinqet-messaging`, `clinqet-delivery-feedback` skills.
>
> Every claim about current behaviour below cites the file and line it was read from. Every external fact names its
> source. Anything that could not be verified is in §18, not asserted. §16 is the audit, §17 the completion checklist.

---

## 0. ‼️‼️ RULE ZERO — NEVER ASSUME. ASK.

Carried verbatim from the parent programme. If implementing a phase reveals that a decision here is wrong,
incomplete, or does not fit the code as it is — stop and ask. A line in this plan is **not** §0.7 approval for anything
beyond what §11 lists, and §11 itself is a request, not an approval, until the owner says yes in the conversation.

---

## 0.1 ‼️ DECIDED WITH THE OWNER — 2026-09-20 (this table outranks any "recommended" wording below)

| # | Decision | Owner's answer |
|---|---|---|
| 1 | **Both directions**, in one build | Yes. Business side: hold the email **only for the member whose own phone is the business WhatsApp phone**; every other member keeps in-app + push + email as today. Solo businesses behave identically on both sides. ‼️ **Amended 2026-09-21:** only when **exactly one** active member matches — two or more, or none, ⇒ hold nothing (§7.2) |
| 10 | **Third record field `chatRelay`** (build session, 2026-09-21) | Approved. A `delivered` webhook cannot otherwise tell a relay from a closed-window notice, and a two-valued `emailHeld` was rejected because a relay to a recipient with no email on file would never earn the tick. Five approved fields in total (§11) |
| 2 | **Inside the window** | Full message on WhatsApp as today (text AND attachments, §6.5); the email is not sent; it is kept as the note and released only if WhatsApp fails within the cutoff |
| 3 | **Outside the window** | The short WhatsApp notice **replaces** the email on the first message of a quiet period; later messages in the same quiet period keep today's email; a cancel-on-read skip sends no email either |
| 4 | **Attachments** | Everything in this build, no phase 2 — rules in §6.5 |
| 5 | **Cutoff** | 6 hours (`LateEmailFallbackMaxAgeMinutes = 360`) |
| 6 | **Held-back email shape** | **APPROVED 2026-09-20 (five fields offered; two are needed — fewer, never more).** The record gains `emailHeld` and `emailReleasedAt` only. **Nothing a person can change is copied**: no message text (plain or encrypted), no email address, no context. At release the message, the recipient's own conversation document and the recipient's current email are point-read from their sources and every edge case is decided from live truth (§7.1 decision table). The owner asked whether an encrypted text copy could save the read: answered no — a copy cannot know about removal, edit, read, mute, block or an address change, the helper is fail-open, and it would cost every happy send to save a read on the rare failure |
| 7 | **Templates** | Read live 2026-09-20: all 16 variants of `clinket_new_message_customer` / `_provider` are APPROVED / UTILITY with a **static** URL button. **New** templates `clinket_chat_reply_customer` / `clinket_chat_reply_provider` with the **same words** and a **dynamic** conversation link were **CREATED and APPROVED / UTILITY the same day** (16 variants, byte-verified against the originals — §7.7); the old two keep sending until the switch ships with the code, then delete them |
| 8 | **Suspected defect F-A** | Fixed in the same build (pre-prod: "do it fully correct") |
| 9 | **Second and third rounds, 2026-09-20 — all answered** | D-2 approved · D-8 yes, per side and per conversation · D-9 yes, customer per conversation, provider as today · D-12 approved with the 2-hour delivery check + admin alert (§7.1.1) · D-13 approved: in-thread delivery line + **delivered tick** (§11.2, per-delivered write confirmed) · D-17 yes · D-18 approved: real button + footer, two messages when over 1024 characters (§7.3) · D-19 yes · mockup **approved including 5h/5i**, revised the same day at the owner's request · hint-line wording approved · templates switch + deletion as the build's first item; **no backfill, sandbox only** — see §15.1 |

## 1. The problem in one sentence

A chat message reaches the other person as in-app + push + an **email**; when that person messaged us on WhatsApp in the
last 24 hours, WhatsApp is demonstrably their live channel, free and instant, and the email is a second ping for the
same message that teaches people to mute us.

## 2. What the code does TODAY — facts, not the §9.7 "Today" paragraph

‼️ **§9.7's "Today" paragraph is out of date.** It says chat is in-app + push + email and that WhatsApp is not used.
The code already relays chat messages on WhatsApp **in both directions**, through two dedicated paths that bypass the
dispatcher. What is missing is exactly one thing: **the email is never held back**. Read the table before anything else,
because the design is a much smaller delta than §9.7 implies.

| # | Fact | Where |
|---|---|---|
| T1 | The chat fan-out is `MessageService.ProcessPostSendActionsAsync`, a background step after the message is written | `clinqetinfrastructure/Services/Messaging/MessageService.cs:213` |
| T2 | The **email** for a chat message goes through the dispatcher with `SkipSms = true` and no WhatsApp fields — customer recipient at `:407-432`, business recipient (per member, in each member's language) at `:399` → `DispatchToBusinessAsync` `:647`. The email body is a **240-character preview** plus a link to the thread | `MessageService.cs:382`, `:388`, `:945-948`; template `clinqetinfrastructure/Resources/EmailTemplates/en/DirectMessage.html` |
| T3 | **Provider→customer WhatsApp exists**: `WhatsAppChannelRouter` runs from T1 only when the recipient is the Customer AND the conversation's `activeChannels` contains a non-Platform channel | `MessageService.cs:503-538`; `clinqetinfrastructure/Services/Messaging/WhatsAppChannelRouter.cs:53` |
| T4 | The router needs the customer's WhatsApp key stamped on the conversation (`externalChannelIds["WhatsApp"]`, absent ⇒ no-op), a non-empty text (attachment-only ⇒ no-op), a non-blocked contact, and an `ActiveContexts` entry **for this conversation** that is not `PerProviderMuted` | `WhatsAppChannelRouter.cs:57-62`, `:72`, `:77-79` |
| T5 | **Window open ⇒ the FULL message text goes as a free-form session text**, with the sender's name bolded above it **only when the customer has 2+ active chats**; it flows even while OptedOut (a reply to their own inbound) | `WhatsAppChannelRouter.cs:81-93`; `clinqetshared/Utilities/WhatsAppAttribution.cs:8-13` |
| T6 | **Window closed ⇒ a paid template `clinket_new_message_customer`** (param `providerName`), consent-gated, debounced to once per customer-silence period, held **25 s** and cancelled if the customer read in-app, `CapExempt` | `WhatsAppChannelRouter.cs:97-99`, `:126-177`; `clinqetshared/Models/WhatsAppSettings.cs:57`, `:253-259`; `clinqetapi/Clinqet.API/appsettings.json:651-653` |
| T7 | **Customer→provider WhatsApp exists**: `WhatsAppProviderNotifier` runs from T1 when the recipient is the business and `BusinessProfile.PhoneNumber` normalises to E.164 | `MessageService.cs:442-450`, `:260`; `clinqetinfrastructure/Services/Messaging/WhatsAppProviderNotifier.cs:48` |
| T8 | It is gated on: not muted, non-empty text, the **primary owner's** `WhatsAppMessageAlertsEnabled` (SQL, default true, fail-open), contact not blocked. Window open on **any** of the provider's contexts ⇒ full text as a session text; closed ⇒ debounced (first unread only) template `clinket_new_message_provider` after auto-consent, registering a provider-side context so the reply routes back | `WhatsAppProviderNotifier.cs:61-63`, `:71-72`, `:77-89`, `:92-112`; `clinqetcore/Entities/SQL/CommunicationPreference.cs:19` |
| T9 | ‼️ The **in-window provider branch registers NO provider-side context** — only the closed-window branch does (`:108-110`). See F-A | `WhatsAppProviderNotifier.cs:84-89` |
| T10 | `MessagesChats` is **not** in `WhatsAppEligibleCategories`; both chat paths are dedicated precisely because the in-window send needs no template | `clinqetshared/Models/CommunicationPreferenceConfig.cs:26-37`, `:45`, `:60`; `MessageService.cs:442` |
| T11 | The outbound processor sends a `SessionText` with no template, no cap and no consent gate other than a block; on success it writes ONE `CarrierMessageLookup` record carrying conversation, message, recipient and the held-back **SMS** (`Fallback`) | `clinqetfuncations/Clinqet.Communications/Functions/WhatsAppOutboundProcessorFunction.cs:224`, `:333-364`, `:558-597` |
| T12 | On a synchronous Meta failure it classifies the code: `Retry` / `FallbackOnly` / `FallbackAndBlock`; the SMS fallback is re-dispatched right there; **131047 (window closed) is in neither list ⇒ `FallbackOnly`** | `WhatsAppOutboundProcessorFunction.cs:372-408`; `clinqetinfrastructure/Services/Communication/WhatsAppErrorClassifier.cs:41-50`; `clinqetfuncations/Clinqet.Communications/appsettings.json:622-625` |
| T13 | On an asynchronous Meta `failed` status the status processor claims the held-back SMS (ETag replace, exactly one winner), judges the switch and the **30-minute** staleness cutoff BEFORE claiming, sends it, then tells the human unless the fallback delivered | `clinqetfuncations/Clinqet.Communications/Functions/WhatsAppStatusProcessorFunction.cs:143-145`, `:210-236`, `:312`; `clinqetinfrastructure/Services/Communication/CarrierMessageLookupStore.cs:104-134`; `clinqetshared/Models/DeliveryTrackingSettings.cs:28-33` |
| T14 | **Every** Meta status (`sent`, `delivered`, `read`, `failed`) is enqueued by the webhook — so one WhatsApp send costs up to 4 webhook executions, 4 queue messages and 4 status-processor executions | `clinqetfuncations/Clinqet.Communications/Functions/WhatsAppWebhookFunction.cs:228-232`, `:250-281` |
| T15 | A WhatsApp `read` marks the thread read in-app for the recipient and broadcasts `ConversationRead` to the sender; for the provider side the reader is the **business**, so it clears the whole team's unread (L107) | `WhatsAppStatusProcessorFunction.cs:378-390`; `clinqetapi/Clinqet.API/Controllers/Notification/InternalNotificationTriggerController.cs:122-130` |
| T16 | A **customer's** WhatsApp reply threads into the same Direct conversation (resolver L1–L7); a **provider's** reply threads when the resolver finds a provider-side context for that conversation, else it is treated as a customer inbound | `clinqetinfrastructure/Services/Communication/WhatsAppInboundResolver.cs:31-97`; `clinqetfuncations/Clinqet.Communications/Functions/WhatsAppInboundProcessorFunction.cs:193-212`, `:1214`, `:1277`, `:1307` |
| T17 | A window opens **only** on an inbound from that phone: customer side `RegisterInboundConversationAsync` (24 h, or 72 h free-entry), provider side `RegisterProviderInboundContextAsync`. CRM outreach and the provider-recipient registration create a context with **no window** | `clinqetinfrastructure/Services/Communication/WhatsAppConsentService.cs:532-564`, `:584-654`, `:674-706`, `:728-755`; `WhatsAppSettings.cs:80`, `:93` |
| T18 | The record store is a single-document partition in `SystemData` (`/pk`, `/*` excluded from indexing) — point reads only, no index change is ever needed for a new optional field | `CarrierMessageLookupStore.cs:46-57`, `:253-290`; `clinqetcore/Cosmos/Setup/CosmosContainerPolicies.cs:613-617` |
| T19 | The delivery-failure notice for a chat WhatsApp failure today goes to the **provider** as *"A message did not arrive … please try again"* (`ContactLost`), because a session-text record carries no `RecipientType` | `clinqetfuncations/Clinqet.Communications/Services/DeliveryFailureFeedbackService.cs:59-64`, `:190-197`; `clinqetinfrastructure/Resources/Localization/en.json:1341-1342` |
| T20 | Messages have **no edit endpoint** (`IsEdited` has no writer) and no user delete; the only removal is admin moderation `isRemoved`. Conversation "delete" is a per-side hide | `clinqetapi/Clinqet.API/Controllers/Messaging/MessageController.cs:67`, `:157`, `:196`, `:347`; `clinqetinfrastructure/Data/COSMOS/MessageRepository.cs:319` |
| T21 | UI today: partner web/mobile thread shows a WhatsApp badge and a 24 h **window banner** (open / expiring / closed / opted-out / blocked) from a single point-read; customer web shows a badge and a status line; **customer mobile chat shows nothing WhatsApp-related** | `clinqetwebpartnerapp/src/app/dashboard/inbox/page.jsx:1335-1350`, `:2400`, `:2656-2662`; `clinqetmobilepartnerapp/src/Screen/InboxTab/ChatDetails/index.tsx:629-656`, `:1723-1729`; `clinqetwebuserapp/app/(customer)/messages/page.js:1170`, `:1194-1196`; `clinqetshared/DTOs/Messaging/ConversationDtos.cs:52-68`; `clinqetmobileuserapp/src/screen/messaging` (no match for `whatsapp` or `activeChannels`) |
| T22 | Settings today: the WhatsApp **master** toggle (consent) on both web settings pages lists the eligible categories as chips — `MessagesChats` is not among them; the provider has a separate **"WhatsApp message alerts"** toggle (web + mobile) | `clinqetwebpartnerapp/src/components/Profile/Notifications.jsx:217`, `:274`; `clinqetwebuserapp/app/(customer)/settings/notifications/page.js:311`, `:334-335`; `clinqetmobilepartnerapp/src/Screen/ProfileFlow/NotificationScreen/index.tsx:436-440` |
| T23 | `MessageService` (and therefore both WhatsApp chat paths) runs in **two hosts**: the API, and the Functions host for inbound WhatsApp ingest | `clinqetapi/Clinqet.API/Program.cs:980-985`; `clinqetfuncations/Clinqet.Communications/Program.cs:385-391`, `:367` |

### 2.1 Defects and gaps found while reading (found by reading, not by running — each needs a test before it is called real)

| # | Finding | Where | Why it matters here |
|---|---|---|---|
| **F-A** ‼️ | The in-window customer→provider session text (T9) registers no provider-side context. If the provider's window is open because of conversation X and a customer in conversation Y writes, Y's text is sent but Y is not a routing candidate. A plain reply routes by the resolver's heuristics (`:82-94`) — to X. A swipe-reply hits L2, finds no provider-side context for Y's conversation, falls to `Route(lookup.BusinessId)` (`WhatsAppInboundResolver.cs:63-64`), and the processor then finds no `IsProviderSide` context with that route key (`WhatsAppInboundProcessorFunction.cs:203-212`) ⇒ **the provider's reply is ingested as a customer inbound to their own business** | `WhatsAppProviderNotifier.cs:84-89` vs `:108-110` | This programme puts more chat on that path. The fix is one conditional write (`RegisterProviderRecipientContextAsync` is a no-op when already current, `WhatsAppConsentService.cs:696-700`). **Owner approval needed — it is a behaviour change** |
| **F-B** | The router ignores the recipient's **in-app mute**: email and push are skipped when muted (`MessageService.cs:240`, `:388`, `:431`) but the WhatsApp session text still goes (`:503-538` never reads `recipientMuted`); the provider notifier does honour it (`WhatsAppProviderNotifier.cs:61`) | `MessageService.cs:503-538` | Decide whether mute means "not on WhatsApp either" (D-8) |
| **F-C** | A failed chat relay tells the provider *"please try again"* (T19) although the message is in the thread and in-app + push delivered. For a chat send the honest answer is different | `DeliveryFailureFeedbackService.cs:190-197` | Decide the chat-specific outcome (D-13) |
| **F-D** | `SanitizeOutbound` strips `{n}` tokens from **user-authored** chat text and raises an admin alert — a customer typing `{2}` in a message is "corrected" | `WhatsAppOutboundProcessorFunction.cs:190`, `:726` | Low. Raise, do not fix here |
| **F-E** | The Direct email **subject** for a business recipient is rendered once in the business profile's language, not per member | `MessageService.cs:373-377` (subject built before the per-recipient factory) | Option O2 in §6.2 fixes it for free on the release path |
| **F-F** | Customer mobile chat has no WhatsApp badge or status line while customer web has both (T21) | `clinqetmobileuserapp/src/screen/messaging` | Pre-existing parity gap; in scope only if a sheet is drawn |

---

## 3. Goals and non-goals

**Goals**
1. Inside an open window, the message reaches the person on WhatsApp **once**, and the email is **not** also sent.
2. If WhatsApp fails — synchronously or hours later — the email that was held is released **exactly once**, unless it is too late to be useful.
3. In-app + push are unchanged in every case. Nobody is ever left with nothing.
4. Nothing new is paid for: no template is preferred over a free path; the window-closed behaviour is unchanged.
5. Mobile mirrors web wherever a screen changes.

**Non-goals**
- No change to consent, STOP/START, the send cap, or the WABA monitor.
- No change to the dispatcher's transactional WhatsApp rail.
- No new container, partition key, SQL column or search field.
- Not fixing F-D or F-F here; they are raised.

---

## 4. The agreed shape (§9.7) and the delta it actually is

| | §9.7 says | Today (§2) | Delta |
|---|---|---|---|
| In-app + push | unchanged | in-app + push always | none |
| Window open | full message on WhatsApp, naming the sender, link to the thread, free-form | full text, sender named **only with 2+ chats**, **no link** | attribution + link copy (D-18) |
| Window closed | nothing changes | email + in-app + push **+ the paid notify template (T6/T8)** | none by §9.7 — but the template is part of "today" (D-3), and the owner asked on 2026-09-20 whether the email should be held behind it too (§6.7, D-20) |
| Email inside the window | held back, released only if WhatsApp fails, same record, same once-only claim | sent alongside | **the whole build** |
| Staleness | its own cutoff, longer than the text's 30 min | n/a | new setting (D-4) |
| Direction | both, inside the window | both already exist | hold-back per direction (D-1) |

---

## 5. External facts — verified, with sources

| Fact | Source (read 2026-09-20) |
|---|---|
| Since **1 July 2025** Meta charges **per delivered template message**; *"Utility template messages sent within an open customer service window are free"*; *"All non-template messages are free"* and can only be sent inside an open window | developers.facebook.com/docs/whatsapp/pricing and developers.facebook.com/documentation/business-messaging/whatsapp/pricing |
| The customer service window *"starts"* when *"a WhatsApp user messages you or calls you"*, lasts **24 hours**, resets on each new user message; inside it *"you can send any of the service message types"*; outside it *"you can only send pre-approved template messages"* | developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages |
| A free-entry-point (ad / CTA) conversation opens a **72-hour** window in which *"you can send any type of message to the user at no charge"* | pricing page above; matches `FreeEntryWindowHours` (`WhatsAppSettings.cs:93`) |
| **Utility** = *"follow up on user actions or requests"*; **Marketing** = awareness / promotion / retargeting. Since **9 April 2025** a template submitted as utility but judged marketing is **approved as MARKETING**, not rejected; a review can be requested within 60 days | developers.facebook.com/docs/whatsapp/updates-to-pricing/new-template-guidelines |
| A text message body is **maximum 4096 characters**; URLs are auto-hyperlinked; `preview_url` renders a preview of the first URL | developers.facebook.com/docs/whatsapp/cloud-api/messages/text-messages |
| Media limits: image JPEG/PNG **5 MB**; video MP4/3GP **16 MB** (H.264/AAC); document **100 MB** (PDF, Office, txt); audio 16 MB | developers.facebook.com/docs/whatsapp/cloud-api/reference/media |
| Error **131047**: *"More than 24 hours have passed since the recipient last replied to the sender number"* — *"Send the recipient a template message instead"*. **131026**: *"Unable to deliver message. Reasons can include: The recipient phone number is not a WhatsApp phone number"*. Errors are returned *"either synchronously as a Graph API response, asynchronously via Webhook, or sometimes through both"* — the page does **not** say which per code | developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes |
| WhatsApp Business Messaging Policy, verbatim: *"You may reply to a user message without use of a Message Template as long as it's within 24 hours of the last user message."* · *"Outside the 24-hour customer service window, you may only send messages via approved Message Templates."* · ‼️ *"You may not forward or otherwise share information from a customer chat with any other customer."* (section *Protect Data and Comply with Law*) · *"You may only contact people on WhatsApp if: (a) they have given you their mobile phone number; and (b) you have received opt-in permission…"* | whatsappbusiness.com/policy (business.whatsapp.com/policy redirects there) |
| The Cloud API messages reference exposes **no delete or unsend** operation for a sent message | developers.facebook.com/docs/whatsapp/cloud-api/reference/messages (absence), community thread 675781224420580 |

**What could NOT be verified** (details in §16): the per-country **rate card numbers**. Meta's own rate card is behind a
JavaScript calculator and downloadable CSVs whose URLs the pages do not expose; the copy on business.whatsapp.com shows no
static numbers; a mirrored PDF could not be rendered in this session; Twilio's page rendered contradictory
default-country values. Third-party figures quoted by Route Mobile (India marketing **₹0.8631** from 2026-01-01,
utility/authentication *"roughly stable around ₹0.115"*; US marketing **$0.025**) are **unverified** and are not relied on
below. The owner can read the exact numbers in WhatsApp Manager under Billing.

---

## 6. Options considered

### 6.1 Where the "hold the email" decision lives

| Option | Shape | Lose |
|---|---|---|
| **A — decide in `MessageService`, before the dispatcher (RECOMMENDED)** | The router/notifier gain a cheap **pre-check** (`WillCarryInWindow`) that does the contact read they already do; if true, the dispatcher request is built with `SkipEmail = true` and the email is attached to the WhatsApp queue message as a held-back descriptor. Order becomes: WhatsApp enqueue → dispatcher | The router does its contact read before the dispatcher runs — same read, earlier. Two hosts run this code (T23), so the setting lives in both |
| B — fold chat into the dispatcher's WhatsApp rail | Add `MessagesChats` to the eligible set and teach `EvaluateWhatsAppWillSendAsync` a template-less session mode | Touches the transactional rail every booking/quote/billing send rides; the window check does not belong in a component that today never reads a contact's contexts. Rejected |
| C — send the email, then try to cancel it | Enqueue the email scheduled +N seconds and cancel on WhatsApp success | A cancellation race on every message, an ACS send that happens whenever the cancel loses, and it still pings twice on a slow Meta. Rejected |

### 6.2 What the held-back email IS

| Option | Shape | Lose |
|---|---|---|
| O1 — the fully rendered `EmailNotificationMessage`(s) on the record | Zero reads at release | For a business recipient that is **N** rendered emails per message (`MaxRecipientsPerEvent` is 100, `clinqetshared/Models/NotificationRoutingSettings.cs:9`), stored for up to 7 days, and the recipient set is frozen at send time |
| **O2 — a compact release descriptor, re-dispatched through the existing dispatchers (DECIDED, refined 2026-09-20: the note carries NO message text — see §11)** | **Final shape (2026-09-20):** the queue message carries `HeldBackEmail { RecipientType, RecipientUserNumber, RecipientUserId }` — identity only; the record gains `emailHeld` + `emailReleasedAt` (§11). Release = the §7.1 decision table: read the message, the recipient's conversation document and the recipient's current profile, then claim, then the same email dispatch the producer would have made, email-only, deterministic `IdempotencyKey`. The draft shape that copied a preview, an address and the context onto the record was withdrawn — every one of those can change inside the window | The business side pays one SQL recipient resolve at release (`BusinessCommunicationDispatcher.DispatchAsync`, `clinqetinfrastructure/Services/Communication/BusinessCommunicationDispatcher.cs:57`) — and gets the **current** recipient set and per-member subject language (fixes F-E) for it |
| O3 — store nothing, re-read Message + Conversation + profile | Smallest record | Three to four reads on the failure path against the parent's one-read rule; message content is encrypted at rest and would be decrypted purely to re-render an email. Rejected |

### 6.3 Direction — is customer→provider appropriate?

It already exists (T7–T8). The question is whether to **keep** it and whether to **hold the email** on that side.

| | For | Against |
|---|---|---|
| Keep customer→provider on WhatsApp | The business model reframe (skill, s22): fastest lead, fastest answer; providers live in WhatsApp; a provider can reply from WhatsApp and it threads (T16). The primary owner has an explicit off switch (T8) | ‼️ The policy sentence *"You may not forward or otherwise share information from a customer chat with any other customer"* — a strict reading covers relaying one WhatsApp user's words to another over one business number. The counter-reading: the customer wrote **to the provider** through Clinket, on Clinket's terms, and the provider is the intended recipient, not "another customer". **This is a legal/policy call only the owner can make, and it applies equally to what is live today** |
| Hold the provider-side email | Symmetric with the customer side; a solo provider's phone and email are the same person | ‼️ The WhatsApp goes to **one** business phone; the email goes to **N** resolved members in each one's language, honouring each one's channess policy and digest mode (`BusinessCommunicationDispatcher.cs:242-249`, `:384-436`). Holding N people's emails because one phone got a WhatsApp is wrong whenever N > 1 or the phone is not the assignee's |

**First recommendation (superseded 2026-09-20 by §0.1 row 1):** hold on provider→customer only, then solo businesses.
**Decided instead:** both directions in one build, and on the business side hold **only the email of the member whose
own phone is the business WhatsApp phone** — which makes the team case and the solo case one rule (§7.2).

### 6.4 Window semantics — per conversation (today) or per phone (Meta's rule)

Meta's window is a property of the **phone ↔ business-number** pair. The router checks the window of **this
conversation's** context (`WhatsAppChannelRouter.cs:77-81`); the provider notifier checks **any** context
(`WhatsAppProviderNotifier.cs:81`). A customer who wrote to business B two hours ago has an open window for
business A's message too, and today A's message is not relayed.

| Option | Lose |
|---|---|
| Keep per-conversation (DECIDED 2026-09-20 — D-9) | Free relays that Meta would allow. But the customer engaged **this** business on WhatsApp, so the relay is never a surprise |
| Per phone | A's message appears in a thread the customer opened for B; attribution (T5) exists for exactly this, but it is a product judgement, and the hold-back would then hold A's email on the strength of a conversation with B |

### 6.5 Attachments

**DECIDED 2026-09-20: everything in this build.** Inside the window the text goes first as a session text, then
**one WhatsApp message per attachment**: JPEG/PNG ≤ 5 MB as `SessionImage`, PDF/Word/Excel/txt ≤ 100 MB as
`SessionDocument`, MP4 ≤ 16 MB as a new `SessionVideo` kind (none exists today). A type WhatsApp does not accept (HEIC,
GIF, WebP, MOV) or a file over its limit becomes one localized line: *"…and 1 photo — open the conversation to see it."*
Meta fetches the file from a short-lived read link to the private `messageattachments` container (the invoice-PDF
pattern, `WhatsAppSettings.InvoiceDocumentSasExpiryMinutes`). An attachment-only message sends the media with the
sender's name as caption (caption ≤ 1024). The email note rides the **first** WhatsApp part; a later part failing sends
no email (the text arrived; the photo is in the app) — admin alert only. Outside the window attachments stay in the app.
**Attachment mechanics, end to end — identical for provider→customer and customer→provider:**

| # | Rule | Why |
|---|---|---|
| 1 | The kind of each part is decided at the producer from `MessageAttachment.MediaType` + `FileSizeBytes`, no blob call: `image/jpeg`, `image/png` ≤ 5 MB ⇒ image · `application/pdf`, Word, Excel, `text/plain` ≤ 100 MB ⇒ document · `video/mp4` ≤ 16 MB ⇒ video · everything else in `MessagingSettings.AllowedAttachmentMimeTypes` (HEIC, GIF, WebP, `video/quicktime`) or over its limit ⇒ counted into the hint line | Meta's published limits (§5); a table-driven test covers the whole allowed list |
| 2 | **One queue message per chat message**, carrying the text and the ordered parts; the processor sends them **sequentially, awaiting each** | Order is preserved: text first, then parts in upload order. Separate queue messages would race on parallel consumers |
| 3 | **Per-part idempotency**: each part is marked `{chatMessageId}:p{n}` in the existing idempotency store the moment Meta accepts it | A crash between part 1 and part 2, then a redelivery, resumes at part 2 — no double text, no double photo |
| 4 | **Each part writes its own `CarrierMessageLookup`** (its own wamid) with the same conversation and message ids; **only part 1 carries `emailHeld`** | A swipe-reply on the photo still threads (resolver L2); a `read` on any part marks the thread read as today |
| 5 | The read link is a **read-only SAS on the original blob**, minted **by the processor at send time** with `WhatsApp:ChatAttachmentSasExpiryMinutes` (new, default 60, Functions host), never placed on the queue message or in a log; the WebP derivative is never sent (WhatsApp does not accept WebP as an image) | Meta downloads once at send time and stores the media itself — the recipient never sees our URL; a short life limits exposure |
| 6 | Captions: in a text + media message the parts carry **no** caption (the text went first); in an attachment-only message part 1's caption is the sender attribution (`*Sender*`), caption ≤ 1024 | The recipient always knows who sent the photo; nothing is said twice |
| 7 | Failure semantics: the **text** part fails permanently ⇒ release the email and **skip the remaining parts** (photos without their words are noise; the whole message is in the app); a **media** part fails permanently ⇒ admin alert, continue with the next part, **no email**; a transient failure on any part ⇒ Service Bus retry resumes from that part (rule 3) | Never nothing: in-app + push already delivered; the email covers the lost text case |
| 8 | Hint line (localized ×5, wording to be approved): one ⇒ *"They also sent a photo or file. Open the conversation in Clinket to see it."* · many ⇒ *"They also sent {0} photos or files. Open the conversation in Clinket to see them."* — appended to the text part, or sent alone with the attribution when there is no text | No technical word (§0.20); two keys because backend localization is `string.Format`, not ICU plurals |
| 9 | Outside the window: nothing but the notice; the attachments stay in the app | A template cannot carry them |
| 10 | Inbound media from WhatsApp: unchanged, already ingested with derivatives (`WhatsAppInboundProcessorFunction.cs:1252`) | — |

The options table below is kept as the record of what was weighed.

| Option | Lose |
|---|---|
| Text only, as today; a text+attachment message relays the text plus one localized hint line (first recommendation — **withdrawn**, the owner chose full media) | The picture is not on WhatsApp. Attachment-only messages are not relayed and keep today's email |
| Relay media in-window as `SessionImage` / `SessionDocument` (both kinds exist for voice documents, `WhatsAppNotificationMessage.cs`) via a read-SAS URL Meta fetches | Needs a SAS with a long enough life, Meta's limits (5 MB image, 100 MB document, 16 MB video — and **no `SessionVideo` kind exists**), one WhatsApp message per attachment, and a decision on whether derivatives (WebP) or originals are sent. **DECIDED: this build** — every point is settled in the mechanics table above |

### 6.6 The window-closed template

Two exist and are wired: `clinket_new_message_customer` and `clinket_new_message_provider`, configured with five approved
languages in both hosts (T6, T8; `clinqetfuncations/Clinqet.Communications/appsettings.json:810-817`). The 2026-09-01
sweep recorded that *"a live Meta audit verified every claim APPROVED"* (`Data/whatsapp/README.md` §4c) but records
**no category per locale** for these two names, and `Verify-WhatsAppTemplates.ps1` derives its name list from
`WhatsAppTemplateNames.cs` — which holds `_provider` but **not** `_customer` (`clinqetshared/Constants/WhatsAppTemplateNames.cs:39`;
`Data/whatsapp/Verify-WhatsAppTemplates.ps1:120-124`).

| Option | Lose |
|---|---|
| **Keep (RECOMMENDED)** — already debounced, 25 s read-cancel, utility-priced where utility, CapExempt on the customer side | A paid message per closed-window burst; if a locale variant was classed MARKETING it is marketing-billed and mutable by marketing opt-out — **verify per locale** |
| Stop | Saves the fee; the customer who is off WhatsApp for a day learns of the reply only by email + push |

### 6.7 ‼️ Outside the window — a WhatsApp template INSTEAD of the email? (owner's question, 2026-09-20)

**What exists today** (T6, T8): when the window is closed, the router already sends `clinket_new_message_customer`
(and the notifier `clinket_new_message_provider`) — consent-gated, debounced to once per silence period, held 25 s and
cancelled if the person read in-app — **and** the email still goes. So the question is not "shall we add a template",
it is "shall the email be held behind the template we already send". The repo does **not** store the live body text
of either template (skill `clinqet-whatsapp`, localization baseline 2026-07-26), only the parameter order:
`providerName` / `customerName`; the skill's s8 entry records a static "Reply" quick-reply on the customer one.

| Option | Shape | You lose |
|---|---|---|
| W1 — as today | template + email + in-app + push | the double ping outside the window stays |
| **W2 — hold the email behind the template, on the ONE message that carries it (DECIDED 2026-09-20 — same build; the live read in §7.7 answered §7.5 step 1: all 16 variants are UTILITY)** | The closed-window pre-check returns *Carry(template)* only when every gate that would otherwise silently drop the template passes **now**: opted-in, not blocked, an approved variant for the language, debounce not armed, cap (provider side). The descriptor rides the queue message exactly as in-window. In the outbound processor: **cancel-on-read skip ⇒ no email either** (they read it in-app); consent/cap/language exit ⇒ release the email at once; Meta sync failure ⇒ release; Meta accepts ⇒ record; late `failed` ⇒ claim + release within the cutoff. Messages 2…n of a burst carry no template (debounce) and keep today's email | The template says *"X sent you a message"* — the email carries a 240-char preview, so until they open the app they know less. Only the first message of a burst is single-ping. Six silent exits each need a release path and a test. Business-initiated ⇒ opted-in customers only (policy, §5). Fee: unchanged — the template is already sent today |
| W3 — template only, no email ever for opted-in people | one channel | Any silent exit leaves them with push only; "never nothing" fails. Rejected |
| W4 — put the message TEXT in a template variable | the real words outside the window | A body variable carrying arbitrary user text: Meta's variable rules (no newlines, length), quality-rating pausing when recipients block or report, and a UTILITY template whose content is unbounded is exactly what gets reclassified. Rejected |

**Why W2 does not break the owner's 2026-09-20 principle** (*"no paid template preferred over a free path"*): the
template is sent today regardless; W2 only stops the email that duplicates it. Meta cost is zero delta.

### 6.8 Accepted-but-never-delivered

Meta reports `sent` when it accepts and `delivered` when the device gets it. A phone that is off gets `sent` and then
nothing — no `failed` ever arrives, and the held-back email stays held.

| Option | Lose |
|---|---|
| **Superseded by §7.1.1 (DECIDED 2026-09-20 — D-12): the 2-hour delivery check releases the email and alerts** — this row records the option first weighed | The rare offline-for-hours case gets no email |
| A delivered-watchdog: write a `delivered` flag on the record (~5 RU per delivered status), schedule a queue message at T+X that releases the email if the flag is absent | One more moving part, one more claim, one more setting; measurable first — log `sent`-without-`delivered` and decide on evidence |

---

## 7. Recommended design, end to end

### 7.1 Provider → customer — the flow; the release table below serves BOTH directions

```
provider sends  ─▶ Message written (unchanged)
                ─▶ ProcessPostSendActionsAsync
                     1. summaries (unchanged)
                     2. router.PrepareOutboundAsync(message, conversation)
                          contact point read (already done today)
                          ⇒ Carry(sessionText)   when: key stamped ∧ text ∧ !blocked ∧ context ∧ !PerProviderMuted ∧ window open
                                                        ∧ !recipientMuted (D-8) ∧ ChatEmailHoldBackEnabled
                          ⇒ Notify(template)     when window closed  (today's path, unchanged)
                          ⇒ None
                     3. if Carry: enqueue WhatsAppNotificationMessage{ Kind=SessionText, …, HeldBackEmail = descriptor }
                                  dispatcher request built with SkipEmail = true
                        else:     dispatcher request as today
                     4. dispatcher: in-app + push (+ email only when not held)
```

Outbound processor (Functions), `SessionText` branch:

| Outcome | Action |
|---|---|
| Meta success (wamid) | write the record as today **plus the held-back email descriptor**; mark processed |
| Record write fails (`RecordAsync` false) | ‼️ **release the email immediately** — a duplicate ping is cheaper than a fallback nobody can ever claim (D-11); Medium alert as today (`:586`) |
| Sync failure, any permanent class (incl. **131047** window closed mid-flight, blocked-at-send) | **release the email immediately** through the same release service; no provider notice (the message is in the thread and in-app + push delivered); admin alert as today |
| Sync failure, `Retry` class | Service Bus retry as today; the descriptor rides the message, so the eventual outcome still releases or records |
| Final retry exhausted | release the email; DLQ + alert as today |

Status processor (Functions), `failed` for a record that carries a held-back email:

| Check | Then |
|---|---|
| `ChatEmailHoldBackEnabled` off | leave it on the record (recovers if the switch returns, else expires with the record — mirrors the text rule, T13) |
| `now − SentAt > LateEmailFallbackMaxAgeMinutes` | do not release; log; **no provider notice** (D-13); the Critical admin alert (rule R2) stays |
| Otherwise | `TryClaimHeldBackEmailAsync` (ETag replace, identity survives) → release → silence for the human, exactly like a delivered text |

**Release** = one new Functions-host service (`ChatEmailReleaseService`, name indicative), used by all **four** callers
(synchronous Meta failure, record-write failure, late `failed` status, and the delivery check of §7.1.1) so there is
exactly one decision table:

| # | Check, in this order | Read (all single-partition point reads, failure path only) | Outcome |
|---|---|---|---|
| 1 | `ChatEmailHoldBackEnabled` off | settings | stop; the note stays on the record (recovers if the switch returns, else expires) |
| 2 | `now − record.createdAt` > 6 h | the record (already in hand) | stop; no email; no provider notice (D-13); the Critical admin alert stays |
| 3 | The message | `Messages` by `(conversationId, messageId)`, decrypted by `MessageRepository` as every read is | missing ⇒ stop; `isRemoved` ⇒ stop (an admin took it down); `whatsAppOutcome == Delivered` ⇒ stop (WhatsApp confirmed the copy reached the phone — a `failed` arriving after that changes nothing); an **edited** message, if editing is ever built, is emailed as it now reads |
| 4 | Already seen | `message.isRead` | true ⇒ stop — they saw it in the app, the email would be noise (the same rule the closed-window template already applies) |
| 5 | The recipient's own conversation document | `Communications` by `({recipientPartition}_{conversationId})` — the customer's `userNumber`, or the `businessId` for a business (L99) | `isMuted` (and `mutedUntil` not passed), `isHidden`, `status` Blocked or Closed ⇒ stop. Also yields `context`, `contextId`, `broadcastData.broadcastNumber` and the sender's display name for the email |
| 6 | The recipient today | customer ⇒ `Customer` document by `userNumber` (current email, language); business member ⇒ ‼️ **`INotificationRecipientResolver.ResolveAsync`, the SAME routing the send used** (AMENDED 2026-09-21, audit A-1/A-2) | no email on file ⇒ stop; the member is not in the resolved set ⇒ stop, which covers **both** a leaver **and** somebody this thread is no longer routed to; and the resolved recipient carries their **own** `ChannelPolicy`, so a member who turned chat email off is not emailed here either |
| 7 | Claim | ETag-conditional replace: `emailHeld` cleared, `emailReleasedAt` set | lost ⇒ another worker won ⇒ stop |
| 8 | Build + enqueue | the **shared** chat-email builder extracted from `MessageService` (Direct / Broadcast, both sides — one method, two callers); `ICommunicationDispatcher.DispatchAsync` with in-app, push, SMS, WhatsApp skipped; `IdempotencyKey = chatmail:{conversationId}:{messageId}`; for a member, `MembershipChannelPolicy` is the **resolved recipient's own policy** — ‼️ **never a hardcoded "email Immediate"** (audit A-1: that emailed a member who had turned chat email off, on the one path where nothing else would have reached them) | enqueue fails after the claim ⇒ the recovery leg is lost ⇒ admin alert with `ticketConsumed: true`, exactly as the SMS path does |

Steps 1–6 read only, so a redelivered status reaches the same answer twice without consuming anything; only a "send"
decision claims. The email processor's lease (`EmailNotificationProcessorFunction.cs:103-104`) and its send-time
opt-out re-check (`:97`) then apply unchanged, so a preference flipped between hold and release is honoured for free.
The synchronous-failure caller has no record yet (no wamid): the note rides the queue message, and the same table runs
with `createdAt = now`.

#### 7.1.1 The delivery check (D-12, DECIDED 2026-09-20 — the owner's condition: "as long as an admin alert is in place")

WhatsApp can accept a message and never deliver it (phone off, no data), and no `failed` ever comes. Two small
additions close that gap without a new field, a new queue or a new function:

| # | Rule | Cost |
|---|---|---|
| 1 | ‼️ **AMENDED 2026-09-21 (§11).** A `delivered` status point-reads the record (~1 RU) and decides from **`chatRelay`** and **`emailHeld`**, which is the only way to tell a relay from a notice. `chatRelay` present ⇒ patch the message document `Message.whatsAppOutcome = Delivered`, `whatsAppOutcomeAt` (§11.2) — the sender's **delivered tick** (the owner's "make sure the two ticks are there", 2026-09-20). `emailHeld` present ⇒ clear it with an ETag-conditional patch, so the check below stops on an absent field and a later `failed` needs no message read. A `delivered` for the closed-window **notice** clears the hold and writes **no tick**: the person got a notice, not the words. Neither field ⇒ a transactional template ⇒ nothing. `read` writes nothing extra — the existing read-receipt path already marks the message read, a tick never goes backwards, and the release table already stops on `isRead` more cheaply than a patch | one ~1 RU point read per delivered WhatsApp status, plus one ~5–6 RU tick patch per delivered relay and one ~8 RU clear per delivered message that held an email |
| 2 | When the note is written, the outbound processor also **schedules a check** on the existing `whatsapp-status` queue (`SendScheduledMessageAsync`, the mechanism the 25 s notify hold already uses) at `+DeliveryTracking:WhatsAppUndeliveredCheckMinutes` (default **120**), a `WhatsAppStatusMessage` with `Kind = DeliveryCheck` — never a Meta status word | one scheduled queue message + one function run per held email |
| 3 | The check reads the record: `emailHeld` gone (already released, or cleared by a `delivered`) ⇒ nothing; still present ⇒ the §7.1 table runs, whose step 3 stops on `whatsAppOutcome == Delivered` and step 4 on `isRead` — so a delivered or read message costs the record read plus the message read and nothing else. Otherwise the email goes out once and one **admin alert** is raised (`WhatsAppFailureAlerts` family, gated, stable description so the AdminAlertProcessor's content dedupe collapses a storm) plus a metric, so the owner sees how often WhatsApp sits undelivered | one point read; on release, the table's reads |
| 4 | If WhatsApp delivers later, the person has both copies. Accepted: a second copy in the rare offline case beats silence | — |

No new Azure resource: the queue exists, the processor exists, the scheduled-send API exists. The 120-minute check
sits well inside the 6-hour cutoff, so the table's age gate passes.

**Why the reads instead of a copy on the record (owner's question, 2026-09-20).** Steps 3–6 are exactly the facts a
copy could never know. An encrypted text copy would still email a removed or edited message, still ping someone who
read it, still write to a changed address, still reach a leaver; it would need an invalidation write for each of those
on the hot path; `IMessageContentProtector` is fail-open (a bad key stores plaintext) so a copy is a plaintext risk the
read is not; and it would cost every successful send to save three reads on the rare failure. The reads win on
correctness, privacy and cost.

### 7.2 Customer → provider — DECIDED 2026-09-20: same build, the phone-match rule (supersedes "solo only" below)

The business dispatcher already hands the per-member factory each member's phone (`ResolvedRecipient.Phone`,
`BusinessCommunicationDispatcher.cs:384-436`). The member whose E.164 phone equals the business WhatsApp phone
(`MessageService.cs:260`) gets `SkipEmail = true` and their email becomes the note; every other member's request is
unchanged.

> ‼️ **AMENDED 2026-09-21 — the duplicate-phone rule, decided by the owner in the build session.**
> The email is held **only when EXACTLY ONE active member's phone equals the business WhatsApp phone.** Two or more
> matches (a shared handset, a duplicated entry), or none, ⇒ **hold nothing**: every member keeps in-app, push and
> email exactly as today. ‼️ **Never infer a person from a non-unique phone** — the same rule
> `WhatsAppInboundResolver` already follows when two candidates tie. The ambiguous case is logged at **Information**
> with the `businessId` so it can be measured. This also supersedes the trailing "gated on exactly one resolved
> active member" clause below, which was drafted for the withdrawn solo-only shape.
> Tests owed: one match holds one; two matches hold none; no match holds none. Release is a **person-level** dispatch from the note (the same `Membership` policy trick the SMS fallback
uses at `WhatsAppOutboundProcessorFunction.cs:499-530`: email Immediate, everything else Off), so the business side
needs **no** recipient re-resolution at release.

Same shape with the notifier as the pre-check, plus **F-A's fix** in the in-window branch (register the provider-side
context so the reply routes), and the hold gated on *exactly one resolved active member*. The provider's
`WhatsAppMessageAlertsEnabled` = false must also mean "do not hold the email" — it already means "no WhatsApp"
(`WhatsAppProviderNotifier.cs:71-72`), so the pre-check simply returns None.

### 7.3 The in-window message itself — name, button, footer (D-18, DECIDED 2026-09-20 with the owner's "give it a button")

Today: the sender's name only when the customer chats with 2+ businesses, never a link (`WhatsAppAttribution.cs:8-13`).
The owner asked why the circled link line was not a button. It can be: the codebase already sends a free-form
**interactive CTA-URL message** — body + optional footer + one URL button — for the "Explore services" nudge
(`WhatsAppMessageKind.InteractiveCtaUrl`, `MetaWhatsAppService.BuildCtaUrlRequest`, limits enforced at
`MetaWhatsAppService.cs:418-437`: body ≤ 1024, footer ≤ 60, button text ≤ 20). It is a service message, so it is
free inside the window and needs no template.

| Part of a burst | What is sent | Why |
|---|---|---|
| **First message** (the notifier's existing debounce rule, `WhatsAppProviderNotifier.cs:92`, mirrored on the router: no burst is open when the recipient's unread count was 0) | One interactive message: **bold sender name** as the first body line (the existing attribution, now always applied), the message text, footer *"Reply here or in Clinket."* (**NEW** `WhatsApp_Chat_Footer_ReplyHere`), button **"Open chat"** (**NEW** `WhatsApp_Chat_OpenChat_Button`, ≤ 20 chars) → the exact conversation | The tap opens the thread; the footer tells them replying on WhatsApp works — the two engagement levers that matter |
| **Later messages** in the same burst | Plain text, bold sender name as the first line, no button, no footer | A live back-and-forth must not be cluttered |
| **First message longer than 1024 characters** (Clinket allows 2000, `MessagingSettings.cs:6`) | **Two messages**: the full text as plain text with the sender name — **never truncated** — then a short interactive message whose body is the footer sentence *"Reply here or in Clinket."* with the **Open chat** button. No link line, no extra key | Meta caps a buttoned body at 1024; the words always win over the button, and the button still appears on every first message of a burst (owner, 2026-09-20: "is the link an issue?" — it was; this removes it) |
| ‼️ **The same, WITH attachments** (AMENDED 2026-09-21, audit A-5 — the owner's own example: *"more than 1024 character length message have the photo"*) | **Three or more messages, in this order: the full text · every attachment · the button message LAST.** The short case is unchanged — the button rides ON the words, so the photo still follows the message it belongs to | The button message is the invitation to reply. Sent between the words and the photo it invites a reply before showing what the reply is about; sent last it closes the burst, which is where an invitation belongs |
| **Media parts** | Never carry a button; the text part does | A caption cannot hold a button |
| **Attachment-only message** | The media with the sender's name as caption; no button | One message, nothing said twice |

**Why two messages is the right answer for a long first message (owner asked 2026-09-20):** WhatsApp itself sets the
limit — a message that carries a button may hold 1,024 characters, a plain message 4,096 — so one message with both the
full text and a button is impossible above 1,024. The three ways out are cut the words (never), drop the button and
show a link (the inconsistency the owner rejected), or send the words whole and follow with the button. The last is
what WhatsApp-channel support desks do, WhatsApp groups consecutive messages from one sender visually, and it is rare:
a chat message over 1,024 characters is the exception.

A text **header** (the sender's name rendered by WhatsApp as a header instead of a bold first line) is optional polish:
the current request record has no header (`MetaWhatsAppService.cs:724-731`), and Meta's page for this message type was
not reachable in this session (§18). The build may add it only if Meta's reference confirms a text header for
`cta_url`; the bold first line is the safe default and is what the sheet draws.

**Engagement, thought through as the owner asked:** the button removes the copy-a-link step; the footer teaches the
reply-right-here habit once per burst; the sender's name on every line keeps a shared thread legible; the F-A fix (§13
row 8) makes a provider's WhatsApp reply land with the right customer, which is the single biggest engagement enabler on
the provider side; read receipts already flow both ways. Deliberately **not** done: quick-reply chips inside a chat
(chat is free text), anything promotional in the footer, a link on every line.

### 7.4 Settings (all four hosts for parity with `DeliveryTrackingSettingsConventionTests`; read by API + Functions)

| Key | Default | Read by |
|---|---|---|
| `DeliveryTracking:ChatEmailHoldBackEnabled` | `true` | `MessageService` (API + Functions), outbound + status processors |
| `DeliveryTracking:LateEmailFallbackMaxAgeMinutes` | **360** (D-4) | status processor |
| `WhatsApp:ChatAttachmentSasExpiryMinutes` | **60** | outbound processor (Functions only — the link is minted at send time and never rides the queue). Functions `appsettings.json` + class default; not a `DeliveryTracking` key, so not part of the four-host parity test |
| `DeliveryTracking:WhatsAppUndeliveredCheckMinutes` | **120** (§7.1.1) | outbound processor (schedules the check) and status processor (runs it); ×4 hosts for parity |

Kill switch semantics: OFF ⇒ the email is sent alongside, exactly as today; judged BEFORE any claim.

### 7.5 Getting the closed-window template classed UTILITY — the playbook (owner's question, 2026-09-20)

> **Step 1 was executed on 2026-09-20 with the owner's token (read-only): every variant is APPROVED / UTILITY — see
> §7.7 for the live wording and the template plan. The wording proposals in this section are WITHDRAWN; the live
> words passed 16 times and are reused byte-for-byte. The protocol below still governs the creation of the new names.**

**What Meta's own rule says** (§5): utility templates *"follow up on user actions or requests"*; since 9 April 2025 a
template that Meta judges marketing is **approved as MARKETING rather than rejected**, and a category review can be
requested within 60 days. So the failure mode is not rejection — it is a higher price and the template becoming
mutable by marketing opt-out (error 131050 / 131049 apply to marketing, not utility).

**What this codebase has already proven, by experiment** (skill `clinqet-whatsapp`, 2026-07-31 and 2026-09-01):

| Evidence | Lesson |
|---|---|
| *"You have {{2}} new updates…"* ⇒ MARKETING, twice | A count of "updates" reads as re-engagement |
| *"Here is the summary you asked for: …"* ⇒ UTILITY (en, both WABAs) | **The first clause must state the user's own action** |
| *"As you asked on your call with {{1}}…"* ⇒ UTILITY in en/es/fr/hi; Gujarati once MARKETING from identical structure | Non-English classifiers are weaker; mirror the Hindi wording for Gujarati (`ભાવ`→`કિંમત`) |
| `allow_category_change:false` did not prevent a MARKETING verdict | It refuses a silent downgrade at submission, not a reviewer's judgement |
| Subcode 2388299 | A body may not **start or end** with a variable |
| Digest: en UTILITY, six non-en locales MARKETING, appeals filed | Expect to appeal at least one locale |

**Wording that anchors on the user's action** (proposals — the live bodies must first be exported from WhatsApp Manager,
because the repo holds no body text):

| Template | Proposed body | Why it should read as utility |
|---|---|---|
| `clinket_new_message_customer` | *"You have a reply from {{1}} in your conversation on Clinket. Open Clinket to read it and respond."* + URL button **Open conversation** → `https://www.clinket.com/messages?conversationId={{1}}` (dynamic) — or keep the existing static "Reply" quick-reply | "your conversation" and "a reply" state the user's prior action; no offer, no count, no superlative; the variable sits mid-sentence |
| `clinket_new_message_provider` | *"{{1}} has sent you a message about their request on Clinket. Open your inbox to reply."* + URL button **Open inbox** → `https://business.clinket.com/dashboard/inbox?conversationId={{1}}` | "their request" names the transaction the customer started |

**Protocol** (the one the estate already uses; scripts under `Data\whatsapp\`):

1. **Verify first**: run `Verify-WhatsAppTemplates.ps1` after adding `clinket_new_message_customer` to its name source
   (today it reads only `WhatsAppTemplateNames.cs`, which lacks that name) — it prints status and category per locale on
   both WABAs. If every locale is already APPROVED/UTILITY, **nothing needs re-wording**.
2. Any MARKETING locale: **appeal** via Template Category Updates (60-day window from the change) with the argument that
   the message answers the user's own conversation; **never delete** the production variant (30-day name lock).
3. If the appeal fails: submit the revised wording under a **proof name** (`clinket_new_message_customer_p1_<lang>`)
   with `category:"UTILITY"` and `allow_category_change:false`; poll `GET /{waba}/message_templates?name=…&fields=name,language,status,category`
   (the `name=` filter is a contains-match — project `name`); only when `APPROVED/UTILITY` edit the production variant
   in place (edit-in-place avoids the name cooldown); delete the proof; India gets `en_US/hi/gu` only, Canada adds
   `fr_CA/es`; proof names never enter `WhatsApp:Templates`.
4. Register the outcome in this plan and in `Data\whatsapp\README.md`.

**Honest odds** — not a percentage, this repo's own record: English utility templates anchored on the user's action have
passed first time every time here; Hindi mostly; Gujarati and the non-English digest locales landed MARKETING once
each and needed an appeal or a re-word. Plan for one appeal cycle.

### 7.6 Queue contract

`WhatsAppNotificationMessage` gains `HeldBackEmail { RecipientType, RecipientUserNumber, RecipientUserId }` (identity
only — no content, no address, no link) and `Parts` (the ordered attachment list: kind, blob name, media type, file
name, size — never a link). `ServiceBusMessageBase.SchemaVersion` is documented as
*"bump whenever a message's structural contract changes (field added…)"* with queues drained at deploy and no
compatibility code (`clinqetshared/DTOs/Messages/ServiceBusMessageBase.cs:13-20`). The bump to 3 and the drain are
build-session obligations (D-17); today only two processors actually read the version.

---

### 7.7 ‼️ The template plan — EXACT (decided 2026-09-20)

**Live read, 2026-09-20, `GET /{waba}/message_templates?name=clinket_new_message&fields=name,language,status,category,components`:**

| WABA | `clinket_new_message_customer` | `clinket_new_message_provider` |
|---|---|---|
| Canada `1302322178177914` | en_US · es · fr_CA · gu · hi — all APPROVED / **UTILITY** | same five — all APPROVED / **UTILITY** |
| India `2518598361929331` | en_US · gu · hi — all APPROVED / **UTILITY** | same three — all APPROVED / **UTILITY** |

Both templates share one body per locale; only the button URL differs. Every variant has a **static** URL button.

| Locale | Live body (verbatim — reuse byte-for-byte) | Button text |
|---|---|---|
| en_US | `💬 A new message has arrived in your conversation with {{1}} on Clinket. Open the conversation to read it and reply, or reply right here.` | `Open chat` |
| es | `💬 Tienes un nuevo mensaje en tu conversación con {{1}} en Clinket. Abre el chat para leerlo y responder, o responde aquí mismo.` | `Abrir chat` |
| fr_CA | `💬 Un nouveau message est arrivé dans votre conversation avec {{1}} sur Clinket. Ouvrez la conversation pour le lire et y répondre, ou répondez directement ici.` | `Ouvrir la conversation` |
| hi | `💬 Clinket पर {{1}} के साथ आपकी बातचीत में एक नया संदेश आया है। इसे पढ़ने और जवाब देने के लिए बातचीत खोलें, या आप यहीं जवाब दे सकते हैं।` | `चैट खोलें` |
| gu | `💬 Clinket પર {{1}} સાથેની તમારી વાતચીતમાં નવો સંદેશ આવ્યો છે. તેને વાંચવા અને તેનો જવાબ આપવા વાતચીત ખોલો, અથવા તમે અહીં પણ જવાબ આપી શકો છો.` | `ચેટ ખોલો` |

**Why the words stay:** they name the user's own conversation (the utility anchor), use neutral verbs, carry no
promotion, keep the variable mid-sentence, and *"or reply right here"* invites the WhatsApp reply that threads back
through the resolver. Sixteen UTILITY verdicts are the strongest evidence available. Nothing is improved by editing them.

**What is created — by the owner in WhatsApp Manager or by the estate's submit script, on both WABAs:**

| | `clinket_chat_reply_customer` | `clinket_chat_reply_provider` |
|---|---|---|
| Category | `UTILITY`, `allow_category_change: false` | same |
| Languages | Canada: en_US, es, fr_CA, gu, hi · India: en_US, gu, hi | same |
| BODY | the live body per locale above, `example.body_text = [["Sarah's Salon"]]` | same body, `example.body_text = [["Raj Patel"]]` |
| BUTTONS | one `URL` button, text per locale above, `url = https://www.clinket.com/messages?conversationId={{1}}`, `example = ["https://www.clinket.com/messages?conversationId=c1b2d3e4f5a6b7c8d9e0f1a2"]` | `url = https://business.clinket.com/dashboard/inbox?conversationId={{1}}`, same example shape |
| Meta rules met | one variable appended at the end of the URL (Meta's own example is `?promo={{1}}`); button text ≤ 25 chars (fr_CA is 22); body does not start or end with a variable | same |

**Exact create payloads — `POST https://graph.facebook.com/v25.0/{WABA_ID}/message_templates`, one call per language,
both WABAs.** Canada `1302322178177914` gets five languages, India `2518598361929331` gets `en_US`, `hi`, `gu`
(never `es`/`fr_CA` on India). Sixteen calls in total. Only `language`, the body `text` and the button `text` change
per locale (values in the table above); everything else is identical.

Customer (English shown; substitute the locale's body and button text from the table):

```json
{
  "name": "clinket_chat_reply_customer",
  "language": "en_US",
  "category": "UTILITY",
  "allow_category_change": false,
  "components": [
    {
      "type": "BODY",
      "text": "💬 A new message has arrived in your conversation with {{1}} on Clinket. Open the conversation to read it and reply, or reply right here.",
      "example": { "body_text": [["Sarah's Salon"]] }
    },
    {
      "type": "BUTTONS",
      "buttons": [
        {
          "type": "URL",
          "text": "Open chat",
          "url": "https://www.clinket.com/messages?conversationId={{1}}",
          "example": ["https://www.clinket.com/messages?conversationId=c1b2d3e4f5a6b7c8d9e0f1a2"]
        }
      ]
    }
  ]
}
```

Provider (differences only: the name, the body sample, the button URL and its example):

```json
{
  "name": "clinket_chat_reply_provider",
  "language": "en_US",
  "category": "UTILITY",
  "allow_category_change": false,
  "components": [
    {
      "type": "BODY",
      "text": "💬 A new message has arrived in your conversation with {{1}} on Clinket. Open the conversation to read it and reply, or reply right here.",
      "example": { "body_text": [["Raj Patel"]] }
    },
    {
      "type": "BUTTONS",
      "buttons": [
        {
          "type": "URL",
          "text": "Open chat",
          "url": "https://business.clinket.com/dashboard/inbox?conversationId={{1}}",
          "example": ["https://business.clinket.com/dashboard/inbox?conversationId=c1b2d3e4f5a6b7c8d9e0f1a2"]
        }
      ]
    }
  ]
}
```

In WhatsApp Manager the same thing is: Category **Utility** · Name as above · Language per row · Body = the locale's
text with the sample `Sarah's Salon` / `Raj Patel` for `{{1}}` · Button type **Visit website** · URL type **Dynamic** ·
base URL `https://www.clinket.com/messages?conversationId=` (or `https://business.clinket.com/dashboard/inbox?conversationId=`)
· sample `c1b2d3e4f5a6b7c8d9e0f1a2` · button text per the table.

**CREATED 2026-09-20 on the owner's approval — all 16 variants accepted as `PENDING` / `UTILITY` at creation, then
read back and compared to the live approved originals with ordinal (code-point) equality: 16 body matches, 16 button
matches, 16 correct dynamic URLs, 0 mismatches.** Meta ids:

| WABA | Template | en_US | es | fr_CA | hi | gu |
|---|---|---|---|---|---|---|
| Canada | `clinket_chat_reply_customer` | 965375966611576 | 1084800561078940 | 1118301224362229 | 2288649031935272 | 1822887995389092 |
| Canada | `clinket_chat_reply_provider` | 1746175489968123 | 945279531431720 | 1517752503715434 | 1305214761579285 | 1926427758766445 |
| India | `clinket_chat_reply_customer` | 3993176457645198 | — | — | 2471712876697494 | 1557282925708615 |
| India | `clinket_chat_reply_provider` | 1122598043456376 | — | — | 1635251938230028 | 3771452696338373 |

**‼️ APPROVED — all 16 variants read live later on 2026-09-20 as `APPROVED / UTILITY` on both WABAs (0 exceptions).**
Nothing in config has changed yet — the old templates keep sending until the build's first work item (§13) ships the
switch together with the code that passes `conversationId`; the old two are deleted the moment that switch is deployed.
Deleting them earlier, or switching config without the code, would make every closed-window notice fail at Meta.

> ‼️ **OWNER RULING 2026-09-20 — treat all 16 as APPROVED / UTILITY for planning and building.** The build session
> reads the live status once before the config switch (step 2 below) and proceeds on `APPROVED`; a locale still
> `PENDING` waits, a locale judged `MARKETING` is **challenged by the owner, never re-worded and never deleted**, and
> meanwhile sends as marketing-billed. `ApprovedLanguages` lists all five languages in both hosts per the 2026-09-01
> estate rule (pre-launch, a trimmed list gets forgotten); `WhatsApp:WabaLanguages` keeps es/fr off India.

**Switch-over, in this order (build session):**
1. Templates created; poll until every locale reads `APPROVED / UTILITY` (project `name` — the filter is a contains-match). A MARKETING verdict is challenged via Template Category Updates within 60 days; the old templates keep sending meanwhile.
2. Config: `WhatsApp:Templates` (API + Functions, byte-identical) gains both new names with `BodyParams ["providerName"]` / `["customerName"]`, `ButtonUrlParamKey "conversationId"`, `ApprovedLanguages` = exactly the approved locales; `WhatsAppSettings.ConversationNotifyTemplate` + appsettings → `clinket_chat_reply_customer`; `WhatsAppTemplateNames.NewMessageProvider` → `clinket_chat_reply_provider` and a new `NewMessageCustomer` constant so `Verify-WhatsAppTemplates.ps1` finally covers the customer name; router and notifier pass `conversationId` in `TemplateData`.
3. Deploy; confirm a closed-window notice opens the exact thread on web. Mobile: both apps map the link to their inbox list (`clinqetmobilepartnerapp/src/appNavigation/linking.ts:139`, `clinqetmobileuserapp/src/appNavigation/linking.ts:76`); opening the exact thread from `?conversationId=` is a small navigation addition to include in the build.
4. Delete `clinket_new_message_customer` / `_provider` on both WABAs. A deleted template with undelivered sends goes `PENDING_DELETION` for 30 days (Meta, verified); the 30-day name lock is irrelevant because the names are not reused.

## 8. The failure matrix

| # | Scenario | Today | With this design |
|---|---|---|---|
| 1 | Window closes between the pre-check and Meta's send (131047 sync) | alert; email already sent | release the email now; no template (the next message takes the closed path); no provider notice |
| 2 | 131047 arrives **asynchronously** as `failed` | provider told "try again" (T19) | claim → release email if within 6 h; silence for the human; admin alert stays |
| 3 | Contact blocked at send time (`blockedSuppressed`) | SMS fallback (none for chat) + alert | release email; alert as today |
| 4 | STOP between hold and release | n/a | a session text is a reply and sends regardless (`:200-203`); email release re-checks **email** preferences at the processor, not WhatsApp consent |
| 5 | Meta accepts, then `failed` late (131026 / other) | text fallback none; provider told | claim + release within cutoff; past cutoff nothing to the human |
| 6 | Meta accepts, never delivers, never fails | nothing | §7.1.1: the 2-hour check releases the email once and raises a deduped admin alert; a later WhatsApp delivery means two copies — accepted |
| 6b | `delivered` arrives for a **relay** | logged | record point-read ⇒ `chatRelay` present ⇒ `Message.whatsAppOutcome = Delivered` (the tick) **and** `emailHeld` cleared if it was held; the later check finds no hold and stops on the record alone |
| 6c | `failed` arrives after `delivered` (should not happen) | — | `emailHeld` was cleared by the `delivered`, so nothing is claimable ⇒ no email, no message read; the admin alert as today |
| 6d | The check runs after a release already happened | — | `emailReleasedAt` set, `emailHeld` gone ⇒ nothing |
| 6e | `read` arrives before `delivered` (status order is not guaranteed) | — | read marks the message read as today and clears nothing; the later `Delivered` patch is stored but the tick shows the highest state — read — and never regresses |
| 6f | ‼️ `delivered` for the closed-window **notice** | logged | ‼️ **AMENDED 2026-09-21 (§11):** `chatRelay` is absent ⇒ **no tick** (the notice reached them, not the words), and `emailHeld` is cleared ⇒ the 2-hour check correctly does **nothing**. Before the amendment the check would have released the email for a notice that had in fact arrived |
| 6g | `delivered` for a relay to a recipient with **no email on file** | — | `emailHeld` was never written; `chatRelay` still ticks the message. This is the case that ruled out a two-valued `emailHeld` |
| 6h | `delivered` for an ordinary transactional template | logged | the record carries neither `chatRelay` nor `emailHeld` ⇒ nothing is written |
| 7 | WhatsApp fails AND the released email fails to enqueue | — | the release returns false ⇒ the existing chat failure notice path (F-C corrected) + admin alert; in-app + push stand |
| 8 | WhatsApp fails AND the email bounces later | — | the parent programme's bounce path (address marked, provider told) — unchanged |
| 9 | Duplicate `failed` status / redelivery | ETag claim, one winner | same claim; the email lease dedupes a second release (`chatmail:` key) |
| 10 | Sync timeout after Meta accepted (unknown outcome) → retry → possible double WhatsApp | pre-existing, accepted (skill s18) | the email is released at most once (lease); a duplicate WhatsApp is unchanged |
| 11 | Record write fails after a successful send | Medium alert; late recovery lost | email released immediately (D-11) |
| 12 | Customer replies on WhatsApp | threads (T16) | unchanged |
| 13 | Provider replies on WhatsApp to an in-window relay for a second conversation | **F-A** — may land in the wrong thread or as a customer inbound | fixed in this build by registering the provider-side context (§13 row 8) |
| 14 | Recipient muted the conversation in-app | email/push skipped, WhatsApp still sent (F-B) | D-8: recommended — mute means no relay either |
| 15 | Recipient has no email | `skipEmail` already true | nothing to hold; WhatsApp as today |
| 16 | Attachment-only message | no relay; email as today | unchanged (§6.5) |
| 17 | Text + attachment | text relayed; email carries the preview only anyway | text + attachment hint; email held |
| 18 | Broadcast / Quote-context conversation | same paths; `BroadcastMessage` email (no preview) | descriptor carries `context` + `broadcastNumber`; release rebuilds that template |
| 19 | Ghost customer (no account, WhatsApp-only) | no email exists | unchanged |
| 20 | Provider phone is a landline / not on WhatsApp | 131026 → threshold block after 3 (`appsettings.json:626-629`) | unchanged; the email is released on each failure |
| 21 | India stamp | SMS is OTP-only (DR-1) ⇒ no text fallback ever | the held-back email is the **only** fallback there — the cutoff matters most in India |
| 22 | Free-entry 72 h window | opened at inbound (T17) | unchanged |
| 23 | Kill switch flipped OFF while records hold emails | n/a | held emails stay on the record until the switch returns or the record expires (7 d) — the same rule as the text (T13) |
| 24 | Queue drained at deploy with `HeldBackEmail` in flight | n/a | L35: queues are drained before deploy; a lost in-flight message loses the WhatsApp **and** the email — the drain must confirm `whatsapp-outbound` is empty |
| 25 | Message removed by an admin before the release | n/a | §7.1 step 3: no email |
| 26 | Message edited before the release (no edit exists today) | n/a | §7.1 step 3: the current text is emailed; nothing stale is stored anywhere |
| 27 | Recipient read the thread in-app before the release | email sent anyway today | §7.1 step 4: no email |
| 28 | Recipient muted, hid, blocked or closed the thread after the send | email sent anyway today | §7.1 step 5: no email |
| 29 | Customer changed their email address in the window | n/a | §7.1 step 6: the current address is used |
| 30 | Team member whose email was held left the business in the window | n/a | §7.1 step 6: not Active ⇒ no email |
| 31 | Claim won, then the email enqueue fails | — | §7.1 step 8: admin alert "recovery leg lost", `ticketConsumed: true`; in-app + push already delivered |
| 32 | Two workers release the same failure at once | — | steps 1–6 are read-only; the ETag claim admits one; the email lease dedupes any second enqueue |

---

## 9. Attachments, read receipts, threading, edits, deletes — every case

| Case | Answer | Basis |
|---|---|---|
| Image / document / video attachment outbound | Sent in this build per §6.5: image / document / video kinds within Meta's limits, hint line for anything else, one part per attachment, per-part idempotency | today's no-op: `WhatsAppChannelRouter.cs:61-62` |
| Inbound WhatsApp media from the other side | Already ingested with derivatives | `WhatsAppInboundProcessorFunction.cs:1252` (`_mediaIngestor`) |
| Read receipt, recipient reads on WhatsApp | thread marked read in-app; sender sees the tick; provider side clears the team's unread | T15 |
| Read receipt, recipient reads in-app | `ConversationRead` in-app only; WhatsApp shows nothing (Meta has no "read by business" signal to surface) | — |
| Threading on the customer's phone | one Clinket thread interleaving every business; attribution + resolver disambiguation (list) | T5, T16 |
| Threading on the provider's phone | one Clinket thread interleaving every customer; **F-A** | T9 |
| Edits | **No edit exists** (T20). If one is ever built, the WhatsApp copy cannot be edited — Meta has no edit API. **Cannot be answered until an edit feature exists; recorded, not designed** | T20, §5 |
| Delete by user | **No user delete exists**; per-side hide does not affect the other party or WhatsApp | T20 |
| Admin removal (`isRemoved`) | The in-app body is suppressed on read; **the WhatsApp copy cannot be recalled** (no delete API). A follow-up "this message was removed" WhatsApp line is possible in-window only. **Owner decision** | T20, §5 |
| Group conversations | None exist on the platform; a business is one WhatsApp recipient (its phone) | T7 |
| Reply-to (`replyToMessageId`) | Relayed as plain text; WhatsApp quote-reply on outbound would need the original wamid — **not designed**, recorded | `MessageService.cs:117` |
| System / bid messages | Never relayed (router requires the fan-out's message content; bid and system types are not user chat) | `MessageController.cs:196` rejects System/Bid on POST |

---

## 10. Cost and RU — per message, both directions

Basis: point read ≈ 1 RU per KB; a ~1 KB create ≈ 5–6 RU (the parent measured ~5 RU for 0.6 KB); an ETag replace ≈
read + write. **Reasoned from the access shape, not measured on a stamp.** Azure unit prices are not quoted.

### 10.1 Provider → customer, window open

| Step | Today | With hold-back |
|---|---|---|
| Contact point read (router) | ~2–4 RU | same, earlier |
| Contact upsert (first reply since last inbound only) | ~10–15 RU | same |
| Email: 1 queue op + 1 function exec + **1 ACS email** + 1 record write (~5 RU) | yes | **only on failure** |
| WhatsApp queue message | ~1 KB | ~1.6 KB (+descriptor) |
| Outbound exec: idempotency read+write (~6 RU), Meta call, record write | ~5–6 RU record | ~8–9 RU record (+0.5 KB) |
| Statuses: up to 4 × (webhook exec + queue op + status exec); `read` ⇒ 1 RU + internal API call | yes | same |
| `delivered` (§7.1.1) | logged only | **+1 point read (~1 RU)** always, **+1 ETag replace (~8–10 RU)** only when a hold is cleared, **+1 conditional patch (~5 RU)** only when the tick is first written. A multi-part message pays the read per part; the tick patch is first-writer-wins so parts 2…n cost a 412 and nothing else |
| Scheduled delivery check (§7.1.1) | — | **+1 scheduled queue op per HELD message**, and at +120 min **+1 point read** that stops there in the common case |
| On failure only | — | claim (~8–10 RU) + the email path above |
| Meta fee | **0** | **0** |

**Net per successful in-window message: minus one ACS email, one function execution, one queue operation and ~5 RU;
plus ~3 RU.** The saving in money is small; the point is the second ping.

### 10.2 Provider → customer, window closed — unchanged

One utility template (fee per §5, amount unverified), the 25 s scheduled hold (1 queue op), one conversation read
(~2 RU) for the cancel-on-read, and the email + in-app + push as today.

### 10.3 Customer → provider

Identical shape per message to 10.1 for the WhatsApp leg; the email/in-app/push leg is **× N members** (bounded by
`MaxRecipientsPerEvent` 100). The hold saves exactly one email per in-window message — the phone-matching member's —
and adds one conditional contact write for F-A (no-op when the context is already current). Every other member's
email is unchanged.

‼️ **The business side also adds ONE indexed SQL query per relayed message** (`TryResolveSoleMemberByPhoneAsync`:
`BusinessMemberships` ⋈ `Users` ⋈ `Businesses`, filtered on `BusinessId` + `Status` + the indexed `PhoneSearchKey`).
It is **not** a new kind of cost on this path — the notifier already reads the primary owner and their alert
preference from SQL on every message — and it is deliberately **not cached**: a cache would have to be invalidated on
every membership, phone and status change, and the query answers in one seek. **On release** the business side spends
one more SQL graph load (`INotificationRecipientResolver`), on the rare path only, so the release honours exactly the
routing and the member preferences the send honoured.

### 10.4 Scenarios (assumptions, not data — the platform is pre-launch)

| Chat messages / day | In-window share | Emails not sent / day | Extra RU / day (record growth) | Failure releases / day at 1 % |
|---|---|---|---|---|
| 1,000 | 30 % | 300 | ~900 | 3 |
| 10,000 | 30 % | 3,000 | ~9,000 | 30 |
| 100,000 | 30 % | 30,000 | ~90,000 | 300 |

At every scale the RU delta is noise against the existing ~4 status callbacks per WhatsApp send (T14), which is the
dominant cost of relaying chat at all and is unchanged by this design.

---

## 11. ‼️ §0.7 SCHEMA ASKS — APPROVED BY THE OWNER 2026-09-20 (both asks: §11 and §11.2)

No new container, partition key, index, SQL column or Search field. **One** Cosmos change: new optional fields on the
existing `CarrierMessageLookup` document family in `SystemData`.

> **Status 2026-09-20:** APPROVED. The owner approved the fields in conversation ("I like both fields"), then confirmed
> the whole design as approved at the end of the day. Built as exactly two fields.

> ‼️ **AMENDED 2026-09-21 — a THIRD record field, `chatRelay`, approved by the owner in the build session.**
> The build found that a Meta `delivered` webhook cannot tell a full-text **relay** from a closed-window **notice**:
> both carry `conversationId`, `messageId` and (under W2) `emailHeld`. Left unresolved, the delivered tick would turn
> double-grey for a burst where only a nudge reached the phone (§8 row 6f forbids it) and the 2-hour check would
> release the email for a notice that WAS delivered (D-20 says the notice replaces that email).
> **A two-valued `emailHeld` was proposed and REJECTED by the owner, correctly: a relay to a recipient with no email
> on file holds nothing, so it would never earn the tick — the KIND of send is a fact about every chat WhatsApp,
> independent of the hold.**
>
> | Field | Rule |
> |---|---|
> | **`chatRelay`** (`bool`, `NullValueHandling.Ignore`) | Written `true` on every part that carried the WORDS — `SessionText`, `InteractiveCtaUrl`, and each media part. **Never on a template**, so a closed-window notice and every transactional send leave it absent |
>
> **On a `delivered` status** the processor point-reads the record (~1 RU) and then: `emailHeld` present ⇒ clear it with
> an ETag-conditional patch (the phone got the words or the notice, so the email is no longer owed); `chatRelay` present
> ⇒ also patch `Message.whatsAppOutcome = Delivered` for the tick. **Neither field ⇒ a transactional template ⇒ nothing
> is written.** The 2-hour check then stops on an **absent `emailHeld`**, and a `failed` arriving after a `delivered`
> (row 6c) stops without reading the message at all.
> ‼️ **`read` does NOT clear `emailHeld`** — the release table already stops at step 4 on `message.isRead` for ~2 RU, so
> an ~8 RU patch on every read to save that would be a net cost.
> Tests owed: a relay to a recipient with **no email on file** still ticks; a delivered **notice** never ticks and never
> releases the email; a record with neither field is untouched.
>
> **Total approved schema for this programme: five optional fields** — `emailHeld`, `emailReleasedAt`, `chatRelay` on
> `CarrierMessageLookup`, and `whatsAppOutcome`, `whatsAppOutcomeAt` on `Message`. Nothing else.

**Which document.** The Cosmos document of type `CarrierMessageLookup` in the existing `SystemData` container, id
`carriermsg_WhatsApp:{wamid}`, pk `WhatsApp:{wamid}` — the one record the platform already writes for every WhatsApp
send, that already carries who the message was for and the held-back **text** (`fb*` fields,
`CarrierMessageLookupStore.cs:275-287`). Nothing new is created; three optional fields join it.

```json
// after an in-window chat send whose email was held (only the new fields shown)
{ "id": "carriermsg_WhatsApp:wamid.HBgL…", "pk": "WhatsApp:wamid.HBgL…", "type": "CarrierMessageLookup",
  "conversationId": "c1b2d3e4f5a6b7c8d9e0f1a2", "messageId": "9f8e7d6c5b4a39281706f5e4d3c2b1a0",
  "userNumber": "K7Q2M", "userId": "3f2a…-guid", "businessId": null, "recipientType": "Customer",
  "emailHeld": true, "createdAt": "2026-09-20T13:58:02Z", "ttl": 604800 }

// after the one release that won the claim
{ …same identity…, "emailReleasedAt": "2026-09-20T14:03:11Z", "createdAt": "2026-09-20T13:58:02Z", "ttl": 604800 }
```

| Column | Answer |
|---|---|
| **What** | On `CarrierMessageLookup` (`LookupDoc`, `CarrierMessageLookupStore.cs:253`): **`emailHeld`** (`true` while an email is held; cleared by the claim) and **`emailReleasedAt`** (set by the claim). Both `NullValueHandling.Ignore`. ‼️ **APPROVED 2026-09-20 as five fields; built as TWO** — `hbEmail`, `hbContext`, `hbContextId`, `hbBroadcastNumber` were dropped because the release reads them live from the recipient's conversation document and the recipient's profile (§7.1 table, steps 5–6): a copied address or context is a copy that can go stale inside the 6-hour window. **No message text, plain or encrypted.** Who it was for **already exists on the record** and is populated for chat sends: `conversationId`, `messageId`, `userNumber` (customer, or the business), `userId` (the matched member on the business side), `businessId`, `recipientType` (Customer ⇒ person dispatch, Provider ⇒ membership dispatch). The existing `fb*` SMS-text fields are untouched: they carry booking-text template data, never chat text, and are absent on chat sends |
| **Who reads it** | `WhatsAppStatusProcessorFunction` (late claim) and `ChatEmailReleaseService` — in this change |
| **Who writes it** | `WhatsAppOutboundProcessorFunction.RecordSentMessageAsync` on a successful send that carried a `HeldBackEmail` — in this change |
| **Why not a column** | Per-message runtime data on the record that already exists for exactly this purpose (T11) |
| **Why not a constant/enum** | A per-message flag and a per-message timestamp; nothing enumerable |
| **Why not already stored** | Nothing keyed by the **wamid** knows that an email is waiting. The `Message` document is keyed by `conversationId`, and the verdict carries only the wamid — reaching it without this record would be the cross-partition query §0.6 forbids. The record IS the wamid → message pointer; `emailHeld` lets it also say *an email is waiting for this one*, and `emailReleasedAt` that exactly one release took it. Where to email and which template are read live at release (§7.1 steps 5–6) |
| **Why not on the `Message` document instead** | A verdict cannot find a message by wamid without this pointer, so the pointer is needed regardless; putting the hold state on the message would be a second write into the hot chat partition on every WhatsApp send for a state only the rare failure path reads |
| **Cost** | Two tiny fields, well under 0.1 KB per in-window chat send ⇒ no measurable RU change on the write; no index (`/*` excluded, T18); expires with the 7-day record TTL. Failure path only: three or four single-partition point reads (message, recipient conversation, recipient profile or membership) plus the claim |
| **What breaks if omitted** | The late-failure release — a `failed` arriving after Meta accepted could never recover the email, and the "one ping" promise would be kept by dropping the fallback instead of holding it |

**Is it needed, is it best practice, is it a workaround?**
- **Needed:** yes. Meta's late `failed` carries only the wamid. Without a note keyed by that wamid there is no lawful way
  to find the recipient's email (the Messages container is partitioned by conversation), so the email could never be
  released and the feature would silently drop it instead.
- **Best practice:** it is the same seam and the same record the owner approved for the held-back text on 2026-09-19 —
  one record per carrier message, identity plus "what to do if this fails", claimed once by ETag, expiring by TTL.
  Applying the approved mechanism to a second channel is reuse, not invention. Reading the message at release from its
  own container keeps the source of truth single and keeps content encrypted at rest.
- **Not overkill:** two optional fields, no container, no index, no new store, no new queue. The alternative "fourth
  store" was refused by the parent plan for good reason; this is the smaller shape.
- **Not a shortcut:** the tempting shortcut was the copy — text, address and context on the record so the failure path
  needs no reads. It was rejected because every one of those can change inside the window (§7.1 steps 3–6); the
  reads are the correct answer, and they only run when WhatsApp has actually failed.

**Field names (owner, 2026-09-20: "what is hb?").** The draft prefix `hb` meant "held back" and was unreadable; the
fields are named in plain words: **`emailHeld`** — an email is waiting behind this WhatsApp message; **`emailReleasedAt`**
— when the one release took it (and `emailHeld` disappears in the same write).

### 11.1 Is the email fallback itself needed, or is "WhatsApp or nothing" enough? (owner's question, 2026-09-20)

| Option | What the person gets when WhatsApp fails | Verdict |
|---|---|---|
| No fallback — WhatsApp, in-app and push only | in-app + push. If they have no device registered or never open the app, **nothing they will notice** | Rejected: the cases where WhatsApp fails are exactly the cases where the person is hard to reach (number changed, not on WhatsApp any more, blocked us, the 24 h ran out between their message and the reply). Dropping the email there is the silent-loss anti-pattern the parent programme was built to end |
| **Email released only on failure (DECIDED)** | in-app + push, plus the email they would have received today — once, and only if it can still help | Standard practice: prefer the live channel, fall back to the durable one on failure. It is the same rule the platform already applies to texts, and it costs two flags and a rare release |

Concrete case that settles it: the customer wrote at 14:00 yesterday; the salon replies at 14:02 today. The live chat
looks open when the reply is sent and has expired by the time WhatsApp processes it (Meta answers *131047*). Without
the fallback, that reply reaches the customer by push only. With it, the email goes out within seconds, exactly as
today. This race is common, not exotic.

### 11.2 ‼️ §0.7 ASK #2 — the delivered tick and the in-thread delivery line (D-13) — APPROVED 2026-09-20, including the per-delivered write

**The problem.** Today a failed WhatsApp copy of a chat message tells the provider *"A message did not arrive … please
try again"* (`DeliveryFailureFeedbackService.cs:190-197`, `en.json:1341-1342`). For chat that is wrong advice: the
message is in the conversation and reached the other side in-app and by push. Slack, WhatsApp itself, iMessage and
every support desk answer this the same way: **the delivery outcome is shown under the message, where the sender is
looking** — no separate notification, no "try again".

| Column | Answer |
|---|---|
| **What** | `Message` (Cosmos `Messages`, pk `/conversationId`, `clinqetcore/Entities/COSMOS/Cosmos.cs:2992`): **`whatsAppOutcome`** (string enum: `Delivered` · `EmailSent` · `InAppOnly`) and **`whatsAppOutcomeAt`** (UTC). Both `NullValueHandling.Ignore`. `Delivered` is written when WhatsApp confirms an in-window relay reached the phone (**the delivered tick the owner asked for on 2026-09-20**); `EmailSent` / `InAppOnly` when a relay failed. Never written for a closed-window notice, never for a message that did not travel on WhatsApp |
| **Who reads it** | `MessageService.MapToDtoWithReadableUrls` → `MessageResponseDto` → the four thread screens (provider web + phone, customer web + phone): the fifth tick state **delivered** (double grey, between the existing sent and read) and one muted line under the sender's own message on failure — in this change. The delivery check (§7.1.1) reads it to stop |
| **Who writes it** | `WhatsAppStatusProcessorFunction` on `delivered` (`Delivered`), and `ChatEmailReleaseService` after its decision (`EmailSent` when the email went, `InAppOnly` when the table stopped for a reason other than "already read", e.g. muted, blocked, no address, past cutoff). A conditional patch that never downgrades: `Delivered` is not written over an outcome already present, and the UI shows read above everything — in this change |
| **Why not a column** | Cosmos document; a per-message fact belongs on the message |
| **Why not a constant/enum** | The value set IS an enum; the per-message value is runtime data |
| **Why not already stored** | `Message` carries `isRead/readAt`, `isEdited`, `isRemoved` (`:3037-3057`) — nothing about a relay outcome. The `CarrierMessageLookup` knows it but is keyed by wamid; a thread renders by conversation and cannot reach it |
| **Why not on the lookup record** | It expires in 7 days and is unreadable from the thread; the line must survive as long as the message |
| **Cost** | One ~5–6 RU patch on the message's own partition **per delivered in-window relay** (the delivered tick) and one per failed relay (rare); nothing for closed-window notices or non-WhatsApp messages; two optional fields; no index. The owner asked for the tick and confirmed the per-delivered write with it on 2026-09-20 ("everything is approved") |
| **What breaks if omitted** | The sender is either told something false ("try again") or told nothing while their WhatsApp copy silently failed; and they never see that a copy reached the phone |

**Copy (sender's view, ×5 languages, web keys + generated phone-app twins):**
`inbox.waRelay.emailSent` / `messages.waRelay.emailSent` — *"Couldn't reach {name} on WhatsApp — sent by email instead."*
`inbox.waRelay.inAppOnly` / `messages.waRelay.inAppOnly` — *"Couldn't reach {name} on WhatsApp — they'll see it here in Clinket."*
`inbox.statusDelivered` / `messages.statusDelivered` — *"Delivered on WhatsApp"* (the screen-reader label of the new tick,
beside the existing `inbox.statusSent` / `inbox.statusRead` / `inbox.statusFailed` and their `messages.*` twins).

**The tick rule** (all four thread screens; today's states are `sending`, `failed`, `sent`, `read` —
`clinqetwebpartnerapp/src/app/dashboard/inbox/page.jsx:566-598`, `clinqetwebuserapp/app/(customer)/messages/page.js:440-470`,
`clinqetmobileuserapp/src/screen/messaging/ChatScreen.tsx:99-111`): **`sent` ⇒ single grey tick (as today) · `delivered`
⇒ double grey tick (NEW, `whatsAppOutcome == Delivered` and not read) · `read` ⇒ double green tick (as today, wins over
everything).** Colours are the apps' own: `#919191` grey, `#34C759` / `#97EF29` read, `#C63535` failed.

**Why this is the standard (owner asked 2026-09-20):** every mainstream messenger tells the sender sent → delivered →
read on the message itself — WhatsApp (one tick, two grey ticks, two blue ticks), iMessage ("Delivered", "Read"),
Telegram, Messenger — and none of them raises a separate notification for it. Our apps already use one grey tick and
two green ticks; two grey ticks for delivered is the same vocabulary users already know, with nothing new to learn.
Every one of those messengers stores delivery state per message, which is the one small write this costs.

‼️ **When it appears (recorded 2026-09-21, audit):** on the next load of the thread, not live. The real-time
`MessagePayload` the sender's own client receives is serialised at SEND time, when the outcome is by definition not
yet known, and a `delivered` arriving seconds later raises **no** SignalR push — one per delivered WhatsApp would be a
notification per message for a tick. A sender watching their own open thread therefore sees `sent` until they reload
or reopen it. Deliberate, and the same trade every messenger that batches delivery receipts makes.

The line: muted grey (`#5F6672` web, the theme's muted text on the phones — the tone of the existing "Sent" tick),
under the bubble, never red, no icon: it is information, not an error. Copy and colour reviewed 2026-09-20 at the
owner's request: plain words, no technical term, the same em dash the apps' existing WhatsApp copy uses. Drawn as
frames 5h, 5i and the tick legend 5j of the approved sheet. With this in place the chat-relay verdict raises **no**
`MessageDeliveryFailed` notice at all; the admin alert stays.
- **Not a workaround:** nothing is bypassed — the released email goes through the same dispatcher, the same preference
  re-check and the same delivery lease as every email today.

Also for the record, though not store schema: `WhatsAppNotificationMessage.HeldBackEmail` (queue DTO) and the two
settings in §7.4 (appsettings ×4 hosts, class defaults mirrored). No `local.settings.json` key, no ARM, no `deploy.ps1`.

---

## 12. Test strategy (placement follows the runtime consumer, §0.18)

| Suite | What it must prove |
|---|---|
| `Clinqet.API.UnitTests/WhatsApp/WhatsAppChannelRouterTests` (exists) | the pre-check returns Carry only under every gate in §7.1; returns None when muted (D-8) or the switch is off |
| `Clinqet.API.UnitTests/Services/MessageServiceTests` (exists) | Carry ⇒ dispatcher receives `SkipEmail = true` and the queue message carries the descriptor; None ⇒ byte-identical to today; both hosts' DI build the graph |
| `Clinqet.Communications.UnitTests/Functions/WhatsAppOutboundProcessorTests` (exists) | success writes the descriptor; each sync-failure class releases exactly once; record-write failure releases; the descriptor never reaches Meta |
| `Clinqet.Communications.UnitTests/Functions/WhatsAppStatusProcessorTests` (exists) | switch and cutoff judged before the claim; past cutoff ⇒ no release and no human notice; claim ⇒ release ⇒ silence |
| NEW `ChatEmailReleaseServiceTests` (Functions) | descriptor → the exact `CommunicationRequest` shape for Direct and Broadcast, both sides; deterministic idempotency key |
| **Integration (mandatory — Cosmos schema + Service Bus processor, §0.8)** `Clinqet.Communications.IntegrationTests` | the descriptor round-trips verbatim (dictionary trap); 10-way concurrent claim ⇒ one winner and identity survives; the email lease dedupes a double release against the real emulator; F-A: a second-conversation provider reply routes to the right customer |
| Convention | `DeliveryTrackingSettingsConventionTests` picks up the two new keys ×4 hosts; `SignalRWhitelistCompletenessTests` unaffected (no new `NotificationType`) |
| UI | the mobile deep link to the exact thread in both apps: `tsc` clean, 0 ESLint errors, linking test; no new screen unless D-15 says otherwise |

---

## 13. The build — ONE build, no phase 2 (owner, 2026-09-20: pre-prod, "do it fully correct")

Order inside the build; every step lands with its tests before the next starts. **The owner's go was given on
2026-09-20**, with both §0.7 asks approved (§11: `emailHeld` / `emailReleasedAt`; §11.2: `whatsAppOutcome` /
`whatsAppOutcomeAt`).

‼️ **Owner, 2026-09-20: row 9 (the template switch-over) runs FIRST.** Config + constants + `conversationId` on the
router and notifier + tests ship together; the owner deploys; the old templates are then deleted on both WABAs after a
live read confirms the new ones are the ones being sent. Never delete before the deploy, never switch config without
the code — either alone breaks every closed-window notice. **The owner agreed to this order on 2026-09-20.**

‼️ **No backfill, no migration, no compatibility — owner's ruling 2026-09-20.** Everything is sandbox; nobody depends
on today's shape. Old template names disappear from code and config in the same change; the two record fields and the
two message fields are simply written from now on; a document that predates them reads as "nothing held / nothing to
show". No data is moved, copied or repaired, anywhere.

| # | Work |
|---|---|
| 1 | Settings ×4 hosts + class defaults + convention test: `ChatEmailHoldBackEnabled` (true), `LateEmailFallbackMaxAgeMinutes` (360) |
| 2 | Queue DTO: `HeldBackEmail` descriptor on `WhatsAppNotificationMessage`; `SchemaVersion` bump + drain at deploy (D-17, owner to confirm) |
| 3 | Store: `emailHeld` + `emailReleasedAt` on `CarrierMessageLookup` (§11) — nothing else, no message text; `TryClaimHeldBackEmailAsync` (ETag replace, identity survives) |
| 4 | `MessageService`: WhatsApp pre-check BEFORE the dispatcher for both directions; customer side holds the customer's email; business side holds only the phone-matching member's email (§7.2); in-window text + attachments (§6.5); closed-window notice with the hold on the carrying message (§6.7 W2) |
| 5 | Outbound processor: `SessionVideo` kind; media parts with read-SAS links; record the note on the first part; release on every synchronous exit (131047, blocked, no template, cap, final retry) and on record-write failure |
| 6 | Status processor: switch and 6-hour cutoff judged before the claim; claim; release; chat-specific human outcome (D-13, owner to confirm) |
| 7 | `ChatEmailReleaseService` (Functions host): the eight-step decision table of §7.1 — message, recipient conversation, recipient profile or Active membership, then claim, then the **shared** chat-email builder extracted from `MessageService` (Direct / Broadcast, both sides — one method, two callers), email-only channel flags, `chatmail:{conversationId}:{messageId}` idempotency, lost-leg alert on a failed enqueue after the claim |
| 8 | F-A: the in-window provider branch registers the provider-side context (`RegisterProviderRecipientContextAsync`, no-op when current) |
| 9 → **FIRST** | Templates per §7.7 (already created and APPROVED): config switch in both hosts + `WhatsAppSettings.ConversationNotifyTemplate` default + `WhatsAppTemplateNames` (`NewMessageProvider` → new name, new `NewMessageCustomer` constant), router/notifier pass `conversationId`, mobile deep link to the exact thread (both apps, incl. signed-out continue-to and the "no longer available" note), tests; owner deploys; **then** delete the old two on both WABAs after a live read |
| 10 | Tests: unit in the runtime consumer's suite (§12); **integration against the real emulator** for the claim race, the verbatim descriptor, the email-lease dedupe, the F-A route |
| 10b | The in-window first message as an interactive CTA-URL message (bold name, text, footer, "Open chat"), plain text for later lines, the >1024 plain-text fallback, three new copy keys ×5 (§7.3) |
| 10c | The delivery check (§7.1.1): `delivered`/`read` clears `emailHeld` (conditional patch); scheduled `DeliveryCheck` on the status queue; release + deduped admin alert + metric; setting ×4 |
| 10d | The delivered tick + in-thread delivery line (§11.2, approved): two fields on `Message`, a patch on `delivered` and on failure, DTO, the fifth tick state and the line on four thread screens, three copy keys ×5 web + phone twins |
| 10e | `MessagesChats` joins `WhatsAppEligibleCategories` (D-2) with a test pinning that the dispatcher still never WhatsApps a chat message; the settings chip appears through the existing metadata |
| 10f | In-app mute suppresses the relay (D-8): the router reads `recipientMuted`; business-side mute is business-wide (L107) and only for that conversation; the other party is never affected |
| 11 | Skills ×4 (`clinqet-whatsapp`, `clinqet-messaging`, `clinqet-delivery-feedback`) + memory. ‼️ **The §9.7 "Today" paragraph cannot be corrected: `C:\Nik\WHATSAPP_INTEGRATION_PLAN.md` no longer exists** (only the skills still cite it). The correction therefore lives where it CAN be read — §2 and §4 of this document, and the three skill blocks — and the stale `clinket_new_message` name in the skills was rewritten in the same pass |
| 12 | ‼️ **The multidimensional audit of §16 and the master checklist of §17.** Nothing is "done" until every row of §17 is ticked by a check that was actually run |

---

## 14. Mockup register

| Sheet | Path | Approved | Governs | Supersedes |
|---|---|---|---|---|
| **Chat messages on WhatsApp — what the customer and the provider see** | `C:\Nik\Data\mockups\whatsapp-chat-relay-states\index.html` | **APPROVED 2026-09-20, including frames 5h/5i (the in-thread delivery line)** — revised the same day at the owner's request: 1a/1g/3a a real "Open chat" button on the first message of a burst; 1h a long message as two messages (full text, then the button message); 5h/5i the apps' real tick states; 5j a tick legend with the new **delivered** state (double grey) | Every state of a chat message relayed on WhatsApp, both directions: full text within 24 h (sender named, link on the first of a burst) · photos, files, video, unsupported-file hint · photo-only caption · the approved notice with "Open chat" after 24 h · nothing when off / unavailable / already read · the released email and when it is not sent · the in-app thread banners (unchanged words) on provider web + phone and customer web + phone · the deep link landing (signed in · signed out · gone) · the "Messages & chats" settings chip · what the provider is not told · the one-table state matrix · the copy source of every string (existing key or NEW) | — (first sheet for this programme) |

The decided scope changes **no screen**: an email that is not sent has no pixel, and the mobile deep link opens an
existing screen. If any copy or state in T21/T22 changes, the sheet above is drawn and approved **before** UI code, and
a row goes here the day it is approved.

‼️ **ONE state the sheet does not draw, raised for the owner 2026-09-21 (audit A-5).** Frame 1h draws a long message
as two WhatsApp messages; the attachment frames draw a short message with its photos. Nothing draws **both at once** —
a first message over 1024 characters that ALSO carries attachments. The build sends it as **words · attachments ·
button message last**, because the button message is the invitation to reply and between the words and the photo it
invites a reply before showing what it is about. No new copy, no new key, no Clinket screen — only the order of three
WhatsApp messages that the sheet already draws individually. **CONFIRMED BY THE OWNER 2026-09-21** — *"picking reply
here or in clinket is last one that order make sense"*. The sheet is not re-drawn; this row is the record.

---

## 15. DECISIONS NEEDED — with a recommendation and what it costs

> **Historical.** This table is the list as first presented on 2026-09-20, phase wording included. **§0.1 and §15.1
> record what the owner actually decided and supersede any row here that disagrees** (there are no phases: one build).

| # | Decision | Recommendation | You lose |
|---|---|---|---|
| **D-1** | Customer→provider WhatsApp: keep? hold its email? | **Keep** (it is live and it is the business model). **Hold the email on provider→customer only in Phase 1**; solo-business provider side in Phase 2 | Team businesses never get the hold; and the policy sentence in §5 is yours to read — it applies to today's relay too |
| **D-2** | `MessagesChats` into `WhatsAppEligibleCategories`? | **Yes, for honesty**: the settings screens would then list "Messages & chats" under the WhatsApp card (T22). It changes nothing at runtime because the chat paths never hand the dispatcher a template — pin that with a test | A screen gains a chip through an existing component; you decide whether §0.7.1's mockup gate applies to a list growing by one item |
| **D-3** | The window-closed template | **Keep both existing templates**; run the verify script (after adding `_customer` to its name source) to confirm APPROVED/UTILITY per locale, both WABAs | A paid message per burst; a MARKETING-classed locale bills at marketing rate |
| **D-4** | Held-back email staleness cutoff | **360 minutes.** Under one working day so it never lands as "yesterday's" message; long enough to survive a multi-hour status-queue incident (a drained backlog then releases a batch — nothing lost). The text's 30 min is right for reminders; an email pointing at a thread decays far slower | Past 6 h a person off WhatsApp all day gets no email; 2 h would lose the fallback in an incident, 24 h risks a stale-looking email |
| **D-5** | Attachments | Text-only relay + one localized hint line in Phase 1; media in Phase 2 | Pictures stay in-app for now |
| **D-6** | Failure matrix (§8) | Approve as written | — |
| **D-7** | Cost (§10) | Accept: the money saved is small; the behaviour is the point | — |
| **D-8** | In-app mute (F-B) | Mute suppresses the WhatsApp relay too, like it does email and push, and like the provider side already does | A customer who muted in-app but chats on WhatsApp stops getting relays |
| **D-9** | Window per conversation or per phone | Per conversation (today) | Some free relays Meta would allow |
| **D-10** | Shape of the held-back email | O2 compact descriptor + re-dispatch | One SQL resolve at release on the business side (Phase 2) |
| **D-11** | Record write fails after a successful send | Release the email immediately | Occasional double ping instead of a silent loss |
| **D-12** | Accepted-but-never-delivered | Accept in Phase 1; log `sent`-without-`delivered` and revisit on evidence | The offline-phone case gets no email |
| **D-13** | Chat relay failure notice (F-C) | A failed chat relay never tells the provider to "try again"; the release is the remedy, the admin alert stays | The provider is not told a WhatsApp copy failed |
| **D-14** | F-A (provider-side context on the in-window branch) | Fix in Phase 2 with an integration test that reproduces the wrong-thread route first | It is a behaviour change on a live path — your call, not mine |
| **D-15** | Mockup | None needed for Phase 1 as recommended; draw `whatsapp-chat-relay-states` only if any copy in T21/T22 changes | — |
| **D-16** | Kill switch | `DeliveryTracking:ChatEmailHoldBackEnabled` default **true**; OFF ⇒ exactly today | — |
| **D-17** | Queue `SchemaVersion` bump for the new field | Bump to 3 and drain `whatsapp-outbound` at deploy, per L35 | A deploy step |
| **D-18** | Attribution and link copy | Always name the sender; link only on the first message of an unread burst | One localized key ×5 |
| **D-19** | Admin removal of a message already relayed | Cannot be recalled (no Meta delete API). Do nothing, or send an in-window "this message was removed" line? | — |
| **D-20** | Outside the window: hold the email behind the existing template (§6.7 W2)? | **Yes, as Phase 1b**, after step 1 of §7.5 confirms UTILITY per locale — and only on the one message that carries the template; a cancel-on-read skip sends no email either | Less information until they open the app (no preview); only the first message of a burst is single-ping; six exits to test |
| **D-21** | Re-word the two notify templates (§7.5)? | **Only if step 1 shows a MARKETING locale**; then appeal first, proof-name re-word second. Export the live bodies before judging them | One appeal cycle of calendar time |

### 15.1 Status of each decision after the 2026-09-20 session

| Decided | Answer |
|---|---|
| D-1 | Both directions; business side holds only the phone-matching member's email |
| D-3 | Keep the existing templates until the new ones are live; no re-wording — the live words are UTILITY everywhere |
| D-4 | 6 hours |
| D-5 | Attachments in full, this build |
| D-6, D-7 | Approved as written |
| D-10 | Sticky note (O2): two fields, no copies of anything a person can change; the release reads live truth (§7.1 table). Owner approved the fields 2026-09-20 |
| D-11 | Release the email at once when the record write fails |
| D-14 | F-A fixed in this build |
| D-15 | No new screen; the mobile deep link to the exact thread is a navigation addition — owner to say whether the mockup gate applies |
| D-16 | `ChatEmailHoldBackEnabled` default true |
| D-20 | Notice replaces the email outside the window, first message of a quiet period |
| D-21 | New names `clinket_chat_reply_customer` / `_provider`, same words, dynamic button |

| Decided, second round 2026-09-20 | Answer |
|---|---|
| D-2 | **APPROVED** — `MessagesChats` joins the eligible set; the settings chip appears |
| D-8 | Yes — mute means no WhatsApp relay either. **Per side and per conversation:** each participant has their own conversation document with its own mute, so a provider muting a thread affects only what that business receives for that thread; the customer is untouched, and no other thread is. On the business side mute is business-wide (L107) — one member muting mutes the team's alerts for that thread, as today for push and email |
| D-9 | Yes — customer side per conversation (the customer engaged **this** business on WhatsApp). Provider side stays "any open chat with Clinket" as today: every customer's messages arrive in the provider's one Clinket thread, so nothing is a surprise there. Edge cases: a window that closes mid-flight ⇒ matrix row 1; the 72 h free-entry window is honoured at inbound (T17); a customer who wrote to business B does not open A's relay — A's reply goes in-app, push and email as today |
| D-12 | **APPROVED** with the owner's condition met — §7.1.1: the 2-hour delivery check releases the email and raises a deduped admin alert |
| D-13 | **APPROVED 2026-09-20** — the delivery outcome shown **under the sender's message** (§11.2, frames 5h/5i approved), no separate notice, no "try again". Extended the same day at the owner's ask ("make sure the two ticks are there"): the same two fields carry `Delivered`, so the sender sees a **delivered tick** (double grey) between sent and read — one patch per delivered in-window relay, **confirmed by the owner 2026-09-20** |
| D-17 | Yes — bump `SchemaVersion` to 3 and drain `whatsapp-outbound` at deploy |
| D-18 | **APPROVED** — a real "Open chat" button plus a "Reply here or in Clinket." footer on the first message of a burst; a first message over 1024 characters becomes two messages so the button is never missing (§7.3) |
| D-19 | Yes — nothing further on admin removal |
| D-15 | Sheet **APPROVED 2026-09-20 including frames 5h/5i**; revised the same day at the owner's request (1a/1g/3a button, 1h two messages, 5h/5i real ticks, 5j legend) |
| Hint line | **APPROVED** — §6.5 rule 8 wording as drawn in frame 1e |
| Templates | Switch-over and deletion happen as the build's first item, in the order of §13 — the owner agreed to go with this recommendation; no backfill anywhere |

| Still open | What is needed |
|---|---|
| — | **Nothing. 2026-09-20: every decision, both schema asks, the mockup and the build order are approved.** A decision that surfaces during the build is new and goes to the owner (RULE ZERO) |

### 15.2 The open decisions in plain words (owner asked for this, 2026-09-20)

| # | What it is about | What I recommend, and why |
|---|---|---|
| **D-2** | The notification settings page has a WhatsApp card that lists what can arrive on WhatsApp (bookings, quotes…). Chat messages already arrive on WhatsApp but are not listed | **List it.** People should see the truth about what reaches their WhatsApp. One chip appears; nothing else changes. Standard: settings describe behaviour |
| **D-8** | If a customer mutes a conversation in the app, they stop getting push and email for it — but today they still get the WhatsApp copy | **Mute means quiet everywhere.** No WhatsApp copy while muted (a "mute for 8 hours" ends when it ends). The provider side already works this way. Standard: one mute, all channels |
| **D-9** | WhatsApp allows us to write to a customer for 24 h after *any* message they send us. Today we only relay a business's reply if the customer wrote to us about *that* business | **Keep it per conversation.** Never drop salon A's reply into a WhatsApp thread the customer only opened for plumber B. A few free messages are given up for zero surprises |
| **D-12** | WhatsApp can accept a message, then the phone is off for a day: no delivery and no failure, so the email stays held | **Accept for now, and count how often it happens.** In-app + push still went. Building a timer for a rare case before measuring it is over-engineering |
| **D-13** | Today, when a WhatsApp copy of a chat message fails late, the provider gets "your message did not arrive, please try again". Wrong advice: the message is in the conversation | **No such notice for chat.** The email release is the remedy; support is alerted. The notice stays for booking and quote texts and emails, where "try again" is right |
| **D-17** | The message we put on the internal queue gains a field. Your rule L35 says: bump the version number and empty the queue at deploy, no compatibility code | **Do exactly that.** It is your own rule and it is the clean one |
| **D-18** | On WhatsApp today the sender's name is shown only when the customer chats with two or more businesses, and there is never a link | **Always name the sender; put the "open the conversation" link only on the first message of a burst**, not on every line. Clear and not cluttered |
| **D-19** | If Clinket support removes a message after it went to WhatsApp, the WhatsApp copy cannot be recalled (WhatsApp has no such feature) | **Do nothing more.** The in-app copy is hidden; sending a "this was removed" WhatsApp would draw attention to it |

## 16. ‼️ MULTIDIMENSIONAL AUDIT — mandatory, a separate pass AFTER the suites are green

> Owner, 2026-09-20: *"check all the code before making the task complete … no bug, no issue, no loophole, no missing
> functionality … so that whoever will build never made a mistake."* This is not a test run. It is a second pass over
> the finished code, and **every dimension is answered by a check that was actually run and recorded here**, never by
> "it looked right". The parent programme's two audits found 3 and 11 defects in code whose suites were fully green.

| # | Dimension | What must be proven | How it is checked (the check, not the claim) |
|---|---|---|---|
| 1 | **Built as planned** | Every row of §0.1, §6.5, §6.7 W2, §7.1–7.3, §7.7 and §13 exists in code | Traceability table: plan row → file:line → test name. A row with no test is a gap, not a note |
| 2 | **Correctness** | Every row of the failure matrix §8 behaves as written | One test per row, named after the row; run the whole matrix table against the test list and fail on any row without a match |
| 3 | **Completeness of exits** | Every path where a WhatsApp is **not** delivered releases the email or deliberately does not, and the plan says which | Enumerate every `return` / `Complete` / `DeadLetter` in the outbound processor's send path and the status processor's `failed` path; each one is either "released", "cancel-on-read ⇒ no email by design", or "past cutoff ⇒ no email by design". Anything else is a loophole |
| 4 | **Never nothing** | No scenario leaves the recipient with less than in-app + push | Sabotage: force every release path to throw in a test; assert the in-app + push dispatch still happened before the hold decision could fail |
| 5 | **Exactly once** | No double email, no double WhatsApp from this change | Real-emulator race: ten concurrent claims ⇒ one winner; a released email re-enqueued twice ⇒ the email lease sends once; the same chat message id redelivered ⇒ the WhatsApp dedupe holds |
| 6 | **No false hold** | The email is never held when WhatsApp will not carry the message | For each gate in §7.1 (key, text, blocked, context, PerProviderMuted, window, recipientMuted, switch, opted-in, template approved, debounce, cap) flip it alone and assert `SkipEmail == false` |
| 7 | **Team rule** | Only the phone-matching member's email is held; others untouched | Fixture with three members, one phone matching the business phone; assert exactly one `SkipEmail`; repeat with no match ⇒ zero; with a solo business ⇒ one |
| 8 | **Attachments** | Every allowed type in `MessagingSettings.AllowedAttachmentMimeTypes` maps to a WhatsApp kind or to the hint line, never to nothing; both directions produce the identical part list for the identical message | Table-driven test over the whole allowed list + the size limits, run once per direction; assert the note rides part one; a failing part two sends no email |
| 8b | **Part order and exactly-once** | Parts leave in upload order after the text; a crash after part *n* and a redelivery send parts *n+1…* only | Sabotage test: throw after part 1, redeliver, assert Meta is called for parts 2… only and the text is never re-sent; assert every part has its own record and only part 1 has `emailHeld` |
| 8c | **Links** | The read SAS is minted at send time, has the configured life, appears in no queue message, no record and no log | Grep the diff for the SAS value reaching a logger or a DTO; assert the queue payload has blob names only |
| 9 | **Privacy** | No message text, email address or context copied onto the record; no message text in logs or admin alerts; no email address in a log | Read the raw record JSON on the real emulator after an in-window send: exactly `emailHeld` beyond today's fields; grep the diff for `Content`, `Preview`, `SessionText` reaching a logger or `AdminAlertMessage` |
| 10 | **Cost** | The happy path gains no read and no measurable write growth; the failure path is the record read (already made), three or four point reads, one claim, one enqueue; nothing new on the happy path of a closed window | Count every repository call per scenario in tests; assert zero extra calls on the success path; measure the record size on the emulator |
| 10b | **Release decision table** | Every row of the §7.1 table (steps 1–8) and every matrix row 25–32 has a test that produces that outcome and no other; steps 1–6 consume nothing (run twice ⇒ same answer, `emailHeld` still true) | One named test per row; a redelivery test that asserts the record is unchanged after a "stop" decision |
| 10c | **Delivery check** | `delivered`/`read` removes `emailHeld` and nothing else; the check releases exactly once and never after a release or a delivery; the admin alert dedupes; a `failed` after `delivered` sends no email | Real-emulator tests: delivered-then-check ⇒ nothing; check-then-delivered ⇒ one email; two checks ⇒ one email; conditional patch on a record without `emailHeld` ⇒ no write |
| 10d | **First-message shape** | The first message of a burst is the interactive message with button and footer; later lines plain; a body over 1024 characters is sent as the full plain text followed by the short button message, **without truncation**; media parts carry no button; the button URL is the exact thread | Table-driven test over lengths 1, 1024, 1025, 2000; assert Meta payload kinds and order; assert no `Truncate` on user text ever fires |
| 10e | **Ticks and the in-thread line** | `Delivered` written once per delivered in-window relay and never for a closed-window notice or a non-WhatsApp message; the tick order sent → delivered → read never regresses (a late `delivered` after `read` changes nothing visible; a `Delivered` patch never overwrites an existing outcome); `EmailSent` iff the email went; the line only on failure; all four thread screens render every state in the sender's view only; never red | Unit tests on the status processor and the release outcomes; UI parity test on the tick rule and the line variant; a snapshot of the message DTO per state |
| 11 | **Concurrency** | Redelivery, two verdicts for one wamid, a claim racing a TTL expiry, the switch flipping mid-flight | Real-emulator tests for each; the switch-flip test asserts the note stays on the record |
| 12 | **Time** | The 6-hour cutoff uses `SentAt` from the record, never `now − enqueue time`; clock skew cannot release early | Unit tests at 359 and 361 minutes; assert `SentAt` is the record's `createdAt` |
| 13 | **Reply routing (F-A)** | A provider's plain reply and swipe-reply about a second conversation reach the right customer | Integration test that reproduces the wrong-thread route on the OLD code first, then passes on the new |
| 14 | **Templates** | Both new templates APPROVED / UTILITY in every expected locale on both WABAs; config matches exactly; no stale name anywhere | Live `GET` on both WABAs projected on `name,language,status,category`; grep the seven repos for `clinket_new_message` after switch-over ⇒ zero hits |
| 15 | **Localization** | Every new key (`WhatsApp_Chat_Attachment_Hint`, the link line, any notice copy) exists in en/es/fr/gu/hi with identical placeholders | Count per file; diff placeholder sets |
| 16 | **Config hygiene** | Two new settings in all four hosts, class defaults identical, every setting read by something, no orphan left by the template rename | `DeliveryTrackingSettingsConventionTests`; grep each key for a reader; grep `ConversationNotifyTemplate` defaults |
| 17 | **Dead code** | The old template constants, any pre-check helper made redundant, the old `WhatsAppSmsFallback`-style duplication | Grep for zero references; build with warnings as errors on the touched projects |
| 18 | **Comments** | §0.14 — no narration, one line max, WHY only | Read every added comment aloud; delete any that restates the code |
| 19 | **Mobile parity** | Both apps open the exact thread from `?conversationId=`; `tsc` clean; 0 ESLint errors | Run both; tap-test via the linking config |
| 20 | **Clean tree** | `git status --porcelain` in every touched repo shows only deliverables | Look at it, list it here |
| 21 | **Sabotage** | Deleting the release call, the claim, or the phone-match comparison makes a test FAIL | Do each deletion on a scratch copy; record which test failed. A guard that stays green under sabotage is not a guard |

Every finding is fixed before the work is called done and recorded below with its fix, as the parent plan did in §12/§14.

### 16.1 ‼️ AUDIT FINDINGS — 2026-09-21, all FIXED, each with the check that produced it

| # | Dim | Finding | How it was found | Fix | Pinned by |
|---|---|---|---|---|---|
| **A-1** | 2, 6 | ‼️ The business-side release forced `MembershipChannelPolicy.Email = Immediate`, so a member who had turned chat email **off** was emailed by the release — on the one path where nothing else would have reached them. The SEND path has always honoured that policy (`CommunicationDispatcher.cs:98-102`, and `MessagesChats` is **not** in `MandatoryEmailCategories`), so the release answered differently from the send | Read `CommunicationDispatcher`'s membership branch against `ChatEmailReleaseService.DispatchAsync` | Step 6 now resolves the member through **`INotificationRecipientResolver`** — the same routing the send used — and passes that recipient's **own** `ChannelPolicy` | `AMemberWhoDoesNotWantChatEmail_IsNotEmailedByTheRelease(Off/Digest)` |
| **A-2** | 7 | The held member might not be a **routed recipient** for that conversation at all (no `conversation.read`, not an admin). The hold then suppressed nothing at send time, and the release would have sent them the ONLY mail anyone ever got about that thread | Traced `DispatchToBusinessAsync`'s per-recipient factory against `ResolveHeldBackEmailAsync`'s phone match | Same fix as A-1: absent from the resolved set ⇒ stop | `AMemberTheThreadIsNoLongerRoutedTo_IsNeverEmailed` |
| **A-3** | 3 | A **processing exception on the final attempt** dead-lettered the message without releasing the held email. Nothing else could ever release it either: no record was written, so no wamid, so no `failed` and no 2-hour check | Enumerated every `return` / `Complete` / `DeadLetter` in the outbound send path (audit row 3) | Release before the dead-letter, in its own try/catch so a failing release can never replace the dead-letter | `AProcessingExceptionOnTheLastAttempt_DeadLetters_AndStillReleasesTheEmail` + `AProcessingExceptionWithRetriesLeft_AbandonsAndReleasesNothing` |
| **A-4** | 3 | The **invalid-payload** dead-letter had the same hole | Same enumeration | Release before the dead-letter when a message was deserialised at all | `APartWithNoPayload_IsDeadLettered_NotSentEmpty_AndTheEmailGoesAnyway` |
| **A-5** | 10d | ‼️ The owner's own edge case — *"more than 1024 character length message have the photo"*. The standalone button message was emitted **between** the words and the photo, so the burst read "long message · reply here · photo": an invitation to reply arriving before the thing it invites a reply about | Walked the composer's part order for every combination of length × attachments | The trailing button message is appended **after** the media. The ≤1024 case is unchanged — the button rides ON the words, so the photo still follows its message | `ALongFirstMessageWithAPhoto_SendsWordsThenPhotoThenTheButton` + `AShortFirstMessageWithAPhoto_KeepsTheButtonOnTheWords` |
| **A-6** | 21 | The composer test `carries an id that had to be percent-encoded` **passed with the deep-link override neutered**: React Navigation's own `getStateFromPath` turns a query string into params on whatever route it matched, so reading `params` alone proved nothing | Sabotage: `return null` at the top of `readConversationId`, both mobile apps | The helper now asserts the route NAME as well; re-sabotaged ⇒ 3 of 7 fail in each app | `chatThreadDeepLink.test.ts` ×2 apps |
| **A-7** | 21 | ‼️ `deepLinking.test.ts` (partner) **failed** and (customer) **would have**: `linkingLeaves()` regex-scanned the WHOLE file, so the `name: 'BottomTabs'` lines inside the new `getStateFromPath` were read as routed https paths and reported as unclaimed by the association file. A scanner that mistakes its own file's other halves for its subject **invents** findings | Running the suite | Both scans are scoped to the `config` block, brace-matched, and take the block that actually opens `screens: {` — the object's TYPE annotation declares `config: { screens … }` too | the two suites, green |
| **A-8** | 14, 17 | `WhatsAppOutboundProcessorTests` still carried the literal `"clinket_new_message_provider"` in ten places — a template that is about to be **deleted** on both WABAs | `grep clinket_new_message` across every repo | Replaced with `WhatsAppTemplateNames.NewMessageProvider`; zero literal hits remain outside the historical plan text | `WhatsAppPhase0ContractTests` config parity |
| **A-9** | 15 | The footer copy had **no length pin**. Meta truncates a free-form `cta_url` footer past 60 characters silently, exactly like the button past 20 | Counted every translation against Meta's published limits | One theory now pins both, in all five languages | `TheButtonMessageCopy_FitsMetasFreeFormLimits_InEveryLanguage` |
| **A-10** | 5 | ‼️ **A pre-existing integration test proved the opposite of its claim.** `TryGet_WhenTheReadItselfFails_Throws` forced the failure with a **missing database**, which the emulator answers with the same **404** as an absent item — so `TryGetAsync` returned a clean null and the assert failed. (A wrong KEY, tried next, **hangs** the suite: the SDK retries account discovery for minutes.) | Running the integration suite | The read is made to fail in a way that is not a 404 at all, and the assertion states the guarantee directly: it threw, and not with NotFound | itself, now green |
| **A-12** | 10e | A claim that WON and then could not queue the email left the sender's bubble reading **"sent"** — the admin alert is for us, and the person who wrote the message learned nothing. `EmailSent` would be a lie and `Delivered` never applies | Walked every `ChatEmailReleaseOutcome` against what the thread renders | `EnqueueFailed` now marks `InAppOnly`, the one thing that is true: nothing carried the words and nothing was emailed | `AnEnqueueThatFailsAfterTheClaim_RaisesTheLostLegAlert` now also asserts the outcome stamp |
| **A-13** | 21 | ‼️ **Sabotage found a hole in the tests, not the code.** Deleting the exact-E.164 compare in `TryResolveSoleMemberByPhoneAsync` — the step that stops a `PhoneSearchKey` near-miss holding the WRONG person's email — broke **no test at all**: the only coverage mocked `IBusinessMemberDirectory` wholesale | §16 row 21's third sabotage | A real-SQL suite, `BusinessMemberPhoneMatchSqlTests` (13 cases), including two members whose **last ten digits are identical** across +1 and +91. EF InMemory could not prove it: with no index to seek, dropping the decide-step still answers "correctly" | the suite itself, 13/13; **re-sabotaged ⇒ 1 failed, 12 passed** — and the one that fails is `ADifferentCountrySharingTheLastTenDigits_IsNotTheSamePerson`, which exists for exactly that |
| **A-11** | 20 | Two partner-mobile suites (`editCustomerNamePrefill`, `customerPostalCodeKeyboardParity`) **failed to run at all** on a clean tree, and one user-web suite failed: leftovers of the **delivery-failure-feedback** programme (a hook added to two screens pulled `apiManager` → `i18n` → device-info into them; and one French string was written `courriel?` where the catalog's own rule is `courriel ?`) | Running the full suites before touching them | The two screens' suites mock the delivery hook they do not test; the French string takes the space. **Not this programme's defect — repaired because a red suite is a red suite** | the three suites, green |
| **A-14** | 2, 6 | ‼️ **Introduced by the A-1 fix and caught reviewing it.** With the member's real policy now in play, a member who has chat email **off** makes the dispatcher return `EmailDispatched = false` — and the code read that as "the email could not be queued", raising a **High admin alert** and claiming the recovery leg was lost. It would have paged a human every time somebody turned chat email off. ‼️ The same hole was already there on the **customer** side, where the dispatcher has always read the person's own preferences | Re-reading my own fix against `CommunicationDispatcher.cs:167-173` | `DispatchResult` already tells the two apart: `EmailFailed = emailAttempted && !emailSent`. The alert now fires on **`EmailFailed`** only; not-dispatched-and-not-failed is the new `RecipientDeclinedEmail` outcome — no alert, and the sender's bubble still says `InAppOnly`, which is true | `APreferenceThatDeclinesTheEmail_IsNotAFailure_AndPagesNobody`, and `AnEnqueueThatFailsAfterTheClaim_RaisesTheLostLegAlert` now sets `EmailFailed = true` so it tests the failure it is named for |
**§16 row 21 — the four sabotages, each run and each recorded.** Deleting the release call ⇒ **5 of 17**
relay-processor tests fail. Deleting the claim ⇒ **1 of 29** release-table tests fails
(`LosingTheClaim_SendsNothing`). Deleting the exact phone compare ⇒ **1 of 13**, and it is
`ADifferentCountrySharingTheLastTenDigits_IsNotTheSamePerson`, which exists for exactly that. Neutering the
deep-link override ⇒ **3 of 7** fail in EACH mobile app. Every sabotage was reverted by hand, never through git
(§0.19), and `grep SABOTAGE` across every repo returns nothing.

Verified-and-correct-as-built, recorded so the next reader does not re-open them: the cutoff measures from the
record's `createdAt` and `now` only for a send that never happened (row 12); `read` deliberately does not clear
`emailHeld` (an ~8 RU patch to save ~2 RU is a net loss, and the table already stops on `isRead`); a record-write
failure releases even though the WhatsApp went (D-11, a duplicate beats an unclaimable recovery); a `delivered` for
a multi-part relay costs one 412 per later part because the tick patch is first-writer-wins; and the tick appears on
the next thread load rather than live (§11.2).

## 17. ‼️ MASTER CHECKLIST — the authority on completion

| # | Item | Done when |
|---|---|---|
| 1 | Settings ×4 + defaults + convention test | test green in all four hosts' suites |
| 2 | `HeldBackEmail` on the queue DTO, `SchemaVersion` handled per D-17 | owner's D-17 answer recorded here |
| 3 | `emailHeld` + `emailReleasedAt` + claim on the record; raw JSON shows nothing else new | real-emulator round trip + 10-way race green |
| 4 | Pre-check + hold in `MessageService`, both directions, phone-match rule | audit rows 6 and 7 green |
| 5 | In-window text + attachments (image / document / video / hint line), one queue message, sequential parts, per-part idempotency, send-time SAS, both directions | audit rows 8, 8b, 8c green |
| 6 | Closed-window notice replaces the email on the carrying message; cancel-on-read ⇒ no email | matrix rows 1–2 green |
| 7 | Every synchronous exit releases; record-write failure releases | audit row 3 table complete |
| 8 | Status processor: switch + cutoff before claim; claim; release; D-13 outcome | matrix rows 2, 5, 23 green |
| 9 | `ChatEmailReleaseService` with the shared email builder; removed message builds nothing | unit + lease dedupe integration green |
| 9b | Delivery check (§7.1.1): clear on delivered, scheduled check, release once, admin alert + metric | audit row 10c green |
| 9c | First-message interactive shape + fallback (§7.3) | audit row 10d green |
| 9d | Delivered tick + in-thread delivery line (§11.2) on all four thread screens, DTO field, status-processor patch on `delivered` | audit row 10e green |
| 9e | D-2 chip, D-8 mute, D-9 rule pinned by tests | tests named after the decisions |
| 10 | F-A fixed | audit row 13 green |
| 11 | Templates created on both WABAs, polled APPROVED/UTILITY, config switched, `conversationId` passed, old templates deleted | audit row 14 output pasted here |
| 12 | Mobile deep link to the exact thread, both apps | audit row 19 |
| 13 | Localization ×5 | audit row 15 |
| 14 | Skills ×4 + memory + parent plan §9.7 corrected | files listed here |
| 15 | §16 audit run, every finding fixed and recorded | the findings table exists, even if empty, with the check that produced each row |
| 16 | Clean tree | `git status --porcelain` output pasted here per repo |

### 17.1 ‼️ COMPLETION — 2026-09-21, one row per checklist item, each with the check that was actually run

| # | State | The check that produced it |
|---|---|---|
| 1 | ✅ | `DeliveryTracking` carries all three keys with identical values in **all four** hosts' `appsettings.json`, and the class defaults in `DeliveryTrackingSettings` mirror them exactly (`true` / `360` / `120`); `WhatsApp:ChatAttachmentSasExpiryMinutes` 60 in the **Functions host only**, which is the only host that mints one. `DeliveryTrackingSettingsConventionTests` green in every suite |
| 2 | ✅ | `HeldBackEmail` on `WhatsAppNotificationMessage`; `ServiceBusMessageBase.SchemaVersion` 2 → 3. **D-17 is the standing rule, not a new answer: queues are drained at deploy (L35) and NO compatibility code is written.** Matrix row 24 records what a lost in-flight message costs |
| 3 | ✅ | `AHeldEmail_WritesTheThreeApprovedFieldsAndNoMessageContent` reads the RAW document back off the emulator and fails on any property outside the approved list; `TenConcurrentEmailClaims_ExactlyOneWins` |
| 4 | ✅ | 28 router + 27 notifier tests; every gate flipped alone asserts `HeldBackEmail is null`; `WindowOpen_OneMemberOwnsTheNumber_HoldsThatMembersEmail` / `_NoSingleMemberOwnsTheNumber_HoldsNothing` |
| 5 | ✅ | 42 composer cases (the whole `AllowedAttachmentMimeTypes` list, table-driven, with a guard that the theory covers every accepted type) + 17 relay-processor tests (order, per-part marks, resume, send-time SAS never on the queue) |
| 6 | ✅ | `WindowClosed_NoticeCarriesTheHeldBackEmail`; cancel-on-read releases nothing, by the branch that returns before any release |
| 7 | ✅ | Audit row 3 enumerated **18** exits; the two that leaked (A-3, A-4) are fixed and pinned |
| 8 | ✅ | `WhatsAppStatusProcessorTests` + `ChatEmailReleaseServiceTests` (25 methods / 30 cases, one per table row) |
| 9 | ✅ | `MessageGone_StopsQuietly`, `MessageRemovedByAnAdmin_IsNeverEmailed`; the idempotency key is asserted deterministic |
| 9b | ✅ | `ADeliveredDropsTheHoldWithoutClaimingItReleasedAnything`, `TheCheckAfterADelivered_FindsNothingToClaim`, `ADeliveredAfterTheRelease_ChangesNothing`, `OnePartHoldsTheEmail_SoExactlyOneDeliveryCheckIsScheduled`, `Run_DeliveryCheck_WithNoCarrierStatus_IsNotDeadLettered` |
| 9c | ✅ | `AFirstMessage_SplitsOnlyWhenTheWordsWouldNotFitBehindTheButton(1/500/1000/2000)`, `ALongFirstMessageWithAPhoto_SendsWordsThenPhotoThenTheButton` |
| 9d | ✅ | `tsc` clean and 0 ESLint errors on all four apps; the tick rule reads `whatsAppOutcome` on all four thread screens; `MapToDtoWithReadableUrls` carries the two fields and the `IsRemoved` branch deliberately does not |
| 9e | ✅ | `CommunicationDispatcherWhatsAppTests` (D-2 pin + a control), `RecipientMutedInApp_NoOp_NoContactRead_AndHoldsNothing` (D-8), the two directions' own suites (D-9) |
| 10 | ✅ | `WindowOpen_RegistersTheProviderSideContext_SoTheReplyRoutesBack` (unit) **and** `Run_ProviderReply_WithTwoLiveCustomerThreads_AsksInsteadOfGuessing` (real emulator) — the case F-A created |
| 11 | ✅ | **Live read then DELETE, 2026-09-21, both WABAs.** Read first: 32 variants, every one APPROVED / UTILITY — `clinket_chat_reply_customer`/`_provider` ×5 on Canada (en_US, es, fr_CA, gu, hi) and ×3 on India (en_US, gu, hi), and the old pair ×5 / ×3 beside them. The script REFUSES to delete unless the new pair reads back APPROVED / UTILITY on that same WABA, so the gate was proven, not assumed. Delete: `{"success":true}` ×4 (CANADA customer 5, CANADA provider 5, INDIA customer 3, INDIA provider 3). Re-read after: **old = 0 variants everywhere, new = 5 / 5 / 3 / 3 untouched.** ‼️ Owner's ruling 2026-09-21 overrode §13 row 9's "never delete before the deploy": *"other new template is utility approved anyway so you can delete it now … no point doing it after deploy"* |
| 12 | ✅ | `chatThreadDeepLink.test.ts` in both mobile apps, 7 tests each, **sabotage-proven** (3 fail in each when `readConversationId` is neutered) |
| 13 | ✅ | 4 backend keys × 5 languages with identical placeholders; 3 web keys × 5 × 2 apps; 3 phone keys × 5 × 2 apps; Meta's 20/60 limits pinned per language |
| 14 | ✅ | `clinqet-whatsapp`, `clinqet-messaging`, `clinqet-delivery-feedback` ×4 tool directories = 12 files; memory entry; §9.7's source document no longer exists (§13 row 11) |
| 15 | ✅ | §16.1 above — 14 findings, all fixed, each with the check that found it. ‼️ **A-14 was found by reviewing A-1's own fix**, which is why the review-the-fixes pass exists |
| 16 | ✅ | `git status --porcelain` in all thirteen repos: 9 · 15 · 16 · 13 · 11 · 2 · 1 · 6 · 6 · 0 · 13 · 9 · 0 entries, every one a deliverable. `clinqetwebadmin` and `azureautomation` are untouched — no new Azure resource, no new queue, no new `local.settings.json` key. The session scratchpad is EMPTY and `grep SABOTAGE` across every repo returns nothing |

**Every suite, after the last fix landed:** API unit 13,197 · Functions unit 5,197 · Identity unit 1,044 ·
MCP unit 1,032 · API integration 2,214 · Functions integration 609 · Identity integration 479 ·
MCP integration 100 · partner mobile 5,318 · customer mobile 912 · partner web 4,335 · user web 1,011.
ESLint 0 errors on both web apps, `tsc` clean on both phone apps. **Nothing skipped, nothing ignored.**

## 18. Open questions — could not be verified in this session

1. **Meta rate card numbers** for India and Canada (utility, marketing, authentication) — vendor pages expose only a
   calculator and unnamed CSVs; read them in WhatsApp Manager → Billing. Third-party figures in §5 are unverified.
2. ~~Category per locale of the two notify templates~~ — **CLOSED 2026-09-20 by a live read: all 16 variants
   APPROVED / UTILITY (§7.7).** The verify script still does not cover the `_customer` name (fixed by §7.7 step 2).
3. **Whether 131047 is returned synchronously or as a `failed` status** for a session text — Meta's page says errors can
   come either or both ways and does not specify per code; the design handles both.
4. **The policy sentence** on sharing customer chat information — a legal reading, not an engineering one; it governs
   what is already live as much as this design.
5. **Volume** — no production chat volumes exist; §10.4 uses stated assumptions.
6. **Whether Meta ever emits `failed` hours after `sent`** for a session text — undocumented; the 6 h cutoff is a
   judgement, not a measurement.
7. **F-A** — found by reading; must be reproduced by a test before it is called a defect.
8. **F-D** — whether user-typed `{n}` text has ever been stripped in production is unmeasured.
9. ~~The live body text~~ — **CLOSED 2026-09-20**, read live and recorded in §7.7.
10. ~~Whether a "you have a reply" notify is utility in hi/gu~~ — **CLOSED**: the live hi/gu variants already are.
11. ~~Whether Meta approves the identical body under the new names~~ — **CLOSED 2026-09-20: all 16 APPROVED / UTILITY.**
12. **Whether a free-form `cta_url` interactive message accepts a text header** (to render the sender's name as a
    WhatsApp header rather than a bold first line) — Meta's page for this message type answered 404 twice in this
    session; the codebase's own request record carries no header (`MetaWhatsAppService.cs:724-731`). The design does
    not depend on it (§7.3); the build verifies it against Meta's reference before using a header.

## 19. Sources

- developers.facebook.com/docs/whatsapp/pricing · developers.facebook.com/documentation/business-messaging/whatsapp/pricing
- developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages
- developers.facebook.com/docs/whatsapp/updates-to-pricing/new-template-guidelines
- developers.facebook.com/docs/whatsapp/cloud-api/messages/text-messages · …/cloud-api/reference/media · …/cloud-api/reference/messages
- developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes
- whatsappbusiness.com/policy (WhatsApp Business Messaging Policy)
- routemobile.com/blog/whatsapp-business-pricing (third party, unverified figures)
- developers.facebook.com community thread 675781224420580 (no delete API)

---

## 20. ‼️ CODING STANDARDS FOR THE BUILD SESSION — owner-supplied 2026-09-20, verbatim, in force alongside CLAUDE.md

# SYSTEM INSTRUCTIONS & CODING STANDARDS

You are an expert Software Architect and Developer. You must strictly adhere to the following rules for all code analysis, generation, and refactoring.

## 🛑 1. CORE DIRECTIVES (THE "ZERO" RULES)
* **Zero Assumptions:** Do not assume context. Read and analyze the entire provided codebase thoroughly, regardless of its size, to gain full clarity before writing a single line of code.
* **Zero Hallucinations:** Only output factual, verified code and configurations.
* **Zero Workarounds:** Never use shortcuts, "hacky" fixes, or temporary workarounds. Apply only industry best practices.
* **Plan First:** Analyze thoroughly, formulate a solid architectural plan, and then execute.

## 🏗️ 2. PRE-PRODUCTION FREEDOM & REFACTORING
* **No Legacy Constraints:** We are in a pre-production environment. We have absolute flexibility.
* **Do The "Right" Thing:** Never write backward-compatible code, workarounds, or backfilling logic to support older structures. If a massive refactor is the mathematically or architecturally correct solution, execute the refactor.
* **State Resets:** Assume data can be dropped and recreated at any time. Focus entirely on the absolute best, fully production-ready end state.

## ⚙️ 3. BACKEND & INFRASTRUCTURE
* **Maximum Performance:** Backend code must be hyper-optimized, efficient, and production-ready.
* **Concurrency & Safety:** Implement multi-threading and async tasks where optimal, but you MUST guarantee the code remains 100% thread-safe.
* **Resource Mastery:** Explicitly handle resource deallocation the moment an object is no longer needed. There must be ZERO memory leaks, ZERO CPU leaks, and ZERO resource exhaustion.
* **Watertight Logic:** Code must have zero gaps and zero bugs. Cover every logical pathway.

## 🖥️ 4. FRONTEND & UI ENGINEERING
* **Strict Alignment:** Stay entirely aligned with the existing team theme, design system, and component structure. Build on top of it; do not deviate.
* **Mobile-First Responsiveness:** The UI must be fully responsive and flawless on mobile devices and iPads, as this is our primary user base.
* **Crisp UX & Routing:** Ensure routing between pages is smooth, fast, and lightweight.
* **API Optimization:** UI code must be solid and flexible. Strictly prevent redundant or duplicate API calls.
* **Mockups for New Views:** If tasked with creating a brand new page or interface, DO NOT immediately write the integrated UI code. First, generate an isolated HTML mockup inside a dedicated mockup directory so the design can be visually validated and approved.

## 🛡️ 5. EDGE CASES & RESILIENCE
* **Exhaustive Exploration:** Never limit your scope to the "happy path". You must anticipate, explore, and handle every possible edge case.
* **Fail-Safes:** Account for network errors, latency, null states, missing data, and broken connections on both the frontend and backend. The solution must survive all of them gracefully.

## 💬 6. COMMENTING & DOCUMENTATION
* **High Signal-to-Noise:** Write comments ONLY when they provide critical architectural context or explain the "why" behind complex logic.
* **No Verbosity:** Absolutely no redundant, obvious, or verbose comments. Let the clean code speak for itself.

## 💡 7. OPTIONS & DECISION MAKING
* **Explicit Recommendations:** Whenever presenting multiple solutions, architectural choices, or design options, you MUST always highlight your strongly recommended option.
* **Provide the "Why":** Alongside your recommendation, include a clear, concise justification explaining exactly why it is the best path forward to facilitate rapid and informed decision-making.
