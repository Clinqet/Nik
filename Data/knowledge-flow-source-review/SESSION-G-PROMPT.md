# Session G — the declared limits, and whatever the owner ranks next

> Written 2026-09-07 by Session F, which closed **the last four residuals** plus **eight write-path defects**
> the residual list never named.
>
> ‼️ **Session F's headline lesson: the handover it inherited was WRONG about a live surface, and the
> "obvious" fix for the biggest remaining item would have been a REGRESSION.** The prompt said *"every
> current upsert target is a plain `BaseEntity` except `BusinessCustomerRepository`"* — `Availability` is a
> `ProviderOwnedEntity` upserted from **three** API call sites, and every weekly-hours save was silently
> rewriting its own creator. And EX-07's PDF half, which four sessions had listed as "real but unmeasurable",
> **measured NOT REAL** on the first billed call. ‼️ **Read the code. Create the evidence. Measure before you
> build.**
>
> ‼️ **Read `PLAN.md` in this folder FIRST — it is the authority. §1 now records 43 decisions (D1–D43) you
> must not re-open.**

---

## 0. READ THESE, IN THIS ORDER, BEFORE TOUCHING A FILE

1. **`C:\Nik\Data\knowledge-flow-source-review\PLAN.md`** — the decision register (§1, **D1–D43**), the four
   rules for every session (§0), what the live data can and cannot prove (§6), how to work in this tree (§7),
   and the closing duties (§9).
2. **`C:\Nik\CLAUDE.md`** — all of it. Especially §0.6, §0.7, §0.14, §0.16, §0.17, §0.18, §0.19, §0.20.
3. **`TRIAGE-AND-STATUS.md`** — the scoreboard. The four residuals are now CLOSED; what remains is declared
   limits and whatever the owner ranks.
4. The **`clinqet-voice-assistant`** SKILL — its last four sections are Sessions C, D, E and F and they
   constrain you. The **`clinqet-cosmos-data`** SKILL's CONCURRENCY section is the **write-shape contract**;
   Session F extended it with the upsert's three obligations and the merge pattern.

---

## 1. WHAT IS ACTUALLY OPEN

‼️ **There is no known unfixed defect in this programme.** Every finding in `AUDIT-FINDINGS.md` (#1–#22) and
`EXTRACTION-PASSAGE-AUDIT.md` (EX-01–EX-34) is closed, declared a limit with a measured reason, or proven not
real. What follows is the honest residue.

### Declared limits — do NOT "fix" these without new evidence

| limit | why, measured |
|---|---|
| **DI reads a two-column flow as a 2-column TABLE** (D42) | ‼️ On the measured page a column flow and a real table are **geometrically identical** (y values match to 0.01in), so any further fix is shape inference — banned by R1, which has already put a price into a column name. The harm (a false header) is closed by the `<th>` gate. ‼️ Whether DI emits a table at all **depends on line wrapping**: the same content with longer lines produced no table and perfect prose order |
| **`w:vanish` in document DEFAULTS** (D39) | Deliberately not resolved. One stray attribute there would empty a WHOLE document, and a census of 54 corpus `.docx` found `w:vanish` **nowhere at all** |
| **`w:vanish` on a run inside `mc:Choice`** (D39) | Inside an `mc:Choice` the SDK types nothing, so the run is an `OpenXmlUnknownElement` and neither D26's direct check nor D39's style check reaches it. Closing it means parsing `rPr` by local name — substantial, and no file needs it |
| **The spec's toggle XOR for `w:vanish`** (D39) | The union rule was chosen deliberately: reading a toggle wrong **speaks a price the author hid to a caller**, so the fail-closed answer wins |
| **XLSX side-by-side tables · "Cons" under "Pros" · XLSX stranded labels** (D31) | Each fix measured WORSE than its defect |
| **EX-24, EX-25, EX-28, EX-32, EX-34** | Declared limits of the current design |
| **EX-30 · #4** | Proven not real · the owner said to ignore it |
| **Slide-number placeholders** | Still emitted as their own block. Furniture; low |
| **A malformed chart/header/footer/diagram part can now fail a parse that previously succeeded** | Those parts were never touched before. Consistent with footnotes; **not covered by a test** |

### Not built, and needs the owner's approval before it is

| item | what it needs |
|---|---|
| **EX-18 rendered-image fallback** | A renderer **plus a paid AI description per chart**. ‼️ An AI-spend design decision — present the cost and WAIT (§2.1) |
| **Finding a photo by an exact product CODE** | The nearby words feed the vector only, never the searchable `content`, so `TL1255C` may not pull the photo up. ‼️ **EXAMINED AND DECLINED (D43).** Those words are already in the index as the neighbouring TEXT card, so nothing is unfindable — only the photo may not be offered alongside. A field would duplicate indexed words and let the photo card compete with the card holding the real answer. **Not parked against the rebuild; closed** |

### Known-real, verified by Session F, and DELIBERATELY left

| item | why |
|---|---|
| **`BulkInsertAsync` is dead surface** | Two overloads on `ICosmosDbRepository` with **zero callers** in any Clinqet repo (the `Project\` hits under `C:\Nik` are an unrelated legacy tree). It also lacks `StampCreatedBy` and the etag restamp. ‼️ **Deleting it is right (§22.2) but it is unreachable, so a guard for it would be vacuous** — raise it as its own small change |
| **A 429 answer carries no `Retry-After`** | Both `BaseController` and `GlobalExceptionHandler` map Cosmos 429 → HTTP 429 with no header. Pre-existing, and a client-contract decision |
| **The identity sync sends `FirstName = "Guest"`** | A nameless booking sends the literal `"Guest"`, which is non-blank and therefore overwrites a real stored name. ‼️ **Treating a specific string as absent is vocabulary inference, banned by R1** — and `"Guest"` is a legitimate name for a walk-in. The mismatch admin alert covers awareness |

---

## 2. ‼️ WHAT YOU MUST ASK BEFORE YOU BUILD

**Stop and ask. Do not guess, and do not "pick the sensible default and note it."**

### 2.1 Infrastructure and AI spend — ALWAYS the owner's call (PLAN §0.3)
A new Service Bus queue · storage container or lifecycle rule · any Azure resource · a new
`local.settings.json` key · a new timer/trigger · a new Cosmos container or partition key · a new search
index, alias, analyzer, scoring profile or synonym map · anything needing ARM or `deploy.ps1` · **a new
per-document or per-item paid AI call.**
‼️ **The default answer is "no new infrastructure."** Present what it is, what it costs, what breaks without
it, **and the no-new-infrastructure alternative** — then WAIT.

‼️ **A single measurement call is different from a per-document cost.** Session F spent **four**
`prebuilt-layout` calls to settle EX-07 and that was proportionate; a design that bills once per uploaded
chart is not, and needs the owner.

### 2.2 Schema — the CLAUDE.md §0.7 table, then WAIT
Any new SQL column/table/index · **any new field on a Cosmos entity** · any new search index field, analyzer
or scoring change. Present the full table and wait for an explicit yes **in your own session**. A plan
document saying "add X" is NOT approval.

‼️ **Sessions C, D, E and F each expected to need schema and each needed NONE** (D23/D24, D25–D27, D32–D34,
D35–D42). **Measure the alternative and read the retrieval path before you reach for a field of your own.**

### 2.3 Anything that changes what a provider or caller EXPERIENCES
**Show the owner which surfaces change and what the user actually sees, before you ship it** — and check the
*frontend*, not just the API. Session E found a reworded message would never have reached a provider because
`showError` discarded it; Session F found seven service modules discarding the HTTP status.

### 2.4 ‼️ A prior session's TEST can encode a judgement rather than a ruling
Session D overrode `Docx_APartialSpan_StillCoversTheColumnsItSpans`; Session E rewrote
`UpdateBusinessAddresses_ReStampFailsMidLoop_DoesNotPersistProfile`; Session F rewrote
`UpsertBusinessCustomerAsync_AssignsCompositeIdAndCallsUpsert` (it asserted a blind upsert that is now a
read-modify-write) and changed two `Assert.ThrowsAsync<InvalidOperationException>` to the new contract
exception. **Check the register (PLAN §1) before assuming an existing test is load-bearing — and say so
plainly when you override one.**

### 2.5 ‼️ An exception TYPE is part of the user-facing contract in this codebase
`InvalidOperationException`'s **Message IS a localization key**: 65 controller catch blocks pass it to
`GetLocalizedString`, and `LocalizationService` returns an unknown key **verbatim**. **Before choosing an
exception type, grep what the codebase already MEANS by it.** A programming error belongs in
`Clinqet.Core.Exceptions.PersistenceContractException` (derives from `Exception` ⇒ a localized 500).

---

## 3. CODING STANDARDS — non-negotiable

- **Fix the CLASS, never the call site.** Grep every site. ‼️ Session F's upsert fix corrected two live
  surfaces with **no call-site change at all**; its `apiError.js` seam replaced seven copies with one.
- **Do not over-complicate. The cheapest correct answer wins.** Premature abstraction IS over-complication.
  ‼️ Before adding a helper, check whether one exists — and ‼️ **before adding a GATE, check whether the same
  gate already exists in a sibling lane.** The `<th>` defect was a gate present in three lanes and missing
  from the fourth.
- **No workarounds.** No `--no-verify`, no swallowed exceptions, no `// TODO`, no skipped tests.
  ‼️ **Never synthesise an exception to reach a `catch` block** — Session F wrote that and rewrote it.
- **No verbose comments (§0.14).** Default is NO comment. One short line, only for a non-obvious WHY.
- **Pre-production: never write backward-compatible code, a feature flag, an old path or a backfill.**
- **Thread safety.** ‼️ A capture across a parallel fan-out is CONCURRENT, never a plain `List`.
- **A setting belongs only in the host that reads it**, class default mirroring `appsettings.json` exactly.
- **No hardcoded user-facing text.** **Every `IMemoryCache` write sets `Size = 1`.** **Never a cross-partition
  Cosmos query.**
- **Tests live in the suite of the HOST that runs the code (§0.18)** — extraction/ingest = **Functions**;
  voice retrieval = **MCP**; controllers, repositories and the money paths = **API**.
- ‼️ **Never lose a word to a filter.** If you exclude something from an extraction, **re-emit it somewhere**,
  and check EVERY root that filter runs on (body, table, header, footer, footnote, endnote). Session F's own
  audit caught a header's floating box being deleted outright.

### ‼️ The write-shape contract — do not regress it

| The write | Shape |
|---|---|
| Read → mutate → write in one request, conflict SHOULD reach the user | `UpdateItemAsync` (412 → `Error_DbConcurrencyConflict`) |
| A counter, aggregate, commutative append, idempotent stamp | `UpdateItemWithRetryAsync` |
| The entity is held across a slow call (AI, blob upload, notification fan-out) | `UpdateItemWithRetryAsync`, re-evaluating the guard **inside** the mutate |
| A narrow, stable field set | an atomic `PatchItemAsync` — removes the conflict instead of reporting it |
| A deliberate unconditional write (a denormalized mirror, an idempotent marker) | `UpsertItemAsync` |
| Projecting an EXTERNAL source onto a provider-owned row | **merge, never replace** — `MergeBusinessCustomerAsync` is the pattern |

‼️ **A CAS mutate MUST be idempotent.** A write can land while its acknowledgement is lost; Polly re-sends,
gets a 412, and the mutate runs again on a document that already has the change. `list.Add` without an
existence check **duplicates**.

‼️ **Every write path leaves the caller's instance carrying the CURRENT etag** — `AddItemAsync`,
`UpsertItemAsync` and the conditional replace all restamp it. `AddItemAsync` shipped without that and broke
**create → mutate → update** deterministically.

‼️ **`UpsertItemAsync` is NOT a blind write.** It reads the stored document whenever the caller supplied an
id, because that read carries `createdBy*` forward, refuses a foreign document family, and keeps `CreatedAt`.
Removing that read re-breaks `Availability` and `BusinessCustomer`.

---

## 4. ‼️ HOW TO WORK IN THIS TREE — other sessions ARE live

- **Build into a private folder:** `-p:UseArtifactsOutput=true -p:ArtifactsPath="<scratchpad>/build"`
- ‼️ **A compile error in a file you never touched means a peer is mid-write — retry and CARRY ON.** Never
  "fix" their file. Session F hit `ExtractedServiceDto.DescriptionParagraphs` errors and then **live merge
  conflict markers** in `ProviderSetupServiceWriter.cs`; both cleared on retry.
- ‼️ **A PEER MAY COMMIT YOUR WORK MID-SESSION.** Session F's `git status` went clean while it was still
  working: a concurrent session's commits (`f3ab066`, `40eed15`, `611f261`, `d32b3a7`, `081604f`, `9a2ca0f`)
  swept its files in under labels for other work. **Check `git log -- <file>`, not just `git status`**, and
  tell the owner which of their commits contain work they have not reviewed as yours.
- ‼️ **At the end, attribute every pending file.** Session F's peer owned `BusinessSearch*`, all five
  localization catalogues in three apps, `invoiceDue.js`, `sitemap.xml`, `MemberHandoverSqlTests.cs` and an
  untracked `OneAuthorPerStateTests.cs`. An **untracked** test file is almost certainly not yours.
  **Attribute; do not adopt.**
- ‼️ **Isolated builds make ~55 Communications + ~111 API convention tests fail LOUDLY** — they walk up from
  the binary to find source and cannot. That is correct behaviour. Clear with ONE in-tree run at the end, and
  **verify it is only that**.
- ‼️ **LINE ENDINGS ARE MIXED.** Most `C:\Nik` files are **CRLF**, some test files are **LF**. A scripted edit
  that assumes the wrong one **silently matches nothing** and reports success. ‼️ **Always print the
  occurrence count and require it to be exactly 1.** Detect per file; never assume.
- ‼️ **NEVER `git checkout` / `restore` / `reset` / `stash` / `clean`.** Snapshot to the scratchpad, restore
  with `cp`, **just in time**.
- ‼️ **ALWAYS pass the project/solution path explicitly to `dotnet build` and `dotnet test`.**
- ‼️ **Workflow subagents share your scratchpad.** Do not assume a scratchpad directory survives one.
- **Never write a scratch file inside a repo. The owner pushes and deploys.**

---

## 5. ‼️ LIVE-DATA TESTING — mandatory, and honest about its limits

Credentials READ AT RUNTIME, never copied: `C:\Nik\cosmosindexsetup\appsettings.{ca,in}.json` (Cosmos +
Search) and `C:\Nik\clinqetfuncations\Clinqet.Communications\local.settings.json` (Document Intelligence,
Speech, Storage). ‼️ Per **D14** the committed keys are **sandbox keys, ACCEPTED** — never report, rotate or
"fix" them.

- **Cosmos:** `Clinket-nonprod`; containers suffixed `-dev`, pk `/businessId`, every query partition-scoped.
  ‼️ No server-side `COUNT`/`GROUP BY` through the gateway. ‼️ The SDK uses **Newtonsoft** — query into
  `JObject`, not `JsonElement`.
- ‼️ **Docker IS available** and the Cosmos emulator Testcontainers fixtures work (`ClinqetApiFactory`,
  `FunctionAppFactory`). Session F ran 81 emulator tests in ~2 s once warm. **There is no excuse for skipping
  integration coverage on a money, schema or write-path change.**
- ‼️ **Document Intelligence is callable** with the shipping request shape:
  `{endpoint}/documentintelligence/documentModels/prebuilt-layout:analyze?api-version=2024-11-30&outputContentFormat=markdown`,
  header `Ocp-Apim-Subscription-Key`, body `{"base64Source": "..."}`, then poll `operation-location`.
  The knowledge lane's model/format come from `Voice:Knowledge:ExtractionModelId`/`ExtractionOutputFormat`.
- ‼️ **You can CREATE a PDF** — headless Chrome is at
  `C:\Program Files\Google\Chrome\Application\chrome.exe`: `--headless --disable-gpu --no-pdf-header-footer
  --print-to-pdf=out.pdf in.html`. CSS `column-count: 2` gives a genuine two-column page. `pdftotext` is on
  PATH for a free cross-check.
- ‼️ **Measure with the code that SHIPS**, never a script that imitates it. Session F built a throwaway
  console project in the scratchpad that referenced `Clinqet.Infrastructure` and called
  `ParseLayoutMarkdown` directly — that is the right shape, and it was deleted afterwards.
- ‼️ **A census over a whole tree is NOT the reachable set.**
- ‼️ **DO NOT rebuild the search index** (D6). One rebuild ever, after the whole audit is fixed.

---

## 6. ‼️ THE SABOTAGE DISCIPLINE

Break the fix → RED on **exactly** the right case → restore from a just-in-time snapshot (`cp`) →
byte-identical (**check the MD5**) → green. One at a time.

- ‼️ **GATE EVERY SABOTAGE ON A ZERO-ERROR BUILD.** Session E's `if (false)` sabotage produced 16 compile
  errors and proved nothing.
- ‼️ **A sabotage that does not APPLY is not a passing test.** **Always print the occurrence count and
  require it to be 1.** Session F caught two patterns that matched **zero** occurrences (an expression-bodied
  `=>` where it expected `return`, and a curly apostrophe in a markdown table row).
- ‼️ **If a sabotage PASSES, the guard or the code is wrong** — never the sabotage. Session C had three,
  Session E had one.
- ‼️ **A guard must assert the thing that actually differs.** Op counts, `Times.Once`, "a patch happened" all
  pass equally for fixed and broken code when the defect is in the VALUES.
- ‼️ **A guard handed the same input on both sides proves nothing**, and **a fake must model production**.
- ‼️ **A failing guard may be wrong about the DOMAIN, not the code.** Session F's first concurrency test had
  the identity sync overwrite a field the sync legitimately owns; the premise was wrong, not the fix.
  **Before "fixing" the code to satisfy a new test, ask whether the test states the truth.**
- ‼️ **Prefer a SWEEP to a pinned case. Run concurrency guards at least three times** (a `[Theory]` with
  three `[InlineData]`s), and **make the concurrency deterministic**: with N writers a writer is beaten at
  most N−1 times, so `N ≤ MaxConcurrencyRetries + 1` can never flake.

---

## 7. WHAT YOU INHERIT AND MUST NOT DROP

**Suite state at Session F's close, ALL IN-TREE and all measured, not estimated:**

| suite | result |
|---|---|
| `Clinqet.API.UnitTests` | **11 815 passed, 0 failed** |
| `Clinqet.Communications.UnitTests` | **4 019 passed, 0 failed** |
| `Clinqet.Mcp.UnitTests` | **878 passed, 0 failed** (Session E's single failure was a peer's and is gone) |
| emulator integration (API) | **81 passed** — `CosmosEtagConcurrencyIntegrationTests` (10) + `CosmosRepositoryCrudIntegrationTests` (29) + `KnowledgeDocumentCasIntegrationTests` + `CrossTenantAuthorizationTests` |
| partner web jest | **153 passed, 17 suites**, 0 ESLint errors |

‼️ **Most likely to be disturbed by your work:**

- ‼️ **`CosmosDbRepository`** — `UpdateItemAsync` / `UpdateItemWithRetryAsync` / `UpsertItemAsync` /
  `AddItemAsync` / `DeleteItemAsync` / `ReadOwnDocumentAsync` / `ReplaceWithPreconditionAsync`. **The etag
  restamp on all three write paths is load-bearing**, and so is the upsert's stored-document read.
- ‼️ **`StampCreatedBy` / `StampUpdatedBy` / `ProviderOwnedEntity`** — historical attribution is NEVER
  rewritten. `Availability` and `BusinessCustomer` are the two `ProviderOwnedEntity` upsert targets.
- ‼️ **`StorageFailureMapping`** — the ONE storage-failure→HTTP mapping, used by `GlobalExceptionHandler` and
  both `BaseController` handlers. Do not re-inline it.
- ‼️ **`PatchStableArrayItemByIdAsync`** and **the atomic-counter paths** (`RefreshSubcategoryCountsAsync`,
  the usage meters) — they use PATCH, not replace, and must NOT be routed through a conditional update.
- ‼️ **#9's counter refresh (D23)** — the delta is a **MARKER, never an amount**, and a zero delta is DROPPED.
- ‼️ **The cached-counter monotonic store** (memory `cached-counter-monotonic-store-2026-08-07`).
- ‼️ **`KnowledgeOoxmlText.Flatten`** — the allow-list, `excludeFloatingBoxes`, and `HiddenTextStyles`.
  Every DOCX root that excludes floating boxes MUST re-emit them.
- ‼️ **`KnowledgeDiagramReader`** — the safety-net sweep is what stops a malformed model losing words.
- ‼️ **The `<th>` header gate** in `KnowledgeDocumentParser.ReadHtmlTable` — one gate, four declarations.

**Session F's new guards:** 9 added to `CosmosRepositoryEtagTests.cs`, 5 to `GlobalExceptionHandlerTests.cs`,
4 reworked in `BusinessCustomerRepositoryTests.cs`, 13 in the new
`Clinqet.Communications.UnitTests/Repositories/BusinessCustomerMergeTests.cs`, 22 in
`KnowledgeExtractionFidelityTests.cs`, 2 emulator tests in `CosmosEtagConcurrencyIntegrationTests.cs`, and 6
in the new `clinqetwebpartnerapp/src/services/apiError.test.js` (one of which is a repo-local source scan).

**Session D's 20 extraction guards** and **Session F's 22** live in
`Clinqet.Communications.UnitTests/Knowledge/KnowledgeExtractionFidelityTests.cs`. **Do not delete the
`SampleData` evidence** — `Clinket_Chart_*`, `Clinket_ShapeFill_Deck.pptx`, `Clinket_TwoColumn_CV.docx`,
`Clinket_SmartArt_Process.docx`, `Clinket_SmartArt_Deck.pptx`, `Clinket_HiddenStyle_PriceList.docx`,
`Clinket_FloatingTextBox_Menu.docx`, `Clinket_TwoColumn_Menu.pdf`.

---

## 8. YOUR CLOSING DUTIES — none optional, carried forward VERBATIM

1. **A zero-error build gates every test run.** A stale binary "passes".
2. ‼️ **Every guard sabotage-proven** — RED on exactly the right case, restored byte-identical (check the
   MD5), green again. One at a time. **A sabotage that PASSES means the guard or the code is wrong — never
   the sabotage.** Prefer a sweep to a pinned case. **A guard handed the same input on both sides proves
   nothing.** **Print the occurrence count and require it to be 1.**
3. ‼️ **Live-data verification, honest about §5** — and honest about what it cannot cover. **Measure with the
   code that ships.**
4. ‼️ **A full 11-dimension audit of your own changes, and fix everything it finds**: correctness ·
   concurrency & idempotency · failure and partial-failure paths · cost and performance (RU, AI calls, index
   size) · security and tenancy isolation · limits and what happens at them · observability (does an operator
   actually learn?) · localization (never a raw English string to a provider or caller) · test quality (can
   each guard actually fail?) · config hygiene (a setting only in the host that reads it) · docs, skill and
   memory currency. **Do it by reading your own diff line by line, not by re-running the tests.**
   ‼️ **Session C's audit found EIGHT defects in its own already-green code; Session D's found three;
   Session E's found THREE plus SIX more in delegated conversions and FIVE more on a second pass; Session F's
   found a header's floating box being DELETED by its own new filter.** This duty is not a formality — it is
   where the real defects are found.
5. **Full suites green, in ONE in-tree run at the end** — and **attribute every failure**.
6. **Update the SKILL ×4, the memory entry, `PLAN.md` and `TRIAGE-AND-STATUS.md`.**
7. ‼️ **WRITE `SESSION-H-PROMPT.md`** for the session after you, covering: the exact items with their finding
   text **verified against the code**; which files it owns and which belong to a concurrent session; every
   decision already made; **what it must ASK before building** (every design gate, every infrastructure gate
   and every AI-spend gate); the coding standards, the sabotage discipline, the live-data duties and this
   closing audit, restated so the prompt stands alone; the suite counts it inherits.
   ‼️ **The prompt you write MUST carry duties 1–9 forward VERBATIM — above all duty 4, the audit AND fixing
   everything it finds. A session that inherits a prompt without that duty will skip it.**
   ‼️ **It must also carry THIS instruction — to write the prompt after it in turn.** The rule is
   self-propagating and dies the moment one session drops it.
8. ‼️ **Paste the prompt into the chat as well as writing the file** — the owner copies it from there
   (memory `feedback-deliver-prompt-in-chat-not-only-a-file`).
9. **Leave the tree clean.** `git status --porcelain` must hold nothing you did not intend; peers' files will
   be there too — **say which are which**, and ‼️ **check `git log -- <file>` in case a peer COMMITTED your
   work**. **Never `git push`.**

---

## 9. HOW TO TALK TO THE OWNER

Plain language first, then the solution, then the schema/infrastructure position, then your recommendation.
Give **options with a recommendation** and let them confirm each. Present the §0.7 table and WAIT. Flag a
second defect separately rather than widening scope. **Report failures faithfully** — including your own.

---

## 10. ‼️ THE MISTAKES SESSIONS C–F MADE — do not repeat them

1. ‼️ **Trusting the handover over the code.** Session C found two of nine items already fixed. Session D
   found the audit named **neither** of the two worst defects it shipped. Session E found the banked design's
   central claim wrong by more than 2×. **Session F found the handover wrong about a LIVE surface — it named
   one `ProviderOwnedEntity` upsert target when there are two, and the one it missed rewrote its own creator
   on every hours edit.**
2. ‼️ **Measuring the wrong thing.** A character ratio is not a fidelity measure (D15). **Measure facts.**
3. ‼️ **Proposing schema before measuring the alternative.** Four sessions running, it was unnecessary.
4. ‼️ **Asserting a "regression" reasoned about but never tested.** If you cannot write a failing test for
   it, it is not real.
5. ‼️ **Vacuous guards.** Ask of every guard: what exactly differs between pass and fail, and does my
   assertion touch that?
6. ‼️ **Running a test against a stale binary**, or against a sabotage that never applied.
7. ‼️ **Letting two fixes fight.** Test changes to one lane together, not only apart.
8. ‼️ **Trusting fixtures over the real corpus** — and ‼️ **trusting a fixture you built to be the shape the
   real world writes.** Session F's first floating-box fixture used a bare `wp:anchor`; Word actually wraps
   every one in `mc:AlternateContent`, where the SDK types nothing. **Add a fixture for the REAL shape.**
9. ‼️ **Relying on the shell's persisted working directory.** Pass paths explicitly.
10. ‼️ **Recommending a fix from a finding's SUMMARY instead of its DATA** (D31's "Cons under Pros").
11. ‼️ **Declaring something impossible when the missing input can simply be MADE.** Session D said EX-18 was
    unbuildable; the owner authorised creating a chart file and it shipped. Session F created a SmartArt
    deck, a hidden-style price list, a floating-box menu **and a two-column PDF** the same way. **When you are
    blocked on evidence, say what evidence would unblock you and offer to construct it.**
12. ‼️ **Believing an audit's illustrative example.** EX-07's "two-column résumé" is **PROVEN NOT REAL for
    Word**, and **its PDF half is PROVEN NOT REAL too** — measured, not argued.
13. ‼️ **"Fixing" a defect by making it louder.** A conditional write that turns a rare silent overwrite into
    a frequent unhandled error on a money path is the same mistake in a different costume. **Always ask what
    the caller can DO about the failure you are about to surface.**
14. ‼️ **Optimising away a durability ordering.** Collapsing two writes into one stranded a scheduled reminder
    that could then never be cancelled. The two writes were restored.
15. ‼️ **An agent's scope creep is your defect.** Review every delegated diff yourself.
16. ‼️ **A guard that asserts the SHAPE of a write instead of its CONTENT.**
17. ‼️ **A repair that re-publishes the drift it was meant to remove.** A repair must read the SOURCE OF
    TRUTH, not the thing that is broken.
18. ‼️ **A survey's site list is not the reachable set.** After a class-wide conversion, grep the SHAPE, not
    the census.
19. ‼️ **NEW (Session F) — building the "obvious" fix without measuring first.** Polygon column-sorting was
    the obvious remedy for EX-07's PDF half. Measurement showed **DI's reading order is already perfect**,
    **DI's own `paragraphs` array is row-major** so the cheap alternative was dead too, and **a column flow
    and a real table are geometrically identical** — so building it would have shredded every genuine price
    table. **The measurement cost four API calls and saved a regression.**
20. ‼️ **NEW (Session F) — a filter that excludes without re-emitting.** Excluding floating boxes from a
    header's text and forgetting to re-emit them DELETED a letterhead panel. **Every exclusion needs a
    re-emission, on every root the filter runs on.**
21. ‼️ **NEW (Session F) — not running the suites that touch what you changed.** 8 emulator CRUD tests were
    already red from Session E's missing etag restamp; nobody had run that class.

### ‼️ THE RULES THAT GENERALISE

**A fix that trades a narrow wrong answer for a broad loss of correct ones is not a fix** (D31) — its
Session E corollary, **making a failure visible is only half a fix; the other half is what the caller can do
about it** — and its Session F corollary: **when a lane behaves worse than its siblings, look for a gate the
siblings have and it does not, before you invent a new one.**
