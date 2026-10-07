# Build state — post-ranking follow-ups (FINAL-PLAN §3 W1–W16)

> The running record of WHERE the build is, updated as it moves. Decisions live in `PLAN.md` §10; this file only says
> what is done, what is verified, and what is left. Read it first when a session resumes.

## Where the work lives

- **W: drive** = `subst` of the session scratchpad's `w\` folder; one git **worktree per repo**, branch
  `feature/post-ranking-followups`. Build and test ONLY there (never in the shared `C:\Nik` trees — other sessions work
  there uncommitted, §0.19).
- **Trunks**: every repo's trunk is `origin/master` — **including `clinqetmobileadminapp`** (owner 2026-10-01: `main` was
  stale and is deleted; the W14 commit was rebased onto `origin/master`).
- Before hand-off: `git fetch origin` + `git rebase origin/<trunk>` on a clean tree (commit first), prove
  `git rev-list --merges origin/<trunk>..HEAD` is empty, show `git log --oneline --graph`. The owner pushes.
- Node dependencies in a worktree: `npm ci` from that worktree's own lockfile, or a directory junction to the shared
  tree's `node_modules` ONLY when both lockfiles are identical. Junctions now: `W:\clinqetmobilepartnerapp\node_modules`,
  `W:\clinqetwebadmin\node_modules` → remove with `cmd /c rmdir` (never a recursive delete — it follows into the shared
  tree). `W:\clinqetwebpartnerapp\node_modules` is a real install (`npm ci`), untracked.

## Branch commits (rebased onto the trunk 2026-09-30, linear, no merges)

| Repo | Commits (oldest → newest) |
|---|---|
| clinqetshared | `4ec34d9` heavy-work setting · `1b57a4e` long-page settings · `2e0003a` W4 settings/messages/alert types |
| clinqetcore | `6c46862` page count + render bound · `6aeaddb` page regions · `6db433e` W4 count + bank path |
| clinqetinfrastructure | `1ecdef5` PDFium · `0777e9a` long pages · `d7fb331` W4 near-duplicates/long pictures/alerts |
| clinqetfuncations | `03b2b91` decode gate · `8fee1c9` long pages · `e263ea5` W4 picture passes |
| clinqetapi | `94063482` heavy-work gate · `faea6a7c` setup long pages · `773688f0` W4 count + 560 min |
| clinqetmcp | `8dac836` closest-seat |
| azureautomation | `16fce03` OOM alert, 2 GB, required bindings |
| clinqetwebadmin | `2fa3bc2` W4 alert types |
| clinqetwebpartnerapp | `852948a3` W4 reading count |
| clinqetmobilepartnerapp | `75dceea7` W4 reading count |

**The rebase met the teammates' "searchable parts based on subscription" (master `cca1f68`/`9414e9d`)**: the cap now
comes from entitlements (`IEntitlementService`, a new processor constructor argument after the profiles repository) and
`VoiceKnowledgeSettings.MaxPassagesPerBusiness` is gone. W4's space rule already read the cap ONLY through
`GetMaxPassagesAsync` (the FINAL-PLAN coordination rule), so no behaviour changed; the tests set the cap with
`GivenEntitlements(planMax:)` / `PassageEntitlements.Plan()`, and the space rule's alert names
`KnowledgePassageEntitlements.AlertDial`. **Observation for the owner (not changed):** master's
`Clinqet.API.UnitTests/Conventions/KnowledgePassageEntitlementConventionTests.TheDeletedStaticPassageCap_AppearsNowhereInShippedSource`
scans the Functions host's source from the API suite — a §0.15/§0.17 cross-host scan (it reported the one W4 string
that named the deleted setting, now fixed).

## Status by item

| Item | State |
|---|---|
| W1 memory fix | committed |
| W2 PDFium | committed |
| W3 oversize pages | committed — live proof in `W3-LIVE-PROOF.md` |
| W6 OOM alert + W10 required settings | committed |
| **W4 pictures** | **committed + rebased; unit, integration and sabotage green.** Left: live proof (below), skills ×4, memory |
| **W5 dead-letter handler** | **committed** (shared `9b3f879`, core `1702843`, infrastructure `47152fd`, functions `cab47c2`, api `af24cc62`, mcp `21130c5`, identity `3c5dd47`). Functions unit 7,829; knowledge integration 81; API unit 15,021; Identity unit 1,322; the other hosts' integration projects build. Sabotage `sabotage_w5.py`: **14/14 caught** (the auto-complete flag needed the test to read the attribute's written arguments — an unset flag also reads false). **Live on India** (`findings/W5-LIVE-PROOF.md`): `d1ec7d72…` removed silently, `a3d2d508…` one alert stored by the deployed processor, rows untouched, DLQ 0. Left: skills ×4 |
| W4 live fix (2026-09-30, uncommitted) | extractor: clipped rasters stored as their own bytes again (render reversed, PLAN §10). **Retirement**: `MayRetire` no longer blocked by the floor/cap — the lane records `Withheld` (id + spot + merged near-dup copies), the commit carries back only those, `Unseen` (remote cap / replay without a record) keeps the old carry-all; artefact banks `WithheldPictures`. 8 unit + 1 integration (`AReadAgain_KeepsTheCopyItsFloorWithheld_…`) written; knowledge unit 2,826 green; `sabotage_retire.py` (10 cases) running. MG Windsor re-read (213 = 75 stale drawn slices carried back) must be read again after this |
| W4 live fix — COMMITTED | infrastructure `d6127b2` (own bytes), core `acd7b8d` (artefact `WithheldPictures`), functions `6f299ae` (precise retirement + 8 unit + 1 integration). `sabotage_retire.py` 10/10 + `sabotage_retire_it.py` 2/2 caught |
| W7 O1 — COMMITTED | infrastructure `8d65e4f`, functions `b39b07f`, api `a9d56aa8`; live proof left |
| W8 O2 — COMMITTED | shared `d9c732d`, core `5fbe5e5`, infrastructure `1f6bbfa`, api `f80326c2` (unit + 2 HTTP integration through the real host), web user `bf6ea32`, phone user `b73d82c`. Design `DESIGN-SERVES-AREA.md`, decisions PLAN §10. `sabotage_w8.py` **30/30 caught**. API unit 15,077; web 145 suites/2,227; phone 147 suites/2,028, tsc 0, lint 0 errors and no new warnings; Functions 7,840. Live proof left |
| W9 O3 — COMMITTED | core `ec02bc0`, infrastructure `1aca35c`, functions `1552891`, api `ea77bef1`, cosmosindexsetup `08d8ae2`; `sabotage_w9.py` 9/9; live proof left |
| W4 page-cut crops at reading resolution — COMMITTED | infrastructure `c03e921`, functions `824cdf2` |
| W4 floor/cap retirement by spot — COMMITTED | core `0500ae2` (`BelowTheFloor`), functions `784050d` (+5 tests); `sabotage_floorspot.py` caught |
| W3/W4 pictures a section cannot see — COMMITTED | infrastructure `12e1a65` + `d9d3bb8` (`WholeViewFigures`), functions `fef34b9` + `ed764ab`; `sabotage_wholeview.py` caught. MG Windsor 213 → 113 pictures, p39's car restored (`W4-LIVE-PROOF.md`); p29 duplicate-crop re-read still to confirm |
| **W11 event-driven scoring — COMMITTED** | shared `0a5bbe6`, core `98be2d9`, infrastructure `2111453`, functions `13061a6`, api `f9620f7c`, mcp `1ce2609`, identity `627446e`, web admin `b1fae8e`, azureautomation `c219fde`. Full unit suites: Functions 7,969 · API 15,096 · MCP 1,374 · Identity 1,322 (0 failed). Functions unit (affected) 323; API unit (affected) 166; Functions integration (real Cosmos + SQL) 24; API override integration 9; admin web alerts 32; ESLint clean; every host + test project builds. `sabotage_w11.py` **19/19 caught** (boundary probes, settle margin, covered night, re-sent night, state for a removed provider, end by host clock, end giving up quietly, safety-net status/limit/cursor, booking read after the filter, a non-input type, a failing request, cache without size, save following the cancel, last try unread, save without record, save without end, rescore timed by the message), files restored by checksum. Sandbox queues `provider-score-refresh-dev` created in CA + IN with the ARM values (owner's manage keys, kept only in the scratchpad). Live parity/fade/on-the-minute proof: harness blocked by the auto-mode classifier — waiting on the owner |
| **W12 Insights two-step roll-up — COMMITTED** | shared `29fe91b`, core `1d75205`, infrastructure `671b623`, functions `b485de3`, api `783b2ee5`, identity `f36a897`, mcp `b1646b1`, azureautomation `4c1828c`. Suites: Functions unit 8,056 · API unit 15,113 · MCP unit 1,374 · Identity unit 1,322 · Functions integration (affected) 83 · deploy-script tests green. Built 2026-10-01 — design + deviations `findings/W12-DESIGN.md`, PLAN §10 row. Unit: every Insights suite through the real pipeline (in-memory harness over the real Parquet layout) + 8 random nights against a copy of the old per-event rules; integration 6 (Azurite + Cosmos emulator). **Live old-vs-new: CA 1/1, IN 3/3 IDENTICAL**; second night re-read 0/214 days. ‼️ Found and fixed the shared-Parquet-field corruption in the RAW writer `ParquetStorageService` (and in the new store). Sabotage `sabotage_w12.py` **17/17** (after pinning the per-event weight rule, which the first pass missed) + `sabotage_w12_it.py` **4/4**. Functions unit full 8,056 green. Sandbox: `analytics/insights-daily/` written by the proof harness — remove at cleanup (`w12new.dll <region> clean`) |
| W13 override audit order — COMMITTED with W11 | audit first, 503 when unrecordable, the save runs to an answer the record can match; (b) is W11's exact end message |
| **W14 Provider Trust ranking effect — COMMITTED** | shared `848f1cd`, core `bd6e6fe`, infrastructure `a3a3967`, api `6970483e`, web admin `1e96af1`, admin phone `a335b9c` (rebased onto `origin/master`, parent `4b0a1d0`) |
| W15 Book again on the list — COMMITTED | web user `8c06f90`, phone user `133a270` |
| **W16 live tests — DONE** (PLAN §10 row) | B2 (Saturday-only 93 vs wall clock 20; no hours 20; closed every day → found loophole D8, fixed: core `039359a`, functions `3cd2785`), override end on the minute, §12.5 three records, night message, parity CA 5/5 IN 11/11, Provider Trust live data. Book again: owner click-through (credential minting refused by the session's safety check) |
| Audit (multi-dimensional) + audit document | not started |

## Verification on the rebased tree (2026-09-30)

- Functions unit: 7,790 passed, 0 failed. Functions integration, every `Area=Knowledge` test: 77 passed.
- API unit: 15,021 (the one convention failure fixed and re-run green).
- MCP unit: running (see below when updated).
- Admin web alerts tests (incl. the enum parity): 46 passed; ESLint clean.
- Partner web: full jest 417 suites / 5,444 tests; ESLint clean on the changed files.
- Partner phone: full jest 442 suites / 6,850 tests; `tsc` 0 errors; ESLint clean on the changed files.
- Unit sabotage (19 cases, `sabotage_w4.py`) and integration sabotage (10 cases, `sabotage_w4_it.py`: bank never read ×2,
  the count's CAS, the count on a non-Processing row, the superseded rule, the epoch mint, the bank outside the purged
  prefix, the space rule, a gone copy trusted, the per-pass limit): **all caught**, files restored by checksum.

## Audit 2026-10-01 — every finding fixed (record: `AUDIT.md`)

61 findings across five audits (A knowledge reading 17, B pictures + dead-letter 14, C search 5, D scoring 11, E Insights
11): all fixed (C-1 false and pinned; C-5 and D-M3 by decision, PLAN §10). Sabotage: every fix — A 33/33, B 15/15 + 3.

| Commit (branch, before the rebase) | shared | core | infrastructure | functions | api | other |
|---|---|---|---|---|---|---|
| E | `948d23a` | `a9c0083` | `9006d73` | `0d71153` | — | azureautomation `e7f785b` |
| D + C + B-H1 | `e7515ef` | `5da8d91` | `9a84694` | `4e68192` | `161a4d86` | azureautomation `b3e6a16`, webadmin `b475209`, mobileadmin `b3f43b6`, webuserapp `86cec22` |
| B | `e955b0e` | `6200891` | `35a97a9` | `4dabe80` | `e5a6e9d1` | webadmin `499e49a`, mobileadmin `1e28457` |
| A | `2f50e8a` | `8438883` | `e08e0ba` | `db5f154` | `36acd9d5` | mcp `6fa3a0a` |

Suites on the final tree: Functions unit 8,176; API unit 15,143; MCP unit 1,376; Functions knowledge integration 96 and
provider-score/Insights integration green; API integration (setup/knowledge/business search) 325 + 2 skipped (live
search service absent — pre-existing schema-parity guards). Every test project of every host builds.

## PUSHED to master — 2026-10-01 (owner's instruction for this session)

Every repo was rebased onto `origin/master` (all clean, no conflicts) and its branch head pushed to `master` as a
fast-forward, libraries first and `clinqetapi` last. Each `origin/master` equals the pushed head, and this session's
commits sit in one straight line on top.

| Repo | master | Repo | master |
|---|---|---|---|
| clinqetshared | `65950fd` | clinqetwebadmin | `e0a091d` |
| clinqetcore | `4b24c06` | clinqetmobileadminapp | `1e28457` |
| clinqetinfrastructure | `b1b7880a` | clinqetwebuserapp | `07883fb` |
| cosmosindexsetup | `08d8ae2` | clinqetmobileuserapp | `ccf308b` |
| azureautomation | `7f875ec` | clinqetwebpartnerapp | `037e1218` |
| clinqetfuncations | `b921de4` | clinqetmobilepartnerapp | `adfa38db` |
| clinqetidentity | `f36a897` | clinqetapi | `c1fa4234` |
| clinqetmcp | `7588e07` | | |

**On the rebased tree:**
- Unit: Functions 8,195; API 15,179; MCP 1,386.
- Integration: Functions 836; MCP 124; API 2,491 + 18 skipped (live-service guards).
- Apps, full suites: user web 2,631, partner web 5,520, admin web 765, user phone 2,270, partner phone 6,866, admin phone 405.

**Cleanup done:**
- Worktrees, mirrors and the W:/V: drives removed; `node_modules` links removed as links only, the shared trees intact.
- Scratchpad emptied, including the sandbox Service Bus key file.
- India 6TCWOI space override back to default; the ZEKIKT limit-test copy deleted through the product's delete path.
- W12 proof files removed from both sandboxes (`insights-daily/`, 352 CA + 351 IN).
- The live-proof evidence is kept in `w4live-evidence/`.

**Left for the owner:**
- The deploy (hand-off below), then a live "Read again" of hilux and Glanza (see "W4 live proof").
- The LIVE-1 decision (PLAN §10).
- `InternalsVisibleTo bughunt` in `Clinqet.Infrastructure.csproj` belongs to another programme's harness and was left in place.

## W4 live proof — partly done (`W4-LIVE-PROOF.md`)

Done live: MG Windsor re-reads, the 12/40/108/320 picture set with cost and time, and the "show me" questions on both
paths. **Not re-run live this session:** hilux (Flate+DCT), Glanza (bleed), and the leftover-retirement / found-count
check. Each is pinned by unit and integration tests. Check them live with a "Read again" of those two documents after
the deploy. The original list:

LIVE_SET with the production reader `gpt-5.6-luna`: 0 / 12 / 40 / 108 / 300 pictures, MG Windsor, hilux; Ask Clinket +
the receptionist ("show me the …"); measured cost and time per 100 pictures; the bleed fix on Glanza; the Flate+DCT fix on
hilux; the leftover retirement and the found-count check.

## Hand-off material being collected

- **New queue `provider-score-refresh{suffix}`** (W11; `events.json` + `deploy.ps1` `$qProviderScoreRefresh`): sessions ON,
  duplicate detection ON with a **1-day** window, default time-to-live **maximum** (`P10675199DT2H48M5.4775807S`),
  dead-letter on expiry ON, lock **5 min**, max delivery **5** (= `RetrySettings:MaxDeliveryCount`), **5,120 MB** (audit D-L3;
  watched by the `sb-queue-size` metric alert, `sbQueueSizeBytesThreshold` 805,306,368), not partitioned, batched
  operations ON. Consumer: `ProviderScoreRefresh` (Functions). Producers: Functions (worker, safety
  net, change feeds) and API (conversations, admin overrides).
- **New queue `insights-day-rollup{suffix}`** (W12; `events.json` + `deploy.ps1` `$qInsightsDayRollup`): sessions OFF,
  duplicate detection ON with a **1-day** window (every message id carries its run), default time-to-live **1 day**,
  dead-letter on expiry ON, lock **5 min**, max delivery **5** (= `RetrySettings:MaxDeliveryCount`), 1,024 MB, not
  partitioned, batched operations ON. Consumer and producer: Functions only (`InsightsRollup`; the `UsageAggregator`
  timer starts each run). **Storage lifecycle** (ARM `storage.json`): `analytics/insights-daily/day=` deleted 120 days and
  `analytics/insights-daily/_runs/` 3 days after last modification.
- Function App / API environment variables to add by hand: `MALLOC_ARENA_MAX=2` (W1), dev plan 2 GB (W1);
  **W11: `ServiceBusSettings__ProviderScoreRefreshQueueName` = `provider-score-refresh{suffix}` on EVERY host (API, Identity,
  Functions, MCP — `$script:ServiceBusEntitySettings`), and `ProviderScoring__SafetyNet__TimerSchedule` = `0 0 2 * * *` on
  the Function App** (a trigger binding — without it the safety net cannot start; deploy.ps1 now refuses to deploy when
  any Functions `%Setting%` binding is not required). **W12: `ServiceBusSettings__InsightsDayRollupQueueName` =
  `insights-day-rollup{suffix}` on EVERY host** (a Functions trigger binding too). `deploy.ps1` + ARM carry every one.
- appsettings-only settings (no env var needed): the W4 `Voice:Knowledge:Images:*` keys, `StaleProcessingMinutes` 560,
  `AiAttemptBudgetPerDocument` **23,500** (audit A-L3), `HeavyWorkPixelsPerSlot` 14,000,000 (audit A-H1, API + Functions); W11 `ProviderScoring:Refresh:*` (NightStartUtc 02:30, NightWindowMinutes 180,
  SettleSeconds 60, MaxScheduleProbes 120, TimeoutSeconds 120), `ProviderScoring:SafetyNet:*` (Enabled, SliceDays 30,
  MaxPerRun 50,000, PageSize 1,000, SendConcurrency 16), `ProviderScoring:MaxConversationsRead` 500; W12
  `SmartAnalytics:Rollup:*` (GroupCount 256, RecheckMinutes 10, ReadyDeadlineMinutes 240, FinishDeadlineMinutes 480,
  SendConcurrency 16); **removed** `SmartAnalytics:MaxParquetFilesPerRun`.
- **W11 deploy order**: Functions before the API is NOT required (the API only sends; an unconsumed scheduled message
  waits), but the queue must exist before either host starts — ARM runs first in `deploy.ps1`.
- Near-duplicate list for the owner: `findings/near-duplicates/`.
