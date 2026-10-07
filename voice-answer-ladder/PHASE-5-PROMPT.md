# PHASE 5 — PROVIDER-PROJECTION DEBOUNCE (launch-scale write amplification)

> Copy this whole file as the first message of the next session.
> Everything you need is in here. You should not have to guess anything.

---

## 0. SYSTEM INSTRUCTIONS & CODING STANDARDS — NON-NEGOTIABLE

You are an expert Software Architect and Developer. These rules govern all analysis, generation and refactoring.

### 🛑 1. CORE DIRECTIVES (THE "ZERO" RULES)
- **Zero Assumptions:** Do not assume context. Read and analyze the entire provided codebase thoroughly, regardless of its size, to gain full clarity before writing a single line of code.
- **Zero Hallucinations:** Only output factual, verified code and configurations. Every path, symbol, setting key and enum value you cite must exist — verify it first.
- **Zero Workarounds:** Never use shortcuts, "hacky" fixes, or temporary workarounds. Apply only industry best practices.
- **Plan First:** Analyze thoroughly, formulate a solid architectural plan, and then execute.

### 🏗️ 2. PRE-PRODUCTION FREEDOM & REFACTORING
- **No Legacy Constraints:** Pre-production environment. Absolute flexibility.
- **Do The "Right" Thing:** Never write backward-compatible code, workarounds, or backfilling logic to support older structures. If a massive refactor is the architecturally correct solution, execute it.
- **State Resets:** Data can be dropped and recreated at any time. Focus entirely on the absolute best, fully production-ready end state.

### ⚙️ 3. BACKEND & INFRASTRUCTURE
- **Maximum Performance:** Hyper-optimized, efficient, production-ready.
- **Concurrency & Safety:** Multi-threading and async where optimal, but 100% thread-safe.
- **Resource Mastery:** Explicit deallocation the moment an object is no longer needed. ZERO memory leaks, ZERO CPU leaks, ZERO resource exhaustion.
- **Watertight Logic:** Zero gaps, zero bugs. Cover every logical pathway.

### 🖥️ 4. FRONTEND & UI ENGINEERING
- **Strict Alignment:** Stay entirely aligned with the existing theme, design system and component structure.
- **Mobile-First Responsiveness:** Flawless on mobile and iPad — the primary user base.
- **Crisp UX & Routing:** Smooth, fast, lightweight.
- **API Optimization:** Strictly prevent redundant or duplicate API calls.
- **Mockups for New Views:** A brand-new page or interface gets an isolated HTML mockup in the mockup directory FIRST, for visual approval, before any integrated UI code.

### 🛡️ 5. EDGE CASES & RESILIENCE
- **Exhaustive Exploration:** Never limit scope to the happy path. Anticipate and handle every edge case.
- **Fail-Safes:** Network errors, latency, null states, missing data, broken connections — frontend and backend. Survive all of them gracefully.

### 💬 6. COMMENTING & DOCUMENTATION
- **High Signal-to-Noise:** Comments ONLY for critical architectural context or the "why" behind complex logic.
- **No Verbosity:** No redundant, obvious or verbose comments. Clean code speaks for itself.

### 💡 7. OPTIONS & DECISION MAKING
- **Explicit Recommendations:** When presenting options, ALWAYS highlight your strongly recommended one.
- **Provide the "Why":** Concise justification for the recommendation.

### 8. TEST CASES
- Add unit AND integration tests wherever applicable. **Function App tests go in the Function App test project, not the API** — and the same rule holds for Identity, API, Function App and MCP. Good coverage, and cover every edge case.

### ADDITIONALLY — the repo's own law
`C:\Nik\CLAUDE.md` is binding and overrides defaults. Read it fully before coding. Particularly:
- **§0.6** NEVER a cross-partition Cosmos query — no override, ever.
- **§0.7 / §0.7.1** ANY schema change (SQL, Cosmos, Search) needs owner approval FIRST. A plan saying "add X" is NOT approval.
- **§0.12** Settings and enums, never magic numbers. Class defaults MUST mirror `appsettings.json`.
- **§0.14** NO verbose comments. One short line max, only for a non-obvious WHY/invariant/gotcha.
- **§0.16** Leave the tree clean. Delete every scratch file. NEVER write a scratch file inside a repo — use the session scratchpad. LOOK at `git status --porcelain` in every repo you touch.
- **§0.17 / §0.15** A test may only read paths inside its OWN repository. Never add a peer-repo checkout to CI.
- **§0.18** Test placement follows the RUNTIME CONSUMER, not the folder a class lives in. A library class in `clinqetinfrastructure` is tested from the suite of the HOST that invokes it.
- **§14** EVERY `IMemoryCache` write sets `Size = 1`. The size-less `Set(key, value, TimeSpan)` overloads are FORBIDDEN.
- **§25** Any new Azure resource or `local.settings.json` key needs the matching ARM + `deploy.ps1` entry in the SAME change.

### Behavioural rules for this session
- **Check with the owner BEFORE any big architectural change, and before any decision or assumption that needs their input.** Everything already agreed below is approved — just build it.
- **Never report a suite as passing from `--no-build`.** That has produced false greens on stale binaries in this programme, twice. Always build, then test.
- **A pin is only proven by sabotage.** After writing a guard, break the thing it guards and confirm the test FAILS, then restore.

---

## 1. WHY THIS PHASE EXISTS — the finding, in full

### The provider index and how it is written
- Index `clinket-providers-dev` (alias → `clinket-providers-dev-v1`). Key = `businessId`. **Zero vector fields** — no embeddings, so its cost is Cosmos RU and index writes, never AI spend.
- Written by `SearchIndexSyncFunction` (`clinqetfuncations\Clinqet.Communications\Functions\`), the Cosmos change-feed processor on the `ProviderData` container.
- Per batch it builds `listingBusinessIds` = businesses whose **profile** changed **∪** every business with a **service** update, then calls `ProcessProviderIndexAsync` → `ProviderSearchIndexer.UpsertProviderDocumentAsync`.
- **Any change to any document in a business rebuilds that business's whole provider document.** Creates if missing, overwrites if present, deletes it if the profile is not `Active`.

### The cost, measured from the code
`ProviderSearchIndexer.BuildDocumentAsync` issues **8 concurrent queries** per rebuild:
`_serviceRepository.GetByBusinessIdAsync` · `_serviceAreaRepository.GetByBusinessIdAsync` ·
`_offerRepository.GetByBusinessIdAsync` · `_businessRatingRepository.GetBusinessRatingAsync` ·
`_entitlementService.ResolveAsync` · `_friendlyNameResolver.GetFriendlyNameAsync` ·
`_portfolioRepository.GetByBusinessIdAsync` · `_availabilityRepository.GetByBusinessIdAsync`
(plus `_branchDirectory.GetActiveBranchIdsAsync`).

‼️ `GetByBusinessIdAsync` returns the **ENTIRE catalogue** for that business (`GetItemsByPartitionKeyAsync`). So the read cost of one rebuild scales with catalogue size.

### The only mitigation that exists today
Per-batch dedupe: *"Deduped per batch: ten service edits for one provider cost a single projection."*
**It only collapses edits INSIDE one change-feed batch.** `MaxItemsPerInvocation = 100`, feed poll delay 2000ms — so services written one at a time (UI, API, CSV/dealer catalogue import) land in separate batches and defeat it entirely.

### Launch-scale arithmetic — this is the reason for the phase
Owner's launch condition: **~1,000 providers, 50–100 services each.**

One provider onboarding 100 services one at a time:

| Service written | Service docs read by that rebuild |
|---|---|
| #1 | 1 |
| #2 | 2 |
| … | … |
| #100 | 100 |

= **1+2+…+100 ≈ 5,050 service-document reads to produce ONE provider document**, plus offers/areas/availability/portfolio queried 100 times each.

**× 1,000 providers ≈ 5,000,000 document reads and ~100,000 index writes** during launch onboarding.
Steady state (~5 edits/provider/day) ≈ **500,000 reads/day** re-projecting documents that mostly did not change.

It is **quadratic per provider** — the larger the catalogue, the more expensive every single edit becomes.

**Verdict: yes, this is a launch blocker for cost and throughput. It is NOT a correctness bug — the index is always correct, just rebuilt far more often than needed.**

---

## 2. THE APPROVED SOLUTION — debounce per business

### The idea in one line
Stop rebuilding inside the change-feed batch. Instead drop a *"this business is dirty"* marker that fires after a short delay, and let Service Bus duplicate-detection collapse a burst into **one** rebuild.

```
today:  services 1..100 arrive → 100 rebuilds → ~5,050 reads
after:  services 1..100 arrive → 1 rebuild    →   ~100 reads     (~50× less)
```

### Why coalescing is safe
The rebuild **re-reads current state from Cosmos**. It does not matter which edit triggered it — everything that landed during the window is included. Nothing is skipped; work is only **deferred and batched**.

‼️ This is the crucial difference from the **version guard**, which tried to *skip* rebuilds and was found unsafe (see §4).

### The mechanism — all of it already exists in the codebase
`IServiceBusService` already has:
```csharp
Task<long> SendScheduledMessageAsync<T>(string queueName, T message, DateTimeOffset scheduledTime,
    CancellationToken cancellationToken = default, bool forceAdminAlert = false, string? messageId = null);
Task<bool> CancelScheduledMessageAsync(string queueName, long sequenceNumber, CancellationToken cancellationToken = default);
```
Precedents already using it: `CartService.cs:490` (cart reminders) and `NotificationDigestService.cs:216`.
ARM already provisions queues with `requiresDuplicateDetection` + `duplicateDetectionHistoryTimeWindow` (`azureautomation/events.json`).

**We SEND ~100 messages and Service Bus KEEPS 1.** The broker drops duplicates by `MessageId`. 100 tiny sends cost ~nothing (≈$0.05 per million operations) and replace ~5,000 Cosmos reads.

### ‼️ THE TRAP — do not copy the existing dedupe window
Existing queues use `duplicateDetectionHistoryTimeWindow: PT10M`. **Copying that here is a data-loss bug.**
With a 60s delay and a 10-minute window: the rebuild fires at T+60, but every edit between T+60 and T+600 still matches the same `MessageId` and is **silently dropped** — the provider document goes stale for ten minutes with no error anywhere.

**Approved fix (owner-preferred): put the time bucket IN the messageId.**
```
messageId = $"providerprojection:{businessId}:{unixMinute}"
```
Each window gets its own id naturally, so the queue's window setting can never break it — immune to someone later "standardising" the queue config. Set the queue window to a small value anyway (e.g. PT1M) as defence in depth.

### Failure handling — non-negotiable, owner-mandated
A failed projection means **that provider is missing or stale in search — invisible to customers.** Treat it exactly like the knowledge and search-index failure paths:
- Service Bus retries on delivery count.
- **On FINAL delivery → admin alert**, behind its own gated flag in `AdminAlertSettings`, via the same `FailureNotificationHelper` path used elsewhere.
- **ANY failure must alert** — not only throttling/429. Match `KnowledgeIngestProcessorFunction` and the search-index leg alerts.
- The message names the `businessId`, so Search Operations can repair it directly with the existing `POST /admin/search/reindex-business/{businessId}`.

‼️ **Preserve the alert path that exists today.** Provider-document failures currently alert via
`failedProviderDocs → HandleReindexFailuresAsync(…, "ProviderDocument")` inside `SearchIndexSyncFunction`.
Moving projection onto a queue **moves that path** — it must be re-established on the new processor, not left behind. A dropped alert path is exactly the class of gap that made the CA stall invisible for hours (see §5).

### Scope
- Provider projection ONLY. Do **not** touch the services-index path (`IndexServiceAsync`) — it already has its own freshness guard and its own alerting.
- Keep full rebuild as the projection method. Do **not** switch to partial/merge field updates — the document is a denormalized join of ~8 sources and patching individual fields reintroduces drift.

---

## 3. WHAT NEEDS OWNER APPROVAL BEFORE YOU START

**One gate, already flagged and expected — confirm it, then proceed:**

> A **new Service Bus queue** for the debounced projection, with its matching **ARM template + `deploy.ps1`** entry in the same change (§0.7.1 / §25).

Also confirm with the owner (do not decide alone):
- The delay window value (recommendation: **60 seconds** — long enough to collapse a bulk import, short enough that search staleness is invisible).
- The new `AdminAlertSettings` gate name (recommendation: `EnableProviderProjectionFailureAlerts`, defaulting **true**, mirrored in `appsettings.json` — the convention test enforces both).

Everything else in §2 is agreed. Build it without re-asking.

---

## 4. ‼️ WHAT WAS EXPLICITLY REJECTED — do not rebuild it

### The version guard — UNSAFE, owner agreed to drop it
The original plan had *"skip the rebuild if the projection is already newer than the change that triggered it"*, mirroring the services index's `updatedAtTicks` / `IsIndexDocCurrentAsync` guard.

**It cannot be copied.** `ProviderSearchIndexer` stores `UpdatedAtTicks = profile.UpdatedAt.Ticks` — the **BusinessProfile's** version, ONE source — while the projection is built from **~8** sources. A service change rebuilds the provider document **without moving `profile.UpdatedAt`**, so a guard keyed on it would skip those rebuilds and leave `serviceCount`, `fromPrice`, `categories` and the completeness scores **stale in live search results**. That is a correctness regression, far worse than the RU cost it saves.

It would also do **nothing** for the launch problem: during a bulk import every change genuinely IS newer, so the guard never fires.

Safe variants, if it is ever revisited: a new provider-index field carrying a true projection version (**§0.7 schema gate**), or a per-instance in-memory dedupe keyed on a max-source-version threaded through from the change feed. **Neither is in scope for Phase 5.**

### The knowledge reconciliation sweep — owner declined
A periodic job comparing stored `PassageCount` against a live index count was proposed and **explicitly declined**. The standing operational rule replaces it: **after ANY knowledge index rebuild, reindex every document.** Do not build the sweep.

---

## 5. WHAT THE PREVIOUS SESSION SHIPPED — complete, verified, uncommitted

All of this is **done, tested and green**. Do not redo it. It is uncommitted in the working tree.

### 5.1 Dead alert flag + the guard against that whole class
- `EnableKnowledgeIngestFailureAlerts` was declared in `AdminAlertSettings`, defaulted true, present in `appsettings.json` — and **read by nothing**; the call site passed `forceAdminAlert: true`. Now wired: `KnowledgeIngestProcessorFunction` takes `IOptions<AdminAlertSettings>` and passes `forceAdminAlert: _alertSettings.EnableKnowledgeIngestFailureAlerts`.
- Root cause of the miss: the existing `AdminAlertSettingsConventionTests` checked class↔appsettings **symmetry and defaults**, which says nothing about whether a gate is **wired to anything**.
- Added `EveryAlertGate_HasAtLeastOneRuntimeReader` to that file — reflects over every bool gate, scans `Clinqet.Communications` source (its OWN repo only, §0.17), asserts a non-empty sweep, fails naming any orphan. **Sabotage-proven.**
- ‼️ **Phase 5 must add its new gate to `AdminAlertSettings` AND `appsettings.json` AND wire a real reader — all three, or this test fails the build.**

### 5.2 Change-feed stall alert — the silent-stall hole
- New `ChangeFeedStallDetector` (`Clinqet.Communications\Services\`, singleton, thread-safe via `Lock`, per-processor state in a `ConcurrentDictionary`).
- **Why:** every per-document alert path in `SearchIndexSyncFunction` (`failedServices`, `failedBusinesses`, `failedProviderDocs`, degraded legs) runs **INSIDE the try, AFTER the batch body**. A batch that **THROWS** reaches none of them; the lease is never checkpointed and the same batch replays **forever, in total silence**.
- **Proven live 2026-08-18:** CA sat on one LSN (3201) for hours, its lease renewing every 60s while the continuation never moved. Services frozen at 566, three `Active` businesses with no provider document, and **zero alerts**. Found only by reading lease documents out of Cosmos by hand.
- ‼️ Also discovered: the batch-level `ChangeFeedFailureMessage` carries `firstBusinessId` and **no `DocumentId`**, so `ChangeFeedFailureReplayFunction` reindexes that ONE business and **completes** — masking a whole-batch failure as a single-business repair. That is why it stayed invisible.
- Design: alerts on **consecutive** failures (`SearchIndexEnrichment:StallAlertAfterConsecutiveFailures`, default 3) — a lone transient throw self-heals on the next retry and must stay silent. Then **suppressed** for `StallAlertSuppressionMinutes` (default 30) so an endless retry loop produces ONE alert. A successful batch clears both streak and suppression.
- New `AdminAlertType.ChangeFeedBatchStalled` (Critical), gated by `EnableChangeFeedStallAlerts`, surfaced in the admin `AlertsPage.jsx` with a deep link to `/system-monitoring`.
- 11 detector unit tests + a **wiring test** (`ARepeatedlyThrowingBatch_RaisesTheStallAlert`) that feeds malformed JSON so the batch throws. **Both sabotage-proven** — removing the catch's call makes the wiring test fail.

### 5.3 Admin knowledge repair — including the FAQ hole
- `KnowledgeIndexHealthDto` (new, `clinqetshared\DTOs\Knowledge\`): `DocId`, `DocName`, `Status`, `SourceKind`, `FailureReasonKey`, `StoredPassageCount` (`int?`), `IndexedCardCount` (`int?`), `IsDrifted`.
- `IKnowledgeManagementService` + `KnowledgeManagementService` gained `ReindexAsync`, `ReindexAllAsync`, `GetIndexHealthAsync`, and `internal static bool IsDrifted(status, stored, indexed)`.
- `SearchAdminController` gained `GET knowledge-health/{businessId}`, `POST reindex-knowledge/{businessId}`, `POST reindex-knowledge/{businessId}/{docId}` (all `[Authorize(Roles = "Admin")]`).
- Admin UI: knowledge section in `SearchOperationsPanel.jsx` (per-document table with stored vs live counts and a drift flag, per-doc Reindex + Reindex-all) and three functions in `monitoringService.js`.
- 18 unit tests in `Clinqet.API.UnitTests\Services\KnowledgeAdminReindexTests.cs` (§0.18: the API host is the runtime consumer). **Sabotage-proven.**

**The invariants behind that work — carry them forward:**
- ‼️ **`Ready` means "an ingest ONCE succeeded", never "searchable now".** The ingest path genuinely cannot produce Ready-over-zero-cards: empty extraction → Failed, zero substance cards → Failed, partial embeddings → throws, partial card upload → rolls back and still throws, and cards are written **before** the status flip (with a tombstone CAS re-read immediately before it). But nothing re-validates afterwards, so an index rebuilt **out of band** leaves every row saying Ready over nothing.
- ‼️ **A typed FAQ was UNRECOVERABLE.** `ReprocessAsync` returns `NotFound` for anything that is not `SourceKind.File`; a FAQ has no blob and never rides the ingest queue. `ReindexAsync` routes files through `ReprocessAsync` and rebuilds a FAQ inline via the same three steps an edit runs.
- ‼️ **Never raw-enqueue a repair.** `ReprocessAsync` clears `ContentHash`; skip that and the identical-content short-circuit makes the whole repair a **silent no-op that reports `Ok`**.
- Concurrency needed no new lock: the CAS refuses a second run while `Processing`, and the deterministic ingest `messageId` (`business:doc:updatedAtTicks`) dedupes identical sends — so a provider's *Try again* racing an admin's *Reindex* is one run, never two.
- `ReindexAllAsync` is **sequential** (a FAQ embeds inline and each ingest re-reads the per-business passage cap) and reports **per document** — a partial repair that reads as success is how a broken document stays broken.
- `GetIndexHealthAsync` probes at **bounded** concurrency (8) writing **by position** — an audit finding: the first version was an unbounded `Task.WhenAll` that would have aimed ~200 simultaneous queries at the search service live traffic uses.

### 5.4 Files changed (uncommitted, all green)
```
clinqetapi            M Clinqet.API/Controllers/Admin/SearchAdminController.cs
                      M Clinqet.API.UnitTests/Controllers/Admin/SearchAdminControllerTests.cs
                      ?? Clinqet.API.UnitTests/Services/KnowledgeAdminReindexTests.cs
clinqetfuncations     M Clinqet.Communications/Functions/KnowledgeIngestProcessorFunction.cs
                      M Clinqet.Communications/Functions/SearchIndexSyncFunction.cs
                      M Clinqet.Communications/Program.cs
                      M Clinqet.Communications/appsettings.json
                      ?? Clinqet.Communications/Services/ChangeFeedStallDetector.cs
                      M Clinqet.Communications.UnitTests/Conventions/AdminAlertSettingsConventionTests.cs
                      M Clinqet.Communications.UnitTests/Functions/SearchIndexSyncFunctionTests.cs
                      M Clinqet.Communications.UnitTests/Knowledge/KnowledgeIngestProcessorFunctionTests.cs
                      ?? Clinqet.Communications.UnitTests/Services/ChangeFeedStallDetectorTests.cs
                      M Clinqet.Communications.IntegrationTests/Tests/Functions/SearchIndexSyncFunctionIntegrationTests.cs
clinqetinfrastructure M Services/Knowledge/KnowledgeManagementService.cs
clinqetshared         M Enums/AdminAlertType.cs            (appended ChangeFeedBatchStalled)
                      M Models/AdminAlertSettings.cs       (appended EnableChangeFeedStallAlerts)
                      ?? DTOs/Knowledge/KnowledgeIndexHealthDto.cs
clinqetcore           M Interfaces/Knowledge/IKnowledgeManagementService.cs
clinqetwebadmin       M src/pages/alerts/AlertsPage.jsx
                      M src/pages/system/SearchOperationsPanel.jsx
                      M src/services/monitoringService.js
```
SKILLs updated in **all four** AI-tool directories (`clinqet-voice-assistant`, `clinqet-search-discovery`), memory entry written (`knowledge-admin-repair-and-stall-detector-2026-08-18.md` + MEMORY.md pointer).

### 5.5 Verified state at handover
- **Unit tests: 12,520 passing, 0 failed, 0 skipped** — API 9,445 · Functions 2,331 · MCP 653 · cosmosindexsetup 91.
- All four hosts build with 0 errors. All three integration test projects compile (unrun — they need Testcontainers).
- ESLint clean on every changed admin file.
- Tree clean of scratch files; the scratchpad probe tool was deleted.
- **Nothing is half-built.** The debounce was never started.

---

## 6. LIVE ENVIRONMENT STATE (as of handover, 2026-08-18)

Both regions rebuilt and healthy:

| Index (alias → physical) | CA | IN |
|---|---|---|
| `clinket-dev` → `clinket-dev-v1` | 790 docs | 79 docs |
| `clinket-providers-dev` → `clinket-providers-dev-v1` | 4 of 4 | 14 of 14 |
| `clinket-knowledge-dev` → `clinket-knowledge-dev-v1` | 0 | 0 |

- Binary quantization + MRL confirmed live on both vector indexes: `truncationDimension: 1024`, `enableRescoring: true`, `defaultOversampling: 10`, `rescoreStorageMethod: preserveOriginals`. The provider index has **zero vector fields**, so no compression applies there — correct by design.
- ‼️ **Aliases resolve for queries ONLY on preview/newer api-versions.** `2023-11-01`, `2024-07-01` and `2025-09-01` all return *"index not found"* for an alias name; `2024-11-01-preview`, `2025-05-01-preview` and `2026-04-01` work. `Azure.Search.Documents` **12.0.0** (shared via `clinqetcore`, so every host) defaults to `2026-04-01`, so the runtime is fine — but any manual `curl` check must use `api-version=2026-04-01` or it reports a false "index missing".
- Change-feed lease prefix was changed from `providerdata-unified` to `providerdata` (owner did this in the deployed env vars). Key: `CosmosDb:ChangeFeed:ProviderDataUnifiedLeasePrefix`, consumed only by `SearchIndexSyncFunction.cs:205`, `StartFromBeginning = true`.
- Knowledge index is empty in both regions; every knowledge document needs a reindex (the new admin endpoint does this).
- `cosmosindexsetup` was run fully for both regions. A bug in it was found and fixed during the run: `EnsureNameIsFreeOfIndexAsync` used `GetIndexAsync(name)` to test whether a real index held a name, but **Get Index resolves aliases** (returns 200 with the physical name), so the tool was non-idempotent and its own error message advised `--recreate-aliases`, which would have **deleted the live index behind the alias**. Fixed + regression test, already committed by the owner.

---

## 7. THE WORK — Phase 5 implementation checklist

1. **Read first, per §0.13 and Zero Assumptions.** `SearchIndexSyncFunction.cs` end to end, `ProviderSearchIndexer.cs` end to end, `ServiceBusService.SendScheduledMessageAsync`, `CartService.cs:490` as the scheduled-message precedent, `ChangeFeedStallDetector.cs`, `FailureNotificationHelper`, `azureautomation/events.json` + `deploy.ps1` queue wiring, and the `clinqet-search-discovery` + `clinqet-deployment` SKILLs.
2. **Confirm the gate in §3 with the owner**, then proceed without further asking.
3. **New Service Bus queue** + ARM (`events.json`) + `deploy.ps1` app-setting entry for its name, in the SAME change (§25). Queue name follows the existing convention (`$queueSuffix`).
4. **Change the change-feed side:** replace the inline `ProcessProviderIndexAsync` call with a debounced scheduled send per `businessId`, `messageId = providerprojection:{businessId}:{unixMinute}`, delay from settings.
5. **New processor function** consuming that queue → `ProviderSearchIndexer.UpsertProviderDocumentAsync`. Idempotent (§9). Session-enabled is not required — the deterministic messageId already collapses the burst.
6. **Alerting:** new gated flag in `AdminAlertSettings` + `appsettings.json` + a real reader; admin alert on FINAL delivery for ANY failure; **re-establish the `ProviderDocument` failure alert path that lives in `SearchIndexSyncFunction` today** so it is not lost in the move.
7. **Settings:** delay and any threshold in `appsettings.json` with class defaults mirroring exactly (§0.12). No magic numbers.
8. **Tests (§8 of the standards + §0.18):**
   - Unit tests in `Clinqet.Communications.UnitTests` (the Functions host is the runtime consumer of both the change-feed side and the new processor).
   - Integration tests in `Clinqet.Communications.IntegrationTests`.
   - Cover: burst collapses to one rebuild · the messageId is time-bucketed and stable within a window · a later edit after the window produces a NEW rebuild (the PT10M trap) · processor idempotency on redelivery · failure on final delivery alerts, non-final does not · the gate disables the alert · a non-`Active` profile still results in document removal · cancellation · null/empty payloads · the alert path moved from `SearchIndexSyncFunction` still fires.
   - **Sabotage-prove** the burst-collapse test and the alert test.
9. **Verify:** build every affected project, run affected suites to 100% (build first, never `--no-build` on stale binaries), ESLint zero errors if any UI is touched.
10. **Update the SKILLs in all four AI-tool directories** (`clinqet-search-discovery`, and `clinqet-deployment` for the new queue) and add/update the memory entry (§0.9).
11. **Leave the tree clean** and LOOK at `git status --porcelain` in every repo touched (§0.16).

---

## 8. MANDATORY CLOSING AUDIT — no compromise

After the work is complete, run a **full end-to-end, extremely detailed, multi-dimensional audit of every line changed in this session**, and FIX everything it finds:

- **Bugs** — every logical pathway, not the happy path.
- **Missing functionality** — anything specified above that is not actually wired.
- **Memory / CPU / resource leaks** — disposal, unbounded collections, unawaited tasks, timers.
- **Thread safety** — the processor and any shared state; concurrent invocations of the same business.
- **Logic and flow gaps** — what happens on redelivery, on cancellation, on a poison message, on a queue outage, on a Cosmos outage mid-rebuild.
- **Security** — cross-tenant isolation (a message must never project a business it does not name), authorization on any new surface.
- **Cost and performance** — prove the reduction with numbers; confirm no new unbounded fan-out.
- **Governance** — §0.7 schema gates, §4 config hygiene (**every new setting has a real runtime reader** — the convention test enforces it), §0.10 localization, §0.12 class defaults mirroring appsettings, §0.14 comments, §0.16 clean tree, §0.18 test placement, §25 ARM + `deploy.ps1` parity.

Report findings honestly, including anything you could not verify. **If the audit surfaces something that needs an architectural decision or owner input, STOP and ask — do not decide alone.**

---

## 9. AFTER PHASE 5 — the remaining open items (not in scope, for context only)

- **O-1** RetrievalTopK / RetrievalMaxTokens tuning · **O-2** search tier for millions of documents · **O-4** proactive un-enriched sweep scope · **O-5** `AddResilientConsole` duplicate telemetry · **O-6** confirm gpt-5.4-mini quota in the portal · **O-7** deferred with the scale work.
- Re-run `voice-answer-ladder/poc/quant-ab.js` now that the indexes are rebuilt and populated.
- Run the integration suites (they compile but need Testcontainers up).
- `clinqetmobilepartnerapp` `npm ci` fails with `ERESOLVE` — a genuine peer conflict introduced by commit `c4662ce4`, which added `@react-native-community/push-notification-ios` to `package.json` without the lockfile. Needs a version decision from the owner.
- The three web repos still float `node-version: lts/*` in CI (owner's explicit preference — do not pin without being asked). The partner-web lockfile drift that broke CI was already fixed and committed.
