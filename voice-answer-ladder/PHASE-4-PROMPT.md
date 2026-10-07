# PHASE 4 — KNOWLEDGE INGEST + SEARCH-INDEX RESILIENCE FIX PACK

> ‼️‼️ **IF THIS DOCUMENT IS UNCLEAR, INCOMPLETE, OR CONTRADICTS ITSELF — STOP AND ASK THE OWNER.**
> **Never resolve a conflict by picking whichever reading looks more likely. Never fill a gap with an assumption.**
> A wrong guess here becomes wrong production code. Asking costs one message. See **§0.4**.

> **This file is the complete, self-contained work order.** Everything analysed, measured, decided and
> still open in the 2026-08-17/18 investigation session is written down here. You do **not** need that
> session's transcript. Read this file end to end, then `INCIDENT-AND-FIX-RECOMMENDATION.md` (the
> evidence), then `PLAN.md` §7 (the knowledge-base contract), then the code — before writing anything.
>
> **Nothing in this fix pack has been implemented yet. The tree is clean. Zero code was changed.**

---

# 0. MANDATORY STANDARDS — READ BEFORE ANY CODE

## 0.1 Owner's system instructions (verbatim, non-negotiable)

**CORE DIRECTIVES (the "ZERO" rules)**
- **Zero assumptions.** Do not assume context. Read and analyse the entire relevant codebase thoroughly,
  regardless of its size, to gain full clarity before writing a single line of code.
- **Zero hallucinations.** Only output factual, verified code and configuration. Every file path, symbol,
  setting key, enum value and endpoint you cite must exist — verify with Glob/Grep/Read first.
- **Zero workarounds.** Never use shortcuts, hacky fixes or temporary workarounds. Industry best practice
  only. If the correct solution is hard, write the correct solution anyway.
- **Plan first.** Analyse thoroughly, form a solid architectural plan, then execute.

**PRE-PRODUCTION FREEDOM & REFACTORING**
- No legacy constraints. Never write backward-compatible code, workarounds or backfilling logic to support
  older structures. If a massive refactor is the architecturally correct solution, execute the refactor.
- Assume data can be dropped and recreated at any time. Focus entirely on the best end state.

**BACKEND & INFRASTRUCTURE**
- Maximum performance. Hyper-optimised, efficient, production-ready.
- Concurrency & safety: multi-threading and async where optimal, but **100% thread-safe**.
- Resource mastery: explicit deallocation the moment an object is no longer needed. **ZERO memory leaks,
  ZERO CPU leaks, ZERO resource exhaustion.**
- Watertight logic: zero gaps, zero bugs, every logical pathway covered.

**FRONTEND & UI ENGINEERING**
- Strict alignment with the existing theme, design system and component structure. Build on it; never deviate.
- Mobile-first responsiveness — flawless on phone and iPad (primary user base).
- Crisp UX and routing: smooth, fast, lightweight.
- API optimisation: strictly prevent redundant or duplicate API calls.
- **Mockups for new views:** a brand-new page or interface gets an isolated HTML mockup under
  `C:\Nik\mockups\` for visual approval BEFORE any integrated UI code.

**EDGE CASES & RESILIENCE**
- Never limit scope to the happy path. Anticipate, explore and handle every possible edge case.
- Fail-safes for network errors, latency, null states, missing data, broken connections — frontend and
  backend. The solution must survive all of them gracefully.

**COMMENTING & DOCUMENTATION**
- High signal-to-noise. Comments ONLY for critical architectural context or the non-obvious "why".
- Absolutely no redundant, obvious or verbose comments. Let clean code speak.

**OPTIONS & DECISION MAKING**
- When presenting multiple solutions, ALWAYS highlight the strongly recommended option and give the "why".

## 0.4 ‼️ NO ASSUMPTIONS — WHEN IN DOUBT, ASK. THIS IS NOT OPTIONAL.

**Two defects in THIS document were caught only because the owner asked a question. Both would have shipped as
wrong code.** They are the reason this section exists.

| Real case from this programme | What went wrong | What should have happened |
|---|---|---|
| **Phase G said `scalarQuantization`; D-13 and §3.4 said `binaryQuantization`** | A paraphrase written under an earlier decision was never updated when the evidence moved. Following Phase G would have built **the wrong compression, with MRL missing entirely** | **Notice the contradiction and ASK** — do not pick the one that reads more confidently |
| **"Fetching a provider's services is a filter-only query"** | Written as a statement of current behaviour. `ProviderCatalogSearchService` actually issues a **vector** query (`ExecuteVectorSearchAsync:390`, `VectorizedQuery:407-413`). **The file was never opened before the claim was made** | **Open the file. A claim about behaviour needs a `file:line`, or it is a PROPOSAL — not a fact** |

### The rule

1. **A claim about what the code does needs a `file:line`.** If you cannot produce one, you are proposing, not
   describing. Label it as a proposal or go and read the file.
2. **If two parts of this document disagree — STOP AND ASK.** Do not reconcile it yourself, do not average them,
   do not follow the more detailed one. **A contradiction in the plan means the plan is wrong, and only the owner
   can say which half.**
3. **If something is missing — STOP AND ASK.** An unstated setting name, an unnamed file, an unspecified value.
   **Do not invent a plausible one.**
4. **If a number has no source — treat it as unverified.** §13 lists every soft claim in this plan. If you rely on
   one, say so in the audit. **Never promote an estimate to a fact by restating it confidently.**
5. **If the work seems to require something §15 forbids — STOP AND ASK.** It means scope has drifted.
6. **If a §0.7 gate might apply — STOP AND ASK BEFORE writing the code or the migration.** A plan document saying
   "add X" is **not** approval.

### Where the truth lives when sources disagree

| Topic | Single source of truth |
|---|---|
| The compression configuration | ‼️ **§3.4 — and nothing else.** Every other mention is a paraphrase and may be stale |
| What the code currently does | ‼️ **The code.** Not this document, not a SKILL, not a memory entry |
| Azure behaviour | `learn.microsoft.com` **documentation** beats a Microsoft **blog**, which beats independent research, which beats our own reasoning (§3.3) |
| What is in scope | **§11 status board** and **§15's do-not list** |
| What is soft / unproven | **§13** |

‼️ **Asking costs one message. A wrong assumption costs a production defect, and this programme has already
produced two of them on paper. There is no penalty for asking and no credit for guessing.**

## 0.2 CLAUDE.md rules that bite this fix pack specifically

Read `C:\Nik\CLAUDE.md` in full. These apply directly:

| § | Rule | How it binds here |
|---|---|---|
| **§0.7** | **ANY schema change — SQL or Cosmos — needs owner approval FIRST.** Cosmos includes **a new field on any entity**; Search includes **a new index field / analyzer / scoring-profile change** | The quantization work IS a Search schema change — **already approved, see §3 D-13**. **Nothing else here needs a new field.** If you discover you need one, STOP and present the §0.7 table |
| **§0.7.1** | Mockup gate · **mobile mirrors web in the SAME session** · no hardcoded user-facing text · no new queue/container/setting without ARM + `deploy.ps1` · no cross-partition Cosmos query · every `IMemoryCache` write sets `Size = 1` · never retro-edit an applied EF migration | All of it. Especially mobile parity and `Size = 1` |
| **§0.8 / §23** | Unit **and** integration tests mandatory for every new endpoint, repository method, service path, function handler and significant frontend flow. 100% pass. Integration tests are **MANDATORY** for money / schema / unique index / atomic counter / webhook / Service Bus processor paths | The ingest processor, the embedding batcher and the admin resync endpoints all qualify |
| **§0.9** | New/significantly-modified functionality ⇒ update the SKILL.md in **all four** AI-tool directories + a memory entry | `clinqet-voice-assistant`, `clinqet-search-discovery`, `clinqet-infrastructure`, `clinqet-function-app`, `clinqet-notifications`, `clinqet-admin-app` |
| **§0.10** | No hardcoded user-facing text. Localization keys only, in `en.json` **and every other language file** | New notification + failure strings |
| **§0.11 / §0.12** | Performance and cost are first-class. Use appsettings + enums; no magic numbers. Options-class defaults MUST mirror `appsettings.json` | Every new knob |
| **§0.14 / §22.3** | **NO verbose comments.** Default is NO comment. One short line max, only for a non-obvious WHY / invariant / gotcha / spec reference. Never narrate WHAT the code does | Zero tolerance |
| **§0.15 / §0.17** | Peer host projects never reference each other. **A test may only read paths inside its own repository root.** `describe.skip` still runs its body — peer reads must sit INSIDE `it()` | Test placement |
| **§0.16** | **Leave the tree clean.** Delete every scratch artefact. Never write a scratch file inside a repo. `git status --porcelain` must be clean of your scratch files, and you must LOOK at it | Also applies to cloud artefacts — delete any temp Azure index you create |
| **§0.18** | **Test placement follows the RUNTIME CONSUMER.** A library class is tested from the suite of the HOST that invokes it | See §6 |

## 0.3 Repository layout reality

Every project under `C:\Nik` is **its own git repository**. They share a folder on this dev machine and
nothing else. CI checks out ONE repo. `..` is empty there. Never write a test that reads a peer repo.

---

# 1. THE INCIDENT — WHAT HAPPENED AND WHY

`toromont_machines.json` (792,707 bytes) was uploaded to AI Knowledge on 2026-08-17 22:09.
Business `SX3SG2`, doc `9d7694dda1ad432c917d9c4bb09a8ee0`. The row settled **Failed** with
`Error_KnowledgeGenericRetry` ("Something went wrong while reading this file. Try again."), at
DeliveryCount 4 of 5.

**Root cause: one unbounded embedding request. Not a quota problem.**

The pipeline was replicated faithfully off the real file (`ParseJson` → `NormalizeText` →
`SplitSentences` → `CardBuilder`, live settings `ChunkTargetTokens 350 / ChunkMaxTokens 512 /
ChunkMinTokens 120 / ChunkOverlapPercent 15`). Measured:

| Stage | Measured |
|---|---|
| Raw upload | 792,707 bytes |
| `TryFlattenJson` output | **1,018,661 chars** across 24,570 `path: value` lines |
| After `NormalizeText` (every newline → space) | 1,018,619 chars — **one single-line blob** |
| Sentences found | **111** for a 1 MB document |
| Of those, over `ChunkMaxTokens` | **55** ⇒ 55 `Oversize sentence split at word boundaries` warnings |
| Cards produced | 538 + 1 `DocSummary` = **539** |
| D25 overflow gate (2000 × 1.10 = 2200) | **passed** — 539 < 2200 |
| The single embed request | **539 inputs, ~1,103,872 chars, ~275,968 estimated tokens** |

> The Azure portal showed only 25 warnings because the Invocation-details pane truncates the trace list.
> There were 55.

**Why it could never succeed.** Azure `/embeddings` documented hard limits: **8,192 tokens per input**,
**2,048 inputs per array**, **300,000 aggregate tokens per request** (HTTP 400 above that). `chars/4` is
the codebase's own estimator (`KnowledgeChunker.ApproxTokens`); real BPE tokenisation of
bracket/CAPS/digit-dense text runs materially higher, so the request sits at or over the 300K aggregate
cap **and fails with HTTP 400 for that reason alone**.

‼️ **CORRECTED — an earlier version of this section was WRONG about the rate limiting.** It claimed Azure admits
~TPM/6 per a 10-second token window, making the request "3.3x the whole window". **No such rule exists** (U-5,
refuted — see §3.6). Microsoft document TPM as a running estimated-token counter **reset each minute**; the
1-/10-second burst logic applies to **RPM**, not TPM. The real reasons this request could not succeed:

1. **It sits at or over the 300,000-token aggregate per-request cap** ⇒ **HTTP 400**, a hard protocol limit
   entirely separate from quota.
2. Even under that cap it would spend **more than half of an entire minute's token budget in one request**,
   while ten other consumers share the same deployment.
3. Azure's rate-limit token accounting is **character-based and approximate**, and Microsoft state it can
   throttle **earlier** than an exact tokenizer count would suggest.
4. For Standard pay-as-you-go the **effective** limit can be temporarily **lower than the configured TPM**
   under capacity pressure — visible as `x-ratelimit-limit-tokens` < configured TPM.

**The conclusion is unchanged — no quota value fixes this and the batch must be token-bounded in code — but the
justification is the 300K protocol cap plus fair sharing, NOT a fabricated 10-second token bucket.**

**Why the retry made it worse.** `AzureAIFoundryEmbeddingService.BuildResiliencePipeline()`: 3 attempts,
exponential base 1 s with jitter → observed **0.82 s, 1.25 s, 1.53 s**. Azure's body said *"Please retry
after 40 seconds."* `Retry-After` / `retry-after-ms` is **never read**, and 429 is grouped with
408/500/502/503/504 on the same sub-second schedule. Four rejected requests in four seconds against an
already-throttled deployment, then hard failure — and the whole document (extraction, the D11
`{title,summary,language}` LLM call, every image caption) is re-paid on the next delivery.

**Contrast, and the standard to copy:** `AICompletionService` (the enrichment LLM client) **already
honours `Retry-After`** via `GetRetryAfterDelayMs`. Two AI clients in one codebase, one correct and one
not. This fix brings the embedding client up to the standard the other already sets.

---

# 2. EVERY FINDING (verified — cite these, do not re-derive from scratch)

## 2.1 One embedding deployment, eleven consumers

`text-embedding-3-large` on `clinket-ai-foundry-v4-nonprod-eastus2` is shared by every embedding caller
with ONE TPM/RPM budget:

| Lane | Consumer | Host | Request shape |
|---|---|---|---|
| **LIVE** | `AzureSearchQuery` — customer search | API | 1 input |
| **LIVE** | `ProviderKnowledgeSearchService` — voice `search_knowledge` (1.6 s budget) | MCP | 1 input |
| **LIVE** | `ProviderCatalogSearchService` — voice catalog | MCP | 1 input |
| **LIVE** | `BroadcastMatchingService` / `BroadcastClassificationService` | API | 1 input |
| LIVE-ish | `QueryUnderstandingService` refusal phrases (cached `NeverRemove`) | API | small batch |
| Interactive | `KnowledgeManagementService.IndexFaqCardsAsync` | API | 1–few |
| **BULK** | `KnowledgeIngestProcessorFunction` | Functions | **unbounded** |
| **BULK** | `SearchIndexSyncFunction` change feed | Functions | 500 items/invocation, **24-way parallel** |
| **BULK** | `VectorEmbeddingRecoveryService` timer | Functions | 50/batch, ≤500/run, then forces reindex |
| BULK | `CategoryEmbeddingService` | API + Functions | hardcoded `batchSize = 50` (§0.12 violation) |

For the ~40 s the deployment was throttled, **every customer search and every live voice retrieval lost
its vector leg.** They degrade correctly and silently, so it never surfaces as an incident — only as
quietly worse answers. `host.json` `sessionHandlerOptions.maxConcurrentSessions: 8` means eight
businesses can ingest at once, multiplying the pressure by 8.

## 2.2 The chunker warning is a symptom of a real quality defect

1. `ParseJson` flattens the whole file into **one `Paragraph` block**.
2. The chunker's `Paragraph` branch calls `NormalizeText`, which **collapses every newline to a space** —
   destroying the only record boundaries the flattener produced.
3. The splitter then falls into §7.8b **case 6** — the only mid-sentence cut in the whole contract — 55 times.
4. Cards straddle **2–5 machines mid-record** ⇒ muddled embedding centroids ⇒ bad retrieval. This is the
   exact failure PLAN §1.1 exists to fix.
5. Cost: the `records[123].` prefix repeats on ~40 lines per record — **~520 wasted chars per record,
   ~13% of the flattened document** — embedded and stored. And 538 cards is **27% of the 2,000-passage
   business budget** for one file.

**The trap is shared, not JSON-specific.** Verified sweep of every parser path:

| Path | Structure preserved? | Exposure |
|---|---|---|
| `.xlsx` → `ParseXlsx` | **YES** — Heading (sheet name) + one **Table block** per sheet | ✅ safe — **the precedent that makes D-04 consistent, not novel** |
| `.docx` → `ParseDocx` | **YES** — one small Paragraph per Word paragraph, + Heading/List/Table/ImageMarker | ✅ safe |
| `.json` → `ParseJson` | **NO** — one Paragraph for the whole file | ❌ the incident |
| `.txt` containing JSON → `ParseText` | `TryFlattenJson` is tried **first** ⇒ identical path | ❌ **the same bug, second entry point** |
| `.txt` → `ParseText` | splits on `\n\n` only; single-newline files become one Paragraph | ⚠️ same trap |
| `.html`/`.htm` → `ParseHtml` | `<table>`/`<ul>`/`<ol>`/`<p>`/`<pre>` map correctly; a one-big-`<div>` page hits the `#text` branch | ⚠️ same trap |
| `.pdf`, images → `ParseLayoutMarkdown` (DI) | headings native, `<table>` → Table, fences → Preformatted; a **blank line** ends a paragraph | ⚠️ DI markdown with no blank lines ⇒ one huge Paragraph |
| `.md` → `ParseLayoutMarkdown` | same | ⚠️ same |

## 2.3 Provider-facing silence

- `POLL_SCHEDULE_MS = [20000, 45000, 90000, 180000]` (`knowledgeMeta.js`) ⇒ the page watches for
  **5 m 35 s** then stops and offers Refresh. A failing document can churn **5 deliveries × up to 480 s ≈
  40 minutes**. A provider who navigates away is never told anything.
- There is **no `NotificationType`** for knowledge. Nothing is dispatched on Ready or Failed.
- Admin side fires only on the FINAL delivery, as generic `AdminAlertType.SystemError`.
- **Related defect:** `TryMarkFailedAsync` writes `Failed` on **every** attempt, so the row reads
  "Failed — Try again" while a retry is still queued.
- Try-again itself is safe: the enqueue messageId is `{businessId}:{docId}:{row.UpdatedAt.Ticks}`, so
  duplicate detection (10-min window) does not swallow it.

## 2.4 The search-index path — NO BUG in the reuse logic (verified)

| Concern | What the code does | Verdict |
|---|---|---|
| Does changing an address re-pay the LLM? | `EnrichmentContentHash` = SHA-256 of **name + category + subcategory + description + prompt version** only. Address/price/availability/offer/tier/rating do not change it | ✅ zero LLM cost |
| Does it re-embed on an unrelated edit? | `EmbeddingContentHash` = SHA-256 of the exact embedding input; reused only if it matches AND the stored vector has the right dimension count | ✅ |
| Could a FAILED enrichment be cached as "done" forever? | `AzureSearchIndexer.cs:1260` — `EnrichmentContentHash = HasEnrichmentContent(aiEnrichment) ? enrichmentInputHash : null`. **null on failure.** The reuse branch also independently re-checks `HasEnrichmentContent(stored)` | ✅ **poison-proof twice over** |
| Could a FAILED embedding's zero-vector be reused forever? | `EmbeddingContentHash = hasEmbedding ? embeddingInputHash : null`. **null on failure** — decisive, because a zero-vector DOES have 3072 entries so the dimension check alone would have passed | ✅ **trap already closed** |
| Duplicate LLM spend across 100 similar services | `_enrichmentCache` keyed by **content hash, not serviceId** (1 h TTL) | ✅ one call |

**Is the batch bug present there? NO.** `AzureSearchIndexer` calls `GenerateTextEmbeddingAsync` — one
input per request. 100 services ≈ 100 small requests ≈ 40K tokens total. Its shape is *concurrency*
(24-way × 500 items/invocation), not batch size.

**The retry ladder, end to end (7 layers):**
1. **Enrichment LLM** — `AICompletionService`: 3 attempts, honours `Retry-After` (clamped to 30 s), else
   1 s × 2^attempt capped at 10 s. On final failure returns an **empty** enrichment, records a failure in
   `AiEnrichmentFailureTracker`, publishes the doc un-enriched with `EnrichmentContentHash = null`.
2. **Embedding** — no retry beyond the embedding service's own 3 sub-second attempts. On failure publishes
   a **zero-vector + `HasEmbedding = false`** + `SearchIndexHydrationFallback` alert (High,
   cooldown-keyed), `EmbeddingContentHash = null`.
3. **Search upload** — `Search:Indexer:Retry` (3 attempts, 2 s base) + circuit breaker
   (`ConsecutiveFailures: 5`, `DurationSeconds: 60`) + per-document poison isolation.
4. **Document level** — `SearchIndexSyncFunction.ExecuteWithRetryAsync`: `MaxDocumentRetries = 2`
   (3 attempts), `RetryBaseDelayMs = 500` × 2^attempt, only for `IsTransientException`
   (`TimeoutException` / `HttpRequestException` / a message containing `HTTP 429`, `HTTP 5`, or
   `after maximum retries`).
5. **Still failing** — a `ChangeFeedFailureMessage` goes to the `change-feed-failures` queue, and
   `ChangeFeedFailureReplayProcessor` **re-reads the service from Cosmos and re-indexes it** (hashes
   apply, so a replay pays only for real changes).
6. **Deletes** — `SearchIndexDeleteFailureException` propagates so the change-feed lease retries the batch.
7. **Vector sweep** — `VectorEmbeddingRecovery` timer: `hasEmbedding eq false and isActive eq true and
   isListed eq true`, `BatchSize: 50`, `MaxDocumentsPerRun: 500`, forces reindex.

‼️ **But layers 1 and 2 never reach the document-level ladder** — they swallow their failure and publish a
degraded document. Only search-upload / Cosmos / network failures reach layers 4–5.

## 2.5 The four search-index gaps

| # | Gap | Severity |
|---|---|---|
| **S1** | **Cross-lane starvation.** An unpaced knowledge ingest 429s the shared deployment; a provider-setup change feed in that window publishes up to **500 service docs with `hasEmbedding = false`**, invisible to vector search until the timer sweeps (≤500/run). A *different* provider's upload silently kills a new provider's whole catalogue | **HIGH** — fixed by D-01/02/03 |
| **S2** | **A throttle and an outage are indistinguishable.** `GenerateTextEmbeddingAsync` returns the same `[]` sentinel for "429, retry in 40 s" and "provider is down", so a transient throttle never gets the document retry it deserves | **MEDIUM** |
| **S3** | **Nothing sweeps un-enriched documents.** `VectorEmbeddingRecovery` filters `hasEmbedding eq false` only. Enrichment-failed + embedding-succeeded ⇒ `hasEmbedding = true`, `EnrichmentContentHash = null`, and no sweep looks for it. ‼️ `EnrichmentContentHash` is `[SimpleField]` with **no `IsFilterable`**, and Azure AI Search **cannot make a field filterable in place** | **MEDIUM** |
| **S4** | **The alerts are not appsettings-gated.** `SearchIndexHydrationFallback` and `AIEnrichmentFailureSpike` are gated by **cooldown only**, and live in `clinqetinfrastructure` OUTSIDE the `AdminAlertSettings` regime that `AdminAlertSettingsConventionTests` polices — two gating regimes in one codebase | **LOW correctness / HIGH consistency** |

Plus: `AICompletionService.GetRetryAfterDelayMs` **clamps `Retry-After` to 30 s** (Azure asked 40 s) and
reads only the standard header, not Azure OpenAI's `retry-after-ms`. And `CategoryEmbeddingService` has a
hardcoded `batchSize = 50`.

## 2.6 Admin capability — verified state

- `IAzureSearchIndexer.IndexServiceAsync(serviceId, businessId, forceReindex)` **already exists**.
- `SearchAdminController.cs` exposes `GET admin/search/health`,
  `GET admin/search/provider-visibility/{businessId}`, `POST admin/search/reindex-business/{businessId}`
  — all `[Authorize(Roles = "Admin")]`.
- The admin app calls **only** `/admin/search/health` (`monitoringService.js:12`).
  **`reindex-business` and `provider-visibility` exist in the API with NO UI.**
- There is **no service-level reindex endpoint**.

## 2.6b ‼️ THE COMPLETION DEPLOYMENT HAS THE SAME LANE PROBLEM — the bulk-onboarding scenario

Owner scenario, checked in full: **50 providers each add 100 services via AI onboarding, same day, same city.**
**5,000 brand-new service documents** hit the change feed at once.

‼️ **They are NEW, so no stored `EnrichmentContentHash` / `EmbeddingContentHash` exists to reuse — every one
pays a FULL enrichment LLM call AND a FULL embedding call.** And `_enrichmentCache` is keyed by *content hash*,
so 5,000 distinct services means the cache saves **nothing** here. The reuse guards that make edits free do
not help a cold load at all.

**Verified: `AICompletionService` has NO concurrency limiter and NO pacer** — only its (correct)
`Retry-After`-honouring retry. And **`gpt-5.4-mini` is shared by 15 configured call sites across all three
hosts**, mixing bulk and live work on one deployment budget:

| Lane | Consumer | Host |
|---|---|---|
| **LIVE** | `Voice:ExpertCheck` — on an ACTIVE phone call, 8 s timeout | MCP **and** Functions |
| **LIVE** | `Search:SpellCheck:Llm` — customer search spell correction | API + Functions |
| Interactive | `AIService` (assistant chat) · `AzureDocumentIntelligence:AiDeploymentName` (provider setup) | API + MCP |
| **BULK** | **`SearchIndexEnrichment` — the change feed** | Functions + API |
| Bulk | `ServiceApproval` content + category validation · `VoiceCall:SummaryDeploymentName` · `BroadcastClassification` (+ vision) | Functions + API |

**The amplifier:** `CosmosDb:ChangeFeed:ServiceProcessingMaxConcurrency: 24` × `MaxItemsPerInvocation: 500`.
Twenty-four services enriching **and** embedding concurrently, continuously, for 5,000 documents.

**What breaks today (verified, not projected):**
1. **Embedding 429** ⇒ `GenerateTextEmbeddingAsync` returns `[]` ⇒ the doc publishes with a **zero-vector and
   `HasEmbedding=false`** ⇒ invisible to vector search until the recovery timer sweeps it — and that timer is
   `Search:VectorRecovery:MaxDocumentsPerRun: 500`. With 5,000 affected that is **10+ timer runs** to recover.
2. **Enrichment 429** ⇒ after 3 retries it returns an **empty** enrichment ⇒ the doc publishes un-enriched with
   `EnrichmentContentHash = null` ⇒ **no sweep exists for that at all (gap S3)**. It heals only on the next edit.
3. A live call's `ExpertCheck` (8 s budget) and live search spell-correction compete with the storm and
   **degrade silently**.

‼️ **NOT VERIFIABLE FROM THE REPO — the owner must read it from the Azure portal:** `gpt-5.4-mini`'s TPM/RPM
quota. 5,000 enrichment calls carrying the large `SearchIndexEnrichment:SystemPrompt` with
`MaxCompletionTokens: 8000` is on the order of **~17M tokens** on that deployment. Whether that fits, and at
what pace, cannot be answered without the number. **Ask; do not assume.**

## 2.7 App Insights "Logs" tab — NOT A BUG, NO CODE CHANGE

`host.json:3` sets `"telemetryMode": "OpenTelemetry"`; the worker is correctly wired
(`Microsoft.Azure.Functions.Worker.OpenTelemetry` 1.2.0 + `UseAzureMonitorExporter`, `Program.cs:95-112`).
Microsoft documents for that mode: *"When you configure the host to use OpenTelemetry, the Azure portal
doesn't support log streaming."* · *"The Azure portal supports `Recent function invocation` traces only if
the telemetry is sent to Azure Monitor."* · *"If you set `telemetryMode` to `OpenTelemetry`, the
configuration in the `logging.applicationInsights` section of host.json doesn't apply."*

The function's **Logs** tab *is* log streaming — it connects and never receives a record. The
**Invocations** blade works because telemetry does reach Azure Monitor. Query it instead:

```kusto
traces
| where timestamp > ago(1h)
| where cloud_RoleName == "clinket-functions-ca-v4-dev"
| where operation_Name == "ProcessKnowledgeIngest"
| project timestamp, severityLevel, message, operation_Id
| order by timestamp desc
```

**Do not change `telemetryMode`** — it would cost the distributed tracing the platform deliberately adopted.

**Separate small finding (cost only, pre-dates this work, NOT in scope):**
`builder.Logging.AddResilientConsole()` (`Program.cs:90`) writes to stdout while the worker also exports
the same `ILogger` records via OTel. In OTel mode the host also captures stdout — Microsoft documents this
as a duplicate-telemetry source. Raise it to the owner separately; do not fix it here.

---

# 3. THE MEASUREMENT — QUANTIZATION, RUN AGAINST REAL DATA

Run on the live CA nonprod search service (`https://clinket-search-ca-v4-nonprod.search.windows.net`,
Basic tier, 3/15 indexes, 16 GB storage quota, **5 GB `vectorIndexSize` quota**). Method: the real
`clinket-dev` index definition was cloned into three temp indexes differing **only** in vector
compression; all 790 documents were copied **with their existing vectors** (so compression was the only
variable — no re-embedding, no re-enrichment, no Cosmos writes); the same 20 queries (13 construction +
7 salon, matching the real data mix) were run against all four. **All temp indexes were deleted
afterwards; the service is back to its original 3 indexes.**

> ‼️ **A methodology trap worth remembering:** the first run paged the copy with `$skip` over an
> unordered `search=*` set and silently copied **552 of 790** documents, producing a bogus "81.5% recall".
> `id` is not sortable on this index. The correct method is to enumerate the key set once
> (`top=1000, select=id`) and then fetch by explicit `search.in(id, …)` batches. **Never trust a recall
> number without first asserting the corpus counts match.**

**Index state today:** `clinket-dev` 790 docs · `clinket-knowledge-dev` **0 docs** (the failed Toromont
ingest left nothing — D25 all-in-or-all-out held) · `clinket-providers-dev` 6 docs and **zero vector
fields** (`cosmosindexsetup/Program.cs:624` says so deliberately). **Only two indexes carry vectors.**
Neither has any `compressions` configured (`vectorSearch.compressions: []`, verified live).

**Storage (settled statistics):**

| Config | Vector index | vs today | Bytes/vector | Total storage |
|---|---|---|---|---|
| Uncompressed (today) | 9.929 MB | 1.0× | 13,179 | 41.86 MB |
| **Scalar int8 + preserveOriginals** | **3.346 MB** | **3.0× smaller** | **4,441** | 46.32 MB |
| Binary + preserveOriginals | 0.371 MB | 26.7× smaller | 493 | 43.26 MB |
| Binary + discardOriginals | 0.371 MB | 26.8× smaller | 492 | 33.78 MB |

**Quality — pure vector, top-10:**

| Config | recall@10 | recall@5 | top-1 identical | avg top-1 score delta |
|---|---|---|---|---|
| Scalar + preserve | **100.0%** | **100.0%** | **20/20** | **0.00000** |
| Binary + preserve | **100.0%** | **100.0%** | **20/20** | **0.00000** |
| Binary + **discard** | 68.0% | 63.0% | 8/20 | 1.32679 |

**Quality — hybrid + semantic reranker (`default-semantic-config`, the production path):**

| Config | recall@10 | recall@5 | top-1 identical |
|---|---|---|---|
| Scalar + preserve | 99.0% | 99.0% | **20/20** |
| Binary + preserve | 99.0% | 99.0% | **20/20** |
| Binary + **discard** | 88.0% | 88.0% | 18/20 |

**Latency** (median of 20 hybrid+semantic queries): baseline 277 ms · scalar 294 ms · binary-preserve
272 ms · binary-discard 268 ms. **No meaningful penalty.**

**What it proves.**
1. **Rescoring against full-precision originals is the whole mechanism.** With `preserveOriginals`,
   scalar and binary produced identical output (0.00000 score delta, 20/20 same top result) because the
   oversampled candidates are re-scored on full precision, so the final ranking IS the true cosine
   ranking. Compression only affects candidate *generation*.
2. **`discardOriginals` measurably hurts, contradicting the Microsoft doc's claim** that for binary it
   reduces storage *"without reducing quality."* On this data it cost 32 points of pure-vector recall@10
   and changed the top result in 12 of 20 queries. **NEVER use `discardOriginals`.**
3. **`preserveOriginals` raises TOTAL disk slightly** (41.86 → 46.32 MB for scalar) while cutting the
   **vector index** — the resource carrying the 5 GB quota and the memory cost. That is the correct trade.
4. **Capacity:** at 13,179 bytes/vector the 5 GB vector quota tops out at **~407,000 service documents**.
   Scalar int8 takes that to **~1.2 million**. ‼️ **Millions of documents needs a higher search tier
   regardless of quantization** — a separate, unavoidable infra decision for the owner.

**Why scalar, not binary — the corpus-size evidence.** The CoRECT paper (arXiv 2510.19340, HTML) measures
binary quantization **without** rescoring:

| Model | Corpus | Full precision | Binary (zero threshold) |
|---|---|---|---|
| Snowflake V2 | 10k | 82.00% | 82.62% (fine) |
| Snowflake V2 | 100M | 53.39% | 49.39% |
| E5 | 100M | 84.31% | **19.23%** (65-point collapse) |

Its conclusion, verbatim: *"scalar quantization barely impacts performance, while binarizing the vector
has a significant impact on recall performance at larger corpus sizes."* Degradation worsens dramatically
from 1M → 100M and varies by model. The paper does **not** evaluate whether reranking recovers the loss,
and neither Microsoft nor the paper publishes binary **+ rescoring** measured at 100M.

⇒ **The 790-doc "binary is identical" result is real but does not generalise to millions.** Scalar is
measured-safe by two independent sources at any scale; binary's risk at millions is **unquantified**.

**Honest limitation of our own measurement:** 790 documents, and with `k=10` × oversampling 10 the
candidate pool is 100 docs = **12.7% of the corpus** — very generous. At 100k+ that ratio collapses toward
0.1%. The *mechanism* generalises; the exact 100% figure does not. Keep oversampling generous and
re-measure after real growth.

**Source — READ, and it settled D-13.** The owner supplied the article body
(`Cut Costs, Not Quality: Optimize Azure AI Search with Advanced Compression`, 2025-04-17). Its benchmark is
**8.8M vectors of `text-embedding-3-large` at 3072 dimensions on HNSW** — our exact setup. Key figures:

| Configuration | Vector index | NDCG@10 | vs baseline |
|---|---|---|---|
| No compression | 109.13 GB | 0.40219 | 1.00 |
| **BQ + rescoring + `preserveOriginals`** | **3.88 GB** | **0.40259** | **1.00** |
| SQ + rescoring + `preserveOriginals` | 27.65 GB | 0.40249 | 1.00 |
| BQ without rescoring + `preserveOriginals` | 3.88 GB | 0.39287 | 0.98 |
| BQ + rescoring + `discardOriginals` | 3.88 GB | 0.39181 | 0.97 |
| BQ without rescoring + `discardOriginals` | 3.88 GB | 0.38733 | 0.96 |
| MRL + BQ + rescoring + `preserveOriginals` | 1.33 GB | 0.40024 | 1.00 |

Microsoft's stated guidance: try SQ/BQ **before** adding MRL, and **`preserveOriginals` + rescoring is the
approach when relevance quality matters most**; `discardOriginals` targets maximum cost reduction. Latency:
the `discardOriginals` variants run ~30-33% faster (they skip the rescoring pass) and most configurations
match or beat baseline, with benefits appearing only above ~10K vectors. **⇒ D-13 = binary + rescoring +
`preserveOriginals`. See D-13 for the full reasoning.**

## 3.1 THE POC HARNESS — RE-RUN IT, DO NOT REBUILD IT

**`C:\Nik\voice-answer-ladder\poc\quant-ab.js`** is the exact harness that produced every number in §3.
It is kept deliberately (it is a reusable measurement instrument, not scratch). Node 18+, no dependencies.

```bash
cd C:\Nik\voice-answer-ladder\poc
node quant-ab.js run       # create temp indexes + copy real docs with their vectors + measure
node quant-ab.js measure   # re-measure without reloading
node quant-ab.js cleanup   # ‼️ ALWAYS run this — leaving temp indexes behind violates §0.16
```

It reads credentials from the repo (`cosmosindexsetup/appsettings.{ca|in}.json` and the Functions
`appsettings.json`), never hardcoded. `REGION=in` and `BASE_INDEX=…` override the defaults.
It already includes an **`mrl1024`** variant so D-19 can be measured on real data before the rebuild.

‼️ Two traps encoded in its header comment, both of which cost a bogus result once:
1. **`$skip` paging over an unordered `search=*` set silently drops rows** — it copied 552 of 790 documents
   and reported a plausible **81.5% recall** that was pure artefact. `id` is not sortable on this index.
   The harness enumerates the key set once and fetches by explicit `search.in(id, …)` batches, asserting counts.
   **Never trust a recall number without first asserting the corpus counts match.**
2. **Azure index `/stats` is eventually consistent** — an early read under-reports storage badly. The harness
   polls until `documentCount` matches and the numbers stop moving.

## 3.2 ‼️ SCALE REALITY — "8.8M vectors" IS NOT "5M providers"

Microsoft's benchmark is **8.8 million VECTORS = 8.8 million documents**. A provider is not a document.
The services index holds **one document per SERVICE**; the knowledge index holds **one document per PASSAGE**.

Measured bytes per vector, so the arithmetic is grounded rather than guessed:
- Uncompressed, measured on `clinket-dev`: **13,179 B/vector** (3072 × 4 + HNSW overhead).
- BQ at 3072, from Microsoft's 8.8M run: 3.88 GB / 8.8M = **~441 B/vector**.
- MRL 768 + BQ, same run: 1.33 GB / 8.8M = **~151 B/vector** ⇒ MRL **1024** + BQ lands around **~200 B/vector**
  (interpolation — **MEASURE with §3.1 before quoting it**).

So for a hypothetical 5M providers averaging 10 services each = **50M service documents**:

| Config | Vector index at 50M docs |
|---|---|
| Uncompressed | **~620 GB** |
| BQ + rescoring (3072) | ~22 GB |
| BQ + rescoring + MRL 1024 | **~10 GB** |

‼️ **Two honest limits on the "are we good at 5M providers?" question:**
1. **QUALITY is measured only to 8.8M.** Microsoft note they replicated the result across other MTEB datasets
   with consistent results, but 8.8M is the largest they published. At tens of millions of documents we are
   **extrapolating**, and CoRECT specifically shows binary degrading as the corpus grows (its collapse case was
   at 100M, *without* rescoring). Rescoring is our safety net and it is the right one — but at 50M+ it must be
   **re-measured on our own data**, not assumed. The §3.1 harness exists precisely for that.
2. **At that scale, compression is no longer the binding decision — the SERVICE TOPOLOGY is.** Per-partition
   storage and vector-index quotas, partition/replica counts, and whether one index can hold it at all (versus
   sharding across indexes or search services) dominate. That is a **separate architecture exercise**, not part
   of this fix pack. Read the current Azure AI Search service-limits table at the time of planning — do not
   reuse numbers from this document, and do not assume the Basic-tier figures measured here (5 GB vector quota,
   16 GB storage) generalise upward.

**What IS safe to say:** compression is the difference between "impossible" and "routine" at that scale, and
BQ + rescoring + MRL 1024 is the configuration to grow into. It does not remove the tier/sharding decision.

### 3.2c ‼️ CORRECTED — tenant filtering isolates RELEVANCE, not COST (owner research, closes U-1)

**My earlier claim was: *"every knowledge query is filtered `businessId eq …`, so the effective candidate space
is one business's ≤2,000 passages — that index is largely insulated from corpus-scale effects."* That is HALF
right, and the wrong half matters.**

| Property | `businessId` + `preFilter` |
|---|---|
| Cross-business result contamination | ✅ **Isolated** |
| Top-`k` competition from other businesses | ✅ **Isolated** |
| Filtered-result recall | ✅ **Strong — this is exactly why Azure recommends prefiltering** |
| HNSW navigation structure | ❌ **NOT isolated — the graph is shared** |
| CPU / latency dependence on total corpus size | ❌ **NOT isolated** |
| Equivalent to a dedicated ≤2,000-vector index | ❌ **No** |

**Verified facts behind the correction.** The default `vectorFilterMode` **is `preFilter`** for indexes created
after ~15 October 2023 (ours are new), and `preFilter` genuinely restricts *eligibility* — only that business's
passages can be returned. ‼️ **But Azure applies the filter DURING traversal of the shared HNSW graph**, and
Microsoft warns that a selective filter can force traversal of *"a significant portion of the graph"*, raising
CPU and latency and reducing throughput. **Their own benchmark: at 1,000,000 vectors, with a filter retaining
under 2% of the corpus, `preFilter` ran ~7x SLOWER than `postFilter`** — and roughly the same degradation at
1 billion.

‼️ **That is precisely the regime our design trends toward.** One business's passages stay bounded (capped at
2,000 by `MaxPassagesPerBusiness`) while the total index grows, so **the filter becomes MORE selective as we
scale** — walking straight into the case Microsoft flags.

**The corrected claim to use from now on:**

> **BOTH live voice paths (knowledge retrieval AND the provider catalog lookup) are relevance-isolated by tenant because `businessId` is prefiltered, but it is NOT
> performance-isolated: HNSW uses a shared graph, and a highly selective tenant filter can make traversal cost
> grow with total index size.**

**`postFilter` is NOT the answer** — it would be worse. Under `postFilter` each shard takes its **unfiltered**
top-`k` and only then filters, so a business's relevant passage can vanish entirely because millions of other
tenants' documents outranked it before the filter ran. That is recall starvation. **`preFilter` stays right.**

### ‼️ NEW RISK — the live voice budget at scale

`ProviderKnowledgeSearchService` runs inside `RetrievalTimeoutMs: 4000` with `RetrievalSlowWarnMs: 1500`, and
`EmbeddingBudgetShare = 0.4` already spends ~1.6 s of that on the embedding call — leaving ~2.4 s for the search
itself. **A ~7x `preFilter` slowdown at multi-million scale could blow that budget, and the failure is SILENT:
the receptionist simply misses knowledge it actually has.** This risk did not exist in the plan before this
research; it is now D-28.

### 3.2b ‼️ THE 5-MILLION-PROVIDER QUESTION — THE HONEST VERDICT

**I cannot promise "no impact on result or performance" at 5 million providers, and nobody can from published
data.** Stating otherwise would be a fabrication. What can be said precisely:

1. **The measurement ceiling is 8.8M documents.** 5M providers averaging 10 services each is **~50M service
   documents — 5.7x beyond anything published**, by Microsoft or anyone else.
2. **The one independent source says the risk grows with corpus size** (CoRECT), and its collapse case was at
   100M. Rescoring is why the 8.8M result is 1.00 — but **binary + rescoring has not been published at 50M+**.
3. **The exposure is NOT uniform across the two indexes.** Every knowledge query is filtered
   `businessId eq …` and a business is capped at 2,000 passages, so the **effective** candidate space per
   knowledge query is one business's material, not the whole index — that index is largely insulated from
   corpus-scale effects by construction. The **services index** carries the real exposure, because customer
   search can be broad. ‼️ **Verify `vectorFilterMode` (preFilter vs postFilter) on the knowledge queries before
   relying on this** — it decides whether the filter actually shrinks the vector search space. Do not assume it.
4. **The decision is REVERSIBLE — but be precise about what "cheap" means.** Per D-25, changing compression
   later means adding a new vector field and **copying the stored vectors into it**. What that costs:
   - ✅ **No index DROP + REBUILD.** The index stays live throughout.
   - ✅ **No AI spend at all** — no embedding calls, no LLM calls. The vectors already exist and are readable
     because `stored` stays true (D-14).
   - ✅ **No downtime** — the old field keeps serving every query while the new field fills.
   - ‼️ **BUT you must WRITE to every document to populate the new field.** At ~50M documents that is a real
     batch job measured in hours-to-days depending on tier and write throughput, not a click. It is a
     **re-push, not a re-derive.**
   So a wrong call now is a **correction that costs time and write throughput, and zero AI spend** — not a trap,
   but not free either. Do not describe it to the owner as free.
5. **The POC harness (§3.1) measures it at any scale.** Before crossing into tens of millions, load a
   representative corpus and re-run it. **Measure, do not extrapolate.**

**Verdict: binary + rescoring + `preserveOriginals` + MRL 1024 is the right configuration to grow into, it is
the best-evidenced option available today, and it is reversible without a re-index. That is the strongest
honest statement — not "guaranteed unaffected at 5M providers".**

## 3.3 SOURCE AUTHORITY — what each claim rests on

Owner asked, correctly: *"is it Microsoft or some blogger posted on MS?"* The evidence in this plan comes from
three tiers, and they are not equal:

| Tier | Source | What it backs | Weight |
|---|---|---|---|
| **1 — Official documentation** | `learn.microsoft.com` | The 300K-tokens-per-request / 8,192-per-input / 2,048-inputs embedding caps · `truncationDimension` semantics and the **"1,024 or higher… less than 1,000 degrades quality"** floor · *"You can't add MRL compression to an existing field"* · the rebuild-vs-no-rebuild rules · the `stored:false` data-loss warning · index-alias guidance · search-service 207/409/422/429/503 semantics · *"the Azure portal doesn't support log streaming"* under OpenTelemetry | **Strongest.** Product contract |
| **2 — Microsoft first-party blog** | `techcommunity.microsoft.com`, Microsoft Foundry Blog, author `fsunavala-msft` (Microsoft badge), 2025-04-17 | The **8.8M-vector NDCG@10 table** — the single measurement that settled binary vs scalar | **Strong but it is a BLOG, not documentation.** First-party, authored by a Microsoft employee on Microsoft's own platform, with stated method and dataset — but it carries no product guarantee and Microsoft themselves add *"your exact results may vary depending on your own data and use cases"* |
| **3 — Independent research** | CoRECT, arXiv 2510.19340 | Binary degrading with corpus size (E5: 84.31% → 19.23% at 100M) — measured **without** rescoring | **Independent, therefore valuable as a counterweight** — but its binary tests lack the rescoring pass that is our entire safety mechanism, and it does not evaluate whether reranking recovers the loss |
| **4 — Our own measurement** | `poc/quant-ab.js` against `clinket-dev`, 790 real documents | Identical rankings with `preserveOriginals`; measurable damage with `discardOriginals`; no latency penalty | **Directly relevant but SMALL corpus.** The mechanism generalises; the exact percentages do not |

‼️ **Rule for this program: a Tier-1 statement overrides a Tier-2 one.** That is exactly why D-19 uses
`truncationDimension: 1024` (the documentation's floor) rather than the **768** the blog tested.

## 3.4 ‼️ THE FINAL INDEX CONFIGURATION — one place, no ambiguity

Applies to **both** vector indexes, on the **existing** field (no new fields — D-25):

```
vectorSearch.compressions[0]:
  name                                : "bq-mrl"
  kind                                : binaryQuantization
  truncationDimension                 : 1024          # documentation floor; NOT the blog's 768
  rescoringOptions.enableRescoring    : true          # NEVER false — it is the whole safety mechanism
  rescoringOptions.defaultOversampling: 10
  rescoringOptions.rescoreStorageMethod: preserveOriginals   # NEVER discardOriginals

vectorSearch.profiles[*].compression  : "bq-mrl"
vectorSearch.algorithms               : UNCHANGED (existing HNSW, cosine, m=10, efC=400, efS=500)

field textEmbedding  (clinket-services) : name/type/dimensions UNCHANGED · retrievable+stored = TRUE
field contentVector  (clinket-knowledge): name/type/dimensions UNCHANGED · retrievable+stored = TRUE
clinket-providers                       : NO CHANGE — it has no vector field at all (D-17)
```

| Rule | Why |
|---|---|
| **NEVER `discardOriginals`** | Measured: pure-vector recall@10 68% and the top result changed in 12 of 20 queries. Microsoft's own table: 0.97 |
| **NEVER `enableRescoring: false`** | Microsoft's table: BQ drops to 0.98 without it, MRL+BQ to **0.89** |
| **NEVER `stored: false`** | The services index reads `textEmbedding` back for the reuse guard, and Microsoft warn vectors are **dropped on reindex** when `stored:false` unless every partial update resends them |
| **1024, not 768** | Tier-1 documentation floor beats the Tier-2 blog's test value (§3.3) |
| **Existing fields, no v2 field** | Owner instruction — sandbox, delete and recreate (D-25) |
| **Run per region** | CA **and** IN, via `--launch-profile`; `cosmosindexsetup` ignores a shell `CLINKET_REGION` |
| **After Phase A, never before** | The reload is the bulk embedding load that caused the incident (D-18) |

## 3.5 VERIFIED IMPLEMENTATION FACTS (checked, not assumed)

| Fact | How it was verified |
|---|---|
| **`Azure.Search.Documents` 12.0.0** is pinned in `clinqetcore/Clinqet.Core.csproj:10` and `cosmosindexsetup/ClinqetCosmosAIIndexSetup.csproj:9` | Read the csproj files |
| **That assembly exposes every symbol we need** — `TruncationDimension`, `RescoringOptions`, `BinaryQuantizationCompression`, `RescoreStorageMethod`, `EnableRescoring`, `DefaultOversampling` | **Grepped the actual `Azure.Search.Documents.dll`** — all six present. **No SDK upgrade needed.** This was an open risk; it is closed by direct inspection, not by trusting a claim |
| Nothing in the codebase references any compression API yet | Grepped all `.cs` — the compression block is genuinely new code |
| **Correct property spelling: `truncationDimension` (REST) / `TruncationDimension` (.NET) / `truncation_dimension` (Python)** | REST reference + SDK reference. ‼️ **`truncateDimension` on the *Choose Vector Optimization* page is a Microsoft documentation TYPO — never send it to the API** |
| ‼️ **Use the `RescoringOptions` shape, NOT the legacy one** | Service API `2025-09-01` replaced `RerankWithOriginalVectors` and the top-level `DefaultOversampling` with `RescoringOptions`. SDK 12.0.0 targets service API `2026-04-01`, so the modern shape is required. **Do not copy an older preview example** |
| Our HNSW parameters are already at maximum connectivity | `m: 10` is the **maximum supported** `m`; `efSearch: 500` is the documented default (supported range 100–1000). Existing config: cosine, m=10, efConstruction=400, efSearch=500 — **leave unchanged** |
| `Search:EmbeddingCache:MaxSize = 5000` in the API and Functions hosts; **absent in MCP** (falls back to the code default of 5000) | Read all three appsettings. Confirms **E10**: 5,000 entries x ~12 KB per 3072-float vector ≈ **~60 MB of real memory per host process**, which the size limiter accounts for as "5,000 units" |
| ‼️ **`vectorFilterMode` is NEVER set anywhere in the codebase** | Grepped `clinqetinfrastructure` + `clinqetcore` — zero hits, so Azure's **default** applies. **This means the claim that business-scoped filtering insulates the knowledge index from corpus-scale effects is UNVERIFIED** — see §13 |

### The A/B variants to run (revised on the research)

Run these four over **identical vectors, query set, `k`, filters, oversampling and HNSW parameters** — truncation
must be the **only** independent variable, because changing oversampling would confound the comparison:

| Variant | Role |
|---|---|
| BQ 3072, no MRL | Reference / maximum-conservatism baseline |
| MRL 2048 + BQ | High-dimensional fallback |
| MRL 1536 + BQ | Intermediate fallback — **the one with published relevance numbers (−0.06%)** |
| **MRL 1024 + BQ** | **The proposed production configuration** |

**Do NOT make 768 / 512 / 256 contenders.** And **do not require byte-identical rankings to approve 1024** —
MRL is lossy by definition. The acceptance criteria are recall@k, NDCG@10 and top-1 stability against the
no-MRL baseline. At 790 documents this is a **smoke test** proving the wiring, serialization and absence of an
obvious regression — **not** proof of tail recall at scale.

## 3.6 ‼️ THE RATE-LIMIT CONTRACT — header-driven, not arithmetic (owner research, closes U-5)

**Microsoft returns rate-limit state on every call and explicitly tells applications to throttle off it.** This
supersedes any share-of-configured-TPM design.

### Static request limits (documented, hard, and they fail with 400 — not 429)

| Limit | Value |
|---|---|
| Aggregate tokens per `/embeddings` request | **300,000** (over ⇒ **HTTP 400**) |
| Tokens per individual input | **8,192** |
| Inputs per request array | **2,048** |

‼️ **These are protocol limits, completely separate from TPM/RPM quota. Do not conflate them:**
**request-size violations ⇒ 400 (never retry). Quota exhaustion ⇒ 429 (retry per `retry-after-ms`).**

### Dynamic budget — the four headers to trust

| Header | Use |
|---|---|
| `x-ratelimit-limit-tokens` | ‼️ **The authoritative observed effective ceiling.** Microsoft document that for Standard pay-as-you-go this can be **temporarily LOWER than the configured TPM** under capacity pressure, and tell you to compare the two to detect it. **Trust this over the portal number** |
| `x-ratelimit-remaining-tokens` | Token headroom for admission control |
| `x-ratelimit-limit-requests` | Request-rate ceiling |
| `x-ratelimit-remaining-requests` | Request headroom — **govern this too**, because RPM has its own 1-/10-second burst enforcement and can 429 even while minute-level usage looks fine |
| `retry-after-ms` | **Explicitly milliseconds.** Honour it on 429 |

‼️ **DO NOT build timer logic on `x-ratelimit-reset-tokens` / `x-ratelimit-reset-requests` — their UNITS ARE
UNDOCUMENTED** (Microsoft's examples are `300` and `10` with no unit stated). **Log them for telemetry; never
make them correctness-critical** until validated against our own deployment.

### Admission check

```
admit a batch  ⟺   batch tokens ≤ 300,000                (protocol)
               AND  every input ≤ 8,192 tokens            (protocol)
               AND  input count ≤ 2,048                   (protocol)
               AND  batch tokens ≤ remaining-tokens − guard band
               AND  request headroom adequate (remaining-requests)
               AND  local burst spacing adequate          (RPM is enforced over 1–10s)
```

‼️ **`remaining-tokens` is a server-reported SNAPSHOT, not a reservation.** With concurrent workers another
request can consume that headroom after we read it — hence the guard band, and hence this is a **best-effort
governor, not an admission guarantee.**

‼️ **Feed the observed server debit back.** Azure's rate-limit token accounting is character-based and
approximate, and Microsoft say it may debit **more** than an exact tokenizer count. Comparing successive
`remaining-tokens` values against our own predicted batch size lets the limiter learn the real debit rate —
far more robust than assuming our estimate equals theirs.

‼️ **A 429 itself consumes budget.** Microsoft state unsuccessful requests still count against the per-minute
limit and that repeated retries make throttling worse. On 429: read `retry-after-ms` → **mark the local budget
snapshot stale** → wait → retry with bounded backoff + jitter → refresh state from the next response.

‼️ **Capability-detect the headers.** The quota documentation says they appear on **every** API call, but the
`/embeddings` REST reference formally enumerates only `apim-request-id`. That is a documentation inconsistency,
not proof of absence — but **if the four budget headers are missing at runtime, fall back to a conservative
local per-minute limiter. Never guess from stale state.**

---

# 4. DECISIONS — ALL OWNER-CONFIRMED IN THE INVESTIGATION SESSION

**Every decision below is APPROVED. Implement them. Do not re-litigate.**

| # | Decision | Detail |
|---|---|---|
| **D-01** | **Token-bounded sub-batching inside `AzureAIFoundryEmbeddingService`** | Split by item count **AND** an estimated-token ceiling. One owner of the sizing rule, so every caller is fixed at once. Add a per-input size guard and **isolate a poison input** instead of failing its whole batch. Rejected: batching only in the ingest function (leaves `CategoryEmbeddingService`, `QueryUnderstandingService` and every future caller on the same cliff) |
| **D-02** | **Retry split by failure class AND by lane** | **429**: honour `retry-after-ms`/`Retry-After`, else exponential + jitter from a real floor (~4 s), per-attempt cap (~60 s). **408/5xx/socket**: keep exponential base 1 s × 3. **400**: never retry (already correct). **Bulk** may wait long, bounded by the 480 s ingest deadline — **check the remaining budget BEFORE sleeping**. **Interactive**: at most one fast retry, then degrade. Rejected: one long policy (a customer search would hang 40 s); a circuit breaker as primary (bulk pressure would trip it and cut the live path) |
| **D-03** | **Explicit lane + a process-wide bulk pacer. Code pacer ONLY — no second deployment** | Add a workload argument to `IEmbeddingService` (`Interactive` default, `Bulk` opt-in). Only `Bulk` waits on a shared concurrency + tokens/minute limiter, sized as a configured share of deployment TPM. `Interactive` never queues. Owner explicitly chose this over a second Azure OpenAI deployment. Known limitation: per-process, so Functions scale-out multiplies it; `Retry-After` handling is the backstop |
| **D-04** | **JSON-as-TABLE + fix the shared trap** | A homogeneous array of objects IS a table: union of keys = header, each element = a row. Feed the chunker's existing Table path (§7.8b cases 11–15: token-budgeted row groups, header repeated in every part, `header: value; header: value` vector text, HTML for storage, oversize-row cell splitting). Kills the `records[n].` prefix waste; no card straddles a record. **AND** fix the root trap: a **multi-line `Paragraph`** keeps its line units (route through the same atomic-unit splitter used for `Preformatted`/`List`) instead of having its newlines collapsed — closes `.json`, `.txt`-containing-JSON, single-newline `.txt`, one-`<div>` `.html` and no-blank-line PDFs. ‼️ Owner's binding requirement: **"the result and output at the end for the caller and the AI should be the best, and the AI should be able to answer all the caller's asks."** Quality of the final answer is the acceptance criterion, not just "no warnings" |
| **D-05** | **`NotificationType.KnowledgeDocumentFailed`** — provider-facing, **failure only, NOTHING on success** | Dispatched through `IBusinessCommunicationDispatcher` (a knowledge doc belongs to a BUSINESS; a provider recipient id **is** a BusinessId, so a raw dispatch writes to a partition nobody reads). Channels: **in-app + push + SignalR**; `SkipEmail`/`SkipSms`/`SkipWhatsApp`. Fires **once, on the terminal outcome only** — never on an intermediate retry, so we never say "failed" and then have it work. Body carries the document name + the same localized reason the row shows. Routed to members holding **`voice.settings.manage`** (`voice.read` cannot re-upload). Idempotent via a deterministic EventId per `(businessId, docId, reason)` |
| **D-06** | **Toast suppression is CLIENT-SIDE: silent refresh, no toast** | The server cannot reliably know which page a provider is on. Use the existing per-surface subscriber pattern in `signalRService.js` (`notifyLeadSubscribers`, `notifyBookingSubscribers`, `notifyCallSummarySubscribers`…): add a knowledge subscriber; while the Knowledge page is mounted it consumes the event, refreshes the row **silently**, and suppresses the toast. **Bell + push still land**, so nothing is ever lost |
| **D-07** | **Admin alerts — EXACT plan. Every flag appsettings-gated, DEFAULT TRUE, in the class AND appsettings** | **New `AdminAlertType` values** (append only, never reorder — `clinqetshared/Enums/AdminAlertType.cs`): `KnowledgeIngestFailed` · `SearchEnrichmentFailed` · `SearchEmbeddingFailed`. Each must ALSO be registered in `clinqetwebadmin/src/pages/alerts/AlertsPage.jsx` (there is a hardcoded list; the file's own comment says "Keep in sync with AlertsPage.jsx"). **New `AdminAlertSettings` flags** (`clinqetfuncations/Clinqet.Communications/Services/FailureNotificationHelper.cs`, class defaults **AND** `appsettings.json`, both `true`): `EnableKnowledgeIngestFailureAlerts` · `EnableSearchEnrichmentFailureAlerts` · `EnableSearchEmbeddingFailureAlerts`. ‼️ Owner rule **R3**: every flag defaults TRUE in both places and `Clinqet.Communications.UnitTests/Conventions/AdminAlertSettingsConventionTests.cs` **fails the build on drift** — fix the code, never the test. **Bring the indexer's existing alerts under the same regime.** `SearchIndexHydrationFallback` and `AIEnrichmentFailureSpike` are gated by **cooldown only** today and live in `clinqetinfrastructure` outside `AdminAlertSettings` — two gating regimes in one codebase. Unify them. **Wording is hardcoded admin-English (§3.6). Metadata must be self-sufficient to act on** — knowledge: businessId, docId, docName, failure reason key, delivery count, messageId; search: businessId, serviceId, which leg failed, attempt count, correlationId. ‼️ **VOLUME GUARD — 500 failing services must NOT mean 500 alerts.** Mirror the established `HandleAnalyticsDeadLetterAsync` precedent already in this file: **ONE aggregated alert per change-feed invocation**, listing every `(businessId, serviceId)` that lost enrichment and/or embedding, with per-reason counts and sample ids. 500 failures ⇒ 1 actionable alert carrying the full list; 1 failure ⇒ 1 alert naming it. ‼️ **Fires only AFTER the automatic retries are exhausted** (D-10) — never on the first transient failure. ‼️ **`IAzureSearchIndexer` returns bare `Task<bool>` today** and therefore cannot say which leg failed. It needs a small result shape (enrichment ok / embedding ok / both) for D-12 to be implementable at all. |
| **D-08** | **Keep 500,000 TPM. Do not raise it further** | Already above the 350K regional default for gen-3 embeddings. Once batching is token-bounded and paced, this document costs ~340K tokens **once**, over ~7 requests. More quota buys nothing: the binding constraints are the 300K per-request cap and burst smoothing. Global Standard and "Opt out of automatic model version upgrades" are both correct — a silent version bump would invalidate every stored vector |
| **D-09** | **Distinguish "throttled" from "unavailable"** (S2) | A 429 becomes retryable: it bubbles so the document rides the existing retry ladder and the change-feed replay queue and comes back fully embedded. Zero-vector + `HasEmbedding=false` is reserved for a genuine outage |
| **D-10** | **Recovery = auto-retry first, THEN alert + admin button** | A failed enrichment/embedding leg rides the **existing** `change-feed-failures` queue so `ChangeFeedFailureReplayProcessor` retries it automatically with backoff. **Only when those retries are exhausted** does the aggregated admin alert fire — carrying businessId + serviceId — and the admin can trigger a resync. Owner's reasoning accepted and refined: relying on a human to read an alert is a hope, not a recovery mechanism |
| **D-11** | **Admin resync surface — EXACT build list (verified state, 2026-08-18)** | **ALREADY EXISTS, do not rebuild:** `IAzureSearchIndexer.IndexServiceAsync(serviceId, businessId, forceReindex)` (interface method) · `POST admin/search/reindex-business/{businessId}` · `GET admin/search/provider-visibility/{businessId}` · `GET admin/search/health` — all in `clinqetapi/Clinqet.API/Controllers/Admin/SearchAdminController.cs`, all `[Authorize(Roles = "Admin")]`. **ALREADY WIRED TO UI:** only `GET admin/search/health` (`clinqetwebadmin/src/services/monitoringService.js:12`). **MUST BUILD — API (1 endpoint):** `POST admin/search/reindex-service/{businessId}/{serviceId}`, same `[Authorize(Roles = "Admin")]`, same `ApiResponse<T>` envelope, validating both ids and returning a localized not-found when the service does not exist. **MUST BUILD — UI (3 surfaces, none exist today):** (a) per-service resync button, deep-linked from the Alerts page row so an admin lands on the exact failing `(businessId, serviceId)`; (b) per-business resync — the endpoint exists, the UI does not; (c) the provider-visibility report — the endpoint exists, the UI does not. Put (b) and (c) in a Search Operations panel beside the existing health card. ‼️ **TRIGGER MECHANISM — enqueue a `ChangeFeedFailureMessage` onto the existing `change-feed-failures` queue.** `ChangeFeedFailureReplayProcessor` then re-reads the service from Cosmos and re-indexes it through the **identical** code path the change feed uses: asynchronous (a 100-service business cannot time out an HTTP request), and it inherits the retry ladder and the DLQ for free. ‼️ **NEVER touch the Cosmos document to fire the change feed** — that is a data write purely for a side effect, and it bumps `UpdatedAt`/`UpdatedAtTicks`, which the freshness guard reads and the provider sees in their own UI. ‼️ **MOCKUP GATE WAIVED FOR ADMIN (owner, this session)** — build directly in `clinqetwebadmin` following its **current design system and structure**: existing page shell, table/card patterns, button + chip styles, spacing, toast conventions and the Alerts-page layout. **Introduce no new visual language.** The gate remains fully in force for provider- and customer-facing surfaces. |
| **D-12** | **ANY failure of enrichment OR embedding OR both raises an admin alert, appsettings-gated, default true** | Owner mandate, verbatim: *"for any reason if we couldn't do either enrichment or embedding or both or one of them, admin alert needs to fire, gated by appsetting and default is true."* **Volume guard:** 500 failing services must NOT mean 500 alerts. Mirror the established `HandleAnalyticsDeadLetterAsync` precedent — **one aggregated alert per change-feed invocation**, listing every `(businessId, serviceId)` that lost enrichment and/or embedding, with counts, so 500 failures = 1 actionable alert with the full list and 1 failure = 1 alert naming it. This requires the indexer to report **which leg failed**: `IAzureSearchIndexer` returns bare `Task<bool>` today and needs a small result shape |
| **D-13** | **Vector quantization: BINARY + `enableRescoring: true` + `defaultOversampling: 10` + `preserveOriginals` on BOTH vector indexes** | ‼️ **FINAL — this moved twice and is now settled by direct evidence.** Microsoft measured this exact configuration on **8.8M vectors of `text-embedding-3-large` at 3072 dimensions on HNSW** — our exact model, dimensions and algorithm: **NDCG@10 0.40259 vs 0.40219 uncompressed baseline = 1.00 relative** (parity, marginally above). That was the one measurement that did not exist when scalar was chosen; the owner supplied it. It reconciles CoRECT (which measured binary **without** rescoring: E5 84.31% → 19.23% at 100M) with our own 790-doc A/B: **the variable is RESCORING, not corpus size.** Microsoft's own table agrees — BQ *without* rescoring drops to 0.98; BQ + `discardOriginals` to 0.97 (with rescoring) / 0.96 (without); SQ + rescoring + preserveOriginals is also 1.00 but only 4x smaller vs binary's 28x. ‼️ **NEVER `discardOriginals`** — 3% NDCG is not for sale on a marketplace where top-1 decides which provider gets the lead. ‼️ **NEVER disable rescoring** — it is the entire mechanism. Keep the vector **retrievable/stored on the services index** — `ExistingDocReuseFields` (`AzureSearchIndexer.cs:1275`) reads `textEmbedding` back for the embedding-reuse guard. **Cost at 8.8M scale:** `preserveOriginals` keeps disk at 115.68 GB so it needs S1 (~$250/mo) against ~$1,000 uncompressed = **75% saved**; the $75 Basic tier requires `discardOriginals` and is therefore refused. **Speed:** Microsoft measure ~30-33% faster for the `discardOriginals` variants (which skip the rescoring pass) and state most configurations match or beat baseline; they also note benefits appear only above ~10K vectors — which is exactly why our 790-doc run measured parity (272 ms vs 277 ms), not a win. **MRL: see D-19 — it is IN.** (An earlier claim in this session that MRL requires re-embedding at a different `dimensions` value was **WRONG** and is corrected there.) ‼️ §0.7 Search-schema gate — owner APPROVED. `cosmosindexsetup` per region (CA + IN), then re-index. |
| **D-14** | **`stored`/retrievable stays TRUE on BOTH vector fields. Do NOT set `stored: false`** | It saves plain disk, not the quota-bound `vectorIndexSize`, and the interaction between `stored: false` and `preserveOriginals` rescoring was **not verified**. On the services index it is outright forbidden — `ExistingDocReuseFields` (`AzureSearchIndexer.cs:1275`) reads `textEmbedding` back, so a non-retrievable vector breaks the embedding-reuse guard and re-embeds on every reindex. On knowledge it is *possible* (`ProviderKnowledgeSearchService.SelectFields` never selects `contentVector`) but deliberately deferred: verify it first, treat it as a separate optional saving |
| **D-17** | **THE PROVIDER INDEX GETS NOTHING** | `ProviderSearchDocument` has **zero vector fields** (verified: grep count 0) and `cosmosindexsetup/Program.cs:624` states it deliberately — *"providers are filtered and sorted, never semantically searched"*. There is no vector to compress. Do not add one |
| **D-18** | **SEQUENCING IS FIXED: Phase A ships BEFORE the index rebuild** | Dropping the services index destroys the stored `EnrichmentContentHash` / `EmbeddingContentHash` / vectors, so the rebuild **re-pays enrichment + embedding for all 790 services once**. That re-index IS the bulk embedding load that caused this incident — run it before the token-bounded batching, `Retry-After` handling and bulk pacer are in place and it will 429 itself. Knowledge is free to rebuild (0 documents today) |
| **D-19** | **MRL truncation: `truncationDimension: 1024`. CLOSED — do not reopen.** | ‼️ **The value never changed. It was 1024, a doubt was raised about the `>1024` wording, and two independent deep-research passes commissioned by the owner resolved the doubt in favour of 1024. It stays 1024.**
 **The decisive evidence, strongest first:**
 1. **Microsoft's dedicated MRL page's worked example IS our exact configuration** — `binaryQuantization` + `enableRescoring: true` + `defaultOversampling: 10` + `rescoreStorageMethod: preserveOriginals` + `truncationDimension: 1024`. Five settings, all five matching. This is not inference from prose; it is Microsoft's own recommended configuration.
 2. **Microsoft's official `azure-search-vector-samples` notebook does exactly this with OUR model** — precomputed `text-embedding-3-large` vectors, field `dimensions = 3072`, `truncation_dimension = 1024`. Microsoft's own code does **not** avoid 1024 out of any `>1024` concern.
 3. **The MRL page's small-model example declares `dimensions: 1536` while truncating to 1024** — proving Azure treats *declared field dimensionality* and *MRL truncation dimensionality* as distinct concepts.
 4. **Measured, first-party, our model + BQ** (Microsoft MRL benchmark, Oct 2024, Mean NDCG@10 over an MTEB subset): truncation **1024** = **−0.58%** and **1536** = **−0.06%** *with only 2x oversampling and rerank* (−7.00% / −5.00% without). **We use 10x oversampling**, a materially larger candidate pool than the test that produced −0.58%. ✅ **VERIFIED FIRST-PARTY** — Table 1.2 of *Azure AI Search October Updates: Nearly 100x Compression with Minimal Quality Loss*, 8 Oct 2024 (techcommunity.microsoft.com/.../4265447); the owner opened the original post and confirmed it. Microsoft cite it in their **99% search quality** conclusion, report **96x compression** for 3072→1024+BQ, and ‼️ **explicitly recommend using roughly 1/2 or 1/3 of the original dimensions — for 3072 that is 1536 or 1024, so 1024 is Microsoft’s own stated 1/3 operating point, not a boundary value.**
 5. **The 8.8M-vector test truncated to 768** — 25% BELOW today's recommendation — and still held **0.40024 vs 0.40219 baseline (~99.5%)** with rescoring + preserved originals. Powerful evidence that 1024 is not fragile at multi-million scale.
 6. **Another first-party measurement, 100,000 3072-dim vectors:** vector index **41.88 MB (BQ, no truncation) → 17.47 MB (BQ + 1024)** — ~2.4x further reduction, which puts the 8.8M estimate near **~1.6 GB** rather than my earlier interpolated ~1.7 GB. *Also second-hand — verify before quoting.*

 **How Statement B is resolved (and it is NOT by claiming it means 3072):** Statement B says binary quantization is *"particularly effective"* above 1024 — **not** "requires", **not** "is supported only when", **not** "degrades at or below". It is **generic BQ guidance**; the MRL page is **specific BQ+MRL guidance**, and specific beats generic. There is **no API validation threshold** at 1024 (REST publishes a 2–4096 range for the field's `dimensions`, and **no** min/max for `truncationDimension`). ‼️ **Do NOT record the justification as "Statement B refers to the declared 3072 dimensions" — that cannot be proven from the documentation and both research passes explicitly declined to claim it.** Operationally the compressed HNSW graph *is* truncated, i.e. effectively 1024-dimensional. 1024 is safe because Microsoft specifically recommends, codes and measures it — not because we are secretly above a threshold.

 **The 512/256 lines are API-shape examples, not quality recommendations** — decisively shown by the quantization page's own REST example using `truncationDimension: 2`. Nobody recommends 2-dimensional embeddings; that example demonstrates syntax. Same category as 512/256.

 ‼️ **The mechanism caveat that must survive into the code comments:** rescoring re-ranks the candidates that **survived first-stage retrieval**. It **cannot rescue a relevant vector the truncated BQ HNSW stage never surfaced.** That is precisely why `defaultOversampling: 10` is not optional, and why a 790-document A/B **cannot** establish tail recall at 10M+. |
| **D-20** | **The bulk pacer covers `AICompletionService` too, not only embeddings** | Same `Interactive` / `Bulk` lane split as D-03, applied to the completion client. **Live paths never queue**: `Voice:ExpertCheck` (8 s budget on an active call), `Search:SpellCheck:Llm`, `AIService`. **Bulk pays the pace**: `SearchIndexEnrichment`, `ServiceApproval` validations, `VoiceCall` summary, `BroadcastClassification`, the knowledge D11 doc-summary and image-caption calls. Verified today: `AICompletionService` has **no** limiter and **no** pacer, and 15 configured call sites share one deployment |
| **D-21** | **Change-feed concurrency is GOVERNED BY THE PACER, not a hard 24** | `ServiceProcessingMaxConcurrency: 24` and `ReindexProcessingMaxConcurrency: 24` are the amplifier that turns a bulk onboarding into a throttle storm. Let the shared limiter decide in-flight work instead of a fixed fan-out. ‼️ **Watch the change-feed lease** while pacing inside an invocation — `host.json` `extensions.cosmosDB` sets `leaseExpirationInterval: 60000` / `leaseRenewInterval: 15000`; verify a long paced invocation cannot lose its lease, and if it can, reduce `MaxItemsPerInvocation` rather than blocking inside one |
| **D-22** | **A 429 on the ENRICHMENT leg retries the document — it never publishes un-enriched** | D-09 extended. Owner's principle, and it is the right one: *"if a service is available slightly late that is OK instead of the error."* A throttle is transient, so it must ride the retry ladder + the `change-feed-failures` replay queue and come back complete. An **empty enrichment** and a **zero-vector** are reserved for a genuine outage, never for back-pressure. ‼️ **State the trade explicitly in the settings comments:** at a bulk share of the deployment, ~17M tokens for 5,000 services is on the order of an hour-plus until every one is fully searchable. Documents appear as they complete, not all at the end. That expectation must be tunable and written down, not a surprise |
| **D-23** | **Recovery sweep capacity must survive a bulk event** | `Search:VectorRecovery:MaxDocumentsPerRun: 500` cannot clear a 5,000-document incident in reasonable time (10+ timer runs). Raise it and/or make the sweep adaptive, and pace it through the **Bulk** lane so the recovery itself never becomes the next storm. Also close the enrichment side (S3 / D-10) so an un-enriched doc is recoverable at all |
| **D-24** | **BATCH the embedding calls in the change feed — one request per N services, not one per service** | ‼️ **A genuine improvement, added after the owner asked whether a single batched sync would be better than per-service calls. It would, and it was missing from the plan.** Today `AzureSearchIndexer` calls `GenerateTextEmbeddingAsync` — **one input per HTTP request, per service** — so 5,000 services means **5,000 embedding requests** fired at 24-way concurrency. Restructure the change-feed path to: enrich (per service, unavoidable) → **collect the embedding inputs** → **ONE token-bounded batched call** via `GenerateBatchTextEmbeddingsAsync` → then index. At ~50 inputs per request that is **~100 requests instead of 5,000** for the same token spend — a 50x cut in request count and the single biggest RPM-pressure relief available. It also composes with D-01: the token ceiling caps each batch, and poison isolation stops one bad input failing its neighbours. ‼️ **Do NOT batch the ENRICHMENT calls** — each service needs its own prompt and its own structured answer; folding several services into one LLM call invites cross-contamination between listings and is a quality regression, not an optimisation. **Embeddings batch; enrichment does not.** ‼️ Preserve the existing per-document failure isolation: a batched embed must still let ONE service fail without taking the other 49 down with it (`ConcurrentBag` failure collection already exists — extend it, and remember a capture across a parallel fan-out must be a CONCURRENT collection) |
| **D-25** | ‼️ **FUTURE MIGRATION PATH ONLY — DO NOT CREATE A NEW VECTOR FIELD IN THIS FIX PACK.** Owner instruction: this is a sandbox, the indexes are deleted and recreated, so the compression goes onto the **EXISTING** field definitions (`textEmbedding`, `contentVector`) — same names, same types, same `dimensions`, just a compression profile attached. **No `textEmbeddingV2`, no side-by-side field, no dual-write.** The content below documents how a FUTURE change would be made without a re-index; it is reference, not work. | ‼️ Verified against Microsoft's schema-update rules. **No rebuild required:** add a new field · add a new vector configuration/profile **assigned to a new field** · set `retrievable` on an existing field · add/update/delete scoring profiles, synonym maps, semantic configurations, CORS. **Rebuild required:** delete a field · change a field definition (name, type, searchable/filterable/sortable/facetable) · assign an analyzer to a field · add a field to a suggester. ⇒ **You cannot change compression on an existing vector field, but you CAN add a NEW vector field carrying different compression, with zero downtime.** And because D-14 keeps the vector **retrievable/stored**, the new field is populated by **reading the old vector out and merging it into the new field — no embedding calls, no LLM calls, no Cosmos reads.** The POC harness (§3.1) already proves this exact copy works at 790 documents. **So the compression choice made now is NOT a one-way door**, and this fix pack's index rebuild is the LAST forced rebuild for compression reasons |
| **D-26** | **INDEX ALIASES — APPROVED by the owner. Env-specific, and the automation changes with it.** | See §5.1 for the full end-to-end plan (naming, `cosmosindexsetup`, `deploy.ps1`, ARM, health check, per-region rollout). The elegant part: **the alias takes over the name the apps already read**, so no consumer code and no app settings change at all |
| **D-27** | **A 429 from the SEARCH service is NOT a 429 from Azure OpenAI — never treat them alike** | Microsoft: a 429 during **indexing** *"usually means that you're running low on storage… the service can enter a state where you can't add or update until you delete some documents."* That is a **capacity** signal, not a rate limit, and exponential backoff will never clear it. It needs an admin alert and a capacity action. Distinct handling required for: **207** (partial batch — inspect every per-document `statusCode`; the existing indexer already does this, preserve it under D-24 batching), **409** version conflict (concurrent writes to the same document — serialize or retry with backoff; reachable when an admin resync races the change feed), **422** (index temporarily unavailable after an `allowIndexDowntime` update — retryable), **503** (service under load — *"wait before retrying… or you risk prolonging the service unavailability"*). ‼️ **Do not fold search-service status codes into the Azure-OpenAI retry policy.** They are different failure domains with different correct responses |
| **D-28** | **Set `vectorFilterMode: preFilter` EXPLICITLY on every filtered vector query — never rely on the default** | Microsoft themselves recommend an explicit `preFilter` request as the compatibility check, and the default depends on **index vintage** (post-~Oct-2023 indexes default to `preFilter`; older ones to `postFilter`, and very old ones support only `postFilter` until rebuilt). ‼️ **`vectorFilterMode` is currently set NOWHERE in the codebase** (verified — zero hits in `clinqetinfrastructure` and `clinqetcore`), so today we are running on a default we never chose. Set it explicitly in `ProviderKnowledgeSearchService`, `AzureSearchQuery`, `ProviderCatalogSearchService` and any other filtered vector query. **Cheap, removes an invisible dependency, and makes the intent reviewable.** |
| **D-29** | ‼️ **OUT OF SCOPE — DO NOT BUILD.** A SKILL note only | Record in the `clinqet-voice-assistant` SKILL: **never enable `exhaustive: true` as a latency fix without re-opening D-13/D-19** — it silently disables oversampling + rescoring. Guard it with the E74 test. Rationale in `SCALE-FILTERING-NOTES.md` |
| **D-30** | **The bulk pacer is a HEADER-DRIVEN budget governor — it SUPERSEDES the share-of-configured-TPM design in D-03/D-20** | ‼️ **This replaces, not supplements, the earlier pacer design.** Microsoft explicitly recommend throttling off `x-ratelimit-remaining-tokens` / `x-ratelimit-remaining-requests` before a 429, and document that the **effective** limit can be lower than configured TPM. So: read the four budget headers off every response; treat `x-ratelimit-limit-tokens` as the authoritative ceiling; admit a batch only when token **and** request headroom allow it, with a guard band and local burst spacing; honour `retry-after-ms` on 429 and mark the snapshot stale; **capability-detect** and fall back to a conservative local limiter if the headers are absent. Configured TPM survives only as a **bootstrap/fallback** value, never as the runtime authority. ‼️ **A configured "bulk share of TPM" is still useful as a POLICY knob** (how much of the observed headroom bulk may consume, leaving the rest for live traffic) — but the *denominator* now comes from Azure, not from appsettings |
| **D-31** | **`MaxTokensPerRequest`: keep a conservative default, but DELETE the TPM/6 derivation** | The 40,000 figure had **no documented basis** (U-5, refuted). The real bound is `min(300,000 protocol cap, observed remaining-tokens − guard band)`. Keep a configured ceiling as a **safety net and bootstrap** — a conservative 40,000–60,000 is fine before any header is seen — but the comment must say it is an engineering precaution, **not** a Microsoft rule. ‼️ **And handle the 400 explicitly:** an over-cap request fails with **HTTP 400, never 429**, so it must be **split and retried, never backed off**. Adaptive halving on a token-cap 400 is the correct response |
| **D-32** | ‼️ **OUT OF SCOPE — NOT A WORK ITEM.** A finding | Both live voice paths (`ProviderKnowledgeSearchService` and `ProviderCatalogSearchService:569`) filter to one business and are therefore exposed to the scale issue; customer search is not. ‼️ **Compression does NOT cause it and reverting compression would not help.** Full detail in `SCALE-FILTERING-NOTES.md` |
| **D-15** | **`MaxPassagesPerBusiness` stays 2000** | It bounds search-index storage, not retrieval quality (queries are `businessId eq …`-filtered). Raising the number multiplies vectors; the real lever is quantization. The chunking fix changes what a document costs, so re-tune only after measuring |
| **D-16** | Small hygiene items | (a) `AICompletionService`: raise the 30 s `Retry-After` clamp and also read Azure OpenAI's `retry-after-ms`. (b) `CategoryEmbeddingService`: hardcoded `batchSize = 50` → settings (§0.12) |

## 4.1 STILL OPEN — ASK THE OWNER, DO NOT DECIDE ALONE

| # | Open item | Why it needs the owner |
|---|---|---|
| **O-1** | **`RetrievalTopK` (5) and `RetrievalMaxTokens` (1500)** | This is the real answer-quality lever. With one card per machine (~330 real tokens) the receptionist sees **at most 5 machines per question** — for a 685-machine catalogue that may be the actual ceiling on answer quality. Owner asked for **concrete measured numbers** (live-call latency + per-turn token cost) before approving any change. **Measure, present, then wait** |
| **O-2** | **Search tier for "millions of records"** | At 13,179 bytes/vector, Basic's 5 GB vector quota = ~407k docs; scalar takes it to ~1.2M. Millions needs a higher tier **regardless** of quantization. Infra + cost decision |
| **O-3** | ~~D-13 confirmation~~ — **CLOSED** | Settled by the Microsoft 8.8M / `text-embedding-3-large` / 3072d / HNSW measurement the owner supplied: BQ + rescoring + `preserveOriginals` = **1.00 relative NDCG@10**. Binary is confirmed; no further owner confirmation needed |
| **O-4** | **S3 residual** | D-10/D-11 cover recovery via the queue + admin button. A *proactive* sweep for un-enriched docs would still need `IsFilterable` on `enrichmentContentHash` (an index rebuild, §0.7) or a piggyback on `SearchIndexAuditFunction`'s existing enumeration. Owner leaned to the piggyback. Confirm scope |
| **O-6** | **`gpt-5.4-mini` quota — OWNER SAID "assume the same": 500,000 TPM / 3,000 RPM** | ‼️ Recorded as a **working assumption, not a verified fact — confirm it in the Azure portal before go-live and correct this line.** Derived pace for the 50 x 100 scenario (5,000 new services) at a **40% bulk share = 200,000 TPM**: enrichment ~3,500 tokens/service x 5,000 = **~17.5M tokens ⇒ ~90 minutes** until all 5,000 are fully searchable, at only **~57 RPM** (trivial against 3,000). With D-24 the embedding leg is ~2.5M tokens in **~100 batched requests ⇒ ~13 minutes**. **So the binding constraint is enrichment TOKEN throughput, and ~90 minutes is the honest cold-load figure.** Want it faster? Raise the bulk share or the deployment TPM — a **settings knob, not a redesign**. Services become searchable as they complete, never all at the end |
| **O-7** | ‼️ **DEFERRED with the scale work — not a Phase 4 item** | Where in-memory catalog vectors would come from. Irrelevant unless the deferred session adopts local scoring. See `SCALE-FILTERING-NOTES.md` |
| **O-5** | **`AddResilientConsole` duplicate telemetry** | Pre-dates this work; cost-only. Raise separately, do not fix here |

---

# 5. THE WORK — PHASED, WITH EXACT FILES

Verify every path with Glob/Grep/Read before editing. Line numbers in this document were accurate on
2026-08-18 and may have drifted.

## PHASE A — the embedding client (D-01, D-02, D-03, D-16a)

**`clinqetcore/Interfaces/Search/IEmbeddingService.cs`**
- ** estimated** (hard cap is 300,000/request; a 10s burst window at 500K TPM admits ~83,000;  under-estimates this content by ~⅓ so 40K est ≈ 54K real). The incident document then costs **7 legal requests instead of 1**.
- **Bulk pace target ~200,000 TPM of the 500K**, leaving 300K permanently free for live search + live voice. Bulk concurrency ~2 in flight.
- ‼️ **`MaxTokensPerRequest = 40,000` estimated tokens.** Derivation: the hard cap is **300,000 tokens/request**; a 10-second burst window at 500K TPM admits ~**83,000**; `chars/4` under-estimates this content by roughly a third, so 40K estimated ≈ 54K real — comfortably inside the burst window and 7.5x under the hard cap. **The incident document then costs 7 legal requests instead of 1.**
- ‼️ **Bulk pace: a POLICY share of the OBSERVED headroom** (D-30), not a fixed TPM number — e.g. bulk may consume at most ~40% of `x-ratelimit-remaining-tokens`, leaving the rest for live search and live voice. Bulk concurrency ~2 in flight, with local burst spacing because RPM is enforced over 1–10 s.
- Add the workload/lane parameter (`Interactive` default, `Bulk` opt-in). New enum in
  `clinqetshared/Enums/` with `[JsonConverter(typeof(JsonStringEnumConverter))]` per §3.9.
- Consider whether the batch method needs a richer result so callers can tell *throttled* from *empty*
  (D-09). Keep the `[]` sentinel contract for existing callers — `AzureSearchIndexer` deliberately
  degrades on it — but make the *reason* reachable.

**`clinqetinfrastructure/Services/Search/AzureAIFoundryEmbeddingService.cs`**
- Token-bounded sub-batching: split `toProcess` by item count **and** an estimated-token ceiling; per-input
  guard; poison-input isolation (retry the batch, then each input singly — mirror
  `AzureSearchIndexer.UploadDocumentsIsolatingPoisonAsync`).
- Retry: honour `retry-after-ms` **and** `Retry-After`; separate 429 from 408/5xx; never retry 400;
  per-lane attempt counts and caps; check the remaining budget before a long sleep.
- The bulk pacer: `System.Threading.RateLimiting` (concurrency + token bucket), **Bulk only**. Singleton
  lifetime — it already is. Thread-safe, properly disposed.
- ‼️ `client.Timeout` is **30 s** (`Program.cs:711`) — reconcile with the chosen max batch size, and note
  `_fetchCeilingSeconds` (30 s) bounds the *detached single* fetch and is correct for Interactive.
- Every new knob in appsettings under `AzureAIFoundry` **and** mirrored as a class default (§0.12).
  Existing: `MaxBatchSize: 2048`, `MaxTextLength: 30000`, `MaxRetries: 3`, `TimeoutSeconds: 30`.
  **Present in all three hosts' appsettings** (API 1971-1977, Functions 399-405, and check MCP).

**`clinqetfuncations/Clinqet.Communications/Functions/KnowledgeIngestProcessorFunction.cs:368`**
- Pass `Bulk`. Improve the failure message: today it throws naming "card 0" because the whole batch
  returned `[]`.
- Fix the intermediate-`Failed` UX (§2.3): on a **non-final** attempt the row should not read
  "Failed — Try again" while a retry is queued.

**`clinqetinfrastructure/Services/Search/CategoryEmbeddingService.cs`** — D-16b, and pass `Bulk`.
**`clinqetinfrastructure/Services/Search/VectorEmbeddingRecoveryService.cs`** and
**`SearchIndexSyncFunction`** paths — pass `Bulk`.
**Live callers** (`AzureSearchQuery`, `ProviderKnowledgeSearchService`, `ProviderCatalogSearchService`,
`BroadcastMatchingService`, `BroadcastClassificationService`, `QueryUnderstandingService`,
`KnowledgeManagementService`) — leave on `Interactive`.

**`clinqetinfrastructure/Services/AI/AICompletionService.cs`** (D-20)
- Same lane parameter and the same shared limiter as the embedding client. **Interactive never queues.**
- Raise the `Retry-After` clamp above 30 s and also read Azure OpenAI's **`retry-after-ms`** header —
  `GetRetryAfterDelayMs` reads only `response.Headers.RetryAfter?.Delta` today and clamps to 30 s, so the
  40 s Azure asked for during the incident would have been under-waited even by the client that gets this right (D-16a).
- No concurrency limiter exists here at all today — verify before assuming any back-pressure is present.

**`clinqetfuncations/Clinqet.Communications/Functions/SearchIndexSyncFunction.cs`** (D-21, D-22)
- Concurrency governed by the pacer; enrichment 429 becomes retryable rather than publishing degraded.
- Re-check the change-feed lease intervals before pacing inside an invocation.

## 5.1 ‼️ INDEX ALIASES — THE FULL END-TO-END PLAN (D-26, owner-approved)

### The verified wiring today

| Layer | What it does |
|---|---|
| `cosmosindexsetup/Program.cs:45-47` | `SearchSettings.IndexName = "clinket"` · `ProviderIndexName = "clinket-providers"` · `KnowledgeIndexName = "clinket-knowledge"` |
| `cosmosindexsetup/Program.cs:791, 843-845` | `envSuffix = isProd ? "" : $"-{environment}"`, appended to each index name ⇒ `clinket-dev`, `clinket-knowledge-dev`, `clinket-providers-dev` |
| `azureautomation/deploy.ps1:1596-1598` | `$searchIndexName = "clinket$envResourceSuffix"` (+ provider, + knowledge) |
| `azureautomation/deploy.ps1` (**6+ blocks**: ~6823-6825, ~6973-6975, ~7393-7395, ~7625-7627, ~8035-8038, ~8191-8192) | Pushes `AISearch__IndexName` / `AISearch__ProviderIndexName` / `AISearch__KnowledgeIndexName` into every host's app settings |
| ARM templates | **Do NOT create search indexes.** `cosmosindexsetup` owns index creation — so **no ARM change is needed for aliases.** Confirm and state this rather than hunting for it |

### The design — the alias inherits the existing name

**The name the apps already read becomes the ALIAS. The physical index gets a version suffix that only
`cosmosindexsetup` knows about.**

```
  BEFORE:  apps read "clinket-dev"            -> physical index "clinket-dev"
  AFTER :  apps read "clinket-dev"  (ALIAS)   -> physical index "clinket-dev-v1"
```

‼️ **Consequences, all good:**
- **Zero consumer code changes.** Every `SearchClient` in API, Functions and MCP keeps reading the same setting.
- **Zero `deploy.ps1` app-setting changes.** All 6+ blocks keep pushing the same values — those values are now
  alias names. **Env-specific automatically**, because the env suffix is already in the name.
- **Every future index change becomes an atomic swap**: build `-v2`, load, verify, repoint the alias, drop `-v1`.

‼️ **An alias cannot share a name with an existing index.** So the cutover order matters, and this sandbox
rebuild is the perfect moment because the indexes are being deleted anyway:

1. Delete the existing physical `clinket-dev` / `clinket-knowledge-dev`.
2. Create physical `clinket-dev-v1` / `clinket-knowledge-dev-v1` **with the D-19/§3.4 compression**.
3. Create alias `clinket-dev` → `clinket-dev-v1`, alias `clinket-knowledge-dev` → `clinket-knowledge-dev-v1`.
4. Re-stream the data. Apps never knew anything changed.

### What to build

| # | Where | Change |
|---|---|---|
| 1 | `cosmosindexsetup/Program.cs` | A physical-version concept (e.g. an `AISearch:IndexVersion` setting, default `v1`, env-independent) so the physical name is `{name}{envSuffix}-{version}` while the **alias** is `{name}{envSuffix}`. Create/repoint the alias after the physical index is created and verified. **Idempotent**: re-running must not orphan an alias or a physical index |
| 2 | `cosmosindexsetup` | ‼️ **Verify alias support in the pinned `Azure.Search.Documents` version** (`SearchIndexClient.CreateOrUpdateAliasAsync`). If absent, upgrade the package or use REST. **Check, do not assume** |
| 3 | `azureautomation/deploy.ps1` | **No app-setting changes required** (the values are now alias names). BUT: audit `$script:RequiredFunctionAppSettings` (~L1852) and any validation that asserts the name resolves to a **physical index** — an alias would fail such a check. Add the alias to whatever gate covers index readiness |
| 4 | ARM templates | **Nothing.** Indexes and aliases are created by `cosmosindexsetup`, not ARM. State it explicitly in the summary so it is not treated as a missed step |
| 5 | `clinqetapi` `SearchAdminController.GetSearchHealth` | ‼️ **Aliases work for QUERY and DOCUMENT operations, but index MANAGEMENT operations (get index definition / statistics) generally require the REAL index name.** The health endpoint reads index statistics — **verify it works through an alias; if not, resolve the alias to its physical index first.** This is the most likely thing to break and the easiest to miss |
| 6 | Per region | Run for **CA and IN** via `--launch-profile` (`cosmosindexsetup` ignores a shell `CLINKET_REGION`). Record the commit each region was run at |
| 7 | Docs | Update the `clinqet-search-discovery` and `clinqet-voice-assistant` SKILLs (×4 dirs) — the naming convention changed, and a future reader must not assume the setting value is a physical index |

### Edge cases this adds (fold into §12.7)

| # | Case | Handling |
|---|---|---|
| E67 | An alias name collides with a surviving physical index | Delete the physical index first; the create-alias step must fail loudly, never silently skip |
| E68 | A management call is made through the alias and fails | Resolve alias → physical name for management operations (E5 of this list is the health endpoint) |
| E69 | `cosmosindexsetup` re-run after a version bump | Must be idempotent: repoint the alias, never duplicate physical indexes, and never leave the alias pointing at a deleted index |
| E70 | Alias repointed while queries are in flight | Azure makes the swap atomic; in-flight queries complete against whichever index they resolved. No special handling — but **do not** delete the old index until traffic has drained |
| E71 | A region is half-migrated (CA aliased, IN not) | The setting value works either way (name resolves to an index OR an alias), so this fails **soft**, which makes it easy to miss. **Assert the alias exists per region** at the end of the run |

## PHASE B — chunking quality (D-04)

**`clinqetinfrastructure/Services/Knowledge/KnowledgeDocumentParser.cs`**
- `ParseJson` / `TryFlattenJson`: detect the dominant homogeneous array of objects and emit a
  `KnowledgeBlockKind.Table` block (union of keys = header, each element = a row). Non-record parts
  (top-level scalars, the `branches` array) stay Paragraph/List. `.xlsx` (`ParseXlsx`) is the precedent
  to match.
- Fix the second entry point: `ParseText` tries `TryFlattenJson` **first**, so `.txt`-containing-JSON must
  get the same treatment.

**`clinqetinfrastructure/Services/Knowledge/KnowledgeChunker.cs`**
- The `Paragraph` branch: a **multi-line** paragraph keeps its line units instead of
  `NormalizeText` collapsing them. Route through the atomic-unit splitter used by `Preformatted`/`List`.
- ‼️ This path is contract-tested (§7.8b cases 1–33). Read the existing tests first; they encode the
  contract you must preserve. Add regression tests for the new behaviour.

**Acceptance criterion (owner's words):** the caller/AI output must be the best it can be and the AI must
be able to answer everything a caller asks. Prove it — re-ingest `toromont_machines.json` and show real
retrieval improving, not just the warnings disappearing.

## PHASE C — provider notification (D-05, D-06)

Adding a `NotificationType` touches **six** places (verified):
1. `clinqetshared/Enums/NotificationType.cs`
2. `clinqetcore/Services/Communication/NotificationRoutingCatalog.cs` — `Business(...)` with the routing
   class + permission key (`voice.settings.manage`)
3. `clinqetcore/Services/Communication/NotificationEchoCatalog.cs` — `Deliver("…")` with a reason
4. `clinqetshared/Models/CommunicationPreferenceConfig.cs` — the `VoiceAssistant` category set
5. `clinqetapi/Clinqet.API/appsettings.json` → `SignalRSettings:EnabledNotificationTypes`
6. The notification-route table (deep link → `/dashboard/profile/knowledge`) + the approved-table test.
   ‼️ **The enum count, echo catalog, routing catalog and approved table must stay byte-identical in
   membership** — there is a convention test.

Producer: `KnowledgeIngestProcessorFunction`, terminal outcome only, via
`IBusinessCommunicationDispatcher`. Never pre-set `SkipSignalR` in a business `requestFactory` — SEAM A's
per-recipient actor suppression is the only mechanism (see memory `signalr-self-echo-phase4-final-audit`).

Web: `clinqetwebpartnerapp/src/services/signalRService.js` (add the knowledge subscriber),
`src/components/Profile/knowledge/KnowledgePage.jsx` (subscribe → `refreshSilently()`, suppress toast).
Mobile (§0.7.1, SAME session): `clinqetmobilepartnerapp/src/Screen/ProfileFlow/Knowledge/index.tsx`.

## PHASE D — admin alerts (D-07, D-12, S4)

- `clinqetshared/Enums/AdminAlertType.cs` — `KnowledgeIngestFailed` + the search enrichment/embedding
  failure type(s). Append-only; never reorder.
- `clinqetfuncations/Clinqet.Communications/Services/FailureNotificationHelper.cs` — new handlers;
  `AdminAlertSettings` gets `EnableKnowledgeIngestFailureAlerts`,
  `EnableSearchEmbeddingFailureAlerts`, `EnableSearchEnrichmentFailureAlerts` — **all default true in the
  class AND appsettings** (`Clinqet.Communications.UnitTests/Conventions/AdminAlertSettingsConventionTests.cs`
  fails the build on drift).
- Bring the indexer's alerts under the same regime (they are cooldown-only today).
- `clinqetwebadmin/src/pages/alerts/AlertsPage.jsx` — register every new type in the list.
- Admin-internal wording is hardcoded English (§3.6). Metadata must be self-sufficient to act on.

## PHASE E — search-index resilience (D-09, D-10, D-12)

- `IAzureSearchIndexer` result shape: report which leg failed (enrichment / embedding / both).
- `SearchIndexSyncFunction` + `ChangeFeedFailureReplayFunction`: aggregate per invocation, enqueue for
  automatic retry, raise ONE aggregated alert only when retries are exhausted.
- `AzureSearchIndexer`: a 429 bubbles (D-09); a genuine outage still degrades to zero-vector + alert.

## PHASE F — admin resync surface (D-11)

- `clinqetapi/Clinqet.API/Controllers/Admin/SearchAdminController.cs` — add
  `POST admin/search/reindex-service/{businessId}/{serviceId}`, enqueueing a `ChangeFeedFailureMessage`.
- `clinqetwebadmin` — `monitoringService.js` + a Search Operations panel; wire per-service, per-business
  and the visibility report; deep-link from `AlertsPage.jsx`.
- ‼️ **A new admin page/panel is a new interface ⇒ the §0.7.1 MOCKUP GATE applies.** Build the isolated
  HTML mockup under `C:\Nik\mockups\` showing web AND mobile and **every state** (empty, loading, error,
  permission-denied, limit-reached) and get owner approval **before** any integrated UI code.

## PHASE G — vector compression on BOTH vector indexes (D-13, D-14, D-17, D-18, D-19)

‼️ **§3.4 IS THE SINGLE SOURCE OF TRUTH for the configuration. Copy it from there — do not retype it from memory,
and do not trust any other paraphrase in this document.**

### The two files, one config

| Index | File | Vector field |
|---|---|---|
| **`clinket-services`** | `cosmosindexsetup/Program.cs` (~L537) | `textEmbedding` |
| **`clinket-knowledge`** | `KnowledgeSearchIndexInitializer.cs` | `contentVector` |
| `clinket-providers` | — | ‼️ **NOTHING — it has no vector field (D-17)** |

Add `vectorSearch.compressions` to **both**, and point each profile at it:

```
kind                                 : binaryQuantization        # NOT scalar
truncationDimension                  : 1024                      # MRL — docs floor, NOT 768
rescoringOptions.enableRescoring     : true                      # NEVER false
rescoringOptions.defaultOversampling : 10
rescoringOptions.rescoreStorageMethod: preserveOriginals          # NEVER discardOriginals
```

### Non-negotiables

- ‼️ **Both vector fields keep `retrievable`/`stored` = TRUE** (D-14). Do NOT set `stored: false` on either.
- ‼️ **Existing fields only** — same names, same types, same `dimensions` (3072). **No `textEmbeddingV2`, no
  side-by-side field, no dual-write** (D-25).
- ‼️ **HNSW is UNCHANGED** — cosine, m=10 (already the maximum supported m), efConstruction=400, efSearch=500.
- ‼️ **Use the `RescoringOptions` shape**, not the legacy `RerankWithOriginalVectors` / top-level
  `DefaultOversampling` (§3.5). SDK `Azure.Search.Documents` **12.0.0** is pinned and **verified to expose every
  needed symbol** — no upgrade required.
- ‼️ **Correct spelling is `truncationDimension`** (`TruncationDimension` in .NET). `truncateDimension` on one
  Microsoft page is a documentation typo — never send it.
- ‼️ **Runs AFTER Phase A, never before** (D-18): the re-index IS the bulk embedding load that caused the incident.
- ‼️ **Per region — CA and IN** — always via `--launch-profile`; `cosmosindexsetup` **ignores a shell
  `CLINKET_REGION`**. Record the commit each region was run at.
- Both indexes are **dropped and recreated** (compression cannot be added in place), then re-indexed. Sequence with
  the alias work in §5.1 so the cutover is not a queryless window.
- Afterwards: **re-run the §3.1 POC harness and record the measured storage + recall** in the final audit.

## PHASE H — localization

- Backend (5): `clinqetinfrastructure/Resources/Localization/{en,es,fr,gu,hi}.json`
- Partner web (5): `clinqetwebpartnerapp/public/lang/{en-US,es-US,fr-CA,gu-IN,hi-IN}.json`
- Partner mobile (5): `clinqetmobilepartnerapp/src/Locales/{en,es,fr,gu,hi}.json`
- Existing knowledge failure keys to reuse (do not duplicate): `Error_KnowledgePasswordProtected`,
  `Error_KnowledgeUnreadable`, `Error_KnowledgeTooManyPages`, `Error_KnowledgeNoReadableContent`,
  `Error_KnowledgeUnsupportedFormat`, `Error_KnowledgeGenericRetry`, `Error_KnowledgeSpaceFull`.
- ‼️ i18next pluralizes only ONE count per key (memory `voice-knowledge-nudge-placement-copy`).

---

# 6. TESTS — §0.18 PLACEMENT MAP (get this right)

**A library class is tested from the suite of the HOST whose runtime path invokes it.**

| What | Where the tests go | Why |
|---|---|---|
| `AzureAIFoundryEmbeddingService` batching / retry / pacer | **`Clinqet.API.UnitTests`** | The API host binds `AzureAIFoundry` and drives the live search path. Verify the primary consumer before choosing |
| `KnowledgeChunker`, `KnowledgeDocumentParser` | **`Clinqet.Communications.UnitTests`** | The ingest function is the runtime consumer |
| `KnowledgeIngestProcessorFunction` | `Clinqet.Communications.UnitTests` + `.IntegrationTests` | Service Bus processor ⇒ integration tests **MANDATORY** (§0.8) |
| `AzureSearchIndexer` result shape, aggregation | `Clinqet.Communications.UnitTests` | Change feed is the consumer |
| `SearchAdminController` endpoints | `Clinqet.API.UnitTests` + `.IntegrationTests` | New endpoints ⇒ both mandatory |
| Notification catalogs / convention tests | Follow the existing convention-test homes | Each scans its own repo only (§0.15/§0.17) |
| Admin app UI | `clinqetwebadmin` own tests | §0.17 |
| Partner web UI | `clinqetwebpartnerapp` own tests | §0.17 |

Patterns: xUnit + Moq + AutoFixture (unit); `ClinqetApiFactory` + Testcontainers + `TestTokenHelper`
(integration). Read the existing suites first and match them exactly.

‼️ **A test capture across a parallel fan-out MUST be a concurrent collection** — a plain `List`/
`Dictionary` loses items and the off-by-one only shows in CI, reading as a bug in the SUT (memory
`test-captures-across-parallel-fanout`).
‼️ **Never re-run a slow suite you already have evidence for** — filter to the class that answers
(memory `feedback-dont-rerun-slow-suites`).
‼️ **`--no-build` can pass on STALE binaries.** Build, then test.

**Regression tests this fix pack owes:**
- A 539-card document produces **N token-bounded requests, none over the configured ceiling** — and a
  sabotage run proves the guard fails when the ceiling is removed.
- A 429 with `retry-after-ms` waits the header value, not the exponential floor.
- Interactive lane is never delayed by the bulk pacer.
- `toromont_machines.json`-shaped JSON yields Table-block cards with **no card straddling a record**.
- A multi-line `Paragraph` no longer collapses to one sentence.
- `KnowledgeDocumentFailed` fires **once, on terminal failure only, never on Ready**.
- Every new `AdminAlertSettings` flag is true in class AND appsettings.
- 500 failing services produce **1** aggregated alert, not 500.

---

# 7. VERIFY, CLEAN UP, DOCUMENT

1. **Build** every affected project. **Run** the affected tests — 100% pass, no skips.
2. **ESLint zero errors** on every changed UI project.
3. **§0.16 — leave the tree clean.** Delete every scratch artefact; never write one inside a repo (use the
   session scratchpad). Look at `git status --porcelain` in **each** repo you touched. Delete anything your
   change orphaned: dead code, unused imports, orphan appsettings keys, stale DI registrations. **Delete
   any temporary Azure index you create.** State in your summary what you removed.
4. **§0.9 — update the SKILLs in all four AI-tool directories** (`.claude/skills/`, `.github/skills/`,
   `.agents/skills/`, `.cursor/rules/*.mdc`): `clinqet-voice-assistant`, `clinqet-search-discovery`,
   `clinqet-infrastructure`, `clinqet-function-app`, `clinqet-notifications`, `clinqet-admin-app`.
5. **Memory**: add an entry + a one-line `MEMORY.md` pointer.
6. **ARM + `deploy.ps1`**: no new queue/container is expected. If you add any `local.settings.json` key,
   `azureautomation` must change in the same edit (§25).

---

# 8. THE FINAL AUDIT — MANDATORY, END TO END, EXTREMELY DETAILED

After implementation, run a full multi-dimensional audit of your **own** output and write it to
`C:\Nik\voice-answer-ladder\PHASE-4-FINAL-AUDIT.md`. Cover, minimum:

1. **Every decision D-01…D-32**: implemented, partially, or not — with the file:line proof.
2. **Every open item O-1…O-5**: still open, or resolved with the owner's answer quoted.
3. **The incident itself**: re-ingest `toromont_machines.json` and show it reach **Ready** — card count,
   request count, tokens per request, warnings, and **real retrieval quality** (D-04's acceptance
   criterion is the caller's answer, not the absence of warnings).
4. **Sabotage proofs, not just green runs.** A pin only counts if removing it makes the test FAIL. Prove:
   the token ceiling, the `Retry-After` honouring, the Interactive-never-paced guarantee, the
   success-path silence of the notification.
5. **Cross-lane proof**: a bulk ingest running concurrently with live search + live voice retrieval must
   not 429 them.
6. **Counts re-measured, not copied**: notification-type count, echo/routing catalog membership,
   `AdminAlertSettings` flag count, localization key parity across all 15 files.
7. **The negative space**: what did you NOT do, and why. Anything you found and deferred.
8. **Every scratch artefact deleted** — cloud and local — with `git status --porcelain` output per repo.

---

# 9. HOW TO WORK THIS SESSION

- **Read first, code second.** This file → `INCIDENT-AND-FIX-RECOMMENDATION.md` → `PLAN.md` §7 →
  `CLAUDE.md` → the relevant SKILL.md files → the actual code end to end. Never skim a large file.
- **No assumptions. No hallucinations. No workarounds. Production-ready code only.** If you cannot verify
  a path, symbol, setting or behaviour, read the code or ASK — never guess.
- **Every decision in §4 is approved — just do it.** Do not re-ask, do not re-litigate, do not re-plan
  what is already decided.
- **For anything in §4.1 (O-1…O-5), or any architectural change, or anything needing a §0.7 gate — STOP
  and ask the owner first.** A plan document is not approval; only the owner saying yes, in the current
  conversation, is approval.
- **Owner's standing quality bar:** *quality over speed.* Finish completely; never stop half way.
- Report faithfully: if a test fails, say so with the output. If you skipped something, say so.

---

# 10. ‼️ CONCURRENT-SESSION WARNING (observed 2026-08-18, during the investigation session)

**Another session was editing this tree live while this plan was being written.** Uncommitted changes were
observed in `clinqetapi`, `clinqetinfrastructure`, `clinqetshared`, `clinqetwebpartnerapp` and
`clinqetwebadmin` — a voice-training-consent feature adding `AdminAlertType.VoiceTrainingConsentChanged`
plus matching edits in `AlertsPage.jsx`, `AdminAlertController.cs`, `VoiceAssistantService.cs`,
`VoiceAssistantDtos.cs`, `UserActivityTypes.cs` and the API `appsettings.json`.

‼️ **Those files overlap this fix pack directly** — D-07 and D-12 both modify `AdminAlertType.cs` and
`AlertsPage.jsx`, and the alert-settings work touches the API `appsettings.json`.

**Before you start:** run `git status --porcelain` and `git log --oneline -5` in EVERY repo you intend to
touch. Re-read the current content of `AdminAlertType.cs`, `AlertsPage.jsx` and `AdminAlertSettings`
immediately before editing them — do NOT trust the counts or line numbers in this document for those files.
Append new enum values; never reorder, never renumber, never clobber another session's additions.
If you find your edits and theirs conflicting, STOP and tell the owner rather than resolving it silently.

**A measurement without a commit stamp is unfalsifiable in this environment** — snapshot every count you
assert with the commit it was taken at.

---

# 11. DESIGN STATUS BOARD — what is settled, what is still a gate

## 11.1 SETTLED — implement without re-asking (D-01 … D-24)

| Area | Status |
|---|---|
| Embedding: token-bounded batching, poison isolation, per-input guard | **SETTLED** (D-01) |
| Embedding: `Retry-After` / `retry-after-ms`, 429 split from 5xx, never retry 400, budget check before sleeping | **SETTLED** (D-02, D-16a) |
| Bulk vs Interactive lanes + process-wide pacer — embeddings **and** completions | **SETTLED** (D-03, D-20) |
| Change-feed concurrency governed by the pacer, lease-timing check | **SETTLED** (D-21) |
| A 429 on embedding **or** enrichment retries; degraded publish reserved for a real outage | **SETTLED** (D-09, D-22) |
| Batched embeddings in the change feed (enrichment stays per-service) | **SETTLED** (D-24) |
| Recovery sweep capacity raised + paced | **SETTLED** (D-23) |
| JSON-as-table + the multi-line `Paragraph` trap | **SETTLED** (D-04) |
| `KnowledgeDocumentFailed` notification — failure only, terminal only, silent on-page refresh, mobile parity | **SETTLED** (D-05, D-06) |
| Admin alerts: 3 new types, 3 new flags **default true** in class + appsettings, aggregated one-per-invocation, fire only after auto-retries exhausted, self-sufficient metadata | **SETTLED** (D-07, D-12) |
| Recovery order: auto-retry via `change-feed-failures` → then alert → then admin button | **SETTLED** (D-10) |
| Admin API: build `POST admin/search/reindex-service/{businessId}/{serviceId}`; trigger by enqueueing a `ChangeFeedFailureMessage`, never by touching Cosmos | **SETTLED** (D-11) |
| Quantization: BQ + rescoring + oversampling 10 + `preserveOriginals` + MRL `truncationDimension: 1024`, both vector indexes; `stored` stays true; provider index untouched | **SETTLED** (D-13, D-14, D-17, D-19) |
| Sequencing: Phase A ships before any index rebuild | **SETTLED** (D-18) |
| `MaxPassagesPerBusiness` stays 2000 | **SETTLED** (D-15) |

## 11.2 ‼️ PENDING — a gate, not a decision

| # | Pending | Blocks |
|---|---|---|
| **G-1** | ~~Mockup approval for the admin web surfaces~~ — **WAIVED BY THE OWNER** | ‼️ Owner decision: **no mockup approval is required for the admin app**, provided the work follows the admin app's **current design system and structure**. So: reuse the existing `clinqetwebadmin` page shell, table/card patterns, button and chip styles, spacing, toasts and the existing Alerts-page layout conventions — introduce **no new visual language**. The §0.7.1 mockup gate still applies in full to **provider-facing** and **customer-facing** surfaces; it is waived for admin-only screens. **Nothing blocks Phase F any more** |
| **O-1** | `RetrievalTopK` (5) / `RetrievalMaxTokens` (1500). **Measure live-call latency + per-turn token cost, present numbers, WAIT** | Nothing — a later tuning step |
| **O-2** | Search tier / topology for real scale — now larger in scope given §3.2 (50M+ documents is a sharding question, not a compression one) | The index rebuild can proceed on the current tier; this is growth planning |
| **O-4** | Whether the *proactive* un-enriched sweep is in scope (owner leaned to the `SearchIndexAuditFunction` piggyback — no schema change) | Nothing — D-10/D-11 already give reactive recovery |
| **O-5** | `AddResilientConsole` duplicate telemetry — pre-existing, cost-only | Nothing — raise separately |
| **O-6** | Confirm the assumed 500K TPM / 3K RPM for `gpt-5.4-mini` in the portal | Only the final pacer numbers; start from the assumption |

‼️ **NOTHING IS BLOCKED. Every phase can start immediately.**

‼️ **AND: the entire scale / tenant-filtering investigation (§15) is OUT OF SCOPE — deferred by the owner to a separate session.** It changes **nothing** in this plan. See `SCALE-FILTERING-NOTES.md`.

---

# 12. ‼️ EDGE-CASE MATRIX — SWEEP THE SPACE, NOT JUST THE REPORTED CASE

Owner mandate: *"expect the unexpected — in every edge case scenario it needs to work."* Every row below is a
case this fix pack must handle. **A row with no test is not done.** Cases already handled correctly today are
marked so you preserve them rather than re-solve them.

## 12.1 Embedding batching (D-01, D-24)

| # | Case | Required handling |
|---|---|---|
| E1 | A single input exceeds the **8,192-token per-input** limit | Detect **before** the request; truncate deterministically or fail that input alone. Never let it 400 the batch |
| E2 | One oversized/poison input inside a healthy batch | Poison isolation: retry the batch, then each input singly. 49 good services must not die for 1 bad one |
| E3 | A single input alone exceeds the per-request ceiling | It still ships as a batch of one — an input can never be split. If it also breaks the 300K hard cap, fail it explicitly with a clear reason |
| E4 | Token estimate under-counts (`chars/4`) and the real request 400s on the aggregate cap | **Adaptive halving**: on a 400 that names the token cap, split the batch and retry. Never retry the same oversized payload |
| E5 | Partial cache hit — some inputs cached, some not | Index alignment must survive. The existing code aligns results by original index; **prove it still holds with sub-batching** (a test with a deliberately mixed cache) |
| E6 | Duplicate identical inputs in one batch | Dedup by content hash inside the batch and fan the single vector back to every position. Real saving on a bulk load of similar listings |
| E7 | Batch exactly at the token ceiling | Off-by-one test at ceiling-1, ceiling, ceiling+1 |
| E8 | Empty / whitespace-only input | Already returns `[]` for that position — preserve |
| E9 | Every input cached | Zero HTTP requests — preserve |
| E10 | ‼️ **Embedding cache accounting is wrong today** | `Search:EmbeddingCache:MaxSize` counts **entries** and every entry is `Size = 1`, but a 3072-float vector is **~12 KB**. 5,000 entries ≈ **60 MB** of real memory the limiter believes is "5,000 units". A bulk load fills and thrashes it. Re-derive the cap from real bytes, or document the true memory ceiling. **Do not leave the mismatch undocumented** |

## 12.2 Retry, throttling and the pacer (D-02, D-03, D-09, D-20, D-22)

| # | Case | Required handling |
|---|---|---|
| E11 | `Retry-After` sent as an **HTTP date** rather than a delta | `response.Headers.RetryAfter?.Delta` is null for date form — read `Date` too, or fall back to exponential. Today the null case silently loses the hint |
| E12 | `retry-after-ms` present but absurd (e.g. 10 minutes) | Clamp to a configured maximum; log when clamped so a systemic problem is visible |
| E13 | The required wait exceeds the remaining ingest deadline (480 s) | **Check remaining budget BEFORE sleeping.** Abandon cleanly so the session redelivers — never sleep past the deadline and die mid-batch |
| E14 | Host shutdown during a long backoff sleep | `OperationCanceledException` propagates first, before any other catch — the established pattern. Lock lapses, session redelivers |
| E15 | ‼️ **Thundering herd** — many bulk callers 429 together and all retry at the same instant | Jitter is mandatory (Polly `UseJitter` today — **keep it**), and the pacer must serialize the retry wave rather than releasing it at once |
| E16 | ‼️ **The pacer starves or deadlocks** | Every limiter acquire takes a **timeout** and a cancellation token. A bulk caller must never block forever. Permit exhaustion is a queue, never a hang |
| E17 | ‼️ **Interactive still 429s because the DEPLOYMENT is saturated by bulk** | The pacer must **under-subscribe** (bulk share strictly below 100% of TPM) so interactive always has headroom. This is the whole reason the share is a setting — a 100% bulk share defeats the design |
| E18 | Retries exhausted mid-document, earlier sub-batches already embedded | Cached vectors make the retry cheap, but **cache eviction may have dropped them** — correctness must never depend on the cache, only cost |
| E19 | ‼️ **A non-throttle failure is retried forever** | D-22 retries **throttles only**. A content-filter rejection, a persistently malformed LLM JSON response, or a 400 is **terminal** — bounded attempts then the aggregated alert. **An unbounded retry on a deterministic failure is a cost incident, not resilience** |
| E20 | Functions **scale-out** — N instances each with their own pacer | Per-process pacing multiplies by instance count. Stated limitation; `Retry-After` is the backstop. Size the share with the expected instance count in mind, and say so in the settings comment |

## 12.3 Change feed and bulk load (D-21, D-22, D-23, D-24)

| # | Case | Required handling |
|---|---|---|
| E21 | Paced invocation outlives the change-feed **lease** | `host.json` `extensions.cosmosDB`: `leaseExpirationInterval: 60000`, `leaseRenewInterval: 15000`. Verify a long paced invocation cannot lose its lease; if it can, **reduce `MaxItemsPerInvocation`** rather than blocking inside one invocation |
| E22 | A service is **edited** while its enrichment/embedding is in flight | The `UpdatedAtTicks` freshness guard wins. **Re-prove it under D-24 batching**, where a document's write now happens further from its read |
| E23 | A service is **deleted** while its vector sits in a pending batch | It must not be resurrected. Freshness guard + `SearchIndexDeleteFailureException` propagation |
| E24 | ‼️ **Change feed replays from the beginning** (`StartFromBeginning: true`) after a lease reset | The stored hashes make a replay cheap — **but only while the index still holds them.** After the rebuild they are gone (D-18), so a replay immediately after a rebuild is a full-cost reload. Sequence accordingly |
| E25 | 5,000 services arrive while a **knowledge ingest** is also running | Both are Bulk lane; they share the pace. Neither may starve the other into DLQ — verify the queue's `maxDeliveryCount: 5` is not consumed by pure waiting |
| E26 | ‼️ **The enrichment cache saves nothing on a cold load** | It is keyed by **content hash**, so 5,000 distinct services get zero reuse. Do not model bulk cost as if the cache helps — it only helps duplicate content |
| E27 | 409 **version conflict** — an admin resync races the change feed on the same document | Serialize or retry with backoff (Microsoft's guidance). Reachable the moment D-11 ships |
| E28 | 207 **partial batch** on index upload | Inspect **every** per-document `statusCode`; 503 ⇒ throttle and retry, 400 ⇒ terminal for that document. The existing indexer does this — **preserve it under batching** |
| E29 | Search-service **429 = storage pressure**, not rate limit | See D-27. Backoff never clears it; it needs an alert and a capacity action |

## 12.4 Knowledge parsing and chunking (D-04)

| # | Case | Required handling |
|---|---|---|
| E30 | JSON whose **root is an array** rather than an object containing one | Table detection must handle both shapes |
| E31 | ‼️ **Heterogeneous objects** in the array (different key sets) | A union-of-keys table becomes mostly empty cells. Apply a key-overlap threshold: below it, fall back to per-record blocks rather than emitting a sparse table |
| E32 | Nested arrays **of objects** (not just of strings) | Flatten into the parent cell (the chunker's existing nested-table rule, §7.8b case 13) |
| E33 | Multiple sibling record arrays in one file | Each becomes its own table/section — never merged into one |
| E34 | A JSON that is one huge object with **no arrays at all** | No table; falls through to Paragraph — and D-04's multi-line fix is what saves it. Test this path explicitly |
| E35 | Very deep nesting (10+ levels) | Cap path depth; a 200-character key path is noise on every card |
| E36 | Keys containing newlines, quotes, HTML or delimiter characters | Escape on both the HTML and the serialized paths |
| E37 | ‼️ **D-04 changes the card count, which moves when D25 fires** | Table row-groups may yield **more** cards than today's blob slicing. A 20 MB JSON (the `MaxFileSizeBytes` ceiling) could cross the 2,200 grace ceiling far sooner. Re-derive the interaction and make the space-full message actionable |
| E38 | A record so wide that one row exceeds `ChunkMaxTokens` | The chunker's oversize-row cell splitting already covers it (§7.8b case 12) — preserve |
| E39 | `.txt` containing JSON | `ParseText` tries `TryFlattenJson` **first** — the same fix must cover this second entry point |
| E40 | Numbers, booleans, nulls, empty strings | Nulls skipped today; keep. Zero and `false` must **not** be dropped as falsy |

## 12.5 Notification (D-05, D-06)

| # | Case | Required handling |
|---|---|---|
| E41 | Doc fails, provider notified, then Try-again succeeds | Notify on the **terminal** outcome only — never on an intermediate attempt |
| E42 | ‼️ **Second genuine failure of the same document after a Try-again** | A deterministic EventId on `(businessId, docId, reason)` alone would **dedupe the second failure into silence**. Include a generation discriminator (the row's `UpdatedAt.Ticks`) so a real second failure notifies again |
| E43 | Document deleted before the notification dispatches | Do not notify. The tombstone CAS already aborts the run |
| E44 | No member holds `voice.settings.manage` | Zero recipients — log and exit cleanly. Never throw, never dispatch to a partition nobody reads |
| E45 | ‼️ **The uploader must still be told** | Self-echo suppression must **not** silence a failure notice to the person who uploaded it. Set the echo-catalog entry deliberately and test it |
| E46 | Provider has web **and** mobile open, sitting on the Knowledge screen on both | Both suppress the toast and refresh silently; the bell still increments exactly once |
| E47 | Push to a stale/logged-out device | Existing ANH handling; a push failure must not fail the dispatch |
| E48 | The Knowledge page is mounted but **hidden** (background tab) | Existing polling already checks `document.visibilityState`; the subscriber path must not toast into a hidden tab and must refresh on return |

## 12.6 Admin surface (D-07, D-10, D-11, D-12)

| # | Case | Required handling |
|---|---|---|
| E49 | Admin resyncs a service that has since been **deleted** | The replay processor finds nothing and **completes cleanly** — never DLQ, never an alert |
| E50 | ‼️ **Admin resyncs a business with 5,000 services** | Do not flood the queue with 5,000 messages from one click. Enqueue one business-scoped message and let the processor fan out under the pacer, or cap and report what was queued. **Never silently truncate** |
| E51 | Admin double-clicks resync | Deterministic `messageId` so duplicate detection collapses it |
| E52 | Admin resync races the change feed on the same document | E27 — 409 handling; the freshness guard keeps it idempotent |
| E53 | ‼️ **Resolving an alert must not imply the service is fixed** | Resolution is a triage state, not a repair. Copy must not claim otherwise |
| E54 | 5,000 failures in one invocation | **One** aggregated alert with counts + the full `(businessId, serviceId)` list, not 5,000 alerts (D-12) |
| E55 | The aggregated list is enormous | Cap the inline list, carry the total, and **log what was elided** — a silent truncation reads as "that was all of them" |
| E56 | Admin lacks permission / session expired mid-action | 403 and 401 both surface honestly; the 401 must reach the session-expiry guard, not a bare toast |

## 12.7 The rebuild itself (D-13, D-18, D-19, D-25, D-26)

| # | Case | Required handling |
|---|---|---|
| E57 | ‼️ **Queries arrive mid-rebuild** | Without an alias this is a **queryless window** — services invisible to customers, the receptionist answering nothing. **This is what D-26 exists to remove.** If aliases are not adopted, the rebuild needs an explicit, communicated window |
| E58 | ‼️ **A provider uploads a knowledge document while the knowledge index is being rebuilt** | The ingest would target a missing index and fail the document. Either pause ingestion for the window or ensure the alias/new index exists before the old one is dropped |
| E59 | `truncationDimension` unsupported by the pinned `Azure.Search.Documents` | **Check before relying on it.** Upgrade the package or emit the compression block via REST. MRL has no portal support |
| E60 | Rebuild done, hashes gone ⇒ full re-enrichment of every service | Expected and unavoidable (D-18). It **must** run after Phase A, and it is the cold-load scenario of §2.6b — size the pace for it |
| E61 | Region drift — CA rebuilt, IN not | `cosmosindexsetup` **ignores a shell `CLINKET_REGION`**; always `--launch-profile`. Verify both regions and record which commit each was run at |
| E62 | A future compression change | **No rebuild needed** (D-25): add a new vector field with the new profile, **copy the existing vectors into it** (free, because `stored` stays true), repoint queries, drop the old field at some later rebuild |

## 12.8 Cross-cutting

| # | Case | Required handling |
|---|---|---|
| E63 | Both AI deployments down entirely | Live paths degrade (search → BM25, voice → miss inside budget) — already correct. Bulk fails retryably, one aggregated alert |
| E64 | A setting is missing or zero in one host but not another | Class defaults **mirror** appsettings (§0.12); a zero/absent pace must not mean "unlimited". Clamp every knob at its read site |
| E65 | ‼️ **A test capture across a parallel fan-out** | Must be a **concurrent** collection. A plain `List`/`Dictionary` loses items and the off-by-one appears only in CI, reading as a bug in the code under test |
| E72 | A filtered vector query runs against an index whose vintage defaults to `postFilter` | D-28 sets it explicitly; assert the index accepts `preFilter` rather than assuming |
| E73 | ‼️ Knowledge retrieval slows past `RetrievalSlowWarnMs` at scale | The `preFilter`/selectivity effect (§3.2c). It logs today — make sure that log is actually watched, because the caller-facing failure is a SILENT miss |
| E74 | Someone enables `exhaustive: true` to fix latency | It silently disables oversampling + rescoring and invalidates D-13/D-19. **Guard it with a test and a SKILL note** (D-29) |
| E66 | The concurrent session's changes collide with ours | §10. Re-read `AdminAlertType.cs`, `AlertsPage.jsx` and `AdminAlertSettings` immediately before editing; append, never reorder; stop and ask rather than resolving silently |

---

# 13. ‼️ UNVERIFIED ASSUMPTIONS REGISTER — everywhere this plan is SOFT

Owner asked directly: *"tell me where you weren't sure, or assumed, or took the safe route."* This is that list.
**Every row is something this plan leans on that was NOT verified.** Nothing here blocks implementation, but
each one is a place a confident-sounding number could be wrong.

| # | Soft claim | Why it is soft | How to close it |
|---|---|---|---|
| ~~**U-1**~~ | ~~Business-scoped filtering insulates the knowledge index~~ — **CLOSED. The default is `preFilter`, but my claim was TOO STRONG and is now corrected.** | Owner research: the default **is `preFilter`** for indexes created after ~15 Oct 2023 (ours are new). **Relevance IS tenant-isolated.** ‼️ **But `preFilter` does NOT build a per-tenant HNSW graph** — Azure applies the filter *during traversal of the shared graph* and warns a selective filter may force traversal of *"a significant portion of the graph"*. **Microsoft's own benchmark: at 1 million vectors with a filter retaining <2% of the corpus, `preFilter` was ~7x SLOWER than `postFilter`** (same ~7x at 1 billion). ⇒ See §3.2c and D-28 | Closed |
| **U-2** | `gpt-5.4-mini` = 500K TPM / 3K RPM | **An owner-supplied working assumption, not a fact.** The whole ~90-minute cold-load figure derives from it | Read it in the Azure portal |
| **U-3** | ~3,500 tokens per enrichment call | **My estimate** of prompt + completion for `SearchIndexEnrichment` (large system prompt, `MaxCompletionTokens: 8000`). Never measured | Read actual `PromptTokens`/`CompletionTokens` from `GetCompletionWithUsageAsync` on a real run |
| **U-4** | The incident document was ~340–380K **real** BPE tokens | **Extrapolated** from the code's `chars/4` estimate (276K) times a 1.25–1.4 fudge. Never tokenized | Run the text through a real `cl100k`/`o200k` tokenizer |
| ~~**U-5**~~ | ~~Azure admits ~TPM/6 tokens per 10-second burst window~~ — **CLOSED: REFUTED. My arithmetic was WRONG.** | Owner research against current Microsoft docs: **TPM is a running estimated-token counter that is "reset each minute"** — there is **no 10-second token sub-bucket, no TPM/6 allowance, and NO documented rule that a single request over any fraction of TPM is rejected.** The 1-/10-second language belongs to **RPM** burst enforcement, not TPM (their example: a 600-RPM deployment evaluated per second throttles above 10 requests in one second). I conflated the two. ⇒ **The 40,000 ceiling loses its derivation** and the pacer is redesigned header-driven — see §3.6 and D-30 | Closed |
| **U-6** | MRL 1024 ≈ 1.6–1.7 GB vector index at 8.8M | **Interpolated**, then corroborated only **second-hand** (the 100K-vector 41.88→17.47 MB figure came from the owner's research, not a source I read) | Verify that source, or measure with the POC harness |
| ~~**U-7**~~ | ~~The Oct-2024 MRL numbers~~ — **CLOSED, VERIFIED FIRST-PARTY by the owner** | The owner opened the original post and confirmed **Table 1.2** of *"Azure AI Search October Updates: Nearly 100x Compression with Minimal Quality Loss"* (**8 October 2024**, `techcommunity.microsoft.com/blog/azure-ai-foundry-blog/.../4265447`). Metric: **Mean NDCG@10 across a subset of MTEB**, versus the uncompressed index. `text-embedding-3-large` 3072→**1024**+BQ = **−7.00%** without rerank, **−0.58%** with 2x oversampling + rerank; 3072→**1536**+BQ = −5.00% / **−0.06%**. Microsoft cite the 1024/BQ result in their "**99% search quality**" conclusion and state 3072→1024+BQ reaches **96x compression**. ‼️ **And the post explicitly recommends using roughly 1/2 or 1/3 of the original dimensions** — for 3072 that is **1536 or 1024**, so **1024 is exactly Microsoft's stated 1/3 point, not an edge value.** Our production config uses **oversampling 10**, more conservative on reranking than the 2x that produced −0.58% | — |
| **U-8** | Enrichment LLM call latency | **Unknown.** I deliberately refused to invent one, but change-feed throughput depends on it entirely | Measure p50/p95 from App Insights `dependencies` |
| **U-9** | Index **aliases** work for the admin health endpoint | Flagged, not verified. Aliases serve query + document operations; **index MANAGEMENT calls (statistics, definitions) may require the real index name** | Call `GET /indexes/{alias}/stats` against a real alias |
| **U-10** | A long paced change-feed invocation cannot lose its lease | Flagged, not verified. `leaseExpirationInterval: 60000`, `leaseRenewInterval: 15000` | Read the Cosmos change-feed processor renewal semantics; test with a deliberately slow handler |
| **U-11** | `stored: false` coexists with `preserveOriginals` rescoring | **Never verified — which is exactly why D-14 withdrew the recommendation.** Taking the safe route was deliberate | Read the storage-options page on the three vector instances |
| **U-12** | Search-tier vector-index quotas above Basic | **PARTIALLY ANSWERED** by the multitenancy research (§15.7): **index-count** limits are now known — S3 HD 3,000/service (1,000/partition, max 3 partitions), ordinary S3 200/service, default quota 6 S3 HD services per region, S3 HD max index 100 GB. ‼️ **Still unknown: the per-tier VECTOR-INDEX size quotas** (only Basic's 5 GB was measured live). Those are what cap total vectors, so they remain open | Read the current service-limits table for `vectorIndexSize` per tier |
| **U-13** | 50M documents fit in one index at all | **Never researched** — explicitly deferred as a topology exercise | Capacity planning with the limits table (O-2) |
| **U-14** | The 8.8M NDCG table | **Tier-2 source**: a first-party Microsoft blog, not documentation. Microsoft themselves caveat *"your exact results may vary"* | Nothing further — it is the best available; just do not cite it as documentation |
| **U-15** | ~90 minutes to make 5,000 services searchable | **Derived from U-2 x U-3.** If either is wrong, so is this | Close U-2 and U-3 |

**Deliberate safe routes taken (not errors — record them so they are not mistaken for findings):**
- `stored` stays **true** on both vectors rather than chasing extra disk savings (U-11 unverified).
- `truncationDimension: 1024`, **not** 768, despite 768 measuring fine at 8.8M — the documentation's floor wins.
- **`discardOriginals` refused outright** on measured evidence, even though it is the only path to the $75 tier.
- Enrichment is **not** batched (only embeddings are) — batching prompts risks cross-contamination between listings.
- MRL **not** taken below 1024 and **not** raised to 1536/2048 merely to clear a sentence.

---

# 14. OPEN RESEARCH BRIEFS (owner-run)

Two questions the owner is researching. **Neither blocks implementation** — both refine a number or confirm a
claim. Fold the answers in when they arrive and strike the matching row from §13.

## 14.1 U-1 — `vectorFilterMode`: pre-filter or post-filter? *(highest value)*

**Question:** *In Azure AI Search, when a vector query includes a `filter`, what is the DEFAULT
`vectorFilterMode` — `preFilter` or `postFilter` — and what does each do to the candidate set?*

**Follow-ups:** Does `preFilter` restrict the vector search to only matching documents, or does it still
traverse the whole HNSW graph? · Is the default different for HNSW vs exhaustive KNN? · Any guidance on which
mode to use **with quantization/compression**?

**Where:** the `vector-search-filters` doc; the Search Documents REST reference entry for `vectorFilterMode`.

**Verified starting point:** `vectorFilterMode` is **never set anywhere** in `clinqetinfrastructure` or
`clinqetcore` (grepped — zero hits), so Azure's default is what we get today.

**Why it decides something real:** every knowledge query filters `businessId eq '…'`, and a business is capped
at 2,000 passages.
- **If `preFilter`** ⇒ each query searches only that business's passages ⇒ the knowledge index is **immune to
  corpus-scale degradation** even at 5M providers, and §3.2b's insulation claim stands.
- **If `postFilter`** ⇒ the vector search runs across the **whole index** and filters afterwards ⇒ the knowledge
  index carries the **same scale risk as the services index**, §3.2b's claim is **WRONG**, and we should set the
  mode explicitly and/or re-measure the knowledge index at scale.

## 14.2 ~~U-5~~ — **CLOSED. Answered by owner research; see §3.6, D-30 and D-31.**

**Outcome: my `TPM ÷ 6` assumption was REFUTED, and the headers exist.** Microsoft return
`x-ratelimit-limit-tokens` / `-remaining-tokens` / `-limit-requests` / `-remaining-requests` and explicitly
recommend throttling off them; `retry-after-ms` is documented in milliseconds; `x-ratelimit-reset-*` units are
**undocumented** so they must not drive timers. The pacer is now a header-driven governor (D-30) and the
40,000 ceiling is a bootstrap safety net rather than a derived value (D-31). The original brief is kept below
for the record.

### Original brief (answered)

**Question:** *For Azure OpenAI Standard / Global-Standard deployments, how is the TPM limit enforced over
time — what is the evaluation window, and what token allowance applies per window? Is there any documented
statement that a single request exceeding some fraction of TPM will always be rejected with 429?*

‼️ **The follow-up that matters MORE than the question:** *What rate-limit response headers does Azure OpenAI
return — `x-ratelimit-remaining-tokens`, `x-ratelimit-remaining-requests`, `x-ratelimit-limit-tokens`, or
similar?*

**Why the follow-up is the bigger prize:** if those headers exist, the bulk pacer should read **Azure's own
reported remaining budget** instead of any static formula. That is **strictly better** than a configured share:
it self-corrects when quota changes, it needs no assumption about window size, and it **deletes U-5 from the
register entirely**. ‼️ **If the headers exist, redesign D-03/D-20's pacer to consume them** — a header-driven
pacer supersedes a share-of-TPM pacer.

**Why the main question matters:** it sets `MaxTokensPerRequest`. The current **40,000** came from
"TPM ÷ 6 per 10 seconds" — **my arithmetic, not a documented Microsoft formula** (the docs only say bursts
within 1s/10s windows can trigger 429; they publish no per-window allowance). A generous real allowance ⇒ raise
the ceiling and cut request count further. A tight one ⇒ lower it.

**Status of the other soft rows:** U-2 (gpt-5.4-mini quota) is an owner working assumption of 500K/3K.
**U-4 and U-7 the owner is checking.** U-12/U-13 (tier limits, whether 50M documents fit one index) the owner
has explicitly deferred — **do not treat that as researched, and do not quote a scale conclusion from it.**

---
# 15. SCALE + TENANT FILTERING — ‼️ OUT OF SCOPE FOR PHASE 4

A scale-architecture investigation ran alongside this fix pack. **The owner has deferred ALL of it to a separate
future session.** The full record — findings, measurements, candidate designs and rejected options — is in
**`SCALE-FILTERING-NOTES.md`**.

## What you need to know here, and nothing more

| | |
|---|---|
| ‼️ **Does any of it change the compression decision?** | **NO.** Compression and the filtering problem are **independent mechanisms**. Compression *helps* the filtering problem (cheaper comparisons per traversal step). **D-13 / D-14 / D-17 / D-18 / D-19 stand exactly as written. Implement them unchanged.** |
| **Does any of it change the embedding fix?** | **NO.** D-01 … D-03, D-30, D-31 stand unchanged |
| **Does any of it change the notification / alert / admin work?** | **NO.** D-05 … D-12 stand unchanged |
| **Index aliases (D-26)?** | ‼️ **IN SCOPE — owner-approved.** They belong to the **rebuild**, not the filtering work: without an alias the index rebuild is a hard cutover with a queryless window. Full end-to-end plan in **§5.1** |
| **Is there anything ELSE from it to BUILD in Phase 4?** | **Exactly one thing: D-28** — set `vectorFilterMode: preFilter` explicitly. It is set **nowhere** today, so every filtered vector query runs on a default nobody chose. Three lines, correct hygiene |
| **D-29 and D-32** | ‼️ **OUT OF SCOPE — do not build.** They are findings, not work items. D-29 is a SKILL note (never enable `exhaustive: true` without re-opening D-13/D-19). D-32 is the finding that both voice paths are exposed. Both live in the notes file |

## ‼️ DO NOT do any of this in Phase 4

- Do **not** shard any index. Do **not** add a shard directory or an index-resolver seam.
- Do **not** create a second catalog index.
- Do **not** build in-memory / local vector scoring.
- Do **not** persist embeddings outside the search index.
- Do **not** enable `exhaustive: true` anywhere.
- Do **not** change `RetrievalTopK`, `RetrievalMaxTokens`, `MaxPassagesPerBusiness`, or any HNSW parameter.

**If the work seems to require any of the above, STOP and ask the owner. It means the scope has drifted.**
