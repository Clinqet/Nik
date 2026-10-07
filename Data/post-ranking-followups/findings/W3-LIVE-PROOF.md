# W3 — live proof on the sandbox (2026-09-30)

Everything here was run against the real sandbox (Canada `NKN607`, `ZEKIKT`; India `6TCWOI`) through the **real
Functions composition** — the harness captures the Functions host's own `Program` at `Build()` and drives the real
upload confirmation, knowledge ingest, analytics job and knowledge search. Only the queue senders are replaced, by
in-process loops, so no message reaches the deployed (older) code. Tools: `scratchpad/proof/live` (new build),
`proof/liveold` (the master build, from `mem/mirror-old`), and the probes named per section. The evaluation tool for
ranking is kept in `tools/closest-seat-eval/`.

‼️ **The reading model.** `deploy.ps1` gives production `gpt-5.6-luna` as the page reader. The sandbox
`local.settings.{ca,in}.json` still name `gpt-6-luna`; the first runs of this proof used it by mistake. Every figure
below that depends on the reader was re-measured with the production reader set explicitly
(`Voice__Knowledge__Vision__TranscribeDeploymentName=gpt-5.6-luna`). The owner is told about the stale local file.

---

## 1. Fixes the live proof found (all in this change, each unit-tested and sabotage-proven)

| # | What went wrong on a real file | Fix | Measured |
|---|---|---|---|
| L1 | Gujarati read with invented names: Document Intelligence reads NO Gujarati, so the reader had nothing to check its names against | `Grounded` — the page's own text lines in an alphabet the machine reading lacks ride with it (never Latin) | Production reader, the 12-name band, 3 runs each: machine reading alone 4 · 9 · 0 of 12; grounded 12 · 12 · 11 |
| L2 | A page whose text layer carries PDFium's U+FFFE failed its whole reading on every attempt (`String.Normalize` throws) | Text layers declare characters only; every knowledge normalizer strips noncharacters | The A4 Hindi/Gujarati file: failing → Ready |
| L3 | A source-checked table row lost its table's shape (values one column left) | `RowShaped` keeps the row's columns; a reading with more cells is refused | Glanza re-read: every variant row keeps its feature name and four columns |
| L4 | A carried-back line joined the table above it | `Restore` writes it as its own paragraph | unit |
| L5 | Feature tables: "not available" dashes came back as available — Document Intelligence marked 14 of 124 Glanza cells with its box sign (☒), dashes included, and the reader copied the marks | The machine reading is quoted to the reader without its box marks | Real section, real size, production reader: 14 wrong cells → 5; where the marks are crisp, 0 either way |
| L6 | Ask Clinket and the receptionist did not FIND the spec rows W3 made readable (a card first by meaning never reached the fused shortlist) | The closest card in meaning keeps a seat (§3) | Cars 8 → 19 of 22 answered (Ask), 7 → 17 (phone); nothing worse anywhere |

## 2. Scanned pages — the text-size trigger (the product's own rule over the banked machine readings)

Probe `proof/scanned`: every page with no text layer, `PageTextScale` over the whole-document machine reading the
sandbox banked, beside the page-size rule.

| | India (`6TCWOI`, 20 files, 299 pages) | Canada (`NKN607`) |
|---|---|---|
| Pages with no text layer | 55 | 0 |
| Body text measured from the machine reading | 53 (the other 2: a 7-word cover and a 5-word title page — judged by size alone, as designed) | — |
| Read in sections because of their size | 47 (23-inch spreads, a 15×21-inch poster) | — |
| Read in sections because of their text size | 2 — ebella p1 (body 6.1 pt) and p20 (5.4 pt), both A4 fine print | — |
| Every other scanned page | whole, as before (e.g. the accessories brochure, body ≈ 9 pt) | — |

## 3. Ranking — the closest card keeps a seat (PLAN §10 row of 2026-09-30; answer-relevance AR-S8)

Measured through the real search on 84 questions in four sets, both paths, before (`RetrievalClosestSeats` 0 — the
shipped behaviour exactly) and after:

| Set | Ask Clinket answered | Phone answered | Questions worse |
|---|---|---|---|
| Approved NKN607 (38, three languages) | 32 → 32 | 7 → 7 | 0 — byte-identical |
| Generated price list (12) | 12 → 12 | — (not answerable by the receptionist) | 0 — byte-identical |
| Glanza / Baleno spec (22) | 8 → 19 | 7 → 17 | 0 |
| Control, six other brochures (24) | 18 → 20 | 19 → 20 | 0 |

Rejected alternatives (measured): ordering by meaning (cars 21, price list −3, NKN607 first answers −3); weighting
meaning ×3 (cars 19, price list −2); a wider shortlist alone (no gain). A question naming a code (NX-195) keeps the
fused order: a code's closest card in meaning is another code. Evidence: `findings/closest-seat/`.

## 4. The new uploads, uploaded through the product (`ZEKIKT`), production reader, fresh reads

Facts are the generator's own list (`tools/gen` → `facts.json`): a fact counts only when a card holds the service name
AND every one of its prices.

| File (built for this proof) | Read in sections | Facts |
|---|---|---|
| 12,600-px price-list screenshot (PNG) | yes | 160 / 160 |
| The same screenshot as WebP | yes | 160 / 160 |
| Tall price-list PDF (6 × 70 in) | yes | 160 / 160 |
| Word file with the long screenshot pasted in | yes (the picture) | 48 / 48 |
| Tall Hindi + Gujarati price list (PDF) | yes | 48 / 48 |
| A4 Hindi + Gujarati price list (PDF) | no (ordinary page) | 46 / 48 — one vowel sign (ઇ for ઈ) in "eyebrow", twice |

**Blank paper (L7).** The tall PDF is printed on its top 2,150 pt of 5,040 pt. Before the fix 4 of its 8 sections were
blank paper, each paying a machine reading and a reader call, and the empty readings made the page fall back to the
machine reading. After: 9 machine reads instead of 13, 5 reader calls instead of 9, 160 / 160, and the page keeps the
reading. Rule: a piece is left unread only on evidence (no text line, no picture, an ink drawing with no mark).

## 5. Regression — ordinary pages (`NKN607`, all 19 approved documents)

‼️ **A banked page reading never crosses builds, by design** — its policy carries the library's build identity
(`AdjudicationCodeIdentity`), so a changed adjudication can never replay an old decision. The plan's "old build's
readings into the new build" therefore cannot happen through the product. It was done by the book instead: the NEW
build read every document fresh (production reader) and banked its pages; the OLD build (master, a scratch mirror whose
page policy was set to the stored one — the only change, never in a repository) then read every document again,
replaying those same page readings ("0 transcribed, N from cache" on all 14 documents that have page readings).

| Result | Documents |
|---|---|
| Every card taken from the document byte-identical | **19 / 19** |
| Differences left | only prose an AI writes afresh on every read: the document's title, the overview sentence, the picture descriptions — and, on one document, one line moving between two adjacent cards because the packing budget counts the (AI-written, differently long) title in each card's header |

So for ordinary pages everything after the reading is unchanged. What changed in the READING itself for an ordinary page
is only what this programme set out to change: the reference the reader is handed (L1 — only when the page's text
layer holds an alphabet the machine did not read; L5 — the machine's box marks) and the source check's row shape (L3).
Fresh reads of the same file vary by themselves (the equipment catalogue came back as 103 and then 86 cards in two fresh
reads by the same build), which is why the regression is proved by replay, not by comparing fresh reads.

## 6. The brochures (`6TCWOI`), production reader, fresh reads

| | Before W3 | W3 (production reader) |
|---|---|---|
| Glanza (one 11-in × 166-in page) — numbers its own text layer prints (42) | 3 (7 %) | **41 (97.6 %)**, 110 passages |
| Baleno (11 pages) — numbers (37) | 31 | **37** |
| Hilux (28 scanned spreads, no text layer) — distinct numbers the cards carry | 74 | **92** (the 5 gone are the garbage of a decorative compass, "Ne6980'0€") |
| Glanza feature table — 124 tick / dash cells checked against the page | — | **118 right** (110 before L5); the 6 left are reader errors at the section's planned resolution (≈ 1.1 px per point) — at ≈ 1.7 px per point every reader reads all 124 (see decision O-2) |

Retrieval on these production cards (§3's rule, before/after on the live index): Ask Clinket 8 → 16 of 22 answered,
phone 7 → 13. No question lost a right card; on two phone questions unanswered either way, one extra passage was added —
a Glanza engine card without the torque row, and the Baleno's own brake row (it carries its document's name).

**Cost of a full reading** (paid once, then banked; Document Intelligence at ≈ $0.01 a page):

| | Machine reads | Reader calls | Source checks | ≈ total |
|---|---|---|---|---|
| Glanza | 16 | 15 ($0.03) | 4 ($0.17) | $0.36 |
| Baleno | 47 | 44 ($0.04) | 8 ($0.11) | $0.62 |
| Hilux | 85 | 95 ($0.12) | 8 ($0.12) | $1.09 |
| Tall price-list PDF | 9 | 5 | 1 | $0.11 |

## 7. Limits, alerts, notices and "raising a limit pays only for what it cut short" (`ZEKIKT`, live)

| Step | What happened |
|---|---|
| Per-page limit 3, warning at 2, fresh read | Alerts `VisionOversizeSectionsPerPage` ("needs up to 4 readings … limit of 3") and `VisionOversizeSectionsWarning` ("3 against 2"); provider notice `Info_KnowledgePageTooLongToReadFully` (page 1) |
| Per-file limit 2, fresh read | Alert `VisionOversizeSectionsPerDocument` ("4 against the limit of 2 … read the old way"); the same provider notice |
| A NEW copy uploaded with the per-page limit at 2 | 5 machine reads, 2 reader calls, notice shown |
| Limit back to default, ordinary "Read again" | 4 reader calls and 5 machine reads (the first section and the whole-file machine reading replayed from the bank — a full reading costs 9 and 5); notice cleared; 160 / 160 |
| A copy whose sections were all banked, re-read after a limited run | 0 machine reads, 0 reader calls |

## 8. Decisions for the owner (evidence above; nothing here is built)

- **O-1 — the quicker reading past the per-page cap can hold almost nothing.** When the cap cuts a page, the rest is one
  picture (the approved design). On the 4,300-pt remainder of the tall list both the machine and the reader found one
  heading, so the first pass kept 21 passages instead of 28. The notice and the admin alert fire, and raising the cap
  recovers everything paying only for the cut part (§7). The cap is 24 sections a page (Glanza needs 11), so this needs
  an extreme page. *Recommendation:* keep the design; for a page with its own text layer, give the remainder the page's
  own text as its reading instead of one squeezed picture (no extra cost).
- **O-2 — fine print inside a big-print page.** The planner sizes sections by the page's median text (Glanza: 13 pt), so
  a 7-pt feature table on it is read at ≈ 1.1 px per point: 6 of 124 cells wrong. Read at its own size, 0 wrong.
  *Recommendation:* plan each block at its own text size; it adds sections (cost) on mixed pages, so measure it on the
  387-page corpus before building.
- **O-3 — the sandbox `local.settings.{ca,in}.json` name `gpt-6-luna` as the page reader** while `deploy.ps1` gives
  production `gpt-5.6-luna`. Anyone running the Functions host locally reads pages with the model the owner ruled out.
  *Recommendation:* set `Voice__Knowledge__Vision__TranscribeDeploymentName` to `gpt-5.6-luna` there (the owner's file).
