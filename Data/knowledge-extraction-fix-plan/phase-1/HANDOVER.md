# Phase 1 — handover

**Phase 1 of 4 of the AI Knowledge extraction fix programme: "read the document right" — parsers, passages,
the image lane, the vision judge.** Built 2026-09-11. Nothing committed, pushed or deployed by this session.

Read with `AUDIT.md` beside it: the audit carries the per-finding closure table, the adversarial battery, the
sabotage sweep, §15 (the hyphen, raised by the owner mid-phase and fixed) and the five open questions. This
file is what changed, where the evidence is, and what the owner has to do next.

---

## 1. State

| | |
|---|---|
| Unit tests | Communications **4,307** · API **11,946** · MCP **918** — all pass, 0 skipped |
| Table harness | `C:\Nik\knowledge-table-hunt` → **103/103** (was 84/88) |
| Builds | core, shared, infrastructure, Functions, API, MCP — **0 errors** |
| Live | the 17 retained `SX3SG2` artefacts replay through HEAD with **0 words lost, 0 invented** |
| Tree | `git status --porcelain` carries only deliverables — 3 new files, 3 deletions, no scratch file in any repo |

---

## 2. What changed, file by file

### `clinqetcore`

| File | Change |
|---|---|
| `Interfaces/AI/IDocumentTranscriptionVerifier.cs` | **`AnsweredNotOnPage(regionId)`** — "the third reader answered, and the value is not on this page" is no longer the same null as "no answer". This one distinction is L-2. |
| `Interfaces/AI/IVisionDocumentTranscriptionService.cs`, `Services/AI/VisionPageTranscriber.cs` (+ its interface) | `ForceFresh` threaded through; the machine reading is handed to the model with a partial flag. |
| `Interfaces/Knowledge/IKnowledgeImageCaptionClassifier.cs` | `documentLanguage` — the description is written in the language the provider and the caller share. |
| `Models/AI/DocumentTranscriptComparison.cs` | `SourceRestoreText`, `IsCellValue`, `LayoutDifferences`, `TranscriptLayoutDifference(Location, Reason, SourceText)`. |
| `Models/Knowledge/KnowledgeTokenEstimate.cs` | **NEW.** ONE chars-per-token factor (Latin 4 · dense CJK 1 · cluster 1.6), used by the chunker AND `ProviderKnowledgeSearchService.TrimToTokenBudget`. Two copies of that rule was B3. |
| `Models/Knowledge/KnowledgeBlocks.cs`, `KnowledgeChunk.cs`, `KnowledgeContentArtifact.cs` | `ImageNeighbourText` (C4), `Paginated` (B2), `Page`/`AnchorPath` on `KnowledgeArtifactImage` (C9). |
| `Models/Knowledge/KnowledgeText.cs` | **EX-32, the hyphen.** `Dehyphenate` (typed lanes) now joins and **KEEPS** the hyphen — `anti-` / `ageing` is `anti-ageing`, not the non-word `antiageing`; `DehyphenateRenderedPage` (OCR / vision / photo) **drops** it, guarded by a typographic minimum of 3 letters and by the document's own spelling. Only a hyphen break is joined — every other newline survives. |

### `clinqetshared`

`VisionTranscriptionSettings.cs` — `MaxRepairWordLossPercent` = 25 and `AdjudicationPolicyVersion = "2"`
folded into `ValidationFingerprint`, so every page banked under the old policy is re-verified.
`VoiceKnowledgeSettings.cs` — `Images.MaxTranscribedPictures` = 5.
`Enums/TranscriptionVerificationDisposition.cs` — four new members for the new outcomes.

### `clinqetinfrastructure`

| File | Change |
|---|---|
| `Services/AI/DocumentTranscriptComparer.cs` | `PageFacts` (a bounded token multiset of B's page) · Rule 1 gated on `shapeDiffers` · a flattened claim for `ContentMissing` (a claim carrying `<tr>/<td>` tokens used to be dropped) · `Group()` merges every source line sharing one candidate unit · `ConservesWords` · `AddedValues` compares amounts through `KnowledgeFigures.Numbers`. |
| `Services/AI/VisionDocumentTranscriptionService.cs` | `Reference()` whole-line prefix + partial flag · `ForceFresh` bypasses the page cache · `WithoutEvidence()` · `Restore()` · `Correct()` · `ShorterThanTheRegion` · `PublishLayoutAsync` · `pageRevert` needs `resolvedToSource >= 2` and every group resolved that way. |
| `Services/AI/TranscriptionDisputeIndex.cs`, `TranscriptionVerificationAlerts.cs` | `RemainingUncertainty != null` is the single authority for "unconfirmed". |
| `Services/Knowledge/KnowledgeOoxmlText.cs` | newline-aware `Flatten` vs collapsing `FlattenInline` (A2) · **`OoxmlNotes`** + `NoteReferenceKey` — a note is inlined `[at its reference]`, keyed `f<id>`/`e<id>` because footnote and endnote ids are separate spaces (A15). |
| `Services/Knowledge/KnowledgeDocumentParser.OpenXml.cs` | `w:tblHeader` · `DeclaresXlsxHeaderRow` accepts a frozen top row · the letterhead is **inserted before the first block**, the footer appended after · `AppendLayoutTableBlocks` · `ResolveHeadingLevel`/`InferredHeadingLevel` · `ListLevel` · `IsOnlyContentInRow` band merges · `DropEmptyLeadingColumns` · `IsDefaultSheetName` (suppressed only on a one-sheet workbook) · per-parse `SkipTally` · VML `v:imagedata` · **`UnclaimedImageParts`** + `IsRasterPart` + `IsDecorationPart` (A18). |
| `Services/Knowledge/KnowledgeDocumentParser.Pptx.cs` | `ZipValueColumnBoxes` (A7) · **`CollectPptxBackground`** · `Refuse()` records a judged part so the sweep cannot resurrect it. |
| `Services/Knowledge/KnowledgeDocumentParser.cs` | `ReadPipeTable` header rule (A5) · `CoalesceValueLineRuns`, `IsOneLineParagraph`, `IsSelfContainedLine` (A1) · `IsAllLowercaseRun` + the all-lowercase refusal (A3) · `MergeThreeLineRecords` (A22) · `IsProseRow` (A9) · furniture strip (A16) · hidden HTML (A13) · **`BestHtmlImageSource`**, `WidestCandidate`, `LastGluedCandidate` (C10) · `IsFetchable` (C6) · scalar-root JSON (X-04); `TryFlattenJson` deleted · `DehyphenateRenderedPage` applied to the whole page before the parse (EX-32). |
| `Services/Knowledge/KnowledgeChunker.cs` | `KnowledgeTokenEstimate` · CJK/Arabic terminators · `ScriptBoundary` · `EndsInABareNumber` (A10) · **`IsLoneCurrencyMark`** (`45,00 €`) · `HoldsAValue` H1 guard (X-03) · a card closes at a page change (X-06). |
| `Services/Knowledge/KnowledgeSearchIndexer.cs` | byte-bounded paging (12 MB), 413 ⇒ halve-and-split, 413 excluded from `IsIsolatable` (B1). |
| `Services/Knowledge/KnowledgeImageNormalizer.cs` | `IsVectorMetafile` — EMF + three WMF headers (C5). |
| `Services/Knowledge/KnowledgeImageCaptionClassifier.cs` | white background before captioning; `documentLanguage` + `LanguageRule` (C8). |
| `Services/Knowledge/KnowledgeTranscriptConservation.cs` | **DELETED** — orphaned, no production caller (X-08). |

### `clinqetfuncations`

`Functions/KnowledgeIngestProcessorFunction.cs` — a picture that reads as text is **transcribed** and its
text spliced in at the picture (`TranscribePictureTextAsync`, `WithPictureText`, C3) · in-run caption reuse
keyed on **(fingerprint, grounding)** (C7) · `metafileSkipped` counted as Bounded (C5) · the C7 Sendable
rules on both paths + `Previous()` · the alt-text card gated on a stored ref (C11) · `Paginated` (B2) ·
`forceFresh` and `documentLanguage` threaded through.
`Services/KnowledgeDocumentFormats.cs` — `.tif` added, `.heif`/`.heic` removed (ImageSharp decodes neither).
`appsettings.json` — `MaxTranscribedPictures`, `MaxRepairWordLossPercent`.

### `clinqetapi`

`Clinqet.API/appsettings.json` — `MaxRepairWordLossPercent` = 25 under
`AIAssistant:ProviderAttachmentProcessing:Vision`; `.tif` beside `.tiff` in **both**
`StorageConfiguration:ProviderKnowledge` and `…:ProviderSetupDocuments` (the pipeline read `.tif` while the
upload gate refused it).
`Clinqet.API.UnitTests/Services/AI/ProviderSetupImageServiceTests.cs` — two Moq callbacks widened for the
extra caption parameter. A compile-required edit, which §0.18 rule 3 leaves where compilation forces it.

### Tests added

`DocumentTranscriptionAdjudicationTests.cs` (renamed from `VisionTranscriptConservationTests.cs`, 43) ·
`KnowledgePictureTextTests.cs` (NEW, 9) · 5 A15 + 7 A18 cases in `KnowledgeExtractionFidelityTests.cs` ·
7 C10 cases in `KnowledgeDocumentParserTests.cs` · 2 C7 cases in `KnowledgeIngestProcessorFunctionTests.cs` ·
`KnowledgeSearchIndexerIsolationTests.cs` byte-paging + real-vector split ·
`KnowledgeTranscriptConservationTests.cs` **DELETED** with its subject.

### Tools (not product code — `Data\knowledge-extraction-audit\tools\`)

**`kreplay`** is NEW: `kreplay --all <evidenceRoot>` replays a LIVE artefact's own block stream through the
HEAD chunker and writes `cards-HEAD.txt` beside it. Real Document Intelligence + vision output, no deploy.
`kaudit\Live.cs` — the alerts probe now also matches `c.metadata.transcriptionVerification.source.documentId`
(this is what made L-14 look real). `C:\Nik\knowledge-table-hunt` — `HarnessAlerts.cs` (no-op alert
implementations) so the mandated harness compiles at HEAD; the `NoLabelBinding` check; group **ADV** (13).

---

## 3. Nothing was deferred

Every in-scope finding is closed in code. **Five items are open QUESTIONS, not deferrals** — none has the
owner's acceptance, and each is stated with its cost and my recommendation in `AUDIT.md` §11:

1. the cross-document caption-reuse field (§0.7) — **recommendation: do not add it**;
2. `.csv` / legacy binary Office / macro-enabled Office — **recommendation: add `.csv` in Phase 2**;
3. a multi-frame TIFF's pages 2..n as sendable pictures — **recommendation: leave it**;
4. the five §9 declared limits — **recommendation: keep four, fix the hyphen one**;
5. one wrapped lowercase name in an all-lowercase run stays split — **recommendation: accept, knowingly**.

---

## 4. Where the evidence is

| Path | What |
|---|---|
| `phase-1\AUDIT.md` | all 13 audit dimensions |
| `phase-1\baseline\` | the HEAD-at-session-start reading of 33 corpus + complicated fixtures, plus `table-hunt-BEFORE.txt` (84/88) |
| `phase-1\after\` | the same 33 files read by this phase's code, plus `table-hunt-AFTER.txt` (103/103) |
| `phase-1\live-replay\` | `CONSERVATION.txt` + 17 `cards-HEAD.txt` — HEAD's reading of each live artefact |
| `evidence\ca-live-batch\` | the deployed pipeline's own output of 2026-09-10 (`artifact.json`, `cards.txt`, `row.json`, `drafts.json`) — **the before-state; do not overwrite it** |

---

## 5. Live proof after the deploy — the exact runbook

Deploy order (memory `feedback_owner_pushes_and_deploys`): **shared → core → infrastructure → Functions →
API**. Then, from `C:\Nik\Data\knowledge-extraction-audit\tools\kaudit`:

```
dotnet run -- reprocess ca SX3SG2 <docId>          # once per fixture; the row is CAS'd to Processing
dotnet run -- wait      ca SX3SG2 <docId> 900
dotnet run -- pull      ca SX3SG2 <docId> C:\Nik\Data\knowledge-extraction-fix-plan\phase-1\live-after\<name>
dotnet run -- alerts    ca <docId>
```

The 17 docIds are in `PLAN.md` under "Owner rulings"; the folder names in `evidence\ca-live-batch\` carry
their first eight hex characters. **Never delete these 17 documents before Phase 4.**

Then compare, per document:

1. `cards.txt` new vs `evidence\ca-live-batch\<doc>\cards.txt` — the deployed before-state.
2. `artifact-blocks.txt` `## reviews` new vs old — this is where L-1 and L-2 must visibly change:
   `pdf_two_column_prose_resume` carried **9 discrepancies** with `ResolvedToSourceReading`, and
   `pdf_hindi_gujarati_english_pricelist` carried **5 `SourceReadingRetained` with "no usable source
   reading"**. Neither shape may reappear.
3. `kaudit alerts ca <docId>` — an alert on a real remaining uncertainty is correct; an alert about a lost
   EMF/WMF picture or an unfetchable remote `<img>` is a regression (C5/C6 made both non-losses).
4. `kaudit drift ca` — row `passageCount` must equal the index count for every document (L-12).

Also heal the owner's own picture:

```
dotnet run -- reprocess ca MEE3IC be07d747c73944a587a3a1029cb5717f
dotnet run -- pull      ca MEE3IC be07d747c73944a587a3a1029cb5717f <outDir>
```

`gopi.jpeg` must come back with a description **and** its transcribed text (C12/C12-L): the fix gives an
`Unclassified` picture with no caption the same reading chance a `text_snapshot` gets.

**Why this session could not run it:** `kaudit reprocess` posts a Service Bus ticket that the **deployed**
host consumes with the **old** code. A local in-process host run would mean duplicating 1,118 lines of the
host's DI registration, and the Service Bus connection string may not be copied into a
`local.settings.json`. What could be proven without a deploy was proven — see §4 and `AUDIT.md` §5.

---

## 6. Open questions for Phase 2

0. ‼️‼️ **THE WRAPPED SERVICE NAME (D10) — Phase 2 must close this or get it explicitly accepted.** A draft
   is named `french tips` when the document says `gel manicure with french tips`. The caller's answer is
   correct ($45 — the receptionist reads the whole card); the DRAFT NAME is not. The parser cannot decide it
   (`gel manicure with` / `french tips` / `$45` is byte-identical to `services` / `haircut` / `$25`), but
   the drafts lane can, because `BuildExtractorText` already marks a real section as `## <section>` — a
   marked heading and a bare line are different inputs there. The actual defect: `ExtractorLine` emits one
   line per CANDIDATE, a candidate must carry a price, so `gel manicure with` never reaches the model at
   all. Carry the candidate's preceding line when it is neither a candidate nor a heading. Full statement
   with the data in `PHASE-2-PROMPT.md` §1A.2 and `AUDIT.md` §11.5. Harness case ADV08.
1. **E1 / F-01 conflict (prior #4).** A failed replacement takes the previous valid document offline.
   `TRIAGE-AND-STATUS.md` records "owner said to ignore it"; `FINDINGS-2026-09-10.md` raises it as 🔴 E1 with
   decision R-4 "Do it". **The two rulings contradict each other and only the owner can reconcile them.**
2. **X-02** — the setup/draft extractor prompt (`DocumentIntelligenceService.cs`) still interpolates raw
   document text with no trust boundary, while the voice, caption and Business Search prompts all have one.
   Phase 2 owns it.
3. **X-05** — `FingerprintMatches` returns true when `expected` is empty, so a two-part material ref is sent
   unchecked. A pre-production back-compat path that §22.10 would now delete.
4. **X-07** — a settings-only change never invalidates the artefact, so a raised image cap cannot recover
   pictures a previous run dropped. Deliberate today; Phase 2 should decide whether the cap belongs in the
   fingerprint.
5. **The five §9 declared limits and the four §11 questions above** need the owner's ruling before Phase 2
   can treat any of them as closed.
6. **`.csv`** — if the owner says yes, it is Phase 2 work: a delimiter/quote/encoding reader feeding the same
   block stream, which then inherits every rule this phase built.
