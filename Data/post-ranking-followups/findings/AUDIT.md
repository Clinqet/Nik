# Audit — post-ranking follow-ups (W1–W16), 2026-10-01

> **For:** the owner, and any session that resumes this programme.
> **Rule applied:** every finding is fixed in this session, end to end, before the work reaches master
> (`feedback-audit-findings-fixed-this-session`). A finding is closed only when four things are true: it was verified
> against the code, it is fixed, a test pins the fix, and a sabotage of the fix makes that test fail.

## 1. Scope and method

- **What was audited:** every commit of W1–W16 on `feature/post-ranking-followups`, across shared, core,
  infrastructure, functions, api, mcp, identity, azureautomation, webadmin, mobileadmin, webuserapp, webpartnerapp,
  mobilepartnerapp and mobileuserapp.
- **How it was split:** five read-only audits, each reading whole files, their callers and their callees:
  - **A** — knowledge reading (W1 heavy-work gate, W2 PDFium, W3 oversize pages, closest seat);
  - **B** — pictures and the dead-letter handler (W4, W5);
  - **C** — search and Book Again (W7, W8, W9, W15);
  - **D** — provider scoring and trust (W11, W13, W14);
  - **E** — Insights and deploy (W12, W6, W10).
- **Verification:** I re-traced each finding in the code before fixing it. One finding (C-1) turned out false; it is
  now pinned by a test so it stays false.
- **Sabotage:** for every fix, a script copied the file to the scratchpad, broke the fix, rebuilt, ran the pinning
  tests, and restored the file from the copy. Git was never used to restore (§0.19).
  - The scripts are `sabotage_e/d/cb/c4/b.py` and `sabotage_a.py`.
  - A case counts as closed only when the run reports **CAUGHT**.

## 2. Totals

| Area | Findings | Fixed | False | Accepted (decision recorded) | Sabotage cases | Caught |
|---|---|---|---|---|---|---|
| E Insights + deploy | 11 | 11 | 0 | 0 | all fixes | all |
| D Scoring + trust | 11 | 11 (D-M3 by decision) | 0 | 0 | 17+ | all |
| C Search + Book Again | 5 | 3 | 1 (C-1, pinned) | 1 (C-5) | 6 | all |
| B Pictures + dead-letter | 14 | 14 | 0 | 0 | 18 (3 B-H1 + 15) | 18 |
| A Knowledge reading | 17 | 17 | 0 | 0 | 33 | 33 |

C-2 is a deploy-order item. It is closed by the hand-off order in §9, because there is no code to change.

## 3. E — Insights + deploy

| ID | Sev | Finding | Fix | Pinned by |
|---|---|---|---|---|
| E-1 | High | Four raw analytics writers still shared static `DataField` lists. | Each write builds fresh fields. A guard fails the build if any Parquet field or schema is held in a static field. | `NoParquetFieldOrSchemaIsHeldInAStaticField` |
| E-2 | Med | The compute's re-send of a missing day summary was always dropped as a duplicate, so one dead DaySummary skipped the whole night. | Re-sends carry attempt-scoped ids. | Test starts the run first, then re-sends. |
| E-3 | Med | DaySummary and Group steps could run 16 at a time on one 2 GB instance. | A process gate (`Rollup.DaySummaryConcurrency` 3). The demand index is cached once per run per process. | Gate and cache tests. |
| E-4 | Low | The 64-day lead history was held unbounded. | Warning level and hard limit, each with its own alert type (`InsightsLeadEventsWarning/Limit`). The inquiries read got the same treatment (`InsightsInquiriesWarning/Limit`). | Limit tests. |
| E-5 | Low | A manual re-run could stall or break an active run. | Conditional summary writes (IfMatch / IfNoneMatch) that restart on conflict. A confirm never moves `checkedAt` backwards. | Conflict tests. |
| E-6 | Low | A Group step did not check the summary's layout against the run's GroupCount. | Group-count metadata on the Parquet files, checked on every group read (Format 2). | Mismatch test. |
| E-7 | Low | One storage incident raised hundreds of Critical alerts. | Step-failure alerts are deduped per run and step. | Dedupe test. |
| E-8 | Low | A market band could be built many times per run. | Band claim first, then a per-process cache. | 3 sabotages. |
| E-9 | Low | Reading one row group pulled up to 4 MB per summary. | `SummaryReadBufferBytes` setting, used by both stores. | Setting convention. |
| E-10 | Low | The `deploy.ps1` binding guard could not see a `%Setting%` inside a longer binding string. | The regex now matches a token inside any quoted binding. | Probe tree: a token inside a longer binding is caught. |
| E-11 | Low | The smart-analytics SKILL.md was stale. | Updated in all four skill folders (skills pass). | — |

## 4. D — Provider scoring and trust

| ID | Sev | Finding | Fix |
|---|---|---|---|
| D-M1 | Med | The night-message "already sent" memory filled the host's shared, size-limited cache. | `ProviderScoreRefreshQueue` owns its own cache (`SentCacheMaxEntries` 20,000) and keeps only nights within `SentCacheHorizonHours` (48). Sends are bounded-parallel (`RequestConcurrency` 8). |
| D-M2 | Med | Every failed rescore raised a per-business "notification was not sent" alert, and the safety net had no breaker. | Rescore messages carry `IRecoveredWhenLost`, so no lost-message alert. The safety net stops after `MaxConsecutiveFailures` (50) with one alert, and has a per-run warning level (`WarningPerRun` 40,000). |
| D-M3 | Med | A penalised provider could escape the response penalty by marking every day closed. | **Decision:** a fully closed week HOLDS the stored response score (PLAN §10). |
| D-M4 | Med | New cost limits had no warning level and no dedicated alerts. | Warning + limit with dedicated alert types: conversations read, look-back booking rows, safety-net per run. |
| D-L1 | Low | A failed re-read in the override save loop escaped as a bare 500. | `ScoreOverrideResult.Unconfirmed` → 503 "Reload to see whether it was saved", plus a "not confirmed" record. |
| D-L2 | Low | Change-feed rescore requests were sequential, ran before the search rebuild, and stopped at the first failure. | They run bounded-parallel beside the rebuild and continue past failures, naming each one. |
| D-L3 | Low | Queue session state was never removed, and nothing watched the queue's size. | State is cleared on NoProfile; the queue gets 5 GB and a size metric alert (`sbQueueSizeBytesThreshold`). |
| D-L4 | Low | The safety-net enqueue was capped by concurrency, not by rate. | Strict spacing (`MaxSendsPerSecond` 100). The first version burst after a slow page read; the sharpened test found it. |
| D-L5 | Low | The preview and the factor were silently understated when a search cell could not be read. | Ranking is null and the preview returns 503; web and phone say there is nothing to show yet. |
| D-L6 | Low | The approved sheet's "Not measured yet" wording was not drawn. | Drawn in both admin apps. |
| D-L7 | Low | Multi-line comments. | Condensed. |

## 5. C — Search and Book Again

| ID | Sev | Verdict | Outcome |
|---|---|---|---|
| C-1 | Med | **FALSE** — the web rail spreads the whole card, so `servedArea` and `basedInCity` arrive. | Pinned by `dashboardTrendingServices.test.jsx`. |
| C-2 | Med | Real: the deploy order omitted Functions. | Closed by the deploy order in §9: the index (cosmosindexsetup) goes before BOTH Functions and the API. |
| C-3 | Low | Three "read everything" legs could be cut at the row limit with no alert. | `FanOutWindow` `readWhole` flag (reads target + 1, cuts when more are seen) on the no-point and declared legs. |
| C-4 | Low | The descending Distance sort ran a gap read it does not need. | Skipped. The test needed 400 rows to discriminate. |
| C-5 | Low | The "served here" tie-breaks differ between index pick and list sort. | **Accepted** with the reason recorded in `DESIGN-SERVES-AREA.md` §6. |

## 6. B — Pictures and the dead-letter handler

| ID | Sev | Finding | Fix |
|---|---|---|---|
| B-H1 | High | Near-duplicate collapse had no bound, ran again every pass, and spent the pass's time. | `NearDuplicateMaxComparisons` 200 / `NearDuplicateComparisonsWarning` 150 with `KnowledgeNearDuplicatesWarning/Limit`. Verdicts are banked at `_ocr/.../near-{fingerprint}.json`. Collapse time is excluded from the pass clock. |
| B-M1 | Med | The description bank key held the build identity, so every deploy paid for descriptions again. | The key is `PromptFingerprint` (a hash of the prompt pieces and the schema) plus `DescriptionRulesVersion`; pinned to `2426ffa079e975d6`. |
| B-M2 | Med | Dead-letter retries were instant, and the Failed stamp was never written. | Waits base × 2ⁿ (30 → 240 s); the last delivery still tries the Failed stamp. |
| B-L1 | Low | A pass whose worked pictures were all throttled stopped the whole picture chain. | It is retried (`KnowledgeIngestRetryableException`) while retries remain. |
| B-L2 | Low | Read again re-stored every left-out picture, then deleted them again. | A copy is re-stored only after the space rule keeps the picture (`RestoreKeptCopiesAsync`). |
| B-L3 | Low | Limit alerts fired again on every replay. | A replay records what it reloaded; only the difference is alerted. |
| B-L4 | Low | Two notices gave two different picture totals. | One total for both. |
| B-L5 | Low | Long-page alerts labelled setup documents as Knowledge. | `ProviderSetupLongPagesWarning`, `ProviderSetupLongPageLimit` and `ProviderSetupLongPagesFileLimit`, chosen by the flow. |
| B-L6 | Low | Reading-identity gaps. | The message id uses `ProcessingSince`. A re-cut is superseded by a newer reading. A dead MetadataOnly message fails only its own re-cut. |
| B-L7 | Low | The progress write was not tied to a reading and rewrote the row. | `TrySetReadingProgressAsync`: one Cosmos PATCH of `/readingProgress` with IfMatch, only for the row's own reading. |
| B-L8 | Low | The stale window ignored readings of the same business sharing the session. | Overlap fixpoint: a reading is stopped only if elapsed ≥ window + the overlap the other live readings explain. |
| B-L9 | Low | The admin phone app's alert list was not updated. | Web and phone lists equal the enum (186 types), pinned by the parity tests. |
| B-L10 | Low | The top-up deferral reused `KnowledgePicturePassesExhausted`. | Moved into the existing "not described" alert. |
| B-L11 | Low | Comments. | 25 blocks collapsed to one line each. |

## 7. A — Knowledge reading

| ID | Sev | Finding | Fix | Pinned by (sabotage) |
|---|---|---|---|---|
| A-H1 | High | PDF layout windows and big sections were drawn up to 100 MP; no ceiling, and no limit on the number of windows per page. | (1) A region is drawn within the decode ceiling (`RegionScale`); the drawing reports the scale it got. (2) The heavy-work gate is weighted: a drawing takes one slot per `HeavyWorkPixelsPerSlot` (14 M), at most all of them, first come first served, and a cancelled waiter lets the rest in. (3) Layout windows are sized by area, so none exceeds the ceiling: a strip keeps its width, a sheet is cut both ways. (4) A page needing more windows than `MaxSectionsPerPage` is read the old way. Nothing is bought to plan it; the provider is told and `KnowledgeLongPageLimit` is raised. (5) PDFium open and close run on the pool (also fixes A-L4). | Gate ×3, rasterizer ×2, windows, window limit, setting conventions. |
| A-H2 | High | A long page cut by the time budget made no recorded progress, so the reading published the machine text. | Each open section lane counts what it banked; on a budget cut those count toward `ReadingsBanked`. | `ABudgetCutMidPage_CountsTheSectionsItBanked` |
| A-H3 | High | Reading a picture "at its own size" bypassed the JPEG decode ceiling. | `DecodeTarget` asks for the exact size at a DCT scale: the smallest that covers the need, never one past the ceiling. | Normalizer ×2. |
| A-M1 | Med | The cut after seating the closest cards could drop the closest card itself, or another document's fairness seat. | `Seat` never cuts the closest card, and cuts a document's last card only when nothing else is left. | API ×2, MCP ×1. |
| A-M2 | Med | Per-file section limits restarted for every picture of text. | `SectionReadsBefore` carries what earlier pictures planned, in selection order. It is banked with the description, so a replayed picture still counts. | Service, ingest and picture-text tests. |
| A-M3 | Med | Provider setup returned Success with no text for a too-big picture that ran out of time or could not be drawn. | `Error_ProviderSetupExtractionTruncated` / `Error_ProviderSetupUnreadableDocument`. | Setup theory. |
| A-L1 | Low | The table-carry safety net mapped a reading through a picture a carried header had already changed. | Readings map through the composition they were made of. | `ATableThroughThreeSections_CarriesItsHeaderIntoEach` |
| A-L2 | Low | The planner overshot `MaxSectionsPerPage` by one section per remaining column. | The limit leaves room for every later column. A page with more columns than the limit is condensed whole. | Planner theory. |
| A-L3 | Low | The AI-attempt convention left out section reads. | Section reads added to both worst cases. `AiAttemptBudgetPerDocument` raised from 7,500 to **23,500**, the file's own rule ("when the lane grows, the dial grows"): per delivery (1 + 100 + 400 + 40 + 40) × 8 = 4,648 ≤ 4,700. | Convention. |
| A-L4 | Low | PDFium's process-wide lock was taken synchronously on request threads. | Open and close run via `Task.Run`. | (structural) |
| A-L5 | Low | The phone path widened before trying the closest seat, so the "nothing about that offering" note could be false. | It never widens when a closest card would be seated. | MCP test. |
| A-L6 | Low | `NamesACode` misclassified in both directions. | Latin runs only (so CJK and Thai work). Quantities (2BHK, 1.2L, 9am) and sizes (4x4) are not codes; capitals then a number (NX 195) are. **i20 / XUV700 stay codes on purpose:** they carry the sibling hazard the rule exists for. | API theory ×6, CJK seat test. |
| A-L7 | Low | The API host read four image keys its appsettings and convention list did not carry. | Added (`ImageCaptionMinPixels`, `Images.MinShortEdgePixels`, `Images.MaxAspectRatio`, `Images.LongPictureMinShortEdgePixels`). | API convention. |
| A-L8 | Low | A picture of text read only in part was never told to the provider. | `PicturesOfTextReadInPart`, carried on the lane, the bank, the artefact and the replay, with `Info_KnowledgePicturesOfTextReadInPart` (+ `_One`) in en/fr/es/hi/gu. | Ingest, replay, notice. |
| A-L9 | Low | The analytics rebuild read pictures the ingest had skipped. | The rebuild only replays: it reads a picture only if the ingest banked its page (`HasBankedPageAsync`, the reading's own key). | Rebuild test, key test. |
| A-L10 | Low | A page-cut figure that failed to draw bought a whole-document re-analysis that cannot help it. | Counted apart (`PageCutFiguresWithNoPixels`); only DI-crop losses buy a fresh reading. | Extractor and ingest tests. |
| A-L11 | Low | Narrated steps and multi-line comments. | 42 blocks condensed across the Oversize files, PDFium, the rasterizer and the settings; numbered steps removed. | Build + block scan. |

**Sabotage, A:** `sabotage_a.py`, 33 cases — **33 caught** (§8).

## 7a. Found after the audit — by the live proof and the rebase

| ID | Found by | Finding | Fix | Pinned by |
|---|---|---|---|---|
| LIVE-1 | MG Windsor re-read on the audited build (India) | Every deploy made "Read again" re-read every page: the page bank was keyed on the build (P4-I-10's choice, made because a hand-raised version had been forgotten twice). | **Owner decision 2026-10-01** (PLAN §10): pages, descriptions and near-duplicates keyed on inputs + a rules version (v1), guarded by `BankRulesVersionConventionTests`. A picture's text is keyed apart from its description. | Guard + pins; 10/10 deliberate breaks behave (9 caught, a comment-only edit correctly passes); CI-layout proof; Functions unit 8,203, integration 836 |
| D-L5-IT | Full API integration run on the rebased tree | The W14 card integration test passed only because an unreadable index gave the understated ranking that D-L5 removed. | The test now runs on a host whose provider index answers. A new test proves the unreadable case end to end: no ranking, preview 503. | 2 sabotages caught |
| MASTER-1 | Web user suite after the rebase | `utils/offerLabel.test.js` (web) and `__tests__/offerToShow.test.ts` (phone) on master held a dated offer ending `2026-10-01T00:00:00Z`, read against the real clock. They broke on 2026-10-01 (8 + 8 failures); another case would have broken on 10-05. | The cases pin "now" before every end they use. The code was right. | Both suites green |

## 8. Sabotage results

| Script | Cases | Caught |
|---|---|---|
| E | every E fix | all |
| D (`sabotage_d.py`) | 17+ | all |
| C (`sabotage_cb.py`, `sabotage_c4.py`) | 6 | all |
| B-H1 | 3 | 3 |
| B (`sabotage_b.py`) | 15 | 15 |
| D-L5-IT (`sabotage_live.py`) | 2 | 2 (the third case pinned LIVE-1, since reverted) |
| A (`sabotage_a.py`) | 33 | **33** (4 first ran with a filter that matched the wrong tests; re-run on the right tests: all caught) |

## 9. Hand-off: deploy order (closes C-2)

1. **ARM** (`azureautomation`): queues `provider-score-refresh` and `insights-day-rollup` per stamp; the queue-size alert.
2. **cosmosindexsetup / search indexes** — before BOTH Functions and the API (`listingReviewCount` must exist before
   the indexer or an upload with a reviewed service is rejected).
3. **Functions** (carries the new alert types and the new knowledge rules).
4. **API**, then MCP, then the web and phone apps.

## 10. Decisions recorded (PLAN §10)

D-M3 hold, C-5 accepted, A-L3 dial raised to 23,500, A-L6 i20/XUV700 stay codes, A-H1 window count held to the page
limit (planning windows are bounded per page; the per-file limit stays a limit on section readings).
