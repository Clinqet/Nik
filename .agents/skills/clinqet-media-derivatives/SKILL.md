---
name: clinqet-media-derivatives
description: |
  **CROSS-CUTTING PIPELINE SKILL** — Work on the media-derivatives pipeline: a single
  Service-Bus-triggered Azure Function that generates WebP `thumbnail` + `medium`
  variants for images and dimensions/metadata for every parent entity that owns media.
  Six parent entities use it today: profile pic, portfolio items, service photos, review
  images, license documents (PDFs skip variants), and chat (message) attachments.
  Architecture is **Service Bus + post-on-create + point-target patch** — NOT Event Grid
  blob events + find-by-URL (the original design; refactored 2026-05-11).
  USE FOR: adding a new parent entity to the pipeline, debugging derivative race
  conditions, tuning thumbnail/medium sizes, idempotency, EXIF orientation handling.
  Applies to clinqetinfrastructure/Services/Storage/MediaDerivativeService.cs,
  clinqetfunctions Functions/MediaDerivativeProcessorFunction.cs,
  clinqetshared/DTOs/Messages/MediaDerivativeQueueMessage.cs,
  every repository implementing `UpdateXxxDerivativesByIdAsync`.
---

# CLINQET MEDIA DERIVATIVES — COMPREHENSIVE SKILL

> Background: Phase 1A (chat) shipped 2026-05-09. Phase 1B+1C bug-fix sweep shipped 2026-05-10 (12 fixes, 26 new tests). Phase 2 (reviewimages + licensedocuments) shipped same day. Service Bus refactor (replacing Event Grid + find-by-URL) shipped 2026-05-11 (all phases 1-12, 48-item double audit, 3955 unit tests pass). Plan files: `MEDIA_DERIVATIVES_PLAN.md`, `MEDIA_DERIVATIVES_SERVICEBUS_REFACTOR_PLAN.md`.

---

## ARCHITECTURE — Service Bus + Point-Target Patch

```
Controller (POST /xxx) — creates parent doc with attachment[].processingStatus = Pending
   │
   └─► IServiceBusService.SendMessageAsync<MediaDerivativeQueueMessage>(...)
         │  payload includes the EXACT point-target:
         │   ParentContainer, ParentDocId, ParentPartitionKey,
         │   ParentArrayField, ParentArrayIdField, ItemId,
         │   BlobContainer, BlobName, OriginalUrl, ContentType
         ▼
   media-derivatives queue
         │
         ▼
   MediaDerivativeProcessorFunction (ServiceBusTrigger)
         │
         ├─► If PDF: skip variants — leaves ProcessingStatus null (license docs)
         ├─► Else: download blob → MediaDerivativeService.GenerateAsync
         │      ├─ thumbnail.webp  (max edge = ThumbnailMaxEdge)
         │      └─ medium.webp     (max edge = MediumMaxEdge, only if original larger)
         ├─► Upload derivatives to SAME blob container (naming: `{name}__thumb.webp`, `{name}__medium.webp`)
         ├─► Switch on ParentEntity → call the corresponding repo helper:
         │      .UpdateProfilePicDerivativesByIdAsync
         │      .UpdatePortfolioImageDerivativesByIdAsync
         │      .UpdateServicePhotoDerivativesByIdAsync
         │      .UpdateReviewImageDerivativesByIdAsync
         │      .UpdateLicenseDocumentDerivativesByIdAsync  (only sets ProcessingStatus on images; PDFs leave null)
         │      .UpdateAttachmentDerivativesByIdAsync       (chat)
         │  Each is a CONDITIONAL Cosmos PATCH: filters by ItemId match in the parent's array
         │  to prevent race when the array index has shifted.
         └─► On exception: FailureNotificationHelper → admin alert; abandon (retry); DLQ on final retry.
```

**Why this design (vs old Event Grid + find-by-URL):**
- Point-target patch is O(1) — no scan of parent docs by URL.
- Idempotent: the patch filter on ItemId means redelivered messages are safe.
- Decoupled: failures don't cascade across parent types.
- Service Bus DLQ + retry policy is more deterministic than Event Grid's at-least-once-with-implicit-retry.

## WhatsApp inbound media — a NEW PRODUCER, not a new parent (Phase 2, 2026-06-02)
WhatsApp inbound media does **not** add a 7th parent — it feeds the EXISTING **chat/Message** parent (`MediaParentEntity.Message`, the `.UpdateAttachmentDerivativesByIdAsync` path) from a new producer. `WhatsAppMediaIngestor` (`clinqetinfrastructure/Services/Communication`) downloads the Meta media (`IWhatsAppService.DownloadMediaAsync`, Bearer + Polly), validates MIME against `MessagingSettings.AllowedAttachmentMimeTypes` (**NOT widened**) + a bounded size cap (`WhatsAppSettings.MaxInbound{Media=16,Document=100}SizeMb`), uploads to `messageattachments` with a deterministic blobName `{biz}/{cust}/{sha(wamid)[..20]}{ext}` (crash-safe re-upload). Then `IMessageService.IngestInboundExternalMessageAsync` writes the Pending `MessageAttachment` + posts the usual `MediaDerivativeQueueMessage{ParentEntity=Message}` (image/video only; docs/audio ⇒ `ProcessingStatus=Skipped`, no derivative). **Fail-soft**: a media failure never blocks the caption and never rethrows (a rethrow would re-fire the inbound's provider notification on retry).

---

## MESSAGE DTO — `MediaDerivativeQueueMessage`

`clinqetshared\DTOs\Messages\MediaDerivativeQueueMessage.cs` (inherits `ServiceBusMessageBase` for CorrelationId).

| Field | Required | Purpose |
|-------|----------|---------|
| `ParentEntity: MediaParentEntity` | yes | enum: `ProfilePicture`, `Portfolio`, `ServicePhoto`, `Review`, `License`, `Message` |
| `ParentContainer` | yes | Cosmos container name |
| `ParentDocId` | yes | full composite doc id |
| `ParentPartitionKey` | yes | partition value |
| `ParentArrayField` | yes | e.g. `"images"`, `"attachments"`, `"documents"`, `"photos"` |
| `ParentArrayIdField` | yes | the id field within an array element (e.g. `"imageId"`, `"attachmentId"`) |
| `ItemId` | yes | the array-element id to patch |
| `BlobContainer` | yes | source blob container |
| `BlobName` | yes | the blob name within container |
| `OriginalUrl` | yes | full original URL |
| `ContentType` | yes | mime type (drives PDF-skip decision) |

`ServiceBusMessageBase.MessageId` is a GUID; used for Service Bus dedup window.

---

## ENUMS

- `MediaParentEntity`: `ProfilePicture`, `Portfolio`, `ServicePhoto`, `Review`, `License`, `Message`
- `MediaProcessingStatus`:
  - `Pending` — controller wrote the parent doc with attachment but processor hasn't run
  - `Processing` — processor in flight (optional intermediate state)
  - `Completed` / `Ready` — derivatives uploaded, URLs patched (messaging uses `Completed`, reviews use `Ready` — value set is shared; do not introduce more states without ADR)
  - `Failed` — derivative gen failed (admin alerted)
  - `Skipped` — non-image (PDF) or explicitly skipped
- Both have `[JsonConverter(typeof(JsonStringEnumConverter))]`.

---

## CORE SERVICE — `MediaDerivativeService`

`C:\Nik\clinqetinfrastructure\Services\Storage\MediaDerivativeService.cs`

- `GenerateAsync(Stream original, MediaDerivativeOptions options)` → `(thumbStream, mediumStream?, width, height)`.
- Image processing via ImageSharp:
  - Honor EXIF orientation BEFORE resizing (memory `project_media_derivatives_phase_1bc` — Fix #5 EXIF order).
  - WebP encoding at quality from settings.
  - `Resize` mode = `Max` (preserves aspect ratio, fits inside box).
  - Skip medium if original max edge ≤ `MediumMaxEdge`.
- Returns dimensions of the ORIGINAL (for client responsive layouts).

`MediaDerivativeSettings` in shared settings:
- `ThumbnailMaxEdge` (default 256 px)
- `MediumMaxEdge` (default 1024 px)
- `WebpQuality` (default 75)
- Per-entity overrides allowed.

---

## FUNCTION — `MediaDerivativeProcessorFunction`

`C:\Nik\clinqetfunctions\Clinqet.Communications\Functions\MediaDerivativeProcessorFunction.cs`

```csharp
[Function("MediaDerivativeProcessor")]
[ServiceBusTrigger("%ServiceBusSettings:MediaDerivativesQueueName%", Connection = "ServiceBusConnection")]
```

Per-message flow:
1. Deserialize `MediaDerivativeQueueMessage`. Dead-letter on bad schema.
2. If `ContentType` starts with `application/pdf`: invoke entity-specific repo helper with `ProcessingStatus = Skipped`, no derivatives. Complete message.
3. Download blob from `BlobContainer`/`BlobName` via `IStorageService`.
4. Call `MediaDerivativeService.GenerateAsync`.
5. Upload thumb (always) and medium (if generated) to SAME container with derived names.
6. Build the per-entity update record (e.g. `ReviewImageDerivativeUpdate`, `MessageAttachmentDerivativeUpdate`).
7. Switch on `ParentEntity` → call the corresponding repo helper. Each:
   - Loads parent doc.
   - Finds array element by `ParentArrayIdField == ItemId`.
   - Patches at the resolved index with `ThumbnailUrl`, `MediumUrl`, `Width`, `Height`, `ProcessingStatus`, `ProcessedAt`.
   - **Conditional** on the array-element id still matching (race safety).
8. Complete on success. On exception, `FailureNotificationHelper.HandleSystemFailureAsync` then abandon (retry) or DLQ.

Idempotency: re-delivery patches identical values → no-op. Conditional check guards against the array-element id having shifted indices.

---

## REPOSITORY HELPERS (`clinqetinfrastructure\Data\COSMOS\`)

Every parent-owning repository implements one such helper. **Always conditional on the array-element id.**

| Repo | Method | Container | Array field |
|------|--------|-----------|-------------|
| `BusinessProfileRepository` | `UpdateProfilePicDerivativesByIdAsync` | `ProviderData` | top-level (single image — patches `/profilePic/...`) |
| `PortfolioProjectRepository` | `UpdatePortfolioImageDerivativesByIdAsync` | `ProviderData` | `/items[]/imageId` |
| `ServiceRepository` | `UpdateServicePhotoDerivativesByIdAsync` | `ProviderData` | `/photos[]/imageId` |
| `ReviewRepository` | `UpdateReviewImageDerivativesByIdAsync` | `Reviews` | `/images[]/imageId` |
| `LicenseRepository` | `UpdateLicenseDocumentDerivativesByIdAsync` | `ProviderData` | `/documents[]/documentId` — PDFs leave ProcessingStatus null |
| `MessageRepository` | `UpdateAttachmentDerivativesByIdAsync` | `Messages` | `/attachments[]/attachmentId` |

Each helper takes its own typed `*DerivativeUpdate` record so the patch payload is strongly typed.

---

## CONTROLLERS — controller-side requirements

When a controller persists media-bearing entities, it MUST:

1. Write each attachment with `processingStatus: Pending` and known `attachmentId/imageId/etc`.
2. Immediately publish a `MediaDerivativeQueueMessage` per attachment via `IServiceBusService.SendMessageAsync`. NEVER schedule, NEVER batch (one message per attachment for trace clarity).
3. Return the entity with attachments in `Pending` state — the client must render a placeholder until the URL is patched.

Frontend must poll OR subscribe to a signal (depending on entity) for the updated parent doc; for chat, the message broadcast on send already carries the post-derivative shape if processing is fast — otherwise the client refetches the message later. For reviews, the next GET on the review returns the updated `images[]` with full URLs.

---

## COSMOS INDEX REQUIREMENTS

Every parent container that uses derivatives needs `/<arrayField>[]/<idField>/?` and `/updatedAt/?` indexed for the conditional patch. Verified in:
- Reviews: `/images/[]/imageId/?`, `/images/[]/url/?`, `/updatedAt/?`
- Messages: `/attachments/[]/attachmentId/?`, `/updatedAt/?`
- ProviderData: `/items/[]/imageId/?`, `/photos/[]/imageId/?`, `/documents/[]/documentId/?`, `/documents/[]/url/?`, `/updatedAt/?`

When adding a new parent entity to the pipeline, update `cosmosindexsetup\Program.cs` for the parent's array-id and updatedAt indexes.

---

## BLOB CONTAINERS (`azureautomation` ARM + `deploy.ps1`)

Today's containers used by the pipeline:
- `profilepictures`
- `portfolioimages`
- `servicephotos`
- `reviewimages`
- `licensedocuments` (images + PDFs)
- `messageattachments` (images + videos + docs)

Each derivative lives in the SAME container as the original. Naming: `{originalName}__thumb.webp`, `{originalName}__medium.webp`.

When adding a new parent entity:
1. Provision the blob container in ARM + `deploy.ps1`.
2. Add it to `StorageSettings.Containers`.
3. Wire the SAS-issuance flow in the controller (`IStorageService.GenerateBulkSasUrlsAsync` with the new container).
4. Wire `BlobContainer` field in the `MediaDerivativeQueueMessage` publish.

---

## SETTINGS — `MediaDerivativeSettings`

```jsonc
"MediaDerivativeSettings": {
  "ThumbnailMaxEdge": 256,
  "MediumMaxEdge": 1024,
  "WebpQuality": 75,
  "PerEntityOverrides": {
    "Message": { "ThumbnailMaxEdge": 256, "MediumMaxEdge": 720 },
    "Review":  { "ThumbnailMaxEdge": 300, "MediumMaxEdge": 1200 }
  }
}
```

`ServiceBusSettings:MediaDerivativesQueueName` (default `"media-derivatives"`).

Keep class defaults synchronized to `appsettings.json`.

---

## FAILURE RECOVERY + CLIENT UX (2026-07-22)

- `IMediaDerivativeFailureMarker` / `MediaDerivativeFailureMarker` is the single scoped route for marking Message, Service, Portfolio, Review, License, and BusinessProfile media as `Failed`. Both processor exceptions and final queue-publication failures use it.
- Failure marking is partition-scoped. Array parents use a point read, resolve the target by stable item id, then PATCH with `IfMatchEtag`. A bounded conflict retry re-reads and resolves the id again so a reordered or removed neighbor is never patched.
- Failure never removes or replaces the original URL. A later successful redelivery may move the same item from `Failed` to `Ready` or `Skipped` idempotently.
- Provider clients expose only local transfer states: not saved, uploading with real device-to-blob progress, saved, and failed with retry. Backend `Pending`, `Failed`, derivative generation, and queue details are internal and must not produce an optimization spinner or technical copy.
- All image consumers render the original immediately and prefer thumb/medium only when present. Ready/Skipped therefore swaps to the derivative silently; backend failure continues to show the original.
- Portfolio uploads preserve successful files after partial failure and retry only failed files against the same portfolio record. Native gallery items use stable client ids, retain their local preview, and use theme icons/tokens for state badges.

Required proof: unit coverage for all six failure-marker routes and ETag conflict/reorder behavior; real Cosmos-emulator integration coverage that each parent becomes `Failed` while its original URL remains unchanged.

---

## TESTS

Coverage requirements (per Phase 1B/1C/2 audit):
- Unit `MediaDerivativeServiceTests` — EXIF orientation order, WebP encoding, resize Max mode, skip medium when original ≤ MediumMaxEdge, PDF skip path.
- Unit per repo helper — patch builds correctly, conditional filter on ItemId, no-op on stale index.
- Unit `MediaDerivativeProcessorFunctionTests` — each ParentEntity branch, PDF-skip branch, exception → abandon, final-retry → DLQ + admin alert.
- Integration `MediaDerivativeProcessorFunctionIntegrationTests` — Service Bus + Cosmos emulator + Blob emulator end-to-end for each parent entity.
- Integration controller tests for each upload flow — assert `processingStatus=Pending` on create, then assert post-derivative state via a follow-up GET.

`3955+` unit tests passing on last run (memory `project_media_derivatives_servicebus_refactor`). Don't drop coverage when adding a new parent.

---

## ADDING A NEW PARENT ENTITY — 10-STEP CHECKLIST

1. Define / extend the parent Cosmos entity to carry an attachments array with `id`, `url`, `thumbnailUrl?`, `mediumUrl?`, `width?`, `height?`, `processingStatus`, `processedAt?` (or top-level fields if single-image like profile pic).
2. Add a value to `MediaParentEntity` enum (string-serialized).
3. Implement a typed `*DerivativeUpdate` record (immutable).
4. Implement `Update<X>DerivativesByIdAsync` on the parent repo — conditional patch on id-field match.
5. Add Cosmos indexes for the new array-id path and `/updatedAt/?` in `cosmosindexsetup\Program.cs`.
6. Provision the blob container in ARM + `deploy.ps1` + `StorageSettings.Containers`.
7. Wire the controller upload flow: SAS issuance → save parent doc with `Pending` → publish `MediaDerivativeQueueMessage`.
8. Extend `MediaDerivativeProcessorFunction` switch on `ParentEntity` to call the new helper.
9. Update settings (per-entity overrides) if non-default sizes/quality.
10. Write unit + integration tests covering: SAS issuance, parent-create with Pending, function processes message, derivatives uploaded, patch applied, GET returns final URLs.

---

## CHECKLIST BEFORE MERGE

- [ ] Every controller that persists media publishes the queue message AFTER (not before) the parent doc create.
- [ ] Patch filter is conditional on the array-element id — never trust array index.
- [ ] EXIF orientation applied BEFORE resizing.
- [ ] PDFs skip variant generation; `ProcessingStatus` left null/Skipped per entity contract.
- [ ] Cosmos indexes added for any new array-id field.
- [ ] Blob container provisioned in ARM + `deploy.ps1` + StorageSettings.
- [ ] Idempotent on Service Bus redelivery (verified by integration test).
- [ ] Failure path: `FailureNotificationHelper` → admin alert; abandon vs DLQ logic in place.
- [ ] No cross-partition Cosmos query introduced.
- [ ] Unit + integration tests added; no regression in existing 3955+ unit tests.

### ‼️ ADDENDUM 2026-08-05 — four nested-media index paths REMOVED, and one that LOOKED identical was KEPT

Owner-approved (**DA13**). Deleted from `CosmosContainerPolicies`: `ProviderData` `/serviceImages/[]/imageId/?`,
`/images/[]/imageId/?`, `/documents/[]/documentId/?`; `Reviews` `/images/[]/imageId/?`; `Messages`
`/attachments/[]/attachmentId/?`. An **array** path costs one index entry **per element** on every parent write,
forever — and every one of these served a lookup `PatchStableArrayItemByIdAsync` performs **in memory**.

‼️ **`/pricing/priceType/?` was in the same finding and is KEPT.** `ServiceRepository.GetServicesByPricingTypeAsync`
queries it through a **LINQ predicate**, which the Cosmos provider turns into `WHERE c.pricing.priceType` at
runtime — **an expression tree names no path in any string**, so the literal-SQL sweep that produced the finding
could not see it. Removing it would have demoted a live query to a partition scan.

> ‼️ **THE RULE: before deleting an index because "nothing queries it", enumerate every way a query can be
> EXPRESSED here — literal `QueryDefinition`, `GetItemsByLinqAsync` (expression tree),
> `GetFilteredItemsAsync(whereClause:)`, and server-side scripts (none exist). Treat an expression tree as a
> query.** And note which failure you are risking: an unindexed **filter** degrades to a scan, but an unindexed
> **sort** is a hard **400** — so the `ORDER BY` check must be exhaustive.

Guard: `Clinqet.API.UnitTests.Repositories.NestedMediaIdPathsAreNotIndexedTests` — it asserts the four are
absent from `IncludedPaths` **and** every composite, and carries the `priceType` counter-example beside them.
Deployment: `cosmosindexsetup` applies the policy via `ReplaceContainerAsync`, so a re-run updates the live
index online — ‼️ pass `--launch-profile`; the tool ignores the shell `CLINKET_REGION`.

---

### ‼️ ADDENDUM 2026-08-27 — the five sibling parents no longer ETag-serialise, and there is ONE image-rendering rule per app

**The write path changed.** `Service`, `Portfolio`, `Review`, `Message` and `Licence` derivative
writes used `CosmosDbRepository.PatchStableArrayItemByIdAsync`, which guards with the document
ETag. One upload of N pictures puts N writers on ONE parent row writing N **different** elements,
so the ETag made N-1 of them lose every round for nothing — roughly 10-20× the requests, a
parallel job run serial. They now call the opt-in twin:

```
CosmosDbRepository.PatchMediaDerivativeByIdAsync<TItem>(
    id, partitionKey, arrayPath,
    selectItems, selectItemId, snapshotOf,
    nestedItemId, update, ct)
```

- **Unconditional** atomic patch at the resolved index — no ETag, no FilterPredicate.
  ‼️ A FilterPredicate is NOT an option: the Cosmos emulator cannot evaluate an array-aware
  patch filter (HTTP 500 on `c.images[1].imageId = 'x'`, and a silently WRONG 412 for
  `ARRAY_CONTAINS`/`IS_DEFINED`). It is the textbook guard and it is unverifiable in CI.
- **Verified from the patch's own response**, which is free: the patch returns the updated
  document, so the nested id is read back at the same index. A mismatch means the array was
  re-cut under the writer.
- **Displaced neighbour restored** from the pre-patch snapshot, at its **re-resolved** index in
  the post-patch document, and verified the same free way. ‼️ The restore writes **exactly the
  fields the write clobbered** — never all six. A status-only write (`MarkFailedAsync`) must not
  hand a neighbour a spurious null `thumbnailUrl`/`width`/`height` it never had.
- **`false` has exactly ONE meaning**: the nested item is gone, nothing is owed, complete the
  message. **Exhaustion THROWS** — the write is still owed and only an exception is impossible
  for a caller to discard. Service Bus redelivery is the retry, and it is cheap because the
  derivative is already in blob.
- ‼️ **`BusinessProfileRepository.TryPersistAddressFallbackCoordinatesAsync` KEEPS its ETag and
  must never be converted.** Its index resolution carries a **state condition** (it only ever
  fills a gap: an address with a real coordinate resolves to -1). The ETag is what makes a
  concurrent real coordinate win over a geocoder's estimate. **Read every caller's index
  resolution before converting it: identity-only is safe, a state condition is not.**
- `PatchStableArrayItemByIdAsync` is unchanged and remains the DEFAULT.

Proof that must stay green: `MediaDerivativeRepositoryTests` (Clinqet.API.UnitTests, 33 tests —
the API reaches these through `ServiceBusService` → `IMediaDerivativeFailureMarker`) and
`MediaDerivativeFailureRecoveryIntegrationTests.EveryConcurrentDerivativeOnOneParent_Lands_NoneIsLost`
(20 concurrent writers on ONE row, two containers, against the real engine). Re-introducing the
ETag turns that integration test RED — that is how it was proven.

**The read path changed too.** Every app now has exactly ONE image-rendering rule, in one
`DerivativeImage` component per app:

| App | Component | Chain module |
|---|---|---|
| `clinqetwebpartnerapp` | `src/components/common/DerivativeImage.jsx` | `src/utils/mediaDerivative.js` |
| `clinqetmobilepartnerapp` | `src/components/DerivativeImage.tsx` | `src/utils/imageUtils.ts` |
| `clinqetwebuserapp` | `components/common/DerivativeImage.jsx` | `utils/mediaImage.js` |
| `clinqetmobileuserapp` | `src/components/DerivativeImage.tsx` | `src/utils/imageUtils.ts` |

- Each chain module holds `CHAINS = { thumb, medium, original }` and **every accessor is DEFINED
  as its first element** (`getThumbSrc(x) === getSourceChain(x, "thumb")[0]`). The helper and the
  tile therefore cannot disagree about which URL loads first — it is the same array. Pinned by a
  property test per app over every image shape.
- **Thumbnail FIRST, always.** A grid of forty tiles pulling originals is tens of megabytes.
  `medium` and `original` are size-DESCENDING past position 0, so a full-screen viewer never
  falls back to a 128px thumbnail while the original is available.
- The component advances on a **real `onError`** and shows an honest `image.unavailable` /
  `IMAGE.UNAVAILABLE` only once every source is exhausted. `onError` is forwarded to the caller
  **only at exhaustion**, so a caller cannot draw a failure state while a later source is loading.
- The element type is whatever the call site had (`as="img"`, `as={motion.img}`, or next/image),
  so a tile whose thumbnail loads normally is **pixel-identical**.
- ‼️ **Completeness is machine-checked, never eyeballed.** `derivativeImageSingleSource.test.*` in
  each app scans **its own repo only** (§0.17), **fails loudly** if its scan root does not
  resolve, and carries an exemption registry naming each file's **exact allowed tokens** — so a
  new kind of source-picking inside an exempt file still fails the build. Adding a render site
  that reads `.thumbnailUrl` by hand breaks the build in that app.
- Genuine non-render uses stay exempt with a stated reason: payload mapping, SEO metadata,
  `<video poster>`, a presence check, and `workerViewedCard.jsx` (a hover CAROUSEL that builds
  its own list and already skips a failed index — the shared component paints ONE picture).

**Extraction losses are now alertable.** `KnowledgePdfImageResult` counts three unrelated
outcomes apart — `FilteredWholePageFigures` (F7, deliberate, routine on every scan, NEVER a loss),
`FiguresWithNoPixels` and `UndecodableNativeRasters` — because sharing one total is why neither
real loss could ever be alerted. `LostImages` earns ONE admin alert per document
(`KnowledgeImageExtractionLoss`), raised **before** the no-markers early return, and a
whole-binder failure counts every stripped marker as lost so the biggest loss of all is no
longer fail-silent.
