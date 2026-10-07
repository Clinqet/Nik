# Knowledge Extraction, Images, Passage Creation, Indexing, and Retrieval Audit

**Audit date:** 2026-09-03  
**Audit type:** Fresh static source-code review of the current implementation  
**Execution constraint:** No tests, builds, uploads, or workflow executions were run, per owner direction  
**Website scope:** URL/sitemap crawling is excluded. Uploaded `.html` / `.htm` files remain in scope because they are accepted document formats.  
**Relationship to the earlier report:** This is a new, deeper report focused on extraction fidelity, image handling, passage formation, index publication, and downstream retrieval/send behavior. It does not replace `AUDIT-FINDINGS.md`.

## 1. Executive verdict

The current pipeline is substantially stronger than a typical upload-and-chunk implementation. It has format-specific parsing, PDF native-text plus Document Intelligence fallback, Office image extraction, image normalization and metadata stripping, caption generation, deterministic passage IDs, hybrid/vector-ready search cards, tenant-scoped retrieval, material-reference validation, and artifact recovery paths.

It is **not yet solid enough for the product promise “all data and all images from any supported file are preserved correctly and remain safely grounded when saved to the knowledge index.”** Static review found:

- **2 critical design defects** in generation isolation and material-reference stability.
- **4 additional critical/high-risk defects** involving aggregate image memory, lossy vision replacement, AI-caption grounding, and stale extraction/caption lineage.
- **14 high-impact fidelity defects** affecting two-column documents, page provenance, figure placement, image selection, image-to-record linkage, reused images, multi-region worksheets, merged section rows, resumes, charts/diagrams, and caption size.
- **14 medium/declared limitations** that prevent a literal “any file / all images / all data” guarantee.

The two most urgent conclusions are:

1. **A reprocessed document can be visible as a mixture of old and new passages while indexing is in progress.** The current `Processing` row remains retrievable and deterministic ordinal IDs are overwritten batch by batch.
2. **An already-issued text material reference is not immutable.** If the document is re-chunked, the same reference can later resolve to different text.

These are not parser-quality edge cases; they are consistency defects in the product’s “brain.” They should be addressed before claiming atomic, trustworthy knowledge replacement.

No static review can prove that no bugs remain. The correct bar is: resolve the source-confirmed defects below, establish a loss-measuring golden corpus, and then prove every supported-format contract end to end.

## 2. Exact source baseline reviewed

The review used the current files in these repositories at the following commits:

| Repository | Reviewed commit |
|---|---|
| `C:\Nik\clinqetfuncations` | `ff60f8f7f18c` |
| `C:\Nik\clinqetinfrastructure` | `d8898557997b` |
| `C:\Nik\clinqetcore` | `753e2f86a327` |
| `C:\Nik\clinqetshared` | `7fca5bec1aa5` |
| `C:\Nik\clinqetmcp` | `a51e01774145` |
| `C:\Nik\cosmosindexsetup` | `caf3aa5b8289` |

The relevant current-source files were reviewed directly. Unrelated working-tree changes were not treated as pipeline behavior and were not modified.

Primary source paths:

- `C:\Nik\clinqetinfrastructure\Services\Knowledge\KnowledgeDocumentParser.cs`
- `C:\Nik\clinqetinfrastructure\Services\Knowledge\KnowledgeDocumentParser.OpenXml.cs`
- `C:\Nik\clinqetinfrastructure\Services\Knowledge\KnowledgeDocumentParser.Pptx.cs`
- `C:\Nik\clinqetinfrastructure\Services\Knowledge\KnowledgeOoxmlText.cs`
- `C:\Nik\clinqetinfrastructure\Services\Knowledge\KnowledgeImageExtractor.cs`
- `C:\Nik\clinqetinfrastructure\Services\Knowledge\KnowledgeImageNormalizer.cs`
- `C:\Nik\clinqetinfrastructure\Services\Knowledge\KnowledgeImageStore.cs`
- `C:\Nik\clinqetfuncations\Clinqet.Communications\Services\KnowledgeImageCaptionClassifier.cs`
- `C:\Nik\clinqetfuncations\Clinqet.Communications\Services\VisionDocumentTranscriptionService.cs`
- `C:\Nik\clinqetfuncations\Clinqet.Communications\Services\PageMarkdownSplicer.cs`
- `C:\Nik\clinqetinfrastructure\Services\Knowledge\KnowledgeChunker.cs`
- `C:\Nik\clinqetinfrastructure\Services\Knowledge\KnowledgeInventoryBuilder.cs`
- `C:\Nik\clinqetfuncations\Clinqet.Communications\Functions\KnowledgeIngestProcessorFunction.cs`
- `C:\Nik\clinqetinfrastructure\Services\Knowledge\KnowledgeSearchIndexer.cs`
- `C:\Nik\clinqetinfrastructure\Services\Knowledge\ProviderKnowledgeSearchService.cs`
- `C:\Nik\clinqetinfrastructure\Services\BusinessSearch\Tools\SearchKnowledgeTool.cs`
- `C:\Nik\clinqetmcp\Clinqet.Mcp\Tools\KnowledgeTools.cs`
- `C:\Nik\cosmosindexsetup\Program.cs`

## 3. End-to-end flow reviewed

| Stage | Current behavior | Principal risk found |
|---|---|---|
| Admission | Extension/content-type policy, declared-size checks, blob workflow | Supported-format scope is narrower than “any file”; aggregate OOXML expansion is not bounded |
| Extraction | Native parser per format; PDF native text + Document Intelligence; optional vision transcription | Vision can replace valid OCR with incomplete nonempty output; complex layout remains heuristic |
| Image discovery | PDF native rasters/DI figures; Office embedded pictures; standalone raster; remote images in uploaded HTML | Placement dedupe loses repeated contexts; linked/vector/animated/full-page cases are incomplete |
| Image safety | Decode ceilings, normalization, resizing, metadata removal, content hashing | Cap is selected before validation and by compressed byte size; near-duplicates are not deduplicated |
| Structure | Headings, paragraphs, lists, preformatted text, tables, image markers | Excel regions and OOXML merged section rows are flattened incorrectly in important cases |
| Passage creation | Heading context, sentence splitting, table-row serialization, overlap, dedupe | Page span is reduced to one page; section context can be lost by dedupe; some generated cards exceed limits |
| Inventory/summary | Deterministic structural inventory plus model-written description | Table groups can merge across unrelated sections; counts mix unlike content types |
| Indexing | Batch embeddings and deterministic search document IDs | No generation-level atomic publication; live readers can observe mixed old/new content |
| Retrieval | Tenant/doc allow-list, hybrid/vector search, trim-to-budget | References identify mutable ordinal positions, not immutable content generations |
| Material send | Re-resolves refs, registry checks images, sends only authorized artifacts | Text ref can resolve to changed content; Business Search may expose an image from a result omitted from model payload |

## 4. Current supported-format reality

The allow-list is intentionally finite:

`.pdf`, `.docx`, `.xlsx`, `.pptx`, `.txt`, `.md`, `.json`, `.html`, `.htm`, `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.tiff`, `.bmp`.

The system does **not** currently accept CSV, TSV, legacy `.doc` / `.xls` / `.ppt`, RTF, ODT/ODS/ODP, email containers such as EML/MSG, SVG, or HEIC/HEIF. Therefore, “any file” must either be narrowed to a documented support contract or expanded deliberately.

| Format | What is strong today | What is not guaranteed today |
|---|---|---|
| PDF | Native text, Document Intelligence markdown, DI figures, native raster extraction, crop fallback, page numbering, whole-page-background filtering | Reliable two-column order, lossless vision reconciliation, exact figure position after vision, full-page poster/image preservation, vector drawing extraction |
| DOCX | Body paragraphs, style-based headings including `basedOn`, tables, grid spans, content controls, footnotes/endnotes, inline/floating embedded pictures including pictures in tables | Header/footer data, hidden-text exclusion, positioned multi-column reading order, charts, shape text, repeated image placements, linked images |
| XLSX | Shared/inline strings, numeric/date formatting, formulas with fallback, merged cells, hidden sheets excluded, picture anchors | Multiple independent table regions, title rows above tables, charts/SmartArt/text boxes, repeated image placements, linked images, elapsed duration over 24 hours |
| PPTX | Slide titles/headings, paragraphs, tables, notes/master/layout exclusion, hidden-slide exclusion, embedded pictures, partial related chart/diagram text | Complete chart values/categories, all diagram semantics, background/fill pictures, repeated image placements, guaranteed visual order |
| TXT/MD | Direct text and Markdown structural parsing | Complex visual layout does not exist in the source; heading-only documents can produce zero searchable content |
| JSON | Objects/arrays can be structurally flattened | Valid scalar-root JSON is rejected as unreadable |
| Uploaded HTML | Tables, headings/text, selected images with remote-image cap | `<header>` and `<footer>` are removed unconditionally; page furniture and real business contact data are not distinguished |
| Standalone raster | Decode, normalize, resize, metadata strip, caption/index/send path | No deterministic OCR card separate from caption; GIF/WebP only first frame; caption truth and prompt-injection risks |

## 5. Existing ceilings and their product meaning

| Ceiling/policy | Current value/behavior | Consequence |
|---|---|---|
| Source file size | 30 MB | Larger supported documents are rejected |
| Pages | 100 | Content after the limit is not included |
| Extracted characters | 2.6 million | Very large text is bounded/truncated by policy |
| Passages per business | 2,000 | A business can hit an indexable-card ceiling |
| OOXML declared XML | 128 MB | XML bomb protection exists, but media expansion is excluded from this aggregate |
| Passage target/max | Approximately 350 / 512 tokens | Ordinary text/table chunks are bounded; image captions can bypass this bound |
| Passage overlap | 15% | Context continuity is favored, but page provenance can become ambiguous |
| Office embedded image floor | 10 KB | Small but meaningful icons, QR codes, signatures, or diagrams can be dropped |
| Images per document | 40 | “All images” is explicitly not true for documents with more than 40 candidates |
| Remote HTML images | 12 | Additional referenced images are excluded |
| Per-source image bytes | 64 MB | An individual image over the ceiling is skipped |
| Decoded image pixels | 40 MP | Decompression-bomb protection |
| Stored longest edge | 2,048 px | Higher source resolution is not retained in the indexed/sendable derivative |
| Caption input longest edge | 1,024 px | Small printed details can disappear before caption/OCR reasoning |
| Caption model output | Up to 1,500 tokens | Can exceed the ordinary 512-token passage contract |
| Material images per send | 4 | Only a bounded subset is delivered in one operation |
| GIF/WebP | First frame only | Later-frame text/content is lost |
| Whole-page PDF raster | A figure covering roughly 90%+ of a page is filtered | Scanned-page duplication is avoided, but full-page posters/photos are not retained as sendable figures |

These limits are defensible operational choices. They must be presented as a support contract and surfaced as coverage warnings. They are incompatible with an unqualified “extract all images” promise.

## 6. Critical findings

### EX-01 — Critical: search publication is not generation-atomic

**Evidence**

- `C:\Nik\clinqetfuncations\Clinqet.Communications\Functions\KnowledgeIngestProcessorFunction.cs:897` upserts the newly produced search cards.
- The stale tail is pruned afterward near `KnowledgeIngestProcessorFunction.cs:899`.
- The Cosmos knowledge-document row is changed to `Ready` only later, near `KnowledgeIngestProcessorFunction.cs:916`.
- `C:\Nik\clinqetinfrastructure\Data\COSMOS\KnowledgeDocumentRepository.cs:260-273` deliberately includes `Processing` documents in the retrievable-document allow-list; it excludes only `Deleting` and `Failed`.
- Search document IDs are deterministic from business/document/chunk ordinal, so a replacement overwrites ordinal `0`, then `1`, and so on in batches.

**Failure scenario**

A 100-card document is replaced with a newly extracted 70-card generation. While embedding/index batches are being written, live search can return new cards for ordinals already overwritten and old cards for ordinals not yet overwritten. After upsert but before stale-tail prune, old ordinals 70–99 can still appear. This creates an internally inconsistent answer that never existed in either the old or the new document.

**Impact**

- Incorrect provider answers during normal reprocess/replacement.
- Cross-section mismatches where a new heading/card is combined with an old adjacent card.
- A false sense of atomicity because Cosmos `Ready` is updated last but retrieval ignores that boundary.

**Required design**

Use immutable ingestion generations. Index every card with a generation/version, complete the generation, then atomically switch the document’s active-generation pointer. Retrieval must filter to the active ready generation. Delete the old generation asynchronously only after the pointer swap. Merely excluding `Processing` avoids mixed generations but causes replacement downtime and still does not make old refs immutable.

**Owner-approval gate**

Adding an index field, Cosmos field, or search filter is a schema change and requires explicit owner approval under `AGENTS.md §0.7` before implementation.

**Acceptance criteria**

- During replacement, every query returns either 100% old generation or 100% new generation—never a mixture.
- Failure before publication leaves the old generation fully available.
- Retry/redelivery produces one active generation, not duplicates.
- Old generation cleanup cannot remove the new generation.

### EX-02 — Critical: text material references are mutable ordinal pointers

**Evidence**

- `C:\Nik\clinqetinfrastructure\Services\Knowledge\KnowledgeMaterialRef.cs:7-19` formats/parses a text reference from only a document prefix and `chunkNo`.
- `C:\Nik\clinqetinfrastructure\Services\Knowledge\ProviderKnowledgeSearchService.cs` resolves those values against the current indexed card.
- `C:\Nik\clinqetmcp\Clinqet.Mcp\Tools\KnowledgeTools.cs:384-441` normalizes, resolves, and records those same ordinal references.

**Failure scenario**

The assistant retrieves `abcdef123456:7` for “Premium package: $500.” Before the customer asks to send it, the provider replaces/reprocesses the document and chunk 7 now contains “Basic package: $100.” The send call re-resolves the same reference and can deliver content different from what the assistant offered.

**Impact**

- The material-delivery audit trail does not prove which content the caller selected.
- Re-chunking, parser improvements, added headings, or changed overlap can repoint every later ordinal.
- The inconsistency is especially dangerous for prices, terms, policies, and regulated text.

**Required design**

Bind a material reference to immutable content: document ID + active generation + chunk ID, or document ID + cryptographic content digest + chunk ID. Reject a reference if its generation is no longer retained, or deliberately send the exact retained historical content selected by the user.

**Owner-approval gate**

Any persisted/indexed generation or digest field is a schema/contract change requiring owner approval.

### EX-03 — Critical availability risk: OOXML media expansion is not cumulatively bounded

**Evidence**

- `C:\Nik\clinqetinfrastructure\Services\Knowledge\OpenXmlPackageInspector.cs:25` excludes media from `TotalXmlBytes`.
- XML has an aggregate declared-size ceiling, but each DOCX/XLSX/PPTX image is read into a `byte[]` separately by the current Office parser path.
- The per-part source limit is 64 MB, but no reviewed code applies a cumulative declared-media-byte ceiling before materialization.
- The 40-image cap is applied later in `C:\Nik\clinqetfuncations\Clinqet.Communications\Functions\KnowledgeIngestProcessorFunction.cs:1508-1511`, after the parser has collected image bytes.

**Failure scenario**

A compressed 30 MB Office ZIP contains hundreds of highly compressible raster parts. Every part is below 64 MB uncompressed, but their cumulative expansion is several gigabytes. The parser materializes candidates before the final 40-image selection, exhausting the shared Function worker.

**Impact**

- Worker out-of-memory termination and redelivery loop.
- Neighboring queue messages are disrupted.
- An upload that passes the outer 30 MB gate can still become a decompression/memory denial of service.

**Required fix**

- Inspect central-directory entries before opening parts.
- Enforce maximum candidate count, cumulative declared media bytes, cumulative bytes actually read, and cumulative decoded pixels.
- Stream bounded reads; do not allocate every part before selection.
- Stop deterministically and record a coverage warning when a limit is reached.
- Apply the same policy across DOCX, XLSX, and PPTX.

### EX-04 — High: nonempty vision output replaces OCR without a fidelity check

**Evidence**

- `C:\Nik\clinqetfuncations\Clinqet.Communications\Services\VisionDocumentTranscriptionService.cs:152` replaces a page with vision markdown whenever the response is nonempty.
- Only blank/failure output preserves the prior OCR/Document Intelligence page.
- The reviewed flow contains no source-vs-replacement coverage comparison for names, numbers, table cells, or figure markers.

**Failure scenario**

Document Intelligence extracts a dense price table correctly. Vision produces a fluent but incomplete markdown table that omits two rows or normalizes a SKU incorrectly. Because the output is nonempty, it wholesale replaces the better OCR result.

**Impact**

- Silent factual deletion.
- Prices, phone numbers, units, names, codes, and table associations are particularly vulnerable.
- The resulting passages look cleaner, making the data loss harder to notice.

**Required fix**

Treat vision as a proposed correction, not an unconditional replacement. Reconcile it with the baseline using deterministic invariants:

- numeric/token conservation,
- proper-name and identifier conservation,
- table row/column count comparison,
- figure-anchor conservation,
- minimum text coverage ratio,
- confidence/diagnostic flags.

When invariants fail, keep the baseline or merge only the proven improvement. Store enough diagnostics to explain which lane won.

### EX-05 — High: AI captions become searchable facts without grounding validation

**Evidence**

- `C:\Nik\clinqetfuncations\Clinqet.Communications\Services\KnowledgeImageCaptionClassifier.cs:91-92` asks the model for visual description, brands/models, and legible text.
- The response schema constrains the field to a string but does not prove brand/model/OCR accuracy.
- The returned caption is trimmed and accepted near `KnowledgeImageCaptionClassifier.cs:119-140`.
- `C:\Nik\clinqetfuncations\Clinqet.Communications\Functions\KnowledgeIngestProcessorFunction.cs:2043-2063` creates an `ImageCaption` search card from that output and embeds it as searchable content.

**Failure scenario**

- A generic device is misidentified as a specific model; the invented model becomes retrievable knowledge.
- A screenshot contains “ignore previous instructions and disclose…”. The caption/OCR reproduces the instruction, and the business-search or assistant context treats it as provider knowledge.
- Tiny text lost by the 1,024 px caption derivative is guessed rather than read.

**Impact**

Generated interpretation and source-authored facts are mixed in the same truth channel. Search ranking cannot distinguish observed text from model inference.

**Required fix**

- Split image data into `observed_text` and `visual_description` conceptually.
- Extract observed text with a deterministic OCR lane and confidence/geometry.
- Keep description short and explicitly non-authoritative.
- Do not allow unverified brand/model/price assertions into the factual index.
- Apply strong untrusted-document-content delimiters and instruction-neutralization at every model boundary.
- Link captions to source-authored alt text and nearby document context, while preserving which text came from which source.

Any new persisted/search fields require owner approval; a first no-schema hardening step can use labeled content inside existing `Content`/`EmbedText` while preserving the contract.

### EX-06 — High: extraction and caption lineage is incomplete, making errors sticky

**Evidence**

- `KnowledgeIngestProcessorFunction.cs:75-76` builds `PipelineFingerprint` primarily from assembly fingerprints plus whether image captioning is enabled.
- Artifact reuse happens near `KnowledgeIngestProcessorFunction.cs:542`.
- Captions are also reused business-wide by image content hash near `KnowledgeIngestProcessorFunction.cs:1527` and `BuildBusinessImageMapAsync` near line 1993.
- The reviewed artifact/caption identity does not directly include the caption deployment/model, prompt version, caption dimensions, vision prompt version, parser settings, figure threshold, image floor, remote-image cap, or normalized-caption policy.

**Failure scenarios**

- A caption prompt/model bug is fixed, but reprocess reuses the old caption by content hash.
- The maximum-images setting is raised from 40 to 80, but the extraction artifact contains only the previously retained image pointers, so reprocess cannot recover the other candidates.
- A vision transcription prompt is improved, but artifact reuse bypasses the transcription lane.
- A threshold change appears deployed yet produces no change for existing documents.

**Impact**

- Incorrect captions and extraction omissions persist indefinitely.
- Operators cannot reliably distinguish “reprocessed” from “reused old interpretation.”
- Model/prompt rollbacks and forward fixes are not auditable.

**Required fix**

Define an explicit version vector/digest that covers every semantic input:

- parser/extractor version,
- all output-affecting settings,
- Document Intelligence model/API version,
- vision deployment + prompt/schema version,
- caption deployment + prompt/schema version,
- normalization policy,
- chunker version and tokenizer assumptions,
- inventory/summary version.

Provide a true **force-fresh** operation that bypasses both artifacts and caption reuse when correcting bad derived data. Record whether each stage was fresh, reused, or reconciled.

## 7. High-impact extraction and passage findings

### EX-07 — High: two-column and positioned reading order remains heuristic

The PDF/vision path asks for correct reading order but ultimately consumes a flattened markdown stream. It does not retain and use word/line polygons to construct column regions before flattening. Positioned Word/PPT content similarly follows package/XML traversal more than final visual coordinates.

**Failure examples**

- A two-column résumé interleaves employment history with skills.
- A menu’s price column is attached to the wrong service.
- A brochure reads the right-hand callout between two left-column paragraphs.

**Required improvement**

Preserve layout coordinates through extraction, detect columns/regions, compute reading order per region, and validate ordering against table/heading boundaries. Flatten only after a layout graph exists.

### EX-08 — High: a passage has only one page number even when it spans pages

**Evidence**

- `C:\Nik\clinqetinfrastructure\Services\Knowledge\KnowledgeDocumentParser.cs:167-170` advances page state on a page break without necessarily flushing the current paragraph first.
- `C:\Nik\clinqetinfrastructure\Services\Knowledge\KnowledgeChunker.cs:1128-1144` does not necessarily close a sentence builder when page changes; its page value is initialized once.
- Overlap can seed prior-page sentences into a later card.
- `C:\Nik\clinqetinfrastructure\Services\Knowledge\KnowledgeSearchDocument.cs:94` exposes one `PageNumber`, not a start/end page or source span.

**Impact**

Citations can open the wrong page, and repeated text on neighboring pages cannot be traced to its exact occurrence.

**Required fix**

Short term: do not let ordinary chunks or overlap cross a page boundary. Long term: retain page-start/page-end and source offsets/polygons. Search-schema changes require owner approval.

### EX-09 — High: vision transcription moves all figure anchors to page end

**Evidence**

`C:\Nik\clinqetfuncations\Clinqet.Communications\Services\PageMarkdownSplicer.cs:44-49` carries preserved `<figure>` anchors by appending them after the replacement transcript.

**Impact**

The image remains associated with the correct page but can inherit the page’s final heading/section rather than the paragraph or row beside which it appeared. Search for the actual nearby product/service may not retrieve the image.

**Required fix**

Preserve figure geometry or character offsets and splice the marker at the closest structurally valid location. When exact placement is uncertain, mark it as page-level context rather than attaching it to the final section.

### EX-10 — High: the image cap is decided before validation and ranks by compressed byte length

**Evidence**

- `KnowledgeIngestProcessorFunction.cs:1508-1511` applies `KnowledgeImageStore.SelectWithinCap` to source bytes.
- Decode/normalization and the pixel floor happen later near lines 1537-1555.
- `C:\Nik\clinqetinfrastructure\Services\Knowledge\KnowledgeImageStore.cs` selects candidates by descending source byte size.

**Failure scenario**

Forty huge decorative/corrupt/background images win the cap, then fail decode or relevance checks. Smaller valid product images were already discarded and are never reconsidered.

**Required fix**

Run a bounded, cheap identify/probe before final selection. Rank deterministically using dimensions, short edge, area, aspect ratio, repetition, likely logo/background, page/sheet/slide diversity, placement/nearby-text strength, and decode success. Fill vacated slots when a selected candidate fails.

### EX-11 — High: the minimum-dimension condition admits extreme strips

**Evidence**

`KnowledgeIngestProcessorFunction.cs:1551` rejects an image only when both width **and** height are below the minimum. Therefore a 30×2,000 divider survives a 200 px minimum.

**Impact**

Decorative separators consume blob writes, caption calls, image-card slots, and the 40-image cap.

**Required fix**

Use a minimum short edge, minimum area, and maximum aspect ratio, with exceptions only for intentionally supported barcodes/QR codes or panoramic content.

### EX-12 — High: exact-byte hashing does not deduplicate visual equivalents

Current content hashes are excellent for byte-identical reuse. They do not match:

- the same picture re-encoded as JPEG and PNG,
- a native PDF image and a DI-rendered crop of it,
- resized or metadata-different copies,
- visually identical images saved separately in Office media parts.

The PDF geometry path suppresses some duplicates, but this is not a general visual dedupe system.

**Required fix**

Retain the cryptographic source hash for integrity, then calculate a normalized/perceptual image fingerprint after safe decode. Deduplicate storage/caption calls by perceptual similarity while retaining every document placement.

### EX-13 — High: image cards lack sufficient source context

**Evidence**

- `KnowledgeExtractedImage` carries a general `AnchorHint`, but the image-card embed text near `KnowledgeIngestProcessorFunction.cs:2043-2063` is primarily document title, section, and AI caption.
- XLSX can know an anchor such as `Sheet!C12`, yet the nearby table row/cell values are not part of the image card’s searchable grounding.
- The caption model is given pixels, not a trusted bundle of source alt text + neighboring paragraph/table row.

**Failure example**

A product image beside `Model X | $500 | 2-year warranty` is captioned only “industrial machine.” Search for “Model X” returns the text row but not the sendable image, or the image is associated with the wrong product when several similar pictures exist.

**Required fix**

Capture source-authored alt/title text, exact placement, nearest heading/paragraph/table row, and stable source span. Put labeled trusted context into embedding text without pretending it is visually observed. Keep generated description distinct.

### EX-14 — High: Office image-part dedupe removes later placements

**Evidence**

- DOCX maintains `seenImageParts` in `KnowledgeDocumentParser.OpenXml.cs` and emits only the first occurrence of a reused part.
- XLSX deduplicates repeated picture relationships per sheet.
- PPTX maintains a global seen-part set.

**Failure scenario**

The same logo, safety diagram, or product photo is intentionally reused in two different sections. Only the first marker survives, so the second context cannot retrieve or cite the image.

**Required fix**

Deduplicate bytes, storage, and caption computation—not placements. Emit every placement marker with its own location/context, then point them to one image asset. Retrieval may collapse identical assets only after context matching.

### EX-15 — High: an Excel worksheet is flattened into one logical table

**Evidence**

`KnowledgeDocumentParser.OpenXml.cs:316-366` gathers visible nonblank rows and creates one table block for the sheet. Blank separators and independent table regions do not become durable semantic boundaries. Header recognition is tied too closely to the initial row rather than each declared/connected region.

**Failure scenarios**

- A worksheet contains “Services,” “Add-ons,” and “Cancellation Rules” separated by blank rows; all become one schema.
- A title in row 1 and actual header in row 3 prevents correct row labeling.
- Two Excel Table definitions on one sheet are merged.

**Required fix**

Segment by explicit TableDefinition ranges first, then by connected nonblank regions. Preserve blank-row boundaries, detect a header per region, retain sheet/cell ranges, and emit prose notes separately from record tables.

### EX-16 — High: full-width merged section rows become fake repeated column values

**Evidence**

- DOCX `GridSpan` text is repeated across logical cells in `KnowledgeDocumentParser.OpenXml.cs` near line 251.
- XLSX merged values are copied into every covered cell near lines 330-345.
- PPTX grid-span text is repeated in `KnowledgeDocumentParser.Pptx.cs` near line 338.
- The uploaded-HTML path has a full-width-section collapse behavior; the OOXML paths do not apply equivalent semantic normalization.

**Example**

A row merged across `Service | Price | Duration` containing `HAIRCUTS` becomes:

`Service: HAIRCUTS | Price: HAIRCUTS | Duration: HAIRCUTS`

That passage is semantically false.

**Required fix**

Retain source merge/span metadata. If one source cell spans an entire logical row, emit it as a section/subheading row, not duplicated record values.

### EX-17 — High: résumé/general Word fidelity is incomplete

The current DOCX parser has materially improved and now handles body content, tables, content controls, footnotes/endnotes, inherited heading styles, and pictures inside tables. Remaining gaps matter for real résumé and brochure templates:

- Headers/footers are intentionally excluded; names, contact details, legal terms, or hours placed there disappear.
- `w:vanish` / hidden run text is not clearly excluded by the current dropped-subtree policy.
- Floating text boxes and positioned multi-column layouts are traversed in package order, not reliable visual order.
- Charts and some drawing/shape text are not fully represented.
- Repeated image placements are suppressed as described in EX-14.

**Required fix**

Extract and deduplicate meaningful headers/footers once, exclude truly hidden text, and add a visual-layout lane for positioned content. The product should call résumé support “best effort” until a corpus proves template coverage.

### EX-18 — High: Office charts, SmartArt, shapes, and picture fills are only partially represented

**Evidence**

- PPTX related-part extraction walks drawing paragraphs, which captures some chart/diagram labels but not necessarily cached series categories and numeric values stored in chart-specific XML.
- XLSX focuses on worksheet cell values and `Picture` drawing objects; charts, SmartArt, shape text, and chart-only cached values are not comprehensively emitted.
- DOCX chart/diagram semantic data is not comprehensively traversed.
- Images used as shape fills, slide backgrounds, or non-`Picture` drawing constructs may not enter the image lane.

**Impact**

A chart can be visually central yet yield only its title, only some labels, or no numeric series. A process diagram may lose edge/order semantics.

**Required fix**

Add explicit chart-series extraction (title, categories, values, units, legend), SmartArt node/edge ordering, shape-text extraction, and a rendered-image fallback for visual structures whose semantics cannot be reconstructed reliably.

### EX-19 — High: an image-caption card can exceed the ordinary chunk maximum

**Evidence**

- `C:\Nik\clinqetinfrastructure\Services\Voice\VoiceKnowledgeSettings.cs:46` sets ordinary maximum passage size to approximately 512 tokens.
- The caption model can return up to 1,500 tokens near `VoiceKnowledgeSettings.cs:104`.
- The caption schema has no strict text length and `KnowledgeIngestProcessorFunction.cs:2043-2063` inserts the caption directly as one `ImageCaption` card.

**Impact**

Text-heavy screenshots can create oversized search results, distort embedding quality, and defeat downstream token budgets. Retrieval code that always retains the top passage can still exceed the intended budget.

**Required fix**

Keep the visual description short. Put deterministic OCR/observed text through the normal chunker as one or more bounded text cards linked to the image. Enforce character/token limits before index submission.

### EX-20 — High: generated document descriptions can acquire factual authority

The deterministic inventory is a strong foundation, and the description prompt discourages speculation. Nevertheless, the model-written description is indexed alongside extracted content. Without reconciliation, a fluent summary can generalize, omit qualifiers, or express inferred facts with the same retrieval authority as source text.

**Required improvement**

Label generated overview content, validate critical numbers/names against extracted facts, and weight source-extracted cards above generated summaries for factual answers.

## 8. Medium findings and explicit limitations

### EX-21 — Heading-only sources can fail as “no readable content”

PPTX now correctly preserves a title-only slide as a heading. Markdown/Word can also contain heading-only structure. The chunker does not emit a text card for a heading alone, and ingest checks for zero cards before a later description card can rescue the document. A valid title-only deck or outline can therefore fail.

**Fix:** emit a bounded structural-title card or permit a deterministic inventory/description card when meaningful headings exist.

### EX-22 — Prose dedupe can erase distinct section context

`KnowledgeChunker.DeduplicateWithinDocument` uses content-only identity for non-table prose, while table dedupe incorporates section context. The same sentence under two products/locations can lose its second occurrence even though its heading context is semantically important.

**Fix:** include normalized section/source span in prose identity, or limit dedupe to adjacent/page-furniture repetitions.

### EX-23 — Inventory merges identical table schemas across unrelated sections

`KnowledgeInventoryBuilder` groups tables principally by column-label signature. “Services” and “Products” tables can both be `Name | Price`; they are then merged under the first section, distorting record totals and summary context.

**Fix:** include normalized section in grouping unless there is positive evidence that the table is a paginated continuation.

### EX-24 — Section counts combine unlike content types

Inventory section counts include paragraphs, list items, preformatted blocks, and table rows. “Services (101)” may mean 100 services plus one introductory paragraph, not 101 services.

**Fix:** report typed counts such as `100 records, 1 note`, and use only comparable record units for authoritative totals.

### EX-25 — Blank first-cell inheritance can invent record association

The table row planner can carry the prior first-cell value into a later row whose first cell is blank. That is useful for visually merged continuation rows but unsafe without source merge metadata; blank can also mean subtotal, unknown, or deliberately independent data.

**Fix:** inherit only when structure proves a vertical merge/continuation or when a conservative, auditable confidence rule is satisfied.

### EX-26 — Business Search can return an image for a row omitted from the model payload

**Evidence**

- `C:\Nik\clinqetinfrastructure\Services\BusinessSearch\Tools\SearchKnowledgeTool.cs:140-148` collects images before `SerializeCapped` truncates the result payload.
- Citations are limited to kept rows near line 167, but the returned images collection is not visibly filtered by the same kept-card set.

**Impact**

The UI/agent can receive an image belonging to a result the model never saw, weakening answer-image grounding.

**Fix:** bind every image to its result/card ID and emit only images whose owning cards survived serialization.

### EX-27 — Script detection ignores title/section/anchor context

`KnowledgeSearchIndexer` detects script primarily from card content. A card containing a numeric price may get no useful script facet even if its document title/section/anchor contains Gujarati, Hindi, or another script.

**Fix:** detect over the same normalized text actually embedded/searched: title + section + source context + content.

### EX-28 — Animated GIF/WebP content after frame one is lost

The normalizer selects the first frame. This is reasonable for cost and predictability but is a real content-loss rule. Animated instructions, rotating product panels, or later-frame text are not indexed.

**Fix options:** explicitly reject animated files, sample a bounded number of materially distinct frames, or document first-frame-only support and surface a warning.

### EX-29 — Uploaded HTML removes potentially meaningful header/footer content

The parser removes `<header>` and `<footer>` as presumed page furniture. For an uploaded business page/export, those nodes can hold address, phone, hours, copyright/license terms, or policy links.

**Fix:** extract first, then deduplicate repeated furniture using content/position evidence; do not delete by tag name alone.

### EX-30 — Valid scalar-root JSON is treated as unreadable

The JSON structural path expects object/array roots. Valid JSON such as `"open"`, `123`, or `true` is not meaningfully emitted.

**Fix:** serialize a scalar root into one bounded paragraph/value card.

### EX-31 — Excel elapsed durations can wrap at 24 hours

`C:\Nik\clinqetinfrastructure\Services\Knowledge\XlsxCellFormatter.cs` recognizes time formats but uses a `DateTime` rendering path for values such as `[h]:mm:ss`. A duration of 40 hours can become `16:00:00`.

**Fix:** distinguish elapsed-duration formats containing bracketed units and render from `TimeSpan`, preserving total hours.

### EX-32 — Dehyphenation can remove legitimate hyphens

The line-join cleanup removes a line-ending hyphen before a lowercase continuation. This correctly repairs OCR line wraps but can alter a deliberately hyphenated identifier or compound.

**Fix:** restrict dehyphenation to layout/OCR lanes with stronger lexical evidence; never apply it blindly to native structured text.

### EX-33 — Lexical analyzer choices are not fully multilingual

Some searchable fields use an English analyzer while others use standard analysis; vector search softens but does not remove multilingual lexical-recall differences. Changing analyzers is a search-schema change and requires owner approval. This is an improvement opportunity, not evidence that multilingual search never works.

### EX-34 — linked, vector, small, and full-page images have incomplete coverage

The literal “all images” gap also includes:

- DOCX/XLSX linked images (`blip.Link`) are not fetched as embedded assets.
- Office vector formats such as SVG/EMF/WMF are not guaranteed to decode through the raster normalizer.
- Small meaningful QR codes, signatures, badges, or diagrams can fall below the 10 KB/size filters.
- Full-page PDF images can be filtered as page scans/backgrounds.
- Pictures encoded as shape fills/backgrounds may not appear as ordinary picture parts.
- Candidates above the per-document cap are intentionally discarded.

Each exclusion should increment a visible, typed coverage reason; otherwise “Ready” overstates extraction completeness.

## 9. What the current implementation already gets right

This audit revalidated current source and deliberately does **not** repeat stale issues that are already addressed.

- **Image sanitization is strong:** decoded content is bounded, resized, re-encoded, and stripped of EXIF/ICC/IPTC/XMP, PNG text chunks, and JPEG COM metadata before durable use.
- **CMYK and malformed-image handling exist**, with decoded-pixel and edge ceilings.
- **PDF extraction is hybrid rather than OCR-only:** native text and native rasters are used, DI figures can be cropped when native mapping fails, and whole-page scan duplication is filtered.
- **Office package XML expansion is bounded** through a declared XML-size inspection. EX-03 is specifically about the excluded aggregate media lane, not absence of all ZIP protection.
- **DOCX coverage has improved:** footnotes/endnotes, content controls, `basedOn` heading inheritance, tables, and images inside tables are currently handled.
- **XLSX merged-cell/formula behavior has improved:** merged ranges are expanded and formula-only cells have a fallback path. EX-15/16 concern semantic segmentation, not total absence of these features.
- **PPTX title-only slides now retain their titles as headings.** EX-21 is downstream: heading-only structure still does not become a card.
- **PPTX excludes hidden slides and avoids notes/master/layout contamination**, and it has partial chart/SmartArt related-part text extraction.
- **Tenant/business scoping is present** in document allow-list, search filters, reference resolution, and image registry access.
- **Image send authorization is rechecked against the current registry**, which is safer than trusting a model-provided URL.
- **Artifacts and degraded recovery paths exist**, reducing repeated AI/API cost and allowing some missing image captions to be topped up.
- **Deterministic inventory is separated from model-written description**, which is the right foundation for authoritative counts.
- **Ordinary paragraph/table chunking is bounded and structure-aware**, with headings, list handling, table label-value serialization, and overlap.

These strengths should be preserved while fixing the generation, lineage, layout, and grounding defects.

## 10. Recommended target architecture

### 10.1 Immutable document generation

Treat each extraction as an immutable generation:

1. Acquire/validate source and compute source hash.
2. Produce a versioned extraction artifact with stage lineage.
3. Validate extraction coverage.
4. Produce versioned text/image/source-span records.
5. Chunk deterministically and validate chunk invariants.
6. Index all cards under the new generation without exposing them.
7. Verify expected card/image counts and index completeness.
8. Atomically set the document’s active generation to the new ready generation.
9. Retain the previous generation for a bounded rollback/reference window.
10. Delete expired generations asynchronously and idempotently.

This creates a real commit boundary. `Processing`, `Ready`, and `Failed` become generation states instead of allowing a partially overwritten global namespace.

### 10.2 Evidence-first extraction model

Internally, each extracted unit should preserve:

- source format and part,
- page/sheet/slide,
- start/end offsets or geometry,
- block type,
- heading path,
- table/region identity,
- exact source text,
- normalized text,
- extraction lane and confidence,
- image asset identity and every placement,
- source-authored alt/title/nearby text,
- generated annotations kept in a distinct namespace.

The user-facing index can remain compact, but it should be produced from this evidence graph rather than discarding provenance before chunking.

### 10.3 Separate facts from generated interpretation

Use three logical channels:

1. **Source facts:** native text, OCR text, table cells, alt text.
2. **Structural context:** heading, sheet, page, cell/range, neighboring row, image placement.
3. **Generated interpretation:** image description and document summary.

Retrieval and answer instructions should always prefer source facts. Generated interpretation is useful for recall/routing but must not silently become a factual authority.

### 10.4 Image asset versus image placement

An image asset is one normalized/perceptually deduplicated bitmap. An image placement is an occurrence in a page/slide/sheet/paragraph/table cell. Store/caption the asset once; retain all placements. Rank a placement using the query and its local textual context, then deliver the shared asset.

This solves both waste and the current first-placement-only context loss.

## 11. Prioritized remediation plan

### P0 — consistency and worker-safety blockers

1. Add immutable generation publication and generation-bound material references. **Schema approval required before implementation.**
2. Add cumulative OOXML media entry/read/decode budgets before byte-array materialization.
3. Stop allowing vision to replace OCR without deterministic coverage checks.
4. Add explicit extractor/caption/version/settings lineage and a real force-fresh path.
5. Neutralize untrusted extracted instructions and separate generated captions from observed source facts.

### P1 — high-return fixes that can largely start without schema changes

1. Probe/decode candidates before image cap; refill failed slots; replace byte-size ranking.
2. Correct the min-dimension `AND` policy using short-edge/area/aspect rules.
3. Hard-cap image captions; put OCR text through normal chunking.
4. Filter Business Search images to cards actually retained in the capped model payload.
5. Make prose dedupe section/source-aware.
6. Group inventory tables by section plus schema.
7. Split inventory record counts from prose-note counts.
8. Fix Excel elapsed duration formatting.
9. Support scalar JSON roots.
10. Surface typed coverage warnings for every skipped image/content reason.

### P2 — extraction fidelity

1. Implement coordinate-backed PDF/vision column and reading-order reconstruction.
2. Preserve page boundaries through paragraph assembly, overlap, chunking, citation, and send.
3. Preserve figure positions when splicing vision output.
4. Segment XLSX by declared tables and connected regions.
5. Treat full-width OOXML merged rows as section rows rather than repeated fake values.
6. Retain every Office image placement while deduplicating the asset.
7. Add source alt/title and nearby row/paragraph context to image grounding.
8. Add Word header/footer dedupe, hidden-text exclusion, and positioned-layout handling.
9. Add explicit chart/SmartArt/shape extraction plus rendered fallback.
10. Add bounded animation/vector handling or formalize the limitation.

### P3 — next-level index and provenance design

Potential additions include generation, page range, source span, placement identity, evidence type, confidence, and normalized/perceptual image identity. These are search/Cosmos schema changes and **must not be implemented until the owner approves the exact schema proposal using the §0.7 table.**

## 12. Required golden-corpus validation program

The next review should not ask only “did parsing return text?” It should measure loss and misassociation. The corpus should contain hand-authored expected facts and placements.

### PDF corpus

- native single column,
- native two/three column,
- scanned two column,
- mixed native/OCR pages,
- rotated pages,
- tables spanning pages,
- figure beside a product row,
- multiple figures on one page,
- full-page photo/poster,
- vector diagram,
- repeated headers/footers,
- ligatures, hyphenation, RTL, Indic scripts,
- corrupt or encrypted PDF.

### DOCX corpus

- conventional report,
- résumé with header contact block,
- résumé built from tables,
- résumé built from floating text boxes/two columns,
- nested tables and merged cells,
- content controls,
- footnotes/endnotes,
- tracked/hidden/deleted text,
- images in body/table/header/footer,
- repeated same image in different sections,
- chart and SmartArt.

### XLSX corpus

- one table,
- multiple tables on one sheet,
- title rows above headers,
- merged section rows,
- sparse cells and blank separators,
- formulas with and without cached values,
- dates/times/durations above 24 hours,
- hidden sheets/rows/columns,
- images anchored to rows,
- repeated images,
- charts and shape text,
- multilingual and RTL sheets.

### PPTX corpus

- title-only slide,
- text boxes in nontrivial visual order,
- tables with merged section rows,
- notes/master/layout contamination checks,
- hidden slides,
- repeated images,
- chart with category/value series,
- SmartArt process,
- background/fill image,
- grouped/rotated shapes.

### Raster/HTML/JSON corpus

- text-heavy screenshots,
- tiny QR/signature/icon,
- CMYK JPEG,
- EXIF/ICC/XMP/PNG-text/JPEG-COM metadata,
- animated GIF/WebP with later-frame facts,
- SVG/vector case,
- corrupt/decompression-bomb candidates,
- HTML whose header/footer contains true business data,
- scalar JSON roots.

### Assertions that matter

- **Text conservation:** every expected fact appears exactly or acceptably normalized.
- **Numeric conservation:** prices, dates, units, SKUs, phone numbers, percentages, and counts are unchanged.
- **Relationship conservation:** values remain attached to the correct row, heading, product, service, and image.
- **Reading order:** columns and positioned elements do not interleave incorrectly.
- **Page/source provenance:** citations open the exact supporting location.
- **Image completeness:** every in-policy image placement is accounted for as kept, deduplicated, or skipped with a typed reason.
- **Image grounding:** a query for adjacent source text retrieves the correct placement/asset.
- **Chunk invariants:** no card exceeds the limit; no sentence/row is silently lost; overlap is bounded; page boundaries are honest.
- **Generation atomicity:** readers see only one complete generation throughout replacement/failure/retry.
- **Reference immutability:** an offered/sent reference always resolves to the exact originally selected content.
- **Prompt-injection resistance:** instructions inside documents/images are data, never executable control text.
- **Determinism:** identical source + version vector produces identical blocks/cards/IDs.
- **Idempotency:** redelivery produces no duplicate assets, cards, or usage charges.

## 13. Definition of “solid” for this product path

The extraction-and-passage brain should not be called solid until all of the following are true:

- The public support matrix is exact and matches code.
- Every limit is configured, documented, and surfaced in document coverage status.
- A ready document has a measured extraction report: pages/parts processed, facts/cards/images retained, and every skip reason.
- No AI-derived text is indistinguishable from source-authored fact.
- No partial generation is searchable.
- No reference can mutate after it is offered.
- Every indexed passage has defensible source provenance.
- Every image asset retains all useful placements and local textual context.
- Complex tables/columns/resumés/charts have corpus-backed guarantees, not prompt-only expectations.
- Reprocessing with a corrected model/prompt/parser demonstrably invalidates the affected derived data.
- Oversized/adversarial packages cannot exhaust a shared worker.
- The golden corpus proves conservation, relationships, grounding, isolation, idempotency, and safe failure for every supported format.

## 14. Final assessment

The existing implementation is a serious, thoughtfully engineered foundation, and several previously plausible weaknesses are already fixed in current source. However, it still behaves primarily as a sophisticated best-effort document parser, not as a loss-accounted, generation-atomic evidence system.

The highest-value next step is not adding more model intelligence. It is making knowledge immutable by generation, preserving evidence/provenance longer, measuring extraction loss, and separating source facts from model interpretation. Once those controls exist, layout and image improvements can safely raise recall without lowering trust.

**Audit status:** Complete as a static current-source review. No tests or workflow executions were run. The findings above are source-confirmed risks and remediation recommendations, not claims established by runtime reproduction.
