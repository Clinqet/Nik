# PHASE 3 — MULTIDIMENSIONAL AUDIT

> Written 2026-09-15, after the code was built, tested, merged, committed, pushed and deployed to the Canada
> sandbox. `PROGRESS.md` holds the measurements the phase was designed from; `HANDOVER.md` holds what changed.
> **This file holds what the audit tried to break, what broke, and what was done about it.**
>
> ‼️ Every number below was produced by running something. Where a dimension could not be exercised, it says
> so in those words and names what is missing — a dimension reported as "fine" on no evidence is the failure
> mode this audit exists to prevent.

---

## The short version

**8 findings, 8 fixed, every fix re-reviewed.** Two were real coverage holes that only a sabotage could find
— the tenant-scope guard had no test at all, and the Japanese-alphabet test pinned the label while missing
the arithmetic that keeps the alphabet alive. One was in the audit's own tooling, which reported two false
passes. One was a red suite on `master` that this phase's push would have inherited, blocking the web deploy.
The rest were prose damaged by scripted edits, including a comment that shipped with its subject missing.

**22,350 .NET tests, 4,848 mobile, 4,025 web — all green, zero skipped.** ESLint: 0 errors in anything this
phase touched.

### ‼️ ONE thing is left for the owner — the other two were done the same day

1. ✅ **Both §0.7 asks decided, built and proven live** — `AiTurnCitation.channel` and R-10, the latter as one
   nullable Cosmos boolean and **no search-index field** (§12.9).
2. ✅ **The logged-in web UI was walked live** at 1440 / 1024 / 768 / 375 once the owner signed in (§13.6) —
   which also surfaced the plural defect no test would have found.
3. ✅ **CLOSED 2026-09-16 — the CJK field is ON in both regions and the switch is GONE.** Both `v2` indexes
   were rebuilt and refilled **by copying every card out of `v1`** — no re-ingest, no AI spend, vectors
   byte-identical (see §14). `Voice:Knowledge:CjkFieldEnabled` was **deleted**, not flipped (§0.7.1).
   ‼️ **PROVEN LIVE:** `烫发多少钱` returns **1 hit on `contentCjk` and 0 on `content`**, and the analyzers
   show why — `en.microsoft` makes the price line and the question ONE token each (they can never match)
   while `knowledgeCjkAnalyzer` makes 15 and 4 bigrams sharing `烫发`.

‼️ **A session note that cost two hours, and still applies:** the browser and `tools\api.py` cannot both hold
a session on one account — every login revokes every refresh token, so a sign-in for a UI check kills the API
session. Sign in first, paste the token pair second (`CANADA-SANDBOX-ACCESS.md`).

---

## 0. How this audit was run

| Dimension | How it was exercised |
|---|---|
| Finding closure | Per id, against the built code and a live probe where one exists |
| Regression | Every .NET suite re-run; both UI suites re-run; the retained fixtures re-read from the live index |
| Adversarial | **Ten probes invented after the implementation was finished**, replayed against the live CA index |
| Sabotage | Five deliberate defects, each applied to the real source, tested, and restored from a scratchpad snapshot (§0.19 — no git command touched the tree) |
| Latency | Timed against the live CA search + embedding endpoints, 5 rounds, 1/2/3 legs |
| Cost | Read from the code path and confirmed against the live embedding endpoint |
| Security / tenancy | Read in code on every search path, and confirmed on the wire in every live probe |
| Analytics | File-list diff across all seven backend repos |
| Config / deploy | Class-default vs appsettings comparison per host; every removed key traced to its readers |
| Comments | Every added line scanned for the scars a scripted edit leaves |
| Docs & memory | Presence and correctness checked, not assumed |

---

## 1. Finding closure, per id

| Id | Closed by | Proven by |
|---|---|---|
| **F1** | `KnowledgeSearchQuery.Renderings` (N per-script legs), `NormalizeRenderings` capped at `RetrievalMaxQueryLegs`, concurrent fan-out, per-leg failure reported and never fatal; `search_knowledge` gains 14 named per-language fields; the per-call prompt names the business's own alphabets | Unit + integration suites; **live**: a Gujarati leg returns 2 hits at BM25 17.13 where the English leg returns 0 |
| **F2** | 7 script families added; CJK precedence (Kana/Hangul absorb the Han beside them); dense-script floor of 4; digit folding both ways | `TextScriptDetectorTests`; **live**: a Chinese document re-ingested through the deployed pipeline comes back `scripts=['Hani','Latn']` — before this phase the same file indexed as `['Latn']` |
| **F3** | The note envelope reserved in **tokens**, converted at the Latin rate, and only for the coverage this result actually carries | `RetrievalPayloadSizeMeasurementTests` + three `TokenBudget_*` tests; sabotage S5 |
| **F4** | At most one overview card unless `askingWhatTheBusinessHas` | Unit tests |
| **F5** | A narrowed search that finds literally nothing retries once unnarrowed inside the same budget | Unit tests |
| **F6** | Answerable docIds go in the filter (≤500), post-check kept | Integration: `TheVisibleDocumentAllowList_IsPushedIntoTheQueryFilter`; **live**: every probe's filter carries `search.in(docId, …)` |
| **F7** | `FuseByRank` (RRF, k=60, contributions summed) replaces the max-score merge | Sabotage S1; **live**: a Gujarati keyword-only leg scores **17.13** where the hybrid legs score **0.0333** — a ratio of ~514×, which is what the old merge handed to the keyword-only leg |
| **F8** | ✅ **BUILT — this row said "NOT BUILT" and was stale; corrected 2026-09-16.** F8 IS R-10, and it was approved, built and proven live the SAME day (§12.9): ONE nullable Cosmos boolean `cardsRewriting` and **no search-index field at all** — a tenth of the shape my own table proposed | Re-read in code 2026-09-16: set immediately before the card write, cleared INSIDE `CommitAsync` so no terminal path can forget, `MarkDeletingAsync` covered, `NOT IS_DEFINED` FIRST in the SQL, projected in both repo rows. **Live**: a document cited while `status=Processing` |
| **F9** | Noto Bengali, Tamil, Telugu and Arabic embedded (8 faces, OFL); RTL for Arabic script, decided from the provider's own words | `MaterialInfoPdfTests`, incl. `EveryScriptTheDetectorCanEmit_HasAFontInTheMaterialChain`. ‼️ **FIVE scripts are gaps, not three** — Han, Japanese, **Hangul**, **Thai** and Hebrew; this row and §13 both named only three until corrected 2026-09-16. Han/Japanese/Hangul are **CLOSED by owner decision** (no 10–16 MB font); Thai and Hebrew stay open and are cheap (§13) |
| **F10** | A blank `AISearch:Endpoint` yields a **present, empty** `KnowledgeSearchClient` in all three hosts | `UnprovisionedSearchStampTests`; the API integration suite boots |
| **F11** | Query syntax escaped; both digit forms; vector k = the window; ref cap derived from settings with truncation logged; surrogate-safe cut; orphan `Retrieval*` keys removed per host; two stale comments corrected; **the cited-but-missing measurement test now exists** | Unit tests; **live**: probes A6 (operators escaped), A5 (both digit forms), A10 (a lone surrogate never reaches the wire) |
| **H1** | The chunker factor, the retrieval budget and the material PDF agree on the same script list | `EveryScriptTheDetectorCanEmit_HasAFontInTheMaterialChain` + the budget tests |
| **H3** | Eight test names were removed; **every one has a deliberately renamed replacement pinning the new truth** (§2.5). None was deleted to make a suite green | Diff of every added/removed test name across nine repos |
| **H4** | SKILL settings list regenerated; parser/indexer comments corrected | 12 SKILL files updated (3 skills × 4 tool directories), verified present |
| **B3** | Covered by the F1/F2 contract change (one query shape for both surfaces) | Suites |
| **X-01** | `KnowledgeSourceChannel.Of()` shared by phone and screen; `channel` on the tool payload; `Channel` on the citation DTO, absent for the document's own words; prompt rule 9 pinned byte-identical by a convention test that also proves the rule numbering has no gaps; the chip on web and mobile | `BusinessSearchPromptConventionTests`; **live**: all five deployed language files carry `businessSearch.source.aiWritten.*` |
| **EX-33** | Closed before a line was written: the Analyze API on the live index shows `en.microsoft` on `content`/`docTitle` | Live |
| **U-05 · U-06 · U-12 · U-14 · U-15 · U-18 · U-19 · U-20 · U-21 · U-22 · U-23 · U-24 · U-25** | Web **and** mobile in the same session, keys in all five language files on both apps | Web 4,025 and mobile 4,848 green; **live**: the deployed web build serves every new key in all five languages |

---

## 2. Regression

### 2.1 .NET suites (after every audit fix in this file)

Every suite in every repo, re-run **after** the last fix in §12 — not the numbers from before the audit.

| Suite | Result |
|---|---|
| `Clinqet.API.UnitTests` | **12,333 / 12,333** (12,317 before, + the 16 this audit added) |
| `Clinqet.API.IntegrationTests` | **2,129 / 2,129** |
| `Clinqet.Mcp.UnitTests` | **954 / 954** |
| `Clinqet.Mcp.IntegrationTests` | **95 / 95** |
| `Clinqet.Communications.UnitTests` | **4,624 / 4,624** |
| `Clinqet.Communications.IntegrationTests` | **562 / 562** |
| `Clinqet.Identity.UnitTests` | **984 / 984** |
| `Clinqet.Identity.IntegrationTests` | **471 / 471** |
| `ClinqetCosmosAIIndexSetup.UnitTests` | **198 / 198** |
| **Total** | **22,350 passed, 0 failed, 0 skipped** |

### 2.2 UI suites

| Suite | Result |
|---|---|
| `clinqetmobilepartnerapp` | **4,848 / 4,848 tests, 319 / 319 suites** |
| `clinqetwebpartnerapp` | **4,025 / 4,025 tests, 292 / 292 suites** — green for the first time since 2026-09-14, after the repair in §2.3 |
| ESLint, `clinqetwebpartnerapp` | **0 errors** (11 pre-existing `import/order` warnings in files this phase never touched) |
| ESLint, `clinqetmobilepartnerapp` | **0 errors in any file this phase touched.** 7 errors exist on master in 5 files it never opened — see the note below |

‼️ **Seven pre-existing ESLint errors in the provider phone app, left deliberately.** Four are unused
imports in two test files, one is an unused variable, and one is real:
`LoginWithEmail/index.tsx:261` calls the hook `useProductKey` **conditionally**, which React forbids and
which will misbehave the moment the condition changes between renders. All five files come from the
product-preference work, none was touched by this phase, and **that repository has no CI workflow at all**,
so nothing is blocked. They are not fixed here because they are another change's in-flight work and a
conditional-hook repair is a behavioural change to a sign-in screen. **Written down so Phase 4 inherits the
list rather than the surprise.**

### 2.3 ‼️ A red suite on origin/master that was NOT this phase's — and is now fixed

`productIdentityFollowsPreference.test.js` had been failing on `master` since **"Landing page and payments
ux (#32)" (2026-09-14)**. That commit shipped a guard whose own comment says *".env no longer declares it"*
while its `.env` still carried `NEXT_PUBLIC_CLINKET_CALL=true`.

Nothing reads it: rule 1 of the same suite — no file under `src/` and not `next.config.mjs` reads a
product-selecting variable — passes, and a tracked-file sweep finds the name only in the declaration itself
and in prose. (The `CLINKET_CALL` that IS alive is a string constant in `productVariant.js`, a different
thing entirely.) So the declaration is orphaned config (§4) and the four comment lines above it describe a
build-time mechanism that no longer exists. Both were deleted; a two-line note stays, which is what the
guard's own comment anticipates a comment being for. **Web CI would have failed on this phase's push
otherwise, and the partner app would not have deployed.**

### 2.4 The retained fixtures are untouched

`SX3SG2` holds **844 cards across 20 documents**, `updatedAt` **2026-09-14** on every fixture card — before
this phase. The 17 retained documents were neither re-ingested nor deleted.

‼️ **And a correction to this phase's own handover.** `PROGRESS.md` and the first draft of the Phase-4
prompt say the retained fixture is *"Hindi, not Gujarati"*. Read live, it is **both**: `4eeae96e…` is a
Devanagari rate card (`सेवा: बाल कटवाना | कीमत: ₹250`) that **also carries a Gujarati card**
(`વાળ કાપવા — ₹250`) and an English note; `6fcd9c32…` is Gujarati throughout. The earlier note over-corrected.
Fixed in the Phase-4 prompt, the memory entry and `PROGRESS.md`.

‼️ **And `PLAN.md` said so all along.** The fixture's own filename in the retained-documents table is
`pdf_hindi_gujarati_english_pricelist.pdf` — three alphabets, named in the authority document, in a table
both of the wrong notes were written directly underneath. **The evidence was not missing; it was unread.**

### 2.5 H3 — eight test names went, and every one was replaced on purpose

Every added and removed test name across all nine repos was diffed. **69 added, 8 removed**, and not one of
the eight was a deletion: each has a replacement that pins what the behaviour became.

| Removed | Replaced by | Why |
|---|---|---|
| `DocType_IsSearchableAndStillFilterableAndFacetable` | `DocType_IsSearchableAndStillFilterable_ButNoLongerFacetable` | v2 drops the facet nothing used |
| `PdfFonts_EmbedTheThreeFamilies_AndRegistrationIsIdempotent` | `EveryFamilyInTheMaterialChain_HasBothItsFacesEmbedded_AndRegistrationIsIdempotent` | There are no longer three families, and "every family" cannot go stale |
| `MaterialFamilyChain_CoversEveryScriptTheMaterialPdfCanRender` | `EveryScriptTheDetectorCanEmit_HasAFontInTheMaterialChain` | ‼️ The old one was keyed by **localization language** while its own comment claimed **script** — it was certifying something other than its stated claim |
| `MaterialFamilyChain_CoversGurmukhi_AndItsFacesAreEmbedded` | subsumed by the "every family" test above | One rule beats a list of special cases |
| `TheMerge_DeduplicatesByCardIdAndKeepsTheHighestScore` | `TheMerge_DeduplicatesByCardId_AndFusesTheTwoLegsRanks` | F7: the merge no longer keeps a score at all |
| web `names both numbers when the file held more than we keep` | `states what the cap left out, and does not move when a picture is deleted` **+** `says it in the singular when exactly one was left out` | U-15: one test became two, and the new names state the rule |
| mobile `names both numbers when the file held more than we keep` | `states what the cap left out, which no later edit can change` | U-15 on the phone |
| mobile `listens to the foreground ONCE for both ladders` | `listens to the foreground ONCE for both ladders, through the one coalescing gate` | U-24: same guarantee, now naming the mechanism that provides it |

---

## 3. Adversarial live probes — invented AFTER the implementation

Replayed against the live CA index with `tools\kprobe.py`, which reproduces the service's exact query.
‼️ **A replay proves the index and the ranking, never the gates, the trim or the note.**

| # | Probe | What came back | Verdict |
|---|---|---|---|
| A1 | Mixed script — `haircut વાળ કાપવાની કિંમત` | Search text carries both; 2 hits at **11.95** | ✅ A mixed-alphabet question is not split or dropped |
| A2 | A code `TL1255` in a Devanagari question | Search text `TL1255 … TL१२५५ … tl1255*` | ✅ The code wildcard and both digit forms are emitted. **Observation O-1** below |
| A3 | A French caller against a Gujarati document | 2 hits at 0.0167, by vector only | ✅ Meaning reaches across the alphabet |
| A4 | A 200-character question ending in an emoji | 2 hits, no error | ✅ |
| A5 | Gujarati digits only (`૫૦૦`) | Search text `૫૦૦ 500` | ✅ G-13 live |
| A6 | Simple-query operators in the caller's words (`-20 +cut \| "colour" (deal)`) | Every operator escaped; **200, not 400** | ✅ G-12 live |
| A7 | A rendering that CLAIMS Gujarati and is Latin | 0 hits | ✅ The consequence the server-side verification exists to prevent; the verification itself is unit-pinned |
| A8 | A Chinese question against a Chinese document, keyword-only, on v1 | **0 hits** | ✅ Expected — and the whole case for `contentCjk` |
| A9 | A Tamil question against the Gujarati document | 2 hits by vector | ✅ |
| A10 | 200 characters ending mid-surrogate | No error; the lone surrogate never reaches the wire | ✅ G-20 live |

**O-1 (observation, not a defect).** On a Devanagari leg the ASCII digits inside a Latin code are also
emitted in Devanagari (`TL1255` → `TL१२५५`). Nothing is written that way, so the extra term matches nothing
and contributes nothing to BM25; it costs a few bytes on the wire. Narrowing the fold to exclude a token that
carries Latin letters would be a second rule in a place that currently has one, for no measured gain. Left as
it is, and written down so the next reader does not mistake it for a bug.

---

## 4. Sabotage sweep

Five deliberate defects, each applied to the real source, tested, then restored from a scratchpad snapshot.

‼️ **THE SWEEP LIED THE FIRST TIME, AND THIS IS THE MOST IMPORTANT THING IN THIS FILE.**
`shutil.copy2` **preserves the original mtime**. So after a restore, MSBuild saw a source file *older* than
the binary it had just built **from the sabotage** — and did not rebuild. Every later run then tested
sabotaged code while the source on disk was innocent. It was caught because a new test failed with a result
that was arithmetically impossible for the code on disk, and the same input answered correctly the moment the
file's timestamp was touched. **A restore that does not change the timestamp does not restore the build.**
The harness now touches every file it restores, and the results below are from the re-run.

| # | The defect introduced | Caught by | Verdict |
|---|---|---|---|
| **S1** | `FuseByRank` reverts to a max-score merge (`+=` → `Math.Max`) | `Clinqet.Mcp.UnitTests` multilingual — 1 of 23 red | ✅ CAUGHT |
| **S2** | `ResolveHan` stops adding the Han count to Kana/Hangul (the removal still happens, so the LABEL is unchanged — only the arithmetic) | `TextScriptDetectorTests` — 1 of 54 red, and it is **the test this audit added** (D-3) | ✅ CAUGHT (was PASSED before D-3) |
| **S3** | The tenant scope no longer has to LEAD the filter (`StartsWith` → `Contains`) | `KnowledgeQueryScopeGuardTests` — 4 of 15 red, and it is **the suite this audit added** (D-2) | ✅ CAUGHT (was PASSED before D-2) |
| **S4** | `contentCjk` is written even when `CjkFieldEnabled` is false | `KnowledgeCjkFieldTests` — 1 of 11 red | ✅ CAUGHT |
| **S5** | The note envelope is subtracted as characters again | `RetrievalPayloadSizeMeasurementTests` + `TokenBudget_*` — 4 of 19 red | ✅ CAUGHT |

**Two of five passed on the first sweep**, and both were real coverage holes rather than weak mutations:

- **S2** passed because the existing Japanese test (`AJapaneseDocument_IsOneAlphabet_EvenThoughMostOfItIsKanji`)
  carries plenty of kana, so Japanese clears the dense-script floor of 4 with or without the absorption — it
  pinned the LABEL, never the arithmetic. A real Japanese rate card written almost entirely in kanji has two
  kana in it, under the floor, and the absorption is the only thing keeping the alphabet alive: without it
  the document answers **Latin** and is searched in English.
- **S3** passed because the guard had no test at all. An integration test does prove that *today's* filter
  leads with the scope — but it cannot fail when the **guard** is weakened, and the guard exists for the
  filter nobody has written yet.

Both holes are closed (§12 D-2, D-3) and both sabotages were re-run afterwards and are now caught.

---

## 5. Latency

Measured against the live CA endpoints from a development machine over the public internet — an upper bound,
since the MCP host sits in-region beside the search service. Five rounds, medians.

| Legs | Embedding (one request per leg, started together) | Search, sequential | Search, concurrent — **the shape the service uses** |
|---|---|---|---|
| 1 | 392 ms | 525 ms | 580 ms |
| 2 | 525 ms | 1,074 ms | 539 ms |
| 3 | 467 ms | 1,821 ms | **882 ms** |

**Worst measured case — three alphabets: ~467 ms + ~882 ms ≈ 1.35 s**, against
`Voice:Knowledge:RetrievalTimeoutMs` = **4,000 ms** and a slow-warn at **1,500 ms**. The fan-out is what keeps
it there: three legs run sequentially would be 1,821 ms of search alone and would trip the slow-warn on its
own.

---

## 6. Cost

| Question | Answer |
|---|---|
| Embedding calls per query | **One per leg**, capped at `RetrievalMaxQueryLegs` = 3, all started together |
| Does that cost more money? | **No.** Embeddings bill per token; the same N texts are embedded either way. It is N calls against the requests-per-minute quota, not N× the bill |
| Searches per query | One per leg, plus the overview companion in the same round trip |
| Cosmos RU | **Unchanged.** No new container, no new field, no new query. The receptionist-gate sweep is the same single `TOP 1`-shaped read Phase 2 measured at 9.67 RU |
| The one NEW call this phase adds | `IBusinessAlphabetService` reads the business's alphabets from the index's `scripts` facet — **one `$top=0` search per call setup**, cached for `BusinessSearch:Scripts:CacheMinutes` = 30 (and an unresolved answer for 60 s, so a cold business does not re-ask on every call), with a `LookupTimeoutMs` of 250 and **fail-soft**: no alphabets simply means the prompt names none. It is what makes an English-speaking caller able to reach a Gujarati price list, and it costs a facet query every half hour per business |
| Index size | `contentCjk` is written **only when a card actually contains Han or Kana**, so it is absent — and free — for every other business. `contentVector` is now **not stored**, which removes ~35–40 KB per card that no read path ever selected |

### ‼️ D-4 — a cost claim in two comments was wrong, and is fixed

Both `ProviderKnowledgeSearchService` and `VoiceKnowledgeSettings.RetrievalMaxQueryLegs` claimed *"the embeds
coalesce into a single request"*. They do not: `CoalesceBulkAsync` is reached **only** when
`lane == AiWorkloadLane.Bulk`, and retrieval runs on `Interactive` (a caller is waiting). The consequence the
comments claimed — one round trip — is still true, because the legs are started together and awaited as a
set, and the live measurement above shows exactly that. But the mechanism was misstated, and a false
mechanism in a comment is how the next person makes a wrong decision. **Both comments now say what actually
happens.** The code was deliberately NOT restructured to a real batch: it would trade the per-leg fail-soft
budget for an all-or-nothing one, in exchange for at most two requests per query against an RPM quota.

---

## 7. Security and tenancy

| Check | Result |
|---|---|
| The tenant scope LEADS every filter | ✅ `AssertScoped` on all four search paths; the overview companion appends to an already-asserted filter; **live**: every probe's filter begins `businessId eq '…'` |
| Row-level verification | ✅ `ReadVerifiedPassagesAsync` raises a cross-tenant alarm and **discards the whole result set** on a foreign row — it does not filter it out |
| A new alphabet cannot widen the scope | ✅ A leg changes only the search TEXT and the searchFields; the filter is built once, per business |
| The model cannot inject a leg for another business | ✅ `businessId` comes from the bound call context, never from the tool arguments |
| A rendering the model invented | ✅ Verified server-side with `TextScriptDetector.ContainsScript` before it becomes a leg |
| `contentCjk` cannot leak | ✅ Same filter, same row verification; it is a second analyzer over the card's own text |

**Fixed here:** the scope guard itself had no test. See D-2 in §12.

---

## 8. Analytics

**Untouched.** A file-list diff of all seven backend commits names no analytics file, no Parquet schema, no
event type and no emission site. `SearchAnalyticsSchema` (91 fields) and `UserInteractionSchema` (45) are
unchanged.

---

## 9. Config and deploy hygiene

| Check | Result |
|---|---|
| New settings | `RetrievalMaxQueryLegs` (3) and `CjkFieldEnabled` (false). Class defaults and appsettings agree in every host that declares them |
| Keys removed | API host **6**, Functions host **14**. Every one traced to its readers: they are read by `SearchAsync` — the phone's overload — which those hosts never call. **And every removed value equals its class default**, so the removal is behaviour-neutral even if a reader is found later |
| Orphan keys | None introduced |
| ARM / `deploy.ps1` | No new Azure resource, no new queue, no new storage container, no new `local.settings.json` key ⇒ no infrastructure change is owed |
| Index version | `Search:KnowledgeIndexVersion` = `v2`, falling back to `Search:IndexVersion` when unset — so a knowledge schema change no longer drags the services and providers indexes into a full re-stream |
| Alias | Documented as **owner-run per region** (§13) |

### ‼️ What was done to the Canada sandbox, exactly

1. `cosmosindexsetup --search-only` (Canada profile) **created `clinket-knowledge-dev-v2`** and repointed the
   alias at it. **Azure accepted the index definition, including the custom analyzer** — the one thing no
   unit test can prove.
2. The v2 shape was read back: `contentCjk` present with `knowledgeCjkAnalyzer`
   (`standard_v2` + `lowercase` + `asciifolding` + `cjk_width` + `cjk_bigram`); `contentVector`
   `retrievable=false, stored=false`; `updatedAt` no longer filterable or sortable; `docType`/`chunkKind` no
   longer facetable, `chunkKind` still filterable; `scripts` still facetable; scoring profile
   `knowledgeRelevance`.
3. **The alias was pointed back at `clinket-knowledge-dev-v1`.** `Voice:Knowledge:CjkFieldEnabled` cannot be
   turned on from a developer machine (no Azure CLI on this host), so an empty v2 would have emptied
   knowledge retrieval for every business in the sandbox and bought nothing. v1 is untouched and still
   carries all 2,863 cards; v2 exists, verified and empty, waiting for the owner's re-ingest.
4. One proof card was written into **v2** to prove the field end-to-end, then deleted. v2 is back to **0
   documents**.

---

## 10. Comments

3,103 non-blank lines added; **850 are comments (27%)**; **zero `TODO`/`FIXME`/`HACK`**. The longest blocks
are `/// <summary>` headers on new test classes and settings, which is this codebase's own convention and
state WHY, not WHAT.

**Five defects found and fixed** — all of them scars left by scripted edits, all of them shipped:

| Where | What it said | What it says now |
|---|---|---|
| `KnowledgeSearchIndexer.cs` | `//  carries the same text under an analyzer…` — the subject was **gone** | `` // `contentCjk` carries the same text… `` |
| `ProviderKnowledgeSearchService.cs` | `also searched as "૫૦૦"` | `also searched as "૫૦૦"` |
| `TextScriptDetectorTests.cs` ×2 | `"料金"`, `"૫૦૦"` | `"料金"`, `"૫૦૦"` |
| `RetrievalPayloadSizeMeasurementTests.cs` | `another script'''s characters` | `another script's characters` |

‼️ **The cause is one habit, and it now has a rule.** Backticks inside a double-quoted shell string are
**command substitution**, so every backticked term in a `py -c "…"` one-liner is executed and replaced with
nothing. The same session's `MEMORY.md` line lost six terms the same way. **Write the script to a file with
the Write tool; never pass prose through a shell string.** Every added line in all nine repos was then
re-scanned for empty backtick pairs, doubled spaces, tripled quotes, stray escapes and mojibake — the five
above were the only hits.

---

## 11. Documentation and memory

| Artefact | State |
|---|---|
| `phase-3\PROGRESS.md` | The measurements, the two §0.7 asks, the defects found in this phase's own work |
| `phase-3\HANDOVER.md` | File-by-file; corrected on the fixture's alphabets (§2.4) |
| `PHASE-4-FINAL-AUDIT-PROMPT.md` | Rewritten, DRAFT header gone, §0.0 added |
| SKILLs | `clinqet-voice-assistant`, `clinqet-business-search`, `clinqet-search-discovery` — **verified present in all four tool directories** (12 files) |
| Memory | `knowledge-extraction-fix-phase3-2026-09-15.md` + one `MEMORY.md` index line, repaired after the backtick loss |
| Mockups | `business-search-source-whose-words` and `knowledge-screen-honest-counts-and-reasons`, both in `Data\mockups\` and registered in **both** registers (§0.20) |
| `CANADA-SANDBOX-ACCESS.md` | Three API-version traps + `kprobe` |

---

## 12. Findings, and what was done about each

Eight findings. **All eight fixed, and every fix re-reviewed** — the two coverage holes by re-running the
sabotage that had passed, the rest by re-reading the artefact and re-running the suite that owns it.

| # | Finding | Severity | Fix | Re-review |
|---|---|---|---|---|
| **D-1** | `KnowledgeSearchIndexer.cs` shipped a comment whose subject was **missing**: `//  carries the same text under an analyzer…`. A backtick inside a double-quoted shell string is command substitution, so `` `contentCjk` `` was executed and replaced with nothing | Low (prose) | Subject restored | Every added line in all nine repos re-scanned for the same scar; §10 lists the four others found and fixed |
| **D-2** | ‼️ **The tenant scope guard had no test.** `AssertScoped` demands the scope LEAD the filter; weakening it to `Contains` left every suite green. `docId eq 'x' or businessId eq 'B'` contains the clause and is scoped to nothing | **High** (it is the last thing between a query and another business's documents) | The predicate extracted as `internal static IsScopedTo`, and `KnowledgeQueryScopeGuardTests` added in `Clinqet.API.UnitTests` (§0.18 — the provider path runs in the API host): 15 cases covering leading, merely-containing, `or`-optional, a prefix-colliding id, a lower-cased field name, null/empty, and an apostrophe id | **Sabotage re-run: CAUGHT**, 4 of 15 red |
| **D-3** | ‼️ **The Han-absorption arithmetic had no test.** The existing Japanese test has enough kana to clear the floor without it, so it pinned the label and not the rule. A mostly-kanji Japanese rate card would answer **Latin** and be searched in English | **High** (a whole alphabet silently unreachable) | `AMostlyKanjiJapaneseDocument_KeepsItsAlphabet_BecauseTheHanCountsAsJapanese` — 34 kanji, exactly two kana, under the dense-script floor of 4 | **Sabotage re-run: CAUGHT**, 1 of 54 red |
| **D-4** | Two comments claimed the legs' embeddings *"coalesce into a single request"*. They do not: `CoalesceBulkAsync` is reached only on the **Bulk** lane and retrieval runs on **Interactive** | Medium (a false mechanism leads to a wrong decision later) | Both comments now state what happens: N requests, started together, **one round trip of latency**, N against the RPM quota, identical token cost. **The code was deliberately not restructured** — a real batch would trade the per-leg fail-soft budget for an all-or-nothing one, to save at most two requests per query | Re-read against `AzureAIFoundryEmbeddingService`; the latency claim measured live (§5) |
| **D-5** | Four comment lines carried scripted-edit scars: three showing `\uXXXX` where the house style writes the character, one reading `another script'''s` | Low (prose) | All four repaired | Full re-scan for empty backtick pairs, doubled spaces, tripled quotes, stray escapes and mojibake — no further hits |
| **D-6** | ‼️ **The sabotage harness itself lied.** `shutil.copy2` preserves mtime, so a restored file looked **older** than the binary just built from the sabotage; MSBuild did not rebuild, and later runs tested sabotaged code from innocent source. It reported two false PASSES and failed one correct new test | **High** (an audit tool that invents results is worse than no audit tool) | The harness touches every file it restores; the whole sweep was re-run | All five verdicts re-derived from the re-run; the false failure disappeared the moment the timestamp changed. Written into the gotcha list |
| **D-7** | `productIdentityFollowsPreference.test.js` had been **red on origin/master since 2026-09-14** — a guard shipped alongside the very declaration it forbids. Not this phase's, but this phase's push would have failed web CI and the partner app would not have deployed | **High** (blocks the deploy) | The orphaned `NEXT_PUBLIC_CLINKET_CALL=true` and its four stale comment lines deleted from `.env`; a two-line note kept | Suite re-run: **10 of 10 green**; full web suite **4,025 / 4,025** |
| **D-8** | This phase's own handover said the retained fixture is *"Hindi, not Gujarati"*. Read live, it is **both** — the PDF carries Devanagari, Gujarati and English cards | Medium (Phase 4 plans its fixture run from this sentence) | Corrected in `PROGRESS.md`, `HANDOVER.md`, `PHASE-4-FINAL-AUDIT-PROMPT.md` and the memory entry | Re-read from the live index: `4eeae96e…` 6 cards across `Deva`/`Gujr`/`Latn`; `6fcd9c32…` 3 cards, `Gujr` |

---

## 12.5 ‼️ THREE DOCUMENTS THIS PHASE CREATED, AND WHY THEY ARE STILL THERE

`PLAN.md` ruling 2 says extra documents a phase creates are deleted by that phase. These three are still in
`MEE3IC` and **should be**:

| docId | file | alphabet |
|---|---|---|
| `9b3811f26ae743dca0695b17b3ded7ec` | `clinket-gujarati-price-list.txt` | Gujarati |
| `9efc624c7ce94b5fa07a0abbd4ffb258` | `clinket-tamil-price-list.txt` | Tamil |
| `88f256ea7262401b9918b95478e3bf26` | `clinket-chinese-price-list.txt` | Chinese, deliberately written **without spaces** |

Two reasons, and the owner can overrule either. **First**, they are the only live corpus on which
multilingual retrieval can be re-verified — the retained fixture is Devanagari/Gujarati/English and has no
Chinese or Tamil in it at all, and Phase 4's job is to re-prove this phase rather than take its word.
**Second**, deleting them needs the API, and the provider session died mid-audit (§13.7) — so the choice was
between leaving them documented or leaving them undocumented. **Phase 4 should re-run its multilingual proof
against these three and then delete all three with the same purger that takes the 17 fixtures.**

---

## 12.9 ‼️ OWNER-APPROVED ADDITIONS, 2026-09-15 — and the audit of them

The owner approved three of the open items in conversation. A fourth I proposed was **withdrawn after
investigation** — see below, because not building something is also a decision that has to be defended.

### R-10, built as ONE Cosmos boolean and no search-index field

`KnowledgeDocument.cardsRewriting`. `status` was answering two different questions with one word — what to
tell the PROVIDER, and whether the RECEPTIONIST may answer — so a re-read silenced the document for its whole
run and a caller asking about the very file being replaced was told the business does not cover it.

**The measurement that makes it cheap:** a run spends its minutes parsing, describing and embedding, and
touches no card until the end. The card write is seconds. So the window that must close is seconds, not
minutes, and naming it costs one boolean.

| Where | What |
|---|---|
| Written | `KnowledgeIngestProcessorFunction`, in a commit immediately before the first `UpsertCardsAsync` |
| Cleared | ‼️ **Inside `CommitAsync` itself** — the one funnel every status change passes through — so no terminal path (Ready, Failed, the duplicate merge, the abort) can forget to. `MarkDeletingAsync`, the only status change that does not ride it, clears it in place |
| Read | `KnowledgeAnswerableRule`, the single rule the gate sweep, `AnyReadyAsync` and the document page all use |
| Index | **No AI Search field. No Cosmos index path** — the field is projected in the sweep and filtered only inside a partition-scoped `TOP 1` over ≤220 rows |

**‼️ The safety proof, which is structural rather than hopeful.** The flag is only ever consulted while the
row is `Processing`, and a `Processing` row answered **nothing** before this change. So the flag can only move
a document from silent to answering, never the other way. **A stranded `true` is exactly the old behaviour.**
`KnowledgeCardsRewritingTests.TheFlagCanOnlyEverAddAnswerability_NeverRemoveIt` states that as a test rather
than as a paragraph.

**Edge cases, each checked rather than assumed:**

| Case | Outcome |
|---|---|
| Host crash / deploy / restart mid-write | Message never completed → Service Bus redelivers → the run restarts and clears it |
| Retries exhausted → dead-letter | Row stays Processing + flag true → silent. ‼️ **Identical to today.** Three separate mechanisms already cover it, each verified rather than assumed: the nightly `KnowledgeMaintenanceFunction` dead-letter drain **alerts** ("the row will sit unfinished until someone acts"); `KnowledgeController` line 1207 puts **`Stopped:`** on the row DTO so the provider's screen says so; and `KnowledgeManagementService` line 423 lets them **re-read** past `StaleProcessingMinutes` |
| Document deleted mid-run | The tombstone CAS already aborts and self-purges |
| Replacement fails mid-run | Phase 2's keep-the-answering-version rule is untouched |
| A row written before the field exists | Absent reads as false, both in C# and in SQL — ‼️ which is why `NOT IS_DEFINED` comes FIRST in the filter: `c.cardsRewriting = false` is UNDEFINED, not true, for a missing property, and the wrong order would have silenced every pre-existing row |
| The document **page** endpoint | Now reachable mid-run, so I checked what it serves: both artifact readers already require `ContentHash` explicitly. During a REPLACE the hash still names the live version, so the page shows exactly what the cards answer from; during a re-read of unchanged content the hash is deliberately cleared, so the page reports nothing rather than rendering a half-written artifact. The stale comment claiming this was "a coincidence" is corrected |
| Provider-facing copy | Swept: **no sentence anywhere claims a file is unavailable to callers while it is read**, so nothing became untrue |

### X-01's missing half — `AiTurnCitation.channel`

One nullable string on the stored citation. **Absent means the provider's own words**, exactly as on the wire
and on the screen, so a turn stored before the field renders as it does today rather than being guessed into
a channel. No backfill, none wanted. The UI needed **no change at all** — the reopen path rebuilds the same
DTO the live one carries, which is what a clean contract looks like.

### The plural defect found on the live screen

*"We left 1 sentences out…"* — four reading notices spliced a number into a hardcoded plural. Fixed with
`_One` siblings in all five languages, the spelling **already in use**
(`Notification_KnowledgeServiceDraftsReady_Body_One`) rather than a second convention. The rule owns which
keys have a singular form; `KnowledgeNoticeSingularTests` proves every one of them exists in every shipped
language, so a Gujarati reader can never get a raw key where a sentence belongs. Three counted notices are
deliberately excluded because their number can never be 1.

### ‼️ The fourth item, WITHDRAWN — the stuck-run sweeper I proposed

I proposed a nightly job to rescue documents stranded in `Processing`. **Investigating it showed the recovery
already exists**, and re-checking my own first summary of it showed I had attributed it to the wrong place —
so here it is read out of the code, line by line:

| Concern | Already handled by | Verified at |
|---|---|---|
| Nobody is told | `ReportStuckProcessing` fires the moment the API knows it stranded a row (queue send failed, CAS exhausted, FAQ purge failed) | `KnowledgeManagementService` 300 · 1165 · 1232 |
| A strand the API never saw (host died, message dead-lettered) | The **nightly** dead-letter drain alerts, every night, until acted on | `KnowledgeMaintenanceFunction.DrainIngestDeadLetterAsync` |
| The provider cannot see it | `Stopped:` rides the row DTO to the screen | `KnowledgeController` 1207 |
| The provider cannot fix it | The reprocess gate permits a re-read past `StaleProcessingMinutes` (160 min — already tuned above the legitimate maximum of 8 continuations × 900 s) | `KnowledgeManagementService` 423 |

‼️ **`HasStoppedPartWay` is the CLOCK for the screen and the gate — it is not what alerts.** My first summary
said it was; that was wrong, and a future session would have gone looking for an alert in the wrong file.

**And the decisive argument, which is stronger than "it would duplicate":** a sweeper would change nothing a
caller experiences. A row stranded *before* the card write now keeps answering under R-10, so there is no
harm to rescue; a row stranded *during* the write holds a mixture of two versions and must not answer — and
flipping it to `Failed` would not make it answer either, it would only relabel. **Not built, on purpose.**

### ‼️ ALL THREE PROVEN LIVE ON THE DEPLOYED CA STAMP, 2026-09-15

| Item | What the live system did |
|---|---|
| **Plural** | `GET /knowledge/documents` now returns *"We left **1 sentence** out of this file's summary because **it** mentioned a figure the file doesn't contain."* The same row read *"1 sentences … they mentioned"* on screen hours earlier. **This was also the deploy detector** |
| **X-01 reopen** | Asked live, then reopened the stored conversation: **five marked sources, identical in both** — including `picture-description` on the salon photo and `generated-overview` on the Tamil summary. The mark no longer evaporates on reopen |
| **R-10** | Reprocessed the Gujarati price list, then asked during the run: **`status=Processing`, `passages=2`, and the document was CITED in a live answer.** Before this change that was impossible — `Processing` meant excluded from the answerable set for the whole run |

### Sabotage sweep on the new code — four defects, four caught

| # | The defect introduced | Caught by | Verdict |
|---|---|---|---|
| **S6** | The rewrite window is ignored — a `Processing` row answers even mid-write | `KnowledgeCardsRewritingTests` + `KnowledgeAnswerableRuleTests`, 2 of 43 red | ✅ CAUGHT |
| **S7** | ‼️ **The SQL drops its `IS_DEFINED` guard** — the exact trap that would silence every row written before the field | The **real-engine** emulator test, 1 of 1 red | ✅ CAUGHT |
| **S8** | A reopened answer loses the AI mark again | `BusinessSearchReplayParityTests`, 2 of 13 red | ✅ CAUGHT |
| **S9** | The singular key is never chosen | `KnowledgeNoticeSingularTests`, 1 of 10 red | ✅ CAUGHT |

S7 is the one worth keeping: a source-shape assertion would have passed it happily, because the SQL *reads*
correct either way. Only Cosmos itself knows that `c.cardsRewriting = false` is UNDEFINED — not false — for a
property that was never written.

### One sabotage that would pass, reported rather than hidden

Deleting the clear inside `CommitAsync` would leave the flag stranded, and no test would fail. That is
accepted rather than patched: by the safety property above, a stranded flag is exactly the pre-change
behaviour, and the alternative — a harness around a private method of a 3,500-line Function class — would buy
coverage of a case that cannot make anything worse.

---

## 13. Gaps left for Phase 4

1. ✅ **CLOSED — both §0.7 asks were approved in conversation the same day and are BUILT, tested and proven
   live.** `AiTurnCitation.channel` and R-10, the latter as **one nullable Cosmos boolean
   (`cardsRewriting`) and no search-index field at all** — a far smaller shape than the `generation` field
   originally proposed. Full record in §12.9; the live proofs are in the table above it.
2. ✅ **CLOSED 2026-09-16 — see §14.** The switch is deleted, both regions carry `contentCjk`, and Chinese is
   findable by word, proven live. Japanese has no card in the corpus, so it is proven at the analyzer only:
   `en.microsoft` shares **0** tokens between a Japanese price line and the question about it,
   `knowledgeCjkAnalyzer` shares **4** (ヘア アカ カッ ット).
3. ✅ **CLOSED BY OWNER DECISION 2026-09-16 — NO CJK FONT. Do not re-raise this.** A CJK/Korean Noto face is
   **10–16 MB** against the **3.6 MB** the entire current font chain weighs; the owner ruled that cost is not
   worth paying. Chinese, Japanese and Korean price lists render as boxes in the material PDF **by decision**.
   ‼️ **The old wording of this gap was also WRONG and is corrected here**: it named "Han, Japanese and
   Hebrew" and silently omitted **Hangul (Korean) and Thai**, which fall through the same catch-all and are
   equally unrendered. **FIVE scripts, not three.**
   ‼️ **Thai and Hebrew are NOT closed by that decision** — they are ~50–150 KB each, the same class as
   Gurmukhi (54 KB) and Tamil (73 KB) which already ship, so the size argument does not apply to them. They
   remain an open, cheap question for the owner.
   ‼️ **Every INDIC font is already shipped** — Devanagari, Gujarati, Gurmukhi, Bengali, Tamil, Telugu, plus
   Arabic and Latin/Cyrillic/Greek. There is nothing Indian left to add.
4. 📏 **MEASUREMENT ONLY — NOT A BUILD TASK. Japanese has not been measured on the vector leg** the way
   Chinese has (Chinese scores 0.603 Chinese→Chinese). Japanese may be weaker, which would make `contentCjk`
   a rescue there rather than an improvement.
   ‼️ **Phase 4's job is to take the number and write it down, nothing else.** Embed a Japanese question and
   a Japanese passage, score them, record it. **If the number is poor, STOP and bring it to the owner** — do
   not tune a threshold, do not add a leg, do not change a weight. Nothing here is known to be broken; this
   is a blank in the evidence, not a defect.
5. 📏 **MEASUREMENT ONLY — NOT A BUILD TASK. `RetrievalMaxQueryLegs` is 3 and the tool offers 14 fields.** A
   business writing in four alphabets gets three legs and an honest "not searched in" note — which is
   *correct, designed behaviour*, and the caller is told. Nobody has measured whether such a business exists.
   ‼️ **Phase 4 counts alphabets per business across the live corpus and writes the number down.** Do NOT
   raise the cap, do NOT make the leg count adaptive, do NOT touch the note. **If a real four-alphabet
   business turns up, STOP and bring it to the owner** — the cap exists so a model that fills every field it
   is offered cannot turn one question into fourteen, and changing it is a cost decision, not an audit fix.
6. ✅ **CLOSED — the owner signed in and the screens were walked live.** AI Knowledge at **1440 / 1024 / 768
   / 375**: zero horizontal overflow, zero clipped elements, zero sideways scrollers at every width; the
   sidebar collapses at 768 and the page is one column at 375. Seen on screen and not otherwise provable:
   the Chinese, Tamil and Gujarati document titles render in full and wrap rather than truncate (U-19), and
   **every new document shows `Answers only` rather than "Answers & sends"** — U-14's exact defect, fixed.
   In Ask Clinket the source card carries the green **"Summary written by AI"** chip while the provider's own
   documents beside it carry none.
   ‼️ **Two things this cost, both worth writing down.** Entering a password is prohibited and the
   environment refuses to put a token in a URL, so the only route was the owner signing in themselves — and
   **that sign-in revoked the stored API session**, because every login revokes every refresh token on the
   account. The browser and `tools\api.py` cannot both hold a session on one account; the order is in
   `CANADA-SANDBOX-ACCESS.md`. It also found the plural defect (§12.9) that no test would have.
7. ✅ **CLOSED the same day — X-01 IS proven through the deployed API.** The owner supplied a fresh login and
   `POST /business/search/ask` was driven as the provider on the live CA stamp. The citations come off the
   wire carrying the mark:
   - `"channel": "generated-overview"` on a document summary our system wrote,
   - `"channel": "picture-description"` on the salon price-list **photo**
     (`be07d747…`, "A heavily green-distorted salon price list…"),
   - **no `channel` at all** on the provider's own document text — the absence that can only mean "your own
     words".

   ‼️ **Root cause of the session death, read out of the code and worth keeping:** a fresh interactive login
   **revokes every existing refresh token** on that account (`InvalidateRefreshTokensAsync` sets `IsRevoked`
   before the new session is issued). The owner signing in to the partner app is what killed the stored one —
   not misuse, not expiry (7 days), not a spent token. And because `IsRevoked` is a *different branch* from
   `IsUsed`, the single attempt made here could not and did not trip `RevokeAllOnReuse`. The five refusal
   causes are now tabulated in `CANADA-SANDBOX-ACCESS.md`.

---

## 14. ‼️ ITEM #3 CLOSED — the CJK field is live in both regions (2026-09-16)

The last open item of Phase 3. The owner rebuilt nothing by hand and lost nothing.

### What shipped

| | |
|---|---|
| `Voice:Knowledge:CjkFieldEnabled` | **DELETED** — property, all three host appsettings, both `if` branches, both convention-test registries. Not flipped (§0.7.1: no feature flags, no old paths) |
| The CJK rule | Moved to `TextScriptDetector.NeedsCjkTokenisation` in `clinqetcore`, so the indexer that writes the field and anything that reproduces it share ONE definition |
| `ActiveSearchFields` | Gone. One list; `contentCjk` is always searched |
| Both `clinket-knowledge-dev-v2` indexes | Rebuilt with `contentCjk` + `knowledgeCjkAnalyzer`, Form B kept, the three unused attributes dropped |

### ‼️ The index was REFILLED BY COPY, not by re-ingest

`v1` hands back every field including the vector, so the rebuild cost **no AI, no Document Intelligence, no
extraction drift** — minutes instead of the ~1,465 s per 100-page document a re-ingest costs. **This is the
entire payoff of the owner's decision to keep the vector retrievable** (§12.9 / G-18).

| | Canada | India |
|---|---|---|
| Cards copied | 2,850 / 2,850 | 2,625 / 2,625 |
| Verified field-by-field, vectors included | 27 cards, **byte-identical**, 0 mismatches | 25 cards, **byte-identical**, 0 mismatches |
| Cards carrying an embedding | 2,850 | 2,625 |
| Cards carrying Chinese/Japanese | 2 | 0 |

The copier was **throwaway code, deleted after the run** by owner ruling — a migration is not a CLI surface.
The recipe survives in the `clinqet-search-discovery` SKILL so it can be rewritten without rediscovering the
traps (keyset paging not `$skip`; byte-bounded pages; derive `hasEmbedding` and `contentCjk`; copy BEFORE the
alias moves).

### ‼️ TWO DEFECTS FOUND BY THIS AUDIT, BOTH MINE, BOTH FIXED

| # | Defect | Why it mattered | Fix |
|---|---|---|---|
| **A-1** | **The new index came out with the vector NOT retrievable.** Removing the explicit `IsHidden = true` left it UNSET — and unset means the SERVICE's default, which for a vector field is `retrievable=false` | The bytes were kept but unreadable. The copy still worked (it read from `v1`), so nothing failed — but the NEXT migration would have read 3,072 nulls per card and produced an index with **no vectors at all, silently** | `IsHidden = false` and `IsStored = true` both set EXPLICITLY. `retrievable` is mutable in place, so both regions were fixed without another rebuild |
| **A-2** | **The test that should have caught A-1 passed.** `Assert.NotEqual(true, field.IsHidden)` is **satisfied by `null`** — the exact value that caused the defect | The Phase-3 D-3 lesson repeating: a test can pin the label and miss the arithmetic | `Assert.False(field.IsHidden)` / `Assert.True(field.IsStored)`. Sabotage S5 (delete the line) now fails with `Expected: False, Actual: null` |

### ‼️ A COVERAGE HOLE THE AUDIT FOUND — the searched field list was unguarded

The index definition was pinned, so a dropped FIELD would have been caught. **The SEARCHED FIELD LIST was
not.** Removing `contentCjk` from `ProviderKnowledgeSearchService.SearchFields` kills Chinese and Japanese
retrieval outright while the index still declares the field and every suite stays green. Now guarded on both
legs: `KnowledgeSearchFieldsTests` (API host — Business Search) and
`SearchFields_IncludeTheChineseAndJapaneseCompanion_OnEveryLeg` (MCP host — voice).

### Sabotage sweep — five defects, five caught

| # | Defect introduced | Caught by | Verdict |
|---|---|---|---|
| **S1** | `contentCjk` dropped from the searched field list | API 1/3 red **and** MCP 1/2 red | ✅ CAUGHT |
| **S2** | Hangul added to the CJK rule (Korean separates its words — it must NOT get the field) | `KnowledgeCjkFieldTests` 1/10 red | ✅ CAUGHT |
| **S3** | `Any` → `All` (the live `Latn,Hani` card would lose the field) | `KnowledgeCjkFieldTests` 3/10 red | ✅ CAUGHT |
| **S4** | Vector hidden explicitly | `TheVector_StaysRetrievable…` 1/1 red | ✅ CAUGHT |
| **S5** | ‼️ Vector's `IsHidden` line **deleted** — the defect actually shipped | Same test, `Expected: False, Actual: null` | ✅ CAUGHT |

Every file was snapshotted to the session scratchpad, restored from there and **`touch`ed** (§0.19 — never
`git restore` in a shared tree; and gotcha 31 — a restore that keeps the mtime does not restore the build).
All three verified byte-for-byte by md5 afterwards.

### ‼️ NO REGRESSION IN ANY OTHER LANGUAGE — measured, not asserted

The owner's explicit concern. Two experiments, each isolating ONE variable:

**A — same index, only the field list changes.** This isolates `contentCjk` exactly:

| Query | OLD 6 fields | NEW 7 fields | |
|---|---|---|---|
| English ×3, Gujarati, Hindi, Tamil | — | — | **IDENTICAL** hits, order and scores, every one |

**B — same field list, only the index changes (v1 → v2).** Order shifts among near-ties, because BM25
statistics are shard-local and **any** rebuild moves them — a re-ingest would have done the same. Hit counts
are identical everywhere. Hindi (3 hits) and Tamil (2 hits) retain **100%** of what exists; English top-16
sets overlap 13–16/16 with score deltas of 0.9–12%. ‼️ And the product does not use BM25 alone: the vector leg
is **byte-identical**, so half of every RRF fusion is unchanged by construction.

**Chinese gained: 0 → 1 and 0 → 2 hits. Nothing anywhere lost a hit.**

### Tests

**21,296 green, 0 failed, 0 skipped** — setup 198, Functions 4,748 + 568 integration, MCP 984 + 95
integration, API 12,555 + 2,148 integration.

### What the owner still does

1. **Push** the libraries then the hosts. ‼️ Safe in either order NOW because both indexes already declare
   the field — but the permanent rule is **index first, deploy second**: the binaries name `contentCjk` on
   every query, and naming a field an index does not declare is a 400 on EVERY search.
2. **Delete `clinket-knowledge-dev-v1`** in both regions once satisfied — it is the copy source and the only
   fallback, so it goes last.
