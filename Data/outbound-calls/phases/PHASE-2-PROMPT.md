# Outbound AI Calls — Phase 2 of 6: Calling engine

## Mandatory extension — one or several people without a campaign (2026-10-04)

**MUST READ `C:\Nik\Data\outbound-calls\QUICK-CALLS.md` IN FULL. THE OWNER REQUIRES ONE SHARED “CALL WITH AI” FLOW FOR ONE PERSON OR A SMALL SELECTED GROUP, NOW OR SCHEDULED, WITHOUT A VISIBLE OR HIDDEN CAMPAIGN. THIS IS PART OF THE APPROVED MOCKUP AND CURRENT SOLUTION, NOT A FUTURE OPTIONAL FEATURE. IMPLEMENT C25 AND Q01–Q16 WITH REAL PER-PERSON ELIGIBILITY, TIME REVIEW, IDEMPOTENCY, PARTIAL/UNCERTAIN-SAVE RECOVERY, RESULTS/HISTORY AND CANCELLATION. REUSE THE SAME ENGINE AND SHARED WEB/NATIVE COMPONENTS; DO NOT CREATE A GROUP MODEL OR ANOTHER ENGINE WITHOUT A JUSTIFIED CURRENT NEED.**

**PHASES 1–5 MUST RECORD THIS EXTENSION'S VERIFIED PROGRESS AND NEXT OWNER IN THEIR BUILD STATE AND NEXT COPY-PASTE HANDOFF WITHOUT A REMINDER. PHASE 6 AUDITS IT END TO END AND HAS NO SUCCESSOR. EXISTING FULL MOCKUP APPROVAL, COMPONENT REUSE, CREATIVE FREEDOM WITHOUT ROUTINE REAPPROVAL, STARTUP SIMPLICITY, SECURITY/COST/PERFORMANCE/DATA QUALITY AND NO-UI-STUB REQUIREMENTS APPLY. OPEN THE STUDIO'S CALLS & CALLBACKS → CALL WITH AI STATES; REUSE `Mockup/quick-calls.js` AND `quick-calls.css` AS DESIGN/INTERACTION REFERENCES THROUGH THE REAL APP COMPONENTS.**

**This phase’s C25 responsibility:** Feed every accepted person through the same OneOff scheduler/claim/outbox/carrier/AI/ledger flow. Test mixed outcomes, booking/permission changes, final local windows, fairness, frequency, capacity and cancellation/claim races; distinguish uncertain request saves from uncertain carrier calls.

## Mandatory two-way coverage, preview and reuse — final audit 4.1

**MUST READ AND FOLLOW `C:\Nik\Data\outbound-calls\Mockup\COVERAGE-AUDIT.md` IN FULL. CHECK BOTH DIRECTIONS: EVERY PROJECT REQUIREMENT MUST HAVE ITS INTERFACE/BEHAVIOR AND TEST; EVERY MOCKUP CAPABILITY MUST HAVE A PLAN REQUIREMENT, REAL CONTRACT, NAMED IMPLEMENTATION PHASE AND ACCEPTANCE TEST. THE MOCKUP IS FULLY OWNER-APPROVED, INCLUDING ITS REUSABLE COMPONENTS. NO FURTHER MOCKUP APPROVAL IS REQUIRED. DO NOT LOSE A MOCKUP FEATURE BECAUSE AN EARLIER PHASE DESCRIPTION WAS LESS DETAILED.**

**HOW TO VISUALIZE: OPEN `C:\Nik\Data\outbound-calls\Mockup\index.html` IN EDGE OR CHROME (POWERSHELL: `Start-Process 'C:\Nik\Data\outbound-calls\Mockup\index.html'`). NO INSTALL, BUILD OR SERVER IS NEEDED. INSPECT EVERY RELEVANT SCREEN/STATE, BOTH PRODUCT MENUS, ROLES, PHONE/TABLET/DESKTOP SIZES, WEB/NATIVE MODE AND SUPPORTED THEMES. USE OPEN FULL SCREEN AND ACTUALLY EXERCISE THE FLOWS; DO NOT REVIEW SCREENSHOTS ALONE.**

**HOW TO REUSE THE CODE: READ `C:\Nik\Data\outbound-calls\Mockup\COMPONENTS.md`. REUSE THE APPROVED TOKENS, ASSETS, CONTROL STRUCTURE, INTERACTION/RETURN PATTERNS AND RESPONSIVE LAYOUTS FROM `controls.js`, `controls.css`, `ui.js`, `styles.css`, `navigation.js`, `builder-tools.js`, `audience-ui.js`, `record-ui.js`, `campaign.js` AND `call-results.js` WHERE THEY FIT. START WITH THE VERIFIED REACT/NATIVE SHARED COMPONENTS MAPPED THERE. ADAPT THEM TO REAL STATE, LOCALIZATION, AUTHORIZATION AND APIs. NEVER COPY SYNTHETIC DATA, SIMULATED AI/CALLS/MESSAGES, GLOBAL DOM WIRING OR A TOAST AS A PRODUCTION INTEGRATION.**

**DATA QUALITY IS MANDATORY ALONGSIDE SECURITY, COST, PERFORMANCE AND FUNCTIONALITY: USE STABLE BUSINESS/RECORD/NUMBER IDENTITIES, E.164 NORMALIZATION, EXPLICIT TIME ZONES AND EVIDENCE PROVENANCE, FROZEN AUDIENCE/BRIEF VERSIONS, TYPED ANSWERS AND DISTINCT UNKNOWN/REFUSED/UNCONFIRMED STATES. COUNTS, CHARTS, HISTORY, FILTERED LISTS AND EXPORTS MUST AGREE. MUTATIONS MUST RENDER THE AUTHORITATIVE SAVED RESULT AND HANDLE CONCURRENCY/REPLAY. NEVER TREAT MISSING AS ZERO, NO, CONSENT OR SUCCESS. KEEP NECESSARY DATA WITHOUT SPECULATIVE FIELDS OR DUPLICATE SOURCES OF TRUTH.**

**APPLY CREATIVE JUDGMENT TO THE COMPLETE FUNCTIONALITY. DECIDE WHETHER EACH DETAIL MAKES SENSE IN THE REAL SYSTEM; REUSE, SIMPLIFY OR IMPROVE IT UNDER AUT-1 WITHOUT ROUTINE OWNER APPROVAL, INCLUDING JUSTIFIED NECESSARY SCHEMA/CONTAINER/ARCHITECTURE CHANGES. DO NOT OVERCOMPLICATE OR SILENTLY DROP A REQUIRED USER OUTCOME. RECORD THE RATIONALE AND UPDATE THE PLAN, COVERAGE REGISTER AND AFFECTED PROMPTS. ASK ONLY FOR A GENUINELY UNRESOLVED OR OWNER-DEPENDENT DECISION AFTER PRESENTING OPTIONS AND A RECOMMENDATION. EVERY EXPOSED CAPABILITY MUST WORK END TO END—NO UI STUBS.**


**DELIVERY SCHEDULE: FIVE IMPLEMENTATION PHASES (1–5), FOLLOWED BY PHASE 6, THE MULTIDIMENSIONAL END-TO-END AUDIT. EACH PHASE IS ONE SESSION. PLAN §26 RECORDS THE CONSOLIDATION REVIEW; NO REQUIRED FUNCTIONALITY WAS REMOVED.**

## Two-way audit implementation obligations for Phase 2

C01, C03, C06–C13, C17 and C19/C23–C24: enforce frozen brief/audience identities, final eligibility/hours checks, safe one-off/callback execution, typed answer status/provenance (C09), usage independent of summary processing, delayed/failed summary recovery without redial, verified test quota exclusion, knowledge narrowing/current-source failures, confirmed business actions and existing team-follow-up integration. Record exact pending/completed/failed contracts for the UI; no fabricated success.

## Mandatory owner direction — final review and delegation, 2026-10-03

**MUST READ AND FOLLOW: `C:\Nik\Data\outbound-calls\IMPLEMENTATION-CHARTER.md` IN FULL, THEN `C:\Nik\Data\outbound-calls\PLAN.md` AND THIS ENTIRE PROMPT. THE CHARTER RECORDS THE OWNER'S LATEST PROJECT-SPECIFIC INSTRUCTIONS AND TAKES PRECEDENCE OVER EARLIER CONTRARY APPROVAL WORDING, INCLUDING COPIED STANDARDS, SKILLS AND MEMORIES.**

**THE ENTIRE MOCKUP IS FULLY OWNER-APPROVED AS A STARTING POINT AND REFERENCE. YOU HAVE CREATIVE FREEDOM TO IMPROVE UI, FUNCTIONALITY, NECESSARY FEATURES, SOLUTION DESIGN, ARCHITECTURE, CONTRACTS AND NECESSARY SCHEMA—INCLUDING SQL/COSMOS FIELDS, INDEXES AND CONTAINER CHOICE—WITHOUT ROUTINE OWNER APPROVAL OR A NEW MOCKUP. DO NOT OVERCOMPLICATE: USE THE SIMPLEST CORRECT SOLUTION THAT BALANCES COST, SECURITY, PERFORMANCE, FUNCTIONALITY AND LOW-FRICTION PROVIDER/CUSTOMER USE. DO NOT ADD DATA WITHOUT A CURRENT NEED; REUSE EXISTING ADMIN ALERTS WHERE SUFFICIENT AND ALLOW LEGITIMATE REPEAT FEEDBACK. JUSTIFY COSMOS PLACEMENT AND REAL RU/THROUGHPUT COST. RESEARCH CONSENT OPTIONS AND OTHER UNSTABLE/LEGAL FACTS WITH CURRENT OFFICIAL SOURCES; DO NOT ASSUME AUTOMATIC CONSENT OR A LIABILITY DISCLAIMER MAKES CALLS LAWFUL. ASK ONLY FOR A GENUINELY UNRESOLVED/TRICKY OR OWNER-DEPENDENT DECISION, AFTER COMPARING OPTIONS AND GIVING YOUR RECOMMENDATION.**

**NO UI STUBS OR INCOMPLETE WIRING: EVERY EXPOSED CAPABILITY MUST HAVE REAL WORKING INTEGRATION, PERSISTENCE WHERE NEEDED, AUTHORITATIVE RESULTS, VALIDATION AND FAILURE/PERMISSION/LIMIT HANDLING. MATCH THE ACTUAL SHARED DROPDOWNS, CHECKBOXES, TEXT FIELDS AND ALL CONTROL STATES. KEEP THE UI MODERN, FUTURISTIC, BRANDED, PLAIN-SPOKEN, EASY TO NAVIGATE, SPACE-EFFICIENT AND RESPONSIVE ACROSS DESKTOP, TABLET, PHONE WEB AND NATIVE APPS. USE NATIVE STRENGTHS WITH VISIBLE ALTERNATIVES; KEEP SUMMARIES AND HISTORY CLOSE.**

**FULL MOCKUP APPROVAL AND COMPONENT REUSE: THE ENTIRE MOCKUP IS FULLY OWNER-APPROVED—SCREENS, COMPONENT DESIGNS, STATES, NAVIGATION AND INTERACTIONS. NO FURTHER DESIGN APPROVAL IS REQUIRED. READ `C:\Nik\Data\outbound-calls\Mockup\COMPONENTS.md` IN FULL AND REUSE ITS COMPONENT SOURCE/PATTERNS, TOKENS AND EXISTING-APP COMPONENT MAP. DROPDOWNS, TEXT BOXES, CHECKBOXES AND ALL OTHER CONTROLS MUST FOLLOW THE APPROVED THEME, DESIGN, COLORS, LUFGA FONT AND BEHAVIOR. START WITH THE APP'S REAL SHARED COMPONENTS, REUSE OR IMPROVE THEM, AND BIND REAL FUNCTIONALITY. THE BROWSER MOCKUP'S SYNTHETIC STATE IS NOT A PRODUCTION INTEGRATION. YOU HAVE CREATIVE FREEDOM TO IMPROVE ANY UI OR COMPONENT FOR CLARITY, RESPONSIVENESS, EASY NAVIGATION AND A BETTER PROVIDER/CUSTOMER EXPERIENCE WITHOUT ASKING FOR APPROVAL OR CREATING ANOTHER MOCKUP.**

**ONE PHASE = ONE SESSION. AFTER A PHASE IS TRULY COMPLETE, WITHOUT WAITING FOR ANOTHER REQUEST OR REMINDER, GIVE THE OWNER A COPY-PASTE NEXT-PHASE PROMPT IN THE FINAL CHAT AND THE MATCHING HANDOFF FILE: EXACT NEXT PROMPT PATH, BASIC PURPOSE, VERIFIED BUILD-STATE CONTEXT, CHARTER/PLAN PATHS AND RELEVANT GOTCHAS. DO NOT START THE NEXT PHASE AUTOMATICALLY. THE LAST PHASE HAS NO NEXT-PHASE HANDOFF.**


**Phase 2 completion handoff:** use `C:\Nik\Data\outbound-calls\phases\PHASE-3-PROMPT.md` for the next session and write `C:\Nik\Data\outbound-calls\phases\HANDOFF-TO-PHASE-3.md`. The final chat must include that exact next-prompt path, PLAN/charter paths, the next phase's purpose, verified completion context and real gotchas in one copy-paste block. Do not carry template placeholders into the final handoff.

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


> **New session.** You are building the engine that actually places Clinket's outbound AI calls: scheduling, dialing
> through Telnyx (Canada/US) and Plivo (India), detection, voicemail, the outbound AI conversation, the new tools,
> and everything that happens after the call. Phase 1 built the control plane, minutes ledger, contact permissions,
> rules engine, permissions and API that you build on.
>
> **Programme authority:** `C:\Nik\Data\outbound-calls\PLAN.md` (approved by the owner 2026-09-25).
> **Previous phase:** `C:\Nik\Data\outbound-calls\findings\PHASE-1-BUILD-STATE.md` — read it; it overrides this
> prompt where Phase 1 recorded an owner ruling or a change.
> **Next phase prompt:** `C:\Nik\Data\outbound-calls\phases\PHASE-3-PROMPT.md`.
> **Your build log:** `C:\Nik\Data\outbound-calls\findings\PHASE-2-BUILD-STATE.md` (you create it).

---

## 0. Before anything else — mandatory reading, in order, every file end to end

**First read IMPLEMENTATION-CHARTER.md in full; it is mandatory and takes precedence over routine approval waits in earlier instructions.**

List each item in your first reply and confirm you read it end to end. If a path does not exist, say which one.

1. `C:\Nik\CLAUDE.md` — all of it.
2. `C:\Nik\Data\outbound-calls\PLAN.md` — all of it. This phase lives in §6, §7, §8, §9.4, §9.8, §11, §13, §14,
   §15.2, §16, §19, §22, §23, §24, §25 (#3, #3b, #8, #9).
3. `PHASE-1-BUILD-STATE.md` and any "Changes from Phase 1" section at the top of this file.
4. `C:\Nik\Data\myequal-call-forwarding-review\PLAN.md` §17.5–§17.13 — the own-number verification call is the
   closest existing outbound dial (state document, deterministic message ids, per-country caller, machine detection
   on the leg, scheduled timeout, abuse controls).
5. Skills, fully: `clinqet-outbound-calls` (created in Phase 1), `clinqet-voice-assistant`, `clinqet-function-app`,
   `clinqet-infrastructure`, `clinqet-integration-health`, `clinqet-payments`, `clinqet-deployment`,
   `clinqet-cosmos-data`, `clinqet-testing`, `clinqet-booking-lifecycle`, `clinqet-whatsapp`.
6. Memory: `MEMORY.md`, every `feedback-*.md`, and `voice-keep-your-own-number-2026-09-15.md`,
   `voice-telnyx-live-call-fixes.md`, `telnyx-bridge-join-rearchitecture.md`, `telnyx-pstn-origination-from-did.md`,
   `india-carrier-plivo-decision.md`, `mobile-voice-live-call-parity.md`, `integration-health-alerts-2026-09-19.md`,
   `servicebus-queue-names-every-host-2026-09-17.md`, `cosmos-two-retry-policies-2026-09-21.md`,
   `timeprovider-governor-wallclock-2026-09-22.md`, `flaky-wallclock-tests-timeprovider-2026-09-22.md`,
   `flaky-tests-gate-not-clock-2026-09-22.md`, `test-captures-across-parallel-fanout-2026-08-16.md`,
   `section018-migration-2026-09-22.md`, `exception-to-caller-one-rule-2026-09-19.md`,
   `ai-assistant-billing-coherence-2026-09-18.md`, `knowledge-delivery-locked-design-2026-08-20.md`,
   `knowledge-receptionist-access-proposal-2026-09-07.md`.
7. Code, end to end:
   - Functions: `clinqetfuncations\Clinqet.Communications\Functions\VoiceCallControlFunction.cs`,
     `PlivoVoiceCallControlFunction.cs`, `RealtimeCallWebhookFunction.cs`, `VoicePostCallProcessorFunction.cs`,
     `Services\VoiceOwnNumberCheckCoordinator.cs`, `Services\McpSessionSignalClient.cs`, `host.json`,
     `Program.cs`, `appsettings.json`, every timer function (pattern), the payments scheduler sweep (precedent).
   - Infrastructure: `Services\Communication\TelnyxCallControlService.cs`, `TelnyxWebhookParser.cs`,
     `TelnyxWebhookHandler.cs`, `PlivoCallControlService.cs`, `PlivoWebhookValidator.cs`;
     `Services\Voice\RealtimeSessionPayloadBuilder.cs`, `StandardWebhookValidator.cs`,
     `RealtimeWebhookIdempotencyStore.cs`, `VoiceAniBindingStore.cs`; `Services\Knowledge\ProviderKnowledgeSearchService.cs`
     + `.Provider.cs`; `Data\COSMOS\KnowledgeDocumentRepository.cs`, `CallSummaryRepository.cs`;
     `Services\Tenancy\AccessChangeDispatcher.cs` (outbox).
   - Core/shared: `Interfaces\Communication\IVoiceTelephonyProvider.cs`, `IPlivoMultipartyCallService.cs`,
     `Interfaces\Knowledge\IProviderKnowledgeSearch.cs`, `Entities\COSMOS\VoiceCallSession.cs`, `CallSummary.cs`,
     `Voiceline.cs`; `clinqetshared\Models\ServiceBusSettings.cs`, `AzureRealtimeSettings.cs`, `PlivoSettings.cs`,
     `TelnyxSettings.cs`; enums `CallSummaryPath`, `VoicePendingMessageKind`, `WhatsAppConsentSource`,
     `BookingCreationOrigin`.
   - MCP: `clinqetmcp\Clinqet.Mcp\Program.cs`, `Monitor\VoiceSessionMonitor.cs`, `Monitor\PlivoVoiceRelay.cs`,
     `Monitor\VoiceLiveEventClient.cs`, `Middleware\McpChannelAuthMiddleware.cs`, `RateLimiting\McpToolRateLimiter.cs`,
     `Tools\McpToolGuard.cs`, every file in `Tools\`.
   - Main API: `Controllers\Admin\AdminVoiceAssistantController.cs`, the internal voice live-event endpoint.
   - Deployment: `azureautomation\deploy.ps1` (Service Bus entity list and its check against `ServiceBusSettings`,
     Plivo callback URL, realtime deployments), `functions.json`, `storage.json`.
   - The existing tests of every class you change.

---

## 1. What this phase delivers (PLAN references)

**W1 — Scheduler, claim, outbox, supervisor (§13).** Timer (15 s, setting) → one bounded SQL selection of due work →
priority (callbacks → one-off → campaigns) and round-robin fairness → per-business claim transaction under the
ledger's app lock (attempt + hold + campaign cap + frequency + capacity) → `DispatchedAt` outbox → dial message
(message id = attempt id). Supervisor: stuck `Dialing`/`Unknown` attempts (reconcile from webhooks or a carrier
lookup), expired holds, undispatched attempts, next steps not written. Nightly usage reconciliation (ledger vs calls).
Minutes exhausted → campaign `Paused(MinutesExhausted)` / one-off `Blocked(minutes)`.

**W2 — Dial worker (§6.1 step 3–5).** Every final check, failing closed; the live record (`vcall_{callId}`, outbound
fields, frozen brief, allowed documents and tools, 24-hour TTL) written before dialing; dial from the business's own
Clinket number with the business name, machine detection, time limit, attempt id in the correlation field.
A carrier timeout after sending is `Unknown` → reconcile, **never redial**. Carrier failures reported through the
integration-health observation seam (memory `integration-health-alerts-2026-09-19`).

**W3 — Carriers and webhook routing (§6.2, §6.3, §23).** Telnyx: standalone make-call, `client_state` outbound phase
routed **before** the inbound state machine (as the own-number check does), per-attempt `command_id`, premium AMD
with screening detection, `call.machine.premium.greeting.ended` mapped (it is not today), voicemail by carrier
text-to-speech after the beep, screening line, answer → transfer to Azure realtime SIP with the per-call token.
Plivo: make-call with dedicated outbound callback routes carrying the attempt id, machine detection, conference +
`ai-agent` member through the existing relay, voicemail after the beep. Fix the leg-blind AMD handler. Answer-time
contact-permission re-check ("Sorry for the call, goodbye"). Every carrier result mapped to §4.4 states.

**W4 — Outbound AI session (§7).** A dedicated outbound branch of `RealtimeSessionPayloadBuilder`, correct in
**both** places it is built (Telnyx accept in Functions; Plivo relay in the MCP host). Fixed opening from localization
in every voice language (en, fr, es, hi, pa, gu; `pa` falls back like the existing disclaimer), AI disclosure always,
right-party check, recording notice after confirmation, recording starts after the opening. Call-length target and
hard limit with a wrap-up; outbound wording for silence checks, farewells and idle goodbye (§7.4 lists the inbound
phrases that must not leak). The AI follows the person's language among the supported voice languages.

**W5 — Tools (§7.3).** New: `record_answer`, `schedule_callback`, `record_do_not_call`, `set_outcome`. All
server-bound (no trusted ids from the model), validated against the frozen brief, filtered by the brief's allowed
actions. `record_do_not_call` writes the Phase 1 store **before** the AI confirms. `schedule_callback` needs a durable
path from the MCP host into SQL — propose it (PLAN §7.3 names the `VoiceLiveEventClient` precedent). Inbound calls
gain `record_do_not_call`, `schedule_callback` and the neutral recent-outbound note (D14). Rate limiting becomes per
call, not per business (§13.5). Outbound tool calls stop authorizing when the call ends (§25 #9).

**W6 — Knowledge narrowing (§15.2).** A brief's document selection enforced in all four places: the search filter,
`IProviderKnowledgeSearch.GetByRefsAsync`, `IKnowledgeDocumentRepository.ListSendableImageRefsAsync`, and the
render-time check in Functions (the queue message carries the allowed set or a reference to it). Empty selection →
no `search_knowledge`. No new knowledge settings or search fields.

**W7 — After the call (§6.5, §8.1).** In order, idempotent per attempt: usage from carrier times into the ledger +
settle the hold (before and independent of the summary); answers and outcome to SQL; next step per the §8.1 table
(retries at a different time of day ≥ 1 day apart, callbacks, our-failure retries after 15 minutes, dropped-call
retry, voicemail rule, 7-day expiry); summary/transcript/recording through the existing pipeline with an outbound
summary path, linked to the recipient call, mapped to its own analytics subtype (today an unknown path becomes
`call_missed`); the post-call safety check for missed opt-outs (model and cost justified under the charter); outbound
attribution for AI-created bookings and for WhatsApp consent on sends. An inbound call that completes an open outbound
purpose closes the remaining attempts (propose how).

**W8 — Test calls (§6.4):** member's verified phone only, free (usage source `Test`), limited per day, excluded from
results.

**W9 — India (§6.2, §10, §0.3 #1–2):** the declared-number evidence (declared at, series, declared by) + an admin
endpoint to record it + the dial check; the Plivo callback base URL for queue-started dials; Plivo dials sent once.

**W10 — Capacity and safety (§13.5, §16):** business, campaign and region concurrency; Telnyx ≤ 30 dials/s; Plivo
2 calls/s and 50 concurrent; region ceiling below realtime capacity so inbound always has room; non-production
destination allow-list; outbound calls must not raise the inbound live-call alert; phone numbers masked in Plivo
trace logs (§25 #8).

**W11 — Infrastructure (§13.6):** the dial queue (name by convention), the blocked-number cancel path, timers, MCP
autoscale, Telnyx outbound voice profile settings — each with ARM + `deploy.ps1` + `ServiceBusSettings` list, and the
queue name reaching every host that sends or receives it (memory `servicebus-queue-names-every-host-2026-09-17`).

**W12 — Measure, don't guess.** With the owner's go-ahead for each live test, against the owner's test numbers in dev:
(a) machine detection first then connect the AI, vs (b) connect on answer with detection alongside — measure the
silence after "Hello?" and detection accuracy. Record the measured recommendation and decide under AUT-1; ask the owner only if the evidence leaves a material unresolved tradeoff. Load-test the
scheduler and claim with a 5,000-person campaign against real SQL at the production tier's DTU, and the MCP host at
the target concurrency.

**W13 — Closure, skills, memory:** closure teardown covers everything this phase creates; update
`clinqet-outbound-calls`, `clinqet-voice-assistant`, `clinqet-function-app`, `clinqet-deployment`,
`clinqet-integration-health` skills (four locations each) and memory.

**Out of scope here:** consent capture, handouts, notifications, analytics events, activity rows, automatic pause,
the 12-month retention job and voice-blob closure purge (Phase 3); integrated screens (Phases 4–5).

---

## 2. Resolve and document these decisions before coding (ask only under the charter)

1. **Schema** — §0.7 tables for: the live record's outbound fields; the call summary's outbound path + recipient-call
   link; the India declaration fields on `Voiceline`; any SQL change Phase 1 did not make; any new enum value in a
   stored field (`CallSummaryPath`, `BookingCreationOrigin`, `WhatsAppConsentSource`).
2. **Infrastructure and cost** — queue(s), timers, MCP autoscale rule and cost, realtime quota needed (owner action
   §0.3 #6), Telnyx outbound voice profile and account level (§0.3 #5).
3. **The callback save path** from the MCP host (W5).
4. **Safety-check model** (W7) — model, cost per call, what it may write.
5. **Tool authorization after call end** — outbound tools must stop; recommend whether inbound tools should too
   (§25 #9).
6. **Opening, voicemail and screening wording** (English) — research and document the chosen wording under the charter; translations follow; Canadian
   legal read-through is §0.3 #4.
7. **How an inbound call closes an open outbound purpose** (W7).
8. **The detection choice** after W12's measurements.
9. The outcome of the separate Advanced-model migration task (D21) and what it means for outbound on the Advanced tier.
10. Anything in PLAN.md the code contradicts.

---

## 3. Traps (verified 2026-09-25 — re-verify before relying)

- Telnyx `command_id` is derived from `(to, action, client_state)` — a deliberate retry needs a new attempt id in
  `client_state`, or Telnyx treats it as the same command.
- `PlivoCallControlService.MakeProviderCallAsync` **retries the POST on 429/5xx with no idempotency key** — a retry
  can place a second real call. Outbound dials must be sent once.
- Plivo's shared-seam `MakeCallAsync` / `DialAsync` are no-ops that log and return `Failed`.
- Sessions are created only on an incoming `call.initiated` (Telnyx) or the DID's `answer_url` (Plivo); Telnyx
  handlers look sessions up by `call_session_id`, but a dial returns `call_control_id`.
- The AMD handler never checks which leg a verdict belongs to — an outbound leg's verdict would read as "the owner
  missed the call".
- `TelnyxWebhookParser` deliberately does not map `call.machine.premium.greeting.ended`.
- `Dnis` / `CallerPhone` mean "number dialled" / "who called" everywhere (metering, known-caller lookup, caller-ID
  auto-verification, send targets, CRM ensure, owner rules, time-zone anchors). A number the business dialled is
  **not** proof of identity.
- `VoiceAniBindingStore` (`vcallani_{e164}`) is last-writer-wins.
- `voice-postcall` duplicate detection is 40 minutes; end-of-call ids look like `vpc-end-{callId}` — one call id per
  attempt keeps them apart.
- `CallSummary` is created with `CreateIfAbsentAsync` and a `SideEffectsAppliedAt` marker, TTL 90 days; the summary
  schema has no outcome field; an empty transcript reads "Missed call".
- `OutcomeSubtype` maps any path it does not know to `call_missed`; the Call Follow-ups UI hard-codes four path tabs
  (the UI change is Phase 4).
- The MCP host has **no SQL**; the first prompt is built in Functions for Telnyx and in the MCP relay for Plivo —
  anything the prompt needs (brief, recent-outbound note) must be on the live record or in the warm context.
- `MaxConcurrentCalls` (20) is an alert threshold, not admission control. MCP runs one P0v3 instance per region with
  no autoscale. The tool limiter is per business (4 concurrent, 60/min, in memory per instance).
- Never use `+18449254651` as a caller ID (platform SMS sender + CA/US verification caller; area code 844 is on
  `Telnyx:FraudDetection:HighRiskAreaCodes`). A bare non-owned `from` is rejected by Telnyx (SIP 403 D51).
- Business numbers are voice-only; there is no keypad (DTMF) handling.
- `Plivo:CallbackBaseUrl` is empty in committed config and set by `deploy.ps1` — queue-started dials depend on it.
- Unverified Telnyx accounts: 2 channels, 100 calls a day, and a Telnyx announcement on every call.
- India's "Advanced" tier falls back to `gpt-realtime-mini`; `gpt-realtime-2` (CA/US Advanced) is a preview that
  `deploy.ps1` says retires 2026-10-31 (D21 task).
- Functions run on Flex Consumption with no always-ready instances — measure timer latency and cold starts; justify any necessary capacity/configuration change and cost under AUT-1. Ask only for unresolved cost/business decisions; live purchases and deployment remain separate actions.
- The India Cosmos account is capped at 1,000 RU/s — count RU per call (live record writes, permission reads).

---

## 4. Edge cases (PLAN §22 — every Scheduling, Dialing, Answer, Conversation, Opt-out, Data changes, Money, Sending,
Inbound, Team, Test, India and Region row), plus

Two scheduler instances at once · timer overlap · a claim that commits and the dispatch send fails · a webhook that
arrives before the dial response · webhooks out of order or duplicated · carrier callback for an attempt already
reconciled · AI session fails to start after answer · person answers during the voicemail beep wait · voicemail
greeting longer than the ring limit · DST change between claim and dial · number blocked between claim and dial ·
hold expiry during a long call · MCP instance restart mid-call · a relay WebSocket drop in India · Azure SIP rejects
the transfer · the recording never arrives · a tool call after the call ended.

---

## 5. Tests

- Unit and integration in the suite of the host that runs the code (§0.18): scheduler, dial worker, webhooks,
  post-call → `Clinqet.Communications.*`; tools, relay, session → `Clinqet.Mcp.*`; internal endpoints and admin →
  `Clinqet.API.*`.
- Real engines are mandatory: claim concurrency (two schedulers, one winner), holds under parallel claims, outbox
  redelivery, webhook replay idempotency, Service Bus processor redelivery, the one-active-call-per-number rule,
  usage settled exactly once, opt-out saved before confirmation.
- Tests for every carrier event mapping and every §8.1 row. `TimeProvider` everywhere; prove bounds with gates, never
  wall-clock races (memory `flaky-tests-gate-not-clock-2026-09-22`).
- Sabotage-verify each guard. Record the live measurements (W12) with numbers.

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
   `clinqetinfrastructure\Resources\Localization\{en,es,fr,gu,hi}.json`; partner web
   `public\lang\{en-US,es-US,fr-CA,gu-IN,hi-IN}.json`; partner mobile `src\Locales\{en,es,fr,gu,hi}.json`. Spoken
   lines exist for every voice language. No technical words anywhere a provider or customer can read or hear.
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
15. **Real phone calls are outward actions.** Place live test calls only to numbers the owner names, only in dev, and
    only after the owner says go for that batch.

---

## 7. Audit — before this phase can be called complete (master prompt §28)

Audit ALL work of this phase across: bugs · logical gaps · missing functionality · performance · memory leaks · CPU
problems · thread safety · async/concurrency · resource handling · correctness · feature completeness · security and
tenant isolation · money · data flow · telephony behaviour · localization. The two that matter most: **no gaps or
bugs** and **no missing functionality**.

Method: re-read every changed file end to end; walk every §22 row and every carrier event; trace one call of each kind
(campaign, one-off, callback, test; person, voicemail, screening, no answer; Canada, US, India) from due time to
settled minutes; run the tests you added and the suites your change reaches; sabotage-verify each guard. Fix every
finding; review each fix; verify it closes the finding and creates no new problem. Only then mark the phase complete.
Record findings, fixes and evidence in the build-state file.

---

## 8. Completion and handoff

1. Write `C:\Nik\Data\outbound-calls\findings\PHASE-2-BUILD-STATE.md`: what was built (per repo, per file), every
   owner approval and ruling (date + words), deviations from PLAN.md, schema/infra/settings added, the live
   measurements and the justified detection decision under AUT-1, tests added and exact results, audit findings with fixes and
   evidence, open items for later phases, new traps.
2. Update PLAN.md: §0.1, §0.5, §0.6, and every section the owner changed.
3. Skills (four locations) and memory, as in W13.
4. Leave the tree clean (rule 14) and report it.
5. Read `phases\PHASE-3-PROMPT.md`; add a dated "Changes from Phase 2" section at its top if anything it relies on
   changed.
6. Write the handoff to `C:\Nik\Data\outbound-calls\phases\HANDOFF-TO-PHASE-3.md` **and** paste the same text in the
   chat in one fenced code block, saying they are the same:

```text
Outbound AI Calls — Phase 3 of 6: Consent, handouts and operations.
Read C:\Nik\Data\outbound-calls\phases\PHASE-3-PROMPT.md end to end first and follow it exactly (mandatory reading,
rules, coding standards, gates, audit, handoff).
Context: Phases 1–2 are complete — <two lines: what now exists>. Build logs:
C:\Nik\Data\outbound-calls\findings\PHASE-1-BUILD-STATE.md and PHASE-2-BUILD-STATE.md.
Read C:\Nik\Data\outbound-calls\IMPLEMENTATION-CHARTER.md and C:\Nik\Data\outbound-calls\PLAN.md in full.
Gotchas: <replace with 2–4 verified details before delivering the handoff>.
Read IMPLEMENTATION-CHARTER.md: make justified decisions under AUT-1; ask only when genuinely unresolved.
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


**India service eligibility clarification from the 4.1 source check:** “Own customer” is not blanket permission for every purpose. Phase 1's current legal/carrier review must distinguish the applicable service/transactional categories and any explicit-consent/validity requirements; Phase 2 enforces the verified classification and carrier-confirmed number-series/business eligibility; Phase 5 records/displays that evidence. Do not assume 160-series eligibility for an ordinary home-service business. The mockup now offers a landline service/transactional example and clearly labels restricted-series eligibility; the declaration itself still grants no promotional permission. See the linked Plivo reference and research limits in `Mockup/COVERAGE-AUDIT.md`.
