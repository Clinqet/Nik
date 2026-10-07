---
name: clinqet-whatsapp
description: >
  WhatsApp integration for Clinket (the platform's customer brand; codebase name is Clinqet) — two-way
  messaging, transactional/system notifications, and Sign-in-with-WhatsApp via the Meta Cloud API direct
  (no BSP). Shared business number per region (+91 India, +1 Canada), per-stamp webhooks, BSUID-native
  identity, consent + routing in Cosmos SystemData, WhatsApp as a channel on the existing
  Conversation/Message model. USE FOR any WhatsApp send/receive, opt-in/consent, template, webhook,
  channel-router, or WhatsApp-OTP-login work.
---

> ‼️ **SUPERSEDED IN PART (2026-09-02) — the in-app CHAT assistant was DELETED.**
> `POST /api/v1/ai/chat`, its three `ai/sessions` endpoints, `IMcpAIService`/`McpAIService`,
> `IMcpToolGateway`/`McpToolGateway`, `ChatToolSessions`, `Mcp:ChatToolAllowlist`, the chat branch in the
> MCP's `McpToolGuard` and both repos' `ChatToolAllowlistConventionTests` no longer exist. Every passage
> below describing the chat assistant, its tool gateway or its allowlist is HISTORY, not current behaviour.
> The provider-facing replacement is **Business Search** — see `clinqet-business-search`.
> Still live and unchanged: speech-to-text, enhance-text, provider-setup document intelligence, the whole
> VOICE path, and `IMcpSessionService`/`McpSessionService`/`AiSession` (rewritten as the Business Search
> conversation store, member-scoped and CAS-guarded).

# Clinket WhatsApp Integration — SKILL

## `clinket_booking_updated` + `clinket_notification_digest` LIVE (2026-09-01) — every digest locale APPROVED/UTILITY since the appeals landed (read from Meta 2026-09-26)

- **`clinket_booking_updated`** (customer; dispatched by `BookingService.HandleBookingUpdatedAsync`): **APPROVED/UTILITY on all variants first pass** — IN en_US/hi/gu, CA en_US/hi/gu/fr_CA/es. Wording mirrors the approved `clinket_booking_updated_provider`, customer voice; dynamic URL button `https://www.clinket.com/bookings/{{1}}` (`ButtonUrlParamKey bookingId`). Config `ApprovedLanguages` now `["en","es","fr","hi","gu"]` in API + Functions (parity-tested). Closes the JOB-4b "declared in code, dark in config, absent on Meta" gap.
- **`clinket_notification_digest`** (team-member digest; dispatched by `NotificationDigestService.BuildCommunicationRequest`): body `Here is the summary you asked for: {{2}} new updates in {{1}} on Clinket. Tap below to review them.` + STATIC URL button → `https://partner.clinket.com/dashboard/notifications` (as registered at Meta — ‼️ the provider web domain is `business.clinket.com`; EVERY provider button on both WABAs (24 CA / 21 IN templates) points at `partner.clinket.com`, which no config names. Owner decision pending: a Front Door redirect domain, or resubmitting — `Data/topup-engine-rules/WHATSAPP-TEMPLATE-ISSUES-2026-09-26.md` §3) (no `ButtonUrlParamKey` ⇒ the registry correctly sends no button param). **en_US APPROVED/UTILITY on BOTH WABAs; hi/gu (both WABAs) + fr_CA/es (CA) landed APPROVED/MARKETING** despite identical structure — the non-English classifiers again. `ApprovedLanguages` = ALL FIVE `["en","es","fr","hi","gu"]` in both hosts — **owner's explicit order 2026-09-01** (pre-launch; appeals expected to land before go-live; a trimmed list risks being forgotten). Until an appeal lands, a send in that locale uses the MARKETING-categorised variant (marketing-billed, still delivers) — verify the appeals flipped BEFORE launch. The JOB-4a send-breaking gap (config claimed five, Meta had ZERO) is closed. Owner is appealing the six MARKETING categories via Template Category Updates; **NEVER delete a MARKETING variant** (30-day name lock takes the healthy variants' name with it).
- ‼️ **Wording lesson:** `You have {{2}} new updates…` = MARKETING verdict (proven twice); `Here is the summary you asked for: …` flipped en_US to UTILITY on both WABAs — the agreed-upon-request anchor (same family as `clinket_details_ready`'s "As you asked on your call"). The anchor did NOT convince the hi/gu/fr/es classifiers.
- **`clinket_booking_updated_provider` LIT + actor-gated (owner-approved 2026-09-01):** `ApprovedLanguages` flipped `[]` → `["en","es","fr","hi","gu"]` in both hosts (the template was already APPROVED/UTILITY in all five on CA, four incl. fr_CA on IN — the JOB-4c dark entry). ‼️ **The provider WhatsApp leg fires ONLY when the CUSTOMER made the update**: `BookingService.HandleBookingUpdatedAsync` passes `whatsAppTemplateName: providerIsActor ? null : BookingUpdatedProvider` — a provider editing their own booking is not WhatsApp-pinged about their own change (mirrors the existing `SkipProviderEmail` gate; in-app/push still reach the team, self-echo mutes only the actor's toast; the CUSTOMER WhatsApp leg stays unconditional — a voice/AI reschedule benefits from written confirmation). Pinned by `HandleBookingUpdatedAsync_CustomerUpdated_RoutesProviderWhatsAppTemplate` + `_ProviderUpdated_SkipsProviderWhatsAppTemplate`.
- Proof names (`_v1`, India-only) deleted, absence verified.
- **`WhatsApp:WabaLanguages` — per-stamp WABA language allow-list (2026-09-01, owner-directed):** CSV scalar on `WhatsAppSettings` (default "" = no filter), enforced in `WhatsAppTemplateRegistry.TryLanguage` — the ONE choke point all four hosts (API/Functions/Identity/MCP) resolve through. India = `en,hi,gu`, Canada = `en,es,fr,hi,gu`. Carried by committed `appsettings.in.json` (API/Identity/MCP) + deploy.ps1 env var `WhatsApp__WabaLanguages` for Functions/MCP (5 wiring points, mirrors the `WhatsApp__DocumentSms*` pattern, incl. `RequiredFunctionAppSettings`). ‼️ This RETIRES the old "known residual" (an es/fr-preferring recipient on the in stamp resolving a variant its WABA lacks) — a filtered language now falls back to the DefaultLanguage variant instead of dooming the send at Meta. Never remove the filter to "simplify": ApprovedLanguages is shared config, the WABAs are not.
- **Estate-wide es/fr flip (owner-directed 2026-09-01):** every `WhatsApp:Templates` entry in API+Functions now lists ALL FIVE languages `["en","es","fr","hi","gu"]` — a live Meta audit (both WABAs) verified every claim is APPROVED before the sweep; zero send-breaking claims. The ONE deliberate exception: **`clinket_quote_cancelled` stays `[]`** — its only trigger is `BroadcastService.CancelAsync`, reachable solely from the customer cancelling their OWN quote request (BroadcastController), so a WhatsApp about it would echo the customer's own action (cost + noise). Do not flip it on without a non-customer cancellation path existing first.
- **`clinket_booking_cancelled_provider` LIT + actor-gated / `clinket_quote_expired` LIT (owner-directed 2026-09-01):** the cancellation processor (`BookingCancellationProcessor`) sends the provider WhatsApp ONLY when `CancellationType != ProviderCancellation` (customer cancels + 48h SystemTimeout ⇒ send; the business's own manual cancel ⇒ no self-ping) — pinned by `Run_ProviderCancellation_SkipsProviderWhatsAppTemplate` + `Run_SystemTimeoutCancellation_RoutesProviderWhatsAppTemplate`. `clinket_quote_expired` (customer, `BroadcastStatusUpdateFunction` terminal fan-out with its own redelivery guard) now sends in all five languages. Guard tests green: `WhatsAppTemplateConfigParityTests` + registry 37/37, Booking/digest dispatch 46/46. Full record: `C:\Nik\Data\whatsapp\README.md` JOB 4a/4b.


## Picture messages — the 6th outbound kind + `clinket_info_picture` (2026-08-25, knowledge images Phase B)

- **`WhatsAppMessageKind.SessionImage`** — a free-form Meta `type:"image"` send (`SendSessionImageAsync`),
  in-window only, mirroring `SessionDocument` for retry/parse/result semantics and for the placeholder guard
  (`ImageCaption` is sanitized like every other free-form body). The outbound processor treats it as a session
  kind: no template registry, no language resolution, no send-cap.
- **`WhatsAppTemplateNames.InfoPicture` = `clinket_info_picture`** — a UTILITY template with an **IMAGE**
  header, used when the caller's 24h window is shut. Config gains **`ImageLinkKey`** on
  `WhatsAppTemplateDefinition`; a definition declares an image link OR a document link, never both, because a
  Meta header carries exactly ONE media object. **Live APPROVED/UTILITY since 2026-08-25** —
  `ApprovedLanguages: ["en","es","fr","hi","gu"]` in the API and Functions hosts; an empty list still means
  no picture messages, so a later rejection degrades to document-only instead of failing the send.
- ‼️ **A template's header format is FIXED AT CREATION.** `clinket_info_ready` is `format: DOCUMENT`; making it
  accept an image would mean EDITING it — re-review, and the 30-day name lock. A new name was the only option.
- ‼️ **Carousel templates (several images in one message) are documented by Meta as MARKETING-ONLY**, so they
  cannot carry a caller-requested transactional send. **One image per message, N pictures = N messages.**
- ‼️ **Meta subcode 2388299 — "Variables can't be at the start or end of the template."** A body ending in
  `{{1}}.` is refused. Hit on the first en/fr/es submissions; every locale now has `{{1}}` mid-sentence.
- **`WhatsAppMediaLimits`** (shared) holds Meta's image contract — `image/jpeg`|`image/png`, ≤5 MB — and the
  producer drops an ineligible picture BEFORE enqueuing rather than paying a round trip to learn it.
- **Creating templates safely** (owner's rule, and the reason `C:NikDatawhatsapp` exists): submit under a
  **proof name** (`…_v1`, never a runtime name) with `category:"UTILITY"` and `allow_category_change:false` so
  Meta REFUSES rather than silently downgrading; only when every locale is `APPROVED / UTILITY` create the
  production name, and only then delete the proof. India carries `en_US`/`hi`/`gu`; Canada/US adds `fr_CA`/`es`.

## WhatsApp+SMS Phase 4 — the final audit's corrections (2026-08-14, programme CLOSED)

- **‼️ A reply CONFIRM/DECLINE is now a FULL booking transition.** `BookingReplyActionService` (provider
  confirm/decline AND customer confirm) uses the platform ETag-CAS loop (`TryReplaceBookingAsync` +
  fresh-copy guard re-check per attempt — `UpdateItemAsync` re-reads internally and was silently
  last-write-wins, so the Phase-2 412 handlers never fired) and then calls
  `IBookingService.HandleStatusChangeAsync` exactly like the in-app endpoint. That restored the missing
  side-effects: timeout cancel, customer notification (incl. the WhatsApp leg on decline), email,
  reminder scheduling, auto-completion (⇒ auto-invoice), invoice past-booking check, and the
  **booking-payment unwind on decline**. The hand-rolled dispatch/email blocks are DELETED — never
  re-add a per-channel copy. The customer reply-confirm also updates the `CustomerBooking` mirror
  (`ConfirmedByCustomer`) — it used to leave the customer's app on "awaiting confirmation" forever.
- **‼️ A STOP can no longer be reversed by a racing auto-consent.** `ApplyWithRetryAsync` re-evaluates an
  `abortWhen` predicate on EVERY CAS re-resolve; `WhatsAppConsentRequest.AbortIfSuppressed` is set ONLY by
  `TryAutoConsentForSendAsync`, which now also inspects the returned contact and refuses the send when the
  write aborted. A customer's own START restore still overrides an opt-out (DR-4) — never gate that path.
- **`InboundReplyKeywords` is authoritative on BOTH channels**: the Functions `WhatsApp:OptOutKeywords`/
  `OptInKeywords` appsettings lists (which fully SHADOWED the table when non-empty) are removed;
  `BuildKeywordSet` keeps the emergency override capability, but by default a word added to the table now
  reaches SMS and WhatsApp alike.
- **The WhatsApp inbound + outbound processor catch-alls alert only on FINAL retry** (the AL-10 pattern —
  they used to raise up to 5 Critical alerts per poisoned message), with exception-TYPE-only stable
  descriptions. AI-F8 is enforced AT THE PRODUCERS: `TelnyxSmsService`/`TwoFactorSmsService` put the
  exception TYPE (never `ex.Message`) into `SmsResult.ErrorMessage`/alert reasons — carrier verdict text
  (statuses, error codes, errorsJson) is deliberately kept, it is the actionable content.
- `RoutingSmsService.IsIndiaBound` is now genuinely THE single India rule — `DocumentSmsGate` and the
  voice number-lifecycle SMS both call it (the latter's raw prefix test missed un-normalized "91…" phones).
- Config hygiene: every host that registers the consent service now carries the consent keys
  (`DefaultOptIn`/`ConsentPolicyVersion`/`MaxConsentEvents`/`EnableConsentAliasFailureAlerts` — MCP and
  Identity were missing some, saved only by class defaults); MCP `LanguageMap` aligned (es added, stray
  `ja` removed); MCP `TwoFactor:BaseUrl` trailing slash removed (it produced `//` URLs).
- **The decline-undo window is anchored to `CancelledAt`, 60 minutes** (owner-approved 2026-08-14) — a
  reply-decline stamps `CancelledAt`/`CancelledBy` and the undo clears them. ‼️ No new field was added: a
  `RejectedAt` was proposed and REJECTED in favour of the existing pair, which `RejectedTimeout` already
  stamps. See the decline-undo section below.
- Documented dispositions (owner-visible, do not "fix" silently): the four pre-resolver short-circuits
  (booking replies, menu drill-downs, customer booking confirmation) deliberately run BEFORE the block
  gate — they are actions, not ingestion; an admin-blocked contact's COLD inbound and a blocked PROVIDER's
  chat replies are dropped by the one gate (the provider case is an OPEN owner decision).
- Full disposition table: `C:\Nik\whatsapp-sms-review\FINAL-AUDIT.md`.

## WhatsApp+SMS Phase 3 — the AI/voice rails + the cap's true boundary (2026-08-14)

- **‼️ THE PLAN CAP NOW GATES EXACTLY THE THREE PERK PRODUCERS** (provider new-message ping ·
  CRM outreach · router provider-notify — all direct `whatsapp-outbound` enqueues). Everything routed
  through `CommunicationDispatcher` is **`CapExempt = true` by construction** (transactional:
  booking/quote/invoice/billing lifecycle, both roles, incl. every voice fan-out). ‼️ The dispatcher had
  been reusing `NotificationData["BusinessId"]` — deep-link metadata — as the billing key, silently
  plan-gating booking confirms; that is what made a Free provider miss their one-tap confirm entirely.
  The document rail (`DocumentDeliveryService`, BOTH branches) is CapExempt too (D8 customer-is-king —
  the free-form branch used to carry `BusinessId` un-exempted). The WABA monitor still counts every send.
- **Free tier `whatsapp_template_cap` is 10/day, never 0** (billing catalog **v9**, owner 2026-08-13).
  0 remains an admin-settable blocked state. Since catalog **v12** (two plans, 2026-10-04) the ladder is
  **Free 10 / Premium 200** per day — Basic and Max are gone, and Premium is finite (it is NOT the old Max ∞).
  ‼️ **AI-phone-call sends bypass the cap entirely, end to end** (owner MUST): documents + links + OTP +
  booking fan-out are all provably exempt (see clinqet-voice-assistant 2026-08-14).
- **`WhatsAppOtpService` (login + voice OTP) now respects a stored BLOCK**: alias-aware
  `IWhatsAppConsentService.ResolveContactAsync` before the send; `Blocked` ⇒ return false (caller falls to
  the next channel — the send was doomed). **OptedOut still receives the code** (auth traffic, same as SMS
  OTP); a consent-read failure fails OPEN. The MCP host now registers the consent service + both WhatsApp
  repos for this.
- **A voice caller who chose EMAIL gets email ONLY**: the booking/quote/invoice email messages carry
  `EmailOnly` (set by the voice enqueues) and the email processors skip their additive WhatsApp copy —
  the booking leg no longer auto-consents a caller who asked for email. Web flows byte-unchanged.
- The in-app chat AI can no longer reach the send/verify/OTP tools at all (`Mcp:ChatToolAllowlist`,
  enforced server-side in Clinqet.Mcp — see clinqet-ai-assistant).
- `DocumentDeliveryService` failure reasons now carry the exception TYPE, never raw `ex.Message`
  (alert content-hash dedupe + no internals in admin alerts); the failed caller-requested-SMS degrade
  reuses its uploaded SAS URL (one PDF upload, not two); `TryAutoConsentForSendAsync` gained a
  contact-passing overload so the document/link rails resolve the contact ONCE per send.
- Committed `clinqetmcp/appsettings.in.json` now states the real India posture
  (`WhatsApp:DocumentSms* = false`, `Voice:Sharing:SmsEnabled = false`) instead of inheriting base `true`s.

> **Status: Phase 1 COMPLETE — backend Stages 1.2–1.9 (A–G) + Phase-1 UI (Increment H) BUILT + TESTED (2026-06-01).** Meta send core, SystemData repos, template registry, consent service (incl. block/unblock + the customer-facing `POST /api/v1.0/whatsapp/consent` endpoint), dispatcher 4th channel + transactional dispatch wiring (booking/broadcast/quote/invoice), Functions outbound/webhook/status, Sign-in-with-WhatsApp OTP, and Phase-1 UI (login "Get code on WhatsApp" Variant-A both apps; opt-in checkboxes on quote/quickbook/cart calling the consent endpoint; admin unblock action). **Phase 2 STARTED (2026-06-01 s4): Step-3 COLD-REACHABLE inbound ingest shipped + tested** — `WhatsAppInboundMessage` DTO + inbound-wamid idempotency (`IWhatsAppInboundIdempotencyStore`/`wainidem_`, fail-open) + `AdminAlertType.WhatsAppColdInbound` + `WhatsAppInboundProcessorFunction` (dedup→resolve §2.1→**zero-context→cold**: `CustomerInitiated` consent + self-sufficient admin alert; an active-context branch is DEFERred to the router/Step-5 conversation-write) + webhook non-keyword thin-DTO enqueue (`BuildInboundMessage`); +22 unit (Functions 782/API 3643/Identity 635/integration 932). DEFERred, built WITH the router (Step 5): conversation-write (3.8), media inbound (3.9), customer-resolution helper (3.10), and the cold auto-reply SEND (3.6b — needs a new `clinket_chat_welcome` template or the Step-5 in-window session-send). Full **Phase-2 work breakdown/todo tracker** is in the plan. **Deferred to Phase 2** (plan §9.6, BINDING mockup-first rule for all Phase-2 UI): the `wa.me` Open-Page button (S3), notification-settings WhatsApp toggle (S4), CRM WhatsApp icon (S5) — plus all inbound two-way / omnichannel unification. Authoritative specs — read before coding:
> - `c:\Nik\WHATSAPP_INTEGRATION_PLAN.md` (master plan: cost, BSUID dual-era §2.1, data model §4, consent §5, UI map §9A, Sign-in §10, edge cases §13, deploy §15)
> - `c:\Nik\whatsapp\META_TEMPLATE_SUBMISSION.md` (Meta submission deliverable: per-template Cloud-API JSON + samples + §2.1 wiring map + decisions) · `c:\Nik\whatsapp\TEMPLATE_INVENTORY.md` (simple submit-list of the 20 templates) · `c:\Nik\whatsapp\TEMPLATE_TRANSLATIONS.md` (hi/gu/ja drafts)
> - `c:\Nik\whatsapp\IMPLEMENTATION_PROMPT.md` (staged execution + context-stress handoff protocol)
>
> **Brand:** customer-facing display name + all template/UI copy = **Clinket**. Code identifiers, namespaces, paths, and skill names stay `Clinqet*`/`clinqet-*` (the actual codebase) — do NOT rename code.

## What this is
WhatsApp messaging + Sign-in for Clinket via **Meta Cloud API direct** (chosen on cost: Meta has no fixed/monthly fee; inbound + in-window + 72h free-entry traffic is $0; no BSP markup). **Shared business number per region** (+91 India, +1 Canada), one Meta Business Portfolio, **one Meta App + WABA + number + webhook per region** → pinned to that stamp's function domain (`function-in.<env>.clinket.com` / `function-ca…`) → that stamp's Cosmos/SQL. Go-live Sept 2026. Per-provider numbers are Phase 3 (out of scope).

## Non-negotiable invariants
1. **WhatsApp is a channel on the existing `Conversation`/`Message` model.** **[ROUTER BUILT 2026-06-01 s6]** `WhatsAppChannelRouter` is implemented and `IEnumerable<IChannelRouter>` is wired into `MessageService.ProcessPostSendActionsAsync` (the background POST-send fan-out — `SendMessageAsync` stays **BYTE-UNCHANGED**, NOT the hot path), gated on `Conversation.activeChannels` (cost) + `OtherParticipantType==Customer` (echo guard). The no-op `PlatformChannelRouter` stays the Singleton default. Still DORMANT in prod until inbound-write/CRM creates a `WhatsAppActiveContext` + adds WhatsApp to `activeChannels` (see the Phase-2 router section below).
2. **BSUID dual-era identity.** Meta switches phone→Business-Scoped User ID: webhooks carry BSUID (`user_id`) from Apr 2026, send-to-BSUID from May, usernames Jun; we launch Sept = BSUID-primary, **phone may be absent**. Canonical doc `wac_{key}` (key = BSUID-if-known-else-E164-phone, NEVER migrates) + alias docs `waa_{id}`→canonicalKey. Resolve = 2 point-reads. Link phone↔BSUID at first successful send. **Never assume the webhook contains a phone.** (Algorithm: plan §2.1.)
3. **Consent + routing live in Cosmos `SystemData`** (existing container, pk `/pk`, Cart-pattern `id`+`pk` point-read) — **NO new container.** Universal (works for no-account customers); STOP/opt-out is ALWAYS honored (this fixes the SMS unknown-phone compliance gap). No cross-partition queries.
4. **Transactional/system sends ride `ICommunicationDispatcher` as a 4th channel.** Gate = `!SkipWhatsApp && IsWhatsAppEligible(category) && contact.channelOptIn==OptedIn && (category!=Marketing || contact.marketingOptIn) && templateExistsForLanguage` (mirror the SMS gate). Add `SkipWhatsApp`/`RecipientWhatsApp`/`WhatsAppTemplateName`/`WhatsAppTemplateData` to `CommunicationRequest` and `WhatsAppDispatched/Failed` to `DispatchResult`.
5. **Webhook = HTTP `Anonymous`, verify `X-Hub-Signature-256` (App Secret), handle GET challenge, THIN (verify→enqueue→200 in <5s), per-stamp.** Mirror `SmsWebhookFunction`. Inbound MUST hit the stamp that owns the data.
6. **Idempotency:** outbound dedup on Service Bus `MessageId`; inbound dedup on `wamid`. The existing SMS/email SB processors lack this — **do not inherit the gap.**
7. **Encryption:** WhatsApp message `content` uses `IMessageContentProtector` (AES-GCM). Not E2E once in our system.
8. **Sign in with WhatsApp = LOGIN ONLY.** An Auth template (`clinket_login_code`) carrying the existing OTP, branched at `ISmsService.SendVerificationCodeAsync`/`RoutingSmsService` → `WhatsAppOtpService`. OTP gen/verify/JWT pipeline UNCHANGED. **No phone-only account creation** (`CreateSystemCustomerAsync` untouched); unknown phone → "register first"; WhatsApp delivery fail → SMS fallback.
9. **Localization:** runtime WhatsApp copy uses `en`, `es`, `fr`, `gu`, and `hi`; Japanese is retired. No hardcoded user-facing text (§0.10). Don't machine-translate transactional template copy. **Self-serve language rollout:** per-template `ApprovedLanguages` + `WhatsApp:DefaultLanguage` (`en`) — `WhatsAppTemplateRegistry` sends the recipient's language if Meta has approved that variant, else falls back to the default-language template. `LanguageMap` is identical in API, Functions, and Identity (`en_US`, `es`, `fr_CA`, `gu`, `hi`). Meta rejects `es_US` for message templates (subcode `2388049`); use generic `es` for Clinket's neutral Spanish. Never add a locale to `ApprovedLanguages` without verifying the matching template variant in Meta.
10. **Secrets** (WABA token, App Secret, webhook verify token) in per-stamp Key Vault (`clinket-kv-<stamp>`), never `.deploy-secrets`. New SB queues `whatsapp-outbound`/`whatsapp-inbound`/`whatsapp-status` per stamp (ARM `events.json` + `deploy.ps1`).

## Key files (build / touch)
- **Shared/Core:** `clinqetshared/Enums/MessageChannel.cs` (exists); `CommunicationRequest`/`DispatchResult` (+WhatsApp); `CommunicationPreferenceConfig` (+`WhatsAppEligibleCategories`/`IsWhatsAppEligible`); NEW `WhatsAppContact`/alias models; NEW `WhatsAppNotificationMessage` DTO.
- **Infrastructure:** NEW `IWhatsAppService`/`MetaWhatsAppService`, `WhatsAppChannelRouter`, `WhatsAppContactRepository`/`WhatsAppPhoneAliasRepository`, `WhatsAppConsentService`, `WhatsAppTemplateRegistry`; extend `CommunicationDispatcher`.
- **Functions (`clinqetfunctions/Clinqet.Communications`):** NEW `WhatsAppWebhookFunction`, `WhatsAppInboundProcessorFunction`, `WhatsAppOutboundProcessorFunction`, `WhatsAppStatusProcessorFunction`.
- **Identity:** OTP transport branch in `RoutingSmsService` → `WhatsAppOtpService`; login-only.
- **UI (verified paths, plan §9A):** partner `src/app/dashboard/inbox/page.jsx`, `src/components/customers/index.jsx`, `src/components/auth/loginWithNumberForm.jsx`, `src/components/Profile/Notifications.jsx`, booking/invoice/lead detail; user `app/(customer)/messages/page.js`, `components/customer/quotes/QuoteCreateForm.jsx`, `components/customer/quickBook/QuickBookSheet.jsx`, `components/customer/cart/CartCheckoutSheet.jsx`, `components/customer/businessProfile.jsx`, `app/(customer)/settings/notifications/page.js`. Both chat UIs are single inline files; real-time reuses `signalRService.js` `onNewMessage`/`onConversationRead`.

## Voice-doc SMS: TWO-SWITCH kill switch + DocumentSmsGate (2026-07-17; supersedes the single-switch shape of the 2026-07-16 fallback build)
- **One authority — static `DocumentSmsGate`** (`clinqetinfrastructure/Services/Communication/DocumentSmsGate.cs`): `FallbackEnabled(A flag only)` / `FallbackEligible(A + recipient)` / `OnRequestEligible(B + recipient)`; `RecipientEligible` = phone non-empty AND NOT `SmsRouting:IndiaCountryCode` ("+91" — 2Factor/DLT, unconditional, no flag overrides it). EVERY voice-doc SMS egress AND every AI knowledge surface (prompt variants, tool notes — see clinqet-voice-assistant) calls the gate; never inline the checks.
- **Switch A `WhatsApp:DocumentSmsFallbackEnabled`** (default true): WhatsApp attempted-and-failed → direct SMS. Authoritative at SEND time, four points: (1) `DocumentDeliveryService.TrySmsFallbackAsync` (sync); (2) `BuildDirectSmsFallback` attach at enqueue; (3) `WhatsAppOutboundProcessorFunction.TrySendDirectFallbackSmsAsync` top re-check — a queued message never texts after a flip-off; (4) the wamid ticket WRITE is gate-checked — OFF never mints a `wafb_` ticket (OFF is terminal per message; re-enable is forward-only). `WhatsAppStatusProcessorFunction.TryTicketedSmsFallbackAsync` checks the FLAG BEFORE `TryClaimAsync` — suppressed claims cost zero RU and the ticket TTLs out unclaimed, so a brief ops flip never destroys recovery state (still claimable if re-enabled within the 72h TTL).
- **Switch B `WhatsApp:DocumentSmsOnRequestEnabled`** (default true, NEW): caller says they don't have/use WhatsApp → direct ONE-HOP SMS via `IDocumentDeliveryService.Deliver{Booking,Quote,Invoice}SmsAsync` (`VoicePostCallMessage.DocumentSendSms`, reason `caller_requested_sms`) — skips the doomed WhatsApp round-trip entirely (faster + cheaper). Ineligible at process time OR SMS carrier failure ⇒ ONE degrade pass to the WhatsApp path (whose own fallback may retry SMS at most once via the still-unmarked `smsfb:` key — bounded by construction, never a loop). The SAME `smsfb:{type}:{ctxId}:{phone}` key covers on-request AND fallback sends ⇒ cross-path double-texting is structurally impossible.
- **Idempotency hardening (closes the M2 redelivery double-SMS residual)**: `WhatsAppSmsFallback` gained `IdempotencyKey` (the smsfb: key) + `LiveCallId`, stamped by `BuildDirectSmsFallback` and persisted on the `wafb_` ticket; `TryClaimAsync` now returns `WhatsAppSmsFallbackTicketClaim { Fallback, NotificationType }`. BOTH async processors check `IWhatsAppIdempotencyStore` before sending and mark on success (the status processor gained the store dep).
- **Withheld ≠ failed**: a voice send (smsFallbackOptIn) whose SMS the gate withheld returns `Failed("{reason}; sms_fallback_unavailable")` — the forced "Voice Document Delivery" admin alert stays (a kill switch must never become a silent-data-loss switch); non-voice sends keep the bare reason.
- **Deploy posture**: both keys per-stamp via the deploy.ps1 ternary (`in` ⇒ "false", else "true") in FOUR spots — the Functions live-apply beside `Voice__Carrier`, `$mcpAzureSettings`, and both emit-mirror dicts — plus `RequiredFunctionAppSettings` (fail-loud). Needed because Telnyx creds are value-gated to ALL hosts. Ops kill (CA): set both app settings "false" on the Functions AND MCP apps. Class defaults true, mirrored in the Functions + MCP appsettings (the MCP host now binds them for tool notes + prompt); API/Identity never read them.
- **Behavior matrix**: [A on/B on] says-nothing=WhatsApp · "no WhatsApp"=direct SMS · WhatsApp-fails=auto-SMS+in-call notice — [A on/B off] "no WhatsApp"⇒reassure + WhatsApp anyway (arrives as a text if the number has none) · fails=auto-SMS — [A off/B on] "no WhatsApp"=direct SMS · fails=forced alert+DeliveryFailed notice→AI offers email — [A off/B off] email-only wording, the AI never says "text". +91 recipients: SMS impossible in every cell; `in` stamp = bottom-right column everywhere.
- **Untouched, regression-pinned**: the non-Direct dispatcher preference-gated SMS branch (`TryFallbackSmsAsync`) and the OTP/verification SMS rail (both regions; `Mcp__OtpChannelOrder` still includes sms on both stamps).
- Accepted residuals: consent-flip between enqueue and outbound with A off = log-only; a WabaCeiling throttle on a voice doc with A off = alert-visible non-delivery; SMS templates en-only (platform convention).
## Phase 2 — Outbound router (BUILT 2026-06-01 s6; plan §9.7-C + SESSION 6 block)
- `WhatsAppChannelRouter : IChannelRouter` (`clinqetinfrastructure/Services/Messaging`): recipient resolved via `Conversation.externalChannelIds["WhatsApp"]` (canonicalKey) → `IWhatsAppContactRepository.GetByPkAsync` (1-RU) → the `activeContext` for the conversation. **Window open** (`windowExpiresAt>now`) → enqueue `WhatsAppNotificationMessage{Kind=SessionText}` (dedup id = chat message id). **Window closed** → **debounced** `WhatsAppSettings.ConversationNotifyTemplate` (`clinket_chat_reply_customer` (was `clinket_new_message` until 2026-09-21), dedup id `{msgId}-notify`) sent once per customer-silence period (re-armed when `WhatsAppActiveContext.LastNotifyAt` < `LastInboundAt`; best-effort `UpsertAsync` stamp). Gates: OptedIn + !Blocked + !PerProviderMuted + non-empty text.
- Selection: `IEnumerable<IChannelRouter>` by `IsChannelSupported`; invoked from `MessageService.ProcessPostSendActionsAsync` ONLY. Two gates: `activeChannels` has a non-Platform channel (pure in-app = zero contact read/cost) + `OtherParticipantType==Customer` (echo guard — a message ingested FROM WhatsApp, recipient=Provider, is never routed back). API DI: `WhatsAppChannelRouter` Scoped alongside Singleton `PlatformChannelRouter`.
- Free-form send: `IWhatsAppService.SendSessionTextAsync` (Meta `type:"text"`, shares the template executor in `MetaWhatsAppService`); `WhatsAppNotificationMessage.Kind`(`WhatsAppMessageKind{Template,SessionText}`)+`SessionText`; `WhatsAppOutboundProcessorFunction` branches on `Kind`. `ConversationResponseDto.ActiveChannels/ExternalChannelIds` added + populated in the `ConversationService` mapper (also feeds the chat WhatsApp badge, Step 6.5).
## Phase 2 — Inbound conversation-write C (BUILT 2026-06-01 s7; the router is now LIVE end-to-end)
- **Data model (LOCKED Q1):** WhatsApp is a CHANNEL on the existing `Direct` conversation (one thread per customer↔provider, channel per message) — NOT a `Context=WhatsApp`. Transport ≠ subject; one source of truth per relationship; a WhatsApp message can belong to any context.
- `IMessageService.IngestInboundExternalMessageAsync(customerId, businessId, channel, externalMessageId, content, externalChannelKey)→conversationId` (`MessageService`): `ResolveDisplayNameAsync`→`GetOrCreateAsync` (customer perspective, OtherParticipant=Provider)→write encrypted `Message{Channel=WhatsApp, ExternalMessageId=wamid, SenderType=Customer, deterministic MessageId=SHA256(wamid)[..24]}` (409→`InvalidOperationException`→continue to stamp+fan-out)→`AddExternalChannelForBothParticipantsAsync`→`ProcessPostSendActionsAsync` (recipient=Provider ⇒ echo guard skips the router). `SendMessageAsync` BYTE-UNCHANGED.
- `IConversationRepository.AddExternalChannelAsync` (read-merge-patch, idempotent) + `IConversationService.AddExternalChannelForBothParticipantsAsync` (both side-docs, per-side swallow). `IWhatsAppConsentService.RegisterInboundConversationAsync` (context window/customerId, 412-retry, no consent ledger). `WhatsAppSettings.SessionWindowHours`(24).
- `WhatsAppInboundProcessorFunction.HandleContextualInboundAsync` (Functions): exactly-1 context → `ResolveCustomerIdAsync` (§9.7-A: `contact.CustomerIds` → else `CreateSystemCustomerAsync(email:null)` by E.164 **+ `EnsureCosmosCustomerAsync`** since CreateSystemCustomerAsync writes only the SQL profile) → ingest → `RegisterInboundConversationAsync`; **>1 context → `WhatsAppAmbiguousInbound` self-sufficient admin alert + ack** (full disambiguation = Step 4); media-only (no text) → ack-no-write (3.9 deferred). Functions Program.cs DI mirrors the API: `MessagingSettings` + `IConversationService` + `IMessageService` + `PlatformChannelRouter`(Singleton) + `WhatsAppChannelRouter`(Scoped).
- ⚠️ **Cosmos camelCases dictionary KEYS on write** (Newtonsoft serializer) → `externalChannelIds["WhatsApp"]` is stored as `"whatsApp"`. NEVER look up a stored dict by a PascalCase key — match case-insensitively (the router's `ResolveExternalChannelKey`) or write/read the camelCased form. This was a latent s6-router bug caught by the s7 integration test.
- **NOT YET:** media inbound (3.9, BLOCKED on a Meta media-download capability); Step 4 disambiguation (referral/`context.id`/interactive-list — C does single-context only); Step 6 chat badges/window banner + S3 Open-Page `wa.me` + S4 notification toggle + the S5 CRM icon UI + the customer-app re-engagement card (all mockup-first §9.6).

## Phase 2 — Templates + cold auto-reply + CRM outreach 6.1 (BUILT 2026-06-01 s8; plan SESSION 8)
- **Templates** registered in `WhatsApp:Templates` (API + Functions `appsettings.json`, base only per stamp-layering): `clinket_chat_reply_customer` (was `clinket_new_message` until 2026-09-21) (closed-window router notify, `BodyParams:["providerName"]`, static quick-reply "Reply") · `clinket_chat_welcome` (cold auto-reply, no params/buttons) · `clinket_optin_first_contact` (CRM first-contact, `["customerName","businessName"]`). All `ApprovedLanguages:["en"]`; degrade gracefully until Meta-approved (no live WABA). Settings `WhatsAppSettings.ColdWelcomeTemplate`/`FirstContactTemplate`.
- **Cold auto-reply (3.6b):** `WhatsAppInboundProcessorFunction` cold path enqueues `ColdWelcomeTemplate` to `whatsapp-outbound` **gated on `IWhatsAppTemplateRegistry.HasApprovedTemplate`** (no enqueue / no failure-alert noise when unapproved), dedup `{wamid}-coldwelcome`. Cold inbound opens the window ⇒ a UTILITY template is free.
- **CRM "Message on WhatsApp" 6.1 (first PROD context-creator):** `POST /api/v1.0/customer/business/{businessId}/customer/{customerId}/whatsapp` → `IWhatsAppProviderOutreachService.InitiateAsync` (thin controller; uses the linked `BusinessCustomer.CustomerId`, no find-or-create). 5-state `WhatsAppOutreachStatus`: `WindowOpen`/`WindowClosed` (opted-in, no send) · `InvitationSent` (None/Pending → `clinket_optin_first_contact`, gated) · `OptedOut`/`Blocked` (no WhatsApp; in-app re-engagement). Same deterministic `GenerateConversationId(Direct,null,businessId,customerId)` ⇒ the unified thread. Returns `WhatsAppOutreachResult{Status,ConversationId,TemplateSent,OptInStatus}`.
- `IWhatsAppConsentService.RegisterProviderInitiatedContextAsync`: resolve-or-create contact, `None→Pending`(ProviderTemplate), ensure a context (conversationId+customerId, **NO window** — opens only on a customer inbound), link customerId; ETag-retried; opted-out/blocked left untouched (no context). Returns `WhatsAppProviderContextResult{OptInStatus,Blocked,WindowOpen,ContextRegistered}`.
- **Opted-out/blocked re-engagement:** `NotificationType.ProviderWhatsAppReachOut` (→ `CustomerCategories[MessagesChats]` + `SignalRSettings:EnabledNotificationTypes`), dispatched via `ICommunicationDispatcher` (in-app + push only; `SkipEmail/Sms/WhatsApp`) **only when `Customer.UserId` is set**; `NotificationData` = providerName/businessId/providerPhone/providerEmail; localized `Notification_ProviderWhatsAppReachOut_Title/_Body` (backend `en.json`). API DI registers `IWhatsAppProviderOutreachService` (Scoped). UI (S5 icon + the customer-app card) deferred mockup-first.

## Phase 2 — 6.4 CRM UI + read-only status (BUILT 2026-06-01 s9; partner app)
- **Read-only status — side-effect-free, NOT the mutating 6.1 `InitiateAsync`:** `IWhatsAppProviderOutreachService.GetContactStatusAsync(businessId, phone?, country?)` → `WhatsAppContactStatus { HasPhone, OptInStatus, Blocked, WindowOpen }` (`clinqetshared/DTOs/Messages`); resolves the contact (≤2 RU) + derives the window for `businessId`. `GET /business` enriches each row's `WhatsAppStatus` via parallel `Task.WhenAll` single-partition point-reads (**per-row fail-open** — a miss never breaks the list). New `GET api/v1.0/customer/business/{businessId}/customer/{customerId}/whatsapp/status` for the detail screens. No new container/index, no cross-partition.
- **Partner UI (6.4):** `customers/index.jsx` WhatsApp column + consent badge (desktop) / badge under the name (mobile) + an action icon (green/actionable; greyed-disabled for pending/optedOut/blocked); Edit drawer + the 6.7 detail screens share `components/whatsapp/WhatsAppContactBlock.jsx` (`variant="block"|"button"`); Add modal "Invite to WhatsApp after saving" checkbox (default off) → fires 6.1 on create. Status→badge→action mapping is the single source of truth in `utils/whatsappStatus.js` (`resolveWhatsAppState` + `WHATSAPP_STATE_META` + `OUTREACH_RESULT_META`); the 6.1 action runs through `hooks/useWhatsAppOutreach.js` (toasts by status + navigates to the inbox thread on WindowOpen/Closed). 22 `WhatsApp.*` keys ×4 langs (these also cover 6.7).
## Phase 2 — 6.7 transactional affordances + 6.8 customer re-engagement card (BUILT 2026-06-02 s10; plan SESSION 10)
- **6.7 (partner detail screens):** `WhatsAppContactBlock variant="button"` (now accepts an optional `className`) dropped into the customer/contact block of booking `BookingsDetails.jsx`, invoice `InvoiceDetail.jsx`, and lead `leads/[id]/page.jsx` (**converted leads only**). businessId = `SessionStore.get("businessId")` (booking/lead, memoized) or `invoice.businessId`; customerId = `customer.customerUserNumber` (booking GET returns the entity), `invoice.customerUserNumber`, or `detail.customerUserNumber` (lead). The block fetches read-only status and **renders nothing on 404 / no-phone** (customer not in CRM) — never a dead control. No new lang keys (reuses `WhatsApp.*`).
- **6.7 backend (additive, response-only, no contract break):** added optional `CustomerUserNumber` to `InvoiceResponseDto` (mapper `ToResponseDto` ← `Invoice.Customer.CustomerUserNumber`) and `BroadcastProviderDetailDto` (set in `BroadcastProviderService.EnrichCustomerInfo` **only when converted** = same gate as the email/phone reveal; value = `Customer.CustomerId`). Both equal the CRM `BusinessCustomer.CustomerId` (== global `Customer.CustomerId`), so `GetCustomerWhatsAppStatus`/`MessageCustomerOnWhatsApp` (CRM-keyed) resolve. ⚠️ Note: the API serializes via System.Text.Json **web-defaults (camelCase)** and IGNORES Newtonsoft `[JsonProperty]` — so the entity's `CustomerUserNumber` (JSON `customerId` in Cosmos) is on the wire as `customerUserNumber`.
- **6.8 (user app `ProviderWhatsAppReachOut` card):** `utils/toastConfig.js` entry (`FaWhatsapp`/#25D366 — the toast itself stays the standard compact toast). `NotificationItem.jsx` is now a thin switch → `StandardNotificationRow` (the old body, unchanged) + `WhatsAppReachOutCard.jsx` for this type; a `layout` prop renders the full vertical card in the dropdown (`"compact"`) and a horizontal page band on `/notifications` (`"page"`). Card reads `notification.data` (providerName/businessId/providerPhone/providerEmail, both casings). Primary CTA → inline confirm → `recordWhatsAppConsent({ phoneNumber: <profile phone from state.userProfile>, optIn:true })` (existing `services/whatsappService`); **no profile phone → route to `/settings/notifications`** (never errors). Call (`tel:`)/Email (`mailto:`)/Profile (`/{businessId}` — same public-page fallback as `BroadcastService.ProviderProfileUrl`) pills gated on payload. `NotificationDropdown` passes `layout="compact"`, `notifications/page.jsx` passes `layout="page"`. 15 `notifications.whatsappReachOut.*` keys ×4 langs. SignalR path unchanged.
- **Add-customer invite default is now config-driven (default ON):** `NEXT_PUBLIC_WHATSAPP_INVITE_DEFAULT` (partner `getRuntimeConfig()`, documented in `.env.example`) — ON unless explicitly `"false"`; `AddCustomerModal` initializes the checkbox from `INVITE_WHATSAPP_DEFAULT`. Flows through the `NEXT_ENV_*` build secrets (no deploy.ps1/ARM change).
- **Verified flag:** the partner inbox `dashboard/inbox/page.jsx` already consumes `?conversationId=` (opens/fetches the thread) — the `useWhatsAppOutreach` deep-link works end-to-end; no wiring needed.
- **Tests:** +2 `BroadcastProviderServiceTests` (converted exposes / non-converted omits `CustomerUserNumber`) +2 `InvoiceMappingExtensionsTests` (new). 6.8 covered by ESLint on the final pass.

## Phase 2 — Shared-number send guardrails + config hygiene + templates (BUILT 2026-06-02 s12; plan STEP 8/9/11)
- **Send guardrails (STEP 8):** `IWhatsAppSendGate` + `IWhatsAppSendCounterRepository` over a NEW SystemData doc `WhatsAppSendCounter` (`wasendcap_{pk}_{yyyyMMdd}`; pk=businessId per-provider / pk=`waba_{region}` monitor; atomic `PatchOperation.Increment`, per-item 48h ttl, calendar-day UTC bucket; **NO cosmosindexsetup change** — point-ops + `/type` already indexed; **SystemData** chosen over ProviderData to isolate per-send writes from the provider hot partition + leaner index). Gate = `IsAllowedAsync` (read pre-check BEFORE the Meta send) + `RecordSentAsync` (atomic increment AFTER success ⇒ idempotency-safe, fail-open) + `GetUsageAsync` (admin read). Enforced ONLY in `WhatsAppOutboundProcessorFunction` (the sole authoritative gate — a router pre-check was deliberately dropped as net-cost-negative); over-cap **TEMPLATE** send ⇒ suppressed + SMS fallback (not lost; in-window SessionText is free, never counted). `BusinessId` added to `WhatsAppNotificationMessage`, set by the router (`context.BusinessId`) + CRM outreach; **null = transactional ⇒ WABA-monitor only** (per-provider attribution for transactional needs businessId on `CommunicationRequest` = follow-on). Cap-hit ⇒ `FailureNotificationHelper.HandleWhatsAppSendCapReachedAsync` (provider in-app SystemNotification + admin alert `AdminAlertType.WhatsAppSendCapReached`, once at count==cap) + `HandleWhatsAppWabaTierAsync` (admin warn/ceiling). Settings `WhatsAppSettings.SendCaps` (Enabled, PerProviderDailyTemplateCap=250, WabaCurrentTier `WhatsAppMessagingTier{Tier250,Tier1K,Tier10K,Tier100K,Unlimited}`, WabaTierMonitorEnabled cost-toggle, WabaCeilingEnforce=false monitor-first, WabaThrottleWarnPercent=80) — appsettings API+Functions. Admin: `GET /api/v1.0/admin/whatsapp/send-volume?businessId=&region=`.
- **Config hygiene (STEP 9):** mirrored `WhatsAppSettings` scalar class-defaults into the appsettings of the projects that READ each (Functions: SessionWindowHours/ConversationNotify*/ColdWelcomeTemplate/Retry; API: ConversationNotify*/FirstContactTemplate; Identity: Retry) — **NOT** deploy.ps1 (shared scalars live only in committed appsettings; duplicating = drift). Added the 3 WhatsApp queue names to deploy.ps1 `$script:RequiredFunctionAppSettings`. Trimmed the `WhatsAppChannelRouter` 9-line XML summary to a one-line WHY (§0.14).
- **Templates (STEP 11):** `clinket_cart_reminder` + `clinket_review_received` registered in `WhatsApp:Templates` (API+Functions, `BodyParams` only — URL-button param + dispatch wiring deferred: cart = §17 Meta-marketing-category gate; review = `ReviewsRatings` is NOT WhatsApp-eligible at launch). NOT added to `WhatsAppTemplateNames` constants (no dispatch site yet). hi/gu/ja translations live in `whatsapp/TEMPLATE_TRANSLATIONS.md` (AI-drafted, native-review-before-Meta); `ApprovedLanguages` stays `["en"]` until Meta approves each language (config-only growth).

## Phase 2 — §13/§9.3 edge hardening + CONFIRM/DECLINE parity + review-on-WhatsApp (BUILT 2026-06-02 s13; plan STEP 7/8.2/11.2)
- **Free-entry 72h (7.1):** `WhatsAppInboundProcessorFunction` reads `WhatsAppInboundMessage.Referral` → opens `WhatsAppSettings.FreeEntryWindowHours`(72) vs `SessionWindowHours`(24). A `referral` object appears only on ad/post/entry-point inbound (a plain wa.me chat = none → 24h).
- **Provider-offboard (7.3):** the contextual path point-reads `IBusinessProfileRepository` (now a processor ctor dep); `BusinessProfile.Status` Inactive/Suspended ⇒ `IWhatsAppConsentService.ArchiveContextAsync` (removes the business's context, ETag-retried, no-op-safe) + gated `clinket_provider_unavailable` reply + NO ingest. Missing profile = fail-open.
- **Consent staleness gate (7.4/7.5):** `WhatsAppConsentService.RecordConsentAsync` + `RegisterProviderInitiatedContextAsync` stamp `WhatsAppContact.ConsentVersion` = `WhatsAppSettings.ConsentPolicyVersion`. `CommunicationDispatcher.GetWhatsAppConsentAsync` computes effective opt-in = OptedIn && not-stale-version && not-inactive: a set-and-different `ConsentVersion` (null/legacy still allowed → non-breaking) OR a `ConsentTimestamp` older than `ConsentInactivityDays`(180; 0 disables) ⇒ treated as not-opted-in ⇒ SMS fallback. (Active re-prompt template = deferred.)
- **CONFIRM/DECLINE parity (7.6) + 4.6:** NEW shared `IBookingReplyActionService`/`BookingReplyActionService` (`clinqetinfrastructure/Services/Communication`) holds provider-lookup-by-phone + booking confirm/decline + customer-booking + email + customer-dispatch, ported VERBATIM out of `SmsWebhookFunction` (now delegates; channel-parameterized for the decline reason). The WhatsApp processor parses CONFIRM/DECLINE (leading text keyword OR `WhatsAppInboundMessage.InteractiveReplyId`) BEFORE contact resolution, **phone-sender only** (a BSUID's digits would false-match the phone lookup), consuming the message ONLY when the sender resolves to a provider (else falls through to customer-inbound). `InteractiveReplyId` captured by the webhook (`ExtractInteractiveReplyId` ← `interactive.*_reply.id`). DI: `IBookingReplyActionService` Scoped in Functions Program.cs; used by both `SmsWebhookFunction` + `WhatsAppInboundProcessorFunction`.
- **No-account register nudge (7.7, REPLACED s20):** the `clinket_account_invite` register nudge was DELETED (Meta both regions + code/config/tests) and replaced by the free-form "Explore services" CTA-URL onboarding (no forced signup) — see the s20 section. The once-guard (`MarkRegisterPromptedAsync` → `WhatsAppContact.RegisterPromptedAt`) is reused as-is.
- **7.2 capability pre-check = DEFERRED** (a per-send Graph lookup is net-negative; the post-send error-classifier already blocks + falls back).
- **Send-volume admin endpoint (8.2):** controller integration tests added (`GET /api/v1.0/admin/whatsapp/send-volume`: admin-auth 401/403, missing-businessId 400, `ApiResponse<WhatsAppSendVolumeDto>` envelope).
- **Review on WhatsApp (11.2):** `clinket_review_received` [reviewerName, rating] WIRED to `ReviewApproved`→**provider** only (`ReviewService.DispatchReviewNotificationToProviderAsync`, `RecipientWhatsApp = BusinessProfile.PhoneNumber`); `ReviewsRatings` now WhatsApp-eligible (`CommunicationPreferenceConfig` + Phase-0 contract test flipped); `WhatsAppTemplateNames.ReviewReceived` added.
- **New settings/templates:** `WhatsAppSettings.{FreeEntryWindowHours,ConsentPolicyVersion,ConsentInactivityDays,BusinessUnavailableTemplate}`; templates `clinket_provider_unavailable`/`clinket_review_received` in both appsettings Templates blocks (en-only `ApprovedLanguages`; hi/gu/ja drafts in `whatsapp/TEMPLATE_TRANSLATIONS.md`). (`clinket_account_invite` + `RegisterInviteTemplate` were later DELETED — see s20.) **11.4: marketing-on-WhatsApp = Phase 3 only ⇒ `clinket_cart_reminder` stays registered-only (NOT dispatched); fr-CA deferred.**
## Phase 2 — Step-4 disambiguation resolver + waconv_ lookup + read receipts (BUILT 2026-06-02 s14; plan STEP 4.1/4.2/4.5 + 6.6)
- **`waconv_{wamid}` partition-safe pointer (§0.7, 4.5):** `IWhatsAppConversationLookupStore`+`WhatsAppConversationLookupStore` (SystemData point-read, `ConversationLookupTtlSeconds`=7d, fail-soft). A by-wamid Messages query is cross-partition (pk=/conversationId, forbidden §0.6); this `{conversationId,messageId,userNumber,businessId}` pointer is written whenever a WhatsApp Message with an externalMessageId is written — inbound (`MessageService.IngestInboundExternalMessageAsync`) AND every chat-tied outbound (`WhatsAppOutboundProcessorFunction` on success when the queue msg carries a `ConversationId`; transactional templates skip). `WhatsAppNotificationMessage` += `ConversationId`/`ChatMessageId`/`RecipientUserNumber`; the router stamps both the session-text + closed-window-notify enqueues. Read by Step-4 L2 + 6.6. DI Singleton API+Functions.
- **Layered resolver (§9.7-D, 4.1):** `IWhatsAppInboundResolver`+`WhatsAppInboundResolver` → `WhatsAppInboundDecision{RouteToBusiness|ListSelection|AskWithList|Cold}`. Order (most-certain first): **L3** list selection (InteractiveReplyId matches a BUFFERED candidate) → **L1** explicit referral/prefill (**SEAM — `ResolveExplicitBusinessId` returns null until 6.2 wires the wa.me prefill decode**) → **L2** reply-context (`ContextWamid`→`waconv_`→businessId) → **L4** single context → **L5** multi-context exactly-one-open-window → **L6** ambiguous→Ask(candidates) → **L7** zero→cold. Explicit (L2/L3) beat the window heuristic; ties→Ask, never a guess. Wired into `WhatsAppInboundProcessorFunction.Run` (`HandleContextualInboundAsync`→`RouteToBusinessAsync`/`FlushSelectionAsync`/`AskWhichProviderAsync`; L4+offboard+window byte-equivalent to s13). DI Singleton (Functions).
- **`wapend_` disambiguation buffer (4.2):** `WhatsAppPendingInbound`+`WhatsAppPendingItem` (SystemData `wapend_{contactKey}`) + `IWhatsAppPendingInboundStore` (ETag append/replace, idempotent on wamid, **ordered**, unions candidate businessIds; AppendAsync THROWS on exhausted retries; `PendingInboundTtlSeconds`=1h). On `AskWithList` the processor buffers the inbound (text + media refs, media held pre-3.9) + raises the **interim ambiguous admin alert** (until the 4.3 list-send lands); on `ListSelection` it flushes buffered items in order then clears. DI Singleton (Functions).
- **Read receipts (§9.7-F, 6.6):** `WhatsAppStatusProcessorFunction` `read`→`HandleReadReceiptAsync`→`waconv_` lookup→`SignalRHttpClient.NotifyConversationReadAsync`→NEW API `POST /api/v1.0/internal/notifications/conversation-read` (`InternalNotificationTriggerController`, X-Internal-Api-Key, +`IConversationService`) which **mirrors `ConversationController.MarkAsRead`**: `MarkAsReadAsync(conversationId, customerId)` (marks the provider's messages read) + `NotifyConversationReadAsync(provider,…)` ⇒ provider sees "read" live + persisted `isRead`. **Reuse the in-app path — no new Message schema** (user decision). Functions has no direct SignalR ⇒ HTTP to the API (same as DirectMessageReceived). `SignalRConversationReadRequest` DTO.
- **NOT YET (plan SESSION 14 §D/§E):** STEP 3.9 media inbound; STEP 4.3 interactive-list SEND (mockup-first; AskWithList admin-alerts as interim) + L1 prefill decode (with 6.2); STEP 6 6.2/6.3/6.5 (mockup-first); STEP 12 final suite RUN + ESLint + full quality audit.

## Phase 2 — s15→s17: media inbound + disambiguation-list + chat-window + Open-Page wa.me + notification toggle (Phase-2 coding COMPLETE 2026-06-02)
- **3.9 media inbound (s15):** `IMessageService.IngestInboundExternalMessageAsync` extended with an optional `ExternalInboundAttachment`; the service writes the Pending `MessageAttachment` + posts `MediaDerivativeQueueMessage` (`{conversationId}_{messageId}`); caps via bounded `WhatsAppSettings` media/doc max-bytes; oversize/disallowed ⇒ ack-no-attach (caption still ingests). WhatsApp is the 7th media-derivatives parent.
- **4.3 disambiguation-list SEND (s16):** `WhatsAppMessageKind.InteractiveList` + `IWhatsAppService.SendInteractiveListAsync` (Meta `interactive/list`, defensive Meta-limit truncation, ≤10 rows). `AskWhichProviderAsync` always buffers, then window-gates: ≥1 candidate window open ⇒ send the list (rows by `LastInboundAt`, localized by `PreferredLanguage`, + "none of these" `wa_other`→escalate); none open ⇒ interim ambiguous admin alert. New `WhatsAppInboundRouteKind.EscalateSelection`.
- **6.5 chat window banner (s16):** nullable `ConversationResponseDto.WindowExpiresAt` set ONLY in `ConversationService.GetByIdAsync` (provider-view-only, ~1-RU point-read; LIST path untouched). Partner inbox badge + 24h-window banner (open/expiring<3h/closed=informational, NO timer); user badge only. `IWhatsAppContactRepository` optional ctor dep.
- **6.2 Open-Page wa.me (s17):** `WhatsAppOpenPageLink.TryParseSlug` (`clinqetshared/Constants`) + Scoped `IWhatsAppProviderLinkResolver` (AppDbContext, friendlyName/userNumber→businessId==UserNumber, mirrors AuthService, respects the IsActive query filter) + processor `TryHandlePrefillFirstContactAsync` (resolver **L1**; in `Run` after `ResolveContactAsync`, before `_resolver.ResolveAsync`; gated on empty `InteractiveReplyId` so L3 selections win) + `EnsureContactForInboundAsync`. Frontend wa.me button in `businessProfile.jsx` (after Message; number from `support_contact/userapp`; prefill = localized opener + clean friendly URL `${FrontHostingURL||origin}/${friendlyName||businessId}`). **`WhatsAppConsentService.RegisterInboundConversationAsync` now CREATES the context when missing** (a first-contact-via-link / expired reply-context had no pre-existing context ⇒ the 24h window never opened) — previously no-op'd.
- **6.3 notification master toggle (s17):** `CategoryMetadataDto.WhatsAppEligible` (from `IsWhatsAppEligible`, decides whether to SHOW the card) + `CommunicationPreferenceDto.WhatsApp{eligible,optedIn,hasPhone,phoneMasked}` via `CommunicationPreferenceService.EnrichWhatsAppAsync` (Identity API — has the SQL phone + `IWhatsAppConsentService`; phone→E.164→`ResolveContactAsync`→`channelOptIn`; **cost-gated** on eligible+hasPhone + **fail-soft**; dispatcher gate UNCHANGED — the dispatch hot path uses `GetCategoryPreferenceAsync`, NOT `GetPreferencesAsync`). WhatsApp master card at the TOP of user `settings/notifications/page.js` + partner `Profile/Notifications.jsx` (OFF/ON+chips/no-phone→profile); writes via the existing `POST /whatsapp/consent {phoneNumber,optIn}` with the Redux profile phone. Consent stays ONE Cosmos source (`channelOptIn`) — no SQL column, no per-category.
- **STEP 12.1 (s17) — all suites RUN green:** Identity unit 639 · Functions unit 852 · API unit 3773 · API-int 939 · Identity-int 300 · Functions-int 314/315 (the 1 = pre-existing flaky analytics Parquet test, passes solo, NOT WhatsApp). ESLint 0 errors on all WA UI. Fixed pre-existing WRITTEN-not-run failures (NOT regressions): s13 SmsWebhook reflection ×5 (method moved to `BookingReplyActionService`) + s13 `ConfirmAsync` ETag-vanish rethrow; s12 Cosmos contract (`WhatsAppSendCounterRepository`→SystemData); s14 `WhatsAppPendingInboundStore` ConcurrentAppends (10 retries + jittered backoff). **STILL OPEN:** `clinqet-function-app` SKILL inventory STALE (add the 4 WhatsApp funcs + 3 queues); 7.2 [~]; 11.1 [Phase-3]; templates→Meta.

## Phase 2 — s18 (2026-06-02): STEP 12 close-out + 12.4 full quality audit — CLOSED
- **12.4 audit:** multi-agent (per-surface auditors + adversarial verify) over Phase 1+2, backend→frontend; the core verified production-ready. Fixes shipped + re-tested: `WhatsAppConsentService` cache invalidation now keys on the contact's **saved** bsuid/phone (a linked id the caller omitted was leaving a stale dispatcher-consent cache ≤15 min) [+regression test]; PII masking added to several dispatcher / `RoutingSmsService` / `BookingReplyActionService` / `AuthService`-OTP logs (`.MaskEmail()`/`.MaskPhoneNumber()`); NEW **`AdminAlertType.WhatsAppWabaTierReached`** (the WABA tier monitor was reusing `WhatsAppSendCapReached`) + all WhatsApp alert types made filterable in admin `AlertsPage`; partner `WhatsAppChannel.jsx` pill colour aligned to `#e9fbf1` + dot `title`/`aria-label` localized via `useIntl`.
- **Assessed + deliberately KEPT (with reasoning):** Meta cancellation→`isRetryable:true` is correct for the SB processor (host-shutdown ⇒ abandon→retry WhatsApp, not SMS-fallback); status-callback duplicate processing is idempotent-in-effect and all 3 WA queues have `requiresDuplicateDetection:false` (a `messageId` change is inert; per-status Cosmos idempotency isn't cost-justified §0.11); admin-app English toasts + real-identifier display are admin-internal (§3.6 / §9.7-B).
- **Verification:** infra+functions build 0-err; affected suites green (API-WhatsApp 256 · API-dispatcher 18 · Functions-WhatsApp 77 · SmsWebhook+BookingReply 28 · Identity 639); ESLint 0 on changed UI.

## Phase 2 — s19 (2026-06-02): Meta template submission file — all 24 reviewed + verified
- **Deliverable `whatsapp/META_TEMPLATE_SUBMISSION.md`** — the single submit-ready spec for all 24 Meta templates (per-template Cloud-API `POST /{WABA-ID}/message_templates` JSON + WhatsApp-Manager fields + `{{n}}`→key→meaning→sample + hi/gu/ja drafts). Built via a multi-agent trace+adversarial-verify workflow over the 3 appsettings `WhatsApp:Templates` + every dispatch site + `WhatsAppTemplateRegistry.BuildSend` + `MetaWhatsAppService.BuildRequest`.
- **Decisions resolved (best-practice, file §1):** (1) topology = **ONE Meta App** (1 App Secret, 1 business verification, 1 System-User token) **+ TWO per-region WABAs (IN+CA)** with per-WABA `override_callback_uri` → region webhook — the only way to satisfy the per-stamp-webhook data-locality invariant; submit the set to BOTH WABAs (byte-identical). (2) URL-button host = **geo-routed canonical PROD** (`www.clinket.com` / `business.clinket.com`) — user click → FD geo-routes; orthogonal to the per-region (server-side) webhook. (3) `clinket_cart_reminder` = DO-NOT-SUBMIT-YET (§7). (4) **`clinket_review_received` + `clinket_account_invite` get STATIC URL buttons** (`/dashboard/profile/reviews`, `www.clinket.com`) — no send-time param ⇒ ZERO code change, fixes the "tap but no button" UX gap.
- **Finding (honest):** `clinket_invoice_reminder`, `clinket_quote_awarded`, `clinket_payment_received` are registered + `WhatsAppTemplateNames` constants + parity-covered but have **NO dispatch site** (grep-confirmed) — submit-ready, fire only once wired. Customer app has **no `/invoices/[id]` route** (invoices live in `/bookings/[id]`; invoice PDF = DOCUMENT header) ⇒ invoice URL-button target flagged. Provider `booking_new`/`booking_confirm_needed` use the PROVIDER host (`/dashboard/bookings/`). All 24 param-counts/buttons/headers/categories/languages verified vs config; API↔Functions Templates byte-identical; en-only `ApprovedLanguages` (hi/gu/ja drafts = native-review-before-Meta). Updated `TEMPLATE_INVENTORY.md` + `TEMPLATE_TRANSLATIONS.md` to match.
- **s19 follow-up (user decisions — CODE CHANGED):** **REMOVED** `clinket_invoice_reminder` + `clinket_payment_received` + `clinket_quote_awarded` (out of scope — no payment collection; invoice reminders unused; customer award-confirmation dropped since the provider's award template covers it) from config ×2 + `WhatsAppTemplateNames` + docs. **DROPPED** the `clinket_invoice_ready` URL button (no customer `/invoices/[id]` route — the PDF DOCUMENT header IS the invoice): removed `ButtonUrlParamKey` + the `invoiceId` dispatch key (`InvoiceEmailProcessor`) + its test assert. **RENAMED** `clinket_broadcast_won` → `clinket_quote_accepted` (template + `WhatsAppTemplateNames.BroadcastWon`→`LeadWon` + `BroadcastStatusUpdateFunction` dispatch + its test); the **`NotificationType.BroadcastWon` enum + its localization/TTL/preference/frontend keys are UNCHANGED** (backend `Broadcast*` stays code-only). **Re-audit (whole template set): removed the last orphan `clinket_cart_reminder` from config** (unwired — `CartReminderProcessorFunction` is email/in-app only; kept as a §7 Phase-3 spec). Both `WhatsApp:Templates` now hold **18 byte-identical wired entries** (+2 AUTH in Identity = **20 active, every one mapped to a verified live dispatch site** — new `META_TEMPLATE_SUBMISSION.md` §2.1 Wiring map). Grep-verified **ZERO** stale template/constant refs in any `.cs`/`.json`. Green: API build 0-err · API-WhatsApp 256/256 · InvoiceEmailProcessor 20/20 · BroadcastStatusUpdateFunction 25/25; both appsettings valid JSON.

## Phase 2 — s20 (2026-06-03): cold-inbound "Explore services" onboarding (Task A) + hybrid ghost account (Task B)
- **Task A — onboarding CTA-URL (replaces the deleted `clinket_account_invite` register nudge):** NEW `WhatsAppMessageKind.InteractiveCtaUrl` + `IWhatsAppService.SendInteractiveCtaUrlAsync` (Meta interactive `type:"cta_url"`, `action.name="cta_url"`, `parameters{display_text≤20,url}`, body≤1024/footer≤60 truncated defensively) + `WhatsAppNotificationMessage.CtaUrl` (`WhatsAppCtaUrl{Body,ButtonText,Url,Footer?}`) + outbound-processor branch (free, not counted against the send cap). Free-form **session message** — the cold inbound just opened the 24h window ⇒ free, no template/Meta approval. `HandleColdInboundAsync` sends `clinket_chat_welcome` (template, guaranteed) THEN the CTA-URL nudge via `SendOnboardingNudgeAsync`, **once** (`RegisterPromptedAt` guard, marks only when actually enqueued), gated on OptedIn+!Blocked + `WhatsAppSettings.OnboardingExploreUrl` set + copy present. **No forced signup** — button = "Explore services" → home page (`OnboardingExploreUrl`, geo-routed canonical, region-independent; Functions appsettings + class default `https://www.clinket.com/`). Copy = localization keys `WhatsApp_Onboarding_{Body,Button,Footer}` in `en.json`. ⚠️ **Backend has ONLY `en.json`** (Functions has no `Localization` section; API lists langs but the hi/gu/fr files don't exist) ⇒ hi/gu/fr fall back to en until backend i18n files land (pre-existing gap; affects the disambiguation copy too). hi/gu/fr drafts captured for that future.
- **Task B — hybrid ghost account (user-approved):** cold inbound with a **phone** now find-or-creates the system `Customer` (SQL `UserProfile` via `CreateSystemCustomerAsync(email:null,phone)` `IsSystemGenerated=true`, dedupe by email/phone + `EnsureCosmosCustomerAsync`), linked onto the `WhatsAppContact` in ONE write (`RecordConsentAsync` `CustomerId`/`UserId`) — `TryCreateGhostCustomerAsync`. Mirrors the provider-context `ResolveCustomerIdAsync`. **Async** (SB Functions worker, off the API request path ⇒ no perf impact). **BSUID-only → Cosmos-lead only** (SQL has no BSUID column). `WhatsAppContact` is **permanent (no TTL)** + merges via the phone↔BSUID alias when both co-occur on one event (webhook/first-send `LinkIdentifiersAsync`); if they never co-occur a §2.1 dual-era split is the honest edge. **Backfill on real signup = existing `AuthService` claim** by phone ([AuthService.cs:506‑525]) or email ([:350‑403]) — flips `IsSystemGenerated=false`, **preserves `UserNumber`**, re-attaches the WhatsApp thread → fills the ghost, never duplicates. Precedent: the booking/CRM ghost (`CustomerIdentitySyncProcessor`, email-anchored) does the same.
- **Cleanup:** `clinket_account_invite` doc residue removed/superseded (TEMPLATE_INVENTORY #13, TEMPLATE_TRANSLATIONS #22, META_TEMPLATE_SUBMISSION); the s13 §7.7 line + the `RegisterInviteTemplate`/`clinket_account_invite` mentions above are superseded by this block (those settings/templates no longer exist). `RegisterPromptedAt` field comment + `MarkRegisterPromptedAsync` XML repurposed to "onboarding nudge".
- **Tests (written; run green):** Functions WhatsApp unit **81/81** (+6: outbound `cta_url` success + missing-url DLQ; cold-path ghost phone-present vs BSUID-only no-ghost; onboarding once-guard enqueue + skip-when-already-prompted); API WhatsApp unit **259/259**. Build 0-err. (No MetaWhatsAppService payload unit test added — the Meta wire builders have no existing unit-test harness; the branch is covered via the outbound-processor test, matching the existing pattern.)

## Phase 2 — s21 (2026-06-04): block-bookkeeping robustness (a) + cold-inbound re-engagement (b) — no more silent drop
- **(a) Deliverability-block auto-expire is now deterministic + serializer-proof:** NEW `WhatsAppContact.blockedAutoExpireAt` (DateTime?), decided ONCE at block time — `RecordDeliveryFailureAsync` sets `blockedAt + AutoExpireBlockAfterHours` for a threshold code, **null** for an immediate code or `AutoExpireBlockAfterHours<=0`; `BlockAsync` sets null (admin-only). `IsSendSuppressedAsync` reads it DIRECTLY (null ⇒ suppress forever; future ⇒ suppress; past ⇒ `AutoExpireBlockAsync` clears + allows) and **no longer re-derives "immediate vs threshold" from `blockedErrorCode`** — a missing/legacy code can never flip a 131050 opt-out block into an auto-expiring one. `blockedErrorCode` kept diagnostic-only; `blockedAutoExpireAt` cleared on Unblock/AutoExpire alongside the other block fields. Admin `WhatsAppContactAdminDto` exposes it. **Root cause of the live dev doc's null `blockedErrorCode`: an OLDER deployed build (current code always sets it) — the new stored-decision field removes the read-time dependency entirely.** No `cosmosindexsetup` change (point-read field).
- **(b) Cold inbound no longer silently drops opted-out/blocked contacts** (`WhatsAppInboundProcessorFunction.HandleColdInboundAsync` split): **OptedOut** ⇒ STILL no auto-re-opt-in (durable STOP), but the inbound opened the 24h window ⇒ send ONE in-window **re-opt-in prompt** — free-form `SessionText` (no template/Meta-approval; the window is always open right after an inbound), copy `WhatsApp_ReOptIn_Body` ("reply START"), debounced once-per-opt-out-episode via NEW `WhatsAppContact.reOptInPromptedAt` + `IWhatsAppConsentService.MarkReOptInPromptedAsync` (re-armed: `RecordConsentAsync` clears it whenever it records a non-OptedOut status). **Blocked-but-OptedIn** ⇒ the inbound PROVES reachability ⇒ `UnblockAsync(actor "wa-inbound-reengagement")` clears the stale deliverability block, then the normal cold greet (consent + alert + welcome) runs. Re-opt-in stays explicit (START in the webhook).
- **Outbound gate exception (the one sensitive send-path change):** NEW `WhatsAppNotificationMessage.ConsentExempt` (default false). `WhatsAppOutboundProcessorFunction` resolves `consentContact` unconditionally (post-send failure-streak reset still needs it) but wraps the opt-out/block abort in `if (!message.ConsentExempt)` — so the re-opt-in prompt is the ONLY message that bypasses the gate to reach an OptedOut contact (it IS the opt-in mechanism, sent in-window in reply to their own inbound). Zero blast radius: nothing else sets the flag.
- **Tests (written; RUN GREEN):** Functions WhatsApp unit **103**, API WhatsApp unit **296** (consent **60**), API dispatcher **18**, API WhatsApp integration **15** (incl. NEW real-Cosmos round-trip of `blockedAutoExpireAt` + the `reOptInPromptedAt` debounce re-arm). Replaced the old silent-drop theory test with the three re-engagement scenarios. i18n: en-only (backend has only `en.json` — pre-existing gap; hi/gu/fr fall back to en).

## Tests (mandatory, CLAUDE.md §0.8)
Unit + integration; add a `MockWhatsAppService` (mirror `MockSmsService`). Cover: dispatcher gating, template+language fallback, consent flip + cache invalidation, `X-Hub-Signature-256` verify, outbound idempotency, OTP channel branch (verify/JWT untouched), BSUID resolution + linkage, E.164 normalizer, router window decisions, inbound webhook→conversation ingest→SignalR, no-account round-trip, media both ways.

## Open product decisions (don't silently decide — plan §17)
Transactional opt-in default per jurisdiction (India DPDP); marketing-on-WhatsApp at launch?; `clinket_cart_reminder` category (Meta may force MARKETING); fr-CA for Quebec?; Meta verification owner; verify live India marketing rate.

## Phase 2 -- s22 (2026-06-04): provider-direct WhatsApp button + block-source + sender-typing (no wrong-type ghost)
- **Business model reframe (LOCKED):** Clinket is a per-provider SUBSCRIPTION SaaS, NOT a commission marketplace -> the customer->provider WhatsApp goal is fastest lead + fastest answer; disintermediation is NOT a concern. Drove the provider-direct decision below.
- **A -- provider-direct button:** there is NO reliable Meta Cloud-API way to check if a number has WhatsApp (the /v1/contacts lookup was On-Premises-only, sunset Oct 2025) -- verified vs Meta docs; do NOT build a pre-flight check. Instead: NEW `WhatsAppSettings.RouteToProviderNumber` (bool, default true) = deterministic kill-switch (set false -> ALL provider pages route to the shared number, no code change). `PublicBusinessProfileDto.WhatsAppDirectNumber` (nullable) computed in `BusinessProfileController.GetMyPublicBusinessProfile` = `PhoneNumberNormalizer.ToE164OrNull(profile.PhoneNumber, profile.CountryCode)` when flag on + phone present (mirrors ReviewService's proven provider-send normalization), else null. Customer `businessProfile.jsx` branches: direct (provider number) -> ICE-BREAKER prefill `businessProfile.WhatsApp.DirectPrefill`; else shared support number -> existing `businessProfile.WhatsApp.Prefill` + friendly-URL ref. Lead attribution added to the `trackNav` metadata (mode: provider_direct|shared, businessId). NO BusinessProfile schema change, NO provider toggle UI.
- **D -- block-source discriminator:** NEW enum `WhatsAppBlockSource {Deliverability, Admin}` + `WhatsAppContact.BlockSource` (default Deliverability). `BlockAsync`->Admin, `RecordDeliveryFailureAsync`->Deliverability. `WhatsAppInboundProcessorFunction.HandleColdInboundAsync` REORDERED: admin block -> IGNORE the inbound entirely (no unblock/prompt/greet/ghost -- a sender can never self-clear a manual abuse block) -> deliverability block -> UnblockAsync (inbound proves reachable) -> opted-out -> re-opt-in prompt. Admin `WhatsAppContactAdminDto` + admin `AlertsPage.jsx` filter expose BlockSource / the new alert.
- **B -- sender-typing (no wrong-type ghost):** NEW `IBookingReplyActionService.ResolveProviderBusinessIdByPhoneAsync` exposes the existing partition-safe SQL exact-match provider lookup (UserType.Partner, BusinessId = UserNumber). Cold path: a phone that resolves to a registered provider -> NEW `AdminAlertType.WhatsAppProviderInbound` (`FailureNotificationHelper.HandleWhatsAppProviderInboundAsync`) + return -> NO customer ghost. BSUID-only (no phone) already creates no SQL ghost (existing TryCreateGhostCustomerAsync phone-null guard). Known-customer/context path unchanged.
- **C -- ghost reconciliation ALREADY WORKS (no AuthService change):** verified AuthService phone-claim ([:505-552]) updates the SAME row, preserves Id + UserNumber, adds Customer OR Partner per AppType (dual-type). The phone-keyed WhatsAppContact already holds that UserNumber (CustomerIds) + Id (UserId) -> the thread reattaches with ZERO sync. Unmatchable edges (register with a totally different phone / two ghosts from different identifiers) have no shared key -> operational/admin merge, not a regression. SQL: Email/NormalizedEmail unique (filtered, non-null); a phone is unique only once PROVEN (auth-sessions §11), a typed one may repeat.
- **E (opt-out inbound):** no change -- current handling is already legally correct (honor STOP; one debounced re-opt-in prompt; never auto-resubscribe proactive sends).
- **Tests/verify:** API + Functions build 0-err. Functions WhatsAppInboundProcessor unit 50/50 (incl. NEW admin-block-ignored + provider-sender-no-ghost). API WhatsAppConsentService (+BlockSource asserts) + BusinessProfileController (+new ctor arg + NEW WhatsAppDirectNumber test) green. ESLint 0 on businessProfile.jsx + admin AlertsPage.jsx. i18n: businessProfile.WhatsApp.DirectPrefill uses a react-intl defaultMessage; hi/gu/ja keys to be added by the user.

## Phase 2 -- s23 (2026-06-05): provider self-service MENU (supersedes s22 silent-provider) + identity refactor CustomerIds->UserNumber
- **Supersedes s22 B:** a Partner/Both number messaging the shared line (cold, no active chat) now gets an interactive **list menu**, NOT silent+alert. `ResolveProviderBusinessIdByPhoneAsync` **REPLACED by `ClassifyByPhoneAsync`** -> `WhatsAppPhoneClassification{UserNumber,PreferredLanguage,UserType}` (aggregates roles across all profiles on a phone -- a typed phone may repeat; prefers a Partner profile's UserNumber). "Everyone gets a reply unless STOP/blocked."
- **Identity refactor (user-approved):** `WhatsAppContact.CustomerIds` (List) **REMOVED -> single `UserNumber`** (== customerId AND/OR businessId, same SQL column; dual-type single profile = one value) + NEW `ContactUserType` enum `{None,Customer,Partner,Both}` + `ProviderMenuSentAt`. Cached classification = **zero SQL on repeat inbound + BSUID-era-proof** (no phone needed once cached). Migrated 3 prod sites: consent `LinkCustomerIdentity` (sets UserNumber if blank + merges Customer role), inbound `ResolveCustomerIdAsync` (gated on `HasCustomer()`). `WhatsAppContactUserTypeExtensions` {HasCustomer,HasPartner,ToContactUserType,Merge}.
- **Flow (`WhatsAppInboundProcessorFunction`):** booking-reply -> **`TryHandleProviderMenuSelectionAsync`** (`partner_*` InteractiveReplyId, unambiguous, BEFORE resolver -> CTA-URL drill-down) -> resolve -> prefill -> resolver -> cold. Cold provider branch (`ClassifySenderAsync` cached-role-wins-else-1-SQL): `HasPartner` -> `HandleProviderColdAsync` (debounce `ProviderMenuSentAt` < `ProviderMenu.ThrottleHours`(12); suspended/inactive profile -> support-only reply; else interactive list; then `IWhatsAppConsentService.RecordProviderMenuSentAsync` = ONE write caches identity+roles+lang+stamp). **NO customer ghost from a provider number.** Dual-role **Both** -> combined menu (provider sections + `partner_browse` row -> `OnboardingExploreUrl`). **Active customer chat ALWAYS wins** (resolver returns RouteToBusiness, never Cold -> menu never triggers). Support tap/suspended -> `HandleWhatsAppProviderInboundAsync` alert (the ONLY menu interaction that alerts).
- **Menu structure** = `WhatsAppProviderMenu` constants (clinqetshared/Constants): sections (Your work/Your business/Customers & help [+ "Looking for a service?" for Both]); rows -> VERIFIED partner routes (leads, myQuotes, bookings, profile/manage-services-price, profile/offers, profile/portfolio, customers); support row no-route. Deep-link base reuses `QRCodeSettings.PartnerBaseUrl`.
- **Meta:** `WhatsAppInteractiveList` += `Header/Footer/Sections` + `WhatsAppInteractiveRow.Description`; `MetaWhatsAppService.BuildListRequest` renders multi-section + header(text) + footer + row description (10-row TOTAL cap + truncation defensive; wire already had Sections). Outbound `missingPayload` allows sections-only.
- **Config:** `WhatsAppSettings.ProviderMenu {Enabled=true, ThrottleHours=12, SupportUrl=""}` -- **Functions appsettings ONLY** (API never sends the menu; class defaults mirror). All copy = `WhatsApp_ProviderMenu_*` keys in `en.json` ONLY (hi/gu/ja fall back to en via LocalizationService default-lang fallback -- no raw keys; user adds translations pre-prod).
- **Tests GREEN:** Functions unit 900 (+10 new: menu sent/cached-no-ghost, cached-role-no-SQL, debounce, dual-role combined, suspended support, toggle-off alert, selection leads-CTA, support tap+alert, unknown-row safe); API unit 3832; Functions WhatsApp integration 5. Builds 0-err. DEFERRED: SupportUrl real help-centre value; hi/gu/ja copy.

## Phase 2 — s24 (2026-06-05): SQL phone E.164 canonicalization + country-agnostic search-key lookup (fixes the dual-role WhatsApp misclassification)
- **Live bug:** a Both (Customer+Partner) user who messaged the shared WhatsApp line was misclassified as a COLD CUSTOMER and a DUPLICATE ghost was created — because registration stores the phone **raw national** (`RegisterDto.PhoneNumber` is `[StringLength(10)]` + a separate `CountryCode` ISO/dial), while WhatsApp/SMS produce **E.164** (`+12896981655`), and `ClassifyByPhoneAsync` + ghost-dedup did an EXACT `PhoneNumber == <E.164>` match → never matched the national-stored Both account.
- **Root fix (storage = canonical, the "always" guarantee):** NEW `AppDbContext.SaveChanges`/`SaveChangesAsync` **override** (`NormalizeUserPhones`, normalize-BEFORE-base so base's DetectChanges picks up raw→E.164 even on already-Modified rows) stores `UserProfile.PhoneNumber`/`SecondaryPhoneNumber` as **E.164** and maintains NEW indexed `PhoneSearchKey`/`SecondaryPhoneSearchKey` (last-10 significant digits) on EVERY insert/update. All 3 hosts + test factories go through `AddAppDbContextPooled`, so registration / external login / phone-change / system-ghost-create cannot persist a raw phone. Per-entity try/catch ⇒ a bad phone never blocks a save; logger resolved null-safe via EF infrastructure (a pooled ctx cannot inject one).
- **`PhoneNumberNormalizer`:** `ToE164` now parses via **libphonenumber-csharp 9.0.31** (region from the ISO/dial `CountryCode`; keeps `+`-passthrough idempotency; heuristic fallback on `NumberParseException`) — fixes the India "national number that begins with the dial-code digits 91" mis-prefix the old `digitsOnly.StartsWith(dialCode)` heuristic produced (it dropped the country code). NEW `ToSearchKey(phone)` = last-10 digits (country-agnostic; national `2896981655`, E.164 `+12896981655`, and `(289) 698-1655` all collapse to `2896981655`; null when <7 digits).
- **Lookups (country-agnostic, indexed, NO leading-wildcard LIKE scan):** NEW `UserProfilePhoneLookup.FindByPhoneAsync(IQueryable<UserProfile>, typedPhone)` → `PhoneSearchKey == ToSearchKey(input) && IsActive`. Wired into EVERY typed-phone SQL lookup: phone-login (`AuthController.LoginThroughPhone`), account-unlock / MFA-verify / forgot-password / password-reset / passkey-auth / passkey-discovery / passkey-challenge (`AuthService`), admin `LoginAttemptController`, registration phone-claim + email-claim search-key compare + phone-change dup-check. WhatsApp `ClassifyByPhoneAsync` + `FindProviderByPhoneAsync` (booking-reply CONFIRM/DECLINE — `channel` param removed, exact+fuzzy-LIKE collapsed to one indexed search-key match) + SMS-opt-out `FindUserByPhoneFlexibleAsync` + ghost-dedup `CustomerIdentityService.FindAllMatchingProfilesAsync` ALL switched to the search key. **The free-text login field has NO country code ⇒ the search key (NOT `ToE164`) is the only correct cross-format match** (an Indian national + no country code would mis-default to +1). **NO UI change** — login UX unchanged; the search key is purely backend.
- **JWT `MobilePhone` claim + profile API now expose E.164** (consistent with storage; also feeds the WhatsApp consent flow, which keys on the E.164 doc).
- **Migration `AddUserPhoneSearchKey`** (2 nullable `nvarchar(15)` cols + 2 filtered non-unique indexes). Pinned `Microsoft.EntityFrameworkCore.Design` 10.0.8 in `clinqetinfrastructure.csproj` (Tools' loose floor otherwise resolved Design 8.0.0 → `dotnet ef` MissingMethodException); bumped `.config/dotnet-tools.json` ef tool 10.0.5→10.0.8; added `AppDbContextDesignTimeFactory` for deterministic migration generation. DEV: no backfill (delete/recreate).
- **Tests GREEN:** Unit — Identity 657 / Functions 902 / API 3848 (hook Added/Modified/sync/async/idempotent/ISO+dial/null/secondary/non-user/malformed-safe; `ToSearchKey`; ghost-dedup-no-duplicate; login async-mock helper + SmsWebhook reflection-arg fix; raw-phone asserts updated to E.164). Integration — Identity 303 (register national+`"CA"` → SQL `+12896981655` + key), Functions WhatsApp **7** (real-SQL hook + real `ClassifyByPhoneAsync("+12896981655")`→Both + cold dual-role-provider inbound → NO ghost + cached Both identity), API 942 (the lone analytics-Parquet failure passes solo — pre-existing flaky, unrelated). Builds 0-err.
- **Closes** the s22/s23 ToE164-heuristic open item (libphonenumber is now the parser). Search-key last-10 assumes a ≤10-digit national number (CA/IN/US — correct for the supported regions). Secondary phone gets a key+index for symmetry though no lookup targets it today.

## Phase 2 — s25 (2026-06-05): provider-menu `{0}` leak fix + send-time placeholder guardrail + primary-role menu ordering
- **Live bug:** a dual-role (Both) user tapped the provider menu **Leads** row and got the raw token *"Customers are waiting, {0} — fast replies win more jobs."* Root cause: `WhatsAppInboundProcessorFunction.SendDrillDownAsync` resolved the reply body via `GetLocalizedString` and sent it WITHOUT `string.Format`; only `WhatsApp_ProviderMenu_Leads_ReplyBody` carries a `{0}` (= business name, per the `ReplyBodyKey` constant comment). `MetaWhatsAppService` sends free-form bodies VERBATIM (truncate-only) ⇒ the token shipped. **Audit (3 agents + direct reads):** transactional templates are SAFE — every body / `ButtonUrlParamKey` / document param flows through `WhatsAppTemplateRegistry.RequireParam` (throws → DLQ + alert) and Meta substitutes `{{n}}` server-side; the keys that looked "extra" (`bookingId`/`leadId`/`quoteId`/`reviewTarget`) are each template's `ButtonUrlParamKey`. The only ACTIVE free-form leak was this one drill-down. 3 template-param FALLBACK localization values (`WhatsApp_BookingCancelled_NoReason`/`WhatsApp_Lead_LocationFallback`/`WhatsApp_Invoice_DueOnReceipt`) are placeholder-free today but unformatted (latent).
- **A1 source fix:** `SendDrillDownAsync` now point-reads the provider name (`IBusinessProfileRepository`) and `SafeFormat`s the body; NEW `WhatsApp_ProviderMenu_Leads_ReplyBody_NoName` + `WhatsAppProviderMenu.ReplyBodyNoNameKey()` no-name fallback (no dangling `, —` when the name is blank); NEW `ResolveCopy` **key-echo guard** (a missing/typo'd key makes `GetLocalizedString` echo the key ⇒ treat as null, never ship a raw key) on drill-down + support; `SendReplyAsync` degrades to plain `SessionText` when the button label is missing (never an invalid CTA).
- **A2/A3 send-time guardrail (defense behind the source fix):** NEW `WhatsAppPlaceholderGuard.Sanitize` (`clinqetshared/Utilities`; regex `\{\d+\}`; strips token + tidies whitespace; reports tokens). `WhatsAppOutboundProcessorFunction.SanitizeOutbound` runs it over EVERY user-visible field before send (SessionText; CtaUrl Body/ButtonText/Footer; InteractiveList Header/Body/ButtonText/Footer/SectionTitle + row Title/Description; **template-data param VALUES**) — strips, sends the cleaned copy, and raises NEW `AdminAlertType.WhatsAppPlaceholderLeak` via `FailureNotificationHelper.HandleWhatsAppPlaceholderLeakAsync` (full debug metadata: recipient/canonical pk, UserNumber, businessId, conversationId, chatMessageId, kind, template, leaked field, raw value, tokens, region, SB MessageId). URLs / row-ids left untouched. Build-time lint `WhatsAppCopyContentTests` (Functions unit; mirrors `SmsTemplateContentTests`, reads the output-copied `en.json` with comment-tolerant JSON) drives off the REAL `WhatsAppProviderMenu` structure: every referenced key exists (kills key-echo) + any `{0}` drill-down body MUST have a placeholder-free `_NoName` variant + the 3 fallbacks + free-form session keys are placeholder-clean.
- **B primary-role menu ordering (user ask):** a Both user's first/primary role now orders the combined menu. `ClassifyByPhoneAsync` (`BookingReplyActionService`) computes `PrimaryUserType` = the role of the earliest `UserUserType.CreatedAt` (ZERO migration — a Both user is one `UserProfile` + two timestamped `UserUserType` rows; correlated-subquery projection); `WhatsAppPhoneClassification.PrimaryUserType` added; cached on NEW `WhatsAppContact.PrimaryUserType` (Cosmos, schemaless) via `RecordProviderMenuSentAsync` (NEW param, first-wins/immutable) ⇒ repeat inbound orders with zero SQL. `BuildProviderMenu`: **Customer-primary Both ⇒ leads with the "find a service" (customer) section + a neutral greeting** (NEW `WhatsApp_ProviderMenu_{Header,Body,BodyNoName}_Customer` keys); else provider sections first (Browse last). Partner-only / Partner-primary unchanged. "Active customer chat ALWAYS wins" still pre-empts the menu (resolver returns Route/Ask before Cold) — documented, not a bug.
- **C edge hardening:** `MetaWhatsAppService` logs when an interactive list exceeds Meta's 10-row cap (`MetaListRowCap` const replaces the magic `10`; `CountRequestedRows`) so a future row addition can't silently drop the cross-role row (Both = 9 rows today).
- **Tests GREEN:** Functions unit **932** (+ guard / copy-lint / ordering / no-name / strip-alert; signature-driven Moq + consent-test updates), API WhatsApp unit **323** (consent `PrimaryUserType` assert; `MetaWhatsAppServiceTests` cover the truncation log), Functions WhatsApp integration **22** (real-SQL `ClassifyByPhoneAsync` primary-role). Builds 0-err. i18n: en-only (hi/gu/ja fall back to en — pre-existing backend gap; the new keys need translation pre-prod).
- **DEFERRED (mockup-first §9.6):** a CUSTOMER self-service menu (parallel to the provider menu) for cold Customer/Both inbound + a richer Both two-level menu + an optional `MENU`/`HELP` keyword — proposed in the plan, gated on a mockup + sign-off. Larger known-open backlog (consent-version ENFORCE, async-`failed`→SMS fallback, phone-recycling re-opt-in, BSUID-only customer path, backend hi/gu/ja/fr files) tracked, not built this round. Mirror this entry to .github/.agents/.cursor.

## Phase 2 — s26 (2026-06-05): customer self-service menu + primary-role menu routing (Phase D, builds the s25-deferred item)
- **Customer self-service WhatsApp menu** — NEW `clinqetshared/Constants/WhatsAppCustomerMenu.cs` (parallel to `WhatsAppProviderMenu`). A KNOWN customer (or customer-first dual-role Both) cold inbound now gets an interactive menu instead of just the welcome. Each row carries an explicit `LinkTarget` {CustomerApp→`QRCodeSettings.UserBaseUrl`, PartnerApp→`PartnerBaseUrl`, Explore→`OnboardingExploreUrl`} + RelativePath, so a row opens the customer app, the partner dashboard (the dual-role door), or Explore — WITHOUT touching the shipped provider drill-down. **Customer-only** (5 rows): Your activity (My bookings `/bookings` · My quotes `/quotes` · Messages `/messages`) + Get started (Find a service · Talk to support `/help-center`). **Customer-first Both** (7 rows, no-scroll): For you (those 4) + Your business (Leads `/dashboard/leads` · Bookings & calendar `/dashboard/bookings` · Manage my business `/dashboard`). ALL copy STATIC (no `{0}`) ⇒ zero placeholder risk; routes verified against the real apps.
- **Primary-role routing** (`HandleColdInboundAsync` restructured): a cold inbound routes by the contact's FIRST/primary role — Both+primary-Customer → customer menu (`includeProviderShortcuts:true`); Partner / Both+primary-Partner (or primary unknown) → provider menu (`BuildProviderMenu` reverted to `userType`; Both still appends the existing `partner_browse` "find a service" door); Customer-only → customer menu (no shortcuts); truly unknown → welcome + onboarding CTA + ghost (unchanged). "Active customer chat ALWAYS wins" still pre-empts the menu. NEW `HandleCustomerColdAsync` + `BuildCustomerMenu` + `ToCustomerSection` + `TryHandleCustomerMenuSelectionAsync` (`customer_` prefix, after the `partner_` handler in `Run`) + `SendCustomerDrillDownAsync` (reuses the `ResolveCopy` key-echo guard + `SendReplyAsync`). A known account gets NO ghost / NO consent flip (`RecordMenuSentAsync` only — caches identity + debounce).
- **Cleanup (no orphans):** s25's in-provider-menu customer-first ordering is SUPERSEDED by this routing ⇒ removed `BuildProviderMenu`'s customerFirst branch + the 3 `WhatsApp_ProviderMenu_*_Customer` keys + their constants. Generalized the shared menu debounce: `WhatsAppContact.ProviderMenuSentAt`→`MenuSentAt`, `IWhatsAppConsentService.RecordProviderMenuSentAsync`→`RecordMenuSentAsync`, `ResolveProviderLanguage`→`ResolveContactLanguage` (one menu-debounce per contact — a contact deterministically gets ONE menu type by its stable/cached primary role, so the shared field is correct).
- **Audit (self re-read + 2 adversarial agents):** NO bugs. Verified: routing has no fall-through/double-send; `QRCodeSettings.UserBaseUrl` IS set in the Functions appsettings ⇒ valid absolute CTA URLs; shared `MenuSentAt` is correct; no stale refs to renamed/removed symbols; all menus ≤ Meta's 10-row cap (customer 5 / customer-first-Both 7 / provider 8–9). (Both agent "confirmed" findings were false positives, disproved against the code/config.)
- **Tests GREEN:** Functions unit **936** (+ customer-only menu / customer-first-Both / 2 drill-downs / copy-lint over `WhatsAppCustomerMenu`; rewrote the 2 s25 ordering tests), API WhatsApp unit **323**, Functions WhatsApp integration **22**. Builds 0-err. i18n: en-only (the new `WhatsApp_CustomerMenu_*` keys need hi/gu/ja pre-prod). Mockup: `whatsapp/phase-d-customer-menu-mockup.html`. Mirror this entry to .github/.agents/.cursor.

## Phase 2 — s27 (2026-06-24): empty-body-param Meta 131008 fix (content-fallback chain + registry backstop)
- **Live bug:** `clinket_booking_confirm` (provider `BookingConfirmNeeded`) failed Meta **131008 ("Required parameter is missing")** → SMS fallback. Root cause: `serviceName` body param was an EMPTY string (booking had no resolvable service name — `string.Join(", ", booking.Services?.Select(s => s.ServiceName) ...)` = `""`). Meta treats empty/whitespace params as missing. Dispatch sites only guarded `null`, never empty. Data-dependent (failed one recipient, not all) ⇒ NOT a config/Meta structural mismatch.
- **Main fix — content-fallback chain (so WhatsApp SENDS with meaningful copy, not just SMS):** NEW `WhatsAppContentFallback` (`clinqetinfrastructure/Services/Communication/WhatsAppContentFallback.cs`). `ResolveBookingServiceLabel(booking, loc, lang)` = ServiceName → JobTitle → JobDescription → BookingDescription → Notes → BusinessName → localized `WhatsApp_Content_NotAvailable` ("N/A"). `ResolveBroadcastTitle(broadcast, loc, lang)` = CategoryName → Subcategories → Description → AdditionalNotes → BroadcastNumber. `FirstNonEmpty(loc, lang, params candidates)` = generic non-empty guarantor (trims, skips blanks, localized last resort). Result is ALWAYS non-empty. Wired at EVERY booking + quote WhatsApp dispatch site: `ProviderConfirmationProcessor`, `BookingCancellationProcessor` (×2 — customer + provider language), `BookingReminderProcessor`, `BookingService` (6 sites — also replaced the old `?? string.Empty` guards), `BroadcastProcessorFunction`, `BroadcastTieredExpansionFunction` (both use `message.PreferredLanguage` since the title is computed once outside the per-provider loop), `BroadcastStatusUpdateFunction` (×2, inline `FirstNonEmpty` because `provider` is nullable). The helper computes a WhatsApp-ONLY label — it never mutates the shared `servicesText` that also feeds the email body. `Broadcast` collides with a namespace ⇒ the helper fully-qualifies `Clinqet.Core.Entities.COSMOS.Broadcast`.
- **Registry backstop (systemic guarantee for ANY other empty param, e.g. `businessName ?? ""`):** `WhatsAppTemplateRegistry.BuildSend` now `return null` + warns when a resolved BODY param is empty/whitespace ⇒ graceful SMS/email fallback instead of a doomed Meta send. Distinction kept: missing KEY still THROWS (`RequireParam` → DLQ + alert, a dispatch-site bug); present-but-empty VALUE DEGRADES (→ SMS, recipient still notified).
- **Localization:** NEW `WhatsApp_Content_NotAvailable` in en/hi/gu (`fr.json` is sparse → falls back to en via LocalizationService default, consistent with the sibling `WhatsApp_*Fallback` keys). Added to the `WhatsAppCopyContentTests` placeholder-free lint `[InlineData]` list.
- **Tests GREEN:** API WhatsApp unit 413 (NEW `WhatsAppContentFallbackTests` = full booking + broadcast chain + last-resort; registry empty-body-param → null), API Booking 353, Functions touched 170 (NEW `ProviderConfirmationProcessorTests.Run_NoServices_StillSendsNonEmptyWhatsAppServiceName` → falls through to `BookingDescription`). Builds 0-err. Backend-only (no UI/ESLint). Mirror this entry to .github/.agents/.cursor.
- **s27 AUDIT pass (triple-check, 2 adversarial agents) — additional sites the first sweep missed + the `businessName` gap:** the initial sweep keyed on `servicesText` and missed `serviceName`/title at `BookingTimeoutProcessor`, `BookingAutoCompletionProcessor`, `BookingController` (×4: BookingRequested/BookingNew), `BroadcastProviderService` (quoteTitle), `ReviewService` (reviewerName→`ClaimConstants.DefaultCustomerName`) — all now use the helper. Then a systemic `businessName` gap: every booking/quote template passing `businessName ?? ""`/`?? string.Empty` is now guarded with NEW `WhatsAppContentFallback.ResolveBusinessName(loc, lang, …candidates)` → localized `WhatsApp_Content_BusinessFallback` ("the provider") at ~13 sites (BookingService ×4, BookingController ×2, BookingCancellation/Reminder/Timeout/AutoCompletion, DocumentDeliveryService ×3). **Critical silent-drop:** `BookingAutoCompletionProcessor` (clinket_booking_completed) + the 3 `DocumentDeliveryService` document sends use `SkipSms+SkipEmail(+SkipPush)` ⇒ the registry backstop has NO fallback channel there, so an empty body param = TOTAL non-delivery (only push) — those MUST resolve non-empty. Also guarded raw `customerName` in `WhatsAppProviderNotifier` (direct `whatsapp-outbound` enqueue, bypasses the dispatcher's SMS fallback) + the invoice `description` terminal in `DocumentDeliveryService`. `BroadcastProviderService` `businessName=providerName` is SAFE (`ResolveProviderDisplayName` terminates in `BusinessId`); `DocumentDeliveryService.serviceName` was already guarded by its own `JoinServices(…, fallback)`. KNOWN LOW residual (left as-is): `LeadReceived` lead-title is computed once OUTSIDE the per-provider loop with `message.PreferredLanguage` (customer lang) but feeds a provider template — only the unreachable localized last-resort renders wrong (BroadcastNumber always set). New key `WhatsApp_Content_BusinessFallback` in en/hi/gu + the copy-lint list. Verified: API+Functions build 0-err; API unit 1453, Functions unit 534, helper+registry 41 — all green.


## Billing/trial templates (Part 3, 2026-06-29)

10 provider billing UTILITY templates (en/gu/hi, both WABAs) referenced BY NAME from `WhatsAppTemplateNames` + `WhatsApp:Templates` (both appsettings, identical): `clinket_subscription_payment_failed`, `clinket_ai_billing_failed`, `clinket_payment_retry_notice`, `clinket_plan_renewal_reminder` (NO button — card on file, don't ease cancel), `clinket_plan_trial_ending`, `clinket_ai_add_payment_method`, `clinket_plan_trial_ended`, `clinket_ai_trial_ended`, `clinket_ai_minutes_low`, `clinket_ai_minutes_empty`. Static "Manage billing" URL button (apex /dashboard/billing) ⇒ NO `ButtonUrlParamKey` (no runtime button component). `BillingNotificationService` chooses the template from `(NotificationType, BillingProduct, HasPaymentMethodOnFile)`; `firstName` param = `BusinessProfile.Name` (non-empty fallback so the send isn't dropped). `BillingPayments` is now WhatsApp-eligible.

**AI auto-recharge failure template (2026-06-29):** 11th billing template `clinket_ai_autorecharge_failed` (UTILITY, `firstName` param, static "Manage billing" URL button -> apex /dashboard/billing) for a failed AI minute auto-recharge. `ApprovedLanguages ["en","gu","hi","fr"]`; SUBMITTED to BOTH WABAs in en_US/hi/gu plus **fr_CA on the Canada WABA ONLY** (Canada 1302322178177914, India 2518598361929331) -> all PENDING Meta review. Dispatched by `BillingNotificationService` for `NotificationType.MinuteAutoRechargeFailed` (also raises `AdminAlertType.BillingAutoRechargeFailed`). **Language rule for new billing templates: fr = Canada WABA only; en/gu/hi = both WABAs.** See memory `ai-autorecharge-preemptive-and-failure-alerts`.


## D8 cap-split + Free=0 + usage surface + hi/gu localization REPAIR (2026-07-11, sessions 1+2)

Owner-locked (handoff §2): the customer-facing closed-window "provider replied" notify is **CapExempt — never counted, never blocked, any tier** (D8/D11); provider-facing sends (own new-message ping + CRM outreach) are the capped perk. Ladder at the time (catalog v5, admin-editable + appsettings platform default): Free 0 / Basic 50 / Premium 200 / Max unlimited (D9) — ‼️ superseded: Free 10 (v9), and since v12 only **Free 10 / Premium 200**.

- `WhatsAppNotificationMessage.CapExempt` (router sets it on the closed-window CUSTOMER notify); `WhatsAppOutboundProcessorFunction` passes `capBusinessId = CapExempt ? null : BusinessId` into BOTH the gate check and RecordSent — the WABA monitor still counts every send (integration-proven: `WhatsAppSendGateIntegrationTests.RecordSent_CapExempt_NullBusinessId_CountsWabaOnly`).
- Gate cap semantics: **null=unlimited / 0=blocked (`WhatsAppSendDecision.PlanBlocked`) / >0 finite**; missing row/blip ⇒ platform default 250 (fail-open safety net). PlanBlocked ⇒ `RecordBlockedAsync` (day-bucketed `blk_{businessId}` marker, true exactly once per day — integration-proven) ⇒ `FailureNotificationHelper.HandleWhatsAppPlanBlockedAsync` (provider in-app+push nudge, NO admin alert) ⇒ SMS fallback unchanged. Cap-hit copy now ends with an upgrade line; new keys `Notification_WhatsAppPlanBlocked_{Title,Body}`.
- **Provider usage endpoint** `GET provider/billing/whatsapp-usage` → `{capsEnabled, unlimited, blocked, used, cap, remaining, periodKey, upgradeAvailable}`; caps-off ⇒ `unlimited:true` ⇒ meters render nothing. `upgradeAvailable` (2026-10-04) is true only for a provider with a higher plan (Free) — see "Two plans" below. UI: web billing meter + blocked nudge, web inbox at-limit strip (chat itself NEVER limited — the copy says the provider's own alerts fall back to SMS/in-app), mobile Plan & Billing row (see clinqet-payments / partner-app / provider-mobile skills).
- **‼️ Backend `hi.json`/`gu.json` REPAIRED (2026-07-11):** both files were Windows-1252 double-encoded UTF-8 (mojibake served to every hi/gu user since introduction — ~2200 values each). Fixed by cp1252-reverse-map + strict-UTF-8 fatal decode (0 unrecoverable). The two new WhatsApp keys + the updated cap-reached body now exist in REAL hi/gu (no longer en-fallback). If a future tool re-corrupts them, the signature is `à¤/àª` sequences — re-run the same repair.

- **Tier-limit admin alerts (2026-07-12):** every WhatsApp wall now pings admins with call-ready contact info via `ITierLimitAlertService` — Free plan-block (`WhatsAppPlanBlocked`, monthly dedup; fired from the processor's once-per-day blocked branch AND the CRM outreach cap-0 pre-check) and the paid daily-cap crossing (`WhatsAppSendCapReached`, enriched with name/phone/email/tier; the bare publish formerly inside `FailureNotificationHelper.HandleWhatsAppSendCapReachedAsync` was removed — that method now only sends the provider nudge and takes `(businessId, cap, upgradeAvailable)` since 2026-10-04). Paid at-cap CRM outreach still returns PlanBlocked status but raises NO conversion alert (the crossing already did). Master flag `Payments:TierLimitAdminAlertsEnabled`.

## Tier-limits final audit fixes (2026-07-16)

- **Outreach status split:** `WhatsAppOutreachStatus.CapReached` (appended, string-serialized) now distinguishes a PAID tier whose daily allowance is spent from `PlanBlocked` (Free, cap 0). `WhatsAppProviderOutreachService.InitiateAsync` returns the honest one; the web CRM toast for CapReached is `WhatsApp.Toast.CapReached` (en-US/hi-IN/gu-IN) — a paid provider whose daily allowance is spent is never told outreach "isn't in your plan".
- **Idempotency on throttles:** `WhatsAppOutboundProcessorFunction` no longer marks ANY `ProviderCap` throttle as processed (previously only cap-0 was exempt) — the deterministic CRM outreach id (`optin-{biz}-{customer}`) stays reusable the moment the day rolls or the provider upgrades. `WabaCeiling` throttles still mark (their SMS fallback, when carried, already ran). Pinned by `Run_OverCapThrottle_NoNudge_DoesNotMarkProcessed_Completes` + `Run_WabaCeilingThrottle_StillMarksProcessed`.
- **Language:** the cap-reached + plan-blocked provider notices now resolve the provider's `BusinessProfile.PreferredLanguage` (en fail-soft) — the hi/gu (and new fr) copy is live at runtime. `FailureNotificationHelper` gained an `IBusinessProfileRepository` dependency.
- **SMS-claim scrub completed:** the admin-alert stories in `TierLimitAlertService` and the processor's throttle log no longer claim an SMS fallback capped provider-facing sends don't have.
- **fr backfill:** all WhatsApp notification keys exist in `fr.json`; see clinqet-notifications for the fr email templates. (The sunset keys were deleted with the PromoSunset feature, 2026-10-04.)

## Two plans — limit copy never tells Premium to upgrade (2026-10-04)

Authority `C:\Nik\Data\two-plan-pricing\PLAN.md` (D3, D11, D12). The daily cap stays (`whatsapp_template_cap` Free 10 / Premium 200); no daily WhatsApp summary was built.

- **`UpgradeAvailable` end to end:** `WhatsAppSendGate.ResolveProviderCapAsync` returns `(Cap, UpgradeAvailable)` — true only when the provider's tier is `Free`. It rides `WhatsAppSendRecord.UpgradeAvailable` (into `FailureNotificationHelper.HandleWhatsAppSendCapReachedAsync`, which picks `Notification_WhatsAppSendCapReached_BodyUpgrade` vs `_Body`) and `WhatsAppSendUsage.UpgradeAvailable` (into `ProviderWhatsAppUsageDto.upgradeAvailable`).
- **Deep links:** the cap-reached and plan-blocked notices (`SystemNotification`, data `Type` `WhatsAppSendCapReached` / `WhatsAppPlanBlocked`) link to `BillingPagePaths.Plan` (`/dashboard/billing`); provider mobile opens Plan & Billing for both.
- **UI:** partner web `components/whatsapp/WhatsAppLimitStrip.jsx` (inbox) and provider mobile `components/whatsapp/WhatsAppLimitStrip.tsx` (chat) show the at-limit / plan-blocked strip; the upgrade wording and the plans button appear only when `upgradeAvailable` is true. The chat itself is never limited.
- **Over-quota leads:** a Free provider past the monthly `leads_quota` gets NO per-lead WhatsApp (see `clinqet-quote-lead-broadcast`).

## Localization baseline (2026-07-26)

- English is the canonical localization schema. Backend `en/es/fr/gu/hi` resources have exact key and placeholder parity, including every `WhatsApp_*` session/menu/fallback key.
- `WhatsApp:LanguageMap` is identical in API, Functions, and Identity: `en=en_US`, `es=es`, `fr=fr_CA`, `gu=gu`, `hi=hi`. Meta rejects `es_US` for templates. Japanese is removed.
- `ApprovedLanguages` records external Meta approval, not translation intent. Do not add `es` or any other locale until the exact template variant is confirmed in Meta; unapproved requested locales safely fall back to the approved default-language template.
- The repository stores template names, parameter order, buttons, and approved-language metadata, but not the authoritative Meta template body text. A complete body-copy audit therefore requires a Meta Business Manager export; config parity alone cannot certify external template translations.
- `allow_category_change=false` does not guarantee that Meta will keep a submitted template in UTILITY. If Meta reclassifies a localized production variant as MARKETING, preserve every approved production language and first submit revised wording under a non-production proof name. Proof names must be explicitly barred from runtime configuration. Delete only the affected language variant after the proof is `APPROVED / UTILITY`; then wait Meta's name-reuse cooldown and recreate that locale under the original production name with the proven wording.

## Voice material template — `clinket_info_ready` (2026-08-21, LIVE both WABAs, wired to `send_material_info`)

- **What it carries:** the "Information from {Business}" PDF the receptionist sends when a caller asks to be SENT pieces of the
  owner's material (see the voice SKILL "SEND DETAILS TO CALLERS"). UTILITY, DOCUMENT header, ONE body variable
  (`businessName`), wording reuses the approved `clinket_details_ready` openers/footers verbatim. **LIVE (APPROVED/UTILITY)
  2026-08-21:** CA en_US 1959638678056889 · es 1391867016253987 · fr_CA 1754608402246676 · hi 1826452552059240 ·
  gu 1066324103025981; IN en_US 1939834626685704 · hi 1727857885095325 · gu 27881567201500272. The eight
  `clinket_info_ready_p1_*` proofs were DELETED and verified absent. ‼️ Never delete + recreate the production name (30-day
  name cooldown); the unrelated Canada recreation plan in `C:\Nik\Data\whatsapp` keeps its 2026-08-28 guard.
- **Registration:** `WhatsApp:Templates:clinket_info_ready` in API + Functions (byte-identical — `WhatsAppTemplateConfigParityTests`)
  + MCP (the tool reads it through `VoiceMaterialSharingGate`): `ApprovedLanguages ["en","es","fr","hi","gu"]`,
  `BodyParams ["businessName"]`, `DocumentLinkKey "infoPdfUrl"`, `DocumentFileNameKey "infoFileName"`;
  `WhatsAppTemplateNames.InfoReady` (in `All`).
- **Dispatch site:** `DocumentDeliveryService.DeliverMaterialInfoWhatsAppAsync` (Functions `VoicePostCallProcessorFunction`,
  `VoicePostCallKind.SendMaterialInfo`) — the booking/invoice document rail: in-window ⇒ `SessionDocument` with caption
  `WhatsApp_MaterialInfo_DocumentCaption`, else this template; blob `provider-knowledge/_sent/{businessId}/{callId}-{refsKey}.pdf - a TOP-LEVEL prefix so the storage lifecycle rule `provider-knowledge-sent-lifecycle-policy` (delete after `invoiceDocumentRetentionDays`, like the other transactional PDFs) can address it, and the business teardown sweeps `_sent/{businessId}/` too`
  with `WhatsApp:MaterialDocumentSasExpiryMinutes` (720, Functions appsettings); CapExempt; dedup id
  `wa:VoiceMaterialInfo:{callId}:{refsKey}:{phone}`; NotificationType marker `VoiceMaterialInfo`. **NO SMS leg of any kind** —
  consent-blocked or no approved language ⇒ `Failed(...)` ⇒ forced admin alert + in-call notice, never a text.
- **Gate:** WhatsApp is OFFERED (prompt) and ACCEPTED (tool) only while the template has ≥1 `ApprovedLanguages` in config AND
  the caller has an ANI; otherwise the caller is offered email only — both sides read the ONE `VoiceMaterialSharingGate`.
  The whole feature sits behind `Voice:Knowledge:MaterialSharingEnabled` (ships ON in all three hosts - owner decision 2026-08-21; a stamp can switch it off).
- Tests: Functions `Voice/MaterialDeliveryTests` (rail contract, no SMS ever) + `VoicePostCallProcessorIntegrationTests`
  SendMaterialInfo (real Azurite + real Cosmos `wa:` dedup across redelivery).


## Voice "send me the details" template — `clinket_details_ready` (2026-07-31, LIVE both WABAs)

The receptionist's `send_service_info` tool sends a caller the provider's own PUBLIC page (an offering's, or the business's). Full feature in `clinqet-voice-assistant`; the WhatsApp-side contract is here.

- **Template `clinket_details_ready`, UTILITY, live on BOTH WABAs** — CA `1302322178177914`: `en_US, es, fr_CA, gu, hi`; IN `2518598361929331`: `en_US, gu, hi`. Config (`WhatsApp:Templates`, byte-identical in API + Functions): `BodyParams ["businessName","pageSubject"]`, `ButtonUrlParamKey "pagePath"`, `ApprovedLanguages ["en","hi","gu","fr","es"]`.
- **Body:** `Hi! As you asked on your call with {{1}}, here is everything about {{2}} in one place — photos, full description, prices and opening hours. Tap below to see it all.` · **Footer** (static) `Sent by Clinket at your request.` · **Button** URL `See full details` → `https://www.clinket.com/{{1}}`.
- **‼️ `"you asked for on your call"` is what earns UTILITY.** Meta's utility test is "a specific, agreed-upon request" — the first clause states the agreement. The pull comes from SPECIFICITY (naming the exact offering + listing what is behind the tap), never from hype: no superlatives, no offers, no "browse", no invitation to anything the caller did not ask for.
- **‼️ A dynamic URL-button variable whose VALUE contains `/` IS accepted by Meta** — `https://www.clinket.com/{{1}}` with `sparkle-salon/services/keratin-smoothing-treatment-3d4e5f6a`. Verified at creation AND through approval on both WABAs. No link-shortener / redirect route needed. Meta docs only illustrate a single trailing segment, so this was the one genuine unknown; it is now settled.
- **‼️ `allow_category_change:false` does NOT force a rejection.** Gujarati came back **APPROVED but categorised MARKETING** from a body structurally identical to the en/es/fr/hi variants that all landed UTILITY. The flag did not save it. **Therefore: never submit a production template NAME in a language you have not first proven under a throwaway name.**
- **Gujarati lexical lesson (the actual fix):** `ભાવ` reads as a market *rate/deal* → use `કિંમત` (price, the direct cognate of Hindi `कीमत`); `બધી માહિતી` → `પૂરી માહિતી`. Mirroring the Hindi wording that passed is the reliable move — Meta's Gujarati classifier is visibly weaker than its Hindi one, so structural parity with a proven Hindi variant beats independent phrasing.
- **Proof protocol used (repeat it):** submit each language under a throwaway name (`clinket_details_ready_t1_en`, `_t2`, `_t3`) → poll `GET /{waba}/message_templates?name=…&fields=name,language,status,category` until `APPROVED/UTILITY` → only then POST the SAME components under the production name → after production approval `DELETE /{waba}/message_templates?name={proof}`. ‼️ The `name=` filter is a PREFIX/CONTAINS match, so a proof named `{production}_t2` appears in the production query — always project `name` when reading status or the two get conflated. Proof names must never appear in `WhatsApp:Templates`.
- **In-window sends skip the template entirely:** an open 24h window carries the link as a FREE `WhatsAppMessageKind.InteractiveCtaUrl` (copy from `WhatsApp_Details_{Body,Button,Footer}` in `en/es/fr/gu/hi`), so the template is only paid for out-of-window. Missing/key-echoed copy degrades to the template rather than shipping an empty body (Meta 131008 class).
- **‼️ Both branches set `CapExempt = true`** — the CALLER requested it, so it is customer-benefiting (D8 "customer-is-king"). Without it a Free-tier provider's cap of 0 plan-blocks a page the customer asked for and fires an upgrade nudge at the provider. `BusinessId` is retained for attribution; the WABA monitor still counts it.
- **SMS sibling** `Resources/SmsTemplates/en/ServicePageLink.json` (`{{Subject}}/{{BusinessName}}/{{PageUrl}}`), gated by the shared `DocumentSmsGate` ⇒ Canada/Telnyx only, +91 excluded unconditionally.
- **Known residual:** `ApprovedLanguages` is one shared config while the India WABA carries only en/gu/hi, so a fr/es-preferring recipient on the `in` stamp resolves a variant that WABA lacks (identical to the shipped `clinket_ai_autorecharge_failed` posture; everything else falls back to `en`, present on both).

### Link-share SMS: its OWN switch, Canada only (2026-07-31)

‼️ `Voice:Sharing:SmsEnabled` (default **true**) is a DEDICATED kill switch for the SMS leg of `send_service_info` — deliberately NOT the platform `WhatsApp:DocumentSms*` pair, so texting a service page can be killed without touching booking/quote/invoice document SMS.

- **One authority: `VoiceLinkSmsGate`** (`clinqetinfrastructure/Services/Communication/VoiceLinkSmsGate.cs`). It **ANDs** with `DocumentSmsGate` rather than replacing it, so the platform switches and the unconditional +91/DLT recipient exclusion still hold — turning `SmsEnabled` ON can never re-enable a channel those forbid. Every AI knowledge surface (tool notes) AND every egress on this rail calls it, so what the model believes and what actually sends cannot disagree.
- **Canada/Telnyx only, two layers:** deploy.ps1 forces `Voice__Sharing__SmsEnabled` to `"false"` on the `in` stamp (5 wiring points, mirroring the `WhatsApp__DocumentSms*` pattern: `$script:RequiredFunctionAppSettings`, the `$voiceDocSmsForStamp` MCP dict, the Functions live-apply, and both MCP emit-mirror dicts) **plus** the in-code +91 exclusion.
- ‼️ **The prompt's SMS block is SHARED with `send_my_details`/`send_quote`** — gating it on this switch would regress the document rail. The switch is therefore scoped to the LINK rail only: the tool's channel decision, its fallback note wording, and the egress. An 'sms' ask with the switch off returns the existing warm `smsUnavailable` steer.
- Pinned: delivery (off ⇒ caller-requested SMS degrades to WhatsApp; off ⇒ no SMS fallback on WhatsApp failure; off ⇒ the queued send carries NO `SmsFallback` descriptor so the outbound processor cannot text around it; ON cannot override the platform switches) + tool (off ⇒ `smsUnavailable` and nothing enqueued; off ⇒ the note never says "arrives as a text message"; on ⇒ it does).

---

## ‼️ MULTI-USER TENANCY (2026-08-01 → 2026-08-04) — the resolver is already re-pointed. VERIFY, do not change.

> **The whole model is one skill: read `clinqet-provider-teams` before any tenancy change.**

The multi-user provider programme changed the *meaning* of `businessId` from "the owner's 5-char
`UserNumber`" to an independent 6-char business identifier. WhatsApp is one of the few surfaces that
resolves that identifier from a **public** handle, so it was audited in Phase 1, Phase 6 and again in
Phase 9. **Every finding was "already correct" — nothing here needs changing, and this section exists so
nobody changes it.**

### ‼️ `WhatsAppProviderLinkResolver` is ALREADY re-pointed at `Business`, and the sargable pattern survived

It resolves `Business.FriendlyName` **then** `Business.BusinessId` (re-pointed by **Phase 1**, verified
again by Phase 6 §3.9 and Phase 9's §1.8 sweep). `PHASE-06` §3.9's first bullet is a "to do" that was
**already done** — the completeness gate caught that. **Verify only; change nothing.**

‼️ **It lowercases the PARAMETER, not the column.** `LOWER([FriendlyName])` would be **non-sargable** and
full-scan `UserProfile`/`Business` **on every inbound message.** This is the same rule the admin support
lookup later had to obey (`AdminTenancyLookupSqlShapeTests` asserts `LOWER(`, `UPPER(`, `LEFT(` and
`CHARINDEX` appear in **none** of its generated SQL). **Never wrap the column.**

### `WhatsAppInboundResolver` returns a `RouteKey` that IS a `BusinessId`

The layered strategy is unchanged — interactive reply → reply-context `waconv` pointer → sticky window →
single active context → disambiguation prompt. Once resolved to a business, **the flow is identical
regardless of origin**: Clinket web · mobile · WhatsApp · email reply · SMS · voice/AI.

### ‼️ An inbound WhatsApp message reaches the provider through the SHARED TEAM INBOX, and the routing changed (L106)

`MessageService.IngestInboundExternalMessageAsync` creates a conversation with
`ConversationContext.Direct` — and so does the customer web app. So **EVERY customer↔business chat is
`Direct`**, WhatsApp included.

‼️ **Phase 5 originally mapped `DirectMessageReceived` + `Direct` → the `DirectMessage` routing class,
which resolves `Subject.DirectTargetMembershipId` AND NOTHING ELSE — so on an unclaimed thread it resolved
ZERO recipients and the provider was never told a customer had messaged them** (casebook CASE 19).
**Owner-decided fix (L106): it routes as `ContextMessage`.** Unassigned ⇒ everyone with
`conversation.read` + admin; claimed ⇒ assignee + their team + watchers + admin.

`00-SOLUTION` §8.3.2 already listed *"WhatsApp reply"* under the context-message class, so the locked
routing table always expected this. **Do not route a WhatsApp inbound as `DirectMessage`.**

### The provider-side conversation lives under the BUSINESS partition

`WhatsAppProviderOutreachService` is one of the **four** writers that already stored the provider side
under `businessId` — and the two provider controllers were reading the **person's** partition, which is why
every tenancy-path provider's inbox was empty (L99). Fixed on the READ side only; **no document moved.**

‼️ **A Broadcast or WhatsApp thread still resolves its own detail once via the existing
`GET /conversations/{id}` point-read when OPENED** (B13). `InboxConversationDto` deliberately omits
`broadcastData.latestBid` **and the WhatsApp 24-hour window**, both of which the thread **header** renders.
The provider inbox reads its LIST from `GET /business/inbox`; **the list source moved, the detail source
did not.**

### The send cap is pooled per business, and that was already correct

The WhatsApp send-cap counter is keyed `pk` = **businessId** (id `wasendcap_{pk}_{periodKey}`), like
`AiUsageCounter.pk`, `LeadUsageCounter.pk` and `MinuteLedger.BusinessId`. So **five team members share one
pool automatically**, and a contractor working for two organisations draws from **each organisation
separately** — with zero code change. ‼️ **Prove it with a test; never assume it.**

### WhatsApp is one of four channels behind ONE resolved recipient set (D6)

In-app, push, email and WhatsApp use the **same** resolved recipient set — **no channel-splitting.**
`Notifications:TeamBroadcastRestrictedToRouted` (default **true**) means intake goes to admin + the routed
team, and ‼️ **when a business has configured NO routing, the routed team resolves to ALL active members
with the permission** — so an unconfigured business behaves exactly as it does today.
Per-member channel preferences still apply on top, and ‼️ **mandatory-email categories must still reach at
least the admin whatever the flag says** (L20).

‼️ **`requestFactory` runs once per recipient and must render in `recipient.PreferredLanguage`** — building
the request outside it ships one language to everybody, with no compiler error and no test failure.

### Known residual, unchanged by tenancy

`ApprovedLanguages` is one shared config while the India WABA carries only `en`/`gu`/`hi`, so an
`fr`/`es`-preferring recipient on the `in` stamp resolves a variant WABA lacks. Identical posture to the
shipped `clinket_ai_autorecharge_failed`; everything else falls back to `en`, present on both.

---

## ‼️ PHASE 12 CORRECTION BLOCK (parts 1 & 2, 2026-08-05/06)

### 1. ‼️ The business "new message" WhatsApp alert is gated on the PRIMARY OWNER (Part 1, NX7)

`WhatsAppProviderNotifier` resolves the gate through
`IBusinessMemberDirectory.GetPrimaryOwnerUserIdAsync(businessId)` and reads **that** person's
`CommunicationPreference` row. It used to read `BusinessProfile.UserId` — the business-profile **CREATOR** —
while the live switch in both provider apps writes the **acting member's** row, so an administrator turning it
off changed nothing and a business whose creator had left could never turn it back on.

- **`providerUserId` is DELETED from `IWhatsAppProviderNotifier`.** Do not reintroduce it "for the caller".
- **Resolved INSIDE the notifier, below its three cheap early-returns** — a business with no WhatsApp number
  pays **zero** SQL (`NoProviderPhone_CostsNoDirectoryLookup`).
- ‼️ **FAILS OPEN.** A directory or preference failure logs a Warning and SENDS: SQL must never silence a
  customer's message.
- The same resolved owner also links the WhatsApp **consent** record, so the gate and the consent row can never
  disagree about which human represents the business.
- ‼️ **STILL OPEN, and the owner's:** an *administrator's* tap of that switch still writes their own row, which
  this alert never reads. The complete answer is a business-level flag — a new SQL column, therefore RULE ZERO.

### 2. The inbound webhook verifies its signature and fails closed

`WhatsAppWebhookFunction` verifies **`X-Hub-Signature-256`** (HMAC) over the buffered raw body before parsing,
and the `hub.verify_token` handshake is a separate constant-comparison path. Phase 12 Part 2 swept all seven
inbound webhooks on the platform (Meta, Stripe, Razorpay, Plivo, Telnyx, Azure realtime, 2FA) — **every one
verifies a signature and fails closed.**

### 3. The read-status relay expands a business to its members

`WhatsAppStatusProcessorFunction` relays Meta's `read` status to the Main API's internal endpoint, which now
publishes the receipt through the **single** `IConversationReadReceiptNotifier`. Before Part 1 that relay
addressed the `BusinessId` directly, so **the read tick never appeared in any member's open inbox.**

### 4. WhatsApp templates

Approved per language, five languages, exact filename parity with `en` (measured 2026-08-06: **102 template
files × 5**, zero drift). `HasApprovedTemplate(name, language)` is the gate — an unapproved language **ships
dark** with an Information log, never a raw English fallback.


## Phase 1 of the WhatsApp+SMS review — outbound failure visibility + India posture (2026-08-13)

- ‼️ **India (owner DR-1): SMS is OTP-ONLY.** `RoutingSmsService.SendSmsAsync/SendTemplatedSmsAsync` REFUSE
  India-bound sends with `SmsResult.NotSupported` (`Permanent=true`, no carrier call — local bodies are not
  DLT-registered); the SMS queue consumer COMPLETES Permanent results (no retry, no alert — other channels
  already fired). `TwoFactorSmsService` OTP is DLT-template-ONLY — the silent free-text fallback is REMOVED; a
  failed OTP raises Critical `SmsSendFailure` gated `TwoFactor:AlertOnOtpFailure` (true in all four hosts).
  The router does NOT guess a bare 10-digit national as India (NANP area codes also start 6-9) — callers pass
  the user's real country; `AuthService` no longer forces `?? "1"`.
- Every WA→SMS fallback failure now alerts (`HandleWhatsAppSmsFallbackFailureAsync`): dispatcher-leg enqueue
  failure (preference-suppressed non-sends stay quiet — `SmsFailed` vs `!SmsDispatched` distinguishes them),
  direct-leg carrier failure/exception, ticketed claim-then-fail (the alert says the recovery leg is LOST —
  the ETag claim destroyed the ticket), and ticket-mint failure (`IWhatsAppSmsFallbackTicketStore.RecordAsync`
  now returns `Task<bool>`; false at the outbound processor raises a Medium alert — the send succeeded, only
  async recovery is degraded).
- `WhatsAppStatusProcessorFunction`: Meta `failed` verdicts alert FORCED + Critical (owner rule R2);
  null/blank statuses log + alert + DLQ; the catch-all alerts like its sibling processors.
- The 9 previously-ungated WhatsApp alert families are now gated default-true (`EnableWhatsAppFailureAlerts` +
  per-family informational gates) — full table + the build-failing convention pin in clinqet-notifications.
- WA-G cap race: the read-before-send / count-after-success overshoot (≤ in-flight workers) is **ACCEPTED** and
  documented at `RecordSendAndAlertAsync`, pinned by
  `WhatsAppSendGateIntegrationTests.ConcurrentRecordSent_LosesNoIncrement_AndCapAlertFiresOnce` (real-Cosmos
  atomic increments hand each caller a distinct value ⇒ the ==cap alert fires exactly once). ‼️ Do not "fix" it
  to increment-first: that burns cap quota on Meta-rejected/retried sends. Degraded-gate writes alert via
  `WhatsApp:SendCaps:EnableGateFailureAlerts`.
- Both carrier rate limiters key on the NORMALIZED RECIPIENT PHONE (the `username ?? "anonymous"` shared
  bucket is gone). The voice number-lifecycle SMS passes the provider's `PreferredLanguage` (en template
  fallback covers untranslated languages). The dead `BroadcastReceived.json` SMS template is deleted (no
  producer — owner-confirmed deliberate 2026-08-13: leads carry NO SMS send; the absence is by-design).
- ‼️ `ConsentInactivityDays` is CONFIRMED LIVE (`CommunicationDispatcher.IsConsentActive`) — a recon claim
  that it was dead was a false positive; never delete it as "unused".
- ‼️ The dispatcher NEVER mints an India-bound `WhatsAppSmsFallback` (`RoutingSmsService.IsIndiaBound` — the
  single static India rule shared with the router): a DR-1-refused fallback would make the WhatsApp-failure
  alert claim an SMS "was sent". Pinned by `WhatsAppSend_IndiaSmsTarget_DoesNotMintDoomedFallback`. The
  status/outbound processor catch-alls alert only on FINAL retry with stable descriptions (dedupe-friendly).

## WhatsApp+SMS Phase 2 — inbound: STOP/START, CONFIRM/DECLINE, block interplay (2026-08-13)

Owner rules R4/R5. The inbound side is now symmetric with the send side Phase 1 hardened.

### ‼️ `WhatsAppNotificationMessage.ConsentExempt` DOES NOT EXIST — the s21 entry above is WRONG

There is no such field on the DTO and no such branch in `WhatsAppOutboundProcessorFunction`. What actually
makes the re-opt-in prompt (and now the START ack) deliverable is the shape of the gate itself:
`optedOutTemplate = isTemplate && OptedOut` — **opt-out suppresses TEMPLATES only**, so a free-form
`SessionText` sent inside the window the contact's own inbound opened is never opt-out-gated.
`blockedSuppressed` still kills every kind, which is why the START path CLEARS the block *before* enqueuing
its ack. **Do not add an exemption flag; fix the ordering instead.**

### ONE block policy, applied before routing

`WhatsAppInboundProcessorFunction.ApplyInboundBlockPolicyAsync` runs immediately after contact resolution and
governs every route (cold AND contextual — it used to live only inside the cold branch):

| Block source | Inbound behavior |
|---|---|
| **Admin** | the inbound is IGNORED entirely — no ingest, no ghost, no reply, no unblock. A sender can never self-clear an abuse decision (s22 rule preserved). |
| **Deliverability** | CLEARED (`UnblockAsync`, actor `wa-inbound-reengagement`) — Meta just delivered a message FROM them, which disproves the block. A real delivery problem simply re-blocks on the next failed send. |

Before this, a blocked contact **with an active conversation** was ingested normally (admin block unenforced,
WA-E) and a deliverability-blocked one had every provider reply dropped silently by the outbound router (WA-B).
The START keyword path clears a Deliverability block too, so START is no longer a dead end (WA-A).

‼️ The four short-circuit handlers that run BEFORE contact resolution (provider booking reply, `partner_*` menu,
`customer_*` menu, `custbook_*` confirmation) are deliberately **not** gated — they are actions, not ingestion,
and the outbound gate still suppresses any reply to a blocked contact.

### Consent bookkeeping fixes

- `UnblockAsync` now clears `DeliveryFailureCount` / `LastDeliveryFailureCode` / `LastDeliveryFailureAt` /
  `BlockedErrorCode` (matching `AutoExpireBlockAsync`). Leaving the streak at the threshold re-blocked the
  contact on their very next failure — the unblock lasted exactly one message (WA-C2).
- `RecordMenuSentAsync` invalidates the consent cache — it writes cache-visible identity fields (phone,
  UserNumber, language), so a stale dispatcher entry kept sending to the pre-merge identity (WA-L).
- START stamps `Actor` on the consent event, like STOP always did (WA-K). A ledger that records who left but
  not who returned cannot answer the only question an audit asks.
- Alias writes retry twice; a persistent failure for an **opted-out or blocked** contact raises a
  `ComplianceRisk` admin alert (`WhatsApp:EnableConsentAliasFailureAlerts`, default true). That is the case
  where a lost alias lets a second contact doc be created with `ChannelOptIn=None` and — under `DefaultOptIn` —
  silently resurrect a hard opt-out (WA-C6).

### One keyword table for both channels

`clinqetshared/Constants/InboundReplyKeywords.cs` is the single source; `SmsInboundIntentParser` is the single
SMS parser (both carrier handlers delegate to it, and their private copies are gone).

| Set | Words |
|---|---|
| `OptOut` (SMS) | STOP, STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT |
| `WhatsAppOptOut` | STOP, STOPALL, UNSUBSCRIBE — ‼️ **narrower on purpose**: CANCEL/END/QUIT are ordinary chat words here |
| `OptIn` (both) | START, UNSTOP, RESUME, CONTINUE, SUBSCRIBE |
| `Confirm` (SMS) | CONFIRM, CONFIRMED, APPROVE, APPROVED, ACCEPT, ACCEPTED, YES, Y, OK, OKAY, AGREE |
| `Decline` (SMS) | DECLINE, DECLINED, REJECT, REJECTED, NO, N |
| `WhatsAppExplicitConfirm/Decline` | CONFIRM, CONFIRMED, APPROVE, APPROVED, ACCEPTED / DECLINE, DECLINED, REJECTED — the only words that act when typed BARE on WhatsApp; the rest stay conversational and fall through to the resolver |
| `Help` | HELP, INFO |

Trailing punctuation is stripped, so `stop.` and `okay!` match. A category suffix (`STOP BOOKINGS`) still scopes
the change; a booking number suffix (`CONFIRM BK-1001`) still targets the exact booking.

### Booking replies — both roles, both channels

- The most-recent-pending fallback now serves **both** channels. It was SMS-only, and because the provider
  template never showed a booking number, a typed WhatsApp CONFIRM was always acked "not found" (WA-C).
- A CONFIRM/DECLINE from a phone that is not a provider falls through to `ApplyCustomerReplyAsync` on SMS
  (it was provider-only), and the `LogCritical("No provider found")` that fired on every ordinary customer
  reply is now Information (SMS-7).
- `DeclineAsync` rethrows a 412 when the refreshed booking is still pending, exactly like `ConfirmAsync`.
  It used to swallow, so a racing DECLINE was lost and the provider was acked "not updatable" (WA-I).
  ‼️ The unit test that covered this was **asserting the defect**; it is now a rethrows/completes pair.
- Three previously silent failures raise gated admin alerts — failed transition, failed `CustomerBooking`
  mirror, failed booking-email enqueue (`Communication:Alerts:EnableBookingReplyFailureAlerts`, default true,
  Functions only). `BookingReplyActionService` raised ZERO alerts before.

### ‼️ A one-tap DECLINE is UNDOABLE (owner-requested)

Rejected is terminal everywhere else, and a quick-reply button is easy to hit by mistake, so a CONFIRM
arriving after a decline REVERSES it: clears `RejectionReason` **and the `CancelledAt`/`CancelledBy` stamps**,
sets Confirmed, updates the customer mirror and sends the normal confirmation. Bounded three ways — only a
rejection **this reply path** made (`RejectionReason` starts with `"Provider declined via "`), only within
`Communication:BookingReplyUndoWindowMinutes` (default **60**), and only while `ScheduledStartUtc` is still
ahead. A bare typed CONFIRM does **not** recover (the most-recent-pending query only sees
`AwaitingProviderConfirmation`); the button and `CONFIRM <number>` do, which is where a misfire happens.
**Do not "simplify" the marker or the window away.**

‼️ **The window is measured from `CancelledAt`, NEVER from `UpdatedAt`** (Phase 4, 2026-08-14). A reply-decline
now stamps `CancelledAt` + `CancelledBy = "Partner"` like every other terminal path (`RejectedTimeout` already
did), and the undo clears both — a Confirmed booking must never carry a cancellation stamp. `UpdatedAt` is
bumped by ANY write (identity sync, tenancy sweeps), so clocking off it silently re-opened long-closed
windows; a decline with no `CancelledAt` is not recoverable at all (fails closed). No new field was added —
these two already existed on the entity.

### Silent-drop triage (WA-D1..D10)

Fixed: **D5** (menus disabled + a known customer) now raises the ColdInbound alert like its provider twin ·
**D7** (stale/unknown menu row id) replies with `WhatsApp_Menu_OptionUnavailable_Body` (all five languages)
instead of consuming the tap silently · **D8** (`FlushSelectionToCustomerAsync` with an incomplete context)
now alerts like its twin — it DISCARDS buffered messages.
By design, documented: D1/D2 (no text and no media ⇒ nothing to ingest) · D4 (menu debounce) ·
D6 (re-opt-in prompt is once per opt-out episode) · D9 (localization key-echo guards) · D10 (router no-ops).

### The provider booking-confirm template revision — ✅ LIVE (completed at Phase-2 close, verified 2026-08-14)

`clinket_booking_confirm` carries the booking number + one-tap Confirm/Decline + a View-booking link,
**APPROVED / UTILITY on all 8 production variants** (Canada en/es/fr_CA/gu/hi · India en/gu/hi — never fr/es
on India, owner's rule). Both `WhatsApp:Templates` blocks are flipped and byte-identical
(`BodyParams ["bookingNumber","customerName","serviceName","dateTime","expiresAt"]` +
`QuickReplyButtons` confirmPayload/declinePayload + `ButtonUrlParamKey bookingId`); all 5 proof templates
are deleted from both WABAs.

- ‼️ **A template MAY mix 2 QUICK_REPLY buttons with 1 URL button** — settled through approval.
  ‼️ **A body may not START or END with a variable** (subcode 2388299 "Leading or Trailing Params Not Allowed").
- Inbound: `WhatsAppProviderBookingReply` (`probook_confirm <n>` / `probook_decline <n>`), parsed BEFORE any
  text heuristic; `ProviderConfirmationProcessor` supplies `bookingNumber`, `confirmPayload`, `declinePayload`.
- ‼️ Proof names (`_p1_`) must NEVER enter `WhatsApp:Templates`; edit-in-place (no deletion ⇒ no 30-day name
  cooldown) is the production-revision protocol.

---

## ‼️ SUPERSEDED 2026-09-20 — `WhatsAppSmsFallbackTicketStore` IS GONE

Everything below about the `wafb_` ticket document describes a store that **no longer exists**. It was
merged into `CarrierMessageLookup`, which was already keyed by the same wamid, in the same container, with
the same lifetime, and read at the same instant. Two record types were doing one job.

| Then | Now |
|---|---|
| `IWhatsAppSmsFallbackTicketStore.RecordAsync(wamid, fallback, type)` | `ICarrierMessageLookupStore.RecordAsync(record)` with `Fallback` set |
| `TryClaimAsync(wamid)` → ETag-conditional **DELETE** | `TryClaimFallbackAsync(channel, wamid)` → ETag-conditional **REPLACE** |
| `WhatsAppSettings.SmsFallbackTicketTtlSeconds` | `DeliveryTracking:WhatsAppCarrierMessageTtlSeconds` |
| Ticket only for `Direct: true` (voice documents) | ‼️ **Every send that had a text held back**, so an ordinary booking confirmation recovers too |

**Why a REPLACE and not a DELETE:** the identity half of the record must survive the claim — a claim that
cannot send still has to name the person for the failure notice, and a read receipt still has to find its
conversation.

**Two behaviour changes worth knowing:**

1. ‼️ **`131026` is no longer silent.** Only a fallback that actually delivered earns silence. For an
   ordinary send nothing goes out as a text at delivery-status time, so the message is genuinely gone and
   the provider is told.
2. ‼️ **A staleness cutoff exists** (`DeliveryTracking:LateFallbackMaxAgeMinutes`, 30). Past it the text is
   not sent — a booking reminder three hours late is noise — and the provider is told instead.

‼️ **And a defect this fixed:** the ticket stored its template data as a `Dictionary<string, string>`, which
`CamelCasePropertyNamesContractResolver` round-trips with **lower-cased keys**. So
`ticket.SmsTemplateData?.GetValueOrDefault("Number")` was reading null and the in-call "sent as text
instead" notice went out without its document number. The merged record stores it as a `JObject`.

**See `clinqet-delivery-feedback` for the whole picture.**

## ‼️ CHAT MESSAGES ON WHATSAPP — the full relay, both directions (2026-09-21)

Authority: `C:\Nik\Data\whatsapp-chat-messages\PLAN.md`. Sheet: `C:\Nik\Data\mockups\whatsapp-chat-relay-states\index.html`.

**What changed in one line:** inside the 24 h window WhatsApp now carries the WHOLE chat message — the words AND the
attachments — and the email that would have gone with it **waits behind the send** and is released only if nothing
carried the words. Outside the window, the approved notice replaces that email on the message that carries it.

### The shape

- `IWhatsAppChatRelayComposer` (`clinqetinfrastructure/Services/Messaging/WhatsAppChatRelayComposer.cs`) turns ONE chat
  message into an ordered `List<WhatsAppChatPart>` — the same composer for both directions, so the customer and the
  provider get byte-identical part lists for an identical message.
  - The **first message of a burst** (recipient's unread count was 0 before this message) is an
    `InteractiveCtaUrl`: bold sender name, the text, footer `WhatsApp_Chat_Footer_ReplyHere`, button
    `WhatsApp_Chat_OpenChat_Button` → the exact thread (`/messages?conversationId=` · `/dashboard/inbox?conversationId=`).
  - **Over 1024 characters**: the full text as plain `SessionText` (‼️ NEVER truncated) and the short button message
    **last, after the attachments** — the invitation to reply closes the burst.
  - **Later lines** in a burst: plain text, no button.
  - **Attachments**: one part each, in upload order, after the words. `WhatsAppMediaLimits.ResolveSendableKind`
    decides image/video/document from the MIME type and the byte length the message document already stores — **no
    blob call**. Anything Meta will not take (webp, gif, heic/heif, quicktime, or over its size cap) is counted into
    one localized line (`WhatsApp_Chat_Attachment_Hint_One`/`_Many`), never silently dropped.
  - **Attachment-only**: the sender's name becomes the FIRST part's caption; later parts stay bare.
- The parts travel in **ONE queue message** (`WhatsAppNotificationMessage.Parts`, dedup id = the chat message id).
  Separate messages would race on parallel consumers and a photo could overtake the words.
- `WhatsAppOutboundProcessorFunction.SendChatRelayAsync` sends them **sequentially**, marking each
  `{chatMessageId}:p{n}` the moment Meta accepts it — so a crash half way **resumes** at the next part and the words
  are never sent twice. The read SAS for a media part is minted **at send time**
  (`WhatsApp:ChatAttachmentSasExpiryMinutes`, 60) and appears in no queue message, no record and no log.

### The held-back email

- `HeldBackEmail { RecipientType, RecipientUserNumber, RecipientUserId }` rides the queue message — identity only, no
  text, no address. Built ONLY when an email actually exists and `DeliveryTracking:ChatEmailHoldBackEnabled` is on.
- **Customer side**: the customer's own email. **Business side (§7.2)**: ‼️ exactly ONE member's — the one active
  member whose own phone IS the business WhatsApp phone (`TryResolveSoleMemberByPhoneAsync`). Two matches or none ⇒
  hold NOTHING; every member keeps today's email. A typed phone may repeat (only a proven one is unique, auth-sessions §11), and inferring a person from a shared one
  would suppress the wrong member's mail.
- `CarrierMessageLookup` gained **three** fields and nothing else: `emailHeld`, `emailReleasedAt`, `chatRelay`
  (§0.7-approved). Only **part one** carries `emailHeld`; **every** relay part carries `chatRelay`.
- ‼️ **`ChatEmailReleaseService`** (Functions host) is the ONE place the email is let go, and **four** callers run its
  eight-step table: a synchronous Meta failure, a failed record write, a late `failed` status, and the 2-hour delivery
  check. Steps 1–6 consume nothing, so a redelivery reaches the same answer twice; only the ETag claim spends.
  - switch off ⇒ stop (the note stays and recovers) · older than
    `DeliveryTracking:LateEmailFallbackMaxAgeMinutes` (360, measured from the record's `createdAt`, never "now") ⇒
    stop · message gone / removed / already `Delivered` ⇒ stop · `isRead` ⇒ stop · the recipient's OWN conversation
    document muted, hidden, blocked or closed ⇒ stop · the recipient today ⇒ customer document, or ‼️ for a business
    **`INotificationRecipientResolver` — the same routing the send used**, which answers "still active", "still
    routed to this thread" and "what does their own preference screen say about email" in one read · claim · dispatch.
  - ‼️ The membership policy passed to the dispatcher is the **resolved recipient's own `ChannelPolicy`**. Hardcoding
    `Email = Immediate` there emailed a member who had turned chat email off — on the one path where nothing else
    would have reached them (audit A-1).
  - Idempotency `chatmail:{conversationId}:{messageId}` ⇒ the four callers and every redelivery collapse onto ONE
    email. A claim that wins and then fails to enqueue raises a High admin alert with `ticketConsumed: true`
    AND stamps the sender’s bubble `InAppOnly` — the alert is for us; the person who wrote the message is still
    owed the true state of it rather than a stale “sent”.
- ‼️ **Every synchronous exit releases** — blocked/opted-out at send time, no approved template, the send cap,
  131047, retries exhausted, a failed record write, an unsignable attachment on part one, an **invalid payload**
  dead-letter and a **processing exception on the final attempt**. The two dead-letter paths were added in the audit:
  a message that will never run again and has no wamid can never be released by anything else.
  The ONE deliberate exception is **cancel-on-read**: they read it in the app, so no email is owed.

### The delivery check and the ticks

- A Meta **`delivered`** point-reads the record (~1 RU) and decides from `chatRelay` + `emailHeld` — the only way to
  tell a relay from a notice. Relay ⇒ patch `Message.whatsAppOutcome = Delivered` (first-writer-wins, so parts 2…n
  cost a 412 and nothing else). Held ⇒ clear the hold (nothing was released, so `emailReleasedAt` stays absent).
  A **notice** clears the hold and writes **no tick**. Neither field ⇒ a transactional template ⇒ nothing.
- When a hold is written the processor **schedules a `WhatsAppStatusMessage { Kind = DeliveryCheck }`** on the
  existing `whatsapp-status` queue at +`WhatsAppUndeliveredCheckMinutes` (120). ‼️ Its `Status` is empty, so the
  branch sits **ABOVE** the missing-status dead-letter guard in `WhatsAppStatusProcessorFunction`. No new queue, no
  new function, no new Azure resource.
- The check stops on an absent `emailHeld` (one point read). Otherwise the §7.1 table runs and, if it releases, one
  **deduped** Medium admin alert (stable description, ids in metadata) says WhatsApp accepted and never delivered.
- `Message.whatsAppOutcome` / `whatsAppOutcomeAt` (`Delivered` · `EmailSent` · `InAppOnly`) reach the four thread
  screens through `MessageResponseDto`: the fifth tick state **delivered** (double grey, between sent and read; read
  always wins) and one muted line under the sender's own bubble on failure. ‼️ It appears on the **next load** of the
  thread — the real-time payload is serialised at send time and a `delivered` raises no SignalR push.
  A chat-relay verdict raises **no** `MessageDeliveryFailed` notice; the admin alert stays.

### Rules that are easy to get wrong

- ‼️ **`MessagesChats` is in `WhatsAppEligibleCategories`** (D-2) so the settings chip appears — and the dispatcher
  still never WhatsApps a chat message, because that category carries no template. Both halves are pinned by tests.
- ‼️ **In-app mute silences the relay** (D-8), per side and per conversation. Mute used to be a half-promise.
- ‼️ The closed-window template names are **`clinket_chat_reply_customer` / `clinket_chat_reply_provider`** with a
  **dynamic** URL button (`ButtonUrlParamKey: "conversationId"`). The old `clinket_new_message_*` pair is gone from
  code, from config, and **DELETED on both WABAs on 2026-09-21** (Canada 5 locales, India 3 — a live read proved
  the new pair APPROVED / UTILITY on each WABA before anything was removed).
- ‼️ Both mobile apps override `getStateFromPath` in `src/appNavigation/linking.ts`: React Navigation matches on PATH
  only, and the approved template's URL carries the conversation as a QUERY parameter, so without it every tap lands
  on the list.
- The window-closed branch checks `HasApprovedTemplate` **before** holding the email — an email held behind a send
  that can never happen is the one outcome this design must never produce.
