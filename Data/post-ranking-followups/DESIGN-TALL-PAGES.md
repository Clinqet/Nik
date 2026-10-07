# DESIGN — Oversize pages (very tall, very wide, very large): read in sections, stitched back into one page

> Status: **APPROVED BY THE OWNER 2026-09-29**; **AS BUILT 2026-09-30 — see §15, which wins where it differs** (PLAN §10), as revised in session 2 (no overlap cut; sections read in parallel; stitched page banked under the page key; setup lane included; current PDFium). The build session still re-reviews it and ASKS before any deviation. Originally: no code is written until the owner
> approves this document; every "Recommendation" below is mine, not a decision.
> Evidence: `FINDINGS-OOM.md` (same folder) and the corpus scan below. Written 2026-09-29.

---

## 0. What the plan asked, and where this design disagrees

| Plan said | This design | Why |
|---|---|---|
| Trigger on aspect ratio > 2:1 | **Trigger on reading scale** (§2) | Aspect ratio misses large posters (24×36 in reads at ~28 dpi, as unreadable as the strip) and would needlessly cut slim flyers that read fine today (a 4×12 in flyer gets 97% of an A4 page's scale). What makes a page unreadable is how many pixels its text gets, and Document Intelligence's own 17 in limit. |
| Tall pages (and wide) | **Tall, wide and large pages are one mechanism** | The real corpus is dominated by WIDE pages: 8 of the 22 India brochures are two-page spreads (23–27 × 8–9 in). |
| Cut using Document Intelligence's line coordinates | **Cut using the page's own evidence** (text layer + picture boxes + an ink profile), then read each section with Document Intelligence | On an oversize page Document Intelligence's whole-page read is itself the broken thing (Glanza: 2,453 characters of noise from a page holding 10,018 letters). Its coordinates cannot place the cuts. |
| PDFium can render a clipped region; evaluate the library | **Replace Docnet with the current PDFium build** (§9 — APPROVED by the owner 2026-09-29) | Clipping is the only bounded way to render a long page, Docnet does not expose it, and Docnet's PDFium is from September 2023 — we render untrusted provider files with it. |

---

## 1. The problem, measured

| Document (India sandbox, business 6TCWOI) | Page size | Today |
|---|---|---|
| `e-brochure-glanza.pdf` | 15 × **166** in, 1 page, 10,018 letters, 51 pictures | Document Intelligence: 2,453 chars of noise. Vision: the page drawn at **92 × 1024 px**. The worker is killed (§1 of the plan). |
| `The-Stunning-New-Baleno-Brochure.pdf` | 15 × **70** in, 11 pages | Beyond Document Intelligence's limit on every page; each page drawn at ~218 × 1024 px |
| hilux, hycross, innova, rumion, hyryder, legender, combined, innova-a4 | **23–27 × 8–9 in** (two-page spreads) | Beyond Document Intelligence's limit; each half of the spread gets half a normal page's pixels (~42 dpi) |
| Brezza, accessories-glanza | 8.3 × 11.7 / 15 × 10.2 in | Reads fine today — must stay on today's path |
| Every Canada regression document | Letter / A4 | Reads fine today — must stay on today's path |

So today these documents are read badly by BOTH readers. The goal is to read them the way an ordinary page is read,
with no change at all for ordinary pages.

---

## 2. Which pages take the new path (the trigger)

A page is **oversize** when EITHER:

- **(A) an edge is longer than Document Intelligence can read** — `Voice:Knowledge:Oversize:MaxReadableEdgeInches`,
  default **17** (Microsoft's documented PDF page limit), OR
- **(B) the page would be drawn at less than a fraction of an ordinary page's scale** — fitted into the reading box
  (`Vision:PageRenderMaxEdgePixels`, 1024), its pixels-per-point is below
  `Voice:Knowledge:Oversize:MinScaleVsA4` (default **0.6**) × an A4 page's (1024 / 842 pt).

Every size in the real corpus, measured:

| Page | (A) edge | (B) scale vs A4 | Result |
|---|---|---|---|
| A4 / Letter | 11.7 / 11 in | 1.00 / 1.06 | today's path |
| Legal 8.5×14 | 14 | 0.83 | today's path |
| A3 / Tabloid 11×17 | 16.5 / 17 | 0.71 / 0.69 | today's path |
| accessories-glanza 15 × 10.2 | 15 | 0.78 | today's path |
| Brezza 8.3 × 11.7 (one page 0.78) | 11.7 | ≥ 0.78 | today's path |
| spread 23.4 × 8.3 | **23.4** | **0.50** | **sections** |
| Baleno 15 × 70.4 | **70.4** | **0.17** | **sections** |
| Glanza 15 × 166.2 | **166.2** | **0.07** | **sections** |
| poster 24 × 36 (none in corpus) | **36** | **0.33** | **sections** |

Only the ten documents that read badly today change path. Every other page — including every document in the Canada
regression set — takes exactly today's code.

---

## 3. The shape of a section

A section is a rectangle of the page that reads like an ordinary page:

- Its long edge is at most **S = clamp(page's short edge, 842 pt, 1224 pt)** — never smaller than an A4 page's long
  edge, never larger than what Document Intelligence reads at full resolution (17 in = 1224 pt).
- Tall strip (Glanza, 1080 pt wide): S = 1080 → full-width sections at most 1080 pt tall → **~12 sections**, each read
  at 0.95 px/pt (78% of A4, the same as the accessories brochure reads today).
- Spread (1685 × 598 pt): S = 842 → **2 sections**, each an A4-landscape half, each read at exactly A4 scale.
- Large poster: S = 1224 → a grid, cut in both directions (§4.3).

---

## 4. Where the cuts go — "never through anything meaningful"

### 4.1 The evidence (all free — no paid call is made to place a cut)

Built once per oversize page, in page coordinates:

1. **Text lines** from the page's own text layer (PdfPig letters → words → lines; each line keeps its box, its
   font size and its baseline). A page whose layer is invisible (a scanner's OCR overlay, P4-B-19) or empty is treated
   as having no text layer.
2. **Picture boxes** — every placed raster (PdfPig), which the image lane already reads.
3. **An ink profile** — the page rendered at low resolution **one band at a time** (clipped, so bounded memory), and
   for every pixel row (and column) the share of non-background pixels. It protects anything the text layer does not
   describe (outlined text, vector drawings, table borders): a cut must be blank in the ink profile too.
4. **A SCANNED oversize page has no text layer** (hilux and ebella have none), and pixels alone cannot tell text laid
   over a photo from the photo. For those pages only, the line boxes come from a first Document Intelligence pass over
   windows of the page (each within its 17 in limit, overlapping by one inch so every line is whole in at least one
   window; a line seen in two windows is one line — same box). Those lines then place the cuts exactly as a text layer
   would. Cost: one extra machine reading per window, on scanned oversize pages only.

### 4.2 What may never be cut (each has a test)

A cut is a straight line across the whole region being cut. It is **forbidden** when it would cross:

| Never through | How it is known |
|---|---|
| a line of text — in any script, including Hindi/Gujarati matras and conjuncts above and below the line | text-line box (glyph bounds, not the baseline) padded by `CutMarginPoints` (default 2 pt); ink profile |
| a word, a number, a price or a date (`$1,299.00`, `12/10/2026`) — or a word broken with a hyphen, or with an apostrophe (`provider's`) | they are inside a line box; a hyphenated word spans TWO lines and is handled at the stitch (§6.3) |
| a picture, or a caption and its picture | picture box, extended to the nearest line directly beneath it when that line sits within `CaptionGapPoints` |
| a table row | rows are separated by gaps inside the table; a cut between rows is allowed only as §4.4 says |
| a heading and what it introduces | a cut directly after a line whose font is ≥ `HeadingFontRatio` (1.2) × the page's body size is penalised; a cut there is taken only when nothing else is in reach |
| a list item | a list item is one or more lines; the cut goes between items (a gap), never inside one |
| superscripts, subscripts, footnote markers | they are inside the line's glyph box |

### 4.3 Choosing the cut — recursive X-Y cut

The industry-standard layout-segmentation method (recursive X-Y cut): cut the region along the long axis at the best
real gap, and recurse into any piece still longer than S.

- **Candidate gaps**: horizontal bands (vertical bands for a wide page) where no forbidden item lies and the ink profile
  is blank. Each gap has a height.
- **Score**: prefer the gap that (1) lies in the window `[0.5·S, S]` from the section's start, (2) is TALLEST (a
  paragraph or block boundary beats the space between two lines), (3) is not directly after a heading, (4) is not
  inside a table (§4.4). The first score that exists wins, in that order.
- **Columns**: when a region's lines form side-by-side columns (a vertical gap runs through the whole region), the
  region is first split into its columns, so a two-column block is read column by column — cutting it horizontally
  would interleave the columns and scramble reading order.
- **Reading order** of the resulting sections: top to bottom; within a row of columns, left to right — or **right to
  left when the page's text is right-to-left** (the existing `IsRightToLeft` share rule). A right-to-left spread is read
  right half first.
- **Rotated pages**: all geometry is in the page as displayed (after its `/Rotate`). Text lines that are not horizontal
  (a diagonal watermark) are background, not content: they never block a cut.

### 4.4 Tables

- A table that fits in one section is **never cut**: gaps inside a table are the small row gaps, so a block gap of the
  same window always wins; a table is recognised on a born-digital page by its aligned columns and rules, on a scan by
  vertical strokes crossing every gap (ink profile).
- A table taller than a section is cut **only between rows**, and the section after the cut is read with the table's
  **header row carried above it**: the header's band is drawn at the top of the next section's image, so Document
  Intelligence and the reading model both see a table with its header. The header row is the band between the table's
  top and its first row gap; if the layout gives no header row, nothing is carried.
- At the stitch the carried header is dropped and the rows are appended to the previous part — **one table, no row in
  two halves, no duplicated row** (§6.2).

### 4.5 When no block gap exists within reach — NO overlap (revised after the second review)

The first draft cut with an overlap band and de-duplicated the repeated lines at the stitch. **Rejected**: the reading
model returns text with no positions, so the de-duplication would have had to match lines by text alone, and a spec
table legitimately repeats rows ("Standard | Standard"). That is a loophole, so the overlap is gone:

1. **Text is never cut, ever.** Every cut lies on a boundary BETWEEN two text lines (a line gap), which always exists.
2. If no BLOCK gap lies in `[0.5·S, S]`, the cut moves to the nearest LINE gap in that window (a paragraph continued
   across it is re-joined at the stitch, §6.3).
3. If the only thing in the window is a picture with no text line over it (a hero photo taller than a section), the
   section may **grow to `MaxSectionGrowth` × S** (default 1.5, still read at ≥ 0.6 of A4 scale) to reach the next gap;
   only past that is the picture itself cut. Cutting a picture loses nothing: its pixels come from the file (§7), and
   its two halves are merged back into one picture (§6.5).
4. A single text line longer than a whole section cannot occur (a line is at most one line tall).

### 4.6 Caps

- `MaxSectionsPerPage` (default **24** — Glanza needs ~12) and `MaxSectionReadsPerDocument` (default **120** — the
  eight spreads need 2–56). Past `MaxSectionsPerPage`, the REST of that page is read as ONE final section scaled to fit
  the box (the quicker, less detailed reading the notice names) — never dropped. Past `MaxSectionReadsPerDocument`, the
  remaining oversize pages of that document are read the way they are read today (whole page). In both cases the
  provider is told in plain words (`Info_KnowledgePageTooLongToReadFully`, §11). Never a refusal: a document that is
  accepted today is never refused by this change.

---

## 5. Reading a section — exactly the way a page is read

Each section goes through the same machinery as a page, unchanged:

1. **Machine reading (Document Intelligence)** — the section is rendered (clipped) at `OversizeReadDpi` (default 150,
   ~2250 px across a 15 in section — inside Document Intelligence's 10,000 px image limit) and sent with
   `ExtractRawTextFromBytesAsync` (the same model and output format as the whole-document read). **Measured on Glanza's
   specification section: 98.5% of the file's own words, the whole table read cell by cell** — where the whole-page read
   of the same file returned noise. A one-page PDF cropped to the section gave the IDENTICAL reading (Document
   Intelligence reads the pixels either way), so the picture is sent. The file's exact characters keep their authority
   through the existing rule: the section's own text layer is the `TrustedTextLayer` that decides a disputed value. Its markdown is the
   section's machine reading, its figures and evidence are the section's. Banked under the document's own
   `_di/{docId}/` prefix, per (content hash, page, section geometry, model), so a continuation, a retry and a Read again
   never pay twice, and the purger already sweeps it.
2. **Reading model** — the section rendered (clipped) into the 1024 box, with the section's machine reading quoted
   exactly as a page's is (same prompt, same conservation re-ask, same adjudication).
3. **Source check** — the section re-rendered (clipped) into the 2048 box, same rules, same per-document ceiling
   (`MaxVerifiedPagesPerDocument` counts a checked section as one check).
4. **Banked** — each section's accepted reading is banked in the page cache under a section key
   (`…/p{page}-s{index}-{geometry}`), exactly as a page is. A crash, a timeout or a continuation re-reads only the
   sections not yet banked (§8).
5. **The stitched page is banked too**, under the page's ORDINARY key (`…/p{page}.json`), with the section rules folded
   into its policy. Two readers depend on it: the next reading replays the whole page from it in one read, and the API's
   page viewer (`BusinessSearchDocumentService`, Ask Clinket's "view the page") reads a page by its number and would
   otherwise find nothing for a sectioned page.

**Sections of one page are read IN PARALLEL (owner-approved 2026-09-29, superseding "in order").** Every section is read
at once; when a section's machine reading shows a table touching its bottom edge (the cut fell between table rows), the
NEXT section is read once more with that table's header band drawn above it, and that second reading replaces the first.
Same result as reading in order, far faster — which also lets provider setup (its own 5-minute budget,
`AIAssistant:ProviderAttachmentProcessing:Vision:TimeBudgetSeconds` 300) read a long page properly; whatever setup still
cannot finish keeps today's reading, and the provider is told. Pages still read in parallel as today, all under the
AI governor's bulk concurrency and the heavy-work gate for rendering.

---

## 6. Stitching — one page, exactly as if it had been read whole

The stitched text replaces that page's entry in the page list, so the parser, chunker, headings, picture anchors,
citations and cards see ONE page with the document's own page number. A section is never a page to anyone downstream.

1. **Block boundary** (the cut was in a block gap): the sections are joined with a blank line.
2. **Table continued across the cut**: the next section's first table, whose header row equals the carried header, loses
   that header and its rows are appended to the previous section's last table. If the column counts differ, the two
   are kept as separate tables with their headers (never a wrong merge).
3. **Paragraph continued across the cut** (the cut was forced into a line gap): the last paragraph of the section and the
   first paragraph of the next are joined into one, with the rendered-page de-hyphenation rule already used for PDF
   pages (`KnowledgeText.DehyphenateRenderedPage`), so `provi-` + `der's` becomes `provider's` and sentence order is kept.
4. (There is no overlap to de-duplicate — §4.5.)
5. **Figures**: every figure the section reads report is moved into page coordinates. A picture a cut crossed is
   reported as two halves, one touching each side of the cut with overlapping columns — they are merged into ONE figure
   (the union of the two boxes), so it matches its original picture in the file and is pinned once, in the section
   holding most of its area.

---

## 7. Pictures on an oversize page

The image lane pairs Document Intelligence figures with the file's own rasters (`KnowledgeImageExtractor`). For an
oversize page:

- The page's figures are the stitched section figures (in page inches), replacing that page's figures from the
  whole-document read. Page sizes stay the page's own.
- The pictures themselves still come from the FILE (PdfPig natives), so a cut never splits a picture.
- A figure with no native raster used to download Document Intelligence's crop (whose result expires in 24 h). For a
  section figure the crop is **rendered by us** from the page (clipped, at `MaxStoredEdgePixels`), which never expires.
- Pinning (`AnchorIntoBlocks`) and grounding are unchanged: the figure's position in the stitched page is its position.

---

## 8. Continuation, retries, time and cost accounting

- **Unit of work**: a section is a unit of vision work, exactly like a page. The pass's time budget, the per-document AI
  attempt budget, the per-document source-check ceiling and the continuation's "did this pass bank anything new" rule
  count banked UNITS (pages + sections), so a pass that banked three sections of a long page is progress.
- **Transient failure of one section**: that section is retried on the scheduled retry like a page (P4-B-21); the other
  sections stay banked.
- **Crash mid-page**: banked sections are never repaid.
- **Read again / replacement**: the section banks are keyed by content hash and reading epoch like pages (P4-B-27).

**Cost of a sectioned page** (billed units):

| Document | Today | With sections |
|---|---|---|
| Glanza (1 page) | 1 DI page + 1 reading call | 1 DI page (whole-document read, unchanged) + ~12 DI section reads + ~12 reading calls |
| Baleno (11 pages) | 11 + 11 | 11 + ~55 + ~55 |
| a spread brochure (N pages) | N + N | N + 2N + 2N |
| any ordinary page | unchanged | unchanged |

At Azure's list price for the layout model ($10 per 1,000 pages — please confirm against your agreement) a section's
machine reading costs ~$0.01; the reading call costs what one page's reading costs today.

---

## 9. Rendering — library decision (APPROVED 2026-09-29: option A)

Every section render must be CLIPPED (render only that rectangle): a whole long page rendered at reading scale grows
without bound (Glanza at 2048 px wide = a 177 MB bitmap, 571 MB peak), while clipped sections peak at **≤ 95 MB** at
Document Intelligence resolution, measured on current PDFium.

| Option | Clipped render | PDFium build | Change |
|---|---|---|---|
| **A. Recommended**: replace Docnet.Core with `bblanchon.PDFium.Linux` + `.Win32` 156.x (the standard up-to-date PDFium builds, Apache-2.0/BSD) and a small in-house binding (~20 calls, one process-wide lock) | yes | **current** (chromium/8076) | `DocumentPageRasterizer` only (Docnet has no other user); its tests |
| B. Keep Docnet 2.6.0 and call its internal clipped render through reflection | yes | September 2023 (chromium/5445) | a workaround — rejected |
| C. Keep Docnet and render the whole page at reading scale, then crop | no | September 2023 | unbounded memory on long pages — rejected |

Option A also closes a security gap independent of this feature: we parse untrusted provider PDFs with a PDFium that is
~2,600 builds behind. Its effect on ordinary pages is proved in §12 (byte-identical cards from banked readings; the same
reading on a fresh read).

---

## 10. Settings (appsettings + matching class defaults, Functions host; no local.settings.json key, so no ARM change)

`Voice:Knowledge:Oversize:` `MaxReadableEdgeInches` 17 · `MinScaleVsA4` 0.6 · `MaxSectionGrowth` 1.5 ·
`CutMarginPoints` 2 · `CaptionGapPoints` 18 · `HeadingFontRatio` 1.2 · `MaxSectionsPerPage` 24 ·
`MaxSectionReadsPerDocument` 120 · `ReadDpi` 150 · `InkProfileDpi` 24.

The section rules are part of the page-cache policy fingerprint, so changing any of them re-reads only sectioned pages.

---

## 11. What the provider sees (plain words, 5 languages, web + both mobile apps)

Nothing new on success — the page simply reads. One new notice, only when a cap stopped a page being read in full:

- `Info_KnowledgePageTooLongToReadFully` — the APPROVED wording is the sheet `knowledge-reading-progress` state G:
  "Page {0} is very long, so we read the first part of it in full and the rest more quickly. Splitting the file into
  shorter pages will let us read all of it closely." (approved 2026-09-29; five server catalogues).
- A reading that stops for good (the dead-letter handler) keeps the existing `Error_KnowledgeGenericRetry` (state H).

No technical word (section, tile, render, crop) appears anywhere a provider reads.

---

## 12. No-degradation proof (before any commit)

1. **Ordinary pages are untouched** — proved three ways, on a regression set: every document in the CA sandbox
   (NKN607 + ZEKIKT) and every India document below the trigger (Brezza, accessories, Camry, LC-300, Vellfire, taisor,
   pharma ×2, LIC, SBI, MG Windsor):
   - **Same code path**: the trigger answers "no" for every page of every one of them (a test pins it on the real files).
   - **Same inputs → byte-identical cards**: the page cache's policy includes the compiled identity of the code that
     adjudicates (`PageCachePolicy`), so ANY infrastructure change makes every banked page a miss on its next re-read —
     that is today's rule and it stays. The proof therefore feeds the OLD build's banked page readings and Document
     Intelligence reads into the NEW build's extraction (a harness that reads the entries regardless of policy) and
     requires byte-identical cards against the OLD build's cards. That proves the new code transforms identical inputs
     identically.
   - **Fresh re-read**: three of them (a text PDF, a picture-heavy brochure, the Hindi/Gujarati sheet) are read again
     from scratch by the new build and every price, name, date and table row is compared value by value with the old
     cards — never by text similarity, because a model call is not deterministic even on identical pixels.
2. **Oversize pages get better, never worse**: for Glanza, Baleno and two spreads, every price, model name and table row
   in the source (text layer as the ground truth) is checked present in the cards before and after, and the retrieval
   check (the right value on the top card) is run in Ask Clinket and the receptionist path.
3. **Real uploads through the product** on a sandbox business: Glanza, Baleno, one spread, a long infographic, a tall
   menu, a tall price table, a Hindi and a Gujarati tall page (the last five built for the purpose), each watched to
   Ready, each asked in Ask Clinket and the receptionist path.
4. **Memory**: every render peak measured under the dev instance shape.
5. **The library upgrade touches every page's pixels**, so it is proved on its own: every page of every regression
   document rendered by the old and the new PDFium, the pixel difference measured page by page (a page whose text
   renders differently is investigated before anything ships), plus the fresh re-read fact comparison of item 1.
6. **Provider setup** (the API host's "set up from a document") uses the same reader, so it gets the same sections —
   APPROVED by the owner 2026-09-29 (with sections read in parallel so its 5-minute budget suffices, §5).

## 13. Tests

- **Unit (Functions host, §0.18)**: cut placement on synthetic layouts, one per row of §4.2 and §4.4 — a line, a
  hyphenated word, an apostrophe, a price, a date, a picture, a caption under its picture, a heading + paragraph, a list,
  a table that fits, a table taller than a section (header carried, no row split, no duplicate), two columns (reading
  order), a right-to-left spread, a rotated page, a watermark, a scan with no text layer, no block gap in reach (the
  line-gap cut, the 1.5× growth, a picture with no text cut and merged back), the caps, the parallel read with the table
  header re-read. Stitching: every §6 rule, including a paragraph across a cut and a table continued across a cut.
- **Integration (real engines)**: the section banks (Azurite) — a crash after k of n sections re-reads only n−k; a Read
  again of unchanged bytes replays; the purger removes section banks.
- **Rasterizer**: clipped render = bounded memory (measured in the test on a synthetic 100-picture page); the rotated
  page; the invisible text layer rule; the encrypted file.
- **Live**: §12.3.

## 14. Edge cases and their answers (beyond §4.2)

| Case | Answer |
|---|---|
| Scanned oversize page (no text layer) | line boxes from windowed Document Intelligence reads (§4.1 item 4) + the ink profile; cuts between lines exactly as on a born-digital page (never an overlap — §4.5); Document Intelligence reads each section's pixels |
| Page Document Intelligence refused or read partially | irrelevant for oversize pages: their machine reading is the section reads; an ordinary page keeps today's path |
| A tall page inside an ordinary document | only that page is sectioned |
| Extremely long strip | `MaxSectionsPerPage`, then the notice (§11) |
| A section that fails transiently | retried alone on the scheduled retry |
| Crash mid-page | banked sections are never repaid |
| Very wide AND very tall (poster) | X-Y cut in both directions |
| Repeated header/footer on a tall page | it is part of the page once; nothing repeats |
| Text laid over a picture | inside the picture box, which is never cut |
| Background text / watermark | non-horizontal lines never block a cut; a horizontal one is ordinary text |
| Hindi, Gujarati and every supported script | line boxes are glyph bounds (matras included); cut margin applies |
| Encrypted / corrupt oversize page | today's refusal paths are unchanged |
| Rotated page (/Rotate 90/270) | all geometry in the displayed frame |
| Section count changes after a settings change | geometry is part of the bank key, so only that page re-reads |

---

## 15. As built (2026-09-30) — what the build changed, and why

Every change below was ruled by the owner in `PLAN.md` §10 (rows dated 2026-09-30) or is a correction the build found
and recorded there. Where this section and §0–§14 differ, **this section is what the code does**.

### 15.1 Which pages take the new path

| Design said | As built |
|---|---|
| (A) an edge over 17 in | (A) a PDF edge over `MaxReadableEdgeInches` (17 in), **or a picture edge over `MaxPictureEdgePixels` (10,000 px)** — Document Intelligence's own picture limit. |
| (B) the page's scale vs A4 in the reading box | (B) **the text-size rule** (owner: "all the document types"): a page is planned as if its body text were `ReferenceBodyTextPoints` (11 pt). Body text = the character-weighted median height of confident words (confidence ≥ `TextSizeMinWordConfidence` 0.8, ≥ 2 letters or digits, ≥ `TextSizeMinCharacters` 40 characters in all), converted by **1.14 word-box heights per font point — measured on 6,247 words of the corpus**. Scale k = 11 / body; a PDF uses max(1, k) (never shrunk below its own size), a picture uses k. The page is oversize when that frame's long edge, fitted into the 1,024 px reading box, gives less than `MinScaleVsA4` (0.6) × an A4 page's scale. A picture whose text cannot be measured is judged by (A) alone. |
| PDF pages | **Every document type and lane**: PDF pages, TIFF frames, single pictures (PNG, JPEG, BMP), WebP and GIF (converted at their OWN size, never the stored size), pictures of text inside Word / Excel / PowerPoint / web files (the knowledge ingest AND the analytics rebuild, through one shared `KnowledgePictureText`), and provider setup (API host). |

Measured on the corpus (387 pages): the text-size rule adds 30 fine-print pages and changes **no** Canada text-layer
page's path.

### 15.2 A picture too big for the whole-document reading

Document Intelligence refuses a picture over 10,000 px WHOLE, which used to fail the document as unreadable. It is no
longer asked: `MachineReadingSource.WholeReadingSkipped` tells the reader, every page of the picture is read through
sections (each with a machine reading of its own), and a page that turns out not to be oversize is read through ONE
whole-page section so it still has a machine reading beside it.

### 15.3 Where readings are banked

| What | Blob (container of the lane) |
|---|---|
| A section's reading | `_ocr/{biz}/{doc}/{hash}/{deployment}/v{prompt}/p{page}-s{geometryKey}.json` |
| Document Intelligence's reading of a window or section | `_ocr/{biz}/{doc}/{hash}/_regions/{model}-{format}/p{page}-{geometryKey}.json` |
| The stitched page | the page's ORDINARY key `…/v{prompt}/p{page}.json`, with an `oversize` block (sections planned, read in sections, read in part, figures, reviews) |

- `geometryKey` = the first 20 hex characters of a SHA-256 over the exact picture composed (page, parts, size, scale,
  text flag), so the same picture is the same key wherever it falls in a plan — the design's section index is gone.
- The machine readings moved from the design's `_di/{docId}/` to `_ocr/…/_regions/`: inside the document's `_ocr/`
  prefix, so the purger, the business-closure teardown and the storage lifecycle rule sweep them with the page readings,
  and shared by every reading model and prompt version (they depend only on the bytes and the machine model).
- The stitched page's policy is the page policy plus a hash of the oversize settings **minus the three cost limits**,
  so changing a cut rule re-reads only sectioned pages, and raising a limit does not re-read what was already read.

### 15.4 Limits (owner: two levels, each with its own admin alert)

| Setting | Default | Past it |
|---|---|---|
| `MaxSectionsPerPage` | 24 | the rest of that page is read as ONE condensed picture; the provider is told; admin alert `VisionOversizeSectionsPerPage` (with how many readings the page needs) |
| `SectionReadsAlertPerDocument` | 200 | admin alert `VisionOversizeSectionsWarning` — nothing is withheld |
| `MaxSectionReadsPerDocument` | 400 (design: 120) | the remaining oversize pages are read the old way; the provider is told; admin alert `VisionOversizeSectionsPerDocument` |

All three alerts are `ProviderContentLimitReached` alerts named by their limit (the platform's one mechanism for every
cap: its own title, its own 15-minute de-duplication key per business and document). The provider sentence:
`Info_KnowledgePageTooLongToReadFully` (one page, its number) or `Info_KnowledgePagesTooLongToReadFully` (several, the
count) — five server catalogues; the chat of provider setup appends the same sentence.

**Raising a limit pays only for what it cut short.** A cut-short page is re-planned on every reading (its sections are
banked individually, so only new sections cost anything); the knowledge ingest re-extracts once when its banked
artefact lists read-in-part pages and either limit has been raised since (`SectionsPerPageAtBanking`,
`SectionReadsPerDocumentAtBanking`); everything already read replays from its bank.

### 15.5 Progress and continuation

`ReadingsBanked` (pages + sections) is the continuation's progress measure; `PagesBanked` against the page count stays
the completion measure. The queue message carries `ReadingsBankedSoFar`. A one-page file read in three sections is
progress, never "3 of 1 pages".

### 15.6 Tables across a cut

The planner keeps a table whole whenever it can be read whole at the quality floor, and otherwise cuts between rows
(or columns) carrying the header row (or row names). As a safety net, a table found touching the bottom of section i and
the top of section i+1 makes section i+1 be read again with the header drawn above it. The stitcher splices raw rows
(colspans and cell markup intact) ONLY when the labels match; otherwise both tables keep their own headers, so no row
ever loses its labels.

### 15.7 Pictures on a sectioned page and long pictures

- A stitched page's figures (inches, `CropFromPage`) replace that page's Document Intelligence figures before the
  picture binder runs (`SectionedPageFigures.Apply`, knowledge ingest and provider setup); such a figure's picture is cut
  from the page by our own renderer at `Images:MaxStoredEdgePixels` and never expires.
- A long picture is no longer dropped as a "divider": `KnowledgeImagePolicy` keeps a picture past `Images:MaxAspectRatio`
  when its short edge is at least `Images:LongPictureMinShortEdgePixels` (480). Its description is made from the leading
  part (`Images:CaptionMaxAspectRatio` 3) of the provider's own pixels, not a shrunk sliver.
- Provider setup does the same with its own dial (`AIAssistant:ProviderAttachmentProcessing:Images:CaptionMaxAspectRatio` 3):
  described from a sliver, a screenshot of prices could be placed on a service as its photo.
- The describer decodes the FIRST frame only (as the normalizer keeps): now that it may receive the provider's own
  bytes, an animated picture decoded whole would hold every frame at full size at once.
- The stored copy of a long picture (album, sending) is fixed in W4 (owner ruling 2026-09-30).

### 15.8 Final settings (`Voice:Knowledge:Oversize:`, both hosts that read them)

`MaxReadableEdgeInches` 17 · `MaxPictureEdgePixels` 10000 · `MinScaleVsA4` 0.6 · `ReferenceBodyTextPoints` 11 ·
`TextSizeMinCharacters` 40 · `TextSizeMinWordConfidence` 0.8 · `MaxSectionGrowth` 1.5 · `CutMarginPoints` 2 ·
`CutMarginFontShare` 0.2 · `CaptionGapPoints` 18 · `HeadingFontRatio` 1.2 · `MaxSectionsPerPage` 24 ·
`MaxSectionReadsPerDocument` 400 · `SectionReadsAlertPerDocument` 200 · `ReadDpi` 150 · `InkProfileDpi` 24 ·
`InkEdgeContrast` 32 · `ScanWindowOverlapInches` 1 · `MinColumnGutterPoints` 14. Plus `Voice:Knowledge:Images:`
`LongPictureMinShortEdgePixels` 480 · `CaptionMaxAspectRatio` 3, and `AIAssistant:ProviderAttachmentProcessing:Images:CaptionMaxAspectRatio` 3 (API). All appsettings with matching class defaults; none is a
`local.settings.json` key, so no ARM or `deploy.ps1` change.

### 15.9 Tests (as built)

Unit (Functions host): text-size measurement, planner (17), stitcher, contracts, the reader (6), the reading service end
to end (8), the ingest (continuation by readings, re-read on a raised limit, figures before binding, pictures over the
limit, WebP at its own size), the analytics rebuild's pictures of text (7). Unit (API host): provider setup (`.tif`,
pictures over the limit, WebP at its own size, read-in-part pages) and the chat sentence. Integration (Azurite): every
section and machine reading banked in real blobs and a re-read paying nothing; a reading stopped part way paying only
for the rest; a raised file limit reading only the page it cut short; the purger removing section and machine-reading
blobs. Every behaviour test was proved by sabotage (the old behaviour put back ⇒ the test fails).

### 15.10 Reading fixes found by the live proof (2026-09-30, `findings/W3-LIVE-PROOF.md`)

Not oversize-specific: each sits on the reading every page shares, and each was found on a real sandbox file.

| What went wrong | Fix |
|---|---|
| **Gujarati read with invented names.** Document Intelligence reads no Gujarati at all (0 characters, PDF or picture), so the reader had nothing to check its names against: 12/24 right on an A4 page, 6/24 in sections. | `Grounded`: the page's OWN text-layer lines written in an alphabet the machine reading lacks ride with the machine reading. Never Latin (a legacy font's letters, P4-B-19); what decides a disputed value is unchanged. Measured again with the production reader (gpt-5.6-luna): the 12-name band read 4, 9 and 0 of 12 without it and 12, 12 and 11 with it; the tall file 48/48 and the A4 file 46/48 (one vowel sign, ઇ for ઈ). |
| **A page whose text layer carries U+FFFE** (PDFium's mark for a conjunct it cannot map) failed its whole reading on every attempt: `String.Normalize` refuses it, the error is retryable, the row stayed Processing. | Every text layer declares characters only (`PdfiumDocument.Declared` → `KnowledgeText.Characters`), and every knowledge normalizer (`KnowledgeText`, `DocumentValueEquivalence`, the chunker) strips noncharacters and broken surrogates instead of throwing. |
| **A source-checked table row lost its table's shape**: the checker's reading left out the section label the page repeats down its rows, and the whole row was written in its place — three Glanza rows had every value one column left. | `RowShaped`: a substituted row keeps the table's columns (the reading's cells placed where they best match the row's own). A reading with MORE cells than the row is refused and takes the existing refusal rung. |
| **A line carried back into the reading joined the table above it** (appended on the next line, a line with pipes is that table's row). | `Restore` writes each carried-back line as its own paragraph. |
| **A feature table's "not available" dashes read as available.** Document Intelligence writes ☒ for any small mark it takes for a box — on the Glanza table it marked 14 of 124 cells wrong, dashes included — and the reader, handed that reading, copied the marks over the page's own ticks and dashes (the section was an enlarged one read in the large box; where the marks are crisp every reader ignores the machine's marks). | The machine reading is quoted to the reader without its box marks (`WithoutBoxMarks`): the reader judges every mark from the picture. Measured on the real section at its real size with the production reader: 14 wrong cells → 5. The comparison, the source check and every other use of the machine reading are unchanged. |

**The reading model in the live proof.** `deploy.ps1` gives the Functions app `gpt-5.6-luna` as the reader (owner, 2026-09-25). The sandbox
`local.settings.{ca,in}.json` still name `gpt-6-luna`, so the first proof runs used the wrong reader; every figure in
`findings/W3-LIVE-PROOF.md` is from runs with the production reader set explicitly.

**Blank paper is not read** (found on the generated tall price list: 4 of its 8 planned sections were blank paper). A
planned piece is left unread only on evidence — no text line, no picture, and an ink drawing that was made and shows
no mark. Without an ink drawing nothing is known to be blank, and the page is read whole as before.
