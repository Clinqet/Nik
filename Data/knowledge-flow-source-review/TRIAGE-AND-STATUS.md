# Triage of both source reviews — status at 2026-09-04 (end of session 3)

Two independent reviews live in this folder. This file says, for every one of the **56 findings**, whether
it is **real**, whether it is **done**, and who is carrying it.

- ‼️ **`PLAN.md` in this folder is the AUTHORITY for everything still open.** It carries the decision
  register (what the owner has already settled, so nobody re-litigates it), the designs that must be SHOWN
  before they are built, the session plan, and the three rules: full best practice · do not over-complicate
  · **never assume — stop and ask**. Read it FIRST.
- Session B's extraction work (EX-13/14/15/20/33) is **CLOSED** — see below and `PLAN.md` §1.
- Session 2's analysis (the ETag programme, the #5 design, the measurements) is banked in
  **`SESSION-HANDOVER-2026-09-04.md`**. Read it before re-deriving anything.

## Scoreboard

| | `AUDIT-FINDINGS.md` (22) | `EXTRACTION-PASSAGE-AUDIT.md` (34) | Total |
|---|---|---|---|
| **Closed, sabotage-proven** | 19 | 21 | **40** |
| Declared limits / not real — no change needed | — | 6 | 6 |
| Owner said ignore | 1 (#4) | — | 1 |
| **Closed by Session B (extraction), 2026-09-04** | — | 5 | **5** |
| **Open — Session B (deferred batch, approved)** | 2 (#7, #9) | 7 | **9** |

**Suite state (in-tree, 2026-09-07 after Session F): API 11 815 ✅ · Communications 4 020 ✅ · MCP 878 ✅ · emulator: 10 API ETag/upsert + 2 Communications ✅ + 29 Cosmos CRUD ✅ · partner-web jest 153 (17 suites) ✅ · 0 build errors, 0 ESLint errors.**
**62 sabotages run.** Every one landed RED on exactly the right guard except FOUR, which is the point of
running them: **#24 exposed a vacuous guard**, **#38 exposed a test fake less strict than production**,
**S19 exposed a second vacuous guard** (it was handed the same string on both sides, so a merging
tokenizer merged both identically and it still passed), and **S20 PASSED outright** — the line it broke
was unreachable, because the rule on the next line already refused. All four were rebuilt or deleted.

## How these were verified

Findings are not taken on trust. Session 1 re-read 14 of the 22 in `AUDIT-FINDINGS.md` against the actual
code; session 2 verified 13 more before changing anything; session 3 verified the rest and **proved one
finding NOT REAL** (EX-30). One finding was nearly dismissed wrongly because a `grep` was truncated by
escaped quotes. **Measure; do not eyeball.**

---

## Document 1 — `AUDIT-FINDINGS.md`

### CLOSED (19)

| # | Defect | Session |
|---|---|---|
| **1** | Upload size never really enforced — a SAS cannot cap what is written through it | 1 |
| **10** | Uploaded text not marked untrusted in the voice prompt | 1 |
| **13** | Excel merged cells not expanded | 1 |
| **14** | A formula with no cached value leaked its **source** (`SUM(B2:B10)` spoken as a price) | 1 |
| **15** | Word footnotes/endnotes dropped; `basedOn` style chains not walked | 1 |
| **16** | SmartArt/chart text dropped; file-order shape reading; no backdrop rule | 1 |
| **17** | JPEG COM segment survived the byte-for-byte passthrough | 1 |
| **18** | data: URI images decoded unbounded | 1 |
| **8** | ‼️ Draft edit/dismiss deleted image blobs BEFORE the CAS, so a request that lost its race destroyed the winner's picture. Commit first, clean after | 2 |
| **2** | A replaced source blob was never cleaned — now deleted after the CAS, never before | 3 |
| **3** | Multi-file confirm partially committed and was not retry-safe — every file is attempted, failures raised together, and each file is idempotent per (docId, blob) | 3 |
| **5** | FAQ edit wrote Cosmos before the index — ETag pre-check → index → prune → commit, with restore on Conflict and purge on Gone | 3 |
| **6** | Metadata committed before the queue send — previous type/links restored on failure, with a drift alert | 3 |
| **11** | Document cap checked only when the upload URL was minted — **re-checked at confirm against a live count**, and a retry of our own row is exempt so idempotency survives at the boundary | 3 |
| **12** | Request arrays unbounded | 3 |
| **19** | Caller send limits not atomic — **the slot is reserved inside the CAS that checks the cap**, promoted when the send is away, released if it fails. Fixed in BOTH send tools through one shared writer | 3 |
| **20** | Index health was count-only — now also reports **content drift**: a superseded FAQ, a half-applied metadata change, two live title generations | 3 |
| **21** | Business Search returned an image for a result the text-size cap had dropped | 3 |
| **22** | Role-audience keys not validated against the closed role catalogue | 3 |

### OPEN

| # | Defect | Who |
|---|---|---|
| **#7 / Q3-A** | ‼️ **CLOSED 2026-09-06 (Session E).** `UpdateItemAsync` re-read the doc for a FRESH etag then wrote the caller’s STALE object with it — the check passed BY CONSTRUCTION. Now conditional on `item.ETag`, throws on conflict, throws when the item carries no etag, and RESTAMPS the fresh etag onto the caller’s instance. New `UpdateItemWithRetryAsync` is the real read-modify-write. ‼️ **Only 58 of 136 sites could inherit a 412; 58 needed CAS** because the write follows something irreversible — the banked “most call sites need no change” was wrong | **Session E — DONE** |
| **#9** | Post-commit effects not durably coordinated | **Session B.** Needs a new Service Bus queue ⇒ ARM + `deploy.ps1` in the same change |
| **#4** | A failed replacement takes the previously good document offline | ‼️ **Owner said to ignore it** |

---

## Document 2 — `EXTRACTION-PASSAGE-AUDIT.md`

### CLOSED (16)

| ID | Defect | Session |
|---|---|---|
| **EX-03** | OOXML media expansion not cumulatively bounded | 1 |
| **EX-31** | Excel elapsed durations wrapped at 24 hours | 1 |
| **EX-01** | A document answered callers before it was Ready — one `KnowledgeAnswerableRule` now gates retrieval, and the Cosmos filter stays index-only | 3 |
| **EX-02** | A material handle named a position, not words — an 8-hex content fingerprint rides the ref and the send refuses substituted material | 3 |
| **EX-06** | Two caches made a repair reuse the old **interpretation** — `ForceFresh` on the queue message bypasses the banked parse AND the caption reuse, exposed on the admin repair endpoints | 3 |
| **EX-08** | A card's overlap page came from the card's LAST page, but a retained tail can begin earlier — per-sentence page list. **Guarded by a 41-size sweep after the first guard proved vacuous** | 3 |
| **EX-10 / EX-11** | Decorative slivers were kept and ranked by document order — short edge 96, max aspect 16, min area 200×200, ranked by area after a header-only probe | 3 |
| **EX-16** | A full-width horizontal band repeated its text once per spanned cell | 3 |
| **EX-19** | An oversized caption crowded out the prices the caller asked about — **split, never truncated**, every piece keeping the picture's handle | 3 |
| **EX-21** | A document whose text the chunker rejected produced zero cards — outline rescue | 3 |
| **EX-22** | Repeated furniture was collapsed too eagerly — **collapses only at 3+ sections**; tables never | 3 |
| **EX-23** | The inventory signature ignored the current section | 3 |
| **EX-26** | An image survived for a card the payload cap had dropped | 3 |
| **EX-27** | The search script source spanned too little — DocTitle + SectionTitle + DocName + Content | 3 |
| **EX-29** | HTML header/footer were stripped with the nav — header and footer kept, nav still removed | 3 |

### NOT REAL / DECLARED LIMITS (6) — do not "fix" these

| ID | Verdict |
|---|---|
| **EX-30** | ‼️ **PROVEN NOT REAL** — `KnowledgeDocumentParser.cs:1439` already emits `value: <scalar>` |
| **EX-24, EX-25, EX-28, EX-32, EX-34** | Declared limits of the current design, accepted. No change needed |

### CLOSED by Session B — 2026-09-04 (21 sabotages; owner deploys)

| ID | What shipped |
|---|---|
| **EX-13** | A picture card was searchable by title + section + the AI's own words only. The author's alt text (DOCX/PPTX/XLSX/HTML) and the line beside the picture now ride the card's SEARCH text and the describer's prompt — the latter quoted as untrusted data (finding #10). ‼️ **Grounding never enters Content**, so the words a caller hears are byte-identical. ‼️ Its room is RESERVED from the piece budget, or every piece of a split description loses it. ‼️ A picture WITH context never reuses a business-wide caption |
| **EX-14** | A part reused in three sections existed ONCE. Every placement now emits a marker at the same image index — one payload, one upload, one description call. One shared rule (`CollapseRepeatedImageMarkers`) drops a same-section repeat and collapses a picture used in more than `MaxSectionsPerImage` (8) sections as template furniture |
| **EX-15** | A worksheet is segmented into regions by blank rows and declared table ranges, header detection per region. ‼️ **A region with no declared header INHERITS the previous one's**, so splitting can never strip a label. ‼️ A hidden row is NOT a boundary |
| **EX-20** | Every figure in the generated overview must be traceable to what the describer was shown; one traceable to nothing loses its SENTENCE (never the number alone, never rewritten), with an admin alert. Ranges, hourly, `%`, `₹1,00,000`, European `4.500` and Indic digits all covered |
| **EX-33** | All seven searchable fields moved to `en.microsoft`. ‼️ Measured on the live Analyze API: Gujarati/Hindi/Punjabi tokenize byte-identically under both analyzers, so it is neutral for them. ‼️ **Needs an index drop + recreate + full re-ingest** |

**Suites in-tree: API 11 539 · Communications 3 838 · MCP 856 · cosmosindexsetup 181 · 0 build errors.**

### ‼️ Declared limits Session B did NOT close, and why

1. **EX-15, undeclared blocks.** Blocks split by blank rows with no declared header anywhere still inherit
   the first block's labels. Promoting a region's first row on SHAPE was tried and rejected:
   `LooksLikeALabelRow` answers **yes** to `Colour | 60.00` (a bare number with no unit is not a
   value-only line), so it put a price in a column name. R1's ban on shape inference is load-bearing.
2. **The `MaxSectionsPerImage` ceiling of 8 has no corpus evidence** — no picture in any file we hold
   reaches it. It is a precaution, not a measured threshold.
3. **EX-20 part 2 (weight source above the overview) is NOT done.** The main search returns `DocSummary`
   cards alongside records with no rank preference, and the fix belongs in
   `ProviderKnowledgeSearchService.TrimToTokenBudget` / the seating order — a retrieval-side change.

### ‼️ What live data CANNOT prove, and a correction to the earlier handover

- **"Every live File row is a PDF" was WRONG.** Canada: 3 `.json` + 1 `.jpeg`, **no PDF at all**.
  India: **9 `.docx`** + 2 `.pdf` + 8 images + 31 typed FAQs.
- **All nine live `.docx` contain ZERO pictures; there is no live `.xlsx` and no live `.pptx`.** EX-13,
  EX-14 and EX-15 are therefore proven on the 8 sample decks and synthetic fixtures only.
- **All 843 live cards are Latin-script**, so EX-33 has no live exposure today.
- **What DID run:** 17 files parsed old-vs-new — 28 103 characters in, 28 103 out, per-character census
  byte-identical on 17 of 17; and **9 of 9 live `.docx` produce byte-identical CARDS** before vs after.
- ‼️ **A live-index/HEAD drift, NOT from this session:** `Shree_AutoCare_..._Test.docx`'s live cards differ
  from what the current code produces by 719 characters, and the live text runs cells together
  (`"GarageService location: IndiaCurrency"`). A fix already in `main` is undeployed — reprocess after deploy.

### CLOSED by Session C — 2026-09-05 (19 sabotages; owner deploys)

| ID | What shipped |
|---|---|
| **EX-04** | ‼️ **The biggest live defect found in this whole programme.** A vision transcript replaced the machine reading whenever it was non-empty. Measured on the 10 live vision-lane files: **38 facts lost, 9 invented, 4 of 8 readable files damaged** — a provider's supplement label had 7 rows deleted, its product name and pack size dropped, and 0.138 g of fat turned into 0.398 g. Three layers now: the model is **GROUNDED** (handed the machine reading in the SAME call — invention 11 → 0), **re-asked once naming exactly what it left out** (loss 40 → 1), and **gated** (numbers exact, words at a 0.95 floor; still short ⇒ the machine reading is kept + an alert names the pages and the facts). ‼️ Live after: **0 lost, 0 invented.** ‼️ The page image dropped 2048 → **1024 px**, which is why the fix costs LESS than the old behaviour |
| **EX-05 + EX-20 (ranking)** | The model received the provider's rows, the AI's photo description and the AI's overview in ONE undifferentiated list. Every passage now names its **truth channel** (`document` / `picture-description` / `generated-overview`), the prompt requires prices, numbers, dates and names to come from `document`, and the document's own rows are **seated before** anything generated. ‼️ Plus the affordance the owner called critical: a photo result is now an **offer** — "I've got a photo of that, shall I send it?" — instead of the AI's words being read aloud as the document's |
| **EX-09** | Figure anchors were appended EMPTY at the page end, so a photo beside "Model X \| $500" was filed under the page's last heading. Each anchor is now spliced back after the line it followed (order never changes — the image lane binds by ordinal), **and the figure's own text rides with it**, which is how the live label recovered "TRIM VEDA POWDER" and "200 gm" |
| **EX-12** | The same photo saved as PNG and as JPEG was two descriptions and two model calls. A perceptual fingerprint taken during the decode that already happens reuses the description. ‼️ **Identity is UNCHANGED** — imageId stays the byte hash, because the delete-tombstone and blob ownership are keyed on it. In-run only; across documents would need the fingerprint persisted, which is a schema decision nobody has taken |
| **EX-15 (typed sheets)** | ‼️ **The finding as written was NOT REAL** — a sheet with no declaration anywhere gets no labels at all, so "Price: 7" cannot happen there. The real defect was narrower: a block **inherited the previous block's labels unconditionally** once that block declared a header. Now a block inherits only when its SHAPE matches (same width, same kinds of values); otherwise **no labels rather than false ones** (D19) |
| **#9** | ‼️ **Fully closed, with NO schema change** (D23, superseding D21's (a)). The draft is **kept** when a follow-up fails, so the provider's own Approve finishes it — and a category move now refreshes **every** category the business has selected instead of the two the operation knows, so the old category never has to be REMEMBERED. It also repairs drift already in the data, which a persisted field never could. ‼️ The "business-wide sweep" sizing given to the owner earlier was **WRONG and corrected by live measurement**: a business has **1–5** selected-category documents (avg 2 CA, 1 IN), so it is one extra Cosmos read |
| **Page-share cap (D11)** | ‼️ **ALREADY DONE** before this session — `CountShares` filters on `PageShareKind`. Landed in the 18:29 commit; PLAN.md was written before that was known |
| **Document cap (D12)** | ‼️ **ALREADY DONE** before this session — `CountAsync` excludes `Deleting`. Landed in a **23:25 commit, AFTER PLAN.md was written at 19:47** |
| **Space cap (D22)** | The searchable-space cap had D12's exact defect on a different limit — found while verifying D12. `SumPassageCountAsync` now excludes `Deleting` too |

**Suites in-tree: API 11 661 · Communications 3 947 · MCP 869 · cosmosindexsetup 181 · 0 build errors.**

### ‼️ What Session C learned the hard way

1. ‼️ **A CHARACTER ratio is not a fidelity measure (D15).** A faithful transcript of the live price list lost **32.5% of its characters and zero facts** — the audit's own "minimum text coverage ratio" would have failed that good page.
2. ‼️ **Three sabotages PASSED**, and each exposed something real: two vacuous guards (a stray `<` with no later `>` proves nothing about markup-swallowing; a blank page's merged text is identical either way, so only the COUNTER and the ALERT distinguish it) and one piece of **unreachable code** I had written (a header-only region can never satisfy `region.Count > 1`).
3. ‼️ **A test run on a failed build is meaningless.** One sabotage "passed" against a stale binary while a peer's file would not compile. The harness now gates every sabotage on a zero-error build.
4. ‼️ **The plan can be stale.** Two of the nine items were already fixed, one by a commit that landed AFTER the plan was written. Read the code, never the plan.
5. ‼️ **The finding text can be wrong in the direction that matters.** EX-15's stated failure could not happen; the real one was narrower and still shipped a wrong price.

### CLOSED by Session D — 2026-09-06 (9 sabotages; owner deploys)

| ID | What shipped |
|---|---|
| **‼️ Geometry-as-prose** (not in either audit; found by measuring) | `KnowledgeOoxmlText.Flatten` used a DENY-list, so a drawing's own coordinates were indexed as the document's words — live: `"-40640019875500Current state BOND loyalty engine architecture"`, and a table-style **GUID**. A census over 54 `.docx` + 8 `.pptx` proved only **`w:t` and `a:t`** carry author text; it is now an **allow-list**, which is strictly safer (`w:delText`/`w:instrText` are SIBLINGS of `w:t`, never subclasses). **436 junk chars gone, 0 real chars lost** |
| **‼️ THE MONEY CASE** (not in either audit; found by the 49-agent corpus audit) | EX-16 suppressed the spanned-cell duplicate only for a single-cell full-width band. A **partial** `w:gridSpan` still copied its value across every column it covered, shifting every later value one right — a real cost summary produced `RP: 0.7418 \| Total Cost: 0.7418`, **the ratio spoken as the price**. Both readers now give a merged cell its FIRST column and pad the rest (D27) |
| **EX-17 hidden text** | `w:vanish` had no handling anywhere — a run the author marked Hidden reached the index and could be read aloud. Now dropped (D26). ‼️ Direct formatting only; style-based hiding is a declared limit |
| **EX-17 headers/footers** | Read once, deduplicated (D25). ‼️ The old exclusion's premise was **measured FALSE** — 60 rendered pages store **ONE `HeaderPart`**. Recovered real content: `Risk Acceptance & Sign-Off…`, `Confidential — for Scene+ review`, `© 2022 Proprietary and Confidential` |
| **`w:ptab`** | A table of contents welded its page number onto the heading: `"Phase 2 - Cosmos DB12"`. Same class as the `w:tab` fix the file exists for |
| **EX-07 (PPTX)** | `InReadingOrder` bailed to file order unless EVERY shape had its own offset — but a placeholder inherits the layout's. One placeholder disabled ordering for a whole slide: **21 of 87**. `InheritedOffset` resolves 26/26; partial slides **21 → 0**. Every affected slide had its own number wedged between the heading and its body |
| **EX-18** | ‼️ **BUILT (D29/D30)** — the owner authorised creating the missing evidence, so five files with real cached chart XML went into `SampleData`. Measured before: a PPTX chart yielded its title and axis names and **lost every service and every price**; a DOCX chart yielded **nothing at all**. `KnowledgeChartReader` reads a chart as a TABLE (one row per category, one column per series) for PPTX, DOCX and XLSX alike — a chart's numbers are `c:v`, never `a:t`. Points keyed by the plotted `idx`, never arrival order. An XLSX chart is skipped when every plotted figure is already a cell on that sheet (exact containment), so it still reads when the figures live in a linked or hidden sheet — **both directions pinned by their own test**. Shape-fill pictures now reach the image lane through the same collector, backdrop rule included; slide backgrounds deliberately do not |
| **EX-07's résumé example** | ‼️ **PROVEN NOT REAL for Word.** A genuine `w:cols` two-column CV extracts in perfect order — Word columns are a flow, not a layout. The failure the audit illustrates cannot occur in the DOCX lane |

**Suites in-tree: Communications 3 960 (inherited 3 948 + 12) · cosmosindexsetup 181 · API 11 706 pass /
2 fail · MCP 868 pass / 1 fail.** ‼️ **All three failures are a CONCURRENT session's in-flight work**, in
files this session never touched — `SearchKnowledgeTool.cs`, `BusinessSearchToolBase.cs:84` and
`ProviderCatalogSearchService.cs`, all in their `git status`.

### ‼️ What Session D learned the hard way

1. ‼️ **A census over the whole XML tree is NOT the parser's reachable set.** The element census said
   `a:tableStyleId` leaked; I wrote a guard for it; the **corpus diff** proved the parser never walks a
   table's properties. The guard would have passed identically before and after — **deleted before shipping**.
2. ‼️ **The audit text named neither of the two worst defects.** Both came from running the shipping parser
   over real files and reading the output.
3. ‼️ **A failed `cd` left the shell inside a repo** and a probe `Program.cs` was written into
   `Clinqet.Communications.UnitTests/` (§0.16). Untracked, so nothing was clobbered — but it became the test
   assembly's entry point and broke the runner. **Always pass the project path explicitly.**
4. ‼️ **Workflow subagents share the session scratchpad** — 49 of them wrote there and deleted my probe
   project mid-run.
5. **A prior session's test can encode a judgement, not a ruling.** `Docx_APartialSpan_StillCoversTheColumns`
   pinned the behaviour that produced the false money answer; it was in no decision register, so it was
   overridden deliberately and its replacement pins the new contract.

### CLOSED by Session F — 2026-09-07 (13 sabotages; owner deploys)

| item | What shipped |
|---|---|
| **‼️ `UpsertItemAsync` attribution + type guard + etag** (D35) | Session E’s handover said the only `ProviderOwnedEntity` upsert target was `BusinessCustomer`. ‼️ **Measured FALSE — `Availability` is one too**, upserted from three API sites; the weekly-hours save and copy-day-times both construct a FRESH object over `{businessId}_{day}`, so `StampCreatedBy`’s `??=` re-attributed all seven rows to whoever edited last, breaking the invariant `ProviderOwnedEntity`’s own comment states. The stored document is now read on every upsert of a caller-supplied id — which also gives the upsert the **document-type guard the replace path has had since D32**, and it had NONE while writing `{businessId}_{entityId}` ids into shared containers |
| **‼️ `AddItemAsync` never restamped the etag** (D36) | A Session E regression: **create → mutate → update on the same instance threw every time**, with no concurrent writer. Found by **8 `CosmosRepositoryCrudIntegrationTests`** failing against the emulator — a class Session E never ran |
| **‼️ The CRM sync destroyed provider data** (owner-approved) | `CustomerIdentitySyncProcessor` built a fresh `BusinessCustomer` and wrote it over the row. The producers send `LastName` as `""` and `Phone` as `null`, so **a quote for an already-recorded customer blanked their surname and phone in the provider’s CRM** — and erased the row’s attribution. Now `MergeBusinessCustomerAsync`: a read-modify-write that applies only what a sync owns, **never blanks a stored value with a blank one**, writes nothing when nothing changed (so a redelivery is free), and merges rather than throws when a create loses a race |
| **‼️ A caller bug printed its own developer sentence to the provider** (D38) | In this codebase `InvalidOperationException`’s Message **IS a localization key** — 65 controller catch blocks pass it to `GetLocalizedString`, which returns an unknown key **verbatim**. D32’s no-ETag guard therefore showed `"…use UpdateItemWithRetryAsync…"` as a **400 “invalid input”**, in English at any locale. `PersistenceContractException` now falls to the generic localized 500 |
| **‼️ `GlobalExceptionHandler` answered 500 for everything** (D37) | A 412 escaping a controller without `HandleException` told the provider the server had broken. The same five-arm switch was written TWICE in `BaseController` and NOWHERE here; `StorageFailureMapping` is now the one source for all three |
| **‼️ Seven partner-web service modules each dropped the HTTP status** | Session E fixed one seam (D34); the other six had the same shape, so every `if (status === 412)` outside knowledge was dead code. One shared `apiError.js`, seven modules rewired, and a repo-local scan test so no module can grow its own copy again |
| **`w:vanish` via a STYLE** (D39) | D26’s declared limit, closed. A run is hidden by its own `rPr`, its character style or its paragraph style, and styles inherit through `basedOn`. ‼️ **UNION, not the spec’s toggle XOR** — reading a toggle wrong speaks a hidden price to a caller, so fail-closed wins. Document defaults deliberately excluded: one stray attribute would empty a document. ‼️ **A census of 54 corpus `.docx` found `w:vanish` NOWHERE**, so D26 and this both rest on created evidence |
| **‼️ SmartArt order — and Word read diagrams NOT AT ALL** (D40) | The flat `a:t` sweep read the part in STORAGE order, **collapsed a repeated step label**, read the renderer’s `pres` copy as a step, and **a Word SmartArt contributed not one word**. `KnowledgeDiagramReader` walks `parOf` by `srcOrd`, reads connector labels in place, and **appends anything the walk cannot reach so nothing is ever lost** |
| **‼️ A Word floating text box was WELDED into its anchoring sentence** (D41) | Measured: `"Our services include Cut 30 Colour 60"` as ONE line, and two boxes read in creation order. Each box is now its own block, at the anchor, ordered by `wp:positionV`/`H`; a 2+-line box keeps its lines. Covers the `mc:AlternateContent` shape Word really writes. ‼️ **The session’s own audit found headers/footers excluded the box WITHOUT re-emitting it — a letterhead panel was deleted** |
| **‼️ EX-07 PDF: the premise is NOT REAL; the `<th>` header was** (D42) | ONE billed DI call on a two-column PDF created for it: **DI’s reading order is PERFECT**, and its own `paragraphs` array is row-major so “prefer DI’s order” is dead too. What IS real: DI sometimes reads a column flow as a 2-column TABLE and the markdown lane trusted an all-`<th>` row 0 **with no label gate**, while `<thead>`, Word and PowerPoint all gate theirs — `Cut and finish - 30` became the COLUMN LABEL of `Full head colour - 85`. One gate now serves all four. ‼️ **Polygon column detection REFUSED: the two layouts are geometrically identical (y to 0.01in), so any further fix is shape inference (R1)** |

**Evidence created for this session** (`C:NikDataSampleData`): `Clinket_SmartArt_Process.docx` ·
`Clinket_SmartArt_Deck.pptx` · `Clinket_HiddenStyle_PriceList.docx` · `Clinket_FloatingTextBox_Menu.docx` ·
`Clinket_TwoColumn_Menu.pdf`. The GUARDS are in-memory fixtures in the owning repo (§0.17); these files are
for measurement with the shipping parser.

### ‼️ What Session F learned the hard way

1. ‼️ **The handover was wrong about a live surface.** “Every upsert target is a plain `BaseEntity` except
   `BusinessCustomer`” — `Availability` is a `ProviderOwnedEntity` upserted from three API sites. **Read the code.**
2. ‼️ **A test class the previous session never ran was hiding its own regression.** 8 emulator CRUD tests
   failed on `AddItemAsync`’s missing etag restamp. **Run the suites that touch what you changed, not only
   the ones you wrote.**
3. ‼️ **An exception TYPE is part of the user-facing contract here.** `InvalidOperationException` means
   “my Message is a localization key” in 65 places.
4. ‼️ **The first concurrency guard I wrote was wrong about the DOMAIN, not the code** — it had the sync
   overwrite a field the sync legitimately owns. The failure was the test’s premise.
5. ‼️ **My own audit found a defect I had just introduced**: excluding floating boxes from a header’s text
   without re-emitting them DELETED a letterhead panel. Duty 4 is where the real defects are.
6. ‼️ **Measure before building, even when the fix looks obvious.** Polygon column-sorting was the
   “obvious” EX-07 fix; measurement showed DI’s order is already perfect and the two layouts are
   geometrically identical — building it would have been a regression.
7. ‼️ **A peer session COMMITTED my work mid-session** into commits labelled for its own. `git status` went
   clean while I was still working. **Check the log, not just the status.**

### Still open for a later session

| ID | Notes |
|---|---|
| **EX-18** | ‼️ **Blocked on evidence, not effort (D28).** Needs a real file containing a chart |
| **EX-07 (PDF half)** | Our code reads only DI's flattened markdown; word/line polygons are never requested. **No two-column document exists in the corpus**, so the failure cannot be reproduced or measured |
| ~~XLSX side-by-side / "Cons" under "Pros" / stranded labels~~ | ‼️ **CLOSED as declared limits (D31), owner-approved.** Each fix measured WORSE than its defect — see below |
| **Slide-number placeholders** | Still emitted as their own block. Furniture; low |
| ~~EX-18 SmartArt node/edge ORDERING~~ | ‼️ **CLOSED by Session F (D40)** — evidence created, `parOf`/`srcOrd` order, connector labels, repeated labels kept, and **Word read diagrams not at all** |
| **EX-18 rendered-image fallback** | ‼️ **NOT built.** Would need a renderer plus a paid description per chart — propose and get approval first |
| ~~EX-07 / EX-17 PDF + floating-textbox visual order~~ | ‼️ **CLOSED by Session F.** The floating-textbox half was REAL and is fixed (D41). The PDF half is **PROVEN NOT REAL** (D42): a two-column PDF was created and measured, and DI’s reading order is perfect — the real defect was the ungated `<th>` header, now fixed. Polygon sorting REFUSED, with the measurement recorded |
| ~~`w:vanish` via a STYLE~~ | ‼️ **CLOSED by Session F (D39)** — character style, paragraph style and the `basedOn` chain. Document defaults and untyped `mc:Choice` runs stay declared limits, with the reason recorded |
| **New failure mode, accepted** | Reading chart/header/footer parts means a MALFORMED one can now fail a parse that previously succeeded — those parts were never touched before. Consistent with footnotes; **not covered by a test** |

### ‼️ D31 — the three findings that were examined and DELIBERATELY not fixed

| finding | why the fix is worse |
|---|---|
| **XLSX side-by-side tables weld into one** | Nothing is LOST — every figure stays present and findable; only attribution blurs. The fix changes how **every** spreadsheet is cut, and a blank spacer column is far commoner than genuinely side-by-side tables. The safe variant (split only on a *declared* table edge) does not fix the file that exposed it, which declares none |
| **A "Cons" list read under "Pros"** | ‼️ **My own recommendation, REVERSED by measurement.** The only structural trigger is "a data row with exactly one non-empty cell" — measured: **26 such rows in 3 headed tables, and they include `[ \| \| \| \| $0.00 \| \| \| \| \| ]`, a real money row.** Acting on it strips labels from live prices. Promoting "Cons" to a label is vocabulary inference, banned by R1 since it put a price into a column name |
| **XLSX stranded labels** | It IS a one-line setting (`XlsxRegionBlankRowGap`), which is why it looked free — but that setting is **load-bearing for EX-15/D19**: blocks split by a blank row are different tables and must not share labels. Raising it re-merges them and re-creates the `Price: 7` false-label bug D19 exists to remove |

‼️ **The rule they share, and the one to carry forward: a fix that trades a narrow wrong answer for a broad
loss of correct ones is not a fix.**
| **#7 / Q3-A** | ‼️ **DONE 2026-09-06 (Session E)** — 131 sites verified against the code, not 132 taken on trust |
| ~~Finding a photo by an exact product CODE~~ | ‼️ **EXAMINED AND DECLINED (D43).** The grounding is `altText` + 300 chars of the PREVIOUS CARD’S body, and that body is already its own searchable text card — an exact-code query finds the code and the price. Only the photo may go un-offered. A field would duplicate indexed words and make the photo card compete with the card holding the answer. ‼️ It is NOT image content: nothing decodes a barcode. **Closed, not parked** |

---

## ‼️ Open items that are the OWNER's call, not an engineer's

Both change a limit somebody can actually hit, so neither was touched.

1. **The page-share cap counts material sends.** `CountShares` counts every `SharedDetails` marker,
   including the ones the material send writes; `CountMaterialSends` correctly filters by kind. Two
   separate settings exist, so the intent looks like two separate caps — but a caller who is sent two
   pieces of material currently also loses two page-share slots. **Separate the two caps, or leave shares
   counting everything?**
2. **The document cap counts `Deleting` rows.** A provider at the cap who deletes a document cannot upload
   a replacement until the purge finishes — and their own list hides Deleting rows, so they see fewer
   documents than the cap is counting. Pre-existing on the upload-URL path; the confirm-time check now
   agrees with it rather than inventing a second rule.

## ‼️ A live defect found by the audit probe, for the owner to action

**9 typed FAQ rows in business `UKBV84` (IN) are `Ready` with ZERO cards in the index.** They answer no
caller. A tenth FAQ on the same business has its card, and all its file documents have theirs, so this is
real data. The existing count-based drift rule already flags them; the new content rule correctly declines
to accuse them twice.

**Repair:** `POST /api/v1/admin/search/reindex-knowledge/UKBV84/{docId}` — rebuilds a typed FAQ inline.

## What PowerPoint is actually proven to do

- **Proven:** full-width/horizontal bands in PPTX tables (EX-16), and `KnowledgeOoxmlText.Flatten`.
- **NOT proven on live data:** the 8 sample decks in `C:\Nik\Data\SampleData` contain **zero horizontal
  merges**, so EX-16 rests on synthetic guards only.
- **Known open:** EX-14 (a picture on two slides currently appears once — PPTX's seen-part set is global
  across slides) and EX-07/EX-17 (visual reading order). **Until those land, PPTX reading order is not
  proven.** Both are Session B's.
