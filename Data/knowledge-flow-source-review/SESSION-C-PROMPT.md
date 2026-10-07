# Session C — the design batch: EX-04, #9, EX-15 (typed sheets), EX-20 (ranking), EX-05, EX-09, EX-12, and two decided cap fixes

> Written 2026-09-04 by Session B, which closed EX-13, EX-14, EX-15 (declared half), EX-20 (validation
> half) and EX-33. **Read `PLAN.md` in this folder FIRST — it is the authority, and §1 records decisions
> you must not re-open.**

---

## 0. READ THESE, IN THIS ORDER, BEFORE TOUCHING A FILE

1. **`C:\Nik\Data\knowledge-flow-source-review\PLAN.md`** — the decision register (§1), the designs you must
   SHOW before you build (§2), your session's scope (§3), the resolved inherited items (§4), what live
   data can and cannot prove (§6), how to work in this tree (§7), and your closing duties (§9).
2. **`C:\Nik\CLAUDE.md`** — all of it. Especially §0.6 (never a cross-partition Cosmos query), §0.7 (any
   SQL/Cosmos/Search schema change needs the owner's yes FIRST, presented as the §0.7 table), §0.14 (no
   verbose comments), §0.16 (leave the tree clean; never write a scratch file inside a repo), §0.18 (a
   library class is tested from the suite of the HOST that invokes it), §0.19 (never `git checkout` /
   `restore` / `reset` / `stash` / `clean` in these trees).
3. **`AUDIT-FINDINGS.md`** (#1–#22) and **`EXTRACTION-PASSAGE-AUDIT.md`** (EX-01–EX-34) — the findings.
4. **`SESSION-HANDOVER-2026-09-04.md`** — banked analysis. Do not re-derive what is already measured there.
5. **`TRIAGE-AND-STATUS.md`** — the scoreboard.
6. The **`clinqet-voice-assistant` SKILL** (`.claude/skills/clinqet-voice-assistant/SKILL.md`) — the living
   contract for this whole area.

---

## 1. YOUR SCOPE — nine items

| Item | The defect | Your gate |
|---|---|---|
| **EX-04** | Vision transcription replaces the Document Intelligence text whenever the model's answer is non-empty. A fluent but incomplete table silently replaces a correct one — prices, phone numbers, SKUs and row associations are what get lost, and the result looks *cleaner*, so nobody notices | ‼️ **Measurement on the live PDFs is ALREADY APPROVED.** Measure on **CHARACTERS**, never words. The FIX needs a design shown first |
| **#9** | Approving an AI-suggested service saves the service, then does four more things one at a time (category selection, service counters, image derivatives, onboarding tick). If any fails the service exists with wrong counters / missing from a browse list / no thumbnail, and nothing ever finishes the job. On an EDIT that changes category, the OLD category cannot be recovered afterwards | ‼️ **DECIDED: recompute, NOT a new queue (PLAN D7 / §2.1).** Design shown first |
| **EX-15 typed sheets** | A plain typed Excel sheet with two tables still reads block 2's values under block 1's column names — `Price: 7` when the 7 is warranty days | ‼️ Design shown first (PLAN D8 / §2.2). **Compare BLOCK SHAPES, never judge one row** |
| **EX-20 ranking** | The generated overview still competes with real extracted rows on equal footing, so a factual question can surface the overview above the row holding the number | ‼️ Design shown first (PLAN D9 / §2.3) |
| **EX-05** | AI image descriptions become searchable facts with no grounding validation — an invented model name becomes retrievable knowledge | Design shown first |
| **EX-09** | Vision transcription moves every figure anchor to the END of its page, so a picture inherits the page's last heading instead of the row it sat beside | Design shown first |
| **EX-12** | Exact-byte hashing does not deduplicate visually identical images — the same photo as PNG and JPEG is two assets, two uploads, two description calls | Design shown first |
| **Page-share cap** | During a call the AI can send a caller the provider's page LINK and, separately, PIECES of their documents. Two limits are configured, but the page-link counter counts everything — so a caller sent two documents can no longer be sent the link | ‼️ **DECIDED (D11): two separate allowances. FIX IT.** No design gate. `CountShares` must filter by kind the way `CountMaterialSends` already does |
| **Document cap** | A provider at their document limit cannot upload a replacement until the deleted one finishes purging — and their own list already hides it, so they see fewer documents than the cap counts | ‼️ **DECIDED (D12): stop counting rows being deleted.** No design gate. Accepted trade: briefly over the cap while purges finish |

‼️ **Verify every finding against the actual code before you fix it.** Session B proved one finding NOT REAL
and found two of its own measurements wrong. The audit is a lead, not a fact.

---

## 2. ‼️ WHAT YOU MUST ASK BEFORE YOU BUILD

**Stop and ask. Do not guess, and do not "pick the sensible default and note it."**

### 2.1 Infrastructure — ALWAYS the owner's call (PLAN §0.3)

A new Service Bus queue · a new storage container or lifecycle rule · any new Azure resource · a new
`local.settings.json` key · a new timer or function trigger · a new Cosmos container or partition key · a
new search index, alias, analyzer, scoring profile or synonym map · anything needing an ARM template or
`azureautomation/deploy.ps1`.

‼️ **The default answer is "no new infrastructure."** Present what it is, what it costs, what breaks without
it, **and the no-new-infrastructure alternative** — then WAIT. This rule exists because the audit's remedy
for #9 was "add a queue" and the right answer was a recompute with no new resource at all.

### 2.2 Schema — the CLAUDE.md §0.7 table, then WAIT

Any new SQL column/table/index · **any new field on a Cosmos entity** · any new search index field,
analyzer or scoring change. Present the full table (What · Who reads it · Who writes it · Why not a column ·
Why not an enum · Why not already stored · Cost · What breaks if omitted) and wait for an explicit yes **in
your own session**. A plan document saying "add X" is NOT approval.

### 2.3 Designs — every item above EXCEPT the two marked DECIDED needs its design shown

Present the shape, the alternatives you rejected and why, and the cost. Then wait.

### 2.4 Anything that changes what a provider or caller experiences

Which images or content ship · any limit a provider or caller can hit · any large refactor · anything where
two readings of the request lead to different work.

---

## 3. CODING STANDARDS — non-negotiable

- **Fix the CLASS, never the call site.** Grep every site. A fix at one place is not a fix.
- **Do not over-complicate. The cheapest correct answer wins.** Derived data needs a recompute, not an
  outbox. A one-to-one fact is a column, never a table. A fixed list is an enum, never rows. If an existing
  mechanism already does it — content-limit alerts, the media-derivative recovery path, the admin reindex,
  the timer host — use that one. Premature abstraction IS over-complication.
- **No workarounds.** No `--no-verify`, no swallowed exceptions, no `// TODO`, no commented-out code, no
  skipped tests. If the correct solution is hard, write the correct solution.
- **No verbose comments (§0.14).** Default is NO comment. One short line, only for a non-obvious WHY, an
  invariant, a gotcha or a spec reference. Never narrate what the code does.
- **Pre-production: never write backward-compatible code, a feature flag, an old path or a backfill.**
- **Thread safety.** Shared services are SINGLETONS — per-document state is per-call, never a field.
- **A setting belongs only in the host that reads it**, and its class default must mirror `appsettings.json`.
- **No hardcoded user-facing text** — localization keys in `en.json` **and every other language file**.
  Admin-internal alert wording is the only exception.
- **Every `IMemoryCache` write sets `Size = 1`.**
- **Never a cross-partition Cosmos query.**
- **Tests live in the suite of the HOST that runs the code (§0.18)** — the knowledge extraction and ingest
  lane is the **Functions** host (`Clinqet.Communications.UnitTests`), not whichever suite is convenient.

---

## 4. ‼️ HOW TO WORK IN THIS TREE — another session may be live

- **Build into a private folder**, so two sessions can never share `obj/bin`:
  `dotnet build <proj> -p:UseArtifactsOutput=true -p:ArtifactsPath="<your scratchpad>/build"`
  ‼️ A compile error in a file you never touched means a peer is mid-write — **retry once, and if it
  persists, stop and tell the owner. Never "fix" their file.**
  ‼️ Isolated builds make ~127 convention tests fail LOUDLY, because they walk up from the binary to find
  source and cannot. **That is correct behaviour, not a defect.** Clear them with ONE in-tree run at the end.
- ‼️ **NEVER `git checkout` / `restore` / `reset` / `stash` / `clean`.** It wipes every session's uncommitted
  work, not just yours. Snapshot to your scratchpad and restore with `cp`.
- ‼️ **Snapshot JUST IN TIME.** A snapshot taken earlier in the session silently reverts later refinements
  when you restore. Session B lost a fix this way and only caught it because a guard went red under two
  unrelated sabotages.
- **Never write a scratch file inside a repo.** Everything goes in the session scratchpad.
- **The owner pushes, commits and deploys. Never `git push`.**

---

## 5. ‼️ LIVE-DATA TESTING — mandatory, and honest about its limits

**Credentials are READ AT RUNTIME and NEVER copied into a file, a doc or a commit:**
`C:\Nik\cosmosindexsetup\appsettings.ca.json` and `appsettings.in.json` →
`CosmosDb:ConnectionString`, `Search:ServiceEndpoint`, `Search:ApiKey`, `AzureStorage:ConnectionString`.

- **Cosmos:** database `Clinket-nonprod`, container `KnowledgeBase-dev`, partition key `/businessId`.
  Every query partition-scoped. ‼️ A raw gateway query cannot use `COUNT`/`GROUP BY` — project and
  aggregate locally.
- **Search:** alias `clinket-knowledge-dev` (index `clinket-knowledge-dev-v1`). ‼️ An alias needs
  api-version **`2026-04-01`**. Fields are **`chunkKind`** and **`sectionTitle`** — `kind` and `sectionPath`
  DO NOT EXIST, and a bad `$select` returns no value, which looks exactly like an outage.
  ‼️ The **Analyze** endpoint does NOT resolve aliases — use the real index name.
- **Blobs:** container `provider-knowledge`, path `{businessId}/{docId}/...`.
- **Sample files:** `C:\Nik\Data\SampleData` (8 real `.pptx`).
- ‼️ **Measure loss on CHARACTERS, never words.**
- ‼️ **Measure with the code that SHIPS, never a script that imitates it.** Session B's hand-rolled OOXML
  probe was wrong by 2×; running the real parser gave the truth. Build a harness that references the real
  projects, run it against the old and new trees, and diff.
- ‼️ **PowerShell 5.1 mangles non-ASCII in an HTTP body** — `ConvertTo-Json` leaves it literal and
  `Invoke-RestMethod` sends it as ASCII, so Gujarati becomes `?????`. Send
  `[Text.Encoding]::UTF8.GetBytes(...)` with an explicit charset.
- **All harness scripts and output go in your scratchpad, never a repo.**

### ‼️ What the live corpus CANNOT cover — say so plainly, never imply broader coverage

- **No live `.xlsx` and no live `.pptx` in either region.** All nine live `.docx` contain **zero pictures**.
- **All 843 live cards are Latin-script.**
- Canada: 3 `.json` + 1 `.jpeg`, **no PDF**. India: 9 `.docx` + 2 `.pdf` + 8 images + 31 typed FAQs.
- ‼️ **EX-04's live PDFs are the 2 in India.** That is a small sample — state it as such.
- ‼️ **DO NOT rebuild, reseed or delete the search index.** Owner decision 2026-09-04: the current
  environment is left alone, the whole audit is fixed first, then a NEW environment is built fresh. The
  index is **seeded and usable right now — CA 744 cards, IN 99 cards.** Nothing in your scope needs it
  rebuilt.
- ‼️ **THE TRAP THAT WILL MISLEAD YOU.** The live index still carries `docTitle`, `sectionTitle`, `docName`
  and `linkedServiceNames` on `standard.lucene`; the code has already moved them to `en.microsoft` (EX-33),
  and an analyzer only changes when the index is REBUILT. So a live recall test will show stemming and
  accent misses that the code has already fixed — "price lists" will not find "Price List", "cafe" will not
  find "Café". **That is the un-rebuilt index, NOT a defect in your work, and NOT a finding to report.**
  Check analyzer behaviour with the Analyze endpoint against a throwaway index instead.
- ‼️ **9 typed FAQs on `UKBV84` (IN) are `Ready` with NO cards.** ‼️ **This is TEST DATA, not a live
  incident (PLAN D13)** — the owner confirmed nothing is in production and these were left by one of their
  own people. **Never report it as a defect.** If you need those FAQs for your own testing, re-sync one with
  `POST /api/v1/admin/search/reindex-knowledge/UKBV84/{docId}`.

---

## 6. ‼️ THE SABOTAGE DISCIPLINE — every guard proven able to FAIL

Break the fix → watch the guard go RED on **exactly** the right case → restore from a just-in-time
scratchpad snapshot (`cp`, never git) → confirm byte-identical → re-run green. **One sabotage at a time.**

- ‼️ **If a sabotage PASSES, the guard or the code is wrong — never the sabotage.** Session B had one pass
  and it exposed unreachable code, which was deleted.
- ‼️ **A guard handed the SAME input on both sides is vacuous.** One of Session B's passed under sabotage
  for exactly this reason and had to be rebuilt.
- ‼️ **Prefer a SWEEP to a pinned case.** A pinned case proves one input; a sweep over sizes, shapes and
  flags proves the rule.
- ‼️ **Run any concurrency guard three times.** If it is not red every time, it proves nothing.

---

## 7. WHAT YOU INHERIT AND MUST NOT DROP

**Suites, in-tree, all green at the end of Session B:**
`Clinqet.API.UnitTests` **11 539** · `Clinqet.Communications.UnitTests` **3 838** ·
`Clinqet.Mcp.UnitTests` **856** · `ClinqetCosmosAIIndexSetup.UnitTests` **181** · **0 build errors.**

**Closed and sabotage-proven — do not regress these.** Run their guards if you touch nearby code:
EX-01, EX-02, EX-03, EX-06, EX-08, EX-10, EX-11, **EX-13, EX-14, EX-15 (declared half), EX-16, EX-19,
EX-20 (validation half), EX-21, EX-22, EX-23, EX-26, EX-27, EX-29, EX-31, EX-33**, and #1, 2, 3, 5, 6, 8,
10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22.

The ones most likely to be disturbed by YOUR work:
- **EX-08** — a card's overlap page comes from a per-sentence page list. Guarded by a 41-size sweep. **Do
  not simplify it.**
- **EX-19** — an oversized description is SPLIT, never truncated, and every piece keeps the picture's handle.
- **EX-13** — grounding rides the EmbedText only, never the stored Content, and its room is RESERVED from
  the piece budget.
- **EX-22** — repeated prose collapses only at 3+ sections; **tables never collapse**.
- **EX-06** — `ForceFresh` bypasses BOTH the banked parse artefact AND the business-wide caption reuse. **If
  you add a third cache, it must honour `ForceFresh` too.**

---

## 8. YOUR CLOSING DUTIES — none optional

1. **A zero-error build gates every test run.**
2. **Every guard sabotage-proven** (§6).
3. **Live-data verification with the character-level delta stated**, and honest about §5's limits.
4. ‼️ **A full 11-dimension audit of your own changes, and fix everything it finds**: correctness ·
   concurrency & idempotency · failure and partial-failure paths · cost and performance (RU, AI calls, index
   size) · security and tenancy isolation · limits and what happens at them · observability (does an
   operator actually learn?) · localization · test quality (can each guard actually fail?) · config hygiene ·
   docs/skill/memory currency.
5. **Full suites green in ONE in-tree run at the end.**
6. **Update the `clinqet-voice-assistant` SKILL in ALL FOUR copies** (`.claude/skills/`, `.github/skills/`,
   `.agents/skills/`, `.cursor/rules/`), the **memory entry**, `PLAN.md` and `TRIAGE-AND-STATUS.md`.
7. ‼️ **WRITE `SESSION-D-PROMPT.md`** in this folder for the next session (EX-07, EX-17, EX-18 — reading
   order, charts, résumés), following `PLAN.md` §8. **Include the instruction that it must write
   `SESSION-E-PROMPT.md` in turn.** ‼️ **Paste that prompt into the chat as well as writing the file.**
8. **Leave the tree clean** and LOOK at `git status --porcelain` in every repo you touched.
9. **The owner pushes and deploys. Never `git push`.**

---

## 9. HOW TO TALK TO THE OWNER

- **Plain language first**, then the solution, then the schema/infrastructure position, then your
  recommendation. They will ask "explain it to me super easy and simple" and they mean it.
- **Present the §0.7 table and WAIT** for any schema change. **Ask before ANY infrastructure.**
- When you find a second defect while fixing the first, **say so and flag it separately** rather than
  quietly widening scope.
- **Report failures faithfully.** If a guard passed for the wrong reason, say that. If a measurement you
  gave earlier was wrong, correct it plainly and move on.

---

## 10. ‼️ THE MISTAKES SESSION B MADE — do not repeat them

Written by Session B about itself, at the owner's instruction. Every one of these cost real time or nearly
shipped something wrong.

1. ‼️ **I trusted my own probe over the code that ships.** A hand-rolled OOXML script keyed relationship
   ids by DIRECTORY, so slide 1's `rId2` and slide 9's `rId2` collided. It reported "191 placements lost
   across 7 of 8 decks"; running the real parser said **91 → 139 across 1 of 8** — wrong by more than
   double, and I had already told the owner the wrong number.
   **→ Measure by running the code that ships. A script that imitates it is not evidence.**
2. ‼️ **My sabotage script restored from a snapshot taken earlier in the session**, so two later
   refinements were silently reverted by a restore. I only noticed because a guard went red under two
   *unrelated* sabotages.
   **→ Snapshot JUST IN TIME, immediately before each sabotage. And if a guard fails for a reason the
   sabotage cannot explain, stop and find out why.**
3. ‼️ **I wrote a vacuous guard.** It was handed the SAME string as both the summary and the source, so a
   sabotage that merged numbers merged both sides identically and the assertion still passed.
   **→ A guard whose two sides come from one input proves nothing. Make the source differ from the input.**
4. ‼️ **I wrote unreachable code and only found it because a sabotage PASSED.** A decimal-point check could
   never fire, because the rule on the next line already refused.
   **→ A sabotage that passes means the guard or the code is wrong. Never shrug it off.**
5. ‼️ **I told the owner "EX-15 done" when only half of it was.** Declared Excel tables were fixed; a plain
   typed sheet was completely unchanged. I corrected it, but only after they had made a decision on the
   strength of it.
   **→ State exactly which half of a finding shipped. "Done" is a claim about the whole thing.**
6. ‼️ **I let the owner rely on an alert that did not exist.** They reasoned "the admin alert will fire so
   I will know" and approved a limit on that basis. There was only a log line nobody reads.
   **→ If a decision rests on something existing, go and LOOK at it before the decision is recorded.**
7. ‼️ **I widened a shared interface without checking its call sites' test doubles.** Adding one optional
   parameter broke two Moq `.Callback<>` bindings in another session's file — they take an explicit type
   list and fail at RUNTIME, not compile time.
   **→ Adding a parameter to an interface: grep for `.Callback<`, `.Setup(` and `.Verify(` on it too.**
8. ‼️ **I ran a PowerShell HTTP probe without checking its encoding.** PS 5.1 leaves non-ASCII literal in
   `ConvertTo-Json` and sends the string as ASCII, so Gujarati became `?????`. My first analyzer probe
   "proved" Azure drops Gujarati entirely.
   **→ A shocking measurement is a broken probe until proven otherwise. Send
   `[Text.Encoding]::UTF8.GetBytes(...)` with an explicit charset.**
9. ‼️ **I stopped work when a peer edited a file, instead of switching to isolated build folders** — which
   I already had, and which is exactly what makes a concurrent session safe. I lost time and had to be
   told.
   **→ A peer editing is only dangerous if you SHARE `obj/bin`. Use `-p:ArtifactsPath` and carry on. Stop
   only if a phantom error persists after a retry.**
10. ‼️ **I re-ran full suites while iterating** after the owner asked for them at the end. Filtered runs and
    a compile check are enough while building; the full run is a closing duty.
    **→ Build to check compilation; run the narrow filter your change touches; run everything once, at the
    end, in-tree.**
