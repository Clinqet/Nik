# `search_services` retrieval — measured brainstorm and recommendation

> 2026-09-05. Written against a live defect the owner reported: the chip *"How much is a 2017 MCFA
> GP55 (L122870)?"* — built from the business's **own** service name — is answered *"I couldn't find
> pricing for a 2017 MCFA GP55 (L122870) in our business information."*
>
> Everything below is **measured against live CA dev data** (`SX3SG2`, 708 active services), not read
> off the code. Every probe was partition- or `businessId`-scoped to that one business.

---

## 1. The defect, reproduced

| | |
|---|---|
| `POST business/search/ask` `"How much is a 2017 MCFA GP55 (L122870)?"` | **not found** |
| `POST business/search/ask` `"MCFA GP55"` | **found** — `2017 MCFA GP55 (L122870)`, 62799, cited `[1]` |

Same business, same token, same service, seconds apart. The service exists and is healthy:
`serviceId 32463449-…`, `isActive: true`, `isDeleted: false`, `approvalStatus: "Approved"`,
`pricing.fixedPrice: 62799`, `pricing.currency: "CAD"`.

### Root cause — a contradiction between the tool's contract and its matcher

**`BusinessSearchToolCatalog`, `search_services` description, verbatim:**

> *"…**Put the member's own question in every query field the schema asks for.** Narrow with group…"*

**The model does exactly that.** Measured against the real deployment (`gpt-5.6-luna`,
`reasoning_effort: none`, the production system prompt and tool schema), 5 runs × 3 questions:

```
"How much is a 2017 MCFA GP55 (L122870)?"        5/5  queryInEnglish = the verbatim question
"What's included in a 2019 FMC/LINK-BELT 250 …?" 5/5  queryInEnglish = the verbatim question
"Do we have a Caterpillar 320 and what does …?"  5/5  queryInEnglish = the verbatim question
```

**`ServiceRepository.BuildCatalogPredicate` then requires EVERY whitespace token of that sentence to be
a substring of the service name or one of its description lines:**

```sql
AND (CONTAINS(c.name, @term0, true) OR EXISTS(SELECT VALUE d FROM d IN c.description WHERE CONTAINS(d, @term0, true)))
AND (CONTAINS(c.name, @term1, true) OR EXISTS(...))   -- once per term, ANDed
```

Verified directly against the partition:

```
["2017","MCFA","GP55","L122870"]                             -> 1 row   ✅
["2017","MCFA","GP55","(L122870)?"]                          -> 0 rows  ❌  (the question mark)
["How","much","is","a","2017","MCFA","GP55","(L122870)?"]    -> 0 rows  ❌
["price","2017","MCFA","GP55"]                               -> 0 rows  ❌  ("price" is in no name)
```

**`BusinessSearch:ServiceLookupSource` is `"Cosmos"`**, so this is the only leg Business Search uses.
The index leg has a precision→recall ladder (`SearchMode.All` → `SearchMode.Any` → vector);
**the Cosmos leg has none.** One non-matching token empties the result set, with no relaxation.

---

## 2. How broken is it, in numbers

25 real services of `SX3SG2`, sampled evenly across the catalogue, each turned into a natural question
(*"How much is a …?"* / *"What's included in a …?"* / *"Do we have a … and what does it cost?"*), run
through the **real model** and then through **both real retrieval legs**:

| tool contract | leg | target found | rank 1 | zero results | tripped TooBroad (>25) |
|---|---|---|---|---|---|
| **today** (send the question) | **Cosmos** (today's dial) | **0 / 25** | – | **25 / 25** | 0 |
| today (send the question) | Index | 25 / 25 | 23 | 0 | **25 / 25** ⚠ |
| **send the words** | **Cosmos** | **25 / 25** | – | 0 | 0 |
| **send the words** | **Index** | **25 / 25** | **25** | 0 | 0 |

Read the first row again: **as shipped, `search_services` finds the asked-for service 0 times out of
25.** It is not degraded, it is non-functional for naturally phrased questions. The owner's chip is not
an unlucky case; it is the normal case.

Read the second row too: **flipping only the retrieval leg does not fix it either.** With a sentence in
`SearchMode.Any`, filler words (`a`, `in`, `and`, `what`) match hundreds of documents, `TotalMatches`
runs to 85–482, `LookupTooBroadThreshold` is 25, so every question comes back `TooBroad` — the tool
hands the model a 3-row sample and *"ask ONE question that narrows it"*. Better than a false denial,
still the wrong answer.

**The contract is the root cause. The leg is a quality choice on top of it.**

---

## 3. Does the index give us the isolation guarantee? (the owner's 10000% question)

The catalogue index **is** the customer-marketplace services index — `AISearch:IndexName`, i.e.
`clinket-dev` (alias; physical `clinket-dev-v1`). Same physical index, same Basic-SKU service. The
difference is not the index, it is the query. The provider path carries **four independent isolation
layers**, all already built and all already used by voice today:

| # | Layer | Where | Fails how |
|---|---|---|---|
| 1 | The scope clause is not optional — one and only one place builds a catalogue filter, and it always leads with the business | `BuildScopeFilter` → `businessId eq '…' and isActive eq true and businessStatus eq 'Active'` | by construction |
| 2 | **Model-supplied text never reaches the filter.** It goes to `search`, where OData has no meaning. Only ids the server itself resolved, and typed numbers, enter the filter | `BuildLookupFilter` | by construction |
| 3 | **Pre-send assertion**: the filter string must *start with* `businessId eq '<bound id>'`, or the query is refused before it leaves the process | `AssertScoped` → `CatalogIsolationException` | throws |
| 4 | **Per-row verification**, independent of the filter: every returned document's `businessId` is compared ordinally to the bound one. One mismatch **discards the whole result set**, raises `RaiseCrossTenantLeak` (admin alert, High, `forceAdminAlert`) and throws | `ReadPageAsync` / `RetrieveCandidatesViaIndexAsync` | fails **closed** — `CatalogIsolationException` is the one exception that is never degraded to a fallback |

And above all of it, `authorization.BusinessId` comes from the tenant context established by the
business-context token exchange. **The model can neither name a business nor influence the filter.**

Two verified properties worth stating explicitly:

- **The index leg is, if anything, better isolated than the Cosmos leg.** Cosmos isolation rests on one
  mechanism — the partition key. The index has four, including a post-hoc verification that catches a
  filter bug, a bad deploy or a service-side regression. `CatalogIsolationException` never degrades.
- **The `businessId` index field carries the `lowercase` normalizer**, so `businessId eq 'sx3sg2'`
  matches the stored `SX3SG2` (verified: 703 docs either way). Business ids are minted from
  `ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789` — **uppercase and digits only** — so no two distinct ids can
  collide case-insensitively. And if a writer ever lowercased one, layer 4's `Ordinal` comparison would
  fail **closed** with a false alarm, never leak.

**Verdict: using the index does not weaken tenant isolation. It strengthens it.** The isolation
question is not what should decide this.

---

## 4. What the two legs are actually good and bad at

Measured on `SX3SG2`, both legs scoped to that business:

| query | Cosmos (substring) | Index (analysed + synonyms + AI enrichment) |
|---|---|---|
| `MCFA GP55` | 1 ✅ | 1 ✅ |
| `excavator` | 147 | 161 |
| **`excavators`** (plural) | **2** ❌ | **161** ✅ |
| `skid steer` | 26 | 43 |
| **`skid steers`** (plural) | **0** ❌ | **43** ✅ |
| **`bulldozer`** (trade synonym for *dozer*) | **0** ❌ | **32** ✅ |
| `dozer` | 32 | 33 |
| `forklift` | 127 | 138 |
| `loader` | 272 | 272 |
| `320` | 11 | 7 |

- **Cosmos cannot stem and cannot know a synonym.** *"What skid steers do we have?"* returns **nothing**
  even after the contract fix. *"Any bulldozers?"* returns **nothing**. This is the same effect P4.5's
  O9 measured platform-wide (index missed 0/160, Cosmos missed 34/160) — here it is with names on it.
- **Cosmos over-matches on code fragments.** `320` finds 11 against the index's 7, because `CONTAINS`
  matches `320` *inside* `MT42320A`. Those extra rows are noise, not recall — but note the index's
  `BuildLuceneQuery` covers **prefix** (`GP55*`) and not **infix**, so a provider searching a middle
  fragment of a stock code is the one case Cosmos is genuinely wider.
- The index searches eleven fields (`serviceName`, `searchKeywords`, `synonyms`, `commonSearchPhrases`,
  `userIntentPhrases`, `broadMatchTerms`, `alternativeNames`, `tags`, `categoryName`,
  `subcategoryName`, `serviceDescription`). **Cosmos searches two**: `name` and `description`. Category
  and subcategory names are unreachable from the Cosmos leg entirely.

### ‼️ The one thing the index genuinely cannot do

`SearchIndexSyncFunction` **deletes** a service from the index when
`isDeleted || !isActive || !isApproved`. So the index holds **approved, active, undeleted services
only**.

Business Search deliberately passes `IncludeUnapproved = true` — *"The provider's own team sees their
pending and inactive offerings — this is their catalogue management surface, not a customer's view of
it."* The **Cosmos leg honours that; the index physically cannot.**

Measured on `SX3SG2`:

```
708  active, not deleted          ← what the Cosmos leg can reach
703  …and Approved                ← what the index holds  (verified: index count for this business = 703)
  5  active but PendingProviderCompletion   ← invisible to the index
  0  inactive, not deleted
```

`ConfirmEmptyAgainstCosmos: true` already rescues most of this: when the index returns **zero**, the
index leg returns `null` and `LookupViaCosmosAsync` decides. So an exclusive search for a pending
service still finds it — and the same net catches *indexing lag* (a service created seconds ago) and an
AI-Search outage.

**The residual hole:** the index returns *something* (so no fall-through) but the row the member meant
is one of the unapproved ones. Example: *"how much is the METSO ST2.8"* → the index returns the other,
approved Metso rows → the provider's own pending row never surfaces. Narrow, real, and it does not
exist on the Cosmos leg.

Also note: `SearchServicesTool` reads `_settings.ServiceLookupSource` directly and **never calls
`ResolveSourceAsync`** — so Business Search runs no index-coverage probe. Flipping the dial is
therefore *not* a one-line config change: it needs the probe wired in, or a business whose catalogue is
not yet indexed gets nothing.

---

## 5. Two more defects the same probe found

**(a) An empty query field is silently replaced by the whole question.** `BusinessSearchQueryRenderings.Parse`
substitutes `scripts.Question` (*"the member's question, verbatim"*) whenever a rendering is invalid.
`ReadString` turns `""` into `null`, and `null` is indistinguishable from *"the model produced the wrong
script"*. Measured — for *"list everything under 50000"* the model correctly sends:

```json
{"queryInEnglish": "", "maxPrice": 50000}
```

…and the server replaces the empty string with `"list everything under 50000"`, turning a clean
price-only filter into a four-term AND that matches nothing. The fallback is right for a *failed
rendering* and wrong for a *deliberate omission*; today the code cannot tell them apart.

**(b) Money is printed raw.** The answer read *"The listed price is **62799**"*. `FormatPriceText` →
`FormatAmount` → `value.ToString("0.##", InvariantCulture)`. It never reads `pricing.currency`, which
the row states as `"CAD"`. That is correct for **voice** (a spoken-ready bare number) and wrong on a
**screen**, where §17.2 rules the symbol follows the currency and the grouping follows the reader —
`CA$62,799.00`. *(Owner confirmed 2026-09-05: fix for the screen.)*

---

## 6. Cost and performance, measured

| | Cosmos leg | Index leg |
|---|---|---|
| Per lookup, this business (708 services) | **~98 RU** (48 count + 50 page) | flat-rate |
| Lookups per question | 1 per rendering — **up to 3** (multi-alphabet business) | same |
| Worst case per question | **~294 RU** | flat-rate |
| p50 / p95 (P4.5, CA) | 73 ms / 107 ms | **34 ms / 63 ms** |
| p50 / p95 (P4.5, IN) | **206 ms** / 220 ms | 227 ms / 260 ms |
| Scaling | RU grows with catalogue size — `CONTAINS` cannot be served from an index whatever paths are included | flat until the SKU saturates |
| Shared with | nothing | **the customer marketplace**, on a **Basic SKU, 1 replica, 1 partition** |

The index trades a metered RU bill for **contention on the one shared search service** — and Basic with
a single replica carries **no query SLA**. That is the real risk of the swap, and it is exactly what
P4.5 ruling 7 deferred to the P5 load measurement. Nothing I measured today changes that: I measured
recall and correctness, not load.

---

## 7. The options, honestly

| | What | Fixes the reported bug? | Cost | Risk |
|---|---|---|---|---|
| **A** | **Contract fix**: `search_services` asks for the *words*, not the sentence. Plus punctuation-edge stripping and the empty-field fix | **Yes — 0/25 → 25/25** | none (2501 RU vs 2460 across 25 questions — flat) | very low: no new dependency, no isolation change, no index load, no schema |
| **B** | Flip `ServiceLookupSource` to `Index` **only** | **No** — 25/25 found but 25/25 `TooBroad`, so the model is told to narrow instead of answering | flat, but adds ≤3 queries/question to the shared Basic SKU | medium: no load number (P5), no coverage probe wired, unapproved rows invisible |
| **C** | **A then B** | Yes, and best quality: **25/25 at rank 1**, plus plurals and trade synonyms | as B | as B, but the `TooBroad` failure disappears because the query is short |
| **D** | A + a relaxation ladder on the Cosmos leg (drop terms absent from the business's own service names, on the miss path only) | Yes, plus belt against a disobedient model | +1 partition read on the miss path only | low, but it is machinery that A alone makes almost unreachable |
| **E** | Index unapproved rows and filter per caller | Would close the last hole | full reindex | ‼️ **high** — today the customer marketplace's protection against showing unapproved services is that they are *not in the index at all*. Adding them makes every customer query depend on a filter that does not exist yet. Not a fix-phase change |

---

## 8. Recommendation

**Do A now. Hold C for the owner, gated on P5's load number. Do not do B alone. Do not do E.**

**Why A is the right first move, and not a workaround:**

1. **It fixes the actual defect** — 0/25 → 25/25, measured end to end through the real model and the
   real leg.
2. **It is the root cause.** The tool tells the model to send a sentence to a substring matcher. That is
   a contract error, and it is wrong on *both* legs — it is what makes the index trip `TooBroad` 25/25.
   **A is a prerequisite for C, not an alternative to it.**
3. **It costs nothing** — no new dependency, no extra RU, no load on the shared search service, no
   change to the isolation surface, no schema.
4. **The Cosmos leg has to be correct regardless.** It is the fall-through for `ConfirmEmptyAgainstCosmos`,
   for an AI-Search outage, for indexing lag, for a below-coverage business, and it is the only leg that
   can see the provider's own unapproved rows. Even after a dial flip it stays on the path.
5. **Model compliance is measured, not assumed** — 20/20 on the revised wording against 0/20 on the
   current one, and it holds on browse-style, price-only, terse and non-English questions.

**What A leaves on the table, stated plainly:** plurals and trade synonyms. After A, *"what skid steers
do we have?"* still returns nothing and *"any bulldozers?"* still returns nothing. **Only C fixes
those** — the index has the stems, the synonym map and the AI-enrichment fields, and Cosmos never will.
So A is the correct fix for the reported bug and C is the correct end state; the gap between them is
real and I am not going to pretend A closes it.

**If C is chosen, it needs three things beyond the dial** (none of them one-liners):
`ResolveSourceAsync` wired into `SearchServicesTool` so an unindexed business still gets an answer; the
P5 load number for the shared Basic SKU; and a decision on the residual unapproved-row hole in §4.

---

## 9. Edge cases checked, and how each option behaves

| Edge case | A (words → Cosmos) | C (words → Index, Cosmos on empty) |
|---|---|---|
| Exact model + stock code | ✅ 25/25 | ✅ 25/25 at rank 1 |
| Question mark / brackets / apostrophes | ✅ stripped at the edges | ✅ escaped by `BuildLuceneQuery` |
| Plural (*skid steers*) | ❌ 0 rows | ✅ 43 |
| Trade synonym (*bulldozer*) | ❌ 0 rows | ✅ 32 |
| Browse (*what excavators do we have*) | ✅ 147 → `TooBroad` → narrowing offered | ✅ 161 ranked |
| Price-only (*everything under 50000*) | ✅ **once §5(a) is fixed** — today the empty field becomes the sentence | same |
| Category/subcategory word | ❌ Cosmos searches name + description only | ✅ indexed fields include both |
| Provider's own **unapproved** row, searched exclusively | ✅ `IncludeUnapproved` | ✅ via `ConfirmEmptyAgainstCosmos` |
| Provider's own **unapproved** row, when approved rows also match | ✅ | ❌ **residual hole** |
| Service created seconds ago (indexing lag) | ✅ | ✅ via `ConfirmEmptyAgainstCosmos` |
| AI Search outage / unprovisioned stamp | ✅ unaffected | ✅ degrades to Cosmos (`IndexAvailable`, per-leg budget) |
| Business below `IndexCoverageMinRatio` | ✅ unaffected | ⚠ needs `ResolveSourceAsync` wired in |
| Multi-alphabet business | ✅ one leg per alphabet, unchanged | ✅ unchanged |
| Non-English question | ✅ measured: hi/gu/es/fr all yield clean English keywords | ✅ |
| Cross-tenant leak | partition key | **four layers, fails closed** (§3) |
| Model ignores the instruction | ⚠ option D is the belt | ✅ `Any` + BM25 still ranks it |

---

## 10. Probes used (all scoped to `SX3SG2`; scratch, deleted at session end)

`cos.js` Cosmos REST (HMAC) · `srch.js` AI Search REST + faithful `BuildLuceneQuery`/`Normalize` ports ·
`probe2.js` the real model with the production system prompt and tool schema · `measure.js` the §2 table.

‼️ **`clinket-dev` 404s on api-version `2024-07-01`; the physical `clinket-dev-v1` works** — the same
trap P4.5 §17.4 recorded. An all-zero result set looks exactly like an empty index unless the body is read.
