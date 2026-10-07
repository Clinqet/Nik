# Knowledge Flow Source Review

Date: 2026-09-03

Scope: existing knowledge upload, extraction, indexing, retrieval, caller sharing, and service-draft flows. The proposed URL/sitemap website crawler is excluded.

## Critical findings

### 1. Actual uploaded size is never enforced before the worker buffers the file

The API validates only the size claimed by the client:

- [KnowledgeController.cs (line 161)](C:/Nik/clinqetapi/Clinqet.API/Controllers/Knowledge/KnowledgeController.cs:161)
- [KnowledgeController.cs (line 345)](C:/Nik/clinqetapi/Clinqet.API/Controllers/Knowledge/KnowledgeController.cs:345)

The generated SAS does not restrict the uploaded byte count. Its content-type setting controls response metadata; it is not an upload enforcement rule:

- [AzureStorageService.cs (line 1573)](C:/Nik/clinqetinfrastructure/Services/Storage/AzureStorageService.cs:1573)

Confirmation checks only that the blob exists, without reading `ContentLength` or verifying that it matches the declared file:

- [AzureStorageService.cs (line 1720)](C:/Nik/clinqetinfrastructure/Services/Storage/AzureStorageService.cs:1720)

The ingestion function then copies the entire blob into memory:

- [KnowledgeIngestProcessorFunction.cs (line 472)](C:/Nik/clinqetfuncations/Clinqet.Communications/Functions/KnowledgeIngestProcessorFunction.cs:472)

With eight concurrent Service Bus sessions, multiple oversized blobs can create severe memory pressure or terminate the function host:

- [host.json (line 27)](C:/Nik/clinqetfuncations/Clinqet.Communications/host.json:27)

Required fix: perform a blob-properties check during confirmation, enforce actual `ContentLength`, verify expected content type/signature, and repeat a defensive bounded-size check in the worker before allocating the buffer.

### 2. Source blobs can accumulate without limit

Every upload URL gets a new unique blob path:

- [AzureStorageService.cs (line 1588)](C:/Nik/clinqetinfrastructure/Services/Storage/AzureStorageService.cs:1588)

Abandoned uploads never create a knowledge row and have no cleanup lifecycle. Current storage lifecycle rules clean `_sent` and `_ocr` paths but not source uploads:

- [storage.json (line 267)](C:/Nik/azureautomation/storage.json:267)

Replacement also switches the document row to the new blob without deleting or preserving the prior blob in a managed lifecycle:

- [KnowledgeManagementService.cs (line 114)](C:/Nik/clinqetinfrastructure/Services/Knowledge/KnowledgeManagementService.cs:114)

A provider can repeatedly request SAS URLs or replace one document, producing unlimited stored blobs without increasing the document count. Finding 1 makes the cost exposure substantially worse.

Required fix: add expiring pending-upload management and successful-replacement cleanup while retaining the previous source until the replacement is safely promoted. A new pending-upload document/field design would require explicit schema approval before implementation.

## High-severity findings

### 3. Multi-document confirmation is partially committing and not retry-safe

Confirmation processes documents sequentially:

- [KnowledgeManagementService.cs (line 107)](C:/Nik/clinqetinfrastructure/Services/Knowledge/KnowledgeManagementService.cs:107)

If item 3 fails after items 1 and 2 were created and queued, the whole request returns failure. Retrying then encounters the already-created document or a replacement already marked `Processing`, and stops before reaching the remaining items.

This can leave:

- Some documents ingesting successfully.
- One document stuck in `Processing`.
- Remaining blobs uploaded but unregistered.
- A client unable to safely repeat the same request.

Required fix: give confirmation explicit idempotent semantics for the same document/blob generation and return per-file outcomes. Re-enqueueing the same deterministic work must be harmless.

### 4. A failed replacement takes the previous valid document offline

A replacement immediately overwrites the active row's blob path and marks it `Processing`:

- [KnowledgeManagementService.cs (line 119)](C:/Nik/clinqetinfrastructure/Services/Knowledge/KnowledgeManagementService.cs:119)

The old cards remain retrievable while processing:

- [KnowledgeDocumentRepository.cs (line 260)](C:/Nik/clinqetinfrastructure/Data/COSMOS/KnowledgeDocumentRepository.cs:260)

But a terminal ingestion failure changes the shared row to `Failed`:

- [KnowledgeIngestProcessorFunction.cs (line 2284)](C:/Nik/clinqetfuncations/Clinqet.Communications/Functions/KnowledgeIngestProcessorFunction.cs:2284)

Failed rows are excluded from retrieval. Even failure paths that preserve the old cards therefore make those cards unreachable. The row has also lost its previous source-blob pointer.

Required fix: treat replacement as a staged version and promote it only after extraction and indexing succeed. The last-known-good version must remain active on failure. This likely requires a schema decision and approval.

### 5. FAQ edits can leave Cosmos and the search index serving different content

FAQ update writes the new question and answer to Cosmos first, then creates embeddings and changes the search index:

- [KnowledgeManagementService.cs (line 519)](C:/Nik/clinqetinfrastructure/Services/Knowledge/KnowledgeManagementService.cs:519)

If indexing fails, Cosmos contains the new FAQ while search still serves the old one. The health check compares only passage counts:

- [KnowledgeManagementService.cs (line 445)](C:/Nik/clinqetinfrastructure/Services/Knowledge/KnowledgeManagementService.cs:445)

Because old and new FAQs normally have the same card count, health can report success despite serving stale content.

Concurrent edits can also interleave because finalization rereads the current row and writes values derived from an older operation:

- [KnowledgeManagementService.cs (line 825)](C:/Nik/clinqetinfrastructure/Services/Knowledge/KnowledgeManagementService.cs:825)

Required fix: generation-bound indexing and conditional promotion, or a durable update operation/outbox. Count-only health must be supplemented with content-generation or hash parity.

### 6. Metadata changes can permanently drift after a queue-send failure

Metadata is committed to Cosmos before the ingestion message is sent:

- [KnowledgeManagementService.cs (line 548)](C:/Nik/clinqetinfrastructure/Services/Knowledge/KnowledgeManagementService.cs:548)

If queueing fails, the row remains `Ready`, so the stuck-processing alert path does not apply:

- [KnowledgeManagementService.cs (line 199)](C:/Nik/clinqetinfrastructure/Services/Knowledge/KnowledgeManagementService.cs:199)

Retrying the same metadata hits the "nothing changed" return and does not requeue. Index updates are paged, so later failures can also leave only some cards updated:

- [KnowledgeSearchIndexer.cs (line 298)](C:/Nik/clinqetinfrastructure/Services/Knowledge/KnowledgeSearchIndexer.cs:298)

Required fix: durable pending metadata generations plus a reconciler/outbox. The API should never consider metadata complete until all corresponding cards carry the same generation.

### 7. Draft approval can silently overwrite concurrent manual service edits

Approval loads a service, performs several potentially slow operations, and later saves the original mutated object:

- [KnowledgeDraftApprovalService.cs (line 430)](C:/Nik/clinqetinfrastructure/Services/Knowledge/KnowledgeDraftApprovalService.cs:430)

The service repository delegates to the generic replace implementation:

- [ServiceRepository.cs (line 78)](C:/Nik/clinqetinfrastructure/Data/COSMOS/ServiceRepository.cs:78)

That implementation rereads the current entity primarily to obtain its newest ETag, then replaces it using the caller's older object. Its retry repeats that pattern without merging current values:

- [CosmosDbRepository.cs (line 239)](C:/Nik/clinqetinfrastructure/Data/COSMOS/Base/CosmosDbRepository.cs:239)

A provider editing images, pricing, description, or service areas while AI approval is running can have those newer changes silently erased.

Required fix: use the ETag captured with the initially loaded service. On conflict, stop and return a conflict or reload and recompute the intended patch—never attach a fresh ETag to stale state.

### 8. Stale Edit/Dismiss requests can delete current draft images

Draft edit deletes an image blob before checking the row ETag:

- [KnowledgeDraftApprovalService.cs (line 252)](C:/Nik/clinqetinfrastructure/Services/Knowledge/KnowledgeDraftApprovalService.cs:252)

A stale edit can therefore fail its Cosmos replace while still deleting an image referenced by the current draft.

Dismiss has the same ordering problem: it deletes blobs before the row tombstone CAS succeeds:

- [KnowledgeDraftApprovalService.cs (line 725)](C:/Nik/clinqetinfrastructure/Services/Knowledge/KnowledgeDraftApprovalService.cs:725)

Required fix: commit the state transition first, then clean blobs through retryable post-commit cleanup. Destructive storage operations must not happen before concurrency ownership is established.

### 9. Draft approval is not durably coordinated with its secondary effects

For creation, the service is persisted first:

- [KnowledgeDraftApprovalService.cs (line 343)](C:/Nik/clinqetinfrastructure/Services/Knowledge/KnowledgeDraftApprovalService.cs:343)

Category selection, count refresh, image derivative dispatch, and onboarding progress happen afterward:

- [KnowledgeDraftApprovalService.cs (line 868)](C:/Nik/clinqetinfrastructure/Services/Knowledge/KnowledgeDraftApprovalService.cs:868)

Those failures are logged/alerted, but the draft can still be removed. There is no automatic recovery.

For updates, category selection changes can happen before the service write, while count refresh happens after it:

- [KnowledgeDraftApprovalService.cs (line 449)](C:/Nik/clinqetinfrastructure/Services/Knowledge/KnowledgeDraftApprovalService.cs:449)

Count repair only covers categories known to the current operation:

- [ProviderSetupServiceWriter.cs (line 383)](C:/Nik/clinqetinfrastructure/Services/AI/ProviderSetupServiceWriter.cs:383)

If the service category changed and the old-category refresh failed, a retry can no longer determine the original category from the current service.

Required fix: atomically commit same-partition state where possible, then durably record every required post-commit operation. A reconciler must repair derivatives, counts, onboarding and category selection before the draft is considered fully approved.

### 10. Uploaded knowledge is not explicitly treated as untrusted in the voice prompt

The voice prompt instructs the model to use knowledge results but does not say that uploaded document text is data and must never be followed as an instruction:

- [RealtimeSessionPayloadBuilder.cs (line 503)](C:/Nik/clinqetinfrastructure/Services/Voice/RealtimeSessionPayloadBuilder.cs:503)
- [KnowledgeTools.cs (line 77)](C:/Nik/clinqetmcp/Clinqet.Mcp/Tools/KnowledgeTools.cs:77)

Search-result sanitization removes control characters, not natural-language instructions:

- [ProviderKnowledgeSearchService.cs (line 773)](C:/Nik/clinqetinfrastructure/Services/Knowledge/ProviderKnowledgeSearchService.cs:773)

Business Search already has the correct explicit rule:

- [appsettings.json (line 2238)](C:/Nik/clinqetapi/Clinqet.API/appsettings.json:2238)

The extraction prompt also inserts raw document text without an equivalent trust-boundary instruction:

- [DocumentIntelligenceService.cs (line 794)](C:/Nik/clinqetinfrastructure/Services/AI/DocumentIntelligenceService.cs:794)

Human draft approval limits the extraction-side impact, but voice retrieval is directly exposed to indirect prompt injection.

Required fix: mark retrieved passages as untrusted quoted data in the system prompt and tool contract, delimit them clearly, and explicitly prohibit obeying instructions found inside them.

## Medium findings

### 11. Quota checks are race-prone

Document, FAQ and passage counts use read-then-create logic, so concurrent requests can exceed configured limits. See [KnowledgeController.cs (line 163)](C:/Nik/clinqetapi/Clinqet.API/Controllers/Knowledge/KnowledgeController.cs:163) and [KnowledgeManagementService.cs (line 457)](C:/Nik/clinqetinfrastructure/Services/Knowledge/KnowledgeManagementService.cs:457).

### 12. Request arrays are unbounded

Upload/confirmation DTOs have minimum lengths but no maximum; SAS generation starts one task per file. Draft batch IDs and description lines are similarly unbounded. See [KnowledgeDtos.cs (line 6)](C:/Nik/clinqetshared/DTOs/Knowledge/KnowledgeDtos.cs:6), [AzureStorageService.cs (line 1649)](C:/Nik/clinqetinfrastructure/Services/Storage/AzureStorageService.cs:1649), and [KnowledgeServiceDraftDtos.cs (line 102)](C:/Nik/clinqetshared/DTOs/Knowledge/KnowledgeServiceDraftDtos.cs:102).

### 13. XLSX merged cells are not expanded

Only explicit cells are read, so merged headers/categories do not propagate to covered rows. See [KnowledgeDocumentParser.OpenXml.cs (line 257)](C:/Nik/clinqetinfrastructure/Services/Knowledge/KnowledgeDocumentParser.OpenXml.cs:257).

### 14. XLSX formulas without cached values can leak formula source text

`Cell.InnerText` is used as a fallback even though the parser says it should never ingest formula strings. See [KnowledgeDocumentParser.OpenXml.cs (line 455)](C:/Nik/clinqetinfrastructure/Services/Knowledge/KnowledgeDocumentParser.OpenXml.cs:455).

### 15. DOCX coverage is incomplete

Parsing is limited primarily to the main document body. Headers, footers, footnotes and endnotes can contain important contact or policy information. Legacy VML images are also missed, and heading inheritance does not traverse `BasedOn` style chains. See [KnowledgeDocumentParser.OpenXml.cs (line 13)](C:/Nik/clinqetinfrastructure/Services/Knowledge/KnowledgeDocumentParser.OpenXml.cs:13) and [KnowledgeDocumentParser.OpenXml.cs (line 153)](C:/Nik/clinqetinfrastructure/Services/Knowledge/KnowledgeDocumentParser.OpenXml.cs:153).

### 16. PPTX reading order and native graphics are incomplete

Shapes are consumed in XML order rather than reliable visual order. Tables are handled, but chart and SmartArt `GraphicFrame` content is omitted. See [KnowledgeDocumentParser.Pptx.cs (line 123)](C:/Nik/clinqetinfrastructure/Services/Knowledge/KnowledgeDocumentParser.Pptx.cs:123).

### 17. JPEG metadata stripping is incomplete

Clean, small JPEGs can be accepted byte-for-byte, while the metadata detector does not inspect JPEG COM markers. This conflicts with the stated guarantee that metadata is stripped. See [KnowledgeImageNormalizer.cs (line 49)](C:/Nik/clinqetinfrastructure/Services/Knowledge/KnowledgeImageNormalizer.cs:49) and [KnowledgeImageNormalizer.cs (line 136)](C:/Nik/clinqetinfrastructure/Services/Knowledge/KnowledgeImageNormalizer.cs:136).

### 18. Uploaded HTML data-URI images bypass source-image limits before decoding

Base64 is decoded directly without checking decoded length against `MaxSourceImageBytes`, allowing a large avoidable allocation. See [KnowledgeDocumentParser.cs (line 981)](C:/Nik/clinqetinfrastructure/Services/Knowledge/KnowledgeDocumentParser.cs:981).

### 19. Caller material-send limits are not atomic

The code checks marker count, enqueues the email, then writes the marker. Concurrent calls can pass the same limit, and marker failure intentionally undercounts an already-sent message. See [KnowledgeTools.cs (line 144)](C:/Nik/clinqetmcp/Clinqet.Mcp/Tools/KnowledgeTools.cs:144) and [KnowledgeTools.cs (line 337)](C:/Nik/clinqetmcp/Clinqet.Mcp/Tools/KnowledgeTools.cs:337).

### 20. Index health is count-only

It cannot detect stale FAQ contents, partially applied metadata, wrong embeddings with valid dimensions, or mixed generations. See [KnowledgeManagementService.cs (line 445)](C:/Nik/clinqetinfrastructure/Services/Knowledge/KnowledgeManagementService.cs:445).

## Lower-severity findings

### 21. Business Search can return images belonging to results removed by the text-size cap

Citations are trimmed to retained results, but images are collected earlier and not filtered the same way. See [SearchKnowledgeTool.cs (line 104)](C:/Nik/clinqetinfrastructure/Services/BusinessSearch/Tools/SearchKnowledgeTool.cs:104).

### 22. Role-audience keys are not validated against the role catalog

Unknown or mistyped keys fail closed, which is secure, but can silently make a document invisible while the UI still reports role-restricted sharing. See [KnowledgeManagementService.cs (line 613)](C:/Nik/clinqetinfrastructure/Services/Knowledge/KnowledgeManagementService.cs:613).
