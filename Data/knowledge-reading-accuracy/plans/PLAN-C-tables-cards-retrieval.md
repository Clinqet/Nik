<!-- Saved 2026-10-02 from the read-only planning agent's final report. Design only; BUILD-STATE.md records what is built. -->

# Plan — how parsed knowledge becomes tables, cards, overview cards and retrieval seats

This is a read-only design. I edited nothing.

**Line numbers.** They come from today's working tree. The parser, chunker, PageMarkdownSplicer and SectionStitcher carry this session's uncommitted edits, and while I read, the parser moved by about 30 lines. Trust the method names over the line numbers.

**Abbreviations used below:**
- KDP = `clinqetinfrastructure/Services/Knowledge/KnowledgeDocumentParser.cs`
- OX = `KnowledgeDocumentParser.OpenXml.cs`
- PX = `KnowledgeDocumentParser.Pptx.cs`
- KC = `KnowledgeChunker.cs`
- KIB = `KnowledgeInventoryBuilder.cs`
- PKSS = `ProviderKnowledgeSearchService.cs`; PKSS.P = `ProviderKnowledgeSearchService.Provider.cs`
- KRR = `KnowledgeRelevanceRanker.cs`
- MEB = `MaterialExcerptBuilder.cs`
- SS = `Services/AI/Oversize/SectionStitcher.cs`
- ING = `clinqetfuncations/Clinqet.Communications/Functions/KnowledgeIngestProcessorFunction.cs`
- CUT = `Clinqet.Communications.UnitTests/Knowledge`
- CIT = `Clinqet.Communications.IntegrationTests/Tests/Functions`

---

## 0. Rules this plan follows

**§0.7 (schema)**
- No fix needs a SQL, Cosmos or Search change.
- One new field on a stored shape, flagged for you: `KnowledgeBlock.ContinuesPreviousPage` (bool).
  - KnowledgeBlock is stored only in the content-artefact blob (`KnowledgeContentArtifact.Blocks`). No Cosmos entity holds it.
  - This session already did the same with `IsFigureText`.
  - A schema-free fallback is in section F.
- I deliberately do not propose span data on `KnowledgeTableModel`. It would let one merged value be labelled with every column it covers ("Q1 / Q2: Available all year"). Owner's call if wanted.

**§0.23 (rules versions)**
- Parser, chunker, inventory, ingest and search files are not pinned.
- `BankRulesVersionConventionTests.PageReadingFiles` does pin `Services/AI/Oversize/*.cs`, `PageMarkdownSplicer.cs` and `clinqetcore/Models/Knowledge/KnowledgeText.cs`.
- So every new helper goes in a new file, never in `KnowledgeText.cs`. Only AS-16 touches a pinned file.

**§0.18 (test placement)**
- Parser, chunker, inventory, section scope and ingest → CUT, plus CIT for the ingest processor. §0.8 makes integration tests mandatory for a Service Bus processor.
- Voice seating → `clinqetmcp/Clinqet.Mcp.UnitTests/Services`.
- Business Search seating → `clinqetapi/Clinqet.API.UnitTests/Services/BusinessSearch`.
- MaterialExcerptBuilder → `Clinqet.Mcp.UnitTests/Services/MaterialExcerptBuilderTests.cs`.
- The API also runs the parser (ProviderSetupDocumentReader), so run `Clinqet.API.UnitTests` after every parser step.

**How fixes reach existing documents**
- PipelineFingerprint (ING:118-128) changes with every build, so a fix reaches a document on its next Read again or admin reindex.
- AdjudicationRulesVersion does not change, so page readings replay from `_ocr` for free.
- What gets paid again per document: the describe call and the embeddings.

### New settings (class default equals appsettings, §0.12)

| `Voice:Knowledge` key | Default | Appsettings of | Read by |
|---|---|---|---|
| DocAggregateMinRangeValues | 3 | Functions | `KnowledgeInventoryOptionsFactory.From` → `KIB.AnalyzeColumn` |
| DocAggregateCardsWarning | 8 | Functions | ING aggregate-card block |
| DocAggregateCardsLimit | 12 | Functions | same |
| RetrievalLookupOverviewSeats | 1 | MCP and API | `PKSS.SearchAsync` (lookup) and `PKSS.P.SearchForProviderAsync` |
| RetrievalBrowseOverviewSeats | 3 | MCP | `PKSS.SearchAsync` (browse) |

- `KnowledgeInventoryOptions` (`clinqetcore/Models/Knowledge/KnowledgeInventory.cs`) gains three values, filled by the factory (`Clinqet.Communications/Services/KnowledgeDocumentFormats.cs:44-57`) with no new keys:
  - CardTargetTokens 350 (= ChunkTargetTokens)
  - MaxAggregateTokens 512 (= ChunkMaxTokens)
  - MinRangeValues 3
- Convention tests to update:
  - Functions `VoiceKnowledgeSettingsConventionTests.NotReadByThisHost`: add both Retrieval keys, each with its reader.
  - MCP `VoiceAnswerLadderSettingsConventionTests.ReadByThisHost`: add both.
  - API `VoiceKnowledgeSettingsConventionTests.ReadByThisHost`: add RetrievalLookupOverviewSeats.

### New `AdminAlertType` values

All three go in `clinqetshared/Enums/AdminAlertType.cs`, with labels in `clinqetwebadmin/src/pages/alerts/AlertsPage.jsx` (ALERT_TYPE_LABELS) and `clinqetmobileadminapp/src/services/alertTypes.ts`, plus their tests.

| Value | Raised by | Severity |
|---|---|---|
| KnowledgeAggregateCardsWarning | `ReportFileLimitAsync(warningOnly:true, "KnowledgeAggregateCards", "Voice:Knowledge:DocAggregateCardsWarning", …)` | Low |
| KnowledgeAggregateCardsLimit | `ReportFileLimitAsync(false, "KnowledgeAggregateCards", "Voice:Knowledge:DocAggregateCardsLimit", …)` | Medium |
| KnowledgeOverviewsLeftOutSpaceFull | `ReportFileLimitAsync(false, "KnowledgePassagesPerBusiness", KnowledgePassageEntitlements.AlertDial + " (grace: OverflowGraceFactor)", …)` | Medium |

There is no provider-facing text, so no localization keys (§0.10). There is no new screen.

---

## 1. Findings

### A. Value lines and price runs

**AUDIT-1 P0-4 — a short name before its price is read as a bare value**

*Root cause*
- `KC.IsValueOnlyLine` (505-526) accepts one letter-word of 4 characters or fewer anywhere in the line (L516, L524-525).
- So "Kids $18", "Lip $5", "Kids 180", "દાઢી ₹50" and "剪发 ¥30" all count as values.
- `BuildLabelValueRows` (KDP ~1533) then attaches them as extra columns of the line above.
- `PairLabelValueRuns` (KDP 1280) also pairs runs that are already self-contained record lines.
- PX `ZipPair` (441-442) uses the same test.

*Change*
1. In `IsValueOnlyLine`, a word token is allowed only after the first token that contains a digit. A leading word is allowed only when `KnowledgePriceMarks.CodeFromToken(token) != null` (Rs, Rs., INR, CAD, रु, રૂ, ரூ, dollars…). A lone currency mark stays allowed anywhere.
2. In `PairLabelValueRuns`, before `BuildLabelValueRows`: if `lines.Count(IsSelfContainedLine)*100 >= lines.Count*CoalescedLineSharePercent`, leave the run to `CoalesceValueLineRuns` and never pair it.

*Edge cases*
- Still values: "Rs 500", "Rs. 9,49,000/-", "INR 800", "US$ 45", "€ 45,00", "45,00 €", "52 ft", "30 min".
- No longer values: "Kids $18", "Kids 180", Gujarati, Devanagari, CJK and Thai name-plus-price lines.
- A price prefixed by an unsupported currency code ("Rp 50.000") stops being a value. The safe direction: the line is never paired, and it stays its own line.

*Tests (CUT)*
- `IsValueOnlyLine_AWordBeforeTheNumberIsAName_UnlessItIsACurrency` — a Theory over both lists above.
- `LayoutMarkdown_AShortNameBeforeItsPrice_IsItsOwnRecord`
  - Input: "Haircut $25¶Kids $18¶Lip $5¶Chin $4".
  - Expect: no row holds both Haircut and Kids; the card has a "Kids $18" line.
- `LayoutMarkdown_ARunOfSelfContainedLines_IsNeverPaired`.
- `LayoutMarkdown_ACurrencyFreeListWithShortNames_KeepsEveryRecord` — "Haircut 250¶Kids 180¶Beard 100", plus gu/hi/zh InlineData.
- `Pptx_ANamesBoxWhoseLinesCarryTheirPrices_IsNotZipped`.
- Must stay green: `LayoutMarkdown_PairsAnyFlattenedTwoColumnLayout`, `LayoutMarkdown_ValueOnItsOwnLine_PairsWithTheLabelAboveIt`, `Pptx_OneTextBoxPerNameAndPerPrice_PairsIntoRecords_InsteadOfOneGluedCard`.

**AUDIT-1 P0-8 — direction check and wrapped-name guard**

*Root cause*
- The pairing direction is decided from `lines[0]` alone (`labelFirst`, KDP 1324).
- `IsWrappedContinuation` (KDP 1646) treats any line starting lowercase in a cased run as the wrapped tail of the name above, so "iPhone screen repair" joins "Battery replacement".

*Change*
1. Count pairs both ways.
   - down = the label→value pairs `BuildLabelValueRows` actually made.
   - up = value lines immediately followed by a non-value line.
   - Pair downward only when down > up and the run is not misaligned.
   - Otherwise refuse and add the prices to UnpairedPriceLines. Never pair upward (E-19).
2. In the cased branch of `IsWrappedContinuation`, a lowercase line starts a new record when the row above already has its value and the next line is a value.

*Tests*
- `LayoutMarkdown_APriceBeforeNameListUnderAHeadingLine_IsRefusedAndCounted`
  - Input (F17): "Services¶$25¶Haircut¶$15¶Beard trim".
  - Expect: no pairs; UnpairedPriceLines = 2.
- `LayoutMarkdown_ALowercaseNameAfterAPricedRow_ThenAPrice_IsANewRecord`
  - Input (F18): Battery replacement / $49 / iPhone screen repair / $99.
  - Expect two rows: [Battery replacement | $49] and [iPhone screen repair | $99].
- Must stay green: `L1_LatinWrappedContinuation_RejoinsAfterItsPrice`, `L1_LatinWrappedContinuation_StillRejoins`, `LayoutMarkdown_LowercaseContinuationLine_RejoinsTheNameItBelongsTo`, `A23_AValueFirstWordList_CountsThePricesItCouldNotName` (still 3), `A16_APairedPriceListOverAPageBreak_CitesEachRowsOwnPage`.

### B. Pipe lines that are not a valid table, and forced vision headers

**AUDIT-1 P1-2**

*Root cause*
- `IsPipeTableStart` (KDP 1755) requires the delimiter's cell count to equal the header's. This breaks F33 and F53 (a carried delimiter keeps its old width).
- A pipe header over a `---` underline therefore fails the check. `TrySetextHeading` (called at KDP ~951) turns the header into an H2 and leaves the data as raw pipe rows (F38).
- Pipe rows with no delimiter stay a paragraph, so raw `|` reaches the card and the sentence packer glues the rows.

*Change*
1. `IsPipeTableStart(header, delimiter, afterDelimiter)` accepts either:
   - the GFM equal-count case, or
   - a header of 2+ cells, a delimiter-shaped line (only `- : |` and spaces, at least one `-`), and a following pipe line with the header's cell count.
   The call site passes `lines[li+2]`. This runs on the header line, so it also fixes F38.
2. In `ParseBlocks`, just before the paragraph append: when the paragraph is empty and the current and next lines are pipe rows with the same cell count, read the run as `Table{HasHeaderRow=false}`. A pipe row here means a leading/trailing pipe or 2+ pipes, and 2+ cells.

*Tests*
- `LayoutMarkdown_ADelimiterMiscountingItsColumns_StillDeclaresTheHeader`.
- `LayoutMarkdown_ASetextUnderlineUnderAPipeHeader_IsTheTablesDelimiter`.
- `LayoutMarkdown_EqualWidthPipeRowsWithoutADelimiter_AreAnUndeclaredTable`.
- `LayoutMarkdown_ACarriedDelimiterOfTheOldWidth_StillHeadsTheContinuation`.
- Must stay green: `LayoutMarkdown_PipeLineWithoutAMatchingDelimiterRow_StaysText` ("Cash | card accepted⏎---⏎…"), `LayoutMarkdown_PipeTable_BecomesADeclaredHeaderTable_NeverRawMarkup`.

**AUDIT-1 P1-5 — the vision lane forces a header row**

*Root cause*
- `ReadPipeTable` (KDP 1769, `HasHeaderRow` at ~1788) has one check only: `LooksLikeALabelRow`.
- The transcriber prompt orders a header row. So a form that prints values over their captions binds the values as labels: "Kathiria: First Name".

*Change*
- `ReadPipeTable(…, renderedPage)`: on a rendered page, a pipe table with exactly one body row is undeclared.
- All lanes then apply the stronger header check in D.
- DI's own `<th>` detection is left alone; the D(b) date/number veto covers that.

*Tests*
- `LayoutMarkdown_AVisionTableWithOneBodyRow_IsUndeclared`
  - Input: | Kathiria | Smitaben | 2 Scarletwood St | over | First Name | Last Name | Address |.
  - Expect: no "Kathiria:"; both lines in the card.
- `Markdown_ATypedTableWithOneBodyRow_KeepsItsHeader`.

### C. One span rule for every table source

Covers AUDIT-1 P0-9 and P1-4, AUDIT-3 AS-09, and AUDIT-4 P1-1, P1-3 and (via `CellText`) P1-2.

**Root cause**
- `ReadHtmlTable` (KDP 1912) writes a colspan's text into every column it covers (1949-1955). It carries every rowspan into later rows, including `<th>` cells into body rows (1953, 1959-1961). Results:
  - "Service: WAXING | Price: WAXING" from a two-cell band.
  - The 400-character MSG note copied six times.
  - "Rates: Rates", "Totals: Totals", "Breakdown: Breakdown".
  - The side label "Totals" becoming every row's identity.
- `CollapseFullWidthSectionRows` (2005) only handles one source cell spanning the full width.
- Only one header row is ever used (`DeclaredHeaderRowIndex`, 2130), so a second all-`<th>` row becomes data ("Operator: Coverages").
- `KC.TryMergeSubHeaderRow` (1183) needs an empty first cell.
- `KC.DisambiguateLabels` (1208) turns copies into "(2)" ("TOTALS (2)").
- `KC.SerializeRow` (1402) labels by position. When the header is narrower than the rows, every label shifts: "Coverage: Totals | Limit: Bodily Injury | Premium: $1,000,000 | $352".
- The four readers follow four different rules, against the contract in `KnowledgeBlocks.cs:68-69`:
  - Word: gridSpan written once, vMerge copied (OX 888-915).
  - PowerPoint: gridSpan once, vMerge copied (PX 680-706).
  - Excel: a band once, but a merge beside data copied (OX 1024-1036).
  - HTML: everything copied.

**Change — new `Services/Knowledge/KnowledgeTableGrid.cs`**

Every reader emits source cells (text, row, column, rowSpan, colSpan, isHeader). One builder then applies one rule:

- **S1 Header block.**
  - The block starts at the declared header row (`DeclaredHeaderRowIndex` using the new `LooksLikeAHeader`). It extends through the consecutive declared rows below it that are sub-headers: 2+ non-empty source cells, no data-shaped cell, not a band.
  - Labels compose top-down per column in R3's format, "Parent (Sub)". Spans are expanded only inside the block.
  - A cell covering several header rows counts once: "Rates", never "Rates (Rates)".
  - A header cell whose rowspan runs past the block is not a column label. In column 0 it becomes a band (S3); elsewhere its text goes to the caption.
- **S2 Band.** A body row with exactly one non-empty source cell keeps that value in its first column only (covers `<td colspan=2>WAXING</td><td></td>`).
- **S3 Side label.**
  - Applies to a leading column whose header cell is empty, absent (the header is narrower by exactly that column), or spans into the body, and whose non-empty body cells are all anchors spanning 2+ rows.
  - Each anchor becomes a band row before its rows. The column is removed and the header realigned.
- **S4 Horizontal body span.** Written once, at its first column, everywhere. This is the Word EX-16 rule. `Docx_PartialHorizontalMerge_EmitsItsValueOnce…` shows why data must not be copied either: the copied ratio 0.7418 answered "Total Cost".
- **S5 Vertical body span.**
  - Repeated down when the value is data-shaped or short text (≤ ShortTextMaxChars, 40): the C5 "$95", "Included".
  - Long text is written once.
  - Column 0 under a labelled header always repeats (it is the row's identity, as H1 does).
- **Empty columns.** A body column that is empty in every row, and whose header cell is empty or duplicates another label, is dropped (this removes "TOTALS (2)").

Readers to switch onto the builder:
- `ReadHtmlTable`: th/td, colspan/rowspan; declared = all-th row or thead.
- `ReadDocxTable`: gridSpan; vMerge resolved to a row span by look-ahead; declared = w:tblHeader rows.
- `ReadPptxTable`: gridSpan, hMerge, vMerge; declared = firstRow.
- `BuildSheetRegionBlocks` (Excel): merges intersected with the region; declared = DeclaresXlsxHeaderRow.
- `EnsureGridWithinBudget` stays in the readers.

**Chunker floor (all lanes, including pipe tables)**
- `BuildRowPlans` marks a row Unlabelled when it has a filled cell beyond the header width. The exception: rows that fit the header exist, and this row's leading cells hold the same column kinds (`ColumnHoldsValues`, moved from KDP ~1069 into KC as internal).
- `SerializeRow` then writes plain values for that row.
- `PlanTableForInventory` exposes the flag, so the inventory leaves those rows out of column stats.
- `SerializeRow` also normalizes cell and label text, so an embedded newline can no longer break one-row-per-line.

**`CellText` (AUDIT-4 P1-2)**
- New `KnowledgeDocumentParser.CellText(raw)`: if the text is tag-shaped → `StripInlineHtml` (`<br>` and block tags become spaces), otherwise `DeEntitize`; whitespace and newlines collapsed.
- Applied to Excel/CSV cells in `ParseCsv` (2740) and to JSON `RenderCell` (2995) before Sanitize.

**Tests — new `CUT/KnowledgeTableSpanRuleTests.cs`** (each also asserts `output.Conservation == null`)

| Test | Input | Expect |
|---|---|---|
| `ATwoCellSectionBand_IsABand_NeverAPrice` | band row with an empty extra cell | no "Price: WAXING"; the next blank-first-cell row is not named WAXING |
| `ALongNoteSpanningColumns_IsWrittenOnce` | 400-char MSG note, colspan 6 | note appears once |
| `AColspanValue_IsWrittenOnce` | colspan value | written once |
| `ARowspanPrice_CoversItsRows` | rowspan price | price on each covered row |
| `ARowspanShortValue_CoversItsRows` | "Included" rowspan | on each covered row |
| `ARowspanLongNote_IsWrittenOnce` | long note rowspan | written once |
| `AHeaderCellSpanningIntoTheBody_IsNeverAColumnLabel` | `<th rowspan=4>Totals</th>` | no "Totals: Totals" |
| `ASideLabelOverItsRows_IsAGroupLabel` | AS-09 case 1 | "Totals⏎Coverage: Bodily Injury \| Limit: $1,000,000 \| Premium: $352" |
| `AHeaderNarrowerThanItsRows_StillLabelsEveryValueRight` | AS-09 case 2 | labels correct |
| `TwoDeclaredHeaderRows_ComposeTheirLabels` | F28 | no "Operator:" record |
| `AColspanHeaderOverSubHeaders_ComposesEachColumn` | colspan header over sub-headers | compound labels, no "(2)" |
| `AHeaderRowspanOverBothHeaderRows_IsOneLabel` | header rowspan over both header rows | one label, no "Rates: Rates" |
| `ALayoutColumnWithADuplicateLabel_IsDropped` | empty column duplicating a label | dropped, no "TOTALS (2)" |
| `Docx_AVerticallyMergedSideLabel_IsAGroupLabel` | Word side label | band rows |
| `Docx_TwoRepeatedHeaderRows_Compose` | two w:tblHeader rows | compound labels |
| `Pptx_AVerticalMergeOfALongNote_IsWrittenOnce` | PowerPoint long-note vMerge | written once |
| `ARowWiderThanItsHeaderWhoseCellsDoNotLineUp_IsUnlabelled` | chunker floor | plain values |
| `Csv_ACellHoldingHtml_ReachesTheCardAsText` | CSV HTML cell | text only |
| `Csv_AQuotedLineBreak_StaysOneCell` | CSV quoted newline | one cell |
| `Json_AValueHoldingHtml_ReachesTheCardAsText` | JSON HTML value | text only |

Plus a sweep test, `NoCardFromAnyFixture_CarriesMarkupOrEntities`: the regex `</?[a-z][^>]*>|&[a-z]+;` must match no card across KnowledgeTestDocuments and every new fixture.

**Tests to rewrite**
- `KnowledgeDocumentParserTests.Html_Table_ExpandsColspanIntoEveryCoveredColumn` → expect ["CAT 340","Available all year",""].
- `KnowledgeExtractionFidelityTests.Xlsx_AHorizontalMergeBesideOtherData_StillFillsItsRange` → expect ["Weekdays","","30 min"].
- `Xlsx_MergedCells_AreExpandedAcrossTheRangeTheyCover` → expect a band ["HAIRCUTS",""] then ["Gel manicure","45"], ["Colour","60"].

**Must stay green**
- `Html_Table_ExpandsRowspanAndColspan` (identity column under "Group"), `C2_*`, `C5_RowspanCarry_LandsOnItsOwnRow_NotALaterOne`.
- All `Docx_*Merge/Band/Span` tests and all `Pptx_*`, `X03_…HoldsItsValueOnce`, `A12_*`, `A03_*`, `A04_*`, `R3_*`.
- `EveryTableShape_StoresTheValueItsSourceActuallyHeld`. Its "ragged rows" member keeps "a: 3 | b: 4 | c: 5 | 6" thanks to the kind check.

### D. A stronger shared header check (AUDIT-4 P0-3 rule 1)

**Root cause**
- `LooksLikeALabelRow` (KDP 2104) refuses a header only for a bare currency amount.
- Dates, numbers, people's names, "Effective Date: 10/07/2026" and a title bar plus logo all pass. Live labels it produced: "09/24/2018", "10/07/2023 (2)", "Female", "Smitaben Kathiria", "43 57 Coll", "economical INSURANCE*".

**Change — new `LooksLikeAHeader(rows, h, spans?)`**

It requires `LooksLikeALabelRow`, and for every non-empty cell:
- (a) the cell is not a "label: value" pair (": " or "： " with text after it);
- (b) a data-shaped cell (new internal `KC.IsDataCell`) that is not a unit measure is allowed only when the column beneath holds data in most filled cells. This keeps "2024 | 2025" over prices and "30 min" columns.
- (c) span-aware readers: a row in which every non-empty source cell spans 2+ columns is never the label row. With a declared sub-header row beneath, S1 composes it; on its own it is a title row (TitleCaption) and the table is undeclared.

It is used by `DeclaredHeaderRowIndex` (HTML, Word, Excel), `ReadPipeTable`, `ReadPptxTable` (PX 718) and `ParseCsv`.

`IsATableHeader` (KDP 503, which protects headers from being marked as furniture) keeps the permissive `LooksLikeALabelRow`. Keeping a header costs one row; stripping one destroys the table.

**Tests — new `CUT/KnowledgeHeaderRuleTests.cs`**
- `ADateOverAColumnOfNames_IsNeverAColumnLabel` — a `<th>` row of Smitaben Kathiria | Female | 09/24/2018 over Name | Gender | DOB → undeclared.
- `YearsOverPrices_StayColumnLabels`.
- `ANameValuePairHeader_IsNeverAColumnLabel` — "Effective Date: 10/07/2026 | Totals".
- `ATitleBarAndLogoAsTheOnlyHeader_AreTheCaption`.
- `ACrossTabDurationHeader_StaysAHeader`.
- `Csv_AFirstRowOfDates_IsNotAHeader`.

### E. Aggregate cards and the overview card

Covers AUDIT-4 P0-3 rules 2-5, P2-1, P2-2 and P2-8a.

**Root cause**
- KIB 85-118: every labelled table becomes a group. There is no minimum size and no test of whether it needs more than one card.
- KIB 261-332:
  - lists text columns whose values all count once ("Female: Gender (1)");
  - takes a range over any column that is 90% numeric, including a ledger's line items plus their total.
- KIB 190-215 makes one card per column per group, with no per-document limit.
- ING 1437-1446 turns every aggregate into a card whose body starts with the document title.
- `BuildSummaryCardText` (ING 2289-2301) sizes the card by ChunkMaxTokens × 4 characters, which is wrong for CJK and Indic text (P2-1).
- KIB 219-227 drops lines without saying so (P2-2).
- The DocSummary card and the aggregates restate the same column lines (P2-8a).

**Change**
1. **Rule 2.** Groups add up their tables' token estimate (new `KC.EstimatedTableTokens`, the same estimate `SplitTable` uses at KC 956-958). A group emits aggregate cards only when that sum exceeds CardTargetTokens. The DocSummary lines still cover every labelled group.
2. **Rule 3.** A text column is kept only when its top value occurs 2+ times AND values that repeat cover at least half the filled cells (`RepeatedShareMin` const 0.5).
   - This is calibrated against the audit's "distinct ≤ half": it keeps "Excavator (3), Dozer (1), Loader (1)" and drops "(1)" lists.
3. **Rule 4.** A range needs at least MinRangeValues distinct values and must not be a ledger: the largest value must not equal the sum of the others within `LedgerTolerance` (const 0.01). Works for any grouping ParseNumeric reads: 9,49,000 / 1.234,56 / 26 699.
4. **Rule 5.**
   - Aggregates are ordered by group record count, largest first, then document order.
   - Above DocAggregateCardsWarning → warning alert.
   - Above DocAggregateCardsLimit → limit alert, and only the first Limit cards ship.
5. Unlabelled rows from C are left out of column stats.
6. **P2-1.** The summary and aggregate bodies are trimmed by `KC.ApproxTokens` (script-aware) against ChunkMaxTokens / MaxAggregateTokens, whole lines or whole "value (n)" items only.
7. **P2-2.** When lines are left out, a final "+N more" line is added if it fits, and `LinesLeftOut` is logged by ING.
8. **P2-8a.** `KnowledgeInventoryResult.CardText` (Text without the column lines of groups that have their own aggregate cards) goes on the DocSummary card. The describer and `KnowledgeSummaryFactCheck` keep the full Text.
9. **Overview bodies without the title (part of P1-6).**
   - DocAggregate = "{label}\n{text}".
   - DocSummary drops its "{title} — overview" line.
   - The model still gets the title as the passage's DocName (PKSS 847).

**New tests**
- KnowledgeInventoryBuilderTests:
  - `Aggregates_OnlyForATableThatNeedsMoreThanOneCard` — 10 short rows → none; 60 rows → yes.
  - `Columns_ThatNeverRepeat_AreNotListed`.
  - `Ranges_NeedEnoughDistinctValues`.
  - `Ranges_OverALedgerAndItsTotal_AreNotRanges` — with ₹ lakh and € decimal variants.
  - `Aggregates_ComeLargestGroupFirst`.
  - `TheInventoryBudget_SaysWhatItLeftOut`.
  - `AggregateBodies_AreHeldToTheCardCeilingInEveryScript` — Gujarati values.
  - `SummaryCardText_OmitsColumnsThatHaveTheirOwnCard`.
- Ingest:
  - `AggregateCardsPastTheWarningLevel_AlertOnce_AndAllShip`.
  - `AggregateCardsPastTheLimit_AlertAndKeepTheLargestGroups`.
  - `OverviewBodies_CarryNoDocumentTitle`.
  - `TheSummaryCard_FitsTheCardCeilingInEveryScript`.
- CIT: `KnowledgeIngestOverviewCardsIntegrationTests` — real Cosmos emulator + Azurite, like `KnowledgePicturePassesIntegrationTests:373`. Verify the `IPlatformLimitAlerts` mock for both alert types, plus PassageCount on the committed row.

**Tests to rewrite**
- `Aggregates_OnePerEligibleColumn_FullValuesAndRanges`, `Aggregates_MultiGroup_CarryTheirSectionInTheLabel`, `Aggregates_BudgetTruncates_WithHonestMoreCount`, `Columns_ValueCap_EmitsHonestMoreCount`, `Columns_EnormousLabel_IsDroppedFromStatsAndAggregates`, `Budget_DropsWholeTailLines_SectionsSurvive`.
- In KnowledgeIngestProcessorFunctionTests: `DocAggregateCards_FollowTheSummary_OnePerEligibleColumn` (larger catalogue, new body format) and `D11Failure_StructuredDocument_StillShipsTheComputedInventoryCard` (it checks that the body starts with "terms — overview").
- `NonLatinValues_ShipVerbatim` stays green under the 50% repeat rule.

### F. Section scope: headings scoped to the page, heading cards, inventory paths

Covers AUDIT-4 P0-2, P2-3, P2-7 and P1-7, and the chunker half of AUDIT-1 P0-6.

**Root cause**
- KC 86-135: the heading stack survives every page break. The only page-aware rule is AR-X13 (`StartsItsPage`, KC 358). That is why:
  - company2_home's primary-dwelling premiums are filed under "Secondary Dwelling - Rented Dwelling › Extended Coverages";
  - company1_auto's page 2 sits under "… › DIS".
- KIB 54-61 uses only the last heading's text, so same-named sections merge (P1-7).
- The chunker never emits a card for a heading (EX-21 only rescues a document with no other card).
- A paragraph that started on the previous page can caption a table (P2-3, KC 148-155 and 1489).
- Headings carry the cell separator: "1 of 2 | Primary - Homeowners…" (P2-7).

**Change**
1. **The parser marks pages that continue.** It sets `ContinuesPreviousPage` on the first block that starts on page p when:
   - (i) an unfinished sentence was carried across the page break (the break handler, KDP ~786);
   - (ii) `InheritCrossPageTableHeaders` gave a fragment its parent's header AND the fragment's column-0 labels do not repeat the parent's (share below `RepeatedFormLabelShare`, 0.5). If they do repeat, it is the same form printed for another vehicle or dwelling: the header is still inherited, but the section does not continue.
   - (iii) a paired or coalesced line run was split across the page break (GroupByPage).
   - The marking is a final pass over the finished block list. Pages rebuilt by RebuildPageByPage carry no marks, which is the conservative direction.
2. **New `Services/Knowledge/KnowledgeSectionScope.cs`** — one section-path computation:
   - the heading stack, the AR-X13 reopen, the AR-X5 picture scope (moved out of KC 84-103), and the nearest-3 / 120-char path;
   - plus the page rule: when a page's first content block (furniture, figure text and markers skipped) is not a Heading, is not marked as continuing, and the previous page did not end on a heading (a heading at the foot of a page), the stack closes before that page's first block.
   - It returns the path for each block and the point where each heading closes.
3. **The chunker uses it.** A change of path at a non-heading block ends the section exactly as a heading does. Output is byte-identical when no page reset and no empty heading occurs.
4. **Heading cards (P0-6).**
   - A heading that closes with no card emitted since it opened becomes a Text card, filed under its parent's path.
   - Consecutive empty sibling headings share one line card.
   - If every card in the document is a heading card, the EX-21 outline rescue replaces them all.
5. **P1-7.** The inventory's group signature and its "Section — N records" line use the same scope paths as the cards.
6. **One shared caption check (P2-3, and extra defect 1).** `IsRidingCaption` requires all of:
   - not furniture and not figure text;
   - no measure token;
   - not record lines (`SelfContainedLines` is null);
   - 200 characters or fewer;
   - the same picture source;
   - the SAME PAGE as the table.
   It is used both at KC 148-155 and in `FindRidingCaption`.
7. **P2-7.** A heading containing " | " reads as one title, cells joined with " — ". Nothing is deleted.
8. **Option, measure first.** A headless page whose kept furniture differs from the previous page's could take that furniture as its section ("page context", AUDIT-1 P0-3).

**Edge cases**
- Non-paginated sources (Word, HTML, Excel: every block is page 1) never reset.
- PowerPoint: a slide with no title no longer inherits the previous slide's title.
- Picture-text blocks never trigger a reset.

**Schema-free fallback** (if you refuse the block field): derive proof (ii) and the foot-of-page heading in the chunker alone. A sentence or price run that crosses a page then loses its section on page 2, but never gets a wrong one.

**Tests — new `CUT/KnowledgeSectionScopeTests.cs`**
- `AHeadlessPage_NeverInheritsThePreviousPagesSection` — company2_home shape built with `PageMarkdownSplicer.Join`.
- `ATableFragmentThePageBreakCut_KeepsItsSection`.
- `AFormRepeatedForASecondEntity_DoesNotInheritTheFirstEntitysSection`.
- `AHeadingAtThePageFoot_HeadsTheNextPagesContent`.
- `ASentenceRunningOverThePageBreak_KeepsItsSection`.
- `APriceListRunningOverThePageBreak_KeepsItsSection`.
- `APageOpeningWithItsOwnHeading_NestsNormally`.
- `PictureWords_KeepTheirOwnScope`.

**Tests in KnowledgeChunkerTests**
- `AHeadingWithNothingUnderIt_StillReachesACard`.
- `ConsecutiveEmptySiblingHeadings_ShareOneLineCard`.
- `TheLastHeadingOfADocument_StillReachesACard`.
- `AHeadingThePageResetClosed_StillReachesACard`.
- `ALogosWordsAboveATable_AreNeverItsCaption_OnEitherPath`.
- `AParagraphStartedOnTheEarlierPage_NeverCaptionsTheNextPagesTable`.
- `AHeadingHoldingACellSeparator_ReadsAsOneTitle`.

**Other tests**
- Inventory: `TheSameSectionNameUnderTwoParents_IsTwoGroups`.
- CIT: `KnowledgeIngestPageScopeIntegrationTests` — mocked DI markdown of 3 pages through the real ingest.
- Rename `Case7_HeadingOnly_NeverEmitsACard_ConsecutiveHeadingsFold`; its assertion still holds.
- Re-check any test that has a heading on page N and content on page N+1.

### G. Derived cards, retrieval seats, document identity, furniture cards

**AUDIT-4 P1-5 — derived cards take space before real content**

*Root cause*
- When the space is full (ING 1452-1482), only pictures give way (`PicturesToLeaveOut`, ING 3224).
- Derived cards (DocSummary, DocAggregate) count against the space (PassageCount, ING 1627).

*Change*
- Before pictures leave, drop DocAggregate cards (lowest priority first), then the DocSummary, until the document fits.
- Raise `KnowledgeOverviewsLeftOutSpaceFull`.
- No provider notice is needed: nothing of theirs is left out.

*Tests*
- Unit: `WhenTheSpaceIsFull_OverviewCardsGiveWayBeforePicturesAndText`.
- CIT case in `KnowledgeIngestOverviewCardsIntegrationTests`.

**AUDIT-4 P1-6 — overview cards take record seats**

*Root cause*
- PKSS `Diversify` (788-817) seats overview cards inside the topK.
- `TrimToTokenBudget` (960-1012) then keeps one overview for a lookup (wasting the other seats) or unlimited for a browse (PKSS 255) — 6 of 8 seats live.
- `KRR.Seat` (74-94) counts overviews when trimming back to topK.
- Business Search `DiversifyProviderCards` (PKSS.P 366-390) has no overview handling.
- The title inside overview bodies biases keyword and vector matching.

*Change*
- `Diversify`: overview cards never count toward the topK or the per-document cap; records fill the seats.
- `Seat` gains a `countsAsSeat` predicate so only records are counted and cut.
- `TrimToTokenBudget`: allowance = browse ? RetrievalBrowseOverviewSeats : RetrievalLookupOverviewSeats. A rank-1 overview still counts toward it.
- `DiversifyProviderCards`: records fill the topK; overview cards are kept in rank order up to RetrievalLookupOverviewSeats.
- Overview bodies drop the title (E.9).

*Tests*
- Clinqet.Mcp.UnitTests `ProviderKnowledgeSearchServiceTests`:
  - `ALookup_SeatsRecordsInEveryTopKSeat_WhenOverviewsRankAmongThem`
  - `ABrowse_SeatsAtMostTheBrowseAllowance`
  - `ARankOneOverview_CountsTowardItsAllowance`
  - `TheClosestSeat_NeverCountsAnOverviewAgainstTheRecords`
  - existing `TokenBudget_*`, `Diversity_*` and `Companion_*` stay green.
- New `Clinqet.API.UnitTests/Services/BusinessSearch/ProviderKnowledgeOverviewSeatTests.cs`.
- The three convention tests listed in section 0.

**AUDIT-4 P1-8 — document identity**
- *Root cause:* the describe prompt (`KnowledgeDocumentDescriber.cs:79-83`) asks for "what the document is", not who issued it.
- *Change:* one generic sentence in that prompt asking the title to name the issuing business or brand when the document prints one. No extra cost: the describe call is bought again on every reading anyway.
- *Test:* `KnowledgeDocumentDescriberTests.TheTitlePrompt_AsksForTheIssuer`.

**AUDIT-4 P2-6 — one-word furniture cards hold seats**
- *Root cause:* the card's vector is its prefix plus its body (KC 269). For "ABLE" the vector is effectively the document title, so it sits close to every question about that document.
- *Change:*
  - Furniture paragraphs always stand as their own card (`FromFurniture` flag) and are deduplicated across the whole document (the KC 1758 key ignores the section).
  - A furniture card or heading card with fewer than 2 letter-words is embedded by its own words, without the content prefix.
- *Tests:* `AFurnitureLine_IsOneCardForTheWholeDocument`, `ATinyContextCard_IsEmbeddedByItsOwnWords`. `A03_TheKeptFooter_IsItsOwnFurnitureParagraph…` stays green.

### H. Pictures and section stitching

**AS-13 — a repeated PDF logo becomes one card per page**

*Root cause*
- On a PDF every `<figure>` gets its own ordinal, so the parser's `CollapseRepeatedImageMarkers` (KDP 95) cannot see repeats.
- The image lane merges identical pictures into one reference, but `BuildCards` (ING 4029) emits a caption card per placement.
- Caption cards are exempt from deduplication (KC 1752).

*Change*
- `BuildCards(…, maxSectionsPerImage, out collapsed)` collapses caption cards per image reference using the parser's two rules, through a shared new `KnowledgePlacementCeiling`:
  - same section → one placement;
  - more sections than MaxSectionsPerImage → the first placement only.
- The kept card keeps its image reference. The collapsed count feeds the existing "KnowledgeSectionsPerImage" alert (ING 2546-2554).

*Test:* `ARepeatedPdfLogo_IsOneDescriptionCard`.

**AS-16 — a lower table's caption is dropped when rows merge**

*Root cause:* `SS.TryAppendRows` (258-288) copies only the lower table's `<tr>` rows, so its `<caption>` and any text outside its rows are dropped.

*Change:* merge only when that text equals the upper table's caption; otherwise keep both tables.

*Tests:* `SectionStitcherTests.ALowerHalfWithItsOwnCaption_KeepsBothTables`, `…RepeatingTheCaption_MergesWithOne`.

*Version decision:* this file is pinned. The pin must be updated. Under §0.23 this is a logic change, so the rule says raise AdjudicationRulesVersion — which buys every saved page reading again. I recommend landing it together with AUDIT-2's planned single raise. **Owner decides.**

### I. Remaining P2 items

- **F36 — figure text published twice**
  - *Cause:* `CloseFigure` (KDP 752) emits the figure's words as body text even when the transcript also printed them.
  - *Change:* a post-pass `DropFigureEchoes` drops a figure-text paragraph whose lines also appear in adjacent page text on the same page; the dropped text is added to `removed`.
  - *Test:* `LayoutMarkdown_FigureWordsTheTranscriptAlsoPrints_ReachOneCardOnce`.
- **F48 — a table inside a figure comes before its marker**
  - *Cause:* the `<table` branch (KDP 860) runs before the figure branch, so the table is emitted before the figure's marker.
  - *Change:* call `CloseFigure()` first.
  - *Test:* `ATableInsideAFigure_FollowsItsMarker`.
- **F50 — a section band is dropped as a header tail**
  - *Cause:* `IsPageBreakFurniture` (KDP 1086) drops a lone cell that ends the header cell's text, even in column 0.
  - *Change:* never treat a column-0 cell as a tail; elsewhere the tail must start at a word boundary of the header.
  - *Tests:* new `A04_ABandEqualToTheEndOfTheFirstHeader_IsKept`; `A04_TheWrappedTailOfTheParentsHeader_IsStillDroppedAsPageBreakDebris` stays green.
- **P2-4 — HTML files lose text outside table cells**
  - *Cause:* in `WalkHtml` (KDP ~2657) the table branch keeps that text only when the grid is empty.
  - *Change:* reuse `RemoveReadParts` and emit the remaining text as a paragraph.
  - *Test:* `Html_WordsATableHoldsOutsideItsCells_AreKept`.
- **P2-5 — "Effective Date: 10/07/2026: Totals" in sends**
  - Fixed at the source by D(a), so no label can contain ": ".
  - Add a guard test in `MaterialExcerptBuilderTests` that a value containing ": " stays in the value.
- **P2-9 — "·" bullets are not list items**
  - *Cause:* `IsBullet` (KDP 1143) does not know "· ", "◦ " or "▪ ".
  - *Change:* use the chunker's BulletChars, plus "N)".
  - *Test:* `LayoutMarkdown_MiddleDotBullets_AreListItems`.
- **AUDIT-4 P1-4 (# heading with a price)** — already done this session (KDP ~917) and pinned by `AHeadingCarryingAPrice_IsARecordLine`. Verify only.

---

## 2. Measuring before and after

**Free gate, every step**
- CUT `KnowledgeCardInvariantSweepTests` runs over every fixture. On every card:
  - no markup or entities;
  - no long text repeated within one row;
  - no labelled row wider than its header unless the kinds line up;
  - no section path containing " | ";
  - no aggregate whose label fails `LooksLikeAHeader`;
  - `Conservation == null` on every fixture.
- Also golden fixtures for company2_home, company1_auto and company2_auto, built with `Join`.

**Free diff on the real documents**
- A console harness in the session scratchpad only (§0.16).
- Before: read the sandbox business's live index cards (businessId filter; id, docId, chunkKind, sectionTitle, content, pageNumber) into before.json. No AI.
- After deploy and Read again: the same into after.json.
- Report per document:
  - cards by kind;
  - aggregate labels;
  - markup leaks;
  - copied cells;
  - for every money token, its (page, section, row label, column label) before and after. Moved facts are listed for a person to check; the $763/$875 should leave "Secondary…".

**Retrieval goldens (embeddings only, a few cents)**
- A goldens file outside the repos.
- Lookups: "annual premium for the rented dwelling", "bodily injury limit on the 2018 Honda", "deductible on the primary home".
- Browses: "what are the premiums on my insurance quotes", "what coverages do my quotes include".
- Each has expected value, document and page, plus forbidden pairs (e.g. $763 under a "Rented" section).
- The harness calls the real `ProviderKnowledgeSearchService.SearchAsync` (phone, `IsBrowseQuestion` per golden) and `SearchForProviderAsync` with the stamp's real search client. No realtime model, agent or judge.
- Metrics: rank of each expected card; wrong-attribution count; overview seats and their share of payload characters; junk overviews seated.
- Pass criteria:
  - Lookup: the rented $875 card is in the top 3, and no seated card pairs $763 with Rented/Secondary.
  - Browse: every quote's premium record is seated, 3 or fewer overview seats, no junk.

**Cost of the "after" run**
- Read again on the sandbox documents: page readings replay free; the describe call and embeddings per document are paid.
- The service-drafts pass that runs after a reading also calls AI. Optionally switch drafts off on the sandbox to save that.

---

## 3. Implementation order

Each step builds and passes its suites on its own.

| Step | What | Depends on | Suites to run |
|---|---|---|---|
| 0 | Capture the before baseline (no code) | — | — |
| 1 | `CellText` + `SerializeRow` normalization + markup sweep | — | CUT, API |
| 2 | Section A (P0-4, P0-8) | — | CUT, API |
| 3 | Section B (P1-2, P1-5) | — | CUT |
| 4a | `KnowledgeTableGrid` + HTML reader + chunker width floor (rewrite the 2 HTML/shape tests) | — | CUT, API |
| 4b | Word/PowerPoint/Excel onto the builder (rewrite the 2 Excel tests) | 4a | CUT, API |
| 5 | Section D header check | 4a/4b (span info) | CUT |
| 6 | Section E + settings + 2 alert types + admin labels | 5 | CUT, CIT, web admin ESLint/tests, mobile admin tests |
| 7 | P1-5 give-way + third alert type | 6 | CUT, CIT |
| 8 | Section F (block field, scope, heading cards, captions, P2-7, P1-7, P2-6) | — (inventory switch after 6) | CUT, CIT, API |
| 9 | P1-6 seats | independent, can run in parallel with 2-8 | Mcp.UnitTests, API.UnitTests, all three convention tests |
| 10 | AS-13 | — | CUT |
| 11 | AS-16 | owner's version decision | CUT incl. BankRulesVersionConventionTests |
| 12 | Section I + P1-8 | — | CUT, Mcp.UnitTests |
| 13 | Deploy to sandbox, Read again, after-measurement; update SKILL.md ×4 (function-app, voice-assistant, business-search) and memory | 1-12 | — |

---

## 4. Additional defects found

1. **`FindRidingCaption` (KC 1489-1503) skips the guards the consumption check uses (KC 148-155).** It does not check figure text, measure tokens or record lines. So a logo's words or a priced line above a table still becomes that table's caption: printed twice, and repeated on every split card. F20 is therefore not fully fixed. Fixed by F.6.
2. **The price-run passes move banners to the end of the run.** `PairLabelValueRuns` and `CoalesceValueLineRuns` (KDP 1383, 1495) append banners after the run, so a page-1 banner lands after page-2 rows. Fix: re-insert each banner before the first output block of its page.
3. **`ParseHtml` loses text outside table cells** (KDP ~2657). The session fixed only the markdown lane. Fixed by P2-4.
4. **The oversized-caption alert reports a setting as the actual value.** ING 1317-1323 passes `_settings.ImageCaptionMaxTokens` as the actual number. It should be the largest measured caption token count.
5. **MEB `PieceHeadLength` (383-396) reads a caption containing ": " as a row identity.** CompletionChain then glues a table's split cards into one record in a send. Fix: identity only when the card's other lines are single cells (no " | "), which is how `SplitOversizeRow` writes pieces.
6. **Do not move the drafts detector onto the shared section scope here.** `KnowledgeServiceCandidateDetector` keeps last-heading sections, and its RowHash includes the section (:125-129). Moving it would re-key every decided draft row. It needs its own change.
7. **Two aggregate cards can get the same label.** KIB 207: two groups under one section both get "Section — price".
8. **The MaxSectionsPerImage ceiling has one generic alert** (ProviderContentLimitReached, ING 2549) rather than a warning level plus a limit with their own types. That breaks the cost-limit rule now that AS-13 extends it to PDFs. Owner decision.

---

### Critical Files for Implementation
- C:\Nik\clinqetinfrastructure\Services\Knowledge\KnowledgeDocumentParser.cs (plus .OpenXml.cs and .Pptx.cs)
- C:\Nik\clinqetinfrastructure\Services\Knowledge\KnowledgeChunker.cs
- C:\Nik\clinqetinfrastructure\Services\Knowledge\KnowledgeInventoryBuilder.cs
- C:\Nik\clinqetfuncations\Clinqet.Communications\Functions\KnowledgeIngestProcessorFunction.cs
- C:\Nik\clinqetinfrastructure\Services\Knowledge\ProviderKnowledgeSearchService.cs (plus .Provider.cs and KnowledgeRelevanceRanker.cs)