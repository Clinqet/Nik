# Knowledge transcription validator: verified findings

Verified locally on 2026-09-08. No application source was changed. This report and the accompanying implementation prompt are the deliverables.

## Decision

Fix the transcription fidelity checks before production. Keep the existing document extraction architecture while addressing this defect. Adding Microsoft MarkItDown would not repair this validator.

The validator currently checks whether numbers and longer words survive somewhere on a page. It does not establish that a price still belongs to its service, or that a sentence retains its meaning. `not` is excluded because it has fewer than four letters.

This is a confirmed protection defect. It is not evidence that the live model has corrupted existing business documents.

## Real-service experiment

Created a one-page PDF with a clear two-row table and a deposit policy. Created an image-only PDF of the same page to exercise OCR. Source values, visually inspected:

- Haircut: CAD 500.
- Colour: CAD 1200.
- Deposit is not refundable.

Used the actual application classes for Document Intelligence, PDF rasterization, vision transcription, conservation checking, Azure blob caching, parsing, chunking, embedding, and index writes. Loaded configuration at runtime; credentials are not included here. Canada search and storage credentials came from `C:/Nik/cosmosindexsetup/appsettings.ca.json`. AI/Document Intelligence configuration came from the Functions application settings and local Canada overrides.

- DI extraction: `prebuilt-layout`, Markdown output, figures requested.
- Vision deployment: `gpt-5.6-luna`, configured settings, conservation threshold 0.95.
- Search alias: `clinket-knowledge-dev`; existing physical index: `clinket-knowledge-dev-v1`.
- Embeddings: actual API calls, 3,072 dimensions.
- Blob container: existing `provider-knowledge`.
- Isolated test business scope: `validator-review-fd3f48a13c8742069869e96a162a3d53`. No business/Cosmos entity was created or modified.

| Test | Digital PDF | Image-only PDF |
|---|---|---|
| Actual DI extraction | All three facts correct | All three facts correct |
| Actual vision, uncached run 1 | All three facts correct | All three facts correct |
| Actual vision, uncached run 2 | All three facts correct | All three facts correct |
| Deliberately swap 500 and 1200 in the actual vision transcript | Accepted, cached, indexed with wrong associations | Accepted, cached, indexed with wrong associations |
| Deliberately remove `not` from the actual vision transcript | Accepted, cached, indexed as refundable | Accepted, cached, indexed as refundable |

In the deliberate corruption tests, only the model completion was substituted with the edited actual transcript. Real PDF bytes, real DI baseline, real rasterizer, production validator/transcription service, real cloud storage, real embeddings and real index writer were used. Alerts were captured/suppressed by test doubles; no admin notifications were sent.

All four corrupted outputs had `PagesTranscribed = 1`, `PagesRejected = 0`. Every cache replay through the real service returned the same corrupted text with `PagesFromCache = 1`. Directly setting the validator's word coverage argument to 1.0 still accepted all four corruptions.

The following exact wrong content was retrieved from the Canada index under the test scope:

```text
Service: Haircut | Price (CAD): 1200
Service: Colour | Price (CAD): 500
```

```text
Deposit is refundable.
```

The four unmodified live transcripts were also embedded, indexed and retrieved, preserving the correct facts. Each scenario yielded two cards, for 16 index cards total.

This was a component integration harness, not a full Service Bus ingestion invocation or a telephone-call test. The harness constructed normal document cards using the production parser/chunker and indexer; it did not run Cosmos document lifecycle, image binding, generated title/overview enrichment or provider access checks. Index readback used business-and-document-filtered search and verified exact content equality. It did not measure caller-answer accuracy or ranking quality.

## Existing tests and controls

The affected project built and the selected existing unit suite passed: 232 passed, zero failed, zero skipped. Selected classes covered conservation, page/document transcription, Markdown splicing, parser and chunker. Passing existing tests does not rule out this defect; the demonstrated cases are missing behavioral coverage.

Earlier controlled service probes used real Azurite through `AzureStorageService`: a correct HTML-table-to-Markdown transformation passed; deletion of an entire price failed, retried and preserved the DI baseline without caching the rejected candidate. These controls establish that the gate runs and detects some losses, but misses the two principal semantic changes.

Additional controlled probes also accepted `Dosage 5 mg` to `Dosage 5 g`, and `Temperature -5 degrees` to `Temperature 5 degrees`. These were not live-model errors and were not part of the Canada real-PDF experiment. They belong to the same protected-fact concern. An injected unsupported extra service also passed, but additions cannot be universally banned: vision can legitimately recover text missing from DI.

## Relevant implementation

- `C:/Nik/clinqetinfrastructure/Services/Knowledge/KnowledgeTranscriptConservation.cs:49`: `Check`; global figure survival plus unordered unique-word coverage. `ContentWords` keeps only words of length four or greater.
- `C:/Nik/clinqetinfrastructure/Services/Knowledge/KnowledgeFigures.cs`: numeric matching; does not preserve semantic association with labels, units or signs.
- `C:/Nik/clinqetinfrastructure/Services/AI/VisionDocumentTranscriptionService.cs:105`: a cache hit is used before conservation checking.
- Same file, line 156: fresh transcript validation; line 174: accepted output is cached.
- `C:/Nik/clinqetshared/Models/VisionTranscriptionSettings.cs:61`: page-cache prompt fingerprint depends on prompt version/template, not the validation algorithm.
- `C:/Nik/clinqetcore/Models/Knowledge/KnowledgeBlobPaths.cs`: page-cache path.
- `C:/Nik/clinqetfuncations/Clinqet.Communications/Functions/KnowledgeIngestProcessorFunction.cs`: PDF transcription, artifact replay, chunk/card creation and embedding/indexing. The full artifact fingerprint includes assembly identities; that alone does not invalidate the independently keyed page cache.

Line numbers describe the checkout inspected and may move.

## Recommended correction

Validate protected facts in their local context: service-to-price relationships and sentence polarity first, with units/signs protected by the same design. Preserve legitimate HTML-to-Markdown conversion, row/column reading-order correction and source-supported OCR repairs. Comparing whole pages as bags of numbers/words cannot do this; a coverage threshold change or simply adding `not` to the token set is inadequate.

Use structure-aware alignment and targeted source-image verification where a discrepancy is ambiguous. Do not treat OCR as infallible or claim an extra AI reviewer proves correctness. Keep retries bounded and ensure unresolved discrepancies cannot silently become verified facts. Preserve the current image/figure and table-handling contracts.

Address cached transcripts in the same change: revalidate cache hits and/or version acceptance policy so old entries cannot bypass the corrected gate. Trace full extraction artifacts and already indexed documents too. A new validator does not repair previously indexed cards automatically; define a targeted re-ingestion approach, without assuming existing documents are corrupted.

A finite test set cannot guarantee less than 0.01% degradation across arbitrary future documents. Require no observed factual regressions in a representative, source-checked acceptance corpus; explicitly record the remaining uncertainty.

## Cleanup

Deleted all 16 test index card IDs and eight page-cache blobs. Verified `RemainingCards = 0` and `RemainingBlobs = 0` in the isolated test scope. No index schema, container or Cosmos data changes were made. The Azurite test container was disposed. Temporary source files, PDFs, renders, build outputs and logs were removed after compiling this report; unrelated working-tree changes were preserved.
