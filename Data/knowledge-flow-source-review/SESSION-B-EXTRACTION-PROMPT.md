# Session B — the extraction layer: finish EX-13, EX-14, EX-15, EX-20, EX-33, then the deferred batch

> **Written 2026-09-04** by the session that closed 32 of the 56 findings. That session is still running,
> doing a read-only multi-dimensional audit of everything it closed. **Read §0 before touching a file.**
> Authority documents: `AUDIT-FINDINGS.md` (22 findings, #1–#22) and `EXTRACTION-PASSAGE-AUDIT.md`
> (34 findings, EX-01–EX-34), both in this folder. `TRIAGE-AND-STATUS.md` is the running scoreboard.

---

## 0. ‼️ FILE OWNERSHIP — the one rule that stops us destroying each other's work

Two sessions are live in `C:\Nik` at the same time, and **`git checkout` / `restore` / `reset` / `stash` /
`clean` are FORBIDDEN in these trees** (CLAUDE.md §0.19) — they wipe every session's uncommitted work, not
just yours. Snapshot to your scratchpad and restore with `cp`.

**You own (edit freely):**

| File | Items |
|---|---|
| `clinqetinfrastructure/Services/Knowledge/KnowledgeDocumentParser.OpenXml.cs` | EX-14, EX-15 |
| `clinqetinfrastructure/Services/Knowledge/KnowledgeDocumentParser.Pptx.cs` | EX-14 |
| `clinqetinfrastructure/Services/Knowledge/KnowledgeDocumentParser.cs` | EX-13 (alt text) |
| `clinqetfuncations/Clinqet.Communications/Functions/KnowledgeIngestProcessorFunction.cs` | EX-13, EX-20 |
| `clinqetinfrastructure/Services/Knowledge/KnowledgeSearchIndexer.cs` | EX-20, EX-33 |
| `clinqetcore/Entities/AISearch/KnowledgeSearchDocument.cs` | EX-33 |
| `clinqetinfrastructure/Services/Knowledge/KnowledgeChunker.cs` | EX-13 if needed |
| `clinqetcore/Models/Knowledge/KnowledgeBlocks.cs` | EX-13 (a new model field, not a store field) |
| `Clinqet.Communications.UnitTests/Knowledge/*` | your guards |

**Session A owns — do NOT edit; report to the owner instead:**

`clinqetmcp/Clinqet.Mcp/Tools/*` · `clinqetinfrastructure/Services/Knowledge/KnowledgeManagementService.cs` ·
`clinqetinfrastructure/Data/COSMOS/KnowledgeDocumentRepository.cs` ·
`clinqetinfrastructure/Services/Knowledge/ProviderKnowledgeSearchService.cs` ·
`clinqetapi/Clinqet.API/Controllers/**` · `Clinqet.API.UnitTests/**` · `Clinqet.Mcp.UnitTests/**` ·
`clinqetshared/Models/Voice/VoiceSendSlot.cs` · `clinqetfuncations/.../VoicePostCallProcessorFunction.cs`

If you hit a **compile error in a file you never touched**, a peer is mid-edit: **stop and report it. Never
"fix" their file.** (This happened twice on 2026-09-04.)

---

## 1. The stakes, in one line

This pipeline turns a provider's uploaded document into the passages the AI phone receptionist reads to
callers, sends by WhatsApp/email, and drafts marketplace services from. **A wrong price here is spoken to a
customer and cannot be taken back.** The bar the owner set: **ZERO output degradation.** If a change cannot
be *proven* non-degrading on live data, it does not ship.

## 2. Non-negotiables (owner-mandated, verbatim in spirit)

1. **Zero assumptions. Zero hallucinations. Zero workarounds. Plan first.**
2. **Pre-production**: never write backward-compatible code, workarounds or backfill. State resets are fine.
3. Obey `C:\Nik\CLAUDE.md` fully — especially **§0.6** (never a cross-partition Cosmos query), **§0.7**
   (any SQL/Cosmos/Search schema change needs owner approval FIRST, presented as the §0.7 table),
   **§0.14** (no verbose comments — a comment carries a WHY the code cannot), **§0.16** (leave the tree
   clean; **never write a scratch file inside a repo**), **§0.18** (a library class is tested from the suite
   of the HOST that invokes it), **§0.19** (see §0 above).
4. **ASK, DO NOT ASSUME.** Stop and ask for: any schema change, any change to which images or content ship,
   any change to a limit a provider or caller can hit, any large refactor, anything needing judgement.
5. **A fix at one call site is not a fix.** Fix the CLASS. Grep every site.
6. **Shared services are singletons** — per-document state must be per-call, never a field.
7. **A setting belongs only in the host that reads it.** The API declares only what the API reads.
8. **Never name an env var `OUTDIR`.**
9. **Gate every test run on a zero-error build** — a stale binary "passes":
   `ERR=$(dotnet build … | grep -c ": error " || true); [ "$ERR" -eq 0 ] && dotnet test … --no-build`

## 3. ‼️ The sabotage discipline — and the two ways it has already failed us

**Every guard must be proven capable of failing.** Break the fix, watch the guard go RED on *exactly* the
right case, restore from a scratchpad snapshot (`cp`, never git), confirm byte-identical, re-run green.

Two real failures from 2026-09-04 — do not repeat them:

- **A VACUOUS guard (sabotage 24).** The EX-08 guard PASSED under sabotage because its fixture never
  produced the condition under test. Rewritten as a **sweep over 41 sizes**, it then failed against the
  "fix" itself and exposed a real bug. **If a sabotage passes, the guard is wrong — not the sabotage.**
- **A TIMING-DEPENDENT guard (#19).** The concurrency guard caught the defect in 2 of 3 cases, then 3 of 3
  — i.e. luck. Fixed by forcing the interleaving: read **before** the gate, and hand each caller a
  **detached** copy (`StaleReadGate` in `Clinqet.Mcp.UnitTests/Fakes/`). **Run a concurrency guard three
  times under sabotage; if it is not RED every time, it proves nothing.**

**Prefer a sweep to a pinned case.** A pinned case proves one input; a sweep over sizes/shapes/flags proves
the rule. Sabotages must be ISOLATED — one at a time, so you know which guard caught what.

## 4. ‼️ Live-data testing is MANDATORY, not optional

**Credentials are READ AT RUNTIME and NEVER copied into a file, a doc, or a commit.**

- `C:\Nik\cosmosindexsetup\appsettings.ca.json` and `appsettings.in.json` →
  `AzureStorage:ConnectionString`, `CosmosDb:ConnectionString`, `Search:ServiceEndpoint`, `Search:ApiKey`.
- Cosmos database/container: **`KnowledgeBase-dev`**, partition key **`/businessId`**. Every query is
  partition-scoped (§0.6) — no exceptions.
- Search alias: **`clinket-knowledge-dev`**. ‼️ **An alias requires api-version `2026-04-01`.**
- ‼️ Index field names are **`chunkKind`** and **`sectionTitle`**. **`kind` and `sectionPath` DO NOT EXIST**,
  and a bad `$select` returns *no value* — which looks exactly like an outage. Verify field names first.
- Sample decks/documents: **`C:\Nik\Data\SampleData`** (8 decks).
- **Measure loss on CHARACTERS, not words.**
- **Write every harness script and output to your session scratchpad — NEVER inside a repo** (§0.16).
- Probe scripts from session A that you can re-create (they were scratchpad-only): a Cosmos probe listing
  rows per business with `status`/`passageCount`, and a Search probe counting cards per `docId` and
  checking for empty `content`.

**What "proven" means:** run the change over the live corpus, and state the character-level delta. Session
A's standard was: CA 4 rows / IN 50 rows, CA 744 / IN 99 cards, 0 empty content, 0 fingerprint clashes,
9 stored images 0 dropped. **State weak evidence as weak** — e.g. all 9 live images sit far from the size
thresholds, so they prove the rule runs, not that the boundaries are right.

---

## 5. THE FIVE ITEMS TO BUILD

### EX-13 — image cards lack source context (High)

**What it is.** An image card's searchable text is document title + section title + the AI caption. The
picture's own **alt text** and the **paragraph or table row next to it** are not in the grounding. So a
caller asking "the blue tile in the terrace range" can miss a photo whose neighbouring row says exactly that.

**Where.** `KnowledgeIngestProcessorFunction.BuildCards` (≈line 2129) builds
`embedPrefix = KnowledgeCardPrefix.Build(docInfo.Title, null, chunk.SectionPath, null, null)` and emits
`$"{embedPrefix}\n{piece}"`. `KnowledgeExtractedImage.AnchorHint` already carries a position
(XLSX `Sheet1!B7`); there is **no AltText field yet**.

**The shape session A recommends (not yet approved by the owner — confirm it):**
Grounding rides the **EmbedText only, never the stored Content.** The body a caller hears or is sent must be
unchanged — that is how this ships with zero output degradation. Add:
1. `KnowledgeExtractedImage.AltText` (a MODEL field in `clinqetcore/Models/Knowledge/KnowledgeBlocks.cs` —
   **not** a Cosmos/Search field, so **no §0.7 gate**; confirm that reading before you rely on it).
2. Populate it where the format has it: DOCX `wp:docPr/@descr`, PPTX `p:cNvPr/@descr`, HTML `<img alt>`,
   XLSX picture `descr`.
3. A bounded **neighbour line**: the nearest non-empty text block before the `ImageMarker` (and the table
   row for an XLSX anchor), truncated to a small character budget.
4. Append `alt + neighbour` to the image card's embed text, bounded so the card still fits
   `ChunkMaxTokens` — **reuse `KnowledgeChunker.ApproxTokens` (public) and the same ceiling logic**;
   never let grounding push a card over the ceiling.

**Gotchas.** ① The caption model is given pixels; the audit also asks for alt text to be given to the
*model*. That is a prompt change and a cost change — **ask before doing it.** ② `ImageCaptioningEnabled` off
means no caption card at all; grounding must not resurrect one. ③ EX-19 already splits an oversized caption
into several pieces — every piece must carry the same grounding, and each already carries the image ref.

**Guard.** Sweep: for each source kind (DOCX/PPTX/XLSX/HTML), a document with alt text + a distinctive
neighbouring sentence ⇒ the ImageCaption card's **EmbedText contains both** and its **Content contains
neither**, and no card exceeds the ceiling. Sabotage each of the two contributions separately.

---

### EX-14 — Office image dedupe removes later placements (High)

**What it is.** DOCX keeps `seenImageParts` (`KnowledgeDocumentParser.OpenXml.cs:22`, checked at `:161`),
XLSX dedupes repeated picture relationships per sheet (`:545`), PPTX keeps a **global** seen-part set
(`.Pptx.cs:29`). Only the FIRST occurrence emits a marker. A logo repeated per section is right to collapse;
a **product photo reused in three sections** loses two of its three placements, so a question scoped to
section 3 can never reach it.

**The fix.** Keep **one image payload per part** (one upload, one caption call — that part is correct and
is what makes it cheap), but emit an **`ImageMarker` for EVERY occurrence, pointing at the SAME image
index**. Nothing downstream needs to change: the ingest lane's `byHash` already collapses assets, and the
chunker already emits one `ImageCaption` chunk per marker, so each placement gets a card at its own section
and page. The existing test `I1` in `KnowledgeIngestProcessorFunctionTests` pins exactly that shape —
"the same bytes on two markers collapse to ONE asset (one upload, one caption call) while each occurrence's
caption card still carries the caption and the ref". **Read it before you start.**

**Gotchas.** ① `CollectMarkers` in the ingest function has `seen.Add(block.ImageIndex)` and keeps only the
first marker per index — that is correct **for the asset lane** (one upload) but means the lane's
`Page`/`Anchor` come from the first placement only. Decide (and state) whether that is acceptable or whether
the registry entry should carry the first placement while the CARDS carry all of them. ② PPTX's set is
**global across slides** — a picture on slides 2 and 7 currently appears once; per-slide markers are the
point of this fix. ③ Do not remove the dedupe of the *payload*: re-uploading and re-captioning the same
bytes is a real cost regression. ④ The image cap (`MaxImagesPerDocument`) counts ASSETS, not placements —
confirm the refill loop still counts assets after your change.

**Guard.** Sweep over DOCX/PPTX/XLSX: one part placed N times in N different sections ⇒ **N caption cards
with N distinct section titles, 1 upload, 1 caption call, 1 registry entry**. Sabotage by restoring the
first-only behaviour per format — three isolated sabotages, one per parser.

---

### EX-15 — an Excel worksheet is flattened into one logical table (High)

**What it is.** `KnowledgeDocumentParser.OpenXml.cs:316-366` gathers every visible non-blank row of a sheet
into **one** table block. A sheet holding a price list, then two blank rows, then a completely different
warranty table becomes one table whose header is the price list's header. Rows from the second table are
then read under the wrong column names — which is how a wrong price gets spoken.

**The fix.** Segment the sheet into regions and emit **one table block per region**:
1. A run of ≥1 fully-blank row is a boundary (make the threshold a setting, not a magic number — §0.12).
2. A **declared table range** (`<tableParts>` / `x:table` autoFilter ranges) is an authoritative boundary
   and its own header row — prefer it over the blank-row heuristic where both apply.
3. Header recognition is **per region**, not "the sheet's first row".
4. A region's `sectionTitle` should name the sheet **and** the region (e.g. `Sheet1 — Warranty`) when a
   caption/first cell gives one; otherwise sheet + range.

**Gotchas.** ① **EX-16 is already fixed in this file** — a full-width band (a row with exactly ONE cell whose
span > 1) emits its text in the first cell only, via `isFullWidthBand` / `IsOnlyContentInRow`. A band is
often a *region title* — use it, do not break it. ② The 8 sample decks contain **ZERO horizontal merges**,
so live data cannot exercise EX-16; your EX-15 work must not silently regress it — **run the EX-16 guards.**
③ Tables are deliberately **never collapsed** by the chunker's furniture rule (EX-22 collapses repeated
prose only at 3+ sections, tables never) — keep that true. ④ Splitting a sheet increases the card count,
which counts against `MaxPassagesPerBusiness`. Measure the delta on the live corpus and, if a document can
now cross a cap it previously fitted, **raise it with the owner** (a limit a provider hits ⇒ ASK).

**Guard.** Sweep: a synthetic sheet with 2 and 3 regions × {blank-row separated, declared-range separated,
band-titled} ⇒ that many table blocks, each with ITS OWN header, and no row ever read under another
region's header. Sabotage: restore the single-table behaviour ⇒ the "wrong header" assertion must go RED.

---

### EX-20 — a generated overview can acquire factual authority (High)

**What it is.** The AI-written document description (`DocSummary` card, built by `BuildSummaryCardText`)
is indexed **alongside** extracted source content and competes with it at the same authority. A fluent
summary that generalises or drops a qualifier can win a factual question against the source row that has
the actual number.

**The fix, in three parts (the audit's own words: "label, validate, weight"):**
1. **Label it.** The card must be explicitly marked as a generated overview — the `chunkKind` is already
   `DocSummary`, so the label belongs where the *consumer* can act on it: the retrieval path and the
   answer-composition prompt. ‼️ **NO TECHNICAL WORD a provider or caller can read** (CLAUDE.md §0.20) —
   never "chunk", "passage", "index", "card". Say *overview* / *summary of the document*.
2. **Weight source above it.** A factual question must rank real extracted text above the overview. Options:
   a scoring-profile weight on `chunkKind` (**Search schema change ⇒ §0.7 gate ⇒ ASK**), or a
   retrieval-side re-rank in `ProviderKnowledgeSearchService` (**session A owns that file — coordinate**).
   Session A's recommendation: do it retrieval-side, and hand the diff to session A rather than editing.
3. **Validate critical numbers.** The deterministic inventory (`KnowledgeInventoryBuilder`) already holds
   the real figures. Cross-check numbers appearing in the generated summary against it; on a mismatch,
   **drop the number from the summary** (never rewrite it) and raise an admin alert.

**Gotchas.** ① `_settings.DocSummaryEnabled` off ⇒ no summary card; your changes must be inert then.
② The inventory ships **even when the AI prose failed** (D11b) — the browse vocabulary must never depend on
a model call. ③ D26: zero substance cards ⇒ Failed, and a lone `DocSummary` card is retrieval bait — the
summary is only added once real content exists. Keep that. ④ Do not make the summary *shorter* as a
side effect: that is output degradation.

**Guard.** A document whose source says "$4,500" and whose generated summary says "about $4,000" ⇒ the
summary card ships **without** the wrong figure, an alert fires, and the source card still answers. Plus a
ranking guard: a factual query returns the source card above the overview.

---

### EX-33 — lexical analyzers are not fully multilingual (owner: "I will rebuild the index after")

**What it is.** Some searchable fields use an **English** analyzer, others standard analysis. Vector search
softens but does not remove the multilingual lexical-recall gap. A Gujarati or Hindi document's exact
terms can under-recall against BM25.

**Status.** ‼️ **This IS a Search schema change** and the owner has **approved it in principle** and said
they will **rebuild the index afterwards**. Still present the §0.7 table (What / Who reads / Who writes /
Cost / What breaks if omitted) with the exact field list and analyzer per field **before** you write it, and
get the explicit yes in your own session.

**Where.** `clinqetcore/Entities/AISearch/KnowledgeSearchDocument.cs` (fields come from
`FieldBuilder().Build(...)`) and `KnowledgeSearchIndexer`.

**Gotchas.** ① ‼️ **An analyzer change is NOT additive** — `PreserveLiveOnlyFields` handles added fields;
changing an existing field's analyzer requires an index rebuild and re-ingest of every document. Say so
plainly and let the owner schedule it. ② A **removed** field blocks the whole index update (learned the hard
way — see memory `business-search-p15-voice-multiscript-2026-09-03`). ③ The right target is usually
`standard.lucene` or a language-specific analyzer per field, **plus** keeping the vector path intact.
④ Deterministic card ids are `{businessId}_{docId}_{chunkNo}` — a rebuild must preserve them or every ref
the model has ever emitted breaks.

---

## 6. AFTER THOSE FIVE — the already-approved deferred batch

The owner approved these for "the next session"; they are yours once the five above are green.

| Item | What it is | Notes the owner already gave |
|---|---|---|
| **EX-04** | Passage sizing / loss measurement on real PDFs | ‼️ **Measurement spend APPROVED**: "Yes — measure it properly on the live PDFs". Measure on CHARACTERS. |
| **EX-05** | (see the audit) | needs design first — present it before building |
| **EX-09** | (see the audit) | needs design first |
| **EX-12** | (see the audit) | needs design first |
| **EX-18** | Résumé/CV-shaped documents | pairs with EX-07/EX-17 |
| **EX-07 + EX-17** | Two-column reading order, charts, visual order | owner: **"its own session, with the golden corpus"** — build the golden corpus first |
| **#9** | Post-commit effects not durably coordinated | needs a **new Service Bus queue** ⇒ ARM + `deploy.ps1` in the SAME change (§0.7.1) |
| **#7 / Q3-A** | ETag concurrency, done properly everywhere | ‼️ **37 files, ~132 call sites**, touches bookings + invoices (money). Owner: "full best practice, no patch, and it needs to be fixed in ALL the places." Needs the API + integration suites in play. Full analysis is banked in `SESSION-HANDOVER-2026-09-04.md`. |

**Declared limits, no change needed** (do not "fix" these): EX-24, EX-25, EX-28, EX-32, EX-34.
**EX-30 was proven NOT REAL** (`KnowledgeDocumentParser.cs:1439` already emits `value: <scalar>`).
**#4 the owner said to ignore.**

---

## 7. What is ALREADY closed — do not redo it, and do not regress it

**32 findings closed and sabotage-proven** (35 sabotages, each RED on exactly the right guard except #24,
which exposed a vacuous guard and was rebuilt).

`AUDIT-FINDINGS.md`: #1, #2, #3, #5, #6, #8, #10, #11, #12, #13, #14, #15, #16, #17, #18, #19, #20, #21, #22.
`EXTRACTION-PASSAGE-AUDIT.md`: EX-01, EX-02, EX-03, EX-06, EX-08, EX-10, EX-11, EX-16, EX-19, EX-21,
EX-22, EX-23, EX-26, EX-27, EX-29, EX-31.

**The ones most likely to be broken by YOUR work — run their guards:**

- **EX-16** full-width horizontal bands in DOCX/XLSX/PPTX (you are editing that exact code).
- **EX-19** an oversized caption is SPLIT, never truncated, and every piece keeps the image ref.
- **EX-21** outline rescue when the chunker produces zero cards.
- **EX-22** repeated furniture collapses only at **3+ sections**; tables never collapse.
- **EX-08** a card's overlap page comes from a per-sentence page list — a retained tail can begin on an
  earlier page than the card's last page. **Guarded by a 41-size sweep. Do not simplify it.**
- **EX-27** the search script source spans DocTitle + SectionTitle + DocName + Content.
- **EX-06** `ForceFresh` on the queue message bypasses BOTH the banked parse artefact AND the
  business-wide caption reuse. If you add a third cache, it must honour `ForceFresh` too.

## 8. Measured facts you can rely on (do not re-measure, do not contradict without evidence)

- **Zero horizontal merges across all 8 sample decks** — live data CANNOT exercise EX-16.
- Live corpus at 2026-09-04: **CA 4 rows / IN 50 rows, all `Ready`**; **CA 744 / IN 99 cards**;
  **0 empty content**; **0 cross-card fingerprint clashes**.
- **9 live stored images, 0 dropped** by the size/aspect rule — but all 9 are ordinary photos far from any
  threshold, so this is **weak evidence about the boundaries**, and was reported as such.
- `MaxConcurrentToolCallsPerBusiness = 4` — the 5th concurrent MCP tool call is refused *before* it reads
  the session. This bounds several concurrency exposures; a fan-out test above 4 hangs.
- `ApproxTokens` ≈ 4 chars/token and is **public** on `KnowledgeChunker` — never duplicate the rule.
- Chunker targets: **350 target / 512 max / 120 min / 15% overlap**.
- Cosmos `KnowledgeBase` indexing policy excludes `/*` and indexes only
  `type, docId, status, docType, sourceKind, contentHash, createdAt, updatedAt, kind, needsReview, queueRank`
  — ‼️ **`passageCount` is NOT indexed**, so never filter or sort on it.

## 9. ‼️ PowerPoint — the honest status

The owner asked specifically whether PPTX extraction is verified. It is **partially** verified:

- **Fixed and sabotage-proven:** EX-16 horizontal/full-width bands in PPTX tables
  (`A.TableCell.GridSpan`), and `KnowledgeOoxmlText.Flatten` for text runs.
- **NOT verified on live data:** the 8 sample decks contain **zero horizontal merges**, so the EX-16 fix is
  proven only by synthetic guards. Say this plainly; do not claim live coverage it does not have.
- **KNOWN OPEN, assigned to you:** **EX-14** (a picture on two slides currently appears once — PPTX's
  seen-part set is global across slides) and **EX-07/EX-17** (visual reading order — the item that most
  affects two-column slides and slide-with-sidebar layouts, and the reason a deck can be read in the
  wrong order). **Until EX-07/17 land, PPTX reading order is NOT proven.**
- Sample decks: `C:\Nik\Data\SampleData` (8). Build the **golden corpus** for EX-07/17 from these plus any
  deck the owner adds, and record expected reading order per slide so the change is measurable.

## 10. The finishing duties — none of these are optional

1. **A zero-error build gate before every test run.** Suites at handover:
   **API 11 511 · Communications 3 718 · MCP 846 — all green, 0 build errors.** Do not let that drop.
2. **A full multi-dimensional (11-dimension) audit at the end, and fix everything it finds.** The
   dimensions session A used: correctness · concurrency/idempotency · failure & partial-failure paths ·
   cost/performance (RU, AI calls, index size) · security & tenancy isolation · limits and what happens at
   them · observability (does an operator learn?) · localization (never a raw English string to a provider
   or caller) · test quality (can each guard actually fail?) · config hygiene (a setting only in the host
   that reads it) · docs/skill/memory currency.
3. **Live-data verification of every change**, with the character-level delta stated. Zero degradation.
4. **Update the `clinqet-voice-assistant` SKILL in ALL FOUR copies**: `.claude/skills/`, `.github/skills/`,
   `.agents/skills/`, `.cursor/rules/` (§0.9). A stale skill is worse than none.
5. **Add a memory entry** and refresh `TRIAGE-AND-STATUS.md` in this folder.
6. **Leave the tree clean** (§0.16): delete every scratch file, and actually LOOK at
   `git status --porcelain` in each repo you touched.
7. **The owner pushes and deploys. Never `git push`.**

## 11. How to talk to the owner

- Explain in **plain language first** — they will ask "explain it to me super easy and simple", and they
  mean it. Then the solution, then the schema position, then your recommendation.
- **Present the §0.7 table and WAIT** for any schema change.
- When you find a second defect while fixing the first, **say so and flag it separately** rather than
  quietly widening scope.
- **Report failures faithfully.** If a guard passed for the wrong reason, say that. The owner's own words:
  *"audit — that's why it's super super important that your code and fix doesn't have the major bug."*
