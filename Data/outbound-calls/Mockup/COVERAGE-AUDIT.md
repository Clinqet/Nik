# Two-way coverage and implementation register — 4.2

Reviewed 2026-10-03; final verification completed 2026-10-04. This supplements PLAN, the mandatory implementation charter, COMPONENTS.md and INTERACTION-REVIEW.md. It assigns implementation ownership; it does **not** certify unbuilt production functionality. The approved isolated reference is `C:\Nik\Data\outbound-calls\Mockup\index.html`.

**THE ENTIRE MOCKUP, ITS DESIGN, COMPONENTS, STATES AND INTERACTIONS ARE FULLY OWNER-APPROVED. REUSE AND IMPROVE THEM WITHOUT ANOTHER APPROVAL OR A NEW MOCKUP. EVERY PHASE MUST READ THIS REGISTER AND RECONCILE BOTH DIRECTIONS: REQUIREMENT → INTERFACE/BEHAVIOR/TEST, AND MOCKUP CAPABILITY → PLAN/REAL CONTRACT/IMPLEMENTATION PHASE/TEST. DO NOT IMPLEMENT A UI STUB OR LOSE A REQUIREMENT BETWEEN SESSIONS.**

**EXERCISE JUDGMENT UNDER AUT-1. A PROTOTYPE CONTROL IS NOT A COMMAND TO COPY AN UNSUITABLE IMPLEMENTATION. VERIFY ITS USER NEED AND THE EXISTING CODE. REUSE, SIMPLIFY OR IMPROVE THE SOLUTION WITHOUT ROUTINE OWNER APPROVAL; ADD NECESSARY FUNCTIONALITY OR SCHEMA PROPERLY. RECORD WHY, UPDATE THIS REGISTER AND THE PLAN/PROMPTS, AND KEEP THE SAME USER OUTCOME OR AN EXPLICITLY JUSTIFIED BETTER ONE. DO NOT SILENTLY DROP REQUIRED BEHAVIOR, SECURITY, DATA QUALITY OR FUNCTIONALITY. ASK ONLY IF A MATERIAL DECISION REMAINS UNRESOLVED AFTER COMPARING OPTIONS AND RECOMMENDING ONE.**


## Required 4.2 extension — one or several people without a campaign

The owner's 2026-10-04 review exposed a scenario the earlier completeness review missed: selecting several people together outside a campaign. The old single-person flow existed in both documents and UI, but that agreement did not establish complete product coverage. **C25, PLAN §18.7, SOLUTION §31 and QUICK-CALLS.md now make the generic one-or-small-group flow explicit in both directions and in every phase.** The earlier no-unmatched-feature conclusion is superseded for this scenario.

The reference now uses one composer, per-person eligibility/time review, independent requests, partial/uncertain-save recovery, per-person cancellation and history, with no hidden campaign. `quick-calls.js`/`quick-calls.css` are reusable design/interaction references. Read QUICK-CALLS.md in full for Q01–Q16 and exact phase ownership. Version 4.1 browser evidence below is historical; new 4.2 evidence is in REVIEW.md.

## Open and inspect the actual mockup

Open `C:\Nik\Data\outbound-calls\Mockup\index.html` in Edge or Chrome. No package installation, compilation, backend or server is required. From PowerShell:

```powershell
Start-Process 'C:\Nik\Data\outbound-calls\Mockup\index.html'
```

Use **Screens**, **State**, **Product**, **Role**, **Responsive web / Mobile app**, size and theme controls. Check both Business and AI Assistant navigation. Use **Open full screen** for the actual viewport. Direct examples:

- `file:///C:/Nik/Data/outbound-calls/Mockup/product.html?screen=builder&state=brief&mode=web&product=business`
- `file:///C:/Nik/Data/outbound-calls/Mockup/product.html?screen=builder&state=hours-large&mode=app`
- `file:///C:/Nik/Data/outbound-calls/Mockup/product.html?screen=call&state=delivery-failed&mode=web`

Most interactions are session-local simulations; a saved campaign draft uses this browser's local storage. Reset the demo for an independent scenario. Voice samples are existing local audio; the call-recording player and calls/messages are simulations. Native mode demonstrates intended patterns in HTML and requires real iOS/Android implementation and device verification. Core-copy language previews are not full production translations. Read REVIEW.md for exact verification evidence and limits.

## Plan → mockup → implementation

Phase numbers below refer to five implementation sessions (1–5) and the independent final audit (6). Backend obligations need visible consequences and real-engine tests, not artificial provider-facing database or queue screens.

| ID / requirement | Approved UI or observable behavior | Implementation ownership and required proof |
|---|---|---|
| C01 · PLAN §1–3, D1–D2, F1 · three calling purposes and eligibility | Overview setup/upgrade/trial/hold states; campaign builder; individual-call sheet; requested callback in Calls and Call Follow-ups | 1: authoritative eligibility and request contracts. 2: execution. 4: provider web/native. 6: verify no action bypasses entitlement, purpose or assigned-number checks. |
| C02 · D17, §17–18 · two product dashboards | Dashboard + navigation.js: AI calls in both rails; Overview/Campaigns/Calls with saved briefs, permissions, handouts and settings; native entry/menu/back paths | 4: actual rendering rules, roles, product switching and deep links. 5: remaining existing surfaces. Preserve unrelated navigation, denied/loading rules and record context. |
| C03 · §4–5 · structured brief | Builder Goal/Conversation: purpose, goal, completion, up to five points, six question types, required/optional, choices, allowed actions, language/voice/style, extra instructions, files | 1: validate/version contract and bounded settings. 2: enforce in prompt/tools/extraction. 4: editable complete form and review. Choice text/types/required/actions must survive save/reload/apply. |
| C04 · §5 · reusable briefs and AI drafting | Saved briefs: preview/use/save/edit a copy/edit owned brief/delete owned brief; draft helper → editable suggestion → explicit apply | 1: business-scoped versioned CRUD and real AI drafting. 4: usable UI, stale-version/conflict handling, preserve draft on error. Starter content is copied, not globally overwritten. Existing campaigns keep their version. |
| C05 · D18–19, §8/18 · choose people | Builder People: selected contacts/all contacts/booking date, phone eligibility, search/filter/pages; 500-person scenario | 1: normalized identities, bounded audience API and snapshot. 4: stable selection across pages/filter/back. 5: CRM parity. Never fetch all 5,000 just to paginate locally. |
| C06 · §8.4 · local hours and schedule | Timing & budget: now/later/deadline, optional narrower campaign window, summary-first local-hours browser, source/unknown hold, domestic/mixed copy | 1: timezone/source/DST and effective-window rules. 2: recheck before dial. 4: bind business defaults + brief narrowing + legal limits + optional opening hours to one authoritative result; no legal-hours arithmetic trusted to the browser. |
| C07 · §6.4/14 · test/usage/trial/cap | Review & test; settings verified-phone/test-limit/unverified states; trial/expired, reserve, estimate, cap reached → raise cap | 1: ledger/current plan/reserve/cap/request APIs. 2: own verified member phone, quota and metering. 4: retain authoritative saved values; free tests increment quota but never campaign results, trial usage or billed minutes. |
| C08 · §4/13/19 · campaign lifecycle | Campaign progress, scheduled/paused/budget/safety/admin/completed/cancelled; history; pause/resume/stop and version review | 1: lifecycle APIs, actor/time/version and correct resume authority. 2: queued/active cancellation and holds. 3: safety and activity feed. 4: correct record and reason. Raising a cap or clearing a safety hold must not erase other holds or silently dial. |
| C09 · §20 · results and exports | Campaign Answers: yes/no, choice, number, date/time, rating and text; confirmed/unconfirmed/unknown/refused; bounded records. Progress: denominators/outcomes; export privacy choices | 1: real bounded results/aggregate/export contracts and CSV injection protection. 2: typed extraction + status/provenance. 4: counts/charts/people/history/CSV from the same campaign revision and filters. No inferred zero/no/date; no private media without separate access. |
| C10 · §6–8/20 · call result/history | Summary/Answers/Transcript/Next step/History tabs; each outcome; pending/failed summary; confirmed/queued/failed delivery; actual business actions | 1: result/media/history read contracts. 2: usage recorded independently of summary; unknown-carrier recovery. 3: document delivery status. 4: summary does not invent answers/actions; failed processing never redials. |
| C11 · D15, §16/21 · media | Live + Call transcript/recording, restricted access, recording off, retention expiry, reconnect | 1: authorized read. 2: recording notice sequence, live updates/reconnect and retention. 4: incoming/outgoing parity; summaries remain accessible where allowed. 6: no cross-tenant access, leaked media URL or duplicate call on reconnect. |
| C12 · §7.3/8 · individual calls/callbacks | Contact/booking/follow-up sheet → review → visible waiting request → review/cancel; callback confirmed time/retry/expiry/cancel; booking person fixed | 1: separate one-off request with original number and context. 2: callback rules and stale-booking final check. 4: persist source record, person, purpose, goal, time and team-follow-up choice; never change an unrelated person from a booking sheet. |
| C13 · §7/20 · human follow-up | Call next step → team task with note/assignee → Call Follow-ups → visible Done; long press/swipe and buttons | 2: existing follow-up integration on outcome. 3: permitted notifications/activity. 4: create, assign through actual existing permissions, show authoritative task/status, prevent duplicate submission, retain completion history. No outbound live transfer. |
| C14 · D19, §9/21/25 · CRM integrity | Contacts/profile/edit/delete, number changed review, source/permission history; deleted contact cannot enter a new audience | 1: server E.164 and stable number snapshot. 5: real web/native CRM mutation + existing delete-authority defect. Deletion cancels unattempted linked work but preserves statutory permission minimums and required call history; never shifts index-based identities. |
| C15 · §9–10 · blocks and proof | Calling permissions: searchable bounded blocked/consent/link lists, exact-number evidence/history, own-block removal, protected person/platform source, expired evidence | 1: business/number-scoped enforcement and race-safe provenance. 3: capture/expiry/withdrawal. 5: real list changes and evidence, correct actor/reason. Removing one restriction cannot lift another or create consent. |
| C16 · F2, §9.6 · five permission routes | Permission link + verified customer phone; optional booking choice; incoming voice capture outcome; Canada paper upload/evidence; India restriction/declaration | 3: capture and lawful messaging channel checks; current official legal research. 5: provider/customer web/native/public-page UI. India operator consent integration remains out of scope; a declaration cannot enable promotions. Historical proof does not override a later stop request. |
| C17 · D8, §15.2 · knowledge | Three inline source choices, select all, removed-source state; no separate campaign knowledge-upload store | 1: brief selection contract. 2: all four retrieval paths intersect current permitted assistant knowledge. 4: unavailable choice is actionable; preflight cannot use removed/ineligible material. Knowledge files never become handouts. |
| C18 · D9, §15.3 · handouts | In-builder + library add/upload/actual preview/approval/edit copy/remove/delete; shared-file protection; pending/rejected/failed delivery | 3: secure upload/content/approval/version/usage/send/delivery contracts, eligible channel and customer agreement. 4: fully integrated supporting tools. 5: standalone reuse. Server protects other campaigns and existing delivery history against concurrent delete/replacement. |
| C19 · §19, F4/F6 · admin | Regional campaigns/safety; per-business daily/concurrency/audience/assistant hold; platform block/remove; India number declaration | 1: business/stamp-scoped admin APIs. 2: declaration/dial enforcement. 3: safety alert/clear decision. 5: real admin forms and history; assistant hold includes inbound, daily zero is outbound only; clear safety is not automatic resume. |
| C20 · F5, §18.4 · customer surfaces | Consent default/OTP/wrong-code/limit/success/used/expired/withdraw/withdrawn/closed; booking signed out/unverified/opted out; public page → signed-in booking | 3: secure link/challenge/withdraw and booking APIs. 5: customer web/native parity, optional unticked permission and verified current phone. Booking still works without marketing consent; no guest checkout introduced. |
| C21 · §16–18 · access and UI quality | Every declared screen/state, shared controls, role loading/denied, offline/retry/conflict, responsive web/native/dark/reduced motion, keyboard and return focus | 1–3: server authorization/validation/error contracts. 4–5: all locales + accessibility and real native behavior. 6: production device/keyboard/screen-reader and record isolation audit, not HTML-only proof. |
| C22 · §20 · notifications and analytics | Notification examples/deep links to the correct summary/campaign/task; campaign attention/finish states; no push for every call | 3: existing pipeline, preference/routing/SignalR/localization/analytics contracts. 4–5: route to record with back context and current authorization. 6: verify revoked/deleted/expired targets and replay. |
| C23 · §11–14/16/22–24 · backend invariants | Checking result; no retry while uncertain; minute/safety/cap/admin pause; coherent result/usage; no provider-facing internal engine terminology | 1–3: real-engine idempotency, SQL ledger/holds, partition-scoped Cosmos, outbox/reconciliation, carrier restrictions, capacity, tenant/tool binding, atomicity, injection/abuse tests, infra configuration. 6: faults/load/cost. These are backend acceptance tests, not missing mockup pages. |
| C24 · §21/25 · retention and closure | Expired media, retained result/permission minimums, protected history after contact/library removal, closed customer invitation | 1–3: appropriate lifecycle/closure job and evidence retention. 5: truthful unavailable/deleted states. 6: closure purges own results/media/handouts, retains only legally required minimums and existing financial records. |
| C25 · PLAN §18.7, QUICK-CALLS Q01–Q16 · one or a small group outside campaigns | Same Call with AI composer from generic/Contacts/profile/booking/follow-up entries; bounded selection; business-zone schedule with per-person effective time; excluded, partial, uncertain, completed/cancelled states; independent request status/results/history/cancel | 1: bounded review/create/recover/cancel, immutable identity/brief/number and real-store idempotency/races. 2: common OneOff engine and final guards/ledger. 3: per-number consent/operations/retention. 4: shared provider web/native integration. 5: reuse in standalone contact surfaces. 6: Q01–Q16 proof. No hidden campaign, batch entity or second engine. |

## Screen → requirement reverse index — 4.2 cross-check 2026-10-04

This index was checked against every screen and state declared in `data.js`, its operation description and its registered renderer. The C-rows above supply the PLAN sections, implementation phases and proof obligations. C21 (access, responsive controls and failure states), C23 (backend safeguards) and C24 (lifecycle) also apply wherever relevant; they do not require artificial extra screens.

| Screen ID | Declared states | Renderer source | Required coverage, including supporting dialogs/actions |
|---|---:|---|---|
| `dashboard` | 6 | `navigation.js` | C01, C02, C07, C22: both product entries, menus, eligibility, plan handoff and notifications |
| `overview` | 13 | `provider.js` | C01, C07, C08, C13, C22: readiness, usage, campaign attention and team follow-up |
| `campaigns` | 7 | `provider.js` | C01, C05, C08: list/filter, draft creation and campaign lifecycle |
| `calls` | 31 | `provider.js` | C10, C12, C25: results, one-or-small-group composer, scheduling/receipt/recovery, independent history/cancel and requested callbacks |
| `builder` | 33 | `campaign.js` | C03–C08, C15–C18: five steps, saved briefs/drafting, audience/hours, inline knowledge, in-place permission/handout tools, review/test/launch and draft return |
| `templates` | 6 | `provider.js` | C03, C04: complete structured create/preview/use/copy/edit/delete/version behavior |
| `providerbooking` | 7 | `provider.js` | C12, C25: shared composer with fixed booking/person context and stale-booking holds |
| `campaign` | 15 | `campaign.js` | C06–C10, C13: progress, answers, people/history, pause/resume/stop, cap/version changes and export |
| `call` | 30 | `call-results.js` | C09–C13, C18: summary, typed answers, media, business/delivery outcomes, history and next step |
| `live` | 8 | `provider.js` | C08, C11: identity/recording disclosure, live transcript, reconnect and polite ending |
| `followups` | 7 | `call-results.js` | C12, C13, C22, C25: source-aware Call with AI, callback versus human task, assignment/note/completion and deep links |
| `contacts` | 7 | `people.js` | C05, C12, C14, C15, C25: shared one-or-small-group composer, bounded CRM list, contact mutations, individual call and permission entry |
| `contact` | 14 | `people.js` | C12, C14–C16, C25: preselected composer and independent requests, number/source/history, changed-number review, service evidence and protected deletion |
| `permissions` | 13 | `people.js` | C15, C16: bounded records, send link, paper proof, expiry, source-aware blocks/removal/history |
| `handouts` | 11 | `people.js` | C18: actual preview, upload/approve, copy/edit/attach/remove and shared-file protection |
| `settings` | 10 | `provider.js` | C01, C06, C07, C11: setup, calling windows, reserve, voicemail/recording, test verification/quota and plan handoff |
| `admin` | 11 | `people.js` | C08, C15, C16, C19: regional controls, daily/concurrency/audience limits, holds, safety, platform blocks and declarations |
| `consent` | 14 | `customer.js` | C15, C16, C20: signed invitation, optional choice, phone proof, failure/expiry and withdrawal |
| `booking` | 8 | `customer.js` | C16, C20: existing signed-in booking with independent optional permission and verified phone |
| `publicbooking` | 8 | `customer.js` | C16, C20: public-page entry into the same signed-in booking and permission rules |

**Result: all 20 declared surfaces and 259 declared states have a requirement mapping; all C01–C25 requirement groups have a UI/observable-behavior or backend-test destination. The reverse index includes the newly required C25; its Q01–Q16 contract must also be verified, rather than treating matching screen counts as proof of full functionality.** Supporting behavior in `app.js`, `builder-tools.js`, `audience-ui.js`, `record-ui.js`, `controls.js`, `quick-calls.js` and `ui.js` belongs to these same flows, not an unassigned extra phase. The logical action-contract entries in `data.js` supplement this index; interface-only actions and review-studio controls follow the boundaries below.

**KEEP BOTH DIRECTIONS CURRENT IN EVERY PHASE. IF A REQUIRED UI/OPERATION IS MISSING, ADD IT; IF A MOCKUP CAPABILITY IS ABSENT FROM THE SOLUTION OR PHASE SCOPE, UPDATE SOLUTION, PLAN AND THE RESPONSIBLE PROMPT WITH WHERE/HOW IT WILL WORK AND HOW IT WILL BE VERIFIED. APPLY AUT-1 WHEN A SIMPLER OR BETTER IMPLEMENTATION PRESERVES THE OUTCOME. RECORD THE REASON; DO NOT SILENTLY OMIT IT OR CLAIM A PROTOTYPE IS A WORKING INTEGRATION.**

The final follow-up also corrected the PLAN mockup register from version 4.0 to 4.1 and aligned Phase 1's result-read and Phase 2's answer-extraction coverage references. Every phase was checked for its mandatory next-session handoff; Phases 1–5 name the next prompt and handoff file, and Phase 6 has no successor. This was a source/document traceability check; the browser execution evidence remains the version 4.1 run recorded in REVIEW.md.

## Mockup → plan: details made explicit by this review

These are concrete refinements to existing requirements, including the required C25 extension, not a new seventh phase. PLAN §18.6 and each phase's audit obligations refer to these IDs.

| UI detail found or clarified | Where/how to implement |
|---|---|
| One-or-small-group selection/scheduling without a campaign, independent partial/uncertain submission recovery and per-person results/cancel | C25 / QUICK-CALLS.md: Phases 1–2 core request/engine; 3 consent/operations; 4 shared web/native form; 5 contact reuse; 6 Q01–Q16 audit. |
| Full saved-brief edit/copy/delete/version and complete question metadata/action reuse | C03–C04: Phase 1 real CRUD/version semantics; Phase 4 library/builder, immutable campaign snapshots and conflict tests. |
| All six answer formats, separate confirmation statuses, clear metric denominators and matching export | C09: Phase 1 query/export, Phase 2 extraction, Phase 4 UI; Phase 6 compare real records across all views. |
| Small inline knowledge choices; source removed while draft open | C17: Phase 2 current permissions at retrieval/dial, Phase 4 inline correction and preserved draft. |
| Campaign-specific narrower schedule; large/unknown/mixed-country audience | C06: Phase 1 authoritative intersection and source metadata, Phase 4 bounded preview and final review, Phase 2 DST/current-rule recheck. |
| Exact-number service evidence, block/removal history, pending link request, uploaded paper proof | C15–C16: Phase 1 core enforcement, Phase 3 evidence/expiry, Phase 5 forms and same-record responses. Evidence cannot leak to the next contact. |
| New cap remains saved; safety review clear/keep; declaration values remain visible | C07/C08/C19: Phase 1 settings and cap API, Phase 2 declaration, Phase 3 safety service, Phases 4/5 authorized edits; every mutation renders its returned version. |
| Individual-call request record/cancellation and booking-person lock | C12: Phase 1 request/cancel, Phase 2 final validation, Phase 4 reachable source-aware UI. |
| Test-phone unverified + quota changes; summary delayed/failed independent of billed duration | C07/C10: Phases 1/2 authoritative quota/usage/recovery; Phase 4 truthful waiting/failure/results; free tests excluded from analytics. |
| Team-follow-up note/assignee/status; queued/failed/confirmed handout or booking outcome | C10/C13/C18: use existing task/booking/delivery models and capabilities; Phases 2/3 backend, Phase 4 UI and deep links, Phase 5 reuse. Do not invent another task system. |
| Contact deletion and permission retention; read-only empty-state actions | C14/C21: Phase 5 CRM flow and deletion authority fix, Phase 4/5 shared rendering rules, Phase 6 actual role/deletion tests. |
| Shared component code, return state, dirty dialog/draft protection, table/list density | C02/C21: Phase 4 shared integration and Phase 5 reuse; keep existing forms/navigation and localization rather than copying global prototype DOM listeners. |

## Historical design and existing-product boundaries

- PLAN D10 explicitly removed personalized/name-filled document generation. Historical SOLUTION/Prompt research about it is not a missing mockup flow or authority to add it back.
- PLAN D20 defers live outbound transfer. An existing incoming-call capability does not authorize an outbound transfer button.
- PLAN D8 uses current assistant knowledge with optional narrowing. Private per-campaign knowledge libraries in earlier recommendations are superseded. Approved customer handouts are separate.
- D18 defers CSV audience import. CSV **results export** is in scope and mapped above.
- India promotional calling stays blocked until a separately justified lawful operator-consent integration; number declarations alone are insufficient. D21 voice-model migration is another task whose result must be verified.
- Dashboard booking, billing, account security and other existing-product links are integration destinations, not specifications to rebuild those products. Their real route, access, return and failure behavior must be verified in the owning phase.
- The studio's screen/state/device/role selectors, simulated record fixtures and preview-reset controls are review tools, not production features. Do not create production schema for a fixture or review control.

## Completion evidence each implementation session supplies

**FOR EVERY APPLICABLE ROW, RECORD THE REAL SOURCE FILES/CONTRACTS, SHARED COMPONENTS REUSED, SERVER AUTHORITY, REQUIRED PERSISTENCE, SUCCESS/FAILURE/CONFLICT/PERMISSION/LIMIT BEHAVIOR AND TEST EVIDENCE. TRACE FROM BOTH THE REQUIREMENT AND THE CLICKABLE CONTROL. DO NOT MARK A UI COMPLETE BECAUSE IT RENDERS OR SHOWS A SUCCESS TOAST.**

When a better solution makes a mockup detail unnecessary, record the user outcome preserved, the alternative and its evidence; update PLAN, this register and the affected phase prompt. Keep storage proportional to actual need. Data quality means stable record identity, normalized numbers, explicit timestamps/time zones and evidence provenance, frozen audience/brief versions, consistent aggregate/export filters, typed answers with explicit missing/refused/unconfirmed status, and authoritative concurrency-safe changes. No speculative duplicate fields or permanent “already gave feedback” flag.

Phase 6 rechecks all C01–C25 rows across the actual applications, APIs, Functions, MCP, queues and stores. Design approval and prototype tests are not deployment approval, legal clearance, real carrier proof, production localization or native-device certification.


## External-source spot check — 2026-10-03

This design review retains the existing permission policy; it does not provide launch clearance or replace the Phase 1/3 legal review. The FCC ruling includes AI-generated voices within artificial/prerecorded-voice restrictions, with consent subject to the applicable exceptions. CRTC's ADAD solicitation rules require prior express consent. These support keeping purpose-specific evidence rather than assuming all CRM contacts consented. [FCC 24-17](https://docs.fcc.gov/public/attachments/FCC-24-17A1_Rcd.pdf), [CRTC key rules](https://web.crtc.gc.ca/eng/phone/telemarketing/tobligations/rules-regles.htm). Direct fetches of the original FCC PDF and CRTC host returned 403; the official search-indexed ruling/rules were available. Verify the complete current rules, exemptions and subnational requirements in the implementation research.

Plivo documents different Indian number-series purposes and distinguishes service situations that do and do not require explicit consent. The interface therefore cannot treat a number declaration as blanket calling permission; retain the planned India promotional hold and verify actual purpose/evidence at execution. [Plivo India calling](https://www.plivo.com/docs/voice/concepts/india-calling).

Microsoft distinguishes database-shared throughput from throughput reserved for one container. Container placement decisions must inspect actual provisioning, not assume every new container equally divides capacity. [Azure Cosmos DB throughput](https://learn.microsoft.com/en-us/azure/cosmos-db/set-throughput).


Final prototype evidence is recorded in REVIEW.md §“Final two-way audit”: 1,452 layout/state cases, 480 role/product cases, 157 interaction assertions across 27 workflows, six studio widths and the small dark editor check. No production implementation is certified by these results.
