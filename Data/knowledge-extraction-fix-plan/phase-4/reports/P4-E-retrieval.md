# P4-E — Search index, retrieval (phone receptionist + Business Search), material send

Dimension auditor E, read-only closing audit, 2026-09-25. Code audited AS IT IS NOW, including the
search-topology commits `bb5ff76` (2026-09-23) and `185a5ac` (2026-09-25) in `clinqetinfrastructure`.
Nothing was built, run, edited or committed. Two scratch diffs I wrote into this folder were deleted after use.

**Counts: 4 High · 5 Medium · 12 Low · 3 Improvement (24).** No Critical, and no cross-tenant leak found.

---

## 1. Scope actually read

**Read end to end**

| File | Lines |
|---|---|
| `clinqetinfrastructure/Services/Knowledge/KnowledgeSearchIndexer.cs` | 571 |
| `…/Knowledge/ProviderKnowledgeSearchService.cs` | 1,267 |
| `…/Knowledge/ProviderKnowledgeSearchService.Provider.cs` | 391 |
| `…/Knowledge/MaterialExcerptBuilder.cs` / `MaterialExcerptAssembler.cs` / `MaterialInfoEmailRenderer.cs` | 583 / 63 / 52 |
| `…/Knowledge/KnowledgeDocumentDataPurger.cs` | 181 |
| `clinqetcore/Interfaces/Knowledge/KnowledgeSearchVisibility.cs` / `KnowledgeReceptionistRule.cs` / `IProviderKnowledgeSearch.cs` / `IKnowledgeSearchIndexer.cs` | 142 / 94 / 62 / 43 |
| `clinqetcore/Models/Knowledge/KnowledgeQueryRenderings.cs` / `KnowledgeMaterialRef.cs` / `KnowledgeImageRef.cs` / `KnowledgeCardMetadata.cs` / `KnowledgeTokenEstimate.cs` | 25 / 102 / 44 / 31 / 79 |
| `clinqetcore/Utilities/TextScriptDetector.cs` | 309 |
| `clinqetcore/Entities/AISearch/KnowledgeSearchDocument.cs` | 149 |
| `clinqetcore/Interfaces/BusinessSearch/BusinessSearchScriptPlan.cs` / `IBusinessAlphabetService.cs` | 152 / 53 |
| `clinqetshared/Models/Voice/KnowledgeSearchModels.cs` (incl. `KnowledgeSourceChannel`) | 155 |
| `clinqetinfrastructure/Services/BusinessSearch/BusinessAlphabetService.cs` / `BusinessSearchQueryRenderings.cs` / `Tools/SearchKnowledgeTool.cs` / `BusinessSearchRulesPrompt.cs` | 192 / 187 / 439 / 76 |
| `clinqetmcp/Clinqet.Mcp/Tools/KnowledgeTools.cs` | 705 |
| `clinqetinfrastructure/Services/Voice/VoiceMaterialSharingGate.cs` | 20 |
| `clinqetinfrastructure/Services/Documents/PdfFonts.cs` + `Resources/Fonts/` (20 .ttf, 3.86 MB) + csproj embed rule | 93 |
| `cosmosindexsetup/KnowledgeSearchIndexInitializer.cs` / `PrivateVectorSearch.cs` | 294 / 32 |
| `clinqetinfrastructure/Services/Search/Topology/SearchTopology.cs` / `SearchCellDirectory.cs` / `Configuration/SearchTopologyRegistration.cs` | 257 / 170 / 155 |
| `…/Search/AiCache/SearchAiCacheStore.cs` / `SearchAiCacheWriteLock.cs` / `SearchAiCachePaths.cs` / `SearchAiCacheBlobFormat.cs` | 444 / 225 / 38 / 120 |
| Tests: `KnowledgeIndexDefinitionTests.cs` (289), `KnowledgeCjkFieldTests.cs` (150), `KnowledgeSearchFieldsTests.cs` (140) | |
| Diffs: `git show bb5ff76` and `git show 185a5ac` for `Services/Knowledge`, `AiCache`, `SearchTopology.cs`, `FullProviderContextService.cs`, `RealtimeSessionPayloadBuilder.cs`, `BusinessAlphabetService.cs` | |

**Read in part (regions named), or by grep only**

- `QuestPdfService.cs` 188–430 of 1,626 (the whole material composer and `IsRightToLeft`).
- `RealtimeSessionPayloadBuilder.cs` 470–520 plus a grep of every knowledge reference.
- `FullProviderContextService.cs` 100–200, 300–330, 577–588.
- `KnowledgeManagementService.cs` 320–375, 440–500, 690–720, 760–880, 1080–1316.
- `KnowledgeDocumentRepository.cs` 160–350.
- `KnowledgeIngestProcessorFunction.cs` 240–452, 730–775, 1090–1330, 3220–3255, 3430–3690.
- `KnowledgeChunker.cs` 19–41, 200–235, 620–720.
- `ProviderCatalogAnswerService.cs` 300–388.
- `AiSession.cs` 85–160; `McpSessionService.cs` `ToStored`/`FromStored` (110–240).
- `BusinessSearchSettings.cs` 100–135 and 206; `BusinessSearchAgent.cs` 105–135.
- `cosmosindexsetup/Program.cs` 1330–1519.
- `ISearchAiCacheStore.cs` 30–100; `SearchAiCacheArtifacts.cs` 60–138.
- Tests read in part: `UnprovisionedSearchStampTests.cs`, `SearchIndexSchemaParityIntegrationTests.cs` 150–244, `MaterialInfoPdfTests.cs` 160–330, `RetrievalPayloadSizeMeasurementTests.cs` 90–203, `ProviderKnowledgeSearchMultilingualTests.cs` 140–185 and 340–410, `BusinessSearchScriptPlanTests.cs` 70–110, `ProviderKnowledgeSearchServiceTests.cs` 369–403.
- Tests checked by grep only: `BusinessSearchToolBehaviourTests`, `BusinessSearchReplayParityTests`, `KnowledgeToolsTests`, `KnowledgeChunkerTests`.

**Authority documents**

- FINDINGS-2026-09-10 §2 C/F/H and the §9 X rows.
- `evidence/agent-G-retrieval-index.md` (G-01…G-20), in full.
- phase-3 `PROGRESS.md`, `AUDIT.md` (incl. §12.9 and §14) and `HANDOVER.md`, in full.
- PHASE-4 prompt 60–190.
- search-topology `PLAN.md` §5.6 (530–664) and `AUDIT-PHASE-2.md` (the knowledge parts).
- `clinqet-search-discovery` SKILL 2120–2320; `clinqet-voice-assistant` SKILL 5845–5880.

---

## 2. Findings

### Index

| Id | Sev | Title |
|---|---|---|
| P4-E-01 | **High** | The leg cap drops renderings SILENTLY on both surfaces. No "not searched in" note, contrary to the design the owner was given; both cap tests pin the silence |
| P4-E-02 | **High** | Kannada, Malayalam, Odia (and Sinhala) are unknown to the detector. They are labelled Latin, get no leg, no tool field and no PDF font. "Nothing Indian left to add" is false |
| P4-E-03 | **High** | D-1 × R-10: a final-delivery failure during the card write commits **Ready**, clears `cardsRewriting` and says "the previous version was kept", while the index holds a two-version mixture |
| P4-E-04 | **High** (passage ruling) | A21's CJK sentence stops are inert: `SplitSentences` needs whitespace after a stop, and unspaced Chinese/Japanese has none |
| P4-E-05 | Medium | The alphabet service caches a TRANSIENT cell-lookup failure as "resolved, no alphabets" for 30 min. Business Search then states a narrowed search as complete |
| P4-E-06 | Medium | The F6 allow-list ceiling (500 docIds) is reachable now that the 20-document cap is gone. The silent post-filter fallback re-opens F6 |
| P4-E-07 | Medium | F3: one chars-per-token factor, taken from the LONGEST passage, under-costs non-Latin cards whenever the longest is Latin. Unpinned |
| P4-E-08 | Medium | F5's unnarrowed retry also fires for the expert check. Passages linked to OTHER offerings then reach a prompt that calls them "about these rows (authoritative)" |
| P4-E-09 | Medium | The search-discovery SKILL (×4), the Phase-4 prompt and memory still instruct keeping the knowledge vector retrievable/stored, contradicting D-26 |
| P4-E-10 | Low | G-20 is only half fixed. Business Search's `Trim` still cuts inside a surrogate pair, and neither surface has a unit test |
| P4-E-11 | Low | G-13 misses Persian/Urdu digits (U+06F0–06F9). The Arabic-script leg is named "Urdu" but maps ASCII to Arabic-Indic U+0660 |
| P4-E-12 | Low | AI-cache lease scope: the prune and the document delete run OUTSIDE the lease. The store's contract claims it serialises "an ingest and a delete" |
| P4-E-13 | Low | The artifact's per-card hash covers `content` only, while the vector embeds title + section + body. I3's "never a vector that predates the text" is not guaranteed |
| P4-E-14 | Low | R-10 was not applied to the picture allow-list (still `status = Ready`). Two comments still say "the send gate requires Ready" |
| P4-E-15 | Low | F5's widened retry: its failed or timed-out legs are neither alarmed nor put in `NotSearchedIn`. An all-failed widen returns None, not Unavailable |
| P4-E-16 | Low | Material send: `MaterialExcerptBuilder.Sentences` does not mirror the chunker. CJK/Arabic/Urdu overlap prints twice, and `CutToSentences` cannot cut them |
| P4-E-17 | Low | Material EMAIL body carries no text direction. RTL records render LTR with label and value in LTR order, while the PDF is RTL |
| P4-E-18 | Low | Stale docs/comments on the font gap and the index definition (voice SKILL ×4, `MaterialInfoPdfTests`, `KnowledgeSearchIndexInitializer`, `BusinessAlphabetService`) |
| P4-E-19 | Low | Unpinned WRITEs and defining properties: the FAQ writer's `HasEmbedding`, the knowledge index's eKNN/normaliser/CJK filter chain, G-14, G-16 |
| P4-E-20 | Low | F2's second half is not built: an unknown script reads as Latin, so the member's own words are replaced. The MCP `query` script also uses the 12-character chunk floor |
| P4-E-21 | Low | AI-cache failures at the card write (storage, lease wait, lease loss) are not on R-5's scheduled-retry path. Each instant redelivery re-embeds everything |
| P4-E-22 | Improvement | Two independent leg-cap settings govern one Business Search fan-out |
| P4-E-23 | Improvement | `IsRightToLeft` flips the whole material PDF on ANY single Arabic or Hebrew character |
| P4-E-24 | Improvement | Minor: `contentCjk` inherits the 4-Han planning floor; the digit variant re-appends the whole question; a zero-card artifact rewrite reads back as corrupt; knowledge artifacts are outside the I5 reconciliation |

---

### P4-E-01 — HIGH — The leg cap drops renderings silently on both surfaces

**Evidence**

The service caps the renderings with `break` and reports only FAILED legs:

`ProviderKnowledgeSearchService.cs:650-654`:
```csharp
var cap = Math.Max(1, _settings.RetrievalMaxQueryLegs);
foreach (var rendering in renderings)
{
    if (legs.Count >= cap) break;
```

`:177-182` (`notSearchedIn` is filled only from failed legs):
```csharp
if (leg.Succeeded) { succeeded++; continue; }
timedOut |= leg.TimedOut;
notSearchedIn.Add(leg.Script);
```

**Phone.** `KnowledgeTools.cs:121-135` adds the renderings in a FIXED canonical order:
`query`, then Hindi, Gujarati, Punjabi, Bengali, Tamil, Telugu, Urdu, Chinese, Japanese, Korean, Thai, Russian, Greek, Hebrew.
The per-call prompt then tells the model to fill every business alphabet AND the caller's language:
- `RealtimeSessionPayloadBuilder.cs:502`: "EVERY time you call search_knowledge you MUST also fill the question field for … each of those languages"
- `:507`: "whenever the caller is speaking a language that does not use the English alphabet, fill that language's question field"

**Business Search.** `BusinessSearchScriptPlan.cs:91-101`:
```csharp
var schema = TextScriptDetector.KnownScripts.Where(s => business.Contains(s, …)).Take(legs).ToList();
var renderings = new List<string> { asked };
foreach (var script in schema)
    if (renderings.Count < legs && !renderings.Contains(script, …)) renderings.Add(script);
```
A business alphabet beyond `legs` gets no field at all, and `asked` can displace one.
`SearchKnowledgeTool.cs:281-288` (`Coverage`) reports only rejected renderings, failed legs and an unresolved alphabet set, so the dropped alphabet never appears.

**Tests pin the silence.**
- `ProviderKnowledgeSearchMultilingualTests.cs:141-158`: four renderings, cap 2, asserts only `Assert.Equal(2, result.LegsRequested)`, which is the "complete" shape.
- `BusinessSearchScriptPlanTests.cs:81-93`: asserts only `plan.Renderings.Count == 2`.

**Violates.** F1 ("NotSearchedIn in the note"), and the design stated to the owner:
- phase-3 `AUDIT.md:537-539`: "a business writing in four alphabets gets three legs and an honest "not searched in" note — which is *correct, designed behaviour*, and the caller is told"
- PHASE-4 prompt:179, same claim.
- `HANDOVER.md:98-99`, same claim.

**Failure scenarios**
1. Phone: a business whose material is {Gujarati, Chinese} gets a Hindi-speaking caller. Renderings are [English, Hindi, Gujarati, Chinese]. Chinese, the business's OWN alphabet, is dropped. `LegsRequested = LegsSucceeded = 3`, `NotSearchedIn = []`, so the note presents the search as complete.
2. Business Search: a business with {Latn, Deva, Gujr, Guru} gets schema [Latn, Deva, Gujr]. Punjabi material is never searched. `Coverage()` returns null, the member gets `NothingFound`, and rule 3 makes the model say plainly it "could not find anything".

**Fix direction** (does NOT raise the cap, per the brief)
- Report every rendering or business alphabet the cap removes: add it to `NotSearchedIn` on the phone and to `Coverage` on the screen.
- When choosing which renderings survive, prefer the business's own alphabets over a caller-only language.
- Rewrite both cap tests to assert the note.
- Owner-visible: the Phase-4 prompt says "do not touch the note". This change makes the code produce the note the design already promised.

**Confidence.** Confirmed by code. Frequency needs the Phase-4 "alphabets per business" count; the phone variant needs only two business alphabets plus a non-Latin-speaking caller.

---

### P4-E-02 — HIGH — Kannada, Malayalam, Odia and Sinhala are invisible to the multilingual fix

**Evidence**

`TextScriptDetector.cs:44-67`: the block table jumps from Tamil and Telugu to Thai:
```csharp
(0x0B80, 0x0BFF, Tamil),
(0x0C00, 0x0C7F, Telugu),
(0x0E00, 0x0E7F, Thai),
```
Four ranges are never counted:
- 0B00–0B7F Odia
- 0C80–0CFF Kannada
- 0D00–0D7F Malayalam
- 0D80–0DFF Sinhala

`:113` then applies `if (counts.Count == 0) return [Latin];`.

These scripts are also absent from:
- `KnownScripts` (:71-73)
- the MCP tool fields (`KnowledgeTools.cs:89-102`)
- `BusinessSearchScriptPlan.FieldNameFor`/`LanguageNameFor` (:111-150)
- `PdfFonts.MaterialFamilyChain` (:40-45)

`grep` over the detector, the plan, the tool and the fonts for Kannada/Malayalam/Odia/Oriya/Sinhala returns nothing, and none of the authority documents mentions them.

Inconsistency: `KnowledgeTokenEstimate.cs:73` DOES know them. `IsCluster` covers `'ऀ'..'෿'` (0900–0DFF).

**Violates.**
- H1 ("multilingual is only half-built") and F2, whose original list was incomplete.
- F9 font coverage.
- phase-3 `AUDIT.md:528-529`: "Every INDIC font is already shipped … There is nothing Indian left to add." False.
- The guard `EveryScriptTheDetectorCanEmit_HasAFontInTheMaterialChain` is structurally blind to scripts the detector cannot emit.

**Failure scenario.** A Bengaluru salon on the IN stamp uploads a Kannada price list.
1. Every card is labelled `Latn`, so the alphabet set is {Latn} and the phone prompt names no alphabet.
2. The tool has no Kannada field. BM25 from English shares no token with the Kannada cards; only the weak cross-script vector leg can reach them.
3. On Business Search, a member asking in Kannada is detected as `Latn`. The English translation is accepted, coverage reads "complete", and a confident "not found" is possible.
4. `send_material_info` delivers a PDF of boxes.

**Fix direction.** Add Odia, Kannada and Malayalam (and Sinhala if Sri Lanka matters) as blocks, tool and plan fields, and Noto faces (~50–250 KB each, the Indic class the owner already accepted). Correct the phase-3 claim.

**Confidence.** Confirmed by code. Population size is an owner judgement; the India stamp exists and serves these states.

---

### P4-E-03 — HIGH — D-1 × R-10: a mid-write final failure publishes a two-version mixture as "Ready, previous version kept"

**Evidence**

The run flags the rewrite, then writes, prunes and verifies. `KnowledgeIngestProcessorFunction.cs:1176-1181`:
```csharp
await CommitAsync(businessId, docId, r => r.CardsRewriting = true, ct);
await _indexer.UpsertCardsAsync(searchDocs, ct);
await _indexer.PruneCardsAtOrAboveAsync(businessId, docId, searchDocs.Count, ct);
await EnsureTheIndexTookThemAsync(businessId, docId, searchDocs, ct);
```

A generic failure of any of those four lands in `catch (Exception ex)`:
- Non-final deliveries abandon (:432). The row stays Processing with `cardsRewriting=true`, which is silent and correct.
- On the FINAL delivery (:364-377) the catch calls `TryMarkFailedAsync`. For a Processing row that reaches `FailAsync` (:3633-3640).
- `FailAsync` never consults the flag (:3586-3590):
  ```csharp
  if (current != null && (current.PassageCount ?? 0) > 0)
  { await KeepTheAnsweringVersionAsync(businessId, docId, current.PendingBlobPath, reasonKey, ct); return; }
  ```
- `KeepTheAnsweringVersionAsync` commits `r.Status = KnowledgeDocumentStatus.Ready` plus a "kept previous" notice (:3457-3468).
- `CommitAsync` then clears the flag (:3238): `if (row.Status != KnowledgeDocumentStatus.Processing) row.CardsRewriting = null;`.
- The code's own comment (:3444-3445) claims "the cards all still describe the version that works". Once line 1176 has run, that is not true.

**Violates.**
- R-10: "from here the document is a mixture of two versions and must answer nobody" (:1172-1175).
- R-10's own edge-case table, `AUDIT.md:435`: "Retries exhausted → dead-letter: Row stays Processing + flag true → silent. Identical to today." That holds only for a host crash, not for exception-driven exhaustion.
- D-1's premise: "a document whose cards **still answer**".

**Failure scenarios.** A Ready 10-card price list is re-read into 6 cards.
- **Upload fails part-way on every delivery.** Page 1 lands, page 2 fails (capacity, lease loss, partial 207). On the final delivery the row goes Ready with new cards 0–k beside old cards k+1–9 unpruned. The provider is told the old version was kept.
- **The prune fails on every delivery.** The full new set is live, plus the stale old tail 6–9. The notice again says the previous version was kept.

Either way callers can be answered from an answer "that existed in neither" version, which is R-10's defined hazard. It becomes a Critical-class outcome whenever the two versions disagree on a fact.

**Fix direction.** In `FailAsync`, treat `current.CardsRewriting == true` as "the answering version is NOT intact". Do not route to `KeepTheAnsweringVersionAsync`. Either leave the row Processing plus the flag, alert, and let "Try again" rebuild; or purge and fail honestly. Add a test for the final-delivery path. The fix lives in the Functions ingest; hand to the terminal-failure dimension, reported here because it defeats F8/R-10's answerability guarantee.

**Confidence.** Confirmed by code (the call chain above, read line by line). Frequency needs an index-stage failure that persists across all deliveries.

---

### P4-E-04 — HIGH (owner ruling: passage defect) — A21's CJK sentence stops are inert

**Evidence**

`KnowledgeChunker.cs:34-38` added `'。', '！', '？', '．'` (with the A21 comment at :31-33 claiming a CJK page no longer holds "exactly ONE sentence"). But `SplitSentences` only accepts a stop that whitespace follows (:636-638):
```csharp
var atEnd = i == text.Length - 1;
if (!atEnd && !char.IsWhiteSpace(text[i + 1])) continue;
```
Unspaced Chinese and Japanese never put whitespace after `。`.

An oversize run therefore falls through to `ScriptBoundary` (:712-716), which cuts at the LAST punctuation mark OR SYMBOL inside the bound:
```csharp
if (char.IsPunctuation(text[i - 1]) || char.IsSymbol(text[i - 1])) return i;
```
That includes `，`, `：` and `¥`.

**Test coverage.** No chunker test uses a CJK stop (`KnowledgeChunkerTests` has English, Devanagari, decimals and abbreviations only).

**Violates.** A21 / H1 ("sentence splitting has no CJK/Arabic terminators"). The Arabic and Urdu stops do work, because those scripts are spaced.

**Failure scenario.** A long unspaced Chinese policy or description paragraph is one "sentence". It is cut mid-clause, for example right after `¥` or `：`, separating a price from its label. The chunker's overlap then copies whole paragraphs.

**Fix direction.** For the fullwidth stops (and `。` specifically) do not require trailing whitespace. Add an unspaced-CJK `SplitSentences` test. Let the passage dimension (C) own the fix.

**Confidence.** Confirmed by code for the rule and the cut. The size of the harm needs a live unspaced CJK prose document.

---

### P4-E-05 — MEDIUM — A transient cell-lookup failure is cached as "resolved, no alphabets" for 30 minutes

**Evidence**

After the topology refactor, a null client no longer only means "unprovisioned stamp".
- `BusinessAlphabetService.cs:141-143` resolves `var route = await _topology.ResolvePrivateAsync(...)` and facets `route.KnowledgeClient` and `route.CatalogClient`.
- `:163`: `if (client == null) return [];`, which is "answered, nothing indexed".
- `:156`: `return new BusinessAlphabetSet(ordered, resolved: true);`.
- `:109-111`: a resolved set is cached for `CacheMinutes` (30 in both hosts); only an UNRESOLVED set gets `UnresolvedCacheSeconds` (60).

`SearchTopology.cs:103-104` returns null clients for any non-found lookup, including `Unavailable`:
```csharp
? new PrivateRoute(string.Empty, null, null, lookup.IsFound ? SearchCellLookupStatus.UnknownCell : lookup.Status)
```
`SearchCellDirectory.cs:102-110` turns any profile-read exception into `Unavailable`, cached only 10 s (:161).

Before `bb5ff76` the client was injected and null only on an unprovisioned stamp; the diff shows `_knowledgeClient = knowledgeSearchClient?.Client`.

**Violates.** `IBusinessAlphabetService.cs:35-37`: "'this business writes only Latin' and 'the lookup did not answer' must never collapse into the same value". Also rule 6: the refactor activated a branch that was correct only while null meant "no index".

The guard pins the unprovisioned case with an inverted name. `UnprovisionedSearchStampTests.cs:73-87`, `TheAlphabetLookupOnAnEmptyStamp_IsUnresolved_NotEmpty`, asserts `Assert.True(set.Resolved); Assert.Empty(set.Scripts);`, contradicting both its name and its own lead comment (:70-71). No test covers `Unavailable`, `NotAssigned` or `UnknownCell`.

**Failure scenario.** A 10-second Cosmos blip on a Gujarati-plus-English business's profile read. For the next 30 minutes:
- Business Search plans [asked, Latn] with `AlphabetsResolved = true` (`BusinessSearchScriptPlan.cs:84-87`). `Coverage` stays null (`SearchKnowledgeTool.cs:286`), so English questions miss Gujarati material with no narrowed note.
- The phone prompt names no alphabet (`FullProviderContextService.cs:579` returns [] for an empty set).
- Separately, a cold lookup slower than `LookupTimeoutMs` (250) is pinned into the 5-minute provider context (`ProviderContextCacheMinutes = 5`).

**Fix direction.** Return `Unresolved`, short-cached, when `route.LookupStatus is not null and not Found`. Keep "resolved-empty" only for `LookupStatus == null` (no private plane). Rename and fix the test, and add the `Unavailable` case.

**Confidence.** Confirmed by code.

---

### P4-E-06 — MEDIUM — The F6 allow-list ceiling is reachable now that the document cap is gone

**Evidence**

The ceiling and its comment, `ProviderKnowledgeSearchService.Provider.cs:20-21`:
```csharp
// ~220 ids at the shipped caps (20 documents + 200 FAQs); the OData filter limit is far above that.
private const int MaxDocIdsInFilter = 500;
```

Both surfaces fall back silently above it:
- Phone `:997-1007`: `if (answerableDocIds.Count == 0 || answerableDocIds.Count > MaxDocIdsInFilter) { … return filter; }`
- Business Search `Provider.cs:236-249`: `if (visible.Count <= MaxDocIdsInFilter) { … } else { … falling back to post-filtering }`

Nothing now bounds the document count below 500:
- `VoiceKnowledgeSettings.cs:13-20`: "THERE IS NO MaxDocumentsPerBusiness", with `MaxPassagesPerBusiness = 2000`.
- `KnowledgeManagementService.cs:699-700`: the admin override is accepted as long as it is ≥ 1, with no upper bound.

**Violates.** F6. Rule 6: removing a cap activated a dormant fallback.

**Failure scenario.** A dealer with 600 one-to-three-card spec sheets, one large catalogue set to NotUsed and a document mid-rewrite. Their rows fill the 16-card window, the post-check drops them all, and the result is None on the phone. On the screen it is a confident "not found", the exact F6 defect.

**Fix direction.** When the answerable set is large, filter by EXCLUSION of the (normally small) non-answerable set: `not search.in(docId, …)`. Or derive the ceiling from the effective passage cap. Fix the comment.

**Confidence.** Confirmed by code. Needs a large-library business to bite.

---

### P4-E-07 — MEDIUM — F3: one token factor per result, taken from the longest passage

**Evidence**

`ProviderKnowledgeSearchService.cs:898`: `var charsPerToken = KnowledgeTokenEstimate.CharsPerToken(DominantContent(passages));`
`:948-957` picks the single longest `Content`, and `:907` sizes the whole budget with that one factor.

`KnowledgeTokenEstimate.cs:11-14` says "Two callers, one factor: a card cut to fit a budget that the reader then measures differently is how a document becomes unanswerable…". The chunker measures each card with its OWN factor (`KnowledgeChunker.cs:21`).

No test covers a mixed-script result or the "longest" rule; the only F3 tests (`RetrievalPayloadSizeMeasurementTests.cs:125-154`) are single-script.

**Violates.** F3 fix direction ("per-script factor keyed off the card's scripts label"), H1, and B3's single-factor contract.

**Failure scenario.** `RetrievalMaxTokens` 3,000, envelope ~425 tokens. The ranked set is one 1,800-character English card (the longest) plus four 1,500-character Gujarati cards.
- The factor is 4, so the budget is 2,575 × 4 = 10,300 characters and all five cards are seated.
- Real cost: 450 tokens (English) + 6,000 / 1.6 = 3,750 tokens (Gujarati), plus the envelope, ≈ 4,625 tokens. That is 54% over the budget the realtime session was sized for.

**Fix direction.** Cost each passage in tokens with its own factor (`KnowledgeTokenEstimate.Tokens(payload)`) against a token budget. Add a mixed-script test.

**Confidence.** Confirmed by arithmetic.

---

### P4-E-08 — MEDIUM — F5's unnarrowed retry leaks into the expert check

**Evidence**

`ProviderCatalogAnswerService.cs:371-378` says this path narrows deliberately, then passes candidate ids:
```csharp
// ‼️ ONE rendering: … this path narrows to candidate offerings rather than searching the library.
var result = await _knowledgeSearch.SearchAsync(businessId, new KnowledgeSearchQuery { …
    LinkedServiceIds = candidates.Select(c => c.ServiceId)… });
```

`ProviderKnowledgeSearchService.cs:204-215` retries WITHOUT the clause whenever the narrowed result is empty. The narrowed filter already includes unlinked documents (`or not linkedServiceIds/any()`, :984), so the retry can only ADD documents linked to OTHER offerings.

The prompt then presents them (`ProviderCatalogAnswerService.cs:319`):
```
"Passages from the business's own documents about these rows (authoritative where they speak):"
```

**Violates.** F5 was scoped to `search_knowledge` (the sibling-id case, G-05). This caller's contract is narrowing. Rule 6.

**Failure scenario.** Requirement "does the deep-tissue massage include hot stones?" with candidate [Deep tissue]. Nothing is linked to it, so the retry returns the "Hot stone massage" brochure ("includes heated basalt stones"). It is labelled as about these rows and authoritative, so the verdict may mark Deep tissue as `stated`, and a caller hears a wrong capability claim. The passage's `offerings` field is the only mitigation, and it is model-dependent.

**Fix direction.** Add an opt-out on `KnowledgeSearchQuery` (for example `RetryUnnarrowed = false`) for the expert check, or run the retry only for the `search_knowledge` tool.

**Confidence.** Confirmed by code. The wrong verdict needs model error.

---

### P4-E-09 — MEDIUM — Docs still instruct keeping the knowledge vector retrievable and stored

**Evidence**

`.claude/skills/clinqet-search-discovery/SKILL.md:2166`, identical in `.github` and `.agents` (:2166) and `.cursor` (:2191):
> "‼️ **THIS IS WHY THE VECTOR IS KEPT RETRIEVABLE.**"

`:2191` (cursor :2216):
> "‼️ **AND SET `IsHidden = false` / `IsStored = true` EXPLICITLY on the vector.**"

`:2184` describes deriving `hasEmbedding` from `contentVector != null`, reading the vector back. The section is not marked superseded; the later Phase-2 block (:2263-2308) never says the knowledge vector is now unstored.

The same claims appear in:
- PHASE-4-FINAL-AUDIT-PROMPT.md:27 and :77 ("`contentVector` **retrievable AND stored**")
- PHASE-4-FINAL-AUDIT-PROMPT.md:89-90 ("why `IsStored = true` must never be 'optimised' away")
- memory `knowledge-cjk-field-live-2026-09-16.md:33-36`

The code and test say the opposite:
- `KnowledgeSearchIndexInitializer.cs:208-209`: `IsHidden = true, IsStored = false`
- `KnowledgeIndexDefinitionTests.cs:158-159`: `Assert.True(field.IsHidden); Assert.False(field.IsStored);`

**Violates.** D-26/D-21 (owner). The brief: "any DOC/TEST/COMMENT that still claims the opposite IS a finding". CLAUDE.md §0.9: a stale skill misleads future work.

**Failure scenario.** A future session following the SKILL "restores" retrievability, or writes a copy tool that reads vectors from an index that no longer returns them. It gets nulls, the exact silent vector-loss trap the SKILL itself describes.

**Fix direction.** Mark the section superseded by D-26 in all four copies; the recipe's vector source is now the blob artifact. Correct the Phase-4 prompt and the memory entry.

**Confidence.** Confirmed.

---

### P4-E-10 — LOW — G-20 is only half fixed

**Evidence**

The voice path is safe, `ProviderKnowledgeSearchService.cs:1039-1041`:
```csharp
var cut = MaxQueryTextChars; if (char.IsHighSurrogate(trimmed[cut - 1])) cut--;
```

Business Search is not, `BusinessSearchQueryRenderings.cs:164-168`:
```csharp
var trimmed = text.Trim();
return trimmed.Length > MaxRenderingChars ? trimmed[..MaxRenderingChars] : trimmed;
```
The service's `NormalizeText` returns any text of 200 characters or fewer unchanged (:1035), so a lone high surrogate from `Trim` reaches `BuildSearchText` and the embedding request.

The original G-20 named BOTH files (`agent-G-retrieval-index.md:195`). No unit test in the MCP or API knowledge suites exercises a surrogate cut; the phase-3 "proof" for G-20 was a live probe on the voice path only.

**Failure scenario.** A Business Search question whose 200th UTF-16 unit is the first half of an emoji. That leg's search or embed either rejects the text or substitutes U+FFFD. The runtime result NEEDS-LIVE-PROOF.

**Fix direction.** Reuse the surrogate-safe cut in `BusinessSearchQueryRenderings.Trim`, and add one unit test per surface.

**Confidence.** Confirmed by code; the runtime effect is uncertain.

---

### P4-E-11 — LOW — G-13 misses Persian/Urdu digits

**Evidence**

`TextScriptDetector.cs:243-253` lists only `(Arabic, '٠')` for the Arabic script. `FoldDigitsToAscii` (:265-281) folds only the ten digits after each zero, so U+06F0–06F9 (Extended Arabic-Indic, used by Persian and Urdu) are never folded, and `MapAsciiDigitsTo` maps an Arabic leg's ASCII digits to U+0660.

The platform's name for that leg is Urdu (`BusinessSearchScriptPlan.cs:119`: `TextScriptDetector.Arabic => "queryInUrdu"`).

**Violates.** G-13 ("both digit forms") and H1, which names Persian as a real population.

**Failure scenario.** A Toronto Persian price list reads `قیمت: ۵۰۰`. A caller says "500". The Arabic leg searches `500 … ٥٠٠`, and neither term matches `۵۰۰`.

**Fix direction.** Fold U+06F0–06F9 in both directions (a second zero for the Arabic script).

**Confidence.** Confirmed by code.

---

### P4-E-12 — LOW — AI-cache lease scope

**Evidence**

The upsert holds the lease across the artifact and the cards (`KnowledgeSearchIndexer.cs:151-155`). But:
- `PruneCardsAtOrAboveAsync` (:311-316) takes no lease.
- `DeleteCardsForDocumentAsync` (:318-327) takes no lease.
- Every caller prunes after the upsert has released it (`KnowledgeIngestProcessorFunction.cs:1178-1180`; `KnowledgeManagementService.cs:481, 801-802, 1261-1262`).

PLAN §5.6.4 (:586-587) specifies "lease → artifact … → cards → prune → release".

`ISearchAiCacheStore.cs:81-86` claims:
> "The real race here is two writers of the SAME document (an ingest and its own re-upsert retry, or an ingest and a delete), which this serialises"

The delete never takes the lock. In practice the per-business ingest session serialises ingest and delete.

**Failure scenario.** Two concurrent edits of the same FAQ:
1. Edit A upserts one card.
2. Edit B upserts two cards; the artifact now names two.
3. A's prune (keepCount 1) deletes card 1.

The artifact then names a card the index lacks, which breaks invariant S7. An API delete that overlaps an in-flight upsert gets a 412 on the artifact delete.

**Fix direction.** Hold the lease through the prune: move the prune inside `UpsertCardsAsync`, or give the prune the lock. Correct the interface text.

**Confidence.** Confirmed by code. The concurrency is rare.

---

### P4-E-13 — LOW — The artifact hash does not cover what the vector was embedded from

**Evidence**

`KnowledgeSearchIndexer.cs:194`: `artifact.CardContentHashes.Add(HashContent(card.Content));`, the body only.

The vector is embedded from more than the body, `KnowledgeChunker.cs:222,227`:
```csharp
var contentPrefix = ContentPrefix(prefixedTitle, card.SectionPath);
… EmbedText = … $"{contentPrefix}\n{card.EmbedText}"
```
The title is the per-run, AI-written D11 title.

`SearchAiCacheArtifacts.cs:96-97` claims "A copy is only ever made when the index card's text hashes to the entry here — otherwise the document is re-ingested, never guessed at."

**Violates.** Invariant I3 ("a stale or tampered artifact cannot produce a wrong vector").

**Failure scenario.**
1. A re-read writes the artifact for a new run whose AI title differs.
2. The index write then fails terminally; D-1 keeps the old cards, which have an identical body and the old title.
3. A future copy tool pairs each old card with the new run's vector, because the hashes match.

Latent until Phase-5 tooling exists: today nothing reads the knowledge artifact except the image-delete rewrite.

**Fix direction.** Hash the exact embed input, or at least `docTitle + sectionTitle + content`.

**Confidence.** Confirmed by code; latent.

---

### P4-E-14 — LOW — R-10 not applied to the picture allow-list

**Evidence**

`KnowledgeDocumentRepository.cs:230-237`:
```
// ‼️ The DOCUMENT status is filtered too: the send gate requires Ready …
"FROM c WHERE c.type = @type AND c.sourceKind = @sourceKind AND c.status = @ready …"
```

The send gate is R-10-aware and accepts Processing with `!cardsRewriting` (`KnowledgeTools.cs:338-340` → `KnowledgeReceptionistRule.Decide(row.Status, row.CardsRewriting, …)`).

Two more stale claims:
- `KnowledgeDocumentRepository.cs:268-270` ("the allow-list is Ready-only")
- `KnowledgeTools.cs:610-612` ("the answerable allow-list — which is Ready-only")

**Failure scenario.** While a document is re-read (minutes), its text keeps answering and its refs keep sending, but its pictures silently stop being offered. This errs on the safe side and is inconsistent with R-10's intent.

**Fix direction.** Apply `KnowledgeAnswerableRule.CosmosStatusFilter` to the picture query too (with an emulator test), or explicitly document pictures as Ready-only. Fix the three comments.

**Confidence.** Confirmed by code.

---

### P4-E-15 — LOW — F5's widened run is unaccounted

**Evidence**

`ProviderKnowledgeSearchService.cs:208-215` replaces `ranked` and `companions` from `widened`. It never updates `succeeded`, `timedOut` or `notSearchedIn`. If `!widened.Any(l => l.Succeeded)`, `ranked` stays empty and the call returns `None(...)` (:253), not `Unavailable`.

**Failure scenario.** The narrowed legs succeed but find nothing. The widened Gujarati leg times out while the English leg finds nothing. The note says "Nothing in the material that WAS searched covers that". The timeout is never alarmed, and Gujarati is not reported as unsearched.

**Fix direction.** Merge the widened legs' failures into the counters, alarm on their timeouts, and return `Unavailable` when every widened leg failed.

**Confidence.** Confirmed by code.

---

### P4-E-16 — LOW — The material builder's sentence rule does not mirror the chunker

**Evidence**

`MaterialExcerptBuilder.cs:451` splits only on `c is '.' or '!' or '?' or '।' or '॥'`, with no whitespace rule. The chunker also splits on `。！？．؟۔…` and more (`KnowledgeChunker.cs:34-41`).

`DropOverlap` (:406-440) therefore cannot find the chunker's overlap for CJK or Arabic/Urdu prose. `CutToSentences` (:561-565) returns an uncut paragraph when it sees at most one "sentence".

**Failure scenario.** A caller is sent two adjacent Urdu or Chinese prose cards, and the overlapping sentence or paragraph appears twice in the PDF and the email.

**Fix direction.** Share one sentence splitter between the chunker and the builder.

**Confidence.** Confirmed by code.

---

### P4-E-17 — LOW — The material email body has no text direction

**Evidence**

`MaterialInfoEmailRenderer.cs:27-41` emits `<h4>`, `<table>` and `<p>` with no `dir` attribute. The PDF is RTL for Arabic and Hebrew (`QuestPdfService.cs:249`).

**Failure scenario.** An Urdu record is emailed. The label column sits on the left and the value on the right (LTR table order), and paragraphs align left. This is the "reverses the order of a label: value row" failure F9 fixed for the PDF.

**Fix direction.** Add `dir="auto"` per element, or `dir="rtl"` from the same `IsRightToLeft` decision.

**Confidence.** Confirmed by code. Rendering varies by mail client.

---

### P4-E-18 — LOW — Stale documentation and comments

- `clinqet-voice-assistant` SKILL:5876-5879 (identical in all four copies) says "Han, Japanese and **Hebrew** remain DECLARED gaps" and "RTL for Arabic script".
  - Hebrew and Thai have had faces since 2026-09-16, and Hebrew is RTL too.
  - The real gaps are Han, Japanese and Hangul (the brief: "a doc that states the gap WRONGLY is still a docs finding").
- `MaterialInfoPdfTests.cs:187-196` says "FIVE scripts fall through to this catch-all", "Thai and Hebrew … remain open" and "3.6 MB".
  - This contradicts `:206-212` in the same file ("ONLY Hani, Jpan and Hang land here now") and the 3.86 MB on disk.
- `KnowledgeSearchIndexInitializer.cs:14-19` says "The remaining searchable fields stay `standard.lucene`".
  - EX-33 moved all seven to `en.microsoft` (:49-50), and the test pins it (`KnowledgeIndexDefinitionTests.cs:101-131`).
- `BusinessAlphabetService.cs:21` says "Eight known scripts"; there are 15.

**Fix direction.** Correct the text only.

---

### P4-E-19 — LOW — WRITEs and defining properties that no test pins

- **FAQ `hasEmbedding`.** The FAQ writer sets it (`KnowledgeManagementService.cs:1197`), but no API test asserts it; only the ingest does (`KnowledgeIngestProcessorFunctionTests.cs:1150`). Every hybrid leg filters `hasEmbedding eq true` (`ProviderKnowledgeSearchService.cs:989-990`), so dropping the line would hide every FAQ from normal hybrid search with all suites green. Fix: have the indexer derive `HasEmbedding` itself (it already requires a full vector, :91-93), or pin it.
- **The private knowledge index's defining properties** are pinned only by a live test that SKIPS in CI (`SearchIndexSchemaParityIntegrationTests.cs:166-201`, `Assert.SkipWhen` at :236-239). These are the ones behind topology P0-A:
  - exhaustive KNN, no compression (`PrivateVectorSearch.cs:26-30`)
  - the `businessId` lowercase normaliser (`KnowledgeSearchIndexInitializer.cs:176-180`)
  - the CJK analyzer's filter chain (:283-291)

  `KnowledgeIndexDefinitionTests` asserts none of them at build time.
- **G-14** (vector k = window, `:553, :696`; `Provider.cs:221`) and **G-16** (derived ref cap plus truncation log, `:297-315`) have no unit assertion.

**Fix direction.** Build-time asserts on `BuildIndex()`; one test each for G-14 and G-16.

---

### P4-E-20 — LOW — F2's second half is not built, and the MCP `query` uses the chunk floor

**Evidence**

An unknown script reads as Latin: `TextScriptDetector.cs:105-113` ("an unsupported writing system … answers Latin"). `BusinessSearchScriptPlan.cs:75` then sets `asked = Latn`, and `BusinessSearchQueryRenderings.cs:123` accepts the English translation ("Latin needs no positive proof"), so the member's own words are never searched and `Coverage` reports complete.

F2's fix direction was "keep the member's own question as its own leg when the script is unknown".

Separately, `KnowledgeTools.cs:121` calls `DetectPrimary(query)` at the default floor of 12 (`TextScriptDetector.cs:31`), whereas questions use `minCharacters: 1` (`BusinessSearchScriptPlan.cs:75`). A short Gujarati `query` is labelled `Latn`: it loses its native-digit variant and, via the `seen` dedupe (:174), shadows an identical correctly-labelled `queryInGujarati`.

**Fix direction.** Have the detector return "unknown" rather than Latin, and keep that text as a leg. Use `minCharacters: 1` for the MCP `query`.

**Confidence.** Confirmed by code.

---

### P4-E-21 — LOW — AI-cache failures at the card write are not on the scheduled-retry path

**Evidence**

`KnowledgeIngestProcessorFunction.cs:340` only schedules a backoff for `KnowledgeIngestRetryableException`, which is raised only in the extraction stage (:760-762).

`SearchAiCacheUnavailableException` covers:
- a storage failure
- a lock-wait timeout (`SearchAiCacheWriteLock.cs:115-117`)
- a lease-loss `OperationCanceledException`

All three hit the delivery-count path and abandon immediately (:432), and every redelivery re-runs every embedding. This is the pre-existing index-stage behaviour, now reachable through a NEW dependency.

**Violates.** The intent of R-5/E2.

**Fix direction.** Classify `SearchAiCacheUnavailableException` (and a lost lease) as retryable.

**Confidence.** Confirmed by code.

---

### P4-E-22 — IMPROVEMENT — Two leg caps for one fan-out

`BusinessSearchSettings.cs:206` (`MaxQueryLegs = 3`, used by the plan at `BusinessSearchAgent.cs:124`) and `VoiceKnowledgeSettings.cs:144` (`RetrievalMaxQueryLegs = 3`, used by the service at `:650`) both cap the same Business Search search.

They agree today (API appsettings :2364 and :251). If only the first is raised, the service drops renderings the tool reports under `searchedIn`.

**Fix direction.** One source of truth, or clamp the plan to the service cap.

---

### P4-E-23 — IMPROVEMENT — `IsRightToLeft` fires on any single RTL character

`QuestPdfService.cs:285-301` returns true when ANY line or label `ContainsScript` Arabic or Hebrew. A mostly-English price list with one Arabic dish name is laid out mirrored, with the label column on the right.

`MaterialInfoPdfTests.cs:309-319` treats a partly-Arabic document as Arabic, but only asserts the font, not the direction. Arguably a design choice; confirm with the owner.

**Fix direction.** Decide from the dominant script (`Detect(...)[0]`).

---

### P4-E-24 — IMPROVEMENT — Minor

1. **`contentCjk` inherits the planning floor.** It is written only when `Hani`/`Jpan` is in `card.Scripts` (`KnowledgeSearchIndexer.cs:115`), which needs at least 4 Han characters (`TextScriptDetector.cs:149-152`). "Perm 烫发 $120" gets no bigram field, so the question 烫发多少钱 cannot match it by word.
2. **The digit variant re-appends the WHOLE question.** `ProviderKnowledgeSearchService.cs:1111-1114` appends `EscapeSimpleQuery(native)`, doubling every word's BM25 weight relative to the number. NEEDS-LIVE-PROOF that Azure weights repeated terms.
3. **A zero-card artifact reads back as corrupt.** An image-only document whose last picture is deleted is rewritten with no cards and `Dims = 0` (`SearchAiCacheStore.cs:254`). `TrySplit` then refuses `dims <= 0` (`SearchAiCacheBlobFormat.cs:96`), so every later read counts as a corrupt miss. A read that hits the lock placeholder counts as a miss too.
4. **Knowledge artifacts are outside the I5 nightly reconciliation.** `SearchIndexAuditFunction` has no knowledge reference; the artifact check at :397-406 is services-only. Latent until tooling reads them.

---

## 3. Closure check — original ids in this dimension

| Id | Status | Evidence |
|---|---|---|
| **F1** | **REGRESSED-IN-SPIRIT / PARTIAL** | Built as designed: one leg per rendering (`:486-491`), server-verified (`KnowledgeTools.cs:167-176`), capped (`:650`), concurrent (`Task.WhenAll`, `:491`), per-leg failure reported and never fatal (`:579-602`, `:174-193`), `NotSearchedIn` in the note for FAILED legs (`:1180-1186`). **Cap-dropped renderings are never reported:** P4-E-01 |
| **F2** | PARTIAL | 7 families, CJK precedence and the dense floor are in (`TextScriptDetector.cs:20-28, 44-67, 149-152, 191-202`). Unknown-script leg not built (P4-E-20). Kannada, Malayalam and Odia were never in the list (P4-E-02) |
| **F3** | PARTIAL | Envelope in TOKENS: FIXED (`:906-907`). The factor is ONE per result from the longest passage (`:898, 948-957`), not per card (P4-E-07). No test pins "longest" |
| **F4** | FIXED-AND-VERIFIED-IN-CODE | `:237`, `:915-927`; `KnowledgeTools.cs:104,146`; tests `ProviderKnowledgeSearchMultilingualTests.cs:431,448` |
| **F5** | FIXED for `search_knowledge` | `:204-216`; tests `:349, :376`. Side effects: P4-E-08 (expert check), P4-E-15 (accounting) |
| **F6** | FIXED-AND-VERIFIED up to 500 docIds | `:997-1010`, `:513`; `Provider.cs:236-241`; test `:398`. Re-opens above 500 (P4-E-06) |
| **F7** | FIXED-AND-VERIFIED-IN-CODE | `FuseByRank` k=60, contributions summed (`:613-640`), used by both surfaces (`:195-196`; `Provider.cs:129-132`). A single leg is byte-identical: scores strictly decrease and the sort is stable |
| **F8 / R-10** | FIXED in the rule; BROKEN at the D-1 seam | Rule: `KnowledgeSearchVisibility.cs:70-91` (`NOT IS_DEFINED` first). Repository sweeps (`KnowledgeDocumentRepository.cs:175-199, 305-336`). Cleared in `CommitAsync` (`:3238`). **P4-E-03** (final failure publishes a mixture); P4-E-14 (pictures) |
| **F9** | FIXED-AND-VERIFIED for 12/15 | `PdfFonts.cs:40-69` plus 20 embedded faces. `IsRightToLeft` covers Arabic AND Hebrew, NOT Thai (`QuestPdfService.cs:283`; tests `MaterialInfoPdfTests.cs:243-268`). `ExpectedFamilySuffix` is consistent (`:197-214`, catch-all is Hani/Jpan/Hang only). Gaps outside the detector: P4-E-02. Email: P4-E-17. Docs: P4-E-18 |
| **F10** | FIXED-AND-VERIFIED under the topology | A blank private endpoint builds no cells (`SearchTopology.cs:198-201`), so the route is null (`:93-94`). The validator does not check the endpoint (`SearchTopologyRegistration.cs:108-141`), so the host boots. Search answers Unavailable (`:115-117`; `Provider.cs:46-47`); the indexer refuses in words (`KnowledgeSearchIndexer.cs:55-63`); tests `UnprovisionedSearchStampTests.cs:37-125` |
| **F11 / G-12** | FIXED-AND-VERIFIED | `:1052-1101`; test `ProviderKnowledgeSearchMultilingualTests.cs:275-284` |
| **F11 / G-13** | PARTIAL | Indic, Thai and Arabic-Indic in both directions (`:1103-1115`; test `:301-330`). Persian/Urdu gap: P4-E-11 |
| **F11 / G-14** | FIXED, unpinned | `:553`, `:696`; `Provider.cs:221` (P4-E-19) |
| **F11 / G-15** | NOT-FIXED (the original direction said "acceptable as is; note it") | FAQ edit is still index-first (`KnowledgeManagementService.cs:795-802`); no note was added to the answerable rule |
| **F11 / G-16** | FIXED, unpinned | `:297-315` (P4-E-19) |
| **F11 / G-17** | NOT RE-VERIFIED here (host appsettings are outside this file list) | No orphan knowledge-index keys found in the host appsettings |
| **F11 / G-18** | SUPERSEDED-BY D-26 | Vector not stored (`KnowledgeSearchIndexInitializer.cs:208-209`; test `:150-160`). Stale docs: P4-E-09 |
| **F11 / G-19** | FIXED-AND-VERIFIED | `KnowledgeSearchDocument.cs:38-41, 109-112, 127-131`; test `KnowledgeIndexDefinitionTests.cs:164-186` |
| **F11 / G-20** | PARTIAL | Voice fixed (`:1037-1041`); Business Search not (P4-E-10); no unit pin |
| **F11 / cited test, stale comments** | FIXED | `RetrievalPayloadSizeMeasurementTests.cs` exists; the `imageRef` comment is corrected (`:63-66`) |
| **H1** | PARTIAL | P4-E-01, -02, -04, -07, -11 |
| **B3** | FIXED-AND-VERIFIED (chunker side) | `KnowledgeChunker.cs:19-21` → `KnowledgeTokenEstimate`. Retrieval uses one set-wide factor (P4-E-07) |
| **B1** (post-refactor re-check) | FIXED-AND-VERIFIED | Byte-bounded pages (`KnowledgeSearchIndexer.cs:157-172, 205-218`); 413 splits and is never isolated (`:246-257, 287-290`) |
| **X-01** | FIXED-AND-VERIFIED-IN-CODE (payload + citation + stored turn) | Payload `SearchKnowledgeTool.cs:176`. Citation `:158-159`. Stored `AiSession.cs` `Channel` plus `McpSessionService` `ToStored`/`FromStored`. Rule 9 in the class default and appsettings (`BusinessSearchSettings.cs:125-130`; API appsettings :2340). Tests: `BusinessSearchToolBehaviourTests.cs:341-399`, `BusinessSearchReplayParityTests.cs:212-236`, `BusinessSearchPromptConventionTests` |
| **X-05** | FIXED-AND-VERIFIED-IN-CODE | Refused at the send boundary: `KnowledgeTools.cs:640` `if (string.IsNullOrEmpty(promised.Fingerprint)) { substituted = true; continue; }`. The lenient helper was removed (`KnowledgeMaterialRef.cs:43-47`); a server-resolved neighbour carries no promise (`:632`). Test `KnowledgeToolsTests.cs:510-515` |
| **contentCjk WRITE** | PINNED | Written only when `NeedsCjkTokenisation` (`KnowledgeSearchIndexer.cs:115`; rule `TextScriptDetector.cs:95-102`, `Any`, Han/Kana, not Hangul). Tests `KnowledgeCjkFieldTests.cs:43-99` (Chinese, Japanese, mixed, 7 excluded scripts incl. Korean) |
| **contentCjk READ** | PINNED on both surfaces, every leg | `SearchFields` (`:54-55`) used by voice legs (`:522`), the companion (`:684`) and provider legs (`Provider.cs:199`). Tests `KnowledgeSearchFieldsTests.cs:48-59` (API), `ProviderKnowledgeSearchServiceTests.cs:369-381` (MCP; `Assert.All` over main and companion) |

---

## 4. Verified OK (checked, with file:line)

**Tenancy**
- The scope LEADS every search filter, and `IsScopedTo` checks `StartsWith` on the full quoted clause (`ProviderKnowledgeSearchService.cs:1015-1025`).
- The scope is asserted on voice legs (`:514`), ref reads (`:337`) and provider legs (`Provider.cs:191, 240`). The companion appends to an already-asserted filter (`:680`).
- A foreign row discards the WHOLE set and alarms on every read path: voice (`:758-765`, rethrown at `:584-588`), companion (`:707`), ref read (`:348-355`), provider (`Provider.cs:324-331`, rethrown at `:262-266`). Indexer paging throws (`KnowledgeSearchIndexer.cs:456-461`) but only logs and does not raise the cross-tenant alarm (a minor inconsistency).
- `businessId` is never taken from tool arguments: `KnowledgeTools.cs:78-79, 142, 226` (`context.BusinessId`); `SearchKnowledgeTool.cs:90`.
- The metadata merge re-proves scope by id prefix (`KnowledgeSearchIndexer.cs:505-511`).

**Search topology refactor preserved Phase 3**
- contentCjk write (`:115`) and scripts (`:104-105`).
- `hasEmbedding` is set by both writers (ingest `:1150`, FAQ `:1197`) and filtered on hybrid (`:989-990`).
- Byte-bounded upload and the 413 split.
- Prune-at-or-above with `id asc` paging (`:311-316, 435-469`).
- Artifact durable BEFORE the index write, under a per-document lease linked to `Lost` (`:151-155`).
- Same-process takeover marks the old holder lost (`SearchAiCacheWriteLock.cs:59-67, 176-192`).
- Lease id looked up by blob name for write and delete (`SearchAiCacheStore.cs:270-293, 373-392`).
- A 404 is a miss and a transport failure throws (`:346-365`).
- The artifact carries the FULL card set (`KnowledgeSearchIndexer.cs:182-199`); the image delete rewrites it under the lease before deleting the cards (`:379-386`).
- A multi-business or multi-document batch is refused (`:131-146`).
- The business purge uses the cascade enumeration and sweeps every cell for a purged business (`:329-343`; `SearchTopology.cs:155-172`).

**Deleted-client and vector checks**
- Nothing reads `contentVector` back: production references are the write, validation, byte estimate and vector-query field names only (grep, §2 scope).
- No leftover `KnowledgeSearchClient` in production code or host appsettings; only the three per-host convention tests forbid it.

**Index definition**
- `contentVector` hidden and not stored.
- `contentCjk` has its own analyzer, declared.
- All seven text fields use en.microsoft.
- Synonyms are on the six searched fields only.
- `knowledgeRelevance` text weights are pinned.
- `imageRef` is retrievable only.
- (`KnowledgeIndexDefinitionTests.cs`, all asserts strict `True`/`False`, not `NotEqual(true, …)`, for the vector.)

**Retrieval**
- R-10 SQL puts `NOT IS_DEFINED` first (`KnowledgeSearchVisibility.cs:70-73`), and every sweep projects `cardsRewriting` and `passageCount` from one partition-scoped query (`KnowledgeDocumentRepository.cs:175-199, 305-336`).
- `hasKnowledge` counts ANSWERABLE documents (`FullProviderContextService.cs:180-187, 309`).
- Embeddings are per leg, started together, with a 40% embed share, failing soft to keyword-only (`:142-147, 384-406`). The comment correctly says "N requests, not N waits" (the D-4 fix).
- Gates and embeddings are awaited together (`:155`). Gate faults are captured and rethrown (`:411-422`, `:159`), so none go unobserved.

**Material send**
- Refs carry a fingerprint over the STORED content (`:797`, `KnowledgeMaterialRef.cs:34-41`) and are checked on the live row (`KnowledgeTools.cs:322-340`).
- `GetByRefsAsync` resolves only SENDABLE documents (`:322-331`).
- Neighbour reads are bounded (`MaterialExcerptAssembler.cs:37-52`) under a derived cap.
- The PDF uses the embedded chain (`QuestPdfService.cs:243`).
- Email text nodes are all HTML-encoded (`MaterialInfoEmailRenderer.cs:50`).
- SMS is never a channel (`KnowledgeTools.cs:199-201`); WhatsApp is gated by the approved template (`VoiceMaterialSharingGate.cs:14-18`).
- Send slots are released on `CancellationToken.None` (`:279-287`).

**X-01 shared channel rule and prompt rule 9**
- `KnowledgeSourceChannel.Of` defaults to "generated-overview" for unknown kinds (`KnowledgeSearchModels.cs:89-99`), shared by phone (`:801-802`) and screen.
- Rule 9 is byte-identical in the class default and appsettings.

**Case-insensitive tenant filter vs ordinal row check (by design)**
- The D8 lowercase normaliser makes the filter case-insensitive while row verification is ordinal. A casing mismatch fails CLOSED with an alarm, never a leak. Canonical ids make it moot.
