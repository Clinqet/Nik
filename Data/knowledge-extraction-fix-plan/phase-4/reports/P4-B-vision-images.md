# P4-B — PDF / Document Intelligence / vision transcription / image lane — closing audit (read-only)

Auditor B, 2026-09-25. READ-ONLY: nothing under `C:\Nik` was edited, built, tested or git-written. Every finding
quotes the code it rests on. Severity follows the brief (owner ruling: every extraction/passage defect is High or
Critical). Where a finding is High "by the ruling" rather than by its intrinsic blast radius, the row says so.

---

## 1. Scope actually read

| File | Lines | How read |
|---|---|---|
| `clinqetfuncations\...\Functions\KnowledgeIngestProcessorFunction.cs` | 3,730 | 1–1700 and 1690–3340 end to end; 3340–3730 read (space gate, notify, keep-answering, index-visibility, FailAsync, TerminalReasonFor). Only 3014–3060 (superseded-source archive) skimmed |
| `clinqetinfrastructure\Services\AI\VisionDocumentTranscriptionService.cs` | 861 | end to end |
| `…\AI\DocumentTranscriptComparer.cs` | 931 | end to end |
| `…\AI\DocumentTranscriptionVerifier.cs` | 242 | end to end |
| `…\AI\VisionPageTranscriber.cs` | 125 | end to end |
| `…\AI\DocumentTranscriptUnits.cs` | 247 | end to end |
| `…\AI\DocumentValueEquivalence.cs` | 245 | end to end |
| `…\AI\DocumentSourceEvidenceReader.cs` / `DocumentSourceTextIndex.cs` | 209 / 84 | end to end |
| `…\AI\DocumentPageRasterizer.cs` | 204 | end to end |
| `…\AI\PageMarkdownSplicer.cs` | 150 | end to end |
| `…\AI\TranscriptionDisputeIndex.cs` / `TranscriptionVerificationAlerts.cs` | 117 / 220 | end to end |
| `…\AI\DocumentIntelligenceService.cs` | 1,533 | 1–60, 230–660, 1100–1533 end to end (submit/poll/retry, classification, poll budget, figures, result id). 660–1100 (provider-setup / drafts three-phase extractor) **skimmed — drafts dimension** |
| `…\AI\AICompletionService.cs` | (partial) | 430–680 (timeout/throttle/HTTP error shapes the vision lane receives) |
| `…\Knowledge\KnowledgeImageExtractor.cs` / `KnowledgeImageNormalizer.cs` / `KnowledgeImageCaptionClassifier.cs` / `KnowledgeImageStore.cs` / `KnowledgeImageFingerprint.cs` / `KnowledgeImagePolicy.cs` | 606 / 250 / 199 / 228 / 66 / 49 | end to end |
| `…\Knowledge\KnowledgeExtractionCache.cs` / `KnowledgeContentArtifactStore.cs` / `KnowledgeIngestQueue.cs` / `KnowledgeDocumentDataPurger.cs` / `KnowledgeReadingNotices.cs` / `DocumentPageCounter.cs` | 135 / 160 / 111 / 181 / 194 / 38 | end to end |
| `…\Knowledge\KnowledgeDocumentParser*.cs` | (partial) | C4/C6/C10 collection code only (`OpenXml.cs` 1–40, 470–570; `KnowledgeDocumentParser.cs` 1640–1880) |
| `…\Knowledge\KnowledgeChunker.cs` | (partial) | 100–170, 316–460 (how a spliced Paragraph is chunked) |
| `…\Storage\RemoteImageIngestionService.cs` | (partial) | 380–470 |
| `clinqetfuncations\...\Services\KnowledgeDocumentDescriber.cs` / `KnowledgeSummaryFactCheck.cs` / `KnowledgeDocumentFormats.cs` | 216 / 86 / 58 | end to end |
| `clinqetcore`: `IDocumentTranscriptionVerifier.cs`, `IVisionDocumentTranscriptionService.cs`, `DocumentTranscriptComparison.cs`, `KnowledgeContentArtifact.cs`, `KnowledgeBlocks.cs`, `KnowledgeCaptionContext.cs`, `KnowledgeBlobPaths.cs` (85–185), `DocumentSourceEvidence.cs`, `IDocumentIntelligenceService.cs` (90–150) | — | end to end (as cited) |
| `clinqetshared`: `VisionTranscriptionSettings.cs`, `AdminAlertSettings.cs`, `VoiceKnowledgeSettings.cs` (270–380) | — | end to end (as cited) |
| Functions `appsettings.json` | 1240–1460 | Voice:Knowledge incl. Images + Vision |
| Tests read | — | `DocumentTranscriptionVerifierTests.cs` (all), `DocumentIntelligencePollBudgetTests.cs` (all), `KnowledgePictureTextTests.cs` (all), `KnowledgeReadingNoticesTests.cs` (all), `KnowledgeExtractionOutputCopyTests.cs` (all), `DocumentTranscriptionAdjudicationTests.cs` 240–340, 560–670, 926–1146, `KnowledgeIngestProcessorFunctionTests.cs` 200–260, 3130–3190, 3850–3950, 4440–4510, 5370–5520, 5850–5880, `KnowledgeIngestTransientRetryIntegrationTests.cs` 1–120. **Not read end to end**: the rest of the 5,881-line ingest test file and the 1,146-line adjudication file |
| Authority docs | — | PLAN.md (all); FINDINGS §0–§9; phase-1 AUDIT (all); phase-2 AUDIT (all), E12-E13-REVIEW (all), LIVE-ACCEPTANCE-2026-09-12 (all), LIVE-ACCEPTANCE-2026-09-14 §7 (262–790), PROGRESS-SESSION2 §1–7, §17, §18, §28, PROGRESS.md §C1/C2/C7, PHASE-1-DEFECT-FIX (all); phase-3 AUDIT §13 |

---

## 2. Findings

Legend for "conf.": **H** code-certain; **M** code-certain path, real-world frequency unproven; **NLP** = NEEDS-LIVE-PROOF.

### P4-B-01 — CRITICAL — A source check that answers "unreadable" OR answers at length is read as "this is NOT printed on the page", and the verifier then DELETES the text

- **Where.** `DocumentTranscriptionVerifier.cs:25-33` (prompt), `:218-224` (length cut), `IDocumentTranscriptionVerifier.cs:56-57`, `VisionDocumentTranscriptionService.cs:420, 471-475, 506-511, 587-588`, `DocumentTranscriptComparer.cs:81-94, 153-162`, `VisionDocumentTranscriptionService.cs:352-356`, Functions `appsettings.json:1396, 1406`.
- **Evidence.**
  - The verifier's own schema has ONE flag for two different answers: *"If a region cannot be located **or read** on this page, set unreadable to true and leave text empty."* (`Verifier.cs:30-31`).
  - A faithful answer longer than 400 chars is recoded as that same flag: `if (text != null && text.Length > settings.MaxDiscrepancyExcerptCharacters) { readings.Add(new DocumentVerificationReading(id, null, true)); continue; }` (`:218-224`). `MaxDiscrepancyExcerptCharacters` = **400** (`appsettings.json:1406`) while the comparer may ask about a unit of up to `MaxComparedTextCharacters` = **4000** (`:1396`; `Limits()` maps it to `MaxExcerptCharacters`, `VisionDocumentTranscriptionService.cs:352-356`).
  - Both then count as "answered: not on the page": `AnsweredNotOnPage(regionId) => FailureCategory == null && Readings.Any(reading => reading.RegionId == regionId && (reading.Unreadable || string.IsNullOrWhiteSpace(reading.Text)))`.
  - ContentMissing + notOnPage ⇒ `disposition = SourceUnitNotOnPage; selected = string.Empty;` — the machine-reading line is **not** carried back (`:471-475`).
  - ContentAdded + notOnPage ⇒ `removals.Add(discrepancy)` (`:506-511`) and the removal span is the **whole transcript unit** (`CandidateStart = unit.Start, CandidateLength = unit.Length`, `Comparer.cs:160-161`), applied at `:587-588`.
- **Violates.** R-13 clause 1 ("a unit may be replaced only by a reading that contains every fact of the unit") and "a source-only unit must never be dropped silently"; L-1 and L-2's own design note (the flag was meant to carry "I cannot find that on this page", `Verifier.cs`/`IDocumentTranscriptionVerifier.cs:50-55`).
- **Failure scenario.** (a) A clinic leaflet paragraph "Cancellation: 24 hours' notice… a $50 fee applies…" (≈550 chars, one DI line) that vision dropped twice → ContentMissing → the source check copies the whole passage faithfully → 550 > 400 → unreadable → `SourceUnitNotOnPage` → the paragraph (and the $50 fee) never reaches the index. (b) A 480-char brochure paragraph with a price DI mis-OCR'd (`$45O`) → ContentAdded on the vision line → the checker copies the paragraph (480 chars) → notOnPage → the **entire paragraph is removed** from the transcript. (c) Fine print ("All prices exclude HST") that the 1024-px transcription could not read and the 2048-px check reports as `unreadable` → DI's correct OCR line dropped. All three alert at **Low** severity with the title "resolved" (`TranscriptionVerificationAlerts.cs:102-131`).
- **Tests pin the label, not the arithmetic.** `DocumentTranscriptionVerifierTests.AnOverlongRegion_IsTreatedAsUnreadable_NeverSilentlyTrimmed` asserts only `Read("r1") == null`; the adjudication tests simulate "not on page" with exactly `(id, string.Empty, true)` (`DocumentTranscriptionAdjudicationTests.cs:1108-1114`) — the same shape an over-long or illegible answer produces.
- **Fix direction.** Give the schema a separate `notOnPage` boolean; treat `unreadable` and over-length answers as "no usable reading" (FailureCategory), never as evidence of absence; never remove a whole unit for one unconfirmed money token (remove the token, or keep and flag); size the answer bound to at least the comparer's unit bound. Add the missing test: an over-long / unreadable answer must leave the line in place.
- **Conf.** H (path) / NLP (frequency).

### P4-B-02 — HIGH — The "ran out of time" notice (and the "Read again" offer) is stamped for EVERY degraded reading, including a file that will not render

- **Where.** `KnowledgeIngestProcessorFunction.cs:902` + `:1217`; `IVisionDocumentTranscriptionService.cs:118`; `KnowledgeReadingNotices.cs:115-116`; `en.json:2985`.
- **Evidence.** `var readingRanOutOfTime = extraction.VisionDegraded;` → `RanOutOfTime = readingRanOutOfTime,`; `Degraded => BudgetExhausted || RasterizationFailed || PagesUnreadable > 0;`; `ReadingAgainWouldHelp(keys) => keys.Any(key => key is RanOutOfTime or PagesUnread);`. The sentence: *"We ran out of time reading this file, so we used a quicker reading for all of it … read it again and we'll carry on from where we stopped."* `KnowledgeExtractionOutput.VisionOutOfTime` exists precisely to tell the causes apart (`KnowledgeBlocks.cs:124-132`) and is not used here.
- **Violates.** Owner change #3 at approval of `knowledge-document-row-truth` (PLAN.md:90): *"Never promise an outcome the code does not deliver … RasterizationFailed offers Replace file … [the budget case] is the only cause that offers Read again."* Also R-9/E7.
- **Failure scenario.** A PDF PDFium cannot open (or a >40 MP photo, P4-B-04) → row shows "We ran out of time … read it again and we'll carry on" **and** "We couldn't turn this file's pages into pictures" and offers Read again, which repeats the same refusal forever. One unreadable page out of 30 shows "we used a quicker reading for **all** of it" beside "1 page couldn't be read" — contradictory, and the first is false (29 pages are the transcript).
- **No test** pins the ingest mapping; `KnowledgeReadingNoticesTests` only feed `From()` a hand-set outcome.
- **Fix direction.** `RanOutOfTime = extraction.VisionOutOfTime` on a fresh run; on replay derive it (`VisionDegraded && !VisionRenderFailed && VisionPagesUnreadable == 0`) or bank the fact. Pin one ingest test per cause.
- **Conf.** H.

### P4-B-03 — HIGH — The standalone-image return path drops `VisionPagesUnreadable` and `VisionRenderFailed`

- **Where.** `KnowledgeIngestProcessorFunction.cs:1564-1578` (vs `:1405-1418`, `:1518-1533`, `:1546-1560` which carry both).
- **Evidence.** The photo/scan/TIFF/BMP return is `output with { Blocks …, VisionDegraded = vision.Degraded, VisionOutOfTime = vision.BudgetExhausted, VisionPagesBanked …, VisionPagesTotal …, Reviews = vision.Reviews, RenderedPages = true, Images = … }` — no `VisionPagesUnreadable`, no `VisionRenderFailed`. `output` comes from `ParseLayoutMarkdown`, so both stay at their defaults (0 / false), and the artefact banks the same zeros (`:888-889`).
- **Violates.** The Phase-2 `with` rule's purpose (E-19/E7: "what the reading could not do is what the provider is told"); `KnowledgeExtractionOutputCopyTests` guards the SHAPE (no hand-built outputs) and misses omitted fields in a `with`.
- **Failure scenario.** A 20-frame fax TIFF where 3 frames fail, or a photographed price list whose render is refused: the provider sees only P4-B-02's false "ran out of time" sentence — never "3 pages couldn't be read" and never "we couldn't turn this file's pages into pictures".
- **Fix direction.** Carry both fields on this return; add a guard that every vision-backed return carries every `Vision*` field.
- **Conf.** H.

### P4-B-04 — HIGH — The vision rasterizer refuses any single image over 40 MP, although the normalizer already decodes such JPEGs safely — high-resolution photos are never read by vision, and the alert blames the file

- **Where.** `DocumentPageRasterizer.cs:160-168` (+ `:140-147` frames); `KnowledgeImageNormalizer.cs:103-115`; `VisionDocumentTranscriptionService.cs:88-102`; `appsettings.json:1006` (`MaxDecodedPixels: 40000000`).
- **Evidence.** Rasterizer: `if ((long)info.Width * info.Height > maxDecodedPixels) return RasterizationOutcome.Unrenderable;` — no reduced-scale decode. Normalizer: `var scaledDecode = declared > ceiling && isJpeg && declared / 64 <= ceiling;` + `TargetSize = scaledDecode ? new Size(maxEdge, maxEdge) : null` (its own comment: "a 48MP phone photo and a 600dpi Letter scan, both of which decode fine … were dropped and alerted as lost"). The refusal returns the DI text for the whole document, and the admin alert says *"could not be rendered to page images at all. No dial changes this — the file itself is unrenderable (encrypted, corrupt, or an unsupported encoding)"* (`:92-94`) — false for this cause.
- **Violates.** The extraction goal (vision "mode Always"); for non-Latin pages it re-opens the P2-A/L-2 exposure (OCR is the only reading). Also P4-B-02/03 then mislabel it to the provider.
- **Failure scenario.** A provider uploads a 50 MP (8160×6120) phone photo of a Gujarati price list → the page is never transcribed → the index carries DI's OCR of Gujarati (the `aal: 1 419 242` class of garbage measured in PROGRESS-SESSION2 §2) → Ready with "We ran out of time…". Same for 1200-dpi TIFF scans.
- **Fix direction.** Use the normalizer's `TargetSize` decode in `RasterizeSingleImageAsync`/`RasterizeOneFrameAsync` (the page is resized to 1024/2048 anyway); keep the hard refusal only where even 1/64 exceeds the ceiling; word the alert by cause.
- **Conf.** H (code) / NLP (share of uploads above 40 MP).

### P4-B-05 — HIGH — Past the per-document source-check ceiling (and whenever the checker cannot answer) every machine-only line is restored by default — R-13's "unreadable OCR yields to vision" holds only where a paid check was bought

- **Where.** `VisionDocumentTranscriptionService.cs:653-676` (`WithoutEvidence`), `:216-232`, `:491-499`; `VisionTranscriptionSettings.cs:87` (`MaxVerifiedPagesPerDocument = 8`).
- **Evidence.** `if (discrepancy.Kind == TranscriptDiscrepancyKind.ContentMissing) { if (discrepancy.SourceRestoreText is { Length: > 0 } line) restored.Add(line); continue; }` — no page-text-layer (P2-A) test, no script test, unlike the cell corrections two lines below (`if (!DocumentTranscriptComparer.PageCarries(pageTextLayer, discrepancy.SourceText, …)) continue;`, `:670`). With a failed/unconfigured checker the same happens in `AdjudicateAsync` (`SourceUnitRestored` with `uncertainty = verification.FailureCategory ?? "no usable source reading, so the line was kept"`, `:491-499`).
- **Violates.** R-13 clause 3 (FINDINGS §3: *"an unreadable OCR unit (no word in any script the page prints) yields to the vision reading"*) and clause 2 ("a structural dispute goes to the third check … never to a default"); the P1-C defect (PHASE-1-DEFECT-FIX: *"SourceUnitRestored putting OCR soup back into the index"*) is fixed only for checked pages. E12-E13-REVIEW §3B already measured "pages 9–20's disputes were settled with no evidence".
- **Failure scenario.** A 20-page **scanned** Gujarati price list (no text layer): pages 1–8 get source checks; on pages 9–20 each DI soup row (`aal: 1 419 242 1-1 | GHd: ₹250`, a `# 2 414` heading) is unmatched, carries a figure, is not covered by the transcript ⇒ ContentMissing ⇒ appended to the page ⇒ indexed beside the correct row, and a restored `#` line becomes the section title of the next page's cards (the exact P1-C symptom). Same on every page when the `gpt-5.6-sol` deployment is throttled or down.
- **Fix direction.** Apply R-13 clause 3 without a check: a machine-only line on a rendered page (empty text layer) whose script/word profile is not the page's (TextScriptDetector over the transcript) yields to the transcript; otherwise restore. Tell the provider when pages were settled without a check.
- **Conf.** H (code) / NLP (needs a >8-page scanned non-Latin fixture).

### P4-B-06 — HIGH — C3 splices a picture's transcript as ONE raw-markdown Paragraph: pipe tables are never parsed, labels are lost and `|---|` reaches the cards

- **Where.** `KnowledgeIngestProcessorFunction.cs:2688-2711` (`WithPictureText`), `:860-863`, `:2749-2752`; `KnowledgeChunker.cs:123-132, 335-383, 389-409`; transcriber prompt `VisionTranscriptionSettings.cs:124` / `appsettings.json:1408`.
- **Evidence.** `blocks.Add(new KnowledgeBlock { Kind = KnowledgeBlockKind.Paragraph, Text = text, PageNumber = block.PageNumber });` where `text` is the vision **markdown** (the prompt demands "tables as GitHub pipe tables with the header row first"). The chunker's `SelfContainedLines` cannot qualify a pipe row: `IsValueTerminated("| Haircut | $25 |")` reads the last token `"|"`, and `EndsInABareNumber` likewise ⇒ `null` ⇒ `builder.AddSentences(SplitSentences(text…))` — one glued string. The code comment claims the opposite: *"they chunk, label and answer exactly like the same list typed in the document"* (`:860-861`). The P1-A/P1-B live checks named "no raw |---| in any card" as the bar (PHASE-1-DEFECT-FIX §5); `AStandaloneImage_IsNotReadASecondTimeAsAPicture` asserts it only for standalone images.
- **Violates.** R-6/C3 (the transcript must behave like the typed list), A1/L-4 (glue), A5/R-3 (labels).
- **Failure scenario.** A Word file that is "Price list" + a photo of the menu (the C3 case itself): card = `| | | |---|---| | Haircut | $25 | | Beard trim | $15 | …` — one glued card with markup, no `Service:/Price:` binding; the receptionist hears a blob and the draft lane gets no table.
- **Fix direction.** Parse the transcript with `ParseLayoutMarkdown` (it already handles pipe tables, the header veto and dehyphenation) and splice the resulting blocks at the marker; add a test with a pipe-table transcript.
- **Conf.** H.

### P4-B-07 — HIGH — C11's alt-text card can never be produced by the lane; it fires only when descriptions are switched OFF — the one case its own guard forbids

- **Where.** `KnowledgeIngestProcessorFunction.cs:2892-2907`, `:2225-2231`, `:2554-2583`, `:839-841`; `KnowledgePictureTextTests.cs:118-140`.
- **Evidence.** BuildCards: `if (authored == null || imageRefByIndex?.GetValueOrDefault(chunk.ImageIndex) == null) continue;` — but the fresh lane sets the ref only with a caption: `var imageRef = string.IsNullOrWhiteSpace(caption) ? null : …; … if (imageRef != null) result.RefByIndex[index] = imageRef;` (and its comment: *"it is gated on the caption and NOTHING else"*). The replay sets the ref only when a caption exists, and TopUp's "free win" puts that caption into `captions` first — except when captioning is off (`captions = … : new Dictionary<int, string>()`), where the ref survives from `kept.Caption` and an alt-text card IS emitted while descriptions are off. The test builds `BuildCards` with `RefByIndex = { [0] = … }` and no caption — a state the lane never produces.
- **Violates.** C11 (FINDINGS §2.B) and D26 as quoted in the guard (*"descriptions OFF means no picture card at all"*).
- **Failure scenario.** A catalogue DOCX photo with alt text "CAT 340 excavator, left side" whose description fails (outage/content filter) → no card, the only name the picture has is thrown away (the C11 defect, unchanged).
- **Fix direction.** Give a stored, undescribed picture its ref (or have BuildCards ask "stored?" from the registry, not "has a ref?"); pin it with a lane-level test, not a BuildCards-only one.
- **Conf.** H.

### P4-B-08 — HIGH (by the ruling; intrinsic Low–Medium) — C9 regressed on replay: every Word/Excel/HTML picture is stamped page 1 again

- **Where.** `KnowledgeIngestProcessorFunction.cs:2560-2566` vs `:1961`; `KnowledgeBlocks.cs:33`.
- **Evidence.** Fresh lane: `Page = paginated ? marker.PageNumber : null` (a DOCX/XLSX/HTML picture banks `Page = null`). Replay: `Page = pointer.Page ?? marker?.PageNumber` — the `??` cannot tell "recorded as none" from "not recorded", and the marker's `PageNumber` defaults to 1 (`public int PageNumber { get; init; } = 1;`). The re-emit path (`:1033-1040`) then gives a preserved picture's card `preserved.Page` = 1 on a non-paginated file (B2).
- **Violates.** C9 (FINDINGS: *"Artefact replay stamps DOCX/XLSX pictures Page=1"*). The only C9 test (`AnUnpaginatedSource_RecordsNoPageNumber`) covers the fresh half.
- **Failure scenario.** Any "Read again"/reindex of an unchanged Word price list replays the artefact → its pictures read "p.1" on the provider's strip.
- **Fix direction.** Distinguish absence (bank a `Paginated` flag or use `artifact.PageCount is > 0` to decide); add a replay test with a null-page pointer.
- **Conf.** H.

### P4-B-09 — HIGH — An E12 continuation drops `ForceFresh` and never asserts its own intent, so a forced-fresh re-read of a long document can silently replay the OLD artefact

- **Where.** `KnowledgeIngestQueue.cs:82-109`; `KnowledgeIngestProcessorFunction.cs:686-713, 787-798`; E12-E13-REVIEW §2.C.
- **Evidence.** `EnqueueContinuationAsync(businessId, docId, mode, continuation, pagesBankedSoFar, aiAttemptsSpent, …)` builds the message with no `ForceFresh`. On the continuation pass `var artifact = message.ForceFresh ? null : await _artifactStore.TryReadAsync(…)` then `replayTheBankedRun = artifact != null && !retryLostPictures && !retryDegradedVision && !retryRaisedImageCap` — `message.Continuation` is consulted only by `ShouldCarryOnReading` (`:3280-3293`). The review's warning: *"The continuation must carry its own intent, not inherit this flag"* (`retryDegradedVision … && deliveryCount <= 1`).
- **Violates.** EX-06/R-28 ("a forced-fresh run reads NEITHER cache", the page-cache note `VisionDocumentTranscriptionService.cs:147-148`); E12-E13-REVIEW §2.C.
- **Failure scenario.** Admin `reindex-knowledge?forceFresh=true` after a vision-prompt change (prompts are not in the artefact fingerprint, PROGRESS-SESSION2 §24.3) on a 40-page Gujarati PDF: pass 0 ignores the caches, runs out of time, enqueues `continue1` without ForceFresh; pass 1 finds the unchanged, clean artefact and **replays it** — the forced re-read is discarded and the row commits the old reading. Variant: a continuation of a "Read again" on a degraded artefact that is *redelivered* (deliveryCount 2) replays the old degraded artefact — the §2.C trap.
- **Fix direction.** Carry `ForceFresh` on continuation (and retry) messages; on `message.Continuation > 0` never replay an artefact older than the chain.
- **Conf.** H.

### P4-B-10 — HIGH (by the ruling) — C5 half-fixed: a metafile no longer "loses" a picture, but it still disables asset retirement for every Word file with a chart

- **Where.** `KnowledgeIngestProcessorFunction.cs:1741-1745, 2063-2069, 1999-2007, 1269-1276`.
- **Evidence.** `Bounded = remoteCapSkipped + decorativeSkipped + metafileSkipped` and `MayRetire => !LostPictures && Bounded == 0 && Dropped == 0;`. The metafile comment itself lists *"disabled asset retirement"* as one of the harms being fixed. A metafile can never have been stored by an earlier run (ImageSharp cannot decode it), so it carries no "cannot decide they are gone" risk that justifies `Bounded`.
- **Violates.** C5 (FINDINGS: *"…re-extraction on every Reprocess, retirement disabled"*).
- **Failure scenario.** A provider replaces `menu-v1.docx` (photo A + an Excel chart) with `menu-v2.docx` (photo B + the chart) → photo A is `unaccounted`, `MayRetire` is false, so A is merged back into the album forever — still shown as part of the document, its blob never deleted, its old Sendable kept though no card carries it.
- **Fix direction.** Count metafiles as a skip that does not forfeit retirement (keep `Bounded` for cap/floor/remote-cap only).
- **Conf.** H.

### P4-B-11 — HIGH (C1 residual, by the ruling) — Configuration faults and our own storage are classified as "the file is unreadable"

- **Where.** `DocumentIntelligenceService.cs:1130-1133, 1137-1142, 598-599`.
- **Evidence.** `ClassifyHttpFailure(...) => IsTransientError(statusCode) || statusCode == HttpStatusCode.RequestTimeout ? Transient : Content` — so 401 (rotated key), 403 (DI firewall/VNet), 404 (model/api-version/path) and a config 400 (`UnsupportedApiVersion`) all become `Content` ⇒ `Error_KnowledgeUnreadable`. The analyze-failed code list treats `ContentSourceNotAccessible` (DI could not fetch **our** SAS URL) as content.
- **Violates.** C1's fix direction (*"DI error codes that name the content … ⇒ terminal; everything else … ⇒ retryable"*) and R-5.
- **Failure scenario.** A DI key rotation or a storage network rule that blocks DI: every PDF/photo uploaded during the incident is Failed "unreadable" (first uploads), or Ready with "the new file couldn't be read" (re-reads), and nothing retries once the operator fixes it.
- **Fix direction.** Parse DI's error body code on the submit path; 401/403/404/`ContentSourceNotAccessible`/api-version ⇒ transient + an admin alert naming the config; keep `InvalidContent`/`UnsupportedContent`/password as terminal.
- **Conf.** H (code) / NLP (exact DI code for a blocked SAS).

### P4-B-12 — HIGH (C2 residual, by the ruling) — A file that is broken INSIDE a valid zip is treated as a transient outage: ~70 minutes of retries, then "try again"

- **Where.** `KnowledgeIngestProcessorFunction.cs:3671-3695, 748-763, 441-451`; `KnowledgeDocumentParser.OpenXml.cs:15, 838`, `Pptx.cs:20` (default `Open` settings; DocumentFormat.OpenXml 3.3.0).
- **Evidence.** `TerminalReasonFor` returns a key only for `DocumentExtractionException` or `FileFormatException or InvalidDataException`; everything else ⇒ `null` ⇒ `throw new KnowledgeIngestRetryableException(ex)`. An `XmlException` (bad character in a part), an `OpenXmlPackageException` (e.g. a malformed hyperlink URI — no `RelationshipErrorHandlerFactory` is configured) or any deterministic parser exception is therefore retried `IngestRetryAttempts` (5) times on the 30 s × 4ⁿ ladder (cap 1800 s), then redelivered 5 more times, then stamped `Error_KnowledgeGenericRetry` ("try again").
- **Violates.** C2's fix direction (*"everything else is 'unreadable'"*) and R-5's "a bad FILE ends the run".
- **Failure scenario.** A real Word file with `mailto:someone@ example.com` in a hyperlink: the row sits Processing ~70 min and ends "Something went wrong — try again"; the provider retries forever.
- **Fix direction.** Classify parse-time exceptions from our own in-process parsers as file failures; open OOXML with a relationship error handler so a malformed link does not fail the file at all.
- **Conf.** H (classification) / NLP (exception type thrown by SDK 3.3.0 for a malformed URI).

### P4-B-13 — HIGH (C1 class, by the ruling) — When Document Intelligence returns no text, a vision outage (or a one-page budget cut) ends the document as "unreadable" / "no readable content"

- **Where.** `KnowledgeIngestProcessorFunction.cs:1486-1489, 812-816`; `VisionDocumentTranscriptionService.cs:189-196, 286-293`; `DocumentIntelligenceService.cs:469-473`.
- **Evidence.** Vision failures are per-page fail-soft (the page keeps its OCR text), and a budget cut returns `request.DocumentIntelligenceMarkdown`. With empty DI text (a scan DI OCRs to nothing, or DI unconfigured — `"Unconfigured DI returns empty rather than throwing"`), `if (string.IsNullOrWhiteSpace(vision.Markdown) && !ImageExtensions.Contains(extension)) throw await TerminalFailureAsync(…, "Error_KnowledgeUnreadable", ct);` fires **before** ProcessAsync's E12 check; a multi-page join survives that line (page-break markers) and dies at Case I (`Error_KnowledgeNoReadableContent`).
- **Violates.** R-5 ("provider-visible 'still working' instead of false 'unreadable'").
- **Failure scenario.** On a stamp without DI (or a handwritten/low-contrast scan) an Azure OpenAI outage during a first upload ⇒ Failed "your file is unreadable"; a single-page scan whose one page is still being read at the budget cut ⇒ terminal instead of continued.
- **Fix direction.** When every page failed transiently (or the budget cut left no reading), raise `KnowledgeIngestRetryableException` / continue instead of judging emptiness.
- **Conf.** H (code) / NLP (DI-empty frequency).

### P4-B-14 — HIGH — A transient caption failure is indistinguishable from a refusal: pictures are mis-described from page text, good descriptions are overwritten, and a reprocess marks them "refused" for good

- **Where.** `KnowledgeImageCaptionClassifier.cs:36, 114-118, 158-165, 191-196`; `KnowledgeIngestProcessorFunction.cs:2156-2179, 2197-2213, 2655-2665, 2394-2404`; `KnowledgeContentArtifact.cs:124-129`.
- **Evidence.**
  - Every failure — transport error, 429 after retries, timeout, truncation ("A cut-off is a BUDGET fact, never a refusal"), re-decode failure, content filter — returns `Undescribed = (null, Unclassified, Ok)`.
  - Fresh lane: `readsAsText = kind == TextSnapshot || (kind == Unclassified && string.IsNullOrWhiteSpace(caption))` ⇒ a container document runs the paid picture transcription; a rendered document takes `DescribeFromItsOwnWords(caption, PageText(extraction.Blocks, asset.Page), …)` — the **page's** text becomes the picture's caption and `kind = KnowledgeImageKind.TextSnapshot`. Because that caption is non-null, `Caption = caption ?? Previous(...)?.Caption` **overwrites a previous good description**. It is also banked in the artefact (`ImageCaptions = new Dictionary<int, string>(captions)`, `:879`), so every later replay keeps it, and wherever the business map is read (`:2821-2831`, see P4-B-24) it is reused for the same bytes and words. It lasts until a deploy invalidates the artefact or an admin runs ForceFresh.
  - Replay top-up: `if (string.IsNullOrWhiteSpace(caption)) { foreach (var p in group) p.CaptionRefused = true; … }` — a transient failure is banked as a deterministic refusal ("never re-offered") until a deploy changes the artefact fingerprint.
- **Violates.** R-5 (transient vs terminal) in the caption lane; C7 ("never carry…", "the caption a provider had already approved was thrown away"); C12-L's premise (it was for a describer that *refused* a text-heavy picture).
- **Failure scenario.** An Azure OpenAI throttle burst during a post-deploy re-read of a 12-page kitchen brochure: every product photo on a page is re-described as that page's opening 400 characters, kind flips to TextSnapshot, the old descriptions are gone, and later runs reuse the page-text captions. A photo whose top-up hit the same burst is marked `CaptionRefused` and stays undescribed and unsendable until the next deploy.
- **Fix direction.** Make the classifier return a failure reason (Refused / Truncated / Transient); only a refusal takes the picture-text path or sets `CaptionRefused`; a transient failure keeps the previous caption and retries on the next run.
- **Conf.** H.

### P4-B-15 — MEDIUM — Switching descriptions OFF (a cost dial) makes the lane transcribe pictures and creates picture cards

- **Where.** `KnowledgeIngestProcessorFunction.cs:2852, 2156-2179, 2663`; BuildCards guard `:2899-2902`.
- **Evidence.** `if (!_settings.ImageCaptioningEnabled) return (null, KnowledgeImageKind.Unclassified, …)` ⇒ every picture satisfies `readsAsText` ⇒ container documents run DI + vision + a possible source check per picture until 5 succeed; rendered documents describe from page text with `counted = false`, giving each picture a caption, a ref and a card.
- **Violates.** D26 as stated in the code (*"descriptions OFF means no picture card at all"*) and the dial's purpose (it spends more, not less).
- **Failure scenario.** An operator turns captioning off to save cost; the next ingests of DOCX/PPTX files buy DI + vision per picture and index picture cards.
- **Fix direction.** Gate `readsAsText` / `DescribeFromItsOwnWords` on `ImageCaptioningEnabled` (or decide explicitly that text-reading is independent of captioning and say so).
- **Conf.** H.

### P4-B-16 — HIGH (by the ruling) — The Document Intelligence bank (E12-E) is reused after DI has deleted the analysis, so its figure crops 404 and pictures are reported "lost at extraction" on every post-deploy re-read

- **Where.** `KnowledgeExtractionCache.cs:53-85` (no age check); `DocumentIntelligenceService.cs:1446`; `KnowledgeImageExtractor.cs:133-142, 598-604`; `KnowledgeIngestProcessorFunction.cs:1460-1472, 696, 1820-1827`; LIVE-ACCEPTANCE-2026-09-14 row 5b.
- **Evidence.** The bank stores `ResultId` (`extraction.ResultId = ParseResultId(operationLocation)`), and the binder downloads unmatched figures with `_documentIntelligence.GetAnalyzeFigureAsync(_settings.ExtractionModelId, analyzeResult.ResultId, figure.Id, …)`; a null crop increments `figuresWithNoPixels` ⇒ `LostImages` ⇒ the "produced no pixels from any source" alert, `Unresolved`, `LostPictures`, `ImageLaneDegraded = true`, and `retryLostPictures` on the next Read again — which hits the same stale bank. Row 5b says the bank's reuse half is exactly "a pipeline-fingerprint change followed by a reprocess".
- **Violates.** The C5/C6 principle (no false "lost picture" alerts, no permanently degraded artefact) and E7 (the provider is told pictures "couldn't be read").
- **Failure scenario.** A PDF whose figures are vector drawings or JBIG2/JPX rasters (DI-crop only) is re-read after a deploy (>24 h later): all such figures "lost", false admin alert, the notice "N pictures in this file couldn't be read", the artefact degraded, retirement disabled — and every later Read again repeats it. (Pictures are preserved by the merge-back, so nothing is destroyed.)
- **Fix direction.** Do not reuse a bank whose `ResultId` is past DI's retention for figure binding (store the bank's write time; re-analyze when figures are needed and the result has expired), or bank the crop bytes.
- **Conf.** H (path) / NLP (DI result retention — documented as 24 h).

### P4-B-17 — HIGH (R-13 clause 1, by the ruling) — The "evidence-driven" page revert skips the word-conservation test the rest of the adjudication applies

- **Where.** `VisionDocumentTranscriptionService.cs:404, 571-575, 585`; test `DocumentTranscriptionAdjudicationTests.cs:620-650`.
- **Evidence.** `var pageRevert = revert || (truncatedComparison && resolvedToSource >= 2 && resolvedToSource == group.Count);` then `if (pageRevert) return new PageDecision(baseline, true, review);`. `revert` is only ever set when `recoverable` (= `ConservesWords(baseline, candidate)`) holds; the second disjunct never consults it.
- **Violates.** R-13 clause 1 ("a unit may be replaced only by a reading that contains every fact of the unit").
- **Failure scenario.** A scanned page with >25 differences where the 12 checked regions all confirm the OCR digits, but the transcript alone read a stamped note / handwritten line ("Closed Mondays") that DI missed: the whole page reverts to OCR and the note is deleted (prose gains are never discrepancies, so it was never checked).
- **Fix direction.** Require `recoverable` for this branch too, or restore the transcript-only lines after the revert.
- **Conf.** H (code) / M (frequency).

### P4-B-18 — HIGH (R-13, by the ruling) — `SourceUnitUnconfirmed` drops a machine-only unit on a partial or off-target third reading; both guards that detect such readings are switched off for structural disputes

- **Where.** `VisionDocumentTranscriptionService.cs:428-432, 476-490, 774-779`.
- **Evidence.** `var offTarget = third != null && !discrepancy.IsStructural && (ShorterThanTheRegion(…) || … !Supports(third, discrepancy.Anchor …));` — ContentMissing is structural, so neither the partial-reading test nor the anchor test runs; then `else if (third != null && !agreesWithSource && DocumentTranscriptComparer.PageCarries(candidate, third, …)) { disposition = SourceUnitUnconfirmed; selected = string.Empty; }`. The code documents both failure modes elsewhere ("answers about the first line only — a PARTIAL reading"; "read somewhere ELSE on the page … measured happening on 2026-09-10").
- **Violates.** R-13 ("a source-only unit must never be dropped silently" — the alert is Low, see P4-B-33) and L-1.
- **Failure scenario.** DI line "Deep tissue massage — 60 min $90 (includes hot stones and aromatherapy)"; the transcript has only "Deep tissue massage — 60 min $90"; the checker returns just the first sentence, which the transcript already carries ⇒ the whole DI line, including what the transcript lacked, is dropped.
- **Fix direction.** Keep the P1-C soup rule but require that the third reading be complete for the region (length and anchor tests) before it may drop a real-script line; otherwise restore.
- **Conf.** H (code) / NLP.

### P4-B-19 — HIGH (P2-A class, by the ruling; NEEDS-LIVE-PROOF) — P2-A trusts ANY text layer, including a legacy-font layer whose Unicode is wrong or a scanner's invisible OCR layer

- **Where.** `DocumentPageRasterizer.cs:185-195`; `VisionDocumentTranscriptionService.cs:670, 686-706`.
- **Evidence.** `ReadTextLayer` returns PDFium `GetText()` verbatim, and both `Unsettled` and `WithoutEvidence` let the machine reading write a cell whenever `PageCarries(pageTextLayer, discrepancy.SourceText)` is true.
- **Violates.** P2-A's premise ("the machine reading decides characters only where the page PRINTS them") and R-13 clause 3: a Krutidev/legacy-Gujarati-font PDF "prints" Latin codes that render as Devanagari/Gujarati; a phone-scanner PDF carries an OCR layer that is itself a guess.
- **Failure scenario.** A 20-page Hindi rate card set in a legacy font: if DI echoes the text layer (`lsok` for `सेवा`), pages 9+ (no paid check) get the gibberish written over vision's correct cells because the layer "carries" it.
- **Settles with.** One legacy-font Hindi PDF with >8 disputed pages, or the verifier disabled.
- **Fix direction.** Treat a text layer as authoritative only when its script profile matches the rendered/transcribed script; ignore invisible (render-mode 3) text.
- **Conf.** M / NLP.

### P4-B-20 — HIGH (C7, by the ruling) — A failed re-caption keeps the old description and "Can be sent" on the stored picture but emits no card and no ref

- **Where.** `KnowledgeIngestProcessorFunction.cs:2144, 2197-2207, 2227-2231, 1019-1047`.
- **Evidence.** `Caption = caption ?? Previous(...)?.Caption` and `Sendable = … (caption != null || kept.Caption != null) ? kept.Sendable : …` keep the old caption and tick, but `imageRef` and `result.Captions[index]` are built from this run's `caption` (null) — so no ImageCaption card. `Undescribed++` also stamps "N of them have no description yet". The re-emit block only runs for `LostPictures`.
- **Violates.** C7's fix ("fall back to the previous caption" — done for the entry, not for the card) and the M23 asymmetry the code itself fixed elsewhere (`:1013-1018`: "the provider's panel showed the tick, and NOTHING in the system could ever put that picture in front of the model").
- **Failure scenario.** A re-extraction during a caption outage: the panel shows the picture described and ticked, the row says it has no description, and a caller can never be sent it until the next replay heals it.
- **Fix direction.** When the previous caption is kept, also emit the card/ref from it (or keep neither).
- **Conf.** H.

### P4-B-21 — HIGH (R-5, by the ruling; owner decision needed) — R-5's "vision transport failures are retryable" is not implemented: a throttle or outage publishes the page's OCR as Ready

- **Where.** `VisionPageTranscriber.cs:77-83`; `AICompletionService.cs:484-490`; `VisionDocumentTranscriptionService.cs:189-196`; PHASE-2-PROMPT R-5 row; PROGRESS.md §C1/E2/R-5.
- **Evidence.** The page transcriber catches everything except cancellation and the attempt budget, including the typed `AiThrottledException` ("a surviving throttle is TYPED so the caller can retry the document instead of publishing it degraded"), and returns a failed page; the page keeps its OCR text; E12 continues only on `BudgetExhausted`. R-5 as approved: *"A retryable exception class for DI/vision/embedding transport failures"* — only DI was built (PROGRESS.md §C1/E2/R-5).
- **Tension.** The approved sheet does draw "pages read with the simpler reading" as Ready-with-notice. But for a non-Latin page the simpler reading is the "OCR garbage published as Ready" 🔴 that PROGRESS-SESSION2 §2 describes and E12 closed only for the TIME cause.
- **Failure scenario.** Eight businesses ingest at once, the bulk slots throttle, 12 of 20 Gujarati pages fail → Ready with 12 pages of DI soup (plus P4-B-02's false notice).
- **Fix direction.** Owner to decide: either throttled/transport page failures make the delivery retry (scheduled, like DI), or the document continues (E12) rather than publishing OCR for a script the OCR cannot read.
- **Conf.** H (code).

### P4-B-22 — MEDIUM — The page-cache policy claims to fold in every acceptance dial; it omits several, including the two this report touches

- **Where.** `VisionTranscriptionSettings.cs:93-118`; `VisionDocumentTranscriptionService.cs:45-49, 152`.
- **Evidence.** The doc comment: *"It folds in every setting that could change which reading was accepted, so loosening a bound or changing the verifier moves the key on its own."* The digest omits `MaxRepairWordLossPercent`, `MaxDiscrepancyExcerptCharacters` (decides whether a check "answered", P4-B-01), `MaxComparedTextCharacters`, `MaxVerifiedPagesPerDocument`, `ReferenceMaxChars`, `PageRenderMaxEdgePixels`, `TranscribeReasoningEffort`, `MaxCompletionTokens`. Only an infrastructure deploy (module id) invalidates.
- **Failure scenario.** An operator raises `MaxDiscrepancyExcerptCharacters` to 4000 as the P4-B-01 mitigation → every page already cached replays its old deletions on the next reprocess.
- **Fix direction.** Add the omitted dials (or fold the whole settings object) into `ValidationFingerprint`; fix the comment.
- **Conf.** H.

### P4-B-23 — MEDIUM — Cost: the "per-document" source-check ceiling resets on every continuation pass, and a page settled in favour of the machine reading is never banked

- **Where.** `VisionDocumentTranscriptionService.cs:117, 216-249`; `VoiceKnowledgeSettings.cs:52`; E12-E13-REVIEW §3B.
- **Evidence.** `var verificationsLeft = Math.Max(0, settings.MaxVerifiedPagesPerDocument);` is per `TranscribeWithVisionAsync` call = per pass, so up to 8 × (1 + `MaxReadingContinuations` 8) = **72** `gpt-5.6-sol`/High checks per document read, against the review's cost model `min(pages, 8) × 58.8 s`. Pages that keep the machine reading `return` before `TryWriteCacheAsync` (pinned by `APageThatKeptTheMachineReading_IsNeverBanked`), so each continuation pass and each later re-extraction re-buys their transcription and source check. Their comment says they take "the same path a blank page uses" — a blank page IS cached.
- **Fix direction.** Carry verifications spent on the continuation message (like `AiAttemptsSpent`); bank source-kept pages with their decision.
- **Conf.** H.

### P4-B-24 — MEDIUM (C7 residual) — The business-wide description map is never read when every picture has neighbouring words, so `captionContextHash` (an approved §0.7 field) is dead in the common case

- **Where.** `KnowledgeIngestProcessorFunction.cs:2056-2061, 2123-2128`; PROGRESS.md §C7.
- **Evidence.** `var canReuse = assets.Exists(a => a.SourceContext == null); var known = … || !canReuse ? [] : await BuildBusinessImageMapAsync(…);` — its comment predates the context hash ("none of them may reuse a description written beside different words"), while the reuse test two blocks later is now exact: `reused.ContextHash == contextHash`.
- **Impact.** Every re-extraction (every deploy + Read again) re-describes every grounded picture, and it is this re-description that exposes P4-B-14's overwrite. PROGRESS.md claims "Reuse across documents now requires the picture and its words to match" — true only when some picture has no words.
- **Fix direction.** Drop the `canReuse` gate.
- **Conf.** H.

### P4-B-25 — MEDIUM — Deleting a document leaves its picture transcripts behind in `_ocr/`

- **Where.** `KnowledgeIngestProcessorFunction.cs:2739`; `KnowledgeBlobPaths.cs:140-141, 159-169`; `KnowledgeDocumentDataPurger.cs:108-111`.
- **Evidence.** Picture transcription caches under `OcrDocumentKey($"{row.DocId}/{asset.ImageId}")` → segment `"{docId}-{imageId}"` → `_ocr/{biz}/{docId}-{imageId}/…`. The purger deletes the prefix `_ocr/{biz}/{docId}/`, which does not match. The purger's own rule (`:101-102`): *"a cache of the provider's own file — leaving it behind is the same lie as leaving the source"*.
- **Failure scenario.** A provider deletes a Word file that contained a photographed price list; the transcript of that price list stays in storage until business closure.
- **Fix direction.** Key the picture cache under the document's own prefix (`{docId}/pictures/{imageId}`) or sweep `{docId}-` too.
- **Conf.** H.

### P4-B-26 — MEDIUM — C3's cost bound and its stated guarantees do not hold

- **Where.** `KnowledgeIngestProcessorFunction.cs:2158-2168, 2713-2747`; `VoiceKnowledgeSettings.cs:301-308`.
- **Evidence.** `transcribed++` only when text came back, so `MaxTranscribedPictures` (5) bounds **successes**; attempts are bounded only by the image cap (40). The setting says "Each one costs one DI call and one vision call, cached on the picture's own bytes, so a reprocess is free", yet `ExtractRawTextFromBytesAsync` is called every time (no bank), and the cache key includes the document id, which contradicts the method comment "the same photo in two documents is transcribed once". The request also omits `ForceFresh` (EX-06/R-28) and `StopBy`.
- **Failure scenario.** A deck of 40 screenshots where DI/vision find nothing readable ⇒ 40 DI calls + 40–80 vision calls + up to 40 source checks, not 5.
- **Fix direction.** Count attempts; bank the DI half on the image hash; pass `ForceFresh`; correct the comments.
- **Conf.** H.

### P4-B-27 — LOW — Retry and continuation messages each drop the other's state, and their ids are not unique per reading

- **Where.** `KnowledgeIngestQueue.cs:63-72, 94-108`; `KnowledgeIngestProcessorFunction.cs:346-348, 790-792`.
- **Evidence.** A retry is `{ …, ForceFresh, Attempt = attempt }` (no `Continuation`, `PagesBankedSoFar`, `AiAttemptsSpent`); a continuation is `{ …, Continuation, PagesBankedSoFar, AiAttemptsSpent }` (no `Attempt`, no `ForceFresh`). Ids are `…:retry{attempt}` / `…:continue{n}`: a second reading of the same document that schedules its `retry1` within the 10-minute duplicate window of the first reading's `retry1` is silently collapsed.
- **Impact.** A transient failure inside a continuation chain resets the continuation ceiling, the progress guard and the per-document AI allowance (the leak `AContinuationCarriesForward_WhatTheDocumentHasAlreadySpent` guards on only one path); a collapsed retry strands the row Processing until `StaleProcessingMinutes` (160).
- **Fix direction.** Carry all four fields on both messages; add the row's reading epoch to both message ids.
- **Conf.** H (code) / M (frequency).

### P4-B-28 — LOW — `AiAttemptBudgetExhaustedException` is swallowed by the caption, describe, verification and picture-text calls

- **Where.** `KnowledgeImageCaptionClassifier.cs:191`; `KnowledgeDocumentDescriber.cs:140`; `DocumentTranscriptionVerifier.cs:99-105`; `KnowledgeIngestProcessorFunction.cs:2758, 743-747`.
- **Evidence.** Only `VisionPageTranscriber` and `ExtractAsync` rethrow it, per F-C ("the ceiling bound, not the document — the delivery redelivers with a fresh slice").
- **Impact.** A delivery that exhausts its slice mid-lane commits Ready with undescribed pictures, a filename title and unchecked disputes, rather than redelivering.
- **Conf.** H.

### P4-B-29 — LOW — `PipelineReserveSeconds` (180) was measured on documents with no pictures

- **Where.** `VisionTranscriptionSettings.cs:18-25`; `KnowledgeIngestProcessorFunction.cs:2084`.
- **Evidence.** The reserve covers "the pictures, the overview, the embeddings and the index write", measured at 37 s on a picture-less 20-page run. The caption loop is sequential (≤40 captions with cut-off retries, plus ≤5 picture transcriptions each with its own source check).
- **Impact.** A final pass whose vision used its budget gets killed by the delivery deadline mid-lane and re-pays every caption on redelivery (cost only; it self-heals).
- **Conf.** M.

### P4-B-30 — LOW — Provider notices for pictures are wrong on three edges

- **Where.** `KnowledgeIngestProcessorFunction.cs:1699, 1213-1216, 2473-2474, 2533, 2070`.
- **Evidence.**
  1. A whole-lane failure (`Faulted`: `Degraded = Unresolved = 0`) produces **no** notice, although E7 named "the lane failed".
  2. A replay reports `Unresolved = artifact.ImageLaneDegraded ? 1 : 0` ⇒ "1 picture couldn't be read" whatever the real count.
  3. `PicturesFound/Kept` count provider tombstones as kept pictures.
- **Conf.** H.

### P4-B-31 — LOW — A password-protected PDF is refused as "unreadable", and its pre-count alert blames billing

- **Where.** `DocumentPageCounter.cs:12-23`; `KnowledgeIngestProcessorFunction.cs:1436-1446`; `DocumentIntelligenceService.cs:1137-1152`.
- **Evidence.** PdfPig's encryption exception is swallowed to `null` ("could not be page-counted … Document Intelligence bills every page"). The password sentence is reached only if DI itself returns the code `PasswordProtected`; a DI 400/`InvalidContent` ⇒ "unreadable". C2 bytes-first was built for OOXML only.
- **Fix direction.** Detect PDF encryption in-process (PdfPig names it) and map it to `Error_KnowledgePasswordProtected` before DI.
- **Conf.** M / NLP (DI's response code).

### P4-B-32 — LOW — TIFF decode ceiling multiplies the FIRST frame's size by the frame count; the source check decodes the whole TIFF for each page it checks

- **Where.** `DocumentPageRasterizer.cs:108-118, 143-149`.
- **Evidence.** `(long)info.Width * info.Height * frames > maxDecodedPixels`, then `Image.LoadAsync<Rgba32>` decodes every frame.
- **Impact.** A TIFF whose later frame is far larger than its first passes the ceiling (provider-authenticated input only). Up to 8 page checks × a 100-frame decode.
- **Conf.** M / NLP.

### P4-B-33 — LOW — A dropped machine-only unit alerts at Low, under a "resolved" title

- **Where.** `TranscriptionVerificationAlerts.cs:102-131, 181-205`.
- **Evidence.** `SourceUnitNotOnPage`/`SourceUnitUnconfirmed` set no `RemainingUncertainty` ⇒ `AdminAlertSeverity.Low`; `SourceUnitUnconfirmed` is missing from the "resolved" list (title "left an unresolved reading" at Low), and `Follow()` has no line for it. R-13: "a page that loses ≥ 1 source unit raises the mandatory transcription alert" — it is raised, at the lowest visibility.
- **Conf.** H.

### P4-B-34 — LOW — Hygiene

- **Where / evidence.**
  1. Dead branch still present after the phase-2 audit named it unreachable: `if (!wantFigures) return output with {…}` (`:1496-1497`; the only non-image DI extension is `.pdf`, and `wantFigures = extension == ".pdf"`).
  2. §0.14 orphaned doc comments: `Supports`'s `<summary>` sits above `PageCarries` (`DocumentTranscriptComparer.cs:595-610`); `TerminalFailureAsync`'s comment sits above `ShouldCarryOnReading`'s summary (`KnowledgeIngestProcessorFunction.cs:3263-3275`).
  3. Wrong claims in comments: see P4-B-04 (alert text), P4-B-23 ("same path a blank page uses"), P4-B-26 (C3 caching/reuse).
- **Conf.** H.

### P4-B-35 — LOW — Two prompts quote document text without the data fence

- **Where.** `KnowledgeDocumentDescriber.cs:78-97` (headings/body/file name, no `<document_text>` fence and no "DATA, never instructions" rule — the #10/X-02 class, a fourth site); `VisionPageTranscriber.cs:105-110` (the re-ask quotes missing machine-reading lines outside `<machine_reading>`).
- **Impact.** Own-document injection only; a figure-free injected overview sentence ("All services are free this month") passes the fact check.
- **Conf.** H.

### P4-B-36 — LOW — A continuation chain longer than `StaleProcessingMinutes` reads "stopped part way" while alive

- **Where.** `KnowledgeIngestProcessorFunction.cs:796-798` (a pass touches nothing on the row); `KnowledgeManagementService.cs:425-427`.
- **Evidence.** `processingSince` is stamped once. 9 passes × (900 s + DI/raster + session queueing) under contention can pass 160 min.
- **Impact.** U-04 offers Reprocess, starting a second chain and double spend.
- **Conf.** M.

### P4-B-37 — IMPROVEMENT

1. The PDF binder (PdfPig parse + DI crop downloads) runs on every continuation pass and is discarded (`:1501-1503` runs before the E12 return at `:787`).
2. R-3's prompt half ("write a header row only if the page prints one") was never applied (`VisionTranscriptionSettings.cs:124` still says "with the header row first"); the parser veto covers it.
3. DI's measured page `angle` (`DocumentSourceEvidenceReader.cs:47`) is never used to de-skew sideways scans before vision.
4. Layout-only verification alerts are uncapped (one per page, `VisionDocumentTranscriptionService.cs:257-258`): 100 alerts for a 100-page two-column brochure.
5. `KnowledgeSummaryFactCheck.Sentences` has no `。！？؟` terminators (a CJK overview with one unsupported figure loses its whole summary).
6. A content-filtered page is promised "reading it again usually picks them up" (`en.json:2986`) though the refusal is deterministic.

---

## 3. Closure check — original ids in this dimension

| Id | Verdict |
|---|---|
| **C1** transient vs terminal (R-5) | **FIXED-AND-VERIFIED-IN-CODE for DI transport** (`DocumentIntelligenceService.cs:575-627, 1115-1133, 1179-1226`; `KnowledgeIngestProcessorFunction.cs:336-362, 748-763`; integration test `KnowledgeIngestTransientRetryIntegrationTests`). **Residuals: P4-B-11 (config/our-storage 4xx ⇒ "unreadable"), P4-B-13 (empty OCR + vision outage ⇒ terminal), P4-B-21 (vision half of R-5 not built)** |
| **C2** bytes decide the Office sentence | **FIXED-AND-VERIFIED-IN-CODE** (`:3671-3713`), proven live (PROGRESS-SESSION2 §18.1). **Residual P4-B-12** (XML/package corruption ⇒ transient); PDF password wording **NEEDS-LIVE-PROOF** (P4-B-31) |
| **C3** pictures of text transcribed, ≤5, text_snapshot/unclassified-no-caption | Gate **VERIFIED** (`:2156-2158`, `!RenderedPages` `:1815`). **NOT FIXED in its output** (P4-B-06: raw markdown paragraph). Cap bounds successes only (P4-B-26); the unclassified half fires on transient failures (P4-B-14) and on captioning-off (P4-B-15) |
| **C4** grounding by the picture's own row | **FIXED-AND-VERIFIED** (`:2789-2794`; `OpenXml.cs:503-552`) |
| **C5** EMF/WMF Bounded not Lost | **PARTIAL** — alert/degraded/re-extraction fixed (`:2003-2007`, `KnowledgeImageNormalizer.cs:66-74`); retirement still disabled (**P4-B-10**) |
| **C6** HTML remote policy at collection | **FIXED-AND-VERIFIED** (`KnowledgeDocumentParser.cs:1687-1695, 1834-1845`) |
| **C7** reuse on fingerprint+grounding; no Sendable without caption | In-run **FIXED-AND-VERIFIED** (`:2082, 2122-2138`); Sendable rule **VERIFIED** on both lanes (`:2204-2207, 2554-2556`). **Residuals: P4-B-24** (cross-document map gated off), **P4-B-20** (kept caption with no card), **P4-B-14** (a transient failure overwrites a good caption) |
| **C8** white background; caption language | **FIXED-AND-VERIFIED** (`KnowledgeImageCaptionClassifier.cs:66-73, 105-109`; `DocumentPageRasterizer.cs:101, 134, 177`) |
| **C9** replay page/anchor | Anchor **VERIFIED**; page **REGRESSED** for non-paginated sources (**P4-B-08**) |
| **C10** lazy-load/srcset/`<picture>` | **FIXED-AND-VERIFIED** (`KnowledgeDocumentParser.cs:1702-1784`); TIFF frames — owner-ruled, not re-raised |
| **C11** alt-text card only for a stored picture | **NOT FIXED** — unreachable from the lane (**P4-B-07**); the test pins `BuildCards` in isolation |
| **C12 / C12-L** | **FIXED-AND-VERIFIED** in code (`:2156-2179`) and live (phase-3 AUDIT §13.7: `be07d747` carries a picture description). The same gate misfires on transient failures (P4-B-14) |
| **L-1** two-column facts never deleted | Measured shape **FIXED-AND-VERIFIED** (layout-before-loss `DocumentTranscriptComparer.cs:69-79, 430-435`; conservation `:629-659`, `VisionDocumentTranscriptionService.cs:715-747`; live 2B of LIVE-ACCEPTANCE-2026-09-12). **New deletion paths: P4-B-01 (Critical), P4-B-17, P4-B-18** |
| **L-2** Gujarati: unreadable OCR yields; AnsweredNotOnPage vs no answer | Separation from transport failure **VERIFIED** (`IDocumentTranscriptionVerifier.cs:56-57`), live PNG/PDF proof (LIVE-ACCEPTANCE-2026-09-12 §1, §2C). **But "answered" also swallows unreadable/over-length (P4-B-01); clause 3 holds only where a check was bought (P4-B-05); text-layer trust (P4-B-19, NLP)** |
| **L-13** photographed lists described | **VERIFIED** |
| **L-14** verifier alerts fire | **VERIFIED** (`VisionDocumentTranscriptionService.cs:379-383, 578-583, 624-645`); a dropped unit alerts at Low (P4-B-33) |
| **P2-A** machine reading decides characters only where the page prints them | **FIXED-AND-VERIFIED** for cell corrections (`:670, 686-706`; live 09-12). **Not applied to restores (P4-B-05)**; text-layer caveat (P4-B-19) |
| Source check renders its own page (96/96 → 0/96) | **FIXED-AND-VERIFIED** (`DocumentTranscriptionVerifier.cs:124-135`; `DocumentTranscriptionVerifierTests.cs:229-262`) |
| `MaxRepairWordLossPercent = 25` | **VERIFIED** (class `VisionTranscriptionSettings.cs:68`, Functions `appsettings.json:1398`, clamp 50 `DocumentTranscriptComparer.cs:658`). Missing from the cache policy (P4-B-22) |
| Page cache key carries code identity (AdjudicationPolicyVersion deleted) | **VERIFIED** (`VisionDocumentTranscriptionService.cs:45-49`; no `AdjudicationPolicyVersion` anywhere); dials half incomplete (P4-B-22) |
| **E12** continuation (D + G) | Mechanics **VERIFIED** (`:787-798, 3276-3299`; `VisionDocumentTranscriptionService.cs:344-350`), live (PROGRESS-SESSION2 §6.1). **P4-B-09** (ForceFresh / continuation intent), **P4-B-27**, **P4-B-23**, **P4-B-36** |
| **E12-E** `_di` bank | Write/read/fail-soft/purge **VERIFIED** (`KnowledgeExtractionCache.cs:53-123`; `KnowledgeDocumentDataPurger.cs:101-107`), live row 5b. **P4-B-16** (stale result id) |
| **E13** cache write off the budget token | **VERIFIED** (`VisionDocumentTranscriptionService.cs:262-268`) |
| TIFF only frame 1 stored | Owner-ruled — not re-raised |
| Transcription alert gating | **VERIFIED**: own gate `EnableDocumentTranscriptionVerificationAlerts` (default true, `AdminAlertSettings.cs:64`); Service Bus `forceAdminAlert: false` (`TranscriptionVerificationAlerts.cs:61-62`), the owner's §7.15 ruling ("exactly what the other ~114 sites guarantee") |
| **X-07** raised image cap re-extracts | **VERIFIED** (`:707-709`) |
| **X-08** orphan conservation class | **VERIFIED** deleted |
| **E7 / R-9** (the vision/picture half) | **P4-B-02, P4-B-03, P4-B-30** |
| **P3-A** (drafts decided rows) | Out of this dimension; purge of decided rows seen in passing (`KnowledgeDocumentDataPurger.cs:83-85`) |

---

## 4. Verified OK (checked and fine)

1. DI submit retries transient statuses with backoff and classifies after retries (`DocumentIntelligenceService.cs:575-627`); the poll treats 429/5xx as a wait and honours Retry-After, capped (`:1194-1201, 1156-1162`); the poll budget scales with pages, and the URL seam gets the ceiling (`:1170-1177, 462-478`).
2. Retryable exception → scheduled retry, attempt carried, exponential and capped (`KnowledgeIngestProcessorFunction.cs:336-362, 441-451`); terminal refusals complete the message (`:322-329`).
3. Page cap enforced four times: pre-count (`:1431-1453`), DI count (`:1476-1482`), post-extraction on both paths (`:770-777`), rasterizer (`DocumentPageRasterizer.cs:124, 146`).
4. Decode bombs are bounded before decode on every image path: normalizer identify + scaled JPEG (`KnowledgeImageNormalizer.cs:84-115`), rasterizer identify (`DocumentPageRasterizer.cs:163-164`; TIFF caveat P4-B-32), PdfPig samples ceiling before `TryGetPng` (`KnowledgeImageExtractor.cs:577-585`), data URIs by length (`KnowledgeDocumentParser.cs:1808-1809`), remote re-encode (`RemoteImageIngestionService.cs:451-452`), per-image/per-document media bytes (`VoiceKnowledgeSettings.cs:345-356`).
5. EXIF orientation: a JPEG with EXIF is never passed through (`KnowledgeImageNormalizer.cs:123`) and is `AutoOrient`ed (`:142`); the rasterizer auto-orients too (`DocumentPageRasterizer.cs:174`). CMYK/YCCK is re-encoded to YCbCr (`:117-121, 169-171`). Metadata is stripped, including PNG text and the JPEG COM segment (`:143-147, 186-227`).
6. Animated GIF/WebP → first frame (`KnowledgeImageNormalizer.cs:133-140`); owner-ruled.
7. Rotated PDF pages: PdfPig's inverted rotated rects are normalised (`KnowledgeImageExtractor.cs:518-527`); the transposed DI frame is tried (`:97-119, 336-388`); an unrecognised frame falls back to the crop rather than a wrong picture.
8. Whole-page figures and whole-page natives are filtered, and counted once per page (`KnowledgeImageExtractor.cs:147-160, 436-461`).
9. Figure anchors are carried back in reading order, exact before containment (`PageMarkdownSplicer.cs:59-96`); transcripts cannot smuggle page breaks or figures (`:39-40`).
10. The comparer: one line per unit (`DocumentTranscriptUnits.cs:72-106`); the dash-range and Indic word-character rules (`DocumentTranscriptComparer.cs:888-930`); money matched by amount, not spelling (`:139-152`); ambiguous locale ⇒ dispute, never silent equivalence (`DocumentValueEquivalence.cs:183`).
11. The verifier never names the competing readings (`DocumentTranscriptionVerifier.cs:137-173`); duplicate/foreign ids are rejected (`:199-236`); a transport failure is a failure, never "not on page" (`IDocumentTranscriptionVerifier.cs:56`).
12. P2-B leading-span tiebreak (`VisionDocumentTranscriptionService.cs:439-460`); Correct never writes a span that loses words (`:715-747`); offsets applied back to front with overlap refusal (`:794-815`).
13. Per-page vision failure is fail-soft; AI-client timeouts surface as `TimeoutException`, so a one-page timeout degrades only that page (`AICompletionService.cs:590-600`; `VisionPageTranscriber.cs:77-83`). `NO_TEXT` is a blank page and not a degradation (`VisionPageTranscriber.cs:64-65`; `VisionDocumentTranscriptionService.cs:202`).
14. Fan-out is thread-safe: per-slot arrays, `Interlocked` counters, `ConcurrentBag` (`VisionDocumentTranscriptionService.cs:109-121, 216`); disposables are scoped.
15. The `.webp/.gif`, PDF-with-figures and binder-failure returns carry every vision field (`KnowledgeIngestProcessorFunction.cs:1405-1418, 1518-1533, 1546-1560`); the replay is the only hand-built reading (guard `KnowledgeExtractionOutputCopyTests`).
16. The image lane is fail-soft as a whole, with an alert (`:1748-1767`); a single image failure degrades alone (`:2255-2261`); tombstones leave before the cap and survive the merge (`:1978-1984`; `KnowledgeImageStore.cs:213-224`); ranking is by area with refill (`:2034-2047, 2084-2101`).
17. Every Cosmos read in the lane is partition-scoped (`BuildBusinessImageMapAsync` → `ListAsync(businessId)`, `:2821`).
18. The summary fact-check drops only unsupported-figure sentences and ships a clean summary byte-identical (`KnowledgeSummaryFactCheck.cs:21-47`).
19. Rasterization runs outside the budget, and the budget is derived from the delivery deadline minus the reserve (`VisionDocumentTranscriptionService.cs:123-127, 344-350`).

---

## 5. Reasoned scenarios the brief asked for (file:line, no execution)

- **Password-protected PDF.**
  - Pre-count: PdfPig throws and returns `null` (`DocumentPageCounter.cs:14-22`), which raises a capacity alert saying DI "bills every page".
  - DI then fails. Only a DI answer with the code `PasswordProtected` yields the password sentence (`DocumentIntelligenceService.cs:1148-1149`); a 400/`InvalidContent` yields "unreadable" (P4-B-31, NLP).
  - PDFium cannot open it either, so the rasterizer marks it Unrenderable, but the terminal fires first.
  - An owner-password-only PDF (restricted permissions) opens everywhere and reads normally.
- **30 MB single-page image.**
  - Size is checked before buffering (`:574-583`).
  - JPEG above 40 MP: the normalizer scale-decodes it (stored and captioned) but vision refuses it (P4-B-04); the provider sees the false "ran out of time" notice (P4-B-02/03).
  - PNG above 40 MP: the normalizer refuses it too, so the picture is lost (Degraded, notice "couldn't be read"), and vision also refuses; DI OCR is the only reading.
- **100-page scan.**
  - Pre-count and DI count allow 100 pages. Rasterization renders all 100 pages at 1024 px before each pass (about 15–30 MB).
  - Each pass gets min(900 s, deadline − 180 s). E12 allows ≤ 8 continuations, gated on progress.
  - Up to 8 checks per pass (P4-B-23). Pages beyond the checks are settled `WithoutEvidence`: a non-Latin scan restores OCR soup there (P4-B-05).
  - Whole-page figures are filtered. Source-kept pages are re-bought on every pass.
- **80 % pictures.**
  - The parser holds up to `MaxTotalMediaBytes` (256 MB) of sources.
  - The cap keeps the 40 largest by area; captions run sequentially (P4-B-29).
  - Picture transcription stops after 5 successes, but attempts are bounded only by 40 (P4-B-26).
  - A metafile among them blocks retirement for good (P4-B-10).
- **Rotated pages.** Handled for figure binding (Verified-OK 7). A sideways scan is sent to vision sideways (Improvement 3).
- **Transparent PNG.** Stored as PNG with its alpha; captioned and rasterized on white (Verified-OK 5, C8).
- **CMYK JPEG.** Re-encoded to YCbCr (Verified-OK 5).
- **Truncated or corrupt JPEG.**
  - With a readable header and no metadata it passes through byte-for-byte and is never fully decoded (`KnowledgeImageNormalizer.cs:123-129`).
  - The caption re-decode then fails and returns `Undescribed`, which triggers the P4-B-14 path (a DI transcription attempt, TopUp `CaptionRefused`); the thumbnail derivative may fail later.
  - Corrupt beyond the header: Degraded (lost), with an alert.
- **Animated GIF.** First frame (owner-ruled).
- **Vision on one page vs the whole budget.**
  - `NO_TEXT`: a blank page — it keeps OCR, is cached, and is not counted as banked.
  - Empty completion, refusal (400), or timeout after retries: the page fails and keeps its OCR (`PagesUnread` notice, plus the false `RanOutOfTime` from P4-B-02).
  - Throttle after retries: the same (P4-B-21).
  - Whole budget spent: `BudgetExhausted`; E12 continues, or the document settles with the whole DI text and the (correct) `RanOutOfTime` notice.
  - All pages fail: DI text is published, degraded; if the DI text is empty, the document ends terminally (P4-B-13).

### Cost per document — every AI call a worst-case document can trigger (deployed settings)

| Call | Bound | Setting | Holds? |
|---|---|---|---|
| DI analyze (main) | 1 per reading, banked for continuations and re-reads | `_di` bank | Yes (stale crops: P4-B-16) |
| DI analyze (`.webp/.gif`) | 1 per pass, not banked | — | Minor |
| DI analyze (picture text) | 1 per **attempt**, not banked | `MaxTranscribedPictures` = 5 claimed | **No** — ≤ 40 (P4-B-26) |
| Vision page (luna, Medium, 6000 tokens) | Pages × (1 + `MaxConservationRetries` 1) × (+1 cut-off retry) per pass, cached pages skipped | `MaxPagesPerDocument` 100, `MaxReadingContinuations` 8 | Yes, but source-kept pages are re-bought every pass (P4-B-23) |
| Source check (sol, High, 8000 tokens) | 8 per pass | `MaxVerifiedPagesPerDocument` 8 | **No** — up to 72 per reading (P4-B-23), plus ≤ 1 per picture-text attempt |
| Describe (luna) | 1 (+1 cut-off retry) on the final pass only | — | Yes |
| Captions (luna, 1500 tokens) | ≤ 40 per fresh lane (+ cut-off retries) | `MaxImagesPerDocument` 40 | Yes, but re-paid on every re-extraction when every picture is grounded (P4-B-24) |
| Top-up captions (replay) | ≤ pending pictures | — | Yes |
| Everything | `AiAttemptBudgetPerDocument` 6000 (1200 per delivery) | — | Partially — exhaustion is swallowed in four places (P4-B-28) |

---

## 6. Counts

| Severity | Count | Ids |
|---|---|---|
| Critical | 1 | P4-B-01 |
| High | 19 | 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 16, 17, 18, 19, 20, 21 (08, 10, 11, 12, 13 and 16–21 are High by the owner's extraction ruling rather than by blast radius) |
| Medium | 6 | 15, 22, 23, 24, 25, 26 |
| Low | 10 | 27, 28, 29, 30, 31, 32, 33, 34, 35, 36 |
| Improvement | 1 (grouped, 6 items) | 37 |
