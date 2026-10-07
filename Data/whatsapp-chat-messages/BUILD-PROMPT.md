# Build prompt — WhatsApp for chat messages (copy from the line below to the end)

---

WhatsApp for chat messages — BUILD SESSION. Design is approved; this session writes the code.

READ FIRST, COMPLETELY, BEFORE ANY CODE (no skimming, every word):
  1. C:\Nik\CLAUDE.md — every rule in §0 is in force, especially §0.6 (no cross-partition), §0.7 (schema needs my
     yes — already given for exactly FOUR optional fields and nothing else: `emailHeld` + `emailReleasedAt` on the
     CarrierMessageLookup record, `whatsAppOutcome` + `whatsAppOutcomeAt` on Message), §0.14 (comments),
     §0.15–0.19 (tests live with the runtime consumer, never git checkout/restore in the shared trees), §0.16
     (clean tree).
  2. C:\Nik\Data\whatsapp-chat-messages\PLAN.md — THE authority. §0.1 is what I decided; §7.1 is the release
     decision table; §6.5 the attachment mechanics; §7.7 the template plan (treat all 16 variants as APPROVED /
     UTILITY — read live status once before the config switch; a MARKETING locale I challenge, you never re-word or
     delete); §8 the failure matrix; §11 the two approved fields; §13 the build order; §16 the multidimensional
     audit; §17 the master checklist; §20 the coding standards — all in force.
  3. C:\Nik\Data\delivery-failure-feedback\PLAN.md §9.7 and the skills clinqet-delivery-feedback, clinqet-whatsapp,
     clinqet-messaging, clinqet-notifications, clinqet-function-app, clinqet-testing (all four copies are identical;
     read .claude/skills/<name>/SKILL.md).
  4. Every file PLAN.md §2 cites, end to end: MessageService, WhatsAppChannelRouter, WhatsAppProviderNotifier,
     CommunicationDispatcher, BusinessCommunicationDispatcher, WhatsAppOutboundProcessorFunction,
     WhatsAppStatusProcessorFunction, CarrierMessageLookupStore + ICarrierMessageLookupStore,
     DeliveryFailureFeedbackService, WhatsAppConsentService, WhatsAppInboundProcessorFunction,
     WhatsAppInboundResolver, EmailNotificationProcessorFunction, MessagingSettings, WhatsAppSettings,
     DeliveryTrackingSettings, both Program.cs files, and the existing tests named in PLAN.md §12.

WHAT TO BUILD — exactly PLAN.md §13, in that order, each step green before the next:
  - Both directions. Inside the window: full text + attachments on WhatsApp, email held (`emailHeld`), released only by
    the §7.1 table. Business side: hold ONLY the email of the member whose own phone is the business WhatsApp phone.
  - Outside the window: the notice replaces the email on the message that carries it; cancel-on-read ⇒ no email.
  - Attachments per §6.5: one queue message, sequential parts, per-part idempotency, send-time read SAS, new
    SessionVideo kind, hint line ×5 languages, each part its own record, only part 1 carries `emailHeld`.
  - Release service per §7.1: read the message, the recipient's conversation document, the recipient's current
    profile / Active membership; then claim; then the SHARED email builder extracted from MessageService; email-only
    dispatch; `chatmail:{conversationId}:{messageId}`; lost-leg alert if the enqueue fails after the claim.
  - Every synchronous exit and the record-write failure release the email at once (§7.1 callers).
  - Cutoff 360 minutes, judged before the claim, from the record's createdAt.
  - The delivery check (§7.1.1): a Meta `delivered` for an in-window relay patches `Message.whatsAppOutcome = Delivered`
    (one write feeding the delivered tick AND the check); a scheduled `DeliveryCheck` on the existing status queue at
    +120 min runs the §7.1 table if the email is still held (the table stops on Delivered or read) and raises a deduped
    admin alert + metric when it releases. No new queue, no new function.
  - The in-window first message of a burst is an interactive CTA-URL message (§7.3): bold sender name, the text, footer
    "Reply here or in Clinket.", button "Open chat" to the exact thread; later lines plain; media never carries a button.
  - The delivered tick + in-thread delivery line (§11.2, approved): `Message.whatsAppOutcome` (Delivered · EmailSent ·
    InAppOnly) + `whatsAppOutcomeAt`; the status processor writes `Delivered` on a delivered in-window relay (never for a
    closed-window notice), the release service writes the failure outcomes; the four thread screens gain the fifth tick
    state (double grey, between sent and read; read always wins) and the muted line on failure; three copy keys ×5 with
    phone-app twins. The chat-relay verdict raises no MessageDeliveryFailed notice.
  - A first message over 1024 characters is TWO messages: the full plain text, then the short button message — never
    truncated (§7.3).
  - D-2: `MessagesChats` joins the WhatsApp-eligible set (settings chip), pinned by a test that the dispatcher still
    never WhatsApps a chat. D-8: the router honours the recipient's in-app mute (per side, per conversation). D-9:
    customer relay per conversation, provider as today — both pinned by tests.
  - No backfill, no migration, no compatibility code anywhere — sandbox only (§13).
  - F-A: the in-window provider branch registers the provider-side context (§2.1 F-A, §13 row 8).
  - Templates FIRST (§13 row 9 runs first): the 16 new variants are already APPROVED / UTILITY (verified live
    2026-09-20). Ship the config switch in both hosts + the settings/constants defaults + `conversationId` on the
    router and notifier + the mobile deep link to the exact thread (both apps) + tests as ONE change; I deploy; only
    THEN delete the old two templates on both WABAs after a live read. Never delete before the deploy.
  - Settings ×4 hosts with class defaults mirrored (§7.4); queue DTO + SchemaVersion per D-17.
  - Tests: unit in the runtime consumer's suite AND integration against the real Cosmos emulator (claim race, verbatim
    round trip, email-lease dedupe, per-part resume, F-A route). 100% green. No skipped tests.
  - Skills ×4 + memory updated; parent PLAN §9.7 "Today" corrected.
  - THEN the §16 multidimensional audit as a separate pass, every finding fixed and recorded, and every §17 row ticked
    by a check that was run. Nothing is done before that.

OPEN DECISIONS — none. Every design decision, both schema asks, the mockup and the build order are recorded as
approved in PLAN.md §0.1 and §15.1 (2026-09-20). Any new decision that surfaces mid-build is NEW: STOP and ASK me.
A plan line is not approval for anything beyond the four fields named above.

RULES THAT BITE HERE:
  - No feature flags, no legacy paths, no backfill — pre-production, design for an empty database.
  - Never a cross-partition query. Every read in the release table is a single-partition point read.
  - Every IMemoryCache write sets Size = 1. Idempotent Service Bus handlers. Structured logging only.
  - No message text, address or link on the CarrierMessageLookup record beyond `emailHeld` / `emailReleasedAt`; no SAS in
    any queue message or log; no message text in any log or admin alert.
  - Every user-visible string is a localization key in en/es/fr/gu/hi. No technical word a provider or customer can read.
  - Mobile mirrors web in the same session (both mobile apps: deep link to the exact thread).
  - Never build or test while another session works in C:\Nik — ask me first. I push and deploy; you never commit.
  - Leave the tree clean: `git status --porcelain` shows only deliverables, in every repo you touched.
  - Ask me for the Meta access token when you reach the template steps; it is not stored anywhere.

CODING STANDARDS — PLAN.md §20 verbatim, in force for every line:
  Zero assumptions (read everything first) · zero hallucinations · zero workarounds · plan first. Pre-production freedom:
  no backward compatibility, do the right refactor. Backend hyper-optimized, 100% thread-safe, zero leaks, watertight
  logic. Frontend aligned to the existing design system, mobile-first (phone + iPad), no duplicate API calls, a mockup
  before any brand-new view. Exhaustive edge cases and fail-safes for network, latency, null and broken connections.
  Comments only for critical WHY. Every option presented with a strongly recommended choice and its why.

QUALITY OVER SPEED. Read every word, analyse fully, plan, then build. Report honestly: failing tests are reported
with their output, skipped steps are named, and the audit findings table is filled in with the check that produced
each row.
