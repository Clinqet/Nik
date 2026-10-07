# W12 — the Insights two-step daily roll-up, as built

Authority: FINAL-PLAN §3 W12 + DESIGN-PROVIDER-SCORING-SCALE §7.0 (approved 2026-09-29). This note records the build
decisions and every place the build differs from the approved sketch, and why. PLAN §10 carries the summary row.

## What it replaces

`UsageAggregatorFunction` (02:30 UTC) ran `SmartAnalyticsAggregationService.RunAsync` in ONE process: it read ~63 days of
raw Parquet for four lanes, built the demand index and the lead index, read every active provider's Cosmos data, built
the market bands, and upserted one `ProviderInsightsRollup` per provider. It cannot finish at ~100k active providers.

## The flow

One queue, `insights-day-rollup` (per stamp; ARM `events.json` + `deploy.ps1`), four message steps
(`InsightsRollupStep`): `DaySummary`, `Compute`, `Group`, `Finish`. A run is identified by its start minute
(`yyyyMMddTHHmm`), so a manual re-run the same night is a new run; every message id carries the run, so a redelivery
or a repeated send is dropped by duplicate detection (window P1D).

1. **Start** — the existing `UsageAggregator` timer (same schedule, same blob lease). Sends one `DaySummary` per
   (lane, day) the run needs and one `Compute`.
2. **DaySummary (step 1)** — per (lane, partition day), NOT per file (see "differences"). Lists the day's raw files and
   fingerprints the listing (name + ETag). If every summary of that lane-day already carries this fingerprint, only its
   `checkedat` is renewed. Otherwise the day's files are streamed once, deduplicated by EventId exactly as the old reader
   and formulas did, and each summary kind is written as ONE blob (atomic):
   `analytics/insights-daily/day={yyyy-MM-dd}/{kind}.parquet`, per-provider kinds holding one Parquet row group per
   provider group (`group = stable hash(providerId) mod GroupCount`). Blob metadata: format version, group count,
   fingerprint, checkedat, unreadable-file count, groups present (bitmap).
3. **Compute** — waits until every needed summary was checked at or after the run start (rechecks every
   `RecheckMinutes`, re-sends any `DaySummary` still missing, gives up at `ReadyDeadlineMinutes` with an alert and
   writes nothing — yesterday's Insights stand). Then, once per run: the demand cells (search demand + leads posted, the
   current window) and the per-business lead statistics (competition, response speed, time to bid — computed by the
   unchanged `LeadCompetitionMath` over the full lead history), a run manifest (window, groups, which day-blob holds
   which group), one `Group` per group that has any provider row, and the first `Finish`.
4. **Group (step 2)** — reads its group's rows from every needed day, finds its active providers exactly as before,
   reads each one's Cosmos data (Pass A), builds/reuses the market bands, runs TODAY'S formulas over counts, and upserts
   each provider's ONE `ProviderInsightsRollup`. Writes a done marker with its counts.
5. **Finish** — when every group's marker is present: advances the watermark (no failures) or raises the
   partial-failure alert; past `FinishDeadlineMinutes` it alerts which groups never finished.

## Identical numbers — why each formula is exact over counts

- Every writer files an event in the folder of its own timestamp's day (`GroupByEventDay`); EventId and timestamp are
  set together on the server (`Guid.NewGuid()`, `UtcNow`), so a duplicate (redelivery) always lands in the SAME day.
  Deduplicating per day therefore removes exactly what the old window-wide deduplication removed.
- Every window bound is a UTC midnight (`windowEnd = dataAsOf + 1 day`), so "event date in window" ≡ "timestamp in window".
- Weighted counts: the old code ADDED the sampling weight once per event; the new code sums the integer count over the
  window and then adds the weight that many times (`InsightsCounts.Weighted`) — bit-identical, including weights that
  are not exact in binary. Peak times, voice calls and breakdowns multiplied (count × weight) — kept as multiplication.
- search-interactions: unchanged semantics (per partition day, EventId-deduped, distinct SearchIds per day).
- Lead index: first-open / first-bid per (lead, business) is a minimum, so per-day minima reduce exactly; the history
  range is the old read range (`max(2·WindowDays, 7·TrendWeeks) + 3` days back, through today's partial day).
- A provider is active exactly as before: any row of the three per-provider lanes in the current window (including
  search-interaction days whose rows were neither impression nor click, and interaction rows of any event type).

## Differences from the approved sketch (and why)

1. **Per (lane, day), not per source file.** A per-file summary cannot remove a duplicate that sits in two files of
   the same day (an hourly file and its redelivery; the compacted file and a late arrival) — the totals would no longer
   be identical. Compaction already holds one day's EventIds in memory, so a day-summary sits inside the same envelope.
2. **One blob per (day, kind) with a row group per provider group**, not a folder of part files per group: a summary is
   replaced atomically (one upload), so a reader never sees half of a rebuild, and a group reads only its own row group
   (ranged reads) instead of 256 tiny blobs per day.
3. **Ties are ordered deterministically** — Top searched / Unmet demand by count then subcategory id; Peak times by
   count then day then hour. The old order among EQUAL counts was the order rows happened to be read (file listing,
   compaction's sort), so the first three peak times shown could change from night to night with no change in the data.
   The numbers and the membership of every list are unchanged; only the order among equals is now fixed.
4. **A day that is not summarized stops the run** instead of publishing a silent undercount (the old job published and
   alerted). An unreadable raw file is still counted and alerted exactly as before (the day is summarized without it).
5. **Market bands are shared across groups through a per-run blob** (`_runs/{run}/bands/{sha256(key)}.json`, first
   writer wins) — each band is still built once per run, as before.

## Storage and retention

- `analytics/insights-daily/day=…/` — summaries. Lifecycle: deleted 120 days after last modification (the longest need
  is ~64 days; a deleted summary is rebuilt from raw if ever needed). `analytics/insights-daily/_runs/` — 3 days.
- Raw files are untouched (Cool 30 / Archive 180 / delete 2555 — the existing rule).

## Removed

`SmartAnalyticsAggregationService.RunAsync`, the 63-day reader methods, `SmartAnalytics:MaxParquetFilesPerRun`.

## Found while building — the shared Parquet field defect (fixed in both writers)

Parquet.Net 6 mutates a column definition (`DataField`) when a `ParquetSchema` takes it. A field list shared by writers that
run side by side therefore races: a scratch probe of 2,000 parallel writes from one shared list gave 49 corrupted row groups
(a column holding another column's values) and 16 failed writes; fresh fields per write gave none. The raw analytics writer
(`ParquetStorageService`) built every write's schema from static lists — the analytics processor writes batches in
parallel — so this was live for every analytics stream. Every write in both writers now builds its own fields
(`Build*Schema()` per call; `InsightsParquet`'s per-call field sets, columns read by name), and each writer has a
parallel-write regression test (`ParquetStorageServiceTests.ParallelWrites_EachReadBackExactlyWhatTheyWrote`,
`InsightsLayoutTests.ParallelSummaryWrites_EachReadBackExactly`).

## Proof (2026-10-01)

- Unit: 8 random nights against a copy of the old per-event rules (`InsightsCountsMatchTheNightlyFormulasTests`), with
  redeliveries, missing ids and timestamps, other casings, a sampling weight of 1/0.3 and today's partial day — identical,
  and every family of numbers is non-trivial in every seed (the test asserts it).
- Integration (Azurite + Cosmos emulator, `InsightsRollupIntegrationTests`): real writer → summaries → rollups; compaction
  folding a day keeps the counts and the next night only re-confirms; a file replaced after listing is refused (412); an
  unreadable file is counted; a confirm only renews the version it looked at; bands are first-writer-wins.
- Live, old job vs new pipeline at the same moment, field by field (`scratchpad/proof/w12compare.py`): Canada 1/1 and
  India 3/3 providers IDENTICAL, with no equal-count reordering needed; the next run re-read 0 of 214 days and stayed
  identical. The sandboxes hold no broadcast events, so lead metrics rest on the unit and integration proof.
