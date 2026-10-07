# AUDIT — PHASE 1 PART 2 (P1.5), 2026-09-03

> Voice input · multi-script retrieval · and every open P1 audit item.
> Companion files: `findings/MEASUREMENTS-P1.5-2026-09-02.md` (the five gates) and `CARRIED-TO-P3.md`.
>
> ‼️ Everything below is either **FIXED**, **REFUTED WITH EVIDENCE**, or **NAMED AS AN ACCEPTED RESIDUAL**.
> Nothing is "noted".

---

## 1. DIMENSIONS RUN

| # | Dimension | Verdict |
|---|---|---|
| 1 | Correctness & contracts | 6 defects found, 6 fixed |
| 2 | Tenant isolation & authorization | clean; 1 guard strengthened. Re-run: `prepare` was UNTESTED (A-14) — now covered; no gap found in the code |
| 3 | Data safety & idempotency | 1 defect found and fixed |
| 4 | Cost & performance | 2 improvements, 1 residual named |
| 5 | Memory / resource leaks & thread safety | 3 defects found, 3 fixed |
| 6 | Config hygiene | 2 orphans removed (A-12 on the re-run), 1 drift class closed, 1 dial added (A-6) |
| 7 | Localization ×15 | clean for completeness; the re-run added the ORPHAN direction — A-12 |
| 8 | Web / mobile parity | ‼️ **NOT clean — re-run found A-11 and A-13**: 6 of 11 mobile dictation strings rendered by nothing, and the phone recorded with no cap. Both fixed |
| 9 | Tests — placement, fail-first, sabotage | ‼️ **UNDER-RUN on the first pass**: it checked the tests that EXISTED, never the tests §18.23 OWED. Re-run found A-8, A-9, A-10. 5 defects, 5 fixed |
| 10 | Deployment & infrastructure | ‼️ 1 blocker found by RUNNING it, fixed — and on the re-run, found UNTESTED (A-16). Now 7 tests, 3 sabotages |
| 11 | UI/UX against the approved mockup | ‼️ **NOT clean — re-run found A-13**: the mockup's "Nearly at the cap" state, and the cap itself, did not exist on mobile. Fixed |
| 12 | Did we miss anything the owner asked for | 4 carried, all recorded in three places |
| 13 | ‼️ **REUSED-SERVICE SEAMS** — the dimension P1 did not have | 1 defect found, fixed |

---

## 2. ‼️ THE DIMENSION P1 DID NOT HAVE — REUSED-SERVICE SEAMS

> *"For every pre-existing service this phase calls, enumerate every state it can return and prove each one
> is handled."* Added because its absence is exactly why P1 shipped the `TooBroad` bug (audit §12.2).

### 2.1 The seams P1.5 consumes, and what each can return

| Service | States | Handled? |
|---|---|---|
| `IProviderKnowledgeSearch` (multi-leg) | `Passages` · `None` · `Unavailable` **× partial/complete fan-out** | ✅ all six combinations, `ReusedServiceOutcomeTests` |
| `IProviderCatalogSearch` (per rendering) | `Matches` · `TooBroad` · `None` · `Unavailable`, **now merged across N legs** | ✅ every value named explicitly in `MergeCatalogLegs`; a fifth fails the theory |
| `IKnowledgeContentArtifactStore` | artifact · null · **artifact with zero blocks** | ✅ all three; the third is the one a naive null-check misses |
| `IBusinessAlphabetService` (new) | resolved · **unresolved** · empty-but-resolved | ✅ all three; "unresolved" never collapses into "Latin only" |
| `IAudioTranscriptionService` (new) | success · empty transcript · **429** · 4xx · 5xx | ✅ all five; 429 measured to be an everyday response |
| `MaterialExcerptBuilder` | items · **zero items** (empty body, or a budget too small for one line) | ✅ falls back to the raw chunk rather than dropping a real source |

### 2.2 ‼️ THE DEFECT THIS DIMENSION CAUGHT — in my own code, and it was the truthfulness class again

`SearchForProviderAsync`'s **all-legs-failed** return set `Outcome = Unavailable` and `LegsRequested`, but
**left `LegsSucceeded` at its record default of 1**. A search in which *every* leg failed reported one
successful leg. Nothing downstream could tell a total failure from a partial one.

- **Found by:** `EveryLegFailing_IsUnavailableAndNeverNothingFound`, written before the code was trusted.
- **Fixed:** the return now sets `LegsSucceeded = 0` explicitly.
- ‼️ **The lesson, again:** a record's *default* is a value the compiler will happily supply for a field you
  forgot. `LegsSucceeded = 1` was never written by anyone — it was the shape of the type answering for me.

---

## 3. CORRECTNESS & CONTRACTS

| # | Defect | Status |
|---|---|---|
| C-1 | ‼️ **The approved instruction wording scored 3/25.** §18.13's *"render the SAME question in each field"* made the model copy one **English** string into every field, and translate a Gujarati question **into English** first. Every non-Latin leg would have failed the script check, so a three-alphabet business would have paid for three searches, searched one alphabet, and hedged every answer as partial | **FIXED** — naming the act (*"TRANSLATED INTO {language} and written in the {language} script"*) measures **25/25 at 1, 2 and 3 fields**. The site carries a re-measure warning |
| C-2 | All-legs-failed reported `LegsSucceeded = 1` (§2.2) | **FIXED** |
| C-3 | A **narrowed** search that found nothing said *"your documents do not cover that"* — a false negative stated with confidence about the business's own material | **FIXED** — `PartialSearchFoundNothing` names what could not be searched and forbids the "nothing found" copy |
| C-4 | ‼️ **`TooBroad` across N legs has no honest total.** Per-leg counts OVERLAP, so quoting the largest as "the total" reproduces the exact defect P1 fixed | **FIXED** — `totalMatches` is emitted **only when one leg ran**; otherwise `TooManyMatchesUnknownTotal` tells the model to state no count at all |
| C-5 | A tool call with no usable rendering refused, costing the member a question for the model's mistake | **FIXED** — falls back to the member's own words; refuses only when there is also no question |
| C-6 | An excerpt the shared builder could not shape would have vanished from the answer | **FIXED** — falls back to the raw chunk; a real source never silently disappears |

---

## 4. TENANT ISOLATION & AUTHORIZATION

**Clean.** Every claim re-proved rather than assumed:

- ‼️ **Every query leg carries the tenant filter AND the audience allow-list** — proved **per leg, on the
  wire**, against a fake index over real HTTP (`EveryQueryLeg_CarriesTheTenantFilterAndTheAudienceAllowList`,
  3 legs ⇒ 3 requests, each asserted). Sabotage S5: removing the allow-list from the leg ⇒ **RED**.
- The legs share ONE filter construction by design: there is no code path that builds a leg's filter
  separately, so a future leg cannot forget the clause.
- **C1–C6 verified as still holding.** `/text` inherits `ResolveAsync` unchanged — the same canonical-id
  check, the same partition-scoped point read, the same audience rule — proved by the pre-existing audience
  tests, which now run against the new route.
- ‼️ **The strengthened guard:** `ForceLocale` is honoured only when it names a locale in the server's own
  `AllowedLocales`. A client-supplied string never reaches Azure.
- **Cosmos:** every read on this path stays partition-scoped. No cross-partition query (§0.6).
- **The removed `view-url` is not merely unused — the route, the DTO, the service method, the dial and
  `TransformToViewUrl` are all deleted**, and a reflection guard fails if any `ViewUrl`/`DownloadUrl` member
  reappears on `IBusinessSearchDocumentService`. Sabotage S6 (default interface member, so it compiled):
  **RED**.

---

## 5. DATA SAFETY & IDEMPOTENCY

| # | Finding | Status |
|---|---|---|
| D-1 | ‼️ **The `scripts` label had two possible authors** — the Functions ingest and the API FAQ path each building their own. That is the OCR page-cache drift class (audit §10 N1) waiting to happen in new code | **FIXED BY DESIGN** — the label is derived in exactly ONE place, `KnowledgeSearchIndexer.UpsertCardsAsync`, which every full-card write passes through. `MergeCardMetadataAsync` sends a partial document that never names `scripts`, so a metadata relabel leaves it intact |
| D-2 | The detector is deterministic and order-stable (most-used first, canonical tie-break), so a re-ingest of unchanged content produces a byte-identical label and the upsert stays idempotent | **VERIFIED** by test |
| D-3 | No backfill, per the owner: cards acquire `scripts` as they are ingested. Existing cards have **no** `scripts` value, so they are absent from the facet — which under-reports the alphabet set until re-ingest | **ACCEPTED RESIDUAL, named** — see §12 |

---

## 6. COST & PERFORMANCE

- ‼️ **The common case is unchanged.** A Latin-only business asking in English builds ONE required field and
  issues **exactly one** `SearchAsync` — pinned twice, at unit level and through the real HTTP endpoint.
- **The alphabet lookup costs the ask path ZERO** when warm — asserted by counting search calls, not by
  reasoning about it. Cold: two facets in ONE `Task.WhenAll`, `$top=0`, bounded at 250 ms, then proceeds one
  leg short rather than waiting.
- **Removed from every single ask:** the `IsSolo` roster read (a live SQL/Cosmos read nothing consumed).
- **Removed from every answer:** nothing — but the excerpt now runs `MaterialExcerptBuilder` per card, a pure
  in-process function over ≤ `RetrievalTopK` cards. No I/O added.
- **N legs cost ~1 leg of wall clock** (`Task.WhenAll`), and Azure AI Search Basic is flat-rate, so the fan-out
  adds no per-query search cost. Each leg does cost one embedding call — that is the real added spend, and it
  is bounded by `MaxQueryLegs` (3).
- ‼️ **Residual, named:** the embedding cost scales with leg count. A three-alphabet business pays 3×
  embedding per knowledge question. At `text-embedding-3-large` prices this is a fraction of a cent per
  question and far below the answer's own cost, but it is not zero and it is not hidden.

---

## 7. MEMORY, RESOURCE LEAKS & THREAD SAFETY

| # | Defect | Status |
|---|---|---|
| T-1 | `ConcurrentDictionary.GetOrAdd` may **invoke its factory more than once** under contention even though it stores one value — the alphabet single-flight would have issued duplicate facet pairs | **FIXED** — `Lazy<Task<T>>` with `ExecutionAndPublication`. Proved: 20 concurrent callers ⇒ **exactly 1** lookup |
| T-2 | A detached lookup (the caller timed out and walked away) could hold a task and its HTTP connection for the life of the process | **FIXED** — its own ceiling at 20× the caller budget |
| T-3 | A faulted detached lookup would have been an unobserved exception | **FIXED** — `WarmAsync` swallows and logs; `FacetAsync` catches everything and returns null |
| T-4 | The in-flight entry is removed **after** the cache write, so a later caller either reads the settled entry or starts fresh — never joins a task whose result was already discarded | **VERIFIED** |
| T-5 | Web: an unmounted component could set state from an in-flight transcription | **FIXED** — `mountedRef` guard; the recorder is cancelled on unmount |
| T-6 | Web: the recording timer could outlive the component | **FIXED** — cleared in the unmount effect and on every terminal path |

---

## 8. CONFIG HYGIENE

- **New dials, all mirrored:** `BusinessSearch:Scripts` (5), `BusinessSearch:Retrieval` (2),
  `AIAssistant:SpeechToText` (+7), `AzureSpeech:Endpoint`. The existing `BusinessSearchConventionTests`
  recurse into nested settings, so `Scripts` and `Retrieval` were covered with no test change — and passed.
- **New convention test** `DictationSettingsConventionTests` for the speech dials: every dial configured,
  every value equal to its class default, the API version pinned to the one MEASURED to work, and the
  allowed-locale list proved non-empty and covering all five shipped languages.
- **Orphan removed:** `BusinessSearch:DocumentViewSasMinutes` — deleted with the route it served.
- ‼️ **A drift class closed, not just an instance.** `Voice:Knowledge:Vision:TranscribePromptVersion` and
  `TranscribeDeploymentName` are now stamped onto **both** the API (the reader) and the Functions host (the
  writer) from ONE `$script:` variable in `deploy.ps1`, and **both appear in both hosts' required-settings
  manifests** — the writer's copy was the one never verified. The cache-miss log moved from `Debug` to
  `Information` and now names the two values, so a drift shows as a wall of misses instead of silence.
- ‼️ **A deliberate divergence from §18.16, stated:** the dictation dials live under
  `AIAssistant:SpeechToText`, not `BusinessSearch:Voice`. The route is a platform capability whose FIRST
  consumer is the provider mobile app's existing mic, not Business Search; a `BusinessSearch:` key governing
  the AI-assistant mic is precisely the cross-feature coupling the N1 drift is a standing warning about.

---

## 9. LOCALIZATION ×15

- **API ×5:** `BusinessSearch_Error_TextUnavailable`, `BusinessSearch_NoAccessToTopic`,
  `Error_SpeechNoCandidateLocales`, `Error_SpeechAudioTooLong`, `Error_InvalidLanguage` added to all five;
  `BusinessSearch_Error_FileUnavailable` **removed** from all five with the route it served;
  `BusinessSearch_Error_PageUnavailable` **re-worded** in all five, because "open the original file instead"
  became a lie the moment the file link was removed.
- **Web ×5:** 11 `Dictation.*` keys in all five files, inserted **in place** rather than by re-sorting, so
  the diff stays reviewable.
- **Mobile ×5:** the same 11 sentences as a `dictation` section, inserted at the **same position** in every
  file so the parity test sees identical key order. `localeParity` + `sourceLocalizationIntegrity`: **30
  tests green**.
- **Nothing user-facing is hardcoded.** Model-facing tool notes stay English constants, as the codebase
  requires — a translated instruction is a broken instruction.
- ‼️ **One deliberate non-localized string:** the stored `[[partial-answer]]` marker. It is machine-readable
  on purpose — the model reads it back on the next turn and the client strips it. A localized marker could
  not be matched reliably, and prose could be mistaken for the business's own words.

---

## 10. WEB / MOBILE PARITY

Parity means matching RENDERING RULES, not same-named components:

| Rule | Web | Mobile |
|---|---|---|
| Transcript never auto-sent | ✅ hook exposes no send; asserted by test | ✅ `onTranscribed` hands text back |
| Correction chip only AFTER a transcript | ✅ | ✅ |
| Chip options come from the SERVER's candidate list | ✅ | ✅ |
| Chip re-sends the SAME recording | ✅ asserted (`startWavRecording` called once) | ✅ file path kept |
| Language shown in its OWN script | ✅ | ✅ same table |
| Brand green fills the selected chip | ✅ | ✅ `#97EF29` |
| No cap is a client constant | ✅ delivered via AppConfig | ✅ same source |
| Mic NOT RENDERED when unsupported | ✅ (web-only state) | n/a — the OS always has a mic |

‼️ **One asymmetry, deliberate and stated:** the web hook carries `Offline` and `Unsupported` states the
mobile hook does not. On mobile the OS owns both, and a React Native app cannot lack an `AudioContext`.

---

## 11. TESTS

- **Placement (§0.18):** every new test is in `Clinqet.API.UnitTests` / `.IntegrationTests`. `TextScriptDetector`
  and `SpeechCandidateLocales` live in `clinqetcore` but the host whose runtime path drives them is the API
  (it labels on the write side through the indexer and picks the legs on the read side). **No MCP or Functions
  test was added or edited.**
- **§0.17:** no test reads outside its own repository. The cross-repo half of the page-cache guard is held by
  `deploy.ps1`, and the test says so rather than pretending to cover it.
- ‼️ **A FIXTURE THAT WAS LYING — the §12.2 lesson, live.** `SearchReturning(...)` stubbed only the
  single-query overload. The moment the tool moved to the multi-query one, Moq returned a **null task**, the
  base class caught the NRE, and **every knowledge test silently became the "temporarily unavailable" path**
  while still passing its own assertions. Fixed by stubbing both overloads. *A suite built from the same
  mental model as the implementation inherits its blind spots.*
- ‼️ **A CAPTURE THAT WAS LOSING DATA.** The fake index's request list was a plain `List<string>` appended
  from N concurrent legs; it lost 2 of 3 and the assertion read as a missing leg rather than a broken
  capture. Now a `ConcurrentBag`.

### 11.1 Sabotage — every guard proved RED

| # | Sabotage | Result |
|---|---|---|
| S1 | Gurmukhi range starts one code point too high | **RED** (3 failed) |
| S2 | The wrong-script rendering is searched instead of dropped | **RED** |
| S3 | A partial fan-out is handed over silently | **RED** (3 failed) |
| S4 | The alphabet cache is written with no `Size` | **RED** |
| S5 | A query leg skips the audience allow-list | **RED** |
| S6 | A `ViewUrl` member reappears on the document service | **RED** ‼️ |
| S7 | The retry deadline is widened past the caller's own timeout | **RED** (1 failed) |
| S8 | An empty candidate list is allowed through to Azure | **RED** (1 failed) |
| S9 | The candidate-locale fallback is removed | ‼️ **GREEN — THE GUARD WAS BLIND** (see §14A A-4) |
| S9b | The forbidden-locale fallback is re-introduced | **RED** (1 failed, 9 passed) |
| S10 | The concurrency shim also retries a TIMEOUT | **GREEN — a refutation probe, not a guard** |
| M1 | The mobile hook grows a member that could send the transcript | **RED** |
| M2 | The transcript is run through text enhancement before the member sees it | **RED** |
| M3 | The mic button submits the question itself | **RED** |
| M4 | Silence is reported as a failure again, breaking web parity | **RED** |
| M5 | The correction chips fall back to a locale list the app keeps itself | **RED** |
| P1 | The audio size cap is dropped | **RED** |
| P2 | A `ForceLocale` outside the allow-list is silently accepted | **RED** |
| P3 | The correction chip no longer narrows the list to the locale it named | **RED** |
| P4 | The unsupported-format check is removed | **RED** |
| O5a | The ACCESS block is dropped, so a withheld topic reads as "nothing found" | **RED** ‼️ |
| O5b | Every member is told of a restriction, including those who have none | **RED** ‼️ |
| Q1 | A state ships copy in five languages that nothing renders | **RED** |
| Q2 | The mobile hook drops a state web distinguishes | **RED** |
| Q3 | Offline is discovered at upload, after the member has spoken | **RED** |
| Q4 | Silence offers Try again, re-sending the same silence | **RED** |
| Q5 | The phone records past the cap the server published | **RED** |
| Q6 | The cap becomes a client constant again | **RED** |
| R1 | `prepare` loses its permission attribute | **RED** |
| R2 | `prepare` stops requiring a business context | **GREEN — an UNREACHABLE branch, not a blind guard** |
| T1 | Nothing is preserved, so removing a model field destroys the deploy | **RED** ‼️ |
| T2 | Field-name comparison turns case-SENSITIVE | **RED** |
| T3 | Only the FIRST dropped field is preserved | **RED** |
| U1 | The audio cap drifts from appsettings again | **RED** |
| U2 | The cap drops below a full-length recording | **RED** |

‼️ **R2 is worth its own line: GREEN, and correctly so.** `[RequiresPermission(…, Business)]` refuses a
context-less token before the action runs, so `prepare`'s own null-check is defence in depth **no HTTP
request can reach**. Sabotaging it changes nothing observable. The test was renamed to say what it
actually proves (the filter returns 403), rather than leaving a name that claims to cover a line it cannot.

> Same shape as S9 — an unreachable branch — but the opposite verdict: there the unreachable branch was
> WRONG and had to go; here it is harmless depth behind a guard that does work. **Finding the branch
> unreachable is the start of the question, not the answer.**
‼️ **O5a first reported STILL GREEN, and that was an INCREMENTAL BUILD reporting a stale binary** — the same
trap this programme recorded in P1 and hit again here. `dotnet build` considered the project up to date while
a peer session held the infrastructure DLL, so `--no-build` ran the UNSABOTAGED agent. Re-run with
`--no-incremental`, both came back **RED**.

> Three times in one session a green sabotage turned out to be the harness, not the guard: S9 (no input could
> reach the branch), M1–M5 (the harness could not observe failure), O5a (a stale binary). **Treat every green
> sabotage as a question about the measurement first.**
‼️ **M1–M5 came back GREEN on their first run — and that was the HARNESS, not the guards.** `jest -t`
prints `Tests: 1 failed, 4 skipped` with **no "passed" at all** when the only matching test fails, so a
summary-line regex requiring "passed" matched nothing and defaulted to green for all five. **Five identical
results is the tell** — independent guards do not fail identically. Re-keyed on the process **exit status**,
and gated on the filter having matched exactly one test, every one came back RED.

> The sabotage harness needed sabotaging. That is the same shape as S9 one layer up: **a check that cannot
> observe failure reports success**, and it will do so for every input you give it.
‼️ **The first S7–S10 batch reported BUILD FAILED on all four and therefore proved NOTHING** — a real
result, because the harness gates on the build before trusting a test outcome, but not the one being
looked for. The cause was almost certainly locks left by the killed S7 run below; the tree built clean
immediately afterwards. Re-run with a per-sabotage timeout and the build output captured to disk, which
is how S9's blindness became visible at all.
‼️ **S7 was also run twice, for a different reason — and it is the more interesting one.** The first
version of the sabotage replaced the retry deadline with `TimeSpan.FromHours(1)`. That broke the guard, but
it ALSO removed the only thing bounding the sabotaged test: its own exponential backoff (500 ms doubling,
20 attempts) reaches roughly **73 hours**. The run did not fail — it **hung**, and had to be killed and the
file restored from its scratchpad snapshot by hand.

> **The lesson: a sabotage must break the GUARD without removing the bound on its own run.** A sabotage
> that hangs is indistinguishable from a sabotage still running, and the temptation at that point is to
> declare it RED without evidence. Re-run with the deadline widened to 120 s rather than removed — enough
> to break the 6 s budget the test asserts, not enough to hang. ‼️ It also means the harness needs a
> per-sabotage timeout, which this one did not have.
‼️ **S6 was run TWICE.** The first attempt added an unimplemented interface member and the **build failed** —
which is a legitimate compile-time result but proves nothing about the runtime guard, and would have reported
green against a stale binary had the harness not gated on the build. Re-run as a **default interface member**
so it compiled: **RED**. Every sabotage in this run gates on the build result before trusting a test outcome.

---

## 12. DEPLOYMENT & INFRASTRUCTURE

### 12.1 ‼️ THE BLOCKER THAT ONLY RUNNING IT COULD FIND

`PLAN` §18.19 requires two things that are **mutually exclusive as written**:

- step 5: *delete the `language` property from `KnowledgeSearchDocument`* (**mandatory**);
- step 1: *add `scripts` to both indexes and run `cosmosindexsetup` in both regions*.

With `language` gone from the model, Azure rejects the whole update:

```
OperationNotAllowed — Existing field(s) 'language' cannot be deleted.
```

**The additive field cannot be deployed, in either region, by anyone** — the owner included. §18.19's
assurance that *"P1.5 is complete and shippable without the knowledge index ever being recreated"* was false
until this was fixed.

**Fixed** in `KnowledgeSearchIndexInitializer.PreserveLiveOnlyFieldsAsync`: the update now reads the live
index and carries forward any field the model no longer declares, making `CreateOrUpdateIndex` **additive
only**. Consequences, all good:

- `scripts` deployed to **both regions today**;
- `language` remains in the live knowledge index, unwritten — exactly what §18.19 says is expected — and
  disappears when the owner recreates the index;
- ‼️ a future field removal can never again block a deploy;
- ‼️ the **customer-facing services index can never be silently shrunk** by an index update.

### 12.2 Verified against the ENGINE, not the tool's success message

| Region | Index | Docs | `scripts` | `language` |
|---|---|---|---|---|
| CA | `clinket-knowledge-dev-v1` | 744 | `Collection(Edm.String)` filterable+facetable | present, unwritten |
| CA | `clinket-dev-v1` (customer-facing) | 821 | same | absent |
| IN | `clinket-knowledge-dev-v1` | 99 | same | present, unwritten |
| IN | `clinket-dev-v1` (customer-facing) | 126 | same | absent |

**No document was lost in either region.** `--search-only` was used, so no Cosmos container init and no
sample-data seeding ran.

### 12.3 `deploy.ps1`

Parses with **0 errors**. Added: `AzureSpeech__Endpoint` on all four host blocks (beside the existing
`Region`), stamped from the account's real `properties.endpoint`; `Voice__Knowledge__Vision__TranscribePromptVersion`
on the API and the Functions host from one source; three new required-settings entries. ARM is correctly
untouched — this phase adds no Azure resource and no `local.settings.json` key.

‼️ **A mistake I made and corrected, recorded because a silent fix is indistinguishable from no mistake:** a
regex meant to add the endpoint line consumed `$locationSlug` from the four `AzureSpeech__Region` stamps,
leaving `= $`. Caught by parse-checking the file (156 errors), restored, re-parsed clean. **This is why the
file is parsed after every edit and not merely eyeballed.**

---

## 13. UI/UX AGAINST THE APPROVED MOCKUP

Mockup `C:\Nik\Data\mockups\business-search-voice\index.html`, **owner-approved 2026-09-03**. Every state built
as drawn: idle · listening with elapsed against the **server-published** cap · near-cap amber · transcribing ·
transcript ready and editable · correcting · nothing heard · microphone blocked · voice unavailable with the
recording KEPT for Try again · recording too long · browser can't record (mic not rendered at all) · offline.

The chip rules from §03 of the mockup are all honoured, including the two that are easy to get wrong: it is
**never pre-opened on low confidence**, and it **does not change the answer language**.

---

## 14. DID WE MISS ANYTHING THE OWNER ASKED FOR

### 14.1 Every P1 audit item, closed

| Item | Status |
|---|---|
| O1 replayed prose · O6 solo→first hire · §8 committed secrets | Closed by the owner — no action, correctly none taken |
| **O2** shared excerpt renderer | ✅ FIXED |
| **O3** no download link, "Show text" | ✅ FIXED |
| **O5** refusal ≠ "nothing found" | ✅ FIXED — ‼️ and now PROVED. It shipped pinned by nothing (§14A A-10); two agent tests were added this session |
| **O7** SAS not revocable | ✅ DISSOLVED — no URL is minted at all |
| **O8** `Voice:Catalog` divergence | ✅ **RE-VERIFIED, not redone** — 18 keys present; §13.1's rulings hold exactly (`CosmosFallbackMaxScan` 200, `IndexCoverageMinRatio` 0.9, `LookupSlowWarnMs` 1500, `LookupTooBroadThreshold` 25) |
| **O9** service index unused | ⚠️ **NOT MEASURED.** The dial ships, default unchanged. Carried to `CARRIED-TO-P3.md` §3 rather than implied to have been considered |
| §7 `tokensUsed: 0` | ✅ FIXED, integration-tested |
| §7 partial answer stored unmarked | ✅ FIXED, integration-tested |
| §7 `: ping` untested | ✅ FIXED |
| §7 no end-to-end SSE round trip | ✅ FIXED — scripted model client in the factory |
| §7 `IsSolo` read but unused | ✅ FIXED — removed rather than pinned to a constant |
| §7 F-1 flaky counter test | ✅ FIXED — retried only on statuses meaning **definitively not applied** (429/503), never on a timeout, assertion still `Equal(20)` so neither a lost update nor a double-count can hide |
| §10 N1 page-cache key drift | ✅ FIXED |
| §12 truthfulness class | ✅ CARRIED FORWARD and applied to every new seam |

### 14.2 ‼️ CARRIED, NOT DROPPED — recorded in THREE places

`CARRIED-TO-P3.md` (written mid-phase, not at the end), the P1.5 DELTA in `PHASE-2-PROMPT.md`, and here:

1. **`search_call_followups` + `search_refund_requests`** — the owner's *"must and super important"* (O4).
   P3, because Group B's machinery does not exist and refunds touch money (§0.8 integration tests).
2. **`relativeRange` + member-name resolution** (§18.15). P1.5 built the half with a consumer — the guard
   that structured tools carry **no** rendering fields — and carried the resolvers rather than shipping code
   nothing calls.
3. **`IsSolo`** returns with the first tool that narrows by member.
4. **O9** measurement.

---

## 14A. ‼️ DEFECTS THE SELF-AUDIT FOUND IN MY OWN NEW CODE, AFTER IT WAS ALREADY GREEN

> These were not caught by writing the code, nor by the first green run. They were caught by re-reading it
> as an auditor, and two of the three were then caught AGAIN by the test written for the fix — which is the
> point of writing the test rather than declaring the fix done.

| # | Defect | How it would have shown up | Status |
|---|---|---|---|
| A-1 | `AzureFastTranscriptionService.BaseAddress()` had **no caller** — the named HttpClient's base address is set in `Program.cs` from the same two settings, so this was a second copy of the same rule with nothing consuming it | Silent §22.2 dead code, and worse: a second place a future editor could "fix" the endpoint without changing what the client actually uses | **FIXED** — deleted |
| A-2 | ‼️ **The retry budget could outlive the caller.** `RequestTimeoutSeconds` bounded ONE HTTP request; with `MaxRetryAttempts` the total was (attempts+1) requests **plus** the backoff between them. Measured, a 429 arrives only after Azure has held the connection **10.7 s**, so three attempts could exceed the mobile client's own 60 s ceiling | The client abandons the request while the server is still paying for it, and the member sees a hang rather than a message | **FIXED** — ONE deadline across every attempt, answering with the timeout copy |
| A-3 | ‼️ **The fix for A-2 had a hole, and its own test found it.** The backoff `Task.Delay` sat OUTSIDE the `try`, so a deadline firing during the delay threw a raw `TaskCanceledException` straight past the handler | The controller renders a **500** where the member should read "voice timed out" | **FIXED** — the backoff is inside the `try`, on both paths |
| A-4 | ‼️ **The never-empty fallback WAS the failure it existed to prevent.** When a deployment's `AllowedLocales` excludes every candidate the plan produced, `SpeechCandidateLocales.Build` substituted `en-US` — a locale that same config had explicitly forbidden | A Gujarati speaker gets romanized English **and cannot correct it**: the correction chip's `ForceLocale` is validated against the same allow-list. Precisely the live-measured failure (§16) the invariant was written to prevent | **FIXED** — returns empty; the service already refuses an empty list loudly and localized (S8), so the misconfiguration surfaces instead of being papered over |
| A-5 | ‼️ **`ALocaleOutsideTheAllowList_IsFilteredOut` never tested filtering.** Its allow-list `["en-US"]` excluded EVERY locale the plan produced for a Gujarati/IN provider (`gu-IN`, `hi-IN`, `en-IN`), so the `["en-US"]` it asserted came entirely from the fallback | The one test named for the allow-list was pinning the substitution instead — so removing the fallback (the A-4 fix) is what made it fail, which is how it was found | **FIXED** — allow-list `["en-IN","hi-IN"]`, asserting `gu-IN` is dropped **despite being both the member's language and their content's script**, and that survivors keep plan order |
| A-6 | ‼️ **The catalogue leg of the alphabet set was tuned for the wrong text.** `ServiceSearchDocument.Scripts` IS populated (name + description), but with the detector's DEFAULT thresholds — hardcoded by omission while the knowledge path reads config — and the 12-character floor is calibrated for document CHUNKS | `"Facial ફેશિયલ"` carries 6 Gujarati characters at 46% share and labels as **`Latn`**. A business with no documents but a Gujarati catalogue is invisible to the alphabet set — the exact case PLAN §18 added the services field for | **FIXED** — new `BusinessSearch:Scripts:CatalogMinCharacters` (4) on both hosts that register the indexer, read from config like the knowledge path, with tests pinning BOTH that the short name is now seen and that one stray character still is not |
| A-7 | ‼️ **Two pieces of documentation asserted guarantees that did not exist.** `BusinessSearchSettings` said the thresholds were *"stamped from ONE source in deploy.ps1 and pinned by a convention test"* — there was no stamp and no test. The SKILL said `scripts` is *"derived in exactly ONE place, so writer and reader can never disagree"* — it is derived in **two**, one per index | A future session reads "pinned by a convention test", believes the drift is caught, and changes a threshold in one host. The comment was doing the job of a guard while no guard existed | **FIXED** — `ScriptThresholdsAgreeAcrossHostsTests` now genuinely pins both hosts against each other and against the class defaults (skipping loudly when the peer repo is absent, §0.15/§0.17); the deploy.ps1 claim is dropped because these dials are identical in every environment; the SKILL corrected in all four copies |
| A-8 | ‼️ **The mobile half of "the mic never auto-sends" did not exist.** PLAN §18.23 owes that guard on **web AND mobile jest**. Web had it from the first commit; `clinqetmobilepartnerapp` had **no test of the dictation hook at all** | The rule that speech only ever FILLS a field was enforced on one platform and merely intended on the other. Nothing would have failed if a later session wired the transcript straight into a send | **FIXED** — `__tests__/dictationNeverSends.test.ts`, 5 guards, all five sabotage-proved RED (M1–M5). The repo has no renderHook, so it is a source scan, and every assertion first proves it READ the file |
| A-9 | ‼️ **`POST speech/transcribe` had no controller test whatsoever.** The service was well covered; the CONTROLLER — where §18.23's "oversized audio refused with **localized** copy" and "unsupported locale **refused, not defaulted**" actually live — had nothing | Two named plan requirements were unproven, and the correction chip's narrowing (`locales = [forced]`) — the only recovery a Punjabi speaker has — was asserted nowhere | **FIXED** — `SpeechControllerIntegrationTests`, 7 tests through the real pipeline, plus a `RecordingAudioTranscriptionService` so the candidate list the controller BUILDS is observable rather than inferred |
| A-10 | ‼️ **Audit O5 was FIXED in code and pinned by nothing.** The ACCESS block that names a withheld topic and dictates the exact refusal sentence lives in `BusinessSearchAgent`, localized in all five files — and no test asserted it was in the system prompt, or that an unrestricted member is told of no restriction | §14.1 recorded O5 as "✅ FIXED" on the strength of the code existing. Delete the block and every suite stays green while a technician asking about offers is told their own business has no such information | **FIXED** — two agent tests: a restricted role gets `ACCESS` + `do NOT say nothing was found` + the refusal key; an owner gets neither, so the model can never invent a restriction |
| A-11 | ‼️ **Mobile shipped 6 of its 11 dictation strings translated into five languages and rendered by NOTHING.** `offline`, `tooLong`, `tryAgain`, `unavailable`, `listening` and `transcribing` existed as copy; the phone showed a bare spinner. The approved mockup's mobile section is titled *"the same states, the same rules"* | A member recording on a dropped connection was told to check microphone permissions; an oversize clip read as a broken service; a service blink cost them saying it again, with the recording already held. Dimension 8 had been marked **clean** | **FIXED** — the hook now carries web's exact state machine (`DictationState`), refuses to record while offline via NetInfo, distinguishes 413 as too-long, and exposes `retry`; the button renders the strip and Try again. Four new guards, Q1–Q4 all sabotage-proved RED |
| A-12 | `Error_SpeechConversionFailed` was left behind in all five API language files by the Fast Transcription migration — defined, translated, read by nobody | §4/§22.11: an orphan key is a claim that a code path exists. The next person to touch speech copy would have maintained a string for a path that was deleted | **FIXED** — removed from all five files, each re-validated as JSON (3,150 keys, identical across languages) |
| A-13 | ‼️ **The phone recorded with NO CAP AT ALL.** `useSpeechToText()` took no arguments: no `maxRecordingSeconds`, no auto-stop, no near-cap warning. Mobile's `AppRuntimeConfig` had no `dictation` block, so the cap the server publishes could not even be read. Web has stopped itself at the server's number since day one | A member speaks for two minutes and is refused with a 413 **after** finishing — the exact failure the delivered-cap design exists to prevent, and the mockup rule *"No number is hardcoded in a client"* inverted into "no number at all" | **FIXED** — `dictation` added to `AppRuntimeConfig` + provider + a fail-safe mapper (a conservative 4 MB / 60 s floor until a read resolves); the hook stops itself at the cap; the button reads it from `useAppConfig()` and renders `elapsed / cap` plus the mockup's near-cap state. Q5, Q6 sabotage-proved |
| A-14 | **`POST prepare` — a brand-new endpoint — had no test of any kind.** Its siblings (`ask`, `pages`, `text`, `sessions`) are covered several ways each | It answers 204 and the client deliberately never waits on it, so a route that silently 403s or 404s is INDISTINGUISHABLE from one working. The only symptom would be every ask quietly paying for a cold alphabet lookup — a cost regression with no error anywhere | **FIXED** — four integration tests: 204 for a member, refused without a business context, refused unauthenticated, refused for billing-only |
| A-15 | **`KnowledgeExtractRenderer` — what "Show text" opens — had no tests at all**, including its `truncated` flag | ‼️ The flag IS the truthfulness class, aimed at a person rather than a model: without it a cut extract is presented as the whole document. Unguarded too: a pipe inside a cell forges a column and shifts every value after it under the wrong heading; a newline ends the row early | **FIXED** — 19 tests: block-boundary truncation, the flag in both directions, a non-positive budget, pipe escaping, newline flattening, ragged-row padding, heading clamping, empty/blank blocks, null-throws |
| A-16 | ‼️ **`PreserveLiveOnlyFieldsAsync` — the fix for the §12.1 DEPLOY BLOCKER — had no test**, and was private, so it could not have one | It is the rule deciding whether a deploy ADDS a field or destroys one. A regression re-breaks exactly what already broke once this phase: `OperationNotAllowed: Existing field(s) cannot be deleted`, taking the additive fields down with it. Silent until a deploy fails in both regions | **FIXED** — the merge split from the fetch as `internal static PreserveLiveOnlyFields(index, live)` (I/O and 404 handling stay put), 7 tests, T1–T3 sabotage-proved RED |
| A-17 | **Nothing asserted that AppConfig actually SERVES the `dictation` block** — the single wire both apps read the mic's caps from | The settings were pinned and the clients were pinned; the delivery between them was not. Drop the block and both apps fall back to their own conservative floors, drift apart, and report no error anywhere | **FIXED** — an integration test on the live endpoint asserting the caps are positive and the format list is non-empty and contains `wav` |
| A-18 | ‼️ **The audio cap's class default had drifted to 2.5× the shipped value** — `MaxAudioSizeBytes` is `4194304` in appsettings and was `10485760` on `AIAssistantSettings`. It sits on `AIAssistant`, one level ABOVE the `SpeechToText` block my convention test scanned, which is how it stayed invisible | `Clinqet.Communications` binds `AIAssistant` and configures **no cap**, so the Functions host silently took the 10 MB default. And this is the number BOTH clients now record against, published as `dictation.maxAudioBytes` — the P2 prompt quoted 10 MB from the class default rather than the 4 MB that ships | **FIXED** — default set to `4194304`; two convention tests added (mirrors-appsettings, and fits a full-length 60 s / 16 kHz mono recording at ~1.9 MB); U1, U2 sabotage-proved. The P2 prompt corrected |
‼️ **A-3 is the one worth remembering.** The fix for A-2 was written, reviewed and looked right. It was the
test — written to prove the fix rather than to describe it — that exposed the escape path. *A fix is not
done when it is written; it is done when something has tried to break it.*

‼️ **A-18 was found by re-reading the prompt I had already handed the owner**, not by re-reading the code.
The P2 delta quoted `"maxAudioBytes": 10485760` as the value clients would receive; checking that one
number against what the endpoint actually serves exposed a 2.5× drift, a Functions host silently running
on the wider cap, and a convention test whose scan started one level too deep.

> **A settings drift hides at the boundary of whatever the guard scans.** `DictationSettingsConventionTests`
> pinned every dial inside `AIAssistant:SpeechToText` and was correct about all of them; the key that
> mattered was the sibling one level up. A convention test's SCOPE is as much a design decision as its
> assertions, and nothing inside it can tell you the scope is wrong.
‼️ **A-16 is the one that should not have needed finding.** §12.1 records `PreserveLiveOnlyFieldsAsync` as
"‼️ THE BLOCKER THAT ONLY RUNNING IT COULD FIND" — the single most consequential line written this phase —
and it shipped with no test, because it was `private` and testing it looked awkward. **"Hard to test" is
a property of the shape, not of the code**: splitting four lines of merge from the fetch made it provable
in minutes, and the case-insensitivity rule (T2) is one nobody would have written down without a test
forcing the question.

> Both A-15 and A-16 were found by listing what P1.5 ADDED and asking of each one "where is its test",
> rather than reading the test folder and asking "does this look thorough". The first question is
> answerable; the second always feels answered.
‼️ **A-14's billing-only test reported a SECURITY GAP that did not exist, on its first run.** It set
`businessAccess: BillingOnly` on the token only. The snapshot — which is the actual authority — stayed at
`Full`, the request was allowed, and the failure read exactly like "a suspended business can warm the
index". The neighbouring test already carried a comment saying precisely this, and I wrote the new one
without reading it.

> **A red test is a claim that needs verifying just as much as a green one.** The reflex on red is to fix
> the code; here that would have meant adding a guard to defend against nothing, and the real guard
> (`businessStatus: Suspended` driving the snapshot) would have stayed untested.
‼️ **A-13 was found by checking dimension 11 (UI/UX vs the approved mockup) the way A-11 forced me to** —
state by state against the drawing, rather than "does the screen look like the picture". The mockup names
**"Nearly at the cap"** as a state. Web had it. Mobile had neither the state, nor the cap, nor a way to
read the cap. Dimension 11 had been marked **clean**.

> Three dimensions marked clean on the first pass (8, 9, 11) were not. All three failed the same way: they
> checked that what EXISTS is correct, and never asked what is MISSING. A parity check that only compares
> the things both sides have can never find the thing one side lacks.
‼️ **A-11 is the most uncomfortable finding in this audit, because dimension 8 (web/mobile parity) had
been marked CLEAN.** It was checked the way parity is usually checked — same component, same keys, same
analytics verbs — and all three were true. **What was never checked is whether the keys were RENDERED.**
Five languages of copy for six states, and a `grep` for each key against the source would have found it in
seconds. It is now a permanent guard: every key in the `dictation` catalogue must be referenced by code.

> The owner's rule says parity means matching the **rendering rules**, not shipping a same-named component.
> This is exactly the failure that rule was written about, and I still had to be shown it by a key count.
‼️ **A-10 is the sharpest version of the lesson in this whole section: "fixed" and "proved" are different
claims, and this audit had been conflating them.** O5, A-8 and A-9 were all recorded as done because the
CODE was there. Three of them, found in one pass, by asking of each closed item not *"did I write it"* but
**"what fails if someone deletes it"**. Where the answer was "nothing", the item was not actually closed.

‼️ **METHODOLOGY — never run two suites at once on this machine.** Concurrent runs produced, in one
session: four sabotages reporting `BUILD FAILED` that proved nothing; an `MSB3030 could not copy` whose
`--no-build` test then reported **27 passing tests from a stale binary**; `Clinqet.Mcp.UnitTests` reporting
**2 build errors** that vanished on a clean rebuild; and a mobile jest run failing **1 suite, then 6**, every
one a 35–50 s timeout under CPU starvation, none related to the change. **Every one of those looked like a
defect and was an artefact.** Sequential, build-gated runs only — and treat a varying failure count as
evidence about the RUN, not about the code.
‼️ **A-8 and A-9 were found by re-reading §18.23 line by line against the tree, not by re-reading my own
notes.** Both items were listed in the plan, both were believed done, and neither existed. The session
summary said "mobile jest 3,434 green" — which was true and told me nothing, because the number counts
tests that exist, never tests that are owed. **A coverage claim has to be checked against the list of what
was promised, not against a passing run.**

‼️ **And the first mobile sabotage batch reported all five guards BLIND — a defect in the HARNESS, not the
guards.** `jest -t` prints `Tests: 1 failed, 4 skipped` with **no "passed" at all** when the only matching
test fails, so a summary-line regex requiring "passed" matched nothing and defaulted to green. Five
identical results is the tell: independent guards do not fail identically. Re-keyed on the **exit status**,
plus an assertion that the filter matched exactly one test, all five came back **RED**.

> This is the same shape as S9 one layer up: **a check that cannot observe failure reports success.** It is
> worth stating that the sabotage harness needed sabotaging.

‼️ **Platform fact worth keeping:** a request with no `User-Agent` is refused **400 by middleware before
authentication runs**. An unauthenticated-access test that omits the header asserts 401 against a request
that never reached auth — it would pass today for the wrong reason and keep passing if `[Authorize]` were
removed. Pinned in a comment on the test.
‼️ **A-7 is the truthfulness class pointed at our own documentation.** Every other finding in this audit is
about a payload telling a member something untrue. This one is a comment telling the NEXT ENGINEER
something untrue — and it is worse, because a wrong payload gets noticed and a wrong comment gets trusted.
**A comment that claims a guard exists must be deleted or made true in the same change.** Both were made
true here; neither was found by reading the code, only by going to look for the guard it named.
‼️ **A-6 came from doubting a grep, not from reading the plan again.** A search for `.Scriptss*=` found
no writer for the services index and suggested the field was dead. It was not — the write is an object
initializer, which that pattern cannot match. **Checking the code instead of believing the grep** is what
turned a phantom "nothing populates it" into the real defect sitting one line away: it was populated with
the wrong thresholds. A regex that finds nothing is evidence about the regex first.

‼️ **And a build that FAILED still reported 27 passing tests.** Running a filtered unit build while the
integration suite held `Clinqet.Core.dll` produced `MSB3030 could not copy`, after which `--no-build` ran
the STALE binary and reported green. This is the same trap recorded for the earlier sabotage batch, and it
is now reproduced deliberately: **never trust a test result whose build you did not check, and never run
two suites over the same projects at once.** Every closing number below comes from a gated, sequential run.
‼️ **A-4 and A-5 are the same defect wearing two hats, and neither was visible from the code.** A branch
no test could reach, and a test whose name described one behaviour while its input exercised another —
together they made a wrong fallback look deliberately covered. The sabotage found the first; **fixing the
first is what surfaced the second**, because the only test that broke was the one silently depending on it.

> Worth stating plainly: **9 of the 10 assertions in that class were green for the right reason, and the
> class still hid a live defect.** A suite's pass rate says nothing about whether its inputs reach the
> branches its names claim.
‼️ **A-4 was found by S9 coming back GREEN.** The sabotage removed the fallback and the guard did not
notice — because every case in the "never empty" theory was rescued by `en-US` being in the allow-list, so
not one of them ever reached the fallback line. **A guard that cannot reach the branch it names is not a
weak guard, it is no guard**, and it had been sitting green through the whole build. Chasing *why* it was
blind is what exposed that the branch was wrong as well as untested.

> The re-run **S9b inverts the sabotage** — re-introducing the fallback — and goes **RED on the new edge
> guard while the nine ordinary-input assertions stay green**. That shape matters: it proves the guard
> DISCRIMINATES, rather than being a test that fails at anything.

A-2 and A-3 are sabotage-proved by S7 and S8.

‼️ **S10 is recorded as a REFUTATION PROBE, not a guard.** Widening the concurrency shim to retry a
TIMEOUT stays **GREEN**, because no test at that seam can distinguish a legitimate retry from a
double-count. It is recorded so this audit does not claim a guard that does not exist — the protection
there is the deliberately narrow status list (429/503 only, never a timeout) plus the `Equal(20)`
assertion, not a test that fails when the list widens.
---

## 15. ACCEPTED RESIDUALS — named, not buried

| # | Residual | Why it is accepted |
|---|---|---|
| R-1 | ‼️ **Existing cards have no `scripts` value.** No backfill (owner-confirmed, pre-prod), so the alphabet set under-reports until a document is re-ingested | Self-healing on the next ingest. The failure mode is a MISSING leg, never a wrong one: the asked script is always searched, so a member asking in their own alphabet always reaches their own documents |
| R-2 | ‼️ **An ingest completing in the Functions host cannot invalidate the API's in-memory alphabet cache.** API-side mutations invalidate; a Functions-side completion does not | Bounded and one-sided: for up to `CacheMinutes` (30) an **English** question may miss a business's FIRST non-Latin document. A question in that document's own script reaches it immediately, because the asked script is always a leg |
| R-3 | ‼️ **Punjabi is not safe on language identification.** Measured: Gurmukhi speech identified as `hi-IN` and written in **Devanagari**, even with `pa-IN` in the candidate list | The correction chip is the recovery, and it is built on both platforms. Named in the mockup as the reason the chip is not optional |
| R-4 | Only **8 scripts** are detectable (the §18.11 table). Kannada, Malayalam, Odia content labels as `Latn` | Identical to today's behaviour — no regression. Adding a block is a one-line change with **no** schema impact |
| R-5 | Gate 3's accuracy is an **upper bound**: the audio was Azure TTS, which is cleaner than a provider in a workshop | Direction and language-ID behaviour are what it proves, and both are one-sided |
| R-6 | ‼️ **Gate 5 is UNMET.** §18.8 cannot be re-measured against production content because **no provider has uploaded a single non-Latin document** (CA 744 cards, IN 99, all `Latn`) | Recorded as unmet rather than approximated. The seeded live test (§16) is the strongest available substitute |
| R-7 | The `[[partial-answer]]` marker is visible if a client forgets to strip it | Deliberately not prose: an unstripped marker reads as an obvious marker, never as a lie in the business's own words. Documented in the delta |
| R-8 | The web dictation component has **no consumer until P2** builds the ask box | Owner-approved (2026-09-02). It is tested and complete; the delta tells P2 exactly how to mount it |

---

## 16. ‼️ THE LIVE PROOF — seeded, measured, cleaned up

Because production content is entirely Latin, twelve cards across four documents — **each fact written ONCE,
in ONE alphabet** — were seeded under a marked test business on the **real Canada dev knowledge index**, with
real `text-embedding-3-large` vectors, the real `knowledgeRelevance` scoring profile, the real synonym map and
the real analyzers. Every write and query was filtered to that id; **the 744 real cards were never touched.**

**The alphabet-set lookup, on the live index:** `["Latn:6","Deva:3","Gujr:3"]` — the exact facet the ask path
warms, answering correctly on the real schema.

**Cross-script retrieval, by RANK of the answering document:**

| case | 1 leg (today) | all legs (P1.5) |
|---|---|---|
| Gujarati question → **English-only** cancellation policy | #5 | **#1** |
| English question → **Gujarati-only** price list | #2 | **#1** |
| English question → **Hindi-only** opening hours | #1 | #1 |
| Gujarati question → **English-only** deposit rule | **ABSENT** | **#1** |

**3/4 answerable → 4/4**, and every already-reachable case moved to #1. The last row is §18.8's failure
reproduced on the live engine: a Gujarati question about deposits could not reach the English document at all.

**Cleanup verified: 0 test cards remain.**

---

## 17. WHAT WAS NOT DONE, STATED PLAINLY

- **Gate 5** — cannot be met with today's data (R-6).
- **O9** — not measured (§14.1).
- **The two P3 tools and the date/name resolvers** — carried by the owner's own ruling (§14.2).
- **The knowledge index has not been recreated** — correctly, that is the owner's step, and P1.5 is complete
  and shippable without it now that §12.1 is fixed.

---

## 18. FINAL NUMBERS

‼️ **Every number below is from a build-gated, STRICTLY SEQUENTIAL run.** Concurrent runs on this machine
produced phantom build failures, a stale-binary green, and 6 phantom jest timeouts — see the methodology
note in §14A. The mobile suite is the clearest illustration: **6 failed / 191 s** run alongside the .NET
suites, **0 failed / 63 s** run alone, on identical code.

| Suite | Result |
|---|---|
| `Clinqet.API.UnitTests` | **11,210 passed**, 1 failed — see below |
| ↳ every P1.5 class, filtered | **313 passed, 0 failed** |
| `Clinqet.API.IntegrationTests` | **1,997 passed**, 0 failed, 0 skipped |
| `Clinqet.Communications.UnitTests` | **3,658 passed**, 0 failed, 0 skipped |
| `Clinqet.Mcp.UnitTests` | **811 passed**, 0 failed, 0 skipped |
| `ClinqetCosmosAIIndexSetup.UnitTests` | **176 passed**, 0 failed, 0 skipped |
| `clinqetmobilepartnerapp` jest | **3,446 passed** in 211 suites, 0 failed |
| `clinqetwebpartnerapp` jest (dictation + wav) | **45 passed**, 0 failed |
| Web ESLint (changed files) | **clean** — zero errors, zero warnings |
| Mobile `tsc --noEmit` | **clean** |
| `deploy.ps1` | **0 parse errors** |

‼️ **THE ONE FAILURE IS NOT THIS PHASE'S, AND IS DELIBERATELY LEFT ALONE.**
`VoiceKnowledgeSettingsConventionTests.TheBlockContainsExactlyTheKeysThisHostReads` reports
`unread but configured: MaxOpenXmlUncompressedBytes` — a key another session added to the `Voice:Knowledge`
block while the API host reads it from `AIAssistant:Processing`. Their OpenXML work is uncommitted and
in-flight in the same trees (`OpenXmlPackageInspector.cs`, `KnowledgeDocumentParser.OpenXml.cs`,
`VoiceKnowledgeSettings.cs`). **§0.19: another session's uncommitted work is not mine to edit** — fixing it
would collide with their next save. It touches no P1.5 code path; the filtered P1.5 run above is 311/311.

### The four indexes, verified against the ENGINE

| Region · index | Docs | `scripts` |
|---|---|---|
| CA `clinket-knowledge-dev-v1` | 744 | `Collection(Edm.String)`, filterable + facetable |
| CA `clinket-dev-v1` | 821 | `Collection(Edm.String)`, filterable + facetable |
| IN `clinket-knowledge-dev-v1` | 99 | `Collection(Edm.String)`, filterable + facetable |
| IN `clinket-dev-v1` | 126 | `Collection(Edm.String)`, filterable + facetable |

Nothing was lost in either region. `language` remains present on the two knowledge indexes and is written by
nobody — it disappears on the owner's next recreate, which is the step §18.19 assigns to them.

### Sabotage — 35 runs

S1–S6 (P1.5 core) **RED** · S7, S8 **RED** · S9 **BLIND, fixed, S9b RED** · S10 **refutation probe, green by
design** · M1–M5 (mobile dictation) **RED** · P1–P4 (transcribe controller) **RED** · O5a, O5b **RED**.

‼️ **Two of those runs found defects in the CHECKING, not the code**: S9 named a branch no input could
reach, and the first M1–M5 batch reported all five blind because the harness could not observe failure.
Both are written up in §14A — a sabotage that comes back green is a question about the guard, never a
confirmation of the code.
