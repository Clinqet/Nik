# P4-C — Pipeline safety, status, idempotency, concurrency (closing audit, read-only)

Auditor: dimension C. Date: 2026-09-25. Code audited as it is on disk now (all repos; `clinqetapi` tree clean at `2e47eca`).
No file under `C:\Nik` was changed; no build, test or git write was run.

---

## 1. Scope actually read

Read end to end unless marked.

| File | Lines | Notes |
|---|---|---|
| `clinqetfuncations/Clinqet.Communications/Functions/KnowledgeIngestProcessorFunction.cs` | 3,730 | 1–1,690 and 2,290–2,330 and 2,960–3,730 read line by line. 1,692–1,810 (image-lane wrapper) read; 1,810–2,290 and 2,330–2,960 (image-lane / card-builder internals) **skimmed only**, per brief |
| `clinqetfuncations/Clinqet.Communications/Functions/KnowledgeMaintenanceFunction.cs` | 173 | full |
| `clinqetinfrastructure/Services/Knowledge/KnowledgeManagementService.cs` | 1,316 | full |
| `…/Knowledge/KnowledgeSpaceReservation.cs` | 128 | full |
| `…/Knowledge/KnowledgeFailureReason.cs` | 63 | full |
| `…/Knowledge/KnowledgeReadingNotices.cs` | 194 | full |
| `…/Knowledge/KnowledgeDocumentDataPurger.cs` | 181 | full |
| `…/Knowledge/KnowledgeOrphanUploadSweeper.cs` | 113 | full |
| `…/Knowledge/KnowledgeIngestQueue.cs` / `KnowledgeAnalyticsQueue.cs` | 111 / 74 | full |
| `…/Knowledge/KnowledgeMetadataMergeService.cs` | 158 | full |
| `…/Knowledge/ReceptionistAvailability.cs` | 32 | full |
| `…/Knowledge/KnowledgeSearchIndexer.cs` | 571 | full (needed for the rewrite window + G-L1) |
| `…/Knowledge/KnowledgeContentArtifactStore.cs` | 160 | 40–160 |
| `clinqetcore/Models/Knowledge/KnowledgeProcessingRules.cs`, `KnowledgeBlobPaths.cs`, `KnowledgeDraftAnalyticsRules.cs`, `KnowledgeTokenEstimate.cs` | 42 / 203 / 20 / 79 | full |
| `clinqetcore/Interfaces/Knowledge/KnowledgeSearchVisibility.cs`, `KnowledgeReceptionistRule.cs`, `IKnowledgeManagementService.cs`, `IKnowledgeIngestQueue.cs` | 142 / 94 / 153 / 42 | full |
| `clinqetcore/Entities/COSMOS/KnowledgeDocument.cs` | 322 | full |
| `clinqetinfrastructure/Data/COSMOS/KnowledgeDocumentRepository.cs` | 719 | full |
| `clinqetinfrastructure/Data/COSMOS/BusinessProfileRepository.cs` | 466 | 1–80, 380–466 |
| `clinqetapi/Clinqet.API/Controllers/Knowledge/KnowledgeController.cs` | 1,264 | full |
| `clinqetapi/Clinqet.API/Controllers/Admin/SearchAdminController.cs` | 529 | 370–529 |
| `clinqetapi/Clinqet.API/Controllers/Admin/AdminVoiceAssistantController.cs` | 342 | route list only |
| `clinqetapi/Clinqet.API/Controllers/Base/BaseController.cs` | 930 | 470–700, 736–766 |
| `clinqetinfrastructure/Services/Communication/ServiceBusService.cs` | 855 | 740–822 (`DrainDeadLetterAsync`) |
| `clinqetshared/DTOs/Messages/KnowledgeIngestQueueMessage.cs`, `Models/VoiceKnowledgeSettings.cs` (parts), `DTOs/Knowledge/KnowledgeDtos.cs` (confirm DTO, list DTO) | — | relevant parts |
| Tests (to know what is pinned): `KnowledgeIngestProcessorFunctionTests.cs` 2,230–2,420, 3,610–3,730, 4,770–4,830, 5,540–5,660; `KnowledgeSpaceQueueGuardIntegrationTests.cs` 1–120; `VoiceKnowledgeSettingsConventionTests.cs` 1–80 | — | grep across all test projects for the symbols named below |
| Authority: FINDINGS §1, §2.E, §3, §7, §8, §9; phase-2 AUDIT (all); PROGRESS-SESSION2 §18, §20–§26, §31–§32; phase-3 AUDIT §12, §12.9, §13; PHASE-4 prompt; PLAN row 2 | — | |

---

## 2. Findings

Severity counts: **Critical 1 · High 7 · Medium 11 · Low 15 · Improvement 1** (35 total).

| Id | Sev | Title |
|---|---|---|
| P4-C-01 | **Critical** | A failure inside the R-10 rewrite window, on the final delivery, is turned into **Ready** by D-1 — a two-version mixture (or an empty index) answers callers under a notice saying "we kept the version you had" |
| P4-C-02 | High | "Read again" when space is full answers **"This document is still processing"** — the SpaceFull outcome is unmapped |
| P4-C-03 | High | The admin per-business searchable-space override cannot be read or set: no API serves `/admin/voice-assistant/{id}/knowledge-limit`; the provider sentence says "Contact support to increase your limit" |
| P4-C-04 | High | The approved upload-gate space **reservation is dead code** (`GetSpaceBudgetAsync` has no caller, zero tests, its settings in no appsettings) |
| P4-C-05 | High | E2/R-5 only half built: embedding, index, profile and storage failures still abandon instantly (5 deliveries in minutes, no backoff) |
| P4-C-06 | High | F-5 incomplete: an exhausted transient outage tells the provider "we couldn't read this file", never offers Read again, and **deletes the uploaded replacement** |
| P4-C-07 | High (owner ruling: passage defect) | Metadata merge checks the card ceiling at chars÷4 while the chunker is script-aware — cards of non-Latin documents can be merged over the ceiling |
| P4-C-08 | High | G-L1 / L-12: the scheduled row⇄index reconciliation was never built; post-Ready index loss is still undetectable |
| P4-C-09 | Medium | U-04 "Stopped" fires on healthy E12 reading chains (160-min window < legitimate chain length) and offers a Read again that starts a second chain |
| P4-C-10 | Medium | The ingest retry message id is not generation-scoped, and it drops `Continuation` / `PagesBankedSoFar` / `AiAttemptsSpent` |
| P4-C-11 | Medium | A continuation drops `ForceFresh`: a forced reindex of a multi-pass document replays the OLD artefact on pass 2 (EX-06 / X-07 defeated) |
| P4-C-12 | Medium | A D-1 keep after Read again / re-cut leaves the kept version with `ContentHash = null` — Business Search page, text and citation-page views of that document disappear |
| P4-C-13 | Medium | A replacement overwrites the live version's content artefact and DI bank BEFORE it commits (E1/R-4 residual) |
| P4-C-14 | Medium | `KeepReplacedDocumentAsync` (replacement = another document's bytes) leaves `PendingBlobPath`/`PendingDocName`/`ProcessingSince` on a Ready row; Read again re-reads the refused file for ever; H7 test pins the pre-E1 shape |
| P4-C-15 | Medium | The "descriptions unavailable" keep path bypasses D-1 (no notice) and is reachable for a replacement since E1 (pending state left, wrong SizeBytes) |
| P4-C-16 | Medium | A failed replacement of a **Failed** document leaves the row naming the OLD file (name, blob, size) with the NEW file's failure; push names the wrong file; each retry leaks the previous candidate blob |
| P4-C-17 | Medium | L-11 drain: abandoned "kept" messages are re-received in the same loop (counts inflated to 100, removable ones starved), and the nightly alert says "the row will sit unfinished" about rows the final delivery already settled — a permanent false alarm |
| P4-C-18 | Medium | E3 only half built: the commit→enqueue unit still runs on the request token (reprocess strands the row; a details edit drifts for ever) |
| P4-C-19 | Medium | Any exception while downloading the blob is TERMINAL (C1 class) and, on a replacement, deletes the uploaded file |
| P4-C-20 | Low | MetadataOnly on a Processing row between E12 passes "re-cuts" it, starting a second reading chain with reset bounds |
| P4-C-21 | Low | E5 residual: confirm `FileName` unbounded/unsanitised, dead `ContentType` field, client-declared `SizeBytes` on every non-Ready row |
| P4-C-22 | Low | E9.2 residual: unconfirmed / refused replacement candidates under an existing docId are never swept |
| P4-C-23 | Low | A redelivered continuation can replay an older run's degraded artefact and finalise early |
| P4-C-24 | Low | `CommitAsync(r => r.CardsRewriting = true)` result ignored — cards are upserted for a row already deleted |
| P4-C-25 | Low | API `MarkDeletingAsync` does not clear `cardsRewriting` (harmless today; the stated invariant holds in one of two writers) |
| P4-C-26 | Low | `HasStoppedPartWay` keeps an `UpdatedAt` back-compat fallback no writer needs (§22.10) |
| P4-C-27 | Low | The provider's space meter sums row counts while every gate counts the index (E9.3 residual) |
| P4-C-28 | Low | The duplicate-upload merge overwrites the survivor's own reading notices |
| P4-C-29 | Low | The superseded-source archive is not re-attempted on the Ready idempotent exit |
| P4-C-30 | Low | E8 residual: the served reading budget is one delivery (30 min), not an E12 chain |
| P4-C-31 | Low | Picture allow-list still Ready-only while the text rule admits Processing (R-10); two comments now false |
| P4-C-32 | Low | "≤220 rows" bound on the per-voice-search registry sweep is stale since the 20-document cap was removed |
| P4-C-33 | Low | Caller-correctable confirm conditions surface as 500 "Internal server error" |
| P4-C-34 | Low | SAS replace on a "Stopped" target says "wait until it finishes processing" |
| P4-C-35 | Improvement | The polled list does two point reads of the same profile per poll |

---

### P4-C-01 — CRITICAL — D-1 turns a mid-rewrite (or empty) index into Ready

**Violates:** R-10 safety property ("a row stranded during the write holds a mixture of two versions and must not answer"), G-L1 ("must not commit Ready"), D-1's premise ("a document whose cards still answer").

**Evidence**
- The rewrite window, `KnowledgeIngestProcessorFunction.cs:1172-1181`:
  ```csharp
  // ... from here the document is a mixture of two versions and must answer nobody ...
  await CommitAsync(businessId, docId, r => r.CardsRewriting = true, ct);
  await _indexer.UpsertCardsAsync(searchDocs, ct);
  await _indexer.PruneCardsAtOrAboveAsync(businessId, docId, searchDocs.Count, ct);
  await EnsureTheIndexTookThemAsync(businessId, docId, searchDocs, ct);
  ```
- None of these throws a terminal exception; every failure abandons and redelivers. On the final delivery `Run` does (`:372-377`):
  ```csharp
  var stamp = await TryMarkFailedAsync(payload.BusinessId, payload.DocId, "Error_KnowledgeGenericRetry");
  ```
- `TryMarkFailedAsync` → `FailAsync` (`:3640`), which keys the keep rule on `PassageCount` alone (`:3586-3590`):
  ```csharp
  if (current != null && (current.PassageCount ?? 0) > 0)
  {
      await KeepTheAnsweringVersionAsync(businessId, docId, current.PendingBlobPath, reasonKey, ct);
      return;
  }
  ```
  `current.CardsRewriting` is never consulted. `KeepTheAnsweringVersionAsync` sets `Status = Ready` (`:3459`) and `CommitAsync` then clears the flag (`:3238`: `if (row.Status != KnowledgeDocumentStatus.Processing) row.CardsRewriting = null;`).
- G-L1's own contract (`:3484-3487`): *"if the index still holds nothing after that, the run has not succeeded and must not commit Ready"* — its throw (`:3520-3521`) reaches the same final-delivery path.
- The phase-3 audit's edge table says the opposite (`phase-3/AUDIT.md:435`): *"Retries exhausted → dead-letter | Row stays Processing + flag true → silent. ‼️ Identical to today."* That is true only for a host CRASH (no catch), not for an exception. `KnowledgeDocument.cs:121` repeats *"A stranded `true` is exactly today's behaviour"*.
- Pinned by nothing: no Functions test sets `CardsRewriting` (grep across `clinqetfuncations`).

**Wider than the window itself:** the flag is cleared only by a terminal commit, so once ANY delivery has entered the
window and failed, a final delivery that fails ANYWHERE (e.g. at the embedding step, before the window) still reaches
the same `FailAsync` with the flag true and the index holding delivery N-1's partial write.

**Failure scenario.** Provider replaces (or re-reads) an indexed 600-card price list. The new cards span two upload pages (`MaxUploadRequestBytes` 12 MB ≈ 320 cards). Page 1 lands; page 2 is refused (Search capacity/storage quota — the lane's own `KnowledgeSearchIndexCapacity` alert — or a prune request failing, or a ~10-minute search incident that outlasts 5 instant redeliveries, see P4-C-05). Delivery 5 → `ReplacementKeptPrevious` notice, `Ready`, `PassageCount` = old 600. The index holds new ordinals 0–319 + old 320–599: a caller hears the new price for item A and the old price for item B. The G-L1 variant (index holds nothing for the doc) yields Ready while nothing is indexed, under *"Callers are still being answered from it."*

**Fix direction.** In `FailAsync`, a row with `CardsRewriting == true` has no whole version: never apply the keep rule. Either leave it Processing + flag (silent, U-04 recovers it) or, since the cards are in hand, schedule a re-drive of the write with backoff. Add the missing test (final delivery inside the window ⇒ not Ready). Correct the phase-3 edge table and the entity comment.

**Confidence:** high on the code path; the operational trigger is NEEDS-LIVE-PROOF (force a persistent index refusal after the flag is set).

---

### P4-C-02 — HIGH — Read again on a full space says "still processing"

**Violates:** the 2026-09-18 Read-again space gate ("tells them now"), F-7's lesson (one sentence for different situations).

**Evidence**
- `KnowledgeManagementService.cs:429-430`: `if (attempt == 0 && await HasNoSpaceToReadAsync(businessId, docId, cancellationToken)) return KnowledgeMutationOutcome.SpaceFull;`
- `KnowledgeController.cs:493-501` maps only Ok and NotFound; everything else:
  ```csharp
  _ => BadRequest(ApiResponse<bool>.Fail(
      _localizationService.GetLocalizedString("Error_KnowledgeReprocessInvalidState", GetPreferredLanguage()),
  ```
- `en.json:2965` `"Error_KnowledgeReprocessInvalidState": "This document is still processing — try again once it finishes."`
- The pickup refusal itself tells the provider to do exactly this: `en.json:2976` `…then choose Read again.`
- Admin single reindex maps SpaceFull to `Error_ConcurrencyConflict` (`SearchAdminController.cs:525-526`).
- Known close-out note (`search-topology/findings/PHASE-3-BUILD-STATE-2026-09-23.md:359`): *"a Read-again SpaceFull outcome is not mapped by the reindex/retry endpoints."* Still true.

**Scenario.** Row Failed with `Error_KnowledgeSpaceFullNotRead` → provider presses Read again before freeing space → *"This document is still processing"* about a Failed document; they wait for nothing.

**Fix.** Map `SpaceFull` to `Error_KnowledgeSpaceFull` formatted with `GetMaxPassagesAsync` (as `CreateFaq` does, `KnowledgeController.cs:956-961`), and a distinct sentence for `Conflict`; same in `KnowledgeOutcomeResult`.

**Confidence:** high.

---

### P4-C-03 — HIGH — The per-business override has no API; "Contact support" is a dead remedy

**Violates:** owner-approved admin override (27a0096); hunt item 7.

**Evidence**
- Admin web calls it: `clinqetwebadmin/src/services/voiceAssistantService.js:219` `backendApi.get(\`/admin/voice-assistant/${businessId}/knowledge-limit\`)` and `:229-231` `backendApi.put(…/knowledge-limit, { maxPassages })`.
- `AdminVoiceAssistantController.cs` routes (`:39`…`:312`): `{businessId}`, `billing-status`, `invite`, `approve`, `assign-number`, `number-quote`, `reject`, `hold`, `model-tier`, `resume`, `release-number`, `remove-number`, `change-number`, `number-audit`, `own-number/answers-all/*` — **no knowledge-limit**. No other controller serves it (grep).
- `GetPassageLimitAsync` (`KnowledgeManagementService.cs:686-695`) has **no caller**. `TrySetKnowledgeMaxPassagesAsync` (`BusinessProfileRepository.cs:440-464`) is called only by Functions integration tests (`KnowledgeSpaceQueueGuardIntegrationTests.cs:150,254`, `IdentityProfileSyncProcessorIntegrationTests.cs:128`).
- Provider copy promises the remedy: `en.json:2975` `"…Contact support to increase your limit, or delete a document…"`, `:2976` same.
- Close-out note confirms: *"the admin page calls `/admin/voice-assistant/{id}/knowledge-limit`, which no API controller serves"* (PHASE-3-BUILD-STATE:357-358).

**Scenario.** Provider at the cap follows the sentence and contacts support; the admin page's "Knowledge space" control shows "Failed to load knowledge space"; nobody can raise the limit. Every business is on the 2,000 default.

**Fix.** Ship the API half (GET = `GetPassageLimitAsync`, PUT = read profile ETag → `TrySetKnowledgeMaxPassagesAsync` with `propertyExists`), with unit + integration tests, or remove the sentence until it ships.

**Confidence:** high (known item, re-confirmed in code).

---

### P4-C-04 — HIGH — The upload-gate reservation is dead code

**Violates:** the approved 2026-09-18 reservation; §0.8 (tests), §4 (usage proof for settings).

**Evidence**
- The only gate at SAS time, `KnowledgeController.cs:195-196`:
  ```csharp
  var (usedPassages, maxPassages) = await _knowledgeService.GetPassageUsageAsync(businessId);
  if (usedPassages >= maxPassages)
  ```
- `GetSpaceBudgetAsync` (`KnowledgeManagementService.cs:654-672`) — no caller in any repo (grep `GetSpaceBudgetAsync|KnowledgeSpaceReservation|ExpectedNewParts`: only the definitions).
- `KnowledgeSpaceReservation` — **no test in any test project**.
- `SpaceEstimateDefaultPassages/SampleSize/MinSamples` (`VoiceKnowledgeSettings.cs:29-31`) exist in no `appsettings.json` (API or Functions), while the Functions convention test exempts them on a false claim (`VoiceKnowledgeSettingsConventionTests.cs:47-49`): *"clinqetapi upload gate (KnowledgeSpaceReservation via KnowledgeManagementService)"*.
- Latent defect inside it, `KnowledgeSpaceReservation.cs:109`: `return row.PassageCount.HasValue ? 0 : …estimate…` — a failed first upload stores `PassageCount = 0` (`KnowledgeIngestProcessorFunction.cs:3609`), so its re-read reserves nothing although it will add its whole size.

**Scenario.** The case the reservation was approved for: ten files dropped back to back at 1,950/2,000 all get links; the pickup gate then fails the later ones with `SpaceFullNotRead` after upload. Concurrent SAS requests (two members, or one member in two requests) all pass the same `used >= max` check.

**Fix.** Wire `GetSpaceBudgetAsync` into the SAS gate per file (and consider the reprocess gate), fix `:109` to `PassageCount is > 0`, add unit + integration tests, and put the three keys in the API appsettings (or delete the feature and the exemption).

**Confidence:** high.

---

### P4-C-05 — HIGH — E2 / R-5 only apply to extraction

**Violates:** R-5 (*"Retryable exception class for DI/vision/**embedding** transport failures, scheduled backoff between deliveries"*), E2.

**Evidence**
- Only one throw site creates the retryable class, inside the extraction catch (`:748-763`): `throw new KnowledgeIngestRetryableException(ex);`
- `Run` schedules only that class (`:340`): `ex is KnowledgeIngestRetryableException && ShouldRetryLater(...)`; everything else abandons (`:432`) = instant redelivery.
- Embedding failure (`:1120-1123`) throws `InvalidOperationException("Embedding incomplete … A document is all-in or all-out (D25).")` — not retryable. L-11's live evidence was exactly this message (FINDINGS §8.2 L-11: *"Embedding failed for card 0 … (D25)", 4 deliveries each*).
- Also instant: index upsert/prune/count (`:1178-1181`, `:3338-3342`), the profile read (`:3318`), `GetBlobSizeAsync` (`:575`, wraps everything in `BlobStorageException`), `SearchTopologyException` from `KnowledgeSearchIndexer.ClientAsync` (`KnowledgeSearchIndexer.cs:58-62`).

**Scenario.** A 3-minute embedding or search incident: five redeliveries, each re-downloading the blob and re-buying up to 500 embeddings, burn in minutes → final → `Error_KnowledgeGenericRetry` (first upload Failed) or the D-1 keep of P4-C-06 (replacement deleted).

**Fix.** Classify transport failures of embedding / index / Cosmos / storage as retryable (named exception types), and route them through `ShouldRetryLater`.

**Confidence:** high.

---

### P4-C-06 — HIGH — An exhausted OUTAGE is told "we couldn't read this file", and the replacement is deleted

**Violates:** C1/R-5 (*"a bad FILE ends the run; a bad MOMENT comes back"*, *"provider-visible 'still working' instead of false 'unreadable'"*), F-5 (*"the reason chooses the sentence"*).

**Evidence**
- `KnowledgeReadingNotices.cs:86-93` maps only the size and space reasons; everything else:
  ```csharp
  _ => wasReplacement ? ReplacementKeptPrevious : ReReadKeptPrevious
  ```
  so `Error_KnowledgeGenericRetry` (retries exhausted, `:375`), `Error_KnowledgeImageDescriptionsUnavailable` (*"describing pictures is temporarily unavailable"*) and the blob-anomaly path all get *"The new file you uploaded couldn't be read, so we kept the one you already had … Try another file"* (`en.json:2992`) / *"We couldn't read this file again"* (`:2993`).
- `ReadingAgainWouldHelp` is false for both (`:115-116`), on the reasoning (`KnowledgeIngestProcessorFunction.cs:3447-3449`) *"a TERMINAL failure is about the file, so reading the kept version again would change nothing"* — false for an outage.
- The replacement file is deleted (`:3474-3475`): `if (wasReplacement) await _dataPurger.DeleteSupersededSourceAsync(businessId, docId, abandonedBlobPath!, ct);`
- A test pins it: `KnowledgeIngestProcessorFunctionTests.cs:3681-3706` (`WhenTheAttemptsRunOut…`) drives `DocumentExtractionException.Transient("service unavailable")` and asserts `ReReadKeptPrevious`.

**Scenario.** DI outage longer than the retry ladder while a provider replaces a menu → the new menu is deleted and they are told it could not be read; they re-export a file that was fine.

**Fix.** A kept-previous sentence for "we could not finish reading it right now — try again later" (GenericRetry, ImageDescriptionsUnavailable, storage anomaly), `ReadingAgainWouldHelp = true` for it, and keep (not delete) the candidate for a transient reason. Five languages; update the pinned test.

**Confidence:** high.

---

### P4-C-07 — HIGH (owner ruling: passage defect; practical overshoot bounded by the header growth)

**Title:** Metadata merge's ceiling check uses chars÷4 while the chunker is script-aware.

**Evidence**
- `KnowledgeMetadataMergeService.cs:154-156`:
  ```csharp
  // Same ~4 chars/token approximation the chunker sizes with — the two must agree …
  private static int ApproxTokens(string text) => string.IsNullOrEmpty(text) ? 0 : (text.Length + 3) / 4;
  ```
- The chunker changed under it (F3/A21): `KnowledgeChunker.cs:21` `public static int ApproxTokens(string text) => KnowledgeTokenEstimate.Tokens(text);` with 1.0 chars/token for CJK/Hangul and 1.6 for Indic (`KnowledgeTokenEstimate.cs:22-26`). The chunker budgets the header with it (`KnowledgeChunker.cs:294-295`).
- The merge decides merge-vs-re-cut with its own copy (`:110-121`).

**Scenario.** Gujarati price list cut to ~509/512 tokens (script-aware). Provider links two more offerings → header grows 12 tokens → merge computes Gujarati body at ÷4 (≈ 40% of its real cost) → "fits" → merged; the card now exceeds `ChunkMaxTokens` on the measure every reader uses.

**Fix.** Call `KnowledgeChunker.ApproxTokens` / `KnowledgeTokenEstimate.Tokens`; add a non-Latin test.

**Confidence:** high.

---

### P4-C-08 — HIGH — G-L1 / L-12: no scheduled reconciliation exists

**Violates:** G-L1 fix direction and the Phase-2 exit criterion (PLAN.md:98 *"the dead-letter sweep and the row⇄index reconciliation run on the sandbox"*; PHASE-2B-PROMPT.md:306 *"Build the scheduled row⇄index reconciliation per business … re-enqueue drifted documents, one admin alert"*).

**Evidence**
- The only timer: `KnowledgeMaintenanceFunction.cs:47-54` runs `SweepUnconfirmedUploadsAsync` and `DrainIngestDeadLetterAsync` only.
- `GetIndexHealthAsync` (`KnowledgeManagementService.cs:514-567`) is reached only from the admin controller (`SearchAdminController.cs:~370`); nothing schedules it (grep).
- What was built is an ingest-time check (`EnsureTheIndexTookThemAsync`), which cannot see the original incident class — cards lost AFTER Ready (index drop/recreate). PROGRESS-SESSION2 §31.2: *"G-L1 … NOT BUILT, not merely unproven"*; nothing since.
- Its ingest-time check is also weak for re-reads: `TheIndexShowsThemAsync` tests `> 0` (`:3540`), which the previous version's same-id cards satisfy.

**Scenario.** The search-topology programme rebuilt the private indexes; any row whose cards did not survive a rebuild stays Ready with `hasKnowledge` true and nothing answers — exactly §7's four Canada documents.

**Fix.** Build the nightly per-business count comparison (partition-scoped row list + `top=0` counts), re-enqueue drifted Ready rows through Reprocess, one alert.

**Confidence:** high.

---

### P4-C-09 — MEDIUM — "Stopped" fires on healthy E12 chains

**Violates:** U-04's premise (stale = nothing is driving it); E6 intent.

**Evidence**
- Window rationale is pre-E12: `VoiceKnowledgeSettings.cs:237-240` *"Above IngestTimeoutSeconds x RetrySettings:MaxDeliveryCount (30 min x 5 = 150 min)"* → `StaleProcessingMinutes = 160`.
- Chain length: `MaxReadingContinuations = 8` (9 passes), vision budget 900 s per pass (`appsettings.json:1385`), delivery budget 1,800 s (`:1304`); the continuation is posted to the TAIL of the business's session (`KnowledgeIngestQueue.cs:82-108`, *"it queues behind that business's other work"*), and `ProcessingSince` is never refreshed by a continuation (`KnowledgeIngestProcessorFunction.cs:787-799` returns with no commit).
- Rule: `KnowledgeProcessingRules.cs:22-24`; DTO `KnowledgeController.cs:1216`; gate `KnowledgeManagementService.cs:425-427`.
- Phase-3 claim is wrong (`phase-3/AUDIT.md:469`): *"160 min — already tuned above the legitimate maximum of 8 continuations × 900 s"* — 9 passes, plus inter-pass queueing, plus E2's scheduled waits (~40 min cumulative).

**Scenario.** Two 100-page scans uploaded together under load (the setting's own note: 3.45× contention ⇒ ~6 passes each): their passes interleave on one session; both rows read "This one stopped part way through" after 160 min while being read; pressing Read again starts a second chain (`ReprocessAsync` accepts a "stale" row).

**Fix.** Refresh a liveness stamp per pass (or derive the window from `MaxReadingContinuations × IngestTimeoutSeconds` + queueing), and make the reprocess gate refuse while a continuation is queued.

**Confidence:** high on arithmetic; NEEDS-LIVE-PROOF for a real multi-document chain.

---

### P4-C-10 — MEDIUM — Retry message id collides across run generations; retry drops chain state

**Evidence**
- `KnowledgeIngestQueue.cs:72` `messageId: $"{businessId}:{docId}:{mode}:retry{attempt}"` — no generation; contrast the analytics lane, `KnowledgeAnalyticsQueue.cs:34-35` `…:{generationTicks}:{attempt}`.
- Retry payload (`:65`) carries `{ BusinessId, DocId, Mode, ForceFresh, Attempt }` only — not `Continuation`, `PagesBankedSoFar`, `AiAttemptsSpent` (`KnowledgeIngestQueueMessage.cs:43-55`, whose own doc says the budget *"would leak with every pass"* if not carried).

**Scenario.** Replace #1 hits a DI 503 → `…:Full:retry2` sent at T0 → it runs, fails terminally, D-1 keeps. Provider replaces again at T0+4 min; DI 503 again → `…:Full:retry2` inside the PT10M duplicate window → dropped by the broker, the current message completes, the row sits Processing with nothing driving it (no alert: the send "succeeded") until Stopped at 160 min. Separately, a retry of continuation pass 3 restarts at pass 0 with a fresh AI allowance.

**Fix.** Include the run generation (e.g. `ProcessingSince` ticks) in the retry id; carry the three chain fields.

**Confidence:** high on the code; broker dedup of scheduled sends is NEEDS-LIVE-PROOF.

---

### P4-C-11 — MEDIUM — Continuations drop ForceFresh

**Violates:** EX-06 / X-07 (*"only an admin reindex applies them"*).

**Evidence**
- Continuation payload (`KnowledgeIngestQueue.cs:96-104`) has no `ForceFresh`.
- Pass 2 therefore reads the artefact (`KnowledgeIngestProcessorFunction.cs:686-688`) and replays it when it is clean (`:713` `replayTheBankedRun = artifact != null && !retry…`).
- The admin tool that sets it: `SearchAdminController.cs:381-397` (`forceFresh` query).

**Scenario.** Operator changes a caption/vision setting (fingerprint unchanged — X-07 case) and force-reindexes a 60-page scan whose last run completed cleanly: pass 1 re-reads 900 s of pages (paid), runs out of time, pass 2 replays the OLD artefact and commits the old interpretation. The reindex reports Ok.

**Fix.** Carry `ForceFresh` on the continuation (the vision page cache is keyed per fingerprint, so pass-2 page reuse still works), or make pass 2 refuse to replay an artefact older than pass 1.

**Confidence:** high.

---

### P4-C-12 — MEDIUM — Kept version loses its ContentHash after Read again / re-cut

**Evidence**
- Read again clears it: `KnowledgeManagementService.cs:437` `row.ContentHash = null;`; the re-cut too: `KnowledgeIngestProcessorFunction.cs:3217`.
- The keep path never restores it (`:3457-3469`), while claiming (`:3444-3446`) *"Nothing on the row moves: the name, the blob, the hash, the pages and the cards all still describe the version that works."*
- Readers that require it: `BusinessSearchDocumentService.cs:59` (page view), `:106` (document text), `:282` (citation page availability), `SearchKnowledgeTool.cs:361` (viewable pages).
- The D-1 re-read test uses `hash: null` and asserts nothing about it (`KnowledgeIngestProcessorFunctionTests.cs:~5626-5642`).

**Scenario.** Provider presses Read again on a working PDF; the re-read fails (any reason) → Ready + "we kept the version you already had" → Ask Clinket can no longer show that document's pages or text, until a successful re-read.

**Fix.** Keep the hash on the row and disarm the identical-content short-circuit with a message flag instead of clearing the row; or restore the pre-run hash in the keep commit.

**Confidence:** high.

---

### P4-C-13 — MEDIUM — A replacement overwrites the live version's artefact and DI bank before it commits

**Violates:** R-4/R-12 (*"a replacement never destroys the working version until the new one commits Ready"*).

**Evidence**
- One artefact per document (`KnowledgeBlobPaths.cs:93-94` `…/_artifacts/{docId}.json.gz`), written by the incoming run before chunking/embedding (`KnowledgeIngestProcessorFunction.cs:865-893`, *"Written before chunking and embedding"*).
- Same for the DI bank (`KnowledgeBlobPaths.cs:100-101`; write at `:1471`).
- Readers reject a hash mismatch (`KnowledgeContentArtifactStore.cs:70`); stale comment at `:141-142` (*"The document is already fully indexed by the time this runs"*).

**Scenario.** Replacement refused at the overflow gate (`:1093-1106`) or by exhausted embeddings → D-1 keeps v1, but v1's artefact now holds v2's parse → Business Search document text for v1 is blank (`BusinessSearchDocumentService.cs:106-113`), and the next Read again of v1 re-pays DI, describe and captions.

**Fix.** Key the artefact/DI bank by content hash (or write to a pending slot promoted in the Ready commit).

**Confidence:** high.

---

### P4-C-14 — MEDIUM — Duplicate-of-another-document replacement leaves pending state on a Ready row

**Evidence**
- `KnowledgeIngestProcessorFunction.cs:3057-3061`:
  ```csharp
  r.Status = KnowledgeDocumentStatus.Ready;
  r.FailureReasonKey = "Error_KnowledgeDuplicateOfAnotherDocument";
  ```
  No `PendingBlobPath/PendingDocName/ProcessingSince` reset, no candidate delete — unlike `KeepTheAnsweringVersionAsync` (`:3461-3463`, `:3474-3475`).
- Uses `FailureReasonKey` on a Ready row against the file's own rule (`:60-63` *"`FailureReasonKey` says why a document is NOT usable, and nothing else"*).
- Every later run reads the candidate: `:557` `var sourceBlobPath = row.PendingBlobPath ?? row.BlobPath;`
- The guard models the pre-E1 shape: `KnowledgeIngestProcessorFunctionTests.cs:4793-4796` *"ConfirmUploadsAsync nulls ContentHash and PageCount on a Replace"* — no PendingBlobPath set, nothing asserted about it.

**Scenario.** Provider replaces doc A with a file identical to doc B → A stays Ready (correct) but carries B's bytes as pending for ever; every Read again or details re-cut of A re-reads B's bytes and hits the same refusal; A can never be re-read.

**Fix.** Route through `KeepTheAnsweringVersionAsync` with a duplicate notice key; rewrite H7 with a real `PendingBlobPath`.

**Confidence:** high.

---

### P4-C-15 — MEDIUM — "Descriptions unavailable" keep path bypasses D-1 and mishandles a replacement

**Evidence**
- `KnowledgeIngestProcessorFunction.cs:979-992`:
  ```csharp
  // A Replace nulls PageCount unconditionally and a first upload has no passages …
  if ((row.PassageCount ?? 0) > 0 && row.PageCount != null)
  { await CommitAsync(… r.Status = Ready; r.FailureReasonKey = null; r.SizeBytes = measuredSize; …
  ```
  Since E1 a replace does NOT null PageCount (`KnowledgeManagementService.cs:186-201` sets only Pending*, Status, ProcessingSince, FailureReasonKey, DocType/links, access).
- No notice (D-1 requires *"Ready + a notice naming what failed"*); `ProcessingSince`, `PendingBlobPath`, `PendingDocName` left; `SizeBytes` becomes the rejected file's.
- Tests pin "no notice": `KnowledgeIngestProcessorFunctionTests.cs:2271-2291`.

**Scenario.** Replace a photographed menu (PDF/image, PageCount set) while captioning is failing → row Ready, no notice, the new file's size shown on the old version, the candidate pending for ever (same consequences as P4-C-14).

**Fix.** Delete the special branch; `FailAsync`'s D-1 path already does the right thing for PassageCount > 0.

**Confidence:** high.

---

### P4-C-16 — MEDIUM — Failed replacement of a Failed document

**Evidence**
- `FailAsync` Failed branch (`:3604-3613`) never touches `PendingBlobPath/PendingDocName/DocName/BlobPath/SizeBytes`, but writes `PageCount = observedPages` (the NEW file's).
- Notification names `row.DocTitle ?? row.DocName` (`:3370`) — the old file.
- A further replace overwrites the pointer (`KnowledgeManagementService.cs:191`), orphaning the previous candidate; the sweeper claims every blob under an existing docId (`KnowledgeOrphanUploadSweeper.cs:65-73`).
- U-07 made Replace the primary action on Failed rows (web `knowledgeMeta.js` `resolveDocumentRowActions`).

**Scenario.** `menu-v1.pdf` Failed (too many pages); provider replaces with `menu-v2.pdf` (also too long) → row reads "menu-v1.pdf — this file has 140 pages…" (v2's count, v1's name), push says the same; Download returns v1.

**Fix.** In the Failed branch, adopt the pending file as the document (name, blob, size) and delete the old failed blob.

**Confidence:** high.

---

### P4-C-17 — MEDIUM — L-11 drain loop and a nightly false alarm

**Evidence**
- `ServiceBusService.cs:777-819`: kept messages are abandoned (`:815`) and the loop keeps receiving on the same receiver until `seen >= maxMessages` (`:777`), so the same head messages are re-received and re-counted; with ≥32 kept at the head, removable ones behind them are never reached. Comment `:814` *"with its delivery count untouched by this look"* is wrong (abandon increments it).
- `KnowledgeMaintenanceFunction.cs:97-104` keeps any message whose row exists; `:118-123` alerts *"the row will sit unfinished until someone acts"*.
- But every ingest dead-letter is preceded by a terminal stamp (`KnowledgeIngestProcessorFunction.cs:372-377` then `:424-428`), and analytics-lane dead-letters are on Ready rows — so "unfinished" is false and the alert repeats nightly for ever.
- Only mocks exercise `DrainDeadLetterAsync` (grep); the live proof (§LIVE-ACCEPTANCE row 7) had only removable messages.

**Fix.** Browse with `PeekMessagesAsync` or hold locks and abandon after the loop; remove a message when the row is no longer Processing; count distinct message ids.

**Confidence:** high on the code; re-receive ordering is NEEDS-LIVE-PROOF.

---

### P4-C-18 — MEDIUM — E3 half built

**Evidence**
- `KnowledgeManagementService.cs:439-445`: committed CAS on the request token, then `var saved = await _repository.GetAsync(businessId, docId, cancellationToken);` before the (None-token) enqueue.
- `:878-886` same for details; the restore compensation (`:888-899`) only wraps the send and filters `ex is not OperationCanceledException`.
- Create/replace commits (`:203`, `:237`) also run on the request token; an OCE raised after a committed write is indistinguishable.

**Scenario.** Mobile provider presses Read again and loses signal after the CAS lands → row Processing with a cleared hash and no message until Stopped (160 min). For a details edit, the row keeps the new type/links, the cards the old, and a re-save hits the "changed nothing" return (`:863-864`) — drift for ever.

**Fix.** Once the commit is attempted, run commit + read + enqueue (+ compensation) on `CancellationToken.None`.

**Confidence:** high.

---

### P4-C-19 — MEDIUM — Blob download failures are terminal

**Evidence** `KnowledgeIngestProcessorFunction.cs:610-616`:
```csharp
catch (Exception ex) when (ex is not OperationCanceledException)
{
    // X3: row present but blob missing is a storage anomaly — Failed, never silent success.
    …
    await FailAsync(businessId, docId, "Error_KnowledgeGenericRetry", ct);
    await NotifyDocumentFailedAsync(…);
    return;
```
A missing blob already throws earlier (`GetBlobSizeAsync`, `AzureStorageService.cs:783-788`), so this catch now mostly sees transient read failures (Storage throttles with 503). Terminal ⇒ first upload Failed; replacement ⇒ D-1 deletes the candidate (P4-C-06).

**Fix.** Keep the size-changed guard terminal; classify I/O failures as retryable.

**Confidence:** medium-high (SDK retries absorb short blips; persistent ones reach this).

---

### P4-C-20 — LOW — MetadataOnly hijacks a Processing row between passes

`KnowledgeIngestProcessorFunction.cs:511-517` reasons *"A Processing row is an UNFINISHED re-cut — the session is the businessId, so no other run of this business can be holding it"*; with E12 a queued continuation holds it. The details save is allowed during Processing (`KnowledgeManagementService.cs:849-853`), so its MetadataOnly message can arrive between passes → `BeginRecutAsync` (`:3210-3218`) resets `ProcessingSince`, clears the hash, and starts a second chain at `Continuation 0` with a fresh AI allowance. Fix: skip the re-cut while a continuation is in flight (e.g. a pass marker on the row). Confidence: medium.

### P4-C-21 — LOW — E5 residual

`KnowledgeConfirmFileDto.FileName` is `[Required]` only (`KnowledgeDtos.cs:64-65`) and is stored raw as `DocName` (`KnowledgeManagementService.cs:227`) — no length bound, no sanitising at confirm (SAS-time `SanitizeFileName` strips control characters only and bounds nothing); `ContentType` (`:67`) is still accepted and read nowhere; `SizeBytes = file.FileSize` (`:232`) although the controller measured `uploadedBytes` (`KnowledgeController.cs:395-396`) — Failed first uploads keep the client's number for ever. `MaxFilenameLength` is read by no C# code (grep).

### P4-C-22 — LOW — E9.2 residual

`KnowledgeOrphanUploadSweeper.cs:67-73`: *"A row that exists — in ANY state … owns its bytes"*. A replacement uploaded but never confirmed, or refused at confirm as busy, sits under an existing docId and is never swept (only document deletion's prefix purge removes it). PHASE-2B-PROMPT.md:317 listed this: *"(this is also where a failed replacement's candidate blob must go)"*.

### P4-C-23 — LOW — Redelivered continuation can replay an older degraded artefact

`:696-713` gate re-extraction on `deliveryCount <= 1`; `message.Continuation` (documented at `KnowledgeIngestQueueMessage.cs:38-41` precisely to stop *"a redelivered continuation would replay the degraded parse"*) is not consulted. A redelivered pass of a Read again over bytes whose previous run ended degraded replays that older reading and commits. Confidence: medium (UNCERTAIN on frequency).

### P4-C-24 — LOW — Flag commit result ignored

`:1176` `await CommitAsync(businessId, docId, r => r.CardsRewriting = true, ct);` — a `false` (row deleted/Deleting since `:1158`) still proceeds to upsert; the final commit then purges. Wasted writes only.

### P4-C-25 — LOW — API MarkDeleting does not clear the flag

`KnowledgeManagementService.cs:399-402` sets Deleting without `CardsRewriting = null`; the Functions copy does (`:3255-3256` *"same invariant, stated here too"*). Harmless (Deleting never answers), but the invariant as stated holds in one of two writers.

### P4-C-26 — LOW — Back-compat fallback

`KnowledgeProcessingRules.cs:23` `utcNow - (row.ProcessingSince ?? row.UpdatedAt)`; every Processing writer stamps `ProcessingSince` (`KnowledgeManagementService.cs:194, 231, 433`; `KnowledgeIngestProcessorFunction.cs:3215`). Pre-production (§22.10).

### P4-C-27 — LOW — Meter vs gate

`KnowledgeController.cs:146` `rows.Sum(r => r.PassageCount ?? 0)` is the meter; every gate counts the index (`KnowledgeManagementService.cs:643-652`, E9.3). When they drift (G-L1) the meter shows room the gate refuses, or vice versa.

### P4-C-28 — LOW — Merge erases survivor notices

`KnowledgeIngestProcessorFunction.cs:3205` `survivor.ReadingNotices = [new KnowledgeReadingNotice { Key = DuplicateMergedReasonKey }];` — replaces the survivor's own E7 notices (pictures lost, ran out of time).

### P4-C-29 — LOW — Superseded archive not re-attempted

A crash between the Ready commit (`:1228`) and `KeepSupersededSourceAsync` (`:1304-1305`) strands the old blob under the live prefix (never swept, P4-C-22) and no `PreviousSource` is written; the Ready exit (`:538-553`) re-posts thumbnails and analytics only.

### P4-C-30 — LOW — E8 residual

`KnowledgeController.cs:152` serves `IngestTimeoutSeconds / 60` (30 min) as the processing budget; an E12 chain legitimately runs several passes plus queueing, so the client ladder stops and says checking stopped mid-chain.

### P4-C-31 — LOW — Picture allow-list vs R-10

`KnowledgeDocumentRepository.cs:230-237` filters `c.status = @ready` and says *"the send gate requires Ready"*; since R-10 the row rule `Decide` admits Processing (`KnowledgeSearchVisibility.cs:84-86`; used by `KnowledgeTools.cs:340`). Conservative divergence; comments at `:230-231` and `:268-272` are now false.

### P4-C-32 — LOW — Stale "≤220 rows"

`KnowledgeDocumentRepository.cs:170-177` *"Type is indexed; ≤220 three-field rows per voice search"* — with the document cap removed (e6740b1) a business can hold ~2,000 single-card documents + 200 FAQs; this full-partition projection runs on every voice search (and `ListSearchVisibleDocIdsAsync` on every Business Search).

### P4-C-33 — LOW — 500 for caller conditions

`KnowledgeManagementService.cs:246` `throw new InvalidOperationException($"Document id {file.DocId} already exists and was not overwritten.")` and `:212` → `BaseController.ResolveCallerFailure` (message is not a key) → 500 `Error_InternalServerError`. No developer sentence leaks (verified), but a confirm missing `isReplace` gets "Internal server error".

### P4-C-34 — LOW — Replace SAS on a Stopped target

`KnowledgeController.cs:270` `busy = target?.Status is Processing or Deleting` → *"wait until it finishes processing"* for a stopped run that never will (U-04 withholds Replace in both apps, so only a stale client or a race reaches it).

### P4-C-35 — IMPROVEMENT

The polled list reads the same profile twice per poll: `ReceptionistAvailability.cs:28` and `KnowledgeManagementService.cs:682` (via `KnowledgeController.cs:104-106`).

---

## 3. Closure check (dimension C ids)

| Id | Status |
|---|---|
| E1 / R-4 / R-12 | **FIXED-AND-VERIFIED-IN-CODE** for the main path (`KnowledgeManagementService.cs:186-201`; promotion `KnowledgeIngestProcessorFunction.cs:1248-1254`; archive after Ready `:1304-1305`, `:3014-3050`; keep `:3450-3476`; download `KnowledgeController.cs:752-765`). **Residuals → P4-C-13, -14, -15, -16** |
| E2 | **NOT-FIXED for non-extraction failures** → P4-C-05 (extraction path fixed `:340-362`, `:441-451`) |
| E3 | **PARTIAL** — enqueue on None (`KnowledgeManagementService.cs:290-296`), delete on None (`:329-339`); commit→enqueue window remains → P4-C-18 |
| E4 | **FIXED-AND-VERIFIED-IN-CODE** (`KnowledgeIngestProcessorFunction.cs:3405-3410`, business cap `:3373-3376`) |
| E5 | **PARTIAL** — measured size on Ready (`:1247`), confirm measures (`KnowledgeController.cs:395-409`); name bound, dead field, non-Ready size → P4-C-21 |
| E6 | **FIXED-AND-VERIFIED-IN-CODE** (`KnowledgeProcessingRules.cs:22-24`; stamped at every Processing writer; cleared `:1238`, `:3461`, `:3608`); fallback nit P4-C-26 |
| E7 / R-9 | **FIXED-AND-VERIFIED-IN-CODE** (`KnowledgeReadingNotices.From`, `:1211-1231`) |
| E8 | **PARTIAL** (served `KnowledgeController.cs:152`) → P4-C-30 |
| E9.1 | FIXED-AND-VERIFIED-IN-CODE (`:589-593`) |
| E9.2 | **PARTIAL** → P4-C-22 (built `KnowledgeOrphanUploadSweeper.cs`, bound `%KnowledgeMaintenance:TimerSchedule%` in `local.settings.json:72`, `deploy.ps1:7361/8332`); live NEEDS-LIVE-PROOF (sandbox refreshed) |
| E9.3 | FIXED-AND-VERIFIED-IN-CODE for gates (`KnowledgeManagementService.cs:648-652`, `:3338-3343`, `:1089-1091`); meter residual P4-C-27 |
| E9.4 | FIXED-AND-VERIFIED-IN-CODE (`:3633-3638`, alert only on `CouldNotWrite` `:383-386`) |
| E9.5 | FIXED-AND-VERIFIED-IN-CODE (`KnowledgeReplaceTargetException`, `KnowledgeController.cs:419-429`) |
| E9.6 | FIXED-AND-VERIFIED-IN-CODE (single buffer + grew/shrank guard `:595-609`); classification side-effect P4-C-19 |
| E10 | FIXED-AND-VERIFIED-IN-CODE (`:947-951`) |
| E11 / L-11 | **BUILT with defects** → P4-C-17; live proof of the kept path NEEDS-LIVE-PROOF |
| C1 / R-5 | **PARTIAL** — extraction classified (`:748-763`, `TerminalReasonFor :3671-3695`); outage-as-unreadable persists via D-1 notices (P4-C-06) and blob reads (P4-C-19); embedding not retryable (P4-C-05) |
| C2 | FIXED-AND-VERIFIED-IN-CODE (`:3671-3713`) |
| D-1 unified rule | **IMPLEMENTED** (`:3586-3590`, no exclusion) but **REGRESSED against R-10** → P4-C-01; bypassed by P4-C-14/-15 |
| F-5 | **PARTIAL** → P4-C-06 (size + space reasons chosen `KnowledgeReadingNotices.cs:86-93`) |
| F-6 | FIXED-AND-VERIFIED-IN-CODE (no `refusedDeliberately`; pickup/overflow/char cap all keep, `:3349-3350`, `:1105-1106`, `:809`) |
| F-7 | FIXED-AND-VERIFIED-IN-CODE (`KnowledgeController.cs:266-277`; `KnowledgeManagementService.cs:164-173, 204-205`); Stopped nit P4-C-34 |
| R-10 set / clear / MarkDeleting / only-adds | Set `:1176` ✓, cleared in `CommitAsync :3238` ✓, Functions MarkDeleting `:3256` ✓ (API copy not, P4-C-25), rule only adds ✓ (`KnowledgeSearchVisibility.cs:84-91`, SQL `:70-73` NOT IS_DEFINED first ✓) — **but the system-level property is broken → P4-C-01** |
| U-04 | FIXED-AND-VERIFIED-IN-CODE (rule shared by gate + DTO) — **misfires on E12 chains → P4-C-09**; live NEEDS-LIVE-PROOF |
| U-07 | FIXED server-side (SAS/confirm accept Failed targets); failure path defect P4-C-16 |
| L-12 / G-L1 | **NOT-FIXED** (reconciliation) → P4-C-08; ingest-time check + bounded poll built (`:3492-3546`) |
| X-07 | FIXED for image cap (`:702-709`); **defeated for multi-pass forced reindex → P4-C-11** |

---

## 4. Verified OK (checked and fine)

- **No cross-partition Cosmos query** in scope: every `KnowledgeDocumentRepository` read passes `PartitionKey(businessId)` or is a point read (`:52-66, :72-74, :102-106, :126-130, :148-151, :175-178, :234-246, :277-281, :305-308`); writes pass the pk (`:403, :424-427, :453-458, :478-479, :508-512, :581-586`). Profile override read is a point read (`BusinessProfileRepository.cs:27-33`); sweeper and drain predicates are point reads.
- **Conditional writes are never replayed** (`KnowledgeDocumentRepository.cs:418-434, 447-470, 503-523`); every status write is ETag-CAS with re-read (`CommitAsync :3229-3243`, `MarkDeletingAsync :3248-3260`, all API mutations). No blind upsert of a knowledge row anywhere (grep `UpsertAsync`).
- **Answerable SQL = C# rule**; `NOT IS_DEFINED(c.cardsRewriting)` precedes the `= false` test; `passageCount > 0` required (`KnowledgeSearchVisibility.cs:70-91`); entity writes the flag with `NullValueHandling.Ignore` so a cleared flag is absent, never `null`.
- **Tombstone abort**: row re-read before the flag/commit (`:1158-1170`), commit returns false on Deleting/gone → `DeleteMarkedAsync` (`:1293-1298`), committed row re-read (`:1307-1313`); `DeleteMarkedAsync` refuses a non-Deleting row (`KnowledgeDocumentDataPurger.cs:138-142`) and purges prefix, images, artefact, DI bank, OCR, `_previous` (`:74-119`).
- **Redelivery after a Ready commit** is idempotent and heals thumbnails + the analytics ticket (`:538-553`); analytics ids are generation-scoped (`KnowledgeAnalyticsQueue.cs:34-35`); thumbnail epoch = row `UpdatedAt` (`:2315-2316`).
- **Concurrency — two members replacing / replace vs delete / reprocess vs replace**: all serialize on the row CAS and the status checks (`KnowledgeManagementService.cs:159-215, 385-409, 411-449`); the loser gets the busy/gone sentence. Only the candidate-blob leak remains (P4-C-22).
- **API ⇄ Functions passage rule identical**: `KnowledgeIngestProcessorFunction.cs:3316-3326` vs `KnowledgeManagementService.cs:679-706`; defaults 2,000 in both appsettings (`Functions:1262`, `API:235`) and the class (`VoiceKnowledgeSettings.cs:20`). Space checks agree: SAS `used >= max`, pickup `others >= max`, reprocess `used - own >= max`, FAQ `passages >= max`; grace only at the overflow gate. A failed profile read propagates everywhere (no guessed ceiling).
- **Override write** is a field-scoped ETag patch refusing values < 1 (`BusinessProfileRepository.cs:440-464`); entity STJ-ignored so the partner endpoints never expose it (`Cosmos.cs:213-219`); every full-replace writer reads-then-writes via Newtonsoft (grep).
- **Queue identity**: non-canonical ids dead-lettered with an alert before any I/O (`:233-258`); enqueue/delete on `CancellationToken.None`; delete ids are unique GUIDs (`KnowledgeManagementService.cs:338`).
- **G-L1 bounded poll** honours the token and returns on first look (`:3534-3546`).
- **Indexer**: one business and one document per batch (`KnowledgeSearchIndexer.cs:131-146`), byte-bounded pages (`:205-218`), 413 splits (`:246-257`), capacity pressure alerts and never isolates (`:226-236, :287-290`), row-level business verification on every paged read (`:455-461`), AI-cache artefact written under a lease before cards (`:151-155`).
- **No developer sentence reaches a provider**: failure reasons are keys; the API's `ResolveCallerFailure` turns a non-key `InvalidOperationException` into a localized 500 (`BaseController.cs:604-632`) — only the status class is questionable (P4-C-33).
- **Maintenance timer** binding exists in both `local.settings.json:72` and `deploy.ps1:7361, 8332`; the two jobs are independent and each alerts with `forceAdminAlert` (`KnowledgeMaintenanceFunction.cs:56-131, 159-171`).
