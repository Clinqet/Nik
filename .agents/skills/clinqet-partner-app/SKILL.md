---
description: |
  **FRONTEND SKILL** — Work on the Clinqet Partner/Provider Web App (Next.js 16, React 19, Tailwind CSS 3). USE FOR: creating/modifying partner dashboard pages, components, forms, booking management, quote management, invoice management, service listings, calendar, onboarding, profile management, Open Page (public provider website), CRM, notifications, messaging. Applies to ALL files in clinqetwebpartnerapp/.
---

# CLINQET PARTNER APP — COMPREHENSIVE SKILL

## RECENT CHANGES — 2026-10-06 (taking over a prepared account, and "No price yet")

See the `clinqet-prepared-providers` skill for the whole feature. What changed HERE:

- ‼️ **`PRICE_TYPES.ON_REQUEST` must be `"onrequest"`.** It was referenced in four files and never defined, so the pill posted no price type and the server's fallback stored a FIXED price with no amount. `formUtils.test.js` pins it.
- **"No price yet" hides the visit fee, travel fee and floor AND skips their validation** — validating a field that is no longer on screen refused the form with nothing the provider could do.
- **Registration stops on a prepared phone** (`PreparedProfileReady`) and sign-in offers "No password yet? Sign in with a code".
- **`/claim` and `/stop-emails`** are public, `noIndex`, and in `robots.js`. ‼️ A transient failure or being offline must NEVER read as "this link no longer works" — each has its own title, and the token is sent in `X-Prepared-Token` and stripped from the address bar after the first read.
- **A password reset now says it worked** before redirecting to sign-in.
- ‼️ **The reset email-code screen redirects to ForgotPassword, not to itself** — it used to bounce onto the same screen forever.
- **Bookings show "To be confirmed"** instead of a 0 for a line with no price.

## 2026-09-29 Booking decisions — Decline vs Cancel, one-tap cancel reason, delete Drafts only (mobile mirrors)
Authority `C:\Nik\Data\search-topology\findings\PROGRAMME-BUILD-STATE.md` D5 · D7 · D13, `SCORING-REAUDIT-2026-09-28.md` N1.
- **One rule module: `src/utils/bookingActionPolicy.js`** (pinned by `bookingActionPolicy.test.js`, which also source-scans the surfaces).
  `canDeclineBooking` ⇔ `AwaitingProviderConfirmation`. `canCancelBooking` = not Draft, not `AwaitingProviderConfirmation`, not
  terminal. **`canDeleteBooking` ⇔ `Draft` only (D5)** — the server refuses anything else. `needsProviderCancelReason(booking)` ⇔
  `booking.confirmedByProvider === true` (mirrors `BookingValidationService.ValidateProviderCancelReason`).
  `providerCancelReasonsFor(booking)` = `CustomerAsked` / `CouldNotDoIt` / `EnteredByMistake` (values of
  `clinqetshared/Enums/ProviderCancelReason.cs`); `EnteredByMistake` only when `booking.createdBy` is `business` (case-insensitive) —
  the server returns `Error_ProviderCancelReasonNotAllowed` otherwise. `providerCancelReasonMessageId(value)` → `bookingsDetails.cancelReason.*` or null.
- **‼️ Reject = DECLINE (N1).** Every Reject calls `openActionModal("Rejected", …)`: `BookingCard.jsx` approval row,
  `sections/BookingHeaderActions.jsx` secondary button, and a new `canDeclineBooking` item in `ActionMenu.jsx` and `Booking.jsx`
  `TableRowActionMenu`. It used to open `"Cancelled"`, which the ranking reads as a broken promise. `bookingCard.reject` /
  `bookingsDetails.reject` keep their keys; en-US values now read "Decline".
- **`components/booking/model/DeclineBookingDialog.jsx`** — rendered by `ActionStatusModal` when `newStatus === "Rejected"` and directly
  by `dashboard/home/WorkQueue.jsx` (button label `Dashboard.Decline`). Optional message capped at exported `CUSTOMER_NOTE_MAX_LENGTH` = 500
  (DTO `[StringLength(500)]`); sends `rejectBooking` → `PATCH bookings/{id}/status` `{ newStatus: "Rejected", rejectionReason }`, with the
  reason only when typed — no canned text. **D13 line**
  `ActionStatusModal.Decline.NotTakingBookings` + two links: Pause my listing → `` `${ProfileRoute.BusinessInformation}#${LISTING_CONTROLS_ANCHOR}` ``,
  Update my hours → `ProfileRoute.SetAvailability`. Copy `ActionStatusModal.Decline.*`.
- **`LISTING_CONTROLS_ANCHOR` = `"listing-controls"`** (`src/routes/routeConfig.jsx`). `Profile/ListingControls.jsx` sets it as the
  section `id` (`scroll-mt-24`) and, when `window.location.hash` matches, scrolls itself into view ONCE after `view.status` leaves
  `loading` (a scroll over the skeleton stops short). Pinned in `listingControls.test.jsx` "a deep link to the switches".
- **`model/BookingDialogShell.jsx`** — the shared modal shell (`role="dialog"`, `aria-modal`, `aria-labelledby`), built on
  `src/hooks/useFocusTrap.js` (same hook as `billing/PaymentModalShell.jsx`, `billing/RouteKycModal.jsx`): focus moves in, Tab/Shift+Tab
  cycle inside, Escape and backdrop close, focus returns to the opener on unmount; both closes are ignored while `busy`.
  DeclineBookingDialog and every `ActionStatusModal` branch render in it. Test `model/BookingDialogShell.test.jsx`.
- **Decline toasts:** success `Dashboard.BookingDeclinedSuccess` (WorkQueue + `ActionStatusModal`); WorkQueue's non-success answer
  shows the server's `message`, else `Dashboard.BookingDeclineFailed` (`ActionStatusModal` shows the error itself). **WorkQueue closes
  the dialog only on success** — a failure (non-success answer or throw) leaves it open with the typed message kept.
- **Cancel (`model/ActionStatusModal.jsx`) has two paths.** `needsProviderCancelReason(booking)` → reason chooser: optional note
  (500 cap) + one button per `providerCancelReasonsFor(booking)`; **the tap IS the cancel** —
  `handleChangeStatus(id, "Cancelled", note, "", reason)` sends `providerCancelReason` (+ `cancellationReason` = the note, only if
  non-empty). Copy `ActionStatusModal.CancelReason.*`. Otherwise (a booking the provider never agreed to) the required free-text
  `cancellationReason`, no reason code. Both show `providerPay.cancelNote` when `booking.payment.status` is `Authorized` or `Vaulted`.
  Typed state resets on close — the parent keeps the modal mounted between bookings.
- **`handelCancelBooking` (POST `bookings/{id}/cancel`) is deleted** from `src/services/bookingServices.js`; every provider cancel is
  `handleChangeStatus` (PATCH `/status`), whose 5th param is `providerCancelReason`.
- **Booking details** (`BookingsDetails.jsx`, Cancelled card): the localized reason (`data-testid="booking-cancel-reason"`), then the
  provider's note (`cancellationReason`); without a reason code, the old free text / `bookingsDetails.noReasonProvided`.
- Tests: `declineAndCancelReasons.test.jsx`, `BookingsDetails.cancelReason.test.jsx`, `dashboard/home/workQueueDecline.test.jsx`,
  `model/BookingDialogShell.test.jsx`, `ActionMenu.test.jsx`, `bookingActionPolicy.test.js`, `listingControls.test.jsx`.
- Every decline goes through `DeclineBookingDialog`.

## 2026-10-02/03 AI Knowledge reading accuracy (web; mobile mirrors the rules) — BUILT, not deployed
Authority `C:\Nik\Data\knowledge-reading-accuracy\BUILD-STATE.md`. Files under `src/components/Profile/knowledge/` unless named.
- **Report wrong answers** (approved sheet `knowledge-wrong-answers-report`, wording W1): `ReportWrongAnswers.jsx` — a link on
  the row's info line (`KnowledgePage.jsx`) and a button beside Download in `DocumentViewer.jsx`. Shown only by
  `canReportWrongAnswers(doc)` (a File, Ready, not stopped). One tap → `ReportKnowledgeWrongAnswers` (`knowledgeServices.js`,
  `url.KnowledgeReportWrongAnswersAPI`, body `{ source: "Web" }`) → "Reported. We'll check this file." A 400/404/429 shows the
  server's sentence. Nothing is stored, so the same file can be reported again. Keys `knowledge.report.*` ×5. Test
  `knowledgeReportWrongAnswers.test.jsx`.
- **Picture delete** confirms inside the viewer (an alertdialog; Escape/Tab; errors shown inside).
- **Access sentences** follow the file's real access: `src/lib/knowledge/receptionistAccess.js` (`receptionistReachesCallers`,
  `pictureSendBlock`).
- The notice ✕ and "Read again" are absent without `voice.settings.manage`.
- **AI setup summary** (`src/components/common/SetupReadingNotices.jsx`, used by `AIAssistantModal.jsx`; sheet
  `ai-setup-reading-honesty`): reading not finished, prices without names, not offering, saved price kept, high price, content
  not read, long pages. At most `MAX_VISIBLE_SUMMARY_NAMES` (8) names, then "+N more". Keys `AISetup.Summary*` ×5. Test
  `setupReadingNotices.test.jsx`.

## 2026-09-25 AI Knowledge + Ask Clinket — Phase 4 closing audit (web; mobile mirrors the rules)
Authority `C:\Nik\Data\knowledge-extraction-fix-plan\phase-4\FINAL-AUDIT.md`. Files under `src/components/Profile/knowledge/` unless named.
- **Accepted files = the server's list (P4-F-05).** `knowledgeMeta.js` `ACCEPTED_EXTENSIONS` holds `.csv`, `.tiff` AND `.tif`
  (plus `.heif/.heic`, converted to JPEG before upload); `CONVERT_HINTS` holds only `.tsv`/`.xls` → Excel and `.doc` → Word — `.csv`
  is read as a table, never "convert it". `knowledgePreflight.js` counts `.csv` as text-like. `knowledge.upload.dropHint` /
  `.invalidType` name CSV (×5). Guard: `knowledgeGuards.test.js` "every extension the server accepts is accepted here".
  Server side: API `StorageConfiguration:ProviderKnowledge:AllowedMimeTypes` gained `application/vnd.ms-excel` (the MIME Windows
  browsers send for `.csv`), pinned by `Clinqet.API.UnitTests/Configuration/KnowledgeUploadAllowListTests.cs`.
- (2026-10-02: the moving bar below is REMOVED — `ReadingTrack` and the `knowledge-track` keyframes are gone; the row keeps its
  status spinner, `animate-spin-slow` amber on TakingLonger.)
- **The reading-motion bar (P4-F-06, sheet `knowledge-document-row-truth` A3/A4).** `KnowledgePage.jsx` `ReadingTrack` — a 3px bar
  under a Processing / TakingLonger row, drawn ONLY while the page is watching; TakingLonger slows it and turns it amber
  (`animate-knowledge-track-slow`, amber spinner `animate-spin-slow`); `motion-reduce:` stops both. Keyframes `knowledgeTrack`,
  animations `knowledge-track` (1.5 s) / `knowledge-track-slow` (3.4 s) / `spin-slow` in `tailwind.config.js`. Test
  `knowledgeDocumentRow.test.jsx`.
- **Read again is always in the row menu (P4-H-11)** — the narrow layout has no inline slot; the wide menu drops it only while
  it is inline. `DocumentRow` is exported for the test.
- **Run again names the loss (P4-D-05).** Run again / Run again all fetch `GetKnowledgeServiceDrafts({ pageSize: 1 })` when the ask
  opens and show `tallyWaitingSuggestions` → `rerunWaitingMessage` (`knowledge.drafts.rerun.waiting` / `.waitingEdited`, ICU
  plurals, ×5); a superseded fetch never writes into a newer ask. Read again sentences rewritten to what it really does (×5).
- **Draft placement is the card's own until touched (P4-F-03/04).** `KnowledgeDraftEditModal.jsx` seeds from
  `resolveApprovalSettingsFor(draft, panel)` and, unless the provider touched the "where" controls (never inside the intercept),
  saves `place: null` + `draftOwnAreaChoice(draft)` (`knowledgeDraftMeta.js`); save-and-approve overrides the panel only when
  touched. A single approve ask names that card's resolved placement; the mass asks append
  `knowledge.drafts.confirm.ownPlacementKept` (×5). Tests `knowledgeDraftPlacementSeeding.test.jsx`,
  `knowledgeDraftApproveConfirm.test.jsx`.
- **Tax on drafts (P4-D-11 UI).** `draftTaxStatement(draft)` → `{ included, percent }` (null when the file said nothing; percent
  to one decimal). Chip `knowledge.drafts.chip.taxIncluded[Rate]` / `.taxExtra[Rate]`, editor switch
  `knowledge.drafts.edit.taxIncluded[Rate]` / `.taxExtra[Rate]` + `.taxFromFile` (×5). Test `knowledgeDraftDurationTax.test.jsx`.
- **Upload refusals keep the server's sentence** (U-05, pinned by `knowledgeUploadRefusal.test.jsx` on the real dialog);
  sending off ⇒ `AnswersOnly` (`receptionistAccess.test.js`).
- **Ask Clinket source cards (P4-F-01).** `src/lib/businessSearch/askRules.js` `groupSources` keys a document by AI-written channel
  (`doc:{docId}` / `doc:{docId}:{channel}`, `group.channel`) — one card never mixes the file's words with an AI description or
  overview. Tests `sourceGrouping.test.js`, `src/components/businessSearch/SourceCard.grouping.test.jsx`. Contract:
  `clinqet-business-search` §19.7 / §29.
- ‼️ **Not yet aligned (other owner):** `src/components/common/AIAssistantModal.jsx` (AI setup upload) still lists `.tiff`
  without `.tif`.

## 2026-09-15 Keep your own number (web + provider app, same session)

`components/Profile/voiceAssistant/ownNumber/` — `OwnNumberCard` (the A1 invitation, the connected/failure status
card, three expanders, the pending admin-call panel), `OwnNumberWizard` (4 steps in `OwnNumberModal`: number →
two phone checks → the dial codes → the live test call, plus the office-line / unknown-carrier / untested-carrier
panels and the phone hand-off QR), `CheckRunner` (the confirm, the ringing strip, the verdict — one block shared by
the wizard, "Check again", the ring-time adjust and the reverse check of a disconnect), `CodeRow`, `WhoAnswersPanel`,
`AskUsModal`, `WhatChangesModal`, `HearItModal`, `OwnNumberAdjustDialog`, `OwnNumberDisconnectDialog`,
`ownNumberCopy.js`, `useOwnNumberCheck.js`.

- The card lives under the assigned-number box in `ActivePanel`; the settings section grows a "Your numbers" row and
  `WhoAnswersPanel`. `VoiceApplicationForm` enables the `ForwardExisting` tile, switches the reach-you hint, and
  replaces the two impossible answering modes with `LockedModeCard` (visible + explained + "ask us", never greyed).
- `useOwnNumberCheck` watches one check two ways: the transient `VoiceOwnNumberCheckUpdated` SignalR event (the
  wizard CLAIMS it, so no toast) and a 3 s poll fallback; whichever brings the terminal verdict first wins.
- Own-number status rides every assistant state response, so no screen makes a second read. `?ownNumber=connect`
  opens the wizard straight from the push / the phone hand-off.
- Analytics `VoiceOwnNumberAction` (surface `profile.ai_assistant.own_number`): wizard_open, step_view,
  number_saved, code_copied, code_dialed, check_start, check_result, adjust_ring, hear_it_open/call, ask_us_request/
  cancel, what_changes_open, disconnect_open/done. Contract: `clinqet-voice-assistant` SKILL.

## 2026-09-09 AI Voice setup gate — details + address only (web + mobile same session)
`OnboardingChecklist.jsx` `STEP_ROUTES` maps only `BusinessDetails` → `ProfileRoute.BusinessInformation` and `BusinessAddress` → `ProfileRoute.BusinessAddress`. The server (`VoiceAssistantOnboardingReadiness`) is the authority; category / services / availability / service area no longer appear unless the DTO names them. Dropped-step `voiceAssistant.onboarding.step.*` keys stay because the dashboard go-live strip / wizard still uses them. Contract: `clinqet-voice-assistant` SKILL. Tests: `OnboardingChecklist.test.jsx`.

## 2026-09-07 AI Knowledge — the per-item receptionist choice (replaces "Send relevant details to callers"; web + mobile in one session; sheet K1 by waiver)
- Rules live in `src/lib/knowledge/receptionistAccess.js` (import-free TWIN of the phone's `.ts`; the phone diffs them): `receptionistAccess` (an unknown value reads NotUsed — fail-closed), `receptionistUses`, `receptionistSends(doc, materialSharingEnabled)`, `receptionistBoxVisible(receptionistAvailable)`, `receptionistChoices` (folds to two while sending is off), `receptionistSelectedChoice`, `receptionistControlState` (loading → locked → readonly → editable; Processing IS editable), `receptionistMark` (sends/answers/notUsed; null without a receptionist or on a Deleting row), `receptionistUploadDefault`, `countUsedByReceptionist`. Backend contract: the `clinqet-voice-assistant` SKILL, "PER-ITEM RECEPTIONIST ACCESS".
- `ReceptionistAccessBox.jsx` (details editor; saves on tap through `KnowledgePage.handleReceptionistChange` → `SetKnowledgeDocumentReceptionistAccess` → `PATCH knowledge/documents/{docId}/receptionist { access }`; THROWS so the box puts the choice back and shows `knowledge.audience.saveFailed` in its ONE `role="status"` region; `refreshDocumentAsync` reconciles on success AND failure — the same reconcile the audience box uses, pinned ×4 in `knowledgeGuards.test.js`) + the exported `ReceptionistAccessPicker` (three `role="radio"` buttons in a `radiogroup`, `aria-checked`; `compact` on upload rows; full in `KnowledgeFaqModal.jsx`, where the choice rides the FAQ's own Save as `receptionistAccess` — null without a receptionist). `UploadKnowledgeModal.jsx` seeds `receptionistUploadDefault(seed)` per row and sends `receptionistAccess` only when `receptionistAvailable`; the blue note appends `knowledge.receptionist.uploadHint` / `.uploadHintNoSending`.
- Rows (`DocumentRow` AND `FaqRow`): one read-only mark — `Details can be sent` (indigo) · `Answers only` (navy) · `Not for callers` (dashed grey) — `data-testid="knowledge-receptionist-mark"`, opens the editor, `aria-label` = the state then `knowledge.receptionist.changeHint`; drawn on Processing too (the SETTING is true whatever the status), absent without a receptionist or on Deleting. Pictures: `KnowledgeImagesPanel` takes `sendBlock` only (null = can send; `platformOff`/`fileNotSending`/no receptionist), plus `toggleRef` and `nameRef` for focus after a delete (next tile → previous → Show/Hide → the document's name). No receptionist: no notice, ticks, reasons or dimming, and the quiet delete sentence; members without manage get the `…ReadOnly` sentences; a ticked picture on a file that cannot send reads `tick.chosen`. The pictures count line keys on the same rule.
- `data.receptionistAvailable` (the list's flag, = the AI Assistant page's own switch) chooses the words: `knowledge.pageSubtitle` / `empty.title` / `empty.body` / `empty.bodyDocsOnly` / `faq.subtitle` / `audience.helper` each have a `*NoReceptionist` twin; shared sentences now name "Clinket" as the actor (delete confirms, processing hint, analysing lines, `drafts.rerun.bulletAnsweringOne/All`). Without a receptionist there is NO box, picker or mark — never a disabled one.
- `VoiceAssistantPage.jsx`: the summary counts `countUsedByReceptionist(readyDocuments)` / `(faqs)`; Ready material none of which the receptionist may use shows `KnowledgeNudge variant="choose"` (`knowledge.nudge.choose*`) in the invite's slot.
- `BusinessSearchPage.jsx` empty-library fix (pre-existing defect): it tested `Array.isArray(response.data.data)` on the OBJECT DTO, so "You have no documents yet" never rendered — it reads `payload.documents` / `payload.faqs` now (`BusinessSearchPage.emptyLibrary.test.jsx`).
- Deleted: `knowledge.sharing.*`, `knowledge.images.notShared`, `bulletReceptionist*` (all five catalogues), `knowledgeSharing.test.jsx`, the `sharing_toggle` event, `KnowledgeDocumentSharingAPI`, the `CustomToggleSwitch` imports on the knowledge modals. Analytics `receptionist_access_change { access }`. Tests: `knowledgeReceptionistAccess.test.jsx` (the REAL IntlProvider + REAL en-US, so a missing key fails), `receptionistAccess.test.js`, `knowledgeGuards.test.js`, `knowledgeImages.test.jsx`, `knowledgeNudgePlacement.test.jsx`; ESLint 0 warnings on every touched file. Fixed on the way: the act() warning in `voiceApplicationValidation.test.jsx` (the Save-draft case now awaits the settle) and a dead `GetVoiceAssistant` import in `KnowledgePage.jsx`.

## 2026-09-02 Knowledge + AI setup upload PRE-FLIGHT (plan §3.7 of `C:\Nik\ai-cost-quality\KNOWLEDGE-OCR-PLAN.md`; mockup gate WAIVED by the owner — a recorded exception)
- `src/utils/pdfPageCount.js` counts `/Type /Page` dictionaries in the raw bytes (`/Pages` excluded; returns `null` when PDF 1.5+ object streams hide them — advisory, never a gate). `src/components/Profile/knowledge/knowledgePreflight.js` (+ `knowledgePreflight.test.js`) turns a picked file into `{ pages, passages, characters, bytes }` estimates (passages ≈ pages × 4, else bytes ÷ 2048; characters ≈ bytes for text-like types) and `preflightWarnings` against the server caps mirrored client-side: knowledge 100 pages / 2 600 000 characters / 30 MB; setup 20 pages / 10 MB. `passageHeadroom` / `remainingDocumentSlots` / `totalEstimatedPassages` / `exceedsHeadroom` drive the limits UI. Change a cap in BOTH this file and the mobile `knowledgePreflight.ts`, and both jest suites.
- `UploadKnowledgeModal.jsx`: each row shows "about N pages · about M parts" (`knowledge.upload.preflight.pagesAndParts` / `.parts`), warnings in `text-knowledge-warnText` (`.pagesOverCap`, `.charactersOverCap`), files past the document-slot cap are refused with `knowledge.upload.countLimit` (`{count}` slots, `{max}`), and the `knowledge.upload.preflight.nearlyFull` banner (`{needed}` vs `{left}`) shows when the summed estimate exceeds the passage headroom. New props `documentCount / maxDocuments / passageCount / maxPassages` come from `KnowledgePage.jsx` (the list response). `knowledge.upload.tooLarge` says 30 MB in all five catalogs (a 20 MB drift was fixed).
- `src/components/common/AIAssistantModal.jsx`: `setupLimits.maxFileBytes` is an exact gate (`AISetup.ErrorFileTooLarge` `{name} {max}`, `max` = `megabytesOf(bytes)`); `setupLimits.maxPdfPages` is advisory (`AISetup.PagesOverCap` `{count} {max}`) via `countPdfPages(await resolved.arrayBuffer())`; `filePreflight` resets at every file reset (3 sites, pinned). ‼️ **Both come from `useProviderSetupUploadLimits()` (`context/AppConfigContext.jsx` → `appConfigService` → `providerSetupUpload`), never from a constant** (2026-09-02) — `aiServices.providerSetup.test.js` fails on any `const SETUP_MAX_* =` reappearing. `APP_CONFIG_DEFAULT_FLAGS` carries the launch fallbacks (10 MB / 20 pages) for the first render only, and `readSession` merges defaults under a cached value so a cache predating a key never reads as absent.
- No numeric processing-time estimate is shown (deliberate: the measurement — ~10 s per page on luna — arrived after the UI; add it only from a measured number). Keys ×5 (`public/lang`, ICU plurals); pins in `knowledgeGuards.test.js` (its `read` helper normalizes CRLF), `aiServices.providerSetup.test.js`, `knowledgePreflight.test.js`; ESLint 0 warnings.

## 2026-08-25 Pictures from a knowledge file — the per-document panel (SHIPS DARK)

`Voice:Knowledge:Images:Enabled`. The Knowledge page's document row gains ONE quiet line —
`6 pictures · 4 can be sent · Show pictures` — that opens `KnowledgeImagesPanel.jsx` IN PLACE beneath that
document. Owner rejected a third tab: pictures belong to a file, and the switch that governs them
(since 2026-09-07 the receptionist choice "Answers callers and can send them the details" — the old switch is gone) is on that row. Closed by default; one document open at a time.
‼️ Tiles draw `thumbnailUrl` ONLY — a grid must never pull full-size originals (40 × 2048px is tens of MB);
the viewer takes `getOriginalSrc`. 12 tiles then "Show N more". The tick is NEVER optimistic and is disabled
while the document is not shared. Delete lives in the viewer behind the portfolio's red confirm dialog; there
is no ADD. `canManage` hides both writes. Also shipped here: "Review below" → "Review", and the
suggestions-tab attention ring is now gated on `tab.count > 0` so it never rings an empty room.
Full contract: the `clinqet-voice-assistant` SKILL, "KNOWLEDGE IMAGE EXTRACTION & DELIVERY — PHASE A".

## 2026-08-29 Knowledge — "Analysing" chip, pending line, picture-tick feedback (web; mobile mirrors the rules)

- The analytics is its own queue job now (voice-assistant skill): a Ready row whose `serviceDraftAnalytics.outcome` is
  `Queued` renders `resolveAnalyticsLine → { variant: "pending" }` (`knowledgeDraftMeta.js`): an **Analysing** chip
  (`ANALYSING_META`, `AnalysingChip` in `KnowledgePage.jsx`) beside Ready — spinner only while
  `analyticsWatching`, hover or tap (tap-only devices) opens the themed explanation quoting `data.analyticsMaxMinutes` —
  the line "Checking for services and pictures to suggest…", and NO Re-run / Run again / Try again (`rerunAvailable`).
- Own ladder: `ANALYTICS_POLL_SCHEDULE_MS`/`resolveAnalyticsPollDelay` (`knowledgeMeta.js`), `analysingKey`,
  `analyticsPollExhausted` + `knowledge.poll.analysingStalled` notice with Refresh; ONE `visibilitychange` listener
  serves both ladders (`watchingAnything`).
- `components/common/AppTooltip.jsx` is the ONE tooltip look (the `TruncatedText` style; `TruncatedText` now renders it;
  `tapToOpen` ⇒ `openOnClick` on `(hover: none)`).
- `KnowledgeImagesPanel.jsx`: the tick that cannot send (no description) is ENABLED, dashed, carries the hover hint
  `knowledge.images.tick.noDescriptionHint`, and a click opens a dismissable `role="status"` notice
  (`knowledge.images.noDescriptionFeedback` — the reason + both remedies; `knowledge.images.dismissNotice`) — never a save.
  The viewer shows the same copy; `knowledge.images.noDescription` is gone.
- Tests: `knowledgeDraftMeta.test.js` (pending), `knowledgeGuards.test.js` (analytics ladder + page pins),
  `knowledgeImages.test.jsx` (explains instead of saving). Keys ×5 in `public/lang`.

## 2026-08-21 Knowledge → DRAFT SERVICES review queue ("Clinket AI Data Analytics") — partner web

- On the AI Knowledge page (`KnowledgePage.jsx`), between the documents and the FAQs: `KnowledgeServiceDraftsSection.jsx` (the review-queue box), `KnowledgeDraftEditModal.jsx` (edit / amber-intercept dialog), `knowledgeDraftMeta.js` (the RENDERING-RULES contract: `resolveDraftChips` / `resolveDraftActions` / `resolveApproveIntercept` / `resolveAnalyticsLine` + per-business localStorage for approval settings and the bulk run — change a rule in BOTH this file and the mobile `knowledgeDraftMeta.ts`, and both jest suites). API client functions in `knowledgeServices.js` (`GetKnowledgeServiceDrafts` … `RerunAllKnowledgeAnalytics`).
- Permissions: `voice.read` lists · `voice.settings.manage` edit/dismiss (+ the ··· menu) · `catalog.service.create` approve/batch/all · `catalog.service.update` approve-update / approve-as-change; absent via `can()`, never disabled controls (the page's existing TD-37.3 rule).
- Mockup v4 is the source of words since 2026-08-24 (`C:\Nik\Data\mockups\knowledge-page-redesign\index.html`; v3.1 remains for anything v4 does not restate): the box is TABBED (New services · Changes to your services · All = the list API's `kind` filter; default tab via `resolveDraftTab`), and **every mutating action confirms first** through ONE `confirmAction` state → `ConfirmationModal` (approve one / update one / approve-as-change / dismiss one / "Add the N shown" `approve-batch` / "Dismiss the N shown" / "Add all new services (N)" bulk loop / "Dismiss all changes (N)" `dismiss-by-kind` / dismiss-all-from-doc). Bulk buttons are business-wide with exact global counts (doc-scoped mass dismissal = the ··· menu only — per-document counts mix kinds). Approve on an amber card still opens ONLY the field in question with "Save and approve" (`__approveAfterSave` stripped before the PUT; the editor never double-asks); a stale ETag is a 412 → conflict toast + reload; name clash → "Approve it as a change"; the bulk loop keeps `excludeIds`, stops on server `remaining ≤ 0`, persists/resumes, never retries a failed item; the failed filter has a visible chip while on; settings live on one compact "New services are added at:" line (expandable); SignalR `KnowledgeServiceDraftsReady` bumps the box. Document rows: "{n} services suggested · Review below" (scrolls to `#knowledge-drafts-box`) / "No services found in this document · Run again" / "AI Data Analytics failed · Try again". `knowledge.drafts.*` keys ×5 catalogs (5700 total per file); price chips carry the business currency (`useCurrency`); the review-queue palette is the `knowledge.*` colour group in `tailwind.config.js` (never raw hex in these files). Backend/contract detail: the voice-assistant skill's 2026-08-24 section.

## 2026-08-14 AI setup remediation navigation

- Service rejection and `ServicePricingRequired` notifications resolve a tolerant service context and open `/dashboard/profile/manage-services-price?serviceId=...` using the existing editor modal. The page switches to the notification business first, checks `catalog.service.update`, point-loads the service, and safely falls back for missing, inaccessible, or unauthorized services.
- `ServicePricingRequiredSummary` opens Notifications outside onboarding. While any onboarding step owns the journey, its SignalR banner may display but clicking it cannot navigate or expose the dashboard.
- The summary is transient and is not marked read because it has no durable inbox row. Individual remediation rows remain durable and independently actionable.
- No new page, component surface, or mockup-gated UI was introduced; the existing notification, service-card, loading, error, and editor states are reused.
## ABSOLUTE RULES (READ FIRST — APPLIES TO EVERY CHANGE)

- **Comments — terse, only when they earn their place.** Default to no comments; let naming carry the meaning. **However**, write a comment when it captures non-obvious context the code itself cannot show: a hidden invariant, a subtle ordering constraint, a deliberate workaround for a known bug, a defensive choice with a real reason, or an RFC/spec citation that explains *why*. Prefer a single short line. Forbidden: restating WHAT the code does (e.g. `// increment counter` above `counter++`); multi-line narrative blocks explaining design rationale; XML doc summaries on properties whose names already convey intent; commented-out code; `// TODO` without an issue link. When in doubt, delete the comment — but don't strip a *real* WHY-comment just to chase zero.
- **No verbose docstrings on self-evident members.** A property named ``EnableAISpellCorrection`` does NOT need a doc summary. A field named ``_searchEnableAISpellCorrection`` does NOT need a multi-line ``//`` block above it. Trust naming.
- **No commented-out code, no leftover symbols, no ``// TODO`` without an issue link.**

---


## OVERVIEW

The Partner/Provider App is a Next.js 16 application where service providers manage their business: categories, services, bookings, quotes, invoices, CRM, calendar, and public profile ("Open Page").

- **Path**: `C:\Nik\clinqetwebpartnerapp\`
- **Framework**: Next.js 16.1.6 | React 19.2.0 | Tailwind CSS 3.4.17
- **State Management**: Redux Toolkit 2.9.0
- **Forms**: Formik 2.4.6 + Yup 1.6.1
- **HTTP Client**: Axios 1.8.4
- **i18n**: react-intl 7.1.11 (4 active languages: en, fr, gu, hi; Spanish authored but hidden)
- **Real-time**: @microsoft/signalr 8.0.7
- **Auth**: JWT + Passkey (SimpleWebAuthn)
- **Build**: Standalone output for containerized deployment

---

## ABOUT US / "WHY CLINKET FOR PROVIDERS" (static)

- Shared content `src/components/about/WhyClinketProviders.jsx` (sectioned value-prop via `t("providerAbout.*")`) is reused by TWO routes:
  - Public + SEO-indexable: `src/app/about-us/page.jsx` + `layout.js` (`createMetadata` `noIndex:false`; own marketing header with logo + Sign in + Get started, hero band, closing CTA → `RegisterRoute.RegisterPage`).
  - Gated profile: `src/app/dashboard/profile/about-us/page.jsx` + `layout.js` (`noIndex:true`), listed in the profile **Legal** nav group in `src/app/dashboard/profile/layout.jsx`. Route constant `ProfileRoute.AboutUs`.
- Copy keys `providerAbout.*` + `profile.AboutUs` exist in all 4 `public/lang/*.json` (en/hi/gu translated; ja = English placeholder).

---

## DIRECTORY STRUCTURE

```
src/
├── api/                    # HTTP method wrappers (getApi, postApi, putApi, patchApi, deleteApi, url.js)
├── app/                    # Next.js App Router
│   ├── auth/              # Auth pages (login, register, password reset)
│   ├── context/           # IntlContext.jsx (react-intl), LayoutWrapper.jsx
│   ├── dashboard/         # Protected routes (bookings, quotes, invoices, calendar, customers, inbox, etc.)
│   ├── onboarding/        # Provider onboarding flow
│   ├── public/            # Public (non-auth) pages
│   ├── layout.js          # Root layout with SEO metadata
│   ├── page.js            # Landing page
│   ├── robots.js          # Dynamic robots.txt
│   └── error.js / not-found.js / loading.js
├── assets/images/         # Static images
├── components/            # React components (18 categories)
│   ├── auth/             # Login, register forms
│   ├── booking/          # Booking components
│   ├── calendar/         # FullCalendar integration
│   ├── common/           # 50+ reusable UI components
│   ├── customers/        # Customer management
│   ├── dashboard/        # Dashboard layout (Sidebar, Header, home)
│   ├── gallery/          # Image gallery
│   ├── invoice/          # Invoice forms
│   ├── onboarding/       # Multi-step onboarding
│   ├── profile/          # Profile management
│   ├── public/           # Open Page (public provider page)
│   ├── quotes/           # Quote components
│   └── ui/               # Basic UI primitives (Loader, buttons)
├── context/               # AuthContext.jsx, SignalRProvider.jsx
├── helpers/               # Google Maps styles
├── hooks/                 # 17 custom hooks
├── lib/                   # Utilities (apiClient, SEO, validation, OTP, motionConfig)
├── middleware/            # EnhancedPrivateRoute, PrivateRoute (route guards)
├── redux/                 # Store + 5 slices (profile, notifications, dashboard, invoices, currency)
├── routes/                # Route path constants (routeConfig.jsx)
├── services/              # 19 API service files
└── utils/                 # 25+ utility files
```

---

## API CLIENT PATTERN

### Axios Instance (lib/apiClient.js)

```javascript
const apiClient = axios.create({
    baseURL: process.env.NEXT_PUBLIC_BASE_IDENTITY,
    timeout: 30000,
    headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
    withCredentials: false
});
```

### Request Interceptor
1. Applies observability headers: `X-Correlation-Id`, `X-Session-Id`, `X-Device-Id`, `X-Client-Version`
2. Attaches the in-memory access token (waits for the page-load restore; records the token + its sub/SessionId/BusinessId per request)

### Response Interceptor — Token Refresh Flow
- **200-399**: Return response
- **401**: renew from the HttpOnly session cookie (single-flight) and replay only under the same sub + SessionId + BusinessId; `session_context_changed` rebuilds the workspace and is never replayed; `session_ended` acts only for the tab's current session after one renew. 503 `session_unavailable`: bounded retry under the same identity. See `clinqet-auth-sessions` §3/§8
- **403**: Clear session → redirect to login
- **429**: Reject with backoff

### HTTP Wrapper Methods (api/ folder)

```javascript
import getApi from '@/api/getApi';
import postApi from '@/api/postApi';

// Usage
const response = await getApi.get(`${API_URL}/bookings`);
const response = await postApi.post(`${API_URL}/bookings`, payload);
```

### URL Configuration (api/url.js)
- Centralized endpoint definitions
- Environment variables: `NEXT_PUBLIC_BASE_IDENTITY` (auth), `NEXT_PUBLIC_BASE_API` (main API)

---

## AUTH PATTERN

### AuthContext (context/AuthContext.jsx)
Wraps `useAuthManager` hook providing:
```javascript
const { isAuthenticated, isLoading, user, authChecked, checkAuth, refreshTokenIfNeeded, getUserInfo, logout } = useAuth();
```

### Token Storage (utils/sessionStore.jsx) — rewritten 2026-09-29
- The access token lives in page MEMORY only; the session is the HttpOnly `__Host-ClinketSession-Business` cookie,
  renewed once per page load by `services/sessionRecovery.js`. No refresh token exists in the browser.
- Stored values are plain JSON `{data, timestamp, customExpiry}`; legacy CryptoJS values (`U2FsdGVkX1…`) are
  treated as absent and removed; legacy `token`, `forgotPasswordToken`, `isLoggingOut`, `passkey_testing_mode` swept.
- Sign-out: `services/signOutService.js` sets `clinket.auth.signOutPending` first, purges locally, and clears the
  marker ONLY on HTTP 200; `clinket.auth.account` marks the signed-in account (another account in another tab ⇒
  drop the token and reload). `PRESERVED_KEYS_ON_CLEAR` keeps device id, language, country, remembered email/OTP id,
  sidebar/queue view prefs and the marker.
- One JWT decoder: `src/lib/jwtClaims.js`. Production CSP: `src/lib/contentSecurityPolicy.js` via `next.config.mjs`.
- ‼️ Audit round 2 (2026-09-30):
  - `SessionStore.clear()`/`clearAccountData()` REMOVE each non-kept key and never call `clear()` or write a kept key
    back — a write-back fired a storage event per tab and two tabs purged each other forever while a sign-out was
    pending. The cross-tab purge does nothing in a tab holding no token and no account data (`holdsAccountData()`).
    Playwright two-tab check in `e2e/tests/auth/refresh-session.spec.js`.
  - `apiClient` records the session epoch per request; an answer to a request that carried a token is rejected
    (`CanceledError`) once the epoch moved, so a late answer never writes account data back after sign-out.
  - `tokenRefreshService`: `MIN_TRUSTED_LIFETIME_SECONDS = 120` (a token arriving with ≤120 s by the device clock is
    only renewed on a 401 — a fast clock no longer loops); a renewal answered after a sign-out started is never adopted.
  - Landing: a `session_ended` refusal with a token still held goes to the dashboard (no endless loader).
    `?experience=` is honoured only once the load knows nobody is signed in (`ExperienceFromLink` awaits the restore).
  - Language: `IntlContext` resolves stored choice → account `preferredLanguage` (no new request) → browser → `en`.
  - CSP: Google's Maps JavaScript API allow-list per directive; development sends the same headers except HSTS.
    Return paths must match `/^\/(?![/\\])[^\s\p{Cc}]*$/u`.
- ‼️ Audit round 3 (2026-09-30):
  - Sign-out order (`utils/navigation.jsx` `logoutFun`): marker set, local purge + announce at once, route to login, then
    `POST logout` (cookie only, no bearer). Only a 200 settles it, and only the marker THAT sign-out wrote
    (`markSignOutPending` returns it; `settleSignOutPending(marker)`).
  - `clinket.auth.signInInFlight` (a timestamp, 60 s limit, kept through purges): `apiClient` marks it when a
    session-starting call goes out and removes it when the answer carries no session; `persistSignInSession` clears it;
    `confirmPendingSignOut` does nothing while it is live. Known limit (server-side only): a logout already on the wire
    when a sign-in's Set-Cookie lands can still delete the new cookie.
  - Every sign-in purges inside `persistSignInSession` (account data cleared, epoch moved) — no path can skip it.
  - Every path that drops a token calls `discardPendingRenewal`, including the cross-tab no-op guard. A cross-tab purge
    keeps a half-done sign-in (`keepSignInFlow`) when the tab holds no session. `settleSessionEnded` waits for this tab's
    security changes (`trackSecurityChange` / `continueAfterSecurityChange`). A restore purges only when the token held
    now is the one it observed.
  - The device clock never judges a token outside the renew schedule: the restore hands a held token on as it is,
    SignalR connects on any token, never retries a refused one and allows one restart per refusal;
    `SessionStore.isValidToken` is gone. Retry-After is capped at 30 s. `logout/all` waits for the restore and is never
    re-sent. `getApi` never lets a new read join one in flight from an older epoch.
  - A cancelled request (`isCancelledRequest`) is silent in `showError` / `resolveErrorMessage`; services rethrow through
    `responseOrCancellation(err)` (`services/apiError.js`, guard test); the cancel reason is `Session.SignInChanged` (5 locales).
  - CSP adds `*.google.ca`, `*.google.co.in` (img/connect), `pagead2.googlesyndication.com` (connect) and the Tag Manager
    preview styles; `contentSecurityPolicy.test.js` derives every `https`/`wss` host from `src` (floor + known-host check).
    Tags added inside the GTM container are still blocked by design (owner item). Deleted dead `utils/countryList.jsx`,
    `common/FreeAISuggestBox.jsx`. The mobile half of `soloTransitions` moved to the mobile repo (`teamCountRefresh.test.ts`).

### Route Protection (middleware/EnhancedPrivateRoute.jsx)
- Wraps dashboard routes
- Redirects unauthenticated users to login
- Shows loading skeleton during auth check

---

## COMPONENT PATTERNS (MANDATORY)

### Styling: Tailwind CSS Only
- Utility-first classes — NO CSS modules
- Mobile-first responsive: `xs`, `sm`, `md`, `lg`, `xl`, `2xl`, `3xl`
- Safe area insets: `safe-top`, `safe-bottom` for notched devices
- Fluid typography: `text-responsive-base`, `text-responsive-lg` using `clamp()`
- Brand colors used inline: `border-[#FF3B30]`, `bg-[#F5F5F5]`, `text-[#032858]`

### Form Pattern: Formik + Yup

```jsx
<Formik
    initialValues={{ email: '', password: '' }}
    validationSchema={myYupSchema}
    onSubmit={async (values, { setErrors, setSubmitting }) => {
        try {
            const response = await postApi.post(url, values);
            // handle success
        } catch (err) {
            // extract and set errors
        } finally {
            setSubmitting(false);
        }
    }}
>
    {({ values, errors, touched, handleChange, setFieldValue, isSubmitting }) => (
        <Form autoComplete="off">
            <FloatingInput
                placeholder="Email"
                name="email"
                onChange={handleChange}
                values={values.email}
                error={errors.email && touched.email ? errors.email : ''}
            />
        </Form>
    )}
</Formik>
```

### Floating Input Component (components/common/floatingInput.jsx)
Standard input with floating label animation, error state, end adornment support.
- Always use existing `FloatingInput`, `FloatingPasswordInput`, `FloatingTextarea`, `FloatingSelect`, `FloatingMultiSelect` components
- Error color: `#FF3B30` (red)
- Focus color: green
- Background: `bg-[#F5F5F5]`

### Page Component Pattern

```jsx
"use client";

const MyPage = () => {
    const { setAdminDashboardLoading } = useLoader();
    const { profile, loading } = useBusinessProfile({
        onSuccess: () => setAdminDashboardLoading(false),
        onError: (err) => { /* handle */ }
    });

    return (
        <div className="flex flex-col gap-[30px]">
            {/* Mobile-only section */}
            <div className="block xl:hidden">...</div>
            {/* Responsive grid */}
            <div className="gap-4 sm:gap-5 lg:gap-[30px] grid 2xl:grid-cols-4 xl:grid-cols-7">
                <div className="2xl:col-span-3 xl:col-span-5">
                    {/* Main content */}
                </div>
            </div>
        </div>
    );
};

export default MyPage;
```

### Loading & Error States
- Loading: `useLoader()` context, `isLoading` flags in hooks
- Errors: `showError(message)` / `showSuccess(message)` via react-hot-toast
- Error extraction: `errorHandler.js` → priority: `errors[]`, `message`, `error`, fallback

### Reusable Common Components (50+ in components/common/)
Key components to reuse (never recreate):
- `FloatingInput`, `FloatingPasswordInput`, `FloatingTextarea`, `FloatingSelect`
- `FloatingMultiSelect`, `FloatingMobileNumberInput`, `FloatingDateInput`
- `CustomCheckbox`, `CustomToggleSwitch`, `RadioGroup`
- `Pagination`, `Loader`, `OptimizedLoader`
- `ConfirmationModal`, `ActionConfirmationModal`
- `Avatar`, `ImageUploadBox`, `DragDrop`
- `NotificationDropdown`, `NavigationProgressBar`
- `ErrorBoundary`, `GlobalErrorBoundary`

---

## STATE MANAGEMENT: REDUX TOOLKIT

### Store Configuration (redux/store.jsx)
```javascript
configureStore({
    reducer: {
        currency: currencyReducer,
        dashboard: dashboardReducer,
        invoices: invoiceReducer,
        notifications: notificationReducer,
        profile: profileReducer,
    }
});
```

### Key Slices
- **profileSlice**: `fetchUserProfile` async thunk, `setFriendlyName`, `clearProfile`
- **notificationSlice**: Notifications array, unread count, SignalR state, pagination tokens
- **invoiceSlice**: Invoice list/details
- **dashboardSlice**: Dashboard statistics
- **currencySlice**: Currency selection

### Usage Pattern
```javascript
import { useSelector, useDispatch } from 'react-redux';
import { fetchUserProfile } from '@/redux/profileSlice';

const dispatch = useDispatch();
const { userProfile, loading } = useSelector(state => state.profile);

useEffect(() => { dispatch(fetchUserProfile()); }, [dispatch]);
```

---

## LOCALIZATION: react-intl

### Provider (app/context/IntlContext.jsx)
```jsx
import { IntlProvider } from "react-intl";
import en from "../../../public/lang/en-US.json";
```

### Usage in Components
```jsx
import { FormattedMessage, useIntl } from "react-intl";

// JSX
<FormattedMessage id="sidebar.dashboard" />

// Programmatic
const intl = useIntl();
const label = intl.formatMessage({ id: "sidebar.calendar" });
```

### Language Files
- `public/lang/en-US.json` (English)
- `public/lang/fr-CA.json` (French)
- `public/lang/gu-IN.json` (Gujarati)
- `public/lang/hi-IN.json` (Hindi)
- `public/lang/es-US.json` (Spanish, authored but hidden)

### Rules
- ALL user-facing text must use localization keys
- New keys must be added to ALL language files
- Do not inline English default messages; exact locale parity makes them unnecessary

---

## SEO PATTERN

### Root Metadata (app/layout.js)
- Uses Next.js metadata API with metadataBase, title template, OpenGraph, Twitter cards
- Icons: multiple favicon sizes, apple-touch-icon, web manifest

### Route-Level Metadata (lib/seo/seo.jsx + seoConfig.js)
```javascript
export const metadata = createRouteMetadata("invoices");

// Or with overrides
export const metadata = createRouteMetadata("calendar", {
    title: "Custom Title"
});
```

### Centralized SEO Config (lib/seo/seoConfig.js)
`PAGE_SEO` object with per-route SEO data (title, description, path, keywords).

### Sitemap Generation
- Runs during `npm run build` via `generate-sitemap` script
- Uses `globby` to discover all page routes
- Outputs `public/sitemap.xml`

---

## SIGNALR INTEGRATION

### Provider (context/SignalRProvider.jsx)
- Connects to `/api/v1/hubs/notifications` with JWT token
- Dispatches Redux actions for real-time notifications
- Auto-reconnects on disconnect

---

## ESLINT RULES (MUST PASS — ZERO ERRORS)

Run after every UI change:
```bash
npm run lint
```

Key enforced rules:
- `no-unused-vars` (args/vars prefixed `_` are ignored)
- `eqeqeq: always` — strict equality only
- `no-eval`, `no-implied-eval`, `no-new-func` — security
- `react/jsx-pascal-case` — PascalCase components
- `react/jsx-key` — keys in lists
- `react-hooks/rules-of-hooks` — hooks at top level only
- `react-hooks/exhaustive-deps` — dependency arrays
- `jsx-a11y/*` — accessibility enforcement

---

## SCRIPTS

```bash
npm run dev         # Development server (TLS warning suppressed)
npm run build       # Production build + sitemap generation
npm run lint        # ESLint check (MUST pass with 0 errors)
npm run lint:fix    # Auto-fix lint errors
npm run clean       # Clean build artifacts
```

---

## KEY FILES TO READ BEFORE CHANGES

1. `src/lib/apiClient.js` — HTTP client setup & interceptors
2. `src/context/AuthContext.jsx` — Auth state management
3. `src/redux/store.jsx` — Redux store configuration
4. `src/app/context/IntlContext.jsx` — Localization setup
5. `src/lib/seo/seoConfig.js` — SEO configuration
6. An existing page/component similar to what you're building

---

## CHECKLIST BEFORE SUBMITTING PARTNER APP CHANGES

- [ ] All text uses `<FormattedMessage>` or `useIntl()` — no hardcoded strings
- [ ] New i18n keys added to ALL 4 language files
- [ ] Tailwind CSS only — no inline styles, no CSS modules
- [ ] Forms use Formik + Yup validation
- [ ] Existing common components reused (FloatingInput, modals, etc.)
- [ ] Error handling with toasts (showError/showSuccess)
- [ ] Loading states handled properly
- [ ] Mobile-responsive design (xs through 2xl breakpoints)
- [ ] Route protection with EnhancedPrivateRoute for dashboard pages
- [ ] SEO metadata added for new pages (PAGE_SEO config)
- [ ] `npm run lint` passes with zero errors
- [ ] `npm run build` succeeds
- [ ] No console.log or debug code left
- [ ] Accessibility: alt text, ARIA attributes, semantic HTML

## Legal Policy Pages — Comprehensive Fallback + userapp lookup (2026-06-07)

Five profile components render region-specific legal docs via `services/policyService.getPolicyContent(country, "partner", type)`: `src/components/Profile/{PrivacyPolicy,TermsOfService,CookiePolicy,CommunityGuidelines,VerificationPolicy}.jsx` (types `privacy | terms | cookie | community | verification`).

`SHARED_USERAPP_POLICY_TYPES` in `services/policyService.js` now holds ALL five legal types (was just `privacy`): every legal doc is seeded only under the `userapp` code (no `partnerapp`-coded legal docs exist) and is authored for Consumers + Partners alike, so the partner app resolves them under `userapp` and shows real region content. Only `faq` stays per-app. Before this fix, partner Terms/Cookie/Community/Verification ALWAYS fell back to static content.

On true API failure each component renders `getPolicyFallbackContent(type)` from `src/utils/policyFallbackContent.js` — a **faithful merge** of the real per-region documents (most complete region's text + the other regions' divergent clauses merged in to cover India/US/Canada), sourced from `cosmosindexsetup/Documents/clinket-legal-center.html`, DOMPurify-sanitized. Replaced the old weak inline `getDefaultContent` stubs. Kept in sync with the user app's `utils/policyFallbackContent.js`.

## Privacy Policy Consent (2026-05-22)

Three new pieces mounted globally in the app shell (`components/common/Providers.jsx` for the customer app, `src/app/layout.js` for the partner app):
- `components/consent/PolicyReconsentModal.jsx` — hard-block modal (no close X, no backdrop dismiss, no Escape). Subscribes to `services/policyConsentBus` and resolves the awaiting axios call when the user clicks Accept (POSTs `/auth/accept-policy`, stores the refreshed access token via `SessionStore.setToken`) or Decline (clears session, redirects to `/account-paused`). Content is sanitized via DOMPurify; effective date rendered via `Intl.DateTimeFormat`.
- `components/consent/PolicyConsentChecker.jsx` — runs once per authenticated session via `useAuth()`; calls `getConsentStatus` and emits to the bus if `isCurrent === false`.
- `app/account-paused/page.jsx` — static page shown when the user declines re-consent.

Axios response interceptor (`services/api.js` for customer, `src/lib/apiClient.js` for partner) handles HTTP 409 where `data.message === "policy_update_required"`: stores `_policyRetry = true` to prevent loops, awaits `policyConsentBus.emit(currentPolicy)`, and on Accept retries the original request with the new bearer token.

Register form (`components/auth/registerForm.jsx`) adds a Jurisdiction select (`in`/`us`/`ca`, defaulted via `mapCountryToJurisdiction(detectUserCountry())`), fetches the current privacy policy via `getCurrentPolicy(jurisdiction)` on mount + jurisdiction change, includes `PrivacyPolicyVersion`/`PrivacyPolicyHash`/`PrivacyPolicyJurisdiction` in the multipart payload, and on backend 409 `policy_version_mismatch` re-fetches + shows an inline `Privacy_Register_Error_PolicyStale` warning without auto-submitting.

`services/policyService.js` exports `getCurrentPolicy(jurisdiction, policyType)` (5-min in-memory cache), `mapCountryToJurisdiction(countryCode)`, and `invalidateCurrentPolicyCache()`. The partner app's `getCurrentPolicy` uses the explicit `${url.OWNER_URL}/api/v1/public/policy/current` URL since `apiClient` baseURL points to the Identity API.

Localization keys: `Privacy_Modal_*`, `Privacy_Register_*`, `Privacy_Declined_*`, `common.something_went_wrong`, `common.loading` (in `public/lang/en-US.json`). Backend mirror keys live in `clinqetinfrastructure/Resources/Localization/en.json`.

## Analytics instrumentation (full coverage since 2026-07-02 — analytics-recs Phase A3)

The `clinqet-analytics` skill owns the taxonomy — every EventSubType/surface string there is a cross-platform contract (provider mobile mirrors byte-exactly). Partner-app specifics:

- Tracker `src/services/analyticsTracker.js` (35 helpers incl. `trackBilling`/`trackInsights`, which default surface to `dashboard.billing`/`dashboard.analytics` — pass an explicit surface anywhere else). `PageViewTracker` + `useDwell`/`useScrollDepth` hooks as on the customer app.
- Billing (`components/billing/*`): full `BillingAction` funnel — page/plan-card/AI-section views on mount (ref-guarded), plan upgrade/downgrade open→confirm→success/fail through the shared `ConfirmDialog` via an optional `confirm.analytics = {confirm, success, fail}` object consumed by `runConfirm` in `Billing.jsx`, Stripe checkout events in `UpgradeModal`/`AddCardModal`, top-ups + auto-recharge, promo (never the code string), history + receipts. Upsell CTAs outside billing (`AiAssistantUpsellCard`, `VoiceAssistantPromo`) emit `upgrade_cta_click` with their host surface.
- Insights (`components/insights/InsightsView.jsx`): `InsightsAction` page/card/locked-card views once per mount, area tabs, upgrade CTA, error refresh + `useDwell("dashboard.analytics")`.
- Voice settings (`components/Profile/voiceAssistant/*`, surface `profile.ai_assistant`) + call history (`components/callFollowUps/*`, surface `call_followups`): `VoiceCallAction` settings/history verbs; the live-call join funnel (`join_attempt`/`join_call`/`quality`) predates A3 — don't duplicate it.
- Payment settings (`components/Profile/PaymentSettings.jsx`): `ProfileEditAction` on surface `profile.payment_settings` (billing = money TO Clinqet ⇒ BillingAction; payment settings = money FROM customers ⇒ ProfileEditAction).
- Dashboard-home widgets: every widget emits `NavigationAction` with surface `dashboard_home.<widget>` + metadata `{widget, target}` (exact names in the clinqet-analytics skill). Long lists (bookings/invoices/quotes/leads) carry `useScrollDepth`; the inbox intentionally has dwell only (inner-container scroll).
- No jest infrastructure exists in this app (Playwright e2e only) — analytics changes are verified by `npm run build` + `npm run lint` (both must be clean) and a dev-tools payload spot-check.

### 2026-07-03 audit-session additions
- Insights: Peak Times weekday now formatted with timeZone UTC (device-timezone rendering showed all of CA/US the prior weekday); `svc.priceType` localized via `Analytics.PriceType.*` ×4 langs; week labels/`h` suffix/MAX badges localized; area-tab highlight uses the same clamped index as the content; + the 3 new Premium cards (lead_open_rate, search_visibility, view_to_inquiry — `card_view` is now 20 metric names; see `clinqet-smart-analytics`).
- Tracker: the analytics endpoint URL strips a trailing slash from `OWNER_URL`; metadata capped at enqueue (20 pairs / 256 chars, mirroring the server caps).
- New instrumentation: `public_track_bookings` guest funnel (`guest_lookup_submit/success/fail`, `view_detail` {status}, cancel trio — no guest email/phone/OTP ever) + `do_not_sell_share` ConsentAction `data_processing_restrict` {enabled} (+ surface-map fix, was hyphenated).
- Manual-booking `trackBookingInitiated` now carries the REAL `providerId` (payload-root businessId); the hollow `customerId` was dropped.


## Shared limit system + WhatsApp meters + sunset banner + founder ribbon (2026-07-11, sessions 1+2)

> ‼️ The sunset banner, the founder ribbon and the Basic wording below were removed on 2026-10-04 — see "Two plans" below.

- **One theme system (Track D):** `src/components/common/limits/UsageMeterCard.jsx` (idPrefix-driven keys `.title .summary .remaining .reached .upgradeHintNear .upgradeHintAt .upgradeCta`; canonical palette — normal lime `#97EF29/#F0FFE1/#2F7D00`, near amber `#E08600/#FFF6E8/#9A5B00`, at-limit red `#C63535/#FFF1F1`; navy CTA; renders null when caps off/unlimited) + `UpgradeNudge.jsx` (white card, red icon chip, navy CTA). Consumers: leads list meter, lead-detail block state, billing WhatsApp meter.
- **Billing page (`Billing.jsx`):** WhatsApp daily meter (`idPrefix="billing.whatsapp.usage"`, lazy fail-quiet fetch of `GetWhatsAppUsage()`; blocked (Free) ⇒ `UpgradeNudge` (the "included from Basic" copy is gone since 2026-10-04); CTA = in-page anchor `#billing-plans` — the plans grid carries that id + `scroll-mt-24`). ~~**Founder ribbon**~~ (deleted 2026-10-04 with `overview.founderOffer`) rendered when `overview.founderOffer` present (server-gated: sunset window + Free tier + cohort): lime card, `billing.founder.*` keys, per-code Apply buttons through the standard `ApplyPromo` flow + overview refresh.
- **Inbox (`inbox/page.jsx`):** at-limit/blocked strip above the composer for WhatsApp-channel threads only (`GetWhatsAppUsage()` lazily ONCE per mount, fail-quiet); copy states the provider's own WhatsApp alerts fall back to SMS/in-app — the chat itself is never limited; CTA gated `useBillingUiEnabled`. Keys `inbox.waLimitStrip/waPlanBlockedStrip/waLimitCta`.
- ~~**Sunset countdown banner**~~ (DELETED 2026-10-04 with its test, the AppConfig sunset fields and the `sunset.banner.*` keys): `src/components/dashboard/layout/SunsetCountdownBanner.jsx`, mounted in the dashboard layout between Header and content (own ErrorBoundary). Live only in `[sunsetAnnounceAtUtc, sunsetCutoverAtUtc)` from AppConfig (`appConfigService` normalizes the 3 sunset fields fail-safe); dismiss = localStorage `clinket.sunsetBanner.dismissedOn` = today (per-day re-show); CTA → `/dashboard/billing` gated billing-surface. Keys `sunset.banner.*` en/hi/gu.
- `utils/notificationNavigation.js`: the `Sunset*` routes were deleted 2026-10-04; `PLAN_LIMIT_NOTICES` (`LeadQuotaReached`, `WhatsAppSendCapReached`, `WhatsAppPlanBlocked` SystemNotifications) → `dashboardRoute.billing`.
- New service fns: `GetWhatsAppUsage` (`billingService.js`) + `ProviderBillingWhatsAppUsageAPI` (`api/url.js`).

## Two plans — Free + Premium (2026-10-04)

Authority `C:\Nik\Data\two-plan-pricing\PLAN.md` + `UI-CONTRACT.md`. Provider mobile mirrors every item (see `clinqet-provider-mobile`).

- **Plan cards:** `src/components/billing/PlanCard.jsx` (new) — `PLAN_COPY` has only `Free` and `Premium` (Premium is the recommended card); `planFeatureLines(plan)` appends the limit lines from the overview row: `leadsPerMonth` (`null` ⇒ `billing.tier.leadsUnlimited`), `whatsAppPerDay` (`null` ⇒ unlimited, `0` ⇒ no line), `teamSeats` (`null` ⇒ unlimited). Never hardcode 5 / 10 / 200 / 50 or a price. `Billing.jsx` lost `TIER_ORDER`, the Basic copy, the founder ribbon and the paid-to-paid switch flow (`changePlanTier` / `quoteForSwitch` — Free→Premium is a subscribe, Premium→Free a cancel). `UpgradeModal` lost `promoFree` / "Free now". `utils/billingTiers.js` names only Free and Premium.
- **Locked lead card:** `components/leads/LockedLeadCard.jsx` adds `LimitReached` beside `Waiting` / `Missed` (amber look, `leads.limit.*` keys). CTA `leads.usage.upgradeCta` ("Unlock with Premium") → `BILLING_PLANS_ROUTE`, or `billing.trial.startTrial` when `utils/planTrialOffer.js` `planTrialDays(overview)` finds a live plan trial; a member without `billing.read` sees the text without a button. The lead detail page renders the locked card that the API now returns (200) instead of a 429 wall when the monthly limit is used; bid / ask still 429.
- **WhatsApp limit strip:** `components/whatsapp/WhatsAppLimitStrip.jsx` (new) in `inbox/page.jsx` — `inbox.waPlanBlockedStrip` / `inbox.waLimitStrip` / `inbox.waLimitStripUpgrade`; the at-limit variant hides once the UTC day passes the fetched period; the `inbox.waLimitCta` button shows only when `usage.upgradeAvailable === true`.
- **`UsageMeterCard.jsx`:** reads `usage.upgradeAvailable`; without it the hint is `.resetHintNear/.resetHintAt` and the upgrade button is hidden — Premium is never told to upgrade. `UsageMeterCard` and `UpgradeNudge` CTAs are now brand green.
- **Team seats:** `lib/tenancy/renderingRules.js` `seatCardCopy` — see `clinqet-provider-teams`.
- **Yearly (D15, 2026-10-05):** yearly = exactly 12 × monthly (`annualPriceMinor`), always offered for the plan and the AI
  add-on; `overview.annualBilling` is gone. `IntervalToggle` (Monthly | Annual) shows whenever the product carries a yearly price
  and starts on Monthly (`planInterval` / `aiInterval` = `"Month"`). The only yearly saving is a promo with "Apply to annual
  plans": `PromoAnnualChip` beside the toggle (`billing.annual.promoSaving[Plain]`, only when a row carries
  `discountedAnnualPriceMinor`) and `AnnualBilledNote`, which crosses out the yearly total beside the promo price
  (`billing.annual.billedAnnuallyStrike`). No "Save {pct}%" / months-free chip and no monthly-price strikethrough.
- **Insights:** `InsightsView.jsx` shows every metric to Premium; no "MAX" tag.
- **Removed:** `SunsetCountdownBanner.jsx` + test, the AppConfig sunset fields (`appConfigService.js`, `AppConfigContext.jsx`), the `Sunset*` / `SubscriptionUpgraded` notification routes and `providerStateEvents` entries, `isPromo`, `founderOffer`, `pendingTier`, the Basic / PremiumMax names.

## Tier-limits final audit fixes (2026-07-16)

- `leads/[id]/page.jsx`: silent refreshes never pop the quota wall/toast; a successful load resets a stale wall (post-upgrade recovery).
- `Billing.jsx`: the WhatsApp usage fetch is additionally gated on the overview having loaded (`overviewLoaded`) — exactly one usage GET per cold mount (the pre-skeleton run used to double-fetch).
- `UsageMeterCard.jsx`: the track carries `role="progressbar"` + `aria-valuenow/min/max` + `aria-label`, mirroring the voice `UsagePanel` convention.
- New key `WhatsApp.Toast.CapReached` (en-US/hi-IN/gu-IN) + `OUTREACH_RESULT_META.CapReached` — honest at-cap CRM outreach toast (split from PlanBlocked).
- Owner mockup `payments-plan/mockups/tier-limit-upgrade-ux/index.html` re-synced to shipped copy (4 adjacent-program strings) and republished: https://claude.ai/code/artifact/369fec5b-f7a2-44d5-af9a-74ee144b4ffb (the original artifact URL was deleted).


## BUSINESS TIMEZONE DISPLAY + OVERRIDE (2026-07-16)

- `src\services\timezoneService.js` — `GetBusinessTimezone()` / `UpdateBusinessTimezone(timeZoneId|null)` against `api/v1/business/profile/timezone`; `src\utils\timezoneDisplay.js` maps the 15 curated US/CA IANA ids to `Timezone.Zone.*` intl keys + client-side `Intl.DateTimeFormat` now-previews (zero API calls).
- Touchpoints (ALL gated on `canOverride === true` — India renders nothing): `Profile\BusinessTimezoneSection.jsx` on the Business Address page (row + Change → inline searchable dropdown + Reset-to-detected when Manual; state refreshed from the PUT response, never a re-GET); onboarding `BusinessDetails.jsx` quiet "Timezone detected" line after address save; `common\TimezoneCaptionStrip.jsx` above the SetAvailability weekly editor (Change link only in dashboard context).
- Call budget (owner mandate): 1 GET per surface on load/after-save; PUT only on explicit selection; previews/labels 100% client-side. 28 `Timezone.*` keys exist in all 4 locale files (en-US/fr-CA/hi-IN/gu-IN/es-US (Spanish hidden)).
## Booking payment panel + cancel note (2026-07-17)

- `BookingsDetails.jsx`: flag-gated payment panel (`appConfigLoaded && onlineBookingPayEnabled && details.payment && status!=="None"`) after the Order Summary — Hold placed (+amount) / Awaiting customer confirmation / Collected {amount} / Paid out {amount} / Collection failed / Refunded, from `payment.status` + `providerConfirmedCompletedAt`/`customerConfirmedCompletedAt`; mutual-capture disclaimer + `providerPay.markCompleteHint`. `ActionStatusModal.jsx` shows `providerPay.cancelNote` on both cancel paths when `booking.payment.status` is `Authorized` or `Vaulted` (see 2026-09-29 Booking decisions). `providerPay.*` keys (13) ×4 locales. The refund-requests inbox (`/dashboard/refund-requests`) is now LIVE — the backend 403 auth bug is fixed (see clinqet-payments).

## Service areas: default area + round-trip discipline (2026-07-20)

- **Round-trip rule (applies beyond service areas).** The service-area `POST` and `PUT` both return the **full saved entity** (`ApiResponse<ServiceArea>.Created(...)` / `.Ok(...)`). Consume the response and rebuild local state — **never refetch the list after a mutation.** Add / edit / delete are now **one API call each**. `ServiceArea.jsx` carries the in-code note "POST/PUT both return the saved entity, so the list is rebuilt locally instead of refetched"; `applySavedArea` merges the returned entity, and the list endpoint is called only once from the mount `useEffect`.
- **An unchanged Save makes ZERO calls.** `ServiceArea.jsx` keeps `serverSnapshotRef` (a `JSON.stringify` of what the server last confirmed, maintained by `commitAreas`) and short-circuits the submit when the sole area is unchanged. This used to re-PUT on every Save, which triggered a **business-wide search reindex for nothing**. Do not remove the dirty check. (It only covers the single-area case — with 2+ areas the list Save is already a no-op and edits persist through the per-area modal instead.)
- Note the edit flow still costs a `GetServiceAreaById` prefill when the modal opens — that is a pre-save read, not a post-save refetch.
- **The CRUD UI is `components/onboarding/add-business-information/ServiceArea.jsx`** (+ child `Select-Service-Area-Map/SelectServiceAreaMap.jsx`), **not** `ServiceAreaSelection.jsx` — the latter is a small presentational picker for choosing which areas a *service* covers, consumed by `AddServiceWizard.jsx`, `AIAssistantModal.jsx` and the two `ServiceAreasSection.jsx` files. Don't confuse them.
- **Default area.** Exactly one active area per business is the default; delete self-heals by promoting the oldest remaining. The client mirrors that promotion rule locally (`byCreatedThenId`) so the list matches the server without a refetch. Only `isDefault: true` is actionable — sending `false` never clears a default. Full contract in `clinqet-provider-onboarding`.

## AI Quick Setup dialog + service tri-state + labels (2026-07-20)

- **`AIAssistantModal.jsx`** — `shrink-0` header / `flex-1 min-h-0 overflow-y-auto` body / `shrink-0` footer, so the body scrolls under a permanently visible Start. Start is disabled until a file is chosen AND ≥1 availability AND (when the provider has 2+ areas) ≥1 area, with an `AISetup.StillNeeded` line naming what is missing. Availability starts unchecked. The area picker reuses `ServiceAreaSelection.jsx` and pre-ticks the default. Tax / online-payment write **business-level** defaults via `UpdateTaxSettings` / `UpdatePaymentSettings` (`provider/billing/tax-settings`, `provider/billing/payment-settings`), gated on `billingUiEnabled` and skipped when unchanged — never the doc-intel payload. Info/tip note cards are owner-mandated: leave them alone. Behavior detail in `clinqet-ai-assistant`.
- **Service update sends BOTH tri-state fields, always.** `ManageServicesPrice/utils/formUtils.js` sets `payload.AcceptsOnlinePayments` and `payload.Taxable` (each `?? null`) at the top level of the payload builder, outside every conditional and regardless of the billing flag — the API full-replaces them, so omitting one clears the provider's override. Form defaults are `null` in `ManageServicesPrice/constants/index.js`. See `clinqet-service-listing`.
- **Labels:** provider surfaces say **"At my location"** (`Label.InStore`, `AISetup.AtMyLocation` in `public/lang/en-US.json`). The **data identifiers `isAtStore` / `inStore` are deliberately unchanged** — this was a copy change only.
- **Icon:** the robot is gone. The AI mark is the green sparkle `#97EF29` on the navy gradient `from-[#032858] to-[#064a9e]` (`AIAssistantModal.jsx`, `FloatingAIButtons.jsx`, `AIQuickSetupNudge.jsx`). Orphan robot assets were deleted — never reintroduce one.

## Payment/tax + gallery parity (2026-07-22)

- `PaymentSettings` uses the API gateway/region for localized Stripe/Razorpay trust copy, shows payout readiness, simplifies tax price mode to two example-backed cards, and reuses `BookingDepositCard`.
- Service forms expose only Follow business (`null`) or off (`false`) for payment and tax. Onboarding context hides these controls and profile links and renders localized guidance instead.
- Every AI Quick Setup entry receives `entryContext`; onboarding performs no billing reads/writes or redirect, while profile context retains normal behavior.
- Portfolio upload uses real XHR progress, stable client ids, retained previews, partial-success preservation, and failed-file retry against the same project. Backend derivative states never create provider-facing optimization spinners.

## Password management (2026-07-22)

- `/dashboard/profile/change-password` is the canonical provider password route. It reads cached profile state first and only a literal boolean `hasPassword`/`HasPassword` may select set/change mode. Missing, invalid, condition-rejected, or concurrent profile resolution must terminate in localized Retry instead of an unresolved loader; a 409 performs one guarded profile refresh.
- Successful set/change responses continue this browser in a NEW session: adopt the returned access token (Identity re-binds the session cookie); a 401 `session_ended` there means "change saved, please sign in again" and its message is shown on the sign-in screen. Analytics distinguishes `password_set_*` from `password_change_*`.
- Password policy (user-approved 2026-07-23): 8–128 characters with ≥1 uppercase, ≥1 number, ≥1 symbol (`[^a-zA-Z0-9]`; spaces count; lowercase deliberately NOT required). It lives ONLY in `src/lib/validation/passwordPolicy.js` (`PASSWORD_MIN_LENGTH` 8, `PASSWORD_MAX_LENGTH` 128, `PASSWORD_COMPOSITION_PATTERN`, `evaluatePassword` returning a `rules[]` array, `isPasswordValid`); the Yup schemas (min/max/matches → `Validation.PasswordMin8`/`Validation.PasswordComposition`), `PasswordChecklist`, and every submit gate import it — never re-hardcode the numbers or the pattern.
- `PasswordChecklist` (shared by register, set/change, and reset) renders: a progress bar toward the 8-character minimum (navy while typing, lime `#97EF29` when valid, red over 128); a status label — `n/8` counter → "Almost there" once length is met but rules remain → Good/Strong/Very strong ONLY when fully valid (tiers 8–11/12–15/16+, low-variety strings capped at Good); four ALWAYS-VISIBLE requirement chips (8+ chars / 1 uppercase / 1 number / 1 symbol, keys `PasswordChecklist.Rule*`) that flip grey→green with an SVG check per rule; and a guidance line only for the valid ("Meets password requirements") and over-128 states. Never show a strength word for an invalid password.
- Set/change/reset submit buttons stay disabled until the form is valid; register keeps Yup per-field errors on submit. The change-password card ends with the shared `changePassword.PasswordTips` Tip1–Tip5 list (Tip1/Tip2 describe the 8-char minimum and the composition mix).
## Localization baseline (2026-07-26)

- Active picker locales are `en-US`, `fr-CA`, `hi-IN`, and `gu-IN`. Japanese was removed. `es-US.json` is complete and key/placeholder-parity tested but deliberately not registered in the picker yet.
- English is the structural source of truth. Every authored locale must have the exact English key tree and placeholder set; `localeParity.test.js` enforces this. The Offers flow uses locale-aware dates, times, lists, weekday/month names, and ICU plurals.

## ‼️ DASHBOARD HOME — WHAT SESSION 19 CHANGED (read before touching `app/dashboard/page.jsx`)

### Every widget renders EXACTLY ONCE
The page used to render its whole sidebar twice — one copy `xl:hidden`, one `hidden xl:flex`. Only one
was visible but **both were mounted at all times**, so six widgets ran their effects *and their fetches*
twice, forever. The sidebar is now `contents` below `xl` (its children order themselves inside the single
mobile column via `order-*`) and a real flex column from `xl` up, with `xl:order-*` for the desktop
sequence. ‼️ **Never re-introduce a second copy of a widget to reposition it — use `order`.**

### The service list is SHARED — never fetch it again
`src/hooks/useBusinessServices.js` is a module-level single-flight cache. **Three** dashboard consumers
read it (`ServicesList`, `RankHigherCard`, `UploadPortfolio`) and exactly **one** request goes out.
‼️ **Any new consumer uses the hook** — a fresh `GetBusinessProfileServices()` in a component is a
duplicate call (§1.4). `invalidateBusinessServices()` after a mutation that changes the catalogue.

### `RankHigherCard` — "Rank higher in search. Win more leads."
Replaced `CompleteSetup` (deleted). Three levers in the ranking's **real weight order** — answering
(0.040) → reliability (0.035) → completeness (0.025) — a navy head, the "work counts 4× more than your
plan" chip, and a footer stating verification and Clinket marks are **not for sale**.
‼️ **It must never disappear when onboarding completes**: levers 1 and 2 are things a provider never
finishes, and the old widget's vanishing act took every word about ranking with it.

### `src/utils/providerRankingLevers.js` MIRRORS the server
`serviceHasPrice` / `serviceHasPhoto` copy `ProviderScoreCalculator`'s predicates exactly; price and
photo are **proportional** ("1 of 3 have one"); the description row reads the **real description text**,
not the onboarding step; outstanding rows sort above finished ones.
‼️ **If these drift from the server, the dashboard starts promising something the ranking does not do.**
‼️ **A service list that failed to load shows NOTHING, never "0 of 0"** — that would be a lie about a
catalogue we could not read. An EMPTY list is different: it prompts "add your first service".
‼️ **Never publish the raw score numbers to a provider** — a score is a target to game.

### Form hints — only on OPTIONAL fields, and they vanish when filled
Photo (green) and description (blue) on the service form; the business photo hint in
`components/Profile/BusinessInfo.jsx`. ‼️ **There is deliberately NO price hint: cost is MANDATORY**
(`ManageServicesPrice/utils/validationUtils.js` blocks saving), so nudging it would be a lecture.
‼️ **`AddServiceFormWizard.jsx` and `sections/` are DEAD CODE — nothing imports them.** The LIVE form is
`components/onboarding/add-business-information/ManageServicesPrice/modals/AddServiceModal/`.

### The rotating panel (`UploadPortfolio.jsx`)
‼️ **Its lime→cyan gradient and layout are KEPT BY OWNER DECISION — do not "fix" the colours.** What it
must keep: navy button text (white on that gradient is ~1.7:1), a pause control, `prefers-reduced-motion`
honoured live, **state-aware slides** (a slide whose thing is done is dropped; two evergreen slides mean
it is never empty), and 44px dot hit areas drawn at the original size.
‼️ **Timer tests must never advance by a multiple of the slide count** — four ticks over four slides
lands back on slide 1 and the assertion passes with the guard sabotaged.

### ‼️ DASHBOARD LAYOUT 2026-08-13 — the rank-higher card moved OUT of the rail (owner-directed)

- **Desktop (xl+): `RankHigherCard` is the BOTTOM of the MAIN column**, full width of the widget grid —
  no longer in the right rail, whose profile checklist made the rail ~2 screens long and pushed
  `MobileAppPromo` far off-screen. The rail was then carousel → plan status → new requests → call
  follow-ups → app promo (new requests later became the main column's `WorkQueue`; `NewRequests.jsx` is deleted).
- **Stacked (<xl): the card is the last CONTENT item** (`order-6`) and **`MobileAppPromo` closes the
  page** (`order-7`, owner follow-up same day) — the card is guidance, not the day's work, and at
  `order-2` it consumed the whole first screen. **Provider MOBILE mirrors the rule**: the card renders
  after `ServicesList`, the end of the scroll (that app has no store promo to follow it).
- **BOTH column wrappers are now `contents` below xl** — the left one exists so the rank-higher card can
  sit inside the xl flex column (under the widget grid) yet order itself independently in the stacked
  column. The one-mount rule is unchanged: reposition with `order-*`, never a second copy.
- **The card's body splits into TWO PANELS at `md+`** (levers 1+2 left · profile checklist right behind a
  `md:border-l` divider; the header puts the 4× chip on the right): a full-width band must not render as
  a rail-shaped column. Below `md` the card renders exactly as before. The `Lever` CTA rides right ONLY
  between `sm` and `md` (full-width rows); inside the md+ panels it drops back under the text — the
  text-beside-link squeeze is what the old rail placement suffered.
- **`ServicesList`'s scroll region is an absolutely-filled shell** (`relative flex-1 min-h-[360px]` +
  `absolute inset-0 overflow-y-auto`): the card is `h-full` in a grid row shared with Share Profile, and
  the old hard `maxHeight: 360px` left the stretched remainder as dead white space under 4 rows. ‼️ The
  rows must never drive the grid row height — 39 services would. The empty state is `flex-1` so it
  centres in the shell.
- `DashboardService` tiles: keys are `item.target` (the old fresh `uuidv4()` per render remounted all six
  tiles on every render); the icon `alt` is `""` (decorative — it used to read the raw i18n key aloud).
- **`Statistics.jsx` and `RecentReviews.jsx` are DELETED** — dead since the session-19 rebuild; nothing
  imported either.

## ‼️ SESSION 22 — account-purge package + service-area/display fixes (2026-07-30)

### Cross-account leak closed — `src/utils/clientStatePurge.js`
- ONE `purgeClientState()` (SessionStore + resetStore + apiCache + inflight-GET map + policy caches +
  business-services module cache + `clinqet-auth-purge` window event) runs on logout (`logoutFun` /
  `redirectToLogin`), on the PrivateRoute expiry path, and **on every login success BEFORE the new
  session is stored** (email, OTP-send, passkey, HomeClient social callback).
- `utils/apiCache.js` **epoch guard**: `clear()` bumps `epoch`; a response resolving after a purge can
  no longer re-seed; pending-map deletes are identity-checked. `api/getApi.js` exports
  `clearInflightGetRequests` (same identity check). `useBusinessServices` reset renamed
  `resetBusinessServicesCache` (‼️ distinct from cacheInvalidation.js's same-named apiCache helper).
- Renew/adopt results that started under an older auth epoch, another session or another account are
  DISCARDED — never written over the new session (`adoptContinuedSession` advances the epoch).
- `useBusinessProfile.fetchProfile` re-checks `userId` before `saveStoredProfile` (in-flight response
  must not re-seed `clinqet_business_profile` for the next account). `BillingOverviewContext`
  subscribes to the purge event with its own epoch ref. CountryContext deliberately NOT purged
  (public/locale/country is device/IP-scoped).
- Login forms default `rememberMe: true` (owner 2026-07-29); `NEXT_PUBLIC_DEFAULT_LOGIN_METHOD=otp`
  in .env/.env.example (‼️ deployed stamps need the same flip in `NEXT_ENV_*` CI secrets).

### Service areas + services list
- ‼️ **Unit display**: the API sends enum NAMES (`"Kilometers"`/`"Miles"`); the grid compared to the
  modal-internal `"km"` so every row said Miles. `ServiceArea.jsx` now matches
  `toLowerCase().startsWith("k")` → `ServiceArea.Kilometers` else `.Miles`. Never compare a wire unit
  to a UI token.
- Picker labels are `name, city` (`apiUtils.fetchServiceAreas` + `AIAssistantModal` map) — the stored
  default-area NAME deliberately does NOT embed the city (the grid appends `, {city}`; embedding would double it).
- ‼️ **Service delete = local removal, no refetch**: `ServiceSummaryDto` carries NO category/subcategory
  ids, so the old `GetServiceList(undefined, undefined)` wrote a `services["undefined"]` bucket and the
  card never left. `useServiceCategories.removeServiceLocally(serviceId)` filters EVERY bucket +
  decrements `serviceCount` (round-trip discipline: consume the mutation, never refetch).
- Payment & Tax section tightened (`PriceDetailsSection.jsx` space-y/padding/min-h steps down one notch;
  `BookingDepositCard` compact-gated `p-3/mt-2.5/mt-1.5` — the non-compact PaymentSettings render is untouched).

## SESSION-22 AUDIT HARDENING (2026-07-30) — session-boundary contracts

- **`PrivateRoute`** resets `mounted.current = true` at effect start (StrictMode re-runs the effect after
  cleanup) and returns on refresh success regardless of mounted — falling through purged the tokens the
  refresh had just stored. `staleSession` ⇒ `window.location.reload()`.
- **staleSession ⇒ reload, never `SessionStore.clear()`** in `lib/apiClient.js`; `redirectToLogin`
  no-ops on `/auth/*`. Pinned by `src/lib/apiClient.staleSession.test.js`.
- **`useBusinessServices`** carries a module `epoch`: `resetBusinessServicesCache()` bumps it, so an
  in-flight response across a reset can neither seed the cache nor clear a newer inflight slot.
  Pinned by `src/hooks/useBusinessServices.test.js`.
- **`useBusinessProfile`** guards success AND error paths with `sessionIntact` = token-presence +
  userId-equality — token VALUE is deliberately not compared (refresh rotation mid-request would
  false-block a valid response); loading always releases.
- **`logoutFun`** checks/sets `isLoggingOut` BEFORE the try (a second click reaching finally stripped the
  first call's flag and spinner) and re-arms the flag after each purge (the purge wipes it). Every call
  site passes the auth-context `logout` (HomeClient and addBusinessInfoHeader included).
- **`SessionStore.clear()` preserves device-level keys** (`PRESERVED_KEYS_ON_CLEAR`): `x-device-id`,
  `clinket_locale_country`, `selectedCountry`, sunset-banner + AI-nudge dismissals, and the
  booking/invoice/quote view-mode prefs. Pinned by `src/utils/sessionStore.clear.test.js`.
- **`PolicyReconsentModal`** clears its queue `onAuthPurge` — an account switch mid-modal must not leave
  the previous account's consent prompt on screen. (Customer app mirrors this.)
- Register verify (`verifyEmailForm`) purges before token writes. The dead `requiresMfa` store write is
  gone; `trackServiceCatalog` sends `serviceForm.category`/`subcategory` (the real form field names).
  `EnhancedPrivateRoute.jsx` (never imported) is deleted.


## 2026-07-30 — Phase-6 combining audit
- ‼️ **Billing.jsx TDZ lesson**: `money`/`currency` must stay defined ABOVE the AI interval-switch callbacks — hook dependency arrays evaluate during render, so referencing a later `const` is a ReferenceError in the real browser while Jest (Babel, no TDZ) stays green. ESLint `no-use-before-define` is the guard; keep it at 0 errors.
- `ServicesList.jsx` honours `useBusinessServices`'s contract: `null` = UNKNOWN (loading/failed) renders the skeleton, never "No services added yet".
- fr-CA: a letter directly before `?` fails `sourceLocalizationIntegrity` — use U+00A0 before `?` (the catalog's dominant convention).

## Call Follow-ups: "Details sent" card (2026-07-31)

`SuggestedActionType.SharedDetails` — the receptionist sent the caller the provider's own public page (see `clinqet-voice-assistant`). Always `AutoCreated` + `Verified`, **never applicable**: no Apply/Dismiss, no confidence chip, no "Created on call" chip (nothing was created). Title `callFollowUps.detailsSent` / `CALL_FOLLOW_UPS.TYPE_SHARED_DETAILS`; payload rows `subject` + `channel`; `pageUrl` is hidden as a row and rendered instead as an EXTERNAL link ("See what they received" / `VIEW_WHAT_WAS_SENT`) — `target="_blank" rel="noopener noreferrer"` on web, `Linking.openURL` on mobile, so the provider can confirm exactly what the caller received. A service-page share also records a Pending `SendQuote` card, which keeps the existing "Open in editor" one-tap route.

---

## Multi-user tenancy — the workspace foundation (Phase 8 Part A, 2026-08-03)

> ⚠️ **Part A is INCOMPLETE.** The foundation below exists, is tested, and is **not yet wired into the
> app**. The team, invite, invitation-acceptance and ownership-transfer screens are outstanding. Resume
> with `member-provider\next-session\START-PHASE-08A-RESUME.md`.

| File | What it owns |
|---|---|
| `src/lib/tenancy/renderingRules.js` | ‼️ **THE cross-platform contract** with `clinqetmobilepartnerapp`. Pure, dependency-free, side-effect-free. Returns localization KEYS, never English |
| `src/lib/tenancy/renderingRules.test.js` | 22 tests. The mobile parity spec must reuse these fixtures |
| `src/services/tenancyServices.js` | All 20 tenancy endpoints. `tenancyResult()` normalises every outcome to `{ ok, code, message, data }` |
| `src/utils/tenancySession.js` | Workspace persistence, JWT `BusinessId`/`MembershipId` claim readers, the per-tab context key, `tabContextDiverged()` |
| `src/context/BusinessContext.jsx` | `useBusiness()` — workspaces, active business, permissions, `switchBusiness`, `contextStale` |
| `src/components/tenancy/` | `primitives.jsx` · `WorkspaceSwitcher.jsx` · `WorkspaceStates.jsx` |

### Rules that are easy to get wrong here

- ‼️ **Keep `renderingRules.js` dependency-free.** The mobile parity spec evaluates it in a sandbox; one
  import turns that build-failing spec into a silent skip.
- ‼️ **The workspace list arrives with the SIGN-IN response** (`JwtResponseDto.Businesses`). Opening the
  switcher is a **render, not a request**. A **token refresh returns an EMPTY list deliberately**, so
  `captureAuthResponse` only writes a non-empty one — without that guard a refresh wipes the switcher.
- ‼️ **The permission set is fetched once per business context and cached for it** (`GET /business/access`),
  never re-read per screen.
- ‼️ **Switching is ONE token exchange.** The header updates from data already held; the content re-fetches
  once. Every request records the context generation it was issued for, and a response from an older
  generation is **discarded, never rendered** — that is the classic workspace-switcher bug.
- ‼️ **Two tabs share `localStorage`.** `SessionStore.set` defaults there and `SessionStore.get` reads
  `sessionStorage` first, so the per-tab business id goes **straight to `window.sessionStorage`**. The session
  cookie genuinely is shared (one session per browser, one workspace per session), so the honest guarantee is
  *detect and stop* (`session_context_changed`), never *render the other workspace's data under this header*.
- ‼️ **Never log the token.** `businessIdFromToken()` reads one claim and returns nothing else. The
  invitation token lives in the URL query, so anything logging `location.href` logs a credential.
- ‼️ `"0001-01-01T00:00:00"` is **truthy** — use `isMeaningfulDate()`. `!![]` is **true** — test length.
- **Hiding an action the member cannot perform is UX. The server still enforces it.** `can(permission)`
  never substitutes for the endpoint's own gate.

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

## ‼️ TENANCY: THE SHARED-INBOX AND NOTIFICATION RENDERING RULES — Phase 8B1, 2026-08-03

`src/lib/tenancy/renderingRules.js` is **THE cross-platform contract**. `clinqetmobilepartnerapp/src/lib/tenancy/
renderingRules.ts` is a line-for-line twin and `__tests__/tenancyRenderingParity.test.ts` fails the build on any
divergence. ‼️ **Keep it dependency-free and side-effect-free** — the parity spec sandboxes it, and one import
turns that build-failing spec into a silent skip.

Part B1 added **26 rules**, tested in `src/lib/tenancy/inboxRenderingRules.test.js` (26 cases):

**Inbox:** `INBOX_VIEWS` · `INBOX_CONTEXTS` · `contextLabel` · `assignmentState` · `claimRefusal` ·
`unreadBadge` · `followLabel` · `channelMarks` · `overdueState` · `inboxTabs` · `rowAction` ·
`inboxStatusBanners` · `inboxEmptyState`
**Notifications:** `NOTIFICATION_CHANNELS` · `NOTIFICATION_DELIVERY_MODES` · `eventCategoryLabel` ·
`channelCell` · `routeSummary` · `teamActivitySegment` · `teamActivityPersonSummary` · `teamActivitySummary` ·
`showsTeamActivitySection`

### The rules most likely to be got wrong

| Rule | The trap |
|---|---|
| `claimRefusal` | ‼️ **A lost claim is a 412 and must NEVER render as an error.** It renders as a colleague's NAME plus Follow / Take over / Back. The natural instinct — routing a failed write into the generic error toast — is the single most important thing to get right on that screen |
| `inboxTabs` | ‼️ **The Overdue tab is ABSENT when the count is zero**, never a permanent zero badge. That is why the counts must arrive with the list |
| `assignmentState` | Unassigned **replaces** the composer with a claim prompt; it never disables it. A greyed-out box invites a tap that does nothing |
| `overdueState` | Colour is never the only carrier — warm tint **and** amber pill **and** the words. `"0001-01-01T00:00:00"` is truthy, so it goes through `isMeaningfulDate` |
| `channelCell` | A mandatory email renders as a **locked cell with a lock mark and one line of reason** — never an enabled toggle that silently does nothing (edge case 27) |
| `showsTeamActivitySection` | ‼️ In a solo business the whole §14.8 section is **absent** — not an empty state, not a card saying "you have no team" |
| `NOTIFICATION_CHANNELS` | Exactly `InApp · Email · WhatsApp`. `Push` and `Sms` travel in the payload (§4.7) and are **not rendered**. The list lives here so neither app can quietly grow a column the other lacks |

### `src/components/tenancy/NotificationSettingsPanels.jsx`

Three finished panels: `NotificationRoutingPanel` (admin, `notification_policy.*`), `MyNotificationsPanel`
(per business), `TeamActivityPanel` (§14.8 — two entrances *By activity* / *By person*, **never a matrix**).
Every one of them:

- renders the **separation statement before the data loads** — it is the one thing true regardless of what loads;
- rebuilds the **plain-language summary from the SERVER's state after every save AND every failure**;
- **reverts the switch and re-reads** on a failed write, because a toggle that disagrees with the server is the
  worst possible outcome on a settings page;
- guards every load with `requestGeneration()` / `isCurrentGeneration()` from `useBusiness()`, so a response that
  lands after a workspace switch cannot render into the new workspace.

### `src/services/tenancyServices.js`

12 new calls, all through `tenancyResult()` → `{ ok, code, message, data }`. **`apiClient` resolves errors**, so
every write must check `ok` — an unchecked claim renders "Yours" over a thread you lost.

### Localization

`public/lang/*.json` — **110 Phase 8B1 keys × 5 files (4,701 → 4,811, all five key sets identical)**.
‼️ `src/utils/sourceLocalizationIntegrity.test.js` enforces three separate things: every referenced id exists in
`en-US`, every `defaultMessage` **exactly matches** the catalog value, and **fr-CA typography** — a letter
followed directly by `?` fails it, because French Canadian needs `Quelle équipe ?`.

---

## THE SHARED INBOX AND THE NOTIFICATION SETTINGS (Phase 8 Part B2, 2026-08-04)

### Where things are

| Path | What |
|---|---|
| `src/app/dashboard/inbox/page.jsx` | The shared team inbox. **Extended in place** — there is no second inbox |
| `src/components/tenancy/InboxPanels.jsx` | Every presentational piece of it (tabs, chips, banners, marks, composer states, reassign dialog) |
| `src/app/dashboard/team/notifications/page.jsx` | Business notification routing (admin) |
| `src/components/Profile/Notifications.jsx` | My per-business notifications + team activity + the platform-wide account card, in that order |
| `src/lib/tenancy/renderingRules.js` | ‼️ **THE cross-platform contract — 39 exports.** Keep it dependency-free |
| `src/services/tenancyServices.js` | Every tenancy call, through `tenancyResult()` → `{ ok, code, message, data }` |

### ‼️ The five things most likely to be got wrong here

1. **The inbox list comes from `GET /business/inbox` and NOTHING else.** Calling `getConversations` as well is
   a duplicate list request AND unscoped — a Technician would see the whole partition.
2. **A lost claim is a 409 that must render as a colleague's NAME**, with Follow / Take over / Back. Never red,
   never a code. Routing a failed write into the generic error toast is the instinct to resist.
3. **The composer is REPLACED, never disabled.** A greyed text box invites a tap that does nothing.
4. **The Overdue tab is ABSENT at zero**, and the six counts ride on the list response so the client can decide
   that before it renders.
5. **`?q=` free-text search is CUT.** The affordance is removed, never drawn. The old client-side search box was
   deleted too — it filtered only the loaded page and confidently lied on a long queue.

### Localization

`public/lang/{en-US,es-US,fr-CA,hi-IN,gu-IN}.json` — **4,903 keys each, all five identical**. Any new key goes
in all five in the same change.

‼️ **`src/utils/sourceLocalizationIntegrity.test.js` enforces three separate things** and will fail the build on
any of them: every literal id must exist in `en-US.json`; every `defaultMessage` must match the catalog value
**exactly**; and **fr-CA typography** — a letter followed directly by `?` fails, so French Canadian needs
`Quelle équipe ?`.

‼️ **Ids chosen at RUNTIME are invisible to that scanner.** Register them in
`DYNAMIC_LOCALIZATION_DOMAINS` (`src/utils/localizationContracts.js`) — `tenancyInbox` and
`tenancyNotifications` are the tenancy ones — or nothing proves the five catalogs carry them.

‼️ **Where the id is dynamic, pass NO `defaultMessage`.** One shared fallback across a switch once rendered a
closed account as "Active"; a visible key beats a plausible lie.

### ‼️ A new dashboard ROUTE is a mobile obligation

The apps' association files claim every `/dashboard/**` path, so a new web route without a matching
`clinqetmobilepartnerapp/src/appNavigation/linking.ts` entry opens the mobile app **on a blank stack**.
`__tests__/deepLinking.test.ts` there fails the build on it — as it did for
`/dashboard/team/notifications`. Register the screen in `linking.ts`, in `types.ts`, in the stack, **and in
`analyticsTracker`'s `screenMap`** (a registered route absent from that map reports `surface: undefined` on
every PageView).

### Workspace safety

Every load goes through `useBusiness()`'s **`requestGeneration()` / `isCurrentGeneration()`**. A response that
lands after a workspace switch is DISCARDED — otherwise it renders into the wrong workspace, which is the
classic switcher bug and the worst failure this feature can produce.

---

## ‼️ LOCATIONS — the four provider screens (PHASE 8 PART C — PROVIDER, 2026-08-04)

**BR-1: the user-facing word is LOCATION, never *branch*.** `branch` is the schema's and the wire's word and
must never reach a screen. Every string is a localization key regardless.

### ‼️ THE rule that governs all four screens

> **A provider with ZERO locations must never see the word — anywhere.**

| Active locations | What appears |
|---|---|
| **0** | **Nothing.** No dropdown, no tab, no column, no filter, no empty state. **This is most providers, forever** |
| **1** | The Locations screen works. New service areas attach silently. **Still no dropdown and no tabs** |
| **2+** | Dropdown on the service-area form (pre-selected to the default) · one availability tab per active location · the team list's location column |

**The single gate is `showsLocations(activeCount) >= 2`** in `src/lib/tenancy/renderingRules.js`. Reuse it —
never re-derive the count check, or the word leaks onto one surface and not another.
‼️ **Two locations of which one is CLOSED is a ONE-location business for every one of these decisions.**

`src/lib/tenancy/zeroLocationSilence.test.js` asserts this as a RULE across every surface.

### Where the screens live

| Screen | File |
|---|---|
| Locations list + all its sheets | `src/app/dashboard/profile/locations/page.jsx` (+ `layout.js`) |
| Every presentational piece | `src/components/tenancy/LocationPanels.jsx` |
| Per-location hours | `src/components/onboarding/add-business-information/SetAvailability.jsx` — **extended in place** |
| The location control on the area form | `.../Select-Service-Area-Map/SelectServiceAreaMap.jsx` |
| The one entry link + the area-row location name | `.../add-business-information/ServiceArea.jsx` |
| Route | `ProfileRoute.Locations` = `/dashboard/profile/locations` |

‼️ **BR-2: reachable but UNADVERTISED.** There is **no sidebar entry at any count**. The only link is a footer
line on the Service Areas page, gated on `can("team.read")`, and its copy asks the QUESTION without naming the
noun — *"Do you work from more than one place?"* — because at zero locations the word must not appear (CP2).

### ‼️ The two hours rules — one has a real-world casualty

1. **An empty location tab means "same as all locations". It NEVER means closed.** `InheritedHoursState` prints
   those literal words **and the inherited schedule underneath**. Reading absence as "closed" would silently shut
   every location nobody customised, and the failure mode is a customer at a locked door.
2. **Turning "use the same hours" OFF does NOT clear the grid.** The grid is ALREADY the inherited hours, because
   `GET /business/availability?branchId=` resolves through `BranchAvailabilityResolver.EffectiveHours` and returns
   the BUSINESS rows for a location with none of its own. Two edits, not fourteen.

‼️ **`locationHoursState(rows, branchId)` decides which panel renders — the screen must never re-derive it.**
`own` is true only when a returned row is TAGGED with that branchId. A sabotage pass proved that testing the
panel component directly cannot catch this rule deciding wrongly: drive the choice through the rule.

### The wire

| Action | Endpoint |
|---|---|
| List / create / rename / set default | `GET|POST /business/branches` · `PUT /business/branches/{id}` |
| Reorder | `PUT /business/branches/order` |
| Close / reopen | `POST /business/branches/{id}/deactivate|reactivate` |
| Delete (refused `branch_in_use`) | `DELETE /business/branches/{id}` |
| Assign staff | `PUT /business/branches/{id}/staff` |
| Hours read / write | `GET /business/availability?branchId=` · `PUT /business/availability` with `branchId` + `useBusinessHours` |
| Re-point an area | `PUT /business/service/areas/{id}` with `branchId` **or** `clearBranch: true` |

‼️ **Permissions:** the list needs `team.read`; every mutation needs **`team.manage_locations`** (Primary Owner
and Administrator only). Hours need `availability.read` / `availability.manage`.

‼️ **`useBusinessHours: true` DELETES the location's rows** so it inherits again — never a copy of the business
grid, which would freeze today's hours and stop tracking the default. The seven days still travel and are
ignored, because absence of rows IS the inheriting state.

‼️ **`clearBranch: true` is not the same as `branchId: null`.** On a partial update a null is indistinguishable
from "this request did not mention the branch"; `clearBranch` is how the close sheet hands an area back to the
whole business.

### Error codes the screens branch on

`branch_in_use` (409) → the blocked-delete sheet with both counts and "close it instead" ·
**`branch_name_in_use` (409) → an INLINE FIELD error** · `branch_not_found` (404) → the row is gone, a colleague
deleted it · `permission_denied` (403) → the denied state. ‼️ **The first two were ONE code until Part C
PROVIDER** — on a rename both are possible and the screens do opposite things. Branch on the CODE, never the
message.

### Traps

- **`!![]` is true.** `serviceAreaIds` and `membershipIds` are always present and usually empty. Use length.
- ‼️ **A `defaultMessage` that differs from the en-US catalog fails `sourceLocalizationIntegrity`.** Copy the
  catalog value exactly, including typographic apostrophes and em dashes.
- ‼️ **A raw key in an `aria-label` fails the same spec.** Resolve it through `intl.formatMessage`.
- ‼️ **i18next supports ONE count per key**, and the mobile bundles are generated from this app's catalogs, so a
  two-plural string is a build failure. Split the count PHRASES into their own keys and compose them at the
  render site (`Locations.Row.AreaCount` + `Locations.Row.StaffCount` → `Locations.Row.Counts`).
- **There is no weekday key family in this app.** Day names format through `intl.formatDate` with a fixed UTC
  anchor (2024-01-07 is a Sunday), matching `SetAvailability`'s own `formatDayName`.
- **`getByRole("button").click()` does not flush React state** — use `fireEvent.click`.
- ‼️ **A failed hours save must never blank the grid.** The edits are the expensive part; the request is cheap.

---

## ‼️ PHASE 8 PART D (2026-08-04) — THE BUSINESS ACTIVITY FEED (AF-1 … AF-5).

**New page `src/app/dashboard/activity/` (+ `layout.js`), panels in
`src/components/tenancy/ActivityPanels.jsx` (9 exports), a top-level Activity sidebar item gated on
`audit.read`, and 9 new rules + `ACTIVITY_TYPES` in `src/lib/tenancy/renderingRules.js` (64 exports total).**

### ‼️ Facts about the contract that will bite you

- ‼️ **The server's summary templates are ACTOR-FREE.** `BusinessActivity_BookingCreated` is
  `"Booking {0} was created for {1}"` and the recorder passes `[subjectNumber, customerName]` — **the actor
  is never an argument.** So the actor renders as its own bold navy lead-in, which is what makes *"a null actor
  means the sentence has no actor"* structural rather than a branch (AD4). Never weave it into the sentence.
- ‼️ **`?activityType=` takes ONE `BusinessActivityType` and there are NINE** — not six, as `PHASE-08` §2.9
  says. The chip strip is DERIVED from `ACTIVITY_TYPES`, because three of the four category chips the mockup
  draws would each cover two types and **silently hide half the rows** (AD3). The row PILL is a separate
  `activityCategory` rule, because a label on a sentence and an action are not the same string.
- ‼️ **A LEAD row is not a link.** `SubjectType` is literally `"BroadcastProviderEntity"` (the `nameof()` of a
  `using` alias) and `SubjectId` is the `BroadcastProvider` document id, while `/dashboard/leads/[id]` takes a
  **broadcastId** — a link would 404. Booking / Quote / Invoice DO link, each gated on the reader's own
  permission (AF-2). Finance holds `audit.read` but **not** `lead.read`, so the rule genuinely bites.
- ‼️ **A stale page cursor is `TenancyErrorCodes.InvalidContinuationToken` (400)** and must **recover to the
  top of the feed with one banner**, never an error page. The code was added by Part D — the endpoint used to
  return only the localized sentence (AD8).
- **Changing the filter CANCELS the in-flight page** via `AbortController` — never lets two responses race into
  one list. `/* global AbortController */` is required: the ESLint env does not declare it, and it is a
  `no-undef` **error**.
- ‼️ **`StateCard` used to render its heading TWICE** (a tone pill plus the paragraph), so every
  empty/error/denied card on team, invite, inbox and locations showed its title twice from Part A until Part D.
  Fixed — the tone is a top accent bar. **A `getAllByText(...).length > 0` assertion is what hid it; assert an
  exact count.**
- **Localization: 48 new flat ids × 5 files → 5,051 each.** The nine `BusinessActivity_*` summary templates are
  **copied from the API catalogs**, not re-translated, so the feed and the notifications say the same words. A
  new `tenancyActivity` domain in `utils/localizationContracts.js` proves the runtime-chosen ids exist in all
  five catalogs.

---

## ‼️ MULTI-USER TENANCY — PHASE 9 (2026-08-04). The provider-web tenancy surface is COMPLETE.

> **The whole model is now one skill: read `clinqet-provider-teams` before any tenancy change.**

**Phase 9 changed ZERO frontend files** — proven by mtime across all five apps, not asserted. ESLint was
still run on all five and reports **0 errors**. This section is the closing inventory of the provider-web
tenancy surface plus the rules that must not drift.

### Every tenancy screen, and the part that shipped it

| Screen | Path |
|---|---|
| Workspace switcher · no-business-access · suspended states | `components/tenancy/{WorkspaceSwitcher,WorkspaceStates,WorkspaceGate}.jsx` |
| Team management (roster · filters+search · seats · invitations · ownership) | `app/dashboard/team/page.jsx` |
| Invite member | `app/dashboard/team/invite/page.jsx` |
| Invitation acceptance, twelve states, **reachable logged out** | `app/invitation/page.jsx` |
| Notification routing | `app/dashboard/team/notifications/page.jsx` |
| My notifications + team activity | `components/Profile/Notifications.jsx` (mounted **above** the platform-wide account card) |
| Shared team inbox, six views, fourteen states | `app/dashboard/inbox/page.jsx` (**extended in place** — not a second inbox) |
| Locations (4 screens) | `app/dashboard/profile/locations/` |
| Business activity feed | `app/dashboard/activity/` |

Supporting: `components/tenancy/{primitives,TeamPanels,MemberDialogs,OwnershipTransferPanel,InboxPanels,NotificationSettingsPanels,LocationPanels,ActivityPanels}.jsx` ·
`lib/tenancy/{renderingRules,permissionGroups}.js` · `context/BusinessContext.jsx` ·
`utils/tenancySession.js` · `services/tenancyServices.js` · `api/url.js`.

### ‼️ `renderingRules.js` is THE cross-platform contract — 64 exports

- ‼️ **Keep it DEPENDENCY-FREE and SIDE-EFFECT-FREE.** The mobile parity spec evaluates this file in a
  `vm` sandbox; **a single `import` turns a build-failing diff test into a silent skip.** (It throws
  instead — keep it that way.)
- ‼️ **It returns localization KEYS, never English.**
- ‼️ **The mobile twin's newer blocks are GENERATED from this file and proved by a round-trip diff**
  (CP12): strip the TypeScript annotations back out and the result must equal this source **character for
  character**. **Edit THIS file and regenerate** — hand-editing the mobile copy will be reverted.
- `__tests__/tenancyRenderingParity.test.ts` (mobile) is **build-failing** and covers all 64 exports with
  **286** cases.

‼️ **A cross-platform sabotage that bites in ONE app is a finding about your TESTS.** Breaking
`locationHoursState` failed **3 mobile tests and 0 web ones**, because every web test rendered the panel
directly while mobile drove it **through the rule**. The web suite gained a harness that picks the panel
from the rule as the page does, and the same sabotage then bit both. **The app that stayed green had the
gap.**

### ‼️ Six live defects this surface shipped, and what each teaches

1. ‼️ **`StateCard` rendered its heading TWICE** — once in a tone `Pill`, again as the paragraph — so
   **every empty / error / permission-denied card on the team, invite, inbox and locations screens showed
   its own title twice over, from Part A until Part D.** The tone is now a top accent bar.
   ‼️ **A `getAllByText(...).length > 0` assertion is what hid it** — it passes with 1 **or** 2.
   **Assert an exact count.**
2. ‼️ **One `defaultMessage` shared across a switch renders the WRONG string.**
   `<FormattedMessage id={status.key} defaultMessage="Active" />` rendered a **closed account as Active**
   whenever the bundle was missing. **A wrong-but-plausible fallback is worse than a visible key** — the
   `defaultMessage` was removed and the test now loads the real bundle.
3. ‼️ **`successorEligibility` compared two `undefined` ids and marked EVERY member the owner.** Any id
   comparison in these rules must require the **left side non-empty first**.
4. ‼️ **`LocationHours`'s `formatDay` prop was optional and defaulted to `(day) => day.dayOfWeek`** —
   which is exactly how **raw English weekday names shipped in every locale**. It is now **REQUIRED and
   THROWS when absent**, so a future caller cannot silently reintroduce it.
5. ‼️ **In the 1-location state both `LocationHours` components rendered an EMPTY bordered wrapper** — a
   stray divider, because that state is carried entirely by the name pill. Both now return `null` unless
   the state is Shared or Differing.
6. ‼️ **The separation statement's "My notifications" button had NO handler passed**, so it rendered
   nothing. Found by the no-stub dimension, fixed rather than deferred.

### ‼️ Do not draw a control whose backend does not exist

Where an approved mockup asked for something the wire contract could not express, **the honest answer
shipped and the difference was RECORDED AND FLAGGED** — never faked:

| Mockup asked for | What ships, and why |
|---|---|
| A three-way segment on "Updates on work in progress" | **Informational card** (**B1**) — `NotificationRecipientResolver` reads **no route for `AssignmentTask`**, so a stored route is inert. **The server refuses the write** (`notification_route_not_adjustable`) |
| Switchable channels on "Business updates" | **A stated row with its reason** (**B3**) — `Awareness` resolves **ZERO recipients by design** (L91), so every switch would be inert. Server refuses (`notification_class_not_deliverable`) |
| *"Sarah Whitfield left the business, so this came back to the queue"* | **Unassigned + claimable, with no name** (**B14**) — **nothing records it.** Removal clears `assignedMembershipIds` and the thread retains no trace. Rendering a name would be hallucination |
| An "Open quotes" row in removal-impact | **Absent** (**A4**) — quote assignment does not exist (L108); a "0" row advertises a feature that is not there |
| Four activity category chips | **One chip per `BusinessActivityType`** (**AD3**) — `?activityType=` takes ONE type and the composite is what makes it cheap; a merged chip would **silently hide half the rows** |
| An actor woven into the summary sentence | **A bold lead-in** (**AD4**) — the server's templates are **ACTOR-FREE** (`"Booking {0} was created for {1}"`), so the mockup's sentence is not expressible |
| A drag handle for reordering | **Two buttons** (**CP13**) — the mobile pane's own caption rejects drag, and a handle needs a keyboard equivalent anyway |
| Grouped day rows + explicit "Closed" rows | **Untouched day rows** (**C2**) — the mockup is **mistaken about the baseline**, and changing the 0-location DOM breaks SEO rule 5 |

‼️ **Derive a read-out; never author one.** The admin "what this role allows" panel is derived from
`TenancyRoleCatalogDefinition` because the approved mockup's hand-written version was **factually wrong**
about the Technician role (**L74** grants `quote.read` AND `invoice.read` at `Assigned`). A test copied
the mockup's claim and **failed against the real catalogue.**

### Session, tabs and the workspace list

- ‼️ **`SessionStore.set(key, value)` defaults to `localStorage`, which both browser tabs SHARE**, and
  `SessionStore.get` reads `sessionStorage` first then `localStorage`. The per-tab business key therefore
  goes **straight to `window.sessionStorage`**, never through `SessionStore`. The session cookie genuinely is
  shared, so the honest guarantee is **detect and stop** (`tabContextDiverged()`, `session_context_changed`),
  never "render the other workspace's data under this header".
- ‼️ **A token refresh returns an EMPTY `Businesses` list, deliberately.** It **does** carry
  `ActiveBusinessId`, and the workspace is re-resolved live from the stored refresh-token row.
  **A client that writes its cached list from a refresh response WIPES the switcher** — `captureAuthResponse`
  guards on non-empty. **Keep that guard.**
- ‼️ **`LastAccessAt` is nullable AND can arrive as the .NET zero date, which is TRUTHY** — a bare
  truthiness check sorts a never-opened workspace to the top of a most-recent-first list.
- **The switcher is a RENDER, not a request** (WS-2). `BusinessMembershipSummaryDto` carries **no unread
  count**, so it must **never** issue a request per business.
- ‼️ **`workspaceRow()` obeys the server's `canEnter` over anything it could derive.** The status-derived
  branches remain as the presentation of the same policy and are what render a **mid-session** suspension.
  `BusinessContext` exposes `enterableCount`; **`WorkspaceGate` reserves the no-access screen for a genuine
  ZERO** and routes an all-locked member to the blocked screen — because showing *"You're not part of a
  business yet"* to a real employee during their employer's billing incident is a **false statement**.

### Cost and correctness rules

- **`tenancyResult()` gives every call ONE shape**, so no call site can read a rejection as success.
  ‼️ `apiClient` **resolves** errors rather than throwing — every write must check the result.
- **One list request per view change**, carrying all six inbox tab counts. **Never a count call per tab.**
- Reassign targets are fetched **only when the dialog opens** — never on page load.
- The permission set is fetched **once per context**; switching is **ONE** token exchange.
- ‼️ **`/* global AbortController */` is REQUIRED** — the app's ESLint env does not declare it, and it is a
  `no-undef` **error**, not a warning.
- ‼️ **ESLint 0 is a CORRECTNESS gate on this codebase**, not a style gate.

### Localization

**5,051 flat react-intl ids × 5 files, all five key sets identical.** ‼️ **The mobile bundles are
GENERATED from these catalogs** (**B17**), so the two apps physically cannot say different things.
The nine `BusinessActivity_*` summary templates are **COPIED FROM THE API CATALOGS**, not re-translated, so
the feed sentence and the notification copy are the same words in every language.
`utils/localizationContracts.js` carries the dynamic domains (`tenancyInbox`, `tenancyNotifications`,
`tenancyActivity`) that make runtime-chosen ids testable.

‼️ **`sourceLocalizationIntegrity` enforces fr-CA typography**, not just key parity: a letter followed
directly by `?` fails it — French Canadian needs `Quelle équipe ?`.

---

## ‼️ PHASE 13 PART 2 (2026-08-06) — what the frontend audit established about this app

- ‼️ **The team-invitation acceptance page is `/invitation`** (`src/app/invitation/page.jsx`) — **never**
  `/team/invitation`, which is what the server emitted for nine phases and which does not exist here.
  `/dashboard/team/invite` is the SEND screen, a different thing. `next.config.mjs` exports **`headers()`
  only** — there are no `redirects()` and no `rewrites()`, so nothing rescues a wrong URL, and
  `src/middleware.js` is the non-prod Basic-Auth guard which rewrites nothing.
- ‼️ **`public/.well-known/apple-app-site-association` is a load-bearing artefact of the MOBILE app.** It now
  claims **`/invitation`** as well as `/dashboard*`, because provider mobile's `InvitationAccept` screen has
  no in-app entry point and the email link is its only entrance. `clinqetmobilepartnerapp/__tests__/deepLinking.test.ts`
  cross-checks this file against the deep-link map **in both directions** and will fail the mobile build if
  they drift. **A route added here that the mobile app cannot route strands the app on a blank stack.**
- ‼️ **`assetlinks.json` still carries `<<FILL: partner_android_sha256_app_signing>>` placeholders.** Correct
  for a repository (they are per-keystore secrets) — but they must be substituted at deploy time or Android
  App Links silently degrade to a chooser dialog.
- **ESLint baseline: 756 files, 0 errors AND 0 warnings.** Unlike provider mobile, a single new warning here
  is a regression.
- **jest: 580 in 60 suites.**
- **Inline English on the tenancy surface: 0**, measured with an AST-shaped detector over
  `components/tenancy`, `lib/tenancy`, `app/dashboard/{team,inbox,activity}`, `app/dashboard/profile/locations`
  and `app/invitation` (21 files) — and the detector was proved non-vacuous by running it against
  `clinqetwebadmin`, where hardcoded English is correct by design (**AD1**) and it returns 34 hits.
- **Responsiveness: every fixed-width candidate on the tenancy surface is `max-w-[…]`**, the correct shrinking
  idiom — 15 flagged, 15 disproved by reading. ‼️ **A naive `w-\[` regex matches `max-w-[…]`; use a lookbehind.**
- **`Permissions-Policy: camera=(), microphone=(self), geolocation=(self)`** in `next.config.mjs` — ‼️ never
  `microphone=()`, which silently kills every voice feature.

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

## ‼️ NAVIGATION RESHUFFLE + OVERFLOW CUE (2026-08-15, owner-directed)

### The rail tail order is FIXED and pinned by a test

`Sidebar.jsx` ends: **Team → Billing → Call Follow-ups → Activity → Refund Requests**, all pushed after
Customers, which is the last untouched row. ‼️ **This SUPERSEDES the old "Call Follow-ups is the last row
in the rail" rule** — that assertion is gone from `sidebarRailConsistency.test.js` and replaced by four
that pin the new order. **Refund Requests is last because it is the least-opened screen** (owner's call,
overruling an argument that a waiting customer should lift it); it is not a statement about importance.
The order of the `routes.push` calls IS the contract — a feature flag being off may remove a row, never
reorder one. Insights remains the only legitimate `splice` (it belongs beside Leads, mid-list).

### The overflow cue — `useVerticalOverflow`

`src/hooks/useVerticalOverflow.js` is the vertical twin of `useHorizontalOverflow`, and
`clinqetwebuserapp/hooks/useVerticalOverflow.js` is a near-identical twin — **keep the two in step.**

- Returns `{ ref, canScrollUp, canScrollDown }`, **each edge separately**, so the cue says WHICH way there
  is more. Both false when the content fits ⇒ a tall window draws nothing.
- ‼️ **Entirely event-driven.** `ResizeObserver` fires once on `observe()` and that is what performs the
  FIRST measurement. **A `MutationObserver` on `childList` is not optional**: rows are DIRECT CHILDREN of
  the scroller, so a feature flag adding one changes `scrollHeight` while the container's own box stays
  identical and a ResizeObserver alone would never fire.
- ‼️ **Do NOT reintroduce an `overflowing` guard.** `overflowing && scrollTop > 1` is dead logic — with no
  overflow, `scrollTop` is 0 and `distanceToEnd` cannot exceed it. A sabotage run proved the branch
  unreachable (flipping it changed no test). The 1px tolerance on each edge IS the whole rule, and
  sabotaging **that** does fail the suite.
- ‼️ The customer-web copy carries **no `/* global ResizeObserver */`** (that app's ESLint declares it as
  a built-in and `no-redeclare` errors), while the partner copy REQUIRES it. That one-line difference is
  deliberate.
- ‼️ Customer web additionally enforces `react-hooks/set-state-in-effect` — **a synchronous `measure()` in
  the effect body is an ERROR there.** This is the second reason the hook is observer-driven.

### The markup rule

The cue elements are **siblings of the scroller, not children** — they pin to the visible edge instead of
scrolling with the rows, and they stop at the list edge rather than running under the pinned My Profile
footer. `data-visible={canScrollUp}` relies on React stringifying booleans on `data-*`. Both are
`aria-hidden="true"` and `pointer-events: none` — decorative, never a control, and never a click target.
CSS lives in `global.css` under "Rail overflow cue": navy fade + **lime** chevron on the navy rail.

### ‼️ "My" is gone from the labels — keys unchanged, VALUES changed

`sidebar.myBookings` now reads **"Bookings"**, `sidebar.myQuotes` reads **"Quotes"** — and so do
`header.My_Bookings`, `button.My_Bookings`, `Dashboard.MyBookings`, `Dashboard.MyQuotes`,
`Access.Surface.bookings`, `Access.Surface.quotes`, `bookings.myBookings`, `quotes.myQuotes` and the two
`seoConfig` titles, in **all five catalogues**.

- ‼️ **KEYS WERE DELIBERATELY NOT RENAMED.** `labelId` feeds `animKeyFor` → the `[data-anim="myQuotes"]`
  CSS rule and the `ANIM_KEYS` list in `sidebarRailConsistency.test.js`. Renaming keys churns both for
  nothing.
- ‼️ **Every `defaultMessage` must move with the value** — `sourceLocalizationIntegrity` requires an exact
  match and WILL fail the build. It caught `Header.jsx` on the first run; `CloseBusinessCard.jsx`'s
  `linkDefault` is NOT scanned by it, so that one has to be remembered by hand.
- The rule, product-wide: **ownership is established by the context, never repeated on the row.** On this
  rail the context is the dashboard; in the customer app it is the "My Account" group heading, which is
  why *that* heading keeps its "My".
- Non-English values were changed by **stripping the possessive determiner only** (`Mis`/`Mes`/`મારા`/`मेरी`);
  the noun was left exactly as authored. ‼️ **A pre-existing plural inconsistency was therefore preserved,
  not fixed** — gu/hi mix `બુકિંગ`/`બુકિંગ્સ` and `बुकिंग`/`बुकिंग्स` across keys.

## 2026-09-02 (Gate 3) — every knowledge upload cap comes from the SERVER
- `GET /knowledge` returns `maxFileSizeBytes`, `maxPagesPerDocument` and `maxExtractedCharacters` beside the document and passage caps. `KnowledgePage.jsx` reads them and passes them to `UploadKnowledgeModal.jsx`, which resolves `caps` once (`useMemo`) and pre-flights against THEM; `MAX_FILE_BYTES`, `KNOWLEDGE_MAX_PAGES` and `KNOWLEDGE_MAX_CHARACTERS` are first-render fallbacks only.
- ‼️ **No catalog string may quote a cap.** `knowledge.upload.dropHint`, `.invalidType` and `.tooLarge` interpolate `{max}` (megabytes, from the server value). Baking the number is what let the copy say 20 MB while the server allowed 30, and the guard tests now REFUSE any digit followed by MB/Mo in those three keys.
- The document cap is applied BEFORE any file is read: the pre-flight opens and byte-scans every accepted file, so the surplus is rejected first (`files.slice(0, free)`), using a `rowsRef` so the batch sees what it already holds.

## 2026-09-07 — responsive dashboard and M10 conversations

- Dashboard uses one fixed visual-viewport shell and one content scroller (`dashboardFrame.module.css`); `LayoutWrapper` accepts a constrained className. Search/inbox own their internal scrolling. The small CSS module owns native-dialog backdrop/entry animation and visual-viewport variables; this is a documented exception to the older Tailwind-only guidance.
- Hamburger drawer and header Ask use `ModalDialog` (`<dialog>.showModal()` in a portal): native top-layer hit testing/inertness, Escape/backdrop dismissal, cleanup on unmount. No global DOM/event monkeypatch is allowed; `devErrorSuppressor.js` and its imports were removed.
- Header is two rows below md: title/menu + workspace, then actions. A single row let the workspace chip cover the hamburger at 320px. Controls remain 44px; the title truncates without shrinking touch targets. All Sidebar bulk prefetch was replaced by pointer/focus intent.
- Anchored panels clamp within both visual viewport offsets and its dimensions, including keyboard/zoom. Catalog reads from the header are lazy while closed and workspace scoped.
- Dashboard service rows no longer stagger their appearance. The promo card has a static border and no stacked backdrop blur, pauses while outside the viewport or the document is hidden, and releases its observer/timer. The native promo pauses when backgrounded or unfocused.
- Ask is a full transcript with Back/New, member-scoped recent conversations, honest text-only replay, server-owned capacity and persistence acknowledgment. See the Business Search skill's M10 section. All five language catalogs contain the navigation/capacity/reload copy.

## Provider web hostname (owner-confirmed 2026-09-23)

The provider/business dev app is **https://business.dev.clinket.com/**. Regional dev hosts are
`https://business-ca.dev.clinket.com/` and `https://business-in.dev.clinket.com/`.
The provider hostname is `business` for each environment; `clinqetwebpartnerapp` remains the repository name.
Use these current URLs in instructions, tests and browser verification.

## SEARCH-TOPOLOGY PHASE 3 — the provider web app sends ISO countries (2026-09-22/24)

The server now takes a country STRICTLY (an ISO code or our English name, else 400 `Error_CountryInvalid`) on
business addresses and service areas, and stores the English name. Google's country name arrives in the
browser's language ("Canadá"), so the app sends the ISO code:

- `src/utils/geocodingUtils.js` → `countryForSave({ countryCode, countryName })`: the upper-cased ISO code when the
  form has one, else the stored (English) name.
- Used by `Profile/BusinessAddress.jsx`, onboarding `BusinessDetails.jsx`, and `SelectServiceAreaMap.jsx` (which
  tracks `countryCode` at all four places Google fills the country). A refused save toasts the server's sentence.
- Tests: `BusinessAddress.country.test.jsx`, `BusinessDetails.country.test.jsx`,
  `SelectServiceAreaMap.country.test.jsx`, `geocodingUtils.test.js`.
- Known, registered for the audit: onboarding `BusinessDetails.jsx` has no catch on the address submit, so a
  refused save ends in an unhandled promise rejection; a reloaded address in hi/gu/es shows "Canada is not
  supported" because the stored English name matches nothing in the translated list.

## Billing — overdue payments, settle first (2026-09-26)

Rules and server contract: `clinqet-payments` → *Overdue payments — settle first*. On the web billing page:
- `Billing.jsx`: `payOverdue(product)` → `PayOverdue` (`billingService.js`, `ProviderBillingPayOverdueAPI`); it shows the
  server's sentence, and opens the card sheet when the answer says a card or AutoPay is needed. `OverdueActions` (Pay now in
  brand green + Update card) on the AI card, the attention strip, the plan card and the minute-pack slot; `OverdueNextTry`
  (next try + last-try warning from `finalRetry`); "Trying your payment…" while busy; the bank-processing state (blue)
  from `paymentProcessing`; the plans grid says "pay first" while the plan is overdue.
- `PaymentMethodsSection` calls `onMethodsChanged(addedMethod?)` after make default, remove and add; the page handler
  `onPaymentMethodsChanged(addedMethod, { reloadMethods })` refreshes, and a chargeable default saved while overdue shows
  `billing.overdue.cardSavedRetrying` and refreshes once more after the queued retry has had time to run.
- Keys `billing.overdue.*` ×5 languages. Values passed into `FormattedMessage` are keyed elements (React key warnings).
- Tests (`src/components/billing/`): `OverdueSettleFirst.test.jsx`, `Billing.payOverdue.test.jsx`, `PaymentMethodsSection.test.jsx`.

## Subscription and assistant state refresh (2026-09-27)

- Provider web and native both use `services/providerStateEvents`: subscription, AI add-on, minute-balance and voice lifecycle notifications invalidate the corresponding demanded caches. SignalR single, batch and replay handlers dispatch once per payload; unrelated notifications do not trigger these reads.
- Web `VoiceAssistantContext` and `BillingOverviewContext` serialize forced refreshes behind an existing request and reject responses from an older mutation or workspace/session. Native `hooks/useVoiceAssistantState` and `services/billingOverviewService` mirror that rule; native plan-summary listeners update mounted Profile, Plan & Billing, dashboard and Call Follow-ups readers.
- AI gates revalidate when entered again, including when a cached promo prevents the screen content mounting. Web visibility/online and native foreground refresh recover missed notifications. An unused cache stays lazy; a previously failed requested cache can recover on the next event. Package/access gates remain in effect.
- A cached `NotInvited` is cleared during enrollment revalidation, so a failed refresh becomes unknown/retry instead of retaining the purchase promo. A known assigned/active state and known allowance survive transient read failures. `hooks/useVoiceUsage` updates mounted usage readers without remounting; an unavailable read is not evidence of no plan.
- Successful web subscription client mutations refresh assistant lifecycle; their existing callers still refresh the billing overview. No gateway, price, ledger, endpoint, schema or charge behavior changed.
- Dashboard lifecycle/setup widgets read the shared assistant state, not the stale business-profile projection. Native activity uses the server status `Active`.
- Setup layout uses available content width: number mode on the left, language plus reach-you phone on the right when space allows; one column on narrow screens. Manage mode preserves its separate layout. Assigned web number/actions move to the right at 800px container width and lead on narrow layouts. Native form columns use measured width and font scale, retaining native phone keyboard/pickers. Revalidation preserves unsaved form edits.
- Regression coverage: web `src/context/providerStateRefresh.test.jsx`, `src/hooks/useVoiceUsage.test.jsx`, SignalR teardown tests and voice-form validation; native `__tests__/providerStateRefresh.test.ts`, `aiSurfaceFocusRefresh.test.tsx`, `voiceUsageRefresh.test.tsx` and `voiceApplicationValidation.test.tsx`. These exercise real caches/gates with mocked transports, stale in-flight responses, notification batches, offline recovery, workspace purge, feature/access gating and unsaved edits.
## Remembered sessions (2026-09-28)

Superseded 2026-09-29 by the cookie-renew model (`clinqet-auth-sessions`, `clinqet-ui-common` "Session model"): no Web Locks and no stored refresh token. A transient renew failure (network, 5xx, 400 `session_transport_required`) keeps the tab on `PrivateRoute`'s retry screen (`Session.RestoreFailed.*`) and never signs out; only `session_ended` ends the session. Browser regression: `e2e/tests/auth/refresh-session.spec.js` (two tabs, rewritten for renew).

Provider web `businessSearchService.askBusinessSearch` and `StreamProviderSetupDocument` bypass Axios for streaming; they use `sessionRequestHeaders` + `resendAfterUnauthorized`, the same identity rules as `apiClient`. A transient renew failure must never sign the member out of Ask Clinket.

---

## AI Assistant number screens (2026-10-02) → `clinqet-voice-number-lifecycle`

The number choice, setup progress, held / removed / recovered and request-a-change screens follow
`C:\Nik\Data\voice-number-lifecycle\UI-CONTRACT.md` §1–§2 and §4; the rendering rules live in
`src/lib/voiceNumber/numberRules.js` and the provider app mirrors them rule for rule. The dedicated-mode
"number to reach you on" is never typed and never sent.

One owner of the status read and its polling: `useVoiceNumberStatus` in `VoiceAssistantPage.jsx`; panels only
draw it. It polls `Open` too, treats a confirm's own answer as a read, and `watchSetup(id)` keeps an
unanswered confirm's id until it is seen open or ended. The screen rules that were defects in review are
listed in `clinqet-voice-number-lifecycle` §7 — change them there, in the contract and in the app together.

## 2026-10-03: sign-in landing, consent, register row, knowledge row

- `HomeClient` returns once the external-login exchange started (Next syncs `replaceState` into `searchParams`) and holds `restoreSession` until it settles; `useAuthManager` follows `onSessionToken`/`onAuthPurge`. See `clinqet-auth-sessions` "Sign-out then sign-in again".
- Consent: `services/cookieChoiceRecord.js` + the `PolicyReconsentModal` listener; `CookieConsentBanner` is a non-blocking bottom card. See `clinqet-ui-common`.
- Register: `ThirdParty` shows every option; divider `Auth.Continue_With`.
- ‼️ AI Knowledge document row: a run that suggested nothing shows NO box (owner, 2026-10-03). `resolveAnalyticsLine` returns `{ variant: 'none', notFullyScanned }`; only the part-of-file warning can speak for it. Found (with Review), pending, failed (Try again) and part-of-file are unchanged. The `quiet` notice tone, the `none` icon and the seven `knowledge.drafts.row.none*` keys are gone.

- Audit follow-ups 2026-10-03: see `clinqet-ui-common` / `clinqet-auth-sessions` "Audit follow-ups". The sign-in row is ONE line at every width (`clinqet-ui-common` "One line, every width", 2026-10-04); the knowledge row draws no empty notices wrapper for a nothing-found file (`knowledge-row-notices`).

## Consent: one question at a time (2026-10-03)

See `clinqet-ui-common` "Consent model — one question at a time". It covers: nothing on sign-in surfaces; a small bottom cookie card (per device); one signed-in agreements dialog that carries the cookie question when this device has not answered it; Terms + Privacy only on Register and on the server. Provider web: `lib/consentSurfaces` (`hidesAgreementsDialog` / `hidesCookieCard`).

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
- Web: `resolveRefreshBlock(doc, suggestionRefresh)` (`knowledgeDraftMeta.js`) greys out the row menu's Refresh suggestions and the
  failed line's Try again, with the reason underneath (`knowledge.drafts.rerun.blocked.{turnedOff,dailyLimit,doneToday}`, all five
  languages). The same block greys out every Read again (menu, a stopped row's inline button + notice, the reading notice's
  link). A refused press closes the ask and re-reads the list so the screen catches up.

## Billing UI audit fixes (2026-10-04)

- One promo rule on every compared price (plan cards, AI rows, current-plan strip, AI state card; monthly and yearly): the original struck, the promo price, and `billing.promo.cardHint`. `isPromoPrice(base, discounted)` in `Billing.jsx` strikes only when the promo is lower; `StruckPrice` adds sr-only `billing.price.was` / `billing.price.now`.
- A repeating promo on yearly billing covers the FIRST yearly charge only: `billing.annual.promoSaving[Plain]` say "on your first year" and `billing.annual.billedAnnuallyStrike` says "for your first year".
- Yearly view with a plan trial shows the trial badge AND the yearly total. The not-enrolled AI tab reads `monthlyPriceMinor` (the catalog add-on has no `priceMinor`).
- `IntervalToggle`: the chosen option is brand green (#97EF29 / #101010) and stays `min-h-11` at every width.
- `LockedLeadCard` takes `upgradeAvailable={null}` while lead usage is loading and shows no limit sentence until it answers (leads list + detail).
