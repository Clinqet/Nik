# KNOWLEDGE INGEST — INCIDENT ANALYSIS + FIX RECOMMENDATION

Incident: `toromont_machines.json` (792,707 bytes) uploaded to AI Knowledge, business `SX3SG2`,
doc `9d7694dda1ad432c917d9c4bb09a8ee0`, 2026-08-17 22:09 — row settled **Failed**
("Something went wrong while reading this file. Try again."), DeliveryCount 4.

**Nothing is implemented. This document is for owner review and sign-off.**

---

## 0. THE ONE-LINE ANSWER

The 429 is **not** a quota problem and **no TPM value can fix it**. The ingest sends *every* card of a
document in **one** `/embeddings` request — 539 inputs, ~1.1 MB, ~276,000 estimated tokens — against
Azure's documented **300,000-token-per-request hard cap** and a burst window that admits ~83,000 tokens
at 500K TPM. The retry then made it worse by re-firing four times in four seconds while Azure was asking
for a 40-second cool-down. The chunker warning is a separate, real, quality defect — a symptom, not the
cause.

---

## 1. WHAT ACTUALLY HAPPENED — MEASURED, NOT ASSUMED

Pipeline replicated faithfully off the real file (`ParseJson` → `NormalizeText` → `SplitSentences` →
`CardBuilder`, with the live settings `ChunkTargetTokens 350 / ChunkMaxTokens 512 / ChunkMinTokens 120 /
ChunkOverlapPercent 15`):

| Stage | Measured |
|---|---|
| Raw upload | 792,707 bytes |
| `TryFlattenJson` output | **1,018,661 chars** across 24,570 `path: value` lines |
| After `NormalizeText` (every newline → space) | 1,018,619 chars — **one single-line blob** |
| Sentences found (`.`/`!`/`?` + whitespace, abbreviation-guarded) | **111** for a 1 MB document |
| Of those, over `ChunkMaxTokens` | **55** ⇒ 55 `Oversize sentence split at word boundaries` warnings |
| Cards produced | 538 + 1 `DocSummary` = **539** |
| D25 gate (`MaxPassagesPerBusiness` 2000 × grace 1.10 = 2200) | **passed** — 539 < 2200 |
| The single embed request | **539 inputs, ~1,103,872 chars, ~275,968 estimated tokens** |

> The log showed 25 warnings because the portal's Invocation-details pane truncates the trace list. There
> were 55.

### Why the request could never succeed

Azure `/embeddings` documented limits: **8,192 tokens per input**, **2,048 inputs per array**,
**300,000 aggregate tokens per request** (HTTP 400 above that).

- `chars/4` is the codebase's own estimator (`KnowledgeChunker.ApproxTokens`). For this content —
  `records[123].features[7]: ARTICULATION GUARD`, brackets, digits, ALL-CAPS model codes — real BPE
  tokenization runs materially **higher** than chars/4, plausibly 340K–380K. So the request sits **at or
  over the 300K aggregate cap**, independent of any rate limit.
- Rate limiting is evaluated as a running per-minute counter, and bursts inside 1s/10s windows also
  trigger 429. At the new **500K TPM** that is roughly **83K tokens per 10-second window**. The request
  needs 276K+ in one shot — ~3.3× the whole window.
- To admit it on burst grounds alone would need ≳1.7M TPM. Your deployment shows **951K TPM of quota
  available**. Even spending all of it is short by about half — and it would still hit the 300K
  per-request cap.

**Conclusion: the batch must be token-bounded in code. Quota is not the lever.**

### Why the retry made it worse

`AzureAIFoundryEmbeddingService.BuildResiliencePipeline()`:

- 3 attempts, `DelayBackoffType.Exponential`, `Delay = 1s`, jitter → observed **0.82 s, 1.25 s, 1.53 s**.
- Azure's body said: **"Please retry after 40 seconds."**
- `Retry-After` / `retry-after-ms` is **never read**. 429 is grouped with 408/500/502/503/504 in
  `IsTransientError` and gets the identical sub-second schedule.

Four rejected requests in four seconds, each one more RPM spent against a deployment that was already
throttling — then a hard failure. Microsoft's guidance is the opposite: honour `retry-after-ms`, else
exponential **with jitter and a real floor**.

On failure the message Abandons, and the **entire** document is re-paid next delivery: extraction, the
D11 `{title, summary, language}` LLM call, every image caption. DeliveryCount was already **4 of 5**.

---

## 2. THE BIGGER RISK NOBODY HAS HIT YET — ONE DEPLOYMENT, ELEVEN CONSUMERS

`text-embedding-3-large` on `clinket-ai-foundry-v4-nonprod-eastus2` is shared by **every** embedding
caller on the platform, with one TPM/RPM budget:

| Lane | Consumer | Host | Request shape |
|---|---|---|---|
| **LIVE** | `AzureSearchQuery` — customer search | API | 1 input |
| **LIVE** | `ProviderKnowledgeSearchService` — voice `search_knowledge` (1.6 s budget) | MCP | 1 input |
| **LIVE** | `ProviderCatalogSearchService` — voice catalog | MCP | 1 input |
| **LIVE** | `BroadcastMatchingService` / `BroadcastClassificationService` | API | 1 input |
| LIVE-ish | `QueryUnderstandingService` refusal phrases (cached `NeverRemove`) | API | small batch |
| Interactive | `KnowledgeManagementService` FAQ save | API | 1–few |
| **BULK** | `KnowledgeIngestProcessorFunction` | Functions | **unbounded** |
| **BULK** | `SearchIndexSyncFunction` change feed | Functions | 500 items/invocation, **24-way parallel** |
| **BULK** | `VectorEmbeddingRecoveryService` timer | Functions | 50/batch, ≤500/run, then forces reindex |
| BULK | `CategoryEmbeddingService` | API + Functions | hardcoded `batchSize = 50` (§0.12 magic number) |

For the ~40 seconds this deployment was throttled, **every customer search and every live voice
retrieval lost its vector leg**. They degrade correctly and silently (search falls back to BM25;
`ProviderKnowledgeSearchService` misses inside its budget) — so this would never appear as an incident,
only as quietly worse answers. And `host.json` `sessionHandlerOptions.maxConcurrentSessions: 8` means
**eight businesses can ingest simultaneously**, multiplying the pressure by 8.

This is the part that most needs a design answer, not just a batch-size fix.

---

## 3. THE CHUNKER WARNING — IS IT "THE ISSUE"? NO. IS IT FINE? ALSO NO.

The warning did not fail the upload. But it is a truthful signal of a real defect:

1. `ParseJson` flattens the whole file into **one `Paragraph` block**.
2. The chunker's `Paragraph` branch calls `NormalizeText`, which **collapses every newline to a space** —
   destroying the only record boundaries the flattener had produced.
3. The sentence splitter therefore sees one 1 MB "sentence soup", finds 111 accidental boundaries (things
   like `Sault Ste. Marie`), and falls into its **last-resort path** — §7.8b case 6, the only
   mid-sentence cut in the whole contract — 55 times.
4. Cards land at arbitrary word boundaries, most straddling **2–5 machines mid-record**.

**Product consequence.** The receptionist retrieves top-5 passages by meaning. A card holding the tail of
machine #123, all of #124–125 and the head of #126 embeds to a muddled centroid. *"Do you have a 2019 Cat
motor grader in Winnipeg?"* retrieves badly — the exact failure PLAN §1.1 exists to fix.

**Cost consequence.** The `records[123].` prefix repeats on every one of ~40 lines per record — roughly
**520 wasted chars per record, ~13% of the whole flattened document**, embedded and stored. And 538 cards
is **27% of the business's entire 2,000-passage budget** spent on one file.

So: **yes, a code change is warranted** — see Decision 4.

---

## 4. PROVIDER-FACING SILENCE (YOUR ASK #1)

- The page polls on `POLL_SCHEDULE_MS = [20s, 45s, 90s, 180s]` — **5 m 35 s total**, then stops and offers
  Refresh. A failing document can churn **5 deliveries × up to 480 s ≈ 40 minutes**. A provider who
  navigates away is never told anything.
- There is **no `NotificationType`** for knowledge. Nothing is dispatched on Ready or on Failed.
- Admin side fires only on the **final** delivery, as generic `AdminAlertType.SystemError` —
  indistinguishable from any other system failure on the Alerts page.
- Related defect: `TryMarkFailedAsync` writes `Failed` on **every** attempt, so the row reads
  "Failed — Try again" while a retry is still queued. (Try-again itself is safe: the messageId carries
  `UpdatedAt.Ticks`, so duplicate detection does not swallow it.)

---

## 5. APP INSIGHTS "LOGS" TAB (YOUR ASK #3) — NOT A BUG, NO CODE CHANGE

`clinqetfuncations/Clinqet.Communications/host.json:3` sets `"telemetryMode": "OpenTelemetry"`, and the
worker is correctly wired for it (`Microsoft.Azure.Functions.Worker.OpenTelemetry` 1.2.0 +
`UseAzureMonitorExporter`, `Program.cs:95-112`).

Microsoft documents, for that mode:

- *"When you configure the host to use OpenTelemetry, the Azure portal doesn't support log streaming."*
- *"The Azure portal supports `Recent function invocation` traces only if the telemetry is sent to Azure
  Monitor."*
- *"If you set `telemetryMode` to `OpenTelemetry`, the configuration in the `logging.applicationInsights`
  section of host.json doesn't apply."*

The function's **Logs** tab *is* log streaming — it connects, then never receives a record. The
**Invocations** blade works because telemetry does still reach Azure Monitor; your second screenshot is
the proof. **The data is all there; only the streaming pane is dead.** Query it instead:

```kusto
traces
| where timestamp > ago(1h)
| where cloud_RoleName == "clinket-functions-ca-v4-dev"
| where operation_Name == "ProcessKnowledgeIngest"
| project timestamp, severityLevel, message, operation_Id
| order by timestamp desc
```

Reverting `telemetryMode` to get the tab back would cost distributed tracing and the OTel correlation the
platform deliberately adopted — **not recommended**.

**Separate small finding (cost only, pre-dates this work):** `builder.Logging.AddResilientConsole()`
(`Program.cs:90`) writes to stdout while the worker also exports the same `ILogger` records through OTel.
In OTel mode the host also captures stdout — Microsoft documents this as a duplicate-telemetry source.
Worth a look on its own; not part of this fix.

---

## 6. DECISIONS I NEED FROM YOU

### Decision 1 — where to bound the embedding request

| | Option | Verdict |
|---|---|---|
| **A1** | **Token-bounded sub-batching inside `AzureAIFoundryEmbeddingService`** — split by item count **and** an estimated-token ceiling; guard per-input size; isolate a poison input instead of failing its whole batch | ✅ **RECOMMEND** |
| A2 | Batch only inside the ingest function | ❌ leaves `CategoryEmbeddingService`, `QueryUnderstandingService` and every future caller on the same cliff, and duplicates the sizing rule |
| A3 | Raise quota | ❌ impossible (§1) |

**Why A1:** one owner of the sizing rule, in the one class that already owns batching, retry and caching.
Every caller is fixed at once. The Singleton `MemoryCache` then makes sub-batching *self-healing*: a retry
re-uses vectors the previous attempt already produced instead of re-paying for them.

### Decision 2 — retry policy (your "retry might make things worse")

| | Option | Verdict |
|---|---|---|
| **B1** | **Split by failure class AND by lane** — 429: honour `retry-after-ms`/`Retry-After`, else exponential+jitter from a real floor (~4 s), per-attempt cap (~60 s); 408/5xx/socket: keep exponential base 1 s × 3; 400: never retry (already correct). **Bulk** may wait long (bounded by the 480 s ingest deadline, checked *before* sleeping); **interactive** gets at most one fast retry, then degrades | ✅ **RECOMMEND** |
| B2 | One policy, made longer | ❌ a customer search would hang 40 s |
| B3 | Circuit breaker on the embedding client | ❌ as primary — bulk pressure would trip it and cut the live path too. Revisit per-lane later |

### Decision 3 — protecting live search + live voice from bulk work

| | Option | Verdict |
|---|---|---|
| **C1** | **Explicit lane on the call + a process-wide bulk pacer.** Add a workload argument to `IEmbeddingService` (`Interactive` default, `Bulk` opt-in). Only `Bulk` waits on a shared concurrency + tokens/minute limiter, sized as a configured share of deployment TPM. `Interactive` never queues | ✅ **RECOMMEND** |
| C2 | Distributed token bucket (Cosmos/Redis) | ❌ adds a network hop to the live path for a problem client pacing solves |
| C3 | **A second, separate embedding deployment for bulk work, with its own quota** | ⭐ genuinely strong, infra-only, zero code risk — but it is an infra + ARM + `deploy.ps1` + cost decision. **Your call.** Composes with C1 |
| C4 | Only lower `maxConcurrentSessions` | ❌ insufficient — one document alone caused this |

**Honest limitation of C1:** it is per-process, so Functions scale-out multiplies it. `Retry-After`
handling is the backstop. This is what real clients do; a distributed limiter is not worth its cost here.

### Decision 4 — JSON / structured-data chunking quality

| | Option | Verdict |
|---|---|---|
| **D1** | **Treat a homogeneous array of objects as a TABLE** and feed the chunker's existing Table path. Union of keys = header, each element = a row. §7.8b cases 11–15 already give exactly the right semantics: token-budgeted row groups, **header repeated in every part**, `header: value; header: value` vector text, HTML for storage, oversize-row cell splitting. Kills the `records[n].` prefix waste; no card ever straddles a record. Estimated ~1 card per machine (~685) | ✅ **RECOMMEND** |
| D2 | Record-aware `List` blocks, packed to `TargetTokens` (~250 cards) | cheaper on the passage budget, slightly less self-describing than a repeated header |
| D3 | Leave `ParseJson` alone; fix only the 429 | ingest succeeds, quality defect and warning stay forever |
| D4 | Also fix the root trap — `NormalizeText` destroying newlines for **any** multi-line Paragraph | worth doing, but it changes chunking for txt/HTML/DI too and those are contract-tested. **Scope separately** |

**Why D1:** it reuses the most mature, most-tested path in the chunker instead of inventing a parallel one,
and it satisfies a contract you already locked. One card per machine is also the *ideal* retrieval shape —
"do you have a 2019 Cat 140M3AWD?" hits exactly one card.

> ‼️ **This forces an owner decision on `MaxPassagesPerBusiness = 2000`.** One dealer inventory wants 538
> (today, muddled), ~685 (D1) or ~250 (D2). Accept it? Raise the cap? Add a per-document passage cap?
> **I will not move an owner-locked economics knob without your word.**

### Decision 5 — the failure notification (your ask, as specified)

| | Item | Shape |
|---|---|---|
| **E1** | **`NotificationType.KnowledgeDocumentFailed`** — provider-facing, **failure only, nothing on success** | Dispatched through `IBusinessCommunicationDispatcher` (a knowledge doc belongs to a BUSINESS; a provider recipient id **is** a BusinessId, so a raw dispatch writes to a partition nobody reads). Channels: **in-app + push + SignalR**; `SkipEmail`/`SkipSms`/`SkipWhatsApp`. Fires **once, on the terminal outcome only** — never on an intermediate retry, so we never say "failed" and then have it work. Body carries the document name + the same localized reason the row shows. Routed to members holding **`voice.settings.manage`** (the people who can act — `voice.read` cannot re-upload). Idempotent via a deterministic EventId per `(businessId, docId, reason)`. Registrations: enum · `NotificationRoutingCatalog` · `NotificationEchoCatalog` · `CommunicationPreferenceConfig` (`VoiceAssistant`) · `SignalRSettings:EnabledNotificationTypes` · notification-route deep link → `/dashboard/profile/knowledge` · localization ×5 backend + ×5 web + ×5 mobile. **No Cosmos or SQL field is needed — §0.7 is not triggered.** |
| **E2** | **"Skip the SignalR toast if they're on that page" — yes, and client-side is the right place** | The server cannot reliably know which page a provider is on; page-presence tracking would be fragile and would silently lose notices. The pattern already exists: `signalRService.js` fans out to per-surface subscribers (`notifyLeadSubscribers`, `notifyBookingSubscribers`, `notifyCallSummarySubscribers`…). Add a knowledge subscriber; while the Knowledge page is mounted it consumes the event, refreshes the row **silently**, and suppresses the toast. **Bell + push still land**, so nothing is ever lost. — *Say the word if you'd rather always toast.* |
| **E3** | **`AdminAlertType.KnowledgeIngestFailed`**, appsettings-gated, **default true** | Replaces generic `SystemError` for this path so it triages on its own. `AdminAlertSettings.EnableKnowledgeIngestFailureAlerts = true` in the **class and appsettings** (`AdminAlertSettingsConventionTests` fails the build on drift, owner rule R3) · registered in `clinqetwebadmin/src/pages/alerts/AlertsPage.jsx` · admin-internal hardcoded English (§3.6) · metadata self-sufficient: businessId, docId, docName, failure reason, delivery count, messageId. |

**Mobile parity (§0.7.1):** every provider-web change here ships in `clinqetmobilepartnerapp` in the same
session — the Knowledge screen's failure surface and the notification strings.

### Decision 6 — the TPM number you asked about

**Keep 500,000 TPM. Do not raise it further.** It is already above the 350K regional default for gen-3
embeddings, and once the batch is token-bounded and paced this whole document costs ~340K tokens **once**,
spread over ~7 requests. More quota buys nothing, because the binding constraints are the **300K
per-request cap** and **burst smoothing** — neither of which quota moves.

Your other choices in that dialog are correct: **Global Standard** is right, and **"Opt out of automatic
model version upgrades"** is exactly right for an embedding model — a silent version change would
invalidate every vector already stored in `clinket-knowledge` and the services index.

---

## 7. EDGE CASES SWEPT (every one gets an answer before code)

| # | Scenario | Handling |
|---|---|---|
| 1 | Document legitimately over the passage cap | D25 space-full, terminal, no retry — **correct today** |
| 2 | 429 part-way through sub-batches | earlier vectors are cached ⇒ the retry only pays for what's left (new, free from A1) |
| 3 | `Retry-After` longer than the remaining 480 s ingest deadline | check remaining budget **before** sleeping; fail as retryable rather than burning the deadline mid-batch |
| 4 | Host shutdown during a long wait | `OperationCanceledException` propagates, session redelivers — **correct today** |
| 5 | 400 from the aggregate token cap | never retried (already correct); unreachable after A1; belt-and-braces terminal reason + log |
| 6 | A single input over 8,192 tokens | impossible from knowledge cards (≤512 approx tokens), but `MaxTextLength = 30000` chars ≈ 7,500 approx tokens lets **other** callers get close — real BPE could exceed it and 400 the whole batch, poisoning unrelated inputs. A1 adds a per-input guard + poison isolation |
| 7 | Same bytes re-uploaded under a new name | X9 hash-twin refresh — **correct today** |
| 8 | Two providers uploading big documents at once | the bulk pacer serialises them |
| 9 | Change-feed storm (bulk service edit) during an ingest | both are bulk lane, both paced |
| 10 | Vector-recovery timer overlapping an ingest | both bulk |
| 11 | Live voice call during a bulk ingest | interactive lane unpaced; on 429 it degrades inside its 1.6 s budget — **correct today** |
| 12 | Embedding deployment fully down | interactive degrades to BM25 (correct today); bulk fails the doc retryably, admin alert on final |
| 13 | Provider taps Try again while retries are pending | new messageId (`UpdatedAt.Ticks`) so it enqueues; same session ⇒ serialised; the second run sees `Ready` and exits idempotently |
| 14 | A later retry succeeds after we already notified | notify **only** on the terminal outcome — never on an intermediate attempt |
| 15 | Provider deletes the document mid-run | tombstone CAS already aborts and self-purges — **must not notify** |
| 16 | Multi-member business | routed to `voice.settings.manage` holders, per-recipient language, self-echo suppression via the existing seam |

---

## 8. WHAT I WILL **NOT** DO WITHOUT YOUR WORD

- Change `MaxPassagesPerBusiness` or any other owner-locked `Voice:Knowledge` economics knob (Decision 4).
- Provision a second Azure OpenAI deployment or touch ARM / `deploy.ps1` for one (Decision 3, C3).
- Touch `NormalizeText`'s newline behaviour for the txt/HTML/DI paths (Decision 4, D4).
- Change `telemetryMode` (§5).
- Add any Cosmos field, SQL column or container — **none of this needs one.**

---

## 9. SOURCES FOR THE AZURE FACTS

- [Azure OpenAI quotas and limits](https://learn.microsoft.com/en-us/azure/foundry/openai/quotas-limits)
- [Manage Azure OpenAI quota](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/quota)
- [How to generate embeddings with Azure OpenAI](https://learn.microsoft.com/en-us/azure/ai-services/openai/how-to/embeddings)
- [Use OpenTelemetry with Azure Functions](https://learn.microsoft.com/en-us/azure/azure-functions/opentelemetry-howto)
- [Monitor Azure Functions with OpenTelemetry distributed tracing](https://learn.microsoft.com/en-us/azure/azure-functions/monitor-functions-opentelemetry-distributed-tracing)

---
---

# ADDENDUM — OWNER FOLLOW-UPS (same session)

Owner decisions taken so far: **Decision 1 = A1** (token-bounded batching in the embedding service) ·
**Decision 2 = B1** (retry split by failure class + lane) · **Decision 3 = C1** (code pacer only, no second
deployment) · **Decision 4 = D1** (structured JSON as a TABLE) · **Decision 5 = E1/E2/E3 as specified, E2 =
silent refresh, no toast** · **Decision 6 = keep 500K TPM**.

Three follow-up questions were raised. Answers below.

---

## 10. THE REGULAR SEARCH INDEX — DOES THE SAME PROBLEM EXIST? (owner follow-up)

Scenario: a provider sets up with 100 services → change feed fires → one search-index document per service,
each needing AI enrichment (LLM) + an embedding.

### 10.1 Verdict on the batch bug: **NO, this path does not have it**

`AzureSearchIndexer` calls `GenerateTextEmbeddingAsync` — **one input per request**, per service. 100
services ⇒ 100 small requests (~200–500 tokens each ≈ 40K tokens total). Nothing approaches the 300K
per-request cap. The shape here is **concurrency**, not batch size:
`CosmosDb:ChangeFeed:ServiceProcessingMaxConcurrency = 24` and `MaxItemsPerInvocation = 500`, so up to 24
concurrent embeddings + 24 concurrent enrichment LLM calls. That is fine on its own against 3K RPM.

### 10.2 Verdict on the reuse/freshness logic: **NO BUG. It is correctly built.**

This is the part the follow-up was most worried about, and it holds up:

| Concern | What the code actually does | Verdict |
|---|---|---|
| Does changing an address re-pay the LLM? | `EnrichmentContentHash` = SHA-256 of **name + category + subcategory + description + prompt version** only. An address / price / availability / offer / tier / rating edit does **not** change it, so stored enrichment is reused, **zero LLM cost** | correct |
| Does it re-embed on an unrelated edit? | `EmbeddingContentHash` = SHA-256 of the **exact embedding input**; reused only if it matches **and** the stored vector has the right dimension count | correct |
| If enrichment FAILED, could the empty result be cached as "done" forever? | `EnrichmentContentHash = HasEnrichmentContent(aiEnrichment) ? enrichmentInputHash : null` — a failed enrichment writes **null**, so the reuse branch can never match. The reuse branch also independently re-checks `HasEnrichmentContent(stored)` | **poison-proof, twice over** |
| If the embedding FAILED, could the zero-vector be reused forever? | `EmbeddingContentHash = hasEmbedding ? embeddingInputHash : null` — **null on failure**. This one matters: a zero-vector *does* have 3072 entries, so the dimension check alone would have passed. The null hash is what prevents it | **the trap was already closed** |
| Duplicate LLM spend across 100 similar services | `_enrichmentCache` is keyed by **content hash, not serviceId** (1 h TTL) — 100 services with identical name/category/description pay **one** LLM call | correct |

### 10.3 The retry ladder, end to end (the follow-up asked exactly this)

1. **Enrichment LLM** — `AICompletionService`: 3 attempts, and it **already honours `Retry-After`**
   (`GetRetryAfterDelayMs`), falling back to 1 s × 2^attempt capped at 10 s. On final failure it returns an
   **empty** enrichment, records a failure in `AiEnrichmentFailureTracker`, and the document is published
   **un-enriched** with `EnrichmentContentHash = null`.
2. **Embedding** — no retry beyond the embedding service's own 3 sub-second attempts. On failure the doc is
   published with a **zero-vector + `HasEmbedding = false`**, an admin alert
   (`SearchIndexHydrationFallback`, High, cooldown-keyed) is raised, and `EmbeddingContentHash = null`.
3. **Search upload** — `Search:Indexer:Retry` (3 attempts, 2 s base) + a circuit breaker
   (`ConsecutiveFailures: 5`, `DurationSeconds: 60`) + per-document poison isolation.
4. **Document level** — `SearchIndexSyncFunction.ExecuteWithRetryAsync`: 3 attempts, 500 ms × 2^attempt,
   only for `IsTransientException` (timeout / `HttpRequestException` / a message containing `HTTP 429`,
   `HTTP 5`, or `after maximum retries`).
5. **Still failing** — a `ChangeFeedFailureMessage` goes to the `change-feed-failures` queue, and
   `ChangeFeedFailureReplayProcessor` **re-reads the service from Cosmos and re-indexes it**. Because it
   re-reads current state, the hashes apply — a replay pays only for what genuinely changed.
6. **Deletes** — `SearchIndexDeleteFailureException` propagates so the change-feed lease retries the whole
   batch (at-least-once for deletes, no ghost documents).
7. **Vector sweep** — the `VectorEmbeddingRecovery` timer finds
   `hasEmbedding eq false and isActive eq true and isListed eq true`, ≤500 docs/run in batches of 50, and
   forces a reindex.

**So: enrichment is retried, then degraded-and-self-healing; embeddings are degraded-and-swept. No
double-spend anywhere.** But note steps 1 and 2: **neither AI leg reaches the document-level retry ladder** —
they swallow their failure and publish a degraded document instead. Only search-upload / Cosmos / network
failures reach steps 4–5.

### 10.4 What IS wrong here — four real gaps

| # | Gap | Severity | Why it matters |
|---|---|---|---|
| **S1** | **Cross-lane starvation.** An unpaced bulk knowledge ingest 429s the shared embedding deployment. A provider-setup change feed running in that window publishes up to **500 service documents with `hasEmbedding = false`** — invisible to vector search until the recovery timer sweeps them (≤500/run) | **HIGH** | A brand-new provider's whole catalogue silently loses its vector leg because a *different* provider uploaded a big file. **Fixed by Decisions 1+2+3 — no extra work** |
| **S2** | **A throttle and an outage are indistinguishable.** `GenerateTextEmbeddingAsync` returns the same `[]` sentinel for "429, try again in 40 s" and "the provider is down". The indexer treats both as permanent and publishes a zero-vector immediately, so a *transient* throttle never gets the document-level retry it deserves | **MEDIUM** | With the pacer + `Retry-After` fix, 429s mostly vanish; but the right behaviour is to let a throttle bubble so the document retries, and reserve zero-vector for a genuine outage |
| **S3** | **Nothing sweeps un-enriched documents.** `VectorEmbeddingRecovery` filters `hasEmbedding eq false` only. A doc whose *enrichment* failed but whose embedding succeeded has `hasEmbedding = true` and `EnrichmentContentHash = null` — **no sweep looks for that**. It self-heals only on the next change-feed event for that service; a service nobody edits again stays permanently un-enriched (weaker keywords / synonyms / intent phrases, so worse recall) | **MEDIUM** | The obvious fix is blocked: `EnrichmentContentHash` is `[SimpleField]` with **no `IsFilterable`**, and Azure AI Search **cannot make a field filterable in place** — it needs an index rebuild (§0.7 Search-schema gate). Alternative without a rebuild: piggyback on `SearchIndexAuditFunction`, which already enumerates the index for drift |
| **S4** | **These alerts are not appsettings-gated** (the follow-up's explicit ask). `SearchIndexHydrationFallback` and `AIEnrichmentFailureSpike` are gated by **cooldown only**, and they live in `clinqetinfrastructure` **outside** the `AdminAlertSettings` regime that `AdminAlertSettingsConventionTests` polices. Two different admin-alert gating regimes in one codebase | **LOW (correctness) / HIGH (consistency)** | Fix: add `EnableSearchEmbeddingFailureAlerts` + `EnableSearchEnrichmentFailureAlerts`, **default true in class AND appsettings**, under the same convention test |

Plus two cosmetic items: `AICompletionService.GetRetryAfterDelayMs` **clamps `Retry-After` to 30 s** (Azure
asked for 40 s) and reads only the standard `Retry-After` header, not Azure OpenAI's `retry-after-ms`; and
`CategoryEmbeddingService` has a hardcoded `batchSize = 50` (§0.12 magic number).

---

## 11. OTHER DOCUMENT TYPES — THE TRAP IS SHARED (owner follow-up)

I swept every parser path. The root cause is not really "JSON": it is that **the chunker's `Paragraph`
branch runs `NormalizeText`, which collapses every newline to a space.** Any parser that emits a large
multi-line `Paragraph` loses its line structure and falls into §7.8b case 6 — the mid-sentence
word-boundary cut, the contract's last resort.

| Path | Structure preserved? | Exposure |
|---|---|---|
| `.xlsx` → `ParseXlsx` | **YES** — Heading (sheet name) + one **Table block** per sheet | safe — **and this is the precedent that makes Decision 4/D1 the *consistent* choice, not a new invention** |
| `.docx` → `ParseDocx` | **YES** — one small Paragraph per Word paragraph, plus Heading/List/Table/ImageMarker | safe |
| `.json` → `ParseJson` | **NO** — one Paragraph for the whole file | **the incident** |
| `.txt` containing JSON → `ParseText` | `TryFlattenJson` is tried **first**, so it hits the identical path | **the same bug, second entry point — easy to miss** |
| `.txt` → `ParseText` | splits on `\n\n` only. A file with single newlines (an exported price list, a log, a CSV-ish dump) becomes **one Paragraph** | **same trap** |
| `.html`/`.htm` → `ParseHtml` | `<table>`/`<ul>`/`<ol>`/`<p>`/`<pre>` map correctly, but a page that is one big `<div>` of text hits the `#text` branch and becomes one Paragraph | **same trap** |
| `.pdf`, images → `ParseLayoutMarkdown` (DI) | headings native, `<table>` → Table, fences → Preformatted; a **blank line** ends a paragraph | a DI markdown output with no blank lines becomes one huge Paragraph |
| `.md` → `ParseLayoutMarkdown` | same as above | same |

**Conclusion: D1 alone fixes the reported document. D1 + D4 fixes the class.** D4 — routing a *multi-line*
`Paragraph` through the same atomic-unit splitter already used for `Preformatted` and `List`, instead of
collapsing its newlines — would have prevented this incident's chunking damage on its own, and it closes
`.txt`, `.html` and stubborn-PDF exposure at the same time. It touches contract-tested paths, so it is
listed as its own decision rather than folded in silently.

**Recommendation: do D1 + D4 together.** Fixing only the reported file leaves three known doors open.

---

## 12. `MaxPassagesPerBusiness = 2000` — RECOMMENDATION (owner follow-up)

**Recommendation: leave it at 2000 for now. Do not raise the number.** The reasoning matters, because the
number is not the real lever.

**What the cap actually bounds.** Not retrieval quality — every knowledge query is filtered
`businessId eq …`, so top-5 out of 685 and top-5 out of 2000 behave almost identically. What it bounds is
**search-index storage**, and specifically the vector: 2000 passages × 3072 dimensions × 4 bytes =
**~24 MB of vector data per business**, before content. A thousand providers at the cap is ~24 GB — the
order of one Azure AI Search partition. So 2000 is not arbitrary; it is roughly "1000 providers fit in one
partition".

**Why raising the number is the wrong lever.** It multiplies uncompressed 12 KB vectors. Nothing has hit the
cap — you have exactly one document at 27% — and the chunking fix *changes what a document costs*, so
re-tuning before measuring is guessing.

**The right lever if it ever binds.** `KnowledgeSearchIndexInitializer` creates `contentVector` with an HNSW
profile and **no compression**, and the field is **stored** (the default). Azure AI Search supports scalar
and binary quantization plus `stored: false` on vector fields: scalar int8 cuts vector storage roughly 4×,
binary far more, with negligible recall loss when rescoring is on. That is the standard answer to "we need
more passages per tenant" — not a bigger integer.

**One genuinely time-sensitive note.** Vector compression and `stored` are **not** changeable in place; they
need an index rebuild. `clinket-knowledge` is pre-launch and was already dropped and recreated once this
month for the collection retype. **Adding quantization will never be cheaper than it is right now.** It is a
§0.7-gated Search schema change, so it is yours to call — I am flagging the timing, not acting on it.

---

## 13. UPDATED DECISION LIST — STILL OPEN

| # | Decision | Status |
|---|---|---|
| D4 | Fix the shared trap (a multi-line `Paragraph` keeps its line units) alongside D1 | **OPEN — recommend YES** |
| S2 | Distinguish "throttled" from "unavailable" in the embedding sentinel so a throttle retries the document instead of publishing a zero-vector | **OPEN — recommend YES** |
| S3 | Sweep for un-enriched documents. Needs either an index rebuild (`IsFilterable` on `enrichmentContentHash`, §0.7 Search gate) or a piggyback on `SearchIndexAuditFunction`'s existing enumeration | **OPEN — recommend the audit-function piggyback, no schema change** |
| S4 | `EnableSearchEmbeddingFailureAlerts` + `EnableSearchEnrichmentFailureAlerts`, default true in class + appsettings, under the existing convention test | **OPEN — recommend YES (this was the explicit ask)** |
| — | Vector quantization on `clinket-knowledge` while it is still cheap to rebuild | **OPEN — owner call, §0.7 Search gate** |
| — | `AICompletionService`: raise the 30 s `Retry-After` clamp and also read `retry-after-ms` | **OPEN — recommend YES, tiny** |
| — | `CategoryEmbeddingService` hardcoded `batchSize = 50` moves to settings (§0.12) | **OPEN — recommend YES, tiny** |

---
---

# 14. SESSION CLOSE — 2026-08-18

**Nothing was implemented. Zero code changed. The tree is clean.** This document is the evidence; the
work order is **`PHASE-4-PROMPT.md`**, which is self-contained and supersedes §13's open list.

## 14.1 The quantization measurement (run against real data, then cleaned up)

Method: the real `clinket-dev` definition was cloned into three temp indexes differing ONLY in vector
compression; all 790 documents were copied **with their existing vectors** (compression the only
variable — no re-embedding, no re-enrichment, no Cosmos writes); 20 queries (13 construction + 7 salon)
run against all four. **All three temp indexes were deleted; the service is back to its original 3.**

‼️ **Methodology trap:** the first run paged the copy with `$skip` over an unordered `search=*` set and
silently copied **552 of 790** documents, producing a bogus "81.5% recall". `id` is not sortable here.
Correct method: enumerate the key set once (`top=1000, select=id`), then fetch by explicit
`search.in(id, …)` batches. **Never trust a recall number without first asserting corpus counts match.**

| Config | Vector index | vs today | Bytes/vector | Pure-vector recall@10 | Hybrid+semantic recall@10 | top-1 identical |
|---|---|---|---|---|---|---|
| Uncompressed (today) | 9.929 MB | 1.0× | 13,179 | — | — | — |
| **Scalar int8 + preserve** | **3.346 MB** | **3.0×** | **4,441** | **100.0%** | **99.0%** | **20/20** |
| Binary + preserve | 0.371 MB | 26.7× | 493 | 100.0% | 99.0% | 20/20 |
| Binary + **discard** | 0.371 MB | 26.8× | 492 | **68.0%** | **88.0%** | **8/20** |

Latency medians (hybrid + semantic, 20 queries): 277 / 294 / 272 / 268 ms — **no penalty**.

**Findings.** Rescoring against full-precision originals is the entire mechanism — with `preserveOriginals`
scalar and binary are byte-identical (0.00000 score delta). `discardOriginals` measurably hurts, which
**contradicts the Microsoft doc's claim** that for binary it reduces storage "without reducing quality":
32 points of pure-vector recall@10 lost and the top result changed in 12 of 20 queries. **NEVER use
`discardOriginals`.** Capacity: 5 GB vector quota = ~407,000 docs today, ~1.2M with scalar.

## 14.2 ‼️ D-13 REVISED — scalar, not binary

The CoRECT paper (arXiv 2510.19340) measures binary **without** rescoring: Snowflake V2 at 10k corpus
82.00% → 82.62% (fine); at 100M 53.39% → 49.39%; **E5 at 100M 84.31% → 19.23%** — a 65-point collapse.
Verbatim: *"scalar quantization barely impacts performance, while binarizing the vector has a significant
impact on recall performance at larger corpus sizes."* It does **not** evaluate whether reranking recovers
the loss, and no source publishes binary **+ rescoring** measured at 100M.

⇒ **Our 790-doc "binary is identical" result is real but does not generalise to millions.** Scalar is
measured-safe at any scale by two independent sources; binary's risk at millions is unquantified. For the
marketplace brain, take the measured-safe option: **scalar int8 + rescoring + oversampling +
`preserveOriginals` on both vector indexes.** Re-confirm with the owner (O-3) before rebuilding.

**Also:** millions of documents needs a higher search tier **regardless** of quantization (O-2).

**Source still unread** (owner offered to fetch; body never rendered):
`https://techcommunity.microsoft.com/blog/azure-ai-services-blog/azure-ai-search-cut-vector-costs-up-to-92-5-with-new-compression-techniques/4404866`

## 14.3 Handover

`PHASE-4-PROMPT.md` carries: the owner's verbatim standards · the CLAUDE.md rules that bite · the full
incident analysis with every measured number · all 11 embedding consumers · the parser-trap sweep · the
verified search-index reuse logic (no bug) · the 7-layer retry ladder · the four search gaps S1–S4 · the
verified admin capability gap · the App Insights answer · the quantization measurement · all 16 approved
decisions D-01…D-16 with reasoning · the 5 open owner items O-1…O-5 · phased work with exact file paths ·
the §0.18 test-placement map · localization inventory (15 files) · the mandatory final-audit checklist.
