<!-- Saved 2026-10-02 from the read-only planning agent's final report. Design only; BUILD-STATE.md records what is built. -->


# Plan: fixing the two consumers of the shared document reader (AI setup from a document, and draft service suggestions)

Nothing in this plan needs a SQL, Cosmos or Search schema change. Every new field is either held in memory, written to a blob, or carried in the SSE payload. All file:line references are to the current working tree.

---

## 0. Ground truth I checked first (these change the plan)

1. **The parser half of CX-01 and CX-02 is already in the working tree.** The audit's line numbers (KDP:592-604, :710-750) are from before this session's edits. What is there now:
   - `KnowledgeDocumentParser.cs:748-760`: an open figure is flushed, never cleared.
   - `:783-794`: a page break closes any open figure, table or code block.
   - `:296-441`: page furniture is marked, never deleted, and is never a tag line, table row, heading or priced line.
   - `:591-606`: figure tags are moved onto their own lines before parsing.
   - `:569-571`, `:613-663`: the content-conservation gate, with the page-by-page rebuild and plain-text fallback.
   - `:1016-1020` (plus `KnowledgeBlocks.cs:44-46`): a continuation table now skips furniture, figure text and image markers above it.
   - **What is left for CX-01/CX-02:** carry these results through to the setup consumer, and add consumer tests that use the REAL parser.
2. **CD-02 "pictures of text inside PDFs" is not a defect.** The ingest never reads a picture as text on a rendered source (`KnowledgeIngestProcessorFunction.cs:2521`, `picturesCarryUnreadText = !RenderedPages`), and the drafts rebuild mirrors that rule. The real CD-02 defects are elsewhere:
   - `KnowledgeServiceDraftAnalyticsJob.cs:567-586` uses the wrong flow label and passes no PageAngles.
   - `:421-423` buys a fresh Document Intelligence read even though the ingest banked one (`KnowledgeIngestProcessorFunction.cs:1972-1987`).
3. **CS-08's claim that "setup has no cache" is wrong.** Setup pages are banked: `VisionDocumentTranscriptionService.cs:760-763` writes to `request.CacheContainer`, which is ProviderSetupDocuments, keyed on `{business}/OcrDocumentKey(fileName)/{bytes hash}` (`ProviderSetupDocumentReader.cs:291-292`). An identical re-upload under the same name replays. What is actually missing is a reading deadline and telling the provider.
4. **The setup success message is never shown to the provider.** Web `AIAssistantModal.jsx:540-570` and mobile `AIAssistantModal.tsx:693-695` render only `metadata`. So the "page read in part" sentence (`McpService.cs:1153`, `:1336-1342`) is invisible. Any new setup notice therefore needs a summary-card row, which falls under the **MOCKUP GATE**.
5. **CS-09's root cause is confirmed.**
   - `TranscriptionVerificationAlerts.cs:107-108` builds the EventId from (check, phase, flow).
   - VDTS `:1050-1051` and `McpService.cs:1477-1478` both send (check, Outcome, ProviderSetup), so they produce the same id.
   - `AdminAlertProcessor.cs:208-209` dedupes on that id, and the Cosmos id is the EventId, so the setup consumer's own alert is dropped.
6. **ProviderSetupDocumentReader hand-builds copies of `KnowledgeExtractionOutput`** at `:167-172`, `:234`, `:242-249`, `:257-263` and `:271-278`. `KnowledgeBlocks.cs:181-186` forbids exactly this.
   - The hand-built copies are how `UnpairedPriceLines` and `Conservation` disappear for PDFs and photos (this is CS-04's real root cause).
   - `Build` (`:356-374`) also drops every reading-degradation fact (CS-08).

---

## 1. Design in one paragraph

1. **The setup reader carries everything the reading decided.** It uses `with` copies, adds an in-memory `ContentHash`, keeps the degradation facts, passes PageAngles and a StopBy deadline, and checks that the flattened text still carries every number in the blocks (Gate 2).
2. **`TranscriptionDisputeIndex` binds disputes to a document unit, never to the extractor's name.** A unit is a page plus a row or line plus the amounts at stake. This needs no version raise, because it reads the readings already banked.
3. **A new setup gate (`ProviderSetupServiceGate`, API only) runs before any write.** Every extracted price must sit on a document unit that carries most of the service's name (Gate 3). For each service it then decides whether the price is disputed, on a page that only kept the quicker machine reading, or not in the file at all. It also runs the existing offering judge on new priced services.
4. **Unconfirmed prices are never written live.** New services become `PendingProviderCompletion`; existing services keep their saved price, and the provider is told.
5. **Each consumer sends ONE `PublishReadingOutcomeAsync`.** Its own dispositions replace the reading's own item for the same region, matched by object identity, so nothing is listed twice.
6. **Drafts bind disputes through the candidate row** (page + amounts + row words). Drafts from pages that lost their table shape, from degraded artefacts or from stale artefacts are marked amber.
7. **The reading-rule changes (CS-01, CS-03) ship under one `AdjudicationRulesVersion` raise**, shared with the B-series and A5.

---

## 2. Findings: root cause, change, edge cases, copy, tests

Test placement follows §0.18:
- Setup reader, setup gate, McpService → `Clinqet.API.UnitTests` / `.IntegrationTests`.
- Parser, comparer, dispute index, alerts, judge, drafts → `Clinqet.Communications.UnitTests` / `.IntegrationTests`.

### CX-01 — a stuck figure deletes pages (consumer side)

**Root cause (already fixed):** see §0.1. The remaining setup leak was `ProviderSetupDocumentReader.cs:234/242-263`, which dropped the `Conservation` report.

**Change:**
- Every reader path returns `output with { PageCount = …, Images = …, SkippedImages = …, LostImages = … }`.
- Setup reports `Extraction.Conservation` in its reading outcome (§3).
- If `Conservation.PagesKeptAsText` contains page P, prices found on P are treated as unconfirmed. The table shape there is gone, so a column could be misread.
- In drafts, candidates from those pages are amber (§CD-01).

**Tests:**
- `ProviderSetupDocumentReaderTests.ReadAsync_APdfWhoseLogoRepeatsOnTwoPages_CarriesEveryAmountIntoTheText`
  - Setup: real `KnowledgeDocumentParser`, plus a vision mock returning a 4-page layout with `<figure>A\nABLE\nINSURANCE</figure>` at the top of pages 1 and 4 and premiums on pages 1–3.
  - Expected: `KnowledgeFigures.MissingFrom(markdown, result.Text)` is empty, and `Conservation` is null.
- `ReadAsync_ALogoOnPagesOneAndFour_KeepsItsPageOneMarker`
  - Setup: collectImages on; the binder mock returns the blocks unchanged.
  - Expected: an ImageMarker on page 1, so the first-page logo rule at `ProviderSetupImageService.cs:874-877` can fire.
- `ReadAsync_AParseThatLostContent_CarriesItsConservationReport`
  - Setup: parser mock returns a `Conservation` report.
  - Expected: `result.Extraction.Conservation` is the same object.
- Integration: covered by S-1 in §2-INT.

### CX-02 — continuation table under a logo loses its labels

**Root cause:** fixed at `KnowledgeDocumentParser.cs:1016-1020`.

**Change:** none in the consumer beyond the `with` copies.

**Tests:**
- `ProviderSetupDocumentReaderTests.ReadAsync_AContinuationTableUnderALogo_KeepsItsColumnLabels`
  - Setup: real parser; page 2 opens with `<figure>LOGO</figure>`, then `| Perm | 120 | 150 |`.
  - Expected: Text contains `Service: Perm | Short: 120 | Long: 150`.
- `KnowledgeServiceDraftAnalyticsJobTests.NoArtefact_AContinuationTableUnderALogo_StillBecomesSuggestions`
  - Setup: DI mock returns the layout markdown; real parser.
  - Expected: the page-2 rows become candidates and drafts.

### CS-01 — setup scope misses Indian notation, contact facts and header rows (rule change, needs the version raise)

**Root cause:** `DocumentTranscriptComparer.cs`:
- `:38`: `CurrencyToken` is `[A-Z]{3}|CA\$|US\$|[$€£₹]`. It misses `Rs`, `/-` and `रु`, and counts MON/GST/SPA as money.
- `:789-793`: `IsPricedRow` refuses a cell containing letters (`Rs 500`).
- `:778`: in setup scope, everything that is not money is dropped.
- `:151`: `AddedValues` only sees glued symbols.
- `:693-694`: `InferContext` collects 3-letter "codes".

**Change:**
- `CarriesMoney`, `IsMoney` and `InferContext` all use `KnowledgePriceMarks` (`ScanLine` / `ScanCell`, `CurrencyCodes`) as the single definition of money.
- Add `TranscriptComparisonLimits.PriceLabels`, fed from `VoiceKnowledgeSettings.ServiceDrafts.PriceFieldLabels`. VDTS already injects VoiceKnowledgeSettings.
- `Compare()` pre-computes the set of tables that carry a priced row (in either reading). Every row of such a table, including its header row, counts as money.
- A header-row discrepancy is emitted with a new `TranscriptionVerificationDiscrepancy.PageWide = true`. Which column is the price is then unknown for the whole table.
- In setup scope, keep any discrepancy whose source or candidate carries a figure (`KnowledgeFigures.Numbers`): phones, times, durations, discounts. Prose without digits stays out of scope.
- `AddedValues` checks marked amounts per unit (catches an invented `Rs 900`).
- Pin `KnowledgePriceMarks.cs` and `KnowledgeFigures.cs` in `BankRulesVersionConventionTests.PageReadingFiles`. The comparer already uses KnowledgeFigures (`:141`, `:152`, `:802`) unpinned, which is an existing gap.

**Consumer completion (step 5):** when digits are disputed on the same page, setup withholds the matching fact instead of writing it:
- business phone (digit-run containment) and address;
- availability day times (time values parsed from the readings);
- offer discount values (counted in `offerSkippedCount`, which the existing "Offers Need Review" row already shows);
- service duration.

**Edge cases:** `Rs 500`/`Rs. 500`/`INR 500`/`रु 500`/`500/-`/`₹1,00,000` are money. `45,00 €` and `1 234,50 €` (symbol after the number, French grouping) are money. `MON 9`/`GST 5%`/`SPA 3` are not money.

**Tests (`Communications.UnitTests/Knowledge/DocumentTranscriptComparerTests`):**
- `SetupScope_IndianNotation_IsMoney`. Theory over Rs/`/-`/₹ lakh/INR/रु. Expected: 1 discrepancy, CarriesMoney true.
- `SetupScope_ContactFacts_AreChecked`. Theory: `0100→0700`, `9:00→8:00`, `30 min→60 min`.
- `SetupScope_SwappedHeadersOfAPricedTable_AreReported_PageWide`.
- `SetupScope_ProseThatChangedMeaning_StaysOutOfScope`.
- `ThreeCapitalLetters_AreNotMoney`.
- `AnInventedRupeePrice_IsAskedAbout`.
- Raise test: `BankRulesVersionConventionTests` pins `(2, fp)`.
- API: `McpServiceTests.ProcessAttachmentProviderSetupAsync_ADisputedPhoneOrDay_IsNotSaved`.

### CS-02 — disputed prices are bound to services by name only; list and prose prices are classed as "service name"

**Root cause:**
- `TranscriptionDisputeIndex.cs:56-72` matches only on `Fields.Contains("price")` plus the row label or a whole-token name.
- `Comparer :782-783` labels every non-table unit `"service name"`.
- `McpService.cs:841` and the drafts job `:812` / builder `:418-419` ask by the extractor's name.

**Change (no version raise; works on banked reviews):**
- The index stores, per entry:
  - `Page` (from `review.PageNumber`);
  - `Original`, the discrepancy instance;
  - `AtStake` amounts: number tokens that are not agreed across all non-empty readings (Ocr/FirstAi/Third/Selected), each expanded to its `KnowledgeFigures` readings plus `KnowledgePriceMarks` marks. For ContentMissing/Added, every token of the non-empty side is at stake.
- An entry is a pricing dispute when `AtStake` is non-empty or it is `PageWide`, whatever its `Field`.
- New method `PricingAt(int? page, IReadOnlyCollection<decimal> amounts, IReadOnlySet<string> unitTokens)`. It matches when an amount is at stake AND one of these holds:
  - the entry's row-label tokens are a subset of the unit's tokens (any page);
  - the readings' words overlap the unit's words (any page);
  - the entry has no words at all (a bare cell) and is on the same page.
  - A `PageWide` entry on the same page always matches.
- `NamingFor` / `PricingFor` stay as a second net.
- `TranscriptionDispute` gains `Original` and `PageNumber`. `with { Discrepancy = … }` keeps both.

**Edge cases:**
- "Facial (basic)" vs "Basic Facial", "Facials", a code column (`HC01 | Haircut | $25`, where `SourceLine` carries every cell), and list-line prices are all found by unit and amount.
- An agreed duration in the same row is not at stake.
- `45,00 €` vs `45.00 €` is agreed.
- Excerpts are cut at 400 characters (`VDTS:1367-1369`). In the version-raise step, store the comparer's differing runs as `ChangedValues` so long paragraphs are not missed.
- The owner rule Q2 (a name-only dispute never withholds a price) is preserved. The existing test `ANameDispute_IsNotAPriceDispute` has to change its fixture: it currently uses "500"/"1200", which conflates a name dispute with an amount dispute.

**Tests:**
- `Communications.UnitTests/Knowledge/TranscriptionDisputeIndexTests`:
  - `AListLinePrice_IsAPriceDispute_WhateverItsField`
  - `ADispute_IsFoundByItsPageAndAmount_NotByName`. Theory over the reworded/plural/code-column names.
  - `AnAmountEveryReadingAgrees_IsNotAtStake`
  - `IndianAndEuropeanSpellingsOfOneAmount_AreOneAmount`
  - `AWordlessCellDispute_BindsByPageAndAmountAlone`
  - `APageWideEntry_UnsettlesItsPage`
  - `ANameOnlyDispute_StillNeverWithholdsAPrice`
- API: `McpServiceTests.ProcessAttachmentProviderSetupAsync_ADisputedListLinePrice_IsWithheld_UnderAnyName`
  - Setup: blocks `- Facial (basic) $45`; review disputes 45/54 with Field "service name"; extractor returns "Basic Facial" 54.
  - Expected: PendingProviderCompletion, `noPriceCount = 1`, one reading-outcome item with ServicePricingWithheld and the right ServiceId.
- Drafts:
  - `KnowledgeServiceDraftBuilderTests.ADisputedRow_IsWithheldByItsCandidate_NotItsName`
  - `KnowledgeServiceDraftAnalyticsJobTests.ADisputedListLinePrice_ArrivesWithoutAPrice_AndCountsAsAPriceToCheck`
  - Integration `KnowledgeServiceDraftAnalyticsJobIntegrationTests.ADisputedPrice_IsStoredWithoutAPrice_OnTheRealDraftRow`. Expected: Price null on the real row, so approve-all skips it via `IsDraftPriceIncomplete`; the row's notice `DraftPricesToCheck` = 1.

### CS-03 — differences beyond the 12th on a page are never checked (rule change, needs the version raise)

**Root cause:**
- `VDTS:835-837` takes 12 discrepancies and silently keeps the transcript for the rest.
- The ceiling path `:710-717` also `Take(12)`.
- `ComparisonUnavailable` is filtered out everywhere (`:711`, `:836`), so the "rest not listed" marker reaches no consumer.

**Change:**
- Discrepancies 13 and beyond are appended to `reported` as `CandidateReadingRetained`, with `RemainingUncertainty = "not checked: the page had more differences than one check covers"`.
- The ceiling path reports every discrepancy, not just 12.
- `ComparisonUnavailable` becomes one `PageWide` entry, with `RemainingUncertainty` set and Disposition `SourceReadingRetained`.
- The consumer needs no new code: these are unsettled entries and are withheld through `PricingAt`.

**Tests:**
- `Communications.UnitTests/Knowledge/VisionDocumentTranscriptionServiceTests`:
  - `APageWithMoreDifferencesThanOneCheckCovers_ReportsTheRestAsUnsettled`
  - `TheCeilingPath_ReportsEveryDifference`
  - `AComparisonThatCouldNotListEveryDifference_ReportsThePageAsNotFullyCompared`
- API: `McpServiceTests.ProcessAttachmentProviderSetupAsync_APriceOnAPageNotFullyCompared_IsWithheld`

### CS-04 — prices the parser refused to pair reach the extractor verbatim

**Root cause:**
- The hand-built copies drop `UnpairedPriceLines` (§0.6).
- A refused run becomes a one-column table without a header (`KnowledgeDocumentParser.cs:1298-1347`), and `FlattenBlocks` hands it to the extractor line by line.

**Change:**
- The parser's refusal now reaches setup. Gate 3 never lets a price-only unit borrow a name, and never applies a lead-in to table rows. So `$30 / Full hands polish / $45 / Gel polish` evidences no service, and both possible pairings are withheld.
- New consumer item `PriceFromUnpairedLines`.
- New summary metadata `pricesWithoutNamesCount` (rendering is mockup-gated).
- Lead-in is allowed only when the priced line carries at least one word of its own. This keeps the D10 wrapped-name case (`gel manicure with` / `french tips $45`) working.

**Edge case:** a bulleted value-first list, which `PairLabelValueRuns` does not detect because it only looks at paragraphs, is covered by the same no-borrowing rule.

**Tests:**
- `ProviderSetupDocumentReaderTests.ReadAsync_AValueFirstPriceList_CarriesItsUnpairedCount` (real parser, PDF route).
- `ProviderSetupServiceGateTests.APriceFromAValueFirstList_IsNeverEvidenced_EitherWay`.
- `McpServiceTests.ProcessAttachmentProviderSetupAsync_PricesThePaserCouldNotPair_AreWithheldAndCounted`.
- Integration S-1.

### CS-05 — setup deletes every price above 99,999.99

**Root cause:**
- `McpService.cs:782-787` treats `Price > maxPrice` as unusable, and `:856-867` nulls it.
- `maxPrice` comes from `:750-752` (class default `AIAssistantSettings.cs:83`, no override in the API `appsettings.json`).
- `DocumentIntelligenceService.cs:1313-1342` (`MapExtractionResponse`) never copies `Currency`, so the per-currency ceiling at `:1281` is always the USD-sized one.
- The alert at `:502` says the prices were "KEPT" while the loop deleted them.

**Change:**
- `priceUnusable` becomes negative `Price`, negative `MaxPrice`, or an inverted range only.
- After `resolvedCurrency` is known (`:511-527`), set `svc.PriceBeyondReviewCeiling = Price or MaxPrice > PriceReviewCeiling.For(maxPrice, svc.Currency?.ToString() ?? resolvedCurrency)`, mirroring the drafts job at `:736-742`. Move the alert at `:492-504` after this.
- High prices with evidence go live. The summary metadata gets `highPriceCount` and `highPriceServiceNames`.
- Add `"MaxAllowedPrice": 99999.99` to the API appsettings `ProviderAttachmentProcessing` so the dial is visible (the class default already mirrors it).
- "Principal $1,000,000" is now caught by CS-07, not by deletion.

**Tests:**
- Rewrite `NewServiceWithUnusablePrice_IsSalvagedAsNoPrice` as `…NewServiceWithANegativePrice_IsSalvagedAsNoPrice`.
- New `ProcessAttachmentProviderSetupAsync_AnUnusuallyHighEvidencedPrice_IsKeptLive_AndTheTeamIsTold`. Theory: INR `₹1,05,00,000` and USD `$150,000`. Expected: FixedPrice kept, Approved, `SetupPriceBeyondReviewCeiling` alert raised.
- New `…TheReviewCeiling_IsJudgedInTheBusinessesOwnCurrency`.
- Remove `1_500_000m` from `IncompleteOrUnusablePrices` (`McpServiceTests.cs:1422-1427`).
- Integration S-3.

### CS-06 — an update overwrites a live price with an unverified one and stays Approved

**Root cause:**
- `ProviderSetupServiceWriter.cs:124-134` re-derives pricing from the extracted service.
- `:90-103` keeps `ApprovalStatusWhenComplete = Approved`.
- The only guard is `McpService.cs:844-847`, which depends on the name-based dispute match that CS-02 shows is broken.

**Change:**
- For an existing service, the extracted price is applied only when the gate says Evidenced and undisputed.
- Otherwise `preserveExistingPricing = true` (the existing copy-pricing path). Record `ExistingServicePricingPreserved` (with a region) or the consumer item `SavedPriceKept` (without one).
- New summary metadata `savedPriceKeptCount`, `savedPriceKeptServiceNames` and `savedPriceKeptServiceIds`, present in all three terminal branches (the rule at `McpService.cs:1588-1589`).

**Tests:**
- `…AnUpdateWhosePriceIsNotInTheFile_KeepsTheSavedPrice_AndSaysSo`
- `…AnUpdateWhosePriceTheFilePrints_UpdatesIt`
- Integration S-2.

### CS-07 — setup has no anchor and no offering check

**Root cause:** nothing in `McpService.cs:767-914` checks that a price is printed in the document. Extractor rule 1 says "Do NOT skip any". Drafts have both an anchor and a judge (`KnowledgeServiceDraftBuilder.cs:291-376` and the judge).

**Change:**
- **New `IProviderSetupServiceGate` / `ProviderSetupServiceGate`** (Services/AI, scoped, registered in API `Program.cs` near `:920`). It is pure apart from the judge call.
  1. **Units:**
     - Table rows: every cell plus its header label; `numbers = KnowledgeFigures` readings ∪ `KnowledgePriceMarks` marks ∪ a closed magnitude list (k/thousand/lakh/lac/L/लाख/લાખ/crore/cr/करोड़/કરોડ/million).
     - List items, paragraph lines, and headings that carry a measure.
     - Lead-in from the line above only for line units that have their own words.
  2. **Slot assignment:** each (unit, number) slot is used once, by one service. If a unit has any marked number, only its marked numbers count. Name overlap must be ≥ `AnchorNameTokenOverlap` (new setting `AIAssistant:ProviderAttachmentProcessing:AnchorNameTokenOverlap`, 0.60). Tokens match if equal, or if one is the other plus at most 2 trailing characters and both are at least 4 long (plural tolerance). Ties break on reverse overlap, then document order, as the builder does. Up-to-date "skip" services also claim slots.
  3. **States:** `NoPriceToProve` / `Evidenced` / `NotInFile` / `FromUnpairedLines` / `Disputed` (`PricingAt` on the unit) / `PageReadOnlyQuickly` / `PageNotFullyCompared` / `FromPictureOnly` (vision fallback).
  4. **Offering check:** new, priced, Evidenced services go to the existing `IKnowledgeOfferingJudge`. `keep=false` means the service is not created; it becomes a `NotAnOffering` consumer item plus `notOfferingCount`/names metadata. Unclear is kept. A judge failure keeps everything and records `OfferingCheckNotRun`; setup never fails because of it.
- The judge gains a `KnowledgeOfferingJudgeRun` parameter (deployment, effort, batch size, attempts, concurrency, lane, subflow). The drafts job passes its ServiceDrafts values. Setup passes new `ProviderAttachmentProcessing.OfferingJudge` settings (Enabled, `AiModels.Luna`, Medium, 100, 2, 2), with a mirrored appsettings entry and `AiSubFlows.SetupOfferingJudge = "D5-setup-offering-judge"`.
- One prompt (`OfferingJudgePromptTemplate`) stays the single definition of an offering.
- Register `IKnowledgeOfferingJudge` in the API.

**McpService restructure** (it must not grow inline; the file is 2,269 lines):
- **Pre-pass:** dedupe, validate categories, resolve the existing-service match.
- **Gate:** call the gate once.
- **Main loop:** pricing decision only. Move `AddSubcategorySelectionAsync` (`:806`) after the gate, so a judge-removed line creates no subcategory.

**Tests:**
- `API.UnitTests/Services/AI/ProviderSetupServiceGateTests` (new, real parser builds the blocks):
  - `ATableRowPrice_IsEvidenced`
  - `APriceTheExtractorMoved_ToTheNextRow_IsNotEvidenced`
  - `AManicurePricedLikeTheGelRow_DoesNotTakeTheGelRowsSlot`
  - `TiersOnOneRow_EachTakeTheirOwnSlot`
  - `ADurationOnAMarkedRow_IsNeverAPrice`
  - `ALakhWrittenInWords_IsEvidenced`
  - `AFrenchGroupedPrice_IsEvidenced`
  - `AFeeLine_IsSentToTheOfferingCheck_AndRemoved`
  - `AnUpdate_IsNeverJudged`
  - `AJudgeFailure_KeepsEverything_AndSaysSo`
- `Communications.UnitTests/Knowledge/KnowledgeOfferingJudgeTests.TheJudge_RunsOnTheLaneAndSubflowItIsGiven`
- `McpServiceTests.…ALineTheCheckCallsAFee_IsNotCreated_AndIsListed`
- Integration S-4.

### CS-08 — a degraded reading is silent in setup

**Root cause:**
- `ProviderSetupDocumentReader.cs:216-234` only handles the oversized-photo case.
- `Build` (`:356-374`) drops `BudgetExhausted`, `RasterizationFailed` and `PagesUnreadable`.
- VDTS `:403-424` falls back to the machine reading for the WHOLE document.
- No `StopBy` is passed (`:287-300`), although the controller cancels at 600 s (`AIAssistantController.cs:584-591`).

**Change:**
- `Build` carries `VisionDegraded`/`OutOfTime`/`RenderFailed`/`PagesUnreadable`/`PagesFailedTransiently`/`PagesReadInPart` onto `Extraction`, plus a new in-memory `VisionPagesKeptMachineReading` list. VDTS fills that list with:
  - every page on budget exhaustion or render failure;
  - failed and unreadable pages;
  - pages the transcriber read as blank.
  - It excludes pages a source check confirmed. This is a pin-only change, with no version raise.
- The reader sets `StopBy = now + ProcessingTimeoutSeconds`. The existing `PipelineReserveSeconds` (180) leaves room for extraction and writes.
- The gate marks prices on those pages `PageReadOnlyQuickly`, so they are withheld.
- **D2 (owner decision):** the DI-outage vision fallback (`McpService.cs:424-441`) withholds all of its prices as `FromPictureOnly`.
- **D3 (owner decision):** an in-request continuation pass, `ProviderAttachmentProcessing.MaxReadingPasses` = 2, re-reads while banked progress grows and the deadline allows.
- Summary metadata `readingNotFinished` and `readingNotFinishedPriceCount`. Rendering is mockup-gated.

**Tests:**
- `ProviderSetupDocumentReaderTests`:
  - `ReadAsync_AReadingThatRanOutOfTime_CarriesWhichPagesKeptTheQuickReading`
  - `ReadAsync_GivesTheReadingTheRequestsOwnDeadline`
  - `ReadAsync_PassesThePageAngles`
- `VisionDocumentTranscriptionServiceTests.PagesKeptMachineReading_NamesEveryPageThatKeptIt`. Theory over budget, render and unreadable.
- `McpServiceTests.…PricesFromPagesReadOnlyTheQuickWay_AreWithheld`
- Integration S-5.

### CS-09 — setup's own verification alert is always discarded

**Change:** replace `PublishSetupVerificationOutcomeAsync` (`McpService.cs:1059`, `:1445-1487`) with the per-reading report (§3). Remove the VDTS per-check alerts: Required `:844-848`, Outcome `:1050-1055`, layout `:495-496` and `:1177-1210`. The new type `ProviderSetupReadingNeedsReview` and its EventId cannot collide.

**Additional fix:** add `KnowledgeReadingNeedsReview` and `ProviderSetupReadingNeedsReview` to the EventId dedupe and identity branch at `AdminAlertProcessor.cs:79-92` and `:206-209`. They carry deterministic EventIds and should not be deduped by content.

**Tests:**
- `McpServiceTests.ProcessAttachmentProviderSetupAsync_SendsOneReadingOutcome_WithThisFlowsOwnDispositions`. This replaces `AnUnconfirmedPrice_RaisesThisFlowsOwnOutcomeAlert` (`:1239`). Expected: one call; Flow ProviderSetup; `Source.ContentHash` equals the reader's hash; the disputed region appears once, with ServicePricingWithheld and its ServiceId; `PublishAsync` is never called.
- `Communications ReadingOutcomeAlertsTests` (§3).
- `AdminAlertProcessorTests.AReadingOutcome_IsDedupedByItsEventId`.
- Integration S-1 (the alert persisted on real Cosmos).

### CS-10 — "existing service pricing preserved" is never shown to the provider

**Change:** CS-06's metadata, plus a summary row (mockup). Copy is in §5.

**Tests:** `…ASavedPriceKept_IsInTheSummary_OnEveryBranch`, plus client tests after mockup approval.

### CD-01 — drafts keep reading stale, lossy artefacts after a parser fix

**Root cause:**
- `KnowledgeContentArtifactStore.cs:65-78` checks only the content hash.
- The job at `:358-366` uses `artifact.Blocks` whatever their pipeline fingerprint or `VisionDegraded` say.

**Change:**
- New blob field `KnowledgeContentArtifact.Markdown`: the joined reading the parse was made from, written by the ingest when the artefact is built (`KnowledgeIngestProcessorFunction.cs:1225`), and only when it fits `ContentArtifactMaxBytes`. This is a blob, not a §0.7 field.
- Move the pipeline fingerprint (`KnowledgeIngestProcessorFunction.cs:118-128`) into a shared Functions static.
- `LoadInputsAsync`:
  - Fingerprint mismatch with `Markdown` present: re-parse with `ParseLayoutMarkdown` (free) and keep its `Conservation` as `OwnConservation`.
  - Born-digital format: re-parse the source; picture text replays only what the ingest already read.
  - Mismatch with no `Markdown`, or `VisionDegraded`: use the blocks, but every draft is amber via a new builder input `PagesToCheck`, and add a `ReadByAnOlderReader` consumer item.
  - Never pay AI.
- The "sweep" is an owner-run reindex list from the existing scan tool. Nothing re-reads by itself.

**Tests:**
- `KnowledgeServiceDraftAnalyticsJobTests`:
  - `AnArtefactFromAnOlderReader_IsParsedAgainFromItsSavedReading_ForFree` (Document Intelligence and vision are never called)
  - `AnOldArtefactWithoutItsReading_IsUsedAsIs_AndEverySuggestionIsMarkedToCheck`
  - `ADegradedArtefact_MarksItsSuggestionsToCheck`
- `KnowledgeIngestProcessorFunctionTests.TheArtefact_BanksTheReadingItWasParsedFrom`
- Integration `AStaleArtefact_IsReparsedFromItsBankedReading_OnTheRealRows` (Azurite + Cosmos).

### CD-02 — see §0.2

**Change:** the rebuild at `:421-423` reads `IKnowledgeExtractionCache` first, using the ingest's key `(contentHash, ExtractionModelId, ExtractionOutputFormat, wantFigures = extension == ".pdf")`. Pass PageAngles. Use `Flow = ServiceDraftExtraction` at `:581`; this only affects long-page alert types now.

**Tests:** `NoArtefact_ForAPdf_ReadsTheBankedMachineReading_AndNoPictureAsText`.

### CX-03 — the same file is read twice, by knowledge and by setup

**Root cause:** `ProviderSetupDocumentReader.cs:288-299` always buys its own reading, under a different scope and cache.

**Change:**
- After downloading, `IKnowledgeDocumentRepository.FindByContentHashAsync(businessId, hash)`. This is existing and partition-scoped, so it needs no new query or index.
- If the document is Ready and `TryReadForAnalyticsAsync` returns its artefact, build the content from it:
  - `Text = FlattenBlocks(artifact.Blocks)`; Reviews, Conservation and `UnpairedPriceLines` from the artefact.
  - Images from `artifact.Images` pointers (ProviderKnowledge container, capped by `Images.MaxImagesPerDocument`).
  - Set `ReusedKnowledgeDocId`.
- Otherwise read as today.
- This saves the Document Intelligence read, the vision reading and the checks, and makes the receptionist and the bookable service use the same reading.

**Tests:**
- `ReadAsync_AFileAlreadyReadAsKnowledge_ReusesThatReading_AndBuysNothing`
- `ReadAsync_AKnowledgeFileStillBeingRead_IsNotReused`
- `ReadAsync_ReusingAKnowledgeReading_BringsItsPictures`
- Integration S-6.

### P2 items

- Long-page warning (`VDTS:300`) and "The provider was told" (`:480`, `:491`): make the wording depend on the flow. For setup the warning reads "read up to the limit if the reading's time allows" and the limit alerts read "the provider was not told". Pin-only change. Tests: `TheLongPageWarning_ForSetup_DoesNotPromiseAFullReading`, `ThePageLimitAlerts_ForSetup_DoNotClaimTheProviderWasTold`.
- Required-phase noise: removed (CS-09).
- Repeated priced line under another heading: resolved by the parser (`:438-439`). Test: `ProviderSetupDocumentReaderTests.ReadAsync_TheSamePricedLineUnderTwoHeadings_IsKeptOnBoth` (real parser).
- `[A-Z]{3}` counted as money: CS-01.

### Conservation gates

- **Gate 1** belongs to A5 in VDTS. The consumer contract: its findings must be emitted as unsettled review entries (ContentMissing with `RemainingUncertainty`, or `PageWide`). They then flow through `PricingAt` and `Apply` with no extra consumer code.
- **Gate 2:**
  - The parser part is done.
  - Setup adds a FlattenBlocks number check in `Build`. It compares Text/ListIntro/ListItems/table cells/caption numbers against the text, excluding alt text, and fills `ProviderSetupDocumentContent.TextNotCarried`, which raises the consumer item `TextNotCarried` and always alerts. Test: `ReadAsync_TheFlattenedText_CarriesEveryNumberItsBlocksHold`.
  - Drafts: `OwnConservation` from any parse the drafts lane makes itself.
- **Gate 3:** CS-07's gate for setup; `PagesToCheck` amber for drafts.

### §2-INT — new money-path integration suite

New file `Clinqet.API.IntegrationTests/Services/ProviderSetupReadingConservationIntegrationTests.cs`.

**Harness:**
- `McpService` built as in `ProviderSetupChunkedExtractionIntegrationTests.cs:272-313`.
- REAL `ProviderSetupDocumentReader`, `KnowledgeDocumentParser` and `ProviderSetupServiceGate`.
- Mocked Document Intelligence returning layout markdown; a scripted vision service returning a transcript plus Reviews plus degradation facts; a scripted extractor; a mocked judge.
- REAL writer, Cosmos services, and `TranscriptionVerificationAlerts` over the factory's `IServiceBusService`, so alerts are persisted on real Cosmos and found with `Eventually.FindAsync`.

**Tests:**
- **S-1** `EveryEvidencedPrice_IsLive_AndEveryUnconfirmedOne_IsNot_OnRealRows`
  - Document: table `Haircut $25`/`Colour $80`; list `Facial (basic) $45`, disputed 45/54; a value-first run; an invented `Head Massage $15`.
  - Expected: two Approved rows; four PendingProviderCompletion rows; a `ProviderSetupReadingNeedsReview` alert, High, with items PricingWithheld ×1, PriceFromUnpairedLines ×2 and PriceNotInFile ×1.
- **S-2** `AnExistingLivePrice_SurvivesAnUnconfirmedReplacement`. Expected: stays $30 Approved; `savedPriceKeptCount` = 1.
- **S-3** `ALakhPrice_IsWrittenLive_AndTheCeilingAlertPersists`.
- **S-4** `AFeeLine_NeverBecomesALiveService`.
- **S-5** `PricesFromAReadingThatDidNotFinish_AreWithheld`.
- **S-6** `AFileAlreadyReadAsKnowledge_IsNotReadAgain`. Seed a real knowledge row and an Azurite artefact; Document Intelligence and vision are verified never called.

---

## 3. Exact wiring of the per-reading alert

**New in-memory contract (no schema):**

```csharp
// clinqetcore/Interfaces/AI/IProviderSetupDocumentReader.cs — ProviderSetupDocumentContent
public string ContentHash { get; init; } = string.Empty;          // SHA-256 of the uploaded bytes, upper-case hex
public string? ReusedKnowledgeDocId { get; init; }                // CX-03: that ingest already reported this reading
public IReadOnlyList<string> TextNotCarried { get; init; } = [];  // Gate 2

// clinqetcore/Models/AI/ReadingOutcomeReport.cs
public IReadOnlyList<ReadingConsumerItem> ConsumerItems { get; init; } = [];

// clinqetcore/Models/AI/ReadingConsumerItem.cs (new) + clinqetshared/Enums/ReadingConsumerItemKind.cs (new, JsonStringEnumConverter)
public sealed record ReadingConsumerItem(ReadingConsumerItemKind Kind, int? Page, string? Subject)
{ public string? ServiceId { get; init; } public string? DraftId { get; init; } public string? Value { get; init; } public string? SavedPricing { get; init; } }
// Kinds: PriceNotInFile, PriceFromUnpairedLines, PriceFromQuickReading, PriceFromPictureOnly, SavedPriceKept, NotAnOffering,
//        OfferingCheckNotRun, FactWithheld, PricedLinesNotSetUp (aggregate), TextNotCarried, ReadByAnOlderReader
```

**Where the setup ContentHash comes from:** `ReadAsync` downloads the bytes once for every route and computes `Convert.ToHexString(SHA256.HashData(bytes))`. This is the same upper-case format the ingest stores (`KnowledgeIngestProcessorFunction.cs:900`), so CX-03 lookups match. The hash is passed to the vision request for the Document Intelligence routes, so it is not computed twice. Webp/gif keep their normalized-bytes cache key. The hash is set on every result where bytes were downloaded, failures included, because the vision fallback still reports.

**How a consumer's disposition replaces the reading's own item, without listing it twice.** New `public static class ReadingOutcomeReviews` in `Services/AI`:

```csharp
public static IReadOnlyList<VisionPageReview> Apply(IReadOnlyList<VisionPageReview> reviews,
    IReadOnlyCollection<TranscriptionDispute> outcomes, bool keepUnconsumed)
// For each review discrepancy d:
//   outcomes whose Original is d (ReferenceEquals) → emit them INSTEAD of d, one per affected service/draft,
//     keeping the strongest disposition: Withheld > ExistingPreserved > ThirdNameUsed;
//     a PageWide region bound to many services is aggregated into ONE item listing them;
//   otherwise emit d only when keepUnconsumed.
// Reviews left with no discrepancies are dropped.
```

Matching by identity is exact because the index is built from the same list the report carries. For drafts that list is one deserialized artefact. Two regions that happen to have equal text therefore never collapse into one.

`ReadingOutcomeItems.From` changes:
- add `ThirdNameUsed → NameTakenFromCheck` (it is missing today, at `ReadingOutcomeItems.cs:47-59`);
- map ConsumerItems to new kinds;
- `CarriesANumber` also checks `Consumer.Value`;
- `TextNotCarried` always sends, like ContentLost.

In `TranscriptionVerificationAlerts.BuildOutcome`, the description, metadata and digest include consumer items (Subject, Value, ServiceId, DraftId). The `described` filter at `:124` must not drop items that have no discrepancy.

**Setup** (replaces `McpService.cs:1055-1060` and `:1445-1487`). It is called in all three terminal branches before the Content event (`:1157`, `:1254`, `:1319`), and not for a manifest:

```csharp
await PublishSetupReadingOutcomeAsync(businessId, loadedProfile?.Name, fileName, blobLocation.Value.BlobName,
    preparedDocument, disputeOutcomes, consumerItems, writtenServiceIdsByName, cancellationToken);
...
await _verificationAlerts.PublishReadingOutcomeAsync(new ReadingOutcomeReport(
    TranscriptionVerificationFlow.ProviderSetup, businessId,
    new TranscriptionVerificationSource(null, fileName, reading.ContentHash)
    { OriginalReference = new StorageReference(_storageConfiguration.Containers.ProviderSetupDocuments, blobName) })
{
    BusinessName = businessName,
    Conservation = reading.ReusedKnowledgeDocId == null ? reading.Extraction.Conservation : null,
    Reviews = ReadingOutcomeReviews.Apply(reading.Reviews, bound, keepUnconsumed: reading.ReusedKnowledgeDocId == null),
    ConsumerItems = items
}, cancellationToken);
```

`bound` fills ServiceId from a name→id map collected from EVERY written service (a `ConcurrentDictionary` written in the batch tasks), and from `existingService.ServiceId` for preserved updates. Today only pricing-required services get an id (`:1461-1475`).

**Drafts** (replaces `KnowledgeServiceDraftAnalyticsJob.cs:910-913` and `:930-969`). It also runs on the zero-candidate and zero-survivor returns when this lane made its own parse:

```csharp
var withheldByRow = new Dictionary<string, IReadOnlyList<TranscriptionDispute>>(StringComparer.Ordinal);
PricingIsUnconfirmed = (candidate, price, max) => {                       // builder input, new signature
    var hits = disputes.PricingAt(candidate.PageNumber, Amounts(price, max, candidate.PriceText), LineTokens(candidate));
    if (hits.Count == 0) hits = disputes.PricingFor(candidate.Name);
    if (hits.Count > 0) withheldByRow[candidate.RowHash] = hits;
    return hits.Count > 0; },
...
var outcomes = drafts.Where(d => d.Price is null && withheldByRow.ContainsKey(d.RowHash))
    .SelectMany(d => withheldByRow[d.RowHash].Select(x => x with { Discrepancy = x.Discrepancy with
        { DraftId = d.DraftId, SourceServiceName = x.Discrepancy.SourceServiceName ?? d.SourceName,
          Disposition = TranscriptionVerificationDisposition.ServicePricingWithheld } })).ToList();
await _verificationAlerts.PublishReadingOutcomeAsync(new ReadingOutcomeReport(
    TranscriptionVerificationFlow.ServiceDraftExtraction, row.BusinessId,
    new TranscriptionVerificationSource(row.DocId, row.DocName ?? row.DocId, row.ContentHash ?? string.Empty)
    { OriginalReference = string.IsNullOrWhiteSpace(row.BlobPath) ? null : new StorageReference(_storageConfig.Containers.ProviderKnowledge, row.BlobPath) })
{
    BusinessName = businessName,
    Conservation = inputs.OwnConservation,                       // only a parse THIS lane made
    Reviews = ReadingOutcomeReviews.Apply(inputs.Reviews, outcomes, keepUnconsumed: false),  // the ingest reported the reading
    ConsumerItems = items
}, cancellationToken);
```

Also: `pricesToCheck` at `:904-905` counts disputed and withheld drafts and amber `PagesToCheck` drafts, using the existing key `Info_KnowledgeDraftPricesToCheck`. Recommended: fold the separate `KnowledgeDraftPriceDisagreement` alert (`:825-836`) into this report as a consumer item, so a reading raises one alert.

**Cleanup once nothing calls them (§0.16):**
- Delete `ITranscriptionVerificationAlerts.PublishAsync`, `TranscriptionVerificationAlerts.Build`/`Severity`/`Summary`/`Describe`/`Line`/`Follow`/`Attempts`, and the `TranscriptionVerificationEvent`/`Invocation` records.
- Keep `AdminAlertType.DocumentTranscriptionVerification` and the processor branch, for stored and in-flight alerts; the admin web renders stored metadata (`AlertsPage.test.js`).
- Replace `TranscriptionVerificationAlertsTests` with "no per-check alert is sent".

---

## 4. Implementation order

Each step builds and passes its own tests.

1. **The reader carries the facts.** `with` copies, ContentHash, degradation facts, `VisionPagesKeptMachineReading` (VDTS, pin-only), StopBy, PageAngles, Gate 2.
   - Tests: API `ProviderSetupDocumentReaderTests` (real parser: CX-01, CX-02, CS-04 count, hash, angles, deadline) and Communications VDTS.
   - Write behavior unchanged.
2. **Pure contracts.** Dispute index v2, `PageWide`/`Original`, ReadingConsumerItem, `ReadingOutcomeItems`, `Apply`, alert text.
   - Tests: Communications index and alerts.
3. Setup gate and McpService, in three parts:
   - **3a:** the `ProviderSetupServiceGate` class and its tests (not wired yet).
   - **3b:** McpService wiring for CS-02/04/05/06/08/10 and the per-reading report. Remove `PublishSetupVerificationOutcomeAsync`. Change the `McpServiceTests` fixture so `SetupProviderSetupMocks` builds reader blocks from the extraction (one table row per service), so the existing tests keep their meaning. Rewrite the CS-05 tests. Constructor edits in the two integration tests that build McpService by hand.
   - **3c:** new integration suite S-1/2/3/5.
4. **Offering check (CS-07).** Judge `Run` parameter, settings, API DI, gate, S-4.
5. **Profile facts withheld (CS-01 consumer).** Phone, address, hours, offers, duration.
6. **Drafts.** Builder signature and `PagesToCheck`, job binding and report, extraction cache and PageAngles, `pricesToCheck`.
   - Tests: unit plus integration.
   - **6b:** remove the VDTS per-check alerts and the dead publisher code (pin-only) and fix the P2 wording.
7. **One reading-rules raise, `AdjudicationRulesVersion` 1→2.** Shared with B1–B5 and A5: CS-01 comparer, CS-03 overflow and page-wide markers, `ChangedValues`, pin `KnowledgePriceMarks`/`KnowledgeFigures`.
   - Tests: Communications comparer, adjudication, VDTS, and pin `(2, fp)`.
8. **Setup continuation pass** (owner decision D3).
9. **CD-01.** Artefact Markdown, shared fingerprint, free re-parse, amber, integration test.
10. **CX-03.** Knowledge reading reuse plus S-6.
11. **UI after mockup approval.** Web and mobile, 5 languages.
12. **Docs.** SKILL updates ×4 (`clinqet-ai-assistant`, and the knowledge/drafts skill), memory, PLAN register row, scratch cleanup.

---

## 5. Gates, decisions and provider copy

**Schema: none.**
- In memory: content fields, report fields, transcription list.
- Blob: `Artefact.Markdown`, `PageWide`/`ChangedValues` in the page-cache JSON.
- SSE: new metadata keys.
- AdminAlert metadata is a free-form dictionary.
- The CX-03 lookup reuses `FindByContentHashAsync`.

**MOCKUP GATE.** New "Setup Complete" rows are needed. Suggested sheet `C:\Nik\Data\mockups\ai-setup-reading-honesty\index.html`, web and phone, every state, plus a register row. The rows: saved prices kept; not added as services; prices not added because the reading did not finish or the pages could not be read; prices without a name; prices worth a look; part of the file could not be read; and the page read in part, which today is invisible. Until approval the server only fills metadata and the admin alert.

**Owner decisions:**
- **D1** — Run the offering judge in setup. Cost: one Luna call per ≤100 new priced services, roughly 10–30 s more. The alternative, a prompt rule only, is weaker.
- **D2** — Withhold prices that only one reading supports. That means pages that kept the machine reading, and the vision fallback during a Document Intelligence outage.
- **D3** — Continue an unfinished setup reading inside the request. This pays for pages that today fall back to the quicker reading.
- **D4** — Confirm that the 1→2 raise is the single shared one. BUILD-STATE records the owner's 2026-10-02 instruction to build all of it.
- **D5** — `ProviderSetupServiceWriter.cs:129` renames a live service to the extracted name even when the match was a semantic one (`McpService.cs:822-827`). Keep or stop?
- **D6** — Pin the `KnowledgeChunker` token predicates (or move them into a small pinned class).

**Copy (client keys).**
- Web: `AISetup.*` in `public/lang/{en-US,es-US,fr-CA,gu-IN,hi-IN}.json` (ICU plurals).
- Mobile: `AI_ASSISTANT_MODAL.SUMMARY_*` in `src/Locales/{en,es,fr,gu,hi}.json` (`_one`/`_other`).
- Only the English bodies are shown here; titles, the second variant and es/fr/gu/hi drafts are not included.

Saved prices kept:
- **en:** "{count, plural, one {# service kept the price you already had.} other {# services kept the prices you already had.}} Your file shows a different price, but we couldn't be sure we read it right. Open Services if you want to change it."

Not added as services:
- **en:** "{count, plural, one {# line in your file looks like a fee, a total or a condition, not something customers book, so we didn't add it:} other {# lines … so we didn't add them:}} If we got one wrong, add it yourself in Services."

Some prices weren't added:
- **en:** "We ran out of time reading your file closely, so we left {count, plural, one {# price} other {# prices}} for you to add. The pages we finished are saved — send the same file again and we'll carry on from where we stopped."

Prices without a name:
- **en:** "{count, plural, one {# price in your file had no service name beside it, so we didn't add it.} other {# prices … beside them, so we didn't add them.}} Add those services yourself in Services, or send the file again with each name next to its price."

Prices worth a look:
- **en:** "{count, plural, one {# price is} other {# prices are}} much higher than usual for your currency. We kept {count, plural, one {it} other {them}} exactly as your file shows — please check {count, plural, one {it's} other {they're}} right."

Two more rows reuse existing server-side text:
- Part of the file could not be read: mirrors the existing `Info_KnowledgeContentNotSaved` in all 5 languages.
- Page read in part: mirrors `Info_KnowledgePageTooLongToReadFully` / `PagesTooLongToReadFully`.

Drafts need no new keys; they use the existing `Info_KnowledgeDraftPricesToCheck`. The admin alert lines (English, allowed by §0.10) are listed per kind in the plan above, e.g. "{service}: the price {value} the reader gave is not printed beside this service in the file, so it was withheld; the provider must add it."

---

## 6. Other defects found

1. Setup passes no StopBy to the reading (`ProviderSetupDocumentReader.cs:287-300`) and no PageAngles (vs `KnowledgeIngestProcessorFunction.cs:1835`). Fixed in step 1.
2. The setup success Message is never rendered (§0.4).
3. `MapExtractionResponse` drops `Currency` (`DocumentIntelligenceService.cs:1313-1342`). Fixed in CS-05.
4. The bank-rules guard does not pin `KnowledgeFigures.cs`, which the comparer uses (`DocumentTranscriptComparer.cs:141,152,802`). Fixed in step 7.
5. The new reading-outcome alert types are deduped by content, not by their deterministic EventId (`AdminAlertProcessor.cs:206-219`). Fixed in CS-09.
6. `ReadingOutcomeItems` has no mapping for `ThirdNameUsed` (`:47-59`). Fixed in step 2.
7. Setup keys its page bank on the file name (`ProviderSetupDocumentReader.cs:291`), so the same bytes under another name buy every page again. P2: key it on the content hash.
8. `FlattenBlocks` writes headings without `#` (`:386-392`), so the chunked extraction's heading-first split (`DocumentIntelligenceService.cs:968`) never fires on setup text, contrary to its comment. Fix the comment, or prefix `#`.
9. The drafts rebuild buys Document Intelligence and checks without the ingest's bank or `VerificationsAlreadySpent` (`:421-426`, `:574-585`; AUDIT-2 F-23). Fixed in step 6.
10. The content artefact is keyed on the build (`KnowledgeIngestProcessorFunction.cs:118-128`) and banks a paid describe call. This is a §0.23 tension (AS-15) outside consumer scope.
11. `CatalogManifestService.cs:154-158` refuses the whole manifest over one price above 5M. The provider is told, but it is a hard limit; flag for the owner.

### Critical Files for Implementation
- C:\Nik\clinqetinfrastructure\Services\AI\McpService.cs
- C:\Nik\clinqetinfrastructure\Services\AI\ProviderSetupDocumentReader.cs
- C:\Nik\clinqetinfrastructure\Services\AI\TranscriptionDisputeIndex.cs (plus a new ProviderSetupServiceGate.cs and ReadingOutcomeReviews.cs beside it)
- C:\Nik\clinqetfuncations\Clinqet.Communications\Services\KnowledgeServiceDraftAnalyticsJob.cs
- C:\Nik\clinqetinfrastructure\Services\AI\DocumentTranscriptComparer.cs (with VisionDocumentTranscriptionService.cs for the rules-version step)
