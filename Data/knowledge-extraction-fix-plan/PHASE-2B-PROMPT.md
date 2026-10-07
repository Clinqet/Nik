# PHASE 2B — finish Phase 2: the drafts lane, the provider's screens, and the live proof

**Phase 2 of the AI Knowledge extraction fix programme is HALF BUILT.** The pipeline-safety half (E1, C1/E2,
C2, E5, E6, R-14's count, C7, X-02, D10) is written, green and partly proven live. The drafts lane, the
provider-facing screens, the hygiene items and **most of the live proof** are yours. Nothing in Phase 2's
scope may be dropped.

---

## 0. Read these completely, in this order, before you touch anything

1. `C:\Nik\CLAUDE.md` — the zero-tolerance rules. §0.7 (schema), §0.7.1 (the other gates), §0.14 (comments),
   §0.15/§0.17/§0.18 (peer hosts, own repo, tests live with the runtime consumer), §0.16 (leave the tree
   clean), §0.19 (**never** `git checkout/restore/reset/stash/clean` in these trees), §0.20 (mockups).
2. `C:\Nik\Data\knowledge-extraction-fix-plan\PLAN.md` — the programme's authority, the four phases, the
   owner rulings and the 17 retained fixture docIds.
3. `C:\Nik\Data\knowledge-extraction-audit\FINDINGS-2026-09-10.md` — **all of it**, including §3 (the decision
   register R-1…R-14), §8 (the live batch), §9 (declared limits), §10 (the 25 UI items).
4. ‼️ `C:\Nik\Data\knowledge-extraction-fix-plan\phase-2\PROGRESS.md` — **what the first Phase-2 session
   built, decided, proved, and got wrong.** Its §4 (gotchas) and §6 (what is NOT proven live) are the two
   sections that will save you the most time. Also `phase-2\PHASE-1-DEFECT-FIX.md`.
5. `phase-1\HANDOVER.md` and `phase-1\AUDIT.md` — Phase 1 file by file, and its five open questions (four
   now ruled on; see §2.7 below).
6. `phase-1\live-after\STEP-ZERO.md` — the live verification of Phase 1 and the five defects it found.
7. `C:\Nik\Data\knowledge-extraction-fix-plan\CANADA-SANDBOX-ACCESS.md` — sandbox access and the `kaudit` /
   `khead` / `kreplay` / `kqueue` / `kpdf` command reference. The Service Bus connection string is already in
   `secrets\ca-servicebus.txt`; **never copy it anywhere** — not into a repo, an `appsettings*.json`, a
   `local.settings.json`, a SKILL, a memory entry or a chat message. Cosmos/Blob/Search credentials are read
   at runtime from `C:\Nik\cosmosindexsetup\appsettings.ca.json`; never copy a value out of it.
8. The skills, fully: `clinqet-voice-assistant`, `clinqet-ai-assistant`, `clinqet-function-app`,
   `clinqet-infrastructure`, `clinqet-cosmos-data`, `clinqet-service-listing`, `clinqet-partner-app`,
   `clinqet-provider-mobile`, `clinqet-testing`, `clinqet-ui-common`.
9. The memory index `MEMORY.md` and every entry it names for knowledge, drafts, write-path, ETag and the
   owner-mandated rules.
10. **The code, end to end** — never skim: `KnowledgeIngestProcessorFunction`, `KnowledgeManagementService`,
    `KnowledgeServiceDraftAnalyticsJob`, `KnowledgeDraftApprovalService`, `KnowledgeOfferingJudge`,
    `KnowledgeServiceDraftBuilder`, `KnowledgeServiceCandidateDetector`, `KnowledgePriceMarks`,
    `KnowledgeInventoryBuilder`, `ProviderSetupServiceWriter`, `DocumentIntelligenceService`,
    `KnowledgeSearchIndexer`, `CosmosDbRepository`, and the knowledge + drafts surfaces in
    `clinqetwebpartnerapp` and `clinqetmobilepartnerapp`.

Then follow this file section by section. **If anything is unclear, ask — never assume.**

---

## 0A. ‼️ STEP ZERO — get the pending work onto the stamp and prove it

✅ **The acceptance test has been RUN — 2026-09-12, after the owner deployed. Do not re-run it to find out; read
the result and act on what it found:** `phase-2\LIVE-ACCEPTANCE-2026-09-12.md`.

- **P1-C is PROVEN LIVE.** Same fixture, two consecutive days: `used '# 2 414' [SourceUnitRestored]` →
  `used '' [SourceUnitNotOnPage]`. The Gujarati price list is now five correct rows where it was machine noise.
- **The cache-identity mechanism is PROVEN LIVE.** `reprocess` does not force-fresh, yet the pages were
  re-read — because `PageCachePolicy` carries the compiled identity of the assembly holding the rules. The
  trap that silently ate a whole phase's work twice is closed.
- **P1-D is PROVEN LIVE, both halves.** The two-column resume went **High "unresolved reading" (9 regions) →
  Low "layout difference only"**, with **zero** content discrepancies where the audit found nine, and its
  EDUCATION card is a clean 51 characters. The trilingual price list has **zero** `remainingUncertainty` —
  the *"5 no-usable-source-reading shapes"* the owner named are gone, all five now correctly
  `SourceUnitNotOnPage`, and the Hindi title appears once.
- **`kaudit drift ca` = 23/23 ok, zero drift.** No false alert was raised by any of the three runs.

### 0A.1 ‼️ YOUR FIRST PIECE OF WORK IS **P2-A**, the defect that run found

**One table cell in the Gujarati price list still publishes OCR garbage, and the judge said so in its own
words before writing it:**

```json
{"fields":["service name"], "reason":"'4211%' reads 'મસાજ'",
 "ocrReading":"4211%", "firstAiReading":"મસાજ", "selectedReading":"4211%",
 "disposition":"SourceReadingRetained", "remainingUncertainty":"no usable source reading"}
```

The image really says `મસાજ` (`tools\kaudit\GenImage.cs:29`). Vision read it correctly. The caption read it
correctly. **Only the OCR was wrong, and only the OCR was published** — into the table card, the summary card
and the aggregate card, three cards from one bad cell.

**The site:** `VisionDocumentTranscriptionService.cs:476-483`, the `third == null` branch, whose stated
premise is *"the machine reading decides the CHARACTERS of one value — that is what it is good at."* **That is
true only when the machine reading is reading TEXT.** When it is OCR of pixels, the two readers are peers, and
in a script OCR handles poorly (Gujarati, Hindi, Thai, Khmer, Arabic, CJK) the vision reader is the better
one. The code grants authority to the weaker reader exactly where it is weakest.

**‼️ The discriminator is PROVEN by the same run — it is the LANE, not the script.** The same Gujarati word,
same pipeline, same day:

| Fixture | Lane | `મસાજ` came out as |
|---|---|---|
| `img_gujarati_pricelist.png` | **rendered pixels** (OCR of a raster) | ❌ `4211%` |
| `pdf_hindi_gujarati_english_pricelist.pdf` | **typed text** | ✅ `મસાજ` |
| `pdf_two_column_prose_resume.pdf` (English) | **typed text** | ✅ correct, P2-A absent |

So a fix keyed on Gujarati, on Indic scripts, or on "this looks like garbage" is a heuristic and is forbidden
by §1A.1. **The fact that decides it is whether the machine reading was reading TEXT or PIXELS.**

**How to fix it — the level, not the symptom** (§1A.1). This programme has answered this shape of question
three times already: the hyphen by the **lane**, re-reading a picture by **whether the lane rendered it**,
cache staleness by **the compiled identity of the code**. `KnowledgeExtractionOutput.RenderedPages` was added
in the Phase-1 defect fix for precisely this question and is the obvious candidate — **verify that before
using it, do not take my word for it.** In particular, check that the signal is available at the adjudication
site (the judge runs inside `VisionDocumentTranscriptionService`, and the flow reaches it from three callers
— ingest, drafts and **provider setup**, §1A.4); if it is not, thread it rather than inferring it.

‼️ **Two ways to get this wrong:**
- **Do not simply flip the branch to prefer the candidate.** That breaks the case the branch exists for — a
  typed document where OCR genuinely does decide the digits. That is a §1A.1 *swap*, not a fix.
- **Do not lose `Correct()`.** It refuses the write when the span holds something else; understand it before
  you touch the branch.

Read `LIVE-ACCEPTANCE-2026-09-12.md` §2 in full — it has the whole diagnosis, the severity argument, and a
second, lesser observation (a vision *fidelity* wobble on row 1, `વાળ કપાવવા` for `વાળ કાપવા`, which raised no
discrepancy at all) that must **not** be conflated with P2-A.

### 0A.2 Then check the stamp

`git -C C:\Nik\<repo> log -1` in `clinqetcore`, `clinqetshared`, `clinqetinfrastructure`, `clinqetfuncations`,
`clinqetapi`, `azureautomation`. The owner has given this programme freedom to **commit and deploy** (§1A.5) —
use it deliberately, say exactly what you are pushing, and never push a red build.

### 0A.3 The rest of the fixture sweep is still owed

Three of the seventeen fixtures were re-run (the three that prove P1-C/P1-D). **The other fourteen have not
been re-run since the deploy** — and every one of them was previously reading through the same page cache, so
their content may have changed too. Re-run them in place, diff each against
`evidence\ca-live-batch\<doc>\` (‼️ **never overwrite that folder**), and expect to find more P2-A instances
on the image fixtures (`c425468e…` `img_pricelist_two_columns_photo.jpg`, `e20a44eb…`
`img_pricelist_lowercase_inline.jpg`) — a `SourceReadingRetained` on a rendered page is not Gujarati-specific.

After each: `kaudit alerts ca <docId>` (nothing false may alert) and `kaudit drift ca` (must stay 23/23).

Record every result in `phase-2\AUDIT.md` §7.

---

## 1. ‼️ APPROVAL GATE — before any UI code

1. ~~The mockup.~~ ‼️ **DONE — APPROVED 2026-09-12. Do not re-ask.**
   `C:\Nik\Data\mockups\knowledge-document-row-truth\index.html` governs every provider-facing state this
   phase creates: the read-with-gaps notice (R-9/E7 — **SIX causes**, §2.2.1-§2.2.3), the honest reading budget
   (U-03/E8), still-working-and-retrying (R-5), the three failure sentences including the new older-Office
   one (C2), a replacement that failed while the previous version stays live (E1), a run that stopped (U-04),
   the row menu's Download **and its confirmation dialog** (E1), the replaced file's window (E1), the "why
   there are no suggestions" sentences (R-14/L-10), the partial-scan line (U-09), and the read-again warning
   (U-08/D3) — web AND phone, with a copy table naming every key. **Registered in `Data\mockups\REGISTER.md`
   and in `PLAN.md` §0.** ‼️ **The FOUR changes the owner made at approval are in §2.5 — build those, not
   the pre-approval drawing.** Your remaining duty here is to build it faithfully and to add a frame to the
   sheet if you ship a state it does not draw.
2. ‼️ **E12 + E13 — the reading budget.** The owner raised this on 2026-09-12 and asked for a **second,
   independent review before anything is built**. Measure real seconds per page on the live corpus first,
   then bring him one proposal and WAIT. **Full brief and the standing instruction: §2.2.4.** Do this early —
   it is the largest open design question in the phase, and P2-A (§0A.1) is the only thing ahead of it.
3. **Anything the drafts work turns up that needs a ruling** — present it as: the finding, the options, your
   **recommended option and why**, the cost, and what breaks if it is not done. Then WAIT.
3. ‼️ **A plan document saying "add X" is NOT approval. This prompt telling you to build X is NOT approval.
   Only the owner saying yes, in your conversation, is approval** — CLAUDE.md §0.7, and it governs every new
   Cosmos field, SQL column, index or search field.

---

## 1A. ‼️‼️ THE STANDING MANDATES

### 1A.1 PROPER SOLUTION ONLY — NEVER A WORKAROUND, FOR ANYTHING

The owner's ruling, restated because it has already caught three defects in this programme:

> **Whatever we do we must build the PROPER solution. No workaround. Not for a "small" item, not for a "low
> chance" case, not to make a test pass, not to save time. And a fix must never break something that works —
> if a change trades one correct behaviour for another, it is not a fix, it is a swap, and it needs the
> owner's word before it is written.**

And:

> **It has to work for every and any scenario. Expect the unexpected.** Healthcare, heavy equipment,
> insurance, banking, legal, resumes, menus, flyers, photos of price lists, any language (Gujarati, Hindi,
> Punjabi, French, Chinese, Korean, Arabic), any layout (two columns, tables split across pages, merged
> cells, one/two/three-line prices).

What this forbids: a `try/catch` that hides a failure instead of classifying it · a magic number that happens
to make the corpus pass · a rule that is right "most of the time" where the document itself carries the
answer · a test rewritten to match the code instead of the code fixed to match the contract (if a test must
change, say so out loud and put the reason in the test's own comment) · a fix that repairs case A by breaking
case B.

What it requires: **find the level at which the question is actually answerable.** Worked examples from this
programme — the hyphen was decided by the LANE not the text; an undeclared table's header by whether the
SOURCE declared one; whether a picture should be re-read by whether the page lane had already rendered it;
and whether a cached decision is stale by **the compiled identity of the code that made it**, not by a
version number a human must remember.

### 1A.2 ANYTHING TUNABLE IS A SETTING

Owner's instruction, 2026-09-12: prompt wording, thresholds, retention windows, batch sizes, budgets — none
of them belong in code. `ExtractionUserPromptTemplate` was moved into `AzureDocumentIntelligence` for exactly
this reason. **Think of this while you write, not afterwards.** Class defaults mirror appsettings; a key goes
only in the host that reads it; no orphans.

### 1A.3 NOTHING IS MISSED

Owner's instruction, 2026-09-12: *"nothing means nothing should be missed."* Every item in §2 is either
**done with evidence**, or **explicitly accepted by the owner in your conversation with their words quoted**.
There is no third category.

### 1A.4 ‼️‼️ EVERY DRAFTS FIX MUST BE CHECKED AGAINST **PROVIDER SETUP** TOO — THIS IS NOT OPTIONAL

> **Owner, 2026-09-12, verbatim:** *"Remember provider setup, this knowledge base, and the draft service
> extraction, they all follow the same path, same sort of algorithms. So if this fix applies there, we need to
> make sure it going to fix or improve that provider setup path as well. So can you make sure write it down in
> bold letters highlighted so that the next 2.5 session will never ever going to miss this? That it needs to
> just check and make sure of that as well."**

**You may not close a single D-item until you have opened the provider-setup files and answered, in writing,
whether the same defect lives there.** "It shares the path so it is fixed" is a guess, and §1A.1 forbids
guesses. I traced it — here is what is actually true, so you start from fact:

**The path they genuinely SHARE** (a Phase-1/Phase-2 fix here lands in provider setup automatically — but you
must still **prove** it there, because "it compiles into both" is not evidence):

| Shared component | Where provider setup enters it |
|---|---|
| `KnowledgeDocumentParser.ParseLayoutMarkdown` | `ProviderSetupDocumentReader.cs:149` |
| `DocumentIntelligenceService` (incl. the new failure classification + the settings-backed prompt) | `ProviderSetupDocumentReader.ReadWithDocumentIntelligenceAsync` |
| `VisionDocumentTranscriptionService` + **the page-cache policy key** | `ProviderSetupDocumentReader.TranscribeWithVisionAsync` → `TranscriptionVerificationFlow.ProviderSetup`, scope `ServiceIdentityAndPricing` |
| `DocumentTranscriptComparer` (the multilingual tokeniser repair, the digit-range guard) | via the judge above |

⇒ P1-A…P1-E, the Indic tokeniser fix and the cache-identity fix **already apply to provider setup**. Prove at
least one of them live on a real provider-setup run before you claim it.

**The part they DO NOT share — and this is the trap:**

- The knowledge drafts lane **parses prices out of text** (`KnowledgeServiceDraftBuilder.ParsePriceNumbers`,
  `KnowledgeInventoryBuilder.ParseNumeric`).
- Provider setup **receives prices as structured fields from the model** and writes them in
  `ProviderSetupServiceWriter.cs` (~lines 257–296: `svc.Price`, `svc.PriceType`, `NormalizePriceType()`,
  `HourlyRate` / `FixedPrice` / `StartPrice` + `MaxPrice`).

⇒ **D1, D2, D5, D6, D7 and L-9 do NOT automatically fix provider setup.** The same *defect* may still be
there in its own shape, and it will not show up in any knowledge test. For each one, ask the question again on
that side and record the answer:

| Drafts defect | The question to ask of provider setup |
|---|---|
| **D1** per-unit price | Does `$95/hr` / `$45/visit` / `$3/sq ft` arrive as `PriceType=hourly, Price=95` — or as a dropped/zero price and a service written with no money at all? |
| **D2** multi-price rows | `Haircut Men $20 Women $30` — one service with one price, two services, or a silent loss of a tier? (`Service.Pricing` has no variant list on either side) |
| **D5** ranges | `30 - 45` and `$20—$30`: does `range` get `StartPrice`+`MaxPrice`, or fail `"range" => StartPrice > 0 && MaxPrice > 0` and get written as nothing? |
| **D6 / L-9** currency | `US$45`, `30 dollars`, `₹1,05,00,000`: is there a currency-blind ceiling or a CAD assumption on this side too? |
| **D7** tax + internals | Is `TaxIncluded`/`TaxRate` written where the provider cannot see it, and can a SKU/URL become the public description? |
| **D3** provider edits | `ProviderSetupServiceWriter.cs:117` already claims a price edit is never replayed over — **verify that claim**, it is the same class of bug D3 fixes |

**A fix that improves provider setup is a WIN, not scope creep** — the owner has explicitly asked for it. A
fix that would *break* provider setup is a §1A.1 swap and needs the owner's word first. Either way: **say
which, for every D-item, in `phase-2\AUDIT.md`.** An item with no provider-setup answer is an unfinished item.

### 1A.5 ‼️‼️ THE CANADA SANDBOX IS A SANDBOX — TEST ON IT WITHOUT FEAR

> **Owner, 2026-09-12, verbatim:** *"Do not shy away from testing in the live business, live data in our
> Canada region. Remember, there is nothing in production. They all are our dummy accounts, dummy fake
> accounts. It's all sandbox. So make sure you write it down that do not afraid, go nuts on it."**

**There is NO production.** Every business, every document, every draft in Canada is a dummy account created
for this work. You have the owner's explicit permission to **create businesses, upload files, push tickets,
force failures, drain queues, re-run fixtures and delete what you created**, from your machine, against the
deployed pipeline, as much as the work needs. A unit test is not proof; a live run is. **If you find yourself
writing "this could not be verified live", that is a choice you made, not a constraint you hit** — say why in
one sentence and expect it to be challenged.

The three standing limits are unchanged and are about **not destroying someone else's work**, not about
caution:

1. **The 17 fixture documents in `SX3SG2` are never deleted** before Phase 4 — re-run them **in place** with
   `kaudit reprocess`. `evidence\ca-live-batch\` is never overwritten.
2. **Never `git checkout` / `restore` / `reset` / `stash` / `clean`** in these trees (§0.19) — other sessions
   have uncommitted work in them. Never build while another session is building.
3. **Never copy a credential anywhere.** The Service Bus string stays in `secrets\ca-servicebus.txt`; Cosmos /
   Blob / Search are read at runtime from `C:\Nik\cosmosindexsetup\appsettings.ca.json`. Not into a repo, an
   `appsettings*.json`, a `local.settings.json`, a SKILL, a memory entry or a chat message.

You also have the owner's standing permission (granted 2026-09-12) to **commit and deploy** — shared → core →
infrastructure → Functions → API — so a fix that needs the deployed host to be proven gets deployed and proven
in the same session, not deferred to the next one.

---

## 2. Scope — every remaining item

Owner's standing rulings: **severity is High/Critical for every extraction finding whatever badge it
carries** · **the 17 fixture documents in `SX3SG2` are retained** (re-run in place, never delete; Phase 4
deletes them through the real purger) · **drafts must be proven on a business whose selected categories
match the documents** — `SX3SG2` is a heavy-equipment dealer and its judge correctly removes salon/auto/
clinic lines.

### 2.1 Drafts you can trust — the main body of work

| Id | What |
|---|---|
| **D1** 🔴 | **Per-unit prices never become draft services.** `$95/hr`, `$45/visit`, `$3/sq ft`, `₹500/day` are detected, judged and extracted, then the anchor cannot parse the number and the row is dropped — reported as a clean run. The dominant price shape for plumbers, electricians, cleaners, movers, caterers and rentals produces **zero** drafts. `KnowledgeServiceDraftBuilder.ParsePriceNumbers` / `KnowledgeInventoryBuilder.ParseNumeric` |
| **D2** 🟠 | **Multi-price rows.** Owner ruled **one draft per tier**, tier label in the name (`Haircut (short hair)`), because `Service.Pricing` is a single-price model with no variant list — verified in `clinqetcore/Entities/COSMOS/Cosmos.cs:488`. Covers `Haircut Men $20 Women $30`, `Service \| Short \| Medium \| Long`, `Colour $50 / $70` |
| **D3** 🟠 | **Provider edits to pending drafts are overwritten by any re-run**, and drafts dismissed/approved during a long run are resurrected. Merge into the existing Pending row keeping provider-owned fields; re-read decided hashes before reconcile, or upsert with ETag. Ships with **U-08** (the warning is already drawn on the mockup) |
| **D4** 🟡 | Judge answer `{"verdicts":[]}` with finish `stop` silently removes the whole batch; the judge is offered an undefined `Duplicate` reason, so a legitimate price change can be removed before the matcher sees it. Treat empty verdicts for a non-empty batch as a failed attempt; define `Duplicate` as "twice in THIS document" |
| **D5** 🟡 | Spaced ranges under a price column (`30 - 45`) are unmarked while glued `30-45` is; glued em-dash ranges (`$20—$30`) never anchor. One joiner set shared by mark, range and anchor |
| **D6** 🟡 | `US$45`/`AU$45`/`30 dollars` becomes a CAD service at the USD figure with no mismatch chip; `MaxAllowedPrice` is currency-blind. Carry the ISO code beside the mark; express the ceiling per currency |
| **L-9** 🟠 | **A ₹1,05,00,000 excavator silently vanished** (7 candidates → 2 drafts) — the same currency-blind ceiling, measured live. Same fix as D6 |
| **D7** 🟡 | `TaxIncluded`/`TaxRate` written to the service while invisible on the card; feed internals (ids, SKUs, URLs) become the public description; any currency mark on a row can anchor a wrong extractor item. Ships with **U-11** |
| **D8** 🔵 | Same name+price under two headings collapses to one draft; `SourceName` drops digit tokens (`Facial 60 min` → `Facial min`); cap trims and budget-expiry partials invisible; dispute index matches by substring; value-first OCR runs yield 0 drafts silently; all-caps names lose acronyms; a business with no country resolves to USD |
| **D9** ⚪ | `from $50` / `$80+` can never be approved without inventing a maximum (owner-locked); a list page costs 7 Cosmos queries; the SKILL says 25 settings keys and the class has 37 |
| **D10** | ‼️ **BUILT, NOT PROVEN.** `BuildExtractorText` now carries a candidate's unpriced preceding line. **Must be proven live on the matching-category business**: a lower-case wrapped price list must produce the draft `gel manicure with french tips`, and a heading-led list must NOT absorb its first section word into any draft name |
| **G-L1** 🟠 | **Four of six Canada documents said Ready with passages while the index held zero cards** and nothing detected it. Build the scheduled row⇄index reconciliation per business (cheap `top=0` counts), re-enqueue drifted documents, one admin alert. `hasKnowledge` should be derived from or verified against the index |
| **L-11** 🟠 | **Two dead-letter tickets have sat in `knowledge-ingest-dev` since 2026-08-18** for documents whose rows are gone. Nothing alerts on a dead-lettered knowledge ticket and nothing drains the queue. Build the alert + the periodic sweep, and **drain those two live** (`kqueue knowledge-ingest-dev`) |

### 2.2 Pipeline safety — what is left

| Id | What |
|---|---|
| **E3** 🟡 | Request-token cancellation between a committed row write and its enqueue strands the row. Run the enqueue and its compensation on `CancellationToken.None` (the delete path already does) |
| **E4** 🟡 | The "document failed" push prints a literal `{0}` for `Error_KnowledgeSpaceFull` — the reason is a format argument and its own placeholder is never expanded |
| **E7 / R-9 / H2** | ‼️ **The degraded-but-Ready notice — see §2.2.1, it is NOT a picture notice** |
| **E8** 🟡 | The polling ladders stop after ~5.6 minutes and call a healthy run "stuck" while the server allows 30. **Serve the ingest budget in the list DTO** and size the ladder from it (mockup A3/A4). Ships with **U-03** and **U-13** |
| **E9** 🔵 | Zero-byte blobs cost a DI call and an ops alert · **unconfirmed uploads are never swept** (this is also where a failed replacement's candidate blob must go) · the passage cap has two sources of truth · a Ready document whose analytics ticket failed raises a false "stuck Processing" alert · a contradictory `IsReplace` returns 500 · the source file is held three times in memory · the identical-content short-circuit has an unreachable branch and a test for it |
| **E10** 🔵 | The oversized-caption alert passes `row.DocName` in the document-id argument |
| **E11** | The dead-letter half of L-11 |
| **E12** 🔴 | ‼️ **We accept documents we cannot finish, and nothing continues them. See 2.2.4** — owner-raised 2026-09-12. Carries with it: the dead `PageConcurrency` dial (delete or make authoritative), the page cap made visible in the UI with its numbers, the unbudgeted rasterization, and splitting the artefact so a continuation stops repaying the full Document Intelligence call |
| **E13** 🔴 | ‼️ **Work already paid for is discarded when the budget trips** — the per-page cache write rides the budget cancellation token, so a page whose model call returned but whose write had not finished is lost and bought again. Same shape as E3. See 2.2.4 |

#### 2.2.1 ‼️ E7 / R-9 — the degraded-but-Ready notice. **SIX causes, not one.**

> **Owner, 2026-09-12:** *"so is it just always going to be picture? remember we need to be solid and our
> solution and work need to handle all and every single edge case scenario end to end fully means fully and no
> workaround or shortcut."*

**No. A picture-only notice would be a §1A.1 workaround.** A run can reach **Ready** having quietly lost any
of SIX different things, and **today every one of them is told to ADMINS ONLY** — a log line or an alert the provider
never sees. I traced every one; build the notice as a **family**, and never a single hard-coded sentence:

| # | What was lost | The signal that already exists | Where |
|---|---|---|---|
| 1 | **Pictures the lane could not produce at all** | `imageLane.LostPictures` → `artifact.ImageLaneDegraded` | `KnowledgeIngestProcessorFunction.cs:784`; retried once at `:643` |
| 2 | **Pictures trimmed by the per-document cap** | `imageLane.Dropped` → `artifact.DroppedImages`, from `KnowledgeImageStore.SelectWithinCap` | `KnowledgeImageStore.cs:154`, `…Function.cs:780` |
| 3 | **Pictures stored but never described** ⇒ they cannot be sent to a caller | `KnowledgeImageCaptionResult Undescribed` (three return sites) | `KnowledgeImageCaptionClassifier.cs:36,117,164,195` |
| 4 | **The detailed reading degraded** — ‼️ **THREE different causes, see 2.2.2** | `artifact.VisionDegraded` | `…Function.cs:647`; the definition is `IVisionDocumentTranscriptionService.cs:99` |
| 5 | **Overview sentences dropped** for stating a figure the document does not contain | the drop at `:943`, the admin alert at `:1458` | `…Function.cs:932–943` |
| 6 | ‼️ **Pages where the machine reading was kept after a source check** — **not reported as degraded at all today** | `PagesSourceRetained` | see 2.2.3 — **this is where P2-A lives** |

Also check **`MaterialExcerptBuilder.cs:74,103,116`** (`photosDropped` → `truncated`): the same loss can happen
again at *delivery* time, after a perfectly clean run. Decide whether that is a sixth cause or a delivery-side
concern, and **say which**.

**Requirements:**

- **One shape, N causes.** The provider sees the cause that happened, in their own words, with the count
  (`2 pictures`, `3 pages`). Two or more causes become a **short list in one notice**, never two stacked
  banners — the mockup's third A2 frame draws exactly this.
- **The sentence comes from the SERVER** (an `Info_Knowledge…` key, all five languages), so the screen and the
  notice can never drift apart in translation. The web and phone render what they are given.
- **It must be dismissible and it must not come back** once dismissed for that run — but a *new* run that
  degrades again raises it again.
- **Cause 4 self-heals**: the next attempt re-reads those pages. Do not leave a notice claiming a degradation
  the pipeline has already repaired.
- **A clean run shows nothing.** No "0 pictures lost", no empty banner, no reserved space. ‼️ Prove this —
  a false notice on a good document is worse than no notice.
- **Live proof required on every cause**, not unit tests alone: force each one on the Canada sandbox (§1A.5
  gives you permission to do exactly that) and show the provider-visible result.

#### 2.2.2 ‼️ “Reading it again helps” is TRUE for some causes and FALSE for others — never say it blindly

> **Owner, 2026-09-12:** *"we say 'Reading it again often helps' — why, and if they do the re-read how does it
> help? we need the proper work. If re-reading, how does that help?"*

A first draft of this sheet said *"3 pages of this file were harder to read than usual … Reading it again
often helps."* **Both halves were wrong.** `VisionDegraded` is not one thing:

```csharp
// IVisionDocumentTranscriptionService.cs:99
public bool Degraded => BudgetExhausted || RasterizationFailed || PagesUnreadable > 0;
```

| Cause | Scope | Does a re-read help? | The proof, in the code |
|---|---|---|---|
| **`BudgetExhausted`** | ‼️ **the WHOLE document**, never “N pages” — *“a TIME budget, never a partial page range … so the whole document keeps its OCR text”* (`VisionDocumentTranscriptionService.cs:265`) | ✅ **YES, provably** | pages finished before the cut were already written to the page cache, so the next attempt reads them for free (`fromCache`) and spends a **fresh full budget** on the rest. The alert says it in as many words: *“Transcribed pages stay cached for the next attempt.”* (`:272`). `retryDegradedVision` (`…Function.cs:647`) makes sure the artefact is not replayed, so the re-read actually happens |
| **`PagesUnreadable > 0`** | those pages | ✅ usually | a hard failure or a twice-truncated answer is normally transient, and every other page is cached |
| **`RasterizationFailed`** | the document | ❌ **no** | same file, same renderer, same outcome. The honest action is **Replace file**, not Read again |

**So the copy splits by cause, and the “Read again” action is offered ONLY where it does something.** The
approved sheet now writes the budget case as *“We ran out of time reading this file, so we used a quicker
reading for all of it… The pages we finished are saved — read it again and we'll carry on from where we
stopped”* — specific, and provably true.

‼️ **The general rule, and it outlives this item: never write a sentence that promises an outcome until you
have found the code that delivers it.** I wrote that sentence before checking, and it was wrong in three ways.

#### 2.2.4 ‼️ E12 — the time budget cannot finish the documents we accept, and NOTHING continues them

> **Owner, 2026-09-12:** *"timeout is a big deal then shall we increase our timeout — and it is async anyway,
> so how can we have the timeout so that most of the process will finish? What does that look like?"* He had
> been seeing budget-exhausted alerts while testing.

**The measured facts** (all verified, not estimated):

| Dial | Value | Where |
|---|---|---|
| `Voice:Knowledge:MaxPagesPerDocument` | **100** | Functions `appsettings.json:1180` |
| `…Vision:PageConcurrency` | 4 — ‼️ **but the EFFECTIVE ceiling is `min(this, AiBudget:MaxBulkConcurrency)`** | `VisionTranscriptionSettings.cs:117` |
| `AiBudget:MaxBulkConcurrency` | **2** ⇒ effective concurrency is **2**, not 4 | Functions `appsettings.json:1540` |
| `…Vision:TimeBudgetSeconds` | **900** | Functions `appsettings.json:1307` |
| `functionTimeout` | 45 min | `host.json` |
| `maxAutoLockRenewalDuration` | 60 min | `host.json` |

```
100 pages ÷ 2 at a time = 50 sequential rounds
900s ÷ 50 rounds        = 18 seconds per page
```

**A luna page transcription at Medium reasoning with up to 6000 completion tokens does not reliably land in
18 seconds.** The page cap and the time budget were set independently and contradict each other: *we accept
documents we cannot mathematically finish.* `PageConcurrency: 4` is also dead config today — its own comment
says raising it alone buys nothing.

**And there is no automatic continuation.** Budget exhaustion does **not** throw — it returns a degraded
result and the row completes **Ready**. R-5's scheduled retry keys on `KnowledgeIngestRetryableException`, so
it never fires here. The only way a long document ever finishes is a human pressing "Read again" repeatedly,
once per budget's worth of pages. ‼️ **That is workaround-shaped behaviour and §1A.1 forbids leaving it.**

**What the two readers actually are** (the owner asked; answer it the same way in any provider copy):

| | The **fast reader** | The **smart reader** | The **source check** |
|---|---|---|---|
| What | Azure Document Intelligence OCR | `gpt-5.6-luna` looking at a **picture of each page** | a second model settling a disagreement |
| Code | `DocumentIntelligenceService` | `VisionDocumentTranscriptionService` + `VisionPageTranscriber`, pages rasterized by `DocumentPageRasterizer` at `PageRenderMaxEdgePixels: 1024` | `DocumentTranscriptionVerifier` |
| Calls | **one per DOCUMENT** | ‼️ **one per PAGE** — this is why only this one has a time budget | only on disagreeing pages, capped at `MaxVerifiedPagesPerDocument: 8` |

**What the budget actually covers** — verified at `VisionDocumentTranscriptionService.cs:121-124`:
*"The budget covers the transcription window only — rasterization ran before it opened."* So the 900s is the
per-page model calls plus the source checks **inside** that window. ‼️ **Rasterization is UNBUDGETED** — 100
pages of rendering happen before the clock starts and are charged to nothing. Check that too.

**What a re-run skips, exactly** (the owner asked — and the answer exposes waste):

| Layer | Re-used on a re-run? |
|---|---|
| Content artefact (whole parse) | ❌ **bypassed** when degraded — `retryDegradedVision`, `…Function.cs:647` |
| **Fast reader (Document Intelligence)** | ❌ ‼️ **RE-RUN IN FULL, every continuation** — *"the only thing repaid is the parse"* (`…Function.cs:642`) |
| **Smart reader, per page** | ✅ **skipped for every page already cached** — this is the resumption |
| Image captions | ✅ reused (business-wide caption map) |

⇒ **The smart reader resumes where it stopped; the fast reader is paid for again from scratch.** For a
100-page document that is a real, repeated cost on every continuation. **Fixing this is part of the work:
split the banked artefact so the parse layer can be reused while the vision layer is redone.**

---

**‼️ E13 — a NEW defect found while answering this. Work we PAID FOR is thrown away at the cut.**

```csharp
// VisionDocumentTranscriptionService.cs — inside Parallel.ForEachAsync, token IS the budget token
await TryWriteCacheAsync(request.CacheContainer, cacheBlob, new CachedPage(accepted, …), token);
```

`budget.CancelAfter(TimeSpan.FromSeconds(TimeBudgetSeconds))` cancels that same `token`. So when the budget
trips, **a page whose model call had already returned but whose cache write had not completed is cancelled and
lost** — the money is spent, the answer is discarded, and the next continuation pays for it again. Up to
`PageConcurrency` pages per cut, every cut.

**The fix is the same shape as E3:** the model call belongs on the budget token; **the cache write of a result
already paid for does not.** Write it on `CancellationToken.None` (bounded by its own short timeout), exactly
as the compensation path already does. ‼️ Verify the claim before fixing, then prove it with a test that trips
the budget mid-write.

---

**The fix, in priority order. ‼️ Raising the timeout alone is NOT the fix** — a 200-page document would still
fail, just later, while eating the function's headroom (and a run KILLED at 45 min is worse than a degraded
one: the invocation dies mid-write).

**Every option considered, so the next session does not re-derive them:**

| # | Option | Verdict |
|---|---|---|
| A | **Raise `TimeBudgetSeconds`** | ❌ not a fix — moves the cliff, does not remove it; spends function headroom; risks a KILLED invocation, which is strictly worse than a degraded one |
| B | **Raise concurrency** (2 → 4) | ⚠️ real win — **same money, half the wall-clock** — but system-wide, and it only moves the cliff too. Complement, never the answer |
| C | **Lower `MaxPagesPerDocument` to what the budget can finish** | ❌ alone — a 100-page price list is a legitimate document (`MKC85P` holds 173-passage pharma packs). Refusing them is a product regression. But the cap and budget MUST be made consistent whichever way |
| D | ‼️ **Self-continuation** | ✅ **RECOMMENDED — see below** |
| E | **Split the artefact** so a continuation reuses the parse and redoes only vision | ✅ **do it with D** — otherwise every continuation repays the full Document Intelligence call |
| F | **One queue message per PAGE** | ❌ over-engineering. The queue is session-enabled per business so pages would serialize anyway; 100× message volume; assembly and completion-detection machinery for an outcome D already reaches |

**‼️ D — SELF-CONTINUATION, in detail.** Progress is **already durable** in the page cache, so this is a
resumable job that stops short and waits for a human — which is the workaround §1A.1 forbids. When the budget
expires with pages still unread, **enqueue a continuation ticket**; the mechanism already exists
(`ScheduleRetryAsync`, `payload.Attempt`). The row stays in the **Taking longer** state the approved mockup
already draws rather than going Ready-but-rough, and the degraded notice appears only once the bounded
continuations are spent. *Why this one: it turns the budget into a safety valve instead of a guess, and it is
the only option under which a 500-page document also works.*

**The bounds — every one of these is required, and each is evidence-based, not a guessed number:**

1. **A progress requirement.** A continuation that transcribes **zero NEW pages** stops, permanently. ‼️ This
   is the real anti-loop guard: it terminates a poison page, a model outage, and a document that simply
   cannot be read, **without anyone choosing a magic number**.
2. **A max-continuations ceiling**, derived not invented: `ceil(MaxPagesPerDocument × measured per-page
   seconds ÷ TimeBudgetSeconds)` plus slack. A setting (§1A.2), with the class default mirroring appsettings.
3. **The existing per-document AI ceiling still applies**: `AiAttemptBudgetPerDocument: 6000`, sliced per
   delivery at `…Function.cs:260`. A continuation must **consume from the same budget**, never reset it — so
   total spend per document is already capped no matter how many continuations are allowed.
4. **Re-check every limit on every pass.** The code already does this for the page cap (*"a lowered page cap
   must still bite on a document whose parse was cached"*) — continuations must not become a way to sneak
   past a limit that changed mid-flight.

**Edge cases a continuation MUST survive** (name each one in a test):

- the **document was deleted** between passes ⇒ the continuation finds no row and drops silently;
- the document was **replaced** between passes ⇒ the continuation is holding the old blob; it must detect the
  supersession (`pendingBlobPath` / content hash) and abandon rather than index a stale version;
- a **deploy landed** between passes ⇒ `PageCachePolicy` changes, every cached page becomes a miss, and the
  document effectively restarts. The continuation **count must not reset**, and the progress guard must be
  evaluated against *new* pages, not cache hits;
- **settings changed** between passes (cap lowered, captioning switched off);
- the message is **redelivered** (Service Bus at-least-once) ⇒ a continuation must be idempotent: the same
  page transcribed twice must produce one result, and the continuation counter must not double-count;
- the run is **cancelled mid-continuation** (host shutdown) ⇒ no half-written row, no lost cache entry (E13).

**‼️ Abuse / DDoS — the short-circuit limits. The good news: we are better bounded than it looks.** State this
analysis explicitly rather than assuming it:

| Existing guard | Value | What it bounds |
|---|---|---|
| `MaxDocumentsPerBusiness` | **20** | one business can never hold more than 20 documents ⇒ blast radius per tenant is **20 × 100 = 2,000 pages, ever** |
| Queue **session id = businessId** | — | ‼️ one business's documents process **serially**. A tenant flooding uploads gets a long queue, **not** parallel burn. This is the single strongest protection and it already exists |
| `AiBudget:MaxBulkConcurrency` | **2** | process-wide ceiling on concurrent bulk AI spend across **every** flow |
| `AiAttemptBudgetPerDocument` | **6000** | total AI attempts per document, already sliced per delivery |
| `MaxPagesPerDocument` | **100** | terminal refusal above it (below) |
| `MaxExtractedCharacters` | — | terminal refusal, cards preserved |

⇒ The **new** risk continuation introduces is *repeated work on one document*, and bounds 1–3 above close it.
‼️ **Prove the analysis, do not assert it**: on the sandbox (§1A.5) push a business to its document ceiling
with maximum-page documents and show the queue serializes, the spend stays inside the governor, and nothing
runs away.

**On raising `TimeBudgetSeconds` itself:** there IS headroom (15 min used of a 45-min function, 60-min lock).
**Do not spend it blindly.** First measure what else runs inside the same invocation — Document Intelligence,
rasterization (unbudgeted!), captioning, embedding, indexing, the analytics job — because the budget must
leave room for all of it. Then set the number from that sum, and say what you measured.

**‼️ Dead config must GO, not be documented** (owner, 2026-09-12: *"if some dead config make sure we remove,
so clean coding only"* — CLAUDE.md §22.2/§22.11). `PageConcurrency: 4` is read into
`MaxDegreeOfParallelism` while the governor holds the real ceiling at 2, so the number lies to whoever tunes
it next. **Either** make it authoritative **or** delete it and let `MaxBulkConcurrency` be the one dial —
decide which, and sweep the setting, the class property, the appsettings key and the comment together. Do the
same sweep for any other dial this work proves inert.

**‼️ The page cap must be visible in the UI, not only in an alert** (owner, 2026-09-12: *"we need to make the
100 page limit, if it is more than that we need to display clearly in the UI too"*). The refusal is already
terminal and already localized in all five languages —
`Error_KnowledgeTooManyPages`: *"This file has too many pages. Split it into smaller files and try again."* —
so the plumbing exists. What is missing is **the numbers**: it does not say how many pages the file has or
what the limit is. Make it *"This file has {0} pages. We can read up to {1}. Split it into smaller files and
try again."*, carry both arguments from the refusal site (`…Function.cs:691` and the two pre-count sites at
`:1272` and `:1288`), update all five language files, and **draw the state on the mockup** — it is a state the
server can reach that the sheet does not yet draw, which §0.20 forbids. Best of all, say it **at upload time**
from the pre-count, so the provider learns before waiting for a run that was always going to fail.

---

### ‼️‼️ HOW E12/E13 MUST BE HANDLED — do NOT just implement the analysis above

> **Owner, 2026-09-12:** *"what is your recommendation, and make sure and let the next session review it too
> and explore and recommend it to me its solution, and then I will confirm."*

**Everything above is ONE engineer's reading, written in a single sitting, and it is not approved.** The owner
has explicitly asked for a **second, independent look before anything is built.** So:

1. **Re-derive it yourself. Do not trust my numbers.** Re-read `VisionDocumentTranscriptionService`,
   `KnowledgeIngestProcessorFunction`, `AiBudgetGovernor`, `DocumentPageRasterizer` and the appsettings
   end to end. ‼️ **Verify each claim and say so item by item** — especially: that the effective concurrency
   really is 2; that the per-page cache write really rides the budget token (E13); that a continuation really
   would repay the full Document Intelligence call; that rasterization really is outside the budget; and that
   `MaxDocumentsPerBusiness: 20` + the per-business queue session really do bound abuse the way §2.2.4 claims.
   **If I got something wrong, say it plainly and correct the record** — that is worth more than agreement.
2. **MEASURE before recommending.** The one number nobody has is **real seconds per page** on the live
   corpus. Everything downstream (the continuation ceiling, whether the budget moves, whether concurrency
   moves, whether the page cap is right) is derived from it. Get it from the sandbox (§1A.5) —
   `VisionDocumentTranscriptionService.cs:306` already logs it — across a spread: a typed 5-page PDF, a
   scanned 40-page brochure, a 100-page catalogue, a dense non-Latin page.
3. **Then bring the owner ONE proposal**, in the §1 shape: the finding, the options (A–F above are a starting
   point, **not a closed set** — if you find a better one, propose it), your **recommended option and why**,
   the **cost** (RU, AI spend per document, wall-clock), and **what breaks if it is not done**. Say plainly
   which parts are cheap and safe (E13's token fix, deleting the dead dial, the page-cap copy) and which are
   a real behaviour change (continuation, artefact split, moving the governor).
4. ‼️ **WAIT for the owner's yes.** Then build it in full, with live proof.

**Sequencing note:** E13, the dead-dial cleanup and the page-cap copy are small and independent — they can be
proposed and landed quickly. E12's continuation is the substantial one. **Do not let the small ones be used
as an excuse to defer the big one**, and do not start the big one before the owner confirms.

#### 2.2.3 ‼️ `PagesSourceRetained` — the sixth cause, and its premise is already known to be false

`PagesSourceRetained` counts pages where the transcript lost or invented content and **the machine reading was
kept whole**. It is deliberately excluded from `Degraded`, and the comment says why:

> *"Deliberately NOT part of Degraded: the page holds correct text and the outcome is final, where a degraded
> pass is re-run."*

**P2-A proves "the page holds correct text" false on a rendered page** — that is exactly the branch that
published `4211%` for `મસાજ`. So:

1. **Fix P2-A first** (§0A.1). It will reduce this count, because pages that only looked wrong because OCR won
   will stop being retained.
2. **Then decide** whether what survives still needs a provider-facing sentence, and say which way you went
   and why. If it does, ‼️ **it must NOT offer “Read again”** — that outcome is final by design, and offering
   an action that changes nothing is the same lie in a different place.

### 2.3 Cross-check items

| Id | What |
|---|---|
| **X-05** 🔵 | `FingerprintMatches` returns true when `expected` is empty, so a two-part material ref is sent unchecked — a pre-production back-compat path §22.10 would delete |
| **X-07** 🔵 | A settings-only change never invalidates the artefact, so a raised image cap cannot recover pictures a previous run dropped. **Decide whether the cap belongs in the fingerprint** — and see `PROGRESS.md` §4.2 first |

### 2.4 Formats — owner-ruled, none built yet

- **`.csv` in**: a proper RFC 4180 reader — delimiter sniffing (comma/semicolon/tab/pipe), quoted fields,
  embedded newlines and quotes, BOM and encoding detection, ragged rows, declared or detected header —
  feeding the **same block stream**, so it inherits every rule Phase 1 built. Add to both API allow-lists and
  `KnowledgeDocumentFormats`.
- **Legacy binary (`.doc/.xls/.ppt`) and macro-enabled (`.docm/.xlsm/.pptm`) explicitly refused**, with the
  honest sentence. `Error_KnowledgeLegacyOfficeFormat` already exists in all five languages and the ingest
  already detects a renamed OLE file (C2) — the **upload gate** still needs to refuse them by extension with
  the same sentence.
- ‼️ **The full live format sweep the owner asked for**: one fixture per supported format —
  `.pdf .docx .xlsx .pptx .txt .md .json .html .htm .csv .jpg .jpeg .png .gif .webp .tif .tiff .bmp` — each
  carrying the same price list plus a table, a heading, an embedded picture and a non-Latin section, pushed
  through the **real deployed pipeline** on a Canada business. For each: the cards, the labels, the drafts,
  the alerts, row = index. **Any format whose result is worse than its siblings is a defect, not a limit.**

### 2.5 UI — web AND phone, in the same session

> ‼️ **THE MOCKUP IS APPROVED — 2026-09-12.** `C:\Nik\Data\mockups\knowledge-document-row-truth\index.html`
> (registered in `Data\mockups\REGISTER.md`). **The gate is passed; you do NOT re-ask for approval, and you do
> NOT redesign it.** Build what it draws. If a state you must ship is not on the sheet, add the frame to the
> sheet first, then build it — the sheet stays the truth.

**Four things the owner changed at approval. They are requirements, not suggestions:**

1. ‼️ **ONE STATUS PILL PER ROW, AND ONE STATUS VOICE PER ROW. No exceptions.** This came out of two separate
   owner notes and it now governs every row state on the sheet:
   - **A3** — the banner *"We're reading this file"* duplicated the **Reading** pill and was removed. What it
     carried that the pill could not — **how long this normally takes**, **that you can leave the page** —
     moved onto the row's own meta line, plus a thin moving bar. A box is earned only when it carries
     something the pill cannot. (A4 earns one only when the document is a *replacement*: *"Your current file
     is still answering callers while we work on the new one."*)
   - **A4** — *Reading* + *taking longer* was two pills. **They are not two states; the second is the first
     turned up.** So the **pill itself changes**: blue *Reading* → amber *Taking longer*, same spinner
     slowed, same bar slowed. Never both at once.
   - **A2** — *Ready* + *Worth a look* was two pills. The row's state **is** Ready, and that pill stays; the
     attention signal is a small **amber dot on the Ready pill** (so it is scannable in a long list) plus the
     notice itself, which is already on screen. **Never a second pill competing with the first** — two pills
     make the eye compare them and ask which one is the state.
2. **‼️ EVERY download is gated by a confirmation dialog — B3 and B4 on the sheet, and D4 on the phone.**
   Owner, verbatim: *"make sure that download functionality need to be gated by a confirm dialogue so that a
   user clicking on it by mistake will make sure that it's just not gonna download it."* **A single click or
   tap must never start a download**, from any entry point: the row menu, the replaced-file line in B2, the
   phone action sheet, a swipe action. Cancel is the resting focus; Esc and a tap outside both cancel. The
   **previous-file** dialog says one extra sentence — *"This is not the file answering your callers. You
   replaced it on {date}."* — so nobody downloads last season's price list believing it is live.
3. ‼️ **NEVER PROMISE AN OUTCOME THE CODE DOES NOT DELIVER.** The owner challenged the line *"Reading it again
   often helps"* with *"why, and how does that help?"* — and it was wrong three ways. The verified answer is
   in **§2.2.2**: a re-read genuinely resumes for one cause, is useless for another, and the "N pages" framing
   was wrong for a third. **"Read again" is offered only where it provably does something.** Apply the rule to
   every sentence you write, not just this one.
4. **Modern, not busy.** The owner asked it look modern and futuristic while staying calm. The direction taken
   was **fewer elements, not more decoration**: one status voice per row, motion that means something (the bar
   moves only while work is happening, and stops under `prefers-reduced-motion`), house tokens only.

`FINDINGS` §10 carries each item. **U-01, U-02, U-03, U-04, U-07, U-08, U-09, U-10, U-11, U-13, U-16, U-17.**
Three rules apply to all of them:

- **mobile mirrors web in the SAME session** (`clinqetmobilepartnerapp`), matching the rendering RULES, not
  just shipping a same-named component;
- **every string is a localization key** in `en.json` **and every other language file**;
- **no technical word a provider can read** — say *page*, *text*, *document*, *source*, *answer*, *saved*;
  never *passage*, *chunk*, *index*, *embedding*, *retrieval*, *token*, *blob*, *schema*, *payload*.

‼️ **U-01 and U-02 are the two that lose provider data**: plain Approve / "Add the N shown" / "Add all" send
the page panel's settings and the server's `ApplyApprovalSettings` overwrites the draft's saved location and
area — and the web card even prints the draft's own answer, so the card and the created service disagree.
Mobile "Save and approve" re-sends the panel, discarding the location saved one call earlier (web fixed this
with `settingsOverride`; mobile never mirrored it).

Responsiveness is not optional: phone, tablet, iPad portrait and landscape, **and a folded phone at ~280 pt**.
The phone app must use the app's own patterns (cards, sheets, swipe actions), never the web layout squeezed.

### 2.6 Live proof — mandatory, not a summary of unit tests

- `kaudit reprocess ca SX3SG2 <docId>` → `wait` → `pull` for every fixture your change touches, and diff
  `cards.txt` / `row.json` / `drafts.json` against `evidence\ca-live-batch\<doc>\` (**never overwrite that
  folder**).
- **Drafts on a MATCHING business**: create (or extend) a test business whose selected categories are a
  salon, an auto-repair shop and a clinic; push the drafts corpus there; show the drafts each price shape
  produces — including D1's `$95/hr`, D2's tiers, L-9's ₹1,05,00,000 and D10's wrapped name.
- **E1 live**: a good document, then a replacement that fails, then one that succeeds. Check the row, the
  cards, `_previous/`, the download link, and that `kaudit drift ca` stays clean.
- **R-5 live**: force a transient failure and show the scheduled retry and the recovery.
- `kaudit alerts ca <docId>` after each run: a real uncertainty must alert and **nothing false may alert**.
- `kaudit drift ca` must show row `passageCount` == index count for every document.
- `kqueue knowledge-ingest-dev` for L-11: the two dead-letter tickets, and that your sweep drains them.
- `kreplay --all <evidenceRoot>` when you change anything downstream of the parse.

### 2.7 Rulings already given — do not re-ask

`.csv` yes · legacy and macro-enabled refused · TIFF pages 2..n left alone · the four §9 declared limits kept
· the cross-document caption-context field **added** (built) · R-4/R-12/R-5/R-7/R-9/R-11/R-14 all approved and
built or specified · the previous-file feature is **download only**, hot → cool → delete, **60 days**, no
Archive tier · the download must never expose a raw blob URL.

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

1. **Read first, in the order of §0.** Never skim a large file. `PROGRESS.md` §4 is compulsory.
2. **Step zero (§0A) before any new code.**
3. **Present the §1 decisions and wait.** No UI code before the mockup is approved.
4. **Plan, then build.** State the plan; say what each change costs; highlight your recommended option with
   the why (standards §7).
5. **Tests live with the runtime consumer** (§0.18). A money, schema, unique-index, atomic-counter, webhook
   or Service Bus change needs **integration tests against real engines** (Testcontainers + the Cosmos
   emulator) — §0.8 makes them mandatory, not optional. ‼️ **E1's replace semantics and R-5's retry still owe
   their integration tests**; the first session covered them with unit tests only.
6. **Idempotency is not optional.** Every Service Bus handler must survive redelivery with the same result.
   Prove it with a replay test, not an argument.
7. **Sabotage every new guard once.** Install the inversion, run the filtered suite, watch it FAIL, revert
   from a scratchpad copy — **never through git** (§0.19). Verify the sabotage actually installed, and treat
   a sabotage that PASSES as a finding about your test, not a relief.
8. **Invent adversarial inputs AFTER implementing.** A rule proven only on the corpus that shaped it is
   unproven.
9. **‼️ MANDATORY LIVE PROOF** — §2.6. The owner has given full freedom to exercise the Canada sandbox from
   anywhere, and freedom to commit and deploy. If a proof needs code on the stamp, put it there and say so.
10. **Do not build while another session works in `C:\Nik`.** Never `git checkout/restore/reset/stash/clean`.
11. **Leave the tree clean** (§0.16): every scratch file deleted, `git status --porcelain` inspected, and say
    in your summary what you removed.

---

## 5. Phase-2 multidimensional audit — the phase is not complete without it

Write `C:\Nik\Data\knowledge-extraction-fix-plan\phase-2\AUDIT.md` covering **the whole of Phase 2**, both
sessions' work. Every dimension answered with evidence:

1. **Bugs** — every defect found, including the ones you caused and fixed.
2. **Gaps** — anything in scope not closed, with the reason. ‼️ A gap needs the owner's explicit acceptance
   **quoted from your conversation**; without it, it is an open question, not a deferral.
3. **Missing functionality** — what the findings promised a provider that still does not exist.
4. **Logical gaps** — paths no test reaches and no reader would notice: a retry that re-enters a half-written
   commit, a notice that contradicts the row's status, a draft whose source card no longer exists.
5. **Regression** — full corpus + fixture before/after explained line by line; `C:\Nik\knowledge-table-hunt`
   still passing (103/103 at handover); every existing test in all three hosts green, with counts.
6. **Sabotage sweep** — each new guard inverted once, the filtered run, the failure, listed.
7. **Live pipeline** — the documents run, their docIds, the cards and drafts read back, the alerts raised,
   and that **nothing false was alerted**. Includes the §0A acceptance test and the §2.4 format sweep.
8. **Idempotency** — redelivery proven, not argued.
9. **Cosmos and RU** — every query partition-scoped (§0.6), RU per ingest and per draft run before and after,
   no new wide index path.
10. **Alerts** — what fires, when, and what can no longer fire falsely.
11. **Localisation, web AND mobile** — every new string a key in `en.json` **and every other language file**;
    the phone app shipped in the same session; no technical word a provider can read.
12. **Config, ARM and deploy** — every new key read by exactly the host that needs it, class default mirrors
    appsettings, an ARM + `deploy.ps1` entry for any new `local.settings.json` key, no orphan keys. ‼️ The
    `knowledgePreviousVersionRetentionDays` ARM parameter and `Voice:Knowledge:PreviousVersionRetentionDays`
    **must stay equal** — check both.
13. **Comments (§0.14)** — none that narrate; every remaining comment carries a WHY.
14. **Docs and memory** — SKILL ×4 updated (`clinqet-voice-assistant`, plus `clinqet-ai-assistant` where the
    setup lane shares code), memory entry written with its `MEMORY.md` line, `PLAN.md`'s phase-2 row marked
    complete with the date, the mockup register row written.
15. **Prior work intact** — Phase 1's closures still hold: re-run `DocumentTranscriptionAdjudicationTests`,
    `KnowledgePictureTextTests`, `KnowledgeExtractionFidelityTests`, `KnowledgeDocumentParserTests`,
    `KnowledgeChunkerTests`, `KnowledgeSearchIndexerIsolationTests` and the table harness, and spot-check five
    Phase-1 fixes in the code.

**Fix what the audit finds before marking the phase complete.**

---

## 6. Handover — the last thing you do (none of it optional)

1. Write `phase-2\HANDOVER.md`: what changed, file by file (both sessions); what was deferred and why
   (**quoting the owner's words that accepted it**); where the evidence is; open questions for Phase 3.
2. **Rewrite `C:\Nik\Data\knowledge-extraction-fix-plan\PHASE-3-PROMPT.md`** so Phase 3 is self-contained,
   keeping **this file's skeleton — nothing dropped**: **§0** read-first list · **§0A** step zero · **§1**
   approval gate with the decisions Phase 3 needs (R-8, R-10) · **§2** its scope from `PLAN.md` and FINDINGS
   (F1–F11, H1, H3, H4, B3, X-01, U-05, U-06, U-12, U-14, U-15, U-18…U-25) plus anything you deferred, with
   the owner rulings · **§3** the owner's coding standards **verbatim**, ending with "QUALITY OVER SPEED" ·
   **§4** method with the mandatory live proof on the retained fixtures · **§5** the Phase-3 multidimensional
   audit · **§6** a handover section that requires Phase 3 to do for Phase 4 exactly what this section
   requires of you.
3. **Paste a copy-paste STARTER for the Phase-3 session in the chat** — not only saved to a file. In this
   order: **(1)** the path of the prompt file and the instruction to read it completely, then `PLAN.md`,
   FINDINGS and every handover + audit, before anything else · **(2)** the basic details — what Phase 2
   changed and proved (counts, docIds, test names), what it deferred and why, where the evidence lives, the
   decisions Phase 3 must get approved, the fixture rule, and that sandbox access is in
   `CANADA-SANDBOX-ACCESS.md` · **(3)** the explicit requirement that Phase 3 ends with its own
   multidimensional audit and then produces the Phase-4 prompt AND a starter like this one · **(4)** the
   owner's coding standards block verbatim, followed by "QUALITY OVER SPEED".
4. **Report honestly at the end**: what is verified (with counts and file paths), what is not, and what the
   owner must deploy, run or decide.
