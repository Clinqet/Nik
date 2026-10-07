# Session E — the ETag programme (#7 / Q3-A)

> Written 2026-09-06 by Session D, which closed **EX-07, EX-17 and EX-18**, and found three defects neither
> audit had named: the flattener was indexing a drawing's **geometry** as prose, a **partial cell merge
> answered the money column with a ratio**, and a chart's numbers were being thrown away entirely.
> ‼️ **Read `PLAN.md` in this folder FIRST — it is the authority, and §1 now records 31 decisions
> (D1–D31) you must not re-open.**

---

## 0. READ THESE, IN THIS ORDER, BEFORE TOUCHING A FILE

1. **`C:\Nik\Data\knowledge-flow-source-review\PLAN.md`** — the decision register (§1, D1–D31), the four
   rules for every session (§0), what the live data can and cannot prove (§6), how to work in this tree (§7),
   and the closing duties (§9).
2. **`C:\Nik\CLAUDE.md`** — all of it. Especially §0.6, §0.7, §0.8, §0.14, §0.16, §0.18, §0.19.
3. **`SESSION-HANDOVER-2026-09-04.md` §4.1** — ‼️ **the ETag analysis is ALREADY BANKED THERE. DO NOT
   RE-DERIVE IT.** It carries the counts, the design agreed in principle, and the two approaches explicitly
   rejected. Re-measuring it is waste; your job is to BUILD it.
4. **`TRIAGE-AND-STATUS.md`** — the scoreboard, and "What Session D learned the hard way".
5. The **`clinqet-voice-assistant`** SKILL — its last two sections are Sessions C and D and they constrain you.

---

## 1. YOUR SCOPE — one item, and it touches MONEY

**`CosmosDbRepository.UpdateItemAsync` re-reads an item to obtain its CURRENT ETag, then writes the caller's
STALE object with it.** The precondition therefore passes *by construction*, and the 412 retry repeats the
same pattern. It looks like a working concurrency guard and it protects nothing — it turns a *detected*
conflict into a *silent overwrite*.

| Fact (banked — do not re-measure) | Value |
|---|---|
| Production call sites through the broken method | **~132** |
| Files containing them | **40** |
| Files that ALREADY handle a real 412 | **3** — `OnboardingProgressService`, `BookingTimeoutProcessor`, `BookingAutoCompletionProcessor` |
| Files with NO conflict handling | **37** |
| Repository wrappers delegating to it | 26, across 22 repositories |

‼️ **The strongest evidence the honest fix is right:** `OnboardingProgressService` already catches
`PreconditionFailed` and refetches, with the comment *"base repo retries 3x on 412 internally"*. **The code
was written expecting this to work. The base repository silently defeating it is the anomaly.**

### The design already agreed in principle (owner: "full best practice, no patch, fixed in ALL the places")

- `UpdateItemAsync(item, pk)` → `IfMatchEtag = item.ETag`; on 412 **throw**, never blind-retry. Most call
  sites need **no change** — they already `Get` → mutate → `Update`, so they inherit a genuine conditional
  write, and `BaseController` already maps `PreconditionFailed` → HTTP 412 + `Error_DbConcurrencyConflict`.
- Add `UpdateItemWithRetryAsync(id, pk, Func<T,bool> mutate)` — a REAL read-modify-write CAS that recomputes
  from fresh state on each attempt. ‼️ **The correct pattern already exists in this codebase** as
  `CosmosDbRepository.PatchStableArrayItemByIdAsync` — copy its shape rather than inventing one.
- ‼️ **Do NOT field-diff and re-apply generically.** Considered and REJECTED: across 30+ entity types it is
  guesswork, and it can merge two conflicting intents into a third state neither writer asked for.
- ‼️ **`StampUpdatedBy(item, existing)` needs the stored `createdBy*`** — "historical attribution is NEVER
  rewritten". **Keep the internal read for `ProviderOwnedEntity`** or attribution regresses. The RU saving is
  not the point and must not drive the design.
- Service Bus processors need no special handling: a 412 fails the message, redelivery re-reads fresh and
  converges. That IS the correct retry.

### ‼️ Why this needs its own session, and what "done" means

The flows are **bookings and invoices — money.** CLAUDE.md §0.8 therefore makes **integration coverage on the
REAL engines mandatory**: EF InMemory cannot enforce what you are changing. `Clinqet.API.UnitTests` +
`Clinqet.API.IntegrationTests` (Testcontainers: SQL Server + the Cosmos emulator) **are the point of this
session**, not an afterthought. ‼️ **Shipping this half-proven trades silent data loss for visible unhandled
412s on money paths — strictly worse than today.** A concurrency fix with no concurrent test proves nothing:
**run the racing test at least three times** (memory `test-captures-across-parallel-fanout`).

---

## 2. ‼️ WHAT YOU MUST ASK BEFORE YOU BUILD

**Stop and ask. Do not guess, and do not "pick the sensible default and note it."**

### 2.1 Infrastructure — ALWAYS the owner's call (PLAN §0.3)
A new Service Bus queue · storage container or lifecycle rule · any Azure resource · a new
`local.settings.json` key · a new timer/trigger · a new Cosmos container or partition key · a new search
index, alias, analyzer, scoring profile or synonym map · anything needing ARM or `deploy.ps1`.
‼️ **The default answer is "no new infrastructure."** Present what it is, what it costs, what breaks without
it, **and the no-new-infrastructure alternative** — then WAIT.

### 2.2 Schema — the CLAUDE.md §0.7 table, then WAIT
Any new SQL column/table/index · **any new field on a Cosmos entity** · any new search index field, analyzer
or scoring change. Present the full table and wait for an explicit yes **in your own session**. A plan
document saying "add X" is NOT approval.

‼️ **Sessions C and D each thought they had §0.7 decisions to hand over and each turned out to need NO schema
at all** (D23, D24, and D25/D26/D27 in turn). **Measure the alternative and read the retrieval path before
you reach for a table of your own.**

### 2.3 Anything that changes what a provider or caller EXPERIENCES
A 412 that used to be a silent success and now surfaces as an error IS such a change. **Show the owner which
surfaces can now show a conflict, and what the user sees, before you ship it.**

### 2.4 ‼️ A prior session's TEST can encode a judgement rather than a ruling
Session D found `Docx_APartialSpan_StillCoversTheColumnsItSpans` pinning the exact behaviour that produced a
false money answer. It was in no decision register, so it was overridden deliberately and its replacement
pins the new contract. **Check the register (PLAN §1) before assuming an existing test is load-bearing — and
say so plainly when you override one.**

---

## 3. CODING STANDARDS — non-negotiable

- **Fix the CLASS, never the call site.** Grep every site.
- **Do not over-complicate. The cheapest correct answer wins.** Premature abstraction IS over-complication.
- **No workarounds.** No `--no-verify`, no swallowed exceptions, no `// TODO`, no skipped tests.
- **No verbose comments (§0.14).** Default is NO comment.
- **Pre-production: never write backward-compatible code, a feature flag, an old path or a backfill.**
- **Thread safety.** ‼️ A capture across a parallel fan-out is CONCURRENT, never a plain `List`.
- **A setting belongs only in the host that reads it**, class default mirroring `appsettings.json` exactly.
- **No hardcoded user-facing text.** **Every `IMemoryCache` write sets `Size = 1`.** **Never a cross-partition
  Cosmos query.**
- **Tests live in the suite of the HOST that runs the code (§0.18)** — extraction/ingest = **Functions**;
  voice retrieval = **MCP**; controllers, repositories and the money paths = **API**.

---

## 4. ‼️ HOW TO WORK IN THIS TREE — another session IS live

- **Build into a private folder:** `-p:UseArtifactsOutput=true -p:ArtifactsPath="<scratchpad>/build"`
- ‼️ **A compile error in a file you never touched means a peer is mid-write — retry and CARRY ON.** Sessions
  C and D both hit this repeatedly; every retry was eventually clean. **Never "fix" their file.**
- ‼️ **At the end, attribute every failure.** Session D's final run had 5 failures across API, MCP and
  Communications and **every one was the peer's**, in files it never touched (`SearchKnowledgeTool.cs`,
  `BusinessSearchToolBase.cs`, `ProviderCatalogSearchService.cs`, `VisionDocumentTranscriptionService.cs`).
  `git status` in each repo is the evidence — use it, and say which are which.
- ‼️ **Isolated builds make ~127 convention tests fail LOUDLY** (they resolve a scan root from the binary and
  cannot). That is correct behaviour. Clear with ONE in-tree run at the end — but **verify** it is only that.
- ‼️ **NEVER `git checkout` / `restore` / `reset` / `stash` / `clean`.** Snapshot to the scratchpad, restore
  with `cp`, **just in time**.
- ‼️ **ALWAYS pass the project/solution path explicitly to `dotnet build` and `dotnet test`.** Session D lost
  time when a failed `cd` left the shell inside a repo and a probe file was written into a test project — it
  became the test assembly's ENTRY POINT and broke the runner with *"Test process did not return valid JSON.
  Output: done"*.
- ‼️ **Workflow subagents share your scratchpad.** 49 of them wrote there in Session D and removed its probe
  project mid-run. Do not assume a scratchpad directory survives a background workflow.
- **Never write a scratch file inside a repo. The owner pushes and deploys.**

---

## 5. ‼️ LIVE-DATA TESTING — mandatory, and honest about its limits

Credentials READ AT RUNTIME, never copied: `C:\Nik\cosmosindexsetup\appsettings.{ca,in}.json`.
‼️ Per **D14** the committed keys are **sandbox keys, ACCEPTED** — never report, rotate or "fix" them.

- **Cosmos:** `Clinket-nonprod`; containers suffixed `-dev`, pk `/businessId`, every query partition-scoped.
  ‼️ No server-side `COUNT`/`GROUP BY` through the gateway. ‼️ The SDK uses **Newtonsoft** — query into
  `JObject`, not `JsonElement`.
- ‼️ **Measure with the code that SHIPS**, never a script that imitates it.
- ‼️ **A census over a whole tree is NOT the reachable set** (Session D wrote a guard from one and the corpus
  diff proved it vacuous).
- ‼️ **DO NOT rebuild the search index** (D6 / §5.4). The owner asked about this on 2026-09-06 and the answer
  was **no, not yet**: the fixes are undeployed, so a rebuild now would re-ingest through the OLD parser and
  need doing twice. One rebuild ever, after the whole audit is fixed.

---

## 6. ‼️ THE SABOTAGE DISCIPLINE

Break the fix → RED on **exactly** the right case → restore from a just-in-time snapshot (`cp`) →
byte-identical → green. One at a time.

- ‼️ **GATE EVERY SABOTAGE ON A ZERO-ERROR BUILD.** A stale binary "passes" and means nothing.
- ‼️ **If a sabotage PASSES, the guard or the code is wrong** — never the sabotage.
- ‼️ **A guard must assert the thing that actually differs**, and **a guard handed the same input on both
  sides proves nothing.** Session D deleted one of its own guards for exactly this.
- ‼️ **Prefer a SWEEP to a pinned case. Run concurrency guards three times.**

---

## 7. WHAT YOU INHERIT AND MUST NOT DROP

**In-tree at Session D's close: Communications 3 968 · API 11 726 · MCP 869 · cosmosindexsetup 181.**
‼️ **API and Communications each carried failures owned by a CONCURRENT session — attribute, do not adopt.**
At close they were all the peer's `PromptFingerprint` work: a new property on `VisionTranscriptionSettings`
plus a changed vision cache key, with the appsettings key and two tests not yet updated. If those are green
when you start, the peer finished; if they are red, they are still theirs.

**#7 (this session) is the last MAJOR engineering item.** EX-01–EX-33 and #1–#3, #5, #6, #8–#22 are done or
declared limits — but ‼️ **four small residuals are genuinely NOT built and must not be reported as closed**:

| residual | state |
|---|---|
| **EX-18 SmartArt node/edge ORDERING** | A diagram's text is read as a list; its **edges and order semantics are not**. The audit asked for them. Not built — no file in the corpus has a diagram whose edges carry meaning |
| **EX-18 rendered-image fallback** | The audit asked for a rendered picture of a visual structure whose semantics cannot be reconstructed. **Not built** — it would need a renderer and a paid description per chart; propose and get approval before attempting |
| **EX-07 / EX-17 PDF + floating-textbox visual order** | Our code consumes only Document Intelligence's flattened markdown; word/line polygons are never requested. ‼️ **No two-column PDF exists in the corpus**, so the failure cannot be reproduced or measured. DOCX floating text boxes still read at their anchor's position |
| **`w:vanish` via a STYLE** | Direct run formatting is excluded; style-based hiding is not resolved (`Flatten` is static and has no `StyleDefinitionsPart`). No corpus file uses it |

‼️ **A behaviour change Session D accepted and you should know about:** reading chart parts, headers and
footers means a MALFORMED one can now throw and fail a parse that previously succeeded, because those parts
were never touched before. It is consistent with how footnotes have always behaved and was accepted on that
ground — but it is a new failure mode, and it is not covered by a test.

‼️ **The three findings deliberately NOT fixed (D31)** — do not re-open them without new evidence:
XLSX side-by-side tables welding · a "Cons" list read under "Pros" · XLSX stranded labels. Each fix was
measured **worse than its defect**. In particular the "Cons" one **reversed Session D's own recommendation**:
the only structural trigger available fires on a real `$0.00` money row, so acting on it would strip labels
from live prices.

Most likely to be disturbed by YOUR work — **the ETag change touches the base repository every entity uses**:

- ‼️ **`StampUpdatedBy` / `ProviderOwnedEntity` attribution** — the internal read must stay, or `createdBy*`
  is rewritten. This is the single easiest thing to break while "optimising away" the read.
- ‼️ **`PatchStableArrayItemByIdAsync`** — the CAS pattern you are copying. Do not "unify" it into your new
  helper without proving the array semantics survive.
- ‼️ **The atomic-counter paths** (`RefreshSubcategoryCountsAsync`, the usage meters) — they use PATCH, not
  replace, and must NOT be routed through the new conditional update.
- ‼️ **#9's counter refresh (D23)** — the delta is a **MARKER, never an amount**, and a zero delta is DROPPED.
- ‼️ **The cached-counter monotonic store** (memory `cached-counter-monotonic-store-2026-08-07`) — increments
  RETURN out of commit order.
- **The knowledge parser files Session D changed** (`KnowledgeOoxmlText`, `KnowledgeDocumentParser.OpenXml`,
  `.Pptx`, and the new `KnowledgeChartReader`) — untouched by ETag work, but their **20 new guards** live in
  `Clinqet.Communications.UnitTests/Knowledge/KnowledgeExtractionFidelityTests.cs`.
- **Five sample files Session D created** in `C:\Nik\Data\SampleData` (`Clinket_Chart_Deck.pptx`,
  `Clinket_ShapeFill_Deck.pptx`, `Clinket_Chart_Prices.xlsx`, `Clinket_Chart_Report.docx`,
  `Clinket_TwoColumn_CV.docx`) — they carry the only charts, shape fills and two-column layout the corpus
  has. **Do not delete them; they are the evidence for EX-18.**

---

## 8. YOUR CLOSING DUTIES — none optional

1. **A zero-error build gates every test run.**
2. **Every guard sabotage-proven** — RED on exactly the right case, restored byte-identical, green again.
3. **Live-data verification, honest about §5** — and honest about what it cannot cover.
4. ‼️ **A full 11-dimension audit of your own changes, and fix everything it finds**: correctness ·
   concurrency & idempotency · failure and partial-failure paths · cost and performance (RU, AI calls, index
   size) · security and tenancy isolation · limits and what happens at them · observability (does an operator
   actually learn?) · localization (never a raw English string to a provider or caller) · test quality (can
   each guard actually fail?) · config hygiene (a setting only in the host that reads it) · docs, skill and
   memory currency. **Do it by reading your own diff line by line, not by re-running the tests.**
   ‼️ **Session C's audit found EIGHT defects in its own already-green code; Session D's found three,
   including a scratch file it had written into a repo.** This duty is not a formality.
5. **Full suites green, in ONE in-tree run at the end** — and **attribute every failure** (§4).
6. **Update the SKILL ×4, the memory entry, `PLAN.md` and `TRIAGE-AND-STATUS.md`.**
7. ‼️ **WRITE `SESSION-F-PROMPT.md`** for the session after you, covering: the exact items with their finding
   text **verified against the code**; which files it owns and which belong to a concurrent session; every
   decision already made; **what it must ASK before building** (every design gate and every infrastructure
   gate); the coding standards, the sabotage discipline, the live-data duties and this closing audit,
   restated so the prompt stands alone; the suite counts it inherits.
   ‼️ **The prompt you write MUST carry duties 1–9 forward VERBATIM — above all duty 4, the audit AND fixing
   everything it finds. A session that inherits a prompt without that duty will skip it.**
   ‼️ **It must also carry THIS instruction — to write the prompt after it in turn.** The rule is
   self-propagating and dies the moment one session drops it.
8. ‼️ **Paste the prompt into the chat as well as writing the file** — the owner copies it from there
   (memory `feedback-deliver-prompt-in-chat-not-only-a-file`).
9. **Leave the tree clean.** `git status --porcelain` must hold nothing you did not intend; a peer's files
   will be there too — **say which are which**. **Never `git push`.**

---

## 9. HOW TO TALK TO THE OWNER

Plain language first, then the solution, then the schema/infrastructure position, then your recommendation.
Give **options with a recommendation** and let them confirm each. Present the §0.7 table and WAIT. Flag a
second defect separately rather than widening scope. **Report failures faithfully** — including your own.

---

## 10. ‼️ THE MISTAKES SESSIONS C AND D MADE — do not repeat them

1. ‼️ **Trusting the plan over the code.** Session C found two of nine items already fixed. Session D found
   the audit text had named **neither** of the two worst defects it shipped.
2. ‼️ **Measuring the wrong thing.** A character ratio is not a fidelity measure (D15) — a perfect transcript
   lost 32.5% of its characters. **Measure facts.**
3. ‼️ **Proposing schema before measuring the alternative.** Three times now the field turned out unnecessary.
4. ‼️ **Asserting a "regression" reasoned about but never tested.** If you cannot write a failing test for
   it, it is not real.
5. ‼️ **Vacuous guards.** Ask of every guard: what exactly differs between pass and fail, and does my
   assertion touch that? Session D's element census suggested a guard the corpus diff proved worthless.
6. ‼️ **Running a test against a stale binary** and briefly believing it.
7. ‼️ **Letting two fixes fight.** Test changes to one lane together, not only apart.
8. ‼️ **Trusting fixtures over the real corpus.** Session C's first EX-09 attempt put a page-opening figure
   at the END; only the live run showed it.
9. ‼️ **Relying on the shell's persisted working directory.** Pass paths explicitly.
10. ‼️ **Recommending a fix from a finding's SUMMARY instead of its DATA.** Session D told the owner it would
    fix the "Cons under Pros" bug, then measured the only available trigger and found it fires on a real
    `$0.00` money row. **The recommendation was withdrawn and the owner told plainly.** Judge a fix by what
    its trigger does across the whole corpus, not by how reasonable the finding sounds.
11. ‼️ **Declaring something impossible when the missing input can simply be MADE.** Session D reported EX-18
    unbuildable because no file in the corpus had a chart — correct about the evidence, wrong about the
    options. The owner had already said files could be created. **When you are blocked on evidence, say what
    evidence would unblock you and offer to construct it.**
12. ‼️ **Believing an audit's illustrative example.** EX-07's headline case — "a two-column résumé
    interleaves employment with skills" — is **PROVEN NOT REAL for Word**: `w:cols` is a flow, not a layout.
    A built two-column CV extracts in perfect order.

### ‼️ THE RULE D31 ADDED, AND IT GENERALISES BEYOND EXTRACTION

**A fix that trades a narrow wrong answer for a broad loss of correct ones is not a fix.** Three real,
verified defects were deliberately left alone on exactly this ground. Apply it to the ETag work too: a
conditional write that turns a rare silent overwrite into a **frequent** unhandled 412 on a money path would
be the same mistake in a different costume.
