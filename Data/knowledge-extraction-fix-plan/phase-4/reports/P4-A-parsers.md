# P4-A — Parsers and passage creation (closing audit, read-only)

Auditor: dimension A. Date: 2026-09-25. Code state: every repo clean at HEAD —
`clinqetinfrastructure 89035c3`, `clinqetcore b9cfe21`, `clinqetfuncations 2f34b5a`, `clinqetapi 2e47eca`,
`clinqetshared b3c821d`. Nothing was built, run, edited or written except this file.

---

## 1. Scope actually read

| File | Lines | How |
|---|---|---|
| `clinqetinfrastructure/Services/Knowledge/KnowledgeDocumentParser.cs` | 2,351 | end to end |
| `…/KnowledgeDocumentParser.OpenXml.cs` | 1,439 | end to end |
| `…/KnowledgeDocumentParser.Pptx.cs` | 680 | end to end |
| `…/KnowledgeOoxmlText.cs` | 219 | end to end |
| `…/XlsxCellFormatter.cs` | 301 | end to end |
| `…/KnowledgeChunker.cs` | 1,658 | end to end |
| `…/KnowledgeInventoryBuilder.cs` | 478 | end to end |
| `…/KnowledgeChartReader.cs` (119), `KnowledgeDiagramReader.cs` (157), `KnowledgeTextDecoder.cs` (162), `HiddenTextStyles.cs` (88), `OpenXmlPackageInspector.cs` (53), `KnowledgeFigures.cs` (111), `DocumentPageCounter.cs` (38) | — | end to end |
| `clinqetcore/Models/Knowledge/KnowledgeText.cs` (186), `KnowledgeTokenEstimate.cs` (79), `KnowledgeBlocks.cs` (178), `KnowledgeChunk.cs` (74), `KnowledgeCardPrefix.cs` (67), `KnowledgeBlockText.cs` (25), `KnowledgeInventory.cs` (28) | — | end to end |
| `clinqetcore/Utilities/TextScriptDetector.cs` | 309 | end to end |
| `clinqetfuncations/Clinqet.Communications/Services/KnowledgeDocumentFormats.cs` | 58 | end to end |
| Call sites read to settle behaviour | — | `KnowledgeIngestProcessorFunction.cs` 580-630, 738-777, 930, 1560-1627, 3650-3720; `PageMarkdownSplicer.cs` (grep + line 35); `ProviderKnowledgeSearchService.cs` 1090-1115; `VisionTranscriptionSettings.cs` 110-140; both hosts' `TranscribePromptTemplate` in appsettings |
| Tests | — | Test NAMES of every Knowledge test file listed; bodies read for: `KnowledgeDocumentParserTests` 20-200, 480-560, 1160-1296; `KnowledgeCorruptionRegressionTests` 150-250; `KnowledgeChunkerTests` 95-135, 1440-1478; `KnowledgeInventoryBuilderTests` 76-165; `KnowledgeExtractionFidelityTests` 1736-1760, 2093-2118, 2840-2880; `KnowledgeChunkerLineStructureTests` (grep); `KnowledgeCjkFieldTests` (names); `TextScriptDetectorTests` (API, names). Coverage of each phase-1 rule was settled by targeted grep across ALL Knowledge test files (§4) — I did NOT read all 30,170 test lines. |
| Harness `C:\Nik\knowledge-table-hunt` | — | **Does not exist.** Deleted 2026-09-22 (owner-approved, memory `timeprovider-governor-wallclock-2026-09-22.md:83-90`); only its three docs were archived to `Data\knowledge-extraction-audit\archive-table-hunt-2026-08-18\`. No `.cs` of it exists anywhere under `C:\Nik`. Groups listed from `phase-1\baseline\table-hunt-AFTER.txt`: B01-B23, C01-C16, A01-A13, F01-F04, ADV01-ADV13, R701-R710, L01-L05, INV01-INV06, D01-D13 (103). ADV cases read from phase-1 `AUDIT.md` §3. See P4-A-24. |
| Authority docs | — | FINDINGS §0-§9 in full; PLAN.md in full; phase-1 AUDIT.md in full; phase-2 AUDIT.md in full; PROGRESS-SESSION2 §15-§17; phase-3 AUDIT §0-§2 + grep for detector items |

---

## 2. Findings

Severity follows the owner ruling: every extraction/passage defect is High or Critical.
"Conf." = confidence in the mechanism; NEEDS-LIVE-PROOF where frequency or third-party behaviour decides impact.

### Critical

#### P4-A-01 — PowerPoint table merges double-count columns: every column after a horizontal merge takes the wrong label
- **Where:** `KnowledgeDocumentParser.Pptx.cs:647-662`
- **Evidence:**
  ```csharp
  foreach (var cell in cells)
  {
      var text = KnowledgeOoxmlText.FlattenInline(cell);
      if (cell.VerticalMerge is { Value: true }) text = carry.TryGetValue(column, out var carried) ? carried : text;
      else carry[column] = text;
      var span = Math.Max(1, cell.GridSpan?.Value ?? 1);
      for (var s = 0; s < span; s++) { line.Add(s > 0 ? string.Empty : text); column++; }
  }
  ```
  The logic was copied from the Word reader ("EX-16, the same structural rule the DOCX reader applies"). In WordprocessingML a `gridSpan` cell REPLACES the cells it covers; in DrawingML (PowerPoint) every covered grid position is STILL PRESENT as `<a:tc hMerge="1">`. The code pads `span` columns for the origin AND adds one more column for each `hMerge` placeholder. There is no `HorizontalMerge` handling anywhere (grep: 0 hits).
- **The guard pins the wrong shape:** `KnowledgeExtractionFidelityTests.cs:1740-1757` + helper `:2862` build the band as ONE `a:tc` with `GridSpan = span` and no placeholders, commented *"One cell that spans the whole row: a section band, in the shape PowerPoint actually writes."* PowerPoint writes `gridSpan` + `hMerge` placeholders. The test asserts `Assert.Equal(3, bandRow.Count)`; a real deck yields 5.
- **Violates:** EX-16 / X-03 ("a merged cell holds ONE value… a PARTIAL merge shifted every later value onto the wrong label"), R1 (never a wrong binding).
- **Failure:** header row `Service | Price (merged over Short, Long) | Duration | Deposit` (XML: 5 `a:tc`, one `gridSpan=2`, one `hMerge`) → header entries `[Service, Price, "", "", Duration, Deposit]` (6) while data rows have 5 → data `Haircut | $25 | $35 | 30 min | $10` serializes `… | 30 min | Duration: $10` — the deposit is spoken as the duration, the Deposit label binds nothing.
- **Fix:** skip `a:tc` with `hMerge=1` (they are placeholders) instead of padding `span` columns — or pad and skip, never both. Rebuild the fixture from a real PowerPoint-saved table.
- **Conf.:** High on code; NEEDS-LIVE-PROOF: one PowerPoint-saved deck with a merged header cell through `ParsePptx`.

### High

#### P4-A-02 — R-3 only half built: the vision transcriber is still TOLD to write "the header row first", and the veto only refuses a row holding a bare amount
- **Where:** `clinqetshared/Models/VisionTranscriptionSettings.cs:124`, `Clinqet.Communications/appsettings.json:1408`, `Clinqet.API/appsettings.json:2254` (all: *"…tables as GitHub pipe tables with the header row first and one row per line…"*); `KnowledgeDocumentParser.cs:1211` and `:1466-1480`.
- **Evidence:** `return new KnowledgeTableModel { Rows = rows, HasHeaderRow = rows.Count > 1 && LooksLikeALabelRow(rows[0]) };` and `LooksLikeALabelRow` vetoes only `KnowledgeChunker.IsBareAmountCell(text)` (a currency amount); any row of ≥2 distinct text/duration/time cells passes. `git log -S"header row first"` shows the prompt last changed in `ce84b94`, before the programme.
- **Violates:** R-3 as approved in `PHASE-1-PROMPT.md:24`: *"…and change the transcription prompt to write a header row only when the page prints one"*. phase-1 AUDIT §1 A5 row records only the veto; the prompt half is recorded nowhere as done or waived.
- **Failure:** a headerless hours table on a flyer (`Monday | Closed`, `Tuesday | 9:00-17:00`) — GFM needs a header row, the prompt says header first, the model puts row 1 there; `LooksLikeALabelRow(["Monday","Closed"])` = true → cards read `Monday: Tuesday | Closed: 9:00-17:00`. A page-2 continuation whose first row is text/duration-only (`Deep tissue | Firm pressure | 60 min`) is promoted the same way, so `InheritCrossPageTableHeaders` skips it (`fragment.HasHeaderRow → continue`, `:660`). The chunker test that pins "text-valued row zero survives unlabelled" (`KnowledgeCorruptionRegressionTests.cs:212-232`) feeds `HasHeaderRow = false` directly and never goes through `ReadPipeTable`, so it cannot see this.
- **Fix:** make the prompt change R-3 approved (write an EMPTY header row when the page prints none — the existing veto then refuses it, distinct < 2); the fingerprint moves and the page cache re-transcribes (say so to the owner).
- **Conf.:** High on code; NEEDS-LIVE-PROOF on how often the model promotes a data row (live evidence so far shows empty header rows).

#### P4-A-03 — The first kept copy of a page footer/header (A16) sits BETWEEN a table and its page-2 continuation, so the cross-page header inheritance never fires
- **Where:** `KnowledgeDocumentParser.cs:193-203` (DI comments: first copy kept in place), `:279-295` (vision lines: first copy kept in place), `:652-662` (inheritance needs `blocks[i - 1].Kind == Table`); `PageMarkdownSplicer.cs:35` (`string.Join("\n" + PageBreak + "\n", pages…)` — page 1's last line is its footer).
- **Evidence:** `if (blocks[i].Kind != KnowledgeBlockKind.Table || blocks[i - 1].Kind != KnowledgeBlockKind.Table) continue;`
- **Violates:** A5/L-3 fix ("inherit the previous fragment's header when widths agree; one logical table across pages") — undone by the A16 fix for the commonest multi-page layout (a running footer or a page-1-only header line).
- **Failure:** 3-page salon menu, header row printed once, footer `Glow Salon · 416-555-0100` on every page → block stream `Table(p1) · Paragraph(footer) · Table(p2)` → page-2/3 rows unlabelled (`Straightening | $200 | 150 min`) exactly as live row 1 of FINDINGS §8.1; the footer paragraph (≤200 chars) is then consumed as the continuation table's CAPTION (`KnowledgeChunker.cs:113-116`) and printed on its cards. The only continuation test (`C3_CrossPageContinuation_InheritsTheParentsDeclaredHeader`, `KnowledgeCorruptionRegressionTests.cs:184`) has nothing between the tables.
- **Fix:** when looking for the parent fragment, step back over non-table blocks that came from page-edge furniture (or place the kept first copy after the table run / at the page's end of the stream), still requiring the page break and width agreement.
- **Conf.:** High (code path certain).

#### P4-A-04 — Cross-page inheritance DELETES any leading one-cell row of the continuation (a section band or an unpriced service)
- **Where:** `KnowledgeDocumentParser.cs:670` and `:688-695`
- **Evidence:**
  ```csharp
  var rows = fragment.Rows.SkipWhile(IsPageBreakFurniture).ToList();
  …
  private static bool IsPageBreakFurniture(IReadOnlyList<string> row)
  { if (row.Count < 2) return false;
    var filled = row.Count(cell => !string.IsNullOrWhiteSpace(KnowledgeText.Normalize(cell)));
    return filled <= 1; }
  ```
  The new table is `new[] { header }.Concat(rows)` — the skipped rows are gone.
- **Violates:** R-13 ("facts are never deleted"), phase-1's "0 words lost" claim; the chunker's own R4 treats the SAME shape as a section label to be emitted (`KnowledgeChunker.cs:1230-1233`).
- **Failure:** page 2 of a price table opens with the band `NAIL SERVICES` (DI `<td colspan=3>` → `CollapseFullWidthSectionRows` → `[NAIL SERVICES, "", ""]`, or a vision row `| Nail services | | |`) → the band's words never reach the index; the nail rows inherit labels but lose their section. Same for a first row `Consultation | |` (a service with no printed price).
- **Fix:** only drop a leading row that is blank or whose single filled cell continues a header cell of the parent (same column index, header cell ending mid-phrase); keep every other one-cell row as a data/band row.
- **Conf.:** High.

#### P4-A-05 — `IsCrossTabHeader` promotes a row holding ONE lone text cell — the A5-L "`destroyed:`" label returns whenever inheritance is blocked
- **Where:** `KnowledgeChunker.cs:1049-1066`
- **Evidence:** `if (header.Count < 2 || !string.IsNullOrWhiteSpace(header[0])) return false; … labelled++; } return labelled > 0;`
- **Violates:** A5-L fix direction: *"a row-0 that is blank or that continues a wrapped header cell must never be a header"*; inconsistent with `LooksLikeALabelRow` (≥2 distinct words) and with the parser's own `IsPageBreakFurniture` which calls the same shape furniture.
- **Failure:** the 31-page BMR pack's page-22 fragment `| | | | destroyed | | |` whenever inheritance is refused — any ragged row (`rows.Any(r => r.Count != header.Count)`, `:671`), the furniture paragraph of P4-A-03, or a parent whose header was vetoed → chunker makes `destroyed` the column label and `null` the rest → `Printed foil / label | … | destroyed: Actual | …` — the exact live defect of FINDINGS A5-L.
- **Fix:** require the labelled cells to cover most non-corner columns (and at least two), matching the declared-header veto.
- **Conf.:** High.

#### P4-A-06 — Seven unguarded `GetPartById` calls: one dangling or external relationship makes the WHOLE Office document unreadable, forever "retryable"
- **Where:** `KnowledgeDocumentParser.OpenXml.cs:477`, `:492`, `:860`, `:1332`; `KnowledgeDocumentParser.Pptx.cs:41`, `:556`, `:567`. Guarded siblings: `OpenXml.cs:207-208`, `:292-293`, `Pptx.cs:334-335` (`catch (ArgumentOutOfRangeException) { continue; }`).
- **Evidence:** `if (mainPart.GetPartById(relationshipId!) is not ImagePart vmlPart) continue;` — `GetPartById` throws `ArgumentOutOfRangeException` for an id that is not an internal part (the three guarded sites prove the authors know it). The throw leaves `ParseDocx/ParseXlsx/ParsePptx`; `KnowledgeIngestProcessorFunction.TerminalReasonFor` (`:3671-3694`) knows only `DocumentExtractionException`/`FileFormatException`/`InvalidDataException`, so it returns null and `:762` throws `KnowledgeIngestRetryableException` — the deterministic crash is retried and then ends as a generic failure the provider cannot fix.
- **Violates:** A17 ("a linked picture is counted, not ignored"), C1/R-5 (a bad FILE must not look like a bad MOMENT), R-13 (no content lost).
- **Failure:** a Word file whose one picture has a broken relationship (third-party generators, damaged-but-openable files Word repairs silently), or a legacy VML picture whose `r:id` names an external link (UNCERTAIN which Word versions write that) → every word of the document is lost, every retry pays again.
- **Fix:** one helper `TryGetPart(container, id)` used at all ten sites; a missing part is a counted skip.
- **Conf.:** High on code; NEEDS-LIVE-PROOF on the VML-external variant.

#### P4-A-07 — Dense-grid amplification: a few KB of markup allocates gigabytes before any cap can see it
- **Where / evidence:**
  - XLSX column index has no bound: `KnowledgeDocumentParser.OpenXml.cs:1427-1437` (`index = index * 26 + …` — `AAAAAA1` = column 12,356,630; unchecked overflow for longer); every row is padded to its rightmost cell `:889-894` (`while (lastColumn + 1 < column) { line.Add(string.Empty); lastColumn++; }`); merges pad to `ToColumn` `:915`, `:921-925`; `rows × merges` loop `:897-926`.
  - DOCX `gridSpan` unbounded `:804-811`; PPTX `gridSpan` unbounded `Pptx.cs:656-661`.
  - CSV squares every row to the widest `KnowledgeDocumentParser.cs:2029-2033`.
  - HTML spans are capped at 100 EACH (`:1486-1487`), so one `<td colspan=100 rowspan=100>` is 10,000 cells, re-copied into a fresh `placed` dictionary on every row (`:1323-1324`).
  - The only content ceiling runs AFTER the parse and counts characters (`KnowledgeBlockText.cs:6-23`) — the amplified cells are empty strings and count 0. `OpenXmlPackageInspector` bounds XML bytes, not grid cells.
- **Violates:** the stated posture of `OpenXmlPackageInspector.cs:6-10` / `KnowledgeDocumentParser.cs:44-49` (a hostile package must cost bounded memory; OOM "kills the worker with every other document, email and notification in flight").
- **Failure:** 1,000 rows each holding one cell at `AAAAAA` (≈40 KB of XML, tiny zipped) → 1.2×10¹⁰ references; a 1 MB CSV line of commas plus 1,000 short rows → 10⁹ cells; `<table><tr>` with 10⁴ `<td colspan=100 rowspan=100>` (≈350 KB) + 99 one-cell rows → 10⁸ cells + 10⁹ dictionary inserts. Each redelivery repeats it (both the ingest and the drafts job parse).
- **Fix:** clamp column indexes and spans to Excel's 16,384 / a table-width cap; cap total cells per table (and per document) and stop with a counted "table too large" notice rather than materialising.
- **Conf.:** High on code; NEEDS-LIVE-PROOF on whether the host dies (Linux OOM-kill) or throws `OutOfMemoryException`.

#### P4-A-08 — Two recursions on attacker-controlled nesting survive the 2026-09-03 stack-overflow fix
- **Where:** `KnowledgeDocumentParser.cs:1957-1958` (`case "pre": blocks.Add(new KnowledgeBlock { Kind = KnowledgeBlockKind.Preformatted, Text = HtmlEntity.DeEntitize(child.InnerText) });`); `KnowledgeDocumentParser.Pptx.cs:173-174` (`case P.GroupShape group: CollectPptxShapes(group, state, skipTitleShape);`) and `:209-216` (AlternateContent re-enters `CollectPptxShapes`), no depth parameter.
- **Evidence:** HtmlAgilityPack's `InnerText` recurses once per child level (`InternalInnerText`); the only bound is `HtmlDocument.MaxDepthLevel`, which this codebase never sets (grep: 0 hits) and whose default the 1.11.71 package docs do not state — exactly the property the file's own comment calls fatal (`:1413-1418`, `:1648-1651`: *"a recursive read dies on an uncatchable StackOverflowException that takes the whole worker with it"*). The DOCX path is iterative with depth caps (`OpenXml.cs:416-446`, `KnowledgeOoxmlText.cs:21-23`); the PPTX shape walk is not.
- **Tests:** `Html_DeeplyNestedMarkup_DoesNotOverflowTheStack` / `…InsideAHandledContainer…` (`KnowledgeExtractionFidelityTests.cs:2093-2118`) cover `<div>` and `<p><span>` only — no `<pre>` case, no deep-group PPTX case.
- **Failure:** `<pre>` followed by 40,000 nested `<b>` (≈0.5 MB .html) → worker process killed; a slide with ~10,000 nested `p:grpSp` → same (or the SDK's own loader dies first — either way the worker).
- **Fix:** read `<pre>` with the iterative `NodeText(child)` (keepLines); make `CollectPptxShapes` iterative with the same 64-depth cap the Word walk uses.
- **Conf.:** High on our code; NEEDS-LIVE-PROOF in a child process (the test host would die).

#### P4-A-09 — EX-32 is broken for typed Markdown: a `.md` file goes through the RENDERED-page rule and loses real hyphens
- **Where:** `KnowledgeDocumentParser.cs:1993-2000` (`return ParseLayoutMarkdown(text) with { PageCount = null };`) → `:402` (`markdown = KnowledgeText.DehyphenateRenderedPage(markdown);`, unconditional).
- **Violates:** EX-32 as ruled (phase-1 AUDIT §15 table): *"Typed (DOCX, XLSX, PPTX, HTML, TXT, MD, JSON) — join, keep the hyphen"*. The comment at `:397-401` (*"THE RENDERED-PAGE lane, and the only one … A typed document keeps every hyphen it carries"*) is false for `.md`.
- **Failure:** a hand-wrapped `.md` price sheet `Our anti-⏎ageing facial $80` → indexed `antiageing facial $80` (≥3 letters before the hyphen, and the document does not spell `anti-ageing` elsewhere) — the non-word the owner's EX-32 challenge was about. The typed-lane test `Case4_ATypedDocument_KeepsEveryHyphenItCarries` (`KnowledgeChunkerTests.cs:101`) calls `KnowledgeChunker.Dehyphenate` directly, never the `.md` parser.
- **Fix:** a `rendered` flag on `ParseLayoutMarkdown` (true only from DI/vision/picture text); `ParseText` passes false.
- **Conf.:** High.

#### P4-A-10 — EX-24 fixed per BLOCK kind, not per ENTRY kind: a paragraph of prices plus notes still prints a wrong count to the model
- **Where:** `KnowledgeInventoryBuilder.cs:62-68` (a paragraph's self-contained lines are all entries of kind `Paragraph`), `:80-87` (all non-bare table rows), `:133-137` (`NoteKind(KnowledgeBlockKind kind)`), `:228`.
- **Violates:** PLAN 0a EX-24 ruling: *"a count is printed only when every entry in that section is the SAME KIND"* — the harm named was *"a caller asking 'how many colouring services?' could be told twelve"*.
- **Failure:** the commonest OCR flyer shape — one paragraph `Haircut $25 ⏎ Colour $50 ⏎ Perm $80 ⏎ All prices include HST. ⏎ Walk-ins welcome.` → `SelfContainedLines` returns 5 lines (the notes end in `.`) → one kind → `Sections: HAIR (5)` for 3 services. Two tables in one section (prices + terms) sum the same way. All four EX-24 tests (`KnowledgeInventoryBuilderTests.cs:100-158`) mix DIFFERENT block kinds.
- **Fix:** count only entries that carry a value (a priced/measured line or a table data row with a value cell) or suppress the count when a block's lines are not all of one shape.
- **Conf.:** High.

#### P4-A-11 — PowerPoint never runs the R7 pairing: one text box per name and per price glues into one blob (A1/L-4 class), and E-19 is never counted
- **Where:** `KnowledgeDocumentParser.Pptx.cs:96-97` (`ZipValueColumnBoxes(blocks); CoalesceValueLineRuns(blocks);` — no `PairLabelValueRuns`); `:413` (zip needs ≥2 lines per box); `KnowledgeDocumentParser.cs:962-964` (`$25` alone is not self-contained: `IsValueTerminated` / `EndsInABareNumber` need ≥2 tokens).
- **Violates:** A1 / L-4 / R-2 (*"one-item-per-line price lists are glued into one paragraph card"*), which every other lane now pairs (`Html_ParagraphPerLine_PairsLikeAFlattenedTable`, `Docx_ParagraphPerLine_PairsLikeAFlattenedTable`).
- **Failure:** a designed price slide with a text box per item and per price (reading order `Haircut`, `$25`, `Beard trim`, `$15`, …) → four one-line Paragraph blocks → 0% self-contained → no coalesce → the sentence packer joins them: `Haircut $25 Beard trim $15 Kids cut $18 …` in one card.
- **Fix:** call `PairLabelValueRuns` (and keep its count) in `ParsePptx` exactly as `ParseDocx` does.
- **Conf.:** High on code; the layout's frequency is NEEDS-LIVE-PROOF.

#### P4-A-12 — A title row above a declared header throws the whole declaration away, and the R-1 context line cannot rescue it
- **Where:** XLSX `OpenXml.cs:1073-1075` (header must be `region[0]`), `:1227` (`if (rowIndex != 1) return false;` for a freeze), `:1225` (autofilter must start at `region[0]`); DOCX `:819` + `:826-832` (only `rows[0]` is read); HTML `KnowledgeDocumentParser.cs:1356-1360`, `:1377-1379` (row 0 only); chunker `KnowledgeChunker.cs:967` (`if (row.Count < 2 || !AllDistinctText(row)) return caption;` — a title band has one distinct word).
- **Violates:** A11 / L-6 (*"Accept a freeze at row N as declaring rows 1..N as header rows"*), A6 / R-1 (context line on every card).
- **Failure:** the commonest real price sheet — row 1 `Glow Salon Price List 2026` (merged), row 2 `Service | Price | Duration`, pane frozen below row 2 (or a filter on row 2, or two `w:tblHeader` rows, or a two-row `<thead>`) → region/table row 0 is the title → `LooksLikeALabelRow` refuses it → no labels; the real header is a data row; the table is split and cards 2..n read `value | value | value` with no context (FINDINGS A6's original symptom). Only "Format as Table" survives (the table range cuts the region at its own header row, `:1056-1057`).
- **Fix:** within a declared header block, take the LAST row that passes the label veto as the header and carry the title rows as the caption.
- **Conf.:** High.

#### P4-A-13 — A21's CJK sentence stops are dead in unspaced CJK prose
- **Where:** `KnowledgeChunker.cs:34-41` (terminators added), `:635-639`: `if (!atEnd && !char.IsWhiteSpace(text[i + 1])) continue;`
- **Violates:** A21 (*"no CJK/Arabic terminators (。！？؟)… add the terminators"*). Chinese and Japanese put no space after `。`, so a CJK paragraph is ONE sentence; over budget it falls to `SplitAtWordBoundaries`, which cuts at the first whitespace found in the window (often a Latin brand/number early in the window, producing tiny pieces) or, with none, at the last punctuation of any kind (`、`, `，`) — mid-sentence. No test anywhere contains `。` (grep of every `*.cs` test and the harness list).
- **Fix:** treat full-width terminators as boundaries without requiring following whitespace.
- **Conf.:** High.

#### P4-A-14 — A13 residuals: `!important` and a CSS comment defeat the hidden-content rules
- **Where:** `KnowledgeDocumentParser.cs:1611-1625` (`value.Equals("none", …)` — `none !important` is not equal), `:1570` + `:1598-1604` (a selector carrying a preceding `/* … */` fails `text[..dot].All(char.IsLetter)`).
- **Violates:** A13 as scoped: *"Remove `[hidden]`, `[aria-hidden=true]`, inline `display:none`/`visibility:hidden`"*.
- **Failure:** `<p style="display:none !important">Internal note: raise colour to $95</p>`, or `<style>/* old */ .old{display:none}</style>` — the hidden text is indexed and can be SENT.
- **Fix:** strip `!important` and CSS comments before comparing.
- **Conf.:** High. (No test of any A13 rule exists — P4-A-24.)

#### P4-A-15 — `KeepFirstFurniture` drops the FIRST copy of a one-word-plus-number header/footer; the regex's own invariant comment is false there
- **Where:** `KnowledgeDocumentParser.cs:156-161` (comment: *"‼️ Only ever applied to a line that ALREADY repeats across pages, so a real one-line value can never be removed by it."*), `:200` (`if (inner.Length == 0 || PageOrdinalLine().IsMatch(inner)) return string.Empty;` — every DI furniture comment, first occurrence included, even on a one-page file).
- **Violates:** A16 (*"Keep the FIRST distinct header/footer text…; drop only the repeats and page numbers"*).
- **Failure:** DI-labelled header `Menu 2026`, footer `Since 1998`, `GST 5%`, `Suite 200` (pattern `\p{L}{1,12} + ≤4 digits`) → deleted everywhere.
- **Fix:** at `:200` drop only when the digits count the page (`CountsThePage`), or when the text is a `PageNumber` comment.
- **Conf.:** High.

#### P4-A-16 — X-06 re-opened: coalesced and paired runs merge blocks across a page break and stamp the whole run with the first page
- **Where:** `KnowledgeDocumentParser.cs:943` (`var page = blocks[start].PageNumber;` in `CoalesceValueLineRuns`), `:866` (same in `PairLabelValueRuns`).
- **Violates:** X-06 / EX-08 (a card must not claim a page its text is not on). The page-change close (`KnowledgeChunker.cs:1468-1482`) cannot fire inside one block.
- **Failure:** a one-line-per-item price list running from page 1 to page 2 → one block labelled page 1 → Business Search's page/view for a page-2 price opens page 1.
- **Fix:** break the run at a page change (or split the produced block per page).
- **Conf.:** High.

#### P4-A-17 — Word rows with `w:gridBefore` are read one column to the left
- **Where:** `KnowledgeDocumentParser.OpenXml.cs:776-813` — `col` starts at 0 for every row; `GridBefore`/`WidthBeforeTableRow` never read (grep: 0 hits).
- **Failure:** a table where some rows start at grid column 2 (Word writes `gridBefore` after "delete cell, shift left" and in PDF→Word conversions) → every value in those rows sits under the previous column's label (`Price: 30 min`).
- **Fix:** start `col` at `gridBefore` and pad.
- **Conf.:** High on code; NEEDS-LIVE-PROOF on frequency.

#### P4-A-18 — Excel values are not what the sheet shows for plain decimal formats and for currency CODES
- **Where:** `XlsxCellFormatter.cs:27-34` (built-in ids 2 `0.00` and 4 `#,##0.00` absent), `:75` (`if (format.Kind == Shape.Plain) return raw;`), `:208-209` + `:257-267` (only a Unicode currency-SYMBOL character is captured; `[$Rs.-4009]`, `"kr"`, `[$CAD]` capture nothing → Passthrough), `:222-224`.
- **Failure:** a tax-inclusive price computed by formula caches `22.588699999999999` (Excel writes round-trip precision) and the sheet shows `22.59` → the card says `22.588699999999999`; `25` formatted `#,##0.00 "kr"` is indexed as bare `25`, so no price mark and no currency.
- **Fix:** apply the decimal count of any numeric format (not only currency/percent); treat a bracketed `[$XXX-…]` or quoted alphabetic code as the currency label.
- **Conf.:** High on code; NEEDS-LIVE-PROOF on a real Excel-saved sheet.

#### P4-A-19 — Japanese workbooks: phonetic guide text (`rPh`) is glued into every cell
- **Where:** `KnowledgeDocumentParser.OpenXml.cs:1309` (`table.Elements<SharedStringItem>().Select(item => item.InnerText.Trim())`), `:1398` (`cell.InnerText` for inline strings). `InnerText` concatenates every descendant `t`, including `<rPh><t>` phonetic runs, which Japanese Excel stores automatically for IME input.
- **Failure:** `東京` with reading `トウキョウ` indexed as `東京トウキョウ` — invented text, and CJK bigrams that match nothing.
- **Fix:** read only `si/t` and `si/r/t`, never `rPh`.
- **Conf.:** Medium (SDK `InnerText` semantics); NEEDS-LIVE-PROOF on a Japanese-IME workbook.

#### P4-A-20 — A declared legacy charset (Shift_JIS, GBK, Big5, EUC-KR, windows-1251) is decoded as windows-1252
- **Where:** `KnowledgeTextDecoder.cs:124-136` (`_ => null`), `:51` (fallback `Windows1252`); `.txt` never consults a declaration (`:29`).
- **Failure:** a saved Chinese/Japanese/Russian page or an older Chinese-Windows `.txt` (ANSI = GBK) indexes as mojibake — now for scripts the detector claims to support. The comment's reason (*"a dependency (and an ARM/deploy entry) we do not need"*) does not hold: `CodePagesEncodingProvider` ships in the .NET shared framework and needs no deploy entry.
- **Fix:** register `CodePagesEncodingProvider` and honour any declared charset.
- **Conf.:** High on code; frequency NEEDS-LIVE-PROOF.

#### P4-A-21 — A Word document typed inside one floating text box loses its headings and tables
- **Where:** `KnowledgeDocumentParser.OpenXml.cs:50-57` (body text empty ⇒ only the box), `:224-266` (`FloatingBoxLines`: every innermost `p` is a line; one box ⇒ one `List` block).
- **Failure:** the whole document becomes one List: heading styles are never resolved, a table inside the box becomes one line per CELL (`Haircut`, `$25`, `Colour`, `$50`), and no pairing runs on a List. Words survive; structure does not.
- **Fix:** run the box's own paragraphs/tables through the body reader (headings, tables, pairing) instead of flattening to lines.
- **Conf.:** High.

#### P4-A-22 — CSV re-introduces header INFERENCE with no veto (owner ruling needed)
- **Where:** `KnowledgeDocumentParser.cs:2035-2038`: `var hasHeader = grid.Count > 1 && grid[0].All(cell => !cell.Any(char.IsDigit)) && grid[0].Any(cell => cell.Trim().Length > 0);`
- **Violates:** R-1 / L-8 (*"ONE header rule for all lanes"*; the chunker's R1 comment: *"a fragment opening on `Consultation | free | on request` is shape-identical to a genuine header"*); no `LooksLikeALabelRow` veto, so a one-cell title line qualifies.
- **Failure:** CSV `Price List` ⏎ `Haircut,$25` → squared `[Price List, ""]` → header → `Price List: Haircut | $25`; `Consultation,Free` ⏎ `Haircut,$25` → `Consultation: Haircut | Free: $25`.
- **Fix:** at minimum the same `LooksLikeALabelRow` veto; ask the owner whether a CSV's first row counts as declared.
- **Conf.:** High.

### Medium

#### P4-A-23 — E-19's unpaired-price count is thrown away on the Word lane and never computed on PowerPoint
- **Where:** `KnowledgeDocumentParser.OpenXml.cs:126` (`PairLabelValueRuns(blocks);` — return value discarded; the output at `:133-137` carries no `UnpairedPriceLines`); `Pptx.cs:96-97` (no pairing). Producers that keep it: `KnowledgeDocumentParser.cs:639-642`, `:1532-1542`, `:2008-2011`.
- **Failure:** a value-first list typed in Word (`$25` ¶ `Haircut` ¶ …) is refused correctly but no `Info_KnowledgePricesWithoutNames` is ever raised — the E-19 silence the phase-2 fix closed for PDF/HTML/TXT/MD. Tests cover only the markdown lane (`KnowledgeDocumentParserTests.cs:500-539`).
- **Conf.:** High.

#### P4-A-24 — Nine phase-1 parser rules have NO regression guard left (the harness was deleted), and A13's claimed tests never existed
- **Evidence:** the harness was deleted 2026-09-22 as "rot" (memory `timeprovider-governor-wallclock-2026-09-22.md:83-90`). Grep of every Knowledge test file finds no test for: `IsLoneCurrencyMark` (ADV01), the all-lowercase refusal / `IsAllLowercaseRun` (A3/ADV13), `MergeThreeLineRecords` (A22), `IsProseRow` trimming (A9), `ZipValueColumnBoxes` (A7), `AppendLayoutTableBlocks` (A8), `ListLevel` (A12), `InferredHeadingLevel`/`IsAllCapitalsLine`/`outlineLvl` (A14), and any HTML hidden rule (A13 — `git log -S"aria-hidden"`/`-S"display:none"` on the test repo: nothing, ever). phase-1 `AUDIT.md:37` claims *"T `KnowledgeDocumentParserTests` hidden-content cases"* — false. The sabotages S-9/S-10 (`AUDIT.md:159-160`) would now pass. Comments still cite the deleted cases: `KnowledgeChunker.cs:465` (`ADV01`), `KnowledgeDocumentParser.cs:1083` (`ADV13`).
- **Violates:** CLAUDE.md §0.8; the brief's rule 4 (the WRITE and the READ must each be pinned).
- **Fix:** port the ADV/A/F harness cases that pinned these rules into `Clinqet.Communications.UnitTests` (the ingest host, §0.18), then re-run the S-9/S-10 sabotages.

#### P4-A-25 — Persian/Urdu digits are never folded
- **Where:** `TextScriptDetector.cs:243-253` (Arabic zero is `'\u0660'` only), `:265-281`; used by `ProviderKnowledgeSearchService.cs:1105-1115`.
- **Failure:** a Farsi or Urdu price list writes `۵۰۰` (U+06F5…, Extended Arabic-Indic, inside the detector's `Arab` block) → neither the ASCII leg (`500`) nor the Arabic-Indic leg (`٥٠٠`) matches it.
- **Fix:** fold U+06F0–06F9 too (both directions for an `Arab` leg).

#### P4-A-26 — The token estimate is a majority vote: a half-Chinese card is budgeted at the Latin rate
- **Where:** `KnowledgeTokenEstimate.cs:59-63` (`if (dense * 2 >= letters) return DenseCharsPerToken; … return LatinCharsPerToken;`).
- **Failure:** a Toronto bilingual menu card with 45% Han letters → chars ÷ 4 while the true cost is ≈0.6 × chars → ≈2.4× under-count; the card and the call budget (F3) overrun.
- **Fix:** a weighted factor (dense share × 1 + cluster share × 1.6 + rest × 4).

#### P4-A-27 — Quadratic work on hostile inputs
- `WalkHtml` calls `HoldsAPicture(child)` (`KnowledgeDocumentParser.cs:1913-1914`, `:1667-1673`) at every level of a nested inline chain that holds a picture → O(n²) node visits (40,000 nested `<span>` + one `<img>` ≈ 8×10⁸).
- `PairLabelValueRuns` / `CoalesceValueLineRuns` / `ZipValueColumnBoxes` / `CollapseRepeatedImageMarkers` `RemoveRange`/`Insert`/`RemoveAt` inside the scan (`KnowledgeDocumentParser.cs:867-879`, `:944-945`, `:128`; `Pptx.cs:429`) → O(blocks × runs).
- `DocumentSpellsItHyphenated` scans the whole document per soft break (`KnowledgeText.cs:152-169`).
- Bounded by the function timeout, not by a cap. Fix: compute "subtree holds a picture" once bottom-up; rebuild lists instead of mutating in place; index hyphenated forms once.

### Low

#### P4-A-28 — Stale comments that describe deleted designs
- `KnowledgeChunker.cs:13` *"Scripts are LTR-only by design (§7.8b case 25): the platform's five languages are all LTR."* (Arabic/Hebrew documents are ingested; A21 added Arabic stops).
- `KnowledgeChunker.cs:17` *"~4 chars/token everywhere, consistently"* — contradicted two lines below.
- `KnowledgeBlocks.cs:60-61` *"every covered position carries its value"* — EX-16/X-03 now emit a merged value ONCE.
- `KnowledgeBlocks.cs:64-65` *"the chunker falls back to the row-1 heuristic otherwise"* — that heuristic was deleted (R1).
- `KnowledgeBlocks.cs:98-99` lists EMF/WMF among parser skips; the parser does not count them (`OpenXml.cs:449-452`).
- `KnowledgeChunk.cs:13-14` *"What the index STORES (prefix + passage; tables: prefix + HTML)"* — Content is the body only and tables carry no HTML (`KnowledgeChunker.cs:219`, `KnowledgeBlocks.cs:55-57`).
- `OpenXml.cs:451-452` *"would change the dark-mode cards"* — jargon nobody can decode.

#### P4-A-29 — Dead members left by the phases
`OoxmlNotes.Any` (`KnowledgeOoxmlText.cs:208`), `HiddenTextStyles.Count` (`HiddenTextStyles.cs:23`), `KnowledgeChunker.Dehyphenate` (`KnowledgeChunker.cs:619`, internal, called only by a test) — 0 production references each.

#### P4-A-30 — JSON field lines speak .NET, and a scalar root is given an invented label
`KnowledgeDocumentParser.cs:2346`: `sb.Append(path.Length == 0 ? "value" : path).Append(": ").Append(element.ToString())` — `true` becomes `True` (the spelling `RenderScalar`, `:2297-2305`, exists to avoid) and a scalar-root file reads `value: …`, a word the file never contained (X-04 residual).

#### P4-A-31 — Two cuts that are neither surrogate-safe nor script-aware
`KnowledgeChunker.cs:206-208` (EX-21 outline: `outline[..Math.Min(outline.Length, options.MaxTokens * 4)]` — 4 chars/token for CJK, can split a pair; the chunker's own `SafeCut` exists), `KnowledgeInventoryBuilder.cs:58` (`text[..SectionNameMaxChars]`).

#### P4-A-32 — Edit scars
Invisible U+FEFF char literals (`KnowledgeDocumentParser.cs:1484`, `KnowledgeTextDecoder.cs:54`) — write `'\uFEFF'`; double blank lines at `KnowledgeDocumentParser.cs:403-404`, `:2013-2014`, `OpenXml.cs:139-140`, `KnowledgeChunker.cs:883-884`, `:972-973`. No mojibake, no empty backtick pairs, no stray control characters found in any in-scope file.

### Improvement (owner awareness, not defects)

- **P4-A-33** — Within the APPROVED EX-32 design, the rendered lane also drops a REAL hyphen at a line end of a Word-made PDF (Word breaks after hard hyphens and does not auto-hyphenate by default) unless the document spells the word elsewhere (`KnowledgeText.cs:116-130`, `:141-148`). Worth one live measurement on a Word-exported PDF.
- **P4-A-34** — `ResolveHan` (`TextScriptDetector.cs:191-202`) has no share floor: one decorative `の` relabels a whole Chinese card `Jpan`. Kannada/Malayalam/Odia blocks are absent (not in F2's scope).
- **P4-A-35** — After the media budget is spent, PPTX/DOCX body pictures are still decompressed (≤64 MB each) before being refused (`OpenXml.cs:525-536`, `Pptx.cs:596-608`): honest-size media bombs cost CPU, not memory.

---

## 3. Closure check (my dimension)

| Id | Verdict |
|---|---|
| A1 | FIXED-AND-VERIFIED-IN-CODE (`KnowledgeDocumentParser.cs:924-964`, `KnowledgeChunker.cs:335-383`) **except PowerPoint** (P4-A-11) |
| A2 | FIXED-AND-VERIFIED-IN-CODE (`KnowledgeOoxmlText.cs:64`, `:87-90`, `:166-170`; cells collapse `:33-37`) |
| A3 | FIXED-IN-CODE (`KnowledgeDocumentParser.cs:1073-1120`) — guard lost with the harness (P4-A-24) |
| A4 | FIXED-AND-VERIFIED-IN-CODE (`KnowledgeDocumentParser.cs:1466-1480`; `KnowledgeChunker.cs:1059-1063`) |
| A5 / A5-L | PARTIAL — veto `:1211` ✓; prompt half NOT DONE (P4-A-02); inheritance blocked by kept furniture (P4-A-03); band rows deleted (P4-A-04); cross-tab side door (P4-A-05) |
| A6 / R-1 | FIXED as ruled (`KnowledgeChunker.cs:901-912`, `:963-987`) — except title-over-header (P4-A-12) |
| A7 / L-7 | FIXED for the measured two-multi-line-box shape (`Pptx.cs:409-443`), untested; single-line boxes NOT (P4-A-11) |
| A8 | FIXED-IN-CODE (`OpenXml.cs:729-767`), untested (P4-A-24) |
| A9 | FIXED-IN-CODE (`KnowledgeDocumentParser.cs:849-864`, `:903-904`), untested |
| A10 | FIXED-AND-VERIFIED-IN-CODE (`KnowledgeChunker.cs:372-373`, `:435-447`) |
| A11 / L-6 | PARTIAL — 2-row freeze `OpenXml.cs:1236` + chunker compose `KnowledgeChunker.cs:1086-1108` ✓; H1 guard `:1243` ✓; Alt+Enter `OpenXml.cs:1422-1425` ✓; `Sheet1` `:1410-1416` ✓; leading empty column `:1115-1124` ✓; title row NOT (P4-A-12); rPh (P4-A-19) |
| A12 | FIXED-IN-CODE (`OpenXml.cs:697-703`, `KnowledgeChunker.cs:155-157`, `:829`), untested |
| A13 | PARTIAL — `:1507-1525` ✓; `!important` / CSS comment (P4-A-14); never tested (P4-A-24) |
| A14 | FIXED-IN-CODE (`OpenXml.cs:569-669`), untested |
| A15 | FIXED-AND-VERIFIED (`KnowledgeOoxmlText.cs:66-74`, `OpenXml.cs:328-411`; 5 tests) |
| A16 / A16-L / L-5 | FIXED (`KnowledgeDocumentParser.cs:193-315`, tests `:1175-1294`) — first-copy ordinal drop (P4-A-15); side effect P4-A-03 |
| A17 | FIXED (`OpenXml.cs:473-495`) — unguarded `GetPartById` (P4-A-06) |
| A18 | FIXED-AND-VERIFIED (`OpenXml.cs:155-188`, `Pptx.cs:520-534`) |
| A19 | FIXED (`KnowledgeDocumentFormats.cs:14-30`; `.csv` added P2) |
| A20 | VERIFIED OK — legacy declared charsets are a new residual (P4-A-20) |
| A21 | PARTIAL — `KnowledgeTokenEstimate` ✓, `ScriptBoundary` `KnowledgeChunker.cs:712-726` ✓; CJK stops inert (P4-A-13); majority vote (P4-A-26) |
| A22 | FIXED-IN-CODE (`KnowledgeDocumentParser.cs:1031-1058`), untested |
| B2 | FIXED-AND-VERIFIED-IN-CODE (`KnowledgeChunker.cs:321-322`; `KnowledgeIngestProcessorFunction.cs:930`) |
| B3 | FIXED-AND-VERIFIED-IN-CODE (`KnowledgeChunker.cs:21` → `KnowledgeTokenEstimate`) |
| L-3 | PARTIAL (see A5) |
| L-4 | FIXED except PowerPoint (P4-A-11) |
| L-8 | PARTIAL — vision lane (P4-A-02), CSV lane (P4-A-22) |
| X-03 | FIXED-AND-VERIFIED (`OpenXml.cs:905-925`; `Xlsx_AFullWidthMergedRow…`, `Xlsx_AHorizontalMergeBesideOtherData…`) — PPTX merges wrong (P4-A-01) |
| X-04 | FIXED (`KnowledgeDocumentParser.cs:2136-2141`) — Low residual P4-A-30 |
| X-06 | PARTIAL — card close `KnowledgeChunker.cs:1468-1482` ✓; re-opened by coalesced/paired runs (P4-A-16) |
| R-2 | FIXED (line breaks, coalesce, zip, layout tables) — gaps P4-A-11, P4-A-21 |
| R-3 | NOT FULLY IMPLEMENTED (P4-A-02) |
| EX-32 | FIXED for DOCX/XLSX/PPTX/HTML/TXT/JSON (`KnowledgeText.cs:74`) and the rendered lane (`:88-169`); **REGRESSED/NOT-FIXED for `.md`** (P4-A-09) |
| EX-24 | PARTIAL (P4-A-10) |
| D10 / §16 (bullet is punctuation) | FIXED-AND-VERIFIED — `WithoutListMarker` `KnowledgeChunker.cs:549-568` applied only where a line becomes an offering; `SelfContainedLines` `:335-383` never calls it, so indexed quotations keep their bullets |
| §17 (reading not byte-stable) | FIXED-AND-VERIFIED (`KnowledgeChunker.cs:375-382`; `KnowledgeChunkerLineStructureTests.cs:126-156`, bullets and prose controls) |
| E-19 (UnpairedPriceLines) | PARTIAL — layout-markdown/HTML/TXT/MD ✓ (`KnowledgeDocumentParser.cs:836-840`, `KnowledgeBlocks.cs:92-118` record + `with`); Word discards, PowerPoint never counts (P4-A-23) |
| TextScriptDetector (F2 / G-13) | FIXED-AND-VERIFIED — 15 scripts `TextScriptDetector.cs:71-73`; CJK precedence `:191-202` (+ absorption test `AMostlyKanjiJapaneseDocument_…`); dense floor 4 `:149-152`; digit folding both ways `:243-296`; `NeedsCjkTokenisation` = Any(Hani∨Jpan) `:95-102` (covered via `KnowledgeCjkFieldTests`); `ContainsScript` `:166-182` — residual Persian digits (P4-A-25) |

---

## 4. Verified OK (checked and fine)

**Robustness**
- HTML text and structure walks are iterative: `NodeText` `KnowledgeDocumentParser.cs:1425-1452`, `DescendantElements` `:1652-1665`, `WalkHtml` `:1879-1980`; 40,000-deep `<div>` and `<p><span>` tests `KnowledgeExtractionFidelityTests.cs:2093-2118` (only `<pre>` and PPTX groups remain — P4-A-08).
- OOXML text walk iterative, depth-capped: `KnowledgeOoxmlText.cs:21-23`, `:47-119`; Word body walk `OpenXml.cs:416-446` (max depth 64).
- SmartArt reader iterative, cycle-safe, `MaxPoints = 2048`: `KnowledgeDiagramReader.cs:26`, `:93-124`. Chart reader keyed by real point indexes, no dense materialisation: `KnowledgeChartReader.cs:51-66`.
- JSON recursion bounded by `JsonDocument`'s default max depth of 64 (`:2141`) — `EmitJsonNode`/`FlattenJsonElement` cannot overflow.
- Image bytes bounded: `ReadSourceImagePart` `:50-63`; data-URI bounded before decode `:1808-1809`; per-document media budget `:138-143`; HTML remote policy applied at collection `:1834-1845`.
- Honest-size XML bomb refused before any spend: `OpenXmlPackageInspector.cs:29-51` + `KnowledgeIngestProcessorFunction.cs:1585-1594` (media parts excluded by design).
- C2 OLE signature: `KnowledgeIngestProcessorFunction.cs:3685-3699` — `D0 CF 11 E0 A1 B1 1A E1` + `EncryptedPackage` ⇒ password sentence, else older-Office sentence; non-OOXML ⇒ unreadable (proven live per PROGRESS-SESSION2 §18.1).
- Rotated PDF pages: the parser only ever receives DI/vision markdown and is orientation-agnostic; `DocumentPageCounter` counts pages only (rasteriser rotation is outside this dimension).
- Regexes: furniture/emphasis/ordinal patterns carry a 2 s timeout (`:67`, `:150`, `:159-161`, `:163`, `:1149`); the untimed ones (`MarkdownHeading`, `MarkdownLightEmphasis`, `MarkdownInlineCode`, `PipeDelimiterCell`) are linear. No catastrophic backtracking found; `KeepFirstFurniture` degrades to "unchanged text" on timeout (`:410-417`).
- Gujarati and Arabic-Indic numerals: `char.IsDigit`/`\p{Nd}` everywhere (`IsValueOnlyLine`, `EndsInABareNumber`, `ClassifyCell`, `DigitRuns`, `CountsThePage` via `GetDecimalDigitValue`, inventory `ParseNumeric` via `AsciiDigits`) — a native-numeral price list pairs, lines up and ranges like a Latin one.
- A table whose every row is a section band: every band is emitted as a bare line (`KnowledgeChunker.cs:1233`, `:1308`), grouping terminates (`:914-948`) — nothing lost.
- An Excel sheet with 40 regions: one Table block per region, inheritance only on identical shape (`OpenXml.cs:1042-1107`, `:1162-1176`); gap scan bounded by the row index range.
- Label/continuation growth bounded (`LabelMaxChars`, `KnowledgeDocumentParserTests.cs:544`); all big concatenations use `StringBuilder`.

**Rules implemented as decided**
- Page ordinals dropped only where the digits count the page (`KnowledgeDocumentParser.cs:171-182`, `:268-277`; test `LayoutMarkdown_ABareAmountAtEveryPageEdge_IsNotAPageNumber`).
- A table's own repeated header is not furniture (`IsATableHeader` `:341-362`; tests `:1175-1259`).
- Unclosed / nested DI tables (`:477-503`, `:697-726`).
- Tracked deletions, field codes, hidden runs/styles excluded (`KnowledgeOoxmlText.cs:150-162`, `HiddenTextStyles.cs:45-86`; 7 Docx hidden tests).
- Formula source never leaks (`OpenXml.cs:1397-1399`); hidden sheets/rows/columns skipped (`:858`, `:885`, `:931-934`).
- Setext and inferred headings refuse a line carrying a measure (`:1233-1234`, `OpenXml.cs:626-634`).
- Riding caption and header-only tables cannot swallow a paragraph (`KnowledgeChunker.cs:113-116`, `:1389-1390`).
- Oversize rows keep their identity (`:1339-1385`); deterministic, section-aware dedupe (`:1631-1656`).
- Card prefix ONE definition (`KnowledgeCardPrefix.cs:27-48`); `KnowledgeExtractionOutput` is a record copied with `with` (`KnowledgeBlocks.cs:87-118`) so `UnpairedPriceLines` survives every hand-over.
- `KnowledgeDocumentFormats.ContentTypeFor` is case-sensitive but every caller lower-cases the extension first (`KnowledgeIngestProcessorFunction.cs:680`, `KnowledgeServiceDraftAnalyticsJob.cs:389`).
- Test placement (§0.18): parser/chunker tests live in `Clinqet.Communications.UnitTests` (the ingest host); `TextScriptDetectorTests` in the API suite (primary consumer Business Search) — consistent with rule 2.
