# §1 — Why the knowledge worker is killed (exit 137): measured, 2026-09-29

Harness: the REAL `DocumentPageRasterizer`, `LayoutFigureCaptions`, `KnowledgeDocumentParser`, `KnowledgeImageExtractor`
and `KnowledgeImageNormalizer` (mirrored copies of today's HEAD) run step by step on the exact file
(`e-brochure-glanza.pdf`, 6,633,201 bytes) and its banked Document Intelligence read, sampling private bytes,
working set and managed heap every 20 ms. Windows, then Linux (`mcr.microsoft.com/dotnet/aspnet:10.0`, 1 CPU,
hard memory limits 2 GB and 512 MB). Harness and data live in the session scratchpad only.

## 1. The instance is 512 MB, not 2 GB

`azureautomation/deploy.ps1:924` — `$FUNCTION_INSTANCE_MEMORY_MB = if ($Environment -eq "prod") { 2048 } else { 512 }`.
The India app that was killed is **dev**, so its instances are **512 MB**. `functions.json`'s 2048 is only the template
default; deploy.ps1 passes 512 for every non-prod environment (lines 4567, 5737). **Decided 2026-09-29: dev moves to
2048 MB** (PLAN §10, FINAL-PLAN W1); the kill itself is confirmed by the owner's workspace query (exit code 137).

## 2. One render of this page takes ~400 MB of native memory

| Step (Linux, 1 CPU) | Private bytes peak | Managed heap | Time |
|---|---|---|---|
| file + banked read + figure captions | 113 MB | 9 MB | 0.4 s |
| **render page 1 for the reading model (1024 box)** | **551 MB** | 41 MB | 2.2–6.6 s |
| render page 1 for the source check (2048 box) | 589 MB | 60 MB | 1.1 s |
| parse | 225 MB | 39 MB | 0.1 s |
| bind pictures (51 found, 5.7 MB of source bytes) | 228 MB | 58 MB | 0.4 s |
| picture lane (decode + normalize + caption downscale, one at a time) | 287 MB | 47 MB | 4.3 s |

- The page is 1080 × 11,966 pt; drawn into a 1024 box it becomes **92 × 1024 px**, yet PDFium decodes every one of
  its 51 embedded pictures (up to 2759 × 2069) at full size to draw it. That is **native** memory — the managed heap
  never passes 60 MB.
- The worker in the cloud carries far more than this harness (every client, cache and queue processor), and the
  Functions host shares the same instance. **On a 512 MB instance one render of this page is enough.** No concurrency
  is needed to explain the kill.
- The kill window matches: "bank read → 11–20 s of silence → exit 137", before any model call. Rendering is the only
  step in that window, and it took 6.6 s here on an idle CPU.

## 3. Renders from different documents stack

Same file, N copies rendering at once, 2 GB limit:

| Copies | Peak private |
|---|---|
| 1 | 589 MB |
| 2 | 1,009 MB |
| 4 | 1,375 MB |
| 8 | 1,775 MB |

Docnet serialises each PDFium CALL, not each document, so two documents' renders overlap in memory. The native
memory is also not fully returned afterwards (private bytes stay ~100–300 MB above the start).

## 4. Every page is rendered even when its reading is already banked

`VisionDocumentTranscriptionService.TranscribeWithVisionAsync` calls `RasterizeAsync` for EVERY page first and only
then checks the page cache. So a continuation pass, a "Read again" of an unchanged file, and the analytics job's
`RederiveBlocksAsync` fallback re-render every page of a 46-page brochure although every page is banked. This is
how the MG Windsor analytics pass was rendering at the moment of the kill.

## 5. Document Intelligence cannot read this page either

The banked read is 2,453 characters, most of it noise ("wheedthe IS HERE", "INJOY THE SIMPET", "CERIES ENGINE",
112 "lines" of which ~90 are stray dashes), 13 figures. The page's own text layer holds **10,018 letters**. The page
is 15 × 166 in; Document Intelligence's documented PDF page limit is 17 × 17 in. Today the file reads as almost nothing
by BOTH readers — §3 (tall pages) has to give the machine reading a new source too, not only the vision render.

## 6. What PDFium lets us control (Docnet.Core 2.6.0)

| Render (Linux, 1 CPU) | Peak Δ private | Pixels |
|---|---|---|
| today: `GetImage()` 1024 box | 393 MB | sha `35C3…6E52` |
| **`GetImage(RenderFlags.LimitImageCacheSize)`** 1024 box | **167 MB** | **identical** |
| today 2048 box | 403 MB | sha `BDF4…AAEF` |
| `LimitImageCacheSize` 2048 box | 170 MB | **identical** |
| whole strip at 1024 px wide + flag | 264 MB (44 MB bitmap) | — |
| whole strip at 2048 px wide + flag | 571 MB (177 MB bitmap) | — |

- The flag halves the render peak with byte-identical output (to be re-proved on the sandbox regression corpus).
- Rendering a whole tall strip at reading scale is itself unbounded (the bitmap grows with the page). Only a
  CLIPPED render (one section at a time) is bounded. Docnet 2.6 exposes no clipped render publicly; its internal
  bindings carry `FPDF_RenderPageBitmapWithMatrix` and a global `DocLib.Lock`, both internal — using them would be
  a workaround. **Decided 2026-09-29: replace Docnet with bblanchon.PDFium** (PLAN §10, FINAL-PLAN W2).
- Docnet is the ONLY PDFium user in the codebase (`DocumentPageRasterizer.cs` + its tests), so a library change is
  contained to one class.
