# Phase 1 — multidimensional audit

**Written 2026-09-11 by the Phase-1 session, reviewing its own work as a hostile reviewer.**
Scope as given by `PHASE-1-PROMPT.md` §2: A1–A22, B1–B3, C3–C12, A5-L, A16-L, C12-L, L-1…L-8, L-12, L-13,
L-14, X-03, X-04, X-06, X-08. Owner rulings in force: every extraction finding is High/Critical whatever
badge it carries and **none may be deferred** without the owner's word in the conversation; the 17 fixture
documents in `SX3SG2` are **retained**.

**Headline.** Every in-scope finding is closed in code — including EX-32, the hyphen, which the owner raised
mid-phase and which §15 records — except the five open items in §11, which are stated with
their reason and the question each needs answered. 17,171 unit tests pass (0 fail) across the three hosts;
the mandated harness is **103/103**; the live artefacts of all 17 retained fixtures replay through HEAD with
**zero words lost and zero words invented**. What is NOT verified is the live end-to-end re-run of the 17
fixtures and the heal of `MEE3IC be07d747…`: both need this code on the Canada stamp (§5).

---

## 1. Finding closure

Proof columns: **T** = the test that fails if the fix is removed · **C** = the corpus file under
`phase-1\after\` (compare with `phase-1\baseline\`) · **L** = the live evidence.

| Id | Verdict | Code | Proof |
|---|---|---|---|
| **A1 / L-4** one-item-per-line lists glued | FIXED | `KnowledgeDocumentParser.CoalesceValueLineRuns`, `IsOneLineParagraph`, `IsSelfContainedLine` | T harness R7 group (10) + ADV01/02/03 · C `docx_paragraph_pricelist`, `txt_pricelist_single_newlines` · L `docx_paragraph_pricelist.docx.a8ea527d` |
| **A2** Word/PPT breaks and tabs became spaces | FIXED | `KnowledgeOoxmlText`: newline-aware `Flatten` vs `FlattenInline`, `IsLineBreakElement`, `Collapse` keeping `\n` | T `KnowledgeExtractionFidelityTests.Docx_LineBreakInsideAParagraph_KeepsTheWordBoundary` and the tab/ptab cases |
| **A3** all-lowercase lists collapse | FIXED | `IsAllLowercaseRun` + the all-lowercase refusal in `IsWrappedContinuation` | T harness ADV08 + ADV13 · C `docx_lowercase_flattened` |
| **A4** a duration header row refused | FIXED | `IsUnitMeasure` in `IsCrossTabHeader`; `LooksLikeALabelRow` vetoes only `IsBareAmountCell` | T harness A03/A04/B14 |
| **A5 / A5-L / L-3** vision pipe tables trust row 1 | FIXED | `ReadPipeTable`: `HasHeaderRow = rows.Count > 1 && LooksLikeALabelRow(rows[0])` | T harness C3 cross-page continuation, ADV06 (refuse) vs ADV07 (accept) · L `pdf_table_across_pages_header_once` |
| **A6 / L-8** undeclared ⇒ no labels (R-1) | FIXED as ruled | one header rule for every lane; a splitting table gets a CONTEXT line | T harness A07/A08/A09/A11 + F01/F02 (undeclared) vs F03/F04/ADV07/ADV09 (declared) |
| **A7 / L-7** PPT side-by-side boxes column-major | FIXED | `ZipValueColumnBoxes`, `LinesOf`, `MinZippedLines` | C `pptx_two_textbox_columns` · L same document |
| **A8** layout tables one glued row | FIXED | `AppendLayoutTableBlocks` | C `docx_two_column_table_resume` (1 card → 6 sectioned), `Clinket_TwoColumn_CV` · L `docx_two_column_table_resume.docx.b67f3100` (the 584-char glued card) |
| **A9** pairing run boundary too wide | FIXED | `IsProseRow` edge trimming | T harness ADV05, A10 |
| **A10** no-currency price lists | FIXED | `EndsInABareNumber` + `MinBareNumberedLines` | C `docx_no_currency_pricelist` |
| **A11 / L-6 / X-03** Excel headers, H1 carry, merges, sheet name | FIXED | `DeclaresXlsxHeaderRow` (`VerticalSplit >= 1`), `IsOnlyContentInRow`, `HoldsAValue`, `IsDefaultSheetName` (one visible sheet only), `DropEmptyLeadingColumns` | T harness F04, `KnowledgeSheetRegionTests` · C `xlsx_merged_header_formats_hidden_regions`, `Microsoft Pricing Structure.xlsx` · L the same workbook: HEAD stops inventing `Service` in the sub-header row (`live-replay\CONSERVATION.txt`) |
| **A12** nested lists flattened | FIXED | `ListLevel` indent carried into the list block | C `docx_nested_list` |
| **A13** HTML hidden content indexed | FIXED | `HiddenClasses`, `HidesContent`, `MatchingBrace`, `ClassSelectors` | T `KnowledgeDocumentParserTests` hidden-content cases |
| **A14** Word pseudo-headings | FIXED | `ResolveHeadingLevel` + `InferredHeadingLevel` + `IsAllCapitalsLine` + `BodyHalfPoints` | C `docx_bold_pseudo_headings` |
| **A15** footnote link + header placement | FIXED | `OoxmlNotes`, `NoteReferenceKey`, `ReadDocxNotes`, header `InsertRange(0, …)` | T 5 tests (`Docx_AFootnote_IsReadAtItsReference`, `…InATableCell`, `…SharingAnId_AreNotConfused`, `Docx_AnUnreferencedNote_KeepsItsPlaceAtTheEnd`, `Docx_TheHeader_IsReadBeforeTheBody_AndTheFooterAfter`) · C `docx_trackchanges_footnote_header` (one glued card → letterhead card + `Colour $80 [Long hair adds $20; prices exclude HST.]`) |
| **A16 / A16-L / L-5** DI page furniture | FIXED | `KeepFirstFurniture`, `StripRepeatedPageLines`, `IsPrintedLine`, `PageOrdinalLine` | C `md_pricelist`, harness C12 · L `pdf_footer_disclaimer_repeated` |
| **A17** silent Word image skips | FIXED | VML `v:imagedata` collection, linked-picture counting, per-parse `SkipTally` | T `KnowledgeExtractionFidelityTests` VML + linked-picture cases |
| **A18** richData / shape fill / slide background / SmartArt | FIXED | `UnclaimedImageParts` + `IsRasterPart` + `IsDecorationPart`; `CollectPptxBackground` | T 7 tests (`Pptx_ASlideBackgroundPicture_IsCollected`, `…IsABackdrop_AndIsCounted`, `…WithoutTheImageLane`, `Pptx_/Docx_APictureInsideASmartArtPart_IsSwept`, `Xlsx_APictureWithNoSheetDrawing_IsSwept`, `Pptx_ARefusedBackdrop_IsNotSweptBackIn`) · C `Clinket_ShapeFill_Deck.pptx` now reports `skipped=1` — the background behind the slide's own words, seen and deliberately refused where it was invisible before |
| **A19** format gaps | PARTIAL — see §11 | `.tif` accepted end to end (`KnowledgeDocumentFormats` + both API upload allow-lists); `.heif`/`.heic` removed from the Functions formats because ImageSharp decodes neither | `.csv`, `.doc/.xls/.ppt`, `.docm/.xlsm/.pptm` still refused — §11 item 2 |
| **A20** text decoding | VERIFIED OK | no change needed | C `txt_cp1252`, `txt_utf16_no_bom` · the documented hyphen limit is §11 item 4 |
| **A21** unsupported scripts | FIXED | extended `SentenceTerminators`, `ScriptBoundary`, `KnowledgeTokenEstimate` (Latin 4 / dense CJK 1 / cluster 1.6) | T harness ADV02, ADV04, ADV11 · C `docx_hindi_gujarati_pricelist` |
| **A22** three-line rows bind the price to the description | FIXED | `MergeThreeLineRecords` (run-level, ≥2 candidates, `EndsASentence` guard) | T harness ADV10, ADV13 · C `txt_three_line_name_desc_price`, `txt_three_line_name_price_desc` |
| **B1** 500-card page over the 16 MB cap | FIXED | `KnowledgeSearchIndexer`: byte-bounded paging (`MaxUploadRequestBytes` 12 MB, `EstimateRequestBytes`), 413 ⇒ halve-and-split, 413 excluded from `IsIsolatable` | T `KnowledgeSearchIndexerIsolationTests` (22) incl. the real-vector split |
| **B2** every Word/Excel/HTML card claimed page 1 | FIXED | `KnowledgeChunkContext.Paginated` = `extraction.PageCount is > 0` | T `KnowledgeChunkerTests.ANonPaginatedSource_CarriesNoPageNumber` · C every office/text after-file now prints `page=` |
| **B3** chars÷4 everywhere | FIXED | `KnowledgeTokenEstimate` shared by the chunker AND `ProviderKnowledgeSearchService.TrimToTokenBudget` | T harness ADV11 |
| **C3** a picture of a price list is only captioned | FIXED | `TranscribePictureTextAsync`, `WithPictureText`, `MaxTranscribedPictures` = 5 | T `KnowledgePictureTextTests` (9) |
| **C4** pictures grounded with the table's LAST row | FIXED | row-by-row collection passing `rowText`; `ImageNeighbourText` wins over the running neighbour | T `KnowledgeImageGroundingTests`, the table-cell picture cases in `KnowledgeExtractionFidelityTests` |
| **C5** EMF/WMF booked as a LOST picture | FIXED | `KnowledgeImageNormalizer.IsVectorMetafile` (EMF + three WMF headers), counted as Bounded | T `KnowledgePictureTextTests` metafile theory (4 positive + 5 negative) |
| **C6** HTML remote policy mismatch ⇒ false losses | FIXED | `IsFetchable` + `FetchableImageExtensions` beside the collector; a refusal is a skip | T `KnowledgeDocumentParserTests.Html_SvgAndRelativeSources_AreSkipped_AndCounted` |
| **C7** caption reuse dead; a failed re-caption kept "sendable" | FIXED (both halves) | in-run reuse keyed on **(fingerprint, grounding)**; `Sendable` never carried onto an entry with no caption (`Previous()`) | T `LookAlikePictures_UnderTheSameWords_PayForOneDescription` + `…UnderDIFFERENTWords_EachPayForItsOwnDescription`; `KnowledgeImageSendabilityTests`. The business-wide map stays keyed on bytes alone — §11 item 1 |
| **C8** transparent PNG on black; caption language | FIXED | `Mutate(x => x.BackgroundColor(Color.White))`; `documentLanguage` + `LanguageRule` | T `KnowledgeImageCaptionClassifierTests` |
| **C9** replay stamps DOCX/XLSX pictures page 1 | FIXED | `Page`/`AnchorPath` on `KnowledgeArtifactImage`, honoured by `RecomposeImageLaneFromArtifact` | T the artefact-replay cases in `KnowledgeIngestProcessorFunctionTests` |
| **C10** lazy-load / srcset / `<picture>`; TIFF frames | HTML half FIXED; TIFF stated | `BestHtmlImageSource`, `LazyImageAttributes`, `WidestCandidate`, `LastGluedCandidate` | T 7 tests incl. `Html_ASrcsetOfCdnUrlsHoldingCommas_IsNotTornApart`. TIFF: the text is already complete (the rasterizer reads every frame, DI reads every frame, the page cap pre-counts frames) — only frame 1 is STORED — §11 item 3 |
| **C11** a failed description threw away the author's alt text | FIXED | alt-text card, gated on a picture the lane actually stored (so descriptions-off still means no picture card, D26) | T `KnowledgePictureTextTests.WithNoDescriptionButAltText_AStoredPictureStillEarnsACard` + `WithNoStoredPicture_AltTextEarnsNothing` |
| **C12 / C12-L** the owner's photographed price list has no description | FIXED in code | `readsAsText` covers `Unclassified` with no caption ⇒ the picture is transcribed; the alt-text card covers the card | T `KnowledgePictureTextTests`. **The live heal needs the deploy** — §5 |
| **L-1** a two-column PDF's facts DELETED by the verifier | FIXED | the approved 5-rule adjudication: `PageFacts`, `Group()`, `ConservesWords`, `AddedValues`, `shapeDiffers`, `Restore()`, `WithoutEvidence()` | T `DocumentTranscriptionAdjudicationTests` (43), notably `AConfirmedRowThatWouldDeleteWordsAroundIt_IsNotWrittenOverThem`, `WhenTwoSourceLinesShareOneTranscriptParagraph_ACorrectionNeverDeletesTheOther`, `ATwoColumnPageReadAcrossByTheMachine_IsNotADispute_AndCostsNoSourceCheck` |
| **L-2** a Gujarati PDF indexed as OCR garbage | FIXED | `IDocumentTranscriptionVerifier.AnsweredNotOnPage` separates "answered: not on this page" from "no answer"; four new dispositions | T `ALostRowTheSourceCheckCannotFindOnThePage_YieldsToTheTranscript`, `WithNoUsableThirdReading_TheRegionKeepsTheMachineReadingAndTheFlowContinues` |
| **L-12** drift after reprocess | code path unchanged and correct | the Full ticket heals the row; nothing in Phase 1 alters it | **needs the live re-run** — §5 |
| **L-13** all three photographed lists were described | VERIFIED; extended | C3/C12 widen it to text-heavy pictures inside office files | T `KnowledgePictureTextTests` |
| **L-14** the verifier's decisions never surface | **FALSE FINDING** | the alerts DO fire (`TranscriptionVerificationAlerts`); the probe matched the wrong JSON path and was fixed (`tools\kaudit\Live.cs` now also matches `c.metadata.transcriptionVerification.source.documentId`) | proven by re-running the probe against the live `AdminAlert` rows |
| **X-03** partial merges shift every later value | FIXED | `IsOnlyContentInRow(line, toColumn, fromColumn)` band merges + the `HoldsAValue` H1 guard | L visible on the live workbook (the un-invented `Service`) |
| **X-04** a scalar-root `.json` is refused | FIXED | `JsonDocument.Parse(trimmed, new JsonDocumentOptions { AllowTrailingCommas = true })` handles a scalar root; the callerless `TryFlattenJson` deleted | T the JSON cases in `KnowledgeDocumentParserTests` |
| **X-06** a card spanning pages is labelled with its first sentence's page | PARTIAL BY DESIGN | the page-change card close IS built; EX-08's "label with the LAST sentence" was **not** taken because it contradicts EX-08's own first-sentence rule — the deviation is documented at the call site | T `KnowledgeChunkerTests.ACardPastTheMinimum_ClosesAtAPageChange` |
| **X-08** orphaned conservation class | FIXED | `KnowledgeTranscriptConservation.cs` + its tests deleted; `VisionTranscriptConservationTests` renamed `DocumentTranscriptionAdjudicationTests` | `git status` shows the deletions |
| **EX-32** dehyphenation removes legitimate hyphens (an owner-declared limit, RAISED and FIXED 2026-09-11) | FIXED | `KnowledgeText.Dehyphenate` (typed lanes: join, **keep** the hyphen) vs `DehyphenateRenderedPage` (rendered lanes: **drop** it), applied in `ParseLayoutMarkdown` and the picture-text lane | T 10 tests: `Case4_ATypedDocument_KeepsEveryHyphenItCarries`, `TheRenderedPageRule_*` (6), `LayoutMarkdown_APrintedWordSplitAtAHyphen_IsJoined`, `LayoutMarkdown_AShortCompoundSplitAtItsHyphen_KeepsIt`, `LayoutMarkdown_TheDehyphenationPass_KeepsEveryOtherLineBreak`, `APhotographedPriceList_HasItsSplitWordsJoined_InTheIndexedText` |

---

## 2. Regression

| Suite | Result |
|---|---|
| `Clinqet.Communications.UnitTests` (the ingest host) | **4,307 / 4,307** pass |
| `Clinqet.API.UnitTests` | **11,946 / 11,946** pass |
| `Clinqet.Mcp.UnitTests` | **918 / 918** pass |
| `C:\Nik\knowledge-table-hunt` (`dotnet run -c Release --no-launch-profile`) | **103 / 103** pass — `phase-1\baseline\table-hunt-AFTER.txt` |
| Builds | `clinqetcore`, `clinqetshared`, `clinqetinfrastructure`, `Clinqet.Communications`, `Clinqet.API`, `Clinqet.Mcp` — 0 errors |

Two API tests failed on the first full run and were fixed: `ProviderSetupImageServiceTests` set up a Moq
`Callback` with a 10-parameter delegate against the caption interface I widened to 11 (the `documentLanguage`
of C8). That is a compile-required edit in another host's suite, which §0.18 rule 3 places exactly where
compilation forces it.

**The harness went from 88 cases to 103.** The before-state is `phase-1\baseline\table-hunt-BEFORE.txt`
(**84/88**, four failures). Those four encoded a DELETED design and were rewritten to the contract the
product actually promises; each rewrite carries a `‼️ UPDATED 2026-09-11` comment saying what changed and why:

- **A11** was written when a middle tier INFERRED a header from cell shapes. That tier is gone (a fragment
  opening on `Consultation | free | on request` is shape-identical to a real header), so an undeclared table
  is unlabelled. The case now asserts what must hold in every script: every value survives and none is bound
  to a label nobody declared — the new `NoLabelBinding` check, which **fails when given an empty label list**
  so it can never assert nothing.
- **C10** asserted `NoCards()` for a heading-only document. EX-21 deliberately replaced that: a document that
  is ONLY headings used to produce nothing and be failed as "no readable content", a claim that is false
  about the file. It now asserts the one bounded outline card.
- **F01 / F02** asserted labels on a DOCX/XLSX fixture that declares no header. They now assert that every
  value survives unlabelled — and **F03 / F04 are new**: the SAME documents WITH the author's own declaration
  (`w:tblHeader`, a frozen top row) must be labelled. That pair is the R-1 contract, proven in both directions.

**Corpus diff, explained.** 33 files under `phase-1\after\` vs `phase-1\baseline\`. One systematic change
touches nearly every file — `page=1` became `page=` — which is B2: a Word file, a workbook and a web page
have no pages, and their cards claimed page 1 only because that was the block default. Beyond that:

| File | Before → after | Why |
|---|---|---|
| `docx_two_column_table_resume` | 1 card, 584 chars, every line boundary gone → 6 cards under PRIYA SHARMA / SKILLS / CERTIFICATIONS / PROFILE / EXPERIENCE / EDUCATION | A8 |
| `docx_trackchanges_footnote_header` | 1 card gluing the price list, the footnote and the letterhead → 2 cards: the letterhead first, then `Colour $80 [Long hair adds $20; prices exclude HST.]` | A15 |
| `xlsx_merged_header_formats_hidden_regions` | unlabelled grid with an invented `Service` in the sub-header row → `Price (Short hair): $25.00 \| Price (Long hair): $35.00` | A11 + X-03 |
| `docx_paragraph_pricelist`, `txt_pricelist_single_newlines`, `docx_no_currency_pricelist`, `docx_lowercase_flattened`, `docx_tab_aligned_pricelist` | one glued paragraph → one record per line | A1, A2, A3, A10 |
| `docx_nested_list` | flat siblings → indented membership | A12 |
| `docx_bold_pseudo_headings` | one section → the author's own sections | A14 |
| `pptx_two_textbox_columns` | a names card and a prices card → zipped records | A7 |
| `html_pricelist_mixed` | hidden block indexed → dropped; remote refusals are skips | A13, C6 |
| `Clinket_ShapeFill_Deck.pptx` | `skipped=0` → `skipped=1` | A18: the slide BACKGROUND is now seen, and deliberately refused because the slide has words in front of it |
| `md_pricelist`, the PDF replays | furniture cards removed, continuation labels restored | A16, A5 |

---

## 3. Correctness of the new rules — the adversarial battery

Thirteen `ADV` cases were written **after** the rules, in scripts and shapes no corpus document used.
**Five failed on first run. Two were my fixtures' fault. Three were real defects, and two of them serious:**

| Case | What it exercises | First run | Outcome |
|---|---|---|---|
| **ADV01** French `45,00 €` — comma decimal, symbol as its OWN token | money reading | **FAIL: the whole price list arrived as ONE glued line, no service paired to any price** | **REAL DEFECT, FIXED.** `IsValueOnlyLine` needed the symbol and the digits in one token, so every continental-European price list (France, Sweden, Poland…) read as prose. New `IsLoneCurrencyMark`. |
| **ADV13** two wrapped lowercase names | the all-lowercase path | **FAIL: `french tips` and `classic pedicure with` were WELDED into one offering and charged the first one's price** | **REAL DEFECT, FIXED.** A cased script typed all in lower case has no usable signal in either direction: the case bit is noise (A3) and the structural rule welds records. Refusing the merge lets the run-level three-line rule read `name \| price \| description` correctly. |
| **ADV08** ONE wrapped lowercase name | the same path, below the ≥2 minimum | FAIL (my expectation) | **DECLARED LIMIT** — §11 item 5. One occurrence is byte-identical to a heading above a price list; the case now asserts the real promise: every word survives in one card and no two services are ever welded. |
| ADV02 Chinese · ADV03 Gujarati+Hindi+English · ADV05 prose with two stray prices | the pairing rules | FAIL (my fixtures fed one paragraph instead of the block stream) | fixtures corrected to the real `.txt` entry point; all three pass |
| ADV04 Arabic RTL with Arabic-Indic digits | no crash, nothing reordered, nothing lost | PASS | — |
| ADV06 a table whose row 0 IS data (no `<th>`) | R1 refuses | PASS | — |
| ADV07 a page-2 fragment with a GFM delimiter row | R1 accepts | PASS | the opposite verdict to ADV06, from the source alone |
| ADV09 a Chinese table with `<th>` | R1 is script-independent | PASS | labelled in its own script |
| ADV10 French three-line records | A22 in an accented script | PASS | — |
| ADV11 a 60-row Chinese table | the shared token estimate | PASS | splits on record boundaries |
| ADV12 a mixed-script row | one record, one line | PASS | — |

---

## 4. Sabotage sweep

Each guard inverted once, the filtered suite run, the failure recorded, the sabotage reverted from a
scratchpad snapshot — never through git (§0.19).

| # | Guard inverted | Result |
|---|---|---|
| S-1 | `NoLabelBinding` with an EMPTY label list | **FAILS** — a check that asserts nothing can never report success |
| S-2 | `NoLabelBinding("Service")` applied to a DECLARED-header table | **FAILS** — the check reaches real card lines |
| S-3 | C7: in-run reuse re-gated on `SourceContext == null` | **FAILS** `LookAlikePictures_UnderTheSameWords_PayForOneDescription` (2 vision calls, not 1) |
| S-4 | C10: `BestHtmlImageSource` → `src` only | **FAILS 5** of the 7 HTML source tests |
| S-5 | A18: the unclaimed-media sweep disabled in all three lanes | **FAILS 3** `…_IsSwept` tests |
| S-6 | A18: `CollectPptxBackground` removed | **FAILS** `Pptx_ABackgroundBehindText_IsABackdrop_AndIsCounted` (the sweep would store a backdrop) |
| S-7 | A15: `ReadDocxNotes` replaced with an empty lookup | **FAILS 3** footnote tests; the unreferenced-note test still passes, which is correct |
| S-8 | A15: header `InsertRange(0, …)` → `AddRange` | **FAILS** `Docx_TheHeader_IsReadBeforeTheBody_AndTheFooterAfter` |
| S-9 | ADV01: `IsLoneCurrencyMark` dropped | **FAILS** ADV01 — the French list re-glues |
| S-10 | ADV13: the all-lowercase refusal removed | **FAILS** ADV13 — `french tips classic pedicure with \| $45` returns |
| S-11 | EX-32: the typographic minimum (`letters < MinLettersBeforeSoftHyphen`) | **FAILS 3** `TheRenderedPageRule_NeverBreaksAShortCompound` cases — `D-tan`, `X-ray`, `e-bike` |
| S-12 | EX-32: the document's-own-spelling guard | **FAILS** `TheRenderedPageRule_KeepsAHyphenTheDocumentSpellsElsewhere` |
| S-13 | EX-32: the `ParseLayoutMarkdown` call site removed | **FAILS 2** `LayoutMarkdown_APrintedWord…` / `…AShortCompound…` — added BECAUSE this sabotage first passed, proving the call site had no coverage |
| S-14 | EX-32: the picture-text call site removed | **FAILS** `APhotographedPriceList_HasItsSplitWordsJoined_InTheIndexedText` — same story: the test exists because the sabotage passed without it |

Earlier in the session, twelve further sabotages of the judge and parser work were installed and each failed
as required, with two lessons worth keeping:

- one of them (**S2**) **passed**, and thereby exposed a vacuous test — the word-conservation gate had no
  reaching coverage and a shared span was being compared against a single source line. Both were fixed and S2
  then failed correctly.
- one sabotage silently **never installed** (a perl `\Q…\E` made `\?` literal). It was re-run correctly and
  failed as required. A sabotage whose installation is not verified proves nothing.

---

## 5. Live pipeline

**What was run, and what it proves.** `tools\kreplay` (new) reads the artefact each of the 17 retained
`SX3SG2` documents banked on the deployed pipeline on 2026-09-10 — the real Document Intelligence + vision
block stream — and replays it through the HEAD chunker:

```
kreplay --all C:\Nik\Data\knowledge-extraction-audit\evidence\ca-live-batch
```

Comparing the bodies of the comparable card kinds (`[Table]`/`[Text]`; `[DocSummary]` comes from the
describer and `[DocAggregate]` from the inventory builder, neither of which a chunker-only replay produces):

**3,382 of 3,383 words identical · 0 word types lost · 0 word types invented, across all 17.**

The single difference is a fix: on `xlsx_merged_header_formats_hidden_regions` the deployed H1 carry wrote
the previous row's first cell into the sub-header row's empty cell (`Service | Short hair | Long hair`);
HEAD leaves it empty. The word HEAD "loses" is a word the document never contained. The full table and the
per-document readings are in `phase-1\live-replay\` (`CONSERVATION.txt` + 17 `cards-HEAD.txt`).

Five of the 17 are born-digital office files whose bytes are identical to the corpus copies, so for those
HEAD's own parser reads the real live document end to end — `phase-1\baseline\` vs `phase-1\after\`.

**What is NOT verified, and why.** The artefact's blocks were produced by the DEPLOYED parser and the
DEPLOYED judge, so this replay cannot exercise (a) the parser fixes on the PDF/image documents, which need a
fresh DI + vision pass, or (b) the three-reader adjudication itself, whose input is a fresh vision reading.
`kaudit reprocess` sends a Service Bus ticket that the **deployed** host processes with the **old** code, so
it proves nothing about these fixes until the owner deploys. A local in-process host run was considered and
rejected: it would mean duplicating 1,118 lines of the host's own DI registration (itself unproven), and the
Service Bus connection string may not be copied into a `local.settings.json` (owner's standing instruction).

**Alerts.** No new alert type was added. `kaudit alerts ca <docId>` was re-run during the L-14 investigation
and the verifier's alerts were found present on the live `AdminAlert` rows — that finding was a probe defect,
not a product defect. Two alert classes that used to fire FALSELY now do not: an EMF/WMF part is Bounded
rather than LOST (C5), and an unfetchable remote `<img>` is a skip rather than a loss (C6). Nothing in this
phase adds an alert that could fire on a healthy document.

**The exact runbook the owner needs** is in `HANDOVER.md` §"Live proof after the deploy".

---

## 6. Cost

| Change | Effect per document |
|---|---|
| C3 picture transcription | **+0 to 5** vision calls, capped by `Voice:Knowledge:Images:MaxTranscribedPictures` = 5, and only for a picture the classifier calls `text_snapshot` or leaves `Unclassified` with no description. A product photo is never transcribed. |
| C7 in-run reuse on (fingerprint, grounding) | **−1 call per look-alike duplicate** under the same words. Costs one extra 9×8 greyscale resize per picture, on bytes already decoded (single-digit ms). |
| A18 unclaimed-media sweep | **+0 to N** description calls for pictures that were previously invisible, bounded by `MaxImagesPerDocument` (the cap keeps the LARGEST) and the source-byte floor. A slide background behind text costs nothing — it is refused. |
| L-1/L-2 adjudication | unchanged per page: the third reading was already there. The new `shapeDiffers` gate **removes** a source check on a two-column page that is not a dispute (`ATwoColumnPageReadAcrossByTheMachine_…_CostsNoSourceCheck`). |
| B1 byte-bounded upload paging | the same cards in more, smaller requests; a 413 now costs one halve-and-split instead of 500 single-card isolations. |
| RU per ingest | **unchanged** — no new Cosmos read, write or query. `BuildBusinessImageMapAsync` is the same single partition-scoped list. |

---

## 7. Security and tenancy

- **No new Cosmos query of any kind**, so no cross-partition query (§0.6). The only Cosmos read touched is
  the existing partition-scoped `ListAsync(businessId)`.
- **SSRF policy unchanged.** `IsFetchable` still requires https, port 443, a DNS host, no credentials and a
  raster extension. C10 changes only WHICH attribute the candidate URL is read from; every candidate then
  passes through the same unchanged policy. `Html_SvgAndRelativeSources_AreSkipped_AndCounted` still holds.
- **No blob path, container or tenancy change.** Image ids stay the SHA-256 prefix of the source bytes, and
  the A18 sweep registers pictures under the same `{businessId}/_images/{docId}/{imageId}` layout.
- **No new secret, no credential read, nothing copied.** The Canada connection string was never written
  anywhere; `kreplay` reads only files already on disk under `Data\`.

---

## 8. Config hygiene

| Key | Host | Class default | appsettings | ARM/deploy |
|---|---|---|---|---|
| `…:Vision:MaxRepairWordLossPercent` | **both** vision owners (Functions `Voice:Knowledge:Vision`, API `AIAssistant:ProviderAttachmentProcessing:Vision`) | `VisionTranscriptionSettings.MaxRepairWordLossPercent = 25` | 25 in both | not needed (§4: `appsettings.json`, not `local.settings.json`) |
| `Voice:Knowledge:Images:MaxTranscribedPictures` | Functions ONLY — the API host does not run the ingest image lane | `VoiceKnowledgeSettings.Images.MaxTranscribedPictures = 5` | 5 | not needed |
| `StorageConfiguration:ProviderKnowledge:AllowedExtensions` and `…:ProviderSetupDocuments:AllowedExtensions` | API — the upload gate at `KnowledgeController.cs:239` | n/a (array) | `.tif` added beside `.tiff` in both | not needed |

Class defaults mirror appsettings (memory `feedback_appsettings_class_defaults`). No key was added to a host
that does not read it, no orphan key was left behind, and **no `local.settings.json` entry was added**, so no
ARM or `deploy.ps1` change is required — `git status` confirms no `local.settings.json` is touched.

‼️ **One inconsistency found while auditing this dimension, and fixed:** `KnowledgeDocumentFormats` (Functions)
accepted `.tif` while the API's upload allow-list listed only `.tiff`, so a provider uploading `scan.tif` was
refused at the door for a format the pipeline reads perfectly. Both API lists now carry `.tif`.

---

## 9. Comments (§0.14)

Every comment added in this phase carries a WHY, an invariant, a measured number or a spec reference; none
narrates what the next line does. The ones that earn the most space are the ones a future reader would
otherwise undo: why an undeclared table gets NO labels (`ResolveTableLayout`), why the reuse key is
(picture, words) rather than "has words at all" (C7), why a cased script typed in lower case must refuse BOTH
signals (ADV13), why the media sweep reads content types rather than the SDK's classes (A18), and why
THEME / MASTER / LAYOUT / HEADER / THUMBNAIL parts are excluded from it. Three comments were **shortened**
when the code around them was rewritten, rather than left describing a previous shape.

---

## 10. Docs and memory

- `clinqet-voice-assistant` SKILL updated in all four AI-tool directories, plus `clinqet-ai-assistant`
  (the judge is shared with provider setup and service extraction) — listed in `HANDOVER.md`.
- Memory entry written, with its one-line `MEMORY.md` index entry.
- `PLAN.md`'s phase-1 row marked complete with the date.
- `phase-1\HANDOVER.md` written; `PHASE-2-PROMPT.md` rewritten with the full skeleton.

---

## 11. Gaps — what I saw and did not fix

‼️ **Under the owner's ruling an extraction gap needs the owner's explicit acceptance in the conversation.
None of these five has been accepted. They are open questions, not deferrals.** Each states its cost.

1. **C7's cross-document caption reuse cannot be keyed on grounding without a new Cosmos field.**
   `KnowledgeDocumentImage` stores `contentHash`, `caption`, `kind`, `quality` — no record of the words the
   caption was written beside. Keying reuse on (bytes, grounding) needs a `groundingHash` field, which is a
   §0.7 change. **My recommendation is NOT to add it**, by §0.7's own test — *what breaks if omitted?*
   Nothing today: an identical re-ingest short-circuits before any spend (Case C), and a reprocess of
   unchanged content reuses the banked artefact, which already carries `ImageCaptions`. The field would save a
   caption call only for the same picture in a SECOND document with identical neighbouring words. The in-run
   half — the half that was genuinely dead — is fixed and proven.
2. **A19's remaining formats: `.csv`, `.doc/.xls/.ppt`, `.docm/.xlsm/.pptm`.** Each needs a decision, not a
   line: `.csv` needs a delimiter/quote/encoding reader (and CSV is how a dealer exports a price list, so I
   think it is worth building); the legacy binary trio needs a converter the platform does not have; the
   macro-enabled trio is the same OOXML package plus a macro part, so accepting it is mostly a security
   question. **Question: add `.csv` in Phase 2, and refuse the other two families explicitly?**
3. **A multi-frame TIFF stores only its first frame as a sendable picture.** Its TEXT is complete — the
   rasterizer reads every frame, DI bills and reads every frame, and the page cap pre-counts frames — so
   nothing is lost from an answer. What a caller cannot be SENT is pages 2..n as pictures. Making each frame
   its own asset changes the asset-identity model for an uploaded file (one upload, N imageIds).
   **Question: is a multi-page TIFF ever a picture a receptionist should send?** My view: no — leave it.
4. **The five §9 "declared limits" of the previous programme.** ‼️ **EX-32 (dehyphenation) is no longer one
   of them — the owner raised it on 2026-09-11 and it is now FIXED** (see §1 and §15). My recommendation on
   the remaining four: **keep** EX-28 (an animated GIF's first frame is what gets described — correct) and
   EX-34 (a vector picture has no raster, and C5 now books it honestly as Bounded); **keep** EX-24 (typed
   inventory counts) and EX-25 (blank-first-cell carry) as stated, both of which X-03's band-merge and the
   `HoldsAValue` guard have already narrowed. Each still needs the owner's re-confirmation under the
   2026-09-10 severity ruling.
5. **ADV08: one wrapped lowercase name in an all-lowercase run stays split — and the DRAFT NAME is wrong.**
   `gel manicure with` / `french tips` / `$45` and `services` / `haircut` / `$25` are character-for-character
   the same shape; only vocabulary could separate them, and this module bans vocabulary by design so it can
   read Gujarati, Hindi, Chinese and Arabic the same way. What Phase 1 guarantees: **every word survives, in
   ONE card, and two different services are never welded** (the weld DID happen and is fixed — ADV13).
   **The measured cost:** a caller asking "how much is a gel manicure?" is answered **$45** correctly,
   because the receptionist reads the whole card — but **the Clinket AI Data Analytics draft is named
   `french tips` instead of `gel manicure with french tips`.**
   ‼️ **This is Phase 2's to fix and it is written into `PHASE-2-PROMPT.md` §1A.2 and its scope as D10, with
   the design.** The drafts lane can answer what the parser cannot, because
   `KnowledgeServiceDraftAnalyticsJob.BuildExtractorText` already emits a real section as `## <section>` —
   so a marked heading and a bare preceding line are DIFFERENT inputs there. The actual defect is that the
   model never sees the line at all: `ExtractorLine` emits one line per CANDIDATE and a candidate must carry
   a price, so `gel manicure with` is filtered out before the extractor is called. Carrying a candidate's
   own preceding line (when it is neither a candidate nor a heading) restores the context — the same move
   EX-13 made for pictures — and is not a workaround.

---

## 12. Fixture before/after — the 17 retained documents

Nothing was deleted; every document keeps its id. `phase-1\live-replay\<doc>.cards-HEAD.txt` is HEAD's
reading of each live artefact; `evidence\ca-live-batch\<doc>\cards.txt` is what the deployed run indexed.

| Document (docId prefix) | Live cards | HEAD cards (chunker only) | Words lost / invented | Note |
|---|---|---|---|---|
| `Microsoft Pricing Structure.xlsx` `58a4f6ad` | 6 | 3 | 0 / 0 | the extra live cards are DocSummary + DocAggregate |
| `Mortgage Amortization…pdf` `7e3e6e16` | 11 | 8 | 0 / 0 | |
| `docx_paragraph_pricelist` `a8ea527d` | 2 | 1 | 0 / 0 | the office half is proven end to end in `after\` |
| `docx_two_column_table_resume` `b67f3100` | 2 | 1 | 0 / 0 | A8 proven in `after\` (1 → 6 cards) |
| `img_gujarati_pricelist.png` `6fcd9c32` | 5 | 2 | 0 / 0 | |
| `img_pricelist_lowercase_inline.jpg` `e20a44eb` | 3 | 2 | 0 / 0 | |
| `img_pricelist_two_columns_photo.jpg` `c425468e` | 3 | 2 | 0 / 0 | |
| `pdf_duration_grid_crosstab` `5052162c` | 10 | 2 | 0 / 0 | both Table cards **byte-identical** (248 and 165 chars) |
| `pdf_footer_disclaimer_repeated` `726e13b3` | 8 | 6 | 0 / 0 | |
| `pdf_headerless_price_table` `8278471e` | 3 | 2 | 0 / 0 | |
| `pdf_hindi_gujarati_english_pricelist` `4eeae96e` | 4 | 3 | 0 / 0 | the L-2 document; the judge fix needs the deploy |
| `pdf_insurance_medical_and_fees` `d4e125ae` | 10 | 4 | 0 / 0 | |
| `pdf_price_shapes_tiers_units` `ef5d0c54` | 9 | 3 | 0 / 0 | |
| `pdf_table_across_pages_header_once` `925b98c1` | 10 | 6 | 0 / 0 | the L-3 document |
| `pdf_two_column_prose_resume` `bfb6dfba` | 4 | 3 | 0 / 0 | the L-1 document; its `## reviews` carried 9 discrepancies |
| `pptx_two_textbox_columns` `2867e25e` | 7 | 6 | 0 / 0 | A7 proven in `after\` |
| `xlsx_merged_header_formats_hidden_regions` `a5b5e051` | 4 | 3 | 0 / 0 | **the one word difference: HEAD stops inventing `Service`** |

**The verifier `## reviews` before and after, and the alerts each fixture raises, can only be compared after
the deploy** — they are produced by the judge, whose input is a fresh vision reading. The before-state is
preserved in `evidence\ca-live-batch\*\artifact.json`; `HANDOVER.md` gives the exact commands.

---

## 13. Prior fixes intact

Every item marked **F** in `evidence\agent-X-prior-audit-crosscheck.md` §1 is covered by a test in one of the
three suites, and all three suites are green (§2) — that is the systematic answer. Eight were additionally
spot-checked in today's source, chosen from the files this phase rewrote most:

| Prior id | Still there, at |
|---|---|
| **#13** XLSX merged ranges | `KnowledgeDocumentParser.OpenXml.cs:873` `var merges = MergedRanges(worksheetPart);` |
| **#14** formula source never leaks | `…OpenXml.cs:1398` `?? (cell.CellFormula == null ? cell.InnerText : null)` |
| **#17** JPEG COM marker forces a re-encode | `KnowledgeImageNormalizer.cs:123` `… && !(isJpeg && HasJpegComment(source))` |
| **#18** data-URI bounded BEFORE decoding | `KnowledgeDocumentParser.cs:1670` `if (encodedLength / 4 * 3 > _maxSourceImageBytes)` |
| **EX-03** per-document media budget | `WithinMediaBudget` enforced at all four collectors (`OpenXml.cs:532`, `:1007`, `:1345`, `Pptx.cs:604`) — including the new A18 sweep |
| **EX-09** figures carried back to their line | `PageMarkdownSplicer.cs:59` `CarryFigures` |
| **EX-11** image policy floor + aspect ratio | `KnowledgeImagePolicy.cs:24-36` |
| **EX-14** repeated placements keep their cards | `KnowledgeDocumentParser.cs:82` `CollapseRepeatedImageMarkers` |

---

## 14. Two things this audit found in its own work

1. **A blanket CRLF restore silently rewrote seven lines of `Clinqet.API\appsettings.json`** that the repo
   holds as LF. Caught by comparing `git diff` with `git diff --ignore-cr-at-eol`, and repaired by rebuilding
   the file byte-exactly from the HEAD blob plus the one intended insertion. Every changed file in every repo
   now has an identical diff with and without that flag: **no line-ending-only change is left anywhere.**
2. **An earlier edit pass double-encoded 102 comment lines** of `KnowledgeDocumentParser.OpenXml.cs`
   (`‼️` became mojibake). Found by a byte-level sweep of every changed file, repaired deterministically, and
   the sweep re-run to zero. The cause was `perl -0pe` with `\x{…}` escapes forcing wide-character output; the
   remedy adopted for the rest of the session was to splice non-ASCII text from a file rather than a pattern.

Neither reached a test, which is why both are recorded here.

---

## 15. EX-32, the hyphen — raised by the owner mid-phase and fixed properly

**The owner's challenge, 2026-09-11:** *"line break with `-` very low chance and because of that we are
breaking some word with real `-` … no workaround … whatever we do we shouldn't break something."*

That is exactly right, and it exposed the shape of the defect. The old rule joined `-` + a lowercase line
and **deleted the hyphen in every lane**. So `anti-` / `ageing` became the non-word `antiageing`, and
`D-tan`, `blow-dry`, `X-ray` and `T-shirt` were damaged the same way — while the case the rule existed for
(a typeset word split across printed lines) only ever arrives through one lane.

**The solution is not a better guess; it is putting the rule where the question is answerable.** Soft
hyphenation is a property of TYPESET text. It reaches us only through a rendered page — Document
Intelligence OCR, a vision transcript, a photographed page. In a typed document a newline is a break the
AUTHOR pressed, and nobody types a hard break in the middle of a word, so a trailing hyphen there is the
author's own character.

| Lane | `-` + lowercase | Why it is a fact, not a probability |
|---|---|---|
| **Rendered** (`ParseLayoutMarkdown`, the picture-text pass) | join, **drop** the hyphen | a printed line break splits words; that is what hyphenation IS in typeset text |
| **Typed** (DOCX, XLSX, PPTX, HTML, TXT, MD, JSON) | join, **keep** the hyphen, no space | the author typed both the hyphen and the break |

And inside the rendered lane, two guards remove the remaining guess — neither is a dictionary or a language
rule:

1. **Typography.** Fewer than `MinLettersBeforeSoftHyphen` (3) letters before the hyphen is never a
   compositor's break; no typesetter breaks a word after one or two characters. `D-tan`, `X-ray`, `e-bike`
   and `T-shirt` therefore keep their hyphen even in a scan.
2. **The document is its own dictionary.** If the hyphenated form appears anywhere else in the same document
   intact, the hyphen is real and stays. This is free *here and only here*, because the rendered lane hands
   the parser the whole document in one string.

**Two things this found on the way, both recorded because neither reached a test on its own:**

- The first version of the pass **joined every line, not just the hyphenated one** — the original helper
  replaced newlines with spaces, which was invisible while it ran inside `KnowledgeText.Normalize` (that
  collapses whitespace anyway) and flattened an entire page at document level. 14 tests caught it;
  `LayoutMarkdown_TheDehyphenationPass_KeepsEveryOtherLineBreak` now pins it.
- **Both call sites had NO coverage.** Sabotaging them passed every test. The two tests that now reach them
  (`LayoutMarkdown_APrintedWordSplitAtAHyphen_IsJoined`,
  `APhotographedPriceList_HasItsSplitWordsJoined_InTheIndexedText`) exist because of that.
