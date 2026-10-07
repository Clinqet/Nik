# W2 — old Docnet (PDFium chromium/5445) vs new binding (bblanchon PDFium 156.0.8076): every page, pixel by pixel

Measured 2026-09-30 on the sandbox regression corpus: all 34 PDFs in `provider-knowledge` for CA NKN607 + ZEKIKT and
IN 6TCWOI + HG3QFI — **387 pages**, drawn at the reading box (1024) and the source-check box (2048). Old = today's
`DocumentPageRasterizer.RasterizePdf` (Docnet `GetImage()`, flags 0, white flatten). New = the production path
(`PdfiumDocument.Render` + `FitWithin`, flags `FPDF_ANNOT | FPDF_RENDER_LIMITEDIMAGECACHE`, form layer when present) and,
to isolate the library, the same library with flags 0 and no form layer. Harness sources were scratch-only.

## Results

| | 1024 box | 2048 box |
|---|---|---|
| pages | 387 | 387 |
| pages carrying ANY annotation or form field | **0** | **0** |
| new production vs new-without-annotations | identical on every page | identical on every page |
| pages byte-identical to Docnet | 115 | 107 |
| average mean absolute difference (0–255) | 2.33 | 2.61 |
| mean page colour (RGB) | identical to the unit on every page checked | same |
| page SIZE differs | 6 — all `e-brochure-rumion` p1–6: Docnet 1023 × 379, new **1024** × 379 | same, 2047 → **2048** |

## What the differences are (inspected, not assumed)

- **Text-only pages** (every Canada price list, resume, table, receipt, Hindi/Gujarati sheet): mean difference ≤ 0.01 —
  sub-pixel anti-aliasing at glyph edges. Zoomed side by side: identical to the eye.
- **Photo pages** (car brochures): the difference image is an EDGE MAP — flat areas identical, every edge moved by less
  than one pixel. The new PDFium places and resamples pictures on a slightly different sub-pixel grid. Fine print inside
  a photo (MG Windsor p5 dashboard) reads identically.
- **Hairline table rules** (hyryder p14, a 27-inch two-page spread drawn at 1024 — an oversize page W3 reads in
  sections): the rules are anti-aliased differently; nothing appears or disappears.
- **Size**: the float page size made `edge / h * h` land at 1023.9999…; truncation cut one row. Docnet did this on the
  six rumion pages; the first new build did it on Baleno p7. Fixed in `FitWithin` (tolerant truncation) and pinned by
  `ThePageFitsItsBox_AndTheLongEdgeLandsExactlyOnIt`.

**Conclusion:** no content, colour or legibility change on any page — sub-pixel geometry only. Pixel identity with a
2023 PDFium is not achievable by any current build; the quality proof is the fresh re-read fact comparison (FINAL-PLAN §5
item 3), run with W3.
