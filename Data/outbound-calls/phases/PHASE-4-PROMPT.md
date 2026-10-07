# Outbound AI Calls — Phase 4 of 6: Provider UI and backend-contract reconciliation — AI calls (web + phone app, same session)

## Mandatory extension — one or several people without a campaign (2026-10-04)

**MUST READ `C:\Nik\Data\outbound-calls\QUICK-CALLS.md` IN FULL. THE OWNER REQUIRES ONE SHARED “CALL WITH AI” FLOW FOR ONE PERSON OR A SMALL SELECTED GROUP, NOW OR SCHEDULED, WITHOUT A VISIBLE OR HIDDEN CAMPAIGN. THIS IS PART OF THE APPROVED MOCKUP AND CURRENT SOLUTION, NOT A FUTURE OPTIONAL FEATURE. IMPLEMENT C25 AND Q01–Q16 WITH REAL PER-PERSON ELIGIBILITY, TIME REVIEW, IDEMPOTENCY, PARTIAL/UNCERTAIN-SAVE RECOVERY, RESULTS/HISTORY AND CANCELLATION. REUSE THE SAME ENGINE AND SHARED WEB/NATIVE COMPONENTS; DO NOT CREATE A GROUP MODEL OR ANOTHER ENGINE WITHOUT A JUSTIFIED CURRENT NEED.**

**PHASES 1–5 MUST RECORD THIS EXTENSION'S VERIFIED PROGRESS AND NEXT OWNER IN THEIR BUILD STATE AND NEXT COPY-PASTE HANDOFF WITHOUT A REMINDER. PHASE 6 AUDITS IT END TO END AND HAS NO SUCCESSOR. EXISTING FULL MOCKUP APPROVAL, COMPONENT REUSE, CREATIVE FREEDOM WITHOUT ROUTINE REAPPROVAL, STARTUP SIMPLICITY, SECURITY/COST/PERFORMANCE/DATA QUALITY AND NO-UI-STUB REQUIREMENTS APPLY. OPEN THE STUDIO'S CALLS & CALLBACKS → CALL WITH AI STATES; REUSE `Mockup/quick-calls.js` AND `quick-calls.css` AS DESIGN/INTERACTION REFERENCES THROUGH THE REAL APP COMPONENTS.**

**This phase’s C25 responsibility:** Ship the generic one-or-small-group composer, review, partial/uncertain receipt/recovery, Calls request/result/history/cancel and source-aware entry points on provider web and native together. Reconcile missing backend contracts; all Q01–Q16 behavior must work, not be simulated.

## Mandatory two-way coverage, preview and reuse — final audit 4.1

**MUST READ AND FOLLOW `C:\Nik\Data\outbound-calls\Mockup\COVERAGE-AUDIT.md` IN FULL. CHECK BOTH DIRECTIONS: EVERY PROJECT REQUIREMENT MUST HAVE ITS INTERFACE/BEHAVIOR AND TEST; EVERY MOCKUP CAPABILITY MUST HAVE A PLAN REQUIREMENT, REAL CONTRACT, NAMED IMPLEMENTATION PHASE AND ACCEPTANCE TEST. THE MOCKUP IS FULLY OWNER-APPROVED, INCLUDING ITS REUSABLE COMPONENTS. NO FURTHER MOCKUP APPROVAL IS REQUIRED. DO NOT LOSE A MOCKUP FEATURE BECAUSE AN EARLIER PHASE DESCRIPTION WAS LESS DETAILED.**

**HOW TO VISUALIZE: OPEN `C:\Nik\Data\outbound-calls\Mockup\index.html` IN EDGE OR CHROME (POWERSHELL: `Start-Process 'C:\Nik\Data\outbound-calls\Mockup\index.html'`). NO INSTALL, BUILD OR SERVER IS NEEDED. INSPECT EVERY RELEVANT SCREEN/STATE, BOTH PRODUCT MENUS, ROLES, PHONE/TABLET/DESKTOP SIZES, WEB/NATIVE MODE AND SUPPORTED THEMES. USE OPEN FULL SCREEN AND ACTUALLY EXERCISE THE FLOWS; DO NOT REVIEW SCREENSHOTS ALONE.**

**HOW TO REUSE THE CODE: READ `C:\Nik\Data\outbound-calls\Mockup\COMPONENTS.md`. REUSE THE APPROVED TOKENS, ASSETS, CONTROL STRUCTURE, INTERACTION/RETURN PATTERNS AND RESPONSIVE LAYOUTS FROM `controls.js`, `controls.css`, `ui.js`, `styles.css`, `navigation.js`, `builder-tools.js`, `audience-ui.js`, `record-ui.js`, `campaign.js` AND `call-results.js` WHERE THEY FIT. START WITH THE VERIFIED REACT/NATIVE SHARED COMPONENTS MAPPED THERE. ADAPT THEM TO REAL STATE, LOCALIZATION, AUTHORIZATION AND APIs. NEVER COPY SYNTHETIC DATA, SIMULATED AI/CALLS/MESSAGES, GLOBAL DOM WIRING OR A TOAST AS A PRODUCTION INTEGRATION.**

**DATA QUALITY IS MANDATORY ALONGSIDE SECURITY, COST, PERFORMANCE AND FUNCTIONALITY: USE STABLE BUSINESS/RECORD/NUMBER IDENTITIES, E.164 NORMALIZATION, EXPLICIT TIME ZONES AND EVIDENCE PROVENANCE, FROZEN AUDIENCE/BRIEF VERSIONS, TYPED ANSWERS AND DISTINCT UNKNOWN/REFUSED/UNCONFIRMED STATES. COUNTS, CHARTS, HISTORY, FILTERED LISTS AND EXPORTS MUST AGREE. MUTATIONS MUST RENDER THE AUTHORITATIVE SAVED RESULT AND HANDLE CONCURRENCY/REPLAY. NEVER TREAT MISSING AS ZERO, NO, CONSENT OR SUCCESS. KEEP NECESSARY DATA WITHOUT SPECULATIVE FIELDS OR DUPLICATE SOURCES OF TRUTH.**

**APPLY CREATIVE JUDGMENT TO THE COMPLETE FUNCTIONALITY. DECIDE WHETHER EACH DETAIL MAKES SENSE IN THE REAL SYSTEM; REUSE, SIMPLIFY OR IMPROVE IT UNDER AUT-1 WITHOUT ROUTINE OWNER APPROVAL, INCLUDING JUSTIFIED NECESSARY SCHEMA/CONTAINER/ARCHITECTURE CHANGES. DO NOT OVERCOMPLICATE OR SILENTLY DROP A REQUIRED USER OUTCOME. RECORD THE RATIONALE AND UPDATE THE PLAN, COVERAGE REGISTER AND AFFECTED PROMPTS. ASK ONLY FOR A GENUINELY UNRESOLVED OR OWNER-DEPENDENT DECISION AFTER PRESENTING OPTIONS AND A RECOMMENDATION. EVERY EXPOSED CAPABILITY MUST WORK END TO END—NO UI STUBS.**


**DELIVERY SCHEDULE: FIVE IMPLEMENTATION PHASES (1–5), FOLLOWED BY PHASE 6, THE MULTIDIMENSIONAL END-TO-END AUDIT. EACH PHASE IS ONE SESSION. PLAN §26 RECORDS THE CONSOLIDATION REVIEW; NO REQUIRED FUNCTIONALITY WAS REMOVED.**

## Two-way audit implementation obligations for Phase 4

C01–C13, C17–C18 and C21–C22: implement the approved provider flows on web and native together, including saved-brief edit/copy/delete/version, complete metadata/actions, all answer formats/CSV, campaign-window narrowing, unknown-time holds, test unverified/quota states, visible one-off request/cancel, fixed booking person, actual team follow-up/assignee/status, processing/delivery/business-action states, and retained cap/settings. Reuse working in-builder permission/handout components in Phase 5. Reconcile missing backend contracts before declaring UI done.

## Mandatory owner direction — final review and delegation, 2026-10-03

**MUST READ AND FOLLOW: `C:\Nik\Data\outbound-calls\IMPLEMENTATION-CHARTER.md` IN FULL, THEN `C:\Nik\Data\outbound-calls\PLAN.md` AND THIS ENTIRE PROMPT. THE CHARTER RECORDS THE OWNER'S LATEST PROJECT-SPECIFIC INSTRUCTIONS AND TAKES PRECEDENCE OVER EARLIER CONTRARY APPROVAL WORDING, INCLUDING COPIED STANDARDS, SKILLS AND MEMORIES.**

**THE ENTIRE MOCKUP IS FULLY OWNER-APPROVED AS A STARTING POINT AND REFERENCE. YOU HAVE CREATIVE FREEDOM TO IMPROVE UI, FUNCTIONALITY, NECESSARY FEATURES, SOLUTION DESIGN, ARCHITECTURE, CONTRACTS AND NECESSARY SCHEMA—INCLUDING SQL/COSMOS FIELDS, INDEXES AND CONTAINER CHOICE—WITHOUT ROUTINE OWNER APPROVAL OR A NEW MOCKUP. DO NOT OVERCOMPLICATE: USE THE SIMPLEST CORRECT SOLUTION THAT BALANCES COST, SECURITY, PERFORMANCE, FUNCTIONALITY AND LOW-FRICTION PROVIDER/CUSTOMER USE. DO NOT ADD DATA WITHOUT A CURRENT NEED; REUSE EXISTING ADMIN ALERTS WHERE SUFFICIENT AND ALLOW LEGITIMATE REPEAT FEEDBACK. JUSTIFY COSMOS PLACEMENT AND REAL RU/THROUGHPUT COST. RESEARCH CONSENT OPTIONS AND OTHER UNSTABLE/LEGAL FACTS WITH CURRENT OFFICIAL SOURCES; DO NOT ASSUME AUTOMATIC CONSENT OR A LIABILITY DISCLAIMER MAKES CALLS LAWFUL. ASK ONLY FOR A GENUINELY UNRESOLVED/TRICKY OR OWNER-DEPENDENT DECISION, AFTER COMPARING OPTIONS AND GIVING YOUR RECOMMENDATION.**

**NO UI STUBS OR INCOMPLETE WIRING: EVERY EXPOSED CAPABILITY MUST HAVE REAL WORKING INTEGRATION, PERSISTENCE WHERE NEEDED, AUTHORITATIVE RESULTS, VALIDATION AND FAILURE/PERMISSION/LIMIT HANDLING. MATCH THE ACTUAL SHARED DROPDOWNS, CHECKBOXES, TEXT FIELDS AND ALL CONTROL STATES. KEEP THE UI MODERN, FUTURISTIC, BRANDED, PLAIN-SPOKEN, EASY TO NAVIGATE, SPACE-EFFICIENT AND RESPONSIVE ACROSS DESKTOP, TABLET, PHONE WEB AND NATIVE APPS. USE NATIVE STRENGTHS WITH VISIBLE ALTERNATIVES; KEEP SUMMARIES AND HISTORY CLOSE.**

**FULL MOCKUP APPROVAL AND COMPONENT REUSE: THE ENTIRE MOCKUP IS FULLY OWNER-APPROVED—SCREENS, COMPONENT DESIGNS, STATES, NAVIGATION AND INTERACTIONS. NO FURTHER DESIGN APPROVAL IS REQUIRED. READ `C:\Nik\Data\outbound-calls\Mockup\COMPONENTS.md` IN FULL AND REUSE ITS COMPONENT SOURCE/PATTERNS, TOKENS AND EXISTING-APP COMPONENT MAP. DROPDOWNS, TEXT BOXES, CHECKBOXES AND ALL OTHER CONTROLS MUST FOLLOW THE APPROVED THEME, DESIGN, COLORS, LUFGA FONT AND BEHAVIOR. START WITH THE APP'S REAL SHARED COMPONENTS, REUSE OR IMPROVE THEM, AND BIND REAL FUNCTIONALITY. THE BROWSER MOCKUP'S SYNTHETIC STATE IS NOT A PRODUCTION INTEGRATION. YOU HAVE CREATIVE FREEDOM TO IMPROVE ANY UI OR COMPONENT FOR CLARITY, RESPONSIVENESS, EASY NAVIGATION AND A BETTER PROVIDER/CUSTOMER EXPERIENCE WITHOUT ASKING FOR APPROVAL OR CREATING ANOTHER MOCKUP.**

**ONE PHASE = ONE SESSION. AFTER A PHASE IS TRULY COMPLETE, WITHOUT WAITING FOR ANOTHER REQUEST OR REMINDER, GIVE THE OWNER A COPY-PASTE NEXT-PHASE PROMPT IN THE FINAL CHAT AND THE MATCHING HANDOFF FILE: EXACT NEXT PROMPT PATH, BASIC PURPOSE, VERIFIED BUILD-STATE CONTEXT, CHARTER/PLAN PATHS AND RELEVANT GOTCHAS. DO NOT START THE NEXT PHASE AUTOMATICALLY. THE LAST PHASE HAS NO NEXT-PHASE HANDOFF.**


**Phase 4 completion handoff:** use `C:\Nik\Data\outbound-calls\phases\PHASE-5-PROMPT.md` for the next session and write `C:\Nik\Data\outbound-calls\phases\HANDOFF-TO-PHASE-5.md`. The final chat must include that exact next-prompt path, PLAN/charter paths, the next phase's purpose, verified completion context and real gotchas in one copy-paste block. Do not carry template placeholders into the final handoff.

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


> **New session.** You build the provider's AI calls experience on the partner web app **and** the provider phone app
> in this same session (CLAUDE.md §0.7.1: every provider-web change ships in `clinqetmobilepartnerapp` in the same
> session). Use the approved UI reference and the creative freedom above, against the verified backend of Phases 1–3.
>
> **Programme authority:** `C:\Nik\Data\outbound-calls\PLAN.md`; approved sheets in its §0.4.
> **Previous phases:** `C:\Nik\Data\outbound-calls\findings\PHASE-1..3-BUILD-STATE.md`, the approved mockup review reports.
> **Next phase prompt:** `C:\Nik\Data\outbound-calls\phases\PHASE-5-PROMPT.md`.
> **Your build log:** `C:\Nik\Data\outbound-calls\findings\PHASE-4-BUILD-STATE.md` (you create it).

---

## 0. Before anything else — mandatory reading, in order, every file end to end

**First read IMPLEMENTATION-CHARTER.md in full; it is mandatory and takes precedence over routine approval waits in earlier instructions.**

List each item in your first reply and confirm you read it end to end. If a path does not exist, say which one.

1. `C:\Nik\CLAUDE.md` — all of it; especially §0.7.1, §0.10, §24.
2. `C:\Nik\Data\outbound-calls\PLAN.md` — all of it; especially §0.4, §5, §17, §18, §20, §22.
3. The three backend build-state files above, and every approved sheet this phase builds (from PLAN §0.4), end to end.
4. `C:\Nik\Data\outbound-calls\Prompt.md` §30 (the owner's design requirements).
5. Skills, fully: `clinqet-partner-app`, `clinqet-provider-mobile`, `clinqet-ui-common`, `clinqet-provider-teams`,
   `clinqet-outbound-calls`, `clinqet-voice-assistant` (Call Follow-ups, live calls), `clinqet-notifications`
   (deep links), `clinqet-analytics` (UI events), `clinqet-testing`.
6. Memory: `MEMORY.md`, every `feedback-*.md` (especially `feedback-mobile-must-mirror-web`,
   `feedback-no-technical-words-in-provider-copy`, `feedback-no-ai-looking-icons`), and
   `brand-button-colour-mandate-2026-08-09.md`, `anchored-panel-left-edge-2026-09-05.md`,
   `rail-unknown-is-not-a-refusal-2026-09-16.md`, `react19-defaultprops-killed-ask-clinket-2026-09-04.md`,
   `mobile-partner-eight-suite-repair-2026-08-25.md`, `mobile-voice-live-call-parity.md`,
   `notification-routes-dead-ends-2026-08-09.md`, `nav-reshuffle-scroll-cue-2026-08-15.md`.
7. Code, end to end:
   - Web (`clinqetwebpartnerapp`): `src\components\dashboard\layout\Sidebar.jsx`, `src\lib\tenancy\renderingRules.js`,
     `src\components\tenancy\SurfaceAccess.jsx`, `src\utils\localizationContracts.js`, `src\components\callFollowUps\*`,
     `src\components\customers\index.jsx`, the bookings screens, the AI Assistant settings page
     (`src\app\dashboard\profile\ai-assistant\`), the API client layer, the SignalR client, `public\lang\*.json`, and the
     tests beside each file you change.
   - Phone app (`clinqetmobilepartnerapp`): `src\lib\tenancy\renderingRules.ts`, `src\appNavigation\*`,
     `src\components\FABMenu.tsx`, the Call Follow-ups, contacts and bookings screens, the long-press pattern already
     used on bookings/quotes/invoices, the bottom-sheet pattern, push handling, `src\Locales\*.json`, and their tests.

---

## 1. What this phase delivers (approved requirements with an adaptable UI reference)

- **The "AI calls" area** in both products' rails (D17): overview, campaigns list, calls list — web and phone.
- **Campaign builder** (five steps), AI drafting from one sentence, starter templates, minute estimate and cap, test
  call, review and launch (launch needs `outbound.campaign.launch`; a sales rep can prepare but not launch).
- **Campaign detail:** live progress, outcomes, answers by question, people list with filters, pause/resume/stop,
  export.
- **Call detail:** summary, transcript (outbound **and** inbound — D15, `voice.transcript.read`), recording, answers,
  next step. Outbound calls in **Call Follow-ups** (today it hard-codes four path tabs — follow the approved sheet).
- **"Call with AI"** from a contact, a booking and Call Follow-ups — web menu + sheet; phone long-press + bottom sheet
  with haptics.
- **Outbound settings** and test calls.
- **Notification deep links** for the Phase 3 notification types land on the right screen, signed in or not.
- Rendering rules: `SURFACE_PERMISSIONS` (web) and `renderingRules.ts` (phone) for every new surface, matching the
  controller permissions (the convention tests check this). **"Unknown" is not "refused"** — never hide a surface
  because a permission answer has not arrived yet.
- Localization keys in all five languages of **both** apps; runtime-built keys registered in
  `localizationContracts.js` `DYNAMIC_LOCALIZATION_DOMAINS`. No technical words.
- UI analytics events the analytics skill requires.

**Dependency boundary:** this phase includes fully working permission review, knowledge selection and handout
upload/preview/approval/edit/copy/detach inside the campaign builder, and every contact/booking/Call Follow-ups entry
it exposes. Bring required reusable components forward. Do not leave links into unfinished functionality.
Standalone contact/permission/handout management plus admin/customer surfaces are completed in the following phase.
Those pages reuse the real operations built here, not a second implementation.

---

## 1A. Backend-to-UI reconciliation (merged former design phase)

The owner-approved complete studio is `C:\Nik\Data\outbound-calls\Mockup\index.html`. All mockup assets live beside it in that folder, an explicit owner exception to the generic location rule. It contains the surfaces below in one review studio; do not create duplicate sheets simply to satisfy older folder wording. Reconcile the reference to the backend that Phases 1–3 actually build.

| Sheet | Covers |
|---|---|
| `outbound-ai-calls-home` | The "AI calls" rail item in both products (D17), overview (today, running campaigns, needs attention), campaigns list, calls list |
| `outbound-campaign-builder` | Goal → People → What to say and ask → When and limits → Review and test; AI drafting from one sentence; starter templates; minute estimate and cap; test call |
| `outbound-campaign-detail` | Progress, outcomes, answers by question, people list and filters, pause/resume/stop, export |
| `outbound-call-detail` | Summary, transcript (outbound **and** inbound, D15), recording, answers, next step; how outbound calls appear in Call Follow-ups |
| `outbound-call-with-ai` | "Call with AI" from a contact, a booking and Call Follow-ups — web menu + sheet; phone long-press + bottom sheet |
| `outbound-contact-detail` | The new web contact page (D19) + its phone equivalent: international phone input, AI call history, do-not-call and consent status |
| `outbound-contact-permissions` | Do-not-call list, blocks, the person's own requests (cannot be lifted by the provider — show why), consent: send link, upload paper form, status, history |
| `outbound-handouts` | Upload, preview, approve, attach to a brief, delivery status |
| `outbound-settings` | Calling hours, voicemail, inbound protection, test calls, trial minutes |
| `outbound-admin` | Admin web: per-business limits and stop, platform do-not-call, Indian number declarations, active campaigns, safety pauses |
| `outbound-customer-consent` | The public consent page (from the link) and the booking checkbox on customer web, customer mobile and the public page |

**Before and during implementation, every screen must:**
- Draw web at phone, iPad and laptop/monitor widths **and** the phone app (provider sheets: provider app; customer
  sheets: customer app). Web on a phone must work; the phone app must use native strengths — long press, swipe,
  bottom sheets, haptics, live updates, push — not a shrunken web page.
- Draw **every state** (PLAN §18.5): empty · loading · error · no permission (per role from §17) · minutes or cap
  exhausted · paused (by you / budget / safety / admin) · blocked (do-not-call) · time zone unknown · outside calling
  hours · evidence missing (consent, Indian number declaration) · AI Assistant not active (upgrade) · offline (phone) ·
  and every state the server can actually return (from the build states). A state the server can reach and the sheet
  cannot draw ships undesigned.
- Map every control to the endpoint it calls and every string to its source (the server's translated sentence or a
  screen key). Never re-invent a sentence the server already sends.
- Use the house style exactly: navy ink, brand green for the chosen/pressed action, amber for limits, blue for
  processing; Lufga; house weights; the existing component shapes; lucide-style icons, never AI-looking icons or emoji.
- Use space well — dense, clear, modern; no big empty areas, no overloaded screens (owner, Prompt.md §30.1).
- Use plain words only: no "campaign engine", "queue", "token", "E.164", "webhook", "AMD", "partition", "payload".
  Words a salon owner or plumber uses.
- Show the fixed spoken lines (opening, voicemail, screening) and the consent wording as the customer hears/reads them,
  labelled as design wording. Preserve approved meaning; obtain any outstanding legal sign-off before real traffic.

---

Keep the original design-phase obligations: inspect all backend build states, actual product navigation,
existing controls, role rendering rules and relevant web/native/admin/customer reference screens. Maintain PLAN §0.4
and the review register. Map every visible control to the actual operation, every server state to a renderable state,
and every string to its server localization or client key. Put the full map, gaps resolved, design decisions, and
verification in this phase's BUILD-STATE file; no separate DESIGN-STATE session is required. The next phase repeats
this reconciliation for its remaining surfaces. Missing backend capabilities must be completed under the charter,
with proper schema/cost discipline and tests, not hidden or simulated. Real native testing remains mandatory.

## 2. Resolve and document these decisions before coding (ask only under the charter)

1. The file-by-file plan for both apps, and which approved sheet each screen follows.
2. Any place the approved sheet cannot be built as drawn (a missing endpoint, a state the server cannot produce, a
   platform limit) — with your recommendation. Never invent a backend field in the UI.
3. Anything in PLAN.md or the sheets the code contradicts.

---

## 3. Quality bar (owner, Prompt.md §30)

- Responsive without exception: iPhone and Android Chrome widths, iPad portrait and landscape, laptop, large monitor.
  Verify each in the browser preview and take screenshots as proof.
- Phone app uses native strengths — long press, swipe, bottom sheets, haptics, live updates, push — not a shrunken web
  page. Parity means the **same rendering rules** on both, checked condition by condition.
- Exact brand: theme, colours, Lufga, sizes, weights, button shapes, icons. Brand green fills every pressed/selected
  control.
- Space used well; nothing overloaded; plain words; every state from the sheet built.
- No duplicate or redundant API calls; lists paginate; live updates without polling storms.

---

## 4. Tests and verification

- Web: unit/component tests beside the code (the app's existing framework), `npx eslint` with 0 errors, the build.
- Phone: `node ./node_modules/typescript/bin/tsc --noEmit` with 0 errors (never `npx tsc`, which does nothing here),
  `npx jest`, locale parity tests.
- Browser-verify every screen at every width; state the result honestly.
- Sabotage-verify rendering-rule and permission guards.

---

## 5. Rules that apply to every step of this phase

1. **Golden rule (owner, master prompt §26.5).** Never assume a material fact. If you find uncertainty, a loophole,
   a gap, an inconsistency, a non-best-practice decision, a risk or a missing design point: stop, analyse it, tell the
   owner the concern with your recommendation, and ask only if the decision remains unresolved after applying the charter.
2. **Challenge the instruction.** If PLAN.md, a sheet or this prompt is wrong, prove it (file:line), document the correction and apply AUT-1; ask only when genuinely unresolved.
3. **Owner delegation applies to the full implementation.** Document the concrete plan and execute necessary, justified changes under AUT-1; routine plan/schema/UI approval is not required. Ask only for a genuinely unresolved decision under the charter.
4. **Mockup reference:** use PLAN §0.4 and the approved studio. Improve the interface under the owner ruling above without another approval or mockup; document and verify the improvement.
5. **Web and phone ship together**, in this session, with the same rendering rules.
6. **No hardcoded user-facing text**: web `public\lang\{en-US,es-US,fr-CA,gu-IN,hi-IN}.json`; phone
   `src\Locales\{en,es,fr,gu,hi}.json`.
7. **Pre-production:** no feature flags, no stubs, no backward-compatibility code. Delete what your change orphans.
8. **Builds:** never build or test while another session is building — ask for an exclusive window; batch; run only
   what your change reaches; never leave code that does not compile.
9. **Git:** NEVER `git checkout --`, `git restore`, `git reset`, `git stash`, `git clean`. Linear history only
   (`git fetch origin` + `git rebase origin/master`; `git rev-list --merges origin/master..HEAD` prints nothing).
   Commit only when the owner asks; never push. Web and mobile apps are non-hosts (they go before the hosts).
10. **Shared trees:** re-read a file immediately before editing it; never overwrite a change you did not make.
11. **Leave the tree clean:** scratch only in your session scratchpad; show `git status --porcelain` for every repo
    you touched and account for every line.

---

## 6. Audit — before this phase can be called complete (master prompt §28)

Audit ALL work across: bugs · logical gaps · missing functionality · performance (renders, bundle, API calls) · memory
leaks (listeners, timers, subscriptions) · CPU · async and race conditions (double-submit, stale responses) · resource
handling · correctness against the sheets · feature completeness · security (permission gating, no data from another
business) · localization in five languages · responsiveness at every width · web/phone parity. The two that matter
most: **no gaps or bugs** and **no missing functionality**. Fix every finding; review and verify each fix; only then
mark the phase complete.

---

## 7. Completion and handoff

1. Write `C:\Nik\Data\outbound-calls\findings\PHASE-4-BUILD-STATE.md` (as earlier phases did, with screenshots'
   locations described, not stored in a repo).
2. Update PLAN.md §0.1, §0.4 (if a sheet changed), §0.6.
3. Update `clinqet-partner-app`, `clinqet-provider-mobile`, `clinqet-outbound-calls` skills (four locations each) and
   memory.
4. Leave the tree clean and report it.
5. Read `phases\PHASE-5-PROMPT.md`; add a dated "Changes from Phase 4" section at its top if needed.
6. Write the handoff to `C:\Nik\Data\outbound-calls\phases\HANDOFF-TO-PHASE-5.md` **and** paste the same text in the
   chat in one fenced code block, saying they are the same:

```text
Outbound AI Calls — Phase 5 of 6: Contacts, do-not-call, consent, admin and customer screens.
Read C:\Nik\Data\outbound-calls\phases\PHASE-5-PROMPT.md end to end first and follow it exactly (mandatory reading,
rules, coding standards, gates, audit, handoff).
Context: the AI calls area is live on web and phone (Phase 4) — <two lines>. Build log:
C:\Nik\Data\outbound-calls\findings\PHASE-4-BUILD-STATE.md.
Read C:\Nik\Data\outbound-calls\IMPLEMENTATION-CHARTER.md and C:\Nik\Data\outbound-calls\PLAN.md in full.
Gotchas: <replace with 2–4 verified details before delivering the handoff>.
Use the owner delegation in IMPLEMENTATION-CHARTER.md; ask only when genuinely unresolved.
```

---

## 8. Coding standards (historical wording; latest charter takes precedence)

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
