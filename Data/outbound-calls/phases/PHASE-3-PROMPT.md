# Outbound AI Calls — Phase 3 of 6: Consent, handouts and operations

## Mandatory extension — one or several people without a campaign (2026-10-04)

**MUST READ `C:\Nik\Data\outbound-calls\QUICK-CALLS.md` IN FULL. THE OWNER REQUIRES ONE SHARED “CALL WITH AI” FLOW FOR ONE PERSON OR A SMALL SELECTED GROUP, NOW OR SCHEDULED, WITHOUT A VISIBLE OR HIDDEN CAMPAIGN. THIS IS PART OF THE APPROVED MOCKUP AND CURRENT SOLUTION, NOT A FUTURE OPTIONAL FEATURE. IMPLEMENT C25 AND Q01–Q16 WITH REAL PER-PERSON ELIGIBILITY, TIME REVIEW, IDEMPOTENCY, PARTIAL/UNCERTAIN-SAVE RECOVERY, RESULTS/HISTORY AND CANCELLATION. REUSE THE SAME ENGINE AND SHARED WEB/NATIVE COMPONENTS; DO NOT CREATE A GROUP MODEL OR ANOTHER ENGINE WITHOUT A JUSTIFIED CURRENT NEED.**

**PHASES 1–5 MUST RECORD THIS EXTENSION'S VERIFIED PROGRESS AND NEXT OWNER IN THEIR BUILD STATE AND NEXT COPY-PASTE HANDOFF WITHOUT A REMINDER. PHASE 6 AUDITS IT END TO END AND HAS NO SUCCESSOR. EXISTING FULL MOCKUP APPROVAL, COMPONENT REUSE, CREATIVE FREEDOM WITHOUT ROUTINE REAPPROVAL, STARTUP SIMPLICITY, SECURITY/COST/PERFORMANCE/DATA QUALITY AND NO-UI-STUB REQUIREMENTS APPLY. OPEN THE STUDIO'S CALLS & CALLBACKS → CALL WITH AI STATES; REUSE `Mockup/quick-calls.js` AND `quick-calls.css` AS DESIGN/INTERACTION REFERENCES THROUGH THE REAL APP COMPONENTS.**

**This phase’s C25 responsibility:** Apply the same consent/withdrawal/suppression, allowed sends, follow-up/operational alerts and retention to each selected individual request. No batch consent or new group lifecycle. Verify withdrawal and deletion while requests are waiting.

## Mandatory two-way coverage, preview and reuse — final audit 4.1

**MUST READ AND FOLLOW `C:\Nik\Data\outbound-calls\Mockup\COVERAGE-AUDIT.md` IN FULL. CHECK BOTH DIRECTIONS: EVERY PROJECT REQUIREMENT MUST HAVE ITS INTERFACE/BEHAVIOR AND TEST; EVERY MOCKUP CAPABILITY MUST HAVE A PLAN REQUIREMENT, REAL CONTRACT, NAMED IMPLEMENTATION PHASE AND ACCEPTANCE TEST. THE MOCKUP IS FULLY OWNER-APPROVED, INCLUDING ITS REUSABLE COMPONENTS. NO FURTHER MOCKUP APPROVAL IS REQUIRED. DO NOT LOSE A MOCKUP FEATURE BECAUSE AN EARLIER PHASE DESCRIPTION WAS LESS DETAILED.**

**HOW TO VISUALIZE: OPEN `C:\Nik\Data\outbound-calls\Mockup\index.html` IN EDGE OR CHROME (POWERSHELL: `Start-Process 'C:\Nik\Data\outbound-calls\Mockup\index.html'`). NO INSTALL, BUILD OR SERVER IS NEEDED. INSPECT EVERY RELEVANT SCREEN/STATE, BOTH PRODUCT MENUS, ROLES, PHONE/TABLET/DESKTOP SIZES, WEB/NATIVE MODE AND SUPPORTED THEMES. USE OPEN FULL SCREEN AND ACTUALLY EXERCISE THE FLOWS; DO NOT REVIEW SCREENSHOTS ALONE.**

**HOW TO REUSE THE CODE: READ `C:\Nik\Data\outbound-calls\Mockup\COMPONENTS.md`. REUSE THE APPROVED TOKENS, ASSETS, CONTROL STRUCTURE, INTERACTION/RETURN PATTERNS AND RESPONSIVE LAYOUTS FROM `controls.js`, `controls.css`, `ui.js`, `styles.css`, `navigation.js`, `builder-tools.js`, `audience-ui.js`, `record-ui.js`, `campaign.js` AND `call-results.js` WHERE THEY FIT. START WITH THE VERIFIED REACT/NATIVE SHARED COMPONENTS MAPPED THERE. ADAPT THEM TO REAL STATE, LOCALIZATION, AUTHORIZATION AND APIs. NEVER COPY SYNTHETIC DATA, SIMULATED AI/CALLS/MESSAGES, GLOBAL DOM WIRING OR A TOAST AS A PRODUCTION INTEGRATION.**

**DATA QUALITY IS MANDATORY ALONGSIDE SECURITY, COST, PERFORMANCE AND FUNCTIONALITY: USE STABLE BUSINESS/RECORD/NUMBER IDENTITIES, E.164 NORMALIZATION, EXPLICIT TIME ZONES AND EVIDENCE PROVENANCE, FROZEN AUDIENCE/BRIEF VERSIONS, TYPED ANSWERS AND DISTINCT UNKNOWN/REFUSED/UNCONFIRMED STATES. COUNTS, CHARTS, HISTORY, FILTERED LISTS AND EXPORTS MUST AGREE. MUTATIONS MUST RENDER THE AUTHORITATIVE SAVED RESULT AND HANDLE CONCURRENCY/REPLAY. NEVER TREAT MISSING AS ZERO, NO, CONSENT OR SUCCESS. KEEP NECESSARY DATA WITHOUT SPECULATIVE FIELDS OR DUPLICATE SOURCES OF TRUTH.**

**APPLY CREATIVE JUDGMENT TO THE COMPLETE FUNCTIONALITY. DECIDE WHETHER EACH DETAIL MAKES SENSE IN THE REAL SYSTEM; REUSE, SIMPLIFY OR IMPROVE IT UNDER AUT-1 WITHOUT ROUTINE OWNER APPROVAL, INCLUDING JUSTIFIED NECESSARY SCHEMA/CONTAINER/ARCHITECTURE CHANGES. DO NOT OVERCOMPLICATE OR SILENTLY DROP A REQUIRED USER OUTCOME. RECORD THE RATIONALE AND UPDATE THE PLAN, COVERAGE REGISTER AND AFFECTED PROMPTS. ASK ONLY FOR A GENUINELY UNRESOLVED OR OWNER-DEPENDENT DECISION AFTER PRESENTING OPTIONS AND A RECOMMENDATION. EVERY EXPOSED CAPABILITY MUST WORK END TO END—NO UI STUBS.**


**DELIVERY SCHEDULE: FIVE IMPLEMENTATION PHASES (1–5), FOLLOWED BY PHASE 6, THE MULTIDIMENSIONAL END-TO-END AUDIT. EACH PHASE IS ONE SESSION. PLAN §26 RECORDS THE CONSOLIDATION REVIEW; NO REQUIRED FUNCTIONALITY WAS REMOVED.**

## Two-way audit implementation obligations for Phase 3

C08/C10/C13 and C15–C24: make pending consent requests, proof/expiry/withdrawal, signed paper evidence, handout upload/approval/copy/usage protection and queued/confirmed/failed delivery real. Implement safety-review decisions with actor/reason and separate provider resume, existing admin alerts, follow-up/notification/deep-link effects and retention. Ensure removal of one block never removes another source or grants consent. Update FAQ/privacy/terms wording only consistently with verified legal decisions.

## Mandatory owner direction — final review and delegation, 2026-10-03

**MUST READ AND FOLLOW: `C:\Nik\Data\outbound-calls\IMPLEMENTATION-CHARTER.md` IN FULL, THEN `C:\Nik\Data\outbound-calls\PLAN.md` AND THIS ENTIRE PROMPT. THE CHARTER RECORDS THE OWNER'S LATEST PROJECT-SPECIFIC INSTRUCTIONS AND TAKES PRECEDENCE OVER EARLIER CONTRARY APPROVAL WORDING, INCLUDING COPIED STANDARDS, SKILLS AND MEMORIES.**

**THE ENTIRE MOCKUP IS FULLY OWNER-APPROVED AS A STARTING POINT AND REFERENCE. YOU HAVE CREATIVE FREEDOM TO IMPROVE UI, FUNCTIONALITY, NECESSARY FEATURES, SOLUTION DESIGN, ARCHITECTURE, CONTRACTS AND NECESSARY SCHEMA—INCLUDING SQL/COSMOS FIELDS, INDEXES AND CONTAINER CHOICE—WITHOUT ROUTINE OWNER APPROVAL OR A NEW MOCKUP. DO NOT OVERCOMPLICATE: USE THE SIMPLEST CORRECT SOLUTION THAT BALANCES COST, SECURITY, PERFORMANCE, FUNCTIONALITY AND LOW-FRICTION PROVIDER/CUSTOMER USE. DO NOT ADD DATA WITHOUT A CURRENT NEED; REUSE EXISTING ADMIN ALERTS WHERE SUFFICIENT AND ALLOW LEGITIMATE REPEAT FEEDBACK. JUSTIFY COSMOS PLACEMENT AND REAL RU/THROUGHPUT COST. RESEARCH CONSENT OPTIONS AND OTHER UNSTABLE/LEGAL FACTS WITH CURRENT OFFICIAL SOURCES; DO NOT ASSUME AUTOMATIC CONSENT OR A LIABILITY DISCLAIMER MAKES CALLS LAWFUL. ASK ONLY FOR A GENUINELY UNRESOLVED/TRICKY OR OWNER-DEPENDENT DECISION, AFTER COMPARING OPTIONS AND GIVING YOUR RECOMMENDATION.**

**NO UI STUBS OR INCOMPLETE WIRING: EVERY EXPOSED CAPABILITY MUST HAVE REAL WORKING INTEGRATION, PERSISTENCE WHERE NEEDED, AUTHORITATIVE RESULTS, VALIDATION AND FAILURE/PERMISSION/LIMIT HANDLING. MATCH THE ACTUAL SHARED DROPDOWNS, CHECKBOXES, TEXT FIELDS AND ALL CONTROL STATES. KEEP THE UI MODERN, FUTURISTIC, BRANDED, PLAIN-SPOKEN, EASY TO NAVIGATE, SPACE-EFFICIENT AND RESPONSIVE ACROSS DESKTOP, TABLET, PHONE WEB AND NATIVE APPS. USE NATIVE STRENGTHS WITH VISIBLE ALTERNATIVES; KEEP SUMMARIES AND HISTORY CLOSE.**

**FULL MOCKUP APPROVAL AND COMPONENT REUSE: THE ENTIRE MOCKUP IS FULLY OWNER-APPROVED—SCREENS, COMPONENT DESIGNS, STATES, NAVIGATION AND INTERACTIONS. NO FURTHER DESIGN APPROVAL IS REQUIRED. READ `C:\Nik\Data\outbound-calls\Mockup\COMPONENTS.md` IN FULL AND REUSE ITS COMPONENT SOURCE/PATTERNS, TOKENS AND EXISTING-APP COMPONENT MAP. DROPDOWNS, TEXT BOXES, CHECKBOXES AND ALL OTHER CONTROLS MUST FOLLOW THE APPROVED THEME, DESIGN, COLORS, LUFGA FONT AND BEHAVIOR. START WITH THE APP'S REAL SHARED COMPONENTS, REUSE OR IMPROVE THEM, AND BIND REAL FUNCTIONALITY. THE BROWSER MOCKUP'S SYNTHETIC STATE IS NOT A PRODUCTION INTEGRATION. YOU HAVE CREATIVE FREEDOM TO IMPROVE ANY UI OR COMPONENT FOR CLARITY, RESPONSIVENESS, EASY NAVIGATION AND A BETTER PROVIDER/CUSTOMER EXPERIENCE WITHOUT ASKING FOR APPROVAL OR CREATING ANOTHER MOCKUP.**

**ONE PHASE = ONE SESSION. AFTER A PHASE IS TRULY COMPLETE, WITHOUT WAITING FOR ANOTHER REQUEST OR REMINDER, GIVE THE OWNER A COPY-PASTE NEXT-PHASE PROMPT IN THE FINAL CHAT AND THE MATCHING HANDOFF FILE: EXACT NEXT PROMPT PATH, BASIC PURPOSE, VERIFIED BUILD-STATE CONTEXT, CHARTER/PLAN PATHS AND RELEVANT GOTCHAS. DO NOT START THE NEXT PHASE AUTOMATICALLY. THE LAST PHASE HAS NO NEXT-PHASE HANDOFF.**


**Phase 3 completion handoff:** use `C:\Nik\Data\outbound-calls\phases\PHASE-4-PROMPT.md` for the next session and write `C:\Nik\Data\outbound-calls\phases\HANDOFF-TO-PHASE-4.md`. The final chat must include that exact next-prompt path, PLAN/charter paths, the next phase's purpose, verified completion context and real gotchas in one copy-paste block. Do not carry template placeholders into the final handoff.

## Complete functionality and campaign interaction requirements — owner direction, 2026-10-03

**IMPLEMENT ALL CAPABILITIES ASSIGNED TO THIS DEVELOPMENT PHASE WITH COMPLETE, WORKING INTEGRATION. DO NOT BUILD OR WIRE AN ACTION THAT HAS NO FUNCTIONALITY. NEVER SHIP OR MARK COMPLETE A STUB, PLACEHOLDER BUTTON, UNCONNECTED SCREEN, FAKE DATA PATH OR TOAST-ONLY SUCCESS. EVERY EXPOSED CONTROL MUST PERFORM ITS REAL OPERATION, PERSIST THE RESULT WHERE REQUIRED, UPDATE FROM THE AUTHORITATIVE RESPONSE, AND HANDLE VALIDATION, LOADING, FAILURE, PERMISSION AND LIMIT STATES. IF A DEPENDENCY IS MISSING, RESOLVE IT IN ITS RESPONSIBLE PHASE AND REPORT THE BLOCKER; DO NOT PRETEND THE FEATURE WORKS.** The isolated mockup's simulations are reference behavior only and must not be copied into integrated production code as functioning features. Phase 4 reconciles the approved reference to the backend and implements provider web/mobile in the same session; actual integration must be proved.

**FOLLOW THE OWNER'S CAMPAIGN INTERACTION REQUIREMENTS: SUPPORTING TASKS MUST RETURN TO THE SAME CAMPAIGN AND STEP WITH THE DRAFT INTACT; ACTUAL EXIT MUST OFFER KEEP EDITING, DISCARD CHANGES OR SAVE DRAFT & LEAVE. SAVED BRIEFS AND DRAFTING NEED CLEAR PURPOSE, REVIEW AND APPLY FLOWS. CONVERSATION SECTIONS MUST BE CLEAR AND RESPONSIVE. HANDOUTS MUST SUPPORT ADD, ACTUAL PREVIEW, APPROVAL, EDIT/COPY AND REMOVAL INSIDE THE BUILDER; A HANDOUT USED BY ANOTHER CAMPAIGN MUST NOT BE DELETED OR OVERWRITTEN. VOICES, LANGUAGES, SAMPLES AND SPEAKING-STYLE GUIDANCE MUST FOLLOW THE ACTUAL AI ASSISTANT SETTINGS. EXPLAIN PER-PERSON LOCAL CALLING HOURS, THEIR SOURCE AND UNKNOWN-ZONE HOLDS. ALL CHOICES MUST PERSIST AND APPEAR ACCURATELY IN REVIEW.** Apply each requirement within this phase's assigned responsibility; preserve the approved business rules and the latest charter’s decision boundaries. Do not guess production routes, contracts, schemas or settings.

**LATEST OWNER UX DIRECTION — INLINE FIRST, BOUNDED AUDIENCES, RELEVANT LOCAL WORDING (2026-10-03): KEEP SMALL CHOICES DIRECTLY IN THE PAGE WHEN THEY FIT; THE THREE ASSISTANT-INFORMATION CHECKBOXES BELONG IN CONVERSATION, WITHOUT AN EXTRA PICKER OR SAVE-SELECTION CLICK. ROOT DIALOGS CLOSE WITH ONE CLEAR ACCESSIBLE CLOSE CONTROL; RETAIN BACK FOR A REAL NESTED RETURN AND RETAIN UNSAVED-CHANGE PROTECTION. CALLING HOURS SHOW AUDIENCE COUNTS FIRST, THEN AN INLINE SEARCHABLE, FILTERED, PAGED LIST WITH A BOUNDED NUMBER OF ROWS—NEVER ALL 500 OR 5,000 PEOPLE AT ONCE. PEOPLE AND PERMISSION REVIEW MUST ALSO REMAIN BOUNDED AND PRESERVE SELECTIONS. PERSONALIZE EXPLANATORY COPY USING THE ACTUAL SELECTED CONTACTS’ DESTINATION COUNTRY AND TIME-ZONE BASIS, NOT UI LANGUAGE, A GUESSED COUNTRY FROM +1, OR ONLY THE PROVIDER’S COUNTRY. A DOMESTIC AUDIENCE MUST NOT SEE UNRELATED COUNTRY NAMES; MIXED AUDIENCES USE NEUTRAL PRIMARY COPY AND RELEVANT PER-DESTINATION DETAIL. UNKNOWN LOCATION STAYS HELD. KEEP SOURCE, HOLDS, COUNTS, ESTIMATES, SAVED DRAFT AND FINAL REVIEW CONSISTENT; KNOWN HOURS NEVER IMPLY CALLING PERMISSION.** Use real bounded queries and authoritative rules during implementation; mockup examples are not integrations. Preserve PLAN’s calling, consent and billing rules and the charter’s decision boundaries. These refinements are within the owner-approved UI freedom; no renewed UI approval or new mockup is needed.

Read `C:\Nik\Data\outbound-calls\Mockup\REVIEW.md` and `C:\Nik\Data\outbound-calls\Mockup\INTERACTION-REVIEW.md` fully, including version 4.1 and earlier findings and verification limits. Its screen-by-screen review and operation/return-path acceptance requirements supplement the approved mockup and PLAN. Include the actual control-to-operation bindings and end-to-end success/failure/permission evidence in the phase handoff. UI improvement freedom and existing owner approval remain unchanged; no new mockup or renewed UI approval is required.


## Owner approval and UI creative freedom — 2026-10-02

**THE OWNER HAS APPROVED THE OUTBOUND AI CALLS MOCKUP AND THE REFINEMENTS MADE DURING THE FULL PROJECT REVIEW. `C:\Nik\Data\outbound-calls\Mockup\index.html` IS AN APPROVED STARTING POINT AND REFERENCE, NOT A RIGID PIXEL BLUEPRINT.** The owner said: “I'm approving all of it” and asked that implementing sessions be given creative freedom.

**EVERY SESSION IMPLEMENTING THESE PHASES MAY IMPROVE THIS FEATURE'S UI WITHOUT ASKING FOR ANOTHER OWNER APPROVAL AND WITHOUT CREATING ANOTHER MOCKUP FILE.** Exercise that freedom to make the interface **modern, futuristic and attractive; consistent with Clinket's real product branding, colours and Lufga font; easy to understand and navigate; clean and nontechnical in its language; complete against the requirements and every reachable state; fully responsive on desktop, mobile web and iPad/tablet; equally complete in the native mobile apps; and efficient in its use of space without dead areas, overcrowding or broken layouts. Harness native capabilities such as long press, swipe, bottom sheets, appropriate haptics, refresh, safe areas, accessibility and deep links, with visible alternatives to gestures. Critical information—including summaries, call history, recordings and next steps—must be directly accessible and must not require five or six pages of navigation.** Re-read the actual Business and AI Assistant dashboards and their web/native navigation before integrating. Improve navigation, hierarchy, density and interaction where useful while preserving requirements, rendering rules and web/mobile parity. Record the rationale and verification in the phase handoff; do not turn that record into another approval gate. A file-by-file UI plan is documentation, not another permission step: do not pause to approve UI layout, wording that preserves its meaning, density, navigation or interaction improvements.

**THIS IS AN EXPLICIT, PROJECT-SPECIFIC EXCEPTION TO THE RE-APPROVAL AND NEW-MOCKUP GATES FOR UI IMPROVEMENTS IN OUTBOUND AI CALLS, INCLUDING AN IMPROVED SCREEN OR STATE NEEDED TO MEET THE EXISTING REQUIREMENTS. DO NOT ASK THE OWNER AGAIN FOR THIS UI FREEDOM.** It supersedes contrary generic mockup rules, the earlier deferral and any narrower wording later in this prompt or its verbatim historical standards. The owner also explicitly chose the project-local `Mockup` folder; retain that location and its PLAN §0.4 register.

The original 2026-10-02 ruling approved the design. **The owner's later AUT-1 delegation broadens implementation freedom as set out in IMPLEMENTATION-CHARTER.md; earlier routine plan/schema reapproval waits are superseded.** No development phase is completed by a design approval. Legal eligibility, security, real integration, full localization and native-device verification remain implementation obligations. Do not invent a per-item approval or treat the delegation as permission for unrequested live deployment/calls.


> **New session.** You complete the backend of Clinket's outbound AI calling: recorded consent for promotional calls
> (five ways), customer-ready handouts the AI can send, and everything that operates the engine — notifications,
> analytics events, activity rows, automatic safety pause, and the data lifecycle. Phases 1–2 built the control plane,
> minutes, contact permissions, rules engine, API, and the calling engine.
>
> **Programme authority:** `C:\Nik\Data\outbound-calls\PLAN.md` (approved by the owner 2026-09-25).
> **Previous phases:** `C:\Nik\Data\outbound-calls\findings\PHASE-1-BUILD-STATE.md`, `PHASE-2-BUILD-STATE.md` — read
> both; they override this prompt where they recorded an owner ruling or a change.
> **Next phase prompt:** `C:\Nik\Data\outbound-calls\phases\PHASE-4-PROMPT.md`.
> **Your build log:** `C:\Nik\Data\outbound-calls\findings\PHASE-3-BUILD-STATE.md` (you create it).

---

## 0. Before anything else — mandatory reading, in order, every file end to end

**First read IMPLEMENTATION-CHARTER.md in full; it is mandatory and takes precedence over routine approval waits in earlier instructions.**

List each item in your first reply and confirm you read it end to end. If a path does not exist, say which one.

1. `C:\Nik\CLAUDE.md` — all of it.
2. `C:\Nik\Data\outbound-calls\PLAN.md` — all of it. This phase lives in §9 (especially §9.5–§9.7), §10, §15.3,
   §15.4, §19, §20, §21, §22 (Consent, Sending, Abuse rows), §25 (#7, #10, #14).
3. Both build-state files and any "Changes from Phase 2" section at the top of this file.
4. Skills, fully: `clinqet-outbound-calls`, `clinqet-whatsapp`, `clinqet-notifications`, `clinqet-analytics`,
   `clinqet-media-derivatives`, `clinqet-delivery-feedback`, `clinqet-provider-teams` (activity feed),
   `clinqet-provider-public-page`, `clinqet-booking-lifecycle`, `clinqet-user-app` (booking flow contracts),
   `clinqet-identity-api` (verified phone), `clinqet-voice-assistant`, `clinqet-integration-health`,
   `clinqet-deployment`, `clinqet-testing`.
5. Memory: `MEMORY.md`, every `feedback-*.md`, and `whatsapp-chat-relay-built-2026-09-21.md`,
   `delivery-failure-feedback-2026-09-20.md`, `notification-routes-dead-ends-2026-08-09.md`,
   `knowledge-delivery-locked-design-2026-08-20.md`, `integration-health-alerts-2026-09-19.md`, and the WhatsApp
   template entries named in `MEMORY.md` (templates are Meta-approved per language; non-English ones can be
   classified MARKETING).
6. Code, end to end:
   - Consent today: `clinqetapi\Clinqet.API\Controllers\WhatsApp\WhatsAppConsentController.cs`, the WhatsApp consent
     store (`wac_`), `clinqetshared\Enums\WhatsAppConsentSource.cs`; the Phase 1 contact-permissions store.
   - Sending: the WhatsApp template sender and template registry, the email sender and templates
     (`Resources\EmailTemplates\{lang}\`), the SMS sender (CA/US) and the India OTP path, the existing one-time-code
     services used by the public page booking.
   - Notifications: `NotificationType`, the routing catalogue, `SignalRSettings:EnabledNotificationTypes` in the Main
     API `appsettings.json`, `CommunicationDispatcher`, preference mapping, push.
   - Analytics: the event type registry and the pipeline you add events to (additive only).
   - Activity: `clinqetcore\Entities\COSMOS\BusinessActivity.cs` and its writer.
   - Uploads: the SAS → blob → confirm → derivative pattern, `azureautomation\storage.json` (containers, lifecycle
     rules), the storage options class.
   - Booking creation: customer web, customer mobile and public-page booking endpoints (where the consent checkbox
     lands).
   - Closure: `clinqetinfrastructure\Services\Tenancy\BusinessClosureTeardown.cs`.
   - The existing tests of every class you change.

---

## Required consent research and simplification check

**Before implementing or revising calling eligibility/evidence, perform the charter §4 review using current official sources for each supported country and purpose. Compare existing evidence, lawful relationship bases, provider attestations, opt-out handling and any required customer permission. Record the decision and source links in the build state and update PLAN consistently. Do not adopt automatic consent or a liability disclaimer by assumption. Phase 1 owns the rules/data implications; Phase 3 implements the researched capture/enforcement workflow. Later phases verify the same decision throughout UI, FAQs/privacy information and tests. Escalate only genuinely unresolved legal/business choices with options and a recommendation.**

## 1. What this phase delivers (PLAN references)

**W1 — Consent capture (§9.6, F2).**
- **Consent link (Canada, US):** a provider sends a Clinket consent page to a contact by WhatsApp template or email;
  the page API (anonymous, token-bound, short-lived) shows the business and the exact wording version in the
  person's language, verifies the phone with a one-time code, takes the typed name and an unticked checkbox, and stores
  signed consent (wording version, time, language, evidence snapshot). The same page withdraws consent.
- **Booking checkbox:** optional, unticked, on the customer web app, customer mobile app and the business's public
  page booking — the booking APIs accept and record it with the wording version. Canada: valid. US: valid only when
  signed in with a verified phone.
- **Inbound AI question:** the AI may ask whether the person wants offers by phone. Canada: a recorded yes counts
  (recording must be on). US: the AI sends the consent link instead.
- **Paper form (Canada only):** image or PDF upload as evidence, uploader recorded.
- **India:** promotional calls stay blocked with a clear reason until an operator consent connection exists (out of
  scope, PLAN §3). Do not build a manual reference field that pretends to be verified.

**W2 — Consent rules (§9.6, §10).** Stop always wins; withdrawal anywhere (on a call, on the page, by the provider
recording the person's request); expiry per country (settings); the Phase 1 evaluator now returns satisfied for
promotional calls only with valid, unexpired, unwithdrawn consent for **this** business; provider attestation alone is
never enough. A withdrawal cancels queued promotional work for that number.

**W3 — Handouts (D9, §15.3).** Upload (PDF or image, ≤ 10 MB, type checked by content not just extension), preview,
explicit approval, attach to a brief, an AI tool that sends an approved handout by WhatsApp (template) or email, delivery
tracking through the delivery-feedback layer. Separate from knowledge files; a knowledge file is still never sent whole.

**W4 — WhatsApp templates** for the consent link and handout delivery, in every language, registered the way existing
templates are. Meta approval is the owner's action (§0.3 #7) — say exactly what to submit.

**W5 — Notifications (§20).** Campaign finished; paused (minutes, cap, safety, admin); a person asked for the team; a
question needs follow-up. New types wired end to end (enum, routing catalogue, SignalR enabled list, localization ×5,
preferences, push). No push per call (memory `feedback-notification-restraint-honest-recs`).

**W6 — Analytics events** for outbound (campaign lifecycle, call outcomes, answers captured, opt-outs, consent
captured) — additive only, never a rename or reorder.

**W7 — Activity rows (§19):** campaign created, launched, paused, resumed, stopped — who and when.

**W8 — Automatic pause + admin alerts (§19):** opt-outs above 5% of connected calls after ≥ 20 connected; a spike in
hang-ups under 10 seconds; carrier spam signals (Telnyx SIP 603 with an analytics reason, Plivo cause 3130).
Thresholds are settings. Admin alert wording may be English (CLAUDE.md §3.6).

**W9 — Data lifecycle (§21):** a scheduled job deletes outbound call results after 12 months; business closure purges
handouts and **voice recordings and transcripts** (§25 #7), keeps contact-permission records and their proof for 5 years
after the last change (Phase 1 set the TTLs; consent evidence blobs need the same life).

**W10 — Skills and memory:** update `clinqet-outbound-calls`, `clinqet-whatsapp`, `clinqet-notifications`,
`clinqet-analytics`, `clinqet-provider-public-page`, `clinqet-booking-lifecycle` (four locations each) and memory.

**Out of scope here:** integrated screens (Phases 4–5) — this phase builds the APIs those screens call.

---

## 2. Resolve and document these decisions before coding (ask only under the charter)

1. **Schema** — §0.7 tables for consent records/events/evidence references (confirm Phase 1's structure or extend it),
   consent link tokens (TTL), handout records, any new notification/analytics/activity fields, and enum values in
   stored fields.
2. **Storage** — containers or prefixes for handouts and consent evidence, lifecycle rules (evidence lives 5 years),
   ARM + `deploy.ps1`; malware scanning for uploads (cost).
3. **Canadian recorded consent outlives the recording** — recordings and transcripts expire after 90 days, but the proof
   of a recorded "yes" must live as long as the consent. Recommend how to keep only the minimal proof (e.g. the consent
   segment and its transcript excerpt) as evidence.
4. **Canada's anti-spam law (CASL):** a message that asks for consent is itself a commercial electronic message, so a
   consent-link email or WhatsApp message in Canada needs its own basis (e.g. an existing business relationship),
   sender identification and an unsubscribe. Recommend the rule and how the engine enforces it. US equivalents too.
5. **Which permission** may send consent links and upload paper forms.
6. **One-time-code channel** for the consent page per country.
7. **What the consent page records** (IP address, device) — evidence strength vs privacy; recommend the minimum.
8. **Wording** of the consent page, checkbox and AI question (English first; translations follow; legal read-through is
   owner action §0.3 #4).
9. **Notification types and channels.**
10. Anything in PLAN.md the code contradicts.

---

## 3. Traps (verified 2026-09-25 — re-verify before relying)

- The existing WhatsApp consent endpoint is **anonymous and can opt any number in or out** (§25 #10). The consent page
  must never repeat that: every write is bound to a token and a verified phone.
- A phone call does not open WhatsApp's 24-hour window — every WhatsApp send from a call needs an approved template.
- India SMS is one-time codes only (2Factor, DLT); business numbers are voice-only; `+18449254651` is the platform SMS
  sender for Canada/US and must never become a caller ID.
- Emails have no unsubscribe header or link today (§25 #14).
- Recordings and transcripts expire after 90 days (`voiceArtifactRetentionDays` = `CallSummaryTtlDays` =
  `VoiceDataRetentionDays`, all three must stay equal).
- `BusinessClosureTeardown` does not sweep `SystemData` and does not delete voice blobs.
- New notification types need the SignalR enabled list or they never arrive in real time.
- Analytics schemas are additive only; never rename or reorder a field.
- The anti-spam and consent rules differ by country — never let one country's rule leak into another's code path.

---

## 4. Edge cases (PLAN §22 Consent, Opt-out, Sending, Abuse rows), plus

Consent link opened twice · expired or reused token · wrong one-time code limits · the phone on the page differs from
the contact's · consent given, then "stop calling me" on a call · consent withdrawn while a promotional call is queued
or ringing · booking checkbox ticked by a signed-out US customer · consent from a paper form for a US number (refused) ·
two businesses asking the same person · handout replaced after approval · handout deleted while attached to a running
brief · a send to a person without WhatsApp · auto-pause thresholds on tiny campaigns · the retention job and a
running campaign · closure while a campaign is running.

---

## 5. Tests

Unit and integration in the suite of the host that runs the code (§0.18); real engines for consent writes (Cosmos
batches), token single-use, one-time-code limits, handout upload validation, Service Bus processors, the retention job,
closure purge; cross-tenant isolation for every consent and handout endpoint; sabotage-verify each guard.

---

## 6. Rules that apply to every step of this phase

Read `C:\Nik\CLAUDE.md` in full — every §0 rule applies. These are the ones this programme hits most:

1. **Golden rule (owner, master prompt §26.5).** Never assume a material fact. If you find uncertainty, a loophole,
   a gap, an inconsistency, a non-best-practice decision, a risk or a missing design point: stop, analyse it, tell
   the owner the concern with your recommendation, and ask only if the decision remains unresolved after applying the charter.
   Asking is always cheaper than a wrong assumption.
2. **Challenge the instruction.** PLAN.md and this prompt were written from code read on 2026-09-25. If the code now
   says otherwise, or an instruction is wrong, unsafe or not best practice, prove it (file:line), recommend the fix
   and resolve it under AUT-1; ask only when genuinely unresolved. Following a bad instruction correctly is still a failure (`feedback-challenge-the-instruction-not-just-follow-it`).
3. **Owner delegation before implementation.** Document this phase's concrete plan — files per repo, schema, infrastructure,
   settings, tests — and record the chosen approach under AUT-1. Proceed without a routine approval wait; ask only for unresolved decisions under the charter.
4. **Schema discipline under AUT-1.** Before changing SQL/Cosmos/Search schema, document the exact item/type,
   current reader/writer, alternatives checked, cost and what breaks if omitted. The owner has delegated necessary
   schema decisions for this project: do not wait for item-by-item approval. Record the justification in PLAN §0.5
   under AUT-1; test the actual database behavior and respect all partition, migration and security invariants.
5. **Cosmos:** never a cross-partition query — no override. Read `C:\Nik\cosmosindexsetup\Program.cs` before any new
   query; point reads over queries; atomic PATCH for counters; ETag where there are several writers.
6. **Infrastructure gate.** A new Service Bus queue, storage container, Azure resource or `local.settings.json` key
   ships with ARM + `deploy.ps1` (and the `ServiceBusSettings` list, which `deploy.ps1` checks) in the same change.
   Justify necessary cost under AUT-1; ask only for unresolved cost/business decisions. Unrequested live purchases and deployment remain separate actions.
7. **Pre-production:** no feature flags, no stubs, no backward-compatibility code, no backfill — data can be reset.
   Delete what your change orphans (code, settings, DI registrations, keys).
8. **No hardcoded user-facing text.** Every string is a key in every language file: API
   `clinqetinfrastructure\Resources\Localization\{en,es,fr,gu,hi}.json`; email templates one JSON per language under
   `Resources\EmailTemplates\{lang}\`; spoken lines for every voice language. No technical words anywhere a provider or
   customer can read or hear.
9. **Code rules:** every `IMemoryCache` write sets `Size = 1`; structured logging only, phone numbers masked; enums
   serialize as strings; tunables in appsettings with options classes whose defaults mirror the JSON (collection
   defaults are APPENDED by the binder); `TimeProvider` for time; `IHttpClientFactory`; idempotent Service Bus
   handlers; no infinite retries; comments only for a non-obvious why, one short line.
10. **Tests:** unit AND integration for every new path. Real engines (Testcontainers SQL + the Cosmos emulator) are
    mandatory for money, schema, unique constraints, atomic counters, webhooks and Service Bus processors. Tests live
    in the suite of the host that runs the code (§0.18) and read only their own repo (§0.17). RED first.
11. **Builds:** never build or test while another session is building — ask the owner for an exclusive window; batch
    builds; run only the tests your change can reach; never leave code that does not compile.
12. **Git:** NEVER `git checkout --`, `git restore`, `git reset`, `git stash`, `git clean` — other sessions'
    uncommitted work lives in these trees. History is linear: never `git pull` or `git merge`; use `git fetch origin`
    + `git rebase origin/master` on a clean tree; `git rev-list --merges origin/master..HEAD` must print nothing.
    Commit only when the owner asks; never push. Commit order (the owner pushes in it): `clinqetshared` →
    `clinqetcore` → `clinqetinfrastructure` → non-hosts (`cosmosindexsetup`, web apps, mobile apps,
    `azureautomation`) → hosts last (`clinqetfuncations`, `clinqetapi`, `clinqetmcp`, `clinqetidentity`).
13. **Shared trees.** Other sessions edit these repos at the same time. Re-read a file immediately before editing it;
    never overwrite a change you did not make.
14. **Leave the tree clean.** Scratch files only in your session scratchpad; delete them; before reporting done, show
    `git status --porcelain` for every repo you touched and account for every line.
15. **Messages and calls to real people are outward actions.** Live tests only to recipients the owner names, only in
    dev, only after the owner says go.

---

## 7. Audit — before this phase can be called complete (master prompt §28)

Audit ALL work of this phase across: bugs · logical gaps · missing functionality · performance · memory leaks · CPU
problems · thread safety · async/concurrency · resource handling · correctness · feature completeness · security and
tenant isolation · privacy and compliance per country · data flow · localization. The two that matter most: **no gaps
or bugs** and **no missing functionality**.

Method: re-read every changed file end to end; walk each consent way from capture to the dial-time decision and to
withdrawal, per country; walk each handout from upload to delivery; trigger each notification and each auto-pause
rule; run the retention job and a closure against real engines; sabotage-verify each guard. Fix every finding; review
each fix; verify it closes the finding and creates no new problem. Only then mark the phase complete. Record findings,
fixes and evidence in the build-state file.

---

## 8. Completion and handoff

1. Write `C:\Nik\Data\outbound-calls\findings\PHASE-3-BUILD-STATE.md` (as Phases 1–2 did), including **the complete
   list of backend endpoints and payloads the screens will call** — Phase 4 maps every provider control to its real operation.
2. Update PLAN.md: §0.1, §0.5, §0.6, and every section the owner changed.
3. Skills (four locations) and memory, as in W10.
4. Leave the tree clean (rule 14) and report it.
5. Read `phases\PHASE-4-PROMPT.md`; add a dated "Changes from Phase 3" section at its top if anything it relies on
   changed.
6. Write the handoff to `C:\Nik\Data\outbound-calls\phases\HANDOFF-TO-PHASE-4.md` **and** paste the same text in the
   chat in one fenced code block, saying they are the same:

```text
Outbound AI Calls — Phase 4 of 6: Provider UI and backend-contract reconciliation.
Read C:\Nik\Data\outbound-calls\phases\PHASE-4-PROMPT.md end to end first and follow it exactly (mandatory reading,
rules, coding standards, the mockup rules, audit, handoff).
Context: the backend is complete (Phases 1–3) — <two lines>. Endpoint list: C:\Nik\Data\outbound-calls\findings\
PHASE-3-BUILD-STATE.md. The complete mockup is already approved; reconcile real contracts and implement the provider UI under the charter.
Read C:\Nik\Data\outbound-calls\IMPLEMENTATION-CHARTER.md and C:\Nik\Data\outbound-calls\PLAN.md in full.
Gotchas: <replace with 2–4 verified details before delivering the handoff>.
Use the owner delegation in IMPLEMENTATION-CHARTER.md; ask only when genuinely unresolved.
```

---

## 9. Coding standards (historical wording; latest charter takes precedence)

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
* **Mockups for New Views:** For this project, the entire mockup is already approved. The latest charter permits UI improvements or new necessary screens without another approval or mandatory mockup. Use the approved reference and verify the final experience.

## 🛡️ 5. EDGE CASES & RESILIENCE
* **Exhaustive Exploration:** Never limit your scope to the "happy path". You must anticipate, explore, and handle every possible edge case.
* **Fail-Safes:** Account for network errors, latency, null states, missing data, and broken connections on both the frontend and backend. The solution must survive all of them gracefully.

## 💬 6. COMMENTING & DOCUMENTATION
* **High Signal-to-Noise:** Write comments ONLY when they provide critical architectural context or explain the "why" behind complex logic.
* **No Verbosity:** Absolutely no redundant, obvious, or verbose comments. Let the clean code speak for itself.

## 💡 7. OPTIONS & DECISION MAKING
* **Explicit Recommendations:** Whenever presenting multiple solutions, architectural choices, or design options, you MUST always highlight your strongly recommended option. 
* **Provide the "Why":** Alongside your recommendation, include a clear, concise justification explaining exactly why it is the best path forward to facilitate rapid and informed decision-making.

Where these standards and `C:\Nik\CLAUDE.md` overlap, follow both; where one is stricter (e.g. CLAUDE.md §0.14 on
comments), the stricter technical safeguard wins. The charter explicitly supersedes routine approval waits; do not use this paragraph to reinstate them. Ask only when genuinely unresolved under the charter.
