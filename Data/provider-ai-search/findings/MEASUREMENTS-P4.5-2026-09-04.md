# MEASUREMENTS — PHASE 4.5, 2026-09-04

Every figure here was produced against **live services** by a probe in the session scratchpad (deleted at the
end of the phase). Every prompt fragment the model saw was **rebuilt from source and asserted byte-present in
the file it came from** — one assertion fired immediately and caught a wrong field-name mapping I had guessed
(`"Latn" => "queryInEnglish"` does not exist; the real switch is on `TextScriptDetector.Latin` with `_ =>` as
the fallthrough). That is the assertion earning its place, not a formality.

---

## §5.2 — C1's leftover: the `searchWords` schema stops varying with the question's alphabet

### What was wrong

`search_knowledge` (and `search_services`) build their `searchWords` object schema from
`BusinessSearchScriptPlan.Renderings`, which `Build(...)` orders **asked script first** so the leg cap can
never drop the alphabet the member actually used. That ordering then reached the JSON schema — so for a
business writing in several alphabets, the tool definition differed between a Latin question and a Gujarati
one. **The tool array is part of the cached prefix**, so every switch of alphabet paid for a fresh prefix.

### The change

`BusinessSearchQueryRenderings.BuildSchema` now emits the fields in **`TextScriptDetector.KnownScripts`
order**, not plan order. Selection is untouched: the plan still puts the asked script first, so the cap still
protects it. Only the presentation is canonical.

### The measurement

- **Model:** `gpt-5.6-luna`, `reasoning_effort: "none"` — the SHIPPED deployment, not `AIService.DeploymentName`.
- **Prompt:** the real field descriptions and the real `SEARCH WORDS` block, both rebuilt from source and asserted.
- **Business:** three alphabets (Latin + Gujarati + Devanagari), the case where the schema used to vary.
- **Classified programmatically** — each field must exist, be non-empty, and carry its own Unicode block.
- **N = 25 per question × 3 questions = 75 calls.** A timeout/retry/gave-up bucket was carried so N can never
  be silently smaller than claimed.

| Question's alphabet | Compliant | Gave up |
|---|---|---|
| Latin | **25 / 25** | 0 |
| Gujarati | **25 / 25** | 0 |
| Devanagari | **25 / 25** | 0 |
| **Total** | **75 / 75** | **0** |

### Verdict — SHIPS

The bar was **25/25** (P1.5's figure for this exact field). The re-measure is **75/75 with zero gave-ups**, so
there is **no drop at any alphabet**. Ruling 8's revert condition is not met.

### ‼️ The residual this does NOT close, stated plainly

Canonical ordering removes the ordering variance. It does **not** make the schema invariant when the leg cap
bites: `BusinessSearch:Retrieval:MaxQueryLegs` is **3**, so a business writing in **four or more** alphabets
still gets a different *set* of legs depending on which alphabet was asked, and its tool array still varies.
No such business exists in either region today (measured: every live knowledge row is single-alphabet), and
closing it means either raising the cap or dropping the asked-first guarantee — a retrieval trade-off, not a
caching one. **Recorded, not fixed.**

---

## §5.1 — O9: should `search_services` read the AI Search index instead of the Cosmos leg?

‼️ **MEASURE AND REPORT ONLY (ruling 7). `BusinessSearch:ServiceLookupSource` is still `Cosmos` and was not
touched.** Never run in P1.5, P3 or P4; run here.

### How

Both legs replayed exactly as the product issues them, against **live data in both regions**:

- **Cosmos leg** — the partition-scoped `SELECT * FROM c WHERE c.type='Service' AND c.isDeleted=false AND
  c.isActive=true AND (CONTAINS(c.name, @p0, true) OR EXISTS(… description …)) OFFSET 0 LIMIT 25`, with the
  businessId as the partition key. The three predicate fragments were asserted byte-present in
  `ServiceRepository.cs`.
- **Index leg** — `POST /indexes/clinket-dev-v1/docs/search`, `filter: businessId eq '…'`, `searchMode: any`,
  `top: 25`. ‼️ **The alias `clinket-dev` 404s** — the physical name is `clinket-dev-v1`; my first run reported
  an all-zero index leg for that reason and would have "proven" the index useless. The 404 body is what caught it.
- **Needles:** `hair`, `clean`, `facial`, `repair`, `massage` — five per business, every live business with an
  active service.

### Results

| | CA | IN |
|---|---|---|
| Businesses × lookups | 6 × 5 = **30** | 26 × 5 = **130** |
| **Cosmos** p50 / p95 | **73 ms / 107 ms** | **206 ms / 220 ms** |
| **Index** p50 / p95 | **34 ms / 63 ms** | **227 ms / 260 ms** |
| Cosmos rows returned | 65 | 37 |
| Index rows returned | **180** | **169** |
| Rows both legs agreed on | 53 | 35 |
| Lookups where the **index** found nothing and Cosmos did | **0** | **0** |
| Lookups where **Cosmos** found nothing and the index did | **7** | **27** |
| Cosmos RU per lookup | **31.97** | **7.16** |

### What the numbers say

1. **Recall: the index is strictly wider, and never narrower.** In 160 lookups the index missed nothing
   Cosmos found (**0 / 160**), while Cosmos missed something the index found in **34 / 160**. That is the
   `CONTAINS` substring predicate against an analysed text field: Cosmos cannot match "cleaning" from "clean"
   or a stemmed/synonym form; the index can. The extra rows are not noise — they are the offerings a provider
   asking about their own catalogue would expect back.
2. **Latency is a wash, and it is regional.** CA: the index is **~2× faster** (34 ms vs 73 ms p50). IN: they
   are the same within noise (227 ms vs 206 ms p50) — the search service there is slower than its Cosmos
   account, not the reverse. No latency argument either way.
3. **Cost moves from metered to flat.** The Cosmos leg spends **~32 RU per lookup in CA** and ~7 RU in IN, and
   Business Search runs **one lookup per rendering** — up to three per question. The index leg is flat-rate on
   the shared Basic SKU. So the index trades a real RU bill for **contention with the customer marketplace on
   the one shared search service** (`PLAN` §15c S6), which is the risk this swap actually carries.
4. **The index leg is not free of preconditions.** `ResolveSourceAsync` already runs a coverage probe (an
   extra search round trip) before trusting the index, and falls back to Cosmos when coverage is below
   `IndexCoverageMinRatio`. Flipping the dial makes that probe part of the provider path.

### Recommendation

**Switch it — but not in a fix phase, and not without the load number.** The recall result is the strongest
finding: today a provider asking about their own catalogue gets a *narrower* answer than the same question
would get through the index, in **21%** of the lookups measured, with no compensating benefit. Latency is
neutral and RU is saved.

**What I would want before the owner flips `BusinessSearch:ServiceLookupSource` to `Index`:**
- the P5 load measurement on the shared search service (S6) — this adds up to three provider queries per
  question to a service the customer marketplace already uses;
- the coverage probe's own cost measured on the provider path, since it becomes a per-question round trip.

Both belong to P5's audit, and neither changes the recall figure above.

---

## §CLOSE-OUT — the live check that turned a code-reading into a defect

The close-out sweep suspected `ICurrencyService.GetCurrencySymbolAsync` of asking the BUSINESS's address
before the row's own currency. Reading the code proves the precedence; it does not prove anyone is hurt.

**Asked of both regions:** does any live business hold a priced row in a currency other than its own
country's? A GROUP BY on `Transactions-dev`, then the primary-address country from `ProviderData-dev`,
resolved through the same `CurrencyByIso2` map the service itself uses.

| Region | Invoice.currency | Booking.price.currency | Quote.price.currency |
|---|---|---|---|
| CA | CAD ×4 | CAD ×12 | CAD ×2 |
| IN | INR ×79, **CAD ×1** | INR ×150, **CAD ×1** | INR ×27 |

‼️ **The two CAD rows belong to ONE business, `LXDP8G`, whose primary address is India (Gujarat)** —
invoice `INV2608010301` and one booking. India resolves to INR, so the invoice e-mail, the booking e-mail
and the receipt each wrote **₹** in front of a Canadian-dollar total. **Two rows out of ~275 is enough:**
a defect that needs one row to be visible is not rare, it is waiting.

**Cost of the check:** four queries per region, under three seconds. **What it changed:** a suspicion became
a fixed defect with a named business, instead of a paragraph saying it could happen.

‼️ **The same check is what the twelve-screen sweep did NOT have and did not need** — those screens were
wrong by inspection, on every amount, for every reader. Live data settles reachability, never correctness.

---

## Traps re-confirmed, so the next session does not pay for them again

- ‼️ **The Search ALIAS 404s on the older api-version; the PHYSICAL name works on either.** `clinket-dev` is not
  a queryable index name on `2024-07-01` — `clinket-dev-v1` is. An all-zero result set looks exactly like
  "the index is empty" unless the response body is read.
- ‼️ **A fragment assertion pays for itself immediately.** The field-name mapping I wrote from memory did not
  exist in the source; the probe threw on the first run instead of measuring a prompt that does not ship.
- **Live catalogue data is small** (6 businesses in CA, 26 in IN). The recall direction is unambiguous
  (0 misses vs 34), but the latency percentiles come from a light service and should not be read as a
  production figure.
