# Knowledge reading accuracy — BUILD STATE (resume from here)

Authority: `PLAN.md` (§1A solution, §1B owner decisions). Findings: `findings\AUDIT-1..5-*.md` (ids P0-x, F-xx, AS-xx, CS-xx/CX-xx/CD-xx).
Owner, 2026-10-02 (verbatim intent): build ALL of it, no waiting for approval, all standards, web + mobile, quality over speed,
full sandbox freedom (re-upload, rerun), alerts meaningful (lost / moved / invented), raw AI readings kept with a proper
storage lifecycle, cost under control. Explain simply at the end.

Working mode: IN PLACE under C:\Nik (no worktree, no drive). Scratch only in the session scratchpad. Never git
checkout/restore/stash/reset (§0.19). No commits/pushes unless asked. Live deploy is NOT possible from this login
(v4 stamp resources are not in the visible subscription) — proof = real code on real banked readings offline + tests +
owner deploys then "Read again".

> ‼️ **2026-10-02 (late) — HANDOVER.** The owner stopped new items in this session. The remaining build moves to a NEW
> session started from `NEXT-SESSION-PROMPT.md` (raw files: `RAW-FILES.md`). This session now runs a multidimensional
> code audit (no test runs) of everything it wrote and fixes every finding. **Audit status: IN PROGRESS** — the new
> session must not edit the files listed in `NEXT-SESSION-PROMPT.md` §0.3 until the log below has a line starting
> `HANDOVER AUDIT CLOSED`.
>
> **True status at handover** (the register below was written as a plan; this overrides it):
> - DONE: U1–U4; A1 (figure writers + parser normalises old shapes), A2 (figure/fence/page-break line states), A3
>   (furniture marked, never deleted), A4 in the parser (conservation gate + page rebuild + plain-text floor + report);
>   E for the knowledge ingest (one alert per reading, two types, processor keyed by EventId, admin labels web + mobile,
>   notices); F (storage lifecycle ARM); markup inside pipe cells (O-3).
> - PENDING (new session): A4 reporting in setup / drafts / picture text (PLAN-D); A5 assembly gate (PLAN-B
>   PageConservationAudit); A6 / AS-04 picture identity; B0–B6 (PLAN-B); C (PLAN-C); D (PLAN-D); the rest of E (setup +
>   drafts per-reading report, remove the per-check Required / Outcome / layout alerts, O-1 admin `[]` details); the
>   deployment SKILL lifecycle line and the BusinessSearchDocumentService comment; the §6 "wrong answers" report (sheet
>   first); G proof; the final H audit of the new session's own work.
> - D-b "Tell our team": REJECTED by the owner, sheet deleted (PLAN.md §0A, §1B).

## Work register (status: TODO / DOING / DONE)
### U — UI (owner-approved 2026-10-02)
- U1 DONE moving bar removed, web + mobile, tests + sabotage.
- U2 DONE picture delete confirm inside the viewer (web: alertdialog in render.controls, Escape/Tab, errors inside;
  mobile: one native window, back cancels confirm, errors inside), tests + sabotage.
- U3 DONE sentences follow the file's real access: twins `receptionistReachesCallers` + `pictureSendBlock` (web .js /
  mobile .ts), draft "none" sentences + pictures sentence, keys ×5 languages ×2 apps. Tests to update/add.
- U4 DONE notice ✕ / Read again hidden without voice.settings.manage (web + mobile).

### A — Never lose content (P0, highest)
- A1 TODO one figure writer, tags on own lines (CarryFigures + SectionStitcher.AddToFigure) + Join normalises banked shapes (AS-01).
- A2 TODO parser line states: close honoured anywhere, new figure closes the open one, page break closes figure/fence and
  always counts, EndsAnUnclosedFigure, inline fence = text, table remnants (P0-1, P0-11, P0-12, P1-8, AS-07).
- A3 TODO furniture: single-token marker, never tag lines / open blocks / table body rows / headings, distinct pages,
  contiguous edge band, numbered titles kept (P0-1..3, P0-7, AUDIT-4 P0-4).
- A4 TODO conservation gate in the parser (+ page re-parse + lossless page fallback + counted removals) and at every
  consumer (ingest, setup, drafts, picture text) (AS Q7, CS gates).
- A5 TODO assembly gate in the vision service (facts in both readings must be in the accepted page).
- A6 TODO figure identity binding (AS-04).

### B — Reading rules (P0)
- B0 TODO raw-output bank (transcript attempts + check answers keyed on inputs) + decision cache w/ AdjudicationRulesVersion
  + RenderRulesVersion + convention split (AUDIT-2 Q3).
- B1..B6 TODO alignment layer, check-answer model, text-layer authority, write-back, bounds, unsettled-only-digits,
  F-01..F-21 (AUDIT-2).

### C — Tables, cards, summaries (P0/P1) — AUDIT-1 P0-4..P0-10, P1-x; AUDIT-4 P0-2/3, P1-x.
### D — Consumers — AUDIT-5 CS-01..07, CX-02, CD-01/02, CS-09.
### E — Alerts + notices + admin — outcome-only per reading; new types; drop Required / per-page Outcome / layout-only;
  true provider sentences ×5; admin type lists (web + admin mobile); admin metadata `[]` fix in the API (JToken converter).
### F — Storage lifecycle for the raw bank (azureautomation storage.json L367-389 today: cool 50d, delete 180d).
### H — FINAL MULTIDIMENSIONAL AUDIT (owner, 2026-10-02) — after all code: read every changed line for bugs, missed
  scenarios, edge cases, degradation, best practice (no workaround/shortcut), memory/CPU leaks, thread safety; NOT a test
  run. Every finding fixed in this session.
### G — Proof: tests (unit + integration), real-data replay of the 4 NKN607 docs + MG Windsor, both-region scan,
  skills ×4, memory, PLAN register rows (sheets knowledge-document-row-truth, knowledge-reading-progress superseded on the bar).

## Log
- 2026-10-02 evening: U1, U2 done; U3/U4 applied, verifying. Audits 1–5 saved.
- 2026-10-02 night: A (parser) built — furniture marked never deleted (page numbers only, counted), figure tags on own
  lines before parsing, every table + text beside it, fences, R17 on ATX, per-line markup, conservation gate
  (KnowledgeContentConservation) + page-by-page rebuild + plain-text floor + `Conservation` report on the output.
  Real replay of the 4 NKN607 quotes: 0 amounts lost (c1home 43/43, was 0/43); gate silent on all 4 (no false alarm);
  sabotage (drop every `$` paragraph line) ⇒ gate caught it on c1home/c2home/c1auto, pages rebuilt, 0 still lost.
  1184 parser tests green (6 tests that pinned "delete repeated banners" rewritten to "kept on every page").
- 2026-10-02 late: E (part) built — ONE alert per reading: ReadingOutcomeReport (core) + ReadingOutcomeItems (classifier:
  ContentLost / ReadingRuleBroke / ValueOnlyOneReadingHas / ValueUnconfirmed / LineDropped / PricingWithheld /
  SavedPricingKept) + TranscriptionVerificationAlerts.PublishReadingOutcomeAsync; AdminAlertType
  KnowledgeReadingNeedsReview + ProviderSetupReadingNeedsReview (appended at the END of the enum); labels in web admin +
  admin mobile (+tests). Ingest sends it after the Ready commit; artefact banks Conservation (replay says the same).
  Notices (D-a): Info_KnowledgeValueUnconfirmed RETIRED; Info_KnowledgeContentNotSaved (knowledge rows) and
  Info_KnowledgeDraftPricesToCheck(+_One, count of shown suggestions) ×5 languages; API skips a notice it cannot word.
  TODO in E: setup + drafts send the per-reading report (planner D designing); remove per-check Required/Outcome/layout
  alerts (VDTS, drafts, setup).
- Tests added: ReadingOutcomeAlertsTests, KnowledgeContentConservationTests, KnowledgeReadingLossRegressionTests (41),
  ingest ContentTheReaderLost_* + AReplayedReading_*; notice tests rewritten. Sabotage runner over 22 guards running.
- Planner agents (read-only) running: B adjudication, C tables/cards/retrieval, D consumers.
- F DONE (ARM): azureautomation/storage.json — blob service lastAccessTimeTrackingPolicy on (daily, block blobs);
  ocr-page-cache-lifecycle-policy now by LAST USE: cool after 30 days unused (enableAutoTierToHotFromCool), delete after
  180 days unused (was: cool at 50 / delete at 180 days after WRITE, which cooled banks still in use); policy resource
  apiVersion 2023-05-01 + dependsOn the blob service. Same 180-day ceiling, never deletes a bank in use. No new
  parameter or deploy.ps1 key. TODO: deployment SKILL ×4 line 476, BusinessSearchDocumentService comment "after 180 days".
- D-b mockup DRAWN: Data/mockups/knowledge-tell-our-team (web + phone, all states) — registered in PLAN §0A + the index;
  AWAITING OWNER APPROVAL, nothing built (mockup gate).
- Queued after the sabotage run: edit-after-sabotage.js (priced-line rule only for non-pipe lines; markdown escapes
  shielded; stronger tests) and edit-assembly.js (AS-01 figure writers on own lines, AS-02 never inside a table, AS-05
  anchors: markup-free keys, occurrence rank, following-line fallback; F56 hyphen never joins a list/table/markup line).
- 2026-10-02 night: three read-only plans saved in plans/ — PLAN-B-adjudication.md (reading rules + raw bank, 10 steps),
  PLAN-C-tables-cards-retrieval.md (span rule, header check, aggregates, section scope, seats; 13 steps),
  PLAN-D-setup-and-drafts.md (setup gate, dispute index v2, per-reading report wiring; 12 steps). EXECUTION ORDER:
  B (steps 1-10) → D (1-10; UI after mockup) → C (1-12) → AS-04 picture identity → docs/skills/memory → H audit.
  Also done now: AdminAlertProcessor keys the two reading types by EventId (PLAN-D §0.5); ThirdNameUsed → item
  NameTakenFromCheck; bank pin refreshed at v1 (e18cd1419897f74d) for assembly-only changes — B raises to v2.
  Decision kept: the outcome EventId includes the reader build (a re-read under the same code and outcome stays one
  alert; PLAN-B 6.2 proposed the epoch, which would re-alert on every Read again).
- 2026-10-02 late: Phase B step 1 was READ for (VDTS, CMP, VER, rasterizer, Pdfium, blob paths, interfaces) but NOTHING
  was edited. Owner: stop new items; hand over; audit this session's code. Done for the handover: the three plans
  verified byte-identical to the planners' reports; the "Tell our team" sheet deleted + both register rows marked
  rejected; `NEXT-SESSION-PROMPT.md` + `RAW-FILES.md` written; evidence tools re-arranged into buildable folders
  (`evidence\tools\{cb,cq,scan,replay,replay-at-discovery}`). Found: `Clinqet.API` and
  `Clinqet.Communications.IntegrationTests` were never compiled after this session's edits — the audit compiles both.
- 2026-10-02 late: HANDOVER AUDIT STARTED (multidimensional, code reading; findings and fixes are logged below).
  Eight read-only reviewers (parser line states; conservation gate + tables; assembly + chunker + §0.23; alerts + ingest;
  notices + drafts + API; partner web; partner mobile; admin + ARM) + one completeness cross-check of every audit id.
  Per the owner: NO test runs in this audit — fixes are compiled only; their new tests run in the next session's first
  suite run. Findings fixed so far:
  - AUD-1 (parser, from PLAN-C additional defect 2): `PairLabelValueRuns` / `CoalesceValueLineRuns` appended a run's
    banners after the WHOLE run, so a page-1 footer followed page-2 rows and the card it joined cited the wrong page. Fix:
    `RunBanners` + `AddRunWithBanners` put each banner back before the first run block of the page after it. Tests:
    `ABannerInsideAPairedPriceList_StaysBetweenItsPages`, `ABannerInsideOneLinePrices_StaysBetweenItsPages`.
  - AUD-2 (chunker, regression of "furniture kept on every page"): every page's running header/footer reached the cards —
    the same words in every card, and a footer opening a card labelled it a page early (the mislabel the business-search
    SKILL §28.4 recorded as closed by stripping furniture). Fix: the reading keeps every copy; the chunker carries each
    distinct furniture text once (`furnitureSeen`). Test: `ARunningFooterOnEveryPage_IsCarriedByOneCard`.
  - AUD-3 (API): `ResolveReadingNotice` returned `string?` into `List<string>` (CS8620). Fix: `.OfType<string>()`. Test:
    `KnowledgeControllerTests.ListKnowledge_ANoticeNoLanguageFileWords_IsNeverShownAsItsKey`.
  - Compiled: `Clinqet.API` and `Clinqet.Communications.IntegrationTests` — 0 errors (they had never been compiled after
    this session's edits).
  ‼️ AUDIT FINDINGS REGISTER (all reviewers back 2026-10-02 ~23:40; owner of each fix in brackets; [S] = this session
  itself, [AW] web agent, [AM] mobile agent, [AN] notices agent, [NEXT] routed to the next session with a home):
  - Parser/gate [S]: P1 worded page numbers + "Tel:" letterhead neither removed nor marked, EdgeBand stops at value lines
    (HIGH, regression); P2 kept banners split a sentence carried across a page; P3 SameColumnKinds rejects "Included"/"$"
    continuations; P4 a repeated label over a short price is marked furniture; P5 control chars deleted not spaced; P6 a
    literal page-break comment inside a typed fence closes it; P7 typed fence-opener text recorded removed; P8 figure tags
    inside HTML cells split the table; P9 DI footer rule has no cross-page check; P10 figure words/stray `</figure>` in price
    runs; P11 timeouts all-or-nothing + quadratic bits; P12 comments, TextBreakingTags mutable. C1 dropped link/anchor/title
    text never recorded removed ⇒ FALSE LOSS + plain-text page + High alert (HIGH); C2 the rebuild re-parses EVERY page alone
    and strips cross-page structure from pages that lost nothing (HIGH); C3 figure words counted twice (hides losses); C4
    autolinks dropped by parser and gate; C5 `<12 … >` read as a tag; C6 pairing removals recorded though rows discarded; C7
    shield range collides with icon-font private-use characters; C9 plain fallback flattens HTML tables; C10 quadratic scans;
    C11 shielded image address, ``` spacing, Split vs line-loop page breaks, timeout fallback; C12 partial CommonMark escapes,
    setext headings uncleaned; report pages with loss.
  - Chunker/assembly [S]: S1 caption rule one-sided ⇒ priced line / logo words duplicated as a table caption (HIGH); S3 F56
    dead clauses + no test; S4 following-line fallback picks the first copy, containment occurrence mismatch; S5 per-figure
    page-sized work; S6 AnyTag regex has no timeout; S7 silent PrepareStructure fallback.
  - Alerts/ingest [S]: AL1 no size bound ⇒ Service Bus drops a big outcome alert, incl. content lost (HIGH); AL3 sent at most
    once — a failure after the commit loses it; AL4 unchecked pages give noisy false "published ''" items; AL5 importance
    order; AL6 EventId digest lacks readings/counts, replay re-sends; AL7 tests (+ processor integration case §0.8); AL8
    comments/skills; picture-text pass drops its Conservation (A4); duplicate upload erases the survivor's notices.
  - Notices [AN]: N1 stale DraftPricesToCheck never removed (HIGH); N2 stale after approve/dismiss; N3 count by name; N4 API
    `_One` fallback; N5 singular guard; N6 copy (en grammar, fr wording); N7 admin onboarding step crashes on a notice
    object (pre-existing); N8 comments + vacuous test.
  - Web [AW] / mobile [AM]: spec `UI-FIX-SPEC.md` (scratch) — no-receptionist says nothing about callers; quiet delete body,
    view-only hint, "Chosen to send"; read-only members never told to act; replacement sentence; singulars; web focus trap,
    focus after delete, late errors, landscape, busy label; mobile hung Android delete, stale error, screen reader, count
    resync, collapsable; tests both apps.
  - Routed [NEXT] (deploy gates and owner decisions in NEXT-SESSION-PROMPT §7.2/§5.9): per-check alerts still fire until
    PLAN-B 9 / PLAN-D 6b (do not deploy alone); API before or with Functions (Newtonsoft enum read); O-1 `[]` details must ship
    with the outcome alert; §0.23 assembled-output banks (stitched pages, picture text) stale under v1 — owner picks
    `PageAssemblyRulesVersion` vs the v2 raise; F59 page-qualifying banner per page; G3/G4 runtime checks; AS-12 page count;
    AS-15 describe call re-bought per deploy; the cross-check's other "no home" items.
  - Alerts/ingest [S] FIXED 2026-10-03:
    - AL1 size: readings cut to `MaxDiscrepancyExcerptCharacters`; at most `MaxDiscrepanciesPerVerification` items in the
      text and the details; halved until the body is <= 192 KB (Service Bus Standard refuses > 256 KB, permanently). The
      report carries the reading's own `VisionTranscriptionSettings`, so no new setting.
    - AL3: publish right after the committed-row check, before the analytics ticket. Built inside the guarded send. The
      Ready exit re-tells it from the banked reading (`RetellReadingOutcomeAsync`, `TryReadForAnalyticsAsync`).
    - AL4: past the check limit, only a number or a whole missing/added line counts (`ValueNotChecked`, "not checked").
      An AI-only value the check did not confirm reads "only one reading has", even after `ResolvedToCandidateReading`.
    - AL5: items ordered by importance.
    - AL6: the id hashes every reading and every loss count/sample, sorted; replays send nothing.
    - AL7: `ReadingOutcomeAlertsTests` rewritten (+13 cases). Ingest: replay sends nothing, Ready exit re-tells, nothing
      banked tells nothing, nothing sent for a tombstone race or a continuation. `AdminAlertProcessorIntegrationTests
      .ReadingOutcome_FromTheRealProducer_PersistsOncePerReading` for both types.
    - AL8: comments and skills fixed (function-app, ai-assistant: the replay function it named never existed).
    - Also: `PagesWithLoss` named in the text; A4 picture-text loss carried (`KnowledgeReadingConservation.Combine`, once
      per picture, parse cached per picture+page, `SampleSize` moved onto the record); a duplicate upload keeps the
      survivor's notices; the dead `DuplicateUpload_TellsTheProviderOnTheSurvivingRow` (no [Fact], old field) made real.
    - §0.23: page-reading pin re-pinned `(1, "63413934ab1df3d2")`, pin-only. Script-replicated: the other two pins reproduce
      exactly. What a page decides did not change; the assembly question is owner decision §7.2.
  - Notices [AN] DONE N1-N8 (agent report verified by reading the approval diff). Web [AW] and mobile [AM] DONE A1-A7,
    B1-B5 / C1-C6, plus follow-ups: focus after deleting the last picture goes to the document name; es/fr agreement in
    noneAllAside*; noneMixed counts of 1 (web ICU, mobile split keys `…_MIXED_ASIDE`/`…_MIXED_ALREADY`); hi "पंक्तियों में
    से"; gu "કૉલરને". Before-copies: scratchpad `notices-before`, `web-before`, `mobile-before`.
  - Compiled, 0 errors: Clinqet.Communications, .UnitTests, .IntegrationTests, Clinqet.API.UnitTests, .IntegrationTests,
    Clinqet.Mcp.UnitTests. Partner web ESLint 0/0, partner mobile tsc + ESLint 0 errors, admin web ESLint 0/0. NO TESTS RUN.
  - Docs: skills ×4 (function-app, ai-assistant, partner-app, provider-mobile, voice-assistant incl. the lifecycle line);
    REGISTER.md row for the removed moving bar; NEXT-SESSION-PROMPT §0.2 pin, §4.2/§4.3/§4.5 corrected, §5.4b homes for
    every "no home" item, §5.9 deploy gates, §7.2 new owner decisions.
- HANDOVER AUDIT CLOSED 2026-10-03. Every finding is fixed or has a named home in NEXT-SESSION-PROMPT §5.4b / §5.9 / §7.2.
  The next session runs every affected suite FIRST (§4.5).

## NEW SESSION (2026-10-03) — build log
- Owner decisions this session (2026-10-03): PLAN-D D1, D2, D3, D5, D6 all YES ("no options… doing everything"; the fix must
  work for EVERY document type — Word, Excel, PDF, text, scans, any language/layout). PLAN-C §F: the blob-only flag
  `KnowledgeBlock.ContinuesPreviousPage` (option A, best practice; no backfill — the owner re-creates sandbox data).
  AS-16 caption fix rides the single 1→2 raise; NO span data stored on saved tables (the read-time span rule gives correct
  labels). No backfill concerns anywhere: sandbox data can be deleted and re-uploaded.
- PLAN-B step 1 DONE except the convention split (BankRulesVersionConventionTests is audit-owned until HANDOVER AUDIT CLOSED):
  - PDFium: `PdfiumDocument.ReadPageText` (exactly the render's text) + `ReadTexts(page, regions)` (one page load, one text page,
    bounded text per displayed-frame region, `Covered` = a picture (recursing into form XObjects through their matrices), a
    visible annotation that can show characters (form field, stamp, free text, ink…) or a page past 100,000 objects).
    `PdfiumNative`: page-object, form-object and annotation imports (`CULong` for C `unsigned long`).
  - `IDocumentPageRasterizer.ReadPageTextAsync` / `ReadTextInRegionsAsync`; core `PageRegionText(Text, Covered)` +
    `Undeclared` (raster, invisible overlay, unreadable file, page past the end).
  - `VisionPageTranscription.RawContent` + `Usage` (core `AiTokenUsage`), `DocumentVerification.RawContent`.
  - `Reading/RawTranscript.cs` (Post = trim → NO_TEXT → StripCodeFence → Sanitize; moved out of VisionPageTranscriber).
  - `KnowledgeBlobPaths.OcrRawPrefix` / `OcrRawTranscriptBlob` / `OcrRawCheckAnswerBlob` / `OcrRawCheckCallBlob` (key prefix 20).
  - `RenderRulesVersion = 1`; `PageCachePolicy` = `{fp}:v{Adj}:r{Render}`; stale module-id comments removed (VDTS,
    VisionTranscriptionSettings). Picture-text bank key moved with it (pin updated in KnowledgePictureDescriptionBankTests).
  - Pure moves: `Oversize/SectionCompositions.cs` (LayoutWindows, WholePagePlan, WholePage, MachineComposition,
    ModelComposition, GeometryKey); `Reading/ReadingPrompts.cs` (Grounded, Reference, WithoutBoxMarks); `Reading/PageScripts.cs`.
  - Tests: DocumentPageRasterizerTests +9 (text equality with a drawn page incl. invisible overlay; regions; rotated page;
    picture / picture-in-form / form field / hidden annotation cover; unreadable files), KnowledgePdfFixture.BuildWithPlacedText,
    VisionPageTranscriberTests raw+usage theory, DocumentTranscriptionVerifierTests raw answer, policy-shape tests rewritten
    (APageBankedUnderAnotherRulesVersion_IsAMiss). Sabotaged: Covered always false → 4 fail; form matrix ignored → 1 fails.
  - Knowledge+Conventions suites: 3311/3315; the 4: ThePageReadingRules_AreVersioned (expected, pin after audit),
    TheKey_IsTheSameOnEveryBuild (fixed: pin moved as planned), and two PARSER tests in audit-owned files
    (LayoutMarkdown_StripsPageFurniture, ABannerOnEveryPage_IsKeptOnEveryPage_AndNeverEatsTheNextLine) — the running audit's
    in-progress parser edits, not this session's code.
  ‼️ For the session that started PLAN-B step 1 at ~00:47 (it edits VDTS, rasterizer, verifier, Pdfium, OversizePageReader,
  VisionPageTranscriber; new `Reading/` + `SectionCompositions.cs`): the audit never touched those files. The pin
  `(1, "63413934ab1df3d2")` was computed WITH your in-progress edits present, so re-pin when your step ends. The audit's
  last edits there: `PageMarkdownSplicer.cs`, `SectionStitcher.cs` and `KnowledgeText.cs` (all earlier, before 00:47).
- 2026-10-03 (new session) FIRST-RUN of every affected suite after the audit (which ran none): Functions unit 8,937/8,940
  (the 3: the stale v1 pin, and two PARSER regressions from the audit's untested P0-7/P4 edits), Functions integration
  896/896, API unit 15,715/15,715, API integration 2,528 passed / 18 skipped, partner web jest 6,109/6,109 + ESLint 0
  errors, partner mobile jest 7,644/7,645 + tsc + ESLint 0 errors, admin web 1,099/1,099, admin mobile 551/551.
  Fixed: (1) `LabelsTheValueBelow` read `<table>…$25…</table>` written on one line as ONE bare price, so a banner over an
  HTML table was never furniture — a tag line is structure now; (2) `LayoutMarkdown_StripsPageFurniture` rewritten to the
  audit's deliberate rule (a one-page "Page 1 of 9" footer is kept; only the PageNumber role goes); (3) mobile
  `knowledgeImagesParity.test.ts`: `/s+/g` (lost backslash — the node -e trap) and an unescaped `(node)` regex group.
  NOT ours: `Clinqet.Mcp.UnitTests` does not compile — `SwapCopyOnlyAttribute` (search-topology Phase 5, commit cc71364)
  is defined nowhere; spun off as a separate task.
- PLAN-B step 2 DONE (raw bank wired, v1 rules): `IAzureStorageService.TryDownloadDerivativeBlobAsync` (ONE request,
  404 = miss; defect 10) used by the decision bank and the raw bank; `Reading/PageReadingRawKeys` (recipe + model +
  SHA(system␀user) + attempt; attempt 2 keyed on the re-ask WORDING via a steering mark), `Reading/PageReadingRawBank`
  (Completed/NoText trusted across readings, Truncated/Unusable only by their own reading, transient never banked,
  ForceFresh rules); `CachedPage` gains `Inputs` (machine page | scope | turns), `Published` (Transcript/MachineReading/
  Blank; Markdown ALWAYS the published text — F-28) and `ChecksBought`; progress counts answers banked before a budget
  cut (`ReadingTally.UndecidedAnswers`). DESIGN DECISION: pages are still drawn before the raw lookup (drawing is free,
  a document-session refactor is not worth it — simplest correct); `ReadPageTextAsync` therefore has no caller yet
  (decide at step 6 whether it earns its place or is removed). Check answers get banked per QUESTION in step 5.
- Convention split DONE: `ThePageRenderRules_AreVersioned` (1, "55b22be3a995ce0e") + `ThePageReadingRules_AreVersioned`
  (1, "04d61e8bd2d5f7cd"; KnowledgeFigures now pinned — the comparer already used it), `NoFileIsPinnedByTwoVersions`,
  `EveryReadingAndSectionFile_IsPinnedByOneVersion`. DECISION (§7.2 assembly question): NO separate assembly version —
  with the raw bank a reading-version raise re-decides from answers already bought, so assembly stays under it.
- Tests: `PageReadingRawBankTests` (+9), `Helpers/PageBankEntries`, InMemoryDerivativeBlobs gains the one-read path;
  bank-shape tests rewritten. Reading suites 3,396/3,396 green.
- LOCAL REAL-DATA HARNESS (scratchpad, never a repo): runs the REAL pipeline with the CA sandbox models (settings read at
  runtime from Functions appsettings + local.settings.ca.json; no key printed) on the four sample PDFs with production's
  banked DI readings, and a local folder as the bank. All four read: 17 pages, raw answers banked locally — every later
  rules run replays them free. Live repro of F-02: c1auto p2 raw AI header was RIGHT ("Operator / Coverages | Limit/Ded. |
  Principal | TOTALS", "# Breakdown" heading); v1 rules overwrote it with "Breakdown | Operator | Principal | TOTALS".
- Sheet `knowledge-wrong-answers-report` DRAWN + registered (REGISTER.md, PLAN §0A), awaiting owner approval; wording
  refined at the owner's request: "Report wrong answers" → "Reported. We'll check this file." (W1).
- PLAN-B step 3/4 primitives BUILT (not wired yet; `Reading/`): `PageTokens` (ONE tokenizer: amounts joined across spaces
  — `Rs. 500`, `$ 25`, `500 INR`, `5 %`; ®™©℠ trimmed; unspaced scripts one token per grapheme in its own place;
  `SamePrint` = same letters + same figures in order, so `G -T4`=`G-T4` but `25 60`≠`2560`), `PageStructure` (HTML grids
  with rowspan/colspan anchors + covered positions; pipe tables with exact cell spans; DI furniture comments tokenized
  from the VALUE only; decoration = a column with nothing of its own below the header — never one covered from its LEFT,
  never a single body row), `TokenLedger`, `PageDifference` (+`CaptionLost`, `PageInsertMode`), `PageAligner`:
  tables pair in order, k:l (two DI tables the AI read as one); rows k:l (≤8 pairs); 1:1 rows by cell DP (two passes,
  the second steered by the column-map vote); multi-row groups by NUMBER LABELS; a table pair whose numbers mostly do
  not line up is unpaired and goes to the page pass; the page pass = greedy string tiling (min 3) + gap LCS + numbers
  paired by LABEL + counted word pairing + echo rule. NUMBER LABEL (the heart): field = own-cell words, else the label
  printed under it in a form, else the row's label for a value|label pair, else column heading; record rows add their row
  label; in prose the words of its own sentence since the previous number. Two labels agree only when one is WHOLLY inside
  the other (a shared word is not enough). Bugs found by the real quotes and fixed: a header rowspan shifted every later
  HTML row down one (grid indexed by its length); a one-body-row table made every column "decoration".
- REAL-DATA PROOF of the aligner (scratch probe `bughunt`, InternalsVisibleTo already in the csproj): the four quotes'
  banked AI readings (17 pages) → only genuine differences remain: lone labels the AI skipped ("MSG", "Rates"), the side
  label "Totals" as a caption, "Feril"/"Fel", and two "Base" values only the AI read. Every form layout (turned on its side,
  wrapped into fewer columns, value above label) is layout. On the LIVE (v1-decided) readings it flags exactly the known
  defects: the invented "Inc." (F-03), the added "0" under PRIN. (F-04) and the v1-corrupted header on c1auto p2 (F-02).
  Tests: `PageAlignerTests` (25), `PageStructureTests` (7), `PageTokensTests` (18).
- 2026-10-03 PLAN-B steps 4–10 BUILT (one session, uncommitted; `AdjudicationRulesVersion` = 2, `RenderRulesVersion` = 1):
  - `Reading/`: `PageAmounts` (strict currency identity `PageCurrency(Mark, Code)`, sign/comparison qualifiers, separator roles with
    Western/Indian grouping validation, the lone-zero decimal rule, the 24h clock rule, case-kept units, rates by unit name),
    `PageTokens` (one tokenizer; amounts joined across spaces; tick marks ✓✔☑✅☒ as `Mark` tokens in table cells only),
    `PageStructure`, `PageDifference` (`ValueCell`, `MarksOnly`, `TicksUnread`), `PageAligner` (Opposite confined to one AI unit,
    word rule for all-1:1 tables, swap fast path + `Traded`→Moved, figure lines matched apart — AS-03), `PageRuling` with
    `CheckState {Free, Asked, PastBound, NoHandle}`, `PageDecision` (two phases; allocation money→digits→others within
    `MaxVerifiedPagesPerDocument − ChecksSpent`), `CheckQuestions` (cell questions, `LineHandle`), `CheckAnswers` (`Shares()` rule
    for unit answers), `TextLayerAuthority.Settle`, `PageWriteBack`, `PageConservationAudit`.
  - Dispositions added: `SourcePlaceRetained`; outcome kinds `ValueMoved`, `ReadingRuleBroke`, `ValueNotChecked`, `ValueOnlyOneReadingHas`.
  - `CarryFigures` writes `<figure data-words="…">` with only the uncarried lines; the parser reads `data-words` as neighbour text only.
  - Consumers (F-23): drafts read the ingest's banked DI read with the ingest's key (`KnowledgeDocumentFormats.ReadKey`), pass page
    angles; webp/gif whole reads banked. `VerificationsSpent`/`VerificationsAlreadySpent` deleted end to end. VDTS per-check alerts gone
    (only McpService ~L1477 and the drafts job ~L970 still call `PublishAsync` — PLAN-D steps 3/6 remove them).
  - Deleted: `DocumentTranscriptComparer`, `DocumentValueEquivalence` and their tests. Real quotes: 12 genuine differences remain.
- 2026-10-03 PLAN-D step 1 BUILT — the setup reader carries every fact the reading decided:
  - `ProviderSetupDocumentContent` is a record: `ContentHash` (SHA-256 of the upload, every route, refusals too), `TextNotCarried`
    (Gate 2); its duplicate `Reviews`/`PagesReadInPart` moved onto `Extraction` (one place, as in the ingest).
  - `ReadAsync(..., DateTimeOffset stopBy, ct)`: McpService passes `now + ProcessingTimeoutSeconds` (the controller's own dial).
  - Every route returns `parsed.WithReading(vision) with {…}` — `VisionReadingFacts.WithReading` is now the ONE list of reading facts
    (the ingest's five hand-listed copies use it too). Conservation and UnpairedPriceLines reach setup (CX-01, CS-04 root cause).
  - `VisionDocumentTranscription.PagesKeptMachineReading` / `KnowledgeExtractionOutput.VisionPagesKeptMachineReading` (in memory):
    every page on a budget cut or a refusal, else each blank/failed page and each long page whose section reading failed.
  - Setup bank keyed on the BYTES: `KnowledgeBlobPaths.OcrSetupDocumentKey = "setup"` (`OcrDocumentKey(fileName)` deleted — defect 7);
    the setup DI read is banked at `_ocr/{biz}/setup/{hash}/di.json.gz` (`IKnowledgeExtractionCache.TryReadSetupAsync/WriteSetupAsync`,
    setup container, lifecycle + closure sweep already cover `_ocr/`). The cache now reads with ONE request (defect 10).
  - VDTS admin alert texts name the provider's file (`FileName`) instead of a storage key.
  - `FlattenBlocks`: headings written as markdown `#` (defect 8 — the chunk splitter's heading rule now fires); a column heading
    no row fills is written on its own line (it was lost). Gate 2 `NotCarried` = `KnowledgeFigures.MissingFrom(block text, flattened)`.
  - Tests: API `ProviderSetupDocumentReaderTests` +14 (real parser: CX-01 Able shape, page-1 logo marker, CX-02 continuation, value-first
    count, P2 same line under two headings; facts, deadline + angles, bytes key, DI bank hit/miss, hash on every route, Gate 2),
    `KnowledgeExtractionCacheSetupTests` (3, API host = the consumer); Functions VDTS kept-page assertions on 7 fallback tests + the
    file-named alert. Reading pin re-pinned (2, "f44a8022a2db0b09") — no decision changed.
- 2026-10-03 PLAN-D steps 2–4 BUILT (uncommitted):
  - Step 2 (contracts): `TranscriptionVerificationDiscrepancy.AmountsAtStake` (blob-only: page bank + artefact; computed by
    `PageDecision.AtStake` from the WHOLE difference, count-aware, currency identity via `PageTokens.Same`, never from the excerpt);
    `TranscriptionDisputeIndex.PricingAt(page, amounts, unitWords)` binds a dispute to a PLACE (row label ⊆ unit, or ≥ half the readings'
    words in the unit, or a wordless entry on the same page) — never by the extractor's name; `TranscriptionDispute.Original/PageNumber`;
    `ReadingConsumerItem` + `ReadingConsumerItemKind` (11 kinds incl. `PriceFromLostLayout`), `ReadingOutcomeReport.ConsumerItems`;
    `ReadingOutcomeReviews.Apply` (replace by identity, strongest outcome per service); alert lines/counts/metadata/digest for consumer items;
    `TextNotCarried` always sends (a loss). PLAN-D's `PageWide` is NOT built: the new reading has no page-wide comparison failure (every
    difference has its own place) — recorded as superseded. Reading pin (2, "62fd01ffceb39026").
  - Step 3 (Gate 3): `ProviderSetupServiceGate` (API-registered) cuts units with the drafts' `KnowledgeServiceCandidateDetector.Units`
    (new: every unit, priced or not, `IsTableRow`); a marked unit counts only its marks, an unmarked one every figure; magnitude words
    (k/lakh/L/crore/cr/million/लाख/લાખ/करोड़/કરોડ); name cover ≥ `AnchorNameTokenOverlap` (new setting 0.60, API) with plural tolerance and
    split/joined words, section words + D10 lead-in; one slot per (unit, amount); states Evidenced/Disputed/NotInFile/FromUnpairedLines/
    FromQuickReading/FromLostLayout/FromPictureOnly. McpService: pre-pass (dedupe, category pair, live-service match) → gate → D1 check →
    pricing decision; `ProviderSetupPricingOutcomes` ledger; ONE `PublishReadingOutcomeAsync` in every terminal branch and after an
    extractor failure (`PublishSetupVerificationOutcomeAsync` deleted); CS-05 ceiling judged after the business currency is known (the
    extractor's schema has no currency, so the DI mapping's flag stays a currency-less default both consumers overwrite — PLAN-D defect 3
    was moot); `MaxAllowedPrice` now in API appsettings; summary metadata (all branches): savedPriceKept*, pricesWithoutNamesCount,
    readingNotFinished(+PriceCount), notOffering*, highPrice*, contentNotSaved, pagesReadInPart. D5: `NameIsAuthoritative` — only a
    manifest renames a live service.
  - Step 4 (D1): `KnowledgeOfferingJudgeRun` (caller's model/effort/batch/attempts/concurrency/lane/sub-flow; the prompt stays the
    judge's one definition); drafts pass their own dials; setup `ProviderAttachmentProcessing:OfferingJudge` (class default = appsettings)
    on `AiSubFlows.SetupOfferingJudge` ("D5-setup-offering-judge"), Interactive lane; `IKnowledgeOfferingJudge` registered in the API;
    `KnowledgeOfferingJudge.SelectedCategoryLines` shared (the drafts job's private copy deleted).
  - Tests: API gate 34, McpService 104 (fixture prints the extraction as a table so the REAL gate runs), writer D5 ×2; Functions index
    +9, PageDecision +7, alerts +6, Apply 5, judge run 1. Sabotage: gate wiring off in McpService → 9 fail.
- 2026-10-03 PLAN-D steps 5, 6, 6b, 8, 9, 10 BUILT (uncommitted):
  - Step 5 (CS-01 consumer): `ProviderSetupFactChecks` withholds the business phone (digit run), address (letters+digits run), each
    day's hours (times the readings print differently), an offer's discount (place-bound `PricingAt`) and a service's duration (its
    price unit) when the readings disagree on them; `FactWithheld` consumer items; a withheld offer counts in `offerSkippedCount`.
    `TranscriptionDisputeIndex.DigitsDisputed/TextDisputed/TimeDisputed/TimesIn` (≥3 digits; a words-only disagreement never disputes).
  - Step 6 (drafts): builder `PricingIsUnconfirmed(candidate, price, maxPrice)` (row-bound, the price the draft would carry),
    `PagesToCheck`/`CheckEveryPage` → NeedsReview; job binds disputes through the candidate row (`CandidateWords`), ONE
    `PublishReadingOutcomeAsync` per run (also on the zero-candidate / zero-survivor returns; keepUnconsumed false, own parse's
    conservation only); the separate `KnowledgeDraftPriceDisagreement` alert folded in as `PriceReadDifferently` (always sent, as
    the owner required of it); re-read flow label `ServiceDraftExtraction`. KEPT the existing deliberate rule that a withheld price
    is NOT a "price to check" (there is none to check) — PLAN-D's suggestion to count it was not adopted.
  - Step 6b: the per-check alert is gone end to end — `ITranscriptionVerificationAlerts.PublishAsync`, Build/Severity/Summary/
    Describe/Line/Follow/Attempts, `TranscriptionVerificationEvent`, `TranscriptionVerificationInvocation`,
    `TranscriptionVerificationPhase`; records file renamed `TranscriptionVerificationDiscrepancy.cs`; `TranscriptionVerificationAlertsTests`
    deleted. `AdminAlertType.DocumentTranscriptionVerification` + the processor branch stay for stored alerts. Deploy gate 1 met.
  - Step 8 (D3): `ProviderAttachmentProcessing:MaxReadingPasses` (2): a pass that ran out of time carries on while it banks something
    new and the request deadline (minus the pipeline reserve) leaves reading time.
  - Step 9 (CD-01): `KnowledgeExtractionOutput.ReadingMarkdown` (set by `WithReading`) → `KnowledgeContentArtifact.Markdown`
    (blob; dropped — never the artefact — when it alone breaks the size cap); `KnowledgePipeline.Fingerprint` shared by ingest +
    drafts; a stale artefact is re-parsed from its saved reading (free), a born-digital one from the file (free), else its blocks
    are used and every suggestion is marked to check + `ReadByAnOlderReader` item. Never paid AI.
  - Step 10 (CX-03): setup reuses a Ready knowledge document's reading of the same bytes (rendered files only; only an artefact
    with a saved reading, not degraded, no unreadable pages) — its blocks, reviews, conservation, unpaired count and stored
    pictures (by marker index, setup's own cap); `ProviderSetupDocumentContent.ReusedKnowledgeDocId`; setup's report then lists
    only what setup did (keepUnconsumed false, no conservation).
  - D6 SUPERSEDED: no reading file uses `KnowledgeChunker` any more (the comparer that did is deleted); the reading's shared helpers
    (`KnowledgePriceMarks`, `KnowledgeFigures`, `KnowledgeText`) are pinned. `DocumentPageAngles` needs no pin: the angle VALUE is
    in every banked entry's Inputs, so a change misses by itself.
- 2026-10-03 PLAN-D closed out:
  - Money-path integration suite `Clinqet.API.IntegrationTests/Services/ProviderSetupReadingConservationIntegrationTests.cs`
    S-1..S-6 GREEN (real reader/parser/gate/writer + real reading-outcome alert read off the admin-alert queue; real Cosmos +
    Azurite; DI/vision/extractor/judge scripted). The factory's alert store is in-memory, so alerts are asserted as the message
    the API SENDS (the honest boundary). Sabotage: `PriceConfirmed => true` fails S-1/S-2/S-5; disabling CX-03 reuse fails S-6.
  - Drafts integration (Functions) `KnowledgeServiceDraftAnalyticsJobIntegrationTests`: `ADisputedPrice_IsStoredWithoutAPrice_
    OnTheRealDraftRow`, `AnArtefactFromAnOlderReader_IsParsedAgainFromItsSavedReading_OnTheRealRows`,
    `AnOldArtefactWithoutItsReading_MarksEverySuggestionToCheck_OnTheRealRows` GREEN.
  - FOUND + FIXED: `KnowledgeOcrPageCacheIntegrationTests` still used the deleted `KnowledgeBlobPaths.OcrDocumentKey` (the
    Functions integration project had not been compiled since step 1) → setup banks by bytes (`OcrSetupDocumentKey`).
  - FOUND + FIXED (real defect): `PageReadingRawBank.EntryFor` banked a "finished" answer even when it held nothing replayable
    (RawContent null) — trusted by every later reading, it would replay as an UNREADABLE page for ever. Now an answer is banked only
    when replaying the entry gives back the very page; test `AnAnswerThatWouldNotReplayAsTheSamePage_IsNeverBanked`; two fakes made
    faithful (RawContent). Reading pin updated ONLY (2, "6c89b8f12520d78e") — no decision changed.
  - FOUND + FIXED: `AiSubFlows.SetupOfferingJudge` had no budget dial (`AiBudgetCutoffAlerts.BudgetDialBySubFlow`) — added.
  - UI step 11 DONE: sheet `Data/mockups/ai-setup-reading-honesty` drawn + registered (PLAN §0A + REGISTER.md; owner approved
    the rows 2026-10-03). Web `SetupReadingNotices.jsx` + test (real catalogues ×5); phone `SetupReadingNotices.tsx` + test (real
    i18next ×5, light + dark). Both modals share `MAX_VISIBLE_SUMMARY_NAMES`. Keys ×5 per app. ESLint 0 errors both apps.
    "Reading did not finish" also shows with NO price held back (asks for a look at the details) — drawn on the sheet.
  - knowledge-wrong-answers-report register rows → OWNER APPROVED 2026-10-03, wording W1.
- 2026-10-03 PLAN-C steps 1–3 DONE (CUT 3,320 green):
  - 1: `KnowledgeDocumentParser.CellText` (CSV cells + JSON scalars: markup → words, entities decoded, one line) + chunker
    `SerializeRow` one-line rule. Tests `KnowledgeCellTextTests` (incl. the markup sweep over html/csv/json/layout/md fixtures).
  - 2: `IsValueOnlyLine` — a word BEFORE the number is a name unless it names the money (code/alias/symbol); currency words exempt
    from the unit-length cap. Self-contained runs are never paired. Direction from the whole run: pairs made downward must outnumber
    the prices a following name could claim upward (a sentence, an over-long line or a lowercase name-tail in a cased run is never a
    name); lowercase line after a priced row followed by a price heads its own record. PowerPoint names box whose lines carry prices
    is never zipped. Tests `KnowledgePriceRunDirectionTests` + `Pptx_ANamesBoxWhoseLinesCarryTheirPrices_IsNotZipped`.
  - 3: `IsPipeTableStart(header, delimiter, afterDelimiter)` (a miscounted/carried delimiter or a setext underline declares the
    header when the next row has its width); undeclared pipe rows (2+ cells, fenced or 3+ cells) read as a table; P1-5 NARROWED from
    the plan: on a rendered page ONE row of words under the header declares nothing (Kathiria: First Name) — a row carrying figures
    keeps its header (the plan's blanket one-body-row rule broke a 3-page menu repeating its header over one row per page and S-09).
    Tests `KnowledgePipeTableTests`; banner test's header assertion updated for P1-5.
- 2026-10-03 PLAN-C steps 4a/4b/5 DONE (CUT 3,344 green; API unit 15,803 green after 4b):
  - NEW `KnowledgeDocumentParser.TableGrid.cs` — ONE span rule for HTML, Word, PowerPoint and Excel (`BuildTable` over
    `TableSourceRow`/`TableSourceCell`): S1 header block (declared sub-header rows compose "Parent (Sub)"; a span counts once; a
    header cell running into the body labels nothing → caption, or a band in column 0), S2 (a spanning text band stands at column 0),
    S3 side label (column 0 of cells spanning 2+ rows under no label of its own — empty/absent/spanning header cell, or no header —
    becomes band rows; the header realigns), S4 horizontal body span once, S5 vertical span repeats for values/short text (and column 0
    under a labelled header), long text once.
  - DEVIATIONS from the plan (both proven necessary by existing tests/behaviour): (1) NO column is ever dropped — cross-page header
    inheritance needs equal widths; instead a body-empty column loses a label COPIED from another column (no "TOTALS (2)"). (2) A
    header label spanning several columns names each only where a sub-label beneath tells them apart; alone it stays on its first
    column (never "Price (2)", which reads as "price for two").
  - Readers: HTML (`ReadHtmlTable`), Word (vMerge → row span by look-ahead; gridBefore as a leading empty cell), PowerPoint (hMerge
    placeholders consumed by the span; vMerge placeholders → row span), Excel (merges kept as spans and applied per region through
    `RegionSourceRows`, hidden columns respected, a merge begun above a region anchors at its first row inside it; leading-empty-column
    margin rule kept as `WithoutEmptyLeadingColumns`; label inheritance unchanged). Deleted: `CollapseFullWidthSectionRows`,
    `IsOnlyContentInRow`, `DropEmptyLeadingColumns`, `DeclaredHeaderRowIndex`.
  - Chunker floor: `UnlabelRowsWiderThanTheHeader` — a row wider than its header keeps labels only when fitting rows exist and its
    leading cells hold the same kinds; `PlanTableForInventory` exposes `Unlabelled`; inventory leaves such rows out of column stats;
    the draft/setup detector reads them without labels.
  - Step 5: `LooksLikeAHeader` (label row + no "label: value" cell + a value cell only as a unit band or over a column of values) for
    the grid builder, pipe tables and CSV; `FindHeader` treats an all-spanning row as a title bar (caption, even when nothing is
    declared) unless it is group labels over a declared sub-header row; `TitleCaption` joins a title bar's distinct values.
  - Tests: `KnowledgeTableSpanRuleTests` (14; sabotage of S3/S4 fails 5), `KnowledgeHeaderRuleTests` (7), Word/PowerPoint span tests (3);
    rewritten per plan: `Html_Table_WritesAColspanValueOnce`, `Xlsx_AHorizontalMergeBesideOtherData_IsWrittenOnce`,
    `Xlsx_AMergeDownTheFirstColumn_IsABandOverItsRows`; X03 now expects the band at column 0 (it read "Service: HAIRCUTS").
- 2026-10-03 PLAN-C steps 6/7 DONE:
  - Inventory (`KnowledgeInventoryBuilder`): rule 2 (a group earns aggregate cards only when its tables' card tokens —
    `KnowledgeChunker.EstimatedTableTokens` — exceed `CardTargetTokens`), rule 3 (`RepeatedShareMin` 0.5: the top value repeats and
    repeats fill half the column), rule 4 (`MinRangeValues`; a ledger + its total is never a range, `LedgerTolerance` 0.01), rule 5
    (largest group first), P2-1 (aggregate bodies held to `MaxAggregateTokens` in tokens), P2-2 (`LinesLeftOut`, "+N more"), P2-8a
    (`CardText` = Text without column lines of groups with their own cards), defect 7 (a repeated label takes its group's first column).
  - Options (no new keys for these): `CardTargetTokens` = ChunkTargetTokens, `MaxAggregateTokens` = ChunkMaxTokens; NEW settings
    `DocAggregateMinRangeValues` 3, `DocAggregateCardsWarning` 8, `DocAggregateCardsLimit` 12 (Functions appsettings + class defaults).
  - Ingest: limit/warning each its own alert (`KnowledgeAggregateCardsWarning`/`Limit`), only the first Limit cards ship; overview
    bodies carry NO title (DocAggregate = "{label}\n{text}", DocSummary drops "{title} — overview"); summary card held to
    ChunkMaxTokens in TOKENS with "+N more"; step 7: overview cards give way first when the space is full (`OverviewsToLeaveOut`:
    aggregates from the last, then the summary) — `KnowledgeOverviewsLeftOutSpaceFull` raised ONLY once the file fits (a refused file
    never claims its overviews gave way).
  - AdminAlertType appended ×3; labels on admin web (AlertsPage.jsx) + admin mobile (alertTypes.ts) with tests (web 38, mobile 45).
  - Tests: inventory 67 green (rewritten per plan + 8 new), ingest unit 463 + 3 give-way, NEW integration
    `KnowledgeIngestOverviewCardsIntegrationTests` (3, real Cosmos + Azurite: limit keeps the largest tables' cards + row counts what
    shipped; warning + no title in bodies; space full → overviews give way, file Ready).
- 2026-10-03 PLAN-C step 8 DONE (section scope by page, heading cards, one caption rule, P2-6, P2-7, P1-7):
  - Block field `KnowledgeBlock.ContinuesPreviousPage` (owner-approved option A, stored only in the content-artefact blob). The parser
    marks the first content block of a page that carries on: (i) a sentence open at the break, (iii) a paired/coalesced run split by
    `GroupByPage`, (ii) the same table resumed (`ResumesTheSameTable`). Rebuilt pages (`RebuildPageByPage`) carry no marks, as planned.
  - NEW `KnowledgeSectionScope` (Paths, ParentPaths, PageResets, ClosingBefore): heading stack, AR-X13 reopen, AR-X5 picture scope,
    nearest-3 / 120-char path, and the page rule. Used by the chunker AND the inventory (P1-7: "Coverages" under two parents is two).
  - Chunker: a path change at a non-heading block ends the section; a heading that closes with no own words (banners, empty-heading
    lines and noise do not count) is a Text card under its parent (`FromHeadings`, line units), consecutive empty siblings share one;
    all-heading documents still get the EX-21 outline card; `IsRidingCaption` is the one caption rule (same page, same source, no
    record lines, no measure, not furniture/figure, ≤ 200 chars) at both sites; P2-7 heading cells read " — ".
  - DEVIATIONS / REFINEMENTS (each reasoned; tests pin them):
    1. (ii) is applied to every table that resumes with the SAME header — inherited or re-declared — unless its column-0 labels repeat
       the previous page's (share ≥ `RepeatedFormLabelShare` 0.5 ⇒ the same form for another vehicle/dwelling starts afresh).
    2. P2-6 own card only for a banner printed on 2+ pages (`RunningFurniture`; card filed under no section). A line on ONE page only
       ("Page 2", "Day 2", a single DI page header) stays with that page's words — as its own card it would cost a card per page and
       cut a day's title from its plan. Banners are never merged into a neighbour's tail (`MergeSmallTail`).
    3. A page reset also takes the page's leading banner, logo marker and logo words (they belong to the page they print on).
    4. A heading inside a picture's words never records the document's open headings as closed (they come back when its words end),
       so an outer heading is never judged empty while its own words continue after the picture. Picture headings with nothing under
       them become cards carrying the picture's handle (they were lost before).
  - Tests: NEW `KnowledgeSectionScopeTests` (10; sabotage: marks off ⇒ 3 fail, form rule forced ⇒ 2 fail, reset off ⇒ 3 fail incl.
    the chunker's), chunker tests (12 new, Case7 renamed `Case7_ConsecutiveHeadings_FoldIntoTheNextCardsPath`), inventory
    `TheSameSectionNameUnderTwoParents_IsTwoGroups`, NEW integration `KnowledgeIngestPageScopeIntegrationTests` (real PDF blob +
    Cosmos; reset off ⇒ fails with the old "… › Locks" filing). Picture-space helper `TextAndPictureCards` now leaves out overview
    cards (they give way first since step 7). Knowledge unit 3,363 + API Knowledge/BusinessSearch 1,894 green.
- 2026-10-03 PLAN-C step 9 DONE (P1-6 overview seats):
  - Voice `Diversify`: overview cards never take a record's seat nor count toward a document's cap; `KnowledgeRelevanceRanker.Seat`
    gains `countsAsSeat` (only records are counted and cut); `TrimToTokenBudget` allowance = browse ? `RetrievalBrowseOverviewSeats` (3)
    : `RetrievalLookupOverviewSeats` (1), rank-1 overview counting toward it. Business Search `DiversifyProviderCards`: records fill the
    top-K, overviews kept in rank order up to the lookup allowance; `WithOverviewAllowance` holds it after a closest seat.
  - Settings: class defaults + MCP appsettings (both) + API appsettings (lookup); convention tests ×3 updated (Functions NotRead, MCP
    ReadByThisHost, API ReadByThisHost).
  - Tests: MCP `ALookup_SeatsRecordsInEveryTopKSeat_WhenOverviewsRankAmongThem`, `ABrowse_SeatsAtMostTheBrowseAllowance`,
    `ARankOneOverview_CountsTowardItsAllowance` (ProviderKnowledgeSearchServiceTests) and `TheClosestSeat_NeverCountsAnOverviewAgainstTheRecords`
    (ProviderKnowledgeRelevanceTests — the file with the closeness harness; same host); API NEW `ProviderKnowledgeOverviewSeatTests` (3).
    Sabotage: voice rules off ⇒ 4 fail; provider rules off ⇒ 3 fail.
  - ‼️ MCP unit project cannot compile in C:\Nik until the libraries take origin's Phase-5 commit (`SwapCopyOnlyAttribute`,
    clinqetcore e2aa7d9; shared c98aeec; infra 10419feb are on origin, local masters are 1 behind and dirty). Built for this step with
    a scratch `CustomAfterMicrosoftCommonTargets` excluding that one test file — no repo file touched. Two MCP conventions
    (AiTokenPricing "gpt-6.1-sol", IntegrationHealthCoverage) fail for the same reason. Re-run the whole MCP suite after the final
    rebase. Origin's shared `AdminAlertType.cs` also changed: merge the appended values carefully at rebase.
- 2026-10-03 PLAN-C steps 10/11 DONE:
  - AS-13: NEW public `KnowledgePlacementCeiling.Apply` (same section ⇒ one placement; more sections than MaxSectionsPerImage ⇒ first
    only; returns Kept, SectionsCollapsed, MostSections) used by the parser's `CollapseRepeatedImageMarkers` and by the ingest's new
    `CaptionPlacements` (by stored picture, only placements that make a card) → `BuildCards(..., keptPlacements)`.
  - Defect 8 (owner rule 2026-09-30, two levels): NEW setting `Images.SectionsPerImageWarning` 5 (Functions only; real diagrams reach
    at most 5 sections), alert types `KnowledgePictureSectionsWarning` / `KnowledgePictureSectionsLimit` (ReportFileLimitAsync, actual =
    the most sections one picture is in), raised after the cards are built; the old generic ReportContentLimitAsync is gone. No provider
    notice: every picture keeps its description card (same reasoning as P1-5). `KnowledgeExtractionOutput.PictureMostSections` (in
    memory only). Admin labels web + mobile with tests.
  - Two tests that used the old alert as their whole-lane failure seam now use the remote-picture cap alert; two tests that expected
    twin caption cards for one picture in one section now expect one (the AS-13 rule).
  - AS-16: `SectionStitcher` merges a lower (or right-hand) HTML half only when its words outside its rows are none or equal to its
    partner's; pin updated to (2, "47995d27bb71de41") — no version raise (owner: rides the single 1→2 raise).
  - Tests: NEW `KnowledgePlacementCeilingTests` (5), ingest alert theory + none case, stitcher 3 new. Sabotage: ceiling ignored ⇒ 3
    fail; caption rule off ⇒ 2 fail.
- 2026-10-03 OWNER (mid-session): the §6 wrong-answers report stores NOTHING — each report is feedback that fires an admin alert; the
  provider may report the same document again. No schema change.
- 2026-10-03 PLAN-C step 12 DONE (section I + P1-8 + defects):
  - F36 `DropFigureEchoes` (a figure-text block EVERY line of which the neighbouring same-page text prints is dropped, its lines added
    to `removed`; one line of its own keeps the block); F48 a `<table>` inside an open figure closes the figure first; F50 a column-0
    lone cell is never a header tail, elsewhere the tail starts on a word; P2-4 WalkHtml keeps a table's words outside its cells (read
    from a clone, so pictures in cells are still collected); P2-9 bullets = the chunker's BulletChars (now internal) and "N)";
    P2-5 guard test (MCP); defect 5 `PieceHeadLength` = 0 when any other line joins cells; defect 4 the oversized-caption alert's
    actual = the longest description measured; P1-8 the title prompt names the issuer when printed (never invented); P1-4 verified
    (`AHeadingCarryingAPrice_IsARecordLine`); defect 2 was already fixed (`AddRunWithBanners`, pinned by two tests).
  - Tests: NEW `KnowledgeReadingRemainingItemsTests` (10; sabotage of all five fixes ⇒ 8 fail, the 2 others guard the opposite
    direction / were tightened: "estroyed" is a substring of "destroyed", now matched as a word and proven), MCP excerpt 2,
    describer 1, ingest caption-length 1.
- 2026-10-03 "Report wrong answers" (§6) DONE — owner (mid-session): NOTHING stored; one tap = one admin alert; the same file may
  be reported again (the sheet's "already reported today" state is dropped). Approved sheet `knowledge-wrong-answers-report` W1.
  - API: POST `knowledge/documents/{docId}/report-wrong-answers` {source: Web|Mobile} (`KnowledgeWrongAnswerReportDto`,
    `KnowledgeReportSource` enum), `voice.read` (any member who sees the list), tenant-scoped point read, Ready file only (not
    FAQ, not Deleting, no replacement in flight), per-member hourly bound `Voice:Knowledge:WrongAnswerReportsPerMemberPerHour` 10
    (API appsettings + class default + conventions ×2) through `IAiRateLimitingService`, 400/404/429 with server sentences
    `Knowledge_ReportNotAllowed/NotReady/TooMany/SourceRequired` ×5. `IKnowledgeWrongAnswerReports` → one `AdminAlertMessage`
    (`KnowledgeWrongAnswersReported`, Medium, new event id per tap, metadata: file, version hash, pages, passages, member, user
    number, roles, app, reading notices, the five storage prefixes) via the admin-alerts queue; `AdminAlertProcessor` keys the type
    by event (a redelivery is one alert, a second tap is another). Admin labels web + mobile.
  - Tests: API unit service 6 (+theory), controller 5 + permission pin, API integration 4 (real Cosmos, alert on the queue, tenant
    isolation), Functions processor unit theories + integration `WrongAnswersReport_FromTheRealProducer_PersistsOneRowPerTap`.
  - Partner web (agent, reviewed in the final audit): `ReportWrongAnswers.jsx` (link on the row's info line, button beside Download
    in `DocumentViewer.jsx`), service `ReportKnowledgeWrongAnswers`, 7 keys ×5, 36 tests, ESLint clean. Partner mobile:
    `ReportWrongAnswers.tsx` (list line + file screen button), `reportKnowledgeWrongAnswers`, 7 keys ×5, 23 tests, tsc + ESLint clean.
- 2026-10-03 O-1 DONE: `Clinqet.API.Json.NewtonsoftTokenJsonConverter` in the API's JSON options writes Cosmos-read JObject/JArray
  as JSON; integration `GetAlert_NestedDetails_ReachTheResponseAsTheirOwnJson` (fails with the converter removed).
- 2026-10-03 PLAN-B defect 9 DONE: `IAzureStorageService.ListBlobFoldersAsync` (delimiter listing), `KnowledgeVersionPruner
  .PruneFoldersAsync`, `KnowledgeBlobPaths.OcrVersionPrefix`; the ingest prunes other bytes' `_ocr` folders at both commit points
  (top-level bank files — picture and describe banks — untouched). Unit + Azurite integration `KnowledgePageReadingPruneIntegrationTests`.
- 2026-10-03 AS-12 DONE: `ReadingPageCount.Mismatch` (file pages vs the reading's page splits) → consumer item `PageCountMismatch`
  (always sent, "fix the reading rule"), knowledge ingest (fresh + retell) and AI setup.
- 2026-10-03 G3/G4 DONE at runtime: `KnowledgeCardCheck` (every kept word reaches a card body or section path; no markup on a card;
  a table with no data row is deliberately no card and is excluded) → `WordsNotOnCards` / `MarkupOnCards`, always sent; the retell
  re-chunks the banked reading (free). Sweep gains I2 (word conservation) + an MG-Windsor fixture.
- 2026-10-03 F59 DONE: `KnowledgeSectionScope.SortBanners` — a banner on every content page is its own card once (P2-6); a banner on
  SOME pages rides the section path of every block on those pages (the card header carries it beside each price; never a card);
  a one-page line stays with its words. Test `MgWindsor_AQualifierBanner_RidesEveryPriceCardOfItsPages` (sabotage ⇒ 2 fail).
- 2026-10-03 AS-04 DONE — DEVIATION from the audit's mechanism, reasoned: figure markers pair with DI figures PAGE BY PAGE (count
  per page) instead of by a stamped DI id. Ids would have to ride the DI markdown the reading model is SHOWN (every raw-bank key
  changes ⇒ every page bought again, §0.23) and the section stitcher builds figures without ids. Per page, a lost/extra marker
  (incl. AS-14's box-less figures) costs only its own page's places. Test `AMarkerMismatchOnOnePage_CostsOnlyThatPagesPlaces`.
- 2026-10-03 AS-15 DONE: `KnowledgeDocumentDescriber` banks {title, summary, language} at `_ocr/{biz}/{doc}/describe-{key}.json`,
  key = SHA(DescribeRulesVersion, deployment, effort, max chars, system + user prompt); never the fallback; fail-soft both ways.
  `DescribeRulesVersion = 1` + guard `TheDocumentDescriptionRules_AreVersioned` (1, "6412ee7d1986a2f1"). 14 constructions updated.
- 2026-10-03 small items: `ReadPageTextAsync` removed (no caller; render pin → (1, "985982758fe9c490"), pin only); the
  `KeyFor`/`ReadingAgainWouldHelp` assertions moved from Functions to API `KnowledgeReadingAgainOfferTests` (every notice key);
  the earlier audit's guards sabotaged: RunBanners ⇒ 2 fail, Combine ⇒ 1, the alert size bound had NO test — added
  `ListsPastTheQueueLimit_AreHalvedUntilTheyFit` (fails without it); furnitureSeen is backed by the chunker's own dedupe.
- 2026-10-03 PLAN-D defect 11 DONE: `CatalogManifestService.Validate` no longer refuses the whole manifest over one price above
  `CatalogManifest:MaxAllowedPrice` (same class as "never delete a price"). The price is kept; setup's existing review ceiling marks
  it `PriceBeyondReviewCeiling` and raises `SetupPriceBeyondReviewCeiling` under the manifest's setting. `Error_CatalogRecordPriceTooHigh`
  orphaned ⇒ removed ×5. Tests: `ReadAsync_PriceOverManifestCeiling_IsKept`, `ProviderSetup_ManifestPriceAboveItsCeiling_IsKeptLive_AndTheTeamIsTold`.
- 2026-10-03 PROOF (replays on the final code, scratchpad harness; no model call, every page from the bank): c1home 43/43 money kept,
  44 cards, 0 distinct amounts off cards; c1auto 51, 13 cards, 0; c2home 65, 43 cards, 0; c2auto 18, 13 cards, 0; no card-check or
  page-count item on any. MG Windsor (6TCWOI, India's real accepted page texts + machine reading): conservation nothing lost, 327 cards,
  every amount on a card, the p36 price table (5 variants, ₹9 99 000 … ₹13 99 999, rentals ₹3.99/₹4.50) on one table card under "BaaS".
- 2026-10-03 F59 REFINED (found by that replay — the runtime card check flagged 9 heading words on no card): MG Windsor's 170-char
  disclaimer rode every path and the old `PathOf(stack, pageContext)` cut the HEADINGS to fit it. Now a banner rides whole, after the
  headings, or is its own card once (`Banners(OwnCard, Riding, ContextByPage)`, greedy " · " join per page); headings never give way.
  Tests: `ALongDisclaimer_IsItsOwnCard_AndNeverPushesTheHeadingsOut` + "disclaimer" sweep fixture (I2) — both FAIL on the old code.
- 2026-10-03 `KnowledgePicturePassesIntegrationTests.WhenOnlyThePicturesDoNotFit…` failed since AUDIT-4 P1-5 (overviews give way
  first, so one picture left, not two): the room is now measured on the provider's own cards and the test proves the overviews left first.
- 2026-10-03 suites: API unit 15,853/15,853 · Functions unit 9,298/9,298 (then knowledge+conventions 3,694 after F59) · API integration
  2,539 pass / 18 skipped · Functions integration 906/906 (after the fix above).
- 2026-10-03 MCP `Reordering_KeepsEveryPassage…(8)` pinned the old unlimited browse overviews; renamed `…KeepsEverySeatedPassage…` and
  asserts every row + at most `RetrievalBrowseOverviewSeats` overviews (PLAN-C P1-6 decision). MCP knowledge search 135/135; the two
  MCP conventions (AiTokenPricing, IntegrationHealthCoverage) fail only on the library skew and are re-run after the rebase.

## FINAL MULTIDIMENSIONAL AUDIT — 2026-10-03 (5 read-only reviewers; every finding verified and fixed this session)
Ledger (status updated as each closes):
- W1 comment above wrong endpoint — FIXED · W2 alert date in provider culture — FIXED (invariant) · W3 integer enum accepted — FIXED
  (`[EnumDataType]` on Source + Access + Audience) · W4 hourly limit per server / follows AIAssistant:RateLimiting:Enabled — house
  pattern (same as Business Search), told to owner · W5 deploy order — FIXED (API + Functions in ONE release, apps last; deployment
  skill ×4) · W6 403/200-by-role/429 integration — FIXED (8/8) · W7 Functions test builds the API-only producer — OPEN · W8 Retry-After 0 — FIXED
- U1 P2 mobile list report unreachable by screen reader — OPEN · U2 web offline after failed — FIXED · U3 403 retry (web FIXED, mobile OPEN)
  · U4 web wrapper focus ring — FIXED · U5 web shows control while row busy — OPEN · U6 mockup register/sheet stale vs rulings — OPEN
- I1 P1 commit prune deletes picture readings (`_ocr/{biz}/{doc}/{pictureHash}/`) — OPEN · I2 P2 check answers banked parsed — OPEN
  · I3 P2 max tokens in raw keys — OPEN · I4 P2 failed replacement prunes re-uploadable bank — OPEN · I5 describe bank ignores ForceFresh
  — OPEN · I6 PdfiumDocument.ReadPageText dead — OPEN · I7 region read outside heavy-work gate — OPEN · I8 download copied twice — OPEN
  · I9 setup reuse any-status twin + stale blocks — OPEN
- S1 P1 setup reuse loses kept-machine-reading pages ⇒ unconfirmed price live — OPEN · S2 P2 profile-write failure skips outcome alert
  — OPEN · S3 PricingFor dead — OPEN · S4 high-price alert says KEPT before the gate — OPEN
- C1 path cut mid-word, deepest heading · C2 rows wider than header lose header words · C3 overview "0 records" · C4 empty-heading
  card unbounded · C5 EX-21 rescue cut outline · C6 dedupe removes a heading's only card · C7 card check NFC false alarms · C8 card
  check misses losses (bag, pre-BuildCards, caption of no-card table) · C9 header missing from cover rides · C10 IsLedger hides ranges
  · C11 RowAnchors quadratic · C12 PageResets dead · C13 placement rule drift parser vs ingest · C14 merged run stamps page 1
  · C15 misplaced/verbose comments — all OPEN
Audit closes (2026-10-03, each with a test that FAILS on the old code — batch sabotage: 10/10 reading-side, 3/3 setup-side caught):
- W7 FIXED: the Functions processor test hand-builds the API's message (`WrongAnswersReport_PersistsOneRowPerTap`); the API suite owns the producer.
- U1 FIXED at the cause (agent): the mobile list row is no longer one accessible element, so every nested control (report, Try again,
  name link, pictures toggle, notice dismiss, Read again) is reachable; the row menu is a "More options" action (COMMON.OPEN_MENU) for
  managers. U3 mobile FIXED (403 final, `denied`). U5 FIXED (web hides while re-reading/deleting). U6 FIXED (register + PLAN §0A notes,
  sheet stamped approved, superseded parts annotated — nothing deleted). Web 659 / mobile 705 knowledge tests, tsc + lint clean.
- I1 FIXED: the commit prune keeps the version AND every picture of the committed registry (`PageReadingFoldersToKeep`), lists past the
  kept folders; unit + Azurite integration with a picture folder. I4 FIXED: a failed replacement never prunes page readings.
- I2 FIXED: a banked check answer carries the model's raw answer (`RegionAnswer`: text + flags) and is re-read by `CheckAnswers.Interpret`
  on replay; `DocumentTranscriptionVerifier.cs` (what is asked and shown) moved under RenderRulesVersion. `ABankedCheckAnswer_IsReadAgain…`.
- I3 FIXED: no answer budget in the transcript or check-question key (`TheRawKey_…` now asserts a budget never moves it).
- I5 FIXED: `DescribeAsync(..., forceFresh)` never replays a title on a forced reading. I6 FIXED: `PdfiumDocument.ReadPageText` deleted.
  I7 FIXED: the region text read enters the heavy-work gate (no caller holds a slot — no nesting). I8 FIXED: the downloaded buffer is
  returned without a copy when it is exactly the blob.
- I9 + S1 FIXED: `FindReadyByContentHashAsync` (index-only, partition-scoped; real-Cosmos integration test); the artefact records
  `VisionPagesKeptMachineReading` (blob field, null on older artefacts ⇒ setup reads the file itself); the saved page text is parsed again
  by today's parser, used only when its picture markers match the stored pictures. S2 FIXED (profile failure still reports the reading).
  S3 FIXED (`PricingFor` deleted; the name rules' tests moved to `NamingFor`). S4 FIXED (alert says "marked", never "KEPT").
- C1 FIXED: outer headings give way, none is cut. C4 FIXED: empty-heading cards packed to budget. C5 FIXED: the EX-21 cut outline is
  gone — `AddHeadingsNoCardCarries` puts any heading no card carries on packed heading cards. C6 FIXED: a copy that is its section's only
  card stays. C7/C8 FIXED: the card check uses the conservation gate's tokens, counts every number per occurrence over distinct texts,
  keeps a no-card table's caption (and the chunker now gives that caption its own card); a heading over pictures alone keeps its own
  card (a picture card may not ship). C9 FIXED: a cover before the first running line is not a page the banner must cover. C12 FIXED
  (`PageResets` deleted). C15 FIXED (comments moved to their methods; the scope summary cut to two lines).
- C2/C3/C10/C11/C13/C14 — table/inventory/parser agent, in progress.
- C2 FIXED (`WithUnwrittenHeader`: the header rides as a context line when no row carries its labels) · C3 FIXED (`TableGroup.Records`
  counts every data row; a table no row lines up with makes no column group) · C10 FIXED (a ledger needs the sum in the LAST row; alone
  it suffices from 3 lines, with 2 the total row must also leave a filled column empty — no word list; accepted: "A $10 / B $20 /
  Total $30" with two columns shows a range) · C11 FIXED (`Contains` dropped; proof: a later span only overwrites an earlier one's left
  end) · C13 FIXED (parser and ingest place a picture by ONE `KnowledgePlacementCeiling.Section`; `KnowledgeImageGrounding` shared) ·
  C14 FIXED (a lone line's page is `continuing`; each page keeps its own block). Residual, recorded not hidden: a card that crosses a
  page break cites its first page — true of every card system-wide (one PageNumber per card); a per-line page is a model change not made.
- NEW (found by the table agent) FIXED: HTML spans past 100 read as 1 moved every later cell under another label ("C2: $5"). Spans now
  follow the HTML standard (colspan ≤ 1000, rowspan ≤ 65534, rowspan 0 = to the end); the grid budget refuses an oversize table honestly.
  `AWideSpan_KeepsEveryLaterCellUnderItsOwnLabel` fails on the old rule.
- Card check, found by the MG Windsor replay: counting distinct texts ACROSS roles merged a picture's own words with an identical card
  line (15 false numbers). Distinct per role now; `APicturesWords_ThePageAlsoPrints_AreNeverALoss`. Replays after: c1home/c1auto/c2home/
  c2auto and MG Windsor — nothing lost, every price on a card, no card-check or page-count item, zero model calls.
- §0.23 pins (pin only — no version decides anything new): render (1,"b60e118ef8880e1a"), reading (2,"339c5556be8de688"),
  describe (1,"d0463f7bab7abab1"). `DocumentTranscriptionVerifier.cs` moved to the render list (what is asked and shown).
- W4 (in-memory per-server hourly bound, follows AIAssistant:RateLimiting:Enabled) — house pattern, told to the owner, unchanged.
- 2026-10-03 post-rebase replay found: a header label over a column empty in every row ("Comp" in company2_auto) reached no card.
  `WithUnwrittenHeader` now carries every label no written row carries as one context line, bound to no value
  (`AColumnEmptyInEveryRow_KeepsItsName`). `AnAnswerBankedBeforeTheBudgetRanOut` failed once under load (a 1 s wall clock): the
  check now waits only for the budget's cancellation and the budget has room for the reads (5/5 + 10/10 runs pass).
- REBASED onto origin/master (Search Phase 5) in every repo: AdminAlertType (both sets), appsettings (both sides, gpt-6.1-sol kept),
  admin labels + tests (both), picture-text fingerprint re-pinned to the combined settings (9429d7abb80c1d38). All suites re-run green
  on the rebased code; history linear (no merge commits).

## 2026-10-04 — NKN607's three "check against the original" alerts: the write-back fixed for every page shape

Asked by the owner: why did four insurance quotes (company1/company2 home + auto, `C:\Nik\Data\sample`, business NKN607, CA
sandbox) raise three High alerts — fix it for every document, no degradation, no false alerts, no alert removed.

**What the three alerts were, simply:** the AI page was right each time; the step that writes the reading rules' decisions back
into the AI page broke it.
1. company1 home p2 and company2 home p7 ("markup on cards") — a line the machine reading had went back between a table's
   header and its `|---|` line, so the whole table reached the cards as raw pipes.
2. company2 auto p2 ("1 number a reading rule lost, put back") — the AI wrote a row short (it skipped a blank cell); read by
   position, TOTALS was published as a second PRIN., a correct zero deleted and a stray "0" appended.

**Fixed (infrastructure `Services/AI/Reading`, AdjudicationRulesVersion 2 → 3):** `PageBlocks` (new: lines that mean something
only together, tables inside list items and tables without outer pipes included); `PageWriteBack` rewritten (one edit per row,
spans and tokens checked against the page, whole cells only when nothing else is lost, HTML-safe, rows hug their table, every
ruling of an edit reported); short rows (AI padded places never pair, usual-width column map, header-led re-seat); header labels
by their own tokens; placeless row-group words; HTML cells with real page positions or none.

**Found by the corpus replay and the two reviewers, fixed in the same session:**
- The PDF's own text "corrected" correct machine words into broken ones: ligatures with no character ("Noti\u001Fcations",
  "Illustraon", "Di\u001Ferential", "Re\u001Eector"), a clipped first letter ("AWD" → "WD"), a lost "₹". `TextLayerAuthority`
  now refuses unmapped glyphs and letters only dropped; a lost ligature against the AI's full word lets the AI's reading stand.
- An amount wrapped onto the next line ("10⏎years") never matched "10 years": the AI's correct value was taken out and a stray
  unit inserted; now joined from evidence (both readings print it) — the first, tokenizer-level attempt glued NKN607's "2021"
  to the next field's "Year" and was rejected after the replay showed it.
- HTML cell tokens carried cell-relative offsets: a ruling could crash the document or delete words from the page heading.
- A row put back after a table landed below a paragraph put back at the same spot; a single value in a merged cell overwrote
  the whole cell; a line deletion was refused when a line was put in after it; one stray pipe could decide a table's column
  map; a short row under a full header was moved silently (a real column disagreement hidden).
- A ruling the page could not take passed silently whenever it was an AI value to take out, a check's reading or words: now
  `RulingNotWritten` (always sent, "fix the reading rule", figures at stake). A rule fault is never replaced by a consumer outcome.
- An attempt to anchor restored words on their own line was reverted: it only shuffled OCR crumbs and created a false loss.

**Proof:** 337 banked pages replayed on the final code (no model call): 0 numbers lost (old rules 3), 0 rulings not written, 0 crashes (old rules crashed MG Windsor p15); every changed page read by hand. 44 sabotages each caught by a named test. Functions unit suite 9,648/9,648; Functions integration, API unit + integration, MCP and Identity builds: see the line added below when they finish.

**Settings convention (other session's commit):** `ServiceDrafts:RefreshDailyLimitPerBusiness` / `RefreshDailyWarningPerBusiness`
/ `RefreshDailyLimitPerDocument` / `RefreshCounterTtlSeconds` are read only by the API's `KnowledgeRefreshLimiter` — exempted in
the Functions host's settings convention test (adding them to its appsettings would be a dead key).

**Status:** committed + pushed to master in clinqetshared, clinqetinfrastructure, clinqetfuncations (linear; nothing in
clinqetapi). NOT deployed — deploy Functions and API in ONE release (the new enum value travels in the content-artefact blob both
hosts read). After deploy: "Read again" the four NKN607 files and MG Windsor; expect no reading alert on them.

## 2026-10-04 (b) — after the version-3 deploy: the Honda Accord "Rates" alert (NKN607 auto p1) — DONE

- **Alert:** `ReadingRuleFallback` on page 1, row "Rates": the machine's garbled header row was put back as read.
- **Cause:** DI read the rates values into the table header. The tables matched but did not line up, so their rows were compared
  as loose text: the machine's "43 57" was settled by the PDF text and restored INTO the AI's AB cell ("37 43 57"), while the AI's
  check-confirmed "43 | 57" stood. The audit still counted the machine's 43 57 as lost and put the whole row back.
  Two placement faults were found on the same pages: "Rates" was written into the heading ("(021303 Rates )"), and "Totals" was
  written after its table under the title band ("Definity …: Totals").
- **Fix (generic):**
  - `PageDecision.PrintedOnce`: a machine-only table value printed by the AI's confirmed copy in the same table is printed once.
  - `PageTable.Titles(row)`: title words go before their AI table, while body values keep their labels after it.
  - `PageTable.Parts` / `PlaceOf(row)`: with stacked tables, the line goes beside the printed part that holds its row.
  - `AdjudicationRulesVersion` 3 → 4.
- **Proof:**
  - Replay of the 17 raw-banked NKN607 pages, pushed vs new: loss 1 → 0, and the 3 changed pages were all read by hand and all better.
  - The 321 published pages of the other businesses were replayed as a stress test: losses 5 → 4, and the 2 changed pages were better.
  - One regression ("Seatbelt Reminder: All Seats" became a bare "All Seats") was found by that replay and fixed before commit.
  - 5 sabotages, all caught.
  - Functions unit tests: 9,654 / 9,654.
