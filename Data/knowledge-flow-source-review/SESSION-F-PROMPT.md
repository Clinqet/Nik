# Session F — the four residuals, and whatever the owner ranks next

> Written 2026-09-06 by Session E, which closed **#7 / Q3-A, the ETag programme**, in one change.
> ‼️ Session E's headline lesson, and the reason this prompt is long: **the banked analysis it inherited was
> confidently WRONG about scale.** It said *"most call sites need no change"*. Measured: only **58 of 136**
> could simply inherit the new behaviour; **58 needed a completely different treatment**, and shipping the
> banked design as written would have traded silent data loss for **frequent, visible failures on 27 money
> paths**. ‼️ **Read the code. Measure. Never build from a summary.**
>
> ‼️ **Read `PLAN.md` in this folder FIRST — it is the authority. §1 now records 34 decisions (D1–D34)
> you must not re-open.**

---

## 0. READ THESE, IN THIS ORDER, BEFORE TOUCHING A FILE

1. **`C:\Nik\Data\knowledge-flow-source-review\PLAN.md`** — the decision register (§1, **D1–D34**), the four
   rules for every session (§0), what the live data can and cannot prove (§6), how to work in this tree (§7),
   and the closing duties (§9).
2. **`C:\Nik\CLAUDE.md`** — all of it. Especially §0.6, §0.7, §0.8, §0.14, §0.16, §0.18, §0.19, §0.20.
3. **`TRIAGE-AND-STATUS.md`** — the scoreboard. #7 is now CLOSED; §"residuals" lists what is genuinely open.
4. The **`clinqet-voice-assistant`** SKILL — its last three sections are Sessions C, D and E and they
   constrain you. The **`clinqet-cosmos-data`** SKILL's CONCURRENCY section was **rewritten by Session E**
   because it had documented the bug as a feature; treat it as the write-shape contract.

---

## 1. WHAT IS ACTUALLY OPEN

‼️ **There is no large engineering item left in this programme.** #7 was the last one. What remains is four
small residuals, none of which is provable on the corpus we hold, plus whatever the owner ranks next.

| residual | state, verified against the code |
|---|---|
| **EX-18 SmartArt node/edge ORDERING** | A diagram's text is read as a list; its **edges and order semantics are not**. The audit asked for them. **Not built** — no file in the corpus has a diagram whose edges carry meaning. Session D created the chart evidence when it was missing; the same is possible here — **offer to construct the file rather than declaring it unprovable** |
| **EX-18 rendered-image fallback** | A rendered picture of a visual structure whose semantics cannot be reconstructed. **Not built** — needs a renderer and a **paid description per chart**. ‼️ Propose and get approval before attempting |
| **EX-07 / EX-17 PDF + floating-textbox visual order** | Our code consumes only Document Intelligence's flattened markdown; word/line polygons are never requested. ‼️ **No two-column PDF exists in the corpus.** DOCX floating text boxes still read at their anchor's position. ‼️ EX-07's headline "two-column résumé" example is **PROVEN NOT REAL for Word** (`w:cols` is a flow, not a layout) |
| **`w:vanish` via a STYLE** | Direct run formatting is excluded; style-based hiding is not resolved (`Flatten` is static and has no `StyleDefinitionsPart`). No corpus file uses it |

### ‼️ Known-real things Session E found — ALL NOW FIXED (2026-09-06, second pass)

None of these is outstanding. They are listed so a later session does not re-derive them.

- **Partner web's two DEAD 412 handlers — FIXED.** `knowledgeServices.handleRequest` threw the response BODY,
  and `ApiResponse.StatusCode` is `[JsonIgnore]`d, so `err.statusCode ?? err.status ?? err.response.status`
  was `undefined` and `Number(undefined) === 412` never held. The status is now attached to the thrown
  payload, the way the mobile app already did it. Guarded by `knowledgeServices.status.test.js` — 3 tests,
  sabotage-proven.
- **The rating aggregate had no repair path — FIXED, and the existing method did not actually repair.**
  `RecalculateAndPatchAverageRating` re-derived the average FROM the stored distribution, so a lost
  increment was simply re-published. It now rebuilds the distribution from the REVIEWS
  via `GetReviewRatingDistributionAsync` and patches `/ratingDistribution` too. Reachable at
  `POST /api/v1/admin/reviews/{businessId}/rating/rebuild`, Admin role.
  ‼️ **The first guard for this PASSED its sabotage** — it asserted the patch OP COUNT, which cannot tell a
  rebuild-from-reviews apart from a recompute-of-itself. It now asserts the VALUES.
- **`LicenseController.ConfirmDocumentUploads` — FIXED.** An append after an upload, the same shape as the
  Service/Quote/Booking/Review confirms, missed because the survey's 136-site list never included it. Now a
  CAS that re-checks the cap against fresh state and is idempotent on `DocumentId`.
- **`InvoiceService` snapshot/selection divergence — FIXED.** The mutate now carries
  `SelectedPaymentMethodIds` alongside the snapshot built from it; otherwise an issued invoice could PRINT
  one payment method and STORE another, permanently — the selection is frozen once a snapshot exists.
- **`DeleteLicenseDocuments` had no test — FIXED**: two tests, the sweep and the no-op.
- Dead `UpdatedAt` stamps and the timestamp-hoisting inconsistency — cleaned.

### Still open, and genuinely someone else's call

- **An escaping 412 becomes a 500.** `GlobalExceptionHandler.cs:13` sets 500 unconditionally with no status
  inspection. Only three controllers reach a repository wrapper without `HandleException` —
  `BusinessTeamController`, `BusinessBranchController`, `BusinessMemberController`, all via the bookings
  handover, and all now route through `SetAssignmentAsync`, which returns null instead of throwing.
- **`UpsertItemAsync` stamps `createdBy*` via `StampCreatedBy`'s `??=`.** For a CONSTRUCTED
  `ProviderOwnedEntity` that rewrites the original creator. Every current upsert target is a plain
  `BaseEntity` except `BusinessCustomerRepository.UpsertBusinessCustomerAsync` — **check that one before
  routing anything new through Upsert.**
- **`CustomerIdentitySyncProcessor` still blind-overwrites the CRM row** through
  `UpsertBusinessCustomerAsync` — no If-Match at all. The CAS in `CustomerService` guards
  CustomerService-vs-CustomerService only.
- **`profileServices.handleRequest` has the same status-discarding shape** as the knowledge one that was
  fixed. Nothing currently branches on a status from it, so it was left alone rather than widened silently.
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

‼️ **Sessions C, D and E each expected to need schema and each needed NONE** (D23/D24, D25–D27, D32–D34).
**Measure the alternative and read the retrieval path before you reach for a field of your own.**

### 2.3 Anything that changes what a provider or caller EXPERIENCES
Session E's whole first hour was this. **Show the owner which surfaces change, and what the user actually
sees, before you ship it** — and check the *frontend*, not just the API: Session E found the reworded message
would never have reached a provider at all, because `showError` was discarding it.

### 2.4 ‼️ A prior session's TEST can encode a judgement rather than a ruling
Session D overrode `Docx_APartialSpan_StillCoversTheColumnsItSpans`; Session E rewrote
`UpdateBusinessAddresses_ReStampFailsMidLoop_DoesNotPersistProfile`, whose two assertions contradicted the
shipped contract. **Check the register (PLAN §1) before assuming an existing test is load-bearing — and say
so plainly when you override one.**

---

## 3. CODING STANDARDS — non-negotiable

- **Fix the CLASS, never the call site.** Grep every site. ‼️ Session E's ETag restamp fixed an entire
  double-write family with **no call-site change at all**.
- **Do not over-complicate. The cheapest correct answer wins.** Premature abstraction IS over-complication.
  ‼️ Before adding a helper, check whether one exists: `BookingRepository.SetAssignmentAsync` was sitting
  **unused** next to code that hand-rolled it badly.
- **No workarounds.** No `--no-verify`, no swallowed exceptions, no `// TODO`, no skipped tests.
- **No verbose comments (§0.14).** Default is NO comment. One short line, only for a non-obvious WHY.
- **Pre-production: never write backward-compatible code, a feature flag, an old path or a backfill.**
- **Thread safety.** ‼️ A capture across a parallel fan-out is CONCURRENT, never a plain `List`.
- **A setting belongs only in the host that reads it**, class default mirroring `appsettings.json` exactly.
- **No hardcoded user-facing text.** **Every `IMemoryCache` write sets `Size = 1`.** **Never a cross-partition
  Cosmos query.**
- **Tests live in the suite of the HOST that runs the code (§0.18)** — extraction/ingest = **Functions**;
  voice retrieval = **MCP**; controllers, repositories and the money paths = **API**.

### ‼️ The write-shape contract Session E established — do not regress it
| The write | Shape |
|---|---|
| Read → mutate → write in one request, conflict SHOULD reach the user | `UpdateItemAsync` (412 → `Error_DbConcurrencyConflict`) |
| A counter, aggregate, commutative append, idempotent stamp | `UpdateItemWithRetryAsync` |
| The entity is held across a slow call (AI, blob upload, notification fan-out) | `UpdateItemWithRetryAsync`, re-evaluating the guard **inside** the mutate |
| A narrow, stable field set | an atomic `PatchItemAsync` — removes the conflict instead of reporting it |
| A deliberate unconditional write (a denormalized mirror, an idempotent marker) | `UpsertItemAsync` |

‼️ **A CAS mutate MUST be idempotent.** A write can land while its acknowledgement is lost; Polly re-sends,
gets a 412, and the mutate runs again on a document that already has the change. `list.Add` without an
existence check **duplicates**. This produced a real duplicated-address defect in Session E.

---

## 4. ‼️ HOW TO WORK IN THIS TREE — another session IS live

- **Build into a private folder:** `-p:UseArtifactsOutput=true -p:ArtifactsPath="<scratchpad>/build"`
- ‼️ **A compile error in a file you never touched means a peer is mid-write — retry and CARRY ON.** Never
  "fix" their file.
- ‼️ **At the end, attribute every failure.** Session E's peer owned `BusinessSearch*`, the Knowledge parser,
  `VisionDocumentTranscriptionService`, `ProviderCatalogSearchService` and a brand-new **untracked**
  `DuplicateUploadDonorTests.cs`. `git status --porcelain` is the evidence — an **untracked** test file is
  almost certainly not yours. **Attribute; do not adopt.**
- ‼️ **Isolated builds make ~111 API + ~12 MCP + ~58 Communications convention tests fail LOUDLY** — they walk
  up from the binary to find source and cannot. That is correct behaviour. Clear with ONE in-tree run at the
  end, and **verify it is only that**. The same cause makes `InvoicePaymentContractTests`' locale-file checks
  fail; they are not a localization defect.
- ‼️ **LINE ENDINGS ARE MIXED.** Most `C:\Nik` files are **CRLF**, but some test files are **LF**
  (`BookingTimeoutProcessorTests.cs`). A scripted edit that assumes the wrong one **silently matches nothing**
  and reports success. Detect per file; never assume.
- ‼️ **NEVER `git checkout` / `restore` / `reset` / `stash` / `clean`.** Snapshot to the scratchpad, restore
  with `cp`, **just in time**.
- ‼️ **ALWAYS pass the project/solution path explicitly to `dotnet build` and `dotnet test`.**
- ‼️ **Workflow subagents share your scratchpad.** Do not assume a scratchpad directory survives a background
  workflow.
- **Never write a scratch file inside a repo. The owner pushes and deploys.**

---

## 5. ‼️ LIVE-DATA TESTING — mandatory, and honest about its limits

Credentials READ AT RUNTIME, never copied: `C:\Nik\cosmosindexsetup\appsettings.{ca,in}.json`.
‼️ Per **D14** the committed keys are **sandbox keys, ACCEPTED** — never report, rotate or "fix" them.

- **Cosmos:** `Clinket-nonprod`; containers suffixed `-dev`, pk `/businessId`, every query partition-scoped.
  ‼️ No server-side `COUNT`/`GROUP BY` through the gateway. ‼️ The SDK uses **Newtonsoft** — query into
  `JObject`, not `JsonElement`.
- ‼️ **Docker IS available on this machine** and the Cosmos emulator Testcontainers fixtures work
  (`ClinqetApiFactory`, `FunctionAppFactory`). Session E ran 8 emulator integration tests in ~2 s after the
  container warmed. **There is no excuse for skipping integration coverage on a money or schema path.**
- ‼️ **Measure with the code that SHIPS**, never a script that imitates it.
- ‼️ **A census over a whole tree is NOT the reachable set.**
- ‼️ **DO NOT rebuild the search index** (D6 / §5.4). One rebuild ever, after the whole audit is fixed.

---

## 6. ‼️ THE SABOTAGE DISCIPLINE

Break the fix → RED on **exactly** the right case → restore from a just-in-time snapshot (`cp`) →
byte-identical (**check the MD5**) → green. One at a time.

- ‼️ **GATE EVERY SABOTAGE ON A ZERO-ERROR BUILD.** Session E's third sabotage used `if (false)` and produced
  **16 compile errors** — the run proved nothing until it was rewritten as a condition that compiles
  (`if (item.ETag == "an-etag-no-document-can-have")`).
- ‼️ **A sabotage that does not APPLY is not a passing test.** Session E's fourth attempt matched zero
  occurrences (CRLF vs LF) and the subsequent green run was the *unsabotaged* code. **Always print the
  occurrence count and require it to be 1.**
- ‼️ **If a sabotage PASSES, the guard or the code is wrong** — never the sabotage. ‼️ **Session E had one.**
  Its guard for the rating repair asserted the patch **OP COUNT**; rebuilding from the reviews and re-deriving
  from the stored distribution both emit the same five operations, so the count could never tell them apart.
  Asserting the **VALUES** made it go RED on exactly the right test. **A count, a call-happened, a Times.Once —
  ask whether the thing you assert actually DIFFERS between the fixed and broken code.**
- ‼️ **A guard must assert the thing that actually differs**, and **a guard handed the same input on both
  sides proves nothing.**
- ‼️ **A fake must model production, not merely return something.** Session E had to fix a repaired test
  whose fake re-read through a *list* where production point-reads — the assertion was measuring the fake.
- ‼️ **Prefer a SWEEP to a pinned case. Run concurrency guards at least three times** (Session E used a
  `[Theory]` with three `[InlineData]` runs), and **make the concurrency deterministic**: with N writers a
  writer is beaten at most N−1 times, so `N ≤ MaxConcurrencyRetries + 1` can never flake.

---

## 7. WHAT YOU INHERIT AND MUST NOT DROP

**Suite state at Session E’s close, ALL IN-TREE and all measured, not estimated:**

| suite | result |
|---|---|
| `Clinqet.API.UnitTests` | **11 764 passed, 0 failed** |
| `Clinqet.Communications.UnitTests` | **3 978 passed, 0 failed** |
| `Clinqet.Mcp.UnitTests` | 868 passed, **1 failed — a CONCURRENT session’s** `ProviderCatalogSearchServiceTests.PartnerScope_MaySeeUnapproved_CustomerScopeMayNot`, in a file that uses none of the changed methods. **Attribute it; do not adopt it.** |
| emulator integration | **8 passed** (`CosmosEtagConcurrencyIntegrationTests`) + **2 passed** (the booking money proof appended to `BookingAutoCompletionProcessorIntegrationTests`) |
| partner web jest | **3 passed** (`knowledgeServices.status.test.js`), 0 ESLint errors |

‼️ **Do not let these drop.** If the MCP failure is green when you start, the peer finished; if it is red, it
is still theirs.

‼️ **Most likely to be disturbed by your work, because Session E touched the base every entity uses:**

- ‼️ **`CosmosDbRepository.UpdateItemAsync` / `UpdateItemWithRetryAsync` / `ReadForUpdateAsync` /
  `ReplaceWithPreconditionAsync`** — the whole contract. **The etag restamp on the caller's instance is
  load-bearing**: remove it and every "write the same object twice" site 412s deterministically.
- ‼️ **`StampUpdatedBy` / `ProviderOwnedEntity` attribution** — the internal read must stay, or `createdBy*`
  is rewritten.
- ‼️ **`PatchStableArrayItemByIdAsync`** — the CAS pattern the new helper was modelled on. Do not "unify"
  them without proving the array semantics survive.
- ‼️ **The atomic-counter paths** (`RefreshSubcategoryCountsAsync`, the usage meters) — they use PATCH, not
  replace, and must NOT be routed through the conditional update.
- ‼️ **#9's counter refresh (D23)** — the delta is a **MARKER, never an amount**, and a zero delta is DROPPED.
- ‼️ **The cached-counter monotonic store** (memory `cached-counter-monotonic-store-2026-08-07`).
- **Session E's new guards**: `Clinqet.API.UnitTests/Repositories/CosmosRepositoryEtagTests.cs` (9),
  `Clinqet.API.IntegrationTests/Repositories/CosmosEtagConcurrencyIntegrationTests.cs` (8, emulator), and two
  emulator proofs appended to
  `Clinqet.Communications.IntegrationTests/Tests/Functions/BookingAutoCompletionProcessorIntegrationTests.cs`.
- **Session D's 20 extraction guards** in `Clinqet.Communications.UnitTests/Knowledge/KnowledgeExtractionFidelityTests.cs`
  and its five sample files in `C:\Nik\Data\SampleData` — **do not delete them; they are the evidence for EX-18.**

‼️ **The three findings deliberately NOT fixed (D31)** — do not re-open without new evidence: XLSX
side-by-side tables welding · a "Cons" list read under "Pros" · XLSX stranded labels. Each fix measured
**worse than its defect**.

---

## 8. YOUR CLOSING DUTIES — none optional, carried forward VERBATIM

1. **A zero-error build gates every test run.** A stale binary "passes".
2. ‼️ **Every guard sabotage-proven** — RED on exactly the right case, restored byte-identical (check the
   MD5), green again. One at a time. **A sabotage that PASSES means the guard or the code is wrong — never
   the sabotage.** Prefer a sweep to a pinned case. **A guard handed the same input on both sides proves
   nothing.**
3. ‼️ **Live-data verification, honest about §5** — and honest about what it cannot cover. **Measure with the
   code that ships.**
4. ‼️ **A full 11-dimension audit of your own changes, and fix everything it finds**: correctness ·
   concurrency & idempotency · failure and partial-failure paths · cost and performance (RU, AI calls, index
   size) · security and tenancy isolation · limits and what happens at them · observability (does an operator
   actually learn?) · localization (never a raw English string to a provider or caller) · test quality (can
   each guard actually fail?) · config hygiene (a setting only in the host that reads it) · docs, skill and
   memory currency. **Do it by reading your own diff line by line, not by re-running the tests.**
   ‼️ **Session C's audit found EIGHT defects in its own already-green code; Session D's found three;
   Session E's adversarial review found SIX, including two that would have corrupted customer data and one
   in its own new base method.** This duty is not a formality — it is where the real defects are found.
5. **Full suites green, in ONE in-tree run at the end** — and **attribute every failure**.
6. **Update the SKILL ×4, the memory entry, `PLAN.md` and `TRIAGE-AND-STATUS.md`.**
7. ‼️ **WRITE `SESSION-G-PROMPT.md`** for the session after you, covering: the exact items with their finding
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

## 10. ‼️ THE MISTAKES SESSIONS C, D AND E MADE — do not repeat them

1. ‼️ **Trusting the plan over the code.** Session C found two of nine items already fixed. Session D found
   the audit text had named **neither** of the two worst defects it shipped. **Session E found the banked
   design's central claim — "most call sites need no change" — was wrong by more than 2×.**
2. ‼️ **Measuring the wrong thing.** A character ratio is not a fidelity measure (D15). **Measure facts.**
3. ‼️ **Proposing schema before measuring the alternative.** Three sessions running, it turned out unnecessary.
4. ‼️ **Asserting a "regression" reasoned about but never tested.** If you cannot write a failing test for
   it, it is not real.
5. ‼️ **Vacuous guards.** Ask of every guard: what exactly differs between pass and fail, and does my
   assertion touch that? ‼️ **Session E found a `Times.Never` naming a method production can no longer call
   at all** — it could never fail. Rewrite those; do not leave them for the look of coverage.
6. ‼️ **Running a test against a stale binary**, or against a sabotage that never applied.
7. ‼️ **Letting two fixes fight.** Test changes to one lane together, not only apart.
8. ‼️ **Trusting fixtures over the real corpus.**
9. ‼️ **Relying on the shell's persisted working directory.** Pass paths explicitly.
10. ‼️ **Recommending a fix from a finding's SUMMARY instead of its DATA** (D31's "Cons under Pros").
11. ‼️ **Declaring something impossible when the missing input can simply be MADE.** Session D reported EX-18
    unbuildable because no corpus file had a chart — then the owner authorised creating one and it shipped.
    **When you are blocked on evidence, say what evidence would unblock you and offer to construct it.**
12. ‼️ **Believing an audit's illustrative example.** EX-07's "two-column résumé" is **PROVEN NOT REAL for
    Word**.
13. ‼️ **NEW (Session E) — "fixing" a defect by making it louder.** A conditional write that turns a rare
    silent overwrite into a **frequent unhandled error on a money path** is the same mistake in a different
    costume. **Always ask what the caller can DO about the failure you are about to surface.**
14. ‼️ **NEW (Session E) — optimising away a durability ordering.** Collapsing two writes into one looked
    strictly better until the audit asked what happens if the step between them throws: a scheduled reminder
    whose sequence number never reached the document **can never be cancelled**. The two writes were restored.
15. ‼️ **NEW (Session E) — an agent's scope creep is your defect.** A conversion agent stamped `Id` onto
    nested `PortfolioImage` array items, changing the stored document shape for one path only. **Review every
    delegated diff yourself; the reviews found six real defects the conversion agents had introduced.**

16. ‼️ **NEW (Session E, second pass) — a guard that asserts the SHAPE of a write instead of its CONTENT.**
    Op counts, `Times.Once`, "a patch happened" — all pass equally for the fixed and the broken code when the
    defect is in the VALUES. Session E shipped one such guard, and only the sabotage caught it.
17. ‼️ **NEW (Session E, second pass) — a repair that re-publishes the drift it was meant to remove.**
    `RecalculateAndPatchAverageRating` re-derived the average FROM the stored distribution — the very place a
    lost increment lives. **A repair must read the SOURCE OF TRUTH, not the thing that is broken.**
18. ‼️ **NEW (Session E, second pass) — a survey's site list is not the reachable set.**
    `LicenseController.ConfirmDocumentUploads` is the same append-after-upload shape as four converted sites
    and was missed because the 136-site census never listed it. **After a class-wide conversion, grep the
    SHAPE, not the census.**

### ‼️ THE RULE THAT GENERALISES

**A fix that trades a narrow wrong answer for a broad loss of correct ones is not a fix** (D31) — and its
Session E corollary: **making a failure visible is only half a fix; the other half is what the caller can do
about it.**
