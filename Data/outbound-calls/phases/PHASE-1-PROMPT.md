# Outbound AI Calls — Phase 1 of 6: Foundations

## Mandatory extension — one or several people without a campaign (2026-10-04)

**MUST READ `C:\Nik\Data\outbound-calls\QUICK-CALLS.md` IN FULL. THE OWNER REQUIRES ONE SHARED “CALL WITH AI” FLOW FOR ONE PERSON OR A SMALL SELECTED GROUP, NOW OR SCHEDULED, WITHOUT A VISIBLE OR HIDDEN CAMPAIGN. THIS IS PART OF THE APPROVED MOCKUP AND CURRENT SOLUTION, NOT A FUTURE OPTIONAL FEATURE. IMPLEMENT C25 AND Q01–Q16 WITH REAL PER-PERSON ELIGIBILITY, TIME REVIEW, IDEMPOTENCY, PARTIAL/UNCERTAIN-SAVE RECOVERY, RESULTS/HISTORY AND CANCELLATION. REUSE THE SAME ENGINE AND SHARED WEB/NATIVE COMPONENTS; DO NOT CREATE A GROUP MODEL OR ANOTHER ENGINE WITHOUT A JUSTIFIED CURRENT NEED.**

**PHASES 1–5 MUST RECORD THIS EXTENSION'S VERIFIED PROGRESS AND NEXT OWNER IN THEIR BUILD STATE AND NEXT COPY-PASTE HANDOFF WITHOUT A REMINDER. PHASE 6 AUDITS IT END TO END AND HAS NO SUCCESSOR. EXISTING FULL MOCKUP APPROVAL, COMPONENT REUSE, CREATIVE FREEDOM WITHOUT ROUTINE REAPPROVAL, STARTUP SIMPLICITY, SECURITY/COST/PERFORMANCE/DATA QUALITY AND NO-UI-STUB REQUIREMENTS APPLY. OPEN THE STUDIO'S CALLS & CALLBACKS → CALL WITH AI STATES; REUSE `Mockup/quick-calls.js` AND `quick-calls.css` AS DESIGN/INTERACTION REFERENCES THROUGH THE REAL APP COMPONENTS.**

**This phase’s C25 responsibility:** Build the bounded individual-request review/create/recover/cancel contracts, per-person replay identity and real-store race tests. No campaign row is created; justify only necessary currently consumed data. See QUICK-CALLS §§3–6 and Q04–Q14.

## Mandatory two-way coverage, preview and reuse — final audit 4.1

**MUST READ AND FOLLOW `C:\Nik\Data\outbound-calls\Mockup\COVERAGE-AUDIT.md` IN FULL. CHECK BOTH DIRECTIONS: EVERY PROJECT REQUIREMENT MUST HAVE ITS INTERFACE/BEHAVIOR AND TEST; EVERY MOCKUP CAPABILITY MUST HAVE A PLAN REQUIREMENT, REAL CONTRACT, NAMED IMPLEMENTATION PHASE AND ACCEPTANCE TEST. THE MOCKUP IS FULLY OWNER-APPROVED, INCLUDING ITS REUSABLE COMPONENTS. NO FURTHER MOCKUP APPROVAL IS REQUIRED. DO NOT LOSE A MOCKUP FEATURE BECAUSE AN EARLIER PHASE DESCRIPTION WAS LESS DETAILED.**

**HOW TO VISUALIZE: OPEN `C:\Nik\Data\outbound-calls\Mockup\index.html` IN EDGE OR CHROME (POWERSHELL: `Start-Process 'C:\Nik\Data\outbound-calls\Mockup\index.html'`). NO INSTALL, BUILD OR SERVER IS NEEDED. INSPECT EVERY RELEVANT SCREEN/STATE, BOTH PRODUCT MENUS, ROLES, PHONE/TABLET/DESKTOP SIZES, WEB/NATIVE MODE AND SUPPORTED THEMES. USE OPEN FULL SCREEN AND ACTUALLY EXERCISE THE FLOWS; DO NOT REVIEW SCREENSHOTS ALONE.**

**HOW TO REUSE THE CODE: READ `C:\Nik\Data\outbound-calls\Mockup\COMPONENTS.md`. REUSE THE APPROVED TOKENS, ASSETS, CONTROL STRUCTURE, INTERACTION/RETURN PATTERNS AND RESPONSIVE LAYOUTS FROM `controls.js`, `controls.css`, `ui.js`, `styles.css`, `navigation.js`, `builder-tools.js`, `audience-ui.js`, `record-ui.js`, `campaign.js` AND `call-results.js` WHERE THEY FIT. START WITH THE VERIFIED REACT/NATIVE SHARED COMPONENTS MAPPED THERE. ADAPT THEM TO REAL STATE, LOCALIZATION, AUTHORIZATION AND APIs. NEVER COPY SYNTHETIC DATA, SIMULATED AI/CALLS/MESSAGES, GLOBAL DOM WIRING OR A TOAST AS A PRODUCTION INTEGRATION.**

**DATA QUALITY IS MANDATORY ALONGSIDE SECURITY, COST, PERFORMANCE AND FUNCTIONALITY: USE STABLE BUSINESS/RECORD/NUMBER IDENTITIES, E.164 NORMALIZATION, EXPLICIT TIME ZONES AND EVIDENCE PROVENANCE, FROZEN AUDIENCE/BRIEF VERSIONS, TYPED ANSWERS AND DISTINCT UNKNOWN/REFUSED/UNCONFIRMED STATES. COUNTS, CHARTS, HISTORY, FILTERED LISTS AND EXPORTS MUST AGREE. MUTATIONS MUST RENDER THE AUTHORITATIVE SAVED RESULT AND HANDLE CONCURRENCY/REPLAY. NEVER TREAT MISSING AS ZERO, NO, CONSENT OR SUCCESS. KEEP NECESSARY DATA WITHOUT SPECULATIVE FIELDS OR DUPLICATE SOURCES OF TRUTH.**

**APPLY CREATIVE JUDGMENT TO THE COMPLETE FUNCTIONALITY. DECIDE WHETHER EACH DETAIL MAKES SENSE IN THE REAL SYSTEM; REUSE, SIMPLIFY OR IMPROVE IT UNDER AUT-1 WITHOUT ROUTINE OWNER APPROVAL, INCLUDING JUSTIFIED NECESSARY SCHEMA/CONTAINER/ARCHITECTURE CHANGES. DO NOT OVERCOMPLICATE OR SILENTLY DROP A REQUIRED USER OUTCOME. RECORD THE RATIONALE AND UPDATE THE PLAN, COVERAGE REGISTER AND AFFECTED PROMPTS. ASK ONLY FOR A GENUINELY UNRESOLVED OR OWNER-DEPENDENT DECISION AFTER PRESENTING OPTIONS AND A RECOMMENDATION. EVERY EXPOSED CAPABILITY MUST WORK END TO END—NO UI STUBS.**


**DELIVERY SCHEDULE: FIVE IMPLEMENTATION PHASES (1–5), FOLLOWED BY PHASE 6, THE MULTIDIMENSIONAL END-TO-END AUDIT. EACH PHASE IS ONE SESSION. PLAN §26 RECORDS THE CONSOLIDATION REVIEW; NO REQUIRED FUNCTIONALITY WAS REMOVED.**

## Two-way audit implementation obligations for Phase 1

C01–C12, C14–C15, C17, C19, C21 and C23–C24: implement the authoritative foundations and current API consumers. Explicitly include full structured saved-brief CRUD/version/copy semantics, bounded results for all six answer formats and their statuses, consistent metrics/CSV, narrower campaign windows and effective-hour metadata, number-specific service evidence and block history, individual-request review/cancellation, persistent cap/settings values, verified test-phone/quota contracts and safe contact lifecycle. Include authorized result/media/history reads (C10–C11), knowledge-selection validation (C17) and access/error contracts (C21); UI bindings remain in Phases 4–5. Expose these as real tested contracts; create schema only when its current reader/writer exists.

## Mandatory owner direction — final review and delegation, 2026-10-03

**MUST READ AND FOLLOW: `C:\Nik\Data\outbound-calls\IMPLEMENTATION-CHARTER.md` IN FULL, THEN `C:\Nik\Data\outbound-calls\PLAN.md` AND THIS ENTIRE PROMPT. THE CHARTER RECORDS THE OWNER'S LATEST PROJECT-SPECIFIC INSTRUCTIONS AND TAKES PRECEDENCE OVER EARLIER CONTRARY APPROVAL WORDING, INCLUDING COPIED STANDARDS, SKILLS AND MEMORIES.**

**THE ENTIRE MOCKUP IS FULLY OWNER-APPROVED AS A STARTING POINT AND REFERENCE. YOU HAVE CREATIVE FREEDOM TO IMPROVE UI, FUNCTIONALITY, NECESSARY FEATURES, SOLUTION DESIGN, ARCHITECTURE, CONTRACTS AND NECESSARY SCHEMA—INCLUDING SQL/COSMOS FIELDS, INDEXES AND CONTAINER CHOICE—WITHOUT ROUTINE OWNER APPROVAL OR A NEW MOCKUP. DO NOT OVERCOMPLICATE: USE THE SIMPLEST CORRECT SOLUTION THAT BALANCES COST, SECURITY, PERFORMANCE, FUNCTIONALITY AND LOW-FRICTION PROVIDER/CUSTOMER USE. DO NOT ADD DATA WITHOUT A CURRENT NEED; REUSE EXISTING ADMIN ALERTS WHERE SUFFICIENT AND ALLOW LEGITIMATE REPEAT FEEDBACK. JUSTIFY COSMOS PLACEMENT AND REAL RU/THROUGHPUT COST. RESEARCH CONSENT OPTIONS AND OTHER UNSTABLE/LEGAL FACTS WITH CURRENT OFFICIAL SOURCES; DO NOT ASSUME AUTOMATIC CONSENT OR A LIABILITY DISCLAIMER MAKES CALLS LAWFUL. ASK ONLY FOR A GENUINELY UNRESOLVED/TRICKY OR OWNER-DEPENDENT DECISION, AFTER COMPARING OPTIONS AND GIVING YOUR RECOMMENDATION.**

**NO UI STUBS OR INCOMPLETE WIRING: EVERY EXPOSED CAPABILITY MUST HAVE REAL WORKING INTEGRATION, PERSISTENCE WHERE NEEDED, AUTHORITATIVE RESULTS, VALIDATION AND FAILURE/PERMISSION/LIMIT HANDLING. MATCH THE ACTUAL SHARED DROPDOWNS, CHECKBOXES, TEXT FIELDS AND ALL CONTROL STATES. KEEP THE UI MODERN, FUTURISTIC, BRANDED, PLAIN-SPOKEN, EASY TO NAVIGATE, SPACE-EFFICIENT AND RESPONSIVE ACROSS DESKTOP, TABLET, PHONE WEB AND NATIVE APPS. USE NATIVE STRENGTHS WITH VISIBLE ALTERNATIVES; KEEP SUMMARIES AND HISTORY CLOSE.**

**FULL MOCKUP APPROVAL AND COMPONENT REUSE: THE ENTIRE MOCKUP IS FULLY OWNER-APPROVED—SCREENS, COMPONENT DESIGNS, STATES, NAVIGATION AND INTERACTIONS. NO FURTHER DESIGN APPROVAL IS REQUIRED. READ `C:\Nik\Data\outbound-calls\Mockup\COMPONENTS.md` IN FULL AND REUSE ITS COMPONENT SOURCE/PATTERNS, TOKENS AND EXISTING-APP COMPONENT MAP. DROPDOWNS, TEXT BOXES, CHECKBOXES AND ALL OTHER CONTROLS MUST FOLLOW THE APPROVED THEME, DESIGN, COLORS, LUFGA FONT AND BEHAVIOR. START WITH THE APP'S REAL SHARED COMPONENTS, REUSE OR IMPROVE THEM, AND BIND REAL FUNCTIONALITY. THE BROWSER MOCKUP'S SYNTHETIC STATE IS NOT A PRODUCTION INTEGRATION. YOU HAVE CREATIVE FREEDOM TO IMPROVE ANY UI OR COMPONENT FOR CLARITY, RESPONSIVENESS, EASY NAVIGATION AND A BETTER PROVIDER/CUSTOMER EXPERIENCE WITHOUT ASKING FOR APPROVAL OR CREATING ANOTHER MOCKUP.**

**ONE PHASE = ONE SESSION. AFTER A PHASE IS TRULY COMPLETE, WITHOUT WAITING FOR ANOTHER REQUEST OR REMINDER, GIVE THE OWNER A COPY-PASTE NEXT-PHASE PROMPT IN THE FINAL CHAT AND THE MATCHING HANDOFF FILE: EXACT NEXT PROMPT PATH, BASIC PURPOSE, VERIFIED BUILD-STATE CONTEXT, CHARTER/PLAN PATHS AND RELEVANT GOTCHAS. DO NOT START THE NEXT PHASE AUTOMATICALLY. THE LAST PHASE HAS NO NEXT-PHASE HANDOFF.**


**Phase 1 completion handoff:** use `C:\Nik\Data\outbound-calls\phases\PHASE-2-PROMPT.md` for the next session and write `C:\Nik\Data\outbound-calls\phases\HANDOFF-TO-PHASE-2.md`. The final chat must include that exact next-prompt path, PLAN/charter paths, the next phase's purpose, verified completion context and real gotchas in one copy-paste block. Do not carry template placeholders into the final handoff.

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


> **New session.** You are building the foundation of Clinket's outbound AI calling: the SQL control plane, the
> minutes ledger, contact permissions (do-not-call + consent), the calling rules, the permissions and the Main API.
> Nothing dials in this phase — the calling engine is Phase 2.
>
> **Programme authority:** `C:\Nik\Data\outbound-calls\PLAN.md` (approved by the owner 2026-09-25).
> **Next phase prompt:** `C:\Nik\Data\outbound-calls\phases\PHASE-2-PROMPT.md`.
> **Your build log:** `C:\Nik\Data\outbound-calls\findings\PHASE-1-BUILD-STATE.md` (you create it).

---

## 0. Before anything else — mandatory reading, in order, every file end to end

**First read IMPLEMENTATION-CHARTER.md in full; it is mandatory and takes precedence over routine approval waits in earlier instructions.**

Do not plan, propose or write code until this is done. In your first reply, list each item and confirm you read it
end to end. If a path does not exist, say which one — never guess its contents.

1. `C:\Nik\CLAUDE.md` — all of it. Every §0 rule applies.
2. `C:\Nik\Data\outbound-calls\PLAN.md` — all of it. This phase lives in §4, §5, §8, §9, §10, §11, §12, §14, §16,
   §17, §21, §22 and §24, but read every section: later phases depend on what you build.
3. Skills (`C:\Nik\.claude\skills\<name>\SKILL.md`), fully: `clinqet-payments`, `clinqet-voice-assistant` (long —
   read all of it; skills can be stale, the code wins), `clinqet-provider-teams`, `clinqet-provider-crm`,
   `clinqet-main-api`, `clinqet-cosmos-data`, `clinqet-shared-core`, `clinqet-infrastructure`,
   `clinqet-function-app`, `clinqet-testing`, `clinqet-deployment`.
4. Memory (`C:\Users\nik.adhaduk\.claude\projects\C--Nik\memory\`): `MEMORY.md`, then every `feedback-*.md`, and
   `ai-assistant-billing-coherence-2026-09-18.md`, `money-one-definition-p46-2026-09-05.md`,
   `appsettings-class-defaults-are-appended-not-replaced.md`, `memorycache-size-mandatory.md`,
   `exception-to-caller-one-rule-2026-09-19.md`, `voice-assign-needs-sql-and-ioe-leak-2026-09-19.md`,
   `section018-migration-2026-09-22.md`, `timeprovider-governor-wallclock-2026-09-22.md`,
   `flaky-tests-gate-not-clock-2026-09-22.md`, `test-captures-across-parallel-fanout-2026-08-16.md`,
   `worklist-day-filters-half-open-2026-09-03.md`, `grep-before-you-design-2026-09-22.md`.
5. Code, end to end (find anything named here that has moved; never assume):
   - **Minutes:** `clinqetcore\Interfaces\Payments\IMinuteLedgerService.cs`,
     `clinqetinfrastructure\Services\Payments\MinuteLedgerService.cs`, the `MinuteLedger` entity + EF configuration,
     `clinqetinfrastructure\Data\SQL\BillingCatalogDefinition.cs`, `clinqetinfrastructure\Services\Payments\AiAddOnService.cs`,
     `clinqetcore\Interfaces\Services\IEntitlementService.cs` + implementation, `clinqetcore\Entities\COSMOS\Voiceline.cs`
     + its repository, every reader and writer of `UsageSeconds` / `MonthlyMinuteCap` / `PreviousUsageSeconds`
     (grep all repos), the inbound call-start cap check (grep `IsCapExceeded`), low-minute and auto-recharge paths,
     `clinqetfuncations\Clinqet.Communications\Functions\VoicePostCallProcessorFunction.cs` (metering).
   - **SQL:** `clinqetinfrastructure\Data\SQL\AppDbContext.cs`, its configurations, `clinqetinfrastructure\Migrations\`
     (latest few), how `cosmosindexsetup` applies migrations, the app-lock pattern (`MinuteLedgerService.WriteLockedAsync`,
     `clinqetinfrastructure\Data\SQL\BookingMoneyLock.cs`), the outbox precedent
     (`clinqetinfrastructure\Services\Tenancy\AccessChangeDispatcher.cs`).
   - **Tenancy:** `clinqetinfrastructure\Data\SQL\TenancyRoleCatalogDefinition.cs`, `RoleAccessSummaryCatalog.cs`,
     `clinqetshared\Constants\SensitiveOperations.cs`, the authorization pipeline (`[RequiresPermission]`, tenant
     context, snapshot cache), `clinqetapi\Clinqet.API.UnitTests\Conventions\*`.
   - **Contacts:** `BusinessCustomer` in `clinqetcore\Entities\COSMOS\Cosmos.cs` (~line 1794),
     `clinqetapi\Clinqet.API\Controllers\CustomerController.cs` and the service/repository it uses,
     `clinqetshared\Utilities\PhoneNumberNormalizer.cs`, `clinqetshared\Attributes\ValidPhoneNumberAttribute.cs`,
     how the partner web and partner mobile apps send phone numbers today.
   - **Cosmos:** `cosmosindexsetup\Program.cs` (containers, partition keys, `SystemData` indexing), one existing
     `SystemData` document family end to end for the pattern (e.g. delivery feedback `addrhealth_`, WhatsApp
     consent `wac_`).
   - **Closure:** `clinqetinfrastructure\Services\Tenancy\BusinessClosureTeardown.cs`.
   - **Admin:** `clinqetapi\Clinqet.API\Controllers\Admin\AdminVoiceAssistantController.cs`.
   - **Hosts:** `Program.cs` and `appsettings.json` of `Clinqet.API` and `Clinqet.Communications`.
   - **Tests:** the API and Functions unit + integration projects, `ClinqetApiFactory`, `TestTokenHelper`, and the
     existing tests of every class you will change.

---

## Required consent research and simplification check

**Before implementing or revising calling eligibility/evidence, perform the charter §4 review using current official sources for each supported country and purpose. Compare existing evidence, lawful relationship bases, provider attestations, opt-out handling and any required customer permission. Record the decision and source links in the build state and update PLAN consistently. Do not adopt automatic consent or a liability disclaimer by assumption. Phase 1 owns the rules/data implications; Phase 3 implements the researched capture/enforcement workflow. Later phases verify the same decision throughout UI, FAQs/privacy information and tests. Escalate only genuinely unresolved legal/business choices with options and a recommendation.**

## 1. What this phase delivers

Each item: build it, test it, prove it. References are to PLAN.md.

**W1 — SQL control plane (§4, §12.1).** Briefs + versions (frozen once used), campaigns (state machine §4.2),
recipient calls (§4.3), attempts (§4.4, one call id per attempt), answers, business outbound settings. Database-enforced
invariants: unique `(campaign, destination)`; unique `(business, idempotency key)` for "call now"; unique
`(recipient call, attempt number)`; **one active attempt per destination** (filtered unique index — per regional
database, which is platform-wide because destinations are limited to the stamp's countries, see W4); row versions.
State transitions in code, each with a test. EF migration: never retro-edit an applied one; never apply at startup;
give the owner the per-region `dotnet ef database update` command (CA and IN are separate servers).

**W2 — Minutes (§14, D4, D5).** One append-only SQL ledger: grants (existing), **usage per call in seconds**
(direction, source, campaign, model tier, period by the call's own time; unique call id), **holds** (reserve →
settle once → release; expiry), grant **eligibility** (`Any` / `OutboundOnly`), the one-time outbound **trial grant**
(amount and validity are settings), **inbound protection** (20%, setting), campaign minute caps, and the
`available = eligible grants − usage − active holds − protection` computation — all under the existing per-business
app lock (`minuteledger:{businessId}`).
**Move inbound metering into the ledger:** the post-call processor records inbound usage idempotently by call id,
from carrier answer/hang-up times, independent of whether the summary succeeds (today a summary failure loses the
usage — PLAN §25 #3/#3b). `Voiceline` usage/cap become a **projection** refreshed after every settlement and grant,
so the inbound call-start check keeps working; the projection never decides money. `ResolveUsedMinutesAsync` and
every other reader moves to the ledger. Minute plans do not change (D22).

**W3 — Contact permissions (§9, §12.2).** Cosmos `SystemData` family: per business partition (`cperm_{businessId}`)
one state document per E.164 + append-only event documents in the same partition (transactional batch); a platform
partition. Service: check (business + platform), add, remove with the removal rules of §9.3 (a person's own request
can only be lifted by the person; provider blocks by the provider with live-checked permission; platform by admin),
history. Single-partition reads and queries only. Index changes in `cosmosindexsetup\Program.cs` if needed.
Consent documents are designed now (structure, scopes, evidence reference, expiry) so Phase 3 only adds capture.
At business closure, set each permission document's TTL to 5 years after its last change (§21) — the teardown does
not touch `SystemData` today; add the step.

**W4 — Rules engine (§8, §10, §16).** A pure, `TimeProvider`-driven library:
- Calling windows: legal envelope per country (Canada weekdays 9:00–21:30, weekends 10:00–18:00; US 8:00–20:00
  everywhere until the US legal review says otherwise; India none statutory) ∩ brief window ∩ optional opening
  hours; next allowed time; DST-safe (store local time + zone for callbacks, resolve to UTC at dial time).
- Recipient time zone: contact address → zone; else NANP area code → zones (multi-zone codes use only hours allowed
  in every zone); India → IST; **unknown → hold, never guess.** Find what the codebase already has for geocoding and
  time zones before adding anything (libphonenumber is already referenced by `clinqetshared`).
- Frequency (§8.2, §8.3) from SQL: ≤ 3 calls a week per business per number; ≤ 3 AI calls a day per number across
  businesses; 1-hour minimum gap (requested callbacks exempt); one active call per number.
- Purpose and evidence (§10): returns exactly what is missing (consent record, declared Indian number, allowed number
  series) so screens can explain it. Promotional evidence cannot exist until Phase 3 — the engine must return
  "consent missing", never allow.
- Destinations: valid E.164 via libphonenumber (`IsValidNumber`), not emergency/short-code/premium-rate, not a
  Clinket number, **country served by the business's stamp** (CA/US for `ca`, IN for `in` — verify how a stamp's
  countries are configured), non-production allow-list (setting, set per environment by `deploy.ps1`).

**W5 — Permissions (§17, D16).** Five keys with the role grants in §17; `outbound.campaign.launch` and
`outbound.contacts.manage` are sensitive (live re-check). Everything §17 lists: catalogue + `CatalogVersion` bump
(it is also the snapshot cache epoch), localization keys in the API **and** both partner apps (all 5 languages each),
`RoleAccessSummaryCatalog`, `SensitiveOperations`, the convention tests. Web `SURFACE_PERMISSIONS` and the mobile
rendering rules get entries when the UI surfaces exist (Phases 4–5). If a convention test requires an entry now,
resolve it from the actual contract under AUT-1 and record the reason; ask only if the choice remains unresolved.

**W6 — Main API (§4, §5, §9, §14, §18, §19, §20).** Endpoints, each with `[RequiresPermission]`, business id from
the token, the standard envelope, FluentValidation, localized messages:
- Briefs: CRUD, versions, validation (§5), **starter templates per purpose shipped in code** with localized text,
  **AI drafting from one sentence** (model, prompt, cost and rate limit justified under the charter; use the
  existing AI budget governance).
- Campaigns: draft CRUD; audience (§D18: picked contacts / all with a phone / customers with a booking on a date —
  single-partition queries only); launch (bulk-creates recipient calls with snapshots, excludes blocked people and
  counts them, resolves time zones, rejects missing evidence per person, idempotent, bounded batches for SQL S0);
  pause/resume/stop/cancel; edit → new version used only by recipient calls with no attempt yet.
- One-off calls: create with an idempotency key; cancel.
- Test calls: create for the member's **verified** phone (find where it lives and how the Main API reads it),
  5 a day (setting), free.
- Results: campaign summary (denominators are people, not attempts), people list with filters and keyset paging,
  answers by question, per-contact outbound history, CSV export guarded against formula injection.
- Contact permissions: list/search (one partition), add block, remove provider block, history.
- Outbound settings (provider) and admin: per-business daily people limit (new businesses 100), concurrency
  (2), campaign max people (5,000), stop outbound, platform do-not-call, active campaigns per region.
- Transcript read (D15): serves `voice-transcripts/{businessId}/{callId}.json` after proving the call belongs to the
  caller's business; `voice.transcript.read`; works for inbound today and outbound from Phase 2.
- Gating (F1): only businesses with an active AI Assistant; others get the existing upgrade path. Use the canonical
  entitlement check (memory `ai-assistant-billing-coherence-2026-09-18` — do not trust a cached snapshot for money).

**W7 — Contacts in E.164 (D19, server side).** Normalize every contact phone to E.164 on write using the business's
country; reject what does not parse to a valid number; duplicate detection and search on E.164. Existing web and
mobile clients must keep working unchanged (they send national digits; mobile caps input at 10 characters) — prove
it with their real payload shapes. No backfill: tell the owner the sandbox contacts must be reset.

**W8 — Closure (§21).** Business closure purges every outbound SQL row this phase creates and sets the permission
TTLs (W3). Later phases add their own data to the teardown.

**W9 — Settings, docs, skills, memory.** Every tunable in appsettings (options class defaults mirror the JSON).
Create `clinqet-outbound-calls` SKILL.md in all four locations (`.claude/skills/`, `.github/skills/`,
`.agents/skills/`, `.cursor/rules/*.mdc` with frontmatter) and add it to the skill tables in `CLAUDE.md`,
`AGENTS.md`, `.github/copilot-instructions.md`, `.cursor/rules/clinqet-instructions.mdc` (kept in sync). Update
`clinqet-payments`, `clinqet-provider-teams`, `clinqet-provider-crm` and `clinqet-voice-assistant` in all four
locations. Add a memory entry + `MEMORY.md` line.

**Out of scope here:** dialing, webhooks, AI sessions, MCP tools, the scheduler (Phase 2); consent capture,
handouts, notifications, analytics, activity rows, automatic pause (Phase 3); integrated screens (Phases 4–5).

---

## 2. Resolve and document these decisions before coding (ask only under the charter)

1. **Schema** — one §0.7 table per SQL table/column/index/constraint and per Cosmos field/document family/index
   (W1, W2, W3, W6 settings). Include RU and DTU cost, and what breaks if omitted.
2. **Usage storage** — `MinuteLedger` rows vs a separate seconds-based usage table + holds table. Say what happens
   to the never-written `Consumption` / `Expiry` entry types (delete what ends up unused).
3. **Inbound billing start** — today the whole call from `call.initiated` (ring and disclaimer included) is counted
   for every path except Missed. Outbound bills from answer. Recommend whether inbound should also count from answer
   (it lowers billed minutes, so it is a pricing decision for the owner).
4. **Where business outbound settings live** — SQL columns on the business (read in the scheduler's claim
   transaction) vs the Cosmos provider profile.
5. **Trial grant** — when it is granted (e.g. when the AI add-on becomes active), once per business, default amount
   and validity.
6. **AI brief drafting** — model, prompt shape, cost per draft, rate limit.
7. **Destination countries per stamp** and how the stamp's countries are read.
8. **Defect #4** (`CustomerController` never assigns `_addressHealth` / `_deliveryTracking`, so contact delivery
   markers never show) — you are editing this controller; recommend fixing it here with a test.
9. Anything in PLAN.md the code contradicts.

---

## 3. Traps (verified 2026-09-25 — re-verify before relying)

- `PhoneNumberNormalizer.ToE164` returns anything starting with `+` unchanged, falls back to US when the country is
  unknown, and to a dial-code-prepend heuristic when parsing fails. **Never acceptable for a number we will dial** —
  validate with libphonenumber and reject.
- `MinuteLedgerService` serializes per business with `sp_getapplock` (`minuteledger:{businessId}`), but the InMemory
  unit tests run the same body **unlocked** — concurrency and lock behaviour need real-SQL integration tests.
- `MinuteLedgerEntryType.Consumption` and `.Expiry` exist and are never written.
- `Voiceline` is per phone number (`voiceline_{e164}`); the ledger is per business. Used minutes are read from
  `Voiceline.UsageSecondsForStable(period)` today.
- A separate session is enforcing the top-up pack engine check in `AiAddOnService` / the minute ledger (task started
  2026-09-25). Check its state before you touch those files and never overwrite its work.
- `TenancyRoleCatalogDefinition.CatalogVersion` is the authorization snapshot cache epoch — a grant change without a
  bump waits out the cache.
- Owner and Administrator receive new keys automatically (the whole catalogue); every other role is explicit.
- Contacts are hard-deleted and re-created with new ids — which is why permissions are keyed by phone number.
- The MCP host has **no SQL**. Anything Phase 2's tools must write goes through Cosmos or an internal seam — design W3
  so the MCP host can use it (it is a library in `clinqetinfrastructure`).
- `SystemData` is **not** swept by business closure (only Ask Clinket instructions, by type) — W3 and W8 must add
  what the teardown needs.
- SQL is S0 (10 DTU) in production and Basic (5 DTU) in dev/UAT. A 5,000-person launch must be batched and measured.
- The India Cosmos account is capped at 1,000 RU/s for everything in India. Launch reads the business's
  permission partition once, never one read per person.
- EF migrations are applied by hand per region; IN migration history has diverged before — never run
  `database update` blind (memory `feedback-never-migrate-on-startup`).

---

## 4. Edge cases this phase must handle (PLAN §22 plus these)

"Call now" clicked twice · same number in two campaigns / two businesses · time zone unknown · blocked person in a
new campaign · provider tries to lift a person's own request · contact deleted and re-added · number changed after
scheduling (snapshot vs current) · minutes run out · inbound and outbound compete for the last minutes · call crossing
the month boundary · duplicate post-call processing · trial grant expiry · member loses permission mid-campaign ·
test-call limits · destination outside the stamp · two launches of the same campaign at once · editing a running
campaign · 5,000-person launch with 30% blocked · formula injection in CSV export · a brief that selects documents
that no longer exist · permission snapshot cache after a grant change · DST change between scheduling and dialing.

---

## 5. Tests

- Unit and integration for every new path, in the suite of the host that runs it (§0.18): API endpoints and services
  in `Clinqet.API.UnitTests` / `.IntegrationTests`; the inbound metering move in `Clinqet.Communications.*`.
- **Real engines are mandatory** here (money, schema, unique constraints, Cosmos batches): unique rules reject
  duplicates; parallel holds can never overspend; settle happens once; the month boundary; inbound usage idempotent
  under redelivery; permission batch atomicity; cross-tenant isolation on every endpoint.
- Rules engine: table-driven tests over countries, zones, DST transitions and windows, with a fake `TimeProvider`.
- Sabotage-verify each guard (on a scratchpad copy, never through git) and record the evidence.

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
   `public\lang\{en-US,es-US,fr-CA,gu-IN,hi-IN}.json`; partner mobile `src\Locales\{en,es,fr,gu,hi}.json`. No
   technical words anywhere a provider or customer can read.
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
13. **Shared trees.** Other sessions edit these repos at the same time (on 2026-09-25: knowledge code). Re-read a file
    immediately before editing it; never overwrite a change you did not make.
14. **Leave the tree clean.** Scratch files only in your session scratchpad; delete them; before reporting done, show
    `git status --porcelain` for every repo you touched and account for every line.

---

## 7. Audit — before this phase can be called complete (master prompt §28)

Audit ALL work of this phase across: bugs · logical gaps · missing functionality · performance · memory leaks · CPU
problems · thread safety · async/concurrency · resource handling · correctness · feature completeness · security and
tenant isolation · money · data flow · localization. The two that matter most: **no gaps or bugs** and **no missing
functionality**.

Method: re-read every changed file end to end; walk every PLAN §22 row this phase touches and every state transition;
run the tests you added and the suites your change reaches; sabotage-verify each guard; measure the 5,000-person launch.
Fix every finding. Review each fix, verify it closes the finding and creates no new problem. Only then mark the phase
complete. Record findings, fixes and evidence in the build-state file.

---

## 8. Completion and handoff

1. Write `C:\Nik\Data\outbound-calls\findings\PHASE-1-BUILD-STATE.md`: what was built (per repo, per file), every
   owner approval and ruling (date + words), deviations from PLAN.md, schema/infra/settings added, the exact
   per-region migration commands, tests added and the exact results, audit findings with fixes and evidence, open
   items for later phases, new traps.
2. Update PLAN.md: §0.1 status, §0.5 schema decisions under AUT-1, §0.6 rulings, and every section the owner changed.
3. Skills (four locations) and memory, as in W9.
4. Leave the tree clean (rule 14) and report it.
5. Read `phases\PHASE-2-PROMPT.md`. If this phase changed anything it relies on (names, contracts, decisions), add a
   dated "Changes from Phase 1" section at its top.
6. Write the handoff to `C:\Nik\Data\outbound-calls\phases\HANDOFF-TO-PHASE-2.md` **and** paste the same text in the
   chat in one fenced code block, saying they are the same. Keep it short:

```text
Outbound AI Calls — Phase 2 of 6: Calling engine.
Read C:\Nik\Data\outbound-calls\phases\PHASE-2-PROMPT.md end to end first and follow it exactly (mandatory reading,
rules, coding standards, gates, audit, handoff).
Context: Phase 1 is complete — <two lines: what now exists>. Build log:
C:\Nik\Data\outbound-calls\findings\PHASE-1-BUILD-STATE.md.
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
