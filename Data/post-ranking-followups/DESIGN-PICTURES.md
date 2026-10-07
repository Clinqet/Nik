# DESIGN — Pictures: remove the 40-per-document limit properly

> Status: **APPROVED BY THE OWNER 2026-09-29** (PLAN §10): ceiling 300, text first, resumable per-picture descriptions, `readingProgress` (§0.7 approved, nullable), sheet `knowledge-reading-progress` approved. The build session still re-reviews it and ASKS before any deviation.
> **Built 2026-09-30 — what was built, and every difference from the text below, is in §12.**
> Written 2026-09-29 from the real code (`KnowledgeIngestProcessorFunction.RunImageLaneAsync` and friends) and the
> sandbox corpus.

---

## 0. What the corpus says

Distinct pictures past today's decorative floor (short edge ≥ 96 px, area ≥ 200², aspect ≤ 16), India sandbox:

| Document | Pages | Pictures past the floor | Kept today |
|---|---|---|---|
| e-brochure-hilux | 28 | 95 | 40 |
| e-brochure-urbancruiser-ebella | 20 | 89 | 40 |
| MG Windsor EV (live run: 98 found) | 46 | 82 | 40 |
| e-brochure-hycross | 15 | 62 | 40 |
| e-brochure-uc-taisor | 24 | 56 | 40 |
| e-brochure-urbancruiser-hyryder | 14 | 53 | 40 |
| accessories-glanza / innova-a4 / Glanza | 4 / 2 / 1 | 47 / 47 / 44 | 40 |
| 10 other documents | — | ≤ 41 | all |

**12 of 22 real brochures lose pictures today.** A picture adds ~0.8–1.2 KB to the document row (measured: MG Windsor's
row is 33 KB with 40 pictures).

---

## 1. How a picture stays tied to its page and its words (unchanged — the owner's question)

Every picture is PINNED during extraction, before any AI runs:

- its **page**, its **figure number**, and its exact **position among the text blocks** (`AnchorIntoBlocks`), so its
  `ImageMarker` block sits where the picture sits;
- the **words that belong to it** — its alt text and its own nearby line (`BuildImageGrounding`, `PictureLabel`) — and
  the heading it sits under.

Its description card inherits that position, that page and that heading. **This design changes only WHEN a picture's
description is written, never WHERE the picture belongs.** Pinning is deterministic: the same file read again produces
the same pins (the text reading, the figure list and the file's rasters all come from banks), and a description is only
ever reused for the same bytes beside the same words (C7, P4-E-26 AR-X1).

---

## 2. The flow

Today the whole picture lane runs inside the ONE delivery that finishes reading the pages, and a crash anywhere in it
loses every description it had paid for.

### Pass A — find, pin, choose, store (no AI)

Exactly today's steps, unchanged in order: collect markers → resolve bytes → exact de-duplication (by stored object and
by content hash) → header probe → decorative floor → rank by area → the ceiling (§4) → normalize → **store the picture**
(the same blob path it has today, idempotent) — one picture decoded at a time, under the heavy-work gate (§1 of the plan).

### Pass B — describe, in as many deliveries as it takes

For each chosen picture, in the ranked order: if its description is **banked** (§3), use it; else describe it
(`CaptionAndClassifyAsync`, and the picture-text reading where today's rules call for it) and **bank it at once**.
A delivery describes pictures until either `Images:PicturesPerPass` (default **40**) are done or its time runs out; if
pictures remain, the reading **carries on** in the next delivery, exactly as a long document carries on page by page
(`EnqueueContinuationAsync`), and the row stays Processing.

### Pass C — publish once

When every chosen picture has a description (or a final answer that it cannot have one), the delivery builds ALL cards
(text + every picture at its pin), embeds, indexes and commits Ready in ONE commit — today's publish, unchanged.

**A document with 40 pictures or fewer never leaves the delivery it runs in today**: Pass A, B and C happen in that same
delivery, in the same order, with the same inputs. Only a document with more pictures carries on.

Each later delivery re-derives the text reading from its banks (Document Intelligence bank + page cache + parse +
figure binding — no AI, and with §1's lazy rendering no page is drawn again), re-runs Pass A (every picture already
stored is found by its path) and continues Pass B from the bank.

---

## 3. What is banked, and where (blob only — no Cosmos field for the bank)

- **One description per picture**: `_ocr/{businessId}/{docId}/cap-{pictureHash}-{fingerprint}.json` — beside the
  picture's existing Document Intelligence bank (`di-{pictureHash}.json.gz`), inside `KnowledgeBlobPaths.OcrPrefix`,
  which the purger and the business-closure teardown already sweep (P4-B-25). It holds the caption, kind, quality, the context hash it was written
  beside, and the reading epoch that banked it.
- The fingerprint folds in everything that could change the answer: the caption deployment, reasoning effort, token
  ceiling, the classifier prompt, the document language, and the context hash (the words it was written beside). A
  change to any of them is a miss, never a stale reuse.
- **Forced-fresh reading** ("Read again" that re-reads): reuses only descriptions its OWN reading banked (the same
  `ThisReadingOnly` rule pages follow, P4-B-27).
- **A refusal** (content filter) is banked as a refusal, so no later pass pays for it again; **a throttle or an outage
  is never banked** (P4-B-14) — that picture is tried again in the next pass.
- The business-wide reuse map from committed rows (§6.5 cost rule) stays exactly as it is.

---

## 4. Limits

1. **Per-document ceiling** — `Images:MaxImagesPerDocument` **40 → 300 (APPROVED 2026-09-29)**: 3× the largest real
   document (95), ~300 KB of row at the measured entry size. The build reports the measured cost and time per 100
   pictures (§10) to the owner.
2. **Row-size guard** (new): the registry is also bounded by its SERIALIZED size, `Images:MaxRegistryBytes` (default
   **1,000,000** — half of Cosmos's 2 MB item limit), so an unusually long set of descriptions can never make the
   document's row unwritable.
3. **The business's space (searchable parts) governs**: every described picture is a card and counts against the
   business's cap (the admin override on the profile, else the default — already on master). Today the overflow gate
   refuses the WHOLE document when its cards do not fit. **APPROVED rule**: pictures are the optional part — when text +
   pictures do not fit but the text does, the pictures that fit are kept (in the same usefulness order) and the rest are
   left out with a plain notice. A document is refused only when its TEXT does not fit, exactly as today. Without this,
   raising the ceiling could refuse documents that are accepted today — a regression.
4. **When a ceiling is reached** — the rule that chooses stays today's: largest picture area first, document order among
   equals; the registry is shown in document order. The provider is told plainly (§6).
5. **Picture-text reading** — `Images:MaxTranscribedPictures` **5 → 50 (APPROVED)**. It only ever runs for a Word, Excel,
   PowerPoint or web-page picture that looks like text (a photographed price list): a PDF or photo's pictures are already
   read with their page. It counts attempts, each one a Document Intelligence read + one reading call.

---

## 5. Near-duplicates (APPROVED)

The plan asks for near-duplicate detection "for repeated logos/icons". Measured: repeated logos are ALREADY one picture
— the same stored object, or the same bytes, collapses today. The remaining risk is the SAME photo embedded twice at two
sizes. **Approved rule**: collapse two pictures only when, scaled to the same 32×32 in colour, they differ by ≤ 2% per
channel AND their aspect ratios match within 1% — "the same picture at another size", keeping the larger. Never a
grey-scale perceptual hash: the car brochures carry the SAME car in several colours, and a grey-scale hash would throw
away the colours a caller asks for. Measured on the corpus before it ships; every collapse is listed and shown to the
owner.

---

## 6. What the provider sees (plain words, 5 languages, web + both mobile apps; MOCKUP GATE)

- **While reading**: "Reading pictures: 40 of 108" (and, for a long document, "Reading pages: 12 of 46"). This needs the
  numbers on the document row → **the new Cosmos field `readingProgress` `{ stage, done, total }` (§0.7 APPROVED
  2026-09-29, PLAN §10): nullable, absent when nothing is being read**. Written once per pass (not per picture),
  cleared by the commit.
- **When done**: today's `Info_KnowledgePicturesOverLimit` ("{found} pictures found, {kept} kept") stays for the ceiling;
  one new notice for the space rule (§4.3): `Info_KnowledgePicturesLeftOutSpaceFull` — "All the text was added, and {0}
  of the {1} pictures. The rest didn't fit in your searchable space — delete a document you no longer need, then choose
  Read again to add them." (approved sheet F).
- Mockup `Data/mockups/knowledge-reading-progress/` — APPROVED 2026-09-29 (PLAN §11). The build may improve it under
  FINAL-PLAN §0a.

---

## 7. Memory and time

- One picture decoded at a time (today's rule), the decode under the heavy-work gate; a description call holds only the
  downscaled bytes (≤ 1024 px).
- A picture pass is bounded by `Images:PicturePassSeconds` (default 600) as well as `PicturesPerPass`, so a delivery
  never runs long enough to widen what a crash can kill (the plan: "timeouts are not the fix").
- `StaleProcessingMinutes` is derived from the longest chain and convention-tested; picture passes lengthen the chain, so
  it becomes `(MaxReadingContinuations + 1) × IngestTimeoutSeconds + back-off + MaxPicturePasses × PicturePassSeconds`
  (330 → ~430 min with the defaults; `MaxPicturePasses` = ceil(300 / 40) = 8). The test that pins the derivation is
  updated with it.

---

## 8. A rule this needs that the plan did not name: a follow-up for an OLD reading is dropped

A continuation or a scheduled retry carries its reading's epoch. Today nothing checks it: if a reading went stale and a
"Read again" started a new one, the old chain's next message would still be processed. Harmless today (banks are keyed by
content), but with picture passes it would describe pictures for a reading nobody needs. **New rule (Functions host)**:
a follow-up (`Continuation > 0` or `Attempt > 1`) whose epoch is older than the row's current reading (the row's
`ProcessingSince`, §2A of the plan uses the same identity) completes as superseded and does nothing. It is the same
"which reading is this row in" test the dead-letter handler uses.

---

## 9. Edge cases and their answers

| Case | Answer |
|---|---|
| 0 / 1 / 40 pictures | one delivery, exactly today's path |
| 41 / 108 / 300 | Pass A once, Pass B in 2 / 3 / 8 deliveries, Pass C once |
| 1,000+ | the 300 ceiling (by area) + the row-size guard; the provider is told "{found} found, {kept} kept" |
| identical picture on every page | one stored object → one picture, one description, every placement carries it (EX-14) |
| near-duplicates | §5 |
| pictures in tables | pinned by their marker inside the table's page position (unchanged) |
| scanned page (whole-page raster) | the whole-page filter (F7), unchanged |
| a picture that is mostly text | today's rules: its words are read for Office/web documents; a PDF's page reading already holds them |
| tiny icons | decorative floor, unchanged |
| decode bombs | the decode ceiling, unchanged |
| JPX / JBIG2 | Document Intelligence's crop (ordinary pages) / our own render (oversize pages) |
| no nearby text | described from its pixels only, unchanged |
| Read again / replacement mid-chain | the API refuses a Processing row unless stale; a stale chain's follow-ups are dropped (§8); banks are keyed by content |
| delete mid-chain | every pass re-reads the row; Deleting → the purge; stored pictures are under the document's prefix |
| business closed mid-chain | the row is gone → the purge |
| space full mid-document | §4.3 — pictures trimmed to fit, never the text |
| one picture failing permanently | counted unreadable, the document completes (unchanged) |
| transient description failures | not banked; tried again next pass; after the last pass it is "undescribed" with today's alert |
| crash mid-pass | only the picture in flight is paid again |
| two documents of one business | the session interleaves them message by message (FIFO) |
| WhatsApp send limit, "can be sent" | unchanged per picture |
| Ask Clinket citations, receptionist sends | every picture card carries its `imageRef`, unchanged |
| storage clean-up on replace/delete | the post-commit stale-asset delete and the purger, unchanged |

---

## 10. No-degradation proof and cost

1. **≤ 40 pictures** (the Canada regression set + 10 India documents): the same single delivery, the same selection and
   order, and — fed the same descriptions — **byte-identical cards** (the same "same inputs" harness as the tall-page
   design, §12).
2. **> 40 pictures** (hilux, ebella, MG Windsor, hycross, taisor, hyryder): the first 40 cards are the same pictures as
   today (same area ranking); every added picture is checked against its page in the viewer, and asked in Ask Clinket
   and the receptionist path ("show me the {colour/model}") — the right picture from the right page.
3. **Crash proof**: kill a picture pass (sandbox) → the next pass pays only the unfinished pictures (counted from the AI
   usage records).
4. **Cost and time**: measured on MG Windsor and hilux, per 100 pictures (descriptions + picture-text readings, tokens
   and seconds), reported before the ceiling is fixed.

## 11. Tests

- **Unit (Functions host)**: pinning stable across passes; the bank key (every fingerprint input moves it); refusal
  banked, throttle never; `ThisReadingOnly`; the pass bound (count and time); the continuation for pictures; publish once;
  §4.3 trimming (text fits / text does not); the row-size guard; the superseded follow-up (§8); ≤ 40 takes one delivery.
- **Integration (real engines — Azurite + the Cosmos emulator)**: a 108-picture synthetic document through three passes
  → one commit, every card with its pin; a crash between passes; a delete mid-chain purges every stored picture; the
  space rule against a real index count.
- **Live**: real uploads (0, 12, 40, 108, 300 pictures — the team's 108-picture document and MG Windsor included),
  watched to Ready and asked in Ask Clinket and the receptionist path.

---

## 12. As built (build session, 2026-09-30) — where it differs from §0–§11, and why

Every difference below was reviewed from every side before the code and is logged, with its evidence, in `PLAN.md` §10
(rows dated 2026-09-30, "W4 …"). Nothing here overrides an owner ruling.

**Passes.** A delivery works on at most `Images:PicturesPerPass` (40) pictures, stops starting new ones after
`Images:PicturePassSeconds` (600 — from the lane's start in the delivery that read the pages, from the delivery's start in
a picture continuation) or at its own deadline less `Vision:PipelineReserveSeconds`. Banked pictures cost nothing and do
not count. Pictures left → a **picture continuation** (its own counter `PicturePass`, message id
`{biz}:{doc}:{mode}:{epoch}:pictures{n}`), so page continuations and picture passes never share a limit. The chain is
capped at `MaxPicturePasses` = ceil(`MaxImagesPerDocument` / `PicturesPerPass`) = 8. A continuation carries the reading's
own description (`Described`: title, summary, language), so the describe call is paid once per reading and every pass
describes in one language.

**When a chain must stop with pictures still waiting** (`PicturePassStop`): a pass that worked and banked nothing → the
image-lane failure alert; the passes ceiling or the per-document AI allowance → `KnowledgePicturePassesExhausted`. Either
way the document publishes what it has, tells the provider (`Info_KnowledgePicturesNotFinished`), and its artefact is
marked so "Read again" resumes the rest from the bank.

**The bank** (`KnowledgePictureDescriptionBank`, `_ocr/{biz}/{doc}/cap-{pictureHash}-{fingerprint}.json`). Holds the
description, kind, quality, whether a text reading was attempted and what it gave, the stored copy's facts, and the
reading that banked it. The fingerprint folds in the compiled identity of the lane and the classifier, every caption
setting, the stored shape (edges, long-picture edge, quality, decode ceiling), the reading models and prompts, the
oversize picture limit, the document language and the words beside the picture — **never a limit**, so raising one reuses
what was paid for. Trust: a SUCCESS crosses readings; a failure (no description, no text, an undecodable picture) is final
only for the reading that saw it; a forced-fresh reading trusts only its own; another reading's stored copy is confirmed
to exist first (a missing copy is stored again, the description still reused). A throttle is never banked. Fail-soft:
an unreadable entry is a miss, a failed write costs the call again.

**The space rule** (§4.3): when text + pictures exceed the business's grace ceiling but the text fits, whole pictures leave
from the smallest (by rank); their cards and album entries go, the artefact is rewritten without them and records
`PicturesLeftOutForSpace`, their stored copies are deleted after the commit (even from a run that may not retire other
assets — a picture chosen to leave is accounted for), their descriptions stay banked. "Read again" re-runs the lane
(`retryPicturesLeftOut`) and pays only the storing of the ones that now fit. Alert `KnowledgePicturesLeftOutSpaceFull`.

**The row guard**: over `Images:MaxRegistryBytes` (1,000,000) serialized, the smallest pictures leave until it fits;
`KnowledgePictureListFull`; the commit carries earlier unaccounted entries back only within that budget.

**Limits and their dedicated alerts** (warning = Low, nothing withheld; limit = Medium, the largest kept, the provider
told): pictures kept 150 / 300 (`KnowledgePicturesWarning` / `KnowledgePicturesLimit`), pictures read as text 25 / 50
(`KnowledgePictureTextWarning` / `KnowledgePictureTextLimit`, notice `Info_KnowledgePictureTextOverLimit`), plus
`KnowledgePictureListFull`, `KnowledgePicturesLeftOutSpaceFull`, `KnowledgePicturePassesExhausted`; W3's long-page alerts
became `KnowledgeLongPagesWarning` / `KnowledgeLongPageLimit` / `KnowledgeLongPagesFileLimit`. One mechanism
(`IPlatformLimitAlerts.ReportFileLimitAsync`): cooldown, de-duplication, the master switch. Admin web alert list carries
every type.

**Near-duplicates — FINAL rule** (supersedes §5's thresholds; PLAN §10 rows "TIGHTENED" and "FINAL"): shapes within 1% →
32×32 colour, every channel's mean within 2% (the approved check, now only the first filter) → the larger drawn at the
smaller's size (≤ 1,024 px) and every 4×4 block's average colour within 1% in every channel. Only pairs no eye can tell
apart merge: 11 pairs on the whole corpus (6 pictures → 2). The larger is kept and carries every placement. List and
panels: `findings/near-duplicates/`.

**Long pictures stored legibly**: a picture longer than 3:1 is stored with its short edge up to `MaxStoredEdgePixels`
and its long edge up to `LongPictureMaxStoredEdgePixels` (16,000), shrunk further only to fit WhatsApp's 5 MB (at most 3
fitting attempts). Knowledge lane only; every other picture is stored exactly as before.

**`readingProgress`**: `{ Stage Pages|Pictures, Done, Total }`, written once per pass (page continuations AND picture
passes) by its own ETag CAS loop, only forward within a stage, never on a row that has left Processing; cleared by the
commit funnel whenever the status is not Processing, by `MarkDeleting`, by the worker's re-cut, and by the API's Read
again / replace / delete. The API serves it only while the row is Processing and not stopped, `Done` clamped to `Total`.
Partner web + partner phone app show "Reading pages — n of N" / "Reading pictures — n of N" in the first place of the
row's meta line; a count they cannot use falls back to the usual words.

**The superseded rule** (§8): a follow-up (`Continuation > 0`, `PicturePass > 0` or `Attempt > 1`) on a Processing row
whose `ProcessingSince` is later than the message's epoch completes and does nothing; the worker's re-cut starts its
reading at its message's epoch. **The epoch** is `max(UpdatedAt, ProcessingSince)` of the row that starts the reading —
never earlier than the reading's own start, so a clock stepped back between the start and the save can never make a
reading's follow-ups look superseded by itself.

**Windows and allowances**: `StaleProcessingMinutes` 330 → **560** (not ~430: the picture in flight runs to the
delivery's deadline, so only the delivery bounds a pass — (1 + 8 + 8) × 30 min + back-off); `AiAttemptBudgetPerDocument`
6,000 → 7,500 (one delivery may read 100 pages AND describe and read 40 pictures). The page reading reserves time for one
pass of pictures, `min(figures, cap, PicturesPerPass)` — raising the ceiling never shortens the page reading.

**Extraction fixes found on the corpus**: a JPEG wrapped in Flate (`[/FlateDecode /DCTDecode]`) is unwrapped to its
original bytes (capped, refused when a predictor is present); an undecodable raster below the decorative floor is not a
loss; a picture that bleeds off the page is MATCHED to its figure by what the page shows (placement ∩ page box) and
stored as its own bytes. ‼️ Drawing "what the page shows" as the stored copy was tried and REVERSED after the live
MG Windsor reading: one photo placed in several clipped slices became several pictures (208, near-black slices among
them) — PLAN §10 "W4 live proof — a W4 change REVERSED".

**Tests.** Unit (Functions host): the passes, the bank and its trust rules, the space rule, the row guard, every limit's
alert, near-duplicates, the replay path's bounded top-up, the superseded rule, the reserve, the count (≈ 30 in
`KnowledgeIngestProcessorFunctionTests.PicturePasses.cs`, plus `KnowledgeImageSignatureTests`,
`KnowledgePictureDescriptionBankTests`, normalizer, extractor, queue, notices, alerts, conventions). Integration (Cosmos
emulator + Azurite, `KnowledgePicturePassesIntegrationTests`): 108 pictures in three passes, described once, published
once, the count in Cosmos between passes; a host stopping mid-pass costs only the picture in flight; a delete between
passes purges the bank and the queued pass reads nothing; a pass arriving after the purge writes nothing; a provider's
change during the count's write is kept and the count lands; a delete landing as the count is written gets no count; a
pass of an older reading does nothing and the newer reading reuses every description; ticks survive Cosmos exactly (both
clock directions); the space rule on the business's real ceiling and the index's real count, then Read again brings the
pictures back without a single description paid. Every guard sabotage-proven.
