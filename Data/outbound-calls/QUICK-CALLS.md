# Call with AI — one person or a small group, without a campaign

Owner-requested extension, 2026-10-04. This is part of the current solution, PLAN §18.7 and coverage row C25. It supersedes the earlier interpretation that the non-campaign form can select only one person. It does not start production development or add a seventh phase.

**MUST READ IN EVERY PHASE. USE ONE SHARED “CALL WITH AI” FLOW FOR ONE PERSON OR A SMALL SELECTED GROUP. CREATE INDEPENDENT INDIVIDUAL CALL REQUESTS THROUGH THE EXISTING CALLING ENGINE. DO NOT CREATE A VISIBLE OR HIDDEN CAMPAIGN, A NEW GROUP LIFECYCLE, OR A SECOND CALLING ENGINE. IMPLEMENT EVERY EXPOSED OPERATION FULLY; NO UI STUBS. THE OWNER-APPROVED MOCKUP AND AUT-1 CREATIVE FREEDOM APPLY, INCLUDING REUSE AND NECESSARY IMPROVEMENTS WITHOUT ROUTINE REAPPROVAL.**

## 1. User outcome and boundaries

From AI Calls, Calls, either product dashboard or Contacts, choose **Call with AI**. Select one person or a small group, enter a shared goal, choose the language and time, review each person's eligibility and effective local time, then request the eligible calls. A campaign name, campaign creation wizard and campaign-management permission are not required.

- The prototype allows **1–10 contacts per submission**. Implement the maximum as a server-delivered, configurable bounded limit; ten is the design default, not a scattered client constant. Check it on the server even when the client was modified. Keep the existing overall business/daily/concurrency/minute/number-frequency limits. A small group is not an exemption from them.
- A contact profile or its long-press menu starts the same form with that person selected; other contacts may be added. A generic entry starts unselected. Search and bounded pages preserve selection. Show the count and a selected-only view; never silently truncate or fetch the whole CRM to paginate locally. Do not auto-select hidden search results.
- Booking entry is deliberately **one fixed customer, service purpose and original booking**. It must not fan one person's private booking context out to other contacts. Reject deleted/cancelled/expired/stale bookings at review and before dialing. A follow-up entry preserves the original person/context; generic group instructions must not leak a source person's details.
- The small-group form uses a shared goal/language and the existing assistant's knowledge, voice, standing instructions and permitted tools. The team-follow-up choice applies to each person. It does not introduce another private knowledge store or recreate the complete campaign builder. Existing business permissions still constrain every tool.
- Campaigns remain the named, managed workflow with campaign reporting, cap and pause/resume controls. Grouping people in one submission does not assign a `CampaignId` or grant campaign launch permission. Requested callbacks and free own-phone tests remain their distinct existing flows.

## 2. Form, review and return behavior

Use the existing branded dropdowns, floating fields, checkboxes, notices, buttons and responsive dialog/sheet patterns. The approved source is `Mockup/quick-calls.js` with `quick-calls.css`, wired through `product.html` and `app.js`. Reuse its interaction/design through the real React/native shared controls in COMPONENTS.md; do not copy synthetic records, global listeners or preview timing as production code.

Desktop can place the bounded people picker beside goal/timing. Phone web and native stack them with readable touch targets, internal scrolling, safe areas and keyboard avoidance. Keep small choices inline. Search, page changes, selection, purpose changes and Back from review must preserve every entered value. The selected-only view makes five or ten choices easy to inspect without scrolling the whole directory.

Review presents **ready versus not requested**, with a reason beside each excluded person; shared instructions; purpose/language; caller ID; follow-up choice; target/hard duration; estimated connected time; requested business time and effective local times. The final button explicitly says how many calls will be requested. Do not report “all scheduled” when any item is excluded, failed or uncertain. Zero eligible people disables submission and offers editing; opening a review creates no call.

Closing via X, Escape, native Back, drag or backdrop protects changed setup. Keep editing retains people/goal/timing; explicit discard creates no requests. Preserve form input on read/save/validation failures. Production navigation must return to the original record/list and preserve filters/scroll where applicable. This is not a requirement for a new durable quick-call-draft table; follow existing form/session persistence patterns and the data-minimization rules.

Booking entry cannot change the person or purpose. Read-only members can read permitted records but cannot submit, retry or cancel. An authorized dispatcher with `outbound.call` can request individual calls without `outbound.manage` or `outbound.campaign.launch`. Recheck authority and business context at every mutation; clear sensitive pending UI state when the workspace/member changes.

## 3. Scheduling: one clear clock, separate local windows

**“Schedule for later” uses the business's explicitly labelled IANA time zone. It is one requested starting instant, not the same wall-clock time independently repeated in every destination.** The prototype business uses Toronto; production must read the actual business zone. Display the converted time for each person during review. For example, 11 am Toronto can be 8 am Vancouver; if Vancouver's permitted window starts at 9 am, show that adjusted time before submission.

- “Next permitted time” uses server time and authoritative eligibility/window calculations. It does not promise everyone will be called simultaneously. Queue capacity, incoming-call protection and concurrency limits still apply.
- Use the same rule engine as campaigns for country/purpose limits, current business calling schedule, optional business opening-hours narrowing, phone/address time-zone evidence and daylight-saving changes. A different campaign's unsaved narrower schedule must not affect these calls.
- Unknown location, invalid/disallowed numbers, missing permission/evidence or an active block prevents that person from being submitted. A known local time is not permission. Surface the exact reason; changing the schedule cannot bypass it.
- Reject past, nonexistent and ambiguous daylight-saving wall times with a clear correction. Never silently pick an offset. A future improvement may offer an explicit offset choice under AUT-1 if simpler for the user.
- Store the requested instant/time-zone basis and immutable original contact/number context using the necessary existing request fields or justified additions. The read response must distinguish requested time, effective next attempt, expiry and the reason for delay; do not calculate legal eligibility in the client.
- Ordinary expiry is within seven days of the requested start, limited by any earlier brief/booking deadline. Do not schedule into a window beyond expiry. Retry spacing, hang-up behavior, voicemail and per-number weekly limits stay as PLAN §8 defines.
- Final eligibility is checked again immediately before dialing. A request accepted today can later become blocked, cancelled or expired. Display its authoritative state/reason and preserve history; no automatic consent grant or silent number replacement.

## 4. Request model, APIs and data quality

Reuse the planned `RecipientCall` with kind `OneOff`, a null campaign relationship, original destination snapshot and frozen brief version. One submission may reuse one immutable brief version for its eligible people; each person has an independent request, attempts, results, cancellation and usage. Do not create a durable “batch campaign”, batch analytics system, queue or container merely to support a checkbox list.

Phase 1 chooses the smallest correct contract against current code: a bounded multi-item request over the existing individual-request service, or bounded per-item calls orchestrated by the client. Either must satisfy the same requirements below. Document the actual routes/DTOs only after reading implementation; this document invents no endpoint names. Prefer one bounded review and submission response when it removes unnecessary client round trips without introducing a new group model.

1. Authorize every business/contact/booking/brief reference. Normalize E.164 on the server, reject invalid destinations, deduplicate within the selection by business + normalized number, and return a visible duplicate result instead of calling a number twice.
2. Perform per-number purpose/evidence, suppression, destination, time-zone, frequency, allowance and current-record checks. Missing data is unknown, never implicit consent or success. Deduplication does not merge consent from different contacts/businesses.
3. Supply review results with a stable item identity, original number, eligibility/reason, requested/effective times and the current version needed for safe submission. If a number, purpose, proof or effective time materially changes, require an updated review; do not silently call a substituted number or larger recipient set.
4. Use a stable submission identity and **per-person idempotency identity** for transport retries, double clicks and concurrent requests. Validate a repeated key against its original immutable payload; a changed payload must not reuse it. The existing business/idempotency constraint must be enforced by the real store. Keep successful recipient IDs when another item fails.
5. Return per-person results: accepted with an actual request ID; definitively not saved with reason; or unresolved acceptance that requires status lookup. A generic network error is not evidence that nothing was saved. Never create new IDs or resubmit the entire selection to recover a lost response.
6. Provide an authorized way to recover by original item identity after timeout/reload/app backgrounding. Persist only the minimum recovery identifiers needed using existing secure, business/member-scoped patterns; avoid duplicating sensitive form data or creating a new store for a UI convenience. A status lookup must not itself create or dial anything.
7. Retry only definitively unsuccessful items with their original identities and current validation. Do not resend accepted, cancelled, completed or unresolved items. Existing pending individual requests for the same number must be surfaced/reviewed, not silently duplicated by a second click or new form. The common per-number dispatch guards still prevent concurrent dialing across campaigns, individual calls and callbacks.
8. Keep **request-save uncertainty** distinct from **carrier-call uncertainty**. The former asks whether the individual request exists; the latter asks whether a dispatched call connected. Neither permits blind recreation or redial. Existing supervisor/reconciliation paths resolve the latter.
9. All Cosmos access remains partition-scoped; SQL controls uniqueness/claims as planned. Add fields/indexes only with real readers/writers in the consuming phase, justified under the charter's current-need/cost/data-quality rules. No schema code is created by this design update.

## 5. Execution, results and cancellation

Use the same scheduler, final checks, capacity/fairness, outbox, carrier routing, detection, AI/tool restrictions, retry policy, usage ledger, summary extraction and retention as a single individual call. Do not implement a loop that immediately dials ten people outside the engine. A larger selection does not increase priority or reserve all remaining minutes in advance; existing individual-call fairness and atomic per-attempt holds apply.

Show a submission receipt with per-person accepted, excluded, failed and checking results. Accepted requests appear in **Calls → Individual call requests**, searchable and bounded, and in their contact's history with the actual request/attempt IDs. A transport failure must not erase an already accepted call. Use the existing call result/media/summary/answers/history surfaces for actual completed attempts; retain role and retention checks. The prototype's completed-result example is synthetic, not a successful real integration.

Cancellation is per person, with a confirmation naming that person. Cancel future attempts of that request only; retain its original number, brief, history and previous attempts. Recheck state atomically: if dialing/conversation already started, return the actual state rather than falsely saying a waiting request was cancelled. An explicit, separately authorized polite-ending action follows the existing live-call rules. Never stop other selected people or erase already billed usage.

No campaign result/notification is created for the submission. Existing restrained follow-up/operational notification rules apply to individual outcomes. Do not send a push for every selected call. Existing analytics may distinguish the entry source and selected count where useful, without recording contact names/numbers/goal text or inventing a permanent group entity. Apply current retention/closure behavior to each request, brief and attempt.

## 6. Phase ownership — no new phase

| Phase | Required work and evidence |
|---|---|
| 1 · Foundations | Implement current bounded review/create/status-read/cancel contracts over individual requests, per-item identity/replay/concurrency semantics, number/purpose/time validation and appropriate read permissions. Define settings/maximum, consistent error codes and times; freeze the brief/original numbers. Prove real-store idempotency and cancellation races; justify only necessary schema. |
| 2 · Calling engine | Consume each accepted individual request through the existing scheduler/claim/outbox/carrier/AI/ledger paths. Verify group size cannot bypass fairness, frequency, business limits, concurrent-call protection or incoming reserve. Recheck booking, consent, time zone and number at dial; recover uncertain carrier results without another attempt. |
| 3 · Consent, handouts and operations | Apply the same per-number evidence, withdrawal, suppression, permitted sending and retention rules to these calls. Keep existing operational alerts/notifications restrained; no group consent, separate handout store or new group lifecycle. Test withdrawal while a selected request is waiting. |
| 4 · Provider UI and contracts | Integrate the shared one-or-small-group form, review, receipt, request list/status recovery, per-person result/cancel and dirty/return behavior on provider web and native together. Generic entry points and contact/booking/follow-up context must work. Prove partial/unknown acceptance with actual APIs, not toast-only simulation. |
| 5 · Remaining provider/admin/customer UI | Reuse Phase 4's component in the standalone Contacts/profile/long-press entries; preserve the selected person(s), role and source. Keep admin, permission and customer changes reflected in every queued individual request. No second composer or campaign shortcut masquerading as a non-campaign call. |
| 6 · Final audit | Recheck all Q01–Q16 scenarios below against real implementation and C25 in both directions. Verify no hidden campaign, silent duplicate, lost accepted item, unauthorized contact, wrong-number retargeting or fake success; verify real native and responsive behavior. No next-phase handoff. |

Every Phase 1–5 completion must carry verified C25/Q-scenario progress and remaining owning-phase work into its build state and **next-session copy-paste prompt without waiting for a reminder**. Earlier phases need not build later UI prematurely; they must supply and verify their real contracts. All existing owner approval, reuse, creative freedom, localization, no-stub and current-code-reading instructions remain mandatory.

## 7. Acceptance matrix

| ID | Required outcome |
|---|---|
| Q01 | One, five and ten people use the same form; no visible/hidden campaign created; above-limit requests rejected server-side. |
| Q02 | Search, paging, selected-only and Back preserve selection, goal, language, timing and follow-up; zero selection and no-match states clear; no hidden auto-selection. |
| Q03 | Current branded controls, keyboard/focus, phone/tablet/desktop reflow, dark/native patterns, long press plus visible alternative, safe-area/keyboard handling and unsaved-close protection. |
| Q04 | Read-only/dispatcher/manage/launch permissions are separate; revoked permission, foreign business/contact, workspace switch and stale async response cannot submit or leak another record. |
| Q05 | Mixed eligible/blocked/expired/unknown-time/invalid/India/service-proof cases show exact exclusions; zero eligible cannot submit; no implied permission. |
| Q06 | One requested business-zone instant converts correctly per person, narrows to permitted hours, honors Sunday/DST/expiry and booking deadlines; ambiguous/past wall times rejected. |
| Q07 | Duplicate numbers in one selection create one request at most; existing pending submissions are recovered/reviewed, not duplicated; number changes require fresh review. |
| Q08 | Per-item replay, double-click, concurrent submission, lost response, reload and mobile backgrounding retain accepted identities; real-store constraint tests. |
| Q09 | Partial success retains accepted people; only known unsuccessful items retry; unknown acceptance offers status lookup and never blind replay/new IDs. |
| Q10 | Identical engine guards at dial: withdrawn consent, deletion, edited number, stale booking, exhausted minutes, daily/frequency limits and admin holds cannot be bypassed. |
| Q11 | Request/attempt/result IDs, original number, brief version, local times, statuses, summaries and history agree across Calls and Contacts; no other selected person's content leaks. |
| Q12 | Cancel one waiting request without affecting others; repeated cancel is safe; cancel-versus-claim race returns truthful state; active-ending authority distinct. |
| Q13 | Shared ledger meters each answered attempt once; unanswered/free-test rules unchanged; no campaign cap or campaign analytics falsely applied. |
| Q14 | Booking entry cannot change person/purpose or share private booking data with a group; a follow-up's context is preserved safely. |
| Q15 | Loading/offline/retry/permission/conflict/limit/completed/cancelled states work with authoritative results; no fake all-success receipt or call on navigation. |
| Q16 | Each phase records real evidence, updates both directions of coverage and supplies the next handoff; mockup-source reuse excludes synthetic data, preview clock and global event wiring. |

## 8. Open the reference

Open `C:\Nik\Data\outbound-calls\Mockup\index.html`, choose **Calls & callbacks**, then any state labelled **Call with AI**. Or open:

`file:///C:/Nik/Data/outbound-calls/Mockup/product.html?screen=calls&state=quick-group&mode=web&product=business`

Use `mode=app&theme=dark` for the native dark reference. The Contacts button and existing contact/booking/follow-up entry points use the same composer. No server/install/build is needed. The prototype clock and all request/delivery/call records are examples; the actual server clock and real contracts are implementation obligations. REVIEW.md records the checks actually performed and their limits.
