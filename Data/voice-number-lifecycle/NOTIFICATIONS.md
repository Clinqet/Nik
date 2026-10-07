# Notifications and proposed copy

> **1 October 2026 — superseded in part.** The owner's final decisions are in `DECISIONS-2026-10-01.md` and the design to build is `FINAL-DESIGN.md` (its section 14 lists what changed). Read those first; **where this file differs, they win.** This file stays for the detail they do not repeat.

**MANDATORY CARRIER RESEARCH — COST IS SUPER IMPORTANT. The implementation session MUST research official Telnyx (Canada/US) and Plivo (India) billing online AGAIN: first and subsequent charges, proration/refunds, renewal calendar, month-end/leap dates, billing cutoff/timezone and available renewal APIs. Resolve conflicting information against the exact product/account and primary documentation, using authorized read-only evidence and written carrier confirmation when needed; ask the owner rather than guess. Read CARRIER-RESEARCH.md and RENEWAL-AUTOMATION.md fully. Save verified evidence and conservative UTC deadlines in the proposed partition-scoped Cosmos design after itemized schema approval; return eligible unused numbers with a default 24-hour lead. No unverified financial automation or promised refund.**

Design only · 30 September 2026 · no messages sent and no carrier/Meta templates created.

## Recommendation

Reuse the existing business communication dispatcher, BillingNotificationService, notification routing catalog, SignalR allowlist and channel processors. Keep billing events about billing; use number operations for assignment, forwarding and removal. One logical event has one stable event ID across repair attempts. Channel failure must not roll back a correct routing or billing change.

The current VoiceAssistant preference group is not universally mandatory. **Do not make call summaries mandatory as a side effect.** Approve a narrowly scoped operational/security rule for forwarding changes, number removal and loss of service. Existing billing-mandatory email behavior continues. All channel eligibility still honors valid contact endpoints, suppression, delivery feedback and legal consent; “mandatory” does not bypass a hard bounce or send to an unverified new destination.

## Event contract

Event names below are proposed unless explicitly labeled existing. Complete source-enum and template mapping review precedes implementation. Business notification recipients derive from the existing business routing catalog, never just whichever member submitted the form.

| Trigger | Recipient / delivery | Suggested copy and action | Deduplication / failure behavior |
|---|---|---|---|
| Provider submits setup | Dedicated proposed admin registration event; Alerts + AI Assistant Activity | “[Business] submitted AI Assistant setup. Number selection is in progress.” | Same setup operation ID; success updates/links the operation, not a second unresolved assignment request |
| Automatic assignment complete | Existing assigned-number event where its semantics match; email, in-app, eligible push. Admin success event | “Your assistant number is ready: {number}.” Dedicated mode: “Review how calls are answered.” Own-number mode: “Connect your existing number to finish setup.” | Send only after routing/minute projection is confirmed; readiness is mode-specific |
| Manual fallback | Proposed admin action-required event; provider in-app and email | “We’re arranging your assistant number. We’ll let you know when it’s ready.” | No promised completion time. Status links the same operation; billing dates remain visible |
| Forwarding request received | Dedicated proposed `VoiceForwardingChangeRequested` alert, admin Requests and Alerts; provider in-app receipt | “Your request was sent. Your current number is unchanged.” | One unresolved request/business; retries return same ID |
| Forwarding request rejected | Provider email + in-app + eligible push | “We couldn’t approve your number change. {reviewedReason}.” | Never expose internal fraud notes. Reason localized when categorical; admin's free text reviewed and escaped |
| Forwarding change applied | Proposed `VoiceForwardingNumberChanged`, targeted security routing; email + in-app + eligible push | “Your AI Assistant forwarding number changed from {maskedOld} to {maskedNew}. If you didn’t request this, contact support.” | Notify existing authorized business recipients, not the proposed phone alone. For own-number mode append “Reconnect and test your forwarding before using the assistant.” |
| T−24h trial reminder | Reuse existing AI add-on trial-reminder infrastructure; existing channel rules plus approved Utility if applicable | “Your AI Assistant trial ends {trialEnd}. Your number {number} will be held until {holdEnd} if the service ends.” Web action: “Manage AI Assistant”. Native action follows existing billing handoff | Exactly one reminder per current trial boundary; extension/reschedule policy explicit. No duplicate generic three-day + new one-day voice reminder |
| T trial ended, hold active | Existing trial-ended billing event plus one coherent number-hold message when a number exists | “Your AI Assistant trial has ended. AI answering is off. Your number is held until {holdEnd}.” Link account service page | Durable delivery intent; accepted-for-delivery time recorded. No false promise about forwarding in own-number mode |
| T+24h actual detach | Proposed `VoiceNumberRetentionEnded`, email + in-app + eligible push, approved Utility | “Your assistant number {number} has been removed from your business. It is no longer available for your calls.” | Only after fenced detach and projection. Own-number mode includes existing carrier disconnect instructions; never claim Clinket can cancel their external forwarding |
| Recovery before detach | Reuse appropriate billing recovery event with number-retained detail | “Your AI Assistant is active again. Your number is still {number}.” | Confirm routing and allowance before success; pending payment is “processing”, not “active” |
| Return deadline approaching / carrier return unknown | Admin only, operational alert and inventory badge | “[N] unassigned numbers need review before {releaseBy}. Potential next rental avoided: {amount} {currency}.” | Aggregate per scope/window, avoid per-sweep floods; unknown result is actionable until reconciled |

An in-app record exists even if no push device is registered. Push is not a substitute for the record. Email acceptance is not delivery. Failed or suppressed delivery appears in existing delivery feedback and admin diagnostics with masked destinations; do not keep numbers forever waiting for a read receipt.

## WhatsApp Utility proposal — not submitted

The existing process lives in [Data/whatsapp/README.md](../whatsapp/README.md). It documents previous Meta recategorization and failed Utility recreations. Public Meta guidance could not be fetched reliably during this review (rate-limited); **final wording/category/locale approval must be verified with Meta before launch**. Calling a template Utility does not make it approved, and a parameter cannot hide promotional language.

Recommend three factual service-status templates, with separate review of whether the existing trial-reminder/end template already covers the first two. Do not create duplicate templates where current approved copy is sufficient. Names are proposal identifiers only; actual available names and revisions must be checked in the account.

| Proposed identifier | Draft English body | Parameters / button |
|---|---|---|
| `voice_number_hold_notice` | “The AI Assistant service for {{1}} ended on {{2}}. AI answering is off. Your assistant number {{3}} is held until {{4}}. You can view the service status in your account.” | Business display name; localized end date/time; assistant number; localized hold deadline with timezone. Button “View service” to existing authenticated assistant page |
| `voice_number_removed_notice` | “The assistant number {{1}} was removed from {{2}} on {{3}} after the service ended. Calls to this number are no longer handled for your business. View your account for details.” | DID; business; removal time. Button “View service” |
| `voice_forwarding_changed_notice` | “The AI Assistant forwarding number for {{1}} changed from {{2}} to {{3}} on {{4}}. If you did not request this change, contact support.” | Business; masked old/new; time. Button to authenticated details/support route, verified at implementation |

No discount, free offer, “upgrade now”, urgency marketing or benefit pitch. The web account page can expose the appropriate billing action. Apply existing WhatsApp consent, locale mapping, country account routing and delivery-feedback suppression. Do not send WhatsApp to the newly requested phone as proof of ownership or as the only security notification. No SMS fallback is newly authorized by this design; use the existing dispatcher policy only.

Existing template workflow lists Canada `en_US`, `es`, `fr_CA`, `hi`, `gu` and India `en_US`, `hi`, `gu`. Verify account-language mappings again before submission; translate every required locale and use realistic parameter examples. Status must be Approved and category Utility in each deployed account/locale before whitelisting. This design is **not an instruction to submit, delete or replace live templates**.

## Localization inventory

The mockup's English is proposed design copy, not integrated strings. Implementation must add keys to every existing app/backend language file (discover exact files; do not invent a locale). Server validation, template text, accessibility labels, banners, dialog actions and native equivalents are included. Format dates/currency through existing locale helpers; store UTC dates and E.164 separately from presentation.

Proposed namespaces: `voice.numberChoice.*`, `voice.provisioning.*`, `voice.forwardingChange.*`, `voice.retention.*`, `voice.inventory.*`, and `voice.adminRequest.*`. Cover at least: title, body, current/requested number, country, validation-invalid/unchanged/blocked, request/send/withdraw/pending/declined/applied, list selection, locality explanation, no local options, no eligible options, quote expired, number taken, purchase pending/unknown, permission denied, rate limit, offline, reconnect/test, trial/hold/removed/recovered, retry, cancel, close, admin verify/apply/conflict/return confirmation and results. Email templates require matching per-language JSON under the existing template system.

Recipient permissions, mandatory classifications, enum additions, SignalR allowlisting and actual template map updates are one reviewed change. New enums are code changes, not new SQL lookup tables.
