# PHASE 4 — FINAL AUDIT

Implementation session 2026-08-18. Work order: `PHASE-4-PROMPT.md`. Evidence:
`INCIDENT-AND-FIX-RECOMMENDATION.md`. Everything below was verified in this session; where something is
**unverified or owner-owed it says so explicitly** rather than being written as fact.

**Result: every approved decision in §4 is implemented except the ones §15 places out of scope. All builds
clean. 12,482 unit tests pass, 0 fail, 0 skip. ESLint: 0 errors across all three changed UI apps. Every repo's
`git status --porcelain` contains only intentional changes — no scratch artefact anywhere.**

---

## 0. HEADLINE — THE INCIDENT, RE-MEASURED

Run through the **real** incident file (`C:\Nik\providerAIOnbording\toromont_machines.json`, 792,707 bytes,
685 records × 23 keys, fill ratio 1.000) with the **real** `KnowledgeDocumentParser` + `KnowledgeChunker` and
the shipped batching rule:

| | Incident (2026-08-17) | After this fix pack |
|---|---|---|
| Extraction blocks | 1 Paragraph (a 1,018,661-char blob) | **4** — fields Paragraph + `branches` List + `records` Heading + a 686×23 Table |
| Cards | 539 | **316** |
| `Oversize sentence split at word boundaries` warnings | **55** | **0** |
| Embedding requests | **1** | **4** |
| Largest request | ~275,968 est tokens (at/over the 300,000 protocol cap) | **39,764** est tokens (ceiling 40,000) |
| Cards straddling a record | most | **0** |
| Share of the 2,000-passage business budget | 27% | **15.8%** |
| Embedding tokens for the document | ~275,968 | **151,985** (the `records[n].` prefix waste is gone) |

‼️ **What I could NOT do:** re-ingest the file through the live pipeline. That needs the Azure Function App,
Document Intelligence, the Azure OpenAI deployment and the search index — none reachable from the repo. The
numbers above are the parser + chunker + batching rule executed for real over the real bytes; the AI calls and
the index write are not exercised. **This is stated as a limit, not dressed up as an end-to-end pass.**

---

## 1. EVERY DECISION D-01 … D-32

| # | Status | Proof |
|---|---|---|
| **D-01** token-bounded sub-batching, per-input guard, poison isolation | ✅ | `AzureAIFoundryEmbeddingService.BuildGroups` (splits by count AND `_maxTokensPerRequest`), `ClampInput`, `ProcessGroupAsync` isolation branch. Tests: `AzureAIFoundryEmbeddingBatchingTests` (11) |
| **D-02** retry split by failure class AND lane | ✅ | `SendWithRetryAsync`: 429 → `ResolveThrottleDelayMs` (server header first, else exponential from `Retry429FloorMs`); 408/5xx → `BackoffMs(_transientRetryBaseMs)`; 400 → never retried; lane-specific `maxAttempts` + `laneDelayCap` |
| **D-03** lane + process-wide bulk pacer, no second deployment | ✅ | `AiWorkloadLane`, `IAiBudgetGovernor`/`AiBudgetGovernor` (singleton in all three hosts). Test: `AiBudgetGovernorTests.Interactive_IsAdmittedImmediately_EvenWhenTheBudgetIsExhausted` |
| **D-04** JSON-as-table + the multi-line `Paragraph` trap | ✅ | `KnowledgeDocumentParser.TryParseJsonStructure`/`TryBuildJsonTable`; `KnowledgeChunker.SelfContainedLines`. Measured in §0 |
| **D-05** `KnowledgeDocumentFailed`, failure-only, terminal-only | ✅ | Enum + routing + echo + preference + SignalR list + deep link (web & mobile) + both approved tables. `NotifyDocumentFailedAsync`. Tests: `Ready_NotifiesNobody`, `TerminalFailure_NotifiesExactlyOnce`, `DocumentDeletedBeforeTheNotice_IsNeverAnnounced` |
| **D-06** client-side toast suppression, silent refresh | ✅ | Web `signalRService.js` `notifyKnowledgeDocumentSubscribers` + `claimedByKnowledgePage`; mobile `signalRService.ts` + `SignalRProvider` `suppressBanner`. ‼️ The mobile half was **broken until the audit caught it** — see §3 |
| **D-07** 3 alert types, 3 gated flags default TRUE, indexer alerts unified | ✅ | `AdminAlertType` (append-only), `AdminAlertSettings` moved to `Clinqet.Shared.Models` + 3 flags, `AlertsPage.jsx`, `AiEnrichmentFailureTracker` now gated. Pinned by the existing reflection-driven `AdminAlertSettingsConventionTests` |
| **D-08** keep 500,000 TPM | ✅ | No quota change made. `MaxTokensPerRequest` comment states 40,000 is an engineering precaution, **not** a Microsoft rule (D-31) |
| **D-09** throttled ≠ unavailable | ✅ | `AiFailureKind.Throttled` + `AiThrottledException`; the indexer converts a throttled embed into a bubbling throw. Test: `ThrottleThatSurvivesEveryAttempt_ReportsThrottled_NotUnavailable` |
| **D-10** auto-retry → then alert → then admin button | ✅ | `HandleDegradedLegsAsync` enqueues silently → `ChangeFeedFailureReplayFunction` retries → only `IsFinalRetry` reports to `SearchLegFailureAggregator` |
| **D-11** admin resync surface | ✅ | `POST admin/search/reindex-service/{businessId}/{serviceId}` enqueues a `ChangeFeedFailureMessage` (never touches Cosmos). `SearchOperationsPanel.jsx` + deep link from `AlertsPage`. 5 integration tests (401/403 customer/403 provider/404/200) |
| **D-12** any leg failure alerts, aggregated | ✅ | `SearchLegFailureAggregator`. Test: `FiveHundredDegradedServices_ProduceOneAlertPerLeg_NotFiveHundred` |
| **D-13** BQ + rescoring + oversampling 10 + preserveOriginals | ✅ | `cosmosindexsetup/VectorCompressionProfile.cs`, one definition used by both vector indexes. Pinned by `VectorCompressionProfileTests` |
| **D-14** `stored`/retrievable stays TRUE | ✅ | Neither index sets `stored:false`; nothing changed on the field definitions |
| **D-15** `MaxPassagesPerBusiness` stays 2000 | ✅ | Untouched |
| **D-16a** raise the `Retry-After` clamp + read `retry-after-ms` | ✅ | `AIServiceSettings.RetryAfterMaxDelayMs` (60,000) + `ClampServerRetryAfterMs` + `AiRateLimitHeaders.ReadRetryAfter` (ms header, delta, **and** HTTP-date) |
| **D-16b** `CategoryEmbeddingService` batch size → settings | ✅ | `Search:CategoryCoherence:EmbeddingBatchSize` |
| **D-17** provider index gets nothing | ✅ | `ProviderSearchIndexInitializer` untouched; it has no vector field |
| **D-18** Phase A ships before the rebuild | ✅ by construction | The rebuild is an owner-run `cosmosindexsetup` step; Phase A is already in the code it will run against |
| **D-19** `truncationDimension: 1024` | ✅ | `VectorCompressionProfile`, pinned by `Truncation_Is1024` |
| **D-20** the pacer covers completions too | ✅ | `AICompletionService` takes `IAiBudgetGovernor`; every method carries `AiWorkloadLane` (Interactive default) |
| **D-21** change-feed concurrency governed by the pacer | ✅ | AI in-flight work is bounded by `AiBudget:MaxBulkConcurrency`, not the 24-way fan-out. `MaxItemsPerInvocation` 500 → **100** (the plan's own prescribed remedy) |
| **D-22** a 429 on enrichment retries the document | ✅ | `AiThrottledException` propagates out of `GetAIEnrichmentAsync`, `CreateServiceSearchDocumentAsync`, `BuildSearchDocumentInternalAsync`, **and both batch paths** (the batch hole was found in the audit — §3) |
| **D-23** recovery sweep capacity + paced | ✅ | `MaxDocumentsPerRun` 500 → **2000**, class default mirrored; the sweep runs through the Bulk lane; a doc that re-indexes still-degraded is counted **failed**, not recovered |
| **D-24** batch the change-feed embeddings | ✅ | A bulk coalescing window inside the embedding client. ‼️ Implemented as a DataLoader-style coalescer rather than a change-feed barrier — see §4 for why, and why a sequential caller pays nothing |
| **D-25** no new vector field | ✅ | Compression rides the existing `textEmbedding` / `contentVector`; no `*V2` field exists |
| **D-26** index aliases | ✅ | `SearchAliasInitializer` + `Search:IndexVersion`. Audited `deploy.ps1`: `Assert-RequiredAppSettings` only checks a setting is present and non-empty — it never resolves the value against Azure Search, so **no deploy.ps1 change is needed**. ARM does not create indexes — **no ARM change is needed** |
| **D-27** search-service status codes are their own domain | ✅ | `SearchServiceStatusClassifier`; 429 excluded from the retry + breaker predicates and raises a capacity alert; capacity pressure never triggers poison isolation |
| **D-28** explicit `vectorFilterMode: preFilter` | ✅ | 5 sites: `ProviderKnowledgeSearchService`, `ProviderCatalogSearchService`, `AzureSearchQuery` ×2, `BroadcastMatchingService` |
| **D-29** exhaustive-true SKILL note | ✅ note only, **deliberately NOT built as a test** | §15: "D-29 and D-32 — OUT OF SCOPE — do not build… D-29 is a SKILL note". A source-scanning guard would also have to read `clinqetinfrastructure` from a host repo, which §0.17 forbids. Recorded in the `clinqet-voice-assistant` SKILL ×4 |
| **D-30** header-driven governor supersedes share-of-TPM | ✅ | `AiRateLimitHeaders` + `DeploymentBudget.Observe`; configured TPM is only `BootstrapTokensPerMinute`. `x-ratelimit-reset-*` deliberately unread |
| **D-31** keep a conservative ceiling, delete the TPM/6 derivation | ✅ | The comment says precaution, not rule; a token-cap 400 splits (`NeedsSplit`). Test: `TokenCap400_SplitsAdaptively_InsteadOfRetryingTheSamePayload` |
| **D-32** finding only | ✅ not built | §15 |

---

## 2. OPEN ITEMS O-1 … O-6

| # | Status |
|---|---|
| **O-1** `RetrievalTopK` / `RetrievalMaxTokens` | **STILL OPEN.** Untouched, per §15's do-not list. Measuring live-call latency and per-turn token cost needs a live call |
| **O-2** search tier for real scale | **STILL OPEN.** Infra/cost decision; nothing in this pack depends on it |
| **O-3** D-13 confirmation | Closed before this session |
| **O-4** proactive un-enriched sweep | **STILL OPEN.** D-10/D-11 give reactive recovery, which is what shipped. A proactive sweep would need `IsFilterable` on `enrichmentContentHash` (a §0.7 gate) or the `SearchIndexAuditFunction` piggyback |
| **O-5** `AddResilientConsole` duplicate telemetry | **STILL OPEN**, untouched — the plan says raise separately, do not fix here |
| **O-6** `gpt-5.4-mini` quota | **STILL OPEN.** Built on the owner's working assumption. Nothing hard-codes it: `AiBudget:BootstrapTokensPerMinute` is the only place the number appears and the governor prefers Azure's own headers over it |

---

## 3. ‼️ THE MULTI-DIMENSIONAL AUDIT — WHAT I FOUND IN MY OWN CODE, AND FIXED

Every finding below was found by auditing this session's own output **after** it was written and green, and
**every one is fixed** in the code that ships.

| # | Dimension | Finding | Fix |
|---|---|---|---|
| **A1** | **Correctness — silent data loss** | `BuildSearchDocumentFromBatchDataAsync` catches `Exception` and returns null. An `AiThrottledException` there made the service **silently vanish from a business reindex**, which then reported success with a document missing. D-22 violated on the batch path only | Rethrow `AiThrottledException` in that builder **and** in both `BatchIndexServicesAsync` outer catches |
| **A2** | **Logic gap — the retry was a no-op** | `ChangeFeedFailureReplayFunction` re-indexed without `forceReindex`. The freshness guard reads the DEGRADED document's own `UpdatedAtTicks`, matches, and **skips the rebuild** — so the replay would report success while the missing leg stayed missing, the retries would all be no-ops, and the aggregated alert would never fire | `forceReindex: true` on the replay. It costs nothing on a healthy document because the enrichment/embedding content hashes still gate the AI spend |
| **A3** | **Mobile parity (§0.7.1)** | Mobile fired `callbacks.onNotification` — which shows the in-app banner — **before** the knowledge subscriber ran, and discarded its return value. D-06's suppression worked on web and did nothing on mobile: exactly the "same-named component, different rendering rule" failure §0.7.1 exists to catch | Evaluate the claim first; widen `SignalRCallbacks.onNotification` to `(notification, suppressBanner?)`; `SignalRProvider` skips the banner but still records the bell entry |
| **A4** | **Flow gap — a provider never told** | Two paths (`BlobPath` empty; blob missing/unreadable) call `FailAsync` and `return`, so the message COMPLETES and the row settles Failed permanently — but neither notified. D-05 says the terminal outcome notifies | Both now call `NotifyDocumentFailedAsync` |
| **A5** | **Correctness — the learned value was wrong** | The governor's debit-rate learning compared `_remainingTokens` (already decremented locally by `RecordDispatch`) against the server's number, so it learned `actual − predicted`, not `actual` | Added `_serverRemainingTokens`, kept separate from the working estimate; learning now compares server-to-server |
| **A6** | **Convention (caught by an existing guard)** | `NotifyDocumentFailedAsync` used a plain `catch (Exception ex)`, which `BusinessDispatchGuardShapeTests` rejects: a plain catch swallows a host-shutdown cancellation and logs it as a notification error while the message goes unsent | Filtered form `when (ex is not OperationCanceledException)`. ‼️ A comment between `}` and `catch` then made the scanner report "no enclosing try" — the comment had to move inside the catch body |
| **A7** | **§0.12 — class defaults vs appsettings** | Pre-existing drift in a file I touched: `Search:CategoryCoherence:Threshold` default 0.65 vs appsettings 0.50, `StrongMatchThreshold` 0.80 vs 0.75 | Aligned both to appsettings. **No deployed behaviour changes** — both hosts bind the section; it removes the trap where an unbinding host silently gets a stricter threshold |
| **A8** | **Resource leak (pre-existing, in rewritten code)** | The old `ProcessBatchAsync` never disposed its `HttpResponseMessage`, and reused one `StringContent` across Polly retries (`HttpClient` disposes the request content it sends) | The rewrite uses `using var response` and builds fresh content per attempt |
| **A9** | **False green** | `dotnet test --no-build` reported **106 knowledge tests PASSING while the test project did not compile** — stale binaries | Every result in this document comes from a build-then-test run |
| **A10** | **Test correctness** | Adding one optional `lane` parameter made ~15 files' Moq `Setup(...)` match nothing, so the SUT saw a null completion and degraded — the failures read as SUT bugs | All Setup/Verify/Callback arities updated; `Callback<…>` needed the extra generic argument too |
| **A11** | **Test measures the wrong thing** | The new batching suite took **2 minutes** because a 175,000-token bulk batch legitimately waits out a real 60-second pacing window — the suite was measuring the pacer, not the batcher | Pacer configured out of the way in that fixture (one test re-arms it deliberately). 2 min → **1 s**, same assertions |
| **A12** | **Product defect found by a new test** | A flat JSON object of nested objects fragmented into **one block per nesting level** — a 20-key config file would have become 20 tiny cards | Scalars accumulate into one shared buffer; only an ARRAY is a structural break |
| **A13** | **Product defect found by a new test** | `JsonElement.ToString()` renders booleans as .NET `True`/`False` on a card an LLM reads | `RenderScalar` emits the document's own JSON spelling |

### Dimensions checked that produced NO defect

- **Thread safety.** Every shared mutable structure is lock-guarded (`AiBudgetGovernor._gate` per deployment,
  `_coalesceGate`, `SearchLegFailureAggregator._gate`); `_inFlightBulk`/`_coalesceProducers` are `Interlocked`;
  the change-feed's degraded capture is a `ConcurrentBag` subclass (E65 — a plain `List` loses items and the
  off-by-one only shows in CI). The coalescer was walked through interleavings for double-flush and stranded
  items: a stale timer can only drain an empty buffer.
- **Deadlock / hang.** Every governor acquire takes a cancellation token AND a wait cap, and on saturation
  **admits with a warning** rather than blocking (E16) — saturation is a queue, never a hang, and never a
  self-inflicted document failure. Test: `Bulk_IsAdmittedAfterTheWaitCap_RatherThanBlockingForever`.
- **Memory.** The embedding cache's entry cap is now derived from a real byte budget
  (`Search:EmbeddingCache:MaxMemoryMegabytes`, E10) instead of counting 12 KB vectors as "1"; every
  `IMemoryCache` write still sets `Size = 1` (§14, zero-tolerance). The governor's sliding window self-trims;
  `_budgets` is bounded by the deployment count; `_inflight` entries are removed in `finally`; the coalescer's
  buffer is replaced on take and drained on `Dispose`, so no waiter can hang on shutdown.
- **CPU.** No new polling loop runs when idle: the governor's wait loop only exists while a Bulk caller is
  waiting, and the coalescer's timer is scheduled only when a buffer is non-empty.
- **Security.** The new endpoint inherits `[Authorize(Roles = "Admin")]` and is proven at 401/403(customer)/
  403(provider)/404/200. The admin page sits behind `PrivateRoute`. Ids are `encodeURIComponent`-encoded into
  the path. No secret reaches a log or an alert: only Azure error bodies (truncated to 512 chars) and ids,
  all admin-only surfaces. No new user input reaches a query, a filter or a file path. The visibility report
  renders through React (escaped), never `dangerouslySetInnerHTML`.
- **Tenant isolation.** Nothing widened a filter. `businessId` still gates every knowledge query, and D-28
  made `preFilter` explicit rather than inherited.
- **Cancellation.** `OperationCanceledException` is rethrown before every other catch on the ingest path; the
  retry sleep is bound to the caller's token (E13/E14), so a wait longer than the remaining budget is cut
  short and surfaces as a clean abandon instead of dying mid-batch.
- **Localization.** All five backend files carry **2,971 keys each, zero missing, zero extra**, and both new
  keys exist in all five with both `{0}` and `{1}` placeholders. No new user-facing string was added to the
  partner web or mobile apps — the notification text comes from the server — so **no key was invented there**
  (§4: never add a key a project does not use).
- **Orphan settings.** Every new appsettings key has a runtime reader; every `AiBudget` key is read.
  `LegFailure*` was added to the Functions host only, and was **removed from the API appsettings** where
  nothing reads it.

### Known, accepted, and stated rather than hidden

- A deduped batch assigns the **same `float[]` instance** to several result positions and to the cache. No
  caller mutates a returned vector; defensively copying 12 KB per position would be a real cost for a
  hypothetical bug. Pre-existing shape, now shared slightly more widely.
- A permanently-degraded service is retried up to `RetrySettings.MaxDeliveryCount` (5) times, each re-paying
  the missing leg — a bounded, deliberate cost that is exactly what D-10 asks for, spread by the defer window,
  and terminated by the DLQ (E19: bounded attempts, then the aggregated alert).
- `SearchLegFailureAggregator.Dispose` blocks on a final flush. That is deliberate: losing accumulated
  failures on shutdown would be worse. The Functions host has no synchronization context, so it cannot deadlock.
- `HandleDegradedLegsAsync` is **not** gated by `EnablePerDocumentFailureTracking`. A degraded leg is not a
  failed document (it IS indexed and BM25-searchable) — it is a repair queue, and gating it would re-open the
  S3 gap this pack exists to close.
- Building the JSON table's full HTML for a 685-row table allocates ~569 KB that `SplitTable` then discards
  when it takes the row-group path. Bounded by the 20 MB upload cap and needed for the atomic-fit check.

---

## 4. WHERE I DEPARTED FROM THE PLAN'S WORDING (and why)

1. **D-24 is a coalescing window inside the embedding client, not a change-feed barrier.** The plan describes
   "enrich → collect the inputs → ONE batched call → index". A hard barrier would serialise enrichment and
   indexing and add a failure mode. The coalescer produces the same measurable outcome (~100 requests instead
   of 5,000) in the class D-01 already names as the single owner of the sizing rule, and it flushes as soon as
   every live producer is parked — so the **sequential** recovery sweep pays zero added latency while the
   24-way change-feed fan-out still fills a full batch.
2. **`AdminAlertSettings` moved to `Clinqet.Shared.Models`.** D-07 requires the indexer's alerts to come under
   the same regime, and the indexer is library code that cannot reference the Functions host (§0.15). Moving
   the class is the only way both statements are true. The convention test still scans its own repo.
3. **`Search:IndexVersion`, not `AISearch:IndexVersion`.** §5.1 says "e.g. an `AISearch:IndexVersion` setting";
   `cosmosindexsetup` binds the `Search:` section (`Program.cs:41-51`), which is where every other index name
   lives. Putting it anywhere else would have been the invention.
4. **`--recreate-aliases` is opt-in and refused in prod.** An alias cannot take a name an index still holds
   (E67). Rather than delete an index silently, the tool fails loudly with the exact instruction.
5. **`MaxItemsPerInvocation` 500 → 100.** D-21's own prescribed remedy ("reduce `MaxItemsPerInvocation` rather
   than blocking inside one"). It cannot be a `%setting%` — `CosmosDBTrigger` takes an int, not a binding
   expression.

---

## 5. COUNTS RE-MEASURED (not copied)

Measured at this session's tree state, not quoted from the plan:

| Thing | Count |
|---|---|
| `NotificationType` values | **124** (123 + `KnowledgeDocumentFailed`) — parsed from the enum body, not eyeballed. ‼️ A naive `grep -c` says 135 because it counts comment and brace lines; that is exactly the kind of "re-measured" number that is really a copied one |
| Routing catalog / echo catalog / approved-table membership | **exactly equal to the enum** — pinned by `NotificationRoutingCatalogTests` + `NotificationEchoCatalogTests`, both green |
| `AdminAlertSettings` boolean flags | **16** (13 + 3), all TRUE in the class AND appsettings — pinned by reflection, not a hand-kept list |
| `AdminAlertType` values registered in `AlertsPage.jsx` | +3 (`KnowledgeIngestFailed`, `SearchEnrichmentFailed`, `SearchEmbeddingFailed`) |
| Backend localization keys per language | **2,971 × 5**, zero drift |
| Unit tests | **9,427** (API) + **2,318** (Functions) + **653** (MCP) + **84** (cosmosindexsetup) = **12,482 passing, 0 failing, 0 skipped** |
| New test files | 5 (`AzureAIFoundryEmbeddingBatchingTests`, `AiBudgetGovernorTests`, `KnowledgeChunkerLineStructureTests`, `SearchLegFailureAggregatorTests`, `VectorCompressionProfileTests`) + new cases in 3 existing files |
| Vector queries with an explicit `vectorFilterMode` | **5** (was 0) |

---

## 6. SABOTAGE PROOFS — a pin only counts if removing it FAILS

| Guard | Sabotage | Result |
|---|---|---|
| The token ceiling | `SabotageProof_WithTheCeilingRemoved_TheWholeDocumentGoesOutAsOneRequest` raises `MaxTokensPerRequest` to 300,000 and asserts the incident shape returns: **one request, 539 inputs, over the ceiling.** The guard above it therefore proves something | ✅ green |
| `Retry-After` honouring | `Throttle_WaitsTheServersRetryAfterMs_NotTheExponentialFloor` sets the exponential floor to **1 ms** and the server header to 700 ms, then asserts ≥600 ms elapsed. If the header were ignored the test fails on timing, not on a mock | ✅ green |
| Interactive-never-paced | `InteractiveLane_IsNeverDelayedByTheBulkPacer` configures a pacer so tight (`BootstrapTokensPerMinute: 1`, 5 s spacing, 60 s cap) that ANY bulk admission would stall, then asserts Interactive returns in <2 s | ✅ green |
| Success-path silence | `Ready_NotifiesNobody` counts dispatcher invocations on a fully successful ingest | ✅ green |
| Ceiling off-by-one | `BatchExactlyAtTheCeiling_StaysOneRequest_AndOneOverSplits` — exactly 40,000 est tokens is one request; one card more is two | ✅ green |
| Compression config | Four separate assertions: binary (not scalar), 1024, rescoring on with oversampling 10, **preserveOriginals** | ✅ green |

---

## 7. ‼️ THE NEGATIVE SPACE — what I did NOT do

1. **I did not run `cosmosindexsetup` against Azure.** It needs live credentials and it DROPS AND RECREATES
   indexes. **OWNER-OWED:** run it per region via `--launch-profile "Dev (Canada)"` **and**
   `--launch-profile "Dev (India)"` (it ignores a shell `CLINKET_REGION`), with `--recreate-aliases` for the
   one-time cutover, and record the commit each region was run at.
2. **I did not re-run the POC harness** (`voice-answer-ladder/poc/quant-ab.js`). It measures a live search
   service and is only meaningful after (1). **OWNER-OWED**, then record the measured storage + recall here.
3. **I did not re-ingest the incident document end to end.** §0's numbers are the real parser + chunker +
   batching rule over the real bytes; the AI calls and the index write are not exercised.
4. **I did not build D-29's `exhaustive:true` test.** §15 lists D-29 as a non-work-item, and a source-scanning
   guard would have to read `clinqetinfrastructure` from a host repo, which §0.17 forbids. The prohibition is
   recorded in the `clinqet-voice-assistant` SKILL in all four AI-tool directories.
5. **I did not touch anything on §15's do-not list:** no sharding, no second catalog index, no in-memory
   vector scoring, no embeddings persisted outside the index, no `exhaustive:true`, and no change to
   `RetrievalTopK`, `RetrievalMaxTokens`, `MaxPassagesPerBusiness` or any HNSW parameter.
6. **I did not change `telemetryMode`** (§2.7) or fix `AddResilientConsole` (O-5).
7. **I did not run the integration suites.** They need Testcontainers (SQL Server + the Cosmos emulator).
   **Both integration projects COMPILE** and their mocks/harnesses are updated for every changed signature —
   `Clinqet.API.IntegrationTests` and `Clinqet.Communications.IntegrationTests` build clean, and 5 new
   `reindex-service` integration tests are in place. **They are unrun in this session — stated, not implied.**
8. **U-2/U-3/U-4/U-6/U-8 … U-15 in §13 remain unverified.** Nothing shipped depends on a number from them:
   the pacer prefers Azure's own headers to any assumed quota.
9. **`SearchIndexAuditFunction` was not extended** (O-4).

---

## 8. CLEAN TREE — `git status --porcelain` per repo

Every entry below is an intended change. **No scratch artefact exists in any repo.** The two measurement
harnesses I built (a console runner over the real incident file, and an SDK API probe) were written to the
session scratchpad, never into a repo, and **both are deleted** — the scratchpad is empty.

| Repo | Changed | Untracked (new files) |
|---|---|---|
| `clinqetapi` | 17 | `AiBudgetGovernorTests.cs`, `AzureAIFoundryEmbeddingBatchingTests.cs` |
| `clinqetcore` | 5 | `Exceptions/AiThrottledException.cs`, `Interfaces/AI/IAiBudgetGovernor.cs`, `Models/AI/AiRateLimitSnapshot.cs`, `Models/Search/` (2 files) |
| `clinqetshared` | 5 | `Enums/AiFailureKind.cs`, `Enums/AiWorkloadLane.cs`, `Models/AdminAlertSettings.cs` |
| `clinqetinfrastructure` | 18 | `Services/AI/AiBudgetGovernor.cs`, `Services/AI/AiRateLimitHeaders.cs`, `Services/Search/SearchServiceStatusClassifier.cs` |
| `clinqetfuncations` | 13 | `Services/SearchLegFailureAggregator.cs`, `KnowledgeChunkerLineStructureTests.cs`, `SearchLegFailureAggregatorTests.cs` |
| `clinqetmcp` | 3 | — |
| `cosmosindexsetup` | 3 | `VectorCompressionProfile.cs`, `SearchAliasInitializer.cs`, `VectorCompressionProfileTests.cs` |
| `clinqetwebadmin` | 3 | `SearchOperationsPanel.jsx` |
| `clinqetwebpartnerapp` | 3 | — |
| `clinqetmobilepartnerapp` | 5 | — |
| `azureautomation` · `clinqetidentity` · `clinqetwebuserapp` · `clinqetmobileuserapp` | **0 — untouched** | — |

`azureautomation` is untouched **deliberately and verifiably**: no `local.settings.json` key was added, no new
queue/container/Azure resource was created, and `Assert-RequiredAppSettings` only checks that a setting is
present — it never resolves the value, so an alias passes it unchanged.

## 9. DOCUMENTATION

SKILLs updated in **all four** AI-tool directories (`.claude/skills/`, `.github/skills/`, `.agents/skills/`,
`.cursor/rules/*.mdc`): `clinqet-voice-assistant`, `clinqet-search-discovery`, `clinqet-infrastructure`,
`clinqet-shared-core`, `clinqet-function-app`, `clinqet-notifications`, `clinqet-admin-app`.
Memory: `knowledge-ingest-embedding-lanes-2026-08-18.md` + a one-line `MEMORY.md` pointer.
