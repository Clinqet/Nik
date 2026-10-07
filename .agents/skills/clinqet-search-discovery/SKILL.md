---
name: clinqet-search-discovery
description: |
  **CORE FEATURE SKILL** — Work on Clinqet's Search & Discovery system: hybrid
  search (BM25 + vector + semantic) with smart semantic-skip optimization, 4-layer
  AI spell correction (protected → catalog → suggester → LLM), Cosmos-change-feed
  AI enrichment, vector embedding recovery, suggestion cache, search rate
  limiting, and the critical 81-field Parquet analytics pipeline. Analytics
  collection is NON-NEGOTIABLE — every metric and field must remain intact (§2
  CLAUDE.md).
  USE FOR: search query handling, suggester, facet computation, spell-check
  tuning, hybrid fusion weights, semantic-skip thresholds, AI enrichment of
  Service docs, vector embedding generation/recovery, suggestion cache TTL,
  rate-limit policies, search analytics schema, Parquet compaction, search
  interaction tracking. Applies to clinqetapi Controllers/Search/SearchController.cs
  + Controllers/Analytics/AnalyticsController.cs, clinqetinfrastructure/Services/
  Search/ (AzureSearchQuery + AzureSearchFacetService + QueryUnderstandingService
  + SuggestionCacheService + SearchRateLimitService + VectorEmbeddingRecoveryService
  + SpellCheck/CatalogDictionaryService et al.), clinqetfunctions
  Functions/SearchIndexSyncFunction + SearchJudgeFunction +
  VectorEmbeddingRecoveryFunction + SearchInteractionProcessorFunction +
  AnalyticsCompactionFunction, clinqetshared Enums/Search*.cs +
  SpellCorrectionSource.cs, clinqetinfrastructure/Services/Analytics/
  ParquetStorageService.cs.
---

# CLINQET SEARCH & DISCOVERY — COMPREHENSIVE SKILL

## RECENT CHANGES — 2026-10-06 (a service with no price is searchable)

See the `clinqet-prepared-providers` skill for the whole feature. What changed HERE:

- ‼️ **A price-less service is INDEXED and searchable.** It used to be parked (not indexable); it now goes live as "Price on request".
- ‼️ **`ProviderScoreCalculator.HasPrice` counts it as having answered the price question.** `Completeness` is a FRACTION over indexable services, so counting those rows as unpriced took a provider from 5/5 to 5/10 and demoted them — punishing the very providers this change exists to get listed.
- **A price FILTER still excludes them** (both predicates AND together); a price SORT puts them LAST, via a two-segment query (`fromPrice ne null`, then `eq null`) — which costs a second Azure Search query per country pair on a price sort.
- **"On request" appears in the price-type facet**, so a client showing the raw facet value must map it to its own localized label.

## ARCHITECTURE OVERVIEW

```
User query
   ↓
SearchController (rate-limit, capture context, SearchId)
   ↓
QueryUnderstandingService (4-layer spell correction)
   ↓
AzureSearchQuery.ExecuteHybridSearchAsync
   ├─ BM25 search (parallel)
   ├─ Vector KNN search (parallel)  
   └─ Semantic reranking (skipped if BM25+Vector are confident)
   ↓
RRF Fusion → quality gating → category coherence penalties
   ↓
Response (results + SearchId + diagnostics) + analytics event to Service Bus
   ↓
SearchInteractionProcessorFunction → 81-field Parquet to blob

Separately:
Cosmos change feed (ProviderData) → SearchIndexSyncFunction
   ↓
AI enrichment (CommonSearchPhrases + UserIntentPhrases) → embedding → Azure Search upsert

Daily:
AnalyticsCompactionFunction (Timer) → merges hourly Parquet shards into compacted-{YYYYMMDD}.parquet
```

CRITICAL: Per CLAUDE.md §2, search/suggest analytics MUST NEVER be broken — every metric and collected field is required. The Parquet schema is versioned; never remove columns, only add at end (nullable).

---

## ‼️‼️ RANKING POLICY — ONE RULE FOR BOTH PUBLIC LISTS (Phase 4, 2026-09-27; PLAN D-98 … D-107)

> **This section supersedes every older boost number, weight or range anywhere else in this file.** Proven on
> sandbox clones of the deployed services AND provider definitions (identical businesses, old vs new): every
> multiplier Azure applied equals the promise to 1e-3, all eight rules below hold, no rule the old met regressed.

**What decides what, in order**
1. **Relevance decides WHAT is shown** — RRF over BM25 / vector / semantic, the relevance floor and the diversity band
   all read `NormalizedScore`, which NO boost touches (D-R14 + D-104). The same query scores the same with or without
   the customer's location.
2. **The index scoring profile (product aggregation, D-98) orders**: new business ×1.32 fading over 90 days
   (`businessLiveSince`, first publication — cannot be reset) · trusted rating ×2.40 over 3.5→5.0 (the BOOST score) ·
   any live offer ×1.05, binary (`activeOfferCount` 0→1; services list only) · **Rule 1** distance ×4.25 on the row's own
   point (`location` / `geoPoint`, parameter `userLocation`) · **Rule 2** distance ×1.40 on `addressLocation` (parameter
   `userLocationBase`), both over the country gradient (D-62: CA/US 40 km, IN 15 km). **The provider list uses exactly the
   same numbers** (it had ×1.40 rating, which let a brand-new business outrank 200 × 4.8★ — P4-125). The provider list is
   `search=*`, so its order IS the profile. Rule 2 must stay below the rating boost (2.40) — see "ONE ROW PER SERVICE AREA".
3. **C#, after the gates (`ApplyOrderingBoosts` / `ProviderSearchService.ApplyBoostAndReorder`)**: "comes to your
   address" ×1.40 at the edge of an area that contains the customer → ×1.60 at its centre (`ServiceAreaCoverage`, settings
   `Search:ServiceAreaBoostMultiplier / ServiceAreaProximityBonus / MaxLocationBoostMultiplier`, bound through
   `ServiceAreaCoverageSettings` by BOTH readers) — applied on the typed search, on browse AND on the provider list, and
   ONLY where travel is the question; then the composite (`ProviderBoostComposer`, ≤ ×1.275, halved on a typed search).
4. **The bound (the owner's rule "nearer can always win")**: WHERE a provider is ≥ WHAT a provider is — every
   LOCATION multiplier together ≥ every QUALITY multiplier together. Location = the product of every distance function
   (4.25 × 1.40) × the coverage lift ×1.6 = **9.52**; quality = services 1.32 × 2.40 × 1.05 × 1.275 = **4.24**, providers
   1.32 × 2.40 × 1.275 = **4.04** (the score penalty only lowers quality).
   ‼️ **The coverage lift is a LOCATION factor, not a quality one** — its setting is literally
   `Search:MaxLocationBoostMultiplier`, and D-103 folds the same two signals into ONE multiplier on the leads path.
   Stating the bound as distance ALONE (as this line did until 2026-09-28) omits a ×1.6 that hits the same sort key
   outside `MaxCompositeFactor`'s clamp, and makes a 60% margin read as 0.21%. Guarded by
   `ScoringProfileGuardTests.WhereAProviderIs_CanOutweighEveryQualitySignalTogether`. Measured: the WORST business
   next door beats a perfect new business with an offer at the gradient edge (4.25 vs 3.30).
   A comes-to-you business is scored from each declared area's CENTRE (one row per area) and, since 2026-09-29, from its
   address by Rule 2; the address still enters no place FILTER once an area has a centre (`NoAreaCentre`). A radius cap
   does not bound the lift (25 km → 1000 km moved the break-even by 3 km); the leads path caps a declared radius at
   200 km, this path at nothing.

**The balance (owner's brief: serve customers the right business, promote new businesses fairly, reward good and
active ones)** — all proven: proven 4.8★ > brand-new (9.33 vs 8.23) · brand-new ≈ a proven 4.5★ business on day one
(8.228 vs 8.217) and below 4.6★ · brand-new > an old business with no reviews · no reviews (average) > proven-bad
(6.23 vs 4.25) · a first review moves a business gradually (×1.106), never a jump · the lift fades by day 45 · one
offer = three offers.

**Rating — two stored values from ONE rule (`clinqetcore/Utilities/RatingValue.cs`)**
- Trusted rating = (w × prior + Σ stars) ÷ (w + n), `Search:RatingSort:PriorReviewWeight` w = 5 and
  `PriorMeanRating` = 4.0 (both hosts; parity test). A SERVICE's prior is its business's trusted rating from its OTHER
  reviews (exact star counts, never counted twice) — a new service starts from its business's reputation.
- `…RatingSortScore` orders a list BY rating: no reviews = 0, listed last (sort by rating, best-rated city pages,
  banner, recommendations, the clients' re-orders).
- `…RatingBoostScore` is what the boost reads: identical, except NO reviews = the starting rating. A first 5★ review
  goes ×1.47 → ×1.62, never ×1.00 → ×1.62; a proven-bad business (50 × 1.5★ = 1.73) sinks below an unknown one.
- The plain stars and counts (`serviceRating`, `businessRating`, `…ReviewCount`) are for SHOWING and filtering only —
  no profile may name them (guard test), nor a sort score.
- **Review recency (§13.2, 2026-09-29).** Every sort/boost key takes `nowUtc`; each review is weighted
  `0.5 ^ (age in months / Search:RatingSort:ReviewHalfLifeMonths)` (18; 0 retires recency), its age measured from the
  middle of its bucket (`RatingBuckets.Decayed`). Buckets are `BusinessRating.RatingByMonth` /
  `ServiceRating.RatingByMonth` — star counts by the month the review was WRITTEN (`yyyy-MM`), months older than
  `Search:RatingSort:RatingBucketMonths` (24) folded into `yyyy`. ‼️ Decay applies only when the buckets account for every
  star in `RatingDistribution` (`RatingBuckets.AccountFor`); otherwise the plain counts stand. A service and its business
  decay on ONE scale or not at all, and the service's tally leaves the business's star by star. Writer:
  `ReviewRepository` (create/update/remove via `RatingBuckets.Add`/`Remove`, keyed by `review.CreatedAt` — an edit never
  re-dates; the repair path rebuilds them from approved reviews in the business's partition). Readers: both indexers
  (one `ratedAt` per card). `RatingSortRegistration` validates `ReviewHalfLifeMonths` 0–600 and `RatingBucketMonths` 1–120.

| Reviews | Trusted | Boost |
|---|---|---|
| none | sort 0 / boost 4.00 | ×1.47 |
| 1 × 1★ | 3.50 | ×1.00 |
| 1 × 5★ | 4.17 | ×1.62 |
| 2 × 5★ | 4.29 | ×1.73 |
| 200 × 4.8★ | 4.78 | ×2.19 |
| 50 × 1.5★ | 1.73 | ×1.00 |

**Fields** — public services: `serviceRatingSortScore`, `businessRatingSortScore`, `serviceRatingBoostScore` (hidden,
filterable only because Azure scores only filterable fields). Providers: `businessRatingSortScore`,
`businessRatingBoostScore`, `servesAtCustomersLocation` (`bool?`, null = yes). **The private catalogue carries NONE of
them** — it ranks nothing (`voiceCatalogScoring` has no functions); it keeps `serviceRating`/`serviceReviewCount` only
as facts the receptionist can say. ‼️ Every public-only services field needs
`[JsonIgnore(Condition = WhenWritingNull)]`, or the private write names a field the private index does not declare and
Azure refuses the WHOLE batch (`SearchPlaneConventionTests`).

**The ranking point** — ‼️ SUPERSEDED 2026-09-29: there is no single ranking point any more. Each public row carries
its OWN service area's centre in `location` / `geoPoint` (see "ONE ROW PER SERVICE AREA"); `ServiceAreaScoringPoint`
(P4-99's touching-areas centre) and `ServiceAreaDistance` are deleted. **A service done ONLY at the business's own premises
(`ServicePlace.IsAtBusinessOnly`) has ONE row, ranked from the business's ADDRESS** — the customer travels to it — and is
never given "comes to your address"; a provider whose services are all at its premises likewise
(`servesAtCustomersLocation = false`). The displayed distance is the address (22.9), else the nearest area centre.

**Offers — an offer is an offer (D-105, reversing P4-113's size rule)**: every LIVE offer counts the same — any kind
(percentage, fixed amount, buy-one-get-one, a free extra), any size; one offer or three earn the same ×1.05. ‼️ Never
judge an offer by its kind or size for ranking. What must be EXACT is "live" (D-107): only from its start date, until
it ends / is paused / deleted / used up, only on the services it applies to, never while the business is hidden — and
every reader (cards, the offers filter, the provider badge, recently viewed, the receptionist, Ask Clinket) sees the
same live set; checkout always re-checks Cosmos.

**Active businesses**: response and reliability are each worth up to +10% (`Search:Boost:ResponseWeight`,
`ReliabilityWeight`, cap `MaxCompositeFactor` 1.275 = the sum of every dial), shrunk toward a starting value so a new
business starts at a fair middle and one missed booking never drops a score 100 → 0 (P4-106). Money (plan tier) is at
most 0.025 of 0.275. **Proven-bad behaviour is a PENALTY multiplied onto that reward** (§13.1, `ProviderBoostComposer`,
`Search:Boost:ResponsePenalty` / `ReliabilityPenalty` / `AcceptancePenalty`, floor `PenaltyCombinedFloor` 0.50) — see
"SCORE PENALTY".

**Guards that fail the build**: `ScoringProfileGuardTests` (the numbers; sort scores never boosted; the same rating and
distance on both lists; the bound includes the composite) · `ProviderIndexDefinitionConventionTests` ·
`SearchPlaneConventionTests` · `TrustedRatingTests` (Functions) · `ServiceAreaCoverageTests` (a radius of 0 must never
yield NaN) · `AzureSearchQueryBoostOrderTests` (the lift reorders only; the match score is identical with or without a
location; an at-premises service is never lifted) · `ProviderSearchComesToYouTests` · `ProviderSearchIndexerTests` /
`AzureSearchIndexerRemovalFirstTests` (the at-premises point, the boost score, nothing on the private card).

**Before you change any of it**: the golden rule — review it from every side (customer, new business, established,
proven-bad, someone gaming it, every kind of offer/price/review count incl. zero, every reader) and PROVE the
before/after on sandbox clones (`scratchpad` probes: clone the deployed definitions into uniquely named indexes, upload
identical businesses, compare, delete). Reading code shows what it claims; only running it shows what it does.

## CONTROLLERS

### `SearchController.cs` (`clinqetapi\Clinqet.API\Controllers\Search\`)

| Verb | Route | DTO In | DTO Out | Rate Limit | Auth |
|------|-------|--------|---------|-----------|------|
| GET | `/api/search/services` | `SearchRequestDto` (query) | `ApiResponse<SearchResponseDto>` | 60/min anonymous, 200/min auth | `[AllowAnonymous]` |
| POST | `/api/search/track` | `SearchInteractionRequestDto` | `ApiResponse` (202) | None | `[AllowAnonymous]` |
| GET | `/api/search/providers` | `SearchRequestDto` | `ApiResponse<RecommendedProvidersResponseDto>` | Same | `[AllowAnonymous]` |
| GET | `/api/search/filters` | `FiltersRequestDto` | `ApiResponse<FiltersResponseDto>` | 30/min | `[AllowAnonymous]` |

`/services` flow has 3 modes:
- **Case A (Recommendation)**: no text, no filters, **no explicit sort** → personalized recs + wildcard hybrid → merged + paginated.
- **Case B (Browse)**: no text, and filters OR an explicit sort → wildcard browse in that order. ‼️ `anchorsRecommendations =
  !hasFilters && !request.HasExplicitSort()` drives both the in-country path and the `OutsideOurCountries` invocation mode:
  a recommendation block above a chosen sort ignored every sort (LIVE-PROOF L2, 2026-09-29).
- **Case C (Query)**: text → full hybrid pipeline.

Captures: SearchId (32-char hex Guid), session, device, location, IP, user, correlationId. Registers SearchId in `ISearchIdRegistry` with `SearchInvocationMode` to validate `/track` calls.

**Country filter (`X-Client-Country`):** every country-scoped endpoint resolves the geo header via `IClientCountryResolver.ResolveFilterCountry` (`clinqetinfrastructure\Services\Language\ClientCountryResolver.cs`, singleton). Known ISO code → canonical full name (filtered); **`ZZ`/missing/unknown → `null` ⇒ NO country filter** (never guess) + `LogCritical` + throttled admin alert (`AdminAlertType.MissingClientCountryHeader`, 15-min cooldown). There is **no 400** on a missing header (the old `RejectMissingCountryHeader` is removed). The header is injected by Front Door's `ClientInfoHeaders` rule — per-stamp/region-pinned hosts now also attach it (see `clinqet-deployment`). The same resolver scopes Discovery/Category/Broadcast/AI. Analytics records the **raw** header (incl. `zz`), never the resolved value.

### `AnalyticsController.cs` (`clinqetapi\Clinqet.API\Controllers\Analytics\`)
- `POST /api/analytics/track` — batch (max 100) generic events. Fire-and-forget to `IUserInteractionAnalyticsService.TrackBatchAsync`.

---

## SERVICES (`clinqetinfrastructure\Services\Search\`)

### `QueryUnderstandingService.cs`
Constructor deps: `HttpClient, ICatalogDictionaryService _catalog, ISearchTopology _topology (the suggester resolves ResolvePublic(null).Single.ServiceClient), IOptionsMonitor<SearchSpellCheckSettings> _spellSettings, IEmbeddingService _embeddingService (refusal detection), IMemoryCache _memoryCache, ICategoryCacheService _categoryCacheService, ICategoryRepository _categoryRepository, IServiceBusService, IAdminAlertCooldownService, IOptions<ServiceBusSettings>`.

**Failure contract (2026-07-02): NEVER throws, ALWAYS degrades.** `ProcessQueryAsync` wraps the whole pipeline in a catch-all that returns the ORIGINAL query on any failure — a spell-check crash/timeout/refusal can never fail a search request or block a broadcast/quote classification (the broadcast classify path shares this pipeline). Failures dispatch a cooldown-gated (15-min per reason) `SearchQualityDegraded` admin alert via `DispatchSpellCheckFailureAlert`: `pipeline_crash` (High), `llm_http_{status}`/`llm_timeout`/`llm_failure` (Medium), `llm_refusal` (Low). Caller-cancelled requests never alert. NOTE: the SAME `Search:SpellCheck` settings (incl. the whole `Llm` block — DeploymentName, TimeoutSeconds, MaxOutOfCatalogTokenRatio, SystemPrompt/UserPromptTemplate, RefusalPhrases) drive BOTH search-query correction AND broadcast-classification text correction; the broadcast path is additionally gated by `BroadcastClassification:EnableSpellCorrection`/`EnableAISpellCorrection` (separate keys). Top-level `Search:SpellCheck:TimeoutSeconds` = the HttpClient timeout for the LLM calls; `Llm:TimeoutSeconds` = the per-call LLM budget; `TotalTimeoutMilliseconds` = the whole-pipeline budget.

Public methods:
- `Task<QueryUnderstandingResult> ProcessQueryAsync(string originalQuery, bool skipAI, CancellationToken)` — main entry; executes 4-layer pipeline.
- `Task<bool> IsKnownWordAsync(string word, CancellationToken)`.
- `Task PreloadVocabularyAsync(CancellationToken)`.
- `(int? EditDistance, double? Confidence) GetAnalyticsCorrectionMetrics(QueryUnderstandingResult result)`.

### `AzureSearchQuery.cs`
Public methods:
- `Task<HybridSearchResultDto> ExecuteHybridSearchAsync(string searchText, SearchRequestDto, CancellationToken)` — core orchestrator.
- `Task<HybridSearchResultDto> ExecuteDiscoveryModeAsync(...)` — wildcard for Browse mode.
- `Task<List<HybridSearchItemDto>> ExecuteBM25SearchAsync(...)`.
- `Task<List<HybridSearchItemDto>> ExecuteVectorSearchWithEmbeddingAsync(...)`.
- `Task<List<HybridSearchItemDto>> ExecuteSemanticSearchAsync(...)`.
- `Task<(fusedResults, filteredResults, preThreshold)> FuseResultsAsync(...)` — RRF + quality gating.
- `Task<HybridSearchExpansionDto> TryExpandSearchAsync(...)` — radius/filter expansion fallback.

### `AzureSearchFacetService.cs`
- `Task<FacetComputationResult> ComputeFacetsAsync(FiltersRequestDto, CancellationToken)` — facet counts with disjunctive logic + an in-memory cache (`Search:Facets:CacheTtlSeconds` 1800, `MaxCacheEntries` 4000). ‼️ Its key carries the process-local index generation, and ordinary writes never bump it in the API process (the Functions host indexes them) — so in the API the TTL is the whole freshness bound.

### `SuggestionCacheService.cs`
- `bool TryGet<T>(string key, out T? value)` — refresh LRU touch on access.
- `void Set<T>(string key, T value)` — evict oldest 20% if at capacity.
- `string BuildKey(...)` — composite of query+top+country+locale+catId+subcatId+city+lat+lng+scope, joined with a U+001F separator (user text with `_` cannot forge field boundaries). Lookup AND store both use the RAW (uncorrected) query text (S12); empty responses are cached too (repeat no-result probes stop hitting Azure).
- LRU cap `Search:Caching:SuggestionCacheMaxSize` (5000), TTL `Search:Caching:SuggestionCacheExpirationMinutes` (60).

### `SearchRateLimitService.cs`
- `bool TryAcquire(string clientId, int limitPerMinute)` — weighted sliding 1-minute window per client (current + previous-window count decayed by elapsed fraction ⇒ no 2x boundary burst); `TimeProvider` ctor seam (`TimeProvider.System` registered in API Program.cs); background cleanup of stale entries every minute.

### `VectorEmbeddingRecoveryService.cs`
- `Task<VectorEmbeddingRecoveryResult> RecoverAsync(CancellationToken)` — scans each services index for `hasEmbedding eq false and isActive eq true and isPrimaryArea eq true` (one row per service — its area rows share one embedding) — no `isListed` (P4-46), so a paused service has a real vector the moment it returns, re-indexes up to `MaxDocumentsPerRun` (default 500), batch size `BatchSize` (default 50).
- Saturation alert if missing-embedding ratio ≥ `SaturationRatioThreshold` (default 0.02).
- Failure samples first 20 per run → AdminAlert.

### `SpellCheck\CatalogDictionaryService.cs` (and `CatalogDictionaryRefreshHostedService`)
- Live vocabulary (CommonEnglishWords from appsettings + DomainVocabulary from catalog + live category tokens).
- Frequency gate: token must appear ≥ `Search:SpellCheck:Catalog:MinFrequency` times.
- Background refresh hosted service for catalog updates.

---

## 4-LAYER SPELL CORRECTION PIPELINE

### Layer 0 — Protected Words
Source: `SearchSpellCheckSettings.ProtectedWords` + `ProtectedTokenRuleSettings`.
Rules:
- `MinTokenLength`, `ProtectMixedAlphaNumericTokens`, `ProtectAllUppercaseTokens`, `ProtectShortConsonantHeavyTokens`, `MaxVowelsInShortToken`.
Output: marked for skip; `SpellCorrectionSource = None`.

### Layer 1 — Live Catalog
`CatalogDictionaryService.IsReady` + frequency gate. If token in catalog → skip to next candidate (high precision). Counts toward `SpellCorrectionSource = CommonEnglish` or `DomainVocabulary` indirectly.

### Layer 2 — Azure AI Search Suggester
Trigger: `settings.Suggester.Enabled && _catalog.IsReady && budget available`.
Per-token timeout: `SuggesterSpellCheckSettings.TimeoutMilliseconds` (default 100ms).
Options: `UseFuzzyMatching=true, Size=Top (10)`.
Post-processing gates (every gate must pass):
- Damerau-Levenshtein distance ≤ `MaxEditDistance` (short tokens use `ShortTokenMaxEditDistance`).
- Confidence (`1 - editDistance/max(tokenLen, suggLen)`) ≥ `MinConfidence`.
- `RequireCatalogMembership=true` → suggestion must be in catalog.
- `RequireSameFirstCharacterForShortTokens=true` for short tokens.
- Ambiguity margin (multiple equal-score suggestions → reject as ambiguous).
Output: `(Word, EditDistance, Confidence)` → `SpellCorrectionSource = DomainVocabulary`.

### Layer 3 — LLM Fallback
Trigger: `!skipAI && settings.Llm.Enabled && trimmed.Length ≤ MaxQueryLength && CanEnterLlmLayer()`.
Model: `SearchSpellCheckSettings.Llm.DeploymentName` (Azure OpenAI deployment name).
API version: `AIService:ApiVersion` (default `"2024-12-01-preview"`).
Temperature: 0.0 (deterministic). MaxCompletionTokens: 50 default.
Refusal detection: embedding-based cosine similarity against `RefusalPhrases` ≥ `RefusalSimilarityThreshold` (NOT substring matching).
Validation gates (ALL must pass):
- No protected tokens changed.
- Changed token count ≤ `MaxChangedTokens`.
- Out-of-catalog ratio ≤ `MaxOutOfCatalogTokenRatio` (allows live category tokens via `AllowLiveCategoryFallback`).
- Total Damerau-Levenshtein ≤ `MaxTotalEditDistance` (typically ~4).
Output: corrected string or null → `SpellCorrectionSource = AICorrection`.

Total budget: `Search:SpellCheck:TotalTimeoutMilliseconds` (default ~1500ms) with `LlmMinBudgetMilliseconds` reserved. A fresh LLM token carrying at least the reserved floor is created whenever the remaining total budget falls below `LlmMinBudgetMilliseconds` (not only after full expiry). An LLM echo (returns the query unchanged) is no verdict — the Layer-2 suggester correction is kept; only an accepted, different LLM output overrides it (and rebuilds `WordCorrections` from the LLM diff). Suggester corrections are spliced back at the original token offsets, preserving punctuation/spacing of unchanged regions. `IsKnownWordAsync` returns true when the catalog is not ready (skip-correction semantics) and checks `ContainsAtLeast(word, Catalog.MinFrequency)`. Refusal-phrase embeddings are cached under a key that includes a hash of the current `RefusalPhrases` list so options hot-reload takes effect.

### `QueryUnderstandingResult` shape
```csharp
string OriginalQuery, CorrectedQuery;
SpellCorrectionSource CorrectionSource;
CorrectionMethod CorrectionMethod;       // None / Vocabulary / AI / etc.
double? CorrectionConfidence;
int WordsAnalyzed, WordsCorrected, ProtectedWordsFound;
bool PhraseMatchFound, AIFallbackUsed, CaseOnlyChange;
int? ActualEditDistance;
double? ActualCorrectionConfidence;
long SpellCorrectionTimeMs;
Dictionary<string, string> WordCorrections;
```

---

## HYBRID SEARCH FLOW (`AzureSearchQuery.ExecuteHybridSearchAsync`)

1. Validate query (reject non-alphanumeric-only).
2. Call `QueryUnderstandingService.ProcessQueryAsync()` → correction metadata.
3. Preprocess (strip stop words, generic service words).
4. If empty → wildcard fallback, mark `WildcardFallbackApplied=true`.
5. Decide BM25 / Vector / Semantic activation flags.
6. Get query embedding (5-min cache).
7. Run BM25 + Vector in parallel.
8. **Semantic-skip logic** — if both BM25+Vector succeeded:
   - Count high-confidence results (BM25 ≥ 0.60, Vector ≥ 0.60).
   - Compute coherence (Jaccard overlap + rank-overlap bonuses).
   - If coherence ≥ `Search:Semantic:SkipCoherenceThreshold` (0.50) AND sufficient results → skip semantic.
9. Run Semantic only if not skipped.
10. RRF fusion → category coherence penalties → filter by thresholds.
11. Return results + metrics (SearchId, scores, exec times, strategy counts, correction details).

### Settings (excerpt)
```
Search:Semantic:Enabled                      = true
Search:VectorKNearestNeighbors               = 50
Search:BM25Weight                            = 0.40
Search:VectorWeight                          = 0.35
Search:SemanticWeight                        = 0.25
Search:RRFKConstant                          = 60
Search:MaxResultDepth                        = 500
Search:Semantic:SkipBM25Threshold            = 0.60
Search:Semantic:SkipVectorThreshold          = 0.60
Search:Semantic:SkipMinResults               = 3
Search:Semantic:SkipCoherenceThreshold       = 0.50
Search:EnableCategoryCoherence               = true
Search:CategoryCoherence:Threshold           = 0.55
Search:CategoryCoherence:MediumPenaltyThreshold = 0.35
Search:CategoryCoherence:LowPenaltyThreshold = 0.20
Search:DualCoherenceConfidenceThreshold      = 0.85
Search:EnableSearchExpansion                 = true
Search:RadiusExpansionMultiplier             = 3.0
Search:Expansion:MinNormalizedScore          = 30.0
Suggestion:EnableVectorSearch                = true
Suggestion:BM25MinScore                      = 0.3
Suggestion:VectorMinScore                    = 0.50
Suggestion:BM25Weight                        = 0.55
Suggestion:VectorWeight                      = 0.45
Suggestion:RRFConstant                       = 60
Suggestion:MaxResultsPerSource               = 4
```

Defaults in options classes must mirror `appsettings.json` (memory `feedback_appsettings_class_defaults`).

---

## ENUMS (`clinqetshared\Enums\`)

- **`SearchInvocationMode`**: `Query, BrowseCatalog, Recommendation, ProviderSearch`.
- **`SpellCorrectionSource`**: `None, CommonEnglish, CategoryVocabulary, DomainVocabulary, PhraseVocabulary, KeyboardTypo, AICorrection`.
- **`CorrectionMethod`**: `None, Vocabulary, Category, CommonEnglish, Keyboard, Mixed, AI`.
- **`SearchMessageKey`**: `None, NoResults, CorrectedExact, CorrectedSemantic, CorrectedRelated, Related, Expanded, Partial`.
- **`SearchMatchQuality`**: `None, Exact, CorrectedExact, Semantic, CorrectedSemantic, Related, CorrectedRelated, Expanded, Partial, Prefix, Strong, Keyword`.
- **`SearchMatchType`**: `Prefix, Exact, Strong, BM25, Vector, Weak, Semantic, Fuzzy, Hybrid`.
- **`SearchSortBy`**: `Relevance, Distance, PriceLow, PriceHigh, Rating, ReviewCount, Newest`.
- **`SearchRetentionOutcome`**: `Kept, DroppedByThreshold, DroppedByFilter`.
- **`SemanticSkipReason`**: `None, NullResults, VectorOnlyHighConfidence, BM25WeakVectorModerate, VectorWeak, BothWeak, LowOverlap, HighConfidence, LowCoherence, SemanticNotRequested, SkipFeatureDisabled, ConfidentResults, CategoryFilterConfidentResults`.
- **`SearchLatencyBucket`**: `Fast, Normal, Slow, VerySlow, Timeout`.
- **`SuggestScope`**: `All, Completions, TopHits`.
- **`LocationSource`**: `RequestCoordinates, RequestCity, CustomerAddress, RecommendationCentroid, CountryOnly`.

All have `[JsonConverter(typeof(JsonStringEnumConverter))]`.

---

## AI ENRICHMENT — `SearchIndexSyncFunction.cs` (`clinqetfunctions\Clinqet.Communications\Functions\`)

Trigger: Cosmos change feed on `ProviderData` container.
- Lease container: `%CosmosDb:ChangeFeed:LeaseContainerName%`.
- Lease prefix: `%CosmosDb:ChangeFeed:ProviderDataUnifiedLeasePrefix%`.
- Function name `ProviderDataUnifiedProcessor`; max items per invocation: 100 (an attribute int, not a setting).
- Feed poll delay and lease intervals: the SDK defaults (5 s poll). Extension 4.x reads them from the attribute only,
  which sets none; host.json `cosmosDB` keys other than `connectionMode` are inert (P4-42, `clinqet-function-app`).
- StartFromBeginning: TRUE — deliberate (2026-08-09 correction): a fresh lease prefix must rebuild an EMPTY index; the enrichment/embedding hash guard bounds replay AI cost. See the Phase-1 section at the end.

‼️ **THE STALL BLIND SPOT — `ChangeFeedStallDetector` (`Clinqet.Communications\Services\`, singleton).**
Every per-document alert path in this function (`failedServices`, `failedBusinesses`, `failedProviderDocs`,
degraded legs) runs **INSIDE the try, AFTER the batch body** — so a batch that **THROWS** reaches none of them.
‼️ P4-107 (read from the 4.15 extension): a batch whose function THROWS is checkpointed and never redelivered,
so a throw LOSES the batch unless the catch names every business it touched for replay — which it now does
before rethrowing. A continuation that stops moving, as below, therefore points at an invocation that never
completes, not at a thrown one. Either way the feed failed **in total silence**.
Proven live 2026-08-18: CA sat on one LSN for hours, its lease renewing every 60s while the
continuation never moved, services stuck at 566 and three Active businesses with no provider document — and
**zero alerts**. The only visible signal was a lease continuation that had stopped advancing.
- The catch now calls `RecordFailureAsync` **before** the rethrow; the success path calls `RecordSuccess`.
- ‼️ **Consecutive failures are the signal, never a single throw** (`StallAlertAfterConsecutiveFailures`, 3):
  one transient batch failure is repaired by its per-business replays and must stay silent, or the alert becomes noise.
- ‼️ **Suppressed for `StallAlertSuppressionMinutes` (30) after firing** — a persistently failing feed must
  produce ONE alert, not one per batch. A success clears both the streak and the suppression.
- Alert `AdminAlertType.ChangeFeedBatchStalled` (Critical), gated by `EnableChangeFeedStallAlerts`.
  Publishing failure is swallowed: alerting must never replace the batch exception the caller rethrows.
- ‼️ **P4-107: a failed batch replays EVERY business it touched** — one `BusinessReindex` per business (plus an
  `OfferBoundaries` replay per business whose offers changed), never the old single message carrying only
  `firstBusinessId`, which repaired one business and silently lost the rest.

Processing logic:
1. Parse JSON array of change events.
2. Categorize by `type`:
   - `Service` → re-index or delete.
   - `BusinessProfile, ServiceArea, Offer, Availability, BusinessRating, Portfolio` → full business reindex.
3. Per-service `IPerServiceLockRegistry` serialization (no concurrent writes).
4. Logic per Service:
   - If `isDeleted || !isActive || approvalStatus != Approved` → `IAzureSearchIndexer.DeleteServiceFromIndexAsync()`.
   - Else: fetch + index:
     - AI call → `CommonSearchPhrases`.
     - AI call → `UserIntentPhrases`.
     - Embedding call → vector embedding (3072-dim, HNSW).
     - Index upsert.
5. AI validation for `PendingAIValidation` (cross-link `clinqet-service-listing` skill).
6. Transient retry: exponential 500ms base, 2 retries.
7. Every failed document, business, provider document or offer boundary → its OWN replay on `%ServiceBusSettings:ChangeFeedFailuresQueueName%` (P4-107; the `EnablePerDocumentFailureTracking` switch is deleted). The replay converges from current Cosmos state; its final delivery alerts and dead-letters. A replay that cannot be queued is named in a Cosmos admin alert.

---

## VECTOR EMBEDDING RECOVERY — `VectorEmbeddingRecoveryFunction.cs`

Trigger: TimerTrigger with `%Search:VectorRecovery:Schedule%`.

Calls `VectorEmbeddingRecoveryService.RecoverAsync`. Filter `hasEmbedding eq false and isActive eq true and isListed eq true`. Batched re-indexing.

---

## SEARCH JUDGE — `SearchJudgeFunction.cs`

Trigger: TimerTrigger with `%Search:Judge:TimerSchedule%`.

Periodically samples search results to compute quality metrics (currently used for offline evaluation; results stored in analytics blobs).

---

## ANALYTICS PARQUET PIPELINE — CRITICAL CONTRACT (NEVER BREAK)

Per CLAUDE.md §2: search analytics collection MUST NEVER be broken. Every field is required.

### Service Bus → Function → Parquet → Compaction

```
SearchController emits SearchAnalyticsMessage to SB queue %ServiceBusSettings:SearchInteractionsQueueName% (likely "search-interactions" for both searches and interactions; topic split TBD)
   ↓
SearchInteractionProcessorFunction (batched ServiceBusTrigger)
   ↓
ParquetStorageService.AppendSearchAnalyticsBatchAsync → flatten 81 columns → ParquetWriter → blob
   ↓
Blob path: search-analytics/year={YYYY}/month={MM}/day={DD}/search_{timestamp}.parquet
   ↓
AnalyticsCompactionFunction (TimerTrigger, %AnalyticsCompactionSettings:CronExpression%, default "0 0 2 * * *")
   ↓
Streams Parquet shards with dedup (by EventId) + sort by EventTimestamp
   ↓
compacted-{YYYYMMDD}.parquet uploaded; marker _compacted.json written; originals deleted
```

Distributed lock via blob lease (60s, renewed every 30s). `ParallelStreams` (3) concurrent stream operations. Row group size: `RowGroupTargetSize` (50000 rows). Streams covered:
- `search-analytics`, `suggestion-analytics`, `provider-setup`, `broadcast`, `filtered-search-results`, `search-interactions`, `search-top-results`, `search-filter-removals`, `broadcast-matched-services`, `broadcast-rejected-providers`.

### SearchAnalyticsSchemaVersion = 1

Defined in `ParquetStorageService.cs`. 81 fields in order — NEVER reorder, NEVER remove. New fields go at END, marked nullable. Bump `SchemaVersion` on any change.

Full schema:
| # | Field | Type | Nullable |
|---|-------|------|----------|
| 1 | EventId | string | N |
| 2 | EventTimestamp | DateTime | N |
| 3 | IngestedAt | DateTime | N |
| 4 | CorrelationId | string | N |
| 5 | EventType | string | N |
| 6 | UserId | string | Y |
| 7 | SessionId | string | Y |
| 8 | DeviceId | string | Y |
| 9 | IpAddress | string | Y |
| 10 | UserAgent | string | Y |
| 11 | SearchId | string | N |
| 12 | SearchText | string | Y |
| 13 | UseSemanticSearch | bool | N |
| 14 | CategoryId | string | Y |
| 15 | SubcategoryId | string | Y |
| 16 | MinPrice | decimal? | Y |
| 17 | MaxPrice | decimal? | Y |
| 18 | MinRating | double? | Y |
| 19 | City | string | Y |
| 20 | State | string | Y |
| 21 | HasActiveOffers | bool | N |
| 22 | MinYearsOfExperience | int? | Y |
| 23 | AvailableOnDay | string | Y |
| 24 | Latitude | double? | Y |
| 25 | Longitude | double? | Y |
| 26 | Radius | double? | Y |
| 27 | Unit | string | Y |
| 28 | AppliedUnit | string | Y |
| 29 | SortBy | string | Y |
| 30 | SortDirection | string | Y |
| 31 | Page | int | N |
| 32 | PageSize | int | N |
| 33 | TotalResultsCount | int | N |
| 34 | MatchQuality | string | Y |
| 35 | TotalResponseTimeMs | long | N |
| 36 | EmbeddingGenerationTimeMs | long | N |
| 37 | SearchExecutionTimeMs | long | N |
| 38 | BM25ExecutionTimeMs | long | N |
| 39 | VectorExecutionTimeMs | long | N |
| 40 | SemanticExecutionTimeMs | long | N |
| 41 | FusionTimeMs | long | N |
| 42 | CategoryCoherenceTimeMs | long | N |
| 43 | SpellCorrectionTimeMs | long | N |
| 44 | EmbeddingUsed | bool | N |
| 45 | SemanticSearchUsed | bool | N |
| 46 | FilteredByThreshold | int | N |
| 47 | BM25ResultCount | int | N |
| 48 | VectorResultCount | int | N |
| 49 | SemanticResultCount | int | N |
| 50 | FinalResultCount | int | N |
| 51 | FusionStrategy | string | Y |
| 52 | CacheHit | bool | N |
| 53 | OriginalQuery | string | Y |
| 54 | ProcessedBM25Query | string | Y |
| 55 | CorrectedQuery | string | Y |
| 56 | SpellCorrectionSource | string | Y |
| 57 | CorrectionMethod | string | Y |
| 58 | CorrectionConfidence | double? | Y |
| 59 | WordsAnalyzed | int | N |
| 60 | WordsCorrected | int | N |
| 61 | ProtectedWordsFound | int | N |
| 62 | PhraseMatchFound | bool | N |
| 63 | AIFallbackUsed | bool | N |
| 64 | HasExactMatch | bool | N |
| 65 | ResultType | string | Y |
| 66 | SemanticSkipped | bool | N |
| 67 | SemanticSkipReason | string | Y |
| 68 | BM25ConfidentCount | int? | Y |
| 69 | VectorConfidentCount | int? | Y |
| 70 | StrategyOverlapCount | int? | Y |
| 71 | CoherenceScore | double? | Y |
| 72 | ExpansionAttempted | bool? | Y |
| 73 | ExpansionSuccess | bool? | Y |
| 74 | ExpansionReason | string | Y |
| 75 | OriginalRadiusKm | double? | Y |
| 76 | ExpandedRadiusKm | double? | Y |
| 77 | RemovedFilters | string | Y |
| 78 | FilterCount | int? | Y |
| 79 | Country | string | Y |
| 80 | Language | string | Y |
| 81 | DeviceType | string | Y |
(Additional optional columns: AppVersion, FeatureFlagsJson, FinalQuery, EffectiveQuery, DisplayedCorrection, ActualEditDistance, ActualCorrectionConfidence, EffectiveRrfK, OriginalFiltersApplied, InvocationMode — verify exact set against current `ParquetStorageService.FlattenSearchAnalytics`.)

### User Interaction Parquet Schema v2 (41 fields — bumped 2026-05-19)

UserInteractionSchemaVersion = 2 (append-only). Driven by `POST /api/analytics/track` from the customer app.

Columns 1–38 unchanged from v1. **v2 appends columns 39–41:**

| # | Field | Type | Nullable | Notes |
|---|-------|------|----------|-------|
| 39 | Surface | string | Y | Where in the app (e.g. `home`, `search_results`, `provider_profile.services_tab`, `cart_checkout`). Auto-inferred from pathname when not passed; callers may override. |
| 40 | LinkedSearchId | string | Y | Joins downstream actions back to the originating `SearchId` (1-to-1 with search-analytics row). Captured client-side in sessionStorage when `fetchSearchResults` returns a `searchId`; auto-attached to subsequent cart/booking/message events for 30 minutes. |
| 41 | ScrollDepthPercent | int | Y | 0–100, emitted at 25/50/75/100 milestones by `useScrollDepth` hook. Sampled at 10% server-side (ContentEngagement). |

Accepted `EventType` values from customer-track (server allow-list, kept in sync with `AnalyticsProcessorFunction.UserInteractionEventTypes`):
- Legacy: `PageView, ServiceView, ProviderProfileView, BookingInitiated, QuoteRequested, FilterApplied, ProfileView` — these still drive `RecentlyViewedService` and `RecommendationEngineService`. Do not remove.
- Customer-app v2: `CartInteraction, BookingAction, QuoteAction, MessagingAction, ReviewAction, AuthAction, SettingsAction, NavigationAction, SearchAction, ResultClick, ContentEngagement, ConsentAction, ErrorEncountered`.

Verbs live in `EventSubType` (snake_case), not in the enum. Example sub-types: `add`, `remove`, `checkout_submit`, `login_success`, `login_fail`, `otp_verified`, `tab_switch`, `share_open`, `scroll_depth`, `dwell`, `cookie_accept`, `api_error`.

Server-side guarantees enforced in `UserInteractionAnalyticsService.BuildMessage`:
- **Lat/Lng rounded to `AnalyticsSettings.LatLngDecimalPrecision` (default 2 decimals, ~1.1 km)** — keeps analytics outside CPRA "precise geolocation" SPI classification. Live search is unaffected (it reads coords from the request, not from analytics).
- **PII scrub on SearchQuery + Metadata values** — email and phone patterns replaced with `[REDACTED_PII]`. Raw query is otherwise preserved (lawful under legitimate interest in IN/USA/Canada with disclosure).
- **Metadata caps**: max 20 KV pairs, max 256 chars per value, keys must match `^[a-z][a-z0-9_]{0,63}$`.
- **PageView suppression**: pathnames in `AnalyticsSettings.SuppressedPageViewPathPrefixes` (auth token routes) are dropped to avoid storing reset/verify tokens.
- **Sampling**: `AnalyticsSettings.SamplingRates` per EventType, default `ContentEngagement=0.1, NavigationAction=0.25`.
- **Rate limiting**: `RateLimitPerMinuteAnonymous` (200) and `RateLimitPerMinuteAuthenticated` (600), reuses `ISearchRateLimitService`.

Frontend tracker (`clinqetwebuserapp/services/analyticsTracker.js`) exports per-family helpers: `trackAuth, trackCart, trackBookingAction, trackQuoteAction, trackMessaging, trackReview, trackSettings, trackNav, trackSearchAction, trackResultClick, trackEngagement, trackConsent, trackError`, plus legacy `trackServiceView, trackProviderProfileView, trackBookingInitiated, trackQuoteRequested, trackPageView, trackFilterApplied, trackProfileView`. Engagement hooks at `clinqetwebuserapp/hooks/useAnalyticsEngagement.js` (`useDwell`, `useScrollDepth`).

### Search Interaction Parquet Schema (smaller, 13+ fields)

| # | Field | Type |
|---|-------|------|
| 1 | EventId | string |
| 2 | EventTimestamp | DateTime |
| 3 | IngestedAt | DateTime |
| 4 | CorrelationId | string |
| 5 | EventType | string |
| 6 | UserId | string? |
| 7 | SessionId | string? |
| 8 | DeviceId | string? |
| 9 | IpAddress | string? |
| 10 | UserAgent | string? |
| 11 | SearchId | string |
| 12 | ServiceId | string (empty when the interaction is a provider-surface card without a top service; BusinessId carries the identity) |
| 13 | BusinessId | string? |
| 14 | InteractionKind | string? |
| 15 | Position | int |
| 16 | Page | int |
| 17 | PageSize | int |
| 18 | DwellMs | long? |
| 19 | SearchText | string? |
| 20 | CategoryId | string? |
| 21 | SubcategoryId | string? |
| 22 | Country | string? |
| 23 | City | string? |
| 24 | DistanceKm | double? |
| 25 | ScrollDepthPercentile | int? |
| 26 | VisibleResultIdsJson | string? |
| 27 | InvocationMode | string? |

Linked to SearchAnalytics via `SearchId` (1-to-N).

`POST /api/search/track` (U14, 2026-07-02): `SearchInteractionRequestDto` requires ServiceId OR BusinessId (IValidatableObject; ServiceId preferred when present). BusinessId-only events flow end-to-end (web hook `useSearchInteractionTracking` + `searchService.trackSearchInteraction` allow them); `FlattenSearchInteraction` coerces null ServiceId to string.Empty at write time — the Parquet schema itself is UNCHANGED (still v1, 27 fields).

---

## SETTINGS SUMMARY

Full configuration namespaces:
- `Search:` (core, semantic skip, category coherence, generic words, action intent, stop words)
- `Search:SpellCheck:` (Catalog, Suggester, Llm, ProtectedWords, ProtectedTokenRules)
- `Search:Caching:` (Suggestion + Embedding)
- `Search:Facets:` (CacheEnabled, CacheTtlSeconds, MaxCacheEntries, DefaultSet, Top*, RatingBuckets, YearsOfExperienceBuckets)
- `Search:RateLimiting:` (Enabled + per-endpoint RequestsPerMinute + AuthenticatedRequestsPerMinute)
- `Search:VectorRecovery:` (BatchSize, MaxDocumentsPerRun, SaturationRatioThreshold, AlertCooldownMinutes, Schedule)
- `Search:Judge:` (TimerSchedule)
- `AIService:` (Endpoint, ApiKey, ApiVersion, ReasoningEffort) — shared with `clinqet-ai-assistant`.
- `AnalyticsSettings:` (EnableAnalytics, StorageContainerName, TrackFilteredResults, FilteredResultsCount, FilteredByThresholdAlertLimit, EnableUserInteractionAnalytics)
- `AnalyticsCompactionSettings:` (Enabled, CronExpression, LookbackDays, ParallelStreams, RowGroupTargetSize)
- `Suggestion:` (EnableVectorSearch, EnableSpellCorrection, BM25MinScore, VectorMinScore, BM25Weight, VectorWeight, RRFConstant, MaxResultsPerSource)
- `ServiceBusSettings:SearchInteractionsQueueName`, `ChangeFeedFailuresQueueName`, `AdminAlertsQueueName`

Class-default values must mirror `appsettings.json` exactly.

---

## RATE LIMITING

`SearchRateLimitService.TryAcquire(clientId, limitPerMinute)` — weighted sliding 1-minute window (no 2x boundary burst). Client id = userId if authenticated, otherwise the SPOOF-PROOF IP from `BaseController.GetRateLimitClientIp()` (LAST X-Client-IP value — Front Door appends `{client_ip}` after any client-supplied value — falling back to `Connection.RemoteIpAddress`; NEVER X-Forwarded-For). `GetClientIpAddress()` remains the raw analytics capture. Front Door rules now use headerAction=Overwrite (networking.json) so client-supplied X-Client-IP/X-Client-Country are replaced at the edge.

Defaults:
- Search anonymous: 60/min; authenticated: 200/min.
- Suggest anonymous: 120/min; authenticated: 400/min.
- Filters: 30/min (no auth differentiation).

---

## TESTS

Unit:
- `QueryUnderstandingServiceTests` — every layer + budget exhaustion + protected-token rules + refusal detection (embedding similarity).
- `AzureSearchQueryTests` — semantic-skip thresholds, RRF fusion, coherence calculations.
- `AzureSearchFacetServiceTests` — LRU eviction, concurrent dedup.
- `SuggestionCacheServiceTests` — LRU eviction at 20%.
- `SearchRateLimitServiceTests` — window rollover.
- `ParquetStorageServiceTests` — schema completeness (all 81 fields), nullable handling, batch write.
- `VectorEmbeddingRecoveryServiceTests` — saturation alert threshold + cooldown.

Integration:
- End-to-end Search Service → /track → Parquet emission (capture Service Bus → assert Parquet file content matches schema).
- SearchIndexSyncFunction with Cosmos change feed → Azure Search upsert (mock indexer).
- AnalyticsCompactionFunction → distributed lease + dedup correctness.

**Never modify Parquet schema without bumping `SchemaVersion` AND coordinating with downstream BI consumers.**

---

## CROSS-LINKS

- Service writes that trigger enrichment: `clinqet-service-listing` SKILL.
- Spell-check + LLM share OpenAI deployment with: `clinqet-ai-assistant` SKILL.
- Categories used for coherence: `clinqet-cosmos-data` SKILL.
- AdminAlerts on AI/embedding/circuit-breaker failures: `clinqet-notifications` SKILL.
- Function-app triggers: `clinqet-function-app` SKILL.
- Storage container management: `clinqet-deployment` SKILL.

---

## CHECKLIST BEFORE MERGE

- [ ] Every Cosmos query that the search subsystem performs is partition-scoped. NO cross-partition.
- [ ] Parquet schema columns never removed; new ones appended nullable at end; `SchemaVersion` bumped on change.
- [ ] Every analytics field still populated end-to-end (read `ParquetStorageService.FlattenSearchAnalytics` after change).
- [ ] AnalyticsCompactionFunction handles dedup via EventId.
- [ ] Distributed blob lease held during compaction.
- [ ] AI system prompts must NEVER hardcode service / category names (§3.7 CLAUDE.md).
- [ ] Spell-check stays within `TotalTimeoutMilliseconds` budget; LLM uses reserved `LlmMinBudgetMilliseconds`.
- [ ] Refusal detection uses embedding similarity (not substring).
- [ ] Cache TTLs + LRU caps in `appsettings.json` match options class defaults (memory `feedback_appsettings_class_defaults`).
- [ ] New SearchInvocationMode / SemanticSkipReason / SpellCorrectionSource added to enums + Parquet flattening + schema.
- [ ] Rate-limit per endpoint preserved; client id resolution (user / IP) unchanged.
- [ ] SearchIndexSyncFunction respects `IPerServiceLockRegistry` to avoid race conditions.
- [ ] VectorEmbeddingRecoveryFunction filter remains safe (`hasEmbedding=false AND isActive AND isListed`).
- [ ] AdminAlert cooldowns honored (no spam).
- [ ] Unit + integration tests for every new path.
- [ ] No hardcoded magic numbers; everything in appsettings.

---

## 2026-07-02 DEEP-REVIEW FIXES (search+broadcast engagement, sessions 1-2)

### Query pipeline (`AzureSearchQuery.cs`)
- **Relevance floor renamed + resemantic'd (S1, CRITICAL)**: the absolute `MinFusedScoreThreshold` (0.02) on raw FusedScore broke under adaptive RRF (best possible score 1/(k+1) < 0.02 once candidates ≥ ~50 ⇒ ALL results dropped). Replaced with a k-invariant floor on NormalizedScore: `HybridSearchScoringSettings.MinNormalizedScoreThreshold` (default 5.0, 0-100 scale) — the old key is DELETED from both appsettings.
- **Normalization**: max tier boost is NOT folded into the normalization denominator (S16 — one paid provider deflated every NormalizedScore and flipped the absolute band gates; a boosted result may clamp at 100). `CalculateMaxRRFScore(bm25Contributed, vectorContributed, semanticContributed, k)` derives from the lists actually fused in THIS call — expansion re-fusions never mutate the analytics metrics flags (S7).
- **Culture (S2)**: the BM25 geo scoring parameter uses `FormattableString.Invariant` — fr/es/de request culture had been emitting comma decimals, Azure rejected the BM25 call, and every located search from those locales lost its keyword channel.
- **Real TotalCount (S4)**: BM25 + discovery legs set `IncludeTotalCount=true`; `SearchStrategyMetrics.TotalMatchCount` (long?) carries the true corpus total; `HybridSearchResultDto.RecallFetchDepth` carries the recall window Size. The controller reports TotalCount = max(TotalMatchCount, fusedCount) (0 when the fused set is empty) and clamps TotalPages to the addressable depth (`Search:MaxResultDepth`).
- **Shared text shaping (S11)**: `ISearchQueryTextProcessor`/`SearchQueryTextProcessor` (singleton, registered in BOTH Program.cs) owns `PreprocessQuery` (stop/generic-word removal) + `BuildSafeFullQuery` (fuzzy/prefix expansion when enabled+long-enough, else per-term Lucene escaping). `AzureSearchQuery` AND `AzureSearchFacetService` both consume it — facet counts are computed over the exact same shaped universe as results, and raw user text can never be a Lucene parse error under QueryType.Full.
- Discovery/browse mode (S5+L13): Size scales with Page*PageSize (capped MaxResultDepth), applies `SearchBoostFactor`, runs `ApplySorting`. Vector `KNearestNeighborsCount = max(configured, fetchSize)` (L1). City/state expansion runs even after radius phases (L5). Semantic OCE rethrows only on caller cancellation (L7). `SigmoidBoost` = exactly 1.0 at threshold (L10). Duplicate query-embedding cache layer removed (S14). MatchQuality classifies from `MaxBy(NormalizedScore)` (S8).

### SearchController
- **Depth-aware result cache (S3)**: keys exclude Page/PageSize, so a cached entry is served ONLY when `Page*PageSize ≤ RecallFetchDepth` (or depth already = MaxResultDepth); otherwise the controller refetches deeper and overwrites the same key. Depth 0 (unknown) is never trusted.
- **Depth-cap envelope (L9)**: beyond-depth pages return TotalCount=0 AND TotalPages=0 with `MaxPageDepthReached=true` (self-consistent; the flag is the client's signal).
- **Rate limiting (S6)**: all IP-keyed rate-limit buckets (search/providers/suggest/filters + analytics/cart/WhatsApp-consent) use `GetRateLimitClientIp()` — see RATE LIMITING section above.
- **Suggest caching (S12)**: response cached under the SAME raw-text key the lookup uses (previously stored under the corrected text ⇒ misspellings never hit; correctly-spelled users inherited another user's typo Context). Empty responses cached too.

### Caches
- `SearchResultCacheService`: request-hash rounds lat/lng to `Search:ResultCache:CoordinateDecimalPrecision` (default 3 ≈ 110 m — GPS jitter no longer defeats the cache); hashes `ResolveSortDescending()` (null ≡ explicit default); `MaxSizeInMB` key DELETED (was read+logged, never enforced); `_userGenerations` bounded by `Search:ResultCache:MaxTrackedUsers` (default 10000) — only users with zero tracked keys are trimmed.
- `SuggestionCacheService` (S13): the post-eviction callback ignores `EvictionReason.Replaced` (re-Set of a live key no longer corrupts the LRU size counter/index).
- `AzureSearchFacetService` (L11): coalesced in-flight compute runs on `CancellationToken.None` + waiters use `WaitAsync(callerToken)` (first caller's disconnect no longer cancels every waiter); facet values format via InvariantCulture with lowercase booleans (they round-trip into OData filters); owns+disposes its private MemoryCache.

### Filters
- `SearchFilterExpressionBuilder` (L3/L4): MinRating uses coalesce semantics matching display/sort — `(serviceRating ne null and serviceRating ge X) or (serviceRating eq null and businessRating ne null and businessRating ge X)`; explicit `MinRating=0` / `MinYearsOfExperience=0` skip the filter entirely (0 = "any", must not exclude null-field docs).
- `FiltersRequestDto` (L8): 1000-km normalized radius cap in `Validate()` (mirrors SearchRequestDto).

### Indexer + change-feed (`AzureSearchIndexer.cs`, `SearchIndexSyncFunction.cs`)
- **Durable enrichment/embedding reuse (B7, major cost fix)**: three retrievable index fields on `SearchDocument` — `enrichmentContentHash`, `enrichmentEmbeddingText`, `embeddingContentHash`. `CreateServiceSearchDocumentAsync` fetches the existing index doc (`TryGetExistingIndexDocAsync`, fail-open) and reuses stored enrichment when the enrichment-input hash (name/cat/subcat/description) matches, and the stored vector when the embedding-input hash matches. `embeddingContentHash` is stamped ONLY when a real non-zero vector was written. Price-only edits and business-level events no longer pay LLM+embedding. Requires one cosmosindexsetup run (additive fields); until then the fetch fails open (= pre-fix behavior).
- **Freshness before build (B2)**: `IsIndexDocCurrentAsync` runs BEFORE the expensive build in both `IndexServiceAsync` overloads.
- **`SearchIndexerSharedResources`** (NEW, singleton in BOTH Program.cs): owns the enrichment MemoryCache + Polly retry/circuit-breaker (previously per-Scoped-instance ⇒ cache always empty, breaker never accumulated).
- **Entitlement invalidation (B3, CRITICAL)**: `ProcessReindexForBusinessAsync` calls `_entitlementService.Invalidate(businessId)` before reindex — fixes permanent stale tier stamps caused by the fn-app's own 24h entitlement cache.
- **AI-validation replay guard (B4)**: `service.ApprovalStatus != PendingAIValidation → return`, and the branch runs INSIDE the per-service lock. **Suspension cascade (B6)**: a failed delete is REPLAYED for that business (P4-107 — the old `SearchIndexDeleteFailureException` rethrow never held the lease; the class is deleted) ⇒ no ghost docs.
- `leadsPriority` stamped from `GetLimit("leads_priority")` (Premium = 1, Free = 2 since catalog v12); a missing row stamps `int.MaxValue`, the matcher's own "unknown", so an unknown doc always waits with the last wave.

### Config parity (CLAUDE.md §0.12)
`HybridSearchScoringSettings` (all 8 values), ~25 AzureSearchQuery ctor fallbacks, `BroadcastMatchingSettings`, and the API/fn-app broadcast Matching weights (0.45/0.40/0.15) are aligned; missing Search keys added to both appsettings (`MaxResultDepth`, `RadiusExpansionMultiplier`, `DualCoherenceConfidenceThreshold`, `Expansion:MinNormalizedScore`, `MatchQuality:*`, `Semantic:SkipShortQueriesWithCategoryFilter/ShortQueryMaxWords/MaxRankBonus`). New keys 2026-07-02: `Search:ResultCache:{MaxKeysPerUser,CoordinateDecimalPrecision,MaxTrackedUsers}` (API).

### Final-audit fixes (same engagement, post-audit)
- **TotalPages recall-exhaustion clamp**: `SearchStrategyMetrics.RawRecallCount` (pre-floor recall hits) — when the recall leg returned fewer raw hits than `RecallFetchDepth` (or depth = MaxResultDepth), the corpus is exhausted and TotalPages clamps to the fused count; otherwise `min(TotalCount, MaxResultDepth)`. Prevents promising guaranteed-empty (and expensive) numbered pages the relevance floor emptied.
- **ModelState checks on `/services` + `/providers`** (auto-400 is globally suppressed — without them every DTO `[Range]` was dead; pageSize=400/-1 reached the recall legs). `/filters` also truncates SearchText to MaxSearchQueryLength; its `skipAI: true` is a DOCUMENTED latency trade-off (LLM-only corrections can diverge facet counts from results).
- **Facet parity completed**: post-preprocess wildcard fallback matches the result path (stop-words+punctuation queries no longer zero the facet panel); the PRIMARY facet query keeps ALL filters (Algolia semantics — MatchedCount = the real result universe); self-exclusion only in the per-field disjunctive queries.
- **FilteredResultAnalytics** now carries ThresholdName/ThresholdValue/ThresholdStage to Parquet (were silently dropped at the controller mapping — always NULL before).
- `SuggestionCacheService` newness via `_timestamps.TryAdd` (no double-increment race); `SearchRateLimitService.Cleanup` uses value-conditional removal; `GetClientCountry` takes the LAST header value like `GetRateLimitClientIp`.
- **Indexer upsert failures surface**: partial-batch failures throw the retriable `SearchIndexUploadPartialFailureException` (indexer retry + breaker handle it); `SearchIndexSyncFunction` treats `IndexServiceAsync == false` as a per-document failure → change-feed-failures DLQ + alert (there is NO reconciliation job).
- Parity: `Search:RateLimiting:Search:AuthenticatedRequestsPerMinute` corrected to 200 in appsettings; `AnalyticsSettings:{TopResultsCount 25, FilteredResultsCount 5, TrackFilteredResults true, SkipOnCacheHit true}` aligned both sides; fn-app appsettings gained the AnalyticsSettings filtered-results keys; `Search:ResponseDiagnostics:Enabled` fallback = true.

### Open Page slug on search results (2026-07-02)
- `ServiceSearchDocument.businessFriendlyName` (plain `[SimpleField]` — retrievable, non-searchable) carries the provider's Open Page slug. Stamped in `CreateServiceSearchDocumentAsync` from SQL TRUTH via `IProviderFriendlyNameResolver` (`ProviderFriendlyNameResolver`, singleton in BOTH Program.cs, `IDbContextFactory<AppDbContext>`: `UserProfile.FriendlyName` by `UserNumber`; fail-open to null — a slug lookup failure never fails an index build). The slug's source of truth is SQL `UserProfile.FriendlyName` (Identity DB), NOT the Cosmos BusinessProfile — reading SQL at index time makes every reindex self-healing and lets the pending full-reindex pass double as the backfill.
- `ServiceSearchResultMapper` maps `Slug = businessFriendlyName (whitespace-checked) ?? businessId` — NEVER null; a businessId slug still resolves on the user app via the identity userNumber fallback. Field added to `ServiceSearchSelectFields` AND `DocumentLookupSelectFields` (recently-viewed hydration + provider lookups read it). `RecommendationSearchService.BuildProviderDto` forwards `dto.Slug`; `RecentlyViewedHydrationService` prefers `businessFriendlyName` over `businessId`.
- **Change propagation**: the Identity API (`UserProfileController` update + delete-friendly-name paths) mirrors FriendlyName onto Cosmos `BusinessProfile.friendlyName` via `TrySetFriendlyNameAsync` (point patch, no ETag, 404 ⇒ non-provider no-op) on every set/change/remove. That mirror write IS the change-feed trigger (`BusinessProfile` ∈ `ReindexDocumentTypes` ⇒ full business reindex). Patch failure ⇒ `AdminAlertType.FriendlyNameProjectionFailure` (High) — slugs stay stale until the next business event. The mirror also feeds `PublicBusinessProfileDto.FriendlyName` (Open Page canonical URL).

### Ops (once per environment)
1. Run cosmosindexsetup (adds the 3 reuse fields + `businessFriendlyName` — additive, safe).
2. One full reindex pass: Free-tier `leadsEligible=true`/`leadsPriority=4` stamps + reuse hashes + stale-tier repair + `businessFriendlyName` slug stamps (folds into the already-pending P1 search reindex).
3. Catalog v3 auto-applies on next API start. Front Door `ClientInfoHeaders` Overwrite change requires a networking.json redeploy.

## Provider lead-visibility diagnostic + admin reindex (2026-07-16)

Admin-only incident tooling on `SearchAdminController` (`clinqetapi\Clinqet.API\Controllers\Admin\SearchAdminController.cs`, `[Authorize(Roles="Admin")]`):

- `GET api/v{v}/admin/search/provider-visibility/{businessId}?categoryId=...[&latitude&longitude&radius&unit&city&zipCode&country]` → `ApiResponse<ProviderVisibilityReportDto>` (`clinqetshared\DTOs\Search\ProviderVisibilityDtos.cs`; admin-only ⇒ plain-English strings by design). Sections: **CosmosServices** (per service INCLUDING soft-deleted — `GetItemsByLinqAsync(s => true, businessId)` — with the index Gate-C verdict `WouldBeIndexed` + first-failing-gate `Reason`, and `CategoryExistsInCatalog`); **BusinessProfile** (found/status/isListed/allowOnlineBookings/primary-address city + coords, coords mirroring `AzureSearchIndexer.HasValidCoordinates`); **Entitlements** (`Invalidate(businessId)` then fresh `ResolveAsync` — `PlanFound` = Features nonempty, `LeadsFeature`/`LeadsPriority`, `WillStampLeadsEligible` = `HasFeature("leads")` exactly as the indexer stamps); **IndexDocuments** (live docs `businessId eq 'X'`, Select-trimmed, Size 50 + IncludeTotalCount); **BroadcastFilterSimulation** (per `BroadcastFilterBuilder.BuildLabeledClauses` clause: `businessId eq 'X' and {clause}` Size=0 count — the first zero-count clause is the excluding gate; `FullFilter` = clause join, byte-identical to production, + `FullFilterMatchCount`); **CustomerSearchMatchCount** (`isActive eq true and isListed eq true` baseline). Impl: `clinqetinfrastructure\Services\Search\ProviderVisibilityDiagnosticService.cs` (`IProviderVisibilityDiagnostic`, scoped, registered in API `Program.cs` next to the search services). Every index query is businessId-scoped; every Cosmos read is partition-scoped.
- `POST api/v{v}/admin/search/reindex-business/{businessId}` → evicts the entitlement cache, loads the profile (404 when missing), then `IAzureSearchIndexer.ReindexBusinessServicesAsync(businessId)` (it loads the profile itself) — mirrors `SearchIndexSyncFunction.ProcessReindexForBusinessAsync`; non-Active profiles are skipped inside the indexer (visible via `profileStatus`). Returns `{businessId, profileStatus, activeServiceCount, reindexed}`.
- Gate C parity (pinned): a service indexes when `approvalStatus` ∈ {null/empty, `Approved`, `AIApproved`} — string comparison; `AIApproved` is a legacy raw-JSON value NOT present in `ServiceApprovalStatus`.
- Tests: `ProviderVisibilityDiagnosticServiceTests` + `Controllers\Admin\SearchAdminControllerTests` (unit); `SearchAdminControllerIntegrationTests` (401/403 both endpoints, 404/200 reindex; provider-visibility has no 200 integration path — its happy path needs the real search endpoint + SQL entitlements, both absent from the harness).

## 2026-07-16 SEARCH RELIABILITY FIX PACK (audited defects, all shipped)

- **(0,0) coordinate sentinel**: a both-near-zero pair (|lat|<0.001 AND |lng|<0.001 — `CoordinateSentinel.IsUsablePair`, `clinqetshared\Extensions\CoordinateSentinel.cs`) means "no location provided". `SearchController` normalizes it to null (coords + radius) on `/search/services` and `/search/providers` BEFORE the Distance-sort guard — (0,0)+Distance now 400s exactly like missing coords — and `LocationResolutionService.ResolveAsync` applies the same guard for every other caller, so a (0,0) request falls through city → customer-address → centroid → country instead of building POINT(0 0)≤default-radius (guaranteed-empty first pass + full expansion cascade, Distance sort silently garbage). A single zero (equator/meridian) stays usable. Analytics fields unchanged — lat/lng/HasLocationFilter simply record the truthful "absent".
- **Truthful quality-degradation flags**: the three retrieval legs (`ExecuteBM25SearchAsync` / `ExecuteVectorSearchWithEmbeddingAsync` / `ExecuteSemanticSearchAsync`) no longer swallow internally; failures surface at the call sites that stamp `BM25Failed`/`VectorFailed`/`SemanticFailed` (primary flow) or log-and-continue (expansion phases). An `[]` query embedding (the embedding service's internal-failure sentinel) sets `EmbeddingFailed=true` + `VectorUsed=false` — the vector leg is never reported as used when it never ran. `SearchController.ApplyQualityDegradationAsync` (QualityDegraded response flag + HIGH `SearchQualityDegraded` admin alert, 15-min cooldown) is therefore actually reachable now. Caller-cancelled OCE rethrows through every leg/expansion catch (`catch (OperationCanceledException) when (ct.IsCancellationRequested)`) — a client disconnect stops the pipeline instead of being mislabeled a strategy failure. Semantic's internal 3s timeout still degrades silently (unchanged by design). `/providers` analytics `EmbeddingUsed`/`SemanticSearchUsed` now map from `VectorUsed`/`SemanticUsed` (same truthful mapping as `/services`). Parquet schema untouched.
- **`Search:EmbeddingBudgetSeconds` (default 5; both hosts' appsettings + ctor default mirror)**: per-request budget for realtime query-embedding calls via `GetOrGenerateEmbeddingWithBudgetAsync` (linked CTS wired into the embedding call ONLY — it can never cancel the search). Covers the primary hybrid call site, the dual-coherence original-query embedding, and the expansion regen. On budget expiry: `EmbeddingFailed=true`, search continues BM25(+semantic)-only. The suggest-path embedding and the broadcast MATCHER's embedding are deliberately NOT budgeted.
- **Category-embedding cache poisoning fixed**: `CategoryEmbeddingService` never caches zero-length vectors — any empty vector in a build means the dict is NOT cached / not marked initialized (the partial dict still serves the current call), the next call retries the full build, and a cooldown-gated (15-min) HIGH `SearchQualityDegraded` alert fires. New ctor deps: `IServiceBusService` + `IAdminAlertCooldownService` + `IOptions<ServiceBusSettings>` (singletons in BOTH hosts). `BroadcastClassificationService.ValidateAndScoreAsync` wraps its coherence call exactly like the search path — a category-embedding init failure bypasses the guard (LLM picks kept), never a 500.
- **`Discovery:CountryDefaults` full-name resolution**: `GetCountryDefaults` second-chances via `ToCountryCode()` with a round-trip guard (`ToCountryCode` falls back to US for garbage input; only a real short-name/full-name match is accepted), so "Canada" and "CA" both resolve; unknown ⇒ `FallbackDefaults`. Callers pass canonical full names from `ClientCountryResolver`.
- **Provider-path contract**: `/search/providers` clamps PageSize to `Discovery:MaxPageSize` at the controller BEFORE the depth gate (envelope math consistent with the service clamp). `ApplyProviderSort` honors SortDescending for Distance (nulls always last, both directions) and gained the missing Newest arm (`TopServiceCreatedAt`, mirroring `/services`). `createdAt` added to `ServiceSearchSelectFields` — this also makes the `/services` Newest sort real (it previously sorted all-default `CreatedAt`). Additive response fields: `ServiceSearchResultDto.createdAt`, `RecommendedProviderSearchResultDto.topServiceCreatedAt`.
- **Dead code**: unused `IMemoryCache` removed from `AzureSearchQuery` (leftover from the S14 duplicate-embedding-cache removal).
- Tests: `CoordinateSentinelTests`, new cases in `LocationResolutionServiceTests` / `DiscoverySettingsTests` / `AzureSearchQueryFusionTests` (leg failure flags, budget expiry, OCE propagation) / `SearchControllerTests` ((0,0) 400 + normalization, QualityDegraded + cooldown claim, PageSize clamp) / `RecommendationSearchServiceTests` (Distance desc + Newest arms) / `CategoryEmbeddingServiceTests` (empty-vector no-cache/retry/alert) / `BroadcastClassificationServiceTests` (guard bypass + OCE propagation).

---

## SEO TOUCHPOINTS (session 7, 2026-07-26)

- **`ServiceIndexGates` is now shared by four consumers**, not two: the search-index sync, the public
  `categories/services` payload, the per-service page gate (D19), and the nightly services sitemap.
  Relaxing it in any one place would advertise a URL that 404s.
- **The services sitemap reads COSMOS, not the search index** (owner-confirmed, D23). Two reasons:
  (1) the indexer skips `Inactive` providers (`AzureSearchIndexer.cs`), but D1 deliberately keeps
  their pages public — a search-built sitemap would advertise the provider page and silently drop
  every one of their service URLs; (2) the index is a *derived* store, incomplete for hours during a
  full reindex, and a sitemap that suddenly loses half its entries reads to Google as deliberate
  removal.
- **`SeoSlug` is no longer dead code.** Its own comment used to claim it was "shared by the discovery
  catalog, the sitemap feed and the route parser" — it was referenced by nothing at all. It is now
  the server-side slug builder for the sitemap job, and pinned to `lib/seo/slug.js` by a shared
  parity corpus asserted in both languages (`SeoSlugParityTests.cs`, `lib/seo/slugParity.test.js`).
  The discovery catalog still returns **names, never slugs**.

---

## Landing sort + filters + subcategory facets — session 8, 2026-07-27

`GET /api/v1/public/discovery/landing` takes `sort` (`LandingSortBy`), `offersOnly` and `subcategory`
alongside `category`/`city`.

`LandingSortBy` (`clinqetshared/Enums/LandingSortBy.cs`) is deliberately **not** `SearchSortBy`: that
enum has `Relevance` and `Distance`, and neither is honest on a landing page. The response is a shared
cached payload with no query text, so "best match" would promise personalisation the page cannot
deliver, and "nearest" needs per-visitor coordinates that would make the cache key unique per person.

**One Azure query whatever the sort.** The index is always ordered `businessRating desc`; `PriceLow` and
`MostServices` are properties of the *grouped provider* (its cheapest service, how many of its services
matched) and cannot be expressed as an index `OrderBy` over service-grained documents, so the reorder
happens on the grouped list. `PriceLow` puts quote-only providers **last** — treating "no price" as zero
would rank every one of them above the cheapest real provider.

### `LandingResultsDto.SubcategoryFacets` (added session 8)
`List<LandingFacetDto>` (name + count), built by `BuildSubcategoryFacets` from the documents the scan
already returned — **zero extra queries**, pinned by `SeoLandingResultsServiceTests`. Counts are
**services, not providers**: one provider with three matching services counts three, or the chip would
understate what the filter returns.

‼️ Facets are counted **after** the request's own filters, so a response that already narrowed to one
subcategory reports only that one. **The client must keep the list from its first, unfiltered load**, or
the chip row collapses to the chip the visitor just pressed. Documented on the DTO property itself.

The subcategory filter is applied in the **Azure filter**, not in memory, so the bounded
`LandingMaxDocumentsScanned` budget is spent entirely on the requested subcategory — better results than
filtering a general scan down.

### Depth cap contract (unchanged, but now consumed by two clients)
`SearchController` short-circuits `page * pageSize > Search:MaxResultDepth` (500) with an **empty page,
`TotalCount = 0`, `TotalPages = 0` and `MaxPageDepthReached = true`**. Both the customer web
`LoadMoreControl` and the RN results list must guard before adopting that `TotalCount`, or the real
total is erased mid-session. Azure AI Search has **no client-resumable continuation token** — `$top`/
`$skip` is the mechanism, and the cap is what makes progressive loading terminate.

---

## PROVIDER INDEX — session 9, 2026-07-27 (Phase 1 of the provider-discovery programme)

**There are now TWO Azure AI Search indexes.** Read this before touching either.

| | Service index | Provider index |
|---|---|---|
| Name | `clinket{envSuffix}` (`Search:Topology:Public:Countries:<ISO2>:ServiceAlias`) | `clinket-providers{envSuffix}` (the same row's `ProviderAlias`) |
| Grain | ‼️ one row per **(service, service area)** per country (2026-09-29) | ‼️ one row per **(business, service area)** per country |
| Key | `id` = `SearchRowKeys.ServiceRow` (`{businessId}_{serviceId}_{areaId|noarea}`) | `id` = `SearchRowKeys.ProviderRow` (`{businessId}_{areaId|noarea}`) — no longer `businessId` |
| Document type | `ServiceSearchDocument` | `ProviderSearchDocument` |
| Writer | `AzureSearchIndexer` | `ProviderSearchIndexer` |
| Vector | `textEmbedding`, 3072-dim | **none** — providers are filtered/sorted, never semantically searched |
| Semantic config | `default-semantic-config` | **none** — provider lists are `search=*`, nothing to rerank |
| Profiles | `serviceRelevanceScoring` / `…WithLocation` | `providerRelevanceScoring` / `…WithLocation` |
| Read by | everything | ‼️ **NOTHING YET** — Phase 3 repoints the read side |

**Why it exists:** Azure AI Search has **no result grouping / field collapsing at any tier**, so provider
lists were faked by pulling ~100 service rows and de-duplicating in memory. `?page=3` fetched rows 1–100
and sliced 41–60 out of a ~35-item list ⇒ a silently empty page, and `totalCount` was the window size,
not the truth. Only a provider-grained index can page providers exactly.

### Writing it — `ProviderSearchIndexer` (`clinqetinfrastructure/Services/Search/`)
- ‼️ **Every write is a FULL REBUILD from Cosmos + SQL truth. Never a partial patch.** That is what makes
  duplicate and out-of-order change-feed delivery self-healing and idempotent.
- **Membership mirrors the service index exactly: a document exists iff
  `ServiceIndexGates.BusinessBelongsInMarketplace(status, participatesInMarketplace)`** — Active AND promoted.
  `RebuildProviderDocumentAsync` (and the `UpsertProviderDocumentAsync` wrapper) **deletes** the document in every
  country for any other profile, so no caller can forget and leave a ghost. One place decides membership.
- ‼️ Do **not** confuse `isListed` (the field — `BusinessProfile.IsListed`, a provider pausing themselves,
  query-time filter) with `ProviderPublicVisibility.IsPubliclyListed` (the **sitemap** verdict, which
  includes `Inactive` and ignores `IsListed`). They are different rules for different surfaces.
- Source reads are **all single-partition** on `businessId`: profile, services, service areas, offers,
  business rating, categories. Plus SQL for entitlements and the Open Page slug.
- `serviceCount` / `fromPrice` / `categoryIds` count only services passing `ServiceIndexGates.IsIndexable`
  (not deleted, active, approved). `fromPrice` deliberately **excludes hourly rates** — a different unit.
- ‼️ SUPERSEDED 2026-09-29: `geoPoint` is each ROW's own area centre (`PublicCountryFiling.ProviderRowAreas`), or the
  address on the one `noarea` row; the write uploads the rows, then deletes every row of the business not just written
  (`ReplaceRowsAsync`, keyset on `id`). See "ONE ROW PER SERVICE AREA".

### ‼️ Sync — where the provider write actually happens (Phase 5: DEBOUNCED, no longer inline)
`SearchIndexSyncFunction.EnqueueProviderProjectionsAsync`, a dedicated pass **after** the service reindex,
over the **same deduped set as the listing projection** (`listingBusinessIds` = business-level changes
**∪** every business touched by a service change). It no longer rebuilds anything: it posts ONE
"this business is dirty" marker per business to the **`provider-projection`** Service Bus queue, and
`ProviderProjectionProcessorFunction` performs the rebuild when the marker fires.

**Why it moved (Phase 5, the launch-scale write amplification).** Every rebuild re-reads the business's
ENTIRE catalogue through eight concurrent partition-scoped queries, so per-batch dedupe only helped edits
landing in ONE change-feed batch. `MaxItemsPerInvocation = 100` with a 2000ms feed poll delay means
services written one at a time (UI, API, CSV/dealer import) each land in their own batch and defeat it
entirely. One provider adding 100 services one at a time cost **1+2+…+100 ≈ 5,050 service-document reads
to produce ONE provider document**, plus offers/areas/availability/portfolio queried 100 times each —
**quadratic per provider**. At the launch shape (~1,000 providers × 50–100 services) that is ~5M reads and
~100k index writes during onboarding alone. Not a correctness bug; a cost and throughput blocker.

**Why coalescing is safe:** the rebuild re-reads CURRENT Cosmos state, so it does not matter which edit
triggered it — everything that landed in the window is included. Nothing is skipped, only deferred.

- **`messageId = providerprojection:{businessId}:{bucket}`**, `bucket = unixSeconds / debounceSeconds`
  (`CosmosDb:ChangeFeed:ProviderProjectionDebounceSeconds`, default **120**, clamped `[15, 240]`).
  ‼️ **THE TRAP: the bucket lives in the messageId, NOT in the queue's `duplicateDetectionHistoryTimeWindow`.**
  Every other queue uses `PT10M`; copying that here and relying on the window alone is a SILENT DATA-LOSS
  BUG — the rebuild fires, and every edit between then and the window closing matches the same MessageId
  and is dropped, leaving the provider stale for ten minutes with no error anywhere. A bucketed id gets a
  fresh identity per window, so no queue setting can break it. The queue is still `PT5M` as defence in
  depth, deliberately LONGER than the 240s clamp ceiling (a bucket wider than the window stops deduping
  mid-bucket) — `DebounceClamp_StaysInsideTheQueuesDuplicateDetectionWindow` pins that relationship.
- **Scheduled at the bucket BOUNDARY** (`(bucket+1) * window`), never `now + delay`. Two consequences that
  are both load-bearing: consecutive buckets for one business are deterministically a full window apart,
  and the rebuild's read lands strictly AFTER every edit its bucket covers.
- ‼️ **The queue is SESSION-ENABLED on `businessId`.** Before Phase 5 the projection was serialised for free
  — a business's documents share one Cosmos partition, so one change-feed lease, so ordered batches. A queue
  with `maxConcurrentCalls: 16` breaks that: bucket N and N+1 fire milliseconds apart whenever edits straddle
  a boundary (routine during a bulk import), and because the rebuild is read-then-overwrite, the worker that
  read EARLIER can win the upload race and leave the index on the older snapshot with nothing to repair it.
  Mid-import the next bucket heals it; on a provider's LAST edit it does not — and if that edit was a
  **suspension, a suspended business keeps its provider document and stays in search results**. Sessions make
  that impossible rather than merely unlikely. `SendScheduledMessageWithSessionAsync` exists on
  `IServiceBusService` for this: a session-enabled queue REJECTS a message with no SessionId, so a deferred
  send onto one cannot reuse `SendScheduledMessageAsync`.
- ‼️ **The processor MUST call `_entitlementService.Invalidate(businessId)` before rebuilding.** The inline
  version got that eviction for free from the reindex leg in the same batch. In its own invocation, with a
  cache that lives for hours and an API-side Invalidate that cannot reach this process, a tier change would
  stamp the PRE-change tier / leads / boost into the index permanently.
- ‼️ **A vanished profile is a TERMINAL outcome, not a failure.** The 120s debounce widens the window in
  which a business is closed between the edit and the rebuild, so a marker naming a profile Cosmos no longer
  holds is now reachable. The processor **deletes** the provider document and completes. Treating it as a
  failure would fire a Critical alert every time a provider closed their account.
- **Do NOT move the enqueue into `ProcessReindexForBusinessAsync`.** That method only runs for
  `ReindexDocumentTypes`, and a **service add/remove never enters that set** — yet it changes `serviceCount`,
  `fromPrice` and `categoryIds` on the provider row. A real defect found and fixed in Phase 1 (F1).
- **Not fail-open**, unlike the sitemap projection. The failure paths are split in two and BOTH exist:
  - a failed **SEND** (marker never reached the queue) stays in `SearchIndexSyncFunction` and rides
    `HandleReindexFailuresAsync(…, "ProviderDocument")` exactly as a failed write used to;
  - a failed **REBUILD** is handled by `ProviderProjectionProcessorFunction`: Service Bus retries on
    delivery count, then on FINAL delivery it raises the admin alert (gated by
    `AdminAlertSettings.EnableProviderProjectionFailureAlerts`, default true), posts a
    `ChangeFeedFailureMessage` with `DocumentType = "ProviderDocument"` for automatic replay, and
    dead-letters. ‼️ The gate is checked at the CALL SITE, not passed as `forceAdminAlert`:
    `HandleSystemFailureAsync` ORs that flag with `EnableSystemFailureAlerts` (true), so passing it through
    would make the switch able to turn the alert ON but never OFF. The alert names the businessId and the
    repair (`POST /api/v1/admin/search/reindex-business/{businessId}`); the REPAIR is never gated.
- `ChangeFeedFailureReplayFunction` writes the provider document on **both** replay paths — a service
  replay changes the provider row too. It is still INLINE there, deliberately: a replay is a repair of a
  named failure, and deferring a repair is the opposite of what it is for.
- `ReindexDocumentTypes` briefly held `"FeaturedPlacement"`; Phase 4B removed it (no such document type is ever written).
#### ‼️ Phase 5 audit findings — operational consequences of the debounce
- **DEPLOY THE QUEUE BEFORE THE CODE.** Until `deploy.ps1` creates `provider-projection{suffix}`, every marker send
  fails as a PERMANENT `MessagingEntityNotFound`, `ServiceBusService` raises one *Service Bus Send Failure*
  alert **per business per batch**, and no provider document is rebuilt at all. Provider search freezes at
  whatever it last held. The failed sends still ride `HandleReindexFailuresAsync`, so nothing is lost — but the
  alert volume is the loud signal, not a bug.
- **A whole-namespace outage still produces a signal**: `HandleReindexFailuresAsync`'s aggregated alert is
  written to Cosmos DIRECTLY (`IAdminAlertRepository`), not through the admin-alerts queue, so it lands even
  when every send is failing.
- **The new queue's DLQ needs NO new monitoring**: `analytics-alerts.json` already alerts (severity 1) on
  `DeadletteredMessages > 0` for `EntityName: *` across the whole namespace.
- **`maxDeliveryCount` (ARM, 5) MUST equal `RetrySettings:MaxDeliveryCount` (appsettings, 5).** The processor
  decides when to alert from the SETTING, and the broker decides when to dead-letter from the QUEUE — drift one
  way dead-letters silently, the other way alerts while retries are still queued. Neither repo can check the
  other (§0.17), so the invariant is written into the queue's own `//` note in `events.json`.
- ‼️ **`SearchIndexAuditFunction` gained a transient false-positive window.** Its orphan check ("a service
  document whose business has NO provider-index row", Critical, daily at 06:00) can now see a **brand-new**
  provider whose first service was indexed inline within the last ~120s while its provider marker has not yet
  fired. Existing providers are unaffected — they already have a row. The condition was reachable before (the
  provider leg could fail while the service leg succeeded) but only for seconds. **Not changed here**: making
  the audit tolerant means lowering the sensitivity of a real drift alarm, which is an owner call, not a
  side effect of this phase.
- **`BusinessClosureTeardown` was checked and is safe.** It deletes the provider document at step (d) and
  purges the `ProviderData` partition at step (e); a marker firing after that finds no profile and the
  processor's vanished-profile branch deletes rather than resurrects. The only resurrection window is the
  teardown's own (d)→(e) gap, which is unchanged by this phase — and the debounce makes projections *rarer*,
  so the odds of landing inside it go down, not up.
- **The debounce only collapses edits that fall inside one window.** A trickle slower than 120s gets no
  collapse and costs exactly what it did before. That is correct: the launch blocker is the burst, and a
  measured claim beats a blanket "50× cheaper".

### Defining it — `cosmosindexsetup/Program.cs`, `ProviderSearchIndexInitializer`
- Same functions and **the same ranges** as the service profiles:
  `magnitude(businessRating, 0.9, 3→5)`, `magnitude(businessReviewCount, 0.6, 5→50)`,
  `distance(geoPoint, 2.0, "userLocation", 50 km)` on the WithLocation profile. ‼️ Numbers SUPERSEDED — see the RANKING
  POLICY section and "ONE ROW PER SERVICE AREA" (Rule 1 ×4.25 + Rule 2 ×1.40, product aggregation, D-62 gradients).
  `FunctionAggregation = Sum` explicit. `DefaultScoringProfile` set.
- ‼️ **NEVER add `freshness(createdAt)` to the provider profile.** It is already a cold-start boost on the
  service index; a second one would stack on the same signal (the F-014 class of bug). Build-failing test.
- ‼️ The **same magnitude ranges on both indexes are NOT a double boost** — a service document and a
  provider document are never ranked against each other. A test pins them equal so they cannot drift.
- `RankingOrder = RankingOrder.BoostedRerankerScore` is now set **explicitly** on the SERVICE index's
  semantic configuration. It was unset, relying on a Microsoft default. Ranking must never depend on that.

### ‼️ There is NO backfill, and that is deliberate
The change feed is `StartFromBeginning = false`, so the index only fills as writes happen. **A Cosmos
write IS the backfill:** re-seeding via `cosmosindexsetup` (`SeedData:Enabled`, non-prod only) fires the
change feed, which runs the same idempotent upsert. Per provider, use the existing
`POST /api/v1/admin/search/reindex-business/{businessId}` — it repairs **both** indexes.

‼️ **Dropping and recreating the index does NOT populate it.** The index holds no data of its own; it is a
projection of Cosmos. Recreating it makes it emptier. Only a Cosmos write puts documents back.
‼️ **This is a PRE-PRODUCTION decision.** Once there is production data that must not be re-saved, a
bounded resumable backfill becomes a real requirement.

### Settings + deployment
‼️ SUPERSEDED 2026-09-21 by the search topology router: the provider index is now
`Search:Topology:Public:Countries:<ISO2>:ProviderAlias`, emitted by `Add-SearchTopologySettings` at all **six**
`deploy.ps1` settings sites, and reached through `ResolvePublic(country).Single.ProviderClient`.
`Search:ProviderIndexName` in `cosmosindexsetup` (the management plane that CREATES the index) is unchanged.

‼️ SUPERSEDED 2026-09-21: `ProviderSearchClient` and `KnowledgeSearchClient` are DELETED. Nothing injects a
`SearchClient` any more — inject `ISearchTopology` and resolve the grain you need.

### ‼️ Every value type on `ProviderSearchDocument` is NULLABLE, by construction
Azure returns any field a document lacks as `null`, and a null into a non-nullable `bool`/`int`/
`DateTimeOffset` throws while the response is materialized — the defect that 500'd every landing page on
the service index. A build-failing convention test enforces it. **Do not add a non-nullable value type.**

### Tests that will fail your build if you get this wrong
`ProviderIndexConventionTests` (`clinqetapi/Clinqet.API.UnitTests/Conventions/`) — six guards:
no non-nullable value types · scoring profiles only name fields the document has · scoring functions only
target **filterable** fields (Microsoft's documented cause of "the boost silently does nothing") · no
second `freshness` · provider magnitude ranges == service ranges · `RankingOrder` set explicitly.
Each guard was verified by deliberately breaking the code and watching it fail.
Also `ProviderSearchIndexerTests` (11 unit) and `ProviderIndexCosmosIntegrationTests` (2, real Cosmos).

### ✅ The index EXISTS in both dev regions (created + verified live 2026-07-27)
`clinket-providers-dev` in **Canada and India**: 34 fields, both scoring profiles accepted by Azure,
`serviceAreas` present, `newAreaSince` absent (Phase 2), service-index `rankingOrder =
BoostedRerankerScore`. Doc count 0 — nothing writes yet.

**To create or update the indexes (creds come from `appsettings.{ca|in}.json`, dev sandbox):**
```
cd C:\Nik\cosmosindexsetup
dotnet run --launch-profile "Dev (Canada)" -- --reseed-legal-policies --reseed-faqs
dotnet run --launch-profile "Dev (India)"  -- --reseed-legal-policies --reseed-faqs
```
Adding index fields needs **no rebuild and no reindex**, so re-running in dev is cheap and safe. The
`--reseed-*` flags are optional (they wipe + re-seed legal policies and FAQs) and are prod-blocked.

‼️ **NEVER `set CLINKET_REGION=ca && dotnet run`** — it runs the **WRONG REGION, silently.** Without
`--launch-profile`, `dotnet run` applies the FIRST profile in `launchSettings.json` (**`Dev (India)`**),
and a profile's `environmentVariables` **override the shell**. Always pass `--launch-profile`.

‼️ **Verifying an index property over the REST API: use `api-version=2026-04-01` or newer.** Older
versions omit properties they do not know — `rankingOrder` reads as *absent* on `2024-07-01` even when it
is set. A confident **false negative**.

### What is NOT done yet
- Ranking, badges, featured slots, the banner and every read path are **Phases 2–7**. `SearchBoostFactor`
  on the provider index carries **tier only** today.
- Nothing has ever **written** a document to the real index — creation is proven, ingestion is not.
- ⚠️ Geocoding: both write paths already persist coordinates (`ServiceAreaController` even 400s if it
  cannot geocode), so the indexers' geocoding is a **fallback**, not a per-edit cost. But an address whose
  write-time geocode failed stays null **forever** and is retried by both indexers on every rebuild.
  Fix in Phase 2: cache in `GoogleGeocodingService` (it has none; `Size = 1`) + write-back to Cosmos.

## PROVIDER QUALITY SCORES + LIFECYCLE — session 10, 2026-07-28 (Phase 2)

### The three scores (master plan Part 5.1) — ONE definition, two computation sites
`ProviderScoreCalculator` (`clinqetcore/Utilities/`) is pure and is the **only** place the bands live.
‼️ **The band edges and completeness weights are LOCKED ranking policy, not tuning knobs.** Changing one
is a ranking change and needs the owner. `ProviderScoreCalculatorTests` probes both sides of every edge.

‼️ **2026-09-29 — the nightly scores were re-derived (findings `SCORING-REAUDIT-2026-09-28.md`). Where the text below
disagrees, this block wins:**
- **Which events** — `ProviderScoreEvaluator` (`clinqetcore/Utilities/`) is the one definition for the measurement and
  the look-back. Times are in the provider's OPENING hours (`OpeningHoursClock`, from their `Availability` and time zone;
  wall-clock when the week has fewer than `ProviderScoring:MinWeeklyOpenHours` 10). Response is per customer WAIT
  (`Conversation.replyCycles`, `ReplyCycle.WroteAt/AnsweredAt`, capped `Tenancy:Inbox:MaxReplyCycles` 50), not "who spoke
  last". A request/wait is judged only after `JudgeAfterOpenHours` (8). A booking the business entered is never a request
  (`CreatedBy` = `Business`).
- **Anchors** (locked): speed `(0.25h,100) (1,85) (4,60) (8,40) (24,15) (40,0)`; reliability failure rate
  `(0,100) (0.02,90) (0.05,70) (0.10,45) (0.15,32) (0.20,20) (0.35,0)`; acceptance rate `(0.10,0) (0.30,35) (0.50,65)
  (0.70,85) (1.0,100)`.
- **acceptanceScore (F12)** — of direct requests answered, the share taken; a decline within `FastDeclineOpenHours` (4)
  counts as taken. Stored `BusinessProfile.acceptanceScore`, prior `AcceptancePriorMean`/`Weight` (75/5). **Penalty only**
  — it earns no reward points.
- **Reliability** — only a business cancelling a booking it CONFIRMED (reason null or `ProviderCancelReason.CouldNotDoIt`),
  `NoShowProvider`, and a provider `RejectedTimeout` of ≥ `JudgeAfterOpenHours` count as failures; declines belong to
  acceptance. A business-entered booking counts at `ProviderCreatedBookingWeight` (1.0).
- **Evidence gate + decay** — `ProviderScoring:WindowDays` (60, all three; replaces `ReliabilityWindowDays`), fewer than
  `MinimumSamples` (10) ⇒ not measured. `ProviderScoreCalculator.Next` is a function of the evidence alone: measured ⇒
  the measurement; else never measured ⇒ **null**; else the measurement the last qualifying window supported, decayed
  halfway to the prior every `DecayHalfLifeDays` (90) from `EvidenceEnd` (the last moment a rolling window held the
  minimum); no qualifying window in the look-back ⇒ the prior. `scoresUpdatedAt` no longer feeds decay. Look-back =
  `LookbackHalfLives` (4) × `DecayHalfLifeDays`, capped at `LookbackMaxBookingRows` (2000). Detail: `clinqet-smart-analytics`.
- **Hidden providers** (`PauseScoringWhenUnlisted`): paused, not in the marketplace, not Active, or no findable service ⇒
  scores not rewritten.
- **Admin override (F10 / D19)** — the five flat `BusinessProfile` fields `responseScoreOverride` /
  `reliabilityScoreOverride` / `acceptanceScoreOverride` / `overrideExpiresAt` / `overrideReason` (§12.5) REPLACE the
  computed value for ranking while live; `EffectiveProviderScores.For` is the one reader (both indexers). Written only
  by `IProviderScoreOverrideService` (one ETag compare-and-set patch, `TrySetScoreOverrideAsync`; an `expected` override
  from the admin screen ⇒ 409 on a colleague's change; audit alert `ProviderScoreOverrideChanged`). Since W11 an
  override's end is its own exact-minute `provider-score-refresh` message, with `ExpireIfLapsedAsync` as the backstop at
  the start of every rescore (`clinqet-smart-analytics`); `SearchIndexAuditFunction` no longer expires overrides. Admin API: `GET/PUT api/v{v}/admin/providers/{businessId}/scores[/override]`,
  `POST …/scores/override/clear`; `ProviderScoreOverride:DefaultExpiryDays` 90 / `MaxExpiryDays` 365. The read-out's
  `inSearch` = whether the provider index holds the business's primary row (null when it could not be read).

| Score | Computed | Stored | Why there |
|---|---|---|---|
| **responseScore** | per provider at its night slot (W11), `ProviderScoreRefreshService.RescoreAsync` | `BusinessProfile.responseScore` | needs windowed behavioural data |
| **reliabilityScore** | nightly, same place | `BusinessProfile.reliabilityScore` | same |
| **acceptanceScore** | nightly, same place | `BusinessProfile.acceptanceScore` | same; penalty only |
| **completenessScore** | ‼️ **at INDEX time**, `ProviderSearchIndexer` | **nowhere** — derived on every rebuild | fresh the moment a provider adds a price, and it reaches providers with NO analytics traffic, whom the signal-driven nightly job never sees (E2) |

**responseScore = speed × coverage**, pooled over both channels a customer reaches a provider through:
```
latencies = [ProviderConfirmedAt − CreatedAt]  ∪  [Conversation.FirstReplyAt − CreatedAt]
contacts  = confirmable bookings + inquiries received
answers   = (confirmed OR explicitly declined) + inquiries replied
raw       = Band(median(latencies)) × answers / contacts
score     = (w × prior + contacts × raw) / (w + contacts)          // P4-106; no contacts ⇒ exactly the prior
```
‼️ **P4-106 / D-102 (6) — no cliff at a sample count.** Both scores shrink toward a PRIOR with the trusted-rating
formula (`RatingValue.Trusted`'s shape): `w + n > 0 ? (w × prior + Σ observed) / (w + n) : prior`, clamped 0–100 and
rounded. `ProviderScoring:ResponsePriorMean`/`ResponsePriorWeight` and `ReliabilityPriorMean`/`ReliabilityPriorWeight`
(75 / 5 each) are SETTINGS whose class defaults equal appsettings; the old "fewer than 5 ⇒ neutral 50" thresholds
(`MinResponseSampleCount`, `MinReliabilitySampleCount`, `NeutralScore`) are deleted. Each event moves the score by a
bounded, continuous step (the speed and failure-rate bands are straight lines between anchors, not steps), so one
contact can never swing a business across a whole band. ‼️ (2026-09-29: below `MinimumSamples` a never-measured
business stores NULL, not the prior — see the block above.) ‼️ `ProviderBoostComposer`'s REWARD reads a MISSING score as that same prior (it takes the bound
`ProviderScoringSettings`, now REQUIRED — the API binds `ProviderScoring:ResponsePriorMean`/`ReliabilityPriorMean` and
both `AzureSearchQuery` and `ProviderSearchService` pass it; `ProviderScoringPriorAgreesAcrossHostsTests` pins the two
hosts to the same means), so a new business is never
ranked below one measured at the prior. `ProviderScoreCalculatorTests` (Functions suite, §0.18 — the nightly job is
the consumer) prove monotonic + continuous in every event, new business == prior, and the formula equals the
rating's. No screen shows these numbers; Insights levers describe them in words only.
- ‼️ **LEADS ARE DELIBERATELY EXCLUDED** (owner). Leads have their own commercial lever — tier-step
  delivery — and lead-quality ordering is **Phase 3B**. A provider who does not do quotes is not punished.
- ‼️ **A Partner-created booking is auto-confirmed at creation** (`BookingController.cs:746`), so it was
  never a response. Excluded (`ProviderScoreEvaluator.IsRequest`: `CreatedBy` ≠ `Business`) — counting it would hand a
  free 100 to every provider who books on a customer's behalf.

**reliabilityScore — ‼️ provider-caused ONLY (E5).** `NoShowProvider`, a business cancelling a booking it had confirmed
(reason `CouldNotDoIt` or none), and `RejectedTimeout` where the **provider** was the awaited party (≥ `JudgeAfterOpenHours`
opening hours). A decline is **never** a reliability event (2026-09-29: it belongs to acceptance). Customer-caused outcomes
are excluded from the numerator **and** the denominator.

‼️ **`Booking.timeoutParty` exists because attribution was otherwise impossible.**
`BookingTimeoutProcessor.cs` stamps `cancelledBy = "System"` for BOTH parties and the only other signal
was a **localized** `CancellationReason` — string-matching it would break the moment a provider picks Hindi.

### ‼️ The reindex-storm defence — do not remove it
Writing a score is a Cosmos write ⇒ change feed ⇒ a full provider + service reindex. `ProviderScoreRefreshService.RescoreAsync` (W11)
therefore **skips the write entirely when no stored score moved** (response, reliability, acceptance). Scores are rounded whole numbers, so a
night whose window barely moved usually leaves them unchanged and costs nothing. `TrySetProviderScoresAsync` is a **field-scoped patch with NO ETag**
on purpose: patching only those paths cannot clobber a concurrent provider edit, while a read-modify-write
could. Proved against real Cosmos.

**E3 away mode:** a provider hidden from customers (paused, not in the marketplace, not Active, or no findable service)
has their scores **not rewritten** (`ProviderScoring:PauseScoringWhenUnlisted`). They are filtered out of search while
hidden, so stale scores are harmless; scoring resumes on the first nightly run after they return (a lapsed override is
still expired first).
**E8:** a failed run holds the watermark and leaves the previous scores standing. Nothing ever clears them.

### `newAreaSince` — append-only, and it MUST live in Cosmos
`BusinessProfile.newAreaSince`: `"{citySlug}|{yyyy-MM-dd}"`, the date the provider **first** published in
each area, written by `IProviderAreaHistoryService` from `ServiceAreaController` (create + city change)
and `BusinessProfileController` (primary address save).

- ‼️ **It lives in Cosmos because every index write is a FULL REBUILD (A5).** If the index were the only
  home, the first rebuild after a provider dropped an area would erase the history the anti-gaming rule
  depends on. Pinned by `Upsert_NewAreaSince_SurvivesAFullRebuild`.
- ‼️ **APPEND-ONLY: never deleted, never overwritten** — not when the area is removed, not on
  deactivate-and-return. Remove-and-re-add is the only real way to farm the "New" badge.
  `TryAppendNewAreaAsync` uses two conditional patches plus a bounded re-read, never a read-modify-write.
- ‼️ **Store the DATE, never an `isNew` boolean** — a boolean goes stale and would need a nightly sweep
  rewriting rows for zero information.
- The city slug comes from the shared `SeoSlug.Slugify`, **never a second algorithm**.
- **READ CONTRACT: take the EARLIEST date per city slug.** Two writes for the same city either side of a
  UTC midnight can both pass the write-once check, and the first publication is the truthful one.
- Denormalised onto the **service** index too, so the badge shows on service search (6.2.3).

### Provider lifecycle — ‼️ there was NOTHING here before Phase 2
**VERIFIED: no code path anywhere set `BusinessProfile.Status` to Inactive/Suspended/Pending.** Every
write was `= Active`. Suspension existed only in SQL/Identity and never touched Cosmos. The index-removal
machinery was real and wired — it simply had no trigger.

`IProviderLifecycleService` (`clinqetinfrastructure/Services/Provider/`) is now the **ONE** place status
changes. Three endpoints on `BusinessProfileController`:
`GET business/profile/lifecycle` · `POST business/profile/deactivate` · `POST business/profile/reactivate`.

- ‼️ **D-L2: deactivation is BLOCKED while any booking is Awaiting*/Confirmed/InProgress**, enforced
  server-side, and the **409 carries the blocking bookings** — a block a provider cannot act on is a dead
  end. The `GET` exists so the UI can disable its own button: a convenience, never the authority.
- ‼️ **D-L1: 30-day purge** via `BusinessProfile:DeactivationPurgeDays`, written as a Cosmos `ttl`.
  **Reactivation sets `ttl` to null** — a returning provider that kept its countdown would be silently
  deleted mid-comeback.
- ‼️ **Every transition raises an admin alert**, success or not, gated by
  `BusinessProfile:AlertOnProviderDeactivation`, so a silent index-sync failure is impossible to miss.
- **Removal from search is immediate**, driven by the status change on the change feed. TTL expiry emits
  **no** change-feed event in `LatestVersion` mode and could never have done it.
- Admin suspend is **Phase 4**: the service already accepts `Suspended` and refuses everything else.

### Geocoding — cost + a permanent-null gap, both closed
`GoogleGeocodingService` now has an `IMemoryCache` (‼️ **`Size = 1` on every write** — the shared caches
carry a `SizeLimit`). **Only successes are cached**: a failure is usually transient and caching it would
pin a provider out of geo search for the whole TTL. `Geocoding:CacheMinutes` (1440; 0 disables).

A successful **fallback** geocode is now written back to Cosmos (`Geocoding:PersistFallbackCoordinates`),
so it is paid once instead of on every rebuild forever — and an address whose write-time geocode failed
stops being invisible to distance scoring until a human re-saves it. It only ever **fills a gap**.
‼️ **The write-back re-enters the indexer once** (it is a Cosmos write). That is bounded and
self-terminating: the second pass reads the stored coordinate and never geocodes.

‼️ **A patch `FilterPredicate` over a NESTED path (`c.coordinates.latitude`) is rejected by the Cosmos
emulator** — `PostgresError(42601)`, a 500. The service-area write-back therefore uses the ETag-CAS
pattern (re-read, check in memory, patch on that ETag) instead. Top-level paths in a FilterPredicate are
fine — `TryAppendNewAreaAsync` uses them.

### `PromoCode.ShowInBanner` — ONE column, not two
Part 8.5 originally specified `IsSystemFunded` + `IsPublicPromo`. **Both were redundant**, and the owner
caught it. `Audience == Customer` **is** the platform-funded kind by construction (`ProviderPayoutService`
funds the promo gap from the platform's own gateway balance), and "may be shown to anyone" was already
`!IsTargeted && IsListed`, live at `CustomerPromoService.cs:157`. The survivor is the one genuinely
non-derivable decision — the editorial homepage-hero pick — defaulting **false**. `IsListed` governs a
**different surface** (cart teaser + pay sheet), so a promo worth listing there is not automatically worth
the hero slot.

‼️ **SESSION 14: an admin CANNOT SET IT TODAY.** The column exists and round-trips in SQL, but it is
absent from `PromoCodeConfigDto`, `PromoCodeUpsertDto`, `ApplyPromo` (`AdminBillingConfigController.cs:1193`)
and `MapPromo` (`:1406`). ‼️ **The promo CRUD it belongs on already exists** at
`/api/v1/admin/billing-config/promos` — so wiring it is a FIELD on an existing contract, not a new
endpoint. Phase 4B does it.

### ‼️ THE SEO DISCOVERY CATALOG — an empty result must NEVER be a 200 (session 14 outage)

**A live dev-site outage, and the failure mode is worth memorising.** `SeoDiscoveryCatalogService`
guarded a **crashed** rebuild but let a **successful build over an EMPTY index** through as a `200 OK`
with empty lists. A 200 is a *success*, so Next cached it — **on Azure App Service `/home`, which is
persistent storage that survives restarts AND redeploys**. Result: no category icons, and every city and
category×city landing page 404'd, for six hours, immune to every deploy.

| Rule | Why |
|---|---|
| **Empty ⇒ serve last-good, else throw ⇒ 503** | Nothing empty can be a 200, so nothing empty can be cached — by any client, ever |
| **Clients treat an empty catalog as Unavailable** | Defence in depth. ‼️ EITHER list empty is a failure — mobile's guard was `AND` and let "categories but no cities" through |
| **An empty COMBO slice is NOT a failure** | It is the doorway-page 404 working as designed |
| ‼️ **Do not cache it twice** | The web held it 6 h on top of the API's own 6 h, so the TTLs **stacked** — a new city could take ~12 h to appear. Client TTL is now 60 s; the API is the layer paying the Azure Search cost |

**Diagnostic that isolates it in 30 seconds:** if `/public/discovery/catalog` returns cities but
`/services/city/{slug}` returns **404**, the client has a cached empty catalog. **404 vs 500 is the
discriminator** — only an *Ok-but-empty* catalog 404s; a failed fetch 500s.

### ‼️ The catalog is SCOPED — the matrix is opt-in

The category×city matrix is the only part that grows with the business. Shipping all of it to every page
made a render cost more as the platform succeeded, and forced a city cap that silently denied city N+1 a
landing page.

```
GET /public/discovery/catalog                    homepage, cities index — NO combos
GET .../catalog?city=hamilton                    a city page — that city's column
GET .../catalog?category=…&city=…                a landing page — ‼️ the UNION of the row and the column
GET .../catalog?allCombos=true                   the sitemap, which enumerates by definition
```

- ‼️ **Both names is a UNION, not an intersection.** A landing page renders three things from that
  slice: does the pair exist, what else is in this city, where else is this category. An intersection
  returns one row and silently empties both link lists — a real defect, caught by a test.
- Cities carry **`categoryCount`** and **`topCategories`** so list surfaces need no matrix at all.
- **Names, never slugs** — the slug algorithm lives only in the clients (`lib/seo/slug.js`, `slugify`).
- ‼️ **If you add a filter, your test stub must honour it.** The landing-page suite passed unchanged
  after the split because its stub returned everything for any catalog URL. Making it scope-aware caught
  the union defect immediately.

### ‼️ The catalog build fans out over CATEGORIES, never cities

It used to issue **one Azure Search query per city**, so every new town cost another query on every
rebuild — the only reason `MaxCities` had to be small enough to deny city 61 a landing page. It now fans
out over the **category** list, which is bounded by the catalogue. **Query cost is flat in city count**
(pinned at 3 / 40 / 400 cities). `MaxCities` (**500**) is now a **payload** bound, not a query bound.

### ‼️ `(0,0)` IS NOT A LOCATION — and the rule must live in ONE place

`Number(null)` is `0` and `0` is finite, so any client that converts before checking for absence sends
**latitude 0, longitude 0** — a point in the Atlantic Ocean. Combined with a city filter it asked for
"in Hamilton AND within N km of the ocean" and returned **zero** for every facet chip.

- `/services` had always stripped it; ‼️ **`/filters` never did** — because the rule was **copy-pasted
  per DTO** and the facet copy was forgotten. The fix was to **delete the duplication**:
  `IGeoScopedRequest`, one `NormalizeAbsentCoordinates`, one `ApplyCoordinateRadiusDefaultAsync`.
- ‼️ **Centre and radius are ONE decision.** The resolver's answered position used to be discarded while
  its radius was adopted, leaving an unusable centre with a real radius.
- Server-side `CoordinateSentinel` is the authority; clients guard too (`hasCoordinatePair`,
  `isUsableGeoPair`).

### Settings — which host binds what, and why
| Key | Host | Reader |
|---|---|---|
| `ProviderScoring:*` | ‼️ **Functions only** | the nightly aggregator is the only reader — do not bind it in the API |
| `BusinessProfile:DeactivationPurgeDays` / `AlertOnProviderDeactivation` | **API only** | the lifecycle service lives there |
| `Geocoding:CacheMinutes` / `PersistFallbackCoordinates` | **both** | both hosts geocode |

No ARM / `deploy.ps1` change: nothing new is in `local.settings.json` and no Azure resource was added.

### Tests that will fail your build if you get this wrong
`ProviderScoreCalculatorTests` (37 — every band edge from both sides) · `ProviderLifecycleServiceTests`
(15) · `ProviderAreaHistoryServiceTests` (12) · `SmartAnalyticsProviderScoresTests` (13) ·
`BusinessProfileLifecycleEndpointTests` (8) · geocode-cache cases in `GoogleGeocodingServiceTests` ·
`ProviderIndexConventionTests` gained three guards (`newAreaSince` filterable + **never searchable** on
BOTH documents, the three scores filterable + sortable, `CurrentSchemaVersion >= 2`) ·
`ProviderScoresLifecycleCosmosIntegrationTests` + `PromoBannerFlagSqlTests` against real engines.
**All new guards were verified by deliberately breaking the code and watching each one fail.**

---

## PROVIDER READ PATH — the composed boost, diversity rounds and offer localization (Phase 3, 2026-07-28)

### Which engine answers which request — ONE rule
**No search text ⇒ the PROVIDER index. Text ⇒ the SERVICE index, unchanged.** Full-text belongs to the
service index, which owns the vector, semantic and spell-correction layers; the provider index is a
**browse** index and has no `textEmbedding` and no semantic configuration, deliberately.

| Surface | Engine | Entry point |
|---|---|---|
| `GET /api/search/providers`, no text | provider | `RecommendationSearchService.SearchProvidersFromIndexAsync` → `IProviderSearchService` |
| `GET /api/search/providers`, with text | service | the existing hybrid pipeline (‼️ `Page` is now passed through — see below) |
| `GET /api/v1/discovery/recommended-providers` (the rail) | provider | `GetRecommendedProvidersCoreAsync` |
| `GET /api/search/filters` with `grain=Provider` and no text | provider | `IProviderSearchService.ComputeFacetsAsync` |
| `GET /api/search/services`, landing pages | service | unchanged (S3 held) |

‼️ **Facets must be counted on the engine that answered the results**, or a provider list shows service
counts. That is what the `grain` parameter (`SearchGrain` enum) is for. Microsoft confirms a facet over a
complex sub-field counts **parent** documents, so provider-index counts are provider counts naturally.

### `IProviderSearchService` — one query, exact paging
`clinqetinfrastructure/Services/Search/ProviderSearchService.cs`. **Singleton, stateless.** It fetches the whole
addressable window (`Search:MaxResultDepth`, 500), applies the composed boost over it, sorts, then slices the page.
‼️ 2026-09-29: an explicit sort, or no location, reads the ONE primary row per business in one call, deduped by
`BusinessId` (a moved primary row and its successor can both be held for a moment); only a relevance order with a
location reads every area row through `FanOutWindow` under one `SessionId` (each business keeps its best row). Total =
`DistinctSeen` when the window was read to the end, else a second, size-0 primary-row count. `AddressableCount` = the
window held (`min(hits, MaxResultDepth)`) — what a client can page to; `RecommendationSearchService` sizes
`TotalPages` from it.

‼️ **Why the whole window and not `$skip`:** the composed boost is a POST-query multiplier. Reordering a
`$skip`-ed page would be an in-memory re-sort of a slice — exactly the `ApplyTierPriority` defect (A7).
Provider documents are ~1–2 KB with no vector, so 500 of them is cheap.

- Filters come from `ProviderSearchFilterBuilder` — the provider-grain twin of
  `SearchFilterExpressionBuilder`. ‼️ **Two predicates change meaning at provider grain, deliberately:**
  `minRating` reads `businessRating` alone (a provider has no per-service rating), and the price band tests
  the provider's **envelope** (`minPrice`/`maxPrice`), which answers "has anything in this band".
- **Every sort ends with `businessId asc`** (E1) — without it a page boundary can show one provider twice; an
  every-row read adds `id asc` (two rows of one business can tie).
- ‼️ **Price sorts add `fromPrice ne null`.** Azure has no null-ordering control, so "cheapest first" would
  otherwise put every price-less provider at the top. Symmetric on both directions; it narrows the set for
  those two sorts only.
- `serviceCount gt 0` (E9) · `isListed eq true` · `businessStatus eq 'Active'` — always.
- `topOfferEndsAt` is checked **at query time** (E25): an offer that lapsed between the write and the read
  is stripped from the card.
- ‼️ **Fail loud, never an empty 200 (E11).** A *filtered* zero-result is a normal 200. An **empty index**
  throws `ProviderIndexUnavailableException` → **503** on all three surfaces, localized in five languages
  (`Error_ProviderSearchUnavailable`). The distinction costs one cheap unfiltered probe, cached for
  `Search:ProviderIndexPopulatedCacheMinutes` with `Size = 1`.

### `ProviderBoostComposer` — the ONE ranking formula
`clinqetcore/Utilities/ProviderBoostComposer.cs`. Pure, deterministic, **query-time** (D-D2: the industry
hybrid — signals are indexed, weights are applied at query time, so a flag flip needs no reindex).

```
points = 0.100·(response/100) + 0.100·(reliability/100) + 0.025·(completeness/100)
       + 0.012·verified + 0.008·clinketBadge
       + clamp(searchBoostFactor − 1.0, 0, 0.025)          ← tier
       + 0.005·newInRequestedCity
if hasSearchText: points ×= 0.5                            ← 5.3 #3
reward = clamp(1 + points, 1.0, 1.275)                     ← MaxCompositeFactor (the sum of every dial, D-102)
factor = reward × max(PenaltyCombinedFloor, Πpenalty)      ← §13.1, 2026-09-29; NOT halved on a typed search
```

- ‼️ **Earned 0.225 : granted 0.025 : bought 0.025 (D-102, owner-approved 2026-09-27 — was 0.100 : 0.025 : 0.025).**
  Asserted by a build-failing test. **Never re-derive or rebalance these; escalate to the owner.**
- ‼️ **A missing response or reliability score counts at its STARTING value (P4-106)** — a new business sits at a fair
  middle, never at zero; any other unknown dial contributes nothing — never a penalty, never a silent zero. The
  PENALTY never reads the prior: a null score costs nothing.
- ‼️ **New-in-area takes the EARLIEST date per city slug** (E15c: remove-and-re-add must not reset it).
  **No city in context ⇒ no boost.** Never guess an area.
- `clinketBadge` is null until Phase 4 — treat as "no badge", never an error.

‼️ **There is NO on/off flag for the boost — the owner removed the one a session added (12.9).** The
composed factor is LIVE. Kill switches: `Search:Boost:MaxCompositeFactor = 1.0` disables it entirely, and
any single weight set to `0` retires that dial.

~~‼️ The earned dials cannot reach the SERVICE path yet.~~ ✅ **CLOSED (12.8) — all four are on the service index now.** Historic note: `ServiceSearchDocument` carries only
`searchBoostFactor`, `isVerified` and `newAreaSince` — no `responseScore`, `reliabilityScore`,
`completenessScore` or `clinketBadge`. Denormalising those four is additive and needs no rebuild, but it is
a **BUILD GATE** item and was not on the approved Phase-3 list.

### D-R14 — the boost runs AFTER the relevance floor, on BOTH instances
The order in `FuseResultsAsync` is now:
```
fuse (RRF) → coherence penalty → normalise → RELEVANCE FLOOR →
ordering boosts: "comes to your address" × composite (FusedScore ONLY, D-104) → diversity rounds → sort → FinalRank
```
‼️ **`NormalizedScore` is relevance-pure.** The boost multiplies `FusedScore`, which is what `ApplySorting`
orders on. That single change also fixes the second instance — `ApplyExpansionQualityGate` filters on
`NormalizedScore` after fusion returns — and it makes the absolute band gates (MatchQuality 70/55/40,
expansion 30) read a score no money has touched. **Not flag-gated, deliberately: it is a defect fix, and a
flag would make "money can rescue a bad result" a supported configuration.**

### ‼️ Where `IsRecommended` may be DRAWN — owner decision 2026-08-10

`RecommendedOrganicMerger.Merge` puts recommended items FIRST and stamps every organic one
`IsRecommended = false`. That ordering is the reason the chip earns its place in one kind of list and
noise in the other:

| Surface | Chip | Why |
|---|---|---|
| `/services`, `/providers`, customer-mobile search | **shown** | recommended items sit inside an organic ranking — the chip is the only thing explaining the card's presence |
| Home rails (`dashboardTrendingServices`, `dashboardServiceProviders`) and their View-All page `app/(customer)/service/[id]` | **removed** | the heading is already *"Recommended Services · Top-rated services picked for you"*, and because recommended items lead, the chip landed on every one of the first five or six cards |

- ‼️ **The rails do not map `isRecommended` onto card data at all** — the card is shared, so suppression
  lives at the mapper, not behind a prop. Re-adding the field to any of those three mappers puts the chip
  back on every leading card.
- ‼️ **The chip is frosted white `bg-white/90` with navy `#032858` ink**, matching the distance pill
  opposite it. It was navy-on-green — byte-identical to the `FromClinket` chip, the highest-authority
  badge in the app — which is what made a personalisation hint shout. Customer mobile was a SOLID green
  pill and is now the same frosted chip, with **literal** colours rather than theme tokens because it
  floats over a photo and a themed ink turns white-on-white in dark mode.
- **There is NO provider-side equivalent.** `isRecommended` is customer-discovery only; nothing in partner
  web or partner mobile renders it.
- Copy is `search.recommendedBadge` (web) / `SEARCH_RESULT.RECOMMENDED` (mobile). CSS `uppercase` used to
  hide a lowercase Spanish string and a `tu`-form French one; both were corrected when the transform went.

Pinned: `clinqetwebuserapp/components/customer/recommendedBadgePlacement.test.jsx` (both signs — chip
present in results, absent from all three rail mappers) and
`clinqetmobileuserapp/__tests__/recommendedBadgeStyle.test.ts`. Sabotage-verified on both.

Mockup of the options considered: `C:\Nik\Data\mockups\for-you-badge\index.html`.

### Diversity rounds — everyone's best before anyone's second
`ResultDiversityRounds.Apply` — ordering only, nothing dropped, no score changed.
```
round = min(rank of this result within its provider, MaxResultsPerProvider + 1)
sort by (round asc, score desc, businessId, serviceId)
```
Three call sites: `FuseResultsAsync` (text), `ExecuteDiscoveryQueryAsync` (browse), and
`RecommendedOrganicMerger.Merge` — the last uses `ApplyByPosition`, because the merge's two halves come
from **different queries** and their scores are not comparable.

- ‼️ **Skipped on any explicit sort.** "Cheapest first" must never become "cheapest per provider".
- ‼️ **`businessId, serviceId` last is mandatory** — equal scores would otherwise order
  non-deterministically and duplicate or skip rows across pages (E1, applied to the service path).
- ‼️ **D-D1a: with diversity on, `ComputeRecallFetchSize` returns the FIXED `MaxResultDepth`.** A deeper
  refetch changes `effectiveK` and therefore every fused score, and a newly-surfaced provider entering
  round 1 shifts every later position — page 2 would re-show the last row of page 1. **The cost is real:
  an uncached query fetches 500 rows per leg instead of 60.** `Search:Diversity:MaxResultsPerProvider = 0`
  restores the page-scaled depth exactly.
- ‼️ **That fixed depth is ALSO the vector-oversampling multiplicand — the pool is 50x what the benchmark
  used.** `KNearestNeighborsCount = max(Search:VectorKNearestNeighbors, fetchSize)`, so with diversity on it
  is `MaxResultDepth` (500), and the `bq-mrl` index compression's `defaultOversampling: 10` (D-13/D-19)
  multiplies it: **every marketplace vector query retrieves 5,000 candidates from the truncated binary HNSW
  graph and rescores them against full-precision 3072-dim originals.** Microsoft's NDCG@10 parity measurement
  almost certainly used a **100**-candidate pool (k=10 x 10 — INFERRED from “NDCG@10”, not stated by them). Ours is 50x deeper — better for recall, and
  currently FREE: at 790 (CA) / 79 (IN) service documents you cannot oversample past the corpus, which is
  why the quantization A/B measured 272 ms vs 277 ms rather than a win. **Read `k x oversampling`, never
  `pageSize x oversampling`** — the page size tells you nothing about the vector cost here.
- ‼️ **If vector latency ever bites at millions of documents, the lever order is fixed.** Use a QUERY-TIME
  `oversampling` override on the vector leg (`Oversampling`, declared on the base `VectorQuery` and inherited by
  `VectorizedQuery`; verified present in the pinned SDK 12.0.0 — it overrides the index value for that query only) — **nothing in the codebase sets one today, so the index's 10 is in force everywhere.**
  Do **NOT** lower the index default: it is what protects the head queries, where top-1 decides which
  provider gets the lead. Do **NOT** reach for `MaxResultsPerProvider` — that is a provider-fairness
  product decision, not a performance knob, and zeroing it also silently restores page-scaled recall depth.
  Do **NOT** set `exhaustive: true` (E74/D-29) — eKNN disables oversampling AND rescoring outright.
- Structurally cannot reach broadcast — that pipeline never calls `AzureSearchQuery`. Phase 3B owns leads.

### Offers are STRUCTURED, never a rendered string
‼️ **`FormatDiscountDisplay` is deleted.** It baked `"OFF"` in English and a hardcoded `$` into the index,
so an Indian provider's ₹200 discount read `"$200 OFF"` to a Hindi-speaking customer.

- `OfferInfoDto` carries `discountType` + `discountValue`; the provider index carries `topOfferType`,
  `topOfferValue`, `topOfferEndsAt`; `RecentlyVisited*` carry `offerDiscountType`/`offerDiscountValue`.
- Clients format with `utils/offerLabel.js` (web) / `src/utils/offerLabel.ts` (mobile). **Top-offer rule:
  largest discount, tie-broken by soonest expiry, then offer id** — without a fixed rule the band flickers
  on every re-index.
- ‼️ **`ActiveOfferInfo.DiscountDisplay` is KEPT on the index document, unwritten.** Removing a complex
  sub-field forces a full index **rebuild**, which discards every stored enrichment and embedding and
  forces a full re-embedding of the catalogue at real AI cost. Delete it at the next deliberate rebuild.

### AI enrichment — the inert-fix trap, closed
‼️ **`ComputeEnrichmentContentHash` now includes `PromptVersion`.** Without it, improving the prompt is
**completely inert**: the hash stored on an already-indexed document still matches, so the old enrichment
is reused forever. Bump `SearchIndexEnrichment:PromptVersion` in **both** hosts whenever the prompt changes.

Prompt **v3** removed the two causes of "a service literally named *Haircut* ranks below *Keratin*":
the worked example that told the model to emit the bare token `hair` into `searchKeywords` (text weight
**8.0**, second only to `serviceName`), and the 300–500-word `embeddingText` that made every service in a
category sit next to every query in that category in vector space. Umbrella terms now belong **only** in
`broadMatchTerms`, and `embeddingText` is ~100 words front-loaded with what makes the service distinct.

### Provider index — 47 fields (Phase 3 added eight)
`yearsOfExperience` · `availability` (complex, 7 × `isAvailable`; ‼️ its **own** nullable-bool type, not the
service index's) · `minPrice` / `maxPrice` (the price ENVELOPE — hourly rates **included**, unlike
`fromPrice`, which stays a display number; the SERVICE index got its own `fromPrice` on 2026-09-29 — see "ONE ROW PER
SERVICE AREA") · `createdAt` (the **Newest** sort; `updatedAt` is not a proxy) ·
`topOfferType` / `topOfferValue` / `topOfferEndsAt`. `CurrentSchemaVersion` is **3**.

### Deleted in Phase 3 — gone, not merely unreferenced
`ApplyTierPriority` · `TierOrdinal` · `EnrichProvidersAsync` · `AddProvidersFromResults` ·
`RecommendationTierPriorityTests.cs`.
‼️ **`SlicePage` and `CloneRequestForCandidateFetch` STAY** — the text path still needs them.
‼️ **`GroupByBusiness` stays** — landing pages (S3) are held.

### Settings — which host binds what, and why
| Key | Host | Reader |
|---|---|---|
| `Search:Boost:*`, `Search:Diversity:*`, `Badges:*` | ‼️ **BOTH** | the API's read path **and** `SearchJudgeFunction`, which runs the LIVE pipeline nightly to measure Recall@10/MRR — without them it would score a ranking no customer sees |
| `Search:ProviderIndexPopulatedCacheMinutes` | API only | the provider read path |
| `SearchIndexEnrichment:PromptVersion` | both | the indexer runs in both |

### Traps this phase paid for
- ‼️ **`MinNormalizedScoreThreshold` and `BM25MinScore` bind from `HybridSearchScoringSettings`, NOT from
  `IConfiguration`** (`AzureSearchQuery.cs:265`). A test that sets the config key changes nothing — and can
  pass for entirely the wrong reason.
- ‼️ **The Functions `appsettings.json` has THREE `"SystemPrompt"` keys.** A non-global regex replace hits
  the wrong one. Count occurrences before editing any JSON key by name.
- ‼️ A leftover `testhost.exe` locks `Clinqet.API.dll` and fails the next build (`MSB3027`).

### Tests that will fail your build if you get this wrong
`ProviderBoostComposerTests` (20 — every band, null-is-unknown, half strength, the four 5.2.5 guardrails) ·
`ResultDiversityRoundsTests` (12 — the real failing query, no-op proofs, tie determinism, paging stability,
positional merge) · `AzureSearchQueryBoostOrderTests` (6 — ‼️ **the floor runs before the boost, asserted as
a SET equality on both semantic paths**, plus the fixed-depth proof) · `ProviderSearchFilterBuilderTests`
(10 — the OData string is pinned) · `SearchEnrichmentHashConventionTests` (4) ·
`ProviderIndexConventionTests` gained three guards (the eight fields' flags, **recursion into complex
sub-types**, day-name parity with the service index).
**All six new guards were verified by deliberately breaking the code and watching each one fail** —
‼️ **and two sabotage attempts reported a false pass before the third was correct.**

### ‼️ THE AI COST BOUNDARY — read this before touching the indexer

Two AI costs exist per service document: **one LLM enrichment call** and **one embedding call**. Both are
guarded by a content hash stored on the previously-indexed document, and the rule is one sentence:

> **Enrichment and embedding regenerate if and only if the SERVICE's own text changes.**
> A business-level change — rating, review, logo, description, availability, portfolio, offers, service
> areas, tier, quality scores, lifecycle — must **never** cost an AI call.

Both hashes derive from exactly the same four values plus the prompt version:

```
serviceName · categoryName · subcategoryName · serviceDescription · PromptVersion
```

- `ComputeEnrichmentContentHash(...)` — reuse the stored enrichment when it matches.
- `BuildEmbeddingText(BuildServiceSemanticText(...), enrichment)` — reuse the stored vector when the
  resulting string hashes the same.

Because the embedding input is built from the enrichment-hash inputs **plus the enrichment output** (itself
a pure function of those inputs), a matched enrichment hash **guarantees** a matched embedding hash.

#### ‼️ The defect this replaced — do not reintroduce it
`BuildEmbeddingText` used to append `[QUALITY] Business rated 4.8/5 from 126 reviews`. `BusinessRating` is
in `ReindexDocumentTypes`, so a new review rebuilt **every** service document of that business — and the
changed quality line busted every embedding hash.

**One new review = one embedding call per service that provider owns.** A 48-service salon collecting 20
reviews burned 960 calls. It bought nothing: rating already boosts via `magnitude(serviceRating, 1.1, 3→5)`
and `magnitude(businessRating, 0.9, 3→5)`, and is already a semantic content field
(`serviceQualitySummary`). A vector encodes meaning, not magnitude — "4.8/5 from 126" and "4.2/5 from 12"
are near-identical vectors.

`serviceQualitySummary` is still written on every rebuild. Only the **embedding input** lost it.

#### ‼️ Indexing a field is NOT enough — it must also be SELECTED
Azure returns only the fields a query selects. A signal that is indexed, written and read by the ranking
code but missing from `ServiceSearchSelectFields` arrives **null**, and the dial is silently dead with
nothing failing. This is not hypothetical: `newAreaSince` shipped in Phase 2, was read by the composer in
Phase 3, and was **never selected** — the New-in-area dial was inert on the service path the whole time.
Unit tests did not catch it because they construct documents directly and never go through the projection.

#### Known, accepted AI-cost events
| Event | Cost | Verdict |
|---|---|---|
| Service name / description / category / subcategory edit | re-enrich + re-embed, that service only | correct — the semantics changed |
| `SearchIndexEnrichment:PromptVersion` bump | re-enrich + re-embed the whole catalogue, once | deliberate; bundle any index rebuild with it |
| Category or subcategory **rename** | re-enrich + re-embed every service in it | semantically correct, but a large admin-triggered bill — know before you rename |
| A previous enrichment that stored nothing | retried next rebuild | correct |
| **Anything business-level** | **zero AI** | the invariant |

#### The guards, and why they are source scans rather than behaviour tests
A cost regression breaks nothing: search still works, rankings still look right, and the first symptom is
the invoice months later. So the guards assert the *derivation boundary*:

- `EmbeddingCostBoundaryTests` — the builder takes no business-level parameter; the call site passes none;
  the embedding input derives from exactly the enrichment-hash inputs; **and the quality signal still
  exists as a semantic field**, because an over-correction is a failure too.
- `SearchSelectFieldsConventionTests` — every signal the composer reads is actually selected, checked in
  both directions so a newly-read field cannot slip past the list.

#### Completeness is business-level — keep a business's documents consistent
`completenessScore` describes the whole business, so every one of its service documents must carry the
**same** value; two rows of one provider ranking differently would be indefensible.

- A **business-level** event → `ReindexBusinessServicesAsync` → the batch path rebuilds every service at
  once and already holds the whole service set, so completeness is computed **once per business** there.
- A **single-service** write has no view of its siblings, so it **carries the previous value forward**.
- The provider index computes it once per business per rebuild, and every row of the business carries it.

### ‼️ THE FLAG RULE — no flags in search/discovery

> `Badges:TierBadgesEnabled` was the one flag; it was **DELETED on 2026-10-04** together with the paid
> `Pro` / `TopPro` badges it gated (`Data\two-plan-pricing\PLAN.md` D9 — a plan never buys a trust mark).
> `BadgeSettings` now holds only `NewProviderDays`.
>
> **Every badge and every ranking dial applies whenever its own condition is met. No flags.**

‼️ A session once added `Search:Boost:Enabled` off the back of a misread plan sentence and the owner
removed it. **Do not re-introduce an on/off flag for the boost, the diversity rounds, or any badge.**
Rollback lives in the dials themselves:

| To turn off | Set |
|---|---|
| the whole composed boost | `Search:Boost:MaxCompositeFactor = 1.0` |
| one dial | that dial’s weight to `0` (e.g. `Search:Boost:ResponseWeight`) |
| the diversity rounds | `Search:Diversity:MaxResultsPerProvider = 0` (also restores page-scaled recall) |
| the New-in-area badge + boost | `Badges:NewProviderDays = 0` — it is a WINDOW, not a flag |
| enrichment prompt v3 | `SearchIndexEnrichment:PromptVersion` back to `2` in both hosts |

### Batched existing-doc prefetch (AzureSearchIndexer)

‼️ SUPERSEDED (D-21): the reuse hashes and vectors are read from the blob AI cache (`ServiceAiCacheArtifact`, keyed by
`serviceId`), not from the index; `ExistingDocPrefetchChunkSize` / `ExistingDocReuseFields` are no longer in the code
(verified 2026-09-29). Historic text:

A business rebuild hydrates every already-indexed doc in chunked filtered queries (`search.in(id, ...)`)
instead of one `GetDocumentAsync` per service. `id` is filterable, so the filter bounds the match count to
the chunk size and nothing can be silently truncated.

| Setting | Default | Meaning |
|---|---|---|
| `SearchIndexEnrichment:ExistingDocPrefetchChunkSize` | 50 | ids per query. **0 disables batching** and restores one read per document. Lower it if a chunk response is ever too large — each doc carries a 3072-float vector. |
| `SearchIndexEnrichment:AlertOnExistingDocPrefetchFailure` | true | false ⇒ no admin alert on fallback. Behaviour is unchanged either way. |

‼️ **THE INVARIANT: a failed prefetch falls back to per-document reads — NEVER to “assume absent”.**
Assuming absent would re-run AI enrichment AND re-embedding for the entire business. Absent from a
*successful* prefetch is the only safe way to conclude a doc does not exist. Both paths select the same
fields via `ExistingDocReuseFields` — if they drift, one path loses a hash and pays for work the other
reuses. Pinned by `AzureSearchIndexerPrefetchTests` (5 tests, 3 sabotages verified).

### TIER BADGE (Pro / Top Pro) — ‼️ DELETED 2026-10-04

The paid `Pro` / `TopPro` badges, their `Badges:TierBadgesEnabled` flag and the `badge` entitlement are gone
(see "Two plans" below). Historic text, from before Phase 6 built and later removed them:

There is no badge UI today: `clinketBadge` is written `null` (`AzureSearchIndexer.cs:1107`) and
`ClinketBadgeWeight` is a ranking dial, not a display. Creating the flag before the badge = dead config.
Master plan **Part 6.1** holds the full acceptance checklist.

## Phase 4B changes (2026-07-28)

- ‼️ **`isFeatured` is RETIRED from the read path.** Out of `ServiceSearchSelectFields`, out of
  `SearchResponseDto` / `RecommendedProvidersResponseDto`, out of both mappers, and the indexer no
  longer writes it. **The POCO property STAYS** (`SearchDocument.IsFeatured`) because
  `cosmosindexsetup` calls `CreateOrUpdateIndexAsync` over the field list the POCO generates, and
  dropping a field from a live index is not something to attempt when re-creating it would discard every
  stored embedding. **Keep the `banner` entitlement** — a sold benefit line at
  `ProviderBillingController.cs:1826`; its numeric limit is deliberately unread (reading it would be a
  second tier mechanism on top of the ladder).
- ✅ **`clinketBadge` is now WRITTEN** by both indexers from `BusinessProfile.ClinketBadge` (was
  hardcoded `null`). It is already in `ServiceSearchSelectFields`, and `ProviderSearchService` sets no
  `Select` at all, so it cannot be a dead dial on either index.
- `"FeaturedPlacement"` removed from `SearchIndexSyncFunction.ReindexDocumentTypes` — nothing will ever
  write that document type (8.6 is design only).
- ‼️ **The banner uses the SERVICE index, never the provider index** — a slide is a service and
  `ProviderSearchDocument` carries neither a service name nor a service photo.

## Session 16 changes (2026-07-29) — badges shipped, Verified corrected, a live 503 fixed

### ‼️ FILTERABLE ≠ FACETABLE — the bug that blanked every provider filter chip
`GET /api/search/filters?grain=Provider` returned **503** on dev:
`FieldNotFacetable: 'yearsOfExperience'`. The provider facet list had been **copied from the service
grain**, where that field IS facetable; on `ProviderSearchDocument` it is
`[SimpleField(IsFilterable = true, IsSortable = true)]` — filterable and sortable, **deliberately not
facetable**. ‼️ **Azure rejects the ENTIRE facet request over one bad field**, so one string blanked
every chip.

- **Fix is code only** — `yearsOfExperience` removed from `ProviderSearchService.DefaultFacetFields`
  (now `internal static readonly` so a test can read it). **No index change, no reindex.**
- ‼️ The **setting** `Search:Facets:YearsOfExperienceBuckets` **stays** — `AzureSearchFacetService.cs:63`
  still reads it for the service grain. Deleting it would have orphaned a live consumer.
- **The experience FILTER was never broken** and still works; only the count buckets were removed, and
  nothing consumed them (the client's 1/3/5/10 options are fixed).
- **Guard:** `ProviderFacetSpecsConventionTests` fails the build if any default facet field is not
  `IsFacetable` on the provider document, plus a named pin keeping `yearsOfExperience` out.
- ‼️ **If a future phase wants real counts beside experience, THAT is an index change** — drop, recreate
  and reindex both regions, and it needs owner approval first.

### ‼️ Verified is an ADMIN FACT — it used to be SOLD
Both indexers stamped `IsVerified = entitlements.HasFeature("badge")`, and the catalog gave Premium the
badge value `"verified"`. **No admin screen could verify anyone**, and under the promo grant everyone was
verified. Corrected:

| Piece | Now |
|---|---|
| `BusinessProfile.IsVerified` | `bool?` — written only when true (the `clinketBadge` shape) |
| `IBusinessProfileRepository.TrySetVerifiedAsync` | ETag CAS; `Set` on grant, **`Remove` on revoke** |
| `ProviderSearchIndexer` / `AzureSearchIndexer` | read `profile.IsVerified` / `business.IsVerified` |
| `BillingCatalogDefinition` | **v7** — `badge` = `"pro"` / `"top_pro"`, i.e. the **tier** badge (‼️ v12 retired the `badge` key; `BillingCatalogSeeder.RetiredFeatureKeys` purges it) |
| `VerificationStatus` enum + its projection | **deleted** (only reader was the projection's own idempotency check) |

### ‼️ Badges — option 1: raw facts indexed, finished list computed server-side
`ProviderBadgeBuilder` (`clinqetcore/Utilities/`) is the ONE definition. Order **IS** the contract:
`Verified · FromClinket · Preferred · Partner · New` (`TopPro` and `Pro` were removed from `ProviderBadge` on 2026-10-04).

- Emitted as **`badges[]`** on `RecommendedProviderSearchResultDto`, `ServiceSearchResultDto`,
  `LandingProviderDto`. ‼️ **`tier` and `isVerified` were REMOVED from all three** — tier is commercial
  standing no customer surface renders, and a bare verified flag beside the list is a second source of truth.
- ~~`Badges:TierBadgesEnabled`~~ — existed from this session until **2026-10-04**, when it was deleted with
  the `Pro`/`TopPro` badges it gated.
- **Costs nothing:** every input was already indexed AND already selected for the ranking composer.
- ‼️ **Storing a finished badge on the index was REJECTED**: "New" changes with the calendar *and* the
  city being viewed, and flipping the tier flag would need a full corpus reindex.
- ‼️ **The landing projection needed `clinketBadge` / `tierLevel` / `newAreaSince` added** — an
  unselected field arrives null and the badge silently never renders (the inert-fix trap).
- **Badge context is request-dependent** (`RequestCity` + `NowUtc`) and threaded through every mapper
  call site. No city ⇒ no New badge, never a guess (E15d).

## Two plans — what search shows and ranks (2026-10-04)

Authority `C:\Nik\Data\two-plan-pricing\PLAN.md` (D9, D10). Plans are `SubscriptionTier { Free, Premium }`.

- **No paid badge.** `ProviderBadge` = `Verified · FromClinket · Preferred · Partner · New`. `Pro` / `TopPro`, `Badges:TierBadgesEnabled` and the `badge` entitlement are deleted (`BillingCatalogSeeder.RetiredFeatureKeys` purges the SQL rows). Verified stays an admin fact (`business.IsVerified`).
- **Boost.** `search_boost` = Premium **1.025** (the old Max value), Free 1.00 — still only a tie-breaker inside the composed boost.
- **Homepage banner.** `HomepageBannerService` marks every slide from a paid tier `IsPaid = tier != SubscriptionTier.Free`, so Premium slides arrive with `isPaid: true` and both customer apps show the existing "Sponsored" label (`banner` entitlement = Premium).
- **Lead waves.** `leadsPriority` is stamped from `leads_priority` (Premium 1, Free 2, missing ⇒ 2).
- **Customer note.** Both customer apps add a "How results are ranked" info near the results — web `components/customer/services/SearchRankingInfo.jsx` (`search.ranking.*` keys), mobile `src/components/SearchRankingInfo.tsx` — saying Premium providers get a small boost.

## ‼️ CITY DISCOVERY = `discoveryCities` UNION FIELD (session 22, 2026-07-30)

**The bug:** a provider's extra service areas (e.g. MK's Sherbrooke/Kingston/Lévis) never appeared as
towns, city pages, or city filter chips. **The sync was NEVER broken** — both indexers already write
ALL selected areas, and every result filter is `(addressCity eq x or serviceAreas/any(sa: sa/city eq x))`.
The gap was the ENUMERATION layer: every city facet counted the single-valued `addressCity`.

- **`discoveryCities` / `discoveryStates`** on BOTH documents = `addressCity ∪ serviceArea{Cities,States}`
  (`AzureSearchIndexer.BuildDiscoveryValues` — trims, dedupes OrdinalIgnoreCase; ProviderSearchIndexer
  reuses it). `SimpleField(IsFilterable, IsFacetable)`, in both cosmosindexsetup lowercase-normalizer
  lists. ‼️ **Deliberately NOT searchable** — a searchable duplicate would double-count city tokens in BM25.
- **Three facet layers swapped to the union field, response keys UNCHANGED** (client contracts intact):
  `SeoDiscoveryCatalogService` (national + per-category facets → towns band / city pages / sitemap),
  `AzureSearchFacetService` (`addresscity`/`addressstate` specs → union fields, aliased back via
  `FacetResponseAliases`), `ProviderSearchService` (`DefaultFacetFields` + `MapFacetFieldToClientName`).
- ‼️ **Do not "simplify" a facet back to `addressCity`** — that re-opens the blind spot. Filters keep
  using the OR expression; the union field exists so counts MATCH that expression exactly.
- Additive fields ⇒ `dotnet run --launch-profile "Dev (Canada)"` in cosmosindexsetup was enough (ran +
  REST-verified 2026-07-30). ‼️ Existing DOCS carry the values only after a rebuild: deploy API+functions,
  then per-business `POST /api/v1/admin/search/reindex-business/{businessId}` (a Cosmos write IS the backfill).
- Tests: `AzureSearchIndexerDiscoveryValuesTests` (union semantics), union asserts in
  `ProviderSearchIndexerTests`, facet-spec pins updated in `AzureSearchFacetServiceTests` +
  `SeoDiscoveryCatalogServiceTests` (stub facets keyed `discoveryCities` now).

## Card city is CONTEXTUAL + cities get a dominant state (session 22 waves 3/4, 2026-07-30)

- **Card `city`/`state` pick chain** (`ServiceSearchResultMapper.PickContextualArea`, mirrored in
  `ProviderSearchResultMapper` and `SeoLandingResultsService`): request-city-matching service area →
  `IsClosest` area → sole area → business address. Fixes "Quebec-area machine labelled Burlington".
  ‼️ `CalculateLocationMetrics` runs UNCONDITIONALLY (audit removed the `hasLocation` gate) — the
  browse path needs area NAMES even without coordinates; do not re-gate it.
- **`DiscoveryCityDto.State`**: `SeoDiscoveryCatalogService.BuildCityStateMapAsync` runs one facet pass
  per state (geography-bounded fan-out — never per-city) and assigns each city its DOMINANT state;
  count ties break by `string.CompareOrdinal` so runs are deterministic.
  `SeoDiscoverySettings.MaxStates = 60` (class default == appsettings, both must stay in sync).
- `AzureSearchFacetService` disjunctive-set membership compares `OrdinalIgnoreCase` — request casing
  must not silently drop the disjunctive treatment.
- Consumers: web home `CitiesBand` reorders a 60-entry pool client-side (visitor city → same province →
  size; crawler HTML stays the national top 8), and the cities index groups by province with the
  visitor's province first. ‼️ Mixed state forms turned out to be REAL (addresses geocode to
  "Ontario"; service-area picks store "ON"/"QC") — `StateNameCanonicalizer` (clinqetcore/Utilities)
  now canonicalizes codes→English long names at BOTH ends: `BuildDiscoveryStates` (both indexers)
  and the STATE filter, which moved to `discoveryStates/any(s: s eq ...)` in
  SearchFilterExpressionBuilder + ProviderSearchFilterBuilder so counts and filters read the SAME
  field (Broadcast filters deliberately untouched). Docs written before the canonicalization
  deploy still carry raw forms — redeploy API+functions, then rerun the per-business reindex.

### Reindex is CHEAP — the durable AI-cost guard (verified live 2026-07-30)
Every index doc stores `EnrichmentContentHash` + `EmbeddingContentHash`. On any rebuild the indexer
prefetches the existing doc and REUSES the stored LLM enrichment and vector when the hashes match —
a backfill/reindex with unchanged text pays ZERO AI calls (775 docs reindexed in seconds on dev).
‼️ NEVER delete+recreate the index to backfill an additive field: existing docs are the hash cache,
and losing them re-pays LLM+embedding for the whole corpus. Additive schema update + per-business
`POST /api/v1/admin/search/reindex-business/{id}` is the entire playbook. Cosmos is untouched by
discovery fields — they are computed at index-write time from data already on the profile.

### Provider page: ONE routing rule for results AND facets (reviewed + fixed 2026-07-30)
- ‼️ **`/api/search/providers` routing (D-D4)**: NO text ⇒ provider index (`search=*` + filters, exact
  paging, composed boost). WITH text ⇒ the SERVICE pipeline (spell/vector/semantic own full-text),
  deduped by business. `/search/filters` MIRRORS it: `Grain==Provider && !hasFacetText` ⇒ provider
  index facets, else the service facet service (text-aware). Never split the pair — facets must
  count the same universe that produced the visible results.
- ‼️ **Provider-grain facets now honor `DisjunctiveFacets`** (self-exclusion, Algolia semantics,
  mirroring AzureSearchFacetService): picking a city used to compute the city facet UNDER the city
  filter and the dropdown collapsed to that one city. Extra disjoint queries fire ONLY for
  dimensions with an ACTIVE filter (cost guard). `ProviderSearchServiceFacetTests` pins it.
- Known units nuance (deliberate, E17): with TEXT on the provider page the chips count SERVICE
  docs while the list shows deduped PROVIDERS — provider-grain counts under text are not feasible
  in one facet call. Provider-grain facet path has no response cache (service grain does) — fine at
  current traffic; add the same TTL cache if the provider page ever gets hot.

## 2026-07-30 — Phase-6 combining audit
- **E14 closed**: SearchIndexAuditFunction reconciles provider-index membership (see clinqet-function-app). ‼️ Service-grain `businessId` is FILTERABLE-only — facet-based reconciliation would need an index-attribute change = full rebuild + re-embed (BUILD GATE); the bounded `not search.in` design avoids it.
- ✅ **RESOLVED (plan 17→22.8, owner-approved 2026-07-30): the diversity rounds are now relevance-banded.** `Search:Diversity:MinRoundScoreRatio` (0.5, both hosts; `0` = unbanded rounds exactly): a row competes for a promoted round seat only within that fraction of the best surviving result's relevance-pure `NormalizedScore` — so a near-floor row (the "haircut" excavator, 17.68 vs 78.15) can never take a seat, and money cannot buy one (the band ignores the boosted FusedScore). ‼️ **TEXT path only — the browse call site passes 0 deliberately** (no query ⇒ nothing to be relevant to; browse spread is rating/distance). Guardrail 5 in `AzureSearchQueryBoostOrderTests` pins seat-denial, ratio-0 restoration, browse-unbanded and the 0.5 mirror. ‼️ Single-leg RRF compresses the worst rank to ~50% of top — sub-0.5 rows come from cross-leg vector noise, exactly the class the band targets.
- `SearchIndexEnrichment:PromptVersion` code fallback must TRACK the shipped version (now "3") — a lower fallback silently re-enriches the whole corpus.

## 22.9e (2026-07-30) — fuzzy ladder fix (the "excavator on a haircut query" root cause)
- `SearchQueryTextProcessor.BuildFuzzyQuery` ladder is settings-driven: `word~2` at ≥`Search:FuzzyEditDistance2MinLength` (9), `(word~1 | word*)` at ≥`Search:FuzzyEditDistance1MinLength` (6), `(word | word*)` at ≥`Search:FuzzyMinimumLength` (4) — **4-5 char words are NEVER edit-fuzzed** (`hair~1` matches `air`: recall went 538→94 docs on "hair cut"; typos that short are the spell layer's job, proven live).
- The processor is the ONE shaper for search results, facet counts AND broadcast BM25 — never add a parallel query builder. Shape pins live in `SearchQueryTextProcessorTests` (API unit).
- Diversity band `Search:Diversity:MinRoundScoreRatio` default is **0.6** (0.5 let a 0.528-ratio excavator through; weakest legit hair result sits at 0.759).

## ‼️ 22.9f (2026-07-30) — the vector score is 1 + cosine, NOT a similarity
- Azure AI Search returns **`1 + cosine`** as `@search.score` on a cosine-metric vector index. Clamping it to [0,1] (what both search and broadcast did) maps **every doc with cos >= 0 to a perfect 1.0**, silently disabling EVERY cosine threshold: the fusion floor, the single-source boost gate, the semantic-skip confidence checks, and the suggestion floors.
- Always convert with **`Clinqet.Core.Utilities.VectorScoreNormalizer.ToCosineSimilarity`** (`score - 1`, clamped). ONE implementation on purpose — duplicated private copies are how this defect shipped in two services at once. Monotonic ⇒ RRF rank order is unaffected.
- Thresholds live in TRUE cosine space, calibrated from measured **query-side** embeddings (a strong match peaks ~0.40, typical genuine ~0.31, cross-domain noise <= 0.15): `Search:VectorMinScore` **0.15**, `SingleSourceVectorMinScore` **0.25**, `VectorHighConfidenceThreshold` **0.35**, `Semantic:SkipVectorThreshold` **0.30**, `Suggestion:*` **0.15 / 0.25**, broadcast **0.15 / 0.25**. ‼️ Doc-to-doc cosine runs ~3x higher than query-to-doc — never calibrate a query-side floor from doc-to-doc numbers.
- ‼️ OPEN (plan 22.9g): `NormalizeBM25Score` has the SAME saturation — K=50 against real raw scores of 645-1569 ⇒ every hit >= 50 clamps to 1.000 and the adaptive floor never adapts. Needs relative-to-top normalization, not a bigger constant.

## ‼️ 22.9g/22.9i (2026-07-30) — BM25 ratio-to-best + expansion-on-insufficient
- BM25 normalization is **ratio-to-best of the SAME query** via `Clinqet.Core.Utilities.LexicalScoreNormalizer` — never an absolute curve (raw BM25 is unbounded; `log(1+raw)/log(1+50)` saturated every real hit to 1.000). `BM25MinScore` = **0.005** is a measured RECALL junk-line (genuine matches run as low as ratio 0.0100; junk at 0.0047) — relevance is decided downstream by RRF + `MinNormalizedScoreThreshold` + the diversity band. Never "tidy" it up to a bigger number.
- **Expansion fires on too FEW results, not only zero**: `Search:Expansion:MinResultsBeforeExpansion` (3) / `Broadcast:Matching:MinProvidersBeforeExpansion` (3). **Every ladder phase must reach the threshold to declare victory** — a partial phase is remembered (best-so-far snapshot) and superseded, never returned early; originals are **union-carried** so a non-empty result set can never shrink.
- Partial expansion uses the `Search_Expansion_*_Partial` localization keys ("Only a few results…") — the base keys say "No results" and are a LIE when `PreExpansionResultCount > 0`.
- The 0-100 `searchScore`/NormalizedScore sent to the UI is `min(100, fused/maxRRF x 100)` — rank-based, unaffected by either normalizer.
- Every score dial is scale-free by construction: cosine (query↔doc property), ratio-to-best (per-query), RRF (rank-based), ratio bands. Corpus growth changes NONE of them.

## ‼️ 22.9j (2026-07-31) — synonyms: the shaper must keep PLAIN tokens
- Fuzzy/wildcard query terms BYPASS the analyzer ⇒ they never reach the synonym map. Every shaped branch carries the plain token (`(word | word~1 | word*)`), and multi-word queries LEAD with the plain contiguous phrase (`(hair cut) (hair | hair*) cut`) — multi-word synonym rules need adjacency. Pins in `SearchQueryTextProcessorTests`.
- The synonym file is `cosmosindexsetup/synonyms.txt` (719 rules, Solr equivalence lines) → `clinket-synonyms-dev` map, attached to serviceName/description/phrases/tags/businessName/category fields. Author rules ONE domain per rule; never a standalone GenericServiceWords/StopWords member (bare "removal" made snow-removal queries match MOVERS); never ambiguous <=2-char members ("pt" merged physiotherapy with personal trainers). Re-run cosmosindexsetup per region to upload — in-place, no reindex.
- Offers rank via the INDEX-time scoring profile (`activeOfferCount` ×1.05 binary — ANY live offer, D-105 — plus `activeOfferNames` text weight 3.5) — the query-time composer deliberately has no offer dial.

## ‼️ 22.9k (2026-07-31) — vector queries MUST name the pure profile
- Azure returns **`1/(2 - cosine)`** on a cosine-metric vector index. Convert with `VectorScoreNormalizer.ToCosineSimilarity` (`2 - 1/score`). ‼️ NEVER assume `score - 1`.
- ‼️ **Every vector query must set `ScoringProfile = SearchScoringProfiles.VectorPure`.** Without it the query inherits the index `defaultScoringProfile`, whose freshness/rating/review/offer functions MULTIPLY the similarity (~1.9x, non-uniformly) — recency and commercial signals then decide the one leg that must be pure relevance. Measured: the best semantic match for "hair cut" fell out of the vector top 12. The profile declares ZERO functions; TextWeights are inert on a vector query (verified), so it needs no field list.
- Vector thresholds are TRUE cosine: fusion floor **0.20**, single-source gate **0.45**, semantic-skip **0.50/0.55**. Measured genuine 0.58-0.63; no-match ceilings 0.171 (gibberish) / 0.144 (a category with no services). `SearchThresholdCalibrationTests` fails if a dial leaves the evidence band.
- Unaffected by design (verified, do not "fix"): provider index (explicit profile, no vectors), facets, the semantic legs (read `RerankerScore`), BM25 legs (boosts belong there), voice catalog, and **classify** (in-process cosine over cached category vectors).

---

## ‼️‼️ TEARDOWN REMOVES FROM THE INDEX **EXPLICITLY** — the change feed emits NO hard deletes (PHASE 16, 2026-08-09)

`SearchIndexSyncFunction` takes a service out of the index only when a change-feed event shows
`isDeleted || !isActive || !isApproved`. **The Cosmos change feed does not emit hard deletes.**

So when a business is CLOSED and its `/businessId` partitions are purged, the feed fires **nothing**: every one
of its services would stay in Azure AI Search forever — findable, rankable and bookable on a business that no
longer exists.

`BusinessClosureTeardown` therefore calls **`IAzureSearchIndexer.DeleteAllServicesForBusinessAsync(businessId)`
EXPLICITLY, before the purge**, and refuses to continue if it did not complete:

| Property | Why it matters |
|---|---|
| **ONE batched delete, not N** | routing teardown through the feed would be N services → N events → N search calls, at unknown latency, with no way to know it finished |
| **Verified BEFORE anything is destroyed** | a failed delete THROWS, leaving the Cosmos documents intact for the retry — the index and the data cannot diverge |
| **Idempotent** | deleting an absent document is a no-op, so a Service Bus redelivery is free |
| **No `ttl` field anywhere** | the original design purged via TTL so the feed could drain first; `Service` has no `Ttl` field, so that would have been a Cosmos schema change. Explicit deletion avoids it entirely |

The provider document is removed the same way, via
`IProviderSearchIndexer.DeleteProviderDocumentAsync(businessId)`, followed by an IndexNow ping on the Open Page
slug so crawlers re-fetch rather than serving a page that has gone.

The change feed remains the **safety net** — `EvaluateStaleDeleteEventAsync` already re-checks and no-ops on a
stale event.

> ‼️ **The architectural line: change feeds are for incremental updates. TEARDOWN IS EXPLICIT.**
> Anything that removes a whole business from the platform must delete from the index itself and must not
> assume a feed will notice.

---

## ‼️ SEARCH-PERFORMANCE PHASE 1 (2026-08-09) — the quick-win pack. Read before touching embeddings, caches or the judge

Program home: `C:\Nik\search-performance\` (master plan + phases + probes + audits + dashboards).
PRIME DIRECTIVE: search/suggest/classify/broadcast output may NEVER degrade — every phase proves
result-set parity with `probes\probe.ps1` before it ships. Phase 1 proved 14/14 probes identical.

### ‼️ The embedding service is a SINGLETON with a single-flight cache — never a typed HttpClient again
- `AzureAIFoundryEmbeddingService` was a TRANSIENT typed client owning a private MemoryCache ⇒ the
  cache was per-request, i.e. ALWAYS EMPTY — every search/suggest/classify/broadcast request paid a
  fresh remote embedding call (root cause C1; Azure AI Search was never the bottleneck).
- Now: **singleton** taking `IHttpClientFactory`, calling the NAMED client
  (`AzureAIFoundryEmbeddingService.HttpClientName`) per fetch — handler rotation preserved. The named
  client carries `api-key` + timeout in ALL THREE hosts (API `Program.cs` ~:912, Functions ~:698,
  MCP ~:240 conditional on ApiKey). ‼️ The DI-level Polly stacks were DELETED — the service-internal
  pipeline is the ONE retry owner (`AzureAIFoundry:MaxRetries`; `<= 0` = no retry, supported).
- **Single-flight, non-poisoning:** concurrent identical texts share ONE detached fetch (own CTS at
  the client-timeout ceiling). A caller that cancels or blows its budget abandons the WAIT while the
  fetch completes and warms the cache. Failures return the `[]` sentinel and cache NOTHING; empty
  vectors are never cached. Registry entries remove themselves in the fetch's `finally`.
- Keys: `emb_{deployment}_{SHA256(normalized text)}` — normalization (trim/collapse/lowercase) is
  KEY-ONLY behind `Search:EmbeddingCache:CaseInsensitiveKeys` (true); the text sent to the API is
  never altered. Cache: `MaxSize` 5000, `SlidingExpirationMinutes` 720, `AbsoluteExpirationHours` 168
  (deterministic value ⇒ TTL is a memory bound, not correctness). Old `ExpirationMinutes` key is GONE.
- Budgets: search already had `Search:EmbeddingBudgetSeconds` (5); Phase 1 extended budgets to the
  SUGGEST path (same wrapper) and CLASSIFY (`BroadcastClassification:EmbeddingBudgetSeconds` = 5,
  expiry ⇒ empty-embedding degrade, caller cancellation still propagates).
- Pins: `AzureAIFoundryEmbeddingServiceTests` (incl. the poison test), integration
  `EmbeddingServiceLifetimeTests` (descriptor IS singleton), and the MCP convention test now asserts
  NAMED-clients-only in that host.

### Classify (Phase-1 shape)
- Analytics Service Bus send is FIRE-AND-FORGET (`SafeFireAsync`) — it was awaited on the response path.
- Text classification (cascade Stage 2): `MaxCompletionTokens` **300** + `Cascade:LlmReasoningEffort` **Low**.
  Vision keeps its OWN cap (`VisionMaxCompletionTokens` 5000) and its own dial (`VisionReasoningEffort`
  **Low**, pinned 2026-08-31 — unset it measured p95 4.9 s against 2.2 s).
- **Cascade shadow logging is GONE** (AI cost programme Phase 6, 2026-09-01). It only ran while
  `Cascade:Enabled=false`, and that switch was deleted together with everything it guarded: the C1 legacy
  dual-LLM branch (`ClassifyWithAIAsync`), `ClassificationReasoningEffort`, `ShadowLogging`, `ShadowTopK`,
  the `C1-quote-classify-text` sub-flow id + its budget-dial entry, and the unscoped 3-arg
  `ICategoryEmbeddingService.GetTopMatchesAsync` overload. The cascade (C2) is the only text path.

### Caches (Part I pack — all sizes are appsettings, defaults mirror)
| Cache | Now |
|---|---|
| Embeddings | 5,000 · sliding 12 h · abs 7 d (above) |
| Suggestions `Search:Caching:SuggestionCacheMaxSize` | 5,000 (TTL 60 min unchanged) |
| **Search results** | ‼️ its OWN private bounded MemoryCache — `Search:ResultCache:MaxEntries` 250, TTL **10 min**, and keys are **user-agnostic** (`GenerateCacheKey(request, locale)` — the hybrid pipeline receives no user identity, so results are a pure function of request+locale+index-generation). The per-user machinery (`InvalidateUserCache`, generations, key tracking) is DELETED — it had zero production callers. Why the move: the shared cache's SizeLimit counts ENTRIES at `Size=1`, so a ~1 MB result set weighed the same as a 40-byte string |
| Facets `Search:Facets:MaxCacheEntries` | 4,000 |
| Categories `CategoryCache:GlobalCategoriesCacheDurationHours` | 24 (CRUD invalidates) |
| Classify prompt | `CategoryCache:PromptCacheDurationHours` 24 — was a hardcoded 6 h const |
| Geocoding `Geocoding:CacheMinutes` | 10,080 (successes only) |
- Every cache emits hit/miss/eviction counters via the **`Clinket.SearchCaches` meter**
  (`clinqetinfrastructure\Observability\SearchCacheMetrics.cs`, static — AddMeter'd in API + Functions
  OTel). Watch the App Service PLAN working set before growing anything (5-6 apps share 4 GB).

### The judge actually runs now
- ‼️ `Search:Judge:CorpusPath` = `""` used to kill the `?? bundledPath` fallback — the judge silently
  skipped EVERY run since it shipped. Empty/whitespace now resolves to the bundled corpus; a
  missing/EMPTY corpus raises an admin alert (never a silent skip).
- ‼️ `Search:Judge:DefaultCountry` was "United States" on every stamp — the first real run would have
  zeroed every query on ca/in and fired the expansion ladder ~120× nightly. Per-stamp
  `Search__Judge__DefaultCountry` (India/Canada) is set in BOTH deploy.ps1 function-settings blocks +
  the three local.settings files; repo appsettings default is "Canada".
- Corpus: 121 labeled queries (typos, aliases, split/concat, long problem statements, cross-domain
  traps, FR/HI, zero-supply via `expectZeroResults`, sort/page stability via optional `sortBy`/`page`).
  Category-ID filter entries need REAL per-environment ids — ops add them; never invent ids.

### Also changed
- Semantic leg no longer requests `QueryCaption`/`QueryAnswer` (only `RerankerScore` is read; pin:
  `AzureSearchQuerySemanticOptionsTests`). Broadcast's leg already used `None` — untouched (Phase 4B).
- `addressCountry` added to `ServiceSearchSelectFields` (the mapper read it for currency; unselected
  it arrived null and currency always fell back — the inert-fix trap again).
- Location resolution (`ApplyCoordinateRadiusDefaultAsync`) runs AFTER the rate-limit gate on
  `/services` AND `/providers` (an unauthenticated flood could drive geocode/Cosmos/Search work).
- CORS: `SetPreflightMaxAge(1h)` on all Main-API + Identity policies (browsers cache preflights ~5 s
  per URL otherwise). Customer web: `X-Requested-With` dropped (server-unused);
  `X-Correlation-Id`/`X-Client-Version` dropped from SUGGEST only (server mints correlation, reads
  `X-App-Version` there — ‼️ `BaseController.GetClientVersion()` reads `X-Client-Version` on OTHER
  controllers, so never drop it globally). Suggest LRU (30 s TTL + in-flight dedupe) wired via the
  existing apiCache utils in BOTH customer apps; results render decoupled from facets on web; mobile
  results/filters gained timeouts (15 s/10 s) + abort-on-param-change; debounce unified at 250 ms.
- ‼️ Baseline probe: `C:\Nik\search-performance\probes\probe.ps1` — run against a local API and
  compare RESULT SETS, not just timings, before shipping any search change.

### ‼️ CORRECTION to this file's own history: `SearchIndexSyncFunction` `StartFromBeginning` is **TRUE** — deliberately
The 2026-07-02 note above ("StartFromBeginning: false — cost bomb") is STALE. The code sets `true`
with an in-code rationale: a fresh lease prefix must rebuild an EMPTY index (a feed positioned at
"now" leaves every existing provider invisible), and the enrichment/embedding content hashes bound a
replay's AI cost to what is genuinely missing. Do not "fix" it back to false.

---

## ‼️ SEARCH-PERFORMANCE PHASE 2 (2026-08-09) — the suggest fast path. Read before touching /suggest

PRIME DIRECTIVE unchanged (probe result-set parity gates every phase). Phase-2 audit:
`C:\Nik\search-performance\audits\PHASE-2-AUDIT.md`. Suggest is now **lexical-first (owner
decision #3)**: spell and vector are OFF the keystroke path, a RAM prefix store serves
Completions-scope requests, and a single-flight coalesces concurrent identical keystrokes.

### Spell + vector left the keystroke path (config-driven, one-line reverts)
- `Suggestion:EnableSpellCorrection=false` and `Suggestion:EnableVectorSearch=false` (API
  appsettings; `AzureSearchQuery` ctor defaults mirror). The suggester's native fuzzy covers
  1-edit typos — the `haircot` probe was byte-identical with spell off.
- **Long-tail vector fallback**: `Suggestion:VectorFallbackOnly=true` — embedding+vector runs
  ONLY when the BM25 suggester returned 0 AND the query has ≥`VectorFallbackMinTokens` (2) tokens
  AND ≥`VectorFallbackMinLength` (6) chars. That is the ONLY remaining suggest-path embedding
  call site (still budget-wrapped).
- **Truthful analytics** (`SuggestionVectorSkipReasons` constants, `clinqetshared\Constants`):
  vector ran ⇒ `VectorSearchSkipped=false`; BM25 had hits ⇒ `BM25Sufficient`; gate/config
  excluded it ⇒ `DisabledByConfiguration`; store fast path ⇒ `PrefixFastPath`. Attempted-but-
  failed is NOT "skipped" (`VectorUsed=false` carries it, mirroring the search legs).
  ‼️ Fixed while here: `VectorSearchExecuted` in the suggestion Parquet stream had been
  **permanently false since it shipped** (never assigned) — the controller now maps it from
  `Metrics.VectorUsed`.

### `SuggestionPrefixStore` (clinqetinfrastructure\Services\Search\Suggest\; API-only)
- Singleton; per-country immutable snapshot (sorted key array + entry array) swapped via
  Volatile write (the CatalogDictionary pattern); refreshed by
  `SuggestionPrefixStoreRefreshHostedService` every `Suggestion:PrefixStore:RefreshMinutes` (10)
  + on startup, from a paginated `$select` scan of the service index
  (`isActive eq true and isListed eq true` — the suggestion filter's membership). Empty/failed
  scan keeps the previous snapshot; staleness ≥60 min logs Critical.
- **Keys per entry**: full normalized text + **concatenated form** ("hair cut" → "haircut" — the
  analyzer-level term; without it "haircu" can never reach a two-token name) + non-leading
  token suffixes ("updo hair style" → "hair style", "style" — the suggester's any-token-prefix
  semantics). Lookup = binary search + bounded range scan (`MaxKeyRangeScan`), rank =
  starts-with tier → kind (name>subcat>cat>phrase) → weight → shorter → ordinal, then the
  **reactive derivation shape**: name → subcategory → category (phrase entries emit their OWNER
  service's name first, then the phrase text).
- Entry kinds: `SuggestionPrefixEntryKind` (ServiceName/Category/Subcategory/Phrase). Category/
  subcategory entries are **scan-derived (service-backed)**, deliberately NOT from the category
  cache — a cache-sourced category with zero in-country services would suggest a tap-to-zero
  result. Sandbox footprint: 1,322 entries ≈ 0.58 MB from 108 docs in 144 ms;
  `MaxEntriesPerCountry` (20,000) caps a partition at ≈9 MB.
- **Controller fast path** (`SearchController.GetSuggestions`, AFTER the cache check):
  `scope=Completions` + NO City + store ready + ≥`MinStoreCompletions` (3) hits ⇒ answered from
  RAM (`ExecuteHybridSuggestionAsync` never runs; pinned `Times.Never`), NOT written to the
  60-min suggestion cache (the store's own refresh is the freshness mechanism). City-scoped
  requests always stay reactive (city narrows the suggester filter; the store is
  country-grained). ‼️ **All-scope output is byte-identical store on/off BY DESIGN** — the store
  only backfills when the reactive path produced ZERO completions; a non-empty reactive list is
  never reordered or extended (that IS the §7.2 parity gate — proven 6/6 on the ladder).
  ‼️ **No production client sends scope=Completions yet** (both apps send scope null ⇒ All); the
  client opt-in is a queued owner decision.
- Suggestion analytics fires on EVERY path including store hits; **`ServedFromPrefixStore`**
  (bool?, appended at the END) is the ONE schema change — `SuggestionAnalyticsSchemaVersion` is
  now **2** (44 fields; pinned incl. a last-position append-only guard). The compactor unions
  shard schemas and keeps the highest version, so mixed v1/v2 days compact correctly.

### Single-flight (`SuggestionSingleFlightService`, API-only)
Concurrent identical suggest requests (same composite suggestion cache key) share ONE reactive
pipeline run. ‼️ The compute runs DETACHED in its **own DI scope** on `CancellationToken.None`
(`IAzureSearchQuery` is scoped — borrowing the first caller's scope would dispose it mid-flight
on disconnect); waiters `WaitAsync(callerToken)`; the registry entry removes itself in the
compute's `finally`; failures propagate and are never sticky (embedding-service pattern).

### Traps this phase paid for
- ‼️ `dotnet run --launch-profile X -- --Some:Key=false` **silently does not reach the app**
  through Git Bash — the first "store-off" capture was actually store-ON (caught because phrase
  completions can only come from the store). Use an env var the launch profile does NOT define
  (`Suggestion__PrefixStore__Enabled=false`) and verify via the "disabled via configuration"
  log line.
- ‼️ `search page2`'s DEEP TAIL (fused ranks ~30-40) is not stable across separate cold recalls
  (tie ordering) — three same-binary runs reproduced a third arrangement. Phase-3 must not
  mistake it for a regression; page 1 is stable.
- ‼️ A Phase-1 mobile test (`searchFacetScope.test.ts`) still mocked `apiClient` after
  `fetchFilters` moved to raw fetch — two contracts read an empty URL and failed, one PASSED
  TRIVIALLY against zero data. Fixed at the fetch seam with a guard-the-guard assertion. Run the
  FULL mobile Jest suite, not a path-scoped subset.

---

## ‼️ SEARCH-PERFORMANCE PHASE 3 (2026-08-09) — the search critical path. Read before touching ExecuteHybridSearchAsync, the expansion ladder, or /providers text search

PRIME DIRECTIVE unchanged (probe result-set parity gates every phase). Phase-3 audit:
`C:\Nik\search-performance\audits\PHASE-3-AUDIT.md`.

### Embedding ∥ BM25 (5.1) — the embedding no longer serializes the search
- `ExecuteHybridSearchAsync` starts the query-embedding fetch as an **outcome-carrying task that
  NEVER faults** (`FetchEmbeddingOutcomeAsync` → `EmbeddingFetchOutcome`) alongside the BM25 leg;
  the vector leg CHAINS on it inside the same `Task.WhenAll` window; the **dual-coherence
  original-query embedding starts in the same window** (it used to be a serial call after semantic).
  Measured: ~270 ms off the cold median.
- ‼️ The never-faulting shape is load-bearing: the task may be started unawaited and ABANDONED on
  degrade paths — a faulting task there would be an UnobservedTaskException. Its budget CTS lives
  inside `GetOrGenerateEmbeddingWithBudgetAsync`, so an abandoned fetch self-completes ≤ the 5 s
  budget. Caller-cancel is carried as `CallerCancelled` and re-thrown as OCE at the resolve site.
- Flags stay truthful under every interleaving (`EmbeddingFailed`, `VectorUsed`,
  `StrategiesUsedCount` — same arms as the old serial code, unit-pinned under forced failures).
  ‼️ `EmbeddingGenerationTimeMs` is now the **wall time of the call itself** (dependency latency),
  NOT added serial latency — per-stage columns no longer sum to total time by design.
- Dial: `Search:ParallelBm25Embedding` (true; API + Functions appsettings, ctor default mirrors).
  `false` restores the exact serial pre-Phase-3 ordering — proven result-identical live.

### Expansion ladder budget (5.2)
- The whole 4-phase ladder runs under ONE linked budget CTS: `Search:Expansion:TotalBudgetMs`
  (2500) + `Search:Expansion:MaxPhasesPerInitialResponse` (4 = full ladder; counts ATTEMPTED
  phases). Every leg, fusion call and the ladder's embedding regen takes the budget token.
- ‼️ **Budget-cancel and caller-cancel are discriminated at the ladder exit** — caller checked
  FIRST (it also fires the linked token), rethrows; budget expiry returns **best-so-far** (or the
  pre-expansion rows via the caller's carry-over) and logs phases attempted. Leg OCE filters use
  the BUDGET token so a budget expiry can never be swallowed as a generic leg failure; the
  embedding's own 5 s budget expiring still degrades only the vector leg.
- Union-carry + best-so-far (22.9i) untouched: a non-empty result set can never shrink.

### Deterministic tie ordering (5.5) — the page2 instability is FIXED
- ‼️ Root cause was leg-rank assignment: Azure returns **exact-score ties in arbitrary per-recall
  order** (census: 26 tied groups in one query's 98 BM25 hits) and the rank feeds RRF. All three
  legs now **stable-sort (raw score desc → businessId → serviceId) before assigning ranks**;
  `ApplySorting` and the tracked-drops ordering carry the same id tiebreak. Non-ties keep Azure's
  order bit-for-bit; fused output is now a pure function of Azure's (score, id) multiset — proven
  byte-identical across three separate cold recalls (page2 included; it never was before).
- ‼️ Known residual: `sparse(expand)`-class queries can flip their LAST slot across PROCESS
  RESTARTS between two near-score docs — run-to-run float variance in freshly-generated query
  embeddings (upstream SCORE variance, not tie order; within a process it never flips). Do not
  chase it with sort changes.

### /providers WITH text now uses the result cache
- The text branch of `RecommendationSearchService.SearchProvidersAsync` mirrors the /services
  cache: key = `GenerateCacheKey(candidateRequest, locale) + "_ptext"`, hit serves the hybrid
  window from RAM (warm 650–900 ms → **30–52 ms**), miss caches non-empty results.
  ‼️ The `"_ptext"` suffix is deliberate isolation — /services and provider-text entries must never
  share (Page/PageSize are excluded from the hash and the endpoints run different candidate
  windows). Sound because text ⇒ `canPersonalize == false` ⇒ the window is user-agnostic; the
  DEAD personalization blocks in that branch (unreachable since the D-D4 `!hasText` early-return)
  were deleted. `SearchProvidersAsync` takes `locale`; `ProviderSearchExecutionResult.CacheHit`
  feeds truthful analytics (the controller zeroes per-stage timings on hits; `CacheHit` was a
  hardcoded false before).

### Analysis findings recorded (no code)
- **Native one-call hybrid (Azure-side RRF) rejected with data** (audit §7): head-13 parity but
  19/20 tail overlap, and it returns only the fused score — per-leg analytics unmappable, no
  `VectorPure` isolation, no coherence/floor/diversity/boost. Custom fusion stays.
- **Semantic incremental signal**: on the sandbox probe corpus, semantic OFF is byte-identical on
  every probe (~190 ms median cost for zero top-20 change). The Phase-5 decision needs the two-arm
  judge run: `Search__Judge__UseSemanticSearch` true/false, diff NDCG/MRR/Recall from judge parquet.
- Cold p50 is still ~1.26 s in-sandbox: the remaining serial terms are the 500-doc leg fetch
  (Phase 5A, `Search:MaxResultDepth`), semantic (~190 ms median, Phase 5C) and spell L0–L2 —
  all owner-gated; do not "optimize" them ad hoc.

---

## ‼️ SEARCH-PERFORMANCE PHASE 4 (2026-08-09) — the classify cascade. Read before touching BroadcastClassificationService

PRIME DIRECTIVE unchanged. Phase-4 audit: `C:\Nik\search-performance\audits\PHASE-4-AUDIT.md`.
Classify is **embedding-first** now; the LLM runs only on genuinely ambiguous text. The broadcast
consistency pack shipped in the same phase — see the Phase-4B section of `clinqet-quote-lead-broadcast`.

### The cascade (G4) — `BroadcastClassification:Cascade:*`
- **Stage 1 (decisive, zero LLM):** budgeted query embedding (cached, single-flight) → in-process
  cosine over the location-SCOPED catalogue via
  `ICategoryEmbeddingService.GetTopMatchesAsync(embedding, k, allowedKeys)` — allowedKeys =
  "Parent|Sub" PAIR keys only (a parent-only or out-of-scope match can never decide). Decisive iff
  `top1 ≥ Cascade:DecisiveScore` (0.35) AND `(top1−top2) ≥ Cascade:DecisiveMargin` (0.05) ⇒ return
  immediately with `Confidence = Cascade:DecisiveConfidence` (90 — calibrated to the arm's measured
  accuracy, 0 errors in 755 decisive rows; NOT the LLM's self-reported median). ‼️ The MARGIN gate is
  the live-traffic protection (both grid disagreements sat below margin 0.03) — never zero it.
- **Stage 2 (ambiguous):** ONE structured LLM call (`GetStructuredCompletionAsync`, strict
  `{recommendations:[{categoryId,subcategoryId,confidence}]}` schema, `ReasoningEffort.Low`,
  `MaxCompletionTokens` 300, `Cascade:LlmTimeoutSeconds` 5 as BOTH outer budget and per-attempt
  timeout) over the top-`MaxLlmCandidates` (12) candidate pairs rendered in the exact
  `BuildCategoryListForPrompt` shape — ids literal, so the unchanged `ValidateAndScoreAsync`
  hallucination/coherence validation still bites. Budget expiry ⇒ `[]` ⇒ embedding-only fallback.
  Full-catalogue prompt (~12.3k tokens) only when the embedding is dead (honest degradation) —
  candidate prompts are ~20× smaller.
- **Original-text second pass** runs ONLY when the corrected pass lands below
  `LowConfidenceThreshold` (legacy ran it unconditionally in parallel — one fewer LLM call typically).
- **Stage 3 photos:** logic unchanged (below-`FullConfidenceThreshold` gate, stop-at-decisive), now
  per-photo budgeted against the ladder: budget = `TimeoutSeconds − 1 s − elapsed`, 2 s floor; a
  budget expiry keeps best-so-far instead of the controller's 408.
- **`TimeoutSeconds` 20 → 12 → 15** (AI cost programme §9.2: 5 s embedding + 5 s × 2 Stage-2 = 15 s worst
  case; the 12 s ladder could never fit its own arithmetic).
- **There is no kill switch.** `Cascade:Enabled` and the legacy dual-LLM branch were deleted in Phase 6
  (2026-09-01) under the no-flags rule — the cascade is unconditional and `BroadcastClassification` is pinned
  both ways by `BroadcastClassificationSettingsConventionTests` (class defaults ↔ appsettings, no orphans).
- Which stage decided is readable from EXISTING analytics fields — `LlmApiCallCount` 0 = decisive,
  1 = single Stage-2 pass, 2 = original pass ran; no new columns (§0.7 honored).
- `GetTopMatchesAsync` results are deterministically tie-broken (score desc → key) — a decisive
  margin must never depend on dictionary enumeration order.

### Calibration + measured results (PHASE-4-AUDIT §1b/§7 for the full numbers)
- 800-query labeled synthetic grid (subcategory names / "I need …" phrasings / letter-swap typos /
  description phrases) run through the REAL production pipeline as the LLM control, on the FULL
  unscoped catalogue (hardest case — location scoping only removes competitors).
- Control top-1 accuracy 99.35%; pickInTop12 99.74%; **2 disagreements in 771, both below margin
  0.03** (one of them the control being WRONG — the embedding beat it). At the chosen (0.35, 0.05):
  **agreement 100%, decisive coverage 97.9% (synthetic), decisive-zone label errors 0/755, cascade
  accuracy == control**. Deliberately stricter than the max-coverage corner — the corpus is easy, the
  margin is the live protection.
- **Warm decisive p50 53 ms / p95 231 ms** (≤300 ms target met warm); cold first-touch 413–959 ms
  (embedding + spell — Phase-5 territory). Zero LLM calls on decisive text; ambiguous text pays ONE
  ~600-token candidate call vs the old ~12,351-token full-catalogue call (≈20× cheaper per call).
- Force-failure arms verified live: embedding dead ⇒ full-catalogue LLM path answers; LLM dead ⇒
  embedding-only fallback (honest reduced confidence); BOTH dead ⇒ honest empty result, no crash.
  Decisive text now SURVIVES a total LLM outage — the reverse of the pre-phase posture.

### Shared-name + normalizer consolidation that touches SEARCH files (D13/D4)
- `SearchScoringProfiles` now carries `ServiceRelevance`, `ServiceRelevanceWithLocation`,
  `DefaultSemanticConfiguration` — used by `AzureSearchQuery` (6 sites), the broadcast matcher AND
  `cosmosindexsetup`'s index definition. Never re-introduce the string literals.
- `SemanticScoreNormalizer` (clinqetcore\Utilities) is the ONE reranker÷4 implementation;
  `AzureSearchQuery.NormalizeSemanticScore` delegates to it.
- The functions host now defines `Search:GenericServiceWords` + `Search:StopWords` (D2) — the shared
  shaper shapes identically in both hosts, pinned by
  `SearchQueryTextProcessorTests.WordLists_DefinedAndIdentical_AcrossBothHosts`.

### The AI-match loader is a single unscripted state now
The customer web + mobile classify waiting UI (`AIMatchMapLoader`) lost its 3-step ×1.9 s scripted
narrative, fake provider-avatar pops and (web) radar sweep — map + search-area pulse + location label
+ ONE status line remain, identical rules on both platforms. `WorkerAvatar` is deleted; the step2/3
localization keys are removed from all 10 locale files. It is purely decorative and non-blocking.

## ‼️ SEARCH-PERFORMANCE PHASE 5 (2026-08-10) — evidence-gated decisions + the wax fix. Read before touching suggest relevance, semantic config, or MaxResultDepth

### ‼️‼️ Semantic search is OFF (owner decision, 2026-08-10)
- `Search:Semantic:Enabled=false` + `Search:Semantic:ServerDefaultEnabled=false` in BOTH hosts'
  appsettings (API + Functions), inline defaults mirrored (§0.12); `Search:Judge:UseSemanticSearch=false`
  (owner: the nightly judge must not burn the 1k/mo free semantic tier).
- Evidence: two-arm judge on the CA dev index (112 queries) — ON NDCG@10 .3223 / MRR .3176 /
  R@10 33.93% vs OFF .3312 / .3266 / 34.82% (zero lift, OFF within noise); Phase-3 probes were
  byte-identical semantic-off. ~190 ms median saved on eligible queries. Revert = flip the four
  values back; re-test at production scale via the same two-arm procedure.
- ‼️ `Search:Judge:UseSemanticSearch=false` ALONE is a NULL experiment: `request.UseSemanticSearch
  || _serverDefaultSemanticSearch` (AzureSearchQuery ~line 644) keeps semantic on while
  ServerDefaultEnabled is true. A true off-arm needs `Search__Semantic__ServerDefaultEnabled=false` too.
- ‼️ The broadcast MATCHER's semantic leg is UNTOUCHED — it is gated by `Matching:EnableSemanticSearch`
  (still true) and only shares the `Search:Semantic:*Bonus` VALUES. Never conflate the two gates.

### ‼️‼️ The wax bug — suggestion relevance now includes SUBCATEGORY (pre-existing defect, fixed)
- `IsRelevantSuggestion` (both suggester + vector legs) validated hits against
  serviceName/categoryName/businessName only. A query matching ONLY the subcategory ("wax" ⇒
  services named "Brazilian"/"Underarms" under "Waxing Services") dropped EVERY Azure hit C#-side.
- City-scoped suggest exposed it (the P2 prefix store is skipped when `city` is set); store-backed
  completions masked it for bare queries; search masked it via the expansion ladder.
- Fix: subcategory in all three arms (≤2-char prefix branch, combinedTarget, ngram). Pin:
  `AzureSearchQuerySuggestionRelevanceTests` — sabotage requires breaking BOTH the combinedTarget
  AND the ngram arm (the fix is redundant by design).
- Result-set note: `suggest ha` 9→16 items and `suggest phrase` gained a hit — deliberate,
  documented improvements (previously-dropped subcategory matches joining); everything else in the
  probe matrix stays byte-identical.

### Two-stage suggest (scope=Completions client opt-in — the P2 store fast path is now REACHABLE)
- Keystroke (250 ms debounce) → `scope=Completions` request → instant text completions (RAM prefix
  store, ≤5 ms server-side). A second 250 ms pause timer fires the FULL suggest whose topHits
  (service cards) join the same dropdown. Stage 2 never wipes a rendered list with an empty answer;
  a caller-supplied `scope` in suggestionContext keeps legacy single-request behavior.
- Web: `clinqetwebuserapp/components/common/SearchBox.jsx` (ONE shared component — home hero,
  header, search page, providers page, city landing, quote form, address modal all inherit).
  Mobile mirror: `clinqetmobileuserapp/src/screen/homeTab/searchScreen/index.tsx` (the single
  mobile fetchSuggestions call site).

### Deferred with evidence (owner decisions — do NOT re-open without the recorded trigger)
- **5A depth (500→150)**: deferred to production scale. Config-only pre-read at depth 150 was
  byte-identical AND latency-unchanged — the dev corpus (~98 max matching docs) never fills either
  window. Trigger: typical queries match >150 docs. Facet-shrink + deep-page caveats reviewed then.
- **5D capacity / 5E edge-cache / 5F Redis**: deferred — deployed dev warm suggest 70–90 ms,
  search 100–110 ms wire; no traffic justifies spend; Redis only at scale-out.
- **Cold search ~1.0–1.3 s accepted for now** (warm ≤250 ms met). Remaining cold owners:
  first-touch embedding + spell L0–L2 + Azure legs — NOT depth at dev scale.
- Known benign instability (append to the sparse(expand) note): `haircut` page2's rank-40 slot flips
  `e298a28b` ↔ `61188bba` across process restarts (Δscore 0.001, embedding float variance).
- Dev CA judge parquet: DISREGARD runId `3aa0ae59` (dead-host-degraded local run, Recall 3.57%);
  clean two-arm local runs are `4c38bba7` (semantic ON) / `f06bdefc` (OFF).

### ‼️‼️ P5-02 — `Search:Semantic:Enabled` is enforced in ExecuteSemanticSearchAsync, NOT only at the call site
The main path gates semantic behind `useSemantic` (AzureSearchQuery ~645), but the expansion
ladder's three legs (`RunRadiusSemanticAsync`, `RunCityStateSemanticAsync`,
`RunPriceRatingSemanticAsync`) call `ExecuteSemanticSearchAsync` DIRECTLY. Before Phase 5 that meant
a disabled semantic leg still billed reranker calls on every expansion-triggered query. The master
kill switch now lives at the TOP of `ExecuteSemanticSearchAsync` — never remove it, and never add a
fourth call site that assumes its caller checked the flag.
- Pin: `AzureSearchQueryExpansionTests.SemanticDisabled_ExpansionNeverIssuesASemanticQuery`
  (asserts the expansion path actually ran, so it cannot pass vacuously).
- ‼️ `MaxPhases_CapsTheLadder` expects **2** Azure calls with semantic disabled (main BM25 +
  phase-1 BM25). It previously expected 3 — it had encoded the defect.
- Semantic construction sites in the whole codebase (keep this list true): `AzureSearchQuery`
  (`Search:Semantic:Enabled`), `BroadcastMatchingService` (`Matching:EnableSemanticSearch` — TRUE by
  design, the matcher is NOT part of the search kill switch), `ProviderCatalogSearchService` /voice
  (`SemanticRerankEnabled` — false in both binding hosts). Suggest has no semantic leg.
- Cost of semantic-off measured on the probe corpus: position 20 of `search haircut city` and
  `search filtered` resolves to a different, EXACTLY BM25-tied `Waxing Services` row
  (798fd778 ↔ 6f55d547). Positions 1–19 unchanged; the 112-query judge scored OFF higher.

### ‼️‼️ P5-03 FIXED (Phase 6, owner-approved Option B) — the relevance gate now covers every CURATED suggester surface
`IsRelevantSuggestion` (BOTH legs) checks 7 of the suggester's 8 source fields: the 4 name fields
PLUS **`searchKeywords` + `synonyms` + `tags`** (flattened via `CollectCuratedKeywords`, checked in
all three arms). **`serviceDescription` is deliberately excluded** — vendor guidance (Azure
suggester docs: verbose fields are "too dense"), industry practice (Yelp terms/categories, Algolia
analytics-built suggestions, Elastic curated completion inputs), and a 16-term census showing
description added ZERO unique hits on the dev corpus. The single source of truth is
`clinqetcore\Utilities\SearchSuggesterFields.cs` — cosmosindexsetup builds the suggester FROM
`SourceFields`, and `SuggesterSourceFields_AreAllClassified` fails any new source field until it is
classified checked-or-excluded. Field-by-field pins: keywords-only / synonyms-only / tags-only
survive, description-only REJECTED (`AzureSearchQuerySuggestionRelevanceTests`, sabotage-proven).
Both suggest calls now `$select` `tags,searchKeywords,synonyms` (~+6 KB Azure→API per call; client
wire unchanged; zero extra Azure calls). Live proof: `threading`+city 0/0 → 7 completions/8
topHits; `skin`+city 3/2 → 8/8. Result-set footprint on the probe matrix: suggest-only —
`ha` swaps 8 rows within its cap (2-char keyword-prefix matches like "hands" services now compete
under Azure's own ranking; dial = exclude keyword surfaces from the ≤2-char arm only), `phrase`
swaps one vector-leg tail hit; ALL search/filters/providers probes byte-identical. The P2 prefix
store is unchanged (bare-query completions were already correct; city-scoped never uses it).
**Rule this teaches: whenever you touch a post-retrieval filter, diff its field list against the
retrieval layer's field list — and single-source the two lists so they cannot drift again.**

### Phase 6 (independent final audit, 2026-08-10) — key durable facts
- **Every regression pin now BITES, sabotage-proven** — three were repaired in Phase 6 because they
  could not fail: the P1-01 embedding-singleton pin asserted on the test fixture's own mock (the
  real pin now asserts the PRODUCTION `ServiceDescriptor` captured by `ClinqetApiFactory` before
  the swap), the single-flight detachment stub ignored its token, and the prefix-store weight
  fixture coincided with the length tiebreak.
- **BroadcastProcessorFunction fresh-claim conflicts now schedule a stale-window re-check copy
  BEFORE completing** — a plain Complete permanently orphaned a broadcast whose claim holder
  crashed (all SB redeliveries land inside the 30-min stale window). Pin:
  `ProcessBroadcast_ClaimRaceLost_SchedulesStaleRecheckThenCompletes`.
- **The classify embedding-only fallback is location-scoped** like Stages 1/2
  (`GetTopMatchesAsync(embedding, 1, pairIndex.Keys)`); `GetClosestCategoryAsync` +
  `CategoryMatchResult` were deleted (orphaned). Pin:
  `EmbeddingFallback_IsLocationScoped_PassesPairKeysAndMapsThePair`.
- **Two-stage suggest hardening (both apps):** a late stage-1 answer can never downgrade rendered
  stage-2 cards (`fullRendered` guard); mobile shows stage-1 the moment it has content (the spinner
  no longer gates a rendered list); submit/clear cancel every timer + in-flight request.
- §0.12 inline-default mirrors corrected (SuggestionFallbackMinScore 0.20, VectorHighConfidence
  0.55, SkipVectorThreshold 0.5, Suggestion Vector/SSV MinScore 0.2/0.45, judge DefaultCountry
  fallback "Canada"); `ComplexityIndicators` now in BOTH hosts; `Search__Judge__DefaultCountry` in
  deploy.ps1's required-settings gate. The judge corpus is **112** entries (the "121" figure in
  older docs was wrong).
- Full state at close: probe parity 13/14 vs after-phase5 (the 1 diff = the documented benign
  sparse(expand) tail flip); suites API 8,940u/1,739i · Functions 1,883u/434i · MCP 544u/65i ·
  web 895+lint-0 · mobile 790+tsc — all green, 0 skips; live E2E incl. decisive cascade classify
  (confidence 90, zero LLM) → quote → deployed matcher Active → cancel.
- Open (owner-decision) items live in `audits\PHASE-6-FINAL-AUDIT.md` §5: suggest-pipeline
  cancellation-deafness, facet single-flight/geo-key, prefix-store multi-category linkage,
  `InvalidateCache` wiring, mobile failure-state UI (mockup-gated), committed secrets rotation.

---

## ‼️ PHASE 4 — EMBEDDING/COMPLETION LANES, PACING AND SEARCH-INDEX RESILIENCE (2026-08-18)

One `text-embedding-3-large` deployment serves **eleven** consumers and one `gpt-5.4-mini` deployment serves
**fifteen** call sites, mixing live and bulk work on one budget. Phase 4 made that lane split explicit.

- **`AiWorkloadLane`** (`clinqetshared/Enums`) — `Interactive` (default) or `Bulk`, on `IEmbeddingService`
  and every `IAICompletionService` method. **Interactive never queues.** Bulk = knowledge ingest, the
  change-feed enrichment + embedding, category embeddings, the vector-recovery sweep, doc summaries, image
  captions. Live = customer search, `search_knowledge`, the voice catalog, broadcast matching, spell check.
- **`IAiBudgetGovernor` / `AiBudgetGovernor`** — a process-wide singleton that admits Bulk against Azure's
  OWN reported headroom (`x-ratelimit-*`), with a guard band, burst spacing, a concurrency cap and a
  learned debit ratio. Configured TPM survives only as a bootstrap. `retry-after-ms` marks the snapshot stale.
- **`AzureAIFoundryEmbeddingService`** owns the request-sizing rule for every caller: token-bounded
  sub-batching, per-input clamping, in-batch dedup, poison isolation, adaptive halving on a token-cap 400,
  and a bulk coalescing window that turns N single Bulk embeds into batched requests.
- **`EmbeddingResult` / `EmbeddingBatchResult` / `AiFailureKind`** (`clinqetcore/Models/Search`) — the legacy
  `float[]`/`[]`-sentinel methods still exist, but a caller that must tell a **throttle** from an **outage**
  reads the reason. `AiThrottledException` (`clinqetcore/Exceptions`) is its completion-side twin.
- **`ServiceIndexOutcome` / `ServiceIndexLegs`** — the indexer reports WHICH leg degraded, so the change feed
  can queue a retry and the aggregated admin alert can name a reason.
- **`AdminAlertSettings` now lives in `Clinqet.Shared.Models`** — the search indexer and the enrichment
  failure tracker are library code and could not reach the Functions host's copy, which is why they were
  cooldown-gated while everything else was appsettings-gated. One regime now. Every flag still defaults TRUE.

‼️ **`vectorFilterMode` is set explicitly to `preFilter`** on every filtered vector query. It was set nowhere,
so the platform ran on whatever default the index vintage happened to give it.

## Session 4 (2026-09-01/02) — B1 on luna and the temperature rule
- luna (`gpt-5.6-luna`) rejects any non-default `temperature` with HTTP 400 unsupported_value. `AIService:DefaultTemperatureOnlyDeployments` (API / FN / MCP appsettings, class default ["gpt-5.6-luna"]) makes `AICompletionService` omit the temperature for those deployments. B1 (`SearchIndexEnrichment`) is the only flow that pins temperature 0 under effort None; without this rule every luna enrichment silently degraded to "continuing without enrichment".
- Gate 1 A/B (mini vs luna on the 112-query SearchJudge corpus) and the resulting B1 decision: `C:\Nik\ai-cost-quality\SESSION4-HANDOVER.md` §3. The enrichment content hash includes the deployment name, so a model flip regenerates enrichment without a PromptVersion bump.
- **Gate 1 RESULT (2026-09-02 05:21 UTC, decided by session 4, confirmed by session 5):** luna FAILS the no-drop rule — Recall@10 72.32 % → 67.86 %, MRR 0.6127 → 0.6119, NDCG@10 0.6237 → 0.6178 (P@10 0.4295 → 0.4339 was the only gain; per query 25 better / 13 worse / 74 same, `gate1-results/gate1-diff-armA-armB.txt`). **B1 stays on mini**; nothing in §3.4 was applied. The nonprod CA search index still holds LUNA enrichment for the 821 services — the owner stopped the §3.5 restore ("dont do it"); the enrichment hash includes the deployment name, so the next real reindex or change-feed pass regenerates each document with mini. Luna is also ~4.5× slower per enrichment (~30 s vs 6.7 s, 1,000–1,400 completion tokens of which 60–240 reasoning).
- ‼️ **2026-09-26: B1 is back on mini.** The gpt-6 rename removed `AiModels.Mini` and moved enrichment onto `gpt-6-luna`
  without a measurement. Restored on the Gate 1 evidence: `AiModels.Mini` = `gpt-5.4-mini`,
  `SearchIndexEnrichment:DeploymentName` in both hosts and the ca/in files, and in deploy.ps1
  (`$openAiEnrichmentDeploymentName`, in `$modelDeployments` for the RAI filter, 4 app settings — they override
  appsettings). Priced in `AIService:TokenPricing` in all three hosts (class default included, so the mirror test
  holds). Pinned by `AiModelPinConventionTests` (API + Functions). The enrichment hash carries the deployment name, so
  the next pass re-enriches each service with mini.

## ‼️ THE KNOWLEDGE INDEX AT v2 (Phase 3, 2026-09-15) — and its OWN version key

‼️ Since Phase 5 (D-124) every kind has its own `Search:IndexVersions:{Kind}`; the two old keys are gone. **One shared version meant
bumping it for a knowledge schema change also rebuilt the services and providers indexes and forced a full
re-stream of both** — a cost with no cause.

| Change | Why |
|---|---|
| **`contentCjk`** + a custom analyzer (`standard` + `lowercase` + `asciifolding` + `cjk_width` + `cjk_bigram`) | Chinese and Japanese are written WITHOUT SPACES. MEASURED on the live index: `en.microsoft` returns the real menu line `剪发价格120元烫发380元` as ONE token and the question `烫发多少钱` as another — they can never match. With bigrams, `烫发` matches. It is a SECOND field because only `en.microsoft` stems English and folds accents, and a field carries exactly one analyzer |
| `contentVector` **not stored, hidden** | ~35–40 KB per card that no read path has ever selected (D-26, 2026-09-22 — the 2026-09-15 build still kept it stored; see below). The private index is exhaustive KNN with no compression, so nothing rescores against a stored copy. `stored` is IMMUTABLE, which is why it needs the new physical index |
| `updatedAt` filterable+sortable, `docType`/`chunkKind` facetable **dropped** | Measured unused. `chunkKind` KEEPS filterable (the overview companion narrows on it) and `scripts` KEEPS facetable (the alphabet set is one `$top=0` call) |

‼️ **`contentCjk` is populated ONLY when a card actually contains Han or Kana** — absent, and costing nothing,
for every other business on the platform. **Korean is deliberately excluded**: it separates its words and
`en.microsoft` tokenises it correctly (measured).

‼️ **THE SWITCH IS GONE (2026-09-15).** `Voice:Knowledge:CjkFieldEnabled` was the dark-deploy gate while the
field was being introduced; both regions' indexes now declare `contentCjk`, so the gate was DELETED rather
than flipped (§0.7.1 — no feature flags, no old paths). **The rule it leaves behind is permanent:** Azure
REJECTS an upsert naming a field the index does not declare — failing the whole document, not the field — and
SEARCHING one is a query-time 400 on EVERY search. So an index rebuild ALWAYS precedes the deploy that names
a new field, in every region, never the other way round.

‼️ **The rule deciding which alphabets need it is `TextScriptDetector.NeedsCjkTokenisation`**, in
`clinqetcore`, so the indexer that writes the field and anything that rebuilds the index share ONE
definition (the 2026-09-15 throwaway copier was deleted after its run). It is `Any(Han or Kana)`, never `All`: the live corpus's Chinese card is labelled `Latn,Hani`, and
an `All` reading would have skipped the only document the change exists to make searchable.
‼️ **Since 2026-09-25 (P4-E-24) the indexer ALSO writes it when the body holds ANY Han/Kana character**
(`NeedsCjkTokenisation(card.Scripts) || TextScriptDetector.ContainsCjkCharacters(card.Content)`): the label needs
four such characters, and `Perm 烫发 $120` has two.

### Rebuilding a knowledge index WITHOUT re-ingesting — the 2026-09-15 COPY recipe is OBSOLETE (D-26)

‼️ **Corrected 2026-09-25 (P4-I-01).** The knowledge index stores NO retrievable vector: search topology
D-26 (2026-09-22) made `contentVector` `IsHidden = true`, `IsStored = false`
(`cosmosindexsetup\KnowledgeSearchIndexInitializer.cs`, the `contentVector` field). An old physical index
therefore hands back NO vector, so the 2026-09-15 recipe — copy every card from the old index into the new
one — would write a vectorless index. **Never follow it again, and never set `IsStored = true` or
`IsHidden = false` on the vector to revive it.**

- The only non-AI copy of the vectors is the blob AI cache `{businessId}/ai-cache/knowledge/{docId}.bin`
  (`SearchAiCachePaths`), written by `KnowledgeSearchIndexer.UpsertCardsAsync` under the per-document write
  lock BEFORE the cards reach the index. ‼️ **Since Phase 5 (2026-10-02) the index swap reads it back** —
  `cosmosindexsetup --swap … --kind PrivateKnowledge` (see "SEARCH-TOPOLOGY PHASE 5" below).
- **A document whose cards cannot be proven is still refilled by `POST /api/v1/admin/search/reindex-knowledge/{businessId}`
  (or `/{businessId}/{docId}`)**, which sends each file back through ingest and RE-EMBEDS every card — per
  business by design, because the re-embed is the expensive leg.
- `hasEmbedding` is hidden too, and cannot be derived from an old index any more (the vector does not read
  back); `contentCjk` is still computed from the card's `scripts` via `TextScriptDetector.NeedsCjkTokenisation`.
- Lessons from the 2026-09-15 run that still hold for any bulk read of this index: page with a **KEYSET cursor
  on `id`** (`id gt '<last>'` + `orderby id asc`, `id` is sortable for exactly this), never `$skip` (capped at
  100,000, no one-page guarantee unordered); bound a write page by **BYTES, not a count** (16 MB request cap);
  move an alias only AFTER the new index is full; verify by re-counting from the service, polling to a bound.
- ‼️ **Set `IsHidden` / `IsStored` EXPLICITLY on any vector field.** Unset does not mean "the safe one", it
  means the SERVICE's default — measured live 2026-09-22, a vector field with neither set comes back
  `stored: true, retrievable: false`. The test that should have caught the 2026-09-15 version asserted
  `NotEqual(true, IsHidden)`, which **null satisfies**.

### Phase 4 closing audit (2026-09-25) — the knowledge index writer (`KnowledgeSearchIndexer`)

Authority `Data\knowledge-extraction-fix-plan\phase-4\FINAL-AUDIT.md`. Retrieval-side changes are in
`clinqet-business-search` §29 and `clinqet-voice-assistant` ("RECENT CHANGES — 2026-09-25").

- ‼️ **D-26 re-confirmed (P4-E-09):** `contentVector` is `IsHidden = true, IsStored = false`; never read a vector back.
  The vector source for any rebuild or copy is the blob AI cache (`{businessId}/ai-cache/knowledge/{docId}.bin`) —
  read by the Phase 5 index swap — or a re-embed via `reindex-knowledge`.
- `HasEmbedding` is set by the indexer after its full-vector check, never trusted from the writer — every hybrid leg
  filters on it (P4-E-19).
- The card hash in the AI-cache artefact covers `docTitle` + `sectionTitle` + `content`, the fields the vector was
  embedded from (P4-E-13). Artefacts written earlier carry body-only hashes; nothing compares them today, and a
  future copier would see a mismatch and re-embed — the safe direction.
- Prune and document delete take the SAME per-document lease as the upsert, linked to its `Lost` token (P4-E-12).
  A document whose last card went has its artefact DELETED, not written empty — a zero-vector artefact reads back
  as corrupt (P4-E-24).

## ‼️ THREE API-VERSION TRAPS ON THE SEARCH REST SURFACE (paid for 2026-09-15)
1. The **Analyze** API does NOT resolve an alias — it needs the PHYSICAL index name. `GET /aliases` gives it,
   and that endpoint needs api-version **2026-04-01**.
2. **docs/search** DOES resolve an alias, but only on the newer api-version; on `2024-07-01` it answers
   `404 index not found`, which reads exactly like a missing index.
3. The scoring profile is **`knowledgeRelevance`** — the C# constant's FIELD name is not its VALUE.

`Data\knowledge-extraction-fix-plan\tools\kprobe.py` replays the retrieval's exact hybrid query against the
live alias. It is a REPLAY: it proves the index and the ranking, never the gates, the trim or the note.

## Resource-limit and timeout admin alerts (2026-09-15)

All Azure Search clients now come from `AiSearchClientFactory`, and only `SearchTopology` calls it. Its `AiSearchResourceLimitPolicy` (PerCall since 2026-09-19, so it sees the outcome the caller sees rather than an attempt the SDK healed) observes HTTP 402/408/429/503/504, structured quota errors, semantic partial-result capacity/timeouts and indexing partial failures. SDK network timeouts report `AiSearchResourceLimit`; caller cancellation is excluded. It preserves original exceptions, responses and fallback behavior. Feature-owned cancellation deadlines remain the responsibility of the owning workflow; existing semantic-budget diagnostics remain intact.

The independent gate is `AdminAlertSettings:EnableAiSearchResourceLimitAlerts`. The shared publisher uses a 15-minute in-process cooldown per resource, irrespective of business. See the infrastructure skill's AI resource alerts section and `C:\Nik\Data\ai-resource-limit-alerts\AUDIT.md` for settings, limits and tests.

---

## ‼️ THE SEARCH TOPOLOGY ROUTER (search-topology Phase 1, 2026-09-21)

**No code outside `Clinqet.Infrastructure.Services.Search.Topology` may name a search endpoint or an index
alias.** Every read and every write resolves a route from `ISearchTopology` (`clinqetcore/Interfaces/Search/ISearchTopology.cs`):

| Call | Answers | Use it for |
|---|---|---|
| `ResolvePublic(CountryCode?)` | a `PublicRoute` of `PublicIndexPair` (services + providers client, country code, `Launching`/`Live`); typed since Phase 3 (B-17) | marketplace search, SEO, banners, the broadcast matcher, the service/provider indexers |
| `ResolvePrivate(businessId)` | a `PrivateRoute` (`CatalogClient`, `KnowledgeClient`, both NULLABLE) | the phone receptionist, Ask Clinket, the knowledge indexer |
| `EnumeratePlane(SearchPlane)` | every index of that plane | global scans: health checks, the audit function, the suggestion prefix scan, the spell-dictionary refresh |
| `EnumerateForBusiness(businessId)` | every index a business can be in, both planes | teardown / cascade delete |

- `route.Single` THROWS when a route carries more or fewer than one pair — a single-query reader handed a
  fan-out must fail, never silently read the first index. A global scan enumerates instead.
- `PublicRoute` and `PrivateRoute` are **distinct types on purpose**: Phase 0 measured the two planes needing
  OPPOSITE vector algorithms (tenant filter ⇒ exhaustive 2.8× faster; country filter ⇒ HNSW 2.1× faster), so a
  misroute is a 2× regression the compiler now prevents.
- **A nullable private client means the stamp has AI Search unprovisioned** — `deploy.ps1` writes the endpoint
  as an EMPTY STRING there. Readers degrade to their Cosmos leg; the host still boots.
- `AiSearchClientFactory` is the ONLY place a `SearchClient` is constructed and the router is its only caller.
  Both facts are pinned by `SearchTopologyConventionTests` in **each host's own** unit suite (§0.15/§0.17), with
  its own exemption registry and a zero-hit guard so an unresolved root fails loudly instead of reporting green.
- Settings: `Search:Topology:Services:{Public,Private}:{Endpoint,ApiKey}`,
  `Search:Topology:Public:Countries:<ISO2>:{ServiceAlias,ProviderAlias,Status}`,
  `Search:Topology:Private:Cells:<cellId>:{CatalogAlias,KnowledgeAlias}`, `Search:Topology:Private:OpenCells`.
  ‼️ **The base appsettings of every host ships NO countries and a BLANK endpoint**: the .NET binder MERGES a
  dictionary rather than replacing it, so a non-empty base would widen whatever the per-stamp file sets.
- `AddSearchTopology(configuration, requiresPublicPlane)` binds, `ValidateOnStart`s and registers the router,
  its alarm, the alias-not-found policy and a `SearchTopologyPlaneScope`. MCP passes **false** (private plane
  only). Validation refuses to boot on: an empty country list, an unparseable ISO key, a blank alias, one alias
  for both grains, a duplicate alias across countries, no private cell, an `OpenCells` entry naming no cell, a
  `CrossBorderPairs` entry naming an unserved country or itself.
- ‼️ **`Search:Topology:Public:Countries` means "the countries that have their OWN index pair on this stamp"**,
  not "the countries this stamp serves" — the permanent definition that makes the duplicate-alias guard
  unambiguous in every phase (PLAN §5.4.1, E73).
- A configured alias that does NOT exist answers 404 forever and every reader treats empty as legitimately
  empty. `SearchAliasNotFoundPolicy` (PerCall, so it sees the outcome the caller sees) raises one Critical
  `AdminAlertType.SearchTopologyMisconfigured` at first use, **excluding `GetDocumentAsync`'s 404**, which is
  the normal answer for a document not indexed yet.
- The unconfigured-plane alarm fires only for a plane this host READS and that has something to serve — MCP's
  permanently-blank public endpoint is the design, and alerting on it would be a Critical on every healthy boot.
- Clients are cached per **(endpoint, API key, alias)** for the process lifetime, built through a
  `Lazy<SearchClient>` in `ExecutionAndPublication` mode. The key includes the API key because two planes may
  share a host and hold different keys.
- **Tests**: `TestSearchTopology` (one copy per test project; a hand-built `ISearchTopology`, deliberately not
  a Moq double) gives a service the route it needs in one line. The slot a test is NOT exercising gets a
  `NotUnderTest()` client pointing at an unresolvable host, so a misroute FAILS instead of quietly passing.

### ‼️ PHASE 2 — THE PRIVATE PLANE IS ITS OWN INDEX NOW (2026-09-22)

The private catalogue and the private knowledge index are **no longer the public indexes under another name**.
`cosmosindexsetup` creates one pair per cell — `private-catalog-<cell><env>` / `private-knowledge-<cell><env>` —
and `deploy.ps1`'s `Add-SearchTopologySettings` points every host at them from one `$privateSearchCells` list.
‼️ The cell comes BEFORE the environment in the name; suffixing the grain first produced `private-catalog-dev-cell1`,
which no host's alias-shape guard recognises.

**Which cell a business lives on** is `BusinessProfile.searchCell`, written once at profile creation by
`ISearchCellAllocator` (SHA-256 of the business id over the OPEN cells — never `GetHashCode`, which is randomised
per process). `ISearchCellDirectory` is the only thing that reads it: a singleton, `IMemoryCache` (`Size = 1`),
single-flight per business, 15 min for a found cell / 30 s unassigned / 10 s unavailable.
‼️ **A failed lookup is `Unavailable`, NEVER `NotAssigned`** — a Cosmos blip read as "no cell" would fail every
tenant closed for a whole cache window and the repair would be the wrong one. A cell this stamp does not
configure is **refused, never substituted**: answering from another cell reads and writes another tenant's shelf.
Callers that already hold the profile call `Remember(businessId, cell)`, so the write path costs no extra read.

**The two planes hold DIFFERENT populations (D-35).** The private catalogue holds **every service that still
exists** — pending and inactive included, each carrying `approvalStatus` and `isActive` — so "not sellable" is a
FILTER (`isActive eq true and approvalStatus eq 'Approved'`), never a missing row. The public index keeps
membership-by-ABSENCE. `ServiceIndexGates.BelongsInPrivateCatalog(isDeleted)` and `IsIndexable(...)` are the two
rules, and only a DELETED service leaves the private plane.

- **One document class, two materialisations.** `ServiceSearchDocumentProjector.ForPrivateCatalog` /
  `ForPublicServiceRows`. ‼️ Azure rejects the WHOLE batch with 400 when a document carries a field the index does
  not declare, so every field a plane does not declare must be nullable AND `JsonIgnore(WhenWritingNull)` —
  pinned by `SearchPlaneConventionTests`.
- **The receptionist's second lock (D-36)**: every returned row is checked against the scope the filter
  promised, on the lookup leg AND the expert-check candidate leg. One bad row discards the whole set and alarms.
- **`find_services` and `answer_catalog_question` state the same facts as the embedded profile** —
  `VoiceServiceCardFields` declares the model-visible keys and names every deliberate divergence; the parity
  test lives in `Clinqet.Communications.UnitTests`. ‼️ `CatalogLookupItem.Price` is `[JsonIgnore]`d: the
  structured amounts are the SCREEN's shape, and a model given `fixedPrice: 80` beside `chargePerVisit: 40`
  states 120. The ear gets `priceText` + `extraChargesText`, composed by `CatalogPriceNarrator`.
- **Ask Clinket's `search_services` runs ONE leg** (D-6). The paired Cosmos `CONTAINS` leg is gone with
  `CatalogLookupQuery.UnapprovedOnly` — the index now holds the drafts that leg existed for.

**The AI cache (D-21/D-29/D-60)** lives in the EXISTING `provider-knowledge` container under
`{businessId}/ai-cache/…`, so it adds no Azure resource and the business-closure prefix purge already sweeps it.
`ISearchAiCacheStore` holds the enrichment text, the vector and the content hashes; a rebuild that hits it makes
**zero model calls**. Invariants: the artifact is durable BEFORE any index write (I1); a write lock is a blob
LEASE, **per business** for services and **per document** for knowledge (D-60), with a `Lost` token that cancels
a rebuild whose lease expired. ‼️ The lease registry is keyed by **blob name**, and the store looks the lease up
itself — the knowledge lane leases the very blob it then writes, so a caller-supplied key would 412 every ingest.
A 404 is a MISS; a transport failure THROWS. The miss rate alerts on a **tumbling window**, never a lifetime
total, or a long-lived host could never notice a purged container.

**The nightly audit is a ROTATION SWEEP (D-51).** The old index↔index scan is deleted: it never read Cosmos, so
it could not see "Cosmos has a service the index never received", and above 5,000 providers it skipped its own
check while reporting all-clear. Now: `SELECT TOP (batch) FROM Business WHERE Id > @cursor ORDER BY Id`
(a clustered-PK seek), one single-partition Cosmos read + one per-business query per plane + the artifact check,
with `batch = ceil(total / SearchAudit:TargetCoverageDays)` capped by `MaxBusinessesPerRun`. The cursor is ONE
`SearchAuditWatermark` in `SystemData` (id `search_audit_watermark`, pk `system`), advanced only after a batch
fully succeeds. ‼️ **When the ceiling binds an admin alert states the REAL coverage period** — it must never go
quiet, which is exactly how the old one failed. Closed and Suspended businesses are expected to hold ZERO
documents in both planes, so the sweep is also a standing check that closures completed.

**Admin health** (`GET /admin/search/health`) now enumerates BOTH planes and each row carries its `plane`: a
stamp whose private cells are unreachable answers no phone calls at all while the marketplace looks fine.

### ‼️ 2026-09-22 — THERE IS NO SECOND CATALOGUE STORE, AND THE PRIVATE PLANE IS EXHAUSTIVE EVERYWHERE

**The Cosmos fall-through on every catalogue search path is DELETED** (owner, amending D-33). It matched raw
substrings on `name` and `description` alone: measured live, *"skid steers"* found **0 offerings where the index
found 43** — and it then handed the model a `None` result whose note says *"Tell the caller warmly that you
cannot find that one."* A broken search became the business denying its own stock, and nobody could see it,
because a partial answer reads exactly like a complete one.

- **What a caller hears now**: *"I can't check right now — let me take a message."* `VoiceCatalogSource.Cosmos`
  is renamed **`Unavailable`**; `LookupAsync` ends `result ??= Unavailable()`; `RetrieveCandidatesAsync`
  returns `[]`, which `ProviderCatalogAnswerService` already maps to the same thing.
- **‼️ AND AN ADMIN ALERT IS MANDATORY** (owner: *"that is a must"*). `ICatalogAlarm.RaiseCatalogueUnreachable`
  is implemented in all three hosts. It is **silent when `IndexAvailable` is false** — an unprovisioned stamp
  is configuration, not an outage, and alerting there would Critical on every healthy boot.
- **Deleted with it**: `IServiceRepository.SearchPublicCatalogAsync`, `CatalogRepositoryQuery`,
  `CatalogRepositoryPage`, `BuildCatalogPredicate`, `BuildPriceClause`, and the `Voice:Catalog:CosmosFallbackMaxScan`
  setting from all three hosts. `LoadNearestGroupsAsync` is an index **facet** now — the last Cosmos read on a
  search path, at 30–41 RU a call.
- **The only repository call left** on that path is `GetGlobalCategoriesAsync`, which is CACHED and is a
  SECURITY control: the model's group name is resolved to an id we own, so model text never reaches a filter.

**‼️ BOTH private indexes are `exhaustiveKnn`, uncompressed — the knowledge one was not, for a whole phase.**
`KnowledgeSearchIndexInitializer` takes no plane parameter (every knowledge index is a private-cell index), so
it silently built the PUBLIC plane's HNSW + `bq-mrl`. Exhaustive KNN **cannot rescore**, and rescoring against
the full-precision originals is the whole mechanism that makes binary quantisation safe — without it recall@10
fell to 68 % here. The private plane's vector configuration now lives in ONE place,
**`cosmosindexsetup\PrivateVectorSearch.cs`**, which both initializers read.

**‼️ A cell alias is a PRIVATE alias.** All three hosts had shipped
`Cells.cell1.CatalogAlias = "clinket-dev"` — the customer-facing index. `PrivateCellAliasConventionTests`
(one copy per host) now fails on that. `deploy.ps1` was always right: `private-catalog-$cell$EnvSuffix`.

**D-2 GATE 2 IS CLOSED — PASS** (`Data\search-topology\findings\PHASE-2-QUALITY-PARITY.md`). 1,335 cards from
87 real documents, two indexes differing only in the vector configuration: recall IDENTICAL, MRR within 0.5 %,
sign test **p = 1.000**, and the private arm uses ZERO vector-index quota. The gate was proven able to FAIL.

**Two traps this phase paid for, which will be laid again:**

1. **A counter on a SCOPED service cannot say "on this host".** `_consecutiveCatalogueUnreachable` was an
   instance field, so a stamp-wide outage reported *"1 in a row"* five hundred times. Static now.
2. **A name in a guard's registry is not evidence.** `IndexCoverageMinRatio` named a reader that IS compiled
   into the API host — but its only caller is registered ONLY in Functions, so the API tuned a value nothing
   read, for months, with a written reason for the divergence.

## ‼️ PHASE 3 — THE PUBLIC PLANE PER COUNTRY, ROUTED BY THE SEARCHED PLACE (search-topology, 2026-09-22/24)

Authority: `Data\search-topology\PLAN.md` (D-1…D-78) and `findings\PHASE-3-DESIGN-DECISIONS.md`; build log
`findings\PHASE-3-BUILD-STATE-2026-09-23.md`.

### Routing — the searched PLACE decides the country, never the visitor's header (D-3 / D-7 / D-74)

- `ISearchTopology.ResolvePublic(CountryCode?)` is **TYPED** (B-17): a full-name router handed the ISO code the
  apps send fell back to the stamp's first pair, so every US quote matched ZERO providers. Every caller converts
  through `CountryCodeHelper.ParseStrictOrNull`. Served ⇒ its own pair; `null` ⇒ EVERY pair, degraded (the D-7
  fan-out); a listed country without a pair here ⇒ the first pair, degraded.
- **`ISearchPlaceResolver` is the ONE place rule for every surface** (`SearchPlaceResolver`): the request's own
  coordinates (reverse geocode) → a typed place (forward geocode, the visitor's country only as a BIAS) → the
  visitor header. `SearchPlaceLookup.CacheOnly` on `/suggest`: the keystroke path never waits on Google — a warm
  cell answers, a cold one falls back WITHOUT `LookupFailed`. Never an invented country: ocean, failure or a
  malformed ISO answer ⇒ the visitor's country, flagged.
- `SearchPlace` → `ResolvedPlaceDto` (`countryCode`, `countryName`, `formattedPlace`, `city`, `source`,
  `coverage` = `Listed | OutsideOurCountries | Unknown`, `ambiguous`, `lookupFailed`,
  `differsFromVisitorCountry`; a position only for a TYPED place). Clients DISPLAY it and never store it.
- **Outside our countries (§6e)**: `/services`, `/providers`, `/filters`, `/suggest`, the rails and categories
  answer HONESTLY EMPTY with the place named, and query no index. `/services` and `/providers` still record the
  search in analytics (demand from an unserved country), with its true invocation mode; `/suggest` does not,
  exactly like its too-short-text path.
- **Saved address (D-7)**: browse and recommendations (Case A/B) route by the saved address's country
  (`SearchController.WithSavedAddress`, `LocationSource.CustomerAddress`). ‼️ OPEN owner question (build state
  §4c-15): text search, `/providers`, `/filters` and `/suggest` never consult it, and the outside-country check
  runs before it — do not "fix" either without the owner's answer.
- **Fan-out (D-7)**: each pair runs under its own country clause AND `NotServedByAnyOf(earlier pairs)`, so the
  windows are disjoint and a two-country business is not counted twice. `PublicFanOutMerger` merges **BY RANK,
  NEVER BY SCORE** (M10 — BM25 scores from two indexes are not on one scale); a service held by several pairs is
  one result at its best position — `PublicFanOutMerger.ResultKey` = `BusinessId|ServiceId`, never a row id (which
  differs per area and per country); counts add, durations are the slowest pair, the search is described by the
  pair that supplied the top result; facets are summed, count-sorted fields cap at the longest list, fixed-bucket
  fields keep range order read from the LONGEST list. Analytics carries `PublicFanOut = true`.
  ‼️ 2026-09-29 (LIVE-PROOF L2b): when `PublicFanOutMerger.OrdersOnOneScale(request)` — Distance with a usable point,
  Rating, ReviewCount, Newest — `MergeSearch` re-orders EACH block (local, then widened) by the customer's key
  (`ApplySorting`); price and relevance stay rank-merged (a price is in each country's own currency, R-17). The provider
  list uses the same predicate (`ProviderSearchService.MergeWindows`; its old `IsKeyedSort` is deleted), but re-sorts
  the WHOLE merged list (one per business, `ExplicitSortComparer`) — no local/widened blocks there — and, for the same
  sorts, re-sorts again after a widening carry-over (R-15).
- **B-19 — the border leaked through an UNCORRELATED filter.** The country test now travels INSIDE the place
  clause in all three builders and the suggestion filter:
  `(addressCountry eq 'canada' and geo.distance(location, P) le r) or serviceAreas/any(sa: sa/country eq 'canada' and sa/center ne null and geo.distance(sa/center, P) le r)`.
  Country fields are lowercase-normalised in the index, so filters use the LOWERCASE canonical name
  (`SearchFilterExpressionBuilder.CanonicalCountryValue`).
- **D-45 / D-63 — widening**: a thin browse and a thin provider list widen ONCE by
  `Search:RadiusExpansionMultiplier`. ‼️ The wider circle is a superset in the INDEX, not in a capped,
  relevance-ranked FETCH — a nearby row the wider fetch ranked out is CARRIED OVER (the text path's rule #3), and
  the provider carry-over stays inside `MaxResultDepth` so it can be paged to. Browse items carry `BusinessId`.

### Server-side geocoding (D-77 / D-78) — the only way the apps learn a place's name

- **`GET /api/search/place`** (`latitude`+`longitude` or `query`), rate limited by
  `Search:RateLimiting:Place:RequestsPerMinute` (30). 400 `Error_PlaceLookupInvalid` for a half pair, (0,0),
  out-of-range or **NaN** (the range is written as an INCLUSION — NaN fails every comparison, so `< -90 or > 90`
  let it through), or a blank / over-length query. A position wins over a query.
- `GoogleGeocodingService.ReverseGeocodeAsync` sends the **~110 m CELL** (`GeocodeCell`,
  `Geocoding:ReverseCellDecimals` = 3; the antimeridian is one line; −0 never splits a cell), never the precise
  fix; the cell IS the cache key. `GeocodingSingleFlight` (singleton): N cold callers of one key pay ONE call,
  each caller stops waiting on its own token, and the answer is cached INSIDE the shared call (`Size = 1`) —
  successes only, a failure is usually transient.
- **B-3**: Google reports its walls with HTTP 200 and a status in the BODY — `OVER_QUERY_LIMIT` /
  `OVER_DAILY_LIMIT` / `REQUEST_DENIED` / `UNKNOWN_ERROR` raise `IntegrationResource.Geocoding` (RateLimited /
  QuotaExhausted / Unauthorized / Unavailable); `ZERO_RESULTS` / `INVALID_REQUEST` are answers about the input and
  never alarm. The geocoder reports its OWN timeout (the client observer reads a cancelled token as "the caller
  left").
- **Forward ambiguity** keys on country | state | city (Springfield IL and MO share a country and a city).
  ‼️ **A listed ISO code in FREE TEXT is sent as its English name** — "Springfield, CA" is California — for every
  forward caller (service areas, location resolution, the broadcast matcher).
- A malformed ISO country in an answer is DROPPED: no country is better than a guessed one.

### Strict country (D1 / F4)

`CountryCodeHelper.TryParseStrict` / `ParseStrictOrNull`: an ISO-2 code or the canonical English name
(case-insensitive) — nothing else ("USA", "Canadá", "ભારત" are refused). Service areas and business addresses
answer 400 `Error_CountryInvalid`, and store AND geocode the English name. The indexers file through
`PublicCountryFiling`: `CanonicalName` THROWS for an unlistable stored country (fail loud, retried until fixed);
`Served` = address country ∪ every area country ∩ this stamp (E48); `NamesAnyCountry` separates "mid-onboarding"
(silent) from "serves only countries this stamp lacks" (alert).

### Offers (D12 / D-55 / B-12)

- Every read path guards through `OfferWindow.IsActiveNow` (marketplace card, provider card, banner, recently
  viewed, voice catalogue, both indexers).
- `OfferExpirySweepFunction` (`OfferExpirySweep:TimerSchedule` per stamp in `deploy.ps1`) finds documents still
  holding an offer past its end on EVERY country's services and providers index
  (`activeOffers/any(o: o/validUntil lt now)` / `topOfferEndsAt lt now`), each round excluding businesses already
  found, rebuilds both grains (`RebuildConcurrency`), and alerts `AdminAlertType.OfferExpirySweepIncomplete` on a
  bound ceiling or a failed rebuild. `Offer.MaxRedemptions` is counted nowhere (D39, Phase 4).
- Offer DELETE is **SOFT** (`isDeleted` + `ttl` from `CosmosDb:OfferDeleteTtlDays`; ProviderData has TTL on), so
  the change feed fires and search rebuilds the business without it; every read hides it; a second DELETE is 404.
- ‼️ **B-11 / M1 (Phase 3C, 2026-09-25) — an offer's dates are whole DAYS in the BUSINESS's time zone.**
  `OfferWindow.StartsAt/EndsAt(date, zone)` run from local midnight of the first day to the local midnight that ends
  the last (exclusive; a zone with no 00:00 that day starts at its first real minute); `OfferWindow.IsLive(offer, now,
  zone)` is the checkout rule. The zone is `BookingTimeHelper.ResolveTimeZone(profile, settings)`. Read UTC, "valid
  1–30 September" ended the evening before in Canada/US.
- `IOfferRepository.GetCurrentOfferCandidatesAsync` (replaced `GetActiveOffersAsync`) returns a partition-scoped
  SUPERSET (two days of slack either side of the UTC day); the CALLER decides live-ness in the zone — nothing else may.
  Readers: `OfferValidationService`, `BookingTools`, `FullProviderContextService`, `OfferController`,
  `CategoryController`, both indexers (`ValidFrom/ValidUntil`, `TopOfferEndsAt`) and the offer-boundary scheduler in
  `SearchIndexSyncFunction` (one `GetByBusinessIdsAsync` ReadMany per batch). Documents written before this keep
  UTC-read windows until their next rebuild.

### Prices (D-68) — the minimum IS the price

`SeoLandingResultsService.ResolvePrice` and `ProviderSearchIndexer.ResolveFromPrice`: a fixed or starting price is
raised to `MinimumCharge`; a floor with no headline is the price; a zero headline is no headline; a floor is never
compared against an hourly RATE (the landing shows the rate; a provider "From" price leaves hourly services out).
Both customer apps' price formatter apply the same rule.

### Health (D-8), analytics, and the rest

- A **Launching** country is empty by design: `SearchIndexHealthCheck`, the admin health view,
  `EnsureIndexIsPopulatedAsync` and the SEO catalog never read its emptiness as index loss — an UNREACHABLE
  launching index still fails.
- Analytics v2 (append-only): `ResolvedRoutingCountry` (the country that ANSWERED — empty when every country did
  or none did) and `PublicFanOut`.
- The suggestion prefix store is partitioned per country.
- The provider document has its OWN lease, `{biz}/ai-cache/provider-document.lock` — a catalogue rebuild holds
  `business.json` for minutes (owner ratification pending, build state §4).
- Vector recovery gives each services index its own share of the run, and each re-ask EXCLUDES what the run
  already examined (`not search.in(id, …)`) — a page of permanent failures used to come back first and starve the
  backlog behind it.
- `BusinessProfile.firstPublishedAt` (D-64) is WRITE-ONCE by a Cosmos patch condition — proven on the emulator.

### Tests (placement follows the runtime consumer, §0.18)

API unit: `GoogleGeocodingReverseAndPlaceTests`, `GeocodeCellTests`, `SearchPlaceResolverTests`,
`SearchControllerAdditionalTests` (place endpoint, outside country, saved address, analytics routing),
`AzureSearchQueryBrowseWideningTests`, `ProviderSearchWideningTests`, `PublicFanOutMergerTests`,
`SearchIndexHealthCheckTests`, `AzureSearchQuerySuggestionFilterTests`, `SeoLandingResultsServiceTests`.
Functions unit: `OfferExpirySweepFunctionTests`, `PublicCountryFilingTests`, `ProviderSearchIndexerTests`
(D-68 "From"), `SearchTopologyDefectFixTests` (recovery starvation). Integration: `FirstPublishedAtWriteOnceIntegrationTests`
(Functions), `OfferControllerTests` soft delete, `BroadcastControllerTests` B-18, service-area and business-address
strict country (API).


## Admin monitoring: observed health versus content count (2026-09-24)

Owner approved the policy and desktop/mobile mockup in Data/admin-search-health/PLAN.md. For GET /admin/search/health, an empty index alone is not an outage, even when its country is Live. Return a visible content notice and the next investigation step. Failed index checks remain Unhealthy with unknown counts, safe reason codes and affected scope. Enabled dictionary readiness/overdue freshness affects Degraded; disabled correction does not. The snapshot freshness window includes the normal refresh interval, refresh timeout and failure grace.

The typed SearchHealthReport lives in the API, with structured findings and server-owned aggregation. The admin renders those findings and treats monitoring failures as Unknown, preserving explicitly historical results. Counts do not prove expected membership, enrichment or relevance; business-scoped visibility/knowledge diagnostics and existing indexing alerts remain necessary. The separate infrastructure /health watermark check remains a configured minimum-content check, not this admin availability report. No Cosmos scan, persisted field, new resource or automated repair is introduced.

## ‼️ PHASE 3 AUDIT FIXES — the location rules (search-topology, 2026-09-24)

Owner-approved 2026-09-24 (the four location recommendations); register: `Data\search-topology\PLAN.md` §0.4 and §12 DD-15 … DD-18.

- **A searched POINT is searched by distance, never by a city's name.** The apps send `latitude`/`longitude` (and
  `radius`/`unit` only when the customer chose one); `city` travels ONLY for a city the customer explicitly chose
  as a filter. `ResolvedPlaceDto.indexCity` is DELETED and `/api/search/place` names a point once, in the reader's
  language.
- **The point's own city is CONTEXT, never a filter**: `SearchRequestDto.PlaceCity` — `[JsonIgnore]` + `[BindNever]`
  and ALWAYS overwritten by the server — plus `ResolveContextCity()` (the chosen city filter, else `PlaceCity`). Every
  badge/boost/contextual-area site reads `ResolveContextCity()`: `AzureSearchQuery.ComposeBoost`,
  `ProviderSearchService.ApplyBoostAndReorder`, `RecommendationSearchService` (text + index provider paths),
  `SearchController.BuildSearchResponseAsync` and the landing recommendations. It is copied by `SearchRequestCopy`
  (the reflection test enforces it) and is part of the result-cache key.
- **Naming the point**: `SearchController.ResolveSearchedPlaceAsync` names it in the INDEX language (the default
  language) beside the reader's-language place resolution — one wait, free when the reader reads the index language.
  The rails (`DiscoveryController.RailCityAsync`) name it from the cache only (`NameCityAsync(..., SearchPlaceLookup.CacheOnly)`)
  and warm a cold cell within the client's cold-lookup budget.
- **No place of its own ⇒ the saved address (P3-O2, D-7/E1)**: `FromSavedAddressWhenPlacelessAsync` on /services,
  /providers and /filters, decided BEFORE the outside-our-countries check and in the ADDRESS's country (a customer
  abroad searches home). A point is never replaced; a typed place that could not be found keeps saying so. Suggest
  stays on the visitor's country (keystroke path).
- **No location chip**: `SearchPlace.CountryName` is set for a visitor-country route (localized `Country_Name_{ISO}`)
  so the chip says "Showing providers across {country}"; "Anywhere in {country}" is removed from both apps.
- **"Which …?"**: `ResolvedPlaceDto.choices` (`PlaceChoiceDto` place · countryCode · countryName · lat · lng) only for an
  AMBIGUOUS TYPED place with more than one choice; the searched place first; city-sized results only, one each;
  capped by `Geocoding:MaxPlaceChoices` (5, validated 2–10); a home-country re-ask keeps the place the name first meant.

## ‼️ PHASE 3C CLOSE-OUT — fan-out survival, price band, place cells, indexer isolation (search-topology, 2026-09-25)

Record: `Data\search-topology\findings\PHASE-3C-CLOSEOUT.md` (progress log, IDs below). No schema change. Offers (B-11)
are in the Offers subsection above.

- **S1 / R-16 — ONE fan-out survival rule: `PublicFanOutSurvival.AnswerAsync(pairs, ask, logger, what)`.** A country
  whose index throws is logged and left out, the others answer in pair order; only EVERY pair failing throws; an
  `OperationCanceledException` always propagates. Callers: `AzureSearchQuery` (search, suggest),
  `AzureSearchFacetService`, `ProviderSearchService` (list, prices, facets), `HomepageBannerService`,
  `SeoLandingResultsService`. A new public fan-out calls it — never its own `Task.WhenAll`.
- **S2 / R-11 — `PublicFanOutMerger.FoundBeyondThePlace`**: a pair answering `SearchMatchQuality.Expanded`, or whose
  `ExpansionInfo` is `RadiusExpanded` / `LocationFilterRemoved` / `CityStateFilterRemoved`, is NOT local. Local pairs are
  fused first, widened ones after, and the message comes from the pair that leads.
- **M11 / P3-O5 — `ServicePriceBandFilter.Build(min, max)` is the ONE budget filter** for the marketplace
  (`SearchFilterExpressionBuilder`) and the receptionist's catalogue (`ProviderCatalogSearchService`). A service matches
  by the figure its card leads with: fixed/range raised to `minimumCharge`, an hourly rate never raised, a ceiling-only
  range at its `maxPrice`, a minimum-only service open above; a stored 0 is in no budget. No new index field
  (`minimumCharge` is already filterable). `ServicePriceBandFilterTests` evaluates the OData against each price shape.
- **L8 — the hero banner and the landing hub take the searched POINT.** `PlaceCell.For(lat, lng, countryIso, settings)`
  rounds to `DiscoverySettings.PointCellDecimals` (`Discovery:PointCellDecimals` = 2, ≈ 1.1 km) at the country's own
  default radius, and the SAME cell keys the cache and queries the index (`BannerScope.Cell`; `GET
  public/discovery/banner` and `public/discovery/landing` take `lat`/`lng`, landing also `country`). The city is only a
  label: no slug matching, no top-8 limit. A point in an unserved country is honestly empty; a degraded country answers
  an empty hub, never another country's.
- **S4 / Q-12 — `ICountryResolutionService.ResolveManyAsync`**: cache first, ONE `GetByBusinessIdsAsync` ReadMany of the
  cold profiles, the country lookup read at most once per call. `EntitlementService.ResolveManyAsync` uses it.
- **S5–S7 / W-15b/c/d — one country's index never takes the others down:**
  - (b) a business rebuild counts a country whose index cannot be READ as unswept (the rebuild replays), still sweeps
    the other countries, and fails only AFTER the business's own documents are written.
  - (c) `SearchIndexerSharedResources.PolicyFor(indexName)` — retry + circuit breaker PER INDEX, alert
    `IndexerCircuitBreakerOpen` keyed and titled by the index. Both `AzureSearchIndexer` and `ProviderSearchIndexer`
    call it per target. ‼️ Moq answers the virtual `SearchClient.IndexName` with null — every indexer test double must
    name its index.
  - (d) a deleted service is removed from every country that answers; the failure still throws so the message retries.
  - An index answering 404 (a launching country not yet created) holds nothing — never a failed rebuild.
- **S8 / W-6 — the audit checks PUBLIC staleness too**: `SearchIndexAuditFunction` asks each country's public services
  index for copies older than Cosmos (the `updatedAtTicks ge` batch, only for services that country should hold) — the
  marketplace is where a lost update is sold.
- **S9 / W-4 — drift is confirmed under the business write lock**: apparent drift is re-read inside
  `AcquireBusinessWriteLockAsync`; a lock another writer holds, or one lost mid-check, means that writer is converging
  it — nothing reported, nothing queued, checked next cycle. A clean business takes no lock. `change-feed-failures` does
  not deduplicate; the repair is idempotent.
- **S10 — a replay that meets a held lease is PUT BACK**, not abandoned: `ChangeFeedFailureReplayFunction` catches
  `SearchAiCacheUnavailableException`, schedules the message again (exponential, jittered, `LeaseBusyReschedules` + 1)
  and completes the original — no delivery spent, never dead-lettered for contention. Past
  `CosmosDb:ChangeFeed:LeaseBusyMaxReschedules` it takes the ordinary retry ladder; a put-back that cannot be sent
  abandons the original. Detail in `clinqet-function-app`.

## SEARCH-TOPOLOGY PHASE 4 — backend corrections (2026-09-27)

- **P4-51 — the spelling suggester leg filters by membership.** `QueryUnderstandingService.TrySuggesterCorrectionAsync`
  now sends `SearchFilterExpressionBuilder.ServiceIndexMembershipFilter` (isActive, isListed,
  participatesInMarketplace, businessStatus 'Active'), like every other customer read, so a hidden business's words
  are never proposed as a spelling. Test: `QueryUnderstandingServiceTests.ProcessQueryAsync_SuggesterSpellingLeg_CarriesTheMembershipFilter`.
- **Result and facet cache freshness (P4-49).** The index-generation counter is process-local and only the process
  that WRITES bumps it. Ordinary catalogue writes happen in the Functions host, so the API's result cache
  (`Search:ResultCache:ExpirationMinutes` 10) and facet cache (`Search:Facets:CacheTtlSeconds` 1800) expire by TTL
  alone — a change can take that long to show on those surfaces. Only an admin reindex run through the API bumps it
  there. Comments in `SearchResultCacheService` / `ISearchResultCacheService` now say so.
- **Change-feed failure semantics (P4-107), immediate provider projection (P4-108), inert host.json keys (P4-42/43):**
  `clinqet-function-app`, "HOST.JSON CONFIGURATION" and "COSMOS CHANGE FEED PATTERN".
- **Provider score prior (P4-106):** "PROVIDER QUALITY SCORES" above.

## ‼️‼️ ONE ROW PER SERVICE AREA — the public fan-out (search-topology Phase 4, 2026-09-29)

Authority: `Data\search-topology\FAN-OUT-FINAL-DESIGN.md`; live proof `findings\LIVE-PROOF-2026-09-29.md`. Azure ranks by
distance from ONE point per document, and averaging a business's areas into one point let a second area LOWER its rank
in the first (LIVE-PROOF L4). So each PUBLIC index now holds one row per (service, service area) and one row per
(business, service area), each scored from its own area's centre. The PRIVATE catalogue is unchanged: one row per service.

### Keys and rows
| | Private catalogue | Public services | Public providers |
|---|---|---|---|
| Key | `SearchRowKeys.Service` = `{b}_{s}` | `SearchRowKeys.ServiceRow` = `{b}_{s}_{areaId}` | `SearchRowKeys.ProviderRow` = `{b}_{areaId}` |
| No centred area here / at-premises only | — | ONE row `{b}_{s}_noarea` at `addressLocation` | ONE row `{b}_noarea` at the address |
| Built by | `ServiceSearchDocumentProjector.ForPrivateCatalog` (computes the key, never inherits it) | `ForPublicServiceRows(doc, countryName, defaultAreaId)` | `ProviderSearchDocument.ForRow(id, geoPoint, isPrimaryArea)` over `PublicCountryFiling.ProviderRowAreas` |

- `SearchRowKeys.NoAreaSuffix` = `noarea`. Public keys have three parts, private two, so one can never be written as the other.
- Rows of one service are **identical except `id`, the point (`location` / `geoPoint`) and `isPrimaryArea`**: the whole
  `serviceAreas` list and this country's city/state lists stay on every row, so every filter answers alike on every row.
- **`isPrimaryArea`** — exactly one row per service (per business on the provider index) in each country index:
  `SearchRowKeys.PrimaryAreaId` = the business's default area (`ServiceAreaOrder.DefaultAreaId`, `ServiceArea.IsDefault`)
  when it has a row there, else the lowest area id (ordinal). `ServiceAreaOrder.MainFirst` (default, oldest, id) is the
  one listing order for both indexers.
- Provider rows exist only for areas with a centre that one of the country's publishable services serves (every centred
  area when none is publishable yet); `PublicCountryFiling.ProviderServesAtCustomersLocation` false ⇒ the one address row.
  The indexer and the audit both call `ProviderRowAreas`.
- **New / changed index fields** (additive, LIVE-PROOF §3): services `isPrimaryArea` (filterable, public only),
  `acceptanceScore` (retrievable only), `fromPrice` (filterable + sortable, public only: `ServiceBookingPrice.LeadOf(pricing)`
  when > 0, else null), `id` sortable (the private plane strips `IsSortable` from its live key), `addressLocation`
  filterable + sortable. Providers: `id` is the key (no normaliser), `businessId` a filterable/sortable field,
  `isPrimaryArea`, `acceptanceScore`, `addressLocation` filterable.
- **Deleted**: `ServiceAreaScoringPoint`, `ServiceAreaDistance` (the C# distance correction in `ApplyOrderingBoosts` /
  `ApplyBoostAndReorder`), `ServiceAreaDistanceSettings` (API + Functions keys `Search:DistanceScoringKm`,
  `IndexDistanceBoost`, `BaseTaperStrength`, `MinCorrection`, `MaxCorrection`), `PublicIndexPair.DistanceGradientKm`.
  `Search:DistanceScoringKm` now lives only in `cosmosindexsetup`, which builds the gradients.

### Reading — `SearchRowScope` (`OnePerService` default, `EveryServiceArea`)
- `SearchFilterExpressionBuilder.OneRowPerService` = `isPrimaryArea eq true`; `ServiceIndexOneRowFilter` = membership + it;
  `For(input, exclude, SearchRowScope)` / `ForOneRowPerService` (`Build` is now `internal` — a caller must say which rows
  it reads; an every-row read passes `SearchRowScope.EveryServiceArea` to `For`). Provider twin:
  `ProviderSearchFilterBuilder.For` / `ForOneRowPerBusiness`.
- The index-setup synonym generator (`cosmosindexsetup/CategorySynonymGenerator.cs`) reads one row per service too: its
  service-name scan and its `categoryName` facet both filter `isPrimaryArea eq true`, so a many-area service does not
  outweigh a business with many services.
- ‼️ **Only a query scored from the customer's location reads every row, and it keeps each service's BEST row before
  anything ranks, counts or pages.** Those are: the typed-search BM25 leg with a point, the browse relevance order with a
  point, the browse Distance sort for services with no address, the provider list's relevance order with a point, and the
  leads keyword leg with a valid location. The vector and semantic legs always read one row (the rows share one
  embedding). Every other read — counts, facets, scans, suggest, spelling suggester, `CatalogDictionaryService`,
  `SuggestionPrefixStore`, SEO catalog + landing, banner, offer sweep, audit drift counts, visibility diagnostic, embedding
  recovery — reads the primary row.
- **`FanOutWindow.CollectAsync`** (`clinqetinfrastructure/Services/Search/`): pages in score order with a total order
  (`search.score() desc, id asc`, ≤ `AzureSearchLimits.MaxDocumentsPerResponse` a page; the first page asks for the
  target, later pages for the shortfall × the rows-per-result rate read so far), keeps the first row per key, stops at the
  distinct target or `max(target, MaxRowsPerQuery)` rows. The window is read ONCE and the caller slices it — deduplicating
  page by page repeated and dropped results (measured 10, 7, 4 cards). `Result.DistinctSeen` = every distinct key read,
  the EXACT total when `Exhausted` (the target can fill part-way through the last page, so `Distinct.Count` under-counts);
  not exhausted ⇒ a size-0 count over primary rows. Fusion keeps each service's first (best-ranked) entry (`TryAdd`).
- ‼️ **One `SessionId` per window** (a fresh GUID, set on every page of an every-row read) so every page is scored by the
  same replica and no row repeats or drops between pages: services BM25 located leg, browse `ReadEveryAreaAsync`, the
  provider list window, lead matching (located).
- **`FanOutWindow.ObserveAsync`** never throws: logs when rows > results; row ceiling hit ⇒
  `IPlatformLimitAlerts.ReportCapacityPressureAsync("SearchFanOutRowCeiling", …)`; one business's EXTRA area rows over
  `CrowdingAlertShare` of a window of ≥ `CrowdingMinWindowRows` ⇒ `ReportContentLimitAsync("SearchWindowCrowded", …)` —
  the signal for the declined per-business area cap.
- **`Search:FanOut`** (`FanOutWindowSettings`, API + Functions, class defaults mirror): `MaxRowsPerQuery` 2000,
  `CrowdingAlertShare` 0.10, `CrowdingMinWindowRows` 50. Bound by `AzureSearchQuery`, `ProviderSearchService`,
  `BroadcastMatchingService`.
- ‼️ **Never compose a public row key to find a service.** `IAzureSearchQuery.LookUpServicesAsync` takes `ServiceRef`
  (`BusinessId`, `ServiceId` — a service id alone is 8 hex and not unique across businesses), filters by the pairs +
  `OneRowPerService`, and dedups across countries by `SearchRowKeys.Service`. `RecentlyViewedHydrationService` builds the
  refs. Provider lookups (`ProviderSearchService.LookUpAsync`): `search.in(businessId)` + one row, `Size` = ids × 2
  (capped at `MaxDocumentsPerResponse`) because a moved primary row and its successor can both be held for a moment;
  rows are grouped by business (its own country's row, else the first).
- ‼️ **Provider one-row reads dedupe by business** (`DistinctBy(BusinessId)` on the explicit-sort / no-location read) for
  the same reason.
- **`CardDistancePoint.For(address, areas, lat, lng)`** is the one card-distance anchor for the provider list
  (`ResolveDistanceKm`) and the recently-viewed rail (both service and provider rows): the address, else the area centre
  nearest the customer — never whichever row answered. The service list computes the same rule in
  `CalculateLocationMetrics`.
- Scan orders end on the row key: `ServiceIndexScanOrder` = `id asc`; banner and SEO landing `businessRatingSortScore desc,
  id asc`, merged across countries by `SearchRowKeys.Service`.

### Writing
- `AzureSearchIndexer` builds ONE document per service (one enrichment, one embedding — the blob AI-cache artifact is keyed
  by `serviceId`) and projects its rows per country as shallow copies. ‼️ **Embedding CALLS do not multiply; index
  STORAGE does** — every row carries the 3072-float vector (LIVE-PROOF §5). Filing is keyed by `serviceId`.
- Under the lease, each write reads the business's (or service's) public rows ONCE (`ListPublicRowsAsync` →
  `ListRowsAsync` → `SearchKeysetScan.ReadAllAsync`, keyset on `id` public / `serviceId` private, 404 ⇒ empty,
  unreadable ⇒ unswept + replay), removes rows of services withdrawn from a
  country or no longer existing (`RemoveFromUnfiledCountriesAsync`), uploads, THEN deletes the stale rows of services it
  wrote (`RemoveStaleRowsAsync`: a removed area, a lost centre, the `noarea` row when a first area arrives) — so a service
  never blinks out, and one whose write failed keeps its old rows. A deleted service's rows are found by filter
  (`RemoveServiceFromEveryPublicIndexAsync`). `RemovePrivateOrphansAsync` now sweeps only the private catalogue.
- **`SearchUploadBatches.Split`** bounds each upload by count AND bytes (Azure refuses > 16 MB), for BOTH indexers. The
  budget is read once in `SearchIndexerSharedResources`: `UploadMaxDocuments` (`SearchIndexEnrichment:UploadMaxDocuments`
  1000, clamped 1–`AzureSearchLimits.MaxDocumentsPerIndexingBatch`) and `UploadMaxBytes` (12,000,000, min 1).
  `SearchIndexEnrichment:ServiceBatchSize` 100 (also the AI-cache read window) is read by `AzureSearchIndexer` itself.
  All three keys in both hosts' appsettings.
- **`AzureSearchLimits`** (`clinqetshared/Constants/`) holds the service's own limits — `MaxDocumentsPerResponse` (1000),
  `MaxDocumentsPerIndexingBatch` (1000, one upload/delete request), `MaxSkip` (100,000). Never a private `1000` copy.
- `ProviderSearchIndexer.ReplaceRowsAsync`: upload in `SearchUploadBatches` (a business's rows each carry its whole area
  list, so bytes bind first), then list the business's rows (`SearchKeysetScan`, keyset on `id`) and delete what was not
  written, in `MaxDocumentsPerIndexingBatch` chunks; removal lists and deletes by `id` (no longer
  `Delete("businessId", …)`).
- **`SearchKeysetScan.ReadAllAsync(client, filter, keyField, select, keyOf)`** — the one keyset lister for both indexers:
  `keyField gt '<last>'` + `keyField asc`, full `MaxDocumentsPerResponse` pages, stops on a short page or a key that did
  not move, 404 ⇒ empty.
- `SearchIndexAuditFunction`: every row by its OWN keyset loop (`ReadAllAsync`, `AuditPageSize` 1000 — not
  `SearchKeysetScan`; the 100,000 `$skip` ceiling is gone); a service holding the wrong row set
  (a missing area row, a stale one, two primaries) or a provider likewise is DRIFT; freshness = any row NOT
  `updatedAtTicks ge` Cosmos. `OfferExpirySweepFunction` repeats rounds excluding businesses already found.
- `ProviderVisibilityDiagnosticService`: `Count` = services (primary rows), `RowCount` = rows; up to
  `MaxDocumentsPerResponse` rows listed with
  `id` + `isPrimaryArea`; the provider entry reports the primary row and its `RowCount`.

### Rule 1 + Rule 2 scoring (`cosmosindexsetup/Program.cs`)
- `…WithLocation` profiles only: Rule 1 `distance(location | geoPoint, 4.25, userLocation)` and Rule 2
  `distance(addressLocation, SearchIndexInitializer.BaseDistanceBoost = 1.40, userLocationBase)`, both over the country's
  D-62 gradient. Declaring an area buys Rule 1 only, so six declared areas score like one on Rule 2. ‼️ Never on a default
  profile: ~30 callers name no profile and send no parameter, and a required one would 400 them all.
- `SearchScoringProfiles.ScoreFromCustomer(options, profile, lat, lng)` is the ONE way a query scores from a location
  (profile + every `RequiredParameters(profile)`, invariant culture). `CustomerLocationParameter` = `userLocation`,
  `CustomerLocationForBaseParameter` = `userLocationBase`.
- ‼️ `ScoringParameterContract.Assert` refuses the index before it is sent when a parameter name is not
  `^[A-Za-z][A-Za-z0-9]{0,15}$` (Azure refused `userLocationToBase`, 18, live), two functions share a parameter, the built
  set differs from `RequiredParameters`, or the default profile requires one.
- Guards (`ScoringProfileGuardTests`): `BeingBasedNearby_IsWorthLessThanARealQualityGap` (1.40 < 2.40),
  `TheTwoDistanceFunctions_LiveOnlyOnTheLocationProfile`, `EveryDistanceFunction_ScoresAFilterableField`,
  `EveryScoringParameterName_IsOneToSixteenLettersAndDigits`, `ThePublicKeysAreSortable_ThePrivateKeyIsUnchanged`.

### Sorts
- **Browse (`ExecuteDiscoveryQueryAsync`, `IndexOrderFor`) — explicit sorts are chosen AT THE INDEX over every match:**
  Distance with a point = the W8 served-area key (three reads — see "Post-ranking follow-ups" below); Price = `fromPrice ne null`
  by `fromPrice`, then the price-less after; Rating = `serviceRatingSortScore`, `serviceReviewCount`, `businessReviewCount`;
  Newest = `createdAt`; Review count IS ordered at the index since W9 (`listingReviewCount`, below). The result is then re-sorted in memory by the same key, deduped by
  business|service, trimmed to depth. Each query carries ONE `geo.distance` in `$orderby` (Azure 400s a second).
- **Typed search** sorts its relevance set in memory (`ApplySorting`). Price sorts read `fromPrice`, price-less last both
  ways (`GetMinPrice` / `GetMaxPrice` deleted).
- **Provider list**: Distance = the W8 served-area key (below); price sorts still filter `fromPrice ne null`.
- Displayed distance = the address, else the nearest area centre (`CalculateLocationMetrics` for services,
  `CardDistancePoint.For` for the provider list and the recently-viewed rail) — never a row's scoring point. Selected
  fields now include `addressLocation`, `serviceAreas`, `acceptanceScore`, `fromPrice`.
- **Landing search**: the recommendation block leads only when no sort is chosen and no category/subcategory filter
  (`SearchController`: `anchorsRecommendations = !hasFilters && !request.HasExplicitSort()`; `HasExplicitSort()` =
  `SortBy != Relevance`). Unknown-country fan-out: `PublicFanOutMerger.OrdersOnOneScale` (see Phase 3 "Fan-out").

### ‼️ SCORE PENALTY (§13.1)
`ProviderBoostComposer.Compose` = reward × `max(clamp(PenaltyCombinedFloor, 0, 1), Π dial.MultiplierFor(score))`. Each
`ScorePenaltySettings` dial: ×1.0 at or above `NeutralScore`, a straight line down to `Floor` at `FloorScore`; `Floor` 1.0
retires it. Only a MEASURED score is judged (null ⇒ ×1.0); NOT halved on a typed search; `MaxCompositeFactor` caps the
reward only. `ComposeForBroadcast` carries it too.

| `Search:Boost:` | NeutralScore | FloorScore | Floor |
|---|---|---|---|
| `ResponsePenalty` | 40 | 10 | 0.80 |
| `ReliabilityPenalty` | 70 | 25 | 0.55 |
| `AcceptancePenalty` | 65 | 20 | 0.75 |

`PenaltyCombinedFloor` 0.50. Class defaults = appsettings in both hosts (`SearchBoostSettingsAgreeAcrossHostsTests`). The
indexed scores are `EffectiveProviderScores.For(profile, now)` — a live admin override replaces the computed value.

### Known behaviour O1 / O2 — both resolved since (W7, W8; see "Post-ranking follow-ups")
- **O1 — per-shard BM25 statistics.** Azure's default term statistics are per shard, and the new keys place rows of one
  business on different shards, so the same words can score two of its rows differently (3 of 18 typed queries changed
  order within one business, LIVE-PROOF L3). **Adopted by W7**: typed public queries set `ScoringStatistics.Global`.
- **O2** — a comes-to-you business showed, and Distance-sorted by, its ADDRESS even when one of its areas is centred on the
  customer. **Fixed by W8** (served area + the Distance key).

### Tests
API unit: `FanOutWindowTests`, `AzureSearchQueryBrowseSortTests`, `PublicFanOutMergerTests`,
`SearchBoostSettingsAgreeAcrossHostsTests`, `ProviderBoostComposerTests`, `SearchOrderByIsSortableConventionTests`,
`SearchSelectFieldsConventionTests`, `SearchPlaneConventionTests`. Functions unit: `PublicServiceRowsTests`,
`SearchUploadBatchesTests`, `ReviewRecencyTests`, `ServiceAreaOrderTests`, `AzureSearchIndexerRemovalFirstTests`
(stale-row sweeps, many-area deletes, closures past one page), `ProviderSearchIndexerTests`, `SearchIndexAuditFunctionTests`
(row-set drift), `BroadcastMatchingServiceTests` (keyword leg every row, vector leg one row), `OfferExpirySweepFunctionTests`.
Index setup: `ScoringProfileGuardTests`.

## Post-ranking follow-ups (audit 2026-10-01) — W7 · W8 · W9 · W14

### W7 — whole-index word scoring (O1)
- `ScoringStatistics = ScoringStatistics.Global` on typed public queries: `AzureSearchQuery` (`Options()` — every
  expansion phase — and the semantic leg) and `BroadcastMatchingService` (keyword leg + its semantic leg). Private plane
  (Ask Clinket, receptionist) untouched. Live: IN "car service" 2 distinct orders in 8 runs → 1; no measurable latency cost.

### W8 — "Serves {area} · Based in {city}" and the Distance key (O2; `Data/post-ranking-followups/DESIGN-SERVES-AREA.md`)
- ONE rule: `clinqetcore/Utilities/ServedAreaRule.cs` (`Resolve`, `BasedIn`, `AsShown`, `SortKilometres`). Comes to the
  customer = not at-business-only (`ServicePlace.IsAtBusinessOnly`) / provider `ServesAtCustomersLocation != false`.
  Candidates = the listing's centred areas in the index's country. Inside = within a radius (several ⇒ nearest centre);
  outside = nearest centre + its distance. No usable customer point ⇒ none.
- Response fields only, nothing stored: `servedArea` (`ServedAreaDto` `{name, distanceKm — null when inside, inside}`) +
  `basedInCity` on `ServiceSearchResultDto`, `RecommendedProviderSearchResultDto`, `RecentlyViewedItemDto`
  (`servedArea` also on `HybridSearchItemDto`). `distanceKm` (the address distance) is UNCHANGED — analytics read it.
- **Distance key**: served here ⇒ 0 (ties: trusted rating first); outside ⇒ km to the nearest candidate centre; no served
  area ⇒ the old `DistanceKm`. Typed search and every in-memory re-sort read it in `ApplySorting`; providers in
  `ExplicitSortComparer`.
- **Services browse** (`BrowseIndexOrder.Distance`): three CONCURRENT reads — served here
  (`ServedHereFilter.ServiceComesToTheCustomer` + `ServedHereFilter.For(...)`: banded containment over `serviceAreas/any(...)`,
  exact in-memory `keep`, ordered `serviceRatingSortScore desc, listingReviewCount desc, search.score() desc, id asc`),
  nearest (`location ne null` by `geo.distance(location, P)`), no point (`location eq null`). Total = nearest + no point.
- **Providers** (`ProviderSearchService`): served here, nearest (`geoPoint ne null`), no point (`geoPoint eq null`) and —
  ascending only, when the nearest window was cut — a declared-area gap read (`ServedHereFilter.AreaCentreWithin`).
  ‼️ Descending skips the gap read (audit C-4): a declared area can only add a key below every held row.
- **`FanOutWindow.CollectAsync(..., readWhole: true)`** (audit C-3): reads target + 1, so a window cut at
  `Search:FanOut:MaxRowsPerQuery` is told from one that fits — on the no-point and declared-area legs.
- `Search:ServedArea:*` (`ServedAreaSettings`, API; class = appsettings): `ContainmentBucketStartKm` 1.0,
  `ContainmentBucketRatio` 2.0, `ContainmentBucketMaxKm` 1610.0, `IndexDistanceTolerance` 0.01. Growth 2 measured best.
- ‼️ **Accepted (audit C-5, DESIGN-SERVES-AREA §6):** the served-here read picks ≤ `Search:MaxResultDepth` (500) by rating,
  `listingReviewCount`, raw score; the list orders rating ties by the BOOSTED score. Only bites when > 500 listings tie on
  rating at one point. Never "fix" it by ordering the list by raw score — that drops the provider boost from every tie.
- Result caches key the point at 3 decimals, the recommendation cache at 2: "inside" is decided for the first point in
  that cell, as `distanceKm` already is. UI: `clinqet-user-app`, `clinqet-customer-mobile`.

### W9 — `listingReviewCount` ("Most reviewed" at the index, O3)
- `ServiceSearchDocument.ListingReviewCount`: `Edm.Int32`, `[SimpleField(IsSortable = true, IsHidden = true)]`,
  `WhenWritingNull`; public services indexes only (not in `ServiceSearchIndexFields.PrivateCatalog`). Written by
  `AzureSearchIndexer` as `RatingValue.ServiceOrBusiness(...).ReviewCount` — the count the card shows.
- `BrowseIndexOrder.ReviewCount`: `listingReviewCount {dir}, serviceRatingSortScore {dir}, search.score() desc, id asc`.
  Never a scoring input (`ScoringProfileGuardTests.NoProfile_RanksByThePlainAverage_OrByVolume`).
- ‼️ Deploy `cosmosindexsetup` (additive `CreateOrUpdateIndex`) BEFORE Functions and the API: until the field exists, an
  indexer upload carrying it and a "Most reviewed" browse are Azure 400s. No backfill — reindex every business.

### W14 — the ranking factor, explained
- `ProviderBoostComposer.Explain(signals, context, settings, badges, scoring)` → `Breakdown` (each reward part, `Points`,
  `Reward`, the three penalties, `Penalty`, `Factor`); `Compose` = `Explain(...).Factor` (null signals ⇒ neutral) — ONE
  formula for ranking and the admin screen, summed in the same order, so the factor is identical to the last bit.
- Consumer: `AdminProviderScoresService` — `GET /api/v1/admin/providers/{businessId}/scores` (`ranking` browse + typed,
  `legend` from live `Search:Boost` + `ProviderScoring`) and `POST …/scores/preview` (saves nothing; 503 when the search
  row cannot be read, and `ranking` is then null). Screen: `clinqet-admin-app`.

<!-- search-topology-phase5 -->
## ‼️ SEARCH-TOPOLOGY PHASE 5 (2026-10-02/03) — swap an index, readable ranking numbers, per-kind versions

Authority: `Data/search-topology/findings/PHASE-5-DESIGN-DECISIONS.md` (D-110…D-122) + `PHASE-5-BUILD-STATE.md`
(D-123…D-129). Operator steps: `cosmosindexsetup/RUNBOOK.md`.

### Rebuild-and-swap (D-112) — `cosmosindexsetup --swap <step> --kind <Kind>`
- Steps: `plan` (dry run: budget, fields copied/added/dropped, rows WITHOUT a proven vector) · `build` (empty new version
  from the CURRENT definition, alias untouched) · `fill` (copy, safe to re-run) · `verify` · `switch` · `undo` ·
  `retire --index <old>`. One swap = every alias of that kind on the stamp. Code: `cosmosindexsetup/IndexSwap/`.
- ‼️ **Vectors come ONLY from the blob AI cache, each PROVEN** — never read from an index, never guessed:
  - services / catalogue: `AzureSearchIndexer.EmbeddingInputHash(row's serviceName, categoryName, subcategoryName,
    serviceDescription, artifact.EnrichmentEmbeddingText, the six enrichment lists)` must equal the artifact's
    `EmbeddingContentHash`, plus model + dimensions. ‼️ Once enrichment text exists the raw description is NOT embedded
    — so it is not part of the proof (same rule as the indexer).
  - knowledge: the card id must be in the artifact and `KnowledgeSearchIndexer.HashEmbeddedText(docTitle, sectionTitle,
    content)` must equal that card's entry (paired BY ID, never by position); `hasEmbedding` = true and `contentCjk`
    derived (TextScriptDetector) on write. One unprovable card stops its WHOLE document (re-read:
    `POST /api/v1/admin/search/reindex-knowledge/{b}/{doc}`); unprovable service rows queue a `BusinessReindex`.
- Copies raw JSON (`JsonObject`) of every field both versions declare; refuses a field hidden on the old version, a
  type change, a key change, a missing embedding input. MERGE (vector kept) only when the target row already carries a
  vector for the same embedding inputs; otherwise UPLOAD with the proven vector. ‼️ **Not a swap:** a key change or an
  embedding model/dimension change (the copy reuses the old vectors).
- Paging: keyset on `id`; the private catalogue's key is not sortable ⇒ `serviceId`, which is 8 hex chars and repeats
  across businesses ⇒ ties at a page edge are read whole with `eq` (refuses at 1,000 ties rather than page unsafely).
- Switch: copy + verify (bounded rounds) → ETag-guarded alias move → settle → catch-up. Services/providers/catalogue:
  the normal zero-AI `BusinessReindex` / `ProviderDocument` replay for every business in EITHER index (never a
  cross-partition profile scan). Knowledge: 3-way per card against a baseline saved at the switch
  (`provider-knowledge/_search-swaps/{alias}.base.json`): the live index wins when it changed after the move.
  A run after the move RESUMES the catch-up; undo and switch refuse each other's unfinished move, and a new switch is
  refused while the previous old version is unretired. Retire refuses: alias serves it, it is the configured version,
  no recorded move away from it, that move's catch-up not completed, inside `Search:Swap:RetireHoldHours` (24); a 404 on
  delete counts as done. A stop raises `SearchIndexSwapStopped`, gated by `Search:Swap:AdminAlertsEnabled` (the shared
  `AdminAlertSettings` is untouched).
- Rehearsed live on INDIA dev 2026-10-03 (T7, D-129): 13/13 rows + 2,797/2,797 cards, zero AI, 8/8 searches identical.

### D-123 — the seven ranking numbers are READABLE
`serviceRatingBoostScore`, `businessLiveSince`, `listingReviewCount`, `updatedAtTicks`, `hasEmbedding` (services) and
`businessRatingBoostScore`, `businessLiveSince` (providers) lost `IsHidden` (flipped in place, no rebuild, no extra
storage — measured) so a swap can copy them. Each carries `[SwapCopyOnly]`; host guards
`SwapCopyOnlyFieldsNeverReachACallerTests` (API + MCP) prove by reflection that no caller-facing type carries one or a raw
search row. Knowledge `hasEmbedding` stays hidden (derived by the swap).

### D-124 + P5-01 — one version per kind; the ordinary run never moves a live alias
`Search:IndexVersions:{PublicServices, PublicProviders, PrivateCatalog, PrivateKnowledge}` (v1,v1,v1,v2) replaced
`IndexVersion`/`KnowledgeIndexVersion`; a region that swapped keeps its versions in `appsettings.{ca|in}.versions.json`,
loaded after the region file and never regenerated by `deploy.ps1` (India: services v2, knowledge v3).
The ordinary run checks EVERY alias before writing anything and refuses a move; `SearchAliasInitializer` can create or
confirm an alias, never move one (`LiveAliasNeverMovesTests`). The index list is built once (`SearchIndexSpecs`).

### Audit own-cell (D-110 / D-125)
`SearchIndexAuditFunction` compares an Active business against its OWN cell only; a copy in another cell is reported,
and deleted under the business write lock only when the own cell is verified complete.
