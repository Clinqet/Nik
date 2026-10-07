# AUDIT-P5B — working ledger (every ID, its state, its guard)

> Live working file for the P5B fix session. Every ID from AUDIT-P5 §2–§12 appears exactly once.
> State: **FIXED** (code in tree) · **REFUTED** (with evidence) · **RESIDUAL** (owner-agreed, cost stated) · **TODO**.
> This file is the source for `findings/AUDIT-P5B-<date>.md` and must be empty of TODO before the session closes.

## Owner rulings taken in this session (2026-09-06)

| # | Ruling |
|---|---|
| Q4 | Answer follows the QUESTION's alphabet; cards stay in the app language |
| K-1 | Tool field set depends on the BUSINESS only; re-measure 25/25 |
| A6 copy | "Your business has asked a lot of questions in the last minute. Please try again shortly." approved |
| A6 wire | `retryAfterSeconds` added now, screens wired in the client batches |
| Q27 | Stall margin + per-tool timeout: leave, record the 150 s worst case |
| A1 | `minimumHours` ADDED to the services index — **written only when a value exists** |
| A2 | All five unapproved columns/field KEPT and registered; the two write-only ones flagged |
| A3 | Deploy override deleted; cache key derives from the prompt itself |
| A4 | §8 schema/feature items recorded as the cross-currency programme's; code-only ones fixed here |
| B | No mockup gate. Web responsive phone→big monitor; mobile app designed for its own flow; brand theme |
| C1–C8, D | All approved |

## Batch 1 — Lane A + prompt caching

| ID | State | What shipped | Guard |
|---|---|---|---|
| A-1 | FIXED | `AppendTo` stores the answer WHOLE; the 4,000 cap moved to replay | `McpSessionServiceTests.AComplete_LongAnswer_IsStoredWhole` |
| A-2 | FIXED | The STORE appends the marker (`McpSessionService.PartialAnswerMarker`); controller no longer concatenates | `ALong_PartialAnswer_KeepsItsMarkerAtTheVeryEnd`, `ACompleteAnswer_CarriesNoMarker` |
| A-3 | FIXED | `ForReplay` strips `\s?\[\d{1,2}\]`, caps at `SessionTurnMaxChars`, keeps the mark | `AReplayedAssistantTurn_CarriesNoStaleCitationMarkers`, `_IsCappedToSessionTurnMaxChars`, `AReplayedAnswerThatWasCutShort_KeepsItsMarkAfterTheCap` |
| A-4 | FIXED | `Partial = wroteAnswer` on the C6 and generic Error frames | `AnErrorAfterWordsHaveStreamed_IsMarkedPartial`, `AnErrorBeforeAnyWord_IsNotMarkedPartial` |
| A-5 | FIXED | `Refund{Business,Member}Async` (atomic patch, floored by `FilterPredicate`); controller refunds on error-with-no-words | integration TODO |
| A-6 | FIXED | Busy check moved BEFORE the charge; own sentence ×5; `RetryAfterSeconds` on the frame | integration TODO |
| A-7 | RESIDUAL | Dropped by §1B — the two existing dials are the levers | — |
| A-8 | FIXED | One timestamp per exchange; `AppendTo` inserts by time | `ALateEarlierExchange_LandsBeforeTheNewerOne` |
| A-9 | TODO | Client (web + mobile batches) | — |
| A-10 | RESIDUAL | ETag carry dropped by §1B — 1 RU/ask accepted | — |
| A-11 | RESIDUAL | Owner Q27: leave; record the 150 s worst case | — |
| K-1 | FIXED | `SchemaScripts` = business alphabets ∪ Latin, canonical; `BuildSchema` reads it | `TheSchemaFields_AreTheBusinessAlphabets_WhateverTheQuestionsAlphabet`, `ALatinOnlyBusiness_AlwaysOffersExactlyTheOneField` |
| K-2 | FIXED | Roster sorted ordinal by name then id before caching | `TheRoster_IsOrderedDeterministically_WhateverOrderSqlReturns`, `TwoMembersWithTheSameName_AreOrderedByTheirId` |
| K-3 | FIXED | Answer-language line moved to the user turn; system-prompt rule 9 re-pointed (both copies) | `TheAnswerLanguageLine_RidesTheUserTurn_NotTheSystemMessage` |
| K-4 | TODO | Live cache hit-rate measurement, before/after | — |
| C-1 | FIXED (early) | `AnswerLanguage` — Gujr→gu, Deva→hi, Latin→app language | `TheAnswerFollowsTheQuestionsAlphabet_AndFallsBackToTheAppForLatin` (4 cases) |
| **N-1** | **FIXED (new)** | Latin is always in the business set — a resolved-but-EMPTY facet used to search the asked script ALONE | `ABusinessWithNoLabelledAlphabets_StillSearchesLatin`, `TheAskedScript_AlwaysGetsALeg_EvenWithNoFieldOfItsOwn`, `AnUnresolvedLookup_SearchesNoLessThanAnEmptyResolvedOne` |
| **N-2** | RECORDED | §1B rule 1's stated bound is ~4x low (4 rounds x 1,500 tokens). Rule unchanged; arithmetic corrected | — |
| **N-3** | **FIXED (new)** | System-prompt rule 9 said "the language named **below**" — invalidated by K-3. Re-pointed to the user turn in appsettings AND the class default | mirror convention test |

### Batch 1 files touched
`clinqetshared/DTOs/AI/AIAssistantDtos.cs` · `clinqetshared/DTOs/BusinessSearch/BusinessSearchDtos.cs` ·
`clinqetshared/Models/BusinessSearchSettings.cs` · `clinqetcore/Interfaces/BusinessSearch/BusinessSearchScriptPlan.cs` ·
`clinqetcore/Interfaces/Services/IBusinessSearchUsageCounter.cs` ·
`clinqetinfrastructure/Services/AI/McpSessionService.cs` · `clinqetinfrastructure/Services/BusinessSearch/BusinessSearchAgent.cs` ·
`clinqetinfrastructure/Services/BusinessSearch/BusinessSearchQueryRenderings.cs` ·
`clinqetinfrastructure/Services/BusinessSearch/BusinessSearchRosterService.cs` ·
`clinqetinfrastructure/Data/COSMOS/BusinessSearchUsageCounterRepository.cs` ·
`clinqetinfrastructure/Resources/Localization/{en,es,fr,gu,hi}.json` ·
`clinqetapi/Clinqet.API/appsettings.json` · `clinqetapi/Clinqet.API/Controllers/BusinessSearch/BusinessSearchController.cs` ·
3 unit-test files.

## Batch 2 — Lane B (tool search)

| ID | State | What shipped | Guard |
|---|---|---|---|
| B-1 | FIXED | `CatalogLookupQuery.MaxResults` threaded through `Normalize`→`Shape`; the tool asks for 25 (voice keeps 5). The plain-Matches branch now carries `totalMatches` + `showing` + a sample note | `AnOrdinaryCatalogueResult_CarriesNoSampleWarning` (rewritten to assert total==shown) |
| B-2 | FIXED | A lost leg is counted and reported in `notSearchedIn`; the answer becomes PartialSearch instead of a silent complete one | TODO — dedicated case |
| B-3 | FIXED | `IBusinessSearchTool.HiddenOnSoloBusiness`; `ListTeamMembersTool` overrides; the agent resolves `IsSolo` BEFORE the offered filter; `Absent` skips solo-hidden tools | TODO — matrix case |
| B-4 | FIXED | `CapPayload` returns `Kept` and corrects `shown`; new `Finish(payload, rowsKey, meta, citations)` used by all ten Group B tools | TODO — 10×850-char case |
| B-5 | FIXED | `Money(decimal?, string?, language)` on `BusinessSearchToolBase`; bookings, quotes, invoices, invoice_totals (4 sites) and offers all pre-render | 3 money tests rewritten to the string contract |
| B-6 | FIXED | `BusinessSearchNames.Safe` in core; roster and team tool share it — an e-mail can never be a name | TODO |
| B-7 | FIXED | `Retrieval:PerLegTimeoutSeconds` (20, dead) → `Retrieval:TimeoutSeconds` (8); the fan-out takes the CALLER's budget, so the phone's 4 s no longer governs the screen | TODO |
| B-11 | FIXED | `TryResolveAsync` tri-state + `BusinessSearchRosterUnavailableException`; the PEOPLE block tells the model when the roster could not be read and withholds the member id | TODO |
| B-12 | FIXED | A substituted asked-script leg is no longer reported as unsearched | `ASubstituted…FallsBackToTheMembersOwnWords` (rewritten) |
| B-13 | FIXED | `BusinessSearchCitationRegistry.TryClaimImage` — one picture, one mint, per ANSWER | TODO |
| B-14 | FIXED | `MatchesNothing` returns before the possessive can overwrite it | TODO |
| B-16 | FIXED | A missing profile row is "not filled in yet", never "try again later" | `ListOffers_WhenTheBusinessHasNoProfileYet_…` + `…WhenTheContextReadThrows_IsUnavailable` |
| B-17 | FIXED | `TimeZoneAssumed` is true whenever the resolved zone is not the stored one | TODO |
| B-19 | FIXED | The breadcrumb lookup is best-effort — a category blip can no longer fail a successful catalogue answer | TODO |
| B-9 | FIXED | Confirm-empty fallback runs approved-only (the two scans now partition); nearest-groups memoized per request | TODO — Moq Times |
| B-10 | FIXED | `CountAsync` + `GetRecentAsync` (both with an optional reachable-id filter); `MatchesNothing` reads nothing at all | TODO — SQL string shape |
| B-8 · B-15 · B-20 · B-21/22/23 · B-24 · B-25 | TODO | | |

### Batch 2 continued (this sitting)

| ID | State | What shipped | Guard |
|---|---|---|---|
| B-24 | FIXED | `ServiceSearchDocument.minimumHours` (`Edm.Double`, retrievable only, **omitted from the uploaded document when there is no value** ⇒ no index storage for a field almost no service sets). `AzureSearchIndexer` writes it only when `Pricing.MinimumHours > 0`; `ProviderCatalogSearchService` selects it, renders it in both price texts, and sets `CatalogPrice.MinimumHours` on the index leg, so the two legs stop disagreeing. **Owner runs `cosmosindexsetup --search-only` in both regions.** | TODO |
| B-8a | FIXED | `ReviewController.CanSeeUnmoderatedReviewsAsync` now asks `Tenant.Has("review.read")` for the same business, replacing `UserNumber == businessId` — 5 chars vs 6, so **nobody, not even the primary owner, could ever see a Pending or Rejected review on their own screen**. The Business Search tool already runs unfiltered, so it now matches the page exactly (owner ruling Q6 option a). | TODO — 3-status page/tool parity |
| B-8b | FIXED | `actingUserNumber` threaded into `PlaceBidAsync` / `UpdateBidAsync` / `AskQuestionAsync` / `WithdrawAndRebidAsync` (interface, service, controller passes `Tenant?.UserNumber`); the self-bid guard compares the acting **person** with the broadcast's poster (owner ruling Q7). | `PlaceBidAsync_WhenTheActingPersonIsTheCustomerWhoPostedIt_…` + `…WhenTheBusinessIdIsPassedWhereThePersonBelongs_RefusesNobody` |
| B-15 | FIXED | `ResolvedGroup.Ignored` → `CatalogLookupResult.GroupIgnored`; `SearchServicesTool` echoes `filter = { group, minPrice, maxPrice, groupIgnored }` on all three payload branches and carries `BusinessSearchToolNotes.GroupNotRecognised` when the category did not resolve. | TODO — unknown-group case |
| N-4 | FIXED (new, not in the audit) | `ModelFacingJson` now omits null properties. Every tool result on the ordinary path was shipping `"note":null,"totalMatches":null,"notSearchedIn":null,"currencyNote":null,"allTimeOtherCurrencies":null,"otherCurrencies":null` — paid for on **every tool call of every answer**, carrying no information an absent key does not. | `InvoiceTotals_SaysNothingAboutOtherCurrenciesWhenThereAreNone` (rewritten: absent, not present-and-null) |
| N-5 | FIXED (new, not in the audit) | `NoCodeResolvesAPersonFromABusinessIdTests` **certified the B-8b defect as correct code**. Its lookbehind exempted any *prefixed* field name on the written claim that `BroadcastProvider.broadcastUserNumber` "genuinely HOLDS a businessId" — it does not; it is set from `broadcast.UserNumber`, the posting customer's five-character number. The lookbehind is gone, the pinned assertion inverted, and the scan now catches every `XxxUserNumber == businessId` shape. Verified no other production site matches. | `TheRule_CatchesAPrefixedFieldName_NotJustTheBareWord` |
| N-6 | FIXED (new, not in the audit) | `PlaceBidAsync_SelfBid_ThrowsInvalidOperation` was **vacuously green**: it assigned `provider.BroadcastUserNumber = TestBusinessId`, a state production can never produce, and asserted the throw. Rewritten to the reachable shape. | (the two tests above) |

### ‼️ SESSION HALTED 2026-09-06 — another session is working in `C:\Nik`

Stopped under the owner's standing rule *"never build or test while another session is working in C:\Nik"*.
Evidence, gathered before stopping:

| Signal | Detail |
|---|---|
| Backend HEADs moved mid-session | `clinqetshared` a43d9f0 · `clinqetcore` 8c28a13 · `clinqetinfrastructure` 54be612 · `clinqetapi` 3fc71e5 — all *"search bug fixed"*, all 2026-09-06 10:23. My Batch 1 + most of Batch 2 is **inside those commits**; my work is intact (`PartialAnswerMarker`, `HiddenOnSoloBusiness`, `TryClaimImage`, `MaxResults` all still present) |
| Live edits I did not make | `McpSessionService.AppendTurnsAsync` gained an `expectedTurns` compare-and-set parameter in the WORKING TREE (not in HEAD) — and `McpSessionServiceTests.cs` does not compile against it, so that edit is **mid-flight right now** |
| A new file, minutes old | `Services/BusinessSearch/BusinessSearchConversationPolicy.cs`, written 10:52, untracked, referencing a `BusinessSearchConversationDto` that does not exist in my tree |
| Unrelated infra edits | `KnowledgeDocumentParser.OpenXml.cs`, `KnowledgeDocumentParser.Pptx.cs`, `KnowledgeOoxmlText.cs` — knowledge extraction, nothing I touched |
| ‼️ The two UI repos I was about to enter | `clinqetwebpartnerapp` **29 uncommitted files** and `clinqetmobilepartnerapp` **11** — I have changed ZERO in either. They include `BusinessSearchPage.jsx`, `AskBox.jsx`, `useBusinessSearch.js/ts`, `businessSearchService.js/ts`, `sseStream.ts`, all five language files in BOTH apps, and a new `ConversationExchange.jsx` — i.e. **the same §6 conversation UI this phase is queued to build** |

**Why this had to stop rather than continue:** the last two red runs were their compile errors, not mine, so no green from this tree can be trusted; and §6 would have had me editing the very files they have open, with §0.19 forbidding either of us a git restore.

### Resumed 2026-09-06 — the UI session stopped; its work kept, its loose ends closed

Its web + mobile work is committed (`807adaa6` / `6e2bdb24`, "more UI improvements"). Its **backend** half was
left mid-flight and blocked every test in `Clinqet.API.UnitTests` from even compiling. Nothing of theirs was
reverted or deleted; three loose ends were finished so the assembly builds and the contract is honest:

| Their change | What was left open | Closed by |
|---|---|---|
| `AppendTurnsAsync(..., int expectedTurns, ...)` — a compare-and-set on the turn count | 9 test call sites did not compile ⇒ **the whole unit-test assembly was unbuildable** | `expectedTurns` threaded into each call site with the value that call's fixture actually holds |
| The CAS retry loop removed on purpose (*"a competing exchange changes the prompt context; retrying would save an answer to stale history"*) | `AppendTurns_OnConflict_RereadsAndRetries` still demanded 2 attempts | Renamed to `…_DoesNotReapplyOntoHistoryTheMemberNeverSaw`, asserting one attempt — their stated reason, pinned |
| The store-side trim removed (a 50-turn conversation must persist all 50) | `AppendTurns_TrimsToTheFollowUpWindow` demanded 4 turns; the code comment still claimed "Trim keeps FollowUpTurns x 2" | Test renamed to `…_KeepsEveryTurn_BecauseTheMemberCanScrollTheConversationBack` (6 turns); comment corrected. `FollowUpTurns` is now solely the AGENT's replay window (`BusinessSearchAgent.cs:548`) — verified, not assumed |
| `BusinessSearch_Error_ConversationChanged` + `_ConversationFull` resolved by the controller | **Missing from all five language files** (§0.10) — a provider would have read the raw key | Both added to en/es/fr/gu/hi; every file re-parsed as valid JSON |

**N-4 completed.** `DefaultIgnoreCondition` governs object PROPERTIES only — a null **dictionary value** is still
written, and most Group B payloads are dictionaries, so the first cut of N-4 missed them. A `SkipNullValues`
converter on `ModelFacingJson` now covers both shapes in one place. Four tests that asserted
*present-and-null* were rewritten to assert *absent* — one of them, `ASuppressedBenchmark_IsAbsent_NotReportedAsZero`,
had been claiming absence in its name while pinning presence.

**575 / 575 green** (Business Search + session).

### Batch 2 close-out + first §6 rows

| ID | State | What shipped | Guard |
|---|---|---|---|
| B-21 | FIXED | `HasTextAsync` memoized per document on the Scoped tool — the ANSWER is cached, never the task, so a first caller that cancels cannot poison it for everyone behind. Plus: the document reads and the full-text checks are independent and were awaited one after the other; they now overlap | TODO |
| B-22 (reads) | FIXED | A document row is point-read only when it can still say something — a picture, a title the card lacks, or a file name the page rule needs. A card carrying all three was being read for nothing | TODO |
| B-22 (inbox) | **RESIDUAL, deliberate** | Caching the inbox projection per business would let the tool answer "3 unassigned" when a 4th arrived 10 seconds ago. The tool's whole value is a truthful number, and the owner's rule is that cost never comes out of the result. Cost stated: one projection over open conversations per call — the same the Inbox page pays per load | — |
| B-23 | FIXED | Single-flight on `GetPartnerContextAsync`: N concurrent cold callers built the whole context N times (a COUNT plus up to ten reads, the entire Service partition among them) to produce the identical object. The shared build is untied to any one caller's token; each caller waits on its own | TODO |
| B-25 | FIXED | `BusinessSearchCitationDto.Published` (sent only when false), set by `SearchServicesTool`; a "Not published" mark on the web AND phone card; keys ×10 | web `SourceCard.grouping.test.jsx` (2 cases) + mobile `businessSearchSourceCardParity` |
| U-1 | FIXED | The words a source gave the answer were drawn only for a document with TWO OR MORE parts — so one-part documents and **every typed FAQ answer** shipped a card with no evidence on it. Web + phone | 4 web render cases + 1 mobile parity case |
| U-20 | FIXED | The document line took the FIRST part's page/subtitle: a page only some parts share headlined the document, and one they all share printed twice. Now the shared value on the line, part meta only when it differs. Web + phone | 2 web render cases + 1 mobile parity case |

**Two regressions the stopped UI session left committed, both now green:**

| Where | What was wrong | Closed by |
|---|---|---|
| `AskBox.test.jsx` | The ask box became a growing `<textarea>` for the transcript; the test still queried `input` and got null | Test points at the textarea |
| `BusinessSearchPage.rating.test.jsx` | ‼️ **A rating survived a workspace switch** — the guard was red. The rating moved onto the exchange, and the hook (which the page test mocks) is what empties the transcript, so the page test could no longer prove it | Page test pins the visible end (no rating survives); new `useBusinessSearch.workspace.test.js` pins the real guarantee — the transcript empties on a business AND on a membership change |

### Lane C + B-20 — one currency table

| ID | State | What shipped | Guard |
|---|---|---|---|
| C-2 | FIXED | `BusinessSearch_NoAccessToTopic` ×5 reworded to the approved sheet: the "Ask the business owner" clause M5 §03 bans is gone | `BusinessSearchConventionTests` (all five files) |
| C-5 | FIXED | The PEOPLE block now tells the model: a name fitting MORE THAN ONE colleague means ask which, naming both — never pick one. It only knew "matches nobody" | TODO — 10-probe measurement |
| B-20 | FIXED | ‼️ **Two country→currency tables became one.** `CountryResolutionService` carried its own hardcoded 19-row copy, so a country added to `Discovery:CountryCurrencyMap` was still unknown to it. New `DiscoverySettings.TryResolveCurrency` keeps the two callers' intents distinct: a search may fall back to the default, a BUSINESS's currency stays **empty** rather than silently becoming USD | `CountryResolutionServiceTests` (192 currency tests green) |
| B-20 (AE) | FIXED | ‼️ `"AE": "AED"` sat in three maps and **AED is not a `CurrencyCode`** — `CurrencyMinorUnit.Parse` falls back to USD, so a UAE business's prices would have printed with a **dollar sign**. Row removed from all three appsettings | New `CountryCurrencyMapParsesTests` — every map value, and the default, must parse |
| B-20 (parse) | FIXED | Five copies of one parse rule collapsed onto `CurrencyMinorUnit.TryParse`. **Three of them omitted `Enum.IsDefined`**, so a numeric string became whatever enum member sat at that index — `"7"` ⇒ CNY. `InvoiceMappingExtensions` read that from a **gateway payload**, then derived the tax and total from the wrong currency's minor units | full suite |

**Two defects the filtered runs were hiding** — found only by running the whole suite:

- **`MoneyNeverFormattedFromTheReadersCultureTests`** flagged my B-5 helper's unknown-currency fallback. Both it and `BusinessSearchMoney` had the same `"N2"` line; the guard caught one and missed the other purely because of the local variable's NAME (`amount` vs `value`). Both now call one `CurrencyMinorUnit.FormatUnknownCurrency`, with the two-decimal convention stated as a convention rather than left looking like a currency's minor units.
- **‼️ My own B-22 was wrong, and a shipped test proved it.** The audit's premise was "the card already carries title/name". It carries a name, but the card's copy comes from the **index** and can be stale; `ShowablePage` branches on the file EXTENSION and the row is authoritative. `SearchKnowledge_AWordDocument_CitesNoPage` went red — a Word document started citing page 1. The skip is now narrowed to cards that can show no page, which is a smaller saving and the correct one.

**11,710 / 11,710 API unit tests green** (full suite, no filter).

### §5 backend — D-1 … D-4

| ID | State | What shipped | Guard |
|---|---|---|---|
| D-1 | FIXED | ‼️ `deploy.ps1` stamped the literal **`"v1"`** over `TranscribePromptVersion` on BOTH hosts while the code shipped `"2"` — every deployed stamp composed the OCR page-cache key as **`vv1`** and would have served pages transcribed by the OLD prompt forever, silently (a miss is a debug line and a fallback). Fixed at the root: the key now carries `VisionTranscriptionSettings.PromptFingerprint` — the version **plus a SHA-256 of the prompt TEMPLATE** — so editing the prompt moves the key whether or not anyone remembers to bump anything. Deploy override, both host stamps and both manifest rows deleted; `deploy.ps1` re-parsed clean. **SHA-256, never `GetHashCode`** (randomized per process ⇒ reader and writer would disagree after every restart) | New `OcrPageCacheKeyTests` — 4 cases incl. the pinned fingerprint and a cross-host template-parity check that Skips when the peer repo is absent |
| D-16 | FIXED | The Functions paste block omitted `Voice__Knowledge__Vision__TranscribeDeploymentName`, which IS applied to the Function App — so a developer's local host composed the cache key from a different deployment than the deployed one | deploy.ps1 parse |
| D-2 | FIXED | ‼️ The rate-limiter reaper re-derived each bucket's window from a fixed endpoint switch and **skipped any bucket whose prefix was not in it** — so `business-search-feedback:{membershipId}` buckets were invisible to it: **one per rating member, in a singleton, forever.** The bucket was already handed its window and threw it away; it keeps it now | New `AiRateLimitingServiceReaperTests` — 4 cases incl. 50 members reaped and a known endpoint unchanged |
| D-3 | FIXED | Three conditional writes in `KnowledgeDocumentRepository` (create, replace, delete) ran inside the transient-retry policy. A write that COMMITTED before its response was lost is replayed, the replay's 409/412/404 is read as a conflict, and the caller treats its own success as a failure — `ReprocessAsync` never enqueues (row stuck Processing, no alert), `UpdateDetailsAsync` skips its MetadataOnly enqueue (row and cards disagree forever). Same rule as `AiSessionRepository`: the CAS loop IS the retry | full suite |
| D-3 (class) | **REPORTED, owner's call** | The same wrap is on conditional writes in **ten other repositories**: Cart, KnowledgeServiceDraft, ProviderInvoicePaymentSettings, RecentlyViewed, UserRecommendation, VoiceBusinessLiveCall, VoiceCallSession, Voiceline, WhatsAppAlias, WhatsAppContact. Not touched — changing the concurrency semantics of ten features I have not audited is a bigger risk than the defect, and each needs its caller's CAS loop checked | — |
| D-4 | FIXED | ‼️ `IBusinessAlphabetService.Invalidate` had **zero callers**, and the SKILL claimed invalidation existed. The alphabet set decides which scripts a question is searched in and is cached, so the **first Gujarati FAQ answered "nothing found" in Gujarati** until the cache happened to expire. All five API mutations now invalidate — and only on success | 8 new cases in `KnowledgeControllerTests`: five mutations invalidate, three refusals invalidate nothing |

### §5 backend — D-5 … D-20 (first pass)

| ID | State | What shipped | Guard |
|---|---|---|---|
| D-5 | FIXED | The language is resolved BEFORE the validation refusal, so a dictated 600-character question (dictation bypasses the field's own maxLength) is refused in the app's language rather than the browser's. A lone annotation failure becomes the TOP-LEVEL message, because neither client renders `errors[]` | full suite |
| D-6 | FIXED | `KnowledgeAudienceDecision` now carries the rule's OWN parsed audience. The controller re-parsed the same word with a bare `Enum.TryParse` — no `IsDefined` — so a numeric value the rule had already refused as unrecognised came back as a real audience. `Decide` gained `IsDefined` too | full suite |
| D-8 | **REFUTED** | The audit says "no production caller — delete". It has **25 callers** across the Functions integration suite, which uses it to seed rows in the emulator. Deleting it breaks a peer repo to satisfy a claim that is false. Kept, with the contract stated on the interface: seeding only, never production — a blind upsert has no ETag and overwrites whatever another writer just committed | — |
| D-9 | FIXED | New `DuplicateItemException : InvalidOperationException`, thrown at the 409 map in `CosmosDbRepository.AddItemAsync`. The rating endpoint caught the bare `InvalidOperationException`, so **any other invalid operation inside the write would have been reported to the member as a success that never happened** | 2 tests narrowed to the typed exception |
| D-10 | FIXED | Four model-facing serialize sites used the default HTML-safe encoder, so a Gujarati or Hindi tool-schema description arrived as `\uXXXX` — several times the tokens, on every request, for text the model then has to decode | full suite |
| D-16 | FIXED | (with D-1 above) | deploy.ps1 parse |
| D-18 | FIXED | `LocalStartWall` / `LocalEndWallInclusive` / `EndUtcInclusive` deleted — no production caller read any of them. The wall-clock-versus-UTC hazard their comment documented is kept on the record itself, where it governs the fields that ARE read | test rewritten to pin `LocalFrom`/`LocalTo`, which is what the tools actually filter on |
| D-20 | FIXED | `Notification_KnowledgeServiceDraftsReady_Body_One` ×5; one draft used to produce "found 1 services" | key presence ×5 |

**‼️ One of my own changes over-reached, and the suite caught it.** D-5's promotion of a lone validation
error to the top-level message was first put on the SHARED `ValidationFailed()` — five billing tests went red,
correctly: that is a response-shape change for **every controller on the platform**, and D-5 asked for it on
one endpoint. It is now a separate `ValidationFailed(language)` overload that only the endpoints opting in
call. The five billing tests needed no edit once the change was confined to where it belonged.

**11,726 / 11,726 API unit tests green.**

### §5 backend — D-7, D-11, D-12, D-13, D-14, D-15 (§5 complete except D-17 docs and D-19 owner)

| ID | State | What shipped | Guard |
|---|---|---|---|
| D-7 | FIXED | A duplicate-upload donor the provider **deleted while the file was being read** was still donating its name and audience to the surviving twin — applying the very choice the provider made by deleting it. A `Deleting` donor now merges nothing, raises nothing, and is still torn down | New `DuplicateUploadDonorTests` ×3 (source scan; the merge path needs the emulator to drive end to end) |
| D-11 | FIXED | `BusinessSearch:Limits:FeedbackPerMemberPerDay` (30). Each not-helpful report writes a durable 90-day admin row carrying the question and answer verbatim; uncapped, one member could file thousands of rows of arbitrary text a day. Read-then-increment on the SAME `AiUsageCounter` family, own id segment `bsearchfbm_` — no new document family, no schema | sentence ×5; full suite |
| D-12 | FIXED | An **unresolved** alphabet set was cached for nothing, so a business whose facet was failing re-issued two index queries on **every call**. Now held for `UnresolvedCacheSeconds` (60) — seconds, never the full 30 minutes, because pinning a failure that long would search one alphabet for a business that writes in three. `prepare` also gained the ask path's per-member burst bucket on its own key | 2 rewritten alphabet cases pinning BOTH halves |
| D-13 | FIXED | One `PeriodicTimer` for the whole stream, replacing a linked CTS + `Task.Delay` + `WhenAny` built for **every awaited frame** — hundreds per answer, to send a keep-alive that fires a handful of times | full suite |
| D-14 | FIXED | `Voice:Catalog:MaxLookupsPerCall` deleted from the API (only the MCP host reads it). New `VoiceCatalogSettingsConventionTests`: every shipped key names an API-reachable reader, and every divergence from the class default is a written decision. **The guard found two the audit had not listed** — `EmbedThreshold` (a real reader, my registry was incomplete) and an undeclared `LookupSlowWarnMs` 1500 vs 2500 | 3 cases |
| D-15 | FIXED | ‼️ **The most dangerous one.** The .NET binder APPENDS array elements onto a non-empty class default instead of replacing them, so every container's effective allow-list was `class default ∪ configured` — and **`LicenseDocuments` silently also accepted `.mp4 .mov .avi .wmv .flv .m4v`**. A licence document container took video | New `MediaAllowListsAreNotAppendedTests` ×5, which BIND the real appsettings through a real `ConfigurationBuilder` — asserting the JSON alone could never see an append |

**‼️ The audit's prescribed fix for D-15 was dangerous as written.** "Give the collections empty class defaults"
alone would have turned a fail-OPEN hole into a worse one: `StorageManagerService` guarded its extension and
MIME checks with `.Any()`, so an **empty list meant ALLOW EVERYTHING** there — the one fail-open reader of the
four (MCP, auth and remote-ingestion all refuse on empty). It was unreachable while the defaults were
non-empty, and would have become live at exactly the moment the defaults were emptied. Three changes had to
land together: empty defaults, an empty list REFUSES, and a boot-time failure so a container that loses its
appsettings block is caught at deploy rather than by a provider whose upload stopped working.

**11,742 / 11,742 API unit · 3,971 / 3,971 Functions unit — all green.**

### §6 web + mobile — first pass

| ID | State | What shipped | Guard |
|---|---|---|---|
| U-1 | FIXED (earlier) | Single-part and FAQ cards draw their words | 4 web + 1 mobile |
| U-12 | FIXED | `dictation.enabled` was DELIVERED by AppConfig and read by nobody on **either** app. With dictation off the mic was still drawn, and pressing it got a 400 rendered as "Voice isn't available… Try again" — forever, because trying again cannot switch a feature on. Not drawn at all, on web and phone | mobile `dictationNeverSends` |
| U-13 | FIXED | The BYTE cap was delivered and read by nobody, so an oversize clip was sent, refused with a 413, and "Try again" **re-sent the very bytes the server had just refused**. The clip is uncompressed PCM at fixed options, so the byte cap is deterministically a number of seconds: the recorder now stops at whichever cap binds first, **before an oversize byte exists**. `canRetry` narrowed to Failed only, matching web | 3 mobile cases |
| U-7 · U-9 | FIXED | A daily or burst limit, and an offline failure, were drawn RED on the phone where web draws amber (M7 §04 "amber, never red"). A boundary the member passes in a minute now reads as one | — |
| U-8 | FIXED | A source that could not load for want of a CONNECTION was red on the phone — "this page can't be shown" sends the member looking for a fault in their own document. Amber, using the offline copy **both apps already had**; `offline` threaded through the exchange component as web does | — |
| U-20 | FIXED (earlier) | The document line carries only what the parts share | 2 web + 1 mobile |
| U-21 | FIXED | The header panel offered a DIFFERENT set of suggestions to the same member than the page did — no bookings chips at all, from the surface most members open first | — |
| U-24 | **ALREADY FIXED** by the stopped session — real `keyboardDidShow`/`keyboardDidHide` listeners replaced the focus-based derivation. Verified, not assumed | — |
| U-31 | FIXED | Recording was drawn in ALARM RED, so a working microphone looked like a fault every time a member dictated; near-cap was red too. Brand green for recording (the chosen action), amber for nearing the cap | — |
| U-25 | RESIDUAL | Lane stacking below 768 vs the sheet's <1024 — folded into the responsive pass rather than changed piecemeal | — |

**‼️ One mobile suite is red and it is NOT mine.** `__tests__/businessSearchConversation.test.jsx` is
**untracked** — the stopped session's work in progress. It cannot parse: this repo's jest has no `.jsx`
transform and every other test here is `.ts`/`.tsx`, so it fails with *"Cannot use import statement outside a
module"* before a single case runs. **Left untouched** (owner: do not delete its work). The fix is theirs and
is one rename to `.tsx`.

**Green: 11,742 API unit · 3,971 Functions unit · 3,013 web jest · 3,898 mobile jest (236/236 suites,
excluding that one untracked file) · 0 ESLint errors · `tsc` clean.**

### §6 — second pass

| ID | State | What shipped | Guard |
|---|---|---|---|
| U-25 | FIXED | The lanes split at **768** while the dashboard rail hides below **1024** — so every iPad in portrait had no rail AND two columns, squeezing both lists into half a narrow screen. They now stack wherever the rail is gone | New layout case; sabotage = restore `md:grid-cols-2` → red |
| U-19 | FIXED | The sources header counted CITATIONS, so one document quoted four times read "Sources 4" above a single card. It counts cards. Web + phone. (The audit's per-kind wording — "1 document / 2 answers" — needs new copy and owner approval; recorded as a residual) | — |
| U-18 | FIXED | `SOURCE_PARTS_VISIBLE` 3 → **4**, matching the frames M9 #01 and #13 draw: at three, the fourth part of a four-part document rolled up in **every drawn example**. Web + phone, and the shared-rules parity suite proves the two agree | roll-up case updated (8, not 9) |
| U-10 | FIXED | Every refusal sentence says "try again" and there was **nothing to press** — the box had already been emptied, so following the instruction meant retyping the question. A Try again now appears when it can actually succeed: not while a ceiling counts down, not offline, not mid-answer | — |
| U-7 · U-9 (web) | FIXED | ‼️ **The stopped session's rewrite had regressed this on WEB too** — every error was drawn red, including a daily ceiling and an offline failure. The audit recorded web as correct; it no longer was. Amber for a boundary, red for a breakage, on both apps | — |

**Green after the second pass: 3,014 web jest (222 suites) · 3,903 mobile jest (237 suites) · 0 ESLint
errors · `tsc` clean.**

### ‼️ HALTED AGAIN 2026-09-06 ~20:50 — the UI session is writing again

| Evidence | Time |
|---|---|
| `clinqetwebpartnerapp/e2e/tests/dashboard/conversation-interactions.spec.js` — new, untracked | written **20:47** |
| `clinqetmobilepartnerapp/__tests__/businessSearchConversation.test.js` — the `.jsx` file they left unparseable, now **renamed to `.js` and rewritten** | written **20:48** |
| My last edit | 20:40 |

Also uncommitted and not mine, from their earlier stretch: web `useBusinessSearch.js`, `useBusinessServices.js`,
`anchoredPanel.js`, `businessSearchService.js`, `sourceGrouping.test.js`, `dashboardShellHeight.test.js`,
`useBusinessSearch.conversation.test.js`; mobile `businessSearchService.ts`, `recentQuestions.ts` and five
`__tests__` files.

**The green results below were taken BEFORE 20:47 and are accurate as of then.** I stopped editing rather than
keep running whole-repo suites against a tree changing underneath them — a green from a moving tree proves
nothing, and the last time this happened their compile errors were reported to me as my own failures.

Nothing of theirs was touched: the `.jsx` file I could not parse was left exactly where it was, and they have
since fixed it themselves.

### D-19 — RULED: APPROVED (owner, 2026-09-06)

The four `ProviderConnectedAccount` columns (`GatewayProductId`, `UnlinkedGatewayAccountId`,
`OnboardingBlockedCode`, `OnboardingBlockedAt`) and the Cosmos field `VoiceCallSession.customerMemberId` are
**owner-approved**. The audit's "no approval on record" line was about the written record, not the fact.
Closed — not to be raised again.

### Working method from here (owner, 2026-09-06)

The other session runs concurrently and does not remove my work. A build or test failure in a file I did not
write is **not a reason to stop**: filter runs to what I touched, note foreign breakage, keep going, and do
one full sweep at the end.

### §6 — third pass

| ID | State | What shipped | Guard |
|---|---|---|---|
| U-36 | FIXED | Two defects pulling opposite ways. `IntlProvider` got the BARE language, so `Intl` grouped French with a narrow no-break space where fr-CA — and the phone, the backend and every catalogue — uses a normal one. It now gets the product tag. ‼️ **But the API is not a formatter**: `LookupRepository` lower-cases what it is given and never splits on the dash, so `GetCodedesc("country", "en-US")` matches nothing and the country dropdown comes back **empty, in every language**. Six live call sites now use `toApiLanguage`. ‼️ **And Spanish was missing from the messages map entirely** while the language list comes from the server and can offer it — selecting it rendered every string on the app as its raw key | New `apiLanguageIsBare.test.js` — 10 cases, including a scan that fails if any server call reaches for the formatting locale |
| U-36 (one revert) | — | `GetRazorpayTaxonomy` normalises the tag ITSELF before calling `GetCodedesc`, so its caller passes the raw locale on purpose. My first pass "fixed" it and broke its own test; reverted, and the guard now says why it is exempt | its existing locale suite |
| U-16 | FIXED (web) | `useInvoiceEarnings` reports `error` and **nobody consumed it** — a failed read printed a confident "₹0.00", so a provider could reasonably conclude they had earned nothing this week. Now an em dash, a sentence and a retry; the chart draws no zero series either. Key ×5 | — |
| U-17 | FIXED | The phone's invoice heading took the CONTEXT currency, which is **empty for a technician**, so it fell through to whichever currency the first row happened to carry — a Canadian-dollar heading over a list totalled in rupees. The response's own currency leads | 23 invoice-due cases still green |
| U-22 | FIXED | The chip build and its Set allocation ran on **every render of the global header** to produce suggestions nobody could see. Memoized and gated on `open` — using `intl`, not the per-render `t`, or the memo would recompute anyway. (The service fetch behind it was already gated; the work in front of it was not) | 75 Business Search cases |
| U-23 (feedback) | FIXED | ‼️ Every tap of Not helpful re-POSTed. The server refuses the duplicate and the client swallows it, so it looked free — but **now that D-11 added a daily feedback ceiling, each tap spends a unit of the member's own allowance** on a row that will never be written. One report per exchange | New case: three taps, one call |

**Green: 3,026 web jest (223 suites) · 0 ESLint errors · mobile `tsc` clean · invoice suites green.**

### §7.3 — SABOTAGE RUNS: 13 of 13 proven red

Each fix's defect was re-introduced and the guard confirmed to FAIL. Every file was snapshotted by COPY into
the session scratchpad and restored by copy — **never `git checkout`/`restore`** (§0.19). Verified afterwards:
zero `.orig` files in any repository, and the reaper's fixed line back in place.

| # | Defect re-introduced | Result |
|---|---|---|
| S1 | The reaper's endpoint-prefix lookup (custom buckets immortal) | **3 of 4 red** |
| S2 | The prompt template dropped from the OCR cache key | **2 of 8 red** |
| S3 | A non-empty media allow-list class default (the binder appends) | **4 of 5 red** — including the licence-takes-video case |
| S4 | One of the five alphabet invalidations removed | **1 red** |
| S5 | The transient retry back on the conditional replace | ‼️ **GREEN — no guard existed.** Written (3 new cases), re-run: **1 red** |
| S6 | The card's words back behind `grouped` | **3 red** |
| S7 | The lane breakpoint back to `md` | **1 red** |
| S8 | The rating re-POSTing on every tap | **1 red** |
| S9 | The formatting locale sent to the server again | **1 red** |
| S10 | Only the seconds cap honoured (oversize clip sent) | **1 red** |
| S11 | The draft mark removed from the phone card | **1 red** |
| S12 | The lookbehind back in the person-from-businessId scan | **1 red** |
| S13 | `groupIgnored` hard-coded false | ‼️ **GREEN — no guard existed.** Written (3 new cases), re-run: **1 red** |

**‼️ The sabotage run earned its place twice.** Two fixes — D-3's conditional writes and B-15's ignored group
— had NO guard at all, and both suites were green while the defect was fully re-introduced. Without this
step I would have reported them as protected. Six new cases now cover them.

### Measurements — run live 2026-09-06 (CA + IN sandbox)

**B-24 — the field, proven end to end.** A throwaway index `p5b-minimumhours-probe` was created on the live CA
search service, two documents uploaded, read back, and the index **deleted** (verified 204):

| Step | Result |
|---|---|
| Document carrying `minimumHours: 2` | round-tripped as **2** |
| Document omitting the field entirely | round-tripped as **null** — nothing stored |
| Throwaway index deleted | **yes** |

‼️ **The probe also caught a trap worth recording.** My hand-written REST index definition allowed a `$filter`
on the field, because **the REST API defaults `filterable`/`sortable`/`facetable` to TRUE when omitted, while
the .NET `[SimpleField]` attribute defaults them to FALSE.** `cosmosindexsetup` builds this index from the
attributes via `FieldBuilder`, so the real shape is the attribute's. Pinned by
`ServiceIndexMinimumHoursFieldTests` (5 cases), which asserts against `FieldBuilder`'s actual output and
contrasts it with the neighbouring price fields, which ARE filterable — so it proves a real difference rather
than a default that happens to apply to everything.

**N-1 — the premise, measured.** The `scripts` facet answers 200 (so the field IS facetable) with **ZERO
buckets** on both stamps:

| Stamp | Knowledge documents | `scripts` buckets |
|---|---|---|
| CA | **744** | **0** |
| IN | **99** | **0** |

So the alphabet lookup succeeds and returns an EMPTY set for every business alive today. Before K-1/N-1, the
plan then searched the **asked script alone** — meaning a Gujarati or Hindi question never touched any of
those 744 English documents, and answered "nothing found" about a document that was sitting right there. A
*failed* lookup behaved better than a successful one.

**B-7 — retrieval latency, live CA knowledge index (744 documents, 30 samples each).**

| Shape | P50 | P95 | max |
|---|---|---|---|
| One leg | **66 ms** | **83 ms** | 658 ms (first-call warm-up) |
| Three legs, concurrent | **115 ms** | **144 ms** | 149 ms |

The screen's own budget is 8 s — **56× the P95 fan-out**. So the 8-second default is not a number that will
bite a healthy stamp; it exists for a degraded one, which is what B-7 asked for. The old dead dial was 20 s.

**Not run, and why.** `cosmosindexsetup/appsettings.{ca,in}.json` carries Cosmos and AI Search credentials
only — **no Azure OpenAI key**. So the four AI-dependent probes (K-4 prompt-cache hit rate, A-3's ten-follow-up
stale-citation run, C-1/C-7 Gujarati/Hindi answer probes, C-4's 24-question two-alphabet run) cannot be run
from here. C-4 is additionally **unrunnable by construction**: the table above shows no business anywhere has
a second alphabet labelled, so there is no two-alphabet business to ask 24 questions of. Recorded as owed,
with the reason — not estimated.

---

## 14. SELF-AUDIT OF THE P5B CHANGES (2026-09-07) — 3 defects of my own, all fixed

The owner required a multi-dimensional audit of this phase's own code. It found three real defects that the
phase had introduced, two of them shipped with no guard. Every one is fixed, guarded and sabotage-proved.

### 14.1 ‼️ B-19's cost narrowing was applied to the SHARED Cosmos call, not to the fallback

`ProviderCatalogSearchService.LookupAsync` composes `result ??= await LookupViaCosmosAsync(...)` OUTSIDE the
`if (source == Index && IndexAvailable)` block. That line is therefore **not only** the index leg's
confirm-empty fallback — it is also the whole of a Cosmos-SOURCE lookup. Narrowing it to
`IncludeUnapproved = false, UnapprovedOnly = false` hit every caller:

| Stamp | What actually happened |
|---|---|
| No search index | `SearchServicesTool` runs ONE leg, `unapprovedOnly: false`, relying on `IncludeUnapproved` for both populations ⇒ **the provider's own team could not see a single pending offering** in Ask Clinket |
| With a search index | The DEDICATED unapproved leg (`unapprovedOnly: true`) had its scope forced to false ⇒ **the unapproved rows were never fetched at all**, and both legs scanned approved rows — losing the population AND keeping the overlap the narrowing existed to remove |

Fixed by narrowing a local `cosmosQuery` **inside** the index-leg branch, so the fallback is approved-only and
a Cosmos-source lookup keeps the caller's scope. The 30 RU → partitioned-scan win is unchanged.

‼️ **Only a FULL suite run caught it.** `ProviderCatalogSearchServiceTests.PartnerScope_MaySeeUnapproved_…`
was red, and my filtered runs never selected that class. This is the second time in this phase that a filtered
run hid a failure. Two guards added — `ACosmosSourceLookup_KeepsTheCallersUnapprovedOnlyScope` and
`IndexSourceOnAnUnprovisionedStamp_KeepsTheCallersScope`; restoring the defect fails 3 of 14.

### 14.2 ‼️ D-15's empty defaults turned a wrong-but-working config into a silent refusal on the FUNCTIONS host

Emptying `MediaConstraints`' class defaults was right, but three hosts bind `StorageConfiguration` and only the
API got the boot check. The Functions host configures **one** container and reads exactly one allow-list —
`ServiceImages`, which `KnowledgeServiceDraftAnalyticsJob` uses to choose an extracted draft's picture. Before
the fix a missing block fell back to a wrong-but-permissive media list; after it, `SelectImageUrl` returns null
for every candidate and **every draft silently loses its picture**. A hazard the fix itself created.

Closed with a boot check in the Functions host scoped to the one allow-list it reads, plus
`FunctionsMediaAllowListsAreConfiguredTests` (3 cases, binds the real appsettings through a real
`ConfigurationBuilder`; emptying the array fails it). Identity binds the section but never validates an upload
— verified, nothing to do there.

### 14.3 ‼️ "Fail the boot" was a FALSE claim — `PostConfigure` runs on first options resolution

Both storage checks (mine and the pre-existing H-21 SAS caps) live in `PostConfigure`, and
`StorageConfiguration` is resolved only by CONTROLLERS. So a misconfiguration surfaced as a 500 to a provider
on the first upload — precisely what the comment claimed to prevent. `AddOptions<StorageConfiguration>()
.ValidateOnStart()` added on both hosts, which is the idiom this codebase already uses for PolicyConsent and
Payments. Verified safe first: every configured SAS value is within its cap (15 ≤ 30, 30 ≤ 60), and the
integration factory imports all twelve containers' media rules from the real appsettings. Proved by running
`AppConfigEndpointTests` — `AppConfigController` is one of the controllers that resolves these options, so the
host started and both checks ran: 5/5 green.

### 14.4 A latent captive dependency in the single-flight, and the guard it never had

B-19's `GetPartnerContextAsync` single-flight used a **static** `ConcurrentDictionary` whose `Lazy` closure
captures a **scoped** instance, so one request could await a build owned by a scope already disposed. Audited
every captured dependency: none is a scoped disposable today (the Cosmos repositories are not `IDisposable`;
`BranchDirectory` takes a POOLED factory and `await using`s each context), so it was latent rather than live —
but the next scoped disposable added to that constructor would have made it real, silently. Now per-scope,
which still dedupes the case that matters: the three profile-reading tools are Scoped and share one instance
within an answer.

That single-flight had **no test at all**. Three added in `Clinqet.Mcp.UnitTests` (§0.18 — the MCP host is this
class's orchestrator and already owns its suite): eight concurrent callers read the profile ONCE and all
receive the same object; a failed build is removed in the `finally` so the next caller retries; and the map is
pinned per-scope so it cannot go back to static. Removing the dedupe, and separately re-adding `static`, each
fail one.

### 14.5 Dimensions that came back clean

| Dimension | Result |
|---|---|
| `IMemoryCache` Size | every write in the changed set carries `MemoryCacheEntryOptions` with a Size; convention test green |
| Cross-partition Cosmos | every new query/point-op passes a partition key — verified line by line across the diff |
| Localization | all 6 new backend keys 5/5; web + mobile keys 5/5 |
| Settings hygiene | 3 new dials each have a runtime reader; 2 removed keys have 0 residual references |
| Test placement (§0.18) | all 8 new suites sit with their runtime consumer |
| Repo isolation (§0.17) | one cross-repo read, the permitted appsettings-contract case, with `Assert.SkipWhen` |
| New static mutable state | none — two independent sweeps agree |
| Swallowed exceptions | no empty catches; the one silent catch is `DuplicateItemException`, deliberate idempotency, logged |
| Clean tree (§0.16) | no `.bak`/`.orig`/probe/sabotage file in any repo; every untracked file is a deliverable |
| Comment discipline (§0.14) | two pure change-log lines deleted; the rest carry a WHY the code cannot |
| Cost | no regression. `PromptFingerprint` recomputes SHA-256 per read — microseconds against seconds of AI, and memoising would add staleness risk to a config POCO, so deliberately left |
| Mobile mirrors web | every changed rendering rule has its counterpart, with the rules shared in `askRules.js`/`askRules.ts` and pinned by CI-safe parity tests |

---

## 15. §6 UI ROWS — the second pass (2026-09-07)

### 15.1 Built and guarded

| Row | What changed |
|---|---|
| **U-2** | The Recent row already REOPENED rather than re-asked — but nothing guarded it, and re-asking spends a unit of the day's allowance to reach an answer already paid for. Two cases added, including that a row carries its OWN session and not the first row's |
| **U-3** | Verified fixed on BOTH apps and guarded. The notice is drawn from outside the landing branch, and it carries no Try again because `newConversation()` runs BEFORE the key is set — so `exchanges` is empty, `asked` is undefined, and the gate cannot open. Set the key first and the app would offer to re-run the question it had just handed back |
| **U-4** | Verified fixed and guarded. The hand-rolled stream raises the access bus itself, and the hook renders the server's own sentence for EVERY failure — so the three session-shaped 403 codes that dialog does not own (`billing_only_access`, `business_context_required`, `business_context_invalid`) still say something |
| **U-5** | **BUILT, both apps.** A refresh the server REJECTED is an ended session, and `ask` is the one call that bypasses the shared client — so nobody was signed out and the member met "Something went wrong" beside a Try again that could never work. Web mirrors the shared client's two arms exactly (`staleSession` means reload and NEVER clear, else clear + redirect); the phone reuses the platform's own single-flight `forceLogout`, now exported. ‼️ TRANSIENT failures are left alone on both — losing signal mid-answer must not end a session |
| **U-10** (mobile half) | **BUILT.** U-10 shipped on WEB ONLY. `BUSINESS_SEARCH.ERROR.TRY_AGAIN` existed in all five languages and was rendered by nobody, so every refusal on the phone said "try again" with nothing to press — on a phone keyboard that means retyping the whole question |
| **U-11** | **BUILT, mobile.** A replayed conversation stores text only, so a citation pill finds nothing. The call site already withheld the handler, but the component still wrapped the marker in a `TouchableOpacity` with `accessibilityRole="button"` — a control that announced itself to a screen reader and did nothing. Now a plain marker, deliberately NOT brand green (green means chosen). The approved sheet is explicit: *"Reopened answers must not show dead citation controls"* |
| **U-14** | **BUILT, mobile.** Choosing Everyone CLEARS the role list on the server, so re-choosing "Only certain roles" sent the now-empty list and landed on "just you" — two taps, no undo, nothing said. A `lastPickedRoles` ref mirrors web's, seeded from the document, updated on a real pick and on the server re-read. ‼️ An EMPTY list never overwrites the memory: an empty list IS the Everyone case |
| **U-27** (mobile half) | **BUILT.** The Reviews screen already reads `route.params.reviewId`, scrolls to that row and highlights it — built for the review notification, mirroring web's `?reviewId=`. Business Search simply never passed it, so a card naming ONE review dropped the member on the whole list |
| **U-30** | **BUILT.** "The roles could not be loaded. Try again. Try again" — every language carried the instruction inside the sentence AND as the button. The trailing sentence is trimmed in all five, using each language's own already-approved words. Mobile uses the full sentence as its tap target and is deliberately unchanged |
| **U-38** | **BUILT, four of five.** (a) An expired signed image address drew the browser's broken glyph; the tile is DROPPED on this page's own rule that what cannot be shown is not rendered, and the strip disappears when it empties. (b) A clean end that produced NO WORDS left the member with a blank space and nothing said — the acknowledged-but-empty case skipped both existing arms. (c) The "try again in about N min" tail is suppressed at or past an hour, so a daily ceiling no longer reads "1440 min" beside the server's "resets at midnight"; the rule lives in the SHARED module with a parity case. (d) `prepare` is fired on mount and asked for by nobody, yet a refusal of it popped the shared dialog over an unused page — the caller's own `.catch()` is far too late, so the REQUEST is marked `quietRefusal`. (e) `clearHandedQuestion` existed and was called from nowhere: the slot is in MEMORY, so `SessionStore.clear()` could never reach it |
| **U-41** | **BUILT, both apps.** Neither answer-markdown component had a test at all. The phone renders a REAL GFM table through the real library (added to the jest ESM allowlist) and proves it scrolls in its own box; web drives the real components map through a stub, because `react-markdown` is pure ESM and `next/jest` transforms no `node_modules` — parsing is the library's job, the map is ours |
| **U-32** (part) | Two orphan families deleted, both verified at zero references: web `BusinessSearch.Answer.AnsweredFrom` ×5 (its 17 per-kind siblings are live and untouched) and mobile `KNOWLEDGE.AUDIENCE.NONE_PICKED` ×5. ‼️ `BUSINESS_SEARCH.ERROR.OFFLINE` was NOT deleted — it was made LIVE instead: web picks that sentence in its hook from `navigator.onLine`, the phone learns it from NetInfo in the screen, so a lost signal now says the same thing on both apps. It substitutes only for the GENERIC sentence, never over a specific one |
| **U-42** | The orphan sheet is copied into the one home (`Data\mockups\voice-number-management\`, byte-identical) and `Data\mockups\REGISTER.md` now indexes all 26 sheets, saying for each whether any programme register covers it — 20 say **none**. ‼️ It is an INDEX, not a record of approval: no dates, approvals or ownership were guessed. The two `git rm` commands are the owner's, printed in that file |

### 15.2 ‼️ A defect this pass INTRODUCED, caught in the same pass

U-10's Try again was gated on ceiling / offline / mid-answer — but **not** on `needsReload`. When a write goes
unacknowledged both apps disable the ask box ON PURPOSE and offer a FREE reopen; a Try again beside it charges a
second question to reach an answer the member can already have back for nothing, and it reaches `ask` directly,
bypassing the lock the screen had just applied. Fixed on both apps and guarded on both.

### 15.3 Recorded, needing the owner — nothing was quietly decided

| Row | Why it is not built |
|---|---|
| **U-6** | The "continue after backgrounding" state needs NEW COPY and **no sheet draws it** — §0.7.1's MOCKUP GATE. Part of its harm is already absent: `needsReload` locks the box and offers the free reopen, so the member is not forced to pay. The remaining half is that the state is drawn RED for something recoverable |
| **U-15** | ⚑ Restore `InvoiceDueGroupsView` from `988269c8^` as a third VIEW_SWITCHER mode, or rule "web has no due view" and delete 50 key values plus the dead helper. Either branch is the owner's; U-32's invoice remainder waits on it |
| **U-26 · U-28** | New copy keys ×10 for states no sheet draws — the same gate as U-6 |
| **U-29** | The chip order's rationale is real and documented in code ("what's on this week?" is the question a provider opens the app to ask). No sheet draws the suggestion-chip ORDER mechanically — M5's pills are ROLE badges, not chips — so this stays a deviation awaiting a PLAN §0.1 row rather than a silent blessing |
| **U-33 · U-34 · U-35** | One author per state, and the transliteration of the brand per script, are both owner choices. The mechanical halves of U-35 (the fr-CA punctuation rule, Latin "Ready" in gu/hi, the page's own gu/hi name in the drafts notification) are buildable once the owner settles the rule they belong to |
| **U-37** | The "amount in name" caption pattern is new copy |
| **U-39** | ‼️ **THE AUDIT'S PREMISE IS WRONG.** It says "the customers list is already loaded on the page" — it is not, on either app. `memberNames` comes from `GetMembers()`, a BOUNDED team read; a customer roster is unbounded and paginated, so a browser-side fetch would be both costly and incomplete, and would ship every customer's name to the client in order to avoid logging one. Client-side customer redaction cannot be made correct this way. The honest options are a server-side scrub (it already redacts members and can match its own data) or a recorded ruling that customers are not redacted |
| **U-40** | `@react-native-clipboard/clipboard` is **not installed**, and RN-core `Clipboard` is used in FOUR places app-wide — a new native dependency plus a rebuild plus a four-site migration, none of it Business Search's to decide |

### 15.4 Green

**API 11,764 · Functions 3,978 · MCP 874 · web 3,072 (227 suites) · mobile 3,948 (239 suites) · 0 ESLint
errors · `tsc` clean.** Every fix above was sabotage-checked where a guard was new.

### 15.5 ‼️ A SIXTH defect of my own, caught by the FULL mobile run

Deleting the orphan key `KNOWLEDGE.AUDIENCE.NONE_PICKED` turned **5 pre-existing tests red**:
`knowledgeAudienceScreen.test.ts` pins every audience state string in all five languages, and that key was on
its list. My "verified zero references" sweep had grepped `src` and **not `__tests__`** — a test can pin a key
just as a screen can.

The key really is dead: it is the ONLY one of the 25 pinned keys the screen never renders (checked one by one),
the zero-role state is drawn from `MARK_JUST_YOU`/`JUST_YOU`, and **web has no twin for it at all**. So the list
entry went with the key, and the list now carries the reason — pinning dead copy makes a guard argue for keeping
it. That guard proved it bites by catching this.

**The process lesson: an orphan-key sweep must include the test folders.** The web deletion
(`BusinessSearch.Answer.AnsweredFrom`) is clear on the same check, and its full run was green after the fact.

---

## 16. OWNER RULINGS, 2026-09-07 — two rows closed, one sheet drawn

| Row | Ruling | State |
|---|---|---|
| **U-39** | ‼️ **CLOSED — NOT A DEFECT.** Owner: *"for now it is just parqet then ignore it, I told you this is admin stuff and dont fucking over complicate it."* Customer names in a question reach the analytics store only; that store is admin-facing, and no customer-facing surface reads it. Client-side customer redaction is NOT built and is not to be raised again. The `customerNames` parameter on `redactQuestion` stays — it costs nothing, it is exercised by the parity suite, and it is the seam if the ruling ever changes | **CLOSED** |
| **U-40** | ‼️ **BUILT.** Owner: *"new latest one too, never ever we need the deprecated one."* `@react-native-clipboard/clipboard@^1.16.3` adopted; all FOUR call sites moved off React Native's deprecated core `Clipboard` (share modal, dashboard share card, Ask Clinket copy-answer, voice assistant copy-number). Autolinked on RN 0.78 — an import change plus a native rebuild, no JS shim. `clipboardPackage.test.ts` scans all 645 source files and fails on a relapse; proved by restoring the deprecated import (one case red). Installed with `--legacy-peer-deps`, which is how this lockfile was already produced | **DONE** |
| **U-6 · U-26 · U-28 · U-37** | ‼️ **SHEET DRAWN, awaiting approval.** One sheet covers all four, because all four are the same thing: a state the app can reach and cannot describe. `Data\mockups\business-search-refusal-states\index.html`, registered in `Data\mockups\REGISTER.md`. Six states, computer AND phone frames, twelve new sentences listed with the exact English and where each comes from | ~~AWAITING APPROVAL~~ → **APPROVED 2026-09-07, and all six states BUILT** — see §18 (§01/§05/§06) and §21 (§04). Status kept for the record; it is no longer current |

**The sheet's own verification** (measured in the browser, not asserted): no page overflow at **320 / 390 /
768 / 1280 / 1440**; one column below 900 and two above; all three wide tables scroll inside their OWN box and
their content is reachable; every control is at least 40 px tall at every width. No technical word appears
anywhere a provider can read (§0.20).

**Two things the sheet asks for beyond words:** U-28 needs the server to put the shown/total counts on the
frame that already says the answer is finished (no extra round trip), and U-37's currency NAME needs no new
copy at all — both platforms can already name a currency in the reader's own language, falling back to the
three-letter code that appears on every invoice.

### 16.1 Git — the whole phase is on `master`, straight, and pushed

Nine repos committed on `master` with **zero merge commits**. The incoming work was the service-description
refactor (`List<string>` → `string?` on `Service.Description`), which overlapped 26 of my files. Three
conflicts, all resolved keeping **both** sides:

- `ProviderSetupServiceWriter.cs` — kept the ETag read-modify-write AND the new single-string fill-a-blank
  rule, with the rule moved INSIDE the closure so it reads `stored`, never the caller's stale copy. That is
  stricter than either side alone: a description the provider typed while the chunk ran is no longer a blank.
- `BusinessSearchToolFakes.cs` — kept the `catalogSettings` parameter (a superset of the hardcoded default).
- `BusinessSearchQuestionRedactionEndpointTests.cs` — kept the invariant comment.

**Post-rebase green:** API **11,815** · Functions **4,013** · MCP **878** · web **3,090** (229 suites) ·
mobile **3,975** (242 suites) · 0 ESLint errors · `tsc` clean. ‼️ Two "failures" in the first post-rebase run
were artefacts of my own script rebuilding shared projects back to back — a clean `--no-incremental` build of
every project has 0 errors, and both suites are green on their own. **Never read a failure from a run that
rebuilds shared projects concurrently.**

---

## 17. FIVE MORE ROWS RULED AND BUILT (2026-09-07) — and the sheet approved

The owner took the recommendation on U-15, U-29, U-33, U-34 and U-35, and **approved the states sheet**.
Rulings are recorded as `PLAN.md` §0.1 **R5 (U-29) · R6 (U-33) · R7 (U-34/U-35)**.

### 17.1 ‼️ One of my own recommendations was WRONG, and the evidence said so

I had recommended *"let the server be the only author"* for U-33. Investigating before acting showed that is
**wrong for the state that matters most**:

- **Cut short — the SCREEN must own it.** Only the screen knows whether the answer is live or replayed, and
  the two need *different advice*: "ask a narrower question" is advice about a question the member is no
  longer asking. The approved states sheet already ruled this ("the screen removes the mark and shows its own
  notice"). The server now sends the `Partial` FLAG and no words.
- **Page / text cannot be shown — the SCREEN owns it too**, for a different reason: the client turns a 404 on
  those routes into "nothing to show" **without reading the body**, so a sentence of ours was unreachable by
  design. The body falls back to the generic `Error_NotFound`, so the API still answers something true.
- **Something went wrong — DELIBERATELY left with both.** The client renders the server's message first and
  its own only when there is none. That is a fallback CHAIN, not two authors, and deleting either half would
  lose a state. Pinned as such, so a future "tidy-up" cannot collapse it.

Guarded by `OneAuthorPerStateTests` (4 cases), which also scans the agent to prove the flag ships without words.

### 17.2 ‼️ A SHIPPED GUARD ENCODED THE WRONG COUNTRY'S TYPOGRAPHY

`sourceLocalizationIntegrity` had a test named *"French questions and accents are not corrupted into bare
question marks"*. Its signature was `\p{L}\?` — a letter touching a question mark — on the reasoning that
**French always puts a space before `?`**, so a letter directly against one meant an accent had been destroyed.

That is the **France** convention. `fr-CA` is **Québec**, which drops the space before `?` `!` `;` and keeps
it before `:`. So the guard's premise was wrong for the very locale it guarded: applying the correct rule made
it flag **147 correct values**, and it had never been able to say anything about encoding at all.

The purpose is kept and the signature replaced with one that does not depend on spacing: a mangled accent
leaves the `?` **inside a word** (`R?serv?e`, `fran?ais`) or **immediately before a lowercase letter**
(`?t? envoy?`), while a legitimate question mark ends a clause. 0 hits across the catalogue, and all three
mojibake shapes still caught. Two further guards now hold the convention itself — one for each half, so a
later sweep cannot remove the colon's space either.

‼️ **And my first sabotage run of those guards was itself vacuous**: it counted `✕` while this jest reporter
prints `×` (U+00D7), so it reported "caught nothing" for two defects it had actually caught. Re-run counting
the summary line: injected mojibake ⇒ 1 failed, France spacing ⇒ 1 failed, restored ⇒ 30 passed.

### 17.3 What each row cost

| Row | Built |
|---|---|
| **U-15** | `INVOICE_DUE_BUCKETS` and `getInvoiceDueBucket` were dead — the web due-date view was deleted as orphaned and they were the only consumers of eight `invoice.group.*` keys. **12 web keys × 5** and **2 mobile keys × 5** deleted, plus `daysUntilDue`'s needless export. Verified key-by-key against `HEAD`: exactly those, nothing added, nothing else changed, line endings intact |
| **U-29** | Recorded as R5. The order has a real reason — *"what's on this week?"* is the question a provider opens the app to ask — which lived only in a code comment, so the audit read it as a deviation and re-raised it |
| **U-33** | §17.1 |
| **U-34** | **77** Devanagari/Gujarati transliterations of the brand → Latin "Clinket", which was already the 93-to-7 majority. The Insights page: **Spanish had three names, French four**; all nine keys on both apps now reuse the page's own noun. Zero unexpected value changes, verified against `HEAD` |
| **U-35** | **479 values** across the three French catalogues lost the space before `?` `!` `;`; the space before `:` is kept (215 web · 161 phone · 111 server). Latin "Ready" in the gu/hi upload hint → `તૈયાર` / `तैयार`, which is what the chip it points at already said. The AI Knowledge page had **three** names in gu/hi across web, phone and the server's notification; now one |
| **U-40** | ‼️ Adopting the maintained clipboard module **broke four ShareProfile suites** — it is a native TurboModule and throws under Jest, where RN's deprecated one had been JS-shimmed by the preset. Closed with a stub wired through `moduleNameMapper`, this repo's own convention for the audio assets; spies rather than no-ops so a test can assert what was copied |

### 17.4 The sheet is APPROVED

`business-search-refusal-states` — approved 2026-09-07, row in `Data\mockups\REGISTER.md` naming all four
audit rows it governs. Redrawn once on the owner's feedback, and the redraw changed the design in one
important way:

‼️ **The long-answer cue is no longer a worded pill.** It reuses the cue the app ALREADY SHIPS on the
left-hand menu — a soft fade that takes no press, plus a round translucent disc with a brand-green arrow,
never a solid lime pill ("lime means chosen on this rail", says the menu's own note). That removes a sentence
from the sheet entirely: the only words left are a screen-reader label. A green dot and a soft ring
distinguish *still being written* from *there is more to read*, and the phone pulses three times then holds —
the motion the knowledge screen already uses, silent under reduced motion.

‼️ **And it waits until FOUR lines are hidden**, not one pixel — measured in lines so it survives larger text.
Two or three lines below the fold is not something a reader misses, and a mark that is always there stops being
read. `ANSWER_CUE_MIN_HIDDEN_LINES = 4` will live beside the other shared rules with a parity test.

Verified in a browser rather than asserted: no page overflow and no escaping element at **320 / 390 / 768 /
1280 / 1440**, one column below 960 and two above, every control ≥ 40 px, all three wide tables scrolling
inside their own box with content reachable.

### 17.5 Green

**API 11,819 · Functions 4,020 · MCP 878 · web 3,092 (229 suites) · mobile 3,979 (243 suites) · 0 ESLint
errors · `tsc` clean.**

‼️ **Twice in this phase a "failure" was an artefact of my own script** building shared projects back to back
before running a suite — once 4 phantom compile errors plus a phantom test failure, once a single phantom
failure. A clean `--no-incremental` build of every project had 0 errors both times and every suite was green
run on its own. **Never read a failure from a run that rebuilds shared projects concurrently** — and never
report one without re-running it isolated.

## 18. THE LAST THREE ROWS (2026-09-07) — the three states nothing could describe

Sheet `business-search-refusal-states` §01, §05 and §06, plus one defect of the codebase's own that only
surfaced because a guard for §01 went looking for it.

### 18.1 §01 — switching away was painted as a failure

The browser closes the connection when the tab is hidden; the phone aborts the request itself when the app
goes to the background. Either way an answer part-way through simply stops — and the member came back to a
**red** box beside **two buttons that both re-asked the question**, spending one of the day's allowance to
reach an answer that was already saved up to that point.

| | Before | Now |
|---|---|---|
| Colour | red (a breakage) | amber (a boundary) |
| Words | "we could not confirm this" / "something went wrong" | "You switched away, so this answer stopped" + what is saved |
| Free action | none — both buttons re-asked | **green** "Open it again" ⇒ `reopen(sessionId)`, costs nothing |
| Second action | dim "Ask a new question" — empties the box, never re-sends | |
| Duplicate control | the plain "Reload conversation" sat beside it | stands down while the notice is up |

Four clauses gate it, and each one earns its place: **words must have ARRIVED** (`produced`) for "saved up to
that point" to be true; an **explicit error frame** carries the server's own sentence, so it is excluded; a
**member's own Stop** is their choice, not a switch away; and **without a session** there is nothing to open,
so the existing "no longer saved" notice stands instead. The web arm additionally requires the transport to
have failed — a stream that FINISHED unacknowledged is complete, and "open it again to see the rest" would
be false. The phone arm carries no `!aborted` clause **because the abort is ours**.

‼️ **The flag is cleared at the start of both `ask` AND `reopen`.** Backgrounding during a reopen would
otherwise leave it raised, and the NEXT question would settle into a resume notice it had never earned.

### 18.2 ‼️ A defect of the codebase's own, found by the §01 guard

A guard written to prove that a rate-limit refusal keeps its own sentence **failed**: `serverError` came
back `null`. An explicit `Error` frame sets the server's message and its countdown, and the failure arm that
runs afterwards then did `setServerError(message || null)` — with no message on a transport error, that
**overwrote the server's sentence and its countdown with a bare "something went wrong"**. A member at the
daily ceiling was told nothing about the ceiling. Fixed in both apps by adding `!frameError` to the failure
arm: an error frame is terminal and already carries the words. **Pre-existing, in no audit row, and it would
still be there if the guard had only asserted the happy path.**

### 18.3 §05 (U-28) — a shortened list said nothing

Ten unpaid invoices under a question about unpaid invoices reads as "there are ten". The model is *told* to
state the total in prose and sometimes does not, so the two numbers now ride the wire and the screen says it.

- `BusinessSearchRowsDto {shown, total, tool}` on the **terminal frame only**, and only when a list really was
  shortened — equal counts have nothing to tell the reader.
- Set in **one place**: the work-list base's `Finish()`, which every one of the ten shortenable tools already
  funnels through. Read AFTER the payload cap, which corrects `shown` when it drops rows from the tail.
- ‼️ **Exactly one list, or nothing.** A caption saying "showing 10 of 47" cannot describe two lists, so a turn
  that shortened two sends none and leaves the prose to carry it.
- ‼️ **The controller SWALLOWS the agent's Done frame** and writes its own, so the counts are carried across
  like `tokensUsed` and `answerId`. Deliberately **not persisted** with the turn: a re-opened conversation
  would show a count taken when the answer was written, and a stale count is worse than none.
- `BusinessSearch.Rows.ShowingSome` + `.OpenAll` ×5 ×2 apps.

**‼️ THE LINK NAMES THE PAGE, NOT THE ANSWER'S NARROWING — a deliberate divergence from the sheet, recorded
as ruling R8.** The sheet draws "Open all *unpaid* invoices" and says the destination should be "narrowed the
same way the question was". Only the invoices page reads a filter from its URL today (`Invoices.jsx:116`
`status`), and none reads a date range — so for eight of the ten lists a narrowed promise would land the
member on a page showing a **different number from the one just printed above the link**, which is the exact
trap the sheet exists to close. The wording therefore promises the full list and that is what opens. A tool
name the app does not recognise draws **the count alone**: a link to a page that would not hold what the
answer was about is worse than no link (`rowListRoutes.js` / `.ts`, ten entries each, pinned by a test in
each repo — and the phone's inbox goes through its **tab** route, because the profile stack cannot reach
`ChatList` directly).

### 18.4 §06 (U-37) — money in three or more currencies

| Defect | Fix |
|---|---|
| The caption joined amounts **bare** — "kr 4,500.00 · R 4,500.00" told the provider nothing about which was which, and several currencies share a symbol | each amount is paired with its currency's **name**, one pair per line (`Insights.Chart.AmountInCurrency` / `MY_DASHBOARD.AMOUNT_IN_CURRENCY` ×5 ×2) |
| A new date range kept the **previous range's bars bright** — a stale chart read as a fresh one | dimmed to 40 % and `aria-busy` on web, `opacity` on the phone |
| A chart failure was **red** | amber: the earnings are fine, only the picture is missing |
| The phone tile's tap gate read the **headline alone**, which is ₹0.00 on a day paid only in another currency — the tile was dead while the list under it named real money | enabled when either the headline or the list is non-empty |

‼️ **The joining word lives INSIDE the key**, both blanks named: Gujarati and Hindi put the postposition
**after** the currency name, so a hard-coded "in" would be wrong in two of the five languages. Guarded per
language on both apps.

‼️ **The sheet's amber "Counted apart, never added" note was NOT built.** The sheet's own words panel names
exactly one new sentence, and §0.20 requires every state to say where its words come from — that note's do
not exist in either catalogue or on the server. Recorded as ruling R9 rather than invented.

‼️ **react-intl splices rich-text values into a child ARRAY.** The first run of the new caption printed a
React missing-key warning; an element passed as a message value needs its own `key`. A warning in a passing
test is still a defect — React can mis-reconcile the pairs.

### 18.5 Three tests the batch had to FIX, not add

Two mobile ask-layout guards and two web chart tests **failed on my own changes**, and all four were right to:
they pinned exact source literals and exact caption text that this batch legitimately moved
(`{serverError || localErrorKey ?` → `{!resumable && (…)`, `{needsReload && sessionId ?` →
`… && !resumable ?`, and "You were also paid C$24,999.00 in this period." → the named pairs). The PURPOSE held in
every case; only the literal moved. Each was updated to the new literal **and given the new gate to assert** —
never loosened.

Three lint **errors** were also left behind by my own earlier commits in this session — `citationSubtitle`, a
`Node` type alias and a `HOOK` const, all unused — and are deleted. ‼️ They were only visible under
`--quiet`: these repos carry ~17,000 warnings, so an error read off the total count is invisible.

### 18.6 SABOTAGE — three of the new mechanisms broken on purpose, all three caught

Per §0.19 every file was snapshot-COPIED to the session scratchpad and restored from that copy; **no git
restore was used**, and each restoration was verified by re-grepping the live line.

| Broken | Guard | Result |
|---|---|---|
| `!resumable` removed from the web error-box gate | `BusinessSearchPage.states.test.jsx` | **1 failed**, 8 passed |
| `SampledLists == 1` removed, so any list's counts ride the frame | `BusinessSearchSampledRowsTests` | **1 failed**, 4 passed |
| `produced` + `!frameError` removed from the phone's resume arm | `businessSearchResume` + `businessSearchStatesParity` | **3 failed**, 27 passed |

‼️ **The "paints nothing red" assertion was VACUOUS as first written** and was rewritten before the sabotage
run: the notice sets no error of its own, so asserting "nothing red" with both error fields null passes whether
the red box is gated or not. It now carries a leftover `localErrorKey` — which is exactly the reachable case,
an error frame arriving before the tab went away — and it fails when the gate is removed.

### 18.7 Green

**API 11,824 · Functions 4,020 · MCP 878 · mobile 4,030 (247 suites) · web — see the run below · 0 ESLint
errors on both apps · `tsc` clean.** Identity untouched by this phase, so its suite was not re-run.

New guards this batch: 5 API (`BusinessSearchSampledRowsTests`), 9 web page states, 9 web resume-hook, 5 web
route map, 8 mobile resume-hook, 22 mobile state parity + copy, 6 mobile route map, 3 mobile tile gate, plus
1 web chart and 1 mobile chart added beside the rewritten ones and 1 mobile ask-layout gate.

## 19. THE REPOS HAD MOVED UNDER ME (2026-09-07) — two conflicts, one parity gap, one red suite

`clinqetwebpartnerapp` was **4 commits behind** and `clinqetmobilepartnerapp` **5**, and the incoming work
touched exactly the files this batch was editing: all ten locale catalogues, the phone's
`useBusinessSearch.ts` and `BusinessSearch/index.tsx`, and the ask-layout guard. Each app was committed, then
`pull --rebase`d, so the graph stays straight. (Reaffirms [[repos-can-skew-mid-session]].)

### 19.1 The one real conflict, resolved by keeping BOTH sides

`useBusinessSearch.ts`, the `Done` case. Theirs: `saved = frame.saved !== false` — *a silent Done is a saved
answer*. Mine: the row counts. **Both kept**, with both comments. The interaction is benign and worth stating:
with a silent Done now counting as saved, `!saved` is false, so such an answer correctly produces **no** resume
notice — the write was acknowledged and the answer is complete.

Every new key was re-verified present in all five web catalogues after the rebase (7 of 7 each).

### 19.2 ‼️ A PARITY GAP the rebase exposed — and it is a real defect on web

The phone's incoming commit changed `saved === true` to `saved !== false`. **Web still had `=== true`.** Two
apps reading the same wire fact by opposite rules is exactly what "mobile mirrors web" forbids — and web's rule
is the wrong one: a terminal `Done` **is** the write the host made, so an absent save outcome locked the ask box
and met the member with *"we could not confirm that this answer was saved"* beside an answer on screen.

Web is aligned, with **both halves** of the phone's guard pair mirrored (a silent Done leaves the conversation
usable; an explicit `saved: false` still blocks the follow-up). Not a guess about the other author's motive —
the rule is strictly safer on both apps, and the main API controller always sends the field, so nothing
observable changes against **this** host today.

### 19.3 ‼️ FIVE TESTS WERE ALREADY RED ON `origin/master`, and they are not mine

`__tests__/accessSnapshotCache.test.tsx` failed 5 of 5 with
`(0, _signalRService.onWorkspaceAccessRestored) is not a function`. Traced, not assumed:

- `onWorkspaceAccessRestored` was **added** by incoming commit `1e5bf02f`, which wired `BusinessProvider` to
  call it;
- that commit did **not** update this older suite's `signalRService` mock (last touched by `6dfd6c39`), which
  stubs only the roster signal — while the two suites added *alongside* it stub the new export correctly;
- **none of the three files appears in my commit.**

Fixed with the one-line stub the sibling suites already use, in its own commit saying it is not from this
batch. A red suite on master is worse than touching a peer's file for an obviously-correct mock addition.

## 20. FINAL GREEN AND WHAT WAS PUSHED (2026-09-07)

Every repo was verified **after** its rebase, on the merged tree — never on the pre-rebase one.

| Repo | Verified | Pushed |
|---|---|---|
| `clinqetshared` | API/Functions/MCP suites below | ✔ `4433b90` |
| `clinqetcore` | ″ | ✔ `6217edb` |
| `clinqetinfrastructure` | ″ | ✔ `a1dc939` |
| `clinqetapi` | **11,824** passed | ✔ `355f409` |
| `clinqetfuncations` | **4,020** passed | untouched |
| `clinqetmcp` | **878** passed | untouched |
| `clinqetidentity` | untouched, not re-run | untouched |
| `clinqetwebpartnerapp` | see below | 2 commits |
| `clinqetmobilepartnerapp` | see below | 2 commits |

The two frontends carry two commits each: this batch's states, plus the one-line fix each needed after the
rebase (web's silent-`Done` parity, the phone's stale `signalRService` mock). The API carries two: the Done
frame, and the wire-shape guard §20.2 explains. **Every commit of mine is a plain commit on top — I created no
merge commit in any repo.** Every repo ends **clean, ahead 0, behind 0**.

### 20.1 ‼️ THE REMOTES MOVED THREE TIMES DURING THIS CLOSE

The first push of the two frontends was **rejected** — both had gained a commit while their suites were
running. Then the API suite failed to COMPILE on three files I never touched, because incoming commit
`177bfae` (`Clinqet.API.UnitTests`) expected a `ProviderSetupServiceWriter` signature whose
`clinqetinfrastructure` half I did not yet have. Four peer repos were behind: infra, core, shared and MCP
each had one commit of the same "service description" change.

‼️ **A compile error in a file you never touched means the SIBLINGS MOVED, not that you broke something**
(reaffirms [[repos-can-skew-mid-session]]). The fix is to bring every peer to its own origin — never to
"repair" the failing test. Pulling all five made it green with no edit at all.

‼️ **Re-verify after EVERY rebase, on the merged tree.** Three verification rounds were run here, and only
the last one is evidence. A suite that passed before the rebase says nothing about what shipped.

### 20.2 The guard neither half would have caught

Every server test on this frame builds the DTO; every client test hand-builds the JSON. Between them,
**nothing pinned the wire**: change `SseJsonOptions`' naming policy and the frame would still be sent,
`frame.rows` would be `undefined` on both apps, and the caption would silently never appear again. Now
serialized with the controller's **actual** options (read by reflection, so the assertion is about the wire and
not a copy of the policy), asserting the three keys when a list was shortened and the key **absent entirely**
when it was not.

### 20.3 Final green, all on the merged trees

| Suite | Result |
|---|---|
| API unit | **11,834** passed, 0 failed |
| Functions unit | **4,020** passed, 0 failed |
| MCP unit | **881** passed, 0 failed |
| Web jest | **3,162** passed, 237 suites |
| Web ESLint | **0 errors** |
| Mobile jest | **4,058** passed, 250 suites |
| Mobile `tsc` | clean |
| Mobile ESLint | **0 errors** |

Identity was untouched by this phase and was not re-run.

## 21. ‼️ §04 WAS MISSED, AND FOUND BY CHECKING ALL SIX STATES (2026-09-07)

The owner asked whether anything was still pending. Rather than answer from memory I walked **all six** states
of the approved sheet against the code. Five were built. **§04 was not: 0 of 4 keys in all ten catalogues,
rendered nowhere.**

### 21.1 How it was missed

Audit row **U-26** bundles *three* separate things — "new text below" (§02), the typed-answer source line
(§03), and the voice-panel moments (§04). Two of the three shipped, the row read as done, and the third had no
row of its own. ‼️ **A row that bundles N things is N rows for the purposes of "is it finished" — tick them
individually or one of them silently disappears.**

### 21.2 What was built

| Moment | Rule |
|---|---|
| About to stop listening | the seconds LEFT, **never zero** (at zero the recorder has already stopped; a frozen "0" looks stuck), plural-aware so it never says "1 seconds" |
| Listening again | names the language **in its own script** — the person about to speak it reads it that way |
| Would rather type | offered while listening AND while the words are being written down; there was previously **no exit at all** |
| "Not right?" | offered once words have arrived, and ‼️ **it NEVER re-sends** — it re-opens listening, the words stay in the box, the member presses Ask |

‼️ **`start()` / `startRecording()` clears the detected language**, so the language to name while listening
again is captured when "Not right?" is pressed. Display state, so it lives in the panel and not in the hook.

‼️ **BLUE, not amber.** Nearing the recording cap was drawn in the same amber as a refusal, so "you have nearly
finished speaking" read as a limit being enforced. Amber stays for a real boundary, red for a real failure. The
phone's now-unused `stripNearCap` is deleted rather than left orphaned.

‼️ **The phone had no way to abandon a recording** — `stopRecording()` always transcribes, so "Type instead"
needed a new `cancelRecording()` that drops the file (leaving nothing for a retry to re-send). Web already had
`cancel`. Its result type was widened, so a caller cannot use it without the compiler knowing.

The language name reuses `labelFor`, the map that already labels the correction chips — exported on the phone
rather than copied.

### 21.3 Guarded and sabotaged

`dictationVoiceMoments.test.jsx` — **14**, rendered through the real `IntlProvider` and the real en-US
catalogue, because every one of these is a sentence. `dictationVoiceMoments.test.ts` — **18**, rules scanned
plus the copy present with its blanks in all five languages.

Sabotaged: the blue tone on web (nearCap back to amber) and the language capture on the phone
(`setAgainIn(detectedLocale)` → `null`). **Each failed exactly one test**, files restored from scratchpad
copies, both restorations re-grepped. No git restore (§0.19).

One test of mine asserted copy that does not exist — "Listening — tap to stop." against the catalogue's
"Listening — tap the square to stop." It failed, which is the point of rendering through the real catalogue.

### 21.4 ‼️ An existing orphan-key guard was RIGHT to fail, and needed teaching

`dictationNeverSends.test.ts` asserts every `dictation.*` key is referenced as a literal in the source — it
failed on `wrappingUp_one` / `wrappingUp_other`. Those are **i18next plural siblings**: the code names the
base key and passes `count`, so `dictation.wrappingUp_one` never appears anywhere and never should.

The guard's purpose ("no orphan copy") held; its rule did not know about plurals. It now strips an i18next
plural suffix before looking, **and** additionally requires a plural key to really have an `_other` sibling —
otherwise a lone `_one` would pass on the base name alone and i18next would fall through to the key.

### 21.5 Final green, with §04 in

| Suite | Result |
|---|---|
| Web jest | **3,195** passed, 238 suites |
| Web ESLint | **0 errors** |
| Mobile jest | **4,118** passed, 252 suites |
| Mobile `tsc` | clean |
| Mobile ESLint | **0 errors** |
| API / Functions / MCP | unchanged by §04 — no server code was touched |

Both apps re-verified on the merged tree after their final rebase (the phone took three more incoming commits
between its first push attempt and this one), and pushed: web `be368eb9`, phone `bd0e1df0`. **Every repo ends
clean, ahead 0, behind 0.**

### 21.6 ALL SIX STATES OF THE SHEET ARE NOW BUILT

| State | |
|---|---|
| §01 came back to a stopped answer | built |
| §02 long-answer cue | built |
| §03 typed-answer source line | built |
| §04 asking out loud | built (this section) |
| §05 shown-of-total | built |
| §06 money in three or more currencies | built, minus the note held by R9 |

Register row updated to say so. The two recorded divergences (R8's link target, R9's unsourced note) are the
only parts of the sheet not in the code, and each has a written reason.

## 22. THE ANSWER'S OWN CONTROLS WERE 3× THE DRAWN HEIGHT (2026-09-07)

The owner circled Copy / Helpful / Not helpful: "so big and take lots of unnecessary space". Opening the
sheets rather than guessing found something more useful than a styling opinion.

### 22.1 ‼️ TWO APPROVED SHEETS DISAGREE ON THIS ROW — and neither said what I first assumed

| Sheet | Date | Its subject | What it draws for this row |
|---|---|---|---|
| **M7** `business-search-ask-layout` | 2026-09-04, **LIVE** | ‼️ **"the frame of the answer surface"** | `.mini` — 1px border, surface fill, radius 999, **padding 2px 8px**, font 9.5px ⇒ **~20px tall**; `.foot` — hairline rule, margin-top 9px, padding-top 8px, gap 5px; `.mini.on` — brand fill |
| M10 `business-search-conversations` | 2026-09-06, "a working layout proposal" | the transcript, limits, recovery | `.answer-actions button` — transparent, **border:none**, font 12px, padding 8px, **min-height 44px**, no rule |

**M7 wins on this row** — its whole subject is this surface, it is marked LIVE, and it specifies the row with
exact values, where M10 describes itself as a layout proposal about history and limits. So the pills and the
hairline rule STAY. My first pass had made them borderless off M10 and was reverted before it shipped.

### 22.2 ‼️ THE REAL DEFECT WAS THE 44px TOUCH MINIMUM ON THE VISIBLE CHIP

Both apps drew M7's chip and then added the 44px accessibility minimum **to the chip itself** —
`min-h-11` on web, `minHeight: 44` on the phone. A 20px row became a 44px row **on every answer**: more than
double, on the most repeated element of the page. That, not the border, is what the owner was looking at.

**The 44px target is not dropped — it moves off the PAINT and onto the HIT AREA:**

| | How |
|---|---|
| Web | a transparent pseudo-element, `before:-inset-y-[11px] before:inset-x-0` ⇒ ≈46px tall, **the chip's own width only**, so neighbouring chips cannot steal each other's taps |
| Phone | `hitSlop={{top:12,bottom:12,left:0,right:0}}` — what React Native provides for exactly this, and it costs no layout |

Padding also came down to M7's numbers (`py-[3px]` / `paddingVertical: 3`, `px-2` / `paddingHorizontal: 8`)
and the row to `gap 5 · margin-top 9 · padding-top 8`. ‼️ **One `CHIP` constant on web and one `footBtn`
style on the phone**, so the three cannot drift apart — asserted, not assumed.

An icon now sits on all three (M10 draws one on each; only Copy had one), inverting to ink on the green
chosen state. Three short chips read faster with an icon each than as a run of words.

### 22.3 R9 BUILT — and I had been wrong to withhold it

The amber note §06 draws — *"Counted apart, never added / Money in different currencies is never added
together. Each currency is counted on its own."* — is now under the money pairs on both apps.

‼️ **My reason for skipping it was wrong.** I said its words "exist nowhere"; they are written **verbatim in
the approved sheet**. What is missing is only a row in that sheet's own words panel listing them as new copy —
a bookkeeping gap in the sheet, not a missing sentence. §0.20 asks where a state's words come from; "the
approved sheet" is a complete answer, and it is how the other eleven sentences got their English too.

It earns its place: money in different currencies **was** added together on this very surface — the live
figure 233,510.10 was rupees and Canadian dollars summed — and three separate amounts provoke exactly the
question the note answers.

### 22.4 R8 IMPROVED — the label now names the page it opens

`Open the full list` → **`Open {page}`**, filled from the destination's **own existing label** (`sidebar.*` on
web, each screen's own title key on the phone), so no page name is written or translated twice. Ten
destinations × 5 languages, guarded: every `nameId`/`nameKey` must resolve to a non-empty string in all five
catalogues, or a provider would be shown the key.

R8's substance is unchanged: the link still opens the PAGE, not the answer's narrowing, because eight of ten
destinations cannot reproduce the filters and a link landing on a different number is the trap §05 closes.

### 22.5 ‼️ "THE API WAS FAILING" IS NOT THE TESTS — IT IS THE PUSH ORDER

The API **integration** suite was run in full against real engines (Testcontainers: SQL Server + the Cosmos
emulator + Azurite): **2,066 passed, 0 failed.** Nothing in the tests is broken.

What fails is the **CI deploy**, and the workflows say exactly why:

- a push to `master` fires **Build Dev Clinket API** (`build-dev.yml`, `on: push: branches: [master]`);
- that build's completion fires **Deploy Dev Clinket API (CA)** and **(IN)** (`workflow_run`);
- ‼️ and `_build.yml` **checks `clinqetcore`, `clinqetshared` and `clinqetinfrastructure` out of `master`**
  (`dependency_branch: master`, `CORE_REPO`/`SHARED_REPO`/`INFRASTRUCTURE_REPO`, paths `clinqetcore` etc.).

So pushing the API **before** its libraries compiles it against the PREVIOUS libraries. Every cross-repo
change — and this whole programme is one — must therefore be pushed in dependency order:

**`clinqetcore` → `clinqetshared` → `clinqetinfrastructure` → `clinqetmcp` / `clinqetfuncations` →
`clinqetwebpartnerapp` / `clinqetmobilepartnerapp` → `clinqetapi` LAST.**

"Deploy" on this platform IS the push; there is no separate manual step for dev.

### 22.6 Two guards were right to fail, and neither was loosened

| Guard | Why it failed | What it got |
|---|---|---|
| `dictationNeverSends` orphan-key check | an i18next **plural sibling** (`wrappingUp_one`) is never a literal in source | taught about plurals, **and** made to require a real `_other` sibling |
| `businessSearchScreenRegistration` — "never hands a rule-supplied key straight to `t()`" | `t(rowsRoute.nameKey)` has **no string literal**, which is exactly what the original defect (`t(answeredFrom.key)`) looked like | ‼️ an **exemption registry naming that one source**, with the reason and the test that proves its keys resolve — the rule stays strict for everything else |

‼️ **"It is a variable" must never become a pass** on that guard: the defect it was written for was a variable.
