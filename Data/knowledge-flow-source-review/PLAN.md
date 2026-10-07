# Knowledge flow — the PLAN and the DECISION REGISTER

**This file is the authority for everything still open.** It records what the owner has already decided, so
no session re-litigates a settled question, and it names exactly what each remaining session must ASK before
it builds. Written 2026-09-04 at the owner's instruction, after EX-13/14/15/20/33 shipped.

Read alongside: `AUDIT-FINDINGS.md` (#1–#22) · `EXTRACTION-PASSAGE-AUDIT.md` (EX-01–EX-34) ·
`TRIAGE-AND-STATUS.md` (the scoreboard) · `SESSION-HANDOVER-2026-09-04.md` (banked analysis).

---

## 0. ‼️ THE FOUR RULES FOR EVERY SESSION THAT PICKS THIS UP

### 0.1 Full best practice. No patches.

Fix the CLASS, never the call site. If the correct solution is harder, write the correct solution. A
workaround that makes a symptom go away is a defect with a longer fuse — see the ETag finding (#7), which
looks like a working concurrency check and protects nothing.

### 0.2 ‼️ DO NOT OVER-COMPLICATE. The cheapest correct answer wins.

A new queue, a new table, a new field, a new abstraction — each is a permanent cost paid by every future
session. Before building machinery, ask what the data actually is:

- **Derived data does not need an outbox — it needs a recompute.** A counter, a selection list, a progress
  tick and a thumbnail are all recomputable from the services that exist. A recompute is idempotent by
  nature, repairs history as well as the future, and adds no Azure resource. That is why **#9 is NOT
  getting a Service Bus queue** (§2.1).
- **A one-to-one fact is a column, never a table. A fixed list is an enum, never rows.**
- **If an existing mechanism already does it, use that one.** The codebase has content-limit alerts, a
  media-derivative recovery path, an admin reindex and a timer host. Reach for those first.
- **Premature abstraction is over-complication.** Two near-identical interface members for one optional
  argument is worse than one member with the argument.

### 0.3 ‼️ INFRASTRUCTURE IS ALWAYS THE OWNER'S CALL — ASK, NEVER ASSUME (owner-mandated 2026-09-04)

> Added after the audit's remedy for **#9** was "add a Service Bus queue" and the cheapest correct answer
> turned out to be a recompute with no new resource at all. The owner's words: *"when it comes to
> infrastructure it don't assume and simply need to ask for it and I will confirm or approve."*

**Before ANY of these, stop and ask. Present what it is, what it costs, what breaks without it, and what
the no-new-infrastructure alternative is. Then WAIT.**

| Needs the owner's yes first |
|---|
| A new **Service Bus queue**, topic or subscription |
| A new **storage container**, blob path convention or lifecycle rule |
| A new **Azure resource** of any kind, or a new SKU/scale change |
| A new **`local.settings.json` key** (⇒ ARM + `deploy.ps1` in the same change) |
| A new **timer/function trigger**, or changing an existing trigger's schedule |
| A new **Cosmos container**, or any partition-key choice |
| A new **search index**, alias, analyzer, scoring profile or synonym map |
| Anything requiring an **ARM template** or `azureautomation/deploy.ps1` edit |

‼️ **The default answer is "no new infrastructure".** Recomputing derived data, reusing an existing queue,
an existing timer host or an existing alert channel is nearly always available and nearly always better —
it adds nothing to operate and it repairs history instead of only guarding the future. **If you find
yourself designing machinery, stop and ask whether the data is derived.**

### 0.4 ‼️ NEVER ASSUME — STOP AND ASK

**If a session needs a decision, it stops and asks. It does not guess, and it does not "pick the sensible
default and note it".** Ask before: any schema change (SQL, Cosmos, Search — present the CLAUDE.md §0.7
table and WAIT); any change to which images or content ship; any change to a limit a provider or caller can
hit; any design that is not already written down here; anything where two readings of the request lead to
different work.

Three things this session got wrong by assuming, recorded so they are not repeated:

1. **A hand-rolled probe was treated as evidence.** It keyed OOXML relationship ids by directory, so every
   slide resolved to the last file read. It reported "191 placements lost across 7 of 8 decks"; running the
   real parser said **91 → 139 across 1 of 8**. ‼️ **Measure with the code that ships, never with a script
   that imitates it.**
2. **An alert was assumed to exist.** The owner reasoned "the admin alert will fire so I will know" — and
   it did not; there was only a log line. The assumption was surfaced and the alert was built. ‼️ **If a
   decision rests on something existing, go and look at it.**
3. **PowerShell 5.1 silently mangles non-ASCII in an HTTP body.** The first analyzer probe "proved" the
   search service drops Gujarati. It was the probe. ‼️ **A shocking measurement is a broken probe until
   proven otherwise.**

---

## 1. DECISION REGISTER — settled, do not re-open

| # | Decision | Date | Detail |
|---|---|---|---|
| **D43** | ‼️ **The "find a photo by its product code" field is EXAMINED and DECLINED — it is not needed** | 2026-09-07 | Read the code, not the note: `PendingIndexCard(kind, piece, withGrounding, …)` puts the description in `Content` (stored, spoken AND keyword-searchable) and the grounding in the EMBED text only, so the grounding reaches the vector and never BM25. But the grounding is `altText` + **up to 300 chars of the PREVIOUS CARD'S WHOLE BODY** (`ImageGroundingMaxChars`) — and that body **is already in the index as its own text card**. So nothing is unfindable: an exact-code query finds the text card that holds the code AND the price, which is the answer. The only loss is that the PHOTO may not be retrieved alongside, so it is not offered. ‼️ **A new field would store words the index already holds**, making the photo card compete with the text card that has the real answer and letting both spend the caller's answer budget on the same sentence — a measured cost against a nice-to-have. ‼️ **It is NOT image content**: nothing decodes a barcode (`QRCoder` only GENERATES booking QR codes), so a barcode picture would store the document text beside it, not the digits — and for a PDF those printed digits are already page text. **If it is ever proven to matter, the correct scope is the ALT TEXT ALONE** (short, author-written, not a duplicate), never the 300-char neighbour blob. **No schema change. Nothing parked against the D6 rebuild.** |
| **D42** | ‼️ **EX-07 PDF: the audit premise is PROVEN NOT REAL. The real defect was the `<th>` header, and it is fixed** | 2026-09-07 | Measured with ONE billed `prebuilt-layout`/markdown call on a two-column PDF created for it: DI’s reading order is **PERFECT** (column 1 top-to-bottom, then column 2) — nothing is interleaved, so there is nothing for polygon sorting to fix, and ‼️ **DI’s own `paragraphs` array is row-major, so “prefer DI’s reading order” is DEAD too**. What IS real: DI sometimes reads a column flow as a 2-column TABLE, and the markdown lane trusted an all-`<th>` row 0 **with no label gate** while `<thead>`, Word and PowerPoint all gate theirs — so `Cut and finish - 30` became the COLUMN LABEL of `Full head colour - 85`, Session D’s money-defect class. One gate now serves all four declarations. ‼️ **Polygon column detection is REFUSED: on the measured page a column flow and a real table are geometrically IDENTICAL (y values match to 0.01in), so any further fix is shape inference, banned by R1** |
| **D41** | ‼️ **A Word floating text box is its OWN block, ordered top-to-bottom — it was WELDED into the sentence it was anchored to** | 2026-09-07 | Measured on evidence created for it: `"Our services include"` + a price box read as the single line `"Our services include Cut 30 Colour 60"`, and two boxes on one anchor read in CREATION order. Now each box is its own block (a List when it has 2+ lines, so the line structure survives), placed at the anchor, ordered by `wp:positionV`/`positionH` — the same reasoning as EX-07’s slide fix. An `wp:inline` shape stays in the sentence. ‼️ Covers the shape Word ACTUALLY writes (`mc:AlternateContent`, where the SDK types nothing). ‼️ **The session’s own audit caught that headers/footers excluded the box without re-emitting it — a letterhead panel was DELETED; boxes are now re-emitted there and de-duplicated across default/first/even** |
| **D40** | ‼️ **SmartArt is read in the AUTHOR’S order by one reader shared by Word and PowerPoint — and Word read diagrams NOT AT ALL** | 2026-09-07 | Owner authorised creating the evidence (as D29 did for charts). Measured before: the flat `a:t` sweep read the part in STORAGE order, **collapsed a repeated step label**, read the renderer’s `pres` copy as another step, and **a Word SmartArt contributed not one word** — neither the chart collector (it looks for a `ChartReference`) nor the image collector (a blip) ever saw one. `KnowledgeDiagramReader` walks the `parOf` connections by `srcOrd`, reads a connector label where the author drew it, skips `pres`/`doc`, and ‼️ **appends anything the walk could not reach, so a malformed model degrades to the old behaviour and never loses a word** |
| **D39** | **Hidden Word text via a STYLE is EXCLUDED — D26’s declared limit is closed** | 2026-09-07 | `w:vanish` reaches a run three ways: its own `rPr`, its character style, or its paragraph style, and a style inherits through `basedOn`. Only the first was excluded, so a superseded price hidden by a template style still reached the index. Resolved ONCE per package. ‼️ **UNION across the two style levels, deliberately NOT the spec’s toggle XOR**: reading a toggle wrong speaks a price the author hid to a caller, so the fail-closed answer wins. ‼️ **Document defaults are deliberately EXCLUDED** — one stray attribute there would empty a whole document, and a census of 54 corpus `.docx` found `w:vanish` **nowhere at all** (document.xml, styles.xml or docDefaults), so both this and D26 rest on created evidence. Declared limit: a run inside an `mc:Choice` is untyped, so neither D26 nor this reaches it |
| **D38** | ‼️ **The base repository’s programming-error throws are a DEDICATED exception, not `InvalidOperationException`** | 2026-09-07 | In this codebase `InvalidOperationException`’s **Message IS a localization key** — 65 controller catch blocks pass it to `GetLocalizedString`, which returns an unknown key **verbatim** — so D32’s no-ETag guard printed `"…carries no ETag… use UpdateItemWithRetryAsync…"` to the provider as a **400 “invalid input”**, in English at any locale. `PersistenceContractException` derives from `Exception`, so it falls to the generic handler: a localized 500, which is what a caller bug is. Same for both document-type-mismatch guards |
| **D37** | ‼️ **`GlobalExceptionHandler` no longer answers 500 for everything, and ONE mapping now serves all three sites** | 2026-09-07 | The last-resort handler set 500 unconditionally, so a 412 escaping a controller without `HandleException` told the provider the server had broken and gave their client no status to branch on. The same five-arm switch was written out TWICE inside `BaseController` and NOWHERE here; `StorageFailureMapping` is now the single source. The handler never echoes the driver’s message |
| **D36** | ‼️ **`AddItemAsync` restamps the etag — Session E shipped a deterministic break** | 2026-09-07 | The create path never wrote `response.ETag` back, so **create → mutate → update on the same instance** hit D32’s no-ETag guard and threw every time, with no concurrent writer. Found by 8 `CosmosRepositoryCrudIntegrationTests` failing against the emulator — a class Session E never ran. Every write path now leaves the caller’s instance carrying the current etag |
| **D35** | ‼️ **`UpsertItemAsync` carries `createdBy*` forward, refuses a foreign document family, and restamps the etag** | 2026-09-07 | ‼️ **Session E’s handover was WRONG**: it said the only `ProviderOwnedEntity` upsert target was `BusinessCustomer`. `Availability` is one too, upserted from **three** API call sites — and the weekly-hours save and copy-day-times both build a FRESH object over `{businessId}_{day}`, so `StampCreatedBy`’s `??=` saw nulls and re-attributed all seven rows to whoever edited last. The invariant it broke is stated in `ProviderOwnedEntity`’s own comment. The stored document is now read on every upsert of a caller-supplied id (the Availability path already paid that read), which also gives the upsert the **document-type guard the replace path has had since D32** — it was writing `{businessId}_{entityId}` ids into shared containers with none. Cost: +1 point read on the customer-side mirrors, the same trade D32 already accepted |
| **D1** | Picture reuse ceiling stays at **8 sections** | 2026-09-04 | A picture in more sections is read as template furniture and collapses to one card. ‼️ **Conditional on D2**: the owner accepted 8 *because* an alert now fires. No file we hold reaches 8, so the number has no corpus evidence — it is a setting and moves without a deploy |
| **D2** | The ceiling **raises an admin alert** | 2026-09-04 | `KnowledgeSectionsPerImage`, naming the document and `Voice:Knowledge:Images:MaxSectionsPerImage`. A same-section duplicate is NOT counted — its card would have been byte-identical, so nothing was kept out |
| **D3** | A picture's description **is given the document's own words** | 2026-09-04 | Owner: "output and result is the most important thing." Quoted as untrusted data between `<document_text>` markers, bounded, angle brackets neutralised. ‼️ Consequence accepted: a picture WITH context never reuses another document's cached description |
| **D4** | An overview figure the document never stated **loses its sentence** | 2026-09-04 | Never the number alone (broken English is spoken aloud), never rewritten. Nothing survives ⇒ the computed figures ship alone. Admin alert either way |
| **D5** | The **MFT text-grouping coupling is an accepted limit** | 2026-09-04 | Giving each picture its own card moves where text cards break; a short line repeated in 3+ sections can then collapse. ‼️ **No fact can be lost, and prices are structurally immune** — table rows always keep their section in their identity, so two rows in different sections never collapse. The principled fix (picture cards settle at section end) moves card boundaries for EVERY document with a picture; that blast radius is not worth a 3-letter tag |
| **D6** | **EX-33 analyzers unified**; owner schedules the index rebuild | 2026-09-04 | All seven searchable fields on `en.microsoft`. ‼️ Needs index drop + recreate + full re-ingest. Measured neutral for Gujarati/Hindi/Punjabi on the live Analyze API |
| **D7** | **#9 is solved by recompute, not a new Service Bus queue** | 2026-09-04 | See §2.1. Design still to be shown before building |
| **D8** | **EX-15's typed-sheet case** goes to the next session with the block-comparison design | 2026-09-04 | See §2.2 |
| **D9** | **EX-20's ranking half** goes to the next session | 2026-09-04 | See §2.3 |
| **D10** | Owner **pushes, commits and deploys.** A session never runs `git push` | standing | Committed 2026-09-04 18:29 as "knowledge bug fixed and improvements" across seven repos |
| **D11** | **The page-share cap and the material-send cap are TWO SEPARATE allowances** | 2026-09-04 | Two settings exist, so two limits were intended. `CountShares` must stop counting material-send markers; `CountMaterialSends` already filters by kind correctly. **Session C** |
| **D12** | **The document cap stops counting rows that are being deleted** | 2026-09-04 | The count then matches what the provider can actually see. Accepted trade: deleting and re-uploading several at once may briefly hold more than the cap until the purges finish — temporary and self-correcting. **Session C** |
| **D34** | ‼️ **The two DEAD 412 handlers ARE fixed — at the seam, not the call site** | 2026-09-06 | Partner web’s only 412 branches (Knowledge FAQ + drafts) could never fire: the service layer threw the response BODY and `ApiResponse.StatusCode` is `[JsonIgnore]`d, so `err.statusCode ?? err.status ?? err.response.status` was all `undefined` and `Number(undefined) === 412` never held. Their MOBILE twins worked, so parity was broken in mobile’s favour. `knowledgeServices.handleRequest` now attaches the HTTP status to the thrown payload, exactly as mobile does. Guarded by `knowledgeServices.status.test.js` — 3 tests, sabotage-proven. ‼️ `profileServices.handleRequest` has the SAME shape; nothing branches on a status from it today, so it was deliberately left rather than widened silently |
| **D33** | **Blob cleanup moves AFTER the document write on all six endpoints** | 2026-09-06 | Owner-approved. Already the house rule from finding #8 (“commit the state transition first, then clean blobs”); these six were the same class, never fixed. ‼️ A reorder must not drop the best-effort guard — `DeleteBookingAttachment` initially could throw between the two writes and strand the customer mirror permanently |
| **D32** | ‼️ **ETag: atomic PATCH where the field set is NARROW and STABLE, CAS everywhere a bare 412 would be worse than today, and `UpdateItemAsync` THROWS when the item carries no etag** | 2026-09-06 | Owner-approved, all three. A deliberate unconditional write uses `UpsertItemAsync`, which the customer-side mirrors already do. ‼️ **Only 58 of 136 sites could simply inherit a 412; 58 needed a read-modify-write** because the write happens AFTER something irreversible — the banked “most call sites need no change” was WRONG. ‼️ The etag MUST be restamped onto the caller’s instance: `HandleConfirmedAsync` wrote one instance twice and would have 412’d every time, silently stopping auto-completion platform-wide |
| **D31** | ‼️ **The three remaining corpus-audit findings are ALL declared limits — each fix is worse than its defect** | 2026-09-06 | **(a) XLSX side-by-side tables weld into one**: nothing is LOST, only attribution blurs; the fix changes how EVERY sheet is cut and a blank spacer column is commoner than side-by-side tables. **(b) A "Cons" list read under "Pros"**: ‼️ **the recommendation was REVERSED by measurement** — the only structural trigger ("a data row with exactly one non-empty cell") occurs **26 times in 3 headed tables and includes a real `$0.00` money row**, so acting on it would strip labels from live prices; promoting "Cons" to a label is vocabulary inference, banned by R1. **(c) XLSX stranded labels**: it IS one setting (`XlsxRegionBlankRowGap`), but that setting is **load-bearing for EX-15/D19** — raising it re-merges blocks and re-creates the `Price: 7` false-label bug D19 removed. ‼️ **The shared rule: a fix that trades a narrow wrong answer for a broad loss of correct ones is not a fix** |
| **D30** | **A picture used as a shape FILL is collected; a slide BACKGROUND is not** | 2026-09-06 | A photo dropped into a shape is a picture fill, not a `p:pic`, so the image lane never saw it. It now runs through the SAME collector — byte floor, media budget, EX-14 part dedupe **and the backdrop rule**, so a full-slide panel behind text still costs no paid description. A background is deliberately excluded: the author declared it as background, which IS the backdrop signal, and the lane already refuses layout/master furniture on that reasoning |
| **D29** | ‼️ **EX-18 IS BUILT — a chart is read as a TABLE, by one reader shared across PPTX, DOCX and XLSX** | 2026-09-06 | **Supersedes D28.** The owner authorised creating the missing evidence, so five files carrying real cached chart XML were written into `SampleData`. Measured before: a PPTX chart yielded its title and axis names and **lost every service and every price**; a DOCX chart yielded **nothing at all**. A chart's numbers are `c:v`, never `a:t`. Points are keyed by the plotted `idx`, never arrival order. ‼️ **An XLSX chart is SKIPPED when every plotted label and figure is already a cell on that sheet** — exact containment, never a guess — so it is still read when its figures live in a linked or hidden sheet; **both directions are pinned by their own test**. ‼️ **EX-07's headline "two-column résumé" example is PROVEN NOT REAL for Word**: `w:cols` is a flow, not a layout, and a real two-column CV extracts in perfect order |
| **D28** | ‼️ **EX-18 (charts / SmartArt / shape fills) is NOT BUILT — it is UNPROVABLE on the corpus** (‼️ **SUPERSEDED by D29 the same day**, once the owner authorised creating the evidence) | 2026-09-06 | Counted with the shipping parser over the ~150-file `SampleData`: **ZERO charts** in `.docx` AND `.xlsx` AND `.pptx`, **zero** shape-fill or slide-background pictures, **zero** multi-column (`w:cols`) sections. The defect is REAL by code reading (`TextPointsOf` walks only `a:p`; a chart's series names, categories and values live in `c:v`), but it cannot be validated against one real file. ‼️ **Shipping unvalidated chart extraction into a lane that speaks prices to callers is the wrong trade.** Reopen only when a real file with a chart exists |
| **D27** | **A merged table cell holds ONE value: first spanned column takes it, the rest are padded — in BOTH readers** | 2026-09-06 | EX-16 suppressed the duplicate only for a single-cell full-width band. A PARTIAL `w:gridSpan` still copied its value across every column it covered, shifting every later value one right: on a real cost summary the card read **`RP: 0.7418 \| Total Cost: 0.7418`** — the ratio spoken as the price. ‼️ **Deliberately overrides `Docx_APartialSpan_StillCoversTheColumnsItSpans`**, a prior session's judgement ("the value genuinely applies to them") that was never an owner ruling. The document is genuinely self-inconsistent, so the money is now **unlabelled rather than mislabelled** — D19's principle, a gap beats a lie |
| **D26** | **Hidden Word text (`w:vanish`) is EXCLUDED** | 2026-09-06 | Owner-approved. It reached the index and could be read aloud to a caller as the document's own words — a superseded price, an internal note. ‼️ **Declared limit: DIRECT formatting only.** Style-based hiding is unresolved (`Flatten` is static and has no `StyleDefinitionsPart`); no corpus file uses it |
| **D25** | ‼️ **Word headers and footers are READ ONCE, deduplicated — the 2026-09-03 exclusion is REVERSED** | 2026-09-06 | Owner-approved. ‼️ **The old ruling's stated premise was measured FALSE**: the code claimed reading them "would put sixty copies of a phone number in the index", but a 60-page document with one header stores **ONE `HeaderPart`**. The HTML lane had already been reversed the other way (EX-29). Runs AFTER `PairLabelValueRuns` so two adjacent headers are never read as one label-value run; header IMAGES stay uncollected (a letterhead logo is furniture). ‼️ **No junk filter was needed** — the allow-list fix removed the junk at its root (parts 47→18, none junk). ‼️ **Lane divergence is now known and accepted: HTML keeps · DOCX keeps · PDF still strips** `<!-- PageHeader= -->` |
| **D24** | **EX-13's nearby text does NOT reach the model, and no search field is added** | 2026-09-05 | Checked in code: the line beside a photo is its OWN result (a text card) and D18's seating puts it FIRST, so the model can already say "the Model X, five hundred dollars — I have a photo of it". A field would hand it the same words twice. ‼️ A SMALLER, different gap remains and is NOT closed: the nearby words feed the vector only, never the searchable `content`, so an exact product code (`TL1255C`) may not pull the photo up reliably. That is a search-recall question — revisit it **as part of the index rebuild** (D6), when the field costs nothing extra |
| **D23** | ‼️ **#9 is closed by refreshing EVERY selected category, NOT by persisting the old pair** | 2026-09-05 | ‼️ **Supersedes D21's (a).** Session C had told the owner a whole-business recount was "a business-wide sweep"; **that sizing was wrong and was corrected by measurement** — a business has **1–5 selected-category documents** (live: avg 2 CA, 1 IN; max 5). So it is ONE extra Cosmos read, not a sweep. Visiting them all means the old category never has to be REMEMBERED, so the kept draft's retry repairs it — and it repairs drift already in the data, which a field never could. **No schema change, no approval needed.** ‼️ Both ends of the move are also added explicitly, so it can only ever refresh MORE than the targeted pair it replaced, never less. ‼️ The delta is a MARKER, not an amount: mixing `+1`/`-1` made an already-selected target sum to zero, and a zero delta is DROPPED |
| **D22** | **The searchable-space cap stops counting `Deleting` rows**, exactly as the document cap now does | 2026-09-05 | Same class as D12, different limit. Same accepted trade: briefly over the cap while purges finish |
| **D21** | **#9 ships (a) + (b) only** — capture the old category before the write, and keep the draft until the follow-ups finish | 2026-09-05 | (c), a business-wide recount, was declined: it only repairs drift that already exists, and the admin tools are its natural home |
| **D20** | **EX-12: one description per visually identical picture, identities UNCHANGED** | 2026-09-05 | A perceptual fingerprint taken during the decode that already happens. ‼️ The imageId stays the first 16 hex of the BYTE hash — merging stored files was rejected because the delete-tombstone and blob ownership are keyed on it |
| **D19** | **EX-15: a block whose SHAPE differs from the one above gets NO labels rather than the previous block's** | 2026-09-05 | Same column count + same kinds of values ⇒ continuation ⇒ inherit. Otherwise no labels. ‼️ Accepted trade: rows that carry labels today can lose them. Shape-inference for PROMOTING a header stays banned (R1) — this governs INHERITANCE only |
| **D18** | **EX-05 + EX-20: label the channel, seat source rows first, AND offer the photo** | 2026-09-05 | Each passage says whether it is the document's own words or the AI's description/overview; the prompt requires numbers and names to come from the document's own words; source rows seat before overviews. ‼️ Owner: the OFFER sentence ("I've got a photo of that — shall I send it?") is critical, not optional — caller experience is a first-class part of this item. The nearby-text idea needs a NEW SEARCH FIELD and was deferred to its own §0.7 proposal |
| **D17** | **EX-09: figure anchors are spliced back into place AND the figure's own text is carried** | 2026-09-05 | Anchors never re-order (the image lane binds by reading-order ordinal); no match ⇒ today's append. ‼️ The dropped figure TEXT was found during the EX-04 measurement and is part of this item |
| **D16** | ‼️ **EX-04 ships as GROUND + RE-ASK ONCE + GUARD, page image at 1024px** | 2026-09-05 | Measured live, see §2.5. Grounding is ONE call, not an extra one. Every dial in appsettings so degradation can be corrected without a deploy |
| **D15** | **A character-coverage ratio is NOT a fidelity measure and must never be used as one** | 2026-09-05 | Measured: a faithful transcript of `AutoFix_Price_List.pdf` loses **32.5% of its characters and zero facts** (HTML table ⇒ pipe table). The audit's "minimum text coverage ratio" would have failed that good page. Conserve FACTS, never characters |
| **D14** | The API keys committed in the tracked `appsettings.json` files are **SANDBOX keys — ACCEPTED, not a finding** | 2026-09-05 | Owner: they are all sandbox. ‼️ Never report them, never rotate them, never "fix" them, never list them in a session summary. Recorded in CLAUDE.md §19 and its three parallel copies so no session raises it again. CLAUDE.md §19's rule governs REAL production secrets only |
| **D13** | The 9 card-less typed FAQs on `UKBV84` (IN) are **TEST DATA, not a defect to chase** | 2026-09-04 | Owner: nothing is live in production; these were left by one of their own people. ‼️ **A session may re-sync them if it needs those FAQs for its own testing** — `POST /api/v1/admin/search/reindex-knowledge/UKBV84/{docId}` rebuilds one inline. Never report their absence as a live incident |

### ‼️ Declared limits — accepted, do not "fix" them

- **EX-15, plain typed sheets.** A sheet whose blocks were never formatted as tables still reads the second
  block's values under the first block's column names. **Superseded when D8 lands.**
- **D5's text-grouping coupling.**
- **EX-24, EX-25, EX-28, EX-32, EX-34** — declared limits of the current design.
- **EX-30 is PROVEN NOT REAL.** **#4 the owner said to ignore.**

---

## 2. THE DESIGNS THAT MUST BE SHOWN BEFORE THEY ARE BUILT

Each of these has a shape the owner has agreed IN PRINCIPLE. ‼️ **None is approved to build.** The session
that picks one up presents the design and waits.

### 2.1 #9 — draft approval's follow-up work (D7)

**The defect.** Approving an AI-suggested service saves the service first, then does four more things one at
a time: adds the subcategory to the business's chosen list, refreshes the "how many services" counters,
queues the photo for thumbnails, ticks onboarding. If the save works and any of those four fails, the
service exists with a wrong counter, or missing from a browse list, or with no thumbnail. It is logged and
alerted, and **nothing ever goes back and finishes it.** One case is worse: on an EDIT that changes the
category, the OLD category's counter is refreshed after the service has already moved, so a retry cannot
learn what the old category was.

**Why not the audit's queue.** Every one of those effects is **derived data**. A durable to-do list is
machinery for facts that cannot be recomputed; these can. A queue also costs an ARM entry, a `deploy.ps1`
entry, a function, a message contract, idempotency and dead-letter handling — and it would only guard the
future, never repair the drift already in the data.

**The shape to present:** a recompute pass that recounts a business's category counters and selections from
its actual services · capture the OLD category before the write so the unrecoverable case stops being
unrecoverable · do not remove the draft until the follow-ups finish, so the provider's own retry completes
it. **Ask which of the three the owner wants, and whether the recompute is a timer or on-demand.**

### 2.2 EX-15 — a plain typed sheet with two tables (D8)

**The defect that remains.** `Service | Price` at the top, a blank row, then `Warranty | Days` — with none
of it formatted as an Excel table. The second block's `Paint 7` is still read as **"Price: 7"** when the 7 is
warranty days.

**Why the obvious fix is banned.** Judging a row a header on its own shape was tried and **rejected by
measurement**: `LooksLikeALabelRow` answers YES to `Colour | 60.00`, because a bare number with no unit is
not a value-only line. It would stamp "Colour" onto every price beneath it. R1's ban on shape inference is
load-bearing.

**The shape to present: compare the BLOCKS, do not judge a row.** Same column count and same kinds of values
as the block above ⇒ a continuation ⇒ inherit its labels. A different shape ⇒ a different table ⇒ **no
labels rather than false ones.** That is structural comparison, not vocabulary guessing. ‼️ **Ask before
building** — it changes what a provider's sheet says, and "no labels" is itself a product decision.

### 2.3 EX-20 — rank source above the overview (D9)

The overview's figures are now validated, but a factual question can still surface the overview above the
row holding the actual number. **The shape to present:** a retrieval-side re-rank so extracted rows outrank
generated overviews for factual questions. No schema change. ‼️ It touches the voice retrieval path that
answers live calls, so it needs its own sabotage pass.

### 2.4 EX-05, EX-09, EX-12 — design first, by the audit's own instruction

Read the audit entries, verify each against the code before believing it, present a design, wait.

---

## 3. SESSION PLAN — three sessions, owner-agreed 2026-09-04

‼️ **Each session ENDS by writing the next session's prompt** — see §8. A session is not finished until the
next one can be started by copying one file.

### SESSION C — ‼️ COMPLETE 2026-09-05. All nine items closed; see `TRIAGE-AND-STATUS.md`

**Result:** EX-04, EX-05, EX-09, EX-12, EX-15 (typed sheets), EX-20 (ranking) and #9 shipped; D11 and D12
were found **already done** before the session started (D12 by a commit that landed at 23:25, AFTER this
plan was written at 19:47). D22 was found while verifying D12 and shipped too. 19 sabotages; **three
PASSED** and exposed two vacuous guards and one piece of unreachable code, all rebuilt.
**Live, with the shipped code: 38 facts lost + 9 invented ⇒ 0 and 0.**

‼️ **Two things this session could not close, both §0.7 schema decisions nobody has been asked for:**
#9's old-category counter (needs a field persisted on the draft) and EX-13's nearby text reaching the
model (needs a new search index field). Neither was built. Both are named in `SESSION-D-PROMPT.md`.

**Prompt: `SESSION-C-PROMPT.md` in this folder.**

| Item | What it is | Gate |
|---|---|---|
| **EX-04** | Vision transcription replaces Document Intelligence output whenever the answer is non-empty, with no fidelity check — a fluent but incomplete table silently replaces a correct one | ‼️ **Measurement spend already APPROVED** on the live PDFs. Measure on CHARACTERS. The FIX needs a design shown |
| **#9** | Draft approval's follow-up work is not durably coordinated | ‼️ **RECOMPUTE, not a queue (D7).** §2.1 |
| **EX-15 typed sheets** | A plain typed Excel sheet still reads block 2 under block 1's column names | ‼️ Design shown first (D8). §2.2 |
| **EX-20 ranking** | The generated overview still competes with real rows on equal footing | ‼️ Design shown first (D9). §2.3 |
| **EX-05** | AI image descriptions become searchable facts without grounding validation | Design shown first |
| **EX-09** | Vision transcription moves every figure anchor to the end of its page | Design shown first |
| **EX-12** | Byte-identical hashing does not deduplicate visually identical images | Design shown first |
| **Page-share cap** | The page-link allowance is also spent by material sends, so a caller sent two documents cannot then be sent the page link | ‼️ **DECIDED (D11): two separate allowances — fix it.** No design gate |
| **Document cap** | A provider at the cap cannot upload a replacement until the deleted document finishes purging, and their own list already hides it | ‼️ **DECIDED (D12): stop counting deleting rows.** No design gate |

**Why one session:** one approved measurement plus six small, self-contained designs. None needs new
infrastructure — and if any turns out to, **that is a stop-and-ask**, not a decision to make.

### SESSION D — ‼️ COMPLETE 2026-09-06. EX-07 + EX-17 shipped; **EX-18 deliberately NOT built (D28)**

**Result:** the two biggest defects were found by MEASURING, not from the audit text — the flattener was
indexing a drawing's **geometry** as prose (`"-40640019875500Current state BOND loyalty engine architecture"`),
and a **partial cell merge answered the money column with a ratio** (`Total Cost: 0.7418`). Plus `w:vanish`
hidden text, `w:ptab` welding a page number onto a heading, EX-07's placeholder-position fix (21 of 87 slides
rescued), and D25's header/footer reversal. **9 sabotages, all RED on the right test. In-tree: Communications
3 960.** A 49-agent corpus audit found 5 more, adversarially verified — 2 fixed here, 3 handed on.

| Item | Outcome |
|---|---|
| **EX-07** | **PPTX half DONE** — `InheritedOffset` resolves a placeholder's position from its layout/master. ‼️ **The PDF half is untouched and unmeasurable**: our code reads only DI's flattened markdown (word/line polygons are never requested), and there is **no two-column document in the corpus** |
| **EX-17** | **DONE except charts**: headers/footers read (D25), `w:vanish` excluded (D26), the geometry leak closed. Floating text boxes still read at their anchor's position — the same class as EX-07's PDF half |
| **EX-18** | ‼️ **BUILT (D29/D30)** after the owner authorised creating the missing evidence. A chart is read as a TABLE by one reader shared across PPTX/DOCX/XLSX; shape-fill pictures reach the image lane; slide backgrounds deliberately do not |

**Prompt: `SESSION-D-PROMPT.md`.** **14 sabotages, every one RED on exactly the right test.**
**In-tree at close: Communications 3 968.** The three remaining corpus-audit findings are declared limits
(**D31**) — each fix measured worse than its defect.

‼️ **The GOLDEN CORPUS IS BUILT FIRST and it is the bulk of the session.** Expected reading order recorded
per slide and per page, per file, by hand. Without it there is nothing to measure a change against and any
"improvement" is an opinion. Sources: the 8 decks in `C:\Nik\Data\SampleData`, the 9 live `.docx`, the live
PDFs, plus any file the owner adds. ‼️ **Ask the owner for more sample files before starting** — the corpus
we hold contains no résumé and no two-column page.

### SESSION E — ‼️ COMPLETE 2026-09-06. The ETag programme (#7 / Q3-A) shipped in one change

`CosmosDbRepository.UpdateItemAsync` re-read the document **to obtain its current etag**, then wrote the
caller’s **stale** object with it. The check passed by construction and the 412 retry repeated the pattern.
**131 production call sites verified against the code** (the banked ~132 was right to one).

‼️ **The banked design was WRONG about scale.** It said *most call sites need no change*. Measured over 136
surveyed sites (101 adversarially verified, 51 of those CORRECTED): **58 could inherit a 412 · 58 needed a
read-modify-write · 17 needed an owner ruling · 3 were blind writes with no etag at all.**

| Owner ruling | D |
|---|---|
| Everything in ONE change, atomic PATCH where narrow / CAS elsewhere, throw when no etag | **D32** |
| Blob cleanup moves AFTER the document write on all six endpoints | **D33** |
| `showError` fixed, and the two DEAD 412 handlers repaired at the service seam | **D34** |

**Shipped:** the base contract (conditional on `item.ETag`, throw on conflict, throw on a missing etag,
**restamp the fresh etag onto the caller’s instance**, document-type guard on the update read) ·
`UpdateItemWithRetryAsync` · 75 call-site conversions across 33 files · `TryPatchStatusAsync` for the
CustomerBooking mirror · the `BroadcastService` blind-write root cause · `SetAssignmentAsync` for the
bookings handover · the conflict copy reworded in all five languages · `showError` in both web apps.

**Proven:** 9 base unit tests + **8 emulator integration tests** (stale writer loses, fresh wins, no-etag
refused with the document untouched, same instance written twice, 4 concurrent increments all land ×3 runs)
+ a Functions emulator proof that a cancellation racing auto-completion is not overwritten. **4 sabotages,
each RED on exactly the right guard, restored byte-identical.**

‼️ **Adversarial review of this session’s own conversions found six defects, all fixed** — a duplicated
customer address on a lost write-ack, a successful delete reported as 404, an edge-triggered currency
re-stamp that could strand a catalogue permanently, a booking/mirror divergence when a blob delete threw,
a duplicate invoice email, and a missing document-type guard in the new base read.

---

### SESSION F — ‼️ COMPLETE 2026-09-07. The four residuals CLOSED, plus eight write-path defects the residual list never named

‼️ **The handover was wrong about a live surface.** It said the only `ProviderOwnedEntity` upsert target was
`BusinessCustomer`; `Availability` is one too, upserted from three API sites, and every weekly-hours save was
silently rewriting its own creator. ‼️ **And EX-07's PDF half, listed as "real but unmeasurable" by four
sessions, measured NOT REAL** on the first billed call — while the "obvious" polygon fix would have shredded
every genuine price table.

| Owner ruling | D |
|---|---|
| `UpsertItemAsync` carries `createdBy*` forward, refuses a foreign family, restamps the etag | **D35** |
| `AddItemAsync` restamps the etag (a Session E regression) | **D36** |
| `GlobalExceptionHandler` maps storage failures; ONE mapping for all three sites | **D37** |
| The base repository's programming errors are a DEDICATED exception, not `InvalidOperationException` | **D38** |
| `w:vanish` via a STYLE is excluded — union, not toggle XOR, and no document defaults | **D39** |
| SmartArt read in the author's order, by one reader, and Word reads diagrams at all | **D40** |
| A Word floating text box is its own block, ordered top-to-bottom | **D41** |
| EX-07 PDF premise PROVEN NOT REAL; the ungated `<th>` header was the real defect | **D42** |

**Also shipped, owner-approved:** the CRM identity sync merges instead of replacing (it blanked a provider's
surname and phone whenever a quote carried neither), and all seven partner-web service modules route errors
through one seam that attaches the HTTP status — Session E had fixed one of the seven (D34).

**Proven:** 13 sabotages, every one RED on exactly the right guard, each gated on a zero-error build and
restored byte-identical (MD5 verified). **In-tree at close: API 11 815 · Communications 4 020 · MCP 878 ·
emulator 81 · partner-web jest 153 · 0 ESLint.**

**Evidence created** in `C:\Nik\Data\SampleData`: `Clinket_SmartArt_Process.docx`,
`Clinket_SmartArt_Deck.pptx`, `Clinket_HiddenStyle_PriceList.docx`, `Clinket_FloatingTextBox_Menu.docx`,
`Clinket_TwoColumn_Menu.pdf`. The GUARDS are in-memory fixtures in the owning repo, per §0.17.

**Prompt: `SESSION-G-PROMPT.md`.**

---

## 4. RESOLVED 2026-09-04 — formerly "on the owner's desk"

All three inherited items now have a decision. See **D11**, **D12** and **D13** in §1. The two fixes are in
Session C's scope (§3); the FAQ rows are test data and are not a defect.

---

## 5. ‼️ AFTER THE NEXT DEPLOY — the OWNER's actions, NOT any session's work

**No session is blocked on these and no session should attempt them.** They are listed here so they are not
forgotten, and so a session never re-raises them as findings.

### 5.1 Rebuild the knowledge search index (EX-33 / D6)

‼️ **An analyzer change cannot be applied in place.** `CreateOrUpdateIndex` will REFUSE it. The index must be
DELETED, recreated, and every document re-ingested.

**Proven 2026-09-04 against the live Canada service** by creating the definition under a throwaway name,
reading it back and deleting it: all seven searchable fields carry `en.microsoft`, 18 fields total, scoring
profile `knowledgeRelevance` and one semantic configuration — **and no `language` field**, because a fresh
create has none.

Per region (CA then IN):

1. Delete the index `clinket-knowledge-dev-v1` (the alias `clinket-knowledge-dev` points at it).
2. Recreate it:
   `dotnet run --project C:\Nik\cosmosindexsetup --launch-profile "Dev (Canada)" -- --search-only`
   then the same with `--launch-profile "Dev (India)"`.
   ‼️ **Always `--launch-profile`** — the tool ignores a shell `CLINKET_REGION`.
3. Reprocess every knowledge document so its cards are written back. Until this runs the knowledge base
   answers nothing.

‼️ **A session must NOT do this.** Dropping the index destroys all live cards, and putting them back needs
the deployed ingest pipeline. Re-implementing that in a harness is exactly the kind of machinery §0.2
forbids, and a mistake writes wrong data to the live index.

### 5.2 ‼️ The `language` field needs NO workaround — checked, not assumed

The live index carries a dead `language` field the code stopped writing (P1.5). It does **not** need to be
added back, and there is **no** add-redeploy-remove round trip to perform.

- On a **fresh create** (what a rebuild does) the field simply does not exist — **proven: 18 fields, no
  `language`**.
- On a **CreateOrUpdate** against the existing index, `PreserveLiveOnlyFields` already carries live-only
  fields forward, so a removed model property cannot fail the update. That guard exists precisely because
  removing `language` once blocked `scripts` from reaching either region.

### 5.3 Reprocess one India document

`Shree_AutoCare_Garage_Service_Price_List_Test.docx` (IN, `UKBV84`). Its live cards are **719 characters**
different from what the current code produces, and the live text runs cells together
(`"GarageService location: IndiaCurrency"`) where current code spaces them properly. **A fix already in
`main` is undeployed.** ‼️ **NOT a regression from the extraction work** — proven: 9 of 9 live Word documents
produce byte-identical cards before and after it. §5.1's rebuild covers this document too.

### 5.4 ‼️ THE LIVE INDEX IS SEEDED AND USABLE — do NOT rebuild it, and do not be misled by it

**Owner decision 2026-09-04: leave the current environment alone. The whole audit is fixed first, then a
NEW environment is built fresh — one rebuild ever, with every fix already in.**

- **The index is intact and full**: **CA 744 cards · IN 99 cards** (checked 2026-09-04). Every session runs
  against it as-is. **No session rebuilds it, reseeds it or deletes it.**
- **An analyzer is a property of the INDEX, not of the code that writes to it.** So cards written by newer
  code land correctly; they are merely *searched* with the older analysis. Nothing half-states, nothing
  corrupts, and re-ingesting during a session is safe.
- ‼️ **THE TRAP.** Until the rebuild, the live index still carries `docTitle`, `sectionTitle`, `docName` and
  `linkedServiceNames` on `standard.lucene`. **A session that measures search RECALL on the live index will
  see stemming and accent misses that its own code has already fixed** — "price lists" will not find a
  section titled "Price List", and "cafe" will not find "Café". **That is the un-rebuilt index, NOT a defect
  in your work.** Verify analyzer behaviour with the Analyze endpoint against a throwaway index, never by
  inferring it from live recall.

## 6. WHAT THE LIVE DATA CAN AND CANNOT PROVE

‼️ **State this plainly in any report; do not let it be read as broader coverage than it is.**

- **There is no live `.xlsx` and no live `.pptx` in either region.** All nine live `.docx` contain **zero
  pictures**. EX-13, EX-14 and EX-15 are proven on the 8 sample decks in `C:\Nik\Data\SampleData` and on
  synthetic fixtures — **not on live data, because live data contains none of the conditions.**
- **All 843 live cards are Latin-script**, so EX-33 has no live exposure today either.
- ‼️ The earlier handover's "every live File row is a PDF" was **WRONG**. Canada: 3 `.json` + 1 `.jpeg`,
  **no PDF at all**. India: 9 `.docx` + 2 `.pdf` + 8 images + 31 typed FAQs.
- **What did run:** 17 files parsed old-vs-new — **28 103 characters in, 28 103 out**, per-character census
  byte-identical **17 of 17**; and **9 of 9 live `.docx` produce byte-identical cards**.

---

## 7. HOW TO WORK IN THIS TREE

- ‼️ **Another session may be live.** Build into a private folder — `-p:UseArtifactsOutput=true
  -p:ArtifactsPath=<session scratchpad>` — so two sessions can never share `obj/bin`. **A compile error in a
  file you never touched means a peer is mid-write: retry, and if it persists, stop and tell the owner.**
  ‼️ Isolated builds make ~127 convention tests fail LOUDLY, because they walk up from the binary to find
  source and cannot. That is correct behaviour, not a defect — clear them with ONE in-tree run at the end.
- ‼️ **NEVER `git checkout` / `restore` / `reset` / `stash` / `clean`.** Snapshot to the scratchpad and
  restore with `cp`. ‼️ **Snapshot JUST IN TIME** — restoring from a snapshot taken earlier in the session
  silently reverts later refinements.
- ‼️ **Every guard must be proven able to fail**, and a sabotage that PASSES means the guard or the code is
  wrong. Two guards in this programme were vacuous; one sabotage passed and exposed unreachable code.
  ‼️ **A guard handed the same input on both sides proves nothing.**
- **Credentials are read at runtime** from `cosmosindexsetup/appsettings.{ca,in}.json`, never copied into a
  file, a doc or a commit. Search alias `clinket-knowledge-dev` needs api-version `2026-04-01`; the fields
  are `chunkKind` and `sectionTitle`. Cosmos is database `Clinket-nonprod`, container `KnowledgeBase-dev`,
  partition key `/businessId` — every query partition-scoped.

---

## 8. ‼️ EVERY SESSION WRITES THE NEXT SESSION'S PROMPT (owner-mandated 2026-09-04)

**A session is not finished until the next one can be started by copying a single file.** Before reporting
done, the session MUST:

1. **Write `SESSION-<letter>-PROMPT.md`** in this folder for the session that follows, covering:
   - the exact items, with the finding text verified against the code (never taken on trust);
   - **which files it owns**, and which belong to a concurrent session;
   - every decision already made, so it does not re-litigate them;
   - **what it must ASK before building** — every design gate and every infrastructure gate (§0.3);
   - the coding standards, the sabotage discipline, the live-data duties and the closing audit (all of
     §0 and §7 of this file, restated in the prompt so it stands alone);
   - the suite counts it inherits and must not drop;
   - ‼️ **the instruction to write the prompt after it** — this rule is self-propagating.
2. **Update this PLAN** — the decision register, the session plan, the declared limits.
3. **Update `TRIAGE-AND-STATUS.md`**, the `clinqet-voice-assistant` SKILL in **all four** copies, and the
   memory entry.
4. ‼️ **Paste the prompt into the chat as well as writing the file** — the owner copies it from there
   (memory `feedback-deliver-prompt-in-chat-not-only-a-file`).

## 9. THE CLOSING DUTIES OF EVERY SESSION — none optional

1. ‼️ **A zero-error build gates every test run.** A stale binary "passes".
2. ‼️ **Every guard proven able to FAIL**: break the fix, watch it go red on exactly the right case, restore
   from a **just-in-time** scratchpad snapshot, confirm byte-identical, re-run green. One sabotage at a
   time. **A sabotage that PASSES means the guard or the code is wrong — never the sabotage.** Prefer a
   sweep to a pinned case. **A guard handed the same input on both sides proves nothing.**
3. ‼️ **Live-data verification, with the character-level delta stated** — and stated honestly about what the
   live corpus cannot cover (§6). **Measure with the code that ships, never a script that imitates it.**
4. ‼️ **A full 11-dimension audit of the session's own changes, and fix everything it finds**: correctness ·
   concurrency & idempotency · failure and partial-failure paths · cost and performance (RU, AI calls,
   index size) · security and tenancy isolation · limits and what happens at them · observability (does an
   operator actually learn?) · localization (never a raw English string to a provider or caller) · test
   quality (can each guard actually fail?) · config hygiene (a setting only in the host that reads it) ·
   docs, skill and memory currency.
5. **Full suites green**, in ONE in-tree run at the end. Isolated runs are for iterating.
6. **Leave the tree clean** (§0.16) and LOOK at `git status --porcelain`.
7. **The owner pushes and deploys. Never `git push`.**
