# Session D — reading order, charts and résumés: EX-07, EX-17, EX-18

> Written 2026-09-05 by Session C, which closed EX-04, EX-05, EX-09, EX-12, EX-15 (typed sheets),
> EX-20 (ranking) and #9, and found D11/D12 already done. **Read `PLAN.md` in this folder FIRST — it is
> the authority, and §1 records 22 decisions you must not re-open.**

---

## 0. READ THESE, IN THIS ORDER, BEFORE TOUCHING A FILE

1. **`C:\Nik\Data\knowledge-flow-source-review\PLAN.md`** — the decision register (§1, D1–D22), the four
   rules for every session (§0), what the live data can and cannot prove (§6), how to work in this tree
   (§7), and the closing duties (§9).
2. **`C:\Nik\CLAUDE.md`** — all of it. Especially §0.6 (never a cross-partition Cosmos query), §0.7 (any
   SQL/Cosmos/Search schema change needs the owner's yes FIRST, presented as the §0.7 table), §0.14 (no
   verbose comments), §0.16 (leave the tree clean; never write a scratch file inside a repo), §0.18 (a
   library class is tested from the suite of the HOST that invokes it), §0.19 (never `git checkout` /
   `restore` / `reset` / `stash` / `clean`).
3. **`EXTRACTION-PASSAGE-AUDIT.md`** — EX-07, EX-17, EX-18 are your findings. ‼️ **Verify each against the
   real code before believing it.** Session C proved EX-15's stated failure NOT REAL and found EX-09 worse
   than written. The audit is a lead, not a fact.
4. **`TRIAGE-AND-STATUS.md`** — the scoreboard, and "What Session C learned the hard way".
5. The **`clinqet-voice-assistant` SKILL** (`.claude/skills/clinqet-voice-assistant/SKILL.md`) — the living
   contract. Its last section is Session C's work and it constrains yours.

---

## 1. YOUR SCOPE — three items, and the corpus comes FIRST

| Item | The defect | Gate |
|---|---|---|
| **EX-07** | Two-column and positioned reading order is heuristic. A résumé interleaves employment history with skills; a menu attaches a price to the wrong service; a brochure reads a right-hand callout between two left-column paragraphs | Design shown first |
| **EX-17** | Word résumé fidelity: header/footer content, `w:vanish` hidden text, floating text boxes, positioned multi-column layouts | Design shown first |
| **EX-18** | Office charts, SmartArt, shape text and picture fills are only partially represented — a chart can be visually central and yield only its title | Design shown first |

### ‼️ THE GOLDEN CORPUS IS BUILT FIRST, AND IT IS THE BULK OF THE SESSION

Expected reading order recorded **per slide and per page, per file, by hand**. Without it there is nothing
to measure a change against and any "improvement" is an opinion.

- Sources: the **8 real `.pptx`** in `C:\Nik\Data\SampleData`, the **9 live `.docx`**, the **2 live PDFs**,
  the **8 live images**, plus anything the owner adds.
- ‼️ **ASK THE OWNER FOR MORE SAMPLE FILES BEFORE STARTING.** The corpus we hold contains **no résumé and
  no two-column page** — the exact shapes EX-07 and EX-17 are about. Measuring on files that do not contain
  the condition proves nothing, and saying otherwise is the failure mode this programme keeps hitting.

---

## 2. ‼️ WHAT YOU MUST ASK BEFORE YOU BUILD

**Stop and ask. Do not guess, and do not "pick the sensible default and note it."**

### 2.1 Infrastructure — ALWAYS the owner's call (PLAN §0.3)

A new Service Bus queue · a new storage container or lifecycle rule · any new Azure resource · a new
`local.settings.json` key · a new timer or function trigger · a new Cosmos container or partition key · a
new search index, alias, analyzer, scoring profile or synonym map · anything needing an ARM template or
`azureautomation/deploy.ps1`.

‼️ **The default answer is "no new infrastructure."** Present what it is, what it costs, what breaks
without it, **and the no-new-infrastructure alternative** — then WAIT.

### 2.2 Schema — the CLAUDE.md §0.7 table, then WAIT

Any new SQL column/table/index · **any new field on a Cosmos entity** · any new search index field,
analyzer or scoring change. Present the full table (What · Who reads it · Who writes it · Why not a column ·
Why not an enum · Why not already stored · Cost · What breaks if omitted) and wait for an explicit yes **in
your own session**. A plan document saying "add X" is NOT approval.

‼️ **Session C thought it had two §0.7 decisions to hand over. BOTH turned out to need no schema at all** —
and both times the field was the answer to a question framed wrongly. Read D23 and D24 before you reach for
a table of your own; **measure the alternative and read the retrieval path first.**

- **#9 (D23)** — a field was going to REMEMBER which category a service left. Refreshing *every* selected
  category means nothing needs remembering. ‼️ Session C had told the owner this was "a business-wide sweep";
  **that sizing was wrong** — measured live, a business has **1–5** selected-category documents. The owner had
  already declined it on that bad number, and correcting it changed the decision.
- **EX-13 (D24)** — the model can already say "the Model X, five hundred dollars, I have a photo of it",
  because that line is its OWN text card and D18's seating puts it first.

**One residual, deliberately left open** — and it is NOT what EX-13 was about: the words beside a photo feed
the **vector only**, never the searchable `content`, so an exact product code (`TL1255C`) may not pull the
photo up reliably. That is search RECALL. If you take it, it needs a §0.7 table, and it belongs with the
index rebuild (D6) where the field costs nothing extra.

### 2.3 Designs — all three of your items need the design shown before any code

Present the shape, the alternatives you rejected and why, and the cost. Then wait.

### 2.4 Anything that changes what a provider or caller experiences

Which content ships · any limit a provider or caller can hit · any large refactor · anything where two
readings of the request lead to different work.

---

## 3. CODING STANDARDS — non-negotiable

- **Fix the CLASS, never the call site.** Grep every site. A fix at one place is not a fix.
- **Do not over-complicate. The cheapest correct answer wins.** Derived data needs a recompute, not an
  outbox. A one-to-one fact is a column, never a table. A fixed list is an enum, never rows. If an existing
  mechanism already does it, use that one. Premature abstraction IS over-complication.
- **No workarounds.** No `--no-verify`, no swallowed exceptions, no `// TODO`, no commented-out code, no
  skipped tests. If the correct solution is hard, write the correct solution.
- **No verbose comments (§0.14).** Default is NO comment. One short line, only for a non-obvious WHY, an
  invariant, a gotcha or a spec reference. Never narrate what the code does.
- **Pre-production: never write backward-compatible code, a feature flag, an old path or a backfill.**
- **Thread safety.** Shared services are SINGLETONS — per-document state is per-call, never a field.
  ‼️ A capture across a parallel fan-out is CONCURRENT (`ConcurrentBag`), never a plain `List`.
- **A setting belongs only in the host that reads it**, and its class default must mirror `appsettings.json`
  exactly — including a prompt template, character for character.
- **No hardcoded user-facing text** — localization keys in `en.json` **and every other language file**.
  Admin-internal alert wording is the only exception.
- **Every `IMemoryCache` write sets `Size = 1`.**
- **Never a cross-partition Cosmos query.**
- **Tests live in the suite of the HOST that runs the code (§0.18)** — the knowledge extraction and ingest
  lane is the **Functions** host (`Clinqet.Communications.UnitTests`); the voice retrieval path is
  **MCP** (`Clinqet.Mcp.UnitTests`); draft approval and the knowledge controllers are the **API** host.

---

## 4. ‼️ HOW TO WORK IN THIS TREE — another session IS live

Session C worked alongside a concurrent money/currency session the whole way. It is survivable and normal.

- **Build into a private folder** so two sessions can never share `obj/bin`:
  `dotnet build <proj> -p:UseArtifactsOutput=true -p:ArtifactsPath="<your scratchpad>/build"`
- ‼️ **A compile error in a file you never touched means a peer is mid-write — retry once and CARRY ON.**
  Session C hit this four times; every time the retry (or the next attempt minutes later) was clean. Stop
  and tell the owner only if it persists. **Never "fix" their file.**
- ‼️ **Isolated builds make ~127 convention tests fail LOUDLY** because they walk up from the binary to find
  source and cannot. **That is correct behaviour, not a defect.** Clear them with ONE in-tree run at the end.
  ‼️ But **verify** it is only that: Session C changed class defaults AND appsettings, so an appsettings
  convention failure could have been real. Check the values by hand before dismissing it.
- ‼️ **NEVER `git checkout` / `restore` / `reset` / `stash` / `clean`.** It wipes every session's
  uncommitted work. Snapshot to your scratchpad and restore with `cp`.
- ‼️ **Snapshot JUST IN TIME**, immediately before each sabotage.
- **Never write a scratch file inside a repo.** Everything goes in the session scratchpad.
- **The owner pushes, commits and deploys. Never `git push`.**

---

## 5. ‼️ LIVE-DATA TESTING — mandatory, and honest about its limits

**Credentials are READ AT RUNTIME and NEVER copied into a file, a doc or a commit:**
`C:\Nik\cosmosindexsetup\appsettings.ca.json` and `appsettings.in.json` →
`CosmosDb:ConnectionString`, `Search:ServiceEndpoint`, `Search:ApiKey`, `AzureStorage:ConnectionString`.

‼️ **Document Intelligence and Azure OpenAI credentials are NOT in those files.** They are in
`clinqetfuncations\Clinqet.Communications\appsettings.json` and `local.settings.json` — and per **D14** the
committed keys are **sandbox keys, accepted by the owner**. Do not report them, rotate them or "fix" them.

- **Cosmos:** database `Clinket-nonprod`, container `KnowledgeBase-dev`, partition key `/businessId`.
  Every query partition-scoped. ‼️ A raw gateway query cannot use `COUNT`/`GROUP BY` — project and
  aggregate locally. ‼️ The Cosmos SDK deserializes with **Newtonsoft**, so query into `JObject`, not
  `System.Text.Json.JsonElement` (which also throws once the response buffer is recycled).
- **Search:** alias `clinket-knowledge-dev` (index `clinket-knowledge-dev-v1`), api-version `2026-04-01`.
  Fields are **`chunkKind`** and **`sectionTitle`**. The **Analyze** endpoint does NOT resolve aliases.
- **Blobs:** container `provider-knowledge`, path `{businessId}/{docId}/...`; the vision page cache is
  `_ocr/{businessId}/{docKey}/{hash}/{deployment}/v{promptVersion}/pNNN.md`.
- **Sample files:** `C:\Nik\Data\SampleData` (8 real `.pptx`).
- ‼️ **Measure with the code that SHIPS, never a script that imitates it.**
- ‼️ **A CHARACTER count is NOT a fidelity measure (D15).** Session C measured a faithful transcript losing
  **32.5% of its characters and zero facts**. For reading order you need an ORDER measure — a hand-recorded
  expected sequence and an edit distance against it — not a length.
- **All harness scripts and output go in your scratchpad, never a repo.**

### ‼️ What the live corpus CANNOT cover — say so plainly, never imply broader coverage

- **No live `.xlsx` and no live `.pptx` in either region.** All nine live `.docx` contain **zero pictures**.
- **No live résumé and no live two-column page** — the shapes EX-07/EX-17 are about. **ASK for files.**
- **All 843 live cards are Latin-script.**
- Canada: 3 `.json` + 1 `.jpeg`, **no PDF**. India: 9 `.docx` + 2 `.pdf` + 8 images + 31 typed FAQs.
- ‼️ The live vision-lane corpus is **10 files** (2 PDFs **and 8 images** — images take the same lane; the
  earlier plan said "the 2 India PDFs" and was wrong). Every one is **a single page**.
- ‼️ **DO NOT rebuild, reseed or delete the search index** (D6 / PLAN §5.4). It is seeded and usable:
  CA 744 cards, IN 99 cards. Nothing in your scope needs it rebuilt.
- ‼️ **THE TRAP.** The live index still carries `docTitle`, `sectionTitle`, `docName` and
  `linkedServiceNames` on `standard.lucene`; the code moved them to `en.microsoft` (EX-33) and an analyzer
  only changes when the index is REBUILT. A live recall test will show stemming and accent misses your code
  has already fixed. **That is the un-rebuilt index, NOT a defect, and NOT a finding to report.**
- ‼️ **9 typed FAQs on `UKBV84` (IN) are `Ready` with NO cards. This is TEST DATA (D13), never a defect.**

---

## 6. ‼️ THE SABOTAGE DISCIPLINE — every guard proven able to FAIL

Break the fix → watch the guard go RED on **exactly** the right case → restore from a just-in-time
scratchpad snapshot (`cp`, never git) → confirm byte-identical → re-run green. **One sabotage at a time.**

- ‼️ **GATE EVERY SABOTAGE ON A ZERO-ERROR BUILD.** Session C ran one against a **stale binary** because a
  peer's file would not compile; it "passed" and meant nothing. Check the build result before the test result.
- ‼️ **If a sabotage PASSES, the guard or the code is wrong — never the sabotage.** Session C had **three**
  pass, and every one was right to: two vacuous guards and one piece of unreachable code.
- ‼️ **A guard must assert the thing that actually differs.** A blank vision page produces identical merged
  TEXT whether or not it goes through the fact gate — only the COUNTER and the ALERT distinguish it, so a
  text-only assertion proved nothing.
- ‼️ **A guard needs the dangerous input, not a near-miss.** A stray-`<` guard whose text had no later `>`
  proved nothing about markup-swallowing, because the naive rule falls through harmlessly without one.
- ‼️ **Prefer a SWEEP to a pinned case.** A pinned case proves one input; a sweep over sizes, shapes and
  counts proves the rule.
- ‼️ **Run any concurrency guard three times.** If it is not red every time, it proves nothing.

---

## 7. WHAT YOU INHERIT AND MUST NOT DROP

**Suites, in-tree, all green at the end of Session C:**
`Clinqet.API.UnitTests` **11 661** · `Clinqet.Communications.UnitTests` **3 947** ·
`Clinqet.Mcp.UnitTests` **869** · `ClinqetCosmosAIIndexSetup.UnitTests` **181** · **0 build errors.**

**Closed and sabotage-proven — do not regress these.** EX-01, EX-02, EX-03, **EX-04**, **EX-05**, EX-06,
EX-08, **EX-09**, EX-10, EX-11, EX-13, EX-14, **EX-15**, EX-16, EX-19, **EX-20**, EX-21, EX-22, EX-23,
EX-26, EX-27, EX-29, EX-31, EX-33, and #1–#3, #5, #6, #8, **#9**, #10–#22.

The ones most likely to be disturbed by YOUR work — read the SKILL's Session C section before touching any:

- ‼️ **EX-04's fact gate.** A vision transcript is kept only if every number survives and word coverage
  clears `MinTextConservation`. If you change what the parser or the transcriber produces, **re-measure on
  the live corpus** — a change that makes transcripts less faithful now shows up as pages falling back to
  Document Intelligence, not as lost data, and it is silent unless you look at `PagesRejected`.
- ‼️ **EX-09's figure splicing.** Anchors go back where they stood, carry their own text, and **never
  re-order** — the PDF image lane binds markers to DI's figures by reading-order ordinal. Reading-order work
  is exactly what could break this. **A figure's own text is excluded from the conservation baseline**, so
  EX-04 and EX-09 compose; do not "simplify" that away.
- ‼️ **EX-15's shape comparison.** Inheritance of column labels needs a matching block shape. Shape
  inference for PROMOTING a header stays banned (R1) — `LooksLikeALabelRow` answers YES to `Colour | 60.00`.
- **EX-08** — a card's overlap page comes from a per-sentence page list. Guarded by a 41-size sweep. **Do
  not simplify it.**
- **EX-19** — an oversized description is SPLIT, never truncated, and every piece keeps the picture's handle.
- **EX-13** — grounding rides the EmbedText only, never the stored Content, and its room is RESERVED.
- **EX-22** — repeated prose collapses only at 3+ sections; **tables never collapse**.
- **EX-06** — `ForceFresh` bypasses BOTH the banked parse artefact AND the business-wide caption reuse.
  ‼️ EX-12 added a THIRD reuse (a per-run perceptual fingerprint). It is in-run only, so `ForceFresh` is
  unaffected — but **if you make it persist, it must honour `ForceFresh` too.**
- ‼️ **`TranscribePromptVersion` is part of the vision page-cache key.** Change the transcription prompt and
  bump it, or banked pages from the old prompt replay for ever.

---

## 8. YOUR CLOSING DUTIES — none optional

1. **A zero-error build gates every test run.** A stale binary "passes".
2. **Every guard sabotage-proven** (§6).
3. **Live-data verification**, with the measure stated and honest about §5's limits.
4. ‼️ **A full 11-dimension audit of your own changes, and fix everything it finds**: correctness ·
   concurrency & idempotency · failure and partial-failure paths · cost and performance (RU, AI calls, index
   size) · security and tenancy isolation · limits and what happens at them · observability (does an
   operator actually learn?) · localization · test quality (can each guard actually fail?) · config hygiene ·
   docs/skill/memory currency. ‼️ **Session C's audit found six defects in its own already-green code** —
   including one that would have raised a spurious admin alert on every legitimately blank page. Do it by
   reading your own diff line by line, not by re-running the tests.
5. **Full suites green in ONE in-tree run at the end.**
6. **Update the `clinqet-voice-assistant` SKILL in ALL FOUR copies** (`.claude/skills/`, `.github/skills/`,
   `.agents/skills/`, `.cursor/rules/`), the **memory entry**, `PLAN.md` and `TRIAGE-AND-STATUS.md`.
7. ‼️ **WRITE `SESSION-E-PROMPT.md`** in this folder for the session after you — **the ETag programme
   (#7 / Q3-A)**, whose analysis is already banked in `SESSION-HANDOVER-2026-09-04.md` §4.1 and must not be
   re-derived. Follow `PLAN.md` §8, and **include the instruction that it writes the prompt after it in
   turn.** ‼️ **The prompt you write MUST carry duties 1–9 of this section forward verbatim — above all
   duty 4, the full 11-dimension audit AND fixing everything it finds.** A session that inherits a prompt
   without that duty will skip it, and the audit is where every session in this programme has found its
   worst defects in code that was already green. ‼️ **Paste that prompt into the chat as well as writing
   the file.**
8. **Leave the tree clean** and LOOK at `git status --porcelain` in every repo you touched. ‼️ A concurrent
   session's files will be in there too — identify yours precisely and say which are which.
9. **The owner pushes and deploys. Never `git push`.**

---

## 9. HOW TO TALK TO THE OWNER

- **Plain language first**, then the solution, then the schema/infrastructure position, then your
  recommendation. They will ask "explain it to me super easy and simple" and they mean it. Give **options
  with a recommendation** and let them confirm each one.
- **Present the §0.7 table and WAIT** for any schema change. **Ask before ANY infrastructure.**
- When you find a second defect while fixing the first, **say so and flag it separately** rather than
  quietly widening scope.
- **Report failures faithfully.** If a guard passed for the wrong reason, say that. If a measurement you
  gave earlier was wrong, correct it plainly and move on.

---

## 10. ‼️ THE MISTAKES SESSION C MADE — do not repeat them

1. ‼️ **I trusted the plan over the code.** Two of my nine items were already fixed — one by a commit that
   landed **after** the plan was written. **Read the code first, every time.**
2. ‼️ **I nearly measured the wrong thing.** A character-coverage ratio looked like the obvious fidelity
   check, and the live data showed a perfect transcript losing 32.5% of its characters. **Measure the thing
   the caller can be hurt by — facts — not a proxy for it.**
3. ‼️ **I asserted a "regression" I had reasoned about but never tested**, wrote a fix for it, and a
   sabotage proved the branch was unreachable. **If you cannot write a failing test for it, it is not real.**
4. ‼️ **Two of my guards were vacuous** and only a passing sabotage exposed them. **Ask of every guard: what
   exactly differs between pass and fail, and does my assertion touch that?**
5. ‼️ **I ran a test against a stale binary** and briefly believed the result. **Check the build first.**
6. ‼️ **I let two fixes fight.** EX-09 preserves a figure's text; EX-04's gate then demanded the transcript
   reproduce that same text and rejected good pages. **When you ship two changes to one lane, test them
   together, not only apart.**
7. ‼️ **My first EX-09 implementation put a figure that OPENED a page at the END of it** — and only the live
   run showed it, because every unit fixture happened to have prose before the figure. **Run the real
   corpus, not just the fixtures.**
