# Phase 2 — progress, decisions and learnings (session 1 of the phase)

Written 2026-09-12. **Phase 2 is NOT complete.** This records exactly what was built, what was proven live,
what was decided, what went wrong on the way, and what remains — so the next session starts with everything
this one knows. The continuation prompt is `PHASE-2B-PROMPT.md`.

Everything below was **committed and deployed by the owner at 21:32 on 2026-09-11** except the work listed
in §7 (built after that commit, still uncommitted at the time of writing).

---

## 1. Step zero — Phase 1 verified live, and what it found

`kaudit reprocess` → `wait` → `pull` → `alerts` over all 17 retained `SX3SG2` fixtures + `MEE3IC gopi.jpeg`,
then `kaudit drift ca`. Evidence: `phase-1\live-after\` + `phase-1\live-after\STEP-ZERO.md`.

**Phase 1's own fixes are real on the deployed pipeline**: L-1 (the two-column resume's deleted facts are
back), L-2 (the Gujarati PDF is labelled and exact, `scripts` carries `Gujr`), L-3 (continuation tables keep
their header), L-4 ×2, L-5, L-6 ×2, L-7, A1/A8/A11/A14, C12-L (`gopi.jpeg` described AND transcribed), L-12
(drift 23/23 ok).

**But it also found five defects Phase 1 had shipped**, all fixed in this session as their own change —
`phase-2\PHASE-1-DEFECT-FIX.md` is the full record:

| # | Defect | Fix |
|---|---|---|
| P1-A 🔴 | A repeated table HEADER on a continuation page was stripped as page furniture; the orphaned delimiter then stopped the table parsing at all, so 36 priced rows became one paragraph of raw markup | A pipe line a delimiter row declares, that reads as labels, whose cell count is the shape of the rows it labels, is a header — never furniture. And a stripped line carrying a delimiter row hands that declaration down to the line that now heads the table |
| P1-B 🔴 | A picture that IS the document's own page was transcribed a second time, indexing every photo/scan document twice | The LANE states whether it rendered the pages (`KnowledgeExtractionOutput.RenderedPages`); a picture is read only where the document's own text could not reach it. C12-L still holds — a picture the describer refuses is described from the page's already-extracted words, at zero cost |
| P1-C 🔴 | `SourceUnitRestored` put unreadable OCR back into the index (`1, 54 \| ₹250`, `3 โรงเ \| ₹50`), and `2 414` became a section title | Two readings against one: a source-only line is dropped when the source check read that region and came back with content **the transcript already holds** |
| P1-D 🟠 | The restore appended a line the page already carried (the resume's EDUCATION card; the Hindi title twice) | Root cause was two general tokeniser defects — below |
| P1-E 🔵 | `Page 1 of 3` / `2 of 3` reached the index | A page ordinal is a shape that repeats across pages **whose digits equal the page**, scanned without the furniture character minimum |

**Two further general defects found while fixing those:**

- **Indic, Thai and Khmer words were shredded into bare consonants** everywhere the comparer counts words
  (`char.IsLetter` is false for every vowel sign and virama). Consequences: unrelated words scored as
  near-matches, so a page title aligned to an unrelated price row; and `CarriesLosableContent` could never
  count a word in those scripts, so **a whole line the transcript dropped was never even reported as
  missing** unless it happened to carry a number. Fixed by `IsWordCharacter` — a word keeps its marks.
- **A dash between digits is a range, not a sign.** `2013-2019` could not match `2013–2019`, so every
  differently-written date, price or duration range read as lost content.

---

## 2. Phase-2 work built in this session

### E1 / R-4 / R-12 — a replacement never destroys the version the provider has

- Confirming a replace changes **nothing** about the live version. The candidate rides `pendingBlobPath`
  (+ `pendingDocName`); the row keeps its blob, name, hash, pages and cards. Only a run that reaches Ready
  promotes. **A failed replacement therefore needs no restore, because nothing was overwritten.**
- **Card preservation is for every flow, not just replace**: a terminal failure ends the RUN. If the row
  already carries an indexed version, its cards stay — on every reason. (A Reprocess of a healthy document
  could previously delete every card it had, with no replacement involved.)
- **The previous file is kept**: copied server-side to `provider-knowledge/_previous/{business}/{doc}/`,
  recorded on the row (`previousSource`), swept by `PurgeAsync` AND `BusinessClosureTeardown`, aged out by a
  new ARM lifecycle rule (cool 30 days, delete `knowledgePreviousVersionRetentionDays` = 60). Only a version
  that actually answered is kept.
- **Download**: `GET /knowledge/documents/{docId}/download?previous=` — tenant-checked, path-ownership
  checked, existence-checked, and served as a short SAS **through the Front Door origin** with the provider's
  own filename (`TransformToDownloadUrl`). The raw blob host is never exposed. Also covers the CURRENT file,
  which had no download at all.
- E5 half: the row stores the **measured** blob size at promote, not the client's declared number.

### C1 / E2 / R-5 — a bad moment waits, only a bad file ends the document

- `DocumentExtractionException` (`Transient` / `Content` / `PasswordProtected`) raised **where the evidence
  is**, in `DocumentIntelligenceService`. A 4xx that is not throttling is the service naming the content; a
  5xx, throttle, network fault or poll timeout says nothing about the file.
- A transient failure raises `KnowledgeIngestRetryableException` → `Run` **schedules** the same work order
  (`EnqueueRetryAsync`, session-ordered, attempt-carrying) and completes the current message. 30s → 2m → 8m
  → 30m, capped, bounded by `IngestRetryAttempts`. The row stays Processing and the provider is told nothing.
- ‼️ The retry is **opt-in by exception class**. A first version keyed it on "anything that reached the
  catch" and silently changed the delivery-count behaviour of four unrelated failure paths.

### C2 — the failure sentence is decided by the bytes

`LooksPasswordProtected` grepped the exception message for "password"/"encrypted" and treated every
`FileFormatException` (i.e. every damaged zip) as password-protected. Now: an OLE header (`D0 CF 11 E0`)
plus an `EncryptedPackage` stream ⇒ password; OLE without it ⇒ a legacy binary file renamed, with its own
new sentence `Error_KnowledgeLegacyOfficeFormat` in all five languages; otherwise ⇒ unreadable.

### E6 — the stale-Processing clock

`processingSince` is stamped wherever a row enters Processing and cleared on Ready/Failed. The window is
measured from it, never from `updatedAt` (the last write of anything), so an unrelated toggle can no longer
push a stuck document out of its owner's reach.

### R-14 / L-10 — why there are no suggestions

`judgeRemovedCount` written by the analytics job (`candidates − survivors`) and surfaced on the DTO. **Proven
live**: `Microsoft Pricing Structure.xlsx` now reports `judgeRemovedCount: 6` where it used to say `Ran / 0
drafts` with no explanation.

### C7 — cross-document description reuse, made exact

`captionContextHash` records the words a description was written beside. Reuse across documents now requires
the picture **and** its words to match, in both directions — a logo standing on its own can no longer inherit
the sentence written for it under another document's heading.

### X-02 — the extractor's trust boundary

The provider's document is fenced as data (`<document_text>`) and named as such, matching the caption,
transcription and Business Search prompts. **The wording is a setting**
(`AzureDocumentIntelligence:ExtractionUserPromptTemplate`, `{documentText}` token, refused if the token is
missing), not a literal — owner's instruction, 2026-09-12.

### D10 — the wrapped service name (§1A.2, mandatory)

`BuildExtractorText` now carries a candidate's own preceding line when it is neither another candidate nor
the declared `##` section, bounded, and **for line candidates only** (a table row's neighbour is a different
record). `KnowledgeServiceCandidate.PrevLine` already held the data; the defect was purely that the
extractor never saw it. **Not yet proven live** — see §6.

### Schema — six Cosmos fields, all wired, none unused

`pendingBlobPath` · `pendingDocName` · `previousSource` · `processingSince` (all `KnowledgeDocument`) ·
`judgeRemovedCount` (`KnowledgeServiceDraftAnalytics`) · `captionContextHash` (`KnowledgeDocumentImage`).
All absent when empty; `KnowledgeBase` is an exclude-by-default container so **none is indexed** and there is
no `cosmosindexsetup` change. `trimmedCount` was deliberately **not** added (§0.7's own test: the draft
ceiling is 1,000/document and the largest real document produced 212 — the trim raises the existing admin
content-limit alert instead).

---

## 3. Decisions the owner made in this session

| Decision | Ruling |
|---|---|
| **R-12** | R-4 stands — the 2026-09-03 "ignore it" is superseded |
| **R-4** | Do it, in the `pendingBlobPath` shape. Cards preserved on **all** flows |
| **Previous file** | Keep it, **download only** — no restore action. Hot → Cool → delete, no Archive tier (Archive needs rehydration and would break the button). **Delete after 60 days**, appsetting/parameter gated |
| **R-5** | Do it: evidence-based classification + scheduled backoff |
| **R-7** | `Service.Pricing` is a single-price model with **no tier structure** — confirmed in the entity. So **one draft per tier**, tier label in the name |
| **R-9** | Do it; no schema change. UI must be plain, fully responsive incl. folded phones, and the phone app must use the app's own patterns |
| **R-11 + R-14** | All fields approved. Confirmed: absent fields cost nothing (Cosmos omits them) and nothing is indexed |
| **C7 field** | Owner asked me to re-examine the edge case; I revised Phase 1's recommendation from "do not add" to **add it**, and the owner agreed |
| **Formats** | `.csv` **in**; legacy binary (`.doc/.xls/.ppt`) and macro-enabled (`.docm/.xlsm/.pptm`) **explicitly refused** with honest sentences. Every supported format must be proven live on a Canada business |
| **TIFF pages 2..n**, **the four §9 declared limits** | Left as they are, per recommendation |
| **Download endpoint** | Build it — for the current file too. **Never expose the raw blob URL**; serve through the Front Door origin |
| **Prompts/text** | Anything tunable belongs in appsettings, not in code. Apply this proactively while coding |
| **Commit/deploy** | The owner has now given the session freedom to commit and deploy, and full freedom to exercise the Canada region |

---

## 4. ‼️ Gotchas and mistakes — read these before writing code

> ‼️ **This list is items 1–10 of SESSION 1. Session 2 added items 1–6 (`PROGRESS-SESSION2.md` §5), 7–10
> (§6.6) and 11–32 + a debugging runbook (`PROGRESS-SESSION2.md` §15 — "THE GOTCHA FILE").** Read §15
> before writing code: it carries the deploy trap that burned two cycles, how to tell which commit is
> live, and why a green test can sit on top of a live defect.

1. **‼️ A CACHED PAGE REPLAYS ITS OLD DECISIONS.** The P1-C/P1-D adjudication fix **changed nothing on the
   first live run** because every page was served from the vision page cache under the unchanged policy key.
   Only the live run caught it — every unit test starts with an empty cache. Fixed properly: the page-cache
   key now carries **the compiled identity of the assembly that holds the rules**
   (`VisionDocumentTranscriptionService.PageCachePolicy`), and the hand-maintained `AdjudicationPolicyVersion`
   is **deleted** — it had been forgotten twice in two phases. A number a developer must remember is not a
   mechanism. There is now a test (`APageBankedByADifferentBuildOfTheRules_IsAMiss`).
2. **‼️ THE SAME TRAP EXISTS FOR THE CONTENT ARTEFACT.** `PipelineFingerprint` already folds in assembly
   identity — but it does **not** include most settings, deliberately. If you change a rule that lives in a
   SETTING rather than in code, the artefact will replay. Check before you conclude a fix is live.
3. **‼️ A SABOTAGE THAT PASSES IS THE POINT OF SABOTAGING.** Two of mine passed: the table-header exemption
   was being covered by the cross-page inheritance repair (so the guard could be deleted and every test
   stayed green), and the dash-range guard was unreached because widening the dash family alone satisfied the
   single case. Both now have cases that isolate them.
4. **The unit-test harness returns the SAME row object for every read.** Mutating the local `row` snapshot
   in production code looks fine in tests and is wrong: `CommitAsync` re-reads from Cosmos. Never mutate the
   snapshot — read what you need (`IncomingDocName(row)`).
5. **`PageCount` is not "was this rendered".** A web page has a page count and no pixels. The lane must state
   it (`RenderedPages`).
6. **PowerShell script execution is disabled on this machine** (`-File` fails) and `python` is the Store
   stub. Use the `PowerShell` tool with inline `-Command`, or the Edit/Write tools. **Never `perl -0pi` with
   `$"` or `\x{}` in the pattern** — it mangles C# interpolated strings and mojibakes non-ASCII (memory:
   `knowledge-extraction-fix-phase1-2026-09-11`).
7. **Check `git diff --numstat` with and without `--ignore-cr-at-eol`** after editing — they must match, or a
   line-ending-only change has crept in.
8. **A test that pins a defect must be rewritten, loudly.** Three were, each with a `‼️ UPDATED 2026-09-1x`
   comment saying what changed and why: `AReplace_DeletesTheUploadItSuperseded` (now asserts the opposite),
   the C2 password heuristic (now a theory over the three real byte shapes), and
   `ExtractFromTextAsync_TruncatedRun_IsChunkedAtTheHeading` (now pins that a chunk starts at the fence,
   which is stronger than the old blank-line check).
9. **The settings convention test** (`VoiceKnowledgeSettingsConventionTests`) keeps a hand-maintained list of
   what the API host reads. Add a key the host reads and you must add it there too, with the reason.
10. **The purger test counts prefix deletes.** Adding a swept prefix changes 6 → 7 and 12 → 14.

---

## 5. State at the end of this session

| Suite | Result |
|---|---|
| `Clinqet.Communications.UnitTests` | **4,347 / 4,347** (Phase 1 left 4,307) |
| `Clinqet.API.UnitTests` | **11,947 / 11,947** |
| `Clinqet.Mcp.UnitTests` | **918 / 918** |
| `C:\Nik\knowledge-table-hunt` | **103 / 103** |
| Builds | core · shared · infrastructure · Functions · API · MCP — 0 errors |
| `kaudit drift ca` | **23 / 23 ok** |

Evidence: `phase-1\live-after\` (step zero) · `phase-2\live-after\` (the post-deploy run) ·
`phase-2\PHASE-1-DEFECT-FIX.md` · this file. The 2026-09-10 before-state in
`evidence\ca-live-batch\` was never overwritten.

---

## 6. ‼️ What is NOT proven live yet

Deployed and proven: P1-A, P1-B, P1-E, R-14's count, and everything Phase 1 fixed.

✅ **UPDATED 2026-09-12 — P1-C, P1-D and the page-cache identity fix are now ALL PROVEN LIVE.** The owner
deployed, and the acceptance test was run in the same session: full evidence in
**`LIVE-ACCEPTANCE-2026-09-12.md`**. Headlines: the Gujarati PNG went
`used '# 2 414' [SourceUnitRestored]` → `used '' [SourceUnitNotOnPage]` and now reads as five correct
Gujarati price rows; the two-column resume went **High "unresolved reading" (9 regions) → Low "layout
difference only"**, with **zero** content discrepancies where the audit found nine, and its EDUCATION card is
a clean 51 characters. The cache re-read the pages without `forceFresh`, which is the proof that
`PageCachePolicy` carrying the compiled assembly identity works.

‼️ **That run found a NEW High defect — P2-A** — one table cell still publishes OCR garbage (`4211%` for
`મસાજ`) because `VisionDocumentTranscriptionService.cs:476-483` lets the machine reading decide the characters
even when the machine reading is OCR **of pixels**. It is **not fixed** — it is item 1 of §0A in
`PHASE-2B-PROMPT.md`, with the full diagnosis in `LIVE-ACCEPTANCE-2026-09-12.md` §2.

**Still built but never exercised on the stamp:**
- **E1** — no live replace has been run. Needs: a good document, a replacement that fails (an over-page PDF
  or a renamed legacy file), then a replacement that succeeds; check the row, the cards, `_previous/` and the
  download link.
- **R-5** — no live transient failure has been forced.
- **C2** — no live damaged/legacy/encrypted upload.
- **C7**, **X-02**, **D10** — D10 in particular needs the **matching-category test business** (`SX3SG2`
  cannot prove drafts; its judge correctly removes salon/auto/clinic lines).

---

## 7. Uncommitted at the time of writing

`AdjudicationPolicyVersion` deleted + `PageCachePolicy` (shared, infrastructure) · D10's lead-in line
(Functions) · X-02's settings-backed prompt (shared, infrastructure, API appsettings) · the three updated
tests · the new cache-policy test · the mockup + register row.

---

## 8. Scratch files created and removed

Under the session scratchpad only (never in a repo): `fixtures.txt`, `stepzero.sh`, `live2.sh`, their logs,
`snap/` (sabotage snapshots), `e1tests.cs`, `r5tests.cs`, `d10tests.cs`, `addkey.ps1`, `out.cs`. Two
temporary debug hooks were added to production code during investigation and **both were removed**: a
`File.WriteAllText` probe inside `StripRepeatedPageLines` and a `throw` probe inside
`KeepSupersededSourceAsync`. `git status --porcelain` carries only deliverables.
