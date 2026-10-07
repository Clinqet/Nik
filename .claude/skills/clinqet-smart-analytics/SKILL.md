# clinqet-smart-analytics — Provider Smart Analytics ("Insights") · Payments Phase 7

> **CORE FEATURE SKILL** — the provider-facing **Insights** surface (Premium): a nightly-precomputed,
> entitlement-gated, privacy-suppressed analytics dashboard (web + provider mobile, identical content). The FINAL
> phase of the payments chain (P0→P7); extended 2026-07-03 by analytics-recs **Phase B2** (lead-competition
> metrics + residual math verification). Distinct from `clinqet-analytics` (the raw collection pipeline this
> CONSUMES read-only) and `clinqet-search-discovery` (the search index this QUERIES for the price/rating benchmark).

## What it is

A provider opens **Insights** and sees how their business performs near them: Profile Views, Lead Win-Rate,
Booking Conversion, a **Price Benchmark** (per service × area, Option-A area tabs), a **Rating Benchmark**,
Inquiries + Response Rate, Top-Searched-Near-You, Leads-Posted-Near-You, **Lead Competition** (median competitors
per opened lead as a range bucket), **Response Speed** ("you respond faster than ~X% of competing providers",
10%-step buckets), **Bid Rate**, **Search Visibility** + **Profile Views → Inquiries** (Premium, 2026-07-03); plus Lead Funnel, **Time to Bid** (own median Opened→Bid hours + trend,
lower=better), Peak Times, Voice-Call Analytics, Unmet Demand, Avg Response Time, Suggested Price and 8-week
trends (formerly Max-only; Premium since the two-plan change, 2026-10-04). All cross-provider numbers are **ranges only, suppressed below a privacy floor, geo-rounded** — a
provider sees only their own position, never competitor identities or exact per-lead counts.

## The two non-negotiable rules it was built around

- **No cross-partition Cosmos.** The price/rating benchmark comes from the **Azure AI Search index** (real list
  prices + facetable ratings, filterable by `subcategoryId` + `geo.distance`), NEVER a cross-provider Cosmos scan
  (`ProviderData` is partitioned `/businessId`). Every Cosmos op in this feature is a point-read or pk-keyed upsert.
- **Build nightly, never query on read.** A timer `UsageAggregatorFunction` starts the queued W12 run that precomputes per-provider rollup docs +
  shared benchmark docs into the **EXISTING `SystemData`** container. The request path = entitlement gate (cached) →
  `IMemoryCache (~300s)` → ~1 RU point-read → shape per tier. The request path NEVER touches search/Parquet.

## Architecture (mirrors the Recommendation Engine)

```
NIGHTLY  UsageAggregatorFunction (TimerTrigger %UsageAggregator:TimerSchedule%, Enabled guard, blob lease _insights.lock)
  → IInsightsRollupCoordinator.StartAsync → queue insights-day-rollup → InsightsRollupFunction (W12, see "Post-ranking follow-ups")
      DaySummary  per (lane, day): raw Parquet → one summary blob per kind under insights-daily/day={yyyy-MM-dd}/
      Compute     waits for every summary; demand cells + lead statistics ONCE per run; one Group message per provider group
      Group       SmartAnalyticsAggregationService.RollupGroupAsync: Pass A (each ACTIVE provider's single-partition data);
                  shared (subcat,geoCell) bands via Azure AI Search → collapse-per-provider → suppress<5 → round → upsert bench_/ratingbench_ (pk=subcategoryId);
                  KPIs + per-(service×area) bands + demand + funnel/peak/voice/trend → upsert analytics_rollup_{providerId} (pk=providerId)
      Finish      watermark insights_watermark (pk=system) advanced only when every group finished with no failure
  ‼️ the ranking scores are NOT written here (W11: ProviderScoreRefreshService — see PROVIDER RANKING SCORES)

REQUEST  GET /api/v1/analytics/insights  (AnalyticsController, [Authorize])
  → flag Payments:SmartAnalyticsEnabled (403 + UI hidden when off, dark-launch)
  → ISearchRateLimitService.TryAcquire (429)
  → IEntitlementService.ResolveAsync → HasFeature("analytics_advanced") ? InsightsTier.Premium : InsightsTier.Free (boolean feature since catalog v12)
  → Cache-Control: private, max-age=300
  → ISmartAnalyticsReadService.GetInsightsAsync(businessId, tier) → point-read rollup (cached) → shape per tier
```

## Files (verified)

**Backend (new):**
- `clinqetfuncations/Clinqet.Communications/Functions/UsageAggregatorFunction.cs` (+ `UsageAggregatorSettings`) — timer + blob lease + LeaseRenewalLoop + FailureNotificationHelper, mirrors PaymentReconciliation/AnalyticsCompaction.
- `clinqetinfrastructure/Services/Analytics/SmartAnalyticsAggregationService.cs` — the read→compute→suppress→upsert orchestrator (since W12 per provider group, `RollupGroupAsync`; the geo demand index is `InsightsDemandIndex.cs`).
- `clinqetinfrastructure/Services/Analytics/SmartAnalyticsReadService.cs` — point-read + IMemoryCache + tier shaping.
- `clinqetinfrastructure/Services/Analytics/ProviderInsightsParquetReader.cs` — **dedicated, isolated** read-only reader (NOT ParquetReaderService — keeps the rec reader unchanged); reads appType=Provider user-interaction + broadcast + search lanes via the shared `ParquetColumnIO`/`AnalyticsBlobPaths`.
- `clinqetinfrastructure/Services/Analytics/BenchmarkMath.cs` — pure math (percentile R-7, RoundToUnit, Position, TrendPercent, Ratio/Percent, `ComputeBand` collapse+suppress — floors `minProviders` at 1 so an empty collapse list can never throw (B2), Haversine, GeoCellKey). Exhaustively unit-tested.
- `clinqetinfrastructure/Services/Analytics/LeadCompetitionMath.cs` (B2) — pure math for the lead-competition metrics over the deduped broadcast lane: `LeadEventIndex.Build` (first-open/first-bid per (broadcast, business) + openers/bidders per broadcast; built ONCE per run, read-only thread-safe), `ComputeCompetition`, `ComputeResponseSpeedRank`, `ComputeTimeToBid`, `TrendPercentFromMedians`, `CompetitorBucket` (0 / 1–2 / 3–5 / 6–10 / 11–20 / 21+), `RoundPercentToTens`. Exhaustively unit-tested.
- `clinqetinfrastructure/Data/COSMOS/ProviderInsightsRepository.cs` — SystemData point-read/upsert (rollup + benchmark + watermark).
- `clinqetcore/Entities/COSMOS/{ProviderInsightsRollup,MarketBenchmark,InsightsWatermark}.cs`.
- `clinqetcore/Interfaces/COSMOS/IProviderInsightsRepository.cs`, `clinqetcore/Interfaces/Analytics/IProviderInsightsReader.cs` (+ `InsightSignal`), `clinqetcore/Interfaces/Services/{ISmartAnalyticsAggregationService,ISmartAnalyticsReadService}.cs`.
- `clinqetshared/Models/SmartAnalyticsSettings.cs`, `clinqetshared/Enums/{InsightsTier,BenchmarkPosition}.cs`, `clinqetshared/DTOs/Analytics/ProviderInsightsDto.cs`.
- `clinqetapi/.../Controllers/Analytics/AnalyticsController.cs` → `[HttpGet("insights")]`.

**Flag:** `Payments:SmartAnalyticsEnabled` on `PaymentSettings` (default false) → projected to the client via `AppConfigDto.Payments.SmartAnalyticsEnabled`.

**Web (`clinqetwebpartnerapp`):** `src/app/dashboard/analytics/page.jsx`, `src/components/insights/InsightsView.jsx` (all metrics incl. the four B2 cards + Option-A tabs + states; the Time-to-Bid trend chip renders `goodWhenDown`), `src/hooks/useProviderInsights.js`, `src/services/analyticsServices.js`, `ProviderInsights` in `src/api/url.js`, `dashboardRoute.analytics`, Sidebar "Insights" entry (gated `useSmartAnalyticsEnabled`), `insightsIcon.jsx`. New-card strings live in `public/lang/{en-US,hi-IN,gu-IN,ja-JP}.json` (`Analytics.LeadCompetition*`, `Analytics.ResponseSpeed*`, `Analytics.BidRate*`, `Analytics.TimeToBid*`).

**Mobile (`clinqetmobilepartnerapp`):** `src/Screen/ProfileFlow/Insights/index.tsx` (identical content, native, incl. the four B2 cards), `src/services/insightsService.ts`, `ProviderInsightsAPI`, `navigations.INSIGHTS` + registration in `MyDashboard-Route.tsx`, gated Profile-menu row, `payments.smartAnalyticsEnabled` on the AppConfig consumer. Upgrade CTA → `navigations.PLANANDBILLING` (no vendor name). New-card strings in `src/Locales/{en,hi,gu}.json` `ANALYTICS.*` (`es.json` is deliberately NOT registered in `i18n.ts` — incomplete bundle).

**Config:** `SmartAnalytics:*` tuning + `UsageAggregator:Enabled` in the Functions worker appsettings.json + `SmartAnalytics:ReadCacheSeconds` + `Payments:SmartAnalyticsEnabled` in the API appsettings.json. `UsageAggregator:TimerSchedule` (host-resolved trigger) in **local.settings.json + deploy.ps1 (both function-app blocks)** — NEVER only the worker appsettings (the P2 trap).

## Calculation contract (06-calculation-and-edge-cases — the source of truth)

- Window: `[T-30d, T)` current, `[T-60d, T-30d)` prior, where `T` = last COMPLETE data day + 1 (UTC). De-dup by `EventId` applies to ALL Parquet counts — since B2 that includes the PeakTimes histogram (gate + buckets) and the VoiceCalls `Breakdown` (both previously counted raw events); inverse-sampling weights (no-op today, defensive).
- Benchmark: like-for-like by `priceType` (Fixed→fixedPrice / Starting from→startPrice / Hourly→hourlyRate), per currency; **collapse to one value per provider** (median) before percentiles; **suppress < 5 distinct businessIds**; p25/p50/p75 R-7, rounded to `PriceRoundingUnit`; position derived from the ROUNDED band; rating band rounded to 1dp.
- Ratios null on zero denominator ("—", never 0%/NaN), clamped ≤100%; no % trend when prior=0 ("new"). Geo = coarse shared cell + 25 km radius.
- **Lead-competition metrics (B2, 2026-07-03)** — computed from the broadcast lane's Opened(13)/BidPlaced(14) events grouped by `BroadcastId` (added to the lane reader's mapped columns in B2; the producers emit each ONCE per (provider, broadcast) — bid UPDATES emit `BroadcastBidUpdated`, not read here). All four suppress on `MinLeadsSampleCount` (3):
  - **Lead Competition (Premium):** leads = broadcasts whose provider first-open ∈ current window; competitors per lead = distinct OTHER BusinessIds with an Opened on that BroadcastId (any time in the read range — very fresh leads can undercount until competitors' opens land; the nightly recompute self-corrects). Median (R-7, rounded away-from-zero) → range bucket only (`bucketLow`/`bucketHigh`, high=null ⇒ "21+"); exact counts never leave the server.
  - **Response Speed (Premium):** per broadcast where the provider's first bid ∈ window AND they have an Opened: compare `firstBid−firstOpen` deltas (clamped ≥0 for clock skew) against every OTHER bidder with both events on the same broadcast; pooled fasterCount÷comparisons → `RoundPercentToTens`. Suppressed when comparisons=0 or leads-with-≥1-comparison < floor. `comparisons` stays server-side.
  - **Bid Rate (Premium):** reuses the funnel counts — `min(Bid,Opened)÷Opened` with prior-window trend via `BuildRatio` (same RatioValue semantics as Win-Rate; null on 0 opened, never fabricated 0%).
  - **Time to Bid (Premium):** provider's OWN median `firstBid−firstOpen` hours (R-7, 1dp away-from-zero) per window; trend via `TrendPercentFromMedians` (null when prior null/0) — **negative trend = faster = good; both UIs render the trend chip with `goodWhenDown` inverted colors**. `priorMedianHours` stays server-side.
  - Rollup fields default `Suppressed=true` so pre-B2 docs deserialize as suppressed (never fabricated zeros); `BidRate` deserializes to the null-ratio RatioValue.

## ⚠️ Honest source deviations (verified-code-driven, documented)

These honor the LOCKED "Parquet is source of truth for the funnel" + §4 single-partition cross-checks, adapting to verified producer semantics — NOT architecture changes:
- **Win-Rate / Lead Funnel:** `BroadcastProviderMatched(12)` is emitted **once-per-broadcast as an aggregate** (`BroadcastProcessorFunction.cs`, `ProvidersMatched=N`), NOT per-provider. The verified per-provider events are `BroadcastProviderOpened(13)`/`BroadcastBidPlaced(14)`/`BroadcastAwarded(16)` (carry `BusinessId`). ⇒ Funnel = **Opened→Bid→Won**; Win-Rate = **Won÷Opened**.
- **Conversion:** `BroadcastConvertedToBooking(19)` carries no `BusinessId` ⇒ "completed" comes from `IBookingRepository` (single-partition, status=Completed in-window); "started" = `BookingInitiated(6)` Parquet; clamp completed≤started.
- **Inquiries/Response (F1, 2026-09-29):** read from the business-side `Conversation.replyCycles` via `ConversationRepository.GetReplyCyclesAsync` (single-partition, the same read the response score uses — see "PROVIDER RANKING SCORES" below). Received = customer waits whose `wroteAt` ∈ `[currentStart, windowEnd)`; Replied = those with `answeredAt`. Hidden threads count (F9). ‼️ It is NO LONGER "the provider had the last word" and no longer "conversations created in-window". Avg-response-time (Premium) = "—" (`AvgResponseHours` is still never written).
- **Voice-Call Analytics:** RESOLVED 2026-07-03 — `VoicePostCallProcessorFunction` now emits one OUTCOME `VoiceCallAction` per completed call (`call_missed`/`call_voicemail`/`call_ai_handled`/`call_whisperer` by CallSummaryPath, + a second `call_ai_booked` when the receptionist booked LIVE on the call; deterministic EventId, business-scoped, fail-quiet — see the clinqet-analytics VoiceCallAction row). `VoiceSubtypeBuckets` default (class default + functions appsettings, mirrored) = call_missed→missed, call_voicemail→voicemail, call_ai_handled→ai_handled, call_whisperer→answered, call_ai_booked→ai_booked ⇒ the breakdown is LIVE. Labels: web `Analytics.VoiceCalls.Bucket.{voicemail,ai_handled,ai_booked}` added ×4 langs (missed/answered pre-existed); mobile `breakdownKey` extended (ai_handled→USAGE_PATH_RECEPTIONIST, answered→USAGE_PATH_WHISPERER, missed/ai_booked → new `ANALYTICS.VOICE_BUCKET_*` keys ×3 langs). Live-call JOIN funnel subtypes stay unmapped; `Total` still counts ALL VoiceCallAction events (join funnel + outcomes).

## B2 residual verification record (2026-07-03 — everything below read first-hand)

- **Fixed:** PeakTimes gate + histogram and VoiceCalls `Breakdown` now EventId-dedup + weight like every other count (both previously counted raw events — a Service-Bus redelivery inflated buckets); `ComputeBand` floors `minProviders` at 1 (empty collapse list can no longer reach `Percentile`); `BroadcastId` added to `InsightSignal` + the broadcast lane mapper (the file reader already loaded every column — only the mapping was missing).
- **Verified correct, left alone:** 8-week trend = 8 complete windowEnd-anchored 7-day buckets (NOT ISO calendar weeks — deliberate: every bucket is a full 7 days, no partial-week distortion; lookback = max(2×WindowDays, TrendWeeks×7)+3 covers it); BuildPriceBenchmarkAreas (band-id construction matches the writer, NoPriceSet rows unsuppressed for the UI note, Position from the stored rounded band); BuildRatingBenchmarkAsync (suppressed-by-default, primary = first coord'd-area service); GeoDemandIndex (exact Haversine + claim-after-range-check cell de-dup across a provider's own areas; the B2-era fixed ±1-degree pre-filter was SUPERSEDED in the 2026-07-03 full-audit session — the sweep now widens its longitude span by latitude and wraps the antimeridian, see below); read service caches the NULL rollup too (negative caching) and shapes tier AFTER cache; reader cap checks after each complete day (never splits a day; a cap-hit lane truncates honestly via `dataAsOf = min` across lanes; cap is per-lane).
- **Stretch metrics decisions:** #5 win-rate-vs-market band SKIPPED — "reuse ComputeBand as-is" would silently exclude 0-win-rate providers (`Value > 0` filter) producing an only-winners band; an honest variant needs a zero-inclusive band + per-provider lead floors in (subcat × geo) slices joined via BroadcastCreated, near-always suppressed at launch density. #6 inquiry response speed was NOT DERIVABLE at the time (no first-reply timestamp); `firstReplyAt` (2026-07-28) and `replyCycles` (2026-09-29) now exist, but `AvgResponseHours` is still never written ⇒ UI "—" (never fabricate). #7 lead open rate (Opened÷Delivered) — SHIPPED 2026-07-03 post-audit (see the Lead Open Rate entry in the audit-session section).

## Phase D delivery-parity audit record (2026-07-03 — analytics-recs final phase)

Web `InsightsView` ↔ mobile `Insights` verified field-by-field: rendering/suppression conditions, tier gating,
`card_view` metric lists and formatting rules (percent null → "—", trend null → no chip / `IsNew` → "New",
`goodWhenDown` on Time-to-Bid, currency from the rollup, `fmtMoney` maxFractionDigits 0 — faithful because bands are
integer-rounded server-side via `PriceRoundingUnit` 5) are byte-identical. i18n verified exhaustively: all 84 used web
`Analytics.*` keys exist in all 4 lang files; all 76 used mobile `ANALYTICS.*` keys exist in en/hi/gu. Tier-after-cache
re-confirmed (`insights_rollup_{businessId}` key has no tier; shaping post-cache) + `Cache-Control private max-age=300`
bounds client staleness; a subscription change is read LIVE (the provider's own rows are never cached cross-request; only the
per-region plan catalog is, bounded by `EntitlementCatalogCacheMinutes`).
**Fixed:** mobile price + rating benchmark rows now suppress on `low == null || high == null` like web (a
non-suppressed doc with a null band edge would have rendered a zero-anchored band). **Documented, unchanged:**
mobile's plain empty state (no action rows / no upgrade hero — the A5 record); voice-bucket label strategies (web
humanizes unknown config keys, mobile maps known summary paths → OTHER; breakdown is config-driven and empty today);
mobile upgrade CTA not gated on `billingUiEnabled` (web gates — the combo Free-tier + billing-UI-off was unreachable only while
the promo grant resolved everyone to Max; the grant was deleted 2026-10-04, so a Free provider with the billing UI off can now reach it); the provider-mobile global 403→forceLogout would fire on a mid-session server flag flip
(unreachable in steady state — the AppConfig gate hides the screen when the flag is off).

## 2026-07-03 full-audit session (post-Phase-D)

**Two new Premium metrics:**
- **Search Visibility (`search_visibility`)** — from a NEW 4th reader lane (search-interactions), aggregated AT READ TIME into per-(business, day) counters (EventId de-dup scoped per day; a SearchId never straddles days in practice): SearchAppearances = distinct SearchIds with an impression, Impressions, Clicks, ClickPercent (withheld below `MinSearchSampleCount` impressions), trend on appearances, `Suppressed` when zero impressions — and defaults TRUE so pre-existing docs deserialize suppressed.
- **Profile Views → Inquiries (`view_to_inquiry`)** — `min(inquiries, dedupedProfileViews) ÷ dedupedProfileViews` RatioValue, no trend, null on zero views.
- **Lead Open Rate (`lead_open_rate`, shipped same day — resolves the deferred B2 stretch #7)** — Cosmos COHORT, not Parquet (the matched lane carries no BusinessId): `BroadcastProviderRepository.GetDeliveredOpenedCountsAsync(businessId, from, to)` = ONE single-partition dual-aggregate per window (`COUNT(1)` delivered in `[from,to)` by `deliveredAt` + `SUM(IS_DEFINED(c.openedAt) AND NOT IS_NULL(c.openedAt) ? 1 : 0)` opened — `openedAt` is stamped once by the guarded Delivered→Opened patch and never cleared; `Opened` projection is nullable because SUM over an empty set is undefined). Current + prior windows loaded in Pass A (2 queries/provider/night); `BuildRatio(min(opened,delivered), delivered, …)` ⇒ RatioValue with trend, null on zero delivered (never 0%), Premium tier. Fresh deliveries undercount until opened — the nightly recompute self-corrects (same documented semantics as Lead Competition). REQUIRED index-policy additions in `CosmosContainerPolicies.ProviderData`: IncludedPaths `/deliveredAt/?` + `/openedAt/?` and composite (type ASC, deliveredAt ASC) — cosmosindexsetup run applied 2026-07-03, user-confirmed. Proven against real Cosmos (`BroadcastProviderRepository_GetDeliveredOpenedCounts_WindowedCohort`: window filter, null openedAt, missing deliveredAt, empty-set coalesce).

Both Premium-gated in `SmartAnalyticsReadService.Shape`; `Comparisons`-class internals (`Impressions`, `PriorSearchAppearances`, `ClickRatio`) partially stay server-side (only appearances/trend/impressions/clickPercent/suppressed leave). `card_view` is now **20 byte-identical metric names** (lead_open_rate directly after bid_rate; then search_visibility, view_to_inquiry); the Free `locked_card_view` list stays 4 (lead_win_rate, conversion, search_visibility, view_to_inquiry — lead metrics follow the B2 no-locked-teaser treatment). New keys: web `Analytics.LeadOpenRate*` ×4 langs; mobile `ANALYTICS.LEAD_OPEN_RATE*` ×3. New web keys `Analytics.SearchVisibility*`/`Analytics.ViewToInquiry*` ×4 langs; mobile `ANALYTICS.SEARCH_VISIBILITY*`/`VIEW_TO_INQUIRY*` ×3.

**Reliability fixes (all verified + unit-locked):** per-file reader failures now count as run failures (watermark held + `UsageAggregator.PartialFailures` alert — previously silently undercounted rollups with the watermark advancing); a file-cap regression that pushes the prior window before the read range ABORTS the run (wrong trends are never published) — ‼️ superseded by W12: the file cap and `SmartAnalytics:MaxParquetFilesPerRun` are gone, and a day that is not summarized stops the run; the demand index (TopSearched/UnmetDemand/LeadsPosted) is now EventId-deduped like every other count (the 02:00 compaction ↔ 02:30 aggregator overlap could double-count and flip suppression floors); timestamp-less broadcast rows are dropped before the lead index (a default(DateTime) firstOpen poisoned Time-to-Bid/Response-Speed via MIN-selection); provider services are ordered deterministically (ServiceId ordinal) so the rating benchmark's "primary" subcategory and the rollup currency can't flap between nights; the geo demand sweep wraps the antimeridian and widens its longitude span by latitude (radius-derived); the UsageAggregator lease loop aborts BEFORE lease expiry (1/3-cadence renewals, 2/3-window abort).

**UI parity fixes:** Peak Times weekday was rendered in the DEVICE timezone from a UTC-anchored date on BOTH platforms (all of CA/US saw the prior weekday) — both now pass timeZone UTC; `svc.priceType` is now localized on web via `Analytics.PriceType.*` ×4 (was raw server English in hi/gu/ja); web week labels/`h` suffix/MAX badges localized (the MAX tags were removed with the two-plan change); web area-tab highlight uses the same clamped index as the content.

## Tier split (LOCKED)

Two plans since 2026-10-04 (`Data\two-plan-pricing\PLAN.md` D10): `InsightsTier { Free, Premium }`, decided by the boolean `analytics_advanced` entitlement (Premium only). The promo grant that resolved everyone to Max is deleted.

- **Free:** Profile Views + locked teasers + upsell (`SmartAnalyticsReadService.Shape` returns after Profile Views when `tier != InsightsTier.Premium`).
- **Premium:** EVERY metric — Win-Rate, Conversion, Price Benchmark, Rating Benchmark, Inquiries+Response Rate, Top-Searched, Leads-Posted, Lead Competition, Response Speed, Bid Rate (B2), Lead Open Rate + Search Visibility + Views→Inquiries, AND the old Max-only cards (Lead Funnel, Time to Bid, Peak Times, Voice-Call Analytics, Unmet Demand, Avg Response Time, Suggested Price, 8-week trends). No "MAX" tag on either UI.

## Sacred boundaries (proven on build)

- Analytics PRODUCERS (`UserInteractionAnalyticsService`, `ParquetStorageService`, 42/81-field schemas, Hive partitioning, AppType, PII scrub, geo-round, sampling, rate limit, LinkedSearchId, compaction) — **read-only consumed; schemas never changed** (W12 / audit E-1 changed only how `ParquetStorageService` builds its fields: fresh per write, same columns and order).
- The recommendation reader (`ParquetReaderService` + `RecommendationSignal`) — **byte-for-byte unchanged** (we added a separate reader); only the appType=Provider lane is read, never the customer rec lane; we never write to `rec_*`/`UserRecommendation`.
- `SystemData` is the only Cosmos container used; `cosmosindexsetup/Program.cs` + `CosmosContainerPolicies.cs` unchanged (no new container, no index change — point-reads are index-free).
- The search index schema is QUERIED, never written.

## Tests

- Unit (`Clinqet.API.UnitTests/Services/BenchmarkMathTests.cs`, `LeadCompetitionMathTests.cs` (B2 — bucket edges, 10%-step rounding, ties, skew clamps, self-exclusion, window boundaries, floors, first-open/first-bid collapse), `SmartAnalyticsAggregationServiceTests.cs` (B2; since W12 through the real roll-up pipeline, `InsightsPipelineHarness`, over crafted lanes: PeakTimes/VoiceCalls de-dup, lead metrics landing on the upserted rollup, redelivery immunity; the router’s client is never invoked because test providers have no services — that file now lives in `Clinqet.Communications.UnitTests/Services/` — the aggregator runs ONLY in the Functions host; benchmark paging cases are in `Clinqet.Communications.UnitTests/Search/InsightsBenchmarkPagingTests.cs`), `SmartAnalyticsReadServiceTests.cs`, insights cases in `AnalyticsControllerTests.cs`): percentile vectors, rounding, position boundaries, provider-collapse, suppression N=4 vs N=5, `ComputeBand` empty-group guard, ratio null/clamp, trend prior=0, tier shaping incl. the four B2 metrics + pre-B2-doc suppressed defaults, **under-promo==full-access**, flag-off 403, tier resolution, 429.
- Integration (`Clinqet.API.IntegrationTests/Tests/SmartAnalyticsIntegrationTests.cs`, Testcontainers Cosmos): rollup upsert + point-read + idempotent re-run incl. the B2 fields, a raw pre-B2-shaped doc (JObject, no lead-competition fields) reading back as Suppressed=true, benchmark + watermark round-trip, endpoint flag-off 403.
- New repos MUST be added to `CosmosCompositeIndexContractTests.RepositoryToContainer`.

## When you touch this

Read 06-calculation-and-edge-cases first. Keep every cross-provider number range-only + suppressed. Never add a
cross-partition Cosmos query (model change + ASK instead). Never change an analytics producer. Keep web + mobile
content identical. Any new `%...%` trigger setting → local.settings.json + deploy.ps1 (both blocks), never only the
worker appsettings.

## ‼️ PROVIDER RANKING SCORES — the nightly scoring lane (rebuilt 2026-09-29; supersedes the 2026-07-28 Phase 2 and 2026-09-27 P4-106 records)

`ProviderScoreRefreshService.RescoreAsync` (W11; Functions host only, via `ProviderScoreRefreshFunction` on `provider-score-refresh`)
writes **responseScore, reliabilityScore, acceptanceScore + scoresUpdatedAt** onto the **BusinessProfile** (not the
rollup) through `IBusinessProfileRepository.TrySetProviderScoresAsync` — a field-scoped patch, no ETag, that is also
the change-feed trigger re-stamping both search indexes. Completeness is NOT here: the indexers derive it at index time.
The definitions are pure and live in `clinqetcore/Utilities`: `ProviderScoreEvaluator` (which bookings and waits count,
and when each happened), `ProviderScoreCalculator` (curves, prior, decay, `EvidenceEnd`, `Next`), `OpeningHoursClock`
(time in the provider's opening hours), `EffectiveProviderScores` (the admin override, applied at index time).
‼️ The anchor tables in `ProviderScoreCalculator` are locked ranking policy (owner), not settings.

**Independence from Insights (N14 → W11).** ‼️ Scoring no longer runs inside the Insights job at all. The window is
`[now − ProviderScoring:WindowDays, now)` at the rescore (`ProviderScoreComputation.WindowStart`); any provider a
`provider-score-refresh` message names is scored, with no Parquet signal read. When rescores run: "W11" in
"Post-ranking follow-ups" below.

**Reads per scored provider (all single-partition):** one `IBookingRepository.GetOutcomeRowsTouchedAsync` (replaced
`GetOutcomeRowsByBusinessIdSinceAsync`; nine-field `BookingOutcomeRow`, bounded on **`updatedAt`** not `createdAt` —
N9 — so an outcome inside the window is found even for a booking made months ahead; Conversion reads the same rows);
one `IConversationRepository.GetReplyCyclesAsync` (replaced `GetCreatedInWindowByUserNumberAsync`; threads with
`lastMessageAt` since the earlier window start, newest first, `TOP ProviderScoring:MaxConversationsRead + 1` (500; warning `ConversationsReadWarning` 400 —
alerts `ProviderScoreConversationsWarning` / `ProviderScoreConversationsLimit`); hidden threads included, F9); the BusinessProfile point read (only when `Enabled`); the
business's `Availability` (only when the profile exists). The look-back below is read only when needed.

**The clock (F4 / D16).** `OpeningHoursClock.From(availability, BookingTimeHelper.ResolveTimeZone(profile,
BusinessTimeSettings), MinWeeklyOpenHours)` over the business-wide hours (`BranchAvailabilityResolver.EffectiveHours`,
`branchId: null`). ‼️ Null (⇒ wall-clock hours) ONLY when the business has no hours rows on record at all. A week
under `MinWeeklyOpenHours` is STRETCHED to it (every open hour × min ÷ weekly), never replaced by the wall clock; rows on
record but none open (closed every day, or unreadable) ⇒ every interval measures ZERO, so the RESPONSE score is not
measured at all and the STORED response score is held — never decayed or reset (D8 / audit D-M3, `ProviderScoreComputation`) (`NoHoursOnRecord_IsNoClock`, `AShortWeek_IsStretchedToTheMinimum_NeverReplacedByTheWallClock`,
`AWeekClosedEveryDay_MeasuresNothing`).

**Customer waits (D11)** — `Conversation.replyCycles` (`[{wroteAt, answeredAt}]`, business-side document only,
internal): a Customer's message opens a cycle inside the `IncrementUnreadAsync(…, CustomerWaitStart)` patch that
already sets `slaDueAt` (guarded `NOT IS_DEFINED(c.slaDueAt)`); the business's reply closes it in
`EndCustomerWaitAsync(…, CustomerWaitEnd)` (`/replyCycles/{index}/answeredAt`). At most
`Tenancy:Inbox:MaxReplyCycles` (50) kept, oldest trimmed (≤ 7 per patch). `firstReplyAt` is still stamped but the
aggregator no longer reads it.

**Response = speed × coverage, toward the prior.** Samples: waits with `wroteAt` in window, and customer-created
booking requests (`createdBy ≠ Business`) with `createdAt` in window.
- Answered wait ⇒ answer, latency `wroteAt → answeredAt`. Unanswered ⇒ a miss only once open ≥ `JudgeAfterOpenHours`.
- Booking confirmed ⇒ answer, latency to `providerConfirmedAt`. Decline (`Rejected`, or `Cancelled` by Business with no
  `providerConfirmedAt` — N1) ⇒ answer, latency to `cancelledAt`. `RejectedTimeout` with `timeoutParty = Provider` ⇒ a
  miss only if ≥ `JudgeAfterOpenHours` opening hours elapsed (D8), else not judged. `AwaitingProviderConfirmation` ⇒ a
  miss only after `JudgeAfterOpenHours` (F5). Anything else (the customer withdrew) is not judged.
- Speed = MEDIAN latency on the opening-hours curve 0.25h→100 · 1→85 · 4→60 · 8→40 · 24→15 · 40→0 (linear between);
  coverage = answers ÷ contacts; `TowardPrior(speed × coverage, contacts, ResponsePriorMean, ResponsePriorWeight)`.

**Reliability — of what you agreed to, how much you broke.** Weighted: `createdBy = Business` counts at
`ProviderCreatedBookingWeight` (clamped 0–1, D10/N8). Outcomes: `Completed` ⇒ kept, and `NoShowProvider` ⇒ broken,
both dated at the APPOINTMENT (`scheduledStartUtc ?? createdAt`, N9); `Cancelled` by Business of a booking it had
confirmed ⇒ broken at `cancelledAt` only when `providerCancelReason` is null or `CouldNotDoIt` (`CustomerAsked`,
`EnteredByMistake` ⇒ not counted — D7/N5); `RejectedTimeout` by Provider ⇒ broken only if ≥ `JudgeAfterOpenHours`
opening hours (D8). ‼️ **Declines are NOT in the denominator (N15)** — they belong to acceptance. Customer-caused
outcomes never count (E5). Failure-rate curve 0→100 · 2%→90 · 5%→70 · 10%→45 · 15%→32 · 20%→20 · 35%→0.

**Acceptance (F12).** Customer requests only: accepted dated at `providerConfirmedAt`; declines dated at `cancelledAt`;
a decline within `FastDeclineOpenHours` opening hours of `createdAt` counts as agreed (D17). Rate (1 when nothing was
answered) on 10%→0 · 30%→35 · 50%→65 · 70%→85 · 100%→100. **Penalty only in ranking (D12)** — `ProviderBoostComposer`
gives it no reward weight.

**Evidence (weighted samples).** Each `ProviderScoreEvaluator` method returns `Samples(int? Measured,
IReadOnlyList<ScoreEvidence> Evidence)`, `ScoreEvidence(DateTime At, double Weight)`. Response + acceptance samples
weigh 1; reliability samples carry the D10 weight, and its gate is the WEIGHTED sum (`decided ≥ MinimumSamples`), so a
zero-weight row can never unlock a score.

**Evidence gate + decay (§13.1, F3, D15).** Below `MinimumSamples` in the window ⇒ NOT measured (not "the prior").
`ProviderScoreCalculator.Next(measured, stored, lastSupported, evidenceEnd, nowUtc, priorMean, halfLifeDays)` — a
function of the EVIDENCE alone (`Next_WithoutEvidence_NeverDependsOnTheStoredValue`): measured ⇒ the measurement;
stored null (never measured) ⇒ stays **null**; otherwise ⇒ `DecayTowardPrior(lastSupported, …, now − evidenceEnd)` —
the measurement the last qualifying window supported, halfway back to the prior mean every `DecayHalfLifeDays`,
counted from when that window ended; no qualifying window inside the look-back ⇒ the prior mean. ‼️ `scoresUpdatedAt`
is still written but no longer feeds decay.
`ProviderScoreCalculator.EvidenceEnd(evidence, minimum, window)` is EXACT: over windows `[sample.At, sample.At + window)`,
the latest one whose weight sum ≥ the minimum — its `sample.At + window` (null when no window ever held it).
`lastSupported` = the evaluator re-run over exactly `[evidenceEnd − window, evidenceEnd)`.
The look-back (`ReadLookbackBookingsAsync` + the waits read again: bookings by `updatedAt` from `windowStart − LookbackHalfLives × DecayHalfLifeDays`
up to the window's own read, `TOP LookbackMaxBookingRows`, plus older waits) is read only when a score is unmeasured
tonight but stored (`EnoughEvidence_NeverReadsTheLookback`). A new business stores nothing — no write at all.

**Write + pause rules.**
- Written only when one of the three stored whole numbers changes — the reindex-storm defence
  (`UnchangedScores_AreNotWritten_SoNoReindexIsTriggered`). Nothing here clears a computed score.
- ‼️ **Paused while hidden (N13)** when `PauseScoringWhenUnlisted` and any of: `!IsListed`, `!ParticipatesInMarketplace`,
  `Status ≠ Active`, or no active + approved + non-deleted service ⇒ scores left as they are (no measure, no decay).
  `AllowOnlineBookings` is NOT checked.
- `Enabled = false` ⇒ no profile read, nothing written.

**The admin override (F10 / D19)** — the five flat `BusinessProfile` fields `responseScoreOverride` /
`reliabilityScoreOverride` / `acceptanceScoreOverride` / `overrideExpiresAt` / `overrideReason` (§12.5; read together
as the in-memory `Clinqet.Core.Models.Business.ProviderScoreOverride`), set from the admin Provider Trust page (see
`clinqet-admin-app`). The measurement never reads them and `TrySetProviderScoresAsync` never touches them;
`EffectiveProviderScores.For` (used by `AzureSearchIndexer` + `ProviderSearchIndexer`) ranks with a LIVE override in
place of the computed value. **Expiry (W11 / W13):** saving an override schedules its own exact-minute
`provider-score-refresh` message (`ProviderScoreRefreshKind.OverrideExpiry`, id `{businessId}:expiry:{ticks}`, via
`IProviderScoreRefreshQueue.ScheduleOverrideExpiryAsync`) → `ProviderScoreRefreshService.ExpireOverrideAsync` (not gated
by `Enabled`; up to 3 attempts, then throws for the message's own retries). Every rescore also runs
`IProviderScoreOverrideService.ExpireIfLapsedAsync` FIRST as the backstop (even for a hidden provider). Either way the
"expired" audit alert is written first, then the ETag compare-and-set removal; the profile write reaches search through
the ProviderData change feed. ‼️ `SearchIndexAuditFunction` no longer expires overrides
(`ProviderScoreOverrideExpiryIntegrationTests`, Functions integration).

**Ranking read** (`ProviderBoostComposer`, `Search:Boost`): response + reliability earn reward points (unknown ⇒ the
`ProviderScoring` prior means, which is why the API binds those two) AND carry a penalty dial; acceptance has the
penalty dial only. `ResponsePenalty` 40/10/0.80, `ReliabilityPenalty` 70/25/0.55, `AcceptancePenalty` 65/20/0.75
(`NeutralScore`/`FloorScore`/`Floor`), `PenaltyCombinedFloor` 0.50; a null score is never penalised.
`BroadcastMatchingService` reads `acceptanceScore` off the provider index too.

**`ProviderScoring:*`** (`clinqetshared/Models/ProviderScoringSettings.cs`; Functions `appsettings.json` carries every
key, the API `ResponsePriorMean`/`ReliabilityPriorMean` + `Refresh:*` (it requests rescores); class defaults = appsettings in both):

| Key | Default | Meaning |
|---|---|---|
| `Enabled` | true | kill switch for the nightly write |
| `ResponsePriorMean` / `ResponsePriorWeight` | 75 / 5 | prior, weight in contacts |
| `ReliabilityPriorMean` / `ReliabilityPriorWeight` | 75 / 5 | prior, weight in decided bookings |
| `AcceptancePriorMean` / `AcceptancePriorWeight` | 75 / 5 | prior, weight in answered requests |
| `WindowDays` | 60 | one look-back for all three (replaced `ReliabilityWindowDays`; response no longer reuses `SmartAnalytics:WindowDays`) |
| `MinimumSamples` | 10 | evidence gate |
| `DecayHalfLifeDays` | 90 | F3/D15 decay |
| `JudgeAfterOpenHours` | 8 | D8 timeout + F5 open-request + unanswered-wait threshold |
| `FastDeclineOpenHours` | 4 | D17 |
| `MinWeeklyOpenHours` | 10 | a shorter week is stretched to it (never wall clock) |
| `LookbackHalfLives` | 4 | F3 look-back past the window, in `DecayHalfLifeDays` |
| `LookbackMaxBookingRows` | 2000 | cap on the look-back booking read |
| `ProviderCreatedBookingWeight` | 1.0 | D10 |
| `PauseScoringWhenUnlisted` | true | N13 |

**Other settings:** `Tenancy:Inbox:MaxReplyCycles` 50 (API + Functions); `SmartAnalytics:MaxInquiryConversations` 500.
No Cosmos index-policy change was needed (`CosmosContainerPolicies.cs` untouched). D11 (analytics contract) is
unchanged: no producer, event shape or Parquet field touched — the scores are a Cosmos write, not a stream.

**Tests:** Functions unit — `ProviderScoreCalculatorTests`, `ProviderScoreEvaluatorTests`, `OpeningHoursClockTests`,
`ProviderScoreComputationTests`, `ProviderScoreRefreshServiceTests` (W11 list below); Functions integration —
`ProviderScoreOverrideExpiryIntegrationTests`, `ProviderScoreReadsIntegrationTests`, `ProviderScoreRefreshIntegrationTests`;
API integration — `ProviderScoresLifecycleCosmosIntegrationTests`, `ProviderScoreOverrideIntegrationTests`.

---

## ‼️ THE SEARCH TOPOLOGY ROUTER (search-topology Phase 1, 2026-09-21)

**No code outside `Clinqet.Infrastructure.Services.Search.Topology` may name a search endpoint or an index
alias.** Every read and every write resolves a route from `ISearchTopology` (`clinqetcore/Interfaces/Search/ISearchTopology.cs`):

| Call | Answers | Use it for |
|---|---|---|
| `ResolvePublic(countryName)` | a `PublicRoute` of `PublicIndexPair` (services + providers client, country code, `Launching`/`Live`) | marketplace search, SEO, banners, the broadcast matcher, the service/provider indexers |
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

### D4 — the benchmark sample’s paging (2026-09-21)

`QueryCellAsync` issued `Size = cap, Skip = 0` in a loop that never advanced, so a geo cell with more matching
services than `MaxServicesPerBenchmark` (500) produced its PERCENTILE BANDS from whichever 500 documents Azure
happened to return first for a `search=*` — an undefined sample for a number a provider is shown as market
truth. It pages by KEYSET, bounded per request by `AzureSearchLimits.MaxDocumentsPerResponse`, so the sample is
reproducible run to run. Pinned by `InsightsBenchmarkPagingTests` in the **Functions** suite.
‼️ **Since the per-service-area fan-out (2026-09-29) the keyset is the row key `id`** (`SearchRowKeys.ServiceRow`,
`{businessId}_{serviceId}_{areaId|noarea}`), not `serviceId`: a service has one public row per service area, so the
loop de-duplicates on `SearchRowKeys.Service(businessId, serviceId)` — a service counts ONCE per cell — and stops on a
short page or a cursor that did not move.

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

## P4-106 — superseded (2026-09-29)

The prior (trusted-rating formula) and the write-only-when-stored-changes rule survive; "a business with no events
stores the prior" does NOT — below `MinimumSamples` a never-measured score stays null. See "PROVIDER RANKING SCORES".

## Post-ranking follow-ups (audit 2026-10-01) — W12 Insights roll-up, W11 rescores

### W12 — the two-step nightly Insights roll-up (replaces `RunAsync`)
- ONE queue `insights-day-rollup` (per stamp; Functions is producer and consumer) → `InsightsRollupFunction`
  (`[Function("InsightsRollup")]`, trigger `%ServiceBusSettings:InsightsDayRollupQueueName%`). Steps
  `InsightsRollupStep` (`clinqetshared/Enums`): `DaySummary` → `Compute` → `Group` → `Finish`; the message
  (`DTOs/Messages/InsightsRollupMessage.cs`) carries no data, so a redelivery recomputes the same result.
- Started by the EXISTING `UsageAggregatorFunction` timer (same schedule, same `_insights.lock` lease) →
  `IInsightsRollupCoordinator.StartAsync`. Run id = start minute (`yyyyMMddTHHmm`); every message id carries it
  (`insights:{runId}:day:{lane}:{yyyyMMdd}`, `insights:{runId}:group:{n}`, `insights:{runId}:{step}:{attempt}`) ⇒
  duplicate detection (P1D) drops a repeat. A Compute re-send of a missing day adds `:r{look}` (E-2) — without it the
  re-send was always dropped as a duplicate.
- **DaySummary** (`InsightsDaySummarizer`, one lane-day read through `ProviderInsightsParquetReader`): EventId-deduped per
  day; one blob per (day, kind) `insights-daily/day={yyyy-MM-dd}/{kind}.parquet` in the analytics container, one row group
  per provider group (`hash(providerId) mod GroupCount`). An unchanged listing fingerprint ⇒ only re-confirmed.
- **Compute** (`InsightsRollupCoordinator`): waits for every summary checked at/after the run start (recheck every
  `RecheckMinutes`); past `ReadyDeadlineMinutes` ⇒ alert `InsightsRollup.NotReady`, nothing written, yesterday's Insights
  stand. **Group** = `SmartAnalyticsAggregationService.RollupGroupAsync(runId, group)` — today's formulas over counts.
  **Finish**: watermark only with zero failures, else `UsageAggregator.PartialFailures`; past `FinishDeadlineMinutes` ⇒
  `InsightsRollup.Incomplete`.
- Numbers proven IDENTICAL to the old job (`InsightsCountsMatchTheNightlyFormulasTests`, 8 random nights; live CA 1/1,
  IN 3/3). Ties are now ordered deterministically (Top searched / Unmet demand: count, then subcategory id).

### Audit E fixes (each pinned by a test and a sabotage)
- **`InsightsRunCache`** (singleton): demand cells and each market band loaded ONCE per (run, key) per process —
  single-flight `Lazy<Task>`; only the newest run held; a failed load is forgotten so the next caller retries.
- **`InsightsDaySummaryGate`** (singleton semaphore): at most `Rollup.DaySummaryConcurrency` (3) summaries rebuilt at
  once per process — each holds a whole day's EventIds (E-3).
- **Conditional summary writes** (`InsightsDaySummaryBlobStore`): rebuild uploads with `IfMatch` (the ETag read) or
  `IfNoneMatch *`; a confirm renews metadata with `IfMatch`; a conflict retries the step (`Rollup.SummaryAttempts` 3) (E-5).
- **Layout check, Format 2** (E-6): blob metadata `format` / `groupcount` / `fingerprint` / `checkedat`, and Parquet
  metadata `clinqet.insights.groupcount` / `clinqet.insights.format`, checked on every group read (mismatch ⇒
  `InvalidDataException`). Changing `GroupCount` makes the next run rebuild what it needs.
- **Bands claim-first** (E-8): `IInsightsRunStore.TryClaimBandsAsync` creates `_runs/{runId}/bands/{sha256(key)}.json.claim`
  with `IfNoneMatch` (409/412 ⇒ another group builds it); the rest wait `BandWaitSeconds`, then build it themselves.
- **`Rollup.SummaryReadBufferBytes`** (E-9): read buffer of both blob stores, so a group reads only its own row group.
- **Dedicated limit alerts** (E-4, `IPlatformLimitAlerts`): lead history in Compute — `LeadEventsWarning` ⇒
  `InsightsLeadEventsWarning`, `MaxLeadEvents` ⇒ `InsightsLeadEventsLimit` (night skipped); inquiries read —
  `SmartAnalytics:InquiryConversationsWarning` 400 ⇒ `InsightsInquiriesWarning`, `MaxInquiryConversations` 500 ⇒
  `InsightsInquiriesLimit`.
- **Step-failure alert deduped per run + step** (E-7): final delivery ⇒ one `FailureNotificationHelper` alert with
  `dedupeKey` `insights-rollup:{runId}:{step}`, then dead-letter `InsightsRollupFailed`; earlier deliveries abandon.
- ‼️ **Fresh Parquet `DataField`s per write** (E-1): Parquet.Net mutates a `DataField` when a `ParquetSchema` takes it, so
  a list shared by parallel writers corrupts row groups. `InsightsParquet` builds field sets per call (columns read by
  name); `ParquetStorageService` builds every schema per call. Guard `NoParquetFieldOrSchemaIsHeldInAStaticField`
  (`ParquetStorageServiceTests`, Functions unit) + `InsightsLayoutTests.ParallelSummaryWrites_EachReadBackExactly`.

**`SmartAnalytics:Rollup:*`** (`InsightsRollupSettings`, Functions appsettings; class = appsettings): `GroupCount` 256 ·
`RecheckMinutes` 10 · `ReadyDeadlineMinutes` 240 · `FinishDeadlineMinutes` 480 · `SendConcurrency` 16 ·
`DaySummaryConcurrency` 3 · `SummaryAttempts` 3 · `LeadEventsWarning` 1,000,000 · `MaxLeadEvents` 2,000,000 ·
`SummaryReadBufferBytes` 262,144 · `BandWaitSeconds` 60 · `BandPollMilliseconds` 500. Removed:
`SmartAnalyticsAggregationService.RunAsync`, the 63-day reader methods, `SmartAnalytics:MaxParquetFilesPerRun`.
Storage lifecycle (`storage.json`): `analytics/insights-daily/day=` 120 days, `analytics/insights-daily/_runs/` 3 days.

### W11 — when the ranking scores run
- Queue `provider-score-refresh` (session = businessId) → `ProviderScoreRefreshFunction` (`[Function("ProviderScoreRefresh")]`)
  → `ProviderScoreRefreshService.RescoreAsync`; writes only on change, then schedules the next night a score would move.
- Requests (`IProviderScoreRefreshQueue.RequestAsync`): the ProviderData + Transactions change feeds
  (`SearchIndexSyncFunction`) and `ConversationService` (customer waits). One id per provider per night
  `{businessId}:night:{yyyy-MM-dd}`, at a hashed slot in `ProviderScoring:Refresh:NightStartUtc` 02:30 +
  `NightWindowMinutes` 180 ⇒ any number of changes in a day = one rescore. Sent nights cached in the queue's OWN cache
  (`SentCacheMaxEntries` 20,000, `SentCacheHorizonHours` 48); sends bounded by `RequestConcurrency` 8.
- Safety net `ProviderScoreSafetyNetFunction` (timer `%ProviderScoring:SafetyNet:TimerSchedule%`): one slice of the Active
  businesses per night (`SliceDays` 30), `MaxPerRun` 50,000 ⇒ `ProviderScoreSafetyNetLimit`, `WarningPerRun` 40,000 ⇒
  `ProviderScoreSafetyNetWarning`, `MaxSendsPerSecond` 100, stops after `MaxConsecutiveFailures` 50 with one alert.
- Rescore read limits: `MaxConversationsRead` / `ConversationsReadWarning` ⇒ `ProviderScoreConversations{Limit,Warning}`;
  `LookbackMaxBookingRows` / `LookbackBookingRowsWarning` (1600) ⇒ `ProviderScoreBookings{Limit,Warning}`.
- `ProviderScoreRefreshMessage` implements `IRecoveredWhenLost` — no lost-message alert (see `clinqet-notifications`).
- Tests (Functions unit): `ProviderScoreRefreshFunctionTests`, `ProviderScoreSafetyNetFunctionTests`,
  `ProviderScoreRefreshQueueTests`, `ProviderScoreNightTests`; W12 `InsightsRollupStepsTests`, `InsightsRollupFunctionTests`,
  `InsightsDayAccumulatorTests`, `InsightsWeightedCountTests`, `InsightsLayoutTests`; integration
  `InsightsRollupIntegrationTests` (Azurite + Cosmos emulator).
