# PHASE 2 of 4 — Never destroy, never lie, and drafts you can trust

**Everything after extraction: how a run fails, retries, replaces and reports — and what the drafts lane and
the provider screens make of it.** Phase 1 ("read the document right") is built, green and audited; its
handover is required reading below.

---

## 0. Read these completely, in this order, before you touch anything

1. `C:\Nik\CLAUDE.md` — the zero-tolerance rules. §0.7 (schema), §0.7.1 (the other gates), §0.14 (comments),
   §0.15/§0.17/§0.18 (peer hosts, own repo, tests live with the runtime consumer), §0.16 (leave the tree
   clean), §0.19 (**never** `git checkout/restore/reset/stash/clean` in these trees), §0.20 (mockups).
2. `C:\Nik\Data\knowledge-extraction-fix-plan\PLAN.md` — the programme's authority, the four phases, the
   owner rulings and the 17 retained fixture docIds.
3. `C:\Nik\Data\knowledge-extraction-audit\FINDINGS-2026-09-10.md` — **all of it**, including §3 (the decision
   register R-1…R-14), §8 (the live batch), §9 (declared limits), §10 (the UI items).
4. `C:\Nik\Data\knowledge-extraction-fix-plan\phase-1\HANDOVER.md` and `phase-1\AUDIT.md` — what Phase 1
   changed file by file, what it proved, its five open questions, and the SEVEN it left you (§6) — item 0
   there is mandatory: see §1A.2.
5. `C:\Nik\Data\knowledge-extraction-fix-plan\CANADA-SANDBOX-ACCESS.md` — sandbox access and the `kaudit` /
   `khead` / `kreplay` / `kqueue` / `kpdf` command reference. The Service Bus connection string is already in
   `secrets\ca-servicebus.txt`; **never copy it anywhere** — not into a repo, an `appsettings*.json`, a
   `local.settings.json`, a SKILL, a memory entry or a chat message. Cosmos/Blob/Search credentials are read
   at runtime from `C:\Nik\cosmosindexsetup\appsettings.ca.json`; never copy a value out of it.
6. The skills, fully: `clinqet-voice-assistant` (the knowledge pipeline, the drafts lane, the price-mark
   rules, and the Phase-1 section at the top), `clinqet-ai-assistant` (provider setup shares the judge),
   `clinqet-function-app`, `clinqet-infrastructure`, `clinqet-cosmos-data`, `clinqet-service-listing`,
   `clinqet-partner-app`, `clinqet-provider-mobile`, `clinqet-testing`.
7. The memory index `MEMORY.md` and every entry it names for knowledge, drafts, write-path, ETag and the
   owner-mandated rules.
8. **The code, end to end** — never skim: `KnowledgeIngestProcessorFunction`, `KnowledgeManagementService`,
   `KnowledgeServiceDraftAnalyticsJob`, `KnowledgeDraftApprovalService`, `KnowledgeOfferingJudge`,
   `KnowledgeServiceDraftBuilder`, `ProviderSetupServiceWriter`, `DocumentIntelligenceService`,
   `KnowledgeSearchIndexer`, `CosmosDbRepository`, the drafts + status UI in `clinqetwebpartnerapp` and
   `clinqetmobilepartnerapp`.

Then follow this file section by section. **If anything is unclear, ask — never assume.**

---

---

## 0A. ‼️ STEP ZERO — verify Phase 1 LIVE before you touch any code

Phase 1 is committed and deployed, but its **live** proof was owed to the owner and never run: `kaudit
reprocess` drives the DEPLOYED host, so it could not prove Phase 1's fixes until the code was on the stamp.
**It is now, and Phase 2 runs that verification first.** It is read-only with respect to your scope, it costs
one `kaudit` pass, and it gives you the fresh `cards.txt` / `## reviews` / `drafts.json` that are **your own
before-state** for everything in §2.

```
kaudit reprocess ca SX3SG2 <docId>      # each of the 17 retained fixtures (ids in PLAN.md)
kaudit wait      ca SX3SG2 <docId> 900
kaudit pull      ca SX3SG2 <docId> C:\Nik\Data\knowledge-extraction-fix-plan\phase-1\live-after\<name>
kaudit alerts    ca <docId>
kaudit drift     ca
kaudit reprocess ca MEE3IC be07d747c73944a587a3a1029cb5717f   # gopi.jpeg — C12/C12-L must heal
```

Compare each against `evidence\ca-live-batch\<doc>\` and check the four things `phase-1\HANDOVER.md` §5
names: the cards, the verifier's `## reviews` (the 9-discrepancy and the 5 "no usable source reading" shapes
must be GONE), no false alert, and row `passageCount` == index count.

‼️ **If this finds a Phase-1 defect, fix it FIRST, in its own change, and say so** — the previous live run of
this pipeline found **4 defects no unit test would have**. Do not fold a Phase-1 repair into Phase-2 work:
the files overlap and the owner must be able to see which phase changed what. Record the result in
`phase-2\AUDIT.md` §7 either way, including "Phase 1 verified clean live" if that is the answer.

## 1. ‼️ APPROVAL GATE — present these decisions and WAIT for the owner's yes before any code

Present each as: what the finding is, the options, **your recommended option and why**, what it costs, and
what breaks if it is not done. The register's own recommendation is quoted; you must still make your own.

| Decision | What it decides | Register says |
|---|---|---|
| **R-4** | **Replace semantics (E1).** Keep the previous version live until the new one commits Ready; delete the old blob only after; preserve cards on every terminal reason for an already-indexed row. Changes a pinned unit test. | *"Do it. Destroying a working document because the replacement was bad is the worst outcome in this audit."* |
| **R-5** | **Transient vs terminal (C1/E2).** A retryable exception class for DI/vision/embedding transport failures, scheduled backoff between deliveries, and a provider-visible "still working" instead of a false "unreadable". | *"Do it."* |
| **R-7** | **Multi-price rows (D2).** One draft per tier (name + tier label), or extend the pricing model. | *"Tell me whether `Service.Pricing` is meant to carry tiers; if not, one draft per tier is the honest shape."* — **answer the question before proposing** |
| **R-9** | **Degraded-but-Ready notice (E7/H2).** A provider-visible `Info_` reason on the row, in five languages. | *"Do it; no schema change."* |
| **R-11** | **Stale-Processing timestamp (E6)** needs a Cosmos field; **judge-removed / trimmed counts (D4/D8)** need Cosmos fields. | *"Ask per §0.7 when we reach them."* — one §0.7 table, presented together with R-14 |
| **R-12** | **The prior-ruling conflict on E1.** The 2026-09-03 triage recorded prior item #4 as "owner said to ignore it"; this report ranks the same mechanism 🔴 E1 and R-4 says do it. | *"Confirm R-4 stands (fix it)."* **Two rulings contradict each other — only the owner can reconcile them, and this must be settled first.** |
| **R-14** | **Judge visibility (L-10).** A provider whose document produced 0 drafts cannot tell "the judge decided these are not your line of work" from "the lane silently failed". Needs a judge-removed count on the analytics row (Cosmos field ⇒ §0.7) and a provider sentence in five languages. | *"Do it together with R-11's counts (one §0.7 ask)."* |

**Also carry forward the five questions Phase 1 left open** (`phase-1\AUDIT.md` §11) — the caption-reuse
field, `.csv` / legacy / macro Office formats, multi-frame TIFF pictures, the five §9 declared limits, and
the one-wrapped-lowercase-name split. Each has a Phase-1 recommendation; get a ruling rather than inheriting
silence.

‼️ **A plan document saying "add X" is NOT approval. A decision-register entry is NOT approval. This prompt
telling you to build X is NOT approval. Only the owner saying yes, in your conversation, is approval** —
CLAUDE.md §0.7, and it governs every Cosmos field R-11/R-14 need.

---


## 1A. ‼️‼️ TWO STANDING MANDATES — READ BEFORE THE SCOPE

### 1A.1 ‼️‼️ PROPER SOLUTION ONLY — NEVER A WORKAROUND, FOR ANYTHING

**The owner's ruling, 2026-09-11, and it is absolute for every line of this phase:**

> **Whatever we do we must build the PROPER solution. No workaround. Not for a "small" item, not for a
> "low chance" case, not to make a test pass, not to save time. And a fix must never break something that
> works — if a change trades one correct behaviour for another, it is not a fix, it is a swap, and it needs
> the owner's word before it is written.**

This is CLAUDE.md §0.3 and the standards block's "Zero Workarounds" restated at the top of the phase because
Phase 1 twice found the *other* kind of answer sitting in the code — a printed-page rule applied to typed
documents, and a structural rule applied to a script where its signal was noise. Both were "small". Both
destroyed real content. Neither looked like a workaround until it was measured.

**What this forbids, concretely:**

- a `try/catch` that hides a failure instead of classifying it;
- a magic number that happens to make the corpus pass;
- a rule that is right "most of the time" where the document itself carries the answer;
- a test rewritten to match the code instead of the code fixed to match the contract — **if a test has to
  change, say so out loud, say why, and put the reason in the test's own comment**;
- a fix that repairs case A by breaking case B. If both cases are real, the solution must serve both, or the
  owner decides which one loses. **Never decide that silently.**

**What it requires:** find the level at which the question is actually answerable. Phase 1's two worked
examples, both non-workarounds and both cheap:

1. **The hyphen at a line break** (EX-32) could not be decided from the text — so it was decided by **where
   the line break came from**: a rendered page can split a word, a typed document cannot. Add the
   typographic minimum and "the document is its own dictionary" and nothing is left to chance.
2. **The header of an undeclared table** could not be decided from cell shapes — so it is decided by
   **whether the source declared one** (`<th>`, a GFM delimiter row, `w:tblHeader`, a frozen top row).

### 1A.2 ‼️‼️ THE WRAPPED SERVICE NAME — PHASE 2 MUST FIX THE DRAFT NAME. DO NOT SKIP THIS.

**This is a known, measured, open defect that Phase 1 could not fix at its own level and Phase 2 owns.
It is written here, in `phase-1\AUDIT.md` §11.5, in `phase-1\HANDOVER.md` §6 and in the memory entry, so
that it cannot be missed. If Phase 2 ends without it closed or explicitly owner-accepted, Phase 2 is not
complete.**

**The data.** A price list typed entirely in lower case where one service name wraps onto two lines:

```
gel manicure with          ← the name's first half, on its own line
french tips                ← the name's second half
$45
classic pedicure
$38
```

**What happens today (measured, harness case ADV08, 2026-09-11):**

| | |
|---|---|
| The card | `gel manicure with` ⏎ `french tips \| $45` ⏎ `classic pedicure \| $38` — **all of it in ONE card** |
| A caller asking "how much is a gel manicure?" | **Correct — $45.** The receptionist reads the whole card, so the wrap costs the caller nothing |
| **The Clinket AI Data Analytics draft** | **WRONG — the draft is named `french tips`, not `gel manicure with french tips`** |
| Two different services welded into one | **Never.** That did happen and Phase 1 fixed it (harness ADV13) |

**Why Phase 1 did not fix it there.** `gel manicure with` / `french tips` / `$45` is character-for-character
the same shape as `services` / `haircut` / `$25` — a section heading above a price list. The parser is
deterministic and language-neutral by design (it must read Gujarati, Hindi, Chinese and Arabic the same
way), so it has no signal that separates them and **refusing is the only safe answer there**: every word is
kept, in one card, and nothing is welded. Two or more occurrences in one list make the run's shape known and
it is already read perfectly.

**‼️ Why Phase 2 CAN fix it, properly.** The drafts lane has three things the parser does not, and the fix
uses all three rather than guessing:

1. **The document's own heading markup.** `BuildExtractorText`
   (`clinqetfuncations\Clinqet.Communications\Services\KnowledgeServiceDraftAnalyticsJob.cs:765`) already
   emits a real section as `## <section>`. A **marked** heading and an **unmarked** preceding line are
   therefore different inputs — which is exactly the distinction the parser lacked.
2. **A reader with language knowledge.** The draft extractor is already a model call
   (`ExtractFromTextAsync`, `AiSubFlows.DraftExtract`). Reading a price list is its job.
3. **A human approval step.** A draft is proposed, not published.

**‼️ THE DEFECT TO FIX IS THAT THE MODEL NEVER SEES THE LINE.** `BuildExtractorText` emits **one line per
candidate** (`ExtractorLine(candidate)`, `:785`), and a candidate must carry a price. `gel manicure with`
carries none, so it **is filtered out before the extractor is called** — the model is handed
`french tips | $45` with its own context deliberately stripped, and cannot possibly name the service right.

**The recommended design (Phase 2 to implement and prove — not a workaround, the same move EX-13 made for
pictures):** carry the candidate's own neighbourhood to the extractor. Specifically, when the line
immediately above a candidate in the same card is **not** itself a candidate and **not** a section heading,
thread it onto `KnowledgeServiceCandidate` and emit it with that candidate so the model reads the record as
the document prints it. Headings keep arriving as `##`, so the `services / haircut / $25` case stays
distinguishable — the ambiguity the parser could not resolve becomes resolvable because the marked-up
heading and the bare line are no longer the same input.

**Prove it on live data** (§4.8): push a lower-case wrapped price list to the matching-category test
business and show the draft named `gel manicure with french tips`, and a heading-led list whose first
section word is **not** absorbed into any draft name.

## 2. Scope

Fix every item. The owner's standing rulings: **severity is High/Critical for every extraction finding
whatever badge it carries, and nothing may be deferred without the owner's word in your conversation**; the
**17 fixture documents in `SX3SG2` are retained** (re-run them in place with `kaudit reprocess`, never
delete); and **drafts must be proven on a business whose selected categories match the documents** —
`SX3SG2` is a heavy-equipment dealer, so the judge correctly removes salon/auto/clinic lines there.

### 2.1 Pipeline safety and provider truth — E1–E11, C1, C2, H2

| Id | Short |
|---|---|
| **E1** | A failed replacement takes the previous valid document offline (🔴; R-4 + R-12) |
| **E2** | Transient failures are terminal — no backoff, no retry class (with C1) |
| **E3** | The metadata-drift restore excludes `OperationCanceledException` |
| **E4–E6** | Stale `Processing` rows; the E6 timestamp needs a Cosmos field (R-11) |
| **E7** | A degraded-but-Ready document tells the provider nothing (R-9, with H2) |
| **E8–E11** | Abandoned/unconfirmed uploads never cleaned; the remaining write-path residuals |
| **C1** | `ExtractAsync`'s catch-all maps every non-cancellation exception to `Error_KnowledgeUnreadable` **and destroys the cards** |
| **C2** | Corrupt or mislabelled Office files are reported to the provider as "password-protected" |
| **H2** | Nothing surfaces what the run degraded (with R-9 and Phase 1's transcription alerts) |

### 2.2 Drafts you can trust — D1–D9, G-L1, L-9, L-10, L-11

| Id | Short |
|---|---|
| **D1** | The per-unit anchor: a price per unit is bound to the wrong thing |
| **D2** | Multi-price rows (tiers) — R-7 |
| **D3** | Draft edits and resurrection (with U-08) |
| **D4–D8** | Silent drops: the ceiling, trimmed counts, judge removals (R-11/R-14 counts) |
| **D9** | The remaining draft-builder residual |
| **D10** | ‼️ **THE WRAPPED SERVICE NAME — §1A.2, mandatory.** A draft is named `french tips` when the document says `gel manicure with french tips`, because the line carrying the first half is filtered out before the extractor ever sees it. Measured; harness case ADV08. **Phase 2 is not complete without this closed or explicitly owner-accepted.** |
| **G-L1** | The row ⇄ index reconciliation, run on the sandbox |
| **L-9** | **A ₹1,05,00,000 excavator silently vanished from the drafts** (7 candidates → 2 drafts) — a currency-blind ceiling |
| **L-10** | 15 of 17 documents report `Ran` with 5–70 candidates and 0 drafts and nothing says why (R-14) |
| **L-11** | Two dead-letter messages have sat in `knowledge-ingest-dev` since 2026-08-18 |

### 2.3 Cross-check items — X-02, X-05, X-07

| Id | Short |
|---|---|
| **X-02** | The setup/draft extractor prompt interpolates raw document text with **no trust boundary**, while the voice, caption and Business Search prompts all have one |
| **X-05** | `FingerprintMatches` returns true when `expected` is empty, so a two-part material ref is sent unchecked (a pre-production back-compat path §22.10 would delete) |
| **X-07** | A settings-only change never invalidates the artefact, so a raised image cap cannot recover pictures a previous run dropped |

### 2.4 UI — U-01, U-02, U-03, U-04, U-07, U-08, U-09, U-10, U-11, U-13, U-16, U-17

FINDINGS §10 carries each one. Three rules apply to all of them:
**mobile mirrors web in the SAME session** (`clinqetmobilepartnerapp`); **every string is a localization key
in `en.json` and every other language file**; and **no technical word a provider can read** — say *page*,
*text*, *document*, *source*, *answer*, *saved*, never *passage*, *chunk*, *index*, *embedding*, *retrieval*,
*token*, *blob*, *schema*. A brand-new screen or state needs an approved mockup under
`C:\Nik\Data\mockups\<sheet-name>\index.html` **before** integrated UI code, registered in `PLAN.md` the day
the owner says yes (§0.20).

### 2.5 Inherited from Phase 1

`phase-1\HANDOVER.md` §6 lists six items. E1/R-12's contradiction is the first thing to settle.

---

## 3. Owner's coding standards (verbatim — they apply to every line you write)

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

QUALITY OVER SPEED. Expect the unexpected: healthcare, heavy equipment, insurance, banking, legal, resumes, menus, flyers, photos of price lists, any language (Gujarati/Hindi/Punjabi/French/Chinese/Korean/Arabic), any layout (two columns, tables split across pages, merged cells, one/two/three-line prices).

---

## 4. Method

1. **Read first, in the order of §0.** Never skim a large file.
2. **Present the §1 decisions and wait.** No code before the owner's yes.
3. **Plan, then build.** State the plan; say what each change costs; highlight your recommended option with
   the why (standards §7).
4. **Tests live with the runtime consumer** (§0.18). A money, schema, unique-index, atomic-counter, webhook
   or Service Bus change needs **integration tests against real engines** (Testcontainers + the Cosmos
   emulator) — §0.8 makes them mandatory, not optional. E1's replace semantics and the retry/backoff of R-5
   are exactly that class.
5. **Idempotency is not optional.** Every Service Bus handler must survive redelivery with the same result.
   Prove it with a replay test, not an argument.
6. **Sabotage every new guard once.** Install the inversion, run the filtered suite, watch it FAIL, revert
   from a scratchpad copy — **never through git** (§0.19). Verify the sabotage actually installed: a pattern
   that silently matched nothing proves nothing (Phase 1 hit this twice).
7. **Invent adversarial inputs AFTER implementing.** A rule proven only on the corpus that shaped it is
   unproven. Phase 1's `ADV` battery found two real defects this way — one of them glued every
   continental-European price list into a single line. Build the equivalent for failure paths: a DI outage
   mid-document, a replacement that fails after the blob is gone, a redelivery that arrives while the first
   delivery is still writing, a judge that removes everything, a draft edited between extraction and
   approval.
8. **‼️ MANDATORY LIVE PROOF on the retained fixtures.** Not optional, not a summary of unit tests:
   - `kaudit reprocess ca SX3SG2 <docId>` → `wait` → `pull` for the fixtures your change touches, and diff
     `cards.txt` / `row.json` / `drafts.json` against `evidence\ca-live-batch\<doc>\`;
   - **drafts on a MATCHING business**: create (or extend) a test business whose selected categories are a
     salon, an auto-repair shop and a clinic, push the drafts corpus there, and show the drafts each price
     shape produces. `SX3SG2` cannot prove the drafts lane — its judge correctly removes those lines;
   - `kaudit alerts ca <docId>` after each run: a real remaining uncertainty must alert, and **nothing false
     may alert**;
   - `kaudit drift ca` must show row `passageCount` equal to the index count for every document;
   - `kqueue knowledge-ingest-dev` for L-11: the two dead-letter tickets, and that your sweep drains them;
   - `kreplay --all <evidenceRoot>` (Phase 1's tool) when you change anything downstream of the parse — it
     replays LIVE artefact block streams through HEAD with no deploy and reports word conservation.
   If the code must be on the stamp for a proof, say so plainly and give the owner the exact commands, as
   `phase-1\HANDOVER.md` §5 does.
9. **Do not build while another session works in `C:\Nik`.** Never `git checkout/restore/reset/stash/clean`.
   Nothing committed, pushed or deployed by you.
10. **Leave the tree clean** (§0.16): every scratch file deleted, `git status --porcelain` inspected and
    clean of anything you did not intend to keep, and say in your summary what you removed.

---

## 5. Phase-2 multidimensional audit (the phase is not complete without it)

When you believe you are done, audit your own work as a hostile reviewer and write
`C:\Nik\Data\knowledge-extraction-fix-plan\phase-2\AUDIT.md`. Every dimension answered with evidence:

1. **Bugs** — every defect you found, including the ones you caused and fixed.
2. **Gaps** — anything in scope you did not close, with the reason. ‼️ §1A.2 (the wrapped service name, D10) is named explicitly: state its verdict, with the live draft that proves it. Under the owner's ruling a gap needs the
   owner's explicit acceptance **quoted from your conversation**; without it, it is an open question, not a
   deferral.
3. **Missing functionality** — what the findings promised a provider that still does not exist.
4. **Logical gaps** — paths no test reaches and no reader would notice: a retry that re-enters a half-written
   commit, a notice that contradicts the row's status, a draft whose source card no longer exists.
5. **Regression** — full corpus + fixture before/after explained line by line; the
   `C:\Nik\knowledge-table-hunt` harness still passes (Phase 1 left it at **103/103**); every existing test
   in all three hosts green, with counts.
6. **Sabotage sweep** — each new guard inverted once, the filtered run, the failure, listed.
7. **Live pipeline** — the documents you ran, their docIds, the cards and drafts you read back, the alerts
   raised, and that **nothing false was alerted**.
8. **Idempotency** — redelivery proven, not argued: the same message twice, the same result, no duplicate
   card, draft, notification or charge.
9. **Cosmos and RU** — every query partition-scoped (§0.6), the RU per ingest and per draft run stated
   before and after, no new wide index path.
10. **Alerts** — what fires, when, and what can no longer fire falsely.
11. **Localisation, web AND mobile** — every new string a key in `en.json` **and every other language file**;
    the mobile partner app shipped in the same session; no technical word a provider can read.
12. **Config, ARM and deploy** — every new key read by exactly the host that needs it, class default mirrors
    appsettings, an ARM + `deploy.ps1` entry for any new `local.settings.json` key, no orphan keys.
13. **Comments (§0.14)** — none that narrate; every remaining comment carries a WHY.
14. **Docs and memory** — SKILL ×4 updated (plus any other skill your change touches), memory entry written
    with its `MEMORY.md` line, `PLAN.md`'s phase-2 row marked complete with the date.
15. **Prior work intact** — Phase 1's closures still hold: re-run `DocumentTranscriptionAdjudicationTests`,
    `KnowledgePictureTextTests`, `KnowledgeExtractionFidelityTests`, `KnowledgeDocumentParserTests`,
    `KnowledgeChunkerTests`, `KnowledgeSearchIndexerIsolationTests` and the table harness, and spot-check
    five Phase-1 fixes in the code.

**Fix what the audit finds before marking the phase complete.**

---

## 6. Handover — the last thing you do (none of it optional)

1. Write `C:\Nik\Data\knowledge-extraction-fix-plan\phase-2\HANDOVER.md`: what changed, file by file; what
   was deferred and why (for an extraction item, **quote the owner's words that accepted the deferral**);
   where the evidence is (`phase-2\baseline\`, `phase-2\after\`, `phase-2\live-after\`, `phase-2\AUDIT.md`);
   open questions for Phase 3.
2. **Rewrite `C:\Nik\Data\knowledge-extraction-fix-plan\PHASE-3-PROMPT.md`** so Phase 3 is self-contained,
   keeping **this file's skeleton — nothing dropped**: **§0** read-first list (CLAUDE.md, `PLAN.md`, FINDINGS,
   `phase-1` + `phase-2` HANDOVER/AUDIT, skills, memory, the code end to end, the tools,
   `CANADA-SANDBOX-ACCESS.md`) · **§1** the approval gate with the decisions Phase 3 needs · **§2** its scope
   from `PLAN.md` and FINDINGS, plus anything you deferred to it, with the owner rulings (severity, the
   retained fixtures, drafts proven on a matching business) · **§3** the owner's coding standards block above,
   **verbatim**, ending with "QUALITY OVER SPEED" · **§4** method, with the mandatory live proof on the
   retained fixtures · **§5** the Phase-3 multidimensional audit (the same dimensions, adapted to its scope) —
   the phase is not complete without it · **§6** a handover section that requires Phase 3 to do for Phase 4
   exactly what this section requires of you.
3. **Paste a copy-paste STARTER for the Phase-3 session in the chat** — not only saved to a file (memory:
   *a requested prompt is pasted in chat*). In this order: **(1)** the path
   `C:\Nik\Data\knowledge-extraction-fix-plan\PHASE-3-PROMPT.md` and the instruction to read it completely,
   then `PLAN.md`, FINDINGS and both handovers + audits, before anything else; **(2)** the basic details —
   what Phase 2 changed and proved (counts, docIds, test names), what it deferred and why, where the evidence
   lives, the decisions Phase 3 must get approved first, the fixture rule (the 17 documents in `SX3SG2` stay;
   drafts proven on a matching business), and that sandbox access is in `CANADA-SANDBOX-ACCESS.md`; **(3)**
   the explicit requirement that Phase 3 ends with its own multidimensional audit (`phase-3\AUDIT.md`) and
   then produces the Phase-4 prompt file AND a starter like this one; **(4)** the owner's coding standards
   block above, verbatim, followed by "QUALITY OVER SPEED".
4. **Report honestly at the end**: what is verified (with counts and file paths), what is not, and what the
   owner must deploy, run or decide.
