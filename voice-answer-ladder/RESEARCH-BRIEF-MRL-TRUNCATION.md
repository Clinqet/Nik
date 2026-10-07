> ‼️ **CLOSED 2026-08-18 — ANSWERED. `truncationDimension: 1024` is CONFIRMED.**
> The owner verified Microsoft Table 1.2 (8 Oct 2024): `text-embedding-3-large` 3072→**1024**+BQ = **−0.58%**
> NDCG@10 with only 2x oversampling (we use 10x), and Microsoft explicitly recommend **1/2 or 1/3 of the
> original dimensions** — for 3072 that is 1536 or **1024**. See `PHASE-4-PROMPT.md` D-19 and §3.4.
> **This file is kept only for the source-tier reasoning. No action remains.**

# RESEARCH BRIEF — is `truncationDimension: 1024` right, or should we skip MRL entirely?

Owner-run research task. Everything needed to answer it is below. Feed the findings back and D-19 gets
finalised. **This is the only open technical question in the Phase 4 plan.**

---

## 1. THE PROBLEM STATEMENT (one paragraph)

We are configuring vector compression on two Azure AI Search indexes. Our vectors come from **Azure OpenAI
`text-embedding-3-large` at 3,072 dimensions**, indexed with **HNSW** (cosine, m=10, efConstruction=400,
efSearch=500). We have decided on **binary quantization with rescoring enabled, `defaultOversampling: 10`,
and `rescoreStorageMethod: preserveOriginals`** — that part is settled and evidence-backed. The one open
question is whether to ALSO apply **MRL truncation** (`truncationDimension`), and if so at what value.
**Microsoft's own documentation appears to give two different answers, and the two statements may be
measuring different things.** We need to know which reading is correct before we rebuild the indexes,
because compression cannot be changed on an existing vector field.

---

## 2. ‼️ THE DECISIVE QUESTION — everything hinges on this

Two sentences from Microsoft's official docs:

**Statement A** — from *Truncate Dimensions*
(`learn.microsoft.com/en-us/azure/search/vector-search-how-to-truncate-dimensions`):
> "We recommend 1,024 or higher for `truncationDimension` with binary quantization. A dimensionality of
> less than 1,000 degrades the quality of search results when using MRL and binary compression."

**Statement B** — from *Compress Vectors Using Quantization*
(`learn.microsoft.com/en-us/azure/search/vector-search-how-to-quantization`):
> "It's particularly effective for embeddings with dimensions greater than 1024. For smaller dimensions,
> we recommend testing the quality of binary quantization, or trying scalar instead."

### ‼️ THE QUESTION TO ANSWER

**In Statement B, does "dimensions greater than 1024" refer to:**

- **(i) the FIELD's declared `dimensions` property** — which for us is **3,072** regardless of truncation?
  → Then truncating to 1024 is fine, there is no boundary problem, and **MRL 1024 is safe.**
- **(ii) the EFFECTIVE dimensionality AFTER truncation** — which would be **1,024** if we truncate?
  → Then we would be sitting **exactly on the boundary** rather than above it, and MRL 1024 is the
  marginal choice. **Safer to skip MRL** and run binary at the full 3,072.

That single ambiguity is the whole decision. Everything else is already settled.

---

## 3. A SECOND CONTRADICTION TO CONFIRM (same page, different section)

The *Truncate Dimensions* page ALSO says, in its numbered step list:
> "Include the `truncationDimension` parameter and set it to 512. If you're using the text-embedding-3-large
> model, you can set it as low as 256."

Our reading is that **512/256 describes what the MODEL supports**, while **1,024+ is the quality
recommendation specifically for BINARY quantization** — and the page's own worked JSON example uses
`"truncationDimension": 1024`, which supports that reading.

**Confirm or refute that reconciliation.** If Microsoft genuinely recommends 512 for binary quantization
somewhere authoritative, we need to know.

---

## 4. EXACT PAGES TO READ

| # | URL | What to look for |
|---|---|---|
| 1 | `https://learn.microsoft.com/en-us/azure/search/vector-search-how-to-truncate-dimensions` | Both statements above, verbatim. The JSON example's `truncationDimension` value. Any table of recommended values. Any statement about what "dimensions" means |
| 2 | `https://learn.microsoft.com/en-us/azure/search/vector-search-how-to-quantization` | Statement B in context — **read the sentences immediately before and after it.** Do they discuss the field's `dimensions` property, or the truncated size? |
| 3 | `https://learn.microsoft.com/en-us/azure/search/vector-search-how-to-configure-compression-storage` | The decision framework. Any recommended truncation value. Note it spells the property `truncateDimension` here vs `truncationDimension` elsewhere — **flag which spelling the API actually accepts** |
| 4 | The **"MRL support for quantization" blog** linked from page 1 | Any MEASURED numbers at different truncation values (512 / 768 / 1024 / 1536). This is the most likely place to find real data |
| 5 | `https://learn.microsoft.com/en-us/rest/api/searchservice/indexes/create-or-update` | The API reference for `truncationDimension` — does it state a **valid range or minimum**? |
| 6 | `https://github.com/Azure/azure-sdk-for-net/blob/main/sdk/search/Azure.Search.Documents/CHANGELOG.md` | **Which SDK version first exposed `TruncationDimension`.** We need to know if our pinned version supports it |
| 7 | `https://github.com/Azure/azure-search-vector-samples` → `demo-python/code/vector-quantization-and-storage` | Microsoft's own comparison sample. What truncation value does it use, and does it report measured quality? |

---

## 5. SEARCH QUERIES TO RUN

```
site:learn.microsoft.com truncationDimension binary quantization recommended value
site:learn.microsoft.com "truncationDimension" MRL text-embedding-3-large 1024
site:learn.microsoft.com azure ai search MRL quantization dimensions greater than 1024 meaning
site:techcommunity.microsoft.com azure ai search MRL support quantization matryoshka benchmark
azure ai search binary quantization truncationDimension 1024 vs 1536 recall NDCG
Azure.Search.Documents TruncationDimension version changelog
```

---

## 6. WHAT WOULD SETTLE IT — the evidence to bring back

| If you find… | Then the answer is |
|---|---|
| Statement B refers to the **field's declared `dimensions`** (3072 for us) | **MRL 1024 is safe.** Keep D-19 as planned |
| Statement B refers to the **effective/truncated** dimensionality | **Skip MRL**, run binary at full 3072 — or truncate to 1536/2048 to stay clearly above the line |
| A measured table at multiple truncation values with binary + rescoring | **That table decides it.** Real numbers beat any reading of prose |
| Nothing clarifies the ambiguity | **Skip MRL now.** Binary at 3072 is the exact configuration Microsoft measured at NDCG 1.00 on 8.8M vectors of our model. Don't build on an unresolved threshold — MRL can be added later via a new field + re-push with **zero AI cost** |

---

## 7. CONTEXT — what is already settled, so you don't re-research it

| Fact | Source |
|---|---|
| Binary + rescoring + `preserveOriginals` = **NDCG@10 0.40259 vs 0.40219 uncompressed (1.00 relative)** at 8.8M vectors of `text-embedding-3-large` 3072d on HNSW | Microsoft Tech Community blog, 2025-04-17, author `fsunavala-msft` (**a first-party BLOG, not documentation**) |
| MRL **768** + BQ + rescoring + `preserveOriginals` = 0.40024 (1.00); **without** rescoring = 0.35704 (**0.89**) | same blog |
| BQ + `discardOriginals` = 0.97 / 0.96 ⇒ **never use it** | same blog |
| Our own 790-document A/B: `preserveOriginals` gives byte-identical rankings; `discardOriginals` loses 32 points of recall@10 | `voice-answer-ladder/poc/quant-ab.js` |
| Binary **without** rescoring degrades as corpus grows (E5: 84.31% → 19.23% at 100M) | CoRECT, arXiv 2510.19340 — **measured without rescoring** |
| Compression **cannot** be changed on an existing vector field; a new field can be added with no rebuild | `learn.microsoft.com` schema-update rules |
| MRL requires HNSW + quantization + a **new** field, has **no portal support**, and Azure truncates server-side — **we keep sending full 3072-dim vectors either way** | `learn.microsoft.com` truncate-dimensions |

### What each option costs us, so the trade is concrete

| Option | Vector index at 8.8M | Threshold risk | Extra dependency |
|---|---|---|---|
| **No MRL, binary at 3072** | 3.88 GB | **None** — 3072 is unambiguously above 1024 | None |
| MRL 1024 | ~1.7 GB (interpolated — **not measured**) | Sits exactly ON the boundary | `TruncationDimension` SDK support, unverified |
| MRL 768 | 1.33 GB | **Below** the documented floor | same |

At our current scale (790 documents) the difference is 0.37 MB vs 0.17 MB — **irrelevant today**. It only
matters at tens of millions of documents, and the owner has stated tier is not a constraint.

---

## 8. HOW TO VERIFY IT OURSELVES, WHATEVER THE DOCS SAY

`voice-answer-ladder/poc/quant-ab.js` already contains an **`mrl1024`** variant. Add `mrl1536` / `mrl2048`
rows to its `VARIANTS` array and run:

```bash
cd C:\Nik\voice-answer-ladder\poc
node quant-ab.js run
node quant-ab.js cleanup     # ‼️ always
```

It clones the real index, copies the real vectors (no re-embedding, no Cosmos writes), and diffs the
rankings. **Caveat: 790 documents is too small to expose corpus-scale degradation** — it will show whether
truncation breaks anything obvious, not whether it holds at 50M. Treat it as a smoke test, not proof.
