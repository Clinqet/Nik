# P4-F — Provider UI (partner web + provider mobile): parity and localization — closing audit

Dimension auditor F, 2026-09-25. Read-only. Nothing under `C:\Nik` was created, edited, moved or deleted. No build,
test, npm/jest/eslint run, and no git write. Read-only git (`log`, `show`) was used. Four read-only node scripts
live in the session scratchpad (`scratchpad\p4f\keys_web.js`, `keys_mobile.js`, `banned_intl.js`,
`unused_imports.js`); they read language files and sources and write nothing.

Severity follows the brief: Critical = wrong facts reach a caller/provider, provider data destroyed, or cross-tenant
leak; High = real defect in a common path or an owner decision not implemented; then Medium, Low, Improvement.

---

## 1. Scope actually read

**Authority:** `CLAUDE.md` §0 (as loaded), `AGENT-BRIEF.md`, `FINDINGS-2026-09-10.md` §9–§10, `evidence\agent-U-provider-ui.md`
(all 516 lines), `PLAN.md` (all, incl. the mockup register and the four owner changes), `PHASE-2B-PROMPT.md` §2.5
(L630–680), `phase-2\PROGRESS-SESSION2.md` §8, §21–§32, §15.11–§15.23, `phase-3\AUDIT.md` §0–§2, §12–§13,
`phase-3\HANDOVER.md` (all), `phase-3\PROGRESS.md` §0–§2, §9. `Data\mockups\REGISTER.md` (targeted rows).

**Mockups, read in full:** `knowledge-document-row-truth\index.html` (646), `business-search-source-whose-words\index.html`
(471), `knowledge-screen-honest-counts-and-reasons\index.html` (438). Also `knowledge-row-notice-consolidation\index.html`
(268, text of every frame) because both apps' code cites it.

**Web `C:\Nik\clinqetwebpartnerapp\src` — read in full:** `components/Profile/knowledge/KnowledgePage.jsx` (1964) ·
`KnowledgeServiceDraftsSection.jsx` (1716) · `UploadKnowledgeModal.jsx` (530) · `KnowledgeDraftEditModal.jsx` (490) ·
`knowledgeDraftMeta.js` (394) · `TeamSearchAudienceBox.jsx` (379) · `KnowledgeImagesPanel.jsx` (359) ·
`ReceptionistAccessBox.jsx` (294) · `knowledgeMeta.js` (271) · `DocumentViewer.jsx` (266) · `DocumentPreview.jsx` (211) ·
`KnowledgeFaqModal.jsx` (155) · `DocumentDetailsModal.jsx` (122) · `KnowledgePickers.jsx` (81) · `knowledgePreflight.js` (79) ·
`knowledgeDraftCache.js` (52) · `KnowledgeModalShell.jsx` (29) · `lib/knowledge/receptionistAccess.js` (99) ·
`lib/knowledge/documentPreview.js` (118) · `services/knowledgeServices.js` (141) · `app/dashboard/profile/knowledge/**` (4 files, 53) ·
`components/dashboard/home/assistant/AssistantKnowledgeCard.jsx` (138) · `AssistantDocumentsCard.jsx` (230) ·
`components/businessSearch/SourceCard.jsx` (405) · `SourcePanel.jsx` (162) · `components/common/ConfirmationModal.jsx` (L40–130).
**Partial:** `lib/businessSearch/askRules.js` (L20–50, L480–571: the channel rule and `groupSources`), `FileTypeTile.jsx`
(label grep), `lib/knowledge/searchAudience.js` (not read), tests: `knowledgeGuards.test.js` (L612–645), grep over all
knowledge/businessSearch tests for `channel`/`aiWritten`.

**Mobile `C:\Nik\clinqetmobilepartnerapp\src` — read in full:** `Screen/ProfileFlow/Knowledge/index.tsx` (3205) ·
`KnowledgeServiceDraftsSection.tsx` (1631) · `KnowledgeDraftEditSheet.tsx` (620) · `knowledgeDraftMeta.ts` (545) ·
`KnowledgeImagesPanel.tsx` (373) · `KnowledgeDocumentScreen.tsx` (272) · `DocumentPreview.tsx` (233) · `knowledgeRowMeta.ts` (123) ·
`knowledgeSurface.ts` (6) · `services/knowledgeService.ts` (539) · `Util/knowledgePreflight.ts` (104) ·
`lib/knowledge/serverMessage.ts` (21) · `Screen/homeTab/MyDashboardScreen/AssistantKnowledgeCard.tsx` (205) ·
`components/businessSearch/SourceCard.tsx` L120–270. **Partial:** `lib/knowledge/receptionistAccess.ts` (L80–106),
`lib/businessSearch/askRules.ts` (L108–110, L433–478), `Util/mediaLimits.ts` (L41–49), `style.ts` /
`knowledgeImagesStyle.ts` / `knowledgeDraftsStyle.ts` (targeted selectors), `OfferingPickerSheet.tsx` / `FileTypeTile.tsx`
(key grep), `components/common/ConfirmDialog.tsx` (L60–100), `components/ModalBlurBackdrop.tsx` (grep),
`Screen/homeTab/MyDashboardScreen/AssistantDocumentsCard.tsx` (grep), `authenticationFlow/LoginWithEmail/index.tsx`
(L45–75, L245–275 + git history), tests (targeted: `knowledgeDraftPlacementTruth`, `knowledgeRowStopped`,
`knowledgeProcessingWatch`, `knowledgeImagesParity`, `fabResponsiveLayout`, `knowledgeRereadConfirm`).
**Not read:** `PdfPreview.tsx` (119), `SourceSheet.tsx` (grep only), `BusinessSearch/index.tsx` (grep only).

**Server (targeted, to judge what the UI promises):** `KnowledgeController.cs` (L84–200, L548–583, L726–733, L1059–1264) ·
`KnowledgeServiceDraftsController.cs` (L39–53, refusal status codes) · `KnowledgeReadingNotices.cs` (all 194) ·
`KnowledgeDraftApprovalService.cs` (L225–305, L1020–1091, L1480–1519) · `KnowledgeServiceDraftAnalyticsJob.cs`
(L550–619, L760–799, L1430–1471) · `KnowledgeIngestProcessorFunction.cs` (L680–740, L955–1011, L1715–1745, L2330–2463) ·
`KnowledgeServiceDraftDtos.cs` (L1–170) · `KnowledgeSearchModels.cs` (L55–99) · API `appsettings.json` (L3136–3175) ·
server `en.json` (targeted keys).

**Language completeness (scripted, read-only):** web — 550 referenced keys across the 25 in-scope files, all present and
non-empty in `en-US, es-US, fr-CA, gu-IN, hi-IN`; 448 family keys (`knowledge.*`, `knowledgeViewer.*`,
`businessSearch.source.*`, `assistantKnowledge.*`, `assistantDocs.*`), 0 gaps. Mobile — 494 referenced keys across 20
in-scope files resolve (incl. `_one/_other`) in `en, es, fr, gu, hi`; 533 family keys (`KNOWLEDGE.*`,
`KNOWLEDGE_VIEWER.*`, `ASSISTANT_KNOWLEDGE.*`, `BUSINESS_SEARCH.SOURCE.*`), 0 gaps, 0 incomplete plural pairs,
0 single-brace placeholders. No hardcoded user-facing English in the in-scope JSX/TSX (text nodes and
`aria-label/title/placeholder/alt/accessibilityLabel` scanned).

---

## 2. Findings

### Summary

| Id | Sev | Title |
|---|---|---|
| P4-F-01 | **High** | X-01: a grouped document source shows AI-written parts unmarked (or marks the provider's own words as AI) — both apps |
| P4-F-02 | **High** | Mobile never shipped U-05, and still swallows the confirm refusal U-06 named — phase 3 recorded both closed |
| P4-F-03 | **High** | The draft editor opens an unanswered card on "At my location" and always sends it; the amber-intercept "Save and approve" (controls hidden) writes that answer and creates the service there — both apps |
| P4-F-04 | **High** | Approve / "Add the N shown" / "Add all" confirmations state the PANEL's placement, not the card's — both apps (U-01 residual) |
| P4-F-05 | **High** | `.csv` (and `.tif`) are refused by both client gates ("can't be added as it is … save it as .xlsx") although the server has accepted them since phase 2 §8.1; tests pin the stale decision |
| P4-F-06 | **High** | Owner change #1 not built: no row motion bar (A3/A4, reduced-motion aware) on either app; web's "Taking longer" pill has no spinner at all |
| P4-F-07 | Medium | "Read the file again and we'll try to describe it" is false once a picture's second description was refused (10 client files + server key) |
| P4-F-08 | Medium | "Add or set aside what's here and we'll carry on" cannot happen for a capped file whose run left nothing waiting |
| P4-F-09 | Medium | X-01's explanation line: web hover-only `title`; phone has no key and the chip is not tappable |
| P4-F-10 | Medium | X-01's chip has zero UI tests on either app (the renderer is unpinned) |
| P4-F-11 | Medium | Mobile spins beside a "Stopped" pill (raw status); the U-13 guard pins the exact defective expression |
| P4-F-12 | Medium | Row-notice family: web boxes all seven notices, mobile two; the governing sheet is "Awaiting approval" in the register and its own stamp while both codebases call it approved (§0.7.1/§0.20) |
| P4-F-13 | Medium | Web uses "Keep it" as Cancel on non-delete dialogs, and as the STOP button of a running "Add all" — inverted meaning |
| P4-F-14 | Low | Re-read warning not pluralised on either app: "You have 1 suggestions waiting" |
| P4-F-15 | Low | Picture-delete dialog says "processed again" (10 files; gu/hi transliterate "process") — gotcha-26 sibling |
| P4-F-16 | Low | Row line "usually under a minute" contradicts the upload hint "a minute or two" (both apps) |
| P4-F-17 | Low | Web re-read dialog collapses `\n\n`: the U-08 warning runs into the body (sheet C4 draws an amber box) |
| P4-F-18 | Low | Reading-notice Dismiss (both) and Read again (web) are offered to read-only members; both endpoints need `voice.settings.manage` |
| P4-F-19 | Low | A Stopped row keeps the 30-minute processing ladder running, then the page says "taking longer than usual" about it (both) |
| P4-F-20 | Low | U-19 residual: names clamp at two lines where the sheet says wrap fully; mobile sheet titles/draft names one line |
| P4-F-21 | Low | Touch targets: mobile tick slop is clipped by the tile (~39 px); 28 px "···" menus are the only route to row actions at phone width |
| P4-F-22 | Low | U-21 residual: mobile first load is a bare spinner; the sheet draws row skeletons |
| P4-F-23 | Low | U-25 residual: unscoped "Show N more" undercounts after approvals/dismissals (both) |
| P4-F-24 | Low | Download dialogs omit the file name and size that B3/B4/D4 draw (both) |
| P4-F-25 | Low | Document page and dashboard card drop the notice dot and the reading notice (web + mobile) |
| P4-F-26 | Low | Mobile `getKnowledge()` in-flight sharing is not keyed by workspace (web is) — UNCERTAIN reachability |
| P4-F-27 | Low | Mobile re-read dialog loads a full drafts page to read one count; web asks `pageSize=1` |
| P4-F-28 | Low | Mobile `resolveDocumentRowActions` is tested but unused by the screen (gotcha 16: test the consumption) |
| P4-F-29 | Low | Web U-05 residual: a server-refused row still offers "Try again"; all refusals red (sheet: busy-replace amber) |
| P4-F-30 | Low | Hygiene: duplicated statement, duplicated comment blocks, two false/stale comments |
| P4-F-31 | Low | X-01 chip drawn identical to "Not published" (sheet: info vs warn, "stack and never merge") |
| P4-F-32 | Improvement | `receptionistUploadDefault(seed, materialSharingEnabled = true)` — the default parameter widens (both twins) |
| P4-F-33 | Improvement | Document/dashboard previews download the whole file on every mount (≤30 MB web, ≤15 MB mobile PDF) |
| P4-F-34 | Improvement | Mobile re-reads the list after mutations whose response already carries it |
| P4-F-35 | UNCERTAIN | Which causes may offer "Read again": PLAN wording vs sheet/server disagree |
| P4-F-36 | UNCERTAIN | Dismissing a reading notice also clears D-1 terminal-failure notices (sheet F: "never hides a failure") |

Counts: **High 6 · Medium 7 · Low 18 · Improvement 3 · Uncertain 2.** No Critical.

---

### P4-F-01 · High · X-01 — a grouped document source mislabels whose words its parts are (web + mobile)

**Where.** Web `src/lib/businessSearch/askRules.js:504-571` (`groupSources`), `src/components/businessSearch/SourceCard.jsx:142, 237-244`.
Mobile `src/lib/businessSearch/askRules.ts:433-478`, `src/components/businessSearch/SourceCard.tsx:187-191`.

**Evidence.** Grouping merges every Document citation of one `docId`, whatever its channel:
```js
const groupable = citation.kind === CITATION_KIND.Document && typeof citation.docId === "string" && citation.docId.length > 0;
const existing = groupable ? byDoc.get(citation.docId) : undefined;
if (existing) { existing.parts.push(part); … continue; }
… lead: citation,
```
The chip reads only the lead:
```jsx
const citation = group.lead;                       // SourceCard.jsx:142
{aiWrittenLabelKey(citation.channel) ? ( … {t(aiWrittenLabelKey(citation.channel))} … ) : null}   // :237-244
```
Mobile is the same (`aiWrittenLabelKey(citation.channel)`, `SourceCard.tsx:187`). The channel is per CARD on the server:
`KnowledgeSourceChannel.Of` maps `Text/Table/FaqPair → document`, `ImageCaption → picture-description`, anything else
(DocSummary/DocAggregate) `→ generated-overview` (`clinqetshared/Models/Voice/KnowledgeSearchModels.cs:89-94`) — and
caption and overview cards share the parent document's `docId`.

**Violates.** X-01 and the approved-by-waiver sheet `business-search-source-whose-words` ("The absence of a mark is the
message — it can only ever mean 'these are your own words'"; "Two marks stack and never merge").

**Scenario.** Ask "what does the GA 22 cost?" against a spec-sheet PDF with photos. Citation [1] is a price row
(`document`), [2] the photo's caption (`picture-description`: "Atlas Copco GA 22 rotary screw compressor, red housing")
from the same file. One card, lead [1] ⇒ **no chip**, and part [2]'s machine description is listed under the document's
name as the document's own words — X-01's exact harm. Reverse order (overview first) marks the provider's real price
rows "Summary written by AI".

**Fix direction.** Carry the channel per PART (render the chip on each part, or split a group whenever channels
differ), and pin it with a mixed-channel fixture on both apps.

**Confidence.** High from code. NEEDS-LIVE-PROOF only for frequency (a live answer citing a document's text and its
caption/overview together).

---

### P4-F-02 · High · Mobile never implemented U-05, and still swallows the confirm refusal (U-06)

**Where.** `clinqetmobilepartnerapp/src/Screen/ProfileFlow/Knowledge/index.tsx:954-957, 968-1000, 1085-1108, 1989-1992`.

**Evidence.** The per-file refusal is thrown inside `allSettled` and discarded; only ids survive:
```ts
if (!slot || slot.isSuccess === false || !slot.uploadUrl) {
  throw new Error(slot?.errorMessage || 'no-upload-slot');          // :955-957
}
…
    landedPairs.forEach(({ file }) => landedIds.add(file.id));
  } catch {
    // confirm refused ⇒ nothing landed; every row falls through to failed below   // :998-1000
  }
```
The failed row always prints the generic key: `file.state === 'failed' ? (<Text …>{t('KNOWLEDGE.FILE_UPLOAD_FAILED')}</Text>)`
(`:1991-1992`; en: "This file couldn't be uploaded. Try again."). A refused **replace** toasts the same generic line:
`if (failedIds.size > 0) { Toast.show(t('KNOWLEDGE.FILE_UPLOAD_FAILED'), Toast.LONG); }` (`:1099-1101`).
`PickedFile` (`:226-242`) has no field that could carry a reason. The phase-3 mobile commit `3dc5ebe7` lists U-06, U-12,
U-14 … U-25 and X-01 — **not U-05** — and no mobile test mentions `FILE_UPLOAD_FAILED`, `errorMessage` or U-05.

**Violates.** U-05 and U-06 (FINDINGS §10), the sheet `knowledge-screen-honest-counts-and-reasons` §1 ("The phone used
to swallow the refusal that comes back from a confirm … It now shows the same sentence the web does"), CLAUDE.md §0.7.1
MOBILE MIRRORS WEB. `phase-3\AUDIT.md` §1 records U-05 closed "Web and mobile in the same session" — false for mobile.

**Scenario.** On the phone, replace a document a colleague just started re-reading: the server answers the slot with
`Error_KnowledgeReplaceTargetInvalid` ("… wait until it finishes processing"); the provider reads "This file couldn't be
uploaded. Try again." and retries into the same refusal. A confirm refused for full searchable space or a limit shows
nothing but the generic row line.

**Fix direction.** Keep `slot.errorMessage` on the picked row (and the confirm failure via `failureMessage`), render it
instead of the generic key, and use the same sentence in `startReplace`; add the mobile twin of web's U-05 test.

**Confidence.** High.

---

### P4-F-03 · High · The draft editor turns every edit of an unanswered card into "At my location", even where it hides the control (web + mobile)

**Where.** Web `KnowledgeDraftEditModal.jsx:81-85, 129, 158-178, 386-458`; `KnowledgeServiceDraftsSection.jsx:744-765`.
Mobile `KnowledgeDraftEditSheet.tsx:161-165, 240-257, 261, 473-503`; `KnowledgeServiceDraftsSection.tsx:543-564`.
Server `clinqetinfrastructure/Services/Knowledge/KnowledgeDraftApprovalService.cs:269-289, 1491-1510`;
`clinqetshared/DTOs/Knowledge/KnowledgeServiceDraftDtos.cs:161-162`.

**Evidence.** Seeding and submit (web; mobile identical in shape):
```jsx
setPlace(draft.place || AT_STORE);                       // web :83   mobile :163 draft.place === AT_CUSTOMERS ? AT_CUSTOMERS : AT_STORE
…
place,                                                   // web :170  mobile :252 — always sent
```
In the amber intercept the placement controls are not rendered: `{!interceptBlock && ( … whereLabel … areaLabel … )}`
(web `:386`, mobile `:473/:505`). The server stamps the card as the provider's own answer whenever the placement changes:
```cs
var placementBefore = PlacementOf(draft);
if (edit.Place.HasValue) draft.Place = edit.Place;       // null → AtStore is a change
…
if (PlacementOf(draft) != placementBefore)
    draft.PlacementEditedAt = DateTime.UtcNow;            // :275-289
```
— although the DTO already offers the way out: `// Null leaves the draft's own answer alone` (`KnowledgeServiceDraftDtos.cs:161`),
and the server's own comment claims the opposite behaviour: *"Someone who opened Edit to fix a price left the "where"
controls exactly as the card presented them, and their approval bar goes on applying to it as before."* (`:269-271`).
The card, meanwhile, shows the panel's answer for an unanswered draft (`resolveDraftPlacement`, web `:135`, mobile `:1063`).

**Violates.** U-01/U-02 and §21/§26's "the card's sentence and the created service are the same thing"; PLAN phase-2 exit
criterion "approve honours the saved placement on web and mobile".

**Scenario.** A mobile barber sets the panel to "At the customer's location · Downtown". An amber card reads
"… · At the customer's location · Downtown". Approve → the intercept opens on the price only → "Save and approve" →
PUT sends `place: AtStore` + `Default` area → `PlacementEditedAt` stamped → `approveOne` override repeats `place: AtStore`
→ the service is created **at the barber's own location, default area** — never shown, never chosen. Any ordinary Edit
(e.g. fixing the name) of an unanswered card silently detaches it from the panel the same way.

**Fix direction.** Seed the editor from `resolveDraftPlacement(draft, approvalSettings)`, and send `place: null` (and an
unchanged area choice) unless the provider actually touched those controls — always null in intercept mode. Pin it with
a test that drives the real editor, not a stubbed `onSubmit` (the current `knowledgeDraftPlacementTruth.test.tsx:208-241`
hands the section a hand-built payload, so the seeding is unpinned).

**Confidence.** High (both halves read; server stamping rule read).

---

### P4-F-04 · High · Approve confirmations state the panel's placement, not the card's (web + mobile)

**Where.** Web `KnowledgeServiceDraftsSection.jsx:1036-1044, 1050-1056, 1082-1089, 1106-1122`. Mobile
`KnowledgeServiceDraftsSection.tsx:867-876, 886-893, 922-929, 938-949`.

**Evidence.**
```js
const settingsSummary = `${whereLabel} · ${chosenAreaLabel}`;   // from approvalSettings (the panel)
approve: { … message: intl.formatMessage({ id: "knowledge.drafts.confirmApprove.body" }, { settings: settingsSummary }),
```
`knowledge.drafts.confirmApprove.body` = "It goes live right away with the price and details on this card, at
{settings}." (en-US.json:6106; mobile `DRAFTS_CONFIRM_APPROVE_BODY`, en.json:5014). The card uses the resolved
placement; the server keeps the card's own place/area (`draft.Place ??= settings.Place; if (draft.PlacementEditedAt != null) return;`,
`KnowledgeDraftApprovalService.cs:1495-1504`), including a document-proposed area (`StatesItsOwnArea`, `:1517-1518`).

**Violates.** U-01 — the original finding named this very dialog ("the confirm body … mixes 'details on this card' with
the panel's `{settings}`"); §21's fix covered the card and the server, not the dialog.

**Scenario.** A card reads "… · At my location · Burlington (new area)" (a proposed area from the document). Approve →
dialog: "It goes live … at At my location · Hamilton (your default)". The provider cancels (or confirms believing it goes
to Hamilton); approve actually creates it in the new Burlington area. For "Add the N shown"/"Add all" the dialog claims
one placement for every card while cards with their own answers keep theirs.

**Fix direction.** Single approve: build `{settings}` from `resolveDraftPlacement(draft, approvalSettings)`. Mass actions:
say "at {panel}, except cards that name their own place".

**Confidence.** High.

---

### P4-F-05 · High · Both clients refuse `.csv` (and `.tif`) that the server accepts, and say it "can't be added"

**Where.** Web `components/Profile/knowledge/knowledgeMeta.js:6-25, 36-43`; `UploadKnowledgeModal.jsx:61-74`.
Mobile `Screen/ProfileFlow/Knowledge/index.tsx:215-220, 246-251`; `Util/mediaLimits.ts:47`. Server
`clinqetapi/Clinqet.API/appsettings.json:3136-3157` (`"AllowedExtensions": [ … ".csv", … ".tiff", ".tif", ".bmp" ]`).

**Evidence.**
```js
const CONVERT_HINTS = { ".csv": "knowledge.upload.convertToExcel", ".tsv": …, ".xls": …, ".doc": … };   // web
const CONVERT_HINTS: Record<string, 'excel' | 'word'> = { '.csv': 'excel', '.tsv': 'excel', '.xls': 'excel', '.doc': 'word' };  // mobile
allowedExtensions: ['.pdf', …, '.tiff', '.bmp']            // mobile mediaLimits.ts:47 — no .csv, no .tif
```
Copy: "{name} can't be added as it is. Open it in Excel, save it as .xlsx, and upload that." (web en-US.json:3280,
mobile en.json:4909). Git: the client refusal is from 2026-08-25 (`46aed7d5` web, `0f2d3b64` mobile); the server
started accepting `.csv` on 2026-09-12 (`5e045f9`, `PROGRESS-SESSION2.md` §8.1 "`.csv` reads as a TABLE … A CSV is the
format most likely to BE a price list"). Tests pin the stale decision: web `knowledgeGuards.test.js:616-640` ("CSV parsing
was considered and DEFERRED") and mobile `__tests__/knowledgeImagesParity.test.ts:266-277` (`expect(flat).toContain("'.csv': 'excel'")`).
The sheet `knowledge-screen-honest-counts-and-reasons` U-12 frame lists "CSV" among the kinds the phone picker must offer.

**Violates.** Phase-2 §8 (owner-approved upload gate), the U-12 sheet frame, "never promise/claim what the product does
not do".

**Scenario.** A provider's price list is `rates.csv` (or a scanner's `menu.tif`). Both apps refuse it before upload with a
sentence that says the product cannot read it; the phase-2 CSV table reader is unreachable from every UI.

**Fix direction.** Remove `.csv` from both convert maps, add `.csv`/`.tif` to both accept lists and MIME maps, update the
upload hints, and rewrite the two pinning tests with the reason.

**Confidence.** High.

---

### P4-F-06 · High (visual impact) · Owner change #1 not built: no motion bar; web's "Taking longer" pill has no spinner

**Where.** Web `KnowledgePage.jsx:142-160, 443`; mobile `index.tsx:1737-1747`. No bar anywhere: grep for
`motion-reduce|prefers-reduced-motion|track` over `KnowledgePage.jsx`, `index.tsx`, `style.ts` finds none (mobile's only
`isReduceMotionEnabled` is the Suggestions-tab cue, `index.tsx:742`).

**Evidence.**
```jsx
{status === "Processing" && watching && ( <span className="… animate-spin" /> )}   // StatusChip, KnowledgePage.jsx:147-149
<StatusChip status={rowStatus} … />                                               // rowStatus is "TakingLonger" for a slow row
```
`PHASE-2B-PROMPT.md:640-668` (binding): "moved onto the row's own meta line, plus a thin moving bar … A4 — the pill
itself changes: blue Reading → amber Taking longer, same spinner slowed, same bar slowed … the bar moves only while work
is happening, and stops under `prefers-reduced-motion`". PLAN.md:88 repeats it; sheet A3/A4 draws `.track` with
`@media (prefers-reduced-motion: reduce)`.

**Violates.** Owner changes #1 and #4 ("They are requirements, not suggestions").

**Scenario.** A 20-minute scan turns amber "Taking longer" on web with no motion at all (reads as frozen); neither app
ever shows the bar.

**Fix direction.** Build the bar on both apps (web CSS + `motion-reduce:`, mobile `Animated` gated on
`AccessibilityInfo.isReduceMotionEnabled`), and give web's TakingLonger pill the slowed spinner. Or record the divergence
with the owner.

**Confidence.** High.

---

### P4-F-07 · Medium · "Read the file again and we'll try to describe it" is false after the second refusal

**Where.** Client copy `knowledge.images.noDescriptionFeedback` (web en-US.json:6067 + 4 languages) and
`KNOWLEDGE.IMAGES_NO_DESCRIPTION_FEEDBACK` (mobile en.json:5163 + 4); rendered at web `KnowledgeImagesPanel.jsx:235, 282`,
mobile `KnowledgeImagesPanel.tsx:243, 291`. Server `Error_KnowledgeImageNoDescription` (server en.json:2963) "Read the
document again to try describing it." Pipeline `clinqetfuncations/.../KnowledgeIngestProcessorFunction.cs:2361-2364`.

**Evidence.**
```cs
// ‼️ Already offered twice and refused. A content-filter refusal is deterministic on the
// same bytes, so this is not a retry that can succeed …
if (pointer.CaptionRefused) { alreadyRefused++; continue; }
```
and the admin alert the same run raises says the opposite of the provider copy: *"… still came back with no description,
so they remain unsendable"* (`:2452-2463`). `CaptionRefused` exists only on the banked artefact
(`clinqetcore/Models/Knowledge/KnowledgeContentArtifact.cs:129`); no DTO carries it, so neither app can tell the cases apart.

**Violates.** Owner change #3 "Never promise an outcome the code does not deliver". (Gotcha 26 itself — the word
"Reprocess" — **is fixed** in all 10 files; this is what the fixed sentence now promises.)

**Scenario.** A photo refused by the content filter twice: every later "Read again" re-describes nothing, while both
apps keep telling the provider that reading again will try.

**Fix direction.** Expose "refused twice" on the image DTO and say "we can't describe this picture — add it as a service
photo instead", or soften the copy to what is guaranteed.

**Confidence.** High from code.

---

### P4-F-08 · Medium · The part-of-file promise "we'll carry on from where we stopped" is unreachable when nothing is left waiting

**Where.** Copy `knowledge.drafts.row.partOfFile` / `knowledge.drafts.partialScan` (web en-US.json:6925, 5972) and
`DRAFTS_ROW_PART_OF_FILE` / `DRAFTS_PARTIAL_SCAN` (mobile en.json:5281, 5119), drawn on BOTH outcomes incl. `none`
(web `KnowledgePage.jsx:704-712`, mobile `index.tsx:1470-1478`). Server `KnowledgeServiceDraftAnalyticsJob.cs:598-605`;
`KnowledgeDraftApprovalService.cs:1046-1067`.

**Evidence.** The only continuation trigger runs after a provider approve/dismiss, and only when nothing is pending:
```cs
// A file the cap could not finish carries on the moment the provider has answered everything it suggested
if (remaining.Any(d => d.Status == KnowledgeServiceDraftStatus.Pending)) continue;   // ContinueCappedDocumentsAsync
```
A capped run whose every candidate the judge set aside returns before any decided rows are remembered:
```cs
if (survivors.Count == 0) { … await CommitAnalyticsAsync(… draftCount: 0 …); return; }   // job :598-605 (RememberDecidedRowsAsync is at :786)
```
With zero suggestions there is nothing to "add or set aside", so no action can ever invoke the continuation, and the
next manual Re-run reads the same first slice (no rows were remembered).

**Violates.** Owner change #3; U-09's own rationale ("`none` is the whole point").

**Scenario.** A 1,500-line price list at a business whose trade does not match its first 1,000 lines: the row says
"No services to suggest … This file is very long … Add or set aside what's here and we'll carry on" — and nothing ever
carries on.

**Fix direction.** Remember decided rows on the zero-survivor path and let the job continue by itself when a capped run
leaves nothing pending; or keep the `none`-variant copy to what is true (e.g. the consolidation sheet's "we checked the
first part … Callers are still answered from all of it").

**Confidence.** High from code; NEEDS-LIVE-PROOF for how often the zero-survivor capped case occurs.

---

### P4-F-09 · Medium · X-01's explanation line is hover-only on web and absent on the phone

**Where.** Web `SourceCard.jsx:237-241` (`title={t("businessSearch.source.aiWritten.hint")}`); mobile `SourceCard.tsx:187-191`
(a plain `<Text>`, no `onPress`). Mobile language files contain `AI_PICTURE` and `AI_OVERVIEW` only (en.json:6676-6677) —
no hint key in any of the five.

**Violates.** Sheet `business-search-source-whose-words`: every web frame draws the `.hint` line inline under the snippet
("Not the document's own words — check the file before repeating a name, a code or a price from it."); phone: "Tapping
the chip opens the same sentence the web shows inline"; copy table: phone "same key, shown on tap".

**Scenario.** A provider on a phone or tablet sees "Described by AI from a photo" with no way to learn that the model
number beside it must be checked; on web it appears only on mouse hover.

**Fix direction.** Render the hint inline on web (under the excerpt); add the key to all five mobile files and a
tap-to-reveal on the chip.

**Confidence.** High.

---

### P4-F-10 · Medium · X-01's chip is not pinned by any UI test on either app

**Evidence.** Web: no test references `aiWrittenLabelKey`, `SOURCE_CHANNEL`, `picture-description` or
`businessSearch.source.aiWritten` (grep over `src/**/*.test.*`; `SourceCard.grouping.test.jsx`, `replayParity.test.jsx`,
`sourceGrouping.test.js`, `askRules.test.js` contain no channel assertion). Mobile: no `__tests__` file references
`AI_PICTURE`, `AI_OVERVIEW`, `aiWrittenLabelKey` or `picture-description`.

**Violates.** Brief rule 4 (the READ must be pinned, separately from the write); CLAUDE.md §0.8. The server side is pinned
(`BusinessSearchReplayParityTests`), so deleting the chip from either app would pass every suite — and P4-F-01 went
undetected for exactly this reason.

**Fix direction.** Renderer tests on both apps: single-channel cards, absent channel = no chip, and the mixed group of
P4-F-01.

**Confidence.** High.

---

### P4-F-11 · Medium · Mobile spins beside "Stopped" (raw status); the U-13 guard pins the defect

**Where.** Mobile `index.tsx:1737-1747`; test `__tests__/knowledgeProcessingWatch.test.ts:94`.

**Evidence.**
```tsx
{((doc.status === 'Processing' && !pollExhausted) || rowBusyId === doc.docId) && ( <ActivityIndicator … /> )}
<Pill label={t(STATUS_LABEL[rowStatusOf(doc)])} … />       // "Stopped"
```
The guard asserts that exact string:
`expect(screen).toContain("{((doc.status === 'Processing' && !pollExhausted) || rowBusyId === doc.docId) && (");`.
Web decides the spinner from the resolved status (`StatusChip status={rowStatus}` → no spin for "Stopped").

**Violates.** U-04 (§23.2: "Stopped, amber, no spinner — there is no run to spin for"), U-13 ("a spinner is a claim"),
MOBILE MIRRORS WEB; brief rule 3 (a guard pinning the defect).

**Scenario.** A stuck file (>160 min) opened on the phone shows an amber "Stopped" pill with a live spinner for the next
30 minutes of polling.

**Fix direction.** Gate on `rowStatusOf(doc) === 'Processing'`; rewrite the guard to pin the rule.

**Confidence.** High.

---

### P4-F-12 · Medium · Row-notice family diverges between the apps, under a sheet whose approval is not recorded

**Where.** Web `KnowledgePage.jsx:634-725` (every notice is a `RowNotice` box: replacement-live, stopped, reading,
pending, found, none, part-of-file, failed). Mobile `index.tsx:1617-1694, 1461-1525`: only `none` (`styles.outcomeNotice`)
and the reading notice are boxes; pending `<Text style={styles.docMeta}>`, found `<Text style={styles.docLink}>`, failed
`<Text style={styles.docFail}>`, stopped `<Text style={styles.docStopped}>`, replacement-live `<Text style={styles.docNotice}>`,
part-of-file a pill + loose text.

**Evidence (governance).** Web code: "‼️ Approved sheet `knowledge-row-notice-consolidation`: ONE box family …"
(`KnowledgePage.jsx:167`, also `:553`, `:684`); mobile `index.tsx:1498`; commits `7df98e7d` (web) and `7dc1f5d5`
(mobile, "Implements the approved sheet …"), both 2026-09-14. But `Data/mockups/REGISTER.md:46` says "‼️ **AWAITING OWNER
APPROVAL (drawn 2026-09-14)**", the sheet's own stamp says "Awaiting approval" (`index.html:112`), no approval appears in
any `Data/**/*.md` or memory entry, and PLAN.md's register (this programme's authority) neither lists the sheet nor
records that `knowledge-document-row-truth` was superseded "on the notice area".

**Violates.** CLAUDE.md §0.7.1 MOCKUP GATE / §0.20 register rules; MOBILE MIRRORS WEB ("Nothing outside a box", sheet §4).

**Fix direction.** Owner to confirm the approval and the register/PLAN rows be updated (or the build reverted to the
approved sheet); then bring mobile's five loose notices into the box family.

**Confidence.** High (build), High (register state).

---

### P4-F-13 · Medium · Web's "Keep it" is the cancel of non-delete dialogs, and the STOP of a running "Add all"

**Where.** Web `KnowledgePage.jsx:1876, 1898, 1930`; `DocumentViewer.jsx:253`;
`KnowledgeServiceDraftsSection.jsx:1535, 1549, 1686, 1710`. `knowledge.deleteConfirm.cancel` = "Keep it"
(en-US.json:3318).

**Evidence.**
```jsx
<button type="button" onClick={handleCancelBulk} className={BTN}> <FormattedMessage id="knowledge.deleteConfirm.cancel" /> </button>   // :1534-1536, stops the run
<button … onClick={() => { clearBulkRun(businessId); setBulkRun(null); }}> <FormattedMessage id="knowledge.deleteConfirm.cancel" /> </button>   // :1548-1550, discards a paused run
```
Download confirm: `cancelLabelId="knowledge.deleteConfirm.cancel"` (`KnowledgePage.jsx:1898`). Mobile uses
`COMMON.CANCEL` for all of these (`index.tsx:3132, 3170, 3182`; drafts `:1410, 1421, 1603, 1620`).

**Violates.** Sheet B3/B4 copy table (`Common_Cancel` "Cancel"); MOBILE MIRRORS WEB; U-22 aligned only the delete dialog.

**Scenario.** During "Add all new services" the only control on the progress banner reads "Keep it" — a provider who
wants the run to keep going presses it and stops the run; on the paused-run banner "Keep it" deletes the saved run.

**Fix direction.** Use `common.cancel` everywhere except the delete dialogs.

**Confidence.** High.

---

### P4-F-14 · Low · The re-read warning is not pluralised (both apps, 10 files)

**Evidence.** Web `knowledge.reread.waiting`: "You have {count} suggestions waiting from this file. …" (en-US.json:6921;
es/fr/gu/hi likewise plural nouns); mobile `REREAD_WAITING` has no `_one/_other` siblings (en.json:5277), unlike
`REREAD_WAITING_EDITED_one/_other`. Chosen when `edited === 0` (web `KnowledgePage.jsx:1808-1813`, mobile
`index.tsx:3145-3148`).
**Scenario.** One pending suggestion, unedited → "You have 1 suggestions waiting from this file." — the class the
programme fixed live on 2026-09-15 ("We left 1 sentences out").
**Fix.** ICU plural on web; `_one/_other` on mobile. **Confidence.** High.

### P4-F-15 · Low · "It stays deleted even if this file is processed again" (10 files)

**Evidence.** `knowledge.images.deletePermanent` (web en-US.json:6082) / `IMAGES_DELETE_PERMANENT` (mobile en.json); gu
"ફરીથી પ્રોસેસ", hi "दोबारा प्रोसेस" transliterate "process"; es "se procese", fr "est traité". Drawn in the picture-delete
dialog (web `KnowledgeImagesPanel.jsx:333-335`, mobile `KnowledgeImagesPanel.tsx:345`).
**Violates.** Gotcha 26 (name the control that exists: "Read again") and the brief's ban on "reprocess"; the gotcha-26
sweep fixed `noDescriptionFeedback` and missed this sibling. **Confidence.** High.

### P4-F-16 · Low · "usually under a minute" on the row vs "a minute or two" in the upload hint

**Evidence.** `knowledge.row.readingUsualTime` "usually under a minute" (en-US.json:6954; mobile
`ROW_READING_USUAL_TIME` en.json:5314) beside `knowledge.upload.processingHint` "Most files are ready in a minute or two. A
long or scanned file can take up to {minutes} minutes." (en-US.json:3277; mobile en.json:4876). §29.2 recorded the
"under a minute" claim as the untrue sentence that sized the old ladder. **Fix.** One wording. **Confidence.** High.

### P4-F-17 · Low · Web re-read dialog runs the U-08 warning into the body

**Evidence.** `message={[ … "knowledge.reread.body" …, rereadWaiting > 0 ? … : null ].filter(Boolean).join("\n\n")}`
(`KnowledgePage.jsx:1803-1815`) rendered by `<p className="… leading-relaxed">{message}</p>`
(`ConfirmationModal.jsx:117`, no `whitespace-pre-line`) → one paragraph. Sheet C4 draws the warning as an amber
banner. Mobile RN `Text` keeps the paragraph break. **Confidence.** High.

### P4-F-18 · Low · Notice Dismiss / Read again offered to members who cannot use them

**Evidence.** Web `ReadingNotice` has no `canManage` input; Read again and ✕ render for everyone
(`KnowledgePage.jsx:227-273, 658-663`). Mobile gates Read again (`doc.readingNotice?.canReadAgain && canManage`,
`index.tsx:1670`) but not Dismiss (`:1681-1691`). Endpoint: `[RequiresPermission("voice.settings.manage", …)]`
(`KnowledgeController.cs:558`); reprocess likewise. **Violates.** TD-37.3 "absent via can(), never disabled"
(`KnowledgePage.jsx:590`). **Confidence.** High.

### P4-F-19 · Low · A Stopped row keeps the processing ladder alive, then gets a second, contradicting voice

**Evidence.** `processingKey` keys every `doc.status === "Processing"` row (web `KnowledgePage.jsx:935-939`, mobile
`index.tsx:538-542`), stopped ones included; after 30 minutes `pollExhausted` shows "This is taking longer than usual.
We have stopped checking automatically." (`knowledge.poll.stalled`) above a row whose pill and notice say it stopped.
Nine list reads per page visit for a row with no run behind it. **Fix.** Exclude `stopped` rows from the key.
**Confidence.** High.

### P4-F-20 · Low · U-19 residual — names clamp where the sheet says wrap

**Evidence.** Web upload row `className={… break-words line-clamp-2 …}` (`UploadKnowledgeModal.jsx:404-409`); mobile doc
row and upload row `numberOfLines={2}` (`index.tsx:1555, 1562, 1986`); mobile actions-sheet title `numberOfLines={1}`
(`:2190`); draft card names single-line (web `truncate` `KnowledgeServiceDraftsSection.jsx:161`, mobile
`numberOfLines={1}` `KnowledgeServiceDraftsSection.tsx:1088`). Sheet §3: "The name wraps onto as many lines as it needs."
`title` does nothing on touch. **Confidence.** High.

### P4-F-21 · Low · Touch targets (U-18 and the row menus)

**Evidence.** Mobile tick: `hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}` (`KnowledgeImagesPanel.tsx:223`) on a
22 px tick at `top: 5, right: 5` inside a tile with `overflow: 'hidden'` (`knowledgeImagesStyle.ts:81-113`); React
Native never extends a touch area past the parent's bounds, so the top/right slop is lost — effective ≈39×39 px, not the
sheet's 44. Web row "···" is `w-7 h-7` (28 px, `KnowledgePage.jsx:106`) and is the only route to Replace/Read
again/Download/Delete below `sm`; mobile drafts "···" `menuBtn` 28×28 with no hitSlop (`knowledgeDraftsStyle.ts:87-96`,
used `KnowledgeServiceDraftsSection.tsx:1293-1301`). Web's tick is fine (`before:-inset-[11px]`, `KnowledgeImagesPanel.jsx:212`).
**Confidence.** High (RN documents the parent-bounds rule).

### P4-F-22 · Low · U-21 residual — mobile first load is a bare spinner

**Evidence.** `{loading ? ( <Loader show={true} /> ) : …}` (`index.tsx:2813-2814`); the sheet's U-21 phone frame draws
three shimmering rows ("A bare spinner over an empty screen reads as broken"). The box skeletons ship
(`renderBoxSkeleton`, `:2302-2311`). **Confidence.** High.

### P4-F-23 · Low · U-25 residual — "Show N more" undercounts after single approvals

**Evidence.** Web `nextPageSize = scoped ? null : Math.min(pageSizeRef.current, Math.max(1, tabTotal - items.length))`
(`KnowledgeServiceDraftsSection.jsx:977`); mobile `:635` same. `countOneHandled` decrements `tabTotal` per approve/dismiss
while the ghost cards stay in `items` (web `:578-594`, mobile `:389-407`). 30 creates, page of 25, approve 5 → "Show 1
more" while 5 remain. **Confidence.** High.

### P4-F-24 · Low · Download dialogs do not name the file

**Evidence.** Web `ConfirmationModal … message={<FormattedMessage id="knowledge.download.confirmBody" />}`
(`KnowledgePage.jsx:1882-1900`, `DocumentViewer.jsx:246-255`); mobile `message={… t('KNOWLEDGE.DOWNLOAD_CONFIRM_BODY')}`
(`index.tsx:3161-3176`, `KnowledgeDocumentScreen.tsx:213-224`). Sheet B3/B4/D4 draw the file name and size inside the
dialog. **Confidence.** High.

### P4-F-25 · Low · The document page and dashboard drop the notice dot and the notice

**Evidence.** Web `DocumentViewer.jsx:149, 169-173` and `AssistantDocumentsCard.jsx:35-43` render `STATUS_META[...]`
without `hasNotice`; mobile `KnowledgeDocumentScreen.tsx:137, 158` `<Pill label={t(STATUS_LABEL[status])} … />` without
`dot`; none renders `readingNotice`. A file whose re-read failed (D-1) reads plain "Ready" on its own page. Gotcha 16/25
class (a renderer that drops what the row carries). **Confidence.** High.

### P4-F-26 · Low · Mobile list request sharing is not keyed by workspace — UNCERTAIN reachability

**Evidence.** Mobile `let knowledgeInFlight …; if (knowledgeInFlight) { return knowledgeInFlight; }`
(`services/knowledgeService.ts:386-394`); web keys it: "Keyed by the auth headers, so a request made for one workspace is
never handed to a call made for another" (`services/knowledgeServices.js:23-42`). A switch mid-request could render the
previous business's list. **NEEDS-LIVE-PROOF:** switch workspace on the phone while the dashboard/knowledge list loads.

### P4-F-27 · Low · Mobile re-read dialog loads a full drafts page for one number

**Evidence.** `const list = await getKnowledgeServiceDrafts({ docId: doc.docId });` under the comment "The count lives in
perDocument, so the page itself is not needed" (`index.tsx:1144-1145`); web `GetKnowledgeServiceDrafts({ docId, pageSize: 1 })`
(`KnowledgePage.jsx:1288`); the endpoint accepts `pageSize` (`KnowledgeServiceDraftsController.cs:53`). Each item mints a
read-SAS for its image. **Confidence.** High.

### P4-F-28 · Low · Mobile row-action rule tested but not consumed

**Evidence.** `resolveDocumentRowActions` (`knowledgeRowMeta.ts:54-62`) is imported only by
`__tests__/knowledgeRowStopped.test.ts`; the action sheet re-derives it inline (`doc.status !== 'Processing'`,
`doc?.status === 'Failed' || doc?.stopped === true`, `index.tsx:2193, 2207`). Equivalent today; the tests cannot see a
change to the screen (gotcha 16 rule 3). **Confidence.** High.

### P4-F-29 · Low · Web U-05 residual

**Evidence.** A row refused by the server still renders "Try again" (`{failed && !uploading && ( … knowledge.row.tryAgain … )}`,
`UploadKnowledgeModal.jsx:458-466`), which re-requests the same refused slot for type/size/name refusals; every reason is
red (`:412`) where the sheet draws the busy-replace case amber. **Confidence.** High.

### P4-F-30 · Low · Hygiene (§0.14 / §22.2)

- `setRereadEdited(0);` twice, the second mis-indented (`KnowledgePage.jsx:1314-1315`).
- Duplicated comment blocks in `knowledgeDraftMeta.ts:357-368` ("Only the four fields the rule reads …" then "Only the
  fields the rule reads …") and `:379-382` (repeats `:357-364`).
- `app/dashboard/profile/knowledge/document/page.jsx:7` "reads ?id= from the URL" — the viewer reads `docId`
  (`DocumentViewer.jsx:58`).
- Mobile `index.tsx:3159-3160` "Cancel is the resting action, and a tap outside cancels" — `ConfirmDialog` has no outside
  handler and its backdrop is `pointerEvents="none"` (`ModalBlurBackdrop.tsx:19`).

### P4-F-31 · Low · X-01 chip looks identical to "Not published"

**Evidence.** Both are `bg-[#FFFBEB] … text-[#92400E]` (web `SourceCard.jsx:240, 249`) / `styles.labelDraft` (mobile
`SourceCard.tsx:188, 196`). The sheet draws AI marks `pill info` and "Not published" `pill warn`: "Two marks stack and
never merge … They answer different questions".

### P4-F-32 · Improvement · The U-14 default parameter widens

`export const receptionistUploadDefault = (seed, materialSharingEnabled = true) => …` (web `lib/knowledge/receptionistAccess.js:90`,
mobile `.ts` twin). Every current caller passes the switch (web `UploadKnowledgeModal.jsx:52`, `KnowledgeFaqModal.jsx:31,40`;
mobile `index.tsx:809, 1365`) except mobile's `useState` initialiser (`index.tsx:411`, overwritten on open). A future
caller that omits it stores "answers & sends" — the widening U-14 removed. Default to `false` or make it required.

### P4-F-33 · Improvement · Previews download the whole file on every mount

Web `useDocumentPreview` fetches the full file (`DocumentPreview.jsx:68-80`) for the dashboard's newest document on every
dashboard visit (`AssistantDocumentsCard.jsx:95-96`) and every document-page open (cap 30 MB); mobile does the same
(PDF ≤ 15 MB → base64, `DocumentPreview.tsx:48-75`, `lib/knowledge/documentPreview.ts:46`). Blob egress is a stated cost
concern (CLAUDE.md §0.11). A per-session cache or a derivative would bound it.

### P4-F-34 · Improvement · Mobile re-reads the list after mutations that return it

Web applies the mutation response (`applyListResponse(res)` after confirm/reprocess/delete/FAQ/details,
`KnowledgePage.jsx:1217, 1240, 1307, 1384`; `handleUploaded`); mobile ignores it and calls `load(false)`
(`index.tsx:1041, 1180, 1202, 1352, 1399`). One extra list read per action.

### P4-F-35 · UNCERTAIN · Which causes may offer "Read again"

Server: `ReadingAgainWouldHelp(keys) => keys.Any(key => key is RanOutOfTime or PagesUnread)`
(`KnowledgeReadingNotices.cs:115-116`); both apps render the server's `canReadAgain`. The sheet copy table offers it for
cause 4b (`PagesUnread` "Offers Read again: usually transient"); PLAN.md:90 says "a re-read helps only two" and then the
budget case "is the only cause that offers **Read again**"; the task brief says "only budget-exhausted offers Read again".
`RasterizationFailed` correctly offers no Read again (Replace stays on the row). **Owner to confirm** whether
`PagesUnread` keeps the offer.

### P4-F-36 · UNCERTAIN · Dismiss can hide a D-1 failure notice

`DismissReadingNoticeAsync` sets `row.ReadingNotices = null` (`KnowledgeManagementService.cs:945`), which since D-1 also
holds terminal-failure notices (`Info_KnowledgeReReadKeptPrevious`, `…NoRoomKeptPrevious`, `KnowledgeReadingNotices.cs:59-101`).
Sheet F: "A dismissed notice … never hides a failure, only an information line." Both apps show ✕ on every notice.
Owner decision whether kept-previous failures are dismissable.

---

## 3. ESLint item (6) — the seven pre-existing errors phase 3 recorded

ESLint was not run (forbidden here). Five of the seven are traceable in git; all five were fixed on 2026-09-16 by
`ab2f32e4` ("… a hook called inside a ternary branch, two unused imports …"):

| Error | Where (then) | Verdict | Now |
|---|---|---|---|
| `react-hooks/rules-of-hooks` — `useProductKey` inside `!IsPhoneScreen ? ( … )` | `src/Screen/authenticationFlow/LoginWithEmail/index.tsx:261` (`<Text …>{t(useProductKey("LOGIN.DESCRIPTION", "LOGIN.DESCRIPTION_AI"))}</Text>`, seen via `git show ab2f32e4^`) | **REAL bug.** `IsPhoneScreen` is state toggled at runtime (`:86`, `SetIsPhoneScreen(true)` `:357`), so switching to phone login changes the hook count on the sign-in screen (React throws "Rendered fewer hooks than expected") | Fixed: hoisted to `:56` `const descriptionKey = useProductKey(…)`, used at `:261` `t(descriptionKey)` |
| unused import `TouchableOpacity` | `__tests__/fabResponsiveLayout.test.tsx:3` | Noise (test file) | Removed |
| unused variable `FAB_SIZE` | `__tests__/fabResponsiveLayout.test.tsx:33` (`const FAB_SIZE = 60;`) | Noise | Removed |
| unused imports `React`, `ReactTestRenderer` | `__tests__/knowledgeRereadConfirm.test.tsx:1-2` | Noise | Removed (the file now uses `require`) |

The remaining two of phase 3's seven (it said "four unused imports in two test files"; three are accounted for above)
cannot be identified without running ESLint; a hand check of both named test files' current imports finds nothing
unused. **NEEDS-LIVE-PROOF:** `npx eslint .` in `clinqetmobilepartnerapp` once no other session is building.

---

## 4. Closure check (original ids in this dimension)

| Id | Status |
|---|---|
| U-01 | SUPERSEDED-BY server `ApplyApprovalDefaults` + `Place` word — card and server agree (web `KnowledgeServiceDraftsSection.jsx:135`, mobile `:1063`, server `KnowledgeDraftApprovalService.cs:1491-1510`). **REGRESSED in two new places:** confirm dialogs (P4-F-04) and editor seeding (P4-F-03) |
| U-02 | FIXED-AND-VERIFIED-IN-CODE (web `:744-765`, mobile `:543-564`) — but the payload's `place` is the editor's AT_STORE seed for unanswered cards (P4-F-03) |
| U-03 | FIXED-AND-VERIFIED-IN-CODE — ladder from `processingMaxMinutes` (web `knowledgeMeta.js:157-181`, `KnowledgePage.jsx:933,951`; mobile `knowledgeRowMeta.ts:96-123`, `index.tsx:546,563`); hint quotes the budget. Copy residual P4-F-16 |
| U-04 | FIXED-AND-VERIFIED-IN-CODE — `Stopped` pill, sentence, Read again, Replace withheld (web `knowledgeMeta.js:83-87,142-153`, `KnowledgePage.jsx:596-599,643-657`; mobile `index.tsx:1648-1650, 2193-2218`). Mobile spinner residual P4-F-11 |
| U-05 | Web FIXED-AND-VERIFIED-IN-CODE (`UploadKnowledgeModal.jsx:206-213, 240-282, 410-412`; residual P4-F-29). **Mobile NOT-FIXED (P4-F-02)** |
| U-06 | Mobile catch paths FIXED (`failureMessage` in every `catch` of `index.tsx` and `KnowledgeImagesPanel.tsx`). **Confirm refusal NOT-FIXED** (`index.tsx:998-1000`, P4-F-02) |
| U-07 | FIXED-AND-VERIFIED-IN-CODE (`resolveDocumentRowActions`, `KnowledgePage.jsx:361, 376-382, 601-608`) |
| U-08 | FIXED-AND-VERIFIED-IN-CODE (web `KnowledgePage.jsx:1282-1297,1798-1819`; mobile `index.tsx:1138-1153, 3140-3158`). Residuals P4-F-14, P4-F-17 |
| U-09 | FIXED-AND-VERIFIED-IN-CODE for the rendering (web `KnowledgePage.jsx:704-712`, `KnowledgeServiceDraftsSection.jsx:1197-1201`; mobile `index.tsx:1470-1478`, `KnowledgeServiceDraftsSection.tsx:1260-1266`). Promise undeliverable in the zero-pending case (P4-F-08) |
| U-10 | FIXED-AND-VERIFIED-IN-CODE (mobile `KnowledgeDraftEditSheet.tsx:189-219` uses `resolveDraftTaxonomy` / `showsNewSubcategoryFor` / `taxonomyPayload`) |
| U-11 | FIXED-AND-VERIFIED-IN-CODE (chips web `:209-221`, mobile `:1113-1120`; editor web `KnowledgeDraftEditModal.jsx:305-348`, mobile `KnowledgeDraftEditSheet.tsx:394-426`) |
| U-12 | FIXED-AND-VERIFIED-IN-CODE for the MIME map (mobile `index.tsx:260-291`). `.csv`/`.tif` still refused (P4-F-05) |
| U-13 | FIXED for `pollExhausted` (mobile `index.tsx:1737`); REGRESSED for Stopped rows, guard pins it (P4-F-11) |
| U-14 | FIXED-AND-VERIFIED-IN-CODE (web `receptionistAccess.js:90-95`; mobile twin; callers pass the switch). Improvement P4-F-32 |
| U-15 | FIXED-AND-VERIFIED-IN-CODE (web `KnowledgeImagesPanel.jsx:153-161` + ICU plural; mobile `KnowledgeImagesPanel.tsx:189-192` + `_one/_other`; `droppedImages` is the ingest-time row value, `KnowledgeController.cs:122-128`) |
| U-16 | FIXED-AND-VERIFIED-IN-CODE (amber dot web `KnowledgePage.jsx:150-156,443`, mobile `index.tsx:1742-1747`; dismissable notice both). Residual P4-F-18, P4-F-36 |
| U-17 | FIXED-AND-VERIFIED-IN-CODE (web `knowledgeMeta.js:258-271`, `KnowledgePage.jsx:1159-1163`; mobile `knowledgeRowMeta.ts:79-92`, `index.tsx:779-781`) |
| U-18 | Web FIXED (`before:-inset-[11px]`); mobile PARTIAL (P4-F-21) |
| U-19 | PARTIAL — two-line clamp, not full wrap (P4-F-20) |
| U-20 | FIXED-AND-VERIFIED-IN-CODE (`KnowledgeDraftEditSheet.tsx:228` `Number(price) > Number(maxPrice)`) |
| U-21 | FIXED for the two boxes (`index.tsx:2302-2320, 2470`); screen loading still a spinner (P4-F-22) |
| U-22 | FIXED-AND-VERIFIED-IN-CODE — subtitle/tab/"Keep it"/no "(s)" in all five mobile files (script: 0 "(s)" in either family; `COUNT_LIMIT_REMAINING` gone) |
| U-23 | FIXED-AND-VERIFIED-IN-CODE (`KnowledgeServiceDraftsSection.jsx:101` `<Link href={ProfileRoute.ManageServicesPrice}>`) |
| U-24 | FIXED-AND-VERIFIED-IN-CODE (mobile gate `index.tsx:492-508, 633-643`; web one listener `KnowledgePage.jsx:1001-1009`, shared in-flight request `knowledgeServices.js:30-42`) |
| U-25 | FIXED under a filter (`showMoreUnknown`, web `:977,1632-1637`; mobile `:635,1466-1476`); unscoped residual P4-F-23 |
| X-01 | PARTIAL — single-channel cards FIXED on both apps (`SourceCard.jsx:237-244`, `SourceCard.tsx:187-191`; keys in all 10 files); **mixed groups REGRESS the fix (P4-F-01)**; hint P4-F-09; no tests P4-F-10; styling P4-F-31 |
| E7 / R-9 (UI) | FIXED-AND-VERIFIED-IN-CODE — both apps render the server's `heading`/`causes`, offer Read again only on `canReadAgain` (web `KnowledgePage.jsx:227-273`, mobile `index.tsx:1654-1693`; server `KnowledgeController.cs:1083-1113`) |
| E8 (UI) | FIXED-AND-VERIFIED-IN-CODE (see U-03) |
| Gotcha 25 | FIXED-AND-VERIFIED-IN-CODE — analytics failure sentence rendered (web `knowledgeDraftMeta.js:181` + `KnowledgePage.jsx:721`; mobile `knowledgeDraftMeta.ts:279` + `index.tsx:1517`) |
| Gotcha 26 | FIXED-AND-VERIFIED-IN-CODE in all 10 files ("Read the file again" / "Vuelve a leer" / "Relisez" / "ફરી વંચાવો" / "दोबारा पढ़वाएँ"; server key too). Sibling missed (P4-F-15); promise false after a second refusal (P4-F-07) |
| Owner change #1 (one pill, amber dot) | Pill + dot FIXED on the knowledge rows (both); **motion bar / slowed spinner NOT-FIXED (P4-F-06)**; other renderers drop the dot (P4-F-25) |
| Owner change #2 (every download gated) | FIXED-AND-VERIFIED-IN-CODE on every entry point: web row menu both widths (`KnowledgePage.jsx:391-406, 412-413, 629`), B2 line (`:542-549`), document page + preview fallback (`DocumentViewer.jsx:181, 199, 246-255`); mobile action sheet (`index.tsx:2247-2276`), B2 link (`:1630-1638`), document screen (`KnowledgeDocumentScreen.tsx:167, 213-224`); dashboards have no download. Previews fetch bytes but never save a file. Web cancel focus + Esc (`ConfirmationModal.jsx:50, 84`). Residuals P4-F-13, P4-F-24 |
| Owner change #3 (never promise) | Read again gated by the server (P4-F-35 open); RasterizationFailed offers no Read again ✓. Violations elsewhere: P4-F-07, P4-F-08 |

---

## 5. Verified OK (with evidence)

- **Language completeness:** web 550/550 referenced keys and 448/448 family keys present and non-empty in all five
  files; mobile 494/494 referenced keys (incl. `_one/_other`) and 533/533 family keys in all five; no single-brace
  placeholder on mobile; no hardcoded user-facing English in the in-scope JSX/TSX.
- **Banned words:** no `passage/chunk/index/embedding/retrieval/token/payload/endpoint/stream/cache/blob/SAS/schema/frame/flag/
  marker/partition/reprocess/vision/OCR/AI Search` in any English value of either family; the translated sweep found only
  fr "Schéma" (= "diagram", an ordinary word, `knowledge.images.kind.diagram`) and the gu/hi "process" in P4-F-15.
- **No "(s)"** in any language of either family (script).
- **E7/R-9:** notices are the server's resolved sentences, one cause alone / several under the server heading; `_One`
  singular chosen server-side (`KnowledgeReadingNotices.cs:33-47`, `KnowledgeController.cs:1087-1100`).
- **Refusals on the knowledge API are non-2xx** (`KnowledgeServiceDraftsController.cs:110-112, 142, 312-314, 412-416`;
  no `Ok(ApiResponse…Fail)` in either controller), so mobile's `unwrap` rule (`!res.ok` ⇒ throw,
  `knowledgeService.ts:357-376`) cannot report a refusal as success.
- **U-08 edited count** exists server-side (`KnowledgeServiceDraftDocumentCountDto.Edited`, `KnowledgeServiceDraftDtos.cs:91-97`)
  and both apps read it.
- **Placement resolver twins** are identical, incl. the `placementEdited` branch (web `knowledgeDraftMeta.js:258-291`,
  mobile `knowledgeDraftMeta.ts:383-415`).
- **Server upload caps are served, not mirrored** (`maxFileSizeBytes`, `maxPagesPerDocument`, `maxExtractedCharacters`,
  `processingMaxMinutes`, `analyticsMaxMinutes`; `KnowledgeController.cs:151-156`), used by both apps with fallbacks only.
- **No document-count cap is read** by either app (web `KnowledgePage.jsx:1440-1441`; mobile `index.tsx:652-668`;
  both dashboard cards show a count, not a meter).
- **Receptionist/audience boxes:** loading skeletons (web `ReceptionistAccessBox.jsx:194-205`, `TeamSearchAudienceBox.jsx:161-172`;
  mobile `index.tsx:2302-2320`), failed writes revert and toast the server sentence on both.
- **Web one-list-two-renderers (gotcha 16):** desktop menu derived from the shared list
  (`desktopMenuItems = menuItems.filter(…)`, `KnowledgePage.jsx:412-413`).
- **Gotcha 26 server key** reworded ("Read the document again", server `en.json:2963`).
- **Mobile U-12 MIME map** mirrors web's table (`index.tsx:260-283` vs `knowledgeMeta.js:206-225`).
- **Web confirm dialog** rests focus on Cancel and closes on Esc/backdrop (`ConfirmationModal.jsx:50, 84, 102`).
- **Mobile duplicate-tap guards:** audience/receptionist use refs (`index.tsx:1253-1257, 1317-1318`); uploads `uploadBusy`.
- **Conditional-hook ESLint error** is fixed (`LoginWithEmail/index.tsx:56, 261`).

— end of report —
