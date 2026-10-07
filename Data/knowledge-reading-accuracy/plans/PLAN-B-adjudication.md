# Plan: page-reading adjudication fix (design only, nothing edited)

All line numbers below are from the current tree, read 2026-10-02.
Abbreviations: **VDTS** = `clinqetinfrastructure/Services/AI/VisionDocumentTranscriptionService.cs`, **CMP** = `DocumentTranscriptComparer.cs`, **UNITS** = `DocumentTranscriptUnits.cs`, **VER** = `DocumentTranscriptionVerifier.cs`, **IVER** = `clinqetcore/Interfaces/AI/IDocumentTranscriptionVerifier.cs`, **IVDTS** = `clinqetcore/Interfaces/AI/IVisionDocumentTranscriptionService.cs`.

---

## 0. The design in one page

### 0.1 The rules every fix follows
- **P1. Who decides what.** The machine reading (DI) decides structure and presence: which cells and rows exist, and whether a cell is blank. The file's own text layer, when it can be trusted, decides characters. The AI reading decides layout, reading order, and characters on scans. A paid check only settles what those three could not.
- **P2. A page is never reverted.** Every decision is made per difference and written into the AI page's structure. There is no page-level "keep the machine reading" path left, except a blank or failed AI page.
- **P3. Count-aware, consuming coverage everywhere.** A token one unit has claimed can never cover another unit.
- **P4. Structure is classified before characters are settled.** Merged cells, side labels, re-shaped tables, moved blocks and echoes are found first. Only then does the text layer, the check, or the peer rule decide spelling. Otherwise a merged-cell polygon would "confirm" DI's merge.
- **P5. Bounds limit spending, never content.** Every difference is listed. Bounds only limit how many get a paid check. Anything left unchecked is decided by the free rules and reported.
- **P6. Two phases per document.**
  - Phase 1: transcripts for every unit (raw bank).
  - Phase 2: allocate the paid checks deterministically, buy them, decide, write back, bank the decision.
  - Assembly stays as it is.
- **P7. "Unsettled" only when a reading carries a digit** (F-20). Text-only doubts stay on the page's review record but never alert.

### 0.2 New components (all `internal`, folder `clinqetinfrastructure/Services/AI/Reading/`)

| File | Types / entry point | Job | Version group |
|---|---|---|---|
| `PageStructureReader.cs` | `PageStructure`, `StructureTable`, `StructureRow`, `StructureCell(Column, Text, Span, RowSpan, ColumnSpan, CellRole{Anchor,Covered}, Box?, Confidence?)`, `StructureLine(Kind, Text, Span, FigureOrdinal?, Box?, Confidence?)` | Reads page text into a grid. Honours HTML rowspan/colspan, reads pipe tables and figure text (AS-03), and gives scripts with no word spaces one token per grapheme | Adjudication |
| `PageGeometry.cs` | `PageGeometry.For(DocumentSourceEvidence, page, PageUnit)`, `AttachTo(PageStructure)` | Matches markdown tables to evidence tables by cell text. Attaches cell, line and word polygons (inches×72 → points; pixels for pictures) and word confidence | Adjudication |
| `PageTextLayerReader.cs` | `ReadAsync(IDocumentPageRasterizer, …)` → `PageTextLayer(Text, IReadOnlyDictionary<RegionKey,string> Inside)` | Reads the PDF's characters inside every cell, line and sampled word box in one PDFium batch, without drawing | **Render** |
| `TextLayerAuthority.cs` | `Trust(...)`, `Rebuild(machine)`, `Settle(difference)` | Trust test, rebuild of the machine's characters, free settlement (F-16) | Adjudication |
| `TokenLedger.cs` | `Claim`, `Covers`, `Remaining` | Consuming multiset (F-05) | Adjudication |
| `PageAligner.cs` | `PageAlignment Align(machine, ai, AlignmentLimits)` | Matches tables first, then rows inside each table (monotone DP with 1:k merges), cells inside each row (gap-aware DP), prose lines (monotone DP + absorption), then block-move tiling | Adjudication |
| `PageDifference.cs` | `PageDifference(Kind, Layout?, MachineRef, AiRef, Tokens, Field, CarriesDigit, CarriesMoney)` | The typed differences: `CellValue`, `CellPresence{MachineOnly,AiOnly}`, `RowLost/RowGained`, `LineLost/LineGained`, `TokensInserted/TokensDeleted`, `ValueMoved`, `Layout{Decoration,MergedCells,AbsorbedWords,ReadingOrder,Echo,ReShaped,TableAsProse,FigureCarried}` | Adjudication |
| `ReadingScope.cs` | `InScope(scope, difference)`, `IsMoney`, `CarriesMoney` | One money definition built on `KnowledgePriceMarks` (F-24, CS-01) | Adjudication |
| `AttemptMerge.cs` | `Merge(t1, cmp1, t2, cmp2)` | F-15 | Adjudication |
| `CheckQuestions.cs` | `CheckQuestion(Id, Shape{Cell,Row,Passage,Presence}, Handle, Box?, ExpectedTexts)` | Questions with a unique handle and a box, no ordinals (F-06) | Adjudication |
| `CheckAnswers.cs` | `Parse(raw, questions)`, `Narrow(answer, question)` | Reads the answer state per region, narrows over-wide answers (F-03, F-18, F-25) | Adjudication |
| `CheckAllocation.cs` | `Allocate(units, budget, maxCallsPerUnit, perCall)` | Deterministic choice of which units get paid checks (F-21) | Adjudication |
| `PageRuling.cs` | `Decide(alignment, layer, answers, scope)` → `Ruling(value, disposition, uncertainty)` | The decision table in 0.4 | Adjudication |
| `PageWriteBack.cs` | `CellEdit`, `RowInsert`, `LineInsert`, `TokenRemove`, `TokenRestore`, `CaptionInsert`, `UnitFallback` | Writes rulings into the AI page's structure and renders markdown (F-09, AS-08) | Adjudication |
| `PageConservationAudit.cs` | `Check(machine, ai, published, review)` | Every digit in either reading is published or explained by a review entry. Otherwise the unit falls back and `ReadingRuleFallback` is recorded | Adjudication |
| `ReadingPrompts.cs` | `Reference`, `Grounded`, `WithoutBoxMarks` (moved from VDTS L1127-1157), `ReaskText` | Builds what the model is shown | **Render** |
| `PageReadingRawKeys.cs`, `PageReadingRawBank.cs` | §2 | The raw bank | **Render** (keys) / Adjudication (bank I/O) |

### 0.3 Data flow after the change (VDTS)

1. Inspect (unchanged).
2. For each page, read the decision entry. It is valid only if `Policy == {ValidationFingerprint}:v{Adj}:r{Render}`, `Inputs == SHA(machine page markdown | scope | price-labels hash | quarter turns | unit key)`, and the epoch rule holds. A hit replays with no drawing.
3. **Phase 1** for each miss, as a page or section unit:
   1. Read the text layer without drawing.
   2. Build the reference exactly as today (`Grounded` + `Reference`).
   3. Derive the raw key for attempt 1. Take it from the bank, or draw and buy it.
   4. Post-process: `Sanitize(StripCodeFence(raw))`.
   5. Build both structures, align, classify, settle free from the text layer.
   6. Re-ask only on pages without a trusted layer, and only when lost units remain. `AttemptMerge` takes attempt 2 only where it helps.
   7. Keep the remaining disputes, each with a risk score.
4. **Phase 2** runs only when every unit has finished phase 1. If not, return `BudgetExhausted` exactly as today.
   1. **2a.** `CheckAllocation` chooses which units get paid checks. For each chosen unit, answer questions from per-question raw blobs first, group the rest into calls, then bank each call and each per-question answer. A budget cut here leaves no decisions written; the next pass allocates identically and reuses the banked answers.
   2. **2b.** `PageRuling` → `PageWriteBack` → `PageConservationAudit` → write the decision entry.
5. Assembly: `CarryFigures` (with AS-03 changes), stitch, `Join`.

`OversizePageReader.ReadAsync` (L199-266) is split into three parts:
- `PrepareAsync`: machine readings (DI), carried headers, baselines, compositions, keys. The section's region reading stays banked under `_regions/` as today.
- Phase-1 section transcripts, through `ISectionReadingLane.TranscribeAsync`.
- `Stitch(prepared, decidedTexts)`, called after phase 2.

### 0.4 Decision table (`PageRuling`)

Rows are applied after structural classification. "Report" names the outcome item (§3).

| Difference | Trusted layer | Paid check | No evidence | Report |
|---|---|---|---|---|
| Layout (any reason) | – | never asked | AI kept. A side label the AI lacks becomes a caption line before its table (count-aware) | none |
| CellValue / LineValue (1:1, both non-empty) | the layer text inside the machine polygon decides → `SettledByTextLayer` | 2 of 3 agree → `ResolvedTo*`. On target but matches neither → `UncertainThirdReadingUsed` | Scan → AI (`CandidateReadingRetained`). Born-digital without a polygon → page-level layer containment (count-aware) → else AI. If ≥2 checks on the page all resolved to the machine reading → machine (`PageRetainedSourceReading`) | unconfirmed → ValueUnconfirmed, only if a reading carries a digit |
| CellPresence machine-only (F-12) | layer empty (and the polygon holds no form field or image) → blank; layer has it → keep | Blank/NotOnPage → blank; Text → keep | keep the machine value → `SourceReadingRetained` | ValueUnconfirmed |
| CellPresence AI-only / TokensInserted (F-03, F-13) | layer has it → keep; layer empty (same guard) → blank | Text with it → keep; Blank/NotOnPage/Text without it → blank or remove | blank or remove → `CandidateValueWithheld` | ValueOnlyOneReadingHas ("left out") |
| TokensDeleted (AI dropped words inside a matched unit) | layer decides | evidence decides | machine tokens restored in place → `SourceReadingRetained` | ValueUnconfirmed (digit) |
| RowLost / LineLost (losable, F-11) | layer carries it, unclaimed → restore; layer lacks it → drop (`SettledByTextLayer`) | confirms → restore (`SourceUnitRestored`); NotOnPage → drop; reads other content the AI holds → drop (`SourceUnitUnconfirmed`) | restore in place, with uncertainty | none / LineDropped / ValueUnconfirmed |
| RowGained / LineGained with a digit | layer has it → keep; lacks it → remove (`CandidateUnitNotOnPage`) | money gains always get a question. Text without the value → remove | Kept → `CandidateReadingRetained` with an empty machine reading. Bare digits are asked only when the machine read ≥ `MachineCoverageForGainedValuesPercent` of the AI's words | ValueOnlyOneReadingHas ("published") |
| ValueMoved (across rows or columns) | layer geometry when available | evidence decides | the machine's association (DI = structure) → `SourceReadingRetained`, `Kind = AssociationChanged` | **ValueMoved** (High) |
| Past the question or call bound | free rules first | – | the row above applies, but the disposition is `NotCheckedPastBound` | **ValueNotChecked** |

### 0.5 Contract additions (enum values and blob-only fields; no SQL, Cosmos or Search schema)

- **`TranscriptionVerificationDisposition`** gains `SettledByTextLayer`, `CandidateValueWithheld`, `NotCheckedPastBound`, `ReadingRuleFallback`.
- **`TranscriptDiscrepancyKind`**: delete `ComparisonUnavailable`. Nothing emits it after F-10, and banked reviews are invalidated by the version raise.
- **`TranscriptionVerificationDiscrepancy`** gains `Kind`, `Heading`, `ColumnLabel`, `LayerReading`. These are persisted only in blobs (`CachedPage.Review`, the content artefact).
  - The outcome alert does NOT get new metadata keys. Heading, row and column go into `Location`; the layer reading goes into the description text.
  - Adding keys to `AdminAlert.Metadata` would be an §0.7 question for the owner.
- **`DocumentVerificationReading(string RegionId, RegionAnswerState State, string? Text)`**, with `RegionAnswerState {Text, Blank, NotOnPage, Unreadable, None}`. `DocumentVerificationRequest.Discrepancies` becomes `Questions`. `DocumentVerification` gains `RawContent`.
- **`VisionPageTranscription`** gains `RawContent` and `Usage`.
- **`CachedPage`** gains `Inputs`, `Published {Transcript, MachineReading, Blank}`, `RawKeys`, `ChecksBought`. `Markdown` now always holds the published text (F-28).
- **New settings** in `VisionTranscriptionSettings` (both hosts' `appsettings.json`, class defaults mirrored, all added to `ValidationFingerprint`):

  | Setting | Default |
  |---|---|
  | `TextLayerMinWordAgreementPercent` | 70 |
  | `TextLayerTrustSampleWords` | 40 |
  | `MinLosableWordConfidence` | 0.8 |
  | `MinCellSimilarity` | 0.5 |
  | `MinBlockMoveWords` | 3 |
  | `MachineCoverageForGainedValuesPercent` | 90 |
  | `MaxVerificationCallsPerPage` | 1 |

  `MaxDiscrepanciesPerPage` is re-documented as "questions per page".
- **New rasterizer methods** on `IDocumentPageRasterizer`:
  - `ReadTextInRegionsAsync(byte[], string ext, int page, IReadOnlyList<PageRegion>, CancellationToken)` and `ReadPageTextAsync(byte[], string ext, IReadOnlyCollection<int> pages, CancellationToken)`.
  - Backed by a new `PdfiumDocument.ReadTexts(int page, IReadOnlyList<PageRegion>)`: one page load, bounded text per region, no bitmap, same Lock.
  - Uses the same invisible-layer guard as `RasterizePdfPagesAsync` L120 and the displayed-frame mapping of `ReadText(page,size,region)` (Pdfium L163-191).
  - A raster returns empty strings.

---

## 1. Findings

Each finding uses the same layout: **Root** · **Change** · **Interacts** · **Edges** · **Tests** (new / rewrite).

### F-01 — one region's refusal discards the whole page (company1_home p5, company2_auto p1)
- **Root.** The chain:
  1. UNITS `ReadHtmlTable` L171-197 builds each row only from its own `<td>`s, with no rowspan or colspan. So side-label tables have rows of different widths, and DI's merged cells look like extra columns.
  2. `RowShaped` L1317 returns null.
  3. `Correct` L1276 records the refusal.
  4. `Correct` L1295-1299 returns `true` because `pageIsRecoverable`.
  5. That sets `revert |=` (L1013, L1030, L1253), then `pageRevert` L1047, then `PageDecision(baseline, true)` L1057, then the page is banked as "" (L743-744).
  6. The same rung exists in `WithoutEvidence` L1223-1225 (null → KeptSource L720-727).
- **Change.**
  - Delete `Correct`, `RowShaped`, `SameCell`, `Restore`, `Unsettled`, `WithoutEvidence`, and `PageDecision.KeepSourceReading`.
  - `PageStructureReader` builds DI tables as a grid:
    - rowspan/colspan → an anchor cell plus `Covered` positions;
    - a first-column anchor spanning ≥ the body rows, or a column whose body is all empty or covered → `Layout.Decoration`, excluded from cell alignment;
    - its text → `CaptionInsert` before the aligned AI table, if the AI page does not already carry it.
  - A machine row that cannot be placed falls back for that unit only: it is rendered as a `label: value; …` paragraph straight after its own table, with disposition `SourceUnitRestored` and reason "kept as labelled text".
  - The evidence clause becomes per-dispute (`PageRetainedSourceReading`, see F-22). It never removes AI-only content.
- **Interacts.** F-02 (cells), F-09 (write-back), F-13 (E is block moves and echoes), F-22, F-28.
- **Edges.**
  - A group label spanning rows mid-table (an anchor at column ≠ 0 is never decoration).
  - A side label spanning only the header rows.
  - Full-width colspan section rows are treated like a line.
  - Nested tables flatten.
  - In RTL tables the decoration sits on the right.
- **Tests (new).**
  - `RealCase_Company1HomeP5_AGlossaryReadAcrossColumns_IsReadingOrder_AndNeverReverts`: machine has interleaved paragraph halves plus echoed tails; the AI has clean paragraphs; one check answer is empty. Expected: published = the AI page, 0 checks bought.
  - `RealCase_Company2AutoP1_SideLabelsAndMergedCellsKeepTheAiPage`: 'Rates' side label, a 10-cell merged row against an 8-value AI row, an AI label row, the MSG colspan row against AI bullet prose, and a link cell `F85kQ` whose layer reads `F8SkQ`. Expected: AI page published; "Rates" becomes a caption; the link is `F8SkQ`; the MSG text appears once; no revert.
  - `RealCase_Company2HomeP6_ATotalsSideLabel_NeverRevertsThePage`.
  - `PageStructureReaderTests.ARowspanSideLabel_IsOneAnchorAndCoveredPositions`, `AColspanMessage_IsOneCellNotSix`, `AColumnWhoseBodyIsEmpty_IsDecoration`.
- **Tests (rewrite).** `AConfirmedRowWithMoreCellsThanTheTable_IsNeverWrittenIntoIt` (DocumentTranscriptionAdjudicationTests L119-131) becomes `…_ReplacesOnlyThatTable`. The AI table is missing two machine columns (Mid, Max) and the check confirms the machine's 5 cells, so that table falls back to the machine's 5-column pipe table. Every other unit stays AI, and `AssertEveryTableKeepsItsShape` still holds.

### F-02 — equal-width rows compared by index (company1_auto p2 header)
- **Root.**
  - CMP L389-413 compares equal-width rows cell by cell by index.
  - VDTS L1024-1031 writes `UncertainThirdReadingUsed` into that index.
  - VER L163-169 asks for "the cell in column N" of "the row whose first column reads X". The model counts visual columns (B2).
  - `MarkMovedValues` (CMP L713-735) flags `AssociationChanged`, and the adjudication ignores it.
- **Change.**
  - `PageAligner.AlignCells` is a Needleman–Wunsch alignment over cells:
    - match cost from `DocumentValueEquivalence` / token Dice;
    - gaps for empty or covered cells are cheap (private const, with a one-line reason);
    - decoration gaps are free;
    - substitution is allowed only when similarity ≥ `MinCellSimilarity`.
  - A column map is built per table from the row alignments.
  - A correction whose value already sits in another cell of the same AI row (TokenLedger on the row), or an AssociationChanged inside one row, is a misalignment and is never written.
  - Table-cell questions become whole-row questions (F-06). The answer is aligned three ways, so its position comes from alignment, not from counting.
- **Edges.** Repeated ticks (`✓|✓|✓`): ties are broken by the column map, then by position. Two header rows. RTL rows are also aligned reversed and the better score is kept. Rows wider than 64 columns are bounded.
- **Tests (new).**
  - `RealCase_Company1AutoP2_ASideLabelIsLayout_AndEveryLabelStaysOverItsValue`.
    - Machine: `[Breakdown(rowspan=all), Operator, Principal, TOTALS]` and body `[⟂, Bodily Injury, $1,000,000, $352]`.
    - AI: `[Operator, , Pricing, TOTALS]` and body `[Bodily Injury, , $1,000,000, $352]`.
    - Scan variant: exactly one question; the answer "Operator |  | Principal | TOTALS" gives the published header `| Operator |  | Principal | TOTALS |`, the body is unchanged, and "Breakdown" is a caption.
    - Born-digital variant: the layer inside DI's 'Principal' polygon settles it free, with `_verifier.VerifyNoOtherCalls()`.
  - `AWholeRowAnswerCountedVisually_IsReadByAlignment` (B2): the answer "Breakdown | Operator | Principal | TOTALS" still lands on the Pricing cell.
  - `CellAlignmentTests.{AnEmptyCellIsACheapGap, ASideLabelIsDecoration, RepeatedTicksFollowTheColumnMap}`.
  - `AnAssociationChangeInsideOneRow_IsNeverWritten`.
- **Tests (rewrite).**
  - `AConfirmedRowThatOmitsARepeatedSectionCell_KeepsTheTablesColumns` (L100): same expected output, now produced by alignment.
  - `SwappedPrices_ReachTheSourceCheck_AndTheSourceReadingWins` (L52): the fake answers per row question; still `ResolvedToSourceReading`; the transcriber is called once (no re-ask for value disputes, F-15).

### F-03 — a blank cell can never win (company2_home p7 "Inc.")
- **Root.**
  - IVER L55-56 `Read` drops empty text.
  - VDTS L893-897 `ShorterThanTheRegion` makes an empty answer off target.
  - With `third == null` the dispute goes to `Unsettled` L997-1002.
  - `PageCarries(layer, "")` is false (CMP L600-603), so the result is `CandidateReadingRetained`.
  - NotOnPage is honoured only for missing or added units (L931-990). `Supports` with an empty claim is false (L614).
  - Live, the alert said "the page does not print these characters" on a born-digital page whose layer is blank there.
- **Change.**
  - Answers carry `RegionAnswerState`; `Blank` counts for cell and row-cell questions.
  - The presence rule (table row 3): machine blank plus an AI value → blank, unless the layer inside the polygon or an on-target Text answer carries the value.
  - Count-aware page invariant in `PageConservationAudit`: published copies of a digit token ≤ max(machine copies, layer copies) + confirmed copies.
- **Edges.**
  - **Typed AcroForm values and text inside embedded pictures are absent from the text layer.** Layer-based blanking is therefore allowed only when the polygon intersects no form widget and no image. The widget and image rectangles come from PdfPig (`page.GetImages()`, AcroForm widgets).
  - ✓/–/☒ are marks, not values; ☒ and ☐ are DI artefacts.
  - DI may drop trailing empty cells; alignment gaps absorb that.
- **Tests (new).**
  - `RealCase_Company2HomeP7_AnInventedIncInABlankCell_IsLeftBlank`, with three variants:
    - check answers `blank` → `ResolvedToSourceReading` "";
    - no check → `CandidateValueWithheld`, outcome item "left out", High if digit;
    - layer empty → `SettledByTextLayer`, no call.
  - `ATypedFormValue_IsNeverBlankedByTheLayer`, `AValueInsideAnEmbeddedPicture_IsNeverBlankedByTheLayer`.
  - `TheAiMayNotPublishMoreCopiesOfAValueThanThePageHolds`.
- **Tests (rewrite).** `ReadingOutcomeAlertsTests.AValueOnlyTheAiRead_IsCalledThat` (L108) moves to disposition `CandidateValueWithheld` and the wording "left out".

### F-04 — an added or dropped value in a re-shaped row is called layout (company2_auto p2 "PRIN.: 0")
- **Root.**
  - CMP L421-435: `shapeDiffers && onPage.Covers(sourceText)` checks only the machine's tokens, never the AI's extras.
  - `AddedValues` (L151, L168) treats only `[A-Z]{3}|CA$|US$|[$€£₹]`-marked tokens as added, so a bare "0" or "500" is never "added".
- **Change.** Layout only through `PageAligner`. A re-shaped row or table is layout only if, after alignment:
  - every non-empty cell on both sides is matched or absorbed (count-aware, inside the same table);
  - no digit token is unmatched on either side.
  Any unmatched AI digit → `CellPresence(AiOnly)` or `TokensInserted`. Any unmatched machine digit → `CellPresence(MachineOnly)` or `TokensDeleted`.
- **Edges.** "1 M" vs "1,000,000" is a dispute, not layout. Ranges, fractions, dates and "N/A" in cells.
- **Tests (new).**
  - `RealCase_Company2AutoP2_AnAddedZeroInARowOfAnotherShape_IsContentNeverLayout`: machine `[Property Damage, 1 M, (blank PRIN.), …]`, AI one cell narrower with `0` under PRIN. Expected: PRIN. stays blank, `CandidateValueWithheld`, High.
  - `ADroppedDeductibleInAShorterRow_IsRestoredInItsColumn` (N): `[Collision,500,210]` vs `[Collision,210]` under a 3-column header gives `| Collision | 500 | 210 |`.
- **Tests (rewrite).** `ALayoutDifference_IsAlerted_EvenThoughNothingWasLost` (L388) becomes `ALayoutDifference_IsOnTheReview_AndNeverAlerted`. `LayoutDifferencesOnSeveralPages_AreReportedInOneAlert` (L406) is deleted (Phase E).

### F-05 — a page-wide word bag ignores counts
- **Root.** `PageFacts` (CMP L190-213) is built once from the AI page; each `Covers` (L200-212) runs independently, so one AI copy covers two identical machine rows. `Align` (L217-238) is a greedy cursor across the whole page with a ±25 window and no notion of tables.
- **Change.** `TokenLedger` (consuming). `PageAligner` matches tables first (monotone DP over the page's table sequence, by content plus heading), then rows inside each matched table (allowing 1:k), then prose. Layout coverage reads only unclaimed tokens.
- **Edges.** Identical tables are matched in order. An AI that merges two DI tables is a 2:1 match. Repeated continuation headers. A table split by a page break.
- **Tests (new).**
  - `TwoIdenticalRowsInTwoTables_AreTwoFacts` (O): Vehicle 1 and Vehicle 2 both have "Bodily Injury | 1,000,000 | 352"; the AI drops Vehicle 2's; it is restored into Vehicle 2's table.
  - `APremiumRowIsComparedOnlyInsideItsOwnTable` (P2): Home 1,212 stays under Home.
  - `TokenLedgerTests`.

### F-06 — the source check points at an ambiguous place
- **Root.**
  - VER L163-170 uses "the row whose first column reads X" (no table named) plus a column ordinal.
  - VER L183 uses `the {Paragraph N} of this page`.
  - The off-target guard is skipped when `Anchor` is null (VDTS L895).
- **Change.** `CheckQuestions.Build` creates a question only with a unique handle:
  - **Table:** the agreed heading above it if unique on the page; else ≥2 agreed header labels if unique.
  - **Row:** the agreed label, plus the label of the agreed row above when the label repeats.
  - **Passage:** ≥3 agreed words before the dispute, counted unique in both readings; else the words after; else the agreed previous line.
  - **Box:** when geometry exists, the DI polygon in ‰ of the drawn picture, turned with `PageOrientation.QuarterTurnsToUpright`. For sections it is relative to the composition.
  - No handle and no box → the question is not asked (free rules decide, and it is reported).
  - Off target: the answer must carry the handle's agreed words, or be a row answer whose aligned cells match at least half the agreed cells.
- **Edges.** Rotated pages, carried header parts in sections, RTL, identical tables with no heading (box only).
- **Tests (new).** `TwoTablesWithTheSameRowLabels_AreAskedByTheirHeadings` (G1/G2: the prompt contains "under the heading 'Home'"; Home "Deductible | 2,500" is kept), `AParagraphIsNeverAskedByItsOrdinal` (E1), `ARegionWithNoUniqueHandleOrBox_IsNotAsked`, `TheBoxFollowsThePagesQuarterTurns`.
- **Tests (rewrite).** `DocumentTranscriptionVerifierTests.ItReadsTheRegionsAndNeverNamesTheAnswersItIsMeantToChooseBetween` and the `Request()` helper (L313-319) move from Discrepancies to Questions.

### F-07 — an invented price is kept though the check read the passage without it
- **Root.** VDTS L972-990 removes added content only on NotOnPage. Any Text answer keeps the value (L985-989).
- **Change.** An on-target Text answer that lacks the AI's added tokens (TokenLedger on the answer) → `TokenRemove` of just that run (F-14), disposition `CandidateUnitNotOnPage`. The value is kept for review only when there is no answer at all.
- **Tests (new).** `AnAddedFromPriceTheCheckReadsWithout_IsRemoved_TheSentenceStays` (J), `TwoReadingsAgainstOne_RemoveTheAddedPrice` (H2: machine and check say $50, AI says $60 → $50), H3 is covered by the F-09 test.

### F-08 — a faithful check discarded as off target
- **Root.** `Extend` (CMP L296-317) widens the AI span. `ShorterThanTheRegion` (VDTS L1359) then judges the answer against the widened text.
- **Change.** `CheckQuestion.ExpectedTexts` holds the aligned machine and AI unit texts, never the extended text. The extension is used only by the write-back's word conservation.
- **Tests (new).** `AFaithfulCheckOfTheRegion_IsNeverOffTarget_WhenTheTranscriptWrappedIt` (H1).

### F-09 and AS-08 — confirmed facts appended at the end of the page
- **Root.** `Restore` (VDTS L1068-1080) appends every restored line at the end of the page. `Correct` L1300-1302 sends refused corrections into restore. `WithoutEvidence` L1214 does the same.
- **Change.** `PageWriteBack`:
  - `RowInsert` goes between the AI rows aligned to the machine row's neighbours. Cells go through the column map; the row is padded to the AI table's width; an HTML AI table gets a `<tr>`.
  - `LineInsert` goes after the aligned predecessor, or before the successor, keeping list, figure or quote context.
  - `CellEdit` replaces the conflicting value; it never adds a second one.
  - A row that cannot be placed becomes labelled text after its own table.
  - Nothing is appended at the end of a page.
- **Tests (new).** `ALostRowIsRestoredInsideItsOwnTable_NeverUnderAnotherHeading` (F: Home and Auto tables), `AConfirmedValueReplacesTheConflictingSentence` (H3), `ARestoredParagraphIsNeverDuplicated` (E1), `ARestoredLineLandsAfterItsAlignedPredecessor` (AS-08).
- **Tests (rewrite).**
  - `AConfirmedLostRow_IsCarriedBackOntoThePage_…` (L307): expect exactly `| Service | Price |\n| Haircut | 500 |\n| Colour | 1200 |`.
  - `ARestoredLine_KeepsTheTranscript_AndThePageIsBanked` (L878): count writes per blob family.
  - `PastTheVerifiedPageCeiling_…CarriedBack` (L503).
  - `AcrossEverySize_…` (L1239).

### F-10 and CS-03 — cost bounds silently drop content
- **Root.**
  - VDTS L835-837 `Take(MaxDiscrepanciesPerVerification)`: differences after the 12th are never decided, restored or reported (L1059 applies only that group).
  - CMP stops listing at `MaxDiscrepancies` (L62, L109-116).
  - The `ComparisonUnavailable` marker is excluded from the group (L835-836), so the branch at L991-996 is dead.
  - The ceiling path also uses `Take` (L710-717).
  - In setup, unchecked values are written live.
- **Change.**
  - Every difference is listed. `MaxUnitsPerPage` and `MaxTokensPerUnit` are complexity guards only: an over-long unit is compared line by line, never "matched".
  - `MaxDiscrepanciesPerPage` becomes the number of questions per page, ranked money > digits > text.
  - The new `MaxVerificationCallsPerPage` splits a page's questions into calls of up to `MaxDiscrepanciesPerVerification`.
  - Anything not asked is decided by the free rules. If it is still unconfirmed it gets `NotCheckedPastBound`, and its RemainingUncertainty names the setting.
  - The dispute index includes it, so setup withholds the price, and the outcome item says which setting to raise.
- **Tests (new).** `FifteenLostRows_AreAllRestored_TheThreePastTheBoundAreReported` (R), `EveryDifferenceIsListed_TheBoundOnlyLimitsWhatIsAsked`, `TranscriptionDisputeIndexTests.AValueABoundLeftUnchecked_IsADispute`, API `McpServiceTests.AServicePriceABoundLeftUnchecked_IsWithheld`.
- **Tests (rewrite).** `APageWithMoreDifferencesThanTheBound_SaysSo` (DocumentTranscriptComparerTests L222).

### F-11 — short rows can never be lost
- **Root.** `CarriesLosableContent` (CMP L799-823) needs a number or ≥3 words of four letters or more. "Flood | Not covered" fails, so `continue` at L68 drops it silently.
- **Change.** `IsLosable` returns true for:
  - any table row with ≥2 non-empty cells;
  - any unit with a digit;
  - prose whose matched DI words have confidence ≥ `MinLosableWordConfidence`.
  Without evidence, the old length rule applies.
- **Edges.** Low-confidence OCR soup on scans (Gujarati read by DI) stays not losable.
- **Tests (new).** `AShortTwoCellRow_IsLosable_AndRestored` (S), `AHighConfidenceOneWordLine_IsLosable`, `LowConfidenceSoup_IsNotLosable`.

### F-12 — on a scan, a value the AI left blank is deleted
- **Root.** `Unsettled` L1244-1248 returns `CandidateReadingRetained` with an empty AI cell. Nothing is written, so "$45" is gone.
- **Change.** Presence rule (table row 2): keep the machine value, report it.
- **Tests (new).** `OnAScan_AValueTheAiLeftBlank_IsKept_AndReported` (Q).

### F-13 — insertions in prose are never asked; reading order (E)
- **Root.** CMP L467-469 skips pure insertions in prose (`insertionsMatter:false`, L419-420). `AddedValues` checks money only.
- **Change.**
  - Inside a matched unit, insertions and deletions are differences.
  - Only whole units gained at a unit boundary count as "the AI read more".
  - Any gained digit follows the added-value rules.
  - **Block-move tiling:** Greedy String Tiling with minimum run `MinBlockMoveWords`, run over the unmatched or ValueChanged machine prose against the unclaimed AI tokens. Runs found intact elsewhere are `Layout.ReadingOrder`.
  - **Echo:** an adjacent repeat of the preceding run in the same machine unit, with no digits, is `Layout.Echo` ("may apply. separate deductible may apply.").
  - A digit is excused only when its whole run moved intact with it.
- **Tests (new).** `AnInsertedClauseWithANumber_IsAQuestion_AndWithoutEvidenceIsLeftOut` (M), `AnEchoedTailTheMachineRepeated_IsLayout`, `ANumberThatMovedWithItsWords_IsReadingOrder_AloneItIsNot`.
- **Tests (keep).** `ReWrappedProse_IsEquivalent`, `ATranscriptThatRecoversTextTheMachineMissed_IsEquivalent`.

### F-14 — a correct sentence deleted because of one added price
- **Root.** The anchor at CMP L159 carries the price. The difference owns the whole unit (L160-161), and removal deletes the unit (VDTS L977-982, L1059).
- **Change.** The added-value difference owns only its token run, taken from the unit's token LCS (including its own AI-only qualifier words). The anchor is the agreed words around the run. Removal is a `TokenRemove` with whitespace normalised.
- **Tests (new).** `ACorrectSentenceLosesOnlyTheAddedPrice` (K2).

### F-15 — the free re-ask replaces a good reading and steers toward OCR errors
- **Root.**
  - VDTS L666-694: attempt 2 overwrites attempt 1.
  - L680: a failed re-ask fails the page.
  - L686: a blank re-ask gives `Equivalent`, which banks "" (the machine reading is kept, no alert).
  - Core `DocumentTranscriptComparison.Describe` L81-87 quotes value disputes, and `VisionPageTranscriber` L105-112 wraps them in `<left_out>`, so the model adopts the machine's misread (I).
- **Change.** `AttemptMerge`:
  - attempt 1 is always kept;
  - attempt 2 is used only if it succeeded and is non-empty;
  - each region of attempt 2 replaces attempt 1's only where it settles a named question and creates no new difference in that region.
  - `ReadingPrompts.ReaskText` names only RowLost and LineLost texts, never value disputes.
  - There is no re-ask on pages with a trusted text layer.
- **Tests (new).** `AReAskNeverQuotesAValueDispute` (I), `AFailedReAsk_KeepsTheFirstReading` (U1), `ABlankReAsk_KeepsTheFirstReading` (U2), `AReAskIsTakenOnlyForTheRowItFixed`, `OnATrustedLayerPage_NoReAskIsBought`.
- **Tests (rewrite).** `AnIncompletePage_IsReAskedOnce_…` (L581; still holds) and `SwappedPrices_…` (L52).

### F-16 (root) — the PDF's own text is never the character authority
- **Root.**
  - The text layer is used only as page-wide word bags (L1220, L1244).
  - `Grounded` never adds Latin (L1131).
  - It is never handed to the comparer (L688) and never tied to a place.
- **Change.** `PageTextLayerReader` plus `TextLayerAuthority`:
  - **(a) Trust** requires all of:
    - the file is a PDF;
    - the layer is not an invisible OCR overlay (`DocumentPageRasterizer.IsInvisibleTextLayer` L399-405);
    - it shares a script with the transcript (`TrustedTextLayer` L1093-1100);
    - layer text agrees with DI words for ≥ `TextLayerMinWordAgreementPercent` of up to `TextLayerTrustSampleWords` high-confidence DI word boxes.
  - **(b) Rebuild:** each machine cell or line with a polygon takes the layer text when it is close to DI's text (same digit-token count, Dice ≥ 0.5). This corrected baseline is used for comparison only; the reference prompt is unchanged, which keeps the raw keys stable. This turns `F85` into `F8S`.
  - **(c) Settle free:** 1:1 value and presence disputes, restore of lost units the layer carries, removal of gained digits it lacks.
  - **(d)** Pay for a check only where the layer cannot decide.
  - Structure is classified first (P4).
- **Edges.**
  - Legacy-font Hindi (`lsok`) fails the agreement test.
  - A stamped scan with a digital footer has too few matching words.
  - U+FFFE is stripped (`Declared`).
  - /Rotate pages: the displayed-frame mapping already exists.
  - Form fields and embedded pictures are guarded (F-03).
  - Pictures, TIFF and scans have no layer.
- **Tests (new).** `DocumentPageRasterizerTests.ReadTextInRegions_ReadsOnlyTheCellsCharacters` (new fixture `KnowledgePdfFixture.BuildWithPlacedText`), `…_OnARotatedPage`, `AnInvisibleOcrOverlay_IsNeverTrusted`, `ALegacyFontLayer_FailsTheWordAgreement`, `TheLayerSettlesACellFree` (A1: F85→F8S).
- **Tests (rewrite).** Every test that declares the page text so as to reach the check now settles free from the layer. Keep their intent with a scan variant:
  - `WithNoUsableThirdReading_…` (L187)
  - `OnAPageThatPrintsItsOwnCharacters_…` (L229)
  - `AValuePrintedOnTheNextRow_…` (L265)
  - `ASourceCheckThatReadsAroundTheRegion_…` (L291)
  - `AThirdReadingOfADifferentPassage_…` (L898)
  - `AThirdReadingFarWiderThanTheRegion_…` (L956)
  - `WhenTwoSourceLinesShareOneTranscriptParagraph_…` (L977)

### F-17 — a RowShaped tie puts a label in a value column
- **Root.** `RowShaped` L1318-1321: on a tie `ThenByDescending(o)` takes the largest offset, so you get `| Haircut | Hair cut | 25 |` and 30 is lost.
- **Change.** Deleted; replaced by cell alignment plus the column map.
- **Tests.** Delete `RowShaped_KeepsTheRowsColumns` and `RowShaped_RefusesAReadingWithMoreCellsThanTheRow` (L133-145). New: `AShorterConfirmedRow_IsAlignedByContent_NeverByOffset` (no label in a value column; 30 kept).

### F-18 — one unanswered region voids every "not on page" answer in the same check
- **Root.** `AnsweredNotOnPage` (IVER L66-67) requires `FailureCategory == null`. VER L248 sets "PartialResponse".
- **Change.** Each region's state stands on its own; the failure category is still reported. Malformed or empty → every region `None`. A contradictory answer (`notOnPage` with text) → `None`, which also fixes VER L238.
- **Tests.** New: `APartialAnswer_KeepsEveryRegionItDidAnswer_IncludingNotOnPage`. Rewrite: `AnAnswerThatCoversOnlySomeRegions_…` (L151) and `OnlyAnExplicitNotOnPage_CountsAsAbsence_…` (L127, to the state enum).

### F-19 — "both supported ⇒ longer wins" favours additions
- **Root.** L916-924.
- **Change.**
  1. The reading whose unit shape matches the answer's line or cell shape wins.
  2. Otherwise, extra tokens that the AI page carries elsewhere (unclaimed) were borrowed, so the shorter reading wins.
  3. Otherwise the longer reading wins (the `not` case).
- **Tests (new).** `RealCase_Company1HomeP3_AMergedLabelCell_IsLayout_TheAiRowsStand`: the machine cell "Hail peril Peril Adjustment - Water Deductible Legal Liability" (rowspan 4, or a 1:4 row merge) against 4 AI rows. Expected: no question, AI rows published, no "Hail peril" duplicate. Also `ExtraWordsBorrowedFromNeighbours_NeverWin`, `ADeletedNegation_StillWins`.

### F-20 — "unsettled" not limited to numbers
- **Root.** The ceiling path (L710-717) sets RemainingUncertainty for text too. `HasUnresolvedReadings` (IVDTS L175-179) and `ReadingOutcomeItems` L58 count any uncertainty. The provider notice is already gone (KnowledgeReadingNotices L72-74).
- **Change.** The dispute index and outcome items treat a difference as unsettled only when `CarriesANumber` (or for ValueMoved). Text-only uncertainty stays on the review. Delete `HasUnresolvedReadings`; it has no production reader.
- **Tests (new).** `ATextOnlyDifferenceNobodyConfirmed_SendsNothing`, `ADigitDifferenceNobodyConfirmed_IsHigh`. Rewrite the `HasUnresolvedReadings` assertions at L176, L197, L218, L447, L1087, L1234 to assert on outcome items instead.

### F-21 — which pages get the 8 paid checks depends on model latency
- **Root.** `TakeVerification` (L700) is called as each unit finishes; the tally is shared (L635-649).
- **Change.** `CheckAllocation`, run in phase 2a once every unit is in:
  - Ordering key: money disputes desc, digit disputes desc, other disputes desc, page asc, section asc.
  - Greedy prefix within `MaxVerifiedPagesPerDocument − Σ ChecksBought` of the decision hits.
  - Calls per unit = ceil(questions / per-call), capped at `MaxVerificationCallsPerPage`.
  - `VerificationsAlreadySpent` is removed from the request (allocation is global and banked answers are reused). The ingest keeps `VerificationsSpent` for the attempt budget only.
- **Tests (new).**
  - `WhichPagesAreChecked_DoesNotDependOnWhichPageAnsweredFirst`: 10 pages, random transcriber delays, ceiling 3, two runs → the same verified set.
  - `APassCutInPhaseTwo_ReusesItsChecks_AndChecksTheSamePages`, `TheCeilingCountsChecksInBankedDecisions`.
- **Tests (rewrite).** `PastThePerDocumentCeiling_…` (L1154), `ChecksAnEarlierPassBought_AreNeverBoughtAgain` (L1172, now via the raw bank), `APassCutShortByItsBudget_…` (L1188), `APagePastTheCeilingThatKeptTheMachineReading_…` (L1209).

### F-22 — the real loss is never reported
- **Root.**
  - `PageRetainedSourceReading` is never assigned.
  - `PagesSourceRetained` (L505) is read nowhere outside tests.
  - The layout alert says "no content was lost" (TranscriptionVerificationAlerts L332-334) on D, N and O.
  - `CollectLayout` runs before the KeepSource return (L742), so reverted pages still get layout alerts.
- **Change.**
  - No layout alerts (Phase E).
  - Delete `PagesSourceRetained`.
  - The evidence clause assigns `PageRetainedSourceReading` per dispute.
  - `PageConservationAudit` raises `ReadingRuleFallback` for any loss the rules did not explain.
- **Tests (new).** `EveryDigitInEitherReading_IsPublishedOrExplained` (sweep over synthetic pages). Sabotage: turning off `RowInsert` must make the audit fire.
- **Tests (rewrite).**
  - `APageThatKeptTheMachineReading_IsNotADegradation` / `_IsBanked…` / `_Replays…` (L799-842) and `OnlyATranscriptWrongAboutTheWholePage_RevertsIt…` (L847) become `ATranscriptWrongWhereverChecked_TakesTheMachineValuesForTheUncheckedOnes_AndKeepsItsOwnLines`.
  - `ThePageWideRevert_NeverDeletesALineOnlyTheTranscriptRead` (VisionClosingAuditTests L212) stays as is.

### F-23 — the drafts lane re-reads without angles, re-buys DI, and keys have no orientation
- **Root.**
  - KnowledgeServiceDraftAnalyticsJob L574-585 passes no `PageAngles` or epoch.
  - L422 calls DI unbanked.
  - Page keys (KnowledgeBlobPaths L174-177) carry no orientation.
  - ProviderSetupDocumentReader L283-300 passes no `PageAngles`, and setup buys DI every time.
- **Change.**
  - Move `PageAnglesOf` (ingest L1783-1790) to infrastructure, as `DocumentPageAngles.Of`.
  - Drafts reads and writes `IKnowledgeExtractionCache` with the ingest's key and passes the angles.
  - Setup passes the angles and banks its DI read in `provider-setup-docs` at `_ocr/{biz}/{fileKey}/{hash}/di.json.gz` (new `KnowledgeBlobPaths.OcrDocumentIntelligenceBlob`; covered by teardown and lifecycle).
  - Quarter turns go into the raw render recipe and into `Inputs`.
- **Tests (new).** Communications `KnowledgeServiceDraftAnalyticsJobTests.ARederiveReadsTheBankedDocumentRead_AndTurnsPagesUpright`. API `ProviderSetupDocumentReaderTests.TheSetupReadingPassesPageAngles` and `ASecondUploadOfTheSameFile_DoesNotBuyItsDocumentReadAgain`. `TheRawKeyCarriesTheQuarterTurns`.

### F-24 — `[A-Z]{3}` counts MSG/DIS/TOT as currency
- **Root.** CMP L38 is used by `IsMoney` L168, by the `InferContext` currencies (L693-695, where "MSG" makes the currency ambiguous) and by `CarriesMoney` L795 (setup scope).
- **Change.** `ReadingScope` uses `KnowledgePriceMarks`: symbols, upper-case `SymbolsByCode` codes, `AliasToCode`, the `/-` tail, and price-labelled columns via `VoiceKnowledgeSettings.ServiceDrafts.PriceFieldLabels` (already bound in both hosts; its hash goes into `Inputs`).
- **Tests (new).** `MSG_DIS_TOT_AreNeverACurrency`, `ASupportedCodeOrAlias_IsMoney`.

### F-25 — an over-wide one-line answer cannot be narrowed
- **Root.** L1331-1353 cuts only at `\n`.
- **Change.** `CheckAnswers.Narrow` runs a local token alignment (Smith–Waterman) against the union of both readings' region tokens and keeps the first-to-last matched window, including the disputed tokens between.
- **Tests (new).** `AOneLineAnswerRunningIntoTheNextSentence_IsNarrowed` ("Deposit 950. Cancellations…" → "Deposit 950"), `NarrowingNeverCutsAPrice`.

### F-26 — the SectionPlanner fallback cuts text lines
- **Root.** `FewestLinesCrossed`, reached at L365-367, splits lines between two sections, with no overlap and no alert.
- **Change.**
  - The fallback cut is marked `CrossesText`.
  - Both neighbouring sections grow to include the crossed lines' full boxes.
  - A new `SectionJoin.Overlap` lets `SectionStitcher` drop the second copy of the overlapping lines (TokenLedger).
  - Logged at Warning.
  - This is render-group code; `RenderRulesVersion` starts at 1 in this change.
- **Tests (new).** `SectionPlannerTests.WhenNoCutIsLegal_TheSectionsOverlapTheCrossedLines`, `SectionStitcherTests.AnOverlapJoin_KeepsEachLineOnce`.

### F-27 — stale documentation of a module-id key
- **Root.**
  - VDTS L40-51 describes a module-id key, and the comment is misplaced on `LongPageAlerts`.
  - `VisionTranscriptionSettings` L101-113 says "compiled identity".
  - The test `APageBankedByADifferentBuildOfTheRules_IsAMiss` (L1114-1135) says the same.
- **Change.** Delete both comments; replace with one terse line. Rewrite the test as `APageBankedUnderAnotherRulesVersion_IsAMiss`: serve `{fp}:v1:r1` → miss; assert `PageCachePolicy == {fp}:v{Adj}:r{Render}`.
- **Tests (rewrite).** Also `VisionClosingAuditTests.ThePageCachePolicy_IsTheSameOnEveryBuild` (L272) and `ADialThatDecides…` (L280, add the new settings).

### F-28 — the page viewer shows nothing for a reverted page
- **Root.** BusinessSearchDocumentService L77-79 returns null for an empty `Markdown`, and a kept page is banked as "".
- **Change.** `CachedPage.Markdown` always holds the published text. `Published == MachineReading` makes the replay keep `results[i] = null`, so figures are not carried twice. The viewer needs no change.
- **Tests (new).** API `BusinessSearchDocumentServiceTests.APageThatKeptItsMachineReading_ShowsThatReading`. Communications `ABlankAiPage_BanksTheMachineText_AndReplaysWithoutCarryingFiguresTwice`.

### AS-03 — figure text never compared, published twice
- **Root.**
  - UNITS `Segment` L54-61 skips figure blocks. A page DI framed as one figure compares as empty, so CMP L53 returns Equivalent.
  - `CarryFigures` (PageMarkdownSplicer L90) re-emits DI's figure text inside the figure, and the parser emits it again as body (KnowledgeDocumentParser `CloseFigure` L750-760), so the text appears twice (P6: `₹9,99,O00` and `₹9,99,000`).
  - `LayoutFigureCaptions` moves a priced caption inside its figure, which made it look "added".
- **Change.**
  - `PageStructureReader` segments figure text with tags stripped (`FigureOrdinal` set). Figure lines align like page text. An unmatched figure line is `Layout.FigureCarried`, not lost.
  - `CarryFigures` runs at assembly with a pure `FigureCarry.Compute(machinePage, publishedPage)`. It writes `<figure data-words="{the full figure text, HTML-encoded, using the published spellings of aligned lines}">` on its own line, then only the figure lines the published page does not carry, then `</figure>` on its own line (AS-01 shape).
  - Parser: when a figure opens, add the decoded `data-words` to `ImageNeighbourText` only. `Sanitize` already strips `<figure…>`, so a transcript cannot smuggle the attribute. The conservation gate's `VisibleText` drops tag contents, so nothing is falsely flagged as lost.
- **Tests (new).** `AValueInsideAFigure_ThatTheTranscriptChanged_IsADispute` (P8a), `AFigureLineTheTranscriptCarries_IsPublishedOnce` (P6), `APricedCaptionMovedIntoItsFigure_IsNotAdded` (P9), parser `AFiguresDataWords_AreItsOwnWords_NotBody`.
- **Tests (rewrite).** `FigureText_IsNotTheTranscriptsToReproduce` (CMP tests L129) is reversed. `TranscribedPages_KeepTheOcrFigureAnchors_InPlace_AndCarryTheirText` (VisionDocumentTranscriptionServiceTests L39) expects `Intro\n<figure data-words="logo">\nlogo\n</figure>`.

### CS-01 — setup scope never checks Indian-notation money, contacts or header rows
- **Root.**
  - Setup scope drops non-money differences (CMP L778).
  - The money test is `CurrencyToken` (L795) or digits-only cells (L789-793), so `Rs 500`, `500/-`, phone numbers, hours and header rows are all missed.
  - `InferContext` (L690-699) has no Indian grouping, so lakh amounts are never equivalent.
- **Change.**
  - `ReadingScope` for ServiceIdentityAndPricing covers: money (`KnowledgePriceMarks`), durations, times and hours, phone-shaped digit runs (≥7 digits), the row-label cell of a priced or duration row, every header row of a table holding money or durations, and prose carrying any of these.
  - `InferContext` adds Indian grouping detection (`^\d{1,2}(,\d{2})*,\d{3}`) mapped to en-IN. A token that is only valid English plus one only valid Indian → unknown.
  - Dot-grouped European amounts get a format with `.` grouping and `,` decimal (see additional defect 4).
  - `DocumentValueEquivalence.ReadCurrency` accepts aliases (`Rs` and `Rs.` → INR) and the `/-` tail.
- **Tests (new).** In the comparer tests (primary orchestrator, §0.18 rule 2): `ServiceScope_Catches{RsAlias,SlashDashTail,PhoneNumber,Hours,SwappedPriceDurationHeaders,LakhAmount}`, `LakhGrouping_IsEquivalent`, `DotGroupedEuro_IsEquivalent`.

---

## 2. Q3 — the raw-output bank, mapped onto the code

### Keys

**Transcript attempt n** (`PageReadingRawKeys.Transcript`):
- `RenderRulesVersion`
- recipe:
  - page: `page|{n}|edge{PageRenderMaxEdgePixels}|q{JpegQuality}|ceil{MaxDecodedPixels}|turns{QuarterTurnsToUpright(angle)}|kind{pdf|tiff|image}`
  - section: `section|{OversizePageReader.GeometryKey(ModelComposition)}|q|ceil|turns`
- model: `{TranscribeDeploymentName}|{TranscribeReasoningEffort}|{MaxCompletionTokens}`
- `promptKey = SHA256(system ␀ user)` from `VisionPageTranscriber.BuildPrompts` (static, so no interface change)
- the ordinal

Attempt 2 is keyed on attempt 1's prompt key + `SHA(the re-ask instruction template)` + ordinal 2. The steering text actually sent is recorded in the value. This keeps re-adjudication free, at the cost of reusing an attempt 2 that was steered differently; attempts are evidence, not authority (F-15).

**Check answers.** Per question: `SHA(RenderRulesVersion | verify recipe (page or region at VerifyPageRenderMaxEdgePixels, q, turns) | VerifyDeploymentName | VerifyReasoningEffort | VerifyMaxCompletionTokens | SHA(SystemPrompt + schema) | canonical question (shape, handle, box))`. The call blob is keyed on the sorted question keys. This assumes answers do not depend on which other questions shared the call; minor risk, accepted.

### Paths
Every path is under `_ocr/{biz}/{docKey}/{hash}/` in the lane's container. New helpers in `KnowledgeBlobPaths`:
- `raw/{deployment}/t-p{page:000}[-s{geom}]-a{n}-{key20}.json`
- `raw/{verifyDeployment}/v-p{page:000}-q{key20}.json`
- `raw/{verifyDeployment}/v-p{page:000}-c{key20}.json`

### Values (JSON, `schema: 1`)
- **Transcript:** key, page, section, attempt, deployment, effort, maxTokens, renderRules, recipe, promptKey, steering, `outcome` (`Completed|NoText|Truncated|Refused`), `raw` (the completion before `StripCodeFence`/`Sanitize`), usage (prompt, completion, reasoning), reading, at.
- **Call:** questions, state, failure, raw JSON content, attempts, model, reading.
- **Per question:** key, state, text, callKey, reading.
- Post-processing (`RawTranscript.Post`: `Sanitize(StripCodeFence(raw))`) and answer parsing (`CheckAnswers.Parse`) happen when the entry is read, so parse and sanitize changes cost no AI money.

### Written and read
`PageReadingRawBank` (VDTS phase 1 and 2a), on the bank token (E13, L755-761).
- A success is trusted across readings.
- `Truncated`, `Refused` and Unusable calls are trusted only by their own reading epoch, so "Read again" retries them.
- Transient failures are never banked.
- `ForceFresh && epoch == 0` skips raw reads; with an epoch, only entries from that epoch are reused (as `ReadBankedPageAsync` L588-596 does).

### How a version raise re-adjudicates from raw without paying
1. The decision entries miss (policy or `Inputs` differ).
2. Phase 1 rebuilds the identical attempt-1 prompt, because the reference is built exactly as today from DI and the layer. The key hits, so there is no call and no drawing; the layer comes from `ReadPageTextAsync`.
3. Phase 2 builds questions under the new rules. Questions already answered hit their per-question blobs; only questions never asked before cost money.
4. Prompt-shaping edits (`ReadingPrompts`, the template, `LayoutFigureCaptions`) move keys by hash. That is a paid change by construction, and is documented in the pin message.

### Failure handling
- An unreadable or mismatched entry is a miss: Warning, then re-buy.
- A failed write: Warning; the answer is still used, but it does not count toward `ReadingsBanked`, so continuation progress stays honest.
- `ReadingsBanked` = units with a raw transcript + checks banked + decisions banked. It only ever grows across passes (ingest `ShouldCarryOnReading` L4556-4578).

### Size and inputs
- Raw transcript about 10-30 KB per attempt, call blob 2-8 KB, per-question about 0.5 KB. The decision entry is about today's size.
- The DI bank `{biz}/_di/{doc}/{hash}.json.gz` is not under `_ocr`, so it outlives the raw bank.
- Its >32 MB skip (`KnowledgeExtractionCache` L139-145) is a remaining paid gap (DI cost only).

### Purge and closure
- `KnowledgeDocumentDataPurger` L106-109 deletes `OcrPrefix(biz, doc)`.
- `BusinessClosureTeardown` L216-224 sweeps `_ocr/{biz}` in both containers.
- The `storage.json` rule `ocr-page-cache-lifecycle-policy` (L367-389: cool at 50 days, delete at 180 days) covers both `_ocr/` prefixes.
- No ARM, Cosmos, SQL, Search or queue change.

### Tests
- Unit, with `InMemoryDerivativeBlobs`:
  - `ARulesChange_ReAdjudicatesFromRaw_WithoutAPaidCall`
  - `OnlyAQuestionNeverAskedIsBought`
  - `AnUnreadableRawEntry_IsAMiss`
  - `ATruncatedAttempt_BindsOnlyItsReading`
  - `ATransientFailure_IsNeverBanked`
  - `ForceFresh_SkipsOtherReadingsRawEntries`
  - `TheRawKeyMovesWithRecipeModelAndPrompt_NotWithTheRules`
- Integration (Azurite), in `KnowledgeOcrPageCacheIntegrationTests`:
  - `RawEntriesLiveUnderTheDocumentsOcrPrefix_AndThePurgerDeletesThem`
  - `ClosureTeardownDeletesSetupRawEntries`
  - `AReadingAfterARulesChange_MakesNoAiCall`

---

## 3. Q4 — outcome items after the fixes (`ReadingOutcomeItems.KindOf`)

| Disposition (when) | Item | Severity |
|---|---|---|
| ResolvedToSource / ResolvedToCandidate · **SettledByTextLayer** · LayoutDifferenceKept · SourceUnitNotOnPage · CandidateUnitNotOnPage · SourceUnitRestored with no uncertainty | none | – |
| SourceUnitRestored with uncertainty (only the machine read it; restored in place) | ValueUnconfirmed (if digit) | High |
| SourceUnitUnconfirmed (dropped) | LineDropped (if digit, or a table row) | High / Medium |
| **CandidateValueWithheld** | ValueOnlyOneReadingHas, worded "left out" | High if digit, else Medium |
| CandidateReadingRetained with an empty machine reading | ValueOnlyOneReadingHas, worded "published" | High if digit |
| CandidateReadingRetained, SourceReadingRetained, UncertainThirdReadingUsed, PageRetainedSourceReading | ValueUnconfirmed, only if digit; **ValueMoved** when `Kind = AssociationChanged` | High (PageRetainedSourceReading: Medium) |
| **NotCheckedPastBound** | **ValueNotChecked** (names the setting) | High if digit |
| **ReadingRuleFallback** | ReadingRuleBroke | High |
| ServicePricingWithheld / ExistingServicePricingPreserved / ThirdNameUsed | as today | as today |

- New `ReadingOutcomeKind` values: `ValueMoved`, `ValueNotChecked`.
- Delete the VDTS calls that publish Required (L844-848), Outcome (L1050-1055) and layout (L495-496, L1177-1194). Delete `_verificationAlerts` from VDTS (the test factories change only because they must compile).
- Consumer per-check alerts (drafts job L957-960, McpService L1477-1485) move to `PublishReadingOutcomeAsync` (the Phase E owners).

---

## 4. RenderRulesVersion and the convention split

`VisionDocumentTranscriptionService.RenderRulesVersion = 1`, with the comment: "raise only when what a reading is SHOWN changes — drawing, turning, composing, reading the text layer". It lives beside `AdjudicationRulesVersion`, and §0.23 in CLAUDE.md and its three copies must name it. `PageCachePolicy` becomes `{fp}:v{Adj}:r{Render}`.

**`ThePageRenderRules_AreVersioned`** pins:
- `DocumentPageRasterizer.cs`, `Pdfium/*.cs`, `PageOrientation.cs`, `TiffFrameSizes.cs`
- `VisionPageTranscriber.cs` (prompt and transport only, once `StripCodeFence` and the `Sanitize` call move to `Reading/RawTranscript.cs`)
- `Reading/ReadingPrompts.cs`, `Reading/PageReadingRawKeys.cs`, `Reading/PageTextLayerReader.cs`
- `Oversize/{SectionPlanner, OversizeLayout, OversizeLayoutReader, PageTextLines, PageTextScale, PictureReadingLimit, SectionCompositions}.cs`. `SectionCompositions` is a new file holding `LayoutWindows`, `WholePage`, `WholePagePlan`, `MachineComposition`, `ModelComposition` and `GeometryKey`, extracted from OversizePageReader L167-195, L273-292 and L514-523.

**`ThePageReadingRules_AreVersioned`** (Adjudication, raised 1→2) pins:
- `VisionDocumentTranscriptionService.cs`, `DocumentTranscriptComparer.cs`, `DocumentTranscriptUnits.cs`, `DocumentValueEquivalence.cs`, `DocumentTranscriptionVerifier.cs`
- `Reading/*.cs` except the three render files above
- `PageMarkdownSplicer.cs`
- `Oversize/{OversizePageReader, SectionStitcher, WholeViewFigures, SectionedPageFigures}.cs` (stitched pages are banked, AS-06)
- `clinqetcore/Models/Knowledge/KnowledgeText.cs`, `clinqetcore/Utilities/TextScriptDetector.cs`
- `Services/Knowledge/KnowledgePriceMarks.cs`, `KnowledgeFigures.cs` (they now decide comparisons)

**New guards.** `NoFileIsPinnedByTwoVersions`. `EveryReadingFolderFileIsPinned` (every `Reading/*.cs` appears in exactly one group). `EveryCoveredFileAndMethod_IsFound` is extended.

**Version timing.** Raise `AdjudicationRulesVersion` once, at the first step that changes logic (step 4). Later steps update the pin at v2 only, because nothing is banked under v2 until the deploy. The pins for steps 1-3 are pin-only.

---

## 5. Implementation order (each step builds and its tests pass)

1. **Scaffolding, no behaviour change.**
   - `RenderRulesVersion` and the convention split.
   - Rasterizer `ReadTextInRegionsAsync` / `ReadPageTextAsync` + `PdfiumDocument.ReadTexts`, with real-PDF tests.
   - `VisionPageTranscription.RawContent`/`Usage`; `DocumentVerification.RawContent`.
   - Raw paths in `KnowledgeBlobPaths`.
   - Extract `SectionCompositions` and `ReadingPrompts` (pure moves, pin only).
2. **Raw bank wired, v1 rules.** Read and write raw entries; decision entry gains `Inputs`/`Published`/`RawKeys`/`ChecksBought` (F-28). Unit and Azurite tests.
3. **Pure primitives, not wired.** `PageStructureReader` (grid, spans, figures, CJK, RTL), `PageGeometry`, `TokenLedger`, `TextLayerAuthority` trust and rebuild, `ReadingScope` (F-24, CS-01 money). Unit tests.
4. **`PageAligner` and `PageDifference` behind `DocumentTranscriptComparer.Compare`.** It maps to the current `TranscriptDiscrepancy` so the old adjudication still runs. Raise the version to 2 here. Rewrite the comparer tests. Covers F-02 cells, F-04, F-05, F-11, F-13, F-14, F-10 listing, AS-03 compare, Indian and European equivalence.
5. **Check-answer model.** `CheckQuestions`, `CheckAnswers` (state, narrowing, per-region), new verifier schema and prompt. Covers F-03 answers, F-06, F-08, F-18, F-25. Rewrite the verifier tests.
6. **Adjudication rewrite.**
   - 6a: `PageRuling`, `TextLayerAuthority.Settle`, `AttemptMerge`, `PageWriteBack`, `PageConservationAudit`, new dispositions. Delete the old rungs. Covers F-01, F-03, F-07, F-09, F-12, F-15, F-16, F-17, F-19, F-22, AS-08.
   - 6b: two phases plus `CheckAllocation`, the `OversizePageReader` split, F-26, F-10/CS-03 bounds. Real-case and probe tests.
7. **Scope and review fields.** `TranscriptionDisputeIndex` includes the new uncertainties; F-20.
8. **Figures (AS-03).** `FigureCarry`, `data-words` writer, parser read.
9. **Consumers.**
   - F-23 (drafts DI bank and angles; setup angles and DI bank).
   - Phase E removal on the VDTS side and the Q4 mapping.
   - Outcome EventId on the reading epoch (additional defect 3).
   - Delete `HasUnresolvedReadings`, `PagesSourceRetained`, `VerificationsAlreadySpent`.
   - Settings in both hosts; remove the orphan keys.
10. **Documentation and close-out.** CLAUDE.md ×4 §0.23; SKILL.md ×4 for function-app, infrastructure and ai-assistant; memory; sabotage pass on every guard; update `ai-cost-quality/test-harness/P4Vision.cs` for the constructor change.

---

## 6. Additional defects found while reading

1. **Misplaced, stale comment.** VDTS L40-51 describes a module-id key, contradicting §0.23, and sits on `LongPageAlerts`. `VisionTranscriptionSettings` L101-113 is stale the same way. Fixed under F-27.
2. **Outcome alert identity is keyed on the build.** `TranscriptionVerificationAlerts.ReaderBuild` (L115) feeds the EventId (L164-165). Every deploy makes an identical outcome a new alert. Fix: add `ReadingEpoch` to `ReadingOutcomeReport` and key the EventId on flow, business, doc, hash, epoch and digest. Test: `TheEventIdIsTheSameForTheSameReadingWhateverTheBuild`.
3. **European and Indian amounts never compare as equal.** `InferContext` (CMP L697-699) maps dot-grouped European amounts to fr-CA, whose group separator is a non-breaking space, so `1.234,56` never parses (spurious paid checks). There is no Indian grouping at all. Fixed under CS-01.
4. **Orphan API settings.** `AIAssistant:ProviderAttachmentProcessing:Vision:PageConcurrency` and `MinTextConservation` (clinqetapi/Clinqet.API/appsettings.json, in the Vision block at L2326) bind to nothing. Delete them (§4).
5. **Dead members.** `HasUnresolvedReadings` (IVDTS L175-179) and `PagesSourceRetained` (L134) are read only by tests. Delete them.
6. **Prose prices labelled as names.** CMP `Report` L782-783 labels a money change in a prose line "service name", so setup's `PricingFor` never sees it (overlaps CS-02). The new field rule: money tokens mean "price".
7. **Answer length bound.** VER `AnswerBound` L253-255 bounds by the cell excerpt, which would reject the new whole-row answers. Bound by the question's expected texts instead.
8. **Contradictory verifier answers.** `notOnPage: true` with text is treated as a Text answer (VER L238 + IVER L55-56). It becomes `None`.
9. **Old content-hash folders linger.** `_ocr/{biz}/{doc}/{otherHash}/` is never pruned on replacement, while `_artifacts` and `_di` are (ingest L1763-1764). Proposal: prune it in the same post-commit step.
10. **Two storage calls per cache read.** `TryReadCacheAsync` (L1398-1417) calls Exists then Get for every banked entry, which doubles with the raw and per-question blobs. Use a single get that treats not-found as a miss.
11. **Text-layer trap, not a defect today.** Typed form-field values and text inside embedded pictures are absent from the PDF text layer. Any layer-based blanking must be guarded (built into F-03 and F-16).

---

### Critical Files for Implementation
- C:\Nik\clinqetinfrastructure\Services\AI\VisionDocumentTranscriptionService.cs
- C:\Nik\clinqetinfrastructure\Services\AI\DocumentTranscriptComparer.cs (+ DocumentTranscriptUnits.cs → new Reading\PageStructureReader.cs / PageAligner.cs)
- C:\Nik\clinqetinfrastructure\Services\AI\DocumentTranscriptionVerifier.cs (+ C:\Nik\clinqetcore\Interfaces\AI\IDocumentTranscriptionVerifier.cs)
- C:\Nik\clinqetinfrastructure\Services\AI\DocumentPageRasterizer.cs (+ Pdfium\PdfiumDocument.cs) and C:\Nik\clinqetinfrastructure\Services\AI\Oversize\OversizePageReader.cs
- C:\Nik\clinqetfuncations\Clinqet.Communications.UnitTests\Conventions\BankRulesVersionConventionTests.cs (+ Knowledge\DocumentTranscriptionAdjudicationTests.cs)
