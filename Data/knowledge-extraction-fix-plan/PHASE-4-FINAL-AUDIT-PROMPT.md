# PHASE 4 of 4 — AI Knowledge: closing multidimensional audit of the whole programme

> ‼️ **Rewritten by the Phase-3 session, 2026-09-15.** Read `phase-1\`, `phase-2\` and `phase-3\`
> (`HANDOVER.md` + `AUDIT.md` each, and `phase-3\PROGRESS.md`) first and treat them as part of this prompt.

## 0.0 ‼️ WHAT PHASE 3 HANDS YOU — read this before anything else

**Built, tested, pushed, DEPLOYED and AUDITED.** F1–F11 (F8 included — see below), H1/H3/H4, B3, X-01 and 13
provider-UI items on web AND mobile. Every suite green after the closing
audit's own fixes AND the owner-approved additions: **22,368 .NET** (API 12,346 + 2,130 · MCP 983 + 95 ·
Communications 4,638 + 562 · Identity 984 + 471 · cosmosindexsetup 198), **mobile 4,848**, **web 4,025**.
ESLint 0 errors in anything the
phase touched.

‼️ **READ `phase-3\AUDIT.md` BEFORE ANYTHING ELSE IN THAT FOLDER.** It records 10 adversarial live probes, a
five-case sabotage sweep, and **8 findings, all fixed and re-reviewed** — including two coverage holes only
the sabotage could find, and one in the audit's own tooling that reported two false passes.

### ‼️ THINGS THAT ARE TRUE ABOUT THE CANADA SANDBOX RIGHT NOW
- **The stored provider session is DEAD.** Its JWT aged out mid-audit and the refresh answered 401. It was
  deliberately **not retried** — a refresh token is single-use and hammering a rejected one fires
  `RevokeAllOnReuse` and kills every session on the account. **Ask the owner for a fresh login response
  (`token` AND `refreshToken`) and write both files** before you drive the API. `srch_client`, `emb_client`
  and `kprobe` need no JWT and still work.
- ‼️ **SUPERSEDED 2026-09-16 — `clinket-knowledge-dev-v2` IS LIVE AND FULL, and `v1` HAS BEEN DELETED.**
  Both regions: 2,850 (CA) / 2,625 (IN) cards, aliases pointing at v2, `contentCjk` + `knowledgeCjkAnalyzer`
  present, `contentVector` **retrievable AND stored**. The indexes were refilled by COPYING every card out of
  v1 — vectors byte-identical — so there was no re-ingest and no extraction drift. `AUDIT.md` §14 has the
  whole record. **There is no v1 and no flag; do not go looking for either.**
  ‼️ **CORRECTED 2026-09-25 (P4-I-02):** since search topology Phase 2 / D-26 the knowledge index is alias
  `private-knowledge-cell1-dev` → physical `private-knowledge-cell1-dev-v2`, `contentCjk` present, `contentVector`
  **hidden and NOT stored** (`cosmosindexsetup\KnowledgeSearchIndexInitializer.cs`). The `clinket-knowledge-dev-*`
  names and "retrievable AND stored" above are 2026-09-16 history.
- ‼️ **PYTHON IS NOT INSTALLED ON THE DEV MACHINE (found 2026-09-16).** `python` / `py` / `python3` all
  resolve to Windows Store stubs and no interpreter exists in the usual locations, so `kprobe.py`, `api.py`,
  `kaudit`, `kqueue` and every other tool in `tools\` **cannot run**. Phase 4's live half depends on them:
  either reinstall Python first, or port what you need (PowerShell works — every probe on 2026-09-16 was
  driven that way). ‼️ **If you drive the search REST API from PowerShell 5.1, send the body as UTF-8 BYTES**
  — a `-Body` string is encoded Latin-1 and every non-ASCII character is destroyed before it leaves the
  machine. That cost a false "the analyzer is broken" verdict before it was spotted.
- **Three documents Phase 3 created are still in `MEE3IC`** — Gujarati, Tamil and an unspaced Chinese price
  list (ids in `phase-3\AUDIT.md` §12.5). They are the only live corpus for multilingual retrieval; the
  retained fixture has no Chinese or Tamil in it. **Re-prove against them, then delete all three with the
  same purger that takes the 17 fixtures.**
- **Seven pre-existing ESLint errors** sit in the provider phone app, in five files Phase 3 never touched —
  one of them a conditionally-called React hook on the sign-in screen. That repository has no CI, so nothing
  is blocked. They are yours to judge.

### ✅ BOTH §0.7 ASKS WERE APPROVED AND BUILT — and R-10 came out far smaller than it was proposed
Approved by the owner in conversation 2026-09-15, built, tested and **proven live the same day**. Full record
in `phase-3\AUDIT.md` §12.9.
1. **`AiTurnCitation.channel`** — a REOPENED answer keeps the AI-written mark. Absent = the provider's own
   words. Proven live: five marked sources, identical between the live answer and the reopened one. **No UI
   change was needed on either app.**
2. ‼️ **R-10 is `KnowledgeDocument.cardsRewriting` — ONE nullable Cosmos boolean, and NO search-index field.**
   The `generation` field originally proposed was rejected as over-engineering once the measurement was
   taken: a re-read spends its MINUTES parsing, describing and embedding and touches no card until the end,
   so the only window that must close is the SECONDS of the card write. `status` had been conflating "what
   to tell the provider" with "may the receptionist answer".
   ‼️ **Its safety property, which you should re-derive rather than trust:** the flag is only ever READ while
   the row is `Processing`, which answered nothing before — so it can only ADD answerability, and a stranded
   `true` is exactly the old behaviour. That is why no stuck-run sweeper was built (one was proposed and
   withdrawn; U-04 and the nightly dead-letter alert already cover it).
   ‼️ **`NOT IS_DEFINED` comes FIRST in the Cosmos filter** — `c.cardsRewriting = false` is UNDEFINED, not
   false, for a row written before the field. A source-shape test cannot catch that; the emulator test can,
   and the sabotage that drops the guard is caught only by it.

## 0.1 ‼️ WHAT THE 2026-09-16 SESSION DID — read before you plan anything

**The whole record is `phase-3\AUDIT.md` §14 and `PLAN.md` rulings 0 / 0a / 0b.** Five things changed, and
every one is a place Phase 4 could waste a day re-discovering.

### A. Item #3 is CLOSED — `contentCjk` is live in BOTH regions and the switch is DELETED
There is no `Voice:Knowledge:CjkFieldEnabled`. **Do not go looking for it, do not re-add it.** The property,
all three host appsettings entries, both `if` branches and both convention-test registries are gone (§0.7.1 —
no feature flags, no old paths). The rule now lives in **`TextScriptDetector.NeedsCjkTokenisation`** in
`clinqetcore`, so the indexer that writes the field and anything reproducing it share ONE definition. It is
`Any(Han or Kana)`, never `All` — the live corpus's Chinese card is labelled `Latn,Hani`.

**Live state you can rely on (verified 2026-09-16):** `clinket-knowledge-dev-v2` in CA (2,850 cards) and IN
(2,625), aliases pointing at it, `contentVector` **retrievable AND stored**. ‼️ **`clinket-knowledge-dev-v1`
HAS BEEN DELETED** in both regions by the owner.
‼️ **CORRECTED 2026-09-25 (P4-I-02):** the live knowledge index is now `private-knowledge-cell1-dev` →
`private-knowledge-cell1-dev-v2`, `contentCjk` present, `contentVector` hidden and NOT stored (D-26).

**Proven live:** `烫发多少钱` returns **1 hit on `contentCjk` and 0 on `content`**. `en.microsoft` renders
the price line and the question as ONE token each — they can never match; `knowledgeCjkAnalyzer` makes 15
and 4 bigrams sharing `烫发`. Japanese has no card in the corpus, so it is proven at the analyzer only:
`en.microsoft` shares **0** tokens between a Japanese price line and its question, `knowledgeCjkAnalyzer`
shares **4**.

### B. ‼️ THE INDEX WAS REFILLED BY COPY, NOT BY RE-INGEST — and the copier was DELETED
`v1` handed back every field including the vector, so the rebuild cost **no AI, no Document Intelligence, no
extraction drift** — minutes instead of ~1,465 s per 100-page document. Vectors verified **byte-identical**
field by field (27 CA / 25 IN cards). **This is the entire payoff of the owner's decision to keep the vector
retrievable, and it is why `IsStored = true` must never be "optimised" away.**

The copier was **throwaway code, deleted after the run by owner ruling** — a migration run twice a year is
not a CLI surface. ‼️ **The recipe survives in the `clinqet-search-discovery` SKILL**; if you ever need it
again, read it there rather than rediscovering the traps (keyset cursor on `id`, never `$skip`; byte-bounded
write pages; derive `hasEmbedding` and `contentCjk`; copy BEFORE the alias moves).

‼️ **CORRECTED 2026-09-25 (P4-I-02): B is HISTORY.** Search topology D-26 (2026-09-22) made the knowledge vector
hidden and NOT stored, so no copy recipe exists any more — an old index hands back no vector. The blob AI cache
(`{businessId}/ai-cache/knowledge/{docId}.bin`) is the vector's only other home and has no rebuild reader yet
(topology Phase 5); until then a rebuild is refilled by `reindex-knowledge`, which re-embeds. The SKILL section
named above now says exactly that.

### C. EX-24 was FIXED; EX-25 / EX-28 / EX-34 and multi-frame TIFF are CLOSED BY OWNER RULING
See `PLAN.md` rulings 0a and 0b — all four "declared limits" and the TIFF limit now have the owner's explicit
word, which ruling 1 requires. **Do not re-raise any of them.** EX-24 was the exception and was FIXED: a
section count that mixed table rows with paragraph lines could put a wrong number in the overview card the
MODEL reads. A count is now printed only when every entry in that section is the same KIND.

### D. Thai and Hebrew fonts were ADDED; CJK fonts are CLOSED FOREVER

‼️ **AND THE FONT ALONE WOULD HAVE MADE THINGS WORSE.** `QuestPdfService.IsRightToLeft` tested **Arabic
only**, and its comment said Arabic was "the only right-to-left writing system this platform recognises" —
which was TRUE while Hebrew had no face, because boxes have no direction. Adding the font turned unreadable
boxes into a page laid out **BACKWARDS**. Fixed the same day (Thai is deliberately NOT in that rule).
‼️ **Generalise this before you audit anything: ADDING A CAPABILITY CAN ACTIVATE A DORMANT CODE PATH THAT WAS
CORRECT ONLY BECAUSE THE CAPABILITY WAS MISSING.** For every fix in this programme, ask what else was true
only because the broken thing was broken.
`PLAN.md` ruling 0. The material PDF now covers **12 of the detector's 15 scripts** (3.8 MB). Han, Japanese
and Hangul are absent **by decision** — 10–16 MB each. ‼️ **The old gap statement was WRONG**: it said "Han,
Japanese and Hebrew" and silently omitted **Hangul and Thai**. It was FIVE scripts, not three. If you ever
add a CJK face, `MaterialInfoPdfTests.ExpectedFamilySuffix` must lose that script from its catch-all or the
guard will certify glyphs it does not have.

### E. The closing audit of #3 found 3 defects — 2 of them MINE, and both are traps you can repeat
1. ‼️ **AN ABSENT INDEX ATTRIBUTE MEANS THE SERVICE'S DEFAULT, NOT "the safe one".** Removing an explicit
   `IsHidden = true` from the vector left it UNSET — and Azure's default for a vector field is
   **retrievable = FALSE**. The rebuilt index kept the bytes and refused to hand them back. The copy still
   worked (it read from v1), so nothing failed — but the NEXT migration would have read 3,072 nulls per card
   and built an index with **no vectors at all, silently**. `IsHidden` IS mutable in place; `IsStored` is NOT.
2. ‼️ **`Assert.NotEqual(true, x)` IS SATISFIED BY `null`** — the exact value that caused defect 1. The guard
   passed while the live index was broken. Use `Assert.False(x)`. This is the Phase-3 D-3 lesson repeating in
   a new costume: **a test can pin the label and miss the arithmetic.**
3. ‼️ **A COVERAGE HOLE: the index definition was pinned, but the SEARCHED FIELD LIST was not.** Dropping
   `contentCjk` from `ProviderKnowledgeSearchService.SearchFields` killed Chinese retrieval outright while
   the index still declared the field and every suite stayed green. Now guarded on BOTH legs —
   `KnowledgeSearchFieldsTests` (API host) and `SearchFields_IncludeTheChineseAndJapaneseCompanion_OnEveryLeg`
   (MCP host). **Ask of every field: is the WRITE pinned, and is the READ pinned? They are different tests.**

**Sabotage on the #3 work: 5 introduced, 5 caught.** Suites at the end of that session: **21,318 green, 0
skipped** (setup 198 · Functions 4,767 + 568 · MCP 984 + 95 · API 12,558 + 2,148).

### F. ‼️ NO REGRESSION IN OTHER LANGUAGES — and HOW that was proven, which is the reusable part
The owner's explicit worry was that a 7th search field would degrade English/Hindi/Gujarati. **Two
experiments, each isolating ONE variable** — copy this method:
- **Same index, only the field list changes** ⇒ **byte-identical** hits, order AND scores for English ×3,
  Gujarati, Hindi and Tamil. That is the definitive answer: `contentCjk` costs non-CJK queries nothing.
- **Same field list, only the index changes (v1→v2)** ⇒ ordering shifts among near-ties. That is **BM25
  shard-local statistics**, inherent to ANY rebuild including a re-ingest. Hit counts identical everywhere;
  Hindi (3 hits) and Tamil (2) retain 100%.
‼️ **Read overlap denominators carefully** — "3/8" on a query with only 3 total hits is 100%, not a loss. The
first reading of that table looked like a regression and was not.

### ‼️ FOUR THINGS **PHASE 3** GOT WRONG (2026-09-15), ALL CAUGHT BY ITS OWN TESTS OR PROBES
1. **A worst-case reserve is a tax on the common path.** Reserving the coverage sentence at its widest
   charged every ordinary call for a sentence it would never carry — a whole seated card at 600 tokens.
2. ‼️ **CONDITIONAL DI REGISTRATION IS NOT A GRACEFUL DEGRADE.** The first F10 fix made the API host
   unbootable: four services take the client as required, so an unresolvable factory became an unresolvable
   service. The answer was a wrapper that is present and EMPTY.
3. ‼️ **`builder.Configuration` AT REGISTRATION TIME DOES NOT SEE A `WebApplicationFactory`'s CONFIG** — it
   is layered on after the app's own builder code runs. Read config INSIDE the factory lambda. This took the
   entire API integration suite down and the fixture *had* set the value.
4. ‼️ **A UNIT MIX-UP IN A BUDGET.** The retrieval note is always English (~1,700 chars ≈ 425 tokens) but its
   1,700 CHARACTERS were being subtracted from a budget already converted to another script's characters —
   a Chinese or Japanese business got less than half its entitlement. Found by writing the measurement test
   `VoiceKnowledgeSettings` had been *citing by name for months without it existing*.

### ‼️ AND ONE **PHASE 2** GOT WRONG, WHICH BLOCKED PHASE 3'S DEPLOY
`Clinqet.Communications.IntegrationTests` was **13 red before Phase 3 started** —
`No service for type 'IAiBudgetGovernor'`. Phase 2 made it a required constructor argument and updated the
tests to resolve it, but never told `FunctionAppFactory` to register it. **That is gotcha 37 happening to the
session that wrote gotcha 37.** A red build silently leaves the old code running, so no Functions deploy
could have happened at all. Fixed here. **Run every test project in every repo before you believe anything.**

### G. ‼️ WHAT PHASE 4 INHERITS — AND IT IS NOT A BUILD BACKLOG

**No coding task has been handed to you.** Every feature of this programme is built, tested and live. Your
charter is: audit → fix what you FIND → re-run the 17 fixtures → delete them and the 3 test documents →
mark the programme complete. You will write code only for defects YOU find.

Exactly **two** items were carried forward, and **both are MEASUREMENTS, not builds**:

| # | What to do | ‼️ What NOT to do |
|---|---|---|
| **1. Japanese on the vector leg** | Embed a Japanese question and a Japanese passage, score them, **write the number down**. Chinese measures 0.603 Chinese→Chinese; Japanese has never been measured | Do **not** tune a threshold, add a leg or change a weight. If the number is poor, **STOP and ask the owner** |
| **2. Three legs, fourteen fields** | Count alphabets per business across the live corpus and **write the number down**. `RetrievalMaxQueryLegs` is 3; a four-alphabet business would get three legs and an honest "not searched in" note — which is **correct, designed behaviour**, and the caller is told | Do **not** raise the cap, make the leg count adaptive, or touch the note. The cap exists so a model that fills every field it is offered cannot turn one question into fourteen. If such a business exists, **STOP and ask the owner** — that is a cost decision, not an audit fix |

Neither is a known defect. Both are **blanks in the evidence**, recorded honestly rather than papered over —
which is the same standard §0 of this file demands of you.

‼️ **And three Phase-2 rows are open for CONDITIONS, not code:** `E9.2` and `L-11` need the 03:45 UTC nightly
timer to have run (evidence is already staged — two dead-lettered messages from 2026-08-18 whose documents no
longer exist; both gone ⇒ the drain works), and `U-04` needs a run that genuinely halts part-way, which
cannot be forced from a dev machine.

---

## 0.2 ‼️ ENVIRONMENT GOTCHAS THAT COST THE LAST SESSION HOURS — read before you run anything

1. ‼️ **PYTHON IS NOT INSTALLED ON THIS MACHINE (2026-09-16).** `python` / `py` / `python3` all resolve to
   Windows Store stubs and no interpreter exists in the usual locations. **Every tool in `tools\` is Python
   and CANNOT RUN** — `kprobe.py`, `api.py`, `srch_client.py`, `emb_client.py`, `kaudit`, `kqueue`. Phase 4's
   live half depends on them. **Either reinstall Python first, or drive the REST APIs from PowerShell** —
   every probe on 2026-09-16 was done that way and it works fine.
2. ‼️ **POWERSHELL 5.1 SENDS A `-Body` STRING AS LATIN-1.** Every non-ASCII character is destroyed before it
   leaves the machine. A Chinese query came back "0 tokens" and looked exactly like a broken analyzer; the
   analyzer was fine. **Send UTF-8 BYTES:**
   `$b=[Text.Encoding]::UTF8.GetBytes($json); Invoke-RestMethod ... -ContentType 'application/json; charset=utf-8' -Body $b`
   And a `.ps1` containing non-ASCII literals must be saved **with a UTF-8 BOM** or 5.1 mis-reads the file.
3. ‼️ **`/stats` documentCount LAGS.** India's fresh index reported **0 documents** minutes after a verified
   2,625-card copy. The live `search=*&$count=true` said 2,625. **Never conclude anything from `/stats`** —
   use a count query.
4. ‼️ **THE TEST HOST CRASHES UNDER MEMORY PRESSURE, AT A DIFFERENT TEST EACH TIME.** "Test host process
   crashed" with 1.4 GB free of 31.5 GB, aborting at 232 tests then at 56. It is not your code. Check
   `Get-CimInstance Win32_OperatingSystem` free memory and `docker ps` before believing a red integration
   run; it passed 568/568 once memory freed. ‼️ **A single flaky unit failure appeared in the same window and
   passed on re-run with no code change** — treat one-off failures during heavy load as suspect, but say so
   out loud rather than burying them.
5. ‼️ **ANOTHER SESSION WRITES TO THESE REPOS WHILE YOU WORK.** On 2026-09-16 eleven `VoiceOwnNumber*` /
   `Telnyx*` files appeared mid-sabotage-sweep. **`git status` shows their work mixed with yours** — check
   file mtimes before assuming a change is yours, and NEVER use `git checkout/restore/reset/stash` (§0.19).
   Snapshot to the session scratchpad and restore from there.
6. ‼️ **A RESTORE THAT KEEPS THE MTIME DOES NOT RESTORE THE BUILD** (gotcha 31, still true). `touch` every
   file you restore, or MSBuild reuses the sabotaged binary and hands you a FALSE PASS.
7. **Backticks inside a double-quoted shell string are command substitution** — they silently eat your prose.
   Write scripted edits to a FILE and apply them with a binary-mode `perl` slurp, comparing md5 afterwards.

### Tools you now have
- `tools\kprobe.py` — replays the retrieval's **exact** hybrid query (escaped text, digit variants, code
  wildcards, searchFields, filter, scoring profile, vector k) against the LIVE alias. The deployed MCP host
  answers `403 Ip Forbidden` from a dev machine, so this replay is the proof. ‼️ **It is a REPLAY**: it
  proves the index and the ranking, never the gates, the trim or the note.
- `tools\srch_client.py` / `tools\emb_client.py` — search + embeddings, self-signing, no SDK.
- ‼️ **Three API-version traps** are written into `CANADA-SANDBOX-ACCESS.md`: Analyze does NOT resolve an
  alias (needs the PHYSICAL name, from `GET /aliases` at api-version 2026-04-01); `docs/search` DOES, but
  only on the newer version — on `2024-07-01` it answers `404 index not found`; and the scoring profile is
  `knowledgeRelevance`, whose C# *field name* is not its *value*.

### ‼️ The retained fixture is THREE alphabets in one document — not "Gujarati", and not "Hindi" either
Read live from the index on 2026-09-15. `SX3SG2` `4eeae96e1e0549538283705897ca3bc0` is a
`श्री ब्यूटी पार्लर रेट कार्ड` whose **six** cards carry **Devanagari** (`सेवा: बाल कटवाना | कीमत: ₹250`),
**Gujarati** (`વાળ કાપવા — ₹250`) **and** an English note — which is precisely what makes it the right fixture
for multilingual retrieval. `6fcd9c32ee6e4c8397c7babc7121a462` is Gujarati throughout (3 cards). The answer
under test is `₹250` either way. ‼️ Earlier notes in this folder call them "Gujarati", and a mid-Phase-3 note
over-corrected that to "Hindi, not Gujarati"; **both are wrong and both have been fixed** — do not re-inherit
either. **Phase 4 re-runs all 17 fixture documents one last time and only then deletes them.**

You are starting a fresh session on the Clinqet platform (repos under `C:\Nik`). Three sessions have fixed the AI Knowledge document pipeline (provider documents → extraction → search cards → phone receptionist / Business Search / material send / draft services) against the audit of 2026-09-10. Your job is the **last word**: a fresh, hostile, end-to-end, multidimensional audit of the pipeline as it now stands — every change the three phases made AND the whole flow around them — with live data, and then fixing what you find. You are not a reviewer of the previous sessions' claims; you are an auditor of the code and the running system. Nothing is "known good" until you have read it and run it.

## 0. Read these completely before anything else

1. `C:\Nik\CLAUDE.md` (every §0 rule), `C:\Nik\Data\knowledge-extraction-fix-plan\PLAN.md`, the three handovers and three audits.
2. `C:\Nik\Data\knowledge-extraction-audit\FINDINGS-2026-09-10.md` and its `evidence/` — the original defect list including the owner rulings box, §7 (live read-only pass), §8 (the 17-document live batch and its L-1…L-14), §9 (the 2026-09-03 cross-check, X-01…X-08) and §10 (the 25 provider-UI items); every id must end up as fixed-and-proven, owner-accepted (with a memory entry, and for extraction items only with the owner's explicit words), or re-opened by you.
3. Skills: `clinqet-search-discovery` (the v2 index, the CJK field and the three API-version traps),
   `clinqet-business-search` (X-01 and the shared query contract), `clinqet-voice-assistant` (whole file — it should now describe the fixed behaviour; where it does not, that is a finding), `clinqet-business-search`, `clinqet-function-app`, `clinqet-infrastructure`, `clinqet-testing`, `clinqet-notifications`, `clinqet-deployment`, `clinqet-partner-app`, `clinqet-provider-mobile`.
4. Memory: `MEMORY.md` and every knowledge entry it links, including the three phase entries.
4b. ‼️ `phase-3\PROGRESS.md` in full — the live measurements Phase 3 rests on (the tokenisation table, the
   cross-script embedding matrix, the fixture baseline), the two §0.7 asks, and the defects it found in its
   own work. A claim in a HANDOVER that is not in PROGRESS has no measurement behind it.
5. Code: everything the phases touched (`git log` in each repo since the audit commits: `clinqetinfrastructure aff1c8d`, `clinqetcore f6b2d00`, `clinqetshared e81b1ae`, `clinqetfuncations 4d3a9ca`, `clinqetapi bd4a69b`, `clinqetmcp b65593b`) AND the full knowledge path regardless of whether it changed: parsers, chunker, ingest function, image lane, vision transcription, indexer, management service, controllers, drafts lane, retrieval services, MCP tools, Business Search tool, material send, web + mobile knowledge pages.
6. Tools and corpus in `C:\Nik\Data\knowledge-extraction-audit\tools\` and `test-corpus\` (extended by the phases), and `C:\Nik\Data\knowledge-extraction-fix-plan\CANADA-SANDBOX-ACCESS.md` — the Service Bus connection string is already stored at `C:\Nik\Data\knowledge-extraction-fix-plan\secrets\ca-servicebus.txt` and the tools read it automatically; never copy the value anywhere. Ask the owner only for a partner-app login (Business Search through the real API) and for deployments.

## 1. Method — the same rigour the original audit used, applied to the finished work

1. **Read everything** in scope end to end (never skim); keep working notes on disk as you go.
2. **Dimension audits in parallel** (spawn read-only agents where useful, then verify every High/Critical claim yourself against the cited lines — an agent claim you did not verify is not a finding): (A) parsers and passage creation, (B) PDF/vision/image lane, (C) pipeline safety, status and idempotency, (D) draft services, (E) index and retrieval (voice + provider), (F) provider UI web + mobile parity and localization, (G) config/ARM/deploy hygiene and secrets posture, (H) tests — coverage, vacuous tests (sabotage a sample), placement per §0.18, cross-repo scans per §0.15/§0.17, (I) docs — SKILL ×4 and memory truthfulness, (J) performance and cost (RU, AI calls, index request sizes, cache sizes).
3. **Prove by execution:** rebuild the HEAD replay corpus results and compare with the Phase-1 "after" set; **re-run the 17 retained fixture documents in `SX3SG2` one last time** (`kaudit reprocess ca SX3SG2 <docId>` for every id in `PLAN.md` §"Owner rulings") and diff every `cards.txt` and `artifact-blocks.txt` against the original baseline in `evidence/ca-live-batch/` and against each phase's `live-after/` set — every L-1…L-8 defect must be gone and nothing that worked in §8.4 may have regressed; run the full PDF/image corpus and at least ten real documents from `C:\Nik\Data\SampleData` (a mortgage amortization table, a lease, a bank statement, an equipment catalogue with pictures, a resume, an Excel pricing sheet, a PowerPoint deck, a scanned form) through the real pipeline on the Canada sandbox, on a business whose categories match the documents when drafts are judged; read back rows, artefacts, cards, images, drafts; replay receptionist and Business Search queries in English, Gujarati, Hindi and Chinese; send material once and open the PDF; run `kaudit drift ca` and `tools\kqueue`; read the admin alerts raised. **Then, and only then, delete the 17 fixture documents through the real purger** (`kaudit delete ca SX3SG2 <docId>`), delete every other test document, and confirm with `kaudit list ca`, `kaudit drift ca` and an empty dead-letter queue.
4. **Adversarial pass:** invent inputs the phases could not have seen — password-protected PDF, an OLE-encrypted DOCX, a 30 MB single-page image, a 100-page scan, a zip-bomb DOCX with honest sizes, a document that is 80% pictures, a Word file typed entirely in one text box, an Excel sheet with 40 regions, a table whose every row is a section band, a PDF whose pages are rotated, a price list in Arabic numerals and one in Gujarati numerals, an HTML page with 40,000 nested divs, a redelivered message after a row edit, two members replacing the same document at once.
5. **Every finding** gets id, severity, status (proven by execution / confirmed in code), evidence (file:line + the card/row/alert), and a fix direction. Fix everything you find that is within the programme's scope (ask for the §0.7 table on any schema item; ask before any architecture change); write the tests; re-run the live proof for what you fixed.
6. **Clean up (§0.16)**, update SKILL ×4 and memory, mark the programme complete in `PLAN.md` with the date and the final counts.

## 2. Owner's coding standards (verbatim — they apply to every line you write)

# SYSTEM INSTRUCTIONS & CODING STANDARDS
You are an expert Software Architect and Developer. You must strictly adhere to the following rules for all code analysis, generation, and refactoring.
## 🛑 1. CORE DIRECTIVES (THE "ZERO" RULES)
* **Zero Assumptions:** Do not assume context. Read and analyze the entire provided codebase thoroughly, regardless of its size, to gain full clarity before writing a single line of code.
* **Zero Hallucinations:** Only output factual, verified code and configurations.
* **Zero Workarounds:** Never use shortcuts, "hacky" fixes, or temporary workarounds. Apply only industry best practices.
* **Plan First:** Analyze thoroughly, formulate a solid architectural plan, and then execute.
## 🏗️ 2. PRE-PRODUCTION FREEDOM & REFACTORING
* **No Legacy Constraints:** We are in a pre-production environment. We have absolute flexibility.
* **Do The "Right" Thing:** Never write backward-compatible code, workarounds, or backfilling logic to support older structures. If a massive refactor is the mathematically or architecturally correct solution, execute the refactor.
* **State Resets:** Assume data can be dropped and recreated at any time. Focus entirely on the absolute best, fully production-ready end state.
## ⚙️ 3. BACKEND & INFRASTRUCTURE
* **Maximum Performance:** Backend code must be hyper-optimized, efficient, and production-ready.
* **Concurrency & Safety:** Implement multi-threading and async tasks where optimal, but you MUST guarantee the code remains 100% thread-safe.
* **Resource Mastery:** Explicitly handle resource deallocation the moment an object is no longer needed. There must be ZERO memory leaks, ZERO CPU leaks, and ZERO resource exhaustion.
* **Watertight Logic:** Code must have zero gaps and zero bugs. Cover every logical pathway.
## 🖥️ 4. FRONTEND & UI ENGINEERING
* **Strict Alignment:** Stay entirely aligned with the existing team theme, design system, and component structure. Build on top of it; do not deviate.
* **Mobile-First Responsiveness:** The UI must be fully responsive and flawless on mobile devices and iPads, as this is our primary user base.
* **Crisp UX & Routing:** Ensure routing between pages is smooth, fast, and lightweight.
* **API Optimization:** UI code must be solid and flexible. Strictly prevent redundant or duplicate API calls.
* **Mockups for New Views:** If tasked with creating a brand new page or interface, DO NOT immediately write the integrated UI code. First, generate an isolated HTML mockup inside a dedicated mockup directory so the design can be visually validated and approved.
## 🛡️ 5. EDGE CASES & RESILIENCE
* **Exhaustive Exploration:** Never limit your scope to the "happy path". You must anticipate, explore, and handle every possible edge case.
* **Fail-Safes:** Account for network errors, latency, null states, missing data, and broken connections on both the frontend and backend. The solution must survive all of them gracefully.
## 💬 6. COMMENTING & DOCUMENTATION
* **High Signal-to-Noise:** Write comments ONLY when they provide critical architectural context or explain the "why" behind complex logic.
* **No Verbosity:** Absolutely no redundant, obvious, or verbose comments. Let the clean code speak for itself.
## 💡 7. OPTIONS & DECISION MAKING
* **Explicit Recommendations:** Whenever presenting multiple solutions, architectural choices, or design options, you MUST always highlight your strongly recommended option.
* **Provide the "Why":** Alongside your recommendation, include a clear, concise justification explaining exactly why it is the best path forward to facilitate rapid and informed decision-making.

QUALITY OVER SPEED. Full sandbox freedom; nothing committed, pushed or deployed by you (the owner does that); never build while another session works in `C:\Nik`; never `git checkout/restore/reset/stash`; tree clean at the end.

## 3. Deliverables

- `C:\Nik\Data\knowledge-extraction-fix-plan\phase-4\FINAL-AUDIT.md` — findings by dimension with evidence; the closure status of every original id (A/B/C/D/E/F/G/H, §7 live rows, and the UI/cross-check items); what you fixed in this session (with tests and live proof); what remains and why (owner-accepted with memory entries).
- Updated SKILL ×4 and a memory entry `knowledge-extraction-programme-closed-<date>.md`; `PLAN.md` marked complete.
- A plain-language summary in the chat: what a caller and a provider can now rely on, and the short list of anything they still cannot.

## 4. Before you finish — the closing multidimensional self-audit, and no next prompt

This phase is the audit of the programme, and its own fixes get the same treatment before the programme is declared closed. Write the last section of `phase-4\FINAL-AUDIT.md` as a self-audit of everything you changed in this session, each dimension answered with evidence: **bugs** (every fix red→green, then sabotaged once — the test must fail), **gaps** (what you saw and did not fix, with the owner's explicit acceptance quoted for any extraction item), **missing functionality** (every original id A/B/C/D/E/F/G/H, L, X, U is fixed-and-proven, owner-accepted with a memory entry, or re-opened with a new id), **logical gaps** (every status transition, redelivery and concurrent-writer path of what you touched walked once), **regression** (all knowledge suites in every host green; the HEAD replay corpus unchanged where it should be; the 17 fixture documents' final cards diffed against the baseline and every phase's after-set), **live** (the documents you ran, docIds, cards, alerts; fixture deleted through the real purger; `kaudit list ca`, `kaudit drift ca`, an empty dead-letter queue), **cost** (RU, AI calls, index request sizes before and after the programme), **security/tenancy** (no cross-partition query; tenancy and secrets posture unchanged; nothing from `secrets\` copied anywhere), **config/ARM/deploy hygiene**, **comments (§0.14)**, **docs & memory** (SKILL ×4 and memory truthful), **tree clean (§0.16)** in every repo.

Phase 4 is the last phase: **do not write a next prompt.** End with the closing report in the chat (the plain-language summary above, the final counts, and the list of anything the owner still must decide or run), mark the programme complete in `PLAN.md` with the date, and stop.
