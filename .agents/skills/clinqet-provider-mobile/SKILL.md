---
name: clinqet-provider-mobile
description: |
  **FRONTEND SKILL** — Work on the Clinqet provider/partner MOBILE app (React Native, clinqetmobilepartnerapp; scheme clinketpartner://). USE FOR: provider mobile screens, navigation, theme/tokens, i18n, the AppConfig consumer, the info-only Plan & Billing / AI surface (Payments Phase 4), and the app's analytics instrumentation (full provider-web parity since analytics-recs Phase A5). Distinct from clinqet-partner-app (the Next.js WEB app) and clinqetmobileuserapp (the customer mobile app). Applies to files in clinqetmobilepartnerapp/.
---

# Clinqet Provider Mobile (RN) — skill

## RECENT CHANGES — 2026-10-06 (taking over a prepared account, and "No price yet")

See the `clinqet-prepared-providers` skill for the whole feature. What changed HERE:

- **"No price yet" is the fourth price pill** (`ON_REQUEST = "onrequest"`), with the nudge, no amount asked for, and the visit/travel/minimum sections hidden and not sent. Bulk upload offers it too.
- **`normalizePriceType` maps all four spellings of "on request"** — one that fell through highlighted no pill and then posted back a type the provider never chose.
- **The services list shows "Price on request"** and an **"Add a price"** pill on the row.
- ‼️ **§4.3 row 11: a phone-only account is SIGNED IN by its forgot-password code.** `PhoneOnlySignedIn` says so; without it the provider landed on "Create new password" with nothing to submit, because the server had already opened the account and sent no reset grant.
- **The code screen says which way the code came** — it said "to Phone" for an emailed code.
- **Resend confirms it worked**, and `resendPhoneSignInCode` returns NO message when there is no number: `'NoPhoneToResendTo'` passed the displayable-message check and the provider read that token in the error box.
- **`resendPhoneSignInCode` must not call `startIdentityFlow()`** — a resend is the same stamp, not a new sign-in.
- **The AI-setup summary no longer claims price-less services "won't appear in search results"** — they do, as "Price on request".

## 2026-09-30 Sessions (auth-session audit) — server rules in `clinqet-auth-sessions`, parity with customer mobile

- **One keychain record** (`com.clinqet.partner.session`, staging slot `…session.next`, `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`):
  access + refresh token, expiries, the server's `rememberMe` and `sessionExpiresAt`, the pending refresh secret, the
  issuing Identity origin, a generation. Written staging-first (that write is the commit), read by highest generation.
  Reads are absent / unavailable / value. ‼️ One keychain rule in all three mobile apps: iOS `-26275` (errSecDecode)
  and Android `E_CRYPTO_FAILED` without "Could not access Keystore" are permanent (the item is reset); everything else
  (`E_KEYSTORE_ACCESS_ERROR`, a locked keychain `-25308`, any other error) is unavailable and never signs out.
  `data_extraction_rules.xml` keeps keychain prefs out of backups and device transfer. All access goes through
  `tokenManager`; the legacy two-item layout is migrated once.
- **First launch** (no `clinket_install_marker` and no `introScreen`/`keepMeSignedIn` trace): any keychain session is
  retired and its server logout queued; runs before every keychain task; a save this install made sets the marker.
- **Cold start** (`src/lib/launchRoute.ts`): waits for the foreground when launched in the background, retries a locked
  keychain 3× (1/2/3 s); `rememberMe === false` ends the session quietly; offline/5xx routes into the app — only a
  server-ended session purges the account; pending sign-outs are retried after the session read.
- **Refresh + replay** (`apiManager`, `refreshToken.tsx`, `sessionIdentity.ts`): epoch captured at dispatch, one serialized
  write queue; a 401 is replayed only under identical sub + SessionId + BusinessId (else 409 to the caller); `session_ended`
  signs out only for the stored SessionId; `recent_sign_in_required` pushes LoginWithEmail on top and returns
  (`reauthentication.ts`); a refresh 401 discards only the still-stored credential; 4xx other than 401/429 drops the
  pending secret. ‼️ No screen refreshes on 401 itself — `screensLeaveSessionToClient` guards it (with a floor).
- ‼️ **Stamp routing** (`src/services/stampRouting.ts`, `regionService.ts`): while a session is stored, every call carrying
  it (REST, refresh, SignalR hub, AI/Ask streams, device de-registration, pending logouts) goes to `identity-<stamp>` /
  `api-<stamp>` of the ORIGIN THE ISSUING REQUEST REACHED (`rememberIssuingOrigin`/`issuingOriginOf`, per request, never
  the region at save time); session-less Identity steps go to `identity-<active region>`; external sign-in starts and
  exchanges on one stamp; legacy/shared-origin sessions keep the shared hosts; SAS URLs and foreign apexes never rewritten.
- **Sign-out** (`signOutService.ts`): captures credentials, writes a keychain pending-logout (≤5 entries, 30 days),
  clears the device, posts `logout {refreshToken}` with no bearer (5 s); only a 200 removes the entry; retried at launch,
  activation, network regain (single flight). Push clean-up fires unawaited (5 s bound); "sign out everywhere" relies on
  the server retiring devices. Survives sign-out: `x-device-id`, `language`, `clinket_consent`, `introScreen`,
  `clinket_active_region`, theme, `passkey_local` as `{credentialId}` only. Wiped: account caches, the
  bell list, `lastSeenNotificationAt`, the invitation token (unless its screen is mounted), `businessAccess:*`.
- Security changes: a committed change whose new pair cannot be stored shows `SECURITY_CHANGE.SAVED_SIGN_IN_AGAIN`.
  Registration phone claim: second code field when `requiresPhoneCode`, `phoneHint` line, `phoneCode` sent.
- ‼️ Audit round 2 (2026-09-30): a security change (password, email, phone, MFA) runs through `beginSecurityChange()`
  (`lib/securityChange.ts` + `services/sessionEndHold.ts`): a `session_ended` for the old session is HELD until the change
  settles — a new pair is adopted and the held ending dropped; a 401 "change saved" signs out with that sentence. A
  `session_ended` with nothing stored does nothing. `confirmServerSignOut` → `'confirmed'|'retrying'|'unconfirmed'`
  (`SIGN_OUT.UNCONFIRMED_NOTICE`). `startIdentityFlow()` pins the stamp at the first step of every sign-in flow.
  Retry-After is capped at 30 s (`retryDelayMs`). Signing out while the record is unreadable keeps it unusable behind
  the signed-out marker and queues its server sign-out once readable. Sign-out also clears `profileNeedsRefresh` and the
  `knowledgeDraftBulkRun:`, `knowledgeDraftApprovalSettings:`, `clinket_va_promo_personalization_` prefixes.
  `screensLeaveSessionToClient` also catches `forceLogout`/`removeData`/`clearAuthTokens`/raw bearer `fetch` in UI files.
- ‼️ Audit round 3 (2026-09-30):
  - **Starting a change:** a security change starts with `beginSecurityChange(changeUrl)`.
    - While it is in flight, another request refused with `session_ended` for its session gets 409 "changed"
      (`API_ERRORS.SESSION_CHANGED`) and is never resent.
    - The change's own answer, matched by its URL even after a replay, reaches its caller unchanged.
  - **The hold ends on its own after 60 s** (`SECURITY_CHANGE_HOLD_MS`), because Android's fetch never times out; an ending
    held until then is carried out.
  - **Only the session the change was sent on is ever signed out** (same SessionId, or the same epoch when none). After a
    sign-out or a new sign-in, the returned pair is only revoked.
  - **Dispatch epoch:** the API client reads the session epoch before the bearer. For a request sent before a sign-out or
    sign-in, any of these answers 409 and never signs out, refreshes or resends:
    - a 401 (plain, `session_context_changed` or `session_ended`);
    - a pre-flight or refresh that finds nothing stored.

    A refresh refused for the credential still stored still signs out.
  - **Passkey registration:** when signed in, the challenge and the passkey lookup are sent without a bearer to the
    session's stamp (`postWithoutHeaderUrl(..., { forSession: true })`), the same stamp as the register call, because the
    challenge lives in that stamp's SQL. Passkey sign-in stays on the flow's pinned stamp.
  - **Unreadable record:** a sign-out while the record cannot be read shows `SIGN_OUT.PENDING_NOTICE`. Its server sign-out
    is queued at the next launch, or before a new sign-in overwrites the record. A record still unreadable at that sign-in
    cannot be queued (known limit) and never blocks the sign-in.
  - **Network retry:** the retry of pending sign-outs on network regain waits for NetInfo to prove the connection
    (`isInternetReachable` null is ignored).
    - ‼️ NetInfo is configured once in `index.js` (`src/config/reachability.ts`, 2026-09-30): iOS reachability is a
      HEAD to our shared API `/ping` (200 = reachable), re-checked every 5 min while reachable and every 30 s while not,
      only while the app is active, and again on every return to the foreground — never a Google endpoint. Known limit:
      the Telnyx voice SDK bundles its own NetInfo copy with the default probe while a call client exists.
  - **Keychain:** the rule is unchanged in all three apps. It cannot tell a transient Android Keystore fault that is worded
    like a lost key ("Could not decrypt data with alias", other "Wrapped error: …") from a real one, so those items reset.
    "Wrapped error: Could not access Keystore" is transient.
- Tests: `tokenManager`, `refreshToken`, `launchRoute`, `reauthentication`, `stampRouting`, `stampRoutingTransports`
  (L9 flows, F6), `securityChangeRace`, `apiManager` (dispatch epoch), `logout`, `authProvider`, `socialLoginCodeExchange`,
  `editProfileMfa`, `passkeyCredentialBinding`, `registrationPhoneCode`, `sessionBoundProviders`, `askServiceNamesSweep`,
  `screensLeaveSessionToClient`.

## 2026-09-29 Booking decisions — Decline sheet, one-tap cancel reason, delete Drafts only (mirrors web's rules)
Authority `C:\Nik\Data\search-topology\findings\PROGRAMME-BUILD-STATE.md` D5 · D7 · D13, `SCORING-REAUDIT-2026-09-28.md` N1.
Files under `src/Screen/ProfileFlow/Booking/` unless named.
- **`src/lib/bookingActionPolicy.ts`** mirrors web's `utils/bookingActionPolicy.js`: `canDeclineBooking` ⇔ `AwaitingProviderConfirmation`;
  `canCancelBooking` = not Draft, not `AwaitingProviderConfirmation`, not terminal; **`canDeleteBooking` ⇔ `Draft` only (D5)**;
  `needsProviderCancelReason` ⇔ `confirmedByProvider === true`; `PROVIDER_CANCEL_REASONS` (`reason` / `choiceKey`
  `MY_BOOKINGS_SCREEN.CANCEL_REASON_*` / `recordKey` `BOOKING_DETAILS.CANCEL_REASON_*`); `providerCancelReasonsFor(createdBy)` drops
  `EnteredByMistake` unless `createdBy` is `business` (case-insensitive — the server refuses it); `providerCancelReasonRecordKey`;
  `BOOKING_REASON_MAX_LENGTH` = 500; type `ProviderCancelReason`. ‼️ Web's `providerCancelReasonsFor` takes the booking, mobile's takes `createdBy`.
- **`BookingSheet.tsx`** — shared bottom sheet (`Modal` slide + `ModalBlurBackdrop`; backdrop and back gesture ignored while `busy`)
  and `createBookingSheetContentStyles`.
- **‼️ Reject = DECLINE (N1) — `DeclineRequestSheet.tsx`.** Opened from the card approval row and a new popover item
  (`MY_DASHBOARD.REJECT`, gated `canDeclineBooking`; `openDeclineSheet` prop from `booking.tsx`), the `AwaitingProviderConfirmation`
  footer in `bookingDetails.tsx`, and `homeTab/MyDashboardScreen/WorkQueue.tsx`. All used to open `actionStatusModal` with `"Cancelled"`.
  `rejectBooking(bookingId, rejectionReason = "")` (`bookingAPI.tsx`) sends `rejectionReason` only when non-blank — the canned
  `DASHBOARD_EXTRA.REJECTED_BY_PROVIDER` is gone. `readApiResult`-guarded, a ref blocks double taps, the sheet stays open on refusal with
  the server's message; success toast `MY_DASHBOARD.DECLINE_SUCCESS`. **D13 line** `MY_BOOKINGS_SCREEN.DECLINE_NOT_TAKING`: Pause my listing →
  `navigateToScreen(navigation, navigations.EDITBUSINESSDETAILS, { focus: 'listing' })`, Update my hours → `navigations.SETAVAILABILITY`;
  each closes the sheet first. `WorkQueue` now takes a `navigation` prop (passed by `MyDashboardScreen/index.tsx`).
- **`focus: 'listing'`** — on `EditBusinessDetails` in `MyDashboardStackParamList` and `AboutBusinessStackParamList`
  (`src/appNavigation/types.ts`). `completeProfileFlow/BusinessDetails/index.tsx` wraps `ListingCards` in `testID="business-details-listing"`,
  waits for its `onLayout` (the cards render only once the profile has loaded, and only in `entryContext === 'profile'`), scrolls to it
  minus `LISTING_FOCUS_TOP_GAP`, then clears the param with `setParams({ focus: undefined })`.
- **Cancel.** `actionStatusModal.tsx` returns **`CancelReasonSheet.tsx`** for `"Cancelled"` when `needsProviderCancelReason(booking)`:
  optional note (`CANCEL_NOTE_LABEL`, 500 cap) + one button per reason; **the tap IS the cancel** —
  `handleChangeStatus(id, 'Cancelled', note, '', reason)` sends `providerCancelReason` (+ `cancellationReason` = the note when non-empty);
  toast `MY_BOOKINGS_SCREEN.STATUS_CANCELLED_SUCCESS`. A booking the provider never agreed to keeps the modal's required free-text reason.
  The card's Cancel item is gated `canCancelBooking`, Delete `canDeleteBooking`; the detail Draft footer is Delete + Confirm.
- **Detail Cancelled card** shows `t(recordKey)` (bold, `testID="booking-cancel-reason"`), then the note — or `NO_REASON_PROVIDED` when
  there is no reason code.
- Decline analytics: `reject_init` / `reject` / `reject_fail` (web's `Rejected→reject` verb) on `booking_list`, `booking_detail`,
  `dashboard_home.work_queue`.
- Locales (all five): added `MY_BOOKINGS_SCREEN.DECLINE_BODY` / `DECLINE_NOT_TAKING` / `DECLINE_PAUSE_LISTING` / `DECLINE_UPDATE_HOURS` /
  `CANCEL_REASON_*` / `CANCEL_NOTE_LABEL` / `CANCEL_KEEP_BOOKING` and `BOOKING_DETAILS.CANCEL_REASON_*`; removed
  `MY_BOOKINGS_SCREEN.DECLINE_REASON_PLACEHOLDER`, `MY_DASHBOARD.REJECT_BOOKING_TITLE/MSG/BTN`, `MY_DASHBOARD.BOOKING_REJECTED`,
  `MY_DASHBOARD.NO_KEEP_IT`, `DASHBOARD_EXTRA.REJECTED_BY_PROVIDER`. en `MY_DASHBOARD.REJECT` / `BOOKING_DETAILS.REJECT` now read "Decline".
- **Hold-released note (web's `providerPay.cancelNote` rule).** `cancelReleasesPaymentHold(booking)` (`bookingActionPolicy.ts`) ⇔
  `payment.status` is `Authorized` or `Vaulted`; then BOTH cancel paths — `CancelReasonSheet.tsx` and the free-text branch of
  `actionStatusModal.tsx` — show `MY_BOOKINGS_SCREEN.CANCEL_HOLD_RELEASED` (`testID="cancel-hold-released"`; all five locales).
- Tests: `__tests__/bookingDecisionSheets.test.tsx` (incl. the hold note), `bookingDeclineEntryPoints.test.tsx` (the list card's and
  the detail's Decline open the decline sheet and PATCH `Rejected`, never `Cancelled`; typed message → `rejectionReason`),
  `bookingActionPolicy.test.ts`, `dashboardBookingActionToastParity.test.tsx`, `businessDetailsProfileSave.test.tsx`.

## 2026-10-02/03 AI Knowledge reading accuracy (mirrors web's rules) — BUILT, not deployed
Authority `C:\Nik\Data\knowledge-reading-accuracy\BUILD-STATE.md`. Files under `src/Screen/ProfileFlow/Knowledge/` unless named.
- **Report wrong answers** (approved sheet `knowledge-wrong-answers-report`, wording W1): `ReportWrongAnswers.tsx` — a line on
  the list row (`index.tsx`, variant `line`) and a button on `KnowledgeDocumentScreen.tsx`. Shown only by
  `canReportWrongAnswers(doc, busy)` (a File, Ready, not stopped, not busy); does nothing offline. One tap →
  `reportKnowledgeWrongAnswers` (`src/services/knowledgeService.ts`, `KnowledgeReportWrongAnswersAPI`, body `{ source: 'Mobile' }`)
  → "Reported. We'll check this file." A refusal shows the server's sentence. Nothing is stored; the file can be reported again.
  Keys `KNOWLEDGE.REPORT_*` ×5. Test `__tests__/knowledgeReportWrongAnswers.test.tsx`.
- **Picture delete** confirms inside the viewer's own native window (back cancels the confirm; errors shown inside).
- **Access sentences** follow the file's real access: `src/lib/knowledge/receptionistAccess.ts` (`receptionistReachesCallers`,
  `pictureSendBlock`).
- The notice ✕ and "Read again" are absent without `voice.settings.manage`.
- **AI setup summary** `src/components/SetupReadingNotices.tsx` (used by `AIAssistantModal.tsx`; sheet `ai-setup-reading-honesty`):
  same notices and `MAX_VISIBLE_SUMMARY_NAMES` (8) as web; keys `AI_ASSISTANT_MODAL.SUMMARY_*` ×5. Test
  `__tests__/setupReadingNotices.test.tsx`.

## 2026-09-25 AI Knowledge + Ask Clinket — Phase 4 closing audit (mirrors web's rules)
Authority `C:\Nik\Data\knowledge-extraction-fix-plan\phase-4\FINAL-AUDIT.md`. Files under `src/Screen/ProfileFlow/Knowledge/` unless named.
- **Accepted files = the server's list (P4-F-05).** `src/Util/mediaLimits.ts` `knowledgeDocuments.allowedExtensions` holds `.csv`,
  `.tiff` AND `.tif`; `index.tsx` `CONVERT_HINTS` holds only `.tsv`/`.xls` → excel and `.doc` → word (`.csv` is read as a table);
  `src/Util/knowledgePreflight.ts` counts `.csv` as text-like; `KNOWLEDGE.UPLOAD_HINT` names CSV (×5). Guard
  `__tests__/knowledgeImagesParity.test.ts` "every extension the server accepts is accepted on the phone".
- (2026-10-02: the moving bar is REMOVED — `ReadingTrack` is gone; `ReadingMotion.tsx` keeps `ReadingSpinner` and `READING_PACE`.)
- **The reading-motion bar (P4-F-06, sheet `knowledge-document-row-truth` A3/A4).** New `ReadingMotion.tsx`: `ReadingTrack` under a
  row and `ReadingSpinner` beside it while `readingInFlight(doc)` (`knowledgeRowMeta.ts`: Processing and not stopped) and the
  poll is not exhausted; TakingLonger slows both and turns them amber (`READING_PACE` normal 1000/1500 ms, slow 2600/3400 ms).
  `Animated` with `useNativeDriver`; nothing moves under reduce-motion (`AccessibilityInfo.isReduceMotionEnabled` +
  `reduceMotionChanged` listener). Test `__tests__/knowledgeReadingMotion.test.tsx`.
- **Upload refusals keep the server's sentence (P4-F-02).** New `knowledgeUploadRefusal.ts`: `slotIsUsable` / `slotRefusal` /
  `uploadRefusalText` — a slot refusal keeps its sentence, a confirm refusal is no longer swallowed, and `PickedFile.failureText`
  shows it on the row and in the replace toast. Test `__tests__/knowledgeUploadRefusal.test.ts`.
- **Run again names the loss (P4-D-05).** `tallyWaitingSuggestions` / `rerunWaitingMessage` (`knowledgeRowMeta.ts`) fetched when the
  ask opens (`knowledgeService.ts` query takes `pageSize`); `KNOWLEDGE.DRAFTS_RERUN_WAITING[_EDITED]_one/_other` (×5). Read again
  sentences rewritten to the truth. Test `__tests__/knowledgeRereadConfirm.test.tsx`.
- **Draft placement is the card's own until touched (P4-F-03/04).** `KnowledgeDraftEditSheet.tsx` seeds from
  `resolveApprovalSettingsFor(draft, panel)` and sends `place: null` + `draftOwnAreaChoice(draft)` unless the provider touched the
  controls; a single approve ask names the card's resolved placement, the mass asks append
  `KNOWLEDGE.DRAFTS_CONFIRM_OWN_PLACEMENT_KEPT` (×5). Tests `__tests__/knowledgeDraftEditPlacement.test.tsx`,
  `__tests__/knowledgeDraftPlacementTruth.test.tsx`.
- **Tax on drafts (P4-D-11 UI).** `draftTaxStatement` (`knowledgeDraftMeta.ts`) → included / added on top with the rate to one
  decimal; chip `KNOWLEDGE.DRAFTS_CHIP_TAX_INCLUDED[_RATE]` / `_EXTRA[_RATE]`, sheet `KNOWLEDGE.DRAFTS_EDIT_TAX_*` + `_FROM_FILE` (×5).
- Receptionist access: sending off ⇒ `AnswersOnly` (`__tests__/knowledgeReceptionistAccess.test.ts`).
- **Ask Clinket source cards (P4-F-01).** `src/lib/businessSearch/askRules.ts` `groupSources` keys a document by AI-written channel
  (`doc:{docId}` / `doc:{docId}:{channel}`, `group.channel`) — the twin of web. Test `__tests__/businessSearchSourceWhoseWords.test.tsx`.
- ‼️ **Not yet aligned (other owner):** `src/components/AIAssistantModal.tsx` (AI setup upload) lists `.tiff` without `.tif`.

## 2026-09-15 Keep your own number (mirrors provider web, same session)

`Screen/ProfileFlow/VoiceAssistant/ownNumber/` — `OwnNumberCard` (invitation / connected / failure / pending
admin-call, three expanders), `OwnNumberConnectScreen` (‼️ the wizard is its OWN gated screen
`navigations.VOICEOWNNUMBERCONNECT`, registered in Assistant-Route AND MyDashboard-Route through
`GatedVoiceOwnNumberConnectScreen` = `voice.number.manage`), `CheckRunner`, `CodeRow`, `OwnNumberSheet` (the one
bottom-sheet shell), `WhoAnswersPanel`, `AskUsSheet`, `WhatChangesSheet`, `HearItSheet`, `OwnNumberAdjustSheet`,
`OwnNumberDisconnectSheet`, `ownNumberCopy.ts`, `useOwnNumberCheck.ts`, `ownNumberStyles.ts`.

- **Where the phone differs from the browser, deliberately:** no platform toggle and no QR hand-off (this IS the
  phone — `Platform.OS` decides the checklist paths), and the codes DIAL through `Linking.openURL('tel:…')` on
  Android while iOS copies them (iOS refuses `tel:` carrying `*`/`#`), falling back to the clipboard if the
  dialler refuses.
- Route params: `VoiceAssistant { ownNumber?: 'connect' | 'how' | 'adjust' }` (the push and the screen's own exits)
  and `VoiceOwnNumberConnect { step?: number }` (3 re-enters at the dial codes). The screen clears the param once
  consumed via `navigation.setParams`.
- `useOwnNumberCheck` = the web hook's twin: the transient `VoiceOwnNumberCheckUpdated` event (claimed, so no
  banner) + a 3 s poll. Copy is `VOICE_ASSISTANT.OWN_NUMBER.*` (i18next, `{{placeholders}}`, `_one/_other`),
  generated from the same table as web so both apps say the same sentence.
- `ApplicationForm` enables the ForwardExisting tile and draws `LockedModeCard` for the two impossible modes;
  `VoiceAssistant/index.tsx` hosts the card under the number box, the "Your numbers" row, the who-answers panel and
  the waiting note. Contract: `clinqet-voice-assistant` SKILL.

## 2026-09-09 AI Voice setup gate — details + address only (mirrors web)
`VoiceAssistant/index.tsx` `STEP_ROUTES` maps only `BusinessDetails` → `EDITBUSINESSDETAILS` and `BusinessAddress` → `EDITBUSINESSADDRESS`; unknown step falls through to business details (web parity). The server is the authority. Dropped-step `VOICE_ASSISTANT.ONBOARDING_STEP_*` keys stay (wizard / go-live strip). Tests: `__tests__/voiceOnboardingGate.test.ts`. Contract: `clinqet-voice-assistant` SKILL.

## 2026-09-07 AI Knowledge — the per-item receptionist choice, mirrors web (rendering rules, not layout)
- `src/lib/knowledge/receptionistAccess.ts` is the import-free TWIN of the web file; `__tests__/knowledgeReceptionistAccessParity.test.ts` runs both through ONE fixture table (skips loudly, every peer read inside `it()`, when the web tree is absent — §0.17); `__tests__/knowledgeReceptionistAccess.test.ts` pins the rules alone. Backend contract: the `clinqet-voice-assistant` SKILL, "PER-ITEM RECEPTIONIST ACCESS".
- `Knowledge/index.tsx`: `receptionistAvailable` / `materialSharingEnabled` derived from the list (`receptionistAvailable` = the AI Assistant page's own switch, delivered by the server); `renderReceptionistChoices({ idPrefix, value, disabled, compact, onChange })` = the three radios (`accessibilityRole="radiogroup"`/`radio`, `accessibilityState.selected`, brand-green dot, the `audienceOption*` styles reused; folds to two while sending is off, a tap on the lit choice sends nothing); `renderReceptionistBox` in the details editor (reuses the audience box styles; `receptionistControlState(detailsDoc, canManage, accessKnown)` — loading renders nothing, locked = `KNOWLEDGE.AUDIENCE.LOCKED`, readonly = `RECEPTIONIST.READ_ONLY_*` + `AUDIENCE.READ_ONLY`, editable WHILE Processing with `RECEPTIONIST.PROCESSING`); `commitReceptionist` saves on tap (`setKnowledgeDocumentReceptionistAccess(docId, access)` → `knowledge/documents/${docId}/receptionist`), a busy REF against double taps, reverts + `Toast` `AUDIENCE.SAVE_FAILED` on failure, `reconcileDetails` (renamed from `reconcileAudience` — it re-seeds BOTH boxes) on success AND failure, `accessibilityLiveRegion="polite"` for saving/failed/offline. Upload rows: the compact picker under the two pickers (`uploadReceptionist*` styles), sent only when `dataRef.current?.receptionistAvailable`. FAQ editor: the box with `RECEPTIONIST.FAQ_HELPER`; `faqAccess` rides `saveFaq` (`...choice` only with a receptionist). Row marks on files AND FAQs: `Pill` `MARK_ANSWERS_AND_SENDS` (`info`) · `MARK_ANSWERS_ONLY` (`navy`) · `MARK_NOT_USED` (`neutral`), `testID="knowledge-receptionist-mark"`, `RECEPTIONIST.CHANGE_HINT` label, the SAME 44 px hit slop as the audience mark (pinned). `KnowledgeImagesPanel.tsx` takes `sendBlock` only (null = can send), mirroring web: no receptionist = no notice/ticks/dimming and `IMAGES_DELETE_CONFIRM_QUIET`; `…_READ_ONLY` sentences without manage; the delete is aborted after `NUMBER_REQUEST_TIMEOUT_MS` (`deleteWithUrl(endpoint, { signal })`); focus after a delete goes next tile → previous → `onFocusLeavesPanel` (the row's toggle, else the document name). `adoptList` drops a file's live picture tally when the server's counts change (`keepLiveImageCounts`). `CommonSwitch` is no longer used on this screen; the `shareRow*` / `uploadShare*` styles are gone.
- Words (`src/Locales/*.json`, five languages, Latin "Clinket" in gu/hi, no space before `?`/`!` in fr): `KNOWLEDGE.RECEPTIONIST.*` (25 leaves — labels, hints, badges, marks, read-only lines, `PROCESSING`, `UPLOAD_HINT` / `UPLOAD_HINT_NO_SENDING`), the `*_NO_RECEPTIONIST` variants (`SUBTITLE`, `FAQ_SUBTITLE`, `EMPTY_TITLE`, `EMPTY_BODY`, `EMPTY_BODY_DOCS_ONLY`), `AUDIENCE.HELPER_PHONE_NO_RECEPTIONIST`, `IMAGES_NOT_SENDABLE`, `NUDGE_CHOOSE_*`, `DRAFTS_RERUN_BULLET_ANSWERING_ONE/ALL`; the neutral rewrites name "Clinket" as the actor. Deleted: `SHARING_*`, `IMAGES_NOT_SHARED`, `DRAFTS_RERUN_BULLET_RECEPTIONIST_*`.
- `VoiceAssistant/index.tsx`: `countUsedByReceptionist` for the "already knows" summary; `needsChoice` (Ready material, none the receptionist may use) swaps the invite card for the choose card (`NUDGE_CHOOSE_*`, `openKnowledge('choose')`).
- `services/knowledgeService.ts`: `receptionistAccess?: string` on the document, the confirm-file and the FAQ payloads; `receptionistAvailable?: boolean` on the list; `setKnowledgeDocumentReceptionistAccess`; `apiManager/constant.tsx` `KnowledgeDocumentReceptionistAPI`. Tests: `__tests__/knowledgeReceptionistScreen.test.ts` (catalogue SET EQUALITY with what the screens render — no dead copy, no missing word; the neutral variants never say "receptionist"/"caller"; every wiring pin incl. the ref guard, both reconciles, the payload gates, the 44 px slops), `knowledgeImagesParity.test.ts` and `knowledgeAudienceScreen.test.ts` updated (`reconcileDetails` ×4). `tsc --noEmit` clean, ESLint 0 problems on every touched file; the screen-scan and parity guards were proven red by sabotage from scratchpad snapshots.

## 2026-09-02 Knowledge + AI setup upload PRE-FLIGHT — mirrors web's rules (plan §3.7; mockup gate WAIVED by the owner)
- `src/Util/pdfPageCount.ts` (`countPdfPages` over bytes, `countPdfPagesAtUri` reads the picked file's bytes from its URI; `null` = unknown, never zero pages) and `src/Util/knowledgePreflight.ts` (`estimateKnowledgeLoad` / `estimatePickedLoad`, `preflightWarnings`, `passageHeadroom`, `totalEstimatedPassages`, `exceedsHeadroom`, `estimateLine`, `preflightWarningMessage`) are 1:1 ports of the web rules with the SAME caps (knowledge 100 pages / 2 600 000 characters / 30 MB; setup 20 pages / 10 MB). `__tests__/knowledgePreflight.test.ts` mirrors the web suite.
- `Knowledge/index.tsx`: picked rows are enriched (`enrichEstimates`, rejected rows skipped), each row renders `sizeText · estimateLine` plus warnings in `styles.fileWarn` (`theme.warning`), a `Banner tone="warning"` `KNOWLEDGE.PREFLIGHT_NEARLY_FULL` (`{{needed}} {{left}}`) precedes the info banner when the summed estimate exceeds the passage headroom, and BOTH upload entry points are gated on `uploadBlocked` (was `limitReached`). Keys `KNOWLEDGE.PREFLIGHT_PAGES_ONE/_MANY`, `PREFLIGHT_PARTS_ONE/_MANY`, `PREFLIGHT_PAGES_OVER_CAP`, `PREFLIGHT_CHARACTERS_OVER_CAP`, `PREFLIGHT_NEARLY_FULL` ×5 locales (i18next, no inline ICU).
- `src/components/AIAssistantModal.tsx`: `acceptSize(size, name)` gates camera, gallery and document picks at `SETUP_MAX_FILE_MB = 10` (`AI_ASSISTANT_MODAL.ERROR_FILE_TOO_LARGE` `{{name}} {{max}}`, Toast); `countPdfPagesAtUri(finalUri)` → `PAGES_OVER_CAP` advisory (`{{count}} {{max}}`, `styles.fileWarn`); `filePreflight` resets at all 4 file resets. Pinned by `__tests__/aiAssistantModalParity.test.ts`. Jest 132/132, tsc 0, ESLint 0 errors.

> The provider/partner **mobile** app `C:\Nik\clinqetmobilepartnerapp` (React Native 0.78, scheme `clinketpartner://`). Distinct from `clinqet-partner-app` (the Next.js WEB partner app) and `clinqetmobileuserapp` (the customer mobile app). Covers the app shell + the payments/info surface added in Payments Phase 4.

## 2026-08-25 Pictures from a knowledge file — mirrors web (SHIPS DARK)

`Voice:Knowledge:Images:Enabled`. Same rules as provider web, three tiles across:
`KnowledgeImagesPanel.tsx` + `knowledgeImagesStyle.ts` open in place under the document row.
‼️ i18next pluralizes on `count` ONLY via `_one`/`_other` siblings — `IMAGES_ROW_COUNT_one`/`_other`;
a single "{{count}} pictures" key reads "1 pictures". Tiles draw `thumbnailUrl` only, the full-screen viewer
takes `getOriginalSrc`, delete goes through the app's own confirm modal, there is no ADD. Also shipped here:
"Review below" → "Review", and the suggestions-tab ring is gated on `count > 0`.
Pinned by `__tests__/knowledgeImagesParity.test.ts`. Full contract: the `clinqet-voice-assistant` SKILL.

## 2026-08-29 Knowledge — "Analysing" pill, pending line, picture-tick feedback (mirrors web's rules)

- `knowledgeService.ts`: `KnowledgeDraftAnalyticsOutcome` gains `'Queued'`; `KnowledgeList.analyticsMaxMinutes`.
  `knowledgeDraftMeta.ts`: `resolveAnalyticsLine → { variant: 'pending' }` for a Ready row with a Queued stamp.
- `Knowledge/index.tsx`: `ANALYTICS_POLL_SCHEDULE_MS`/`analyticsPollDelayFor` (9 checks, ~31.5 min, then STOP),
  `analysingKey`, `analyticsPollExhausted` + `KNOWLEDGE.POLL_ANALYSING_STALLED` card; ONE `AppState` listener for both
  ladders (`watchingAnything`). The row's `statusColumn` adds an **Analysing** `Pill` (tone info, spinner while
  checking) under Ready; a TAP toggles an inline `Banner` with `KNOWLEDGE.ANALYSING_EXPLAIN_one/_other` (`count` =
  minutes) or `_NO_MAX`; the line reads `KNOWLEDGE.DRAFTS_ROW_PENDING`; the actions sheet's Re-run entry is gated by
  `rerunAvailable(doc)` (absent while pending, D7).
- `KnowledgeImagesPanel.tsx`: the tick that cannot send is enabled and `tickDashed`; a press sets `explainedId` and
  renders a dismissable notice (`IMAGES_NO_DESCRIPTION_FEEDBACK` + `IMAGES_DISMISS_NOTICE`; `accessibilityHint` =
  `IMAGES_TICK_NO_DESCRIPTION_HINT`) — never a save; the viewer shows the same copy (`IMAGES_NO_DESCRIPTION` is gone).
- Tests: `__tests__/knowledgeDraftMeta.test.ts`, `__tests__/knowledgeImagesParity.test.ts` (new analytics describe);
  locale parity + source-integrity suites cover the 9 new leaves ×5.

## 2026-08-21 Knowledge → DRAFT SERVICES review queue ("Clinket AI Data Analytics") — mirrors web

- `src/Screen/ProfileFlow/Knowledge/`: `KnowledgeServiceDraftsSection.tsx` (mockup-v4 tabbed queue since 2026-08-24 — tabs New/Changes/All = the `kind` filter, default via `resolveDraftTab`; ONE `confirmAction` state drives 8 `ConfirmDialog` bottom sheets + the dismiss-all-from-doc sheet, same words as web; forwardRef: `openApproveShown` / `openApproveAll` / `openDismissAllChanges` / `loadMoreIfNeeded`; the screen renders the STICKY BAR per the active tab from `onBarStateChange` — New/All: "Add the N shown" (subset only) + "Add all new services (N)"; Changes: "Dismiss all changes (N)"; bulk actions are business-wide with exact global counts), `KnowledgeDraftEditSheet.tsx` (bottom sheet; amber-intercept = ONLY the field in question + "Save and approve", never double-asked), `knowledgeDraftMeta.ts` (1:1 port of the web rendering rules incl. `resolveDraftTab`; `__tests__/knowledgeDraftMeta.test.ts` mirrors the web suite), `knowledgeDraftsStyle.ts`, `knowledgeSurface.ts`; `services/knowledgeService.ts` (13 routes in `apiManager/constant.tsx`, incl. `dismiss-by-kind`). Document rows carry outcome links (Review below scrolls to the box via onLayout-y; Run again / Try again open the re-run confirm).
- Parity = matching RENDERING RULES, not same-named components: same chips/actions/intercept/analytics line, 403 never logs out (`unwrap` throws with `.status`, `isConflictError` = 412 → conflict toast + reload), bulk loop stops on server `remaining ≤ 0`, failed-filter chip, clash guidance sentence, the ··· menu needs `voice.settings.manage` only, permissions are `can()` alone (the web rule — the gate mounts the screen once access is known), the palette is the theme's review-queue tokens (`panelSurface` … `overlayTint`, light + dark), a refresh failure toasts and keeps the list, SignalR `KnowledgeServiceDraftsReady` bumps the refresh signal, push deep-link → Knowledge.
- 139 `KNOWLEDGE.DRAFTS_*` leaves ×5 (i18next `_one/_other` plurals, NO inline ICU); the mockup's MOBILE wording is carried where it differs from web (approve-all confirm body with `{{settings}}`, "Adding {{done}} of {{total}}… keep the app open."). Every literal key must exist in every catalog (`sourceLocalizationIntegrity`). Backend/contract detail: the voice-assistant skill.

## 2026-08-14 AI setup remediation navigation

- Service rejection and `ServicePricingRequired` notifications open the existing `AddService` editor with `serviceId` and `businessId`. The screen switches workspace, checks `catalog.service.update`, point-loads the service, and handles missing/inaccessible/error cases without inventing a new screen.
- `ServicePricingRequiredSummary` opens Notifications outside onboarding. The summary is transient, so it is not marked read. Individual remediation rows remain durable and exact-service actionable.
- The notification/push gate refuses dashboard-shell navigation while onboarding. A live banner tap dismisses/does nothing, and a background or killed-state system-push tap cannot save a deferred redirect that would bypass onboarding.
- The mobile push allowlist includes exact-service remediation types. Aggregate summary push deliberately falls back to Notifications rather than opening an editor without a service ID.

## App shell (verified)
- **Navigation:** React Navigation v7. Root native-stack in `App.tsx`; bottom tabs `src/appNavigation/BottomNavigation-Route.tsx` (Dashboard · Bookings · ⊕ · Leads · Inbox); main stack `src/appNavigation/MyDashboard-Route.tsx`. Screen-name constants in `src/appNavigation/constant.tsx` (`navigations.*`). Screens under `src/Screen/<Flow>/...`. Add a screen = component + register in `MyDashboard-Route.tsx` + a `navigations.*` constant.
- **Theme:** `src/theme/index.ts` (`AppTheme`, light+dark) via `useTheme()` (`src/context/ThemeProvider`). Tokens: `brandGreen #97EF29`, `brandBlue`/`textPrimary #032858`, `textStrong #101010`, `brandGreenSoft`, `space`/`radius`/`font` scales, `danger`, `glass*`. Font `Lufga`. No global Button primitive — themed `TouchableOpacity`. Shared: `components/header.tsx` (`CommonHeader`), `components/Switch.tsx`, `components/common/Toast.tsx` (`Toast.show(msg, Toast.LONG)`). Icons: `react-native-vector-icons/Ionicons` (+ `Feather`).
- **i18n:** i18next + react-i18next; init `src/Locales/i18n.ts`; resources **en/fr/gu/hi** (complete translations; es is complete but deliberately unregistered), `fallbackLng:'en'`. `useTranslation()` → `t('SECTION.KEY')`; keys use `SECTION.SCREAMING_KEY`.
- **API:** `src/apiManager/apiManager.tsx` `apiClient` (fetch-based): `getwithUrl`/`postWithUrl`/`putWithUrl`/`deleteWithUrl` (session rules in the 2026-09-30 section above) and `getPublic` (anonymous, NO auth side-effects — use for public endpoints). Envelope `{ data: ... }`. Endpoint constants in `src/apiManager/constant.tsx`; hosts in `src/config/env.ts` from `@env` (react-native-dotenv, build-time `.env`): `BASE_URL`, `AUTH_URL`, `CUSTOMER_HOSTING_URL`, **`PARTNER_HOSTING_URL`** (added P4).
- **Contexts** are composed in `App.tsx`. **Tests:** jest, `__tests__/*`, `npm test`. ‼️ The repo has **NO ESLint config file** (the `lint: eslint .` script is broken repo-wide); lint changed files against `node_modules/@react-native/eslint-config/index.js` via `npx eslint --no-eslintrc --config <that> --resolve-plugins-relative-to . <files>`.

## Payments surface (Phase 4 — info-only, App-Store/Play compliant)
**Golden rule:** provider digital goods (subscription/AI/top-up) are NEVER sold or linked-to-pay in the app — info only. NO `@stripe/*`/IAP, NO price/buy/checkout/booking-pay, NO vendor name, NO `/billing` link. Only outbound action = "Open the Clinket web app" → `PARTNER_HOSTING_URL/dashboard`. AI enrollment (pay / start the AI trial) happens on the **web** — the in-app AI card's not-enrolled action opens `/dashboard` (there is no in-app request-access). All gated by AppConfig flags so with `BillingUiEnabled=false` the app is exactly as today. (05/06-compliance docs in `payments-plan/` are authoritative.)

- **AppConfig:** `src/services/appConfigService.ts` (`GET /api/v1/app-config` → flags, all-OFF on failure) + `src/context/AppConfigProvider.tsx` (`useAppConfig()` → `{ payments, providerSetupUpload, loaded, degraded, refresh }`). Flags: `enabled`, `billingUiEnabled`, `aiAssistantEnabled`, `aiAssistantPaidEnabled`, `onlineBookingPayEnabled`, `bookingDepositEnabled`. ‼️ `providerSetupUpload` (`maxFileSizeBytes`, `maxPdfPages`) carries the AI-setup upload caps so `AIAssistantModal.tsx` mirrors NO constant (2026-09-02); `restoreCachedAppConfig` re-maps a cached config rather than trusting its shape, so a cache written before the caps existed still hands back the launch defaults.
- **Plan & Billing:** `src/Screen/ProfileFlow/PlanAndBilling/` — gated on `billingUiEnabled`; plan card (tier NAME + benefits, no price) via `src/services/billingOverviewService.ts` (price-free projection of `provider/billing/overview`, cached); AI card gated on `aiAssistantEnabled`, reuses `services/voiceAssistantService` (`getVoiceAssistant`); not-enrolled ⇒ the AI action opens the web to enroll (no in-app `request-access`), enrolled-not-live ⇒ "Finish setup" → the VoiceAssistant screen; "Open the Clinket web app" button. Reached from a gated row in `ProfileScreen` (+ gated `components/ProBadge.tsx` tier chip). `src/Util/tierDisplay.ts` maps tier → display name.
- **Edges:** offline/fetch-fail → OFF (hidden); flag flip mid-session → hides; foreground-return (`AppState 'active'`) → `refresh()` + forced overview re-read; no duplicate calls (cached).

## Analytics instrumentation (FULL provider-web parity — analytics-recs Phase A5, 2026-07-02)
- **Tracker:** `src/services/analyticsTracker.ts` — RN mirror of the web partner tracker (`APP_TYPE="Provider"`, `eventSource:"mobile"`, queue 20 / 2s flush, consent+jurisdiction gate, PII scrub, sampling mirror, 429 backoff, AsyncStorage LinkedSearchId plumbing — present but NOT populated, matching web). Exports the full provider helper set incl. `trackBilling` (default surface `dashboard.billing`) + `trackInsights` (`dashboard.analytics`). Screen-name→surface map covers PlanAndBilling/Insights/VoiceAssistant/CallFollowUps/LiveCall (+ all pre-A5 screens). `src/context/AnalyticsProvider.tsx` auto-emits PageView per navigation state change + flushes on AppState background; `src/hooks/useDwell.ts` = RN dwell hook (no scroll-depth hook).
- **Coverage:** Insights, Plan & Billing (P4-compliant: views + CTAs only, never a price/vendor), VoiceAssistant settings + ApplicationForm + promo, CallFollowUps (history/filters/detail/recording incl. download), SecurityPasskeys (SettingsAction on `profile.security` — provider-web strings, NOT the customer AuthAction shape), ProductTour (`TourContext` emits tour_start/tour_complete/tour_skip — every termination exactly once, never inside a state-updater), lead list + detail (bid/withdraw/question funnels re-aligned to web verbs + web buckets in A5), quote list + detail (mark_accepted/mark_rejected + send/resend re-aligned in A5). **The exact frozen strings live in the `clinqet-analytics` skill ("Provider-mobile A5 additions") — treat that as the string authority.**
- **Deliberate non-coverage:** `Screen/exploreTab/*` — the Explore tab is commented out in `BottomNavigation-Route.tsx` and the screens are hardcoded static demos ⇒ unreachable, untracked. Suggestion apply/dismiss on call follow-ups: untracked (web parity). The lead cap-meter upgrade CTA opens the web dashboard untracked (web's cap banner is untracked too).
- **Verify pattern:** `npx tsc --noEmit` (ONE pre-existing error: `react-native-tracking-transparency` module missing), `npx jest` (106/106), lint changed files against `node_modules/@react-native/eslint-config/index.js` via `npx eslint --no-eslintrc --config <that> --resolve-plugins-relative-to . --quiet` and diff against a `git worktree` baseline (the fallback config reports ~28 pre-existing errors across these screens — compare, don't chase zero).

## 2026-07-03 audit-session additions
- **Tracker hardening:** posts WITH the bearer via a new `postWithStatus` (events were previously anonymous — attribution loss); working 429 backoff; background (AppState) flush = in-memory cached location + one-microtask defer (same-turn dwell enqueues included); PageView de-dups on active route name (navigation 'state' fires on every mutation); `scrubPii` returns non-strings unchanged (no more `searchQuery:""` skew); console.* stripped in release builds — see the `clinqet-analytics` skill "Mobile tracker hardening".
- **Insights:** Peak Times weekday now formatted with timeZone UTC (device-timezone rendering showed the prior weekday across CA/US) + the 3 new Premium cards (lead_open_rate, search_visibility, view_to_inquiry — 20 `card_view` names, `locked_card_view` ×4 on Free; see `clinqet-smart-analytics`).
- **G2 instrumentation batch (web-mirrored strings):** invoice detail/create/edit full verb sets (incl. the previously-missing `send_init` legs) + booking `send_email_init`, calendar `view_mode_change` + FilterApplied, inbox `inbox_open`/`conversation_open` {context}, booking list (`query_submit`/`tab_switch`+FilterApplied/`create_open`/view-toggle cta/ResultClick `booking_card`), AddQuote success-side QuoteRequested, NotificationItem `click`/`mark_read`/`delete` (+fails), CRM create/edit submit trios, portfolio CreateProject add/edit trios, SocialLinks profile-edit save, ChangeLanguage `language_change`, `bulk_upload` (+`_fail`), Terms/CommunityGuidelines `policy_view`+dwell — exact strings in `clinqet-analytics`.
- Manual-booking `trackBookingInitiated` now carries the REAL `providerId` (payload-root businessId); the hollow `customerId` was dropped.
- **EditWebsite save FIXED (post-audit 2026-07-03)** — was a stub (fake success modal, no API call); now loads the current Website link and persists via the social-links PUT (whole-set replace ⇒ other platforms preserved), SocialLinks 401-refresh/Toast/markProfileForRefresh patterns, ProfileEditAction edit_submit/save_success/save_fail on profile.contact_information; dead commented-out editWebsiteAPI.tsx deleted.

## Next (P5 — ✅ DONE)
Customer **mobile** in-app booking pay shipped in `clinqetmobileuserapp` via the native iOS/Android payment sheet (Apple Pay / Google Pay / card, 0% store fee — real-world service) — NOT this app. See the new `clinqet-customer-mobile` skill + the `clinqet-payments` skill (Phase 5). Next: India go-live = P6; smart analytics = P7.

## Billing page pricing + annual/promo parity (2026-07-11 — SUPERSEDES the P4 'price-free' description)
The Plan & Billing screen now SHOWS prices (an earlier product decision) and, this round, mirrors the web billing design — while keeping the compliance pattern INFORM + WEB HAND-OFF (zero in-app purchase/checkout actions; every CTA opens the web dashboard).
- **Yearly contract (2026-10-04):** the overview has NO `annualBilling` block any more. Yearly is always on offer, `annualPriceMinor` = exactly 12 × monthly, the term is 12 months, no built-in discount. `billingOverviewService` maps per plan `annualPriceMinor`, `discountedAnnualPriceMinor` and `promoCode` (the only yearly saving = an applied promo with "Apply to annual plans").
- Monthly | Annual toggle shows whenever any plan has `annualPriceMinor`, always defaults to Monthly. The green chip beside it appears ONLY when a plan carries `discountedAnnualPriceMinor` (`PROMO_ANNUAL_SAVING` / `_PLAIN`, amount from `bestPromoAnnualSaving` in `src/Util/annualPricing.ts` — web parity `promoAnnualSaving` in `Billing.jsx`). In the annual view a promo plan shows the struck yearly total (`planAnnualStrike`, testID `plan-annual-strike-<tier>`) above the green promo `BILLED_FIRST_YEAR` line (a repeating promo covers the first yearly charge only); without a promo the line is `BILLED_ANNUALLY`.
- Annual card price = monthly-equivalent + '/mo' with 'billed annually ({total}/yr)' sub-line (mirror of web formatMonthlyEquivalent). `PER_YEAR` labels the struck yearly total and a yearly holder's headline.
- ~~Promo free state (`isPromo`)~~ — REMOVED 2026-10-04 with the promo grant (`isPromo` is no longer on the overview).
- Every plan card's Choose is `theme.brandGreen` with `theme.onBrandGreen` text in both themes, the recommended card included (web `Billing.jsx` paid Choose = #97EF29/#101010; the navy recommended variant `chooseBtnPopular` was removed 2026-10-04). The WhatsApp blocked card's `viewPlansBtn`, the `WhatsAppLimitStrip` button and the `UsageMeter` CTA follow the same rule. Pinned by `__tests__/chosenActionAndLimitColours.test.tsx` against the REAL light and dark themes.
- Keys BILLED_ANNUALLY/PER_YEAR/PROMO_ANNUAL_SAVING/PROMO_ANNUAL_SAVING_PLAIN in all 5 locales; SAVE_PCT/MONTHS_FREE/EXTRA_MONTHS were DELETED with the built-in deal. Pinned by `__tests__/planAndBillingYearly.test.tsx` + `__tests__/annualPricing.test.ts`.


## Shared limit system + WA row + sunset banner + quota UX (2026-07-11, sessions 1+2)

- **Routing rule (owner D7):** every upgrade CTA goes to the IN-APP Plan & Billing screen first (`navigations.PLANANDBILLING`); the web hand-off happens only at actual payment. (The voice "Top up on web" hand-off is a separate user-locked compliance choice — top-up ≠ upgrade.)
- **Shared components:** `src/components/common/UsageMeter.tsx` (keyPrefix-driven `_TITLE _SUMMARY _REMAINING _REACHED _UPGRADE_NEAR _UPGRADE_AT _UPGRADE_CTA`; theme tokens incl. the new `warning`/`warningSoft`; optional `style` prop for padded hosts — PlanAndBilling passes `{marginHorizontal:0, marginTop:0, marginBottom:16}`) + `UpgradeSheet.tsx`. Theme gained `warning`/`warningSoft` (light `#92600A/#FFF7E6`; dark `#F6C667/rgba(245,158,11,0.14)`).
- **Plan & Billing WhatsApp row:** `getWhatsAppUsage()` (`billingOverviewService.ts`, fail-soft null; `ProviderBillingWhatsAppUsageAPI`) fetched in the screen's Promise.all when the plan package is on; capped tiers ⇒ `UsageMeter keyPrefix="PLAN_AND_BILLING.WA_USAGE"` with NO onUpgrade (info-only — the plan cards above are the upgrade path); blocked (Free) ⇒ compact nudge card (`WA_BLOCKED_TITLE/BODY`). Keys ×4 locales (en/es/hi/gu).
- ~~Sunset countdown banner~~ — DELETED 2026-10-04 with the whole PromoSunset feature (`SunsetCountdownBanner.tsx`, its test, the AppConfig sunset fields and the `SUNSET.*` keys).
- **BroadcastDetails quota UX (session 1, false-success bug fixed):** shared `parseResponse()` guards every action; 429 `lead_quota_exceeded` ⇒ `UpgradeSheet` → PLANANDBILLING; the leftover inner `{ const data = json.data }` block was flattened (s2).
- `Util/notificationNavigation.ts` + `services/pushNotificationService.ts`: the `Sunset*` types are gone (2026-10-04); a `SystemNotification` whose `Type` is in `PLAN_LIMIT_NOTICE_TYPES` (`LeadQuotaReached`, `WhatsAppSendCapReached`, `WhatsAppPlanBlocked`) opens PlanAndBilling. On a push the kind arrives as
  `data.noticeType` (filled by `NotificationProcessor` from `message.Data["Type"]`); `resolveSystemType` reads it.

## Tier-limits final audit fixes (2026-07-16)

- **Plan & Billing:** the WhatsApp allowance row (meter/blocked card) renders directly ABOVE the plan cards (owner mockup: "the comparison IS the pitch") and passes `borderColor: theme.border` so its hairline matches the sibling cards.
- **UpgradeSheet:** full ConfirmationModal parity — 200ms scale (0.8→1) + fade entrance (`useRef` Animated values, native driver) and 16px button labels.
- **BroadcastDetails:** booking-start pre-fill via functional set-state (a silent refresh can no longer clobber a provider-picked time — the deps-frozen `!bookingStart` guard was always true); `convert_to_booking_fail` analytics carry `status` metadata.

## Two plans — Free + Premium (2026-10-04)

Authority `C:\Nik\Data\two-plan-pricing\PLAN.md` + `UI-CONTRACT.md`. Mirrors the partner web change (see `clinqet-partner-app`).

- **Plan cards:** `src/Util/plansCatalog.ts` is look-only — `TierKey = 'Free' | 'Premium'`; each tier's `bullets(limits)` builds its lines from the overview's `leadsPerMonth` / `whatsAppPerDay` / `teamSeats` (`null` ⇒ the `*_UNLIMITED` key; `leadsPerMonth <= 0` ⇒ `PLAN_LEADS_NONE`; Free's leads bullet uses `PLAN_LEADS_WITH_RESCUE`). Premium is `recommended`. Never hardcode 5 / 10 / 200 / 50 or a price. A live plan trial shows a `PLAN_TRIAL_OFFER` chip on the card (`planTrialDaysFor`).
- **Locked lead card:** `Screen/ProfileFlow/Broadcast/LockedLeadCard.tsx` handles `access === 'LimitReached'` beside `Waiting`/`Missed` (category + area only). Body `BROADCAST.LOCKED.LIMIT_BODY` when `upgradeAvailable`, else `LIMIT_BODY_RESETS`; CTA `UNLOCK_PREMIUM`, or `START_TRIAL` when `usePlanTrialOffered` says a trial is live; the button needs `billing.read`, and there is no ask-the-owner line on the limit card. The list (`Broadcast/index.tsx`) and `BroadcastDetails.tsx` read `upgradeAvailable` from lead usage.
- **Limit colours (2026-10-04, web parity):** a used allowance is amber, never red — `UsageMeter` uses `warning`/`warningSoft` near AND at the limit (web `UsageMeterCard`). The LimitReached locked lead card draws an amber frame (`warningBorder`/`warningSoft`) and an amber lock tile; Waiting/Missed keep the blue frame and navy lock.
- **Plan status line:** `billingLines.planStatusText(sub, tier, t)` — the dated `planRenewLine` text, else `PLAN_FREE_BIG` (Free only) or `PLAN_NO_CHARGE` (any paid tier; web `billing.currentPlan.noCharge`). Premium is never told to upgrade.
- **WhatsApp limit strip:** `src/components/whatsapp/WhatsAppLimitStrip.tsx` in `InboxTab/ChatDetails` (WhatsApp chats, `billing.read` only): `CHAT_SCREEN.WA_LIMIT_STRIP[_UPGRADE]` / `WA_PLAN_BLOCKED_STRIP[_UPGRADE]` — the `_UPGRADE` variant and the PLANANDBILLING button only when `usage.upgradeAvailable`. `UsageMeter` offers an upgrade only when `upgradeAvailable === true`.
- **Team seats:** `lib/tenancy/renderingRules.ts` `seatCardCopy` uses the `*TopPlan` body keys and hides the upgrade unless `seats.upgradeAvailable === true` (see `clinqet-provider-teams`).
- **Removed:** `SunsetCountdownBanner`, the `Sunset*` / `SubscriptionUpgraded` notification routes, `isPromo`, the Basic / PremiumMax tiers and their keys. `ProBadge.tsx` stays: it shows the localized paid plan name (`tierName`), never a price and never a trust mark.

## Business Timezone UI (2026-07-16)

- **Backend contract (already shipped, never touch):** GET/PUT `business/profile/timezone` (`business_profile_timezone` in `apiManager/constant.tsx`) → `{ timeZoneId, timeZoneSource: "Detected"|"Manual", canOverride, allowedTimeZones[] }`. `canOverride === false` (India) ⇒ render NOTHING timezone-related anywhere (owner mandate; no client-side country logic — the flag is the only gate).
- **Service:** `src/services/timezoneService.ts` — `getBusinessTimezone()` fail-soft null; `updateBusinessTimezone(id | null)` (null = reset to Detected) returns `{ ok, message, info }` — the API message arrives localized and goes straight to `Toast.show`. State updates from the PUT response; a lone re-GET happens only if the PUT body carried no data.
- **Display helper:** `src/Util/timezoneDisplay.ts` — `timezoneLabelKey` (15 curated US/CA zones → `TIMEZONE.ZONE_*` i18n keys; unknown ⇒ null so the raw IANA id renders) + `formatNowInZone` ("h:mm AM/PM" via Intl.DateTimeFormat, toLocaleTimeString fallback, U+202F/U+00A0 normalized). Unit test `__tests__/timezoneDisplay.test.ts`.
- **Surfaces:** `EditBusinessAddress` — one GET on mount; row card below the country field (clock + "Business timezone" + "<friendly> (<IANA>) · detected|manual") opens `src/components/TimezoneSheet.tsx` (ImageSourceSheet-pattern modal: grab handle, search filter, now-previews, brandGreen ✓ on current, "Reset to detected" only when Manual; PUT only on explicit selection, no-op if the current zone is re-picked). `SetAvailability` — one GET on mount; non-tappable caption card above the day list ("All times are in <friendly>" / "<IANA> · from your business address").
- **i18n:** new top-level `TIMEZONE` section (24 keys incl. the 15 zone names) in ALL FIVE locale files (en/es/hi/gu/ja — es unregistered but kept in parity; ja translated since its top-level spread would otherwise fall back to en).

## Booking payment panel (2026-07-17; corrected 2026-09-29 — the hold-era `PROVIDER_PAY` keys are gone)

- `bookingDetails.tsx` renders the panel when `appConfigLoaded && payments.onlineBookingPayEnabled && details.payment` and
  `payment.status` is not `"None"`: `PROVIDER_PAY.TITLE`, a chip + note from `resolveProviderPaymentView` (`src/Util/bookingPaymentView.ts`),
  a `PayoutStatusLine` (`PROVIDER_PAY.PAYOUT_*`) plus a Gross / Gateway fee / Net breakdown fetched for `PAYOUT_FETCH_STATUSES`
  (`Captured`, `Transferred`, `Refunded`, `PartiallyRefunded`), and `PROVIDER_PAY.MARK_CASH` → `actionStatusModal` `"PaidCash"` when
  `canMarkBookingCash`.
- `PROVIDER_PAY.CANCEL_NOTE` (with `HOLD_PLACED`, `DISCLAIMER`, `AWAITING_CUSTOMER`, `COLLECTED`, `PAID_OUT`, `MARK_COMPLETE_HINT`,
  `LIST_SECURED`, `BREAKDOWN.COLLECTED/PLATFORM_FEE/SENT`) was removed, and `__tests__/providerPayLocaleParity.test.ts` asserts those
  keys stay absent in all five locales. The cancel flow's hold note is `MY_BOOKINGS_SCREEN.CANCEL_HOLD_RELEASED`, gated
  `cancelReleasesPaymentHold` — same rule as web's `providerPay.cancelNote` (see the 2026-09-29 section above).

## AI Quick Setup dialog + service tri-state + labels (2026-07-20)

- **`src/components/AIAssistantModal.tsx`** — behavioral lockstep with web `AIAssistantModal.jsx`; change one, change the other. Availability starts UNCHECKED (`useState(false)` ×2). `showAreaPicker = serviceAreas.length > 1` — the picker is hidden at 0 or 1 area because the server auto-attaches a sole area. Start gating is identical to web (`canSubmit` = file + ≥1 availability + (2+ areas ⇒ ≥1 area)) with an `AI_ASSISTANT_MODAL.STILL_NEEDED` line naming what is missing; the submit payload sends `serviceAreaIds: showAreaPicker ? serviceAreaIds : []`. The default area is pre-ticked. Billing parity is present, gated on `payments.billingUiEnabled` via `paymentSettingsService` — tax/online-payment set **business-level** defaults through the existing billing settings endpoints, never the doc-intel payload. ⚠️ The area picker here is a **hand-rolled chip list**, not the shared component web reuses — a known asymmetry; keep behavior aligned even though the markup differs. Full contract in `clinqet-ai-assistant`.
- **Service update sends BOTH tri-state fields, always.** `src/Screen/completeProfileFlow/AddService/index.tsx` sets `payload.AcceptsOnlinePayments` and `payload.Taxable` at the top level of the payload builder (outside the `selectedServiceAreaIds` block), regardless of the billing flag. State is `useState<boolean | null>(null)` and both load paths preserve `null` via `typeof === "boolean"` checks. The API **full-replaces** these, so omitting one clears the provider's override. See `clinqet-service-listing`.
- **Labels:** provider surfaces say **"At my location"** — values changed on `IN_STORE`, `AT_STORE` and the new `AT_MY_LOCATION` in `src/Locales/en.json`. The **key names and the `isAtStore` data identifier are deliberately unchanged** — copy change only.
- **Icon:** no robot anywhere. The AI mark is the green sparkle `#97EF29` (already the theme's `brandGreen`) on the navy gradient, rendered via `LinearGradient colors={['#032858','#064a9e']}` (10 instances in `AIAssistantModal.tsx`). `#032858` is the theme's `brandBlue`/`textPrimary`.
- **Round-trip rule:** service-area POST/PUT return the full saved entity — consume the response, never refetch the list after a mutation.

## Payment/tax + native gallery parity (2026-07-22)

- Payment Settings mirrors provider web: regional Stripe/Razorpay trust copy, payout readiness, two-card tax price mode, business scope notes, and shared `BookingDepositCard`.
- Service forms expose only Follow business (`null`) or off (`false`) for both payment and tax. Onboarding context hides settings controls/links, shows localized guidance, and prevents AI-modal billing I/O or navigation away.
- Native gallery uses real XHR blob progress, stable client ids, retained local previews, partial-success retry, theme tokens, and Ionicons. It exposes only not saved/uploading/saved/failed+retry; backend derivative processing remains internal and the original image stays visible.

## Password management (2026-07-22)

- The provider settings screen uses cached profile data, with the profile API as fallback, and switches mode only from a literal boolean `hasPassword`/`HasPassword`. Missing or invalid capability never coerces to false: it terminates in localized Retry. A 409 refreshes profile state once and applies the same validation.
- Both success paths replace the persisted access and refresh tokens. Registration/reset and settings use the 15–128 character policy without composition rules (current policy API + UI: see the 2026-07-23 password-checklist redesign below). Set/change analytics and notification routing are distinct.

## Online-bookings toggle: inline OFF warning (2026-07-23)

- `Screen/completeProfileFlow/BusinessDetails` (ONE screen = onboarding + profile edit): the "Accept online bookings" card is now a column card (`onlineBookingsCard` + `onlineBookingsHead`); the shared `onlineBookingsContainer` row style stays untouched for the Payments & tax row. ON state renders exactly as before (two lines, zero added scroll).
- Toggle OFF ⇒ inline amber warning (`bookingsOff*` styles, react-native-svg alert-triangle) derived purely from `allowOnlineBookings` — no modal, no persisted dismissal: 3 consequence bullets, a customer-preview panel (service row + orange "Phone only" pill + Call circle), and a footer with a brandGreen "Turn back on" pill that sets the state true. Dark mode follows the app amber precedent (bg `rgba(245,158,11,0.12)`, text `#FCD34D`/`#F6C667`, icon `#FBBF24`, orange `#FB923C`; preview on theme surfaces).
- i18n: `EDIT_BUSINESS_DETAILS.ACCEPT_ONLINE_BOOKINGS_HINT` re-worded (benefit-framed) + 10 `ONLINE_BOOKINGS_OFF_*` keys in all authored locales; es gained the whole `EDIT_BUSINESS_DETAILS` block (label + hint) they previously lacked (ja's top-level spread ⇒ missing sibling keys inside the section fall back per-key to en).

## Password checklist redesign (2026-07-23)

- `Util.evaluatePassword(password)` in `src/Util/utils.tsx` is the ONLY policy source (exports `PASSWORD_MIN_LENGTH`=15 / `PASSWORD_MAX_LENGTH`=128, `PasswordStrength`/`PasswordEvaluation` types; `Util.isPasswordValid` for gates) — exact port of web `clinqetwebpartnerapp/src/lib/validation/passwordPolicy.js`: tiers good/strong/veryStrong (len>=25⇒3, >=20⇒2, else 1; 3+ char classes bump when <3; unique chars <5 caps at good), `strength` is null while invalid. `__tests__/passwordPolicy.test.ts` pins boundaries + tiers. Never re-hardcode 15/128 outside this module.
- `components/PasswordChecklist.tsx` REPLACED `PasswordStrengthMeter.tsx` (deleted): continuous 4px track (fill = brandBlue light / `#9DB4D1` dark while short, brandGreen valid, danger over; track bg `#E9E9E9`/`#2C2C2E`) + right-aligned status (`9/15` literal counter → localized strength word in `#2F7D00` light / brandGreen dark → "Too long" in danger) + one guidance line with react-native-svg check/alert icons. Self-gates on `isFocused || length > 0` (`isFocused` prop defaults true); optional `onValidChange` fires in a useEffect on isValid.
- i18n: top-level `PASSWORD_CHECKLIST` section (12 keys incl. `ERROR_TOO_SHORT`/`ERROR_TOO_LONG`, all number slots via `{{min}}`/`{{max}}`/`{{count}}`) in en/hi/gu; ONE/OTHER plural keys are selected in component code (`count === 1`), never i18next plural suffixes. The old `REGISTER` strength/rule keys (`RULE_*`, `PASSWORD_WEAK/FAIR/STRONG/VERY_STRONG`, `PASSWORD_STRENGTH_REQUIRED`, 8-char-era `PASSWORD_INFORMATION` family) are deleted from every locale.
- Screens: Register passes `isFocused` from the password field's focus events and errors specifically (too short vs too long) via `Util.evaluatePassword` at submit; ChangePassword + forgot-password NewPassword gate submits on `Util.isPasswordValid(newPassword)` directly (meter-callback state removed). ChangePassword body now scrolls (KeyboardAwareScrollView, content clears the absolute save button) and gained the customer-app-style "Password Tips" card (`CHANGE_PASSWORD_SCREEN.PASSWORD_TIPS` + `TIP_1..TIP_5`, translations copied from clinqetmobileuserapp).

---

## DEEP LINKS + FRIENDLY-NAME POLICY (session 7, 2026-07-26)

**`src/appNavigation/linking.ts` is new** and replaces the inline config that used to sit in `App.tsx`.
That old config carried only `clinketpartner://` — the app had **no** Universal/App Link routing at
all, so every `business.clinket.com/dashboard/...` link in an email, SMS or WhatsApp opened the mobile
browser and asked the provider to sign in again.

- Prefixes: `ENV.PARTNER_HOSTING_URL` plus the prod/dev/uat partner hosts and `clinketpartner://`.
- Every `/dashboard/*` path maps to a screen that already exists, nested under
  `BottomTabs > MydashboardRoute` — routing to a bare screen name pushes it outside the tab shell.
- `BusinessProfile: 'dashboard/profile'` is listed LAST so it cannot swallow `dashboard/profile/*`.
- ‼️ `/auth/*` is deliberately absent and is excluded in the association file: a password-reset link
  captured by the app is a hijack vector. The `clinketpartner://` entries are a different thing —
  they are the OAuth and error callbacks.
- ‼️ **A mapping to a screen name that was never registered fails silently.** The old config's
  `AboutProfileRoute` was exactly that (the real screen is `AboutBussiness`, the repo's spelling), so
  that callback routed nowhere. `__tests__/deepLinking.test.ts` now fails on any linking target that
  is not a registered screen, on any https auth path, and on any routed path the association file
  does not claim.
- Deliberately unrouted, because no screen exists: `/dashboard/profile/gallery`, `/portfolio`,
  `/qualities` and `/dashboard/explore`. Those URLs open the app on its normal launch destination.
  **Add a mapping the day a screen exists, never before.**

**Friendly-name policy (D7).** `src/Util/friendlyNameUtils.ts` is the ONE policy module for this app:
`FRIENDLY_NAME_MIN` / `FRIENDLY_NAME_MAX` / `FRIENDLY_NAME_REGEX` (`^[a-z0-9-]+$`, 3-20) plus
`normalizeFriendlyName`. Never re-declare the pattern at a call site — `BusinessDetails`,
`SetFriendlyNameModal` and `ShareProfileModal` all import it and normalise as the provider types, so
the URL previewed under the field is the URL that gets stored and the server never has to reject it.

‼️ `generateFriendlyNameCandidates` must only emit candidates that satisfy the policy, **including the
20-character cap** — it used to suggest underscore names the server would reject, so tapping a
suggestion was a dead end.

---

## DEEP LINKS — WHAT ACTUALLY BREAKS (final SEO audit, 2026-07-26)

Universal Links / App Links failed **four** different ways here, and every one was silent: the link
just opened the browser, or the app landed nowhere, with nothing to see in CI.

**1 · Declaring the entitlement is not wiring it.** `clinqet.entitlements` declared
`com.apple.developer.associated-domains` perfectly and `CODE_SIGN_ENTITLEMENTS` appeared **nowhere**
in `project.pbxproj` — the file was not even in the Xcode file tree. Xcode never applied it, so the
shipped app had no associated-domains at all. **Check the build setting, in EVERY configuration.**
No JavaScript test can see a build setting; `universalLinkWiring.test.ts` guards it structurally.

**2 · Release must use the Release entitlements.** The provider app had
`ClinqetPartnerRelease.entitlements` on disk and **both** configurations pointed at the Debug one, so
Release shipped `aps-environment: development` — rejected by APNs, and TestFlight uses the production
gateway too. Leave no entitlements file unused; the guard asserts every file on disk is referenced.

**3 · AASA ↔ linking parity must be checked in BOTH directions.** Both apps asserted "everything I
route is claimed" and both passed; nobody asked whether the association file claims things the app
cannot route. It did — 63 URLs across the two apps. Check against the **web app's real routes on
disk**, the third source neither file mentions.
‼️ **A one-segment static page falling through to `:friendlyName` is worse than a miss** — `/reviews`
opened a provider page for a business that does not exist, which looks broken rather than unhelpful.
A static page must be matched by a **literal** pattern. `exclude` entries go **before** the wildcard:
iOS takes the first matching component.

**4 · Never hand-fill a placeholder the repo can answer.** `<<FILL: iOS_TEAM_ID>>` was
`DEVELOPMENT_TEAM` in each pbxproj all along — and the two apps use **different** teams
(`KWXU56R372` customer, `2225KLHB39` partner), so one value was always wrong for one app. The AASA
`appIDs` is asserted against `DEVELOPMENT_TEAM` + `PRODUCT_BUNDLE_IDENTIFIER`, never as a literal.

**Still owner-only:** the Android SHA-256 fingerprints (Play Console only) and an **on-device test on
a Mac**. Nothing native is verifiable from this environment — the guards prove the wiring, not that a
tap opens the app.

## POLICY CONSTANTS: EXPORTED IS NOT ENFORCED

`FRIENDLY_NAME_MAX` was exported from the policy module and imported by **nobody**, so the modal let a
provider type past the column width and the availability check 400d on every keystroke while the web
capped it locally. **An exported-but-unused constant in a policy module is a defect, not dead code.**
Cap with `.slice()` in the change handler rather than a `maxLength` prop — it covers paste too.

---

## STATIC ASSETS ARE NOT PAGES — THE SECOND HALF OF THE AASA TRAP (2026-07-26)

The first fix excluded static **pages** the app cannot route. It was written from a scan of
`app/**/page.js`, which cannot see `public/` — so **every root-level asset stayed claimed by `/*`**:
`robots.txt`, `sitemap.xml`, `llms.txt`, `llms-full.txt`, `site.webmanifest`, every favicon and svg,
and the new IndexNow key file. A one-segment file name falls through to `:friendlyName`, so tapping a
link to `robots.txt` opens a provider page for a business called "robots.txt".

**The lesson is about the scan, not the file.** A route enumeration answers "what pages exist", never
"what URLs exist". Static assets, route handlers (`robots.js`, `sitemap.xml/route.js`) and `public/`
files are all real URLs the association file claims.

Fixed with extension excludes (`*.txt`, `*.xml`, `*.json`, `*.ico`, `*.png`, `*.jpg`, `*.jpeg`,
`*.webp`, `*.gif`, `*.svg`, `*.webmanifest`) ordered **before** `/*`. Safe because a provider slug never
carries an extension. `deepLinking.test.ts` now reads `public/` off disk so a new asset is covered the
day it lands, and still asserts provider + service pages resolve so the excludes cannot over-reach.

‼️ The **partner** app needs none of this: its AASA claims only `/dashboard*`, which no root file matches.

## MOBILE REACHES THE SERVER'S LOCALIZATION — AND OFFERS ONE LANGUAGE IT LACKS

Both apps send `Accept-Language` on every request (`apiManager.tsx`, `apiHeaders.ts`), and both display
server error messages verbatim — which is why §5's `{1}` placeholder leak was most visible on mobile.
Any server-side localization fix therefore reaches mobile with no app change.

Their own copy is clean of the same bug: i18next `{{name}}` interpolation throughout, zero `{0}`-style
placeholders.

Japanese resources and registrations were removed on 2026-07-26. Spanish resources are complete but deliberately hidden until product approval.`n## Localization baseline (2026-07-26)

- Active resources are `en`, `fr`, `hi`, and `gu`. Japanese was removed. `es.json` is complete and parity-tested but remains unregistered until product approves picker exposure.
- English is the structural source of truth. Locale parity tests require the exact key tree and `{{placeholder}}` set. Chat dates, times, bid states, context badges, and picker errors are locale-driven.


## "RANK HIGHER IN SEARCH" — the dashboard's ranking nudges (Phase 5, session 20)

**`Screen/homeTab/MyDashboardScreen/RankHigherCard.tsx` replaced the setup-progress block.** It never
disappears: levers 1 and 2 are things a provider never "finishes", so the old widget's vanishing act —
and every word about what actually moves them — is gone.

‼️ **Bottom of the dashboard scroll since 2026-08-13 (owner-directed, mirroring web's stacked order):**
the card renders AFTER `ServicesList`, not above the carousel — it is guidance, not the day's work, and
at the top it pushed every operational widget below the first screen. Web stacks it after every
operational widget too (its store promo closes that page); on a web desktop it sits full-width under
the main widget grid instead of in the right rail.

- The three levers are in the ranking's **REAL weight order**: answering (0.040) → reliability (0.035)
  → completeness (0.025). The card leads with answering, not with onboarding.
- **`Util/providerRankingLevers.ts` is a faithful port of the partner web's
  `providerRankingLevers.js`** and mirrors the server's `ProviderScoreCalculator`:
  `serviceHasPrice` / `serviceHasPhoto` copy its exact predicates, price and photo are
  **PROPORTIONAL** ("1 of 3 have one"), rows are ordered by real weight not wizard step, and
  outstanding rows sort above finished ones (ticking a box and watching it vanish steals the reward).
- ‼️ **A catalogue we could not read reports NOTHING, never "0 of 0"** — `services: null` omits the
  two proportional rows entirely.
- ‼️ **The description row reads the real description TEXT, not the onboarding step** — a provider can
  finish the step with the field empty, and the score counts the text.
- ‼️ **Never publish the raw numbers** (mockup 18 §7): a score is a target to game, a checklist is a
  job to do. Lever 1 also shows **no waiting count** — a true total would cost a request for a number
  the New Requests widget on this same dashboard already lists in full.

**`hooks/useBusinessServices.ts` — the dashboard fetches its service list ONCE.** Three widgets want
it (`ServicesList`, `RankHigherCard`, `PromoCarousel`); three `useEffect`s would be three identical
requests. Module-level cache + single flight, same shape as the customer app's banner service.
‼️ **A FAILED list is "we do not know", never "you have none"** — it resolves `null` and is not cached,
so callers render their own unknown state.

**`components/RankingHint.tsx`** — the two service-form hints (photo, green; description, blue) and
nothing else. ‼️ **There is NO price hint and none is to be added: cost is a required field the form
already blocks on**, so nudging it would be a lecture. Every hint vanishes the moment its field is
filled. The business-photo hint reuses the EXISTING key `EDIT_BUSINESS_DETAILS.PHOTO_RECOMMENDED` with
new text — **never a new key beside a stale one**.

**`PromoCarousel.tsx` is ON again and it LEARNS.** A slide whose thing is done is dropped (the panel
used to tell someone who uploaded a portfolio two years ago to upload a portfolio, every morning); two
evergreen slides mean it is never empty. It honours `AccessibilityInfo` reduce-motion live, carries a
pause control that always wins, gives every dot a 44 pt hit area with the dot drawn unchanged, and
still stops its border animation while any native `<Modal>` is up (Android/Fabric UI-thread contention).

**Locale files are uniformly CRLF** and round-trip byte-identically through
`JSON.stringify(obj, null, 2)` + CRLF + a trailing CRLF.

## SESSION 22 — sign-in defaults, session isolation, area labels (2026-07-30)

- **OTP-first sign-in**: `LoginWithEmail/index.tsx` `IsPhoneScreen` initial `true` (owner 2026-07-29) —
  the email/phone OTP form renders first; password is the switch-to. Keep-me-signed-in `isChecked`
  defaults `true` on both login screens (the stored explicit choice still restores; ‼️ unchecked BLOCKS
  silent refresh in this app, so default-on avoids 2h session deaths).
- **Logout sweep** (`tokenManager.clearAuthTokens`): += `categoryId`, `subcategoryId` (onboarding
  transients). `apiManager/refreshToken.tsx` gained `failureType:'stale_session'` — after a successful
  refresh HTTP call it re-reads the stored refresh token and SKIPS persisting when it changed mid-flight
  (non-transient per `isTransientRefreshFailure`, so callers take the normal dead-session path).
- **Service-area rows localize the unit** (`ServiceAreaRow.tsx`): the wire value is the enum NAME —
  rendered via `ADD_SERVICE_AREA.KILOMETER`/`.MILES` on `startsWith('k')`, never raw. Area pickers
  (`AddService/components/ServiceAreasSection.tsx` + `AIAssistantModal.tsx` chip list) label `name, city`.
- AddService payment/tax spacing: `acceptOnlineCard` 14/14/12, `taxBlock` 12/12, `choiceRow` mt 10
  (mirrors the web tightening).

---

## Session-cache isolation (2026-07-30)

- **`src/services/sessionCacheRegistry.ts`** — account-scoped module caches self-register a clear
  (`registerSessionCache`); `clearSessionCaches()` runs inside `tokenManager.clearAuthTokens` (the
  logout sweep — `Util.removeData` and every forced logout flow through it) AND at the top of
  `saveAuthTokens` / `saveDeepLinkTokens` (every login path, BEFORE the new session is stored; token
  REFRESH persists via `slideSessionExpiry` and is deliberately untouched). Registered today:
  `billingOverviewService` (`clearProviderPlanSummaryCache`), `hooks/useBusinessServices`
  (`__resetBusinessServicesCache`), `lib/productTour/spotlightCache` (`clearSpotlightCache` — the
  direct calls in tokenManager/utils were replaced by the registry sweep).
- ‼️ **Every registered cache carries a session EPOCH** — an in-flight response that started under a
  previous session must never re-seed the cache after a clear (pinned by
  `businessServicesSingleFlight.test.ts` "never re-seeds the cache").
- `voiceAssistantService` holds NO module cache (checked 2026-07-30); lookup/policy/consent/language
  caches are public or device-scoped — excluded. SignalR was already correct: `Util.removeData` →
  `stopSignalRConnection()` (state + `callbacks` emptied ⇒ the refresh-success reconnect listener
  stays inert after logout); after a new login the SignalRProvider's 30s health check / foreground
  handler reconnects with the current token via `accessTokenFactory`.

## 2026-07-30 — Phase-6 combining audit
- `apiClient.getWithoutHeaderUrl` / `postWithoutHeaderUrl` now guard empty/non-JSON bodies exactly like `postWithStatus` (return `null`, never throw on a 204/empty error body) and call `logResponse` (C29 closed). Callers keep the parsed-body contract.
- `jest.config.js` pins `maxWorkers: 50%` — full-parallel starved component specs into 5s timeouts (C26).
- MyDashboardScreen: `fetchData`/`fetchDashboardCount` are useCallbacks defined ABOVE the focus effect — ‼️ hook dependency arrays evaluate during render, so a later `const` in a deps array is a TDZ ReferenceError in a real browser (Babel hides it in Jest).

## SESSION D — account/payments/support/legal + the FAQ root cause (2026-07-31)

**‼️ The FAQ bug was in the partner WEB app, not mobile.** The codedesc `metadata.content` is
serialized by System.Text.Json, which emits property names **as declared** — the seed JSON is
camelCase but the API returns **`Id/Category/Question/Answer`**. `clinqetwebpartnerapp`'s
`components/Profile/Faqs.jsx` read `item.question || item.title`, so it rendered **58 accordion rows
with no text**, in every region and every language. Mobile's `utils/faqContent.ts` has always been
casing-tolerant and was rendering correctly the whole time. The customer web app already carried the
same fix with a comment naming the cause (`clinqetwebuserapp/lib/server/faqData.js`). **When a
report names "the partner app", check the web build too, and read the SERIALIZED payload — never the
seed file.** `UIManager.setLayoutAnimationEnabledExperimental(true)` was cleared as a suspect: under
Bridgeless (RN 0.78) it only soft-errors on `false` (`BridgelessUIManager.js:184`).

**‼️ Region × language is a mobile-only hole.** A stamp carries only its seeded FAQ languages
(**CA = en/fr/es · IN = en/hi/gu**, verified by live probe) while this app is ONE binary whose
language and region are chosen independently — so a Canadian provider reading in Hindi gets a **404**.
`services/faqService.ts` (`loadPartnerFaqs`) falls back to English, flags `translated:false` so the
screen can say so, and keeps `utils/faqContent.ts` a **pure parser** (folding the fetch into it broke
the existing parser spec). Web cannot hit this — it ships one region-pinned build per deployment.

- **`hooks/useSingleFlight.ts` (new).** All five OTP screens gated `disabled` on "6 digits entered"
  only, so two fast taps submitted the one-time code **twice** and emitted a false `otp_fail`. The
  guard is a **ref**: a `loading` state commits asynchronously and cannot block the tap in the same
  frame. Also fixed: `navigation.goBack()` inside a `setElapsedTime` updater in `LoginOTPScreen` +
  `VerifyRegistrarEmail` (React may run an updater more than once ⇒ **double pop**); the counter is a
  ref now, which also kills a 1 Hz re-render of a value nothing renders.
- **‼️ `SUPPRESSED_SCREEN_NAMES` must hold ROUTE names.** A PageView's `pageUrl` is the active route
  name (`AnalyticsProvider.tsx`), but the list held component-folder names, so 4 of 5 entries were
  dead and the credential/OTP screens were tracked. The same class bites the surface map: 13 keys
  still name non-existent routes (Sessions A/B/C's screens) and report `surface: undefined`.
  `__tests__/analyticsSurfaceRegistration.test.ts` cross-references the map against the real
  `<Stack.Screen name=…>` set.
- **Payment Settings** now mirrors the web page string-for-string (pinned by
  `paymentSettingsCopyParity.test.ts`, which reads `clinqetwebpartnerapp/public/lang/en-US.json` off
  disk): the **Clinket commission → None** row + note, the **Get paid** rail (counter, progress bar,
  step hints, "Set up now"), the **What your customer sees** card, a **danger confirm** before
  disabling online payments, and India's **Check status**. Payout setup calls
  `provider/billing/connect/onboarding-link` and opens the gateway-hosted URL **directly** (one hop,
  as on web; no SDK, no in-app card entry — provider payouts for real-world services, IAP-exempt),
  falling back to the partner web page only if the link cannot be minted. `commission → None` is
  rendered only while `platformFeePercentBps === 0`; a non-zero resolved fee shows the real
  percentage rather than repeating web's "None".
- **`components/Switch.tsx`** gained optional `accessibilityLabel`/`disabled` + `hitSlop` 12 +
  `accessibilityRole="switch"` + `accessibilityState`. It had **no accessibility at all** and a
  40×20 pt target; `hitSlop` clears 44 pt without moving a pixel. Additive — every prop optional.
- **`components/common/ConfirmDialog.tsx` (new)** — the app's generic danger/confirm dialog
  (`ConfirmationModal.tsx` is booking-specific despite its name).
- **Data Deletion** gained web's "Delete your account now" section wired to the existing
  `DeleteAccountModal` OTP flow; the screen previously dead-ended into a mailto.
- **Help Center is email-only on mobile** (owner instruction). Web still shows Call + WhatsApp.
- `VerificationPolicyScreen` has no in-app entry point **by design** — web comments its sidebar row
  out too (`app/dashboard/profile/layout.jsx`). Deep-link reachable on both.

---

## WORK PIPELINE — bookings · leads · quotes · refund requests · invoices · calendar · explore (Session A, 2026-07-31)

### ‼️ `apiClient.*` RESOLVES ERROR RESPONSES — `try { await mutate() } catch {}` IS DECORATION
`apiManager.tsx` returns the raw fetch `Response` for **every** status. `await SendEmailQuoteById(id)`
settles on a 500 exactly as it does on a 200, so a `try/catch` around it catches nothing and the
success toast + `*_success` analytics fire against a failed write. **18 call sites across bookings,
quotes, invoices and refunds shipped this way** — delete, send-email, status-change, mark-paid,
cancel and invoice create/update all reported success on failure.

**One guard, one idiom:** `src/Util/apiResult.ts` → `readApiResult(response)` returns
`{ ok, status, body, data, message, rateLimited, retryAfterSeconds }`, where
`ok = response.ok === true && body?.success !== false`. Every mutating call in the work pipeline goes
through it **before** any toast, state change, navigation or analytics event:

```ts
const result = await readApiResult(await deleteInvoice(id));
if (!result.ok) { Toast.show(result.message || t('INVOICES_SCREEN.TOAST_DELETE_FAILED'), Toast.LONG); return; }
```

`__tests__/workPipelineWriteGuards.test.ts` scans every owned source file and fails the build listing
any raw-Response mutation awaited outside a `readApiResult(...)` statement. Fix the call site, never
the test. It carries a matcher self-check so the scanner itself cannot silently stop discriminating.

### ‼️ `0001-01-01T00:00:00` IS TRUTHY — use `isUnsetBookingDate`
A booking with no schedule serialises `DateTime.MinValue`, so `booking.scheduledStartDateTime ? … : …`
took the **truthy** branch and rendered "Jan 1, 0001". Web has `utils/bookingDate.js`; mobile had no
equivalent, so the sentinel leaked into the detail header, the order-summary timeline, the booking
card and the confirm-gate. `src/Util/bookingDate.ts` mirrors web exactly (invalid **or** `year < 1970`
⇒ unset). The calendar additionally **filters** sentinel bookings out of the event list — plotting one
would drop an event on year 0001.

Also corrected: the mobile confirm-gates demanded `estimatedEndDateTime`, which is **optional** on both
platforms (web `AddBookingForm.jsx:322` says so explicitly). Providers were bounced into the form over
a field the form never requires.

### Analytics verbs are a cross-platform contract
`src/Util/bookingAnalytics.ts` → `bookingActionVerb(status)` reproduces web's `STATUS_TO_ACTION`
(`Confirmed→accept`, `Cancelled→cancel`, `InProgress→start`, `Completed→mark_complete`,
`Rejected→reject`, `PaidCash→mark_paid_cash`, else `set_<lowercase>`). Mobile previously emitted
`confirmed_init` and a single generic `status_changed`, so the two platforms could not be grouped in
the reader. `ActionStatusModal` now takes an `onFail` so `*_fail` fires with the real HTTP status.

**Route→surface map:** 12 registered routes were shipping `surface: undefined` on every PageView
because the map keys did not match the `<Stack.Screen name=…>` values —
`BookingScreen`, `BroadcastScreen`, `InvoicesScreen`, `InvoiceDetailScreen`, `CreateInvoiceScreen`,
`EditInvoiceScreen`, `AddBooking`, `AddQuotes`, `RefundRequests`, `ServiceDetails`, `SendQuote`,
`Quoteconfirm`. Appended, never reordered. `analyticsSurfaceRegistration.test.ts` pins this.

### Missing actions that are now built
- **Send booking on WhatsApp** — `POST bookings/{bookingId}/send-whatsapp` (web `BookingHeaderActions`
  offered it; mobile's share sheet had Email only). Wired on the booking **detail** share sheet and
  the booking **card** popover.
- **Send quote on WhatsApp** — `POST quotes/{id}/send-whatsapp`, same two surfaces.
- **Quote delete on the detail screen was FAKE**: `confirmDelete` showed `QUOTE_DELETED` and popped
  the screen **without calling any API** (`// implement actual delete API if available`, while
  `DeleteQuoteById` had existed all along). Now a real, guarded delete with a busy state.
- **Calendar ServiceId filter** — web's advanced sidebar has 4 fields, mobile's drawer had 3.

### Refund requests EXISTS — it is not a missing screen
`Screen/ProfileFlow/Booking/RefundRequestsScreen.tsx`, registered in `Booking-Route` **and**
`MyDashboard-Route`, deep-linked at `dashboard/refund-requests`. Brought to web parity: the
`dueSoon` (< 24 h) card border + badge, the `customerKey` fallback web has, the `noteOptional` label,
the `decisionBody` sentence naming the booking, stat cards visible even when the list is empty, a
real **error state with a retry** (a bare empty list read as "no refunds" on a network failure), and
a guarded `contactSupport` (it checked `response.ok` but not `success:false`).

### Calendar
Deliberately different from web's FullCalendar — **capability** parity only. `getBookingsByDateRange`
swallowed every failure and rendered an empty grid; there is now a load-error state with retry and an
empty state with an **Add booking** way out. `filteredEvents` was a `useMemo` that filtered nothing.
The `end !== start` "no end date" encoding is now one predicate (`hasBookingEnd`) instead of four
copies. Filter analytics now send `has_service` + `status_filter` like web.

### Dead code removed (nothing in `src/` imported any of it)
`Booking/actionMenu.tsx`, `Quotes/ActionMenu.tsx`, `Quotes/serviceAccording.tsx`, and two unreachable
modals in `Quotes/index.tsx` (nothing ever set `showImageModal`/`showAttachmentModal` true).
Attachment viewing stays reachable on the quote **detail**, same as web.

### ‼️ Two 100 ms polling intervals were feeding state nothing read
`AddBookingScreen`, `AddQuoteScreen`, `QuotesDetails` and `ConfirmationQuoteScreen` each ran
`setInterval(… i18n.isInitialized …, 100)` to set an `isInitialized` flag with no reader — a CPU leak
for the life of the screen. All four removed.

### Hook dependency arrays are a correctness gate, not style
Fixing `react-hooks/exhaustive-deps` honestly exposed three real hazards, each caught by `tsc` or by
reasoning **before** it shipped:
1. **TDZ** — naming a `const` declared *later* in the same component is a `ReferenceError` on device
   while Jest stays green. `fetchQuotes`, `validateForm`, `getBookingData`, `loadCountryList` and
   `fetchQuote` all had to be **hoisted** into `useCallback` above their consumers, not merely added.
2. **Infinite fetch loop** — `fetchInvoices`/`fetchQuotes` both *mutate* the paging cursor that sat in
   their own dep array. The cursor is a **ref** now (`skipRef`, `pageNumberRef`); adding the callback
   to a focus effect without that change would have looped forever.
3. **Duplicate mount requests** — `AddBookingScreen` and `AddQuoteScreen` each fetched services,
   offers and countries from a mount `useEffect` *and* from `useFocusEffect` (which also fires on
   mount). Three redundant requests per screen open, now one set.

Complex dep expressions (`serviceForms.map(…).join(',')`) are extracted to a named
`serviceFormsSignature` memo so the array is statically checkable.

## SESSION C — BUSINESS PROFILE & CATALOGUE, synced to partner web (2026-07-31)

Onboarding wizard · business info/address/service area/categories · manage service & price · availability ·
licence · portfolio · reviews · offers · share profile. **ESLint 154 → 0** in this column, `tsc` clean.

### ‼️ THE WIZARD ORDER IS NOT THE ENUM ORDER
The backend `OnboardingStep` enum reads *BusinessDetails → BusinessCategory → Services → ServiceArea →
Availability → Portfolio → BusinessAddress*. **The wizard does not.** Web
(`app/onboarding/page.jsx`) runs **1 BusinessDetails → 2 ServiceArea → 3 BusinessCategory →
4 ManageServicesPrice → 5 SetAvailability**; Portfolio and BusinessAddress are configured outside it.
Mobile's `AboutBusinessProfile` hub already matches the wizard. **Never re-order from the enum.**

### ‼️ i18next RUNS WITH THE DEFAULT `keySeparator: '.'`
A **flat** `"Profile.DataPrivacy.Title"` key is therefore never found when a nested `Profile` object
exists — the screen renders the raw key string. `Profile.DataPrivacy.*` was missing from all five
locale files, so the CCPA opt-out screen showed six literal key names. Keys under a dotted path must be
**nested**. `sessionCProfileCatalogue.test.ts` asserts both the nested block and the absence of flat
duplicates. (A stray flat `Profile.DataDeletion` still shadows nothing but is dead — see master-plan §8.)

### ‼️ A SCREEN WHOSE ONLY `navigate` CALL SITS IN A DEAD HANDLER DOES NOT EXIST
`ProfileScreen` carried 7 handlers that nothing rendered. Three of them were the **sole** route to a
real screen: `ChangeLanguage` (a provider could not change the app language at all after onboarding),
`DataDeletion` (web has it under Support) and `DataPrivacy` (the CCPA "Do Not Sell or Share" opt-out —
the same class of miss as the customer app's session-27 finding). All three now have menu rows.
**ESLint's `no-unused-vars` on a handler is a reachability signal, not style noise.**

### `priceType` IS NOT ONE VOCABULARY
The service forms write `"fixed" | "hourly" | "range"`. The **bulk-upload endpoint**
(`ServiceController.cs:944,993`) maps `Cost` by an `OrdinalIgnoreCase` compare against the entity's
canonical `"Fixed" | "Starting from" | "Hourly"` — a different set. Consequences, both live before this
session:
- `AddService` took `pricing.priceType` verbatim, so a bulk-uploaded **"Starting from"** service opened
  with **no cost type selected, no price field**, and saving wiped the price (`PricingMappingExtensions`
  full-replaces every price field). Fixed by `normalizePriceType()` on read, mirroring the server's own
  `StringFormattingExtensions.NormalizePriceType`.
- Mobile bulk upload offered only Fixed/Hourly and now offers all three, sending the **server-canonical**
  literals. ‼️ Web sends `"range"`, which matches nothing and stores a priceless service — master-plan §8.

### CLIENT-SIDE MEDIA LIMITS: `src/Util/mediaLimits.ts`
One mirror of the API's `StorageConfiguration` per-container caps, used by every upload strip
(`checkMediaFile` / `checkMediaCount` / `checkMediaBatch` / `mediaRejectionMessage`, copy in the new
top-level `MEDIA` locale section). What it corrected:
- Licence documents were rejected at **10 MB against a 20 MB platform limit** — three duplicated copies
  of the same guard, all with the wrong number.
- Service photos and portfolio images had **no size or type check at all**; the file uploaded to blob and
  then failed at confirm.
- The portfolio picker used `mediaType: "mixed"`, so a **video** could be chosen for an images-only container.
**Keep this file in step with `clinqetapi/Clinqet.API/appsettings.json → StorageConfiguration`.**

### THE UNCHECKED WRITES THIS COLUMN WAS CARRYING
`apiClient.*` resolves error envelopes — it only rejects on transport failure, so `try/catch` around a
mutation is decoration (`_STANDARDS` §8). Fixed:
- **Review reply submit / edit / delete** reported "Response submitted", fired `reply_submit` analytics
  and optimistically rendered the reply **on a rejected write**. Now gated on the app's ONE failure
  predicate, `isApiSuccess` (`Util/apiResult.ts`) — ‼️ do not add a second predicate; that duplication is
  the defect.
- **Offer delete** guarded on `if (result?.status)` — a number, **always truthy**. It emitted a `delete`
  event on failure and never told the provider. Now `result?.ok === true || result?.status === 404`.
- **Service-image confirm** (×2) and **licence-document confirm** were never read; the blob `PUT` result
  was never read either, so documents were confirmed against blobs that were never stored.
- **Seven save paths tracked `save_fail` and showed nothing** — tapping Save on a dead network did
  literally nothing visible. All now route through the shared `toastApiError` / `toastApiResponseError`.

### VALIDATION PARITY WITH `ManageServicesPrice/utils/validationUtils.js`
Mobile was missing four web rules: max cost must exceed the start cost, and visit charge / minimum
distance / distance charge must all be **> 0** (mobile only checked "non-empty", so `"0"` passed).

### STATES: A BARE EMPTY VIEW READS AS A FAILED LOAD
`ManageService` swallowed its load error and rendered the "add a business category first" empty state —
a provider with a flaky connection was told they had no categories. `Reviews` swallowed failed pages via
`Promise.all(...).catch(() => null)`. Both now carry a `loadError` state with web's copy and a Retry.
`ManageService`'s service-area fetch also **rethrew out of `useFocusEffect`**, aborting the whole load.

### DEAD WORK REMOVED (Dimension 11)
- The `isInitialized` + **100 ms `i18n.isInitialized` polling interval** existed in **14 screens** and was
  never read anywhere. Deleted from all of them; a spec fails if it comes back.
- `ManageService` fetched service areas on every focus and never read them.
- `AddService` read `provider/billing/tax-settings` during **onboarding**, where the tax card is replaced
  by the information card and the result can never be rendered (web guards on `entryContext`).
- `EditEmail`/`EditPhone` ran a second per-second state update (`elapsedTime`) nobody read.
- `AddServiceArea` held write-only `region`/`coordinates` state driving 4 pointless re-renders.

### HOOK DEPS ARE A CORRECTNESS GATE, NOT STYLE
24 `react-hooks/exhaustive-deps` errors were cleared by **hoisting each fetch into a `useCallback`
declared ABOVE its effect** — never by "adding the dep", which is a TDZ `ReferenceError` on device while
Jest stays green. `tsc` caught two real TDZs mid-refactor (`EditBusinessAddress.FetchBusinessAddressData`,
`AboutBusinessProfile.resetToBottomTabs`). `debounce()` (`Util/friendlyNameUtils`) gained `.cancel()`, and
`BusinessDetails` now holds ONE debounced instance for its lifetime — a re-created one abandons its
pending timer instead of cancelling it, so a stale availability check still fired.

### SMALLER PARITY FIXES
- `FRIENDLY_NAME_MAX` was enforced in `SetFriendlyNameModal` only; `BusinessDetails` (typing **and** the
  auto-fill from the business name) let a provider exceed the 20-char SQL column, 400-ing the availability
  check on every keystroke.
- An open-ended price range printed **"$500 – $0"**; web omits the upper bound when there is none.
- Cost-type pills rendered the raw wire value (`"Fixed"`, `"Hourly"`) as user-facing text.
- Service create/update showed **no success toast**; web does.
- `CreateProject`'s camera-permission dialog was hardcoded English.
- Dead code removed: a 35-line commented-out date-picker modal, the commented website row, the write-only
  accordion cascade in `AboutBusinessProfile`, and ~130 unused bindings.

### VERIFY
`npx tsc --noEmit` · `npx eslint <this column>` (0 errors) ·
`npx jest __tests__/sessionCProfileCatalogue.test.ts __tests__/sessionCGuards.test.ts` (73 tests) ·
`scratchpad/sabotage.js` — 8 cases, each must fail the **named** test and restore byte-for-byte.
‼️ Two of those eight did not bite on first run: one guard asserted a *variable name* (`const isGone =`)
rather than the predicate, so re-introducing the truthy check passed. **Assert the semantics, not the name.**

---

## SESSION B — communication, customers & insight (2026-07-31, provider-web sync)

**Ownership is sender IDENTITY, never `senderType`** — `src/Util/chatMessage.ts` is now the ONE module
for it (`isMessageFromViewer(msg, otherParticipantId)`), plus `isSystemChatMessage`,
`calendarDayDiff`, `formatChatDateLabel(+WithTomorrow)` and `canHideConversation`.
`ChatDetails` had `senderType === 'provider'` in BOTH the bubble side and the `ConversationRead`
handler, so a customer-type account messaging from the partner app rendered its own messages on the
wrong side and never got a read tick. `ChatList` now forwards `otherParticipantId` (and `status`) in
the navigation params, and the notification/CRM entry points hydrate it from the point-read.

- ‼️ **`Conversation` has NO `isBlocked` field** (checked `ConversationResponseDto`) — it is
  `status === "Blocked"`. Mobile read `conv.isBlocked`, so the blocked composer bar never appeared and
  a blocked thread let the provider type into a 400. Blocked state is derived from `status` now.
- ‼️ **A failed send used to DESTROY the message.** The composer clears text + files the instant it
  fires, and every failure path then removed the optimistic bubble. One `performSend` now serves the
  composer AND retry, marks `clientStatus:'failed'` (never removes), and the optimistic attachments
  carry `localFile` so retry re-uploads them — retry previously posted `attachments: []`, silently
  sending an empty message, and marked a 4xx as **sent** because only `!result` was checked.
- **Lead threads can be hidden again**: the header trash is direct-only, so a Broadcast conversation
  had no delete path at all. The kebab gained Hide behind the same `canHideConversation` gate as web.
- **Per-message report** shipped (`reportMessageApi` → `POST conversations/{id}/messages/{mid}/report`,
  probed 401 = real) via long-press on an incoming bubble.
- **Thread load failure** now has its own state + Retry; it used to render "Send a message to start
  the conversation", which reads as an empty conversation.
- `stickToBottom` replaced the `messages.length` effect that force-scrolled on EVERY change — loading
  older messages yanked the provider back to the newest.
- Dead "Clear chat" modal (its button did nothing, its entry point was commented out) deleted, with
  its four orphaned locale keys.
- `WhatsAppWindowBanner` gained `optedIn/optedOut/blocked` and mirrors the backend send rule
  (`!blocked && (windowOpen || optedIn)`); it used to promise WhatsApp delivery that would not happen.

**Customers (CRM):** `deleteWithUrl` resolves an error envelope, so a 403/404/500 reported a
successful delete, emitted the `delete` event and refetched; guarded now, with a busy state on the
modal. The list had a dead axios-shaped branch (`response.data.success` — always undefined) and no
failure state, so a 500 showed "No customers found". Added the error state + Retry, the
"Showing 1-N of M" line and create/update success toasts.

**Notifications:** TWO mount effects both fetched page 1 — one GET removed, plus an in-flight guard
that a filter change supersedes (a blanket guard would let the tab move while the old filter's
response repopulated the list). A `success:false` envelope now reaches the error state instead of
"All caught up".

**Insights:** the empty state gained web's upgrade card + the three action rows (services /
availability / AI assistant) — it was a dead end. Refocus no longer blanks a rendered page to
skeletons, and the 15s `Promise.race` timeout is cleared (it leaked one timer per visit).

‼️ **`t()` from `useTranslation` is a NEW function every render.** Naming it in the deps of a callback
that an effect depends on re-runs that effect forever. `fetchNotifications` and `fetchCustomers` read
their copy through a `tRef` instead. This surfaced as a 20s hang in a jest worker while the same spec
passed in-process — the loop is real on device too.

**Analytics:** `NotificationScreen:` and `Customers:` in the `analyticsTracker` surface map were
component FOLDER names, not route names, so the notifications list and the whole CRM reported
`surface: undefined`. Now `Notification` / `CustomersScreen` (+ Add/Edit), pinned by
`analyticsSurfaceRegistration.test.ts` (`SESSION_B_ROUTES`).

**Accessibility:** 33 icon-only controls across the column had no `accessibilityLabel`. All labelled
from the HANDLER (the gallery chevron is "Clear selection" while a selection is active, "Back"
otherwise; the recording button is Play/Pause by state), with `hitSlop` lifting sub-44 pt targets.
New keys in **all five** locale files.

**Specs:** `chatMessage.test.ts` (23), `chatSendFailure.test.tsx` (8), `customerListGuards.test.tsx`
(7), `notificationsListLoad.test.tsx` (6). 11 sabotages run, all caught, all files restored by SHA.
Verified: `tsc` clean in these files, `npx jest` 65 suites / 742 tests 0 failed 0 skipped, ESLint
**0 errors** across the column (was 32).

## Call Follow-ups: "Details sent" card (2026-07-31)

`SuggestedActionType.SharedDetails` — the receptionist sent the caller the provider's own public page (see `clinqet-voice-assistant`). Always `AutoCreated` + `Verified`, **never applicable**: no Apply/Dismiss, no confidence chip, no "Created on call" chip (nothing was created). Title `callFollowUps.detailsSent` / `CALL_FOLLOW_UPS.TYPE_SHARED_DETAILS`; payload rows `subject` + `channel`; `pageUrl` is hidden as a row and rendered instead as an EXTERNAL link ("See what they received" / `VIEW_WHAT_WAS_SENT`) — `target="_blank" rel="noopener noreferrer"` on web, `Linking.openURL` on mobile, so the provider can confirm exactly what the caller received. A service-page share also records a Pending `SendQuote` card, which keeps the existing "Open in editor" one-tap route.

### Session D — 2nd pass: the column finished (2026-07-31)

‼️ **i18next runs with the default `keySeparator: "."`, so a FLAT `"Profile.DataPrivacy.Title"` locale
key can NEVER resolve** — the screen renders the raw key. `Profile.*` blocks must be NESTED under a real
`Profile` object. Any tool that writes locales by top-level section name will recreate the flat form;
check flat-vs-nested before writing. Guarded by `__tests__/sessionCProfileCatalogue.test.ts`.

‼️ **The country picker was DEAD in `LoginWithPhone`, `RegisterScreen` and `Forget_password_phone`** —
`setShowPicker(true)` was called nowhere, so `loadCountryList` never ran; in the forgot-password screen
the whole modal was commented-out JSX. ~104 lines of dead cluster removed. **A `useState` whose setter is
only called from an unreachable handler is dead state, not configuration.**

‼️ **Silent-failure trio, all fixed:** the phone-login `catch` wrote `loginError` that was **never
rendered** (a network failure showed nothing at all); `NewPassword_Screen` rendered an `ErrorMessage`
slot whose setter was never called; and the **CCPA opt-out** (`DataPrivacy`) called the async
`setRestrictedDataProcessing` **without `await`** and set `saved = true` unconditionally — but it
resolves `null` when there is no consent record, so a compliance control reported "Saved" on a write
that never happened.

‼️ **`navigation?.goBack()` hides from a `navigation.goBack()` grep.** Two of the five double-pop sites
were missed on the first pass for exactly that reason; one carried the comment "Do NOT call state
updates after this", which described the bug rather than preventing it.

- **`hooks/useSingleFlight.ts`** now guards every OTP submit/resend. **`components/common/ConfirmDialog.tsx`**
  is the app's generic danger/confirm dialog (`ConfirmationModal.tsx` is booking-specific despite its name).
- **WhatsApp message alerts** (`communication-preferences/whatsapp-message-alerts`) is a SECOND toggle,
  separate from the master account opt-in. `WhatsAppMessageAlertsEnabled` defaults **true** on the DTO, so
  the client must read it as `!== false` — absent means ON.
- **Every icon-only control is labelled from its HANDLER, never its glyph** (a left chevron is "Back" in a
  header and "Previous" in a gallery). 31 were unlabelled. `CommonSwitch` gained `hitSlop` 12 +
  `accessibilityRole="switch"`; its 40×20 track is deliberate brand geometry.
- **`__tests__/sessionDConventions.test.ts`** is a standing source scan over the column: a11y labels,
  hardcoded copy, timer/listener teardown, commented-out JSX, `!![]`. Fix the call site, never the test.
- ‼️ **44 bare hex literals still have no dark-mode counterpart** (146 others are already
  `theme.isDark ? … : '#hex'` pairs) and **no screen has been run on a 390 pt device in either mode**.

**Verified:** tsc clean · jest **67 suites / 752 tests / 0 skipped** · **ESLint 106 → 0** across the whole
Session-D column · sabotage **8/8 guards bite**.

‼️ **Confidence badge is hidden for EVERY `AutoCreated` card** (`status !== 'AutoCreated' && typeof confidence === 'number'`). Mobile previously showed it whenever `confidence` was a number, so an AutoCreated card read *"Details sent · 100%"* — a score on a fact the receptionist actually performed is meaningless, and web had always hidden it via `!isAutoCreated`. The fix also corrects the pre-existing "Booking created" card. Pinned by `__tests__/sharedDetailsSuggestionCard.test.tsx` (5 tests, incl. the Pending card KEEPING its score). **Parity means matching the web component's RENDERING CONDITIONALS one by one, not just shipping the same component.**

## ‼️ 2026-07-31 (provider sync, session E) — ANALYTICS PARITY WITH PROVIDER WEB

Full detail lives in the `clinqet-analytics` skill; what matters when working in THIS app:

### The surface map is a testable invariant, in both directions
`src/services/analyticsTracker.ts` → `inferSurfaceFromPath`'s `screenMap` is keyed by **navigation
ROUTE name** (`AnalyticsProvider` sends the active leaf route as `pageUrl`), never by component
folder. **34 registered routes had no entry and were shipping `surface: undefined`; 11 keys were
dead.** Both are now zero and pinned by `__tests__/analyticsSurfaceRegistration.test.ts`, which
closes the map over EVERY route in both directions.

‼️ **Adding a `<Stack.Screen>` without a `screenMap` entry silently breaks attribution for that
screen — the PageView still fires, with no surface.** The spec will fail; add the entry in the same
change. Navigator containers (`BookingRoute`, `InboxRoute`, `BottomTabs`, …) take their initial
route's surface: `getActiveRouteName` recurses to the leaf, but a nested navigator has no state for
one frame and the container name surfaces then.

### Never invent a verb or a surface — web owns the vocabulary
Session E retired six mobile-only vocabularies (`approve*`, the whole `voice_*` funnel,
`rdp_toggle`, `whatsapp_enable/disable`, `portfolio_delete`, `save_success{mode:set_default}`) and
one double count (`onboarding_complete`). `__tests__/analyticsWebParity.test.ts` re-runs the
cross-platform diff inside jest and **fails the build** if any of them returns, if a new web pair
goes unmatched, or if a billing purchase verb appears (billing is out of scope — mobile's
`trackBilling → open_web_cta_click` plus the info-only Plan & Billing snapshot is the whole story).

### `useScrollDepth`
`src/hooks/useDwell.ts` now exports `useScrollDepth(surface)` alongside `useDwell`. RN has no window
scroll, so the caller wires the returned handler: `onScroll={onListScroll} scrollEventThrottle={16}`.
Each milestone (25/50/75/100) fires once per surface; an unscrollable list never fires. Live on
`booking_list`, `invoice_list`, `quote_list` and `lead_list` — the four lists web measures.

### Traps this app charges for, re-confirmed
- **`Share.share` RESOLVES with `dismissedAction` on cancel.** Gate any share event on
  `result.action === Share.sharedAction`.
- **An effect gated on async-loaded state fires first with the default.** `AIQuickSetupNudge` starts
  `visible = true` and reads its dismissal from AsyncStorage — gate the view event on a `loaded`
  flag or it reports a view of an already-dismissed nudge.
- **`components/ConfirmationModal.tsx` is NOT a shared confirm dialog** — it is
  `ConfirmBookingModal`, the quote→booking confirm. The shared one is
  `components/common/ConfirmDialog.tsx` (one call site today; it carries
  `confirm_open/yes/no` + a `surface` prop). The app's other ~15 confirmations are bespoke modals
  that emit their own domain `*_init` / `*` / `*_fail` — **do not also add `confirm_*` there, it
  double-counts one tap.**
- **The Explore tab is commented out** (`BottomNavigation-Route.tsx`), so `ExploreScreen`,
  `ServiceDetails`, `SendQuote` and `Quoteconfirm` are unreachable. They carry instrumentation and
  surfaces, but none of it can fire until the tab is restored.

---

## ‼️ 2026-07-31 (provider sync, session F) — THE NAVIGATION SPINE, AND WHAT LIVES IN THE JOINS

Session F integrated sessions A–E. They were green together on the first try; **every defect below
was pre-existing and survived five sessions because each audited its own column and nobody read the
joins.** Read this before touching `appNavigation/`, a notification route, or any logging on an auth
path.

### ‼️ Route names are matched by STRICT EQUALITY, and the linking config has two halves

`linking.ts` had `MydashboardRoute` (lowercase *d*) where the registered tab is `MyDashboardRoute`.
**Every dashboard Universal Link was dead** — ~40 paths (`dashboard/bookings/:id`, `/invoices/:id`,
`/leads/:id`, `/refund-requests`, all 25 `dashboard/profile/*`) produced a state naming a route no
navigator owns, so the tap opened the app on the dashboard instead of the record. Silently.

`deepLinking.test.ts` did not catch it: `linkingLeaves()` matches `Name: 'path'` **leaves** and skips
`Name: {` navigator **wrappers** — and the wrapper is where the typo was.
`__tests__/navigationSpine.test.ts` now validates every wrapper key against its **parent** navigator,
resolving `component={X}` → the imported `*-Route` module, so a renamed navigator fails the build.

### ‼️ `navigate()` bubbles UP ONLY — and the tabs are `lazy`

A screen registered only in a **sibling** tab stack can never handle a bubbled action: with
`lazy: true` + `freezeOnBlur`, an unvisited tab's navigator is never mounted, so it never registers
an action listener. React Navigation **dev-warns instead of throwing**, so a `try/catch` around the
call is decoration and the button is a silent no-op.

**Check reachability per stack, never the union.** A screen registered in three stacks passes a union
check on the strength of one. Six live buttons were no-ops from at least one tab —
`ManageService → SetAvailability`, `AddService → PaymentSettings`, `BusinessDetails →
PaymentSettings`, `GalleryUpload → CreateProject` ×2, `PlanAndBilling → VoiceAssistant` — plus every
row of the onboarding hub whenever it renders as the FAB tab.

### `src/Util/navigationTargets.ts` — the ONE way to open a screen that may live elsewhere

```ts
navigateToScreen(navigation, navigations.CHATDETAILS, { conversationId });   // returns false if it could not
```
Reachability-first (walks `getParent()`), then falls back to the fully qualified root-anchored path
(`BottomTabs > InboxRoute|MyDashboardRoute > screen`), and **refuses to navigate when the tab shell is
not mounted** so the dashboard is never pushed over the login screen or a half-finished wizard.

Before this there were **five** private implementations of the same idea and **two were broken**:
`InAppNotificationBanner` and `pushNotificationService` both did a flat `navigate(screen)` off the
root ref, so a `DirectMessageReceived` banner tap did **nothing at all** until the Inbox tab had been
opened once. `useWhatsAppOutreach` already carried a comment describing that exact failure — the fix
had simply never reached the other call sites. **The second copy is where the guard goes missing.**

### ‼️ A raw `console.*` is not `__DEV__`-gated and does not redact

`refreshToken.tsx` printed `JSON.stringify(result)` — **the rotated access + refresh token, in
plaintext, in release builds** — one line below a `secureLogger.debug` saying the same thing. All 12
`console.log` in that file were redundant twins of an adjacent secure call.
`deviceTokenService.ts` logged the push device token the same way, with no `secureLogger` at all.

**On any auth / session / credential path: `secureLogger` or nothing.**
`__tests__/secureLoggingConvention.test.ts` fails the build on a raw `console.*` in
`refreshToken.tsx`, `deviceTokenService.ts` or `tokenManager.ts`, and asserts `sanitizeData` really
redacts a token pair, a push payload and a bare JWT.

### The param lists were fiction — and that is what makes a wrong `navigate()` typecheck clean

`appNavigation/types.ts` declared **6 screens no navigator registers** and omitted **13 real ones**;
`BottomTabParamList` invented `CalendarRoute`/`ExploreRoute`, omitted `BookingRoute`/`BroadcastRoute`
and misspelled `BusinessProfile`. Same lie one level down: `ChatDetails` declared an `isBlocked`
route param **the screen never reads** (it derives blocked from `status === "Blocked"`), and one
caller filled it from `conv.isBlocked`, a field `ConversationResponseDto` does not have.
All seven param lists are now exact in both directions, test-enforced.

### One idiom per concept — what is canonical here

| Concept | The one implementation |
|---|---|
| Currency | `Util/currency.formatCurrencyAmount` — **not** a local `formatAmt`/`formatAmount` (there were four byte-identical copies in Invoices plus a fifth in `ManageService`) |
| Dates / times | `Util/locale.formatLocalizedDate` / `formatLocalizedTime` — region **and** language aware. Never `toLocaleDateString(undefined, …)` (that is the DEVICE locale) and never a hardcoded tag (`"en-GB"` shipped a UK date to every provider in Canada and India) |
| API failure | `Util/apiResult.readApiResult` / `isApiSuccess` |
| Cross-stack navigation | `Util/navigationTargets.navigateToScreen` |
| Logging on an auth path | `Util/secureLogger` |

### Things that look like defects and are not
- **`SUMMARY_NO_PRICE_TEXT` "missing" from `en.json`** — it is an i18next **plural** key stored as
  `_one`/`_other`, and `i18n.ts` sets `compatibilityJSON: 'v4'`, which resolves it. A key scanner
  that does exact lookup will false-positive on every plural.
- **`es.json` is authored in full but not loaded.** `i18n.ts` registers only `en/fr/gu/hi`, and
  `useSupportedLanguages` derives the picker from that same object — so Spanish is consistently
  hidden. Keep `es.json` at parity anyway; the locale-parity specs cover all five.
- **The chat emoji picker** (`ChatDetails`) is the one legitimate raw-emoji block in the app.

### Removed as dead — do not re-add
`appNavigation/Register-Route.tsx`, `appNavigation/Calendar-Route.tsx`,
`Screen/ProfileFlow/ImageFullScreen/` (a registered but unreachable stub rendering a hardcoded
placeholder photo, with three buttons that had no `onPress`; portfolio viewing is
`GalleryUpload/components/ImagePreviewModal`), the root-level duplicate `MydashboardRoute` stack
registration in `App.tsx`, and 317 commented-out code lines across 69 files.

### Still open (owner items, recorded in the programme's MASTER-PLAN §8)
- **126 icon-only controls still have no `accessibilityLabel`** (35 were labelled from their handler
  using keys that already exist in all five locales). A wrong screen-reader label is worse than a
  missing one — these need real copy in five languages.
- **Nothing in this app has been rendered on a 390 pt device in light and dark**, by any session.
  ~250 off-palette hex literals remain, 44 with no dark-mode counterpart.
- **Explore is built, instrumented and unreachable** — and not ready to mount: `ExploreScreen` has no
  loading, empty or error state. Prefer a FAB-menu row over a sixth bottom tab.
- **`BusinessProfile` names two destinations** (the onboarding hub and the FAB tab) while the
  dashboard stack registers the same component as `BussinessProfile`.

---

## ‼️‼️ `fetchWithAuth` FORCE-LOGS-OUT ON ANY 403 — a live hazard for tenancy screens (found 2026-08-03)

`src/apiManager/apiManager.tsx:186`:

```ts
if (response.status === 403) { await forceLogout(); return response; }
```

That is correct for an authentication failure and **wrong for a domain refusal**. Every multi-user
tenancy refusal is a 403:

`permission_denied` · `primary_owner_protected` · `ownership_transfer_invalid` · **`step_up_required`** ·
`invitation_identity_mismatch` · `business_context_stale` · `resource_out_of_scope` · `billing_only_access`

So a mobile tenancy screen shipped over this client means **a mistyped ownership-transfer password signs
the owner out of the app** — the exact opposite of what the design promises (step-up deliberately does not
touch the platform lockout counters so a fat-fingered password cannot lock the owner out).

**Fix before any mobile tenancy screen ships**, in the shape of the existing `isAuthExemptUrl`: a URL
predicate covering `/business/members`, `/business/team/`, `/business/access`, `/business/branches`,
`/business/teams`, `/business/inbox`, `/business/activity`, where a 403 is a **domain answer, not an auth
failure**, and is returned to the caller untouched. The web `apiClient` already behaves this way.

**Write a test that proves a 403 on `/business/members` does not log out.** Without one this regresses
silently — a forced logout looks like a session expiry, not like a bug.

## Multi-user tenancy screens — NOT YET BUILT (Phase 8 Part A)

Provider web has the foundation (`clinqetwebpartnerapp/src/lib/tenancy/renderingRules.js` and
`src/components/tenancy/`); mobile has nothing yet. When building it:

- `src/lib/tenancy/renderingRules.ts` must be a **line-for-line twin** of the web module, and
  `__tests__/tenancyRenderingParity.test.ts` must run BOTH through one fixture table and fail the build on
  any divergence — the established pattern is `__tests__/analyticsWebParity.test.ts`, which reads the web
  source from disk. Parity means matching the **rendering rules**, not shipping a same-named component.
- Localization keys are **NESTED** here: i18next's default `keySeparator` is `.`, so a flat
  `"Team.Status.Active"` key is **unreachable**.
- ‼️ Route name casing must match exactly, and reachability must be checked **PER STACK, never the union** —
  one character (`MydashboardRoute` vs `MyDashboardRoute`) has killed a whole dashboard's deep links here.
- The invitation universal link must land on the acceptance screen, and **the token must never be logged**.

---

## ‼️ Phase 8 Part A is COMPLETE (2026-08-03) — the note above about it being partial is superseded

Every Part A screen shipped in **both** provider apps, in five languages, with a build-failing
cross-platform parity spec. Additional endpoints built because the approved mockups needed them and
nothing served them: `GET /business/members/seats`, `GET /business/members/roles` (primary-owner role
excluded — L19), `GET /business/members/{id}/removal-impact`.

‼️ **The provider MOBILE 403 hazard is FIXED.** `apiManager.tsx` no longer force-logs-out on a 403 from
the tenancy surface (`isDomainForbiddenUrl`), because every tenancy refusal is a 403 and a mistyped
ownership-transfer password would otherwise have signed the owner out.
`__tests__/tenancyForbiddenIsNotLogout.test.ts` locks it down — **add every new tenancy URL to that list.**

‼️ Mobile source rules enforced by `sourceLocalizationIntegrity`: format dates through `getActiveLocale()`,
never bare `toLocaleDateString()`; and **never** `t(key, { defaultValue: 'English' })`.

‼️ A single `defaultMessage` shared across a switch renders the WRONG string when a bundle is missing —
`<FormattedMessage id={status.key} defaultMessage="Active" />` rendered a closed account as Active.

---

### 14.3 ‼️ CORRECTED 2026-08-03 — the membership list now carries UNENTERABLE workspaces

§14.3 above described `GetActiveMembershipsAsync` returning only enterable workspaces. **That method no
longer exists.** It is `GetMembershipsAsync`, and it returns every workspace the person HOLDS:

| Situation | In the list? |
|---|---|
| Active membership, active/onboarding business | ✅ `CanEnter = true`, `AccessScope = Full` |
| Suspended business, the PRIMARY OWNER | ✅ `CanEnter = true`, `AccessScope = BillingOnly` (D9) |
| **Suspended business, anyone else** | ✅ **`CanEnter = false`**, `AccessScope = null`, reason `Error_BusinessSuspended` |
| **Suspended MEMBERSHIP** | ✅ `CanEnter = false`, reason `Error_BusinessMembershipSuspended` |
| **Closed business** | ✅ `CanEnter = false`, reason `Error_BusinessClosed` |
| Removed membership · Invited (unaccepted) | ❌ filtered **in SQL** — a removed membership must stay indistinguishable from "no such business", and an invitation is not a workspace you hold |

‼️ **`AccessScope` is NULLABLE and null exactly when `CanEnter` is false.** `default(BusinessAccessScope)`
is **`Full`**, so a non-nullable scope on an unenterable row would advertise full access.

‼️ **The list is NOT self-filtering.** Anything SELECTING a workspace from it must filter on `CanEnter`
itself — `IssueSessionAsync` does, and `IssueSession_WhenTheOnlyWorkspaceCannotBeEntered_MintsNoBusinessContext`
proves it. `ResolveBusinessContextAsync` is unchanged and remains the only authorization gate.

**Cost: unchanged.** `ProjectMemberships` always materialised every non-Removed row and `Classify` always
ran in memory over them, so this was a projection filter, never a query filter.

‼️ **Do NOT add a `None` member to `BusinessAccessScope` without first converting
`RequiresPermissionAttribute.cs:80` and `NotificationRecipientResolver.cs:240`** from `== BillingOnly` to
positive `== Full` checks — otherwise `None` falls into the permissive branch and is *less* restrictive
than `BillingOnly`.

---

## THE SHARED INBOX AND THE NOTIFICATION SETTINGS ON MOBILE (Phase 8 Part B2, 2026-08-04)

Provider mobile carries the **full** Part B2 surface — not a subset. Parity is the RENDERING RULES, and it is
enforced by a build-failing spec.

### Where things are

| Path | What |
|---|---|
| `src/Screen/InboxTab/ChatList/index.tsx` | The queue: tab strip, context chips, banners, marks, row action. **Extended, not duplicated** |
| `src/Screen/InboxTab/ChatDetails/index.tsx` | The thread: the three composer states, the claim refusal, the own-thread actions |
| `src/components/tenancy/InboxPanels.tsx` | Every shared inbox piece |
| `src/components/tenancy/ReassignSheet.tsx` | The hand-over sheet — fetched **only when it opens** |
| `src/components/tenancy/NotificationSettingsPanels.tsx` | Routing · my notifications · §14.8 team activity |
| `src/Screen/ProfileFlow/Team/NotificationRoutingScreen.tsx` | Business routing, reached from the Team header |
| `src/lib/tenancy/renderingRules.ts` | ‼️ The line-for-line twin of the web rules — **39 exports** |
| `src/lib/tenancy/localizationKeys.ts` | `tenancyKey()` — the ONE mapping from web ids to nested i18next keys |

### ‼️ The specs that fail the build

| Spec | Guards |
|---|---|
| `__tests__/tenancyRenderingParity.test.ts` | **162 cases.** Runs the WEB rules module in a `vm` sandbox against the mobile one. It also asserts **every exported rule and constant is covered**, so a new rule with no fixture fails the build. It THROWS rather than skipping if either file grows an `import` |
| `__tests__/tenancyLocalizationKeys.test.ts` | Resolves **every id the rules can return** through `tenancyKey()` against `en.json`. A new rule cannot ship unlocalized |
| `__tests__/tenancyForbiddenIsNotLogout.test.ts` | 22 cases. A 403 on any tenancy URL returns to the caller; an unrelated 403 still signs out |
| `__tests__/deepLinking.test.ts` | Every path the association files claim routes to a real screen |
| `__tests__/analyticsSurfaceRegistration.test.ts` | Every registered route has a `screenMap` entry |

### ‼️ Four traps this surface already paid for

1. **`isDomainForbiddenUrl()` is not optional.** Every tenancy refusal is a 403 and `fetchWithAuth`
   force-logs-out on any 403 it does not recognise. `/business/inbox` and `/business/notifications` are both
   listed; **a new tenancy endpoint must be added there in the same change.**
2. **A new WEB dashboard route strands the mobile app.** `/dashboard/team/notifications` failed
   `deepLinking.test.ts` the moment it existed. Register the screen in `linking.ts`, `types.ts`, the stack
   **and** `analyticsTracker`'s `screenMap`, or PageViews report `surface: undefined`.
3. **`Toast.show(message, duration)` — it is NOT `{ type, text1 }`.** `message` is typed `unknown`, so an
   object-shaped call type-checks and renders `[object Object]`.
4. **A jest mock that returns a fresh object per render HANGS the suite.** `useBusiness()` mocked as an object
   literal re-creates its function identities every render ⇒ new `fetchConversations` ⇒ `useFocusEffect`
   re-fires ⇒ infinite loop, with no failure message. Mock it as ONE stable object, like the real memoized
   provider. **A hang is not a pass.**

### Localization

`src/Locales/{en,es,fr,hi,gu}.json` — **4,401 nested keys each, all five identical**, namespaces
`SHARED_INBOX` and `NOTIFICATION_SETTINGS`.

‼️ **They are GENERATED from the provider-web catalogs**, so the two apps physically cannot say different
things. The conversion maps flat ids to nested SCREAMING_SNAKE, `{x}` to `{{x}}`, and splits inline ICU plurals
into `_one`/`_other` — **mobile forbids inline ICU**, and `localeParity.test.ts` fails the build on one.

‼️ `toLocaleDateString()` with no argument fails `sourceLocalizationIntegrity` — format through
`getActiveLocale()`. And `t(key, { defaultValue: 'English' })` fails it too: **no English fallback in mobile
source, ever.**

### What the list reads

**`getInboxView({ view, page, pageSize, context, signal })`** from `src/services/tenancyService.ts` — one
request carrying the rows AND all six tab counts. ‼️ **Keep the `AbortController` timeout**: it bounds the whole
round trip, and without it a stalled connection holds the shimmer forever — the regression
`__tests__/inboxListLoading.test.tsx` exists to prevent.

---

## ‼️ LOCATIONS — the provider-mobile mirror (PHASE 8 PART C — PROVIDER, 2026-08-04)

**BR-1: every string a provider reads says LOCATION, never *branch*.** The wire keeps the schema's word.

### The screens

| Screen | File | Route |
|---|---|---|
| Locations list + add / rename / staff / close / delete sheets | `src/Screen/ProfileFlow/Locations/index.tsx` | `navigations.LOCATIONS` = `Locations` |
| Per-location hours | `src/Screen/ProfileFlow/Locations/LocationHoursScreen.tsx` | `navigations.LOCATIONHOURS` = `LocationHours` |
| The tab strip that hands off to it | `src/Screen/completeProfileFlow/SetAvailability/index.tsx` — extended |
| The location chips on the area form | `src/Screen/completeProfileFlow/AddServiceArea/index.tsx` — extended |
| The one entry link | `src/Screen/ProfileFlow/EditManageServiceArea/index.tsx` — extended |

### ‼️ THE rule: a provider with ZERO locations must never see the word — anywhere

The single gate is `showsLocations(activeCount) >= 2` from `src/lib/tenancy/renderingRules.ts`. Reuse it.
‼️ **One open location plus one CLOSED one is a ONE-location business** for every show/hide decision.
BR-2: the Locations screen is reachable at zero but **unadvertised** — no menu item, one footer link on the
service-area screen that asks the question without naming the noun.

### ‼️ The rendering-rules block is GENERATED — do not hand-edit it

`src/lib/tenancy/renderingRules.ts`'s locations block is derived from
`clinqetwebpartnerapp/src/lib/tenancy/renderingRules.js` and proved by a **round-trip diff**: strip the
TypeScript annotations back out and it must equal the web source character for character. **Edit the WEB file
and regenerate.** `__tests__/tenancyRenderingParity.test.ts` fails the build if any of the 55 rules diverges or
loses its fixture.

‼️ **A helper whose declared return type is bare `any` gives its callers no contextual type**, so every
`.filter(cb)` on the result is an implicit-any error under `strict`. The array-returning rules are annotated
`: any[]` for exactly that reason.

### ‼️ Localization is DERIVED from the web catalogs (B17) — never hand-authored

The `LOCATIONS` namespace is generated from `clinqetwebpartnerapp/public/lang/*.json`: flat ids →
nested SCREAMING_SNAKE, `{x}` → `{{x}}`, inline ICU plurals split into `_one`/`_other`. Adding a mobile key by
hand drifts from the web catalog and `tenancyLocalizationKeys.test.ts` will fail.

‼️ **i18next supports exactly ONE count per key**, so a two-plural string cannot exist here at all. The
generator refuses one **by name** rather than half-converting it. `LOCATIONS.ROW_COUNTS` interpolates
`ROW_AREA_COUNT` and `ROW_STAFF_COUNT`, already formatted.

‼️ **Resolve every rule-returned id through `tenancyKey()`** (`src/lib/tenancy/localizationKeys.ts`, which now
maps `Locations → LOCATIONS`). **Never do string surgery on the key** — an earlier hand-rolled version produced
`LOCATIONS.Error_InUse` instead of `LOCATIONS.ERROR_IN_USE`, which renders a raw key in exactly the states
nobody looks at. For action labels use an EXPLICIT map, not a derived key.

‼️ **`COMMON.SAVE` does not exist.** Use `LOCATIONS.SAVE` / `LOCATIONS.CANCEL` (derived from web's
`button.Save` / `button.Cancel`).

### ‼️ The two hours rules

1. **An empty location tab means "same as all locations", NEVER closed.** The screen prints those literal words
   AND the inherited schedule (`weekSummaryText`). An empty grid there reads as closed and would shut every
   uncustomised location.
2. **Toggling "same hours" OFF does not clear the grid** — the server already returned the inherited week, so it
   is ALREADY a filled copy of the business hours. Two edits, not fourteen.

### ‼️ Navigation obligations — FIVE files, not four

A new provider-web `/dashboard/**` route is a mobile deep-link obligation. Register in the SAME change:
`appNavigation/linking.ts` · `appNavigation/types.ts` · the stack in `MyDashboard-Route.tsx` ·
`services/analyticsTracker.ts`'s `screenMap` (a route missing there reports `surface: undefined` on every
PageView).

‼️ **And the fifth: `SetAvailability` is registered in TWO stacks** (`MyDashboard-Route` and
`AboutBusiness-Route`), so `LocationHours` had to be registered in BOTH — plus its entry in
`AboutBusinessStackParamList`. A target present in only one stack makes the tap a **silent no-op** from the
other. `navigationSpine.test.ts` caught exactly this. **Check reachability PER STACK, never the union.**

### ‼️ `isDomainForbiddenUrl` — a 403 here must never sign the provider out

`/business/branches` was already covered; **`/business/availability` and `/business/service/areas` were NOT**,
and both are `[RequiresPermission]`-gated — so a Technician holding `availability.read` without
`availability.manage` was **force-logged-out by tapping Save on the hours screen**. Any new location endpoint
needs the same treatment, and `tenancyForbiddenIsNotLogout.test.ts` locks it.

### Refresh, not push

‼️ **B15 (owner-decided, 2026-08-04): there is NO realtime push for provider list changes**, by decision. The
Locations list refreshes on **focus/foreground**, exactly like the shared inbox. Do not build a push and do not
report its absence as a gap.

### Traps

- ‼️ **A test mock returning a FRESH object per render spins forever.** `useBusiness()` must return ONE stable
  object, as the real provider does — otherwise `load` changes identity, `useFocusEffect` re-fires, and jest
  hangs or times out with no useful message.
- ‼️ **jest hoists every `jest.mock` factory above the file**, so a fixture a factory reads must be
  `mock`-prefixed or it is still in its temporal dead zone.
- `Util/locale` reaches AsyncStorage through `regionService`, which has no native module under jest — mock it,
  but **reimplement the Intl formatters rather than stubbing them away**, or the schedule text under test
  disappears.
- **`Toast.show` takes `(message, duration)`**, not an object.
- **No English fallback anywhere** — no `defaultValue`, no bare `toLocaleDateString()`.
- **`!![]` is true**; `serviceAreaIds` / `membershipIds` are always present and usually empty. Use length.

---

## ‼️ PHASE 8 PART D (2026-08-04) — THE ACTIVITY FEED MIRROR, and the one screen family that was UNREACHABLE.

**New screen `src/Screen/ProfileFlow/Activity/index.tsx`, registered as `Activity` in the MyDashboard stack.**

### ‼️‼️ THE FINDING: the whole mobile TEAM surface had no entry point

`TeamScreen` — and with it `TeamMemberDetail`, `TeamInvite`, `OwnershipTransfer` and
`NotificationRouting`, every one of which is reachable only from it — was registered in
`MyDashboard-Route.tsx` **and** in `linking.ts`, but had **no `navigate()` call anywhere in `src`**. On a
phone there is no URL bar, so Part A's and Part B2's entire mobile team work was Universal-Link-only.

`ProfileScreen` now carries a **Team** row (`team.read`) and an **Activity** row (`audit.read`).
‼️ **When you add a screen, grep for a `navigate()` to it. Registration is not reachability.**

### ‼️ Activity is a STACK screen, not a sixth bottom tab (AD5)

The tab bar already carries five slots including the FAB; a sixth is unreadable at 390 pt. The mockup's
four-tab phone frame is stylised. Every tenancy screen in this programme ships as a MyDashboard stack screen.

### ‼️ The rules twin is GENERATED, not hand-written (CP12, extended by Part D)

The activity block in `src/lib/tenancy/renderingRules.ts` is **derived from the web file** and proved by a
**round-trip diff**: strip the TypeScript annotations back out and it equals the web source character for
character. All 15 annotations live in ONE table so the stripper reverses exactly what the generator wrote.
**Edit the WEB file and regenerate.** A hand-edit will be reverted by the next regeneration, and the
build-failing `tenancyRenderingParity` spec (286 cases, all 64 exports fixture-covered) will catch a divergence.

‼️ **The generated block carries ~60 quote-style ESLint WARNINGS on purpose** — it is byte-identical to the web
source, which uses double quotes. Do not "fix" them; that breaks the round trip. 0 errors is the gate.

### ‼️ The rest

- **`/business/activity` was ALREADY in `isDomainForbiddenUrl()`** (Part A included it), so a 403 there is a
  domain answer and cannot force-log-out a Technician. Never remove it.
- **The five-file navigation obligation**: `constant.tsx`, `types.ts`, `linking.ts`, the stack, **and**
  `analyticsTracker`'s `screenMap` (`Activity → business_activity`, matching provider web's surface name).
- ‼️ **`theme.primary`, `theme.card`, `theme.text`, `theme.chipBg` and `theme.infoSoft` DO NOT EXIST.** The
  real vocabulary is `brandBlue` / `onBrandBlue` / `brandGreenSoft` / `surface` / `textPrimary` /
  `textStrong` / `textSecondary` / `glass` / `warningSoft`, plus the `space` / `radius` / `font` scales.
- ‼️ **A test mock of `useBusiness()` must return ONE STABLE OBJECT.** A fresh object per render gives `load` a
  new identity, `useFocusEffect` re-fires forever, and jest hangs with no message. Third occurrence.
- ‼️ **Time sits INLINE in the metadata row, not in a right-hand column** — the mockup's explicit 390 pt
  decision, and a deliberate difference from provider web. It is not a parity break: parity is the RULES.
- **Localization: 49 new nested leaves × 5 bundles → 4,564 each**, GENERATED from the web catalogs (B17) and
  verified value-by-value. `tenancyKey()` gained `Activity → ACTIVITY`.

---

## ‼️ MULTI-USER TENANCY — PHASE 9 (2026-08-04). The mobile mirror is COMPLETE. Three hazards live here.

> **The whole model is now one skill: read `clinqet-provider-teams` before any tenancy change.**

**Phase 9 changed ZERO frontend files** — proven by mtime, not asserted. ESLint reports **0 errors**
(pre-existing style warnings unchanged in kind). This section closes the mobile tenancy story.

### ‼️‼️ HAZARD 1 — a 403 must NEVER sign the provider out

`src/apiManager/apiManager.tsx` calls `forceLogout()` on **any** 403 it does not recognise as a domain
answer. **Every tenancy refusal is a 403** — `permission_denied`, `primary_owner_protected`,
`ownership_transfer_invalid`, **`step_up_required`**, `invitation_identity_mismatch`,
`business_context_stale`, `branch_in_use`, `billing_only_access`.

Shipping the tenancy screens over that client meant **a mistyped ownership-transfer password would have
signed the owner out of the app** — the exact opposite of the guarantee that step-up deliberately does
**not** touch the platform's lockout counters (L110).

Fixed with **`isDomainForbiddenUrl()`**, a URL predicate in the shape of the existing `isAuthExemptUrl`.
It now covers `/business/members` · `/business/team/` · `/business/access` · `/business/branches` ·
`/business/teams` · `/business/inbox` · `/business/activity` · `/business/notifications` ·
**`/business/availability`** · **`/business/service/areas`**.

‼️ **ADD EVERY NEW TENANCY URL TO IT IN THE SAME CHANGE**, and to
`__tests__/tenancyForbiddenIsNotLogout.test.ts` — **29** URLs plus one deliberately **unrelated** 403 that
must still sign out.

**Two of these were live defects, not hypotheticals.** The ownership-transfer one was caught before
shipping; **CP10** was worse — a **Technician holding `availability.read` without `availability.manage`
was SIGNED OUT of the app by tapping Save on the opening-hours screen.**
‼️ **The web `apiClient` already gets this right** and rejects a 403 to the caller without logging out.

### ‼️‼️ HAZARD 2 — a screen can be registered, deep-linked, and STILL unreachable

**The entire mobile team surface shipped UNREACHABLE across two parts.** `TeamScreen` — and therefore
`TeamMemberDetail`, `TeamInvite`, `OwnershipTransfer` and `NotificationRouting`, **all of which are
reachable only from it** — was registered in the stack **and** in `linking.ts` but had **no `navigate()`
call anywhere in `src`**. On a phone there is no URL bar, so a **Universal Link was the only way in**.

Fixed by giving `ProfileScreen` a **Team** row (`team.read`) and an **Activity** row (`audit.read`).
‼️ **This is the THIRD time this programme has found a screen that exists but cannot be opened** — SEO
session 7's dead iOS entitlement, Session F's `MydashboardRoute` casing, and this.

> ‼️ **When you add a screen, grep for a `navigate()`/`href` to it — and check reachability PER STACK,
> never the union.** `SetAvailability` lives in **TWO** stacks, so `LocationHours` had to be registered in
> `AboutBusiness-Route` too, or the tab tap was a **silent no-op** from the onboarding wizard.

### ‼️ HAZARD 3 — a new screen is a FIVE-FILE registration

`appNavigation/constant.tsx` · `types.ts` · `linking.ts` · the owning `*-Route.tsx` · **and
`services/analyticsTracker.ts`'s `screenMap`.**

‼️ **A registered route missing from `screenMap` reports `surface: undefined` on EVERY PageView** —
Session E's finding, still live, and it recurred on every tenancy screen. Surface names deliberately match
provider web's route names (`Activity → business_activity`) so a cross-platform funnel is **ONE name, not
two**.

‼️ **A new WEB route under `/dashboard/**` is a MOBILE deep-link obligation.** The association file claims
every such path, so `/dashboard/team/notifications` would have opened the app on a **blank stack** —
`deepLinking.test.ts` failed immediately.

‼️ **Placement matters too.** A `WorkspaceGate` wrapped around `<Stack.Screen name="BottomTabs">` in
`App.tsx` broke `navigationSpine`'s rule that a nested-navigator screen's component must be a `*-Route`
module. Moved **inside** `BottomNavigation-Route.tsx` — better placement anyway, since the gate belongs
with the navigator it gates. And **Activity is a MyDashboard STACK screen, not a sixth bottom tab**
(**AD5**): the bar already carries five slots including the FAB, and a sixth is unreadable at 390 pt.

### The mirror: what exists here

`lib/tenancy/{renderingRules,localizationKeys,permissionGroups,weekSummaryText}.ts` ·
`components/tenancy/{InboxPanels,NotificationSettingsPanels,ReassignSheet}.tsx` ·
`context/BusinessProvider.tsx` · `components/WorkspaceSwitcher.tsx` · `services/tenancyService.ts` ·
`services/serviceAreaLocationService.ts` ·
`Screen/ProfileFlow/Team/{index,MemberDetailScreen,InviteMemberScreen,OwnershipTransferScreen,InvitationAcceptScreen,NotificationRoutingScreen}.tsx` ·
`Screen/ProfileFlow/{Activity,Locations}/` · `ChatList` + `ChatDetails` **extended, never duplicated** ·
`NotificationScreen` with the two per-business panels **above** the platform-wide card.

### ‼️ `renderingRules.ts` is GENERATED from the web file

**64 exports, byte-for-byte identical behaviour.** The newer blocks are **generated and proved by a
round-trip diff** (**CP12**): strip the TypeScript annotations back out and the result must equal the web
source **character for character**. The generator holds all annotations in ONE table so the stripper
reverses exactly what it wrote. **Edit the WEB file and regenerate — hand-editing this copy will be
reverted.**

‼️ **The generated block carries ~60 quote-style ESLint warnings *because* it is byte-identical to the web
source by design.** That is not drift; it is the proof. `tsc --noEmit` is clean.

`__tests__/tenancyRenderingParity.test.ts` is **build-failing**: **286** cases covering every exported rule.

‼️ **A sabotage that bites in ONE app is a finding about your TESTS**, and the escalated form is the real
test: breaking `activityActor` on the web failed 1 web test + 1 parity case, and applying the same break to
the mobile twin (as a regeneration would) **also failed the mobile SCREEN test** — proving the screen
genuinely drives the pill **through** the rule rather than around it.

### Localization — **4,564** nested i18next keys × 5 bundles

‼️ **GENERATED from the web catalogs** (**B17**) by a script that re-parses and diffs every file, so the two
apps **physically cannot say different things**. Flat react-intl ids → nested SCREAMING_SNAKE,
`{x}` → `{{x}}`, inline ICU plurals split into `_one`/`_other`. It proves identical key sets, zero
surviving ICU, zero single-brace placeholders, zero placeholder drift and zero empty values.

- ‼️ **i18next supports exactly ONE count per key**, so `"{areas, plural…} · {staff, plural…}"` is
  **inexpressible** here. The generator **REFUSES a two-plural string BY NAME** rather than
  half-converting it; the two count PHRASES become their own keys, composed at the render site (**CP11**).
- ‼️ **`tenancyKey()` (`lib/tenancy/localizationKeys.ts`) is the ONE mechanical id translation**, and
  `__tests__/tenancyLocalizationKeys.test.ts` resolves **every id the rules can return** — **127** checks.
  My first hand-rolled string surgery produced `LOCATIONS.Error_InUse` instead of `LOCATIONS.ERROR_IN_USE`,
  which would have rendered a **raw key in exactly the states nobody looks at**. Use `tenancyKey()`.
- ‼️ **`sourceLocalizationIntegrity` forbids `t(key, { defaultValue: 'English' })` — no English fallback in
  mobile source, EVER** — and requires dates formatted through **`getActiveLocale()`**, never a bare
  `toLocaleDateString()`. Both caught real files.
- ‼️ **`COMMON.SAVE` DOES NOT EXIST** in these bundles. Two screens used it and would have rendered a raw
  key; the only two call sites in the whole app were the new ones.
- ‼️ **i18next `keySeparator` makes a flat `"A.B.C"` key UNREACHABLE** — nest properly.

### ‼️ Test traps specific to this app

- ‼️ **A `jest.mock` of `useBusiness()` MUST return ONE STABLE OBJECT.** A fresh object literal per render
  gives `load` a new identity ⇒ `useFocusEffect` re-fires ⇒ **infinite loop, and jest simply HANGS with no
  failure message.** The real provider memoizes. **A hang is not a pass.** Third occurrence.
- ‼️ **Jest hoists every `jest.mock` factory above the file**, so a fixture a factory reads must be
  `mock`-prefixed or it is still in its temporal dead zone.
- ‼️ **Selecting a control by POSITION is a latent break.** `pressSend` took "the last `TouchableOpacity`",
  which silently became *Back to queue* the moment the assignment actions rendered below the composer.
  Select by `accessibilityLabel`, and throw a named error if it is absent.
- ‼️ **Swapping a list source can silently drop a timeout.** The old call bounded the round trip with an
  `AbortController`; `getInboxView` had none, so a stalled connection would have held the shimmer forever —
  the exact regression `inboxListLoading` exists to prevent. `signal` is now threaded through.
- ‼️ **`Toast.show` takes `(message, duration)`, NOT a `{ type, text1 }` object.** `message` is typed
  `unknown`, so five object-shaped calls **type-checked cleanly** and would have rendered
  `[object Object]` at runtime. Found by reading the component, not by the compiler.
- ‼️ **`theme.primary`, `theme.card`, `theme.text`, `theme.chipBg` and `theme.infoSoft` DO NOT EXIST.** The
  real vocabulary is `brandBlue` / `onBrandBlue` / `brandGreenSoft` / `surface` / `textPrimary` /
  `textStrong` / `textSecondary` / `glass` / `warningSoft`, plus the `space` / `radius` / `font` scales.
  `tsc` catches the style block; ones in JSX only surface on a second pass.

### Deliberate differences from web that are NOT parity breaks

‼️ **Time sits INLINE in the activity metadata row, not in a right-hand column** — the approved mockup's
explicit 390 pt decision. **Parity is the RULES, not the pixels.**

---

## ‼️ PHASE 13 PART 2 (2026-08-06) — what the frontend audit established about this app

### ‼️‼️ `WorkspaceGate` replaces the whole tab shell, so an actionless state is a dead end

`src/components/WorkspaceStates.tsx` renders **instead of** `<TabContent>` (mounted at
`src/appNavigation/BottomNavigation-Route.tsx:288`). **The workspace switcher lives inside that shell**, so
while a gate state is on screen there is no switcher, no tab bar and no profile menu — and until Part 2 all
three blocking states rendered a title, a body and **no action at all**. The worst case was a contractor in
two businesses, one suspended: they could not reach the other one, and the exit was reinstalling the app.

Every blocking state now offers a way out, and **`__tests__/workspaceStateExits.test.tsx` enforces it**,
including a blanket case so a state added later cannot ship actionless.

### ‼️ `read()` RESOLVES a refusal — a silent `return` is a fake success

`if (!result.ok) { return; }` renders as a button that does nothing, and the row is unchanged either way, so
**silence and success are indistinguishable**. Eight sites carried it until Part 2 (`ChatDetails` × 4,
`ChatList` × 2, `Team` × 2). Refusals now go through the shared `src/components/common/Toast`, and the team
screen through the `TEAM.ACTION_FAILED` banner.

‼️ **`ChatList.handleClaim` is the exception and must NOT be converted:** a lost claim is a colleague's name
and three ways forward on the thread, so it hands `claimRefusalCode` to `ChatDetails`.
**Guard: `__tests__/inboxWriteRefusalsAreSpoken.test.ts` — its COUNT assertion is what proves the enumeration
complete.**

### ‼️ `InvitationAccept` has no in-app `navigate()`, and that is correct

The invitation email is its only entrance. Which means the screen depends entirely on artefacts in a
different project: `clinqetwebpartnerapp/public/.well-known/apple-app-site-association` (which now claims
`/invitation`), `android/app/src/main/AndroidManifest.xml`'s host-wide `autoVerify` filter, and the URL the
server emits. ‼️ **`__tests__/deepLinking.test.ts`'s orphan filter used to enumerate `dashboard`-prefixed
paths only, which is exactly why it could not see the gap.** It now enumerates every https leaf.

### ‼️ CASE 16 is CLOSED for this app, verified at the artefact

`ios/ClinqetPartner/ClinqetPartner.entitlements` and `ClinqetPartnerRelease.entitlements` both exist and
**both are wired** — `CODE_SIGN_ENTITLEMENTS` appears exactly **twice** in `project.pbxproj`, once per
configuration. Session 7's "the entitlement was never wired" defect does not recur.

### Measured baselines (2026-08-06)

| Check | Value |
|---|---|
| jest | **1,394** in **84** suites. ‼️ Part 1's recorded 1,367/81 was short; the inherited tree measured **1,371/82** |
| `tsc --noEmit` | clean |
| ESLint | **618 files, 0 errors**, 16,607 warnings (the **CP12** byte-identity class — do not "fix" them) |
| Inline English | **0** — the build-failing AST guard `src/Locales/sourceLocalizationIntegrity.test.ts` covers every file in `src` |
| Raw emoji / AI glyphs | **0** |
| 390 pt fixed widths | **0** across the tenancy surface **and** `src/components`. ‼️ **Structural only — no device or simulator was available; the 390 pt DEVICE run still has not happened** |

### ‼️ Testing traps recorded here so they do not cost another session

- **A jest mock factory may not close over a non-`mock`-prefixed variable.** `let BUSINESS` fails with a babel
  error naming the variable but not the rule; call it `mockBusiness`.
- **One stable context object per case, never a fresh literal per render** — a new identity each render gives a
  new `load`, whose `useEffect` re-fires forever and kills jest on the heap limit with no failure message.
  This has now bitten four sessions.
- **`npx eslint .` printing nothing is not a pass.** Run `-f json` and report the FILE COUNT alongside the
  error count.

---

## ‼️ PHASE 14 PART 3 (2026-08-06) — THE SIGN-IN LANDING MUST RESOLVE A WORKSPACE (EE-16, BLOCKER)

`AuthService.IssueSessionAsync` auto-selects a workspace **only** at exactly one enterable one
(`enterable.Count == 1 ? enterable[0] : null`). A provider holding **two** — a contractor, or anyone who
accepted a second invitation — therefore signs in with **no `BusinessId` claim, by design**, because the
server expects the client to choose from the `businesses` list it returns.

‼️ **Neither provider app consumed that list.** The resulting `403 business_context_required` was read as
*"this person has no business"* and both apps routed them into **onboarding**, where the first save minted a
**THIRD, empty company**. They never reached either employer, and the workspace switcher could not help
because it lives inside the shell they never entered.

**What the landing does now:**

- **Provider web** — `app/HomeClient.jsx` (the single choke point, because `RegisterRoute.Dashboard` is `"/"`)
  calls `enterMostRecentWorkspace()` from `utils/workspaceEntry.js` **before** falling back to onboarding, and
  **at most once** so a persistent refusal cannot loop.
- **Provider mobile** — `lib/tenancy/pendingInvitation.ts` → `postSignInRoute`, which all **nine** sign-in
  sites already call. A held invitation still wins **first**; then the workspace is entered; then onboarding
  completeness is **re-asked**, because the caller computed its fallback from a check that could not see one.

**Three rules for anyone touching this surface:**

1. ‼️ **COST IS BUILD-ENFORCED, NOT INTENDED.** A token that already carries a workspace must return **before**
   any storage or network work — the common path adds nothing. The workspace list is read from storage
   written by the **sign-in response itself** (web `captureAuthResponse`, mobile `saveAuthTokens`), so
   locating the target costs no request. A test asserts that ordering and **sabotage proves it bites**.
2. ‼️ **WRITE THE STORED LIST ONLY WHEN NON-EMPTY.** A refresh and the business-context exchange both return
   `Businesses` **empty by design**; an unconditional write wipes the real list the moment anyone switches.
3. ‼️ **NEVER guard business creation on "holds a membership"** — **L26** permits one person to own several
   businesses. The guard is the **token claim**. The defect was the landing, never the create.

Pick the workspace through the **shared** `orderWorkspaces` + `workspaceRow(w).enterable` rules — never a
local copy. ‼️ **`lastAccessAt` is nullable AND arrives as the .NET zero date, which is TRUTHY**, so a bare
truthiness check sorts a never-opened workspace to the TOP; `isMeaningfulDate` inside `orderWorkspaces` is
what prevents that.

Guards: `src/components/tenancy/multiWorkspaceLanding.test.jsx` (web, **10**) ·
`__tests__/multiWorkspaceLanding.test.ts` (mobile, **11**). Casebook **CASE 38**.

---

## ‼️ THE PROFILE MENU IS FOUR GROUPS, NOT ONE LIST (2026-08-15, owner-approved)

`src/Screen/ProfileFlow/ProfileScreen/index.tsx` used to render one 21-row block headed
"Business Management". That block mixed day-to-day work, business setup and money together, which is why
**Team, Activity, Refund Requests and Plan & Billing — the four destinations with NO bottom tab and NO FAB
entry — sat unfindable in the middle of it.** It is now four groups, in this owner-fixed order:

| Group | Heading key | Rows |
|---|---|---|
| Setup | `PROFILE_SCREEN.BUSINESS_MANAGEMENT` (value is now **"Your business"**) | Address · Service Area · Category · Services & Price · Availability · Licence · Portfolio · Reviews · Offers · Voice Assistant |
| Team | `PROFILE_SCREEN.GROUP_TEAM_PLAN` | Team · Activity · Plan & Billing |
| Work | `PROFILE_SCREEN.GROUP_WORK` | Calendar · Quotes · Invoice · Customers · Call Follow-ups · Insights |
| Money | `PROFILE_SCREEN.GROUP_PAYMENTS` | Payment Settings · Refund Requests |

‼️ **The key `BUSINESS_MANAGEMENT` was KEPT and only its VALUE changed.** It had exactly one call site, so
adding a new key would have orphaned it.

### `MenuGroup` — and why it exists

- ‼️ **A group whose every row is gated away renders `null` — never an empty heading.** A Technician on
  the Free plan holds none of Team, Activity or Billing, and a bare "Team & plan" over no rows reads as a
  broken screen. This mirrors customer web's `useVisibleNavGroups`, which already ends with
  `.filter((group) => group.items.length > 0)`.
- ‼️ **`MenuGroup` owns the `last` flag.** The divider belongs to the last **VISIBLE** row; a hand-written
  `last` on a fixed row silently draws a trailing divider the moment a flag hides the rows beneath it.
- Every gate is byte-identical to the one the row carried before — only the grouping changed.

### ‼️ The analytics guard now understands TWO row shapes

`__tests__/sessionEAnalytics.test.tsx` scans the source for menu rows. Grouped sections declare
`entries={[{ key, item, ... }]}`; Account Management, Legal and Support still write
`<ProfileMenuRow item="...">` directly. **The old detector knew only the second shape and reported 16 of
17** — it would have gone on passing while an entire group shipped untracked. It now counts both, asserts
`key === item` so an analytics name cannot diverge from the React key, and allows **exactly one**
forwarding `item={row.item}` (the shared row inside `MenuGroup`).

### Labels

`PROFILE_SCREEN.MY_QUOTES` → **"Quotes"**, `PROFILE_SCREEN.MY_BOOKINGS` → **"Bookings"**,
`MY_BOOKINGS_SCREEN.TITLE` → **"Bookings"**, `PROFILE_SCREEN.PAYMENT_SETTINGS` → **"Payment Settings"**
(it read "Payments", which would have collided with the new group heading and diverged from web).

‼️ **The defect this fixes:** the bottom tab said "Bookings" while the screen it opened was titled
"My Bookings"; the FAB said "Quotes" while the profile row said "My Quotes". **A menu row must agree with
the title of the screen it opens.**

‼️ **`MY_DASHBOARD.MY_BOOKINGS` is deliberately UNCHANGED** — it is `"My\nBookings"`, a two-line dashboard
tile, and collapsing it to one word is a layout change nobody approved.

### ‼️ Payment Settings diverges from web ON PURPOSE

Provider WEB files Payment Settings under Profile → Account Management. Mobile puts it in the **Payments**
group beside Refund Requests. That is an **owner-approved mobile-only grouping** (both rows are the
customer-money side and both hang off the online-booking-pay packages). **Do not "fix" it back to match
web** — it will look like drift and it is not.

## 2026-09-02 (Gate 3) — the caps come from the SERVER, and the refusal names the slots LEFT
- `KnowledgeList` carries `maxFileSizeBytes`, `maxPagesPerDocument`, `maxExtractedCharacters`; the screen resolves `uploadCaps` from them and `checkMediaFile('knowledgeDocuments', file, maxFileSizeBytes)` takes the delivered cap. `MEDIA_LIMITS` is the first-render fallback only.
- `KNOWLEDGE.UPLOAD_HINT` interpolates `{{max}}` in all five locales — no catalog string quotes a cap.
- A pick beyond the document cap now says how many slots are LEFT (`KNOWLEDGE.COUNT_LIMIT_REMAINING`, `{{count}}` / `{{max}}`), mirroring the web rule; it used to toast the absolute cap and silently truncate.


---

## ‼️ P1.5 (2026-09-03) — DICTATION MOVED ROUTE, AND GAINED A LANGUAGE CORRECTION

`ai/speech-to-text` is **gone**. All four call sites now use `speech/transcribe`:
`apiManager/constant.tsx` → `SpeechTranscribeAPI` · `services/aiServices.ts` → `SpeechTranscribe` /
`TranscribeAudioFile` · `hooks/useSpeechToText.ts` · `components/SpeechToTextButton.tsx` +
`components/FloatingTextarea.tsx`.

**New:** `components/DictationLanguageChips.tsx`, and a `dictation` section in all five `Locales/*.json`.

### The rules

- ‼️ **The transcript is NEVER auto-sent.** `onTranscribed` hands the words back; the caller puts them in a
  field the member can edit.
- ‼️ **The correction chip appears ONLY after a transcript**, never before speaking. Its options are exactly
  the `candidateLocales` the SERVER returned — the app keeps **no** language list of its own.
- ‼️ **One tap re-sends the SAME recording** (`correctLocale` → `ForceLocale`). The member does not speak
  again. This is the only recovery Punjabi has: Gurmukhi speech is identified as **Hindi** and written in
  Devanagari even with `pa-IN` in the candidate list.
- `Language` is only the member's APP language, which ORDERS the server's candidate list. **It is not a
  picker**, and there is deliberately no language choice before speaking.
- ‼️ **The mic's caps come from AppConfig (`dictation`), never a client constant** — and until
  2026-09-03 this line was a CLAIM, not a fact: `AppRuntimeConfig` had no `dictation` block at all and the
  phone recorded with **no cap**, so a long question was refused with a 413 after the member finished
  speaking. `SpeechToTextButton` now reads `useAppConfig().dictation` and passes
  `maxRecordingSeconds` into the hook, which stops the recorder itself.

### The state machine — the same states as web, by the same names

`DictationState` in `hooks/useSpeechToText.ts` mirrors web's `useDictation`: `Idle` `Listening`
`Transcribing` `Ready` `Empty` `PermissionDenied` `Failed` `TooLong` `Offline`.

- ‼️ **Offline is refused BEFORE recording** (NetInfo). Discovering it at upload means the member has
  already spoken.
- **413 is `TooLong`, not `Failed`** — a shorter question, not a broken service.
- **`retry()` re-sends the clip already held**; `canRetry` is false for `Empty` and `PermissionDenied`,
  because re-sending the same silence changes nothing.
- The strip renders every state, and the duration shows `elapsed / cap` with the mockup's near-cap
  treatment in the last ten seconds.

‼️ **Guarded by `__tests__/dictationNeverSends.test.ts` (12 tests, Q1–Q6 sabotage-proved).** One of them
asserts that EVERY key in the `dictation` catalogue is referenced by code — six of the eleven once shipped
translated into five languages and rendered by nothing. Parity means matching the **rendering rules**, and
a same-named component with the same keys passed every other check while six states did not exist.

## 2026-09-07 — native M10 conversation parity

- Business Search renders an ordered, memoized FlatList transcript with bounded render windows, a keyboard/safe-area composer and max-width content on tablets. Back returns to the list; New clears the session. Android Back returns to the list first. The composer is remounted on New/reopen so late dictation cannot fill another conversation.
- Same server `conversation` capacity and `Done.saved` acknowledgment as web; no client-side six-exchange cap. Full saved text is replayed, with no invented source/feedback IDs. Per-answer live source sheets remain attached to their exchange.
- Double-send guard is synchronous. Request identity and business/member epoch ignore stale callbacks; backgrounding cancels an active stream. Unconfirmed writes require GET reload before another paid ask. Saved partial responses keep their warning.
- Recent conversations use eight member/business-scoped entries with stable first-question titles; AsyncStorage writes/clear are serialized. XHR SSE cleanup releases timers, handlers and abort listeners; thrown frame callbacks fail explicitly.
- Dashboard PromoCarousel pauses on app background and navigation blur as well as existing overlay/user/reduced-motion gates. Behavioral coverage: `dashboardPromoLifecycle.test.tsx` and `businessSearchConversation.test.js`.

## SEARCH-TOPOLOGY PHASE 3 — the provider phone app sends ISO countries (2026-09-22/24)

Parity with `clinqet-partner-app`: the server takes a country STRICTLY on business addresses and service areas.

- `src/Util/geocodingUtils.ts` → `countryForSave(...)` (same rule as web).
- `src/Screen/ProfileFlow/EditBusinessAddress/index.tsx` (onboarding AND profile) sets a `CountryCode` from the
  country list, a search pick and a map pick, clears it when the address reloads, and sends the code.
- `src/Screen/completeProfileFlow/AddServiceArea/index.tsx` sends the code on create and update; a refused create
  now toasts the server's message (it used to read only `errors` and said "Something went wrong").
- Tests: `__tests__/businessAddressCountryIsoCode.test.tsx`, `__tests__/serviceAreaCountryIsoCode.test.tsx`
  (`serviceAreaCurrentLocationRace.test.tsx` now expects the ISO code).
- Registered for the audit: "Next" on `SetServiceArea` with exactly one area re-saves it every time, which triggers a
  search reindex for nothing (web already skips an unchanged save).

## ‼️ DD-36 (owner, 2026-09-25) — place suggestions go through OUR API; no Google key in the app's JavaScript

- `src/components/PlaceSearchInput/index.tsx` is the ONE place-search input: debounce `PLACE_SEARCH_DEBOUNCE_MS`
  (250), min `PLACE_SEARCH_MIN_CHARS` (2), max 200 (the server refuses longer), each keystroke aborts the superseded
  request (`AbortController` through `apiClient.getPublic(url, { signal })`), rows are `accessibilityRole="button"`
  with the full line as label, states `loading / empty / unavailable / rateLimited` = `PLACE_SEARCH.*` (×5 bundles;
  rate limit in amber `theme.warning`, outage in `theme.danger`). ‼️ **An outage (503 / unreachable) is never shown as
  "no results".** Ref handle: `blur / focus / isFocused / setText`. Google's Places policy: a muted, untranslated
  `GOOGLE_ATTRIBUTION` ("Google Maps", an exported constant, never a locale key) sits under the rows ONLY while rows show.
- Session token: `uuid` v4, minted lazily, reused for every suggestions call of the typing session and handed to
  `onSelect(suggestion, sessionToken)`; a pick, a cleared box or a blur ends it. The screen then calls
  `resolvePlace(suggestion.placeId, sessionToken)` → `GET geocoding/places/{id}?sessionToken=` (ends the billed
  session; answer in the STORED language, same shape as `geocoding/resolve`). Without a token it asks nothing.
- `services/geocodingService.ts`: `fetchPlaceSuggestions`, `resolvePlace(placeId, token)`, `describeSuggestion`,
  `fetchBusinessCountryCode(countries)` (primary address → ISO; '' on refusal). `Util/geocodingUtils.ts`:
  `storedCountryCode`, `placeSearchCountries(own, list)` (the business's own country, else every listed country).
- Screens: `EditBusinessAddress` (countries = picked/stored country; street = the server's `formatted_address`,
  UM-6), `MapScreen` (route param `countries` from the address screen; a failed pick moves nothing and toasts),
  `AddServiceArea` (countries = the business's primary-address country; a pin placed while a pick is resolving wins),
  `AddressSearchInput` (was `GoogleAddressInput`; customer/billing forms, `allowedCountries`; a failed pick toasts and keeps the shown line).
  There is no device-side fallback any more — a pick the server cannot answer fills nothing.
- Removed: `react-native-google-places-autocomplete` (package + lockfile), `ENV.GOOGLE_MAPS_API_KEY`,
  `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, the `@env` declaration. The `.env` value stays ONLY for
  `android/app/build.gradle` `manifestPlaceholders` → the native Maps SDK (Android-restricted key).
- Guards: `__tests__/noGoogleKeyInJs.test.ts` (no `maps.googleapis.com` / `places.googleapis.com` / `GOOGLE_MAPS` /
  the package in `src`; package + lockfile clean; the native placeholder still wired), `placeSearchInput.test.tsx`,
  `placeLookupService.test.ts`, `placePicksResolveThroughServer.test.ts` (every pick passes its token). Test trap:
  `uuid` resolves to its ESM browser build under Jest — mock it (`jest.mock('uuid', …)`) or mock `PlaceSearchInput`.

## Plan & Billing — overdue and bank-processing lines (2026-09-26)

Rules and server contract: `clinqet-payments` → *Overdue payments — settle first*. The app stays information-only (no
Pay now; the web hand-off is unchanged):
- `billingOverviewService.ts` maps `nextChargeAt`, `finalRetry` and `paymentProcessing` for both the plan and the AI
  summaries; `setDefaultPaymentMethod` / `removePaymentMethod` return `PaymentMethodChange { ok, message }` so the screen
  shows the server's sentence (it says when a payment is being retried).
- `src/Screen/ProfileFlow/PlanAndBilling/billingLines.ts`: `aiBillingLine` and `planRenewLine` (`PlanLine { text, tone }`);
  tones render as dots (`autoDotOverdue` = theme.danger, `autoDotProcessing` = theme.brandBlue) plus `autoTextAlert`.
- Keys in all 5 `src/Locales` files. Test: `__tests__/overduePlanLines.test.ts`.

## Subscription and assistant state refresh (2026-09-27)

- Provider web and native both use `services/providerStateEvents`: subscription, AI add-on, minute-balance and voice lifecycle notifications invalidate the corresponding demanded caches. SignalR single, batch and replay handlers dispatch once per payload; unrelated notifications do not trigger these reads.
- Web `VoiceAssistantContext` and `BillingOverviewContext` serialize forced refreshes behind an existing request and reject responses from an older mutation or workspace/session. Native `hooks/useVoiceAssistantState` and `services/billingOverviewService` mirror that rule; native plan-summary listeners update mounted Profile, Plan & Billing, dashboard and Call Follow-ups readers.
- AI gates revalidate when entered again, including when a cached promo prevents the screen content mounting. Web visibility/online and native foreground refresh recover missed notifications. An unused cache stays lazy; a previously failed requested cache can recover on the next event. Package/access gates remain in effect.
- A cached `NotInvited` is cleared during enrollment revalidation, so a failed refresh becomes unknown/retry instead of retaining the purchase promo. A known assigned/active state and known allowance survive transient read failures. `hooks/useVoiceUsage` updates mounted usage readers without remounting; an unavailable read is not evidence of no plan.
- Successful web subscription client mutations refresh assistant lifecycle; their existing callers still refresh the billing overview. No gateway, price, ledger, endpoint, schema or charge behavior changed.
- Dashboard lifecycle/setup widgets read the shared assistant state, not the stale business-profile projection. Native activity uses the server status `Active`.
- Setup layout uses available content width: number mode on the left, language plus reach-you phone on the right when space allows; one column on narrow screens. Manage mode preserves its separate layout. Assigned web number/actions move to the right at 800px container width and lead on narrow layouts. Native form columns use measured width and font scale, retaining native phone keyboard/pickers. Revalidation preserves unsaved form edits.
- Regression coverage: web `src/context/providerStateRefresh.test.jsx`, `src/hooks/useVoiceUsage.test.jsx`, SignalR teardown tests and voice-form validation; native `__tests__/providerStateRefresh.test.ts`, `aiSurfaceFocusRefresh.test.tsx`, `voiceUsageRefresh.test.tsx` and `voiceApplicationValidation.test.tsx`. These exercise real caches/gates with mocked transports, stale in-flight responses, notification batches, offline recovery, workspace purge, feature/access gating and unsaved edits.
## Refresh failure handling (2026-09-28)

`RefreshTokenResponse.sessionInvalid` is authoritative for terminal failure. API preflight/401 handling and AuthProvider preserve remembered credentials on network, timeout, throttling, 5xx and malformed responses; API callers receive 503 for an inconclusive refresh. Explicit 401 remains terminal even when its body is malformed. Recheck the stored refresh token after response-body parsing so a late rejection cannot kill a changed session. The timeout covers response-body reading. `isTransientRefreshFailure` honors the explicit terminal flag and treats stale sessions as non-terminal.

---

## AI Assistant number screens (2026-10-02) → `clinqet-voice-number-lifecycle`

`src/Screen/ProfileFlow/VoiceAssistant/number/` mirrors the provider web rules
(`clinqetwebpartnerapp/src/lib/voiceNumber/numberRules.js`) under
`C:\Nik\Data\voice-number-lifecycle\UI-CONTRACT.md` §1–§2 and §4. Polling pauses in the background and
offline; a confirm that times out keeps its `requestId` and re-reads status, never sends a second one.

- The screen is a tab that is never re-opened, so a state that sends the provider away to put something
  right (plan, phone, any refusal state) asks the choices again when a newer status answer lands
  (`awaitsRecheck`); a list on screen is never re-read.
- After an unanswered confirm the number is locked and the id watched (`useNumberLifecycle`).
- `voice_number_request_limit` is its own state (`number-limit`): the server sentence, no button.
- `StatusUnreadNotice` is the one "could not read the number status" notice: inside the ring card on a
  dedicated number, on the screen itself in own-number mode.
- The other screen rules found in review are in `clinqet-voice-number-lifecycle` §7.

## 2026-10-03: sign-in links, consent, register row, knowledge row

- `appNavigation/launchLink.takeLaunchLink()` — the only way a screen reads the launch URL (once per process); `startIdentityFlow()` ends the sign-out toast mute; `AuthProvider` follows `onSessionEstablished`. See `clinqet-auth-sessions`.
- Consent: `services/cookieChoiceRecord.ts` + the `PolicyReconsentModal` listener; `PolicyConsentChecker` re-runs on a sign-in.
- Register: email (`LoginWithEmail {method:'email'}`), code (`{method:'otp'}`), passkey, then Google/Facebook/Apple, under `REGISTER.OR_CONTINUE_WITH`; the row wraps (six 52pt targets).
- AI Knowledge row: a run that suggested nothing renders only the part-of-file warning, if any (web parity). The `outcomeNotice` styles and every `DRAFTS_ROW_NONE*` key, plus the unused `DRAFTS_ROW_RUN_AGAIN`, are gone.

- Audit follow-ups 2026-10-03: `AUTH_OPTIONS.PASSWORD|CODE|PASSKEY` label the Register shortcuts; the row is capped to three per line; `LoginWithEmail` takes `route.params.method` in its initial state (no one-frame flash); `apiManager` never routes `accept-policy`'s own 409 to the consent queue; the passkey screen ends the sign-out toast mute at submit.

## Consent: one question at a time (2026-10-03)

See `clinqet-ui-common` "Consent model — one question at a time". It covers: nothing on sign-in surfaces; a small bottom cookie card (per device); one signed-in agreements dialog that carries the cookie question when this device has not answered it; Terms + Privacy only on Register and on the server. Provider mobile: `appNavigation/consentPlacement` (fed by `NavigationContainer` onReady/onStateChange and `MeasuredTabBar`), `services/consentQuestion`, and `useTourAutoStart` gated on it. `useCookieConsent()` reads the country itself (Do Not Sell used India before). Register uses the device jurisdiction.

## AI Knowledge: Refresh suggestions (2026-10-04)

- The document row action is **Refresh suggestions** (was "Run again"). It never re-reads the file: the tag stays **Ready**, and one row line says that services, prices and pictures are being found (it includes the server's `analyticsMaxMinutes`).
- The second "Analysing" tag and its tooltip are gone.
- **No run for all documents:** the button, `POST knowledge/service-drafts/rerun-all`, `RerunAllAsync` and `KnowledgeRerunOutcomeDto` were removed, because every run pays for the AI judge and extractor again.
- The confirm dialog stays. It says what is found again, what is removed, that approved services stay, and that nothing changes in what Clinket knows.
- Copy is receptionist-neutral ("answers from this document", never "callers").
- **Daily limit (owner, 2026-10-04).** One refresh per document per UTC day, and a per-business daily number
  (default 5, admin alert `KnowledgeRefreshWarning` at 3 and `KnowledgeRefreshLimit` at the limit). The admin can override it per
  business (`BusinessProfile.KnowledgeRefreshDailyLimit`: absent/null = default, 0 = refreshing off). The list response carries
  `suggestionRefresh { turnedOff, dailyLimit, usedToday, perDocumentLimit, documentsRefreshedToday }`; the server refuses past it
  (400 `Error_KnowledgeRefreshTurnedOff`, 429 `Error_KnowledgeRefreshDailyLimitReached` / `Error_KnowledgeRefreshDocumentDoneToday`
  with `Retry-After` to the next UTC midnight).
- **Read again shares the same day (owner, 2026-10-04).** The provider's Read again (`POST knowledge/documents/{docId}/reprocess`,
  shown only on a failed or stopped reading, or on a reading notice that offers it; hidden on a plain Ready document) also runs
  the suggestion AI, so it spends from the SAME allowance and fires the same two alerts, which say which action it was. The admin
  repair (System → knowledge reindex) is never limited.
- Mobile: `resolveRefreshBlock` / `REFRESH_BLOCK_KEY` (`Knowledge/knowledgeDraftMeta.ts`, web twin) disable the sheet's Refresh
  suggestions with the reason line (`KNOWLEDGE.DRAFTS_RERUN_BLOCKED_{TURNED_OFF,DAILY_LIMIT,DONE_TODAY}`, five languages); a failed
  run shows the reason instead of Try again. Read again in the sheet and in the reading notice are gated the same way. A refused
  press closes the ask and reloads the list.

## Billing UI audit fixes (2026-10-04)

- `billingOverviewService` maps `subscription.interval` / `periodIsAnnual`; the Plan tab headline shows a yearly holder `discountedAnnualPriceMinor ?? annualPriceMinor` + `PER_YEAR` (web parity).
- One promo rule on plan cards (monthly and yearly): struck original only when the promo is lower, promo price, `PLAN_AND_BILLING.PROMO_APPLIED`; the struck group carries an `accessibilityLabel` from `PRICE_WAS` / `PRICE_NOW`. A yearly promo total reads `BILLED_FIRST_YEAR`; `PROMO_ANNUAL_SAVING[_PLAIN]` say "on your first year" (a repeating promo on yearly billing covers the first yearly charge only). Mobile shows no AI prices, so there are no AI price rows.
- Monthly | Annual options: 44pt, `accessibilityRole="button"` + `accessibilityState.selected`, brand green with `onBrandGreen` text.
- `UsageMeter` with `cap === 0`: no meter, no chip, `_SUMMARY_NONE` plus the CTA when a higher plan exists.
- Leads list passes the meter `onUpgrade` only when `billingUiEnabled && accessKnown && can('billing.read')`; `LockedLeadCard` gets `upgradeAvailable={null}` until lead usage answers (list + `BroadcastDetails`) and shows no limit sentence meanwhile.
- `components/tenancy/SeatPlansButton.tsx` (`TEAM.SEATS_UPGRADE`) on the Team and Invite seat cards opens Plan & Billing when `seats.upgradeAvailable`, billing is on and the member can read billing.
