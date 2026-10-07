# Outbound AI Calls — final design review

Owner-approved reference · expanded 4 October 2026 · Version 4.2

Open [the interactive studio](index.html). Choose **Product** to compare Clinket Business and Clinket AI Assistant, **Responsive web / Mobile app**, a width, a state and a role. Native light/dark themes and longer core-copy examples are available. Everything is simulated; this folder makes no calls, sends, purchases or backend writes.

## Version 4.2 — one person or a small group, without a campaign

The owner identified a real gap after the 4.1 review: the single-person non-campaign form did not support selecting several people together. The earlier completeness claim was too broad. This extension adds that outcome to the actual prototype, PLAN §18.7, SOLUTION §31, QUICK-CALLS.md, coverage C25 and every phase prompt. Read QUICK-CALLS.md's Q01–Q16 acceptance matrix; older single-person-only descriptions and the 4.1 coverage totals are historical.

- One shared composer from AI Calls/Calls, both dashboards, Contacts/profile, booking and follow-up entries. One or a small selection uses the same flow; booking context remains one fixed person. Search, bounded pages, selected-only and a visible ten-person limit retain choices and form values.
- One labelled business-time schedule is translated into each person's local permitted time for review. Past/ambiguous times, missing location/evidence, stop requests, duplicates and changed numbers cannot silently start a call. No hidden campaign, alternate engine or automatic consent.
- Independent request records, partial/uncertain-save receipt, retry of a failed item only, status lookup without another request, per-person detail/history/cancel and completed/cancelled examples. Contact history includes the original number after edits. Existing roles remain separate.
- Reuses branded fields/dropdowns/checkboxes, responsive columns/stacking and native sheets. Dirty close protects the form. Production contract includes reload/background recovery, actual state/cancellation races, full localization and native-device verification.
- Every phase must read QUICK-CALLS.md, implement its assigned C25 obligations and hand verified progress to the next session without another reminder. The approved-source reuse and creative freedom/no-routine-reapproval requirements remain.

Prototype validation and exact limitations are recorded below after the 4.2 checks complete. Prior 4.1 runs do not certify the new flow.

## Earlier two-way audit — version 4.1, completed 2026-10-04

**THE ENTIRE MOCKUP IS FULLY OWNER-APPROVED, INCLUDING REUSABLE COMPONENTS, STATES AND INTERACTIONS. IMPLEMENTERS HAVE AUT-1 CREATIVE FREEDOM TO IMPROVE NECESSARY UI, FUNCTIONALITY, ARCHITECTURE AND SCHEMA WITHOUT ROUTINE OWNER REAPPROVAL OR ANOTHER MOCKUP. KEEP THE SIMPLEST CORRECT SOLUTION, SECURITY, DATA QUALITY, COST, PERFORMANCE AND COMPLETE FUNCTIONALITY. NO UI STUBS.**

Read [COVERAGE-AUDIT.md](COVERAGE-AUDIT.md), which now maps **24 requirement groups in both directions**, including backend-only invariants, every declared surface and implementation/test ownership. PLAN §18.6, SOLUTION §30 and all six phase prompts incorporate the mockup details that previously lacked explicit implementation acceptance. Every prompt now includes the exact mockup path, PowerShell/browser preview instructions, actual reusable code sources and the existing-app component guide. The Phase 1 starter carries the same requirements.

### Corrections and additions

- Saved briefs support full structured create/preview/use/edit/copy/delete/version behavior; question formats, choices, required/optional and allowed actions survive reuse. Irrelevant choice fields remain hidden. Campaign conversation editing applies a complete new version only to unattempted people; an existing campaign's purpose cannot silently change.
- Results demonstrate all six answer formats, explicit confirmation states, bounded answer rows, person-based metric denominators and matching full/filtered CSV. The linked example call and campaign use consistent answers. CSV defaults exclude phone/media, preserve missing/refused/unconfirmed status and escape formula-sensitive cells.
- Block creation/removal, exact-number history/evidence, pending permission links and signed evidence change visible records. A removal-dispatch collision found during testing was fixed. Person/platform restrictions remain protected. Expired permission stays ineligible across permission, profile, individual-call and campaign views.
- Service-relationship evidence is tied to the number. Unknown location consistently holds a call. Contact deletion removes new selection eligibility without erasing required block/call history; an existing booking cannot silently substitute a different person.
- Saved campaign caps remain saved and do not automatically resume. Admin safety keep/clear decisions retain evidence and update the visible review status; number declarations retain their entered values. A declaration never unlocks promotions. Restricted Indian number-series eligibility is labelled explicitly and assigned to Phase 1/2/5 verification in the plan.
- Business calling settings and optional narrower campaign times feed the local-hours summary, per-person detail and review. Large audiences stay summary-first, searchable and bounded, with destination-relevant copy. Removed knowledge sources can be corrected inline before continuing.
- One-off requests have visible review/cancel state and preserve booking context and team-follow-up choice. Team follow-ups carry note/assignee/completion. Test quota changes visibly; an unverified member phone cannot start a free test.
- Call results now include summary processing/recovery, confirmed business actions and queued/failed/confirmed handout delivery. Measured usage remains independent of summary processing; no invented answers or redial to recover a summary.
- Read-only empty-state actions respect roles. Dispatcher access still permits an individual call. Opening review does not expose a private purpose before identity confirmation and reflects recording preferences. The studio links to the two-way register and can reset its local example state.

### Verification evidence and practical limits

- **1,452 layout/state cases passed** for 20 surfaces and 242 declared states: 320/768/1024/1440 web, plus 390 native-pattern light/dark. Admin remains web even in the native-mode configuration. Each page was loaded independently. No script error, horizontal overflow, settled dialog overflow, empty rendered icon or unenhanced product select was found.
- **480 role/product/surface cases passed:** 20 surfaces × six roles × two products × web/native configuration. These check rendering, basic denied-action gates, errors and overflow; they do not prove server authorization.
- **157 successful assertions across 27 interaction workflows:** complete brief copy/edit/use/delete and versions; protected block mutation; pending requests and evidence; number-specific relationship; cap retention; six-format results and CSV; booking/individual cancellation; timezone/window/settings consistency; unavailable knowledge; test quota; team task completion; admin review/declaration; contact deletion; pending summary/delivery; role-aware empty states; native picker keyboard/Escape/focus; protected handout copy; expired consent; large-audience paging and country copy. The last regional check was rerun with the actual disclosure selector after correcting the test selector; it passed. Record-change safeguards were checked after the layout run because they change eligibility rather than layout.
- **Six studio widths passed** (320, 390, 768, 1024, 1440, 1920), plus the dark native brief editor at **320 × 480**. Desktop campaign, native timing/conversation, answer list and small dark dialog screenshots were visually inspected.
- All mockup JavaScript passed Node syntax checks. All six phase prompts plus PLAN, SOLUTION, the original requirement wrapper, charter and Phase 1 starter passed the mandatory-coverage/approval/reuse/preview/data-quality/delegation checks. Exactly six phase prompts remain; Phases 1–5 name their real successor and Phase 6 has none.

The table below this section is earlier-version history. Version 4.1 supersedes its narrower saved-brief, synthetic-answer, state-count and goal-only editing descriptions. No unresolved failure remained in these prototype checks. This is not a claim that every possible defect is mathematically excluded: production authorization, real SQL/Cosmos/carrier integrations, all localization, legal eligibility and actual iOS/Android/assistive-technology behavior still require the assigned implementation evidence.

Five implementation phases plus the final multidimensional audit remain the recommended schedule (PLAN §26). No implementation phase or production deployment was performed by this mockup audit. All own temporary scripts, screenshots and result files are removed after recording evidence; deliverables stay in the owner-selected project folder. Existing production-repository work is preserved.

Final follow-up on 2026-10-04: added the screen-to-requirement reverse index in COVERAGE-AUDIT.md, checked all 20 registered renderers/operation descriptions and 242 declared states, corrected the PLAN version label and Phase 1/2 coverage references, and made the next-session handoff explicitly require no further request or reminder. No unmatched current-scope feature was identified. These are source/document checks; the browser results above remain the previous 4.1 execution evidence. No product behavior or production code changed in this follow-up.

## Previous end-to-end design review — version 4.0, 2026-10-03

**THE ENTIRE REFINED MOCKUP IS OWNER-APPROVED. IMPLEMENTERS MAY IMPROVE THE UI AND NECESSARY FUNCTIONALITY, ARCHITECTURE AND SCHEMA WITHOUT ROUTINE REAPPROVAL. READ [IMPLEMENTATION-CHARTER.md](../IMPLEMENTATION-CHARTER.md) IN FULL. DO NOT OVERCOMPLICATE; JUSTIFY CURRENT NEED, SECURITY, COST AND PERFORMANCE. ASK ONLY FOR GENUINELY UNRESOLVED DECISIONS AFTER COMPARING OPTIONS AND GIVING A RECOMMENDATION. NO UI STUBS OR FAKE PRODUCTION SUCCESS.**

**COMPONENTS ARE PART OF THE APPROVED REFERENCE.** Read [COMPONENTS.md](COMPONENTS.md) for reusable mockup source, actual app component paths and integration acceptance. Every phase must reuse or improve the existing controls to match the approved theme; no renewed approval is needed.

**Final documentation reconciliation — 2026-10-03:** rechecked the owner’s latest requests and retained five implementation phases plus the sixth multidimensional audit after comparing further combinations in PLAN §26. The Phase 1 starter now includes the project context, all six sessions, direct owner approval/delegation, required reading, coding standards, complete functionality and the next-session handoff. Corrected stale UI phase references, the final audit’s old per-item schema-approval wording and conflicting historical solution-stage instructions. All phase prompts explicitly identify the same delivery schedule.

The final pass rechecked the requirements, all original phase scopes, the existing per-surface acceptance matrix, previous owner critiques and the actual control implementations. The delivery schedule is now six sessions: foundations; calling engine; consent/handouts/operations; provider UI with backend-contract reconciliation; remaining provider/admin/customer surfaces; final audit. The former design-only phase is merged into provider UI. Its state, role, localization, contract-map and responsive verification obligations remain mandatory. Every phase has the owner ruling and a final-chat next-session handoff requirement; the last phase has no successor.

| Reviewed gap | Final reference behavior |
|---|---|
| Browser-default dropdowns and inconsistent form styling | Searchable branded pickers with selected states, keyboard arrows/Enter/Escape, no-match text, focus return and viewport-aware positioning. Native uses a themed bottom sheet without forcing the keyboard open. Provider/customer fields use the established light-gray floating-label treatment and lime focus; admin retains externally labelled bordered fields. Checkboxes/radios use consistent sizes, colors and accessible labelled hit areas. |
| Call filters overwrote one another | Outcome and call type filter independently and together; empty results explain how to recover. |
| Different campaign cards opened the same example | Scheduled, running, completed and draft entries retain their own identity and appropriate values. Notifications open the named completed campaign. |
| History was promised but not directly visible | Campaign History and call History are direct tabs. Campaign history shows changes and actors; call history distinguishes attempts, a never-dialled request and an uncertain carrier result. Unknown results never imply permission to retry. |
| Campaign people list and return context | Ten rows per page with search/status filters and accurate totals. Opening a call summary and going back restores the campaign's People view and filters. Synthetic rows never invent detailed answers or recordings. |
| Misleading campaign progress/export | Pausing new calls leaves active conversations visible. Stopped work is distinct from finished/blocked work. Exports use the selected campaign's own synthetic audience and selected columns, with unknown answers left unknown and formula-sensitive cells escaped. |
| Conversation omissions | Optional extra instructions persist into review; service purpose requires confirmation that the call does not sell/promote. Brief review includes selected knowledge, files, language, voice, actions and question types. |
| Deadline ambiguity | Seven-day individual expiry is measured from the first attempt, subject to an earlier campaign/booking deadline. The campaign date field does not invent a seven-day-from-launch restriction. |
| Settings appeared saved but reset on redraw | Hours, language, recording, voicemail, business-hours preference and incoming protection retain their saved preview values. Invalid hours are rejected; protection totals update; read-only roles cannot edit fields. |
| Admin review lost the selected business or limits | Review identifies the selected business. Daily limit, concurrency, campaign size, hold and reason survive confirmation/save. Invalid values are rejected. |
| Customer phone verification displayed a different number | Entered name/phone/country remain available on return; the verification view uses the actual entered phone. Returning requires a fresh explicit consent choice. |
| Withdrawal and callback states were inaccurate | Stop-all-calls wording stays distinct from promotional-only withdrawal and calls-plus-WhatsApp. Cancelled callbacks remain cancelled, rather than being labelled expired. |
| Prior owner-reported dead ends and large lists | Rechecked saved briefs, drafting review/apply, in-campaign permissions, inline information selection, shared-handout protection/copy, voice selection, bounded hours/search/filter/paging and country-relevant explanation. Existing draft/step and dirty-form protection are retained. |

Control references inspected include partner web `floatingOptionSelect.jsx` and its tests, `floatingInput.jsx`, `floatingLabel.jsx`, `customCheckbox.jsx`; provider mobile `FloatingOptionSelect.tsx` and `CustomCheckbox.tsx`; admin `AdminSelect.jsx`; and customer web `floatingSelect.jsx`, `floatingInput.jsx`, `customCheckbox.jsx`. Customer web currently uses a native select with floating styling; the outbound reference deliberately carries the partner's searchable picker interaction into the customer choice while preserving the customer field treatment. Implementers should use or appropriately extend each owning app's real shared components, rather than copy this prototype's vanilla JavaScript.

### Verification of this version

- **1,416 screen/state/layout checks passed:** all 20 surfaces and 233 declared state combinations at web widths 320, 390, 768 and 1440; native-pattern light/dark at 390 (admin excluded from native); plus each surface's default at 1024 and 1920. Scenarios were reset independently and verified to render the requested screen. Dialog bounds were measured after their opening animation finished.
- **120 role/product cases passed:** both Business and AI Assistant contexts, six role states and ten principal provider surfaces. No unauthorized active mutation controls in the no-access/checking-access cases tested.
- **69 focused interaction assertions passed:** 60 workflow checks plus nine return/export/dialog/studio checks. These include independent filters, searchable/keyboard dropdown behavior, preserved drafts, service-purpose validation, inline knowledge, handout copy/protection, 500-person paging, relevant country explanation, correct campaign identity/history, settings/admin persistence, customer phone/withdrawal, native sheets/long press, return-to-campaign context, named notification destination and record-specific CSV.
- **Six studio-width checks passed**, from 320 to 1920. All mockup JavaScript passed syntax checks. No script errors, missing rendered icons, unenhanced product selects, horizontal page overflow or settled dialog overflow were found in the final matrix.
- Desktop conversation and open picker, campaign people, tablet audience hours, native dark picker/conversation and native light timing screenshots were visually reviewed. The native picker was also checked at 320 × 480.
- All six phase titles, mandatory charter links, owner approval, broader freedom, no-stub rule, one-session rule and successor paths were checked. The former Phase 7 prompt was removed after its complete final-audit scope became Phase 6. No implementation phase is marked complete.

These are **isolated prototype checks**, not claims of production integration, legal compliance certification, complete translation coverage or actual React Native-device testing. The studio still labels synthetic calls/sends/results; production implementations must use real contracts, authoritative state, every locale, VoiceOver/TalkBack and actual devices. The prior 5,000-person verification and other earlier review evidence remain recorded below; this final pass directly exercised the 500-person view again.

The owner's latest consent suggestions are recorded as a mandatory researched design decision in the charter and Phases 1/3. This review does not implement automatic consent, a provider-liability waiver, or a new consent model. It also does not implement the feedback example or any production schema. Necessary future changes use AUT-1, with documented consumers, alternatives, RU/throughput costs and security/legal evidence.

Temporary QA scripts, screenshots and result files were kept outside repositories and removed after their results were recorded. Source repositories were read only; their existing/concurrent modifications were preserved. The deliverables remain in the owner-selected outbound-calls project folder.

## Campaign usability refinement — 2026-10-03

The fourth-pass refinement (3.1, 3 October 2026) puts small information choices inline, removes duplicate root-dialog return buttons, and scales local calling hours through counts plus a searched, filtered and paged inline audience. Timing uses the available width; People and permission review are bounded too. Regional explanations follow actual audience destinations and avoid unrelated country names. Native campaign action bars use the safe bottom edge. These changes and their production acceptance requirements are recorded in [INTERACTION-REVIEW.md](INTERACTION-REVIEW.md) and the master plan/prompts.

**Version 3.1 verification: 81 prototype workflow checks and 930 layout/state checks passed**, across 20 surfaces and 233 declared states, including 36 role cases. The large-audience checks used actual 500/5,000-person synthetic collections with bounded rendered rows; country cases covered domestic, Indian, mixed and unknown destinations. No script errors, horizontal overflow or missing icons were found. Desktop, iPad and native light/dark screenshots were visually reviewed. See the interaction review for the precise verification scope. Temporary QA helpers, result files and screenshots were removed; production repositories were inspected and their unrelated changes left intact.

The third-pass review addresses the owner’s actual dead ends and confusion in campaign creation: contained saved-brief, drafting, permission, information and handout flows; preserved drafts with deliberate save/discard on exit; horizontal Conversation sections; protected handout editing/deletion; actual AI-settings voice/language choices and recordings; explained local calling windows; readable budgets; and review values reflecting the selected settings. Read [INTERACTION-REVIEW.md](INTERACTION-REVIEW.md) for the screen-by-screen acceptance and integration requirements. It supplements this earlier complete-project audit.

**ALL IMPLEMENTATION PHASES MUST BUILD COMPLETE FUNCTIONALITY AND REAL INTEGRATION FOR THEIR ASSIGNED SCOPE. NO STUBS, PLACEHOLDER CONTROLS, UNCONNECTED PAGES, FAKE RESULTS OR TOAST-ONLY SUCCESS MAY SHIP OR BE MARKED COMPLETE.** This requirement is repeated near the top of PLAN, the master prompt, SOLUTION, all six current phase prompts and the Phase 1 handoff. Mockup simulations are not production implementation.

## Owner approval and implementation freedom

**THE OWNER APPROVED THIS MOCKUP AND THE REFINEMENTS IN THIS REVIEW. IT IS A GOOD STARTING POINT AND REFERENCE, NOT A RIGID PIXEL BLUEPRINT.** Approval was given in the current conversation on 2026-10-02: “I'm approving all of it.”

**IMPLEMENTING SESSIONS MAY IMPROVE THIS FEATURE'S UI WITHOUT ANOTHER OWNER APPROVAL AND WITHOUT CREATING ANOTHER MOCKUP FILE.** Preserve the requirements while improving **modern, futuristic appearance; real Clinket branding, colours and Lufga; clear, nontechnical language; easy navigation; direct access to summaries, history and next steps; efficient use of space; complete states; fully responsive desktop, tablet/iPad and mobile web; native mobile strengths; accessibility; and matching web/mobile rendering rules. Critical information must not take five or six pages to reach.** Record improvements and their verification in the phase handoff; that record is not another approval gate. A file-by-file UI plan is documentation, not another permission step. Do not pause for approval of UI layout, wording that preserves its meaning, density, navigation or interaction improvements.

This ruling is recorded in PLAN §0.4/§0.6, the master prompt, SOLUTION, all six current phase prompts and the Phase 1 handoff. It explicitly supersedes earlier UI re-approval, mockup-deferral and location instructions for this programme. The owner-selected home remains `C:\Nik\Data\outbound-calls\Mockup`.

The original ruling concerned UI design. The owner’s later AUT-1 ruling broadens freedom to necessary functionality, architecture, contracts and schema without routine approval, subject to the mandatory implementation charter. It requires simplicity, security, real need, cost/performance discipline and current legal research. No production phase is completed by this review, and no automatic-consent model or liability waiver is adopted here.

## Review basis

The project review includes PLAN, Prompt, SOLUTION, the research report, all six current phase prompts and the Phase 1 handoff. PLAN's owner decisions govern where earlier solution/research proposals differ. The current native app, web rail, dashboard composition, brand assets and permission behavior were inspected to check the reference against the actual product.

Verified source anchors:

| Source | What it established |
|---|---|
| [Web Sidebar.jsx](C:/Nik/clinqetwebpartnerapp/src/components/dashboard/layout/Sidebar.jsx) | Flat menu; product-specific ordering; assistant hides plain Billing; retained Business destinations; pinned account footer and scrolling rail |
| [Web dashboard page.jsx](C:/Nik/clinqetwebpartnerapp/src/app/dashboard/page.jsx) | Different Business and AI Assistant home content; predictable columns; one-mount layout; Call Follow-ups shared by both |
| [brandMarks.js](C:/Nik/clinqetwebpartnerapp/src/lib/brandMarks.js) | Separate current marks/lockups for each product; the old “partner” tile is not the current default mark |
| [Native bottom navigation](C:/Nik/clinqetmobilepartnerapp/src/appNavigation/BottomNavigation-Route.tsx) | Product-specific five-slot tabs, including the existing create button; no extra AI-calls tab; tabs hidden on pushed detail screens |
| [Native FABMenu.tsx](C:/Nik/clinqetmobilepartnerapp/src/components/FABMenu.tsx) | Existing create/quick-action context, currently drawn as an arc; a new AI-calls entry must preserve existing tasks |
| [VoiceAssistantController.cs](C:/Nik/clinqetapi/Clinqet.API/Controllers/Voice/VoiceAssistantController.cs) | A business-scoped transcript endpoint already exists under `voice.transcript.read`; the old PLAN assertion that none exists was corrected |

The dashboard context is representative, not a full redesign or pixel-for-pixel copy of every existing widget. Existing destination previews deliberately stop at the scope boundary. This work changed only the isolated mockup and project documentation. Repository status was inspected; unrelated knowledge-panel and localization changes were present in the source repositories and were left untouched.

## Navigation and placement decisions

**Use one flat “AI calls” rail entry in both web products.** Put it immediately before **Call Follow-ups**, preserving every existing row's relative order. Do not add an expanded campaign submenu to the global rail. The context includes the longer scrollable menu, collapsed rail and pinned profile area.

| Product | Proposed order, including the new entry |
|---|---|
| Clinket Business | Dashboard → Ask Clinket → Calendar → Services → Leads → Insights when available → Inbox → Bookings → Quotes → Invoices → Customers → Team → Billing → **AI calls** → Call Follow-ups → Activity → Refund requests |
| Clinket AI Assistant | Dashboard → Ask Clinket → **AI calls** → Call Follow-ups → AI Assistant → AI Knowledge → Activity → Insights when available → AI Billing → Calendar → Services → Leads → Inbox → Bookings → Quotes → Invoices → Customers → Team → Refund requests |

The mockup shows Insights as an available example; implementation retains the real product's eligibility checks. A product switch changes the dashboard/rail and brand, while the selected business stays the same. Product switching and business switching are separate controls.

Inside AI calls, **AI calls / Campaigns / Calls** provide the primary sections. **Tools** opens Saved briefs, Calling permissions, Customer handouts and Calling settings. Supporting tools do not create more global rail rows. Call Follow-ups retains its existing destination because it includes incoming calls and work beyond campaigns.

On the Business dashboard, a compact AI-call card joins the existing assistant/follow-up area. On the AI Assistant dashboard, outgoing activity joins the phone-focused work column. Both cards expose **Open AI calls, Call one person, Call history and Campaigns** directly. On narrow layouts the AI-call entry moves ahead of secondary metrics, keeping the new task easy to discover. The columns remain predictable; content is reordered without duplicate card instances.

**Native tabs stay product-specific:**

| Native product | Existing slots retained |
|---|---|
| Business | Dashboard · Bookings · Create (+) · Leads · Inbox |
| AI Assistant | Dashboard · Bookings · Create (+) · Call Follow-ups · AI Knowledge |

AI calls is a pushed feature area reached through the dashboard card, the existing create menu or Profile's work tools. Detail pages hide the root tab bar and provide native Back. The create sheet in this mockup is an approved interaction proposal, not a claim that the current FAB already uses a sheet; implementation can retain the existing arc and add the labelled entry if that integrates better under the owner's creative freedom. Preserve existing quick actions either way.

## Short paths to critical information

| Task | Access from a useful starting point |
|---|---|
| See call history | Dashboard **Call history**: one action |
| Read a summary | Any call row: one action; Summary opens first |
| Read a contact's history | Customer list → Contact profile: one action; history already on the page |
| Read answers/transcript/next step | One tab from the call result; summary and next step remain visible in the default view |
| Review requested AI callback | Dashboard shortcut, Calls → Callbacks, or Call Follow-ups → AI callbacks; incoming source summary is directly linked |
| Reply to a team request | Call Follow-ups shows the request and visible Summary / Actions / Done controls |
| Call one person | Dashboard, contact, booking or follow-up action opens the individual-call sheet; review before submitting |
| See a campaign's results | Campaign card → Progress, with Answers and People one tab away |

The call list includes a short result in each row. AI callbacks scheduled for an agreed time are distinguished from work waiting for a human reply. Long press and swipe enhance the visible controls; they are not the only way to reach a task.

## Requirements coverage

| Requirement family | Mockup evidence | Plan / implementation phases |
|---|---|---|
| One engine, three entry paths | Campaign builder; individual-call sheet with no hidden campaign; customer-requested callback review | §1; 1–2, 5 |
| Foundations and eligibility | Setup-needed, minutes, daily limits, assistant hold, time-zone review, invalid/different number, service evidence and permissions | §4–5, §8, §10, §14, §17; 1–2 |
| Five-step campaign | Goal → People → Say & ask → When & limits → Review & test; AI draft reviewed by provider; saved briefs | §7, §18; 3, 5 |
| Audience sources | Pick contacts; all with a phone; booking-date audience, with excluded people/reasons visible | D18, §18; 1, 5 |
| Structured answers | Yes/no, choice, number, date/time, rating 1–5, short text; required/optional; confirmed, unconfirmed, refused and unknown results | §7, §20; 1–3, 5 |
| Existing assistant knowledge | Existing knowledge by default; optional narrowing; no separate private campaign knowledge library | D8, §7; 3, 5 |
| Allowed actions | Booking, reschedule/cancel, approved handout/details, later team reply; outgoing live transfer excluded | D20, §7; 2–3, 5 |
| Hours and retries | Local windows, 3 ordinary tries total, one-day spacing/different time; no automatic early-hang-up retry; one neutral voicemail; callback and pre-conversation failure rules separate | §8–9; 1–2, 5 |
| AI identity and recording | Right-person check before private details; recording notice before recording; live disclosure state and gated result/transcript/player | §7, D15; 2, 5 |
| Honest call outcomes | Completed, partial, declined, stop, wrong person, no answer, voicemail, early hang-up, uncertain connection, invalid number, failure, expired/cancelled | §18, §22; 2, 5, 7 |
| Shared minutes and tests | Example shared allowance/reserve; campaign cap and held minutes; trial active/expired; free own-verified-phone tests with daily limit | §14; 1–2, 5, 7 |
| Permissions | Separate read, manage, call, launch and contact-permission actions; separate media access; checking access does not become denial | §17; 1, 5–6 |
| Number-scoped consent and stops | Person/business/platform provenance; provider can remove only its own block; consent does not defeat a stop; deletion does not clear a number block | §10–11; 1, 3, 6 |
| Consent capture | Permission link and code verification; optional unticked booking consent; Canadian signed paper; Canadian recorded inbound route explained; US written route; India unavailable without operator integration | §10–11; 3, 6 |
| Existing customer booking | Signed-in customer flow; verified-phone rule; optional permission not required to book; customer web/native and public-page booking examples | §18–19; 6 |
| Contacts | Existing CRM list; new profile; international phone/edit preview; outgoing history; changed-number and relationship evidence states | D19, §18; 1–2, 6 |
| Handouts | Upload/check, preview, explicit approval, attach, unavailable/rejected/unapproved and delivery-failure states | D9, §7; 3, 6 |
| Admin | Regional view; daily/concurrent/audience limits; outbound-only zero vs whole-assistant hold; platform block; safety review; India declaration without promotional unlock | §18.3; 1–3, 6 |
| Results and export | People-based progress/denominators; per-question answers and unknowns; selected CSV export; new campaigns show no invented finished results | §20; 1, 5, 7 |
| Notifications and retention | Quiet finish/pause/team-request notifications; recording/transcript expiry, result retention and permission history | §20–21; 3, 5–7 |
| Mobile strengths | Context long press, follow-up swipe, draggable sheets, pull refresh, safe areas, keyboard-friendly forms, optional haptic simulation, direct back navigation and light/dark themes | Prompt §30; 4–7 |

CSV **import**, operator-consent integration for India, live outgoing transfers and personalised/private-document generation remain outside this programme. CSV **export** remains in scope. Existing prices/plan entitlements are not replaced. Native plan information hands off to the **web dashboard**, preserving the current mobile billing boundary.

## Corrections made in this review

1. Replaced the fabricated nested rail and universal mobile tabs with the actual two-product context.
2. Added both dashboard entry previews, product switching, a compact rail and in-area Tools navigation.
3. Removed out-of-scope CSV import controls, handlers and states; added all three approved audience modes.
4. Added individual-call date/time selection and a review that preserves the selected time, language and goal.
5. Added the incoming-call result/callback source and corrected direction/source routing.
6. Made summaries, answers, timestamps, duration and actions match each outcome; removed invented ratings, bookings and deliveries from unrelated examples.
7. Corrected filtered campaign links and block-removal provenance; consent evidence now refers to the correct person and purpose.
8. Separated team replies from AI callbacks; showed visible gesture alternatives; made Done move the correct follow-up to its completed view.
9. Kept a new campaign's answer and people views empty/waiting rather than showing another campaign's finished results.
10. Corrected US relationship-evidence status, admin region selection/platform access and the native billing handoff.
11. Used the current canonical marks for both products, improved narrow-layout reading sizes and notice wrapping, reduced duplicate controls, and brought the mobile AI-call entry forward.
12. Recorded explicit approval and UI freedom everywhere a future phase starts; corrected the stale transcript-endpoint claim and stray India-operator scope wording in PLAN.

## Responsive and accessibility rationale

Desktop uses available width for metrics, results and supporting information. Tablet layouts reduce columns; phone layouts stack cards and turn wide admin tables into cards. The rail scrolls independently; detail screens do not keep an irrelevant native tab bar. Avoid fixing dead space by shrinking text, moving cards unpredictably or duplicating content. Preserve the actual dashboard's fixed-column/one-mount approach during integration.

The narrow-width checks follow the [W3C reflow guidance](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html), including the 320 CSS-pixel layout case. Essential actions have visible button equivalents to gestures, following [W3C pointer-gesture guidance](https://www.w3.org/WAI/WCAG22/Understanding/pointer-gestures.html). Primary touch actions use generous hit areas; minimum targets and spacing must also be verified in production under [W3C target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

Keyboard focus, dialog focus containment, Escape dismissal, labels, status announcements and reduced-motion styles are included. These design/browser checks are not a declaration of complete WCAG conformance or physical-device testing.

## Version 3 verification — 2026-10-03

**56 focused workflow checks passed.** They cover saved-brief cancel/review/apply, drafting input and edited suggestions, nested permission return, information selection, upload/type validation/actual preview/approval, shared-file protection and copies, unlink/delete, voice selection/playback/keyboard/rapid changes/failure, timing and review persistence, invalid-launch prevention, save/discard/reload/storage failure, native sheets/long press/Back, role loss/read-only rendering, individual-call permission return, empty-state continuation and local contact create/edit/duplicate handling. These are isolated prototype checks, not backend integration tests.

| Completed check set | Count | Result |
|---|---|---|
| All declared screen/state layouts | 2,019 | 20 surfaces, 228 screen-state combinations; responsive web at 320/390/768/1024/1440/1920 px; native patterns at 320/390/768 px; admin web only; no page/dialog overflow or missing SVG icons |
| Both products and preview roles | 468 | Narrow web/native, including native dark; Owner/Sales/Dispatcher/Auditor/No access/Loading; no overflow or missing icons |
| Studio Screens/Notes reflow | 12 | File-based studio at six widths; no overflow; frames checked through their own browsing context |
| Audio-error reflow | 6 | Web/native at 320/390/768 px; understandable visible failure state |
| Rendered action inventory | 4,062 appearances | Every rendered action has a handler; this establishes prototype wiring, not production functionality |

No browser script errors occurred in these completed runs. Actual local Gujarati audio loaded and played; rapid sample switching, language changes, step changes and sheet closing stopped the prior sample correctly. All 60 existing local samples are included. Visual inspection covered desktop and phone Conversation, readable Timing & budget, native dark tablet, and native voice sheets on phone/tablet. JavaScript syntax checks passed. Removed all 31 temporary verification scripts, screenshots and result files, and their empty scratch folder. Source repository status was inspected; unrelated knowledge/localization/API-client work was left untouched. The user’s attached screenshots are untouched.

The screen-by-screen interaction review and complete-functionality requirement are in [INTERACTION-REVIEW.md](INTERACTION-REVIEW.md), PLAN, Prompt, SOLUTION, all six current phase prompts and the Phase 1 handoff. Production still requires verified real bindings, authoritative persistence, every-language localization and native-device checks. The approved UI reference and creative freedom remain unchanged.

## Earlier version 2 verification and remaining implementation work

**Earlier version 2 verification: 2,703 prototype checks passed.** This is historical evidence for the prior reference, not the current version 3 result. That run completed on 2026-10-03; owner approval remains dated 2026-10-02. All test data is synthetic. Prototype checks do not replace API integration, real-carrier, real-money or native-device tests.

| Check set | Count | Evidence checked |
|---|---|---|
| Screen/state/layout sweep | 1,938 | 20 surfaces and 219 declared screen-state combinations; web at 320, 390, 768, 1024, 1440 and 1920 px; native patterns at 320, 390 and 768 px; admin web only |
| Interaction/access/navigation checks | 57 | Both flat rails and billing destinations; direct dashboard history/summary paths; actual native tab sets and Back; scheduled one-off review; incoming callback source; outcome-specific answers/actions; consent/block provenance; filtered campaign routing; booking-date audience; empty new results; role/admin gates; keyboard/dialog focus; long press/swipe; local-file studio and product selector |
| Additional matrix, copy and studio checks | 708 | Both products across roles and web/native at narrow width, native dark theme, all five core-copy samples, long names, correct follow-up completion, question/choice persistence, unticked consent and code-verification entry, studio screen/notes/coverage views at six widths |

JavaScript syntax checks passed. Visual inspection included both dashboard contexts, phone entry placement, incoming summary/callback, tablet overview and small-phone dark follow-ups. The studio also opens directly from the filesystem without a server. Temporary verification scripts, results and screenshots were removed after the evidence was recorded; none are production tests or project deliverables.

Phase 4 must reconcile the logical action map with the backend that Phases 1–3 actually build. No build-state findings currently exist in this project directory. Do not fabricate endpoint URLs or backend completion from this prototype. Server-returned translated messages remain authoritative.

The five core-copy review samples exercise width/character variation; most conversational body copy remains English design copy. Production must localise every key into the existing catalogs, preserve the current language-picker eligibility, and verify full French/Hindi/Gujarati copy and dynamic text sizing. The Spanish catalog's existence does not enable the currently hidden Spanish product choice.

React Native implementation must verify VoiceOver/TalkBack, dynamic type, real safe areas, keyboard avoidance, gestures/haptics, portrait/landscape, iPad/tablet, deep-link reachability and foreground/offline behavior on devices. Permission, money, consent, dialing, retry, retention and deletion behaviors must be proved against the actual services, not these local examples. UI improvements remain authorised without a further approval or mockup.
