# P4-J — Performance, cost, resource safety and thread safety of the AI Knowledge pipeline

Auditor J, read-only closing audit, 2026-09-25. Code audited as it is NOW (clinqetapi and clinqetinfrastructure
working trees clean at `2e47eca` / `89035c3`). No build, no test, no git write was run.

---

## 1. Scope actually read

**Read end to end**

| File | Lines |
|---|---|
| `clinqetfuncations\Clinqet.Communications\Functions\KnowledgeIngestProcessorFunction.cs` | 3,730 |
| `clinqetinfrastructure\Services\Knowledge\ProviderKnowledgeSearchService.cs` | 1,267 |
| `clinqetinfrastructure\Services\Knowledge\ProviderKnowledgeSearchService.Provider.cs` | 391 |
| `clinqetinfrastructure\Services\Knowledge\KnowledgeManagementService.cs` | 1,316 |
| `clinqetinfrastructure\Services\Knowledge\KnowledgeSpaceReservation.cs` | 128 |
| `clinqetapi\Clinqet.API\Controllers\Knowledge\KnowledgeController.cs` | 1,264 |
| `clinqetinfrastructure\Services\Knowledge\KnowledgeSearchIndexer.cs` | 571 |
| `clinqetinfrastructure\Services\Search\AiCache\SearchAiCacheStore.cs` | 444 |
| `clinqetinfrastructure\Services\Search\AiCache\SearchAiCacheWriteLock.cs` | 225 |
| `clinqetinfrastructure\Services\Search\AiCache\SearchAiCacheBlobFormat.cs` | 120 |
| `clinqetinfrastructure\Data\COSMOS\KnowledgeDocumentRepository.cs` | 719 |
| `clinqetinfrastructure\Data\COSMOS\KnowledgeServiceDraftRepository.cs` | 424 |
| `clinqetinfrastructure\Data\COSMOS\KnowledgeDecidedRowsRepository.cs` | 146 |
| `clinqetinfrastructure\Services\Knowledge\KnowledgeDocumentDataPurger.cs` | 181 |
| `clinqetfuncations\Clinqet.Communications\Functions\KnowledgeMaintenanceFunction.cs` | 173 |
| `clinqetinfrastructure\Services\Knowledge\KnowledgeOrphanUploadSweeper.cs` | 113 |
| `clinqetinfrastructure\Services\Knowledge\KnowledgeContentArtifactStore.cs` | 160 |
| `clinqetinfrastructure\Services\Knowledge\KnowledgeExtractionCache.cs` | 135 |
| `clinqetinfrastructure\Services\Knowledge\KnowledgeIngestQueue.cs` | 111 |
| `clinqetinfrastructure\Services\Knowledge\KnowledgeImageNormalizer.cs` | 250 |
| `clinqetinfrastructure\Services\Knowledge\KnowledgeServiceDraftCleaner.cs` | 89 |
| `clinqetinfrastructure\Services\Knowledge\ReceptionistAvailability.cs`, `HiddenTextStyles.cs` | 32 + 88 |
| `clinqetfuncations\Clinqet.Communications\Services\KnowledgeDocumentDescriber.cs`, `KnowledgeSummaryFactCheck.cs` | 216 + 86 |
| `clinqetinfrastructure\Services\AI\DocumentPageRasterizer.cs` | 204 |
| `clinqetinfrastructure\Services\BusinessSearch\BusinessAlphabetService.cs` | 192 |
| `clinqetinfrastructure\Services\Search\Topology\SearchCellDirectory.cs` | 170 |
| `clinqetshared\Models\VoiceKnowledgeSettings.cs`, `VisionTranscriptionSettings.cs` (1-125) | 534 + 125 |
| `clinqetshared\DTOs\Messages\KnowledgeIngestQueueMessage.cs`, `clinqetcore\Models\Search\SearchAiCacheArtifacts.cs` (70-113) | 57 + 44 |
| `clinqetfuncations\Clinqet.Communications\host.json` | 38 |

**Read in part (the hot sections only — said honestly)**

- `KnowledgeServiceDraftAnalyticsJob.cs` (1,585): 160-980, 1440-1475 read; image-fetch and reconcile tails skimmed via grep.
- `KnowledgeDraftApprovalService.cs` (1,745): 1-200, 740-1170 read; approve internals (200-740) and DTO tails not read.
- `VisionDocumentTranscriptionService.cs` (861): 1-480 and 817-861 read; the adjudication tail 480-816 not read.
- `DocumentTranscriptionVerifier.cs` (242): 55-145 read.
- `KnowledgeImageExtractor.cs` (606): 40-240 and 380-605 read.
- `AzureAIFoundryEmbeddingService.cs` (840): 30-330 read, retry/coalesce internals via grep.
- `FullProviderContextService.cs`: 85-312 read. `SearchKnowledgeTool.cs`: 270-420 read. `KnowledgeTools.cs` (MCP): 100-190 read.
- `DocumentIntelligenceService.cs`: 470-540 read. `AzureStorageService.cs`: 490-550 read.
- `CosmosContainerPolicies.KnowledgeBase` (785-824), `KnowledgeSearchVisibility.cs` (whole), `KnowledgeBlobPaths.cs` (1-160).
- Partner web `knowledgeMeta.js` 145-205 (poll ladders). DI lifetimes in the three `Program.cs` files via grep.
- **Not read:** `KnowledgeChunker.cs`, `KnowledgeDocumentParser*.cs` (except the DOM/streaming grep), `KnowledgeInventoryBuilder.cs`,
  `KnowledgeServiceCandidateDetector.cs` (except `ComputeRowHash`), `KnowledgeDraftImageMatcher.cs`, `AiBudgetGovernor.cs`,
  the mobile apps.

---

## 2. Findings

Severity per the brief. Confidence: H = certain from code; M = certain from code, magnitude needs measurement.
Counts: **High 2 · Medium 9 · Low 10 · Improvement 2** (23). Each row is detailed below with quoted evidence.

| Id | Sev | Title | Main file:line | Violates | Conf |
|---|---|---|---|---|---|
| P4-J-01 | High | Space reservation not wired to the upload gate (known owner item) | `KnowledgeController.cs:195-196`; `KnowledgeManagementService.cs:654-672` | reservation decision 2026-09-18 | H |
| P4-J-02 | High | Orphan-upload sweep stops at the first 2,000 old blobs, no continuation | `AzureStorageService.cs:519-531`; `VoiceKnowledgeSettings.cs:252-254` | E9 (owner 2026-09-13) | H |
| P4-J-03 | Medium | Per-document AI allowance re-granted on redelivery, reset by scheduled retry | `KnowledgeIngestQueue.cs:63-72`; ingest `:279-282` | E12 | H |
| P4-J-04 | Medium | "8 paid checks per document" enforced per pass | `VisionDocumentTranscriptionService.cs:117` | setting contract `VisionTranscriptionSettings.cs:86-87` | H |
| P4-J-05 | Medium | Two full registry sweeps per phone search; "≤220 rows" stale; >500 docs drops F6 filter | `ProviderKnowledgeSearchService.cs:128-140`; `KnowledgeDocumentRepository.cs:172, 234-246` | F6, doc-cap removal | H/M |
| P4-J-06 | Medium | 5xx/408/timeout on a card page isolated into ≤500 single uploads | `KnowledgeSearchIndexer.cs:258-290` | D-27 reasoning | H |
| P4-J-07 | Medium | Alphabet cache invalidated per-process, before the cards exist, never on upload/ingest/MCP | `KnowledgeController.cs:44-47, 464, 492`; `BusinessAlphabetService.cs:88-92` | controller's own requirement | H |
| P4-J-08 | Medium | Artefact/page caches keyed on whole-assembly MVIDs; "embeddings only" false after any deploy | ingest `:87-93, 528-529`; `VisionDocumentTranscriptionService.cs:45-49` | cost claims | H/M |
| P4-J-09 | Medium | Analytics re-derive buffers the source blob unbounded (MemoryStream + ToArray) | `KnowledgeServiceDraftAnalyticsJob.cs:391-397` | E9 worker-bound rule | H |
| P4-J-10 | Medium | Per-document memory ceilings × 8 sessions, no process admission | `VoiceKnowledgeSettings.cs:73-79`; `host.json` | resource safety | M |
| P4-J-21 | Medium | ForceFresh dropped by continuations ⇒ EX-06 caption re-describe lost on long documents | `KnowledgeIngestQueue.cs:94-104`; ingest `:2061` | EX-06 | H |
| P4-J-11 | Low | Source bytes hoisted for the whole run; release comment overstates | ingest `:599, 895-898, 1577` | E9 (comment) | H |
| P4-J-12 | Low | Picture-text DI call uncached; "reprocess is free" false | ingest `:2715-2729`; settings `:305-306` | R-6 cost claim | H |
| P4-J-13 | Low | Knowledge AI cache write-only on ingest; header ContentHash/PipelineFingerprint never set | `KnowledgeSearchIndexer.cs:182-199` | topology §5.6.2, S2 | H |
| P4-J-14 | Low | Lookup cap refuses answers but not spend | MCP `KnowledgeTools.cs:137-155` | cap purpose `CatalogLookupAllowance.cs:9-10` | H |
| P4-J-15 | Low | All pages re-rendered before the page-cache check; 2 storage calls per cached page | `VisionDocumentTranscriptionService.cs:80-83, 817-826` | cost | H |
| P4-J-16 | Low | Weighted cache Size (1..64) vs §14 "Size = 1" | `FullProviderContextService.cs:123-129` | CLAUDE.md §14 (letter) | H |
| P4-J-17 | Low | DI crops fetched serially for every unmatched figure before the cap | `KnowledgeImageExtractor.cs:124-143` | perf | H/M |
| P4-J-18 | Low | Polled list: same profile read twice + L point reads; stale poll comments | `KnowledgeController.cs:101-117` | cost | H |
| P4-J-20 | Low | Long synchronous draft sweeps; decided-rows rewrite per approval | `KnowledgeDraftApprovalService.cs:999-1022, 451` | cost | H |
| P4-J-23 | Low | Caption-reuse map lists the whole registry per ingest | ingest `:2815-2840` | cost | H |
| P4-J-19 | Improvement | `/docType/?` and `/updatedAt/?` indexed, never queried | `CosmosContainerPolicies.cs:794, 799` | §0.11 (change needs §0.7 approval) | H |
| P4-J-22 | Improvement | Deletion runs the full purge twice | `KnowledgeDocumentDataPurger.cs:130-153` | cost | H |

### P4-J-01 · **High** · The space RESERVATION is not wired to any upload gate — its cost protection does not exist

- **Where:** `KnowledgeController.cs:195-196`; `KnowledgeManagementService.cs:654-672`; `KnowledgeSpaceReservation.cs:9-17`;
  `VoiceKnowledgeSettings.cs:22-31`; `VoiceKnowledgeSettingsConventionTests.cs:47-49`.
- **Evidence:** the only upload gate is still the old one:
  `var (usedPassages, maxPassages) = await _knowledgeService.GetPassageUsageAsync(businessId);` /
  `if (usedPassages >= maxPassages)` (`KnowledgeController.cs:195-196`). `GetSpaceBudgetAsync` has **no caller** in any
  host (grep over `clinqetapi`, `clinqetfuncations`, `clinqetmcp`, `clinqetinfrastructure`; `git log -S GetSpaceBudgetAsync`
  in `clinqetapi` is empty). The class says what is missing: *"ten files dropped back to back all got upload links, the
  queue paid to read every one, and every file after the cap failed"* (`KnowledgeSpaceReservation.cs:10-12`). The
  settings say *"Read by the API upload gate only"* (`VoiceKnowledgeSettings.cs:27-28`) and the Functions convention test
  asserts the keys are read by *"clinqetapi upload gate (KnowledgeSpaceReservation via KnowledgeManagementService)"*
  (`VoiceKnowledgeSettingsConventionTests.cs:47-49`) — both false today.
- **Violates:** the approved 2026-09-18 reservation decision. Already listed as an open OWNER ITEM in
  `Data\search-topology\findings\PHASE-3-BUILD-STATE-2026-09-23.md:357-359` — **not a new discovery**, re-stated because it
  is the code as it is now and because two artefacts (settings comment, convention test) claim the opposite.
- **Failure scenario:** a business at 1,990/2,000 parts drops ten 300-part price lists. All ten get SAS links and are
  uploaded. The pickup gate (`RefuseWhenSpaceIsFullAsync`, ingest `:3335-3351`) admits the first (others 1,990 < 2,000),
  which is then read IN FULL — DI, vision pages, captions, describe — and refused only at the overflow gate
  (`:1091-1107`: 1,990 + 300 = 2,290 > grace 2,200). The other nine are refused at pickup, but only after the provider
  has uploaded them and been told nothing at the upload screen. The reservation exists to refuse all of that before the
  first byte is sent.
- **Fix direction:** call `GetSpaceBudgetAsync` from `GenerateUploadSasUrls`. When wired, note its cost: it adds a full
  `SELECT *` partition list (`KnowledgeManagementService.cs:657`) per SAS mint — project only `docId, docName,
  pendingDocName, pendingBlobPath, status, sourceKind, passageCount, createdAt, processingSince, updatedAt, id`.
- **Confidence:** H.

### P4-J-02 · **High** · The unconfirmed-upload sweep can never reach most of the container (E9 cleanup ineffective at scale)

- **Where:** `KnowledgeOrphanUploadSweeper.cs:49-50`; `AzureStorageService.cs:519-531`; `VoiceKnowledgeSettings.cs:252-254`;
  `KnowledgeBlobPaths.cs:87-101, 137-141`; `KnowledgeMaintenanceFunction.cs:65-72`.
- **Evidence:** the sweep lists the whole container flat, from the first name, every night:
  `_storage.ListBlobNamesOlderThanAsync(container, prefix: string.Empty, olderThan, Math.Max(1, _settings.UnconfirmedUploadSweepMaxBlobs), ...)`;
  the lister stops at the first 2,000 **old blobs of any kind**: `names.Add(blob.Name); if (names.Count >= maxResults) break;`
  (`AzureStorageService.cs:528-529`). No continuation token is stored anywhere. Yet the setting says
  *"the next run continues where this one stopped looking"* (`VoiceKnowledgeSettings.cs:252-253`) — false.
  The container holds, besides source uploads, every document's `_images/`, `_artifacts/`, `_di/`, `ai-cache/`, draft
  images, and the flat `_ocr/{businessId}/…/p001.json` page cache (one blob per page per document) — none of which the
  sweeper ever deletes, so the same first 2,000 names are re-examined forever. No alert fires when the ceiling is hit
  (`KnowledgeMaintenanceFunction.cs:65` reports only `result.Failed > 0`).
- **Violates:** E9 (owner-approved 2026-09-13) "uploads nobody ever confirmed … deleted by nothing".
- **Failure scenario:** whatever sorts first — the businesses whose ids come first (≈7 businesses at 20 docs × ~14
  permanent blobs) and/or the top-level `_ocr/`/`_previous/` trees, depending on where `_` sorts against the ids — fills
  the 2,000 slots with blobs the sweeper correctly never deletes (`ParseSourceBlob` rejects `_`-led and `ai-cache`
  segments). From that night on, an abandoned upload of any business sorting later is never examined and is kept (and
  billed) indefinitely. The walk is also rebuilt from the first name each night, so the listing cost does not shrink.
- **Fix direction:** list by the source layout only (`{businessId}/{docId}/` — e.g. hierarchical listing with delimiter
  `/` per business, skipping `_`-prefixed and `ai-cache` segments), persist a continuation marker (e.g. in SystemData or
  a blob) between runs, and alert when a run ends on its ceiling.
- **Confidence:** H.

### P4-J-03 · **Medium** · The per-document AI allowance (E12) is re-granted on redelivery and RESET on every scheduled retry

- **Where:** `KnowledgeIngestQueue.cs:63-72` vs `:94-104`; ingest `:279-282`, `:346-348`; `KnowledgeIngestQueueMessage.cs:19-21, 50-55`.
- **Evidence:** the retry message carries only the attempt:
  `new KnowledgeIngestQueueMessage { BusinessId = businessId, DocId = docId, Mode = mode, ForceFresh = forceFresh, Attempt = attempt }`
  (`KnowledgeIngestQueue.cs:65`) — no `AiAttemptsSpent`, `Continuation` or `PagesBankedSoFar`, unlike the continuation
  (`:96-104`). The allowance is recomputed from the message:
  `var documentAllowance = Math.Max(0, _settings.AiAttemptBudgetPerDocument - Math.Max(0, payload.AiAttemptsSpent));` and
  each **delivery** gets `Math.Min(documentAllowance, AiAttemptBudgetPerDocument / MaxDeliveryCount)` (ingest `:279-282`),
  so a redelivered continuation re-receives the same carried allowance. The message's own doc claims this bound
  *"caps total spend per document"* (`KnowledgeIngestQueueMessage.cs:50-55`). Also stale: `Attempt` is documented
  *"Analytics only … Ignored by every other mode"* (`:19-21`) while `ShouldRetryLater` drives every ingest retry from it (ingest `:441-450`).
- **Failure scenario:** a 100-page scan spends 5,000 attempts over three continuation passes; pass 4 hits a DI/5xx
  "no evidence about the file" failure ⇒ `EnqueueRetryAsync(..., payload.Attempt + 1, ...)` ⇒ the retry starts at
  `AiAttemptsSpent = 0`, `Continuation = 0`, `PagesBankedSoFar = 0` ⇒ a fresh 6,000 attempts and 8 more passes. With
  `IngestRetryAttempts = 5` the stated per-document ceiling can be exceeded several-fold (each retry chain is itself
  bounded at 6,000 plus failed-delivery re-grants).
- **Fix direction:** carry `AiAttemptsSpent` (+ this delivery's `Spent`), `Continuation`, `PagesBankedSoFar` on the retry;
  slice per delivery as `allowance ÷ remaining deliveries`; correct the `Attempt` comment.
- **Confidence:** H (mechanism); worst-case magnitude depends on failure patterns.

### P4-J-04 · **Medium** · "At most 8 pages of one document reach a paid check" is enforced per PASS, not per document

- **Where:** `VisionDocumentTranscriptionService.cs:117, 214-217`; `VisionTranscriptionSettings.cs:86-87`; ingest `:2731-2742`.
- **Evidence:** `var verificationsLeft = Math.Max(0, settings.MaxVerifiedPagesPerDocument);` is a local of each
  `TranscribeWithVisionAsync` call; the setting reads *"at most this many pages of one document reach a paid check"*.
  Every E12 continuation pass, every redelivery, and every picture transcription (`TranscribePictureTextAsync` builds its
  own `VisionDocumentRequest`) starts a fresh 8.
- **Failure scenario:** a 100-page scan read in 3 passes, with disputed pages spread through it, buys up to 24 Sol
  (High reasoning, 8,000-token, 2,048-px) source checks instead of 8; theoretical ceiling 8 × (1 + MaxReadingContinuations 8) = 72 per document, plus 5 for text pictures.
- **Fix direction:** carry "verifications spent" on the continuation message (the same way `AiAttemptsSpent` rides it) or
  rename the setting to per-pass and re-derive the cost claim.
- **Confidence:** H.

### P4-J-05 · **Medium** · Every phone knowledge search sweeps the whole registry partition TWICE; the "≤220 rows" bound is gone

- **Where:** `ProviderKnowledgeSearchService.cs:128-132, 140`; `KnowledgeDocumentRepository.cs:170-177, 234-246`;
  `ProviderKnowledgeSearchService.Provider.cs:20-21`; `ProviderKnowledgeSearchService.cs:997-1008`; `VoiceKnowledgeSettings.cs:13-17`;
  MCP `KnowledgeTools.cs:150`.
- **Evidence:** per `search_knowledge` call the service starts
  `ReadSendableImageRefsSafeAsync(businessId, deadline.Token)` **and** `ReadReceptionistGatesAsync(businessId, deadline.Token)`
  (`IncludeRefs = _knowledgeSettings.MaterialSharingEnabled`, default true). The gates query is
  `SELECT c.docId, c.status, c.receptionistAccess, c.cardsRewriting, c.passageCount FROM c WHERE c.type = @type` (every
  file and FAQ row); the image-ref query loads every Ready file row again to run `ARRAY(SELECT VALUE i.imageId FROM i IN c.images …)`.
  Only `type/status/sourceKind` are indexed (`CosmosContainerPolicies.cs:791-804`), so `receptionistAccess`,
  `cardsRewriting`, `passageCount` and the images array are evaluated on loaded documents — and a row carries its whole
  image registry (captions, paths, hashes; `KnowledgeDocument.cs:174-232`). The comments still promise
  *"≤220 three-field rows per voice search"* (`KnowledgeDocumentRepository.cs:172`) and
  *"~220 ids at the shipped caps (20 documents + 200 FAQs)"* (`…Provider.cs:20`), but *"THERE IS NO MaxDocumentsPerBusiness"*
  (`VoiceKnowledgeSettings.cs:13`). Past 500 answerable documents the F6 allow-list silently leaves the filter:
  `if (answerableDocIds.Count == 0 || answerableDocIds.Count > MaxDocIdsInFilter) … return filter;` (`:999-1007`).
- **Failure scenario:** a business with 60 picture-heavy documents (~40 images × ~1 KB each) and 200 FAQs: each phone
  question loads ~2.4 MB + ~0.2 MB of FAQ rows, then the ~2.4 MB of Ready file rows again — per search, on the live
  path; a send (`GetByRefsAsync`, `:322`) adds a third gates sweep. RU grows linearly with the business.
- **Fix direction:** fold the sendable-image `ARRAY(...)` projection (and `sourceKind`) into the gates query so one sweep
  yields both sets; memoize the gates for the call (or a few seconds) the way Business Search memoizes visibility per
  request; correct the three comments. NEEDS-LIVE-PROOF for the RU number (query metrics `RetrievedDocumentSize` settle it).
- **Confidence:** H (two sweeps, unbounded rows); M (RU magnitude).

### P4-J-06 · **Medium** · A 5xx/408/timeout on a card page is "isolated" into up to 500 single-card uploads

- **Where:** `KnowledgeSearchIndexer.cs:258-279, 287-290`; `SearchServiceStatusClassifier.cs:12, 17-20`.
- **Evidence:** `catch (Exception batchEx) when (page.Count > 1 && IsIsolatable(batchEx))` then
  `foreach (var card in page) { … await UploadBatchAsync(businessId, new[] { card }, …) }`; `IsIsolatable` excludes only
  cancellation, capacity pressure and 413, and `IsCapacityPressure(int status) => status == 429;` — while the same
  classifier documents *"503/5xx/408 = service under load"*. D-27's own reasoning (*"isolating re-sends every card into a
  service that is out of room, turning one rejection into N"*, `:282-283`) is applied to 429 only.
- **Failure scenario:** the private index answers a 500-card page with 503 after the SDK's retries ⇒ 500 singleton
  uploads, each with the SDK's own retries, against a service already under load, inside the 30-minute ingest deadline;
  a 207 with per-document 503s (thrown as `InvalidOperationException`, `:303-308`) is isolated the same way.
- **Fix direction:** isolate per card only for per-document 4xx validation failures; treat batch-level 5xx/408/transport
  failures like 429 (fail the page, let the message retry with its backoff).
- **Confidence:** H.

### P4-J-07 · **Medium** · The alphabet cache is invalidated in the wrong host at the wrong moment

- **Where:** `KnowledgeController.cs:44-47, 464, 492, 955, 1011, 1052`; `ConfirmUploads` `:342-414`;
  `BusinessAlphabetService.cs:88-92, 109-123`; `BusinessSearchController.cs:386`.
- **Evidence:** the controller states the requirement — *"Every mutation below changes what the business has written, so
  a stale set means the first Gujarati FAQ is 'not found' until the cache happens to expire"* — but `Invalidate` is only
  `_cache.Remove(CacheKey(businessId))` on the **local** `IMemoryCache` of the one API instance that served the request.
  It is never called on `ConfirmUploads` (a new document), never by the Functions ingest when the cards actually land,
  and never in the MCP host. On Reprocess it runs at enqueue time (`:492`), before the new cards exist, and the next
  Ask-Clinket question re-caches the pre-ingest set for `CacheMinutes = 30` (`BusinessAlphabetService.cs:109-111`).
- **Failure scenario:** a provider uploads their first Gujarati price list; it reads Ready 2 minutes later; for up to
  30 minutes Ask Clinket (and the phone, via the 5-minute provider context on top) plans no Gujarati leg, so a question
  in Gujarati script finds nothing and is answered "the owner will confirm".
- **Fix direction:** invalidate where the cards change (the ingest Ready commit and the FAQ writer) and make the signal
  reach every host (a short TTL while any row is Processing, or a per-business version the facet cache is keyed on —
  the latter is a §0.7 schema ask).
- **Confidence:** H.

### P4-J-08 · **Medium** · "A re-read costs embeddings only" holds only until the next deploy of three whole assemblies

- **Where:** ingest `:87-93, 99-100, 527-529, 682-684`; `KnowledgeContentArtifact.cs:85-91`; `VisionDocumentTranscriptionService.cs:45-49`.
- **Evidence:** the artefact key is `KnowledgeContentArtifact.Fingerprint(typeof(KnowledgeIngestProcessorFunction), typeof(KnowledgeChunker), typeof(KnowledgeContentArtifact))`
  = the `ModuleVersionId` of `Clinqet.Communications`, `Clinqet.Infrastructure` and `Clinqet.Core`; the page-cache policy
  adds `typeof(VisionDocumentTranscriptionService).Assembly.ManifestModule.ModuleVersionId`. Any change to any file in
  those three assemblies (a cart fix) changes every key. The code promises *"with the content artefact enabled it costs
  embeddings only"* (`:528-529`) and *"This is what makes a retry, a Try-again and an admin reindex cheap"* (`:683`).
  DI (extraction cache keyed on bytes + model + format) and captions (business map keyed on hashes) do survive a deploy.
- **Failure scenario:** after any deploy, a details edit that needs a re-cut, a Try-again or a reprocess of a 20-page scan
  re-buys 20–40 vision transcriptions, up to 8 source checks and a describe call. If a deploy lands between two E12
  passes, pass 2 re-reads pass-1 pages as misses; if it banks no more pages than pass 1 did, `ShouldCarryOnReading`
  (`:3282-3288`) stops the document for good at the degraded reading (UNCERTAIN — a race on throughput).
- **Fix direction:** owner decision — either key on the pipeline's own identity (a dedicated small assembly or a
  generated hash of the parser/chunker/adjudication sources) or keep the MVIDs and correct the cost claims.
- **Confidence:** H (mechanism); M (frequency = deploy cadence × re-reads).

### P4-J-09 · **Medium** · The analytics re-derive path buffers the source blob unbounded, twice

- **Where:** `KnowledgeServiceDraftAnalyticsJob.cs:391-397`; compare ingest `:569-583, 595-609`; `VoiceKnowledgeSettings.cs:217-220`;
  `clinqetcore\Models\Storage\StorageConfiguration.cs:73` (`UploadSasExpiryMinutes = 15`).
- **Evidence:** `await using (var blobStream = await _storageService.GetBlobStreamAsync(…)) using (var buffer = new MemoryStream()) { await blobStream.CopyToAsync(buffer, cancellationToken); blobBytes = buffer.ToArray(); }`
  — no size probe, no `MaxFileSizeBytes`, growing buffer + copy. The ingest refuses exactly this: *"a blob overwritten
  after confirmation … would otherwise be copied into memory whole and take the host down"* (`:569-573`). Re-derive is
  the NORMAL path for any document whose compressed artefact exceeded `ContentArtifactMaxBytes` (`:217-220`).
- **Failure scenario:** a member with `voice.settings.manage` re-PUTs 3 GB to their own source blob inside the 15-minute
  write-SAS window after the ingest measured 30 MB; the analytics ticket (or Re-run) re-derives and the worker OOMs,
  taking every in-flight session with it. Benign case: a 30 MB file costs ~60 MB peak instead of 30.
- **Fix direction:** reuse the ingest's pattern — `GetBlobSizeAsync`, refuse above `MaxFileSizeBytes`, exact-size array,
  one-byte overflow probe.
- **Confidence:** H.

### P4-J-10 · **Medium (NEEDS-LIVE-PROOF)** · Ceilings are per document; nothing bounds the process with 8 sessions in flight

- **Where:** `VoiceKnowledgeSettings.cs:73-79, 352-356`; `host.json` `maxConcurrentSessions: 8`; ingest `:599`;
  `DocumentPageRasterizer.cs:120-137`; `KnowledgeImageExtractor.cs:121-175`; `KnowledgeSearchIndexer.cs:191-196`.
- **Evidence:** the OpenXML gate *"caps the DOM near 1 GB instead of several"* (`:78`) and parsing is DOM
  (`worksheetPart.Worksheet.Descendants<Row>()`, `KnowledgeDocumentParser.OpenXml.cs:881`); the source (≤30 MB) is held
  for the whole run (P4-J-11); `RasterizePdf` renders every page to JPEG up front and the list lives through the whole
  transcription; the PDF binder materialises every native raster and every DI crop before the 40-picture cap, and
  `MaxTotalMediaBytes` is enforced only in the Office/HTML parser (`KnowledgeDocumentParser.cs:38`); the AI-cache write
  copies every vector (`artifact.Vectors.Add(card.ContentVector!.ToArray())`) and builds the whole blob in one array
  (`SearchAiCacheBlobFormat.cs:38`, ~27 MB for a 2,200-card document) while the cards still hold theirs.
- **Failure scenario:** 8 businesses upload max-size spreadsheets at once ⇒ up to ~8 GB of DOM by the code's own
  estimate on an instance the binder comment calls *"a 4 GB Functions instance shared with every other message"*
  (`KnowledgeImageExtractor.cs:573-576`).
- **Fix direction:** a host-wide admission gate for heavy parses (sized by memory, not by session count), a
  document-level media byte cap in the PDF binder, lazy per-page rasterisation. Settle with a load test of 8 × max
  documents on the production SKU.
- **Confidence:** M.

### P4-J-11 · Low · The source file stays reachable for the whole run; the release comment overstates

- **Where:** ingest `:599, 603, 737, 754, 895-898, 910, 1577`.
- **Evidence:** `var blobBytes = new byte[measuredSize];` is used after awaits (`:603`, `:737`, the `:754` catch filter),
  so it is hoisted into the async state machine and lives until `ProcessAsync` returns — through the embed requests, the
  index upload, the 15 s visibility poll and the commits. The comment at `:896-898` says the payload trim stops *"every
  source array"* staying reachable; for a standalone picture upload `Images = [new KnowledgeExtractedImage { … Bytes = blobBytes … }]`
  (`:1577`) is the same array, so `WithoutImagePayloads()` releases nothing.
- **Fix direction:** scope the buffer to the extraction step (a helper method returning the extraction) and null it.
- **Confidence:** H (Roslyn hoisting); a heap snapshot during the embed phase would show it.

### P4-J-12 · Low · Picture-text transcription re-buys Document Intelligence on every fresh image-lane run

- **Where:** ingest `:2713-2729`; `VoiceKnowledgeSettings.cs:301-308`; `DocumentIntelligenceService.cs:480-503`.
- **Evidence:** *"Cached on the image's own content hash, so a reprocess of the same picture costs nothing"* (`:2715-2716`)
  and *"Each one costs one DI call and one vision call, cached on the picture's own bytes, so a reprocess is free"*
  (settings `:305-306`); but `_documentIntelligence.ExtractRawTextFromBytesAsync(normalized.Bytes, …)` (`:2728-2729`) has
  no cache — only the vision half is page-cached.
- **Failure scenario:** every non-replayed run of a Word file with 5 photographed price lists pays 5 DI analyses again.
- **Fix direction:** route through `IKnowledgeExtractionCache` keyed on the image hash, or correct both comments.
- **Confidence:** H.

### P4-J-13 · Low · The knowledge AI cache is write-only on the ingest path and omits its own document-level header

- **Where:** `KnowledgeSearchIndexer.cs:182-199`; `SearchAiCacheArtifacts.cs:84-91`; ingest `:1115`;
  `Data\search-topology\PLAN.md` §5.6.2 table, §5.6.5 row "Index write fails AFTER the artifact write", S2 (`:596`, `:643`).
- **Evidence:** `BuildArtifact` sets only `DocId`, `Model`, `Dims` and the per-card lists — never `ContentHash` or
  `PipelineFingerprint`, whose docs say *"so a pipeline change is visible without re-reading the document"*. The ingest
  always calls `EmbedBatchAsync` for every card (`:1115`) and never reads the artifact, so PLAN S2 *"the retry reuses it
  with zero AI"* holds for services, not knowledge; only the host's in-memory embedding cache (≤5,000 entries,
  `AzureAIFoundryEmbeddingService.cs:117-130`) can save a retry.
- **Not a defect:** the vector not being stored in the index (D-21/D-26/D-29).
- **Fix direction:** stamp both header fields; optionally reuse vectors whose per-card hash matches before embedding.
- **Confidence:** H.

### P4-J-14 · Low · After the per-call lookup cap is reached, every further search still pays in full

- **Where:** MCP `KnowledgeTools.cs:137-155`; `CatalogLookupAllowance.cs:9-10, 17-33`.
- **Evidence:** `allowanceTask` and `searchTask` start together and `return await allowanceTask ? await searchTask : Exhausted;`
  — the cap *"exists to stop a runaway loop"*, but a looping model still triggers 2 registry sweeps, ≤3 embeddings,
  ≤6 searches and an extra `GetByCallIdAsync` per call before the answer is discarded.
- **Fix direction:** remember exhaustion per call (session) and short-circuit before the search once refused.
- **Confidence:** H.

### P4-J-15 · Low · Every pass re-renders every page before it checks the page cache

- **Where:** `VisionDocumentTranscriptionService.cs:80-83, 149-151, 817-826`; `DocumentPageRasterizer.cs:120-137, 93-103`.
- **Evidence:** `RasterizeAsync(request.DocumentBytes, …)` renders all pages first; the cache is read afterwards inside
  the per-page loop, as `DerivativeBlobExistsAsync` + `GetBlobStreamAsync` (two storage calls per cached page). Each
  source check re-opens the whole PDF (`DocLib.Instance.GetDocReader(pdf, …)` for one page).
- **Failure scenario:** pass 2 of a 100-page scan with 60 pages banked renders 100 pages on the process-wide PDFium
  singleton and makes 120 storage calls to learn 60 of them were already paid for.
- **Fix direction:** consult the cache first and rasterise only misses (`RasterizePageAsync` already exists); one GET with 404 handling.
- **Confidence:** H.

### P4-J-16 · Low · A shared-cache write uses a weighted Size, not the `Size = 1` the zero-tolerance rule states

- **Where:** `FullProviderContextService.cs:123-129` (the `hasKnowledge` context cache); `MemoryCacheSizeConventionTests.cs:112-113`.
- **Evidence:** `Size = Math.Clamp(1 + context.Services.Count / 25, 1, 64)`. CLAUDE.md §14: *"EVERY IMemoryCache write
  MUST set Size = 1 (ZERO-TOLERANCE)"*; the guard only checks `\bSize\s*=` is present. Safe (never size-less), and the
  weighting is argued in its comment — but it is not what the rule says, and one entry can evict 64 others.
- **Fix direction:** owner ruling: allow weighted sizes explicitly in §14 (and the guard), or write `Size = 1`.
- **Confidence:** H.

### P4-J-17 · Low · The PDF binder fetches DI crops serially for every unmatched figure, before the 40-picture cap

- **Where:** `KnowledgeImageExtractor.cs:124-143`; ingest `:2034-2047`.
- **Evidence:** `if (await FetchCropAsync(analyzeResult, figure, cancellationToken) is { } crop)` inside a `foreach` over
  all kept figures; the cap (`MaxImagesPerDocument`, ranked by area) is applied later in the lane. The code's own comment
  calls each *"one paid figure-crop download per figure"* (`:486-491`, UNCERTAIN whether DI bills the GET).
- **Failure scenario:** a 100-page vector-art catalogue with 200 unmatched figures makes 200 sequential round trips and
  holds 200 PNGs, of which 160 are then discarded by the cap.
- **Fix direction:** rank by DI geometry and fetch only candidates that can win a slot; bounded parallelism.
- **Confidence:** H (serial + pre-cap); M (billing).

### P4-J-18 · Low · The polled list reads the same profile twice and every linked service by point read

- **Where:** `KnowledgeController.cs:101-106, 112-117`; `ReceptionistAvailability.cs:28`; `KnowledgeManagementService.cs:92-107, 679-684`;
  partner `knowledgeMeta.js:157-178`.
- **Evidence:** per poll: `ListAsync` (`SELECT *` of every row) + one `GetItemAsync` per distinct linked service (32-wide)
  + `CountPendingAsync` + `IsAvailableAsync` (profile read) + `GetMaxPassagesAsync` (the same profile read again). The
  comments say *"the page RE-READS it every few seconds"* (`KnowledgeManagementService.cs:95-96`) and *"four times per
  ladder"* (`KnowledgeController.cs:112`); the real web ladder is 20 → 45 → 90 → 180 → 300 s, ≈9 polls per 30 minutes,
  plus a 9-step analytics ladder.
- **Fix direction:** one profile read feeding both answers; one partition query for the linked names; fix both comments.
- **Confidence:** H.

### P4-J-19 · Improvement · Two KnowledgeBase indexed paths nothing filters or sorts on

- **Where:** `CosmosContainerPolicies.cs:794, 799` — `new IncludedPath { Path = "/docType/?" }`, `new IncludedPath { Path = "/updatedAt/?" }`.
- **Evidence:** no query on the KnowledgeBase container references `c.docType` or `c.updatedAt` (grep over infrastructure,
  Functions, API, MCP, cosmosindexsetup). §0.11: trim `IncludedPaths` to what is filtered or sorted. Every row, draft and
  decided-rows write pays for them. Removing a path is an index change ⇒ owner approval (§0.7).
- **Confidence:** H.

### P4-J-20 · Low · Draft sweeps are long synchronous requests; decided rows are rewritten once per approval

- **Where:** `KnowledgeDraftApprovalService.cs:999-1022, 966-988, 1131-1154, 451`; `KnowledgeServiceDraftCleaner.cs:74-87`;
  `KnowledgeDecidedRowsRepository.cs:77-113`; `VoiceKnowledgeSettings.cs:366-370`.
- **Evidence:** `DismissByKindAsync` collects up to `MaxPendingDraftsPerBusiness` (2,000) and dismisses them one by one
  (replace + blob delete each) inside one HTTP request; `RerunAllAsync` deletes every non-approved draft of every Ready
  document sequentially in one request. On a capped document each approval does a read-modify-write of the decided-rows
  document (up to 20,000 × 16-hex hashes ≈ 380 KB) — `RememberAnsweredRowAsync` per draft, not once per batch.
  After every decision batch, `ContinueCappedDocumentsAsync` reads ALL drafts of each touched document (`SELECT *`,
  tombstones included, `:1066-1067`) only to ask whether any is still Pending.
- **Fix direction:** chunked/bounded-parallel sweeps (or a queued job), one `AddAsync` per touched document per batch,
  and a `TOP 1`/`COUNT` pending probe instead of the full per-document list.
- **Confidence:** H.

### P4-J-23 · Low · Every ingest with a picture lists the whole registry partition to build the caption-reuse map

- **Where:** ingest `:2060-2061, 2815-2840`; `KnowledgeDocumentRepository.cs:68-87`.
- **Evidence:** `var known = assets.Count == 0 || forceFresh || !canReuse ? [] : await BuildBusinessImageMapAsync(row.BusinessId, ct);`
  → `foreach (var doc in await _repository.ListAsync(businessId, ct))` — `SELECT * … ORDER BY c.createdAt DESC`, every
  row with its whole image registry, to look up at most `MaxImagesPerDocument` hashes. The comment calls it *"One
  partition-scoped list"* — true, but O(documents × row size) per ingest now that the document count is uncapped.
- **Fix direction:** project only `images` (hash, caption, kind, quality, contextHash) for Ready file rows; a hash lookup
  proper would need an index on `images[].contentHash` (§0.7 ask).
- **Confidence:** H.

### P4-J-21 · Medium (cross-dimension — extraction auditor may raise to High) · ForceFresh is dropped by continuations

- **Where:** `KnowledgeIngestQueue.cs:94-104`; ingest `:686-688, 856, 2061`; `KnowledgeIngestQueueMessage.cs:23-29`.
- **Evidence:** the continuation message sets `BusinessId, DocId, Mode, Continuation, PagesBankedSoFar, AiAttemptsSpent`
  — not `ForceFresh`. The pass that finally reaches the image lane then runs
  `RunImageLaneSafeAsync(row, extraction, message.ForceFresh /* false */, …)` and reuses the business-wide caption map
  (`:2061`), which EX-06 exists to bypass (*"This is the switch that says 'redo the interpretation, not just the parse'"*).
- **Failure scenario:** after a caption-prompt fix an admin forces a fresh re-read of a long scanned catalogue; vision
  runs out of time in pass 1; pass 2 reuses every old caption. The fix never reaches those pictures.
- **Fix direction:** carry `ForceFresh` on the continuation (and the retry already does).
- **Confidence:** H.

### P4-J-22 · Improvement · A document deletion runs the whole purge twice

- **Where:** `KnowledgeDocumentDataPurger.cs:130-153`.
- **Evidence:** `await PurgeAsync(...)` before `TryDeleteAsync` and again after it — each pass = card id paging + delete,
  AI-cache delete, drafts query + deletes, decided-rows delete, five prefix listings and two blob deletes. Correct by
  construction (catches a racing writer), but it doubles storage listing and Cosmos query cost on every deletion.
- **Fix direction:** keep the second pass but make it cheap (skip listings already proven empty), or document the trade.
- **Confidence:** H.

---

## 3. Numbers the code allows

**Worst case per 100-page PDF, per pass** (settings defaults; `MaxPagesPerDocument` 100)

| Item | Count / bound | Where |
|---|---|---|
| Page pre-count | in-process, free | ingest `:1431-1454` |
| Document Intelligence (layout) | 1 per document **bytes**; later passes/re-reads hit the extraction cache (bytes + model + format + figures) | `:1460-1472` |
| PDFium renders | 100 at 1,024 px every pass (cached pages included) + ≤8 whole-document re-opens at 2,048 px for checks | P4-J-15 |
| Vision transcription (Luna, Medium, ≤6,000 tokens) | ≤100 × (1 + MaxConservationRetries 1, clamped ≤3) = **≤200**, cached pages 0; concurrency = governor `MaxBulkConcurrency` (process-wide) | `VisionDocumentTranscriptionService.cs:130-188` |
| Source checks (Sol, High, ≤8,000 tokens) | ≤8 **per pass** (P4-J-04) | `:117, 214-236` |
| DI figure crops | 1 sequential GET per unmatched figure, uncapped before the lane | P4-J-17 |
| Picture captions (Luna, Medium, 1,500 tokens, +1 retry at 3× on cut-off) | ≤ `MaxImagesPerDocument` 40, 0 when hash + context already described | `:2084-2138` |
| Picture-of-text transcription | 0 for a PDF (rendered pages); ≤5 for Office/HTML, each 1 DI (uncached, P4-J-12) + 1 vision | `:1815, 2156-2169` |
| Describe (title/summary) | 1 (+1 cut-off retry); 0 on artefact replay | `KnowledgeDocumentDescriber.cs:99-112` |
| Summary fact-check | 0 AI, linear in document text | `KnowledgeSummaryFactCheck.cs:21-47` |
| Embeddings (Bulk) | ⌈tokens ÷ 40,000⌉ sequential requests (≤2,048 inputs each) — e.g. 245 cards ≈ 3; recomputed every run (P4-J-13) | `AzureAIFoundryEmbeddingService.cs:236-254, 278-297` |
| Index | 4 counts before (2 pickup + 2 overflow) + ≥1 visibility count (≤15 s poll) + 1 paged prune listing + upload pages ≤12 MB / ≤500 cards + delete batch | ingest `:3338-3342, 1089-1090, 3534-3546`; indexer `:157-172` |
| AI cache | 1 conditional placeholder PUT (409 when present) + lease acquire + renew every 10 s + artefact PUT (~12.3 KB/card) + release | `SearchAiCacheWriteLock.cs:91-107, 151-159` |
| Cosmos | ~8-10 point reads, 2-3 CAS replaces, 1 hash-twin query, 1 profile read, + 1 full partition `SELECT *` when any picture lacks nearby text (`BuildBusinessImageMapAsync`) | `:2060-2061, 2815-2840` |
| AI attempts | ≤1,200 per delivery (6,000 ÷ 5) — but see P4-J-03 | `:279-282` |

**Per phone `search_knowledge` call (4 s budget):** 1 cell lookup (memory hit), **2** registry sweeps (P4-J-05), ≤3
embeddings (Interactive, 40% of the budget), 2 searches per leg (main + overview companion) and 2 more per leg when the
narrowed search is empty, 1 session CAS (+1 read when exhausted). No per-call memo of the gates.

**Per Ask-Clinket knowledge call:** 1 visibility sweep (memoized per request), ≤3 embeddings, ≤3 searches, ≤8 row point
reads, ≤8 artefact existence checks, page probes (8-wide).

**Per list poll:** 1 `SELECT *` of every row + L linked-service point reads + 1 index-only draft count + 2 reads of the
same profile. ≈9 polls per upload window + ≈9 analytics polls.

**Per SAS mint (upload):** 1 profile read + 1 index count (+1 point read per Replace target). Reservation adds nothing
today (P4-J-01).

---

## 4. Closure check (original ids in this dimension)

| Id | Verdict |
|---|---|
| **B1** (500-card pages over 16 MB; 413 isolated per card) | FIXED-AND-VERIFIED-IN-CODE — `KnowledgeSearchIndexer.cs:157-172, 205-218` (≤12 MB estimate, ≤500), `:246-257` (413 halves, depth ≤ log₂500). Residual 5xx case: P4-J-06 |
| **D9** (list page costs 7 Cosmos queries) / **D-3** (one aggregate for draft totals) / **E-21** | FIXED-AND-VERIFIED-IN-CODE — `KnowledgeServiceDraftRepository.cs:190-234` one aliased aggregate; list = page + totals + per-document (`KnowledgeDraftApprovalService.cs:144-148`) |
| **E2** (no backoff between redeliveries) | FIXED-AND-VERIFIED-IN-CODE — scheduled retry, 30 s × 4ⁿ capped 1,800 s, 5 attempts (ingest `:340-362, 441-451`). Residual: P4-J-03 |
| **E8** (poll ladder stops at 5.6 min) | FIXED-AND-VERIFIED-IN-CODE (web) — `knowledgeMeta.js:157-178` ends at the server's `IngestTimeoutSeconds`, ≤24 polls. Mobile not read |
| **E9** zero-byte blob pays DI | FIXED-AND-VERIFIED-IN-CODE — ingest `:589-593` |
| **E9** unconfirmed uploads never swept | **NOT EFFECTIVE AT SCALE** — sweep exists but cannot reach past the first 2,000 old blobs (P4-J-02) |
| **E9** passage cap two sources of truth | FIXED-AND-VERIFIED-IN-CODE — index is the one source (`KnowledgeManagementService.cs:648-652`, ingest `:3335-3351`) |
| **E9** false "stuck Processing" alert after Ready | FIXED-AND-VERIFIED-IN-CODE — `KnowledgeFailStampOutcome` (ingest `:372-387, 3628-3657`) |
| **E9** source held three times | FIXED-AND-VERIFIED-IN-CODE (one exact-size copy, ingest `:595-609`); residual lifetime P4-J-11 |
| **E9** identical-content short-circuit unreachable | FIXED-AND-VERIFIED-IN-CODE — reachable via E1 pending blob (ingest `:640-668`) |
| **E10** (caption alert passed DocName as id) | FIXED-AND-VERIFIED-IN-CODE — ingest `:946-952` passes `row.DocId` |
| **E12** (per-document budget across passes) | FIXED for continuations (ingest `:279-282, 790-792`); **REGRESSED on the scheduled-retry and redelivery paths** (P4-J-03) |
| **E12-E** (DI re-bought on every pass) | FIXED-AND-VERIFIED-IN-CODE — `KnowledgeExtractionCache` (ingest `:1456-1472`) |
| **E13** (banking cancelled by the budget token) | FIXED-AND-VERIFIED-IN-CODE — `VisionDocumentTranscriptionService.cs:262-268` banks on the caller's token |
| **G** (reading killed by the delivery deadline) | FIXED-AND-VERIFIED-IN-CODE — ingest `:268-271, 1371-1375`; `EffectiveBudget` `:344-350` |
| **F6** (gates applied after the window) | FIXED-AND-VERIFIED-IN-CODE — `ProviderKnowledgeSearchService.cs:149-170, 997-1010`; residual >500-document fallback (P4-J-05) |
| **F8** (document invisible for the whole run; hasKnowledge cached 5 min) | SUPERSEDED-BY R-10 `cardsRewriting` (`KnowledgeSearchVisibility.cs:65-92`, ingest `:1176, 3238`); hasKnowledge still rides the 5-minute provider context (`FullProviderContextService.cs:125, 309`) by design |
| **R-6 / C3** cost ("cached per image hash") | PARTIAL — vision half cached (`:2736-2739`), DI half not (P4-J-12) |

---

## 5. Verified OK

- **Cross-partition: none.** Every knowledge query/read/patch carries the business partition key —
  `KnowledgeDocumentRepository.cs:59, 74, 106, 130, 151, 178, 246, 281, 308, 403, 424-427, 453-458, 479, 508-512, 581-586, 678-687`;
  `KnowledgeServiceDraftRepository.cs:45, 66-70, 107, 146, 167, 201, 266, 310, 331-336, 357, 402`;
  `KnowledgeDecidedRowsRepository.cs:53-54, 112, 137-138`; linked-name reads `GetItemAsync(id, businessId)`; profile reads
  are point reads (`BusinessProfileRepository.cs:27-33`).
- **Index needs:** `ORDER BY c.createdAt DESC` has its composite (`CosmosContainerPolicies.cs:806-811`); the queue's
  `type, status, queueRank DESC` composite exists (`:812-819`); `COUNT` with `sourceKind`/`status` is index-only (`:792-795`).
- **Cache sizes:** `BusinessAlphabetService.cs:118-122`, `SearchCellDirectory.cs:164-168`, `BusinessSearchRulesService.cs:63-65`,
  `BusinessSearchRosterService.cs:57-59, 102-104`, `BusinessSearchDateRangeResolver.cs:182-184`, `BusinessSearchQuestionRedactor.cs:106-108`,
  `VoiceCallerIdentityService.cs:62-65`, embedding private cache `:784` (with `SizeLimit` derived from a memory budget,
  `:117-130`) all set `Size = 1`. Alphabet TTLs 30 min / 60 s / 250 ms match all three hosts' appsettings.
- **Single-flight:** alphabets (`Lazy` + remove after the cache write, `:94-131`), cell directory (producer cleans up,
  `:59-63, 110-115`), provider context (`FullProviderContextService.cs:101-110`), embeddings (`_inflight`, `:184-188`).
- **Host-wide counters live in singletons:** `SearchAiCacheStore` is `AddSingleton` in API `Program.cs:1234` and Functions
  `Program.cs:805`; `Interlocked` exchange order (misses first) cannot exceed 100% (`:404-414`).
- **No captive dependencies:** `ValidateOnBuild` + `ValidateScopes` on all three hosts (API `Program.cs:92-95`, Functions
  `:81-82`, MCP `:48-51`); `SearchCellDirectory` uses `IServiceScopeFactory`.
- **Thread-safe memos:** `SearchKnowledgeTool._hasFullText/_viewablePages` are `ConcurrentDictionary` (`:39, 42`);
  `ProviderKnowledgeSearchService._visibilityCache` is scoped and does not cache `ReadFailed` (`Provider.cs:285-314`);
  vision tallies use `Interlocked`/`ConcurrentBag` (`:118-121`); `HiddenTextStyles.None` is never mutated (`:17-21`).
- **Lease:** bounded wait 20 s with 150-400 ms jitter, 30 s lease renewed every 10 s, `Lost` linked into the upsert,
  release in `DisposeAsync`, one handle per blob (`SearchAiCacheWriteLock.cs:59-71, 101-123, 151-174, 194-224`).
- **Bounded loops/retries:** CAS loops ≤3 (ingest `:3229-3243, 3248-3260`, management `CasRetries`), ingest scheduled
  retry ≤5 with backoff, continuations ≤8 + no-new-page stop (`:3276-3299`), visibility poll ≤15 s with 250 ms→2 s
  backoff (`:3534-3546`), lock wait deadline, `UpdateImageDerivativeAsync` ≤`MaxConcurrencyRetries`, decided rows ≤5,
  conservation re-asks clamped ≤3 (`:174`), judge ≤`JudgeMaxAttempts`, extractor truncation split depth ≤log₂50 and
  first failure cancels siblings (`KnowledgeServiceDraftAnalyticsJob.cs:902-941`), 413 split depth ≤9, analytics retries
  ≤4 with 180 s × 2ⁿ, embedding retries bounded per lane (`:411-412`), `PageCardsAsync` stops on a short page.
- **Spend gates run before spend:** size probe before buffering (`:574-583`), empty file (`:589-593`), hash twin and
  identical bytes (`:621-668`), space full at pickup (`:678`), page pre-count before DI (`:1431-1454`), DI page count
  before vision (`:1476-1482`), OpenXML uncompressed size from the central directory (`:1585-1594`), character cap before
  describe (`:803-810`), overflow before embed (`:1088-1107`), E12 carry-on decided before summary/captions/embeddings (`:787-799`).
- **Disposal:** blob streams `await using` (`:602`, `:2387`), deadline CTS `using` (`:265`), linked scopes in the indexer
  (`:152`, `:380`), ImageSharp images/streams `using` (normalizer `:134-173`, classifier `:98-112`, rasterizer
  `:122-136, 197-202`), Docnet readers `using`, PdfPig `using` (`KnowledgeImageExtractor.cs:496`), DI figure
  `HttpRequestMessage`/`HttpResponseMessage` `using` (`DocumentIntelligenceService.cs:521-523`), `JsonDocument` `using`
  (describer `:126`, classifier `:167`), SemaphoreSlim/CTS disposed only after `Task.WhenAll` settles every task. No `ArrayPool` in scope.
- **Concurrency widths:** vision pages = governor `MaxBulkConcurrency`; extractor `SemaphoreSlim(Concurrency 4)`; judge
  `Parallel.ForEachAsync(Concurrency)`; linked names 32; health probe 8; image SAS 8; AI-cache service reads 16. The
  Service Bus 5.x host extension still maps `SessionHandlerOptions:MaxConcurrentSessions` (string present in
  `microsoft.azure.webjobs.extensions.servicebus/5.17.0`), so `maxConcurrentSessions: 8` is honoured.
- **Retrieval budgets:** 4 s linked deadline; embeddings 40% share and fail-soft to keyword-only; a failed leg never
  fails the answer; the gates fault rides back as data and is rethrown (`:411-422`); the image-ref task swallows its own
  cancellation (`:441-463`); every leg carries the scope assertion (`:514`).
- **Download/upload never stream through the API:** SAS upload; download is a short read SAS behind the front door after
  one existence check (`KnowledgeController.cs:763-772`); the polled list carries counts only, picture SAS minted on
  demand 8-wide (`:112-129, 1124-1168`).
- **The orphan sweep cannot delete a cache or a kept version:** `ParseSourceBlob` needs `IsCanonicalBusinessPathSegment(parts[0])`,
  and `UploadSegment` trims a leading `_` (`KnowledgeBlobPaths.cs:192`), so `_ocr/…`, `_previous/…`, `_sent/…` never
  parse; `{businessId}/ai-cache/…` and `{businessId}/_images/…` fail `IsCanonicalDocumentId` on the second segment
  (`KnowledgeOrphanUploadSweeper.cs:103-111`). Row lookups are one point read per document, memoised (`:56-72`).
- **Drafts:** approve-all and dismiss sweeps pass the rows they already loaded (`KnowledgeDraftApprovalService.cs:880-883, 953-956, 993-996, 1020-1021`);
  `DismissByKindAsync` holds exactly ≤`MaxPendingDraftsPerBusiness` (`:1004-1018`).
