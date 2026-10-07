# Implementation session state — voice number lifecycle

Working record of the implementation session that started 1 October 2026. It holds the reading checklist, the
evidence re-verified against current code, and the open gates. `IMPLEMENTATION-AUDIT.md` is written at the end;
this file is the resume point if the session is interrupted.

**Status: NO application code has been changed. The design is final (see section 5); coding starts in the next
session from `IMPLEMENTATION-PROMPT.md`.**

## 1. Reading checklist

| Item | State |
|---|---|
| IMPLEMENTATION-PROMPT.md | read in full |
| ORIGINAL-ASK.md, APPROVED-HANDOFF.md, SIMPLE-OVERVIEW.md, PLAN.md, RENEWAL-AUTOMATION.md, CARRIER-RESEARCH.md, EVIDENCE.md, SCHEMA-REVIEW.md, DELIVERY.md, EDGE-CASES.md, NOTIFICATIONS.md, UX-SPEC.md, REVIEW-STATUS.md, HANDOFF-CHECKLIST.md | read in full |
| `Data\mockups\voice-number-lifecycle\index.html` (161 lines, all scenes/states/dialogs in source) | read in full; browser inspection of every state still owed before UI work |
| `Data\mockups\REGISTER.md` (voice rows + tail), `Data\whatsapp\README.md` | read |
| `AGENTS.md` | identical to `CLAUDE.md` except skill-path prefixes (hash compared) |
| Skill `clinqet-voice-assistant` | sections read: number reassignment + admin number management (2026-07-24/24b), §5 provider setup lifecycle, own-number test calls, assign-number reads SQL, state refresh. **Still owed in full before code:** keep-your-own-number (518–925), §13–§18, tenancy phases 7/9 |
| Skill `clinqet-payments` | lines 1–150 read. **Still owed:** remainder (trials, India, phase 9, notifications) |
| Skills still owed in full before touching their area | provider-teams, auth-sessions, main-api, infrastructure, shared-core, cosmos-data, function-app, deployment, notifications, whatsapp, admin-app, partner-app, provider-mobile, ui-common, testing |
| Memory | owner-approval-before-code-changes, build-in-place, approval-covers-only-what-was-shown, two-level-limits-dedicated-alerts, no-feature-flags, dedicated-worktree-only-on-request |

## 2. Code read so far (current tree, 1 Oct 2026)

`VoiceAssistantState.cs`, `Voiceline.cs`, `VoiceAssistantNumberAudit.cs`, `VoiceAssistantSettings.cs`,
`IVoiceNumberProvider.cs`, `NumberCostParsing.cs`, `ProviderAddOn.cs`, `BillingTransaction.cs`, `MinuteLedger.cs`,
`Entitlement.cs`, `VoiceAssistantService.cs` (all 1,600 lines), `VoicelineRepository.cs`, `TelnyxNumberService.cs`,
`PlivoNumberService.cs`, `PlivoSettings.cs`, `VoiceCarrierServiceRegistration.cs`, `CosmosContainerPolicies.SystemData`,
`AdminAlertRepository.cs`, `AdminAlertController.cs` (triage/delete/immutability), `AdminAlert` entity,
`IncludedMinuteRows.cs`, `MinuteLedgerService` carry/rollover, `AiAddOnService` (purchase/trial start, billing
status, provisioning), `SubscriptionBillingService` (trial end, finalize renewal, dunning, downgrade).

## 3. EVIDENCE.md findings re-verified

| Finding | Verified at | Result |
|---|---|---|
| P0 missing/unparseable price becomes 0 | `NumberCostParsing.ParseDecimalToMinor` | Confirmed: null/blank/unparseable ⇒ `0L`; rounds ×100 away from zero |
| P0 general save accepts a changed target in dedicated mode | `VoiceAssistantService.SaveApplicationAsync` lines 153–168 | Confirmed: only Active + ForwardExisting is guarded |
| P0 binding read then later overwrite, ETag retry reapplies the same owner | `ResolveNumberAsync` → `SyncVoicelineFromApplicationAsync` → `UpsertVoicelineWithRetryAsync` | Confirmed |
| P0 purchase has no durable record; ambiguous outcome collapses to failure | `PurchaseSpecificNumberAsync`; both adapters' `SendAsync` return null on any failure | Confirmed. **Worse than recorded:** the purchase POST runs inside the same Polly retry policy as reads (429/500/503 + timeout), so a timed-out order can be re-sent |
| P0 Plivo rates labelled by config currency | `PlivoNumberService.QuoteNumberAsync` uses `_settings.Currency` ("INR") | Confirmed |
| P1 carrier DELETE before the foreign-owner check | `ReleaseNumberAndTombstoneVoicelineAsync` lines 1069–1076 | Confirmed |
| P1 unchanged-number throw makes the repair branch unreachable | `ChangeNumberAsync` lines 1430 vs 1434 | Confirmed |
| P1 trial reminder stamped before send | `ProcessTrialRemindersAsync` | Confirmed |
| P1 downgrade tail only projects allowance | `CompleteAddOnDowngradeAsync` | Confirmed: no number action |
| P1 admin billing-status helper | `GetVoiceAddOnBillingStatusAsync` | Confirmed: Trialing/Active/PastDue ⇒ CanAssignNumber; no add-on ever ⇒ None + CanAssignNumber |

## 4. Facts that shape the schema proposal

- `SystemData` policy: `/*` excluded; indexed today: `/type`, `/status`, `/createdAt`, `/occurredAtUtc`, alert and
  activity fields; composites `(type, createdAt DESC)` and `(type, createdAt DESC, id DESC)` exist. `/businessId`,
  `/dueAt`, `/releaseBy` are NOT indexed. No existing document uses a `dueAt` property. `DefaultTimeToLive = -1`.
- `AdminAlert`: pk = month of `createdAt` (`yyyy-MM`); free-form `metadata` dictionary; `ttl` stamped at create.
  `PatchOperation.Set("/ttl")` is a proven silent no-op, so triage writes can only push expiry LATER (`_ts + ttl`).
  Delete refusal is by alert TYPE (`IsImmutableAuditAlert`). There is one delete route.
- `IVoiceNumberProvider` and `IVoiceAssistantService` are registered ONLY in the API host. The Functions host has
  the Telnyx/Plivo settings sections but no number provider registration.
- No plan tier grants `ai_voice`; `ProviderAddOn` (one reused row per business) is the billing authority.
- **`ProviderAddOn` cannot answer "was there ever a regular AI period".** A paid purchase resets
  `TrialDaysGranted = 0` on the reused row; a cancelled trial and a cancelled paid row look alike. `MinuteLedger`
  does not always record a conversion (same-month conversion with equal minutes writes NO row), and a zero-price
  conversion writes no `BillingTransaction`. (Later corrected: a promo-discounted zero charge DOES write one, so the
  existing transactions answer the question and no SQL column is needed — see section 5.)
- ARM already has `analytics-alerts.json` with scheduled-query rules — the pattern for the independent
  missed-heartbeat monitor.
- 20 timer functions exist; all read the schedule from config (`%Section:TimerSchedule%`).

## 5. Where the design session ended (1 October 2026)

The session became design-only at the owner's instruction; **coding is the next session**. Final documents:
`DECISIONS-2026-10-01.md` (what the owner approved, in his words), `FINAL-DESIGN.md` (the design to build),
`SCHEMA-APPROVAL-REQUEST.md` revision 3 (the only schema allowed), `DESIGN-REVIEW.md` (why, with edge cases),
`IMPLEMENTATION-CARRIER-EVIDENCE.md` (published facts and read-only account evidence),
`CARRIER-SUPPORT-QUESTIONS.md` (for the owner to send), `IMPLEMENTATION-PROMPT.md` (rewritten entry point).

Approved: schema rows 1, 3–9 and the field-level additions (row 2 removed); the four decisions; the Telnyx cost
plan with a buffer of 10; balance alerts; one hourly job. **Pending the owner's yes:** P1 (the 24-hour hold
starts when billing really ends the service) and P2 (four text amendments to the approved mockup).

Corrections made during the session, so nobody repeats them:
- The proposed SQL column was unnecessary: `BillingTransactions` already records every paid AI period, including
  one a promo code discounted to zero. Only a catalogue price of zero leaves no row.
- The documents' "T+24h" assumed the trial ends at its timestamp. Billing runs once a day (04:00 UTC), and the
  entitlement stays live until that run. The hold is therefore measured from the real end.
- Every AI switch-off goes through one method (`DowngradeAddOnAsync` → `CompleteAddOnDowngradeAsync`) and every
  activation through `ApplyActivationTailAsync`: those are the two billing hooks.
- Business closure does not touch the voice number today; the design adds that call and a safety net.

## 5a. UI surface map (read-only sweep, 1 Oct 2026 — verify each path again before editing)

| Surface | Where the work lands | Facts that matter |
|---|---|---|
| Provider web (`clinqetwebpartnerapp`) | `src/components/Profile/voiceAssistant/` — `VoiceAssistantPage.jsx`, `VoiceApplicationForm.jsx` (forwarding field 333–369, read-only, value from `application.forwardingTarget` else profile `formattedPhoneNumber`; "change it" link → Contact Information at 363), `ActivePanel.jsx`, `StatusTimeline.jsx`, `ownNumber/*`; state in `src/context/VoiceAssistantContext.jsx`; client `src/services/voiceAssistantServices.js` + `src/api/url.js:293-318`; flags `src/context/AppConfigContext.jsx` | react-intl, flat `voiceAssistant.*` keys, 5 complete files in `public/lang` (en-US, es-US, fr-CA, gu-IN, hi-IN) guarded by `localeParity.test.js`; dialogs `common/ModalDialog.jsx`, `ownNumber/OwnNumberModal.jsx`; toasts `utils/toastUtil.js`; deep links `utils/notificationNavigation.js:155-166`; refresh `services/providerStateEvents.js`; Jest colocated; lint `eslint .` |
| Provider native (`clinqetmobilepartnerapp`) | `src/Screen/ProfileFlow/VoiceAssistant/` — `index.tsx`, `ApplicationForm.tsx` (forwarding field 376–422), `profilePhone.ts`, `ownNumber/*`; state `src/hooks/useVoiceAssistantState.ts`; client `src/services/voiceAssistantService.ts` + `src/apiManager/constant.tsx` | i18next, nested `VOICE_ASSISTANT.*`, 5 files in `src/Locales` (es authored but not registered — still add keys); sheet `ownNumber/OwnNumberSheet.tsx`; `components/common/ui.tsx` (buttons, Banner, Pill); `Util/haptics.ts`; deep links `Util/notificationNavigation.ts:154-166`; tests in `__tests__/` |
| Admin web (`clinqetwebadmin`) | `src/pages/voice/VoiceAssistantRequestsPage.jsx` (2,338 lines, everything inline, seven hand-rolled overlays), `src/services/voiceAssistantService.js`; alerts `src/pages/alerts/AlertsPage.jsx` (`alertTypes` 34–228, `IMMUTABLE_AUDIT_ALERT_TYPES` 255–262, deep links 264–271) | **Hardcoded English, no i18n library.** Queue is fed by polling alerts of one type. No URL parameters, no alert deep link into the voice page, no SignalR. `components/tenancy/BusinessLookupField.jsx` reused. Parity test `alertTypesParity.test.js` reads a peer repo and skips in CI |
| Admin native (`clinqetmobileadminapp`) | `src/screens/admin/VoiceRequestsScreen.tsx`, `src/components/voice/*` (`BusinessVoicePanel`, `VoiceActionSheet`, `RequestCard`, `VoiceBits`, `BusinessPicker`, `NumberHistory`), calls in `src/services/adminService.ts:1268-1368`; alerts `src/services/alertTypes.ts`, `AlertsScreen.tsx`, `AlertDetailScreen.tsx` | **Hardcoded English, no i18n.** No haptics helper, no SignalR use, no alert deep link to voice; `components/FormKit.tsx` `Sheet`; `components/ui/index.tsx`; alert type list is hand-copied with no parity test; `KnowledgeLimitCard` is stale against the web contract (pre-existing, out of scope) |

Consequences for this programme: both admin apps need new alert types in their lists and undeletable lists, a deep
link from an alert into the voice page/screen (none exists today), and a request queue read from a new endpoint
instead of one alert type. Admin screens follow the existing hardcoded-English convention; provider screens need
every string in all five language files on both apps.

## 6. Repos and working-tree state at session start

All on `master`, none ahead of `origin/master`. Uncommitted work by ANOTHER session (not to be touched):
`clinqetinfrastructure` — `Services/AI/VisionDocumentTranscriptionService.cs`;
`clinqetfuncations` — `Functions/KnowledgeIngestProcessorFunction.cs`, `Services/KnowledgePictureDescriptionBank.cs`.
