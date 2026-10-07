# DESIGN (for brainstorming) — provider scores that stay correct from 1 thousand to 10 million providers

> ‼️ **STATUS: THE OWNER'S DIRECTION IS APPROVED; THIS DOCUMENT IS BRAINSTORMING INPUT, NOT AN ORDER.** The session that
> builds it must re-review it end to end, look for a better way and for any edge case it misses, and ASK the owner
> before changing course. Written 2026-09-29 (session 2) from the real code and published guidance (sources at the end).

## 1. The problem (measured in the code, 2026-09-29)

- The nightly job (`UsageAggregatorFunction` 02:30 UTC → `SmartAnalyticsAggregationService.RunAsync`) loads the last
  ~two months of ANALYTICS files (Parquet in blob storage: profile views, search impressions, lead events) for every
  provider into ONE process, groups them by provider, and scores only providers with a signal in the last 30 days
  (lines 153–160). It does not read SQL.
- For each such provider it reads ~9 partition-scoped Cosmos items/queries (services, areas, rating, bookings, customer
  waits, leads ×2, profile, availability; `LoadProviderContextAsync`, lines ~303–350) and runs `PersistProviderScoresAsync`.
- **Gap 1 — quiet providers are frozen.** A provider with no analytics signal in 30 days is never visited, so the existing
  rule "with fewer than `MinimumSamples` (10) in the `WindowDays` (60) window, the score moves halfway back to its
  starting value (75) every `DecayHalfLifeDays` (90); after `LookbackHalfLives` (4) it is treated as back" never runs for
  exactly the providers it exists for. Their last score stays in ranking indefinitely.
- **Gap 2 — override expiry is late** (§12.5 fix (b)): `ExpireIfLapsedAsync` runs only inside that visit, or when the
  audit rotation reaches the business.
- **Gap 3 — the job does not scale.** Loading every provider's events into one process each night works for thousands,
  not millions; and a nightly visit of EVERY provider would be ~5 reads × 10 M = 50 M reads a night, mostly recomputing
  scores that did not change.

## 2. The principle

**Work grows with CHANGE, never with the number of providers, and correctness never depends on a scan.**
A provider's score changes only at known moments:
1. **new evidence** — a booking outcome, a customer message answered or left waiting, a lead response, an opening-hours
   edit (the clock the response score is measured on), a listed/unlisted change, an admin override set/changed/cleared;
2. **time crossing a point that matters** — an old piece of evidence leaving the 60-day window, the fade toward 75 moving
   the whole-number score by one point, an override's end date.

Everything below schedules work at exactly those moments. **The scoring math does not change** — the same
`ProviderScoreEvaluator` / `ProviderScoreCalculator` produce the same numbers; only WHEN they run changes. That is what
keeps this change free of any ranking regression (the golden rule): a before/after on the sandbox must give identical
scores for every provider the old job scores.

## 3. The design

### 3.1 One queue: `provider-score-refresh` (per stamp; ARM `events.json` + `deploy.ps1`, like every queue)
- **Session-enabled, SessionId = businessId** — one worker at a time per provider, so two recalculations can never race
  and land an older answer after a newer one. Duplicate detection ON, history window **1 day** (covers "today" → "tonight").
  Default message time-to-live unlimited (§3.3).
- **ONE message per provider per night — the flow the owner asked about (revised 2026-09-29):**
  - Every evidence change sends "rescore X" as a SCHEDULED message with the fixed MessageId `{businessId}:night:{date}`,
    delivered at that provider's night slot (a fixed offset inside the night window from a hash of the businessId, so 10 M
    providers never arrive at once). Service Bus keeps the first send and drops every later one with the same id (duplicate
    detection). **A provider with 100 bookings in a day — customer or manual (manual ones are evidence,
    `ProviderCreatedBookingWeight`) — gets ONE message and ONE recalculation that night.** A change after tonight's slot has
    passed targets tomorrow's id.
  - Each source also groups its batch by businessId before sending, so a change-feed batch holding 100 changes for one
    provider costs one send.
  - Time points (§3.3) and the safety net (§3.4) use the SAME nightly id, so everything due for a provider on a night
    collapses into one recalculation.
  - The scorer's own profile write cannot loop: if it reaches a trigger, that night's id is already used.
- **Freshness is exactly today's**: scores refresh nightly. What changes is that only providers with a change or a due
  moment are recalculated, and none is missed. (Making it more frequent later is the night-slot setting, not a redesign.)
- **Worker** (Functions, session queue trigger, scales out): load that provider's evidence (the same partition-scoped reads
  as today, minus the analytics files), run the evaluator, `TrySetProviderScoresAsync` only when a whole-number value
  changed (today's rule — which also limits search reindexing to real changes), then schedule the next time point (3.3).
  Idempotent by construction: recomputing from source twice gives the same answer; the patch is conditional.
- **Override expiry** is its own message at the exact minute (`{businessId}:expiry:{ExpiresAt ticks}`): it writes the
  "expired" audit entry (fixed id, first) and clears the override — no full recalculation is needed, because ranking reads
  "override if live, else measured" and the measured value is already current.

### 3.2 Evidence events → immediate rescore
- Sources and how they reach the queue:
  - bookings (`Transactions` change feed — a processor already exists for offers; add or extend one for booking outcome
    fields) → enqueue for the booking's businessId;
  - customer waits (`Communications` — `replyCycles` written by `ConversationService`) → enqueue from the write path or
    its change feed;
  - lead responses (broadcast provider rows) → enqueue from the response write path;
  - opening hours, listed/unlisted, admin override set/changed/cleared → enqueue from their write paths (API).
- The change feed is at-least-once and ordered only within a partition (Microsoft docs); the worker recomputes from source,
  so a duplicate, an out-of-order or a skipped intermediate update cannot produce a wrong score.

### 3.3 Time points → ONE scheduled message per provider (its next change moment)
- After every rescore the worker computes `nextChangeAt` = the earliest of:
  - the oldest in-window evidence + `WindowDays` (the moment the window loses it);
  - the moment the fade moves the stored whole-number score by one point (closed form from the evidence-end date, the
    last measured value, `DecayHalfLifeDays`);
  - the live override's `ExpiresAt` (fix (b) — exact to the minute, with its "expired" audit entry and removal).
  - none of them (no evidence left and the score is back at the start) ⇒ nothing is scheduled; the next evidence event
    wakes it.
- It schedules that message (Service Bus scheduled delivery) as the nightly message of the DAY that moment falls on
  (`{businessId}:night:{date}` at the provider's slot) — day granularity is exact enough for a 60-day window and a 90-day
  fade, and it collapses with any other work that night. Only the override expiry keeps its exact minute (§3.1).
  Note: duplicate detection's history window is at most 7 days, so a time point further ahead can be scheduled twice if two
  rescores more than a day apart both schedule it — the second copy recomputes, changes nothing and ends (harmless).
- **STATELESS — no field on the profile (revised with the owner, 2026-09-29).** A stored "next evaluation" stamp and
  sequence number (to cancel superseded schedules) were considered and REJECTED as overkill: correctness never depends
  on them, because every message recomputes from source and patches only on change. An outdated message (override
  cleared or changed, provider paused or deleted, a later event moved the moment) recomputes, finds nothing to change and
  ends. The cost of not cancelling is, at worst, a few cheap no-op messages per provider over months. §0.7: the cheapest
  correct option wins, and nothing can drift out of sync.
- **Build-time check (configuration, never a workaround):** a message scheduled far ahead (an override "for 365 days")
  must never expire before it fires — the new queue's default message time-to-live is unlimited, and the build verifies
  against the Service Bus documentation how time-to-live applies to a scheduled message.
- Volume: a quiet provider generates at most one message per window exit plus ~one per point of fade (≤ ~25 per 90 days
  for a score far from 75); a provider with no evidence and a settled score generates none.

### 3.4 Safety net — a bounded reconciliation, not a scan
- The nightly timer enqueues rescores for a **slice** of the listed businesses from the SQL business registry (keyset
  pages; slice = hash(businessId) mod 30 == night-of-month mod 30), so every provider is re-verified at least once a
  month even if a message was lost in an outage. Enqueue is throttled. 10 M providers ⇒ ~333 k messages a night.
- First deployment = the same mechanism with the slice set to "all", throttled (the backfill).
- Settings (APPROVED): `ProviderScoring:SafetyNet:Enabled` (default **true** — it runs unless switched off) and
  `ProviderScoring:SafetyNet:SliceDays` (30); appsettings + matching class defaults.

### 3.5 What the existing nightly job keeps
- The provider-facing Insights rollup stays exactly as it is (active providers only — a provider with no activity has no
  insights to show). `PersistProviderScoresAsync` and `ExpireIfLapsedAsync` leave it; scoring lives only in 3.1–3.4.

## 4. Scale and cost (to be re-measured in the build)

| At | Rescores/day (≈) | Service Bus | Cosmos |
|---|---|---|---|
| today (tens of providers) | tens | trivial | trivial |
| 100 k providers | ~100 k | ~3.5 ops/s | ~50 RU × 100 k = 5 M RU/day (~58 RU/s) |
| 1 M | ~1 M | ~35 ops/s | ~580 RU/s |
| 10 M | ~10 M | ~350 ops/s + ~10 M pending scheduled messages (~5 GB) | ~5.8 k RU/s |

- **Limits (Microsoft docs, 2026)**: Service Bus **Standard** = 1,000 operations/s PER NAMESPACE shared by every queue,
  queue size 5 GB (80 GB partitioned); **Premium** = no fixed operations limit, 80 GB queues. We run **Standard**
  (`events.json`). At ~1 M providers this queue alone is fine; at 10 M the WHOLE platform needs Premium (every queue shares
  that 1,000/s) — a platform decision, not this feature's; the design is identical on Premium (configuration only).
- Cosmos cost is linear in real changes, and the reads are the same ones today's job already makes per active provider.

## 5. Edge cases (starting list — find the rest)

| Case | Answer |
|---|---|
| provider hidden/unlisted | today's `PauseScoringWhenUnlisted` rule, unchanged; listing again enqueues a rescore |
| **Suspended today, Active tomorrow** (SQL `BusinessStatus.Suspended`; profile not Active ⇒ hidden) | paused while suspended (scores stay as they were — the provider could not answer customers, so that time must not count against them); an override that expires meanwhile is still recorded on time (the expiry step runs before the pause, as today); lifting the suspension writes the profile ⇒ its change enqueues a rescore ⇒ scheduling resumes |
| **Closed, then reopened** (`BusinessStatus.Closed`) | the same as suspended: paused while closed, resumed by the reopen's profile write. If closure teardown removes the profile, it is the "deleted" case |
| **Account deleted** | the profile is gone ⇒ every message completes doing nothing; nothing new is ever scheduled; leftover messages fire once, no-op and are gone |
| **Onboarding** | not Active ⇒ paused; going live enqueues the first rescore |
| burst of events (100 bookings in a day, customer or manual) | one message and one recalculation that night (fixed nightly id + duplicate detection + per-batch grouping) |
| an event after tonight's slot | goes to tomorrow's id |
| 10 M providers on one night | night slots spread by businessId hash — no single burst |
| the scorer's own write reaching a trigger | that night's id is already used ⇒ dropped; no loop |
| redelivery / duplicate | pure recompute + conditional patch ⇒ same result |
| stale scheduled message | stamp mismatch ⇒ no-op |
| Service Bus outage / lost message | the monthly slice re-verifies everyone |
| override set → changed → cleared within minutes | each enqueues a rescore; each reschedules the expiry; stale expiries no-op |
| override expires | the scheduled evaluation at `ExpiresAt` writes the "expired" audit (fixed id, first) then clears the fields |
| opening hours edited | enqueue (the response clock changed) |
| time zones / DST | the existing `OpeningHoursClock` per business |
| first ever evidence | the prior (75), unchanged rule |
| very busy provider | the evaluator's bounded lookback (`LookbackMaxBookingRows`), unchanged |
| two regions | one queue and one registry per stamp |
| deploy while messages are in flight | the worker is idempotent; the old job stops scoring in the same release |
| clock skew | server UTC only; a message early by seconds recomputes the same score and reschedules |

## 6. Alternatives considered

- **Nightly visit of every provider** (what was first proposed): simple, but O(providers) every night — rejected at scale.
- **Nightly slices only** (1/N per night): bounded, but expiry and fade can be N days late — kept only as the safety net.
- **Compute the fade at read time** (store value + timestamp; the ranking composer decays it on read — the standard
  "decay on read" pattern): removes the fade's scheduled messages entirely, but needs new SEARCH INDEX fields and a
  composer change on every query path, and the window-exit moments still need scheduling. Not chosen: it touches
  ranking at query time and needs new index fields. The approved design is §3.
- **Rewrite the scores as exponentially-decayed counters** (no window, O(1) update, decay on read): the most scalable
  model, but it CHANGES the scoring math the owner approved in the ranking programme — out of scope unless the owner
  asks.
- **Durable Functions timers / Temporal**: durable timers per entity, but a new runtime model for one feature.

## 7. The Insights rollup — INCLUDED in this programme (owner, 2026-09-29)
The provider-facing Insights rollup (the same nightly job) reads every provider's analytics files into ONE process each
night (`ReadProviderInteractionSignalsAsync`, `ReadBroadcastSignalsAsync`, `ReadSearchSignalsAsync`,
`ReadSearchInteractionAggregatesAsync` over ~two months of Parquet); it will not finish at ~100 k+ active providers.
### 7.0 APPROVED FLOW (owner, 2026-09-29) — the two-step daily roll-up in the EXISTING analytics storage
Chosen over (a) Azure Data Explorer — the industry standard at large scale (Uber Eats' Restaurant Manager runs on the same
class of system, Apache Pinot), deferred by the owner as a cost at this pre-launch scale and kept as the migration path —
and over (b) Cosmos per-provider day records summed on page open (more reads on every view, new schema, market-level
insights awkward). Facts it builds on: raw events are Parquet in the blob container `analytics`; compaction runs 02:00 UTC
(`AnalyticsCompactionSettings`, re-compacts the last 3 days); the Insights record is ONE `ProviderInsightsRollup` per
provider in Cosmos `SystemData` (pk = providerId, point read, `RollupTtlDays` 14, API cache `ReadCacheSeconds` 300);
the job runs once a night at 02:30 UTC (`UsageAggregator`).
1. **Step 1 — shrink each finished day, once (~02:15 UTC)**: a coordinator lists yesterday's raw files (and any of the
   last 3 days compaction rewrote — late data) and sends one message per FILE to `insights-day-rollup`. Each worker streams
   its file and writes small summary files into the SAME container:
   `analytics/insights-daily/day={yyyy-MM-dd}/group={000-255}/part-{sourceFileId}.parquet` — per PROVIDER rows (views,
   inquiries, calls, lead events, search appearances, peak-hour cells …) and per MARKET-AREA rows (area × subcategory:
   searches, unmet searches, leads posted …). `group` = a fixed hash of the providerId mod 256 (the same provider is always
   in the same group; groups exist so workers never overlap). Re-doing a source file overwrites its part ⇒ idempotent;
   duplicates are removed per event id as today.
2. **Step 2 — compute Insights, every night (~03:00 UTC)**: one message per group. The group's worker reads that group's
   summaries for the last ~60 days (+ `TrendWeeks`), sums per provider, runs TODAY'S Insights formulas (current 30 days,
   the prior 30 for trends, 8 weeks for the weekly chart), and upserts each provider's ONE `ProviderInsightsRollup` — the
   exact record the screen reads today. Market numbers are computed once per market area and shared.
3. **The screen**: web + both apps do ONE point read of that record (milliseconds), cached 5 minutes — nothing is
   computed while anyone waits. The API contract and the apps do not change.
4. **Proof**: identical numbers before and after for every sandbox provider.
5. **Future insights**: a new column in the day summary + its formula; past days rebuilt from the raw files still kept.
6. **Later move**: the raw files are untouched, so an analytics database can load them whenever volume justifies it.
7. **Build-session checks**: the raw-file retention and any lifecycle rule on `analytics` (summaries must be kept ≥ the
   longest window + backfill needs); every consumer of the rollup record; "top searched" summed per term across days;
   a future unique-count insight uses a mergeable sketch per day.

### (superseded) the earlier "day records in Cosmos" sketch
**The flow (explained to the owner 2026-09-29; the build session re-reviews and asks):** the industry-standard shape is
INCREMENTAL PRE-AGGREGATION — add each finished day up once, and add windows up on read.
1. **Collection is unchanged**: apps → `/api/analytics/track` → `analytics-events` → `AnalyticsProcessorFunction` → Parquet
   (`appType/type/year/month/day`) + nightly compaction. Nothing about collection or its schema changes (CLAUDE: never
   break analytics collection).
2. **Once per finished day**: that day's Parquet files ONLY are rolled up per provider. The day's files are fanned out to
   workers (one file per message, new queue per stamp, ARM + `deploy.ps1`); each worker streams its file, counts per
   provider, and writes the counts into that provider's day record with a PATCH `set` on a path keyed by the file
   (`files/{fileId}`) — idempotent, so a retry overwrites, never double counts.
3. **Provider opens Insights**: the API point-reads that provider's day records for the period shown (30 days + the prior 30
   for the trend, `TrendWeeks` for the weekly chart — ≤ ~60 point reads at ~1 RU, ids known: `{businessId}:insights:{date}`),
   sums them, adds its Cosmos-side counts (leads delivered/opened — the reads the job makes today), caches briefly.
4. **No nightly "read every provider's files" pass**: cost grows with one day's events, never with the number of providers.
5. **Day records expire** by TTL after the longest period any screen shows.
6. **Proof**: the Insights screens show identical numbers before and after, on the sandbox.
7. **To check in the build**: every OTHER consumer of today's persisted rollup (emails, digests, the partner dashboard
   cards, admin views) — each moves to the day records or keeps a small persisted summary; nothing may silently stop.
~~**Schema**: a new document family "provider day totals" in `ProviderData`~~ — **NOT built; superseded by §7.0**
(no new Cosmos document family; the existing `ProviderInsightsRollup` in `SystemData` stays).

## 8. Owner rulings on this design (2026-09-29)
- The direction (event-driven + one scheduled next moment + monthly safety net, scoring math unchanged) is APPROVED.
- **The next session reviews it end to end** — is this the best practice and the best design, is anything missed — and
  ASKS the owner about any improvement instead of assuming.
- **Service Bus (owner's words: "should very well handle everything, like standard, until we have that volume. Then we
  definitely can go to the premium")**: the design runs on Standard today, uses only features BOTH tiers have (queues,
  scheduled delivery, duplicate detection), is never limited or bent by Standard's quotas, and never needs Premium to be
  correct. When volume demands it, moving to Premium is a configuration change, not a redesign. No workaround either way.
- The profile schedule fields: **NOT added — owner-confirmed 2026-09-29** (§3.3, stateless; PLAN §10).
- The safety net (§3.4) runs behind `ProviderScoring:SafetyNet:Enabled` (**default true**, owner-requested) with
  `SliceDays` 30.
- The Insights two-step daily roll-up (§7.0) is APPROVED; the Cosmos day-record sketch below it is superseded.
- The Insights rollup's scale fix is included (§7).

## Sources
- Microsoft Learn — Service Bus quotas and limits: https://learn.microsoft.com/en-us/azure/service-bus-messaging/service-bus-quotas
- Microsoft Learn — Cosmos DB change feed design patterns: https://learn.microsoft.com/en-us/azure/cosmos-db/change-feed-design-patterns
- Microsoft Learn — ServiceBusSender.ScheduleMessageAsync: https://learn.microsoft.com/en-us/dotnet/api/azure.messaging.servicebus.servicebussender.schedulemessageasync
- Temporal — timers and delays: https://docs.temporal.io/workflow-execution/timers-delays
- Netflix Tech Blog — Timestone: https://netflixtechblog.com/timestone-netflixs-high-throughput-low-latency-priority-queueing-system-with-built-in-support-1abf249ba95f
- Decay-on-read example (store raw value + timestamp): https://github.com/MetroLogic/fluxapay_contract/issues/791
