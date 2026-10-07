# P4-H — TESTS: coverage by id, vacuous tests, placement (§0.18), cross-repo scans (§0.15/§0.17)

Closing audit of the AI Knowledge programme, dimension H. **Read-only**: no build, no test, no npm/jest/eslint, no git
write was run by me or by any helper. Code state = HEAD of each repo on 2026-09-25, all trees clean at read time:
`clinqetinfrastructure 89035c3` · `clinqetapi 2e47eca` · `clinqetfuncations 2f34b5a` · `clinqetmcp bd75618` ·
`clinqetcore b9cfe21` · `clinqetshared b3c821d` · `cosmosindexsetup beea0f0` · `clinqetwebpartnerapp 8f2ac5e7` ·
`clinqetmobilepartnerapp bd49c1c3`.

**Summary: 39 findings — 11 High, 15 Medium, 13 Low** (no Critical in the TEST dimension; where a test gap sits on a
Critical product defect another dimension found, the row says so). Twelve sabotage targets in §6.

Method: four read-only helper passes by id family (extraction ids; pipeline + drafts ids; retrieval + index ids;
web + mobile UI ids), plus my own passes over placement, cross-repo reads, skips, null-satisfiable assertions, and the
new post-programme code. ‼️ **Every High finding below was re-read by me at the cited lines.** A claim carried
without my own re-read is marked *(helper)*. Several findings overlap other dimensions' product defects; the overlap is
named (`= P4-x-nn`) and only the TEST angle is claimed here.

---

## 1. Scope actually read

| Area | Files | How |
|---|---|---|
| Inventory | 309 .NET test files mention Knowledge / TextScriptDetector / BusinessSearch / Vision / Transcript / MaterialInfo / QuestPdf (Communications unit 109 + integration 28; API unit 103 + integration 35; MCP unit 22 + integration 6; cosmosindexsetup 6); web knowledge tests 22 + `src\lib\knowledge` 3; mobile `__tests__\knowledge*` 35 + businessSearch 10 | grep inventory |
| Read in full by me | `KnowledgeIndexDefinitionTests.cs` (289), both `OcrPageCacheKeyTests.cs` (101 / 95), `KnowledgeIngestTimeoutParityConventionTests.cs` (71), `KnowledgeImageSettingsParityConventionTests.cs` (74), `ScriptThresholdsAgreeAcrossHostsTests.cs` (96), the three `KnowledgeReceptionistGateConventionTests.cs` (136 / 98 / 97), API `VoiceKnowledgeSettingsConventionTests.cs` (265), `KnowledgeNoticeSingularTests.cs` (115), `KnowledgeReadingNoticesTests.cs` (162), `KnowledgeQueryScopeGuardTests.cs` (66), `KnowledgeParseRoutingConventionTests.cs` (58), `KnowledgeDuplicateReasonKeyCatalogueTests.cs` (69), `MediaExtensionCoverageTests.cs` (135), `KnowledgeCjkFieldTests.cs` (149), `KnowledgeCapCountsCosmosIntegrationTests.cs` (118), `UnprovisionedSearchStampTests.cs` (127), `KnowledgeSearchFieldsTests.cs` (140, to :95), `PrivateCellsBindingTests.cs`, `PreserveLiveOnlyFieldsTests.cs` (to :80), `VectorCompressionProfileTests.cs` (71), `SearchAliasNameOwnershipTests.cs` (57), API `WorkspaceLayout.cs` | end to end |
| Read in part by me | `KnowledgeIngestProcessorFunctionTests.cs` (530-575, 2925-3024, 4930-4975, 5630-5760), `KnowledgeManagementServiceTests.cs` (100-170, 229-265, 285-465), `KnowledgeControllerTests.cs` (340-362, 560-630, 1205-1250), `KnowledgeServiceDraftAnalyticsJobTests.cs` (945-1000, 1825-1880), `KnowledgeDocumentParserTests.cs` (68-82, 155-232, 270-290, 590-612, test-name list 692-929), `KnowledgePictureTextTests.cs` (112-161), `KnowledgeChunkerTests.cs` (935-975), `KnowledgeServiceDraftBuilderTests.cs` (985-1010), `MaterialInfoPdfTests.cs` (186-250), `KnowledgeToolsTests.cs` (test-name list), `ProviderKnowledgeSearchServiceTests.cs` (115-150), `KnowledgeReceptionistGatesCosmosIntegrationTests.cs` (20-144), `BusinessSearchReplayParityIntegrationTests.cs` (120-150), `KnowledgeAdminReindexTests.cs` (275-310), `DocumentIntelligenceServiceTests.cs` (540-575); web `KnowledgePage.jsx` (227-272, 355-400, 519, 585-665, 1300-1318, 1845-1880), `knowledgeGuards.test.js` (60-110, 160-180, 655-673, 725-770), `knowledgeDownload.test.js` (70-100), `knowledgeMeta.js` (135-160), `receptionistAccess.js` (80-96), `askRules.js` (25-50); mobile `index.tsx` (940-1010, 1092-1104, 1660-1700, 1985-1996, 2185-2225), `knowledgeSearchAudienceParity.test.ts` (1-40, 110-126), `knowledgeRerunAll.test.ts` (70-90), `knowledgeNudgePlacement.test.ts` (95-140), `receptionistAccess.ts` (94-104), `askRules.ts` (104-114) | the sites each finding cites |
| Production code read for verification | `KnowledgeController.cs` (180-220, 470-505, 545-575, 925-975, 1066-1113), `KnowledgeReadingNotices.cs` (whole), `KnowledgeSpaceReservation.cs` (whole), `KnowledgeManagementService.cs` (600-720 + the 69e3d44 diff), `KnowledgeIngestProcessorFunction.cs` (930-940, 1164-1185, 2220-2236, 2575-2590, 2880-2912, 3300-3400, 3440-3610), `KnowledgeSearchIndexer.cs` (85-174), `ProviderKnowledgeSearchService.cs` (150-290, 560-790, 1015-1025), `KnowledgeChunker.cs` (420-530, 1465-1480), `KnowledgeDocumentParser.cs` (443-455, 615-650, 715-770, 915-965, 1163-1177, 1268-1274, 1500-1530, 1830-1850), `KnowledgeImageFingerprint.cs` (whole), `KnowledgeBlobPaths.cs` (145-170), `VisionDocumentTranscriptionService.cs` (136-150), `BusinessSearchDocumentService.cs` (60-72, 230-242), `KnowledgeSearchVisibility.cs` (55-92), `KnowledgeDocumentRepository.cs` (105-190), `DocumentIntelligenceService.cs` (170-220, 1267-1330), `AICompletionService.cs` (380-395), `KnowledgeTools.cs` (60-176), `QuestPdfService.cs` (244-252), `TranscriptionDisputeIndex.cs` (60-112), `KnowledgeServiceDraftBuilder.cs` (28-117, 170-178), `KnowledgeSearchDocument.cs` (attributes) | re-read |
| Helper passes (read in full / by range, their scope lists in their notes) | the 5,880-line ingest test file, `KnowledgeExtractionFidelityTests` (2,895), parser/chunker/sheet/picture/grounding/placement suites, `DocumentTranscriptionAdjudicationTests`, drafts job/builder/detector/judge suites, approval/management/controller suites, the MCP retrieval suites, `TextScriptDetectorTests`, Business Search tool/replay suites, and every web/mobile knowledge test | *(helper)* where carried unverified |

Not read at all: `KnowledgeImageNormalizerTests`, `KnowledgeImageExtractorTests`, `VisionDocumentTranscriptionServiceTests` beyond the ranges the helpers cite, `DocumentTranscriptComparerTests`.

---

## 2. Findings

Severity = the brief's scale applied to TESTS: a missing or vacuous guard on a money / data-loss / tenancy /
status-truth / multilingual-retrieval rule is **High** when a one-line regression would ship silently; other coverage
holes **Medium**; tautologies, stale names and comments **Low**.

| id | Sev | Title | Where (file:line) | Violates | Conf. |
|---|---|---|---|---|---|
| P4-H-01 | High | The table-hunt harness — the only guard for ~22 extraction fixes — is gone; nothing replaced it | `C:\Nik\knowledge-table-hunt` absent; `phase-1\AUDIT.md:25-46` | owner ruling 1, §0.8 | High |
| P4-H-02 | High | C11's fix is unreachable; its test feeds a state production never creates | `KnowledgeIngestProcessorFunction.cs:2227, 2231, 2582-2583` vs `:2896-2903`; test `KnowledgePictureTextTests.cs:121-140` | C11, owner ruling 1 | High |
| P4-H-03 | High | A1's coalescing probably cannot fire on the PDF / image / `.md` lane (trailing `\n`) | `KnowledgeDocumentParser.cs:630, 447, 768, 958-960` | A1/L-4, owner ruling 1 | Medium (probe) |
| P4-H-04 | High | C7/EX-12 reuse tests use solid-colour pictures whose fingerprint is always 0 | `KnowledgeImageFingerprint.cs:36-57`; `KnowledgePdfFixture.cs:57-63`; `…FunctionTests.cs:2966-2996` | C7, EX-12 | High (tests) / NEEDS-LIVE-PROOF (product) |
| P4-H-05 | High | L-9's per-currency review ceiling is proven only on a currency the strict schema forbids | `DocumentIntelligenceService.cs:176-215, 1322-1324`; `AICompletionService.cs:389`; `DocumentIntelligenceServiceTests.cs:551-575` | L-9 ruling | High |
| P4-H-06 | High | R-10's WRITE (close the mixture window) has no test in any suite | `KnowledgeIngestProcessorFunction.cs:1176` | R-10 | High |
| P4-H-07 | High | The server-side reading-notice sentence (E7/R-9 read path, plural fix) has no test | `KnowledgeController.cs:1083-1113` | E7/R-9, plural fix | High |
| P4-H-08 | High | The phone's 14 per-language `search_knowledge` fields and their script check are untested | `KnowledgeTools.cs:89-102, 121-135, 167-176` | F1 | High |
| P4-H-09 | High | X-01's "written by AI" chip has no test in either app | web `askRules.js:39-43`, `SourceCard.jsx:237-242`; mobile `askRules.ts:108-112`, `SourceCard.tsx:187-189` | X-01 | High |
| P4-H-10 | High | U-14 (never widen a permission silently) is pinned only by source strings | web `receptionistAccess.js:90-95`; mobile `receptionistAccess.ts:94-102` | U-14 | High |
| P4-H-11 | High | Web narrow screens: a Stopped row has no Read again — and a test pins the suppression | `KnowledgePage.jsx:379-381, 596-599, 623-630, 651-653`; `knowledgeMeta.js:151`; `knowledgeGuards.test.js:169-174` | U-04, gotcha 16 | High |
| P4-H-12 | Medium | `ReadingAgainWouldHelp` pinned only on its negative side, and in the wrong host | `KnowledgeReadingNotices.cs:115-116`; `KnowledgeReadingNoticesTests.cs:157-160`; `…FunctionTests.cs:5647-5655` | owner rule 3, §0.18 | High |
| P4-H-13 | Medium | "A foreign row discards the WHOLE answer" is unpinned for multi-leg searches | `ProviderKnowledgeSearchService.cs:584-588, 596-602, 186-190`; test `ProviderKnowledgeSearchServiceTests.cs:136-149` | D22 layer 4 | High |
| P4-H-14 | Medium | The tenant-scope guard accepts `businessId eq 'X' or …`; only the `or`-first form is tested | `ProviderKnowledgeSearchService.cs:1015-1016`; `KnowledgeQueryScopeGuardTests.cs:33-39` | phase-3 D-2 | High |
| P4-H-15 | Medium | 13 `Assert.NotEqual(true, …)` remain in the index-definition tests after A-2 | `KnowledgeIndexDefinitionTests.cs:40, 51, 173-174, 177, 181, 236, 248, 281-285` | A-2 lesson, imageRef §0.7 | High |
| P4-H-16 | Medium | The material PDF's RTL layout call is unpinned; the "IsLaidOutRightToLeft" tests check fonts/predicate | `QuestPdfService.cs:249`; `MaterialInfoPdfTests.cs:219-249, 213` | F9, owner ruling 0 (Hebrew RTL) | High |
| P4-H-17 | Medium | E-17's tests predate its fix; a revert to substring matching passes them | `TranscriptionDisputeIndex.cs:60-111`; `TranscriptionDisputeIndexTests.cs` (last change `4d3a9ca`) | E-17 | High |
| P4-H-18 | Medium | L-10/R-14's server half (`JudgeRemovedCount` write + serve) has no .NET test | `KnowledgeServiceDraftAnalyticsJob.cs:1008`; `KnowledgeController.cs:1261` | L-10, R-14 | High |
| P4-H-19 | Medium | E3's test captures `sentWith` from `default` and never verifies the send | `KnowledgeManagementServiceTests.cs:361-383` | E3 | High |
| P4-H-20 | Medium | The real retrieval SDK paths never run in a test (MCP blank endpoint; Business Search `EmbeddingService: null`) | `ClinqetMcpFactory.cs:86-94`; `KnowledgeSearchFieldsTests.cs:125`, `KnowledgeAudienceReadCancellationTests.cs:105` | G-14, §0.8 | High |
| P4-H-21 | Medium | The approved Cosmos field `AiTurnCitation.channel` has no real-engine round trip | `BusinessSearchReplayParityIntegrationTests.cs:130-149` | X-01, §0.8 (schema ⇒ integration test) | High |
| P4-H-22 | Medium | U-08 was built on the wrong dialog; the tests pin the wrong dialog (= P4-D-05) | `KnowledgePage.jsx:1848-1878`; `en-US.json:6093-6100, 6702`; `KnowledgeDraftApprovalService.cs:1111` | U-08 | High |
| P4-H-23 | Medium | Mobile U-05 not built; no test on either app | `MS index.tsx:955-957, 968-1002, 1100, 1992` | U-05/U-06 | High |
| P4-H-24 | Medium | Reading-notice write controls shown to read-only members; the guard cannot see them | `KnowledgePage.jsx:658-663, 248-270`; `MS index.tsx:1681-1691`; `knowledgeGuards.test.js:80-82` | TD-37.3 permission rule | High |
| P4-H-25 | Medium | The knowledge-limit feature (owner-scoped out) shipped with no tests and one orphan-pinning test (= P4-C-02/03/04) | `KnowledgeSpaceReservation.cs`; `KnowledgeManagementService.cs:456-462, 654-672, 697-705`; `LocalizationSourceConventionTests.cs:148-182`; `KnowledgeController.cs:491-501` | §0.8 | High |
| P4-H-26 | Medium | Tests that pin a defect an owner decision changed | see detail | brief check 3 | High / helper |
| P4-H-27 | Low | Stale, partly tautological OCR page-key test class | `Services\BusinessSearch\OcrPageCacheKeyTests.cs:18-46` | — | High |
| P4-H-28 | Low | Tests of the test double; a test named for the opposite of its assertion | `UnprovisionedSearchStampTests.cs:40-48, 69-88, 111-124` | — | High |
| P4-H-29 | Low | A concurrency bound proven by an observed peak behind sleeps | `KnowledgeServiceDraftAnalyticsJobTests.cs:1832-1855` | memory flaky-tests-gate-not-clock Rule 2 | High |
| P4-H-30 | Low | Wall-clock races in knowledge tests | `…FunctionTests.cs:5711-5731, 5744, 5758`; VDTS tests *(helper)* | memory rule 1 | High / helper |
| P4-H-31 | Low | The receptionist-word convention exempts whole files | `KnowledgeReceptionistGateConventionTests.cs:30-36, 86-90, 101-102` (API) | — | High |
| P4-H-32 | Low | "Document cap" framing survives the cap's removal | `KnowledgeCapCountsCosmosIntegrationTests.cs:11-22, 67, 71-72, 103-104`; `KnowledgeManagementServiceTests.cs:114-129` | — | High |
| P4-H-33 | Low | The API test helper recommends the CI checkout §0.15 rejected | `Clinqet.API.UnitTests\Conventions\WorkspaceLayout.cs:78-81` | §0.15 | High |
| P4-H-34 | Low | Web/mobile source-contract vacuity (lost slice markers, first-letter regex, tautology, dead rule) | see detail | — | High |
| P4-H-35 | Low | Web pins a second status voice on Ready rows | `knowledgeGuards.test.js:663-667`; `KnowledgePage.jsx:519` | "one status voice per row" | Medium |
| P4-H-36 | Low | X-06's test probably closes before the page change it names | `KnowledgeChunkerTests.cs:945-957` | X-06 | UNCERTAIN |
| P4-H-37 | Low | A knowledge test disabled by omission (no `[Fact]`) since 2026-09-04 | `KnowledgeIngestProcessorFunctionTests.cs:4942` | §0.3 (never skip a test to go green) | High |
| P4-H-38 | Low | Inert or empty-able assertions | `KnowledgeServiceDraftBuilderTests.cs:998`; `KnowledgeSearchIndexerIsolationTests.cs:193-201`; others | — | High / helper |
| P4-H-39 | Low | Stale comments met while tracing tests | `KnowledgeDocumentParser.cs:1515-1516`; `KnowledgeIngestProcessorFunction.cs:3330-3331`; `MaterialInfoPdfTests.cs:194-196` | §0.14 | High |

### P4-H-01 — HIGH — The only regression guard for ~22 extraction fixes was the table-hunt harness, and it is gone
- **Evidence:** `ls /c/Nik/knowledge-table-hunt` → *No such file or directory*. It was deleted 2026-09-22 with owner
  approval as *"It was rot, not a gap"* (memory `timeprovider-governor-wallclock-2026-09-22.md:83-90`, a different
  programme's session); its cases were never ported. `phase-1\AUDIT.md:25-46` proves A1 ("T harness R7 group (10) +
  ADV01/02/03"), A3 ("T harness ADV08 + ADV13"), A4 ("T harness A03/A04/B14"), A5 ("T harness C3 …, ADV06 (refuse) vs
  ADV07"), A6, A9, A21, A22 with harness cases; its sabotages S-9 (`IsLoneCurrencyMark`) and S-10 (the all-lowercase
  refusal) were caught only by ADV01/ADV13 (`AUDIT.md:159-160`). Grep of every test in every repo for `ADV\d\d`: one
  comment (`KnowledgeServiceDraftAnalyticsJobTests.cs:1593`). Two further cited proofs never existed: `AUDIT.md:37`
  "`KnowledgeDocumentParserTests` hidden-content cases" (A13 — no HTML fixture anywhere carries `hidden`,
  `aria-hidden` or `display:none`; the PT HTML cases :692-793 and :914 are furniture/tables/images) and `:41`
  "VML + linked-picture cases" (A17) *(helper: `git log -S` shows none ever existed)*.
- **Now unguarded** (§3): A1/L-4, A3, ADV13, ADV01, A4, A5/A5-L/L-3 (refusal direction), A6/R-1, A7/L-7, A8, A9, A10,
  A12, A13, A14, A17, A22, C4, C6, C8, C9, X-03, X-04; partial: A11, A19, A21, B1, B3, C5, C7, X-06.
- **The memory's "rot, not a gap" is false for coverage.** The rot was in the harness's plumbing; its ASSERTIONS were
  the only proof of shipped behaviour.
- **Scenario:** revert `KnowledgeDocumentParser.cs:1211` to `HasHeaderRow = rows.Count > 1` — a page-2 fragment whose row
  0 is `| Straightening | $200 | 150 min |` becomes labels again (the owner's own "table cut between two pages") — every
  suite green (S-09).
- **Fix:** port the harness's A/F/ADV/C cases (inputs survive in `phase-1\baseline\table-hunt-*.txt` and
  `Data\knowledge-extraction-audit\archive-table-hunt-2026-08-18\`) into `Clinqet.Communications.UnitTests\Knowledge`
  (the ingest host, §0.18). **Same root as P4-A-24; this row adds the image/verifier/JSON ids.**

### P4-H-02 — HIGH — C11's fix is unreachable in production, and its test certifies an input the lane never produces
- **Evidence:** the alt-text branch `KnowledgeIngestProcessorFunction.cs:2896-2903` —
  `if (authored == null || imageRefByIndex?.GetValueOrDefault(chunk.ImageIndex) == null) continue;` — but refs exist only
  for captioned pictures: fresh lane `:2227` `var imageRef = string.IsNullOrWhiteSpace(caption) ? null : KnowledgeImageRef.Format(row.DocId, entry.ImageId);`
  and `:2231` `if (imageRef != null) result.RefByIndex[index] = imageRef;`; replay `:2582-2583`
  `if (!string.IsNullOrWhiteSpace(caption)) result.RefByIndex[pointer.Index] = …`; `BuildCards` receives exactly that
  map (`:935-936`). The test `KnowledgePictureTextTests.cs:121-140` passes `captions = new Dictionary<int, string>()` and
  `imageRefByIndex = { [0] = "doc1:7:abcd1234" }`.
- **Scenario:** a catalogue photo with alt text "CAT 340 excavator, left side" whose description fails → no card; the
  only name the picture has is lost — C11 unchanged. **= P4-B-07.** Fix: gate on "the lane stored this picture", and
  test at the ingest level (image lane → cards) with a failed caption.

### P4-H-03 — HIGH (UNCERTAIN, one probe settles it) — A1's coalescing can probably never fire on the layout-markdown lane
- **Evidence:** `KnowledgeDocumentParser.cs:630` `paragraph.Append(rawLine).Append('\n');` is flushed untrimmed (`:447`
  `AppendParagraphOrList(blocks, paragraph.ToString(), paragraphPage, markdown: true)`) into `:768`
  `Text = Clean(raw)`; `Clean` (`:744`) = `StripMarkdownEmphasis`/`StripInlineHtml` (`:1163-1177`, `:1268-1274`),
  neither trims. The rule then demands no newline at all: `:958-960` `… text.IndexOf('\n') < 0 …`. Tests cannot see it:
  layout assertions `.Trim()` the block (`KnowledgeDocumentParserTests.cs:167`) and no test exercises coalescing on any
  lane (P4-H-01).
- **Why it matters:** L-4 was live-proven on PDF and image (`FINDINGS` §8.1 rows 7, 10).
- **Probe:** `ParseLayoutMarkdown("Haircut $25\n\nBeard trim $15\n\nKids cut $18\n")` → 3 paragraph blocks = defect; one
  three-line block = fixed. Owner ruling 1 ⇒ High if confirmed.

### P4-H-04 — HIGH — C7/EX-12 reuse is tested only with pictures whose fingerprint is always 0
- **Evidence:** `KnowledgeImageFingerprint.cs:36-57` — `Image.Load<L8>` (GREYSCALE), resized 9×8, a bit per "brighter
  than its right-hand neighbour". A solid picture has no gradient ⇒ 0. Every ingest fixture picture is solid:
  `KnowledgePdfFixture.cs:57-63` `SolidJpeg(width, height, r, g, b)` via `…FunctionTests.cs:2874` `Photo(...)`.
  `LookAlikePictures_UnderTheSameWords_PayForOneDescription` (`:2966-2978`, two solid reds) and
  `…UnderDIFFERENTWords…` (`:2984-2996`) therefore pass with a CONSTANT fingerprint (S-12).
- **Product half (NEEDS-LIVE-PROOF):** the class says *"a false match costs the truth"* (`:18-21`), yet two photos that
  differ only in colour (a white tile, a black tile) under the same neighbouring words share one description, which is
  read to a caller. Probe: two same-texture JPEGs in different colours, same `ImageNeighbourText` → 1 vision call =
  defect. Fix: colour in the key (per-channel hash or a coarse hue signature) + textured, colour-varying fixtures.

### P4-H-05 — HIGH — L-9's per-currency review ceiling is proven only on a currency field the strict schema forbids
- **Evidence:** the extractor's JSON schema `DocumentIntelligenceService.cs:176-215` has no `currency` property and sets
  `additionalProperties = false`; the call is `Strict = true` json_schema (`AICompletionService.cs:385-390`). So in
  production `s.Currency` is always null, and `BeyondReviewCeiling(s.Price, maxAllowedPrice, s.Currency)` (`:1322-1324`)
  → `PriceReviewCeiling.For(maxAllowedPrice, null)` — the flat ceiling. The tests inject it anyway:
  `DocumentIntelligenceServiceTests.cs:551-575` mock the model answer `…"price":500000,"currency":"INR"…` and
  `…"price":10500000,"currency":"INR"…`. The C11 pattern again: a test certifying an unreachable input.
- **Probe (not a sabotage):** delete `,""currency"":""INR""` from the two fixtures → both tests fail, proving the
  shipped path is currency-blind. **= P4-D-10** (product: the admin threshold is also unread).

### P4-H-06 — HIGH — R-10's WRITE has no test; deleting it re-opens the mixture window silently
- **Evidence:** `KnowledgeIngestProcessorFunction.cs:1172-1176` — *"From here they are overwritten ordinal by ordinal …
  must answer nobody"* — `await CommitAsync(businessId, docId, r => r.CardsRewriting = true, ct);` then
  `UpsertCardsAsync`/`PruneCardsAtOrAboveAsync` (`:1178-1180`). The rule treats a Processing row with previous cards as
  answerable unless the flag is `true` (`KnowledgeSearchVisibility.cs:84-86`). Grep of `C:\Nik\clinqetfuncations` for
  `CardsRewriting`: production only (`:1176`, `:3238`, `:3256`, `VoicePostCallProcessorFunction.cs:2227`) — **zero test
  hits in either Functions suite.** The READ side is pinned (MCP `KnowledgeCardsRewritingTests`, API
  `KnowledgeDocumentCasIntegrationTests.cs:114-170`); phase-3 knowingly accepted the unpinned CLEAR (a stranded flag =
  old behaviour) — the WRITE was never discussed.
- **Scenario:** line 1176 deleted (or moved after `:1178`) → during every re-read's card write a caller is answered from
  a mixture of the old and new versions (the old price on one card, the new on the next) — green everywhere (S-03).

### P4-H-07 — HIGH — The server-side reading-notice sentence has no test
- **Evidence:** `KnowledgeController.cs:1083-1113` `ResolveReadingNotice` is the only place a stored notice becomes the
  sentence both apps render: `:1093` `KeyFor(notice.Key, notice.Args)`, `:1095-1097` `string.Format(template, args…)`,
  `:1104-1108` the "several things" heading, `:1111` `ReadingAgainWouldHelp`. Grep of `clinqetapi` for `ReadingNotice`:
  `KnowledgeController.cs`, `KnowledgeNoticeSingularTests.cs` (calls the static `KeyFor` directly) and
  `KnowledgeManagementServiceTests.cs:232-265` (dismiss only). No controller or integration test.
- **Scenario:** `:1093` → `notice.Key` brings back *"We left 1 sentences out…"* (found by walking the live screen in
  phase 3); dropping `:1095-1097`'s `string.Format` puts a literal `{0}` on the provider's screen (the E4 class). Green (S-01).

### P4-H-08 — HIGH — The phone's multilingual input mapping (F1) is untested at the tool layer
- **Evidence:** `KnowledgeTools.cs:89-102` (14 `queryIn*` parameters), `:121-135` (each field labelled with its script),
  `:167-176` `AddRendering` — `if (!string.Equals(script, TextScriptDetector.Latin, …) && !TextScriptDetector.ContainsScript(trimmed, script)) return;`.
  Grep for `queryIn[A-Z]` in `Clinqet.Mcp.UnitTests` and `Clinqet.Mcp.IntegrationTests`: **zero**. `KnowledgeToolsTests`'
  `SearchKnowledge_*` cases pass only `query` (+ `linkedServiceId`). The multilingual SERVICE tests build `Renderings`
  directly. Also unpinned *(helper)*: `askingWhatTheBusinessHas → IsBrowseQuestion` (`:146`), the per-call prompt that
  names the business's alphabets (`RealtimeSessionPayloadBuilder.cs:498-504`), `KnowledgeLanguages`.
- **Scenario:** a slip at `:123` labelling the Gujarati field `Devanagari` makes `AddRendering` refuse every Gujarati
  rendering (no Devanagari character) — Gujarati callers searched in English only, the exact F1 defect — green (S-07).

### P4-H-09 — HIGH — X-01's chip has no test in either app
- **Evidence:** web `src\lib\businessSearch\askRules.js:39-43` + `src\components\businessSearch\SourceCard.jsx:237-242`;
  mobile `src\lib\businessSearch\askRules.ts:108-112` + `src\components\businessSearch\SourceCard.tsx:187-189`. Grep of all
  `*.test.*` in both repos for `aiWritten`, `SOURCE_CHANNEL`, `picture-description`, `generated-overview`: **zero**. The
  server half is pinned (API `BusinessSearchReplayParityTests`, phase-3 S8).
- **Scenario:** `aiWrittenLabelKey` returns null (or the channel string drifts) → a photo's AI description is shown as the
  document's own words beside a source — green (S-05).

### P4-H-10 — HIGH — U-14 is pinned only by source strings; the sending-off branch never executes in a test
- **Evidence:** web `src\lib\knowledge\receptionistAccess.js:90-95`, mobile `src\lib\knowledge\receptionistAccess.ts:94-102`
  — `receptionistUploadDefault = (seed, materialSharingEnabled = true) => … materialSharingEnabled === true ? AnswersAndSends : AnswersOnly`.
  No test passes `false`. The library tests assert only the default (`receptionistAccess.test.js:110`
  `expect(receptionistUploadDefault(null)).toBe("AnswersAndSends")`; mobile `knowledgeReceptionistAccess.test.ts:110` the
  same); call sites are string matches (`knowledgeReceptionistAccess.test.jsx:265`; mobile
  `knowledgeReceptionistScreen.test.ts:171-178`).
- **Scenario:** the ternary collapses to `AnswersAndSends` → with sending off, every new file is stored sendable and, the
  day sending is switched on, a stranger who phones can be sent it (the harm the code's own comment `:82-88` names). Green (S-04).

### P4-H-11 — HIGH — Web narrow screens: a Stopped row offers no Read again, and a test pins the suppression
- **Evidence:** `KnowledgePage.jsx:379-381` — Read again enters `menuItems` only `rowActions.tryAgain.available && rowActions.inline === "replace"`;
  `knowledgeMeta.js:151` `inline: stopped ? "tryAgain" : "replace"`; the inline Read again exists only inside
  `hidden sm:flex` (`:593-599`); `sm:hidden` renders `items={menuItems}` (`:623-630`); the Stopped notice drops its own
  button `action={canManage && rowActions.inline !== "tryAgain" ? … : null}` (`:651-653`). `knowledgeGuards.test.js:169-174`
  asserts that string, believing *"a stopped row's inline slot is already 'Read again'"* — true on the wide layout only.
- **Scenario:** a provider on a phone-width browser sees the Stopped pill and sentence and can only Delete — U-04's
  defect, reintroduced by gotcha 16's "two renderers, one list". Fix: always put `tryAgain` in `menuItems` and let the
  desktop filter drop the inline one; add a two-branch render test.

### P4-H-12 — MEDIUM — `ReadingAgainWouldHelp`: negative-only tests, in the wrong host
- `KnowledgeReadingNotices.cs:115-116` `=> keys.Any(key => key is RanOutOfTime or PagesUnread);` (comment `:107-114`:
  offering it for `PagesNotRendered` "would be a lie"). Tests: `KnowledgeReadingNoticesTests.cs:157-160`,
  `KnowledgeIngestProcessorFunctionTests.cs:5647-5655` — all `Assert.False` for keys the rule does not name. `=> false`
  and `… or PagesNotRendered` both pass (S-02). Only runtime caller: the API (`KnowledgeController.cs:1111`); the three
  cases were ADDED to the Functions suite (`db119a3`, `8d0886a`, `a01e5ab`, 2026-09-13/14) — §0.18 PL-1. (The product
  side — "ran out of time" wired to `VisionDegraded` — is P4-B / P4-C.)

### P4-H-13 — MEDIUM — Tenancy: "a foreign row discards the WHOLE answer" is unpinned for a multi-leg search
- `ProviderKnowledgeSearchService.cs:584-588` `catch (CatalogIsolationException) { // A foreign row discards the WHOLE answer, never just this leg. throw; }`.
  The only test (`ProviderKnowledgeSearchServiceTests.cs:136-149`) has ONE leg: delete the rethrow and the leg fails soft
  (`:596-602`) → `succeeded == 0` → the same `Unavailable()` (`:186-190`) with the same "never guess" note; the alarm
  was raised at detection (`:763`). No multilingual test seeds a foreign row. Medium, not High: the foreign card itself
  is never returned (it throws before `passages.Add`, `:758-765`). (S-06)

### P4-H-14 — MEDIUM — The tenant-scope guard accepts a scope followed by `or`
- `ProviderKnowledgeSearchService.cs:1015-1016` `IsScopedTo => filter != null && filter.StartsWith($"businessId eq '{EscapeOData(businessId)}'", …)`.
  So `businessId eq 'MEE3IC' or businessId eq 'OTHER1'` is ACCEPTED, though the test class's own comment says *"an `or`
  makes the tenant clause optional"* (`KnowledgeQueryScopeGuardTests.cs:30-32`); only the `or`-FIRST forms are tested
  (`:34`, `:36`). The guard "exists for the filter nobody has written yet" (`:8-9`), and that is exactly the filter it
  would wave through. Row-level verification still fails closed, hence Medium. Fix: require end-of-string or ` and (…)`
  after the scope (wrap every appended remainder in parentheses) and test `X or …`.

### P4-H-15 — MEDIUM — `KnowledgeIndexDefinitionTests` still asserts "must NOT be X" with `Assert.NotEqual(true, …)`
- `C:\Nik\cosmosindexsetup\ClinqetCosmosAIIndexSetup.UnitTests\KnowledgeIndexDefinitionTests.cs:173-174` (`updatedAt`
  filterable/sortable), `:177`, `:181`, `:236` (facetable), `:281-284` (`imageRef` searchable/filterable/sortable/facetable),
  plus `:40`, `:51`, `:248`, `:285` (`IsHidden` — null is harmless there for non-vector fields). The 2026-09-16 A-2 fix
  changed only the vector (`:156-159` — *"EXPLICITLY true / false … null hands the decision to the service"*) and left the
  pattern that `0d547a2` (2026-09-15) introduced. FieldBuilder writes explicit booleans for the current attributes
  (`KnowledgeSearchDocument.cs:16-147`), so these are `false` today; a removed attribute or builder change yielding null
  would pass. Most exposed: `imageRef` — *"§0.7 approved … RETRIEVABLE ONLY"* (`:272-274`). Whether the REST default
  for an omitted filterable/sortable/facetable is `true` is UNCERTAIN here; the file's own stated rule does not depend on
  it. Fix: `Assert.False(x)`.

### P4-H-16 — MEDIUM — The material PDF's right-to-left LAYOUT is unpinned
- The call `QuestPdfService.cs:249` `if (IsRightToLeft(excerpt)) page.ContentFromRightToLeft();` can be deleted with every
  test green: `MaterialInfoPdfTests.cs:219-233` `AnArabicScriptExcerpt_IsLaidOutRightToLeft` asserts only that
  `NotoSansArabic` is embedded; `:243-249` `AHebrewExcerpt_IsLaidOutRightToLeft` asserts only the predicate. The owner's
  2026-09-16 point was that Hebrew glyphs WITHOUT direction are "worse … a page laid out BACKWARDS" (PLAN ruling 0).
  Also `ExpectedFamilySuffix`'s catch-all `_ => "NotoSans"` (`:213`) lets any future detector script pass the "every
  script has a font" guard. Label pinned, arithmetic not (S-08).

### P4-H-17 — MEDIUM — E-17's tests predate its fix
- The fix (`73e3dfb`, 2026-09-13) made the dispute match whole-token and one-word names non-distinctive
  (`TranscriptionDisputeIndex.cs:66-111`); `TranscriptionDisputeIndexTests.cs` was last changed in `4d3a9ca`
  (2026-09-10). Its cases (`:21, 43, 49, 54, 65, 76, 85, 101`) contain no one-word name in a Location and no
  plural/compound collision. *(helper: a full revert to substring passes every case.)* Harm on revert: a price is withheld
  from every unrelated row whose one-word name appears in a dispute location, each firing its own alert.

### P4-H-18 — MEDIUM — L-10/R-14's server half is untested
- Written `KnowledgeServiceDraftAnalyticsJob.cs:1008` (`JudgeRemovedCount = judgeRemoved`), served
  `KnowledgeController.cs:1261`; grep of the Functions and API test projects for `JudgeRemoved`: zero. Only the web
  client's rendering of a DTO that carries it is tested (`knowledgeDraftMeta.test.js`, `knowledgeNoSuggestions.test.js`).
  A provider told nothing about why a file produced no suggestions is the L-10 harm.

### P4-H-19 — MEDIUM — E3's test can pass without any send
- `KnowledgeManagementServiceTests.cs:361-383`: `CancellationToken sentWith = default;` is filled only by the send's
  Callback, then `Assert.False(sentWith.IsCancellationRequested, …)` — a `default` token satisfies it, and there is no
  `Verify` that the send happened. A regression that returns early on the cancelled request token without sending passes.
  Assert `Assert.Single(_sent)`/`Verify(Times.Once)` first.

### P4-H-20 — MEDIUM — The real retrieval SDK paths never run in a test
- MCP integration: `ClinqetMcpFactory.cs:86-94` sets `Search:Topology:Services:Private:Endpoint` to `""` — *"both private
  clients are null, so catalog lookups answer Unavailable"* — so voice retrieval is only ever exercised on its degrade
  path in the integration suite. API Business Search unit tests pass `EmbeddingService: null`
  (`KnowledgeSearchFieldsTests.cs:125`, `KnowledgeAudienceReadCancellationTests.cs:105`; *(helper)*: every provider-path
  test), so the provider path's vector branch (`ProviderKnowledgeSearchService.Provider.cs:211-226`) is never built in a
  test — G-14 (vector k = window) is NOT-PINNED on both surfaces *(helper)*.

### P4-H-21 — MEDIUM — `AiTurnCitation.channel` (an owner-approved Cosmos field) has no real-engine round trip
- The Cosmos round-trip test `BusinessSearchReplayParityIntegrationTests.cs:130-149`
  (`EverySourceFieldTheCardDrawsComesBack`) seeds a citation without `Channel` and asserts every other field; grep of
  the file for `channel`: zero. Unit mapping is pinned (`BusinessSearchReplayParityTests`), but §0.8 makes integration
  tests mandatory for a schema change.

### P4-H-22 — MEDIUM — U-08 fixed on the wrong dialog (= P4-D-05)
- U-08 named the analytics "Run again" confirmation (`evidence\agent-U-provider-ui.md:272-283`, citing
  `knowledge.drafts.rerun.confirmBody`). Today that dialog (`KnowledgePage.jsx:1848-1878`; `en-US.json:6094`
  *"We'll read this document again and rebuild its list of suggested services…"*, `:6099-6100`, `:6702`) still says
  nothing about edited pending suggestions, while `KnowledgeDraftApprovalService.cs:1111`
  `DeleteExceptApprovedForDocumentAsync` deletes them. The warning was built on "Read again" instead
  (`PROGRESS-SESSION2.md` §25); tests `knowledgeGuards.test.js:771-804` and mobile `knowledgeRereadConfirm.test.tsx:51-84`
  pin that dialog only.

### P4-H-23 — MEDIUM — Mobile U-05 not built, and no test covers U-05 on either app
- `MS index.tsx:955-957` `throw new Error(slot?.errorMessage || 'no-upload-slot');` inside `Promise.allSettled`; the
  rejection reasons are never read (`:968-1002`); the failed row prints `t('KNOWLEDGE.FILE_UPLOAD_FAILED')` (`:1992`); a
  failed replace toasts the same (`:1100`); a refused confirm is swallowed (`:998-1000`). Phase 3 claimed U-05/U-06 on
  web AND phone. (MS = `C:\Nik\clinqetmobilepartnerapp\src\Screen\ProfileFlow\Knowledge\`.)

### P4-H-24 — MEDIUM — Reading-notice write controls reach read-only members; the permission guard cannot see them
- Web `KnowledgePage.jsx:658-663` renders `<ReadingNotice … onDismiss=… onReadAgain=… />` outside `canManage`; the
  component draws the dismiss ✕ unconditionally and Read again on `canReadAgain` (`:248-270`). Mobile gates Read again
  (`MS index.tsx:1670`) but not dismiss (`:1681-1691`). Both endpoints require `voice.settings.manage`
  (`KnowledgeController.cs:478`, `:557`). `knowledgeGuards.test.js:80-82` checks only `action={…}` props.

### P4-H-25 — MEDIUM (feature owner-scoped out; test debt only) — the knowledge-limit feature shipped without tests
- Context: the lead's notes record the owner ruling that the knowledge-limit feature belongs to "the other employee who
  developed this". Not re-raised as a feature gap (= P4-C-02/03/04); recorded as that owner's test debt.
- `KnowledgeSpaceReservation.cs` (`69e3d44`): no test references `EstimateNewFile`, `ReplaceNetNewParts`,
  `ExpectedNewParts`, `Reserved` or `GroupOf` (grep, all repos); its only consumer `GetSpaceBudgetAsync`
  (`KnowledgeManagementService.cs:654-672`) has no caller.
- `HasNoSpaceToReadAsync` (`:456-462`, `return used - own >= max;`): untested — the fixture's `CountCardsAsync` answers 0,
  so the gate short-circuits.
- API `EffectiveMaxPassages` (`:697-705`): no API test sets `KnowledgeMaxPassages`; only the Functions twin
  (`KnowledgeIngestProcessorFunction.cs:3316-3326`) is pinned (`KnowledgeIngestProcessorFunctionTests.cs:140`,
  `KnowledgeSpaceQueueGuardIntegrationTests.cs:150, 254`) — one rule, two copies, one tested.
- `LocalizationSourceConventionTests.cs:148-182` pins `Error_KnowledgeSpaceReserved`, which no code produces, in the
  Functions suite (§0.18 PL-2).
- `KnowledgeController.cs:491-501` maps the new `SpaceFull` to *"This document is still processing — try again once it
  finishes."* (`en.json:2965`); `KnowledgeControllerTests.cs:577-583, 605-621` cover `InvalidState`/`NotFound` only.

### P4-H-26 — MEDIUM — Tests that pin a defect an owner decision changed (catalogue)
| Test | Pins | Product finding |
|---|---|---|
| `knowledgeGuards.test.js:169-174` | the narrow-screen Stopped row with no Read again | P4-H-11 |
| `LocalizationSourceConventionTests.cs:151, 176` | an orphan key | P4-H-25 |
| `ProviderKnowledgeSearchMultilingualTests.cs:141-158`, `BusinessSearchScriptPlanTests.cs:81-93` | the SILENT leg cap (assert only the leg count) | = P4-E-01 *(verified in P4-E)* |
| `KnowledgeIngestProcessorFunctionTests.cs:4790-4811` (H7) | an `Error_` key on a Ready row, pre-E1 input shape | = P4-C-14 *(helper)* |
| `KnowledgeIngestProcessorFunctionTests.cs:3706` | "couldn't read this file again" after an outage | = P4-C-06 *(helper)* |
| `KnowledgeProcessingRulesTests.cs:65-73`, `KnowledgeAdminReindexTests.cs:197-208` | the `UpdatedAt` back-compat fallback | = P4-C-26 *(helper)* |
| `KnowledgeServiceCandidateDetectorTests.cs:88`, `KnowledgeServiceDraftBuilderTests.cs:542-543, 775` | ids/SKUs in the public description | = P4-D-13 *(helper)* |
| `KnowledgeServiceDraftAnalyticsJobTests.cs:380` | "approve deletes the row" (approve now tombstones) | D3 *(helper)* |
| `KnowledgeManagementServiceTests.cs:209-225, 2028-2041` | the untyped exception that becomes a 500 (E9.e) | *(helper)* |
| `knowledgeGuards.test.js:663-667` | a failure sentence on a Ready row | P4-H-35 |
- UNCERTAIN, not listed as a pin: `KnowledgeIngestProcessorFunctionTests.cs:557-574`
  (`Run_ExhaustedOnANonFinalDelivery_AbandonsForRetry…`) abandons on an embedding 503, but its subject is the attempt
  budget; whether it pins R-5's half-build (= P4-C-05) depends on that design.

### P4-H-27 — LOW — A stale, partly tautological OCR page-key test class
- `Clinqet.API.UnitTests\Services\BusinessSearch\OcrPageCacheKeyTests.cs:33-46` composes keys from
  `TranscribePromptVersion`; both production sites pass `PromptFingerprint` (`VisionDocumentTranscriptionService.cs:140-142`,
  `BusinessSearchDocumentService.cs:65-66`, `:235-236`). `AReadKeyAndAWriteKey_BuiltFromTheSameSettings_AreByteIdentical`
  compares the test's own helper with itself. Its comment (`:18-23`) says §0.17 forbids comparing the two hosts'
  appsettings — which `Conventions\OcrPageCacheKeyTests.cs:72-83` correctly does, with a skip. The real reader pin is
  `BusinessSearchDocumentServiceTests.cs:181-213` (verified OK).

### P4-H-28 — LOW — Tests of the test double; a name that contradicts its assertion
- `UnprovisionedSearchStampTests.cs:40-48` and `:111-124` exercise `TestSearchTopology.Unconfigured()` /
  `WithPrivateCell(...)` (`Helpers\TestSearchTopology.cs:14, 112`), not production (production F10 is pinned by
  `SearchTopologyTests.cs:471-488`, verified). `TheAlphabetLookupOnAnEmptyStamp_IsUnresolved_NotEmpty` (`:69-88`) asserts
  `Assert.True(set.Resolved)` and `Assert.Empty(set.Scripts)` (cf. P4-E-05). The class summary still describes the
  deleted `KnowledgeSearchClient` "wrapper … may be EMPTY".

### P4-H-29 — LOW — A concurrency bound proven by an observed peak behind sleeps
- `KnowledgeServiceDraftAnalyticsJobTests.cs:1832-1855`: `await Task.Delay(40, ct)` + `Assert.True(peak <= 2)` — passes
  when `Concurrency` is ignored and batches run one at a time. Memory `flaky-tests-gate-not-clock-2026-09-22` Rule 2
  replaced exactly this with a gate in `KnowledgeManagementServiceTests.cs:1536-1572`. Pre-existing (`05dc0f5`).

### P4-H-30 — LOW — Wall-clock races
- `KnowledgeIngestProcessorFunctionTests.cs:5711-5731`: `showsThemAt = DateTime.UtcNow.AddMilliseconds(600)` +
  `Assert.True(looks >= 2)` — a loaded runner whose first look lands after 600 ms fails the fixed code; *(helper)* the
  pickup and overflow gates also count toward `looks`, so the single-look sabotage is caught only by timing. Production
  uses `DateTime.UtcNow` + `Task.Delay` with no `TimeProvider` (`KnowledgeIngestProcessorFunction.cs:3534-3546`). `:5744`
  and `:5758` assert only `NotEqual(Ready)`, which a row left Processing satisfies. *(helper)* `VisionDocumentTranscriptionServiceTests.cs:168-189`
  (1 s budget vs 2 s write) and `BusinessSearchKnowledgeIsolationIntegrationTests` (`PhoneBudgetSeconds = 4` real deadline
  over loopback) are the same class.

### P4-H-31 — LOW — The receptionist-word convention exempts whole files
- API `KnowledgeReceptionistGateConventionTests.cs:30-36` registers two files; `:86-90` skips EVERY match in them; `:101-102`
  checks only `> 0` hits. A second gate added anywhere in `KnowledgeManagementService.cs` or
  `KnowledgeDocumentRepository.cs` passes. Pin the expected hit count per registered file.

### P4-H-32 — LOW — "Document cap" framing survives the cap's removal
- `KnowledgeCapCountsCosmosIntegrationTests.cs:11-22, 67, 71-72, 103-104` and `KnowledgeManagementServiceTests.cs:114-129`
  speak of "the DOCUMENT cap"; production counts only `TypedFaq` (`KnowledgeManagementService.cs:711`; no production
  `CountAsync(…, File)`). The emulator proof of the SQL is worth keeping; the narrative misleads.

### P4-H-33 — LOW — The API test helper recommends the rejected CI checkout
- `Clinqet.API.UnitTests\Conventions\WorkspaceLayout.cs:78-81` — *"on CI that means an actions/checkout step in
  .github/workflows/_build.yml"* — vs §0.15 *"NEVER add actions/checkout steps for peer repos … rejected outright."*

### P4-H-34 — LOW — Web/mobile source-contract vacuity (verified samples)
- `knowledgeDownload.test.js:83` slices to `page.indexOf("Sheet A4. A box appears here")` — absent from `KnowledgePage.jsx`
  (count 0) ⇒ slice to end of file; mobile `knowledgeRerunAll.test.ts:78` slices to `'const remainingSlots'` — absent (count 0).
- `knowledgeSearchAudienceParity.test.ts:120` `/^export const ([A-Za-z_$][w$]*)/gm` — `[w$]` lacks its backslash, so each
  export name collapses to its first letter; additions still fail, same-initial renames/swaps pass.
- `knowledgeNudgePlacement.test.ts:112` `expect(`${code}:${key}`).toBe(`${code}:${key}`)` (the real check is `:113`).
- Mobile `knowledgeRowStopped.test.ts:52-69` pins `resolveDocumentRowActions`, defined at `knowledgeRowMeta.ts:54` and
  called nowhere in `src`; the real sheet (`MS index.tsx:2193-2215`) is untested.
- Count guards over source (`knowledgeGuards.test.js:73, 77-78, 87, 104, 207`; `knowledgeRowPartOfFile` web `:92` /
  mobile `:103`) defend whichever site they were written against (full list in §5).

### P4-H-35 — LOW — Web pins a second status voice on Ready rows
- `knowledgeGuards.test.js:663-667` asserts `(doc.status === "Failed" || doc.status === "Ready") && doc.failureReason`
  (`KnowledgePage.jsx:519`). Every keep-previous commit clears the reason (`KnowledgeIngestProcessorFunction.cs:3459-3460`)
  and the duplicate note moved to `ReadingNotices` (phase-2 §10.2); where a Ready row still carries a reason (P4-C-14) it
  speaks with two voices, against "one status voice per row".

### P4-H-36 — LOW (UNCERTAIN) — X-06's test probably closes before the page change it names
- `KnowledgeChunkerTests.cs:945-957` asserts only `result.Chunks[0]`; ~30 page-one sentences exceed the target, so
  `Chunks[0]` closes on the target before page two; the card the page change closes (`Chunks[1]`) is never asserted.
  Settle: drop `pageChanged ||` from `KnowledgeChunker.cs:1483` (defined `:1478-1479`) and run it.

### P4-H-37 — LOW — A test disabled by omission
- `KnowledgeIngestProcessorFunctionTests.cs:4942` `public async Task DuplicateUpload_TellsTheProviderOnTheSurvivingRow()`
  has no `[Fact]` (its neighbour's `[Fact]` sits at `:4958`) — it has never run since `cea9b17` (2026-09-04), and it asserts the old
  home `twin.FailureReasonKey == DuplicateMergedReasonKey` that §10.2 moved to `ReadingNotices`. It reports neither
  Passed nor Skipped — it is simply absent from every run. Delete it or make it a real test of the notice.

### P4-H-38 — LOW — Inert or empty-able assertions
- `KnowledgeServiceDraftBuilderTests.cs:998` `[InlineData("Blow dry uniform $40", "$40")]` — "uniform" ends in "form", not
  "from", so the whole-word check it exists for (`KnowledgeServiceDraftBuilder.cs:174-175`, whose comment makes the same
  slip) is never exercised.
- `KnowledgeSearchIndexerIsolationTests.cs:193-201` `Assert.All(_sentOptions, …)` with no `Assert.NotEmpty` first (its
  sibling `:151` has one); *(helper)* the same in `ProviderKnowledgeSearchServiceTests.cs:151-210, 278-355, 422-433`,
  `ProviderKnowledgeSearchMultilingualTests.cs:397-407`, `KnowledgeSearchFieldsTests.cs:65-90`.
- *(helper)* The drafts queue page with all five filters combined is pinned only as SQL text
  (`KnowledgeServiceDraftRepositoryQueryShapeTests.cs:84-101`); the emulator runs each filter alone
  (`KnowledgeServiceDraftRepositoryIntegrationTests.cs:82-98`). The per-document `SUM(IS_DEFINED(c.editedAt))` executes on
  the emulator but its value is never seeded or asserted.

### P4-H-39 — LOW — Stale comments met while tracing tests (docs dimension, in passing)
- `KnowledgeDocumentParser.cs:1515-1516` "class-based hiding needs the stylesheet and stays out of scope" — `:1507`,
  `:1521-1525` implement it.
- `KnowledgeIngestProcessorFunction.cs:3330-3331` "The row stays Failed with the version it already had … still
  answering" — `FailAsync` (`:3586-3590`) makes it Ready + notice (D-1/F-6).
- `MaterialInfoPdfTests.cs:194-196` "Thai and Hebrew … remain open" — both are in the chain (`:206-207`).

---

## 3. Closure check — for every original id, the TEST that would fail if the fix were removed

Verdicts: **PINNED** · **PARTIAL** (one half pinned) · **WEAK** (runs but cannot distinguish) · **SRC** (source-shape
only) · **NOT-PINNED** · plus the code state where a test angle exposed it. Row sources: my re-read unless *(h)* =
helper pass, not re-verified.

### 3.1 Extraction — A / B / C / L / X / EX (Functions ingest host)

| id | Test verdict | Pinning test, or the gap |
|---|---|---|
| A1 / L-4 | **NOT-PINNED** (+ P4-H-03) | no test holds ≥3 one-line priced paragraphs; only `KnowledgePictureTextTests.cs:37-41` has one two-line block |
| A2 | PINNED *(h)* | `KnowledgeExtractionFidelityTests.cs:36, 73, 102, 567` |
| A3 / ADV13 | **NOT-PINNED** | harness only (`ADV\d\d` occurs in no test) |
| A4 | **NOT-PINNED** | every `30 min`/`60 min` in the suites is a DATA cell (`KnowledgeChunkerTests.cs:351-391, 662-668`) |
| A5 / A5-L / L-3 | **NOT-PINNED** (refusal direction) | only the accept case `KnowledgeDocumentParserTests.cs:217-228`; HasHeaderRow=false asserts are CSV/HTML/R7 (`:80, :285`, `KnowledgeCorruptionRegressionTests.cs:85`) |
| A6 / L-8 / R-1 | **NOT-PINNED** *(h)* | `KnowledgeChunkerTests.cs:638` triggers the context line; its filter cannot see it |
| A7 / L-7 | **NOT-PINNED** *(h)* | no names-box-beside-values-box deck |
| A8 | **NOT-PINNED** *(h)* | no multi-paragraph layout cell |
| A9 | **NOT-PINNED** *(h)* | `KnowledgeDocumentParserTests.cs:358` passes either way |
| A10 | **NOT-PINNED** *(h)* | — |
| A11 / L-6 | PARTIAL *(h)* | `KnowledgeSheetRegionTests.cs:247` (sheet name only); freeze N>1, cell newlines, empty leading columns, the H1 guard unpinned |
| A12 | **NOT-PINNED** *(h)* | — |
| A13 | **NOT-PINNED** | no HTML hidden-content fixture exists; the audit's cited cases never existed |
| A14 | **NOT-PINNED** *(h)* | — |
| A15 | PINNED *(h)* | `KnowledgeExtractionFidelityTests.cs:2256, 2272, 2290, 2325` |
| A16 / A16-L / L-5 | PINNED | `KnowledgeDocumentParserTests.cs:159-169` (re-read), `:1225`, `:1270` |
| A17 | **NOT-PINNED** *(h)* | cited VML/linked cases never existed |
| A18 | PINNED *(h)* | `KnowledgeExtractionFidelityTests.cs:1038, 1051, 1063, 1074, 1087` |
| A19 | PARTIAL | CSV reader pinned *(h)* (`KnowledgeDocumentParserTests.cs:27-95`); `.tif` untested; **no parity guard between API `ProviderKnowledge:AllowedExtensions` and Functions `KnowledgeDocumentFormats`** (grep: no test names either) — the exact drift Phase 1 fixed by hand |
| A20 | n/a (no change) | — |
| A21 | PARTIAL *(h)* | per-script factor `RetrievalPayloadSizeMeasurementTests` (MCP); no test contains `。！？؟` (= P4-E-04) |
| A22 | **NOT-PINNED** | no three-line record fixture |
| ADV01 | **NOT-PINNED** | `45,00 €` only in CSV/table CELLS (`KnowledgeDocumentParserTests.cs:41-49`, `KnowledgeChunkerTests.cs:663`) |
| B1 | PARTIAL *(h)* | `KnowledgeSearchIndexerIsolationTests.cs:393, 409`; no 413 is ever thrown |
| B2 | PINNED *(h)* | `KnowledgeChunkerTests.cs:932`, `KnowledgeParserPageCountTests.cs:102`; ingest wiring `:930` unasserted |
| B3 | WEAK *(h)* | chunker ceiling tests measure with the function under test (`KnowledgeChunkerCeilingPropertyTests.cs:81, 101`) |
| C3 | PINNED *(h)* | `KnowledgePictureTextTests.cs:24, 47, 66`; `KnowledgeIngestProcessorFunctionTests.cs:3590` |
| C4 | **NOT-PINNED** *(h)* | — |
| C5 | WEAK *(h)* | detector-only (`KnowledgePictureTextTests.cs:84-111`); lane branch `:2003-2007` deletable |
| C6 | **NOT-PINNED** | `KnowledgeDocumentParserTests.cs:596-608`'s URLs never enter `:1838-1845` (re-read) |
| C7 | WEAK | P4-H-04 |
| C8 | **NOT-PINNED** *(h)* | — |
| C9 | **NOT-PINNED** *(h)* | — |
| C10 | PINNED *(h)* | `KnowledgeDocumentParserTests.cs:614-665` |
| C11 | **NOT FIXED END-TO-END** | P4-H-02 |
| C12 / C12-L | PINNED *(h)* | `KnowledgeIngestProcessorFunctionTests.cs:3910` |
| L-1 | PINNED *(h)* | `DocumentTranscriptionAdjudicationTests.cs:240-383, 754` |
| L-2 | PINNED *(h)* | `DocumentTranscriptionAdjudicationTests.cs:120, 258, 316` |
| L-12 / L-13 | live-only (no code) | — |
| L-14 | false finding (phase 1) | — |
| X-03 | **NOT-PINNED** *(h)* | every merge fixture starts at column A |
| X-04 | **NOT-PINNED** | no scalar-root JSON (`KnowledgeDocumentParserTests.cs:805-906` are object/array roots) |
| X-06 | WEAK / UNCERTAIN | P4-H-36 |
| X-08 | FIXED (deletion) | — |
| EX-32 | PINNED *(h)* | `KnowledgeChunkerTests.cs:101-173`, `KnowledgeExtractionFidelityTests.cs:134-154` |
| EX-24 | PINNED *(h)* | `KnowledgeInventoryBuilderTests.cs:100, 118, 146` |

### 3.2 Pipeline safety, status, drafts — C1 / C2 / E / D / E-12…E-25 / L-9…L-11 / X / phase-2 F / owner D

| id | Test verdict | Pinning test, or the gap |
|---|---|---|
| C1 | PINNED *(h)* | `KnowledgeIngestProcessorFunctionTests.cs:3621-3650`; `KnowledgeIngestTransientRetryIntegrationTests.cs:64-118` (real DI over a 503 wire) |
| R-5 | PARTIAL *(h)* | submit 5xx/4xx pinned; poll-budget tests assert only the exception type; embedding / HttpClient-timeout not built (= P4-C-05) |
| E2 | PARTIAL *(h)* | backoff theory `…FunctionTests.cs:3653-3676`; every test mocks the queue, so the scheduled message is never checked |
| C2 | PINNED *(h)* | `…FunctionTests.cs:2225-2240` (3 byte shapes; `FileFormatException` arm unpinned) |
| E1 / R-4 / R-12 (API) | PINNED *(h)* | `KnowledgeManagementServiceTests.cs:2107-2140` (the flipped `AReplace_Deletes…`); `KnowledgeReplaceIntegrationTests.cs:44-219` (emulator + Azurite); download guards mostly unpinned |
| E1 (Functions) | PINNED *(h)* + defects | `…FunctionTests.cs:3739-3864, 5594-5621`; `KnowledgeSpaceQueueGuardIntegrationTests.cs:86-123` (= P4-C-13/14) |
| E3 | WEAK | P4-H-19 |
| E4 | PINNED *(h)* | `…FunctionTests.cs:1665-1693, 1964-1976`; `LocalizationSourceConventionTests.cs:101-142` |
| E5 | **NOT-PINNED / mostly not built** *(h)* | = P4-C-21 |
| E6 | PINNED *(h)* | `KnowledgeProcessingRulesTests.cs:41-85`; `KnowledgeControllerTests.cs:923-933` |
| E7 / R-9 | WEAK | rule pinned (`KnowledgeReadingNoticesTests.cs:18-160`); wiring (`…Function.cs:899-908, 1211-1226`) unpinned *(h)*; the server sentence untested (P4-H-07) |
| E8 | PINNED *(h)* | `KnowledgeControllerTests.cs:769-779`; parity guard reports Skipped in CI |
| E9 (a–g) | mostly PINNED *(h)* | E9.e half fixed (tests pin the 500) |
| E10 | **NOT-PINNED** *(h)* | `KnowledgeImageCaptionTokens` in no test |
| E11 / L-11 | **NOT-PINNED** *(h)* | only `ReadOwner` tested (`KnowledgeMaintenanceTests.cs:128, 142`); = P4-C-17 |
| E12 D / G | D PINNED, G NOT-PINNED *(h)* | `…FunctionTests.cs:5380-5489` |
| E13 | PINNED *(h)* (real clock) | `VisionDocumentTranscriptionServiceTests.cs:168-214` |
| G-L1 | at-commit check PINNED; reconciliation **NOT BUILT** *(h)* | `…FunctionTests.cs:5680-5767` (= P4-C-08) |
| H2 | WEAK *(h)* | lane failure / remote-image cap have no provider signal |
| D1 | PINNED *(h)* | `KnowledgeServiceDraftBuilderTests.cs:823-844` |
| D2 | PINNED *(h)* | `KnowledgeServiceCandidateDetectorTests.cs:266-343`; guards weak |
| D3 (+E-03/04) | WEAK *(h)* | carry pinned (`…AnalyticsJobTests.cs:327`); re-read not (fakes return the same objects, `:120`, `:354`); = P4-D-02/04 |
| D4 (+E-05) | PINNED *(h)* | `KnowledgeOfferingJudgeTests.cs:78-166` |
| D5 (+E-06/E-14) | PINNED *(h)* | `KnowledgeServiceCandidateDetectorTests.cs:419, 435` |
| D6 (+E-07) | PINNED *(h)* + defect | detector `:367-401`; labelled-line currency dropped (helper) |
| D7 (+E-09/10/11) | PARTIAL *(h)* | tax pinned; ids/SKUs NOT FIXED and pinned (P4-H-26) |
| D8 (umbrella) | see members | — |
| D9 (+E-20) + F-3 | PINNED *(h)*; whole-word case inert | `KnowledgeServiceDraftBuilderTests.cs:963-1035`; P4-H-38 |
| D10 | PINNED *(h)* | `…AnalyticsJobTests.cs:458` (live bytes), `KnowledgeServiceDraftBuilderTests.cs:560-613` |
| E-12 | PINNED *(h)* | detector `:211, 226`; builder `:937` |
| E-13 | PINNED *(h)* | detector `:241, 253` |
| E-15 | **NOT-PINNED** *(h)* + defect | = P4-D-03 |
| E-16 | **NOT-PINNED** *(h)* | every budget test expires in the judge |
| E-17 | **NOT-PINNED** | P4-H-17 |
| E-18 | SRC *(h)* | `KnowledgeJudgePromptConventionTests.cs:21, 33-40` |
| E-19 | WEAK *(h)* | DI path end to end (`…FunctionTests.cs:3384`); other lanes source-shape (`KnowledgeExtractionOutputCopyTests.cs:65-119`) |
| E-20 | PINNED *(h)* | `KnowledgeDraftApprovalServiceTests.cs:2283-2294` |
| E-21 (+D-3) | PINNED | text `KnowledgeServiceDraftRepositoryQueryShapeTests.cs:228-259` + emulator `KnowledgeServiceDraftRepositoryIntegrationTests.cs:100-162` *(h)* |
| E-22 | **NOT FIXED** *(h)* | `KnowledgePriceMarks.cs:165` still inspects `valueTokens[0]` |
| E-23 | **NOT-PINNED** *(h)* | — |
| E-24 | PARTIAL *(h)* | resolver + approve alert pinned; reading-lane alert not (`…AnalyticsJobTests.cs:1731` asserts only "not Failed") |
| E-25 | PINNED | API `VoiceKnowledgeSettingsConventionTests.cs:209-238` (re-read) |
| L-9 | (a) PINNED; **(b) per-currency ceiling proven only on an impossible input** (P4-H-05); (c) PINNED *(h)*; (d) SRC *(h)* | `DocumentIntelligenceServiceTests.cs:512-575` |
| L-10 / R-14 | **NOT-PINNED** (server) | P4-H-18 |
| L-11 | = E11 | — |
| X-02 | PINNED (opening fence) *(h)* | `DocumentIntelligenceServiceTests.cs:939-942` |
| X-05 | PINNED *(h)* | `KnowledgeToolsTests.cs:460-536` |
| X-07 | PINNED *(h)*; self-heal stamp unpinned | `…FunctionTests.cs:4234-4284` |
| P2-A / P2-B | PINNED *(h)* | `DocumentTranscriptionAdjudicationTests.cs:140, 178, 198` |
| P3-A | WEAK *(h)* | `_decidedRows` never observed in `KnowledgeDraftApprovalServiceTests`; `KnowledgeDecidedRowsRepository` behaviour unasserted (UNCERTAIN) |
| U-01 / U-02 (server) | PINNED *(h)* | `KnowledgeDraftApprovalServiceTests.cs:225-361, 1533-1735` |
| U-04 (server) | rule PINNED; gate WEAK *(h)* | `KnowledgeControllerTests.cs:814-833, 923-933` |
| U-08 (server count) | WEAK *(h)* | count pinned, `edited` never asserted |
| phase-2 F-1 | PINNED *(h)* | `…FunctionTests.cs:5124-5162` |
| F-2 | PINNED (alert exists) *(h)*; "collapse" claim false (= P4-D-15) | `KnowledgeDraftApprovalServiceTests.cs:1155-1190` |
| F-3 | PINNED *(h)*; whole-word inert | P4-H-38 |
| F-4 | WEAK | P4-H-30 |
| F-5 | PINNED (mapped arms) *(h)* | `…FunctionTests.cs:3438, 3759, 3793, 4318, 4342, 1780, 1899, 3468` |
| F-6 / owner D-1 | PINNED via `FailAsync` *(h)* | `…FunctionTests.cs:1760-1802`; live-card "Overflow_*" tests actually trip the pickup gate |
| F-7 | WEAK *(h)* | `KnowledgeControllerTests.cs:346-409, 492-532` (sentence choice only) |
| owner D-2 | PARTIAL *(h)* | = E-24 |
| owner D-3 | PINNED | = E-21 |
| owner D-4 | live-only | — |

### 3.3 Retrieval, index, multilingual — F / H / B3 / X-01 / EX-33 / phase-3 D / 2026-09-16 A-1, A-2, coverage hole / post-programme

| id | Test verdict | Pinning test, or the gap |
|---|---|---|
| F1 | service PINNED; **tool layer NOT-PINNED** (P4-H-08); cap WEAK (pins the silence, P4-H-26) | `ProviderKnowledgeSearchMultilingualTests.cs:59-209` *(h)* |
| F2 | PINNED *(h)*; Korean case label-only | `TextScriptDetectorTests.cs:179-259` |
| F3 | PARTIAL *(h)* | factor table pinned; envelope arithmetic for dense scripts WEAK (`RetrievalPayloadSizeMeasurementTests.cs:136-145` asserts only `chinese < latin`; TokenBudget_* fixtures are Latin) — UNCERTAIN whether phase-3 S5 would still be caught for a dense script |
| F4 | service PINNED; tool mapping NOT-PINNED *(h)* | `ProviderKnowledgeSearchMultilingualTests.cs:430-465` |
| F5 | PINNED *(h)* | `…Multilingual…:348-388` |
| F6 | PINNED (voice) *(h)*; >500-doc fallback unpinned (= P4-E-06) | `…Multilingual…:105-118, 397-421` |
| F7 | PINNED *(h)* (only `…Multilingual…:242-254` catches sum-vs-max) | — |
| F8 / R-10 | read PINNED (unit + emulator); **write NOT-PINNED** (P4-H-06); clear NOT-PINNED (accepted in phase 3) | MCP `KnowledgeCardsRewritingTests`, `KnowledgeAnswerableRuleTests`; API `KnowledgeDocumentCasIntegrationTests.cs:114-170` |
| F9 | fonts PINNED; **RTL layout NOT-PINNED** (P4-H-16) | `MaterialInfoPdfTests.cs:144-307` *(h)* |
| F10 | PINNED | `SearchTopologyTests.cs:471-488` (re-read); `UnprovisionedSearchStampTests` partly tautological (P4-H-28) |
| F11 · G-12 | PINNED for `-`, ` OR ` *(h)* | other operators unasserted |
| G-13 | PINNED *(h)*; U+06F0-06F9 gap (= P4-E-11) | `TextScriptDetectorTests.cs:264-295` |
| G-14 | **NOT-PINNED** | P4-H-20 |
| G-15 | not addressed *(h)* | — |
| G-16 | **NOT-PINNED** *(h)* | derived cap equals 128 at shipped defaults |
| G-17 | PINNED | both hosts' `VoiceKnowledgeSettingsConventionTests` |
| G-18 (stored vector) | PINNED to D-26 | `KnowledgeIndexDefinitionTests.cs:150-160` (strict true/false, re-read); `SearchIndexSchemaParityIntegrationTests.cs:184` (Skipped in CI without env) |
| G-19 | WEAK | P4-H-15 |
| G-20 | **NOT-PINNED**; Business Search half unfixed *(h)* (= P4-E-10) | — |
| H1 | WEAK *(h)* | no test ties `KnowledgeTokenEstimate` to `TextScriptDetector.KnownScripts`; three flat ×4 sites survive (= P4-C-07) |
| H3 | closure evidence wrong *(h)* | phase-3 §2.5's renames are not the H3 tests; the flips that matter did happen (`AReplace_…`, `Dedupe_…`) |
| H4 | partial *(h)* | stale comments remain (P4-H-39, P4-E-18) |
| B3 | see 3.1 | — |
| X-01 | live payload PINNED, reopen PINNED (unit); **emulator round trip missing** (P4-H-21); **UI chip NOT-PINNED** (P4-H-09) | `BusinessSearchToolBehaviourTests.cs:337-400`, `BusinessSearchReplayParityTests.cs:211-237` *(h)* |
| EX-33 | PINNED | `KnowledgeIndexDefinitionTests.cs:101-131` (re-read) |
| phase-3 D-1, D-5 | comments fixed | — |
| D-2 | PINNED for StartsWith; **`or`-after accepted** (P4-H-14) | `KnowledgeQueryScopeGuardTests.cs:22-64` (re-read) |
| D-3 | PINNED *(h)* | `TextScriptDetectorTests.cs:208-216` |
| D-4 | fixed in code; stale docs *(h)* | — |
| D-6, D-8 | process/docs | — |
| D-7 | web `.env` repair *(h)* | `productIdentityFollowsPreference.test.js:71, 90-99` |
| A-1 (2026-09-16) | SUPERSEDED BY D-26 (vector not retrievable/stored) — the test now pins D-26 strictly | `KnowledgeIndexDefinitionTests.cs:145-160` |
| A-2 | applied to the vector only | P4-H-15 |
| searched-field-list hole | PINNED both legs | API `KnowledgeSearchFieldsTests.cs:48-59` (NotEmpty first, re-read); MCP `ProviderKnowledgeSearchServiceTests.cs:368-381` *(h)* |
| KnowledgeMaxPassages override | Functions PINNED; **API NOT-PINNED**; writer has no production caller | P4-H-25 |
| KnowledgeSpaceReservation | **NOT-PINNED, unwired** | P4-H-25 |
| 20-document cap removal | PINNED | `KnowledgeManagementServiceTests.cs:150-172`, `KnowledgeControllerTests.cs:226-240`; framing stale (P4-H-32) |
| `ResolvePrivate(..).KnowledgeClient` null | mostly PINNED *(h)*; `BusinessAlphabetService` transient failure cached as resolved-empty unpinned (= P4-E-05) | `ProviderKnowledgeSearchServiceTests.cs:1076-1145`, `SearchTopologyTests.cs` |

### 3.4 UI — U-01 … U-25 (+ E8, E7 row notice, E1 download confirm, X-01 chip)

Structural fact: **no test in either app renders the main knowledge screens** (web never imports `KnowledgePage`,
`KnowledgeServiceDraftsSection` or `UploadKnowledgeModal`; mobile never renders the Knowledge `index.tsx`,
`KnowledgeImagesPanel` or `KnowledgeDocumentScreen`) *(h, spot-checked)*. Row/menu/notice/upload claims are source
matches (construction, never consumption — gotcha 16). Pure rules are behaviourally tested.

| id | web | mobile | note |
|---|---|---|---|
| U-01 | rule PINNED; card NOT-PINNED *(h)* | PINNED (renders) *(h)* | `knowledgeDraftMeta.test.js:365-481`; `knowledgeDraftPlacementTruth.test.tsx:177-204` |
| U-02 | SRC *(h)* | PINNED *(h)* | — |
| U-03 + E8 | ladder PINNED, wiring SRC *(h)* | same | — |
| U-04 | rule PINNED; **narrow menu broken + pinned** (P4-H-11) | tests a rule the screen never calls (P4-H-34) | — |
| U-05 | NOT-PINNED | **NOT BUILT** (P4-H-23) | — |
| U-06 | n/a | SRC for ~4 of ~15 sites *(h)* | — |
| U-07 | rule PINNED, wiring partly SRC *(h)* | (unused rule) | — |
| U-08 | **wrong dialog** (P4-H-22) | same | — |
| U-09 | rule PINNED; row SRC + count guard *(h)* | same | — |
| U-10 | PINNED (renders) *(h)* | PINNED *(h)* | — |
| U-11 | editor PINNED, chips SRC *(h)* | same | — |
| U-12 | PINNED (behavioural) *(h)* | SRC, 1 of 18 entries *(h)* | — |
| U-13 | SRC *(h)* | SRC; spinner keyed on `doc.status` *(h, not re-verified)* | — |
| U-14 | **SRC only** (P4-H-10) | same | — |
| U-15 | PINNED vs a message stub *(h)* | SRC *(h)* | — |
| U-16 / E7 row | SRC; second voice pinned (P4-H-35); controls to read-only (P4-H-24) | SRC | — |
| U-17 | rule PINNED *(h)* | slice without end (P4-H-34) | — |
| U-18, U-19, U-21, U-23, U-25 | NOT-PINNED *(h)* | NOT-PINNED *(h)* | built but untested |
| U-20 | reference | PINNED (renders) *(h)* | — |
| U-22 | n/a | 1 of 4 changes *(h)* | — |
| U-24 | count guard *(h)* | count guard; 1,500 ms coalescing untested *(h)* | — |
| E1 download confirm | SRC + count (list page only) *(h)* | same | viewer download buttons unscanned |
| X-01 chip | **NOT-PINNED** | **NOT-PINNED** | P4-H-09 |

---

## 4. §0.18 placement and §0.15/§0.17 cross-repo

### 4.1 Placement (settled suites from memory `section018-migration-2026-09-22` not re-reported)

| # | Test(s) | Runtime consumer | Verdict |
|---|---|---|---|
| PL-1 | Functions `KnowledgeReadingNoticesTests.cs:157-160`; `KnowledgeIngestProcessorFunctionTests.cs:5647-5655` | `ReadingAgainWouldHelp` — only caller `KnowledgeController.cs:1111` (API). (`From`/`KeptPreviousFor` are Functions-only, `…Function.cs:1211, 3456` — correctly tested there) | **VIOLATION** — 3 new cases (`db119a3`, `8d0886a`, `a01e5ab`) |
| PL-2 | Functions `LocalizationSourceConventionTests.cs:148-182` (`Error_KnowledgeSpaceReserved` ×2) | an API upload-gate SAS-slot sentence (`:144-147`) that no code produces | **VIOLATION + ORPHAN** (`dfb097a`, 2026-09-23) |
| PL-3 | API `DocumentIntelligenceServiceTests.cs` new L-9/truncation cases (`b2e1da3`, `dc69d9f`) | resolved by API (`Program.cs:853`; setup lane `McpService.cs:452`) AND Functions (`Program.cs:817`; drafts job `KnowledgeServiceDraftAnalyticsJob.cs:885`) | ACCEPTABLE (rule 2, pre-existing primary suite) |
| PL-4 | API `UnprovisionedSearchStampTests.cs:95-109` (indexer) | `KnowledgeSearchIndexer` — Functions ingest AND API (prune `KnowledgeManagementService.cs:481, 802, 1262`) | ACCEPTABLE |
| PL-5 | API `KnowledgeNoticeSingularTests` | `KeyFor` — only `KnowledgeController.cs:1093` | CORRECT |
| PL-6 | API `KnowledgeQueryScopeGuardTests`, `KnowledgeSearchFieldsTests`; MCP field test | each host's own leg | CORRECT |
| PL-7 | API `KnowledgeDocumentCasIntegrationTests.cs:114-170` | repository shared by all hosts | ACCEPTABLE |
| PL-8 | MCP retrieval/gate/send suites | MCP; no MCP test calls `SearchForProviderAsync`, no API test calls voice `SearchAsync` (grep) | CORRECT |
| PL-9 | Functions `MaterialInfoPdfTests`, `RealtimeSessionPayloadBuilderTests` | Functions | CORRECT |
| PL-10 | `KnowledgeTokenEstimate` tested only in MCP *(h)* | chunker (Functions/API) + trim (MCP) | the chunker's use has no Functions test (B3 WEAK) |

### 4.2 Cross-repo reads

| Test | Reads | Guard | Verdict |
|---|---|---|---|
| API `Conventions\OcrPageCacheKeyTests.cs:72-83` | Functions appsettings | `Assert.SkipWhen` `:78` | OK (config contract, §0.15) |
| API `KnowledgeIngestTimeoutParityConventionTests.cs:18-37` | Functions appsettings | `SkipWhen` `:25` | OK — reports Skipped in CI |
| API `KnowledgeImageSettingsParityConventionTests.cs:28-50` | Functions appsettings | `SkipWhen` `:35`; fixed non-empty key list | OK |
| API `ScriptThresholdsAgreeAcrossHostsTests.cs:86-94` | API + Functions appsettings | `SkipWhen` `:90`. MCP binds `BusinessSearch:Scripts` (`clinqetmcp Program.cs:295`) but reads no threshold (only the two indexers + `BusinessSearchAgent` do) | OK |
| API `KnowledgeNoticeSingularTests.cs:69-113` | `clinqetinfrastructure\Resources\Localization` (library) | `SkipWhen` `:72` + per-file `File.Exists` | OK |
| API `VoiceKnowledgeSettingsConventionTests.cs:209-238` | infrastructure source via `RequireFile` (throws) | `Assert.NotEmpty(read)` `:226` | OK |
| API/Functions/MCP `KnowledgeReceptionistGateConventionTests` | own host (+ libraries in API) | `>= 5` / `>= 2` / `>= 1` files | OK on reach (P4-H-31 on precision) |
| Functions `MediaExtensionCoverageTests.cs:53-89` | `clinqetapi` appsettings | `SkipWhen` `:57` + `listsRead >= 4` | OK (not knowledge) |
| MCP suites | nothing outside `clinqetmcp` (grep: 0 hits for peer repos / `..\` / `C:\Nik`) | — | OK |
| cosmosindexsetup | own `appsettings*.json` | `SkipWhen` when own file not found (`PrivateCellsBindingTests.cs:20`, `SynonymSafetyGateTests.cs:21`, `GeneratedSynonymsFileTests.cs:22`) | OK (a missing OWN file would be better as a failure) |
| mobile `knowledgeReceptionistAccessParity`, `knowledgeSearchAudienceParity`, `businessSearchRulesParity`, `analyticsWebParity` | the web repo | `existsSync` at module scope; `describe.skip` when absent; **every peer read inside `it()`** (the §0.17 `describe.skip` trap avoided); throw on zero exports | OK (re-read `knowledgeSearchAudienceParity.test.ts:1-40`) |
| web knowledge + Business Search tests | own repo only *(h)* | — | OK |
| `Clinqet.API.UnitTests\Conventions\WorkspaceLayout.cs:78-81` | — | message recommends a peer checkout | P4-H-33 |

**No knowledge test reads a peer repo's SOURCE; every peer read is an appsettings config contract that skips loudly.**
Five of them (four API convention/parity tests + `SearchIndexSchemaParityIntegrationTests.cs:219, 236`, env-gated)
therefore **always report Skipped in CI** — correct per §0.17 rule 5, but it means E8's deadline parity, the image-bound
parity, the OCR template parity and the live D-26 schema proof are only ever checked on a developer machine; the
owning check belongs in `deploy.ps1` (§0.17 rule 4).

---

## 5. Skipped / ignored / disabled

- **No `[Fact(Skip=…)]`, `Assert.Skip`, `#if false` or commented-out `[Fact]/[Theory]`** in any knowledge .NET test (the
  only commented-out facts are non-knowledge: `BusinessProfileControllerTests.cs:585, 623`, `CategoryControllerTests.cs:1628-1641`).
- **Disabled by omission:** `KnowledgeIngestProcessorFunctionTests.cs:4942` (P4-H-37) — reports nothing.
- **Loud skips (acceptable per §0.17 rule 5, all report Skipped):** `Conventions\OcrPageCacheKeyTests.cs:78`,
  `KnowledgeIngestTimeoutParityConventionTests.cs:25`, `KnowledgeImageSettingsParityConventionTests.cs:35`,
  `ScriptThresholdsAgreeAcrossHostsTests.cs:90`, `KnowledgeNoticeSingularTests.cs:72` (library absent — expected to RUN in
  CI, where infrastructure is copied in), `SearchIndexSchemaParityIntegrationTests.cs:219, 236` (env vars),
  `SearchTopologyRegistrationIntegrationTests.cs:110, 128` (gitignored `local.settings.json` / host dir).
- **UI:** only the four conditional `describeIfWeb = available ? describe : describe.skip` suites (reason: web repo absent
  in CI; report Skipped). No `it.skip`, `xit`, `xdescribe`, `.todo`, `.only` or commented-out test *(h)*.
- **UI count guards over source** (defend whichever site they were written against): `knowledgeGuards.test.js:73, 77-78,
  87, 104, 207, 358, 362, 435, 448, 462`; `knowledgeDownload` web `:97` / mobile `:81`; `knowledgeRowPartOfFile` web `:92` /
  mobile `:103`; mobile `knowledgeReceptionistScreen.test.ts:151, 186, 193, 227`, `knowledgeAudienceScreen.test.ts:155, 183`,
  `knowledgeImagesParity.test.ts:149, 333, 339`, `knowledgePreflight.test.ts:153` *(h)*. The right use of a count is
  `knowledgePickerNesting.test.ts:51-55` (duplicate AND removal both fail).

---

## 6. ‼️ SABOTAGE PLAN — the 12 guards most likely to be vacuous or under-reaching

Nothing was run. Apply each in the lead's isolated copy, **grep that the mutation installed**, `touch` restored files
(gotcha 31), then run the named suites. "Before" text is copied from the cited line.

| # | Class | Production file:line | Mutation (before → after) | Tests that SHOULD fail | Why I suspect they will not |
|---|---|---|---|---|---|
| **S-01** | status-lie (E7/R-9, plural) | `C:\Nik\clinqetapi\Clinqet.API\Controllers\Knowledge\KnowledgeController.cs:1093` | `Infrastructure.Services.Knowledge.KnowledgeReadingNotices.KeyFor(notice.Key, notice.Args),` → `notice.Key,` (variant `:1095-1097`: `? string.Format(template, args.Cast<object>().ToArray())` → `? template`) | `KnowledgeNoticeSingularTests.*`; any `KnowledgeControllerTests` reading-notice case | no API test calls `ResolveReadingNotice`; the singular tests call the static `KeyFor` (P4-H-07) |
| **S-02** | status-lie (owner rule 3) | `C:\Nik\clinqetinfrastructure\Services\Knowledge\KnowledgeReadingNotices.cs:116` | `=> keys.Any(key => key is RanOutOfTime or PagesUnread);` → `=> keys.Any(key => key is RanOutOfTime or PagesUnread or PagesNotRendered);` (variant `=> false;`) | `KnowledgeReadingNoticesTests.ThePricesWithoutNamesNotice_NeverOffersReadAgain`; `KnowledgeIngestProcessorFunctionTests.TheReReadNotice_NeverOffersReadAgain`, `…TheReplacementNotice_NeverOffersReadAgain` | each asserts `False` for a key the mutation never touches; nothing asserts the positive side (P4-H-12) |
| **S-03** | wrong facts to a caller (R-10 mixture window) | `C:\Nik\clinqetfuncations\Clinqet.Communications\Functions\KnowledgeIngestProcessorFunction.cs:1176` | delete `await CommitAsync(businessId, docId, r => r.CardsRewriting = true, ct);` (variant: move it after `:1178`) | any Functions ingest test | zero Functions tests reference `CardsRewriting` (grep); the read-side tests are in MCP/API and never run the ingest (P4-H-06) |
| **S-04** | permission widening (U-14) | web `C:\Nik\clinqetwebpartnerapp\src\lib\knowledge\receptionistAccess.js:92-94`; mobile `C:\Nik\clinqetmobilepartnerapp\src\lib\knowledge\receptionistAccess.ts:99-101` | `return materialSharingEnabled === true ? KNOWLEDGE_RECEPTIONIST.AnswersAndSends : KNOWLEDGE_RECEPTIONIST.AnswersOnly;` → `return KNOWLEDGE_RECEPTIONIST.AnswersAndSends;` | web `receptionistAccess.test.js:108-113`, `knowledgeReceptionistAccess.test.jsx:265`; mobile `knowledgeReceptionistAccess.test.ts:108-113`, `knowledgeReceptionistScreen.test.ts:171-178`, `knowledgeReceptionistAccessParity.test.ts` | nothing passes `false`; call sites are string matches; the parity suite compares two identically-mutated twins (P4-H-10) |
| **S-05** | AI words shown as the document's (X-01) | web `C:\Nik\clinqetwebpartnerapp\src\lib\businessSearch\askRules.js:39-43`; mobile `C:\Nik\clinqetmobilepartnerapp\src\lib\businessSearch\askRules.ts:108-112` | body of `aiWrittenLabelKey` → `return null;` | any source-card test | no test in either repo mentions the chip (P4-H-09) |
| **S-06** | tenancy (fail closed on the whole answer) | `C:\Nik\clinqetinfrastructure\Services\Knowledge\ProviderKnowledgeSearchService.cs:584-588` | delete `catch (CatalogIsolationException) { // A foreign row discards the WHOLE answer, never just this leg. throw; }` | MCP `ProviderKnowledgeSearchServiceTests.ForeignCardInTheResponse_DiscardsTheWholeResultSet_AlarmsAndFailsClosed` | single leg → fail-soft → `succeeded == 0` → the same `Unavailable()` + note; alarm raised at `:763` first (P4-H-13) |
| **S-07** | multilingual retrieval (F1 phone) | `C:\Nik\clinqetmcp\Clinqet.Mcp\Tools\KnowledgeTools.cs:123` | `AddRendering(renderings, seen, TextScriptDetector.Gujarati, queryInGujarati);` → `AddRendering(renderings, seen, TextScriptDetector.Devanagari, queryInGujarati);` (variant: delete `:172-173`) | `KnowledgeToolsTests`; `ProviderKnowledgeSearchMultilingualTests` | zero MCP tests pass a `queryIn*` field; service tests bypass the tool (P4-H-08) |
| **S-08** | multilingual material (RTL) | `C:\Nik\clinqetinfrastructure\Services\Documents\QuestPdfService.cs:249` | delete `if (IsRightToLeft(excerpt)) page.ContentFromRightToLeft();` | `MaterialInfoPdfTests.AnArabicScriptExcerpt_IsLaidOutRightToLeft`, `…AHebrewExcerpt_IsLaidOutRightToLeft` | they assert the embedded font and the predicate, never the page direction (P4-H-16) |
| **S-09** | extraction / data loss (A5) | `C:\Nik\clinqetinfrastructure\Services\Knowledge\KnowledgeDocumentParser.cs:1211` | `HasHeaderRow = rows.Count > 1 && LooksLikeALabelRow(rows[0])` → `HasHeaderRow = rows.Count > 1` | `KnowledgeDocumentParserTests`, `KnowledgeCorruptionRegressionTests`, `PageMarkdownSplicerTests` | only the ACCEPT direction is tested (`KnowledgeDocumentParserTests.cs:217-228`); refusal was harness-only (P4-H-01) |
| **S-10** | extraction / money (ADV01) | `C:\Nik\clinqetinfrastructure\Services\Knowledge\KnowledgeChunker.cs:469` | `if (IsMeasureToken(token) \|\| IsLoneCurrencyMark(token)) marked = true;` → `if (IsMeasureToken(token)) marked = true;` | parser/chunker suites | `45,00 €` appears only in cells, never on a value LINE (P4-H-01) |
| **S-11** | extraction / hidden prices SENT to callers (A13) | `C:\Nik\clinqetinfrastructure\Services\Knowledge\KnowledgeDocumentParser.cs:1517-1525` | delete the three removal loops (`[@hidden or @aria-hidden='true']`, `HidesContent(style)`, stylesheet classes) | `KnowledgeDocumentParserTests` HTML cases | no HTML hidden-content fixture exists anywhere |
| **S-12** | picture truth (C7/EX-12 false match) | `C:\Nik\clinqetinfrastructure\Services\Knowledge\KnowledgeImageFingerprint.cs:36-57` | `TryCompute` → `return 0UL;` for any decodable input | `KnowledgeIngestProcessorFunctionTests.LookAlikePictures_UnderTheSameWords_PayForOneDescription` (`:2966`), `…UnderDIFFERENTWords…` (`:2984`) | every fixture picture is solid, whose dHash is already 0 (P4-H-04) |

**Probe (not a sabotage) for P4-H-05:** remove `,""currency"":""INR""` from `DocumentIntelligenceServiceTests.cs:554` and
`:570` → both tests should FAIL, proving the production path (strict schema, no currency) never applies the per-currency
ceiling.

**Alternates:** E-17 (`TranscriptionDisputeIndex.cs:82-111` → substring `Contains`, `CountsAsDistinctive => true`;
predicted green `TranscriptionDisputeIndexTests`); owner-scoped S-11b `KnowledgeManagementService.cs:699-700` → always
`return _settings.MaxPassagesPerBusiness;` and S-12b `:461` `return used - own >= max;` → `return used >= max;` (both predicted
green); X-06 (drop `pageChanged ||` at `KnowledgeChunker.cs:1483`; predicted green `ACardPastTheMinimum_ClosesAtAPageChange`);
C6 (delete `KnowledgeDocumentParser.cs:1838-1845`; predicted green `Html_SvgAndRelativeSources_AreSkipped_AndCounted`); C5
(delete `KnowledgeIngestProcessorFunction.cs:2003-2007`); tenancy guard (no mutation needed — add the case
`IsScopedTo("businessId eq 'MEE3IC' or businessId eq 'OTHER1'", "MEE3IC")` and watch it return true, P4-H-14);
`CapStatedByAsync` (`KnowledgeController.cs:1076` `IsSpaceFull(...)` → `== KnowledgeFailureReason.SpaceFull`; predicted green
`ListKnowledge_TheMeterAndASpaceFullSentence_StateTheBusinesssOwnCeiling`, which seeds only `SpaceFull`).

---

## 7. Verified OK (checked and fine — do not re-derive)

- **F10 production:** `SearchTopologyTests.cs:471-488` builds the real topology with blank endpoints and asserts
  `IsConfigured == false` on both planes.
- **OCR page key, reader side:** `BusinessSearchDocumentServiceTests.cs:181-213` captures the blob the real
  `GetPageAsync` asks for and compares it with the `PromptFingerprint` key; deployment and prompt drift both change it.
- **Indexer tenancy:** `KnowledgeSearchIndexerIsolationTests.cs:142-153` (`Assert.NotEmpty` then every filter
  `StartsWith` the scope) and the four `ForeignRowInResponse_*` abort tests (`:157-189`) assert nothing is deleted.
- **Voice query scope:** `ProviderKnowledgeSearchServiceTests.cs:123-134` asserts `NotEmpty` before `Assert.All`.
- **Searched-field list:** `KnowledgeSearchFieldsTests.cs:48-59` asserts `NotEmpty` first and both `content` + `contentCjk`.
- **contentCjk write:** the indexer sets it on the same objects it uploads (`KnowledgeSearchIndexer.cs:115, 157-172`), so
  `KnowledgeCjkFieldTests` asserting `card.ContentCjk` does pin the wire.
- **R-10 read + `IS_DEFINED`:** `KnowledgeDocumentCasIntegrationTests.cs:114-170` (emulator) and the MCP matrix
  `KnowledgeReceptionistGatesCosmosIntegrationTests.cs:94-144`, which asserts it is not degenerate (`:137-140`) and
  tenant-isolated (`:142-144`).
- **Vector attributes (D-26):** `KnowledgeIndexDefinitionTests.cs:150-160` uses strict `Assert.True(IsHidden)` /
  `Assert.False(IsStored)`; `SearchIndexSchemaParityIntegrationTests.cs:184` `Assert.False(vector.IsStored ?? true, …)`.
  No test or code comment still claims the vector is stored/retrievable *(h)*; `CjkFieldEnabled` survives only in an
  accurate removal note (`KnowledgeCjkFieldTests.cs:40-42`); `KnowledgeSearchClient` only in the convention tests that
  assert its absence.
- **Zero-scan guards:** receptionist conventions (`>= 5/2/1`), `VoiceKnowledgeSettingsConventionTests.cs:226`,
  `KnowledgeParseRoutingConventionTests.cs:29` (`>= 6`), `LocalizationSourceConventionTests.cs:205-206`,
  `KnowledgeDuplicateReasonKeyCatalogueTests.cs:65-67`, `MediaExtensionCoverageTests.cs:81`.
- **Concurrency gate done right:** `KnowledgeManagementServiceTests.cs:1536-1572` (gate + exact equality).
- **Money:** the page-authority rule (`₹42,00,00,000`) is pinned in `KnowledgeServiceDraftBuilderTests.cs:618-632, 660-707,
  728`; F-3's contains-anywhere revert fails 4 of 5 false-positive cases *(h)*.
- **D-1 / F-6 keep-previous by reason:** replacement and re-read × unreadable / too large / no room all have Ready-row
  tests (`KnowledgeIngestProcessorFunctionTests.cs:1780, 1899, 3438, 3468, 3706, 3759, 3793, 4318, 4342, 5161, 5619, 5641`).
- **Placement of the retrieval suites:** no MCP test calls the provider path and no API test calls the voice path.
- **Mobile peer-reading suites** defer every read into `it()` (the §0.17 `describe.skip` trap is avoided).
