# Outbound AI Calls — Phase 6 of 6: End-to-end audit of the whole programme

## Mandatory extension — one or several people without a campaign (2026-10-04)

**MUST READ `C:\Nik\Data\outbound-calls\QUICK-CALLS.md` IN FULL. THE OWNER REQUIRES ONE SHARED “CALL WITH AI” FLOW FOR ONE PERSON OR A SMALL SELECTED GROUP, NOW OR SCHEDULED, WITHOUT A VISIBLE OR HIDDEN CAMPAIGN. THIS IS PART OF THE APPROVED MOCKUP AND CURRENT SOLUTION, NOT A FUTURE OPTIONAL FEATURE. IMPLEMENT C25 AND Q01–Q16 WITH REAL PER-PERSON ELIGIBILITY, TIME REVIEW, IDEMPOTENCY, PARTIAL/UNCERTAIN-SAVE RECOVERY, RESULTS/HISTORY AND CANCELLATION. REUSE THE SAME ENGINE AND SHARED WEB/NATIVE COMPONENTS; DO NOT CREATE A GROUP MODEL OR ANOTHER ENGINE WITHOUT A JUSTIFIED CURRENT NEED.**

**PHASES 1–5 MUST RECORD THIS EXTENSION'S VERIFIED PROGRESS AND NEXT OWNER IN THEIR BUILD STATE AND NEXT COPY-PASTE HANDOFF WITHOUT A REMINDER. PHASE 6 AUDITS IT END TO END AND HAS NO SUCCESSOR. EXISTING FULL MOCKUP APPROVAL, COMPONENT REUSE, CREATIVE FREEDOM WITHOUT ROUTINE REAPPROVAL, STARTUP SIMPLICITY, SECURITY/COST/PERFORMANCE/DATA QUALITY AND NO-UI-STUB REQUIREMENTS APPLY. OPEN THE STUDIO'S CALLS & CALLBACKS → CALL WITH AI STATES; REUSE `Mockup/quick-calls.js` AND `quick-calls.css` AS DESIGN/INTERACTION REFERENCES THROUGH THE REAL APP COMPONENTS.**

**This phase’s C25 responsibility:** Audit C25 and every Q01–Q16 case across real APIs/stores/engine/web/native. Prove no hidden campaign, lost accepted item, duplicate dial, cross-person data leak or wrong-number retargeting, including actual role/timeout/reload/concurrency/cancellation tests.

## Mandatory two-way coverage, preview and reuse — final audit 4.1

**MUST READ AND FOLLOW `C:\Nik\Data\outbound-calls\Mockup\COVERAGE-AUDIT.md` IN FULL. CHECK BOTH DIRECTIONS: EVERY PROJECT REQUIREMENT MUST HAVE ITS INTERFACE/BEHAVIOR AND TEST; EVERY MOCKUP CAPABILITY MUST HAVE A PLAN REQUIREMENT, REAL CONTRACT, NAMED IMPLEMENTATION PHASE AND ACCEPTANCE TEST. THE MOCKUP IS FULLY OWNER-APPROVED, INCLUDING ITS REUSABLE COMPONENTS. NO FURTHER MOCKUP APPROVAL IS REQUIRED. DO NOT LOSE A MOCKUP FEATURE BECAUSE AN EARLIER PHASE DESCRIPTION WAS LESS DETAILED.**

**HOW TO VISUALIZE: OPEN `C:\Nik\Data\outbound-calls\Mockup\index.html` IN EDGE OR CHROME (POWERSHELL: `Start-Process 'C:\Nik\Data\outbound-calls\Mockup\index.html'`). NO INSTALL, BUILD OR SERVER IS NEEDED. INSPECT EVERY RELEVANT SCREEN/STATE, BOTH PRODUCT MENUS, ROLES, PHONE/TABLET/DESKTOP SIZES, WEB/NATIVE MODE AND SUPPORTED THEMES. USE OPEN FULL SCREEN AND ACTUALLY EXERCISE THE FLOWS; DO NOT REVIEW SCREENSHOTS ALONE.**

**HOW TO REUSE THE CODE: READ `C:\Nik\Data\outbound-calls\Mockup\COMPONENTS.md`. REUSE THE APPROVED TOKENS, ASSETS, CONTROL STRUCTURE, INTERACTION/RETURN PATTERNS AND RESPONSIVE LAYOUTS FROM `controls.js`, `controls.css`, `ui.js`, `styles.css`, `navigation.js`, `builder-tools.js`, `audience-ui.js`, `record-ui.js`, `campaign.js` AND `call-results.js` WHERE THEY FIT. START WITH THE VERIFIED REACT/NATIVE SHARED COMPONENTS MAPPED THERE. ADAPT THEM TO REAL STATE, LOCALIZATION, AUTHORIZATION AND APIs. NEVER COPY SYNTHETIC DATA, SIMULATED AI/CALLS/MESSAGES, GLOBAL DOM WIRING OR A TOAST AS A PRODUCTION INTEGRATION.**

**DATA QUALITY IS MANDATORY ALONGSIDE SECURITY, COST, PERFORMANCE AND FUNCTIONALITY: USE STABLE BUSINESS/RECORD/NUMBER IDENTITIES, E.164 NORMALIZATION, EXPLICIT TIME ZONES AND EVIDENCE PROVENANCE, FROZEN AUDIENCE/BRIEF VERSIONS, TYPED ANSWERS AND DISTINCT UNKNOWN/REFUSED/UNCONFIRMED STATES. COUNTS, CHARTS, HISTORY, FILTERED LISTS AND EXPORTS MUST AGREE. MUTATIONS MUST RENDER THE AUTHORITATIVE SAVED RESULT AND HANDLE CONCURRENCY/REPLAY. NEVER TREAT MISSING AS ZERO, NO, CONSENT OR SUCCESS. KEEP NECESSARY DATA WITHOUT SPECULATIVE FIELDS OR DUPLICATE SOURCES OF TRUTH.**

**APPLY CREATIVE JUDGMENT TO THE COMPLETE FUNCTIONALITY. DECIDE WHETHER EACH DETAIL MAKES SENSE IN THE REAL SYSTEM; REUSE, SIMPLIFY OR IMPROVE IT UNDER AUT-1 WITHOUT ROUTINE OWNER APPROVAL, INCLUDING JUSTIFIED NECESSARY SCHEMA/CONTAINER/ARCHITECTURE CHANGES. DO NOT OVERCOMPLICATE OR SILENTLY DROP A REQUIRED USER OUTCOME. RECORD THE RATIONALE AND UPDATE THE PLAN, COVERAGE REGISTER AND AFFECTED PROMPTS. ASK ONLY FOR A GENUINELY UNRESOLVED OR OWNER-DEPENDENT DECISION AFTER PRESENTING OPTIONS AND A RECOMMENDATION. EVERY EXPOSED CAPABILITY MUST WORK END TO END—NO UI STUBS.**


**DELIVERY SCHEDULE: FIVE IMPLEMENTATION PHASES (1–5), FOLLOWED BY PHASE 6, THE MULTIDIMENSIONAL END-TO-END AUDIT. EACH PHASE IS ONE SESSION. PLAN §26 RECORDS THE CONSOLIDATION REVIEW; NO REQUIRED FUNCTIONALITY WAS REMOVED.**

## Two-way audit implementation obligations for Phase 6

Audit every C01–C25 row in both directions against real implementation, including each 4.1 refinement. Compare authoritative source records with UI summaries, question statuses, charts, history and CSV; run concurrency/replay/tenant/deletion/role tests and native-device/responsive/control checks. Verify no fixture, toast-only action or unconnected destination shipped. Confirm all approval, reuse, AUT-1/schema-cost/data-quality, legal research and no-stub requirements were followed. This final phase has no next-phase handoff.

## Mandatory owner direction — final review and delegation, 2026-10-03

**MUST READ AND FOLLOW: `C:\Nik\Data\outbound-calls\IMPLEMENTATION-CHARTER.md` IN FULL, THEN `C:\Nik\Data\outbound-calls\PLAN.md` AND THIS ENTIRE PROMPT. THE CHARTER RECORDS THE OWNER'S LATEST PROJECT-SPECIFIC INSTRUCTIONS AND TAKES PRECEDENCE OVER EARLIER CONTRARY APPROVAL WORDING, INCLUDING COPIED STANDARDS, SKILLS AND MEMORIES.**

**THE ENTIRE MOCKUP IS FULLY OWNER-APPROVED AS A STARTING POINT AND REFERENCE. YOU HAVE CREATIVE FREEDOM TO IMPROVE UI, FUNCTIONALITY, NECESSARY FEATURES, SOLUTION DESIGN, ARCHITECTURE, CONTRACTS AND NECESSARY SCHEMA—INCLUDING SQL/COSMOS FIELDS, INDEXES AND CONTAINER CHOICE—WITHOUT ROUTINE OWNER APPROVAL OR A NEW MOCKUP. DO NOT OVERCOMPLICATE: USE THE SIMPLEST CORRECT SOLUTION THAT BALANCES COST, SECURITY, PERFORMANCE, FUNCTIONALITY AND LOW-FRICTION PROVIDER/CUSTOMER USE. DO NOT ADD DATA WITHOUT A CURRENT NEED; REUSE EXISTING ADMIN ALERTS WHERE SUFFICIENT AND ALLOW LEGITIMATE REPEAT FEEDBACK. JUSTIFY COSMOS PLACEMENT AND REAL RU/THROUGHPUT COST. RESEARCH CONSENT OPTIONS AND OTHER UNSTABLE/LEGAL FACTS WITH CURRENT OFFICIAL SOURCES; DO NOT ASSUME AUTOMATIC CONSENT OR A LIABILITY DISCLAIMER MAKES CALLS LAWFUL. ASK ONLY FOR A GENUINELY UNRESOLVED/TRICKY OR OWNER-DEPENDENT DECISION, AFTER COMPARING OPTIONS AND GIVING YOUR RECOMMENDATION.**

**NO UI STUBS OR INCOMPLETE WIRING: EVERY EXPOSED CAPABILITY MUST HAVE REAL WORKING INTEGRATION, PERSISTENCE WHERE NEEDED, AUTHORITATIVE RESULTS, VALIDATION AND FAILURE/PERMISSION/LIMIT HANDLING. MATCH THE ACTUAL SHARED DROPDOWNS, CHECKBOXES, TEXT FIELDS AND ALL CONTROL STATES. KEEP THE UI MODERN, FUTURISTIC, BRANDED, PLAIN-SPOKEN, EASY TO NAVIGATE, SPACE-EFFICIENT AND RESPONSIVE ACROSS DESKTOP, TABLET, PHONE WEB AND NATIVE APPS. USE NATIVE STRENGTHS WITH VISIBLE ALTERNATIVES; KEEP SUMMARIES AND HISTORY CLOSE.**

**FULL MOCKUP APPROVAL AND COMPONENT REUSE: THE ENTIRE MOCKUP IS FULLY OWNER-APPROVED—SCREENS, COMPONENT DESIGNS, STATES, NAVIGATION AND INTERACTIONS. NO FURTHER DESIGN APPROVAL IS REQUIRED. READ `C:\Nik\Data\outbound-calls\Mockup\COMPONENTS.md` IN FULL AND REUSE ITS COMPONENT SOURCE/PATTERNS, TOKENS AND EXISTING-APP COMPONENT MAP. DROPDOWNS, TEXT BOXES, CHECKBOXES AND ALL OTHER CONTROLS MUST FOLLOW THE APPROVED THEME, DESIGN, COLORS, LUFGA FONT AND BEHAVIOR. START WITH THE APP'S REAL SHARED COMPONENTS, REUSE OR IMPROVE THEM, AND BIND REAL FUNCTIONALITY. THE BROWSER MOCKUP'S SYNTHETIC STATE IS NOT A PRODUCTION INTEGRATION. YOU HAVE CREATIVE FREEDOM TO IMPROVE ANY UI OR COMPONENT FOR CLARITY, RESPONSIVENESS, EASY NAVIGATION AND A BETTER PROVIDER/CUSTOMER EXPERIENCE WITHOUT ASKING FOR APPROVAL OR CREATING ANOTHER MOCKUP.**

**ONE PHASE = ONE SESSION. AFTER A PHASE IS TRULY COMPLETE, WITHOUT WAITING FOR ANOTHER REQUEST OR REMINDER, GIVE THE OWNER A COPY-PASTE NEXT-PHASE PROMPT IN THE FINAL CHAT AND THE MATCHING HANDOFF FILE: EXACT NEXT PROMPT PATH, BASIC PURPOSE, VERIFIED BUILD-STATE CONTEXT, CHARTER/PLAN PATHS AND RELEVANT GOTCHAS. DO NOT START THE NEXT PHASE AUTOMATICALLY. THE LAST PHASE HAS NO NEXT-PHASE HANDOFF.**


**Final phase:** no next-phase prompt. Deliver the verified final audit, remaining owner decisions, open findings and go-live requirements.

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


> **New session.** Phases 1–5 built Clinket's outbound AI calling across the backend, the calling engine, consent and
> operations, and the provider, customer and admin screens. Each phase audited itself. This phase audits **the whole
> thing together**, end to end, finds what the per-phase audits could not see, fixes it, and proves it (master prompt
> §29). There is no next phase: this one ends with a final report and the owner's go-live checklist.
>
> **Programme authority:** `C:\Nik\Data\outbound-calls\PLAN.md`.
> **Everything the phases recorded:** `C:\Nik\Data\outbound-calls\findings\` (build and design state files).
> **Your report:** `C:\Nik\Data\outbound-calls\findings\FINAL-AUDIT.md` (you create it).

---

## 0. Before anything else — mandatory reading, in order, every file end to end

**First read IMPLEMENTATION-CHARTER.md in full; it is mandatory and takes precedence over routine approval waits in earlier instructions.**

List each item in your first reply and confirm you read it end to end. If a path does not exist, say which one.

1. `C:\Nik\CLAUDE.md` — all of it.
2. `C:\Nik\Data\outbound-calls\PLAN.md` — all of it, including every register (§0.2 decisions, §0.4 sheets, §0.5
   schema decisions under AUT-1, §0.6 rulings).
3. Every file in `C:\Nik\Data\outbound-calls\findings\` and every `C:\Nik\Data\outbound-calls\phases\*.md` (so you
   know what each phase promised, not just what it says it did).
4. Every approved sheet in PLAN §0.4.
5. `C:\Nik\Data\outbound-calls\Prompt.md` §28–§30 and §33 (the owner's definition of success).
6. Skills, fully: `clinqet-outbound-calls` and every skill the build states say were changed.
7. Memory: `MEMORY.md`, every `feedback-*.md`, and every memory entry the phases added for this programme.
8. The code: every file the build states list, end to end, in every repo.

---

## 1. What to audit

**A. Does it do what the owner decided?** Walk every decision D1–D22 and F1–F7 (§0.2) and every ruling (§0.6) to the
code that implements it. A decision with no code, or code that contradicts it, is a finding.

**B. Does every implementation decision match the owner's delegation?** Every schema item in the code has a justified §0.5 decision under AUT-1, with current readers/writers, alternatives, costs and test evidence. Do not demand a new per-item owner approval. Every built screen meets the approved requirements and UX criteria (§0.4/§0.6), with improvements recorded and verified. The entire mockup and its components are approved; necessary UI, feature, architecture and schema improvements need no routine renewed approval or new mockup. Escalate only genuinely unresolved decisions under the charter.

**C. Do the pieces work together?** Trace each flow across every repo, from the screen to the database and back:
campaign (build → launch → schedule → claim → dial → detect → converse → tools → post-call → minutes → results →
notifications), one-off call, callback booked on an inbound call and on an outbound call, test call, voicemail,
screening, no answer and retries, opt-out on a call, provider block, consent by each of the five ways, withdrawal,
handout send, person calls the business back, minutes run out mid-campaign, admin stop, automatic safety pause,
business closure, and the 12-month retention job. Canada, US and India each. Every PLAN §22 row, one by one, with the
evidence (test name or live result).

**D. Cross-phase gaps:** contracts the UI calls that the API does not honour (or the reverse), states the server
produces that no screen draws, settings read nowhere or never set by `deploy.ps1`, queues declared but not consumed,
enum values stored but not handled, localization keys missing in any language of any app or voice language,
permissions granted but not enforced (or enforced but not granted), analytics events emitted but not recorded.

**E. Money:** every second billed exactly once; holds always settled or released; the month boundary; inbound
protection; trial grant; free test calls; campaign caps; reconciliation; nothing charged for unanswered calls.

**F. Safety and compliance:** do-not-call wins everywhere, including the race between an opt-out and a new call;
consent evidence per country; calling windows per country and time zone; AI disclosure and recording notice on every
call; India evidence (declared numbers, series); the non-production allow-list; nothing dials without evidence.

**G. Security and tenant isolation:** no business can read or act on another's data through any endpoint, tool,
queue message, notification or file; server-bound ids in every AI tool; prompt injection through contact names,
brief text, document text and transcripts (OWASP LLM01); excessive agency (LLM06); unbounded consumption (LLM10);
webhook signatures; sensitive permissions re-checked live; phone numbers and personal data masked in logs; the public
consent page cannot be abused to opt anyone in or out.

**H. Performance, memory, CPU, concurrency:** a 5,000-person campaign end to end at production tiers (SQL DTU,
Cosmos RU — India is capped at 1,000 RU/s for everything), scheduler and claim under contention, MCP host at target
concurrency, realtime capacity leaving room for inbound, no leaks (timers, subscriptions, sockets, streams), no
unbounded loops or retries, thread safety of every shared structure, `IMemoryCache` sizes.

**I. Failure modes:** carrier outage, Azure SIP rejection, realtime model errors, Cosmos, SQL, Service Bus and Storage
failures, a host restart mid-call, duplicated and out-of-order webhooks — each must fail safe (no double call, no lost
opt-out, no double charge) and raise the right alert.

**J. Infrastructure and operations:** ARM + `deploy.ps1` complete for every queue, container, timer, setting and
scale rule; settings hygiene (no orphans, class defaults mirror JSON); health checks; alerts; per-region differences.

**K. Quality of the product:** web responsive at every width, phone apps using native strengths, parity between web
and phone for both pairs, plain words, every state designed and built, the owner's quality bar (Prompt.md §30).

**L. Tests and hygiene:** unit and integration coverage for every path; real engines where mandatory; placement
(§0.18) and own-repo reads (§0.17); no skipped or flaky tests; linear git history in every repo
(`git rev-list --merges origin/master..HEAD` empty); clean trees; skills and memory accurate; every earlier phase's
audit findings truly closed.

**M. Live end-to-end tests** — with the owner's go-ahead for each batch, only to numbers the owner names, only in dev:
one of each flow per country, recorded with results.

---

## 2. Fixing

- Record every finding in `FINAL-AUDIT.md`: severity, evidence (file:line, test, measurement), the fix, and how the
  fix was verified.
- Apply AUT-1 to necessary UI, feature, architecture and schema fixes. Document alternatives, cost and security;
  ask the owner only for unresolved legal/business/tricky decisions as described in the charter.
- Fix every finding; review each fix; verify it closes the finding and creates no new problem.
- If something cannot be fixed in this session, say so plainly, with the reason and what it would take. Never mark it
  closed.

---

## 3. Rules that apply to every step of this phase

1. **Golden rule (owner, master prompt §26.5).** Never assume a material fact. If you find uncertainty, a loophole,
   a gap, an inconsistency, a non-best-practice decision, a risk or a missing design point: stop, analyse it, tell the
   owner the concern with your recommendation, and ask only if the decision remains unresolved after applying the charter.
2. **Challenge the instruction** — including this one and the earlier phases' conclusions. A phase that said "done"
   is a claim to verify, not a fact.
3. **Owner delegation AUT-1**, documented schema discipline, complete infrastructure mapping, no feature flags, no stubs, no
   hardcoded user-facing text, `IMemoryCache` `Size = 1`, never a cross-partition Cosmos query, tests with real
   engines where mandatory — every CLAUDE.md §0 rule.
4. **Builds:** never build or test while another session is building — ask for an exclusive window; batch; run only
   what your change reaches; never leave code that does not compile.
5. **Git:** NEVER `git checkout --`, `git restore`, `git reset`, `git stash`, `git clean`. Linear history only. Commit
   only when the owner asks; never push; commit order `clinqetshared` → `clinqetcore` → `clinqetinfrastructure` →
   non-hosts → hosts last (`clinqetfuncations`, `clinqetapi`, `clinqetmcp`, `clinqetidentity`).
6. **Shared trees:** re-read a file immediately before editing it; never overwrite a change you did not make.
7. **Leave the tree clean** and report `git status --porcelain` for every repo you touched.
8. **Real calls and messages are outward actions** — only with the owner's go-ahead.

---

## 4. Completion

1. `FINAL-AUDIT.md` complete: every finding closed with evidence, or openly listed as not closed with the reason.
2. **Go-live checklist** in the same file: every owner action from PLAN §0.3 with its current state (India
   declarations and number series, US legal review, Canadian wording review, Telnyx account level and outbound voice
   profile, CNAM and caller registry, Azure realtime quota, the Advanced model migration, Meta template approvals),
   the per-region migration commands, the deploy order, and what to watch in the first week.
3. PLAN.md §0.1 set to its final status; skills and memory accurate.
4. Tree clean, reported.
5. A short final summary to the owner in the chat. No next-phase prompt — this is the last phase.

---

## 5. Coding standards (historical wording; latest charter takes precedence)

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
