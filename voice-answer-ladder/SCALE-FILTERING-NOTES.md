# SCALE + TENANT-FILTERING NOTES — NOT PHASE 4 WORK

> ‼️ **NOTHING IN THIS FILE IS IN SCOPE FOR PHASE 4.** It is the record of a scale-architecture investigation
> that ran alongside the Phase 4 fix pack. The owner has explicitly deferred all of it to a **separate future
> session**. It is kept so the reasoning, the measurements and the rejected options are not lost.
>
> **Read `PHASE-4-PROMPT.md` to know what to build. Read this only when the deferred session starts.**

## THE SHORT VERSION

| Question | Where it landed |
|---|---|
| Does compression cause the filtering/latency problem? | ‼️ **NO — completely independent.** Compression *helps* (cheaper comparisons). **The Phase 4 compression decision is unaffected by everything in this file** |
| What is the problem? | At scale, a highly selective per-tenant filter makes HNSW traverse much of a shared graph. Microsoft measured ~7x at 1M vectors with a <2% filter. Affects **both** live voice paths; **customer search is NOT affected** (broad filters) |
| How bad? | The voice budget is ~2.4 s for search. Blow it ⇒ the lookup returns nothing ⇒ **the caller is told "I don't know" about a document the provider uploaded.** Can also consume shared search capacity that customer search needs |
| When does it start? | **No published number exists.** `RetrievalSlowWarnMs: 1500` already logs it — **the trigger is that log firing, not a document count** |
| Candidate fixes | (1) **Shard the knowledge index by business** — directory-mapped, no duplication. (2) **Local in-process scoring** — viable, needs a measurement. (3) Separate catalog index — duplication. (4) Accept + monitor |
| Rejected outright | `postFilter` (recall starvation) · `exhaustive: true` on a compressed field (kills rescoring) · Azure OpenAI **On Your Data** (deprecated, no Realtime support, is AI Search underneath, Cosmos MongoDB-vCore only) |
| Decided by | ‼️ **MEASUREMENT, not argument** — see §15.11. This recommendation moved three times on reasoning alone; it must not move again without data |

## THE ONE ITEM THAT LEAKED INTO PHASE 4

`vectorFilterMode` is set **nowhere** in the codebase, so every filtered vector query runs on a default nobody
chose. Setting it explicitly to `preFilter` is three lines and correct hygiene — it is **D-28** in the Phase 4
plan. Everything else here waits.

---
# 15. ‼️ MULTI-TENANT SEARCH TOPOLOGY — the scale architecture (OPEN, owner decision)

**Not part of this fix pack.** At 790 documents there is no problem to solve. But the design decision should be
understood now, because one piece of it is nearly free today and expensive later.

## 15.1 The asymmetry that decides everything

| Index | Consumers | Query shape |
|---|---|---|
| **`clinket-services`** | Customer search **AND** the AI assistant | Customer search = **broad** (`isActive`/`isListed` + category + geo) and **must span every provider**. Voice catalog (`ProviderCatalogSearchService:569`) = **one business** |
| **`clinket-knowledge`** | The AI assistant **only** | **Always `businessId eq <one>`. Never cross-business — not one query path.** |

‼️ **The knowledge index has NO requirement to be a single shared index.** Nothing ever queries across
businesses; it is shared purely by convenience. The services index genuinely must be shared, because a customer
has to be able to find any provider. **Those two facts point to different topologies.**

## 15.2 Knowledge — shard by business

Shard across N indexes, mapping each business to a shard via a **directory lookup** (see §15.7 — **NOT plain
`hash % N`**, which would remap the whole fleet whenever N changes). Each business lands in exactly one shard; a query hits
exactly one shard holding 1/N of the corpus. **Routing is trivial — `businessId` is always known at query time —
and nothing is lost because no query ever spans businesses.** At 100K providers with N=32, a business goes from
~0.001% of the whole index to ~0.03% of its shard, directly attacking the §3.2c selectivity cost.

‼️ **Index-per-business is NOT viable** — indexes-per-service is capped by tier (this Basic service allows **15**,
read live). Sharding is the realistic form of the same idea. **The tier cap constrains N — see U-12.**

## 15.3 ⭐ THE ONE THING WORTH DOING NOW — build the routing seam, set N = 1

**Recommendation:** while the knowledge index is being rebuilt anyway, resolve its target through a seam —
`ResolveKnowledgeIndex(businessId)` — instead of reading a fixed index name. Ship it returning a constant while
**N = 1**, so behaviour is identical to today. ‼️ **A directory lookup (§15.7) is exactly what belongs behind that
seam later** — swapping it in then requires no call-site changes anywhere.

| | Cost |
|---|---|
| Doing it now | One resolver + one setting. Near zero |
| Skipping it | A refactor across the API, Functions and MCP hosts — **at exactly the moment you are under scale pressure** |

With the seam in place, **N=1 → N=32 is a config change plus a re-index, not an architecture change.**
It composes cleanly with the alias work (D-26): each shard gets its own alias.

## 15.4 Services — keep it shared; treat the voice path separately

Customer search must span everything, so the shared index stays. **The per-business voice catalog lookup is the
odd one out.** Options for when it matters:

| Option | Assessment |
|---|---|
| **Serve it without the shared ANN index** — a provider has 10–200 services; comparing a query vector against 200 pre-computed vectors is a few hundred dot products. Asking a 50M-document ANN index to filter down to 200 is vastly more work for the same answer | ‼️ **Architecturally the cleanest, and it REOPENS O-7** — it needs the tenant vectors available in-process, which is a far stronger argument for persisting embeddings than the one O-7 rejected |
| `exhaustive: true` on that path | Microsoft's own suggestion for selective filters, but **it kills oversampling + rescoring** (D-29/D-32). Must be benchmarked for latency **and** ranking quality. **Never flip it silently** |
| Accept and monitor | **Correct for now.** `RetrievalSlowWarnMs: 1500` already logs it |

## 15.6 ‼️ THE OTHER REAL FIX — uncompressed + `exhaustive: true` (added after an owner question)

**`exhaustive: true` is a QUERY flag, not a storage setting.** It skips the HNSW graph and compares against every
vector in scope — brute force, exact, no approximation. It is **unrelated to compression**, but it interacts with
it decisively: **oversampling and rescoring are HNSW-only**, so `exhaustive` on a COMPRESSED field means
compressed comparisons with no full-precision repair pass ⇒ quality loss (D-29/D-32).

‼️ **But if the field is NOT compressed, there is nothing to repair — so losing rescoring costs nothing.**
**Uncompressed + `exhaustive` yields EXACT results and no selectivity problem at all.** That is a legitimate
architecture, not a workaround.

| Option | Quality | Selectivity problem | Vector storage at ~50M docs |
|---|---|---|---|
| Compressed + HNSW (**the current plan**) | 1.00 via rescoring | **Exposed** on both per-business voice paths | **~22 GB** |
| Compressed + `exhaustive` | **Degraded** — no rescoring | Solved | ~22 GB |
| **Uncompressed + `exhaustive`** | **Exact** | **Solved** | **~620 GB** (~28x more) |
| Uncompressed + HNSW | Approximate (ANN) | Exposed | ~620 GB |

### ‼️ The structural constraint that shapes the choice

**Compression is a property of the FIELD. `exhaustive` is a property of the QUERY.** So on the **services** index
the two consumers have opposing needs on the same field: customer search over tens of millions of documents
**requires** HNSW + compression (broad queries, storage), while the per-business voice lookup would prefer
exhaustive. You cannot have both on one field — the options are to accept degraded quality on that one query, or
to add a **second, uncompressed vector field** used only by the voice path (adding a field needs no rebuild —
D-25 — but it carries full uncompressed cost for those vectors).

**The knowledge index has no such conflict**: every query is per-business, so uncompressed + `exhaustive` would be
consistent across every access path. It simply costs the storage.

### ‼️ VERIFY BEFORE RELYING ON THIS

Microsoft **recommend** `exhaustive: true` when a `preFilter` is highly selective — a recommendation that only
makes sense if exhaustive scans the **filtered subset** (one provider's ~200 services) rather than the whole
index. ‼️ **The owner's research found that Microsoft do NOT document the eKNN/filter interaction precisely.**
If exhaustive scans everything regardless of the filter, **this entire option collapses.** Treat it as unverified:
confirm it in the docs, then measure it, before designing around it.

### Recommendation

**Sharding (§15.2/§15.3) and uncompressed+exhaustive are BOTH real fixes; they cost different things and they are
not mutually exclusive.**
- **Lean sharding**: keeps compression, keeps storage small, keeps rescoring, keeps HNSW for the broad path. Costs
  routing code — and the **N=1 seam (§15.3) makes it nearly free to prepare now.**
- **Uncompressed + exhaustive on KNOWLEDGE ONLY** is a legitimately simpler design if storage is cheap for the
  owner and simplicity is worth ~28x the vector footprint on that index.
- **Do NOT apply uncompressed+exhaustive to the services index wholesale** — it would strip ANN and compression
  from the highest-traffic customer-search path to fix a problem that path does not have.

## 15.7 ‼️ MULTITENANCY RESEARCH — CLOSED. The recommendation is confirmed, with one correction.

Owner research against Microsoft's current multitenancy guidance and limits pages. **Outcome: shard-across-N-shared-indexes is the right answer at our scale — and one detail of my proposal was wrong.**

### The finding that explains WHY the selectivity problem exists at all

> **Azure AI Search automatically splits an index into internal shards and sends each search request
> independently to every shard before merging results. You CANNOT set a tenant field as a physical partition
> key, and you cannot control document placement among the service's internal partitions.**

‼️ **So a `businessId` filter is LOGICAL filtering, not tenant-local physical routing.** That is precisely why
the filter does not shrink the work Azure does (§3.2c) — and it means **application-level sharding across
separate indexes is the ONLY way to obtain physical tenant locality.** Our proposal is not a workaround for a
missing feature; it is the documented way to get something the service deliberately does not expose.

### Why index-per-tenant does NOT scale — hard numbers

| Tier | Indexes per service | Tenants ⇒ services needed |
|---|---|---|
| **S3 HD** (Microsoft's multitenancy-optimised tier: 1,000 indexes/partition, 3,000/service, max 3 partitions) | **3,000** | 10K ⇒ **≥4** · 100K ⇒ **34** · 1M ⇒ **334** |
| Ordinary S3 | **200** | 10K ⇒ **50** · 100K ⇒ **500** · 1M ⇒ **5,000** |

‼️ **And the default subscription quota is only SIX S3 HD services per region** (increase requestable). So
index-per-business is arithmetically dead at our target scale, exactly as suspected. **S3 HD max index size is
100 GB** per the newer limits page — treat that as authoritative over the older "ideal 50–80 GB, no hard limit"
wording, and plan with headroom rather than at the ceiling.

**Serverless Developer** is not an option: preview, **no SLA, explicitly not recommended for production**,
1 GB max index, 30 indexes per service.

### ‼️ THE CORRECTION — use a DIRECTORY, not `hash(businessId) % N`

I proposed plain modulo hashing. **That is the wrong shard-mapping strategy.** Microsoft's sharding guidance
and the research both land on the same conclusion:

| Strategy | Problem |
|---|---|
| `hash(businessId) % N` | ‼️ **Changing N remaps the whole fleet** — going from 32 to 64 shards moves roughly half of every tenant's data. Scale-out becomes a mass migration |
| **Directory-based lookup** (a stored `businessId → shard` map) | ✅ **RECOMMENDED.** A tenant can be moved individually — promote a hot or oversized business to its own shard without touching anyone else |
| Consistent hashing / virtual shards | ✅ Acceptable alternative if a directory is unwanted; bounds the data movement when N changes |

‼️ **This makes the §15.3 seam MORE valuable, not less** — a directory lookup is exactly what belongs behind
`ResolveKnowledgeIndex(businessId)`. Ship it returning a constant while N=1; swap in the directory later with no
call-site changes.

### The full recommended topology (confirmed)

1. **Shard tenants across a bounded number of shared indexes**, every tenant in exactly one shard, **and still
   filter by `businessId` on every query** (defence in depth — the filter remains the correctness boundary).
2. **Distribute shard indexes across multiple search services**, not just multiple indexes on one service.
3. **Promote outliers** — unusually large, hot, or regulated tenants get a dedicated index or service. This is
   Microsoft's own hybrid recommendation, and a directory mapping is what makes it possible per-tenant.

### ‼️ A QUALITY effect I had not raised: shared indexes pollute BM25

**Lexical relevance statistics are computed at INDEX scope.** In a shared index, other tenants' documents
influence term-frequency statistics, so a term that is rare inside one business but common globally is scored as
if it were common. **Both of our indexes run hybrid BM25 + vector, so both are affected.** Sharding reduces the
pollution (a shard's statistics come from 1/N of the corpus); index-per-tenant eliminates it. **This is an
additional argument for sharding that is independent of the latency/selectivity argument.**

### Still not resolved

The research confirms Microsoft recommend `exhaustive: true` for highly selective filters, but **it still does
not establish whether eKNN + `preFilter` scans only the filtered subset or the whole index.** §15.6 therefore
remains unverified — **measure it before designing around it.** Microsoft also explicitly recommend
**benchmarking the real workload**, because QPS and latency depend on index/query complexity and competing
indexing load. Our §3.1 harness is that benchmark.

## 15.8 ‼️ THE ANSWER — a complete solution with ZERO quality compromise

Owner constraint, verbatim: *"quality, data output and performance compromise is not the option — these are bread
and butter of our platform."* **There is a full solution that meets that bar. It is not a trade-off.**

| Path | Exposed? | Solution | Quality cost |
|---|---|---|---|
| **Customer search** (`clinket-services`, broad filters) | **No** | **Change nothing** | — |
| **AI knowledge lookup** (`ProviderKnowledgeSearchService`) | Yes | **Shard `clinket-knowledge` by business**, directory-mapped (§15.7) | **ZERO** |
| **AI catalog lookup** (`ProviderCatalogSearchService`) | Yes | ~~Its own purpose-built index~~ ‼️ **WITHDRAWN — see §15.9. It duplicated vectors + enrichment. Replaced by an IN-MEMORY vector match with no second index** | **ZERO** |

Both fixes keep binary quantization, keep rescoring, keep HNSW and keep results identical. **Nothing is traded.**

### ~~Why the catalog gets its own index~~ — ‼️ **WITHDRAWN, see §15.9.** Kept only to record the reasoning that was rejected

The voice catalog lookup does not need to live in the customer-search index. It is a **different query pattern**:
one business, semantic match over ~10–200 services. Customer search needs the whole corpus; the catalog needs one
tenant. **One index per access pattern is the textbook answer.**

‼️ **And this codebase already does exactly this.** `clinket-providers` is a separate purpose-built index beside
`clinket-services`, built by `ProviderSearchIndexer` for a different access pattern (filter + sort, **zero vector
fields** — `cosmosindexsetup/Program.cs:624` states the reasoning). **Adding a per-business catalog index is the
same move already made once.** Established pattern, not an invention — and the change feed already fans out to
multiple indexes, so the write path exists.

### The honest costs

| Cost | Size |
|---|---|
| Routing code + shard directory | Small, one-time. **The N=1 seam (§15.3) makes it nearly free to prepare now** |
| Service data duplicated into the catalog index | Storage only — sharded, so each piece is small. ‼️ **Vectors are COPIED, never re-embedded** (§15.7 / D-25) |
| Sync path (one service change ⇒ two indexes) | Mechanical. The change feed **already** writes both `clinket-services` and `clinket-providers` |
| More index objects | N shards x 2 indexes — **nowhere near the 3,000-per-service S3 HD limit** (§15.7) |
| Proving the gain | One POC run (§3.1) against a representative corpus. **Measure it; do not assume it** |

### ‼️ REJECTED — every option that would compromise quality

| Option | Why rejected |
|---|---|
| `exhaustive: true` on a **compressed** field | Loses oversampling + rescoring ⇒ measured quality drop (D-29/D-32). **Not acceptable on either voice path** |
| Accept slow voice retrieval | A blown budget is a **silent miss on a live call** — the caller is told "I don't know" about a document the provider uploaded. **Not acceptable** |
| `postFilter` | Recall starvation: a business's best passage vanishes because other tenants outranked it pre-filter. **Strictly worse** |
| Uncompressed everywhere | ~28x vector storage, and **it does not fix traversal by itself** — only paired with `exhaustive`, which remains **unverified** (§15.6). Not the primary answer |
| Bigger tier / more partitions | Helps latency generally but **does not fix the algorithmic issue**. A mitigation, never the solution |

### Sequencing

1. **NOW (near-zero cost):** ship the `ResolveKnowledgeIndex(businessId)` seam returning a constant at **N = 1**.
2. **WHEN TELEMETRY SAYS SO:** shard for real, and add the catalog index. **The signal already exists** —
   `RetrievalSlowWarnMs: 1500` logs slow voice lookups today, so make sure that log is actually watched (E73).
3. **Never** flip `exhaustive` or drop compression as a latency fix without re-opening D-13/D-19/D-29 (E74).

**There is no dead end here.** The solution is known, it reuses a pattern already in this codebase, it costs zero
quality, and the only open question is timing — answered by our own telemetry rather than by guesswork.

## 15.9 ~~REVISED — NO DUPLICATION ANYWHERE~~ ‼️‼️ **WITHDRAWN — see §15.10. In-memory is disqualified: it loses the tuned retrieval ladder. Kept only to record the reasoning that was rejected.**

**§15.8 proposed a duplicate `clinket-catalog` index. The owner objected — correctly — and it is WITHDRAWN.**
The objection: a second index copies the vectors AND the enrichment fields, and adds a sync path that can drift.
For a query that never needed an ANN index, that is a real cost for no benefit.

### The distinction that was blurred

| | Meaning | Duplication |
|---|---|---|
| **Sharding** | *Splitting* one index into N. Every document exists **once** | **None** |
| A second purpose-built index | *Copying* documents into another index | **Yes — 2x vectors + enrichment + a sync path** |

The owner's own framing was right: *"for the knowledge base it's fine because we are not storing the duplicates."*
**Knowledge sharding never had a duplication problem. Only the catalog proposal did.**

### The catalog answer: in-process vector match (owner's proposal — and it is the CORRECT pattern, not a hack)

**ANN indexes exist to avoid scanning a large corpus. With ~200 services there is nothing to avoid.**

| Approach | Cost to rank ~200 services |
|---|---|
| Azure AI Search | Network round-trip **50–200 ms**, plus HNSW traversal under an extreme filter (§3.2c) |
| In-memory cosine | 200 x 3072 floats ≈ 600K multiply-adds — **sub-millisecond** |

The network hop alone dwarfs the entire computation. **Using a 50M-document ANN index to search 200 items is the
anti-pattern.** And in-memory is **strictly higher quality**: exact cosine, no ANN approximation, no compression
loss, no rescoring needed, no selectivity cost — plus it removes a network dependency and a 429/timeout failure
mode from a live phone call.

‼️ **CORRECTION (owner caught this).** An earlier version of this section said *"fetching a provider's services is
a filter-only query"* as though describing current behaviour. **It is NOT.** `ProviderCatalogSearchService` today
issues a **VECTOR** query — `ExecuteVectorSearchAsync` (`:390`) embeds the caller text (`:400`) and sets
`VectorSearchOptions` + `VectorizedQuery` with `KNearestNeighborsCount` (`:407-413`). **So the catalog lookup IS
vector-based and IS exposed to §3.2c — D-32 stands.** What that sentence actually described was a **NEW** query the
in-memory design would add. A design assumption was stated as an established fact. **What is verified vs assumed:**

| Claim | Status |
|---|---|
| `businessId` is filterable on the services index | ✅ **Verified** — `SearchDocument.cs:198` `[SimpleField(IsFilterable = true)]` |
| The vector can be `select`ed in a non-vector query | ✅ **Proven by execution** — `poc/quant-ab.js` pulled 790 docs *with* `textEmbedding` via filtered queries |
| A query with no vector clause performs no HNSW traversal | ✅ Structural |
| **A filter-only fetch is CHEAP at ~50M documents** | ❌ **NOT VERIFIED — do not claim it.** Must be measured |

The proposed load query would be —
`search=*&filter=businessId eq '…'&select=…,textEmbedding` — which never touches HNSW. It is the ordinary filter
path. **`poc/quant-ab.js` proves this at 790 documents**: it pulls documents *with their vectors* through filtered
queries, fast. So: **one cheap filtered fetch at call start → hold in memory → answer every tool call locally.**

### How to build it

| Step | Detail |
|---|---|
| **Load** | ‼️ **Default: read the vector back out of AI Search (no duplication — see O-7).** Options: (a) A filter-only query against `clinket-services` selecting `textEmbedding` — mechanically proven at 790 docs but **unmeasured at 50M**. (b) **blob fallback** if (a) measures slow. ‼️ **A Cosmos field is RULED OUT — writing back to Cosmos re-fires the change feed (O-7).** Either way, run it in **parallel** with the prompt build ⇒ no added wall-clock |
| **Score** | `System.Numerics.Tensors.TensorPrimitives.CosineSimilarity` — hardware-accelerated SIMD, in the BCL. ‼️ **Verify the package reference exists in the consuming project before relying on it — do not assume** |
| **Guard** | `ProviderCatalogSearchService` already has `LookupTooBroadThreshold`, and large-catalog handling already exists. Add a **service-count ceiling**; above it fall back to the index path. A 5,000-service dealer must not sit in memory |
| **Placement** | `ProviderCatalogSearchService` is infrastructure consumed by the **MCP host** ⇒ per §0.18 the tests belong in the **MCP suite**, not the API suite |

### Honest costs

| | |
|---|---|
| Memory | ~200 services x 12 KB ≈ **2.4 MB per provider**; 100 concurrent calls ≈ 240 MB. Halvable with float16 or the compressed form |
| Freshness | An in-memory snapshot goes stale if a service changes mid-call. Acceptable for a call lasting minutes; load at call start |
| Cold start | One filtered fetch per call — prefetch alongside the prompt build |
| ‼️ **The one real quality question** | Azure provides **hybrid BM25 + semantic reranking**. In memory you get exact vector similarity plus whatever lexical matching you write. For 200 items exact cosine is arguably **better** than approximate hybrid — **but it is NOT identical, and must not be presented as such.** ‼️ **Requires an A/B against real caller phrasings before it ships** |

### The final architecture — every document exists exactly once

| Path | Solution | Duplication |
|---|---|---|
| **Customer search** | Unchanged — `clinket-services` | **None** |
| **AI catalog lookup** | **In-memory vector match**, one filter-only fetch per call | **None — no second index** |
| **AI knowledge lookup** | **Shard** `clinket-knowledge` (split, never copy) | **None — partitioning** |

**Why not in-memory for knowledge too?** Scale: 2,000 passages x 12 KB = **24 MB per provider** ⇒ 100 concurrent
calls ≈ 2.4 GB, plus the passage text. **Sharding is the right tool for the large per-tenant set; in-memory is the
right tool for the small one.** Different sizes, different answers.

## 15.10 ‼️‼️ FINAL ON THE CATALOG — in-memory is DISQUALIFIED. §15.9 is REVERSED.

**Owner question: does in-memory lose benefits AI Search provides? YES — a great deal. §15.9 is withdrawn.**

### What the catalog query ACTUALLY does (read from the code, not reasoned about)

| Line | Feature |
|---|---|
| `:24`, `:276`, `:369` | `ScoringProfile = "voiceCatalogScoring"` — **a scoring profile built specifically for this path** |
| `:273`, `:367` | `QueryType = SearchQueryType.Full` — full Lucene syntax |
| `:339-343` | `SearchMode.All` **then falls back to** `SearchMode.Any` — a deliberate strict-then-loose two-pass |
| `:380` | `QueryType = SearchQueryType.Semantic` — **semantic reranking** |
| `:390-413` | vector search as a **further** fallback |

Riding underneath: BM25 over six AI-enrichment fields (`searchKeywords`, `synonyms`, `alternativeNames`,
`broadMatchTerms`, `commonSearchPhrases`, `userIntentPhrases`), the service **synonym map**, fuzzy/typo tolerance,
and analyzer stemming. **This is a four-stage engineered retrieval ladder, not a vector search.**

‼️ **§15.9 claimed "for 200 items exact cosine is arguably better". That was WRONG.** Exact cosine is better at the
*vector* part and throws away everything else. **Reimplementing this in memory means writing a search engine** —
which is exactly the "hacky" instinct the owner had and which §15.9 talked them out of.

### The trade table, honestly

| Option | Retrieval quality | Latency at scale | Cost |
|---|---|---|---|
| **Separate catalog index, sharded by business** | **IDENTICAL — the whole stack is preserved** (same scoring profile, same semantic config, same enrichment fields, same synonyms; it is still AI Search, just a smaller corpus) | **Fixed** | Duplication: ~22 GB of compressed vectors at 50M docs + trimmed content, plus one sync write. ‼️ **Vectors are COPIED, never re-embedded** |
| In-memory cosine | ❌ **Loses the tuned ladder** | Fixed | No duplication |
| Region-shard the services index | Identical | Fixed | Serves both access patterns, but complicates broad customer search and multi-service-area providers. **UNEXPLORED — do not propose it as solved** |
| Accept + monitor | Identical | ❌ Not fixed | Free |

### Verdict

**Against the owner's stated bar — quality is non-negotiable — in-memory is DISQUALIFIED and the separate sharded
catalog index is the leading option.** Storage is the cheapest resource in this stack; a tuned retrieval ladder is
not. The duplication objection is valid on **cost** and was the right instinct, but the alternative fails on
**quality**, which ranks higher by explicit owner instruction.

‼️ **Knowledge is unaffected by any of this.** It shards cleanly — no duplication, no quality loss, and its query
path is far simpler than the catalog's.

### ‼️ A PROCESS NOTE FOR WHOEVER READS THIS

This recommendation moved three times: duplicate index → in-memory → duplicate index. Every move followed new
evidence, but the **root cause of the churn was reasoning about what the code SHOULD do instead of opening the
file.** `ProviderCatalogSearchService` was proposed for replacement twice before anyone read its query
construction. **Before proposing to replace any retrieval path, read every SearchOptions it builds and list the
features it uses. A claim about behaviour needs a file:line or it is a proposal, not a fact.**

## 15.11 ‼️ THE CATALOG DECISION IS EMPIRICAL — STOP ARGUING, MEASURE IT

A fourth owner research pass recommended in-memory. **It does NOT conflict with §15.10 — it set a condition, and
the condition is now known to be met.** Verbatim from that report:

> *"...does not include the actual implementation body, so I cannot honestly assert whether your production call
> currently uses pure vector retrieval, hybrid RRF, semantic ranker, or some combination."*

> *"...then local cosine is a **different ranking pipeline** and needs an evaluation test before replacement."*

**It never had the code.** §15.10 verified the condition holds (`voiceCatalogScoring`, `SearchMode.All`→`Any`,
`SearchQueryType.Semantic`). Its own capability table agrees: BM25 = *"Yes, but you must implement a lexical
engine"*; vector+BM25+RRF = *"Yes, but more code"*; **Azure semantic ranker = *"Not identically inside your
process"***.

### Facts worth keeping from that pass

| Fact | Why it matters |
|---|---|
| 600 services x 3072 dims float32 ≈ **7.03 MiB per business** | Confirms the ~12 KB/vector figure independently |
| **Azure's pure-vector score is a monotonic transformation of cosine**, and **HNSW is approximate** | ⇒ local **exact** cosine gives the same ordering as an exact vector search and is **strictly better than HNSW on the vector channel alone**. A real point FOR in-memory |
| The semantic ranker reranks up to the **top 50** text-bearing candidates | Bounds what the reranker actually contributes |
| A **"retrieval projection"** (vector + a few tiny fields, keyed by business) is cheaper than duplicating a full index | ‼️ But it only makes the **storage** cheaper — it does **not** answer the **ranking** question. Separate problems; do not conflate them |
| The **semantic ranker is separately billed** beyond a free monthly allowance | The current catalog path spends ranker units on every voice call. Dropping it saves money — but *"a quality decision first and a cost decision second"* |

### ‼️ THE DECISION RULE — this is now closed to argument

**No document can settle this. Not this plan, not either research pass.** The question is empirical:

> **Does the tuned four-stage ladder actually earn its keep over a ~600-item corpus?**

| Outcome | Then |
|---|---|
| **The ladder measurably beats exact local cosine** | Keep AI Search for the catalog; fix latency by shrinking the corpus (separate sharded index, or region-sharding) |
| **It does not** | In-memory wins: cleaner, cheaper, exact, one fewer network hop, no duplication, and it drops semantic-ranker billing |

### The experiment (cheap, and on REAL traffic)

**You already store voice call transcripts and post-call summaries.** So:
1. Extract real caller phrasings that triggered catalog lookups.
2. Replay each against **(a)** the current ladder and **(b)** exact local cosine over the same business's vectors.
3. Compare **top-1 and top-3 agreement**, plus the cases where they differ — and have a human judge those.
4. Cover the hard cases deliberately: synonyms (*"digger"* → excavator), typos, plurals, multi-word intents, and
   queries that match **nothing** (the ladder's All→Any fallback exists for a reason).

**Real caller phrasings, not synthetic queries.** That is the whole point — the ladder was presumably tuned on
real traffic, so only real traffic can say whether it still earns its place.

‼️ **PROCESS COMMITMENT: this recommendation moved three times on argument (duplicate index → in-memory →
duplicate index). It must NOT move a fourth time on argument. Only the measurement above may change it.** Anyone
reopening this from documentation or reasoning alone is repeating the mistake recorded in §15.10.

## 15.12 ‼️ THE HARM IS BROADER THAN "THE ASSISTANT GETS SLOW" — and the trigger is a LOG, not a document count

### Two harms, and the second was missing from earlier sections

**(a) It is not slowness — it is a SILENT WRONG ANSWER.** The voice path has a hard `RetrievalTimeoutMs: 4000`
budget, of which `EmbeddingBudgetShare = 0.4` (~1.6 s) is already spent embedding, leaving ~2.4 s for the search.
Exceed it and `ProviderKnowledgeSearchService` **times out and returns nothing**, so the receptionist tells the
caller *"I don't know"* about a document the provider uploaded. **No error reaches the provider. No error reaches
the caller. The only trace is a log line.**

**(b) ‼️ IT CAN BLEED INTO CUSTOMER SEARCH.** Microsoft state that selective `preFilter` increases **CPU and
reduces throughput** — not merely per-query latency. Every index on a search service shares the same capacity
(partitions x replicas). **So expensive voice-catalog queries consume capacity that customer search also needs.**
‼️ **This is therefore NOT contained to the AI assistant.** At sufficient volume it becomes a noisy-neighbour
problem on the index the customer marketplace depends on — materially more serious than "the assistant is slow",
and it was missing from §3.2c, §15.8 and §15.10.

### When does it start? — NO ONE CAN PREDICT IT. Do not put a number in this plan.

Microsoft explicitly recommend **benchmarking the real workload** rather than predicting. What is actually known:

| Fact | Note |
|---|---|
| Microsoft's tested regime was **1M vectors, filter matching <2% ⇒ ~7x slower than `postFilter`** | ‼️ That is a comparison **between filter modes**, NOT "7x slower than today". **It cannot be converted into an absolute latency for us** |
| **10M records ≈ 100K providers**, not millions | 100K x ~100 services = 10M services; same arithmetic for knowledge passages. Calibrate accordingly |
| At 10M records one business is **~0.001% of the index** | Roughly **2,000x more selective** than Microsoft's tested case — well past anything published |

### ‼️ The trigger to act on is a LOG, not a document count

**The instrument already exists:** `RetrievalSlowWarnMs: 1500` logs every slow knowledge lookup today, and
`RaiseLookupTimeout` fires at the 4 s budget. **So the threshold does not need predicting — it will announce
itself.** ⇒ **The actionable requirement is that these logs are actually WATCHED** (E73). A signal nobody reads is
the same as no signal.

### To get OUR curve instead of a guess

`poc/quant-ab.js` can be extended to load a synthetic corpus at 100K / 1M / 10M documents into a temp index and
measure voice-path latency against corpus size — **our data, our threshold, a few hours of work.** That is worth
far more than any estimate in this document. ‼️ **Delete the temp indexes afterwards (§0.16).**

## 15.13 ⭐ THE CLEAN-SLATE DESIGN — what this would look like if built from scratch

**The root mistake is not a bad choice; it is that TWO DIFFERENT WORKLOADS share one piece of infrastructure.**

| | Customer search | AI assistant retrieval |
|---|---|---|
| Corpus per query | **All** providers | **One** provider |
| Documents in scope | 10M+ | 100–2,000 |
| Ranking needs | Hybrid + semantic + geo + facets + boosts | Semantic match over a tiny set |
| Volume | High | One per call turn |
| Failure mode | A worse result page | **Caller told "I don't know"** |

They share **nothing** but the source data. An ANN index is built for the left column; **the right column is not a
search problem at all.**

### Three layers

**Layer 1 — ONE global search index for customer discovery.** Azure AI Search, hybrid + semantic + geo +
compression. Exactly what exists today. **Broad filters only — never a per-tenant hot path on it.**

**Layer 2 — PER-TENANT RETRIEVAL BUNDLES, materialized.** One document per provider holding everything the AI ever
needs: services (name, price, duration, category, **vector**), knowledge passages (text + vector), FAQs. Keyed by
`businessId`, stored where a **single-key read** retrieves it — Cosmos partitioned by `businessId`, or blob.

**Layer 3 — Load the bundle at call start; answer every tool call locally.**

### Why this is architecture, not a workaround

- It is the **materialized view** pattern: precompute the answer to *"everything about provider X"*, because that is
  **the only question the AI ever asks**.
- A **single-key read** is the cheapest operation any database offers. No filter, no scan, no ANN, no selectivity.
- ⭐ **Cost per call is O(one provider's data) — INDEPENDENT of total provider count.** 10 providers or 10 million:
  identical performance. **Sharding only reduces the scale dependence; this REMOVES it.** Nothing else has this
  property.
- The search service leaves the live-call path ⇒ **no 429s, no timeouts, no noisy-neighbour contention with customer
  search (§15.12b)**.

### The threshold that is already half-built

Small catalogs are **already** placed in the realtime prompt (no retrieval at all) — ~600 services ≈ 18K tokens,
comfortable in a modern context window. So the complete design is:

| Catalog size | Approach | Retrieval latency |
|---|---|---|
| Small | **In the prompt** — the model matches | **Zero** |
| Large | **Bundle + local scoring** | Sub-millisecond |
| ~~Any~~ | ~~Shared ANN index + tenant filter~~ | **Never** |

**Knowledge always needs retrieval** (2,000 passages will not fit a prompt), so it always uses the bundle path. For
memory, a **two-stage local pass** works: cheap lexical narrowing over the passages, then exact cosine over the
survivors — fast and memory-light.

### ‼️ The one honest gap

**Ranking.** The bundle delivers the data instantly; it does **not** deliver `voiceCatalogScoring` + the
`All`→`Any` ladder + semantic reranking. Those must be reimplemented or replaced — **which is precisely the
§15.11 measurement, and the only genuine unknown in this design.**

**The trade in one sentence:** strictly better on scale, latency, cost and blast radius; its only open question is
whether local ranking matches the tuned ladder.

---

## 15.14 ‼️ SHARD SIZING — a document ceiling, NOT a provider count

Owner asked: *"how many before I move to the second index?"* ‼️ **A provider count is the WRONG UNIT.** Providers
are wildly uneven — one has 20 passages, a dealer has 2,000. "1,000 providers per shard" could mean 20,000
documents or 2,000,000.

### The procedure

1. **Measure the curve.** Load a synthetic corpus at 100K / 500K / 1M / 5M documents; plot voice-path p95 latency
   against corpus size (`poc/quant-ab.js` extended). ‼️ **Delete the temp indexes afterwards (§0.16).**
2. **Find the ceiling:** the corpus size at which p95 stays inside the ~2.4 s search budget **with real headroom
   (~50%)**.
3. **That ceiling IS the shard size — measured in DOCUMENTS.**
4. **The directory places each new provider into whichever shard has headroom.** You never "fill one and move on" —
   placement is **capacity-aware from the start**, and a provider who grows into a monster is moved individually.

‼️ **This is exactly why a directory beats `hash % N` (§15.7).** Hashing cannot do capacity-aware placement — the
hash decides, so a shard that happens to collect several dealers becomes a hotspot you cannot fix without
remapping everyone.

‼️ **Illustration of the METHOD, not an answer:** if 500K documents measured as the safe ceiling and providers
averaged 100 passages, that is ~5,000 providers per shard ⇒ 100K providers ≈ 20 shards. **The 500K is INVENTED
until measured. Do not quote this arithmetic as a recommendation.**

## 15.15 ‼️ THE "RANKING GAP" IS MUCH SMALLER THAN §15.10/§15.13 CLAIMED — semantic rerank is OFF

**Verified from the code AND the settings, in all hosts. §15.10's framing was wrong about what is actually running.**

| Component | Live today? | Reproducible locally? |
|---|---|---|
| BM25 `SearchMode.All` over 11 fields | ✅ **primary path** | ⚠️ the one hard part |
| `voiceCatalogScoring` | ✅ — **pure `TextWeights`, NO functions**: serviceName 15.0 · searchKeywords 8.0 · synonyms 6.0 · commonSearchPhrases 6.0 · subcategoryName 6.0 · userIntentPhrases 5.0 · categoryName 4.0 · broadMatchTerms 3.0 · tags 2.5 · alternativeNames 2.0 · serviceDescription | ✅ **Easy — a field→multiplier dictionary** |
| `SearchMode.Any` fallback | ✅ | ✅ Easy (OR instead of AND) |
| **Semantic reranking** | ❌ ‼️ **`SemanticRerankEnabled: false`** in the MCP host, the Functions host **and** the class default (`VoiceCatalogSettings.cs:45`). The code comment is an explicit owner kill switch: *"billed per query and adds a turn the caller cannot be spoken over. Never enable without a latency AND cost review."* | ✅ **N/A — NOT IN USE. The blocker §15.10 named is switched off** |
| Vector search | ⚠️ **`VectorMode: OnEmptyResult`** — runs ONLY when lexical returns nothing | ✅ **Easy AND BETTER** — exact cosine beats approximate HNSW |
| Facets (category/subcategory counts) | ✅ | ✅ Easy — in-memory group-by |
| Cosmos empty-confirmation | ✅ **`ConfirmEmptyAgainstCosmos: true`** | ✅ Already exists — **Cosmos is already on this path** |
| Cross-tenant leak guard (`RaiseCrossTenantLeak`) | ✅ | ✅ **Structurally stronger** — only one business is loaded, so a leak becomes impossible rather than merely detected |

### The one genuinely hard part: matching Azure BM25

Needs (1) the same **analyzer** — tokenisation, lowercasing, stemming, stopwords; (2) **IDF statistics**; (3) the
**synonym map** expansion.

⭐ **And the IDF difference favours local.** §15.7 established that index-wide BM25 statistics are a **pollution
problem** — a term rare inside one business but common globally is under-weighted. **Local IDF over that business's
corpus is arguably MORE correct.** So local BM25 is not "worse" — it is differently and plausibly better scored.
**Which is exactly why the §15.11 measurement is still required: different ordering, not worse ordering.**

‼️ **Revised verdict: this is NOT "writing a search engine" (as §15.10 implied). It is writing a scorer for ~600
documents** — bounded, well-understood work. The in-memory / bundle design is therefore **materially more viable
than §15.10 concluded.** §15.11's measurement still decides it; the odds moved.

### What to research to close the BM25 question

1. Azure's **default analyzer** (`standard.lucene`) — exact tokenisation/stemming rules a local analyzer must match.
2. Azure's **BM25 parameters** — are `k1` and `b` documented/settable (the index `similarity` setting)?
3. **How `TextWeights` combines with BM25** — a multiplier on the field's score, or another formula?
4. **The contents of the service synonym map** — small enough to load and expand locally?

---

## 15.16 ‼️ THERE IS NO PUBLISHED "INDEX SIZE → LATENCY" CEILING. It must be measured.

Researched. **Microsoft publish no index-size-to-latency curve** — latency depends on tier, replicas, partitions,
query complexity, vector dimensions and filter selectivity. Their guidance is explicit:

> *"In any large implementation, it's critical to do a performance benchmarking test of your Azure AI Search
> service before you roll it into production."*

**So there is no number to look up. Do not put one in this plan.** What IS documented and useful:

| Fact | Implication |
|---|---|
| Vector quotas are enforced **per service AND per partition**; adding partitions raises quota | Partitions are the storage lever |
| **Vector indexes on disk take ~3x the space they take in memory** | Memory residency drives speed ⇒ ‼️ **compression helps LATENCY, not only cost** |
| A **second partition significantly increases max QPS; a third gives diminishing returns** | With two, the data is already in active memory |
| **Replicas → query throughput. Partitions → storage/indexing.** Large indexes may need extra replicas | The levers when the wall is hit |
| Vector index size ≈ `raw_size x (1 + algorithm_overhead) x (1 + deleted_docs_ratio)` | Deleted documents inflate it until merged |

**⇒ The ceiling is the §15.14 experiment. Same measurement, two questions answered at once.**

## 15.17 ‼️ BOTH RETRIEVAL PATHS HAVE THE SAME SHAPE — and research alone does NOT close the question

**Verified from the code in both services.**

| | Catalog (`ProviderCatalogSearchService`) | Knowledge (`ProviderKnowledgeSearchService`) |
|---|---|---|
| Query text passed to `SearchAsync` | ✅ ⇒ BM25 runs | ✅ `text ?? "*"` ⇒ BM25 runs |
| Vector query | ⚠️ `VectorMode: OnEmptyResult` — fallback only | ✅ **every query** (when the embedding succeeds) |
| Text + vector together ⇒ **RRF fusion** | on the fallback | ✅ **every query** |
| Scoring profile | `voiceCatalogScoring` — **TextWeights only** | `KnowledgeRelevance` — **TextWeights only** |
| **Semantic reranker** | ❌ **off** (`SemanticRerankEnabled: false`) | ❌ **not present at all** — *zero* occurrences of `Semantic` in the file |

⇒ **ONE local scorer design serves both paths.** Not two problems.

### ‼️ Research is NECESSARY, NOT SUFFICIENT

The sequence is: **(1) research the rules → (2) implement a local scorer → (3) MEASURE against production on real
caller phrasings → (4) then you know.** ‼️ **Step 3 is the decider, not step 1.** Knowing Azure's BM25 formula tells
you how to *attempt* a match; only the measurement (§15.11) says whether the attempt lands. **Do not treat a
completed research pass as approval to replace the retrieval path.**

### The FIFTH research question — RRF (was missing)

Both paths pass **query text AND a vector query in the same request**, so Azure fuses the two ranked lists with
**Reciprocal Rank Fusion**. To reproduce the ordering you need the formula and the constant:

> *What is the RRF formula and the `k` constant Azure AI Search uses to fuse text and vector results in a hybrid
> query? Is `k` documented or configurable?*

**Without it you can match each channel perfectly and still get the wrong blend.**

### ‼️ KNOWLEDGE HAS A SECOND BLOCKER RESEARCH CANNOT FIX: MEMORY

| Path | Vectors in memory per business |
|---|---|
| **Catalog** (~600 services) | ~**7 MB** ✅ manageable |
| **Knowledge** (up to 2,000 passages) | ~**24 MB** — **plus the passage TEXT itself** |

At 100 concurrent calls that is **2.4 GB+ of vectors alone**. ‼️ **No research answer changes this arithmetic.**

**Three mitigations — all LOADING strategies, not scoring strategies:**
1. **Quantize locally** — int8 ⇒ ~3 KB/vector ⇒ ~6 MB per business (4x smaller). The same trick Azure uses.
2. **Two-stage narrowing** — cheap lexical pass over the passages first, exact cosine over the survivors only.
   Never holds every vector hot.
3. **Cap with index fallback** — above N passages use the index path. Same shape as the existing
   `LookupTooBroadThreshold`.

### Verdict per path

| Path | Quality story | Memory story | Net |
|---|---|---|---|
| **Catalog** | Reproducible — semantic ranker is off, profile is field weights | ~7 MB ✅ | **Likely viable, pending §15.11** |
| **Knowledge** | **Identical** to catalog | ‼️ **~10x harder** | **Viable but needs a loading strategy the catalog does not** |

‼️ **Knowledge needs a different LOADING strategy, not a different SCORING strategy.** Solvable — but it is extra
engineering the catalog does not require, and it is why sharding (§15.2) remains a legitimate alternative for
knowledge specifically.

## 15.18 ‼️ EVALUATED AND REJECTED — Azure OpenAI "On Your Data" / AI Foundry data files

Owner proposal: index the knowledge data as an AI Foundry **data source** (from Cosmos or blob) — one per business —
and let the realtime model query it directly. **Researched. It does not work, for FOUR independent reasons, each
fatal alone.**

| # | Reason | Evidence |
|---|---|---|
| **1** | ‼️ **"On Your Data" is DEPRECATED and approaching retirement.** Microsoft have **stopped onboarding new models**; it supports only **GPT-4o 2024-05-13 / 2024-08-06 / 2024-11-20** | `learn.microsoft.com` use-your-data |
| **2** | ‼️ **It does not support the Realtime API.** It is a **Chat Completions** feature (`data_sources` in the request body). Our voice path is **gpt-realtime over SIP/WebRTC**, and no realtime model appears in its supported list ⇒ **the receptionist cannot use it at all** | same |
| **3** | ‼️ **It does not escape Azure AI Search — it IS Azure AI Search.** Verbatim: *"your data is ingested into an Azure AI Search index"* for file/blob sources ⇒ **identical selectivity/scale characteristics (§3.2c)**, while **losing all control**: no `voiceCatalogScoring`, no `All`→`Any` ladder, no custom filters, no tuning, **no cross-tenant isolation guard**. A black box with the same underlying problem | same |
| **4** | ‼️ **Cosmos support is MongoDB vCore ONLY.** Verbatim: *"Only vCore-based Azure Cosmos DB for MongoDB is supported."* Ours is **Core/NoSQL (SQL API)** with `/businessId` partition keys ⇒ would require migrating the entire database to a different Cosmos API | on-your-data / cosmos-db references |

**On "a model per business":** On Your Data attaches **data sources, not per-tenant models**. Fine-tuning per provider
is absurd at 100K providers on cost, hosting and latency. **Not a thing.**

### ⭐ BUT THE INSTINCT IS RIGHT — and the correct version is ALREADY BUILT

**The realtime-native way to give a voice model access to data is TOOLS / function calling — which is exactly what
the MCP `search_knowledge` tool is.** On Your Data was Microsoft's attempt at the same idea for the Chat-Completions
era, and **it is the one being retired while tools/MCP is what Microsoft now push.**

‼️ **So this architecture is not behind the curve — it is the pattern On Your Data was trying to be, except we own
the retrieval and can tune it.** This research VALIDATES the MCP investment rather than undermining it. **Record it
in the `clinqet-voice-assistant` SKILL so the idea is not re-proposed.**

**The scale question is unchanged:** §15.11 (measure local scoring vs the current ladder) and §15.2 (sharding for
knowledge) remain the live options.

## 15.5 What is NOT known

- **Whether sharding delivers the expected gain.** It should by construction, but it needs measuring — the §3.1
  harness can test it once a representative corpus exists. **Do not assume the improvement; measure it.**
- **Indexes-per-service limits above Basic** (U-12, unresearched). That number **caps N** and therefore constrains
  this whole design. Include it in the multitenancy research.
- Whether Microsoft recommend shared-index-with-filter, index-per-tenant, or sharding at this tenant count —
  **the owner is researching this.** The question should explicitly include *per-tenant filter selectivity on
  live, low-latency paths*, since that is our actual shape.

