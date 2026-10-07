# Knowledge reading accuracy — NEXT SESSION PROMPT

Written 2026-10-02 (late) by the session that found the problems and built the first half. Audience: the AI session that
continues the build, and the owner who starts it. Everything a new session needs is in this folder; nothing lives only
in a chat.

> **How the owner starts the new session (one line to paste):**
> `Read C:\Nik\Data\knowledge-reading-accuracy\NEXT-SESSION-PROMPT.md end to end, then every file its §9 lists, and continue the knowledge-reading-accuracy build exactly as it says — including the multidimensional audit at the end, with every finding fixed in the same session.`

---

## 0. Before you touch anything

### 0.1 Another session is still auditing the code that is already written — coordinate
The session that wrote this file is, in parallel, doing a **multidimensional code audit** of everything it changed (read
every line; no test runs) and fixing every finding, in the same `C:\Nik` repos. Until `BUILD-STATE.md`'s log has a line
that starts with **`HANDOVER AUDIT CLOSED`**:
- **Do not edit the files the audit owns** (list in §0.3). Read them freely.
- **Do not edit `BankRulesVersionConventionTests.cs`.** The audit may re-pin it. If you change a pinned file before the
  audit closes, `ThePageReadingRules_AreVersioned` will fail on your machine — that is expected; re-pin after it closes.
- Start with work that only touches **new files** or files the audit does not own: PLAN-B step 1 (§5.1) is chosen for
  this — the rasterizer text reads, the raw-bank paths and the new `Reading/` folder.
- Builds are in place and shared (memory `feedback-never-build-while-another-session-works`): if a build fails in a file
  you never touched, it is the other session's half-finished edit — wait and retry, never "fix" it.

### 0.2 The rules this programme hits every hour (all of `C:\Nik\CLAUDE.md` applies)
- Work **in place** under `C:\Nik`; no worktree, no `W:` drive, unless the owner's prompt says so (§0.22).
- **Never** `git checkout -- / restore / reset / stash / clean` (§0.19). To sabotage a file for a guard test: copy it to
  your scratchpad, mutate, run, copy the saved copy back, and compare bytes.
- **No commits, no pushes** unless the owner asks (§21). If asked: linear history only (§0.21), `clinqetapi` last.
- **The owner deploys.** This login cannot deploy (the stamp resources are not in its subscription).
- Scratch files only in your session scratchpad. Delete them at the end and look at `git status --porcelain` in every
  repo you touched (§0.16).
- **Schema (§0.7):** any SQL / Cosmos / Search change → present the §0.7 table and WAIT for the owner's yes. A new field
  on a blob-only JSON shape (page-bank entry, content artefact) is not Cosmos schema, but say so explicitly every time.
- **Mockup gate (§0.7.1, §0.20):** no integrated UI before the owner approves a sheet at
  `C:\Nik\Data\mockups\<sheet-name>\index.html`, registered in `C:\Nik\Data\mockups\REGISTER.md` and in `PLAN.md` §0A.
- **Mobile mirrors web** in the same session. **No hardcoded user text:** keys in all five languages — server
  `clinqetinfrastructure/Resources/Localization/{en,es,fr,gu,hi}.json`, partner web `public/lang/{en-US,es-US,fr-CA,gu-IN,hi-IN}.json`,
  partner mobile `src/Locales/{en,es,fr,gu,hi}.json`. No technical word a provider can read.
- **Tests live in the host that runs the code (§0.18):** the reading pipeline (parser, comparer, adjudication, alerts,
  ingest, drafts) → `clinqetfuncations/Clinqet.Communications.UnitTests` / `.IntegrationTests`; AI setup from a document
  (`McpService`, `ProviderSetupDocumentReader`) and notice wording → `clinqetapi/Clinqet.API.UnitTests` / `.IntegrationTests`.
  Integration tests are mandatory for money paths, Service Bus processors and schema (§0.8).
- **§0.23 rules versions:** page decisions are banked under
  `VisionDocumentTranscriptionService.AdjudicationRulesVersion` = **1**, pinned `(1, "63413934ab1df3d2")` (re-pinned by the
  handover audit, pin-only) in
  `Clinqet.Communications.UnitTests/Conventions/BankRulesVersionConventionTests.cs`. Raise it **once**, at the first step
  that changes how a page is decided (PLAN-B step 4) → 2. Everything later in the programme re-pins at 2 only (nothing is
  banked under 2 until the owner deploys). Pin-only for refactors.
- **Every audit finding is fixed in the same session** (memory `feedback-audit-findings-fixed-this-session`).
- **Explain decisions in the simplest words:** problem → what breaks → fix → do we need it → recommendation.
- Never store a token the owner pastes; read secrets at runtime only; never print a key. Never buy a phone number on
  Telnyx/Plivo, not even in sandbox.
- **Agents and workflows are allowed** (owner, 2026-10-02: "you can utilize the workflow and agent… focus work and not
  miss any"). Use them for read-only review and planning in parallel. Never let two agents edit the same file or build
  the same project at the same time.
- Keep `BUILD-STATE.md` current after every step — it is the resume point if your context is summarised.

### 0.3 Files the running audit owns (read-only for you until `HANDOVER AUDIT CLOSED`)
Everything this programme changed so far (all uncommitted, none deployed):
- `clinqetinfrastructure`: `Services/Knowledge/KnowledgeDocumentParser.cs`, `Services/Knowledge/KnowledgeContentConservation.cs`
  (new), `Services/Knowledge/KnowledgeChunker.cs`, `Services/Knowledge/KnowledgeReadingNotices.cs`,
  `Services/AI/PageMarkdownSplicer.cs`, `Services/AI/Oversize/SectionStitcher.cs`, `Services/AI/TranscriptionVerificationAlerts.cs`,
  `Services/AI/ReadingOutcomeItems.cs` (new), `Resources/Localization/{en,es,fr,gu,hi}.json`.
- `clinqetcore`: `Models/Knowledge/KnowledgeBlocks.cs`, `Models/Knowledge/KnowledgeContentArtifact.cs`,
  `Models/Knowledge/KnowledgeText.cs`, `Models/AI/ReadingOutcomeReport.cs` (new), `Interfaces/AI/ITranscriptionVerificationAlerts.cs`.
- `clinqetshared`: `Enums/AdminAlertType.cs`.
- `clinqetfuncations`: `Clinqet.Communications/Functions/KnowledgeIngestProcessorFunction.cs`,
  `Clinqet.Communications/Functions/AdminAlertProcessor.cs`, `Clinqet.Communications/Services/KnowledgeServiceDraftAnalyticsJob.cs`,
  and their tests (see `git status` in that repo).
- `clinqetapi`: `Clinqet.API/Controllers/Knowledge/KnowledgeController.cs`.
- Partner web (`clinqetwebpartnerapp`) and partner mobile (`clinqetmobilepartnerapp`) knowledge screens, admin web
  `src/pages/alerts/AlertsPage.jsx`, admin mobile `src/services/alertTypes.ts`, `azureautomation/storage.json`.
- Added while the audit runs (its fixes touch them): `clinqetinfrastructure/Services/Knowledge/KnowledgeServiceDraftBuilder.cs`,
  `Services/Knowledge/KnowledgeDraftApprovalService.cs`, `Services/BusinessSearch/BusinessSearchDocumentService.cs`;
  `clinqetshared/Models/AdminAlertSettings.cs`; `clinqetfuncations/Clinqet.Communications/appsettings.json`; admin web
  `src/components/providers/onboarding/StepKnowledge.jsx`; partner mobile `src/apiManager/apiManager.tsx`; the API test
  `Clinqet.API.UnitTests/Services/BusinessSearch/KnowledgeNoticeSingularTests.cs`.

---

## 1. What the owner wants (2026-10-02, in their words where it matters)

- Every document is saved **exactly as printed**: nothing lost, nothing invented, nothing moved to the wrong label. This
  covers knowledge files, **AI quick setup from a document**, and **draft service suggestions** — they share one reader.
  "The heart of our functionality… not a single miss." The fix must be **generic** — every document, language and
  layout — never tuned to the four sample files.
- **Alerts must mean something:** content lost, value moved, value invented, and "the third check could not decide".
  One alert per reading. Four files raised 26 alerts and none of them was about the 43 prices that vanished.
- **Keep the raw AI readings we paid for**, with a real storage lifecycle (hot → cool → delete), so fixing a rule never
  pays the AI again.
- Best practice only: no workaround, no shortcut, no memory or CPU leak, thread-safe, cost-aware. Quality over speed.
- **A multidimensional audit at the end of the work** (§5.8), and every finding fixed in that same session.
- Already approved by the owner: the whole backend plan (PLAN.md §1A, A–F), the UI changes E1–E4 on web and mobile, the
  one-time re-read caused by the rules-version raise, and sandbox freedom (re-upload, "Read again", re-run).
- **Not approved yet:** any schema change, the two new screens that need sheets (§6 and PLAN-D's setup rows), and the
  open owner decisions in §7.2.

---

## 2. The business, the documents and every raw file

### 2.1 Business and documents
- Business **`NKN607`** — Canada sandbox (CA stamp). Its id IS `NKN607`: the blob prefix and the Cosmos partition key.
- The four originals on disk: `C:\Nik\Data\sample\company1_auto_quote.pdf`, `company1_home_quote.pdf`,
  `company2_auto_quote.pdf`, `company2_home_quote.pdf`. Born-digital PDFs (they have a real text layer).
- Uploaded 2026-10-02 21:03 UTC and read by the DEPLOYED code (nothing from this programme is deployed):

| Short | File | docId | contentHash | Pages | Saved state |
|---|---|---|---|---|---|
| c1home | company1_home_quote.pdf (Able) | `e79abbd8196144d4ba7c9babded8276c` | `6B0AF574287CC201DBB24A90DF046152C4C890E3BB83584D1E5DEC27E22AB1FE` | 5 | Ready, 10 passages — **pages 1–3 lost** |
| c1auto | company1_auto_quote.pdf (Able) | `c619e4030b6040849de6194c9e4135ee` | `987BC93A724C0C4DE7BD21F3D8A82EB8FD0A623355AE885D3A672A95A5A7F980` | 2 | Ready, 20 |
| c2auto | company2_auto_quote.pdf (Definity) | `1b5eed6a586747a88fd7fbcd49167bac` | `A90B3D267B58B4335203A42E02FA8453602C995109EF6D9F8ED767541B0D7515` | 2 | Ready, 20 |
| c2home | company2_home_quote.pdf (Chase) | `3c01a137b2d140dab2e898d9dc5f590b` | `D11783AF214A8AC9B81F1D43E4AC3AF7CB0BD16D66DA924407F854FBB1D01E54` | 8 | Ready, 57 |

### 2.2 Where everything lives
- **Cosmos (CA sandbox):** database `Clinket-nonprod`, container `KnowledgeBase-dev`, partition key `/businessId`
  (`clinqetcore/Cosmos/Setup/CosmosContainerPolicies.cs` → `KnowledgeBase`). Read a document row inside partition
  `NKN607`: `SELECT * FROM c WHERE c.type = 'KnowledgeDocument' AND c.docId = '<docId>'`.
- **Storage:** CA account `clinketstoragecadev`, India `clinketstorageindev`, knowledge container `provider-knowledge`.
  Path rules: `clinqetcore/Models/Knowledge/KnowledgeBlobPaths.cs`.

| Family | Path | What it is |
|---|---|---|
| Source | `{biz}/{docId}/{name}-{stamp}.pdf` | the uploaded file |
| Machine reading | `{biz}/_di/{docId}/{contentHash}.json.gz` | Document Intelligence's whole raw result (gzip JSON, `result` = `DocumentRawExtractionResult`) |
| Page decision | `_ocr/{biz}/{docId}/{contentHash}/{deployment}/v{promptVersion}-{fp}/pNNN.json` | `{ markdown, policy, review, reading }`: the ACCEPTED page text (`""` = keep the machine reading), `policy` = `{ValidationFingerprint}:v{AdjudicationRulesVersion}`, the disputes and how each was settled, the reading epoch |
| Section decision | `…/pNNN-s{geometry}.json` | one section of an oversize page |
| Section machine reading | `_ocr/…/{contentHash}/_regions/{model}-{format}/pNNN-{geometry}.json` | DI's reading of one section |
| Picture description | `_ocr/{biz}/{docId}/cap-{pictureHash}-{fp}.json` | paid, banked |
| Saved reading | `{biz}/_artifacts/{docId}/{contentHash}.json.gz` | the content artefact: blocks, notices, conservation report |
| Pictures | `{biz}/_images/{docId}/{id}.png` (+ `.thumb.webp`) | pictures cut from the file |

- ‼️ **What does NOT exist yet:** the raw AI page transcripts (attempt 1 and 2) and the raw source-check answers. Today
  only the final decision is banked, so every rule fix re-buys the AI. Keeping them is **PLAN-B step 2**.

### 2.3 Every raw file, with its URL
**`RAW-FILES.md`** beside this file — generated from the live listing: every NKN607 file (17 page decisions, 4 machine
readings, 4 saved readings, 4 picture descriptions, 8 pictures, 4 sources), and the MG Windsor files. Base URL for CA:
`https://clinketstoragecadev.blob.core.windows.net/provider-knowledge/`. Private — read with the sandbox connection
string, never public.

### 2.4 How to download and replay (read-only, free)
Tools in `evidence\tools\` (each its own project; they read connection strings at runtime from
`C:\Nik\cosmosindexsetup\appsettings.ca.json` / `appsettings.in.json` — never print them):
- `cb` — `cb ls <prefix>` / `cb get <blob> <outFile> [gunzip]`; CA by default, `REGION=in` for India.
- `cq` — `cq <ca|in> <container> <partitionKey|*> "<sql>" <outFile>`. ‼️ `*` is a cross-partition read: sandbox
  diagnostics only, never a pattern for product code (§0.6). Pass the partition key.
- `scan` — `scan <ca|in>`: every Ready document — numbers in its banked page readings vs the saved reading.
- `replay` — `replay <di.json> <ocrDir> <outPrefix>`: today's code path (LayoutFigureCaptions.Attach → Split →
  CarryFigures → Join → ParseLayoutMarkdown → chunk) on banked readings; prints the conservation report; writes
  `<outPrefix>.joined.md`, `.blocks.txt`, `.cards.txt`.
- `replay-at-discovery` — the replay that proved the loss (with `fixClose`), kept as evidence.

```bash
T=C:/Nik/Data/knowledge-reading-accuracy/evidence/tools; S=<your scratchpad>
dotnet build $T/cb -o $S/bin/cb -nologo -v q && dotnet build $T/replay -o $S/bin/replay -nologo -v q
D=e79abbd8196144d4ba7c9babded8276c; H=6B0AF574287CC201DBB24A90DF046152C4C890E3BB83584D1E5DEC27E22AB1FE
mkdir -p $S/data/c1home/ocr $S/out
dotnet $S/bin/cb/cb.dll get NKN607/_di/$D/$H.json.gz $S/data/c1home/di.json gunzip
for p in 001 002 003 004 005; do dotnet $S/bin/cb/cb.dll get _ocr/NKN607/$D/$H/gpt-5-6-luna/v2-b3a3627b/p$p.json $S/data/c1home/ocr/p$p.json; done
dotnet $S/bin/replay/replay.dll $S/data/c1home/di.json $S/data/c1home/ocr $S/out/c1home
```
Afterwards delete the tools' `obj\` folders and every downloaded file (provider data) from your scratchpad.

### 2.5 Other documents that matter
- **India `6TCWOI` · MG Windsor EV – Brochure** — docId `55af3e34aeb546fdb2279ca720af18d5`, 92 pages. Page 36's
  variant price table (₹9,99,000 … ₹13,99,999; ₹3.99 / ₹4.50 per km battery rental) was lost by the same figure bug.
  Page 36 is an **oversize page read in sections** — the best real case for the section path. Files in `RAW-FILES.md`.
- **Corrected scan, both regions, 2026-10-02 22:22 UTC:** **2 of 31** documents with page readings lose numbers —
  c1home (32 numbers, pages 1–3) and MG Windsor (4, page 36). Three other hits in an earlier run were the scanner's own
  false positives (it skipped list items). After the owner deploys: `scan ca` and `scan in` again — target 0.
- `evidence\alerts-NKN607-2026-10-02.txt` — all 26 alert texts the deployed code raised for the four files.

---

## 3. What was wrong (found and proven 2026-10-02)

Full write-up: `PLAN.md` §0–§1. Five audits: `findings\AUDIT-1-parser.md` … `AUDIT-5-consumers.md` (ids P0-x, P1-x, F-xx,
AS-xx, CS-xx, CX-xx, CD-xx). Short version:

| File | On the page | Saved right (deployed code) | Why |
|---|---|---|---|
| c1home | 43 prices | **0** | Pages 1–3 vanished: the logo `<figure>` was written with its closing mark on the last word's line; the repeated-header cleanup deleted the page-4 copy WITH the closing mark; the line reader never saw the figure close and swallowed pages 1–3 as "logo words", then cleared them when the next figure opened. No alert, row said Ready. |
| c1auto | 51 | all values, **labels shifted** on page 2 | Side label "Breakdown" + a third check that counted visual columns: `Principal: $1,000,000 — TOTALS: $352` (truth: limit $1,000,000, premium $352). F-02. |
| c2auto | 18 | all values, page 1 scrambled | Side label "Rates" + merged cells → one region "could not be placed" → the **whole AI page was reverted** to the machine reading (F-01): scrambled rate groups, a message copied 6×, the quote link `F8SkQ` read `F85kQ` (the PDF's own text layer has the right letters, F-16), 9 junk summary cards. Page 2: `PRIN.: 0` added where the page is blank, classed as "layout" (F-04). |
| c2home | 65 | 64 | `Deductible — Inc.` invented in a blank cell (F-03); page 6 reverted by a "Totals" side label (F-01); primary-dwelling premiums filed under "Secondary Dwelling" (section scope, PLAN-C §F); markup in 16 cards; form fields paired value-with-value (`Kathiria: Middle Name`, PLAN-C §D). |

And on the disputes the third check settled: c1home page 3 — the machine's merged cell "Hail peril Peril Adjustment -
Water Deductible Legal Liability" (one cell spanning 4 rows) beat the 4 correct AI rows (F-19/F-08); c1home page 5 — a
glossary read across columns was "reading order", yet one empty check answer reverted the whole page (F-01).

Why nobody was told: nothing compared what the pages say with what was saved, and the 26 alerts were all per-check
noise ("check required / resolved / layout only"). The provider notice "Some numbers couldn't be confirmed" fired on any
unsettled label or paragraph and offered nothing to do.

---

## 4. What is DONE (uncommitted, not deployed)

### 4.1 Screens — web AND mobile (owner-approved 2026-10-02)
- **U1** The moving bar under "Reading" removed (web `KnowledgePage.jsx`, mobile `ReadingMotion.tsx` / `index.tsx`, the
  tailwind animation, tests). Supersedes two sheets on that point only (`PLAN.md` §0A).
- **U2** Picture viewer Delete works: the confirm lives inside the viewer (web: an alert dialog inside the lightbox layer,
  Escape/Tab, errors shown inside; mobile: one native window, back cancels the confirm, errors inside).
- **U3** Sentences follow the file's real access: "callers can still be told…" never on a file marked not for callers;
  "change that under AI receptionist" never where it cannot be changed (twins `receptionistReachesCallers` +
  `pictureSendBlock`, web `src/lib/knowledge/receptionistAccess.js`, mobile `src/lib/knowledge/receptionistAccess.ts`;
  keys ×5 languages ×2 apps).
- **U4** The notice ✕ and "Read again" hidden from members without `voice.settings.manage` (the server refused them).

### 4.2 The reader — never lose what was read (`KnowledgeDocumentParser.cs`, `KnowledgeContentConservation.cs`)
- **Repetition is never deletion.** Running headers/footers/logos are *marked* per page (`KeptFurniturePrefix`), never
  removed. ‼️ Not literally "only page numbers": the gate's deliberate-removal list also holds rows skipped by
  `IsPageBreakFurniture` in `InheritCrossPageTableHeaders` (incl. F50's real section band — the gate is blind to F50 until
  PLAN-C step 12), title-row copies, fence info strings, picture URLs, list numbers and duplicate inline value lines.
  Worded page numbers ("Page 2", "Day 2") are now marked, not removed. A line is never furniture when it is a tag line, an open block,
  a table body row, a heading, a value-only line or a priced/measured line.
- **Figures:** tags always on their own lines before parsing; a new figure closes the open one (never clears it); a page
  break closes an open figure / table / code block; figure text is flagged `IsFigureText`.
- Every table AND the text beside it on the same line is kept; markup stripped per line and inside pipe cells (escapes
  shielded); continuation tables skip furniture/figure text above them and only inherit a header when column kinds agree.
- **The conservation gate** (`KnowledgeContentConservation.Missing`): after parsing, every word and number of the page
  readings must be in the saved blocks (counted, Unicode-normalised; deliberate removals recorded). On loss → the page
  is re-parsed alone (`RebuildPageByPage`), and if still lost → saved as plain text (`PlainPage`, lossless).
  `KnowledgeExtractionOutput.Conservation` reports LostCount / LostNumbers / samples / PagesKeptAsText / StillLost…, and
  the content artefact banks it so a replay says the same.
- Assembly: `PageMarkdownSplicer.CarryFigures` writes figure marks on their own lines, never inside a table, anchors on
  markup-free text with occurrence rank and a following-line fallback; `SectionStitcher.AddToFigure` the same;
  `KnowledgeText.JoinAtHyphen` never joins a list/table/markup line.
- **Proof:** the replay of the four real readings: c1home **43/43** prices kept (was 0); the gate is silent on all four
  (no false alarm); sabotage (drop every `$` line) → caught, pages rebuilt, 0 still lost. 22 guards sabotaged.
- **The handover audit then fixed** (code reading only, compiled, tests written but NOT run — `BUILD-STATE.md` register):
  parser P1–P12 and gate C1–C12 (worded page numbers, banners kept between pages `RunBanners`, control chars spaced,
  fences, figure tags in HTML cells, regex timeouts, autolinks as text, link/anchor text recorded, noncharacter escape
  shield, the rebuild keeps first-parse blocks of every page that lost nothing and reports `PagesWithLoss`), chunker S1–S7
  (one-sided caption rule, one card per distinct furniture text `furnitureSeen`), and the picture-text pass now carries
  its own loss report into the document's (`KnowledgeReadingConservation.Combine`, once per picture).

### 4.3 Alerts and notices — one NEW alert per reading (‼️ the old per-check alerts still fire beside it — §5.9)
- `ReadingOutcomeReport(Flow, BusinessId, Source, Settings)` (`clinqetcore/Models/AI/ReadingOutcomeReport.cs`; Settings =
  the reading's own `VisionTranscriptionSettings`) + `ReadingOutcomeItems.cs` (kinds: ContentLost, ReadingRuleBroke,
  ValueOnlyOneReadingHas, ValueUnconfirmed, ValueNotChecked, LineDropped, PricingWithheld, SavedPricingKept,
  NameTakenFromCheck; ordered by importance) + `TranscriptionVerificationAlerts.PublishReadingOutcomeAsync`.
- Only when a person must act. Lost content and a broken reading rule are always sent (code to fix); the switch
  `EnableDocumentTranscriptionVerificationAlerts` governs the value items. A page past the check limit alerts only a
  number or a whole missing/added line, worded "not checked"; an AI-only value the check did not confirm is "a value only
  one reading has" even after `ResolvedToCandidateReading`.
- Bounded for Service Bus Standard (256 KB refused for good): every reading cut to `MaxDiscrepancyExcerptCharacters`, at
  most `MaxDiscrepanciesPerVerification` items listed in the text AND the details ("N more are counted in the title"),
  halved until the body is ≤ 192 KB. Built inside the guarded send, so a wording defect is logged, never thrown.
- EventId = (flow, business, doc, hash, reader build, SHA-256 of every reading + every loss count/sample, sorted — pages
  are read in parallel). The ingest sends it right after the committed-row check, BEFORE the analytics ticket; a replay
  sends nothing; the "already Ready" exit re-tells it from the banked reading (`TryReadForAnalyticsAsync`) — across a
  deploy that can mean one duplicate, never a loss.
- New `AdminAlertType` values (appended at the END): `KnowledgeReadingNeedsReview`, `ProviderSetupReadingNeedsReview`;
  `AdminAlertProcessor` keys them by EventId (dead-letters a message without identity); labels in admin web and admin
  mobile (+ tests).
- The ingest sends the report after the Ready commit. **Setup and drafts do NOT send it yet** (PLAN-D).
- Notices: `Info_KnowledgeValueUnconfirmed` retired; new `Info_KnowledgeContentNotSaved` (content really lost) and
  `Info_KnowledgeDraftPricesToCheck` (+`_One`) ×5 languages; the API falls back from `_One` to the plural, then skips a
  notice it cannot word. The drafts job restates the prices-to-check notice on EVERY outcome (counted by source row,
  priced drafts only); approve/dismiss removes it once the file has nothing waiting (ETag retry); approving an UPDATE now
  also carries a capped file on (it never told the continuation before). A duplicate upload keeps the survivor's notices.
  Admin onboarding step renders a notice object (it crashed).

### 4.4 Storage lifecycle (`azureautomation/storage.json`)
Last-access tracking on (daily, block blobs); the `_ocr/` page bank now cools after **30 days unused** (auto back to hot
on use) and is deleted after **180 days unused** (was: cool at 50 / delete at 180 days after WRITE). No new parameter.

### 4.5 Verification state at handover
- ‼️ **The handover audit ran NO tests (owner's instruction).** Its fixes are compiled only: `Clinqet.Communications`,
  `.UnitTests`, `.IntegrationTests`, `Clinqet.API.UnitTests`, `.IntegrationTests` and `Clinqet.Mcp.UnitTests` all build
  with 0 errors; partner web ESLint 0/0, partner mobile tsc + ESLint 0 errors, admin web ESLint 0/0. The last GREEN run
  (Functions unit 8,863/8,863, 2026-10-03 02:24 UTC) is BEFORE the audit's edits.
- **Your first act: run every affected suite** — Functions unit + integration, API unit + integration, partner web
  knowledge suites, partner mobile knowledge suites, admin web — and fix any red before building anything. New tests that
  have never run include `ReadingOutcomeAlertsTests` (rewritten), `AdminAlertProcessorIntegrationTests.ReadingOutcome_*`,
  `KnowledgePictureTextTests` (3 new), the Ready-exit / replay / duplicate tests in `KnowledgeIngestProcessorFunctionTests`,
  the parser/chunker/splicer audit tests, the notices agent's drafts/approval/controller tests, the web and mobile
  knowledge panel suites and `StepKnowledge.test.jsx`.
- Integration tests (Azurite / Testcontainers) have never been run for this programme.
- Sabotage caveat: in the 22-guard run, one test was failing on the baseline, so five sabotages ("headings may be page
  numbers", "a banner ends a price list", "a plain page drops banner lines", "figure tags left on the line of their
  text", "page-number test merged into a paragraph") were "caught" only by that test. Their tests were strengthened
  afterwards; **re-run those five sabotages** (copy-to-scratchpad method) in your proof step.

---

## 5. What is PENDING — the build, in this order

The full designs are in `plans\PLAN-B-adjudication.md`, `plans\PLAN-C-tables-cards-retrieval.md` and
`plans\PLAN-D-setup-and-drafts.md` (read-only planners, verified identical to their reports). Below: what each step is,
the proper solution, and what I learned since the plans were written. Order: **B → D → C → AS-04 + small items → docs →
proof → final audit.** Draw the §6 sheet early so the owner can approve it while you build.

### 5.1 Phase B — the reading rules and the raw bank (PLAN-B, 10 steps)
Principles (PLAN-B §0.1): the machine reading decides structure and presence; the file's own text layer (when trusted)
decides characters; the AI reading decides layout, reading order and characters on scans; a paid check settles only what
those three cannot. **A page is never reverted** — every decision is per difference, written into the AI page. Coverage
is count-aware and consuming. Structure is classified before characters are settled. Bounds limit spending, never
content. "Unsettled" only when a reading carries a digit.

1. **Scaffolding, no behaviour change.**
   - `RenderRulesVersion = 1` beside `AdjudicationRulesVersion` (VDTS ~L85-87), comment: raise only when what a reading
     is SHOWN changes (drawing, turning, composing, reading the text layer). `PageCachePolicy` (VDTS L58-59) becomes
     `{ValidationFingerprint}:v{Adj}:r{Render}` — this invalidates every banked decision once; accepted (the 1→2 raise
     does it anyway). `ReadingRules` (L62-63) feeds the picture-text bank, so that bank moves too.
   - Convention split (PLAN-B §4): `ThePageRenderRules_AreVersioned` + `ThePageReadingRules_AreVersioned`, plus
     `NoFileIsPinnedByTwoVersions` and `EveryReadingFolderFileIsPinned`. Pin `KnowledgePriceMarks.cs` /
     `KnowledgeFigures.cs` only from the step where they decide comparisons. Update the tests that assert the policy
     shape: `VisionClosingAuditTests.ThePageCachePolicy_IsTheSameOnEveryBuild` (~L273), rewrite
     `DocumentTranscriptionAdjudicationTests.APageBankedByADifferentBuildOfTheRules_IsAMiss` (~L1110) as
     `APageBankedUnderAnotherRulesVersion_IsAMiss` (F-27), `KnowledgeOcrPageCacheIntegrationTests.AssertPolicyShape`
     (~L210). Delete the stale comments VDTS L40-51 (misplaced on `LongPageAlerts`) and in `VisionTranscriptionSettings`.
   - Rasterizer: `ReadPageTextAsync(bytes, ext, pages)` and `ReadTextInRegionsAsync(bytes, ext, page, regions)` on
     `IDocumentPageRasterizer`, backed by a new `PdfiumDocument.ReadTexts(page, regions)` (one page load, one
     `FPDFText_LoadPage`, bounded text per region via the existing displayed-frame mapping of
     `ReadText(page, size, region)`, under `PdfiumDocument.Lock`, no bitmap; non-PDF → empty).
     ‼️ **`ReadPageTextAsync` must return exactly what `RasterizedPage.TextLayer` returns today** (same `ReadText(page)`,
     same invisible-overlay guard `PagesWithInvisibleTextLayer`), or the attempt-1 prompt — and its raw key — would
     differ between a drawn and an undrawn page. Test that equality on real fixture PDFs (`KnowledgePdfFixture`).
     ‼️ **Each region answer must also say whether an image or a form widget overlaps it** (PDFium page objects
     `FPDF_PAGEOBJ_IMAGE`, recursing into form XObjects, and `FPDF_ANNOT_WIDGET` annotations, mapped to the displayed
     frame). Typed form values and text inside pictures are not in the text layer, so an empty layer there proves
     nothing (PLAN-B F-03 edge, defect 11).
   - `VisionPageTranscription.RawContent` + `Usage`; `DocumentVerification.RawContent`.
   - Raw paths in `KnowledgeBlobPaths` (PLAN-B §2: `raw/{deployment}/t-p{page}[-s{geom}]-a{n}-{key20}.json`,
     `raw/{verifyDeployment}/v-p{page}-q{key20}.json`, `…-c{key20}.json`, all under `_ocr/{biz}/{doc}/{hash}/`, so the
     purger, closure teardown and the lifecycle rule already cover them).
   - Pure moves: `SectionCompositions` out of `OversizePageReader` (L167-195, L273-292, L514-523), `ReadingPrompts`
     (`Reference`, `Grounded`, `WithoutBoxMarks`). ‼️ `ScriptsIn` is shared by the prompt (`Grounded`) and by adjudication
     (`TrustedTextLayer`, `UnreadableOnARenderedPage`) — give it its own file in the adjudication group, not in
     `ReadingPrompts`.
2. **Raw bank wired, v1 rules** (PLAN-B §2). Transcript key = RenderRulesVersion + render recipe + model + SHA(system ␀
   user prompt) + ordinal. ‼️ A decision entry is valid only when **Policy AND Inputs AND the attempt-1 raw key** match
   (a prompt change moves the raw key, so the old decision must miss) plus the epoch rule. Move `StripCodeFence` +
   `Sanitize` out of `VisionPageTranscriber` into `Reading/RawTranscript.cs` (adjudication group) so a post-processing fix
   never re-buys raw readings. ‼️ Put a hash of the verifier's question *wording* (`DocumentTranscriptionVerifier.BuildPrompt`
   template) in each per-question key, not only the system prompt + schema. Successes are trusted across readings;
   Truncated/Refused only within their own epoch; transient failures never banked. One storage GET per read (not
   Exists + Get; defect 10). `CachedPage` gains `Inputs`, `Published`, `RawKeys`, `ChecksBought`; `Markdown` always holds
   the published text (F-28 — the page viewer shows nothing for a reverted page today). Azurite tests in
   `KnowledgeOcrPageCacheIntegrationTests`.
3. **Pure primitives, not wired:** `PageStructureReader` (grid with rowspan/colspan anchors, figure text, CJK per
   grapheme, RTL), `PageGeometry` (DI polygons → points), `TokenLedger` (consuming multiset), `TextLayerAuthority`
   (trust test ≥70% agreement over ≤40 high-confidence DI words; rebuild of machine characters), `ReadingScope` (one
   money definition on `KnowledgePriceMarks`; `MSG/DIS/TOT` are never currencies; Indian lakh grouping; dot-grouped euro).
4. **`PageAligner` + `PageDifference` behind `DocumentTranscriptComparer.Compare`; RAISE `AdjudicationRulesVersion` to 2
   here.** Tables first, rows within tables (1:k merges), cells by gap-aware alignment (side labels are decoration),
   prose by DP + block-move tiling + echo. Covers F-02, F-04, F-05, F-11, F-13, F-14, F-10 listing, AS-03 compare.
5. **Check-answer model:** `CheckQuestions` (a unique printed handle + a box; never an ordinal), `CheckAnswers` (a state
   per region: Text/Blank/NotOnPage/Unreadable/None; narrowing), new verifier schema. F-03, F-06, F-08, F-18, F-25.
6. **Adjudication rewrite.** 6a `PageRuling` (PLAN-B §0.4 decision table), `TextLayerAuthority.Settle`, `AttemptMerge`
   (attempt 1 always kept), `PageWriteBack` (rows and lines inserted in place — never appended at the page end),
   `PageConservationAudit` (every digit in either reading is published or explained, else `ReadingRuleFallback`).
   Delete `Correct`, `RowShaped`, `Restore`, `Unsettled`, `WithoutEvidence`, the page-level revert. ‼️ **Asymmetric blank
   rule:** the text layer may blank an AI-only value only when the machine reading is ALSO blank there and nothing
   overlaps the box; it never removes a value the machine read off the pixels (outlined vector text has no layer
   either). 6b two phases + deterministic `CheckAllocation`, the `OversizePageReader` split, F-26, bounds (F-10/CS-03).
7. **Scope and review fields;** `TranscriptionDisputeIndex` sees the new uncertainties; F-20.
8. **Figures (AS-03):** `FigureCarry.Compute`, the `data-words` attribute, the parser reads it into neighbour text only.
9. **Consumers:** F-23 (drafts use the banked DI read + page angles; setup passes angles and banks its DI read); remove
   the per-check Required / Outcome / layout alerts from VDTS (Phase E); delete `HasUnresolvedReadings`,
   `PagesSourceRetained`, `VerificationsAlreadySpent`; the 7 new settings in both hosts with class defaults equal to
   appsettings; delete the orphan API keys `Vision:PageConcurrency` and `MinTextConservation` (defect 4). ‼️ Keep the
   outcome EventId on the reader build, NOT the epoch (PLAN-B 6.2 / defect 2 proposed the epoch — that re-alerts on
   every "Read again"; decided 2026-10-02).
10. **Docs and close-out** (§5.6).

Real-case tests to write in steps 4–6 (PLAN-B §1 names them): `RealCase_Company1HomeP5_…NeverReverts`,
`RealCase_Company2AutoP1_SideLabelsAndMergedCellsKeepTheAiPage` (link `F8SkQ` from the layer), `RealCase_Company2HomeP6_…`,
`RealCase_Company1AutoP2_ASideLabelIsLayout_…`, `RealCase_Company2HomeP7_AnInventedIncInABlankCell_IsLeftBlank`,
`RealCase_Company2AutoP2_AnAddedZeroInARowOfAnotherShape_IsContentNeverLayout`, `RealCase_Company1HomeP3_AMergedLabelCell_IsLayout_…`.
Build them as SYNTHETIC shapes of these pages (never provider files in the repo).

### 5.2 Phase D — AI setup from a document and draft suggestions (PLAN-D, 12 steps)
Ground truth: the parser half of CX-01/CX-02 is already done (§4.2). Remaining: the setup reader hand-copies
`KnowledgeExtractionOutput` and drops `Conservation` / `UnpairedPriceLines` (use `with` copies); a `ProviderSetupServiceGate`
(API) checks every extracted price against a document unit carrying the service's name before any write; unconfirmed
prices are never written live; disputes bind to a document unit, not the extractor's name (`TranscriptionDisputeIndex` v2);
setup and drafts each send ONE `PublishReadingOutcomeAsync` (replacing `PublishSetupVerificationOutcomeAsync` /
`PublishDraftVerificationOutcomeAsync`); CS-05 stop deleting prices above 99,999.99; CS-06 never overwrite a live price
with an unverified one; CS-07 the offering judge in setup; CS-08 tell the provider when the reading degraded; CD-01 drafts
re-parse stale artefacts; CX-03 reuse the knowledge reading of the same bytes; new integration suite S-1…S-6. The setup
summary rows need a sheet (`ai-setup-reading-honesty`) before UI. Open decisions D1–D6 in §7.2.

### 5.3 Phase C — tables, cards and retrieval (PLAN-C, 13 steps)
One span rule for every table source (`KnowledgeTableGrid`), cell text normalisation + markup sweep, value lines and price
runs (P0-4/P0-8), invalid pipe tables (P1-2/P1-5), a stronger shared header check (`LooksLikeAHeader`: no more
`Kathiria: Middle Name`), aggregate/overview cards only for real lists + 3 new alert types (warning + limit, each
dedicated) + 5 settings, section scope (headings scoped to the page, heading cards, captions; fixes the "Secondary
Dwelling" filing), retrieval seats, AS-13, AS-16, P2 items. ‼️ PLAN-C additional defect 2 (price-run passes move a
page-1 banner after page-2 rows) is about code this programme wrote — the running audit owns it; check `BUILD-STATE.md`
for whether it was fixed there. PLAN-C flags one new blob-only field `KnowledgeBlock.ContinuesPreviousPage` (ask; a
schema-free fallback is in its §F).

### 5.4 AS-04 and small items
- **AS-04 picture identity binding** (`findings\AUDIT-3-assembly.md`): a picture's description and its page must bind by
  identity, not by order.
- **O-1** admin alert details show `[]` for nested values (`PLAN.md` §1.5): the API writes Newtonsoft values with
  System.Text.Json — one converter in the API's JSON options + an integration test on the real response.
- Prune old content-hash folders under `_ocr/{biz}/{doc}/` on replacement (PLAN-B defect 9).

### 5.4b Items no plan owned (from the audit's completeness cross-check) — each now has a home
- **F59 / A1 P0-3** (money meaning, MG Windsor p36 "with Battery-as-a-Service"): a banner that qualifies a page's prices
  must ride THAT page's cards. AUD-2's `furnitureSeen` lets each furniture text reach one card per document, so make it a
  committed PLAN-C §F step: furniture that differs from the previous page's (or sits beside priced rows) rides every
  card of its page; test on an MG-Windsor-shaped fixture; reconcile with PLAN-C P2-6's dedupe.
- **G3/G4 runtime checks** (owner-approved guarantees "nothing moved", "nothing garbled"): a free post-chunk check in
  ingest and setup feeding `ReadingOutcomeReport` — or ask the owner to sign off that fixture sweeps are enough.
- **I2 chunker word conservation** (every block word reaches a card or a section path): a sweep in PLAN-C §2.
- **Q7 measures**: table-row and leaked-markup counts in the gate — decide in PLAN-C §2. The ingest integration test
  (Azurite + Cosmos emulator: one alert, notice present, a replay sends no second alert) goes in §5.7.
- **AS-12** page alignment: check the parsed page count against DI's and report a mismatch as an outcome item (PLAN-B 6).
- **AS-15 / Q6 / PLAN-D defect 10**: the content artefact is keyed on the build, so every deploy re-buys the describe
  call — bank it on blocks hash + rules version (PLAN-B step 2), plus the free admin re-assembly sweep or the owner parks it.
- **F31 / A1 P1-5** DI PageHeader/PageFooter into the vision page → PLAN-C §B.
- **PLAN-C additional defects 4, 5, 7** → PLAN-C steps 12, 12 (+ `MaterialExcerptBuilderTests`), 6. **Defect 6** (drafts
  file rows under the last heading; RowHash includes the section) → PLAN-D step 6 with a RowHash re-key plan, or parked.
- **PLAN-D other defects 7, 8** (setup bank keyed on file name; `FlattenBlocks` headings without `#`) → PLAN-D step 1.
- **A1 P1-1** links in pipe cells (`PipeCellText` has no `MarkdownInline`) → PLAN-C step 1. **P0-11 F15c** a non-markup line
  ends an unclosed `<table>` → PLAN-C step 12, or the owner accepts it.
- Thin homes to make real: AS-04/AS-14 tests; PLAN-B defect 9 prune with a test; sabotage the audit's new guards
  (`RunBanners`, `furnitureSeen`, the size bound, `Combine`) in §5.7; one "document shapes" bench suite.
- Copy left by the agents: the Gujarati plural of `Info_KnowledgeDraftPricesToCheck` ("કિંમતો") and two other gu keys
  that still say "કૉલ કરનારાઓને" want a native speaker; the Functions `KnowledgeReadingNoticesTests` still holds a
  `KeyFor` and `ReadingAgainWouldHelp` check that belong to the API host (§0.18 — move deliberately, never extend).

### 5.5 The "this document gives wrong answers" report (§6) — sheet first, then build
Design brief and states in §6; the sheet is approved before any code.

### 5.6 Docs (part of done, §0.9)
- SKILL.md ×4 (`.claude/skills`, `.github/skills`, `.agents/skills`, `.cursor/rules/*.mdc`) for: `clinqet-function-app`,
  `clinqet-infrastructure`, `clinqet-ai-assistant`, `clinqet-business-search`, `clinqet-voice-assistant`,
  `clinqet-deployment` (the lifecycle line, ~L476) — what the reader keeps, the conservation gate, one alert per reading,
  the raw bank, the two rules versions.
- `CLAUDE.md` + its three copies: §0.23 names `RenderRulesVersion`.
- Memory: the programme entry exists (`knowledge-reading-accuracy-2026-10-02.md`); keep it current. The stale "admin `[]`
  is not a defect" memory was corrected (`transcription-quality-implementation-2026-09-09.md`).

### 5.7 Proof (G)
Unit + integration tests in the right hosts; every new guard sabotaged once (copy-to-scratchpad); the five weak sabotages
of §4.5 re-run; replay all four NKN607 files and MG Windsor p36 on the new code; after the owner deploys: "Read again" the
four files and MG Windsor, compare every priced row with the originals in `C:\Nik\Data\sample\`, `scan ca` + `scan in` → 0.

### 5.8 ‼️ The multidimensional audit — mandatory at the END of your session, every finding fixed in the same session
The owner's words: make sure there is no bug, no loophole, nothing missed, the logic is correct and solid, every edge
case is handled, no degradation, best practice (no workaround, no shortcut), no memory or CPU leak. **It is not a test
run** — read every line you changed, and the code around it. Run it as parallel read-only reviewers (one per dimension
and area) whose findings you verify yourself before fixing. Dimensions, at least:
1. **Correctness** — does each change solve the problem it was written for? Trace it on the four real files and MG Windsor.
2. **Tricky documents** — scans, photos, rotated pages, side labels, merged/spanning cells, multi-column text, tables
   across pages, repeated logos/banners, forms with typed values, pictures of text, oversize pages, CJK/RTL/Indic and
   legacy-font text layers, empty pages, password-protected or corrupt files, huge files, a page with no text at all.
3. **Never lose / never invent / never move** — count-aware; prove every digit is either published or explained.
4. **Cost** — AI calls bought once (raw bank), no re-buy on deploy, bounded checks, storage lifecycle covers every new path.
5. **Concurrency and idempotency** — Service Bus redelivery, two readings of one file, ETag where multi-writer, deterministic ids.
6. **Resources** — disposal, PDFium lock discipline, no unbounded loops or allocations, memory per page/section.
7. **Alerts and notices** — one alert per reading, nothing noisy, nothing missed; provider sentences true, ×5 languages.
8. **Contracts** — §0.7 schema, §0.18 test placement, §0.23 versions and pins, settings parity (class default = appsettings,
   both hosts), no orphan setting, no dead code.
9. **Security** — tenant isolation, no secret in code or logs, uploaded content treated as data in every prompt.
10. **Screens** — web + mobile parity, every state, permissions, localization, accessibility.
Record the findings and their fixes in `BUILD-STATE.md`.


### 5.9 ‼️ Deploy gates — the owner must not deploy this work until ALL hold
1. The per-check verification alerts are removed in the same release (VDTS Required L844 / Outcome L1050 / layout
   L1186, `KnowledgeServiceDraftAnalyticsJob` ~L959, `McpService` ~L1477 — PLAN-B step 9 / PLAN-D step 6b). Until then a
   reading raises the old alerts PLUS the new one.
2. **O-1** ships with it (§5.4): the admin details panel shows `[]` for the new alert's metadata until it does.
3. **API before or with Functions**: the API must read the two new `AdminAlertType` values before Functions writes them.
4. `ProviderSetupReadingNeedsReview` has its producer (PLAN-D) — today only the knowledge flow sends one.
5. The §0.23 decision for assembled-output banks (§7.2) is made and applied.

---

## 6. The "this document gives wrong answers" report — the owner's requirement (2026-10-02)

The "Tell our team" sheet (`knowledge-tell-our-team`) was **rejected by the owner and permanently deleted** — never
approved, nothing built. **Do not reuse anything from it**: not the menu item, not the "tell our team" wording, not the
note box, not the feedback framing. The register rows say so (`C:\Nik\Data\mockups\REGISTER.md`, `PLAN.md` §0A).

What the owner wants instead (their words, lightly trimmed):
- "It simply cannot be inside that menu. It should be somewhere outside of that … so that it's **visible**."
- "Something wrong with the document, or **this document producing the incorrect output** … document giving the
  incorrect result … something like that."
- "**They click on it, we just simply fire the admin alert. That's it.** We don't do anything, and then we'll review what's
  happening with that document."
- Why: "they wouldn't know, right? We don't show them what they saved." The provider only sees wrong answers, so they
  need a visible way to say so at once.
- "What is 'send it to our team'? … It's kind of like a feedback, but it's **not a feedback. It's like an error.** How can
  they respond to us? … It needs to be **accurate**."

So the design brief for the NEW sheet (draw it, show it, wait for approval — §0.7.1):
- A visible control on each ready document (web row in `clinqetwebpartnerapp/src/components/Profile/knowledge/KnowledgePage.jsx`;
  phone row in `clinqetmobilepartnerapp/src/Screen/ProfileFlow/Knowledge/index.tsx` and the document screen
  `KnowledgeDocumentScreen.tsx`) — never inside the "…" menu.
- Framed as reporting an ERROR in this document's results, in plain words (offer the owner 2–3 wordings built from
  theirs, e.g. "This file gives wrong answers", "Report a wrong result"). No technical words, no "our team", no note box,
  no promise of a reply. The confirmation is accurate: it says it was reported and the file will be reviewed — nothing more.
- One tap → one admin alert (a NEW dedicated `AdminAlertType`, appended at the end of the enum; labels in admin web
  `AlertsPage.jsx` and admin mobile `alertTypes.ts`). The alert carries business, document (id, name, content hash,
  status), who reported, when, from which app, and the document's last reading outcome, so the team can look straight at
  the raw files.
- Every state on web AND phone: ready, sending, reported, already reported, error, offline, not allowed (member without
  permission), file still reading / not ready (control hidden or disabled — say which).
- Server rules to propose (and ask): who may report (members who can see the document; tenant-isolated), a deterministic
  EventId per (business, document, content hash, member, day) so double taps and redeliveries are one alert (the
  processor's `IsKeyedByEvent`), rate limiting. "Already reported" after a reload would need stored state — that is a
  §0.7 question; prefer a schema-free answer (e.g. derive it from the alert's deterministic id) and ask.
- Strings ×5 languages ×2 apps; tests on both apps and the API; register the sheet the day it is approved.

---

## 7. Decisions

### 7.1 Already made — do not re-ask
- D-a (one alert per reading, notices only when content was really lost) — BUILT. D-b rejected (§6).
- Repetition is never deletion; only page numbers are removed.
- The outcome alert's EventId stays on the reader build (not the reading epoch).
- One `AdjudicationRulesVersion` raise 1→2 for the whole programme (B, D's CS-01/CS-03 and A5 share it).
- The one-time re-read of every banked page after the raise is accepted (sandbox).
- The storage lifecycle by last access (cool 30 days unused, delete 180 days unused).

### 7.2 Still open — present simply, recommend, wait
- PLAN-D **D1** offering judge in setup (≈1 Luna call per ≤100 new priced services) — recommend yes. **D2** withhold
  prices only one reading supports — recommend yes. **D3** continue an unfinished setup reading inside the request
  (bounded by the deadline) — recommend yes. **D4** the single shared raise — already decided yes. **D5** stop renaming a
  live service on a merely semantic match (`ProviderSetupServiceWriter.cs` ~L129) — recommend stop. **D6** pin the
  chunker token predicates in a small pinned class — recommend yes.
- PLAN-C: `KnowledgeBlock.ContinuesPreviousPage` (blob-only field) or its schema-free fallback; span data on
  `KnowledgeTableModel` (planner advises against); AS-16's version decision; MaxSectionsPerImage warning + limit types.
- PLAN-B: the 7 new `VisionTranscriptionSettings` defaults (PLAN-B §0.5) — inside the owner's approval, state them.
- The two sheets: §6 and PLAN-D's `ai-setup-reading-honesty`.
- **§0.23, assembled output:** this session changed how figures and stitched sections are ASSEMBLED
  (`PageMarkdownSplicer`, `SectionStitcher`, `KnowledgeText`) and re-pinned v1 pin-only, because what a page DECIDES did
  not change — so pages banked before keep the old assembly. Owner picks: a separate `PageAssemblyRulesVersion` (re-buys
  nothing, re-assembles for free) or fold it into the planned 1→2 raise. Recommend the separate version.
- **§0.7 stored shape:** the new alert stores `metadata.readingOutcome` (flow, source, the loss report with cut samples,
  `itemCount`, at most 12 items) on the AdminAlert document. It is a value inside the existing free-form `Metadata`
  dictionary, not a new field — but tell the owner and offer to revert to text-only.
- **`knowledge.download.previousConfirmBody`** ("This is not the file answering your callers.") is approved copy that is
  false for a file not used by the receptionist or a business without one — the owner words a no-callers twin.
- **PLAN-D other defect 11:** `CatalogManifestService.cs:154-158` refuses the whole manifest over one price above 5M — same
  class as the "never delete a price" ruling; recommend flag the one price, keep the rest.
- Already decided by the audit (tell the owner, one line): a broken reading rule that lost nothing still reaches the team
  with the verification switch off — it is code to fix, not a value to look at.

---

## 8. How the problems were found (so you can do the same)
1. Compared every priced row of the four originals with what was saved (index cards, artefact blocks, the page bank).
2. Downloaded the real banked readings and **replayed the exact production path offline** (`evidence\tools\replay-at-discovery`):
   it reproduced the saved document byte for byte and showed 43/43 amounts missing; moving one closing mark onto its own
   line gave 0 missing. That is how a guess becomes proof.
3. Scanned every Ready document in both regions for the same loss (`scan`); fixed the scanner's own false positives.
4. Read every alert raised for the files (`evidence\alerts-NKN607-2026-10-02.txt`) against the pages they named.
5. Ran five read-only audits (`findings\`) and three read-only planners (`plans\`), then built the parser fix with a
   conservation gate, and sabotaged every guard to prove it fails when the rule breaks.
6. Read end to end for Phase B (2026-10-02): `VisionDocumentTranscriptionService.cs` (1,459 lines),
   `DocumentTranscriptComparer.cs` (931), `DocumentTranscriptionVerifier.cs`, `IDocumentTranscriptionVerifier.cs`,
   `VisionPageTranscriber.cs`, `IVisionPageTranscriber.cs`, `DocumentPageRasterizer.cs`, `IDocumentPageRasterizer.cs`,
   `Pdfium/PdfiumDocument.cs`, `Pdfium/PdfiumNative.cs`, `KnowledgeBlobPaths.cs`, `Models/AI/PageRegions.cs`,
   `Models/AI/DocumentSourceEvidence.cs`, `AiCompletionResult.cs`, `BankRulesVersionConventionTests.cs`. Not yet read:
   `DocumentTranscriptUnits.cs`, `Oversize/OversizePageReader.cs` (577 lines) — read them before step 1's moves.

## 9. Read these first, in this order
1. This file, then `BUILD-STATE.md` (the work register and log; is the audit closed?).
2. `PLAN.md` (the authority: §0–§1 what happened, §1A the solution, §1B owner decisions, §0A sheets).
3. `plans\PLAN-B-adjudication.md` (all of it — your first 10 steps).
4. `RAW-FILES.md` and `evidence\tools\` (how to get and replay the real readings).
5. `findings\AUDIT-2-adjudication.md`, `AUDIT-3-assembly.md` (the defects B fixes), then `plans\PLAN-D-setup-and-drafts.md`,
   `plans\PLAN-C-tables-cards-retrieval.md`, `findings\AUDIT-1`, `AUDIT-4`, `AUDIT-5` when you reach them.
6. SKILLs: `clinqet-function-app`, `clinqet-infrastructure`, `clinqet-ai-assistant`, `clinqet-testing`, `clinqet-cosmos-data`
   (`.claude/skills/<name>/SKILL.md`).
7. Code: `clinqetinfrastructure/Services/AI/VisionDocumentTranscriptionService.cs`, `DocumentTranscriptComparer.cs`,
   `DocumentTranscriptUnits.cs`, `DocumentTranscriptionVerifier.cs`, `DocumentPageRasterizer.cs`, `Pdfium/PdfiumDocument.cs`,
   `Oversize/OversizePageReader.cs`, `PageMarkdownSplicer.cs`; `clinqetinfrastructure/Services/Knowledge/KnowledgeDocumentParser.cs`;
   `clinqetfuncations/Clinqet.Communications/Functions/KnowledgeIngestProcessorFunction.cs`; and the tests
   `Clinqet.Communications.UnitTests/Knowledge/DocumentTranscriptionAdjudicationTests.cs`, `VisionDocumentTranscriptionServiceTests.cs`,
   `DocumentTranscriptComparerTests.cs`, `DocumentPageRasterizerTests.cs`, `Conventions/BankRulesVersionConventionTests.cs`.

## 10. Traps that bit this programme
- JavaScript `String.replace(x, '$…')` treats `$'` / `$&` as patterns — use a function replacement `() => text`.
- CRLF files: normalise to LF before multi-line matching, write CRLF back.
- `node -e` with apostrophes or backslashes breaks the shell or writes real newlines into C# strings — write the script
  to a file in the scratchpad, or use the Edit tool.
- A test that fails on the baseline makes every sabotage look "caught" — check the baseline is green first.
- Every unit test starts with an empty page bank, so a bank-key bug is invisible to them — test the replay explicitly.
- DI writes ☒ / ☐ for any small box-like mark; quoted to the AI they were copied over real ticks (they are stripped from
  the reference).
- A scan that skips a block kind (list items) invents losses — count what you scanned before trusting "0" or "N".
- `describe.skip` still runs its body (CLAUDE.md §0.17); a guard that reads nothing reports success (§0.15).

## 11. Definition of done for the next session
Every pending item of §5 built (or explicitly parked by the owner), unit + integration tests green in the right hosts,
sabotage proven, replays on the real readings clean, sheets approved before any new UI, skills ×4 + CLAUDE ×4 + memory
updated, the §5.8 multidimensional audit done with every finding fixed, scratch deleted, `git status` checked, and a
plain-words summary for the owner: what changed for the provider, for the team, and for cost.
