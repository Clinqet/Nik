# P4.7 — multi-dimensional audit, 2026-09-05

> Everything the owner reported, everything the probes found on the way, and every dimension checked at the
> end. **Nothing here is asserted from reading code alone** — each row names the measurement, the test, or
> the sabotage behind it. Where I could not verify something, it says so and why.

---

## 0. What was reported, and where it landed

| # | Owner's report | Root cause | State |
|---|---|---|---|
| 1 | *"the search page … not responsive at all … when I click on the search this is how it show"* | The header ask panel was `absolute right-0` **inside the button's own box**; on a phone that button is the first of four header icons, so a 359 px card began ~150 px off the LEFT of a 390 px screen | **Fixed** — viewport-anchored, measured gap, 4 tests, sabotage-verified |
| 2 | *"the microphone … doesn't work at all fully never worked"* (200 OK, real transcript, UI says "Didn't catch that") | `TranscribeSpeech` unwrapped **one** level of a **two**-level response, so `text` was always `""` | **Fixed** — 6 tests, sabotage-verified |
| 3 | *"my highlighted question when I click it doesnt work at all even it is … my service"* | The tool told the model to send the **question**; the matcher required every token of it to be a substring of a service name | **Fixed** — 0/25 → 25/25 measured, verified end-to-end on live data |
| 4 | *"Sources 4 document show up but it is the same document 4 time"* | A card is minted per matched **part** and drawn as a whole **document** | **Fixed** — sheet M9, both apps |
| 5 | *"when I click on the show text it faiel as well"* | It reads an artefact ingest has written only since **2026-08-29**; the documents are from **2026-08-21** | **Fixed** — the words now travel with the answer; the control is drawn only when it can work. **Backfill is the owner's** |

Found by the probes, not reported:

| # | Defect | Evidence |
|---|---|---|
| 6 | An **empty query field is a choice**, not a failed rendering — the server replaced it with the whole question, turning a price filter into an every-word AND | measured 4/4 for *"list everything under 50000"* |
| 7 | `SelectFields` never requested **`currency`**, so every index-served price rendered `62,799.00` while the identical Cosmos-served row rendered `C$62,799.00` | caught by the end-to-end run; no test would have |
| 8 | The **COUNT was a second full partition scan** buying a total that overlapping legs can never quote | 48.18 RU against the page's 48.22 |
| 9 | `looksLikeStockCode` needed **two consecutive letters**, so `L122870` slipped through | 596/708 → 697/708 |
| 10 | A **draft read as a live offering** — an unapproved row reached the model unmarked | structural; now `published: false` + a note |

---

## 1. Correctness — verified end to end, on live data

Run against the local API bound to the CA dev stamp (real Cosmos, real AI Search, real model):

| Question | Before | After |
|---|---|---|
| *"How much is a 2017 MCFA GP55 (L122870)?"* | "I couldn't find pricing…" | **C$62,799.00**, cited |
| *"What skid steers do we have?"* (plural) | 0 rows | 3 results, tabled |
| *"Do we have any bulldozers?"* (the word is in no service name) | 0 rows | 3 dozers |

The 25-service measurement, through the real model and both real legs:

| contract | leg | found | rank 1 | zero results | TooBroad |
|---|---|---|---|---|---|
| the question (shipped) | Cosmos (the shipped dial) | **0 / 25** | – | **25 / 25** | 0 |
| the question | Index | 25 / 25 | 23 | 0 | **25 / 25** ⚠ |
| the words | Cosmos | 25 / 25 | – | 0 | 0 |
| the words | Index | **25 / 25** | **25** | 0 | 0 |

‼️ **The second row is the one that matters for the design**: switching only the retrieval engine does **not**
fix the defect. The contract is the root cause.

---

## 2. Edge cases — enumerated and checked

| Case | Behaviour | Where proven |
|---|---|---|
| Question mark / brackets / apostrophes in the query | Trimmed at term **edges only**; `FMC/LINK-BELT`, `303.5E2`, `ST2.8` keep their interior punctuation | `Normalize` + live probe |
| Price-only search (`{"queryInEnglish":"","maxPrice":50000}`) | Searches by price; the member's question does **not** stand in | `AnEmptyQueryBesideAPriceBound_…` |
| Empty field with **nothing else** to search by | The question still stands in — the existing "model forgot" fallback survives | `AnEmptyQueryWithNoOtherNarrowing_…` |
| AI Search unprovisioned | One Cosmos leg over the **whole** catalogue; no duplicate query | `WithNoIndex_OneLegRuns_…` |
| Business not indexed yet / brand-new | `ConfirmEmptyAgainstCosmos` answers from Cosmos, as before | unchanged path |
| Brand-new service | It is *pending* by definition, so the unapproved leg holds it | by construction |
| One leg fails | The other answers; only ALL-unavailable degrades | `MergeCatalogLegs` |
| Multi-alphabet business | One leg **per rendering per store**; translation verified on a 3-alphabet plan | composed-schema probe |
| Unknown / absent currency | The number renders **alone** — never a guessed symbol | `AnUnknownCurrency_…` |
| Scattered citations (1, 7, 11 of 12) | Every quoted part stays visible; only unquoted ones roll up | `never rolls up a part the answer quoted` |
| A part with no readable words | The screen says so; no empty row | `says so when a part carries no readable words` |
| A document with no saved text | **No control drawn at all** | `is absent when the document has no saved text` |
| FAQs / work records | Never grouped — each is one record | `what must NOT group` |
| Malformed or missing citation list | Returns `[]`, never throws | `survives a missing, empty or malformed citation list` |
| Panel opened at any width, or resized under | Clamped to the viewport with a gutter; re-measured on resize/orientation | 3 panel tests |

---

## 3. Tenant isolation

- The catalogue service's **four layers are intact** (17 touchpoints unchanged): one place builds a filter and
  it always leads with the business · model text never reaches the filter · a pre-send assertion · per-row
  ordinal re-verification that discards the whole set, alarms, and **fails closed**.
- The union passes **`authorization.BusinessId`** to both legs. `grep businessId` over the tool returns **0** —
  no business identifier is reachable from the tool schema.
- ‼️ **`UnapprovedOnly` cannot widen a customer view.** It sits inside the `else if` of `!IncludeUnapproved`,
  so on any path that does not already opt into unapproved rows it is **structurally inert**. Its only
  `true` writer is the provider surface.
- The **index is not widened** to hold unapproved rows (owner ruling). A draft's absence from the shared index
  remains the customer marketplace's protection.
- M9's excerpt is the business's own content, shown to an authorized member, drawn from cards that already
  passed the per-document audience allow-list. No new read path.

---

## 4. Cost and performance — measured, not estimated

| | RU |
|---|---|
| the page (`SELECT *` + `CONTAINS`) | 48.22 |
| **the COUNT — a second full scan** | **48.18** |
| a projection instead of `SELECT *` | 48.20 — **no saving**; `CONTAINS` cannot use an index, so the scan *is* the cost |
| narrowed by an **indexed** path (129 rows survive) | **11.13** |
| narrowed by the **unindexed** `approvalStatus` (5 of 708 survive) | **36.07** |

**End state: 95.30 → 34.82 RU per rendering (−63%)**; 286 → 104 RU per question at three alphabets. The index
leg is flat-rate. Other costs added: **one blob existence check per DISTINCT document per answer** (not per
part), and the response grows by **exactly the excerpt the model was already given**.

‼️ **`/approvalStatus/?` is added to the ProviderData policy but NOT applied to any stamp** — that needs
`cosmosindexsetup`, which the owner runs. The ~3 RU figure for the narrowed leg is an **extrapolation** from
the 11.13 RU measurement and must be re-measured once applied. It is an optimisation, not a correctness
requirement: without it the leg stays at 34.82 RU.

---

## 5. Concurrency and resource safety

- `ProviderCatalogSearchService` has **no mutable instance state** — 16 `readonly`/`const` fields, zero
  non-readonly. The union doubles concurrent calls on one scoped instance; that is safe by construction.
- The `CancellationToken` is threaded to **every** leg; `Task.WhenAll` surfaces a genuine caller cancellation
  and `LookupAsync` swallows everything else into `Unavailable()`, so one leg cannot fail the answer.
- No new `IMemoryCache` write, so §14's `Size = 1` rule is not engaged.
- No new disposable, no new background work, no new lock.

---

## 6. Localization

- **35 web entries** (7 keys × 5) and **30 mobile entries** (6 keys × 5) — all present, verified by script.
- ICU **doubles** apostrophes on web, i18next **does not** on mobile; plurals are ICU `{count, plural, …}` on
  web and `_one`/`_other` with `{{count}}` on mobile. Verified by script across all ten catalogues.
- ‼️ **No technical vocabulary in any provider-facing string** — scanned for *passage, chunk, index,
  embedding, retrieval, token, payload, endpoint, stream, cache, blob, SAS, schema, partition, vector*.
  Zero hits. One occurrence in the mockup's own rationale was reworded.
- `BusinessSearch.Source.ShowText` / `SOURCE.SHOW_TEXT` **retired in all ten catalogues** and dangling-reference
  scans return nothing. `TextUnavailableTitle` deliberately **kept** — the control can still fail transiently
  after being offered.

---

## 7. Design system and responsiveness

- The panel keeps its approved dropdown form; only its anchoring changed. No new visual design shipped
  without a sheet.
- M9 was drawn, sent, and **approved by the owner** before any UI code was written (§0.7.1), and is registered
  in `PLAN.md` §0 as superseding M2 on three named points.
- House tokens only — `bg-[#97EF29]` for the chosen state, `#E7E7E7` borders, `#F0F0F0` dividers. No invented
  colour.
- Mobile mirrors web's **rendering rules**, not its markup: same grouping, same roll-up, same withheld control,
  phone-shortened count line per M9 §5.
- ‼️ **The dashboard shell asked for `100vh`** inside `overflow-hidden` — taller than a phone browser shows, so
  bottom-docked content sat under the chrome. Now `h-viewport` with `100vh` as the fallback, guarded.

---

## 8. Tests

| Suite | Result |
|---|---|
| `Clinqet.API.UnitTests` (full) | **11,661 passed, 0 failed** |
| `Clinqet.API.IntegrationTests` — Business Search + Knowledge audience, real Cosmos + SQL | **102 passed, 0 failed** |
| `clinqetwebpartnerapp` (full) | **2,962 passed**, 2 failed — **both the other session's brand-new files** (§10) |
| `clinqetmobilepartnerapp` (full) | **3,863 passed, 0 failed**, 234 suites |
| ESLint, changed files, both apps | **0 errors** |
| `tsc --noEmit`, mobile | clean |

**New guards: 49** — 11 API (`BusinessSearchCatalogRetrievalTests`), 17 + 16 grouping (web + mobile), 11 card
rendering, 6 transcribe, 4 panel geometry, 3 shell height, plus stock-code cases in both repos.

**Sabotage-verified** (each defect reintroduced turns its own guard red, then reverted):
the tool contract · the transcribe envelope (2 of 6 red) · the panel anchoring (3 of 9 red).

‼️ **One stale-binary trap caught in flight**: a `--no-build` run reported 1 failure against the DLL from the
sabotage. Rebuilt; 11,661 green. This is §10's documented trap and it bit again.

---

## 9. Config hygiene and schema

- **`BusinessSearch:ServiceLookupSource` deleted** from `appsettings.json` and from the options class — nothing
  read it once both legs run. Dangling-reference scan: clean. `SearchEnabled` is already the kill switch at the
  right level.
- **§0.7 items:** exactly one — `/approvalStatus/?` on the ProviderData indexing policy, presented with the
  full table and **approved by the owner** before the line was written. No new field, no new container, no
  migration, no search-index field.
- No new setting, no new queue, no new storage container, no ARM change.

---

## 10. Concurrency with the other session — stated plainly

A second session worked in `C:\Nik` for this entire session, running the P4.6/M8 **money sweep** across ~20
files. Consequences, all recorded rather than smoothed over:

- The tree **did not compile** twice, from `QuestPdfService.cs` mid-edit. Neither was mine; I stopped, waited,
  and retried. I killed my own local API when it held DLL locks that would have broken their build.
- **No file overlap.** The only shared files are the five web `lang/*.json`; my read-modify-write preserved
  every key of theirs (diff verified: their money keys intact, only my 6 added and 1 retired).
- ‼️ **Two web tests are red at the end and they are NOT mine** —
  `src/components/invoice/invoiceGroupCurrencies.test.jsx` and
  `src/components/dashboard/home/earningsChartCurrencies.test.jsx`, both **untracked files created at
  03:45–03:46** by that session. I did not touch them.
- My money fix **calls `CurrencyMinorUnit.FormatMajor`, which is their uncommitted work.** If that session's
  changes are abandoned, `BusinessSearchMoney` will not compile.

---

## 11. Cleanup (§0.16)

Every probe lived in the session scratchpad. **One violation, mine, found by the sweep and removed**:
`clinqetwebpartnerapp/.claude/launch.json`, created to drive the preview tool. Deleted.

Everything else untracked in my areas is deliverable: the seven new test files and `BusinessSearchMoney.cs`.

---

## 12. ‼️ What is NOT verified, and why

1. **Real-browser layout at phone / iPad widths.** The browser tooling disconnected mid-session, and the
   Turbopack dev server **wedged on compiling a single route** — 240 s with no progress, reproduced three
   times, including before any of my UI changes. The panel geometry is proven by unit test with mocked
   `getBoundingClientRect` and sabotage; the shell height is proven as a **rule**, not a measurement, because
   jsdom does no layout. **A real-device pass on phone and iPad is still owed.**
2. **The ~3 RU figure** for the narrowed unapproved leg — an extrapolation until `cosmosindexsetup` applies
   the index path.
3. **The backfill** of whole-document text for documents ingested before 2026-08-29 — the owner's action, by
   his instruction.
4. **A "not published yet" badge on a service source card** — the answer text says it (model-generated, in the
   member's language), but the card carries no mark. That needs copy keys in five languages on both apps and
   is a small design addition beyond M9; flagged rather than shipped unasked.
